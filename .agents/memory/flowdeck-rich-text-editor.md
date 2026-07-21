---
name: FlowDeck rich-text editor save/close
description: Non-obvious constraints for the Tiptap RichTextEditor (description) and the task-sheet unsaved-changes confirm-on-close flow.
---

# FlowDeck RichTextEditor (description) gotchas

- **Editor reads `initialContent` only at mount.** RichTextEditor is mounted with `key={taskId}`, so it seeds its content once. After saving a description you MUST update the task-detail cache in place, not just invalidate it — otherwise reopening the same task (same key, no remount) shows stale text even though the DB persisted correctly.
  **Why:** invalidate-only refetches in the background but the already-mounted editor never re-seeds from the new data.
  **How to apply:** in the description `onSave`, do `queryClient.setQueryData(getGetTaskQueryKey(taskId), old => old ? {...old, description: html} : old)` BEFORE the normal invalidate/refresh. DB write alone is not enough for the reopen UX.

- **`save()` must reject on failure so callers can react.** The imperative `save()` catches the async onSave error to restore `lastSavedRef`, but it must rethrow. `saveAndClose` awaits `save()` and should only close the sheet on success; on rejection it keeps the sheet+dialog open and shows a destructive toast. Best-effort call sites (unmount cleanup, post-image-insert) must swallow explicitly with `void Promise.resolve(save()).catch(() => {})`.
  **Why:** if `save()` swallows failures silently, a failed PATCH still closes the sheet and the typed description is lost.
  **How to apply:** keep the rethrow in `save()`; catch in interactive close paths; swallow only in fire-and-forget safety nets.

- **No onBlur auto-save.** onBlur auto-save was deliberately removed so an overlay/backdrop click doesn't silently persist before the "Houve alterações nessa tarefa" confirm dialog can appear. The unmount cleanup `save()` remains as a best-effort safety net (covers floating/minimize via `onFloat`, which bypasses the confirm dialog). Editing while the sheet stays open is intentionally deferred until close/confirm.
