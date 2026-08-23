const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appCss = read('frontend/assets/app.css');
const finalCss = read('frontend/assets/css/ui-final.css');
const baseHtml = read('frontend/templates/base.html');
const loginHtml = read('frontend/templates/login.html');

assert.ok(
  appCss.indexOf('./css/ui-final.css') > appCss.indexOf('./css/ui-workspaces.css'),
  'The Iteration 4 layer must remain last in the cascade',
);

for (const page of ['daily_tasks', 'suppliers', 'companies', 'users', 'autobot']) {
  assert.ok(finalCss.includes(`[data-page="${page}"]`), `Missing final workspace styles for ${page}`);
}
assert.match(finalCss, /body\.login-page\[data-page="login"\]/);

assert.match(finalCss, /body\[data-page="daily_tasks"\] \.daily-task-topline/);
assert.match(finalCss, /body\[data-page="daily_tasks"\] \.daily-task-empty/);
assert.match(finalCss, /body\[data-page="suppliers"\] \[data-suppliers-stats\]/);
assert.match(finalCss, /body\[data-page="companies"\] \.companies-toolbar/);
assert.match(finalCss, /body\[data-page="users"\] \.employee-card/);
assert.match(finalCss, /body\[data-page="autobot"\] \.autobot-offline/);

for (const token of [
  '--color-accent',
  '--color-success',
  '--color-warning',
  '--color-danger',
  '--color-surface-subtle',
]) {
  assert.ok(finalCss.includes(`var(${token})`), `Missing semantic token ${token}`);
}

for (const breakpoint of ['1100px', '900px', '720px', '520px']) {
  assert.match(finalCss, new RegExp(`@media \\(max-width: ${breakpoint}\\)`));
}
assert.match(finalCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(finalCss, /animation: pmbi-fade-in var\(--motion-reveal-duration\) var\(--motion-reveal-easing\) both/);

for (const legacyDecorativeColor of [
  '#fffefa',
  '#fffaf0',
  '#fffbe9',
  '#e2d8c8',
  '#ead8a5',
  '#9f7b16',
  '#fef3c7',
  'rgba(255, 250',
]) {
  assert.equal(
    finalCss.toLowerCase().includes(legacyDecorativeColor.toLowerCase()),
    false,
    `Legacy decorative color remains in ui-final.css: ${legacyDecorativeColor}`,
  );
}

assert.match(appCss, /ui-final\.css\?v=20260821-ui-iteration-4-final/);
assert.match(baseHtml, /ui-iteration-4-final/);
assert.match(loginHtml, /ui-iteration-4-final/);

console.log('ui_iteration4_final_frontend_ok');
