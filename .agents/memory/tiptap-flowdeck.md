---
name: Tiptap rich-text in FlowDeck web
description: Version quirks and conventions for the Tiptap editor used in the FlowDeck task description field
---

# Tiptap in FlowDeck web (artifacts/flowdeck)

- StarterKit v3 already bundles bold, italic, **underline**, and bullet/ordered lists.
  Do NOT add `@tiptap/extension-underline` (or bold/italic/list extensions) on top —
  it throws a duplicate-extension registration error at runtime.
  **Why:** wasted a step adding then removing extension-underline.
  **How to apply:** for color use `@tiptap/extension-text-style` + `@tiptap/extension-color`;
  for images `@tiptap/extension-image`. Disable unwanted StarterKit nodes via `.configure({ heading:false, ... })`.

- Descriptions are stored as sanitized HTML, not plain text. Always run content through
  `src/lib/sanitize.ts` (DOMPurify allowlist) on BOTH load and save. Image `src` is
  restricted to the attachment file route `^/api/attachments/\d+/file`; inline `style` is
  reduced to `color` only. Adding new formatting => update the allowlist or it gets stripped.

- Editor save lifecycle (`src/components/rich-text-editor.tsx`): saves on blur + on unmount,
  deduped against a baseline ref. The baseline is reverted if the save mutation rejects, so a
  failed PATCH retries on the next blur/unmount instead of being silently lost.
  **How to apply:** the `onSave` prop must return the mutation promise (use `mutateAsync`) for
  this retry-on-failure to work; a fire-and-forget `.mutate` defeats it.

- `dompurify` v3 ships its own TypeScript types; the separate `@types/dompurify` is deprecated
  and redundant — don't reinstall it.

- Pre-existing flowdeck typecheck errors live only in `src/components/ui/calendar.tsx` and
  `src/components/ui/spinner.tsx` (duplicate `@types/react` copies). Unrelated to feature work;
  treat as known-noise when reading typecheck output.

- Testing Tiptap/ProseMirror in jsdom (vitest): a real DOM `drop` event makes ProseMirror call
  `posAtCoords` -> needs `document.elementFromPoint` + `document.caretRangeFromPoint` +
  `Range.getClientRects/getBoundingClientRect`, none of which jsdom implements. If `posAtCoords`
  returns null, ProseMirror's `handleDrop` bails BEFORE your `editorProps.handleDrop` runs, so the
  upload never fires. Also the mock `dataTransfer` must expose `getData` (ProseMirror reads it
  before your handler). Polyfills live in `src/test/setup.ts`. The toolbar/file-input path needs
  none of this — prefer it as the primary upload test; drag-drop is the fragile one.
  **How to apply:** flowdeck uses vitest (`pnpm --filter @workspace/flowdeck test`); it is NOT in
  the `.replit` validation workflow (which only runs api-server `node:test`). Test files are
  `*.test.tsx` and are excluded from `tsconfig.json`.
