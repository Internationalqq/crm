const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const appCss = read('frontend/assets/app.css');
const reportsCss = read('frontend/assets/css/project-reports.css');
const operationsJs = read('frontend/assets/js/operations.js');
const appJs = read('frontend/assets/js/app.js');
const routerJs = read('frontend/assets/js/router.js');
const projectsHtml = read('frontend/pages/projects.html');
const logsHtml = read('frontend/pages/logs.html');
const backendServer = read('backend/server.py');
const communicationsDocs = read('backend/communications_docs.py');
const deployHeaders = read('deploy/_headers');

assert.match(appCss, /project-reports\.css\?v=[^"\n]*project-report-modal-1/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-cool-2/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-native-3/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-modal-neutral-4/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-create-plus-5/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-refresh-8/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-calendar-9/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-calendar-apple-10/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-live-suggestions-16/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-entry-hierarchy-17/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-action-history-18/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-icon-minimal-32/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-photo-tone-33/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-sheet-minimal-34/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-resource-remove-right-35/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-final-structured-36/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-saved-structured-37/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-browser-qa-39/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-touch-qa-40/);
assert.match(appCss, /project-reports\.css\?v=[^"\n]*report-unit-fallback-qa-43-report-manual-quantity-qa-44-report-copy-spacing-qa-45-report-backdrop-click-qa-46-report-mobile-sheet-qa-47-report-layering-qa-48-report-mobile-header-qa-49-report-manual-sync-qa-50-report-work-limit-qa-51-report-target-floor-qa-52/);
assert.match(reportsCss, /\.reports-drawer-frame \.report-preview-board \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/);
assert.match(
  reportsCss,
  /\.reports-drawer-frame,\s*\.report-entry-document \{\s*--report-bg:/,
  'The saved report workspace must inherit the final document color tokens',
);
assert.match(
  reportsCss,
  /(?:^|\n)\.report-entry-document \{/,
  'Saved report documents must share the polished final-report styles outside the drawer',
);
assert.match(reportsCss, /\.report-submit-group:has\(\.report-only-button\[hidden\]\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/);
assert.match(reportsCss, /\.report-voice-button\.is-primary,[\s\S]*?\.report-photo-picker-action[\s\S]*?min-height: 44px !important;/);
assert.match(
  reportsCss,
  /@media \(pointer: coarse\)[\s\S]*?\.report-photo-draft\s*\{[^}]*grid-template-columns:\s*58px minmax\(0, 1fr\) 44px;[\s\S]*?\.report-live-picked-item\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) 44px;[\s\S]*?\.report-resource-add,[\s\S]*?\.report-draft-status button,[\s\S]*?min-height:\s*44px !important;/s,
  'Touch report actions must reserve full 44px hit targets without overflowing their rows',
);
assert.ok(
  appCss.indexOf('project-reports.css') > appCss.indexOf('ui-qa.css'),
  'The reports layer must stay after the shared QA layer in the cascade',
);

for (const selector of [
  '.report-workspace-hero',
  '.report-kpi-grid',
  '.report-workspace-main',
  '.report-calendar-day.is-selected',
  '.report-calendar-month-copy',
  '.report-calendar-controls',
  '.report-calendar-report-count',
  '.report-calendar-risk',
  '.report-selected-day-empty',
  '.report-history-entry',
  '.report-day-entry.is-section-progress',
  '.report-history-entry.is-field-report',
  '.report-entry-type',
  '.report-actions-history',
  '.report-actions-history-body',
  '.report-actions-history-chevron',
  '.report-extra-fields',
  '.reports-drawer-panel',
  '.reports-drawer-host',
  '.report-modal-scroll',
  '.report-modal-title-icon',
  '.report-preview-title-icon',
  '.report-form-section',
  '.report-final-message',
  '.report-section-required',
  '.report-create-plus',
  '.report-final-message-label',
  '.report-voice-button.is-primary',
  '.report-effect-card',
  '.report-effect-check',
  '.report-effects-summary',
  '.report-live-assist',
  '.report-live-suggestion',
  '.report-live-picked-item',
  '.report-resource-row',
  '.report-resource-add',
  '.report-photo-picker',
  '.report-photo-draft',
  '.report-shift-board',
  '.report-photo-gallery',
  '.report-photo-viewer',
  '.report-additional-list',
]) {
  assert.ok(reportsCss.includes(selector), `Missing reports selector: ${selector}`);
}

for (const breakpoint of ['1180px', '960px', '720px', '520px']) {
  assert.match(reportsCss, new RegExp(`@media \\(max-width: ${breakpoint}\\)`));
}
assert.match(reportsCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(reportsCss, /var\(--color-accent\)/);
assert.match(reportsCss, /var\(--color-danger\)/);
assert.match(reportsCss, /\.reports-drawer-frame\[data-open="1"\] \.reports-drawer-panel\s*\{[^}]*translate\(-50%, -50%\)/s);
assert.match(reportsCss, /\.reports-drawer-frame \.reports-drawer-host\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
assert.match(reportsCss, /\.reports-drawer-frame \.report-modal-scroll\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
assert.match(reportsCss, /height:\s*100dvh !important/);
const reportModalCss = reportsCss.slice(reportsCss.indexOf('/* Report drawer */'));
assert.ok(reportModalCss.length > 0, 'The report modal layer must exist');
const unifiedReportCss = reportsCss.slice(reportsCss.indexOf('/* Unified report sheet'));
assert.ok(unifiedReportCss.length > 0, 'The unified report sheet layer must exist');
const simplifiedReportCss = reportsCss.slice(reportsCss.indexOf('/* Final cascade for the simplified report composer. */'));
assert.ok(simplifiedReportCss.length > 0, 'The simplified report composer cascade must exist');
assert.equal(
  /#fff7ed|#fffbeb|#fff4d6|#fef3c7|#fde68a|#fed7aa|\byellow\b|\bamber\b/i.test(reportModalCss),
  false,
  'The report modal must not use warm yellow or amber surfaces',
);
assert.match(reportModalCss, /background:\s*#ffffff !important/);
assert.match(reportModalCss, /\.report-modal-title-icon svg/);
assert.match(reportModalCss, /\.report-modal-title-icon::before,[\s\S]*?content:\s*none !important/);
assert.match(unifiedReportCss, /--report-bg:\s*#f2f2f7/);
assert.match(unifiedReportCss, /--report-accent:\s*#2481cc/);
assert.match(unifiedReportCss, /--report-separator:\s*rgba\(60, 60, 67, \.18\)/);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-daily-form label\.report-photo-picker\s*\{[^}]*grid-template-columns:\s*32px minmax\(0, 1fr\) auto !important;[^}]*align-items:\s*center !important;[^}]*min-height:\s*62px !important;/s,
  'The photo picker must stay a compact, vertically centered accessory row',
);
assert.match(
  unifiedReportCss,
  /label\.report-photo-picker > \.report-photo-picker-action\s*\{[^}]*display:\s*inline-flex !important;[^}]*width:\s*auto !important;[^}]*height:\s*36px !important;[^}]*color:\s*var\(--report-accent\) !important;/s,
  'The file CTA must be a compact secondary action rather than another primary button',
);
assert.match(
  unifiedReportCss,
  /\.report-photo-picker-copy\s*\{[^}]*display:\s*grid !important;[^}]*gap:\s*2px !important;/s,
  'The photo picker copy must remain a compact two-line grid',
);
assert.match(
  unifiedReportCss,
  /label\.report-photo-picker > input\[type="file"\]\s*\{[^}]*width:\s*1px !important;[^}]*height:\s*1px !important;[^}]*min-height:\s*0 !important;[^}]*padding:\s*0 !important;[^}]*border:\s*0 !important;/s,
  'The hidden file input must not retain visible form-control geometry',
);
assert.match(
  unifiedReportCss,
  /@media \(max-width: 520px\)[\s\S]*?label\.report-photo-picker > \.report-photo-picker-action\s*\{[^}]*grid-column:\s*auto !important;[^}]*width:\s*auto !important;[^}]*min-width:\s*86px !important;[^}]*height:\s*40px !important;/s,
  'The mobile file CTA must remain in the same compact row',
);
assert.match(unifiedReportCss, /\.report-daily-form\s*\{[^}]*gap:\s*0 !important;[^}]*border-radius:\s*18px !important;[^}]*background:\s*var\(--report-surface\) !important;/s);
assert.match(unifiedReportCss, /\.report-final-message\s*\{[^}]*border:\s*1px solid var\(--report-separator\);[^}]*border-radius:\s*16px;[^}]*background:\s*var\(--report-surface\);/s);
assert.match(unifiedReportCss, /\.report-final-group\s*\{[^}]*border-top:\s*1px solid var\(--report-separator-soft\);/s);
assert.match(unifiedReportCss, /\.report-final-full\s*\{[^}]*display:\s*grid;[^}]*gap:\s*8px;[^}]*background:\s*var\(--report-accent-soft\);/s);
assert.match(unifiedReportCss, /\.report-final-full output\s*\{[^}]*white-space:\s*pre-wrap;/s);
assert.match(simplifiedReportCss, /\.report-draft-status\s*\{[^}]*grid-template-columns:\s*auto 7px minmax\(0, 1fr\) !important;/s);
assert.match(simplifiedReportCss, /\[data-report-draft-clear\]\s*\{[^}]*grid-column:\s*1 !important;[^}]*background:\s*#d92d20 !important;[^}]*color:\s*#fff !important;/s);
assert.match(simplifiedReportCss, /\.report-final-message\s*\{[^}]*border-radius:\s*14px !important;[^}]*box-shadow:\s*none !important;/s);
assert.match(simplifiedReportCss, /\.report-final-summary > span\s*\{[^}]*border:\s*0 !important;[^}]*background:\s*transparent !important;/s);
assert.match(simplifiedReportCss, /\.report-form-meta-section \.report-chat-header-compact\s*\{[^}]*grid-template-columns:\s*minmax\(190px, \.75fr\) minmax\(260px, 1\.25fr\) !important;[^}]*gap:\s*8px !important;/s);
assert.match(simplifiedReportCss, /\.report-chat-header-compact > label,[\s\S]*?\.report-extra-grid > label\s*\{[^}]*gap:\s*0 !important;/s);
assert.match(simplifiedReportCss, /\.report-compact-field-label\s*\{[^}]*display:\s*inline-flex !important;[^}]*margin:\s*0 0 5px !important;/s);
assert.match(simplifiedReportCss, /\.report-extra-grid\s*\{[^}]*gap:\s*8px !important;[^}]*padding:\s*0 20px 14px !important;/s);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-preview-title-copy\s*\{[^}]*display:\s*grid !important;[^}]*gap:\s*3px !important;[^}]*min-width:\s*0;/s,
  'Preview headings and helper copy must use separate rows instead of running together',
);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-preview-title-copy strong,\s*\.reports-drawer-frame \.report-preview-title-copy small\s*\{[^}]*display:\s*block;/s,
  'Preview title and subtitle must remain distinct on desktop and mobile',
);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-additional-card \.report-preview-title\s*\{[^}]*align-items:\s*start !important;[^}]*margin-bottom:\s*12px !important;/s,
  'Additional events must keep a clear gap between their heading and event list',
);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-effects-summary-copy\s*\{[^}]*display:\s*grid !important;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important;[^}]*gap:\s*4px !important;/s,
  'The save summary title and explanation must remain on separate rows',
);
assert.match(
  reportsCss,
  /\.reports-drawer-frame \.side-drawer-backdrop,[\s\S]*?\.reports-drawer-frame \.drawer-overlay\s*\{[^}]*z-index:\s*0 !important;[\s\S]*?\.reports-drawer-frame\[data-open="1"\] \.side-drawer-backdrop,[\s\S]*?\.reports-drawer-frame\[data-open="1"\] \.drawer-overlay\s*\{[^}]*opacity:\s*1 !important;[^}]*pointer-events:\s*auto !important;/s,
  'The visible report backdrop must receive clicks so an outside click can dismiss the sheet',
);
assert.match(
  reportsCss,
  /\.reports-drawer-frame \.side-drawer-panel\.project-report-drawer-panel\s*\{[^}]*z-index:\s*1 !important;[^}]*position:\s*absolute !important;/s,
  'The report sheet must stay above its clickable backdrop',
);
assert.match(unifiedReportCss, /\.report-entry-document\s*\{[^}]*border:\s*1px solid var\(--report-separator\);[^}]*border-radius:\s*15px;/s);
assert.match(unifiedReportCss, /\.report-entry-full-copy\s*\{[^}]*white-space:\s*pre-wrap;/s);
assert.match(unifiedReportCss, /\.report-resource-row\s*\{[^}]*grid-template-areas:\s*"name count hours remove" !important;/s);
assert.match(
  unifiedReportCss,
  /@media \(max-width: 520px\)[\s\S]*?\.report-resource-row\s*\{[^}]*grid-template-areas:\s*"name name remove"\s*"count hours remove" !important;[\s\S]*?\.report-resource-remove\s*\{[^}]*grid-area:\s*remove !important;[^}]*align-self:\s*center !important;[^}]*justify-self:\s*end !important;/s,
  'Resource remove controls must stay in the far-right mobile column instead of dropping below the fields',
);
assert.match(
  unifiedReportCss,
  /@media \(max-width: 520px\)[\s\S]*?\.report-effect-metric,[\s\S]*?grid-template-areas:\s*"label label"\s*"value unit" !important;[\s\S]*?\.report-effect-metric > output\s*\{[^}]*overflow:\s*visible !important;[^}]*text-overflow:\s*clip !important;/s,
  'Mobile report quantity cells must keep the full plan, report quantity, and total visible',
);
assert.match(reportModalCss, /\.report-field-hint::before/);
assert.match(reportModalCss, /\.report-preview-items \.is-partial\s*\{[^}]*border-color:\s*#bfdbfe !important;[^}]*background:\s*#eff6ff !important/s);
assert.match(
  reportsCss,
  /\.reports-drawer-frame \.report-live-picked-item\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) 22px;[^}]*width:\s*100%;/s,
  'Selected work and material rows must reserve their right edge for the remove control',
);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-live-picked-item\s*\{[^}]*grid-template-areas:\s*"kind title remove"\s*"controls controls controls" !important;/s,
  'Manual quantity controls must occupy their own full-width row while remove stays in the header',
);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-live-picked-controls\.is-work\s*\{[^}]*grid-template-columns:\s*minmax\(180px, 1\.35fr\) minmax\(120px, \.8fr\) !important;[\s\S]*?\.report-live-picked-controls\.is-work\.has-unit-select\s*\{[^}]*minmax\(68px, \.4fr\) !important;/s,
  'Desktop work controls must keep mode and quantity compact, adding a unit selector only when the catalog unit is missing',
);
assert.match(
  unifiedReportCss,
  /\.report-live-picked-progress\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*flex-wrap:\s*wrap;[\s\S]*?\.report-live-picked-plan,[\s\S]*?white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/s,
  'Plan, before-report, and after-report copy must wrap without overflowing narrow report cards',
);
assert.match(
  unifiedReportCss,
  /\.reports-drawer-frame \.report-live-picked-number\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[^}]*border-radius:\s*9px;[\s\S]*?\.report-live-picked-number:focus-within/s,
  'Manual quantity and its unit suffix must render as one focused control',
);
assert.match(
  unifiedReportCss,
  /@media \(max-width: 720px\)[\s\S]*?\.report-live-picked-controls\.is-work,[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/s,
  'Manual controls must collapse to a two-column mobile grid',
);
assert.match(
  unifiedReportCss,
  /@media \(max-width: 720px\)[\s\S]*?\.reports-drawer-frame \.side-drawer-panel\.project-report-drawer-panel\s*\{[^}]*top:\s*0 !important;[^}]*right:\s*0 !important;[^}]*bottom:\s*0 !important;[^}]*left:\s*0 !important;[^}]*width:\s*100vw !important;[^}]*height:\s*100dvh !important;[^}]*transform:\s*none !important;/s,
  'The report sheet must stay inside the viewport when opened directly on mobile',
);
assert.match(
  unifiedReportCss,
  /@media \(max-width: 720px\)[\s\S]*?\.reports-drawer-frame \.report-modal-header\s*\{[^}]*align-items:\s*flex-start !important;[^}]*flex-direction:\s*row !important;/s,
  'The report close button must stay in the top-right corner on mobile',
);
assert.match(
  unifiedReportCss,
  /@media \(pointer: coarse\)[\s\S]*?\.report-live-picked-controls select,[\s\S]*?\.report-live-picked-unit\s*\{[^}]*height:\s*44px !important;[^}]*min-height:\s*44px !important;/s,
  'Manual quantity controls must preserve 44px touch targets',
);

assert.match(deployHeaders, /Permissions-Policy:\s*camera=\(\), microphone=\(self\), geolocation=\(\)/);
assert.doesNotMatch(deployHeaders, /microphone=\(\)/, 'The hosting policy must not block report dictation');
assert.ok(
  (backendServer.match(/send_header\("Permissions-Policy", "camera=\(\), microphone=\(self\), geolocation=\(\)"\)/g) || []).length >= 2,
  'HTML/static responses must allow the same-origin report microphone',
);

assert.match(operationsJs, /class="project-reports-shell report-workspace"/);
assert.match(operationsJs, /Календарь отчетов/);
assert.match(operationsJs, /Последние действия/);
assert.match(operationsJs, /data-report-calendar-today/);
assert.match(operationsJs, /data-report-create-selected/);
assert.match(operationsJs, /aria-pressed=/);
assert.match(operationsJs, /aria-current="date"/);
assert.match(operationsJs, /projectReportCalendarCountLabel/);
assert.match(operationsJs, /function projectReportEntryKind\(log\)/);
assert.match(operationsJs, /log\.entry_kind \|\| log\.entryKind/);
assert.match(operationsJs, /data-report-entry-kind=/);
assert.match(operationsJs, /projectReportEntryTypeHtml\(log\)/);
assert.match(operationsJs, /projectReportEntryKind\(log\) === 'section-progress'/);
assert.match(operationsJs, /function projectReportFieldLogs\(logs\)/);
assert.match(operationsJs, /function projectReportActionLogs\(logs\)/);
assert.match(operationsJs, /function projectReportDefaultSelectedDate\(logs, fallbackDate\)/);
assert.match(operationsJs, /typeof PMBI\.isCurrentProject === 'function'/);
assert.match(operationsJs, /class="report-calendar-month-copy"/);
assert.match(operationsJs, /class="report-calendar-nav-mark"/);
assert.match(operationsJs, /classes\.push\('is-weekend'\)/);
const reportsPanelStart = operationsJs.lastIndexOf('renderProjectReportsPanel = function');
const reportsPanelEnd = operationsJs.indexOf('renderProjectReportForm = function', reportsPanelStart);
const reportsPanelJs = operationsJs.slice(reportsPanelStart, reportsPanelEnd);
assert.ok(reportsPanelStart > -1 && reportsPanelEnd > reportsPanelStart, 'The reports panel override must exist');
assert.ok(
  reportsPanelJs.indexOf('report-selected-day-pane') < reportsPanelJs.indexOf('report-calendar-pane'),
  'Selected-day information must stay to the left of the calendar',
);
assert.match(reportsPanelJs, /<details class="report-actions-history" data-report-actions-history>/);
assert.match(reportsPanelJs, /<summary class="report-actions-history-toggle">/);
assert.match(reportsPanelJs, /data-report-action-count/);
assert.equal(
  /<details class="report-actions-history"[^>]*\sopen(?:\s|=|>)/.test(reportsPanelJs),
  false,
  'The action history must be collapsed by default',
);
assert.equal(reportsPanelJs.includes('История отчетов'), false, 'Manual reports must not be duplicated below the calendar');
assert.match(operationsJs, /<details class="report-extra-fields">/);
assert.match(operationsJs, /role', 'dialog'/);
assert.match(operationsJs, /aria-labelledby', 'project-report-modal-title'/);
assert.match(operationsJs, /data-report-modal-scroll/);
const sideDrawerFactoryStart = operationsJs.lastIndexOf('function ensureSideDrawerFromCard');
const sideDrawerFactoryEnd = operationsJs.indexOf('function ensureLogCreateDrawer', sideDrawerFactoryStart);
const sideDrawerFactoryJs = operationsJs.slice(sideDrawerFactoryStart, sideDrawerFactoryEnd);
assert.ok(sideDrawerFactoryStart > -1 && sideDrawerFactoryEnd > sideDrawerFactoryStart, 'The side-drawer factory must exist');
assert.match(
  sideDrawerFactoryJs,
  /wrapper\.addEventListener\('click',[\s\S]*?target\.closest\('\.side-drawer-panel'\)[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?closeSideDrawer\(wrapper\);[\s\S]*?\}, true\)/,
  'Clicking outside the report sheet must close it while clicks inside stay inert',
);
const closeSideDrawerStart = operationsJs.lastIndexOf('function closeSideDrawer', sideDrawerFactoryStart);
const closeSideDrawerEnd = operationsJs.indexOf('function ensureSideDrawerFromCard', closeSideDrawerStart);
const closeSideDrawerJs = operationsJs.slice(closeSideDrawerStart, closeSideDrawerEnd);
assert.match(
  closeSideDrawerJs,
  /var reportForm = qs\('\[data-report-draft-form\]', drawer\);[\s\S]*?saveReportDraftNow\(reportForm\);[\s\S]*?data-open', '0'/,
  'Closing a report sheet from its backdrop must persist the current draft before dismissal',
);
assert.match(operationsJs, /report-form-section report-form-meta-section/);
assert.match(operationsJs, /report-form-section report-form-main-section/);
assert.match(operationsJs, /class="report-final-message"/);
assert.match(operationsJs, /report-modal-close-mark/);
assert.match(operationsJs, /data-log-form[^>]*novalidate/);
assert.match(operationsJs, /form\.elements\.namedItem\(name\)/);
assert.match(operationsJs, /reportTitle = '\\u041e\\u0442\\u0447\\u0435\\u0442 \\u0437\\u0430 ' \+ selectedDate/);
assert.match(operationsJs, /Отчёт сохранён/);
const finalReportsPanelStart = operationsJs.lastIndexOf('renderProjectReportsPanel = function');
const finalReportsPanelEnd = operationsJs.indexOf('renderProjectReportForm = function', finalReportsPanelStart);
const finalReportsPanelJs = operationsJs.slice(finalReportsPanelStart, finalReportsPanelEnd);
assert.ok(finalReportsPanelStart > -1 && finalReportsPanelEnd > finalReportsPanelStart, 'The final reports panel override must exist');
assert.equal(finalReportsPanelJs.includes('report-create-button'), false, 'The journal must not duplicate the persistent daily-report CTA');
const reportModalFormStart = operationsJs.lastIndexOf('renderProjectReportForm = function');
const reportModalFormEnd = operationsJs.indexOf('function bindProjectReportsCalendar', reportModalFormStart);
const reportModalFormJs = operationsJs.slice(reportModalFormStart, reportModalFormEnd);
assert.ok(reportModalFormStart > -1 && reportModalFormEnd > reportModalFormStart, 'The modal form override must exist');
for (const [sectionClass, icon] of [
  ['report-form-meta-section', 'calendar-days'],
  ['report-form-main-section', 'message-square-text'],
  ['report-resources-section', 'users-round'],
  ['report-photos-section', 'images'],
]) {
  const sectionStart = reportModalFormJs.indexOf(sectionClass);
  const sectionEnd = reportModalFormJs.indexOf('</section>', sectionStart);
  const sectionMarkup = reportModalFormJs.slice(sectionStart, sectionEnd);
  assert.ok(sectionStart > -1 && sectionEnd > sectionStart, `Missing report section: ${sectionClass}`);
  assert.match(sectionMarkup, new RegExp(`data-lucide="${icon}"`));
}
for (const icon of [
  'notebook-pen',
  'hard-hat',
  'truck',
  'image-plus',
  'upload',
  'route',
  'file-check-2',
  'trash-2',
  'align-left',
]) {
  assert.match(reportModalFormJs, new RegExp(`data-lucide="${icon}"`), `Missing semantic report icon: ${icon}`);
}
assert.equal(
  /report-section-icon" aria-hidden="true">[1-5]/.test(reportModalFormJs),
  false,
  'Report sections must use semantic icons instead of step numbers',
);
assert.equal(
  /report-resource-symbol" aria-hidden="true">[ЛТ]/.test(reportModalFormJs),
  false,
  'Resource cards must use semantic icons instead of letter placeholders',
);
assert.match(reportModalFormJs, /<b>Дата и доступ<\/b>/);
assert.match(reportModalFormJs, /<b>Состав смены<\/b>/);
assert.match(reportModalFormJs, /<textarea name="raw_input"[^>]*aria-label="Опишите, что произошло"/);
assert.doesNotMatch(reportModalFormJs, /<span>Опишите, что произошло<\/span>/);
for (const icon of ['calendar-days', 'eye', 'octagon-alert', 'arrow-right']) {
  assert.match(reportModalFormJs, new RegExp(`report-compact-field-label[^>]*>[\\s\\S]*?data-lucide="${icon}"`));
}
assert.match(reportModalFormJs, /<textarea name="blockers" rows="1"/);
assert.match(reportModalFormJs, /report-final-message-label[^>]*[\s\S]*?Готовый отчёт/);
assert.equal(
  reportModalFormJs.includes('name="progress_percent"'),
  false,
  'Daily report creation must not ask the foreman to update project progress',
);
assert.equal(
  logsHtml.includes('name="progress_percent"'),
  false,
  'The standalone daily-log form must not expose project progress either',
);
assert.equal(
  reportModalFormJs.includes('report-photo-picker-mark'),
  false,
  'The photo picker must not use the old decorative plus tile',
);
assert.match(reportModalFormJs, /report-photo-picker-action/);
assert.equal(reportModalFormJs.includes('report-section-auto'), false, 'Minimal report sections must not carry redundant technical badges');
assert.match(reportModalFormJs, /data-log-error role="alert" aria-atomic="true"/);
assert.match(reportModalFormJs, /data-report-final-document/);
assert.match(reportModalFormJs, /data-report-final-groups/);
assert.match(reportModalFormJs, /data-report-final-summary/);
assert.match(reportModalFormJs, /data-report-final-shift/);
assert.match(reportModalFormJs, /data-report-final-photos/);
assert.match(reportModalFormJs, /data-report-final-section="full-text"/);
assert.match(reportModalFormJs, /Описание дня/);
assert.match(reportModalFormJs, /<input type="hidden" name="work_done" value="">/);
assert.match(reportModalFormJs, /<output data-report-final-text aria-label="Готовый текст отчёта"><\/output>/);
assert.doesNotMatch(reportModalFormJs, /<textarea[^>]*name="work_done"/);
assert.doesNotMatch(reportModalFormJs, /<output[^>]*(?:readonly|required|tabindex)/);
assert.doesNotMatch(reportModalFormJs, /data-report-only-submit|report-only-button/);
assert.match(reportModalFormJs, /data-report-clear-dialog role="presentation"/);
assert.match(reportModalFormJs, /role="alertdialog" aria-modal="true"/);
assert.match(reportModalFormJs, /data-report-draft-clear-cancel/);
assert.match(reportModalFormJs, /data-report-draft-clear-confirm/);
assert.match(reportModalFormJs, /data-report-review hidden/);
assert.ok(
  reportModalFormJs.indexOf('data-report-draft-clear') < reportModalFormJs.indexOf('report-draft-status-dot'),
  'The destructive clear action must be the leftmost item in the draft status row',
);
const reportFinalSummaryIndex = reportModalFormJs.indexOf('data-report-final-summary');
const reportFinalDescriptionIndex = reportModalFormJs.indexOf('data-report-final-section="full-text"');
const reportFinalGroupsIndex = reportModalFormJs.indexOf('data-report-final-groups');
const reportFinalShiftIndex = reportModalFormJs.indexOf('data-report-final-shift');
const reportFinalPhotosIndex = reportModalFormJs.indexOf('data-report-final-photos');
assert.ok(
  reportFinalSummaryIndex < reportFinalDescriptionIndex &&
    reportFinalDescriptionIndex < reportFinalGroupsIndex &&
    reportFinalGroupsIndex < reportFinalShiftIndex &&
    reportFinalShiftIndex < reportFinalPhotosIndex,
  'The ready report must show its description before structured details, shift, and photos',
);
const reportFlowOrder = [
  'report-form-meta-section',
  'report-form-main-section',
  'report-resources-section',
  'report-photos-section',
  'report-ready-card',
  'report-final-message',
  'report-intake-actions',
].map((marker) => reportModalFormJs.indexOf(marker));
assert.ok(
  reportFlowOrder.every((position, index) => position > -1 && (index === 0 || position > reportFlowOrder[index - 1])),
  'The ready report must be the last review section immediately before saving',
);
const reportCalendarStart = operationsJs.lastIndexOf('renderLogsCalendar = function');
const reportCalendarEnd = operationsJs.indexOf('renderLogsDayView = function', reportCalendarStart);
const reportCalendarJs = operationsJs.slice(reportCalendarStart, reportCalendarEnd);
assert.ok(reportCalendarStart > -1 && reportCalendarEnd > reportCalendarStart, 'The calendar override must exist');
assert.match(reportCalendarJs, /logs = projectReportFieldLogs\(logs\)/);
assert.equal(
  reportCalendarJs.includes('data-lucide'),
  false,
  'Calendar navigation must not depend on externally loaded icons',
);
const reportStatsStart = operationsJs.lastIndexOf('renderLogsStats = function');
const reportStatsEnd = operationsJs.indexOf('renderLogsAlerts = function', reportStatsStart);
const reportStatsJs = operationsJs.slice(reportStatsStart, reportStatsEnd);
assert.ok(reportStatsStart > -1 && reportStatsEnd > reportStatsStart, 'The reports stats override must exist');
assert.match(reportStatsJs, /logs = projectReportFieldLogs\(logs\)/);
const reportAlertsStart = operationsJs.lastIndexOf('renderLogsAlerts = function');
const reportAlertsEnd = operationsJs.indexOf('// final project reports overrides', reportAlertsStart);
const reportAlertsJs = operationsJs.slice(reportAlertsStart, reportAlertsEnd);
assert.ok(reportAlertsStart > -1 && reportAlertsEnd > reportAlertsStart, 'The reports alerts override must exist');
assert.match(reportAlertsJs, /projectReportFieldLogs\(state\.projectLogsByProject\[selectedProjectId\]\)/);
const reportDayViewStart = operationsJs.lastIndexOf('renderLogsDayView = function');
const reportDayViewEnd = operationsJs.indexOf('renderLogsList = function', reportDayViewStart);
const reportDayViewJs = operationsJs.slice(reportDayViewStart, reportDayViewEnd);
assert.ok(reportDayViewStart > -1 && reportDayViewEnd > reportDayViewStart, 'The selected-day override must exist');
assert.match(reportDayViewJs, /logs = projectReportFieldLogs\(logs\)/);
assert.match(reportDayViewJs, /За этот день отчёта нет/);
const reportActionsListStart = operationsJs.lastIndexOf('renderLogsList = function');
const reportActionsListEnd = operationsJs.indexOf('PMBI.operations = PMBI.operations', reportActionsListStart);
const reportActionsListJs = operationsJs.slice(reportActionsListStart, reportActionsListEnd);
assert.ok(reportActionsListStart > -1 && reportActionsListEnd > reportActionsListStart, 'The action-history override must exist');
assert.match(reportActionsListJs, /logs = projectReportActionLogs\(logs\)/);
assert.match(reportActionsListJs, /projectReportActionCountLabel\(logs\.length\)/);
assert.match(reportActionsListJs, /Действий пока нет/);
const standaloneLogsListStart = operationsJs.indexOf('function renderLogsList(project, logs)');
const standaloneLogsListEnd = operationsJs.indexOf('function reportFormControl(form, name)', standaloneLogsListStart);
const standaloneLogsListJs = operationsJs.slice(standaloneLogsListStart, standaloneLogsListEnd);
assert.doesNotMatch(standaloneLogsListJs, /log\.blockers|log\.next_steps/, 'Structured report content must not duplicate blockers or next steps');
assert.match(operationsJs, /Number\(right\.id \|\| 0\) - Number\(left\.id \|\| 0\)/);
assert.equal(reportModalFormJs.includes('name="confirm_report"'), false, 'Saving an object report must not be blocked by a confirmation checkbox');
assert.match(operationsJs, /if \(data && data\.log\)/);
assert.match(operationsJs, /client_request_id:\s*clientRequestId/);
assert.match(operationsJs, /delete reportPayload\.progress_percent/);
assert.match(operationsJs, /delete reportPayload\.progressPercent/);
assert.equal(operationsJs.includes('Прогресс по журналу'), false, 'Report views must not surface an object progress percentage');
assert.equal(operationsJs.includes('is-progress'), false, 'Historical report cards must not show progress chips');
assert.match(operationsJs, /Фото в отчётах/);
assert.match(operationsJs, /confirmed_actions:\s*confirmedActions/);
assert.doesNotMatch(reportModalFormJs, /data-report-only-submit/);
assert.match(operationsJs, /data-report-effect/);
assert.match(operationsJs, /data-report-effect-qty/);
assert.match(operationsJs, /data-report-live-assist/);
assert.match(operationsJs, /function currentLocalDateIso\(\)/);
assert.match(operationsJs, /form\.dataset\.reportDateTouched/);
assert.match(operationsJs, /data-effect-max/);
assert.match(operationsJs, /function canApplyDailyReportMaterialActions\(\)/);
assert.match(operationsJs, /daily_log_actions_forbidden/);
assert.match(operationsJs, /daily_log_action_qty_exceeds_limit/);
assert.match(operationsJs, /data\.appliedActions/);
assert.match(operationsJs, /delete state\.materialsByProject\[projectId\]/);
assert.match(operationsJs, /PMBI\.warehouseControl\.load\(projectId, true\)/);
assert.match(operationsJs, /daily_log_has_applied_actions/);
assert.match(operationsJs, /report-actions-locked/);
assert.match(operationsJs, /Сохранить отчёт/);
assert.match(operationsJs, /state\.projectLogsByProject\[projectId\] = updatedLogs/);
assert.match(operationsJs, /name="workers_count" type="number"/);
assert.match(operationsJs, /name="is_client_visible"/);
assert.match(operationsJs, /name="blockers"/);
assert.match(operationsJs, /name="next_steps"/);
assert.match(operationsJs, /data-report-resource-add="workforce"/);
assert.match(operationsJs, /data-report-resource-add="equipment"/);
assert.match(operationsJs, /data-report-resource-hours/);
assert.match(operationsJs, /function collectReportResources\(form, kind\)/);
assert.match(operationsJs, /workforce:\s*workforceResult\.entries/);
assert.match(operationsJs, /equipment_entries:\s*equipmentResult\.entries/);
assert.match(operationsJs, /data-report-photo-input/);
assert.match(operationsJs, /function compressReportPhoto\(file\)/);
assert.match(operationsJs, /list\.insertAdjacentHTML\('beforeend', reportResourceRowHtml\(kind\)\);\s*refreshLucideIcons\(list\)/);
assert.match(operationsJs, /function renderReportPhotoDrafts\(form\)[\s\S]*?refreshLucideIcons\(root\)/);
assert.match(operationsJs, /daily-logs\/' \+ dailyLogId \+ '\/photos'/);
assert.match(operationsJs, /client_photo_id/);
assert.match(operationsJs, /draft\.status = 'uploaded'/);
assert.match(operationsJs, /draft\.status = 'upload-error'/);
assert.match(operationsJs, /form\.dataset\.savedDailyLogId/);
assert.match(operationsJs, /function setReportPhotoRetryMode\(/);
assert.match(operationsJs, /data-report-photo-viewer/);
assert.match(operationsJs, /data-report-photo-viewer-close[^>]*[\s\S]*?data-lucide="x"/);
assert.match(operationsJs, /data-report-photo-viewer-prev[^>]*[\s\S]*?data-lucide="chevron-left"/);
assert.match(operationsJs, /data-report-photo-viewer-next[^>]*[\s\S]*?data-lucide="chevron-right"/);
assert.match(operationsJs, /data-project-report-delete/);
assert.match(operationsJs, /daily-logs\/' \+ logId \+ '\/delete/);
assert.match(operationsJs, /function projectReportStoredDocumentData\(log\)/);
assert.match(operationsJs, /function projectReportDocumentHtml\(log\)/);
assert.match(operationsJs, /data-report-saved-document/);
assert.ok((operationsJs.match(/projectReportDocumentHtml\(log\)/g) || []).length >= 3, 'Saved report surfaces must use the structured document renderer');
assert.doesNotMatch(operationsJs, /<p class="report-entry-text">' \+ escapeHtml\(log\.work_done/);
assert.match(operationsJs, /PMBI\.operations\.renderProjectReportDeleteButton = renderProjectReportDeleteButton/);
assert.match(operationsJs, /PMBI\.operations\.bindProjectReportDeleteActions = bindProjectReportDeleteActions/);

assert.match(appJs, /Текст отчета:/);
assert.match(appJs, /Math\.abs\(numeric\) < 1000000000000 \? numeric \* 1000 : numeric/);
assert.equal(appJs.includes('function loadProjectLogs() {}'), false, 'Project log loading must not be an empty placeholder');
assert.match(appJs, /function loadProjectLogs\(projectId, callback\)\s*\{[^}]*api\('\/api\/projects\/' \+ projectId \+ '\/daily-logs'\)/s);
assert.match(appJs, /refreshProjectReportsTab = function \(\) \{ return operationsCall\('refreshProjectReportsTab', arguments\); \};/);
assert.match(appJs, /Распознаны работы:/);
assert.match(appJs, /Распознаны материалы:/);
assert.equal(appJs.includes('Будут обновлены материалы:'), false);
const finalMaterialMatcherStart = appJs.lastIndexOf('reportMaterialResultFromClause = function');
const finalMaterialMatcherEnd = appJs.indexOf('effectiveMaterialFromReports = function', finalMaterialMatcherStart);
const finalMaterialMatcherJs = appJs.slice(finalMaterialMatcherStart, finalMaterialMatcherEnd);
assert.ok(finalMaterialMatcherStart > -1 && finalMaterialMatcherEnd > finalMaterialMatcherStart, 'The final material speech matcher must exist');
assert.match(finalMaterialMatcherJs, /reportHasReceiptIntent/);
assert.match(finalMaterialMatcherJs, /toOrder/);
assert.match(finalMaterialMatcherJs, /orderedPending/);
assert.doesNotMatch(finalMaterialMatcherJs, /if \(!purchase && !used\) used = true/);
assert.match(appJs, /data-report-effect-qty/);
assert.doesNotMatch(appJs, /Сохранится только отчёт/);
assert.match(appJs, /function buildProjectReportTextFromMatches/);
assert.match(appJs, /function reportMatchConsumesClause/);
assert.match(appJs, /function projectReportPreviewAdditionalClauses/);
assert.match(appJs, /function pruneProjectReportManualSelections/);
assert.match(appJs, /function buildProjectReportFullText/);
assert.match(appJs, /function renderStructuredFinalReportHtml/);
assert.match(appJs, /function syncReportTextFromEffectQuantities/);
assert.match(appJs, /activeDraft\.text = buildProjectReportTextFromMatches/);
assert.match(appJs, /finalGroups\.innerHTML = renderStructuredFinalReportHtml/);
assert.match(appJs, /activeDraft\.previewAdditionalClauses = projectReportPreviewAdditionalClauses/);
assert.match(appJs, /pruneProjectReportManualSelections\(manualSelections, rawText\)/);
assert.match(appJs, /consumedClauseTexts/);
assert.ok((appJs.match(/workDone\.value =/g) || []).length >= 2, 'The semantic report output must update after typing and quantity changes');
assert.match(appJs, /reviewCard\.hidden = !rawText/);
assert.match(appJs, /refreshLucideIcons\(liveAssist\)/);
assert.match(appJs, /previewRoot\.innerHTML = renderReportPreviewHtml[\s\S]*?refreshLucideIcons\(previewRoot\)/);
const finalReportPreviewStart = appJs.lastIndexOf('renderReportPreviewHtml = function');
const finalReportPreviewEnd = appJs.indexOf('renderProjectReportForm = function', finalReportPreviewStart);
const finalReportPreviewJs = appJs.slice(finalReportPreviewStart, finalReportPreviewEnd);
assert.ok(finalReportPreviewStart > -1 && finalReportPreviewEnd > finalReportPreviewStart, 'The final report preview renderer must exist');
assert.match(finalReportPreviewJs, /report-action-staging-inner/);
assert.match(finalReportPreviewJs, /type="checkbox" checked data-report-effect/);
assert.match(finalReportPreviewJs, /data-report-effect-qty/);
assert.equal(
  finalReportPreviewJs.includes('report-preview-card-main'),
  false,
  'The action preview must not duplicate the ready report that already stays at the bottom of the form',
);
assert.equal(finalReportPreviewJs.includes('Пока не нашел работы'), false, 'Empty work cards must not clutter a narrated report');
assert.equal(finalReportPreviewJs.includes('Материалы пока не найдены'), false, 'Empty material cards must not clutter a narrated report');
assert.doesNotMatch(finalReportPreviewJs, /report-preview-card|report-effects-summary|Только в отчёт/);
assert.match(appJs, /function startPrimaryReportVoice\(form\)/);
assert.match(appJs, /data-report-voice-unavailable/);
assert.match(appJs, /function reportVoiceUnavailableMessage\(\)/);
assert.match(appJs, /window\.isSecureContext === false/);
assert.match(appJs, /function reportVoiceErrorMessage\(errorCode\)/);
assert.match(appJs, /errorCode === 'audio-capture'/);
assert.match(appJs, /errorCode === 'network'/);
assert.match(appJs, /errorCode === 'no-speech'/);
assert.match(appJs, /data-effect-max=/);
assert.doesNotMatch(appJs, /if \(!procurement\.materialId\) return/);
assert.match(appJs, /if \(!merged\.phase\) merged\.phase = 'order'/);
assert.match(appJs, /уже заказано, ждём/);
assert.match(appJs, /function reportLiveSuggestions\(projectId, rawText\)/);
assert.match(appJs, /function reportSuggestionScore\(candidate, queryTokens, normalizedQuery\)/);
assert.match(appJs, /data-report-suggestion=/);
assert.match(appJs, /data-report-suggestion-remove=/);
assert.match(appJs, /data-report-manual-action/, 'A manually selected material must expose an explicit action');
assert.match(appJs, /data-report-manual-qty/, 'Manual work and material selections must expose a quantity input');
assert.doesNotMatch(finalReportPreviewJs, /data-report-manual-work-mode|data-report-manual-quantity-mode|data-report-manual-unit/);
assert.match(appJs, /Выберите действие/, 'A material without a recognized verb must require an explicit action');
assert.match(appJs, /restored\.manualWorkMode === 'report'\) restored\.manualWorkMode = 'delta_qty'/);
assert.match(appJs, /restored\.manualAction === 'report'\) restored\.manualAction = ''/);
assert.match(appJs, /manualAction:\s*String\(selected\.manualAction/, 'Manual material action must survive draft autosave');
assert.match(appJs, /manualQty:\s*String\(selected\.manualQty/, 'Manual quantity must survive draft autosave');
assert.match(appJs, /manualUnit:\s*String\(selected\.manualUnit/, 'Manual report unit must survive draft autosave');
assert.match(appJs, /mergeManualSelections\(draft, rawText\)/);
assert.match(appJs, /reportClearManualSelectionEffectOverrides\(effectOverrides, selected\)/, 'Manual edits must clear the matching stale effect quantity');
assert.match(appJs, /refreshPreview\(\{ skipCapture: true, skipLiveAssist: true \}\)/, 'Manual quantity input must rebuild without recapturing its old effect value');
const manualQtyInputHandlerStart = appJs.indexOf("if (liveAssist) liveAssist.addEventListener('input'");
const manualQtyInputHandlerEnd = appJs.indexOf("if (liveAssist) liveAssist.addEventListener('change'", manualQtyInputHandlerStart);
const manualQtyInputHandlerSource = appJs.slice(manualQtyInputHandlerStart, manualQtyInputHandlerEnd);
assert.match(
  manualQtyInputHandlerSource,
  /captureEffectOverrides\(\)[\s\S]*updateManualSelectionControl\(event\.target\)[\s\S]*normalizeManualWorkSelection\(selected\)[\s\S]*reportClearManualSelectionEffectOverrides\(effectOverrides, selected\)[\s\S]*refreshPreview\(\{ skipCapture: true, skipLiveAssist: true \}\)/,
  'Replacing 40 with 5 must normalize the remaining work, preserve other overrides, clear this row, and rebuild without recapturing 40',
);
assert.match(appJs, /target\.matches\('\[data-report-manual-qty\]'\)[\s\S]*selected\.manualWorkMode = 'delta_qty'[\s\S]*selected\.manualQuantityMode = 'delta_qty'/);
assert.match(appJs, /data-report-final-summary/);
assert.match(appJs, /data-report-final-shift/);
assert.match(appJs, /data-report-final-photos/);
assert.match(appJs, /photoDrafts\.length \+ ' фото'/);
assert.match(appJs, /var narrativeQuantity = reportWorkNarrativeQuantity\(entry\)/, 'Structured work rows must use the same accumulated quantity wording as the full report');
assert.match(appJs, /function projectReportUnmatchedClauses\(/);
assert.match(appJs, /clauseTexts:\s*\[\]/);
assert.match(appJs, /function reportHasWorkCompletionIntent\(/);
assert.match(appJs, /reportWorkResultFromClause = function \(clauseText, candidate\) \{\s*if \(!reportHasWorkCompletionIntent\(clauseText\)\) return null;/);
assert.match(appJs, /Дополнительно выполнено/);
assert.match(appJs, /Доп\. работы/);
assert.match(backendServer, /api_upload_daily_log_photo/);
assert.match(communicationsDocs, /workers_json/);
assert.match(communicationsDocs, /equipment_json/);
assert.match(communicationsDocs, /CREATE TABLE IF NOT EXISTS daily_log_photos/);
assert.match(communicationsDocs, /compress_daily_log_image/);
assert.match(communicationsDocs, /client_photo_id/);

const storedReportStart = operationsJs.indexOf('function projectReportStoredNormalize(value)');
const storedReportEnd = operationsJs.indexOf('function projectReportDateParts(isoDate)', storedReportStart);
assert.ok(storedReportStart > -1 && storedReportEnd > storedReportStart, 'The saved report document renderer must be extractable');
const storedReportContext = {
  escapeHtml: (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;'),
};
vm.runInNewContext(
  `${operationsJs.slice(storedReportStart, storedReportEnd)}\nthis.savedReportData = projectReportStoredDocumentData; this.savedReportHtml = projectReportDocumentHtml;`,
  storedReportContext,
  { filename: 'saved-report-document.js' },
);
const storedReport = {
  work_done: 'Выполнены работы: Монтаж розеток — 5 шт. Заказаны материалы: Кабель ВВГ 10.5 м. Дополнительно зафиксировано: Заказчик согласовал цвет фасада.',
  blockers: 'Ждём поставку щита',
  next_steps: 'Проверить подключение',
};
const storedReportData = storedReportContext.savedReportData(storedReport);
assert.equal(storedReportData.rows.works.length, 1);
assert.equal(storedReportData.rows.materials.length, 1);
assert.equal(storedReportData.rows.additional.length, 1);
assert.equal(storedReportData.rows.blockers.length, 1);
assert.equal(storedReportData.rows.next.length, 1);
assert.match(storedReportData.rows.materials[0].title, /10\.5 м/);
assert.match(storedReportData.fullText, /Проблемы и ограничения: Ждём поставку щита/);
assert.match(storedReportData.fullText, /Следующий шаг: Проверить подключение/);
const storedReportHtml = storedReportContext.savedReportHtml(storedReport);
assert.match(storedReportHtml, /data-report-saved-section="works"/);
assert.match(storedReportHtml, /data-report-saved-section="materials"/);
assert.match(storedReportHtml, /data-report-saved-section="additional"/);
assert.match(storedReportHtml, /data-report-saved-section="blockers"/);
assert.match(storedReportHtml, /data-report-saved-section="next"/);
assert.match(storedReportHtml, /Доп\. работы/);
assert.match(storedReportHtml, /Описание дня/);
assert.match(storedReportHtml, /data-report-saved-document/);
assert.ok(
  storedReportHtml.indexOf('Описание дня') < storedReportHtml.indexOf('data-report-saved-section="works"'),
  'Saved reports must keep the day description above work and material sections',
);
assert.doesNotMatch(storedReportHtml, /<script>/);
const storedMultiReportData = storedReportContext.savedReportData({
  work_done: 'Выполнены работы: Монтаж розеток — 5 шт; Установка щита — 1 шт. Заказаны материалы: Кабель ВВГ 10 м; Розетка 5 шт.',
});
assert.equal(storedMultiReportData.rows.works.length, 2, 'Saved work rows must remain separate');
assert.equal(storedMultiReportData.rows.materials.length, 2, 'Saved material rows must remain separate');
const storedShortBlocker = storedReportContext.savedReportData({
  work_done: 'Дополнительно зафиксировано: Интернет работает.',
  blockers: 'Нет',
});
assert.match(storedShortBlocker.fullText, /Проблемы и ограничения: Нет/, 'Phrase matching must not confuse «нет» with «интернет»');
const storedPartialSupplement = storedReportContext.savedReportData({
  work_done: 'Ждём электрика.',
  blockers: 'Ждём электрика. Нет кабеля.',
  next_steps: 'Ждём электрика. Проверить щит.',
});
assert.equal((storedPartialSupplement.fullText.match(/Ждём электрика/g) || []).length, 1, 'Saved reports must remove a blocker phrase already present in the report');
assert.match(storedPartialSupplement.fullText, /Проблемы и ограничения: Нет кабеля\./);
assert.match(storedPartialSupplement.fullText, /Следующий шаг: Проверить щит\./);
assert.deepEqual(
  Array.from(storedPartialSupplement.rows.additional, (row) => row.title),
  ['Ждём электрика'],
  'Saved additional work must stay separate from blockers and next steps',
);
assert.deepEqual(Array.from(storedPartialSupplement.rows.blockers, (row) => row.title), ['Нет кабеля']);
assert.deepEqual(Array.from(storedPartialSupplement.rows.next, (row) => row.title), ['Проверить щит']);
const storedSentenceBoundarySupplement = storedReportContext.savedReportData({
  work_done: 'Нет кабеля. Ждём щит.',
  blockers: 'Кабеля, ждём',
});
assert.match(
  storedSentenceBoundarySupplement.fullText,
  /Проблемы и ограничения: Кабеля, ждём\./,
  'Saved-report dedupe must not match words joined across two sentence boundaries',
);

const finalClauseStart = appJs.lastIndexOf('function reportTextClauses(value)');
const finalClauseEnd = appJs.indexOf('function reportQuantityFromClause', finalClauseStart);
const formatterStart = appJs.indexOf('function reportTrimSentence(value)');
const formatterEnd = appJs.indexOf('function buildProjectReportDraft', formatterStart);
assert.ok(finalClauseStart > -1 && finalClauseEnd > finalClauseStart, 'The final report clause splitter must be extractable');
assert.ok(formatterStart > -1 && formatterEnd > formatterStart, 'The report formatter must be extractable');
const formatterContext = {
  finalSectionSummaryNumber: (value) => String(value),
  quantityPlanInfo: (item) => ({ unit: item.unit || 'м' }),
  escapeHtml: (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;'),
  reportHasOrderIntent: (value) => /(^|\s)заказ(?:али|ал|ано)?(?=\s|$)/.test(String(value || '').toLowerCase()),
  reportHasPurchaseIntent: (value) => /(^|\s)(?:заказ(?:али|ал|ано)?|купили|закупили)(?=\s|$)/.test(String(value || '').toLowerCase()),
  reportHasReceiptIntent: (value) => /(^|\s)(?:доставили|привезли|получили)(?=\s|$)/.test(String(value || '').toLowerCase()),
  reportHasUseIntent: (value) => /(^|\s)(?:смонтировали|установили|использовали)(?=\s|$)/.test(String(value || '').toLowerCase()),
};
vm.runInNewContext(
  `${appJs.slice(finalClauseStart, finalClauseEnd)}\n${appJs.slice(formatterStart, formatterEnd)}\nthis.buildMixedReport = buildProjectReportTextFromMatches; this.buildFullReport = buildProjectReportFullText; this.pruneSelections = pruneProjectReportManualSelections; this.splitReport = reportTextClauses; this.renderStructuredFinal = renderStructuredFinalReportHtml;`,
  formatterContext,
  { filename: 'mixed-report-formatter.js' },
);
const mixedReportText = formatterContext.buildMixedReport(
  'Смонтировали розетки. Дополнительно сделали временное освещение. Заказали кабель.',
  [{ item: { title: 'Монтаж розеток' }, done: true, partial: false, clauseText: 'Смонтировали розетки' }],
  [],
);
assert.match(mixedReportText, /Монтаж розеток/);
assert.match(mixedReportText, /временное освещение/);
assert.match(mixedReportText, /Заказали кабель/);
const noPunctuationClauses = formatterContext.splitReport(
  'Смонтировали розетки дополнительно сделали временное освещение заказали кабель',
);
assert.deepEqual(
  Array.from(formatterContext.splitReport('Покрасили стены подключили щит собрали леса')),
  ['Покрасили стены', 'подключили щит', 'собрали леса'],
  'Supported work verbs must split dictated actions even without punctuation',
);
assert.deepEqual(
  Array.from(noPunctuationClauses),
  ['Смонтировали розетки', 'дополнительно сделали временное освещение', 'заказали кабель'],
);
const conjunctionClauses = formatterContext.splitReport(
  'Смонтировали розетки и заказали кабель и дополнительно убрали мусор',
);
assert.deepEqual(
  Array.from(conjunctionClauses),
  ['Смонтировали розетки', 'заказали кабель', 'дополнительно убрали мусор'],
  'Conjunctions between dictated actions must be consumed instead of becoming standalone report events',
);
assert.equal(Array.from(conjunctionClauses).includes('и'), false);
const materialReportText = formatterContext.buildMixedReport(
  'Заказали кабель 40 м. Дополнительно убрали строительный мусор.',
  [],
  [{
    item: { title: 'Кабель', unit: 'м' },
    purchasedQty: 40,
    receivedQty: 0,
    usedQty: 0,
    clauseTexts: ['Заказали кабель 40 м'],
  }],
);
assert.match(materialReportText, /Кабель 40 м/);
assert.match(materialReportText, /убрали строительный мусор/);
assert.doesNotMatch(materialReportText, /Заказано: Заказали кабель/);

const connectedManualReportText = formatterContext.buildMixedReport(
  'Грунт разработали. Купили 20 скоб. Заказчик согласовал въезд.',
  [{
    item: { title: 'Разработка грунта', unit: 'м3', plannedQty: 70 },
    actualQty: 40,
    quantityLabel: '40 м3',
    quantityMode: 'delta_qty',
    done: false,
    partial: true,
    selectedManually: true,
    clauseText: 'Грунт разработали',
  }],
  [{
    item: { title: 'Скобы', unit: 'шт', plannedQty: 40, purchasedQty: 0 },
    purchasedQty: 20,
    receivedQty: 0,
    usedQty: 0,
    selectedManually: true,
    clauseTexts: ['Купили 20 скоб'],
  }],
);
assert.match(connectedManualReportText, /Частично выполнены: Разработка грунта — 40 м3 из 70 м3/);
assert.match(connectedManualReportText, /Заказаны материалы: Скобы 20 шт из 40 шт \(осталось 20 шт\)/);
assert.match(connectedManualReportText, /Дополнительно зафиксировано: Заказчик согласовал въезд/);
assert.ok((connectedManualReportText.match(/\n/g) || []).length >= 2, 'Ready report sections must not collapse into one unreadable paragraph');
assert.equal((connectedManualReportText.match(/Купили 20 скоб/g) || []).length, 0, 'A confirmed material card must replace the raw phrase with a report statement');

const invalidCatalogUnitReportText = formatterContext.buildMixedReport(
  'Заказаны панели из поликарбоната 5 м2.',
  [],
  [{
    item: { title: 'Панель из поликарбоната', unit: '??' },
    reportUnit: 'м2',
    purchasedQty: 5,
    receivedQty: 0,
    usedQty: 0,
    clauseTexts: ['Заказаны панели из поликарбоната 5 м2'],
  }],
);
assert.match(invalidCatalogUnitReportText, /Панель из поликарбоната 5 м2/);
assert.doesNotMatch(invalidCatalogUnitReportText, /\?\?/);

const structuredFinalHtml = formatterContext.renderStructuredFinal({
  workMatches: [{
    item: { title: 'Монтаж розеток' },
    done: true,
    partial: false,
    actionEligible: true,
    quantityLabel: '5 шт',
    clauseText: 'Смонтировали 5 шт розеток',
  }],
  materialMatches: [{
    item: { title: 'Кабель ВВГ', unit: 'м' },
    purchasedQty: 40,
    receivedQty: 0,
    usedQty: 0,
    actionEligible: true,
    clauseTexts: ['Заказали кабель ВВГ 40 м'],
  }],
  unmatchedClauses: ['Ждём электрика'],
}, '', 'Проверить щит <script>alert(1)</script>');
assert.match(structuredFinalHtml, /data-report-final-section="works"/);
assert.match(structuredFinalHtml, /data-report-final-section="materials"/);
assert.match(structuredFinalHtml, /data-report-final-section="blockers"/);
assert.match(structuredFinalHtml, /data-report-final-section="next"/);
assert.match(structuredFinalHtml, /Работы/);
assert.match(structuredFinalHtml, /Материалы/);
assert.match(structuredFinalHtml, /Блокеры/);
assert.match(structuredFinalHtml, /Следующий шаг/);
assert.equal((structuredFinalHtml.match(/Кабель ВВГ/g) || []).length, 1, 'A recognized material must appear in exactly one structured row');
assert.doesNotMatch(structuredFinalHtml, /Дополнительное событие/);
assert.match(structuredFinalHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(structuredFinalHtml, /<script>/);
const invalidCatalogUnitFinalHtml = formatterContext.renderStructuredFinal({
  workMatches: [],
  materialMatches: [{
    item: { title: 'Панель из поликарбоната', unit: '??' },
    reportUnit: 'м2',
    purchasedQty: 5,
    receivedQty: 0,
    usedQty: 0,
    actionEligible: true,
    clauseTexts: ['Заказаны панели из поликарбоната 5 м2'],
  }],
  unmatchedClauses: [],
}, '', '');
assert.match(invalidCatalogUnitFinalHtml, /Заказано 5 м2/);
assert.doesNotMatch(invalidCatalogUnitFinalHtml, /\?\?/, 'The structured final report must prefer the explicit unit over invalid catalog data');
const worksOnlyStructuredHtml = formatterContext.renderStructuredFinal({
  workMatches: [{ item: { title: 'Монтаж розеток' }, done: true, actionEligible: true }],
  materialMatches: [],
  unmatchedClauses: [],
}, '', '');
assert.match(worksOnlyStructuredHtml, /data-report-final-section="works"/);
assert.doesNotMatch(worksOnlyStructuredHtml, /data-report-final-section="materials"/);
assert.doesNotMatch(worksOnlyStructuredHtml, /data-report-final-section="(?:additional|blockers|next)"/);

const additionalWorkStructuredHtml = formatterContext.renderStructuredFinal({
  workMatches: [],
  materialMatches: [],
  unmatchedClauses: ['Дополнительно сделали временное освещение'],
}, '', '');
assert.match(additionalWorkStructuredHtml, /data-report-final-section="additional"/);
assert.match(additionalWorkStructuredHtml, /Доп\. работы/);
assert.doesNotMatch(additionalWorkStructuredHtml, /data-report-final-section="(?:blockers|next)"/);

const fullReportText = formatterContext.buildFullReport(
  'Выполнены работы: Монтаж розеток.',
  'Ждём поставку щита',
  'Проверить подключение',
);
assert.match(fullReportText, /Проблемы и ограничения: Ждём поставку щита\./);
assert.match(fullReportText, /Следующий шаг: Проверить подключение\./);
assert.equal((formatterContext.buildFullReport(fullReportText, 'Ждём поставку щита', '') .match(/Ждём поставку щита/g) || []).length, 1);
const partialSupplementText = formatterContext.buildFullReport(
  'Ждём электрика.',
  'Ждём электрика. Нет кабеля.',
  'Ждём электрика. Проверить щит.',
);
assert.equal((partialSupplementText.match(/Ждём электрика/g) || []).length, 1, 'Composer text must remove only the overlapping blocker phrase');
assert.match(partialSupplementText, /Проблемы и ограничения: Нет кабеля\./);
assert.match(partialSupplementText, /Следующий шаг: Проверить щит\./);
const sentenceBoundarySupplementText = formatterContext.buildFullReport(
  'Нет кабеля. Ждём щит.',
  'Кабеля, ждём',
  '',
);
assert.match(
  sentenceBoundarySupplementText,
  /Проблемы и ограничения: Кабеля, ждём\./,
  'Composer dedupe must not drop a phrase formed only by joining adjacent sentences',
);
const partialSupplementHtml = formatterContext.renderStructuredFinal({
  text: 'Ждём электрика.',
  workMatches: [],
  materialMatches: [],
  unmatchedClauses: ['Ждём электрика'],
}, 'Ждём электрика. Нет кабеля.', 'Ждём электрика. Проверить щит.');
assert.equal((partialSupplementHtml.match(/Ждём электрика/g) || []).length, 1, 'Structured final report must not duplicate a dictated blocker phrase');
assert.equal((partialSupplementHtml.match(/Нет кабеля/g) || []).length, 1, 'Structured final report must retain a unique blocker phrase');
assert.equal((partialSupplementHtml.match(/Проверить щит/g) || []).length, 1, 'Structured final report must retain a unique next-step phrase');

const manualSelectionState = {
  material: { clauseText: 'Кабель ВВГ' },
  blocker: { clauseText: 'Ждём электрика' },
};
formatterContext.pruneSelections(manualSelectionState, 'Ждём электрика.');
assert.deepEqual(Object.keys(manualSelectionState), ['blocker']);

const intentStart = appJs.indexOf('function reportHasWorkCompletionIntent(text)');
const intentEnd = appJs.indexOf('function reportTextClauses(value)', intentStart);
assert.ok(intentStart > -1 && intentEnd > intentStart, 'The work-completion intent gate must be extractable');
const intentContext = {
  normalizeReportText: (value) => String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-z\u0400-\u04ff0-9%]+/g, ' ').replace(/\s+/g, ' ').trim(),
  reportHasPartialIntent: (value) => /(50%|половин|частич)/.test(String(value || '').toLowerCase()),
};
vm.runInNewContext(
  `${appJs.slice(intentStart, intentEnd)}\nthis.hasWorkIntent = reportHasWorkCompletionIntent;`,
  intentContext,
  { filename: 'work-intent-gate.js' },
);
assert.equal(intentContext.hasWorkIntent('Ждём монтаж дверей'), false);
assert.equal(intentContext.hasWorkIntent('Заказали монтаж дверей'), false);
assert.equal(intentContext.hasWorkIntent('Смонтировали двери'), true);

const materialIntentStart = appJs.indexOf('function reportHasOrderIntent(text)');
const materialIntentEnd = appJs.indexOf('function reportHasWorkCompletionIntent(text)', materialIntentStart);
assert.ok(materialIntentStart > -1 && materialIntentEnd > materialIntentStart, 'Material intent functions must be extractable');
const materialIntentContext = {
  normalizeReportText: (value) => String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-z\u0400-\u04ff0-9%]+/g, ' ').replace(/\s+/g, ' ').trim(),
};
vm.runInNewContext(
  `${appJs.slice(materialIntentStart, materialIntentEnd)}\nthis.materialIntents = { order: reportHasOrderIntent, purchase: reportHasPurchaseIntent, receipt: reportHasReceiptIntent, use: reportHasUseIntent };`,
  materialIntentContext,
  { filename: 'material-intent-gates.js' },
);
assert.equal(materialIntentContext.materialIntents.purchase('Заказчик согласовал кабель ВВГ'), false);
assert.equal(materialIntentContext.materialIntents.receipt('Кабеля ВВГ достаточно'), false);
assert.equal(materialIntentContext.materialIntents.purchase('Заказали кабель ВВГ'), true);
assert.equal(materialIntentContext.materialIntents.receipt('Доставили кабель ВВГ'), true);

const parserBaseStart = appJs.indexOf('function normalizeReportText(value)');
const parserBaseEnd = appJs.indexOf('function rebuildProjectReportEffects', parserBaseStart);
const parserFinalStart = appJs.indexOf('function reportHasWholeIntent(text)');
const parserFinalEnd = appJs.indexOf('ensureReportPreviewRoot = function', parserFinalStart);
const parserEffectiveMatcherStart = appJs.lastIndexOf('reportQuantityFromClause = function (clauseText, item)');
const parserEffectiveMatcherEnd = appJs.indexOf('effectiveMaterialFromReports = function', parserEffectiveMatcherStart);
const parserManualEntryStart = appJs.indexOf('function reportManualWorkEntry(candidate, rawText)');
const parserManualEntryEnd = appJs.indexOf('bindReportPreview = function', parserManualEntryStart);
assert.ok(parserBaseStart > -1 && parserBaseEnd > parserBaseStart, 'Base report parser must be extractable');
assert.ok(parserFinalStart > -1 && parserFinalEnd > parserFinalStart, 'Final report parser overrides must be extractable');
assert.ok(
  parserEffectiveMatcherStart > -1 && parserEffectiveMatcherEnd > parserEffectiveMatcherStart,
  'Effective quantity, work, and material matchers must be extractable',
);
assert.ok(parserManualEntryStart > -1 && parserManualEntryEnd > parserManualEntryStart, 'Manual report entries must be extractable');
const clearManualOverridesStart = appJs.indexOf('function reportClearManualSelectionEffectOverrides(');
const clearManualOverridesEnd = appJs.indexOf('\n    bindReportPreview = function', clearManualOverridesStart);
assert.ok(clearManualOverridesStart > -1 && clearManualOverridesEnd > clearManualOverridesStart, 'Manual effect override clearing must be extractable');
const clearManualOverridesContext = {};
vm.runInNewContext(
  `${appJs.slice(clearManualOverridesStart, clearManualOverridesEnd)}\nthis.clearManualOverrides = reportClearManualSelectionEffectOverrides;`,
  clearManualOverridesContext,
  { filename: 'report-manual-effect-overrides.js' },
);
const staleEffectOverrides = {
  'work_progress:501': { qty: 40 },
  'work_progress:502': { qty: 7 },
  'material_purchase:601': { qty: 12 },
  'material_receipt:601': { qty: 4 },
};
clearManualOverridesContext.clearManualOverrides(staleEffectOverrides, {
  kind: 'work',
  candidate: { item: { id: 501 } },
});
assert.equal(staleEffectOverrides['work_progress:501'], undefined, 'Old 40 must not overwrite a new manual work value of 5');
assert.equal(staleEffectOverrides['work_progress:502'].qty, 7, 'Changing one row must preserve other explicit effect edits');
clearManualOverridesContext.clearManualOverrides(staleEffectOverrides, {
  kind: 'material',
  candidate: { item: { id: 601 } },
});
assert.equal(staleEffectOverrides['material_purchase:601'], undefined, 'A material action change must clear the old purchase delta');
assert.equal(staleEffectOverrides['material_receipt:601'], undefined, 'A material action change must clear every stale action for that material');
const parserProjectId = 42;
const parserContext = {
  state: {
    sectionScheduleByProject: {
      [parserProjectId]: {
        sections: [{
          title: 'Электрика',
          items: [
            { id: 501, title: 'Монтаж розеток', plannedQty: 20, planned_qty: 20, unit: 'шт' },
            { id: 502, title: 'Монтаж выключателей', plannedQty: 20, planned_qty: 20, unit: 'шт' },
          ],
        }],
      },
    },
    materialsByProject: {
      [parserProjectId]: [
        { id: 601, title: 'Кабель ВВГ', itemKind: 'material', plannedQty: 100, unit: 'м', purchasedQty: 0, receivedQty: 0, usedQty: 0, stockBalanceQty: 0 },
        { id: 602, title: 'Кабель UTP', itemKind: 'material', plannedQty: 200, unit: 'м', purchasedQty: 0, receivedQty: 0, usedQty: 0, stockBalanceQty: 0 },
        { id: 603, title: 'Розетки', itemKind: 'material', plannedQty: 50, unit: 'шт', purchasedQty: 0, receivedQty: 0, usedQty: 0, stockBalanceQty: 0 },
        { id: 604, title: 'Панель из поликарбоната', itemKind: 'material', plannedQty: 20, unit: '??', purchasedQty: 0, receivedQty: 0, usedQty: 0, stockBalanceQty: 0 },
      ],
    },
  },
  canonicalEstimateSectionTitle: (value) => String(value || ''),
  scheduleWorkKey: (sectionTitle, item) => `${sectionTitle}:${item.id}`,
  finalSectionSummaryNumber: (value) => String(Number(value)),
  quantityPlanInfo: (item) => ({
    unit: item.unit || 'ед.',
    totalQty: Number(item.plannedQty != null ? item.plannedQty : item.planned_qty || 0),
  }),
  normalizedQuantityNumber: (value) => Number(String(value || '').replace(',', '.')) || 0,
  clampActualQty: (value, totalQty) => {
    const numeric = Math.max(0, Number(value) || 0);
    return Number(totalQty) > 0 ? Math.min(numeric, Number(totalQty)) : numeric;
  },
  reportQuantityUnitPatterns: (item) => /[a-z\u0400-\u04ff0-9%]/i.test(String(item.unit || '')) ? [String(item.unit)] : [],
  workActualProgress: (_projectId, _sectionTitle, item) => ({
    actual: Number(item.actualQty || 0),
    total: Number(item.plannedQty != null ? item.plannedQty : item.planned_qty || 0),
    unit: item.unit || 'ед.',
  }),
};
vm.runInNewContext(
  `${appJs.slice(parserBaseStart, parserBaseEnd)}\n${appJs.slice(parserFinalStart, parserFinalEnd)}\n${appJs.slice(parserEffectiveMatcherStart, parserEffectiveMatcherEnd)}\n${appJs.slice(parserManualEntryStart, parserManualEntryEnd)}\nthis.reportParser = { build: buildProjectReportDraft, normalize: normalizeReportText, manualWork: reportManualWorkEntry, manualMaterial: reportManualMaterialEntry };`,
  parserContext,
  { filename: 'report-parser-runtime.js' },
);

const manualWorkOverride = parserContext.reportParser.manualWork(
  { sectionTitle: 'Электрика', item: parserContext.state.sectionScheduleByProject[parserProjectId].sections[0].items[0] },
  'Смонтировали розетки.',
  { manualWorkMode: 'delta_qty', manualQty: '5', manualUnit: 'шт' },
);
assert.equal(manualWorkOverride.actualQty, 5, 'A manual work volume must override an auto-detected full completion');
assert.equal(manualWorkOverride.partial, true);
assert.equal(manualWorkOverride.done, false);
assert.equal(manualWorkOverride.quantityLabel, '5 шт');
const manualWorkWithExistingProgress = parserContext.reportParser.manualWork(
  { sectionTitle: 'Отделка', item: { id: 971, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, unit: 'м2' } },
  'Сделали облицовку стен.',
  { manualWorkMode: 'delta_qty', manualQty: '40', manualUnit: 'м2' },
  { actual: 60, total: 70, unit: 'м2' },
);
assert.equal(manualWorkWithExistingProgress.requestedQty, 40);
assert.equal(manualWorkWithExistingProgress.actualQty, 10, 'At 60/70 only the remaining 10 may be applied for the shift');
assert.equal(manualWorkWithExistingProgress.baseActualQty, 60);
assert.equal(manualWorkWithExistingProgress.resultActualQty, 70);
assert.equal(manualWorkWithExistingProgress.done, true);
assert.equal(manualWorkWithExistingProgress.partial, false);
const cappedManualWorkText = formatterContext.buildMixedReport(
  'Сделали облицовку стен.',
  [manualWorkWithExistingProgress],
  [],
);
assert.match(cappedManualWorkText, /10 м2 за смену \(всего 70 из 70 м2, план выполнен\)/);
assert.doesNotMatch(cappedManualWorkText, /40 м2/, 'The ready report must never claim an excess volume that cannot be applied');
const manualWorkWithoutPlan = parserContext.reportParser.manualWork(
  { sectionTitle: 'Дополнительные работы', item: { id: 972, title: 'Монтаж креплений', plannedQty: 0, planned_qty: 0, unit: 'шт' } },
  'Сделали монтаж креплений.',
  { manualWorkMode: 'delta_qty', manualQty: '5', manualUnit: 'шт' },
  { actual: 0, total: 0, unit: 'шт' },
);
assert.equal(manualWorkWithoutPlan.actualQty, 5, 'A report-only work without a plan must retain its manually entered quantity');
assert.equal(manualWorkWithoutPlan.actionEligible, false, 'A work without a plan must not create a ledger action');
assert.equal(manualWorkWithoutPlan.done, true);
assert.match(
  formatterContext.buildMixedReport('Сделали монтаж креплений.', [manualWorkWithoutPlan], []),
  /Монтаж креплений — 5 шт за смену/,
  'A no-plan work quantity must stay in the ready report text',
);
const manualWorkTargetBelowCurrent = parserContext.reportParser.manualWork(
  { sectionTitle: 'Отделка', item: { id: 973, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, unit: 'м2' } },
  'Готово всего 50 м2 облицовки стен.',
  { manualWorkMode: 'target_qty', manualQty: '50', manualUnit: 'м2' },
  { actual: 60, total: 70, unit: 'м2' },
);
assert.equal(manualWorkTargetBelowCurrent.requestedQty, 50);
assert.equal(manualWorkTargetBelowCurrent.actualQty, 60, 'A total target must never roll existing 60/70 progress back to 50');
assert.equal(manualWorkTargetBelowCurrent.quantityValue, 60);
assert.equal(manualWorkTargetBelowCurrent.actionEligible, false);
const manualWorkPercentBelowCurrent = parserContext.reportParser.manualWork(
  { sectionTitle: 'Отделка', item: { id: 974, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, unit: 'м2' } },
  'Готово 50% облицовки стен.',
  { manualWorkMode: 'percent', manualQty: '50', manualUnit: 'м2' },
  { actual: 60, total: 70, unit: 'м2' },
);
assert.equal(manualWorkPercentBelowCurrent.actualQty, 60, 'A percentage target must not roll progress below the current quantity');
assert.ok(Math.abs(manualWorkPercentBelowCurrent.quantityValue - (60 / 70 * 100)) < 1e-9);
assert.equal(manualWorkPercentBelowCurrent.actionEligible, false);
const manualWorkPercentOverride = parserContext.reportParser.manualWork(
  { sectionTitle: 'Электрика', item: parserContext.state.sectionScheduleByProject[parserProjectId].sections[0].items[0] },
  'Смонтировали розетки.',
  { manualWorkMode: 'percent', manualQty: '40', manualUnit: 'шт' },
);
assert.equal(manualWorkPercentOverride.quantityMode, 'target_percent');
assert.equal(manualWorkPercentOverride.quantityValue, 40);
assert.equal(manualWorkPercentOverride.actualQty, 8, '40% of a 20-unit work plan must become an 8-unit target');
const manualMaterialOverride = parserContext.reportParser.manualMaterial(
  { item: parserContext.state.materialsByProject[parserProjectId][3] },
  'Купили панели из поликарбоната.',
  { manualAction: 'purchase', manualQuantityMode: 'delta_qty', manualQty: '5', manualUnit: 'м2' },
);
assert.equal(manualMaterialOverride.purchasedQty, 5, 'A manual material quantity must be applied within the plan');
assert.equal(manualMaterialOverride.reportUnit, 'м2', 'A manual unit must stay on the report without mutating the catalog');
assert.equal(manualMaterialOverride.actionEligible, true);
const blankManualMaterialOverride = parserContext.reportParser.manualMaterial(
  { item: parserContext.state.materialsByProject[parserProjectId][3] },
  'Купили панели из поликарбоната.',
  { manualAction: 'purchase', manualQuantityMode: 'delta_qty', manualQty: '', manualUnit: 'л' },
);
assert.equal(blankManualMaterialOverride.purchasedQty, 0, 'Choosing an action without a number must never invent the full planned quantity');
assert.equal(blankManualMaterialOverride.actionEligible, false);

const falsePurchaseDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Смонтировали розетки. Заказчик согласовал кабель ВВГ.',
});
const falsePurchaseMaterial = falsePurchaseDraft.materialMatches.find((entry) => Number(entry.item.id) === 601);
assert.ok(falsePurchaseMaterial, 'The mentioned material may remain a suggestion even without a ledger action');
assert.equal(falsePurchaseMaterial.actionEligible, false);
assert.equal(falsePurchaseMaterial.purchasedQty, 0);
assert.ok(Array.from(falsePurchaseDraft.unmatchedClauses).includes('Заказчик согласовал кабель ВВГ'));
assert.match(falsePurchaseDraft.text, /Заказчик согласовал кабель ВВГ/);
assert.doesNotMatch(falsePurchaseDraft.text, /Заказаны материалы: Кабель ВВГ/);

const falseReceiptDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Смонтировали розетки. Кабеля ВВГ достаточно.',
});
const falseReceiptMaterial = falseReceiptDraft.materialMatches.find((entry) => Number(entry.item.id) === 601);
assert.ok(falseReceiptMaterial);
assert.equal(falseReceiptMaterial.actionEligible, false);
assert.equal(falseReceiptMaterial.receivedQty, 0);
assert.ok(Array.from(falseReceiptDraft.unmatchedClauses).includes('Кабеля ВВГ достаточно'));
assert.match(falseReceiptDraft.text, /Кабеля ВВГ достаточно/);
assert.doesNotMatch(falseReceiptDraft.text, /Приняты на объекте: Кабель ВВГ/);

const explicitUnitWithInvalidCatalogDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Заказаны панели из поликарбоната 5 м2.',
});
const explicitUnitWithInvalidCatalogMaterial = explicitUnitWithInvalidCatalogDraft.materialMatches.find(
  (entry) => Number(entry.item.id) === 604,
);
assert.ok(explicitUnitWithInvalidCatalogMaterial, 'A material with a broken catalog unit must still be recognized');
assert.equal(explicitUnitWithInvalidCatalogMaterial.purchasedQty, 5);
assert.equal(explicitUnitWithInvalidCatalogMaterial.reportUnit, 'м2', 'The explicit dictated unit must be retained on the report row');
assert.match(explicitUnitWithInvalidCatalogDraft.text, /Панель из поликарбоната 5 м2/);
assert.doesNotMatch(explicitUnitWithInvalidCatalogDraft.text, /\?\?/, 'A broken catalog unit must not leak into generated report text');

const zeroActionDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Смонтировали розетки. Использовали кабель ВВГ.',
});
const zeroActionMaterial = zeroActionDraft.materialMatches.find((entry) => Number(entry.item.id) === 601);
assert.ok(zeroActionMaterial);
assert.equal(zeroActionMaterial.actionEligible, false);
assert.equal(zeroActionMaterial.semanticMatch, true);
assert.equal(zeroActionMaterial.usedQty, 0);
assert.deepEqual(Array.from(zeroActionDraft.unmatchedClauses), []);
assert.deepEqual(Array.from(zeroActionDraft.previewAdditionalClauses), []);
assert.match(zeroActionDraft.text, /По материалам зафиксировано: Использовали кабель ВВГ/);
assert.doesNotMatch(zeroActionDraft.text, /По материалам зафиксировано:[^.]*Смонтировали розетки/);
assert.doesNotMatch(zeroActionDraft.text, /Дополнительно зафиксировано/);

const ambiguousMaterialDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Заказали кабель.',
});
assert.equal(ambiguousMaterialDraft.materialMatches.length, 2);
assert.ok(ambiguousMaterialDraft.materialMatches.every((entry) => entry.ambiguous === true));
assert.deepEqual(Array.from(ambiguousMaterialDraft.unmatchedClauses), ['Заказали кабель']);
assert.deepEqual(Array.from(ambiguousMaterialDraft.previewAdditionalClauses), []);
assert.doesNotMatch(ambiguousMaterialDraft.text, /Кабель ВВГ|Кабель UTP/);

const ambiguousClauseKey = parserContext.reportParser.normalize('Заказали кабель');
const manuallyResolvedDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Заказали кабель.',
  material_choices_by_clause: { [ambiguousClauseKey]: 601 },
});
assert.equal(manuallyResolvedDraft.materialMatches.length, 1);
assert.equal(Number(manuallyResolvedDraft.materialMatches[0].item.id), 601);
assert.equal(manuallyResolvedDraft.materialMatches[0].ambiguous, false);
assert.equal(manuallyResolvedDraft.materialMatches[0].selectedManually, true);
assert.deepEqual(Array.from(manuallyResolvedDraft.unmatchedClauses), []);
assert.deepEqual(Array.from(manuallyResolvedDraft.previewAdditionalClauses), []);
assert.match(manuallyResolvedDraft.text, /Кабель ВВГ/);
assert.doesNotMatch(manuallyResolvedDraft.text, /Кабель UTP/);

const quantifiedWorkDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Смонтировали 5 шт розеток.',
});
assert.equal(quantifiedWorkDraft.workMatches.length, 1);
assert.equal(quantifiedWorkDraft.workMatches[0].actualQty, 5);
assert.equal(quantifiedWorkDraft.workMatches[0].quantityLabel, '5 шт');
assert.deepEqual(Array.from(quantifiedWorkDraft.previewAdditionalClauses), []);
assert.match(quantifiedWorkDraft.text, /Монтаж розеток — 5 шт/);

const manualMaterialClause = 'Кабель ВВГ';
const manualMaterialDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: `${manualMaterialClause}.`,
  material_choices_by_clause: { [parserContext.reportParser.normalize(manualMaterialClause)]: 601 },
});
assert.equal(manualMaterialDraft.materialMatches[0].selectedManually, true);
assert.deepEqual(Array.from(manualMaterialDraft.unmatchedClauses), []);
assert.deepEqual(Array.from(manualMaterialDraft.previewAdditionalClauses), []);
assert.match(manualMaterialDraft.text, /По материалам зафиксировано: Кабель ВВГ/);
assert.doesNotMatch(manualMaterialDraft.text, /Дополнительно зафиксировано/);

const manualWorkClause = 'Монтаж розеток';
const manualWorkDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: `${manualWorkClause}.`,
  work_choices_by_clause: { [parserContext.reportParser.normalize(manualWorkClause)]: 501 },
});
assert.equal(manualWorkDraft.workMatches[0].selectedManually, true);
assert.deepEqual(Array.from(manualWorkDraft.unmatchedClauses), []);
assert.deepEqual(Array.from(manualWorkDraft.previewAdditionalClauses), []);
assert.match(manualWorkDraft.text, /По работам зафиксировано: Монтаж розеток/);
assert.doesNotMatch(manualWorkDraft.text, /Дополнительно зафиксировано/);

const mixedConsumedDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Смонтировали 5 шт розеток. Использовали кабель ВВГ. Ждём электрика.',
});
assert.deepEqual(Array.from(mixedConsumedDraft.unmatchedClauses), ['Ждём электрика']);
assert.deepEqual(Array.from(mixedConsumedDraft.previewAdditionalClauses), ['Ждём электрика']);
assert.match(mixedConsumedDraft.text, /Монтаж розеток — 5 шт/);
assert.match(mixedConsumedDraft.text, /По материалам зафиксировано: Использовали кабель ВВГ/);
assert.match(mixedConsumedDraft.text, /Проблемы и ограничения: Ждём электрика/);
assert.equal((mixedConsumedDraft.text.match(/кабель ВВГ/gi) || []).length, 1);
assert.doesNotMatch(mixedConsumedDraft.text, /Дополнительно зафиксировано: Использовали кабель ВВГ/);

const materialActionAndNoteDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Купили кабель ВВГ 10 м. Кабель ВВГ плохого качества.',
});
const materialActionAndNote = materialActionAndNoteDraft.materialMatches.find((entry) => Number(entry.item.id) === 601);
assert.ok(materialActionAndNote);
assert.equal(materialActionAndNote.purchasedQty, 10);
assert.deepEqual(Array.from(materialActionAndNote.consumedClauseTexts), ['Купили кабель ВВГ 10 м']);
assert.deepEqual(Array.from(materialActionAndNoteDraft.unmatchedClauses), ['Кабель ВВГ плохого качества']);
assert.deepEqual(Array.from(materialActionAndNoteDraft.previewAdditionalClauses), ['Кабель ВВГ плохого качества']);
assert.match(materialActionAndNoteDraft.text, /Заказаны материалы: Кабель ВВГ 10 м/);
assert.match(materialActionAndNoteDraft.text, /Дополнительно зафиксировано: Кабель ВВГ плохого качества/);

const enumeratedMaterialDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Купили кабель ВВГ 10 м и розетки 5 шт.',
});
const enumeratedCable = enumeratedMaterialDraft.materialMatches.find((entry) => Number(entry.item.id) === 601);
const enumeratedSockets = enumeratedMaterialDraft.materialMatches.find((entry) => Number(entry.item.id) === 603);
assert.ok(enumeratedCable && enumeratedSockets, 'One purchase verb must apply to both explicitly quantified materials');
assert.equal(enumeratedCable.purchasedQty, 10);
assert.equal(enumeratedSockets.purchasedQty, 5);
assert.deepEqual(Array.from(enumeratedMaterialDraft.unmatchedClauses), []);
assert.match(enumeratedMaterialDraft.text, /Кабель ВВГ 10 м/);
assert.match(enumeratedMaterialDraft.text, /Розетки 5 шт/);

const enumeratedWorkDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Смонтировали 5 шт розеток и выключатели 3 шт.',
});
const enumeratedSocketsWork = enumeratedWorkDraft.workMatches.find((entry) => Number(entry.item.id) === 501);
const enumeratedSwitchesWork = enumeratedWorkDraft.workMatches.find((entry) => Number(entry.item.id) === 502);
assert.ok(enumeratedSocketsWork && enumeratedSwitchesWork, 'One work verb must apply to both explicitly quantified works');
assert.equal(enumeratedSocketsWork.actualQty, 5);
assert.equal(enumeratedSwitchesWork.actualQty, 3);
assert.match(enumeratedWorkDraft.text, /Монтаж розеток — 5 шт/);
assert.match(enumeratedWorkDraft.text, /Монтаж выключателей — 3 шт/);

const passiveEnumeratedMaterialDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Заказаны кабель ВВГ 10 м и розетки 5 шт.',
});
const passiveEnumeratedCable = passiveEnumeratedMaterialDraft.materialMatches.find((entry) => Number(entry.item.id) === 601);
const passiveEnumeratedSockets = passiveEnumeratedMaterialDraft.materialMatches.find((entry) => Number(entry.item.id) === 603);
assert.ok(passiveEnumeratedCable && passiveEnumeratedSockets, 'A passive purchase verb must be inherited by each quantified material');
assert.equal(passiveEnumeratedCable.purchasedQty, 10);
assert.equal(passiveEnumeratedSockets.purchasedQty, 5);

const passiveEnumeratedWorkDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Смонтированы 5 шт розеток и выключатели 3 шт.',
});
const passiveEnumeratedSocketsWork = passiveEnumeratedWorkDraft.workMatches.find((entry) => Number(entry.item.id) === 501);
const passiveEnumeratedSwitchesWork = passiveEnumeratedWorkDraft.workMatches.find((entry) => Number(entry.item.id) === 502);
assert.ok(passiveEnumeratedSocketsWork && passiveEnumeratedSwitchesWork, 'A passive work verb must be inherited by each quantified work');
assert.equal(passiveEnumeratedSocketsWork.actualQty, 5);
assert.equal(passiveEnumeratedSwitchesWork.actualQty, 3);

const inlineMaterialNoteDraft = parserContext.reportParser.build(parserProjectId, {
  raw_input: 'Купили кабель ВВГ 10 м, он повреждён.',
});
assert.deepEqual(Array.from(inlineMaterialNoteDraft.unmatchedClauses), ['он повреждён']);
assert.match(inlineMaterialNoteDraft.text, /Кабель ВВГ 10 м/);
assert.match(inlineMaterialNoteDraft.text, /Дополнительно зафиксировано: он повреждён/i);

const quantitativeWorkProjectId = 43;
parserContext.state.sectionScheduleByProject[quantitativeWorkProjectId] = {
  sections: [{
    title: 'Отделка',
    items: [{ id: 701, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, actualQty: 0, unit: 'м2' }],
  }],
};
parserContext.state.materialsByProject[quantitativeWorkProjectId] = [];

function oneQuantitativeWork(rawInput, extraPayload = {}) {
  const draft = parserContext.reportParser.build(quantitativeWorkProjectId, {
    raw_input: rawInput,
    ...extraPayload,
  });
  assert.equal(draft.workMatches.length, 1, `Expected one work match for: ${rawInput}`);
  return draft.workMatches[0];
}

const fortyOfSeventyWork = oneQuantitativeWork('Сделали облицовку 40 из 70 м2.');
assert.equal(fortyOfSeventyWork.quantityMode, 'target_qty');
assert.equal(fortyOfSeventyWork.quantityValue, 40);
assert.equal(fortyOfSeventyWork.actualQty, 40, 'The numerator in "40 из 70" is the completed quantity');
assert.equal(fortyOfSeventyWork.partial, true);
assert.equal(fortyOfSeventyWork.done, false);

const fortyPercentWork = oneQuantitativeWork('Готово 40% облицовки стен.');
assert.equal(fortyPercentWork.quantityMode, 'target_percent');
assert.equal(fortyPercentWork.quantityValue, 40);
assert.equal(fortyPercentWork.actualQty, 28, '40% of the 70 m2 plan must become a 28 m2 target');
assert.equal(fortyPercentWork.partial, true);

const halfWork = oneQuantitativeWork('Выполнена половина облицовки стен.');
assert.equal(halfWork.quantityMode, 'target_percent');
assert.equal(halfWork.quantityValue, 50);
assert.equal(halfWork.actualQty, 35, 'Half of the 70 m2 plan must become a 35 m2 target');
assert.equal(halfWork.partial, true);

const qualitativePartialWork = oneQuantitativeWork('Частично выполнили облицовку стен.');
assert.equal(qualitativePartialWork.actualQty, 0, 'A qualitative partial statement must not invent half of the plan');
assert.equal(qualitativePartialWork.quantityMode, 'delta_qty');
assert.equal(qualitativePartialWork.quantityValue, 0);
assert.equal(qualitativePartialWork.actionEligible, false, 'A qualitative partial statement must remain report-only until a quantity is supplied');
assert.equal(qualitativePartialWork.partial, true);

const damagedPartialWorkDraft = parserContext.reportParser.build(quantitativeWorkProjectId, {
  raw_input: 'Повреждена часть облицовки стен.',
});
assert.equal(damagedPartialWorkDraft.workMatches.length, 0, 'A damage note containing «часть» must not become completed work');
assert.deepEqual(Array.from(damagedPartialWorkDraft.unmatchedClauses), ['Повреждена часть облицовки стен']);
assert.match(damagedPartialWorkDraft.text, /Повреждена часть облицовки стен/);

const explicitDeltaWork = oneQuantitativeWork('Сделали 40 м2 облицовки стен.');
assert.equal(explicitDeltaWork.quantityMode, 'delta_qty');
assert.equal(explicitDeltaWork.quantityValue, 40);
assert.equal(explicitDeltaWork.actualQty, 40);
assert.equal(explicitDeltaWork.partial, true);

const combinedDeltaWork = oneQuantitativeWork('Сделали 10 м2 облицовки стен. Дополнительно сделали 5 м2 облицовки стен.');
assert.equal(combinedDeltaWork.quantityMode, 'delta_qty');
assert.equal(combinedDeltaWork.actualQty, 15, 'Two quantities for the same work in one report must be added');

const partialMaterialProjectId = 45;
parserContext.state.sectionScheduleByProject[partialMaterialProjectId] = { sections: [] };
parserContext.state.materialsByProject[partialMaterialProjectId] = [{
  id: 901,
  title: 'Плитка фасадная',
  itemKind: 'material',
  plannedQty: 70,
  unit: 'м2',
  purchasedQty: 20,
  receivedQty: 0,
  usedQty: 0,
  stockBalanceQty: 0,
}];
const halfMaterialDraft = parserContext.reportParser.build(partialMaterialProjectId, {
  raw_input: 'Закупили половину плитки фасадной.',
});
assert.equal(halfMaterialDraft.materialMatches.length, 1);
assert.equal(halfMaterialDraft.materialMatches[0].purchasedQty, 15, 'Half means a 35/70 target, so only 15 remains after the existing 20');
const fortyPercentMaterialDraft = parserContext.reportParser.build(partialMaterialProjectId, {
  raw_input: 'Закупили 40% плитки фасадной.',
});
assert.equal(fortyPercentMaterialDraft.materialMatches[0].purchasedQty, 8, '40% means a 28/70 target, so only 8 remains after the existing 20');
const deltaMaterialDraft = parserContext.reportParser.build(partialMaterialProjectId, {
  raw_input: 'Закупили 10 м2 плитки фасадной.',
});
assert.equal(deltaMaterialDraft.materialMatches[0].purchasedQty, 10, 'An explicit quantity without a target phrase remains a delta');
const qualitativePartialMaterialDraft = parserContext.reportParser.build(partialMaterialProjectId, {
  raw_input: 'Закупили часть плитки фасадной.',
});
assert.equal(qualitativePartialMaterialDraft.materialMatches[0].purchasedQty, 0, 'A qualitative material portion must not invent 50% or the full remainder');
assert.equal(qualitativePartialMaterialDraft.materialMatches[0].actionEligible, false, 'A qualitative material portion must not create a ledger action without a quantity');
assert.equal(qualitativePartialMaterialDraft.materialMatches[0].semanticMatch, true, 'A qualitative material portion must remain grouped with materials');
assert.deepEqual(Array.from(qualitativePartialMaterialDraft.unmatchedClauses), []);
assert.deepEqual(Array.from(qualitativePartialMaterialDraft.previewAdditionalClauses), []);
assert.match(qualitativePartialMaterialDraft.text, /Закупили часть плитки фасадной/);
const fortyOfSeventyMaterialDraft = parserContext.reportParser.build(partialMaterialProjectId, {
  raw_input: 'Закупили 40 из 70 м2 плитки фасадной.',
});
assert.equal(fortyOfSeventyMaterialDraft.materialMatches[0].purchasedQty, 20, '40 of 70 is a target total, so only 20 remains after the existing 20');
const repeatedMaterialTargetsDraft = parserContext.reportParser.build(partialMaterialProjectId, {
  raw_input: 'Закупили 30% плитки фасадной. Затем закупили 50% плитки фасадной.',
});
assert.equal(repeatedMaterialTargetsDraft.materialMatches[0].purchasedQty, 15, 'Multiple targets for one material must advance to the highest sequential target instead of summing deltas from the original base');
const deltaThenMaterialTargetDraft = parserContext.reportParser.build(partialMaterialProjectId, {
  raw_input: 'Закупили 10 м2 плитки фасадной. Затем закупили 40 из 70 м2 плитки фасадной.',
});
assert.equal(deltaThenMaterialTargetDraft.materialMatches[0].purchasedQty, 20, 'A later absolute target must replace earlier progress below that target, not be added to it');

const progressedWorkProjectId = 46;
parserContext.state.sectionScheduleByProject[progressedWorkProjectId] = {
  sections: [{
    title: 'Отделка',
    items: [{ id: 951, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, actualQty: 20, unit: 'м2' }],
  }],
};
parserContext.state.materialsByProject[progressedWorkProjectId] = [];
const repeatedWorkTargetsDraft = parserContext.reportParser.build(progressedWorkProjectId, {
  raw_input: 'Сделали облицовку 30 из 70 м2. Затем сделали облицовку 40 из 70 м2.',
});
assert.equal(repeatedWorkTargetsDraft.workMatches.length, 1);
assert.equal(repeatedWorkTargetsDraft.workMatches[0].quantityMode, 'delta_qty');
assert.equal(repeatedWorkTargetsDraft.workMatches[0].actualQty, 20, 'Existing 20 must advance only to the final 40 target');

const cappedDeltaWorkProjectId = 47;
parserContext.state.sectionScheduleByProject[cappedDeltaWorkProjectId] = {
  sections: [{
    title: 'Отделка',
    items: [{ id: 971, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, actualQty: 60, unit: 'м2' }],
  }],
};
parserContext.state.materialsByProject[cappedDeltaWorkProjectId] = [];
const cappedDeltaWorkDraft = parserContext.reportParser.build(cappedDeltaWorkProjectId, {
  raw_input: 'Сделали 40 м2 облицовки стен.',
});
assert.equal(cappedDeltaWorkDraft.workMatches.length, 1);
assert.equal(cappedDeltaWorkDraft.workMatches[0].quantityMode, 'delta_qty');
assert.equal(cappedDeltaWorkDraft.workMatches[0].requestedQty, 40);
assert.equal(cappedDeltaWorkDraft.workMatches[0].actualQty, 10, 'At 60/70 an automatic shift delta must be limited to the remaining 10');
assert.equal(cappedDeltaWorkDraft.workMatches[0].resultActualQty, 70);
assert.equal(cappedDeltaWorkDraft.workMatches[0].done, true);
assert.equal(cappedDeltaWorkDraft.workMatches[0].partial, false);
assert.match(cappedDeltaWorkDraft.text, /10 м2 за смену \(всего 70 из 70 м2, план выполнен\)/);
assert.doesNotMatch(cappedDeltaWorkDraft.text, /40 м2/, 'The generated text must describe the applied delta instead of the rejected excess');
const belowCurrentPercentDraft = parserContext.reportParser.build(cappedDeltaWorkProjectId, {
  raw_input: 'Готово 50% облицовки стен.',
});
assert.equal(belowCurrentPercentDraft.workMatches[0].actualQty, 60);
assert.ok(Math.abs(belowCurrentPercentDraft.workMatches[0].quantityValue - (60 / 70 * 100)) < 1e-9);
assert.equal(belowCurrentPercentDraft.workMatches[0].actionEligible, false);
assert.doesNotMatch(belowCurrentPercentDraft.text, /50%/, 'Automatic percent recognition must not report progress below the stored fact');
assert.match(belowCurrentPercentDraft.text, /60 м2 из 70 м2/);

const noPlanWorkProjectId = 48;
parserContext.state.sectionScheduleByProject[noPlanWorkProjectId] = {
  sections: [{
    title: 'Дополнительные работы',
    items: [{ id: 981, title: 'Монтаж креплений', plannedQty: 0, planned_qty: 0, unit: 'шт' }],
  }],
};
parserContext.state.materialsByProject[noPlanWorkProjectId] = [];
const noPlanWorkDraft = parserContext.reportParser.build(noPlanWorkProjectId, {
  raw_input: 'Сделали монтаж креплений 5 шт.',
});
assert.equal(noPlanWorkDraft.workMatches.length, 1);
assert.equal(noPlanWorkDraft.workMatches[0].actualQty, 5, 'An automatically recognized no-plan work must retain its volume');
assert.equal(noPlanWorkDraft.workMatches[0].actionEligible, false);
assert.match(noPlanWorkDraft.text, /5 шт за смену/);

const ambiguousWorkProjectId = 44;
parserContext.state.sectionScheduleByProject[ambiguousWorkProjectId] = {
  sections: [
    {
      title: 'Этаж 1',
      items: [{ id: 801, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, actualQty: 0, unit: 'м2' }],
    },
    {
      title: 'Этаж 2',
      items: [{ id: 802, title: 'Облицовка стен', plannedQty: 70, planned_qty: 70, actualQty: 0, unit: 'м2' }],
    },
  ],
};
parserContext.state.materialsByProject[ambiguousWorkProjectId] = [];
const ambiguousWorkText = 'Сделали облицовку стен 40 м2.';
const ambiguousWorkDraft = parserContext.reportParser.build(ambiguousWorkProjectId, {
  raw_input: ambiguousWorkText,
});
assert.equal(ambiguousWorkDraft.workMatches.length, 2);
assert.ok(ambiguousWorkDraft.workMatches.every((entry) => entry.ambiguous === true));
assert.ok(
  ambiguousWorkDraft.workMatches.every((entry) => entry.actionEligible === false),
  'Tied work matches must never produce an applicable progress action',
);

const ambiguousWorkClauseKey = parserContext.reportParser.normalize(ambiguousWorkText.replace(/\.$/, ''));
const manuallyResolvedWorkDraft = parserContext.reportParser.build(ambiguousWorkProjectId, {
  raw_input: ambiguousWorkText,
  work_choices_by_clause: { [ambiguousWorkClauseKey]: 801 },
});
assert.equal(manuallyResolvedWorkDraft.workMatches.length, 1);
assert.equal(Number(manuallyResolvedWorkDraft.workMatches[0].item.id), 801);
assert.equal(manuallyResolvedWorkDraft.workMatches[0].selectedManually, true);
assert.equal(manuallyResolvedWorkDraft.workMatches[0].ambiguous, false);
assert.equal(manuallyResolvedWorkDraft.workMatches[0].actionEligible, true);
assert.equal(manuallyResolvedWorkDraft.workMatches[0].actualQty, 40);
assert.equal(manuallyResolvedWorkDraft.workMatches[0].partial, true);
assert.equal(manuallyResolvedWorkDraft.workMatches[0].done, false);

const confirmedActionsStart = operationsJs.indexOf('function reportConfirmedActions(');
const confirmedActionsEnd = operationsJs.indexOf('function reportActionErrorMessage(', confirmedActionsStart);
assert.ok(confirmedActionsStart > -1 && confirmedActionsEnd > confirmedActionsStart, 'Confirmed report actions must be extractable');
const confirmedActionsSource = operationsJs.slice(confirmedActionsStart, confirmedActionsEnd);
assert.match(confirmedActionsSource, /work_progress/, 'Confirmed actions must allow an audited work-progress action');

const reportPreviewStart = appJs.lastIndexOf('renderReportPreviewHtml = function');
const reportPreviewEnd = appJs.indexOf('renderProjectReportForm = function', reportPreviewStart);
assert.ok(reportPreviewStart > -1 && reportPreviewEnd > reportPreviewStart, 'The final report preview must be extractable');
const reportPreviewSource = appJs.slice(reportPreviewStart, reportPreviewEnd);
assert.match(reportPreviewSource, /report-action-staging-inner/);
assert.doesNotMatch(reportPreviewSource, /report-effect-metrics|Из отчёта|Итого/);
assert.match(reportPreviewSource, /work_progress/, 'Work rows in the preview must expose a work_progress effect');
assert.match(reportPreviewSource, /reportEntryQuantityUnit\(entry\)/, 'Report effect rows must use the sanitized report unit');
assert.match(appJs, /var safeUnit = suggestion\.kind === 'material' \? reportSafeQuantityUnit\(item\.unit\) : '';/, 'Material suggestions must hide invalid catalog units');

const legacyReportWord = /\u0440\u0430\u043f\u043e\u0440\u0442/i;
assert.equal(legacyReportWord.test(operationsJs), false, 'Operations UI must consistently use the word Отчет');
assert.equal(legacyReportWord.test(appJs), false, 'App UI must consistently use the word Отчет');
assert.equal(legacyReportWord.test(projectsHtml), false, 'Projects page must consistently use the word Отчёты');
assert.match(projectsHtml, /data-tab="reports"[^>]*>[\s\S]*?<span>Журнал<\/span>/);
assert.match(projectsHtml, /class="project-report-primary"[^>]*data-project-quick-action="report"/);
assert.match(projectsHtml, /class="project-mobile-capture"[\s\S]*?data-project-quick-action="report"/);
assert.match(projectsHtml, /data-project-quick-action="report" data-report-start-voice/);

assert.match(routerJs, /operations\.js\?v=[^']*project-report-modal-1/);
assert.match(routerJs, /operations\.js\?v=[^']*report-modal-cool-2/);
assert.match(routerJs, /operations\.js\?v=[^']*report-modal-native-3/);
assert.match(routerJs, /operations\.js\?v=[^']*report-create-plus-5/);
assert.match(routerJs, /operations\.js\?v=[^']*report-submit-fix-6/);
assert.match(routerJs, /operations\.js\?v=[^']*reports-wording-7/);
assert.match(routerJs, /app\.js\?v=[^']*reports-wording-7/);
assert.match(routerJs, /operations\.js\?v=[^']*report-refresh-8/);
assert.match(routerJs, /app\.js\?v=[^']*report-refresh-8/);
assert.match(routerJs, /operations\.js\?v=[^']*report-calendar-9/);
assert.match(routerJs, /operations\.js\?v=[^']*report-calendar-apple-10/);
assert.match(routerJs, /app\.js\?v=[^']*report-calendar-bridge-11/);
assert.match(routerJs, /operations\.js\?v=[^']*report-load-12/);
assert.match(routerJs, /app\.js\?v=[^']*report-live-suggestions-16/);
assert.match(routerJs, /operations\.js\?v=[^']*report-live-suggestions-16/);
assert.match(routerJs, /operations\.js\?v=[^']*report-entry-hierarchy-17/);
assert.match(routerJs, /operations\.js\?v=[^']*report-action-history-18/);
assert.match(routerJs, /app\.js\?v=[^']*report-action-history-18/);
assert.match(routerJs, /app\.js\?v=[^']*report-voice-feedback-20/);
assert.match(routerJs, /operations\.js\?v=[^']*report-icon-minimal-32/);
assert.match(routerJs, /app\.js\?v=[^']*report-icon-minimal-32/);
assert.match(routerJs, /operations\.js\?v=[^']*report-sheet-minimal-34/);
assert.match(routerJs, /app\.js\?v=[^']*report-sheet-minimal-34/);
assert.match(routerJs, /operations\.js\?v=[^']*report-final-structured-36/);
assert.match(routerJs, /app\.js\?v=[^']*report-final-structured-36/);
assert.match(routerJs, /operations\.js\?v=[^']*report-saved-structured-37/);
assert.match(routerJs, /app\.js\?v=[^']*report-saved-structured-37/);

const runtimeNodes = {
  '[data-panel="reports"] .report-workspace': {},
  '[data-panel="reports"] [data-logs-day-view]': { innerHTML: '' },
  '[data-panel="reports"] [data-logs-list]': { innerHTML: '' },
  '[data-report-action-count]': { textContent: '' },
};
const runtimeEscapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
const runtimeState = {
  logsSelectedDateByProject: { 42: '2026-08-24' },
  logsCalendarMonthByProject: {},
  projectLogsByProject: {},
  selectedProject: { id: 42, title: 'Тестовый объект' },
};
const runtimeWindow = {
  PMBI: {
    page: 'projects',
    APP_TODAY: '2026-08-26',
    state: runtimeState,
    qs: (selector) => runtimeNodes[selector] || null,
    qsa: () => [],
    safeReplaceChildren: (node, html) => { node.innerHTML = html; },
    refreshLucideIcons() {},
    escapeHtml: runtimeEscapeHtml,
    formatRuDate: (value) => String(value || ''),
    hasRole: (role) => role === 'guest',
    app: {
      finalGraphDate: (value) => String(value || ''),
      logsMonthStartIso: (value) => String(value || '').slice(0, 7) + '-01',
      reportAuthorInitials: (value) => String(value || '?').slice(0, 2).toUpperCase(),
      reportCreatedDateTime: (log) => `time-${log.id}`,
      reportLogStatus: () => ({ kind: 'success', label: 'В порядке' }),
    },
  },
};
runtimeWindow.window = runtimeWindow;
vm.runInNewContext(operationsJs, { window: runtimeWindow, console, setTimeout, clearTimeout }, { filename: 'operations.js' });

const mixedRuntimeLogs = [
  { id: 9, report_date: '2026-08-24', created_at: 100, entry_kind: 'section_progress', work_done: 'Действие девять', author_name: 'Система' },
  { id: 1, report_date: '2026-08-24', created_at: 90, entry_kind: 'field_report', work_done: 'Ручной отчёт выбранного дня', author_name: 'Прораб' },
  { id: 20, report_date: '2026-08-25', created_at: 200, entry_kind: 'section_progress', work_done: 'Самое новое действие', author_name: 'Система' },
  { id: 10, report_date: '2026-08-24', created_at: 100, entry_kind: 'section_progress', work_done: 'Действие десять', author_name: 'Система' },
  { id: 2, report_date: '2026-08-23', created_at: 80, entry_kind: 'field_report', work_done: 'Другой ручной отчёт', author_name: 'Прораб' },
];
const runtimeOperations = runtimeWindow.PMBI.operations;
runtimeOperations.renderLogsDayView({ id: 42, title: 'Тестовый объект' }, mixedRuntimeLogs);
assert.match(runtimeNodes['[data-panel="reports"] [data-logs-day-view]'].innerHTML, /Ручной отчёт выбранного дня/);
assert.doesNotMatch(runtimeNodes['[data-panel="reports"] [data-logs-day-view]'].innerHTML, /Действие девять|Действие десять/);
assert.match(runtimeNodes['[data-panel="reports"] [data-logs-day-view]'].innerHTML, /aria-label="Отчетов за день: 1"/);

runtimeState.logsSelectedDateByProject[42] = '2026-08-25';
runtimeOperations.renderLogsDayView({ id: 42, title: 'Тестовый объект' }, mixedRuntimeLogs);
assert.match(runtimeNodes['[data-panel="reports"] [data-logs-day-view]'].innerHTML, /За этот день отчёта нет/);
assert.match(runtimeNodes['[data-panel="reports"] [data-logs-day-view]'].innerHTML, /aria-label="Отчетов за день: 0"/);
assert.doesNotMatch(runtimeNodes['[data-panel="reports"] [data-logs-day-view]'].innerHTML, /Самое новое действие/);

runtimeOperations.renderLogsList({ id: 42, title: 'Тестовый объект' }, mixedRuntimeLogs);
const runtimeActionsHtml = runtimeNodes['[data-panel="reports"] [data-logs-list]'].innerHTML;
assert.doesNotMatch(runtimeActionsHtml, /Ручной отчёт выбранного дня|Другой ручной отчёт/);
assert.match(runtimeActionsHtml, /Самое новое действие/);
assert.match(runtimeActionsHtml, /Действие десять/);
assert.match(runtimeActionsHtml, /Действие девять/);
assert.equal(runtimeNodes['[data-report-action-count]'].textContent, '3 действия');
assert.ok(runtimeActionsHtml.indexOf('Самое новое действие') < runtimeActionsHtml.indexOf('Действие десять'));
assert.ok(runtimeActionsHtml.indexOf('Действие десять') < runtimeActionsHtml.indexOf('Действие девять'));

const runtimePanelHtml = runtimeOperations.renderProjectReportsPanel({ id: 42, title: 'Тестовый объект' });
assert.match(runtimePanelHtml, /<details class="report-actions-history" data-report-actions-history>/);
assert.doesNotMatch(runtimePanelHtml, /<details class="report-actions-history"[^>]*\sopen(?:\s|=|>)/);

const voiceBlockStart = appJs.indexOf('var reportVoiceState = {');
const voiceBlockEnd = appJs.indexOf('function reportAuthorInitials', voiceBlockStart);
assert.ok(voiceBlockStart > -1 && voiceBlockEnd > voiceBlockStart, 'The report voice block must be extractable');
const voiceBlock = appJs.slice(voiceBlockStart, voiceBlockEnd);

function reportVoiceRuntime(isSecureContext) {
  let toast = null;
  const recognitionInstances = [];
  const classList = () => {
    const values = new Set();
    return {
      add(name) { values.add(name); },
      remove(name) { values.delete(name); },
      toggle(name, force) {
        if (force) values.add(name);
        else values.delete(name);
      },
      contains(name) { return values.has(name); },
    };
  };
  function Recognition() {
    recognitionInstances.push(this);
  }
  Recognition.prototype.start = function start() { this.started = true; };
  Recognition.prototype.stop = function stop() { this.stopped = true; };
  const documentStub = {
    activeElement: null,
    body: { appendChild(node) { toast = node; } },
    createElement() {
      return { className: '', textContent: '', classList: classList(), setAttribute() {} };
    },
  };
  const context = {
    window: { isSecureContext, SpeechRecognition: Recognition },
    document: documentStub,
    qs(selector) { return selector === '[data-report-voice-toast]' ? toast : null; },
    qsa() { return []; },
    Event: function Event(type, init) { this.type = type; this.bubbles = Boolean(init && init.bubbles); },
    console: { warn() {} },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
  };
  vm.runInNewContext(
    `${voiceBlock}\nthis.__reportVoice = { start: startReportVoiceRecognition };`,
    context,
    { filename: 'report-voice-runtime.js' },
  );
  return {
    api: context.__reportVoice,
    document: documentStub,
    instances: recognitionInstances,
    toast: () => toast,
    classList,
  };
}

function reportVoiceInput(runtime, value = '') {
  return {
    value,
    dispatched: 0,
    focus() { runtime.document.activeElement = this; },
    dispatchEvent() { this.dispatched += 1; },
  };
}

function reportVoiceButton(runtime) {
  return {
    classList: runtime.classList(),
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

const insecureVoice = reportVoiceRuntime(false);
insecureVoice.api.start(reportVoiceInput(insecureVoice), reportVoiceButton(insecureVoice));
assert.equal(insecureVoice.instances.length, 0, 'Dictation must not attempt microphone capture over public HTTP');
assert.match(insecureVoice.toast().textContent, /HTTPS/);

const workingVoice = reportVoiceRuntime(true);
const workingVoiceInput = reportVoiceInput(workingVoice, 'Выполнили');
const workingVoiceButton = reportVoiceButton(workingVoice);
workingVoice.api.start(workingVoiceInput, workingVoiceButton);
assert.equal(workingVoice.instances.length, 1);
assert.equal(workingVoice.instances[0].started, true);
workingVoice.instances[0].onresult({ results: [{ 0: { transcript: 'монтаж стен' } }] });
assert.equal(workingVoiceInput.value, 'Выполнили монтаж стен');
assert.equal(workingVoiceInput.dispatched, 1);
workingVoice.instances[0].onerror({ error: 'network' });
assert.match(workingVoice.toast().textContent, /Проверьте интернет/);
assert.equal(workingVoice.instances[0].stopped, true);

console.log('project_reports_frontend_ok');
