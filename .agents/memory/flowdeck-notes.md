---
name: FlowDeck notes content storage & lock crypto interop
description: How note content is stored across web/mobile and how the per-note password lock stays interoperable.
---

# FlowDeck notes: content storage & lock crypto

- **Note content is PLAIN TEXT end-to-end** (web and mobile). The API stores the raw `content` string and computes the list excerpt and the `[[wiki-link]]` outgoing/backlink graph server-side by regex over that raw content. Any client (web, mobile, future) must send/store plain text — never HTML or a rich-text JSON blob — or the server-side excerpt/link extraction breaks.
  **Why:** the link graph + excerpt are derived server-side from the raw `content` string.
  **How to apply:** when adding a note client/editor, persist plain text; do not introduce a rich-text serialization on the content field.

- **A locked note stores its `flowlock:v1:<saltB64>:<ivB64>:<cipherB64>` payload AS the `content` field** with `isLocked=true`. While locked the server sees only ciphertext, so `[[links]]` inside a locked note are NOT indexed. Web shows a hint that links are unavailable while protected; mobile mirrors this (autocomplete still renders for parity, but those links won't appear in panels until the note is unlocked and its lock removed).

- **Lock crypto format (must match byte-for-byte for web<->mobile interop):** PBKDF2-SHA256, 200000 iterations, 16-byte salt, 12-byte IV, AES-256-GCM; password as UTF-8 bytes; standard base64. Web uses WebCrypto (`crypto.subtle`). Hermes (RN) has NO `btoa/atob/TextEncoder/TextDecoder/crypto.subtle`, so `artifacts/flowdeck-mobile/lib/note-lock.ts` reimplements base64 + UTF-8 codecs and uses `@noble/hashes` (pbkdf2/sha256) + `@noble/ciphers` (gcm) + `expo-crypto` for randomness. Bidirectional decrypt verified in Node against WebCrypto.
  **Why:** the two platforms expose different crypto primitives; only a shared wire format guarantees a note locked on one opens on the other.
  **How to apply:** never change one side's KDF/cipher/format params without the other. The `@noble/hashes/crypto.js` Metro WARN is a harmless lazy probe (expo-crypto supplies randomness).

- **Note editor save race (data loss): a same-note refetch can clobber a concurrent in-flight-save edit.** Both editors seed per-note state at mount and, on a same-note refetch, re-seed title/content only when `!dirty`. If the user edits DURING an in-flight save, the save's `onSuccess` clears `dirty`, then the post-save refetch re-seeds and overwrites the newer edit (plain notes). The mobile editor (`app/note/[id].tsx`) guards this with an `editGenRef` bumped on every edit and captured at save start; `onSuccess` clears `dirty` only if the generation is unchanged, so a concurrent edit stays dirty and is neither marked clean nor clobbered. The WEB editor (`src/pages/note-editor.tsx`) still has the unguarded behavior.
  **Why:** architect-flagged; refetch timing after save silently loses edits typed within the save window.
  **How to apply:** if hardening the web editor or adding another note client, apply the same edit-generation guard; keep the guard when refactoring the mobile save flows.
