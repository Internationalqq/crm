const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const projectsPage = read('frontend/pages/projects.html');
const router = read('frontend/assets/js/router.js');
const app = read('frontend/assets/js/app.js');
const moduleSource = read('frontend/assets/js/warehouse-control.js');
const css = read('frontend/assets/css/procurement.css');
const objectControlCss = read('frontend/assets/css/object-control.css');
const server = read('backend/server.py');
const backend = read('backend/warehouse_control.py');

assert.match(projectsPage, /data-tab="warehouse-control"/);
assert.match(projectsPage, /data-tab="warehouse-control"><i data-lucide="boxes"[^>]*><\/i><span>Материалы<\/span><\/button>/);
assert.match(projectsPage, /data-panel="warehouse-control"/);
assert.match(router, /warehouse_control:\s*'\/assets\/js\/warehouse-control\.js/);
assert.match(router, /projects:\s*\[[^\]]*'warehouse_control'/);
assert.match(app, /tabName === 'warehouse-control'/);
assert.match(app, /PMBI\.warehouseControl\.loadSelectedProject/);
assert.match(app, /'warehouse-control': hasRole\('customer'\)/);
assert.match(app, /projectReportEffectsByProject\[projectId\] = \{ works: \{\}, materials: \{\} \}/);
assert.match(moduleSource, /\/warehouse-control\/norms/);
assert.match(moduleSource, /\/warehouse-control\/facts'/);
assert.match(moduleSource, /\/warehouse-control\/facts\/' \+ factId \+ '\/reverse/);
assert.match(moduleSource, /\/api\/projects\/' \+ projectId \+ '\/stock-moves/);
assert.match(moduleSource, /idempotencyKey: requestKey\('work-fact'\)/);
assert.match(moduleSource, /data-stock-move-form/);
assert.match(moduleSource, /Записать движение/);
assert.match(moduleSource, /Заказали/);
assert.match(moduleSource, /Привезли/);
assert.match(moduleSource, /Потратили/);
assert.match(moduleSource, /Нужно, заказано, привезено, потрачено и остаток — в одном реестре/);
assert.match(moduleSource, /Материалы на объекте/);
assert.match(moduleSource, /Нужно по смете/);
assert.match(moduleSource, /data-stock-material-search/);
assert.match(moduleSource, /data-warehouse-material-filter/);
assert.match(moduleSource, /data-select-material/);
assert.match(moduleSource, /data-select-material-button/);
assert.match(moduleSource, /data-warehouse-control-portal/);
assert.match(moduleSource, /aria-label="Поиск материалов"/);
assert.match(moduleSource, /function focusMaterial\(materialId, projectId\)/);
assert.match(moduleSource, /module\.focusMaterial = focusMaterial/);
assert.match(moduleSource, /data-stock-fill-remaining/);
assert.match(moduleSource, /data-warehouse-dialog-open="movement"/);
assert.match(moduleSource, /data-warehouse-dialog="' \+ escapeHtml\(name\) \+ '" hidden/);
assert.match(moduleSource, /'<div class="warehouse-control-main">' \+ materialsTable\(payload\) \+ '<\/div>'/);
assert.match(moduleSource, /openWarehouseDialog\('movement', null, false\)/);
assert.match(moduleSource, /Все операции по складу/);
assert.match(moduleSource, /data-work-material-norm-form/);
assert.match(moduleSource, /data-work-fact-form/);
assert.match(moduleSource, /unaccountedQty/);
assert.match(moduleSource, /<details class="warehouse-control-section warehouse-control-work-section">/);
assert.match(moduleSource, /<details class="warehouse-control-section warehouse-control-norms">/);
assert.match(moduleSource, /<details class="warehouse-control-section warehouse-control-history">/);
assert.match(css, /\.warehouse-control-workspace/);
assert.match(css, /\.warehouse-control-move-switch/);
assert.match(css, /\.warehouse-material-card/);
assert.match(css, /\.warehouse-material-progress-track/);
assert.match(css, /@keyframes warehouse-card-in/);
assert.match(css, /\.warehouse-control-secondary/);
assert.match(css, /\.warehouse-control-fact\.is-reversal/);
assert.match(objectControlCss, /\.warehouse-control-main \{[\s\S]*?display: block;/);
assert.match(objectControlCss, /\.warehouse-control-dialog \{[\s\S]*?position: fixed;/);
assert.match(objectControlCss, /\.warehouse-control-stock-card \{[\s\S]*?width: 100%;/);
assert.match(server, /ensure_warehouse_control_schema\(con\)/);
assert.match(server, /api_project_warehouse_control/);
assert.match(server, /api_reverse_project_work_fact/);
assert.match(server, /estimate_item_project_mismatch/);
assert.match(backend, /CREATE TABLE IF NOT EXISTS work_material_norms/);
assert.match(backend, /CREATE TABLE IF NOT EXISTS project_work_facts/);
assert.match(backend, /idx_stock_moves_source_key/);
assert.match(backend, /project_work_fact_is_immutable/);

const browserWindow = {
    PMBI: {
        state: {},
        api: () => Promise.resolve({}),
        qs: () => null,
        qsa: () => [],
        escapeHtml: (value) => String(value ?? ''),
        safeReplaceChildren: () => {},
        showSkeleton: () => {},
        refreshLucideIcons: () => {},
        showAppNotice: () => {},
    },
};
browserWindow.window = browserWindow;
vm.runInNewContext(moduleSource, { window: browserWindow, Intl, Date, Math, Number, String });
const rendered = browserWindow.PMBI.warehouseControl.render({
    canRecordFacts: true,
    canManageNorms: false,
    canReverseFacts: false,
    works: [],
    norms: [],
    facts: [],
    movements: [{
        id: 1,
        materialItemId: 7,
        materialTitle: 'Лампочка',
        materialUnit: 'шт',
        moveType: 'receipt',
        qty: 10,
        sourceType: 'manual',
        createdAt: 1787385600,
    }],
    materials: [{
        id: 7,
        title: 'Лампочка',
        sectionTitle: 'Электрика',
        unit: 'шт',
        plannedQty: 10,
        purchasedQty: 10,
        receivedQty: 10,
        factUsedQty: 0,
        manualUsedQty: 10,
        stockBalanceQty: 0,
        unaccountedQty: 0,
        hasReceipt: true,
    }],
    summary: { materialsCount: 1, fullyReceivedMaterials: 1, needReceiptMaterials: 0, riskMaterials: 0 },
});
assert.match(rendered, /Лампочка/);
assert.match(rendered, /data-label="Нужно"><span>Нужно<\/span><strong>10 <small>шт<\/small>/);
assert.match(rendered, /Всё использовано/);
assert.match(rendered, /data-material-move="receipt"/);
assert.match(rendered, /Все операции по складу/);
assert.match(rendered, /data-warehouse-dialog="movement" hidden/);
assert.match(rendered, /data-select-material-button="7"/);
assert.doesNotMatch(rendered, /warehouse-material-card[^>]*role="button"/);

console.log('warehouse control frontend checks passed');
