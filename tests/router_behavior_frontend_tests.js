const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/router.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

function harness() {
  const scripts = [];
  const requests = [];
  const redirects = [];
  function element(tag) {
    const node = {
      tagName: tag, children: [], dataset: {}, attributes: {}, listeners: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      appendChild(child) { child.parent = this; this.children.push(child); },
      prepend(child) { child.parent = this; this.children.unshift(child); },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      remove() {
        if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
        const index = scripts.indexOf(this);
        if (index >= 0) scripts.splice(index, 1);
      },
      querySelector(selector) {
        if (selector === '[data-route-load-error]') {
          return this.children.find(child => Object.hasOwn(child.attributes, 'data-route-load-error')) || null;
        }
        return null;
      },
    };
    return node;
  }
  const root = element('main');
  root.classList = { toggle() {} };
  const document = {
    body: {dataset: {page: 'dashboard'}},
    head: {appendChild(script) { scripts.push(script); }},
    createElement: element,
    addEventListener() {},
    querySelector(selector) {
      if (selector === 'main.content') return root;
      const match = selector.match(/data-pmbi-script="([^"]+)"/);
      return match ? scripts.find(script => script.dataset.pmbiScript === match[1]) || null : null;
    },
  };
  const location = new URL('http://crm.test/app/dashboard');
  location.assign = href => redirects.push(href);
  const window = {location, addEventListener() {}};
  vm.runInNewContext(source, {
    window, document, location, URL, AbortController,
    console: {error() {}},
    fetch(url, options) {
      return new Promise((resolve, reject) => requests.push({url, options, resolve, reject}));
    },
  });
  return {scripts, requests, redirects, root, router: window.PMBI.router};
}

test('a failed initial script can be retried from the visible error', async () => {
  const app = harness();
  await settle();
  app.scripts[0].onerror();
  await settle();
  assert.equal(app.scripts.length, 0, 'failed script must not masquerade as a loaded module');
  const notice = app.root.querySelector('[data-route-load-error]');
  assert.equal(notice.attributes.role, 'alert');
  const retry = notice.children[1];
  assert.equal(retry.textContent, 'Повторить загрузку');
  retry.listeners.click();
  await settle();
  assert.equal(retry.disabled, true);
  assert.equal(app.scripts.length, 1, 'retry creates a real second request');
  let boots = 0;
  app.router.registerApp(() => { boots += 1; });
  app.scripts[0].onload();
  await settle();
  assert.equal(boots, 1);
  assert.equal(app.root.querySelector('[data-route-load-error]'), null);
  app.router.registerApp(() => { boots += 1; });
  await settle();
  assert.equal(boots, 1, 'concurrent initialization only boots once');
});

test('failed retry stays available without accumulating duplicate notices', async () => {
  const app = harness();
  await settle();
  app.scripts[0].onerror();
  await settle();
  const retry = app.root.children[0].children[1];
  retry.listeners.click();
  await settle();
  app.scripts[0].onerror();
  await settle();
  assert.equal(retry.disabled, false);
  assert.equal(app.root.children.length, 1);
});

test('a superseded navigation failure cannot redirect away from the new route', async () => {
  const app = harness();
  await settle();
  app.scripts[0].onload();
  await settle();
  app.router.navigate(new URL('http://crm.test/app/projects'), true);
  app.router.navigate(new URL('http://crm.test/app/warehouse'), true);
  assert.equal(app.requests[0].options.signal.aborted, true);
  app.requests[0].reject(new Error('late network failure'));
  await settle();
  assert.deepEqual(app.redirects, []);
  app.requests[1].reject(new Error('current network failure'));
  await settle();
  assert.deepEqual(app.redirects, ['http://crm.test/app/warehouse']);
});

test('returning to the current page cancels an unfinished navigation', async () => {
  const app = harness();
  await settle();
  app.router.navigate(new URL('http://crm.test/app/warehouse'), true);
  app.router.navigate(new URL('http://crm.test/app/dashboard'), false);
  assert.equal(app.requests[0].options.signal.aborted, true);
  assert.equal(app.root.attributes['aria-busy'], 'false');
  app.requests[0].reject(new Error('late network failure'));
  await settle();
  assert.deepEqual(app.redirects, []);
});
