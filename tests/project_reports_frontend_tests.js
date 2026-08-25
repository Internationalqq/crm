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
  '.report-voice-button.is-primary',
  '.report-effect-card',
  '.report-effect-check',
  '.report-effects-summary',
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
assert.match(reportsCss, /height:\s*100dvh !important/);
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
assert.match(operationsJs, /typeof PMBI\.isCurrentProject === 'function'/);
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
assert.match(operationsJs, /Отчёт сохранён/);
const finalReportsPanelStart = operationsJs.lastIndexOf('renderProjectReportsPanel = function');
const finalReportsPanelEnd = operationsJs.indexOf('renderProjectReportForm = function', finalReportsPanelStart);
const finalReportsPanelJs = operationsJs.slice(finalReportsPanelStart, finalReportsPanelEnd);
assert.ok(finalReportsPanelStart > -1 && finalReportsPanelEnd > finalReportsPanelStart, 'The final reports panel override must exist');
assert.equal(finalReportsPanelJs.includes('report-create-button'), false, 'The journal must not duplicate the persistent daily-report CTA');
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
assert.match(operationsJs, /client_request_id:\s*clientRequestId/);
assert.match(operationsJs, /confirmed_actions:\s*confirmedActions/);
assert.match(operationsJs, /data-report-only-submit/);
assert.match(operationsJs, /data-report-effect/);
assert.match(operationsJs, /data-report-effect-qty/);
assert.match(operationsJs, /function currentLocalDateIso\(\)/);
assert.match(operationsJs, /form\.dataset\.reportDateTouched/);
assert.match(operationsJs, /data-effect-max/);
assert.match(operationsJs, /function canApplyDailyReportMaterialActions\(\)/);
assert.match(operationsJs, /daily_log_actions_forbidden/);
assert.match(operationsJs, /daily_log_action_qty_exceeds_limit/);
assert.match(operationsJs, /data\.appliedActions/);
assert.match(operationsJs, /delete state\.materialsByProject\[projectId\]/);
assert.match(operationsJs, /PMBI\.warehouseControl\.load\(projectId, true\)/);
assert.match(operationsJs, /daily_log_has_applied_actions/);
assert.match(operationsJs, /report-actions-locked/);
assert.match(operationsJs, /Подтвердить и сохранить/);
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
const finalMaterialMatcherStart = appJs.lastIndexOf('reportMaterialResultFromClause = function');
const finalMaterialMatcherEnd = appJs.indexOf('effectiveMaterialFromReports = function', finalMaterialMatcherStart);
const finalMaterialMatcherJs = appJs.slice(finalMaterialMatcherStart, finalMaterialMatcherEnd);
assert.ok(finalMaterialMatcherStart > -1 && finalMaterialMatcherEnd > finalMaterialMatcherStart, 'The final material speech matcher must exist');
assert.match(finalMaterialMatcherJs, /reportHasReceiptIntent/);
assert.match(finalMaterialMatcherJs, /toOrder/);
assert.match(finalMaterialMatcherJs, /orderedPending/);
assert.doesNotMatch(finalMaterialMatcherJs, /if \(!purchase && !used\) used = true/);
assert.match(appJs, /data-report-effect-qty/);
assert.match(appJs, /Сохранится только отчёт/);
assert.match(appJs, /function buildProjectReportTextFromMatches/);
assert.match(appJs, /function syncReportTextFromEffectQuantities/);
assert.match(appJs, /activeDraft\.text = buildProjectReportTextFromMatches/);
assert.match(appJs, /data-report-preview-text/);
assert.match(appJs, /function startPrimaryReportVoice\(form\)/);
assert.match(appJs, /data-report-voice-unavailable/);
assert.match(appJs, /data-effect-max=/);
assert.match(appJs, /if \(!procurement\.materialId\) return/);
assert.match(appJs, /уже заказано, ждём/);
const legacyReportWord = /\u0440\u0430\u043f\u043e\u0440\u0442/i;
assert.equal(legacyReportWord.test(operationsJs), false, 'Operations UI must consistently use the word Отчет');
assert.equal(legacyReportWord.test(appJs), false, 'App UI must consistently use the word Отчет');
assert.equal(legacyReportWord.test(projectsHtml), false, 'Projects page must consistently use the word Отчёты');
assert.match(projectsHtml, /data-tab="reports"[^>]*>[\s\S]*?<span>Журнал<\/span>/);
assert.match(projectsHtml, /class="project-report-primary"[^>]*data-project-quick-action="report"/);
assert.match(projectsHtml, /class="project-mobile-capture"[\s\S]*?data-project-quick-action="report"/);
assert.match(projectsHtml, /data-project-quick-action="report" data-report-start-voice/);

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
assert.match(routerJs, /operations\.js\?v=[^']*report-load-12/);

console.log('project_reports_frontend_ok');
