const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const app = read('frontend/assets/js/app.js');
const economicsManagement = read('frontend/assets/js/economics-management.js');
const financeStyles = read('frontend/assets/css/finance-redesign.css');
const appStyles = read('frontend/assets/app.css');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

[
    'data-finance-workspace',
    'data-finance-view="overview"',
    'data-finance-view="payments"',
    'data-finance-view="operations"',
    'data-finance-view="management"',
    'data-finance-view-target="management"',
    'data-finance-filter="payable"',
    'data-finance-delete',
    'data-finance-delete-modal',
    "method: 'DELETE'",
    'data-finance-payables-callout',
    'data-finance-payables-board',
    'data-finance-payment-modal',
    'data-finance-confirm-payment',
    'data-finance-payment-date',
    'data-finance-payable-settings',
    '/api/finance/pay-invoice',
    'paid_date: dateInput',
    'bindFinanceWorkspaceNavigation',
    'bindFinanceOperationFilters',
].forEach((token) => {
    assert(app.includes(token), `finance workspace contract is missing: ${token}`);
});

[
    'Прогнозная маржа',
    'Денег сейчас',
    'Оплатить за 7 дней',
    'Просрочено',
    'Баланс поступлений и оплат не является прибылью или маржой.',
    'Счета, которые ждут оплаты',
    'Перейти к оплате',
    'Подтвердить оплату',
    'Все финансовые операции',
].forEach((label) => {
    assert(app.includes(label), `finance workspace copy is missing: ${label}`);
});

const currentFinanceHeroStart = app.lastIndexOf('function renderFinanceHero(');
const currentFinanceHeroEnd = app.indexOf('\n    function ', currentFinanceHeroStart + 20);
const currentFinanceHero = app.slice(currentFinanceHeroStart, currentFinanceHeroEnd);
assert(currentFinanceHeroStart >= 0, 'current finance cash overview is missing');
assert(!currentFinanceHero.includes('financeEstimateTotal'), 'cash overview must not mix the estimate total into cash flow');
assert(
    currentFinanceHero.includes('paidIncome') &&
        currentFinanceHero.includes('paidExpense') &&
        currentFinanceHero.includes('financePaymentOverview(items)'),
    'cash overview must be based on received, paid and pending money'
);

const economicsStart = app.indexOf('function renderProjectEconomics(');
const economicsEnd = app.indexOf('\n    function ', economicsStart + 20);
const economicsSource = app.slice(economicsStart, economicsEnd);
assert(
    economicsSource.includes("if (data.status === 'not_configured')") &&
        economicsSource.includes("return '';"),
    'unconfigured economics must not add a duplicate setup card to finance overview'
);
[
    'Сначала зафиксируйте план объекта',
    'Официальный прогноз пока не рассчитывается',
    'Настроить плановую базу',
].forEach((label) => {
    assert(!economicsSource.includes(label), `duplicate economics setup copy must be removed: ${label}`);
});

[
    'Плановая база',
    'Обязательства и заказы',
    'Выполнение',
    'Связь с оплатой',
    'Итоговый прогноз',
    'Перенос данных',
].forEach((label) => {
    assert(economicsManagement.includes(label), `plain-language management step is missing: ${label}`);
});

[
    '.finance-commandbar',
    '.finance-section-nav',
    '.finance-executive-summary',
    '.economics-story-grid',
    '.finance-cash-overview',
    '.finance-plan-summary',
    '.finance-filter-bar',
    '.finance-delete-button',
    '.finance-delete-dialog',
    '.finance-payables-callout',
    '.finance-payables-board',
    '.finance-payable-row',
    '.finance-payment-dialog',
].forEach((selector) => {
    assert(financeStyles.includes(selector), `finance redesign style is missing: ${selector}`);
});

assert(
    appStyles.includes('@import "./css/finance-redesign.css'),
    'finance redesign stylesheet must be loaded after the existing UI styles'
);

console.log('finance redesign frontend tests passed');
