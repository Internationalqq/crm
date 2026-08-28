const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const planningJs = read('frontend/assets/js/planning.js');
const projectsCss = read('frontend/assets/css/ui-projects.css');
const appCss = read('frontend/assets/app.css');
const baseHtml = read('frontend/templates/base.html');
const loginHtml = read('frontend/templates/login.html');

assert.match(planningJs, /var heading = mode === 'list' \? 'Работы' : 'Материалы и работы'/);
assert.match(planningJs, /var marketLabel = 'Анализ рынка'/);
assert.match(planningJs, /Работы по разделам сметы с фактическим прогрессом/);
assert.match(planningJs, /renderProjectMarketBlock\(project\.id, 'material'\)/);
assert.match(planningJs, /renderProjectMarketBlock\(project\.id, 'work'\)/);

const schedulePanelStart = planningJs.indexOf('function renderSchedulePanel');
const calendarPanelStart = planningJs.indexOf('function renderProjectCalendarPanel', schedulePanelStart);
const schedulePanelBlock = planningJs.slice(schedulePanelStart, calendarPanelStart);
const calendarPanelBlock = planningJs.slice(
  calendarPanelStart,
  planningJs.indexOf('function ensureProjectScheduleMarketAnalysis', calendarPanelStart),
);
const schedulePageDetailsStart = planningJs.indexOf('function renderScheduleProjectDetails');
const schedulePageDetailsBlock = planningJs.slice(
  schedulePageDetailsStart,
  planningJs.indexOf('function renderScheduleProjectCard', schedulePageDetailsStart),
);
assert.doesNotMatch(schedulePanelBlock, /data-auto-schedule-open|renderAutoScheduleDrawer/);
assert.doesNotMatch(schedulePanelBlock, /schedule-project-topbar|schedule-project-topbar-copy/);
assert.doesNotMatch(schedulePageDetailsBlock, /schedule-project-topbar|schedule-project-topbar-copy/);
assert.match(schedulePageDetailsBlock, /schedule-project-actions/);
assert.match(calendarPanelBlock, /renderAutoScheduleDrawer\(project\)/);
assert.match(calendarPanelBlock, /data-auto-schedule-open/);
assert.match(calendarPanelBlock, /data-lucide="calendar-cog"/);
assert.match(planningJs, /openProject\(activeProjectId\);\s*activateProjectTab\('calendar'\)/);
assert.match(planningJs, /function loadSelectedProjectMaterialSchedule[\s\S]*?bindAutoScheduleForm\(projectId\)/);

const detailsMarkupStart = planningJs.indexOf('var details =');
const detailsMarkup = planningJs.slice(
  detailsMarkupStart,
  planningJs.indexOf("return '<article class=\"section-schedule-card", detailsMarkupStart),
);
assert.match(detailsMarkup, /section-schedule-detail-grid is-work-only/);
assert.match(detailsMarkup, /\\u0420\\u0430\\u0431\\u043e\\u0442\\u044b/);
assert.doesNotMatch(detailsMarkup, /\\u041c\\u0430\\u0442\\u0435\\u0440\\u0438\\u0430\\u043b\\u044b/);
assert.doesNotMatch(detailsMarkup, /materialProgress|materialRow/);

const worksRowStart = planningJs.indexOf('function renderSectionScheduleRow');
const worksForecastStart = planningJs.indexOf('function renderSectionScheduleForecast', worksRowStart);
const worksForecastEnd = planningJs.indexOf('function bindSectionScheduleRefresh', worksForecastStart);
const worksRowBlock = planningJs.slice(worksRowStart, worksForecastStart);
const worksForecastBlock = planningJs.slice(worksForecastStart, worksForecastEnd);
const visibleWorksRegister = worksRowBlock + worksForecastBlock;
for (const removedVisibleToken of [
  'data-graph-duration-editor',
  'data-graph-duration-input',
  'data-graph-duration-reset',
  'schedule-work-duration-metrics',
  'Авторасчёт',
  'Длительность',
  'Срок работ',
  'Осталось',
  '\\u0410\\u0432\\u0442\\u043e\\u0440\\u0430\\u0441\\u0447\\u0451\\u0442',
  '\\u0414\\u043b\\u0438\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u044c',
]) {
  assert.equal(
    visibleWorksRegister.includes(removedVisibleToken),
    false,
    `Visible works register still contains removed planning field: ${removedVisibleToken}`,
  );
}

const worksSummaryStart = worksForecastBlock.indexOf('works-register-summary');
const worksSummaryEnd = worksForecastBlock.indexOf('renderPinnedScheduleBrief', worksSummaryStart);
const worksSummaryBlock = worksForecastBlock.slice(worksSummaryStart, worksSummaryEnd);
assert.equal((worksSummaryBlock.match(/works-register-summary-item/g) || []).length, 4);
assert.match(worksSummaryBlock, /<span>Разделов<\/span>[\s\S]*?<span>Работ<\/span>[\s\S]*?<span>Выполнено<\/span>[\s\S]*?<span>Готовность<\/span>/);
const sectionTitlePosition = worksRowBlock.indexOf('class="section-schedule-title"');
const sectionMetaPosition = worksRowBlock.indexOf('class="section-work-section-meta"');
const sectionBulkPosition = worksRowBlock.indexOf('renderBulkSectionCheckbox(project.id');
assert.ok(sectionTitlePosition >= 0 && sectionMetaPosition > sectionTitlePosition);
assert.equal(sectionBulkPosition, -1);
assert.doesNotMatch(worksRowBlock, /renderBulkSectionCheckbox|data-bulk-section-check|data-section-work-check/);
assert.match(worksRowBlock, /var quantityInteraction = canEditWorkActual[\s\S]*?data-work-quantity-open role="button"/);
assert.match(worksRowBlock, /section-work-section-icon/);

for (const removedListControl of [
  '<small>Бригада</small>',
  '<small>Дней</small>',
  'Укрупнённо',
  'renderScheduleCounterpartyFilters',
]) {
  assert.equal(
    planningJs.includes(removedListControl),
    false,
    `The execution list still renders removed planning control: ${removedListControl}`,
  );
}

assert.doesNotMatch(projectsCss, /\[data-panel="schedule"\] \.schedule-project-topbar/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.project-schedule-view-switcher\.market-toolbar/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.execution-summary/);
assert.match(projectsCss, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.estimate-section-progress-split/);
assert.match(projectsCss, /\.estimate-section-progress-work-only[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
assert.match(projectsCss, /\.section-schedule-detail-grid\.is-work-only[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-progress-bar/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-progress-value/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-chevron[\s\S]*?display: none !important/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-detail-list \.quantity-actual-editor/);
assert.match(projectsCss, /height: 6px !important/);

assert.match(appCss, /ui-projects\.css\?v=[^"\n]*works-only-1/);
assert.match(baseHtml, /works-only-1/);
assert.match(loginHtml, /works-only-1/);

console.log('ui_project_schedule_cleanup_frontend_ok');
