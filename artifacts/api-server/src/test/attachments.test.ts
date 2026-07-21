import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, taskAttachmentsTable } from "@workspace/db";
import {
  cleanup,
  closePool,
  createUser,
  createWorkspaceWithTask,
  login,
  startServer,
  stopServer,
  type RunningServer,
} from "./helpers";

let running: RunningServer;

before(async () => {
  running = await startServer();
});

after(async () => {
  await cleanup();
  await stopServer(running);
  await closePool();
});

interface AttachmentPayload {
  id: number;
  taskId: number;
  name: string;
  contentType: string;
  size: number;
  uploaderName: string | null;
  createdAt: string;
}

// A minimal but valid 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function rowsForTask(taskId: number) {
  return db
    .select()
    .from(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.taskId, taskId));
}

// Mirrors the client upload flow: request a presigned URL, PUT the bytes,
// then register the attachment against the task.
async function uploadAttachment(
  baseUrl: string,
  cookie: string,
  taskId: number,
  opts: { name: string; contentType: string; bytes: Buffer },
): Promise<{ status: number; body: AttachmentPayload }> {
  const reqRes = await fetch(`${baseUrl}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      name: opts.name,
      size: opts.bytes.length,
      contentType: opts.contentType,
    }),
  });
  assert.equal(reqRes.status, 200, "request-url should succeed");
  const { uploadURL, objectPath } = (await reqRes.json()) as {
    uploadURL: string;
    objectPath: string;
  };

  // No navegador a URL relativa (modo disco local) resolve contra a origem;
  // no fetch do Node é preciso torná-la absoluta.
  const absoluteUploadURL = uploadURL.startsWith("/")
    ? `${baseUrl}${uploadURL}`
    : uploadURL;
  const putRes = await fetch(absoluteUploadURL, {
    method: "PUT",
    body: opts.bytes,
    headers: { "Content-Type": opts.contentType },
  });
  assert.ok(putRes.ok, `direct upload PUT should succeed (got ${putRes.status})`);

  const registerRes = await fetch(`${baseUrl}/api/tasks/${taskId}/attachments`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      name: opts.name,
      contentType: opts.contentType,
      size: opts.bytes.length,
      objectPath,
    }),
  });
  return {
    status: registerRes.status,
    body: (await registerRes.json()) as AttachmentPayload,
  };
}

describe("inline image attachment registration", () => {
  it("registers exactly one attachment and captures the uploader id", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const { status, body } = await uploadAttachment(
      running.baseUrl,
      cookie,
      task.id,
      { name: "inline.png", contentType: "image/png", bytes: PNG_BYTES },
    );

    assert.equal(status, 201, "register should return 201");
    assert.equal(body.name, "inline.png");
    assert.equal(body.contentType, "image/png");

    const rows = await rowsForTask(task.id);
    assert.equal(rows.length, 1, "exactly one attachment row (no duplicate)");
    assert.equal(
      rows[0].uploadedBy,
      owner.id,
      "registered attachment captures the uploader id",
    );
    assert.equal(rows[0].size, PNG_BYTES.length);
  });

  it("does not create duplicate rows when an inline image is inserted once", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    // The editor inserts one image -> one upload -> one register call.
    const { status } = await uploadAttachment(running.baseUrl, cookie, task.id, {
      name: "single.png",
      contentType: "image/png",
      bytes: PNG_BYTES,
    });
    assert.equal(status, 201);

    const rows = await rowsForTask(task.id);
    assert.equal(rows.length, 1, "one insert must yield exactly one attachment");
  });

  it("list endpoint returns uploaderName and createdAt for each attachment", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const { status } = await uploadAttachment(running.baseUrl, cookie, task.id, {
      name: "listed.png",
      contentType: "image/png",
      bytes: PNG_BYTES,
    });
    assert.equal(status, 201);

    const listRes = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/attachments`,
      { headers: { cookie } },
    );
    assert.equal(listRes.status, 200);
    const list = (await listRes.json()) as AttachmentPayload[];

    assert.equal(list.length, 1, "exactly one attachment is listed");
    const [entry] = list;
    assert.equal(
      entry.uploaderName,
      "Test User",
      "list returns the uploader's name (joined from users)",
    );
    assert.ok(entry.createdAt, "list returns a createdAt timestamp");
    assert.ok(
      !Number.isNaN(new Date(entry.createdAt).getTime()),
      "createdAt is a valid ISO timestamp",
    );
  });

  it("a single registered attachment is visible to both the inline list and gallery (same list endpoint)", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const { body } = await uploadAttachment(running.baseUrl, cookie, task.id, {
      name: "shared.png",
      contentType: "image/png",
      bytes: PNG_BYTES,
    });

    // The inline Anexos list and the Anexos gallery tab both read this same
    // endpoint/query key, so one entry here means it shows in both places.
    const listRes = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/attachments`,
      { headers: { cookie } },
    );
    const list = (await listRes.json()) as AttachmentPayload[];
    assert.equal(list.length, 1);
    assert.equal(list[0].id, body.id, "the same attachment is returned");
  });
});
