const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appJs = fs.readFileSync(path.join(root, 'frontend/assets/js/app.js'), 'utf8');
const routerJs = fs.readFileSync(path.join(root, 'frontend/assets/js/router.js'), 'utf8');
const baseHtml = fs.readFileSync(path.join(root, 'frontend/templates/base.html'), 'utf8');

function sourceBlock(startMarker, endMarker) {
  const start = appJs.indexOf(startMarker);
  const end = appJs.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  assert.ok(end > start, `Missing source marker after ${startMarker}: ${endMarker}`);
  return appJs.slice(start, end);
}

const accessBlock = sourceBlock(
  'function renderProjectAccessModal',
  'function openSupplierDeepLink'
);

assert.match(accessBlock, /name=["']foreman_ids["']/);
assert.match(accessBlock, /name=["']purchaser_ids?["']/);
assert.match(accessBlock, /userHasRoleCode\(user, ['"]foreman['"]\)/);
assert.match(accessBlock, /userHasRoleCode\(user, ['"]purchaser['"]\)/);
assert.match(accessBlock, /action:\s*['"]set_project_foremen['"]/);
assert.match(accessBlock, /purchaser_ids\s*:/);
assert.match(accessBlock, /loadProjectAssignments\(projectId\)/);

const hubBlock = sourceBlock(
  'renderProjectHub = function (project, data)',
  'function refreshProjectOverview'
);
const setupStart = hubBlock.indexOf('var setupItems = [');
const setupEnd = hubBlock.indexOf('];', setupStart);
assert.ok(setupStart >= 0 && setupEnd > setupStart, 'Project setup items were not found');
const setupBlock = hubBlock.slice(setupStart, setupEnd);

assert.match(
  setupBlock,
  /title:\s*['"]Прораб['"][\s\S]*?complete:\s*hasForeman/
);
assert.match(
  setupBlock,
  /title:\s*['"]Снабжение['"][\s\S]*?complete:\s*hasBuyer/
);
assert.doesNotMatch(setupBlock, /title:\s*['"]Ответственные['"]/);
assert.doesNotMatch(setupBlock, /complete:\s*hasForeman\s*&&\s*hasBuyer/);

assert.match(routerJs, /app\.js\?v=[^'\n]*project-responsibles-1/);
assert.match(baseHtml, /router\.js\?v=[^"\n]*project-responsibles-1/);

console.log('project_responsibles_frontend_ok');
