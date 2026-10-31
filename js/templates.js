import { BRAND } from './config.js';
import { sanitizeSvg } from './sanitize-svg.js';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>');

// Untrusted SVG is rendered only after DOM sanitization. If it cannot be sanitized with
// confidence (or no DOM is available), a safe placeholder with the caption is shown instead.
const svgBlock = (b) => {
  const cap = `<figcaption>${md(b.caption || '')}</figcaption>`;
  const r = b.svg ? sanitizeSvg(b.svg) : null;
  if (r) return `<figure class="fig">${r.svg}${cap}</figure>`;
  return `<figure class="fig"><div class="callout svg-placeholder">[Diagram unavailable]</div>${cap}</figure>`;
};

const block = (b) => {
  if (b.type === 'bullets') return `<ul>${(b.items || []).map((x) => `<li>${md(x)}</li>`).join('')}</ul>`;
  if (b.type === 'table') return `<table><thead><tr>${(b.head || []).map((h) => `<th>${md(h)}</th>`).join('')}</tr></thead><tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if (b.type === 'sub') return `<h3>${md(b.text)}</h3>`;
  if (b.type === 'note') return `<div class="callout">${md(b.text)}</div>`;
  if (b.type === 'svg') return svgBlock(b);
  return `<p>${md(b.text)}</p>`;
};
const head = (crumb) => `<header class="ph"><div class="pb"><span class="pl">MR</span><b>${esc(BRAND.name)}</b></div><div class="crumb">${crumb.filter(Boolean).map(esc).join(' | ')}</div></header>`;
const footer = () => `<footer class="pf">${BRAND.footer.map((l) => `<div>${esc(l)}</div>`).join('')}</footer>`;

const note = (d) => {
  const m = d.meta || {};
  return `<article class="paper">${head([m.class, m.chapter, m.crumb || m.title])}
<h1>${esc(m.title)}</h1><p class="sub">${esc(m.subtitle || '')}</p>
${m.syllabus ? `<div class="syl"><b>${esc(m.syllabus_label || '')}</b><br>${md(m.syllabus)}</div>` : ''}
${(d.sections || []).map((s) => `<section><h2>${md(s.heading)}</h2>${(s.blocks || []).map(block).join('')}</section>`).join('')}${footer()}</article>`;
};

const test = (d) => {
  const m = d.meta || {}, qs = d.questions || [], L = 'ABCDEFGH';
  return `<article class="paper">${head([m.class, m.subject, m.time])}
<h1>${esc(m.title)}</h1><p class="sub">${esc(m.subtitle || '')}</p>
<ol class="qs">${qs.map((q) => `<li><div>${md(q.q)}</div><ol class="op" type="A">${(q.options || []).map((o) => `<li>${md(o)}</li>`).join('')}</ol></li>`).join('')}</ol>
<section class="key"><h2>Answer key</h2><table><thead><tr><th>Q</th><th>Ans</th><th>Explanation</th></tr></thead><tbody>${qs.map((q, i) => `<tr><td>${i + 1}</td><td>${L[q.answer] ?? '-'}</td><td>${md(q.explanation || '')}</td></tr>`).join('')}</tbody></table></section>${footer()}</article>`;
};

export const TEMPLATES = { 'note-v1': note, 'test-v1': test };
export const render = (d) => (TEMPLATES[d.template] ? TEMPLATES[d.template](d) : null);
