const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const planning = fs.readFileSync(path.join(root, 'frontend/assets/js/planning.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'frontend/assets/css/ui-projects.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend/server.py'), 'utf8');

assert.match(planning, /function estimateSourceIdentity\(value\)/);
assert.match(planning, /project-estimate-file-group/);
assert.match(planning, /estimateSourceIdentity\(item\) === sectionEstimateKey/);
assert.match(planning, /renderScheduleEstimateHeading\(group\.meta, group\.sections\)/);
assert.match(styles, /\.project-estimate-file-head/);
assert.match(styles, /\.project-estimate-file-copy/);
assert.match(server, /def api_project_estimates\(self, path: str\)/);
assert.match(server, /estimate_source_id, source_item_key/);

console.log('multi_estimate_frontend_ok');
