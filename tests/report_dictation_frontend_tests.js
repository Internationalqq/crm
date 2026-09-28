const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse, merge } = require('../frontend/assets/js/report-dictation.js');

const shift = parse('Три электрика по восемь часов. Экскаватор два часа. Проложили кабель 40 м.');
assert.deepEqual(shift.workforce.map(r => [r.label, r.count, r.hours]), [['Электрики', '3', '8']]);
assert.deepEqual(shift.equipment.map(r => [r.label, r.count, r.hours]), [['Экскаватор', '1', '2']]);
assert.equal(shift.covered.length, 2);
assert.equal(parse('Два электрика и три маляра по 8 часов').workforce[0].hours, '8');
assert.equal(parse('Два электрика и три маляра по 8 часов').workforce[1].count, '3');
assert.equal(parse('Электрики: 3 человека по 7 часов 30 минут').workforce[0].hours, '7.5');
assert.equal(parse('Двадцать три рабочих по восемь с половиной часов').workforce[0].count, '23');
assert.equal(parse('Двадцать три рабочих по восемь с половиной часов').workforce[0].hours, '8.5');
assert.equal(parse('Манипулятор полчаса').equipment[0].hours, '0.5');
assert.equal(parse('Экскаватор 2,5 часа').equipment[0].hours, '2.5');
assert.deepEqual(parse('Пять человек. Экскаватор').workforce[0].missing, ['часы']);
assert.deepEqual(parse('Три электрика').covered, ['Три электрика'], 'A partially filled resource clause must not also be reported as an unmatched work');
assert.deepEqual(parse('Электрики восемь часов').workforce[0].missing, ['количество']);
assert.equal(parse('3 электрика 28 часов').workforce[0].hours, '');
assert.equal(parse('1,5 электрика 8 часов').workforce[0].count, '');
for (const text of ['Завтра будут три электрика по 8 часов', 'Экскаватор не работал', 'Без трёх сварщиков', 'Без 3 сварщиков по 8 часов', 'Ждём манипулятор 2 часа', 'Экскаватор 16 машино-часов', '24 человеко-часа']) {
  const result = parse(text);
  assert.equal(result.workforce.length + result.equipment.length, 0, text);
  assert.ok(result.warnings.length, text);
}
assert.equal(parse('Установили кран. Купили кабель 40 м.').equipment.length, 0);
assert.equal(parse('Два электрика 8 часов. Три электрика 6 часов.').workforce.length, 0);
assert.match(parse('Два электрика 8 часов. Три электрика 6 часов.').warnings[0], /несколько раз/);
assert.equal(parse('Экскаватор с 8 до 17').equipment[0].hours, '');
assert.equal(parse('Экскаватор 8 часов и 2 часа').equipment[0].hours, '');

const first = merge([], shift.workforce);
const second = merge(first.rows, parse('Два электрика по 6 часов').workforce);
assert.equal(second.rows.length, 1, 'Repeated parsing must not duplicate the shift');
assert.equal(second.rows[0].count, '2');
const manual = { label: 'Электрики', count: '4', hours: '7', names: ['Иван'] };
const changed = merge([manual], shift.workforce);
assert.deepEqual(changed.rows, [manual], 'User edits and names must survive another parse');
assert.deepEqual(changed.preserved, ['Электрики']);
assert.equal(merge(first.rows, []).rows.length, 0, 'Removed dictation must remove only untouched automatic rows');
assert.deepEqual(merge([manual], []).rows, [manual]);
assert.equal(merge([], parse('Экскаватор').equipment).rows[0].hours, '', 'Missing hours must never default to eight');

// Run the actual voice lifecycle with controlled asynchronous Recognition events.
const app = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/app.js'), 'utf8');
const block = app.slice(app.indexOf('var reportVoiceState = {'), app.indexOf('function reportAuthorInitials', app.indexOf('var reportVoiceState = {')));
let instances = [], timers = new Map(), seq = 0, toasts = [];
function Recognition() { instances.push(this); }
Recognition.prototype.start = function() { this.started = true; };
Recognition.prototype.stop = function() { this.stopped = true; };
Recognition.prototype.abort = function() { this.aborted = true; };
const context = {
  window: { isSecureContext: true, SpeechRecognition: Recognition },
  console: { warn() {} }, Event: class { constructor(type) { this.type = type; } },
  CustomEvent: class { constructor(type) { this.type = type; } },
  setTimeout(fn) { timers.set(++seq, fn); return seq; }, clearTimeout(id) { timers.delete(id); },
  qs() { return null; }, qsa() { return []; }
};
vm.runInNewContext(block + '\nshowReportVoiceToast = msg => recordToast(msg); this.api = {start:startReportVoiceRecognition, stop:stopReportVoiceRecognition};', Object.assign(context, {recordToast: m => toasts.push(m)}));
function controls(value = '') {
  const events = [], overlay = {visible:false};
  const form = {isConnected:true, dispatchEvent(event) { events.push(event.type); }, _reportDictation:{wait() {overlay.visible=true;},cancel(){overlay.visible=false;}}};
  const input = {name:'raw_input', form, value, dispatchEvent(){}, focus(){}};
  const button = {disabled:false, classList:{toggle(){},remove(){}}, setAttribute(){}};
  return {input,button,events,overlay,form};
}
function result(recognition, words) { recognition.onresult({results:[{0:{transcript:words}}]}); }
const late = controls('Проложили кабель.');
context.api.start(late.input, late.button);
const r1 = instances.at(-1);
result(r1, 'Три электрика'); context.api.stop(false);
assert.equal(late.events.length, 0, 'Stop must wait for the final words');
assert.equal(late.overlay.visible, true);
assert.equal(late.button.disabled, true);
result(r1, 'Три электрика восемь часов'); r1.onend(); r1.onend();
assert.equal(late.input.value, 'Проложили кабель. Три электрика восемь часов');
assert.deepEqual(late.events, ['pmbi:report-dictation-complete']);
assert.equal(late.button.disabled, false);
assert.equal(late.overlay.visible, false);

const restarted = controls(); context.api.start(restarted.input,restarted.button);
const r2 = instances.at(-1); result(r2, 'Экскаватор');
context.api.start(restarted.input,restarted.button); const r3 = instances.at(-1);
assert.equal(r2.aborted,true); result(r2,'Старый поздний результат'); r2.onend();
assert.equal(restarted.input.value,'Экскаватор');
result(r3,'два часа'); r3.onend();
assert.equal(restarted.input.value,'Экскаватор два часа');
assert.equal(restarted.events.length,1);

const failed = controls(); context.api.start(failed.input,failed.button);
const r4 = instances.at(-1); result(r4,'Два электрика'); r4.onerror({error:'network'}); r4.onend();
assert.equal(r4.aborted,true); assert.equal(failed.events.length,0); assert.match(toasts.at(-1),/интернет/);
const submitted = controls(); context.api.start(submitted.input,submitted.button);
const r5 = instances.at(-1); result(r5,'Электрик'); context.api.stop(false,true); r5.onend();
assert.equal(submitted.events.length,0,'Submitting or cancelling a form must not start a second draft update');
const stalled = controls(); context.api.start(stalled.input,stalled.button);
const r6=instances.at(-1); result(r6,'Маляр'); context.api.stop(false);
Array.from(timers.values()).forEach(fn => fn()); r6.onend();
assert.equal(stalled.overlay.visible,false); assert.equal(stalled.button.disabled,false); assert.equal(stalled.events.length,0);
assert.match(toasts.at(-1),/Заполнить из описания/);
console.log('report_dictation_frontend_ok');
