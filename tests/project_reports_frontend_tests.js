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
const projectsHtml = read('frontend/pages/projects.html');

assert.match(appCss, /project-reports\.css\?v=[^"\n]*project-report-modal-1/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-cool-2/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-native-3/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-neutral-4/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-create-plus-5/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-refresh-8/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-calendar-9/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-calendar-apple-10/);
assert.ok(
  appCss.indexOf('project-reports.css') > appCss.indexOf('ui-qa.css'),
  'The reports layer must stay after the shared QA layer in the cascade',
);

for (const selector of [
  '.report-workspace-hero',
  '.report-kpi-grid',
  '.report-workspace-main',
  '.report-calendar-day.is-selected',
  '.report-calendar-month-copy',
  '.report-calendar-controls',
  '.report-calendar-report-count',
  '.report-calendar-risk',
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
  '.report-confirm-ready-mark',
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
assert.match(operationsJs, /Календарь отчетов/);
assert.match(operationsJs, /История отчетов/);
assert.match(operationsJs, /data-report-calendar-today/);
assert.match(operationsJs, /data-report-create-selected/);
assert.match(operationsJs, /aria-pressed=/);
assert.match(operationsJs, /aria-current="date"/);
assert.match(operationsJs, /projectReportCalendarCountLabel/);
assert.match(operationsJs, /class="report-calendar-month-copy"/);
assert.match(operationsJs, /class="report-calendar-nav-mark"/);
assert.match(operationsJs, /classes\.push\('is-weekend'\)/);
const reportsPanelStart = operationsJs.lastIndexOf('renderProjectReportsPanel = function');
const reportsPanelEnd = operationsJs.indexOf('renderProjectReportForm = function', reportsPanelStart);
const reportsPanelJs = operationsJs.slice(reportsPanelStart, reportsPanelEnd);
assert.ok(reportsPanelStart > -1 && reportsPanelEnd > reportsPanelStart, 'The reports panel override must exist');
assert.ok(
  reportsPanelJs.indexOf('report-selected-day-pane') < reportsPanelJs.indexOf('report-calendar-pane'),
  'Selected-day information must stay to the left of the calendar',
);
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
assert.match(operationsJs, /data-log-form novalidate/);
assert.match(operationsJs, /form\.elements\.namedItem\(name\)/);
assert.match(operationsJs, /reportTitle = '\\u041e\\u0442\\u0447\\u0435\\u0442 \\u0437\\u0430 ' \+ selectedDate/);
assert.match(operationsJs, /showAppNotice\('\\u041e\\u0442\\u0447\\u0435\\u0442 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0451\\u043d\.', 'success'\)/);
assert.match(operationsJs, /class="report-create-plus" aria-hidden="true">\+<\/span><span>Новый отчет<\/span>/);
assert.equal(
  operationsJs.includes('<i data-lucide="plus"></i><span>Новый отчет</span>'),
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
const reportCalendarStart = operationsJs.lastIndexOf('renderLogsCalendar = function');
const reportCalendarEnd = operationsJs.indexOf('renderLogsDayView = function', reportCalendarStart);
const reportCalendarJs = operationsJs.slice(reportCalendarStart, reportCalendarEnd);
assert.ok(reportCalendarStart > -1 && reportCalendarEnd > reportCalendarStart, 'The calendar override must exist');
assert.equal(
  reportCalendarJs.includes('data-lucide'),
  false,
  'Calendar navigation must not depend on externally loaded icons',
);
assert.equal(reportModalFormJs.includes('name="confirm_report"'), false, 'Saving an object report must not be blocked by a confirmation checkbox');
assert.match(operationsJs, /if \(data && data\.log\)/);
assert.match(operationsJs, /state\.projectLogsByProject\[projectId\] = updatedLogs/);
assert.match(operationsJs, /name="workers_count" type="number"/);
assert.match(operationsJs, /name="progress_percent" type="number"/);
assert.match(operationsJs, /name="is_client_visible"/);
assert.match(operationsJs, /name="blockers"/);
assert.match(operationsJs, /name="next_steps"/);
assert.match(operationsJs, /data-project-report-delete/);
assert.match(operationsJs, /daily-logs\/' \+ logId \+ '\/delete/);
assert.match(operationsJs, /PMBI\.operations\.renderProjectReportDeleteButton = renderProjectReportDeleteButton/);
assert.match(operationsJs, /PMBI\.operations\.bindProjectReportDeleteActions = bindProjectReportDeleteActions/);

assert.match(appJs, /Текст отчета:/);
assert.equal(appJs.includes('function loadProjectLogs() {}'), false, 'Project log loading must not be an empty placeholder');
assert.match(appJs, /function loadProjectLogs\(projectId, callback\)\s*\{[^}]*api\('\/api\/projects\/' \+ projectId \+ '\/daily-logs'\)/s);
assert.match(appJs, /refreshProjectReportsTab = function \(\) \{ return operationsCall\('refreshProjectReportsTab', arguments\); \};/);
assert.match(appJs, /Распознаны работы:/);
assert.match(appJs, /Распознаны материалы:/);
assert.equal(appJs.includes('Будут обновлены материалы:'), false);
const legacyReportWord = /\u0440\u0430\u043f\u043e\u0440\u0442/i;
assert.equal(legacyReportWord.test(operationsJs), false, 'Operations UI must consistently use the word Отчет');
assert.equal(legacyReportWord.test(appJs), false, 'App UI must consistently use the word Отчет');
assert.equal(legacyReportWord.test(projectsHtml), false, 'Projects page must consistently use the word Отчеты');
assert.match(projectsHtml, />Отчеты<\/b>/);

assert.match(routerJs, /operations\.js\?v=[^']*project-report-modal-1/);
assert.match(routerJs, /operations\.js\?v=[^']*report-modal-cool-2/);
assert.match(routerJs, /operations\.js\?v=[^']*report-modal-native-3/);
assert.match(routerJs, /operations\.js\?v=[^']*report-create-plus-5/);
assert.match(routerJs, /operations\.js\?v=[^']*report-submit-fix-6/);
assert.match(routerJs, /operations\.js\?v=[^']*reports-wording-7/);
assert.match(routerJs, /app\.js\?v=[^']*reports-wording-7/);
assert.match(routerJs, /operations\.js\?v=[^']*report-refresh-8/);
assert.match(routerJs, /app\.js\?v=[^']*report-refresh-8/);
assert.match(routerJs, /operations\.js\?v=[^']*report-calendar-9/);
assert.match(routerJs, /operations\.js\?v=[^']*report-calendar-apple-10/);
assert.match(routerJs, /app\.js\?v=[^']*report-calendar-bridge-11/);

console.log('project_reports_frontend_ok');
