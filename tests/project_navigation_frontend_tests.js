const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const projectsHtml = read('frontend/pages/projects.html');
const appJs = read('frontend/assets/js/app.js');
const planningJs = read('frontend/assets/js/planning.js');
const procurementJs = read('frontend/assets/js/procurement.js');
const operationsJs = read('frontend/assets/js/operations.js');
const planningCss = read('frontend/assets/css/planning.css');
const scheduleTasksPy = read('backend/schedule_tasks.py');
const serverPy = read('backend/server.py');

assert.match(projectsHtml, /data-tab="schedule">Материалы и Работы</);
assert.match(projectsHtml, /data-tab="calendar">Календарь</);
assert.match(projectsHtml, /data-panel="calendar"/);
assert.doesNotMatch(projectsHtml, /data-tab="(?:materials|works)"/);
assert.doesNotMatch(projectsHtml, /data-panel="(?:materials|works)"/);

assert.match(appJs, /tabName === 'materials' \|\| tabName === 'works'/);
assert.match(appJs, /tabName === 'calendar'.*loadSelectedProjectMaterialSchedule/);
assert.match(appJs, /data-project-quick-tab="schedule"/);
assert.doesNotMatch(appJs, /function ensureProjectWorksTab/);
assert.doesNotMatch(operationsJs, /function ensureProjectWorksSurface/);

assert.match(planningJs, /data-project-schedule-mode="list">По разделам/);
assert.match(planningJs, /data-project-schedule-mode="market">Анализ рынка/);
assert.match(planningJs, /renderProjectMarketBlock\(project\.id, 'material'\)/);
assert.match(planningJs, /renderProjectMarketBlock\(project\.id, 'work'\)/);
assert.match(planningJs, /renderCounterpartyFilter\(project\.id, 'supplier'/);
assert.match(planningJs, /renderCounterpartyFilter\(project\.id, 'contractor'/);
assert.match(planningJs, /renderCounterpartyPicker\(project\.id, item, insight/);
assert.match(planningJs, /return materialRow\(item, project\.id/);
assert.match(planningJs, /var panel = qs\('\[data-panel="calendar"\]'\)/);
assert.match(planningJs, /var schedulePanel = qs\('\[data-panel="schedule"\]'\)/);
assert.match(planningJs, /tab=schedule&materialId=/);

assert.match(procurementJs, /rerenderProjectMaterialAndWorkViews\(projectId\)/);
assert.match(planningCss, /\.project-schedule-counterparty-filters/);
assert.match(planningCss, /\.project-market-analysis-grid/);
assert.match(scheduleTasksPy, /tab=schedule&materialId=/);

for (const route of ['materials-summary', 'material-schedule', 'market-analysis', 'supplier-offers', 'production-schedule']) {
  assert.match(serverPy, new RegExp(route));
}

console.log('project_navigation_frontend_ok');
