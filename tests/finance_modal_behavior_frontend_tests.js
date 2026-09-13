const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../frontend/assets/js/app.js'), 'utf8');
const start = source.indexOf('    function openFinanceEntryModal(');
const code = source.slice(start, source.indexOf('\n    }', start) + 6);
const focused = [];
const panes = ['invoice', 'income'].map(type => ({dataset: {financeModalPane: type}, hidden: true,
  input: {focus: () => focused.push(type)}}));
const modal = {hidden: true, classList: {add() {}}};
const context = {
  document: {body: {classList: {add() {}}}}, requestAnimationFrame: callback => callback(),
  qsa: () => panes,
  qs: (selector, root) => {
    if (!root) return modal;
    if (root === modal) return panes.find(pane => selector.includes('"' + pane.dataset.financeModalPane + '"'));
    return root.input;
  },
};
vm.createContext(context);
vm.runInContext(code, context);
for (const type of ['income', 'invoice']) {
  context.openFinanceEntryModal(type);
  assert.equal(focused.at(-1), type, 'Focus must enter the visible form');
  assert.equal(panes.find(p => p.dataset.financeModalPane === type).hidden, false);
  assert.equal(panes.find(p => p.dataset.financeModalPane !== type).hidden, true);
  assert.equal(modal.hidden, false);
}
console.log('Finance modal: invoice and income focus the visible pane');
