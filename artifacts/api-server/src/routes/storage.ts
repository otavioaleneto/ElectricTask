import express, {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import { RequestUploadUrlBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import {
  ObjectStorageService,
  verifyLocalUploadSignature,
  saveLocalUpload,
} from "../lib/objectStorage";
import { logger } from "../lib/logger";

const MAX_LOCAL_UPLOAD_SIZE = "25mb";

// Recebe o corpo bruto do PUT de upload local. Montado em app.ts ANTES do
// express.json(), para que o corpo não seja consumido/limitado pelo parser
// global (ex.: upload de um arquivo .json).
export const localUploadRouter: IRouter = Router();

localUploadRouter.put(
  "/storage/local-upload/:id",
  express.raw({ type: () => true, limit: MAX_LOCAL_UPLOAD_SIZE }),
  async (req: Request, res: Response) => {
    const objectId = String(req.params.id || "");
    const exp = String(req.query.exp ?? "");
    const sig = String(req.query.sig ?? "");
    if (!verifyLocalUploadSignature(objectId, exp, sig)) {
      res.status(403).json({ error: "URL de upload inválida ou expirada" });
      return;
    }
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (data.length === 0) {
      res.status(400).json({ error: "Arquivo vazio" });
      return;
    }
    const contentType = String(
      req.headers["content-type"] || "application/octet-stream",
    );
    try {
      await saveLocalUpload(objectId, data, contentType);
      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error({ err: error }, "Erro ao gravar upload local");
      res.status(500).json({ error: "Falha ao gravar o arquivo" });
    }
  },
);

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.use(requireAuth);

router.post(
  "/storage/uploads/request-url",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(RequestUploadUrlBody, req.body, res);
    if (!body) return;
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.status(200).json({
        uploadURL,
        objectPath,
        metadata: {
          name: body.name,
          size: body.size,
          contentType: body.contentType,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Erro ao gerar URL de upload");
      res.status(500).json({ error: "Falha ao gerar URL de upload" });
    }
  },
);

export default router;
