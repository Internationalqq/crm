const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const projectsHtml = read('frontend/pages/projects.html');
const coreJs = read('frontend/assets/js/core.js');
const appJs = read('frontend/assets/js/app.js');
const planningJs = read('frontend/assets/js/planning.js');
const procurementJs = read('frontend/assets/js/procurement.js');
const procurementCss = read('frontend/assets/css/procurement.css');
const operationsJs = read('frontend/assets/js/operations.js');
const planningCss = read('frontend/assets/css/planning.css');
const scheduleTasksPy = read('backend/schedule_tasks.py');
const serverPy = read('backend/server.py');

assert.match(projectsHtml, /data-tab="schedule"><i data-lucide="hammer"[^>]*><\/i><span>Работы<\/span>/);
assert.match(projectsHtml, /data-tab="calendar"><i data-lucide="calendar-days"[^>]*><\/i><span>Календарь<\/span>/);
assert.match(projectsHtml, /data-tab="reports"><i data-lucide="notebook-tabs"[^>]*><\/i><span>Журнал<\/span>/);
assert.match(projectsHtml, /class="project-report-primary"[^>]*data-project-quick-action="report"/);
assert.match(projectsHtml, /class="project-mobile-capture"[\s\S]*?<span>Отчёт<\/span>/);
assert.match(projectsHtml, /data-panel="calendar"/);
assert.doesNotMatch(projectsHtml, /data-tab="(?:materials|works)"/);
assert.doesNotMatch(projectsHtml, /data-panel="(?:materials|works)"/);

const projectTabOrder = [...projectsHtml.matchAll(/<button class="tab(?: active)?" data-tab="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(projectTabOrder, [
  'overview',
  'schedule',
  'warehouse-control',
  'tasks',
  'reports',
  'documents',
  'finance',
  'calendar',
  'production-schedule',
  'estimate-reconciliation',
]);
assert.equal((projectsHtml.match(/<button class="tab(?: active)?" data-tab=/g) || []).length, projectTabOrder.length);
assert.match(projectsHtml, /class="project-add-menu"/);
assert.doesNotMatch(projectsHtml, /class="project-more-menu"|data-project-more-menu/);
assert.match(projectsHtml, /aria-label="Разделы объекта"/);

assert.match(appJs, /tabName === 'materials' \|\| tabName === 'works'/);
assert.match(appJs, /tabName === 'calendar'.*loadSelectedProjectMaterialSchedule/);
assert.match(appJs, /data-project-quick-tab="schedule"/);
assert.match(appJs, /tab\.setAttribute\('aria-current', 'page'\)/);
assert.match(appJs, /tab\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest', behavior: 'smooth' \}\)/);
assert.match(coreJs, /function bindHorizontalWheelScroll\(scroller\)/);
assert.match(coreJs, /scroller\.scrollWidth <= scroller\.clientWidth \+ 1/);
assert.match(coreJs, /event\.preventDefault\(\);[\s\S]*?scroller\.scrollLeft = next/);
assert.match(coreJs, /\{ passive: false \}/);
assert.match(appJs, /bindHorizontalWheelScroll\(qs\('\.project-tab-cluster > \.tabs', tabsRoot\)\)/);

const horizontalWheelStart = coreJs.indexOf('function bindHorizontalWheelScroll(scroller)');
const horizontalWheelEnd = coreJs.indexOf('\n    function readStoredJson', horizontalWheelStart);
assert.ok(horizontalWheelStart > -1 && horizontalWheelEnd > horizontalWheelStart);
const bindHorizontalWheelScroll = new Function(
  coreJs.slice(horizontalWheelStart, horizontalWheelEnd) + '\nreturn bindHorizontalWheelScroll;',
)();
let wheelHandler = null;
let wheelOptions = null;
let listenerCount = 0;
const fakeScroller = {
  dataset: {},
  scrollWidth: 1000,
  clientWidth: 300,
  scrollLeft: 0,
  addEventListener(type, handler, options) {
    assert.equal(type, 'wheel');
    wheelHandler = handler;
    wheelOptions = options;
    listenerCount += 1;
  },
};
bindHorizontalWheelScroll(fakeScroller);
bindHorizontalWheelScroll(fakeScroller);
assert.equal(listenerCount, 1, 'Wheel scrolling must only be bound once per scroller');
assert.deepEqual(wheelOptions, { passive: false });
let prevented = 0;
const wheelEvent = (overrides = {}) => ({
  defaultPrevented: false,
  ctrlKey: false,
  metaKey: false,
  deltaX: 0,
  deltaY: 120,
  deltaMode: 0,
  preventDefault() { prevented += 1; },
  ...overrides,
});
wheelHandler(wheelEvent());
assert.equal(fakeScroller.scrollLeft, 120);
assert.equal(prevented, 1);
fakeScroller.scrollLeft = 700;
prevented = 0;
wheelHandler(wheelEvent());
assert.equal(fakeScroller.scrollLeft, 700);
assert.equal(prevented, 1, 'At the horizontal edge the wheel must stay captured by the scroller');
fakeScroller.scrollLeft = 100;
wheelHandler(wheelEvent({ deltaX: 90, deltaY: 40 }));
assert.equal(fakeScroller.scrollLeft, 100, 'Native horizontal trackpad gestures must not be converted');
assert.doesNotMatch(appJs, /function ensureProjectWorksTab/);
assert.doesNotMatch(operationsJs, /function ensureProjectWorksSurface/);

assert.match(planningJs, /data-project-schedule-mode="list">По разделам/);
assert.match(planningJs, /data-project-schedule-mode="market">' \+ marketLabel/);
assert.match(planningJs, /var marketLabel = 'Анализ рынка'/);
assert.match(planningJs, /function projectScheduleViewMode\(projectId\) \{\s*if \(hasRole\('customer'\)\) return 'list';/);
assert.match(planningJs, /cache\.status === 'restricted'/);
assert.match(planningJs, /renderProjectMarketBlock\(project\.id, 'work'\)/);
assert.match(planningJs, /renderProjectMarketBlock\(project\.id, 'material'\)/);
assert.doesNotMatch(planningJs, /renderScheduleCounterpartyFilters/);
assert.doesNotMatch(planningJs, /renderCounterpartyPicker\(project\.id, item, insight/);
assert.match(procurementJs, /renderCounterpartyPicker\(projectId, item, insight/);
assert.doesNotMatch(planningJs, /return materialRow\(item, project\.id/);
assert.match(planningJs, /var panel = qs\('\[data-panel="calendar"\]'\)/);
assert.match(planningJs, /var schedulePanel = qs\('\[data-panel="schedule"\]'\)/);
assert.match(planningJs, /tab=warehouse-control&materialId=/);

assert.match(procurementJs, /rerenderProjectMaterialAndWorkViews\(projectId\)/);
assert.match(procurementJs, /row\.enteredPrice/);
assert.match(procurementJs, /row\.marginPercent/);
assert.match(procurementJs, /row\.procurementLimit/);
assert.match(procurementJs, /function formatProcurementLimit/);
assert.match(procurementJs, /data-market-open-finance/);
assert.match(procurementJs, /data-market-price-entry/);
assert.match(appJs, /procurement_limit_exceeded/);
assert.match(appJs, /limit_override_reason/);
assert.match(procurementCss, /\.market-margin-positive/);
assert.match(procurementCss, /\.market-margin-negative/);
assert.match(procurementCss, /\.market-margin-zero/);
assert.match(procurementCss, /\.market-row-limit-exceeded/);
assert.match(procurementCss, /\.procurement-limit-alert/);
assert.match(planningCss, /\.project-schedule-counterparty-filters/);
assert.match(planningCss, /\.project-market-analysis-grid/);
assert.match(scheduleTasksPy, /tab=warehouse-control&materialId=/);

for (const route of ['materials-summary', 'material-schedule', 'market-analysis', 'supplier-offers', 'production-schedule']) {
  assert.match(serverPy, new RegExp(route));
}

console.log('project_navigation_frontend_ok');
