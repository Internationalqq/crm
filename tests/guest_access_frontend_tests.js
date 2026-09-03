const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const loginHtml = read('frontend/templates/login.html');
const welcomeHtml = read('frontend/templates/welcome.html');
const baseHtml = read('frontend/templates/base.html');
const usersHtml = read('frontend/pages/users.html');
const appCss = read('frontend/assets/app.css');
const coreJs = read('frontend/assets/js/core.js');
const appJs = read('frontend/assets/js/app.js');
const routerJs = read('frontend/assets/js/router.js');
const operationsJs = read('frontend/assets/js/operations.js');
const planningJs = read('frontend/assets/js/planning.js');
const projectsCss = read('frontend/assets/css/projects.css');
const uiFinalCss = read('frontend/assets/css/ui-final.css');
const publicEntryCss = read('frontend/assets/css/public-entry.css');
const guestAccessCss = read('frontend/assets/css/guest-access.css');

assert.doesNotMatch(loginHtml, /data-guest-login|Войти как гость/);
assert.doesNotMatch(appJs, /function bindGuestLogin|api\('\/api\/auth\/guest'/);
assert.doesNotMatch(loginHtml, /login-guest-panel|Смотреть объекты без входа/);
assert.match(welcomeHtml, /class="public-entry-window"/);
assert.match(welcomeHtml, /href="\{\{login_path\}\}"[^>]*data-public-login/);
assert.doesNotMatch(welcomeHtml, /data-project-id|data-login-guest-view/);
assert.match(publicEntryCss, /\.public-entry-window/);
assert.match(baseHtml, /class="\{\{body_class\}\}" data-page="\{\{page\}\}"/);
assert.match(baseHtml, /class="topbar-logout-action" type="button" data-logout/);
assert.match(appJs, /function renderTopbarTemplate\(\) \{\s*if \(isGuestRole\(\) \|\| document\.body\.classList\.contains\('role-guest'\)\) \{[\s\S]*?class="topbar-logout-action"[\s\S]*?data-logout/);
assert.match(appJs, /loadCurrentUser\(\{ silentLoader: true, force: true \}\)[\s\S]*?user\.isGuest[\s\S]*?'\/app\/projects'/);
assert.match(uiFinalCss, /\.topbar-logout-action/);
assert.match(uiFinalCss, /body\.role-guest \.topbar-profile-wrap/);
assert.match(uiFinalCss, /body\.role-guest \.sidebar[\s\S]*?display:\s*none\s*!important/);
assert.match(uiFinalCss, /body\.role-guest \.main[\s\S]*?margin-left:\s*0\s*!important/);
assert.match(baseHtml, /class="guest-topbar-brand" href="\/app\/projects"/);
assert.match(baseHtml, /router\.js\?v=20260903-report-ux-r1/);
assert.match(routerJs, /app: '[^'\s]*credential-guest-22[^'\s]*'/);
assert.match(routerJs, /operations: '[^'\s]*credential-guest-22[^'\s]*'/);
assert.doesNotMatch(loginHtml, /\/assets\/(?:app\.css|js\/app\.js)(?:\?|["'])/);
assert.match(loginHtml, /<a class="login-brand" href="\/" data-login-home aria-label="[^"]+">[\s\S]*?<strong>PM\.bi<\/strong>[\s\S]*?<\/a>/);
assert.match(loginHtml, /<form data-login-form>[\s\S]*?name="login"[\s\S]*?name="password" type="password"[\s\S]*?<button type="submit">/);
assert.match(loginHtml, /Введите выданный логин и пароль/);
assert.match(appCss, /guest-access\.css\?v=20260826-guest-access-modal-fix-2/);
assert.match(uiFinalCss, /\.login-brand \{[\s\S]*?linear-gradient[\s\S]*?box-shadow:/);
assert.match(uiFinalCss, /\.login-brand img \{[\s\S]*?width:\s*74px/);
assert.match(uiFinalCss, /\.login-brand strong \{[\s\S]*?font-size:\s*clamp\(/);

const loginStart = appJs.indexOf('function initLogin()');
const loginEnd = appJs.indexOf('function logoutCurrentUser()', loginStart);
assert.ok(loginStart > -1 && loginEnd > loginStart);
const loginBlock = appJs.slice(loginStart, loginEnd);
assert.match(loginBlock, /api\('\/api\/auth\/login'/);
assert.match(loginBlock, /login: form\.login\.value\.trim\(\)/);
assert.match(loginBlock, /password: form\.password\.value/);
assert.match(loginBlock, /user\.isGuest[\s\S]*?'\/app\/projects'[\s\S]*?nextPath\(\)/);

const logoutStart = appJs.indexOf('function logoutCurrentUser()');
const logoutEnd = appJs.indexOf('function bindLogoutButtons()', logoutStart);
assert.ok(logoutStart > -1 && logoutEnd > logoutStart);
const logoutBlock = appJs.slice(logoutStart, logoutEnd);
assert.match(logoutBlock, /var publicLandingPath = '\/'/);
assert.match(logoutBlock, /location\.replace\(publicLandingPath\)/);
assert.doesNotMatch(logoutBlock, /\/login|\.finally\(/);

assert.match(usersHtml, /data-guest-access-container/);
assert.match(usersHtml, /data-user-create-container/);
assert.match(operationsJs, /function setupGuestAccessManagement\(\)/);
assert.match(operationsJs, /Добавить гостевой доступ/);
assert.match(operationsJs, /button\.className = 'ghost guest-access-trigger'/);
assert.match(operationsJs, /document\.body\.classList\.add\('guest-access-modal-open'\)/);
assert.match(operationsJs, /document\.body\.classList\.remove\('guest-access-modal-open'\)/);
assert.match(operationsJs, /data-guest-access-project/);
assert.match(operationsJs, /function loadGuestAccessProjects\(modal\)[\s\S]*?loadProjects\(function \(\)[\s\S]*?renderGuestAccessProjectOptions\(modal/);
assert.match(appJs, /PMBI\.app\.loadProjects = loadProjects/);
assert.match(appJs, /classList\.remove\([^\n]*'guest-access-modal-open'/);
assert.match(appJs, /qsa\('\[data-guest-access-modal\]'\)[\s\S]*?modal\.remove\(\)/);
const guestModalOpenStart = operationsJs.indexOf('function openGuestAccessModal(event)');
const guestModalOpenEnd = operationsJs.indexOf('function closeGuestAccessModal()', guestModalOpenStart);
assert.ok(guestModalOpenStart > -1 && guestModalOpenEnd > guestModalOpenStart);
assert.match(operationsJs.slice(guestModalOpenStart, guestModalOpenEnd), /loadGuestAccessProjects\(modal\)/);
assert.match(operationsJs, /api\('\/api\/users\/guest-access'/);
assert.match(operationsJs, /JSON\.stringify\(\{ projectId: projectId \}\)/);
assert.match(operationsJs, /Сохраните реквизиты сейчас: пароль показывается только один раз/);
assert.match(operationsJs, /function scrubGuestAccessCredentials\(modal\)/);
assert.match(operationsJs, /navigator\.clipboard\.writeText/);
assert.match(operationsJs, /code !== 'admin' && code !== 'guest'/);
assert.match(operationsJs, /\{ key: 'guest', title: 'Гостевые доступы' \}/);
assert.match(operationsJs, /canManageTeam\(\) && !guestAccount/);
assert.doesNotMatch(operationsJs, /(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:credentials|password)/i);
assert.match(guestAccessCss, /\.guest-access-modal/);
assert.match(guestAccessCss, /\.guest-access-credentials/);
assert.match(guestAccessCss, /\.guest-access-trigger\s*\{/);
assert.match(guestAccessCss, /body\.guest-access-modal-open\s*\{[\s\S]*?overflow:\s*hidden/);
assert.doesNotMatch(guestAccessCss, /(?:^|\})\s*\.guest-access-modal-open\s*\{/m);

assert.match(coreJs, /function isGuestRole\(\)/);
assert.match(coreJs, /if \(isGuestRole\(\)\) return \['projects'\]/);
assert.match(appJs, /\['reports', 'production-schedule'\]\.indexOf\(tabName\) === -1/);
assert.match(appJs, /if \(isGuestRole\(\)\) \{[\s\S]*?refreshProjectReportsTab\(project\.id, loadingToken\);[\s\S]*?return;/);
assert.match(appJs, /if \(!isGuestRole\(\)\) checkDailyStandup\(\)/);
assert.match(appJs, /if \(!isGuestRole\(\)\) refreshReminderBell\(\)/);
assert.match(appJs, /data-project-quick-tab="reports"/);
assert.match(appJs, /data-project-quick-tab="production-schedule"/);
assert.match(projectsCss, /body\.role-guest\[data-page="projects"\] \.projects-card-grid[\s\S]*?minmax\(min\(100%,\s*480px\),\s*1fr\)/);
assert.match(projectsCss, /\.guest-project-action\.is-production/);

assert.match(operationsJs, /return !hasRole\('customer'\) && !hasRole\('guest'\)/);
assert.match(operationsJs, /if \(hasRole\('guest'\)\) \{[\s\S]*?renderLogsList\(project, logs\);[\s\S]*?return;/);
assert.match(planningJs, /var isMainAdminRole = PMBI\.isMainAdminRole;/);
assert.match(planningJs, /var guestView = hasRole\('guest'\)/);
assert.match(planningJs, /guestView[\s\S]*?Только просмотр/);
assert.match(planningJs, /canEditSchedule \? renderProductionOperationEditor\(project, schedule\) : ''/);

const planningContext = {
    console,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    document: {
        body: {
            dataset: {},
            classList: { add() {}, remove() {}, contains() { return false; } },
            appendChild() {},
        },
        addEventListener() {},
        createElement() { return {}; },
    },
};
const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
planningContext.window = {
    PMBI: {
        page: 'projects',
        APP_TODAY: '2026-08-26',
        state: {},
        qs: () => null,
        qsa: () => [],
        bindHorizontalWheelScroll() {},
        safeReplaceChildren() {},
        skeletonMarkup: () => '<div></div>',
        refreshLucideIcons() {},
        showAppNotice() {},
        appErrorMessage: (_error, fallback) => fallback,
        withSubmitLock: (_target, callback) => callback(),
        escapeHtml,
        formatDisplayDate: (value) => String(value || ''),
        api: () => Promise.resolve({}),
        money: (value) => String(value || 0),
        percent: (value) => Number(value || 0),
        canonicalEstimateSectionTitle: (value) => String(value || ''),
        canonicalEstimateSectionId: (value) => String(value || ''),
        progressSelectorValue: () => 0,
        updateProjectProgressState() {},
        updateProgressNode() {},
        updateUIProgress() {},
        isoDateAdd: (value) => value,
        hasRole: (role) => role === 'guest',
        canManageSchedule: () => false,
        canManageSuppliers: () => false,
        canViewProcurementPrices: () => false,
        isMainAdminRole: () => false,
        app: {
            quantityPlanInfo: (item) => ({ totalQty: Number(item.plannedQty || 0), unit: item.unit || 'ед.' }),
            quantityText: (value) => String(value == null ? '' : value),
        },
    },
};
planningContext.window.window = planningContext.window;
vm.runInNewContext(planningJs, planningContext, { filename: 'planning.js' });
const guestScheduleHtml = planningContext.window.PMBI.planning.renderProductionSchedule(
    { id: 25, title: 'ЧБ' },
    {
        dayCount: 2,
        autoDayCount: 2,
        items: [{
            id: 1,
            operationId: 1,
            title: 'Монтаж',
            unit: 'м²',
            plannedQty: 12,
            crewSize: 3,
            peopleCount: 3,
            shiftCount: 1,
            brigadeCount: 1,
            durationDays: 2,
            effectiveDays: 2,
            autoFilledSlots: [1, 2, 3, 4],
            filledSlots: [1, 2, 3, 4],
            overriddenSlots: [],
            color: 'blue',
        }],
    },
);
assert.match(guestScheduleHtml, /production-schedule-card/);
assert.match(guestScheduleHtml, /data-production-cell[^>]* disabled/);
assert.doesNotMatch(guestScheduleHtml, /data-production-operation-form/);

console.log('guest_access_frontend_ok');
