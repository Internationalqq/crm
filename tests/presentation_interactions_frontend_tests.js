const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
    constructor(attributes = {}) {
        this.attributes = attributes;
        this.events = {};
        this.hidden = false;
        this.classes = new Set();
        this.classList = {add: x => this.classes.add(x), remove: x => this.classes.delete(x), toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x)};
    }
    getAttribute(name) { return this.attributes[name]; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
    emit(name, event = {}) { (this.events[name] || []).forEach(fn => fn(event)); }
    focus() { this.focused = true; }
}
const doc = new Element(), menu = new Element({'aria-expanded': 'false'}), navigation = new Element(), options = new Element();
const panels = {};
const tabs = (prefix, selected) => Array.from({length: 3}, (_, i) => {
    const id = prefix + i;
    panels[id] = new Element();
    return new Element({'aria-controls': id, 'aria-selected': String(i === selected)});
});
const roles = tabs('role-', 0), plans = tabs('plan-', 1), futures = tabs('future-', 0);
const demo = new Element(), futureOptions = new Element();
const preference = new Element(), connection = new Element(), win = new Element();
preference.matches = false;
connection.saveData = false;
let clock = 0, sequence = 0, observerCallback;
const timers = new Map();
win.matchMedia = () => preference;
win.navigator = {connection};
win.setTimeout = (fn, delay) => { timers.set(++sequence, {fn, at: clock + delay}); return sequence; };
win.clearTimeout = id => timers.delete(id);
win.IntersectionObserver = class {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    unobserve() {}
};
function advance(milliseconds) {
    clock += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); }
}
doc.documentElement = new Element();
doc.querySelector = selector => ({'.menu-toggle': menu, '#site-nav': navigation, '.plan-options': options, '#demo': demo, '.future-options': futureOptions}[selector] || null);
doc.querySelectorAll = selector => ({'[data-role]': roles, '[data-plan]': plans, '[data-future]': futures}[selector] || []);
doc.getElementById = id => panels[id];
options.hidden = true;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../frontend/assets/js/presentation.js'), 'utf8'), {document: doc, window: win});
assert.equal(options.hidden, false);
assert.equal(panels['plan-1'].hidden, false);
assert.equal(panels['plan-0'].hidden, true);
plans[0].emit('click');
assert.equal(panels['plan-0'].hidden, false);
assert.equal(panels['plan-1'].hidden, true);
assert.equal(roles[0].getAttribute('aria-selected'), 'true', 'Plan selection does not change the selected CRM role');
for (const group of [roles, plans, futures]) {
    let prevented = false;
    group[0].emit('keydown', {key: 'End', preventDefault() { prevented = true; }});
    assert(prevented && group[2].focused);
    assert.equal(group[2].tabIndex, 0);
    assert.equal(group[0].tabIndex, -1);
    group[2].emit('keydown', {key: 'ArrowRight', preventDefault() {}});
    assert.equal(group[0].getAttribute('aria-selected'), 'true');
    assert.equal(group.filter(tab => !panels[tab.getAttribute('aria-controls')].hidden).length, 1);
}
menu.emit('click');
assert.equal(menu.getAttribute('aria-expanded'), 'true');
doc.emit('keydown', {key: 'Escape'});
assert.equal(menu.getAttribute('aria-expanded'), 'false');
assert(menu.focused);
menu.emit('click');
navigation.emit('click', {target: {closest: () => ({})}});
assert.equal(menu.getAttribute('aria-expanded'), 'false');
assert.equal(timers.size, 0, 'Offscreen roles do not start a timer');
observerCallback([{isIntersecting: true}]);
assert(demo.classes.has('role-cycle-running'), 'Visible role cycle shows progress');
advance(2500);
observerCallback([{isIntersecting: true}]);
advance(2500); // Repeated observer reports must not postpone the next role.
assert.equal(roles[1].getAttribute('aria-selected'), 'true');
advance(5000); advance(5000);
assert.equal(roles[0].getAttribute('aria-selected'), 'true', 'Automatic sequence loops');
roles[2].emit('click');
advance(4999);
assert.equal(roles[2].getAttribute('aria-selected'), 'true', 'Manual choice receives a full reading interval');
advance(1);
assert.equal(roles[0].getAttribute('aria-selected'), 'true', 'Manual selection continues the automatic sequence');
roles[0].emit('keydown', {key: 'ArrowRight', preventDefault() {}});
advance(5000);
assert.equal(roles[2].getAttribute('aria-selected'), 'true', 'Keyboard selection continues the sequence');
assert.equal(plans[0].getAttribute('aria-selected'), 'true', 'Role cycle does not affect plans');
for (const [target, key] of [[doc, 'hidden'], [preference, 'matches'], [connection, 'saveData']]) {
    target[key] = true; target.emit(target === doc ? 'visibilitychange' : 'change');
    assert.equal(timers.size, 0);
    advance(10000);
    assert.equal(roles[2].getAttribute('aria-selected'), 'true');
    target[key] = false; target.emit(target === doc ? 'visibilitychange' : 'change');
    assert.equal(timers.size, 1);
}
observerCallback([{isIntersecting: false}]);
assert.equal(timers.size, 0);
assert(!demo.classes.has('role-cycle-running'), 'Offscreen cycle removes progress');
preference.matches = true; preference.emit('change');
roles[1].emit('click');
assert.equal(roles[1].getAttribute('aria-selected'), 'true', 'Reduced motion retains manual controls');
assert.equal(timers.size, 0);
console.log('Presentation interactions: role/plan/future selection, keyboard, menu, automatic repeat, manual continuation and visibility/motion/data preferences passed.');
