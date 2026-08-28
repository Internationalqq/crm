const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appJs = read('frontend/assets/js/app.js');
const operationsJs = read('frontend/assets/js/operations.js');
const projectsHtml = read('frontend/pages/projects.html');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function classList() {
  const values = new Set();
  return {
    add(...names) { names.forEach((name) => values.add(name)); },
    remove(...names) { names.forEach((name) => values.delete(name)); },
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
        return values.has(name);
      }
      if (force) values.add(name);
      else values.delete(name);
      return Boolean(force);
    },
    contains(name) { return values.has(name); },
  };
}

function balancedObject(source, start) {
  assert.equal(source[start], '{', 'Balanced object must start at an opening brace');
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('Unbalanced object literal');
}

function lastFunctionBlock(source, signature) {
  const start = source.lastIndexOf(signature);
  assert.ok(start >= 0, `Missing active function: ${signature}`);
  const brace = source.indexOf('{', start + signature.length);
  return `${signature} ${balancedObject(source, brace)}`;
}

function payloadExpression(functionBlock) {
  const marker = 'body: JSON.stringify(';
  const markerIndex = functionBlock.indexOf(marker);
  assert.ok(markerIndex >= 0, 'Missing JSON request payload');
  const objectStart = functionBlock.indexOf('{', markerIndex + marker.length);
  return balancedObject(functionBlock, objectStart);
}

function field(value) {
  return { value: String(value == null ? '' : value) };
}

test('projects markup exposes four accessible company filters and a required create selector', () => {
  const filterValues = [...projectsHtml.matchAll(/data-project-company-filter-value="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(filterValues, ['all', 'uess', 'pm', 'strategy']);
  for (const value of filterValues) {
    assert.match(projectsHtml, new RegExp(`data-project-company-count="${value}"`));
  }
  assert.match(projectsHtml, /data-project-company-filter role="group" aria-label="[^"]+"/);
  assert.match(projectsHtml, /data-project-company-filter-value="all" aria-pressed="true"/);
  assert.match(
    projectsHtml,
    /<select name="own_legal_entity_id" data-project-own-company required>[\s\S]*?<option value="">(?:Загрузка компаний…|Выберите компанию)<\/option>/,
  );
});

test('active create and edit payloads submit the selected legal entity', () => {
  const createBlock = lastFunctionBlock(operationsJs, 'function bindProjectCreate()');
  const editBlock = lastFunctionBlock(operationsJs, 'function bindProjectEditForm()');
  const createPayload = new Function('form', `return (${payloadExpression(createBlock)});`)({
    title: field('Новый объект'),
    address: field('Адрес'),
    client_name: field('Заказчик'),
    own_legal_entity_id: field('12'),
    contract_no: field('PM-12'),
    budget: field('0'),
    started_at: field('2026-08-01'),
    deadline_at: field('2026-09-01'),
  });
  assert.equal(createPayload.own_legal_entity_id, '12');

  const editPayload = new Function('form', `return (${payloadExpression(editBlock)});`)({
    title: field('Объект после правки'),
    client_name: field('Заказчик'),
    address: field('Адрес'),
    status: field('В работе'),
    contract_no: field('PM-12'),
    own_legal_entity_id: field('13'),
    budget: field('0'),
    started_at: field('2026-08-01'),
    deadline_at: field('2026-09-01'),
  });
  assert.equal(editPayload.own_legal_entity_id, '13');
  const editCardBlock = lastFunctionBlock(operationsJs, 'function ensureProjectEditCard()');
  assert.match(editCardBlock, /<select name="own_legal_entity_id" data-project-own-company>/);

  const openEditBlock = lastFunctionBlock(operationsJs, 'function openProjectEdit(projectId)');
  assert.match(
    openEditBlock,
    /form\.own_legal_entity_id\.value = project\.own_legal_entity_id == null \? '' : String\(project\.own_legal_entity_id\)/,
  );
});

function companyRuntime() {
  const state = {
    projectCompanyFilter: 'all',
    projectCompanies: [
      { id: 101, code: 'uess', name: 'УЭСС' },
      { id: 102, code: 'pm', name: 'ПМ' },
      { id: 103, code: 'strategy', name: 'Стратегия' },
    ],
    companies: [],
    projects: [
      { id: 1, title: 'Школа', address: 'Уфа', client_name: 'А', status: 'В работе', portfolio_company: 'uess', portfolio_company_label: 'УЭСС' },
      { id: 2, title: 'Склад Север', address: 'Пермь', client_name: 'Б', status: 'В работе', portfolio_company: 'pm', portfolio_company_label: 'ПМ' },
      { id: 3, title: 'Склад Юг', address: 'Оренбург', client_name: 'В', status: 'План', portfolio_company: 'strategy', portfolio_company_label: 'Стратегия' },
      { id: 4, title: 'Старый объект', address: 'Челябинск', client_name: 'Г', status: 'В работе', own_legal_entity_id: null },
    ],
  };
  const search = { value: '' };
  const filterRoot = {
    dataset: {},
    listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
  };
  const buttons = ['all', 'uess', 'pm', 'strategy'].map((value) => ({
    value,
    count: { textContent: '' },
    classList: classList(),
    attributes: {},
    getAttribute(name) { return name === 'data-project-company-filter-value' ? value : this.attributes[name]; },
    setAttribute(name, valueToSet) { this.attributes[name] = String(valueToSet); },
  }));
  const ownSelects = [{ value: '', innerHTML: '' }, { value: '102', innerHTML: '' }];
  let rendered = 0;

  function qs(selector, scope) {
    if (selector === '[data-project-company-filter]') return filterRoot;
    if (selector === '[data-project-search]') return search;
    const countMatch = selector.match(/^\[data-project-company-count="([^"]+)"\]$/);
    if (countMatch && scope && scope.value === countMatch[1]) return scope.count;
    return null;
  }
  function qsa(selector, scope) {
    if (selector === '[data-project-company-filter-value]' && scope === filterRoot) return buttons;
    if (selector === '[data-project-own-company]') return ownSelects;
    if (selector === '[data-project-customer-company]') return [];
    return [];
  }

  const optionsStart = appJs.indexOf('var PROJECT_COMPANY_LABELS');
  const optionsEnd = appJs.indexOf('\n    function initDashboardPage()', optionsStart);
  const filterStart = appJs.indexOf('function projectCompanyForProject(project)');
  const filterEnd = appJs.indexOf('function renderProjectList(projects)', filterStart);
  assert.ok(optionsStart >= 0 && optionsEnd > optionsStart, 'Company option block must be extractable');
  assert.ok(filterStart >= 0 && filterEnd > filterStart, 'Company filter block must be extractable');
  const context = {
    state,
    qs,
    qsa,
    escapeHtml: (value) => String(value),
    renderProjectList() { rendered += 1; },
  };
  vm.runInNewContext(
    `${appJs.slice(optionsStart, optionsEnd)}\n${appJs.slice(filterStart, filterEnd)}\nthis.__company = { projectCompanyCode, projectCompanyOptions, populateProjectCompanySelects, projectCompanyForProject, syncProjectCompanyFilter, projectOverviewFilteredProjects, bindProjectCompanyFilter };`,
    context,
    { filename: 'project-company-filter-runtime.js' },
  );
  return { api: context.__company, state, search, filterRoot, buttons, ownSelects, rendered: () => rendered };
}

test('company filters combine with search, keep legacy objects in All, and update counters', () => {
  const runtime = companyRuntime();
  runtime.api.syncProjectCompanyFilter(runtime.state.projects);
  assert.deepEqual(
    Object.fromEntries(runtime.buttons.map((button) => [button.value, button.count.textContent])),
    { all: '4', uess: '1', pm: '1', strategy: '1' },
  );
  assert.equal(runtime.buttons[0].attributes['aria-pressed'], 'true');

  runtime.state.projectCompanyFilter = 'pm';
  assert.deepEqual(
    Array.from(runtime.api.projectOverviewFilteredProjects(runtime.state.projects), (project) => project.id),
    [2],
  );
  runtime.search.value = 'юг';
  assert.deepEqual(Array.from(runtime.api.projectOverviewFilteredProjects(runtime.state.projects)), []);
  runtime.state.projectCompanyFilter = 'strategy';
  assert.deepEqual(
    Array.from(runtime.api.projectOverviewFilteredProjects(runtime.state.projects), (project) => project.id),
    [3],
  );
  runtime.state.projectCompanyFilter = 'all';
  runtime.search.value = '';
  assert.deepEqual(
    Array.from(runtime.api.projectOverviewFilteredProjects(runtime.state.projects), (project) => project.id),
    [1, 2, 3, 4],
  );

  runtime.api.bindProjectCompanyFilter();
  const pmButton = runtime.buttons[2];
  runtime.filterRoot.listeners.click({ target: { closest: () => pmButton } });
  assert.equal(runtime.state.projectCompanyFilter, 'pm');
  assert.equal(runtime.rendered(), 1);
});

test('both create and edit company selectors receive canonical options without losing edit selection', () => {
  const runtime = companyRuntime();
  runtime.api.populateProjectCompanySelects();
  for (const select of runtime.ownSelects) {
    assert.ok(select.innerHTML.indexOf('УЭСС') < select.innerHTML.indexOf('ПМ'));
    assert.ok(select.innerHTML.indexOf('ПМ') < select.innerHTML.indexOf('Стратегия'));
    assert.equal((select.innerHTML.match(/data-project-company-code=/g) || []).length, 3);
  }
  assert.equal(runtime.ownSelects[1].value, '102');
});

function fakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay = 0) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, delay: Number(delay) || 0 });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    run(maxDelay = Infinity) {
      const ready = [...timers.entries()].filter(([, timer]) => timer.delay <= maxDelay);
      ready.forEach(([id]) => timers.delete(id));
      ready.sort((left, right) => left[1].delay - right[1].delay).forEach(([, timer]) => timer.callback());
    },
    delays() { return [...timers.values()].map((timer) => timer.delay); },
  };
}

function fakeIndexedDb() {
  const records = new Map();
  let storeCreated = false;
  const opens = [];

  function transaction() {
    const tx = { oncomplete: null, onerror: null, onabort: null };
    const complete = () => queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
    tx.objectStore = () => ({
      put(record) {
        records.set(record.key, record);
        complete();
      },
      delete(key) {
        records.delete(key);
        complete();
      },
      get(key) {
        const request = { result: null, onsuccess: null, onerror: null };
        queueMicrotask(() => {
          request.result = records.get(key) || null;
          if (request.onsuccess) request.onsuccess();
        });
        return request;
      },
      openCursor() {
        const request = { result: null, onsuccess: null, onerror: null };
        const entries = [...records.entries()];
        let index = 0;
        function advance() {
          queueMicrotask(() => {
            if (index >= entries.length) {
              request.result = null;
              if (request.onsuccess) request.onsuccess();
              complete();
              return;
            }
            const [key, value] = entries[index];
            index += 1;
            request.result = {
              value,
              delete() { records.delete(key); },
              continue: advance,
            };
            if (request.onsuccess) request.onsuccess();
          });
        }
        advance();
        return request;
      },
    });
    return tx;
  }

  const database = {
    objectStoreNames: { contains: () => storeCreated },
    createObjectStore(_name, options) {
      storeCreated = true;
      assert.equal(options && options.keyPath, 'key');
    },
    transaction,
  };

  return {
    records,
    opens,
    open(name, version) {
      opens.push({ name, version });
      const request = { result: database, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        if (!storeCreated && request.onupgradeneeded) request.onupgradeneeded();
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    },
  };
}

function reportForm(projectId = 42) {
  const listeners = {};
  const statusText = { textContent: '' };
  const clearButton = { hidden: true, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } };
  const statusRoot = { classList: classList(), statusText, clearButton };
  const controls = {
    project_id: field(projectId),
    report_date: field('2026-08-26'),
    is_client_visible: field('1'),
    raw_input: { ...field(''), matches: () => false },
    blockers: field(''),
    next_steps: field(''),
    progress_percent: field(''),
  };
  return {
    dataset: {},
    controls,
    listeners,
    statusRoot,
    extra: { open: false },
    _reportPhotoDrafts: [],
    addEventListener(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    emit(type, event = {}) {
      (listeners[type] || []).forEach((handler) => handler({ target: controls.raw_input, ...event }));
    },
    hasAttribute(name) { return name === 'data-report-draft-form'; },
    reset() { Object.values(controls).forEach((control) => { if (control !== controls.project_id) control.value = ''; }); },
  };
}

function draftRuntime() {
  const timers = fakeTimers();
  const indexedDB = fakeIndexedDb();
  const localValues = new Map();
  const localCalls = [];
  const windowListeners = {};
  const documentListeners = {};
  let activeForms = [];
  const state = { currentUser: { id: 7 }, user: { id: 7 } };
  const document = {
    body: { dataset: {} },
    visibilityState: 'visible',
    addEventListener(type, handler) {
      if (!documentListeners[type]) documentListeners[type] = [];
      documentListeners[type].push(handler);
    },
  };
  const window = {
    indexedDB,
    localStorage: {
      getItem(key) { return localValues.has(key) ? localValues.get(key) : null; },
      setItem(key, value) { localCalls.push(['set', key]); localValues.set(key, String(value)); },
      removeItem(key) { localCalls.push(['remove', key]); localValues.delete(key); },
    },
    confirm: () => true,
    addEventListener(type, handler) {
      if (!windowListeners[type]) windowListeners[type] = [];
      windowListeners[type].push(handler);
    },
  };

  function qs(selector, scope) {
    if (selector === '[data-report-draft-status]' && scope && scope.statusRoot) return scope.statusRoot;
    if (selector === '[data-report-draft-status-text]' && scope && scope.statusText) return scope.statusText;
    if (selector === '[data-report-draft-clear]' && scope && scope.clearButton) return scope.clearButton;
    if (selector === '.report-extra-fields' && scope && scope.extra) return scope.extra;
    if (selector === '[data-report-resource-label]' && scope) return scope.label || null;
    if (selector === '[data-report-resource-count]' && scope) return scope.count || null;
    if (selector === '[data-report-resource-hours]' && scope) return scope.hours || null;
    return null;
  }
  function qsa(selector) {
    if (selector === '[data-report-draft-form]') return activeForms;
    return [];
  }
  function reportFormControl(form, name) { return form.controls[name] || null; }
  function reportResourceRows(form, kind) { return (form.resources && form.resources[kind]) || []; }
  function reportPhotoDrafts(form) {
    if (!Array.isArray(form._reportPhotoDrafts)) form._reportPhotoDrafts = [];
    return form._reportPhotoDrafts;
  }

  const start = operationsJs.indexOf('var REPORT_DRAFT_VERSION');
  const end = operationsJs.indexOf('function reportPhotoDrafts(form)', start);
  assert.ok(start >= 0 && end > start, 'Report draft persistence block must be extractable');
  const context = {
    state,
    window,
    document,
    qs,
    qsa,
    reportFormControl,
    reportResourceRows,
    reportPhotoDrafts,
    reportResourceRowHtml: () => '',
    syncReportResourceSummary() {},
    clearReportPhotoDrafts(form) { form._reportPhotoDrafts = []; },
    renderReportPhotoDrafts() {},
    setReportPhotoRetryMode() {},
    currentLocalDateIso: () => '2026-08-26',
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    Event: function Event(type, options) { this.type = type; this.bubbles = Boolean(options && options.bubbles); },
    URL: { createObjectURL: () => 'blob:restored', revokeObjectURL() {} },
    console,
  };
  vm.runInNewContext(
    `${operationsJs.slice(start, end)}\nthis.__draft = { reportDraftStorageKey, serializeReportDraft, reportDraftIsMeaningful, readReportDraft, saveReportDraftNow, scheduleReportDraftSave, openReportDraftPhotoDb, writeReportDraftPhotoRecord, readReportDraftPhoto, deleteReportDraftPhoto, clearReportDraftPhotoStorage, clearReportDraft, restoreReportDraft, bindReportDraftPersistence, flushReportDrafts, disposeReportDraftForm };`,
    context,
    { filename: 'report-draft-runtime.js' },
  );
  return {
    api: context.__draft,
    state,
    timers,
    indexedDB,
    localValues,
    localCalls,
    windowListeners,
    documentListeners,
    document,
    setForms(forms) { activeForms = forms; },
  };
}

async function drainMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test('report draft JSON is scoped by user/project and includes manual preview state', () => {
  const runtime = draftRuntime();
  const form = reportForm(42);
  form.controls.raw_input.value = 'Смонтировали стены и приняли кабель';
  form._reportPreviewDraftController = {
    serialize: () => ({
      manualSelections: [{ key: 'work:5', kind: 'work', item: { id: 5, title: 'Стены' } }],
      effectOverrides: [{ actionType: 'material_receipt', itemId: 8, checked: true, qty: 40 }],
    }),
  };
  const snapshot = runtime.api.serializeReportDraft(form);
  assert.equal(snapshot.ownerId, '7');
  assert.equal(snapshot.projectId, 42);
  assert.equal(snapshot.assistant.manualSelections[0].key, 'work:5');
  assert.equal(snapshot.assistant.effectOverrides[0].qty, 40);
  assert.equal(runtime.api.reportDraftIsMeaningful(snapshot), true);
  assert.equal(runtime.api.saveReportDraftNow(form), true);
  const key = 'pmbi.daily-report-draft.v2:u:7:p:42';
  assert.ok(runtime.localValues.has(key));

  runtime.state.currentUser.id = 8;
  assert.equal(runtime.api.readReportDraft(form), null);
  assert.equal(runtime.api.reportDraftStorageKey(form), 'pmbi.daily-report-draft.v2:u:8:p:42');
});

test('autosave debounces input, flushes on pagehide/hidden, and binds lifecycle once', () => {
  const runtime = draftRuntime();
  const first = reportForm(51);
  const second = reportForm(52);
  runtime.setForms([first, second]);
  runtime.api.bindReportDraftPersistence(first);
  runtime.api.bindReportDraftPersistence(second);
  assert.equal(runtime.windowListeners.pagehide.length, 1);
  assert.equal(runtime.documentListeners.visibilitychange.length, 1);

  first.controls.raw_input.value = 'Первый ввод';
  first.emit('input');
  assert.ok(runtime.timers.delays().includes(350));
  assert.equal(runtime.localValues.has('pmbi.daily-report-draft.v2:u:7:p:51'), false);
  runtime.timers.run(350);
  assert.equal(runtime.localValues.has('pmbi.daily-report-draft.v2:u:7:p:51'), true);

  first.controls.raw_input.value = 'Перед уходом';
  runtime.windowListeners.pagehide[0]();
  assert.equal(JSON.parse(runtime.localValues.get('pmbi.daily-report-draft.v2:u:7:p:51')).rawInput, 'Перед уходом');

  second.controls.raw_input.value = 'Скрыли вкладку';
  runtime.document.visibilityState = 'hidden';
  runtime.documentListeners.visibilitychange[0]();
  assert.equal(JSON.parse(runtime.localValues.get('pmbi.daily-report-draft.v2:u:7:p:52')).rawInput, 'Скрыли вкладку');
});

test('IndexedDB persists photo blobs under the draft key and supports read/delete/clear', async () => {
  const runtime = draftRuntime();
  const draftKey = 'pmbi.daily-report-draft.v2:u:7:p:60';
  const blob = { type: 'image/webp', size: 1234 };
  const draft = { id: 'photo-a', name: 'a.webp', removed: false };
  assert.equal(await runtime.api.writeReportDraftPhotoRecord(draftKey, draft, blob), true);
  assert.deepEqual(runtime.indexedDB.opens, [{ name: 'pmbi-report-draft-photos', version: 1 }]);
  const restored = await runtime.api.readReportDraftPhoto(draftKey, 'photo-a');
  assert.equal(restored.blob, blob);

  await runtime.api.writeReportDraftPhotoRecord('other-draft', { id: 'photo-b', name: 'b.webp' }, blob);
  await runtime.api.clearReportDraftPhotoStorage(draftKey);
  assert.equal(runtime.indexedDB.records.has(`${draftKey}:photo:photo-a`), false);
  assert.equal(runtime.indexedDB.records.has('other-draft:photo:photo-b'), true);

  const deleteForm = reportForm(61);
  const deleteKey = runtime.api.reportDraftStorageKey(deleteForm);
  const deleteDraft = { id: 'photo-c', name: 'c.webp' };
  await runtime.api.writeReportDraftPhotoRecord(deleteKey, deleteDraft, blob);
  await runtime.api.deleteReportDraftPhoto(deleteForm, deleteDraft);
  assert.equal(runtime.indexedDB.records.has(`${deleteKey}:photo:photo-c`), false);
});

test('restore feeds the saved assistant snapshot into the manual preview controller', async () => {
  const runtime = draftRuntime();
  const source = reportForm(70);
  source.controls.raw_input.value = 'Заказали двери';
  const assistant = {
    manualSelections: [{ key: 'material:10', kind: 'material', item: { id: 10, title: 'Двери' } }],
    effectOverrides: [{ actionType: 'material_purchase', itemId: 10, checked: true, qty: 4 }],
  };
  source._reportPreviewDraftController = { serialize: () => assistant };
  runtime.api.saveReportDraftNow(source);

  const restoredForm = reportForm(70);
  let restoredAssistant = null;
  restoredForm._reportPreviewDraftController = {
    serialize: () => ({ manualSelections: [], effectOverrides: [] }),
    restore(value) { restoredAssistant = value; },
  };
  runtime.api.restoreReportDraft(restoredForm);
  runtime.timers.run(0);
  await drainMicrotasks();
  assert.equal(restoredForm.controls.raw_input.value, 'Заказали двери');
  assert.deepEqual(JSON.parse(JSON.stringify(restoredAssistant)), assistant);
  assert.equal(restoredForm.dataset.reportDraftRestored, '1');
});

test('clear removes text and photo storage, while submit clears only after complete success', async () => {
  const runtime = draftRuntime();
  const form = reportForm(80);
  form.controls.raw_input.value = 'Готовый отчёт';
  form.dataset.clientRequestId = 'request-80';
  form.dataset.savedDailyLogId = '900';
  runtime.api.saveReportDraftNow(form);
  const key = runtime.api.reportDraftStorageKey(form);
  await runtime.api.writeReportDraftPhotoRecord(key, { id: 'photo-80', name: 'photo.webp' }, { type: 'image/webp', size: 10 });
  runtime.api.clearReportDraft(form);
  await drainMicrotasks();
  assert.equal(runtime.localValues.has(key), false);
  assert.equal(runtime.indexedDB.records.has(`${key}:photo:photo-80`), false);
  assert.equal(form.dataset.clientRequestId, undefined);
  assert.equal(form.dataset.savedDailyLogId, undefined);

  const bindLogBlock = lastFunctionBlock(operationsJs, 'function bindLogForm()');
  assert.match(bindLogBlock, /if \(!failedPhotos\) \{[\s\S]*?clearReportDraft\(form\);[\s\S]*?form\.reset\(\)/);
  assert.match(bindLogBlock, /if \(failedPhotos\) \{[\s\S]*?Отчёт сохранён, но не загрузилось фото/);
  assert.match(bindLogBlock, /\.catch\(function \(err\) \{[\s\S]*?saveReportDraftNow\(form\)/);
});

test('manual preview implementation exposes serialize/restore controller and emits draft changes', () => {
  const start = appJs.indexOf('bindReportPreview = function ()');
  const end = appJs.indexOf('\n    };', start);
  assert.ok(start >= 0 && end > start, 'Active report preview controller must be extractable');
  const block = appJs.slice(start, end + 7);
  assert.match(block, /form\._reportPreviewDraftController = \{[\s\S]*?serialize: reportPreviewDraftSnapshot,[\s\S]*?restore: restoreReportPreviewDraft,[\s\S]*?refresh: refreshPreview/);
  assert.match(block, /manualSelections:[\s\S]*?effectOverrides:/);
  assert.match(block, /pmbi:report-draft-changed/);
  assert.match(block, /data-report-suggestion-remove/);
  assert.match(block, /refreshPreview\(\{ skipCapture: true \}\)/);
  assert.match(block, /if \(!options \|\| options\.skipCapture !== true\) captureEffectOverrides\(\)/);
});

test('ambiguous submissions replay the frozen payload and lock editing until reconciliation', () => {
  const bindLogBlock = lastFunctionBlock(operationsJs, 'function bindLogForm()');
  assert.match(bindLogBlock, /recoveredSubmissionPayload = !savedDailyLogIdBeforeSubmit[\s\S]*?form\._reportDraftSubmitPayload/);
  assert.match(bindLogBlock, /reportPayload = Object\.assign\(\{\}, recoveringSubmission \? recoveredSubmissionPayload : freshReportPayload\)/);
  assert.match(bindLogBlock, /delete reportPayload\.progress_percent/);
  assert.match(bindLogBlock, /delete reportPayload\.progressPercent/);
  assert.match(bindLogBlock, /body: JSON\.stringify\(reportPayload\)/);
  assert.match(bindLogBlock, /definitiveRejection = responseStatus >= 400 && responseStatus < 500/);
  assert.match(bindLogBlock, /form\._reportDraftPhase = 'submitting';[\s\S]*?setReportSubmissionRecoveryMode\(form, true, 'Проверить отправку'\)/);
  assert.match(operationsJs, /setReportDraftRestoringMode\(form, true\)/);
  assert.match(operationsJs, /form\.dataset\.reportDraftRestored = '1'/);
});

test('route disposal preserves in-flight photo storage while explicit clear cancels it', () => {
  const disposeBlock = lastFunctionBlock(operationsJs, 'function disposeReportDraftForm(form)');
  assert.match(disposeBlock, /draft\.detached = true/);
  assert.doesNotMatch(disposeBlock, /draft\.removed = true/);
  const clearPhotosBlock = lastFunctionBlock(operationsJs, 'function clearReportPhotoDrafts(form)');
  assert.match(clearPhotosBlock, /draft\.removed = true/);
  assert.match(operationsJs, /readReportDraftPhotoWithRetry\(draftKey, item\.id, 4\)/);
});

test('draft source contract includes localStorage, IndexedDB, lifecycle hooks, and draft-enabled form markup', () => {
  assert.match(operationsJs, /REPORT_DRAFT_STORAGE_PREFIX = 'pmbi\.daily-report-draft\.v2'/);
  assert.match(operationsJs, /REPORT_DRAFT_PHOTO_DB = 'pmbi-report-draft-photos'/);
  assert.match(operationsJs, /window\.localStorage\.setItem\(key, JSON\.stringify\(snapshot\)\)/);
  assert.match(operationsJs, /window\.indexedDB\.open\(REPORT_DRAFT_PHOTO_DB, 1\)/);
  assert.match(operationsJs, /createObjectStore\(REPORT_DRAFT_PHOTO_STORE, \{ keyPath: 'key' \}\)/);
  assert.match(operationsJs, /window\.addEventListener\('pagehide', flushReportDrafts\)/);
  assert.match(operationsJs, /document\.visibilityState === 'hidden'/);
  assert.match(operationsJs, /data-log-form data-report-draft-form novalidate/);
  assert.match(operationsJs, /data-report-draft-status-text>Черновик будет сохраняться автоматически/);
});

(async () => {
  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      process.exitCode = 1;
      console.error(`not ok - ${entry.name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }
  if (!process.exitCode) console.log('project_draft_company_frontend_ok');
})();
