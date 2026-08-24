const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const projectsHtml = read('frontend/pages/projects.html');
const appJs = read('frontend/assets/js/app.js');
const planningJs = read('frontend/assets/js/planning.js');
const procurementJs = read('frontend/assets/js/procurement.js');
const procurementCss = read('frontend/assets/css/procurement.css');
const operationsJs = read('frontend/assets/js/operations.js');
const planningCss = read('frontend/assets/css/planning.css');
const scheduleTasksPy = read('backend/schedule_tasks.py');
const serverPy = read('backend/server.py');

assert.match(projectsHtml, /data-tab="schedule"><i data-lucide="hammer"[^>]*><\/i><span>Работы<\/span>/);
assert.match(projectsHtml, /data-tab="calendar"><i data-lucide="calendar-days"[^>]*><\/i><span><b>Календарь<\/b>/);
assert.match(projectsHtml, /data-panel="calendar"/);
assert.doesNotMatch(projectsHtml, /data-tab="(?:materials|works)"/);
assert.doesNotMatch(projectsHtml, /data-panel="(?:materials|works)"/);

const projectTabOrder = [...projectsHtml.matchAll(/<button class="tab(?: active)?" data-tab="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(projectTabOrder, [
  'overview',
  'schedule',
  'warehouse-control',
  'finance',
  'documents',
  'tasks',
  'reports',
  'calendar',
  'production-schedule',
  'estimate-reconciliation',
]);
assert.equal((projectsHtml.match(/<button class="tab(?: active)?" data-tab=/g) || []).length, projectTabOrder.length);
assert.match(projectsHtml, /class="project-add-menu"/);
assert.match(projectsHtml, /class="project-more-menu"/);

assert.match(appJs, /tabName === 'materials' \|\| tabName === 'works'/);
assert.match(appJs, /tabName === 'calendar'.*loadSelectedProjectMaterialSchedule/);
assert.match(appJs, /data-project-quick-tab="schedule"/);
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
