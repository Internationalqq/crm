const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const dailyTasksJs = fs.readFileSync(path.join(root, 'frontend/assets/js/daily-tasks.js'), 'utf8');
const overridesCss = fs.readFileSync(path.join(root, 'frontend/assets/css/overrides.css'), 'utf8');

test('daily task rows expose an end menu with edit and delete actions', () => {
  assert.match(dailyTasksJs, /data-daily-task-menu-toggle/);
  assert.match(dailyTasksJs, /data-daily-task-edit/);
  assert.match(dailyTasksJs, /data-daily-task-delete/);
  assert.match(dailyTasksJs, /function dailyTaskCanManage\(task\)/);
  assert.match(dailyTasksJs, /canManageDailyTasks\(\) \|\| dailyTaskCanComplete\(task\)/);
  assert.match(overridesCss, /\.daily-task-menu-panel/);
  assert.match(overridesCss, /\.daily-task-menu-wrap[\s\S]*margin-left: auto/);
});

test('daily task edit dialog saves text and supports manager reassignment', () => {
  assert.match(dailyTasksJs, /data-daily-edit-modal/);
  assert.match(dailyTasksJs, /Редактировать задачу/);
  assert.match(dailyTasksJs, /userId: form\.userId/);
  assert.match(dailyTasksJs, /return updateDailyTask\(task\.id/);
});

test('daily task deletion uses a centered custom confirmation dialog', () => {
  assert.match(dailyTasksJs, /data-daily-delete-modal/);
  assert.match(dailyTasksJs, /role="alertdialog"/);
  assert.match(dailyTasksJs, /function openDailyDeleteModal\(task, source\)/);
  assert.doesNotMatch(dailyTasksJs, /window\.confirm\('Удалить задачу/);
  assert.match(dailyTasksJs, /База данных временно недоступна\. Попробуйте удалить задачу ещё раз\./);
  assert.match(overridesCss, /\.daily-task-delete-dialog[\s\S]*width: min\(440px/);
  assert.match(overridesCss, /\.daily-task-delete-actions/);
});
