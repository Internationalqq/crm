const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const appJs = read('frontend/assets/js/app.js');
const routerJs = read('frontend/assets/js/router.js');
const baseHtml = read('frontend/templates/base.html');
const appCss = read('frontend/assets/app.css');
const reminderCss = read('frontend/assets/css/reminders.css');

const reminderImport = '@import "./css/reminders.css?v=20260824-reminder-center-2";';
assert.equal(appCss.trim().split(/\r?\n/).at(-1), reminderImport);
assert.match(baseHtml, /app\.css\?v=[^"\s]*reminder-center-2/);
assert.match(baseHtml, /router\.js\?v=[^"\s]*reminder-center-2/);
assert.match(routerJs, /app\.js\?v=[^'\s]*reminder-center-2/);

const topbarStart = appJs.indexOf('function renderTopbarTemplate()');
const topbarEnd = appJs.indexOf('function renderAppTopbar()', topbarStart);
const topbarMarkup = appJs.slice(topbarStart, topbarEnd);
assert.ok(topbarStart >= 0 && topbarEnd > topbarStart);

for (const markup of [baseHtml, topbarMarkup]) {
  assert.match(markup, /data-reminder-toggle/);
  assert.match(markup, /data-reminder-count hidden/);
  assert.match(markup, /class="reminder-popover reminder-center"/);
  assert.match(markup, /id="reminder-center-popover"/);
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-labelledby="reminder-center-title"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-haspopup="dialog"/);
  assert.match(markup, /aria-controls="reminder-center-popover"/);
  assert.match(markup, /data-reminder-subtitle[^>]*aria-live="polite"/);
  assert.match(markup, /data-reminder-refresh/);
  assert.match(markup, /data-reminder-close/);
  assert.match(markup, /data-reminder-list/);
  assert.match(markup, /data-lucide="bell-ring"/);
  assert.equal((markup.match(/id="reminder-center-popover"/g) || []).length, 1);
  assert.equal((markup.match(/id="reminder-center-title"/g) || []).length, 1);
}

const buildStart = appJs.indexOf('function buildReminderItemsForProject');
const buildEnd = appJs.indexOf('function reminderSeverityRank', buildStart);
const buildBlock = appJs.slice(buildStart, buildEnd);
assert.ok(buildStart >= 0 && buildEnd > buildStart);
for (const group of ['materials', 'tasks', 'works', 'journal']) {
  assert.match(buildBlock, new RegExp(`group: '${group}'`));
}
assert.match(buildBlock, /projectId: projectId/);
assert.match(buildBlock, /sortAt:/);
assert.match(buildBlock, /subject:/);
assert.match(buildBlock, /&tab=tasks/);
assert.match(buildBlock, /&tab=schedule/);
assert.match(buildBlock, /&tab=reports/);
assert.match(buildBlock, /&tab=warehouse-control&materialId=/);
assert.match(appJs, /formatDisplayDate\(alert\.workDate\)/);
assert.match(appJs, /formatDisplayDate\(alert\.needByDate\)/);
assert.match(appJs, /function reminderProcurementSortAt\(alert\)/);
assert.match(appJs, /alert\.phase === 'delivery'[\s\S]*?alert\.needOnSiteDate \|\| alert\.startDate \|\| alert\.orderByDate/);
assert.match(buildBlock, /var urgentShortage =/);
assert.match(buildBlock, /urgentShortage \? 'danger' : \(procurement\.status === 'watch' \? 'info' : 'warn'\)/);

assert.match(appJs, /key: 'materials', title: 'Материалы'/);
assert.match(appJs, /key: 'tasks', title: 'Задачи'/);
assert.match(appJs, /key: 'works', title: 'Работы и этапы'/);
assert.match(appJs, /key: 'journal', title: 'Журнал и блокеры'/);
assert.match(appJs, /reminderSeverityRank\(left\.kind\) - reminderSeverityRank\(right\.kind\)/);
assert.match(appJs, /String\(left\.sortAt \|\| '9999-12-31'\)\.localeCompare/);
assert.match(appJs, /groups\.sort\(function \(left, right\) \{ return left\.rank - right\.rank \|\| left\.order - right\.order; \}\)/);
assert.match(appJs, /class="reminder-summary"/);
assert.match(appJs, /class="reminder-group is-/);
assert.match(appJs, /class="reminder-item-title"/);
assert.match(appJs, /class="reminder-action-label"/);
assert.match(appJs, /class="reminder-item-context"/);
assert.match(appJs, /class="reminder-loading"/);
assert.match(appJs, /class="reminder-empty"/);
assert.match(appJs, /class="reminder-error"/);
assert.match(appJs, /class="reminder-partial"/);
assert.match(appJs, /fullFailure/);
assert.match(appJs, /reminderRequestToken/);
assert.match(appJs, /notificationsRequestToken !== reminderRequestToken/);
assert.match(appJs, /return \{ ok: false, items: \[\] \}/);
assert.doesNotMatch(appJs, /catch\(function \(\) \{ return \[\]; \}\)/);
assert.match(appJs, /badgeItems\.length > 99 \? '99\+' : String\(badgeItems\.length\)/);
assert.match(appJs, /button\.classList\.toggle\('has-error', hasRefreshError\)/);
assert.match(appJs, /hasRefreshError \? '!' : '0'/);
assert.match(appJs, /list\.setAttribute\('aria-busy', loading \? 'true' : 'false'\)/);
assert.match(appJs, /function closeReminderPopover\(restoreFocus\)/);
assert.match(appJs, /toggle\.setAttribute\('aria-expanded', 'false'\)/);
assert.match(appJs, /event\.key !== 'Escape'/);
assert.match(appJs, /closeReminderPopover\(true\)/);
assert.match(appJs, /closest\('\.reminder-item'\)[\s\S]*?closeReminderPopover\(false\)/);
assert.match(appJs, /closeControl\.focus\(\{ preventScroll: true \}\)/);
assert.match(appJs, /projectDetailRoot\.hidden/);
assert.match(appJs, /renderReminderBell\(reminderLastItems, reminderRefreshInFlight \|\| state\.reminderProjectsLoading, reminderLastStatus\)/);

assert.match(reminderCss, /\.topbar-reminders-wrap \.reminder-count \{[\s\S]*?min-width: 19px !important;[\s\S]*?animation: none !important;/);
assert.match(reminderCss, /\.reminder-center \[data-reminder-list\] \{[\s\S]*?overflow-y: auto;/);
assert.match(reminderCss, /\.reminder-summary \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
assert.match(reminderCss, /\.reminder-group-head \{[\s\S]*?position: sticky;/);
assert.match(reminderCss, /\.reminder-center \.reminder-item,[\s\S]*?min-height: 62px;[\s\S]*?border-bottom: 1px solid/);
assert.match(reminderCss, /\.reminder-center \.reminder-head-button > span \{[\s\S]*?display: inline !important;/);
assert.match(reminderCss, /\.reminder-center \.reminder-item \.reminder-item-context \{[\s\S]*?font-size: 11px !important;/);
assert.match(reminderCss, /\.reminder-center \.reminder-empty \.reminder-empty-icon svg \{[\s\S]*?width: 20px !important;/);
assert.match(reminderCss, /@media \(max-width: 600px\)[\s\S]*?\.topbar \{[\s\S]*?backdrop-filter: none !important;[\s\S]*?position: fixed !important;[\s\S]*?inset: 66px 8px auto !important;/);
assert.match(reminderCss, /@media \(max-width: 600px\)[\s\S]*?\.reminder-center \.reminder-head-button \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/);
assert.match(reminderCss, /@media \(prefers-reduced-motion: reduce\)/);

console.log('reminder_center_frontend_ok');
