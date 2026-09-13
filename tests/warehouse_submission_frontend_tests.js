const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/warehouse-control.js'), 'utf8');
const keyStart = source.indexOf('    function operationPayload(');
const keyEnd = source.indexOf('    function quantity(', keyStart);
let nextKey = 0;
const operationPayload = new Function('requestKey', source.slice(keyStart, keyEnd) + ';return operationPayload;')(prefix => prefix + ':' + ++nextKey);
for (const prefix of ['stock-move', 'work-fact']) {
    const form = {};
    const value = {quantity:5, comment:'Partial'};
    const first = operationPayload(form, prefix, value);
    assert.equal(operationPayload(form, prefix, {...value}).idempotencyKey, first.idempotencyKey);
    assert.equal(operationPayload(form, prefix, {...value, quantity:6}).idempotencyKey, first.idempotencyKey, 'An uncertain save must not become a new operation merely because a field changed');
    assert.notEqual(operationPayload({}, prefix, value).idempotencyKey, first.idempotencyKey, 'A new form starts a new operation');
    assert.equal(value.idempotencyKey, undefined, 'Do not mutate the draft');
}
const start = source.indexOf('            stockForm.onsubmit = function');
const end = source.indexOf('\n            };', start) + '\n            };'.length;
assert.ok(start >= 0 && end > start);
const stockForm = {dataset:{}, elements:Object.fromEntries(Object.entries({estimate_item_id:'20', move_type:'receipt', qty:'5', comment:'Partial'}).map(([key,value])=>[key,{value}]))};
const requests = [];
let failRefresh = true;
const deps = {
    stockForm, projectId:25, operationPayload,
    qs:()=>({classList:{remove(){},add(){}},textContent:''}),
    pickerInput:null,
    PMBI:{withSubmitLock(form, factory) {form.dataset.submitLocked='1';return factory().finally(()=>{form.dataset.submitLocked='0';});}},
    api:(url, options)=>new Promise((resolve,reject)=>requests.push({url, payload:JSON.parse(options.body),resolve,reject})),
    showAppNotice(){}, errorText:()=> 'error',
    load:()=>failRefresh ? Promise.reject(new Error('Refresh failed after accepted POST')) : Promise.resolve(),
};
new Function(...Object.keys(deps), source.slice(start,end))(...Object.values(deps));
(async()=>{
    const event = {preventDefault(){}};
    const first = stockForm.onsubmit(event);
    stockForm.onsubmit(event);
    assert.equal(requests.length,1,'Double submit is blocked');
    requests[0].resolve({id:1});
    await first;
    assert.equal(stockForm.dataset.submitLocked,'0');
    failRefresh = false;
    const retry = stockForm.onsubmit(event);
    assert.equal(requests[1].payload.idempotencyKey,requests[0].payload.idempotencyKey,'Retry after failed refresh must not create another delivery');
    requests[1].resolve({id:1,idempotentReplay:true});
    await retry;
    console.log('warehouse_submission_frontend_ok');
})().catch(error=>{console.error(error);process.exitCode=1;});
