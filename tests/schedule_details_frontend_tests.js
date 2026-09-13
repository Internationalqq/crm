const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../frontend/assets/js', name), 'utf8');
const app = read('app.js');
const planning = read('planning.js');
function fn(source, name) {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n    function ', start + 10);
  return source.slice(start, end);
}
const context = {
  PMBI: {app: {}},
  escapeHtml: value => String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  percent: value => value,
  canManageSchedule: () => true,
  renderSectionScheduleForecast: () => '<div>Прогноз</div>',
  renderScheduleActionCenter: () => '<div>Действия</div>',
  renderScheduleCalendar: () => '<div>Календарь</div>',
  renderStages: stages => '<div>Этапов: ' + stages.length + '</div>',
};
vm.createContext(context);
vm.runInContext(fn(app, 'dataItem'), context);
const exported = app.split('\n').find(line => line.includes('PMBI.app.dataItem ='));
assert.ok(exported, 'The app must publish the shared escaped data renderer');
vm.runInContext(exported, context);
vm.runInContext(fn(planning, 'appCall') + fn(planning, 'dataItem') + fn(planning, 'renderScheduleProjectDetails'), context);
const project = {id: 25, client_name: '<Заказчик>', address: 'Корпус А', progress: 14};
let html = context.renderScheduleProjectDetails(project, {stages: [{id: 1}]});
assert.match(html, /&lt;Заказчик&gt;/);
assert.match(html, /Корпус А/);
assert.match(html, /14%/);
assert.match(html, /Автоплан графика/);
assert.match(html, /Календарь/);
assert.match(html, /Этапов: 1/);
context.canManageSchedule = () => false;
html = context.renderScheduleProjectDetails(project, {});
assert.doesNotMatch(html, /data-auto-schedule-open/);
assert.match(html, /Этапы объекта пока не заполнены/);
// The schedule route must render real rows without loading the operations module.
const core = read('core.js');
for (const name of ['percent', 'isTimelineStageStarted', 'timelineStageKindClass', 'timelineStageKindLabel', 'renderTimelineProgressCell']) {
  vm.runInContext(fn(core, name), context);
  context.PMBI[name] = context[name];
}
for (const name of ['isTimelineStageStarted', 'timelineStageKindClass', 'timelineStageKindLabel', 'renderTimelineProgressCell']) {
  const binding = planning.split('\n').find(line => line.includes('var ' + name + ' ='));
  assert.ok(binding, name);
  vm.runInContext(binding, context);
}
Object.assign(context, {APP_TODAY: '2026-09-13', statusLabel: value => value,
  buildScheduleStageSummary: () => 'План', scheduleTimelineClass: () => '', renderScheduleStageBadges: () => ''});
vm.runInContext(fn(planning, 'renderScheduleRows'), context);
html = context.renderScheduleRows([
  {title: '<Раздел>', stage_kind: 'section', progress: 14, responsible: 'Прораб'},
  {title: 'Подраздел', stage_kind: 'subsection', progress: 0},
  {title: 'Работа', progress: 90, status_code: 'approved'},
], false);
assert.match(html, /timeline-row-section/);
assert.match(html, /&lt;Раздел&gt;/);
assert.match(html, /Прораб/);
assert.match(html, /14%/);
assert.match(html, /Нет факта/);
assert.match(html, /100%/);
assert.doesNotMatch(context.renderScheduleRows([{title: 'Работа', responsible: 'Скрытый прораб'}], true), /Скрытый прораб/);
console.log('schedule_details_frontend_ok');
