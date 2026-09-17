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
const roles = tabs('role-', 0), plans = tabs('plan-', 1);
doc.documentElement = new Element();
doc.querySelector = selector => ({'.menu-toggle': menu, '#site-nav': navigation, '.plan-options': options}[selector] || null);
doc.querySelectorAll = selector => ({'[data-role]': roles, '[data-plan]': plans}[selector] || []);
doc.getElementById = id => panels[id];
options.hidden = true;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../frontend/assets/js/presentation.js'), 'utf8'), {document: doc});
assert.equal(options.hidden, false);
assert.equal(panels['plan-1'].hidden, false);
assert.equal(panels['plan-0'].hidden, true);
plans[0].emit('click');
assert.equal(panels['plan-0'].hidden, false);
assert.equal(panels['plan-1'].hidden, true);
assert.equal(roles[0].getAttribute('aria-selected'), 'true', 'Plan selection does not change the selected CRM role');
for (const group of [roles, plans]) {
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
console.log('Presentation interactions: independent role/plan selection, keyboard wrapping and menu passed.');
