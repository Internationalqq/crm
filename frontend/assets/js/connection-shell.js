(function () {
    'use strict';

    var root = document.querySelector('[data-connection-shell]');
    if (!root) return;

    var copy = root.querySelector('[data-connection-copy]');
    var slowTimer = null;
    var hideTimer = null;

    function clearTimers() {
        if (slowTimer) clearTimeout(slowTimer);
        if (hideTimer) clearTimeout(hideTimer);
        slowTimer = null;
        hideTimer = null;
    }

    function setState(state, message) {
        clearTimers();
        root.hidden = state === 'idle';
        root.dataset.state = state;
        if (copy && message) copy.textContent = message;
    }

    function begin(message, slowMessage) {
        setState('loading', message || 'Соединяемся с PM.bi');
        slowTimer = setTimeout(function () {
            if (root.dataset.state !== 'loading') return;
            root.dataset.state = 'slow';
            if (copy) copy.textContent = slowMessage || 'Связь медленная — продолжаю';
        }, 4000);
    }

    function done(message) {
        setState('done', message || 'Готово');
        hideTimer = setTimeout(function () {
            if (root.dataset.state === 'done') setState('idle');
        }, 720);
    }

    function offline(message) {
        setState('offline', message || 'Нет сети — повторим автоматически');
    }

    var api = {
        begin: begin,
        done: done,
        offline: offline,
        setState: setState
    };
    window.PMBIConnectionShell = api;

    document.querySelectorAll('[data-connection-link]').forEach(function (link) {
        link.addEventListener('click', function () {
            if (navigator.onLine === false) {
                offline();
                return;
            }
            begin(link.dataset.connectionMessage || 'Открываем защищённый вход');
        });
    });

    window.addEventListener('offline', function () { offline(); });
    window.addEventListener('online', function () {
        if (root.dataset.state === 'offline') begin('Связь вернулась — подключаемся');
    });

    if (root.dataset.autostart === 'true') begin(copy && copy.textContent);
})();
