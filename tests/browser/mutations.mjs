// Deliberately weakened copies of sanitize-svg.js, applied in memory only (never written to disk).
// Each mutation MUST make `node tests/browser/run.mjs` fail; otherwise the tests are not protective.
const rep = (a, b) => (src) => { if (!src.includes(a)) throw new Error('mutation target not found: ' + a); return src.replace(a, b); };
export const MUTATIONS = {
  allowAllTags: rep("n.namespaceURI === SVG_NS && ALLOWED_TAGS.has(n.localName) && n.localName !== 'svg'", 'true'),
  allowScriptTag: rep("'text', 'tspan', 'defs'", "'text', 'script', 'tspan', 'defs'"),
  allowAllAttrs: rep('if (test && a.value.length <= 4000 && test.test(a.value))', 'if (true)'),
  skipValueCheck: rep('if (test && a.value.length <= 4000 && test.test(a.value))', 'if (test)'),
  allowEventAttrs: rep('const test = a.namespaceURI === null ? ATTR[a.name] : null;', 'const test = /^on/.test(a.name) ? /./ : (a.namespaceURI === null ? ATTR[a.name] : null);'),
  looseFillUrl: rep("|url\\(#[A-Za-z][A-Za-z0-9_-]{0,63}\\))$/;\nconst IDENT", "|url\\([^)]*\\))$/;\nconst IDENT"),
  noDoctypeCheck: rep('if (/<!DOCTYPE|<!ENTITY|<\\?xml-stylesheet/i.test(src)) return null;', ''),
  noNodeLimit: rep('if (depth > MAX_DEPTH || ++nodes > MAX_NODES) throw new Error(\'limit\');', 'nodes++;'),
  noSizeLimit: rep('src.length > MAX_SVG_BYTES', 'false'),
  noParserErrorCheck: rep("if (doc.getElementsByTagName('parsererror').length || root.querySelector('parsererror')) return null;", ''),
  passthroughSource: rep('const svg = new XMLSerializer().serializeToString(out.documentElement);', 'const svg = src;'),
  failOpenOnError: rep('  } catch {\n    return null;\n  }', '  } catch {\n    return { svg: input, removed: 0 };\n  }'),
  failOpenNoDom: rep('if (!hasDom()) return null;', 'if (!hasDom()) return { svg: input, removed: 0 };')
};
