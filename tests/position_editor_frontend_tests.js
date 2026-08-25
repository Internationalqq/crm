const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const app = read('frontend/assets/js/app.js');
const planning = read('frontend/assets/js/planning.js');
const warehouse = read('frontend/assets/js/warehouse-control.js');
const router = read('frontend/assets/js/router.js');
const css = read('frontend/assets/css/position-editor.css');
const appCss = read('frontend/assets/app.css');
const base = read('frontend/templates/base.html');
const server = read('backend/server.py');

assert.match(appCss, /position-editor\.css\?v=20260825-position-editor-1/);
assert.match(base, /app\.css\?v=[^"\s]*position-editor-1/);
assert.match(base, /router\.js\?v=[^"\s]*position-editor-1/);
assert.match(router, /app\.js\?v=[^'\s]*position-editor-1/);
assert.match(router, /planning\.js\?v=[^'\s]*position-editor-1/);
assert.match(router, /warehouse-control\.js\?v=[^'\s]*position-editor-1/);

const editorStart = app.indexOf('function positionEditorItemFromRow');
const editorEnd = app.indexOf('var positionHighlightTimer', editorStart);
const editor = app.slice(editorStart, editorEnd);
assert.ok(editorStart >= 0 && editorEnd > editorStart);
assert.match(editor, /role="dialog" aria-modal="true" aria-labelledby="position-editor-title"/);
assert.match(editor, /data-position-editor-form novalidate/);
assert.match(editor, /name="title"/);
assert.match(editor, /name="section_title"/);
assert.match(editor, /name="unit"/);
assert.match(editor, /name="planned_qty"/);
assert.match(editor, /document\.addEventListener\('contextmenu'/);
assert.equal((editor.match(/document\.addEventListener\('contextmenu'/g) || []).length, 1);
assert.match(editor, /if \(!row \|\| !canManageSchedule\(\)\) return;\s*event\.preventDefault\(\)/);
assert.match(editor, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey && event\.key === 'F10'\)/);
assert.match(editor, /positionEditorSubmitting/);
assert.match(editor, /\/api\/projects\/.*\/estimate-items\/.*\/update/);
assert.match(editor, /expectedKind: item\.kind/);
assert.match(editor, /PMBI\.planning\.loadSectionScheduleForecast/);
assert.match(editor, /PMBI\.warehouseControl\.patchPosition/);
assert.doesNotMatch(editor, /openProject\(/);
assert.doesNotMatch(editor, /MutationObserver|setInterval|offsetWidth/);

assert.match(warehouse, /data-position-editor data-position-kind="material"/);
assert.match(warehouse, /data-position-project=/);
assert.match(warehouse, /function patchPosition\(projectId, item\)/);
assert.match(warehouse, /PMBI\.app\.highlightPositionRow\(card\)/);
assert.match(planning, /data-work-row data-position-editor data-position-kind="work"/);
assert.match(planning, /schedule-work-duration-row is-stage" data-stage-id=/);
assert.match(planning, /schedule-stage-row" data-stage-id=/);
assert.match(planning, /function focusProjectScheduleTarget\(target, projectId\)/);
assert.match(planning, /\[data-work-row\]\[data-position-id=/);
assert.match(planning, /\[data-stage-id=/);

assert.match(app, /&tab=schedule&stageId=' \+ encodeURIComponent\(stage\.id \|\| ''\)/);
assert.match(app, /function handleReminderNavigation\(sourceUrl\)/);
assert.match(router, /link\.classList\.contains\('reminder-item'\)/);
assert.match(router, /PMBI\.app\.handleReminderNavigation\(url, link\)/);
assert.match(router, /function syncCurrentUrl\(\)/);
assert.match(app, /consumeProjectDeepLink\('material'\)/);
assert.match(app, /consumeProjectDeepLink\(target\.workId \? 'work' : 'stage'\)/);

const initPageStart = app.indexOf('function initPage()');
const initPageEnd = app.indexOf('function loadProjects', initPageStart);
const initPage = app.slice(initPageStart, initPageEnd);
assert.match(initPage, /loadUserDirectory\(function \(\) \{\}\);\s*loadProjects\(function \(\) \{\s*renderProjectsPage\(\);\s*loadDashboard/);
assert.doesNotMatch(initPage, /loadUserDirectory\(function \(\) \{\s*loadProjects/);

assert.match(css, /\.position-target-focus/);
assert.match(css, /box-shadow: inset 3px 0 0 #3b82f6/);
assert.match(css, /\.position-editor-overlay\[hidden\]/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(server, /re\.fullmatch\(r"\/api\/projects\/\\d\+\/estimate-items\/\\d\+\/update"/);
assert.match(server, /def api_update_estimate_position\(self, path: str\)/);
assert.match(server, /user_can_manage_schedule\(user\)/);
assert.match(server, /estimate_position_fields_forbidden/);
assert.match(server, /"before": before, "after": after/);

console.log('position_editor_frontend_ok');
