---
name: Mockup sandbox gotchas
description: Type/build quirks when authoring canvas mockups in artifacts/mockup-sandbox
---

- lucide-react icon components do NOT accept a `title` prop. Passing `title` to an
  icon (e.g. `<AlignLeft title="..." />`) compiles under vite/esbuild and renders
  fine, but `pnpm --filter @workspace/mockup-sandbox run typecheck` fails (TS2322).
  **Why:** vite/esbuild strips types and never fails on this, so a screenshot looks
  correct while typecheck is red — a review cycle was lost to it.
  **How to apply:** for an icon tooltip, wrap the icon in `<span title="...">`
  (HTML elements accept `title`); put `title`/`aria-label` on the wrapper, never on
  the lucide component.

- The sandbox shadcn scaffold (`src/components/ui/calendar.tsx`, `spinner.tsx`) has
  PRE-EXISTING React 19 type-version errors unrelated to mockups; a board-usability
  typecheck still surfaces them. Don't chase them when only mockup files changed.
