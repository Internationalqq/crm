const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const moduleSource = fs.readFileSync(
    path.join(root, 'frontend/assets/js/economics-management.js'),
    'utf8'
);
const appSource = fs.readFileSync(
    path.join(root, 'frontend/assets/js/app.js'),
    'utf8'
);
const styles = fs.readFileSync(
    path.join(root, 'frontend/assets/css/economics.css'),
    'utf8'
);

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function makeRuntime(allowed, responses) {
    responses = responses || {};
    const calls = [];
    const PMBI = {
        state: { user: { role: allowed ? 'director' : 'manager' } },
        canViewProjectEconomics: () => allowed,
        escapeHtml: (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;'),
        money: (value) => `${Number(value || 0).toFixed(2)} ₽`,
        api: (url, options) => {
            calls.push({ url, options: options || {} });
            if (Object.prototype.hasOwnProperty.call(responses, url)) {
                const response = responses[url];
                return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
            }
            if (url.endsWith('/financial-baselines')) return Promise.resolve({ baselines: [] });
            if (url.endsWith('/commitments')) return Promise.resolve({ commitments: [] });
            if (url.endsWith('/actual-costs')) return Promise.resolve({ actualCosts: [] });
            if (url.endsWith('/cash-flow')) return Promise.resolve({ payments: [], allocations: [] });
            if (url.endsWith('/forecasts')) return Promise.resolve({ forecasts: [] });
            if (url.endsWith('/documents')) return Promise.resolve({ documents: [] });
            if (url.endsWith('/supplier-offers')) return Promise.resolve({ offers: [] });
            if (url.endsWith('/forecast-price-sources')) return Promise.resolve({ marketSnapshots: [] });
            if (url.endsWith('/economics')) return Promise.resolve({ status: 'not_configured' });
            if (url.endsWith('/legacy-economics-migration')) return Promise.resolve({ status: 'not_scanned', review: null, history: [] });
            return Promise.resolve({});
        },
        showAppNotice: () => {},
        refreshLucideIcons: () => {},
    };
    const document = {
        querySelector: () => null,
        querySelectorAll: () => [],
        dispatchEvent: () => {},
    };
    const context = {
        window: {
            PMBI,
            crypto: { randomUUID: () => 'test-uuid' },
        },
        document,
        CustomEvent: function CustomEvent(name, init) {
            this.type = name;
            this.detail = init && init.detail;
        },
        console,
        Promise,
        Intl,
        Date,
        Number,
        String,
        Math,
        Array,
        Object,
        JSON,
        Error,
    };
    vm.runInNewContext(moduleSource, context, {
        filename: 'economics-management.js',
    });
    return { PMBI: context.window.PMBI, calls };
}

async function run() {
    [
        'render: render',
        'bind: bind',
        'load: load',
        'canViewProjectEconomics()',
        "'/financial-baselines'",
        "'/commitments'",
        "'/actual-costs'",
        "'/cash-flow'",
        "'/forecasts'",
        "'/forecast-price-sources'",
        "'/payment-allocations'",
        "'/forecasts/calculate'",
        "'/successors'",
        "'/replace-lines'",
        "'/legacy-economics-migration'",
        "'/legacy-economics-migration/scan'",
        'baseline-submit',
        'commitment-approve',
        'data-econ-reverse-form',
        'allocation-submit',
        'forecast-approve',
        'workflowPath(form.dataset.entityKind + \'-return\'',
        'data-econ-baseline-create',
        'data-econ-commitment-create',
        'data-econ-actual-create',
        'data-econ-allocation-create',
        'data-econ-forecast-calculate',
        'budgetLineId',
        'vatMode',
        'vatRateBasisPoints',
        'netAmountKopecks',
        'vatAmountKopecks',
        'grossAmountKopecks',
        'data-econ-legacy-update',
        'data-econ-legacy-confirm',
        'data-econ-legacy-ignore',
        'expectedSourceContentHash',
        'successorMappingsPayload',
        'data-econ-add-legacy-manual',
        "row.dataset.sourceKind === 'manual'",
        'sourceAmountKopecks',
        'legacy_management_reserve_requires_manual_source',
        'CACHE_TTL_MS',
        'renderBundleGate',
        'DIRTY_FORM_SELECTOR',
        'markDraftDirty',
        'guardUnsavedDraft(editableDraftForm(button))',
        'renderSuccessorMappingsReadonly',
    ].forEach((token) => {
        assert(moduleSource.includes(token), `economics management contract is missing: ${token}`);
    });

    ['База', 'Обязательства', 'Факт', 'Разнесение', 'Прогноз', 'Legacy'].forEach((label) => {
        assert(moduleSource.includes(label), `workspace mode is missing: ${label}`);
    });

    assert(
        moduleSource.includes('projects.budget') &&
            moduleSource.includes('estimate_items.planned_price') &&
            moduleSource.includes('Исходные значения не редактируются и не мигрируют автоматически'),
        'legacy wizard must explicitly preserve the old field semantics'
    );

    [
        '.economics-management',
        '.econ-management-tabs',
        '.econ-management-body',
        '.econ-form-grid',
        '.econ-line-editor',
        '.econ-form-error',
        '.econ-master-detail',
        '.econ-table',
        '.econ-history',
        '.econ-legacy-placeholder',
    ].forEach((selector) => {
        assert(styles.includes(selector), `economics management styles are missing: ${selector}`);
    });

    const allowed = makeRuntime(true);
    assert(allowed.PMBI.economicsManagement, 'PMBI.economicsManagement must be exported');
    ['render', 'bind', 'load'].forEach((method) => {
        assert(
            typeof allowed.PMBI.economicsManagement[method] === 'function',
            `economics management export is missing: ${method}`
        );
    });

    const html = allowed.PMBI.economicsManagement.render(42, { status: 'not_configured' });
    assert(html.includes('data-economics-management'), 'authorized render must return the workspace');
    assert(html.includes('data-project-id="42"'), 'workspace must retain the project id');
    assert(html.includes('Управленческая экономика объекта'), 'workspace heading is missing');
    assert(html.includes('data-econ-mode="baseline"'), 'workspace navigation is missing');
    assert(html.includes('Загружаем полный контур'), 'first paint must be fail-closed while the bundle loads');
    assert(!html.includes('data-econ-baseline-create'), 'first paint must not expose financial mutations');

    const bundle = await allowed.PMBI.economicsManagement.load(42);
    assert(bundle && bundle.projectId === 42, 'load must return a project-scoped bundle');
    const requested = allowed.calls.map((item) => item.url);
    [
        '/api/projects/42/financial-baselines',
        '/api/projects/42/commitments',
        '/api/projects/42/actual-costs',
        '/api/projects/42/cash-flow',
        '/api/projects/42/forecasts',
        '/api/projects/42/documents',
        '/api/projects/42/supplier-offers',
        '/api/projects/42/forecast-price-sources',
        '/api/projects/42/economics',
        '/api/projects/42/legacy-economics-migration',
    ].forEach((url) => {
        assert(requested.includes(url), `load did not request ${url}`);
    });
    const loadedHtml = allowed.PMBI.economicsManagement.render(42, { status: 'not_configured' });
    assert(loadedHtml.includes('data-econ-baseline-create'), 'a complete successful bundle must enable baseline creation');

    const cachedCallCount = allowed.calls.length;
    await allowed.PMBI.economicsManagement.load(42);
    assert(allowed.calls.length === cachedCallCount, 'fresh bundle must be reused within its TTL');
    allowed.PMBI.economicsManagement.invalidate(42);
    await allowed.PMBI.economicsManagement.load(42);
    assert(allowed.calls.length > cachedCallCount, 'explicit invalidation must force a fresh bundle');

    const failed = makeRuntime(true, {
        '/api/projects/77/financial-baselines': new Error('temporary_baseline_read_failure'),
    });
    await failed.PMBI.economicsManagement.load(77);
    const failedHtml = failed.PMBI.economicsManagement.render(77, { status: 'not_configured' });
    assert(failedHtml.includes('Контур заблокирован'), 'a partial GET failure must block the workspace');
    assert(!failedHtml.includes('data-econ-baseline-create'), 'a partial GET failure must not expose mutation forms');

    const mapped = makeRuntime(true, {
        '/api/projects/88/financial-baselines': {
            baselines: [{
                id: 12,
                versionNo: 2,
                status: 'approved',
                reason: 'Approved replacement',
                effectiveFrom: '2026-08-21',
                sourceSnapshotHash: 'hash',
                totals: {},
                revenueLines: [],
                budgetLines: [],
                events: [],
                successorMappings: {
                    budget: [{
                        sourceBudgetLineId: 101,
                        targetBudgetLineId: 201,
                        sourceTitle: 'Old concrete',
                        targetTitle: 'New concrete',
                        fromBaselineId: 11,
                        toBaselineId: 12,
                        mappingKind: 'carry_forward',
                        quantityFactor: 1,
                        reason: 'Same economic scope',
                    }],
                    revenue: [],
                },
            }],
        },
    });
    await mapped.PMBI.economicsManagement.load(88);
    const mappedHtml = mapped.PMBI.economicsManagement.render(88, { status: 'configured' });
    assert(mappedHtml.includes('Сопоставление old→new'), 'approved successor mappings must remain visible');
    assert(mappedHtml.includes('Old concrete') && mappedHtml.includes('New concrete'), 'read-only mapping must show both line snapshots');
    assert(mappedHtml.includes('Same economic scope'), 'read-only mapping must preserve its reason');

    assert(
        appSource.includes('PMBI.economicsManagement.invalidate(projectId)') &&
            appSource.includes('preserveEconomicsManagementCache'),
        'project finance reloads must invalidate external economics sources without duplicating an internal refresh'
    );

    const restricted = makeRuntime(false);
    assert(
        restricted.PMBI.economicsManagement.render(42, {}) === '',
        'restricted roles must receive no economics management markup'
    );
    assert(
        await restricted.PMBI.economicsManagement.load(42, true) === null,
        'restricted roles must not load economics management data'
    );
    assert(restricted.calls.length === 0, 'restricted roles must not call economics APIs');

    console.log('economics management frontend tests passed');
}

run().catch((error) => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
