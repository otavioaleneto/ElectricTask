/**
 * Lightweight rich-text engine for the FlowDeck mobile app.
 *
 * Task descriptions are stored as sanitized HTML by the web app (see
 * artifacts/flowdeck/src/lib/sanitize.ts). React Native has no DOM, so this
 * module provides a small HTML parser + serializer over the SAME allowlist:
 *   tags:  p br strong b em i u s ul ol li span img
 *   attrs: inline `color` only (via <span style="color: …">), img src/alt
 *
 * Parsing into (and serializing out of) this restricted model also acts as the
 * sanitizer — anything outside the allowlist is dropped. Image sources are
 * restricted to the attachment file route, mirroring the web allowlist.
 */

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`;

/** Relative attachment file route, e.g. `/api/attachments/12/file`. */
const IMG_SRC_RE = /^\/api\/attachments\/\d+\/file(\?.*)?$/;

export const RICH_TEXT_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

export interface RichInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
}

export type RichBlock =
  | { type: "paragraph"; inlines: RichInline[] }
  | { type: "list"; ordered: boolean; items: RichInline[][] }
  | { type: "image"; src: string; alt: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function attrOf(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(attrs);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? "");
}

function colorFromStyle(style: string | null): string | null {
  if (!style) return null;
  const m = /color\s*:\s*([^;]+)/i.exec(style);
  return m ? m[1].trim() : null;
}

/** Resolve a stored (relative) attachment src to an absolute, loadable URL. */
export function resolveImageSrc(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${API_BASE}${src}`;
  return src;
}

export function attachmentFileUrl(id: number, download = false): string {
  return `${API_BASE}/api/attachments/${id}/file${download ? "?download=1" : ""}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function formatAttachmentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Parser: sanitized HTML -> RichBlock[]
// ---------------------------------------------------------------------------

export function parseRichHtml(html: string): RichBlock[] {
  if (!html || !html.trim()) return [];

  const blocks: RichBlock[] = [];
  let para: RichInline[] | null = null;
  let list: { ordered: boolean; items: RichInline[][] } | null = null;
  let li: RichInline[] | null = null;

  const fmt = { b: 0, i: 0, u: 0, s: 0, color: [] as string[] };

  const makeInline = (text: string): RichInline => {
    const color = fmt.color.length ? fmt.color[fmt.color.length - 1] : "";
    return {
      text,
      bold: fmt.b > 0 || undefined,
      italic: fmt.i > 0 || undefined,
      underline: fmt.u > 0 || undefined,
      strike: fmt.s > 0 || undefined,
      color: color || undefined,
    };
  };

  const flushPara = () => {
    if (para !== null) {
      blocks.push({ type: "paragraph", inlines: para });
      para = null;
    }
  };
  const flushList = () => {
    if (li) {
      list?.items.push(li);
      li = null;
    }
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };

  const handleText = (raw: string) => {
    const t = decodeEntities(raw);
    if (li) {
      li.push(makeInline(t));
      return;
    }
    if (list) return; // whitespace between <li>s
    if (para === null) {
      if (/^\s*$/.test(t)) return; // ignore whitespace outside blocks
      para = [];
    }
    para.push(makeInline(t));
  };

  const handleTag = (tag: string, closing: boolean, attrs: string) => {
    switch (tag) {
      case "p":
        if (closing) flushPara();
        else {
          flushPara();
          flushList();
          para = [];
        }
        break;
      case "br": {
        const tgt = li ?? para ?? (para = []);
        tgt.push({ text: "\n" });
        break;
      }
      case "ul":
      case "ol":
        if (closing) flushList();
        else {
          flushPara();
          flushList();
          list = { ordered: tag === "ol", items: [] };
        }
        break;
      case "li":
        if (closing) {
          if (li) {
            (list ?? (list = { ordered: false, items: [] })).items.push(li);
            li = null;
          }
        } else {
          if (!list) list = { ordered: false, items: [] };
          if (li) list.items.push(li);
          li = [];
        }
        break;
      case "img": {
        flushPara();
        const src = attrOf(attrs, "src");
        const alt = attrOf(attrs, "alt") ?? "";
        if (src && IMG_SRC_RE.test(src)) {
          blocks.push({ type: "image", src, alt });
        }
        break;
      }
      case "strong":
      case "b":
        fmt.b = Math.max(0, fmt.b + (closing ? -1 : 1));
        break;
      case "em":
      case "i":
        fmt.i = Math.max(0, fmt.i + (closing ? -1 : 1));
        break;
      case "u":
        fmt.u = Math.max(0, fmt.u + (closing ? -1 : 1));
        break;
      case "s":
        fmt.s = Math.max(0, fmt.s + (closing ? -1 : 1));
        break;
      case "span":
        if (closing) {
          if (fmt.color.length) fmt.color.pop();
        } else {
          fmt.color.push(colorFromStyle(attrOf(attrs, "style")) ?? "");
        }
        break;
      default:
        break;
    }
  };

  const re = /<\/?([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index > lastIndex) handleText(html.slice(lastIndex, m.index));
    lastIndex = re.lastIndex;
    handleTag(m[1].toLowerCase(), m[0].startsWith("</"), m[2] ?? "");
  }
  if (lastIndex < html.length) handleText(html.slice(lastIndex));

  flushPara();
  flushList();

  return blocks;
}

/** Plain-text projection of a rich description (for cards / previews). */
export function richHtmlToPlainText(html: string): string {
  const blocks = parseRichHtml(html);
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph") {
      lines.push(b.inlines.map((r) => r.text).join(""));
    } else if (b.type === "list") {
      for (const item of b.items) lines.push(item.map((r) => r.text).join(""));
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// Editor model <-> HTML
// ---------------------------------------------------------------------------

export interface CharAttr {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
}

export interface EditorModel {
  text: string;
  attrs: CharAttr[];
  images: { src: string; alt: string }[];
}

/** Build the flat editor model (plain text + per-char attrs + images) from HTML. */
export function htmlToEditorModel(html: string): EditorModel {
  const blocks = parseRichHtml(html);
  const lines: string[] = [];
  const lineAttrs: CharAttr[][] = [];
  const images: { src: string; alt: string }[] = [];

  const pushInlineLine = (inlines: RichInline[]) => {
    let s = "";
    const a: CharAttr[] = [];
    for (const run of inlines) {
      for (const ch of run.text) {
        s += ch;
        a.push({
          bold: run.bold,
          italic: run.italic,
          underline: run.underline,
          strike: run.strike,
          color: run.color,
        });
      }
    }
    lines.push(s);
    lineAttrs.push(a);
  };

  for (const b of blocks) {
    if (b.type === "image") images.push({ src: b.src, alt: b.alt });
    else if (b.type === "paragraph") pushInlineLine(b.inlines);
    else for (const item of b.items) pushInlineLine(item);
  }

  let text = "";
  const attrs: CharAttr[] = [];
  lines.forEach((ln, idx) => {
    if (idx > 0) {
      text += "\n";
      attrs.push({});
    }
    text += ln;
    for (let k = 0; k < ln.length; k++) attrs.push(lineAttrs[idx][k] ?? {});
  });

  return { text, attrs, images };
}

function attrSignature(a: CharAttr): string {
  return `${a.bold ? "b" : ""}${a.italic ? "i" : ""}${a.underline ? "u" : ""}${
    a.strike ? "s" : ""
  }|${a.color ?? ""}`;
}

function runToHtml(text: string, a: CharAttr): string {
  let inner = escapeHtml(text);
  if (a.strike) inner = `<s>${inner}</s>`;
  if (a.underline) inner = `<u>${inner}</u>`;
  if (a.italic) inner = `<em>${inner}</em>`;
  if (a.bold) inner = `<strong>${inner}</strong>`;
  if (a.color) inner = `<span style="color: ${escapeAttr(a.color)}">${inner}</span>`;
  return inner;
}

function lineToHtml(line: string, attrs: CharAttr[]): string {
  if (line.length === 0) return "";
  let out = "";
  let runStart = 0;
  for (let k = 1; k <= line.length; k++) {
    const boundary =
      k === line.length ||
      attrSignature(attrs[k] ?? {}) !== attrSignature(attrs[runStart] ?? {});
    if (boundary) {
      out += runToHtml(line.slice(runStart, k), attrs[runStart] ?? {});
      runStart = k;
    }
  }
  return out;
}

/** Serialize the editor model back to sanitized HTML (or "" when empty). */
export function editorModelToHtml(model: EditorModel): string {
  const { text, attrs, images } = model;
  const hasText = text.trim().length > 0;
  if (!hasText && images.length === 0) return "";

  let html = "";
  const lines = text.split("\n");
  let pos = 0;
  for (const ln of lines) {
    const slice = attrs.slice(pos, pos + ln.length);
    pos += ln.length + 1; // skip the newline separator
    html += `<p>${lineToHtml(ln, slice)}</p>`;
  }
  for (const img of images) {
    html += `<img src="${escapeAttr(img.src)}" alt="${escapeAttr(img.alt)}">`;
  }
  return html;
}
