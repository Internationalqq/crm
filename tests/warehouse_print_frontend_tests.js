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

// Exercise lifecycle without a real printer: the browser delivers afterprint
// for either completing or cancelling its print dialog.
const source = fs.readFileSync('frontend/assets/js/warehouse-control.js','utf8');
const start = source.indexOf('    function openPrint(');
const end = source.indexOf('    function toolsInventory(',start);
let current = null, calls = 0, focus = 0, notice = '', fail = false;
const trigger = {isConnected:true,focus(options){assert.equal(options.preventScroll,true);focus++;}};
const document = {
    activeElement:trigger,querySelector(){return current;},
    createElement(tag){
        assert.equal(tag,'iframe');
        const events = {}, printEvents = {};
        return {style:{},setAttribute(){},addEventListener(name,handler){events[name]=handler;},
            load(){events.load();},finish(){printEvents.afterprint();},remove(){current=null;},
            contentWindow:{addEventListener(name,handler){printEvents[name]=handler;},focus(){},print(){calls++;if(fail)throw new Error('Unavailable');}}};
    },body:{appendChild(frame){current=frame;}}
};
const openPrint = new Function('document','state','printDocument','showAppNotice',source.slice(start,end)+';return openPrint;')(
    document,{projects:[{id:10,title:'Объект'}]},()=>html,message=>notice=message);
for(let attempt=0;attempt<2;attempt++){
    openPrint({},10);const frame=current;
    openPrint({},10);assert.equal(current,frame,'Double click does not create another print document');
    assert.equal(calls,attempt,'Wait for CSS/document load before printing');
    frame.load();assert.equal(calls,attempt+1);
    frame.finish();assert.equal(current,null,'Cancel/finish removes print document');
    assert.equal(focus,attempt+1,'Return focus to original control');
}
fail=true;openPrint({},10);current.load();assert.equal(current,null);
assert.match(notice,/Не удалось открыть печать/);
console.log('warehouse_print_lifecycle_ok: wait, duplicate, cancel, retry, focus, failure');
