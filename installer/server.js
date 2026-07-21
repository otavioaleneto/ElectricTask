/**
 * Arquivo de inicialização (startup file) para cPanel "Setup Node.js App".
 *
 * - Carrega variáveis do arquivo .env (se existir).
 * - Se a instalação ainda não foi concluída (.installed ausente),
 *   inicia o assistente de instalação (wizard) em /install.
 * - Se já foi instalada, inicia a aplicação principal (dist/index.mjs).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const APP_ROOT = __dirname;
const ENV_FILE = path.join(APP_ROOT, ".env");
const LOCK_FILE = path.join(APP_ROOT, ".installed");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(ENV_FILE);

// Porta: o Passenger (cPanel) define PORT automaticamente. Fallback para 3000.
if (!process.env.PORT) {
  process.env.PORT = "3000";
}

// Sinaliza para a aplicação onde está a raiz do pacote instalado
// (usado pelo endpoint de download do instalador e pelo front-end estático).
process.env.FLOWDECK_INSTALLER_ROOT = APP_ROOT;
if (!process.env.FLOWDECK_PUBLIC_DIR) {
  process.env.FLOWDECK_PUBLIC_DIR = path.join(APP_ROOT, "public");
}

const installed =
  fs.existsSync(LOCK_FILE) &&
  typeof process.env.DATABASE_URL === "string" &&
  process.env.DATABASE_URL.length > 0;

function startApp() {
  import(path.join(APP_ROOT, "dist", "index.mjs")).catch((err) => {
    console.error("Falha ao iniciar a aplicação principal:", err);
    process.exit(1);
  });
}

/**
 * Atualização automática da estrutura do banco antes de subir a aplicação.
 * Cria apenas tabelas/colunas/índices que faltam — nunca apaga nada.
 * Se falhar, registra o erro (console + upgrade-db.log) e sobe mesmo assim.
 */
function upgradeDatabaseThenStart() {
  const upgradeLog = path.join(APP_ROOT, "upgrade-db.log");
  const logLine = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
      fs.appendFileSync(upgradeLog, line + "\n");
    } catch {
      /* pasta sem escrita: segue só com console */
    }
  };
  let runUpgrade;
  try {
    ({ runUpgrade } = require(path.join(APP_ROOT, "installer", "upgrade-db.js")));
  } catch (err) {
    console.error("Atualizador de banco indisponível:", err);
    startApp();
    return;
  }
  const isMysql = /^(mysql2?|mariadb):/i.test(process.env.DATABASE_URL);
  const schemaFile = path.join(
    APP_ROOT,
    isMysql ? "schema.mysql.sql" : "schema.pgsql.sql",
  );
  if (!fs.existsSync(schemaFile)) {
    logLine(`Arquivo ${path.basename(schemaFile)} não encontrado — atualização do banco ignorada.`);
    startApp();
    return;
  }
  runUpgrade({ databaseUrl: process.env.DATABASE_URL, schemaFile, log: logLine })
    .then((summary) => {
      if (!summary.upToDate) {
        logLine(
          `Banco atualizado: ${summary.createdTables.length} tabela(s), ` +
            `${summary.addedColumns.length} coluna(s), ${summary.createdIndexes.length} índice(s).`,
        );
        for (const w of summary.warnings) logLine(`AVISO: ${w}`);
      }
    })
    .catch((err) => {
      logLine(`ERRO na atualização do banco: ${String((err && err.stack) || err)}`);
      logLine("A aplicação será iniciada mesmo assim; a atualização será tentada de novo no próximo restart.");
    })
    .then(startApp);
}

if (installed) {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
  }
  upgradeDatabaseThenStart();
} else {
  // Modo instalação: sobe apenas o assistente.
  require(path.join(APP_ROOT, "installer", "installer-server.js")).start({
    appRoot: APP_ROOT,
    envFile: ENV_FILE,
    lockFile: LOCK_FILE,
    port: Number(process.env.PORT),
  });
}
