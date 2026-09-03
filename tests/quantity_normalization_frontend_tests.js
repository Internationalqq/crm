const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appJs = read('frontend/assets/js/app.js');
const procurementJs = read('frontend/assets/js/procurement.js');
const routerJs = read('frontend/assets/js/router.js');
const projectCss = read('frontend/assets/css/ui-projects.css');
const qaCss = read('frontend/assets/css/ui-qa.css');
const baseHtml = read('frontend/templates/base.html');

assert.match(procurementJs, /String\(item\.itemKind \|\| 'material'\)\.toLowerCase\(\) !== 'work'/);
assert.match(procurementJs, /warehouse-hot-qty/);
assert.match(procurementJs, /quantityText\(item\.plannedQty\)/);
assert.match(procurementJs, /quantityText\(item\.stockQty\)/);
assert.match(procurementJs, /quantityText\(missing\)/);
assert.doesNotMatch(procurementJs, /На склае/);

assert.match(appJs, /sections: \{\}/);
assert.match(appJs, /quick-alert-section-head/);
assert.match(appJs, /quantityText\(item\.missingQty\)/);
assert.match(appJs, /quantity-actual-label/);
assert.match(appJs, /maximumFractionDigits: 3/);
assert.doesNotMatch(appJs, /пересчет:/);
assert.match(read('frontend/assets/js/planning.js'), /quantityText\(plan\.totalQty\)/);
assert.match(projectCss, /\.quick-alert-section-items/);
assert.match(qaCss, /\.warehouse-volume\.is-missing/);

assert.match(routerJs, /app\.js\?v=[^'\"]*quantity-normalization-1/);
assert.match(routerJs, /procurement\.js\?v=20260821-quantity-normalization-1/);
assert.match(baseHtml, /router\.js\?v=20260903-report-ux-r1/);

console.log('quantity_normalization_frontend_ok');
