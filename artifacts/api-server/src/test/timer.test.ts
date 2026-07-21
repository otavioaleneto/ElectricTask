import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq, isNull } from "drizzle-orm";
import { db, timeEntriesTable, activityLogTable, tasksTable } from "@workspace/db";
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

async function openEntries(taskId: number, userId: number) {
  return db
    .select()
    .from(timeEntriesTable)
    .where(
      and(
        eq(timeEntriesTable.taskId, taskId),
        eq(timeEntriesTable.userId, userId),
        isNull(timeEntriesTable.endedAt),
      ),
    );
}

async function actions(taskId: number) {
  const rows = await db
    .select({ action: activityLogTable.action })
    .from(activityLogTable)
    .where(eq(activityLogTable.taskId, taskId));
  return rows.map((r) => r.action);
}

describe("timer double-count guard", () => {
  it("starting twice keeps a single running entry and does not double-count elapsed time", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    const first = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer/start`,
      { method: "POST", headers: { cookie } },
    );
    assert.equal(first.status, 200);

    // Backdate the single running session by 100s so elapsed time is meaningful.
    const backdated = new Date(Date.now() - 100_000);
    await db
      .update(timeEntriesTable)
      .set({ startedAt: backdated })
      .where(
        and(
          eq(timeEntriesTable.taskId, task.id),
          eq(timeEntriesTable.userId, owner.id),
          isNull(timeEntriesTable.endedAt),
        ),
      );

    // A second start must be idempotent: no new running row.
    const second = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer/start`,
      { method: "POST", headers: { cookie } },
    );
    assert.equal(second.status, 200);

    const rows = await openEntries(task.id, owner.id);
    assert.equal(rows.length, 1, "exactly one running entry should exist");

    const state = (await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer`,
      { headers: { cookie } },
    ).then((r) => r.json())) as { running: boolean; totalSeconds: number };
    assert.equal(state.running, true);
    // ~100s for one session, NOT ~200s (which would mean double counting).
    assert.ok(
      state.totalSeconds >= 95 && state.totalSeconds <= 130,
      `totalSeconds should reflect a single ~100s session, got ${state.totalSeconds}`,
    );
  });
});

describe("timer stop semantics", () => {
  it("'Finalizar' (finished:true) completes the task and logs timer_finished + completed", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    await fetch(`${running.baseUrl}/api/tasks/${task.id}/timer/start`, {
      method: "POST",
      headers: { cookie },
    });
    const stop = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer/stop`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ finished: true }),
      },
    );
    assert.equal(stop.status, 200);

    const [row] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, task.id));
    assert.equal(row.completed, true, "task should be marked completed");

    const logged = await actions(task.id);
    assert.ok(logged.includes("timer_finished"), "logs timer_finished");
    assert.ok(logged.includes("completed"), "logs completed");

    const open = await openEntries(task.id, owner.id);
    assert.equal(open.length, 0, "no running entry remains after stop");
  });

  it("'Apenas pausar' (finished:false) stops without completing the task", async () => {
    const owner = await createUser();
    const cookie = await login(running.baseUrl, owner.email);
    const { task } = await createWorkspaceWithTask(owner.id);

    await fetch(`${running.baseUrl}/api/tasks/${task.id}/timer/start`, {
      method: "POST",
      headers: { cookie },
    });
    const stop = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer/stop`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ finished: false }),
      },
    );
    assert.equal(stop.status, 200);

    const [row] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, task.id));
    assert.equal(row.completed, false, "task should NOT be completed");

    const logged = await actions(task.id);
    assert.ok(logged.includes("timer_paused"), "logs timer_paused");
    assert.ok(!logged.includes("completed"), "does NOT log completed");
  });
});

describe("timer workspace isolation", () => {
  it("a user from another workspace cannot read or write another task's timer", async () => {
    const owner = await createUser();
    const { task } = await createWorkspaceWithTask(owner.id);

    const outsider = await createUser();
    const outsiderCookie = await login(running.baseUrl, outsider.email);
    // Give the outsider their own (unrelated) workspace to be realistic.
    await createWorkspaceWithTask(outsider.id);

    const read = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer`,
      { headers: { cookie: outsiderCookie } },
    );
    assert.equal(read.status, 404, "outsider cannot read the timer");

    const start = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer/start`,
      { method: "POST", headers: { cookie: outsiderCookie } },
    );
    assert.equal(start.status, 404, "outsider cannot start the timer");

    const stop = await fetch(
      `${running.baseUrl}/api/tasks/${task.id}/timer/stop`,
      {
        method: "POST",
        headers: { cookie: outsiderCookie, "content-type": "application/json" },
        body: JSON.stringify({ finished: false }),
      },
    );
    assert.equal(stop.status, 404, "outsider cannot stop the timer");

    // Nothing should have been recorded against the owner's task.
    const open = await openEntries(task.id, outsider.id);
    assert.equal(open.length, 0, "no entry created for the outsider");
  });
});
