const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../frontend/assets/js', name), 'utf8');
function fn(source, name) {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n    function ', start + 10));
}
const context = {state: {scheduleQuickActions: {}}, escapeHtml: String, normalizeTaskTitle: value => String(value).trim().toLowerCase()};
vm.createContext(context);
vm.runInContext(fn(read('core.js'), 'formatDisplayDate') + fn(read('app.js'), 'documentDisplayDate'), context);
const timestamp = new Date(2026, 8, 13, 12).getTime();
for (const value of [timestamp, String(timestamp), timestamp / 1000, String(timestamp / 1000), '2026-09-13T12:00:00', '2026-09-13']) {
  assert.equal(context.documentDisplayDate({created_at: value}), '13.09.2026');
}
assert.equal(context.documentDisplayDate({created_at: '2026-09-12', updated_at: '2026-09-14'}), '14.09.2026');
assert.equal(context.documentDisplayDate({}), '');
assert.equal(context.documentDisplayDate(null), '');
assert.equal(context.documentDisplayDate({created_at: '99999999999999999999999999'}), '');
const planning = read('planning.js');
vm.runInContext(fn(planning, 'buildScheduleActions'), context);
const root = {innerHTML: ''};
context.qs = () => root;
vm.runInContext(fn(planning, 'renderLogsAlerts'), context);
for (const [today, formatted] of [['2026-09-13', '13.09.2026'], ['2027-01-01', '01.01.2027']]) {
  context.APP_TODAY = today;
  const action = context.buildScheduleActions({id: 25, title: 'Объект'}, [], {missingDailyReport: true}, [], [])[0];
  assert.ok(action.title.includes(formatted));
  assert.ok(action.taskPayload.description.includes(formatted));
  assert.equal(action.taskPayload.due_at, today);
  context.renderLogsAlerts({missingDailyReport: true});
  assert.ok(root.innerHTML.includes(formatted));
}
console.log('Display dates: document timestamps, ISO dates, invalid dates and current report reminders passed');
