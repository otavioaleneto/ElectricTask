---
name: Per-note E2E password lock
description: How FlowDeck note locking works and the cross-note state-leak trap in the reused editor.
---

# Per-note password lock (client-side E2E encryption)

Locked notes are encrypted **in the browser**: PBKDF2-SHA256 -> AES-256-GCM keyed by the
note password. The backend only stores ciphertext + an `isLocked` flag; it never sees the
password or plaintext. Package format is `flowlock:v1:saltB64:ivB64:cipherB64`.
Consequences: a forgotten password is unrecoverable, and locked notes carry no `[[links]]`
(ciphertext has no tokens, so link refresh naturally clears them).

**Cross-note state-leak trap (the important lesson).**
The note editor is one route component reused across `/notes/:id`. Keeping decrypted
plaintext / the entered password / open protect-or-remove dialogs in component state means
navigating from an unlocked note A to a locked note B can (a) bypass B's unlock gate and
show A's plaintext, and (b) save A's content under B's id, destroying B's ciphertext.
Resetting state in a `useEffect` is NOT enough — it runs after paint, and Radix
AlertDialogs are uncontrolled, so a stale frame/dialog can still act on the wrong note.

**Rule:** for any editor that holds decrypted/secret per-entity state, force a full remount
on entity change by keying the inner component (`<Inner key={id} id={id} />`). A fresh
instance shares no state, refs, in-flight async, or uncontrolled dialog state with the
previous entity. Seed initial state in `useLayoutEffect` (pre-paint) so a locked entity is
gated on the first frame, and add id-guards (`if (loadedIdRef.current !== targetId) return`)
in async/mutation callbacks as defense-in-depth.

**Why:** decrypted plaintext and passwords are the exact thing this feature must not leak;
a one-frame stale render or a carried-over dialog is a real data-exposure / data-loss bug,
not just a cosmetic glitch.
