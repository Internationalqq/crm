const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/app.js'), 'utf8');
const start = source.indexOf('    function saveActualQuantityInput(');
const end = source.indexOf('    function closeWorkQuantityDialog(', start);
const implementation = source.slice(start, end);

// A successful save rebuilds the active register once and binds each handler once.
{
    const viewStart = source.indexOf('    function rerenderProjectMaterialAndWorkViews(');
    const viewEnd = source.indexOf('    function bindMaterialManualChecks(', viewStart);
    const calls = {};
    const record = name => () => {calls[name] = (calls[name] || 0) + 1;};
    const project = {id:25};
    const deps = {state:{selectedProject:project, projects:[project], stagesByProject:{}, materialsByProject:{}, materialInsightsByProject:{}},
        qs: () => ({}), PMBI:{planning:{bindProjectScheduleViews:record('planning')}},
    };
    for (const name of ['safeReplaceChildren', 'renderMaterials', 'renderSchedulePanel', 'bindProjectMarketToggles',
        'bindProjectChainActions', 'bindSectionScheduleRefresh', 'bindSectionScheduleInteractions', 'bindActualQuantityInputs',
        'syncBulkSectionChecks', 'bindAutoScheduleForm', 'bindScheduleStatusActions']) deps[name] = record(name);
    const refresh = new Function(...Object.keys(deps), source.slice(viewStart, viewEnd) + ';return refreshSelectedProjectProgressViews;')(...Object.values(deps));
    refresh(99);
    assert.deepEqual(calls, {}, 'An old project response must not rebuild the current object');
    refresh(25);
    for (const name of ['renderSchedulePanel', 'bindActualQuantityInputs', 'planning', 'bindAutoScheduleForm', 'bindScheduleStatusActions']) {
        assert.equal(calls[name], 1, name + ' runs once');
    }
}

function fixture() {
    const requests = [], saved = [], refreshed = [];
    const input = {value:'12.5', defaultValue:'0', dataset:{}, getAttribute(name) {
        return {'data-project-id':'25', 'data-item-id':'30', 'data-actual-kind':'work', 'data-section-title':'Section'}[name] || '';
    }};
    const dependencies = {
        actualQuantityInputItem: () => ({id:30, title:'Work', unit:'100 м2'}),
        quantityPlanInfo: () => ({totalQty:256}),
        quantityText: String,
        showAppNotice: () => {},
        clampActualQty: value => Math.max(0, Math.min(Number(value), 256)),
        updateActualQuantityLabel: () => {},
        postProgressItem: (id, payload) => new Promise((resolve, reject) => requests.push({id, payload, resolve, reject})),
        setWorkActualQty: (...args) => saved.push(args.at(-1)),
        setMaterialManualActualQty: () => assert.fail('Wrong quantity kind'),
        updateMaterialScheduleItemDom: () => {},
        sectionBulkScope: () => null,
        updateBulkSectionCheckState: () => {},
        refreshSelectedProjectProgressViews: id => refreshed.push(id),
    };
    const save = new Function(...Object.keys(dependencies), implementation + ';return saveActualQuantityInput;')(...Object.values(dependencies));
    return {input, requests, saved, refreshed, save};
}

(async () => {
    const f = fixture();
    await f.save(f.input, false);
    assert.deepEqual(f.saved, [], 'Typing must not persist an unconfirmed fact');
    const failed = f.save(f.input, true);
    assert.equal(f.save(f.input, true), failed, 'Change and blur share one pending request');
    assert.equal(f.input.dataset.progressSyncedValue, undefined);
    f.requests[0].reject(new Error('offline'));
    await assert.rejects(failed, /offline/);
    assert.deepEqual(f.saved, []);
    const retry = f.save(f.input, true);
    assert.equal(f.requests.length, 2, 'Same value must retry after failure');
    f.requests[1].resolve({ok:true});
    await retry;
    assert.deepEqual(f.saved, [12.5]);
    assert.equal(f.input.defaultValue, '12.5', 'Escape returns to the latest saved value');
    await f.save(f.input, true);
    assert.equal(f.requests.length, 2);

    f.input.value = '20';
    const first = f.save(f.input, true);
    f.input.value = '30';
    const last = f.save(f.input, true);
    assert.equal(f.requests.length, 3, 'Next edit waits for the in-flight request');
    f.requests[2].resolve({});
    await first;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.requests[3].payload.actualQty, 30);
    f.requests[3].resolve({});
    await last;
    assert.deepEqual(f.saved, [12.5, 20, 30]);
    assert.equal(f.input.dataset.progressSyncedValue, '30');
    for (const value of ['', '-1', 'NaN', '300']) {
        f.input.value = value;
        await assert.rejects(f.save(f.input, true), /Введите выполненный объём/);
    }
    assert.equal(f.requests.length, 4, 'Invalid input cannot reset the saved fact');
    f.input.value = '200';
    const normalized = f.save(f.input, true);
    f.requests[4].resolve({actualQty:150});
    await normalized;
    assert.equal(f.input.defaultValue, '150', 'Use the server value if the estimate changed meanwhile');
    assert.equal(f.saved.at(-1), 150);
    console.log('progress_save_frontend_ok');
})().catch(error => {console.error(error); process.exitCode = 1;});
