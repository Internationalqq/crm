const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/planning.js'), 'utf8');
function fn(name) {
    const start = source.indexOf('    function ' + name + '(');
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start + 10) + 6);
}
const storage = new Map();
const mutations = [];
const controls = new Map();
const panel = {};
let renders = 0;
const project = {id: 25, title: 'Проверка'};
const schedule = {startDate: '2026-12-28', today: '2027-01-03', dayCount: 35, items: [
    {id: 7, title: 'Монтаж окон', estimateSourceId: 1, estimateTitle: 'Корпус А', sectionTitle: 'Фасад', plannedQty: 12, unit: 'шт.', durationDays: 2, filledSlots: [29,30,31], autoFilledSlots: [29,30,31]},
    {id: 8, title: 'Приёмка бетона', estimateSourceId: 2, estimateTitle: 'Корпус Б', sectionTitle: 'Фундамент', plannedQty: 20, unit: 'м³', durationDays: 1, filledSlots: [1,2]}
]};
const context = {
    state: {currentUser: {id: 1}, selectedProject: project, productionScheduleByProject: {25: schedule}},
    window: {innerWidth: 1280, localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)}},
    qs: selector => selector === '[data-panel="production-schedule"]' ? panel : (controls.get(selector) || [])[0] || null,
    qsa: selector => controls.get(selector) || [],
    hasRole: () => false, isMainAdminRole: () => false,
    escapeHtml: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    quantityText: value => String(value ?? ''),
    quantityPlanInfo: item => ({totalQty: item.plannedQty, unit: item.unit}),
    renderProductionOperationEditor: () => '<aside>editor</aside>',
    renderSelectedProjectProductionSchedule: () => {renders++;},
    bindProductionScheduleScroll: () => {},
    saveProductionScheduleAction: (id, payload) => {mutations.push({id, payload}); return Promise.resolve(schedule);},
    productionPayloadId: Number,
};
vm.createContext(context);
const names = [
    'canEditProductionSchedule', 'productionCalendarStorageKey', 'productionCalendarView', 'setProductionCalendarView',
    'productionCalendarRange', 'productionCalendarSearch', 'bindProductionCalendarControls',
    'productionScheduleIsoDate', 'productionScheduleTodayIso', 'productionScheduleStartDate', 'productionScheduleAddDays',
    'productionScheduleDayMeta', 'productionScheduleMonthGroups', 'productionScheduleViewMode', 'productionScheduleHiddenColumnSet',
    'productionScheduleGroupInfo', 'productionScheduleGroups', 'productionScheduleSectionVolume', 'productionScheduleSectionOverride', 'productionScheduleSectionSummary', 'productionScheduleHealth',
    'productionScheduleDaySet', 'productionOperationId', 'productionLinkedEstimateIds', 'productionOperationMeta',
    'productionScheduleLegendMarkup', 'renderProductionSchedule', 'bindProductionScheduleInteractions'
];
vm.runInContext(names.map(fn).join('\n'), context);
const view = () => context.productionCalendarView(25);
const range = () => context.productionCalendarRange(project, schedule);
const render = () => context.renderProductionSchedule(project, schedule);
function control(selector, dataset = {}, extra = {}) {
    const handlers = {};
    const item = {dataset, handlers, focus() {}, addEventListener: (event, callback) => {handlers[event] = callback;}, ...extra};
    controls.set(selector, [...(controls.get(selector) || []), item]);
    return item;
}

// Navigation is presentation only, including crossing a year and jumping to today.
assert.equal(range().firstDay, 1);
const next = control('[data-production-period-move]', {productionPeriodMove: '1'});
const previous = control('[data-production-period-move]', {productionPeriodMove: '-1'});
const today = control('[data-production-period-jump]', {productionPeriodJump: 'today'});
const start = control('[data-production-period-jump]', {productionPeriodJump: 'start'});
const days = control('[data-production-period-days]', {}, {value: '7'});
const date = control('[data-production-period-date]', {}, {value: '', min: '1900-01-01', max: '2200-12-04'});
const search = control('[data-production-search]', {}, {value: '', selectionStart: 0, setSelectionRange() {}});
const clear = control('[data-production-search-clear]');
const details = control('[data-production-details]');
const firstMenu = control('.production-more-actions, .production-period-picker', {}, {open: true});
const secondMenu = control('.production-more-actions, .production-period-picker', {}, {open: true});
control('summary');
context.bindProductionCalendarControls(25, panel);
firstMenu.handlers.toggle();
assert.equal(secondMenu.open, false, 'only one calendar menu stays open');
firstMenu.handlers.keydown({key: 'Escape', preventDefault() {}});
assert.equal(firstMenu.open, false, 'Escape closes the menu');
next.handlers.click();
assert.equal(range().date, '2027-01-11');
assert.equal(range().firstDay, 15);
previous.handlers.click();
assert.equal(range().date, '2026-12-28');
today.handlers.click();
assert.equal(range().date, '2027-01-03');
assert.equal(range().firstDay, 7);
days.handlers.change();
assert.equal(range().date, '2027-01-03', 'changing scale preserves the viewed date');
assert.equal(range().lastDay, 13);
date.value = '2027-02-29'; date.handlers.change();
assert.equal(view().date, '2027-01-03', 'invalid dates do not change the view');
date.value = '2026-12-27'; date.handlers.change();
assert.equal(range().firstDay, 0);
assert.equal(context.productionScheduleDayMeta(schedule.startDate, 0, schedule.today).iso, '2026-12-27');
assert.match(render(), /вне периода планирования[^>]+disabled/);
start.handlers.click();
assert.equal(range().firstDay, 1);
assert.equal(schedule.startDate, '2026-12-28');
assert.equal(mutations.length, 0);
assert.ok(renders >= 6);

// The rendered second page uses absolute day numbers and preserves half-day fills.
context.setProductionCalendarView(25, {mode: 'works', date: '2027-01-11', days: 14});
let html = render();
const dayButtons = [...html.matchAll(/<button\b[^>]*data-production-day\b[^>]*>/g)].map(match => match[0]);
assert.equal(dayButtons.length, 28, 'only the selected 14-day window is rendered for two works');
assert.match(dayButtons[0], /data-operation-id="7" data-day-number="15"/);
assert.match(dayButtons[0], /is-filled/);
assert.match(dayButtons[1], /is-partial/);
assert.doesNotMatch(html, /data-production-volume data-operation-id/);
details.handlers.click();
assert.match(render(), /data-production-volume data-operation-id="7"/);
const day = control('[data-production-day]', {operationId: '7', dayNumber: '15'}, {
    disabled: false, hasAttribute: () => false, getAttribute: () => 'true'
});
context.bindProductionScheduleInteractions(25);
day.handlers.click();
assert.equal(mutations.length, 1);
assert.equal(mutations[0].payload.day_number, 15);
assert.equal(mutations[0].payload.operation_id, 7);
assert.equal(mutations[0].payload.is_filled, false);
day.disabled = true; day.handlers.click();
assert.equal(mutations.length, 1, 'disabled/out-of-range dates cannot be sent');

// Search accepts words in any order, includes section context, handles ё and blocks partial reorder.
search.value = 'фасад окон'; search.handlers.input();
html = render();
assert.match(html, /Монтаж окон/);
assert.doesNotMatch(html, /Приёмка бетона|data-production-drag-handle/);
assert.equal(context.productionCalendarSearch(schedule.items, 'бетона приемка').length, 1);
search.value = 'нет такой работы'; search.handlers.input();
assert.match(render(), /Работы не найдены/);
clear.handlers.click();
assert.equal(view().query, '');
assert.match(render(), /Приёмка бетона/);

// Preferences survive reopening and are isolated by project/user; search text is not persisted.
context.setProductionCalendarView(25, {date: '2028-02-29', days: 28, mode: 'works', query: 'секретный поиск'});
context.state.productionCalendarByProject = {};
assert.equal(view().date, '2028-02-29');
assert.equal(view().days, 28);
assert.equal(view().details, true);
assert.equal(view().mode, 'works');
assert.equal(view().query, '');
assert.equal(context.productionCalendarView(26).date, '');
context.state.currentUser.id = 2;
assert.equal(view().date, '');
context.state.currentUser = {id: 3, isGuest: true};
context.hasRole = role => role === 'guest';
context.setProductionCalendarView(25, {mode: 'works'});
html = render();
assert.doesNotMatch(html, /data-production-start-date|data-production-edit-operation|data-production-add-operation/);
for (const [button] of html.matchAll(/<button\b[^>]*data-production-day\b[^>]*>/g)) assert.match(button, /disabled/);
context.window.localStorage.getItem = () => {throw new Error('storage unavailable');};
context.window.localStorage.setItem = () => {throw new Error('storage unavailable');};
context.state.productionCalendarByProject = {};
assert.doesNotThrow(() => context.setProductionCalendarView(25, {days: 7}));
console.log('Production calendar: navigation, absolute save days, half-days, search, persistence and read-only access passed');
