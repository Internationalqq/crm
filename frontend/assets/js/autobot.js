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
    var automaticRetryLimit = 5;
    var crmBridgeRequests = Object.create(null);
    var crmImportInFlight = false;

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

    function autobotHealthUrl() {
        return '/api/autobot/health';
    }

    function autobotFrameOrigin(root) {
        try {
            return new URL(String(root.getAttribute('data-autobot-url') || '/autobot'), window.location.href).origin;
        } catch (error) {
            return '';
        }
    }

    function crmBridgeRequestId(data) {
        var requestId = String(data && data.requestId || '').trim();
        return /^[A-Za-z0-9:_-]{1,128}$/.test(requestId) ? requestId : '';
    }

    function postCrmBridgeResult(frame, expectedFrameOrigin, type, requestId, payload) {
        if (!frame || !frame.contentWindow || !expectedFrameOrigin || !requestId) return;
        var message = Object.assign({}, payload || {}, {
            type: type,
            requestId: requestId
        });
        frame.contentWindow.postMessage(message, expectedFrameOrigin);
    }

    function crmBridgeMessage(payload, fallback) {
        var message = payload && typeof payload.message === 'string' ? payload.message.trim() : '';
        return message || fallback;
    }

    function crmEstimateImportMessage(payload, fallback) {
        var message = crmBridgeMessage(payload, fallback);
        var issues = payload && Array.isArray(payload.issues) ? payload.issues : [];
        var issue = issues.length && issues[0] && typeof issues[0] === 'object' ? issues[0] : null;
        if (!issue) return message;
        var estimateTitle = String(issue.estimateTitle || issue.sourceKey || '').trim();
        var itemTitle = String(issue.title || '').trim();
        var position = Number(issue.position);
        var details = [];
        if (estimateTitle) details.push('смета «' + estimateTitle + '»');
        if (Number.isInteger(position) && position > 0) details.push('позиция ' + position);
        if (itemTitle) details.push('«' + itemTitle + '»');
        return details.length ? message + ' Проверьте: ' + details.join(', ') + '.' : message;
    }

    async function crmBridgeFetchJson(url, options) {
        var response = await fetch(url, options);
        var payload = {};
        try {
            payload = await response.json();
        } catch (error) {}
        return { response: response, payload: payload && typeof payload === 'object' ? payload : {} };
    }

    async function handleCrmProjectsRequest(frame, expectedFrameOrigin, data) {
        var requestId = crmBridgeRequestId(data);
        if (!requestId || crmBridgeRequests[requestId]) return;
        if (Object.keys(crmBridgeRequests).length >= 4) {
            postCrmBridgeResult(frame, expectedFrameOrigin, 'autobot:crm-projects-result', requestId, {
                ok: false,
                projects: [],
                message: 'Подождите завершения предыдущего запроса.'
            });
            return;
        }
        crmBridgeRequests[requestId] = true;
        try {
            var result = await crmBridgeFetchJson('/api/autobot/projects', {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            });
            var ok = result.response.ok && result.payload.ok !== false;
            postCrmBridgeResult(frame, expectedFrameOrigin, 'autobot:crm-projects-result', requestId, {
                ok: ok,
                projects: ok && Array.isArray(result.payload.projects) ? result.payload.projects : [],
                message: ok ? '' : crmBridgeMessage(result.payload, 'Не удалось получить доступные объекты.')
            });
        } catch (error) {
            postCrmBridgeResult(frame, expectedFrameOrigin, 'autobot:crm-projects-result', requestId, {
                ok: false,
                projects: [],
                message: 'PM.bi временно не отвечает. Повторите ещё раз.'
            });
        } finally {
            delete crmBridgeRequests[requestId];
        }
    }

    async function handleCrmEstimateImport(frame, expectedFrameOrigin, data) {
        var requestId = crmBridgeRequestId(data);
        if (!requestId || crmBridgeRequests[requestId]) return;
        var projectId = Number(data && data.projectId);
        var payload = data && data.payload;
        var hasSingleEstimate = Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray(payload.items) && payload.items.length);
        var hasEstimateBundle = Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray(payload.estimates) && payload.estimates.length && payload.estimates.every(function (estimate) {
            return estimate && typeof estimate === 'object' && !Array.isArray(estimate)
                && estimate.source && typeof estimate.source === 'object' && !Array.isArray(estimate.source)
                && Array.isArray(estimate.items) && estimate.items.length;
        }));
        if (!Number.isInteger(projectId) || projectId <= 0 || (!hasSingleEstimate && !hasEstimateBundle)) {
            postCrmBridgeResult(frame, expectedFrameOrigin, 'autobot:crm-estimate-import-result', requestId, {
                ok: false,
                message: 'Выберите объект и убедитесь, что в смете есть позиции.'
            });
            return;
        }
        if (crmImportInFlight) {
            postCrmBridgeResult(frame, expectedFrameOrigin, 'autobot:crm-estimate-import-result', requestId, {
                ok: false,
                message: 'Предыдущая смета ещё добавляется. Дождитесь завершения.'
            });
            return;
        }
        crmBridgeRequests[requestId] = true;
        crmImportInFlight = true;
        try {
            var result = await crmBridgeFetchJson('/api/autobot/projects/' + encodeURIComponent(String(projectId)) + '/estimate-import', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload)
            });
            var ok = result.response.ok && result.payload.ok !== false;
            postCrmBridgeResult(
                frame,
                expectedFrameOrigin,
                'autobot:crm-estimate-import-result',
                requestId,
                Object.assign({}, result.payload, {
                    ok: ok,
                    projectId: projectId,
                    project_id: projectId,
                    projectUrl: '/app/projects?openProject=' + encodeURIComponent(String(projectId)) + '&tab=schedule',
                    project_url: '/app/projects?openProject=' + encodeURIComponent(String(projectId)) + '&tab=schedule',
                    message: ok ? '' : crmEstimateImportMessage(result.payload, 'Не удалось добавить смету в объект.')
                })
            );
        } catch (error) {
            postCrmBridgeResult(frame, expectedFrameOrigin, 'autobot:crm-estimate-import-result', requestId, {
                ok: false,
                projectId: projectId,
                project_id: projectId,
                message: 'PM.bi не подтвердила результат. Откройте объект и проверьте сметы перед повтором.'
            });
        } finally {
            crmImportInFlight = false;
            delete crmBridgeRequests[requestId];
        }
    }

    function handleCrmNavigation(data) {
        var href = String(data && (data.href || data.url) || '').trim();
        if (!href) return;
        try {
            var url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin || url.pathname !== '/app/projects') return;
            window.location.href = url.pathname + url.search + url.hash;
        } catch (error) {}
    }

    async function checkAutobotHealth(root) {
        cancelHealthCheck();
        var controller = new AbortController();
        healthAbortController = controller;
        var timeout = window.setTimeout(function () { controller.abort(); }, 4500);
        try {
            var response = await fetch(autobotHealthUrl(), {
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
        if (retryAttempt >= automaticRetryLimit) {
            markOffline(root, frame, 'AutoBot недоступен — повторите вручную');
            return;
        }
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
        var expectedFrameOrigin = autobotFrameOrigin(root);
        frameMessageHandler = function (event) {
            if (!expectedFrameOrigin || event.origin !== expectedFrameOrigin || event.source !== frame.contentWindow || !event.data) return;
            if (event.data.type === 'autobot:crm-projects-request') {
                handleCrmProjectsRequest(frame, expectedFrameOrigin, event.data);
                return;
            }
            if (event.data.type === 'autobot:crm-estimate-import') {
                handleCrmEstimateImport(frame, expectedFrameOrigin, event.data);
                return;
            }
            if (event.data.type === 'pmbi:navigate') {
                handleCrmNavigation(event.data);
                return;
            }
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
        crmBridgeRequests = Object.create(null);
        crmImportInFlight = false;
        if (frameMessageHandler) {
            window.removeEventListener('message', frameMessageHandler);
            frameMessageHandler = null;
        }
        document.body.classList.remove('autobot-modal-open', 'autobot-topbar-hidden');
    }

    PMBI.autobot = { __loaded: true, init: init, cleanup: cleanup };
})();
