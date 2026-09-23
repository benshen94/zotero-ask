const test = require('node:test');
const assert = require('node:assert/strict');
const katex = require('katex');
const core = require('../core.js');

const renderMath = core.createMathRenderer(katex);
const render = source => core.renderMarkdown(source, renderMath);
const count = (html, pattern) => (html.match(pattern) || []).length;
const INLINE = /<span class="katex">/g;
const DISPLAY = /<span class="katex-display">/g;

test('typesets all four delimiter styles with the right display mode', () => {
  assert.equal(count(render('Energy $E = mc^2$ here.'), INLINE), 1);
  assert.equal(count(render('Inline \\(a^2 + b^2\\) here.'), INLINE), 1);
  const dollars = render('Before\n$$\\frac{a}{b}$$\nafter');
  const brackets = render('Before\n\\[\n\\sum_{i=1}^n x_i\n\\]\nafter');
  for (const html of [dollars, brackets]) {
    assert.equal(count(html, DISPLAY), 1);
    assert.ok(html.startsWith('Before<br>'));
    assert.ok(html.endsWith('after'));
  }
  assert.equal(count(render('$x$ and \\(y\\)'), DISPLAY), 0);
});

test('keeps MathML and the TeX annotation for accessibility', () => {
  const html = render('$\\alpha + 1$');
  assert.match(html, /<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML">/);
  assert.match(html, /<annotation encoding="application\/x-tex">\\alpha \+ 1<\/annotation>/);
});

test('leaves fenced and inline code untouched', () => {
  const fenced = render('```tex\n$x$ and \\(y\\) and <b>\n```');
  assert.equal(fenced, '<pre><code>$x$ and \\(y\\) and &lt;b&gt;</code></pre>');
  const inline = render('Use `$x$` or `\\[y\\]` literally, but $z$ renders.');
  assert.match(inline, /<code>\$x\$<\/code>/);
  assert.match(inline, /<code>\\\[y\\\]<\/code>/);
  assert.equal(count(inline, INLINE), 1);
});

test('treats currency and ordinary dollar signs as plain text', () => {
  for (const text of ['It costs $5 and $10.', 'Prices ran $5-$10 per unit.', 'Only $20', 'Between $ 3 and 4 $', 'Budget: $1,000,000']) {
    assert.equal(render(text), text);
  }
  assert.equal(render('Escaped \\$5 stays a price.'), 'Escaped $5 stays a price.');
  assert.equal(count(render('From $5 to the value $x$.'), INLINE), 1);
});

test('shows malformed, over-expanded, or unrendered math as readable source', () => {
  const malformed = render('Broken $\\frac{a$ math');
  assert.equal(malformed, 'Broken <span class="za-math-source">$\\frac{a$</span> math');
  assert.equal(render('\\(\\notacommand{x}\\)'), '<span class="za-math-source">\\(\\notacommand{x}\\)</span>');
  const expansion = render('$\\def\\a{\\a\\a}\\a$');
  assert.match(expansion, /za-math-source/);
  assert.doesNotMatch(expansion, /class="katex"/);
  assert.equal(core.renderMarkdown('$x$ and *y*'), '<span class="za-math-source">$x$</span> and <em>y</em>');
});

test('keeps Markdown escaping and blocks untrusted KaTeX commands', () => {
  const html = render('<img src=x onerror=alert(1)> **bold** $x<y$ [link](https://example.org)');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.org" rel="noreferrer">link<\/a>/);
  assert.equal(count(html, INLINE), 1);
  for (const source of ['$\\href{javascript:alert(1)}{x}$', '$\\url{javascript:alert(1)}$', '$\\htmlClass{x}{y}$', '$\\includegraphics{https://example.org/x.png}$']) {
    const output = render(source);
    assert.doesNotMatch(output, /<a |href=|<img|javascript:alert\(1\)"/);
  }
  const source = render('$<script>alert(1)</script>$');
  assert.doesNotMatch(source, /<script/);
});

test('uses bounded KaTeX options and caches repeated expressions', () => {
  assert.equal(core.KATEX_OPTIONS.trust, false);
  assert.equal(core.KATEX_OPTIONS.throwOnError, false);
  assert.ok(core.KATEX_OPTIONS.maxExpand > 0 && core.KATEX_OPTIONS.maxExpand <= 1000);
  assert.ok(core.KATEX_OPTIONS.maxSize > 0);
  let calls = 0;
  const counted = core.createMathRenderer({ renderToString: (tex, options) => { calls++; return katex.renderToString(tex, options); } });
  core.renderMarkdown('$x$ $x$ $x$', counted);
  assert.equal(calls, 1);
  assert.equal(counted('x'.repeat(5000), false), null);
});

test('Enter sends, Shift+Enter adds a line, and blocked sends never insert newlines', () => {
  const ready = { busy: false, disabled: false, text: 'What is the main result?' };
  const key = (extra = {}) => ({ key: 'Enter', shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, repeat: false, isComposing: false, keyCode: 13, ...extra });
  assert.equal(core.composerKeyAction(key(), ready), 'submit');
  assert.equal(core.composerKeyAction(key({ metaKey: true }), ready), 'submit');
  assert.equal(core.composerKeyAction(key({ ctrlKey: true }), ready), 'submit');
  assert.equal(core.composerKeyAction(key({ shiftKey: true }), ready), 'default');
  assert.equal(core.composerKeyAction(key({ isComposing: true }), ready), 'default');
  assert.equal(core.composerKeyAction(key({ keyCode: 229 }), ready), 'default');
  assert.equal(core.composerKeyAction(key({ repeat: true }), ready), 'block');
  assert.equal(core.composerKeyAction(key(), { ...ready, busy: true }), 'block');
  assert.equal(core.composerKeyAction(key(), { ...ready, disabled: true }), 'block');
  assert.equal(core.composerKeyAction(key(), { ...ready, text: '  \n ' }), 'block');
  assert.equal(core.composerKeyAction({ key: 'a' }, ready), 'default');
});
