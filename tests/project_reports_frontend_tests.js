const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const appCss = read('frontend/assets/app.css');
const reportsCss = read('frontend/assets/css/project-reports.css');
const operationsJs = read('frontend/assets/js/operations.js');
const appJs = read('frontend/assets/js/app.js');
const routerJs = read('frontend/assets/js/router.js');

assert.match(appCss, /project-reports\.css\?v=[^"\n]*project-report-modal-1/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-cool-2/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-native-3/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-neutral-4/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-create-plus-5/);
assert.ok(
  appCss.indexOf('project-reports.css') > appCss.indexOf('ui-qa.css'),
  'The reports layer must stay after the shared QA layer in the cascade',
);

for (const selector of [
  '.report-workspace-hero',
  '.report-kpi-grid',
  '.report-workspace-main',
  '.report-calendar-day.is-selected',
  '.report-selected-day-empty',
  '.report-history-entry',
  '.report-extra-fields',
  '.reports-drawer-panel',
  '.reports-drawer-host',
  '.report-modal-scroll',
  '.report-modal-title-icon',
  '.report-form-section',
  '.report-form-preview-section',
  '.report-section-required',
  '.report-create-plus',
]) {
  assert.ok(reportsCss.includes(selector), `Missing reports selector: ${selector}`);
}

for (const breakpoint of ['1180px', '960px', '720px', '520px']) {
  assert.match(reportsCss, new RegExp(`@media \\(max-width: ${breakpoint}\\)`));
}
assert.match(reportsCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(reportsCss, /var\(--color-accent\)/);
assert.match(reportsCss, /var\(--color-danger\)/);
assert.match(reportsCss, /\.reports-drawer-frame\[data-open="1"\] \.reports-drawer-panel\s*\{[^}]*translate\(-50%, -50%\)/s);
assert.match(reportsCss, /\.reports-drawer-frame \.reports-drawer-host\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
assert.match(reportsCss, /\.reports-drawer-frame \.report-modal-scroll\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
assert.match(reportsCss, /height:\s*calc\(100dvh - 16px\) !important/);
const reportModalCss = reportsCss.slice(reportsCss.indexOf('/* Report drawer */'));
assert.ok(reportModalCss.length > 0, 'The report modal layer must exist');
assert.equal(
  /#fff7ed|#fffbeb|#fff4d6|#fef3c7|#fde68a|#fed7aa|\byellow\b|\bamber\b/i.test(reportModalCss),
  false,
  'The report modal must not use warm yellow or amber surfaces',
);
assert.match(reportModalCss, /background:\s*#ffffff !important/);
assert.match(reportModalCss, /\.report-modal-title-icon::before/);
assert.match(reportModalCss, /\.report-field-hint::before/);
assert.match(reportModalCss, /\.report-preview-items \.is-partial\s*\{[^}]*border-color:\s*#bfdbfe !important;[^}]*background:\s*#eff6ff !important/s);

assert.match(operationsJs, /class="project-reports-shell report-workspace"/);
assert.match(operationsJs, /Календарь фиксаций/);
assert.match(operationsJs, /История рапортов/);
assert.match(operationsJs, /data-report-calendar-today/);
assert.match(operationsJs, /data-report-create-selected/);
assert.match(operationsJs, /aria-pressed=/);
assert.match(operationsJs, /<details class="report-extra-fields">/);
assert.match(operationsJs, /role', 'dialog'/);
assert.match(operationsJs, /aria-labelledby', 'project-report-modal-title'/);
assert.match(operationsJs, /data-report-modal-scroll/);
assert.match(operationsJs, /report-form-section report-form-meta-section/);
assert.match(operationsJs, /report-form-section report-form-main-section/);
assert.match(operationsJs, /report-form-section report-form-preview-section/);
assert.match(operationsJs, /report-section-auto/);
assert.match(operationsJs, /report-modal-close-mark/);
assert.match(operationsJs, /report-submit-arrow/);
assert.match(operationsJs, /class="report-create-plus" aria-hidden="true">\+<\/span><span>Новый рапорт<\/span>/);
assert.equal(
  operationsJs.includes('<i data-lucide="plus"></i><span>Новый рапорт</span>'),
  false,
  'The create report button must not depend on an externally loaded plus icon',
);
const reportModalFormStart = operationsJs.lastIndexOf('renderProjectReportForm = function');
const reportModalFormEnd = operationsJs.indexOf('function bindProjectReportsCalendar', reportModalFormStart);
const reportModalFormJs = operationsJs.slice(reportModalFormStart, reportModalFormEnd);
assert.ok(reportModalFormStart > -1 && reportModalFormEnd > reportModalFormStart, 'The modal form override must exist');
assert.equal(
  reportModalFormJs.includes('data-lucide'),
  false,
  'The report modal must not depend on externally loaded icons',
);
assert.match(operationsJs, /name="workers_count" type="number"/);
assert.match(operationsJs, /name="progress_percent" type="number"/);
assert.match(operationsJs, /name="is_client_visible"/);
assert.match(operationsJs, /name="blockers"/);
assert.match(operationsJs, /name="next_steps"/);
assert.match(operationsJs, /data-project-report-delete/);
assert.match(operationsJs, /daily-logs\/' \+ logId \+ '\/delete/);
assert.match(operationsJs, /PMBI\.operations\.renderProjectReportDeleteButton = renderProjectReportDeleteButton/);
assert.match(operationsJs, /PMBI\.operations\.bindProjectReportDeleteActions = bindProjectReportDeleteActions/);

assert.match(appJs, /Текст рапорта:/);
assert.match(appJs, /Распознаны работы:/);
assert.match(appJs, /Распознаны материалы:/);
assert.equal(appJs.includes('Будут обновлены материалы:'), false);

assert.match(routerJs, /operations\.js\?v=[^']*project-report-modal-1/);
assert.match(routerJs, /operations\.js\?v=[^']*report-modal-cool-2/);
assert.match(routerJs, /operations\.js\?v=[^']*report-modal-native-3/);
assert.match(routerJs, /operations\.js\?v=[^']*report-create-plus-5/);

console.log('project_reports_frontend_ok');
