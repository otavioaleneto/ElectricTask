---
name: Cross-dialect claim/CAS updates
description: updateReturning is NOT atomic on MySQL; use updateCount for claim patterns
---

**Rule:** For atomic claim / compare-and-set writes (e.g. "claim this row only if still due/active"), never use `updateReturning` — use `updateCount` from `lib/db` helpers, which issues a single conditional UPDATE on both dialects and returns affected rows.

**Why:** On MySQL, `updateReturning` is implemented as select-ids → update-by-ids, so the WHERE condition is dropped at write time; two concurrent transactions can both "claim" the same row (found during the recurring-tasks generator review). On PG it's atomic, which hides the bug in dev.

**How to apply:** Any scheduler/sweep/queue-style code that must guarantee single-winner semantics should do `const n = await updateCount(tx, table, set, cond); if (n === 0) return;` inside a transaction, then perform the dependent writes.
