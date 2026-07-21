import { Router, type IRouter, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import archiver from "archiver";
import { requireAdmin, type AuthRequest } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(requireAdmin);

/**
 * Localiza a raiz do monorepo (ambiente de desenvolvimento) subindo a partir
 * do cwd até encontrar o script de empacotamento.
 */
function findRepoRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "scripts", "build-installer.mjs"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Deduplica builds concorrentes: dois downloads simultâneos compartilham o
// mesmo build (evita dois processos regravando dist-installer ao mesmo tempo).
let buildInFlight: Promise<void> | null = null;

function runBuildScript(repoRoot: string): Promise<void> {
  if (buildInFlight) return buildInFlight;
  buildInFlight = runBuildScriptOnce(repoRoot).finally(() => {
    buildInFlight = null;
  });
  return buildInFlight;
}

function runBuildScriptOnce(repoRoot: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(repoRoot, "scripts", "build-installer.mjs")],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      logger.info({ out: chunk.toString().trim() }, "build-installer");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build-installer saiu com código ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

/**
 * Compacta os arquivos de uma instalação já publicada (hospedagem
 * compartilhada), excluindo node_modules, configuração e dados locais.
 */
function streamInstalledPackage(rootDir: string, res: Response): void {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="electrictask-installer.zip"',
  );
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    logger.error({ err }, "Erro ao compactar pacote do instalador");
    if (!res.headersSent) {
      res.status(500).json({ error: "Falha ao gerar o pacote" });
    } else {
      res.destroy();
    }
  });
  archive.pipe(res);
  // Allowlist estrita: somente os artefatos do pacote de instalação.
  // Nunca inclua dotfiles (.env, .installed, .npmrc, …) nem outros arquivos
  // presentes na raiz da aplicação.
  const ALLOWED_DIRS = ["dist", "public", "installer"];
  const ALLOWED_FILES = [
    "server.js",
    "schema.pgsql.sql",
    "schema.mysql.sql",
    "package.json",
    "install-setup.md",
    "LEIA-ME.txt",
  ];
  const addDirFiltered = (dir: string, base: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = `${base}/${entry.name}`;
      if (entry.isDirectory()) {
        addDirFiltered(full, rel);
      } else if (!entry.name.endsWith(".map") && !/\.tsx?$/.test(entry.name)) {
        archive.file(full, { name: rel });
      }
    }
  };
  for (const dir of ALLOWED_DIRS) {
    const full = path.join(rootDir, dir);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      addDirFiltered(full, dir);
    }
  }
  for (const file of ALLOWED_FILES) {
    const full = path.join(rootDir, file);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      archive.file(full, { name: file });
    }
  }
  void archive.finalize();
}

router.get(
  "/admin/installer/download",
  async (req: AuthRequest, res: Response) => {
    const installedRoot = process.env.FLOWDECK_INSTALLER_ROOT;

    // Modo hospedagem: compacta os próprios arquivos instalados.
    if (installedRoot && fs.existsSync(path.join(installedRoot, "server.js"))) {
      streamInstalledPackage(installedRoot, res);
      return;
    }

    // Modo desenvolvimento (monorepo): gera o pacote sob demanda.
    const repoRoot = findRepoRoot();
    if (!repoRoot) {
      res.status(500).json({
        error:
          "Não foi possível localizar o gerador do pacote de instalação neste ambiente.",
      });
      return;
    }
    const zipFile = path.join(
      repoRoot,
      "dist-installer",
      "electrictask-installer.zip",
    );
    // Sempre regera o pacote: servir um zip em cache pode entregar um bundle
    // desatualizado (ex.: sem o suporte a MySQL), quebrando a instalação.
    // `?cached=1` permite pular a regeração explicitamente, se necessário.
    const useCache = req.query.cached === "1" && fs.existsSync(zipFile);
    if (!useCache) {
      try {
        await runBuildScript(repoRoot);
      } catch (err) {
        logger.error({ err }, "Falha ao gerar pacote do instalador");
        res.status(500).json({
          error:
            "Falha ao gerar o pacote de instalação. Verifique os logs do servidor.",
        });
        return;
      }
    }
    if (!fs.existsSync(zipFile)) {
      res.status(500).json({ error: "O pacote não foi gerado." });
      return;
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="electrictask-installer.zip"',
    );
    res.sendFile(zipFile);
  },
);

export default router;
