/**
 * Monta o pacote de instalação do ElectricTask para hospedagem compartilhada.
 *
 * Uso: node scripts/build-installer.mjs [--skip-build]
 *
 * Saída:
 *   dist-installer/package/            — arquivos prontos para upload
 *   dist-installer/electrictask-installer.zip
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(repoRoot, "dist-installer");
const pkgDir = path.join(outRoot, "package");
const zipFile = path.join(outRoot, "electrictask-installer.zip");

const skipBuild = process.argv.includes("--skip-build");

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, ...opts });
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

console.log("== ElectricTask — gerador do pacote de instalação ==");

// 1. Builds
if (!skipBuild) {
  run("pnpm --filter @workspace/api-server run build");
  run("pnpm --filter @workspace/flowdeck run build", {
    env: {
      ...process.env,
      NODE_ENV: "production",
      BASE_PATH: "/",
      PORT: process.env.PORT ?? "5000",
    },
  });
}

const serverDist = path.join(repoRoot, "artifacts/api-server/dist");
const webDist = path.join(repoRoot, "artifacts/flowdeck/dist/public");
if (!fs.existsSync(path.join(serverDist, "index.mjs"))) {
  throw new Error(`Bundle do servidor não encontrado em ${serverDist}. Rode sem --skip-build.`);
}
if (!fs.existsSync(path.join(webDist, "index.html"))) {
  throw new Error(`Build do front-end não encontrado em ${webDist}. Rode sem --skip-build.`);
}

// Sanidade: o bundle precisa conter o suporte híbrido de banco (detecção de
// dialeto + driver MySQL). Um bundle antigo (só Postgres) instala "com
// sucesso" no MySQL e depois quebra com 500 no primeiro acesso ao banco.
const serverBundle = fs.readFileSync(path.join(serverDist, "index.mjs"), "utf8");
if (!/mysql2\?\|mariadb/.test(serverBundle) || !serverBundle.includes("mysql2/promise")) {
  throw new Error(
    "O bundle do servidor (dist/index.mjs) não contém o suporte a MySQL/MariaDB. " +
      "Ele está desatualizado — rode o empacotador sem --skip-build.",
  );
}

// 2. schema.pgsql.sql + schema.mysql.sql a partir do schema Drizzle
// (o export não conecta ao banco)
fs.rmSync(pkgDir, { recursive: true, force: true });
fs.mkdirSync(pkgDir, { recursive: true });

function exportSchema(configFile, placeholderUrl, outFile) {
  console.log(`\nGerando ${outFile}…`);
  const raw = execSync(
    `pnpm --silent --filter @workspace/db exec drizzle-kit export --config ./${configFile}`,
    {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: placeholderUrl },
      maxBuffer: 32 * 1024 * 1024,
    },
  ).toString();
  // O drizzle-kit imprime linhas informativas ("Reading schema files: …")
  // antes do SQL; descarta tudo que vier antes da primeira instrução.
  const firstStmt = raw.search(/^(CREATE |ALTER |SET |INSERT |--|\/\*)/im);
  const sql = firstStmt >= 0 ? raw.slice(firstStmt) : raw;
  if (!/CREATE TABLE/i.test(sql)) {
    throw new Error(`A geração de ${outFile} não produziu instruções CREATE TABLE.`);
  }
  fs.writeFileSync(path.join(pkgDir, outFile), sql);
  return sql;
}

exportSchema(
  "drizzle.config.ts",
  "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  "schema.pgsql.sql",
);
exportSchema(
  "drizzle-mysql.config.ts",
  "mysql://placeholder:placeholder@localhost:3306/placeholder",
  "schema.mysql.sql",
);

// 3. Copiar artefatos (sem sourcemaps nem arquivos de desenvolvimento)
console.log("Copiando arquivos do pacote…");
fs.cpSync(serverDist, path.join(pkgDir, "dist"), {
  recursive: true,
  filter: (src) => !src.endsWith(".map"),
});
copyDir(webDist, path.join(pkgDir, "public"));
copyDir(path.join(repoRoot, "installer/public"), path.join(pkgDir, "installer/public"));
fs.copyFileSync(
  path.join(repoRoot, "installer/installer-server.js"),
  path.join(pkgDir, "installer/installer-server.js"),
);
fs.copyFileSync(
  path.join(repoRoot, "installer/upgrade-db.js"),
  path.join(pkgDir, "installer/upgrade-db.js"),
);
fs.copyFileSync(path.join(repoRoot, "installer/server.js"), path.join(pkgDir, "server.js"));
fs.copyFileSync(path.join(repoRoot, "install-setup.md"), path.join(pkgDir, "install-setup.md"));
fs.copyFileSync(
  path.join(repoRoot, "install-setup-vps.md"),
  path.join(pkgDir, "install-setup-vps.md"),
);

// 4. package.json mínimo de runtime (somente dependências não empacotadas)
const apiPkg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "artifacts/api-server/package.json"), "utf8"),
);
const runtimePkg = {
  name: "flowdeck",
  version: apiPkg.version ?? "1.0.0",
  private: true,
  description: "ElectricTask — pacote para hospedagem compartilhada (cPanel Setup Node.js App)",
  main: "server.js",
  scripts: {
    start: "node server.js",
  },
  engines: { node: ">=20" },
  dependencies: {
    // Externalizado no bundle (esbuild) e importado pela aplicação:
    "@google-cloud/storage": apiPkg.dependencies["@google-cloud/storage"],
    // Usados pelo assistente de instalação (installer/):
    express: apiPkg.dependencies.express,
    pg: "^8.16.0",
    mysql2: apiPkg.dependencies.mysql2 ?? "^3.22.5",
  },
};
fs.writeFileSync(
  path.join(pkgDir, "package.json"),
  JSON.stringify(runtimePkg, null, 2) + "\n",
);

// 5. .htaccess não é necessário (Passenger cuida do proxy), mas deixamos um
// lembrete de estrutura no pacote.
fs.writeFileSync(
  path.join(pkgDir, "LEIA-ME.txt"),
  [
    "ElectricTask — pacote de instalação para hospedagem compartilhada",
    "",
    "1. Leia o arquivo install-setup.md (passo a passo completo).",
    "   Para instalar em VPS (servidor próprio), leia install-setup-vps.md.",
    "2. Startup file no cPanel: server.js",
    "3. Após 'Run NPM Install', acesse https://seudominio/install para abrir o assistente.",
    "",
    "ATUALIZANDO uma instalação existente? NÃO apague a pasta da aplicação!",
    "Os arquivos ocultos .env e .installed guardam a conexão com o banco.",
    "Extraia o zip POR CIMA dos arquivos atuais (sobrescrever) e reinicie.",
    "Ao reiniciar, o banco de dados é atualizado automaticamente (só cria",
    "tabelas/colunas que faltam — nunca apaga dados). Log em upgrade-db.log.",
    "Nunca rode o assistente /install de novo em uma instalação em uso.",
    "Detalhes na seção 'Atualização de versão' do install-setup.md.",
    "",
  ].join("\n"),
);

// 6. Verificação de release: o pacote não pode conter código-fonte nem
// artefatos de desenvolvimento.
const FORBIDDEN = [/\.map$/, /\.tsx?$/, /(^|\/)src\//, /(^|\/)node_modules\//, /(^|\/)\.env/];
function listFiles(dir, base = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}
const allFiles = listFiles(pkgDir);
const offenders = allFiles.filter((f) => FORBIDDEN.some((re) => re.test(f)));
if (offenders.length > 0) {
  throw new Error(
    `O pacote contém arquivos proibidos (código-fonte/dev):\n${offenders.slice(0, 20).join("\n")}`,
  );
}
console.log(`Verificação de release OK (${allFiles.length} arquivos, sem .map/.ts/src/node_modules).`);

// 7. Zip (via archiver — o CLI "zip" não está disponível em todo ambiente)
console.log("Compactando…");
fs.rmSync(zipFile, { force: true });
const { default: archiver } = await import("archiver");
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(zipFile);
  const archive = archiver("zip", { zlib: { level: 9 } });
  output.on("close", resolve);
  archive.on("error", reject);
  archive.pipe(output);
  archive.directory(pkgDir, false);
  archive.finalize();
});

const size = (fs.statSync(zipFile).size / 1024 / 1024).toFixed(1);
console.log(`\nPacote pronto: ${zipFile} (${size} MB)`);
