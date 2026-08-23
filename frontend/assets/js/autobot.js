(function () {
    'use strict';

    var PMBI = window.PMBI = window.PMBI || {};
    if (PMBI.autobot && PMBI.autobot.__loaded) return;

    var connectionTimer = null;
    var loadingHideTimer = null;
    var frameMessageHandler = null;

    function refreshIcons(root) {
        if (PMBI.refreshLucideIcons) {
            PMBI.refreshLucideIcons(root || document);
            return;
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    function setConnection(root, state, label) {
        var badge = root.querySelector('[data-autobot-connection]');
        var status = root.querySelector('[data-autobot-status]');
        if (badge) {
            badge.classList.remove('is-connecting', 'is-online', 'is-offline');
            badge.classList.add('is-' + state);
        }
        if (status) status.textContent = label;
    }

    function clearConnectionTimer() {
        if (!connectionTimer) return;
        window.clearTimeout(connectionTimer);
        connectionTimer = null;
    }

    function clearLoadingHideTimer() {
        if (!loadingHideTimer) return;
        window.clearTimeout(loadingHideTimer);
        loadingHideTimer = null;
    }

    function showAutobotLoading(loading) {
        if (!loading) return;
        clearLoadingHideTimer();
        loading.hidden = false;
        loading.classList.remove('is-leaving');
    }

    function hideAutobotLoading(loading) {
        if (!loading) return;
        clearLoadingHideTimer();
        loading.classList.add('is-leaving');
        loadingHideTimer = window.setTimeout(function () {
            loading.hidden = true;
            loading.classList.remove('is-leaving');
            loadingHideTimer = null;
        }, 440);
    }

    function beginConnection(root, frame, forceReload) {
        var loading = root.querySelector('[data-autobot-loading]');
        var offline = root.querySelector('[data-autobot-offline]');
        var reloadButtons = root.querySelectorAll('[data-autobot-reload], [data-autobot-retry]');

        clearConnectionTimer();
        setConnection(root, 'connecting', 'Подключаемся');
        frame.classList.remove('is-ready');
        showAutobotLoading(loading);
        if (offline) offline.hidden = true;
        reloadButtons.forEach(function (button) { button.disabled = true; });

        if (forceReload) {
            var nextUrl = new URL(frame.src, window.location.href);
            nextUrl.searchParams.set('_pmbi_reload', String(Date.now()));
            frame.src = nextUrl.href;
        }

        connectionTimer = window.setTimeout(function () {
            if (!document.body.contains(root) || frame.dataset.autobotReady === '1') return;
            setConnection(root, 'offline', 'Нет соединения');
            hideAutobotLoading(loading);
            if (offline) offline.hidden = false;
            reloadButtons.forEach(function (button) { button.disabled = false; });
        }, 12000);
    }

    function handleFrameLoad(root, frame) {
        frame.dataset.autobotReady = '1';
        frame.classList.add('is-ready');
        clearConnectionTimer();
        var loading = root.querySelector('[data-autobot-loading]');
        var offline = root.querySelector('[data-autobot-offline]');
        hideAutobotLoading(loading);
        if (offline) offline.hidden = true;
        setConnection(root, 'online', 'AutoBot работает');
        root.querySelectorAll('[data-autobot-reload], [data-autobot-retry]').forEach(function (button) {
            button.disabled = false;
        });
    }

    function reload(root, frame) {
        frame.dataset.autobotReady = '0';
        beginConnection(root, frame, true);
    }

    function init() {
        var root = document.querySelector('[data-autobot-root]');
        if (!root || root.dataset.autobotBound === '1') return;
        var frame = root.querySelector('[data-autobot-frame]');
        if (!frame) return;

        root.dataset.autobotBound = '1';
        frame.dataset.autobotReady = '0';
        frameMessageHandler = function (event) {
            if (event.source !== frame.contentWindow || !event.data || event.data.type !== 'autobot:feature-modal') return;
            document.body.classList.toggle('autobot-modal-open', event.data.open === true);
        };
        window.addEventListener('message', frameMessageHandler);
        frame.addEventListener('load', function () { handleFrameLoad(root, frame); });
        frame.addEventListener('error', function () {
            frame.dataset.autobotReady = '0';
            frame.classList.remove('is-ready');
            clearConnectionTimer();
            setConnection(root, 'offline', 'Нет соединения');
            var loading = root.querySelector('[data-autobot-loading]');
            var offline = root.querySelector('[data-autobot-offline]');
            clearLoadingHideTimer();
            if (loading) {
                loading.hidden = true;
                loading.classList.remove('is-leaving');
            }
            if (offline) offline.hidden = false;
        });

        root.addEventListener('click', function (event) {
            var button = event.target.closest('[data-autobot-reload], [data-autobot-retry]');
            if (!button) return;
            event.preventDefault();
            reload(root, frame);
        });

        refreshIcons(root);
        beginConnection(root, frame, false);
    }

    function cleanup() {
        clearConnectionTimer();
        clearLoadingHideTimer();
        if (frameMessageHandler) {
            window.removeEventListener('message', frameMessageHandler);
            frameMessageHandler = null;
        }
        document.body.classList.remove('autobot-modal-open');
    }

    PMBI.autobot = { __loaded: true, init: init, cleanup: cleanup };
})();
