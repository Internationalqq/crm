const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appCss = read('frontend/assets/app.css');
const tokensCss = read('frontend/assets/css/tokens.css');
const qaCss = read('frontend/assets/css/ui-qa.css');
const skeletonCss = read('frontend/assets/css/skeletons.css');
const overridesCss = read('frontend/assets/css/overrides.css');
const coreJs = read('frontend/assets/js/core.js');
const appJs = read('frontend/assets/js/app.js');
const autobotJs = read('frontend/assets/js/autobot.js');
const operationsJs = read('frontend/assets/js/operations.js');
const procurementJs = read('frontend/assets/js/procurement.js');
const planningJs = read('frontend/assets/js/planning.js');
const economicsJs = read('frontend/assets/js/economics-management.js');
const reconciliationJs = read('frontend/assets/js/estimate-reconciliation.js');
const warehouseControlJs = read('frontend/assets/js/warehouse-control.js');
const baseHtml = read('frontend/templates/base.html');
const loginHtml = read('frontend/templates/login.html');

assert.ok(
  appCss.indexOf('./css/ui-qa.css') > appCss.indexOf('./css/ui-final.css'),
  'The QA layer must remain last in the cascade',
);

for (const token of [
  '--color-accent',
  '--color-success',
  '--color-warning',
  '--color-danger',
  '--color-surface',
  '--color-surface-subtle',
]) {
  assert.ok(qaCss.includes(`var(${token})`), `Missing semantic token ${token}`);
}

assert.match(qaCss, /\.daily-avatar-boss/);
assert.match(qaCss, /\.task-priority-normal/);
assert.match(qaCss, /\.material-calendar-card\.is-start/);
assert.match(qaCss, /\.material-calendar-card\.is-warning/);
assert.match(qaCss, /\.reconciliation-empty/);
assert.match(qaCss, /\.quick-alert-detail:hover/);
assert.match(qaCss, /\.warehouse-table tr\.row-risk td/);
assert.match(qaCss, /\.finance-status-track:not\(\.is-cancelled\)/);
assert.match(qaCss, /scheduleMaterialCalendarFocusBlue/);
assert.match(qaCss, /@media \(prefers-reduced-motion: reduce\)/);

const fadeKeyframes = overridesCss.match(/@keyframes pmbi-fade-in\s*\{([\s\S]*?)\n\}/);
assert.ok(fadeKeyframes, 'The shared page reveal animation must exist');
assert.match(fadeKeyframes[1], /opacity:\s*0/);
assert.match(fadeKeyframes[1], /opacity:\s*1/);
assert.doesNotMatch(fadeKeyframes[1], /transform:/, 'Page reveals must use opacity without movement');
assert.match(overridesCss, /body\.login-page \.login-card/);
assert.match(tokensCss, /--motion-reveal-duration:\s*420ms/);
assert.match(tokensCss, /--motion-reveal-easing:\s*cubic-bezier\(\.4, 0, \.2, 1\)/);

assert.ok(
  appCss.indexOf('./css/skeletons.css') > appCss.indexOf('./css/autobot.css'),
  'The shared skeleton layer must remain last in the cascade',
);
assert.match(skeletonCss, /\.pmbi-skeleton-view--stats/);
assert.match(skeletonCss, /\.pmbi-skeleton-view--table/);
assert.match(skeletonCss, /\.pmbi-autobot-skeleton/);
assert.match(skeletonCss, /\[data-daily-task-feed\]/);
assert.match(skeletonCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(coreJs, /function skeletonMarkup\(variant, count\)/);
assert.match(coreJs, /function showSkeleton\(container, variant, count\)/);
assert.match(appJs, /showSkeleton\(financePanel, 'panel', 1\)/);
assert.match(operationsJs, /showSkeleton\(root, 'team', 3\)/);
assert.match(procurementJs, /showSkeleton\(root, 'table', 1\)/);
assert.match(planningJs, /skeletonMarkup\('table', 1\)/);
assert.match(economicsJs, /skeletonMarkup\('table', 1\)/);
assert.match(reconciliationJs, /showSkeleton\(panel, 'table', 1\)/);
assert.match(warehouseControlJs, /showSkeleton\(panel, 'table', 1\)/);
assert.match(autobotJs, /frame\.classList\.add\('is-ready'\)/);
assert.match(autobotJs, /hideAutobotLoading\(loading\)/);

for (const pageFile of [
  'dashboard.html',
  'daily_tasks.html',
  'projects.html',
  'schedule.html',
  'logs.html',
  'warehouse.html',
  'suppliers.html',
  'companies.html',
  'users.html',
  'autobot.html',
]) {
  const pageHtml = read(`frontend/pages/${pageFile}`);
  assert.match(pageHtml, /data-pmbi-skeleton=/, `Missing loading skeleton in ${pageFile}`);
}

for (const legacyDecorativeColor of [
  '#fffefa',
  '#fffaf0',
  '#fffbe9',
  '#fff2df',
  '#e2d8c8',
  '#ead8a5',
  '#fef3c7',
  'rgba(255,250',
]) {
  assert.equal(
    qaCss.toLowerCase().includes(legacyDecorativeColor.toLowerCase()),
    false,
    `Legacy decorative color remains in ui-qa.css: ${legacyDecorativeColor}`,
  );
}

assert.match(appCss, /ui-qa\.css\?v=20260821-ui-final-qa-1/);
assert.match(appCss, /overrides\.css\?v=20260821-mist-fade-2/);
assert.match(appCss, /skeletons\.css\?v=20260821-crm-skeletons-1/);
assert.match(baseHtml, /ui-final-qa-1/);
assert.doesNotMatch(loginHtml, /assets\/app\.css/);
assert.match(loginHtml, /assets\/css\/ui-system\.css/);
assert.match(loginHtml, /assets\/css\/ui-final\.css/);
assert.match(baseHtml, /mist-fade-3-crm-skeletons-1/);
assert.match(loginHtml, /login-fast-1/);

console.log('ui_final_qa_frontend_ok');
