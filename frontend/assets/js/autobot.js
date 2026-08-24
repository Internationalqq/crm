(function () {
    'use strict';

    var PMBI = window.PMBI = window.PMBI || {};
    if (PMBI.autobot && PMBI.autobot.__loaded) return;

    var connectionTimer = null;
    var loadingHideTimer = null;
    var retryTimer = null;
    var healthAbortController = null;
    var frameMessageHandler = null;
    var connectionGeneration = 0;
    var retryAttempt = 0;

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

    function clearRetryTimer() {
        if (!retryTimer) return;
        window.clearTimeout(retryTimer);
        retryTimer = null;
    }

    function cancelHealthCheck() {
        if (!healthAbortController) return;
        healthAbortController.abort();
        healthAbortController = null;
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

    function autobotHealthUrl(root) {
        var base = String(root.getAttribute('data-autobot-url') || '/autobot').replace(/\/+$/, '');
        return new URL(base + '/healthz', window.location.href).href;
    }

    async function checkAutobotHealth(root) {
        cancelHealthCheck();
        var controller = new AbortController();
        healthAbortController = controller;
        var timeout = window.setTimeout(function () { controller.abort(); }, 4500);
        try {
            var response = await fetch(autobotHealthUrl(root), {
                cache: 'no-store',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });
            if (!response.ok) return false;
            var payload = await response.json();
            return payload && payload.ok === true;
        } catch (error) {
            return false;
        } finally {
            window.clearTimeout(timeout);
            if (healthAbortController === controller) healthAbortController = null;
        }
    }

    function markOffline(root, frame, label) {
        frame.dataset.autobotReady = '0';
        frame.classList.remove('is-ready');
        clearConnectionTimer();
        setConnection(root, 'offline', label || 'Нет соединения');
        var loading = root.querySelector('[data-autobot-loading]');
        var offline = root.querySelector('[data-autobot-offline]');
        clearLoadingHideTimer();
        if (loading) {
            loading.hidden = true;
            loading.classList.remove('is-leaving');
        }
        if (offline) offline.hidden = false;
        root.querySelectorAll('[data-autobot-reload], [data-autobot-retry]').forEach(function (button) {
            button.disabled = false;
        });
    }

    function scheduleRetry(root, frame) {
        if (retryTimer || !document.body.contains(root)) return;
        retryAttempt += 1;
        var delay = Math.min(10000, 1000 * Math.pow(2, Math.min(retryAttempt - 1, 3)));
        setConnection(root, 'connecting', 'AutoBot перезапускается');
        retryTimer = window.setTimeout(function () {
            retryTimer = null;
            if (!document.body.contains(root)) return;
            reload(root, frame);
        }, delay);
    }

    function beginConnection(root, frame, forceReload) {
        var loading = root.querySelector('[data-autobot-loading]');
        var offline = root.querySelector('[data-autobot-offline]');
        var reloadButtons = root.querySelectorAll('[data-autobot-reload], [data-autobot-retry]');

        clearConnectionTimer();
        clearRetryTimer();
        connectionGeneration += 1;
        setConnection(root, 'connecting', retryAttempt ? 'Переподключаем AutoBot' : 'Подключаемся');
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
            markOffline(root, frame, 'AutoBot пока недоступен');
            scheduleRetry(root, frame);
        }, 12000);
    }

    function markFrameReady(root, frame) {
        frame.dataset.autobotReady = '1';
        frame.classList.add('is-ready');
        clearConnectionTimer();
        clearRetryTimer();
        retryAttempt = 0;
        var loading = root.querySelector('[data-autobot-loading]');
        var offline = root.querySelector('[data-autobot-offline]');
        hideAutobotLoading(loading);
        if (offline) offline.hidden = true;
        setConnection(root, 'online', 'AutoBot работает');
        root.querySelectorAll('[data-autobot-reload], [data-autobot-retry]').forEach(function (button) {
            button.disabled = false;
        });
    }

    function handleFrameLoad(root, frame) {
        var generation = connectionGeneration;
        checkAutobotHealth(root).then(function (healthy) {
            if (generation !== connectionGeneration || !document.body.contains(root)) return;
            if (healthy) {
                markFrameReady(root, frame);
                return;
            }
            frame.dataset.autobotReady = '0';
            frame.classList.remove('is-ready');
            setConnection(root, 'connecting', 'Ждём запуска AutoBot');
            scheduleRetry(root, frame);
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
            if (event.source !== frame.contentWindow || !event.data) return;
            if (event.data.type === 'autobot:feature-modal') {
                document.body.classList.toggle('autobot-modal-open', event.data.open === true);
                return;
            }
            if (event.data.type === 'autobot:scroll') {
                document.body.classList.toggle('autobot-topbar-hidden', event.data.scrolled === true);
            }
        };
        window.addEventListener('message', frameMessageHandler);
        frame.addEventListener('load', function () { handleFrameLoad(root, frame); });
        frame.addEventListener('error', function () {
            markOffline(root, frame, 'Нет соединения');
            scheduleRetry(root, frame);
        });

        root.addEventListener('click', function (event) {
            var button = event.target.closest('[data-autobot-reload], [data-autobot-retry]');
            if (!button) return;
            event.preventDefault();
            retryAttempt = 0;
            reload(root, frame);
        });

        refreshIcons(root);
        beginConnection(root, frame, false);
    }

    function cleanup() {
        connectionGeneration += 1;
        clearConnectionTimer();
        clearLoadingHideTimer();
        clearRetryTimer();
        cancelHealthCheck();
        if (frameMessageHandler) {
            window.removeEventListener('message', frameMessageHandler);
            frameMessageHandler = null;
        }
        document.body.classList.remove('autobot-modal-open', 'autobot-topbar-hidden');
    }

    PMBI.autobot = { __loaded: true, init: init, cleanup: cleanup };
})();
