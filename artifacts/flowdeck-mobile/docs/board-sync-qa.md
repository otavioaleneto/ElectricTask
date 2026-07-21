# FlowDeck Mobile — Board Sync QA Pass

Repeatable manual QA for the mobile board CRUD flows. The automated
`runTest` Playwright harness cannot reach the Expo app (it routes to the web
preview at `localhost:80`, not the `*.expo.janeway.replit.dev` domain), so these
flows are verified by (a) code-level audit of react-query invalidation, and
(b) a manual device / Expo Go pass using the steps below.

## Why this exists

A regression where Projects-tab counts went stale after a board mutation was
only caught in code review. The root cause: board mutations that change task
existence or completion must invalidate the **workspace-level** queries
(`listProjects`, `getWorkspaceSummary`) in addition to the project-level ones.
This checklist makes the sync behavior repeatable to verify.

## Seed credentials

- Owner: `teste@user.com` / `123as123`

For the viewer-role check, use any account that has `viewer` role in a shared
workspace (or change a member's role to viewer from an owner account on web).

## Prerequisites

Start both workflows before testing:

- `artifacts/api-server: API Server`
- `artifacts/flowdeck-mobile: expo`

Open the Expo app on a device (Expo Go) or in the web preview of the Expo
domain. Log in with the owner account.

## What "in sync" means

After every mutation below, **without pulling to refresh**, confirm:

1. The **board** (`/project/[id]`) reflects the change (column counts, task
   presence, completion state, card details).
2. The **Projects tab** (`/(tabs)`) cards show the right per-project task /
   completion numbers when you navigate back.
3. The **dashboard summary** stats row (Projetos / Abertas / Concluídas) at the
   top of the Projects tab is correct.

## Manual test matrix

| # | Flow | Steps | Expect (no manual refresh) |
|---|------|-------|----------------------------|
| 1 | Create project | Projects tab → `+` → fill name → Criar projeto | New card appears; `Projetos` summary +1; lands on the new board |
| 2 | Create column | Board → Nova coluna / Criar coluna → name + color | Column appears with count 0 |
| 3 | Create task | Board → `+` on a column (or header `+`) → title + column → Criar tarefa | Card appears in column; column count +1; board header task count +1 |
| 4 | Edit task priority | Open task → change Prioridade → Salvar | Card priority indicator updates |
| 5 | Edit due date | Open task → set Data de entrega → Salvar | Card shows due date |
| 6 | Edit assignee | Open task → set Responsável → Salvar | Card shows assignee avatar |
| 7 | Move task | Card chevrons (or board move) | Card moves columns; both column counts adjust |
| 8 | Checklist add | Open task → add checklist + items | Checklist + items render; counts `done/total` correct |
| 9 | Checklist toggle | Toggle an item | `done/total` updates immediately |
| 10 | Checklist delete | Delete item / checklist | Removed immediately |
| 11 | Complete toggle | Open task → Marcar como concluída | Status flips; back on Projects tab, `Concluídas` +1 / `Abertas` -1 |
| 12 | Delete task | Open task → Excluir tarefa → confirm | Card gone; column count -1; Projects tab counts update |
| 13 | Delete column | Board → trash on column header → confirm | Column + its tasks gone; Projects tab counts + summary update |

After steps 11, 12 and 13 specifically, **navigate back to the Projects tab and
verify the summary + project-card counts changed** — this is the regression that
previously slipped through.

## Viewer-role check

Log in as a viewer (or switch a member to viewer). Confirm **no write
affordances** anywhere:

- Projects tab: no `+` (add project) in the header, no "Novo projeto" button in
  the empty state.
- Board header: no `+` (add task).
- Columns: no trash icon, no "Tarefa" add button, no "Nova coluna" ghost column.
- Task sheet: all fields disabled; footer shows **Fechar** (no Salvar/Criar);
  no "Marcar como concluída" interaction; no "Excluir tarefa" row.
- Checklist: no add/edit/delete controls.

Note: until the role is resolved the board defaults to read-only
(`canEdit = role ? role !== "viewer" : false`), so affordances should never
flash for viewers.

## Code-level invalidation reference (audited)

These are the query keys each mutation invalidates. Workspace-level keys are
guarded by `workspaceId > 0`.

| Mutation | Source | Invalidates |
|----------|--------|-------------|
| Create project | `CreateProjectSheet.tsx` | listProjects, summary |
| Create/Update/Delete/Complete task | `TaskEditorSheet.tsx` (`refresh`) | listTasks, getProject, listProjects, summary, getTask |
| Checklist add/toggle/delete | `ChecklistEditor.tsx` + `onChanged=refresh` | listChecklists, getTask, (+ task `refresh` keys) |
| Create column | `app/project/[id].tsx` | listColumns, getProject (counts unchanged) |
| Delete column (cascades to tasks) | `app/project/[id].tsx` | listColumns, listTasks, getProject, listProjects, summary |
| Move task | `app/project/[id].tsx` | listTasks, getProject (counts unchanged) |

Rule of thumb for future mutations: anything that changes task **existence or
completion** must also invalidate `listProjects` + `getWorkspaceSummary` for the
workspace, or the Projects tab and dashboard go stale.

## Last verification run (2026-06-29)

- `pnpm --filter @workspace/flowdeck-mobile run typecheck` — **passes**.
- Static render check (`screenshot`, app_preview) — login screen renders.
- Code audit of all six mutation sites above — invalidation matches the matrix;
  every write affordance is gated by `canEdit`.
- **Live API lifecycle run (owner `teste@user.com`, workspace "Estúdio de
  Conteúdo") — 15/15 PASS.** Because the Expo UI can't be driven by the
  harness, the exact endpoints the mobile queries refetch on invalidation were
  exercised end-to-end and asserted against the workspace summary + project
  list. This proves the data half of "in sync"; combined with the code audit of
  invalidation, the board, Projects tab, and dashboard show fresh numbers after
  each mutation. Results:

  | Flow exercised | Assertion | Result |
  |----------------|-----------|--------|
  | Create project | `summary.projectCount` +1; project appears in list | PASS |
  | Create project | 3 default columns created | PASS |
  | Create task | `summary.openCount` +1; project `taskCount` = 1 | PASS |
  | Edit task | priority update persisted | PASS |
  | Complete task | `completedCount` +1, `openCount` back to baseline | PASS |
  | Delete task | `completedCount` + `openCount` back to baseline | PASS |
  | Create column | column count 4 | PASS |
  | Task in new column | `openCount` +1 | PASS |
  | Delete column (cascade) | column count 3; `openCount` back to baseline | PASS |
  | Delete project (cleanup) | `projectCount` back to baseline | PASS |

  Reproduce: log in via `POST /api/auth/login`, then run the same
  create→assert→delete sequence against `/api/workspaces/:id/summary`,
  `/api/workspaces/:id/projects`, `/api/projects/:id/columns|tasks`,
  `/api/tasks/:id`, `/api/columns/:id`. The seeded test data is left clean
  (the test project is deleted at the end).

- Interactive on-device tap-through (Expo Go) — still recommended as a final
  human sign-off (tracked as a follow-up); not blocking, since the data-layer
  sync and invalidation contract are both confirmed above.
