---
name: Rich text on FlowDeck mobile
description: How rich task descriptions + attachments are implemented in the Expo app, and the deliberate degradations.
---

# Rich text on FlowDeck mobile

The web app stores task descriptions as sanitized HTML (see `artifacts/flowdeck/src/lib/sanitize.ts`).
React Native has no DOM, so `artifacts/flowdeck-mobile/lib/rich-text.ts` re-implements parse + serialize
over the SAME allowlist (tags: p br strong b em i u s ul ol li span img; only inline `color`; img src must
match `^/api/attachments/\d+/file`). Parsing through this restricted model IS the sanitizer.

**Why a custom engine:** no DOM in RN and we kept zero new rich-text deps. The editor models text as a
plain string + a parallel per-character attr array (`CharAttr[]`); `onChangeText` diffs prefix/suffix to
splice attrs so the cursor never jumps; serialization groups consecutive equal-attr chars into runs.

**Deliberate degradations on mobile EDIT (read mode renders everything fully via `parseRichHtml`):**
- Lists (`<ul>/<ol>`) flatten to paragraphs when a description is edited on mobile.
- Inline images are preserved but moved to the end of the description (the editor is a single TextInput;
  images aren't inserted inline there — the attachments gallery is the upload path).
These are acceptable per the task; do not "fix" them without checking this was intentional.

**Auth/images:** auth is cookie-based (`credentials:"include"`), no bearer. Attachment/inline images load
from the absolute URL `https://${EXPO_PUBLIC_DOMAIN}/api/attachments/:id/file` relying on cookies (works in
the dev web preview). Stored src stays RELATIVE; `resolveImageSrc` prefixes the base only at render time.

**Upload:** expo-image-picker (images only; expo-document-picker NOT installed). Flow mirrors web:
requestUploadUrl -> PUT blob (fetch local uri -> blob) -> registerAttachment. Generated hook bodies use
types `UploadUrlRequest`/`RegisterAttachmentInput`; mutate shapes: `requestUploadUrl.mutateAsync({data})`,
`registerAttachment.mutateAsync({taskId,data})`, `deleteAttachment.mutate({attachmentId})`.
