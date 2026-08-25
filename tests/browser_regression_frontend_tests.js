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
assert.match(planningJs, /section-work-register-head-label"><i data-lucide="ruler"><\/i>Объём/);
assert.match(planningJs, /section-work-register-head-label"><i data-lucide="circle-check"><\/i>Статус/);
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
assert.ok(sectionTitlePosition >= 0 && sectionBulkPosition > sectionTitlePosition && sectionMetaPosition > sectionBulkPosition, 'section bulk checkbox must sit inside the title block before the metrics');
assert.equal((workSectionBlock.match(/renderBulkSectionCheckbox\(project\.id/g) || []).length, 1);
assert.match(workSectionBlock, /section-work-section-title-line"><h4>[\s\S]*?renderBulkSectionCheckbox\(project\.id, sectionTitle, 'work', progress\)[\s\S]*?<\/div><\/div>/);
assert.match(workSectionBlock, /schedule-work-check-main"><input type="checkbox" data-section-work-check[\s\S]*?section-work-check-copy/);
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
assert.match(objectControlCss, /input\[type="checkbox"\]\[data-section-work-check\][\s\S]*?width: 20px !important;[\s\S]*?height: 20px !important;/);
assert.match(objectControlCss, /data-section-work-check\]\):checked,[\s\S]*?background: var\(--color-accent\) !important;/);
assert.match(objectControlCss, /input\[type="checkbox"\]\[data-section-work-check\][\s\S]*?border-radius: 4px;/);

const worksRhythmMarker = 'Works/material register rhythm alignment';
const worksRhythmStart = objectControlCss.lastIndexOf(worksRhythmMarker);
const worksRhythmBlock = objectControlCss.slice(worksRhythmStart);
assert.ok(worksRhythmStart >= 0, 'final works/material rhythm override must exist');
assert.match(worksRhythmBlock, /\.works-register-summary-item \{[\s\S]*?min-height: 60px;[\s\S]*?padding: 10px 14px;/);
assert.match(worksRhythmBlock, /@media \(min-width: 721px\)[\s\S]*?grid-template-columns: 22px minmax\(260px, 1fr\) 150px 118px;/);
assert.match(worksRhythmBlock, /\.section-work-section-title-line \{[\s\S]*?display: inline-flex;[\s\S]*?width: fit-content;[\s\S]*?max-width: 100%;/);
assert.match(worksRhythmBlock, /\.section-work-section-title-line > \.bulk-section-check \{[\s\S]*?flex: 0 0 auto;[\s\S]*?margin: 0;/);
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
assert.match(objectControlCss, /\.section-work-register-body \.schedule-work-check-main \{[\s\S]*?grid-template-columns: 22px minmax\(0, 1fr\) auto;/);
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

console.log('browser_regression_frontend_ok');
