// Hostile SVG inputs. `hostile: true` => must never execute / never leave dangerous nodes in the DOM.
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const P = 'window.__pwned=1';
export const PAYLOADS = [
  ['script element', `<svg ${NS} viewBox="0 0 10 10"><script>${P}</script><rect width="5" height="5"/></svg>`],
  ['script in CDATA', `<svg ${NS} viewBox="0 0 10 10"><script><![CDATA[${P}]]></script></svg>`],
  ['onload on root', `<svg ${NS} viewBox="0 0 10 10" onload="${P}"><rect width="5" height="5"/></svg>`],
  ['onclick/onmouseover on child', `<svg ${NS} viewBox="0 0 10 10"><rect width="10" height="10" onclick="${P}" onmouseover="${P}"/></svg>`],
  ['uppercase ONLOAD', `<svg ${NS} viewBox="0 0 10 10" ONLOAD="${P}"/>`],
  ['foreignObject + img onerror', `<svg ${NS} viewBox="0 0 10 10"><foreignObject><img xmlns="http://www.w3.org/1999/xhtml" src="x" onerror="${P}"/></foreignObject></svg>`],
  ['foreignObject + iframe', `<svg ${NS} viewBox="0 0 10 10"><foreignObject><iframe xmlns="http://www.w3.org/1999/xhtml" src="javascript:${P}"/></foreignObject></svg>`],
  ['a href javascript:', `<svg ${NS} viewBox="0 0 10 10"><a href="javascript:${P}"><rect width="10" height="10"/></a></svg>`],
  ['xlink:href javascript:', `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><a xlink:href="javascript:${P}"><text>x</text></a></svg>`],
  ['use external href', `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><use xlink:href="http://evil.example/x.svg#a"/><use href="data:image/svg+xml,&lt;svg/&gt;"/></svg>`],
  ['image remote', `<svg ${NS} viewBox="0 0 10 10"><image href="http://evil.example/track.png" width="5" height="5"/></svg>`],
  ['style attribute with url()', `<svg ${NS} viewBox="0 0 10 10"><rect width="5" height="5" style="fill:url(http://evil.example/x);behavior:url(x)"/></svg>`],
  ['style element', `<svg ${NS} viewBox="0 0 10 10"><style>@import url(http://evil.example/x.css); rect{fill:red}</style><rect width="5" height="5"/></svg>`],
  ['animate/set event + href', `<svg ${NS} viewBox="0 0 10 10"><a><set attributeName="href" to="javascript:${P}"/><animate attributeName="href" values="javascript:${P}" onbegin="${P}"/><text>x</text></a></svg>`],
  ['fill url external', `<svg ${NS} viewBox="0 0 10 10"><rect width="5" height="5" fill="url(http://evil.example/x#a)"/><rect width="5" height="5" fill="url(javascript:${P})"/></svg>`],
  ['nested svg with onload', `<svg ${NS} viewBox="0 0 10 10"><svg viewBox="0 0 1 1" onload="${P}"/></svg>`],
  ['title text that looks like markup (mXSS)', `<svg ${NS} viewBox="0 0 10 10"><title>&lt;/title&gt;&lt;img src=x onerror=${P}&gt;</title><desc>&lt;/desc&gt;&lt;script&gt;${P}&lt;/script&gt;</desc></svg>`],
  ['text with entities/markup-like', `<svg ${NS} viewBox="0 0 10 10"><text>&lt;script&gt;${P}&lt;/script&gt;</text></svg>`],
  ['namespace trick (prefixed svg ns)', `<s:svg xmlns:s="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><s:script>${P}</s:script><s:rect width="5" height="5" onclick="${P}"/></s:svg>`],
  ['wrong namespace element named like svg tag', `<svg ${NS} viewBox="0 0 10 10"><rect xmlns="http://www.w3.org/1999/xhtml" onclick="${P}"/><script xmlns="http://www.w3.org/1999/xhtml">${P}</script></svg>`],
  ['DOCTYPE + entity', `<!DOCTYPE svg [<!ENTITY x "${P}">]><svg ${NS} viewBox="0 0 10 10"><text>&x;</text></svg>`],
  ['xml-stylesheet PI', `<?xml-stylesheet href="http://evil.example/x.css"?><svg ${NS} viewBox="0 0 10 10"/>`],
  ['html root, not svg', `<html xmlns="http://www.w3.org/1999/xhtml"><body onload="${P}"/></html>`],
  ['truncated xml (partial svg)', `<svg ${NS} viewBox="0 0 10 10"><rect width="5" height="5"/><text>unclosed`],
  ['mismatched tags', `<svg ${NS} viewBox="0 0 10 10"><g><rect width="5" height="5"/></svg>`],
  ['malformed (HTML-style unclosed)', `<svg ${NS} viewBox="0 0 10 10"><img src=x onerror=${P}></svg>`],
  ['path with injection chars', `<svg ${NS} viewBox="0 0 10 10"><path d="M0 0 L10 10&quot; onload=&quot;${P}" fill="red&quot; onclick=&quot;${P}"/></svg>`],
  ['font-family injection', `<svg ${NS} viewBox="0 0 10 10"><text font-family="a&quot; onmouseover=&quot;${P}">x</text></svg>`],
  ['id injection', `<svg ${NS} viewBox="0 0 10 10"><linearGradient id="a&quot; onload=&quot;${P}"/></svg>`],
  ['transform injection', `<svg ${NS} viewBox="0 0 10 10"><g transform="rotate(1)&quot; onload=&quot;${P}"/></svg>`],
  ['deep nesting', `<svg ${NS} viewBox="0 0 10 10">${'<g>'.repeat(60)}<rect width="1" height="1"/>${'</g>'.repeat(60)}</svg>`],
  ['too many nodes', `<svg ${NS} viewBox="0 0 10 10">${'<rect width="1" height="1"/>'.repeat(2500)}</svg>`],
  ['oversize', `<svg ${NS} viewBox="0 0 10 10"><text>${'a'.repeat(100100)}</text></svg>`],
  ['empty / not a string handled separately', '']
];

export const GOOD = `<svg ${NS} viewBox="0 0 100 60" width="300"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a7"/><stop offset="1" stop-color="#07a"/></linearGradient></defs><rect x="2" y="2" width="96" height="56" rx="6" fill="url(#g1)" stroke="#333" stroke-width="1.5"/><circle cx="30" cy="30" r="10" fill="white"/><path d="M50 30 L90 30" stroke="black" stroke-linecap="round"/><text x="50" y="50" text-anchor="middle" font-size="8" font-family="Arial, sans-serif">Cell wall</text></svg>`;
