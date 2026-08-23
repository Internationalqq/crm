const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appCss = read('frontend/assets/app.css');
const tokensCss = read('frontend/assets/css/tokens.css');
const uiCss = read('frontend/assets/css/ui-system.css');
const baseHtml = read('frontend/templates/base.html');

assert.ok(
  appCss.indexOf('./css/ui-system.css') > appCss.indexOf('./css/overrides.css'),
  'The semantic UI layer must remain last in the cascade',
);

for (const token of [
  '--color-accent:',
  '--color-success:',
  '--color-warning:',
  '--color-danger:',
  '--color-surface:',
  '--color-text:',
]) {
  assert.match(tokensCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(tokensCss, /--green:\s*var\(--color-accent\)/);
assert.match(tokensCss, /--sand:\s*var\(--color-surface-subtle\)/);
assert.match(uiCss, /body\[data-page="dashboard"\] \.dashboard-hero/);
assert.match(uiCss, /@media \(max-width: 1100px\)/);
assert.match(uiCss, /@media \(max-width: 900px\)/);
assert.match(uiCss, /@media \(max-width: 720px\)/);
assert.match(uiCss, /@media \(max-width: 520px\)/);
assert.match(uiCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(baseHtml, /data-menu-toggle[\s\S]*data-lucide="panel-left"/);

for (const legacyDecorativeColor of [
  '#fffefa',
  '#fffaf0',
  '#fffbe9',
  '#e2d8c8',
  '#d7e3dd',
  'rgba(255, 250',
  'rgba(31,185',
  'rgba(23,133',
]) {
  assert.equal(
    uiCss.toLowerCase().includes(legacyDecorativeColor.toLowerCase()),
    false,
    `Legacy decorative color remains in ui-system.css: ${legacyDecorativeColor}`,
  );
}

console.log('ui_iteration1_frontend_ok');
