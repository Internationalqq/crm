const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/planning.js'), 'utf8');
function fn(name) {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n    }', start + 10) + 6);
}
const listeners = [];
const moves = [];
const context = {
  state: {selectedProject:{id:25}}, hasRole: () => false, isSelectedProjectScheduleTabActive: () => true,
  bindAutoScheduleForm: () => {}, replaceSelectedProjectMaterialCalendar: () => true,
  loadMaterialSchedule: (id, callback) => callback({}), qsa: () => [],
  document: {body:{dataset:{}}, addEventListener:(kind, handler)=>listeners.push({kind,handler})},
  materialCalendarMove: (id, direction) => moves.push([id,direction]), refreshMaterialScheduleProject:()=>{},
};
vm.createContext(context);
vm.runInContext(fn('bindMaterialCalendarCells') + fn('bindMaterialScheduleTimeline') + fn('loadSelectedProjectMaterialSchedule'), context);
// app.js can load before planning.js. Opening the calendar must install its own delegation.
context.loadSelectedProjectMaterialSchedule(false);
context.loadSelectedProjectMaterialSchedule(false);
assert.equal(listeners.filter(x=>x.kind==='click').length,1);
const nav = {getAttribute:name=>name==='data-project-id'?'25':'-1'};
listeners.find(x=>x.kind==='click').handler({preventDefault(){},target:{closest:sel=>sel==='[data-material-calendar-nav]'?nav:null}});
assert.deepEqual(moves,[['25',-1]]);
// A day can also be opened by keyboard; binding twice must not double the action.
const handlers = {};
let opened = 0;
const cell = {dataset:{},addEventListener:(kind,fn)=>handlers[kind]=fn,getAttribute:name=>name==='data-project-id'?'25':'2026-08-20'};
cell.click=()=>handlers.click({target:cell,currentTarget:cell,preventDefault(){}});
context.qsa=()=>[cell];
context.materialScheduleDayItems=()=>[{id:1}];
context.showDayMaterialsModal=(project,day,items)=>{assert.equal(project,'25'); assert.equal(day,'2026-08-20');assert.equal(items.length,1);opened++;};
context.bindMaterialCalendarCells(context.document);
context.bindMaterialCalendarCells(context.document);
for(const key of ['Enter',' ']) handlers.keydown({key,target:cell,preventDefault(){}});
handlers.keydown({key:'ArrowRight',target:cell,preventDefault(){}});
assert.equal(opened,2);
console.log('Calendar: lazy initialization, single delegation, month navigation and keyboard activation passed');
