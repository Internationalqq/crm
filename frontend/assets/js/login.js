(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    PMBI.login = PMBI.login || {};
    if (PMBI.login.__loaded) return;
    PMBI.login.__loaded = true;
    var connectionSequence = 0;
    var connectionSlowTimer = null;
    var activeResetToken = '';

    function qs(selector) {
        if (typeof PMBI.qs === 'function') return PMBI.qs(selector);
        return document.querySelector(selector);
    }

    function setMessage(node, message, active) {
        if (!node) return;
        node.textContent = String(message || '');
        node.classList.toggle('active', active !== false && !!message);
    }

    function safeErrorMessage(error, fallback) {
        var message = fallback;
        if (typeof PMBI.appErrorMessage === 'function') {
            message = PMBI.appErrorMessage(error, fallback);
        }
        message = typeof message === 'string' ? message.trim() : '';
        return message || fallback;
    }

    function connectionShell() {
        return qs('[data-connection-shell]');
    }

    function clearConnectionSlowTimer() {
        if (!connectionSlowTimer) return;
        clearTimeout(connectionSlowTimer);
        connectionSlowTimer = null;
    }

    function setConnectionState(state, message) {
        var shell = connectionShell();
        if (!shell) return;
        shell.dataset.state = state;
        shell.hidden = state === 'done';
        if (typeof shell.setAttribute === 'function') {
            shell.setAttribute('aria-busy', state === 'loading' || state === 'slow' ? 'true' : 'false');
        }
        var text = typeof shell.querySelector === 'function'
            ? shell.querySelector('[data-connection-shell-text]')
            : null;
        if (!text) text = qs('[data-connection-shell-text]');
        if (text && message) text.textContent = message;
    }

    function beginConnection(message) {
        connectionSequence += 1;
        var token = connectionSequence;
        clearConnectionSlowTimer();
        setConnectionState('loading', message || 'Соединяемся с PM.bi');
        connectionSlowTimer = setTimeout(function () {
            if (token !== connectionSequence) return;
            connectionSlowTimer = null;
            setConnectionState('slow', 'Связь медленнее обычного. Продолжаем подключение…');
        }, 4000);
        return token;
    }

    function finishConnection(token) {
        if (token && token !== connectionSequence) return;
        clearConnectionSlowTimer();
        setConnectionState('done', 'Готово');
    }

    function showConnectionOffline(token, message) {
        if (!token) {
            connectionSequence += 1;
            token = connectionSequence;
        }
        if (token && token !== connectionSequence) return;
        clearConnectionSlowTimer();
        setConnectionState('offline', message || 'Нет соединения. Проверьте интернет и попробуйте ещё раз.');
    }

    function isNetworkError(error) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
        if (!error) return false;
        if (Number(error.status) === 0 || error.name === 'TypeError') return true;
        var code = error.code || error.payload && error.payload.error;
        return code === 'network_error' || code === 'connection_reset' || code === 'offline';
    }

    function settleConnection(token, error) {
        if (isNetworkError(error)) showConnectionOffline(token);
        else finishConnection(token);
    }

    function showLoginError(message) {
        setMessage(qs('[data-login-error]'), message || 'Неверный логин или пароль');
    }

    function hideLoginError() {
        setMessage(qs('[data-login-error]'), '', false);
    }

    function autoLoginErrorMessage() {
        return 'Сессия устарела или доступ изменился. Введите пароль заново.';
    }

    function stopBrokenAutoLogin(message) {
        var reset;
        try {
            reset = PMBI.resetRememberAuthState();
        } catch (error) {
            reset = Promise.resolve();
        }
        return Promise.resolve(reset).catch(function () {
            return null;
        }).then(function () {
            var form = qs('[data-login-form]');
            if (form && form.rememberMe) form.rememberMe.checked = false;
            showLoginError(message || autoLoginErrorMessage());
        });
    }

    function bindPasswordResetForm() {
        var form = qs('[data-password-reset-form]');
        if (!form || form.dataset.loginResetBound === '1') return;
        form.dataset.loginResetBound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-password-reset-error]');
            var success = qs('[data-password-reset-success]');
            var button = form.querySelector('button[type="submit"]');
            setMessage(error, '', false);
            setMessage(success, '', false);

            var email = String(form.email && form.email.value || '').trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setMessage(error, 'Введите email, указанный в учетной записи.');
                return;
            }

            if (button) button.disabled = true;
            var connectionToken = beginConnection('Отправляем ссылку восстановления…');
            PMBI.api('/api/auth/request-password-reset', {
                method: 'POST',
                body: JSON.stringify({ email: email })
            }).then(function (data) {
                finishConnection(connectionToken);
                setMessage(
                    success,
                    data && data.message || 'Если такой email есть в системе, ссылка восстановления отправлена на почту.'
                );
                form.reset();
            }).catch(function (requestError) {
                settleConnection(connectionToken, requestError);
                setMessage(
                    error,
                    safeErrorMessage(requestError, 'Не удалось отправить ссылку. Попробуйте позже.')
                );
            }).finally(function () {
                if (button) button.disabled = false;
            });
        });
    }

    function resetTokenFromHash() {
        var match = String(location.hash || '').match(/^#reset-token=([^&]+)$/);
        if (!match) return '';
        try {
            var token = decodeURIComponent(match[1]);
            return token.length <= 512 ? token : '';
        } catch (error) {
            return '';
        }
    }

    function showPasswordResetConfirmation(token) {
        if (!token) return false;
        activeResetToken = token;
        if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
            history.replaceState(null, document.title || '', String(location.pathname || '/login') + String(location.search || ''));
        }
        var loginForm = qs('[data-login-form]');
        var requestPanel = qs('[data-password-reset-panel]');
        var confirmation = qs('[data-password-reset-confirm]');
        var title = qs('[data-login-title]');
        var lead = qs('[data-login-lead]');
        if (loginForm) loginForm.hidden = true;
        if (requestPanel) requestPanel.hidden = true;
        if (confirmation) confirmation.hidden = false;
        if (title) title.textContent = 'Новый пароль';
        if (lead) lead.textContent = 'Ссылка подтверждена. Задайте новый пароль для входа.';
        return true;
    }

    function finishPasswordResetMode(message) {
        activeResetToken = '';
        var loginForm = qs('[data-login-form]');
        var requestPanel = qs('[data-password-reset-panel]');
        var confirmation = qs('[data-password-reset-confirm]');
        var title = qs('[data-login-title]');
        var lead = qs('[data-login-lead]');
        if (confirmation) confirmation.hidden = true;
        if (loginForm) loginForm.hidden = false;
        if (requestPanel) requestPanel.hidden = false;
        if (title) title.textContent = 'Вход';
        if (lead) lead.textContent = message || 'Пароль обновлён. Войдите с новым паролем.';
        if (loginForm && loginForm.login && typeof loginForm.login.focus === 'function') loginForm.login.focus();
    }

    function bindPasswordResetConfirmation() {
        var form = qs('[data-password-reset-confirm-form]');
        if (!form || form.dataset.loginResetConfirmBound === '1') return;
        form.dataset.loginResetConfirmBound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-password-reset-confirm-error]');
            var success = qs('[data-password-reset-confirm-success]');
            var button = form.querySelector('button[type="submit"]');
            var password = String(form.newPassword && form.newPassword.value || '');
            var confirmation = String(form.confirmPassword && form.confirmPassword.value || '');
            setMessage(error, '', false);
            setMessage(success, '', false);
            if (!activeResetToken) return setMessage(error, 'Ссылка восстановления недействительна. Запросите новую.');
            if (password.length < 12) return setMessage(error, 'Пароль должен быть не короче 12 символов.');
            if (password !== confirmation) return setMessage(error, 'Пароли не совпадают.');
            if (button) button.disabled = true;
            var connectionToken = beginConnection('Обновляем пароль…');
            PMBI.api('/api/auth/request-password-reset', {
                method: 'POST',
                body: JSON.stringify({ resetToken: activeResetToken, newPassword: password })
            }).then(function (data) {
                finishConnection(connectionToken);
                form.reset();
                setMessage(success, data && data.message || 'Пароль обновлён.');
                finishPasswordResetMode(data && data.message);
            }).catch(function (requestError) {
                settleConnection(connectionToken, requestError);
                setMessage(error, safeErrorMessage(requestError, 'Не удалось обновить пароль. Запросите новую ссылку.'));
            }).finally(function () {
                if (button) button.disabled = false;
            });
        });
    }

    function initClerkLogin() {
        if (typeof PMBI.isClerkEnabled !== 'function' || !PMBI.isClerkEnabled()) {
            return Promise.resolve(null);
        }

        var root = qs('[data-login-clerk-root]');
        var resetPanel = qs('[data-password-reset-panel]');
        if (resetPanel) resetPanel.hidden = true;
        var clerkToken = beginConnection('Подключаем защищённый вход…');

        return PMBI.loadClerk().then(function (clerk) {
            if (!clerk) {
                finishConnection(clerkToken);
                showLoginError('Clerk не загрузился. Проверь настройки ключей.');
                return null;
            }

            var finishing = false;
            function finishLogin() {
                if (finishing) return;
                finishing = true;
                var finishToken = beginConnection('Завершаем защищённый вход…');
                PMBI.api('/api/auth/me').then(function () {
                    finishConnection(finishToken);
                    location.replace(PMBI.nextPath());
                }).catch(function (error) {
                    finishing = false;
                    settleConnection(finishToken, error);
                    if (error && error.payload && error.payload.error === 'clerk_user_not_provisioned') {
                        showLoginError('Вход выполнен, но доступ в CRM еще не выдан. Нужен пользователь с этим email внутри CRM.');
                        return;
                    }
                    showLoginError('Не удалось завершить вход. Проверь настройки доступа.');
                });
            }

            if (typeof clerk.addListener === 'function') {
                clerk.addListener(function (resources) {
                    if (resources && resources.session) finishLogin();
                });
            }
            if (clerk.session) {
                finishConnection(clerkToken);
                finishLogin();
                return clerk;
            }
            if (!root || typeof clerk.mountSignIn !== 'function') {
                finishConnection(clerkToken);
                showLoginError('Не удалось подключить защищенный вход.');
                return clerk;
            }

            var authConfig = PMBI.state && PMBI.state.authConfig || {};
            clerk.mountSignIn(root, {
                appearance: {
                    variables: {
                        colorPrimary: '#2f6fed',
                        colorText: '#eaf2ff',
                        colorBackground: '#122b4d',
                        borderRadius: '14px'
                    }
                },
                signUpUrl: '/login',
                forceRedirectUrl: PMBI.nextPath(),
                fallbackRedirectUrl: authConfig.clerkSignInFallbackRedirectUrl || '/app/dashboard'
            });
            finishConnection(clerkToken);
            return clerk;
        }).catch(function (error) {
            settleConnection(clerkToken, error);
            showLoginError('Не удалось подключить защищенный вход.');
            return null;
        });
    }

    function destinationForUser(user) {
        var role = typeof PMBI.normalizeRole === 'function' ? PMBI.normalizeRole(user && user.role) : String(user && user.role || '').toLowerCase();
        return user && (user.isGuest || role === 'guest') ? '/app/projects' : PMBI.nextPath();
    }

    function bindLoginForm() {
        var form = qs('[data-login-form]');
        if (!form || form.dataset.loginBound === '1') return form || null;
        form.dataset.loginBound = '1';

        if (form.rememberMe) form.rememberMe.checked = PMBI.rememberSessionEnabled();
        if (PMBI.rememberSessionEnabled()) {
            var autoLoginToken = beginConnection('Проверяем сохранённую сессию…');
            if (PMBI.wasAutoLoginAttempted()) {
                stopBrokenAutoLogin().then(function () {
                    finishConnection(autoLoginToken);
                });
            } else {
                PMBI.markAutoLoginAttempted();
                PMBI.loadCurrentUser({ silentLoader: true, force: true }).then(function (user) {
                    finishConnection(autoLoginToken);
                    location.replace(destinationForUser(user));
                }).catch(function (error) {
                    settleConnection(autoLoginToken, error);
                    stopBrokenAutoLogin();
                });
            }
        }

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            hideLoginError();
            var button = form.querySelector('button[type="submit"]') || form.querySelector('button');
            if (button) button.disabled = true;
            var rememberMe = !!(form.rememberMe && form.rememberMe.checked);
            var connectionToken = beginConnection('Входим в PM.bi…');

            PMBI.api('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    login: String(form.login && form.login.value || '').trim(),
                    password: String(form.password && form.password.value || ''),
                    rememberMe: rememberMe
                })
            }).then(function (data) {
                finishConnection(connectionToken);
                PMBI.setRememberSession(rememberMe);
                PMBI.clearAutoLoginAttempt();
                location.replace(destinationForUser(data && data.user || {}));
            }).catch(function (error) {
                settleConnection(connectionToken, error);
                PMBI.setRememberSession(false);
                PMBI.clearAutoLoginAttempt();
                showLoginError('Неверный логин или пароль');
                if (button) button.disabled = false;
            });
        });
        return form;
    }

    function initLogin() {
        bindPasswordResetForm();
        bindPasswordResetConfirmation();
        showPasswordResetConfirmation(resetTokenFromHash());
        initClerkLogin();
        return bindLoginForm();
    }

    PMBI.login.initLogin = initLogin;
    PMBI.login.stopBrokenAutoLogin = stopBrokenAutoLogin;
    PMBI.login.connection = {
        begin: beginConnection,
        finish: finishConnection,
        offline: showConnectionOffline
    };
    window.PMBI = PMBI;

    function boot() {
        var page = PMBI.page || document.body && document.body.dataset.page;
        if (page !== 'login') return;
        var bootToken = beginConnection('Соединяемся с PM.bi');
        var form = initLogin();
        if (form) finishConnection(bootToken);
    }

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('offline', function () {
            showConnectionOffline(null);
        });
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
