const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const projectsPage = read('frontend/pages/projects.html');
const router = read('frontend/assets/js/router.js');
const app = read('frontend/assets/js/app.js');
const moduleSource = read('frontend/assets/js/estimate-reconciliation.js');
const css = read('frontend/assets/css/procurement.css');
const server = read('backend/server.py');
const auth = read('backend/auth.py');

assert.match(projectsPage, /data-tab="estimate-reconciliation"[^>]*><i data-lucide="clipboard-check"[^>]*><\/i><span><b>Сверка сметы<\/b>/);
assert.match(projectsPage, /data-panel="estimate-reconciliation"/);
assert.match(router, /estimate_reconciliation:\s*'\/assets\/js\/estimate-reconciliation\.js/);
assert.match(router, /projects:\s*\[[^\]]*'estimate_reconciliation'/);
assert.match(app, /tabName === 'estimate-reconciliation'/);
assert.match(app, /PMBI\.estimateReconciliation\.loadSelectedProject/);
assert.match(moduleSource, /\/estimate-reconciliation\/snapshots/);
assert.match(moduleSource, /\/estimate-reconciliation\/review/);
assert.match(moduleSource, /Текущая смета = оригинал/);
assert.match(moduleSource, /Цены доступны только Директору и Админу/);
assert.match(moduleSource, /Object\.prototype\.hasOwnProperty\.call\(item, 'plannedPrice'\)/);
assert.match(css, /\.reconciliation-workspace/);
assert.match(css, /\.reconciliation-table/);
assert.match(server, /api_estimate_reconciliation/);
assert.match(server, /capture_live_snapshot/);
assert.match(auth, /"priceChanged"/);
assert.match(auth, /"priceDelta"/);

console.log('estimate reconciliation frontend checks passed');
