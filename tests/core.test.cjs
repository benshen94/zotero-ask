const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

test('narrow questions select the most relevant page and cap visual attachments', () => {
  const pages = [
    { number: 1, text: 'Abstract: This paper studies functional aging in mice.' },
    { number: 2, text: 'Methods: Animals completed a behavioral battery and grip strength test.' },
    { number: 3, text: 'Results: Grip strength declined earlier than locomotor activity.' },
    { number: 4, text: 'Figure 4. Grip strength across age cohorts.' },
    { number: 5, text: 'Discussion: Limitations include male-only mouse cohorts.' }
  ];
  const relevant = core.chooseVisualPages(pages, 'What does the paper say about grip strength?');
  assert.ok(relevant.includes(3));
  assert.ok(relevant.includes(4));
  assert.deepEqual(core.chooseVisualPages(pages, 'Explain Figure 4'), [4]);
  assert.ok(core.chooseVisualPages(pages, 'grip strength', { limit: 1 }).length <= 1);
});

test('model normalization follows the live catalog, preserves new effort levels, and excludes text-only models', () => {
  const models = core.normalizeModels([
    { id: 'new-vision-model', displayName: 'New Vision', inputModalities: ['text', 'image'],
      supportedReasoningEfforts: [{ reasoningEffort: 'minimal' }, { reasoningEffort: 'ultra' }],
      defaultReasoningEffort: 'minimal', additionalSpeedTiers: ['fast'], isDefault: true },
    { id: 'text-only', inputModalities: ['text'], supportedReasoningEfforts: [{ reasoningEffort: 'high' }] },
    { id: 'older-catalog', supportedReasoningEfforts: [] },
    { id: 'hidden-model', hidden: true, supportedReasoningEfforts: [{ reasoningEffort: 'high' }] }
  ]);
  assert.deepEqual(models.map(model => model.id), ['new-vision-model', 'older-catalog']);
  assert.deepEqual(models[0].efforts, ['minimal', 'ultra']);
  assert.equal(models[0].defaultEffort, 'minimal');
  assert.equal(models[0].fast, true);
  assert.deepEqual(models[1].efforts, []);
});

test('broad questions sample across the document and include abstract or conclusion pages', () => {
  const pages = Array.from({ length: 20 }, (_, index) => ({
    number: index + 1,
    text: index === 2 ? 'Abstract of the paper.' : index === 18 ? 'Conclusion and discussion.' : `Page ${index + 1}`
  }));
  const selected = core.chooseVisualPages(pages, 'Summarize the whole paper', { limit: 8 });
  assert.equal(selected.length, 8);
  assert.ok(selected[0] === 1);
  assert.ok(selected.at(-1) === 20);
  assert.ok(selected.includes(3) || selected.includes(19));
});

test('chat persistence normalization drops malformed messages and bounds history', () => {
  const value = core.normalizeChatState({ active: 'missing', chats: [{
    id: 'chat-1', title: '  Paper discussion  ',
    messages: [{ role: 'user', text: 'Question' }, { role: 'system', text: 'bad' }, { role: 'assistant', text: 1 }]
  }] });
  assert.equal(value.active, 'chat-1');
  assert.equal(value.chats[0].title, 'Paper discussion');
  assert.deepEqual(value.chats[0].messages.map(message => message.role), ['user', 'assistant']);
  assert.equal(core.normalizeChatState({ chats: [] }), null);
});

test('new Codex threads receive full paper context, metadata, and prior chat', () => {
  const prompt = core.buildPrompt({
    metadata: 'Shenhar et al. (2026)', pages: [{ number: 7, text: 'The estimate was 0.4.' }],
    question: 'What is the estimate?', selection: { page: 7, text: 'The estimate was 0.4.' },
    history: [{ role: 'user', text: 'Earlier question' }, { role: 'assistant', text: 'Earlier answer' }], includeDocument: true
  });
  assert.match(prompt, /Shenhar et al\. \(2026\)/);
  assert.match(prompt, /\[PDF page 7\]/);
  assert.match(prompt, /Earlier answer/);
  assert.match(prompt, /Current question:/);
});

test('selection popups yield the passage and the page it came from', () => {
  const annotation = { text: '  Grip strength declined earlier.  ', position: { pageIndex: 4, rects: [[1, 2, 3, 4]] } };
  assert.deepEqual(core.selectionFromPopup({ annotation }, 9), { text: 'Grip strength declined earlier.', page: 5 });
  assert.deepEqual(core.selectionFromPopup({ annotation: { text: 'No position' } }, 9), { text: 'No position', page: 9 });
  assert.deepEqual(core.selectionFromPopup({ text: 'Legacy text' }, null), { text: 'Legacy text', page: null });
  assert.equal(core.selectionFromPopup({ annotation: { text: '   ' } }, 3), null);
  assert.equal(core.selectionFromPopup(undefined, 3), null);
});

test('the panel width stays usable for both Ask and the PDF', () => {
  assert.equal(core.clampPanelWidth(390, 1440), 390);
  assert.equal(core.clampPanelWidth(100, 1440), 300);
  assert.equal(core.clampPanelWidth(2000, 1440), 760);
  assert.equal(core.clampPanelWidth(900, 900), 660, 'leaves the PDF at least 240 px');
  assert.equal(core.clampPanelWidth(500, 400), 300, 'never narrower than 300 px');
  assert.equal(core.clampPanelWidth('not a number', 1440), 390);
  assert.equal(core.clampPanelWidth(412.6, 1440), 413);
});
