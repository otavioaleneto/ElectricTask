---
name: FlowDeck password recovery security invariants
description: Non-obvious security rules the public security-question recovery flow must keep.
---

FlowDeck recovery = 3 security questions, NO email (public endpoints `/auth/recovery/questions` and `/auth/recovery/reset`). Answers are stored salted-hashed (same scheme as passwords) and normalized before hashing: trim + `toLocaleLowerCase("pt-BR")` + collapse whitespace — **accents are KEPT**. The same normalization must be used at register/update time AND at verify time or answers will never match.

**Rule 1 — never short-circuit answer checks.** Verify all three answer hashes unconditionally (compute match1/match2/match3, then `match1 && match2 && match3`). Using `&&` inline across expensive scrypt calls leaks per-answer correctness via response timing, downgrading the attack from "guess all 3 at once" to sequential probing.

**Rule 2 — the reset endpoint must stay rate-limited.** Low-entropy answers on a public reset endpoint are brute-forceable. There is an in-memory limiter (`lib/rateLimit.ts`): 5 failures per 15-min window → 15-min lockout, keyed by BOTH `recovery-reset:email:<email>` and `recovery-reset:ip:<ip>`. Lock is checked BEFORE verifying answers, so a locked account rejects even correct answers (429 + Retry-After). Cleared on success. `/auth/recovery/questions` is throttled per-IP but only counts 404 failures, so legit lookups aren't penalized.

**Why in-memory (not DB/Redis):** single-instance app, no Redis; `trust proxy` is NOT set so `req.ip` may be the proxy IP — that's why the email key is the primary defense and IP is secondary.
