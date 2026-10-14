const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const window={PMBI:{}};vm.runInNewContext(fs.readFileSync('frontend/assets/js/tractor.js','utf8'),{window,Intl});
const totals=window.PMBI.tractor.totals;
const item=(kind,status,amount,hours='0',litres='0',location='external')=>({status,data:{kind,amount_cents:amount,hours,litres,location}});
const result=totals([item('work','confirmed',100000,'4'),item('income','confirmed',40000),item('fuel','confirmed',20000,'0','35'),item('work','draft',900000,'12'),item('fuel','cancelled',80000,'0','50'),item('work','confirmed',50000,'3','0','project')]);
assert.deepEqual(JSON.parse(JSON.stringify(result)),{hours:7,litres:35,expenses:20000,billed:100000,received:40000});
console.log('tractor frontend totals PASS: posted only, hours, fuel, cash vs accrued');

const ledger=window.PMBI.tractor;
const dated=(id,date,location,external,kind='work',status='confirmed')=>({id,status,data:{date,location,external,kind,hours:'8',litres:'0',rate_cents:0,amount_cents:0}});
const groups=ledger.groupDays([dated(1,'2026-08-03','external','Дегтярка'),dated(2,'2026-08-03','external','Дегтярка','fuel'),dated(3,'2026-08-03','company',''),dated(4,'2026-08-02','external','Другая площадка')]);
assert.equal(groups.length,3);assert.equal(groups[0].date,'2026-08-02');assert.equal(groups.find(g=>g.site==='external:Дегтярка').items.length,2);
assert.equal(ledger.siteKey({location:'project',project_id:7}),'project:7');
assert.equal(ledger.coverage([dated(1,'2026-08-03','external','Дегтярка'),dated(2,'2026-08-03','external','Дегтярка','fuel'),dated(3,'2026-08-03','external','Дегтярка','work','draft')]).rates,1);
assert.equal(ledger.coverage([dated(1,'2026-08-03','external','Дегтярка','fuel')]).fuel,1);
assert.equal(totals([item('downtime','confirmed',0,'0')]).hours,0);
console.log('tractor grouped days/sites, missing prices, downtime PASS');
