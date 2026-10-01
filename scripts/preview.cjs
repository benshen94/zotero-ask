// Recreate the public preview from the plugin's actual styles and markup, with synthetic content.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'bootstrap.js'), 'utf8');
const scope = vm.createContext({ Zotero: { Prefs: { get: () => undefined } } });
vm.runInContext(source, scope);
let css;
const doc = { getElementById: () => null, createElement: () => ({}), head: { appendChild: style => { css = style.textContent; } } };
scope.ZoteroAsk_ensureStyle(doc, { content: false });
const template = source.match(/root\.innerHTML = `([\s\S]*?)`;\n  frameDoc\.body/)[1];
let markup = vm.runInContext('`' + template + '`', scope);
const core = require('../core.js');
const katex = require('katex');
const render = text => core.renderMarkdown(text, (math, displayMode) => katex.renderToString(math, { displayMode, throwOnError: false }));
markup = markup.replace('Open a PDF in Zotero to ask about it.', 'A simple model of population growth');
markup = markup.replace('Loading models…', 'Example model').replace('<select class="za-effort" aria-label="Reasoning intensity"></select>', '<select class="za-effort" aria-label="Reasoning intensity"><option>High</option></select>');
markup = markup.replace('<nav class="za-chat-tabs" aria-label="Chat tabs"></nav>', '<nav class="za-chat-tabs" aria-label="Chat tabs"><button class="za-tab" aria-selected="true">Population growth<span class="za-tab-close">×</span></button><button class="za-tab">Methods<span class="za-tab-close">×</span></button></nav>');
const messages = [
  ['user', 'Can you explain the equation on this page?'],
  ['assistant', 'The model describes how a population approaches its carrying capacity.\n\n$$\\frac{dN}{dt}=rN\\left(1-\\frac{N}{K}\\right)$$\n\nHere, $N$ is population size, $r$ is the growth rate, and $K$ is the carrying capacity.'],
  ['user', 'What changes if the growth rate doubles?'],
  ['assistant', 'The population reaches the same equilibrium sooner. The carrying capacity stays at $K$; doubling $r$ changes the time scale, not the final size.']
].map(([role, text]) => `<article class="za-message za-${role}"><div class="za-message-label">${role === 'user' ? 'You' : 'Example model'}</div><div class="za-message-content">${render(text)}</div></article>`).join('');
markup = markup.replace('<main class="za-messages" role="log" aria-live="polite"></main>', `<main class="za-messages" role="log" aria-live="polite">${messages}</main>`);
markup = markup.replace('<div class="za-selection" hidden>', '<div class="za-selection">').replace('<span class="za-selection-label"></span>', '<span class="za-selection-label">Selected passage · p. 2</span>').replace('<div class="za-selection-text"></div>', '<div class="za-selection-text">Density dependence limits growth as the population approaches carrying capacity.</div>');
const katexCss = fs.readFileSync(path.join(root, 'node_modules/katex/dist/katex.min.css'), 'utf8').replaceAll('url(fonts/', 'url(/node_modules/katex/dist/fonts/');
const output = `<!doctype html><html><meta charset="utf-8"><title>Zotero Ask — illustrative preview</title><style>${katexCss}\n${css}\nhtml{color-scheme:light}body{margin:0;background:#f4f4f2;font:14px system-ui;color:#292b2a}.preview{width:1200px;height:800px;display:flex;overflow:hidden}.paper-area{flex:1;padding:32px 48px}.paper{height:100%;box-sizing:border-box;padding:48px 54px;background:white;box-shadow:0 2px 12px #0000000a;font:16px/1.8 Georgia,serif}.paper small{font:11px system-ui;letter-spacing:.1em;color:#777}.paper h1{font-size:29px;line-height:1.25;margin:28px 0}.paper h2{font-size:18px;margin:28px 0 12px}.paper p{margin:12px 0}.equation{text-align:center;font-size:22px;margin:28px 0}.note{font:12px/1.6 system-ui;color:#777;border-top:1px solid #ddd;padding-top:20px;margin-top:32px}#zotero-ask-panel.za-root{position:relative;inset:auto;width:390px;max-width:none;height:100%;flex-shrink:0;box-shadow:none}</style><div class="preview"><div class="paper-area"><div class="paper"><small>ILLUSTRATIVE PAPER · SYNTHETIC CONTENT</small><h1>A simple model of population growth</h1><p>Understanding how populations change begins with a balance between growth and available resources.</p><h2>2. Density-dependent growth</h2><p>The logistic model assumes that per-capita growth decreases with population density:</p><div class="equation">${katex.renderToString('\\frac{dN}{dt}=rN\\left(1-\\frac{N}{K}\\right)', { displayMode:true })}</div><p>Density dependence limits growth as the population approaches carrying capacity. The parameter <i>r</i> controls how quickly the population grows, while <i>K</i> sets its equilibrium size.</p><p>This simple model helps distinguish changes in the speed of growth from changes in the equilibrium population.</p><div class="note">Zotero Ask 0.2.5 · Preview uses the plugin’s actual UI styles and markup.<br>Paper text, questions, answers, and model name are examples.</div></div></div><aside id="zotero-ask-panel" class="za-root">${markup}</aside></div><script>
const params = new URLSearchParams(location.search);
if (params.get('theme') === 'dark') document.querySelector('#zotero-ask-panel').style.colorScheme = 'dark';
if (params.get('width')) document.querySelector('#zotero-ask-panel').style.width = Math.max(280, Math.min(600, Number(params.get('width')) || 390)) + 'px';
</script></html>`;
const out = process.argv[2] || '/tmp/zotero-ask-preview.html';
fs.writeFileSync(out, output);
console.log(out);
