const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/field-intake.js'), 'utf8');

async function mount(role, finance) {
    let requests = 0, invalid;
    const controls = {project: {}, invoice: {}, delivery: {}};
    const form = {
        elements: {namedItem: name => controls[name]},
        querySelector: () => ({}),
        addEventListener(type, fn, capture) {
            if (type === 'invalid') { assert.equal(capture, true); invalid = fn; }
        }
    };
    const panel = {dataset: {event: '1'}, querySelector: () => form, addEventListener() {}};
    const nodes = {'[data-project]': {value: ''}, '[data-state]': {value: 'all'}, '[data-events]': {}, '[data-refresh]': {}};
    const root = {isConnected: true, classList: {add() {}}, querySelector: key => nodes[key], querySelectorAll: () => [panel]};
    const item = {id: 1, title: '<img src=x onerror=alert(1)>', kind: 'receipt', status: 'needs_review',
        event_date: '2026-10-05', project_id: null, location: 'unknown', possible_duplicates: [],
        data: {questions: ['Уточнить объект'], lines: [], fact_quote: 'Металл получен'},
        sources: [{sender_name: '<script>bad</script>', sent_at: 1791445935, text: '<b>Исходный текст</b>',
            media: [{name: '<img>.jpg', view_url: '/api/field-intake/files/1'}]}]};
    const context = {window: {PMBI: {state: {user: {role}}, refreshLucideIcons() {}}},
        fetch: async () => { requests++; return {ok: true, json: async () => ({items: [item], projects: [], can_finance: finance})}; }};
    vm.runInNewContext(source, context);
    await context.window.PMBI.fieldIntake.mount(root, null, 'deliveries');
    return {requests, invalid, html: nodes['[data-events]'].innerHTML};
}

(async () => {
    const admin = await mount('admin', true);
    assert.match(admin.html, /name="invoice"/);
    assert.match(admin.html, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(admin.html, /&lt;b&gt;Исходный текст&lt;\/b&gt;/);
    assert.doesNotMatch(admin.html, /<img src=x/);
    assert.match(admin.html, /href="\/api\/field-intake\/files\/1"/);
    // Invalid required evidence must be revealed before the browser focuses it.
    const extra = {open: false};
    admin.invalid({target: {closest: () => extra}});
    assert.equal(extra.open, true);
    assert.doesNotThrow(() => admin.invalid({target: {closest: () => null}}));
    const foreman = await mount('foreman', false);
    assert.doesNotMatch(foreman.html, /name="invoice"|name="delivery"/);
    assert.match(foreman.html, /Цитаты из сообщения/);
    for (const role of ['guest', 'customer']) assert.equal((await mount(role, false)).requests, 0);
    console.log('field_intake_frontend_ok: evidence, validation reveal, finance visibility, escaping');
})().catch(error => { console.error(error); process.exitCode = 1; });
