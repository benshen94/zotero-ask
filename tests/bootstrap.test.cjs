const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Loads the real bootstrap.js with a fake Zotero Subprocess, fake pipes, and a manual clock, so the
// Codex startup, JSON-RPC, stderr, exit, and timeout paths run without spawning Codex.
const HOME = '/Users/tester';
const SECRETS = 'reader@example.org eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln sk-proj-abcdefghijklmnop Bearer abc123secret';
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };

function manualClock() {
  let now = 0, serial = 0;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { timers.set(++serial, { fn, at: now + (ms || 0) }); return serial; },
    clearTimeout: id => timers.delete(id),
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
      }
      now = target;
    }
  };
}

function fakePipe() {
  const chunks = []; let waiting = null; let ended = false; let failure = null;
  return {
    push(text) { if (waiting) { const resolve = waiting.resolve; waiting = null; resolve(text); } else chunks.push(text); },
    end() { ended = true; if (waiting) { const resolve = waiting.resolve; waiting = null; resolve(''); } },
    fail(reason) { failure = { reason }; if (waiting) { const reject = waiting.reject; waiting = null; reject(reason); } },
    readString() {
      if (chunks.length) return Promise.resolve(chunks.shift());
      if (failure) return Promise.reject(failure.reason);
      if (ended) return Promise.resolve('');
      return new Promise((resolve, reject) => { waiting = { resolve, reject }; });
    }
  };
}

function fakeProcess(respond = () => undefined) {
  let exit;
  const exited = new Promise(resolve => { exit = resolve; });
  const process = {
    stdout: fakePipe(), stderr: fakePipe(), wait: () => exited,
    kill() { exit({ exitCode: null }); },
    exit: code => exit({ exitCode: code }),
    stdin: {
      close() {},
      write(text) {
        for (const line of text.split('\n').filter(Boolean)) {
          const message = JSON.parse(line);
          if (message.id === undefined) continue;
          const result = respond(message);
          if (result !== undefined) process.stdout.push(JSON.stringify({ id: message.id, result }) + '\n');
        }
      }
    }
  };
  return process;
}

function load(call) {
  const clock = manualClock();
  const debug = [];
  const context = vm.createContext({
    console, WeakRef, setImmediate, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    Zotero: { debug: text => debug.push(text), Prefs: { get() {}, set() {} }, Reader: { registerEventListener() {}, unregisterEventListener() {} } },
    Services: { dirsvc: { get: () => ({ path: HOME }) } },
    Ci: { nsIFile: {} },
    PathUtils: { tempDir: '/tmp', join: (...parts) => parts.join('/') },
    IOUtils: { stat: async file => { if (file === '/usr/local/bin/codex') return { type: 'regular', permissions: 0o755 }; throw new Error('missing'); } },
    ChromeUtils: { importESModule: () => ({ Subprocess: { pathSearch: async () => { throw new Error('not on PATH'); }, call } }) }
  });
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'bootstrap.js'), 'utf8'), context);
  vm.runInContext('ZOTERO_ASK_CORE = ZoteroAskCore;', context);
  return { run: code => vm.runInContext(code, context), context, clock, debug };
}

const noSecrets = text => { for (const secret of ['reader@example.org', 'eyJhbGci', 'sk-proj-abc', 'abc123secret', HOME]) assert.ok(!text.includes(secret), `leaked ${secret}`); };

test('an early Codex exit reports its exit code and redacted output', async () => {
  const process = fakeProcess();
  const zotero = load(async () => process);
  const pending = zotero.run('ZoteroAsk_getServer()').catch(error => error);
  await flush();
  process.stderr.push(`env: node: No such file or directory\n${SECRETS} ${HOME}/.codex\n`);
  process.stderr.end();
  process.exit(127);
  await flush();
  const error = await pending;
  assert.match(error.message, /^Codex connection closed\. Codex exited with code 127\. Codex output: env: node: No such file or directory/);
  assert.match(error.message, /~\/\.codex/);
  noSecrets(error.message);
  assert.ok(zotero.debug.some(line => line.startsWith('Zotero Ask could not start Codex: Codex connection closed.')));
  zotero.debug.forEach(noSecrets);
});

test('a silent Codex names the request that timed out', async () => {
  const process = fakeProcess();
  const zotero = load(async () => process);
  const pending = zotero.run('ZoteroAsk_getServer()').catch(error => error);
  await flush();
  process.stderr.push(`still loading ${SECRETS}\n`);
  await flush();
  await zotero.clock.advance(30000);
  const error = await pending;
  assert.match(error.message, /^Codex connection timed out waiting for initialize after 30 s \(\/usr\/local\/bin\/codex\)\. Codex output: still loading/);
  noSecrets(error.message);
});

test('startup that never launches is bounded and names its phase', async () => {
  const zotero = load(() => new Promise(() => {}));
  const pending = zotero.run('ZoteroAsk_getServer()').catch(error => error);
  await flush();
  await zotero.clock.advance(35000);
  assert.match((await pending).message, /^Codex did not finish starting within 35 s \(starting \/usr\/local\/bin\/codex\)\.$/);
});

test('launch failures and reasonless rejections become readable, redacted errors', async () => {
  const failing = load(async () => { throw new Error(`spawn failed in ${HOME}/bin with sk-proj-abcdefghijklmnop`); });
  const launch = await failing.run('ZoteroAsk_getServer()').catch(error => error);
  assert.equal(launch.message, 'Codex could not start (spawn failed in ~/bin with [key]).');

  const process = fakeProcess();
  const zotero = load(async () => process);
  const pending = zotero.run('ZoteroAsk_getServer()').catch(error => error);
  await flush();
  process.stdout.fail(undefined);
  await flush();
  assert.match((await pending).message, /^Codex output could not be read \(no details \(a promise was rejected without a reason\)\)\./);
});

test('account status reaches every live panel, skips dead ones, and survives a failing panel', async () => {
  const process = fakeProcess(message => {
    if (message.method === 'initialize') return {};
    if (message.method === 'account/read') return { account: { type: 'chatgpt', email: 'reader@example.org', planType: 'plus' }, requiresOpenaiAuth: true };
    return undefined;
  });
  const zotero = load(async () => process);
  const stub = () => { const elements = {}; return { isConnected: true, querySelector: selector => (elements[selector] ||= { dataset: {} }) }; };
  // The outer panel lives in the reader page; its content (root) lives in the panel's own document.
  const live = { panel: { isConnected: true }, root: stub(), running: new Map(), authExpired: false };
  const failing = { panel: { isConnected: true }, root: { querySelector() { throw new Error('panel is gone'); } }, running: new Map() };
  const dead = { get panel() { throw new TypeError("can't access dead object"); } };
  zotero.context.testPanels = [live, failing, dead];
  zotero.run('for (const state of testPanels) ZOTERO_ASK_PANELS.add(state);');
  const status = await zotero.run('ZoteroAsk_account().refresh()');
  assert.equal(status.state, 'signed-in');
  assert.equal(live.root.querySelector('.za-account-status').textContent, 'Signed in as reader@example.org · Plus');
  assert.equal(live.root.querySelector('.za-sign-out').hidden, false);
  assert.equal(zotero.run('ZOTERO_ASK_PANELS.size'), 2, 'the dead panel is dropped');
  assert.ok(zotero.debug.some(line => line.startsWith('Zotero Ask could not update a panel: panel is gone')));
});

// A fake app-server that answers requests and lets the test emit turn notifications.
async function startedServer() {
  const requests = [];
  const process = fakeProcess(message => {
    requests.push(message);
    if (message.method === 'initialize') return {};
    if (message.method === 'turn/start') return { turn: { id: 'turn-1' } };
    if (message.method === 'turn/interrupt') return {};
    return undefined;
  });
  const zotero = load(async () => process);
  const server = zotero.run('ZoteroAsk_getServer()');
  await flush();
  zotero.context.server = await server;
  const emit = (method, params) => process.stdout.push(JSON.stringify({ method, params: { threadId: 'thread-1', ...params } }) + '\n');
  return { zotero, emit, requests };
}

test('a long answer keeps streaming past the old 4-minute cap', async () => {
  const { zotero, emit } = await startedServer();
  const answer = zotero.run("server.ask('thread-1', [], { id: 'm' }, 'high', false, () => {})");
  await flush();
  for (let minute = 1; minute <= 12; minute++) {
    await zotero.clock.advance(60000);
    emit('item/agentMessage/delta', { delta: `part ${minute}. ` });
    await flush();
  }
  emit('turn/completed', { turn: { id: 'turn-1', status: 'completed' } });
  await flush();
  const text = await answer;
  assert.match(text, /^part 1\. .*part 12\. $/);
});

test('a silent turn stops after the idle limit and interrupts the right turn', async () => {
  const { zotero, emit, requests } = await startedServer();
  const answer = zotero.run("server.ask('thread-1', [], { id: 'm' }, 'high', false, () => {})").catch(error => error);
  await flush();
  emit('turn/started', { turn: { id: 'turn-1' } });
  await flush();
  await zotero.clock.advance(4 * 60000);
  emit('item/reasoning/summaryTextDelta', { delta: 'still thinking' });
  await flush();
  await zotero.clock.advance(4 * 60000);
  assert.equal(requests.filter(message => message.method === 'turn/interrupt').length, 0, 'reasoning events count as progress');
  await zotero.clock.advance(60000 + 1);
  const error = await answer;
  assert.equal(error.message, 'Codex sent nothing for 5 minutes, so the answer was stopped. Try again.');
  await flush();
  assert.deepEqual(requests.find(message => message.method === 'turn/interrupt').params, { threadId: 'thread-1', turnId: 'turn-1' });
});

test('Codex retries are reported and a final error explains the failed turn', async () => {
  const { zotero, emit } = await startedServer();
  zotero.context.notes = [];
  const answer = zotero.run("server.ask('thread-1', [], { id: 'm' }, 'high', false, () => {}, note => notes.push(note))").catch(error => error);
  await flush();
  emit('error', { willRetry: true, turnId: 'turn-1', error: { message: `stream disconnected for ${HOME} reader@example.org` } });
  await flush();
  assert.deepEqual([...zotero.context.notes], ['Codex is retrying after stream disconnected for ~ [email]']);
  emit('error', { willRetry: false, turnId: 'turn-1', error: { message: 'usage limit reached' } });
  emit('turn/completed', { turn: { id: 'turn-1', status: 'failed' } });
  await flush();
  assert.equal((await answer).message, 'usage limit reached');
});
