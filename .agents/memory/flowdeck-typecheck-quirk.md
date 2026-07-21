---
name: FlowDeck typecheck pre-existing errors
description: Why `pnpm run typecheck` fails on flowdeck calendar.tsx/spinner.tsx regardless of your changes
---

# FlowDeck typecheck: pre-existing calendar.tsx / spinner.tsx errors

`pnpm run typecheck` (and `pnpm --filter @workspace/flowdeck run typecheck`)
fails with TS2322 errors in `artifacts/flowdeck/src/components/ui/calendar.tsx`
and `artifacts/flowdeck/src/components/ui/spinner.tsx`. Messages mention
"Two different types with this name exist, but they are unrelated" and a missing
`` `--radix-${string}` `` index signature.

**Why:** Duplicate `@types/react` (v18 vs v19) resolved through pnpm hoisting —
a dependency/environment issue in these shadcn-generated UI components, NOT
caused by feature code. The Vite dev server does not typecheck, so the app
runs fine despite these.

**How to apply:** Treat this whole React19 duplicate-`@types/react` class as
pre-existing baseline noise. The exact files are NOT fixed — it surfaces in
whatever components consume react-icons / recharts / shadcn UI (seen in
`ui/calendar.tsx`, `ui/spinner.tsx`, `ui/chart.tsx`, `ui/input-otp.tsx`,
`pages/dashboard.tsx`). Symptoms: `IconBaseProps` mismatch, recharts
`X cannot be used as a JSX component`, missing `--radix-${string}` index sig.
When validating your own work, confirm your CHANGED files do not appear in the
tsc output rather than expecting a fully clean `typecheck`. Don't try to "fix"
them as part of unrelated feature work.

**react-icons workaround (fixable in your own code):** rendering a react-icons
component typed as its `IconType` in JSX triggers the TS2322 `IconBaseProps`
mismatch. This one IS avoidable — do NOT import `IconType`. Instead type the
icon as your own minimal `ComponentType<{ className?: string }>` and cast the
dynamically imported module (`import("react-icons/fa6") as unknown as
Record<string, ComponentType<{className?:string}>>`). JSX then uses your prop
type, sidestepping the duplicate-React JSX namespace entirely.
