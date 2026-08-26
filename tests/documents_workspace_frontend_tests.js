const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appJs = read('frontend/assets/js/app.js');
const appCss = read('frontend/assets/app.css');
const documentsCss = read('frontend/assets/css/documents.css');
const baseHtml = read('frontend/templates/base.html');
const coreJs = read('frontend/assets/js/core.js');
const routerJs = read('frontend/assets/js/router.js');
const workspaceStart = appJs.lastIndexOf('var documentWorkspaceCleanup');
const workspaceEnd = appJs.indexOf('function logsMonthStartIso', workspaceStart);
const documentsWorkspaceJs = appJs.slice(workspaceStart, workspaceEnd);
const deleteStart = documentsWorkspaceJs.indexOf('function deleteDocument(doc, row)');
const deleteEnd = documentsWorkspaceJs.indexOf('function onRootContextMenu', deleteStart);
const deleteDocumentJs = documentsWorkspaceJs.slice(deleteStart, deleteEnd);

assert.match(appCss, /documents\.css\?v=20260823-documents-workspace-1/);
assert.ok(
  appCss.indexOf('documents.css') > appCss.indexOf('finance-redesign.css'),
  'Document styles must be the final feature layer in the cascade',
);
assert.match(baseHtml, /documents-workspace-1/);
assert.match(appCss, /documents-context-actions-2/);
assert.match(baseHtml, /documents-context-actions-2/);
assert.match(routerJs, /documents-context-actions-2/);

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
assert.match(appJs, /\['reviewed', 'approved', 'signed', 'ready', 'accepted'\]/);
assert.match(appJs, /class="document-status/);
assert.match(appJs, /Доступен заказчику/);
assert.match(appJs, /Только команда/);
assert.match(appJs, /class="executive-docs-block"/);
assert.match(appJs, /class="executive-progress-track"/);
assert.match(appJs, /data-documents-retry/);

assert.match(documentsWorkspaceJs, /data-document-card data-document-id=/);
assert.match(documentsWorkspaceJs, /tabindex="0"/);
assert.match(documentsWorkspaceJs, /data-document-context-menu/);
for (const action of ['open', 'download', 'edit', 'delete']) {
  assert.match(documentsWorkspaceJs, new RegExp(`data-document-context-action=\\"${action}\\"`));
}
assert.match(documentsWorkspaceJs, /root\.addEventListener\('contextmenu', onRootContextMenu\)/);
assert.match(documentsWorkspaceJs, /event\.key === 'ContextMenu'/);
assert.match(documentsWorkspaceJs, /event\.shiftKey && event\.key === 'F10'/);
assert.match(documentsWorkspaceJs, /String\(doc\.status \|\| ''\)\.toLowerCase\(\) !== 'draft'/);
assert.match(deleteDocumentJs, /window\.confirm\(/);
assert.match(deleteDocumentJs, /deletingDocumentId = Number\(doc\.id\)/);
assert.match(deleteDocumentJs, /api\('\/api\/documents\/' \+ doc\.id, \{ method: 'DELETE' \}\)/);
assert.match(deleteDocumentJs, /result && result\.file_cleanup_failed/);
assert.match(deleteDocumentJs, /\.finally\(function \(\) \{\s*deletingDocumentId = null/);
assert.match(documentsWorkspaceJs, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
assert.match(documentsWorkspaceJs, /event\.key === 'Tab'\) \{\s*closeContextMenu\(false\)/);
assert.match(documentsWorkspaceJs, /data-document-editor-modal/);
assert.match(documentsWorkspaceJs, /role="dialog" aria-modal="true"/);
assert.match(documentsWorkspaceJs, /data-document-editor-form/);
assert.match(documentsWorkspaceJs, /api\('\/api\/documents\/' \+ documentId \+ '\/update'/);
assert.match(documentsWorkspaceJs, /method: 'DELETE'/);
assert.match(documentsWorkspaceJs, /showAppNotice\('Документ обновлён\.', 'success'\)/);
assert.match(documentsWorkspaceJs, /showAppNotice\('Документ удалён\.', 'success'\)/);
assert.match(documentsWorkspaceJs, /refreshProjectOverview\(projectId\)/);
assert.match(documentsWorkspaceJs, /state\.stagesByProject && state\.stagesByProject\[projectId\]/);
assert.match(documentsWorkspaceJs, /documentProtectedStatuses\.indexOf\(currentStatus\)/);
assert.match(documentsWorkspaceJs, /\(canManage\s*\?[^]*data-document-context-action="delete"/);
assert.match(coreJs, /function canManageDocuments\(\) \{\s*return currentPermissions\(\)\.fullAccess === true/);
assert.match(appJs, /function closeProjectDetail\(\) \{\s*if \(typeof documentWorkspaceCleanup === 'function'\) documentWorkspaceCleanup\(\)/);
assert.match(appJs, /function loadDocuments\(projectId, loadingToken\) \{[\s\S]*?return Promise\.all\(\[docsRequest, executiveRequest\]\)/);
assert.match(appJs, /function syncProjectOverviewCover\(project, documents\) \{[\s\S]*?image\.src = projectFallbackCoverUrl\(project\)/);
assert.match(appJs, /function cleanupBeforeRouteChange\(\) \{[\s\S]*?documentWorkspaceCleanup\(\)/);

for (const breakpoint of ['1100px', '840px', '620px', '420px']) {
  assert.match(documentsCss, new RegExp(`@media \\(max-width: ${breakpoint.replace('.', '\\.')}\\)`));
}
assert.match(documentsCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(documentsCss, /\.document-upload-form\[hidden\]/);
assert.match(documentsCss, /\.document-row\.document-card/);
assert.match(documentsCss, /\.document-visibility-switch/);
assert.match(documentsCss, /\.document-context-menu\[hidden\]/);
assert.match(documentsCss, /\.document-context-menu button\.is-danger/);
assert.match(documentsCss, /\.document-editor-modal\[hidden\]/);
assert.match(documentsCss, /\.document-editor-dialog/);
assert.match(documentsCss, /@media \(max-width: 700px\)/);

console.log('documents_workspace_frontend_ok');
