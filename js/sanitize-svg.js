// DOM-based, allow-list, fail-closed SVG sanitizer for MedRise HQ.
// Needs a real browser DOM (DOMParser + XMLSerializer). Without one it returns null,
// and the caller must show a safe placeholder instead of the untrusted SVG.
//
// Approach: parse as strict XML, then BUILD A NEW tree from the allow-lists below.
// Nothing from the input tree is ever re-attached, so unknown tags/attributes cannot leak.

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const MAX_SVG_BYTES = 100000;
export const MAX_NODES = 2000;
export const MAX_DEPTH = 24;

export const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc'
]);

const NUM = /^[-+0-9eE.,\s%]*$/;
const COLOR = /^(none|currentColor|transparent|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|(rgb|hsl)a?\([-0-9.,\s%]*\))$/;
const PAINT = /^(?:(none|currentColor|transparent|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|(?:rgb|hsl)a?\([-0-9.,\s%]*\))|url\(#[A-Za-z][A-Za-z0-9_-]{0,63}\))$/;
const IDENT = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const WORDS = /^[A-Za-z0-9 ,'_-]{0,100}$/;

// attribute name -> value test. Anything not listed is dropped (this includes style, class, href, xlink:*, on*).
const ATTR = {
  viewBox: NUM, width: NUM, height: NUM, x: NUM, y: NUM, cx: NUM, cy: NUM, r: NUM, rx: NUM, ry: NUM,
  x1: NUM, y1: NUM, x2: NUM, y2: NUM, dx: NUM, dy: NUM, offset: NUM,
  points: NUM,
  d: /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]*$/,
  transform: /^[A-Za-z0-9(),.\s+\-]*$/,
  fill: PAINT, stroke: PAINT, 'stop-color': COLOR,
  'stroke-width': NUM, 'stroke-dasharray': NUM, opacity: NUM, 'fill-opacity': NUM,
  'stroke-opacity': NUM, 'stop-opacity': NUM, 'font-size': NUM,
  'stroke-linecap': /^(butt|round|square)$/, 'stroke-linejoin': /^(miter|round|bevel)$/,
  'font-weight': /^(normal|bold|bolder|lighter|[1-9]00)$/,
  'font-family': WORDS,
  'text-anchor': /^(start|middle|end)$/,
  'dominant-baseline': /^(auto|middle|central|hanging|alphabetic|text-before-edge|text-after-edge)$/,
  gradientUnits: /^(userSpaceOnUse|objectBoundingBox)$/,
  id: IDENT
};

// Every rendered SVG gets its own id prefix so two diagrams on one page can never collide on ids / url(#id) refs.
let instance = 0;
const PAINT_REF = /^url\(#([A-Za-z][A-Za-z0-9_-]{0,63})\)$/;

const hasDom = () => typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined' && typeof document !== 'undefined';

/**
 * Returns { svg: '<svg ...>', removed: n } on success, or null when the input cannot be
 * sanitized with confidence (no DOM, not well-formed XML, wrong root, too big/deep, ...).
 * null means: do NOT render, show the placeholder.
 */
export function sanitizeSvg(input, prefix = `mr${++instance}-`) {
  try {
    if (!hasDom()) return null;
    if (typeof input !== 'string') return null;
    const src = input.trim();
    if (!src || src.length > MAX_SVG_BYTES) return null;
    if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(src)) return null;

    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg' || root.namespaceURI !== SVG_NS) return null;
    if (doc.getElementsByTagName('parsererror').length || root.querySelector('parsererror')) return null;

    let nodes = 0, removed = 0;
    const out = document.implementation.createDocument(SVG_NS, 'svg', null);

    const copy = (el, depth) => {
      if (depth > MAX_DEPTH || ++nodes > MAX_NODES) throw new Error('limit');
      const clean = depth === 0 ? out.documentElement : out.createElementNS(SVG_NS, el.localName);
      for (const a of Array.from(el.attributes)) {
        const test = a.namespaceURI === null ? ATTR[a.name] : null;
        if (test && a.value.length <= 4000 && test.test(a.value)) {
          let v = a.value;
          if (a.name === 'id') v = prefix + v;
          else if (a.name === 'fill' || a.name === 'stroke') { const m = PAINT_REF.exec(v); if (m) v = `url(#${prefix}${m[1]})`; }
          clean.setAttribute(a.name, v);
        }
        else if (!(depth === 0 && a.name === 'xmlns')) removed++;
      }
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === 3 || n.nodeType === 4) { // text / CDATA become plain text
          if (['text', 'tspan', 'title', 'desc'].includes(el.localName)) clean.appendChild(out.createTextNode(n.nodeValue));
        } else if (n.nodeType === 1) {
          if (n.namespaceURI === SVG_NS && ALLOWED_TAGS.has(n.localName) && n.localName !== 'svg') clean.appendChild(copy(n, depth + 1));
          else removed++;
        } // comments, processing instructions: dropped silently
      }
      return clean;
    };
    copy(root, 0);
    if (!out.documentElement.hasAttribute('viewBox')) return null; // keeps layout predictable and responsive
    const svg = new XMLSerializer().serializeToString(out.documentElement);
    return { svg, removed };
  } catch {
    return null;
  }
}
