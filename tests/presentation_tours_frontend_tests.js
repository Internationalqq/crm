const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
    constructor() {
        this.events = {}; this.attributes = {}; this.children = {}; this.dataset = {};
        this.classes = new Set(); this.hidden = false;
        this.classList = {add: x => this.classes.add(x), remove: x => this.classes.delete(x), toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x)};
        this.style = {setProperty: (key, value) => { this.attributes[key] = value; }};
    }
    addEventListener(event, callback) { (this.events[event] ||= []).push(callback); }
    emit(event, data = {}) { (this.events[event] || []).forEach(fn => fn(data)); }
    querySelector(selector) { return this.children[selector] || null; }
    querySelectorAll(selector) { return this.children[selector] || []; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    focus() { this.focused = true; }
}
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/presentation-tours.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup({reduce = false, mobile = false, saveData = false, reject = false, delayed = false, focused = false} = {}) {
    const doc = new Element(), preference = new Element(), compact = new Element(), wide = new Element(), connection = new Element(), tablist = new Element();
    preference.matches = reduce; compact.matches = mobile; wide.matches = !mobile; connection.saveData = saveData;
    doc.body = new Element(); doc.hidden = false;
    tablist.scrollLeft = 0; tablist.clientWidth = 220;
    const root = new Element(), panels = [], tabs = [], videos = [], screens = [], statuses = [], promises = [];
    for (let i = 0; i < 4; i++) {
        const panel = new Element(), tab = new Element(), video = new Element(), screen = new Element(), status = new Element();
        tab.attributes = {'aria-controls': `scene-${i}`, 'aria-selected': String(i === 0)};
        tab.offsetLeft = i * 120; tab.offsetWidth = 100;
        panel.hidden = i !== 0; status.hidden = true;
        video.paused = true; video.readyState = 1; video.currentTime = 0; video.duration = 10;
        video.dataset = {src: `/scene-${i}.mp4`, mobile: `/scene-${i}-mobile.mp4`};
        if (focused && i === 0) Object.assign(video.dataset, {preview: '/focus.mp4', previewMobile: '/focus-mobile.mp4'});
        Object.defineProperty(video, 'src', {get: () => video.getAttribute('src'), set: value => video.setAttribute('src', value)});
        video.closest = () => screen;
        video.pause = () => { video.paused = true; };
        video.play = () => {
            if (reject) return Promise.reject(new Error('Autoplay denied'));
            if (delayed) return new Promise(resolve => promises.push(() => { video.paused = false; video.emit('playing'); resolve(); }));
            video.paused = false; video.emit('playing'); return Promise.resolve();
        };
        panel.children = {'video': video, '.tour-media-status': status};
        panels.push(panel); tabs.push(tab); videos.push(video); screens.push(screen); statuses.push(status);
    }
    root.children = {'[data-tour-tab]': tabs, '.tour-tabs': tablist};
    doc.children = {'[data-tour]': [root]};
    doc.getElementById = id => panels[Number(id.split('-')[1])];
    let observer;
    class IntersectionObserver { constructor(callback) { observer = callback; } observe() {} }
    vm.runInNewContext(source, {document: doc, navigator: {connection}, window: {IntersectionObserver, matchMedia: q => q.includes('reduced') ? preference : q.includes('1101') ? wide : compact}, IntersectionObserver});
    return {doc, root, preference, compact, wide, tablist, connection, panels, tabs, videos, screens, statuses, promises,
        visible(value) { observer([{isIntersecting: value}]); },
        selected() { return tabs.findIndex(tab => tab.attributes['aria-selected'] === 'true'); }};
}

(async () => {
    const h = setup();
    assert.equal(h.tablist.getAttribute('aria-orientation'), 'vertical');
    assert(h.videos.every(v => v.src === null), 'Offscreen tours do not download video');
    h.visible(true); await flush();
    assert.equal(h.videos[0].src, '/scene-0.mp4');
    assert.equal(h.videos[0].paused, false);
    assert(h.screens[0].classes.has('is-playing'));
    assert(h.videos.slice(1).every(v => !v.src));
    h.videos[0].emit('ended'); await flush();
    assert.equal(h.selected(), 1, 'A finished clip advances to the next chapter');
    h.tabs[3].emit('click'); await flush();
    assert.equal(h.selected(), 3);
    assert.equal(h.videos[1].paused, true);
    h.videos[3].emit('ended'); await flush();
    assert.equal(h.selected(), 0, 'Manual selection continues into the loop');
    assert(!h.tabs.some(t => t.focused), 'Automatic changes never move keyboard focus');
    h.tabs[0].emit('keydown', {key: 'End', preventDefault() {}}); await flush();
    assert.equal(h.selected(), 3); assert(h.tabs[3].focused);
    h.tabs[3].emit('keydown', {key: 'ArrowDown', preventDefault() {}}); await flush();
    assert.equal(h.selected(), 0, 'The vertical rail wraps with ArrowDown'); assert(h.tabs[0].focused);
    h.tabs[0].emit('keydown', {key: 'ArrowUp', preventDefault() {}}); await flush();
    assert.equal(h.selected(), 3);
    h.wide.matches = false; h.wide.emit('change');
    assert.equal(h.tablist.getAttribute('aria-orientation'), 'horizontal');
    assert.equal(h.selected(), 3, 'Resizing preserves the selected chapter');
    h.tabs[3].emit('keydown', {key: 'ArrowRight', preventDefault() {}}); await flush();
    assert.equal(h.selected(), 0, 'Tablet and phone tabs use horizontal arrow keys');
    h.tabs[0].emit('keydown', {key: 'ArrowLeft', preventDefault() {}}); await flush();
    assert.equal(h.selected(), 3);
    assert.equal(h.tablist.scrollLeft, 240, 'The last horizontal chapter is brought into view');
    h.tabs[3].emit('keydown', {key: 'Home', preventDefault() {}}); await flush();
    assert.equal(h.tablist.scrollLeft, 0, 'Returning to the first chapter reveals the start of the strip');
    h.tabs[3].emit('click'); await flush();
    h.visible(false); assert(h.videos.every(v => v.paused));
    h.visible(true); await flush();
    h.doc.hidden = true; h.doc.emit('visibilitychange'); assert(h.videos.every(v => v.paused));
    h.doc.hidden = false; h.doc.emit('visibilitychange'); await flush();
    assert.equal(h.videos[3].paused, false);
    h.preference.matches = true; h.preference.emit('change');
    assert(h.videos.every(v => v.paused)); assert(!h.screens[3].classes.has('is-playing'));
    h.tabs[1].emit('click'); assert.equal(h.selected(), 1); assert(h.videos.every(v => v.paused));
    h.preference.matches = false; h.preference.emit('change'); await flush();
    h.compact.matches = true; h.compact.emit('change'); await flush();
    assert.equal(h.videos[1].src, '/scene-1-mobile.mp4', 'A phone uses its separately recorded portrait clip');
    for (const options of [{reduce: true}, {saveData: true}]) {
        const s = setup(options); s.visible(true); await flush(); s.tabs[2].emit('click');
        assert.equal(s.selected(), 2); assert(s.videos.every(v => !v.src), 'Static preferences show posters without video requests');
    }
    const denied = setup({reject: true}); denied.visible(true); await flush();
    assert(!denied.screens[0].classes.has('is-playing'), 'Autoplay denial keeps the poster');
    const focused = setup({focused: true}); focused.visible(true); await flush();
    assert.equal(focused.videos[0].src, '/focus.mp4', 'An action-focused recording is used inline');
    assert.equal(focused.videos[0].dataset.src, '/scene-0.mp4', 'Full-context source remains available for enlargement');
    focused.compact.matches = true; focused.compact.emit('change'); await flush();
    assert.equal(focused.videos[0].src, '/focus-mobile.mp4', 'The focused scene has a separate phone recording');
    const failed = setup(); failed.visible(true); await flush(); failed.videos[0].emit('error');
    assert(!failed.screens[0].classes.has('is-playing')); assert.equal(failed.statuses[0].hidden, false);
    const race = setup({delayed: true}); race.visible(true); race.tabs[1].emit('click');
    race.promises[0](); await flush();
    assert.equal(race.videos[0].paused, true, 'A stale play promise cannot restart an inactive clip');
    assert(!race.screens[0].classes.has('is-playing'));
    console.log('Recorded tours: deferred media, automatic/manual loop, keyboard, focus, viewport source, preferences, failures and stale playback passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
