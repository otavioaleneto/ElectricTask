/**
 * Servidor do assistente de instalação (wizard) do ElectricTask.
 * Roda apenas enquanto a instalação não foi concluída.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const MIN_NODE_MAJOR = 20;
const REQUIRED_MODULES = ["express", "pg", "mysql2", "@google-cloud/storage"];

function hashPassword(password) {
  // Mesmo formato usado pela aplicação: "<salt-hex>:<scrypt-hex>"
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function dbTypeOf(body) {
  const explicit = String((body && body.dbType) || "").toLowerCase();
  if (explicit === "mysql" || explicit === "mariadb") return "mysql";
  if (explicit === "postgres" || explicit === "postgresql") return "postgres";
  if (body && typeof body.databaseUrl === "string" && /^(mysql2?|mariadb):/i.test(body.databaseUrl.trim())) {
    return "mysql";
  }
  return "postgres";
}

function buildDatabaseUrl(body) {
  const dbType = dbTypeOf(body);
  if (body && typeof body.databaseUrl === "string" && body.databaseUrl.trim()) {
    return body.databaseUrl.trim();
  }
  const host = String((body && body.host) || "").trim();
  const defaultPort = dbType === "mysql" ? "3306" : "5432";
  const port = String((body && body.port) || defaultPort).trim();
  const database = String((body && body.database) || "").trim();
  const user = String((body && body.user) || "").trim();
  const password = String((body && body.password) || "");
  if (!host || !database || !user) return null;
  const enc = encodeURIComponent;
  const scheme = dbType === "mysql" ? "mysql" : "postgresql";
  return `${scheme}://${enc(user)}:${enc(password)}@${host}:${port}/${enc(database)}`;
}

function isMysqlUrl(databaseUrl) {
  return /^(mysql2?|mariadb):/i.test(databaseUrl);
}

/**
 * Abre uma conexão (pg ou mysql2, conforme o esquema da URL) e entrega ao
 * callback um cliente unificado: `client.query(texto, params)` sempre
 * devolve `{ rows }`. Placeholders devem ser escritos no estilo $1/$2 e são
 * convertidos para `?` no MySQL.
 */
async function withClient(databaseUrl, fn) {
  if (isMysqlUrl(databaseUrl)) {
    // eslint-disable-next-line global-require
    const mysql = require("mysql2/promise");
    const conn = await mysql.createConnection({
      uri: databaseUrl,
      connectTimeout: 10000,
    });
    const client = {
      dialect: "mysql",
      async query(text, params) {
        const sql = text.replace(/\$\d+/g, "?");
        const [rows] = await conn.query(sql, params || []);
        return { rows: Array.isArray(rows) ? rows : [] };
      },
    };
    try {
      return await fn(client);
    } finally {
      await conn.end().catch(() => {});
    }
  }
  // eslint-disable-next-line global-require
  const { Client } = require("pg");
  const useSsl = /sslmode=require/i.test(databaseUrl);
  const pgClient = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await pgClient.connect();
  const client = {
    dialect: "postgres",
    query: (text, params) => pgClient.query(text, params),
  };
  try {
    return await fn(client);
  } finally {
    await pgClient.end().catch(() => {});
  }
}

/** Conta as tabelas do banco atual, em qualquer dialeto. */
async function countTables(client) {
  const { rows } =
    client.dialect === "mysql"
      ? await client.query(
          "SELECT CAST(count(*) AS SIGNED) AS n FROM information_schema.tables WHERE table_schema = DATABASE()",
        )
      : await client.query(
          "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
        );
  return Number(rows[0].n);
}

/** Divide um dump SQL em comandos individuais (necessário no MySQL). */
function splitSqlStatements(sqlText) {
  return sqlText
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--/.test(s));
}

function checkWritable(dir) {
  try {
    const probe = path.join(dir, `.write-test-${Date.now()}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return { path: dir, writable: true };
  } catch (err) {
    return { path: dir, writable: false, error: String(err && err.message) };
  }
}

function start({ appRoot, envFile, lockFile, port }) {
  // eslint-disable-next-line global-require
  const express = require("express");
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const wizardHtml = path.join(__dirname, "public", "index.html");

  const isInstalled = () => fs.existsSync(lockFile);

  app.use("/install/api", (req, res, next) => {
    if (isInstalled()) {
      res.status(403).json({ error: "A instalação já foi concluída." });
      return;
    }
    next();
  });

  // Etapa 1: dependências
  app.get("/install/api/checks", (_req, res) => {
    const nodeMajor = Number(process.versions.node.split(".")[0]);
    const modules = REQUIRED_MODULES.map((name) => {
      try {
        require.resolve(name, { paths: [appRoot] });
        return { name, ok: true };
      } catch {
        return { name, ok: false };
      }
    });
    const permissions = [
      checkWritable(appRoot),
      checkWritable(os.tmpdir()),
    ];
    res.json({
      node: {
        version: process.versions.node,
        ok: nodeMajor >= MIN_NODE_MAJOR,
        required: `>= ${MIN_NODE_MAJOR}`,
      },
      modules,
      permissions,
      schemaFiles: [
        {
          path: "schema.pgsql.sql",
          ok: fs.existsSync(path.join(appRoot, "schema.pgsql.sql")),
        },
        {
          path: "schema.mysql.sql",
          ok: fs.existsSync(path.join(appRoot, "schema.mysql.sql")),
        },
      ],
      publicDir: {
        path: "public",
        ok: fs.existsSync(path.join(appRoot, "public", "index.html")),
      },
      serverBundle: {
        path: "dist/index.mjs",
        ok: fs.existsSync(path.join(appRoot, "dist", "index.mjs")),
      },
    });
  });

  // Etapa 2: testar conexão com o banco
  app.post("/install/api/test-db", async (req, res) => {
    const databaseUrl = buildDatabaseUrl(req.body);
    if (!databaseUrl) {
      res.status(400).json({ error: "Informe host, banco e usuário (ou a URL completa)." });
      return;
    }
    try {
      const info = await withClient(databaseUrl, async (client) => {
        const version = await client.query("SELECT version() AS version");
        const existingTables = await countTables(client);
        return {
          version: version.rows[0].version,
          existingTables,
        };
      });
      res.json({ ok: true, ...info });
    } catch (err) {
      res.status(400).json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // Etapa 3: criar tabelas
  app.post("/install/api/create-tables", async (req, res) => {
    const databaseUrl = buildDatabaseUrl(req.body);
    if (!databaseUrl) {
      res.status(400).json({ error: "Dados de conexão inválidos." });
      return;
    }
    const schemaName = isMysqlUrl(databaseUrl) ? "schema.mysql.sql" : "schema.pgsql.sql";
    const schemaFile = path.join(appRoot, schemaName);
    if (!fs.existsSync(schemaFile)) {
      res.status(500).json({ error: `Arquivo ${schemaName} não encontrado no pacote.` });
      return;
    }
    const sql = fs.readFileSync(schemaFile, "utf8");
    try {
      const result = await withClient(databaseUrl, async (client) => {
        const before = await countTables(client);
        if (before > 0) {
          const usersExists =
            client.dialect === "mysql"
              ? await client.query(
                  "SELECT CAST(count(*) AS SIGNED) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'",
                ).then((r) => Number(r.rows[0].n) > 0)
              : await client.query(
                  "SELECT to_regclass('public.users') IS NOT NULL AS exists",
                ).then((r) => Boolean(r.rows[0].exists));
          if (usersExists) {
            // Instalação existente: modo atualização — cria apenas as
            // tabelas/colunas/índices que faltam, sem tocar nos dados.
            // eslint-disable-next-line global-require
            const { runUpgrade } = require("./upgrade-db");
            const summary = await runUpgrade({ databaseUrl, schemaFile });
            const after = await countTables(client);
            return {
              skipped: true,
              updated: !summary.upToDate,
              tables: after,
              summary,
            };
          }
        }
        if (client.dialect === "mysql") {
          // MySQL/MariaDB não tem DDL transacional: executa comando a comando.
          for (const statement of splitSqlStatements(sql)) {
            await client.query(statement);
          }
        } else {
          await client.query("BEGIN");
          try {
            await client.query(sql);
            await client.query("COMMIT");
          } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            throw err;
          }
        }
        const after = await countTables(client);
        return { skipped: false, tables: after };
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // Etapa 4: criar usuário administrador
  app.post("/install/api/create-admin", async (req, res) => {
    const databaseUrl = buildDatabaseUrl(req.body);
    const { adminName, adminEmail, adminPassword } = req.body || {};
    if (!databaseUrl) {
      res.status(400).json({ error: "Dados de conexão inválidos." });
      return;
    }
    const name = String(adminName || "").trim();
    const email = String(adminEmail || "").trim().toLowerCase();
    const password = String(adminPassword || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      res.status(400).json({
        error: "Informe nome, e-mail válido e senha com pelo menos 6 caracteres.",
      });
      return;
    }
    try {
      const result = await withClient(databaseUrl, async (client) => {
        const existing = await client.query(
          "SELECT id FROM users WHERE email = $1",
          [email],
        );
        if (existing.rows.length > 0) {
          await client.query(
            "UPDATE users SET name = $1, password_hash = $2, role = 'admin' WHERE email = $3",
            [name, hashPassword(password), email],
          );
          return { updated: true };
        }
        await client.query(
          "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'admin')",
          [email, name, hashPassword(password)],
        );
        return { updated: false };
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // Etapa 5: gravar .env + trava e finalizar
  app.post("/install/api/finalize", async (req, res) => {
    const databaseUrl = buildDatabaseUrl(req.body);
    if (!databaseUrl) {
      res.status(400).json({ error: "Dados de conexão inválidos." });
      return;
    }
    try {
      // Confirma que o banco está acessível antes de gravar a configuração.
      await withClient(databaseUrl, (client) => client.query("SELECT 1"));
    } catch (err) {
      res.status(400).json({ ok: false, error: String((err && err.message) || err) });
      return;
    }
    const sessionSecret = crypto.randomBytes(32).toString("hex");
    const encryptionKey = crypto.randomBytes(32).toString("hex");
    const envContent = [
      "# Gerado automaticamente pelo instalador do ElectricTask",
      `# ${new Date().toISOString()}`,
      "NODE_ENV=production",
      `DATABASE_URL=${databaseUrl}`,
      `SESSION_SECRET=${sessionSecret}`,
      `SUBSCRIPTION_ENCRYPTION_KEY=${encryptionKey}`,
      "",
    ].join("\n");
    try {
      fs.writeFileSync(envFile, envContent, { mode: 0o600 });
      fs.writeFileSync(lockFile, new Date().toISOString());
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: `Não foi possível gravar a configuração: ${String((err && err.message) || err)}`,
      });
      return;
    }
    res.json({ ok: true, restarting: true });
    // Encerra o processo para o Passenger (cPanel) reiniciar já no modo normal.
    setTimeout(() => process.exit(0), 1500);
  });

  // Qualquer outra rota: serve o wizard (ou avisa que já está instalado).
  app.use((req, res) => {
    if (isInstalled()) {
      res
        .status(200)
        .send(
          "<html><body style=\"font-family:sans-serif\"><h2>Instalação concluída</h2><p>Reinicie a aplicação no cPanel (Setup Node.js App &gt; Restart) para acessar o ElectricTask.</p></body></html>",
        );
      return;
    }
    res.sendFile(wizardHtml);
  });

  app.listen(port, () => {
    console.log(`Instalador do ElectricTask disponível na porta ${port} (acesse /install)`);
  });
}

module.exports = {
  start,
  // Exportados para testes:
  buildDatabaseUrl,
  dbTypeOf,
  withClient,
  countTables,
  splitSqlStatements,
};
