(function () {
    'use strict';

    var page = document.body.dataset.page;
    var APP_TODAY = (function () {
        var date = new Date();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return date.getFullYear() + '-' + month + '-' + day;
    })();
    var state = {
        user: null,
        currentUser: null,
        projects: [],
        users: [],
        dailyTasks: [],
        dailyArchive: [],
        dailyTasksRequestToken: 0,
        dailyArchiveRequestToken: 0,
        teamRefreshTimer: null,
        dailySelectedUserId: 'all',
        dailyMyOnly: false,
        dailyCompletionTimers: {},
        roles: [],
        companies: [],
        companiesAllLoaded: false,
        selectedProject: null,
        projectLoadingToken: 0,
        selectedProjectLoadingToken: null,
        stagesByProject: {},
        materialsByProject: {},
        materialInsightsByProject: {},
        marketAnalysisByProject: {},
        marketAnalysisPollTimers: {},
        materialCounterpartyFiltersByProject: {},
        notificationsByProject: {},
        materialScheduleByProject: {},
        materialScheduleCallbacksByProject: {},
        materialScheduleLoadingByProject: {},
        materialScheduleSelectedDayByProject: {},
        materialScheduleVersionByProject: {},
        materialScheduleViewByProject: {},
        renderingScheduleForProject: null,
        isMaterialScheduleRendering: false,
        schedulePlanByProject: {},
        scheduleProjectDetailsByProject: {},
        scheduleProjectLoadingByProject: {},
        scheduleProjectOpenByProject: {},
        sectionScheduleByProject: {},
        scheduleQuickActions: {},
        projectTabModesByProject: {},
        logsCalendarMonthByProject: {},
        logsSelectedDateByProject: {},
        projectLogsByProject: {},
        projectReportEffectsByProject: {},
        supplierOffers: [],
        warehouseCatalog: [],
        warehouseItems: [],
        dashboard: null,
        reportsBundle: null,
        authConfig: window.__PMBI_AUTH__ || {}
    };
    var REMEMBER_SESSION_KEY = 'pmbi_remember_session';
    var AUTO_LOGIN_ATTEMPT_KEY = 'pmbi_auto_login_attempted';
    var USER_INITIAL_CACHE_KEY = 'pmbi_current_user_initial';
    var USER_AVATAR_CACHE_KEY = 'pmbi_current_user_avatar';
    var currentUserPromise = null;
    var apiMemoryCache = Object.create(null);
    var apiInFlight = Object.create(null);
    var apiRequestGroups = Object.create(null);

    function rememberSessionEnabled() {
        try {
            return window.localStorage.getItem(REMEMBER_SESSION_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function setRememberSession(enabled) {
        try {
            if (enabled) window.localStorage.setItem(REMEMBER_SESSION_KEY, '1');
            else window.localStorage.removeItem(REMEMBER_SESSION_KEY);
        } catch (error) {}
    }

    function wasAutoLoginAttempted() {
        try {
            return window.sessionStorage.getItem(AUTO_LOGIN_ATTEMPT_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function markAutoLoginAttempted() {
        try {
            window.sessionStorage.setItem(AUTO_LOGIN_ATTEMPT_KEY, '1');
        } catch (error) {}
    }

    function clearAutoLoginAttempt() {
        try {
            window.sessionStorage.removeItem(AUTO_LOGIN_ATTEMPT_KEY);
        } catch (error) {}
    }

    function clearSessionCookieFallback() {
        try {
            document.cookie = 'pmbi_session=; Path=/; Max-Age=0; SameSite=Lax';
        } catch (error) {}
    }

    function resetRememberAuthState() {
        setRememberSession(false);
        clearAutoLoginAttempt();
        state.user = null;
        state.currentUser = null;
        currentUserPromise = null;
        clearApiCache();
        clearSessionCookieFallback();
        return api('/api/auth/logout', {
            method: 'POST',
            silentLoader: true
        }).catch(function () {
            clearSessionCookieFallback();
        });
    }

    function applyCurrentUser(user) {
        state.user = user || null;
        state.currentUser = user || null;
        if (user) {
            rememberUserInitial(user);
            rememberUserAvatar(user);
        }
        try {
            window.dispatchEvent(new CustomEvent('pmbi:user-updated', { detail: { user: user || null } }));
        } catch (error) {}
        return user;
    }

    function loadCurrentUser(options) {
        options = options || {};
        if (!options.force && state.currentUser) return Promise.resolve(state.currentUser);
        if (!options.force && currentUserPromise) return currentUserPromise;
        currentUserPromise = api('/api/auth/me', {
            silentLoader: options.silentLoader === true,
            cacheKey: 'current-user',
            cacheTtl: 5 * 60 * 1000,
            requestGroup: 'current-user'
        }).then(function (data) {
            currentUserPromise = null;
            if (!data || !data.user) {
                var error = new Error('auth_required');
                error.status = 401;
                throw error;
            }
            return applyCurrentUser(data && data.user);
        }).catch(function (error) {
            currentUserPromise = null;
            state.user = null;
            state.currentUser = null;
            throw error;
        });
        return currentUserPromise;
    }

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function readStoredJson(key) {
        try {
            return JSON.parse(window.localStorage.getItem(key) || '{}') || {};
        } catch (error) {
            return {};
        }
    }

    function writeStoredJson(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value || {}));
        } catch (error) {}
    }

    function safeReplaceChildren(container, htmlContent) {
        var node = typeof container === 'string' ? qs(container) : container;
        if (!node) return null;
        while (node.firstChild) node.removeChild(node.firstChild);
        if (htmlContent == null || htmlContent === '') return node;
        if (htmlContent.nodeType) {
            node.appendChild(htmlContent);
            return node;
        }
        if (typeof htmlContent !== 'string') {
            node.textContent = String(htmlContent);
            return node;
        }
        try {
            var range = document.createRange();
            range.selectNodeContents(node);
            node.appendChild(range.createContextualFragment(htmlContent));
        } catch (error) {
            var template = document.createElement('template');
            template.innerHTML = htmlContent;
            node.appendChild(template.content.cloneNode(true));
        }
        return node;
    }

    function refreshLucideIcons(root) {
        if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
        var node = root && root.nodeType ? root : document;
        window.lucide.createIcons({
            root: node,
            attrs: {
                'aria-hidden': 'true'
            }
        });
    }

    function showAppNotice(message, type) {
        var root = qs('[data-app-notice-root]');
        var noticeType = ['success', 'error', 'warn'].indexOf(type) !== -1 ? type : 'error';
        if (!root) {
            root = document.createElement('div');
            root.className = 'app-notice-root';
            root.setAttribute('data-app-notice-root', '');
            root.setAttribute('aria-live', 'polite');
            document.body.appendChild(root);
        }
        var notice = document.createElement('div');
        notice.className = 'app-notice app-notice-' + noticeType;
        notice.setAttribute('role', noticeType === 'error' ? 'alert' : 'status');
        notice.textContent = message || '';
        root.appendChild(notice);
        requestAnimationFrame(function () {
            notice.classList.add('active');
        });
        setTimeout(function () {
            notice.classList.remove('active');
            setTimeout(function () {
                if (notice.parentNode) notice.parentNode.removeChild(notice);
            }, 220);
        }, 4200);
        return notice;
    }

    var loaderHideTimeout = null;
    var loaderCleanupTimeout = null;
    var loaderStartTime = 0;
    var loaderActiveCount = 0;
    var loaderDisplayText = 'Синхронизация...';
    var MIN_LOADER_TIME = 450;

    function ensureGlobalLoader() {
        var loaderEl = document.querySelector('.global-app-loader');
        if (loaderEl) return loaderEl;
        loaderEl = document.createElement('div');
        loaderEl.className = 'global-app-loader';
        loaderEl.setAttribute('role', 'status');
        loaderEl.setAttribute('aria-live', 'polite');
        loaderEl.innerHTML = '<div class="loader-spinner-ring" aria-hidden="true"></div><div class="loader-spinner-text">Синхронизация...</div>';
        document.body.appendChild(loaderEl);
        return loaderEl;
    }

    window.showLoader = function (text) {
        var loaderEl = ensureGlobalLoader();
        var nextText = String(text || loaderDisplayText || 'Синхронизация...');
        var textEl = loaderEl.querySelector('.loader-spinner-text');
        loaderDisplayText = nextText;
        loaderActiveCount += 1;
        if (loaderHideTimeout) {
            clearTimeout(loaderHideTimeout);
            loaderHideTimeout = null;
        }
        if (loaderCleanupTimeout) {
            clearTimeout(loaderCleanupTimeout);
            loaderCleanupTimeout = null;
        }
        if (textEl) textEl.textContent = nextText;
        if (!loaderEl.classList.contains('is-active')) {
            loaderStartTime = Date.now();
        }
        loaderEl.classList.remove('is-hiding');
        requestAnimationFrame(function () {
            loaderEl.classList.add('is-active');
        });
    };

    window.hideLoader = function () {
        var loaderEl = document.querySelector('.global-app-loader');
        if (!loaderEl) return;
        if (loaderActiveCount > 0) loaderActiveCount -= 1;
        if (loaderActiveCount > 0) return;
        var elapsed = Date.now() - loaderStartTime;
        var delay = elapsed < MIN_LOADER_TIME ? (MIN_LOADER_TIME - elapsed) : 0;
        if (loaderHideTimeout) clearTimeout(loaderHideTimeout);
        if (loaderCleanupTimeout) clearTimeout(loaderCleanupTimeout);
        loaderHideTimeout = setTimeout(function () {
            if (loaderActiveCount > 0) return;
            loaderEl.classList.add('is-hiding');
            loaderCleanupTimeout = setTimeout(function () {
                if (loaderActiveCount > 0) return;
                loaderEl.classList.remove('is-active', 'is-hiding');
            }, 300);
        }, delay);
    };

    function ensureTopProgressBar() {
        var barEl = document.querySelector('.global-top-progress-bar');
        if (barEl) return barEl;
        barEl = document.createElement('div');
        barEl.className = 'global-top-progress-bar';
        barEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(barEl);
        return barEl;
    }

    window.showLoader = function () {
        var barEl = ensureTopProgressBar();
        loaderActiveCount += 1;
        barEl.style.transition = 'width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.2s ease';
        barEl.classList.remove('is-finishing', 'is-loading');
        void barEl.offsetWidth;
        requestAnimationFrame(function () {
            barEl.classList.add('is-loading');
        });
    };

    window.hideLoader = function () {
        var barEl = document.querySelector('.global-top-progress-bar');
        if (!barEl) return;
        if (loaderActiveCount > 0) loaderActiveCount -= 1;
        if (loaderActiveCount > 0) return;
        barEl.classList.remove('is-loading');
        barEl.classList.add('is-finishing');
        setTimeout(function () {
            if (loaderActiveCount > 0) return;
            barEl.style.transition = 'none';
            barEl.classList.remove('is-finishing');
            void barEl.offsetWidth;
            barEl.style.transition = 'width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.2s ease';
        }, 200);
    };

    function getAutoBotLoaderHTML() {
        return '<div class="autobot-spinner-container" role="status" aria-live="polite">' +
            '<div class="autobot-spinner" aria-hidden="true"></div>' +
            '<strong>AutoBot собирает данные</strong>' +
            '<span>Подождите немного, страница обновится автоматически.</span>' +
        '</div>';
    }

    window.getAutoBotLoaderHTML = getAutoBotLoaderHTML;

    function appErrorMessage(error, fallback) {
        if (error && error.status === 413) return 'Файл слишком большой для загрузки';
        return error && error.payload && (error.payload.message || error.payload.error) ? (error.payload.message || error.payload.error) : fallback;
    }

    function clearApiCache(cacheKey) {
        if (!cacheKey) {
            apiMemoryCache = Object.create(null);
            return;
        }
        Object.keys(apiMemoryCache).forEach(function (key) {
            if (key === cacheKey || key.indexOf(cacheKey + ':') === 0) delete apiMemoryCache[key];
        });
    }

    function abortApiRequests(group) {
        if (group) {
            if (apiRequestGroups[group]) apiRequestGroups[group].abort();
            delete apiRequestGroups[group];
            return;
        }
        Object.keys(apiRequestGroups).forEach(function (key) {
            apiRequestGroups[key].abort();
            delete apiRequestGroups[key];
        });
    }

    function debounce(fn, wait) {
        var timer = null;
        var delay = Number(wait) || 250;
        function debounced() {
            var context = this;
            var args = arguments;
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(function () {
                timer = null;
                fn.apply(context, args);
            }, delay);
        }
        debounced.cancel = function () {
            if (timer) window.clearTimeout(timer);
            timer = null;
        };
        return debounced;
    }

    function cloneApiValue(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function submitLockControls(target) {
        if (!target) return [];
        if (target.tagName === 'FORM') {
            return qsa('button[type="submit"], input[type="submit"]', target);
        }
        return [target];
    }

    function withSubmitLock(formOrButton, promiseFactory) {
        var target = formOrButton;
        if (target && target.dataset && target.dataset.submitLocked === '1') return Promise.resolve(null);
        var controls = submitLockControls(target);
        var previous = controls.map(function (control) {
            return { node: control, disabled: !!control.disabled };
        });
        if (target && target.dataset) target.dataset.submitLocked = '1';
        if (target && target.classList) target.classList.add('is-loading');
        controls.forEach(function (control) {
            control.disabled = true;
            if (control.classList) control.classList.add('is-loading');
        });
        var request;
        try {
            request = Promise.resolve(promiseFactory());
        } catch (error) {
            request = Promise.reject(error);
        }
        return request.finally(function () {
            previous.forEach(function (entry) {
                entry.node.disabled = entry.disabled;
                if (entry.node.classList) entry.node.classList.remove('is-loading');
            });
            if (target && target.classList) target.classList.remove('is-loading');
            if (target && target.dataset) target.dataset.submitLocked = '0';
        });
    }

    function beginProjectLoading(projectId) {
        state.projectLoadingToken += 1;
        state.selectedProjectLoadingToken = {
            projectId: Number(projectId),
            token: state.projectLoadingToken
        };
        return state.projectLoadingToken;
    }

    function isCurrentProject(projectId, loadingToken) {
        if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return false;
        if (loadingToken == null) return true;
        return !!state.selectedProjectLoadingToken
            && Number(state.selectedProjectLoadingToken.projectId) === Number(projectId)
            && Number(state.selectedProjectLoadingToken.token) === Number(loadingToken);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function displayUserName(user) {
        user = user || {};
        return user.displayName || [user.lastName, user.firstName].filter(Boolean).join(' ') || user.name || user.login || 'Пользователь';
    }

    function safeAvatarUrl(value) {
        var raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        if (raw.charAt(0) === '/') return raw;
        return /^https?:\/\//i.test(raw) ? raw : '';
    }

    function cachedUserInitial() {
        try {
            return String(window.localStorage.getItem(USER_INITIAL_CACHE_KEY) || '').trim();
        } catch (error) {
            return '';
        }
    }

    function cachedUserAvatarUrl() {
        try {
            return safeAvatarUrl(window.localStorage.getItem(USER_AVATAR_CACHE_KEY) || '');
        } catch (error) {
            return '';
        }
    }

    function computeUserInitial(user) {
        user = user || {};
        var first = String(user.firstName || user.first_name || '').trim();
        var last = String(user.lastName || user.last_name || '').trim();
        if (first) return first.charAt(0).toLocaleUpperCase('ru');
        if (last) return last.charAt(0).toLocaleUpperCase('ru');
        var name = String(user.displayName || user.name || user.login || '').trim();
        return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 1).map(function (part) {
            return part.charAt(0).toLocaleUpperCase('ru');
        }).join('');
    }

    function rememberUserInitial(user) {
        var initial = computeUserInitial(user);
        if (!initial) return initial;
        try {
            window.localStorage.setItem(USER_INITIAL_CACHE_KEY, initial);
        } catch (error) {}
        return initial;
    }

    function rememberUserAvatar(user) {
        var avatarUrl = safeAvatarUrl(user && (user.avatarUrl || user.avatar_url || ''));
        try {
            if (avatarUrl) {
                window.localStorage.setItem(USER_AVATAR_CACHE_KEY, avatarUrl);
            } else {
                window.localStorage.removeItem(USER_AVATAR_CACHE_KEY);
            }
        } catch (error) {}
        return avatarUrl;
    }

    function profileUserInitials(user) {
        return computeUserInitial(user) || cachedUserInitial();
    }

    function userAvatarMarkup(user, className) {
        user = user || {};
        var avatarUrl = safeAvatarUrl(user.avatarUrl || user.avatar_url || '') || (!user.id ? cachedUserAvatarUrl() : '');
        className = className || 'topbar-avatar';
        if (avatarUrl) {
            return '<span class="' + escapeHtml(className) + '" aria-hidden="true"><img src="' + escapeHtml(avatarUrl) + '" alt=""></span>';
        }
        return '<span class="' + escapeHtml(className) + '" aria-hidden="true">' + escapeHtml(userInitials(user)) + '</span>';
    }

    function topbarAvatarInner(user) {
        user = user || {};
        var avatarUrl = safeAvatarUrl(user.avatarUrl || user.avatar_url || '') || (!user.id ? cachedUserAvatarUrl() : '');
        if (avatarUrl) {
            return '<img src="' + escapeHtml(avatarUrl) + '" alt="">';
        }
        return escapeHtml(userInitials(user));
    }

    function forceTopbarAvatar(user) {
        user = user || state.currentUser || state.user || {};
        var avatarUrl = safeAvatarUrl(user.avatarUrl || user.avatar_url || '') || (!user.id ? cachedUserAvatarUrl() : '');
        var initial = userInitials(user);
        qsa('.topbar-avatar, [data-user-badge]').forEach(function (node) {
            if (!node) return;
            if (avatarUrl) {
                node.classList.add('has-image');
                safeReplaceChildren(node, '<img src="' + escapeHtml(avatarUrl) + '" alt="">');
                return;
            }
            node.classList.remove('has-image');
            safeReplaceChildren(node, escapeHtml(initial));
        });
    }

    function safeExternalUrl(value) {
        var raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
        try {
            var url = new URL(raw, window.location.origin);
            if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
        } catch (error) {}
        return '';
    }

    function safeTelHref(value) {
        var phone = String(value == null ? '' : value).trim();
        if (!phone) return '';
        var normalized = phone.replace(/[^\d+]/g, '');
        if (!normalized) return '';
        if (normalized.indexOf('+') > 0) normalized = normalized.replace(/\+/g, '');
        return 'tel:' + normalized;
    }

    function formatDisplayDate(value) {
        if (!value) return '—';
        var match = String(value).trim().match(/^(\d{4})[-.](\d{2})[-.](\d{2})(?:[T\s].*)?$/);
        if (!match) return value;
        return match[3] + '.' + match[2] + '.' + match[1];
    }

    function formatDisplayDatesInText(value) {
        return String(value == null ? '' : value).replace(/\b(\d{4})[-.](\d{2})[-.](\d{2})\b/g, function (_, year, month, day) {
            return day + '.' + month + '.' + year;
        });
    }

    function formatVisibleDates(root) {
        root = root || document.body;
        if (!root || typeof document.createTreeWalker !== 'function') return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                var parent = node.parentElement;
                if (!parent || /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
                return /\b\d{4}[-.]\d{2}[-.]\d{2}\b/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        var node;
        while ((node = walker.nextNode())) {
            node.nodeValue = formatDisplayDatesInText(node.nodeValue);
        }
    }

    function installVisibleDateFormatter() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', installVisibleDateFormatter, { once: true });
            return;
        }
        if (document.body.dataset.dateFormatterInstalled === '1') return;
        document.body.dataset.dateFormatterInstalled = '1';
        var pending = false;
        var roots = [];
        var observer = null;
        function queueRoot(root) {
            if (!root) return;
            if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
            if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
            if (roots.indexOf(root) === -1) roots.push(root);
        }
        function scheduleFormat() {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () {
                pending = false;
                var batch = roots.splice(0, 25);
                if (!batch.length) return;
                if (observer) observer.disconnect();
                batch.forEach(function (root) { formatVisibleDates(root); });
                if (observer) observer.observe(document.body, { childList: true, subtree: true });
                if (roots.length) scheduleFormat();
            });
        }
        formatVisibleDates(document.body);
        observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                Array.prototype.forEach.call(mutation.addedNodes || [], queueRoot);
            });
            if (roots.length) scheduleFormat();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function isClerkEnabled() {
        return !!(state.authConfig && state.authConfig.clerkEnabled && state.authConfig.clerkPublishableKey);
    }

    var clerkLoadPromise = null;

    function loadClerk() {
        if (!isClerkEnabled()) return Promise.resolve(null);
        if (clerkLoadPromise) return clerkLoadPromise;
        clerkLoadPromise = new Promise(function (resolve, reject) {
            var started = Date.now();
            function check() {
                if (window.Clerk) {
                    window.Clerk.load({
                        publishableKey: state.authConfig.clerkPublishableKey
                    }).then(function () {
                        resolve(window.Clerk);
                    }).catch(reject);
                    return;
                }
                if (Date.now() - started > 15000) {
                    reject(new Error('clerk_load_timeout'));
                    return;
                }
                setTimeout(check, 50);
            }
            check();
        });
        return clerkLoadPromise;
    }

    function authHeaders() {
        if (!isClerkEnabled()) return Promise.resolve({});
        return loadClerk().then(function (clerk) {
            if (!clerk || !clerk.session) return {};
            return clerk.session.getToken();
        }).then(function (token) {
            return token ? { Authorization: 'Bearer ' + token } : {};
        }).catch(function () {
            return {};
        });
    }

    function api(path, options) {
        var requestOptions = Object.assign({}, options || {});
        var method = String(requestOptions.method || 'GET').toUpperCase();
        var cacheKey = requestOptions.cacheKey;
        var cacheTtl = Number(requestOptions.cacheTtl) || 0;
        var requestGroup = requestOptions.requestGroup;
        var requestController = null;
        if (method !== 'GET') {
            if (path.indexOf('/api/projects') === 0) {
                abortApiRequests('projects-list');
                clearApiCache('projects');
            }
            if (path.indexOf('/api/companies') === 0) {
                abortApiRequests('companies-directory');
                clearApiCache('companies');
            }
            if (path.indexOf('/api/users') === 0) {
                abortApiRequests('users-directory');
                clearApiCache('users-directory');
            }
            if (path.indexOf('/api/roles') === 0) {
                abortApiRequests('roles-directory');
                clearApiCache('roles');
            }
        }
        if (method === 'GET' && cacheKey && cacheTtl > 0) {
            var cached = apiMemoryCache[cacheKey];
            if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cloneApiValue(cached.value));
            if (apiInFlight[cacheKey]) return apiInFlight[cacheKey];
        }
        if (requestGroup) {
            if (apiRequestGroups[requestGroup]) apiRequestGroups[requestGroup].abort();
            requestController = new AbortController();
            apiRequestGroups[requestGroup] = requestController;
            requestOptions.signal = requestController.signal;
        }
        var useLoader = requestOptions.silentLoader !== true;
        var loaderText = requestOptions.loaderText || 'Синхронизация...';
        delete requestOptions.silentLoader;
        delete requestOptions.loaderText;
        delete requestOptions.cacheKey;
        delete requestOptions.cacheTtl;
        delete requestOptions.requestGroup;
        requestOptions.credentials = 'same-origin';
        if (useLoader && typeof window.showLoader === 'function') window.showLoader(loaderText);
        var requestPromise = authHeaders().then(function (headers) {
            requestOptions.headers = Object.assign({ Accept: 'application/json' }, headers, requestOptions.headers || {});
            if (requestOptions.body && !requestOptions.headers['Content-Type']) requestOptions.headers['Content-Type'] = 'application/json';
            return fetch(path, requestOptions).then(function (response) {
                return response.json().catch(function () { return {}; }).then(function (payload) {
                    if (!response.ok) {
                        var error = new Error(payload.error || 'request_failed');
                        error.status = response.status;
                        error.payload = payload;
                        if (response.status === 403) {
                            console.warn('API access forbidden', path, payload);
                        }
                        throw error;
                    }
                    if (method === 'GET' && cacheKey && cacheTtl > 0) {
                        apiMemoryCache[cacheKey] = { value: cloneApiValue(payload), expiresAt: Date.now() + cacheTtl };
                    }
                    return payload;
                });
            });
        }).finally(function () {
            if (useLoader && typeof window.hideLoader === 'function') window.hideLoader();
            if (requestGroup && apiRequestGroups[requestGroup] === requestController) delete apiRequestGroups[requestGroup];
            if (cacheKey && apiInFlight[cacheKey] === requestPromise) delete apiInFlight[cacheKey];
        });
        if (method === 'GET' && cacheKey && cacheTtl > 0) apiInFlight[cacheKey] = requestPromise;
        return requestPromise;
    }

    function apiFormData(path, formData, options) {
        var requestOptions = Object.assign({}, options || {});
        var useLoader = requestOptions.silentLoader !== true;
        var loaderText = requestOptions.loaderText || 'Синхронизация...';
        delete requestOptions.silentLoader;
        delete requestOptions.loaderText;
        if (useLoader && typeof window.showLoader === 'function') window.showLoader(loaderText);
        return authHeaders().then(function (headers) {
            return fetch(path, {
                method: requestOptions.method || 'POST',
                body: formData,
                credentials: 'same-origin',
                headers: Object.assign({ Accept: 'application/json' }, headers, requestOptions.headers || {})
            }).then(function (response) {
                return response.json().catch(function () { return {}; }).then(function (payload) {
                    if (!response.ok) {
                        var error = new Error(payload.error || 'request_failed');
                        error.status = response.status;
                        error.payload = payload;
                        throw error;
                    }
                    return payload;
                });
            });
        }).finally(function () {
            if (useLoader && typeof window.hideLoader === 'function') window.hideLoader();
        });
    }

    function money(value) {
        return new Intl.NumberFormat('ru-RU').format(Number(value) || 0) + ' ₽';
    }

    function percent(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function progressSectionId(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ') || 'без раздела';
    }

    function canonicalEstimateSectionTitle(value) {
        var clean = String(value || '').replace(/\s+/g, ' ').trim();
        if (!clean) return 'Без раздела';
        var normalized = clean.toLocaleLowerCase('ru').replace(/ё/g, 'е');
        if (normalized === 'подготовка' || /^раздел\s*0?1\.?\s*подготовка$/.test(normalized)) {
            return 'Раздел 1. Окна и фасад';
        }
        return clean;
    }

    function canonicalEstimateSectionId(value) {
        return progressSectionId(canonicalEstimateSectionTitle(value));
    }

    function progressSelectorValue(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value || ''));
        return String(value || '').replace(/["\\]/g, '\\$&');
    }

    function updateProjectProgressState(projectId, totalProjectPercent, projectPayload) {
        var nextPercent = percent(totalProjectPercent);
        function applyProject(project) {
            if (!project || Number(project.id) !== Number(projectId)) return project;
            if (projectPayload) Object.assign(project, projectPayload);
            project.progress = nextPercent;
            return project;
        }
        state.projects = (state.projects || []).map(applyProject);
        if (state.selectedProject) applyProject(state.selectedProject);
    }

    function updateProgressNode(root, value, text) {
        var safePercent = percent(value);
        qsa('.progress i, .progress-strong-track i, .section-schedule-progress-bar > span, i > em', root).forEach(function (bar) {
            if (bar.closest && bar.closest('.schedule-progress-milestones')) return;
            bar.style.width = safePercent + '%';
        });
        qsa('[data-progress-text], .section-schedule-progress-value, .progress-strong-head strong, .section-schedule-progress-meta strong', root).forEach(function (label) {
            label.textContent = text || (safePercent + '%');
        });
    }

    function updateUIProgress(sectionId, sectionPercent, totalProjectPercent, kind) {
        var normalizedId = progressSectionId(sectionId);
        var safeSection = percent(sectionPercent);
        var safeTotal = percent(totalProjectPercent);
        var sectionSelector = progressSelectorValue(normalizedId);
        qsa('[data-section-progress="' + sectionSelector + '"], [data-progress-section-id="' + sectionSelector + '"]').forEach(function (node) {
            var nodeKind = node.getAttribute('data-section-progress-kind') || '';
            if (kind && nodeKind && nodeKind !== kind) return;
            updateProgressNode(node, safeSection, safeSection + '%');
            node.setAttribute('aria-valuenow', String(safeSection));
        });
        qsa('[data-project-total-progress]').forEach(function (node) {
            updateProgressNode(node, safeTotal, safeTotal + '%');
            node.setAttribute('aria-valuenow', String(safeTotal));
        });
    }

    function applyProgressApiResponse(projectId, data, sectionFallback) {
        if (!data) return;
        if (Array.isArray(data.items)) {
            state.materialsByProject[projectId] = data.items;
            var byId = {};
            data.items.forEach(function (item) { byId[Number(item.id || 0)] = item; });
            var schedule = state.sectionScheduleByProject && state.sectionScheduleByProject[projectId];
            (Array.isArray(schedule && schedule.sections) ? schedule.sections : []).forEach(function (section) {
                (Array.isArray(section.items) ? section.items : []).forEach(function (item) {
                    var fresh = byId[Number(item.id || 0)];
                    if (!fresh) return;
                    item.isCompleted = !!fresh.isCompleted;
                    item.actualQty = Number(fresh.actualQty || 0);
                });
            });
        }
        var progress = data.progress || {};
        var section = progress.section || {};
        var sectionId = section.sectionId || sectionFallback || '';
        var projectPercent = progress.totalProjectPercent != null ? progress.totalProjectPercent : (progress.projectProgress != null ? progress.projectProgress : data.project_progress);
        updateProjectProgressState(projectId, projectPercent, data.project);
        updateUIProgress(sectionId, section.percent || 0, projectPercent, progress.kind || data.kind || '');
    }

    function isoDateAdd(isoDate, days) {
        if (!isoDate) return '';
        var date = new Date(isoDate + 'T00:00:00');
        date.setDate(date.getDate() + Number(days || 0));
        return date.toISOString().slice(0, 10);
    }

    function formatRuDate(isoDate) {
        return formatDisplayDate(isoDate);
    }

    function downloadTextFile(filename, text, mimeType) {
        var blob = new Blob(['\uFEFF' + text], { type: mimeType || 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 250);
    }

    function csvCell(value) {
        var text = String(value == null ? '' : value).replace(/"/g, '""');
        return '"' + text + '"';
    }

    function downloadCsv(filename, rows) {
        var text = rows.map(function (row) {
            return row.map(csvCell).join(';');
        }).join('\n');
        downloadTextFile(filename, text, 'text/csv;charset=utf-8');
    }

    function normalizeRole(role) {
        if (role && typeof role === 'object') role = role.code || role.role || role.name || '';
        if (role === 'buyer') return 'purchaser';
        if (role === 'client') return 'customer';
        return role;
    }

    function hasRole(role) {
        var user = state.currentUser || state.user;
        if (!user) return false;
        var current = normalizeRole(user.role);
        if (current === role) return true;
        var roles = Array.isArray(user.roles) ? user.roles : [];
        return roles.map(normalizeRole).indexOf(role) !== -1;
    }

    function currentRoleLabel(user) {
        user = user || state.currentUser || state.user || {};
        var role = normalizeRole(user.role);
        if (role === 'main_admin') return 'Главный Админ';
        if (role === 'admin') return '\u0410\u0414\u041c\u0418\u041d';
        if (role === 'director') return '\u0414\u0438\u0440\u0435\u043a\u0442\u043e\u0440';
        if (role === 'foreman') return '\u041f\u0440\u043e\u0440\u0430\u0431';
        return user.roleLabel || role || '\u041f\u0440\u043e\u0440\u0430\u0431';
    }

    function isSuperAdminRole() {
        return hasRole('admin');
    }

    function isMainAdminRole() {
        return hasRole('main_admin') || isBootstrapAdminUser(state.currentUser || state.user || {});
    }

    function isDirectorRole() {
        return isSuperAdminRole() || hasRole('director');
    }

    function isForemanRole() {
        return hasRole('foreman') && !isDirectorRole();
    }

    function isAdminRole() {
        return isMainAdminRole() || !!currentPermissions().fullAccess || hasRole('admin') || hasRole('director');
    }

    function canDeleteProject() {
        return isMainAdminRole() || hasRole('admin');
    }

    function currentPermissions() {
        var user = state.currentUser || state.user || {};
        return user.permissions && typeof user.permissions === 'object' ? user.permissions : {};
    }

    function personDisplayName(user) {
        user = user || {};
        var display = String(user.displayName || '').trim();
        if (display) return display;
        var full = [user.lastName || user.last_name || '', user.firstName || user.first_name || ''].map(function (part) {
            return String(part || '').trim();
        }).filter(Boolean).join(' ');
        return full || user.name || user.login || '';
    }

    function allowedModules() {
        var permissions = currentPermissions();
        if (permissions.fullAccess) {
            return ['dashboard', 'daily_tasks', 'projects', 'autobot', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'users'];
        }
        var modules = Array.isArray(permissions.modules) ? permissions.modules.slice() : [];
        if (modules.indexOf('users') === -1) modules.push('users');
        return modules;
    }

    function canManageTeam() {
        return hasRole('admin') || isMainAdminRole();
    }

    function canManageDailyTasks() {
        var permissions = currentPermissions();
        return !!(permissions.fullAccess || permissions.dailyTasks === 'all' || isDirectorRole());
    }

    function canViewPrivateContacts() {
        var user = state.currentUser || state.user || {};
        return isBootstrapAdminUser(user);
    }

    function canSeeFinances() {
        return !!(state.currentUser || state.user);
    }

    function canManageSuppliers() {
        return hasRole('admin') || hasRole('director') || hasRole('foreman') || hasRole('purchaser');
    }

    function canManageDocuments() {
        return hasRole('admin') || hasRole('director') || hasRole('foreman') || hasRole('purchaser') || hasRole('financier') || hasRole('accountant');
    }

    function canManageSchedule() {
        return hasRole('admin') || hasRole('director') || hasRole('foreman');
    }

    function nextPath() {
        var params = new URLSearchParams(location.search);
        var next = params.get('next');
        return next && next.indexOf('/app/') === 0 ? next : '/app/dashboard';
    }

    function isBootstrapAdminUser(user) {
        return normalizeRole(user && user.role) === 'admin' || String(user && user.login || '').trim().toLowerCase() === 'admin';
    }

    function effectiveUserRoles(user) {
        if (isBootstrapAdminUser(user)) return [{ code: 'admin', name: '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440' }];
        return Array.isArray(user && user.roles) && user.roles.length
            ? user.roles
            : [{ code: user && user.role, name: user && (user.roleLabel || user.role) }];
    }

    function userInitials(user) {
        user = user || {};
        var first = String(user.firstName || user.first_name || '').trim();
        var last = String(user.lastName || user.last_name || '').trim();
        if (first) return first.charAt(0).toLocaleUpperCase('ru');
        if (last) return last.charAt(0).toLocaleUpperCase('ru');
        var source = String(personDisplayName(user) || user.login || '?').trim();
        var parts = source.split(/\s+/).filter(Boolean);
        return parts.slice(0, 1).map(function (part) {
            return part.charAt(0).toLocaleUpperCase('ru');
        }).join('') || '?';
    }

    function isMobileSidebarViewport() {
        return window.innerWidth <= 720;
    }

    function syncSidebarControls() {
        var mobile = isMobileSidebarViewport();
        var menuOpen = document.body.classList.contains('menu-open');
        var collapsed = document.body.classList.contains('sidebar-collapsed');
        qsa('[data-menu-toggle]').forEach(function (toggle) {
            toggle.setAttribute('aria-expanded', mobile && menuOpen ? 'true' : 'false');
        });
        qsa('[data-sidebar-toggle]').forEach(function (toggle) {
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            toggle.setAttribute('aria-label', collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар');
            toggle.title = collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар';
        });
    }

    function applySidebarLayoutPreference() {
        var collapsed = false;
        try {
            collapsed = window.localStorage.getItem('pmbi_sidebar_collapsed') === '1';
        } catch (error) {}
        document.body.classList.toggle('sidebar-collapsed', !isMobileSidebarViewport() && collapsed);
        if (!isMobileSidebarViewport()) document.body.classList.remove('menu-open');
        syncSidebarControls();
    }

    function toggleDesktopSidebar() {
        if (isMobileSidebarViewport()) return;
        var collapsed = !document.body.classList.contains('sidebar-collapsed');
        document.body.classList.toggle('sidebar-collapsed', collapsed);
        try {
            window.localStorage.setItem('pmbi_sidebar_collapsed', collapsed ? '1' : '0');
        } catch (error) {}
        syncSidebarControls();
    }

    function bindSidebarControls() {
        if (document.documentElement.dataset.sidebarControlsBound === '1') return;
        document.documentElement.dataset.sidebarControlsBound = '1';
        applySidebarLayoutPreference();
        qsa('[data-menu-toggle]').forEach(function (toggle) {
            if (toggle.dataset.sidebarControlBound === '1') return;
            toggle.dataset.sidebarControlBound = '1';
            toggle.addEventListener('click', function (event) {
                if (!isMobileSidebarViewport()) return;
                event.preventDefault();
                event.stopPropagation();
                document.body.classList.toggle('menu-open');
                syncSidebarControls();
            });
        });
        qsa('[data-sidebar-toggle]').forEach(function (toggle) {
            if (toggle.dataset.sidebarControlBound === '1') return;
            toggle.dataset.sidebarControlBound = '1';
            toggle.addEventListener('click', function (event) {
                if (isMobileSidebarViewport()) return;
                event.preventDefault();
                event.stopPropagation();
                toggleDesktopSidebar();
            });
        });
        document.addEventListener('click', function (event) {
            var menuToggle = event.target && event.target.closest ? event.target.closest('[data-menu-toggle]') : null;
            var sidebarToggle = event.target && event.target.closest ? event.target.closest('[data-sidebar-toggle]') : null;
            if (menuToggle) {
                return;
            }
            if (sidebarToggle) {
                return;
            }
            if (!isMobileSidebarViewport() || !document.body.classList.contains('menu-open')) return;
            if (event.target.closest && (event.target.closest('.sidebar') || event.target.closest('[data-menu-toggle]'))) return;
            document.body.classList.remove('menu-open');
            syncSidebarControls();
        });
        document.addEventListener('click', function (event) {
            if (!isMobileSidebarViewport() || !event.target.closest) return;
            if (event.target.closest('.sidebar a')) {
                document.body.classList.remove('menu-open');
                syncSidebarControls();
            }
        });
        window.addEventListener('resize', applySidebarLayoutPreference);
    }

    bindSidebarControls();


    window.PMBI = Object.assign(window.PMBI || {}, {
        core: Object.assign(window.PMBI && window.PMBI.core || {}, {
            readStoredJson: readStoredJson,
            writeStoredJson: writeStoredJson
        }),
        page: page,
        APP_TODAY: APP_TODAY,
        state: state,
        rememberSessionEnabled: rememberSessionEnabled,
        setRememberSession: setRememberSession,
        wasAutoLoginAttempted: wasAutoLoginAttempted,
        markAutoLoginAttempted: markAutoLoginAttempted,
        clearAutoLoginAttempt: clearAutoLoginAttempt,
        resetRememberAuthState: resetRememberAuthState,
        applyCurrentUser: applyCurrentUser,
        loadCurrentUser: loadCurrentUser,
        qs: qs,
        qsa: qsa,
        readStoredJson: readStoredJson,
        writeStoredJson: writeStoredJson,
        safeReplaceChildren: safeReplaceChildren,
        clearApiCache: clearApiCache,
        abortApiRequests: abortApiRequests,
        debounce: debounce,
        refreshLucideIcons: refreshLucideIcons,
        showAppNotice: showAppNotice,
        getAutoBotLoaderHTML: getAutoBotLoaderHTML,
        appErrorMessage: appErrorMessage,
        withSubmitLock: withSubmitLock,
        beginProjectLoading: beginProjectLoading,
        isCurrentProject: isCurrentProject,
        escapeHtml: escapeHtml,
        displayUserName: displayUserName,
        safeAvatarUrl: safeAvatarUrl,
        cachedUserInitial: cachedUserInitial,
        computeUserInitial: computeUserInitial,
        rememberUserInitial: rememberUserInitial,
        profileUserInitials: profileUserInitials,
        userAvatarMarkup: userAvatarMarkup,
        topbarAvatarInner: topbarAvatarInner,
        forceTopbarAvatar: forceTopbarAvatar,
        safeExternalUrl: safeExternalUrl,
        safeTelHref: safeTelHref,
        formatDisplayDate: formatDisplayDate,
        formatDisplayDatesInText: formatDisplayDatesInText,
        formatVisibleDates: formatVisibleDates,
        installVisibleDateFormatter: installVisibleDateFormatter,
        isClerkEnabled: isClerkEnabled,
        loadClerk: loadClerk,
        authHeaders: authHeaders,
        api: api,
        apiFormData: apiFormData,
        money: money,
        percent: percent,
        progressSectionId: progressSectionId,
        canonicalEstimateSectionTitle: canonicalEstimateSectionTitle,
        canonicalEstimateSectionId: canonicalEstimateSectionId,
        progressSelectorValue: progressSelectorValue,
        updateProjectProgressState: updateProjectProgressState,
        updateProgressNode: updateProgressNode,
        updateUIProgress: updateUIProgress,
        applyProgressApiResponse: applyProgressApiResponse,
        isoDateAdd: isoDateAdd,
        formatRuDate: formatRuDate,
        downloadTextFile: downloadTextFile,
        csvCell: csvCell,
        downloadCsv: downloadCsv,
        normalizeRole: normalizeRole,
        hasRole: hasRole,
        currentRoleLabel: currentRoleLabel,
        isBootstrapAdminUser: isBootstrapAdminUser,
        effectiveUserRoles: effectiveUserRoles,
        isSuperAdminRole: isSuperAdminRole,
        isMainAdminRole: isMainAdminRole,
        isDirectorRole: isDirectorRole,
        isForemanRole: isForemanRole,
        isAdminRole: isAdminRole,
        canDeleteProject: canDeleteProject,
        currentPermissions: currentPermissions,
        personDisplayName: personDisplayName,
        allowedModules: allowedModules,
        canManageTeam: canManageTeam,
        canManageDailyTasks: canManageDailyTasks,
        canViewPrivateContacts: canViewPrivateContacts,
        canSeeFinances: canSeeFinances,
        canManageSuppliers: canManageSuppliers,
        canManageDocuments: canManageDocuments,
        canManageSchedule: canManageSchedule,
        nextPath: nextPath,
        userInitials: userInitials,
        toggleDesktopSidebar: toggleDesktopSidebar,
        applySidebarLayoutPreference: applySidebarLayoutPreference
    });
})();
