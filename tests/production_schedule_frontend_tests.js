const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const coreJs = fs.readFileSync(path.join(root, 'frontend/assets/js/core.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'frontend/assets/js/app.js'), 'utf8');
const planningJs = fs.readFileSync(path.join(root, 'frontend/assets/js/planning.js'), 'utf8');
const projectsHtml = fs.readFileSync(path.join(root, 'frontend/pages/projects.html'), 'utf8');
const planningCss = fs.readFileSync(path.join(root, 'frontend/assets/css/planning.css'), 'utf8');
const rootCss = fs.readFileSync(path.join(root, 'frontend/assets/app.css'), 'utf8');
const routerJs = fs.readFileSync(path.join(root, 'frontend/assets/js/router.js'), 'utf8');
const baseHtml = fs.readFileSync(path.join(root, 'frontend/templates/base.html'), 'utf8');

assert.match(projectsHtml, /data-tab="production-schedule"/);
assert.match(projectsHtml, /data-panel="production-schedule"/);
assert.match(coreJs, /productionScheduleByProject/);
assert.match(appJs, /loadSelectedProjectProductionSchedule/);
assert.match(appJs, /tabName === 'production-schedule'/);
assert.match(planningJs, /data-production-cell/);
assert.match(planningJs, /action: 'set_cell'/);
assert.match(planningJs, /operation_id: productionPayloadId\(button\.dataset\.operationId\)/);
assert.match(planningJs, /slot_number: Number\(button\.dataset\.slotNumber\)/);
assert.match(planningJs, /step="0\.5"/);
assert.match(planningJs, /class="production-duration-stepper" role="group"/);
assert.match(planningJs, /data-production-duration-step="-0\.5"/);
assert.match(planningJs, /data-production-duration-step="0\.5"/);
assert.match(planningJs, /Уменьшить длительность на 0,5 дня/);
assert.match(planningJs, /Увеличить длительность на 0,5 дня/);
assert.match(planningJs, /function saveProductionDurationValue/);
assert.match(planningJs, /Объём работ/);
assert.match(planningJs, /Кол-во<br>смен/);
assert.match(planningJs, /Кол-во<br>бригад/);
assert.doesNotMatch(planningJs, /<small>Чел\/час<\/small>/);
assert.doesNotMatch(planningJs, /Всего<br>чел\/час/);
assert.doesNotMatch(planningJs, /чел\.-ч/);
assert.match(planningJs, /action: 'recalculate'/);
assert.match(planningJs, /preserve_manual: true/);
for (const action of ['add_operation', 'update_operation', 'delete_operation', 'split_operation', 'reorder_operations', 'save_template']) {
  assert.match(planningJs, new RegExp(`['"]${action}['"]`));
}
assert.match(planningJs, /data-production-add-operation/);
assert.match(planningJs, /data-production-print data-project-id/);
assert.match(planningJs, /data-lucide="printer"/);
assert.match(planningJs, /Распечатать в PDF/);
assert.match(planningJs, /function productionSchedulePrintDocument/);
assert.match(planningJs, /function productionScheduleStartDate/);
assert.match(planningJs, /function productionScheduleMonthGroups/);
assert.match(planningJs, /function productionScheduleHealth/);
assert.match(planningJs, /class="production-month-head"/);
assert.match(planningJs, /class="production-day-head production-date-head/);
assert.match(planningJs, /class="production-half-day-head"/);
assert.match(planningJs, /Статусы выполнения графика/);
assert.match(planningJs, /День 1 —/);
assert.match(planningJs, /aria-current="date"/);
assert.match(planningJs, /function loadProductionScheduleForPrint/);
assert.match(planningJs, /function createProductionSchedulePrintPreview/);
assert.match(planningJs, /function writeProductionSchedulePrintPreview/);
assert.match(planningJs, /function productionSchedulePrintConfig/);
assert.match(planningJs, /function productionSchedulePrintMaximumScale/);
assert.match(planningJs, /function productionSchedulePrintApplyScale/);
assert.match(planningJs, /function openProductionSchedulePrint/);
assert.match(planningJs, /loadProductionScheduleForPrint\(projectId\)/);
assert.match(planningJs, /productionSchedulePendingSavesByProject/);
assert.match(planningJs, /data-production-print-preview/);
assert.match(planningJs, /data-production-print-frame/);
assert.match(planningJs, /data-production-print-action/);
assert.match(planningJs, /data-production-print-layout="fit-one"/);
assert.match(planningJs, /data-production-print-scale disabled/);
assert.match(planningJs, /data-production-print-auto disabled/);
assert.match(planningJs, /data-production-print-pages/);
assert.match(planningJs, /printState\.printable\.window\.print\(\)/);
assert.match(planningJs, /preview\.scaleInput\.max = String\(printState\.layout === 'fit-one' \? printState\.autoScale : 100\)/);
const productionPrintOpenBlock = planningJs.slice(
  planningJs.indexOf('function openProductionSchedulePrint'),
  planningJs.indexOf('function renderProductionSchedule'),
);
assert.doesNotMatch(productionPrintOpenBlock, /window\.open\(/);
assert.match(planningJs, /data-production-edit-operation/);
assert.match(planningJs, /data-production-delete-operation/);
assert.match(planningJs, /data-production-split-operation/);
assert.match(planningJs, /data-production-operation-row/);
assert.match(planningJs, /linked_estimate_item_ids/);
const operationPayloadBuilder = planningJs.slice(
  planningJs.indexOf('function productionOperationFormPayload'),
  planningJs.indexOf('function productionOperationOrder')
);
assert.match(operationPayloadBuilder, /if \(!operationId\)/);
assert.match(operationPayloadBuilder, /planned_qty: values\.plannedQty/);
assert.match(operationPayloadBuilder, /if \(values\.plannedQty !== initial\.plannedQty\) payload\.planned_qty = values\.plannedQty/);
assert.doesNotMatch(operationPayloadBuilder, /values\.plannedQty == null \? 0/);
assert.match(operationPayloadBuilder, /if \(values\.durationDays !== initial\.durationDays\) payload\.duration_days/);
assert.match(operationPayloadBuilder, /if \(values\.linkedIds\.join\('\|'\) !== productionSortedLinkIds\(initial\.linkedIds\)\.join\('\|'\)\)/);
assert.doesNotMatch(operationPayloadBuilder, /var payload = \{[\s\S]*duration_days:[\s\S]*action: 'update_operation'/);
assert.match(planningJs, /data-production-duration data-project-id/);
assert.match(planningJs, /data-production-duration-reset/);
assert.match(planningJs, /Авто: .*quantityText\(autoDurationDays\).* дн\./);
assert.match(planningJs, /action: 'set_duration'[\s\S]*reset: true/);
assert.match(planningJs, /data-production-confirm-operation/);
assert.match(planningJs, /status: 'confirmed'/);
assert.match(planningJs, /data-production-reset-cells/);
assert.match(planningJs, /action: 'reset_cells'/);
assert.match(planningJs, /Связано со сметой/);
assert.match(planningJs, /Вне сметы/);
assert.match(planningJs, /Требует проверки/);
assert.match(planningJs, /Эти связи используются только в графике и не меняют смету/);
assert.doesNotMatch(planningJs, /Сбросить ручные клетки и длительности/);
assert.match(planningJs, /api\('\/api\/projects\/' \+ projectId \+ '\/production-schedule'/);
assert.match(appJs, /section-schedule-override/);
const sectionScheduleRender = planningJs.slice(
  planningJs.indexOf('function renderSectionScheduleRow'),
  planningJs.indexOf('function renderSectionScheduleForecast')
);
const sectionForecastRender = planningJs.slice(
  planningJs.indexOf('function renderSectionScheduleForecast'),
  planningJs.indexOf('function bindSectionScheduleRefresh')
);
const visibleWorksRegister = sectionScheduleRender + sectionForecastRender;
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
assert.doesNotMatch(planningJs, /bindHorizontalWheelScroll/);
assert.match(planningJs, /bindProductionScheduleScroll\(qs\('\[data-production-table-scroll\]', panel\)\)/);
const productionScrollStart = planningJs.indexOf('function syncProductionScheduleScroll(scroller)');
const productionScrollEnd = planningJs.indexOf('\n    function productionScheduleDaySet', productionScrollStart);
assert.ok(productionScrollStart > -1 && productionScrollEnd > productionScrollStart);
const productionScrollHandlers = {};
const productionScrollOptions = {};
const productionScrollRegistrations = {};
const productionShellClasses = {};
const productionShell = {
  classList: {
    toggle(name, enabled) {
      productionShellClasses[name] = enabled;
    },
  },
};
let productionCardTop = 108;
const productionScheduleCard = {
  getBoundingClientRect() {
    return { top: productionCardTop };
  },
};
const productionPageScrolls = [];
const productionWindow = {
  innerHeight: 800,
  getComputedStyle(target) {
    assert.equal(target, productionScheduleCard);
    return { top: '8px' };
  },
  scrollBy(x, y) {
    productionPageScrolls.push([x, y]);
  },
};
const productionScroller = {
  dataset: {},
  scrollWidth: 1000,
  clientWidth: 400,
  scrollLeft: 100,
  scrollHeight: 1000,
  clientHeight: 400,
  scrollTop: 0,
  closest(selector) {
    if (selector === '[data-production-table-shell]') return productionShell;
    if (selector === '[data-production-schedule-card]') return productionScheduleCard;
    throw new Error(`Unexpected closest selector: ${selector}`);
  },
  addEventListener(type, handler, options) {
    productionScrollHandlers[type] = handler;
    productionScrollOptions[type] = options;
    productionScrollRegistrations[type] = (productionScrollRegistrations[type] || 0) + 1;
  },
};
const productionScrollApi = new Function(
  'qs',
  'window',
  `${planningJs.slice(productionScrollStart, productionScrollEnd)}\nreturn { bindProductionScheduleScroll, syncProductionScheduleScroll };`,
)((selector) => {
  throw new Error(`Unexpected selector: ${selector}`);
}, productionWindow);
productionScrollApi.bindProductionScheduleScroll(productionScroller);
assert.deepEqual(productionScrollOptions.scroll, { passive: true });
assert.deepEqual(productionScrollOptions.wheel, { passive: false });
assert.deepEqual(Object.keys(productionScrollHandlers).sort(), ['scroll', 'wheel']);
productionScrollApi.bindProductionScheduleScroll(productionScroller);
assert.deepEqual(productionScrollRegistrations, { scroll: 1, wheel: 1 }, 'Repeated binding must not duplicate wheel handlers');
let productionWheelPrevented = 0;
const productionWheelEvent = (overrides = {}) => ({
  defaultPrevented: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  deltaX: 0,
  deltaY: 90,
  deltaMode: 0,
  preventDefault() { productionWheelPrevented += 1; },
  ...overrides,
});
productionScrollHandlers.wheel(productionWheelEvent());
assert.equal(productionScroller.scrollLeft, 100, 'A normal wheel over the timeline must remain vertical');
assert.equal(productionScroller.scrollTop, 0);
assert.deepEqual(productionPageScrolls, [[0, 90]], 'The page must move until the production card reaches the viewport');
assert.equal(productionWheelPrevented, 1);
productionCardTop = 38;
productionScrollHandlers.wheel(productionWheelEvent());
assert.equal(productionScroller.scrollLeft, 100);
assert.equal(productionScroller.scrollTop, 60, 'The remaining wheel delta must continue inside the table');
assert.deepEqual(productionPageScrolls.at(-1), [0, 30]);
assert.equal(productionWheelPrevented, 2);
productionCardTop = 8;
productionScroller.scrollTop = 30;
productionScrollHandlers.wheel(productionWheelEvent({ deltaY: -90 }));
assert.equal(productionScroller.scrollTop, 0);
assert.deepEqual(productionPageScrolls.at(-1), [0, -60], 'Unused upward delta must return to page scrolling');
productionScroller.scrollTop = 580;
productionScrollHandlers.wheel(productionWheelEvent({ deltaY: 90 }));
assert.equal(productionScroller.scrollTop, 600);
assert.deepEqual(productionPageScrolls.at(-1), [0, 70], 'Unused downward delta must continue down the page');
productionWheelPrevented = 0;
productionScroller.scrollTop = 100;
productionScrollHandlers.wheel(productionWheelEvent());
assert.equal(productionScroller.scrollTop, 190, 'A normal wheel must scroll vertically anywhere in the schedule');
assert.equal(productionScroller.scrollLeft, 100);
assert.equal(productionWheelPrevented, 1);
productionScrollHandlers.wheel(productionWheelEvent({ deltaX: 80, deltaY: 10 }));
assert.equal(productionScroller.scrollLeft, 180, 'Dominant horizontal trackpad input must move the timeline');
assert.equal(productionWheelPrevented, 2);
productionScrollHandlers.wheel(productionWheelEvent({ shiftKey: true }));
assert.equal(productionScroller.scrollLeft, 270, 'Shift + wheel must move the production timeline');
assert.equal(productionWheelPrevented, 3);
productionScroller.scrollLeft = 600;
productionScrollHandlers.wheel(productionWheelEvent({ shiftKey: true, deltaY: 90 }));
assert.equal(productionScroller.scrollLeft, 600);
assert.equal(productionWheelPrevented, 3, 'Horizontal wheel must not be trapped at the right edge');
productionScroller.scrollLeft = 0;
productionScrollHandlers.wheel(productionWheelEvent({ shiftKey: true, deltaY: -90 }));
assert.equal(productionScroller.scrollLeft, 0);
assert.equal(productionWheelPrevented, 3, 'Horizontal wheel must not be trapped at the left edge');
productionScrollHandlers.wheel(productionWheelEvent({ shiftKey: true, deltaY: 90 }));
assert.equal(productionScroller.scrollLeft, 90, 'The timeline must scroll inward from the left edge');
assert.equal(productionWheelPrevented, 4);
productionScroller.scrollWidth = productionScroller.clientWidth;
productionScroller.scrollLeft = 0;
productionScrollHandlers.wheel(productionWheelEvent({ shiftKey: true, deltaY: 90 }));
assert.equal(productionScroller.scrollLeft, 0, 'A non-overflowing timeline must not move');
assert.equal(productionWheelPrevented, 4, 'A non-overflowing timeline must not trap the wheel');
productionScroller.scrollWidth = 1000;
productionScrollHandlers.wheel(productionWheelEvent({ ctrlKey: true }));
productionScrollHandlers.wheel(productionWheelEvent({ metaKey: true }));
productionScrollHandlers.wheel(productionWheelEvent({ defaultPrevented: true }));
assert.equal(productionWheelPrevented, 4, 'Browser zoom and already handled wheel events must pass through');
assert.match(planningCss, /\.production-schedule-table/);
assert.match(planningCss, /\.production-duration-stepper/);
assert.match(planningCss, /\.production-operation-drawer/);
for (const health of ['neutral', 'green', 'yellow', 'red']) {
  assert.match(planningCss, new RegExp(`\\.production-work-row\\.production-health-${health}`));
}
assert.match(planningCss, /\.production-print-button/);
assert.match(planningCss, /\.production-link-label\.is-review/);
assert.doesNotMatch(planningCss, /\.production-work-row\.production-phase-/);
assert.match(planningCss, /--pmbi-style-planning-ready:\s*1/);
assert.match(planningCss, /\.production-health-legend/);
assert.match(planningCss, /\.production-month-head/);
assert.doesNotMatch(planningCss, /\.production-section-row th\s*\{[^}]*#f1e33b/s);
assert.match(planningCss, /position: sticky/);
assert.doesNotMatch(planningJs, /data-production-sticky-header/);
assert.equal((planningJs.match(/\+ tableHeader \+/g) || []).length, 1, 'The schedule must render one real table header');
assert.match(planningJs, /Колесо — вверх\/вниз · Shift \+ колесо — по дням/);
assert.match(planningCss, /\.production-table-scroll\s*\{[^}]*max-height: min\(64vh, 600px\);[^}]*overflow-x: auto;[^}]*overflow-y: auto;[^}]*overscroll-behavior-x: contain;[^}]*overscroll-behavior-y: auto;/s);
assert.match(planningCss, /@media \(min-width: 721px\)[\s\S]*?\[data-panel="production-schedule"\]\.active \.production-schedule-card\s*\{[^}]*height: calc\(100dvh - 16px\);[^}]*position: sticky;[^}]*top: 8px;/s);
assert.match(planningCss, /\[data-panel="production-schedule"\]\.active \.production-table-shell\s*\{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow: hidden;/s);
assert.match(planningCss, /\[data-panel="production-schedule"\]\.active \.production-table-scroll\s*\{[^}]*height: 100%;[^}]*max-height: none;/s);
assert.match(planningJs, /function scrollProductionScheduleVertically/);
assert.match(planningJs, /window\.scrollBy\(0, pageStep\)/);
assert.doesNotMatch(planningCss, /\.production-table-sticky-header/);
assert.match(planningCss, /\.production-cell-toggle\s*\{[^}]*inset: 0;[^}]*position: absolute;/s);
assert.match(planningCss, /\.production-day-half-cell\s*\{[^}]*position: relative;/s);
assert.doesNotMatch(planningCss, /\.production-table-scroll\s*\{[^}]*cursor: ew-resize;/s);
assert.doesNotMatch(planningCss, /cursor: ns-resize/);
assert.match(planningCss, /\.production-cell-toggle\s*\{[^}]*cursor: pointer;/s);
assert.doesNotMatch(planningJs, /function productionPointerOverFrozenColumns/);
assert.doesNotMatch(planningJs, /is-wheel-vertical-zone/);
assert.doesNotMatch(planningJs, /is-wheel-horizontal-zone/);
assert.match(planningCss, /\.production-schedule-table\s*\{[^}]*--production-number-width: 40px;[^}]*--production-work-width: 340px;/s);
assert.match(planningCss, /\.production-schedule-table th,\s*\.production-schedule-table td\s*\{[^}]*height: 30px;[^}]*vertical-align: middle;/s);
assert.match(planningCss, /\.production-schedule-table thead th\s*\{[^}]*height: 78px;[^}]*position: sticky;[^}]*top: 0;/s);
assert.match(planningCss, /\.production-date-head\s*\{[^}]*top: 22px !important;/s);
assert.match(planningCss, /\.production-half-day-head\s*\{[^}]*top: 58px !important;/s);
for (const movingMetricClass of ['volume', 'people', 'shifts', 'brigades', 'duration']) {
  assert.doesNotMatch(
    planningCss,
    new RegExp(`\\.production-schedule-table \\.production-${movingMetricClass}-cell\\s*\\{[^}]*left:`),
    `${movingMetricClass} must move horizontally with the timeline`,
  );
}
assert.doesNotMatch(planningCss, /@media \(max-width: 1180px\)/);
assert.match(planningCss, /\.production-table-shell\.is-horizontally-scrolled \.production-schedule-table \.production-work-title\s*\{[^}]*box-shadow:/s);
assert.match(planningCss, /\.production-schedule-table \.production-volume-cell,[\s\S]*?\.production-schedule-table \.production-duration-cell\s*\{[^}]*text-align: center;/s);
assert.match(planningCss, /\.production-duration-stepper\s*\{[^}]*grid-template-columns: 24px 34px 24px;[^}]*height: 24px;[^}]*width: 82px;/s);
assert.match(planningCss, /\.production-duration-step-button\s*\{[^}]*display: grid;[^}]*place-items: center;/s);
assert.match(planningCss, /\.production-day-head\s*\{[^}]*width: 30px;/s);
assert.match(planningCss, /\.production-day-half-cell\s*\{[^}]*width: 15px;/s);
assert.match(planningJs, /data-production-duration-step="-0\.5"[\s\S]*?<span aria-hidden="true">−<\/span>/);
assert.match(planningJs, /data-production-duration-step="0\.5"[\s\S]*?<span aria-hidden="true">\+<\/span>/);
assert.doesNotMatch(planningJs, /production-work-heading"><i/);
assert.doesNotMatch(planningCss, /\.production-work-heading > i/);
assert.match(planningCss, /\.production-work-meta\s*\{[^}]*margin: 2px 0 0;/s);
assert.match(planningCss, /\.production-duration-cell \.production-duration-stepper input\[data-production-duration\]\s*\{[^}]*height: 100% !important;[^}]*line-height: 14px !important;[^}]*min-height: 0 !important;[^}]*padding: 0 2px 8px !important;/s);
assert.match(planningCss, /\.production-duration-step-button > span\s*\{[^}]*transform: translateY\(-4px\);/s);
assert.match(planningJs, /var scrollTop = scroll \? scroll\.scrollTop : 0;[\s\S]*?nextScroll\.scrollTop = scrollTop;/s);
const productionPrintStart = planningJs.indexOf('function productionSchedulePrintDayCount');
const productionPrintEnd = planningJs.indexOf('\n    function renderProductionSchedule(', productionPrintStart);
assert.ok(productionPrintStart > -1 && productionPrintEnd > productionPrintStart);
const productionPrintApi = new Function(
  'escapeHtml',
  'quantityPlanInfo',
  'quantityText',
  'productionScheduleDaySet',
  'productionOperationColorKey',
  `${planningJs.slice(productionPrintStart, productionPrintEnd)}\nreturn { productionSchedulePrintDayCount, productionSchedulePrintScalePercent, productionSchedulePrintConfig, productionSchedulePrintDocument, productionSchedulePrintPageLabel };`,
)(
  (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;'),
  (item) => ({ totalQty: item.plannedQty ?? item.planned_qty ?? 0, unit: item.unit || '' }),
  (value) => String(value),
  (slots) => Object.fromEntries((Array.isArray(slots) ? slots : []).map((slot) => [String(slot), true])),
  (item) => item.colorKey || 'blue',
);
const printableSchedule = {
  startDate: '2026-08-25',
  today: '2026-09-02',
  dayCount: 13,
  autoDayCount: 13,
  items: [{
    id: 17,
    sectionTitle: '<Подготовка>',
    title: 'Гидроизоляция <основная>',
    plannedQty: 256,
    unit: 'м²',
    peopleCount: 4,
    shiftCount: 2,
    brigadeCount: 1,
    durationDays: 13,
    filledSlots: [1, 2, 24, 25, 26],
    overriddenSlots: [26],
    healthStatus: 'green',
    healthLabel: 'Идёт по графику',
  }],
};
assert.equal(productionPrintApi.productionSchedulePrintDayCount(printableSchedule), 13);
assert.equal(productionPrintApi.productionSchedulePrintDayCount({ dayCount: 2, items: [{ filledSlots: [27] }] }), 14);
assert.deepEqual(productionPrintApi.productionSchedulePrintConfig(printableSchedule), {
  dayCount: 13,
  daysPerSheet: 12,
  layout: 'paged',
  scalePercent: 100,
  sheetCount: 2,
});
assert.deepEqual(productionPrintApi.productionSchedulePrintConfig(printableSchedule, { layout: 'fit-one' }), {
  dayCount: 13,
  daysPerSheet: 13,
  layout: 'fit-one',
  scalePercent: 100,
  sheetCount: 1,
});
assert.equal(productionPrintApi.productionSchedulePrintConfig(printableSchedule, { layout: 'paged', scalePercent: 50 }).sheetCount, 1);
assert.equal(productionPrintApi.productionSchedulePrintConfig({ dayCount: 40 }, { layout: 'paged', scalePercent: 50 }).sheetCount, 1);
assert.equal(productionPrintApi.productionSchedulePrintConfig({ dayCount: 40 }, { layout: 'paged', scalePercent: 60 }).sheetCount, 2);
assert.equal(productionPrintApi.productionSchedulePrintConfig({ dayCount: 40 }, { layout: 'paged', scalePercent: 100 }).sheetCount, 4);
assert.equal(productionPrintApi.productionSchedulePrintScalePercent(0), 1);
assert.equal(productionPrintApi.productionSchedulePrintScalePercent(250), 100);
assert.equal(productionPrintApi.productionSchedulePrintScalePercent('bad', 63), 63);
assert.equal(productionPrintApi.productionSchedulePrintPageLabel(1), '1 лист');
assert.equal(productionPrintApi.productionSchedulePrintPageLabel(4), '4 листа');
assert.equal(productionPrintApi.productionSchedulePrintPageLabel(12), '12 листов');
const printableHtml = productionPrintApi.productionSchedulePrintDocument(
  { name: 'ЮУРГУ <корпус>', address: 'ул. Тестовая, 1' },
  printableSchedule,
);
assert.equal((printableHtml.match(/<section class="production-print-sheet">/g) || []).length, 2);
assert.match(printableHtml, /@page\{size:A4 landscape;margin:8mm\}/);
assert.match(printableHtml, /print-color-adjust:exact/);
assert.match(printableHtml, /Дни 1–12/);
assert.match(printableHtml, /Дни 13/);
assert.match(printableHtml, /День 13/);
assert.doesNotMatch(printableHtml, /День 14/);
assert.match(printableHtml, /Август 2026/);
assert.match(printableHtml, /Сентябрь 2026/);
assert.match(printableHtml, /25 авг\. · вт/);
assert.match(printableHtml, /6 сент\. · вс/);
assert.match(printableHtml, /rowspan="3"/);
assert.match(printableHtml, /Статусы выполнения графика/);
assert.match(printableHtml, /production-print-slot is-filled tone-green is-overridden/);
assert.equal((printableHtml.match(/Гидроизоляция &lt;основная&gt;/g) || []).length, 2);
assert.match(printableHtml, /ЮУРГУ &lt;корпус&gt;/);
assert.doesNotMatch(printableHtml, /data-production-(?:cell|duration|edit-operation)/);
const fitOneHtml = productionPrintApi.productionSchedulePrintDocument(
  { name: 'ЮУРГУ <корпус>', address: 'ул. Тестовая, 1' },
  printableSchedule,
  { layout: 'fit-one', scalePercent: 100 },
);
assert.equal((fitOneHtml.match(/<section class="production-print-sheet">/g) || []).length, 1);
assert.match(fitOneHtml, /data-production-print-layout="fit-one"/);
assert.match(fitOneHtml, /data-production-print-sheet-count="1"/);
assert.match(fitOneHtml, /data-production-print-canvas style="--production-print-natural-width:284mm"/);
assert.match(fitOneHtml, /Дни 1–13/);
assert.match(fitOneHtml, /День 13/);
assert.equal((fitOneHtml.match(/Гидроизоляция &lt;основная&gt;/g) || []).length, 1);
assert.match(fitOneHtml, /height:194mm[^}]*overflow:hidden[^}]*width:281mm/);
assert.match(fitOneHtml, /transform:scale\(var\(--production-print-scale\)\)/);
const compactPagedHtml = productionPrintApi.productionSchedulePrintDocument(
  { name: 'ЮУРГУ' },
  printableSchedule,
  { layout: 'paged', scalePercent: 50 },
);
assert.equal((compactPagedHtml.match(/<section class="production-print-sheet">/g) || []).length, 1);
assert.match(compactPagedHtml, /data-production-print-layout="paged"/);
assert.match(compactPagedHtml, /data-production-print-scale="50"/);
assert.match(rootCss, /planning\.css\?v=[^"\n]*schedule-health-1/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*schedule-health-1/);
assert.match(baseHtml, /app\.css\?v=20260902-report-ux-r1/);
assert.match(baseHtml, /router\.js\?v=20260903-report-ux-r1/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*production-print-pdf-2/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*production-print-pdf-2/);
assert.match(rootCss, /planning\.css\?v=[^"\n]*production-scroll-wheel-fix-1/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*production-scroll-wheel-fix-1/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*production-scroll-wheel-fix-1/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*production-scroll-wheel-fix-1/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*production-print-scale-1/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*production-print-scale-1/);

console.log('production_schedule_frontend_ok');
