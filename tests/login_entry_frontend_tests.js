const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const loginPath = path.join(root, 'frontend/assets/js/login.js');
const loginJs = fs.readFileSync(loginPath, 'utf8');
const coreJs = fs.readFileSync(path.join(root, 'frontend/assets/js/core.js'), 'utf8');

assert.ok(Buffer.byteLength(loginJs, 'utf8') < 20 * 1024, 'login entry must stay small');
assert.match(loginJs, /PMBI\.api\('\/api\/auth\/login'/);
assert.match(loginJs, /PMBI\.api\('\/api\/auth\/request-password-reset'/);
assert.match(loginJs, /PMBI\.loadCurrentUser\(\{ silentLoader: true, force: true \}\)/);
assert.match(loginJs, /PMBI\.resetRememberAuthState\(\)/);
assert.match(loginJs, /PMBI\.loadClerk\(\)/);
assert.match(loginJs, /clerk\.mountSignIn/);
assert.match(loginJs, /PMBI\.login\.initLogin = initLogin/);
assert.match(loginJs, /setConnectionState\('loading'/);
assert.match(loginJs, /setConnectionState\('slow'/);
assert.match(loginJs, /setConnectionState\('offline'/);
assert.match(loginJs, /}, 4000\)/);
assert.doesNotMatch(loginJs, /\.innerHTML\s*=/);

[
    'rememberSessionEnabled',
    'setRememberSession',
    'wasAutoLoginAttempted',
    'markAutoLoginAttempted',
    'clearAutoLoginAttempt',
    'resetRememberAuthState',
    'loadCurrentUser',
    'isClerkEnabled',
    'loadClerk',
    'appErrorMessage',
    'normalizeRole',
    'nextPath',
].forEach((name) => {
    assert.match(coreJs, new RegExp(`${name}: ${name}`), `core must publish PMBI.${name}`);
});

function classList() {
    const values = new Set();
    return {
        add(...names) { names.forEach((name) => values.add(name)); },
        remove(...names) { names.forEach((name) => values.delete(name)); },
        contains(name) { return values.has(name); },
        toggle(name, force) {
            const enabled = force === undefined ? !values.has(name) : !!force;
            if (enabled) values.add(name);
            else values.delete(name);
            return enabled;
        },
    };
}

function element() {
    const listeners = Object.create(null);
    return {
        dataset: {},
        classList: classList(),
        textContent: '',
        hidden: false,
        disabled: false,
        addEventListener(type, listener) { listeners[type] = listener; },
        dispatch(type) {
            assert.equal(typeof listeners[type], 'function', `${type} listener must be bound`);
            listeners[type]({ preventDefault() {} });
        },
        querySelector() { return null; },
    };
}

function createHarness(options = {}) {
    const loginForm = element();
    const loginButton = element();
    loginForm.login = { value: '' };
    loginForm.password = { value: '' };
    loginForm.rememberMe = { checked: false };
    loginForm.querySelector = (selector) => selector.startsWith('button') ? loginButton : null;

    const resetForm = element();
    const resetButton = element();
    resetForm.email = { value: '' };
    resetForm.resetCount = 0;
    resetForm.reset = () => { resetForm.resetCount += 1; resetForm.email.value = ''; };
    resetForm.querySelector = (selector) => selector.startsWith('button') ? resetButton : null;

    const confirmForm = element();
    const confirmButton = element();
    confirmForm.newPassword = { value: '' };
    confirmForm.confirmPassword = { value: '' };
    confirmForm.reset = () => { confirmForm.newPassword.value = ''; confirmForm.confirmPassword.value = ''; };
    confirmForm.querySelector = (selector) => selector.startsWith('button') ? confirmButton : null;

    const connectionText = element();
    const connectionShell = element();
    connectionShell.querySelector = (selector) => selector === '[data-connection-shell-text]' ? connectionText : null;
    connectionShell.attributes = {};
    connectionShell.setAttribute = (name, value) => { connectionShell.attributes[name] = value; };
    const nodes = {
        '[data-login-form]': loginForm,
        '[data-login-error]': element(),
        '[data-password-reset-form]': resetForm,
        '[data-password-reset-error]': element(),
        '[data-password-reset-success]': element(),
        '[data-password-reset-panel]': element(),
        '[data-password-reset-confirm]': element(),
        '[data-password-reset-confirm-form]': confirmForm,
        '[data-password-reset-confirm-error]': element(),
        '[data-password-reset-confirm-success]': element(),
        '[data-login-title]': element(),
        '[data-login-lead]': element(),
        '[data-login-clerk-root]': element(),
        '[data-connection-shell-text]': connectionText,
    };
    if (options.connectionShell !== false) nodes['[data-connection-shell]'] = connectionShell;
    const calls = {
        api: [],
        redirects: [],
        history: [],
        remember: [],
        clearAuto: 0,
        markAuto: 0,
        resetRemember: 0,
        loadCurrentUser: [],
        timers: new Map(),
    };
    let timerId = 0;
    const schedule = (callback, delay) => {
        timerId += 1;
        calls.timers.set(timerId, { callback, delay });
        return timerId;
    };
    const cancel = (id) => calls.timers.delete(id);

    const api = (requestPath, requestOptions) => {
        calls.api.push({ path: requestPath, options: requestOptions || {} });
        if (typeof options.api === 'function') return options.api(requestPath, requestOptions || {});
        if (requestPath === '/api/auth/login') return Promise.resolve({ user: { role: 'foreman' } });
        if (requestPath === '/api/auth/request-password-reset') return Promise.resolve({ message: 'Письмо отправлено' });
        return Promise.resolve({});
    };
    const PMBI = {
        page: 'login',
        state: { authConfig: options.authConfig || {} },
        qs: (selector) => nodes[selector] || null,
        api,
        appErrorMessage: (error, fallback) => error && error.payload && (error.payload.message || error.payload.error) || fallback,
        rememberSessionEnabled: () => !!options.remembered,
        setRememberSession: (enabled) => calls.remember.push(enabled),
        wasAutoLoginAttempted: () => !!options.autoAttempted,
        markAutoLoginAttempted: () => { calls.markAuto += 1; },
        clearAutoLoginAttempt: () => { calls.clearAuto += 1; },
        resetRememberAuthState: () => { calls.resetRemember += 1; return Promise.resolve(); },
        loadCurrentUser: (loadOptions) => {
            calls.loadCurrentUser.push(loadOptions);
            return options.currentUserError
                ? Promise.reject(options.currentUserError)
                : Promise.resolve(options.currentUser || { role: 'foreman' });
        },
        isClerkEnabled: () => !!options.clerk,
        loadClerk: () => options.clerkError ? Promise.reject(options.clerkError) : Promise.resolve(options.clerk),
        normalizeRole: (role) => String(role || '').trim().toLowerCase(),
        nextPath: () => options.nextPath || '/app/dashboard',
    };
    const document = {
        body: { dataset: { page: 'login' } },
        querySelector: (selector) => nodes[selector] || null,
        addEventListener() {},
    };
    const location = {
        search: '',
        hash: options.hash || '',
        pathname: '/login',
        replace(target) { calls.redirects.push(target); },
    };
    const history = {
        replaceState(_state, _title, target) { calls.history.push(target); location.hash = ''; },
    };
    const window = { PMBI };
    window.addEventListener = () => {};
    window.window = window;
    window.document = document;
    window.location = location;

    vm.runInNewContext(loginJs, {
        window,
        document,
        location,
        history,
        Promise,
        console,
        navigator: { onLine: options.online !== false },
        setTimeout: schedule,
        clearTimeout: cancel,
    }, { filename: 'login.js' });

    return {
        window,
        nodes,
        loginForm,
        loginButton,
        resetForm,
        resetButton,
        confirmForm,
        confirmButton,
        connectionShell,
        connectionText,
        calls,
        runTimer(delay) {
            const match = [...calls.timers.entries()].find((entry) => entry[1].delay === delay);
            assert.ok(match, `timer ${delay}ms must be scheduled`);
            calls.timers.delete(match[0]);
            match[1].callback();
        },
    };
}

const settle = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
};

(async () => {
    const normal = createHarness();
    normal.loginForm.login.value = '  foreman  ';
    normal.loginForm.password.value = 'safe-password';
    normal.loginForm.rememberMe.checked = true;
    normal.loginForm.dispatch('submit');
    await settle();
    const loginCall = normal.calls.api.find((call) => call.path === '/api/auth/login');
    assert.deepEqual(JSON.parse(loginCall.options.body), {
        login: 'foreman',
        password: 'safe-password',
        rememberMe: true,
    });
    assert.deepEqual(normal.calls.remember, [true]);
    assert.equal(normal.calls.clearAuto, 1);
    assert.deepEqual(normal.calls.redirects, ['/app/dashboard']);
    assert.equal(normal.connectionShell.dataset.state, 'done');
    assert.equal(normal.connectionShell.hidden, true);

    const failed = createHarness({
        api(requestPath) {
            if (requestPath === '/api/auth/login') return Promise.reject(new Error('secret backend detail'));
            return Promise.resolve({});
        },
    });
    failed.loginForm.dispatch('submit');
    await settle();
    assert.deepEqual(failed.calls.remember, [false]);
    assert.equal(failed.loginButton.disabled, false);
    assert.equal(failed.nodes['[data-login-error]'].textContent, 'Неверный логин или пароль');
    assert.equal(failed.nodes['[data-login-error]'].classList.contains('active'), true);
    assert.doesNotMatch(failed.nodes['[data-login-error]'].textContent, /secret backend detail/);

    const reset = createHarness();
    reset.resetForm.email.value = 'wrong';
    reset.resetForm.dispatch('submit');
    assert.equal(reset.calls.api.some((call) => call.path === '/api/auth/request-password-reset'), false);
    assert.equal(reset.nodes['[data-password-reset-error]'].classList.contains('active'), true);
    reset.resetForm.email.value = 'worker@example.test';
    reset.resetForm.dispatch('submit');
    await settle();
    const resetCall = reset.calls.api.find((call) => call.path === '/api/auth/request-password-reset');
    assert.deepEqual(JSON.parse(resetCall.options.body), { email: 'worker@example.test' });
    assert.equal(reset.nodes['[data-password-reset-success]'].textContent, 'Письмо отправлено');
    assert.equal(reset.resetForm.resetCount, 1);
    assert.equal(reset.resetButton.disabled, false);

    const confirmation = createHarness({ hash: '#reset-token=secure-token' });
    assert.equal(confirmation.loginForm.hidden, true);
    assert.equal(confirmation.nodes['[data-password-reset-confirm]'].hidden, false);
    assert.deepEqual(confirmation.calls.history, ['/login']);
    confirmation.confirmForm.newPassword.value = 'new-password-123';
    confirmation.confirmForm.confirmPassword.value = 'different-password';
    confirmation.confirmForm.dispatch('submit');
    assert.equal(confirmation.calls.api.some((call) => call.path === '/api/auth/request-password-reset'), false);
    assert.match(confirmation.nodes['[data-password-reset-confirm-error]'].textContent, /не совпадают/i);
    confirmation.confirmForm.confirmPassword.value = 'new-password-123';
    confirmation.confirmForm.dispatch('submit');
    await settle();
    const confirmationCall = confirmation.calls.api.find((call) => call.path === '/api/auth/request-password-reset');
    assert.deepEqual(JSON.parse(confirmationCall.options.body), {
        resetToken: 'secure-token',
        newPassword: 'new-password-123',
    });
    assert.equal(confirmation.loginForm.hidden, false);
    assert.equal(confirmation.nodes['[data-password-reset-confirm]'].hidden, true);

    const rememberedGuest = createHarness({ remembered: true, currentUser: { role: 'guest' } });
    await settle();
    assert.equal(rememberedGuest.calls.markAuto, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(rememberedGuest.calls.loadCurrentUser)), [{ silentLoader: true, force: true }]);
    assert.deepEqual(rememberedGuest.calls.redirects, ['/app/projects']);

    const brokenRemember = createHarness({ remembered: true, autoAttempted: true });
    await settle();
    assert.equal(brokenRemember.calls.resetRemember, 1);
    assert.equal(brokenRemember.loginForm.rememberMe.checked, false);
    assert.match(brokenRemember.nodes['[data-login-error]'].textContent, /Сессия устарела/);

    let clerkListener = null;
    let mounted = null;
    const clerk = {
        session: null,
        addListener(listener) { clerkListener = listener; },
        mountSignIn(rootNode, config) { mounted = { rootNode, config }; },
    };
    const clerkHarness = createHarness({ clerk, nextPath: '/app/projects?from=login' });
    await settle();
    assert.equal(clerkHarness.nodes['[data-password-reset-panel]'].hidden, true);
    assert.equal(typeof clerkListener, 'function');
    assert.equal(mounted.rootNode, clerkHarness.nodes['[data-login-clerk-root]']);
    assert.equal(mounted.config.forceRedirectUrl, '/app/projects?from=login');
    clerkListener({ session: {} });
    await settle();
    assert.deepEqual(clerkHarness.calls.redirects, ['/app/projects?from=login']);

    let resolveSlowLogin;
    const slow = createHarness({
        api(requestPath) {
            if (requestPath === '/api/auth/login') {
                return new Promise((resolve) => { resolveSlowLogin = resolve; });
            }
            return Promise.resolve({});
        },
    });
    slow.loginForm.dispatch('submit');
    assert.equal(slow.connectionShell.dataset.state, 'loading');
    slow.runTimer(4000);
    assert.equal(slow.connectionShell.dataset.state, 'slow');
    assert.match(slow.connectionText.textContent, /медленнее обычного/);
    resolveSlowLogin({ user: { role: 'foreman' } });
    await settle();
    assert.equal(slow.connectionShell.dataset.state, 'done');

    const offline = createHarness({
        online: false,
        api(requestPath) {
            if (requestPath === '/api/auth/login') return Promise.reject(new TypeError('Failed to fetch'));
            return Promise.resolve({});
        },
    });
    offline.loginForm.dispatch('submit');
    await settle();
    assert.equal(offline.connectionShell.dataset.state, 'offline');
    assert.equal(offline.connectionShell.hidden, false);
    assert.match(offline.connectionText.textContent, /Нет соединения/);

    const shellLess = createHarness({ connectionShell: false });
    shellLess.loginForm.login.value = 'worker';
    shellLess.loginForm.password.value = 'password';
    shellLess.loginForm.dispatch('submit');
    await settle();
    assert.deepEqual(shellLess.calls.redirects, ['/app/dashboard']);

    console.log('login_entry_frontend_ok');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
