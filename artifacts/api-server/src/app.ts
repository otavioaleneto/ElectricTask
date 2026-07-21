import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { localUploadRouter } from "./routes/storage";
import { logger } from "./lib/logger";
import { SESSION_SECRET } from "./lib/auth";
import { corsOptions } from "./lib/cors";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));
app.use(cookieParser(SESSION_SECRET));
// Upload local em disco: precisa vir ANTES do express.json() para receber o
// corpo bruto (inclusive arquivos .json) sem o limite de 12 MB do parser.
app.use("/api", localUploadRouter);
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

app.use("/api", router);

// Erros não tratados nas rotas da API: loga o detalhe e responde JSON, em vez
// da página HTML "Internal Server Error" padrão do Express (sem informação).
app.use(
  "/api",
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    // Erros de cliente (ex.: body-parser — JSON malformado → 400, corpo
    // acima do limite → 413) mantêm o status original.
    const status = Number(
      (err as { status?: number; statusCode?: number })?.status ??
        (err as { status?: number; statusCode?: number })?.statusCode,
    );
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      res.status(status).json({ error: "Requisição inválida" });
      return;
    }
    logger.error({ err }, "Erro não tratado na API");
    res.status(500).json({
      error:
        "Erro interno do servidor. Verifique o log da aplicação para detalhes.",
    });
  },
);

// Em produção (ex.: hospedagem compartilhada), o servidor também entrega o
// front-end (build do Vite). O diretório pode ser definido via
// FLOWDECK_PUBLIC_DIR; por padrão procura "public" ao lado do bundle e no cwd.
const publicDirCandidates = [
  process.env.FLOWDECK_PUBLIC_DIR,
  path.resolve(process.cwd(), "public"),
].filter((p): p is string => Boolean(p));

const publicDir =
  process.env.NODE_ENV === "production"
    ? publicDirCandidates.find(
        (p) =>
          fs.existsSync(path.join(p, "index.html")) &&
          fs.statSync(p).isDirectory(),
      )
    : undefined;

if (publicDir) {
  logger.info({ publicDir }, "Servindo front-end estático");

  // Depois de instalado, o instalador fica bloqueado: /install manda para o login.
  app.get(["/install", "/install/*splat"], (_req, res) => {
    res.redirect("/login");
  });

  app.use(express.static(publicDir));

  // Fallback SPA: qualquer GET que não seja da API devolve o index.html.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
