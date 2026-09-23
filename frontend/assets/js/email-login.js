(function () {
    'use strict';
    var PMBI = window.PMBI = window.PMBI || {};
    var storageKey = 'pmbi.emailLogin';

    function init(restorePending) {
        if (restorePending === false) {
            try { sessionStorage.removeItem(storageKey); } catch (_) { /* Optional storage. */ }
        }
        var root = document.querySelector('[data-email-login]');
        var methods = document.querySelector('[data-login-methods]');
        var config = window.__PMBI_AUTH__ || {};
        if (!root || !methods || !config.emailLoginEnabled || config.clerkEnabled) return;
        methods.hidden = false;
        if (root.dataset.bound) return;
        root.dataset.bound = '1';
        var find = function (selector) { return document.querySelector(selector); };
        var requestForm = find('[data-email-request]');
        var verifyForm = find('[data-email-verify]');
        var emailInput = requestForm.elements.email;
        var codeInput = verifyForm.elements.code;
        var passwordForm = find('[data-login-form]');
        var resetPanel = find('[data-password-reset-panel]');
        var passwordButton = find('[data-method-password]');
        var emailButton = find('[data-method-email]');
        var changeButton = find('[data-email-change]');
        var resendButton = find('[data-email-resend]');
        var requestButton = requestForm.querySelector('[type=submit]');
        var verifyButton = verifyForm.querySelector('[type=submit]');
        var errorNode = find('[data-email-error]');
        var statusNode = find('[data-email-status]');
        var state = null;
        var busy = false;
        var requestUntil = 0;
        var verifyUntil = 0;
        var timer = null;

        function save() {
            try {
                if (state) sessionStorage.setItem(storageKey, JSON.stringify(state));
                else sessionStorage.removeItem(storageKey);
            } catch (_) { /* Storage can be disabled; the current tab still works. */ }
        }
        function message(text) {
            errorNode.textContent = text || '';
            errorNode.classList.toggle('active', !!text);
            codeInput.setAttribute('aria-invalid', text && state ? 'true' : 'false');
        }
        function remaining(deadline) { return Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); }
        function clock(seconds) { return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); }
        function tick() {
            var wait = remaining(Math.max(state ? state.resendAt : 0, requestUntil));
            resendButton.disabled = busy || wait > 0;
            changeButton.disabled = busy;
            passwordButton.disabled = busy;
            emailButton.disabled = busy;
            requestButton.disabled = busy || wait > 0 && !state;
            requestButton.textContent = busy && !state ? 'Отправляем код…' : !state && wait ? 'Получить код через ' + clock(wait) : 'Получить код';
            verifyButton.disabled = busy || !!(state && (state.locked || remaining(state.expiresAt) === 0)) || remaining(verifyUntil) > 0;
            verifyButton.textContent = busy && state ? 'Подождите…' : remaining(verifyUntil) ? 'Повторить через ' + clock(remaining(verifyUntil)) : 'Войти в CRM';
            find('[data-email-timer]').textContent = state && wait ? clock(wait) : '';
            find('[data-email-hint]').textContent = state && remaining(state.expiresAt) === 0 ? 'Код истёк. Отправьте новый код.' : state && state.locked ? 'Запросите новый код, чтобы продолжить.' : 'Шесть цифр. Код действует 10 минут.';
        }
        function render(focus) {
            requestForm.hidden = !!state;
            verifyForm.hidden = !state;
            if (state) {
                emailInput.value = state.email;
                find('[data-email-recipient]').textContent = state.email;
            }
            tick();
            if (focus) (state ? codeInput : emailInput).focus();
        }
        function choose(email, focus) {
            root.hidden = !email;
            passwordForm.hidden = email;
            resetPanel.hidden = email;
            emailButton.setAttribute('aria-pressed', String(email));
            passwordButton.setAttribute('aria-pressed', String(!email));
            find('[data-login-title]').textContent = email ? 'Вход по почте' : 'Вход';
            find('[data-login-lead]').textContent = email ? 'Используйте почту, указанную в вашей учётной записи.' : 'Введите выданный логин и пароль.';
            clearInterval(timer);
            if (email) { render(focus); timer = setInterval(tick, 1000); }
            else if (focus) passwordForm.elements.login.focus();
        }
        function api(path, data) {
            return PMBI.api('/api/auth/email/' + path, { method: 'POST', body: JSON.stringify(data), silentLoader: true });
        }
        function failure(error, requesting) {
            var payload = error.payload || {};
            if (payload.retryAfter) {
                var deadline = Date.now() + Number(payload.retryAfter) * 1000;
                if (requesting) { requestUntil = deadline; if (state) state.resendAt = deadline; }
                else verifyUntil = deadline;
            }
            if (state && (payload.error === 'email_code_expired' || payload.error === 'email_code_locked')) state.locked = true;
            save();
            message(payload.message || 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
        }
        async function send() {
            if (busy || remaining(Math.max(state ? state.resendAt : 0, requestUntil))) return;
            if (!state && !requestForm.reportValidity()) return;
            var email = state ? state.email : emailInput.value.trim();
            busy = true; message(''); statusNode.textContent = ''; tick();
            try {
                var data = await api('request', { email: email });
                state = { email: email, challenge: data.challenge, expiresAt: Date.now() + data.expiresIn * 1000, resendAt: Date.now() + data.resendAfter * 1000 };
                requestUntil = 0;
                codeInput.value = '';
                save(); statusNode.textContent = data.message;
                render(true);
            } catch (error) { failure(error, true); }
            finally { busy = false; tick(); }
        }
        requestForm.addEventListener('submit', function (event) { event.preventDefault(); send(); });
        resendButton.addEventListener('click', send);
        codeInput.addEventListener('input', function () {
            codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
            message('');
        });
        verifyForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            if (busy || !state || state.locked || !remaining(state.expiresAt) || remaining(verifyUntil) || !verifyForm.reportValidity()) return;
            busy = true; message(''); tick();
            try {
                var data = await api('verify', { challenge: state.challenge, code: codeInput.value });
                state = null; save(); codeInput.value = '';
                PMBI.setRememberSession(false);
                PMBI.clearAutoLoginAttempt();
                var user = data.user || {};
                location.replace(user.isGuest || user.role === 'guest' ? '/app/projects' : PMBI.nextPath());
            } catch (error) { failure(error, false); codeInput.focus(); codeInput.select(); }
            finally { busy = false; tick(); }
        });
        changeButton.addEventListener('click', function () {
            if (busy) return;
            state = null; requestUntil = 0; save(); codeInput.value = ''; message(''); statusNode.textContent = ''; render(true);
        });
        emailButton.addEventListener('click', function () { choose(true, true); });
        passwordButton.addEventListener('click', function () { choose(false, true); });
        try {
            var stored = JSON.parse(sessionStorage.getItem(storageKey));
            if (stored && /^[A-Za-z0-9_-]{43}$/.test(stored.challenge) && typeof stored.email === 'string' && stored.expiresAt > Date.now() - 600000 && Number.isFinite(stored.resendAt)) state = stored;
            else sessionStorage.removeItem(storageKey);
        } catch (_) { /* No pending login. */ }
        if (state) choose(true, false);
    }
    PMBI.emailLogin = { init: init };
})();
