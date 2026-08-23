const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const core = read('frontend/assets/js/core.js');
const app = read('frontend/assets/js/app.js');
const operations = read('frontend/assets/js/operations.js');
const projectsBackend = read('backend/projects.py');
const serverBackend = read('backend/server.py');
const styles = read('frontend/assets/css/economics.css');
const projectsPage = read('frontend/pages/projects.html');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(
    core.includes("function canViewProjectEconomics()") &&
        core.includes("return isMainAdminRole() || hasRole('admin') || hasRole('director');"),
    'project economics visibility must be limited to main admin, admin and director'
);
assert(
    app.includes("if (!canViewProjectEconomics()) return Promise.resolve(null);") &&
        app.includes("'/economics'"),
    'restricted roles must not request the project economics endpoint'
);
[
    'Договорная выручка',
    'Целевая себестоимость',
    'Обязательства',
    'Факт затрат',
    'ETC',
    'EAC',
    'Прогнозная маржа',
    'Денежный поток',
].forEach((label) => {
    assert(app.includes(label), `economics UI is missing: ${label}`);
});
assert(
    app.includes('Баланс поступлений и оплат не является прибылью или маржой.'),
    'cash flow must be explicitly separated from profit and margin'
);

const overviewStart = app.indexOf('function projectOverviewWidgetFinanceV2(project, economics)');
const overviewEnd = app.indexOf('\n    function ', overviewStart + 20);
const overviewSource = app.slice(overviewStart, overviewEnd > overviewStart ? overviewEnd : app.length);
assert(overviewStart >= 0, 'project economics overview widget is missing');
assert(!overviewSource.includes('project.budget'), 'overview widget must not derive economics from legacy budget');
assert(!overviewSource.includes('project.spent'), 'overview widget must not derive economics from legacy spent');

assert(!app.includes("stat('Маржа сейчас'"), 'app dashboard must not label cash balance as margin');
assert(!operations.includes("stat('Маржа сейчас'"), 'operations dashboard must not label cash balance as margin');
assert(app.includes("stat('Кассовый остаток'"), 'app dashboard must expose the renamed cash balance');
assert(operations.includes("stat('Кассовый остаток'"), 'operations dashboard must expose the renamed cash balance');

assert(
    projectsBackend.includes('if not user_can_view_project_economics(user):') &&
        projectsBackend.includes('for key in ["budget", "paid", "spent"]:'),
    'legacy project money fields must be removed server-side'
);
assert(
    projectsBackend.includes('budget = current["budget"]'),
    'restricted project updates must preserve the stored legacy budget'
);
assert(
    serverBackend.includes("financial_meta = '<div><span>Экономика</span><strong>Раздел «Финансы»</strong></div>'") &&
        !serverBackend.includes('<span>Legacy-бюджет</span>'),
    'server-rendered project fallback must not present legacy money as live economics'
);
assert(
    !projectsPage.includes('<span>Legacy-бюджет</span>') &&
        projectsPage.includes('<input name="budget" type="hidden" value="0">') &&
        !operations.includes('<span>Legacy-бюджет</span>'),
    'legacy budget must not remain a user-facing project form control'
);
assert(
    app.includes("stat('Договорная выручка'") &&
        app.includes("stat('Прогнозная маржа'") &&
        !app.includes("stat('Legacy-бюджет'"),
    'dashboard must use approved portfolio economics instead of legacy budget'
);
assert(styles.includes('.project-economics'), 'economics component styles are missing');

console.log('project economics frontend tests passed');
