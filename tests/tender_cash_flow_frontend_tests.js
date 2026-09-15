'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/tender_economics.js'), 'utf8');
const context = {document:{querySelector:() => ({dataset:{tenderId:'12345678'}})}};
vm.runInNewContext(source.replace('  load();\n})();',
  '  globalThis.testCash = {emptyCash,cashFromStored,updateCashControl,cashResultHtml,cashEditorHtml};\n})();'), context);
const {emptyCash, cashFromStored, updateCashControl, cashResultHtml, cashEditorHtml} = context.testCash;
assert.equal(cashFromStored(null), null);
assert.equal(emptyCash().opening_cash, '');
assert.equal(emptyCash().confirmed, false);
assert.equal(emptyCash().payments.length, 0);
const stored = {opening_cash:0, confirmed:true,
  payments:[{kind:'receipt',on:'2026-10-01',amount:10001,note:'Заказчик'}],
  securities:[{paid_on:'2026-09-30',returned_on:null,amount:101,note:'Обеспечение'}]};
const draft = cashFromStored(stored);
assert.equal(draft.opening_cash, '0,00');
assert.equal(draft.payments[0].amount, '100,01');
assert.equal(draft.securities[0].amount, '1,01');
assert.equal(draft.securities[0].returned_on, '');
draft.payments[0].note = 'Изменено';
assert.equal(stored.payments[0].note, 'Заказчик');
const conditions = {cash_flow:draft};
assert.equal(updateCashControl({dataset:{},value:'test'}, conditions), false);
updateCashControl({dataset:{cashField:'amount',cashSection:'payments',cashIndex:'0'},value:'90,01',type:'text'}, conditions);
assert.equal(draft.payments[0].amount, '90,01');
assert.equal(draft.confirmed, false);
updateCashControl({dataset:{cashField:'confirmed'},checked:true,type:'checkbox'}, conditions);
assert.equal(draft.confirmed, true);
updateCashControl({dataset:{cashField:'opening_cash'},value:'',type:'text'}, conditions);
assert.equal(draft.opening_cash, '');
assert.equal(draft.confirmed, false);
const initial = {cash_flow:null};
updateCashControl({dataset:{cashField:'opening_cash'},value:'0',type:'text'}, initial);
assert.equal(initial.cash_flow.opening_cash, '0');
assert.equal(initial.cash_flow.confirmed, false);
const missing = cashResultHtml({status:'incomplete',missing:['opening_cash'],scheduled_receipts_kopecks:10001,scheduled_payments_kopecks:5003},false);
assert.ok(missing.includes('доступные деньги к началу графика'));
assert.ok(!missing.includes('Нехватка доступных средств'));
const result = cashResultHtml({status:'calculated',cash_gap_kopecks:1,closing_balance_kopecks:6999,first_gap_on:'2026-10-05',
  scheduled_receipts_kopecks:10001,expected_receipts_kopecks:10001,scheduled_payments_kopecks:5003,expected_payments_kopecks:5003,
  days:[{on:'2026-10-05',in_kopecks:0,out_kopecks:5003,balance_kopecks:-1}]},false);
assert.ok(result.includes('0,01 ₽') && result.includes('−0,01 ₽') && result.includes('05.10.2026'));
assert.ok(result.includes('внутридневной порядок не учитывается'));
assert.ok(!cashResultHtml({status:'calculated',cash_gap_kopecks:1},true).includes('0,01'));
draft.payments[0].note = '<img src=x onerror=alert(1)>';
const html = cashEditorHtml({conditions:{cash_flow:draft},dirty:true},null,true);
assert.ok(html.includes('&lt;img'));
assert.ok(!html.includes('<img'));
assert.ok(html.includes('data-cash-index="0"') && html.includes('data-cash-field="returned_on"'));
assert.ok(html.includes('НДС к уплате') && html.includes('Возврат НДС'));
console.log('Tender cash flow: exact input, blank/zero, isolated copies, confirmation reset, incomplete/negative result, dates and escaping passed');
