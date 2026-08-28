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

const reminderImport = '@import "./css/reminders.css?v=20260824-reminder-center-2-reminder-object-orders-3-motion-1";';
assert.equal(appCss.trim().split(/\r?\n/).at(-1), reminderImport);
assert.match(baseHtml, /app\.css\?v=[^"\s]*reminder-object-orders-3-motion-1/);
assert.match(baseHtml, /router\.js\?v=[^"\s]*reminder-object-orders-3-motion-1/);
assert.match(routerJs, /app\.js\?v=[^'\s]*reminder-object-orders-3-motion-1/);

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
  assert.match(markup, /data-reminder-toast[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(markup, /data-lucide="bell-ring"/);
  assert.equal((markup.match(/id="reminder-center-popover"/g) || []).length, 1);
  assert.equal((markup.match(/id="reminder-center-title"/g) || []).length, 1);
}

const buildStart = appJs.indexOf('function buildReminderItemsForProject');
const buildEnd = appJs.indexOf('function reminderSeverityRank', buildStart);
const buildBlock = appJs.slice(buildStart, buildEnd);
assert.ok(buildStart >= 0 && buildEnd > buildStart);
for (const group of ['materials', 'tasks', 'works', 'journal']) {
  assert.match(appJs, new RegExp(`group: '${group}'`));
}
assert.match(buildBlock, /projectId: projectId/);
assert.match(appJs, /materialId: alert\.materialId/);
assert.match(appJs, /actionKind: actionKind/);
assert.match(appJs, /actionQty: actionQty/);
assert.match(buildBlock, /sortAt:/);
assert.match(buildBlock, /subject:/);
assert.match(buildBlock, /&tab=tasks/);
assert.match(buildBlock, /&tab=schedule/);
assert.match(buildBlock, /&tab=reports/);
assert.match(appJs, /&tab=warehouse-control&materialId=/);
assert.match(appJs, /formatDisplayDate\(alert\.workDate\)/);
assert.match(appJs, /formatDisplayDate\(alert\.needByDate\)/);
assert.match(appJs, /function reminderProcurementSortAt\(alert\)/);
assert.match(appJs, /alert\.phase === 'delivery'[\s\S]*?alert\.needOnSiteDate \|\| alert\.startDate \|\| alert\.orderByDate/);
assert.match(buildBlock, /var urgentShortage =/);
assert.match(buildBlock, /urgentShortage \? 'danger' : \(procurement\.status === 'watch' \? 'info' : 'warn'\)/);
assert.doesNotMatch(buildBlock, /if \(!procurement\.materialId\) return/);
assert.match(buildBlock, /if \(!merged\.phase\) merged\.phase = 'order'/);

const materialGroupsStart = appJs.indexOf('function reminderMaterialProjectGroups');
const materialGroupsEnd = appJs.indexOf('function reminderMaterialSnapshot', materialGroupsStart);
assert.ok(materialGroupsStart >= 0 && materialGroupsEnd > materialGroupsStart);
const reminderMaterialProjectGroups = new Function(
  'reminderSeverityRank',
  `${appJs.slice(materialGroupsStart, materialGroupsEnd)}; return reminderMaterialProjectGroups;`,
)((kind) => ({ danger: 0, warn: 1, info: 2 }[kind] ?? 9));
const materialFixtures = [
  ...Array.from({ length: 20 }, (_, index) => ({ group: 'materials', projectId: 24, materialId: index + 1, title: 'ЮУРГУ', subject: `Материал ${index + 1}`, actionKind: 'order', actionQty: 1, unit: 'шт', kind: 'warn', sortAt: '2026-08-29' })),
  ...Array.from({ length: 2 }, (_, index) => ({ group: 'materials', projectId: 25, materialId: index + 101, title: 'ЧБ', subject: `Материал ЧБ ${index + 1}`, actionKind: 'order', actionQty: 1, unit: 'шт', kind: 'danger', sortAt: '2026-08-28' })),
  { group: 'materials', projectId: 24, materialId: 500, title: 'ЮУРГУ', subject: 'В пути', actionKind: 'delivery', actionQty: 3, unit: 'шт', kind: 'info', sortAt: '2026-08-30' },
];
const materialGroups = reminderMaterialProjectGroups(materialFixtures);
assert.equal(materialGroups.length, 2, 'materials must collapse into one summary per project');
const yuurguGroup = materialGroups.find((group) => group.projectId === 24);
const chbGroup = materialGroups.find((group) => group.projectId === 25);
assert.equal(yuurguGroup.orderCount, 20);
assert.equal(yuurguGroup.deliveryCount, 1);
assert.equal(yuurguGroup.items.length, 21);
assert.equal(chbGroup.orderCount, 2);

assert.match(appJs, /key: 'materials', title: 'Материалы'/);
assert.match(appJs, /key: 'tasks', title: 'Задачи'/);
assert.match(appJs, /key: 'works', title: 'Работы и этапы'/);
assert.match(appJs, /key: 'journal', title: 'Журнал и блокеры'/);
assert.match(appJs, /reminderSeverityRank\(left\.kind\) - reminderSeverityRank\(right\.kind\)/);
assert.match(appJs, /String\(left\.sortAt \|\| '9999-12-31'\)\.localeCompare/);
assert.match(appJs, /groups\.sort\(function \(left, right\) \{ return left\.order - right\.order; \}\)/);
assert.doesNotMatch(appJs, /class="reminder-summary"/);
assert.match(appJs, /class="reminder-order-overview/);
assert.match(appJs, /<details class="reminder-project-card"/);
assert.match(appJs, /class="reminder-project-count"/);
assert.match(appJs, /class="reminder-material-amount is-/);
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
assert.match(appJs, /item\.group === 'materials' && item\.actionKind === 'order'/);
assert.match(appJs, /function triggerReminderNotice\(button, items\)/);
assert.match(appJs, /button\.classList\.add\('is-notifying'\)/);
assert.match(appJs, /Нужно заказать ' \+ snapshot\.orderCount/);
assert.match(appJs, /initReminderBell\(\);\s*if \(!isGuestRole\(\)\) refreshReminderBell\(\)/);
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

assert.match(reminderCss, /\.topbar-reminders-wrap \.reminder-count \{[\s\S]*?min-width: 19px !important;/);
assert.match(reminderCss, /\.reminder-center \[data-reminder-list\] \{[\s\S]*?overflow-y: auto;/);
assert.match(reminderCss, /Project-first procurement focus and one-shot bell notice/);
assert.match(reminderCss, /\.reminder-order-overview \{[\s\S]*?grid-template-columns: 36px minmax\(0, 1fr\) auto;/);
assert.match(reminderCss, /\.reminder-project-card > summary \{[\s\S]*?grid-template-columns: 32px minmax\(0, 1fr\) auto 18px;/);
assert.match(reminderCss, /\.reminder-center \.reminder-material-item,[\s\S]*?minmax\(70px, auto\)/);
assert.match(reminderCss, /\.reminder-group-head \{[\s\S]*?position: sticky;/);
assert.match(reminderCss, /\.reminder-center \.reminder-item,[\s\S]*?min-height: 62px;[\s\S]*?border-bottom: 1px solid/);
assert.match(reminderCss, /\.reminder-center \.reminder-head-button > span \{[\s\S]*?display: inline !important;/);
assert.match(reminderCss, /\.reminder-center \.reminder-item \.reminder-item-context \{[\s\S]*?font-size: 11px !important;/);
assert.match(reminderCss, /\.reminder-center \.reminder-empty \.reminder-empty-icon svg \{[\s\S]*?width: 20px !important;/);
assert.match(reminderCss, /@media \(max-width: 600px\)[\s\S]*?\.topbar \{[\s\S]*?backdrop-filter: none !important;[\s\S]*?position: fixed !important;[\s\S]*?inset: 66px 8px auto !important;/);
assert.match(reminderCss, /@media \(max-width: 600px\)[\s\S]*?\.reminder-center \.reminder-head-button \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/);
assert.match(reminderCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(reminderCss, /\.reminder-circle\.is-notifying::before[\s\S]*?animation: reminderBellWave 1\.45s/);
assert.match(reminderCss, /\.reminder-circle\.is-notifying > \.topbar-circle-icon,[\s\S]*?animation: reminderBellSwing 1\.5s/);
assert.match(reminderCss, /\.reminder-circle\.is-notifying \.reminder-count \{[\s\S]*?animation: reminderBadgePop 1\.35s/);
assert.match(reminderCss, /\.reminder-toast\.is-visible \{[\s\S]*?animation: reminderToastInOut 4\.2s/);
assert.match(reminderCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.reminder-circle\.is-notifying::before[\s\S]*?animation: none !important;/);

console.log('reminder_center_frontend_ok');
