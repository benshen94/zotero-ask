const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

// Runs the shipped bootstrap.js + core.js combination through Zotero's real entry point, startup(),
// with core.js loaded by the script loader the way Zotero does. With ZOTERO_ASK_XPI set (build.sh
// does this), every file comes from the built XPI instead of the source tree.
const XPI = process.env.ZOTERO_ASK_XPI;
const ROOT = path.join(__dirname, '..');
const read = name => XPI ? execFileSync('unzip', ['-p', XPI, name], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) : fs.readFileSync(path.join(ROOT, name), 'utf8');
const ROOT_URI = 'jar:file:///profile/extensions/zotero-ask@benshenhar.com.xpi!/';

function fakeCodex() {
  const lines = []; let waiting = null; let exit;
  const exited = new Promise(resolve => { exit = resolve; });
  const stdout = {
    readString: () => lines.length ? Promise.resolve(lines.shift()) : new Promise(resolve => { waiting = resolve; })
  };
  const reply = message => { const text = JSON.stringify(message) + '\n'; if (waiting) { const resolve = waiting; waiting = null; resolve(text); } else lines.push(text); };
  const results = {
    initialize: {},
    'account/read': { account: { type: 'chatgpt', email: 'reader@example.org', planType: 'plus' }, requiresOpenaiAuth: true },
    'model/list': { data: [{ id: 'example-model', displayName: 'Example model', inputModalities: ['text', 'image'], supportedReasoningEfforts: [{ reasoningEffort: 'high' }], isDefault: true }] }
  };
  return {
    stdout, stderr: { readString: () => exited.then(() => '') }, wait: () => exited, kill: () => exit({ exitCode: 0 }),
    stdin: {
      close() {},
      write(text) {
        for (const line of text.split('\n').filter(Boolean)) {
          const message = JSON.parse(line);
          if (message.id !== undefined) reply({ id: message.id, result: results[message.method] ?? {} });
        }
      }
    }
  };
}

function launch({ coreSource = read('core.js') } = {}) {
  const loads = [];
  const context = vm.createContext({
    console, WeakRef, setTimeout, clearTimeout,
    Zotero: { debug() {}, Prefs: { get() {}, set() {} }, Reader: { registerEventListener() {}, unregisterEventListener() {} } },
    Services: {
      dirsvc: { get: () => ({ path: '/Users/tester' }) },
      scriptloader: {
        // Mirrors mozIJSSubScriptLoader: the script's top-level declarations land on `target`.
        loadSubScriptWithOptions(url, options) {
          loads.push({ url, ignoreCache: options.ignoreCache });
          assert.ok(url.startsWith(ROOT_URI), url);
          const name = url.slice(ROOT_URI.length);
          const target = options.target;
          for (const key of ['setTimeout', 'clearTimeout', 'console']) if (!(key in target)) target[key] = globalThis[key];
          vm.runInContext(name === 'core.js' ? coreSource : read(name), vm.createContext(target));
        },
        loadSubScript() { throw new Error('bootstrap.js must not use the cached loadSubScript'); }
      }
    },
    Ci: { nsIFile: {} },
    PathUtils: { tempDir: '/tmp', join: (...parts) => parts.join('/') },
    IOUtils: { stat: async file => { if (file === '/usr/local/bin/codex') return { type: 'regular', permissions: 0o755 }; throw new Error('missing'); } },
    ChromeUtils: { importESModule: () => ({ Subprocess: { pathSearch: async () => { throw new Error('not on PATH'); }, call: async () => fakeCodex() } }) }
  });
  vm.runInContext(read('bootstrap.js'), context);
  const run = code => vm.runInContext(code, context);
  return { run, loads };
}

test(`shipped bootstrap and core agree on the core API${XPI ? ' (built XPI)' : ''}`, () => {
  const used = [...new Set([...read('bootstrap.js').matchAll(/ZOTERO_ASK_CORE\.([A-Za-z_]+)/g)].map(match => match[1]))].sort();
  const zotero = launch();
  const declared = [...zotero.run('ZOTERO_ASK_CORE_API')].sort();
  assert.deepEqual(declared, used, 'ZOTERO_ASK_CORE_API lists exactly what bootstrap.js uses');
  zotero.run(`startup({ rootURI: ${JSON.stringify(ROOT_URI)} })`);
  for (const name of used) assert.notEqual(zotero.run(`typeof ZOTERO_ASK_CORE.${name}`), 'undefined', name);
  assert.deepEqual(zotero.loads, [{ url: `${ROOT_URI}core.js`, ignoreCache: true }]);
  zotero.run('shutdown()');
});

test(`account check and model list work through startup()${XPI ? ' (built XPI)' : ''}`, async () => {
  const zotero = launch();
  zotero.run(`startup({ rootURI: ${JSON.stringify(ROOT_URI)} })`);
  const status = await zotero.run('ZoteroAsk_account().refresh()');
  assert.deepEqual({ state: status.state, canSignOut: status.canSignOut }, { state: 'signed-in', canSignOut: true });
  const models = await zotero.run('ZoteroAsk_getServer().then(server => server.getModels(true))');
  assert.deepEqual([...models].map(model => model.id), ['example-model']);
  zotero.run('shutdown()');
});

test('startup rejects a stale core.js with a clear message', () => {
  const stale = read('core.js').replace(/,\s*redactDiagnostics, withDeadline/, '');
  assert.notEqual(stale, read('core.js'), 'the test removed the newer exports');
  const zotero = launch({ coreSource: stale });
  assert.throws(() => zotero.run(`startup({ rootURI: ${JSON.stringify(ROOT_URI)} })`),
    /Zotero Ask 0\.\d+\.\d+: core\.js is missing redactDiagnostics, withDeadline\. Reinstall Zotero Ask and restart Zotero\./);
});

test('the built XPI renders math with its bundled KaTeX', { skip: !XPI && 'set ZOTERO_ASK_XPI (build.sh does)' }, () => {
  const zotero = launch();
  zotero.run(`startup({ rootURI: ${JSON.stringify(ROOT_URI)} })`);
  assert.match(zotero.run("ZoteroAsk_renderMath('x^2', false)"), /class="katex"/);
  assert.ok(zotero.run('ZoteroAsk_katexCSS()').includes('data:font/woff2;base64,'));
  assert.deepEqual(zotero.loads.map(load => load.ignoreCache), [true, true, true]);
  zotero.run('shutdown()');
});
