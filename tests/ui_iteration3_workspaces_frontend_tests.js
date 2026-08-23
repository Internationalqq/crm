const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appCss = read('frontend/assets/app.css');
const workspaceCss = read('frontend/assets/css/ui-workspaces.css');
const warehouseHtml = read('frontend/pages/warehouse.html');
const procurementJs = read('frontend/assets/js/procurement.js');
const baseHtml = read('frontend/templates/base.html');
const loginHtml = read('frontend/templates/login.html');

assert.ok(
  appCss.indexOf('./css/ui-workspaces.css') > appCss.indexOf('./css/ui-projects.css'),
  'The Iteration 3 workspace layer must remain last in the cascade',
);

for (const page of ['schedule', 'warehouse', 'logs']) {
  assert.match(workspaceCss, new RegExp(`body\\[data-page="${page}"\\]`));
}

assert.match(workspaceCss, /body\[data-page="schedule"\] \.schedule-project-toggle/);
assert.match(workspaceCss, /body\[data-page="schedule"\] \.section-schedule-empty:empty/);
assert.match(workspaceCss, /body\[data-page="warehouse"\] \.warehouse-head-actions/);
assert.match(workspaceCss, /body\[data-page="warehouse"\] \.warehouse-table/);
assert.match(workspaceCss, /body\[data-page="logs"\] \.logs-calendar-shell/);
assert.match(workspaceCss, /body\[data-page="logs"\] \.report-archive-card/);

for (const token of [
  '--color-accent',
  '--color-success',
  '--color-warning',
  '--color-danger',
  '--color-surface-subtle',
]) {
  assert.ok(workspaceCss.includes(`var(${token})`), `Missing semantic token ${token}`);
}

for (const breakpoint of ['1100px', '900px', '720px', '520px']) {
  assert.match(workspaceCss, new RegExp(`@media \\(max-width: ${breakpoint}\\)`));
}
assert.match(workspaceCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(workspaceCss, /animation: pmbi-fade-in var\(--motion-reveal-duration\) var\(--motion-reveal-easing\) both/);

for (const legacyDecorativeColor of [
  '#fffefa',
  '#fffaf0',
  '#fffbe9',
  '#e2d8c8',
  '#ead8a5',
  '#9f7b16',
  'rgba(255,250',
  'rgba(255, 250',
]) {
  assert.equal(
    workspaceCss.toLowerCase().includes(legacyDecorativeColor.toLowerCase()),
    false,
    `Legacy decorative color remains in ui-workspaces.css: ${legacyDecorativeColor}`,
  );
}

assert.match(warehouseHtml, /data-warehouse-receipt-open><i data-lucide="package-plus"/);
assert.doesNotMatch(warehouseHtml, /data-warehouse-receipt-open>\+/);
assert.match(warehouseHtml, /Склад компании/);
assert.match(warehouseHtml, /Принять на склад/);
assert.match(warehouseHtml, /class="warehouse-filter-box"/);
assert.match(workspaceCss, /Warehouse simplification: physical inventory first/);
assert.match(procurementJs, /<th>Что на складе<\/th><th>Остаток<\/th><th><\/th>/);
assert.match(procurementJs, /Сейчас в наличии/);
assert.match(procurementJs, /Ничего не найдено/);
assert.match(baseHtml, /ui-project-schedule-cleanup-4/);
assert.match(loginHtml, /ui-project-schedule-cleanup-4/);

console.log('ui_iteration3_workspaces_frontend_ok');
