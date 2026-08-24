const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const projectsHtml = read('frontend/pages/projects.html');
const appJs = read('frontend/assets/js/app.js');
const operationsJs = read('frontend/assets/js/operations.js');
const appCss = read('frontend/assets/app.css');
const controlCss = read('frontend/assets/css/object-control.css');

assert.match(appCss, /object-control\.css\?v=20260824-object-control-1/);
assert.match(projectsHtml, /data-tab="overview"[^>]*>[\s\S]*?<span>Главное<\/span>/);
assert.match(projectsHtml, /data-tab="warehouse-control"[^>]*>[\s\S]*?<span>Материалы<\/span>/);
assert.match(projectsHtml, /data-tab="finance"[^>]*>[\s\S]*?<span>Деньги<\/span>/);
assert.match(projectsHtml, /data-project-quick-action="report"/);
assert.match(projectsHtml, /data-project-quick-action="document"/);
assert.match(projectsHtml, /data-project-quick-action="invoice"/);
assert.match(projectsHtml, /data-project-quick-action="task"/);
assert.match(projectsHtml, /data-project-quick-action="material"/);
assert.match(projectsHtml, /class="project-tab-cluster"[\s\S]*?data-tab="documents"[\s\S]*?class="project-more-menu"/);
assert.match(controlCss, /\.project-tab-cluster\s*\{[\s\S]*?gap: 4px/);

assert.match(appJs, /function objectControlFinanceOverviewV3/);
assert.match(appJs, /config\.quickAction === 'invoice' && canSeeFinances\(\)/);
assert.match(appJs, /class="project-command-center"/);
assert.match(appJs, /Что требует решения/);
assert.match(appJs, /Объект настроен на/);
assert.match(appJs, /Смета не сходится с бюджетом/);
assert.match(appJs, /Приход есть, накладной нет/);
assert.match(appJs, /Путевые листы/);
assert.match(appJs, /delivery_note: 'Накладная'/);
assert.match(appJs, /route_sheet: 'Путевой лист'/);
assert.match(appJs, /cash_receipt: 'Кассовый чек'/);
assert.match(appJs, /href="\/app\/projects\?openProject=/);

assert.match(operationsJs, /function runProjectQuickAction/);
assert.match(operationsJs, /refreshProjectOverview\(projectId\)/);
assert.match(operationsJs, /showAppNotice\('Отчет удалён\.'/);
assert.match(operationsJs, /report: \{ tab: 'reports'/);
assert.match(operationsJs, /document: \{ tab: 'documents'/);
assert.match(operationsJs, /invoice: \{ tab: 'finance'/);
assert.match(operationsJs, /task: \{ tab: 'tasks'/);
assert.match(operationsJs, /form\.doc_type\.value = documentType/);

for (const breakpoint of ['1180px', '940px', '720px', '520px']) {
  assert.match(controlCss, new RegExp(`@media \\(max-width: ${breakpoint.replace('.', '\\.')}\\)`));
}
assert.match(controlCss, /@media \(prefers-reduced-motion: reduce\)/);

console.log('object_control_center_frontend_ok');
