import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, taskVideoLinksTable } from "@workspace/db";
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

interface VideoLinkPayload {
  id: number;
  taskId: number;
  url: string;
  position: number;
}

async function linksForTask(taskId: number) {
  return db
    .select()
    .from(taskVideoLinksTable)
    .where(eq(taskVideoLinksTable.taskId, taskId));
}

describe("video link URL validation", () => {
  it("accepts a valid http(s) URL", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const res = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/video-links`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://youtube.com/watch?v=abc" }),
      },
    );
    assert.equal(res.status, 201);
    const created = (await res.json()) as VideoLinkPayload;
    assert.equal(created.url, "https://youtube.com/watch?v=abc");

    const stored = await linksForTask(task.id);
    assert.equal(stored.length, 1);
  });

  it("rejects a non-http(s) (javascript:) URL on create and does not store it", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const res = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/video-links`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "javascript:alert(1)" }),
      },
    );
    assert.equal(res.status, 400);

    const stored = await linksForTask(task.id);
    assert.equal(stored.length, 0, "bad URL must not be stored");
  });

  it("rejects a non-http(s) URL on update and leaves the stored URL unchanged", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const created = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/video-links`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/clip" }),
      },
    ).then((r) => r.json() as Promise<VideoLinkPayload>);

    const res = await fetch(
      `${running.baseUrl}/api/video-links/${created.id}`,
      {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "javascript:alert(1)" }),
      },
    );
    assert.equal(res.status, 400);

    const [stored] = await linksForTask(task.id);
    assert.equal(
      stored.url,
      "https://example.com/clip",
      "stored URL must be unchanged after a rejected update",
    );
  });
});

describe("video link workspace isolation", () => {
  it("a user from another workspace cannot read or write another task's video links", async () => {
    const owner = await createUser();
    const ownerCookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const created = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/video-links`,
      {
        method: "POST",
        headers: { cookie: ownerCookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/owner" }),
      },
    ).then((r) => r.json() as Promise<VideoLinkPayload>);

    const outsider = await createUser();
    const outsiderCookie = await login(running.baseUrl, outsider.email);
    await createWorkspaceWithTask(outsider.id);

    const list = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/video-links`,
      { headers: { cookie: outsiderCookie } },
    );
    assert.equal(list.status, 404, "outsider cannot list video links");

    const create = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/video-links`,
      {
        method: "POST",
        headers: { cookie: outsiderCookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/intruder" }),
      },
    );
    assert.equal(create.status, 404, "outsider cannot create a video link");

    const patch = await fetch(
      `${running.baseUrl}/api/video-links/${created.id}`,
      {
        method: "PATCH",
        headers: { cookie: outsiderCookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/hijack" }),
      },
    );
    assert.equal(patch.status, 404, "outsider cannot update the video link");

    const del = await fetch(
      `${running.baseUrl}/api/video-links/${created.id}`,
      { method: "DELETE", headers: { cookie: outsiderCookie } },
    );
    assert.equal(del.status, 404, "outsider cannot delete the video link");

    const stored = await linksForTask(task.id);
    assert.equal(stored.length, 1, "owner's link remains intact and untouched");
    assert.equal(stored[0].url, "https://example.com/owner");
  });
});
