import { sanitizeSvg } from '../../js/sanitize-svg.js';
import { render } from '../../js/templates.js';

const OK_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc']);
const OK_ATTR = new Set(['viewbox', 'width', 'height', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'offset', 'points', 'd', 'transform', 'fill', 'stroke', 'stop-color', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'font-size', 'stroke-linecap', 'stroke-linejoin', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline', 'gradientunits', 'id', 'xmlns']);

// Independent DOM audit of what actually landed in the page (does not reuse sanitizer code).
function audit(root) {
  const v = [];
  root.querySelectorAll('*').forEach((el) => {
    const inFigure = el.closest('figure');
    const tag = el.localName.toLowerCase();
    if (el.closest('svg')) {
      if (!OK_TAGS.has(tag)) v.push('tag:' + tag);
      for (const a of el.attributes) { if (!OK_ATTR.has(a.name.toLowerCase())) v.push('attr:' + a.name); if (/^on/i.test(a.name)) v.push('handler:' + a.name); if (/javascript:|data:|https?:|\/\//i.test(a.value) && a.name !== 'xmlns') v.push('url-ish:' + a.name + '=' + a.value.slice(0, 40)); }
    }
    if (['script', 'iframe', 'object', 'embed', 'img', 'foreignobject', 'style', 'link', 'a', 'use', 'image'].includes(tag)) v.push('tag:' + tag);
    for (const a of el.attributes) if (/^on/i.test(a.name)) v.push('handler:' + a.name);
  });
  return v;
}

const out = document.getElementById('out');
const note = (svg) => ({ template: 'note-v1', meta: { title: 'T' }, sections: [{ heading: 'H', blocks: [{ type: 'svg', svg, caption: 'Caption *kept*' }] }] });

window.__sanitizeRaw = (v) => sanitizeSvg(v);
window.__inject = (svg) => {
  window.__pwned = 0;
  out.innerHTML = render(note(svg)); // same path the app uses
  const fig = out.querySelector('figure.fig');
  const s = fig && fig.querySelector('svg');
  const c = (t) => out.querySelectorAll(`svg ${t}`).length;
  return {
    placeholder: !!out.querySelector('.svg-placeholder'), hasSvg: !!s, violations: audit(out),
    counts: { rect: c('rect'), circle: c('circle'), path: c('path'), text: c('text'), linearGradient: c('linearGradient'), stop: c('stop') },
    text: s ? (s.querySelector('text')?.textContent ?? '') : '',
    attrs: s ? { viewBox: s.getAttribute('viewBox'), fill: s.querySelector('rect')?.getAttribute('fill') } : {}
  };
};
window.__renderNote = () => {
  window.__pwned = 0;
  const hostile = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="window.__pwned=1"><script>window.__pwned=1</script><rect width="5" height="5" onclick="window.__pwned=1"/></svg>';
  out.innerHTML = render(note(hostile));
  out.querySelectorAll('rect').forEach((r) => r.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  return { pwned: !!window.__pwned, captionKept: /Caption <i>kept<\/i>/.test(out.innerHTML), violations: audit(out) };
};
window.__ready = true;
