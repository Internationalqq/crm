const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function classList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    toggle(name, on) { if (on) values.add(name); else values.delete(name); },
    contains(name) { return values.has(name); },
    values() { return [...values]; },
  };
}

const listeners = new Map();
const frame = {dataset: {}, contentWindow: {}, classList: classList(), addEventListener() {}};
const root = {
  dataset: {}, getAttribute() { return 'https://bot.example'; },
  querySelector(selector) { return selector === '[data-autobot-frame]' ? frame : null; },
  querySelectorAll() { return []; }, addEventListener() {},
};
const body = {classList: classList(), contains(node) { return node === root; }};
const window = {
  location: {href: 'https://crm.example/app/autobot'},
  sessionStorage: {getItem() { return null; }},
  addEventListener(name, handler) { listeners.set(name, handler); },
  removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
  setTimeout() { return 1; }, clearTimeout() {},
};
vm.runInNewContext(fs.readFileSync('frontend/assets/js/autobot.js', 'utf8'), {
  window, document: {body, querySelector() { return root; }}, URL,
});
window.PMBI.autobot.init();
function message(data, source = frame.contentWindow, origin = 'https://bot.example') {
  listeners.get('message')({data, source, origin});
}

// A short page can lose its entire scroll offset when the parent hides its
// header. Scroll notices must never resize the embedded viewport or create
// a feedback loop that returns the user to the top.
for (const scrolled of [true, false, true, true, false]) {
  message({type: 'autobot:scroll', scrolled});
  assert.deepEqual(body.classList.values(), [], 'scrolling must keep the CRM layout stable');
}

// Explicit dialogs still reclaim viewport space; untrusted messages cannot.
message({type: 'autobot:feature-modal', open: true}, {}, 'https://bot.example');
message({type: 'autobot:feature-modal', open: true}, frame.contentWindow, 'https://evil.example');
assert.equal(body.classList.contains('autobot-modal-open'), false);
message({type: 'autobot:feature-modal', open: true});
assert.equal(body.classList.contains('autobot-modal-open'), true);
message({type: 'autobot:scroll', scrolled: false});
assert.equal(body.classList.contains('autobot-modal-open'), true);
message({type: 'autobot:feature-modal', open: false});
assert.equal(body.classList.contains('autobot-modal-open'), false);
message({type: 'autobot:feature-modal', open: true});
window.PMBI.autobot.cleanup();
assert.equal(body.classList.contains('autobot-modal-open'), false);
assert.equal(listeners.has('message'), false);
console.log('autobot_scroll_frontend_ok');
