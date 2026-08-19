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
        app: '/assets/js/app.js?v=20260819-section-bars-3',
        daily_tasks: '/assets/js/daily-tasks.js?v=20260817-standup-inline-1',
        planning: '/assets/js/planning.js?v=20260818-section-presence-1',
        procurement: '/assets/js/procurement.js?v=20260814-operations-4',
        operations: '/assets/js/operations.js?v=20260815-employee-contacts-admin-1'
    };

    var PAGE_MODULES = {
        dashboard: [],
        daily_tasks: ['daily_tasks'],
        projects: ['planning', 'procurement', 'operations'],
        autobot: [],
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
        if (contentRoot) contentRoot.classList.toggle('is-route-loading', !!loading);
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
        return true;
    }

    function navigate(url, pushState) {
        if (!url || url.origin !== location.origin || url.pathname.indexOf('/app') !== 0) return;
        if (currentRouteUrl.href === url.href) return;
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

    function isModifiedClick(event) {
        return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    }

    PMBI.router = {
        __loaded: true,
        deferAppBoot: true,
        registerApp: registerApp,
        navigate: navigate
    };
    window.PMBI = PMBI;

    document.addEventListener('click', function (event) {
        if (isModifiedClick(event)) return;
        var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
        var url = new URL(link.href, location.href);
        if (url.origin !== location.origin || url.pathname.indexOf('/app') !== 0) return;
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
