const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
    constructor() {
        this.events = {};
        this.attributes = {};
        this.dataset = {};
        this.hidden = false;
        this.classes = new Set();
        this.classList = {add: name => this.classes.add(name), remove: name => this.classes.delete(name)};
        this.style = {setProperty: (name, value) => { this.attributes[name] = value; }};
        this.children = {};
    }
    addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
    emit(name, event = {}) { for (const callback of this.events[name] || []) callback(event); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    querySelector(name) { return this.children[name] || null; }
    querySelectorAll(name) { return this.children[name] || []; }
    focus() { this.focused = true; }
}
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/presentation-motion.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({reduce = false, saveData = false, mobile = false, rejected = false, posterLoaded = true, fontPending = false} = {}) {
    const doc = new Element(), reduced = new Element(), connection = new Element();
    reduced.matches = reduce;
    connection.saveData = saveData;
    doc.hidden = false;
    const video = new Element(), film = new Element(), status = new Element();
    const poster = new Element(); poster.complete = posterLoaded; film.children.img = poster;
    let finishFonts;
    doc.fonts = {ready: fontPending ? new Promise(resolve => { finishFonts = resolve; }) : Promise.resolve()};
    video.paused = true;
    video.dataset = {desktop: '/desktop.mp4', mobile: '/mobile.mp4'};
    Object.defineProperty(video, 'src', {get: () => video.getAttribute('src'), set: value => video.setAttribute('src', value)});
    video.closest = () => film;
    video.play = () => {
        if (rejected) return Promise.reject(new Error('Autoplay denied'));
        video.paused = false;
        video.emit('play');
        return Promise.resolve();
    };
    video.pause = () => { video.paused = true; video.emit('pause'); };
    status.hidden = true;
    const story = new Element();
    const tabs = [2, 0, 1, 3].map(id => { const tab = new Element(); tab.dataset.storyStep = String(id); return tab; });
    const panels = Array.from({length: 4}, () => new Element());
    panels.forEach((panel, i) => { panel.hidden = i !== 0; });
    story.children = {'[data-story-step]': tabs, '.story-panel': panels};
    doc.children = {'#construction-film': video, '.film-status': status, '.work-story': story};
    const observations = new Map(), frames = new Map();
    let nextFrame = 1, time = 0;
    class IntersectionObserver {
        constructor(callback) { this.callback = callback; }
        observe(element) { observations.set(element, this.callback); }
    }
    const context = {document: doc, navigator: {connection}, IntersectionObserver,
        window: {IntersectionObserver, matchMedia: query => query.includes('reduced') ? reduced : {matches: mobile}},
        requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id)};
    vm.runInNewContext(source, context);
    return {doc, reduced, connection, video, film, poster, finishFonts, status, story, tabs, panels, frames,
        visible(element, value) { observations.get(element)?.([{isIntersecting: value}]); },
        advance(milliseconds) {
            for (let passed = 0; passed < milliseconds; passed += 50) {
                time += 50;
                const pending = [...frames.values()]; frames.clear();
                pending.forEach(callback => callback(time));
            }
        }};
}

(async () => {
    for (const preference of [{reduce: true}, {saveData: true}]) {
        const h = setup(preference);
        h.visible(h.film, true); h.visible(h.story, true);
        await flush();
        assert.equal(h.video.src, preference.saveData ? null : '/desktop.mp4', 'Save-Data defers film; reduced motion stops the story but the requested continuous film remains available');
        assert.equal(h.frames.size, 0);
        h.tabs[2].emit('click');
        assert.equal(h.story.dataset.scene, '1', 'Manual tab selection still works with motion preferences');
        assert.equal(h.frames.size, 0, 'Manual selection preserves the motion preference');
    }

    const h = setup({mobile: true});
    h.visible(h.film, true); await flush();
    assert.equal(h.video.src, '/mobile.mp4');
    assert.equal(h.video.paused, false);
    h.video.emit('loadeddata');
    assert(h.film.classes.has('is-ready'));
    h.visible(h.film, false);
    assert.equal(h.video.paused, false, 'Scrolling away does not stop the continuous film');
    h.doc.hidden = true; h.doc.emit('visibilitychange');
    assert.equal(h.video.paused, true, 'A hidden browser tab saves playback work');
    h.doc.hidden = false; h.doc.emit('visibilitychange');
    h.visible(h.film, true); await flush();
    assert.equal(h.video.paused, false);
    h.reduced.matches = true; h.reduced.emit('change');
    h.reduced.matches = false; h.reduced.emit('change'); await flush();
    assert.equal(h.video.paused, false, 'Film keeps playing while the story preference changes');
    h.video.emit('error');
    assert(!h.film.classes.has('is-ready'));
    assert.equal(h.status.hidden, false);

    const denied = setup({rejected: true});
    denied.visible(denied.film, true); await flush();
    assert.equal(denied.video.paused, true);
    denied.video.emit('loadeddata');
    assert(!denied.film.classes.has('is-ready'), 'Denied autoplay preserves the visible poster');

    const loading = setup({posterLoaded: false, fontPending: true});
    loading.visible(loading.film, true); await flush();
    assert.equal(loading.video.src, null, 'Decorative video waits for first-screen content');
    loading.poster.emit('load'); await flush();
    assert.equal(loading.video.src, null, 'The font still has priority');
    loading.finishFonts(); await flush();
    assert.equal(loading.video.paused, false);

    const s = setup();
    assert.equal(s.story.dataset.scene, '2', 'Photo report is the initial scene');
    s.visible(s.story, true); s.advance(6800);
    assert.equal(s.story.dataset.scene, '0', 'Estimate follows the photo report');
    assert.equal(s.panels[1].hidden, false);
    s.doc.hidden = true; s.doc.emit('visibilitychange');
    const before = s.story.attributes['--scene-progress'];
    s.advance(10000);
    assert.equal(s.story.attributes['--scene-progress'], before, 'Hidden tabs freeze the story');
    s.doc.hidden = false; s.doc.emit('visibilitychange');
    s.advance(20000);
    assert.equal(s.story.dataset.scene, '2', 'The complete cycle returns to the photo report');
    assert.equal(s.frames.size, 1, 'The show keeps running after a complete cycle');
    let prevented = false;
    s.tabs[0].emit('keydown', {key: 'End', preventDefault: () => { prevented = true; }});
    assert(prevented && s.tabs[3].focused);
    assert.equal(s.tabs[3].attributes['aria-selected'], 'true');
    assert.equal(s.panels.filter(panel => !panel.hidden).length, 1);
    assert.equal(s.frames.size, 1, 'Choosing a scene keeps automatic changes running');
    s.advance(6800);
    assert.equal(s.story.dataset.scene, '2', 'Automatic progression continues after keyboard selection');
    s.visible(s.story, false); s.visible(s.story, true);
    assert.equal(s.frames.size, 1);
    s.tabs[3].emit('keydown', {key: 'ArrowRight', preventDefault() {}});
    assert.equal(s.story.dataset.scene, '2');
    s.tabs[1].emit('click');
    s.advance(6800);
    assert.equal(s.story.dataset.scene, '1', 'Click selection does not pause the show either');
    console.log('Presentation motion: photo-first looping, continued playback after selection, preferences, video fallback and keyboard passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
