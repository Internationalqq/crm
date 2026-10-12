const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const window={PMBI:{}};vm.runInNewContext(fs.readFileSync('frontend/assets/js/tractor.js','utf8'),{window,Intl});
const totals=window.PMBI.tractor.totals;
const item=(kind,status,amount,hours='0',litres='0',location='external')=>({status,data:{kind,amount_cents:amount,hours,litres,location}});
const result=totals([item('work','confirmed',100000,'4'),item('income','confirmed',40000),item('fuel','confirmed',20000,'0','35'),item('work','draft',900000,'12'),item('fuel','cancelled',80000,'0','50'),item('work','confirmed',50000,'3','0','project')]);
assert.deepEqual(JSON.parse(JSON.stringify(result)),{hours:7,litres:35,expenses:20000,billed:100000,received:40000});
console.log('tractor frontend totals PASS: posted only, hours, fuel, cash vs accrued');
