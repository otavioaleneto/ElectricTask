---
name: FlowDeck attachment serving security
description: Hard rules for serving user-uploaded files and trusting upload metadata in the object-storage attachment flow.
---

# Serving user-uploaded files (object storage attachments)

Two non-obvious rules surfaced while building task attachments. Both are easy to
get wrong because curl tests pass while a browser is still exploitable.

## 1. Never serve untrusted uploads `inline` from the app origin
Streaming a stored attachment with `Content-Disposition: inline` and the
user-supplied `Content-Type` lets an uploader register HTML/SVG and have it
rendered same-origin under `/api/...` → stored XSS against any workspace viewer.

**Rule:** default disposition to `attachment`; only serve `inline` for a strict
raster-image allowlist (`image/png`, `image/jpeg`, `image/gif`, `image/webp`),
and always set `X-Content-Type-Options: nosniff`. `<img>` thumbnails still render
for allowlisted types; everything else downloads. A `?download=1` query forces
`attachment` even for images.

**Why:** the file endpoint is same-origin via the proxy, so anything rendered
inline runs in the app's origin. SVG/HTML are the dangerous types.

## 2. Never trust client-supplied file size (or that the object exists)
The two-step upload (request presigned URL → browser PUTs to GCS → register)
means the register call's `size` is attacker-controlled. A caller can PUT a huge
object and register it with `size: 1`.

**Rule:** on register, call `getObjectEntityFile(objectPath)` (throws
`ObjectNotFoundError` if missing) then `file.getMetadata()` and use the real
`metadata.size` as authoritative — validate the limit against it and persist it,
not the request body's size.

**Why:** size limits and "file actually uploaded" cannot be enforced at the
presigned-PUT step; register time is the only trustworthy checkpoint.

## Known gap (left as follow-up)
Deleting an attachment removes only the DB row, not the GCS object; abandoned
uploads also orphan objects. No cleanup job exists yet.
