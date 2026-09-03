const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const appJs = read('frontend/assets/js/app.js');
const coreJs = read('frontend/assets/js/core.js');
const operationsJs = read('frontend/assets/js/operations.js');
const procurementJs = read('frontend/assets/js/procurement.js');
const routerJs = read('frontend/assets/js/router.js');
const projectsHtml = read('frontend/pages/projects.html');
const warehouseHtml = read('frontend/pages/warehouse.html');
const baseHtml = read('frontend/templates/base.html');

assert.match(routerJs, /function isAppPath\(pathname\)/);
assert.match(routerJs, /pathname === '\/app' \|\| pathname\.indexOf\('\/app\/'\) === 0/);
assert.match(routerJs, /function isHashOnlyNavigation\(url\)/);
assert.match(routerJs, /contentRoot\.setAttribute\('aria-busy', loading \? 'true' : 'false'\)/);
assert.match(routerJs, /contentRoot\.focus\(\{ preventScroll: true \}\)/);
assert.doesNotMatch(routerJs, /url\.pathname\.indexOf\('\/app'\) !== 0/);
assert.equal((coreJs.match(/window\.showLoader = function/g) || []).length, 1, 'only the visible top progress loader should be installed');
assert.equal((coreJs.match(/window\.hideLoader = function/g) || []).length, 1, 'loader teardown must not be overwritten');

assert.match(baseHtml, /class="skip-link" href="#main-content"/);
assert.match(baseHtml, /<main class="content" id="main-content" tabindex="-1">/);

assert.match(projectsHtml, /class="tabs" role="tablist" aria-label="Разделы объекта"/);
const projectTabs = [...projectsHtml.matchAll(/<button\b[^>]*data-tab="([^"]+)"[^>]*>/g)];
assert.equal(projectTabs.length, 10, 'all visible project sections must use tab semantics');
for (const match of projectTabs) {
  const name = match[1];
  const tag = match[0];
  assert.match(tag, /type="button"/);
  assert.match(tag, /role="tab"/);
  assert.match(tag, new RegExp(`id="project-tab-${name}"`));
  assert.match(tag, new RegExp(`aria-controls="project-panel-${name}"`));
  assert.match(tag, /aria-selected="(?:true|false)"/);
  assert.match(projectsHtml, new RegExp(`id="project-panel-${name}"[^>]*role="tabpanel"[^>]*aria-labelledby="project-tab-${name}"`));
}
assert.match(appJs, /node\.setAttribute\('aria-selected', active \? 'true' : 'false'\)/);
assert.match(appJs, /event\.key === 'ArrowRight' \|\| event\.key === 'ArrowDown'/);
assert.match(appJs, /event\.key === 'Home'/);
assert.match(appJs, /event\.key === 'End'/);
assert.match(appJs, /class="chat-item ' \+ \(index === 0 \? 'active' : ''\) \+ '" type="button" data-open-chat="/);

const labelledControls = [
  ['frontend/pages/companies.html', /data-company-search[^>]*aria-label=/],
  ['frontend/pages/projects.html', /data-project-search[^>]*aria-label=|aria-label="Поиск по объектам"[^>]*data-project-search/],
  ['frontend/pages/logs.html', /data-logs-project[^>]*aria-label=|aria-label="Фильтр отчётов по объекту"[^>]*data-logs-project/],
  ['frontend/pages/suppliers.html', /data-suppliers-project[^>]*aria-label=|aria-label="Выбрать объект для предложений"[^>]*data-suppliers-project/],
  ['frontend/pages/warehouse.html', /data-warehouse-search[^>]*aria-label=|aria-label="Поиск по складу"[^>]*data-warehouse-search/],
  ['frontend/pages/warehouse.html', /data-warehouse-type-filter[^>]*aria-label=/],
  ['frontend/pages/warehouse.html', /data-warehouse-category-filter[^>]*aria-label=/],
  ['frontend/pages/warehouse.html', /data-warehouse-stock-filter[^>]*aria-label=/],
];
for (const [file, contract] of labelledControls) assert.match(read(file), contract, `${file} has an unnamed filter control`);

assert.match(warehouseHtml, /class="warehouse-transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="warehouse-transfer-title"/);
assert.match(warehouseHtml, /class="warehouse-transfer-dialog warehouse-receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="warehouse-receipt-title"/);
assert.match(procurementJs, /function warehouseModalFocusableNodes\(modal\)/);
assert.match(procurementJs, /event\.key === 'Escape'/);
assert.match(procurementJs, /restoreWarehouseModalFocus\(modal\)/);
assert.match(procurementJs, /callback\(\[\], error\)/);
assert.match(procurementJs, /data-warehouse-retry/);
assert.match(procurementJs, /role="alert"/);
assert.match(procurementJs, /document\.body\.dataset\.supplierModalEscapeBound/);
assert.equal((procurementJs.match(/bindSupplierModalEscape\(\);/g) || []).length, 2);
assert.match(procurementJs, /function supplierModalFocusableNodes\(modal\)/);
assert.match(procurementJs, /rememberSupplierModalFocus\(modal\)/);
assert.match(procurementJs, /restoreSupplierModalFocus\(modal\)/);
assert.equal((procurementJs.match(/var sourceUrl = safeExternalUrl\(offer\.source_url \|\| ''\);/g) || []).length, 2);
assert.doesNotMatch(procurementJs, /href="' \+ escapeHtml\(offer\.source_url\)/);
assert.doesNotMatch(procurementJs, /href="' \+ escapeHtml\(source\.url/);
assert.match(procurementJs, /rel="noopener noreferrer"/);

assert.match(operationsJs, /function sideDrawerFocusableNodes\(drawer\)/);
assert.match(operationsJs, /role="dialog" aria-modal="true" tabindex="-1"/);
assert.match(operationsJs, /closeSideDrawer\(node, \{ restoreFocus: false \}\)/);
assert.match(operationsJs, /returnFocus\.isConnected/);
assert.match(operationsJs, /event\.key !== 'Tab'/);

for (const file of [
  'frontend/pages/projects.html',
  'frontend/pages/logs.html',
  'frontend/pages/suppliers.html',
  'frontend/pages/warehouse.html',
  'frontend/templates/login.html',
]) {
  for (const match of read(file).matchAll(/<div class="form-error"[^>]*>/g)) {
    assert.match(match[0], /role="alert"/);
    assert.match(match[0], /aria-atomic="true"/);
  }
}

for (const directory of ['frontend/pages', 'frontend/templates']) {
  for (const file of fs.readdirSync(path.join(root, directory)).filter((name) => name.endsWith('.html'))) {
    const html = read(path.join(directory, file));
    for (const match of html.matchAll(/<button\b[^>]*>/gi)) {
      assert.match(match[0], /\btype\s*=/i, `${directory}/${file} has a button with implicit submit behavior`);
    }
  }
}

assert.match(routerJs, /tabs-a11y-30/);
assert.match(routerJs, /drawer-a11y-30/);
assert.match(routerJs, /warehouse-modal-a11y-2/);
assert.match(routerJs, /safe-supplier-url-3/);
assert.match(baseHtml, /app\.css\?v=20260902-report-ux-r1/);
assert.match(baseHtml, /router\.js\?v=20260903-report-ux-r1/);

console.log('frontend_accessibility_contract_ok');
