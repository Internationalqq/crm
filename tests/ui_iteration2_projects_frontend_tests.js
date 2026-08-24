const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appCss = read('frontend/assets/app.css');
const projectsCss = read('frontend/assets/css/ui-projects.css');
const projectsHtml = read('frontend/pages/projects.html');
const appJs = read('frontend/assets/js/app.js');

assert.ok(
  appCss.indexOf('./css/ui-projects.css') > appCss.indexOf('./css/ui-system.css'),
  'The projects migration layer must remain last in the cascade',
);

assert.match(projectsCss, /body\[data-page="projects"\] \.projects-card-grid/);
assert.match(projectsCss, /body\[data-page="projects"\] \.project-detail-nav/);
assert.match(projectsCss, /body\[data-page="projects"\] \.project-overview-kpi-grid/);
assert.match(projectsCss, /var\(--color-accent\)/);
assert.match(projectsCss, /var\(--color-success\)/);
assert.match(projectsCss, /var\(--color-warning\)/);
assert.match(projectsCss, /var\(--color-danger\)/);

for (const breakpoint of ['1100px', '900px', '720px', '520px']) {
  assert.match(projectsCss, new RegExp(`@media \\(max-width: ${breakpoint.replace('.', '\\.')}\\)`));
}
assert.match(projectsCss, /@media \(prefers-reduced-motion: reduce\)/);

for (const legacyDecorativeColor of [
  '#fffefa',
  '#fffaf0',
  '#fffbe9',
  '#e2d8c8',
  '#ead8a5',
  '#9f7b16',
  'rgba(255, 250',
]) {
  assert.equal(
    projectsCss.toLowerCase().includes(legacyDecorativeColor.toLowerCase()),
    false,
    `Legacy decorative color remains in ui-projects.css: ${legacyDecorativeColor}`,
  );
}

assert.match(projectsHtml, /data-tab="estimate-reconciliation"/);
assert.match(projectsHtml, /data-panel="estimate-reconciliation"/);
assert.match(appJs, /<div class="projects-card-grid">/);
assert.match(appJs, /<section class="project-command-center">/);

console.log('ui_iteration2_projects_frontend_ok');
