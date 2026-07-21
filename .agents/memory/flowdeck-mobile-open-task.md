---
name: FlowDeck mobile — opening a specific task from any screen
description: The mobile app has no task route or deep-link param; open a task by rendering the shared TaskEditorSheet in place, fed by useGetTask + useListColumns.
---

# Opening a specific task from a non-project screen (FlowDeck mobile)

Unlike the web app (which has a global floating-task overlay), FlowDeck mobile has
NO task route and NO deep-link param: the project screen opens tasks only via local
state with a full `Task` object. So a feature on another screen (e.g. a mind-map
task node) cannot "navigate" to a task by id through routing.

**Pattern to open a task from any allowed screen without editing the project screen:**
- Keep `openTask: {taskId, projectId} | null` state.
- `useGetTask(openTask?.taskId ?? 0, { enabled: !!openTask, queryKey: getGetTaskQueryKey(...) })` — enabled-gated, placeholder 0 id is safe while disabled.
- `useListColumns(openTask?.projectId ?? 0, { enabled: !!openTask, ... })` for the column selector.
- Derive `canEdit` from `useListWorkspaces()` → `currentUserRole !== 'viewer'` for the workspace.
- Render the shared `@/components/TaskEditorSheet` (mode 'edit', task=query.data, columns, projectId, workspaceId, canEdit) with `visible={!!taskQuery.data}`; it overlays the current screen, so the host screen's state stays mounted (no unsaved-edit loss).

**Why:** avoids touching shared screens/layouts when a task constraint forbids it, and reuses the exact editor the project board uses.

**How to apply:** reuse for any mobile surface that needs to open a task (graph view, notes, search results) until a dedicated task route exists.
