const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appJs = read('frontend/assets/js/app.js');
const planningJs = read('frontend/assets/js/planning.js');
const routerJs = read('frontend/assets/js/router.js');
const baseHtml = read('frontend/templates/base.html');

const bulkStart = appJs.indexOf('function completeBulkSectionLocally');
const bulkEnd = appJs.indexOf('function handleBulkSectionCheck', bulkStart);
const bulkBlock = appJs.slice(bulkStart, bulkEnd);

assert.ok(bulkStart >= 0 && bulkEnd > bulkStart);
assert.match(bulkBlock, /setScheduleWorkDone\(projectId, sectionTitle/);
assert.match(bulkBlock, /setMaterialManuallyDone\(projectId, materialItem, checked\)/);
assert.match(bulkBlock, /updateMaterialScheduleItemDom\(materialItem\.id, checked\)/);
assert.match(appJs, /completeBulkSectionLocally\(scope, checked\);\s*input\.indeterminate = false;\s*updateBulkSectionCheckState\(scope\)/);
assert.match(appJs, /function workMatchingKeys[\s\S]*?keys\.push\('id\|' \+ String\(item\.id\)\)[\s\S]*?keys\.push\(scheduleWorkKey\(sectionTitle, item\)\)/);
assert.match(appJs, /renderBulkSectionCheckbox\(projectId, title, 'works', sectionProgress\)/);
assert.match(planningJs, /renderBulkSectionCheckbox\(project\.id, sectionTitle, 'work', progress\)/);
assert.match(planningJs, /if \(forcedOpen\) return false;\s*if \(item && \(item\.isCompleted \|\| item\.is_completed\)\) return true/);
assert.match(planningJs, /entry\.isCompleted = !!isDone/);
assert.match(routerJs, /app\.js\?v=[^']*bulk-section-completion-1/);
assert.match(routerJs, /planning\.js\?v=[^']*bulk-section-completion-1/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*works-only-1/);

console.log('bulk_section_completion_frontend_ok');
