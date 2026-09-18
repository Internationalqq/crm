const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
    constructor() {
        this.events = {}; this.attributes = {}; this.children = []; this.textContent = '';
        this.style = {}; this.classes = new Set();
        this.classList = {remove: x => this.classes.delete(x), toggle: (x,on) => on ? this.classes.add(x) : this.classes.delete(x)};
    }
    setAttribute(k,v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] ?? null; }
    addEventListener(k,fn) { (this.events[k] ||= []).push(fn); }
    emit(k) { (this.events[k] || []).forEach(fn => fn()); }
    append(...els) { this.children.push(...els); }
    replaceChildren(...els) { this.children = els; }
    remove() { this.removed = true; }
}
const source = fs.readFileSync(path.join(__dirname,'../frontend/assets/js/presentation-guide.js'),'utf8');
let resize, disconnected = false;
const window = {};
vm.runInNewContext(source, {window, document: {createElement: () => new Element()}, ResizeObserver: class {
    constructor(callback) { resize = callback; } observe() {} disconnect() { disconnected = true; }
}});
const video = new Element(), screen = new Element(), title = new Element(), description = new Element(), host = new Element();
Object.assign(video, {currentTime: 1, videoWidth: 900, videoHeight: 632, seeking: false});
Object.assign(screen, {clientWidth: 900, clientHeight: 400});
title.textContent = 'Original result'; description.textContent = 'Original explanation';
video.setAttribute('src','/assets/media/product/crm-report-focus.mp4');
const guide = window.PMBITourGuide.create({video,screen,title,description,host});
const steps = host.children[0], target = screen.children[0];
assert(steps.hidden && target.hidden, 'No annotations before real playback');
guide.show();
assert.equal(title.textContent,'Нажимаем на фото в отчёте');
assert.equal(steps.children.length,2);
assert.equal(steps.children[0].getAttribute('aria-current'),'step');
assert.equal(target.hidden,false);
const fitted = 400*900/632;
assert(Math.abs(parseFloat(target.style.left)-((900-fitted)/2+fitted*.05))<.01,'Targets use the contained video rectangle, including letterboxing');
assert.equal(parseFloat(target.style.top),148);
assert.equal(target.children[0].style.left,'-32px','A target with space uses an outside left marker');
Object.assign(steps,{scrollWidth:340,clientWidth:180,scrollLeft:0});
Object.assign(steps.children[0],{offsetLeft:0,offsetWidth:140});
Object.assign(steps.children[1],{offsetLeft:150,offsetWidth:170});
video.currentTime = 2.649999; video.emit('timeupdate');
assert.equal(title.textContent,'Снимок открыт крупно'); assert(target.hidden);
assert.equal(steps.scrollLeft,140,'Automatic step changes reveal the active control inside its own strip');
assert.equal(steps.children[1].getAttribute('aria-current'),'step');
video.paused = false;
steps.children[0].emit('click');
assert.equal(video.currentTime,0); assert.equal(video.paused,false,'Selecting a step seeks without pausing');
assert.equal(steps.scrollLeft,0,'Seeking back brings the start of the strip into view');
assert.equal(title.textContent,'Нажимаем на фото в отчёте');
video.currentTime = 1; video.seeking = true; video.emit('seeking'); assert(target.hidden,'No target over a stale frame while seeking');
video.seeking = false; video.emit('seeked'); assert(!target.hidden);
screen.clientWidth = 700; resize(); assert(parseFloat(target.style.left)<150,'Resize updates the target position');
guide.hide(); assert(steps.hidden && target.hidden); assert.equal(title.textContent,'Original result');
video.currentTime = 4; video.emit('timeupdate'); assert.equal(title.textContent,'Original result','Static fallback cannot acquire an action caption');
video.setAttribute('src','/assets/media/product/bot-export-mobile.mp4');
video.currentTime = 5; guide.show();
assert.equal(title.textContent,'Смета готова к добавлению');
assert(description.textContent.includes('перед подтверждением'),'Import preparation is not represented as completed import');
video.emit('error'); assert(steps.hidden && target.hidden); assert.equal(description.textContent,'Original explanation');
Object.assign(screen,{clientWidth:450,clientHeight:316});
Object.assign(video,{currentTime:1,videoWidth:900,videoHeight:632});
video.setAttribute('src','/assets/media/product/bot-estimate-focus.mp4'); guide.show();
assert.equal(target.children[0].style.top,'-32px','At the left edge the number moves above its control');
assert(parseFloat(target.children[0].style.left)>=0,'The marker cannot be clipped off the left edge');
video.setAttribute('src','/unknown.mp4'); guide.show(); assert(steps.hidden);
// Every shipped clip has a guide; seeking updates the accessible active step in both directions.
const media = path.join(__dirname,'../frontend/assets/media/product');
for (const name of fs.readdirSync(media).filter(n => n.endsWith('.mp4'))) {
    video.setAttribute('src','/assets/media/product/'+name+'?v=1'); video.currentTime = 0; guide.show();
    assert(!steps.hidden,`Guide missing for ${name}`);
    let previous = -1;
    for (const button of steps.children) {
        button.emit('click');
        assert(video.currentTime>previous,`${name}: ordered cue times`); previous = video.currentTime;
        assert.equal(button.getAttribute('aria-current'),'step');
        assert(title.textContent.length>0 && description.textContent.length>0);
    }
    steps.children[0].emit('click'); assert.equal(steps.children[0].getAttribute('aria-current'),'step');
    video.emit('loadstart'); assert(steps.hidden && target.hidden,'New media resets annotations until playback');
}
guide.destroy(); assert(disconnected && steps.removed && target.removed);
console.log('Tour guides: 24 sources, timed action/result captions, seeking, letterboxed targets, resize, source changes, static/error fallback and teardown passed.');
