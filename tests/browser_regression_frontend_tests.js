const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const coreJs = read('frontend/assets/js/core.js');
const appJs = read('frontend/assets/js/app.js');
const planningJs = read('frontend/assets/js/planning.js');
const routerJs = read('frontend/assets/js/router.js');
const warehouseControlJs = read('frontend/assets/js/warehouse-control.js');
const objectControlCss = read('frontend/assets/css/object-control.css');
const appCss = read('frontend/assets/app.css');
const baseHtml = read('frontend/templates/base.html');
const warehousePy = read('backend/warehouse.py');
const dailyTasksHtml = read('frontend/pages/daily_tasks.html');

const sidebarStart = coreJs.indexOf('function bindSidebarControls()');
const sidebarEnd = coreJs.indexOf('bindSidebarControls();', sidebarStart);
const sidebarBlock = coreJs.slice(sidebarStart, sidebarEnd);
assert.match(sidebarBlock, /document\.addEventListener\('click'/);
assert.match(sidebarBlock, /event\.target\.closest\('\[data-menu-toggle\]'\)/);
assert.match(sidebarBlock, /document\.body\.classList\.toggle\('menu-open'\)/);
assert.doesNotMatch(sidebarBlock, /toggle\.addEventListener\('click'/);

assert.match(coreJs, /projectsLoaded: false/);
assert.match(appJs, /state\.projectsLoaded = true/);
const reminderStart = appJs.indexOf('function refreshReminderBell()');
const reminderEnd = appJs.indexOf('function initReminderBell()', reminderStart);
const reminderBlock = appJs.slice(reminderStart, reminderEnd);
assert.match(reminderBlock, /if \(!state\.projectsLoaded\)/);
assert.match(reminderBlock, /if \(!state\.projects\.length\) \{\s*renderReminderBell\(\[\], false, \{ failedCount: 0, totalProjects: 0, fullFailure: false \}\);\s*return;/);
assert.match(reminderBlock, /fullFailure: true/);
assert.match(reminderBlock, /return \{ ok: false, items: \[\] \}/);

assert.match(appJs, /loadProjectAssignments = function \(projectId, loadingToken\) \{\s*loadProjectHub\(projectId, state\.selectedProject, loadingToken\);/);
assert.match(warehousePy, /^import urllib\.parse$/m);
assert.match(planningJs, /errorCode === 'works_required'\s*\? 'Сначала загрузите смету с работами\.'/);
assert.match(dailyTasksHtml, /<h1>Задачи сотрудников<\/h1>/);
assert.match(dailyTasksHtml, /Назначайте задачи, следите за выполнением/);
assert.match(warehouseControlJs, /warehouse-material-register-head/);
assert.doesNotMatch(warehouseControlJs, /Склад объекта|Учёт по позициям|Материалы на объекте|Одна строка показывает план, движение и фактический остаток материала\.|warehouse-control-inventory-head|data-warehouse-visible-count/);
assert.match(warehouseControlJs, /materialFlowHeader\('Заказано', 'shopping-cart', 'purchase'\)/);
assert.match(warehouseControlJs, /materialFlowHeader\('Привезено', 'package-check', 'receipt'\)/);
assert.match(warehouseControlJs, /materialFlowHeader\('Потрачено', 'package-minus', 'use'\)/);
assert.match(warehouseControlJs, /var hasValue = isValid && formattedValue !== '0'/);
assert.match(warehouseControlJs, /<span class="visually-hidden">' \+ escapeHtml\(isValid \? accessibleAmount : 'Нет данных'\)/);
assert.match(warehouseControlJs, /data-warehouse-dialog-open="movement"/);
assert.match(warehouseControlJs, /data-warehouse-dialog-open="work-fact"/);
assert.match(warehouseControlJs, /data-warehouse-dialog-open="norms"/);
assert.match(warehouseControlJs, /data-warehouse-dialog-open="history"/);
assert.match(warehouseControlJs, /'<div class="warehouse-control-main">' \+ materialsTable\(payload\) \+ '<\/div>'/);
assert.match(warehouseControlJs, /data-warehouse-control-portal/);
assert.match(warehouseControlJs, /document\.body\.appendChild\(portal\)/);
assert.match(warehouseControlJs, /document\.addEventListener\('keydown', dialogKeydownHandler\)/);
assert.match(warehouseControlJs, /aria-label="Поиск материалов"/);
assert.match(warehouseControlJs, /data-warehouse-stock-filter="all" aria-pressed="true"/);
assert.match(warehouseControlJs, /data-select-material-button/);
assert.doesNotMatch(warehouseControlJs, /warehouse-material-card is-' \+ stateLabel\[2\] \+ '"' \+ \(payload\.canRecordFacts \? ' tabindex="0" role="button"'/);
assert.match(planningJs, /section-work-register-head/);
assert.match(planningJs, /section-work-register-head-label"><i data-lucide="hammer"><\/i>Работа/);
assert.match(planningJs, /section-work-register-head-label is-plan"><i data-lucide="ruler"><\/i>По смете/);
assert.match(planningJs, /section-work-register-head-label is-actual"><i data-lucide="badge-check"><\/i>Сделано/);
assert.match(planningJs, /section-work-register-head-label is-status"><i data-lucide="circle-check"><\/i>Статус/);
assert.match(planningJs, /section-work-register-master-head/);
assert.match(planningJs, /section-work-register-section/);
assert.match(planningJs, /section-work-section-volume/);
assert.match(planningJs, /section-work-section-status/);
assert.match(planningJs, /section-work-section-meta/);
assert.equal((planningJs.match(/class="section-work-register-head section-work-register-master-head"/g) || []).length, 1);
const workSectionStart = planningJs.indexOf('function renderSectionScheduleRow');
const workSectionEnd = planningJs.indexOf('function renderSectionScheduleForecast', workSectionStart);
const workSectionBlock = planningJs.slice(workSectionStart, workSectionEnd);
const workForecastStart = workSectionEnd;
const workForecastEnd = planningJs.indexOf('function bindSectionScheduleRefresh', workForecastStart);
const workForecastBlock = planningJs.slice(workForecastStart, workForecastEnd);
const visibleWorksRegisterBlock = workSectionBlock + workForecastBlock;
assert.doesNotMatch(workSectionBlock, /renderWorkProgressStrip/);
assert.doesNotMatch(workSectionBlock, /data-section-schedule-toggle|section-schedule-chevron|renderScheduleSectionDetailsShell/);
assert.match(workSectionBlock, /section-work-register-body/);
const workToneStart = planningJs.indexOf('function workCompletionTone');
const workToneEnd = planningJs.indexOf('function renderWorkRegisterQuantity', workToneStart);
assert.ok(workToneStart >= 0 && workToneEnd > workToneStart, 'work completion tone helper must exist');
const workCompletionTone = new Function(
  `${planningJs.slice(workToneStart, workToneEnd)}; return workCompletionTone;`,
)();
assert.equal(workCompletionTone(0, 250), 'red');
assert.equal(workCompletionTone(50, 250), 'red', '20% remains red');
assert.equal(workCompletionTone(100, 250), 'orange', '100 of 250 must be orange');
assert.equal(workCompletionTone(125, 250), 'yellow');
assert.equal(workCompletionTone(150, 250), 'green', '150 of 250 must be green');
assert.equal(workCompletionTone(200, 250), 'green');
assert.equal(workCompletionTone(10, 0), 'neutral', 'fact without an estimate has no ratio tone');
const workQuantityRendererStart = planningJs.indexOf('function renderWorkRegisterQuantity');
const workQuantityRendererEnd = planningJs.indexOf('function renderSectionScheduleRow', workQuantityRendererStart);
assert.ok(workQuantityRendererStart >= 0 && workQuantityRendererEnd > workQuantityRendererStart, 'work plan/fact cell renderer must exist');
const workQuantityRenderer = new Function(
  'escapeHtml',
  'quantityText',
  `${planningJs.slice(workQuantityRendererStart, workQuantityRendererEnd)}; return renderWorkRegisterQuantity;`,
)(
  (value) => String(value).replace(/[&<>"']/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[symbol])),
  (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(Number(value)),
);
const plannedWorkQuantity = workQuantityRenderer('section-work-register-volume', 'По смете', 'ruler', 'plan', 256, 'м²');
const actualWorkQuantity = workQuantityRenderer('section-work-register-actual', 'Сделано', 'badge-check', 'actual', 64, 'м²');
const emptyWorkQuantity = workQuantityRenderer('section-work-register-actual', 'Сделано', 'badge-check', 'actual', 0, 'м²');
assert.match(plannedWorkQuantity, /section-work-register-volume section-work-register-quantity is-plan/);
assert.match(plannedWorkQuantity, /aria-label="По смете: 256 м²"/);
assert.match(plannedWorkQuantity, />256 <small>м²<\/small>/);
assert.match(actualWorkQuantity, /section-work-register-actual section-work-register-quantity is-actual/);
assert.match(actualWorkQuantity, /aria-label="Сделано: 64 м²"/);
assert.match(actualWorkQuantity, />64 <small>м²<\/small>/);
assert.doesNotMatch(emptyWorkQuantity, /section-work-register-quantity-value is-empty/);
assert.match(emptyWorkQuantity, />0 <small>м²<\/small>/, 'zero fact must stay visible so its red state is understandable');
const workProgressRendererStart = planningJs.lastIndexOf('function workProgressForRows');
const workProgressRendererEnd = planningJs.indexOf('function workProgress(', workProgressRendererStart);
assert.ok(workProgressRendererStart >= 0 && workProgressRendererEnd > workProgressRendererStart, 'quantity-aware work progress renderer must exist');
const workProgressRenderer = new Function(
  'isProjectScheduleWorkDone',
  'workActualProgress',
  `${planningJs.slice(workProgressRendererStart, workProgressRendererEnd)}; return workProgressForRows;`,
)(
  () => false,
  (_projectId, _sectionTitle, item) => ({ actual: item.actual, total: item.total }),
);
assert.deepEqual(
  workProgressRenderer(25, 'Отделка', [{ actual: 256, total: 256 }, { actual: 64, total: 256 }]),
  { total: 2, done: 1, left: 1, percent: 63 },
  'report-derived full fact and partial fact must stay aligned with completion counts and readiness',
);
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
    visibleWorksRegisterBlock.includes(removedVisibleToken),
    false,
    `Visible works register still contains removed planning field: ${removedVisibleToken}`,
  );
}

const worksSummaryStart = workForecastBlock.indexOf('works-register-summary');
const worksSummaryEnd = workForecastBlock.indexOf('renderPinnedScheduleBrief', worksSummaryStart);
const worksSummaryBlock = workForecastBlock.slice(worksSummaryStart, worksSummaryEnd);
assert.ok(worksSummaryStart >= 0 && worksSummaryEnd > worksSummaryStart, 'works summary block must exist');
assert.equal((worksSummaryBlock.match(/works-register-summary-item/g) || []).length, 4);
assert.match(worksSummaryBlock, /<span>Разделов<\/span>[\s\S]*?<span>Работ<\/span>[\s\S]*?<span>Выполнено<\/span>[\s\S]*?<span>Готовность<\/span>/);
assert.doesNotMatch(worksSummaryBlock, /is-period|Срок работ|Осталось/);

const sectionTitlePosition = workSectionBlock.indexOf('class="section-schedule-title"');
const sectionMetaPosition = workSectionBlock.indexOf('class="section-work-section-meta"');
const sectionBulkPosition = workSectionBlock.indexOf('renderBulkSectionCheckbox(project.id');
assert.ok(sectionTitlePosition >= 0 && sectionMetaPosition > sectionTitlePosition, 'section title must stay before its metrics');
assert.equal(sectionBulkPosition, -1, 'work section must not render a bulk completion checkbox');
assert.doesNotMatch(workSectionBlock, /renderBulkSectionCheckbox|data-bulk-section-check|data-section-work-check/);
assert.match(workSectionBlock, /section-work-section-title-line"><span class="section-work-section-icon"[\s\S]*?data-lucide="layers-3"[\s\S]*?<h4>/);
assert.match(workSectionBlock, /var quantityInteraction = canEditWorkActual[\s\S]*?data-work-quantity-open role="button" tabindex="0"/);
assert.match(workSectionBlock, /schedule-work-check-main"><span class="section-work-row-icon"[\s\S]*?data-lucide="hard-hat"[\s\S]*?section-work-check-copy/);
assert.match(workSectionBlock, /var actualProgress = workActualProgress\(project\.id, sectionTitle, item\)/);
assert.match(workSectionBlock, /var workTone = workCompletionTone\(actualProgress\.actual, actualProgress\.total\)/);
assert.match(workSectionBlock, /var workDone = actualProgress\.total > 0[\s\S]*?actualProgress\.actual >= actualProgress\.total/);
assert.match(workSectionBlock, /schedule-work-duration-row' \+ \(canEditWorkActual \? ' work-quantity-row' : ''\) \+ ' is-progress-' \+ escapeHtml\(workTone\)/);
assert.match(workSectionBlock, /workPartial \? ' is-partial'/);
assert.match(workSectionBlock, /renderWorkRegisterQuantity\('section-work-register-volume', 'По смете', 'ruler', 'plan'/);
assert.match(workSectionBlock, /renderWorkRegisterQuantity\('section-work-register-actual', 'Сделано', 'badge-check', 'actual'/);
assert.match(workSectionBlock, /'В работе · ' \+ String\(workPercent\) \+ '%'/);
assert.match(planningJs, /<span><\/span><span class="section-work-register-head-label"><i data-lucide="hammer"><\/i>Работа/);
assert.match(objectControlCss, /\.warehouse-material-card \{[\s\S]*?border: 0;[\s\S]*?border-bottom: 1px solid/);
assert.match(objectControlCss, /\.section-work-check\.schedule-work-duration-row \{[\s\S]*?border: 0 !important;/);
assert.match(objectControlCss, /\.warehouse-control-main \{[\s\S]*?display: block;/);
assert.match(objectControlCss, /\.warehouse-control-dialog \{[\s\S]*?position: fixed;/);
assert.match(objectControlCss, /\.project-schedule-view-switcher\.market-toolbar \{[\s\S]*?background: transparent !important;/);
assert.match(objectControlCss, /\.section-schedule-caption \{[\s\S]*?display: none !important;/);
assert.match(objectControlCss, /\.warehouse-control-workspace \{[\s\S]*?padding: 6px 8px 24px;/);
assert.match(objectControlCss, /\.section-work-section-row \{[\s\S]*?grid-template-columns:/);
assert.match(objectControlCss, /\.section-work-register-master-head \{[\s\S]*?background: var\(--color-surface-subtle\);/);
assert.match(objectControlCss, /\[data-project-overview-section\]\[hidden\] \{\s*display: none !important;/);
assert.match(objectControlCss, /\.warehouse-control-head \{[\s\S]*?flex-direction: column;/);
assert.match(objectControlCss, /\.warehouse-control-head-actions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
assert.match(objectControlCss, /\.warehouse-material-card \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
assert.match(objectControlCss, /\.warehouse-control-dialog-card \{[\s\S]*?max-height: min\(820px, calc\(100dvh - 48px\)\);/);
assert.match(appJs, /var itemLabel = itemKind === 'work' \? 'работы' : \(itemKind === 'material' \? 'материалы' : 'позиции'\)/);
assert.match(appJs, /var ariaLabel = 'Отметить все ' \+ itemLabel \+ ' раздела выполненными'/);
assert.match(appJs, /aria-label="' \+ escapeHtml\(ariaLabel\) \+ '" data-bulk-section-check/);
assert.match(objectControlCss, /Compact works register/);
assert.match(objectControlCss, /\.section-work-section-row \{[\s\S]*?min-height: 50px;[\s\S]*?padding: 7px 12px;/);
assert.match(objectControlCss, /\.section-work-register-section \.section-work-check\.schedule-work-duration-row \{[\s\S]*?min-height: 44px !important;/);
assert.match(objectControlCss, /\.project-estimate-file-copy > span \{\s*display: none;/);
assert.match(objectControlCss, /Works table foundation/);
assert.match(objectControlCss, /\.section-work-register-body[\s\S]*?display: block;/);
assert.match(objectControlCss, /Works register controls and summary/);
assert.match(objectControlCss, /\.works-register-summary \{[\s\S]*?grid-template-columns: minmax\(230px, 1\.6fr\) repeat\(3, minmax\(110px, \.6fr\)\);/);
assert.match(objectControlCss, /Work quantity entry: rows open an explicit plan\/fact dialog instead of toggling completion/);
assert.match(objectControlCss, /\.work-quantity-row:focus-visible[\s\S]*?outline: 2px solid/);
assert.match(objectControlCss, /\.section-work-row-icon[\s\S]*?width: 22px;[\s\S]*?height: 22px;/);
assert.match(objectControlCss, /\.work-quantity-dialog[\s\S]*?position: fixed;[\s\S]*?z-index: 1450;/);

const worksRhythmMarker = 'Works/material register rhythm alignment';
const worksRhythmStart = objectControlCss.lastIndexOf(worksRhythmMarker);
const worksRhythmBlock = objectControlCss.slice(worksRhythmStart);
assert.ok(worksRhythmStart >= 0, 'final works/material rhythm override must exist');
assert.match(worksRhythmBlock, /\.works-register-summary-item \{[\s\S]*?min-height: 60px;[\s\S]*?padding: 10px 14px;/);
assert.match(worksRhythmBlock, /@media \(min-width: 721px\)[\s\S]*?grid-template-columns: 22px minmax\(260px, 1fr\) 132px 132px 118px;/);
assert.match(worksRhythmBlock, /\.section-work-section-title-line \{[\s\S]*?display: inline-flex;[\s\S]*?width: fit-content;[\s\S]*?max-width: 100%;/);
assert.match(objectControlCss, /\.section-work-section-icon[\s\S]*?width: 24px;[\s\S]*?height: 24px;/);
assert.match(worksRhythmBlock, /\.section-work-register-section \.section-work-section-row \{[\s\S]*?grid-template-columns: 22px minmax\(260px, 1fr\) 150px 118px;/);
assert.match(worksRhythmBlock, /\.section-work-register-section \.section-work-section-row \.section-schedule-title \{[\s\S]*?grid-column: 1 \/ span 2;/);
assert.match(worksRhythmBlock, /\.section-work-register-section \.section-work-section-volume \{[\s\S]*?grid-column: 3;/);
assert.match(worksRhythmBlock, /\.section-work-register-section \.section-work-section-status \{[\s\S]*?grid-column: 4;/);
assert.doesNotMatch(worksRhythmBlock, /\.section-work-section-row > \.bulk-section-check/);
assert.match(worksRhythmBlock, /\.section-work-register-master-head \{[\s\S]*?min-height: 40px;/);
assert.match(worksRhythmBlock, /\.section-work-register-section \.section-work-section-row \{[\s\S]*?min-height: 62px;[\s\S]*?padding: 10px 14px;/);
assert.match(worksRhythmBlock, /\.section-work-register-section \.section-work-check\.schedule-work-duration-row \{[\s\S]*?min-height: 62px !important;[\s\S]*?padding: 11px 14px !important;/);
const worksMobileStart = worksRhythmBlock.indexOf('@media (max-width: 720px)');
const worksMobileBlock = worksRhythmBlock.slice(worksMobileStart);
assert.ok(worksMobileStart >= 0, 'mobile works register override must exist');
assert.match(worksMobileBlock, /min-height: 64px !important;[\s\S]*?padding: 10px 8px !important;/);
assert.match(worksMobileBlock, /\.section-work-register-section \.section-work-section-row \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 18px;/);
assert.match(worksMobileBlock, /\.section-work-register-section \.section-work-section-row \.section-schedule-title \{[\s\S]*?grid-column: 1;/);
assert.match(worksMobileBlock, /\.section-work-section-title-line \{[\s\S]*?align-items: flex-start;/);
assert.match(objectControlCss, /Work plan\/fact lifecycle/);
assert.match(objectControlCss, /\.section-work-register-quantity\.is-plan \{[\s\S]*?--work-quantity-color: var\(--color-accent/);
assert.match(objectControlCss, /\.section-work-register-quantity\.is-actual \{[\s\S]*?--work-quantity-color: #6d5bd0/);
assert.match(objectControlCss, /\.section-work-check\.is-progress-red \.section-work-register-quantity\.is-actual \{[\s\S]*?--work-quantity-color: #b8322e/);
assert.match(objectControlCss, /\.section-work-check\.is-progress-orange \.section-work-register-quantity\.is-actual \{[\s\S]*?--work-quantity-color: #a94b0b/);
assert.match(objectControlCss, /\.section-work-check\.is-progress-yellow \.section-work-register-quantity\.is-actual \{[\s\S]*?--work-quantity-color: #7a5700/);
assert.match(objectControlCss, /\.section-work-check\.is-progress-green \.section-work-register-quantity\.is-actual \{[\s\S]*?--work-quantity-color: var\(--color-success/);
assert.match(objectControlCss, /\.section-work-register-quantity-value small \{[\s\S]*?opacity: 1;/);
assert.match(objectControlCss, /@media \(min-width: 721px\) and \(max-width: 1080px\) \{[\s\S]*?grid-template-columns: 22px minmax\(180px, 1fr\) minmax\(105px, \.45fr\) minmax\(118px, \.5fr\);/);
assert.match(objectControlCss, /@media \(max-width: 720px\) \{[\s\S]*?\.section-work-register-body \.schedule-work-check-main \{[\s\S]*?grid-template-columns: 22px repeat\(2, minmax\(0, 1fr\)\);/);
assert.match(objectControlCss, /\.section-work-register-body \.section-work-register-actual \{[\s\S]*?grid-column: 3;[\s\S]*?grid-row: 2;/);
assert.match(objectControlCss, /\.section-work-register-body \.section-work-register-status \{[\s\S]*?grid-column: 2 \/ -1;[\s\S]*?grid-row: 3;/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-material-rhythm-1/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-material-rhythm-1/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-bulk-right-1/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-bulk-right-1/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-bulk-inline-2/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-bulk-inline-2/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-bulk-title-3/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-bulk-title-3/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*works-bulk-title-3/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*works-bulk-title-3/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-section-align-4/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-section-align-4/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-metrics-right-5/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-metrics-right-5/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-metrics-edge-6/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-metrics-edge-6/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*works-metrics-edge-6/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*works-metrics-edge-6/);
assert.match(objectControlCss, /Material lifecycle: visually separate order, delivery and usage/);
assert.match(objectControlCss, /\.warehouse-material-flow-value\.is-empty \{[\s\S]*?background: transparent;/);
assert.match(objectControlCss, /@media \(min-width: 721px\) and \(max-width: 1080px\) \{[\s\S]*?\.warehouse-material-card \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
assert.match(objectControlCss, /\.warehouse-material-card \.warehouse-material-cell:nth-child\(3\) \{[\s\S]*?display: block;/);
assert.match(objectControlCss, /\.warehouse-material-cell > \.warehouse-material-flow-label \{[\s\S]*?display: inline-flex;/);
assert.match(objectControlCss, /\.section-work-register-head-label svg \{[\s\S]*?width: 14px;/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*material-flow-7-work-head-icons-7/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*work-head-icons-7/);
assert.match(routerJs, /warehouse-control\.js\?v=[^'\n]*material-flow-7/);
assert.match(routerJs, /warehouse-control\.js\?v=[^'\n]*inventory-head-cleanup-8/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*material-flow-7-work-head-icons-7/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*material-flow-7-work-head-icons-7/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*inventory-head-cleanup-8/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-plan-fact-14/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*works-plan-fact-14/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-plan-fact-14/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*works-plan-fact-14/);
assert.match(appCss, /object-control\.css\?v=[^"\n]*works-progress-tones-15/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*works-progress-tones-15/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*works-progress-tones-15/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*works-progress-tones-15/);

console.log('browser_regression_frontend_ok');
