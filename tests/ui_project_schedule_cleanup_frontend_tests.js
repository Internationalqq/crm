const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const planningJs = read('frontend/assets/js/planning.js');
const projectsCss = read('frontend/assets/css/ui-projects.css');
const appCss = read('frontend/assets/app.css');
const baseHtml = read('frontend/templates/base.html');
const loginHtml = read('frontend/templates/login.html');

assert.match(planningJs, /<h3>Материалы и работы<\/h3>/);
assert.match(planningJs, /var marketLabel = 'Анализ рынка'/);
assert.match(planningJs, /Работы и материалы по разделам сметы с фактическим прогрессом/);
assert.match(planningJs, /Цены, предложения, поставщики и подрядчики по позициям сметы/);
assert.match(planningJs, /data-lucide="calendar-cog"/);

const detailsMarkupStart = planningJs.indexOf('var details =');
const detailsMarkup = planningJs.slice(
  detailsMarkupStart,
  planningJs.indexOf("return '<article class=\"section-schedule-card", detailsMarkupStart),
);
assert.ok(
  detailsMarkup.indexOf('\\u041c\\u0430\\u0442\\u0435\\u0440\\u0438\\u0430\\u043b\\u044b') <
    detailsMarkup.indexOf('\\u0420\\u0430\\u0431\\u043e\\u0442\\u044b'),
  'Materials must render before works in the expanded section grid',
);

for (const removedListControl of [
  'schedule-work-duration-metrics',
  '<small>Бригада</small>',
  '<small>Дней</small>',
  'Укрупнённо',
  'renderScheduleCounterpartyFilters',
]) {
  assert.equal(
    planningJs.includes(removedListControl),
    false,
    `The execution list still renders removed planning control: ${removedListControl}`,
  );
}

assert.match(projectsCss, /\[data-panel="schedule"\] \.schedule-project-topbar/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.project-schedule-view-switcher\.market-toolbar/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.estimate-section-progress-split/);
assert.match(projectsCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-progress-bar/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-progress-value/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-chevron[\s\S]*?display: none !important/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-presence/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-detail-list \.material-chain-actions/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-detail-list \.quantity-actual-editor/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-detail-list \.material-delivery-field/);
assert.match(projectsCss, /\[data-panel="schedule"\] \.section-schedule-detail-list \.estimate-compact-side/);
assert.match(projectsCss, /height: 9px !important/);

assert.match(appCss, /ui-projects\.css\?v=20260821-ui-project-schedule-cleanup-4/);
assert.match(baseHtml, /ui-project-schedule-cleanup-4/);
assert.match(loginHtml, /ui-project-schedule-cleanup-4/);

console.log('ui_project_schedule_cleanup_frontend_ok');
