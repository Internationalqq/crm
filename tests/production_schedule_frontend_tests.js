const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const coreJs = fs.readFileSync(path.join(root, 'frontend/assets/js/core.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'frontend/assets/js/app.js'), 'utf8');
const planningJs = fs.readFileSync(path.join(root, 'frontend/assets/js/planning.js'), 'utf8');
const projectsHtml = fs.readFileSync(path.join(root, 'frontend/pages/projects.html'), 'utf8');
const planningCss = fs.readFileSync(path.join(root, 'frontend/assets/css/planning.css'), 'utf8');

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
assert.match(planningJs, /bindHorizontalWheelScroll\(qs\('\[data-production-table-scroll\]', panel\)\)/);
assert.match(planningCss, /\.production-schedule-table/);
assert.match(planningCss, /\.production-duration-stepper/);
assert.match(planningCss, /\.production-operation-drawer/);
assert.match(planningCss, /\.production-work-row\.production-phase-blue/);
assert.match(planningCss, /\.production-link-label\.is-review/);
assert.doesNotMatch(planningCss, /production-phase-(?:amber|yellow)/);
assert.doesNotMatch(planningCss, /\.production-section-row th\s*\{[^}]*#f1e33b/s);
assert.match(planningCss, /position: sticky/);

console.log('production_schedule_frontend_ok');
