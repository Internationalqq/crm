const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appCss = read('frontend/assets/app.css');
const visualCss = read('frontend/assets/css/visual-storytelling.css');
const dashboard = read('frontend/pages/dashboard.html');
const autobot = read('frontend/pages/autobot.html');
const app = read('frontend/assets/js/app.js');

const imageNames = [
  'dashboard-construction.webp',
  'autobot-construction-ai.webp',
  'project-cover-site.webp',
  'project-cover-interior.webp',
  'project-cover-exterior.webp',
];

for (const name of imageNames) {
  const imagePath = path.join(root, 'frontend/assets/images', name);
  assert.ok(fs.existsSync(imagePath), `${name} must exist`);
  const size = fs.statSync(imagePath).size;
  assert.ok(size > 20_000, `${name} must contain a real optimized image`);
  assert.ok(size < 260_000, `${name} must stay lightweight enough for CRM navigation`);
  assert.ok(visualCss.includes(name) || app.includes(name), `${name} must be referenced by the visual layer`);
}

assert.ok(
  appCss.indexOf('./css/visual-storytelling.css') > appCss.indexOf('./css/object-control.css'),
  'the photo layer must load after the existing object-control workspace',
);
assert.match(dashboard, /dashboard-autobot-card hidden" data-nav="autobot"/);
assert.match(dashboard, /Запустить AutoBot/);
assert.match(dashboard, /Оперативная сводка/);
assert.match(autobot, /data-lucide="bot"/);

assert.match(app, /PROJECT_COVER_FALLBACKS/);
assert.match(app, /cover_photo_url/);
assert.match(app, /project-card-cover-media/);
assert.match(app, /dashboard-project-cover/);
assert.match(app, /data-project-cover-image/);
assert.match(app, /object-photo-grid/);
assert.match(app, /document-file-visual has-image/);
assert.match(app, /loading="lazy" decoding="async"/);

assert.match(visualCss, /\.nav a\[data-nav="autobot"\]/);
assert.match(visualCss, /body\[data-page="autobot"\] \.autobot-workspace-head/);
assert.match(visualCss, /@media \(max-width: 720px\)/);
assert.match(visualCss, /@media \(prefers-reduced-motion: reduce\)/);

console.log('visual_storytelling_frontend_ok');
