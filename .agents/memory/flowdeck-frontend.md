---
name: FlowDeck frontend conventions
description: Routing, role gating, API client usage, and drag patterns for the FlowDeck web app (artifacts/flowdeck).
---

# FlowDeck frontend

## Routing (wouter)
- `Route` does NOT support a `render` prop — use children: `<Route path="/x"><Comp/></Route>`. The `render` prop typechecks as an error.
- Router base is `import.meta.env.BASE_URL` (artifact path prefix). Keep it.

## Auth + role gating
- `Shell` and `ProtectedRoute` must redirect via `useEffect`, never `setLocation()` during render (causes "setState while rendering" warnings).
- Role gating lives in `ProtectedRoute` (App.tsx): admins are pushed to `/admin`, non-admins away from `/admin`. Backend also enforces 403 on admin APIs — UI gating is UX only.

## API client (orval-generated, @workspace/api-client-react)
- Mutation variables follow a `{<entity>Id, data}` convention (creates that scope to a parent use the parent id, e.g. `{workspaceId, data}`); read the generated hook signature rather than guessing.
- Always pass `query: { enabled, queryKey: getXQueryKey(...) }` to query hooks and invalidate the matching key after mutations. Admin user mutations must invalidate BOTH the users list and the admin stats keys, or the stats cards go stale.

## Patterns chosen (dependency-light, no extra libs)
- Kanban drag = native HTML5 draggable + dataTransfer/state; mindmap node drag = pointer events with an offset ref and canvas getBoundingClientRect.
- Two coexisting Kanban drags (task move + column reorder) use separate state flags (draggedTask vs draggedCol). The task drop zone must early-return when a column drag is active, or you get cross-highlighting/false drops. Column reorder persists by writing each changed column's `position` via N updateColumn mutations (no bulk endpoint yet).
- Cover images = URL string or FileReader data-URL (no object storage), stored in `coverImageUrl`.

**Why:** keeps bundle small and avoids dnd-kit/react-flow deps the project didn't ask for.

## Project edit/delete (project.tsx)
- `useUpdateProject` body is `ProjectUpdate` (name/platform/accentColor/coverImageUrl/description, all optional; coverImageUrl nullable — send `null` to clear). After mutating, invalidate getGetProjectQueryKey(id) + getListProjectsQueryKey(workspaceId) + getGetWorkspaceSummaryQueryKey(workspaceId).
- Delete redirects to "/" via wouter `useLocation` setter after invalidating list+summary keys.

## Gotcha: multi-step mutation flows
- "Create mindmap then link to task" is two mutations. Guard with a `linking` state flag (disable button across BOTH) + onError resets, or you get duplicate/orphan mindmaps on double-click.

## Gotcha: orval codegen wipes generated/ mid-session
- `pnpm --filter @workspace/api-spec run codegen` cleans then rewrites `lib/api-client-react/src/generated/`. While it runs, vite (web) and metro (mobile) log transient "cannot resolve ./generated/api" / "Failed to reload" errors. These are stale — restart the affected workflow and they clear. Do not chase them as real bugs.

## Per-user project view tracking
- Last-access uses per-user `project_views` (userId+projectId unique) upserted from `project.tsx` on mount via `useRecordProjectView({projectId})`. After it succeeds, invalidate the projects-list queries (predicate on key `/^\/api\/workspaces\/\d+\/projects$/`) so the dashboard "Último acesso" counter updates without a manual refetch.
- `lastViewedAt` is ALWAYS scoped by `req.user.id` server-side — never global per project — so two users see different counters for the same project.
