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
assert.match(projectsPage, /data-tab="warehouse-control"[^>]*><i data-lucide="boxes"[^>]*><\/i><span>Материалы<\/span><\/button>/);
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
assert.match(moduleSource, /Нужно по смете/);
for (const removedInventoryHeading of [
    'Склад объекта',
    'Учёт по позициям',
    'Материалы на объекте',
    'Одна строка показывает план, движение и фактический остаток материала.',
    'warehouse-control-inventory-head',
    'data-warehouse-visible-count',
]) {
    assert.equal(moduleSource.includes(removedInventoryHeading), false, `Redundant inventory heading remains: ${removedInventoryHeading}`);
}
assert.match(moduleSource, /function materialFlowHeader\(label, icon, tone\)/);
assert.match(moduleSource, /function materialFlowCell\(label, icon, tone, value, unit, context, correction\)/);
assert.match(moduleSource, /function reversibleMaterialMoves\(payload, materialId, moveType\)/);
assert.match(moduleSource, /String\(move\.sourceType \|\| 'manual'\) === 'manual'/);
assert.match(moduleSource, /syncProjectMaterials\(projectId, payload\);[\s\S]{0,260}PMBI\.app\.refreshOpenReportPreviewsForProject\(projectId\)/);
assert.match(moduleSource, /function groupedMaterials\(materials\)/);
assert.match(moduleSource, /data-warehouse-material-section-group/);
assert.match(moduleSource, /qsa\('\[data-select-material\]\.is-actionable', panel\)/);
assert.match(moduleSource, /event\.target\.closest\('button, a, input, select, textarea, label'\)/);
assert.match(moduleSource, /materialFlowHeader\('Заказано', 'shopping-cart', 'purchase'\)/);
assert.match(moduleSource, /materialFlowHeader\('Привезено', 'package-check', 'receipt'\)/);
assert.match(moduleSource, /materialFlowHeader\('Потрачено', 'package-minus', 'use'\)/);
assert.match(moduleSource, /var hasValue = isValid && formattedValue !== '0'/);
assert.match(moduleSource, /<span class="visually-hidden">' \+ escapeHtml\(isValid \? accessibleAmount : 'Нет данных'\)/);
assert.match(moduleSource, /data-stock-material-search/);
assert.match(moduleSource, /data-warehouse-material-filter/);
assert.match(moduleSource, /data-select-material/);
assert.match(moduleSource, /data-select-material-button/);
assert.match(moduleSource, /data-warehouse-control-portal/);
assert.match(moduleSource, /aria-label="Поиск материалов"/);
assert.match(moduleSource, /function focusMaterial\(materialId, projectId\)/);
assert.match(moduleSource, /module\.focusMaterial = focusMaterial/);
assert.match(moduleSource, /data-stock-fill-remaining/);
assert.match(moduleSource, /data-lucide="arrow-up-to-line"/);
assert.match(moduleSource, /data-stock-fill-remaining-value/);
assert.match(moduleSource, /refreshLucideIcons\(dialog\)/);
assert.match(moduleSource, /refreshLucideIcons\(portal\)/);
assert.match(moduleSource, /planned - Math\.max\(purchased, received\)/);
assert.match(moduleSource, /Math\.round\(suggestion \* 1000\) \/ 1000/);
assert.match(moduleSource, /function clearStockMoveDraft\(\)/);
assert.match(moduleSource, /data-warehouse-dialog-open="movement"/);
assert.match(moduleSource, /data-warehouse-dialog="' \+ escapeHtml\(name\) \+ '" hidden/);
assert.match(moduleSource, /'<div class="warehouse-control-main">' \+ materialsTable\(payload\) \+ '<\/div>'/);
assert.match(moduleSource, /openWarehouseDialog\('movement', null, false\)/);
assert.match(moduleSource, /Все операции по складу/);
assert.match(moduleSource, /warehouse_return_from_project/);
assert.match(moduleSource, /move\.isReversible === true/);
assert.match(moduleSource, /data-stock-correction-open/);
assert.match(moduleSource, /data-correction-reverse-move/);
assert.match(moduleSource, /Материал снова доступен для дневного отчёта/);
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
assert.match(objectControlCss, /Material lifecycle: visually separate order, delivery and usage/);
assert.match(objectControlCss, /\.warehouse-material-flow\.is-purchase \{[\s\S]*?--warehouse-flow-color: var\(--color-accent/);
assert.match(objectControlCss, /\.warehouse-material-flow\.is-receipt \{[\s\S]*?--warehouse-flow-color: var\(--color-success/);
assert.match(objectControlCss, /\.warehouse-material-flow\.is-use \{[\s\S]*?--warehouse-flow-color: #6d5bd0;/);
assert.match(objectControlCss, /\.warehouse-material-flow-value\.is-empty \{[\s\S]*?background: transparent;/);
assert.match(objectControlCss, /\.warehouse-material-correction-trigger \{[\s\S]*?cursor: pointer;/);
assert.match(objectControlCss, /\.warehouse-stock-correction-summary \{/);
assert.match(objectControlCss, /@media \(min-width: 721px\) and \(max-width: 1080px\) \{[\s\S]*?\.warehouse-material-card \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
assert.match(objectControlCss, /\.warehouse-material-card \.warehouse-material-cell:nth-child\(3\) \{[\s\S]*?display: block;/);
assert.match(objectControlCss, /\.warehouse-material-cell > \.warehouse-material-flow-label \{[\s\S]*?display: inline-flex;/);
assert.match(objectControlCss, /\.warehouse-control-fill \{[\s\S]*?min-height: 44px !important;/);
assert.match(objectControlCss, /\.warehouse-control-dialog-head > button svg \{[\s\S]*?width: 18px;/);
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
    canReverseStockMoves: true,
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
    }, {
        id: 2,
        materialItemId: 7,
        materialTitle: 'Лампочка',
        materialUnit: 'шт',
        moveType: 'use',
        qty: 1,
        sourceType: 'manual',
        isReversible: true,
        createdAt: 1787385601,
    }, {
        id: 3,
        materialItemId: 7,
        materialTitle: 'Лампочка',
        materialUnit: 'шт',
        moveType: 'use',
        qty: 1,
        sourceType: 'warehouse_return_from_project',
        isReversible: false,
        createdAt: 1787385602,
    }],
    materials: [{
        id: 7,
        title: 'Лампочка',
        sectionTitle: 'Электрика',
        estimateSourceId: 11,
        estimateSourceType: 'legacy',
        unit: 'шт',
        plannedQty: 10,
        purchasedQty: 10,
        receivedQty: 10,
        factUsedQty: 0,
        manualUsedQty: 10,
        stockBalanceQty: 0,
        unaccountedQty: 0,
        hasReceipt: true,
    }, {
        id: 8,
        title: 'Кабель',
        sectionTitle: 'Электрика',
        estimateSourceId: 11,
        estimateSourceType: 'legacy',
        unit: 'м',
        plannedQty: 100,
        purchasedQty: 0,
        receivedQty: 0,
        factUsedQty: 0,
        manualUsedQty: 0,
        stockBalanceQty: 0,
        unaccountedQty: 0,
        hasReceipt: false,
    }],
    summary: { materialsCount: 2, fullyReceivedMaterials: 1, needReceiptMaterials: 1, riskMaterials: 0 },
});
assert.match(rendered, /Лампочка/);
assert.match(rendered, /Кабель/);
assert.doesNotMatch(rendered, /Склад объекта|Учёт по позициям|Материалы на объекте|warehouse-control-inventory-head|data-warehouse-visible-count/);
const registerHead = rendered.match(/<div class="warehouse-material-register-head"[\s\S]*?<\/div>/)[0];
assert.doesNotMatch(registerHead, /Действия/);
assert.equal((rendered.match(/<strong>Электрика<\/strong>/g) || []).length, 1, 'Repeated section title must render once per source');
assert.doesNotMatch(rendered, /warehouse-material-title"><small>Электрика<\/small>/);
assert.match(rendered, /warehouse-material-card is-[^" ]+ is-actionable/);
assert.match(rendered, /data-label="Нужно"><span>Нужно<\/span><strong>10 <small>шт<\/small>/);
assert.match(rendered, /warehouse-material-flow is-purchase[\s\S]*?data-lucide="shopping-cart"/);
assert.match(rendered, /data-label="Заказано" aria-label="Заказано: 10 шт\. Нужно по смете: 10 шт"[\s\S]*?warehouse-material-flow-value">10 <small>шт<\/small>/);
assert.match(rendered, /data-label="Привезено" aria-label="Привезено: 10 шт"[\s\S]*?warehouse-material-flow-value">10 <small>шт<\/small>/);
assert.match(rendered, /data-label="Потрачено" aria-label="Потрачено: 10 шт"[\s\S]*?warehouse-material-flow-value">10 <small>шт<\/small>/);
assert.match(rendered, /data-stock-correction-open data-material-id="7" data-move-type="use"/);
assert.match(rendered, /aria-label="Исправить: Потрачено: 10 шт"/);
assert.match(rendered, /data-warehouse-dialog="correction" hidden/);
assert.match(rendered, /data-stock-correction-body/);
assert.match(rendered, /Всё использовано/);
assert.doesNotMatch(rendered, /data-material-move=|<div class="warehouse-material-actions">/);
assert.match(rendered, /Все операции по складу/);
assert.match(rendered, /data-reverse-stock-move="2"/);
assert.doesNotMatch(rendered, /data-reverse-stock-move="3"/);
assert.match(rendered, /data-warehouse-dialog="movement" hidden/);
assert.match(rendered, /data-select-material-button="7"/);
assert.doesNotMatch(rendered, /warehouse-material-card[^>]*role="button"/);

const multiSourceRendered = browserWindow.PMBI.warehouseControl.render({
    canRecordFacts: false,
    canManageNorms: false,
    canReverseFacts: false,
    works: [], norms: [], facts: [], movements: [],
    materials: [41, 42].map((sourceId) => ({
        id: sourceId,
        title: `Материал ${sourceId}`,
        sectionTitle: 'Одинаковый раздел',
        estimateSourceId: sourceId,
        estimateSourceType: 'pdf',
        estimateTitle: `Смета ${sourceId}`,
        estimateFileName: `estimate-${sourceId}.pdf`,
        unit: 'шт',
        plannedQty: 1,
        purchasedQty: 0,
        receivedQty: 0,
        factUsedQty: 0,
        manualUsedQty: 0,
        stockBalanceQty: 0,
        unaccountedQty: 0,
        hasReceipt: false,
    })),
    summary: { materialsCount: 2, fullyReceivedMaterials: 0, needReceiptMaterials: 2, riskMaterials: 0 },
});
assert.equal((multiSourceRendered.match(/data-warehouse-material-source-group/g) || []).length, 2);
assert.equal((multiSourceRendered.match(/<strong>Одинаковый раздел<\/strong>/g) || []).length, 2, 'Same section title from different estimates must stay separate');
assert.equal((multiSourceRendered.match(/warehouse-material-source-head/g) || []).length, 2);

const zeroRendered = browserWindow.PMBI.warehouseControl.render({
    canRecordFacts: false,
    canManageNorms: false,
    canReverseFacts: false,
    projectId: 9,
    works: [],
    norms: [],
    facts: [],
    movements: [],
    materials: [{
        id: 8,
        title: 'Крепёж',
        sectionTitle: 'Монтаж',
        unit: 'шт',
        plannedQty: 5,
        purchasedQty: 0.0001,
        receivedQty: Number.NaN,
        factUsedQty: 0,
        manualUsedQty: 0,
        stockBalanceQty: 0,
        unaccountedQty: 0,
        hasReceipt: false,
    }],
    summary: { materialsCount: 1, fullyReceivedMaterials: 0, needReceiptMaterials: 1, riskMaterials: 0 },
});
assert.match(zeroRendered, /data-label="Заказано" aria-label="Заказано: 0 шт\. Нужно по смете: 5 шт"[\s\S]*?warehouse-material-flow-value is-empty"><span aria-hidden="true">—<\/span><span class="visually-hidden">0 шт<\/span>/);
assert.match(zeroRendered, /data-label="Привезено" aria-label="Привезено: нет данных"[\s\S]*?warehouse-material-flow-value is-empty is-invalid"><span aria-hidden="true">—<\/span><span class="visually-hidden">Нет данных<\/span>/);
assert.match(zeroRendered, /data-label="Потрачено" aria-label="Потрачено: 0 шт"[\s\S]*?warehouse-material-flow-value is-empty"><span aria-hidden="true">—<\/span><span class="visually-hidden">0 шт<\/span>/);
assert.doesNotMatch(zeroRendered, /warehouse-material-flow-value[^>]*>0\s*<small>/);
assert.doesNotMatch(zeroRendered, /data-stock-correction-open/);

const reportUseRendered = browserWindow.PMBI.warehouseControl.render({
    canRecordFacts: true,
    canManageNorms: false,
    canReverseFacts: false,
    canReverseStockMoves: true,
    projectId: 9,
    works: [], norms: [], facts: [],
    movements: [{
        id: 11,
        materialItemId: 11,
        materialTitle: 'Мастика',
        materialUnit: 'кг',
        moveType: 'use',
        qty: 42,
        sourceType: 'daily_log_action',
        isReversible: true,
        createdAt: 1787385600,
    }],
    materials: [{
        id: 11,
        title: 'Мастика',
        sectionTitle: 'Гидроизоляция',
        unit: 'кг',
        plannedQty: 42,
        purchasedQty: 42,
        receivedQty: 42,
        factUsedQty: 0,
        manualUsedQty: 42,
        stockBalanceQty: 0,
        unaccountedQty: 0,
        hasReceipt: true,
    }],
    summary: { materialsCount: 1, fullyReceivedMaterials: 1, needReceiptMaterials: 0, riskMaterials: 0 },
});
assert.doesNotMatch(reportUseRendered, /data-stock-correction-open/, 'Daily report movements must not be exposed as manual corrections');

console.log('warehouse control frontend checks passed');
