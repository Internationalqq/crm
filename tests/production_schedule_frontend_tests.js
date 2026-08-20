const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const coreJs = fs.readFileSync(path.join(root, 'frontend/assets/js/core.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'frontend/assets/js/app.js'), 'utf8');
const planningJs = fs.readFileSync(path.join(root, 'frontend/assets/js/planning.js'), 'utf8');
const projectsHtml = fs.readFileSync(path.join(root, 'frontend/pages/projects.html'), 'utf8');
const planningCss = fs.readFileSync(path.join(root, 'frontend/assets/css/planning.css'), 'utf8');

assert.match(projectsHtml, /data-tab="production-schedule"/);
assert.match(projectsHtml, /data-panel="production-schedule"/);
assert.match(coreJs, /productionScheduleByProject/);
assert.match(appJs, /loadSelectedProjectProductionSchedule/);
assert.match(appJs, /tabName === 'production-schedule'/);
assert.match(planningJs, /data-production-cell/);
assert.match(planningJs, /action: 'set_cell'/);
assert.match(planningJs, /action: 'recalculate'/);
assert.match(planningJs, /api\('\/api\/projects\/' \+ projectId \+ '\/production-schedule'/);
assert.match(planningJs, /data-graph-duration-input/);
assert.match(planningJs, /section-schedule-override/);
assert.match(planningCss, /\.production-schedule-table/);
assert.match(planningCss, /position: sticky/);

console.log('production_schedule_frontend_ok');
