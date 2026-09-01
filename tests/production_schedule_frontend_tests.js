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
const productionScrollerClasses = {};
const productionWorkTitle = {
  getBoundingClientRect() {
    return { left: 44, right: 434 };
  },
};
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
  classList: {
    toggle(name, enabled) {
      productionScrollerClasses[name] = enabled;
    },
    remove(...names) {
      names.forEach((name) => { productionScrollerClasses[name] = false; });
    },
  },
  scrollWidth: 1000,
  clientWidth: 400,
  scrollLeft: 100,
  scrollHeight: 1000,
  clientHeight: 400,
  scrollTop: 0,
  getBoundingClientRect() {
    return { left: 0, right: 900 };
  },
  closest(selector) {
    if (selector === '[data-production-table-shell]') return productionShell;
    if (selector === '[data-production-schedule-card]') return productionScheduleCard;
    throw new Error(`Unexpected closest selector: ${selector}`);
  },
  addEventListener(type, handler, options) {
    productionScrollHandlers[type] = handler;
    productionScrollOptions[type] = options;
  },
};
const productionScrollApi = new Function(
  'qs',
  'window',
  `${planningJs.slice(productionScrollStart, productionScrollEnd)}\nreturn { bindProductionScheduleScroll, syncProductionScheduleScroll };`,
)((selector, root) => {
  if (selector === '.production-work-title') {
    assert.equal(root, productionScroller);
    return productionWorkTitle;
  }
  throw new Error(`Unexpected selector: ${selector}`);
}, productionWindow);
productionScrollApi.bindProductionScheduleScroll(productionScroller);
assert.deepEqual(productionScrollOptions.scroll, { passive: true });
assert.deepEqual(productionScrollOptions.pointermove, { passive: true });
assert.deepEqual(productionScrollOptions.pointerleave, { passive: true });
assert.deepEqual(productionScrollOptions.wheel, { passive: false });
let productionWheelPrevented = 0;
const productionWheelEvent = (overrides = {}) => ({
  defaultPrevented: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  deltaX: 0,
  deltaY: 90,
  deltaMode: 0,
  clientX: 700,
  target: {
    closest(selector) {
      assert.equal(selector, '.production-number-cell, .production-work-title');
      return null;
    },
  },
  preventDefault() { productionWheelPrevented += 1; },
  ...overrides,
});
const frozenColumnTarget = {
  closest(selector) {
    assert.equal(selector, '.production-number-cell, .production-work-title');
    return { className: 'production-work-title' };
  },
};
productionScrollHandlers.pointermove(productionWheelEvent({ clientX: 200 }));
assert.equal(productionScrollerClasses['is-wheel-vertical-zone'], true);
assert.equal(productionScrollerClasses['is-wheel-horizontal-zone'], false);
productionScrollHandlers.pointermove(productionWheelEvent({ clientX: 700 }));
assert.equal(productionScrollerClasses['is-wheel-vertical-zone'], false);
assert.equal(productionScrollerClasses['is-wheel-horizontal-zone'], true);
productionScrollHandlers.pointerleave();
assert.equal(productionScrollerClasses['is-wheel-vertical-zone'], false);
assert.equal(productionScrollerClasses['is-wheel-horizontal-zone'], false);
productionScrollHandlers.wheel(productionWheelEvent({ target: frozenColumnTarget, clientX: 200 }));
assert.equal(productionScroller.scrollLeft, 100, 'Wheel over the frozen name area must remain vertical');
assert.equal(productionScroller.scrollTop, 0);
assert.deepEqual(productionPageScrolls, [[0, 90]], 'The page must move until the production card reaches the viewport');
assert.equal(productionWheelPrevented, 1);
productionCardTop = 38;
productionScrollHandlers.wheel(productionWheelEvent({ clientX: 200 }));
assert.equal(productionScroller.scrollLeft, 100, 'The visual left zone of a colspan row must remain vertical');
assert.equal(productionScroller.scrollTop, 60, 'The remaining wheel delta must continue inside the table');
assert.deepEqual(productionPageScrolls.at(-1), [0, 30]);
assert.equal(productionWheelPrevented, 2);
productionCardTop = 8;
productionScroller.scrollTop = 30;
productionScrollHandlers.wheel(productionWheelEvent({ target: frozenColumnTarget, clientX: 200, deltaY: -90 }));
assert.equal(productionScroller.scrollTop, 0);
assert.deepEqual(productionPageScrolls.at(-1), [0, -60], 'Unused upward delta must return to page scrolling');
productionScroller.scrollTop = 580;
productionScrollHandlers.wheel(productionWheelEvent({ target: frozenColumnTarget, clientX: 200, deltaY: 90 }));
assert.equal(productionScroller.scrollTop, 600);
assert.deepEqual(productionPageScrolls.at(-1), [0, 70], 'Unused downward delta must continue down the page');
productionWheelPrevented = 0;
productionScrollHandlers.wheel(productionWheelEvent());
assert.equal(productionScroller.scrollLeft, 190, 'Wheel over the timeline must move it horizontally without Shift');
assert.equal(productionWheelPrevented, 1);
productionScrollHandlers.wheel(productionWheelEvent({ deltaX: 80, deltaY: 10 }));
assert.equal(productionScroller.scrollLeft, 270, 'Horizontal trackpad input must stay inside the timeline zone');
assert.equal(productionWheelPrevented, 2);
productionScrollHandlers.wheel(productionWheelEvent({ shiftKey: true }));
assert.equal(productionScroller.scrollLeft, 360, 'Shift + wheel may still move the production timeline');
assert.equal(productionWheelPrevented, 3);
productionScroller.scrollLeft = 600;
productionScrollHandlers.wheel(productionWheelEvent({ shiftKey: true, deltaY: 90 }));
assert.equal(productionScroller.scrollLeft, 600);
assert.equal(productionWheelPrevented, 4, 'The right zone must remain horizontal at the right edge');
productionScroller.scrollLeft = 0;
productionScrollHandlers.wheel(productionWheelEvent({ deltaY: -90 }));
assert.equal(productionScroller.scrollLeft, 0);
assert.equal(productionWheelPrevented, 5, 'The right zone must remain horizontal at the left edge');
productionScrollHandlers.wheel(productionWheelEvent({ deltaY: 90 }));
assert.equal(productionScroller.scrollLeft, 90, 'The timeline must scroll inward from the left edge');
assert.equal(productionWheelPrevented, 6);
productionScroller.scrollWidth = productionScroller.clientWidth;
productionScrollHandlers.wheel(productionWheelEvent({ deltaY: 90 }));
assert.equal(productionScroller.scrollLeft, 0, 'A non-overflowing right zone must not move');
assert.equal(productionWheelPrevented, 7, 'The right zone must keep its horizontal mode even without travel');
productionScroller.scrollWidth = 1000;
assert.match(planningCss, /\.production-schedule-table/);
assert.match(planningCss, /\.production-duration-stepper/);
assert.match(planningCss, /\.production-operation-drawer/);
assert.match(planningCss, /\.production-work-row\.production-phase-blue/);
assert.match(planningCss, /\.production-link-label\.is-review/);
assert.doesNotMatch(planningCss, /production-phase-(?:amber|yellow)/);
assert.doesNotMatch(planningCss, /\.production-section-row th\s*\{[^}]*#f1e33b/s);
assert.match(planningCss, /position: sticky/);
assert.doesNotMatch(planningJs, /data-production-sticky-header/);
assert.equal((planningJs.match(/\+ tableHeader \+/g) || []).length, 1, 'The schedule must render one real table header');
assert.match(planningJs, /Колесо: над названием — вверх\/вниз, над графиком — по дням/);
assert.match(planningCss, /\.production-table-scroll\s*\{[^}]*max-height: min\(64vh, 600px\);[^}]*overflow-x: auto;[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/s);
assert.match(planningCss, /@media \(min-width: 721px\)[\s\S]*?\[data-panel="production-schedule"\]\.active \.production-schedule-card\s*\{[^}]*height: calc\(100dvh - 16px\);[^}]*position: sticky;[^}]*top: 8px;/s);
assert.match(planningCss, /\[data-panel="production-schedule"\]\.active \.production-table-shell\s*\{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow: hidden;/s);
assert.match(planningCss, /\[data-panel="production-schedule"\]\.active \.production-table-scroll\s*\{[^}]*height: 100%;[^}]*max-height: none;/s);
assert.match(planningJs, /function scrollProductionScheduleVertically/);
assert.match(planningJs, /window\.scrollBy\(0, pageStep\)/);
assert.doesNotMatch(planningCss, /\.production-table-sticky-header/);
assert.match(planningCss, /\.production-cell-toggle\s*\{[^}]*inset: 0;[^}]*position: absolute;/s);
assert.match(planningCss, /\.production-day-half-cell\s*\{[^}]*position: relative;/s);
assert.match(planningCss, /\.production-table-scroll\s*\{[^}]*cursor: ew-resize;/s);
assert.match(planningCss, /\.production-schedule-table \.production-number-cell,[\s\S]*?\.production-schedule-table \.production-work-title\s*\{[^}]*cursor: ns-resize;/s);
assert.match(planningCss, /\.production-cell-toggle\s*\{[^}]*cursor: ew-resize;/s);
assert.match(planningJs, /function productionPointerOverFrozenColumns/);
assert.match(planningJs, /is-wheel-vertical-zone/);
assert.match(planningJs, /is-wheel-horizontal-zone/);
assert.match(planningCss, /\.production-schedule-table\s*\{[^}]*--production-number-width: 40px;[^}]*--production-work-width: 340px;/s);
assert.match(planningCss, /\.production-schedule-table th,\s*\.production-schedule-table td\s*\{[^}]*height: 30px;[^}]*vertical-align: middle;/s);
assert.match(planningCss, /\.production-schedule-table thead th\s*\{[^}]*height: 58px;[^}]*position: sticky;[^}]*top: 0;/s);
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
assert.match(rootCss, /planning\.css\?v=[^"\n]*production-sticky-viewport-8/);
assert.match(routerJs, /planning\.js\?v=[^'\n]*production-sticky-viewport-8/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*production-sticky-viewport-8/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*production-sticky-viewport-8/);

console.log('production_schedule_frontend_ok');
