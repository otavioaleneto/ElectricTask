---
name: Mobile (Expo) react-query invalidation after board mutations
description: Which query keys must be invalidated after task/column mutations so the Projects tab and dashboard summary don't go stale.
---

In the FlowDeck mobile app, board mutations that change task counts or completion must invalidate the **workspace-level** queries in addition to the project-level ones, or the Projects tab cards and workspace summary show stale numbers after the user navigates back.

**Rule:** after task create/update/delete/complete (TaskEditorSheet) and after column delete (which cascades to tasks), invalidate, guarded by `workspaceId > 0`:
- `getListProjectsQueryKey(workspaceId)`
- `getGetWorkspaceSummaryQueryKey(workspaceId)`
in addition to `getListTasksQueryKey(projectId)` + `getGetProjectQueryKey(projectId)`.

**Why:** project cards display per-project task/completion counts and the dashboard summary aggregates them; these come from the workspace projects + summary endpoints, not the project/tasks endpoints.

**How to apply:** mirror this whenever adding a new mobile mutation that changes task existence/completion. `task move` only needs tasks + project keys (counts unchanged).
