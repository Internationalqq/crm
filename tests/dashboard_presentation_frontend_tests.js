const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/app.js'), 'utf8');
const start = source.indexOf('    function renderDashboardProjects(');
const end = source.indexOf('\n    function ', start + 10);
const root = {innerHTML: ''};
const context = {
  qs: () => root,
  isCompletedProject: p => p.status === 'Завершён',
  percent: value => value,
  projectCoverVisual: p => ({uploaded: Boolean(p.cover), url: p.cover || '/decorative-fallback.webp'}),
  escapeHtml: value => String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
context.renderDashboardProjects([{id: 25, title: 'Корпус <А>', progress: 14, status: 'В работе'}]);
assert.match(root.innerHTML, /Корпус &lt;А&gt;/);
assert.match(root.innerHTML, /openProject=25/);
assert.match(root.innerHTML, /14%/);
assert.match(root.innerHTML, /В работе/);
assert.doesNotMatch(root.innerHTML, /<img|decorative-fallback/);
context.renderDashboardProjects([{id: 25, title: 'Объект', progress: 50, cover: '/api/documents/12/view'}]);
assert.match(root.innerHTML, /<img src="\/api\/documents\/12\/view"/);
context.renderDashboardProjects([]);
assert.match(root.innerHTML, /Пока нет объектов/);
console.log('dashboard_presentation_frontend_ok');
