const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/app.js'), 'utf8');
function block(name, next) {
    const start = source.indexOf('    function ' + name + '(');
    const end = source.indexOf('    function ' + next + '(', start);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
}

const policySource = block('isProjectTabHidden', 'syncProjectTabVisibility');
function policy(role, finance) {
    return new Function('isGuestRole', 'hasRole', 'canSeeFinances', policySource + '; return isProjectTabHidden;')(
        () => role === 'guest', name => role === name, () => finance,
    );
}
const names = ['overview', 'schedule', 'warehouse-control', 'tasks', 'reports', 'documents', 'finance',
    'calendar', 'production-schedule', 'estimate-reconciliation'];
for (const invalid of ['missing', '', null, '"][data-panel="finance']) {
    assert.equal(policy('admin', true)(invalid), true, 'Unknown URL tabs must fall back before building a selector');
}
assert.deepEqual(names.filter(name => !policy('guest', false)(name)), ['reports', 'production-schedule']);
for (const role of ['admin', 'director', 'foreman', 'customer']) {
    assert.equal(policy(role, false)('finance'), true, role + ' cannot bypass disabled finance access by URL');
    assert.equal(policy(role, true)('finance'), false);
}
assert.equal(policy('customer', false)('warehouse-control'), true);
assert.equal(policy('foreman', false)('warehouse-control'), false);

// The mobile selector gets its labels and permissions from the same tabs, and
// keeps the chosen section when other project data finishes loading.
function node(name) {
    const classes = new Set();
    return { dataset: {tab: name}, textContent: name, hidden: false, attrs: {},
        classList: {toggle(value, enabled) { enabled ? classes.add(value) : classes.delete(value); },
            contains(value) {return classes.has(value);}, remove(value) {classes.delete(value);}},
        setAttribute(name, value) {this.attrs[name] = value;},
    };
}
let role = 'guest';
const tabs = names.map(node);
const panels = names.map(node);
const select = {value:'reports', options:[], replaceChildren(...options) {this.options = options; this.value = '';}};
const qs = selector => selector === '[data-project-section-select]' ? select : null;
const qsa = selector => {
    if (selector === '[data-tab]') return tabs;
    const match = selector.match(/^\[data-(tab|panel)="([^"]+)"\]$/);
    return match ? (match[1] === 'tab' ? tabs : panels).filter(node => node.dataset.tab === match[2]) : [];
};
const sync = new Function('qs', 'qsa', 'isGuestRole', 'isProjectTabHidden', 'canSeeFinances', 'document',
    block('syncProjectTabVisibility', 'bindProjectTabClicks') + '; return syncProjectTabVisibility;')(
    qs, qsa, () => role === 'guest', name => policy(role, false)(name), () => false,
    {createElement() {return {};}}
);
sync({});
assert.deepEqual(select.options.map(option => option.value), ['reports', 'production-schedule']);
assert.equal(select.value, 'reports');
role = 'foreman'; select.value = 'schedule'; sync({});
assert.ok(select.options.some(option => option.value === 'schedule'));
assert.ok(!select.options.some(option => option.value === 'finance'));
assert.equal(select.value, 'schedule');
assert.equal(tabs.find(node => node.dataset.tab === 'finance').attrs['aria-hidden'], 'true');

// Whichever request completes first, a forecast refresh must not detach the hub
// that receives tasks, finance and documents. Test both completion orders.
for (const completed of [false, true]) {
    const hub = {content: completed ? 'loaded data' : 'loading'};
    const cover = {hidden:false, src:'uploaded-photo'};
    const panel = {hub, cover};
    const refresh = new Function('qs', 'safeReplaceChildren', 'renderProjectOverviewHero',
        'refreshLucideIcons', 'bindProjectOverviewActions',
        block('refreshProjectOverviewHeader', 'projectScheduleSummary') + '; return refreshProjectOverviewHeader;')(
        (selector, panel) => selector === '[data-project-hub]' ? panel.hub : panel.cover,
        panel => {
            panel.hub = {replaceWith(node) {panel.hub = node;}};
            panel.cover = {replaceWith(node) {panel.cover = node;}};
        },
        () => 'new header', () => {}, () => {},
    );
    refresh({id:25}, panel);
    if (!completed) hub.content = 'loaded data';
    assert.equal(panel.hub, hub);
    assert.equal(panel.hub.content, 'loaded data');
    assert.equal(panel.cover, cover, 'A late forecast must also preserve the uploaded cover');
}
console.log('Project context: role policy, mobile selection and forecast/hub race passed');
