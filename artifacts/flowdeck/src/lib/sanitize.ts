import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "span",
  "img",
];

const ALLOWED_ATTR = ["style", "src", "alt", "title", "class"];

const IMG_SRC_RE = /^\/api\/attachments\/\d+\/file(\?.*)?$/;

let hookRegistered = false;
function registerImgHook() {
  if (hookRegistered) return;
  hookRegistered = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof Element)) return;
    if (node.nodeName === "IMG") {
      const src = node.getAttribute("src") || "";
      if (!IMG_SRC_RE.test(src)) {
        node.removeAttribute("src");
      }
    }
    if (node.hasAttribute("style")) {
      const el = node as HTMLElement;
      const color = el.style.color;
      el.removeAttribute("style");
      if (color) el.style.color = color;
    }
  });
}

export function sanitizeHtml(html: string): string {
  registerImgHook();
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
