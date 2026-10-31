import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../js/templates.js';
import { sanitizeSvg } from '../js/sanitize-svg.js';

// In plain Node there is no DOM. The sanitizer must FAIL CLOSED here (this is intentional).
// These tests do NOT verify sanitizer security; real-DOM checks are in tests/browser/.
const withSvg = (svg) => ({ template: 'note-v1', meta: { title: 'T' }, sections: [{ heading: 'H', blocks: [{ type: 'svg', svg, caption: 'Cap *x*' }] }] });

test('without a DOM, sanitizeSvg returns null (fail closed)', () => {
  assert.equal(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'), null);
});
test('svg block renders placeholder + caption, never the raw svg', () => {
  const html = render(withSvg('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>'));
  assert.ok(!/<script|alert/.test(html));
  assert.match(html, /svg-placeholder/);
  assert.match(html, /<figcaption>Cap <i>x<\/i><\/figcaption>/);
});
test('existing real content still renders (non-svg paths unchanged)', () => {
  for (const f of ['biology/plant-kingdom.json', 'tests/plant-kingdom-test.json']) {
    const html = render(JSON.parse(readFileSync('content/' + f, 'utf8')));
    assert.match(html, /<article class="paper">/);
  }
});
