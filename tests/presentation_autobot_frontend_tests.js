const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/presentation-autobot.js'), 'utf8');

class Element {
    constructor() {
        this.events = {}; this.children = {}; this.dataset = {}; this.attributes = {};
        this.classes = new Set(); this.hidden = false;
        this.classList = {
            add: n => this.classes.add(n), remove: n => this.classes.delete(n),
            toggle: (n, on) => on ? this.classes.add(n) : this.classes.delete(n)
        };
        this.style = {setProperty: (n,v) => { this.attributes[n] = v; }};
    }
    addEventListener(n, fn) { (this.events[n] ||= []).push(fn); }
    emit(n, event = {}) { (this.events[n] || []).forEach(fn => fn(event)); }
    querySelector(n) { return this.children[n] || null; }
    querySelectorAll(n) { return this.children[n] || []; }
    setAttribute(n, v) { this.attributes[n] = v; }
    contains(e) { return e === this || this.owned === e; }
    focus() { this.focused = true; }
    append(e) { (this.appended ||= []).push(e); }
}
function setup({reduce=false, saveData=false, observer=true}={}) {
    const doc = new Element(), reduced = new Element(), connection = new Element();
    doc.body = new Element(); doc.hidden = false; doc.createElement = () => new Element();
    reduced.matches = reduce; connection.saveData = saveData;
    const demo = new Element(), tablist = new Element(), disclosure = new Element(), summary = new Element(), region = new Element();
    const tabs = [0,1,2,3].map(() => new Element());
    const panels = [0,1,2,3].map(() => new Element());
    const next = [1,2,3].map(n => { const b=new Element(); b.dataset.botNext=String(n); b.parentElement=new Element(); return b; });
    disclosure.children.summary = summary;
    demo.children = {'.bot-stage-tabs':tablist,'[data-bot-step]':tabs,'.bot-panel':panels,'.bot-source-detail':disclosure,'[data-bot-next]':next,'.bot-panels':region};
    doc.children['.bot-demo'] = demo;
    let notify, id=0, now=0; const frames = new Map();
    class IntersectionObserver { constructor(fn) { notify=fn; } observe() {} }
    const window = {matchMedia:()=>reduced}; if(observer) window.IntersectionObserver=IntersectionObserver;
    vm.runInNewContext(source,{document:doc,window,navigator:{connection},IntersectionObserver,
        requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
    return {doc,reduced,connection,demo,tabs,panels,next,disclosure,summary,frames,
        visible(value) { notify?.([{isIntersecting:value}]); },
        advance(ms) { for(let t=0;t<ms;t+=50) {now+=50; const batch=[...frames.values()]; frames.clear(); batch.forEach(fn=>fn(now));} }
    };
}
const h=setup();
assert.equal(h.demo.dataset.botStage,'0');
assert.equal(h.panels.filter(p=>!p.hidden).length,1);
assert.equal(h.frames.size,0,'Offscreen demo has no animation loop');
h.visible(true);h.advance(6700);
assert.equal(h.demo.dataset.botStage,'1','Uploaded document becomes structured rows');
h.advance(6500);assert.equal(h.demo.dataset.botStage,'2');
h.advance(1500);assert.equal(h.disclosure.open,true,'Review exposes the source line automatically');
h.summary.emit('click');h.disclosure.open=false;h.advance(1000);
assert.equal(h.disclosure.open,false,'Manual close is respected for the rest of this stage');
h.advance(4000);assert.equal(h.demo.dataset.botStage,'3');
h.advance(6500);assert.equal(h.demo.dataset.botStage,'0','Walkthrough repeats');
h.next[1].emit('click');assert.equal(h.demo.dataset.botStage,'2');
h.advance(6700);assert.equal(h.demo.dataset.botStage,'3','A next-step click does not pause automatic playback');
h.tabs[3].emit('keydown',{key:'ArrowRight',preventDefault(){}});
assert.equal(h.demo.dataset.botStage,'0');assert(h.tabs[0].focused);
h.tabs[0].emit('keydown',{key:'End',preventDefault(){}});assert.equal(h.demo.dataset.botStage,'3');
h.visible(false);assert.equal(h.frames.size,0);h.advance(10000);assert.equal(h.demo.dataset.botStage,'3');
h.visible(true);h.doc.hidden=true;h.doc.emit('visibilitychange');assert.equal(h.frames.size,0);
h.doc.hidden=false;h.doc.emit('visibilitychange');assert.equal(h.frames.size,1);
h.reduced.matches=true;h.reduced.emit('change');assert.equal(h.frames.size,0);
assert.equal(h.demo.dataset.botMotion,'static');assert(!h.doc.body.classes.has('motion-ready'));
h.tabs[1].emit('click');assert.equal(h.demo.dataset.botStage,'1');assert.equal(h.frames.size,0);
h.reduced.matches=false;h.reduced.emit('change');assert.equal(h.frames.size,1);
for (const options of [{reduce:true},{saveData:true}]) {
    const q=setup(options);q.visible(true);q.advance(30000);
    assert.equal(q.demo.dataset.botStage,'0');assert.equal(q.frames.size,0);
    q.next[0].emit('click');assert.equal(q.demo.dataset.botStage,'1');
    q.next[1].emit('click');q.summary.emit('click');q.disclosure.open=true;
    assert.equal(q.demo.dataset.botStage,'2');assert.equal(q.disclosure.open,true);
}
const focused=setup();focused.panels[0].owned=focused.next[0];focused.doc.activeElement=focused.next[0];focused.next[0].emit('click');
assert(focused.panels[1].focused,'Focus moves out of the panel being hidden');
assert.equal(setup({observer:false}).frames.size,1,'Older browsers still run the demonstration');
console.log('AutoBot presentation: four-stage loop, source disclosure, next actions, keyboard, focus, preferences and visibility passed.');
