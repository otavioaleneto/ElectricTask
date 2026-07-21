/**
 * Atualização automática da estrutura do banco (schema upgrade).
 *
 * Compara o banco atual com o arquivo de schema do pacote
 * (schema.pgsql.sql ou schema.mysql.sql) e aplica, de forma idempotente,
 * apenas o que estiver faltando:
 *   - tabelas novas (CREATE TABLE + índices + chaves estrangeiras);
 *   - colunas novas em tabelas existentes (ALTER TABLE ADD COLUMN);
 *   - índices ausentes.
 *
 * NUNCA remove nem altera tabelas, colunas ou dados existentes.
 */
"use strict";

const fs = require("fs");
const { withClient, splitSqlStatements } = require("./installer-server");

// Chave fixa para o advisory lock (PostgreSQL) — evita upgrades concorrentes
// quando o Passenger sobe mais de um processo ao mesmo tempo.
const PG_LOCK_KEY = 764912;
const MYSQL_LOCK_NAME = "flowdeck_schema_upgrade";

/** Divide o dump em comandos e classifica cada um. */
function parseSchema(sqlText) {
  const tables = new Map(); // nome -> { createSql, columns: Map(nome -> linha de definição) }
  const fks = []; // { table, name, sql }
  const indexes = []; // { table, name, sql }

  for (const stmt of splitSqlStatements(sqlText)) {
    let m;
    if ((m = stmt.match(/^CREATE TABLE\s+["`]([^"`]+)["`]\s*\(/i))) {
      const name = m[1];
      const body = stmt.slice(stmt.indexOf("(") + 1, stmt.lastIndexOf(")"));
      const columns = new Map();
      for (const rawLine of body.split(/\r?\n/)) {
        const line = rawLine.trim().replace(/,\s*$/, "");
        if (!line) continue;
        if (/^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK)\b/i.test(line)) {
          continue;
        }
        const cm = line.match(/^["`]([^"`]+)["`]\s+\S/);
        if (cm) columns.set(cm[1], line);
      }
      tables.set(name, { createSql: stmt, columns });
    } else if (
      (m = stmt.match(
        /^ALTER TABLE\s+["`]([^"`]+)["`]\s+ADD CONSTRAINT\s+["`]([^"`]+)["`]/i,
      ))
    ) {
      fks.push({ table: m[1], name: m[2], sql: stmt });
    } else if (
      (m = stmt.match(
        /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+["`]([^"`]+)["`]\s+ON\s+["`]([^"`]+)["`]/i,
      ))
    ) {
      indexes.push({ name: m[1], table: m[2], sql: stmt });
    }
  }
  return { tables, fks, indexes };
}

/** Lê tabelas, colunas e índices existentes no banco conectado. */
async function introspect(client) {
  let tableRows, columnRows, indexRows;
  if (client.dialect === "mysql") {
    tableRows = (
      await client.query(
        "SELECT table_name AS tbl FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
      )
    ).rows;
    columnRows = (
      await client.query(
        "SELECT table_name AS tbl, column_name AS col FROM information_schema.columns WHERE table_schema = DATABASE()",
      )
    ).rows;
    indexRows = (
      await client.query(
        "SELECT DISTINCT table_name AS tbl, index_name AS idx FROM information_schema.statistics WHERE table_schema = DATABASE()",
      )
    ).rows;
  } else {
    tableRows = (
      await client.query(
        "SELECT tablename AS tbl FROM pg_tables WHERE schemaname = current_schema()",
      )
    ).rows;
    columnRows = (
      await client.query(
        "SELECT table_name AS tbl, column_name AS col FROM information_schema.columns WHERE table_schema = current_schema()",
      )
    ).rows;
    indexRows = (
      await client.query(
        "SELECT tablename AS tbl, indexname AS idx FROM pg_indexes WHERE schemaname = current_schema()",
      )
    ).rows;
  }
  const existingTables = new Set(tableRows.map((r) => String(r.tbl)));
  const existingColumns = new Map(); // tabela -> Set(colunas)
  for (const r of columnRows) {
    const t = String(r.tbl);
    if (!existingColumns.has(t)) existingColumns.set(t, new Set());
    existingColumns.get(t).add(String(r.col));
  }
  const existingIndexes = new Set(
    indexRows.map((r) => `${String(r.tbl)}\u0000${String(r.idx)}`),
  );
  return { existingTables, existingColumns, existingIndexes };
}

function quoteId(client, id) {
  return client.dialect === "mysql" ? "`" + id + "`" : '"' + id + '"';
}

async function tableHasRows(client, table) {
  const { rows } = await client.query(
    `SELECT 1 AS one FROM ${quoteId(client, table)} LIMIT 1`,
  );
  return rows.length > 0;
}

/**
 * Executa a atualização. Retorna um resumo:
 * { createdTables, addedColumns, createdIndexes, addedForeignKeys, warnings, upToDate }
 */
async function runUpgrade({ databaseUrl, schemaFile, log }) {
  const say = typeof log === "function" ? log : () => {};
  const sqlText = fs.readFileSync(schemaFile, "utf8");
  const parsed = parseSchema(sqlText);
  if (parsed.tables.size === 0) {
    throw new Error(`Nenhuma tabela encontrada em ${schemaFile}`);
  }

  return withClient(databaseUrl, async (client) => {
    // Trava contra execução concorrente (vários processos do Passenger).
    if (client.dialect === "mysql") {
      const { rows } = await client.query(
        `SELECT GET_LOCK('${MYSQL_LOCK_NAME}', 60) AS ok`,
      );
      if (Number(rows[0].ok) !== 1) {
        throw new Error("Não foi possível obter a trava de atualização do banco.");
      }
    } else {
      await client.query(`SELECT pg_advisory_lock(${PG_LOCK_KEY})`);
    }

    try {
      const { existingTables, existingColumns, existingIndexes } =
        await introspect(client);

      const summary = {
        createdTables: [],
        addedColumns: [],
        createdIndexes: [],
        addedForeignKeys: [],
        warnings: [],
        upToDate: false,
      };

      // 1. Planeja o que falta.
      const missingTables = [];
      const missingColumns = []; // { table, column, def }
      for (const [name, table] of parsed.tables) {
        if (!existingTables.has(name)) {
          missingTables.push(name);
          continue;
        }
        const cols = existingColumns.get(name) || new Set();
        for (const [colName, def] of table.columns) {
          if (!cols.has(colName)) {
            missingColumns.push({ table: name, column: colName, def });
          }
        }
      }
      const newTableSet = new Set(missingTables);
      // No PostgreSQL nomes de índice são globais no schema: se já existe um
      // índice com o mesmo nome (mesmo em outra tabela), o CREATE INDEX
      // falharia para sempre — então basta o nome existir para pular.
      const indexNames = new Set(
        [...existingIndexes].map((k) => k.split("\u0000")[1]),
      );
      const missingIndexes = parsed.indexes.filter((ix) =>
        client.dialect === "mysql"
          ? !existingIndexes.has(`${ix.table}\u0000${ix.name}`)
          : !indexNames.has(ix.name),
      );
      const missingFks = parsed.fks.filter((fk) => newTableSet.has(fk.table));

      if (
        missingTables.length === 0 &&
        missingColumns.length === 0 &&
        missingIndexes.length === 0
      ) {
        summary.upToDate = true;
        say("Estrutura do banco já está atualizada.");
        return summary;
      }

      const useTx = client.dialect !== "mysql"; // MySQL não tem DDL transacional
      if (useTx) await client.query("BEGIN");

      try {
        // 2. Cria tabelas novas.
        for (const name of missingTables) {
          say(`Criando tabela ${name}...`);
          await client.query(parsed.tables.get(name).createSql);
          summary.createdTables.push(name);
        }

        // 3. Adiciona colunas novas em tabelas existentes.
        for (const { table, column, def } of missingColumns) {
          let colDef = def;
          const notNullNoDefault =
            /\bNOT NULL\b/i.test(colDef) &&
            !/\bDEFAULT\b/i.test(colDef) &&
            !/\bGENERATED\b/i.test(colDef) &&
            !/\bAUTO_INCREMENT\b/i.test(colDef) &&
            !/\bserial\b/i.test(colDef);
          if (notNullNoDefault && (await tableHasRows(client, table))) {
            colDef = colDef.replace(/\s+NOT NULL\b/i, "");
            summary.warnings.push(
              `Coluna ${table}.${column} adicionada aceitando NULL (tabela já tem dados e a definição não tem DEFAULT).`,
            );
          }
          say(`Adicionando coluna ${table}.${column}...`);
          await client.query(
            `ALTER TABLE ${quoteId(client, table)} ADD COLUMN ${colDef}`,
          );
          summary.addedColumns.push(`${table}.${column}`);
        }

        // Executa uma instrução "opcional": a falha vira aviso e NÃO aborta o
        // resto. No PostgreSQL qualquer erro aborta a transação inteira (o
        // COMMIT viraria ROLLBACK silencioso), então cada instrução opcional
        // roda protegida por SAVEPOINT.
        const tryOptional = async (sql, onError) => {
          if (useTx) await client.query("SAVEPOINT upg_sp");
          try {
            await client.query(sql);
            if (useTx) await client.query("RELEASE SAVEPOINT upg_sp");
            return true;
          } catch (err) {
            if (useTx) await client.query("ROLLBACK TO SAVEPOINT upg_sp");
            onError(err);
            return false;
          }
        };

        // 4. Chaves estrangeiras apenas das tabelas recém-criadas
        //    (em tabelas antigas poderiam falhar por dados órfãos).
        for (const fk of missingFks) {
          const ok = await tryOptional(fk.sql, (err) => {
            summary.warnings.push(
              `Chave estrangeira ${fk.name} não pôde ser criada: ${String((err && err.message) || err)}`,
            );
          });
          if (ok) summary.addedForeignKeys.push(fk.name);
        }

        // 5. Índices ausentes (inclusive das tabelas novas).
        for (const ix of missingIndexes) {
          // Se o índice falhar (ex.: UNIQUE sobre dados duplicados ou colisão
          // de nome), tratamos como aviso e seguimos.
          say(`Criando índice ${ix.name}...`);
          const ok = await tryOptional(ix.sql, (err) => {
            summary.warnings.push(
              `Índice ${ix.name} não pôde ser criado: ${String((err && err.message) || err)}`,
            );
          });
          if (ok) summary.createdIndexes.push(ix.name);
        }

        if (useTx) await client.query("COMMIT");
      } catch (err) {
        if (useTx) await client.query("ROLLBACK").catch(() => {});
        throw err;
      }

      return summary;
    } finally {
      if (client.dialect === "mysql") {
        await client
          .query(`SELECT RELEASE_LOCK('${MYSQL_LOCK_NAME}')`)
          .catch(() => {});
      } else {
        await client
          .query(`SELECT pg_advisory_unlock(${PG_LOCK_KEY})`)
          .catch(() => {});
      }
    }
  });
}

module.exports = {
  runUpgrade,
  // Exportados para testes:
  parseSchema,
};
