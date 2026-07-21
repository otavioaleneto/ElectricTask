import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import { SESSION_SECRET } from "./auth";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// ---------------------------------------------------------------------------
// Driver de armazenamento
//
// Quando PRIVATE_OBJECT_DIR está definido, usamos o Object Storage do Replit
// (Google Cloud Storage via sidecar). Sem ele — caso típico de hospedagem
// compartilhada (cPanel) — os anexos são gravados em disco local, na pasta
// "uploads" ao lado da aplicação (ou LOCAL_UPLOADS_DIR).
// ---------------------------------------------------------------------------

export function isLocalStorageMode(): boolean {
  return !process.env.PRIVATE_OBJECT_DIR;
}

function getLocalUploadsDir(): string {
  return (
    process.env.LOCAL_UPLOADS_DIR || path.resolve(process.cwd(), "uploads")
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const LOCAL_UPLOAD_TTL_MS = 15 * 60 * 1000;

function signLocalUpload(objectId: string, expiresAt: number): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(`local-upload:${objectId}:${expiresAt}`)
    .digest("hex");
}

export function verifyLocalUploadSignature(
  objectId: string,
  expRaw: string,
  sigRaw: string,
): boolean {
  if (!UUID_RE.test(objectId)) return false;
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = Buffer.from(signLocalUpload(objectId, expiresAt), "utf8");
  const provided = Buffer.from(String(sigRaw || ""), "utf8");
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

export async function saveLocalUpload(
  objectId: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  if (!UUID_RE.test(objectId)) {
    throw new Error("Invalid upload id");
  }
  const dir = getLocalUploadsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, objectId), data);
  const meta: LocalObjectMetadata = {
    contentType: contentType || "application/octet-stream",
    size: data.length,
    uploadedAt: new Date().toISOString(),
  };
  await fs.promises.writeFile(
    path.join(dir, `${objectId}.meta.json`),
    JSON.stringify(meta),
  );
}

export interface LocalObjectMetadata {
  contentType?: string;
  size?: number;
  uploadedAt?: string;
}

/** Adaptador com a mesma interface usada nas rotas (getMetadata/createReadStream). */
export class LocalObjectFile {
  constructor(
    private readonly filePath: string,
    private readonly meta: LocalObjectMetadata,
  ) {}

  async getMetadata(): Promise<[LocalObjectMetadata]> {
    return [this.meta];
  }

  createReadStream(): fs.ReadStream {
    return fs.createReadStream(this.filePath);
  }
}

export type StoredObjectFile = File | LocalObjectFile;

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    if (isLocalStorageMode()) {
      const objectId = randomUUID();
      const expiresAt = Date.now() + LOCAL_UPLOAD_TTL_MS;
      const sig = signLocalUpload(objectId, expiresAt);
      return `/api/storage/local-upload/${objectId}?exp=${expiresAt}&sig=${sig}`;
    }

    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObjectFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    if (isLocalStorageMode()) {
      const prefix = "/objects/uploads/";
      if (!objectPath.startsWith(prefix)) {
        throw new ObjectNotFoundError();
      }
      const objectId = objectPath.slice(prefix.length);
      // UUID estrito: impede path traversal e o acesso aos .meta.json.
      if (!UUID_RE.test(objectId)) {
        throw new ObjectNotFoundError();
      }
      const filePath = path.join(getLocalUploadsDir(), objectId);
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(filePath);
      } catch {
        throw new ObjectNotFoundError();
      }
      if (!stat.isFile()) {
        throw new ObjectNotFoundError();
      }
      let meta: LocalObjectMetadata = {};
      try {
        meta = JSON.parse(
          await fs.promises.readFile(`${filePath}.meta.json`, "utf8"),
        ) as LocalObjectMetadata;
      } catch {
        meta = {};
      }
      return new LocalObjectFile(filePath, {
        contentType: meta.contentType || "application/octet-stream",
        size: typeof meta.size === "number" ? meta.size : stat.size,
        uploadedAt: meta.uploadedAt,
      });
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // URL de upload local: /api/storage/local-upload/<uuid>?exp=…&sig=…
    const localMatch = rawPath.match(
      /\/api\/storage\/local-upload\/([0-9a-f-]{36})(?:[/?#]|$)/i,
    );
    if (localMatch && UUID_RE.test(localMatch[1].toLowerCase())) {
      return `/objects/uploads/${localMatch[1].toLowerCase()}`;
    }

    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    if (isLocalStorageMode()) {
      // Sem ACL no disco local: o acesso é sempre intermediado pela API.
      await this.getObjectEntityFile(normalizedPath);
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile as File, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = (await response.json()) as {
    signed_url: string;
  };
  return signedURL;
}
