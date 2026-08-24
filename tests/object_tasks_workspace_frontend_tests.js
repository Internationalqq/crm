const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appJs = read('frontend/assets/js/app.js');
const appCss = read('frontend/assets/app.css');
const tasksCss = read('frontend/assets/css/tasks.css');
const baseHtml = read('frontend/templates/base.html');
const routerJs = read('frontend/assets/js/router.js');

assert.equal((appJs.match(/function renderTasks\(/g) || []).length, 1, 'Only the current task renderer should remain');
assert.match(appJs, /data-task-workspace/);
assert.match(appJs, /data-task-filter-query/);
assert.match(appJs, /data-task-filter-assignee/);
assert.match(appJs, /data-task-filter-priority/);
assert.match(appJs, /data-task-filter-deadline/);
assert.match(appJs, /data-task-quick-status/);
assert.match(appJs, /data-task-card-editor/);
assert.match(appJs, /data-task-drag-handle/);
assert.match(appJs, /handle: '\[data-task-drag-handle\]'/);
assert.match(appJs, /title: form\.title \? form\.title\.value\.trim\(\)/);
assert.match(appJs, /description: form\.description \? form\.description\.value\.trim\(\)/);
assert.match(appJs, /function canCreateProjectTask\(\)/);
assert.doesNotMatch(appJs, /class="inline-form" data-task-form/);

assert.ok(appCss.includes('./css/tasks.css?v=20260823-object-tasks-workspace-1'));
assert.ok(appCss.indexOf('./css/tasks.css') > appCss.indexOf('./css/components.css'), 'Task workspace CSS must follow legacy component styles');
assert.match(baseHtml, /app\.css\?v=[^"\s]*object-tasks-workspace-1/);
assert.match(routerJs, /app\.js\?v=[^'\s]*object-tasks-workspace-1/);

for (const selector of [
  '.task-workspace-head',
  '.task-overview',
  '.task-toolbar',
  '.tasks-board',
  '.task-card-editor',
  '.task-zero-state',
  '.task-create-dialog',
]) {
  assert.ok(tasksCss.includes(selector), `Missing task workspace style: ${selector}`);
}

for (const token of [
  '--color-accent',
  '--color-success',
  '--color-danger',
  '--color-surface',
  '--color-border',
]) {
  assert.ok(tasksCss.includes(`var(${token})`), `Missing semantic design token: ${token}`);
}

assert.match(tasksCss, /@media \(max-width: 760px\)/);
assert.match(tasksCss, /@media \(max-width: 480px\)/);
assert.match(tasksCss, /@media \(prefers-reduced-motion: reduce\)/);

console.log('object_tasks_workspace_frontend_ok');
