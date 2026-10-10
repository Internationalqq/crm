const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context = {window:{PMBI:{state:{},escapeHtml:esc}},Intl};
vm.runInNewContext(fs.readFileSync('frontend/assets/js/warehouse-control.js','utf8'),context);
const print = context.window.PMBI.warehouseControl.printDocument;
const html = print({inventory:[
    {title:'<script>tool</script>',itemKind:'tool',quantity:2,unit:'шт',status:'purchased'},
    {title:'Кабель',itemKind:'material',quantity:8,unit:'м',status:'on_warehouse'}],
    materials:[{title:'Уровень',itemKind:'tool',stockBalanceQty:1,unit:'шт'},
    {title:'Профиль',unit:'м',plannedQty:10,purchasedQty:9,receivedQty:8,factUsedQty:2,manualUsedQty:1,stockBalanceQty:5}]},'Объект <img>','10 октября');
assert.match(html,/&lt;script&gt;tool&lt;\/script&gt;/);
assert.doesNotMatch(html,/<script>|<img>|data-inventory-source|data-stock-move/);
const tools = html.slice(html.indexOf('<h2>Инструменты'),html.indexOf('<h2>Материалы'));
assert.match(tools,/Уровень/);assert.match(tools,/2 шт/);assert.match(tools,/Куплен · ждём доставку/);
assert.doesNotMatch(tools,/Кабель|Профиль/);
assert.match(html,/На складе компании/);
assert.match(html,/<td class="number">3<\/td><td class="number">5<\/td>/);
assert.match(html,/Объект &lt;img&gt;/);
assert.equal((print({inventory:[],materials:[]},'Пустой','сегодня').match(/Позиций пока нет/g)||[]).length,2);
console.log('warehouse_print_frontend_ok: types, statuses, totals, escaping, empty');
