const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appJs = read('frontend/assets/js/app.js');
const appCss = read('frontend/assets/app.css');
const documentsCss = read('frontend/assets/css/documents.css');
const baseHtml = read('frontend/templates/base.html');

assert.match(appCss, /documents\.css\?v=20260823-documents-workspace-1/);
assert.ok(
  appCss.indexOf('documents.css') > appCss.indexOf('finance-redesign.css'),
  'Document styles must be the final feature layer in the cascade',
);
assert.match(baseHtml, /documents-workspace-1/);

assert.match(appJs, /function renderDocumentsWorkspace\(projectId, docs, executive\)/);
assert.match(appJs, /class="documents-hero"/);
assert.match(appJs, /class="document-stats"/);
assert.match(appJs, /class="document-library"/);
assert.match(appJs, /data-document-search/);
assert.match(appJs, /data-document-filter-type/);
assert.match(appJs, /data-document-filter-status/);
assert.match(appJs, /data-document-filter-visibility/);
assert.match(appJs, /function applyFilters\(\)/);
assert.match(appJs, /data-document-filter-reset-empty/);

assert.match(appJs, /if \(!canManageDocuments\(\)\) return '';/);
assert.match(appJs, /data-document-upload-toggle/);
assert.match(appJs, /data-document-upload-close/);
assert.match(appJs, /data-document-dropzone/);
assert.match(appJs, /25 \* 1024 \* 1024/);
assert.match(appJs, /data\.append\('stage_id', form\.stage_id\.value\)/);
assert.match(appJs, /showAppNotice\('Документ загружен\.', 'success'\)/);

assert.match(appJs, /function documentStatusTone\(status\)/);
assert.match(appJs, /class="document-status/);
assert.match(appJs, /Доступен заказчику/);
assert.match(appJs, /Только команда/);
assert.match(appJs, /class="executive-docs-block"/);
assert.match(appJs, /class="executive-progress-track"/);
assert.match(appJs, /data-documents-retry/);

for (const breakpoint of ['1100px', '840px', '620px', '420px']) {
  assert.match(documentsCss, new RegExp(`@media \\(max-width: ${breakpoint.replace('.', '\\.')}\\)`));
}
assert.match(documentsCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(documentsCss, /\.document-upload-form\[hidden\]/);
assert.match(documentsCss, /\.document-row\.document-card/);
assert.match(documentsCss, /\.document-visibility-switch/);

console.log('documents_workspace_frontend_ok');
