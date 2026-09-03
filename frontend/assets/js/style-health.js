(function () {
    'use strict';

    if (window.PMBIStyleHealth && window.PMBIStyleHealth.__loaded) return;

    var BUILD_ID = '20260902-report-ux-r1';
    var PROBES = [
        {
            key: 'tokens',
            property: '--pmbi-style-tokens-ready',
            href: '/assets/css/tokens.css',
            pages: null,
            core: true
        },
        {
            key: 'shell',
            property: '--pmbi-style-shell-ready',
            href: '/assets/css/shell.css',
            pages: null,
            core: true
        },
        {
            key: 'reports',
            property: '--pmbi-style-reports-ready',
            href: '/assets/css/project-reports.css',
            pages: ['projects', 'logs'],
            core: false
        },
        {
            key: 'planning',
            property: '--pmbi-style-planning-ready',
            href: '/assets/css/planning.css',
            pages: ['projects', 'schedule'],
            core: false
        }
    ];
    var APP_STYLES = {
        key: 'app',
        href: '/assets/app.css'
    };
    var autoRetryUsed = false;
    var retryInFlight = false;
    var retrySequence = 0;
    var scheduledCheck = null;
    var notice = null;
    var noticeText = null;
    var noticeButton = null;

    function currentPage() {
        return String(document.body && document.body.dataset && document.body.dataset.page || '')
            .trim()
            .toLowerCase();
    }

    function expectedProbes() {
        var page = currentPage();
        return PROBES.filter(function (probe) {
            return !probe.pages || probe.pages.indexOf(page) !== -1;
        });
    }

    function probeReady(probe) {
        try {
            var styles = window.getComputedStyle(document.documentElement);
            return String(styles.getPropertyValue(probe.property) || '').trim() === '1';
        } catch (error) {
            return false;
        }
    }

    function missingStyles() {
        return expectedProbes().filter(function (probe) {
            return !probeReady(probe);
        });
    }

    function ensureNotice() {
        if (notice || !document.body) return notice;

        notice = document.createElement('div');
        notice.className = 'style-health-notice';
        notice.hidden = true;
        notice.setAttribute('data-style-health-notice', '');
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.setAttribute('aria-atomic', 'true');

        noticeText = document.createElement('span');
        noticeText.setAttribute('data-style-health-text', '');

        noticeButton = document.createElement('button');
        noticeButton.type = 'button';
        noticeButton.textContent = 'Повторить';
        noticeButton.setAttribute('data-style-health-retry', '');
        noticeButton.setAttribute('aria-label', 'Повторно загрузить оформление');
        noticeButton.addEventListener('click', function () {
            retryManually();
        });

        notice.appendChild(noticeText);
        notice.appendChild(noticeButton);
        document.body.appendChild(notice);
        return notice;
    }

    function showNotice(message, busy) {
        if (!ensureNotice()) return;
        noticeText.textContent = message;
        noticeButton.disabled = !!busy;
        noticeButton.textContent = busy ? 'Проверяем…' : 'Повторить';
        notice.hidden = false;
    }

    function hideNotice() {
        if (!notice) return;
        notice.hidden = true;
        noticeButton.disabled = false;
        noticeButton.textContent = 'Повторить';
    }

    function retryHref(href) {
        var url = new URL(href, window.location.href);
        url.search = '';
        retrySequence += 1;
        url.searchParams.set('style-retry', BUILD_ID + '-' + Date.now() + '-' + retrySequence);
        return url.href;
    }

    function removeOlderSuccessfulRetries(key, current) {
        var selector = 'link[data-pmbi-style-retry="' + key + '"]';
        Array.prototype.forEach.call(document.querySelectorAll(selector), function (link) {
            if (link !== current && link.dataset.pmbiStyleLoaded === '1' && link.parentNode) {
                link.parentNode.removeChild(link);
            }
        });
    }

    function loadStylesheet(target) {
        return new Promise(function (resolve) {
            var link = document.createElement('link');
            var settled = false;
            var timeout = null;

            function finish(loaded) {
                if (settled) return;
                settled = true;
                if (timeout) clearTimeout(timeout);
                if (loaded) {
                    link.dataset.pmbiStyleLoaded = '1';
                    removeOlderSuccessfulRetries(target.key, link);
                } else if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
                resolve(loaded);
            }

            link.rel = 'stylesheet';
            link.href = retryHref(target.href);
            link.dataset.pmbiStyleRetry = target.key;
            link.onload = function () { finish(true); };
            link.onerror = function () { finish(false); };
            timeout = setTimeout(function () { finish(false); }, 8000);
            document.head.appendChild(link);
        });
    }

    function retryTargets(missing) {
        var targets = [];
        var needsAppStyles = missing.some(function (probe) { return probe.core; });
        if (needsAppStyles) targets.push(APP_STYLES);
        missing.forEach(function (probe) {
            targets.push(probe);
        });
        return targets;
    }

    function waitForCascade() {
        return new Promise(function (resolve) {
            setTimeout(resolve, 220);
        });
    }

    function retryMissingStyles(missing, automatic) {
        if (!missing.length || retryInFlight) return Promise.resolve(false);
        if (automatic) {
            if (autoRetryUsed) return Promise.resolve(false);
            autoRetryUsed = true;
        }

        retryInFlight = true;
        if (!automatic) showNotice('Проверяем оформление…', true);

        return Promise.all(retryTargets(missing).map(loadStylesheet))
            .then(waitForCascade)
            .then(function () {
                var remaining = missingStyles();
                retryInFlight = false;
                if (remaining.length) {
                    showNotice('Оформление загрузилось не полностью', false);
                    return false;
                }
                hideNotice();
                return true;
            }, function () {
                retryInFlight = false;
                showNotice('Оформление загрузилось не полностью', false);
                return false;
            });
    }

    function checkNow() {
        if (retryInFlight) return Promise.resolve(false);
        var missing = missingStyles();
        if (!missing.length) {
            hideNotice();
            return Promise.resolve(true);
        }
        if (navigator.onLine === false) {
            showNotice('Нет сети — оформление догрузится после подключения', false);
            return Promise.resolve(false);
        }
        if (!autoRetryUsed) return retryMissingStyles(missing, true);
        showNotice('Оформление загрузилось не полностью', false);
        return Promise.resolve(false);
    }

    function retryManually() {
        if (retryInFlight) return Promise.resolve(false);
        var missing = missingStyles();
        if (!missing.length) {
            hideNotice();
            return Promise.resolve(true);
        }
        if (navigator.onLine === false) {
            showNotice('Нет сети — оформление догрузится после подключения', false);
            return Promise.resolve(false);
        }
        return retryMissingStyles(missing, false);
    }

    function scheduleCheck(delay) {
        if (scheduledCheck) clearTimeout(scheduledCheck);
        scheduledCheck = setTimeout(function () {
            scheduledCheck = null;
            checkNow();
        }, typeof delay === 'number' ? delay : 180);
    }

    var api = {
        __loaded: true,
        checkNow: checkNow,
        retryManually: retryManually,
        expectedProbes: expectedProbes,
        missingStyles: missingStyles,
        getState: function () {
            return {
                autoRetryUsed: autoRetryUsed,
                retryInFlight: retryInFlight
            };
        }
    };
    window.PMBIStyleHealth = api;

    window.addEventListener('online', function () {
        scheduleCheck(80);
    });

    if (window.MutationObserver && document.body) {
        new MutationObserver(function (mutations) {
            var pageChanged = mutations.some(function (mutation) {
                return mutation.type === 'attributes' && mutation.attributeName === 'data-page';
            });
            if (pageChanged) scheduleCheck(180);
        }).observe(document.body, { attributes: true, attributeFilter: ['data-page'] });
    }

    if (!window.__PMBI_STYLE_HEALTH_TEST__) {
        if (document.readyState === 'complete') scheduleCheck(180);
        else window.addEventListener('load', function () { scheduleCheck(180); }, { once: true });
    }
})();
