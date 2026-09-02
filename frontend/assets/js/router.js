(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    if (PMBI.router && PMBI.router.__loaded) return;
    PMBI.router = PMBI.router || {};
    PMBI.router.__loaded = true;
    var contentRoot = document.querySelector('main.content');
    var activeRequest = null;
    var navigationToken = 0;
    var currentRouteUrl = new URL(location.href);
    var appBoot = null;
    var appStarted = false;
    var scriptPromises = {};

    var SCRIPT_URLS = {
        app: '/assets/js/app.js?v=20260826-photo-autobot-1-quantity-normalization-1-bulk-section-completion-1-crm-skeletons-1-works-only-1-project-reports-workspace-1-documents-workspace-1-object-tasks-workspace-1-finance-workspace-1-20260824-project-alerts-in-bell-1-finance-delete-1-object-control-1-reports-wording-7-payables-minimal-1-finance-overview-cleanup-1-reminder-bell-rebind-2-report-refresh-8-report-calendar-bridge-11-bulk-label-2-foreman-nav-3-smart-daily-report-4-foreman-flow-7-horizontal-wheel-1-reminder-center-2-reminder-object-orders-3-motion-1-position-editor-1-report-live-suggestions-16-kind-switch-1-works-bulk-right-1-position-duration-1-report-action-history-18-logout-to-guest-19-report-voice-feedback-20-documents-context-actions-2-project-responsibles-1-estimate-repair-1-report-rich-shifts-21-credential-guest-22-guest-access-modal-fix-23-report-draft-autosave-24-project-company-filter-25-report-parser-safety-28-report-quantity-actions-29-tabs-a11y-30-report-icon-minimal-32-report-sheet-minimal-34-report-final-structured-36-report-saved-structured-37-report-browser-qa-39-report-touch-qa-40-report-unit-fallback-qa-43-report-manual-quantity-qa-44-report-copy-spacing-qa-45-report-backdrop-click-qa-46-report-mobile-sheet-qa-47-report-layering-qa-48-report-mobile-header-qa-49-report-manual-sync-qa-50-report-work-limit-qa-51-report-target-floor-qa-52-works-quantity-dialog-18-report-unified-ready-53-report-description-first-55-reminder-day-focus-4-report-corrections-59-material-use-correction-1',
        autobot: '/assets/js/autobot.js?v=20260824-autobot-scroll-head-1-same-origin-health-3-origin-retry-cap-1',
        daily_tasks: '/assets/js/daily-tasks.js?v=20260817-standup-inline-1',
        planning: '/assets/js/planning.js?v=20260826-production-scroll-align-1-production-zone-wheel-2-production-zone-cursor-3-production-compact-center-4-production-single-sticky-head-5-production-duration-lift-dotless-6-production-moving-metrics-control-lift-7-schedule-minimal-1-multi-estimate-files-1-production-halfday-1-price-table-4-sticky-viewport-1-bulk-section-completion-1-crm-skeletons-1-works-only-1-autoplan-calendar-1-market-materials-1-work-register-3-mobile-table-foundation-4-summary-checkboxes-5-horizontal-wheel-1-position-editor-1-production-stepper-neutral-2-production-editor-3-works-bulk-right-1-position-duration-1-works-bulk-title-3-works-metrics-edge-6-work-head-icons-7-estimate-repair-1-works-plan-fact-14-works-progress-tones-15-works-quantity-dialog-18-production-sticky-viewport-8-production-print-pdf-2',
        procurement: '/assets/js/procurement.js?v=20260821-quantity-normalization-1-crm-skeletons-1-foreman-flow-1-warehouse-modal-a11y-2-safe-supplier-url-3-modal-listener-4-modal-focus-5-warehouse-error-retry-6',
        estimate_reconciliation: '/assets/js/estimate-reconciliation.js?v=20260821-estimate-reconciliation-1-crm-skeletons-1-estimate-repair-1',
        warehouse_control: '/assets/js/warehouse-control.js?v=20260824-object-inventory-register-2-dialogs-3-portal-a11y-4-order-semantics-5-foreman-flow-6-position-editor-1-material-flow-7-inventory-head-cleanup-8-material-section-groups-9-row-click-10-row-actions-removed-11-modal-icons-12-fill-max-13-stock-move-reversal-14-material-use-correction-1',
        economics_management: '/assets/js/economics-management.js?v=20260821-economics-workspace-1-crm-skeletons-1-finance-workspace-1',
        operations: '/assets/js/operations.js?v=20260826-project-navigation-1-price-table-1-crm-skeletons-1-project-reports-workspace-1-project-report-modal-1-report-modal-cool-2-report-modal-native-3-report-create-plus-5-report-submit-fix-6-object-control-1-reports-wording-7-report-refresh-8-report-calendar-9-report-calendar-apple-10-report-load-12-foreman-actions-13-smart-daily-report-14-foreman-flow-16-report-live-suggestions-16-report-entry-hierarchy-17-report-action-history-18-estimate-repair-1-report-rich-shifts-21-credential-guest-22-guest-access-modal-fix-23-report-draft-autosave-24-project-company-filter-25-report-flow-cleanup-27-report-quantity-actions-29-drawer-a11y-30-report-icon-minimal-32-report-sheet-minimal-34-report-final-structured-36-report-saved-structured-37-report-browser-qa-39-report-touch-qa-40-report-unit-fallback-qa-43-report-manual-quantity-qa-44-report-copy-spacing-qa-45-report-backdrop-click-qa-46-report-mobile-sheet-qa-47-report-layering-qa-48-report-mobile-header-qa-49-report-manual-sync-qa-50-report-work-limit-qa-51-report-target-floor-qa-52-report-unified-ready-53-report-description-first-55-report-input-label-hidden-56-report-compact-fields-57-reminder-day-focus-4-report-corrections-59'
    };

    var PAGE_MODULES = {
        dashboard: [],
        daily_tasks: ['daily_tasks'],
        projects: ['planning', 'procurement', 'estimate_reconciliation', 'warehouse_control', 'economics_management', 'operations'],
        autobot: ['autobot'],
        schedule: ['planning', 'procurement'],
        logs: ['planning', 'operations'],
        warehouse: ['procurement'],
        suppliers: ['procurement'],
        users: ['operations'],
        companies: ['procurement', 'operations']
    };

    function scriptKey(url) {
        return url.split('?')[0];
    }

    function loadScript(url) {
        var key = scriptKey(url);
        if (scriptPromises[key]) return scriptPromises[key];
        var existing = document.querySelector('script[data-pmbi-script="' + key + '"]');
        if (existing) return Promise.resolve();
        scriptPromises[key] = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = url;
            script.defer = true;
            script.dataset.pmbiScript = key;
            script.onload = resolve;
            script.onerror = function () {
                delete scriptPromises[key];
                reject(new Error('script_load_failed:' + key));
            };
            document.head.appendChild(script);
        });
        return scriptPromises[key];
    }

    function pageFromDocument(doc) {
        return doc.body && doc.body.dataset ? doc.body.dataset.page : '';
    }

    function pageFromPath(pathname) {
        if (pathname === '/app' || pathname === '/app/dashboard') return 'dashboard';
        var match = pathname.match(/^\/app\/([^/]+)/);
        return match ? match[1].replace(/-/g, '_') : '';
    }

    function isAppPath(pathname) {
        return pathname === '/app' || pathname.indexOf('/app/') === 0;
    }

    function isHashOnlyNavigation(url) {
        return url.pathname === currentRouteUrl.pathname
            && url.search === currentRouteUrl.search
            && url.hash !== currentRouteUrl.hash;
    }

    function modulesForPage(page) {
        return PAGE_MODULES[page] || [];
    }

    function ensureScriptsForPage(page) {
        var urls = [SCRIPT_URLS.app];
        modulesForPage(page).forEach(function (moduleName) {
            if (SCRIPT_URLS[moduleName]) urls.push(SCRIPT_URLS[moduleName]);
        });
        return urls.reduce(function (promise, url) {
            return promise.then(function () { return loadScript(url); });
        }, Promise.resolve());
    }

    function startAppIfReady() {
        if (appStarted || !appBoot) return;
        appStarted = true;
        appBoot();
    }

    function registerApp(boot) {
        appBoot = boot;
        ensureScriptsForPage(PMBI.page || pageFromPath(location.pathname)).then(startAppIfReady).catch(function (error) {
            console.error('PM.bi app initialization failed', error);
        });
    }

    function setRouteLoading(loading) {
        if (!contentRoot) return;
        contentRoot.classList.toggle('is-route-loading', !!loading);
        contentRoot.setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    function fallbackNavigation(url) {
        window.location.assign(url.href);
    }

    function replaceContent(doc, url) {
        var nextContent = doc.querySelector('main.content');
        if (!nextContent || !contentRoot) {
            fallbackNavigation(url);
            return false;
        }
        var nextPage = pageFromDocument(doc) || pageFromPath(url.pathname);
        if (!nextPage) {
            fallbackNavigation(url);
            return false;
        }

        contentRoot.replaceChildren.apply(contentRoot, Array.prototype.slice.call(nextContent.childNodes));
        Array.prototype.forEach.call(contentRoot.children, function (node) {
            node.classList.add('pmbi-fade-in');
        });
        document.body.dataset.page = nextPage;
        PMBI.page = nextPage;
        currentRouteUrl = new URL(url.href);
        if (doc.title) document.title = doc.title;
        if (window.scrollTo) window.scrollTo(0, 0);
        if (PMBI.app && typeof PMBI.app.setPage === 'function') PMBI.app.setPage(nextPage);
        if (PMBI.refreshLucideIcons) PMBI.refreshLucideIcons(contentRoot);
        if (typeof contentRoot.focus === 'function') {
            try { contentRoot.focus({ preventScroll: true }); } catch (focusError) { contentRoot.focus(); }
        }
        return true;
    }

    function navigate(url, pushState) {
        if (!url || url.origin !== location.origin || !isAppPath(url.pathname)) return;
        if (currentRouteUrl.href === url.href) return;
        if (isHashOnlyNavigation(url)) {
            currentRouteUrl = new URL(url.href);
            return;
        }
        var token = ++navigationToken;
        if (activeRequest) activeRequest.abort();
        activeRequest = new AbortController();
        setRouteLoading(true);
        fetch(url.href, {
            credentials: 'same-origin',
            headers: { 'Accept': 'text/html', 'X-PMBI-SPA': '1' },
            signal: activeRequest.signal
        }).then(function (response) {
            if (!response.ok) throw new Error('route_load_failed:' + response.status);
            return response.text();
        }).then(function (html) {
            if (token !== navigationToken) return;
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var nextPage = pageFromDocument(doc) || pageFromPath(url.pathname);
            return ensureScriptsForPage(nextPage).then(function () {
                if (token !== navigationToken) return;
                if (pushState) history.pushState({}, '', url.href);
                replaceContent(doc, url);
            });
        }).catch(function (error) {
            if (error && error.name === 'AbortError') return;
            console.error('SPA navigation failed', error);
            fallbackNavigation(url);
        }).finally(function () {
            if (token === navigationToken) {
                activeRequest = null;
                setRouteLoading(false);
            }
        });
    }

    function syncCurrentUrl() {
        currentRouteUrl = new URL(location.href);
    }

    function isModifiedClick(event) {
        return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    }

    PMBI.router = {
        __loaded: true,
        deferAppBoot: true,
        registerApp: registerApp,
        navigate: navigate,
        syncCurrentUrl: syncCurrentUrl
    };
    window.PMBI = PMBI;

    document.addEventListener('click', function (event) {
        if (isModifiedClick(event)) return;
        var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
        var url = new URL(link.href, location.href);
        if (url.origin !== location.origin || !isAppPath(url.pathname)) return;
        if (isHashOnlyNavigation(url)) return;
        if (link.classList.contains('reminder-item') && PMBI.app && typeof PMBI.app.handleReminderNavigation === 'function') {
            try {
                if (PMBI.app.handleReminderNavigation(url, link)) {
                    event.preventDefault();
                    syncCurrentUrl();
                    return;
                }
            } catch (localRouteError) {
                console.error('Reminder navigation failed', localRouteError);
            }
        }
        event.preventDefault();
        navigate(url, true);
    }, true);

    window.addEventListener('popstate', function () {
        navigate(new URL(location.href), false);
    });

    PMBI.page = document.body.dataset.page || pageFromPath(location.pathname);
    ensureScriptsForPage(PMBI.page).then(startAppIfReady).catch(function (error) {
        console.error('PM.bi script initialization failed', error);
    });
})();
