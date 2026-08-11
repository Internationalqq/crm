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
        materialCounterpartyFiltersByProject: {},
        notificationsByProject: {},
        materialScheduleByProject: {},
        materialScheduleViewByProject: {},
        renderingScheduleForProject: null,
        isMaterialScheduleRendering: false,
        schedulePlanByProject: {},
        sectionScheduleByProject: {},
        scheduleQuickActions: {},
        projectTabModesByProject: {},
        logsCalendarMonthByProject: {},
        logsSelectedDateByProject: {},
        dashboard: null,
        reportsBundle: null,
        authConfig: window.__PMBI_AUTH__ || {}
    };

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
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
        window.lucide.createIcons({
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
        return error && error.payload && (error.payload.message || error.payload.error) ? (error.payload.message || error.payload.error) : fallback;
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
        return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.login || 'Пользователь';
    }

    function safeAvatarUrl(value) {
        var raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        if (raw.charAt(0) === '/') return raw;
        return /^https?:\/\//i.test(raw) ? raw : '';
    }

    function profileUserInitials(user) {
        var name = displayUserName(user);
        return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('') || 'U';
    }

    function userAvatarMarkup(user, className) {
        user = user || {};
        var avatarUrl = safeAvatarUrl(user.avatarUrl || user.avatar_url);
        className = className || 'topbar-avatar';
        if (avatarUrl) {
            return '<span class="' + escapeHtml(className) + '" aria-hidden="true"><img src="' + escapeHtml(avatarUrl) + '" alt=""></span>';
        }
        return '<span class="' + escapeHtml(className) + '" aria-hidden="true">' + escapeHtml(profileUserInitials(user)) + '</span>';
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
        var useLoader = requestOptions.silentLoader !== true;
        var loaderText = requestOptions.loaderText || 'Синхронизация...';
        delete requestOptions.silentLoader;
        delete requestOptions.loaderText;
        requestOptions.credentials = 'same-origin';
        if (useLoader && typeof window.showLoader === 'function') window.showLoader(loaderText);
        return authHeaders().then(function (headers) {
            requestOptions.headers = Object.assign({ Accept: 'application/json' }, headers, requestOptions.headers || {});
            if (requestOptions.body && !requestOptions.headers['Content-Type']) requestOptions.headers['Content-Type'] = 'application/json';
            return fetch(path, requestOptions).then(function (response) {
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
        if (role === 'admin') return '\u0410\u0414\u041c\u0418\u041d';
        if (role === 'director') return '\u0414\u0438\u0440\u0435\u043a\u0442\u043e\u0440';
        if (role === 'foreman') return '\u041f\u0440\u043e\u0440\u0430\u0431';
        return user.roleLabel || role || '\u041f\u0440\u043e\u0440\u0430\u0431';
    }

    function isSuperAdminRole() {
        return hasRole('admin');
    }

    function isDirectorRole() {
        return isSuperAdminRole() || hasRole('director');
    }

    function isForemanRole() {
        return hasRole('foreman') && !isDirectorRole();
    }

    function isAdminRole() {
        return hasRole('admin') || hasRole('director');
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

    function showLoginError(message) {
        var error = qs('[data-login-error]');
        if (!error) return;
        error.textContent = message;
        error.classList.add('active');
    }

    function initLogin() {
        if (isClerkEnabled()) {
            var root = qs('[data-login-clerk-root]');
            var fallbackForm = qs('[data-login-form]');
            if (fallbackForm) fallbackForm.hidden = true;
            loadClerk().then(function (clerk) {
                if (!clerk) {
                    showLoginError('Clerk не загрузился. Проверь настройки ключей.');
                    return;
                }
                function finishLogin() {
                    api('/api/auth/me').then(function () {
                        location.replace(nextPath());
                    }).catch(function (err) {
                        if (err && err.payload && err.payload.error === 'clerk_user_not_provisioned') {
                            showLoginError('Вход выполнен, но доступ в CRM еще не выдан. Нужен пользователь с этим email внутри CRM.');
                            return;
                        }
                        showLoginError('Не удалось завершить вход. Проверь настройки доступа.');
                    });
                }
                clerk.addListener(function (resources) {
                    if (resources && resources.session) finishLogin();
                });
                if (clerk.session) {
                    finishLogin();
                    return;
                }
                if (root) {
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
                        forceRedirectUrl: nextPath(),
                        fallbackRedirectUrl: state.authConfig.clerkSignInFallbackRedirectUrl || '/app/dashboard'
                    });
                }
            }).catch(function () {
                showLoginError('Не удалось подключить защищенный вход.');
            });
            return;
        }

        api('/api/auth/me').then(function () {
            location.replace(nextPath());
        }).catch(function () {});

        var form = qs('[data-login-form]');
        if (!form) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-login-error]');
            if (error) error.classList.remove('active');
            var button = form.querySelector('button');
            if (button) button.disabled = true;
            api('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    login: form.login.value.trim(),
                    password: form.password.value
                })
            }).then(function () {
                location.replace(nextPath());
            }).catch(function () {
                if (error) error.classList.add('active');
                if (button) button.disabled = false;
            });
        });
    }

    function initShell() {
        api('/api/auth/me').then(function (data) {
            state.user = data.user;
            state.currentUser = data.user;
            renderUser();
            applyRole();
            initPage();
        }).catch(function () {
            location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
        });

        var logout = qs('[data-logout]');
        if (logout) {
            logout.addEventListener('click', function () {
                if (isClerkEnabled()) {
                    loadClerk().then(function (clerk) {
                        return api('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
                            return clerk ? clerk.signOut({ redirectUrl: state.authConfig.clerkAfterSignOutUrl || '/login' }) : null;
                        });
                    }).catch(function () {
                        location.replace('/login');
                    });
                    return;
                }
                api('/api/auth/logout', { method: 'POST' }).finally(function () {
                    location.replace('/login');
                });
            });
        }

        var menuToggle = qs('[data-menu-toggle]');
        if (menuToggle) {
            menuToggle.addEventListener('click', function () {
                document.body.classList.toggle('menu-open');
            });
        }

        initAiAssistant();

        qsa('[data-placeholder-form]').forEach(function (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                alert('Это следующий backend-модуль. Архитектура уже готова, осталось добавить API.');
            });
        });

        qsa('[data-placeholder-action]').forEach(function (button) {
            button.addEventListener('click', function () {
                alert(button.dataset.placeholderAction || 'Функция будет подключена к API.');
            });
        });
    }

    function initAiAssistant() {
        var shell = qs('[data-ai-shell]');
        var openButton = qs('[data-ai-open]');
        var form = qs('[data-ai-form]');
        var input = form ? qs('textarea[name="message"]', form) : null;
        var voiceButton = qs('[data-ai-voice]');
        if (!shell || !openButton || !form || !input) return;

        function openAssistant() {
            shell.hidden = false;
            document.body.classList.add('ai-open');
            setTimeout(function () {
                input.focus();
            }, 20);
        }

        function closeAssistant() {
            shell.hidden = true;
            document.body.classList.remove('ai-open');
        }

        openButton.addEventListener('click', openAssistant);
        qsa('[data-ai-close]', shell).forEach(function (button) {
            button.addEventListener('click', closeAssistant);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !shell.hidden) closeAssistant();
        });

        qsa('[data-ai-prompt]', shell).forEach(function (button) {
            button.addEventListener('click', function () {
                input.value = button.dataset.aiPrompt || '';
                openAssistant();
            });
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var text = input.value.trim();
            if (!text) return;
            appendAiMessage('user', state.user && state.user.name ? state.user.name : 'Вы', text);
            appendAiMessage('assistant', 'AI помощник', buildAiPlaceholderReply(text));
            input.value = '';
        });

        if (voiceButton) {
            voiceButton.addEventListener('click', function () {
                startAiVoiceInput(input, voiceButton);
            });
        }
    }

    function appendAiMessage(role, title, text) {
        var root = qs('[data-ai-messages]');
        if (!root) return;
        root.insertAdjacentHTML('beforeend',
            '<article class="ai-message ai-message-' + role + '">' +
                '<b>' + escapeHtml(title) + '</b>' +
                '<p>' + escapeHtml(text) + '</p>' +
            '</article>'
        );
        root.scrollTop = root.scrollHeight;
    }

    function buildAiPlaceholderReply(text) {
        var normalized = String(text || '').toLocaleLowerCase('ru');
        if (normalized.indexOf('отчет') !== -1 || normalized.indexOf('отч') !== -1) {
            return 'Понял. Интерфейс уже готов, а автозаполнение отчетов подключим после интеграции агента и прав на запись.';
        }
        if (normalized.indexOf('задач') !== -1) {
            return 'Понял. Следующим этапом свяжем этот чат с созданием задач прямо в CRM.';
        }
        if (normalized.indexOf('материал') !== -1 || normalized.indexOf('склад') !== -1 || normalized.indexOf('поставщик') !== -1) {
            return 'Понял. Дальше подключим сценарии, в которых помощник сам разбирает нехватки, закупку и поставщиков.';
        }
        if (normalized.indexOf('голос') !== -1) {
            return 'Голосовой сценарий уже предусмотрен. После подключения агента голос можно будет использовать как прямой вход для действий в CRM.';
        }
        return 'Принял. Чат уже встроен в интерфейс, а реальные действия по объектам и заполнению данных подключим следующим слоем.';
    }

    function startAiVoiceInput(input, button) {
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            appendAiMessage('assistant', 'AI помощник', 'В этом браузере голосовой ввод недоступен. Текстовый чат уже работает, а голос подключим там, где есть поддержка распознавания.');
            return;
        }
        var recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        button.disabled = true;
        button.textContent = 'Слушаю...';
        recognition.onresult = function (event) {
            var transcript = event.results && event.results[0] && event.results[0][0] ? event.results[0][0].transcript : '';
            input.value = transcript ? transcript.trim() : input.value;
            input.focus();
        };
        recognition.onerror = function () {
            appendAiMessage('assistant', 'AI помощник', 'Голосовой ввод не сработал. Можно продолжить текстом, а сами действия по CRM подключим отдельно.');
        };
        recognition.onend = function () {
            button.disabled = false;
            button.textContent = 'Голос';
        };
        recognition.start();
    }

    function renderUser() {
        var node = qs('[data-current-user]');
        if (!node || !state.user) return;
        node.textContent = state.user.name || state.user.login || '';
    }

    function applyRole() {
        if (!state.user) return;
        state.user.role = normalizeRole(state.user.role);
        document.body.classList.add('role-' + state.user.role);
        qsa('[data-director-only]').forEach(function (node) {
            node.classList.toggle('hidden', !isDirectorRole());
        });
        qsa('[data-director-action]').forEach(function (node) {
            node.classList.toggle('hidden', !isDirectorRole());
        });
        var allowedNav = {
            admin: ['dashboard', 'projects', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats', 'users', 'reports'],
            director: ['dashboard', 'projects', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats', 'users', 'reports'],
            foreman: ['dashboard', 'projects', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats'],
            purchaser: ['dashboard', 'projects', 'logs', 'warehouse', 'suppliers', 'chats'],
            financier: ['dashboard', 'projects', 'reports'],
            accountant: ['dashboard', 'projects', 'reports'],
            customer: ['dashboard', 'projects', 'schedule', 'logs', 'chats']
        };
        var allowed = allowedNav[normalizeRole(state.user.role)] || [];
        qsa('[data-nav]').forEach(function (link) {
            if (allowed.indexOf(link.dataset.nav) === -1) {
                link.classList.add('hidden');
                return;
            }
            link.classList.remove('hidden');
            if (link.dataset.nav === page) link.classList.add('active');
        });
    }

    function applyRoleVisibility(root) {
        root = root || document;
        var director = isDirectorRole();
        qsa('[data-director-only], [data-director-action], [data-director-finance]', root).forEach(function (node) {
            node.classList.toggle('hidden', !director);
        });
        qsa('[data-foreman-hidden]', root).forEach(function (node) {
            node.classList.toggle('hidden', isForemanRole());
        });
        syncProjectTabVisibility(root);
    }

    renderUser = function () {
        var node = qs('[data-current-user]');
        var roleNode = qs('[data-current-role]');
        var user = state.currentUser || state.user;
        if (!node || !user) return;
        node.textContent = user.name || user.login || '';
        if (roleNode) roleNode.textContent = currentRoleLabel(user);
    };

    applyRole = function () {
        if (!state.user) return;
        state.user.role = normalizeRole(state.user.role);
        state.currentUser = state.user;
        document.body.classList.add('role-' + state.user.role);
        applyRoleVisibility(document);
        var allowedNav = {
            admin: ['dashboard', 'projects', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats', 'users', 'reports'],
            director: ['dashboard', 'projects', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats', 'users', 'reports'],
            foreman: ['dashboard', 'projects', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats'],
            purchaser: ['dashboard', 'projects', 'logs', 'warehouse', 'suppliers', 'chats'],
            financier: ['dashboard', 'projects', 'reports'],
            accountant: ['dashboard', 'projects', 'reports'],
            customer: ['dashboard', 'projects', 'schedule', 'logs', 'chats']
        };
        var allowed = allowedNav[normalizeRole(state.user.role)] || [];
        qsa('[data-nav]').forEach(function (link) {
            var visible = allowed.indexOf(link.dataset.nav) !== -1;
            link.classList.toggle('hidden', !visible);
            if (visible && link.dataset.nav === page) link.classList.add('active');
        });
    };

    function initPage() {
        if (page === 'dashboard') initDashboardPage();
        if (page === 'projects') loadProjects(function () {
            loadDashboard(renderProjectsPage);
        });
        if (page === 'warehouse') loadProjects(renderWarehousePage);
        if (page === 'suppliers') loadProjects(initSuppliersPage);
        if (page === 'schedule') loadProjects(renderSchedulePage);
        if (page === 'logs') loadProjects(renderLogsPage);
        if (page === 'chats') loadProjects(renderChatsPage);
        if (page === 'users') initUsersPage();
        if (page === 'companies') initCompaniesPage();
        if (page === 'reports') initReportsPage();
    }

    function loadProjects(callback) {
        var listRoot = page === 'projects' ? qs('[data-projects-list]') : null;
        function finish() {
            if (typeof callback !== 'function') return;
            try {
                callback();
            } catch (error) {
                console.error('Projects callback failed', error);
                if (listRoot) {
                    safeReplaceChildren(listRoot, '<div class="muted">\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u0440\u0438\u0441\u043e\u0432\u0430\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432.</div>');
                }
            }
        }
        return api('/api/projects').then(function (data) {
            state.projects = Array.isArray(data && data.projects) ? data.projects : [];
            if (listRoot) {
                try {
                    renderProjectList(state.projects);
                } catch (error) {
                    console.error('Project list render failed', error);
                    safeReplaceChildren(listRoot, '<div class="muted">\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442\u044b.</div>');
                }
            }
            finish();
        }).catch(function (error) {
            console.error('Projects load failed', error);
            state.projects = [];
            if (page === 'autobot') {
                showAppNotice(appErrorMessage(error, 'Не удалось загрузить данные AutoBot'), 'error');
            }
            if (listRoot) {
                safeReplaceChildren(listRoot, '<div class="muted">\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442\u044b. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438\u043b\u0438 \u0432\u043e\u0439\u0434\u0438 \u0437\u0430\u043d\u043e\u0432\u043e.</div>');
            }
            finish();
        });
    }


    function loadDashboard(callback) {
        api('/api/dashboard').then(function (data) {
            state.dashboard = data;
            callback();
        }).catch(function () {
            state.dashboard = null;
            callback();
        });
    }

    function loadRoles(callback) {
        if (state.roles.length) {
            if (callback) callback(state.roles);
            return;
        }
        api('/api/roles').then(function (data) {
            state.roles = Array.isArray(data.roles) ? data.roles : [];
            if (callback) callback(state.roles);
        }).catch(function () {
            state.roles = [];
            if (callback) callback(state.roles);
        });
    }

    function loadCompanies(callback, type) {
        var path = '/api/companies' + (type ? '?type=' + encodeURIComponent(type) : '');
        api(path).then(function (data) {
            state.companies = Array.isArray(data.companies) ? data.companies : [];
            state.companiesAllLoaded = !type;
            if (callback) callback(state.companies);
        }).catch(function () {
            state.companies = [];
            state.companiesAllLoaded = false;
            if (callback) callback(state.companies);
        });
    }

    function ensureCounterpartyCompanies(callback) {
        if (state.companiesAllLoaded) {
            if (callback) callback(state.companies || []);
            return;
        }
        loadCompanies(function (companies) {
            if (callback) callback(companies || []);
        });
    }

    function companyTypeLabel(type) {
        return {
            own_legal_entity: 'Наше юрлицо',
            client: 'Заказчик',
            supplier: 'Поставщик',
            contractor: 'Подрядчик',
            other: 'Другое'
        }[type] || type || 'Компания';
    }

    function counterpartyTypeLabel(type) {
        if (type === 'contractor') return '\u041f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a \u0440\u0430\u0431\u043e\u0442';
        if (type === 'supplier') return '\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432';
        return companyTypeLabel(type);
    }

    function counterpartyTypeClass(type) {
        if (type === 'contractor') return ' is-contractor';
        if (type === 'supplier') return ' is-supplier';
        return '';
    }

    function counterpartyInitials(name) {
        var source = String(name || '?').trim();
        var parts = source.split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
            return parts.slice(0, 2).map(function (part) {
                return part.charAt(0).toLocaleUpperCase('ru');
            }).join('');
        }
        return source.slice(0, 2).toLocaleUpperCase('ru') || '?';
    }

    function counterpartyAvatarStyle(name) {
        var colors = [
            ['#2563eb', '#20b486'],
            ['#7c3aed', '#ec4899'],
            ['#0891b2', '#22c55e'],
            ['#ea580c', '#f59e0b'],
            ['#0f766e', '#38bdf8'],
            ['#4f46e5', '#14b8a6']
        ];
        var hash = 0;
        String(name || '').split('').forEach(function (char) {
            hash = ((hash << 5) - hash) + char.charCodeAt(0);
            hash |= 0;
        });
        var pair = colors[Math.abs(hash) % colors.length];
        return ' style="background:linear-gradient(135deg,' + pair[0] + ',' + pair[1] + ')"';
    }

    function counterpartyWebsite(item) {
        var direct = item && (item.website || item.site || item.url || item.source_url || item.sourceUrl);
        if (direct) return safeExternalUrl(direct);
        var notes = String(item && item.notes || '');
        var match = notes.match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+/i);
        return match ? safeExternalUrl(match[0]) : '';
    }

    function counterpartyBindingStats(company, offers, projectId) {
        var materialIds = {};
        var projectIds = {};
        var companyId = Number(company && (company.id || company.company_id || company.companyId) || 0);
        var companyName = String(company && (company.name || company.company_name || company.candidate_name) || '').trim().toLowerCase();
        function matches(item) {
            var itemCompanyId = Number(item && (item.company_id || item.companyId) || 0);
            if (companyId && itemCompanyId && itemCompanyId === companyId) return true;
            var itemName = String(item && (item.company_name || item.company || item.candidate_name || item.name) || '').trim().toLowerCase();
            return !!(companyName && itemName && itemName === companyName);
        }
        (offers || []).forEach(function (offer) {
            if (!matches(offer)) return;
            var materialId = Number(offer.estimate_item_id || offer.estimateItemId || 0);
            if (materialId) materialIds[materialId] = 1;
            var offerProjectId = Number(offer.project_id || offer.projectId || projectId || 0);
            if (offerProjectId) projectIds[offerProjectId] = 1;
        });
        Object.keys(state.materialInsightsByProject || {}).forEach(function (pid) {
            var insights = state.materialInsightsByProject[pid] || {};
            Object.keys(insights).forEach(function (itemId) {
                var insight = insights[itemId];
                if (!insight || itemId === '__allOptions') return;
                ['supplier', 'contractor'].forEach(function (kind) {
                    var selected = insight.selectedByType && insight.selectedByType[kind];
                    if (selected && matches(selected)) {
                        materialIds[itemId] = 1;
                        projectIds[pid] = 1;
                    }
                });
            });
        });
        var materialsCount = Object.keys(materialIds).length;
        var projectsCount = Object.keys(projectIds).length;
        if (!materialsCount && !projectsCount) return '\u041f\u0440\u0438\u0432\u044f\u0437\u043e\u043a \u043f\u043e\u043a\u0430 \u043d\u0435\u0442';
        return '\u041f\u0440\u0438\u0432\u044f\u0437\u0430\u043d: ' + materialsCount + ' \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432/\u0440\u0430\u0431\u043e\u0442' + (projectsCount ? ' \u2022 ' + projectsCount + ' \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432' : '');
    }

    function renderCounterpartyCard(item, options) {
        item = item || {};
        options = options || {};
        var name = item.name || item.company_name || item.candidate_name || '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442';
        var type = item.type || item.candidate_type || 'supplier';
        var phone = item.phone || '';
        var phoneHref = safeTelHref(phone);
        var siteUrl = counterpartyWebsite(item);
        var statText = options.statText || counterpartyBindingStats(item, options.offers || [], options.projectId);
        var contacts = [
            phone ? '<a class="counterparty-contact" href="' + escapeHtml(phoneHref || '#') + '"><i data-lucide="phone"></i><span>' + escapeHtml(phone) + '</span></a>' : '',
            siteUrl ? '<a class="counterparty-contact" href="' + escapeHtml(siteUrl) + '" target="_blank" rel="noreferrer"><i data-lucide="globe"></i><span>' + escapeHtml(siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</span></a>' : ''
        ].filter(Boolean).join('');
        return '<article class="counterparty-card">' +
            '<div class="counterparty-card-top">' +
                '<div class="counterparty-avatar" aria-hidden="true"' + counterpartyAvatarStyle(name) + '>' + escapeHtml(counterpartyInitials(name)) + '</div>' +
                '<div class="counterparty-main"><h3>' + escapeHtml(name) + '</h3><span class="counterparty-type-badge' + counterpartyTypeClass(type) + '">' + escapeHtml(counterpartyTypeLabel(type)) + '</span></div>' +
            '</div>' +
            '<div class="counterparty-contacts">' + (contacts || '<span class="counterparty-contact is-empty">\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u044b</span>') + '</div>' +
            '<div class="counterparty-stat">' + escapeHtml(statText) + '</div>' +
            (options.footerHtml || '') +
        '</article>';
    }

    function populateProjectCompanySelects() {

        var customerSelect = qs('[data-project-customer-company]');
        var ownSelect = qs('[data-project-own-company]');
        if (customerSelect) {
            var customerCompanies = state.companies.filter(function (company) {
                return company.type === 'client' || company.type === 'other';
            });
            customerSelect.innerHTML = '<option value="">Без привязки</option>' + customerCompanies.map(function (company) {
                return '<option value="' + company.id + '">' + escapeHtml(company.name) + '</option>';
            }).join('');
        }
        if (ownSelect) {
            var ownCompanies = state.companies.filter(function (company) {
                return company.type === 'own_legal_entity';
            });
            ownSelect.innerHTML = '<option value="">Не выбрано</option>' + ownCompanies.map(function (company) {
                return '<option value="' + company.id + '">' + escapeHtml(company.name) + '</option>';
            }).join('');
        }
    }

    function initDashboardPage() {
        loadDashboard(function () {
            renderDashboardPage(state.dashboard || {});
        });
    }

    function renderDashboardPage(data) {
        renderDashboardStats(data);
        renderDashboardProjects(data.projects || []);
        renderDashboardActions(data.todayActions || []);
        renderDashboardActivity(data.recentActivity || []);
        renderDashboardCritical(data.criticalItems || []);
        refreshLucideIcons(qs('[data-page="dashboard"]') || document);
    }

    function renderDashboardStats(data) {
        var root = qs('[data-dashboard-stats]');
        if (!root) return;
        var html =
            stat('Объектов', data.projectsCount == null ? 0 : data.projectsCount, '', 'building-2') +
            stat('В работе', data.activeProjects == null ? 0 : data.activeProjects, '', 'hammer') +
            stat('Открытых задач', data.openTasksCount == null ? 0 : data.openTasksCount, data.openTasksCount ? 'warn' : '', 'list-checks');
        if (state.user && isAdminRole()) {
            html +=
                stat('Бюджет', data.totalBudget == null ? 'Скрыто' : money(data.totalBudget), '', 'wallet') +
                stat('Оплачено', data.totalPaid == null ? 'Скрыто' : money(data.totalPaid), '', 'circle-dollar-sign') +
                stat('Маржа', data.profitNow == null ? 'Скрыто' : money(data.profitNow), data.profitNow < 0 ? 'danger' : '', 'trending-up');
        }
        root.innerHTML = html;
    }

    function renderDashboardProjects(projects) {
        var root = qs('[data-dashboard-projects]');
        if (!root) return;
        if (!projects.length) {
            root.innerHTML = '<p class="muted">Пока нет объектов. Как только появятся рабочие проекты, они будут здесь.</p>';
            return;
        }
        var sortedProjects = projects.slice().sort(function (left, right) {
            var leftCompleted = isCompletedProject(left) ? 1 : 0;
            var rightCompleted = isCompletedProject(right) ? 1 : 0;
            if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;
            return Number(right.id) - Number(left.id);
        });
        root.innerHTML = sortedProjects.map(function (project) {
            var progress = percent(project.progress);
            return '<a class="dashboard-project" href="/app/projects" data-dashboard-project-id="' + project.id + '">' +
                '<div class="project-row-main">' +
                    '<b><i data-lucide="building-2" aria-hidden="true"></i><span>' + escapeHtml(project.title) + '</span></b>' +
                    '<span>' + escapeHtml(project.address || project.client_name || 'Адрес не указан') + '</span>' +
                '</div>' +
                '<div class="project-row-meta">' +
                    '<span class="badge">' + escapeHtml(project.status || 'В работе') + '</span>' +
                    '<strong>' + progress + '%</strong>' +
                '</div>' +
                '<div class="progress"><i style="width:' + progress + '%"></i></div>' +
            '</a>';
        }).join('');
    }

    function renderDashboardActions(actions) {
        var root = qs('[data-dashboard-actions]');
        if (!root) return;
        root.innerHTML = actions.length
            ? actions.map(function (item, index) {
                return '<div class="action-item"><span><i data-lucide="check-circle-2" aria-hidden="true"></i></span><p>' + escapeHtml(item) + '</p></div>';
            }).join('')
            : '<p class="muted">Сегодня без срочных действий.</p>';
    }

    function renderDashboardActivity(items) {
        var root = qs('[data-dashboard-activity]');
        if (!root) return;
        var labels = {
            task: 'Задача',
            document: 'Документ',
            log: 'Журнал',
            message: 'Чат',
            stock: 'Склад'
        };
        var icons = {
            task: 'list-checks',
            document: 'file-text',
            log: 'clipboard-list',
            message: 'messages-square',
            stock: 'warehouse'
        };
        root.innerHTML = items.length
            ? items.map(function (item) {
                return '<div class="activity-item">' +
                    '<span class="activity-kind"><i data-lucide="' + escapeHtml(icons[item.kind] || 'bell') + '" aria-hidden="true"></i><span>' + escapeHtml(labels[item.kind] || item.kind || 'Событие') + '</span></span>' +
                    '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.text || '') + '</small></div>' +
                '</div>';
            }).join('')
            : '<p class="muted">Пока здесь пусто. Когда пойдут задачи, чат, документы и складские движения, появится живая лента.</p>';
    }

    function renderDashboardCritical(items) {
        var root = qs('[data-dashboard-critical]');
        if (!root) return;
        if (state.user && hasRole('customer')) {
            root.innerHTML = '<p class="muted">Для заказчика внутренние закупки и себестоимость скрыты. Здесь остаются только внешне понятные риски по срокам и ходу работ.</p>';
            return;
        }
        root.innerHTML = items.length
            ? '<div class="compact-risk-list">' + items.slice(0, 6).map(function (item) {
                return '<div class="risk-item"><div><b><i data-lucide="triangle-alert" aria-hidden="true"></i><span>' + escapeHtml(item.title) + '</span></b><small>' + escapeHtml(item.projectTitle) + '</small></div><span class="badge danger">+' + escapeHtml(item.missingQty) + ' ' + escapeHtml(item.unit) + '</span></div>';
            }).join('') + '</div>'
            : '<p class="muted">Критичных нехваток и блокеров сейчас не видно. Держим темп по объектам и ежедневно фиксируем факт.</p>';
    }

    function renderStrongProgress(progress, label, large) {
        var safeProgress = percent(progress);
        var sizeClass = large ? ' progress-strong-lg' : '';
        return '<div class="progress-strong' + sizeClass + '" data-project-total-progress aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + safeProgress + '">' +
            '<div class="progress-strong-head"><span>' + escapeHtml(label || 'Готовность') + '</span><strong data-progress-text>' + safeProgress + '%</strong></div>' +
            '<div class="progress progress-strong-track"><i style="width:' + safeProgress + '%"></i></div>' +
        '</div>';
    }

    function setProjectFocusMode(enabled) {
        qsa('[data-project-overview-section]').forEach(function (section) {
            section.hidden = enabled;
        });
        var detail = qs('[data-project-detail]');
        if (detail) {
            detail.classList.toggle('project-detail-focus', enabled);
        }
        if (!enabled) {
            var focusRoot = qs('[data-project-focus]');
            if (focusRoot) focusRoot.innerHTML = '';
        }
    }

    function activateProjectTab(tabName) {
        var root = qs('[data-project-detail]') || document;
        syncProjectTabVisibility(root);
        if (isProjectTabHidden(tabName)) tabName = 'overview';
        var tab = qs('[data-tab="' + tabName + '"]', root);
        var panel = qs('[data-panel="' + tabName + '"]', root);
        if (!tab || !panel) return;
        qsa('[data-tab]', root).forEach(function (node) { node.classList.remove('active'); });
        qsa('[data-panel]', root).forEach(function (node) {
            var active = node === panel;
            node.classList.toggle('active', active);
            node.hidden = !active;
        });
        tab.classList.add('active');
        panel.hidden = false;
        if (tabName === 'finance' && canSeeFinances() && state.selectedProject) {
            loadProjectFinances(state.selectedProject.id, state.projectLoadingToken);
        }
    }

    function isProjectTabHidden(tabName) {
        if (hasRole('admin') || hasRole('director')) return false;
        return false;
    }

    function syncProjectTabVisibility(root) {
        root = root || qs('[data-project-detail]') || document;
        var roleHiddenTabs = {
            reports: false,
            finance: false
        };
        Object.keys(roleHiddenTabs).forEach(function (tabName) {
            var hidden = !!roleHiddenTabs[tabName];
            qsa('[data-tab="' + tabName + '"]', root).forEach(function (node) {
                node.classList.toggle('hidden', hidden);
                node.setAttribute('aria-hidden', hidden ? 'true' : 'false');
                if (hidden && node.classList.contains('active')) node.classList.remove('active');
            });
            qsa('[data-panel="' + tabName + '"]', root).forEach(function (node) {
                node.classList.toggle('hidden', hidden);
                node.setAttribute('aria-hidden', hidden ? 'true' : 'false');
                if (hidden && node.classList.contains('active')) node.classList.remove('active');
                if (hidden) node.hidden = true;
            });
        });
    }

    function updateProjectInState(project) {
        if (!project) return;
        state.projects = state.projects.map(function (item) {
            return Number(item.id) === Number(project.id) ? project : item;
        });
        if (state.selectedProject && Number(state.selectedProject.id) === Number(project.id)) {
            state.selectedProject = project;
        }
    }

    function bindProjectCreate() {
        var open = qs('[data-open-project-create]');
        var close = qs('[data-close-project-create]');
        var card = qs('[data-project-create-card]');
        var form = qs('[data-project-create-form]');
        if (open && card) open.addEventListener('click', function () { card.hidden = false; });
        if (close && card) close.addEventListener('click', function () { card.hidden = true; });
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-project-create-error]');
            if (error) error.classList.remove('active');
            api('/api/projects', {
                method: 'POST',
                body: JSON.stringify({
                    title: form.title.value.trim(),
                    address: form.address.value.trim(),
                    client_name: form.client_name.value.trim(),
                    customer_company_id: form.customer_company_id ? form.customer_company_id.value : '',
                    own_legal_entity_id: form.own_legal_entity_id ? form.own_legal_entity_id.value : '',
                    city: form.city ? form.city.value.trim() : '',
                    region: form.region ? form.region.value.trim() : '',
                    contract_no: form.contract_no.value.trim(),
                    contract_date: form.contract_date ? form.contract_date.value : '',
                    budget: Number(form.budget.value || 0),
                    started_at: form.started_at.value,
                    deadline_at: form.deadline_at.value,
                    description: form.description ? form.description.value.trim() : ''
                })
            }).then(function (data) {
                form.reset();
                if (card) card.hidden = true;
                state.projects.unshift(data.project);
                bindProjectBootstrapForm();
                var bootstrapSelect = qs('[data-bootstrap-projects]');
                if (bootstrapSelect) bootstrapSelect.value = String(data.project.id);
                renderProjectStats();
                renderProjectCritical();
                renderProjectList(state.projects);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось создать объект';
                    error.classList.add('active');
                }
            });
        });
    }

    function bindProjectBootstrapForm() {
        var form = qs('[data-project-bootstrap-form]');
        var select = qs('[data-bootstrap-projects]');
        if (select) {
            select.innerHTML = state.projects.map(function (project) {
                return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
            }).join('');
        }
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-project-bootstrap-error]');
            if (error) error.classList.remove('active');
            var payload;
            try {
                payload = JSON.parse(form.json.value);
            } catch (parseError) {
                if (error) {
                    error.textContent = 'JSON не читается. Проверь кавычки и запятые.';
                    error.classList.add('active');
                }
                return;
            }
            payload.replace_existing = form.replace_existing.value === '1';
            var projectId = Number(form.project_id.value);
            api('/api/projects/' + projectId + '/bootstrap', {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(function (data) {
                var updated = data.project;
                state.projects = state.projects.map(function (project) {
                    return Number(project.id) === Number(updated.id) ? updated : project;
                });
                renderProjectStats();
                renderProjectCritical();
                renderProjectList(state.projects);
                openProject(projectId);
                if (error) {
                    error.textContent = 'Импорт завершён: этапов ' + data.summary.stages + ', материалов ' + data.summary.materials + ', задач ' + data.summary.tasks + '.';
                    error.classList.add('active');
                }
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось импортировать структуру объекта';
                    error.classList.add('active');
                }
            });
        });
    }

    function renderProjectStats() {
        var root = qs('[data-project-stats]');
        if (!root) return;
        root.innerHTML = '';
        root.hidden = true;
    }

    function stat(label, value, kind, icon) {
        var iconHtml = icon ? '<i data-lucide="' + escapeHtml(icon) + '" aria-hidden="true"></i>' : '';
        return '<div class="stat-card ' + (kind || '') + '">' +
            '<span>' + iconHtml + escapeHtml(label) + '</span>' +
            '<strong>' + escapeHtml(value) + '</strong>' +
        '</div>';
    }

    function moveTypeLabel(type) {
        return {
            purchase: 'Закупка',
            receipt: 'Поступление',
            use: 'Использование',
            writeoff: 'Списание'
        }[type] || type || 'Операция';
    }

    function docTypeLabel(type) {
        return {
            contract: 'Договор',
            act: 'Акт',
            estimate: 'Смета',
            project_doc: 'Проектная документация',
            executive: 'Исполнительная документация',
            correspondence: 'Переписка',
            invoice: 'Счет',
            archive: 'Архив',
            photo_report: 'Фотоотчет',
            finance: 'Финансы',
            other: 'Другое',
            file: 'Файл'
        }[type] || type || 'Документ';
    }

    function statusLabel(status) {
        return {
            draft: 'Черновик',
            reviewed: 'Проверен',
            approved: 'Утвержден',
            signed: 'Подписан',
            ready: 'Готов',
            internal: 'Внутренний',
            open: 'Открыто',
            in_progress: 'В работе',
            review: 'Проверка',
            done: 'Готово',
            not_started: 'Не начат',
            started: 'Начат',
            completed: 'Завершен',
            blocked: 'Заблокирован',
            overdue: 'Просрочен'
        }[status] || status || 'Статус';
    }

    function priorityLabel(priority) {
        return {
            low: 'Низкий',
            normal: 'Средний',
            high: 'Высокий'
        }[priority] || priority || 'Приоритет';
    }

    function stageKindLabel(kind) {
        return {
            section: 'Раздел',
            subsection: 'Подраздел',
            work: 'Работа'
        }[kind] || kind || 'Этап';
    }

    function stageStatusClass(status) {

        if (status === 'blocked' || status === 'overdue') return 'danger';
        if (status === 'approved' || status === 'completed' || status === 'done') return '';
        if (status === 'started' || status === 'in_progress') return 'warn';
        return '';
    }

    function scheduleTypeLabel(type) {
        return type === 'customer' ? 'График для заказчика' : 'Внутренний график';
    }

    function getScheduleState(project, type) {
        var control = project && project.scheduleControl ? project.scheduleControl : {};
        var stateByType = control[type] || {};
        var prefix = type === 'customer' ? 'customer' : 'internal';
        return {
            type: type,
            status: stateByType.status || project[prefix + '_schedule_status'] || 'draft',
            version: Number(stateByType.version || project[prefix + '_schedule_version'] || 1),
            approvedAt: stateByType.approvedAt || project[prefix + '_schedule_approved_at'] || '',
            generatedAt: control.generatedAt || project.schedule_generated_at || ''
        };
    }

    function scheduleStateKind(state) {
        return state.status === 'approved' ? 'success' : 'warn';
    }

    function scheduleStateTitle(state) {
        return state.status === 'approved' ? 'Утвержден' : 'Черновик';
    }

    function scheduleStateMeta(state) {
        if (state.approvedAt) {
            return 'Версия ' + state.version + ' • утвержден ' + state.approvedAt;
        }
        if (state.generatedAt) {
            return 'Версия ' + state.version + ' • обновлен ' + state.generatedAt + ', ждет подтверждения';
        }
        return 'Версия ' + state.version + ' • ждет первого подтверждения';
    }

    function renderScheduleStateBoard(project) {
        if (!project) return '';
        var types = hasRole('customer') ? ['customer'] : ['internal', 'customer'];
        return '<section class="card schedule-state-board">' +
            '<div class="card-head"><h3>Статусы графика</h3><span class="muted">Черновик, утверждение и версия по каждой линии графика.</span></div>' +
            '<div class="schedule-state-list">' + types.map(function (type) {
                var stateMeta = getScheduleState(project, type);
                var actions = '';
                if (canManageSchedule()) {
                    actions = '<div class="schedule-state-actions">' +
                        (stateMeta.status !== 'approved'
                            ? '<button class="primary" type="button" data-schedule-action="approve" data-schedule-type="' + type + '">Утвердить</button>'
                            : '<button class="ghost" type="button" data-schedule-action="reset_to_draft" data-schedule-type="' + type + '">Вернуть в черновик</button>') +
                    '</div>';
                }
                return '<div class="schedule-state-row">' +
                    '<div class="schedule-state-main"><b>' + scheduleTypeLabel(type) + '</b><small>' + scheduleStateMeta(stateMeta) + '</small></div>' +
                    '<div class="schedule-state-side"><span class="badge ' + scheduleStateKind(stateMeta) + '">' + scheduleStateTitle(stateMeta) + '</span>' + actions + '</div>' +
                '</div>';
            }).join('') + '</div>' +
        '</section>';
    }

    function bindScheduleStatusActions(projectId) {
        qsa('[data-schedule-action]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var action = button.dataset.scheduleAction;
                var scheduleType = button.dataset.scheduleType || 'internal';
                button.disabled = true;
                api('/api/projects/' + projectId + '/schedule-status', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: action,
                        schedule_type: scheduleType
                    })
                }).then(function (data) {
                    updateProjectInState(data.project);
                    openProject(projectId);
                    activateProjectTab('schedule');
                }).finally(function () {
                    button.disabled = false;
                });
            });
        });
    }

    function renderProjectCritical() {
        var card = qs('[data-project-critical-card]');
        var root = qs('[data-project-critical]');
        if (!card || !root) return;
        var completedById = {};
        state.projects.forEach(function (project) {
            if (isCompletedProject(project)) completedById[project.id] = true;
        });
        var items = state.dashboard && Array.isArray(state.dashboard.criticalItems) ? state.dashboard.criticalItems.filter(function (item) {
            return !completedById[item.projectId];
        }) : [];
        if (!items.length) {
            card.hidden = true;
            return;
        }
        card.hidden = false;
        var groups = {};
        items.forEach(function (item) {
            var key = String(item.projectId || item.projectTitle || 'project');
            if (!groups[key]) {
                groups[key] = {
                    projectId: item.projectId,
                    projectTitle: item.projectTitle || 'Объект',
                    items: []
                };
            }
            groups[key].items.push(item);
        });
        var orderedGroups = Object.keys(groups).map(function (key) {
            return groups[key];
        }).sort(function (left, right) {
            return right.items.length - left.items.length;
        });
        root.innerHTML = '<div class="quick-alert-list quick-alert-groups">' + orderedGroups.map(function (group, index) {
            var first = group.items[0] || {};
            var groupLevel = criticalUrgencyLevel(group.items);
            var sectionTitle = criticalSectionTitle(first);
            var summaryMeta = [
                String(group.items.length) + ' поз.',
                criticalDaysText(first),
                sectionTitle ? ('раздел: ' + sectionTitle) : ''
            ].filter(Boolean).join(' • ');
            return '<details class="quick-alert quick-alert-group is-' + groupLevel + '">' +
                '<summary>' +
                    '<span><b>' + escapeHtml(group.projectTitle) + '</b><small>' + escapeHtml(summaryMeta || 'Есть критичные позиции') + '</small></span>' +
                    '<strong>' + escapeHtml(String(group.items.length)) + '</strong>' +
                '</summary>' +
                '<div class="quick-alert-details">' + group.items.map(function (item) {
                    var itemLevel = criticalUrgencyLevel([item]);
                    var itemSectionTitle = criticalSectionTitle(item);
                    var itemStageTitle = criticalStageTitle(item);
                    var meta = [
                        itemSectionTitle ? ('Раздел: ' + itemSectionTitle) : '',
                        itemStageTitle ? ('Этап: ' + itemStageTitle) : '',
                        item.workDate ? ('работа: ' + finalGraphDate(item.workDate)) : '',
                        criticalDaysText(item)
                    ].filter(Boolean).join(' • ');
                    return '<a class="quick-alert-detail is-' + itemLevel + '" href="/app/projects?openProject=' + escapeHtml(item.projectId || '') + '">' +
                        '<span><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta || 'Раздел не указан') + '</small></span>' +
                        '<strong>' + escapeHtml(item.missingQty) + ' ' + escapeHtml(item.unit) + '</strong>' +
                    '</a>';
                }).join('') + '</div>' +
            '</details>';
        }).join('') + '</div>';
    }

    function signedDaysBetween(start, end) {
        var startTime = Date.parse(String(start || '') + 'T00:00:00Z');
        var endTime = Date.parse(String(end || '') + 'T00:00:00Z');
        if (Number.isNaN(startTime) || Number.isNaN(endTime)) return null;
        return Math.round((endTime - startTime) / 86400000);
    }

    function criticalDaysText(item) {
        if (!item) return '';
        var days = item.daysUntilWork;
        if (days == null || days === '') days = signedDaysBetween(APP_TODAY, item.workDate || item.needByDate || '');
        days = Number(days);
        if (!Number.isFinite(days)) return '';
        if (days < 0) return 'просрочено на ' + Math.abs(days) + ' дн.';
        if (days === 0) return 'работа сегодня';
        return 'до работы ' + days + ' дн.';
    }

    function cleanCriticalSectionTitle(value) {
        var text = String(value || '').trim();
        var normalized = text.toLocaleLowerCase('ru');
        if (!text) return '';
        if (['подготовка', 'основные работы', 'исполнительная документация', 'сдача объекта'].indexOf(normalized) !== -1) return '';
        var numberMatch = text.match(/^(?:раздел\s*)?(\d+)(?:[\.\):\-\s]|$)/i);
        if (numberMatch) return 'Раздел ' + numberMatch[1];
        return text;
    }

    function criticalSectionTitle(item) {
        return cleanCriticalSectionTitle(item && item.sectionTitle);
    }

    function criticalStageTitle(item) {
        var stage = String(item && item.stageTitle || '').trim();
        var section = String(item && item.sectionTitle || '').trim();
        if (!stage || stage === section) return '';
        return stage;
    }

    function criticalUrgencyDays(item) {
        if (!item) return null;
        var days = item.daysUntilWork;
        if (days == null || days === '') days = signedDaysBetween(APP_TODAY, item.workDate || item.needByDate || '');
        days = Number(days);
        return Number.isFinite(days) ? days : null;
    }

    function criticalUrgencyLevel(items) {
        var daysList = (items || []).map(criticalUrgencyDays).filter(function (days) {
            return days != null;
        });
        if (!daysList.length) return 'low';
        var minDays = Math.min.apply(Math, daysList);
        if (minDays <= 1) return 'critical';
        if (minDays <= 5) return 'medium';
        return 'low';
    }

    function isCompletedProject(project) {
        var status = String(project && project.status || '').toLocaleLowerCase('ru');
        return ['заверш', 'сан', 'закрыт', 'completed', 'done', 'approved'].some(function (part) {
            return status.indexOf(part) !== -1;
        }) || Number(project && project.progress || 0) >= 100;
    }

    function sectionScheduleCardClass(section) {
        var start = String(section.startDate || '').trim();
        var end = String(section.endDate || '').trim();
        if (start && end && start <= APP_TODAY && end >= APP_TODAY) return ' is-current';
        if (end && end < APP_TODAY) return ' is-past';
        if (start && start > APP_TODAY) return ' is-upcoming';
        return '';
    }

    function finalFormatScheduleDate(iso) {
        return formatDisplayDate(iso);
    }

    renderScheduleScale = function (range) {
        var marks = [];
        var steps = range.totalDays <= 4 ? range.totalDays : 5;
        for (var index = 0; index < steps; index += 1) {
            var offset = steps === 1 ? 0 : Math.round(((range.totalDays - 1) * index) / (steps - 1));
            var iso = addDaysToIso(range.start, offset);
            var left = range.totalDays === 1 ? 0 : (offset / (range.totalDays - 1)) * 100;
            var sideClass = index === 0 ? ' is-start' : (index === steps - 1 ? ' is-end' : '');
            var label = finalFormatScheduleDate(iso);
            marks.push('<span class="schedule-gantt-mark' + sideClass + '" style="left:' + left + '%"><i></i><b>' + escapeHtml(label) + '</b></span>');
        }
        return '<div class="schedule-gantt-scale"><div class="schedule-gantt-scale-line"></div>' + marks.join('') + '</div>' +
            '<div class="schedule-gantt-legend"><span><i class="legend-dot"></i> контрольные даты</span><span><i class="legend-bar"></i> окно раздела</span><span><i class="legend-today"></i> сегодня</span></div>';
    };

    renderSectionScheduleBrief = function (section) {
        return '<article class="section-schedule-brief' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-brief-head">' +
                '<h4>' + escapeHtml(section.title) + '</h4>' +
                '<small>' + escapeHtml(finalFormatScheduleDate(section.startDate) + ' - ' + finalFormatScheduleDate(section.endDate)) + '</small>' +
            '</div>' +
            '<div class="section-schedule-brief-duration"><strong>' + escapeHtml(String(section.estimatedDays || 0)) + '</strong><span>дн.</span></div>' +
            '<p><span>Ускорение:</span> ' + escapeHtml(sectionAccelerationShortHint(section)) + '</p>' +
        '</article>';
    };

    function dataItem(label, value) {

        return '<div class="data-item"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
    }

    function renderProjectFocus(project) {
        var progress = percent(project.progress);
        var status = project.status || 'Подготовка';
        var budget = project.budget == null ? 'Не указан' : money(project.budget);
        var paid = project.paid == null ? '0 ₽' : money(project.paid);
        return '<div class="project-focus-grid">' +
            '<div class="project-focus-main">' +
                '<span class="project-focus-kicker">Выбран объект</span>' +
                '<h3>' + escapeHtml(project.title || 'Без названия') + '</h3>' +
                '<p>' + escapeHtml(project.address || 'Адрес пока не заполнен') + '</p>' +
                '<div class="project-focus-badges">' +
                    '<span class="badge">' + escapeHtml(status) + '</span>' +
                    '<span class="badge">' + escapeHtml('Прогресс ' + progress + '%') + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="project-focus-meta">' +
                '<div><span>Заказчик</span><strong>' + escapeHtml(project.client_name || '—') + '</strong></div>' +
                '<div><span>Номер договора</span><strong>' + escapeHtml(project.contract_no || 'Не указано') + '</strong></div>' +
                '<div><span>Бюджет</span><strong>' + escapeHtml(budget) + '</strong></div>' +
                '<div><span>Оплачено</span><strong>' + escapeHtml(paid) + '</strong></div>' +
                '<div><span>Старт</span><strong>' + escapeHtml(project.started_at || '—') + '</strong></div>' +
                '<div><span>Дедлайн</span><strong>' + escapeHtml(project.deadline_at || '—') + '</strong></div>' +
            '</div>' +
        '</div>';
    }

    function loadUserDirectory(callback) {

        if (state.users.length) {
            callback(state.users);
            return;
        }
        api('/api/admin/users').then(function (data) {
            state.users = Array.isArray(data.users) ? data.users : [];
            callback(state.users);
        }).catch(function () {
            state.users = [];
            callback(state.users);
        });
    }

    function loadProjectAssignments(projectId, loadingToken) {
        var root = qs('[data-project-assignments]');
        if (!root) return;
        loadProjectHub(projectId, state.selectedProject, loadingToken);
        api('/api/projects/' + projectId + '/assignments').then(function (data) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            var assignments = Array.isArray(data.assignments) ? data.assignments : [];
            if (!isAdminRole()) {
                renderProjectAssignments(projectId, assignments);
                return;
            }
            loadRoles(function () {
                loadUserDirectory(function () {
                    if (!isCurrentProject(projectId, loadingToken)) return;
                    renderProjectAssignments(projectId, assignments);
                });
            });
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return;
            safeReplaceChildren(root, '<p class="muted">Не удалось загрузить назначения.</p>');
        });
    }

    function renderProjectAssignments(projectId, assignments) {
        var root = qs('[data-project-assignments]');
        if (!root) return;
        var rows = assignments.length
            ? '<div class="assignments-list">' + assignments.map(function (item) {
                return '<div class="assignment-row"><div><b>' + escapeHtml(item.userName) + '</b><small>' + escapeHtml(item.responsibility || item.userLogin || '') + '</small></div><span class="badge">' + escapeHtml(item.roleLabel || item.roleCode) + (item.isPrimary ? ' • основной' : '') + '</span></div>';
            }).join('') + '</div>'
            : '<p class="muted">Люди на объект пока не назначены.</p>';
        safeReplaceChildren(root, rows + (isAdminRole() ? renderAssignmentForm() : ''));
        bindAssignmentForm(projectId);
    }

    function renderAssignmentForm() {
        var userOptions = state.users.map(function (user) {
            return '<option value="' + user.id + '">' + escapeHtml(user.name + ' • ' + user.login) + '</option>';
        }).join('');
        var roleOptions = state.roles.filter(function (role) {
            return ['admin', 'buyer', 'client'].indexOf(role.code) === -1;
        }).map(function (role) {
            return '<option value="' + escapeHtml(role.code) + '">' + escapeHtml(role.name || role.code) + '</option>';
        }).join('');
        return '<form class="assignment-form" data-assignment-form>' +
            '<select name="user_id" required><option value="">Выберите сотрудника</option>' + userOptions + '</select>' +
            '<select name="role_code" required><option value="">Роль на объекте</option>' + roleOptions + '</select>' +
            '<input name="responsibility" placeholder="Зона ответственности">' +
            '<label class="check-inline"><input name="is_primary" type="checkbox"> Основной</label>' +
            '<button class="primary" type="submit">Назначить</button>' +
            '<div class="form-error" data-assignment-error></div>' +
        '</form>';
    }

    function bindAssignmentForm(projectId) {

        var form = qs('[data-assignment-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-assignment-error]');
            if (error) error.classList.remove('active');
            api('/api/projects/' + projectId + '/assignments', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: form.user_id.value,
                    role_code: form.role_code.value,
                    responsibility: form.responsibility.value.trim(),
                    is_primary: form.is_primary.checked
                })
            }).then(function () {
                loadProjectAssignments(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось назначить сотрудника';
                    error.classList.add('active');
                }
            });
        });
    }

    function loadMaterials(projectId, callback) {
        if (state.materialsByProject[projectId]) {
            callback(state.materialsByProject[projectId]);
            return;
        }
        api('/api/projects/' + projectId + '/materials-summary').then(function (data) {
            var items = Array.isArray(data.items) ? data.items : [];
            state.materialsByProject[projectId] = items;
            callback(items);
        }).catch(function () {
            callback([]);
        });
    }

    function loadMaterialInsights(projectId, callback) {
        if (state.materialInsightsByProject[projectId]) {
            ensureCounterpartyCompanies(function () {
                callback(state.materialInsightsByProject[projectId]);
            });
            return;
        }
        if (!canManageSuppliers()) {
            state.materialInsightsByProject[projectId] = {};
            callback({});
            return;
        }
        api('/api/projects/' + projectId + '/supplier-offers').then(function (data) {
            var offers = Array.isArray(data.offers) ? data.offers : [];
            var insights = {};
            var allOptions = [];
            offers.forEach(function (offer) {
                var materialId = Number(offer.estimate_item_id || 0);
                var candidateType = offer.candidate_type === 'contractor' ? 'contractor' : 'supplier';
                var option = {
                    id: Number(offer.id || 0),
                    estimateItemId: materialId,
                    name: offer.candidate_name || offer.company_name || (candidateType === 'contractor' ? 'Подрядчик' : 'Поставщик'),
                    company: offer.company_name || '',
                    companyId: Number(offer.company_id || 0),
                    candidateType: candidateType,
                    status: offer.status || 'new',
                    price: Number(offer.price || 0),
                    qty: Number(offer.qty || 0),
                    phone: offer.phone || '',
                    sourceUrl: offer.source_url || '',
                    notes: offer.notes || ''
                };
                allOptions.push(option);
                if (!materialId) return;
                if (!insights[materialId]) {
                    insights[materialId] = {
                        total: 0,
                        selected: 0,
                        quoted: 0,
                        called: 0,
                        selectedName: '',
                        selectedOfferId: 0,
                        selectedByType: {
                            supplier: null,
                            contractor: null
                        },
                        options: []
                    };
                }
                insights[materialId].total += 1;
                if (offer.status === 'selected') insights[materialId].selected += 1;
                if (offer.status === 'quoted') insights[materialId].quoted += 1;
                if (offer.status === 'called') insights[materialId].called += 1;
                if (offer.status === 'selected' && !insights[materialId].selectedName) {
                    insights[materialId].selectedName = option.name;
                    insights[materialId].selectedOfferId = option.id;
                }
                if (offer.status === 'selected' && !insights[materialId].selectedByType[candidateType]) {
                    insights[materialId].selectedByType[candidateType] = option;
                }
                insights[materialId].options.push(option);
            });
            insights.__allOptions = allOptions;
            state.materialInsightsByProject[projectId] = insights;
            ensureCounterpartyCompanies(function () {
                callback(insights);
            });
        }).catch(function () {
            state.materialInsightsByProject[projectId] = {};
            ensureCounterpartyCompanies(function () {
                callback({});
            });
        });
    }

    function loadProjectMarketAnalysis(projectId, kind, callback, force) {
        kind = kind === 'work' ? 'work' : 'material';
        if (!state.marketAnalysisByProject[projectId]) state.marketAnalysisByProject[projectId] = {};
        var cache = state.marketAnalysisByProject[projectId][kind];
        if (!force && cache && !cache.error && Array.isArray(cache.rows)) {
            callback(cache);
            return;
        }
        if (cache && cache.loading) return;
        state.marketAnalysisByProject[projectId][kind] = { loading: true, rows: [] };
        api('/api/projects/' + projectId + '/market-analysis?kind=' + kind).then(function (data) {
            var rows = Array.isArray(data && data.rows) ? data.rows : [];
            state.marketAnalysisByProject[projectId][kind] = {
                loading: false,
                error: rows.length ? '' : String(data && data.error || ''),
                rows: rows,
                summary: data && data.summary || {},
                estimateId: data && data.estimateId || ''
            };
            callback(state.marketAnalysisByProject[projectId][kind]);
        }).catch(function (error) {
            var payload = error && error.payload || {};
            var rows = Array.isArray(payload.rows) ? payload.rows : [];
            state.marketAnalysisByProject[projectId][kind] = {
                loading: false,
                error: rows.length ? '' : (payload.error || 'market_analysis_failed'),
                rows: rows,
                summary: payload.summary || {}
            };
            callback(state.marketAnalysisByProject[projectId][kind]);
        });
    }

    function renderMaterialsLegacy(items, projectId, insights) {
        if (!items.length) return '<p class="muted">Материалы по смете пока не загружены.</p>';
        var required = items.filter(function (item) { return item.supplyStatus === 'required'; }).length;
        var soon = items.filter(function (item) { return item.supplyStatus === 'soon'; }).length;
        var planned = items.filter(function (item) { return item.supplyStatus === 'planned'; }).length;
        var safe = items.filter(function (item) { return item.supplyStatus === 'in_stock'; }).length;
        insights = insights || {};
        return '<div class="execution-summary">' +
            stat('Всего позиций', String(items.length)) +
            stat('Требуется', String(required), required ? 'danger' : '') +
            stat('Скоро', String(soon), soon ? 'warn' : '') +
            stat('Запланировать', String(planned), planned ? 'warn' : '') +
            stat('В наличии', String(safe)) +
            stat('Нехватки', String(items.filter(function (item) { return Number(item.missingQty) > 0; }).length), items.some(function (item) { return Number(item.missingQty) > 0; }) ? 'danger' : '') +
        '</div><div class="materials-list">' + items.map(function (item) { return materialRowLegacy(item, projectId, insights[Number(item.id)] || null); }).join('') + '</div>';
    }

    function materialRowLegacy(item, projectId, insight) {
        var missing = Number(item.missingQty) || 0;
        var meta = [
            'По смете: ' + item.plannedQty + ' ' + escapeHtml(item.unit),
            'куплено: ' + item.purchasedQty,
            'иИспользовано: ' + item.usedQty,
            'остаток: ' + item.stockQty,
            item.needByDate ? 'нужно к ' + item.needByDate : '',
            item.stageTitle ? 'этап: ' + item.stageTitle : ''
        ].filter(Boolean).join(' • ');
        var supplyNote = '';
        if (insight) {
            supplyNote = insight.selected
                ? 'Выбран поставщик: ' + insight.selected
                : insight.quoted
                    ? 'Просчитано предложений: ' + insight.quoted
                    : insight.called
                        ? 'Уже в обзвоне: ' + insight.called
                        : 'В работе поставщиков: ' + insight.total;
        } else if (canManageSuppliers()) {
            supplyNote = 'Поставщик по этой позиции еще не заведен';
        }
        var actions = '<div class="material-chain-actions">' +
            (canManageSuppliers() ? '<a class="ghost material-link" href="/app/suppliers?projectId=' + projectId + '&materialId=' + item.id + '">Поставщик</a>' : '') +
            (canSeeFinances() ? '<button class="ghost material-link" type="button" data-open-finance-tab>Финансы</button>' : '') +
        '</div>';
        return '<div class="material-row material-row-linked">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + meta + (item.notes ? '<br>' + escapeHtml(item.notes) : '') + (supplyNote ? '<br>' + escapeHtml(supplyNote) : '') + '</small></div>' +
            '<div class="material-chain-side"><span class="badge ' + planningStatusClass(item.supplyStatus || (missing > 0 ? 'required' : 'in_stock')) + '">' + escapeHtml(item.supplyLabel || (missing > 0 ? ('Нужно закрыть нехватку: ' + missing + ' ' + item.unit) : 'Статус поставки не указан')) + '</span>' + actions + '</div>' +
        '</div>';
    }

    function refreshCounterpartyProjectViews(projectId) {
        delete state.materialInsightsByProject[projectId];
        loadMaterialInsights(projectId, function (insights) {
            if (typeof rerenderProjectMaterialAndWorkViews === 'function') {
                rerenderProjectMaterialAndWorkViews(projectId);
                return;
            }
            if (state.materialsByProject[projectId]) {
                var materialsHtml = renderMaterials(state.materialsByProject[projectId], projectId, insights || {});
                var materialsPanel = qs('[data-panel="materials"]');
                if (materialsPanel && state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    safeReplaceChildren(materialsPanel, materialsHtml);
                }
                var overviewMaterials = qs('[data-project-overview-materials]');
                if (overviewMaterials && state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    safeReplaceChildren(overviewMaterials, materialsHtml);
                }
                bindProjectChainActions();
            }
        });
    }

    function attachCounterpartyToEstimateItem(button) {
        var projectId = Number(button.dataset.projectId || 0);
        var offerId = Number(button.dataset.offerId || 0);
        var companyId = Number(button.dataset.companyId || 0);
        var itemId = Number(button.dataset.materialId || 0);
        var companyName = button.dataset.companyName || '';
        var candidateType = button.dataset.candidateType === 'contractor' ? 'contractor' : 'supplier';
        if (!projectId) return Promise.reject(new Error('project_required'));
        if (offerId) {
            return api('/api/supplier-offers/' + offerId + '/update', {
                method: 'POST',
                body: JSON.stringify({
                    status: 'selected',
                    company_id: companyId || '',
                    candidate_name: companyName || undefined,
                    price: Number(button.dataset.price || 0),
                    qty: Number(button.dataset.qty || 0),
                    phone: button.dataset.phone || '',
                    source_url: button.dataset.sourceUrl || '',
                    notes: button.dataset.notes || ''
                })
            });
        }
        if (!itemId || !companyName) return Promise.reject(new Error('counterparty_required'));
        return api('/api/projects/' + projectId + '/supplier-offers', {
            method: 'POST',
            body: JSON.stringify({
                estimate_item_id: itemId,
                company_id: companyId,
                candidate_type: candidateType,
                candidate_name: companyName,
                source_type: 'manual',
                phone: button.dataset.phone || '',
                qty: Number(button.dataset.itemQty || button.dataset.qty || 0),
                unit: button.dataset.itemUnit || '',
                status: 'selected',
                notes: button.dataset.notes || ''
            })
        });
    }

    function clearCounterpartyFromEstimateItem(button) {
        var projectId = Number(button.dataset.projectId || 0);
        var offerId = Number(button.dataset.offerId || 0);
        if (!projectId) return Promise.reject(new Error('project_required'));
        if (!offerId) return Promise.resolve({});
        return api('/api/supplier-offers/' + offerId + '/update', {
            method: 'POST',
            body: JSON.stringify({
                status: 'quoted'
            })
        });
    }

    function closeCounterpartyMenus() {
        qsa('[data-supplier-menu]').forEach(function (node) {
            node.hidden = true;
            node.removeAttribute('style');
        });
        qsa('.is-counterparty-open').forEach(function (node) { node.classList.remove('is-counterparty-open'); });
        qsa('.has-counterparty-open').forEach(function (node) { node.classList.remove('has-counterparty-open'); });
    }

    function toggleCounterpartyMenu(button) {
        var picker = button.closest('.material-supplier-picker');
        var menu = picker ? qs('[data-supplier-menu]', picker) : null;
        if (!menu) return;
        var shouldOpen = menu.hidden;
        closeCounterpartyMenus();
        menu.hidden = !shouldOpen;
        if (!menu.hidden) {
            picker.classList.add('is-counterparty-open');
            var row = picker.closest('.material-row, .work-row');
            var section = picker.closest('.estimate-section-card, .estimate-section');
            if (row) row.classList.add('is-counterparty-open');
            if (section) section.classList.add('has-counterparty-open');
        }
    }

    function selectCounterpartyOption(button) {
        var projectId = Number(button.dataset.projectId || 0);
        if (!projectId || button.dataset.supplierSelecting === '1') return;
        button.dataset.supplierSelecting = '1';
        button.disabled = true;
        var request = button.hasAttribute('data-supplier-clear')
            ? clearCounterpartyFromEstimateItem(button)
            : attachCounterpartyToEstimateItem(button);
        request.then(function () {
            refreshCounterpartyProjectViews(projectId);
        }).catch(function () {
            window.alert(button.hasAttribute('data-supplier-clear') ? 'Не удалось снять контрагента.' : 'Не удалось закрепить контрагента.');
        }).finally(function () {
            button.disabled = false;
            button.dataset.supplierSelecting = '0';
        });
    }

    function bindProjectChainActions() {
        qsa('[data-supplier-toggle]').forEach(function (button) {
            if (button.dataset.supplierToggleBound === '1') return;
            button.dataset.supplierToggleBound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                toggleCounterpartyMenu(button);
            });
        });

        qsa('[data-supplier-select]').forEach(function (button) {
            if (button.dataset.supplierSelectBound === '1') return;
            button.dataset.supplierSelectBound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                selectCounterpartyOption(button);
            });
        });

        if (!document.body.dataset.materialSupplierDelegatedBound) {
            document.body.dataset.materialSupplierDelegatedBound = '1';
            document.addEventListener('click', function (event) {
                var selectButton = event.target && event.target.closest ? event.target.closest('[data-supplier-select]') : null;
                if (selectButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                    selectCounterpartyOption(selectButton);
                    return;
                }
                var toggleButton = event.target && event.target.closest ? event.target.closest('[data-supplier-toggle]') : null;
                if (toggleButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                    toggleCounterpartyMenu(toggleButton);
                }
            });
        }

        if (!document.body.dataset.materialSupplierMenuBound) {
            document.body.dataset.materialSupplierMenuBound = '1';
            document.addEventListener('click', function () {
                closeCounterpartyMenus();
            });
            window.addEventListener('resize', closeCounterpartyMenus);
        }
    }

    function loadStages(projectId, callback) {
        if (state.stagesByProject[projectId]) {
            callback(state.stagesByProject[projectId]);
            return;
        }
        api('/api/projects/' + projectId + '/stages').then(function (data) {
            state.stagesByProject[projectId] = Array.isArray(data.stages) ? data.stages : [];
            callback(state.stagesByProject[projectId]);
        }).catch(function () {
            callback([]);
        });
    }

    function buildStageRows(stages) {
        var map = {};
        stages.forEach(function (stage) { map[stage.id] = stage; });
        return stages.map(function (stage) {
            var depth = 0;
            var parentId = stage.parent_id;
            while (parentId && map[parentId] && depth < 8) {
                depth += 1;
                parentId = map[parentId].parent_id;
            }
            return { stage: stage, depth: depth };
        });
    }

    function renderExecutionSummary(stages) {
        if (!stages.length) return '';
        var today = APP_TODAY;
        var active = stages.filter(function (stage) {
            return ['started', 'in_progress'].indexOf(stage.status_code) !== -1;
        }).length;
        var done = stages.filter(function (stage) {
            return ['completed', 'approved'].indexOf(stage.status_code) !== -1 || percent(stage.progress) === 100;
        }).length;
        var blocked = stages.filter(function (stage) {
            return stage.status_code === 'blocked';
        }).length;
        var overdue = stages.filter(function (stage) {
            return isStageOverdue(stage, today);
        }).length;
        var behind = stages.filter(function (stage) {
            return isStageBehindPlan(stage, today);
        }).length;
        return '<div class="execution-summary">' +
            stat('Этапов', String(stages.length)) +
            stat('В работе', String(active), active ? 'warn' : '') +
            stat('Завершено', String(done)) +
            stat('Просрочено', String(overdue), overdue ? 'danger' : '') +
            stat('Отстают', String(behind), behind ? 'warn' : '') +
            stat('Блокеры', String(blocked), blocked ? 'danger' : '') +
        '</div>';
    }

    function isStageOverdue(stage, today) {
        var progress = percent(stage.progress);
        if (stage.status_code === 'approved' || stage.status_code === 'completed' || progress >= 100) return false;
        if (stage.status_code === 'overdue') return true;
        return Boolean(stage.planned_end && stage.planned_end < today);
    }

    function isStageBehindPlan(stage, today) {
        var progress = percent(stage.progress);
        if (!stage.planned_start || !stage.planned_end) return false;
        if (progress >= 100) return false;
        if (today < stage.planned_start) return false;
        if (today > stage.planned_end) return false;
        var totalDays = daysBetween(stage.planned_start, stage.planned_end);
        if (totalDays <= 0) return progress < 100;
        var elapsedDays = daysBetween(stage.planned_start, today);
        var expected = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));
        return progress + 15 < expected;
    }

    function daysBetween(start, end) {
        var startTime = Date.parse(start + 'T00:00:00Z');
        var endTime = Date.parse(end + 'T00:00:00Z');
        if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
        return Math.max(0, Math.round((endTime - startTime) / 86400000));
    }

    function renderExecutionPanel(stages, projectId) {
        var rows = buildStageRows(stages);
        var summary = renderExecutionSummary(stages);
        var insights = '<div class="execution-insights" data-execution-insights></div>';
        var list = rows.length
            ? '<div class="execution-list">' + rows.map(function (item) {
                return renderExecutionRow(item.stage, item.depth);
            }).join('') + '</div>'
            : '<p class="muted">Структура объекта пока не заполнена.</p>';
        var createForm = hasRole('customer') ? '' : renderStageCreateForm(projectId, stages);
        return summary + insights + createForm + list;
    }

    function renderExecutionRow(stage, depth) {
        var progress = percent(stage.progress);
        var today = APP_TODAY;
        var indent = Math.min(depth * 22, 110);
        var meta = [
            stageKindLabel(stage.stage_kind),
            stage.responsible || '',
            stage.planned_start || '',
            stage.planned_end || '',
            stage.depends_on_materials ? 'зависит от материалов' : ''
        ].filter(Boolean).join(' • ');
        var riskClass = stage.status_code === 'blocked' ? ' execution-row-risk' : (isStageOverdue(stage, today) ? ' execution-row-overdue' : '');
        if (hasRole('customer')) {
            return '<div class="execution-row' + riskClass + '" style="padding-left:' + indent + 'px">' +
                '<div><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta) + '</small></div>' +
                '<div class="execution-meta"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + '</span><strong>' + progress + '%</strong></div>' +
            '</div>';
        }
        return '<form class="execution-row execution-edit-form' + riskClass + '" data-stage-edit-form data-stage-id="' + stage.id + '" style="padding-left:' + indent + 'px">' +
            '<div class="execution-main"><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta) + '</small></div>' +
            '<select name="status_code">' +
                renderStageStatusOptions(stage.status_code) +
            '</select>' +
            '<input name="progress" type="number" min="0" max="100" value="' + progress + '">' +
            '<input name="planned_start" type="date" value="' + escapeHtml(stage.planned_start || '') + '">' +
            '<input name="planned_end" type="date" value="' + escapeHtml(stage.planned_end || '') + '">' +
            '<input name="fact_start" type="date" value="' + escapeHtml(stage.fact_start || '') + '">' +
            '<input name="fact_end" type="date" value="' + escapeHtml(stage.fact_end || '') + '">' +
            '<input name="customer_start" type="date" value="' + escapeHtml(stage.customer_start || '') + '">' +
            '<input name="customer_end" type="date" value="' + escapeHtml(stage.customer_end || '') + '">' +
            '<input name="responsible" value="' + escapeHtml(stage.responsible || '') + '" placeholder="Ответственный">' +
            '<label class="check-inline"><input type="checkbox" name="is_client_visible" ' + (stage.is_client_visible ? 'checked' : '') + '> Заказчику</label>' +
            '<button class="ghost" type="submit">Сохранить</button>' +
        '</form>';
    }

    function renderStageStatusOptions(current) {
        return ['not_started', 'started', 'in_progress', 'completed', 'approved', 'blocked', 'overdue'].map(function (status) {
            return '<option value="' + status + '"' + (status === current ? ' selected' : '') + '>' + escapeHtml(statusLabel(status)) + '</option>';
        }).join('');
    }

    function renderStageCreateForm(projectId, stages) {
        var options = '<option value="">Без родителя</option>' + stages.map(function (stage) {
            return '<option value="' + stage.id + '">' + escapeHtml(stage.title) + '</option>';
        }).join('');
        return '<form class="stage-create-form" data-stage-create-form data-project-id="' + projectId + '">' +
            '<div class="card-head"><h3>Добавить раздел или работу</h3></div>' +
            '<input name="title" placeholder="Название">' +
            '<select name="stage_kind"><option value="section">Раздел</option><option value="subsection">Подраздел</option><option value="work">Работа</option></select>' +
            '<select name="parent_id">' + options + '</select>' +
            '<input name="responsible" placeholder="Ответственный">' +
            '<input name="planned_start" type="date">' +
            '<input name="planned_end" type="date">' +
            '<button class="primary" type="submit">Добавить</button>' +
            '<div class="form-error" data-stage-create-error></div>' +
        '</form>';
    }

    function bindStageCreateForm(projectId) {
        var form = qs('[data-stage-create-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-stage-create-error]');
            if (error) error.classList.remove('active');
            api('/api/projects/' + projectId + '/stages', {
                method: 'POST',
                body: JSON.stringify({
                    title: form.title.value.trim(),
                    stage_kind: form.stage_kind.value,
                    parent_id: form.parent_id.value,
                    responsible: form.responsible.value.trim(),
                    planned_start: form.planned_start.value,
                    planned_end: form.planned_end.value
                })
            }).then(function (data) {
                if (data && data.project) updateProjectInState(data.project);
                state.stagesByProject[projectId] = null;
                loadStages(projectId, function (stages) {
                    qs('[data-panel="execution"]').innerHTML = renderExecutionPanel(stages, projectId);
                    qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, state.selectedProject);
                    bindStageCreateForm(projectId);
                    bindStageEditors(projectId);
                    bindScheduleStatusActions(projectId);
                    loadExecutionInsights(projectId, stages);
                });
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось добавить этап';
                    error.classList.add('active');
                }
            });
        });
    }

    function bindStageEditors(projectId) {
        qsa('[data-stage-edit-form]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                api('/api/stages/' + form.dataset.stageId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        status_code: form.status_code.value,
                        progress: Number(form.progress.value || 0),
                        planned_start: form.planned_start.value,
                        planned_end: form.planned_end.value,
                        fact_start: form.fact_start.value,
                        fact_end: form.fact_end.value,
                        customer_start: form.customer_start.value,
                        customer_end: form.customer_end.value,
                        responsible: form.responsible.value.trim(),
                        is_client_visible: form.is_client_visible.checked
                    })
                }).then(function (data) {
                    if (data && data.project) updateProjectInState(data.project);
                    state.stagesByProject[projectId] = null;
                    loadStages(projectId, function (stages) {
                        qs('[data-panel="execution"]').innerHTML = renderExecutionPanel(stages, projectId);
                        qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, state.selectedProject);
                        bindStageCreateForm(projectId);
                        bindStageEditors(projectId);
                        bindScheduleStatusActions(projectId);
                        loadExecutionInsights(projectId, stages);
                    });
                });
            });
        });
    }

    function renderAutoScheduleDrawer(project) {
        if (!project || !canManageSchedule()) return '';
        return '<div class="drawer-overlay auto-schedule-overlay" data-auto-schedule-overlay aria-hidden="true"></div>' +
            '<div class="drawer-panel auto-schedule-drawer" data-auto-schedule-drawer aria-hidden="true">' +
                '<button class="drawer-close" type="button" data-auto-schedule-close aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c">\u00d7</button>' +
                '<div class="drawer-head"><h3>\u0410\u0432\u0442\u043e\u043f\u043b\u0430\u043d \u0433\u0440\u0430\u0444\u0438\u043a\u0430</h3><p>\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442 \u0434\u0430\u0442\u044b \u044d\u0442\u0430\u043f\u043e\u0432 \u0438\u0437 \u0441\u043c\u0435\u0442\u044b \u0438 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u044b \u043e\u0431\u044a\u0435\u043a\u0442\u0430.</p></div>' +
                '<form class="schedule-planner-form" data-auto-schedule-form data-project-id="' + project.id + '">' +
                    '<label><span>\u0421\u0442\u0430\u0440\u0442 \u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f</span><input name="start_date" type="date" value="2026-08-09"></label>' +
                    '<button class="primary" type="submit">\u041f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a</button>' +
                    '<div class="form-error" data-auto-schedule-error></div>' +
                '</form>' +
            '</div>';
    }

    function renderSchedulePlanner(project, stages) {
        return '';
    }


    function renderScheduleRows(stages, customerMode) {
        var today = APP_TODAY;
        stages = Array.isArray(stages) ? stages : [];
        if (!stages.length) return '<p class="muted">\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u044d\u0442\u0430\u043f\u043e\u0432 \u0434\u043b\u044f \u0433\u0440\u0430\u0444\u0438\u043a\u0430.</p>';
        return '<div class="timeline">' + stages.map(function (stage) {
            var start = customerMode ? (stage.customer_start || stage.planned_start || '\u2014') : (stage.planned_start || '\u2014');
            var end = customerMode ? (stage.customer_end || stage.planned_end || '\u2014') : (stage.planned_end || '\u2014');
            var summary = customerMode
                ? (start + ' \u2014 ' + end + ' \u2022 ' + statusLabel(stage.status_code))
                : buildScheduleStageSummary(stage, today);
            var kicker = [timelineStageKindLabel(stage), !customerMode ? (stage.responsible || '') : ''].filter(Boolean).join(' \u2022 ');
            return '<div class="timeline-row ' + scheduleTimelineClass(stage, today) + timelineStageKindClass(stage) + '">' +
                '<div class="timeline-main">' +
                    (kicker ? '<small class="timeline-kicker">' + escapeHtml(kicker) + '</small>' : '') +
                    '<b>' + escapeHtml(stage.title) + '</b><span>' + escapeHtml(summary) + '</span>' +
                '</div>' +
                renderTimelineProgressCell(stage) +
                '<div class="timeline-badges">' + renderScheduleStageBadges(stage, today, customerMode) + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }

    function liveScheduleSectionItems(section) {
        return (Array.isArray(section && section.items) ? section.items : []).filter(function (item) {
            return item && !item.is_deleted && !item.isDeleted && String(item.title || '').trim();
        });
    }

    function renderSectionScheduleRow(project, section) {
        section = section || {};
        var sectionTitle = canonicalEstimateSectionTitle(section.title || '');
        var items = Array.isArray(section.items) ? section.items : [];
        var visibleItems = liveScheduleSectionItems(section);
        if (items.length !== visibleItems.length && window.console) {
            console.log('Бэкенд прислал для раздела всего позиций:', items.length, section.title || '');
            items.forEach(function (item) {
                if (!item || !String(item.title || '').trim()) console.warn('Элемент пропущен: нет названия', item);
                if (item && (item.is_deleted || item.isDeleted)) console.warn('Элемент пропущен: удален', item);
            });
            console.log('Физически будет отрисовано позиций:', visibleItems.length, section.title || '');
        }
        var sectionMaterials = (state.materialsByProject && state.materialsByProject[project.id] || []).filter(function (item) {
            var kind = String(item && (item.itemKind || item.item_kind || 'material')).toLowerCase();
            return kind !== 'work' && canonicalEstimateSectionId(item && (item.sectionTitle || item.section_title || item.stageTitle || item.sectionId)) === canonicalEstimateSectionId(section.sectionId || sectionTitle);
        });
        var workProgress = workProgressForRows(project.id, sectionTitle, visibleItems);
        var materialProgressValue = materialProgress(project.id, sectionMaterials);
        var totalProgressItems = workProgress.total + materialProgressValue.total;
        var doneProgressItems = workProgress.done + materialProgressValue.done;
        var progress = {
            total: totalProgressItems,
            done: doneProgressItems,
            percent: totalProgressItems ? Math.round((doneProgressItems / totalProgressItems) * 100) : 0
        };
        var isOpen = isScheduleSectionOpen(project.id, section, false);
        var digest = finalSectionWorkDigest(section);
        var workDetails = visibleItems.map(function (item) {
            var workDone = isScheduleWorkDone(project.id, sectionTitle, item);
            return '<label class="section-work-check' + (workDone ? ' is-done' : '') + '" data-item-id="' + escapeHtml(item.id || '') + '">' +
                '<input type="checkbox" data-section-work-check data-item-id="' + escapeHtml(item.id || '') + '" data-project-id="' + escapeHtml(project.id) + '" data-section-title="' + escapeHtml(sectionTitle) + '" data-work-id="' + escapeHtml(item.id || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (workDone ? ' checked' : '') + '>' +
                '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '\u0420\u0430\u0431\u043e\u0442\u0430') + '</b><small>' + escapeHtml(formatWorkLine(item) || '\u041e\u0431\u044a\u0435\u043c \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d') + '</small></span>' +
            '</label>';
        }).join('') || '<div class="section-schedule-empty inline">\u0412 \u044d\u0442\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0440\u0430\u0431\u043e\u0442.</div>';
        var materialDetails = sectionMaterials.map(function (item) {
            return renderMaterialManualCheck(item, sectionTitle || item.sectionTitle || item.stageTitle || '', project.id);
        }).join('') || '<div class="section-schedule-empty inline">\u0412 \u044d\u0442\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432.</div>';
        var details = '<div class="section-schedule-detail-grid">' +
            '<section class="section-schedule-detail-column"><div class="section-schedule-detail-title"><strong>\u0420\u0430\u0431\u043e\u0442\u044b</strong><span>' + escapeHtml(String(workProgress.done) + ' / ' + String(workProgress.total)) + '</span></div><div class="section-schedule-detail-list">' + workDetails + '</div></section>' +
            '<section class="section-schedule-detail-column"><div class="section-schedule-detail-title"><strong>\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b</strong><span>' + escapeHtml(String(materialProgressValue.done) + ' / ' + String(materialProgressValue.total)) + '</span></div><div class="section-schedule-detail-list">' + materialDetails + '</div></section>' +
        '</div>';
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + (progress.percent >= 100 && progress.total ? ' is-done' : '') + (isOpen ? ' is-open' : '') + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-summary" role="button" tabindex="0" data-section-schedule-toggle data-project-id="' + escapeHtml(project.id) + '" data-section-key="' + escapeHtml(scheduleSectionKey(section)) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
                    '<div class="section-schedule-summary-head">' +
                        '<div class="section-schedule-summary-copy">' +
                            '<div class="section-schedule-heading">' + renderBulkSectionCheckbox(project.id, sectionTitle, 'schedule', workProgress) + '<div class="section-schedule-title"><h4>' + escapeHtml(sectionTitle) + '</h4></div></div>' +
                        '</div>' +
                        '<span class="section-schedule-chevron" aria-hidden="true">' + (isOpen ? '-' : '+') + '</span>' +
                    '</div>' +
                    sectionProgressStrip(workProgress, materialProgressValue, sectionTitle) +
                    (digest.titles ? '<div class="section-schedule-caption">' + escapeHtml(digest.titles) + '</div>' : '') +
                '</div>' +
                renderScheduleSectionDetailsShell(isOpen, details) +
            '</div>' +
        '</article>';
    }

    function renderSectionScheduleForecast(project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) {
            return '<section class="card section-schedule-board"><div class="section-schedule-empty">\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u043c \u0440\u0430\u0441\u0447\u0435\u0442 \u043f\u043e \u0441\u043c\u0435\u0442\u0435...</div></section>';
        }
        if (summary.error) {
            return '<section class="card section-schedule-board"><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        }
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) {
            return '<section class="card section-schedule-board"></section>';
        }
        var deadline = String(project.deadline_at || project.deadline || summary.finishDate || '').trim();
        var scheduleEndDate = deadline || summary.finishDate;
        var daysLeft = scheduleEndDate ? daysBetween(APP_TODAY, scheduleEndDate) : null;
        var overallProgress = projectScheduleProgress(project, summary);
        var projectDeadlineState = scheduleDeadlineState(summary.startDate, scheduleEndDate, overallProgress.percent, summary.totalDays);
        return '<section class="card section-schedule-board">' +
            '<div class="execution-summary">' + stat('\u0421\u0442\u0430\u0440\u0442', finalGraphDate(summary.startDate)) + stat('\u0414\u0435\u0434\u043b\u0430\u0439\u043d', finalGraphDate(scheduleEndDate)) + stat('\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c \u0434\u043d\u0435\u0439', daysLeft == null ? '-' : String(daysLeft), projectDeadlineState.kind) + stat('\u0420\u0430\u0437\u0434\u0435\u043b\u043e\u0432', String(sections.length)) + '</div>' +
            renderPinnedScheduleBrief(project, summary, sections) +
            '<div class="section-schedule-list">' + sections.map(function (section) { return renderSectionScheduleRow(project, section); }).join('') + '</div></section>';
    }

    function bindSectionScheduleRefresh(projectId) {
        qsa('[data-section-schedule-refresh]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || state.selectedProject;
                var startInput = qs('[data-auto-schedule-form] input[name="start_date"]');
                var requestedStart = startInput && startInput.value ? startInput.value : ((project && project.started_at) || APP_TODAY);
                button.disabled = true;
                loadSectionScheduleForecast(projectId, requestedStart, function () {
                    button.disabled = false;
                    if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
                    var stages = state.stagesByProject[projectId] || [];
                    var panel = qs('[data-panel="schedule"]');
                    if (panel) safeReplaceChildren(panel, renderSchedulePanel(stages, state.selectedProject));
                    bindAutoScheduleForm(projectId);
                    bindScheduleStatusActions(projectId);
                    bindSectionScheduleRefresh(projectId);
                    bindSectionScheduleInteractions(projectId);
                    bindActualQuantityInputs(projectId);
                    loadSelectedProjectMaterialSchedule(true);
                }, true);
            });
        });
        bindSectionScheduleInteractions(projectId);
        bindActualQuantityInputs(projectId);
    }

    function renderSchedulePanel(stages, project) {
        stages = Array.isArray(stages) ? stages : [];
        var drawer = renderAutoScheduleDrawer(project);
        var topBar = project ? '<section class="schedule-project-topbar">' +
            '<div class="schedule-project-topbar-copy"><h3>' + escapeHtml(project.title || 'Объект') + '</h3><span class="muted">' + escapeHtml(project.address || project.client_name || 'Адрес не указан') + '</span></div>' +
            (canManageSchedule() ? '<button class="primary schedule-autoplan-button" type="button" data-auto-schedule-open data-project-id="' + escapeHtml(project.id) + '">⚙️ Автоплан графика</button>' : '') +
        '</section>' : '';
        var forecast = renderSectionScheduleForecast(project);
        var materialCalendar = project && !hasRole('customer') ? renderMaterialScheduleContainer(project.id) : '';
        return drawer + topBar + materialCalendar + forecast;
    }

    function buildScheduleStageSummary(stage, today) {
        var parts = [
            (stage.planned_start || '\u2014') + ' \u2014 ' + (stage.planned_end || '\u2014'),
            statusLabel(stage.status_code)
        ];
        if (stage.fact_start || stage.fact_end) {
            parts.push('\u0444\u0430\u043a\u0442: ' + (stage.fact_start || '\u2014') + ' \u2014 ' + (stage.fact_end || '\u2014'));
        }
        if (stage.responsible) {
            parts.push(stage.responsible);
        }
        if (isStageBehindPlan(stage, today)) {
            parts.push('\u043e\u0442\u0441\u0442\u0430\u0432\u0430\u043d\u0438\u0435 \u043e\u0442 \u0442\u0435\u043c\u043f\u0430');
        } else if (isStageOverdue(stage, today)) {
            parts.push('\u0441\u0440\u043e\u043a \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d');
        }
        return parts.join(' \u2022 ');
    }


    function scheduleTimelineClass(stage, today) {
        if (stage.status_code === 'blocked') return 'timeline-risk';
        if (isStageOverdue(stage, today)) return 'timeline-overdue';
        if (isStageBehindPlan(stage, today)) return 'timeline-warn';
        if (percent(stage.progress) >= 100 || stage.status_code === 'approved' || stage.status_code === 'completed') return 'timeline-done';
        return '';
    }

    function renderScheduleStageBadges(stage, today, customerMode) {
        var badges = [];
        if (stage.status_code === 'blocked') {
            badges.push('<span class="badge danger">\u0411\u043b\u043e\u043a\u0435\u0440</span>');
        } else if (isStageOverdue(stage, today)) {
            badges.push('<span class="badge danger">\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d</span>');
        } else if (isStageBehindPlan(stage, today)) {
            badges.push('<span class="badge warn">\u041e\u0442\u0441\u0442\u0430\u0435\u0442</span>');
        } else if (percent(stage.progress) >= 100 || stage.status_code === 'approved' || stage.status_code === 'completed') {
            badges.push('<span class="badge success">\u0417\u0430\u043a\u0440\u044b\u0442</span>');
        } else {
            badges.push('<span class="badge">' + escapeHtml(statusLabel(stage.status_code)) + '</span>');
        }
        if (!customerMode && stage.depends_on_materials) {
            badges.push('<span class="badge warn">\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b</span>');
        }
        return badges.join('');
    }


    function closeAutoScheduleDrawer() {
        document.body.classList.remove('drawer-open');
        qsa('[data-auto-schedule-drawer], [data-auto-schedule-overlay]').forEach(function (node) {
            node.setAttribute('aria-hidden', 'true');
        });
    }

    function openAutoScheduleDrawer(projectId) {
        var drawer = qs('[data-auto-schedule-drawer]');
        if (!drawer) return;
        var form = qs('[data-auto-schedule-form]', drawer);
        if (form) form.dataset.projectId = projectId || form.dataset.projectId || '';
        document.body.classList.add('drawer-open');
        drawer.setAttribute('aria-hidden', 'false');
        var overlay = qs('[data-auto-schedule-overlay]');
        if (overlay) overlay.setAttribute('aria-hidden', 'false');
        var input = qs('input[name="start_date"]', drawer);
        if (input && !input.value) input.value = '2026-08-09';
        if (input && typeof input.focus === 'function') setTimeout(function () { input.focus(); }, 80);
    }

    function bindAutoScheduleForm(projectId) {
        if (document.body.dataset.autoScheduleDrawerDelegated !== '1') {
            document.body.dataset.autoScheduleDrawerDelegated = '1';
            document.addEventListener('click', function (event) {
                var open = event.target && event.target.closest ? event.target.closest('[data-auto-schedule-open]') : null;
                if (open) {
                    event.preventDefault();
                    openAutoScheduleDrawer(open.getAttribute('data-project-id') || projectId);
                    return;
                }
                var close = event.target && event.target.closest ? event.target.closest('[data-auto-schedule-close]') : null;
                if (close) {
                    event.preventDefault();
                    closeAutoScheduleDrawer();
                    return;
                }
                var overlay = event.target && event.target.closest ? event.target.closest('[data-auto-schedule-overlay]') : null;
                if (overlay) {
                    event.preventDefault();
                    closeAutoScheduleDrawer();
                }
            });
        }
        var form = qs('[data-auto-schedule-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-auto-schedule-error]');
            if (error) error.classList.remove('active');
            withSubmitLock(form, function () {
                closeAutoScheduleDrawer();
                return api('/api/projects/' + projectId + '/auto-schedule', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: form.start_date.value
                })
            }).then(function (data) {
                updateProjectInState(data.project);
                state.schedulePlanByProject[projectId] = data.summary || null;
                setScheduleBriefPinned(projectId, true);
                state.stagesByProject[projectId] = null;
                state.materialsByProject[projectId] = null;
                if (state.materialScheduleByProject) delete state.materialScheduleByProject[String(projectId)];
                return api('/api/projects/' + projectId + '/material-schedule', {
                    method: 'POST',
                    body: JSON.stringify({
                        start_date: form.start_date.value,
                        schedule: data.materialSchedule || null
                    })
                }).then(function (schedule) {
                    setMaterialScheduleForProject(projectId, schedule || { items: [] });
                    openProject(projectId);
                    activateProjectTab('schedule');
                    loadMaterialSchedule(projectId, function (freshSchedule) {
                        var details = scheduleProjectDetails(projectId);
                        if (details) {
                            details.materialSchedule = freshSchedule;
                            setScheduleProjectDetails(projectId, details);
                        }
                        replaceSelectedProjectMaterialCalendar(projectId);
                    }, true);
                });
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось построить график';
                    error.classList.add('active');
                }
            });
            });
        });
    }

    function loadExecutionInsights(projectId, stages) {
        var root = qs('[data-execution-insights]');
        if (!root || hasRole('customer')) return;
        Promise.all([
            api('/api/projects/' + projectId + '/tasks').catch(function () { return { tasks: [] }; }),
            api('/api/projects/' + projectId + '/daily-logs').catch(function () { return { logs: [] }; })
        ]).then(function (results) {
            var tasks = Array.isArray(results[0].tasks) ? results[0].tasks : [];
            var logs = Array.isArray(results[1].logs) ? results[1].logs : [];
            var today = APP_TODAY;
            var overdue = stages.filter(function (stage) { return isStageOverdue(stage, today); });
            var behind = stages.filter(function (stage) { return isStageBehindPlan(stage, today); });
            var latestLog = logs.length ? logs[0] : null;
            var hotTasks = tasks.filter(function (task) {
                return task.status !== 'done' && (task.priority === 'high' || (task.due_at && task.due_at <= today));
            }).length;
            root.innerHTML =
                '<div class="execution-insight-card">' +
                    '<b>План против факта</b>' +
                    '<small>' + escapeHtml(
                        overdue.length
                            ? 'Есть просроченные этапы: ' + overdue.length + '.'
                            : behind.length
                                ? 'Есть этапы с отставанием от планового темпа: ' + behind.length + '.'
                                : 'Критичных отклонений от плана сейчас не видно.'
                    ) + '</small>' +
                '</div>' +
                '<div class="execution-insight-card">' +
                    '<b>Задачи</b>' +
                    '<small>' + escapeHtml(
                        hotTasks
                            ? 'Срочных или горящих задач: ' + hotTasks + '.'
                            : 'Срочных задач по объекту сейчас нет.'
                    ) + '</small>' +
                '</div>' +
                '<div class="execution-insight-card">' +
                    '<b>Журналы</b>' +
                    '<small>' + escapeHtml(
                        latestLog
                            ? 'Последний журнал: ' + (latestLog.report_date || 'без даты') + ' — ' + (latestLog.title || 'без названия')
                            : 'Журналы по объекту пока не заполнены.'
                    ) + '</small>' +
                '</div>';
        }).catch(function () {
            root.innerHTML = '<p class="muted">Не удалось собрать сводку по задачам и журналу.</p>';
        });
    }

    function loadTasks(projectId) {
        api('/api/projects/' + projectId + '/tasks').then(function (data) {
            var tasks = Array.isArray(data.tasks) ? data.tasks : [];
            qs('[data-panel="tasks"]').innerHTML = renderTasks(tasks, projectId);
            bindTaskForm(projectId);
        }).catch(function () {
            qs('[data-panel="tasks"]').innerHTML = '<p class="muted">Задачи недоступны для этой роли.</p>';
        });
    }

    function renderTasks(tasks, projectId) {
        var list = tasks.length ? tasks.map(function (task) {
            return '<div class="material-row"><div><b>' + escapeHtml(task.title) + '</b><small>' + escapeHtml(task.description || '') + ' • Срок: ' + escapeHtml(task.due_at || '—') + '</small></div><span class="badge ' + (task.priority === 'high' ? 'danger' : '') + '">' + escapeHtml(statusLabel(task.status)) + '</span></div>';
        }).join('') : '<p class="muted">Задач пока нет.</p>';
        return '<div class="materials-list">' + list + '</div>' +
            '<form class="inline-form" data-task-form data-project-id="' + projectId + '">' +
                '<input name="title" placeholder="Новая задача">' +
                '<button type="submit">Добавить</button>' +
            '</form>';
    }

    function bindTaskForm(projectId) {
        var form = qs('[data-task-form]');
        if (!form) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!form.title.value.trim()) return;
            api('/api/projects/' + projectId + '/tasks', {
                method: 'POST',
                body: JSON.stringify({ title: form.title.value.trim(), priority: 'normal' })
            }).then(function () {
                loadTasks(projectId);
            });
        });
    }

    function loadProjectNotifications(projectId, callback) {
        api('/api/projects/' + projectId + '/notifications').then(function (data) {
            callback(data || null);
        }).catch(function () {
            callback(null);
        });
    }

    function loadTasks(projectId, loadingToken) {
        api('/api/projects/' + projectId + '/tasks').then(function (data) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            var tasks = Array.isArray(data.tasks) ? data.tasks : [];
            loadProjectNotifications(projectId, function (notifications) {
                loadUserDirectory(function (users) {
                    if (!isCurrentProject(projectId, loadingToken)) return;
                    safeReplaceChildren(qs('[data-panel="tasks"]'), renderTasks(tasks, projectId, users, notifications));
                    bindTaskForm(projectId);
                    bindTaskEditors(projectId);
                    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                });
            });
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return;
            safeReplaceChildren(qs('[data-panel="tasks"]'), '<p class="muted">Задачи недоступны для этой роли.</p>');
        });
    }

    function renderTasks(tasks, projectId, users, notifications) {
        var today = APP_TODAY;
        var overdue = tasks.filter(function (task) {
            return task.status !== 'done' && task.due_at && task.due_at < today;
        }).length;
        var inProgress = tasks.filter(function (task) { return task.status === 'in_progress'; }).length;
        var open = tasks.filter(function (task) { return task.status === 'open'; }).length;
        var review = tasks.filter(function (task) { return task.status === 'review'; }).length;
        var done = tasks.filter(function (task) { return task.status === 'done'; }).length;
        var summary = '<div class="execution-summary">' +
            stat('Задач всего', String(tasks.length)) +
            stat('Бэклог', String(open), open ? 'warn' : '') +
            stat('В работе', String(inProgress), inProgress ? 'warn' : '') +
            stat('Проверка', String(review), review ? 'warn' : '') +
            stat('Готово', String(done), done ? 'success' : '') +
            stat('Просрочены', String(overdue), overdue ? 'danger' : '') +
        '</div>';
        var alerts = renderTaskAlerts(notifications);
        var board = renderTaskBoard(tasks, users || []);
        var createAction = hasRole('customer') ? '' : '<div class="tasks-top-actions"><button class="primary compact task-create-toggle" type="button" data-task-create-toggle><i data-lucide="plus-circle"></i><span>Добавить</span></button></div>';
        var createModal = hasRole('customer') ? '' : renderTaskCreateModal(projectId, users || []);
        return '<section class="tasks-ui">' + createAction + createModal + summary + alerts + board + '</section>';
    }

    function renderTaskAlerts(notifications) {
        if (!notifications) return '';
        var cards = [];
        if (notifications.missingDailyReport) {
            cards.push('<article class="notice-card notice-warn"><b>Нет отчета за 26.07.2026</b><small>По объекту еще не сохранен дневной отчет за сегодня.</small></article>');
        }
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            cards.push('<article class="notice-card notice-danger"><b>Просроченные задачи: ' + notifications.overdueTasks.length + '</b><small>Нужно обновить статусы или сдвинуть срок.</small></article>');
        }
        if (notifications.problemStages && notifications.problemStages.length) {
            cards.push('<article class="notice-card"><b>Проблемные этапы: ' + notifications.problemStages.length + '</b><small>Есть блокировки или отставание по сроку.</small></article>');
        }
        return cards.length ? '<section class="notice-grid">' + cards.join('') + '</section>' : '';
    }

    function taskColumnStatus(status) {
        if (status === 'in_progress' || status === 'review' || status === 'done') return status;
        return 'open';
    }

    function renderTaskBoard(tasks, users) {
        var columns = [
            { status: 'open', title: 'Бэклог' },
            { status: 'in_progress', title: 'В работе' },
            { status: 'review', title: 'Проверка' },
            { status: 'done', title: 'Готово' }
        ];
        return '<section class="tasks-board" aria-label="Доска задач">' + columns.map(function (column) {
            var items = tasks.filter(function (task) {
                return taskColumnStatus(task.status) === column.status;
            });
            return renderTaskColumn(column, items, users);
        }).join('') + '</section>';
    }

    function renderTaskColumn(column, tasks, users) {
        var cards = tasks.length
            ? tasks.map(function (task) { return renderTaskRow(task, users); }).join('')
            : '<div class="tasks-empty">Задач нет</div>';
        return '<section class="tasks-column tasks-column-' + column.status + '">' +
            '<div class="tasks-column-head">' +
                '<h3>' + escapeHtml(column.title) + '</h3>' +
                '<span>' + tasks.length + '</span>' +
            '</div>' +
            '<div class="tasks-column-list">' + cards + '</div>' +
        '</section>';
    }

    function taskPriorityClass(priority) {
        if (priority === 'high') return 'high';
        if (priority === 'low') return 'low';
        return 'normal';
    }

    function taskAssigneeName(task, users) {
        if (task.assignee_name) return task.assignee_name;
        var match = (users || []).filter(function (user) {
            return Number(user.id) === Number(task.assignee_id);
        })[0];
        return match ? match.name : 'Без ответственного';
    }

    function taskInitials(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length || name === 'Без ответственного') return '—';
        return parts.slice(0, 2).map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('');
    }

    function renderTaskRow(task, users) {
        var userOptions = '<option value="">Без ответственного</option>' + users.map(function (user) {
            return '<option value="' + user.id + '"' + (Number(task.assignee_id) === Number(user.id) ? ' selected' : '') + '>' + escapeHtml(user.name) + '</option>';
        }).join('');
        var priority = task.priority || 'normal';
        var isOverdue = task.status !== 'done' && task.due_at && task.due_at < APP_TODAY;
        var assigneeName = taskAssigneeName(task, users);
        return '<form class="task-card ui-card' + (isOverdue ? ' task-card-overdue' : '') + '" data-task-edit-form data-task-id="' + task.id + '">' +
            '<div class="task-card-top">' +
                '<span class="task-tag">' + escapeHtml(statusLabel(taskColumnStatus(task.status))) + '</span>' +
                '<span class="task-priority task-priority-' + taskPriorityClass(priority) + '">' + escapeHtml(priorityLabel(priority)) + '</span>' +
            '</div>' +
            '<div class="task-card-body">' +
                '<h4>' + escapeHtml(task.title || 'Без названия') + '</h4>' +
                '<p>' + escapeHtml(task.description || 'Без описания') + '</p>' +
            '</div>' +
            '<div class="task-card-footer">' +
                '<div class="task-assignee">' +
                    '<span class="task-avatar">' + escapeHtml(taskInitials(assigneeName)) + '</span>' +
                    '<span>' + escapeHtml(assigneeName) + '</span>' +
                '</div>' +
                '<div class="task-deadline' + (isOverdue ? ' task-deadline-overdue' : '') + '">' +
                    '<span class="task-deadline-icon" aria-hidden="true"></span>' +
                    '<span>' + escapeHtml(task.due_at ? formatDisplayDate(task.due_at) : 'Без срока') + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="task-card-controls">' +
                '<select name="status" aria-label="Статус"><option value="open"' + (taskColumnStatus(task.status) === 'open' ? ' selected' : '') + '>Бэклог</option><option value="in_progress"' + (task.status === 'in_progress' ? ' selected' : '') + '>В работе</option><option value="review"' + (task.status === 'review' ? ' selected' : '') + '>Проверка</option><option value="done"' + (task.status === 'done' ? ' selected' : '') + '>Готово</option></select>' +
                '<select name="priority" aria-label="Приоритет"><option value="low"' + (priority === 'low' ? ' selected' : '') + '>Низкий</option><option value="normal"' + (priority === 'normal' ? ' selected' : '') + '>Средний</option><option value="high"' + (priority === 'high' ? ' selected' : '') + '>Высокий</option></select>' +
                '<input name="due_at" aria-label="Дедлайн" type="date" value="' + escapeHtml(task.due_at || '') + '">' +
                '<select name="assignee_id" aria-label="Исполнитель">' + userOptions + '</select>' +
                '<button class="ghost task-save" type="submit">Сохранить</button>' +
            '</div>' +
        '</form>';
    }

    function renderTaskCreateForm(projectId, users) {
        var userOptions = '<option value="">Без ответственного</option>' + users.map(function (user) {
            return '<option value="' + user.id + '">' + escapeHtml(user.name) + '</option>';
        }).join('');
        return '<form class="task-create-form ui-card" data-task-form data-project-id="' + projectId + '">' +
            '<div class="task-create-head"><div><h3>Новая задача</h3><span>Название, срок, приоритет и исполнитель.</span></div></div>' +
            '<div class="task-create-grid">' +
                '<label class="wide"><span>Название</span><input name="title" placeholder="Название задачи" required></label>' +
                '<label class="wide"><span>Описание</span><input name="description" placeholder="Короткое описание"></label>' +
                '<label><span>Статус</span><select name="status" aria-label="Статус"><option value="open">Бэклог</option><option value="in_progress">В работе</option><option value="review">Проверка</option><option value="done">Готово</option></select></label>' +
                '<label><span>Приоритет</span><select name="priority" aria-label="Приоритет"><option value="normal">Средний</option><option value="high">Высокий</option><option value="low">Низкий</option></select></label>' +
                '<label><span>Дедлайн</span><input name="due_at" aria-label="Дедлайн" type="date"></label>' +
                '<label><span>Исполнитель</span><select name="assignee_id" aria-label="Исполнитель">' + userOptions + '</select></label>' +
                '<button class="primary" type="submit">Добавить</button>' +
            '</div>' +
        '</form>';
    }

    function renderTaskCreateModal(projectId, users) {
        return '<div class="task-create-modal" data-task-create-modal hidden>' +
            '<div class="task-create-backdrop" data-task-create-close></div>' +
            '<div class="task-create-dialog" role="dialog" aria-modal="true">' +
                '<button class="task-create-close" type="button" data-task-create-close aria-label="Закрыть"><i data-lucide="x"></i></button>' +
                renderTaskCreateForm(projectId, users) +
            '</div>' +
        '</div>';
    }

    function cleanupTaskCreateModals() {
        qsa('body > [data-task-create-modal]').forEach(function (modal) {
            modal.remove();
        });
        document.body.classList.remove('task-modal-lock');
    }

    function closeTaskCreateModal(modal) {
        modal = modal || qs('[data-task-create-modal]');
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.classList.remove('task-modal-lock');
        setTimeout(function () {
            if (!modal.classList.contains('is-open')) modal.hidden = true;
        }, 180);
    }

    function openTaskCreateModal() {
        var modal = qs('[data-task-create-modal]');
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add('task-modal-lock');
        requestAnimationFrame(function () {
            modal.classList.add('is-open');
            var firstInput = qs('input, select, textarea, button[type="submit"]', modal);
            if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
        });
    }

    function bindTaskForm(projectId) {
        cleanupTaskCreateModals();
        var panel = qs('[data-panel="tasks"]') || document;
        var modal = qs('[data-task-create-modal]', panel) || qs('[data-task-create-modal]');
        if (modal && modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }
        var form = qs('[data-task-form]', modal || panel);
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        var toggle = qs('[data-task-create-toggle]');
        if (toggle && modal && toggle.dataset.bound !== '1') {
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', function () {
                openTaskCreateModal();
            });
        }
        qsa('[data-task-create-close]', modal || panel).forEach(function (node) {
            if (node.dataset.bound === '1') return;
            node.dataset.bound = '1';
            node.addEventListener('click', function () {
                closeTaskCreateModal(node.closest('[data-task-create-modal]'));
            });
        });
        if (!document.body.dataset.taskModalEscapeBound) {
            document.body.dataset.taskModalEscapeBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeTaskCreateModal();
            });
        }
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!form.title.value.trim()) return;
            api('/api/projects/' + projectId + '/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title: form.title.value.trim(),
                    description: form.description ? form.description.value.trim() : '',
                    status: form.status ? form.status.value : 'open',
                    priority: form.priority ? form.priority.value : 'normal',
                    due_at: form.due_at ? form.due_at.value : '',
                    assignee_id: form.assignee_id ? form.assignee_id.value : ''
                })
            }).then(function () {
                closeTaskCreateModal(form.closest('[data-task-create-modal]'));
                loadTasks(projectId);
            });
        });
    }

    function bindTaskEditors(projectId) {
        qsa('[data-task-edit-form]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                api('/api/tasks/' + form.dataset.taskId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        status: form.status.value,
                        priority: form.priority.value,
                        due_at: form.due_at.value,
                        assignee_id: form.assignee_id.value
                    })
                }).then(function () {
                    loadTasks(projectId);
                    if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                        loadStages(projectId, function (stages) {
                            loadExecutionInsights(projectId, stages);
                        });
                    }
                });
            });
        });
    }

    function loadDocuments(projectId) {
        api('/api/projects/' + projectId + '/documents').then(function (data) {
            var docs = Array.isArray(data.documents) ? data.documents : [];
            var panel = qs('[data-panel="documents"]');
            if (!panel) return;
            panel.innerHTML =
                renderDocumentUpload(projectId) +
                (docs.length
                    ? '<div class="documents-list">' + docs.map(renderDocumentRow).join('') + '</div>'
                    : '<p class="muted">Документы по объекту пока не загружены.</p>');
            bindDocumentUpload(projectId);
        }).catch(function () {
            qs('[data-panel="documents"]').innerHTML = '<p class="muted">Документы недоступны.</p>';
        });
    }

    function financeDirectionLabel(direction) {
        return direction === 'income' ? 'Поступление' : 'Расход';
    }

    function financeStatusLabel(status) {
        return {
            planned: 'Запланировано',
            approved: 'Согласовано',
            paid: 'Оплачено',
            cancelled: 'Отменено'
        }[status] || status || 'Статус';
    }

    function financePaymentLabel(kind) {
        return {
            cash: 'Наличные',
            bank_no_vat: 'Безнал без НДС',
            bank_vat: 'Безнал с НДС'
        }[kind] || kind || 'Оплата';
    }

    function loadProjectFinances(projectId, loadingToken) {
        api('/api/projects/' + projectId + '/finances').then(function (data) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            renderProjectFinances(projectId, Array.isArray(data.items) ? data.items : [], data.summary || {});
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return;
            safeReplaceChildren(qs('[data-panel="finance"]'), '<p class="muted">Не удалось загрузить финансы по объекту.</p>');
        });
    }





    function renderDocumentUpload(projectId) {
        if (hasRole('customer')) return '';
        return '<form class="document-upload-form" data-document-upload-form data-project-id="' + projectId + '">' +
            '<div class="card-head"><h3>\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442</h3></div>' +
            '<input name="file" type="file" required>' +
            '<input name="title" placeholder="\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430">' +
            '<select name="doc_type">' +
                '<option value="contract">\u0414\u043e\u0433\u043e\u0432\u043e\u0440</option>' +
                '<option value="estimate">\u0421\u043c\u0435\u0442\u0430</option>' +
                '<option value="project_doc">\u041f\u0440\u043e\u0435\u043a\u0442\u043d\u0430\u044f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u0446\u0438\u044f</option>' +
                '<option value="act">\u0410\u043a\u0442</option>' +
                '<option value="executive">\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u0430\u044f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u0446\u0438\u044f</option>' +
                '<option value="invoice">\u0421\u0447\u0435\u0442</option>' +
                '<option value="photo_report">\u0424\u043e\u0442\u043e\u043e\u0442\u0447\u0435\u0442</option>' +
                '<option value="correspondence">\u041f\u0435\u0440\u0435\u043f\u0438\u0441\u043a\u0430</option>' +
                '<option value="archive">\u0410\u0440\u0445\u0438\u0432</option>' +
                '<option value="finance">\u0424\u0438\u043d\u0430\u043d\u0441\u044b</option>' +
                '<option value="other">\u0414\u0440\u0443\u0433\u043e\u0435</option>' +
            '</select>' +
            '<select name="status">' +
                '<option value="draft">\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a</option>' +
                '<option value="reviewed">\u041f\u0440\u043e\u0432\u0435\u0440\u0435\u043d</option>' +
                '<option value="approved">\u0423\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d</option>' +
                '<option value="signed">\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d</option>' +
                '<option value="internal">\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439</option>' +
                '<option value="ready">\u0413\u043e\u0442\u043e\u0432</option>' +
            '</select>' +
            '<input name="notes" placeholder="\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0438\u043b\u0438 \u043f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435">' +
            '<label class="check-inline"><input type="checkbox" name="is_client_visible" value="1"> \u0412\u0438\u0434\u043d\u043e \u0437\u0430\u043a\u0430\u0437\u0447\u0438\u043a\u0443</label>' +
            '<button class="primary" type="submit">\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c</button>' +
            '<div class="form-error" data-document-upload-error></div>' +
        '</form>';
    }

    function renderDocumentRow(doc) {
        var meta = [
            docTypeLabel(doc.doc_type),
            statusLabel(doc.status),
            doc.original_name || '',
            doc.size_bytes ? formatBytes(doc.size_bytes) : '',
            doc.uploaded_by_name || '',
            doc.is_client_visible ? 'Видно заказчику' : 'Внутренний'
        ].filter(Boolean).join(' • ');
        var actions = doc.storage_path
            ? ((doc.can_preview ? '<a class="ghost" href="' + escapeHtml(doc.view_url) + '" target="_blank" rel="noreferrer">Открыть</a>' : '') +
               '<a class="ghost" href="' + escapeHtml(doc.download_url) + '" target="_blank" rel="noreferrer">Скачать</a>')
            : '<span class="muted">Файл не загружен</span>';
        return '<div class="document-row">' +
            '<div><b>' + escapeHtml(doc.title) + '</b><small>' + escapeHtml(meta) + (doc.notes ? '<br>' + escapeHtml(doc.notes) : '') + '</small></div>' +
            '<div class="document-actions">' + actions + '</div>' +
        '</div>';
    }

    function bindDocumentUpload(projectId) {
        var form = qs('[data-document-upload-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-document-upload-error]');
            if (error) error.classList.remove('active');
            if (!form.file.files || !form.file.files[0]) {
                if (error) {
                    error.textContent = 'Нужно выбрать файл';
                    error.classList.add('active');
                }
                return;
            }
            var data = new FormData();
            data.append('file', form.file.files[0]);
            data.append('title', form.title.value.trim());
            data.append('doc_type', form.doc_type.value);
            data.append('status', form.status.value);
            data.append('notes', form.notes.value.trim());
            if (form.is_client_visible.checked) data.append('is_client_visible', '1');
            apiFormData('/api/projects/' + projectId + '/documents', data).then(function () {
                form.reset();
                loadDocuments(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось загрузить документ';
                    error.classList.add('active');
                }
            });
        });
    }

    function formatBytes(value) {
        var size = Number(value) || 0;
        if (size < 1024) return size + ' Б';
        if (size < 1024 * 1024) return Math.round(size / 1024) + ' КБ';
        return (size / (1024 * 1024)).toFixed(1).replace('.0', '') + ' МБ';
    }

    function loadProjectChats(projectId, loadingToken) {
        api('/api/projects/' + projectId + '/chats').then(function (data) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            var chats = Array.isArray(data.chats) ? data.chats : [];
            if (!chats.length) {
                safeReplaceChildren(qs('[data-panel="chat"]'), '<p class="muted">Чаты пока не созаны.</p>');
                return;
            }
            renderChat(chats[0], projectId, loadingToken);
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return;
            safeReplaceChildren(qs('[data-panel="chat"]'), '<p class="muted">Чаты недоступны для этой роли.</p>');
        });
    }

    function renderChat(chat, projectId, loadingToken) {
        api('/api/chats/' + chat.id + '/messages').then(function (data) {
            if (projectId && !isCurrentProject(projectId, loadingToken)) return;
            var messages = Array.isArray(data.messages) ? data.messages : [];
            safeReplaceChildren(qs('[data-panel="chat"]'),
                '<div class="chat-window compact-chat">' +
                    messages.map(function (message) {
                        return '<div class="message"><b>' + escapeHtml(message.author_name) + '</b><p>' + escapeHtml(message.body) + '</p></div>';
                    }).join('') +
                    '<form class="chat-compose" data-chat-form data-chat-id="' + chat.id + '"><input name="body" placeholder="Сообщение"><button type="submit">Отправить</button></form>' +
                '</div>');
            bindChatForm(chat.id);
        });
    }

    function bindChatForm(chatId) {
        var form = qs('[data-chat-form]');
        if (!form) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!form.body.value.trim()) return;
            api('/api/chats/' + chatId + '/messages', {
                method: 'POST',
                body: JSON.stringify({ body: form.body.value.trim() })
            }).then(function () {
                renderChat({ id: chatId });
            });
        });
    }

    function renderSchedule(project) {
        var p = percent(project.progress);
        var rows = [
            ['Подготовка', 'Старт объекта', Math.min(100, p + 30)],
            ['Закупка материалов', 'Позиции по смете', Math.min(100, p + 10)],
            ['Основные работы', 'Факт выполнения', p],
            ['Сдача объекта', 'Акты и закрытие', Math.max(0, p - 70)]
        ];
        return '<div class="timeline">' + rows.map(function (row) {
            return '<div class="timeline-row"><b>' + row[0] + '</b><span>' + row[1] + '</span><i style="width:' + row[2] + '%"></i><strong>' + row[2] + '%</strong></div>';
        }).join('') + '</div>';
    }

    function renderAi(project, materials) {
        var critical = materials.filter(function (item) { return Number(item.missingQty) > 0; });
        var text = critical.length
            ? 'Риски по складу: ' + critical.map(function (item) { return item.title + ' — ' + item.missingQty + ' ' + item.unit; }).join(', ') + '. Это нужно закрыть до выхода этапов в работу.'
            : 'Критичных складских рисков сейчас не видно. Можно держать темп и вовремя фиксировать факт.';
        return '<div class="card"><h3>AI-сводка</h3><p class="muted">' + escapeHtml(text) + '</p></div>';
    }

    function loadAnalysis(projectId, callback) {

        api('/api/projects/' + projectId + '/analysis').then(callback).catch(function () {
            callback(null);
        });
    }

    function renderBackendAnalysis(analysis) {
        if (!analysis) return '<p class="muted">AI-аналитика пока недоступна.</p>';
        return '<div class="analysis-strip">' +
                '<div class="analysis-pill"><span>Объект</span><strong>' + escapeHtml(analysis.projectProgress) + '%</strong></div>' +
                '<div class="analysis-pill"><span>Этапы</span><strong>' + escapeHtml(analysis.stageProgress) + '%</strong></div>' +
                '<div class="analysis-pill"><span>Материалы</span><strong>' + escapeHtml(analysis.materialPurchaseProgress) + '%</strong></div>' +
                '<div class="analysis-pill"><span>Риски</span><strong>' + escapeHtml(analysis.shortagesCount) + '</strong></div>' +
            '</div>' +
            '<div class="materials-list">' +
                (analysis.risks || []).map(function (risk) {
                    return '<div class="material-row"><div><b>' + escapeHtml(risk.title) + '</b><small>' + escapeHtml(risk.text) + '</small></div><span class="badge ' + (risk.level === 'critical' ? 'danger' : 'warn') + '">' + escapeHtml(risk.level) + '</span></div>';
                }).join('') +
            '</div>' +
            '<div class="card"><h3>Что сделать</h3><ul>' + (analysis.actions || []).map(function (action) {
                return '<li>' + escapeHtml(action) + '</li>';
            }).join('') + '</ul></div>';
    }

    function renderWarehousePage() {

        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        if (!state.projects.length) {
            root.innerHTML = '<p class="muted">Нет объектов для анализа склада.</p>';
            return;
        }
        root.innerHTML = '';
        fillProjectSelects();
        loadAllWarehouseMaterials(function (items) {
            state.warehouseItems = items;
            renderWarehouseAnalysis(items);
            renderWarehouseLedger(items);
            bindWarehouseSearch(items);
            bindMaterialCreateForm();
            renderStockMoveForm(items);
            bindEstimateImport();
        });
    }

    function fillProjectSelects() {
        qsa('[data-stock-projects], [data-estimate-projects], [data-material-projects]').forEach(function (select) {
            select.innerHTML = state.projects.map(function (project) {
                return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
            }).join('');
        });
    }

    function loadAllWarehouseMaterials(callback) {
        Promise.all(state.projects.map(function (project) {
            return new Promise(function (resolve) {
                loadMaterials(project.id, function (items) {
                    resolve(items.map(function (item) {
                        return Object.assign({}, item, {
                            projectId: project.id,
                            projectTitle: project.title,
                            projectAddress: project.address,
                            clientName: project.client_name
                        });
                    }));
                });
            });
        })).then(function (groups) {
            callback([].concat.apply([], groups));
        });
    }

    function renderWarehouseAnalysis(items) {
        var node = qs('[data-warehouse-analysis]');
        if (!node) return;
        var total = items.length;
        var missing = items.filter(function (item) { return Number(item.missingQty) > 0; }).length;
        var inStock = items.filter(function (item) { return Number(item.stockQty) > 0; }).length;
        var planned = items.reduce(function (sum, item) { return sum + Number(item.plannedQty || 0); }, 0);
        var coveredQty = items.reduce(function (sum, item) {
            return sum + Math.max(Number(item.purchasedQty || 0), Number(item.receivedQty || 0));
        }, 0);
        var covered = planned ? Math.round(Math.min(100, coveredQty / planned * 100)) : 0;
        node.innerHTML =
            '<div class="analysis-pill"><span>Позиций в складе</span><strong>' + escapeHtml(total) + '</strong></div>' +
            '<div class="analysis-pill"><span>Есть остаток</span><strong>' + escapeHtml(inStock) + '</strong></div>' +
            '<div class="analysis-pill"><span>Нехватки</span><strong>' + escapeHtml(missing) + '</strong></div>' +
            '<div class="analysis-pill"><span>Закрыто по смете</span><strong>' + escapeHtml(covered) + '%</strong></div>';
    }

    function renderWarehouseLedger(items) {
        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        if (!items.length) {
            root.innerHTML = '<p class="muted">Материалы пока не загружены. Импортируй смету от бота — здесь появится общий склад по всем объектам.</p>';
            return;
        }
        root.innerHTML =
            '<div class="warehouse-table-wrap"><table class="warehouse-table">' +
                '<thead><tr>' +
                    '<th>Объект</th><th>Материал</th><th>Е.</th><th>Смета</th><th>Куплено</th><th>Поступило</th><th>Использовано</th><th>Остаток</th><th>Нехватка</th><th>Статус</th>' +
                '</tr></thead>' +
                '<tbody>' + items.map(warehouseLedgerRow).join('') + '</tbody>' +
            '</table></div>';
    }

    function warehouseLedgerRow(item) {
        var missing = Number(item.missingQty) || 0;
        var stock = Number(item.stockQty) || 0;
        var status = missing > 0 ? 'Докупить' : (stock > 0 ? 'В наличии' : 'Закрыто');
        var badge = missing > 0 ? 'danger' : (stock > 0 ? 'warn' : '');
        return '<tr class="' + (missing > 0 ? 'row-risk' : '') + '">' +
            '<td><b>' + escapeHtml(item.projectTitle) + '</b><small>' + escapeHtml(item.clientName || item.projectAddress || '') + '</small></td>' +
            '<td><b>' + escapeHtml(item.title) + '</b><small>готовность закупк: ' + escapeHtml(item.purchaseProgress) + '%</small></td>' +
            '<td>' + escapeHtml(item.unit) + '</td>' +
            '<td>' + escapeHtml(item.plannedQty) + '</td>' +
            '<td>' + escapeHtml(item.purchasedQty) + '</td>' +
            '<td>' + escapeHtml(item.receivedQty) + '</td>' +
            '<td>' + escapeHtml(item.usedQty) + '</td>' +
            '<td>' + escapeHtml(item.stockQty) + '</td>' +
            '<td>' + escapeHtml(missing) + '</td>' +
            '<td><span class="badge ' + badge + '">' + status + '</span></td>' +
        '</tr>';
    }

    function bindWarehouseSearch(items) {
        var search = qs('[data-warehouse-search]');
        if (!search) return;
        search.oninput = function () {
            var query = search.value.toLocaleLowerCase('ru');
            renderWarehouseLedger(items.filter(function (item) {
                return [item.projectTitle, item.projectAddress, item.clientName, item.title, item.unit]
                    .join(' ')
                    .toLocaleLowerCase('ru')
                    .indexOf(query) !== -1;
            }));
        };
    }

    function refreshWarehouse(projectId) {
        if (projectId) delete state.materialsByProject[projectId];
        loadAllWarehouseMaterials(function (items) {
            state.warehouseItems = items;
            renderWarehouseAnalysis(items);
            renderWarehouseLedger(items);
            bindWarehouseSearch(items);
            bindMaterialCreateForm();
            renderStockMoveForm(items);
        });
    }

    function bindMaterialCreateForm() {
        var form = qs('[data-material-create-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-material-create-error]');
            if (error) error.classList.remove('active');
            var projectId = Number(form.project_id.value);
            api('/api/projects/' + projectId + '/materials', {
                method: 'POST',
                body: JSON.stringify({
                    title: form.title.value.trim(),
                    unit: form.unit.value.trim(),
                    planned_qty: Number(form.planned_qty.value),
                    planned_price: Number(form.planned_price.value || 0)
                })
            }).then(function () {
                var keepProject = form.project_id.value;
                form.reset();
                form.project_id.value = keepProject;
                form.unit.value = 'шт';
                refreshWarehouse(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error === 'material_exists'
                        ? 'Такая позиция уже есть в этом объекте'
                        : (err.payload && err.payload.error ? err.payload.error : 'Не удалось добавить позицию');
                    error.classList.add('active');
                }
            });
        });
    }

    function renderStockMoveForm(items) {
        var form = qs('[data-stock-move-form]');
        var projectSelect = qs('[data-stock-projects]');
        var select = qs('[data-stock-materials]');
        if (!form || !select || !projectSelect) return;
        function updateMaterials() {
            var projectId = Number(projectSelect.value);
            var projectItems = items.filter(function (item) { return Number(item.projectId) === projectId; });
            select.innerHTML = projectItems.length
                ? projectItems.map(function (item) {
                    return '<option value="' + item.id + '">' + escapeHtml(item.title) + ' · остаток ' + escapeHtml(item.stockQty) + ' ' + escapeHtml(item.unit) + '</option>';
                }).join('')
                : '<option value="">Сначала импортируй смету по объекту</option>';
            select.disabled = !projectItems.length;
        }
        if (projectSelect.dataset.bound !== '1') {
            projectSelect.dataset.bound = '1';
            projectSelect.addEventListener('change', updateMaterials);
        }
        updateMaterials();
        if (form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-stock-move-error]');
            if (error) error.classList.remove('active');
            var projectId = Number(form.project_id.value);
            api('/api/projects/' + projectId + '/stock-moves', {
                method: 'POST',
                body: JSON.stringify({
                    estimate_item_id: Number(form.estimate_item_id.value),
                    move_type: form.move_type.value,
                    qty: Number(form.qty.value),
                    price: Number(form.price.value || 0),
                    comment: form.comment.value.trim()
                })
            }).then(function () {
                form.reset();
                refreshWarehouse(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить операцию';
                    error.classList.add('active');
                }
            });
        });
    }

    function bindEstimateImport() {
        var form = qs('[data-estimate-import-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-estimate-import-error]');
            if (error) error.classList.remove('active');
            var projectId = Number(form.project_id.value);
            var payload;
            try {
                payload = JSON.parse(form.json.value);
            } catch (parseError) {
                if (error) {
                    error.textContent = 'JSON не читается. Проверь кавычки и запятые.';
                    error.classList.add('active');
                }
                return;
            }
            api('/api/projects/' + projectId + '/estimate-import', {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(function (data) {
                state.materialsByProject[projectId] = data.items || [];
                refreshWarehouse(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось импортировать смету';
                    error.classList.add('active');
                }
            });
        });
    }

    function loadAllWarehouseStages(callback) {
        Promise.all(state.projects.map(function (project) {
            return api('/api/projects/' + project.id + '/stages').then(function (data) {
                return {
                    projectId: project.id,
                    stages: Array.isArray(data.stages) ? data.stages : []
                };
            }).catch(function () {
                return { projectId: project.id, stages: [] };
            });
        })).then(function (groups) {
            var map = {};
            groups.forEach(function (group) {
                map[group.projectId] = group.stages;
            });
            callback(map);
        });
    }

    function renderWarehouseForecast(items) {
        var root = qs('[data-warehouse-forecast]');
        if (!root) return;
        var required = items.filter(function (item) { return item.supplyStatus === 'required'; });
        var soon = items.filter(function (item) { return item.supplyStatus === 'soon'; });
        var planned = items.filter(function (item) { return item.supplyStatus === 'planned'; });
        var safe = items.filter(function (item) { return item.supplyStatus === 'in_stock'; });
        var urgentRows = required.concat(soon).sort(function (a, b) {
            return String(a.needByDate || '9999-12-31').localeCompare(String(b.needByDate || '9999-12-31'));
        }).slice(0, 8);
        root.innerHTML =
            '<section class="notice-grid">' +
                '<article class="notice-card notice-danger"><b>Требуется сейчас: ' + required.length + '</b><small>Материалы с нехваткой и датой потребности уже на 26.07.2026.</small></article>' +
                '<article class="notice-card notice-warn"><b>Скоро потребуется: ' + soon.length + '</b><small>Позиции, которые понадобятся в ближайшие дни.</small></article>' +
                '<article class="notice-card"><b>Нужно запланировать: ' + planned.length + '</b><small>Материалы без даты потребности или без привязки к этапу.</small></article>' +
                '<article class="notice-card"><b>Есть в наличии: ' + safe.length + '</b><small>Закрытые позиции без нехватки по смете.</small></article>' +
            '</section>' +
            (urgentRows.length
                ? '<div class="materials-list">' + urgentRows.map(function (item) {
                    return '<div class="material-row"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + ' · нужно к ' + escapeHtml(item.needByDate || 'без даты') + (item.stageTitle ? ' · этап: ' + escapeHtml(item.stageTitle) : '') + '</small></div><span class="badge ' + planningStatusClass(item.supplyStatus) + '">' + escapeHtml(item.supplyLabel) + '</span></div>';
                }).join('') + '</div>'
                : '');
    }

    function planningStatusClass(status) {
        return {
            required: 'danger',
            soon: 'warn',
            planned: '',
            in_stock: ''
        }[status] || '';
    }

    function renderWarehouseLedger(items) {
        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        if (!items.length) {
            root.innerHTML = '<p class="muted">Материалы пока не загружены. Импортируй смету от бота — здесь появится общий склад по всем объектам.</p>';
            return;
        }
        root.innerHTML =
            '<div class="warehouse-table-wrap"><table class="warehouse-table">' +
                '<thead><tr>' +
                    '<th>Объект</th><th>Материал</th><th>Е.</th><th>Смета</th><th>Куплено</th><th>Поступило</th><th>Использовано</th><th>Остаток</th><th>Нехватка</th><th>Нужно к</th><th>Этап</th><th>Статус</th>' +
                '</tr></thead>' +
                '<tbody>' + items.map(warehouseLedgerRow).join('') + '</tbody>' +
            '</table></div>';
    }

    function warehouseLedgerRow(item) {
        var missing = Number(item.missingQty) || 0;
        var rowRisk = item.supplyStatus === 'required' || missing > 0;
        return '<tr class="' + (rowRisk ? 'row-risk' : '') + '">' +
            '<td><b>' + escapeHtml(item.projectTitle) + '</b><small>' + escapeHtml(item.clientName || item.projectAddress || '') + '</small></td>' +
            '<td><b>' + escapeHtml(item.title) + '</b><small>готовность закупки: ' + escapeHtml(item.purchaseProgress) + '%' + (item.notes ? ' · ' + escapeHtml(item.notes) : '') + '</small></td>' +
            '<td>' + escapeHtml(item.unit) + '</td>' +
            '<td>' + escapeHtml(item.plannedQty) + '</td>' +
            '<td>' + escapeHtml(item.purchasedQty) + '</td>' +
            '<td>' + escapeHtml(item.receivedQty) + '</td>' +
            '<td>' + escapeHtml(item.usedQty) + '</td>' +
            '<td>' + escapeHtml(item.stockQty) + '</td>' +
            '<td>' + escapeHtml(missing) + '</td>' +
            '<td>' + escapeHtml(item.needByDate || '—') + '</td>' +
            '<td>' + escapeHtml(item.stageTitle || '—') + '</td>' +
            '<td><span class="badge ' + planningStatusClass(item.supplyStatus) + '">' + escapeHtml(item.supplyLabel || '—') + '</span></td>' +
        '</tr>';
    }

    function renderWarehousePage() {
        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        if (!state.projects.length) {
            root.innerHTML = '<p class="muted">Нет объектов для анализа склада.</p>';
            return;
        }
        root.innerHTML = '';
        fillProjectSelects();
        loadAllWarehouseMaterials(function (items) {
            state.warehouseItems = items;
            renderWarehouseAnalysis(items);
            renderWarehouseForecast(items);
            bindWarehouseSearch(items);
            bindWarehouseFilters(items);
            applyWarehouseFocus(items);
            renderWarehouseLedger(filterWarehouseItems(items));
            bindMaterialCreateForm();
            renderStockMoveForm(items);
            bindEstimateImport();
            loadAllWarehouseStages(function (stagesMap) {
                bindMaterialPlanForm(items, stagesMap);
            });
        });
    }

    function refreshWarehouse(projectId) {
        if (projectId) delete state.materialsByProject[projectId];
        loadAllWarehouseMaterials(function (items) {
            state.warehouseItems = items;
            renderWarehouseAnalysis(items);
            renderWarehouseForecast(items);
            bindWarehouseSearch(items);
            bindWarehouseFilters(items);
            applyWarehouseFocus(items);
            renderWarehouseLedger(filterWarehouseItems(items));
            bindMaterialCreateForm();
            renderStockMoveForm(items);
            loadAllWarehouseStages(function (stagesMap) {
                bindMaterialPlanForm(items, stagesMap);
            });
        });
    }

    function getWarehouseFocusParams() {
        var params = new URLSearchParams(location.search);
        return {
            projectId: Number(params.get('projectId') || 0),
            materialId: Number(params.get('materialId') || 0),
            status: params.get('status') || '',
            horizon: params.get('horizon') || ''
        };
    }

    function applyWarehouseFocus(items) {
        var focus = getWarehouseFocusParams();
        var search = qs('[data-warehouse-search]');
        var status = qs('[data-warehouse-status-filter]');
        var horizonRoot = qs('[data-warehouse-horizon]');
        var material = focus.materialId ? items.find(function (item) {
            return Number(item.id) === focus.materialId && (!focus.projectId || Number(item.projectId) === focus.projectId);
        }) : null;
        var project = focus.projectId ? state.projects.find(function (item) {
            return Number(item.id) === focus.projectId;
        }) : null;
        if (search && !search.value && (project || material)) {
            search.value = [project && project.title, material && material.title].filter(Boolean).join(' ');
        }
        if (status && focus.status) {
            status.value = focus.status;
        }
        if (horizonRoot && focus.horizon) {
            qsa('button[data-horizon]', horizonRoot).forEach(function (button) {
                button.classList.toggle('active', button.dataset.horizon === focus.horizon);
            });
        }
    }

    function filterWarehouseItems(items) {
        var search = qs('[data-warehouse-search]');
        var status = qs('[data-warehouse-status-filter]');
        var activeHorizon = qs('[data-warehouse-horizon] button.active');
        var focus = getWarehouseFocusParams();
        var query = search ? search.value.toLocaleLowerCase('ru') : '';
        var statusCode = status ? status.value : 'all';
        var horizon = activeHorizon ? activeHorizon.dataset.horizon : 'all';
        var horizonLimit = horizon === '7' ? '2026-08-02' : (horizon === '14' ? '2026-08-09' : '');
        return items.filter(function (item) {
            var matchesQuery = !query || [item.projectTitle, item.projectAddress, item.clientName, item.title, item.unit, item.stageTitle, item.notes]
                .join(' ')
                .toLocaleLowerCase('ru')
                .indexOf(query) !== -1;
            var matchesProject = !focus.projectId || Number(item.projectId) === focus.projectId;
            var matchesMaterial = !focus.materialId || Number(item.id) === focus.materialId;
            var matchesStatus = statusCode === 'all' || item.supplyStatus === statusCode;
            var matchesHorizon = !horizonLimit || (item.needByDate && item.needByDate <= horizonLimit) || (item.supplyStatus === 'required' && horizon !== 'all');
            return matchesQuery && matchesProject && matchesMaterial && matchesStatus && matchesHorizon;
        });
    }

    function bindWarehouseFilters(items) {
        var search = qs('[data-warehouse-search]');
        var status = qs('[data-warehouse-status-filter]');
        var horizonRoot = qs('[data-warehouse-horizon]');
        function rerender() {
            renderWarehouseLedger(filterWarehouseItems(items));
        }
        if (search && search.dataset.boundFilters !== '1') {
            search.dataset.boundFilters = '1';
            search.addEventListener('input', rerender);
        }
        if (status && status.dataset.bound !== '1') {
            status.dataset.bound = '1';
            status.addEventListener('change', rerender);
        }
        if (horizonRoot && horizonRoot.dataset.bound !== '1') {
            horizonRoot.dataset.bound = '1';
            qsa('button[data-horizon]', horizonRoot).forEach(function (button) {
                button.addEventListener('click', function () {
                    qsa('button[data-horizon]', horizonRoot).forEach(function (node) { node.classList.remove('active'); });
                    button.classList.add('active');
                    rerender();
                });
            });
        }
    }

    function renderWarehouseForecast(items) {
        var root = qs('[data-warehouse-forecast]');
        if (!root) return;
        var required = items.filter(function (item) { return item.supplyStatus === 'required'; });
        var soon = items.filter(function (item) { return item.supplyStatus === 'soon'; });
        var planned = items.filter(function (item) { return item.supplyStatus === 'planned'; });
        var urgentRows = required.concat(soon).sort(function (a, b) {
            return String(a.needByDate || '9999-12-31').localeCompare(String(b.needByDate || '9999-12-31'));
        }).slice(0, 6);
        root.innerHTML =
            '<section class="warehouse-alerts">' +
                '<article class="warehouse-alert warehouse-alert-danger"><strong>Срочно</strong><span>' + required.length + '</span></article>' +
                '<article class="warehouse-alert warehouse-alert-warn"><strong>Скоро понаобятся</strong><span>' + soon.length + '</span></article>' +
                '<article class="warehouse-alert"><strong>Без плана</strong><span>' + planned.length + '</span></article>' +
            '</section>' +
            (urgentRows.length
                ? '<div class="warehouse-hot-list">' + urgentRows.map(function (item) {
                    return '<div class="warehouse-hot-row">' +
                        '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + ' • нужно к ' + escapeHtml(item.needByDate || 'без даты') + (item.stageTitle ? ' • этап: ' + escapeHtml(item.stageTitle) : '') + '</small></div>' +
                        '<span class="badge ' + planningStatusClass(item.supplyStatus) + '">' + escapeHtml(item.supplyLabel || 'Статус не заан') + '</span>' +
                    '</div>';
                }).join('') + '</div>'
                : '<p class="muted">Критичных позиций сейчас нет.</p>');
    }

    function renderWarehouseLedger(items) {
        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        if (!items.length) {
            root.innerHTML = '<p class="muted">Материалы пока не загружены. Импортируй смету от бота, и здесь появится общая картина по складу.</p>';
            return;
        }
        root.innerHTML =
            '<div class="warehouse-table-wrap"><table class="warehouse-table warehouse-table-compact">' +
                '<thead><tr>' +
                    '<th>Объект</th><th>Материал</th><th>По смете</th><th>На склае</th><th>Не хватает</th><th>Нужно к</th><th>Статус</th>' +
                '</tr></thead>' +
                '<tbody>' + items.map(warehouseLedgerRow).join('') + '</tbody>' +
            '</table></div>';
    }

    function warehouseLedgerRow(item) {
        var missing = Number(item.missingQty) || 0;
        var rowRisk = item.supplyStatus === 'required' || missing > 0;
        return '<tr class="' + (rowRisk ? 'row-risk' : '') + '">' +
            '<td><b>' + escapeHtml(item.projectTitle) + '</b><small>' + escapeHtml(item.clientName || item.projectAddress || '') + '</small></td>' +
            '<td><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.unit || '') + (item.stageTitle ? ' • ' + escapeHtml(item.stageTitle) : '') + (item.notes ? ' • ' + escapeHtml(item.notes) : '') + '</small></td>' +
            '<td>' + escapeHtml(item.plannedQty) + ' ' + escapeHtml(item.unit || '') + '</td>' +
            '<td>' + escapeHtml(item.stockQty) + ' ' + escapeHtml(item.unit || '') + '</td>' +
            '<td>' + escapeHtml(missing) + ' ' + escapeHtml(item.unit || '') + '</td>' +
            '<td>' + escapeHtml(item.needByDate || '—') + '</td>' +
            '<td><span class="badge ' + planningStatusClass(item.supplyStatus) + '">' + escapeHtml(item.supplyLabel || '—') + '</span></td>' +
        '</tr>';
    }

    function renderWarehousePage() {
        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        if (!state.projects.length) {
            root.innerHTML = '<p class="muted">Нет объектов для анализа склада.</p>';
            return;
        }
        root.innerHTML = '';
        fillProjectSelects();
        loadAllWarehouseMaterials(function (items) {
            state.warehouseItems = items;
            renderWarehouseAnalysis(items);
            renderWarehouseForecast(items);
            renderWarehouseLedger(items);
            bindWarehouseSearch(items);
            bindWarehouseFilters(items);
            bindMaterialCreateForm();
            renderStockMoveForm(items);
            bindEstimateImport();
            loadAllWarehouseStages(function (stagesMap) {
                bindMaterialPlanForm(items, stagesMap);
            });
        });
    }

    function bindMaterialPlanForm(items, stagesMap) {
        var form = qs('[data-material-plan-form]');
        var projectSelect = qs('[data-plan-projects]');
        var materialSelect = qs('[data-plan-materials]');
        var stageSelect = qs('[data-plan-stages]');
        if (!form || !projectSelect || !materialSelect || !stageSelect) return;

        qsa('[data-plan-projects]').forEach(function (select) {
            if (!select.innerHTML.trim()) {
                select.innerHTML = state.projects.map(function (project) {
                    return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
                }).join('');
            }
        });

        function updatePlanOptions() {
            var projectId = Number(projectSelect.value);
            var projectItems = items.filter(function (item) { return Number(item.projectId) === projectId; });
            var projectStages = stagesMap[projectId] || [];
            materialSelect.innerHTML = projectItems.length
                ? projectItems.map(function (item) {
                    return '<option value="' + item.id + '">' + escapeHtml(item.title) + ' · ' + escapeHtml(item.supplyLabel || 'без статуса') + '</option>';
                }).join('')
                : '<option value="">Нет материалов</option>';
            stageSelect.innerHTML = '<option value="">Без этапа</option>' + projectStages.map(function (stage) {
                return '<option value="' + stage.id + '">' + escapeHtml(stage.title) + '</option>';
            }).join('');
            materialSelect.disabled = !projectItems.length;
            syncMaterialPlanForm(projectItems);
        }

        function syncMaterialPlanForm(projectItems) {
            var material = projectItems.filter(function (item) { return String(item.id) === String(materialSelect.value); })[0] || projectItems[0];
            if (!material) {
                form.need_by_date.value = '';
                if (form.delivery_days) form.delivery_days.value = '';
                form.notes.value = '';
                stageSelect.value = '';
                return;
            }
            materialSelect.value = String(material.id);
            form.need_by_date.value = material.needByDate || '';
            if (form.delivery_days) form.delivery_days.value = material.deliveryDays == null ? '' : String(material.deliveryDays);
            form.notes.value = material.notes || '';
            stageSelect.value = material.stageId ? String(material.stageId) : '';
        }

        if (projectSelect.dataset.bound !== '1') {
            projectSelect.dataset.bound = '1';
            projectSelect.addEventListener('change', updatePlanOptions);
        }
        if (materialSelect.dataset.bound !== '1') {
            materialSelect.dataset.bound = '1';
            materialSelect.addEventListener('change', function () {
                var projectId = Number(projectSelect.value);
                var projectItems = items.filter(function (item) { return Number(item.projectId) === projectId; });
                syncMaterialPlanForm(projectItems);
            });
        }

        updatePlanOptions();

        if (form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-material-plan-error]');
            if (error) error.classList.remove('active');
            var projectId = Number(form.project_id.value);
            api('/api/materials/' + form.material_id.value + '/update', {
                method: 'POST',
                body: JSON.stringify({
                    stage_id: form.stage_id.value,
                    need_by_date: form.need_by_date.value,
                    delivery_days: form.delivery_days ? Number(form.delivery_days.value || 0) : undefined,
                    notes: form.notes.value.trim()
                })
            }).then(function () {
                refreshWarehouse(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить план потребности';
                    error.classList.add('active');
                }
            });
        });
    }

    function renderSchedulePage() {
        var root = qs('[data-schedule-list]');
        if (!root) return;
        if (!state.projects.length) {
            root.innerHTML = '<p class="muted">Нет объектов для графика.</p>';
            return;
        }
        root.innerHTML = '';
        state.scheduleQuickActions = {};
        Promise.all(state.projects.map(function (project) {
            return Promise.all([
                api('/api/projects/' + project.id + '/stages').catch(function () { return { stages: [] }; }),
                api('/api/projects/' + project.id + '/notifications').catch(function () { return null; }),
                api('/api/projects/' + project.id + '/materials/summary').catch(function () { return { items: [] }; }),
                api('/api/projects/' + project.id + '/tasks').catch(function () { return { tasks: [] }; })
            ]).then(function (results) {
                return {
                    project: project,
                    stages: Array.isArray(results[0].stages) ? results[0].stages : [],
                    notifications: results[1] || null,
                    materials: Array.isArray(results[2].items) ? results[2].items : [],
                    tasks: Array.isArray(results[3].tasks) ? results[3].tasks : []
                };
            });
        })).then(function (groups) {
            root.innerHTML = groups.map(function (group) {
                return renderScheduleProject(group.project, group.stages, group.notifications, group.materials, group.tasks);
            }).join('');
            bindScheduleActionButtons();
        });
    }

    function renderScheduleProject(project, stages, notifications, materials, tasks) {
        var types = hasRole('customer') ? ['customer'] : ['internal', 'customer'];
        var badges = types.map(function (type) {
            var stateMeta = getScheduleState(project, type);
            var shortLabel = type === 'customer' ? 'Заказчик' : 'Внутренний';
            return '<span class="badge ' + scheduleStateKind(stateMeta) + '">' + escapeHtml(shortLabel + ' v' + stateMeta.version + ' • ' + scheduleStateTitle(stateMeta)) + '</span>';
        }).join('');
        var summary = renderScheduleProjectSummary(project, stages, notifications);
        return '<section class="schedule-project">' +
            '<div class="card-head schedule-project-head"><div><h4>' + escapeHtml(project.title) + '</h4><span class="muted">' + escapeHtml(project.address || project.client_name || 'Адрес не указан') + '</span></div><div class="project-badges">' + badges + '</div></div>' +
            summary +
            renderScheduleActionCenter(project, stages, notifications, materials || [], tasks || []) +
            renderScheduleCalendar(project, stages) +
            renderStages(stages) +
        '</section>';
    }

    function renderScheduleProjectSummary(project, stages, notifications) {
        var today = APP_TODAY;
        var overdue = stages.filter(function (stage) { return isStageOverdue(stage, today); }).length;
        var behind = stages.filter(function (stage) { return isStageBehindPlan(stage, today); }).length;
        var done = stages.filter(function (stage) {
            return percent(stage.progress) >= 100 || stage.status_code === 'approved' || stage.status_code === 'completed';
        }).length;
        var nextDate = collectNextStageDate(stages);
        var reportText = notifications && notifications.missingDailyReport
            ? 'Нет отчета за 26.07.2026'
            : (notifications && notifications.latestDailyLog && notifications.latestDailyLog.report_date
                ? 'Последний отчет: ' + notifications.latestDailyLog.report_date
                : 'Отчетов пока нет');
        var reportKind = notifications && notifications.missingDailyReport ? 'danger' : '';
        return '<div class="schedule-project-summary">' +
            stat('Этапов', String(stages.length || 0)) +
            stat('Закрыто', String(done || 0)) +
            stat('Просрочено', String(overdue || 0), overdue ? 'danger' : '') +
            stat('Отстает', String(behind || 0), behind ? 'warn' : '') +
            stat('Ближайшая дата', nextDate || '—') +
            stat('Отчет', reportText, reportKind) +
        '</div>';
    }

    function collectNextStageDate(stages) {
        var dates = stages.map(function (stage) {
            if (percent(stage.progress) >= 100 || stage.status_code === 'approved' || stage.status_code === 'completed') return '';
            return stage.planned_end || stage.planned_start || '';
        }).filter(Boolean).sort();
        return dates.length ? dates[0] : '';
    }

    function renderScheduleActionCenter(project, stages, notifications, materials, tasks) {
        if (hasRole('customer')) return '';
        var actions = buildScheduleActions(project, stages, notifications, materials, tasks).slice(0, 6);
        if (!actions.length) return '';
        return '<section class="schedule-action-strip">' +
            '<div class="card-head"><div><h5>Что сделать сейчас</h5><span class="muted">Собрано из графика, отчетов и материалов.</span></div></div>' +
            '<div class="schedule-action-list">' + actions.map(renderScheduleActionCard).join('') + '</div>' +
        '</section>';
    }

    function buildScheduleActions(project, stages, notifications, materials, tasks) {
        var actions = [];
        var existing = {};
        (tasks || []).forEach(function (task) {
            if (task.status === 'done') return;
            existing[normalizeTaskTitle(task.title)] = true;
        });

        function register(action) {
            if (!action || !action.key) return;
            if (actions.some(function (item) { return item.key === action.key; })) return;
            if (action.taskPayload) {
                action.hasOpenTask = Boolean(existing[normalizeTaskTitle(action.taskPayload.title)]);
                action.actionKey = 'schedule:' + project.id + ':' + action.key;
                state.scheduleQuickActions[action.actionKey] = action.taskPayload;
            }
            actions.push(action);
        }

        if (notifications && notifications.missingDailyReport) {
            register({
                key: 'missing-report',
                kind: 'warn',
                title: 'Нет дневного отчета за 26.07.2026',
                meta: 'Нужен факт по объекту, иначе график будет жить без свежего отчета.',
                projectId: project.id,
                taskPayload: {
                    projectId: project.id,
                    title: 'Запросить дневной отчет по объекту',
                    description: 'По объекту "' + project.title + '" нет дневного отчета за 26.07.2026. Нужно запросить факт работ у ответственного.',
                    priority: 'high',
                    due_at: APP_TODAY
                }
            });
        }

        (notifications && notifications.problemStages ? notifications.problemStages : []).forEach(function (stage) {
            var fullStage = stages.find(function (item) { return Number(item.id) === Number(stage.id); }) || stage;
            var isBlocked = fullStage.status_code === 'blocked';
            register({
                key: 'problem-stage:' + fullStage.id,
                kind: 'danger',
                title: isBlocked ? ('Этап заблокирован: ' + fullStage.title) : ('Этап просрочен: ' + fullStage.title),
                meta: (fullStage.responsible ? ('Ответственный: ' + fullStage.responsible + '. ') : '') + (fullStage.planned_end ? ('План до ' + fullStage.planned_end + '.') : 'Нужно уточнить срок.'),
                taskPayload: {
                    projectId: project.id,
                    title: isBlocked ? ('Разблокировать этап: ' + fullStage.title) : ('Разобрать просрочку по этапу: ' + fullStage.title),
                    description: 'По объекту "' + project.title + '" этап "' + fullStage.title + '" требует реакции. Статус: ' + statusLabel(fullStage.status_code) + '.',
                    priority: 'high',
                    due_at: fullStage.planned_end && fullStage.planned_end > APP_TODAY ? fullStage.planned_end : APP_TODAY
                }
            });
        });

        stages.filter(function (stage) {
            return isStageBehindPlan(stage, APP_TODAY) && (stage.status_code !== 'blocked');
        }).slice(0, 2).forEach(function (stage) {
            register({
                key: 'behind-stage:' + stage.id,
                kind: 'warn',
                title: 'Этап отстает по темпу: ' + stage.title,
                meta: (stage.planned_start || '—') + ' - ' + (stage.planned_end || '—') + (stage.responsible ? (' • ' + stage.responsible) : ''),
                taskPayload: {
                    projectId: project.id,
                    title: 'Подтянуть этап по графику: ' + stage.title,
                    description: 'Этап "' + stage.title + '" отстает от планового темпа на объекте "' + project.title + '". Нужно обновить факт, людей или срок.',
                    priority: 'normal',
                    due_at: stage.planned_end || APP_TODAY
                }
            });
        });

        (materials || []).filter(function (item) {
            return Number(item.missingQty || 0) > 0 && ['required', 'soon'].indexOf(item.supplyStatus) !== -1;
        }).slice(0, 3).forEach(function (item) {
            register({
                key: 'material:' + item.id,
                kind: item.supplyStatus === 'required' ? 'danger' : 'warn',
                title: 'Нехватка материала: ' + item.title,
                meta: 'Не хватает ' + item.missingQty + ' ' + item.unit + (item.needByDate ? (' • нужно до ' + item.needByDate) : '') + (item.stageTitle ? (' • этап: ' + item.stageTitle) : ''),
                taskPayload: {
                    projectId: project.id,
                    title: 'Закупить материал: ' + item.title,
                    description: 'По объекту "' + project.title + '" не хватает ' + item.missingQty + ' ' + item.unit + ' материала "' + item.title + '".' + (item.needByDate ? (' Нужен до ' + item.needByDate + '.') : ''),
                    priority: item.supplyStatus === 'required' ? 'high' : 'normal',
                    due_at: item.needByDate || APP_TODAY
                }
            });
        });

        return actions;
    }

    function renderScheduleActionCard(action) {
        var controls = '';
        var links = [];
        if (action.projectId && action.materialId) {
            links.push('<a class="ghost material-link" href="/app/warehouse?projectId=' + action.projectId + '&materialId=' + action.materialId + '&status=' + (action.kind === 'danger' ? 'required' : 'soon') + '">Склад</a>');
            if (canManageSuppliers()) links.push('<a class="ghost material-link" href="/app/suppliers?projectId=' + action.projectId + '&materialId=' + action.materialId + '">Поставщики</a>');
        }
        if (action.taskPayload && (hasRole('admin') || hasRole('director'))) {
            controls = action.hasOpenTask
                ? '<span class="badge">Задача уже есть</span>'
                : '<button class="ghost" type="button" data-schedule-action-create data-action-key="' + escapeHtml(action.actionKey) + '">Создать задачу</button>';
        }
        controls = links.join('') + controls;
        return '<article class="schedule-action-card schedule-action-' + action.kind + '">' +
            '<div class="schedule-action-main"><b>' + escapeHtml(action.title) + '</b><small>' + escapeHtml(action.meta) + '</small></div>' +
            '<div class="schedule-action-side">' + controls + '</div>' +
        '</article>';
    }

    function normalizeTaskTitle(value) {
        return String(value || '').trim().toLowerCase();
    }

    function bindScheduleActionButtons() {
        qsa('[data-schedule-action-create]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var payload = state.scheduleQuickActions[button.dataset.actionKey];
                if (!payload) return;
                button.disabled = true;
                button.textContent = 'Создаем...';
                api('/api/projects/' + payload.projectId + '/tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: payload.title,
                        description: payload.description,
                        priority: payload.priority || 'normal',
                        due_at: payload.due_at || '',
                        assignee_id: payload.assignee_id || ''
                    })
                }).then(function () {
                    button.textContent = 'Создано';
                    renderSchedulePage();
                }).catch(function () {
                    button.disabled = false;
                    button.textContent = 'Повторить';
                });
            });
        });
    }

    function renderScheduleCalendar(project, stages) {
        var customerMode = hasRole('customer');
        var range = buildScheduleCalendarRange(stages, customerMode);
        if (!range) return '';
        var title = customerMode ? 'График для заказчика' : 'Внутренний график и факт';
        var subtitle = customerMode
            ? 'Показываем согласованные даты по этапам.'
            : 'Синий бар показывает план, светлый бар показывает факт, вертикальная линия - сегодня.';
        return '<section class="schedule-gantt">' +
            '<div class="schedule-gantt-head">' +
                '<div><h5>' + title + '</h5><span class="muted">' + subtitle + '</span></div>' +
                '<div class="schedule-gantt-range"><strong>' + escapeHtml(formatShortDate(range.start)) + ' - ' + escapeHtml(formatShortDate(range.end)) + '</strong><span>' + escapeHtml(String(range.totalDays) + ' дн.') + '</span></div>' +
            '</div>' +
            renderScheduleScale(range) +
            '<div class="schedule-gantt-list">' + stages.map(function (stage) {
                return renderScheduleCalendarRow(stage, range, customerMode);
            }).join('') + '</div>' +
        '</section>';
    }

    function buildScheduleCalendarRange(stages, customerMode) {
        var dates = [];
        stages.forEach(function (stage) {
            var planStart = customerMode ? (stage.customer_start || stage.planned_start || '') : (stage.planned_start || '');
            var planEnd = customerMode ? (stage.customer_end || stage.planned_end || '') : (stage.planned_end || '');
            if (planStart) dates.push(planStart);
            if (planEnd) dates.push(planEnd);
            if (!customerMode) {
                if (stage.fact_start) dates.push(stage.fact_start);
                if (stage.fact_end) dates.push(stage.fact_end);
            }
        });
        dates = dates.filter(Boolean).sort();
        if (!dates.length) return null;
        return {
            start: dates[0],
            end: dates[dates.length - 1],
            totalDays: Math.max(1, scheduleDayDiff(dates[0], dates[dates.length - 1]) + 1)
        };
    }

    function renderScheduleScale(range) {
        var marks = [];
        var steps = range.totalDays <= 4 ? range.totalDays : 5;
        for (var index = 0; index < steps; index += 1) {
            var offset = steps === 1 ? 0 : Math.round(((range.totalDays - 1) * index) / (steps - 1));
            var iso = addDaysToIso(range.start, offset);
            var left = range.totalDays === 1 ? 0 : (offset / (range.totalDays - 1)) * 100;
            var sideClass = index === 0 ? ' is-start' : (index === steps - 1 ? ' is-end' : '');
            var label = formatShortDate(iso);
            if (index === 0) label = 'Старт ' + label;
            if (index === steps - 1) label = 'Финиш ' + label;
            marks.push(
                '<span class="schedule-gantt-mark' + sideClass + '" style="left:' + left + '%">' +
                    '<i></i><b>' + escapeHtml(label) + '</b>' +
                '</span>'
            );
        }
        return '<div class="schedule-gantt-scale">' +
            '<div class="schedule-gantt-scale-line"></div>' +
            marks.join('') +
            '</div>' +
            '<div class="schedule-gantt-legend">' +
                '<span><i class="legend-dot"></i> контрольные даты</span>' +
                '<span><i class="legend-bar"></i> окно раздела</span>' +
                '<span><i class="legend-today"></i> сегодня</span>' +
            '</div>';
    }

    function renderScheduleCalendarRow(stage, range, customerMode) {
        var progress = percent(stage.progress);
        var planStart = customerMode ? (stage.customer_start || stage.planned_start || '') : (stage.planned_start || '');
        var planEnd = customerMode ? (stage.customer_end || stage.planned_end || '') : (stage.planned_end || '');
        var factStart = customerMode ? '' : (stage.fact_start || '');
        var factEnd = customerMode ? '' : (stage.fact_end || '');
        var planStyle = scheduleBarStyle(planStart, planEnd, range);
        var factStyle = scheduleBarStyle(factStart, factEnd, range);
        var todayLeft = scheduleTodayPercent(range);
        var meta = customerMode
            ? (planStart || '—') + ' - ' + (planEnd || '—')
            : ((planStart || '—') + ' - ' + (planEnd || '—') + (factStart || factEnd ? ' • факт: ' + (factStart || '—') + ' - ' + (factEnd || '—') : ''));
        var planClass = scheduleTimelineClass(stage, APP_TODAY);
        return '<div class="schedule-gantt-row">' +
            '<div class="schedule-gantt-meta"><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta) + '</small></div>' +
            '<div class="schedule-gantt-track">' +
                '<span class="schedule-gantt-today" style="left:' + todayLeft + '%"></span>' +
                (planStyle ? '<span class="schedule-gantt-bar schedule-gantt-plan ' + planClass + '" style="' + planStyle + '"></span>' : '') +
                (!customerMode && factStyle ? '<span class="schedule-gantt-bar schedule-gantt-fact" style="' + factStyle + '"></span>' : '') +
            '</div>' +
            '<div class="schedule-gantt-side"><strong>' + progress + '%</strong><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + '</span></div>' +
        '</div>';
    }

    function scheduleBarStyle(start, end, range) {
        var safeStart = start || end || '';
        var safeEnd = end || start || '';
        if (!safeStart || !safeEnd) return '';
        var startOffset = Math.max(0, scheduleDayDiff(range.start, safeStart));
        var endOffset = Math.max(startOffset, scheduleDayDiff(range.start, safeEnd));
        var left = (startOffset / range.totalDays) * 100;
        var width = (Math.max(1, endOffset - startOffset + 1) / range.totalDays) * 100;
        return 'left:' + left + '%;width:' + width + '%';
    }

    function scheduleTodayPercent(range) {
        var offset = Math.max(0, Math.min(range.totalDays - 1, scheduleDayDiff(range.start, APP_TODAY)));
        return range.totalDays === 1 ? 0 : (offset / (range.totalDays - 1)) * 100;
    }

    function scheduleDayDiff(start, end) {
        var startTime = Date.parse(start + 'T00:00:00Z');
        var endTime = Date.parse(end + 'T00:00:00Z');
        if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
        return Math.round((endTime - startTime) / 86400000);
    }

    function addDaysToIso(iso, days) {
        var base = Date.parse(iso + 'T00:00:00Z');
        if (Number.isNaN(base)) return iso;
        return new Date(base + days * 86400000).toISOString().slice(0, 10);
    }

    function formatShortDate(iso) {
        return formatDisplayDate(iso);
    }

    function renderStages(stages) {
        if (!stages.length) return '<p class="muted">Нет этапов для отображения.</p>';
        return renderScheduleRows(stages, false);
    }

    function renderLogsPage() {
        var list = qs('[data-logs-list]');
        if (!list) return;
        if (!state.projects.length) {
            list.innerHTML = '<p class="muted">Нет объектов для журнала работ.</p>';
            return;
        }
        var projectSelect = qs('[data-logs-project]');
        var formProjectSelect = qs('[data-log-projects]');
        var options = state.projects.map(function (project) {
            return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
        }).join('');
        if (projectSelect) projectSelect.innerHTML = options;
        if (formProjectSelect) formProjectSelect.innerHTML = options;
        var dateInput = qs('[data-log-form] input[name="report_date"]');
        if (dateInput && !dateInput.value) dateInput.value = APP_TODAY;
        if (state.user && (hasRole('customer') || hasRole('purchaser'))) {
            var createCard = qs('[data-log-create-card]');
            if (createCard) createCard.remove();
        } else {
            bindLogForm();
        }
        function loadSelected() {
            var projectId = Number(projectSelect && projectSelect.value ? projectSelect.value : state.projects[0].id);
            var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || state.projects[0];
            if (formProjectSelect) formProjectSelect.value = String(projectId);
            loadProjectLogs(project.id, function (logs) {
                renderLogsStats(logs);
                renderLogsList(project, logs);
            });
        }
        if (projectSelect && projectSelect.dataset.bound !== '1') {
            projectSelect.dataset.bound = '1';
            projectSelect.addEventListener('change', loadSelected);
        }
        loadSelected();
    }

    function loadProjectLogs(projectId, callback) {
        api('/api/projects/' + projectId + '/daily-logs').then(function (data) {
            callback(Array.isArray(data.logs) ? data.logs : []);
        }).catch(function () {
            callback([]);
        });
    }

    function renderLogsStats(logs) {
        var root = qs('[data-logs-stats]');
        if (!root) return;
        var visible = logs.filter(function (log) { return Number(log.is_client_visible) === 1; }).length;
        var internal = logs.length - visible;
        var workers = logs.reduce(function (sum, log) { return sum + Number(log.workers_count || 0); }, 0);
        var blockers = logs.filter(function (log) { return String(log.blockers || '').trim(); }).length;
        root.innerHTML =
            stat('Отчетов', logs.length) +
            stat('Видно заказчику', visible) +
            stat('Внутренне', internal) +
            stat('Людей в отчетах', workers) +
            stat('С блокерами', blockers, blockers ? 'danger' : '');
    }



    function renderLogsPage() {
        var list = qs('[data-logs-list]');
        if (!list) return;
        if (!state.projects.length) {
            list.innerHTML = '<p class="muted">Нет объектов для журнала работ.</p>';
            return;
        }
        var projectSelect = qs('[data-logs-project]');
        var formProjectSelect = qs('[data-log-projects]');
        var options = state.projects.map(function (project) {
            return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
        }).join('');
        if (projectSelect) projectSelect.innerHTML = options;
        if (formProjectSelect) formProjectSelect.innerHTML = options;
        var dateInput = qs('[data-log-form] input[name="report_date"]');
        if (dateInput && !dateInput.value) dateInput.value = APP_TODAY;
        if (state.user && (hasRole('customer') || hasRole('purchaser'))) {
            var createCard = qs('[data-log-create-card]');
            if (createCard) createCard.remove();
        } else {
            bindLogForm();
        }
        function loadSelected() {
            var projectId = Number(projectSelect && projectSelect.value ? projectSelect.value : state.projects[0].id);
            var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || state.projects[0];
            if (formProjectSelect) formProjectSelect.value = String(projectId);
            loadProjectLogs(project.id, function (logs) {
                loadProjectNotifications(project.id, function (notifications) {
                    renderLogsStats(logs, notifications);
                    renderLogsAlerts(notifications);
                    renderLogsList(project, logs);
                });
            });
        }
        if (projectSelect && projectSelect.dataset.bound !== '1') {
            projectSelect.dataset.bound = '1';
            projectSelect.addEventListener('change', loadSelected);
        }
        loadSelected();
    }

    function renderLogsStats(logs, notifications) {
        var root = qs('[data-logs-stats]');
        if (!root) return;
        var visible = logs.filter(function (log) { return Number(log.is_client_visible) === 1; }).length;
        var internal = logs.length - visible;
        var workers = logs.reduce(function (sum, log) { return sum + Number(log.workers_count || 0); }, 0);
        var blockers = logs.filter(function (log) { return String(log.blockers || '').trim(); }).length;
        root.innerHTML =
            stat('Отчетов', logs.length) +
            stat('Видно заказчику', visible) +
            stat('Внутренне', internal) +
            stat('Людей в отчетах', workers) +
            stat('С блокерами', blockers, blockers ? 'danger' : '') +
            stat('Отчет сегодня', notifications && notifications.missingDailyReport ? 'нет' : 'есть', notifications && notifications.missingDailyReport ? 'danger' : '');
    }

    function renderLogsAlerts(notifications) {
        var root = qs('[data-logs-alerts]');
        if (!root) return;
        if (!notifications) {
            root.innerHTML = '';
            return;
        }
        var cards = [];
        if (notifications.missingDailyReport) {
            cards.push('<article class="notice-card notice-warn"><b>Сегодняшний отчет еще не сдан</b><small>На 26.07.2026 по объекту нет дневного отчета.</small></article>');
        }
        if (notifications.blockerLogs && notifications.blockerLogs.length) {
            var latestBlocker = notifications.blockerLogs[0];
            cards.push('<article class="notice-card notice-danger"><b>Есть блокеры в работах</b><small>' + escapeHtml((latestBlocker.report_date || 'без даты') + ': ' + (latestBlocker.blockers || 'описание не указано')) + '</small></article>');
        }
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            cards.push('<article class="notice-card"><b>Просроченные задачи: ' + notifications.overdueTasks.length + '</b><small>Их стоит разобрать вместе с отчетом за день.</small></article>');
        }
        root.innerHTML = cards.length ? cards.join('') : '';
    }

    function renderChatsPage() {
        var list = qs('[data-global-chat-list]');
        var windowNode = qs('[data-global-chat-window]');
        if (!list || !windowNode) return;
        if (!state.projects.length) {
            list.innerHTML = '<p class="muted">Нет объектов.</p>';
            return;
        }
        Promise.all(state.projects.map(function (project) {
            return api('/api/projects/' + project.id + '/chats').then(function (data) {
                return (Array.isArray(data.chats) ? data.chats : []).map(function (chat) {
                    chat.projectTitle = project.title;
                    return chat;
                });
            }).catch(function () {
                return [];
            });
        })).then(function (groups) {
            var chats = groups.reduce(function (acc, item) { return acc.concat(item); }, []);
            if (!chats.length) {
                list.innerHTML = '<p class="muted">Чаты пока не созаны.</p>';
                return;
            }
            list.innerHTML = chats.map(function (chat, index) {
                return '<button class="chat-item ' + (index === 0 ? 'active' : '') + '" data-open-chat="' + chat.id + '"><b>' + escapeHtml(chat.title) + '</b><span>' + escapeHtml(chat.projectTitle) + '</span></button>';
            }).join('');
            qsa('[data-open-chat]', list).forEach(function (button) {
                button.addEventListener('click', function () {
                    qsa('[data-open-chat]', list).forEach(function (node) { node.classList.remove('active'); });
                    button.classList.add('active');
                    renderGlobalChat(Number(button.dataset.openChat));
                });
            });
            renderGlobalChat(Number(chats[0].id));
        });
    }

    function renderGlobalChat(chatId) {
        var windowNode = qs('[data-global-chat-window]');
        if (!windowNode) return;
        api('/api/chats/' + chatId + '/messages').then(function (data) {
            var messages = Array.isArray(data.messages) ? data.messages : [];
            windowNode.innerHTML =
                messages.map(function (message) {
                    return '<div class="message"><b>' + escapeHtml(message.author_name) + '</b><p>' + escapeHtml(message.body) + '</p></div>';
                }).join('') +
                '<form class="chat-compose" data-global-chat-form><input name="body" placeholder="Сообщение"><button type="submit">Отправить</button></form>';
            var form = qs('[data-global-chat-form]', windowNode);
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                if (!form.body.value.trim()) return;
                api('/api/chats/' + chatId + '/messages', {
                    method: 'POST',
                    body: JSON.stringify({ body: form.body.value.trim() })
                }).then(function () {
                    renderGlobalChat(chatId);
                });
            });
        });
    }

    function initCompaniesPageLegacyUnused() {
        loadCompanies(renderCompaniesList);
        var filter = qs('[data-company-type-filter]');
        if (filter) {
            filter.addEventListener('change', function () {
                loadCompanies(renderCompaniesList, filter.value);
            });
        }
        var form = qs('[data-company-create-form]');
        if (!form) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-company-create-error]');
            if (error) error.classList.remove('active');
            api('/api/companies', {
                method: 'POST',
                body: JSON.stringify({
                    type: form.type.value,
                    name: form.name.value.trim(),
                    inn: form.inn.value.trim(),
                    kpp: form.kpp.value.trim(),
                    ogrn: form.ogrn.value.trim(),
                    phone: form.phone.value.trim(),
                    email: form.email.value.trim(),
                    address: form.address.value.trim(),
                    notes: form.notes.value.trim()
                })
            }).then(function () {
                form.reset();
                loadCompanies(renderCompaniesList, filter ? filter.value : '');
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось создать компанию';
                    error.classList.add('active');
                }
            });
        });
    }

    function companySearchMatches(company, query) {
        if (!query) return true;
        var haystack = [
            company && company.name,
            company && company.inn,
            company && company.kpp,
            company && company.ogrn,
            company && company.phone,
            company && company.email,
            company && company.address,
            company && company.notes,
            companyTypeLabel(company && company.type)
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
    }

    function renderFilteredCompaniesList(companies) {
        var search = qs('[data-company-search]');
        var query = String(search && search.value || '').trim().toLowerCase();
        renderCompaniesList((companies || state.companies || []).filter(function (company) {
            return companySearchMatches(company, query);
        }));
    }

    function initCompaniesPage() {
        setupCompanyCreateModal();
        refreshLucideIcons(document);
        loadCompanies(renderFilteredCompaniesList);
        var search = qs('[data-company-search]');
        if (search) {
            search.addEventListener('input', function () {
                renderFilteredCompaniesList(state.companies || []);
            });
        }
        var form = qs('[data-company-create-form]');
        if (!form) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-company-create-error]', form);
            if (error) error.classList.remove('active');
            if (!String(form.name.value || '').trim()) {
                showAppNotice('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442\u0430', 'error');
                if (form.name) form.name.focus();
                return;
            }
            if (String(form.email.value || '').trim() && !isValidUserEmail(form.email.value)) {
                showAppNotice('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 Email', 'error');
                if (form.email) form.email.focus();
                return;
            }
            form.phone.value = formatUserPhone(form.phone.value);
            if (String(form.phone.value || '').trim() && !isCompleteUserPhone(form.phone.value)) {
                showAppNotice('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430', 'error');
                if (form.phone) form.phone.focus();
                return;
            }
            withSubmitLock(form, function () {
                return api('/api/companies', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: form.type.value,
                        name: form.name.value.trim(),
                        inn: form.inn.value.trim(),
                        kpp: form.kpp.value.trim(),
                        ogrn: form.ogrn.value.trim(),
                        phone: form.phone.value.trim(),
                        email: form.email.value.trim(),
                        address: form.address.value.trim(),
                        notes: form.notes.value.trim()
                    })
                }).then(function () {
                    resetCompanyCreateForm(form);
                    closeCompanyCreateModal();
                    return loadCompanies(renderFilteredCompaniesList);
                }).catch(function (err) {
                    if (error) {
                        error.textContent = appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u044e');
                        error.classList.add('active');
                    }
                    throw err;
                });
            });
        });
    }

    function renderCompaniesList(companies) {
        var root = qs('[data-companies-list]');
        if (!root) return;
        if (!companies.length) {
            safeReplaceChildren(root, '<p class="muted">\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b.</p>');
            return;
            root.innerHTML = '<p class="muted">Компании пока не добавлены.</p>';
            return;
        }
        safeReplaceChildren(root, '<div class="companies-list counterparties-grid">' + companies.map(function (company) {
            return renderCounterpartyCard(company);
            var details = [
                company.inn ? 'ИНН ' + company.inn : '',
                company.phone || '',
                company.email || '',
                company.address || ''
            ].filter(Boolean).join(' • ');
            return '<div class="company-row">' +
                '<div><b>' + escapeHtml(company.name) + '</b><small>' + escapeHtml(details || 'Реквизиты не указаны') + '</small></div>' +
                '<span class="badge">' + escapeHtml(companyTypeLabel(company.type)) + '</span>' +
            '</div>';
        }).join('') + '</div>');
        refreshLucideIcons(root);
    }

    function initUsersPage() {
        setupUserCreateModal();
        loadUsers();
        loadProjects(function () {
            renderUserProjectAccessChecks();
            loadUsers();
        });
        var refresh = qs('[data-users-refresh]');
        if (refresh) refresh.addEventListener('click', loadUsers);
        var form = qs('[data-user-create-form]');
        if (!form) return;
        bindLockedUserCreateForm(form);
        return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-user-create-error]');
            if (error) error.classList.remove('active');
            if (isClerkEnabled() && !String(form.email.value || '').trim()) {
                if (error) {
                    error.textContent = 'Для входа через Clerk нужен email пользователя.';
                    error.classList.add('active');
                }
                return;
            }
            var roles = qsa('input[name="roles"]:checked', form).map(function (input) {
                return input.value;
            });
            if (roles.indexOf(form.role.value) === -1) roles.unshift(form.role.value);
            var projectIds = qsa('input[name="project_ids"]:checked', form).map(function (input) {
                return Number(input.value);
            });
            var endpoint = form.role.value === 'foreman' ? '/api/users/manage' : '/api/admin/users';
            api(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name.value.trim(),
                    login: form.login.value.trim(),
                    email: form.email.value.trim(),
                    phone: form.phone.value.trim(),
                    password: form.password.value,
                    role: form.role.value,
                    roles: roles,
                    project_ids: projectIds
                })
            }).then(function () {
                form.reset();
                renderUserProjectAccessChecks();
                loadUsers();
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось создать пользователя';
                    error.classList.add('active');
                }
            });
        });
    }

    function bindLockedUserCreateForm(form) {
        if (!form || form.dataset.lockedSubmitBound === '1') return;
        form.dataset.lockedSubmitBound = '1';
        bindUserPhoneMask(form);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            var error = qs('[data-user-create-error]', form);
            if (error) error.classList.remove('active');
            if (!isValidUserEmail(form.email.value)) {
                showAppNotice('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 Email', 'error');
                if (form.email) form.email.focus();
                return;
            }
            form.phone.value = formatUserPhone(form.phone.value);
            if (!isCompleteUserPhone(form.phone.value)) {
                showAppNotice('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430', 'error');
                if (form.phone) form.phone.focus();
                return;
            }
            if (isClerkEnabled() && !String(form.email.value || '').trim()) {
                if (error) {
                    error.textContent = '\u0414\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u0447\u0435\u0440\u0435\u0437 Clerk \u043d\u0443\u0436\u0435\u043d email \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.';
                    error.classList.add('active');
                }
                return;
            }
            var roles = qsa('input[name="roles"]:checked', form).map(function (input) {
                return input.value;
            });
            if (roles.indexOf(form.role.value) === -1) roles.unshift(form.role.value);
            var projectIds = qsa('input[name="project_ids"]:checked', form).map(function (input) {
                return Number(input.value);
            });
            var endpoint = form.role.value === 'foreman' ? '/api/users/manage' : '/api/admin/users';
            withSubmitLock(form, function () {
                return api(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: form.user_id ? form.user_id.value : '',
                        name: form.name.value.trim(),
                        login: form.login.value.trim(),
                        email: form.email.value.trim(),
                        phone: form.phone.value.trim(),
                        password: form.password.value,
                        role: form.role.value,
                        roles: roles,
                        project_ids: projectIds
                    })
                }).then(function (data) {
                    var wasEdit = !!(form.user_id && form.user_id.value);
                    if (data && data.currentUser) {
                        state.user = data.currentUser;
                        state.currentUser = data.currentUser;
                        renderUser();
                        applyRoleVisibility(document);
                    }
                    form.reset();
                    renderUserProjectAccessChecks();
                    closeUserCreateModal();
                    showAppNotice(wasEdit ? '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d.' : '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u0441\u043e\u0437\u0434\u0430\u043d.', 'success');
                    return loadUsers();
                }).catch(function (err) {
                    var message = appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f');
                    showAppNotice(message, 'error');
                    if (error) {
                        error.textContent = message;
                        error.classList.add('active');
                    }
                    throw err;
                });
            });
        }, true);
    }

    function userPhoneDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function formatUserPhone(value) {
        var digits = userPhoneDigits(value);
        if (!digits) return '';
        if (digits.charAt(0) === '8') digits = '7' + digits.slice(1);
        if (digits.charAt(0) !== '7') digits = '7' + digits;
        digits = digits.slice(0, 11);
        var body = digits.slice(1);
        var result = '+7';
        if (body.length > 0) result += ' (' + body.slice(0, 3);
        if (body.length >= 3) result += ')';
        if (body.length > 3) result += ' ' + body.slice(3, 6);
        if (body.length > 6) result += '-' + body.slice(6, 8);
        if (body.length > 8) result += '-' + body.slice(8, 10);
        return result;
    }

    function isCompleteUserPhone(value) {
        var digits = userPhoneDigits(value);
        return digits.indexOf('7') === 0 && digits.length === 11;
    }

    function isValidUserEmail(value) {
        var text = String(value || '').trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    }

    function bindUserPhoneMask(form) {
        var input = form && form.phone;
        if (!input || input.dataset.phoneMaskBound === '1') return;
        input.dataset.phoneMaskBound = '1';
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('autocomplete', 'tel');
        input.setAttribute('placeholder', '+7 (999) 123-45-67');
        input.addEventListener('input', function () {
            var formatted = formatUserPhone(input.value);
            input.value = formatted;
            input.setSelectionRange(input.value.length, input.value.length);
        });
        input.addEventListener('paste', function (event) {
            event.preventDefault();
            var text = event.clipboardData ? event.clipboardData.getData('text') : '';
            input.value = formatUserPhone(text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    function createCompanyCreateForm() {
        var existing = qs('[data-company-create-form]');
        if (existing) return existing;
        var form = document.createElement('form');
        form.className = 'card form-card company-create-form';
        form.setAttribute('data-company-create-form', '');
        safeReplaceChildren(form,
            '<button class="ghost compact user-create-close" type="button" data-company-create-close>\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>' +
            '<h3>\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442\u0430</h3>' +
            '<label><span>\u0422\u0438\u043f</span><select name="type" required>' +
                '<option value="own_legal_entity">\u041d\u0430\u0448\u0435 \u044e\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u043b\u0438\u0446\u043e</option>' +
                '<option value="client">\u0417\u0430\u043a\u0430\u0437\u0447\u0438\u043a</option>' +
                '<option value="supplier">\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a</option>' +
                '<option value="contractor">\u041f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a</option>' +
                '<option value="other">\u0414\u0440\u0443\u0433\u043e\u0435</option>' +
            '</select></label>' +
            '<label><span>\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435</span><input name="name" required></label>' +
            '<div class="company-create-grid">' +
                '<label><span>\u0418\u041d\u041d</span><input name="inn" inputmode="numeric"></label>' +
                '<label><span>\u041a\u041f\u041f</span><input name="kpp" inputmode="numeric"></label>' +
                '<label><span>\u041e\u0413\u0420\u041d</span><input name="ogrn" inputmode="numeric"></label>' +
                '<label><span>\u0422\u0435\u043b\u0435\u0444\u043e\u043d</span><input name="phone"></label>' +
                '<label><span>Email</span><input name="email" type="email" inputmode="email"></label>' +
                '<label class="company-create-grid-wide"><span>\u0410\u0434\u0440\u0435\u0441</span><input name="address"></label>' +
            '</div>' +
            '<label><span>\u0417\u0430\u043c\u0435\u0442\u043a\u0438</span><textarea name="notes" rows="4"></textarea></label>' +
            '<div class="form-error" data-company-create-error></div>' +
            '<button class="primary" type="submit">\u0421\u043e\u0437\u0434\u0430\u0442\u044c</button>'
        );
        bindUserPhoneMask(form);
        return form;
    }

    function setupCompanyCreateModal() {
        var form = createCompanyCreateForm();
        if (!form || form.dataset.modalReady === '1') return;
        form.dataset.modalReady = '1';
        var modal = document.createElement('div');
        modal.className = 'company-create-modal hidden';
        modal.setAttribute('data-company-create-modal', '');
        var backdrop = document.createElement('button');
        backdrop.className = 'company-create-backdrop';
        backdrop.type = 'button';
        backdrop.setAttribute('data-company-create-close', '');
        backdrop.setAttribute('aria-label', '\u0417\u0430\u043a\u0440\u044b\u0442\u044c');
        var dialog = document.createElement('section');
        dialog.className = 'company-create-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442');
        dialog.appendChild(form);
        modal.appendChild(backdrop);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        qsa('[data-company-create-open]').forEach(function (button) {
            if (button.dataset.companyCreateOpenBound === '1') return;
            button.dataset.companyCreateOpenBound = '1';
            button.addEventListener('click', openCompanyCreateModal);
        });
        qsa('[data-company-create-close]', modal).forEach(function (button) {
            button.addEventListener('click', closeCompanyCreateModal);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeCompanyCreateModal();
        });
    }

    function resetCompanyCreateForm(form) {
        if (!form) return;
        form.reset();
        if (form.phone) form.phone.value = '';
        if (form.email) form.email.value = '';
        if (form.name) form.name.value = '';
        var error = qs('[data-company-create-error]', form);
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        var title = qs('h3', form);
        if (title) title.textContent = '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442\u0430';
        var submit = qs('button[type="submit"]', form);
        if (submit) submit.textContent = '\u0421\u043e\u0437\u0434\u0430\u0442\u044c';
    }

    function openCompanyCreateModal() {
        var modal = qs('[data-company-create-modal]');
        if (!modal) return;
        var form = qs('[data-company-create-form]', modal);
        resetCompanyCreateForm(form);
        modal.classList.remove('hidden');
        document.body.classList.add('counterparty-create-open');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            var first = qs('input, select, textarea, button', modal);
            if (first) first.focus();
        });
    }

    function closeCompanyCreateModal() {
        var modal = qs('[data-company-create-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.removeAttribute('data-open');
        document.body.classList.remove('counterparty-create-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) modal.classList.add('hidden');
        }, 220);
    }

    function createUserCreateForm() {
        var existing = qs('[data-user-create-form]');
        if (existing) return existing;
        var form = document.createElement('form');
        form.className = 'card form-card';
        form.setAttribute('data-user-create-form', '');
        safeReplaceChildren(form,
            '<button class="ghost compact user-create-close" type="button" data-user-create-close>\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>' +
            '<h3>\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430</h3>' +
            '<input type="hidden" name="user_id" value="">' +
            '<label><span>\u0418\u043c\u044f</span><input name="name" required></label>' +
            '<label><span>\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 \u043b\u043e\u0433\u0438\u043d</span><input name="login" required></label>' +
            '<label><span>Email \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430</span><input name="email" type="email" required></label>' +
            '<label><span>\u0422\u0435\u043b\u0435\u0444\u043e\u043d</span><input name="phone" required></label>' +
            '<label><span>\u0421\u0442\u0430\u0440\u0442\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c Clerk</span><input name="password" type="password" minlength="10" required></label>' +
            '<label><span>\u041e\u0441\u043d\u043e\u0432\u043d\u0430\u044f \u0440\u043e\u043b\u044c</span><select name="role" required><option value="foreman">\u041f\u0440\u043e\u0440\u0430\u0431</option></select></label>' +
            '<fieldset class="role-checks hidden">' +
                '<legend>\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0440\u043e\u043b\u0438</legend>' +
                '<label><input type="checkbox" name="roles" value="director"> \u0414\u0438\u0440\u0435\u043a\u0442\u043e\u0440</label>' +
                '<label><input type="checkbox" name="roles" value="foreman"> \u041f\u0440\u043e\u0440\u0430\u0431</label>' +
                '<label><input type="checkbox" name="roles" value="purchaser"> \u0417\u0430\u043a\u0443\u043f\u0449\u0438\u043a</label>' +
                '<label><input type="checkbox" name="roles" value="financier"> \u0424\u0438\u043d\u043f\u043b\u0430\u043d</label>' +
                '<label><input type="checkbox" name="roles" value="accountant"> \u0411\u0443\u0445\u0433\u0430\u043b\u0442\u0435\u0440</label>' +
                '<label><input type="checkbox" name="roles" value="customer"> \u0417\u0430\u043a\u0430\u0437\u0447\u0438\u043a</label>' +
            '</fieldset>' +
            '<fieldset class="role-checks">' +
                '<legend>\u0414\u043e\u0441\u0442\u0443\u043f \u043f\u0440\u043e\u0440\u0430\u0431\u0430 \u043a \u043e\u0431\u044a\u0435\u043a\u0442\u0430\u043c</legend>' +
                '<div data-user-project-access><p class="muted">\u041e\u0431\u044a\u0435\u043a\u0442\u044b \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u044e\u0442\u0441\u044f...</p></div>' +
            '</fieldset>' +
            '<div class="form-error" data-user-create-error></div>' +
            '<button class="primary" type="submit">\u0421\u043e\u0437\u0434\u0430\u0442\u044c</button>'
        );
        return form;
    }

    function setupUserCreateModal() {
        var form = createUserCreateForm();
        if (!form || form.dataset.modalReady === '1') return;
        form.dataset.modalReady = '1';
        var refreshButton = qs('[data-users-refresh]');
        if (refreshButton) {
            refreshButton.className = 'primary';
            refreshButton.textContent = '+ \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c';
            refreshButton.removeAttribute('data-users-refresh');
            refreshButton.setAttribute('data-user-create-open', '');
        }
        var modal = document.createElement('div');
        modal.className = 'user-create-modal hidden';
        modal.setAttribute('data-user-create-modal', '');
        var backdrop = document.createElement('button');
        backdrop.className = 'user-create-backdrop';
        backdrop.type = 'button';
        backdrop.setAttribute('data-user-create-close', '');
        backdrop.setAttribute('aria-label', '\u0417\u0430\u043a\u0440\u044b\u0442\u044c');
        var dialog = document.createElement('section');
        dialog.className = 'user-create-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a');
        dialog.appendChild(form);
        modal.appendChild(backdrop);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        qsa('[data-user-create-open]').forEach(function (button) {
            if (button.dataset.userCreateOpenBound === '1') return;
            button.dataset.userCreateOpenBound = '1';
            button.addEventListener('click', openUserCreateModal);
        });
        qsa('[data-user-create-close]', modal).forEach(function (button) {
            button.addEventListener('click', closeUserCreateModal);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeUserCreateModal();
        });
    }

    function resetUserCreateForm(form) {
        if (!form) return;
        form.reset();
        if (form.user_id) form.user_id.value = '';
        if (form.login) form.login.value = '';
        if (form.password) {
            form.password.value = '';
            form.password.required = true;
        }
        if (form.phone) form.phone.value = '';
        if (form.email) form.email.value = '';
        if (form.name) form.name.value = '';
        var title = qs('h3', form);
        if (title) title.textContent = '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430';
        var submit = qs('button[type="submit"]', form);
        if (submit) submit.textContent = '\u0421\u043e\u0437\u0434\u0430\u0442\u044c';
        renderUserProjectAccessChecks();
    }

    function openUserCreateModal(options) {
        var modal = qs('[data-user-create-modal]');
        if (!modal) return;
        var form = qs('[data-user-create-form]', modal);
        if (!options || options.keepValues !== true) resetUserCreateForm(form);
        modal.classList.remove('hidden');
        document.body.classList.add('user-create-open');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            var first = qs('input, select, textarea, button', modal);
            if (first) first.focus();
        });
    }

    function closeUserCreateModal() {
        var modal = qs('[data-user-create-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.removeAttribute('data-open');
        document.body.classList.remove('user-create-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) modal.classList.add('hidden');
        }, 220);
    }

    function renderUserProjectAccessChecks() {
        var root = qs('[data-user-project-access]');
        if (!root) return;
        if (!state.projects.length) {
            safeReplaceChildren(root, '<p class="muted">Нет доступных объектов.</p>');
            return;
        }
        safeReplaceChildren(root, state.projects.map(function (project) {
            return '<label class="user-project-check"><input type="checkbox" name="project_ids" value="' + escapeHtml(project.id) + '"><span>' + escapeHtml(project.title || ('#' + project.id)) + '</span></label>';
        }).join(''));
    }

    function loadUsers() {
        var root = qs('[data-users-list]');
        if (!root) return;
        api('/api/admin/users').then(function (data) {
            var users = Array.isArray(data.users) ? data.users : [];
            state.users = users;
            root.innerHTML = '<div class="users-list">' + users.map(function (user) {
                var roles = Array.isArray(user.roles) && user.roles.length
                    ? user.roles
                    : [{ code: user.role, name: user.roleLabel || user.role }];
                var roleBadges = roles.map(function (role) {
                    return '<span class="badge">' + escapeHtml(role.name || role.code) + '</span>';
                }).join('');
                var contacts = [user.login, user.email, user.phone, user.status].filter(Boolean).join(' • ');
                return '<div class="user-row"><div><b>' + escapeHtml(user.name) + '</b><small>' + escapeHtml(contacts) + '</small></div><div class="badge-list">' + roleBadges + '</div></div>';
            }).join('') + '</div>';
        }).catch(function () {
            root.innerHTML = '<p class="muted">Список пользователей доступен только директору.</p>';
        });
    }

    function userRoleLabel(role) {
        var code = normalizeRole(role && (role.code || role) || '');
        if (code === 'admin') return '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440';
        if (code === 'director') return '\u0414\u0438\u0440\u0435\u043a\u0442\u043e\u0440';
        if (code === 'foreman') return '\u041f\u0440\u043e\u0440\u0430\u0431';
        return role && (role.name || role.roleLabel) || code || '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a';
    }

    function userRoleClass(role) {
        var code = normalizeRole(role && (role.code || role) || '');
        if (code === 'admin') return ' is-admin';
        if (code === 'director') return ' is-director';
        if (code === 'foreman') return ' is-foreman';
        return '';
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
        var source = String((user && user.name) || (user && user.login) || '?').trim();
        var parts = source.split(/\s+/).filter(Boolean);
        return parts.slice(0, 2).map(function (part) {
            return part.charAt(0).toLocaleUpperCase('ru');
        }).join('') || '?';
    }

    function userAssignedProjects(user) {
        var direct = Array.isArray(user && user.assigned_projects) ? user.assigned_projects : (Array.isArray(user && user.projects) ? user.projects : []);
        if (direct.length) return direct;
        return (state.projects || []).filter(function (project) {
            var assigned = Array.isArray(project && project.assigned_foremen) ? project.assigned_foremen : [];
            return Number(project && project.foreman_id || 0) === Number(user && user.id || 0) || assigned.some(function (item) {
                return Number(item && (item.id || item.user_id || item.userId || item) || 0) === Number(user && user.id || 0);
            });
        });
    }

    function userProjectTags(user) {
        var assigned = userAssignedProjects(user);
        if (!assigned.length) return '<span class="employee-project-empty">\u041e\u0431\u044a\u0435\u043a\u0442\u044b \u043d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u044b</span>';
        return assigned.map(function (project) {
            var projectId = project && (project.id || project.project_id || project.projectId);
            var title = project && (project.title || project.name || project.projectTitle) || ('#' + projectId);
            return '<a class="employee-project-tag" href="/app/projects?openProject=' + encodeURIComponent(projectId || '') + '">' + escapeHtml(title) + '</a>';
        }).join('');
    }

    function renderUserCard(user) {
        user = user || {};
        var roles = effectiveUserRoles(user);
        var roleBadges = roles.map(function (role) {
            return '<span class="employee-role-badge' + userRoleClass(role) + '">' + escapeHtml(userRoleLabel(role)) + '</span>';
        }).join('');
        var contacts = [user.login, user.email, user.phone].filter(Boolean).join(' \u2022 ');
        return '<article class="employee-card" data-employee-card data-user-id="' + escapeHtml(user.id || '') + '">' +
            '<div class="employee-card-top">' +
                '<div class="employee-avatar" aria-hidden="true">' + escapeHtml(userInitials(user)) + '</div>' +
                '<div class="employee-main"><h3>' + escapeHtml(user.name || user.login || '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a') + '</h3><p>' + escapeHtml(contacts || user.status || '') + '</p></div>' +
            '</div>' +
            '<div class="employee-role-list">' + roleBadges + '</div>' +
            '<div class="employee-project-tags">' + userProjectTags(user) + '</div>' +
        '</article>';
    }

    function canDeleteEmployeeAccounts() {
        return !!(state.currentUser && normalizeRole(state.currentUser.role) === 'admin');
    }

    function ensureEmployeeProfileModal() {
        var modal = qs('[data-employee-profile-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'employee-profile-modal hidden';
        modal.setAttribute('data-employee-profile-modal', '');
        modal.innerHTML =
            '<button class="employee-profile-backdrop" type="button" data-employee-profile-close aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c"></button>' +
            '<section class="employee-profile-dialog" role="dialog" aria-modal="true" aria-label="\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430">' +
                '<div data-employee-profile-body></div>' +
            '</section>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-employee-profile-close]')) closeEmployeeProfileModal();
            var edit = event.target.closest('[data-employee-profile-edit]');
            if (edit) {
                var user = findEmployeeById(edit.getAttribute('data-user-id'));
                if (user) openEmployeeEditForm(user);
            }
            var del = event.target.closest('[data-employee-delete]');
            if (del) deleteEmployeeFromProfile(del);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeEmployeeProfileModal();
        });
        return modal;
    }

    function findEmployeeById(userId) {
        userId = Number(userId || 0);
        return (state.users || []).find(function (user) {
            return Number(user && user.id || 0) === userId;
        });
    }

    function employeePrimaryRole(user) {
        var roles = effectiveUserRoles(user);
        return roles[0] || {};
    }

    function renderEmployeeProfile(user) {
        user = user || {};
        var role = employeePrimaryRole(user);
        var projects = userAssignedProjects(user);
        var projectsHtml = projects.length ? projects.map(function (project) {
            var projectId = project && (project.id || project.project_id || project.projectId);
            var title = project && (project.title || project.name || project.projectTitle) || ('#' + projectId);
            return '<a class="employee-profile-project" href="/app/projects?openProject=' + encodeURIComponent(projectId || '') + '">' + escapeHtml(title) + '</a>';
        }).join('') : '<span class="employee-project-empty">\u041e\u0431\u044a\u0435\u043a\u0442\u044b \u043d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u044b</span>';
        var deleteButton = canDeleteEmployeeAccounts()
            ? '<button class="employee-profile-delete" type="button" data-employee-delete data-user-id="' + escapeHtml(user.id || '') + '"><i data-lucide="trash-2"></i><span>\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430</span></button>'
            : '';
        return '<div class="employee-profile-card">' +
            '<button class="ghost compact employee-profile-close" type="button" data-employee-profile-close>\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>' +
            '<div class="employee-profile-head">' +
                '<div class="employee-profile-avatar" aria-hidden="true">' + escapeHtml(userInitials(user)) + '</div>' +
                '<h3>' + escapeHtml(user.name || user.login || '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a') + '</h3>' +
                '<span class="employee-role-badge' + userRoleClass(role) + '">' + escapeHtml(userRoleLabel(role)) + '</span>' +
            '</div>' +
            '<div class="employee-profile-contacts">' +
                '<a href="' + escapeHtml(safeTelHref(user.phone || '')) + '"><i data-lucide="phone"></i><span>' + escapeHtml(user.phone || '\u0422\u0435\u043b\u0435\u0444\u043e\u043d \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d') + '</span></a>' +
                '<a href="mailto:' + escapeHtml(user.email || '') + '"><i data-lucide="mail"></i><span>' + escapeHtml(user.email || 'Email \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d') + '</span></a>' +
            '</div>' +
            '<section class="employee-profile-section"><h4>\u0417\u0430\u043a\u0440\u0435\u043f\u043b\u0435\u043d\u043d\u044b\u0435 \u043e\u0431\u044a\u0435\u043a\u0442\u044b</h4><div class="employee-profile-projects">' + projectsHtml + '</div></section>' +
            '<div class="employee-profile-actions">' +
                '<button class="ghost" type="button" data-employee-profile-edit data-user-id="' + escapeHtml(user.id || '') + '"><i data-lucide="pencil"></i><span>\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c</span></button>' +
                deleteButton +
            '</div>' +
        '</div>';
    }

    function openEmployeeProfile(userId) {
        var user = findEmployeeById(userId);
        if (!user) return;
        var modal = ensureEmployeeProfileModal();
        safeReplaceChildren(qs('[data-employee-profile-body]', modal), renderEmployeeProfile(user));
        refreshLucideIcons(modal);
        modal.classList.remove('hidden');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
        });
    }

    function closeEmployeeProfileModal() {
        var modal = qs('[data-employee-profile-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.removeAttribute('data-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) modal.classList.add('hidden');
        }, 180);
    }

    function openEmployeeEditForm(user) {
        closeEmployeeProfileModal();
        openUserCreateModal({ keepValues: true });
        var form = qs('[data-user-create-form]');
        if (!form) return;
        resetUserCreateForm(form);
        if (form.user_id) form.user_id.value = user.id || '';
        if (form.name) form.name.value = user.name || '';
        if (form.login) form.login.value = user.login || '';
        if (form.email) form.email.value = user.email || '';
        if (form.phone) form.phone.value = formatUserPhone(user.phone || '');
        if (form.password) {
            form.password.value = '';
            form.password.required = false;
        }
        var title = qs('h3', form);
        if (title) title.textContent = '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430';
        var submit = qs('button[type="submit"]', form);
        if (submit) submit.textContent = '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c';
        var assigned = userAssignedProjects(user).map(function (project) {
            return Number(project && (project.id || project.project_id || project.projectId) || 0);
        });
        qsa('input[name="project_ids"]', form).forEach(function (input) {
            input.checked = assigned.indexOf(Number(input.value || 0)) !== -1;
        });
    }

    function deleteEmployeeFromProfile(button) {
        if (!canDeleteEmployeeAccounts()) return;
        var user = findEmployeeById(button.getAttribute('data-user-id'));
        if (!user) return;
        var name = user.name || user.login || '\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430';
        if (!window.confirm('\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430 ' + name + ' \u0438\u0437 \u0441\u0438\u0441\u0442\u0435\u043c\u044b? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e')) return;
        withSubmitLock(button, function () {
            return api('/api/users/manage/' + encodeURIComponent(user.id), { method: 'DELETE' }).then(function () {
                showAppNotice('\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u0443\u0434\u0430\u043b\u0435\u043d', 'success');
                closeEmployeeProfileModal();
                return loadUsers();
            }).catch(function (err) {
                showAppNotice(appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430'), 'error');
                throw err;
            });
        });
    }

    function bindEmployeeCards(root) {
        qsa('[data-employee-card]', root).forEach(function (card) {
            if (card.dataset.employeeCardBound === '1') return;
            card.dataset.employeeCardBound = '1';
            card.addEventListener('click', function (event) {
                if (event.target.closest('a, button, input, select, textarea')) return;
                openEmployeeProfile(card.getAttribute('data-user-id'));
            });
        });
    }

    loadUsers = function () {
        var root = qs('[data-users-list]');
        if (!root) return Promise.resolve();
        safeReplaceChildren(root, '');
        return api('/api/admin/users').then(function (data) {
            var users = Array.isArray(data.users) ? data.users : [];
            state.users = users;
            safeReplaceChildren(root, users.length
                ? '<div class="users-list employees-grid">' + users.map(renderUserCard).join('') + '</div>'
                : '<p class="muted">\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u044b.</p>');
            bindEmployeeCards(root);
            refreshLucideIcons(root);
        }).catch(function () {
            safeReplaceChildren(root, '<p class="muted">\u0421\u043f\u0438\u0441\u043e\u043a \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0443.</p>');
        });
    };

    function initReportsPage() {
        api('/api/dashboard').then(function (data) {
            var stats = qs('[data-dashboard-stats]');
            if (stats) {
                stats.innerHTML =
                    stat('Объектов', data.projectsCount) +
                    stat('В работе', data.activeProjects) +
                    stat('Средний прогресс', data.avgProgress + '%') +
                    stat('Нехватки', data.shortagesCount, data.shortagesCount ? 'danger' : '') +
                    stat('Открытые задачи', data.openTasksCount) +
                    stat('Бюджет', data.totalBudget == null ? 'Скрыто' : money(data.totalBudget)) +
                    stat('Оплачено', data.totalPaid == null ? 'Скрыто' : money(data.totalPaid)) +
                    stat('Маржа сейчас', data.profitNow == null ? 'Скрыто' : money(data.profitNow), data.profitNow < 0 ? 'danger' : '');
            }
            var critical = qs('[data-dashboard-critical]');
            if (critical) {
                var items = Array.isArray(data.criticalItems) ? data.criticalItems : [];
                critical.innerHTML = items.length
                    ? '<div class="materials-list">' + items.map(function (item) {
                        return '<div class="material-row"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + '</small></div><span class="badge danger">Не хватает ' + escapeHtml(item.missingQty) + ' ' + escapeHtml(item.unit) + '</span></div>';
                    }).join('') + '</div>'
                    : '<p class="muted">Критичных нехваток нет.</p>';
            }
            var ai = qs('[data-dashboard-ai]');
            if (ai) {
                ai.textContent = data.shortagesCount
                    ? 'Главный риск — материалы. Нужно закрыть критичные нехватки и проверить задачи, иначе возможен простой на объектах.'
                    : 'Система не видит критичных нехваток. Фокус — держать график работ и своевременно списывать фактическое использование.';
            }
        }).catch(function () {
            var ai = qs('[data-dashboard-ai]');
            if (ai) ai.textContent = 'Отчетность доступна только директору.';
        });
    }

    function loadProjectHub(projectId, project, loadingToken) {

        var overview = qs('[data-panel="overview"]');
        if (!overview) return;
        var root = qs('[data-project-hub]', overview);
        if (!root) {
            overview.insertAdjacentHTML('beforeend', '<section class="subsection"><div class="card-head"><h3>Как объект живет сейчас</h3></div><div data-project-hub></div></section>');
            root = qs('[data-project-hub]', overview);
        }
        if (!root) return;
        safeReplaceChildren(root, '');
        Promise.all([
            api('/api/projects/' + projectId + '/notifications').catch(function () { return {}; }),
            api('/api/projects/' + projectId + '/tasks').catch(function () { return { tasks: [] }; }),
            api('/api/projects/' + projectId + '/documents').catch(function () { return { documents: [] }; }),
            api('/api/projects/' + projectId + '/daily-logs').catch(function () { return { logs: [] }; }),
            api('/api/projects/' + projectId + '/materials-summary').catch(function () { return { items: [] }; }),
            api('/api/projects/' + projectId + '/stages').catch(function () { return { stages: [] }; })
        ]).then(function (results) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            var notifications = results[0] || {};
            var tasks = Array.isArray(results[1].tasks) ? results[1].tasks : [];
            var documents = Array.isArray(results[2].documents) ? results[2].documents : [];
            var logs = Array.isArray(results[3].logs) ? results[3].logs : [];
            var materials = Array.isArray(results[4].items) ? results[4].items : [];
            var stages = Array.isArray(results[5].stages) ? results[5].stages : [];
            safeReplaceChildren(root, renderProjectHub(project || state.selectedProject || {}, {
                notifications: notifications,
                tasks: tasks,
                documents: documents,
                logs: logs,
                materials: materials,
                stages: stages
            }));
            refreshLucideIcons(root);
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return;
            safeReplaceChildren(root, '<p class="muted">Не удалось собрать общую картину по объекту.</p>');
        });
    }

    function renderProjectHub(project, data) {
        var notifications = data.notifications || {};
        var tasks = data.tasks || [];
        var documents = data.documents || [];
        var logs = data.logs || [];
        var materials = data.materials || [];
        var stages = data.stages || [];
        var overdueTasks = Array.isArray(notifications.overdueTasks) ? notifications.overdueTasks.length : 0;
        var blockerLogs = Array.isArray(notifications.blockerLogs) ? notifications.blockerLogs.length : 0;
        var problemStages = Array.isArray(notifications.problemStages) ? notifications.problemStages.length : 0;
        var requiredMaterials = materials.filter(function (item) { return item.supplyStatus === 'required'; }).length;
        var soonMaterials = materials.filter(function (item) { return item.supplyStatus === 'soon'; }).length;
        var latestLog = logs.length ? logs[0] : null;
        var latestDoc = documents.length ? documents[0] : null;
        var activeTasks = tasks.filter(function (task) { return task.status !== 'done'; }).length;
        var doneStages = stages.filter(function (stage) {
            return ['completed', 'approved'].indexOf(stage.status_code) !== -1 || percent(stage.progress) >= 100;
        }).length;
        return '<div class="project-hub-grid">' +
            '<article class="project-hub-card">' +
                '<b>1. График и этапы</b>' +
                '<small>Всего этапов: ' + stages.length + '. Завершено: ' + doneStages + '. Проблемных: ' + problemStages + '.</small>' +
                '<span class="badge ' + (problemStages ? 'danger' : '') + '">' + (problemStages ? 'Нужно внимание' : 'По плану') + '</span>' +
            '</article>' +
            '<article class="project-hub-card">' +
                '<b>2. Материалы</b>' +
                '<small>Требуется сейчас: ' + requiredMaterials + '. Скоро потребуется: ' + soonMaterials + '.</small>' +
                '<span class="badge ' + (requiredMaterials ? 'danger' : (soonMaterials ? 'warn' : '')) + '">' + (requiredMaterials ? 'Есть нехватка' : (soonMaterials ? 'Скоро закупка' : 'Закрыто')) + '</span>' +
            '</article>' +
            '<article class="project-hub-card">' +
                '<b>3. Задачи</b>' +
                '<small>Открытых задач: ' + activeTasks + '. Просроченных: ' + overdueTasks + '.</small>' +
                '<span class="badge ' + (overdueTasks ? 'danger' : (activeTasks ? 'warn' : '')) + '">' + (overdueTasks ? 'Есть просрочка' : (activeTasks ? 'В работе' : 'Чисто')) + '</span>' +
            '</article>' +
            '<article class="project-hub-card">' +
                '<b>4. Ежедневный отчет</b>' +
                '<small>' + escapeHtml(notifications.missingDailyReport ? 'За 26.07.2026 отчет еще не сдан.' : ('Последний отчет: ' + (latestLog && latestLog.report_date ? latestLog.report_date : '—'))) + '</small>' +
                '<span class="badge ' + (notifications.missingDailyReport ? 'danger' : (blockerLogs ? 'warn' : '')) + '">' + (notifications.missingDailyReport ? 'Нет отчета' : (blockerLogs ? 'Есть блокеры' : 'Отчет есть')) + '</span>' +
            '</article>' +
            '<article class="project-hub-card">' +
                '<b>5. Документы</b>' +
                '<small>Всего документов: ' + documents.length + '.' + (latestDoc ? ' Последний: ' + latestDoc.title + '.' : '') + '</small>' +
                '<span class="badge ' + (documents.length ? '' : 'warn') + '">' + (documents.length ? 'Загружены' : 'Пока пусто') + '</span>' +
            '</article>' +
            '<article class="project-hub-card">' +
                '<b>Как это работает вместе</b>' +
                '<small>Сначала ведем этапы, по ним планируем материалы, потом закрываем задачи, фиксируем дневной факт и прикладываем документы по ходу объекта.</small>' +
                '<span class="badge">Единый цикл</span>' +
            '</article>' +
        '</div>';
    }

    function initSuppliersPage() {
        var projectSelect = qs('[data-suppliers-project]');
        var formProjectSelect = qs('[data-supplier-projects]');
        if (!projectSelect || !formProjectSelect) return;
        setupSupplierCreateModal();
        setupSupplierDetailModal();
        var initialParams = new URLSearchParams(location.search);
        var initialProjectId = Number(initialParams.get('projectId') || 0);
        var initialMaterialId = Number(initialParams.get('materialId') || 0);
        var initialSupplierId = Number(initialParams.get('supplierId') || 0);
        var initialSupplierName = String(initialParams.get('supplierName') || '').trim();
        var focusApplied = false;
        var options = state.projects.map(function (project) {
            return '<option value="' + project.id + '">' + escapeHtml(supplierProjectOptionLabel(project)) + '</option>';
        }).join('');
        projectSelect.innerHTML = options;
        formProjectSelect.innerHTML = options;
        loadCompanies(function (companies) {
            fillSupplierCompanyOptions(companies || []);
            applySupplierFormCompanyFocus(initialSupplierId);
        });
        function loadCurrent() {
            var projectId = (!focusApplied && initialProjectId) || Number(projectSelect.value || state.projects[0].id);
            projectSelect.value = String(projectId);
            formProjectSelect.value = String(projectId);
            loadSupplierMaterials(projectId, function (items) {
                var activeMaterialId = 0;
                if (!focusApplied && initialMaterialId) {
                    var materialSelect = qs('[data-supplier-materials]');
                    if (materialSelect) {
                        materialSelect.value = String(initialMaterialId);
                        activeMaterialId = initialMaterialId;
                    }
                }
                renderSuppliersContext(projectId, items, activeMaterialId);
            });
            loadSupplierOffers(projectId, !focusApplied ? initialMaterialId : 0, !focusApplied ? { supplierId: initialSupplierId, supplierName: initialSupplierName } : null);
            focusApplied = true;
        }
        if (projectSelect.dataset.bound !== '1') {
            projectSelect.dataset.bound = '1';
            projectSelect.addEventListener('change', loadCurrent);
        }
        if (formProjectSelect.dataset.bound !== '1') {
            formProjectSelect.dataset.bound = '1';
            formProjectSelect.addEventListener('change', function () {
                loadSupplierMaterials(Number(formProjectSelect.value), function (items) {
                    renderSuppliersContext(Number(formProjectSelect.value), items, Number(qs('[data-supplier-materials]') && qs('[data-supplier-materials]').value || 0));
                });
            });
        }
        bindSupplierCreateForm();
        loadCurrent();
    }

    function supplierProjectOptionLabel(project) {
        var title = String(project && project.title || '').trim();
        if (!title) return '\u041e\u0431\u044a\u0435\u043a\u0442';
        return title.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function setupSupplierCreateModal() {
        var modal = qs('[data-supplier-create-modal]');
        if (!modal || modal.dataset.bound === '1') return;
        modal.dataset.bound = '1';
        qsa('[data-supplier-create-open]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', openSupplierCreateModal);
        });
        qsa('[data-supplier-create-close]', modal).forEach(function (button) {
            button.addEventListener('click', closeSupplierCreateModal);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeSupplierCreateModal();
        });
    }

    function openSupplierCreateModal() {
        var modal = qs('[data-supplier-create-modal]');
        if (!modal) return;
        var error = qs('[data-supplier-create-error]', modal);
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        modal.classList.remove('hidden');
        document.body.classList.add('supplier-create-open');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            var first = qs('input, select, textarea, button', modal);
            if (first) first.focus();
        });
    }

    function closeSupplierCreateModal() {
        var modal = qs('[data-supplier-create-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.removeAttribute('data-open');
        document.body.classList.remove('supplier-create-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) modal.classList.add('hidden');
        }, 220);
    }

    function setupSupplierDetailModal() {
        var modal = qs('[data-supplier-detail-modal]');
        if (!modal || modal.dataset.bound === '1') return;
        modal.dataset.bound = '1';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-supplier-detail-close]')) closeSupplierDetailModal();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeSupplierDetailModal();
        });
    }

    function supplierOfferById(offerId) {
        offerId = Number(offerId || 0);
        return (state.supplierOffers || []).find(function (offer) {
            return Number(offer && offer.id || 0) === offerId;
        });
    }

    function supplierOfferStatusLabel(status) {
        var labels = {
            new: '\u041d\u043e\u0432\u044b\u0439',
            called: '\u041e\u0431\u0437\u0432\u043e\u043d\u0435\u043d',
            quoted: '\u041f\u0440\u043e\u0441\u0447\u0438\u0442\u0430\u043d',
            selected: '\u0412\u044b\u0431\u0440\u0430\u043d',
            rejected: '\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d'
        };
        return labels[status] || status || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d';
    }

    function supplierOfferSourceLabel(source) {
        var labels = {
            manual: '\u0420\u0443\u0447\u043d\u043e\u0439 \u0432\u0432\u043e\u0434',
            avito: 'Avito',
            other: '\u0414\u0440\u0443\u0433\u043e\u0439 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a'
        };
        return labels[source] || source || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d';
    }

    function supplierDetailItem(label, value) {
        return '<div class="supplier-detail-item"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e') + '</strong></div>';
    }

    function supplierOfferCompareText(offer) {
        var compare = offer && offer.compareToEstimate || {};
        var delta = typeof compare.deltaTotal === 'number' ? compare.deltaTotal : null;
        if (delta == null) return '\u0421\u043c\u0435\u0442\u0430 \u043d\u0435 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u0430';
        if (delta < 0) return '\u042d\u043a\u043e\u043d\u043e\u043c\u0438\u044f ' + money(Math.abs(delta));
        if (delta > 0) return '\u041f\u0435\u0440\u0435\u043f\u043b\u0430\u0442\u0430 ' + money(delta);
        return '\u0420\u043e\u0432\u043d\u043e \u043f\u043e \u0441\u043c\u0435\u0442\u0435';
    }

    function renderSupplierDetail(offer) {
        offer = offer || {};
        var name = offer.company_name || offer.candidate_name || '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442';
        var type = offer.candidate_type || 'supplier';
        var price = Number(offer.price || 0) ? money(Number(offer.price || 0)) : '';
        var qty = [offer.qty || '', offer.unit || ''].filter(Boolean).join(' ');
        return '<article class="supplier-detail-card">' +
            '<button class="ghost compact supplier-detail-close" type="button" data-supplier-detail-close>\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>' +
            '<div class="supplier-detail-head">' +
                '<div class="counterparty-avatar" aria-hidden="true"' + counterpartyAvatarStyle(name) + '>' + escapeHtml(counterpartyInitials(name)) + '</div>' +
                '<div><h3>' + escapeHtml(name) + '</h3><span class="counterparty-type-badge' + counterpartyTypeClass(type) + '">' + escapeHtml(counterpartyTypeLabel(type)) + '</span></div>' +
            '</div>' +
            '<div class="supplier-detail-grid">' +
                supplierDetailItem('\u0422\u0435\u043b\u0435\u0444\u043e\u043d', offer.phone || '') +
                supplierDetailItem('\u041a\u043e\u043d\u0442\u0430\u043a\u0442', offer.contact_name || '') +
                supplierDetailItem('\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f', offer.company_name || '') +
                supplierDetailItem('\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b / \u043f\u0440\u0435\u0434\u043c\u0435\u0442', offer.material_title || '') +
                supplierDetailItem('\u0421\u0442\u0430\u0442\u0443\u0441', supplierOfferStatusLabel(offer.status)) +
                supplierDetailItem('\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a', supplierOfferSourceLabel(offer.source_type)) +
                supplierDetailItem('\u0426\u0435\u043d\u0430', price) +
                supplierDetailItem('\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e', qty) +
                supplierDetailItem('\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435', supplierOfferCompareText(offer)) +
                supplierDetailItem('\u0410\u0432\u0442\u043e\u0440', offer.author_name || '') +
            '</div>' +
            (offer.source_url ? '<a class="supplier-detail-link" href="' + escapeHtml(offer.source_url) + '" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i><span>\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a</span></a>' : '') +
            '<section class="supplier-detail-notes"><h4>\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439</h4><p>' + escapeHtml(offer.notes || '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d.') + '</p></section>' +
        '</article>';
    }

    function openSupplierDetailModal(offerId) {
        var modal = qs('[data-supplier-detail-modal]');
        var offer = supplierOfferById(offerId);
        if (!modal || !offer) return;
        safeReplaceChildren(qs('[data-supplier-detail-body]', modal), renderSupplierDetail(offer));
        refreshLucideIcons(modal);
        modal.classList.remove('hidden');
        document.body.classList.add('supplier-detail-open');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
        });
    }

    function closeSupplierDetailModal() {
        var modal = qs('[data-supplier-detail-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.removeAttribute('data-open');
        document.body.classList.remove('supplier-detail-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) modal.classList.add('hidden');
        }, 200);
    }

    function fillSupplierCompanyOptions(companies) {
        var select = qs('[data-supplier-companies]');
        if (!select) return;
        var items = companies.filter(function (company) {
            return ['supplier', 'contractor'].indexOf(company.type) !== -1;
        });
        select.innerHTML = '<option value="">Без привязки</option>' + items.map(function (company) {
            return '<option value="' + company.id + '">' + escapeHtml(company.name) + '</option>';
        }).join('');
    }

    function applySupplierFormCompanyFocus(supplierId) {
        var select = qs('[data-supplier-companies]');
        if (!select || !supplierId) return;
        var value = String(supplierId);
        if (qsa('option', select).some(function (option) { return option.value === value; })) {
            select.value = value;
        }
    }

    function normalizeCounterpartyName(value) {
        return String(value || '').trim().toLowerCase();
    }

    function supplierOfferMatchesFocus(offer, focus) {
        if (!offer || !focus) return false;
        var supplierId = Number(focus.supplierId || 0);
        if (supplierId && Number(offer.company_id || offer.companyId || 0) === supplierId) return true;
        var supplierName = normalizeCounterpartyName(focus.supplierName);
        if (!supplierName) return false;
        return normalizeCounterpartyName(offer.company_name) === supplierName
            || normalizeCounterpartyName(offer.candidate_name) === supplierName;
    }

    function focusSupplierOfferRow(focus) {
        if (!focus) return;
        var row = null;
        if (focus.supplierId) {
            row = qs('[data-supplier-company-id="' + escapeHtml(focus.supplierId) + '"]');
        }
        if (!row && focus.supplierName) {
            row = qsa('[data-supplier-company-name]').find(function (node) {
                return normalizeCounterpartyName(node.getAttribute('data-supplier-company-name')) === normalizeCounterpartyName(focus.supplierName);
            }) || null;
        }
        if (!row) row = qs('.supplier-offer-row-focused');
        if (!row) return;
        row.classList.add('flash-highlight');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () {
            row.classList.remove('flash-highlight');
        }, 2000);
    }

    function loadSupplierMaterials(projectId, callback) {
        var select = qs('[data-supplier-materials]');
        if (!select) return;
        loadMaterials(projectId, function (items) {
            select.innerHTML = '<option value="">Без привязки к смете</option>' + items.map(function (item) {
                return '<option value="' + item.id + '">' + escapeHtml(item.title) + ' · сета ' + escapeHtml(item.plannedQty) + ' ' + escapeHtml(item.unit) + '</option>';
            }).join('');
            if (typeof callback === 'function') callback(items);
        });
    }

    function loadSupplierOffers(projectId, materialId, supplierFocus) {
        api('/api/projects/' + projectId + '/supplier-offers').then(function (data) {
            var offers = Array.isArray(data.offers) ? data.offers : [];
            state.supplierOffers = offers;
            renderSupplierStats(offers);
            renderSupplierList(projectId, offers, materialId, supplierFocus);
            bindSupplierCards();
            bindSupplierEditors(projectId);
            applySupplierFormCompanyFocus(supplierFocus && supplierFocus.supplierId);
            focusSupplierOfferRow(supplierFocus);
        }).catch(function () {
            var root = qs('[data-suppliers-list]');
            if (root) root.innerHTML = '<p class="muted">Не удалось загрузить предложения.</p>';
        });
    }

    function renderSuppliersContext(projectId, items, materialId) {
        var root = qs('[data-suppliers-context]');
        if (!root) return;
        root.hidden = true;
        root.innerHTML = '';
        return;
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) {
            root.hidden = true;
            root.innerHTML = '';
            return;
        }
        var material = materialId ? items.find(function (item) { return Number(item.id) === Number(materialId); }) : null;
        root.hidden = false;
        root.innerHTML =
            '<div class="project-group-head">' +
                '<div><span class="section-label">Связка объекта</span><h3>' + escapeHtml(project.title) + '</h3></div>' +
                '<div class="material-chain-actions">' +
                    '<a class="ghost material-link" href="/app/projects">К объектам</a>' +
                    '<a class="ghost material-link" href="/app/warehouse?projectId=' + projectId + (materialId ? '&materialId=' + materialId : '') + '">Склад</a>' +
                '</div>' +
            '</div>' +
            '<p class="muted">' + escapeHtml(
                material
                    ? 'Сейчас открыт контур закупки по позиции: ' + material.title + '. Здесь можно сравнить предложения, выбрать поставщика и вернуться к объекту уже с готовым решением.'
                    : 'Здесь собраны предложения по объекту. Можно быстро сравнить кандидатов, выбрать поставщика и не терять контекст закупки.'
            ) + '</p>' +
            '<div class="badge-list">' +
                '<span class="badge">' + escapeHtml(project.client_name || 'Без заказчика') + '</span>' +
                (material ? '<span class="badge warn">' + escapeHtml(material.title) + '</span>' : '') +
            '</div>';
    }

    function renderSupplierStats(offers) {
        var root = qs('[data-suppliers-stats]');
        if (!root) return;
        var selected = offers.filter(function (item) { return item.status === 'selected'; }).length;
        var quoted = offers.filter(function (item) { return item.status === 'quoted'; }).length;
        var called = offers.filter(function (item) { return item.status === 'called'; }).length;
        var avito = offers.filter(function (item) { return item.source_type === 'avito'; }).length;
        var bestSavings = offers.reduce(function (best, item) {
            var delta = item.compareToEstimate && typeof item.compareToEstimate.deltaTotal === 'number' ? item.compareToEstimate.deltaTotal : null;
            if (delta == null || delta >= 0) return best;
            return best == null || delta < best ? delta : best;
        }, null);
        root.innerHTML =
            stat('Предложений', String(offers.length)) +
            stat('Обзвонены', String(called), called ? 'warn' : '') +
            stat('Просчитаны', String(quoted), quoted ? 'warn' : '') +
            stat('Выбраны', String(selected), selected ? '' : 'warn') +
            stat('Avito', String(avito)) +
            stat('Лучшая экономия', bestSavings == null ? '—' : money(Math.abs(bestSavings)));
    }

    function renderSupplierList(projectId, offers, materialId, supplierFocus) {
        var root = qs('[data-suppliers-list]');
        if (!root) return;
        materialId = Number(materialId || 0);
        if (materialId) {
            offers = offers.slice().sort(function (left, right) {
                var leftMatch = Number(left.estimate_item_id || 0) === materialId ? 1 : 0;
                var rightMatch = Number(right.estimate_item_id || 0) === materialId ? 1 : 0;
                return rightMatch - leftMatch;
            });
        }
        if (!offers.length) {
            safeReplaceChildren(root, '<p class="muted">\u041f\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u0430\u043d\u0434\u0438\u0434\u0430\u0442\u043e\u0432. \u0414\u043e\u0431\u0430\u0432\u044c \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430 \u0438\u043b\u0438 \u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u0430 \u0441\u043f\u0440\u0430\u0432\u0430.</p>');
            return;
            root.innerHTML = '<p class="muted">По объекту пока нет кандидатов. Добавь первого поставщика или подрядчика справа.</p>';
            return;
        }
        safeReplaceChildren(root, '<div class="suppliers-list counterparties-grid">' + offers.map(function (offer) {
            var compare = offer.compareToEstimate || {};
            var delta = typeof compare.deltaTotal === 'number' ? compare.deltaTotal : null;
            var compareText = delta == null
                ? 'Смета не привязана'
                : (delta < 0 ? 'Экономия ' + money(Math.abs(delta)) : (delta > 0 ? 'Переплата ' + money(delta) : 'Ровно по смете'));
            var compareClass = delta == null ? '' : (delta > 0 ? 'danger' : '');
            var isFocused = materialId && Number(offer.estimate_item_id || 0) === materialId;
            if (supplierOfferMatchesFocus(offer, supplierFocus)) isFocused = true;
            return '<form class="supplier-offer-row counterparty-card' + (isFocused ? ' supplier-offer-row-focused' : '') + '" data-supplier-edit-form data-offer-id="' + offer.id + '" data-supplier-company-id="' + escapeHtml(offer.company_id || offer.companyId || '') + '" data-supplier-company-name="' + escapeHtml(offer.company_name || offer.candidate_name || '') + '">' +
                renderCounterpartyCard(offer, {
                    projectId: projectId,
                    offers: offers,
                    statText: counterpartyBindingStats(offer, offers, projectId)
                }).replace(/^<article class="counterparty-card">/, '').replace(/<\/article>$/, '') +
                '<div class="supplier-offer-main"><b>' + escapeHtml(offer.candidate_name) + '</b><small>' +
                    escapeHtml((offer.company_name || 'без компании') + ' • ' + (offer.material_title || 'без привязки к смете') + ' • ' + (offer.author_name || '')) +
                    (offer.source_url ? '<br><a href="' + escapeHtml(offer.source_url) + '" target="_blank" rel="noreferrer">Открыть источник</a>' : '') +
                '</small></div>' +
                '<select name="status">' +
                    '<option value="new"' + (offer.status === 'new' ? ' selected' : '') + '>Новый</option>' +
                    '<option value="called"' + (offer.status === 'called' ? ' selected' : '') + '>Обзвонен</option>' +
                    '<option value="quoted"' + (offer.status === 'quoted' ? ' selected' : '') + '>Просчитан</option>' +
                    '<option value="selected"' + (offer.status === 'selected' ? ' selected' : '') + '>Выбран</option>' +
                    '<option value="rejected"' + (offer.status === 'rejected' ? ' selected' : '') + '>Отклонен</option>' +
                '</select>' +
                '<input name="price" type="number" min="0" step="0.01" value="' + escapeHtml(offer.price || 0) + '">' +
                '<input name="qty" type="number" min="0" step="0.01" value="' + escapeHtml(offer.qty || 0) + '">' +
                '<input name="phone" value="' + escapeHtml(offer.phone || '') + '" placeholder="+7...">' +
                '<input name="source_url" value="' + escapeHtml(offer.source_url || '') + '" placeholder="Ссылка">' +
                '<input name="notes" value="' + escapeHtml(offer.notes || '') + '" placeholder="Комментарий">' +
                '<div class="supplier-offer-meta"><span class="badge ' + compareClass + '">' + escapeHtml(compareText) + '</span><button class="ghost" type="submit">Сохранить</button></div>' +
            '</form>';
        }).join('') + '</div>');
        refreshLucideIcons(root);
    }

    function renderSupplierCompactCard(offer, isFocused) {
        offer = offer || {};
        var name = offer.company_name || offer.candidate_name || '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442';
        var type = offer.candidate_type || 'supplier';
        var phone = offer.phone || '\u0422\u0435\u043b\u0435\u0444\u043e\u043d \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d';
        return '<button class="supplier-compact-card' + (isFocused ? ' supplier-offer-row-focused' : '') + '" type="button" data-supplier-card data-offer-id="' + escapeHtml(offer.id || '') + '" data-supplier-company-id="' + escapeHtml(offer.company_id || offer.companyId || '') + '" data-supplier-company-name="' + escapeHtml(name) + '">' +
            '<span class="supplier-compact-avatar" aria-hidden="true"' + counterpartyAvatarStyle(name) + '>' + escapeHtml(counterpartyInitials(name)) + '</span>' +
            '<span class="supplier-compact-main">' +
                '<strong>' + escapeHtml(name) + '</strong>' +
                '<span><i data-lucide="phone"></i>' + escapeHtml(phone) + '</span>' +
            '</span>' +
            '<span class="counterparty-type-badge' + counterpartyTypeClass(type) + '">' + escapeHtml(counterpartyTypeLabel(type)) + '</span>' +
        '</button>';
    }

    function renderSupplierList(projectId, offers, materialId, supplierFocus) {
        var root = qs('[data-suppliers-list]');
        if (!root) return;
        materialId = Number(materialId || 0);
        offers = Array.isArray(offers) ? offers : [];
        if (materialId) {
            offers = offers.slice().sort(function (left, right) {
                var leftMatch = Number(left.estimate_item_id || 0) === materialId ? 1 : 0;
                var rightMatch = Number(right.estimate_item_id || 0) === materialId ? 1 : 0;
                return rightMatch - leftMatch;
            });
        }
        if (!offers.length) {
            safeReplaceChildren(root, '<p class="muted">\u041f\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u0430\u043d\u0434\u0438\u0434\u0430\u0442\u043e\u0432. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 «\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442\u0430», \u0447\u0442\u043e\u0431\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0435\u0440\u0432\u043e\u0433\u043e.</p>');
            return;
        }
        safeReplaceChildren(root, '<div class="suppliers-list counterparties-grid suppliers-compact-grid">' + offers.map(function (offer) {
            var isFocused = materialId && Number(offer.estimate_item_id || 0) === materialId;
            if (supplierOfferMatchesFocus(offer, supplierFocus)) isFocused = true;
            return renderSupplierCompactCard(offer, isFocused);
        }).join('') + '</div>');
        refreshLucideIcons(root);
    }

    function bindSupplierCards() {
        qsa('[data-supplier-card]').forEach(function (card) {
            if (card.dataset.bound === '1') return;
            card.dataset.bound = '1';
            card.addEventListener('click', function () {
                openSupplierDetailModal(card.getAttribute('data-offer-id'));
            });
        });
    }

    function bindSupplierCreateForm() {
        var form = qs('[data-supplier-create-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-supplier-create-error]');
            if (error) error.classList.remove('active');
            var projectId = Number(form.project_id.value);
            api('/api/projects/' + projectId + '/supplier-offers', {
                method: 'POST',
                body: JSON.stringify({
                    candidate_type: form.candidate_type.value,
                    candidate_name: form.candidate_name.value.trim(),
                    company_id: form.company_id.value,
                    estimate_item_id: form.estimate_item_id.value,
                    source_type: form.source_type.value,
                    source_url: form.source_url.value.trim(),
                    contact_name: form.contact_name.value.trim(),
                    phone: form.phone.value.trim(),
                    price: Number(form.price.value || 0),
                    qty: Number(form.qty.value || 0),
                    unit: form.unit.value.trim(),
                    status: form.status.value,
                    notes: form.notes.value.trim()
                })
            }).then(function () {
                var keepProject = form.project_id.value;
                form.reset();
                form.project_id.value = keepProject;
                loadSupplierMaterials(Number(keepProject));
                loadSupplierOffers(Number(keepProject));
                closeSupplierCreateModal();
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить кандидата';
                    error.classList.add('active');
                }
            });
        });
    }

    function bindSupplierEditors(projectId) {
        qsa('[data-supplier-edit-form]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                api('/api/supplier-offers/' + form.dataset.offerId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        status: form.status.value,
                        price: Number(form.price.value || 0),
                        qty: Number(form.qty.value || 0),
                        phone: form.phone.value.trim(),
                        source_url: form.source_url.value.trim(),
                        notes: form.notes.value.trim()
                    })
                }).then(function () {
                    loadSupplierOffers(projectId);
                });
            });
        });
    }

    function collectDirectorReportData(callback) {
        loadProjects(function () {
            loadDashboard(function () {
                loadUserDirectory(function (users) {
                    Promise.all(state.projects.map(function (project) {
                        var base = '/api/projects/' + project.id;
                        return Promise.all([
                            api(base + '/notifications').catch(function () { return null; }),
                            api(base + '/tasks').catch(function () { return { tasks: [] }; }),
                            api(base + '/daily-logs').catch(function () { return { logs: [] }; }),
                            api(base + '/assignments').catch(function () { return { assignments: [] }; }),
                            api(base + '/stages').catch(function () { return { stages: [] }; })
                        ]).then(function (results) {
                            return {
                                project: project,
                                notifications: results[0] || {},
                                tasks: Array.isArray(results[1].tasks) ? results[1].tasks : [],
                                logs: Array.isArray(results[2].logs) ? results[2].logs : [],
                                assignments: Array.isArray(results[3].assignments) ? results[3].assignments : [],
                                stages: Array.isArray(results[4].stages) ? results[4].stages : []
                            };
                        });
                    })).then(function (groups) {
                        callback({
                            dashboard: state.dashboard || {},
                            users: users || [],
                            groups: groups
                        });
                    });
                });
            });
        });
    }

    function renderReportsFocus(data) {
        var root = qs('[data-report-focus]');
        if (!root) return;
        var actions = data && Array.isArray(data.todayActions) ? data.todayActions : [];
        root.innerHTML = actions.length
            ? actions.map(function (item, index) {
                return '<div class="notice-card"><b>' + escapeHtml((index + 1) + '. ' + item) + '</b><small>Оперативный фокус директора на ' + escapeHtml(formatRuDate(APP_TODAY)) + '.</small></div>';
            }).join('')
            : '<p class="muted">На ' + escapeHtml(formatRuDate(APP_TODAY)) + ' критичных действий не выделено.</p>';
    }

    function collectDirectorDigestRows(groups) {
        return groups.map(function (group) {
            var notifications = group.notifications || {};
            var overdueTasks = Array.isArray(notifications.overdueTasks) ? notifications.overdueTasks.length : 0;
            var blockers = Array.isArray(notifications.blockerLogs) ? notifications.blockerLogs.length : 0;
            var problemStages = Array.isArray(notifications.problemStages) ? notifications.problemStages.length : 0;
            var latestLog = notifications.latestDailyLog;
            var nextDate = collectUrgentDate(group);
            return {
                projectTitle: group.project.title,
                clientName: group.project.client_name || 'Без заказчика',
                missingDailyReport: notifications.missingDailyReport ? 'Да' : 'Нет',
                overdueTasks: overdueTasks,
                blockers: blockers,
                problemStages: problemStages,
                latestLogDate: latestLog && latestLog.report_date ? latestLog.report_date : '—',
                nextDate: nextDate || '—',
                score: (notifications.missingDailyReport ? 4 : 0) + overdueTasks * 3 + blockers * 4 + problemStages * 2
            };
        }).sort(function (a, b) {
            return b.score - a.score;
        });
    }

    function collectDirectorDeadlineRows(groups) {
        var today = APP_TODAY;
        var horizon = isoDateAdd(APP_TODAY, 13);
        var items = [];
        groups.forEach(function (group) {
            if (group.project.deadline_at && group.project.deadline_at <= horizon) {
                items.push({
                    date: group.project.deadline_at,
                    projectTitle: group.project.title,
                    title: 'Дедлайн объекта',
                    meta: group.project.client_name || 'Объект',
                    kind: group.project.deadline_at < today ? 'danger' : ''
                });
            }
            group.tasks.forEach(function (task) {
                if (task.status !== 'done' && task.due_at && task.due_at <= horizon) {
                    items.push({
                        date: task.due_at,
                        projectTitle: group.project.title,
                        title: task.title,
                        meta: 'Задача' + (task.assignee_name ? ' • ' + task.assignee_name : ''),
                        kind: task.due_at < today ? 'danger' : (task.priority === 'high' ? 'warn' : '')
                    });
                }
            });
            group.stages.forEach(function (stage) {
                if (stage.planned_end && percent(stage.progress) < 100 && stage.planned_end <= horizon) {
                    items.push({
                        date: stage.planned_end,
                        projectTitle: group.project.title,
                        title: stage.title,
                        meta: 'Этап' + (stage.responsible ? ' • ' + stage.responsible : ''),
                        kind: stage.planned_end < today || stage.status_code === 'blocked' ? 'danger' : ''
                    });
                }
            });
        });
        return items.sort(function (a, b) {
            if (a.date === b.date) return a.projectTitle.localeCompare(b.projectTitle);
            return a.date < b.date ? -1 : 1;
        }).slice(0, 20);
    }

    function collectDirectorPeopleRows(groups, users) {
        var people = {};
        users.forEach(function (user) {
            people[user.id] = {
                id: user.id,
                name: user.name,
                roles: Array.isArray(user.roles) ? user.roles.map(function (role) { return role.name || role.code; }) : [],
                projects: {},
                reportsToday: 0,
                openTasks: 0,
                overdueTasks: 0,
                missingReports: 0,
                blockerProjects: 0
            };
        });
        groups.forEach(function (group) {
            var notifications = group.notifications || {};
            var foremen = group.assignments.filter(function (item) { return item.roleCode === 'foreman'; });
            group.assignments.forEach(function (assignment) {
                if (!people[assignment.userId]) return;
                people[assignment.userId].projects[group.project.id] = group.project.title;
            });
            group.tasks.forEach(function (task) {
                if (!task.assignee_id || !people[task.assignee_id] || task.status === 'done') return;
                people[task.assignee_id].projects[group.project.id] = group.project.title;
                people[task.assignee_id].openTasks += 1;
                if (task.due_at && task.due_at < APP_TODAY) people[task.assignee_id].overdueTasks += 1;
            });
            group.logs.forEach(function (log) {
                if (log.created_by && people[log.created_by] && log.report_date === APP_TODAY) {
                    people[log.created_by].projects[group.project.id] = group.project.title;
                    people[log.created_by].reportsToday += 1;
                }
            });
            if (notifications.missingDailyReport) {
                foremen.forEach(function (item) {
                    if (people[item.userId]) {
                        people[item.userId].projects[group.project.id] = group.project.title;
                        people[item.userId].missingReports += 1;
                    }
                });
            }
            if (Array.isArray(notifications.blockerLogs) && notifications.blockerLogs.length) {
                foremen.forEach(function (item) {
                    if (people[item.userId]) {
                        people[item.userId].projects[group.project.id] = group.project.title;
                        people[item.userId].blockerProjects += 1;
                    }
                });
            }
        });
        return Object.keys(people).map(function (key) { return people[key]; }).filter(function (item) {
            return Object.keys(item.projects).length || item.openTasks || item.reportsToday || item.missingReports || item.blockerProjects;
        }).sort(function (a, b) {
            var left = a.overdueTasks * 3 + a.missingReports * 3 + a.blockerProjects * 2 + a.openTasks;
            var right = b.overdueTasks * 3 + b.missingReports * 3 + b.blockerProjects * 2 + b.openTasks;
            return right - left;
        });
    }

    function bindReportExports() {
        qsa('[data-report-export]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var bundle = state.reportsBundle;
                if (!bundle) return;
                var kind = button.dataset.reportExport;
                if (kind === 'digest') {
                    var digestRows = collectDirectorDigestRows(bundle.groups);
                    downloadCsv('director-digest-' + APP_TODAY + '.csv', [['Объект', 'Заказчик', 'Нет отчета сегодня', 'Просроченных задач', 'Блокеров', 'Проблемных этапов', 'Последний отчет', 'Ближайшая дата']].concat(digestRows.map(function (item) {
                        return [item.projectTitle, item.clientName, item.missingDailyReport, item.overdueTasks, item.blockers, item.problemStages, item.latestLogDate, item.nextDate];
                    })));
                } else if (kind === 'deadlines') {
                    var deadlineRows = collectDirectorDeadlineRows(bundle.groups);
                    downloadCsv('director-deadlines-' + APP_TODAY + '.csv', [['Дата', 'Объект', 'Позиция', 'Тип/метка', 'Статус']].concat(deadlineRows.map(function (item) {
                        return [item.date, item.projectTitle, item.title, item.meta, item.kind === 'danger' ? 'Просрочено/риск' : 'В плане'];
                    })));
                } else if (kind === 'people') {
                    var peopleRows = collectDirectorPeopleRows(bundle.groups, bundle.users);
                    downloadCsv('director-people-' + APP_TODAY + '.csv', [['Сотрудник', 'Роли', 'Объектов', 'Отчетов сегодня', 'Открытых задач', 'Просрочено', 'Без отчета', 'С блокерами']].concat(peopleRows.map(function (item) {
                        return [item.name, item.roles.join(', '), Object.keys(item.projects).length, item.reportsToday, item.openTasks, item.overdueTasks, item.missingReports, item.blockerProjects];
                    })));
                }
            });
        });
    }

    function initReportsPage() {
        collectDirectorReportData(function (bundle) {
            state.reportsBundle = bundle;
            renderReportsFocus(bundle.dashboard);
            renderReportsStats(bundle.dashboard);
            renderReportsCritical(bundle.dashboard);
            renderDirectorDigest(bundle.groups);
            renderDirectorDeadlines(bundle.groups);
            renderDirectorPeople(bundle.groups, bundle.users);
            renderReportsNarrative(bundle.dashboard, bundle.groups);
            bindReportExports();
        });
    }

    function renderReportsStats(data) {
        var stats = qs('[data-dashboard-stats]');
        if (!stats) return;
        stats.innerHTML =
            stat('Объектов', data.projectsCount || 0) +
            stat('В работе', data.activeProjects || 0) +
            stat('Средний прогресс', (data.avgProgress || 0) + '%') +
            stat('Нехватки', data.shortagesCount || 0, data.shortagesCount ? 'danger' : '') +
            stat('Открытые задачи', data.openTasksCount || 0, data.openTasksCount ? 'warn' : '') +
            stat('Бюджет', data.totalBudget == null ? 'Скрыто' : money(data.totalBudget)) +
            stat('Оплачено', data.totalPaid == null ? 'Скрыто' : money(data.totalPaid)) +
            stat('Маржа сейчас', data.profitNow == null ? 'Скрыто' : money(data.profitNow), data.profitNow < 0 ? 'danger' : '');
    }

    function renderReportsCritical(data) {
        var critical = qs('[data-dashboard-critical]');
        if (!critical) return;
        var items = Array.isArray(data.criticalItems) ? data.criticalItems : [];
        critical.innerHTML = items.length
            ? '<div class="materials-list">' + items.map(function (item) {
                return '<div class="material-row"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + '</small></div><span class="badge danger">Не хватает ' + escapeHtml(item.missingQty) + ' ' + escapeHtml(item.unit) + '</span></div>';
            }).join('') + '</div>'
            : '<p class="muted">Критичных нехваток нет.</p>';
    }

    function renderDirectorDigest(groups) {
        var root = qs('[data-report-digest]');
        if (!root) return;
        if (!groups.length) {
            root.innerHTML = '<p class="muted">Нет объектов для ежедневной сводки.</p>';
            return;
        }
        var rows = groups.map(function (group) {
            var notifications = group.notifications || {};
            var overdueTasks = Array.isArray(notifications.overdueTasks) ? notifications.overdueTasks.length : 0;
            var blockers = Array.isArray(notifications.blockerLogs) ? notifications.blockerLogs.length : 0;
            var problemStages = Array.isArray(notifications.problemStages) ? notifications.problemStages.length : 0;
            var latestLog = notifications.latestDailyLog;
            var nextDate = collectUrgentDate(group);
            var score = (notifications.missingDailyReport ? 4 : 0) + overdueTasks * 3 + blockers * 4 + problemStages * 2;
            return {
                score: score,
                html: '<div class="report-project-row">' +
                    '<div><b>' + escapeHtml(group.project.title) + '</b><small>' + escapeHtml(group.project.client_name || 'Без заказчика') + (nextDate ? ' • ближайшая дата: ' + escapeHtml(nextDate) : '') + '</small></div>' +
                    '<div><span class="badge ' + (notifications.missingDailyReport ? 'danger' : '') + '">' + (notifications.missingDailyReport ? 'Нет отчета' : 'Отчет есть') + '</span></div>' +
                    '<div><strong>' + overdueTasks + '</strong><small>просроченных задач</small></div>' +
                    '<div><strong>' + blockers + '</strong><small>блокеров</small></div>' +
                    '<div><strong>' + problemStages + '</strong><small>проблемных этапов</small></div>' +
                    '<div><strong>' + escapeHtml(latestLog && latestLog.report_date ? latestLog.report_date : '—') + '</strong><small>последний отчет</small></div>' +
                '</div>'
            };
        }).sort(function (a, b) { return b.score - a.score; });
        root.innerHTML = rows.map(function (item) { return item.html; }).join('');
    }

    function renderDirectorDeadlines(groups) {
        var root = qs('[data-report-deadlines]');
        if (!root) return;
        var today = APP_TODAY;
        var horizon = '2026-08-09';
        var items = [];
        groups.forEach(function (group) {
            if (group.project.deadline_at && group.project.deadline_at <= horizon) {
                items.push({
                    date: group.project.deadline_at,
                    projectTitle: group.project.title,
                    title: 'Дедлайн объекта',
                    meta: group.project.client_name || 'Объект',
                    kind: group.project.deadline_at < today ? 'danger' : ''
                });
            }
            group.tasks.forEach(function (task) {
                if (task.status !== 'done' && task.due_at && task.due_at <= horizon) {
                    items.push({
                        date: task.due_at,
                        projectTitle: group.project.title,
                        title: task.title,
                        meta: 'Задача' + (task.assignee_name ? ' • ' + task.assignee_name : ''),
                        kind: task.due_at < today ? 'danger' : (task.priority === 'high' ? 'warn' : '')
                    });
                }
            });
            group.stages.forEach(function (stage) {
                if (stage.planned_end && percent(stage.progress) < 100 && stage.planned_end <= horizon) {
                    items.push({
                        date: stage.planned_end,
                        projectTitle: group.project.title,
                        title: stage.title,
                        meta: 'Этап' + (stage.responsible ? ' • ' + stage.responsible : ''),
                        kind: stage.planned_end < today || stage.status_code === 'blocked' ? 'danger' : ''
                    });
                }
            });
        });
        items = items.sort(function (a, b) {
            if (a.date === b.date) return a.projectTitle.localeCompare(b.projectTitle);
            return a.date < b.date ? -1 : 1;
        }).slice(0, 20);
        root.innerHTML = items.length
            ? items.map(function (item) {
                return '<div class="deadline-row">' +
                    '<span class="deadline-date">' + escapeHtml(item.date || '—') + '</span>' +
                    '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + '</small></div>' +
                    '<div><small>' + escapeHtml(item.meta) + '</small></div>' +
                    '<span class="badge ' + item.kind + '">' + (item.date < today ? 'Просрочено' : 'В плане') + '</span>' +
                '</div>';
            }).join('')
            : '<p class="muted">На ближайшие две недели критичных сроков не найдено.</p>';
    }

    function renderDirectorPeople(groups, users) {
        var root = qs('[data-report-people]');
        if (!root) return;
        var people = {};
        users.forEach(function (user) {
            people[user.id] = {
                id: user.id,
                name: user.name,
                roles: Array.isArray(user.roles) ? user.roles.map(function (role) { return role.name || role.code; }) : [],
                projects: {},
                reportsToday: 0,
                openTasks: 0,
                overdueTasks: 0,
                missingReports: 0,
                blockerProjects: 0
            };
        });
        groups.forEach(function (group) {
            var notifications = group.notifications || {};
            var foremen = group.assignments.filter(function (item) { return item.roleCode === 'foreman'; });
            group.assignments.forEach(function (assignment) {
                if (!people[assignment.userId]) return;
                people[assignment.userId].projects[group.project.id] = group.project.title;
            });
            group.tasks.forEach(function (task) {
                if (!task.assignee_id || !people[task.assignee_id] || task.status === 'done') return;
                people[task.assignee_id].projects[group.project.id] = group.project.title;
                people[task.assignee_id].openTasks += 1;
                if (task.due_at && task.due_at < APP_TODAY) people[task.assignee_id].overdueTasks += 1;
            });
            group.logs.forEach(function (log) {
                if (log.created_by && people[log.created_by] && log.report_date === APP_TODAY) {
                    people[log.created_by].projects[group.project.id] = group.project.title;
                    people[log.created_by].reportsToday += 1;
                }
            });
            if (notifications.missingDailyReport) {
                foremen.forEach(function (item) {
                    if (people[item.userId]) {
                        people[item.userId].projects[group.project.id] = group.project.title;
                        people[item.userId].missingReports += 1;
                    }
                });
            }
            if (Array.isArray(notifications.blockerLogs) && notifications.blockerLogs.length) {
                foremen.forEach(function (item) {
                    if (people[item.userId]) {
                        people[item.userId].projects[group.project.id] = group.project.title;
                        people[item.userId].blockerProjects += 1;
                    }
                });
            }
        });
        var rows = Object.keys(people).map(function (key) { return people[key]; }).filter(function (item) {
            return Object.keys(item.projects).length || item.openTasks || item.reportsToday || item.missingReports || item.blockerProjects;
        }).sort(function (a, b) {
            var left = a.overdueTasks * 3 + a.missingReports * 3 + a.blockerProjects * 2 + a.openTasks;
            var right = b.overdueTasks * 3 + b.missingReports * 3 + b.blockerProjects * 2 + b.openTasks;
            return right - left;
        });
        root.innerHTML = rows.length
            ? rows.map(function (item) {
                var projectsCount = Object.keys(item.projects).length;
                return '<div class="people-row">' +
                    '<div><b>' + escapeHtml(item.name) + '</b><small>' + escapeHtml((item.roles[0] || 'Сотрудник') + ' • объектов: ' + projectsCount) + '</small></div>' +
                    '<div><strong>' + item.reportsToday + '</strong><small>отчетов сегодня</small></div>' +
                    '<div><strong>' + item.openTasks + '</strong><small>открытых задач</small></div>' +
                    '<div><strong>' + item.overdueTasks + '</strong><small>просрочено</small></div>' +
                    '<div><strong>' + item.missingReports + '</strong><small>без отчета</small></div>' +
                    '<div><strong>' + item.blockerProjects + '</strong><small>с блокерами</small></div>' +
                '</div>';
            }).join('')
            : '<p class="muted">Пока нет данных для среза по людям.</p>';
    }

    function renderReportsNarrative(data, groups) {
        var ai = qs('[data-dashboard-ai]');
        if (!ai) return;
        var missingReports = groups.filter(function (group) {
            return group.notifications && group.notifications.missingDailyReport;
        }).length;
        var overdueTasks = groups.reduce(function (sum, group) {
            return sum + ((group.notifications && group.notifications.overdueTasks) ? group.notifications.overdueTasks.length : 0);
        }, 0);
        var blockerProjects = groups.filter(function (group) {
            return group.notifications && group.notifications.blockerLogs && group.notifications.blockerLogs.length;
        }).length;
        if (missingReports || overdueTasks || blockerProjects || data.shortagesCount) {
            ai.textContent = '\u041d\u0430 26 \u0438\u044e\u043b\u044f 2026 \u0444\u043e\u043a\u0443\u0441 \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440\u0430 \u0442\u0430\u043a\u043e\u0439: \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0431\u0435\u0437 \u043e\u0442\u0447\u0435\u0442\u0430 \u2014 ' + missingReports + ', \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447 \u2014 ' + overdueTasks + ', \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0441 \u0431\u043b\u043e\u043a\u0435\u0440\u0430\u043c\u0438 \u2014 ' + blockerProjects + ', \u043a\u0440\u0438\u0442\u0438\u0447\u043d\u044b\u0445 \u043d\u0435\u0445\u0432\u0430\u0442\u043e\u043a \u2014 ' + (data.shortagesCount || 0) + '. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u044c \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u043e\u0442\u0447\u0435\u0442\u044b \u0438 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u043a\u0438, \u0437\u0430\u0442\u0435\u043c \u043f\u0440\u043e\u0439\u0442\u0438\u0441\u044c \u043f\u043e \u0431\u043b\u043e\u043a\u0435\u0440\u0430\u043c \u0438 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0430\u043c.';
            return;
        }
        ai.textContent = '\u041d\u0430 26 \u0438\u044e\u043b\u044f 2026 \u043a\u0440\u0438\u0442\u0438\u0447\u043d\u044b\u0445 \u043f\u0440\u043e\u0441\u0430\u0434\u043e\u043a \u043d\u0435 \u0432\u0438\u0434\u043d\u043e. \u0424\u043e\u043a\u0443\u0441 \u0434\u043d\u044f \u2014 \u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u0443\u044e \u0434\u0438\u0441\u0446\u0438\u043f\u043b\u0438\u043d\u0443: \u043e\u0442\u0447\u0435\u0442\u044b, \u0441\u0440\u043e\u043a\u0438 \u0437\u0430\u0434\u0430\u0447 \u0438 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0444\u0430\u043a\u0442\u0430 \u043f\u043e \u044d\u0442\u0430\u043f\u0430\u043c.';
    }

    function renderDirectorDigest(groups) {
        var root = qs('[data-report-digest]');
        if (!root) return;
        if (!groups.length) {
            root.innerHTML = '<p class="muted">Нет объектов для ежедневной сводки.</p>';
            return;
        }
        var rows = collectDirectorDigestRows(groups);
        root.innerHTML = rows.map(function (item) {
            return '<div class="report-project-row">' +
                '<div><b>' + escapeHtml(item.projectTitle) + '</b><small>' + escapeHtml(item.clientName) + (item.nextDate !== '—' ? ' • ближайшая дата: ' + escapeHtml(item.nextDate) : '') + '</small></div>' +
                '<div><span class="badge ' + (item.missingDailyReport === 'Да' ? 'danger' : '') + '">' + (item.missingDailyReport === 'Да' ? 'Нет отчета' : 'Отчет есть') + '</span></div>' +
                '<div><strong>' + item.overdueTasks + '</strong><small>просроченных задач</small></div>' +
                '<div><strong>' + item.blockers + '</strong><small>блокеров</small></div>' +
                '<div><strong>' + item.problemStages + '</strong><small>проблемных этапов</small></div>' +
                '<div><strong>' + escapeHtml(item.latestLogDate) + '</strong><small>последний отчет</small></div>' +
            '</div>';
        }).join('');
    }

    function renderDirectorDeadlines(groups) {
        var root = qs('[data-report-deadlines]');
        if (!root) return;
        var today = APP_TODAY;
        var items = collectDirectorDeadlineRows(groups);
        root.innerHTML = items.length
            ? items.map(function (item) {
                return '<div class="deadline-row">' +
                    '<span class="deadline-date">' + escapeHtml(item.date || '—') + '</span>' +
                    '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + '</small></div>' +
                    '<div><small>' + escapeHtml(item.meta) + '</small></div>' +
                    '<span class="badge ' + item.kind + '">' + (item.date < today ? 'Просрочено' : 'В плане') + '</span>' +
                '</div>';
            }).join('')
            : '<p class="muted">На ближайшие две недели критичных сроков не найдено.</p>';
    }

    function renderDirectorPeople(groups, users) {
        var root = qs('[data-report-people]');
        if (!root) return;
        var rows = collectDirectorPeopleRows(groups, users);
        root.innerHTML = rows.length
            ? rows.map(function (item) {
                var projectsCount = Object.keys(item.projects).length;
                return '<div class="people-row">' +
                    '<div><b>' + escapeHtml(item.name) + '</b><small>' + escapeHtml((item.roles[0] || 'Сотрудник') + ' • объектов: ' + projectsCount) + '</small></div>' +
                    '<div><strong>' + item.reportsToday + '</strong><small>отчетов сегодня</small></div>' +
                    '<div><strong>' + item.openTasks + '</strong><small>открытых задач</small></div>' +
                    '<div><strong>' + item.overdueTasks + '</strong><small>просрочено</small></div>' +
                    '<div><strong>' + item.missingReports + '</strong><small>без отчета</small></div>' +
                    '<div><strong>' + item.blockerProjects + '</strong><small>с блокерами</small></div>' +
                '</div>';
            }).join('')
            : '<p class="muted">Пока нет данных для среза по людям.</p>';
    }

    function renderReportsNarrative(data, groups) {
        var ai = qs('[data-dashboard-ai]');
        if (!ai) return;
        var labelDate = formatRuDate(APP_TODAY);
        var missingReports = groups.filter(function (group) {
            return group.notifications && group.notifications.missingDailyReport;
        }).length;
        var overdueTasks = groups.reduce(function (sum, group) {
            return sum + ((group.notifications && group.notifications.overdueTasks) ? group.notifications.overdueTasks.length : 0);
        }, 0);
        var blockerProjects = groups.filter(function (group) {
            return group.notifications && group.notifications.blockerLogs && group.notifications.blockerLogs.length;
        }).length;
        if (missingReports || overdueTasks || blockerProjects || data.shortagesCount) {
            ai.textContent = 'На ' + labelDate + ' фокус директора такой: объектов без отчета — ' + missingReports + ', просроченных задач — ' + overdueTasks + ', объектов с блокерами — ' + blockerProjects + ', критичных нехваток — ' + (data.shortagesCount || 0) + '. Сначала закрыть ежедневные отчеты и просрочки, затем пройтись по блокерам и материалам.';
            return;
        }
        ai.textContent = 'На ' + labelDate + ' критичных просадок не видно. Фокус дня — держать ежедневную дисциплину: отчеты, сроки задач и подтверждение факта по этапам.';
    }

    function collectUrgentDate(group) {

        var dates = [];
        if (group.project.deadline_at) dates.push(group.project.deadline_at);
        group.tasks.forEach(function (task) {
            if (task.status !== 'done' && task.due_at) dates.push(task.due_at);
        });
        group.stages.forEach(function (stage) {
            if (stage.planned_end && percent(stage.progress) < 100) dates.push(stage.planned_end);
        });
        dates = dates.filter(Boolean).sort();
        return dates.length ? dates[0] : '';
    }

    function renderTaskAlerts(notifications) {
        if (!notifications) return '';
        var cards = [];
        if (notifications.missingDailyReport) {
            cards.push('<article class="notice-card notice-warn"><b>Нет отчета за ' + escapeHtml(APP_TODAY) + '</b><small>По объекту еще не сохранен дневной отчет за сегодня.</small></article>');
        }
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            cards.push('<article class="notice-card notice-danger"><b>Просроченные задачи: ' + notifications.overdueTasks.length + '</b><small>Нужно обновить статусы или сдвинуть срок.</small></article>');
        }
        if (notifications.problemStages && notifications.problemStages.length) {
            cards.push('<article class="notice-card"><b>Проблемные этапы: ' + notifications.problemStages.length + '</b><small>Есть блокировки или отставание по сроку.</small></article>');
        }
        return cards.length ? '<section class="notice-grid">' + cards.join('') + '</section>' : '';
    }

    function renderWarehouseForecast(items) {
        var root = qs('[data-warehouse-forecast]');
        if (!root) return;
        var required = items.filter(function (item) { return item.supplyStatus === 'required'; });
        var soon = items.filter(function (item) { return item.supplyStatus === 'soon'; });
        var planned = items.filter(function (item) { return item.supplyStatus === 'planned'; });
        var safe = items.filter(function (item) { return item.supplyStatus === 'in_stock'; });
        var urgentRows = required.concat(soon).sort(function (a, b) {
            return String(a.needByDate || '9999-12-31').localeCompare(String(b.needByDate || '9999-12-31'));
        }).slice(0, 8);
        root.innerHTML =
            '<section class="notice-grid">' +
                '<article class="notice-card notice-danger"><b>Требуется сейчас: ' + required.length + '</b><small>Материалы с нехваткой и датой потребности уже на ' + escapeHtml(APP_TODAY) + '.</small></article>' +
                '<article class="notice-card notice-warn"><b>Скоро потребуется: ' + soon.length + '</b><small>Позиции, которые понадобятся в ближайшие дни.</small></article>' +
                '<article class="notice-card"><b>Нужно запланировать: ' + planned.length + '</b><small>Материалы без даты потребности или без привязки к этапу.</small></article>' +
                '<article class="notice-card"><b>Есть в наличии: ' + safe.length + '</b><small>Закрытые позиции без нехватки по смете.</small></article>' +
            '</section>' +
            (urgentRows.length
                ? '<div class="materials-list">' + urgentRows.map(function (item) {
                    return '<div class="material-row"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + ' • нужно к ' + escapeHtml(item.needByDate || 'без даты') + (item.stageTitle ? ' • этап: ' + escapeHtml(item.stageTitle) : '') + '</small></div><span class="badge ' + planningStatusClass(item.supplyStatus) + '">' + escapeHtml(item.supplyLabel) + '</span></div>';
                }).join('') + '</div>'
                : '<p class="muted">Критичных материалов на сегодня не видно.</p>');
    }

    function renderLogsAlerts(notifications) {
        var root = qs('[data-logs-alerts]');
        if (!root) return;
        if (!notifications) {
            root.innerHTML = '';
            return;
        }
        var cards = [];
        if (notifications.missingDailyReport) {
            cards.push('<article class="notice-card notice-warn"><b>Сегодняшний отчет еще не сдан</b><small>На ' + escapeHtml(formatRuDate(APP_TODAY)) + ' по объекту нет дневного отчета.</small></article>');
        }
        if (notifications.blockerLogs && notifications.blockerLogs.length) {
            var latestBlocker = notifications.blockerLogs[0];
            cards.push('<article class="notice-card notice-danger"><b>Есть блокеры в работах</b><small>' + escapeHtml((latestBlocker.report_date || 'без даты') + ': ' + (latestBlocker.blockers || 'описание не указано')) + '</small></article>');
        }
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            cards.push('<article class="notice-card"><b>Просроченные задачи: ' + notifications.overdueTasks.length + '</b><small>Их стоит разобрать вместе с отчетом за день.</small></article>');
        }
        root.innerHTML = cards.length ? cards.join('') : '';
    }

    function docTypeLabel(type) {
        return {
            contract: 'Договор',
            act: 'Акт',
            hidden_work_act: 'Акт скрытых работ',
            inspection_act: 'Акт осмотра',
            estimate: 'Смета',
            project_doc: 'Проектная документация',
            executive: 'Исполнительная документация',
            technical_solution: 'Техрешение',
            letter: 'Письмо',
            correspondence: 'Переписка',
            invoice: 'Счет',
            archive: 'Архив',
            photo_report: 'Фотоотчет',
            finance: 'Финансы',
            other: 'Другое',
            file: 'Файл'
        }[type] || type || 'Документ';
    }

    function renderDocumentRow(doc) {
        var meta = [
            docTypeLabel(doc.doc_type),
            statusLabel(doc.status),
            doc.stage_title ? ('этап: ' + doc.stage_title) : '',
            doc.original_name || '',
            doc.size_bytes ? formatBytes(doc.size_bytes) : '',
            doc.uploaded_by_name || '',
            doc.is_client_visible ? 'Видно заказчику' : 'Внутренний'
        ].filter(Boolean).join(' • ');
        var actions = doc.storage_path
            ? ((doc.can_preview ? '<a class="ghost" href="' + escapeHtml(doc.view_url) + '" target="_blank" rel="noreferrer">Открыть</a>' : '') +
               '<a class="ghost" href="' + escapeHtml(doc.download_url) + '" target="_blank" rel="noreferrer">Скачать</a>')
            : '<span class="muted">Черновик без файла</span>';
        return '<div class="document-row">' +
            '<div><b>' + escapeHtml(doc.title) + '</b><small>' + escapeHtml(meta) + (doc.notes ? '<br>' + escapeHtml(doc.notes) : '') + '</small></div>' +
            '<div class="document-actions">' + actions + '</div>' +
        '</div>';
    }

    function renderDocumentUpload(projectId) {
        if (hasRole('customer')) return '';
        var stages = (state.stagesByProject && state.stagesByProject[projectId]) ? state.stagesByProject[projectId] : [];
        var stageOptions = '<option value="">Без этапа</option>' + stages.filter(function (stage) {
            return stage.stage_kind !== 'section';
        }).map(function (stage) {
            return '<option value="' + stage.id + '">' + escapeHtml(stage.title) + '</option>';
        }).join('');
        return '<form class="document-upload-form" data-document-upload-form data-project-id="' + projectId + '">' +
            '<div class="card-head"><h3>Загрузить документ</h3></div>' +
            '<input name="file" type="file" required>' +
            '<input name="title" placeholder="Название документа">' +
            '<select name="doc_type">' +
                '<option value="contract">Договор</option>' +
                '<option value="estimate">Смета</option>' +
                '<option value="project_doc">Проектная документация</option>' +
                '<option value="hidden_work_act">Акт скрытых работ</option>' +
                '<option value="inspection_act">Акт осмотра</option>' +
                '<option value="executive">Исполнительная документация</option>' +
                '<option value="technical_solution">Техрешение</option>' +
                '<option value="act">Акт</option>' +
                '<option value="invoice">Счет</option>' +
                '<option value="photo_report">Фотоотчет</option>' +
                '<option value="correspondence">Переписка</option>' +
                '<option value="archive">Архив</option>' +
                '<option value="finance">Финансы</option>' +
                '<option value="other">Другое</option>' +
            '</select>' +
            '<select name="stage_id">' + stageOptions + '</select>' +
            '<select name="status">' +
                '<option value="draft">Черновик</option>' +
                '<option value="reviewed">Проверен</option>' +
                '<option value="approved">Утвержден</option>' +
                '<option value="signed">Подписан</option>' +
                '<option value="internal">Внутренний</option>' +
                '<option value="ready">Готов</option>' +
            '</select>' +
            '<input name="notes" placeholder="Комментарий или примечание">' +
            '<label class="check-inline"><input type="checkbox" name="is_client_visible" value="1"> Видно заказчику</label>' +
            '<button class="primary" type="submit">Загрузить</button>' +
            '<div class="form-error" data-document-upload-error></div>' +
        '</form>';
    }

    function renderExecutiveSummary(summary) {
        if (!summary) return '';
        return '<section class="executive-summary">' +
            '<div class="executive-stat"><span>Этапов в контуре</span><strong>' + escapeHtml(summary.stages) + '</strong></div>' +
            '<div class="executive-stat"><span>Нужно закрыть</span><strong>' + escapeHtml(summary.required) + '</strong></div>' +
            '<div class="executive-stat"><span>Уже готово</span><strong>' + escapeHtml(summary.ready) + '</strong></div>' +
            '<div class="executive-stat executive-stat-' + (summary.missing ? 'warn' : 'ok') + '"><span>Осталось</span><strong>' + escapeHtml(summary.missing) + '</strong></div>' +
        '</section>';
    }

    function renderExecutiveChecklist(data) {
        if (!data || !Array.isArray(data.checklist) || !data.checklist.length) {
            return '<section class="subsection"><div class="card-head"><h3>Исполнительная документация</h3></div><p class="muted">Для текущих этапов пока нет подсказок по исполнительным документам.</p></section>';
        }
        return '<section class="subsection executive-docs-block">' +
            '<div class="card-head"><div><h3>Исполнительная документация</h3><span class="muted">Подсказки по актам и техрешениям для закрытия этапов.</span></div></div>' +
            renderExecutiveSummary(data.summary) +
            '<div class="executive-stage-list">' + data.checklist.map(function (stage) {
                return '<article class="executive-stage">' +
                    '<div class="executive-stage-head">' +
                        '<div><b>' + escapeHtml(stage.stageTitle) + '</b><small>' + escapeHtml(statusLabel(stage.statusCode) + ' • готовность ' + stage.progress + '%') + (stage.plannedEnd ? '<br>план до ' + escapeHtml(stage.plannedEnd) : '') + '</small></div>' +
                        '<span class="badge ' + (stage.progress >= 100 ? 'success' : (stage.progress >= 50 ? 'warn' : '')) + '">' + escapeHtml(stage.progress) + '%</span>' +
                    '</div>' +
                    '<div class="executive-item-list">' + stage.items.map(function (item) {
                        var stateClass = item.isReady ? 'executive-item-ready' : (item.optional ? 'executive-item-optional' : 'executive-item-missing');
                        var hint = item.isReady
                            ? ('готово: ' + item.readyCount)
                            : (item.existingCount ? ('черновиков: ' + item.existingCount) : (item.optional ? 'опционально' : 'нужно создать'));
                        var button = '';
                        if (data.canManage) {
                            button = '<button class="ghost" type="button" data-executive-create data-stage-id="' + stage.stageId + '" data-template-code="' + escapeHtml(item.code) + '">Создать черновик</button>';
                        }
                        return '<div class="executive-item ' + stateClass + '">' +
                            '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(hint) + '</small></div>' +
                            '<div class="executive-item-side">' +
                                '<span class="badge ' + (item.isReady ? 'success' : (item.optional ? '' : 'warn')) + '">' + (item.isReady ? 'Готово' : (item.optional ? 'Опция' : 'Нужно')) + '</span>' +
                                button +
                            '</div>' +
                        '</div>';
                    }).join('') + '</div>' +
                '</article>';
            }).join('') + '</div>' +
        '</section>';
    }

    function bindExecutiveDocActions(projectId) {
        qsa('[data-executive-create]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                button.disabled = true;
                api('/api/projects/' + projectId + '/executive-docs', {
                    method: 'POST',
                    body: JSON.stringify({
                        stage_id: Number(button.dataset.stageId),
                        template_code: button.dataset.templateCode
                    })
                }).then(function () {
                    loadDocuments(projectId);
                }).catch(function () {
                    button.disabled = false;
                });
            });
        });
    }

    function loadDocuments(projectId, loadingToken) {
        var docsRequest = api('/api/projects/' + projectId + '/documents');
        var executiveRequest = hasRole('customer')
            ? Promise.resolve(null)
            : api('/api/projects/' + projectId + '/executive-docs').catch(function () { return null; });
        Promise.all([docsRequest, executiveRequest]).then(function (result) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            var data = result[0] || {};
            var executive = result[1];
            var docs = Array.isArray(data.documents) ? data.documents : [];
            var panel = qs('[data-panel="documents"]');
            if (!panel) return;
            safeReplaceChildren(panel,
                (executive ? renderExecutiveChecklist(executive) : '') +
                renderDocumentUpload(projectId) +
                (docs.length
                    ? '<div class="documents-list">' + docs.map(renderDocumentRow).join('') + '</div>'
                    : '<p class="muted">Документы по объекту пока не загружены.</p>'));
            bindDocumentUpload(projectId);
            bindExecutiveDocActions(projectId);
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return;
            safeReplaceChildren(qs('[data-panel="documents"]'), '<p class="muted">Документы недоступны.</p>');
        });
    }

    function logsMonthStartIso(isoDate) {
        var base = isoDate || APP_TODAY;
        return String(base).slice(0, 7) + '-01';
    }

    function logsShiftMonth(monthIso, delta) {
        var date = new Date((monthIso || logsMonthStartIso(APP_TODAY)) + 'T00:00:00');
        date.setMonth(date.getMonth() + Number(delta || 0));
        return date.toISOString().slice(0, 10);
    }

    function logsMonthLabel(monthIso) {
        var date = new Date((monthIso || logsMonthStartIso(APP_TODAY)) + 'T00:00:00');
        return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
    }

    function bindLogsCalendar(project, logs) {
        var projectId = Number(project.id);
        qsa('[data-log-date]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                state.logsSelectedDateByProject[projectId] = button.dataset.logDate;
                var form = qs('[data-log-form]');
                if (form && form.report_date) {
                    form.report_date.value = button.dataset.logDate;
                }
                renderLogsCalendar(project, logs);
            });
        });
        qsa('[data-log-month-shift]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                state.logsCalendarMonthByProject[projectId] = logsShiftMonth(state.logsCalendarMonthByProject[projectId], Number(button.dataset.logMonthShift || 0));
                renderLogsCalendar(project, logs);
            });
        });
    }

    function renderLogsCalendar(project, logs) {
        var root = qs('[data-logs-calendar]');
        if (!root || !project) return;
        var projectId = Number(project.id);
        var selectedDate = state.logsSelectedDateByProject[projectId] || (logs[0] && logs[0].report_date) || project.started_at || APP_TODAY;
        if (!state.logsCalendarMonthByProject[projectId]) {
            state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(selectedDate);
        }
        var monthIso = state.logsCalendarMonthByProject[projectId];
        var monthDate = new Date(monthIso + 'T00:00:00');
        var monthIndex = monthDate.getMonth();
        var firstWeekday = (monthDate.getDay() + 6) % 7;
        var cursor = new Date(monthDate);
        cursor.setDate(cursor.getDate() - firstWeekday);
        var byDate = {};
        logs.forEach(function (log) {
            byDate[log.report_date] = byDate[log.report_date] || [];
            byDate[log.report_date].push(log);
        });
        var dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        var cells = [];
        for (var i = 0; i < 42; i += 1) {
            var iso = cursor.toISOString().slice(0, 10);
            var logsForDay = byDate[iso] || [];
            var progressValue = logsForDay.reduce(function (best, log) {
                var value = Number(log.progress_percent);
                return isNaN(value) ? best : Math.max(best, value);
            }, -1);
            var classes = ['logs-day'];
            if (cursor.getMonth() !== monthIndex) classes.push('logs-day-out');
            if (iso === APP_TODAY) classes.push('logs-day-today');
            if (logsForDay.length) classes.push('logs-day-has-log');
            if (logsForDay.some(function (log) { return String(log.blockers || '').trim(); })) classes.push('logs-day-risk');
            if (state.logsSelectedDateByProject[projectId] === iso) classes.push('logs-day-active');
            cells.push(
                '<button class="' + classes.join(' ') + '" type="button" data-log-date="' + iso + '">' +
                    '<span class="logs-day-number">' + cursor.getDate() + '</span>' +
                    '<span class="logs-day-meta">' + (logsForDay.length ? (logsForDay.length + ' отч.') : '—') + '</span>' +
                    (progressValue >= 0 ? '<span class="logs-day-progress">' + Math.round(progressValue) + '%</span>' : '') +
                '</button>'
            );
            cursor.setDate(cursor.getDate() + 1);
        }
        root.innerHTML =
            '<div class="logs-calendar-card">' +
                '<div class="logs-calendar-head">' +
                    '<button class="ghost" type="button" data-log-month-shift="-1">Назад</button>' +
                    '<strong>' + escapeHtml(logsMonthLabel(monthIso)) + '</strong>' +
                    '<button class="ghost" type="button" data-log-month-shift="1">Вперед</button>' +
                '</div>' +
                '<div class="logs-calendar-grid logs-calendar-weekdays">' + dayLabels.map(function (day) {
                    return '<span>' + day + '</span>';
                }).join('') + '</div>' +
                '<div class="logs-calendar-grid">' + cells.join('') + '</div>' +
            '</div>';
        bindLogsCalendar(project, logs);
        renderLogsDayView(project, logs);
    }

function renderLogsDayView(project, logs) {
        var root = qs('[data-logs-day-view]');
        if (!root || !project) return;
        var projectId = Number(project.id);
        var selectedDate = state.logsSelectedDateByProject[projectId] || (logs[0] && logs[0].report_date) || APP_TODAY;
        var selectedLogs = logs.filter(function (log) { return log.report_date === selectedDate; });
        if (!selectedLogs.length) {
            root.innerHTML =
                '<div class="logs-day-panel report-chat-panel">' +
                    '<div class="logs-day-panel-head"><b>' + escapeHtml(formatRuDate(selectedDate)) + '</b><span class="badge">0</span></div>' +
                    '<div class="report-chat-empty">' +
                        '<b>За этот день пока пусто</b>' +
                        '<p class="muted">Выбери день в календаре и добавь первый отчет. Дальше здесь будет живая лента по объекту.</p>' +
                    '</div>' +
                '</div>';
            return;
        }
        root.innerHTML =
            '<div class="logs-day-panel report-chat-panel">' +
                '<div class="logs-day-panel-head"><b>' + escapeHtml(formatRuDate(selectedDate)) + '</b><span class="badge">' + selectedLogs.length + ' шт.</span></div>' +
                '<div class="report-chat-list">' + selectedLogs.map(function (log) {
                    return '<article class="report-chat-message">' +
                        '<div class="report-chat-meta">' +
                            '<div><span>' + escapeHtml(log.author_name || '—') + '</span><h4>' + escapeHtml(log.title) + '</h4></div>' +
                            '<div class="project-badges">' +
                                (log.progress_percent != null && log.progress_percent !== '' ? '<span class="badge success">' + escapeHtml(Math.round(Number(log.progress_percent) || 0)) + '%</span>' : '') +
                                '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + (Number(log.is_client_visible) === 1 ? 'Заказчику' : 'Внутренний') + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="report-chat-bubble">' +
                            '<p>' + escapeHtml(log.work_done) + '</p>' +
                            '<div class="log-details">' +
                                (log.equipment ? '<div><span>Техника / поставки</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                                (log.blockers ? '<div class="log-risk"><span>Блокер</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                                (log.next_steps ? '<div><span>Дальше</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                            '</div>' +
                            (log.raw_input ? '<small class="muted">Диктовка / исходный ввод: ' + escapeHtml(log.raw_input) + '</small>' : '') +
                        '</div>' +
                        '<small class="report-chat-date">' + escapeHtml(log.report_date || '—') + '</small>' +
                    '</article>';
                }).join('') + '</div>' +
            '</div>';
    }

    function renderLogsPage() {
        var list = qs('[data-logs-list]');
        if (!list) return;
        if (!state.projects.length) {
            list.innerHTML = '<p class="muted">Нет объектов для журнала работ.</p>';
            return;
        }
        var projectSelect = qs('[data-logs-project]');
        var formProjectSelect = qs('[data-log-projects]');
        var options = state.projects.map(function (project) {
            return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
        }).join('');
        if (projectSelect) projectSelect.innerHTML = options;
        if (formProjectSelect) formProjectSelect.innerHTML = options;
        var dateInput = qs('[data-log-form] input[name="report_date"]');
        if (dateInput && !dateInput.value) dateInput.value = APP_TODAY;
        if (state.user && hasRole('customer')) {
            var createCard = qs('[data-log-create-card]');
            if (createCard) createCard.remove();
        } else {
            bindLogForm();
        }
        function loadSelected() {
            var projectId = Number(projectSelect && projectSelect.value ? projectSelect.value : state.projects[0].id);
            var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || state.projects[0];
            if (formProjectSelect) formProjectSelect.value = String(projectId);
            loadProjectLogs(project.id, function (logs) {
                loadProjectNotifications(project.id, function (notifications) {
                    if (!state.logsSelectedDateByProject[projectId]) {
                        state.logsSelectedDateByProject[projectId] = (logs[0] && logs[0].report_date) || project.started_at || APP_TODAY;
                    }
                    renderLogsStats(logs, notifications);
                    renderLogsAlerts(notifications);
                    renderLogsCalendar(project, logs);
                    renderLogsList(project, logs);
                });
            });
        }
        if (projectSelect && projectSelect.dataset.bound !== '1') {
            projectSelect.dataset.bound = '1';
            projectSelect.addEventListener('change', loadSelected);
        }
        loadSelected();
    }

    function renderLogsStats(logs, notifications) {
        var root = qs('[data-logs-stats]');
        if (!root) return;
        var visible = logs.filter(function (log) { return Number(log.is_client_visible) === 1; }).length;
        var internal = logs.length - visible;
        var workers = logs.reduce(function (sum, log) { return sum + Number(log.workers_count || 0); }, 0);
        var blockers = logs.filter(function (log) { return String(log.blockers || '').trim(); }).length;
        var latestProgress = logs.reduce(function (best, log) {
            var value = Number(log.progress_percent);
            return isNaN(value) ? best : Math.max(best, value);
        }, -1);
        root.innerHTML =
            stat('Отчетов', logs.length) +
            stat('Видно заказчику', visible) +
            stat('Внутренние', internal) +
            stat('Людей в отчетах', workers) +
            stat('С блокерами', blockers, blockers ? 'danger' : '') +
            stat('Прогресс по журналу', latestProgress >= 0 ? (Math.round(latestProgress) + '%') : '—', latestProgress >= 0 ? '' : 'warn') +
            stat('Отчет сегодня', notifications && notifications.missingDailyReport ? 'нет' : 'есть', notifications && notifications.missingDailyReport ? 'danger' : '');
    }

    function renderLogsAlerts(notifications) {
        var root = qs('[data-logs-alerts]');
        if (!root) return;
        if (!notifications) {
            root.innerHTML = '';
            return;
        }
        var cards = [];
        if (notifications.missingDailyReport) {
            cards.push('<article class="notice-card notice-warn"><b>Нет отчета за сегодня</b><small>На ' + escapeHtml(formatRuDate(APP_TODAY)) + ' по объекту еще не внесен дневной факт.</small></article>');
        }
        if (notifications.blockerLogs && notifications.blockerLogs.length) {
            var latestBlocker = notifications.blockerLogs[0];
            cards.push('<article class="notice-card notice-danger"><b>Есть блокеры в работах</b><small>' + escapeHtml((latestBlocker.report_date || 'без даты') + ': ' + (latestBlocker.blockers || 'описание не указано')) + '</small></article>');
        }
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            cards.push('<article class="notice-card"><b>Просроченные задачи: ' + notifications.overdueTasks.length + '</b><small>Их стоит разобрать вместе с отчетом за день.</small></article>');
        }
        root.innerHTML = cards.length ? cards.join('') : '';
    }


    function canCreateProjectReport() {
        return !hasRole('customer');
    }

    function bindProjectReportAssistantActions() {
        qsa('[data-report-open-ai]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var aiButton = qs('[data-ai-open]');
                if (aiButton) aiButton.click();
            });
        });
    }

    function ensureProjectReportDrawer() {
        var card = qs('[data-project-report-create-card]');
        if (card) {
            var cardHead = qs('.card-head', card);
            if (cardHead && !qs('[data-close-project-report-create]', cardHead)) {
                cardHead.insertAdjacentHTML('beforeend', '<button class="ghost" type="button" data-close-project-report-create>Закрыть</button>');
            }
        }
        var drawer = ensureSideDrawerFromCard('[data-project-report-create-card]', 'project-report-create', {
            closeLabel: 'Закрыть форму отчета',
            panelClass: 'project-report-drawer-panel'
        });
        if (drawer) {
            drawer.classList.add('reports-drawer-frame');
            var backdrop = qs('.side-drawer-backdrop', drawer);
            var panel = qs('.side-drawer-panel', drawer);
            if (backdrop) backdrop.classList.add('drawer-overlay');
            if (panel) panel.classList.add('reports-drawer-panel');
        }
        var openButtons = qsa('[data-open-project-report-create]');
        openButtons.forEach(function (button) {
            if (!drawer || button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                openSideDrawer(drawer);
            });
        });
        var close = qs('[data-close-project-report-create]');
        if (close && drawer && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', function (event) {
                event.preventDefault();
                closeSideDrawer(drawer);
            });
        }
        return drawer;
    }

    function renderProjectReportForm(project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card">' +
            '<div class="report-drawer-caption">Новый отчет</div>' +
            '<div class="card-head"><div><h3>Новый отчет за день</h3><span class="muted">Фиксируем факт работ, поставки, блокеры и прогресс объекта.</span></div></div>' +
            '<form class="project-form report-intake-form" data-log-form>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<div class="report-intake-grid">' +
                    '<label><span>Дата</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                    '<label><span>Заголовок</span><input name="title" placeholder="Например: День 1 — старт и завоз материалов" required></label>' +
                    '<label class="wide"><span>Что сделали</span><textarea name="work_done" rows="4" placeholder="Какие работы закрыли, что закупили, что выполнили на объекте" required></textarea></label>' +
                    '<label class="wide"><span>Текст / диктовка для ассистента</span><textarea name="raw_input" rows="3" placeholder="Сегодня начали работы, завезли кабель, закрыли демонтаж, ждем поставку окон..."></textarea></label>' +
                    '<label><span>Людей на объекте</span><input name="workers_count" type="number" min="0" step="1" placeholder="0"></label>' +
                    '<label><span>Прогресс объекта, %</span><input name="progress_percent" type="number" min="0" max="100" step="1" placeholder="Например: 18"></label>' +
                    '<label class="wide"><span>Техника / поставки</span><input name="equipment" placeholder="Манипулятор, бетон, кабель, окна, вышка..."></label>' +
                    '<label><span>Блокеры</span><input name="blockers" placeholder="Что мешает идти дальше"></label>' +
                    '<label><span>Следующий шаг</span><input name="next_steps" placeholder="Что делаем следующим днем"></label>' +
                    '<label><span>Видимость</span><select name="is_client_visible"><option value="1">Видно заказчику</option><option value="0">Внутренний отчет</option></select></label>' +
                '</div>' +
                '<div class="assistant-confirm-card">' +
                    '<b>Подтверждение изменений</b>' +
                    '<div class="assistant-confirm-list">' +
                        '<span>Сейчас отчет сохраняет факт дня и, если указан процент, обновляет прогресс объекта.</span>' +
                    '<span>Следующим шагом сюда подключим подтверждение изменений по материалам, работам и складу через AI-ассистента.</span>' +
                '</div>' +
                '<label class="check-inline report-confirm"><input type="checkbox" name="confirm_report" required> Подтверждаю сохранение отчета и обновление прогресса объекта</label>' +
                '</div>' +
                '<div class="form-error" data-log-error></div>' +
                '<div class="report-intake-actions">' +
                    '<button class="ghost" type="button" data-report-open-ai>Открыть ассистента</button>' +
                    '<button class="primary" type="submit">Сохранить отчет</button>' +
                '</div>' +
            '</form>' +
        '</section>';
    }

    function renderProjectReportsPanel(project) {
        return '<div class="project-reports-shell">' +
            '<section class="subsection report-calendar-top">' +
                '<div class="card-head"><div><h3>Календарь отчетов</h3><span class="muted">Сразу видно, в какие дни уже есть факт, где были блокеры и как шел прогресс.</span></div>' +
                    (canCreateProjectReport() ? '<button class="primary compact" type="button" data-open-project-report-create>Добавить отчет</button>' : '') +
                '</div>' +
                '<section class="stats-grid" data-logs-stats></section>' +
                '<div data-logs-alerts></div>' +
                '<div data-logs-calendar></div>' +
            '</section>' +
            '<section class="project-reports-grid">' +
                '<div data-logs-day-view></div>' +
                '<div class="project-reports-side">' +
                    '<section class="subsection report-assistant-card">' +
                        '<div class="card-head"><div><h3>Ассистент по отчетам</h3><span class="muted">Сюда заведем сценарий: надиктовал -> увидел предложенные изменения -> подтвердил.</span></div>' +
                            (canCreateProjectReport() ? '<button class="ghost compact" type="button" data-open-project-report-create>Новый отчет</button>' : '') +
                        '</div>' +
                        '<div class="assistant-confirm-list">' +
                            '<span>Что уже работает: календарь, архив отчетов, факт по дням и прогресс объекта.</span>' +
                            '<span>Что заложено следующим шагом: разбор материалов, закрытие работ, корректировки по складу и подтверждение перед применением.</span>' +
                        '</div>' +
                    '</section>' +
                '</div>' +
            '</section>' +
            '<section class="subsection">' +
                '<div class="card-head"><div><h3>Архив отчетов</h3><span class="muted">Полный дневник по объекту. Нажми на день в календаре, чтобы увидеть отчет именно за эту дату.</span></div></div>' +
                '<div data-report-archive-list data-logs-list><div class="report-archive-empty"><b>Архив отчетов</b><span>Сохраненные отчеты появятся здесь.</span></div></div>' +
            '</section>' +
        '</div>';
    }

    function refreshProjectReportsTab(projectId, loadingToken) {
        var panel = qs('[data-panel="reports"]');
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!panel || !project) return;
        var oldDrawer = qs('[data-drawer-id="project-report-create"]');
        if (oldDrawer) oldDrawer.remove();
        safeReplaceChildren(panel, renderProjectReportsPanel(project));
        ensureProjectReportDrawer();
        bindLogForm();
        bindProjectReportAssistantActions();
        loadProjectLogs(projectId, function (logs) {
            loadProjectNotifications(projectId, function (notifications) {
                if (!isCurrentProject(projectId, loadingToken)) return;
                if (!state.logsSelectedDateByProject[projectId]) {
                    state.logsSelectedDateByProject[projectId] = (logs[0] && logs[0].report_date) || project.started_at || APP_TODAY;
                }
                renderLogsStats(logs, notifications);
                renderLogsAlerts(notifications);
                renderLogsCalendar(project, logs);
                renderLogsList(project, logs);
            });
        });
    }



    function renderProjectOverviewHero(project) {
        var budget = project.budget == null ? 'Скрыто ролью' : money(project.budget);
        var paid = project.paid == null ? 'Скрыто ролью' : money(project.paid);
        return '<section class="project-overview-hero ui-card">' +
            '<div class="project-overview-head">' +
                '<div>' +
                    '<h3>' + escapeHtml(project.title || 'Без названия') + '</h3>' +
                    '<p>' + escapeHtml(project.address || 'Адрес не указан') + '</p>' +
                '</div>' +
            '</div>' +
            renderStrongProgress(percent(project.progress), 'Текущая готовность', true) +
            '<div class="data-grid project-overview-grid">' +
                dataItem('Заказчик', project.client_name || 'Не указано') +
                dataItem('Номер договора', project.contract_no || 'Не указано') +
                dataItem('Бюджет', budget) +
                dataItem('Оплачено', paid) +
                dataItem('Старт', project.started_at || '—') +
                dataItem('Дедлайн', project.deadline_at || '—') +
                dataItem('Город', project.city || 'Не указано') +
                dataItem('Регион', project.region || 'Не указано') +
            '</div>' +
            (project.description ? '<div class="object-description">' + escapeHtml(project.description) + '</div>' : '') +
        '</section>';
    }

    function ensureProjectEditCard() {
        if (qs('[data-project-edit-card]')) return;
        var anchor = qs('[data-project-create-card]');
        if (!anchor || !anchor.parentNode) return;
        anchor.insertAdjacentHTML('afterend',
            '<section class="card ui-card" data-project-edit-card data-project-overview-section hidden>' +
                '<div class="card-head">' +
                    '<h3>Редактировать объект</h3>' +
                    '<button class="ghost" type="button" data-close-project-edit>Закрыть</button>' +
                '</div>' +
                '<form class="project-form" data-project-edit-form>' +
                    '<input name="project_id" type="hidden">' +
                    '<label><span>Название</span><input name="title" required></label>' +
                    '<label><span>Заказчик</span><input name="client_name" required></label>' +
                    '<label class="wide"><span>Адрес</span><input name="address" required></label>' +
                    '<label><span>Статус</span><input name="status"></label>' +
                    '<label><span>Договор</span><input name="contract_no"></label>' +
                    '<label><span>Бюджет</span><input name="budget" type="number" min="0" step="1"></label>' +
                    '<label><span>Старт</span><input name="started_at" type="date"></label>' +
                    '<label><span>Дедлайн</span><input name="deadline_at" type="date"></label>' +
                    '<label><span>Город</span><input name="city"></label>' +
                    '<label><span>Регион</span><input name="region"></label>' +
                    '<label class="wide"><span>Описание</span><textarea name="description" rows="4"></textarea></label>' +
                    '<div class="form-error" data-project-edit-error></div>' +
                    '<button class="primary" type="submit">Сохранить</button>' +
                '</form>' +
            '</section>'
        );
    }

    function closeProjectEditCard() {
        var card = qs('[data-project-edit-card]');
        if (card) card.hidden = true;
    }

    function openProjectEdit(projectId) {
        ensureProjectEditCard();
        var card = qs('[data-project-edit-card]');
        var form = qs('[data-project-edit-form]');
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!card || !form || !project) return;
        form.project_id.value = String(project.id);
        form.title.value = project.title || '';
        form.client_name.value = project.client_name || '';
        form.address.value = project.address || '';
        form.status.value = project.status || '';
        form.contract_no.value = project.contract_no || '';
        form.budget.value = project.budget == null ? '' : Number(project.budget);
        form.started_at.value = project.started_at || '';
        form.deadline_at.value = project.deadline_at || '';
        if (form.city) form.city.value = project.city || '';
        if (form.region) form.region.value = project.region || '';
        if (form.description) form.description.value = project.description || '';
        var error = qs('[data-project-edit-error]');
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        card.hidden = false;
        if (typeof card.scrollIntoView === 'function') {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function bindProjectEditForm() {
        ensureProjectEditCard();
        var close = qs('[data-close-project-edit]');
        if (close && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', closeProjectEditCard);
        }
        var form = qs('[data-project-edit-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var projectId = Number(form.project_id.value);
            var error = qs('[data-project-edit-error]');
            if (error) error.classList.remove('active');
            var activeTab = qs('[data-tab].active');
            var activeTabName = activeTab ? activeTab.dataset.tab : 'overview';
            withSubmitLock(form, function () {
                return api('/api/projects/' + projectId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: form.title.value.trim(),
                        client_name: form.client_name.value.trim(),
                        address: form.address.value.trim(),
                        status: form.status.value.trim(),
                        contract_no: form.contract_no.value.trim(),
                        budget: form.budget.value === '' ? 0 : Number(form.budget.value || 0),
                        started_at: form.started_at.value,
                        deadline_at: form.deadline_at.value,
                        city: form.city ? form.city.value.trim() : '',
                        region: form.region ? form.region.value.trim() : '',
                        description: form.description ? form.description.value.trim() : ''
                    })
                }).then(function (data) {
                    updateProjectInState(data.project);
                    renderProjectStats();
                    renderProjectCritical();
                    renderProjectList(state.projects);
                    closeProjectEditCard();
                    showAppNotice('\u041e\u0431\u044a\u0435\u043a\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d.', 'success');
                    if (state.selectedProject && Number(state.selectedProject.id) === projectId) {
                        openProject(projectId);
                        activateProjectTab(activeTabName || 'overview');
                    }
                }).catch(function (err) {
                    var message = appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442');
                    if (error) {
                        error.textContent = message;
                        error.classList.add('active');
                    }
                    showAppNotice(message, 'error');
                });
            });
        });
    }

    function bindProjectOverviewActions() {
        qsa('[data-project-tab-target]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                activateProjectTab(button.dataset.projectTabTarget);
            });
        });
        qsa('[data-project-status-select]').forEach(function (select) {
            if (select.dataset.bound === '1') return;
            select.dataset.bound = '1';
            select.addEventListener('change', function () {
                var projectId = Number(select.dataset.projectId || 0);
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
                if (!project) return;
                select.disabled = true;
                api('/api/projects/' + projectId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: project.title || '',
                        client_name: project.client_name || '',
                        address: project.address || '',
                        status: select.value,
                        contract_no: project.contract_no || '',
                        budget: project.budget == null ? 0 : Number(project.budget || 0),
                        started_at: project.started_at || '',
                        deadline_at: project.deadline_at || '',
                        city: project.city || '',
                        region: project.region || '',
                        description: project.description || ''
                    })
                }).then(function (data) {
                    updateProjectInState(data.project);
                    renderProjectStats();
                    renderProjectCritical();
                    renderProjectList(state.projects);
                    if (state.selectedProject && Number(state.selectedProject.id) === projectId) {
                        var overviewPanel = qs('[data-panel="overview"]');
                        if (overviewPanel) overviewPanel.innerHTML = renderProjectOverviewHero(state.selectedProject);
                        bindProjectOverviewActions();
                    }
                }).catch(function () {
                    select.value = project.status || 'Подготовка';
                }).finally(function () {
                    select.disabled = false;
                });
            });
        });
    }

    function getAutoBotContentRoot() {
        return qs('[data-autobot-content-root]');
    }

    function setAutoBotPageLoading() {
        var root = getAutoBotContentRoot();
        if (!root) return null;
        return safeReplaceChildren(root, '');
    }

    function renderAutobotShellHTML(autobotUrl) {
        var url = String(autobotUrl || '').replace(/\/+$/, '');
        var href = escapeHtml(url ? (url + '/') : '/');
        return '<div class="autobot-embed-wrap">' +
            '<div class="autobot-offline" data-autobot-offline hidden>' +
                '<strong>AutoBot не отвечает</strong>' +
                '<span>Проверь, что сервис AutoBot запущен, или открой его отдельно.</span>' +
                '<a href="' + href + '" target="_blank" rel="noopener noreferrer">Открыть AutoBot</a>' +
            '</div>' +
            '<iframe class="autobot-embed" data-autobot-frame src="' + href + '" title="AutoBot" loading="eager" referrerpolicy="no-referrer" allow="clipboard-read; clipboard-write; microphone"></iframe>' +
        '</div>';
    }

    function clearAutobotFrameLoader() {
        if (typeof window.hideLoader === 'function') window.hideLoader();
    }

    function bindAutobotFrameLoader() {
        var frame = qs('[data-autobot-frame]');
        if (!frame || frame.dataset.loaderBound === '1') return;
        frame.dataset.loaderBound = '1';
        if (typeof window.showLoader === 'function') window.showLoader('Синхронизация...');
        frame.addEventListener('load', clearAutobotFrameLoader);
    }

    function bindAutobotOfflineCheck() {
        var stage = qs('[data-autobot-url]');
        var offline = qs('[data-autobot-offline]');
        if (!stage || !offline || !window.fetch) return;
        var url = (stage.getAttribute('data-autobot-url') || '').replace(/\/+$/, '') + '/';
        window.fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(function () {
            clearAutobotFrameLoader();
            offline.hidden = false;
            showAppNotice('AutoBot не отвечает. Проверь, что сервис запущен.', 'error');
        });
    }

    function fillAutobotProjectSelects() {
        qsa('[data-autobot-projects], [data-autobot-estimate-projects]').forEach(function (select) {
            select.innerHTML = state.projects.map(function (project) {
                return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
            }).join('');
        });
    }

    function renderAutobotResult(root, project, text, secondaryHref, secondaryText) {
        if (!root) return;
        root.hidden = false;
        root.innerHTML =
            '<div class="autobot-result-head">' +
                '<strong>' + escapeHtml(project.title || 'Объект CRM') + '</strong>' +
                '<span class="badge success">Готово</span>' +
            '</div>' +
            '<p>' + escapeHtml(text) + '</p>' +
            '<div class="autobot-actions">' +
                '<a class="primary" href="/app/projects?openProject=' + project.id + '">Открыть в CRM</a>' +
                '<a class="ghost" href="' + escapeHtml(secondaryHref || '/app/projects') + '">' + escapeHtml(secondaryText || 'Перейти дальше') + '</a>' +
            '</div>';
    }

    function bindAutobotTenderMode() {
        var form = qs('[data-autobot-tender-form]');
        if (!form) return;
        var mode = qs('select[name="target_mode"]', form);
        var wrap = qs('[data-autobot-existing-wrap]', form);
        if (!mode || !wrap) return;
        function sync() {
            var isExisting = mode.value === 'existing';
            wrap.hidden = !isExisting;
        }
        if (mode.dataset.bound !== '1') {
            mode.dataset.bound = '1';
            mode.addEventListener('change', sync);
        }
        sync();
    }

    function bindAutobotTenderForm() {
        var form = qs('[data-autobot-tender-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-autobot-tender-error]');
            var result = qs('[data-autobot-tender-result]');
            if (error) error.classList.remove('active');
            if (result) result.hidden = true;
            var payload;
            try {
                payload = JSON.parse(form.json.value);
            } catch (parseError) {
                if (error) {
                    error.textContent = 'JSON тендерного пакета не читается.';
                    error.classList.add('active');
                }
                return;
            }
            payload.replace_existing = !!form.replace_existing.checked;
            var mode = form.target_mode.value;
            var parsedProject = payload.project || {};
            if (mode === 'existing') {
                var existingId = Number(form.project_id.value);
                if (!existingId) {
                    if (error) {
                        error.textContent = 'Выбери объект CRM для дозагрузки.';
                        error.classList.add('active');
                    }
                    return;
                }
                if (result) {
                    result.hidden = false;
                    safeReplaceChildren(result, '');
                }
                api('/api/projects/' + existingId + '/bootstrap', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).then(function (data) {
                    updateProjectInState(data.project);
                    renderProjectList(state.projects);
                    fillAutobotProjectSelects();
                    renderAutobotResult(result, data.project, 'Тендерный пакет загружен в существующий объект.', '/app/projects?openProject=' + data.project.id, 'Открыть объект');
                }).catch(function (err) {
                    if (result) {
                        result.hidden = true;
                        safeReplaceChildren(result, '');
                    }
                    showAppNotice(appErrorMessage(err, 'Не удалось загрузить тендер в CRM'), 'error');
                    if (!error) return;
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось загрузить тендер в CRM';
                    error.classList.add('active');
                });
                return;
            }

            var projectBody = {
                title: (form.title.value || parsedProject.title || '').trim(),
                client_name: (form.client_name.value || parsedProject.client_name || parsedProject.clientName || '').trim(),
                address: (form.address.value || parsedProject.address || '').trim(),
                budget: Number(form.budget.value || parsedProject.budget || 0),
                started_at: form.started_at.value || parsedProject.started_at || parsedProject.startedAt || '',
                deadline_at: form.deadline_at.value || parsedProject.deadline_at || parsedProject.deadlineAt || ''
            };
            if (!projectBody.title || !projectBody.client_name || !projectBody.address) {
                if (error) {
                    error.textContent = 'Для нового объекта нужны название, заказчик и адрес.';
                    error.classList.add('active');
                }
                return;
            }
            if (result) {
                result.hidden = false;
                safeReplaceChildren(result, '');
            }
            api('/api/projects', {
                method: 'POST',
                body: JSON.stringify(projectBody)
            }).then(function (created) {
                state.projects.unshift(created.project);
                fillAutobotProjectSelects();
                payload.replace_existing = true;
                return api('/api/projects/' + created.project.id + '/bootstrap', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }).then(function (data) {
                updateProjectInState(data.project);
                renderProjectList(state.projects);
                fillAutobotProjectSelects();
                form.reset();
                bindAutobotTenderMode();
                renderAutobotResult(result, data.project, 'Новый объект создан и заполнен тендерным пакетом.', '/app/projects?openProject=' + data.project.id, 'Открыть объект');
            }).catch(function (err) {
                if (result) {
                    result.hidden = true;
                    safeReplaceChildren(result, '');
                }
                showAppNotice(appErrorMessage(err, 'Не удалось создать объект из тендера'), 'error');
                if (!error) return;
                error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось создать объект из тендера';
                error.classList.add('active');
            });
        });
    }

    function bindAutobotEstimateForm() {
        var form = qs('[data-autobot-estimate-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-autobot-estimate-error]');
            var result = qs('[data-autobot-estimate-result]');
            if (error) error.classList.remove('active');
            if (result) result.hidden = true;
            var payload;
            try {
                payload = JSON.parse(form.json.value);
            } catch (parseError) {
                if (error) {
                    error.textContent = 'JSON сметы не читается.';
                    error.classList.add('active');
                }
                return;
            }
            var projectId = Number(form.project_id.value);
            if (result) {
                result.hidden = false;
                safeReplaceChildren(result, '');
            }
            api('/api/projects/' + projectId + '/estimate-import', {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(function (data) {
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || { id: projectId, title: 'Объект CRM' };
                state.materialsByProject[projectId] = data.items || [];
                renderAutobotResult(result, project, 'Смета добавлена в материалы объекта.', '/app/warehouse', 'Открыть склад');
            }).catch(function (err) {
                if (result) {
                    result.hidden = true;
                    safeReplaceChildren(result, '');
                }
                showAppNotice(appErrorMessage(err, 'Не удалось загрузить смету'), 'error');
                if (!error) return;
                error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось загрузить смету';
                error.classList.add('active');
            });
        });
    }

    function renderAutobotPage() {
        var stage = qs('[data-autobot-url]');
        var root = getAutoBotContentRoot();
        if (stage && root && !qs('[data-autobot-tender-form]', root) && !qs('[data-autobot-estimate-form]', root)) {
            safeReplaceChildren(root, renderAutobotShellHTML(stage.getAttribute('data-autobot-url') || ''));
            bindAutobotFrameLoader();
            bindAutobotOfflineCheck();
            return;
        }
        fillAutobotProjectSelects();
        bindAutobotTenderMode();
        bindAutobotTenderForm();
        bindAutobotEstimateForm();
    }

    function applyRole() {
        if (!state.user) return;
        state.user.role = normalizeRole(state.user.role);
        document.body.classList.add('role-' + state.user.role);
        qsa('[data-director-only]').forEach(function (node) {
            node.classList.toggle('hidden', !isDirectorRole());
        });
        qsa('[data-director-action]').forEach(function (node) {
            node.classList.toggle('hidden', !isDirectorRole());
        });
        var allowedNav = {
            admin: ['dashboard', 'projects', 'autobot', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats', 'users', 'reports'],
            director: ['dashboard', 'projects', 'autobot', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats', 'users', 'reports'],
            foreman: ['dashboard', 'projects', 'autobot', 'schedule', 'logs', 'warehouse', 'suppliers', 'chats'],
            purchaser: ['dashboard', 'projects', 'autobot', 'logs', 'warehouse', 'suppliers', 'chats'],
            financier: ['dashboard', 'projects', 'autobot', 'reports'],
            accountant: ['dashboard', 'projects', 'autobot', 'reports'],
            customer: ['dashboard', 'projects', 'schedule', 'logs', 'chats']
        };
        var allowed = allowedNav[normalizeRole(state.user.role)] || [];
        qsa('[data-nav]').forEach(function (link) {
            if (allowed.indexOf(link.dataset.nav) === -1) {
                link.classList.add('hidden');
                return;
            }
            link.classList.remove('hidden');
            if (link.dataset.nav === page) link.classList.add('active');
        });
    }

    function initPage() {
        if (page === 'dashboard') initDashboardPage();
        if (page === 'projects') loadProjects(function () {
            loadDashboard(renderProjectsPage);
        });
        if (page === 'autobot') {
            setAutoBotPageLoading();
            loadProjects(renderAutobotPage);
        }
        if (page === 'warehouse') loadProjects(renderWarehousePage);
        if (page === 'suppliers') loadProjects(initSuppliersPage);
        if (page === 'schedule') loadProjects(renderSchedulePage);
        if (page === 'logs') loadProjects(renderLogsPage);
        if (page === 'chats') loadProjects(renderChatsPage);
        if (page === 'users') initUsersPage();
        if (page === 'companies') initCompaniesPage();
        if (page === 'reports') initReportsPage();
    }

    function bindAutobotImmersiveMode() {
        if (page !== 'autobot' || window.__pmbiAutobotImmersiveBound) return;
        window.__pmbiAutobotImmersiveBound = true;
        var lastScrollY = window.scrollY || 0;
        var ticking = false;

        function applyAutobotTopbarState() {
            ticking = false;
            var currentY = window.scrollY || 0;
            var delta = currentY - lastScrollY;
            var shouldHide = currentY > 140 && delta > 6;
            var shouldShow = currentY < 48 || delta < -6;
            if (shouldHide) {
                document.body.classList.add('autobot-topbar-hidden');
            } else if (shouldShow) {
                document.body.classList.remove('autobot-topbar-hidden');
            }
            lastScrollY = currentY;
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(applyAutobotTopbarState);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', function () {
            document.body.classList.remove('autobot-topbar-hidden');
            lastScrollY = window.scrollY || 0;
        });
        document.body.classList.remove('autobot-topbar-hidden');
    }

    function applySidebarPreference() {
        var collapsed = false;
        try {
            collapsed = window.localStorage.getItem('pmbi_sidebar_collapsed') === '1';
        } catch (error) {}
        document.body.classList.toggle('sidebar-collapsed', collapsed && window.innerWidth > 720);
        syncSidebarCollapsedState();
        syncSidebarToggleTitle();
        if (!window.__pmbiSidebarResizeBound) {
            window.__pmbiSidebarResizeBound = true;
            window.addEventListener('resize', handleSidebarResize);
        }
    }

    function handleSidebarResize() {
        if (window.innerWidth <= 720) {
            document.body.classList.remove('sidebar-collapsed');
        } else {
            var collapsed = false;
            try {
                collapsed = window.localStorage.getItem('pmbi_sidebar_collapsed') === '1';
            } catch (error) {}
            document.body.classList.toggle('sidebar-collapsed', collapsed);
        }
        syncSidebarCollapsedState();
        syncSidebarToggleTitle();
    }

    function toggleSidebarCollapsed() {
        var collapsed = !document.body.classList.contains('sidebar-collapsed');
        document.body.classList.toggle('sidebar-collapsed', collapsed);
        try {
            window.localStorage.setItem('pmbi_sidebar_collapsed', collapsed ? '1' : '0');
        } catch (error) {}
        syncSidebarCollapsedState();
        syncSidebarToggleTitle();
    }

    function syncSidebarCollapsedState() {
        var collapsed = document.body.classList.contains('sidebar-collapsed');
        var sidebar = qs('.sidebar');
        if (sidebar) sidebar.setAttribute('data-collapsed', collapsed ? '1' : '0');
        qsa('.nav a').forEach(function (link) {
            link.setAttribute('data-collapsed', collapsed ? '1' : '0');
        });
        try {
            if (!collapsed || window.innerWidth > 720) {
                document.documentElement.classList.remove('sidebar-pref-collapsed');
            }
        } catch (error) {}
    }

    function syncSidebarToggleTitle() {
        var collapsed = document.body.classList.contains('sidebar-collapsed');
        var title = collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар';
        qsa('[data-menu-toggle], [data-sidebar-toggle]').forEach(function (toggle) {
            toggle.title = title;
            toggle.setAttribute('aria-label', title);
        });
    }

    loadProjectNotifications = function (projectId, callback) {
        api('/api/projects/' + projectId + '/notifications').then(function (data) {
            state.notificationsByProject[projectId] = data || null;
            callback(data || null);
        }).catch(function () {
            state.notificationsByProject[projectId] = null;
            callback(null);
        });
    };

    function scheduleProcurementBadge(alert) {
        if (!alert) return 'Подготовка';
        if (Number(alert.daysUntilOrder) < 0) return 'Просрочено';
        if (Number(alert.daysUntilOrder) === 0) return 'Заказать сегодня';
        if (Number(alert.daysUntilOrder) <= 3) return 'Срочно';
        if (Number(alert.daysUntilOrder) <= 10) return 'Скоро заказ';
        return 'Подготовка';
    }

    function scheduleProcurementClass(alert) {
        if (!alert) return '';
        if (alert.status === 'critical') return 'danger';
        if (alert.status === 'soon') return 'warn';
        return '';
    }

    function scheduleProcurementTiming(alert) {
        if (!alert) return '';
        if (Number(alert.daysUntilOrder) < 0) return 'срок заказа вышел ' + Math.abs(Number(alert.daysUntilOrder)) + ' дн. назад';
        if (Number(alert.daysUntilOrder) === 0) return 'заказать сегодня';
        return 'заказать в течение ' + Number(alert.daysUntilOrder) + ' дн.';
    }

    function scheduleProcurementStartLabel(alert) {
        if (!alert) return '';
        if (Number(alert.daysUntilStart) < 0) return 'раздел уже должен был стартовать ' + Math.abs(Number(alert.daysUntilStart)) + ' дн. назад';
        if (Number(alert.daysUntilStart) === 0) return 'раздел стартует сегодня';
        return 'раздел стартует через ' + Number(alert.daysUntilStart) + ' дн.';
    }

    function renderScheduleProcurementBoard(project) {
        if (!project || hasRole('customer')) return '';
        var notifications = state.notificationsByProject[project.id];
        var alerts = notifications && Array.isArray(notifications.procurementAlerts) ? notifications.procurementAlerts : [];
        var summary = notifications && notifications.procurementSummary ? notifications.procurementSummary : { critical: 0, soon: 0, watch: 0 };
        if (!alerts.length) return '';
        return '<section class="card schedule-procurement-board">' +
            '<div class="card-head"><div><h3>Контроль закупки по графику</h3><span class="muted">Показывает, когда стартует раздел и до какой даты нужно успеть заказать материалы.</span></div></div>' +
            '<div class="execution-summary">' +
                stat('Срочно', String(summary.critical || 0), summary.critical ? 'danger' : '') +
                stat('Скоро', String(summary.soon || 0), summary.soon ? 'warn' : '') +
                stat('Подготовка', String(summary.watch || 0)) +
                stat('Сегодня', APP_TODAY) +
            '</div>' +
            '<div class="materials-list">' + alerts.slice(0, 8).map(function (alert) {
                var meta = [
                    alert.sectionTitle || alert.stageTitle || '',
                    scheduleProcurementStartLabel(alert),
                    scheduleProcurementTiming(alert),
                    'доставка/запас: ' + alert.leadDays + ' дн.',
                    'заказать до ' + alert.orderByDate
                ].filter(Boolean).join(' • ');
                return '<div class="material-row">' +
                    '<div><b>' + escapeHtml(alert.title) + '</b><small>' + escapeHtml(meta) + '</small></div>' +
                    '<div class="material-chain-side"><span class="badge ' + scheduleProcurementClass(alert) + '">' + escapeHtml(scheduleProcurementBadge(alert)) + '</span></div>' +
                '</div>';
            }).join('') + '</div>' +
        '</section>';
    }

    function isTimelineStageStarted(stage) {
        var progress = percent(stage.progress);
        var status = String(stage.status_code || '').trim();
        return progress > 0 ||
            ['started', 'in_progress', 'blocked', 'overdue', 'completed', 'approved'].indexOf(status) !== -1 ||
            Boolean(stage.fact_start || stage.fact_end);
    }

    function timelineStageKindClass(stage) {
        var stageKind = String(stage.stage_kind || '').trim().toLowerCase();
        if (stageKind === 'section') return ' timeline-row-section';
        if (stageKind === 'subsection') return ' timeline-row-subsection';
        return '';
    }

    function timelineStageKindLabel(stage) {
        var stageKind = String(stage.stage_kind || '').trim().toLowerCase();
        if (stageKind === 'section') return 'Раздел';
        if (stageKind === 'subsection') return 'Подраздел';
        return 'Работа';
    }

    function renderTimelineProgressCell(stage) {
        var progress = percent(stage.progress);
        var status = String(stage.status_code || '').trim();
        var isDone = progress >= 100 || status === 'approved' || status === 'completed';
        if (!isTimelineStageStarted(stage) && !isDone) {
            return '<div class="timeline-progress timeline-progress-idle"><span class="timeline-progress-hint">Нет факта</span></div>' +
                '<strong class="timeline-progress-value timeline-progress-value-idle">Старт</strong>';
        }
        var progressTrackClass = progress <= 0 && !isDone ? ' timeline-progress-empty' : '';
        var width = isDone ? 100 : progress;
        return '<div class="timeline-progress' + progressTrackClass + '">' + (width > 0 ? '<i style="width:' + width + '%"></i>' : '') + '</div>' +
            '<strong class="timeline-progress-value">' + (isDone ? '100%' : (progress + '%')) + '</strong>';
    }

    function getProjectTabMode(projectId, tab) {
        if (!state.projectTabModesByProject[projectId]) state.projectTabModesByProject[projectId] = {};
        return state.projectTabModesByProject[projectId][tab] || 'list';
    }

    function setProjectTabMode(projectId, tab, mode) {
        if (!state.projectTabModesByProject[projectId]) state.projectTabModesByProject[projectId] = {};
        state.projectTabModesByProject[projectId][tab] = mode === 'market' ? 'market' : 'list';
    }

    function marketErrorLabel(code) {
        if (code === 'estimate_not_linked') return '\u041e\u0431\u044a\u0435\u043a\u0442 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0441\u0432\u044f\u0437\u0430\u043d \u0441\u043e \u0441\u043c\u0435\u0442\u043e\u0439 AutoBot.';
        if (code === 'autobot_unavailable') return '\u0414\u0430\u043d\u043d\u044b\u0435 \u0440\u044b\u043d\u043a\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u044b. \u041f\u043e\u0432\u0442\u043e\u0440\u0438 \u0430\u043d\u0430\u043b\u0438\u0437.';
        return '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0430\u043d\u0430\u043b\u0438\u0437 \u0440\u044b\u043d\u043a\u0430.';
    }

    function formatMarketDelta(delta) {
        if (delta == null) return '<span class="muted">&mdash;</span>';
        if (delta === 0) return '<span class="market-delta market-delta-even">\u0420\u043e\u0432\u043d\u043e \u043f\u043e \u0441\u043c\u0435\u0442\u0435</span>';
        var cls = delta < 0 ? 'market-delta-save' : 'market-delta-over';
        var label = delta < 0 ? '\u041d\u0438\u0436\u0435' : '\u0412\u044b\u0448\u0435';
        return '<span class="market-delta ' + cls + '">' + label + ' \u043d\u0430 ' + escapeHtml(money(Math.abs(delta))) + '</span>';
    }

    function renderMarketSources(row) {
        var sources = Array.isArray(row.sources) ? row.sources : [];
        if (!sources.length) return '<span class="muted">\u041d\u0435\u0442 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u043e\u0432</span>';
        var visible = sources.slice(0, 3).map(function (source) {
            var label = source.domain || source.title || '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a';
            return '<a href="' + escapeHtml(source.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>';
        }).join('');
        var more = row.sourceCount > 3 ? '<span class="market-source-more">+' + (row.sourceCount - 3) + '</span>' : '';
        return '<div class="market-sources">' + visible + more + '</div>';
    }



    function renderProjectTabViewSwitcher(projectId, tab, title, subtitle) {
        var mode = getProjectTabMode(projectId, tab);
        return '<div class="market-toolbar">' +
            '<div><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(subtitle) + '</p></div>' +
            '<div class="segmented compact" data-market-switcher>' +
                '<button type="button" class="' + (mode === 'list' ? 'active' : '') + '" data-market-mode="list" data-market-tab="' + tab + '">\u0421\u043f\u0438\u0441\u043e\u043a</button>' +
                '<button type="button" class="' + (mode === 'market' ? 'active' : '') + '" data-market-mode="market" data-market-tab="' + tab + '">\u0410\u043d\u0430\u043b\u0438\u0437 \u0440\u044b\u043d\u043a\u0430</button>' +
            '</div>' +
        '</div>';
    }

    function renderProjectMaterialsTab(project, items, insights) {
        var header = renderProjectTabViewSwitcher(project.id, 'materials', '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b', '\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u043e\u0437\u0438\u0446\u0438\u0439 \u0438 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0432\u0438\u0434 \u0441 \u0446\u0435\u043d\u0430\u043c\u0438 \u0440\u044b\u043d\u043a\u0430 \u0438\u0437 AutoBot.');
        if (getProjectTabMode(project.id, 'materials') === 'market') {
            return header + renderProjectMarketBlock(project.id, 'material');
        }
        return header + renderMaterials(items, project.id, insights);
    }

    function renderProjectWorksTab(project, stages, items) {
        var header = renderProjectTabViewSwitcher(project.id, 'works', '\u0420\u0430\u0431\u043e\u0442\u044b', '\u0422\u0435\u043a\u0443\u0449\u0438\u0435 \u0440\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u0441\u043c\u0435\u0442\u0435 \u0438 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0432\u043e\u0434\u043a\u0430 \u043f\u043e \u0440\u044b\u043d\u043e\u0447\u043d\u044b\u043c \u0446\u0435\u043d\u0430\u043c.');
        if (getProjectTabMode(project.id, 'works') === 'market') {
            return header + renderProjectMarketBlock(project.id, 'work');
        }
        return header + renderWorksPanel(stages, items);
    }

    function rerenderProjectMarketTab(projectId, tab) {
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;
        if (tab === 'materials') {
            var materialsPanel = qs('[data-panel="materials"]');
            if (materialsPanel) {
                safeReplaceChildren(materialsPanel, renderProjectMaterialsTab(
                    project,
                    state.materialsByProject[projectId] || [],
                    state.materialInsightsByProject[projectId] || {}
                ));
            }
        }
        if (tab === 'works') {
            var worksPanel = qs('[data-panel="works"]');
            if (worksPanel) {
                safeReplaceChildren(worksPanel, renderProjectWorksTab(
                    project,
                    state.stagesByProject[projectId] || [],
                    state.materialsByProject[projectId] || []
                ));
            }
        }
        bindProjectMarketToggles(projectId);
        bindProjectChainActions();
    }

    function bindProjectMarketToggles(projectId) {
        qsa('[data-market-mode]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function (event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                var tab = button.dataset.marketTab || 'materials';
                var mode = button.dataset.marketMode || 'list';
                setProjectTabMode(projectId, tab, mode);
                rerenderProjectMarketTab(projectId, tab);
                if (mode === 'market') {
                    loadProjectMarketAnalysis(projectId, tab === 'works' ? 'work' : 'material', function () {
                        if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
                        if (getProjectTabMode(projectId, tab) !== 'market') return;
                        rerenderProjectMarketTab(projectId, tab);
                    });
                }
            });
        });
    }

    function initShell() {
        applySidebarPreference();
        try {
            document.documentElement.classList.remove('sidebar-pref-collapsed');
            if (page !== 'projects') {
                document.documentElement.classList.remove('project-route-loading');
            } else {
                var initialProjectParams = new URLSearchParams(location.search);
                if (!Number(initialProjectParams.get('openProject') || 0)) {
                    document.documentElement.classList.remove('project-route-loading');
                }
            }
        } catch (error) {
            document.documentElement.classList.remove('sidebar-pref-collapsed');
            document.documentElement.classList.remove('project-route-loading');
        }
        api('/api/auth/me').then(function (data) {
            state.user = data.user;
            renderUser();
            applyRole();
            refreshLucideIcons(document);
            initPage();
        }).catch(function () {
            location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
        });

        var logout = qs('[data-logout]');
        if (logout && logout.dataset.bound !== '1') {
            logout.dataset.bound = '1';
            logout.addEventListener('click', function () {
                if (isClerkEnabled()) {
                    loadClerk().then(function (clerk) {
                        return api('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
                            return clerk ? clerk.signOut({ redirectUrl: state.authConfig.clerkAfterSignOutUrl || '/login' }) : null;
                        });
                    }).catch(function () {
                        location.replace('/login');
                    });
                    return;
                }
                api('/api/auth/logout', { method: 'POST' }).finally(function () {
                    location.replace('/login');
                });
            });
        }

        qsa('[data-menu-toggle], [data-sidebar-toggle]').forEach(function (toggle) {
            if (toggle.dataset.bound === '1') return;
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', function (event) {
                event.preventDefault();
                if (window.innerWidth <= 720) {
                    document.body.classList.toggle('menu-open');
                    return;
                }
                toggleSidebarCollapsed();
            });
        });
        syncSidebarToggleTitle();

        initAiAssistant();
        bindAutobotImmersiveMode();

        qsa('[data-placeholder-form]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                alert('Этот модуль подключим следующим backend-слоем.');
            });
        });

        qsa('[data-placeholder-action]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                alert(button.dataset.placeholderAction || 'Функция будет подключена к API.');
            });
        });
    }

    function bindUserMenu() {
        var toggle = qs('[data-user-toggle]');
        var popover = qs('[data-user-popover]');
        if (!toggle || !popover || toggle.dataset.bound === '1') return;
        toggle.dataset.bound = '1';

        function closeMenu() {
            popover.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
        }

        function openMenu() {
            popover.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
        }

        toggle.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (popover.hidden) openMenu();
            else closeMenu();
        });

        popover.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        document.addEventListener('click', function () {
            closeMenu();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeMenu();
        });

        var profileButton = qs('[data-profile-open]', popover);
        if (profileButton && profileButton.dataset.bound !== '1') {
            profileButton.dataset.bound = '1';
            profileButton.addEventListener('click', function (event) {
                event.preventDefault();
                closeMenu();
                openProfileModal();
            });
        }
    }

    function profileNameParts(user) {
        var parts = String(user && user.name || '').trim().split(/\s+/).filter(Boolean);
        return {
            firstName: parts.length ? parts[0] : '',
            lastName: parts.length > 1 ? parts.slice(1).join(' ') : ''
        };
    }

    function profileAvatarInner(user) {
        user = user || {};
        var avatarUrl = safeAvatarUrl(user.avatarUrl || user.avatar_url);
        if (avatarUrl) {
            return '<img src="' + escapeHtml(avatarUrl) + '" alt="">';
        }
        return escapeHtml(profileUserInitials(user));
    }

    function renderProfileModalContent() {
        var user = state.currentUser || state.user || {};
        var parts = profileNameParts(user);
        var roleCode = normalizeRole(user.role);
        var roleLabel = currentRoleLabel(user);
        return '' +
            '<div class="calendar-modal-head profile-modal-head">' +
                '<p>Аккаунт</p>' +
                '<h3 id="profile-modal-title">Личный кабинет</h3>' +
            '</div>' +
            '<form class="profile-modal-form" data-profile-form>' +
                '<div class="profile-avatar-block">' +
                    '<button class="profile-avatar-preview" type="button" data-profile-avatar-pick aria-label="Сменить аватарку">' +
                        '<span data-profile-avatar-preview>' + profileAvatarInner(user) + '</span>' +
                        '<span class="profile-avatar-edit"><i data-lucide="pencil" aria-hidden="true"></i></span>' +
                    '</button>' +
                    '<input class="visually-hidden" type="file" name="avatar" accept="image/png,image/jpeg,image/webp,image/gif" data-profile-avatar-file>' +
                '</div>' +
                '<div class="profile-modal-grid">' +
                    '<label><span>Имя</span><input name="first_name" value="' + escapeHtml(parts.firstName) + '" autocomplete="given-name"></label>' +
                    '<label><span>Фамилия</span><input name="last_name" value="' + escapeHtml(parts.lastName) + '" autocomplete="family-name"></label>' +
                '</div>' +
                '<div class="profile-readonly-list text-muted">' +
                    '<div><span>Email</span><strong>' + escapeHtml(user.email || 'Не указан') + '</strong></div>' +
                    '<div><span>Телефон</span><strong>' + escapeHtml(user.phone || 'Не указан') + '</strong></div>' +
                    '<div><span>Роль</span><strong>' + escapeHtml(roleLabel) + '</strong>' + (roleCode === 'admin' ? '<b class="profile-admin-badge">АДМИН</b>' : '') + '</div>' +
                '</div>' +
                '<button class="primary profile-save-button" type="submit">Сохранить изменения</button>' +
            '</form>';
    }

    function closeProfileModal() {
        var modal = qs('[data-profile-modal]');
        document.body.classList.remove('cal-modal-open');
        if (!modal) return;
        window.setTimeout(function () {
            if (!document.body.classList.contains('cal-modal-open')) modal.hidden = true;
        }, 180);
    }

    function ensureProfileModal() {
        var modal = qs('[data-profile-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'calendar-modal-overlay profile-modal-overlay';
        modal.hidden = true;
        modal.setAttribute('data-profile-modal', '1');
        modal.innerHTML =
            '<section class="calendar-modal-card profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">' +
                '<button class="calendar-modal-close" type="button" data-profile-modal-close aria-label="Закрыть">×</button>' +
                '<div data-profile-modal-content></div>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target === modal || (event.target.closest && event.target.closest('[data-profile-modal-close]'))) {
                event.preventDefault();
                closeProfileModal();
            }
        });
        document.body.appendChild(modal);
        if (!document.body.dataset.profileModalEscBound) {
            document.body.dataset.profileModalEscBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && !qs('[data-profile-modal][hidden]')) closeProfileModal();
            });
        }
        return modal;
    }

    function bindProfileModal(modal) {
        var form = qs('[data-profile-form]', modal);
        var avatarFile = form ? qs('[data-profile-avatar-file]', form) : null;
        var avatarPreview = qs('[data-profile-avatar-preview]', modal);
        var avatarPick = qs('[data-profile-avatar-pick]', modal);
        if (avatarPick && avatarPick.dataset.bound !== '1') {
            avatarPick.dataset.bound = '1';
            avatarPick.addEventListener('click', function () {
                if (avatarFile) avatarFile.click();
            });
        }
        if (avatarFile && avatarFile.dataset.bound !== '1') {
            avatarFile.dataset.bound = '1';
            avatarFile.addEventListener('change', function () {
                var file = avatarFile.files && avatarFile.files[0];
                if (!file || !avatarPreview) return;
                if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type || '')) {
                    avatarFile.value = '';
                    showAppNotice('Выбери изображение PNG, JPG, WEBP или GIF', 'error');
                    return;
                }
                var previewUrl = URL.createObjectURL(file);
                safeReplaceChildren(avatarPreview, '<img src="' + escapeHtml(previewUrl) + '" alt="">');
            });
        }
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            withSubmitLock(form, function () {
                var formData = new FormData();
                formData.append('first_name', form.elements.first_name.value || '');
                formData.append('last_name', form.elements.last_name.value || '');
                if (avatarFile && avatarFile.files && avatarFile.files[0]) {
                    formData.append('avatar', avatarFile.files[0]);
                }
                return apiFormData('/api/auth/update-profile', formData).then(function (data) {
                    state.currentUser = data.user;
                    state.user = data.user;
                    syncCurrentUserHeader(data.user);
                    showAppNotice('Профиль обновлен', 'success');
                    closeProfileModal();
                });
            }).catch(function (error) {
                showAppNotice(appErrorMessage(error, 'Не удалось обновить профиль'), 'error');
            });
        });
    }

    function openProfileModal() {
        var modal = ensureProfileModal();
        var content = qs('[data-profile-modal-content]', modal);
        safeReplaceChildren(content, renderProfileModalContent());
        bindProfileModal(modal);
        modal.hidden = false;
        window.requestAnimationFrame(function () {
            document.body.classList.add('cal-modal-open');
        });
        refreshLucideIcons(modal);
    }

    function syncCurrentUserHeader(user) {
        user = user || state.currentUser || state.user || {};
        var name = displayUserName(user);
        var roleLabel = currentRoleLabel(user);
        var roleCode = normalizeRole(user.role);
        qsa('[data-current-user]').forEach(function (node) { node.textContent = name; });
        qsa('[data-current-role]').forEach(function (node) {
            node.textContent = roleLabel;
            node.classList.toggle('role-admin', roleCode === 'admin');
            node.classList.toggle('role-director', roleCode === 'director');
            node.classList.toggle('role-foreman', roleCode === 'foreman');
        });
        qsa('.topbar-avatar').forEach(function (node) {
            safeReplaceChildren(node, profileAvatarInner(user));
        });
    }

    function initAiAssistant() {
        var shell = qs('[data-ai-shell]');
        var openButton = qs('[data-ai-open]');
        var form = qs('[data-ai-form]');
        var input = form ? qs('textarea[name="message"]', form) : null;
        var voiceButton = qs('[data-ai-voice]');
        if (!shell || !openButton || !form || !input) return;

        function openAssistant() {
            shell.hidden = false;
            document.body.classList.add('ai-open');
            requestAnimationFrame(function () {
                shell.setAttribute('data-open', '1');
                setTimeout(function () {
                    input.focus();
                }, 40);
            });
        }

        function closeAssistant() {
            shell.setAttribute('data-open', '0');
            document.body.classList.remove('ai-open');
            setTimeout(function () {
                if (shell.getAttribute('data-open') !== '1') shell.hidden = true;
            }, 260);
        }

        if (openButton.dataset.bound !== '1') {
            openButton.dataset.bound = '1';
            openButton.addEventListener('click', openAssistant);
        }
        qsa('[data-ai-close]', shell).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', closeAssistant);
        });

        if (!document.body.dataset.aiEscapeBound) {
            document.body.dataset.aiEscapeBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && !shell.hidden) closeAssistant();
            });
        }

        qsa('[data-ai-prompt]', shell).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                input.value = button.dataset.aiPrompt || '';
                openAssistant();
            });
        });

        if (form.dataset.bound !== '1') {
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var text = input.value.trim();
                if (!text) return;
                appendAiMessage('user', state.user && state.user.name ? state.user.name : 'Вы', text);
                appendAiMessage('assistant', 'AI помощник', buildAiPlaceholderReply(text));
                input.value = '';
            });
        }

        if (voiceButton && voiceButton.dataset.bound !== '1') {
            voiceButton.dataset.bound = '1';
            voiceButton.addEventListener('click', function () {
                startAiVoiceInput(input, voiceButton);
            });
        }
    }

    function renderUser() {
        if (!state.user) return;
        state.currentUser = state.user;
        var userBadge = qs('[data-user-badge]');
        var name = displayUserName(state.user);
        syncCurrentUserHeader(state.user);
        if (userBadge) {
            var parts = String(name).trim().split(/\s+/).filter(Boolean);
            var initials = parts.slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join('') || 'U';
            userBadge.textContent = initials;
        }
    }

    function ensureProjectEditCard() {
        if (qs('[data-project-edit-card]')) return;
        document.body.insertAdjacentHTML('beforeend',
            '<div class="project-edit-modal" data-project-edit-card hidden>' +
                '<button class="project-edit-backdrop" type="button" data-close-project-edit aria-label="Закрыть окно редактирования"></button>' +
                '<section class="project-edit-dialog" aria-label="Редактирование объекта">' +
                    '<div class="card-head project-edit-head">' +
                        '<div>' +
                            '<span class="section-label">Объект</span>' +
                            '<h3>Редактировать объект</h3>' +
                        '</div>' +
                        '<button class="ghost" type="button" data-close-project-edit>Закрыть</button>' +
                    '</div>' +
                    '<form class="project-form" data-project-edit-form>' +
                        '<input name="project_id" type="hidden">' +
                        '<label><span>Название</span><input name="title" required></label>' +
                        '<label><span>Заказчик</span><input name="client_name" required></label>' +
                        '<label class="wide"><span>Адрес</span><input name="address" required></label>' +
                        '<label><span>Статус</span><input name="status"></label>' +
                        '<label><span>Договор</span><input name="contract_no"></label>' +
                        '<label><span>Бюджет</span><input name="budget" type="number" min="0" step="1"></label>' +
                        '<label><span>Старт</span><input name="started_at" type="date"></label>' +
                        '<label><span>Дедлайн</span><input name="deadline_at" type="date"></label>' +
                        '<label><span>Город</span><input name="city"></label>' +
                        '<label><span>Регион</span><input name="region"></label>' +
                        '<label class="wide"><span>Описание</span><textarea name="description" rows="4"></textarea></label>' +
                        '<div class="form-error" data-project-edit-error></div>' +
                        '<div class="project-edit-actions">' +
                            '<button class="danger" type="button" data-project-delete>Удалить объект</button>' +
                            '<button class="primary" type="submit">Сохранить</button>' +
                        '</div>' +
                    '</form>' +
                '</section>' +
            '</div>'
        );
    }

    function closeProjectEditCard() {
        var card = qs('[data-project-edit-card]');
        if (!card) return;
        card.hidden = true;
        card.setAttribute('data-open', '0');
        document.body.classList.remove('project-edit-open');
    }

    function openProjectEdit(projectId) {
        ensureProjectEditCard();
        var card = qs('[data-project-edit-card]');
        var form = qs('[data-project-edit-form]');
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!card || !form || !project) return;
        form.project_id.value = String(project.id);
        form.title.value = project.title || '';
        form.client_name.value = project.client_name || '';
        form.address.value = project.address || '';
        form.status.value = project.status || '';
        form.contract_no.value = project.contract_no || '';
        form.budget.value = project.budget == null ? '' : Number(project.budget);
        form.started_at.value = project.started_at || '';
        form.deadline_at.value = project.deadline_at || '';
        if (form.city) form.city.value = project.city || '';
        if (form.region) form.region.value = project.region || '';
        if (form.description) form.description.value = project.description || '';
        var error = qs('[data-project-edit-error]');
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        card.hidden = false;
        document.body.classList.add('project-edit-open');
        requestAnimationFrame(function () {
            card.setAttribute('data-open', '1');
            if (form.title && typeof form.title.focus === 'function') {
                setTimeout(function () {
                    form.title.focus();
                }, 40);
            }
        });
    }

    function bindProjectEditForm() {
        ensureProjectEditCard();
        qsa('[data-close-project-edit]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                closeProjectEditCard();
            });
        });

        var form = qs('[data-project-edit-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var projectId = Number(form.project_id.value);
            var error = qs('[data-project-edit-error]');
            if (error) error.classList.remove('active');
            var activeTab = qs('[data-tab].active');
            var activeTabName = activeTab ? activeTab.dataset.tab : 'overview';
            api('/api/projects/' + projectId + '/update', {
                method: 'POST',
                body: JSON.stringify({
                    title: form.title.value.trim(),
                    client_name: form.client_name.value.trim(),
                    address: form.address.value.trim(),
                    status: form.status.value.trim(),
                    contract_no: form.contract_no.value.trim(),
                    budget: form.budget.value === '' ? 0 : Number(form.budget.value || 0),
                    started_at: form.started_at.value,
                    deadline_at: form.deadline_at.value,
                    city: form.city ? form.city.value.trim() : '',
                    region: form.region ? form.region.value.trim() : '',
                    description: form.description ? form.description.value.trim() : ''
                })
            }).then(function (data) {
                updateProjectInState(data.project);
                renderProjectStats();
                renderProjectCritical();
                renderProjectList(state.projects);
                closeProjectEditCard();
                if (state.selectedProject && Number(state.selectedProject.id) === projectId) {
                    openProject(projectId);
                    activateProjectTab(activeTabName || 'overview');
                }
            }).catch(function (err) {
                if (!error) return;
                error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить объект';
                error.classList.add('active');
            });
        });

        var deleteButton = qs('[data-project-delete]');
        if (deleteButton && deleteButton.dataset.bound !== '1') {
            deleteButton.dataset.bound = '1';
            deleteButton.addEventListener('click', function () {
                var projectId = Number(form.project_id.value);
                if (!projectId) return;
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
                var projectTitle = project && project.title ? project.title : 'этот объект';
                if (!window.confirm('Удалить объект "' + projectTitle + '"? Это действие удалит связанные данные.')) return;
                var error = qs('[data-project-edit-error]');
                if (error) error.classList.remove('active');
                deleteButton.disabled = true;
                api('/api/projects/' + projectId + '/delete', {
                    method: 'POST'
                }).then(function () {
                    state.projects = state.projects.filter(function (item) {
                        return Number(item.id) !== projectId;
                    });
                    if (state.selectedProject && Number(state.selectedProject.id) === projectId) {
                        state.selectedProject = null;
                        var detail = qs('[data-project-detail]');
                        if (detail) detail.hidden = true;
                        setProjectFocusMode(false);
                    }
                    renderProjectStats();
                    renderProjectCritical();
                    renderProjectList(state.projects);
                    closeProjectEditCard();
                }).catch(function (err) {
                    if (!error) return;
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось удалить объект';
                    error.classList.add('active');
                }).finally(function () {
                    deleteButton.disabled = false;
                });
            });
        }

        if (!document.body.dataset.projectEditEscapeBound) {
            document.body.dataset.projectEditEscapeBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && document.body.classList.contains('project-edit-open')) {
                    closeProjectEditCard();
                }
            });
        }
    }

    function ensureProjectWorksSurface() {
        var tabsRoot = qs('.tabs', qs('[data-project-detail]') || document);
        if (tabsRoot && !qs('[data-tab="works"]', tabsRoot)) {
            var materialsTab = qs('[data-tab="materials"]', tabsRoot);
            if (materialsTab) {
                materialsTab.insertAdjacentHTML('afterend', '<button class="tab" data-tab="works">Работы</button>');
            } else {
                tabsRoot.insertAdjacentHTML('beforeend', '<button class="tab" data-tab="works">Работы</button>');
            }
        }
        var detail = qs('[data-project-detail]');
        if (detail && !qs('[data-panel="works"]', detail)) {
            var materialsPanel = qs('[data-panel="materials"]', detail);
            if (materialsPanel) {
                materialsPanel.insertAdjacentHTML('afterend', '<div class="tab-panel" data-panel="works"></div>');
            } else {
                detail.insertAdjacentHTML('beforeend', '<div class="tab-panel" data-panel="works"></div>');
            }
        }
    }

    function normalizeItemKindClient(value) {
        var text = String(value || '').trim().toLocaleLowerCase('ru');
        if (!text) return 'material';
        if (text.indexOf('work') !== -1 || text.indexOf('работ') !== -1 || text.indexOf('услуг') !== -1 || text.indexOf('service') !== -1 || text.indexOf('labor') !== -1) {
            return 'work';
        }
        return 'material';
    }

    function sectionTitleForMaterial(item) {
        return canonicalEstimateSectionTitle(item && (item.sectionTitle || item.section_title || item.stageTitle || item.sectionId));
    }

    function groupEstimateItemsBySection(items) {
        var groups = {};
        var order = [];
        items.forEach(function (item) {
            var sectionTitle = sectionTitleForMaterial(item);
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = [];
                order.push(sectionTitle);
            }
            groups[sectionTitle].push(item);
        });
        return order.map(function (sectionTitle) {
            return { sectionTitle: sectionTitle, items: groups[sectionTitle] };
        });
    }

    function renderMaterialsGrouped(items, projectId, insights) {
        if (!items.length) return '<p class="muted">Материалы по смете пока не загружены.</p>';
        var required = items.filter(function (item) { return item.supplyStatus === 'required'; }).length;
        var soon = items.filter(function (item) { return item.supplyStatus === 'soon'; }).length;
        var planned = items.filter(function (item) { return item.supplyStatus === 'planned'; }).length;
        var safe = items.filter(function (item) { return item.supplyStatus === 'in_stock'; }).length;
        var grouped = groupEstimateItemsBySection(items);
        return '<div class="execution-summary">' +
            stat('Материалов', String(items.length)) +
            stat('Разделов', String(grouped.length)) +
            stat('Требуется', String(required), required ? 'danger' : '') +
            stat('Скоро', String(soon), soon ? 'warn' : '') +
            stat('План', String(planned), planned ? 'warn' : '') +
            stat('В наличии', String(safe)) +
        '</div>' +
        grouped.map(function (group) {
            return '<section class="subsection">' +
                '<div class="card-head"><h3>' + escapeHtml(group.sectionTitle) + '</h3><span class="muted">' + escapeHtml(String(group.items.length) + ' поз.') + '</span></div>' +
                '<div class="materials-list">' + group.items.map(function (item) {
                    return materialRow(item, projectId, insights[Number(item.id)] || null);
                }).join('') + '</div>' +
            '</section>';
        }).join('');
    }

    function buildStageMaps(stages) {
        var stageMap = {};
        var childrenMap = {};
        stages.forEach(function (stage) {
            stageMap[Number(stage.id)] = stage;
            var parentId = Number(stage.parent_id || 0);
            if (!childrenMap[parentId]) childrenMap[parentId] = [];
            childrenMap[parentId].push(stage);
        });
        return { stageMap: stageMap, childrenMap: childrenMap };
    }

    function stageRootSection(stage, stageMap) {
        var current = stage;
        var root = stage;
        var guard = 0;
        while (current && Number(current.parent_id || 0) && guard < 32) {
            current = stageMap[Number(current.parent_id || 0)];
            if (!current) break;
            root = current;
            guard += 1;
        }
        return root;
    }

    function stageTrail(stage, stageMap) {
        var parts = [];
        var current = stage;
        var guard = 0;
        while (current && guard < 32) {
            parts.unshift(String(current.title || '').trim());
            var parentId = Number(current.parent_id || 0);
            if (!parentId) break;
            current = stageMap[parentId];
            guard += 1;
        }
        return parts;
    }

    function renderEstimateWorkRow(item) {
        var meta = [
            'По смете: ' + item.plannedQty + ' ' + escapeHtml(item.unit || ''),
            item.notes ? item.notes : ''
        ].filter(Boolean).join(' • ');
        return '<div class="material-row">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta) + '</small></div>' +
            '<div class="material-chain-side"><span class="badge">Работа</span></div>' +
        '</div>';
    }

    function renderStageWorkRow(stage, stageMap) {
        var progress = percent(stage.progress);
        var path = stageTrail(stage, stageMap);
        var meta = [
            path.length > 1 ? path.slice(1, -1).join(' / ') : '',
            stage.responsible || '',
            stage.planned_start || '',
            stage.planned_end || ''
        ].filter(Boolean).join(' • ');
        return '<div class="material-row">' +
            '<div><b>' + escapeHtml(stage.title || 'Работа') + '</b><small>' + escapeHtml(meta || 'Без дополнительных данных') + '</small></div>' +
            '<div class="material-chain-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' • ' + progress + '%</span></div>' +
        '</div>';
    }

    function syncDrawerBodyState() {
        var hasOpenDrawer = qsa('.side-drawer[data-open="1"], .project-edit-modal[data-open="1"]').length > 0;
        document.body.classList.toggle('side-drawer-open', hasOpenDrawer);
        document.body.classList.toggle('reports-drawer-open', !!qs('[data-drawer-id="project-report-create"][data-open="1"]'));
    }

    function openSideDrawer(drawer) {
        if (!drawer) return;
        qsa('.side-drawer[data-open="1"]').forEach(function (node) {
            if (node !== drawer) closeSideDrawer(node);
        });
        drawer.hidden = false;
        requestAnimationFrame(function () {
            drawer.setAttribute('data-open', '1');
            syncDrawerBodyState();
        });
    }

    function closeSideDrawer(drawer) {
        if (!drawer) return;
        drawer.setAttribute('data-open', '0');
        setTimeout(function () {
            if (drawer.getAttribute('data-open') !== '1') {
                drawer.hidden = true;
            }
            syncDrawerBodyState();
        }, 220);
        syncDrawerBodyState();
    }

    function ensureSideDrawerFromCard(cardSelector, drawerId, options) {
        options = options || {};
        var existing = qs('[data-drawer-id="' + drawerId + '"]');
        if (existing) return existing;
        var card = qs(cardSelector);
        if (!card) return null;
        var wrapper = document.createElement('div');
        wrapper.className = 'side-drawer';
        wrapper.hidden = true;
        wrapper.setAttribute('data-drawer-id', drawerId);
        wrapper.innerHTML =
            '<button class="side-drawer-backdrop" type="button" data-drawer-close aria-label="' + escapeHtml(options.closeLabel || 'Закрыть окно') + '"></button>' +
            '<section class="side-drawer-panel"></section>';
        var panel = qs('.side-drawer-panel', wrapper);
        if (options.panelClass) panel.classList.add(options.panelClass);
        card.hidden = false;
        card.classList.add('side-drawer-card');
        if (options.cardClass) card.classList.add(options.cardClass);
        if (options.stripOverviewSection) card.removeAttribute('data-project-overview-section');
        panel.appendChild(card);
        document.body.appendChild(wrapper);

        qsa('[data-drawer-close]', wrapper).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                closeSideDrawer(wrapper);
            });
        });

        if (!document.body.dataset.sideDrawerEscapeBound) {
            document.body.dataset.sideDrawerEscapeBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key !== 'Escape') return;
                var activeDrawer = qsa('.side-drawer[data-open="1"]').slice(-1)[0];
                if (activeDrawer) closeSideDrawer(activeDrawer);
            });
        }
        return wrapper;
    }

    function ensureLogCreateDrawer() {
        var pageHead = qs('.page-head');
        if (pageHead && !qs('[data-open-log-create]')) {
            pageHead.insertAdjacentHTML('beforeend', '<button class="primary" type="button" data-open-log-create>Добавить отчёт</button>');
        }
        var card = qs('[data-log-create-card]');
        if (card) {
            var cardHead = qs('.card-head', card);
            if (cardHead && !qs('[data-close-log-create]', cardHead)) {
                cardHead.insertAdjacentHTML('beforeend', '<button class="ghost" type="button" data-close-log-create>Закрыть</button>');
            }
        }
        var drawer = ensureSideDrawerFromCard('[data-log-create-card]', 'log-create', {
            closeLabel: 'Закрыть форму отчёта'
        });
        var open = qs('[data-open-log-create]');
        var close = qs('[data-close-log-create]');
        if (open && drawer && open.dataset.bound !== '1') {
            open.dataset.bound = '1';
            open.addEventListener('click', function () {
                openSideDrawer(drawer);
            });
        }
        if (close && drawer && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', function (event) {
                event.preventDefault();
                closeSideDrawer(drawer);
            });
        }
        return drawer;
    }

    function closeProjectEditCard() {
        var card = qs('[data-project-edit-card]');
        if (!card) return;
        card.setAttribute('data-open', '0');
        document.body.classList.remove('project-edit-open');
        setTimeout(function () {
            if (card.getAttribute('data-open') !== '1') {
                card.hidden = true;
            }
            syncDrawerBodyState();
        }, 220);
        syncDrawerBodyState();
    }

    function openProjectEdit(projectId) {
        ensureProjectEditCard();
        var card = qs('[data-project-edit-card]');
        var form = qs('[data-project-edit-form]');
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!card || !form || !project) return;
        form.project_id.value = String(project.id);
        form.title.value = project.title || '';
        form.client_name.value = project.client_name || '';
        form.address.value = project.address || '';
        form.status.value = project.status || '';
        form.contract_no.value = project.contract_no || '';
        form.budget.value = project.budget == null ? '' : Number(project.budget);
        form.started_at.value = project.started_at || '';
        form.deadline_at.value = project.deadline_at || '';
        if (form.city) form.city.value = project.city || '';
        if (form.region) form.region.value = project.region || '';
        if (form.description) form.description.value = project.description || '';
        var error = qs('[data-project-edit-error]');
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        card.hidden = false;
        document.body.classList.add('project-edit-open');
        requestAnimationFrame(function () {
            card.setAttribute('data-open', '1');
            syncDrawerBodyState();
            if (form.title && typeof form.title.focus === 'function') {
                setTimeout(function () {
                    form.title.focus();
                }, 40);
            }
        });
    }

    function bindProjectCreate() {
        var open = qs('[data-open-project-create]');
        var close = qs('[data-close-project-create]');
        var drawer = ensureSideDrawerFromCard('[data-project-create-card]', 'project-create', {
            closeLabel: 'Закрыть форму создания объекта',
            stripOverviewSection: true
        });
        var form = qs('[data-project-create-form]');
        if (open && drawer && open.dataset.bound !== '1') {
            open.dataset.bound = '1';
            open.addEventListener('click', function () {
                openSideDrawer(drawer);
            });
        }
        if (close && drawer && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', function (event) {
                event.preventDefault();
                closeSideDrawer(drawer);
            });
        }
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-project-create-error]');
            if (error) error.classList.remove('active');
            withSubmitLock(form, function () {
                return api('/api/projects', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: form.title.value.trim(),
                        address: form.address.value.trim(),
                        client_name: form.client_name.value.trim(),
                        customer_company_id: form.customer_company_id ? form.customer_company_id.value : '',
                        own_legal_entity_id: form.own_legal_entity_id ? form.own_legal_entity_id.value : '',
                        city: form.city ? form.city.value.trim() : '',
                        region: form.region ? form.region.value.trim() : '',
                        contract_no: form.contract_no.value.trim(),
                        contract_date: form.contract_date ? form.contract_date.value : '',
                        budget: Number(form.budget.value || 0),
                        started_at: form.started_at.value,
                        deadline_at: form.deadline_at.value,
                        description: form.description ? form.description.value.trim() : ''
                    })
                }).then(function (data) {
                    form.reset();
                    closeSideDrawer(drawer);
                    state.projects.unshift(data.project);
                    bindProjectBootstrapForm();
                    var bootstrapSelect = qs('[data-bootstrap-projects]');
                    if (bootstrapSelect) bootstrapSelect.value = String(data.project.id);
                    renderProjectStats();
                    renderProjectCritical();
                    renderProjectList(state.projects);
                    showAppNotice('\u041e\u0431\u044a\u0435\u043a\u0442 \u0441\u043e\u0437\u0434\u0430\u043d.', 'success');
                }).catch(function (err) {
                    var message = appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442');
                    if (error) {
                        error.textContent = message;
                        error.classList.add('active');
                    }
                    showAppNotice(message, 'error');
                });
            });
        });
    }

    function renderLogsPage() {
        var list = qs('[data-logs-list]');
        if (!list) return;
        if (!state.projects.length) {
            list.innerHTML = '<p class="muted">Нет объектов для журнала работ.</p>';
            return;
        }
        var projectSelect = qs('[data-logs-project]');
        var formProjectSelect = qs('[data-log-projects]');
        var options = state.projects.map(function (project) {
            return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
        }).join('');
        if (projectSelect) projectSelect.innerHTML = options;
        if (formProjectSelect) formProjectSelect.innerHTML = options;
        var dateInput = qs('[data-log-form] input[name="report_date"]');
        if (dateInput && !dateInput.value) dateInput.value = APP_TODAY;

        if (state.user && (hasRole('customer') || hasRole('purchaser'))) {
            var createCard = qs('[data-log-create-card]');
            if (createCard) createCard.remove();
            var drawer = qs('[data-drawer-id="log-create"]');
            if (drawer) drawer.remove();
            var openButton = qs('[data-open-log-create]');
            if (openButton) openButton.remove();
        } else {
            ensureLogCreateDrawer();
            bindLogForm();
        }

        function loadSelected() {
            var projectId = Number(projectSelect && projectSelect.value ? projectSelect.value : state.projects[0].id);
            var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || state.projects[0];
            if (formProjectSelect) formProjectSelect.value = String(projectId);
            loadProjectLogs(project.id, function (logs) {
                loadProjectNotifications(project.id, function (notifications) {
                    if (!state.logsSelectedDateByProject[projectId]) {
                        state.logsSelectedDateByProject[projectId] = (logs[0] && logs[0].report_date) || project.started_at || APP_TODAY;
                    }
                    renderLogsStats(logs, notifications);
                    renderLogsAlerts(notifications);
                    renderLogsCalendar(project, logs);
                    renderLogsList(project, logs);
                });
            });
        }
        if (projectSelect && projectSelect.dataset.bound !== '1') {
            projectSelect.dataset.bound = '1';
            projectSelect.addEventListener('change', loadSelected);
        }
        loadSelected();
    }




    function groupMaterialsBySection(items) {
        var groups = {};
        var order = [];
        (items || []).forEach(function (item) {
            var sectionTitle = sectionTitleForMaterial(item);
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = [];
                order.push(sectionTitle);
            }
            groups[sectionTitle].push(item);
        });
        return order.map(function (title) {
            return { title: title, items: groups[title] };
        });
    }

    function buildStageLookup(stages) {
        var map = {};
        (stages || []).forEach(function (stage) {
            map[Number(stage.id)] = stage;
        });
        return map;
    }

    function materialSectionLabel(index) {
        return 'Раздел ' + String(index + 1);
    }

    function renderMaterialSupplierPicker(projectId, item, insight) {
        if (!canManageSuppliers()) return '';
        var options = insight && Array.isArray(insight.options) ? insight.options : [];
        var isSelected = !!(insight && insight.selectedOfferId);
        return '<div class="material-supplier-picker">' +
            '<button class="ghost material-link compact' + (isSelected ? ' is-selected' : '') + '" type="button" data-supplier-toggle data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(item.id) + '">' + (isSelected ? 'Поставщик выбран' : 'Поставщик') + '</button>' +
            '<div class="material-supplier-menu" data-supplier-menu hidden>' +
                (options.length ? options.map(function (option) {
                    var meta = [option.company, option.price > 0 ? (finalSectionSummaryNumber(option.price) + ' ₽') : ''].filter(Boolean).join(' • ');
                    return '<button class="material-supplier-option' + (option.status === 'selected' ? ' is-selected' : '') + '" type="button" ' +
                        'data-supplier-select ' +
                        'data-project-id="' + escapeHtml(projectId) + '" ' +
                        'data-material-id="' + escapeHtml(item.id) + '" ' +
                        'data-offer-id="' + escapeHtml(option.id) + '" ' +
                        'data-status="' + escapeHtml(option.status) + '" ' +
                        'data-price="' + escapeHtml(option.price) + '" ' +
                        'data-qty="' + escapeHtml(option.qty) + '" ' +
                        'data-phone="' + escapeHtml(option.phone) + '" ' +
                        'data-source-url="' + escapeHtml(option.sourceUrl) + '" ' +
                        'data-notes="' + escapeHtml(option.notes) + '">' +
                        '<strong>' + escapeHtml(option.name) + '</strong>' +
                        (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') +
                    '</button>';
                }).join('') : '<div class="material-supplier-empty">Нет поставщиков</div>') +
            '</div>' +
        '</div>';
    }

    function rootSectionTitleForStage(stage, stageMap) {
        if (!stage) return 'Без раздела';
        var current = stage;
        var root = stage;
        var guard = 0;
        while (current && current.parent_id && stageMap[Number(current.parent_id)] && guard < 24) {
            current = stageMap[Number(current.parent_id)];
            root = current;
            guard += 1;
        }
        return String((root && root.title) || stage.title || 'Без раздела').trim() || 'Без раздела';
    }

    function stagePathLabel(stage, stageMap) {
        var parts = [];
        var current = stage;
        var guard = 0;
        while (current && current.parent_id && stageMap[Number(current.parent_id)] && guard < 24) {
            current = stageMap[Number(current.parent_id)];
            if (current && current.parent_id) parts.push(current.title);
            guard += 1;
        }
        return parts.reverse().join(' • ');
    }

    function renderGroupedMaterials(groups, projectId, insights) {
        return '<div class="estimate-section-list">' + groups.map(function (group, index) {
            var originalTitle = canonicalEstimateSectionTitle(group.title);
            return '<section class="estimate-section">' +
                '<div class="card-head estimate-section-head"><div class="estimate-section-title"><h3>' + escapeHtml(materialSectionLabel(index)) + '</h3><span class="badge estimate-section-count">' + escapeHtml(group.items.length) + ' поз.</span></div>' + (originalTitle ? '<small>' + escapeHtml(originalTitle) + '</small>' : '') + '</div>' +
                '<div class="materials-list">' + group.items.map(function (item) {
                    return materialRow(item, projectId, insights[Number(item.id)] || null);
                }).join('') + '</div>' +
            '</section>';
        }).join('') + '</div>';
    }

    function renderEstimateWorkItem(item) {
        var meta = [
            item.unit ? ('Ед.: ' + item.unit) : '',
            item.plannedQty ? ('Объём: ' + item.plannedQty) : '',
            item.stageTitle ? ('Этап: ' + item.stageTitle) : ''
        ].filter(Boolean).join(' • ');
        return '<div class="material-row work-row">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta || 'Работа из сметы') + (item.notes ? '<br>' + escapeHtml(item.notes) : '') + '</small></div>' +
            '<div class="material-chain-side"><span class="badge">' + escapeHtml((item.plannedQty || 0) + ' ' + (item.unit || 'ед.')) + '</span></div>' +
        '</div>';
    }

    function loadSectionScheduleForecast(projectId, startDate, callback, force) {
        state.sectionScheduleByProject = state.sectionScheduleByProject || {};
        var requestedStart = startDate || APP_TODAY;
        var cached = state.sectionScheduleByProject[projectId];
        if (!force && cached && cached.startDate === requestedStart) {
            callback(cached);
            return;
        }
        api('/api/projects/' + projectId + '/section-schedule-forecast', {
            method: 'POST',
            body: JSON.stringify({ start_date: requestedStart })
        }).then(function (data) {
            state.sectionScheduleByProject[projectId] = data || null;
            callback(data || null);
        }).catch(function (err) {
            state.sectionScheduleByProject[projectId] = {
                error: err && err.payload && err.payload.error ? err.payload.error : 'Не удалось рассчитать график по смете',
                startDate: requestedStart,
                sections: []
            };
            callback(state.sectionScheduleByProject[projectId]);
        });
    }

    function finalSectionScheduleCardClass(section) {
        var start = String(section.startDate || '').trim();
        var end = String(section.endDate || '').trim();
        if (start && end && start <= APP_TODAY && end >= APP_TODAY) return ' is-current';
        if (end && end < APP_TODAY) return ' is-past';
        if (start && start > APP_TODAY) return ' is-upcoming';
        return '';
    }

    function sectionAccelerationHint(section) {
        var days = Number(section.estimatedDays || 0);
        var crew = Number(section.crewSize || 0);
        var itemsCount = liveScheduleSectionItems(section).length;
        if (section.hasAssumptions) return 'Уточнить объем и фронт до старта, чтобы убрать лишний запас по сроку.';
        if (days >= 12) return 'Разбить на захватки и вести параллельно двумя звеньями.';
        if (days >= 6) return crew >= 4
            ? 'Вынести подготовку и поставку до старта, чтобы бригада шла без пауз.'
            : 'Добавить людей на пиковые дни и закрыть материалы заранее.';
        if (itemsCount >= 10) return 'Подтвердить материалы и допуск заранее, чтобы не терять день на вход.';
        return 'Запускать раздел без пауз: материалы, доступ и люди должны быть подтверждены заранее.';
    }

    function sectionAccelerationShortHint(section) {
        var days = Number(section.estimatedDays || 0);
        var crew = Number(section.crewSize || 0);
        var itemsCount = liveScheduleSectionItems(section).length;
        if (section.hasAssumptions) return 'Уточнить объем до старта';
        if (days >= 12) return 'Разбить на захватки';
        if (days >= 6) return crew >= 4 ? 'Убрать паузы до старта' : 'Усилить бригаду';
        if (itemsCount >= 10) return 'Материалы и допуск заранее';
        return 'Запуск без пауз';
    }

    function renderSectionScheduleBrief(section) {
        return '<article class="section-schedule-brief' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-brief-head">' +
                '<h4>' + escapeHtml(section.title) + '</h4>' +
                '<small>' + escapeHtml((section.startDate || '—') + ' - ' + (section.endDate || '—')) + '</small>' +
            '</div>' +
            '<div class="section-schedule-brief-duration"><strong>' + escapeHtml(String(section.estimatedDays || 0)) + '</strong><span>дн.</span></div>' +
            '<p><span>Ускорение:</span> ' + escapeHtml(sectionAccelerationShortHint(section)) + '</p>' +
        '</article>';
    }

    function initShell() {
        applySidebarPreference();
        try {
            document.documentElement.classList.remove('sidebar-pref-collapsed');
            if (page !== 'projects') {
                document.documentElement.classList.remove('project-route-loading');
            } else {
                var initialProjectParams = new URLSearchParams(location.search);
                if (!Number(initialProjectParams.get('openProject') || 0)) {
                    document.documentElement.classList.remove('project-route-loading');
                }
            }
        } catch (error) {
            document.documentElement.classList.remove('sidebar-pref-collapsed');
            document.documentElement.classList.remove('project-route-loading');
        }
        api('/api/auth/me').then(function (data) {
            state.user = data.user;
            renderUser();
            applyRole();
            refreshLucideIcons(document);
            initPage();
        }).catch(function () {
            location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
        });

        var logout = qs('[data-logout]');
        if (logout && logout.dataset.bound !== '1') {
            logout.dataset.bound = '1';
            logout.addEventListener('click', function () {
                if (isClerkEnabled()) {
                    loadClerk().then(function (clerk) {
                        return api('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
                            return clerk ? clerk.signOut({ redirectUrl: state.authConfig.clerkAfterSignOutUrl || '/login' }) : null;
                        });
                    }).catch(function () {
                        location.replace('/login');
                    });
                    return;
                }
                api('/api/auth/logout', { method: 'POST' }).finally(function () {
                    location.replace('/login');
                });
            });
        }

        qsa('[data-menu-toggle], [data-sidebar-toggle]').forEach(function (toggle) {
            if (toggle.dataset.bound === '1') return;
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', function (event) {
                event.preventDefault();
                if (window.innerWidth <= 720) {
                    document.body.classList.toggle('menu-open');
                    return;
                }
                toggleSidebarCollapsed();
            });
        });
        syncSidebarToggleTitle();
        bindUserMenu();
        initAiAssistant();
        bindAutobotImmersiveMode();

        qsa('[data-placeholder-form]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                alert('Этот модуль подключим следующим backend-слоем.');
            });
        });

        qsa('[data-placeholder-action]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                alert(button.dataset.placeholderAction || 'Функция будет подключена к API.');
            });
        });
    }

    renderEstimateWorkRow = function (item) {
        var meta = [
            'По смете: ' + item.plannedQty + ' ' + escapeHtml(item.unit || '')
        ].filter(Boolean).join(' • ');
        return '<div class="material-row">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta) + '</small></div>' +
            '<div class="material-chain-side"><span class="badge">Работа</span></div>' +
        '</div>';
    };


    renderProjectReportForm = function (project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card">' +
            '<div class="report-drawer-caption">Новый отчет</div>' +
            '<div class="card-head"><div><h3>Новый отчет за день</h3><span class="muted">Фиксируем факт работ, поставки, блокеры и прогресс объекта без лишней бюрократии.</span></div></div>' +
            '<form class="project-form report-intake-form report-chat-form" data-log-form>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<div class="report-chat-header">' +
                    '<label><span>Дата</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                    '<label><span>Заголовок</span><input name="title" placeholder="Например: День 1 — старт работ и завоз материалов" required></label>' +
                '</div>' +
                '<div class="report-chat-composer">' +
                    '<div class="report-chat-role">Основной факт дня</div>' +
                    '<label class="report-chat-bubble-input">' +
                        '<span>Что сделали</span>' +
                        '<textarea name="work_done" rows="6" placeholder="Напиши как в чате: что закрыли, что завезли, что мешало, какой факт по объекту." required></textarea>' +
                    '</label>' +
                '</div>' +
                '<div class="report-chat-composer report-chat-composer-assistant">' +
                    '<div class="report-chat-role">Диктовка / черновик</div>' +
                    '<label class="report-chat-bubble-input assistant">' +
                        '<span>Текст для ассистента</span>' +
                        '<textarea name="raw_input" rows="4" placeholder="Можно просто надиктовать свободно: сегодня начали работы, завезли кабель, закрыли демонтаж, ждем поставку окон..."></textarea>' +
                    '</label>' +
                '</div>' +
                '<div class="report-facts-grid">' +
                    '<label><span>Людей на объекте</span><input name="workers_count" type="number" min="0" step="1" placeholder="0"></label>' +
                    '<label><span>Прогресс объекта, %</span><input name="progress_percent" type="number" min="0" max="100" step="1" placeholder="18"></label>' +
                    '<label><span>Видимость</span><select name="is_client_visible"><option value="1">Видно заказчику</option><option value="0">Внутренний отчет</option></select></label>' +
                    '<label class="wide"><span>Техника / поставки</span><input name="equipment" placeholder="Манипулятор, бетон, кабель, окна, вышка..."></label>' +
                    '<label><span>Блокеры</span><input name="blockers" placeholder="Что мешает идти дальше"></label>' +
                    '<label><span>Следующий шаг</span><input name="next_steps" placeholder="Что делаем дальше"></label>' +
                '</div>' +
                '<div class="assistant-confirm-card report-confirm-card">' +
                    '<b>Подтверждение</b>' +
                    '<div class="assistant-confirm-list">' +
                        '<span>Отчет сохранит факт дня и, если указан процент, обновит прогресс объекта.</span>' +
                        '<span>Дальше сюда подключим подтверждение изменений по материалам, работам и складу через AI-ассистента.</span>' +
                    '</div>' +
                    '<label class="check-inline report-confirm"><input type="checkbox" name="confirm_report" required> Подтверждаю сохранение отчета и обновление прогресса объекта</label>' +
                '</div>' +
                '<div class="form-error" data-log-error></div>' +
                '<div class="report-intake-actions">' +
                    '<button class="ghost" type="button" data-report-open-ai>Открыть ассистента</button>' +
                    '<button class="primary" type="submit">Сохранить отчет</button>' +
                '</div>' +
            '</form>' +
        '</section>';
    };

    function canDeleteProjectReport() {
        return !hasRole('customer');
    }

    function renderProjectReportDeleteButton(projectId, log, compact) {
        if (!canDeleteProjectReport() || !log || !log.id) return '';
        return '<button class="danger report-delete-btn' + (compact ? ' compact' : '') + '" type="button" data-report-delete="' + escapeHtml(log.id) + '" data-project-id="' + escapeHtml(projectId) + '" data-report-title="' + escapeHtml(log.title || 'Отчет') + '">Удалить</button>';
    }

    function refreshProjectReportViews(projectId) {
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;
        loadProjectLogs(projectId, function (logs) {
            loadProjectNotifications(projectId, function (notifications) {
                var selectedDate = state.logsSelectedDateByProject[projectId];
                if (!selectedDate || !logs.some(function (log) { return log.report_date === selectedDate; })) {
                    selectedDate = (logs[0] && logs[0].report_date) || project.started_at || APP_TODAY;
                    state.logsSelectedDateByProject[projectId] = selectedDate;
                    state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(selectedDate);
                }
                renderLogsStats(logs, notifications);
                renderLogsAlerts(notifications);
                renderLogsCalendar(project, logs);
                renderLogsList(project, logs);
            });
        });
    }

    function bindProjectReportDeleteActions() {
        qsa('[data-report-delete]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var projectId = Number(button.dataset.projectId || 0);
                var reportId = Number(button.dataset.reportDelete || 0);
                var reportTitle = button.dataset.reportTitle || 'этот отчет';
                if (!projectId || !reportId) return;
                if (!window.confirm('Удалить отчет "' + reportTitle + '"?')) return;
                var initialText = button.textContent;
                button.disabled = true;
                button.textContent = 'Удаляем...';
                api('/api/projects/' + projectId + '/daily-logs/' + reportId + '/delete', {
                    method: 'POST'
                }).then(function (data) {
                    if (data && data.project) {
                        updateProjectInState(data.project);
                        renderProjectStats();
                        renderProjectCritical();
                        renderProjectList(state.projects);
                    }
                    refreshProjectReportViews(projectId);
                }).catch(function (err) {
                    window.alert(err && err.payload && err.payload.error ? err.payload.error : 'Не удалось удалить отчет');
                }).finally(function () {
                    button.disabled = false;
                    button.textContent = initialText;
                });
            });
        });
    }

    renderLogsDayView = function (project, logs) {
        var root = qs('[data-logs-day-view]');
        if (!root || !project) return;
        var projectId = Number(project.id);
        var selectedDate = state.logsSelectedDateByProject[projectId] || (logs[0] && logs[0].report_date) || APP_TODAY;
        var selectedLogs = logs.filter(function (log) { return log.report_date === selectedDate; });
        if (!selectedLogs.length) {
            root.innerHTML =
                '<div class="logs-day-panel report-chat-panel">' +
                    '<div class="logs-day-panel-head"><b>' + escapeHtml(formatRuDate(selectedDate)) + '</b><span class="badge">0</span></div>' +
                    '<div class="report-chat-empty">' +
                        '<b>За этот день пока пусто</b>' +
                        '<p class="muted">Выбери день в календаре и добавь первый отчет. Дальше здесь будет живая лента по объекту.</p>' +
                    '</div>' +
                '</div>';
            return;
        }
        root.innerHTML =
            '<div class="logs-day-panel report-chat-panel">' +
                '<div class="logs-day-panel-head"><b>' + escapeHtml(formatRuDate(selectedDate)) + '</b><span class="badge">' + selectedLogs.length + ' шт.</span></div>' +
                '<div class="report-chat-list">' + selectedLogs.map(function (log) {
                    return '<article class="report-chat-message">' +
                        '<div class="report-chat-meta">' +
                            '<div><span>' + escapeHtml(log.author_name || '—') + '</span><h4>' + escapeHtml(log.title) + '</h4></div>' +
                            '<div class="report-chat-side">' +
                                '<div class="project-badges">' +
                                    (log.progress_percent != null && log.progress_percent !== '' ? '<span class="badge success">' + escapeHtml(Math.round(Number(log.progress_percent) || 0)) + '%</span>' : '') +
                                    '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + (Number(log.is_client_visible) === 1 ? 'Заказчику' : 'Внутренний') + '</span>' +
                                '</div>' +
                                renderProjectReportDeleteButton(projectId, log, true) +
                            '</div>' +
                        '</div>' +
                        '<div class="report-chat-bubble">' +
                            '<p>' + escapeHtml(log.work_done) + '</p>' +
                            '<div class="log-details">' +
                                (log.equipment ? '<div><span>Техника / поставки</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                                (log.blockers ? '<div class="log-risk"><span>Блокер</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                                (log.next_steps ? '<div><span>Дальше</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                            '</div>' +
                            (log.raw_input ? '<small class="muted">Диктовка / исходный ввод: ' + escapeHtml(log.raw_input) + '</small>' : '') +
                        '</div>' +
                        '<small class="report-chat-date">' + escapeHtml(log.report_date || '—') + '</small>' +
                    '</article>';
                }).join('') + '</div>' +
            '</div>';
        bindProjectReportDeleteActions();
    };


    function finalGraphDate(iso) {
        return formatDisplayDate(iso);
    }

    function finalSectionSummaryNumber(value) {
        var number = Number(value || 0);
        if (!isFinite(number)) return '0';
        var rounded = Math.round(number * 10) / 10;
        return Math.abs(rounded - Math.round(rounded)) < 0.001 ? String(Math.round(rounded)) : String(rounded);
    }

    function finalSectionSummaryTitle(title) {
        var clean = String(title || '').trim();
        if (!clean) return '';
        return clean.length > 72 ? (clean.slice(0, 69) + '...') : clean;
    }

    function finalSectionWorkDigest(section) {
        var items = Array.isArray(section.items) ? section.items : [];
        var workCount = liveScheduleSectionItems(section).length;
        var kinds = {};
        var volumes = {};
        var topTitles = [];

        items.forEach(function (item) {
            var title = String(item.title || '').trim();
            if (title) {
                if (topTitles.length < 3) topTitles.push(finalSectionSummaryTitle(title));
                var firstWord = title.replace(/^[^A-Za-z\\u0400-\\u04FF0-9]+/, '').split(/\\s+/)[0].toLowerCase();
                if (firstWord) kinds[firstWord] = (kinds[firstWord] || 0) + 1;
            }
            var qty = Number(item.planned_qty != null ? item.planned_qty : item.plannedQty);
            var unit = String(item.unit || '').trim();
            if (unit && isFinite(qty) && qty > 0) {
                volumes[unit] = (volumes[unit] || 0) + qty;
            }
        });

        var topKinds = Object.keys(kinds).sort(function (left, right) {
            return kinds[right] - kinds[left];
        }).slice(0, 3).map(function (word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        });

        var lead = workCount ? (String(workCount) + ' работ') : 'Работы по разделу';
        if (topKinds.length) lead += ': ' + topKinds.join(', ');

        var volumeLine = Object.keys(volumes).sort(function (left, right) {
            return volumes[right] - volumes[left];
        }).slice(0, 3).map(function (unit) {
            return finalSectionSummaryNumber(volumes[unit]) + ' ' + unit;
        }).join(' • ');

        return {
            lead: lead,
            volume: volumeLine ? ('Объемы: ' + volumeLine) : '',
            titles: topTitles.join(' • ')
        };
    }

    renderScheduleScale = function (range) {
        var marks = [];
        var steps = range.totalDays <= 4 ? range.totalDays : 5;
        for (var index = 0; index < steps; index += 1) {
            var offset = steps === 1 ? 0 : Math.round(((range.totalDays - 1) * index) / (steps - 1));
            var iso = addDaysToIso(range.start, offset);
            var left = range.totalDays === 1 ? 0 : (offset / (range.totalDays - 1)) * 100;
            var sideClass = index === 0 ? ' is-start' : (index === steps - 1 ? ' is-end' : '');
            var label = finalGraphDate(iso);
            marks.push('<span class="schedule-gantt-mark' + sideClass + '" style="left:' + left + '%"><i></i><b>' + escapeHtml(label) + '</b></span>');
        }
        return '<div class="schedule-gantt-scale"><div class="schedule-gantt-scale-line"></div>' + marks.join('') + '</div>' +
            '<div class="schedule-gantt-legend"><span><i class="legend-dot"></i> контрольные даты</span><span><i class="legend-bar"></i> окно раздела</span><span><i class="legend-today"></i> сегодня</span></div>';
    };

    renderSectionScheduleBrief = function (section) {
        var digest = finalSectionWorkDigest(section);
        return '<article class="section-schedule-brief' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-brief-head">' +
                '<h4>' + escapeHtml(section.title) + '</h4>' +
                '<small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small>' +
            '</div>' +
            '<div class="section-schedule-brief-duration"><strong>' + escapeHtml(String(section.estimatedDays || 0)) + '</strong><span>дн.</span></div>' +
            '<p>' + escapeHtml(digest.lead + (digest.volume ? (' • ' + digest.volume) : '')) + '</p>' +
        '</article>';
    };

    function scheduleChecklistStorageKey(projectId) {
        return 'pmbi.schedule.checklist.' + String(projectId || '');
    }

    function scheduleSectionStateStorageKey(projectId) {
        return 'pmbi.schedule.sections.' + String(projectId || '');
    }

    function readStoredJson(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || '{}');
        } catch (error) {
            return {};
        }
    }

    function writeStoredJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value || {}));
        } catch (error) {
            return;
        }
    }

    function scheduleBriefStorageKey(projectId) {
        return 'pmbi.schedule.brief.' + String(projectId || '');
    }

    function isScheduleBriefPinned(projectId) {
        var map = readStoredJson(scheduleBriefStorageKey(projectId));
        return map.pinned === 1;
    }

    function setScheduleBriefPinned(projectId, isPinned) {
        var map = readStoredJson(scheduleBriefStorageKey(projectId));
        map.pinned = isPinned ? 1 : 0;
        map.updatedAt = new Date().toISOString();
        writeStoredJson(scheduleBriefStorageKey(projectId), map);
    }

    function scheduleSectionRoundedHours(section) {
        var hours = Number(section && (section.bufferedHours || section.estimatedHours || 0));
        if (!Number.isFinite(hours)) return 0;
        return Math.round(hours);
    }

    function scheduleSectionDays(section) {
        var days = Number(section && (section.estimatedDays || section.durationDays || section.days || 0));
        if (Number.isFinite(days) && days > 0) return Math.round(days);
        var start = section && section.startDate;
        var end = section && section.endDate;
        var calculated = start && end ? daysBetween(start, end) : 0;
        return Math.max(0, Math.round(Number(calculated || 0)));
    }

    function scheduleSectionDurationLabel(section) {
        return String(scheduleSectionDays(section)) + ' дней (' + String(scheduleSectionRoundedHours(section)) + ' чел.-ч)';
    }

    function renderPinnedScheduleBrief(project, summary, sections) {
        return '';
        if (!project || !isScheduleBriefPinned(project.id)) return '';
        if (!summary || summary.error) {
            return '<div class="schedule-brief-table-wrap"><div class="schedule-brief-title"><strong>Краткий график</strong><span>Появится после расчета разделов.</span></div></div>';
        }
        var rows = (sections || []).map(function (section) {
            var progress = scheduleSectionProgress(project.id, section);
            return '<div class="schedule-brief-row">' +
                '<b>' + escapeHtml(section.title || 'Раздел') + '</b>' +
                '<span>' + escapeHtml(String(scheduleSectionDays(section))) + '</span>' +
                '<strong>' + escapeHtml(String(progress.percent || 0) + '%') + '</strong>' +
            '</div>';
        }).join('');
        return '<div class="schedule-brief-table-wrap">' +
            '<div class="schedule-brief-title"><strong>Краткий график</strong></div>' +
            '<div class="schedule-brief-row schedule-brief-head"><b>Раздел</b><span>Дней</span><strong>% выполнения</strong></div>' +
            rows +
        '</div>';
    }

    function normalizedWorkKeyPart(value) {
        return String(value == null ? '' : value).trim().toLowerCase();
    }

    function normalizedWorkQty(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) return normalizedWorkKeyPart(value);
        return String(Math.round(number * 1000) / 1000);
    }

    function formattedWorkQty(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) return String(value || '0');
        if (Math.abs(number - Math.round(number)) < 0.001) return String(Math.round(number));
        return String(Math.round(number * 100) / 100).replace('.', ',');
    }

    function scheduleSectionKey(section) {
        return [
            normalizedWorkKeyPart(canonicalEstimateSectionTitle(section && (section.title || section.sectionId))),
            normalizedWorkKeyPart(section && section.startDate),
            normalizedWorkKeyPart(section && section.endDate)
        ].join('|');
    }

    function scheduleWorkKey(sectionTitle, item) {
        return [
            normalizedWorkKeyPart(canonicalEstimateSectionTitle(sectionTitle)),
            normalizedWorkKeyPart(item && item.title),
            normalizedWorkQty(item && (item.planned_qty != null ? item.planned_qty : item.plannedQty)),
            normalizedWorkKeyPart(item && item.unit)
        ].join('|');
    }

    function isScheduleWorkDone(projectId, sectionTitle, item) {
        var map = readStoredJson(scheduleChecklistStorageKey(projectId));
        return map[scheduleWorkKey(sectionTitle, item)] === 1;
    }

    function setScheduleWorkDone(projectId, sectionTitle, item, isDone) {
        var map = readStoredJson(scheduleChecklistStorageKey(projectId));
        var key = scheduleWorkKey(sectionTitle, item);
        if (isDone) map[key] = 1;
        else delete map[key];
        writeStoredJson(scheduleChecklistStorageKey(projectId), map);
    }

    function isScheduleSectionOpen(projectId, section, fallbackOpen) {
        var map = readStoredJson(scheduleSectionStateStorageKey(projectId));
        var key = scheduleSectionKey(section);
        if (Object.prototype.hasOwnProperty.call(map, key)) return map[key] === 1;
        return !!fallbackOpen;
    }

    function setScheduleSectionOpen(projectId, section, isOpen) {
        var map = readStoredJson(scheduleSectionStateStorageKey(projectId));
        map[scheduleSectionKey(section)] = isOpen ? 1 : 0;
        writeStoredJson(scheduleSectionStateStorageKey(projectId), map);
    }

    function renderScheduleSectionDetailsShell(isOpen, contentHtml) {
        return '<div class="section-schedule-details-shell' + (isOpen ? ' is-open' : '') + '" aria-hidden="' + (isOpen ? 'false' : 'true') + '">' +
            '<div class="section-schedule-details-clip"><div class="section-schedule-details">' + (contentHtml || '') + '</div></div>' +
        '</div>';
    }

    function toggleScheduleSectionDom(button, projectId, section) {
        var isOpen = button.getAttribute('aria-expanded') !== 'true';
        var card = button.closest ? button.closest('.section-schedule-card') : null;
        var body = card && card.querySelector ? card.querySelector('.section-schedule-details-shell') : null;
        var chevron = button.querySelector ? button.querySelector('.section-schedule-chevron') : null;
        setScheduleSectionOpen(projectId, section, isOpen);
        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (card) card.classList.toggle('is-open', isOpen);
        if (body) {
            body.classList.toggle('is-open', isOpen);
            body.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        }
        if (chevron) chevron.textContent = isOpen ? '-' : '+';
        if (button.classList && button.classList.contains('section-schedule-toggle')) {
            button.textContent = isOpen ? 'Свернуть раздел' : 'Открыть работы';
        }
    }

    function scheduleSectionProgress(projectId, section) {
        var sectionTitle = canonicalEstimateSectionTitle(section && (section.title || section.sectionId));
        var sectionKey = canonicalEstimateSectionId(sectionTitle);
        var materialItems = (state.materialsByProject && state.materialsByProject[projectId] || []).filter(function (item) {
            var kind = String(item && (item.itemKind || item.item_kind || 'material')).toLowerCase();
            return kind !== 'work' && canonicalEstimateSectionId(item && (item.sectionTitle || item.section_title || item.stageTitle || item.sectionId)) === sectionKey;
        });
        var workItems = liveScheduleSectionItems(section);
        var materialValue = materialProgress(projectId, materialItems);
        var workValue = workProgressForRows(projectId, sectionTitle, workItems);
        var total = materialValue.total + workValue.total;
        var done = materialValue.done + workValue.done;
        return {
            total: total,
            done: done,
            percent: total ? Math.round((done / total) * 100) : 0,
            materials: materialValue,
            works: workValue
        };
    }

    function formatWorkLine(item) {
        var qty = item && (item.planned_qty != null ? item.planned_qty : item.plannedQty);
        var parts = [];
        if (qty != null && qty !== '') parts.push(formattedWorkQty(qty) + ' ' + (item.unit || 'ед.'));
        var hours = Number(item && (item.estimated_hours != null ? item.estimated_hours : item.estimatedHours));
        if (Number.isFinite(hours) && hours > 0) parts.push((Math.round(hours * 10) / 10).toString().replace('.', ',') + ' чел.-ч');
        return parts.join(' • ');
    }

    function isoTime(value) {
        if (!value) return NaN;
        return Date.parse(String(value).trim() + 'T00:00:00Z');
    }

    function timelineExpectedProgress(startDate, endDate) {
        var startTime = isoTime(startDate);
        var endTime = isoTime(endDate);
        var todayTime = isoTime(APP_TODAY);
        if (Number.isNaN(startTime) || Number.isNaN(endTime) || Number.isNaN(todayTime) || endTime <= startTime) return 0;
        if (todayTime <= startTime) return 0;
        if (todayTime >= endTime) return 100;
        return Math.round(((todayTime - startTime) / (endTime - startTime)) * 100);
    }

    function scheduleDeadlineState(startDate, endDate, progressPercent, estimatedDays) {
        var startTime = isoTime(startDate);
        var endTime = isoTime(endDate);
        var todayTime = isoTime(APP_TODAY);
        var daysLeft = endDate ? daysBetween(APP_TODAY, endDate) : null;
        var expected = timelineExpectedProgress(startDate, endDate);
        var lag = expected - Number(progressPercent || 0);
        var totalDays = Math.max(1, Number(estimatedDays || 0) || daysBetween(startDate, endDate) || 1);
        var rushWindow = Math.max(3, Math.ceil(totalDays * 0.2));
        var state = {
            kind: '',
            expected: expected,
            daysLeft: daysLeft,
            label: endDate ? ('Осталось ' + String(daysLeft) + ' дн.') : 'Срок не задан'
        };

        if (Number(progressPercent || 0) >= 100) {
            state.kind = 'success';
            state.label = 'Готово';
            return state;
        }

        if (!Number.isNaN(endTime) && !Number.isNaN(todayTime) && todayTime > endTime) {
            var overdueDays = daysBetween(endDate, APP_TODAY);
            state.kind = Number(progressPercent || 0) >= 85 ? 'warn' : 'danger';
            state.label = 'Просрочено ' + String(overdueDays) + ' дн.';
            return state;
        }

        if (!Number.isNaN(startTime) && !Number.isNaN(todayTime) && todayTime < startTime) {
            var daysToStart = daysBetween(APP_TODAY, startDate);
            state.kind = daysToStart <= 2 ? 'warn' : '';
            state.label = 'Старт через ' + String(daysToStart) + ' дн.';
            return state;
        }

        if (lag >= 30 || (daysLeft != null && daysLeft <= 2 && Number(progressPercent || 0) < 75)) {
            state.kind = 'danger';
            return state;
        }
        if (lag >= 15 || (daysLeft != null && daysLeft <= rushWindow && Number(progressPercent || 0) < 70)) {
            state.kind = 'warn';
            return state;
        }
        if (Number(progressPercent || 0) + 5 >= expected) {
            state.kind = 'success';
        }
        return state;
    }

    function scheduleDeadlineBadge(state) {
        return '<span class="badge' + (state.kind ? (' ' + state.kind) : '') + '">' + escapeHtml(state.label) + '</span>';
    }

    function projectScheduleProgress(project, summary) {
        var sections = Array.isArray(summary && summary.sections) ? summary.sections : [];
        var total = 0;
        var done = 0;
        sections.forEach(function (section) {
            var progress = scheduleSectionProgress(project.id, section);
            total += progress.total;
            done += progress.done;
        });
        return {
            total: total,
            done: done,
            percent: total ? Math.round((done / total) * 100) : 0
        };
    }

    function rerenderProjectWorkProgress(projectId) {
        var project = state.projects.find(function (item) {
            return Number(item.id) === Number(projectId);
        }) || state.selectedProject;
        if (!project || !state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        var stages = state.stagesByProject[projectId] || [];
        var items = state.materialsByProject[projectId] || [];
        safeReplaceChildren(qs('[data-panel="schedule"]'), renderSchedulePanel(stages, project));
        if (qs('[data-panel="works"]')) {
            safeReplaceChildren(qs('[data-panel="works"]'), renderWorksPanel(stages, items));
        }
        bindAutoScheduleForm(projectId);
        bindScheduleStatusActions(projectId);
        bindSectionScheduleRefresh(projectId);
        bindSectionScheduleInteractions(projectId);
        bindActualQuantityInputs(projectId);
    }

    function bindSectionScheduleInteractions(projectId) {
        qsa('[data-section-schedule-toggle]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            var toggleSection = function () {
                var sectionKey = button.getAttribute('data-section-key') || '';
                var project = state.selectedProject;
                if (!project || Number(project.id) !== Number(projectId)) return;
                var summary = state.sectionScheduleByProject[projectId];
                var sections = Array.isArray(summary && summary.sections) ? summary.sections : [];
                var section = sections.find(function (entry) {
                    return scheduleSectionKey(entry) === sectionKey;
                });
                if (!section) return;
                toggleScheduleSectionDom(button, projectId, section);
            };
            button.addEventListener('click', toggleSection);
            button.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleSection();
            });
        });

        qsa('[data-section-work-check]').forEach(function (input) {
            if (input.dataset.bound === '1') return;
            input.dataset.bound = '1';
            input.addEventListener('change', function () {
                var project = state.selectedProject;
                if (!project || Number(project.id) !== Number(projectId)) return;
                saveManualQuantityCheckbox(input);
            });
        });
    }


    renderSectionScheduleBrief = function (section) {
        var project = state.selectedProject;
        var progress = project ? scheduleSectionProgress(project.id, section) : { percent: 0 };
        var deadlineState = scheduleDeadlineState(section.startDate, section.endDate, progress.percent, section.estimatedDays);
        var briefValue = deadlineState.daysLeft == null ? String(section.estimatedDays || 0) : String(deadlineState.daysLeft);
        var briefLabel = deadlineState.daysLeft == null ? '\u0434\u043d.' : '\u043e\u0441\u0442\u0430\u043b\u043e\u0441\u044c';
        return '<article class="section-schedule-brief' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-brief-head">' +
                '<h4>' + escapeHtml(section.title) + '</h4>' +
                '<small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small>' +
            '</div>' +
            '<div class="section-schedule-brief-duration' + (deadlineState.kind ? (' is-' + deadlineState.kind) : '') + '"><strong>' + escapeHtml(briefValue) + '</strong><span>' + escapeHtml(briefLabel) + '</span></div>' +
            '<p>' + escapeHtml(finalSectionWorkDigest(section).lead) + '</p>' +
        '</article>';
    };

    function reportEffectsState(projectId) {
        if (!state.projectReportEffectsByProject) state.projectReportEffectsByProject = {};
        return state.projectReportEffectsByProject[projectId] || { works: {}, materials: {} };
    }

    function normalizeReportText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^a-z\u0400-\u04ff0-9%]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function reportStem(token) {
        var clean = normalizeReportText(token);
        if (clean.length <= 4) return clean;
        return clean.slice(0, 4);
    }

    function reportTokens(value) {
        var stop = {
            i: 1, a: 1, the: 1,
            'и': 1, 'или': 1, 'для': 1, 'при': 1, 'что': 1, 'это': 1, 'как': 1, 'под': 1, 'над': 1, 'без': 1,
            'работы': 1, 'работ': 1, 'работа': 1, 'устройство': 1, 'монтаж': 1, 'установка': 1, 'демонтаж': 0,
            'материал': 1, 'материалы': 1, 'комплект': 1, 'проект': 1, 'объект': 1, 'раздел': 1,
            'шт': 1, 'м': 1, 'м2': 1, 'м3': 1, 'т': 1, 'кг': 1, 'мм': 1
        };
        var stems = {};
        normalizeReportText(value).split(' ').forEach(function (token) {
            if (!token || token.length < 3 || stop[token]) return;
            var stem = reportStem(token);
            if (!stem || stem.length < 3) return;
            stems[stem] = 1;
        });
        return Object.keys(stems);
    }

    function reportTextClauses(value) {
        return String(value || '')
            .split(/\n|[.!?;]+/)
            .map(function (part) { return part.trim(); })
            .filter(Boolean);
    }

    function escapeRegex(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function workCandidatesForProject(projectId) {
        var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[projectId];
        var sections = Array.isArray(summary && summary.sections) ? summary.sections : [];
        var candidates = [];
        sections.forEach(function (section) {
            (section.items || []).forEach(function (item) {
                candidates.push({
                    sectionTitle: canonicalEstimateSectionTitle(section && (section.title || section.sectionId)),
                    item: item,
                    tokens: reportTokens(item.title)
                });
            });
        });
        if (candidates.length) return candidates;
        return (state.materialsByProject[projectId] || []).filter(function (item) {
            return String(item.itemKind || '').toLowerCase() === 'work';
        }).map(function (item) {
            return {
                sectionTitle: canonicalEstimateSectionTitle(item.sectionTitle || item.section_title || item.stageTitle || item.sectionId),
                item: item,
                tokens: reportTokens(item.title)
            };
        });
    }

    function materialCandidatesForProject(projectId) {
        return (state.materialsByProject[projectId] || []).filter(function (item) {
            return String(item.itemKind || 'material').toLowerCase() !== 'work';
        }).map(function (item) {
            return {
                item: item,
                tokens: reportTokens(item.title)
            };
        });
    }

    function reportClauseMatchScore(tokens, clauseTokens) {
        if (!tokens.length || !clauseTokens.length) return 0;
        var score = 0;
        tokens.forEach(function (token) {
            if (clauseTokens.indexOf(token) !== -1) score += 1;
        });
        return score;
    }

    function clauseHasAnyStem(clauseText, stems) {
        var text = ' ' + normalizeReportText(clauseText) + ' ';
        return stems.some(function (stem) {
            return text.indexOf(stem) !== -1;
        });
    }

    function reportQuantityFromClause(clauseText, item) {
        var raw = String(clauseText || '');
        var normalized = normalizeReportText(raw);
        var planned = Number(item.plannedQty != null ? item.plannedQty : item.planned_qty || 0);
        var unit = String(item.unit || '').trim();
        var ratio = 0;
        if (/100%|полност|целиком|все\b|весь\b|полностью|закрыли/.test(normalized)) ratio = 1;
        else if (/половин|50%|частич/.test(normalized)) ratio = 0.5;
        if (unit) {
            var unitMatch = raw.match(new RegExp('(\\d+(?:[\\.,]\\d+)?)\\s*' + escapeRegex(unit), 'i'));
            if (unitMatch) return Number(String(unitMatch[1]).replace(',', '.')) || 0;
        }
        if (ratio > 0 && planned > 0) return planned * ratio;
        return ratio === 1 ? planned : 0;
    }

    function reportWorkResultFromClause(clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var planned = Number(candidate.item.planned_qty != null ? candidate.item.planned_qty : candidate.item.plannedQty || 0);
        var qty = reportQuantityFromClause(clauseText, candidate.item);
        var partial = /половин|50%|частич/.test(normalizeReportText(clauseText));
        if (planned > 0 && qty > 0 && qty < planned) partial = true;
        return {
            sectionTitle: candidate.sectionTitle,
            item: candidate.item,
            score: score,
            done: !partial,
            partial: partial
        };
    }

    function reportMaterialResultFromClause(clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var normalized = normalizeReportText(clauseText);
        var qty = reportQuantityFromClause(clauseText, candidate.item);
        var planned = Number(candidate.item.plannedQty || 0);
        var purchaseWords = ['куп', 'заку', 'зака', 'заве', 'дост', 'полу', 'прив'];
        var useWords = ['уста', 'смон', 'пост', 'улож', 'испо', 'приме', 'перед', 'прове'];
        var purchase = clauseHasAnyStem(normalized, purchaseWords);
        var used = clauseHasAnyStem(normalized, useWords);
        if (!purchase && !used) used = true;
        if (!qty && planned > 0 && /все\b|весь\b|полност|закрыли/.test(normalized)) qty = planned;
        if (!qty && planned > 0 && /половин|50%|частич/.test(normalized)) qty = planned * 0.5;
        return {
            item: candidate.item,
            score: score,
            purchasedQty: purchase ? qty : 0,
            usedQty: used ? qty : 0
        };
    }

    function reportTrimSentence(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
            .trim();
    }

    function reportSentence(value) {
        var text = reportTrimSentence(value);
        if (!text) return '';
        text = text.charAt(0).toUpperCase() + text.slice(1);
        return /[.!?]$/.test(text) ? text : text + '.';
    }

    function reportActionObject(clauseText, actionRegex) {
        var text = reportTrimSentence(clauseText);
        text = text
            .replace(/^(?:\u043c\u044b\s+)?(?:\u0441\u0435\u0433\u043e\u0434\u043d\u044f|замер|за\s+день|на\s+объекте)\s+/i, '')
            .replace(actionRegex, '')
            .replace(/^(?:и|а|также)\s+/i, '');
        return reportTrimSentence(text) || reportTrimSentence(clauseText);
    }

    function reportNarrativeSentence(clauseText) {
        var normalized = normalizeReportText(clauseText);
        var purchaseRegex = /^(?:\u043c\u044b\s+)?(?:\u043a\u0443\u043f\u0438\u043b\u0438|\u0437\u0430\u043a\u0443\u043f\u0438\u043b\u0438|\u043f\u0440\u0438\u043e\u0431\u0440\u0435\u043b\u0438|\u0434\u043e\u043a\u0443\u043f\u0438\u043b\u0438)\s+/i;
        var deliveryRegex = /^(?:\u043c\u044b\s+)?(?:\u0437\u0430\u0432\u0435\u0437\u043b\u0438|\u0434\u043e\u0441\u0442\u0430\u0432\u0438\u043b\u0438|\u043f\u0440\u0438\u0432\u0435\u0437\u043b\u0438|\u043f\u043e\u043b\u0443\u0447\u0438\u043b\u0438)\s+/i;
        var workRegex = /^(?:\u043c\u044b\s+)?(?:\u0441\u0434\u0435\u043b\u0430\u043b\u0438|\u0432\u044b\u043f\u043e\u043b\u043d\u0438\u043b\u0438|\u0437\u0430\u043a\u0440\u044b\u043b\u0438|\u0441\u043c\u043e\u043d\u0442\u0438\u0440\u043e\u0432\u0430\u043b\u0438|\u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u043b\u0438|\u0443\u043b\u043e\u0436\u0438\u043b\u0438)\s+/i;
        var blockerRegex = /^(?:\u043c\u044b\s+)?(?:\u0436\u0434\u0435\u043c|\u043d\u0435\u0442|\u043c\u0435\u0448\u0430\u0435\u0442|\u0437\u0430\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442|\u043d\u0443\u0436\u043d\u043e)\s+/i;
        if (deliveryRegex.test(clauseText)) {
            return reportSentence('\u041d\u0430 \u043e\u0431\u044a\u0435\u043a\u0442 \u0434\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u044b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b: ' + reportActionObject(clauseText, deliveryRegex) + '. \u041f\u0440\u0438\u0435\u043c\u043a\u0430 \u043e\u0442\u043c\u0435\u0447\u0435\u043d\u0430 \u0432 \u0434\u043d\u0435\u0432\u043d\u043e\u043c \u043e\u0442\u0447\u0435\u0442\u0435');
        }
        if (purchaseRegex.test(clauseText) || reportHasPurchaseIntent(normalized)) {
            return reportSentence('\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0430 \u0437\u0430\u043a\u0443\u043f\u043a\u0430 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432: ' + reportActionObject(clauseText, purchaseRegex) + '. \u041f\u043e\u0441\u0442\u0430\u0432\u043a\u0430 \u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u0430 \u0434\u043b\u044f \u0434\u0430\u043b\u044c\u043d\u0435\u0439\u0448\u0435\u0433\u043e \u0443\u0447\u0435\u0442\u0430 \u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f \u043d\u0430 \u043e\u0431\u044a\u0435\u043a\u0442\u0435');
        }
        if (workRegex.test(clauseText) || reportHasUseIntent(normalized)) {
            return reportSentence('\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b \u0440\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u0443: ' + reportActionObject(clauseText, workRegex) + '. \u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0432\u043d\u0435\u0441\u0435\u043d \u0432 \u043e\u0442\u0447\u0435\u0442 \u0434\u043b\u044f \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u0430');
        }
        if (blockerRegex.test(clauseText)) {
            return reportSentence('\u0417\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d \u0432\u043e\u043f\u0440\u043e\u0441, \u0442\u0440\u0435\u0431\u0443\u044e\u0449\u0438\u0439 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u044f: ' + reportActionObject(clauseText, blockerRegex));
        }
        return reportSentence('\u041f\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u0443 \u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043e: ' + reportTrimSentence(clauseText));
    }

    function buildReadableProjectReportText(rawText, generatedParts) {
        if (generatedParts && generatedParts.length) return generatedParts.join(' ');
        var clauses = reportTextClauses(rawText).slice(0, 6);
        var sentences = clauses.map(reportNarrativeSentence).filter(Boolean);
        return sentences.length ? sentences.join(' ') : reportSentence(rawText);
    }

    function buildProjectReportDraft(projectId, payload) {
        var text = String(payload && payload.raw_input || '').trim() || String(payload && payload.work_done || '').trim();
        var clauses = reportTextClauses(text);
        var workMatchesMap = {};
        var materialMatchesMap = {};

        clauses.forEach(function (clause) {
            workCandidatesForProject(projectId).forEach(function (candidate) {
                var result = reportWorkResultFromClause(clause, candidate);
                if (!result) return;
                var key = scheduleWorkKey(result.sectionTitle, result.item);
                if (!workMatchesMap[key] || result.score > workMatchesMap[key].score || (result.done && !workMatchesMap[key].done) || Number(result.actualQty || 0) > Number(workMatchesMap[key].actualQty || 0)) {
                    workMatchesMap[key] = result;
                }
            });

            materialCandidatesForProject(projectId).forEach(function (candidate) {
                var result = reportMaterialResultFromClause(clause, candidate);
                if (!result) return;
                var materialId = Number(result.item.id);
                if (!materialMatchesMap[materialId]) {
                    materialMatchesMap[materialId] = {
                        item: result.item,
                        purchasedQty: 0,
                        usedQty: 0
                    };
                }
                materialMatchesMap[materialId].purchasedQty += Number(result.purchasedQty || 0);
                materialMatchesMap[materialId].usedQty += Number(result.usedQty || 0);
            });
        });

        var workMatches = Object.keys(workMatchesMap).map(function (key) { return workMatchesMap[key]; });
        var materialMatches = Object.keys(materialMatchesMap).map(function (key) {
            var entry = materialMatchesMap[key];
            var planned = quantityPlanInfo(entry.item).totalQty;
            if (planned > 0) {
                entry.purchasedQty = Math.min(planned, entry.purchasedQty);
                entry.usedQty = Math.min(planned, entry.usedQty);
            }
            return entry;
        });

        var generatedParts = [];
        var completedWorks = workMatches.filter(function (entry) { return entry.done; });
        var partialWorks = workMatches.filter(function (entry) { return entry.partial; });
        var purchasedMaterials = materialMatches.filter(function (entry) { return entry.purchasedQty > 0; });
        var usedMaterials = materialMatches.filter(function (entry) { return entry.usedQty > 0; });
        if (completedWorks.length) {
            generatedParts.push('\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b \u0440\u0430\u0431\u043e\u0442\u044b: ' + completedWorks.map(function (entry) {
                return entry.item.title;
            }).join(', ') + '.');
        }
        if (partialWorks.length) {
            generatedParts.push('\u0427\u0430\u0441\u0442\u0438\u0447\u043d\u043e \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b: ' + partialWorks.map(function (entry) {
                return entry.item.title;
            }).join(', ') + '.');
        }
        if (purchasedMaterials.length) {
            generatedParts.push('\u0417\u0430\u043a\u0443\u043f\u043b\u0435\u043d\u044b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b: ' + purchasedMaterials.map(function (entry) {
                return entry.item.title + ' ' + finalSectionSummaryNumber(entry.purchasedQty) + ' ' + quantityPlanInfo(entry.item).unit;
            }).join(', ') + '.');
        }
        if (usedMaterials.length) {
            generatedParts.push('\u0412 \u0440\u0430\u0431\u043e\u0442\u0443/\u043c\u043e\u043d\u0442\u0430\u0436 \u043f\u0435\u0440\u0435\u0434\u0430\u043d\u044b: ' + usedMaterials.map(function (entry) {
                return entry.item.title + ' ' + finalSectionSummaryNumber(entry.usedQty) + ' ' + quantityPlanInfo(entry.item).unit;
            }).join(', ') + '.');
        }

        return {
            text: buildReadableProjectReportText(text, generatedParts),
            workMatches: workMatches,
            materialMatches: materialMatches
        };
    }

    function rebuildProjectReportEffects(projectId) {
        if (!state.projectLogsByProject) state.projectLogsByProject = {};
        if (!state.projectReportEffectsByProject) state.projectReportEffectsByProject = {};
        var logs = state.projectLogsByProject[projectId] || [];
        var works = {};
        var materials = {};
        logs.forEach(function (log) {
            var draft = buildProjectReportDraft(projectId, {
                raw_input: log.raw_input || '',
                work_done: log.work_done || ''
            });
            draft.workMatches.forEach(function (entry) {
                var key = scheduleWorkKey(entry.sectionTitle, entry.item);
                if (entry.done) works[key] = 1;
                else if (Number(entry.actualQty || 0) > 0) works[key] = { qty: Number(entry.actualQty || 0) };
            });
            draft.materialMatches.forEach(function (entry) {
                var materialId = Number(entry.item.id);
                if (!materials[materialId]) materials[materialId] = { purchasedQty: 0, usedQty: 0 };
                materials[materialId].purchasedQty += Number(entry.purchasedQty || 0);
                materials[materialId].usedQty += Number(entry.usedQty || 0);
            });
        });
        state.projectReportEffectsByProject[projectId] = { works: works, materials: materials };
    }

    function effectiveMaterialFromReports(projectId, item) {
        var effective = Object.assign({}, item || {});
        var effects = reportEffectsState(projectId);
        var materialEffect = effects.materials[Number(item && item.id)];
        if (!materialEffect) return effective;
        var planned = Number(effective.plannedQty || 0);
        var basePurchased = Number(effective.purchasedQty || 0);
        var baseUsed = Number(effective.usedQty || 0);
        var baseStock = Number(effective.stockQty || 0);
        var purchased = basePurchased + Number(materialEffect.purchasedQty || 0);
        var used = baseUsed + Number(materialEffect.usedQty || 0);
        if (planned > 0) {
            purchased = Math.min(planned, purchased);
            used = Math.min(planned, used);
        }
        var stock = Math.max(0, baseStock + Number(materialEffect.purchasedQty || 0) - Number(materialEffect.usedQty || 0));
        if (planned > 0) stock = Math.min(planned, stock);
        effective.purchasedQty = finalSectionSummaryNumber(purchased);
        effective.usedQty = finalSectionSummaryNumber(used);
        effective.stockQty = finalSectionSummaryNumber(stock);
        effective.missingQty = Math.max(0, planned - Math.max(purchased, stock));
        effective.reportApplied = purchased > basePurchased || used > baseUsed;
        if (planned > 0 && purchased >= planned) {
            effective.supplyStatus = 'in_stock';
        }
        return effective;
    }

    function rerenderProjectReportDrivenViews(projectId) {
        if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        var project = state.selectedProject;
        var materials = state.materialsByProject[projectId] || [];
        var insights = state.materialInsightsByProject[projectId] || {};
        var materialsPanel = qs('[data-panel="materials"]');
        var worksPanel = qs('[data-panel="works"]');
        var schedulePanel = qs('[data-panel="schedule"]');
        var overviewMaterials = qs('[data-project-overview-materials]');
        if (materialsPanel) safeReplaceChildren(materialsPanel, renderProjectMaterialsTab(project, materials, insights));
        if (overviewMaterials) safeReplaceChildren(overviewMaterials, renderMaterials(materials, project.id, insights));
        if (worksPanel) safeReplaceChildren(worksPanel, renderProjectWorksTab(project, state.stagesByProject[projectId] || [], materials));
        if (schedulePanel) safeReplaceChildren(schedulePanel, renderSchedulePanel(state.stagesByProject[projectId] || [], project));
        bindProjectChainActions();
        bindProjectMarketToggles(projectId);
        bindAutoScheduleForm(projectId);
        bindScheduleStatusActions(projectId);
        bindSectionScheduleRefresh(projectId);
    }

    var baseLoadProjectLogs = loadProjectLogs;
    loadProjectLogs = function (projectId, callback) {
        baseLoadProjectLogs(projectId, function (logs) {
            if (!state.projectLogsByProject) state.projectLogsByProject = {};
            state.projectLogsByProject[projectId] = logs || [];
            rebuildProjectReportEffects(projectId);
            rerenderProjectReportDrivenViews(projectId);
            callback(logs || []);
        });
    };

    var baseLoadMaterials = loadMaterials;
    loadMaterials = function (projectId, callback) {
        baseLoadMaterials(projectId, function (items) {
            rebuildProjectReportEffects(projectId);
            callback(items || []);
        });
    };

    var manualScheduleDone = isScheduleWorkDone;
    isScheduleWorkDone = function (projectId, sectionTitle, item) {
        if (manualScheduleDone(projectId, sectionTitle, item)) return true;
        var effects = reportEffectsState(projectId);
        return effects.works[scheduleWorkKey(sectionTitle, item)] === 1;
    };

    function ensureReportPreviewRoot(form) {
        var root = qs('[data-report-preview]', form);
        if (root) return root;
        var confirmCard = qs('.assistant-confirm-card', form);
        if (!confirmCard) return null;
        root = document.createElement('div');
        root.className = 'assistant-confirm-list report-apply-preview';
        root.setAttribute('data-report-preview', '');
        confirmCard.insertBefore(root, qs('.report-confirm', confirmCard) || null);
        return root;
    }

    function renderReportPreviewHtml(projectId, draft) {
        if (!draft.text && !draft.workMatches.length && !draft.materialMatches.length) {
            return '<span>\u041d\u0430\u043f\u0438\u0448\u0438 \u043a\u043e\u0440\u043e\u0442\u043a\u043e, \u0447\u0442\u043e \u0441\u0434\u0435\u043b\u0430\u043b\u0438 \u0441\u0435\u0433\u043e\u0434\u043d\u044f. \u041d\u0438\u0436\u0435 \u0441\u043e\u0431\u0435\u0440\u0435\u0442\u0441\u044f \u043e\u0442\u0447\u0435\u0442 \u0438 \u0441\u043f\u0438\u0441\u043e\u043a \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439.</span>';
        }
        var parts = [];
        if (draft.text) {
            parts.push('<span><b>\u0411\u0443\u0434\u0435\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d \u043e\u0442\u0447\u0435\u0442:</b> ' + escapeHtml(draft.text) + '</span>');
        }
        if (draft.workMatches.length) {
            parts.push('<span><b>\u0411\u0443\u0434\u0443\u0442 \u043e\u0442\u043c\u0435\u0447\u0435\u043d\u044b \u0440\u0430\u0431\u043e\u0442\u044b:</b> ' + escapeHtml(draft.workMatches.map(function (entry) {
                return entry.item.title + (entry.partial ? ' (\u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e)' : '');
            }).join(', ')) + '</span>');
        } else {
            parts.push('<span><b>\u0420\u0430\u0431\u043e\u0442\u044b:</b> \u043f\u043e\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b \u044f\u0432\u043d\u044b\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u044f.</span>');
        }
        if (draft.materialMatches.length) {
            parts.push('<span><b>\u0411\u0443\u0434\u0443\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b:</b> ' + escapeHtml(draft.materialMatches.map(function (entry) {
                var bits = [];
                if (entry.purchasedQty > 0) bits.push('\u043a\u0443\u043f\u043b\u0435\u043d\u043e ' + finalSectionSummaryNumber(entry.purchasedQty));
                if (entry.usedQty > 0) bits.push('\u0432 \u0440\u0430\u0431\u043e\u0442\u0443 ' + finalSectionSummaryNumber(entry.usedQty));
                return entry.item.title + ' (' + bits.join(', ') + ' ' + (entry.item.unit || '') + ')';
            }).join('; ')) + '</span>');
        } else {
            parts.push('<span><b>\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b:</b> \u043f\u043e\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b \u044f\u0432\u043d\u044b\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u044f.</span>');
        }
        return parts.join('');
    }

    function bindReportPreview() {
        qsa('[data-log-form]').forEach(function (form) {
            if (form.dataset.reportPreviewBound === '1') return;
            form.dataset.reportPreviewBound = '1';
            var previewRoot = ensureReportPreviewRoot(form);
            if (!previewRoot) return;
            var workDone = form.work_done;
            var rawInput = form.raw_input;
            var titleInput = form.title;

            function refreshPreview() {
                var projectId = Number(form.project_id && form.project_id.value || 0);
                var draft = buildProjectReportDraft(projectId, {
                    raw_input: rawInput ? rawInput.value.trim() : '',
                    work_done: workDone ? workDone.value.trim() : ''
                });
                if (workDone && rawInput && rawInput.value.trim() && (!workDone.value.trim() || workDone.dataset.autogenerated === '1')) {
                    workDone.value = draft.text;
                    workDone.dataset.autogenerated = draft.text ? '1' : '0';
                }
                if (titleInput && (!titleInput.value.trim() || titleInput.dataset.autogenerated === '1')) {
                    titleInput.value = '\u041e\u0442\u0447\u0435\u0442 \u0437\u0430 ' + (form.report_date && form.report_date.value ? form.report_date.value : APP_TODAY);
                    titleInput.dataset.autogenerated = '1';
                }
                previewRoot.innerHTML = renderReportPreviewHtml(projectId, draft);
            }

            if (workDone) {
                workDone.addEventListener('input', function () {
                    workDone.dataset.autogenerated = '0';
                    refreshPreview();
                });
            }
            if (rawInput) rawInput.addEventListener('input', refreshPreview);
            if (titleInput) {
                titleInput.addEventListener('input', function () {
                    titleInput.dataset.autogenerated = '0';
                });
            }
            if (form.report_date) form.report_date.addEventListener('change', refreshPreview);
            refreshPreview();
        });
    }

    function renderProjectList(projects) {
        var root = qs('[data-projects-list]');
        if (!root) return;
        try {
            projects = Array.isArray(projects) ? projects : [];
            function projectStatusMeta(project, completed) {
                var status = String(project && project.status || '').toLocaleLowerCase('ru');
                if (completed || status.indexOf('заверш') !== -1) return { label: 'Завершен', tone: 'success' };
                if (status.indexOf('план') !== -1 || status.indexOf('подготов') !== -1) return { label: project.status || 'В планах', tone: 'info' };
                if (status.indexOf('пауз') !== -1) return { label: project.status || 'На паузе', tone: 'neutral' };
                return { label: project.status || 'Активен', tone: 'success-soft' };
            }
            function projectUserById(userId) {
                return (state.users || []).find(function (item) {
                    return Number(item && item.id) === Number(userId);
                }) || null;
            }
            function projectInitials(name) {
                var clean = String(name || '').trim();
                if (!clean) return 'PR';
                var parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
                return parts.map(function (part) { return part.charAt(0).toUpperCase(); }).join('') || clean.slice(0, 2).toUpperCase();
            }
            function projectForemenMeta(project) {
                var assigned = Array.isArray(project && project.assigned_foremen) ? project.assigned_foremen : [];
                var people = assigned.map(function (userId) {
                    var user = projectUserById(userId);
                    return {
                        id: userId,
                        name: user && (user.name || user.login) ? (user.name || user.login) : ('Прораб #' + userId),
                        initials: projectInitials(user && (user.name || user.login))
                    };
                });
                var preview = people.slice(0, 4).map(function (person, index) {
                    return '<span class="project-avatar-chip" style="z-index:' + (10 - index) + '" title="' + escapeHtml(person.name) + '" aria-label="' + escapeHtml(person.name) + '">' + escapeHtml(person.initials) + '</span>';
                }).join('');
                return {
                    count: people.length,
                    label: people.length ? (people.length + ' прораб' + (people.length > 1 ? 'а' : '')) : 'Прорабы не назначены',
                    avatars: preview || '<span class="project-avatar-chip is-empty" aria-hidden="true">+</span>'
                };
            }
            if (!projects.length) {
                safeReplaceChildren(root, '<div class="projects-empty-state muted">\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.</div>');
                if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                return;
            }
            var sortedProjects = projects.slice().sort(function (left, right) {
                var leftCompleted = isCompletedProject(left) ? 1 : 0;
                var rightCompleted = isCompletedProject(right) ? 1 : 0;
                if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;
                return Number(right && right.id || 0) - Number(left && left.id || 0);
            });
            var criticalByProject = {};
            var criticalItems = state.dashboard && Array.isArray(state.dashboard.criticalItems) ? state.dashboard.criticalItems : [];
            criticalItems.forEach(function (item) {
                criticalByProject[item.projectId] = (criticalByProject[item.projectId] || 0) + 1;
            });
            safeReplaceChildren(root, '<div class="projects-card-grid">' + sortedProjects.map(function (project) {
                project = project || {};
                var progress = percent(project.progress);
                var criticalCount = criticalByProject[project.id] || 0;
                var completed = isCompletedProject(project);
                var statusMeta = projectStatusMeta(project, completed);
                var foremenMeta = projectForemenMeta(project);
                var statusBadge = '<span class="project-status-badge is-' + escapeHtml(statusMeta.tone) + '">' + escapeHtml(statusMeta.label) + '</span>';
                var editButton = isAdminRole()
                    ? '<button class="project-card-menu" type="button" aria-label="\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442" data-project-edit="' + escapeHtml(project.id || '') + '"><i data-lucide="ellipsis"></i></button>'
                    : '';
                var riskBadge = (!completed && criticalCount)
                    ? '<span class="project-inline-note is-danger"><i data-lucide="triangle-alert"></i><span>Нехватки: ' + escapeHtml(String(criticalCount)) + '</span></span>'
                    : '';
                var deadlineText = project.started_at || project.deadline_at
                    ? escapeHtml((project.started_at ? formatDisplayDate(project.started_at) : 'Без старта') + ' - ' + (project.deadline_at ? formatDisplayDate(project.deadline_at) : 'Без дедлайна'))
                    : 'Сроки не указаны';
                var financeQuickAction = canSeeFinances()
                    ? '<button class="project-quick-action" type="button" data-project-quick-tab="finance" data-project-id="' + escapeHtml(project.id || '') + '" aria-label="Финансы"><i data-lucide="wallet"></i></button>'
                    : '';
                return '<article class="project-card ' + (completed ? 'project-completed ' : '') + (!completed && criticalCount ? 'project-risk' : '') + '" data-project-id="' + escapeHtml(project.id || '') + '">' +
                    '<div class="project-card-shell">' +
                        '<div class="project-card-headline">' +
                            '<div class="project-card-icon" aria-hidden="true"><i data-lucide="' + (completed ? 'folder-git-2' : 'building-2') + '"></i></div>' +
                            '<div class="project-card-heading">' +
                                '<h3>' + escapeHtml(project.title || '\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f') + '</h3>' +
                                '<p>' + escapeHtml(project.client_name || 'Заказчик не указан') + '</p>' +
                            '</div>' +
                            '<div class="project-card-tools"><div class="project-badges">' + statusBadge + '</div>' + editButton + '</div>' +
                        '</div>' +
                        '<div class="project-card-meta">' +
                            '<div class="project-meta-row">' +
                                '<span class="project-meta-icon" aria-hidden="true"><i data-lucide="map-pin"></i></span>' +
                                '<span class="project-meta-text" title="' + escapeHtml(project.address || 'Адрес не указан') + '">' + escapeHtml(project.address || 'Адрес не указан') + '</span>' +
                            '</div>' +
                            '<div class="project-meta-row">' +
                                '<span class="project-meta-icon" aria-hidden="true"><i data-lucide="users"></i></span>' +
                                '<div class="project-foremen-line"><div class="project-avatar-stack">' + foremenMeta.avatars + '</div><span class="project-meta-text">' + escapeHtml(foremenMeta.label) + '</span></div>' +
                            '</div>' +
                            '<div class="project-meta-row">' +
                                '<span class="project-meta-icon" aria-hidden="true"><i data-lucide="calendar"></i></span>' +
                                '<span class="project-meta-text">' + deadlineText + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="project-card-progress">' +
                            '<div class="project-progress-label"><strong>' + escapeHtml(String(progress)) + '% выполнено</strong>' + riskBadge + '</div>' +
                            '<div class="project-progress-track" aria-hidden="true"><span class="project-progress-bar" style="width:' + progress + '%"></span></div>' +
                        '</div>' +
                        '<div class="project-card-actions">' +
                            '<button class="project-quick-action" type="button" data-project-quick-tab="materials" data-project-id="' + escapeHtml(project.id || '') + '" aria-label="Материалы"><i data-lucide="boxes"></i></button>' +
                            '<button class="project-quick-action" type="button" data-project-quick-tab="tasks" data-project-id="' + escapeHtml(project.id || '') + '" aria-label="Задачи"><i data-lucide="kanban-square"></i></button>' +
                            financeQuickAction +
                        '</div>' +
                    '</div>' +
                '</article>';
            }).join('') + '</div>');
            qsa('[data-project-id]', root).forEach(function (card) {
                if (card.dataset.projectCardBound === '1') return;
                card.dataset.projectCardBound = '1';
                card.addEventListener('click', function (event) {
                    if (event.target && event.target.closest('[data-project-edit], [data-project-quick-tab]')) return;
                    openProject(Number(card.dataset.projectId));
                });
            });
            qsa('[data-project-edit]', root).forEach(function (button) {
                if (button.dataset.projectEditBound === '1') return;
                button.dataset.projectEditBound = '1';
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    openProjectEdit(Number(button.dataset.projectEdit));
                });
            });
            qsa('[data-project-quick-tab]', root).forEach(function (button) {
                if (button.dataset.projectQuickBound === '1') return;
                button.dataset.projectQuickBound = '1';
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var projectId = Number(button.dataset.projectId || 0);
                    var tab = button.dataset.projectQuickTab || 'overview';
                    if (!projectId) return;
                    openProject(projectId);
                    if (tab === 'finance' && !canSeeFinances()) return;
                    activateProjectTab(tab);
                });
            });
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
        } catch (error) {
            console.error('renderProjectList failed', error);
            safeReplaceChildren(root, '<div class="muted">\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u0440\u0438\u0441\u043e\u0432\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442\u044b.</div>');
        }
    }


    function renderProjectsPage() {
        try {
            if (isAdminRole()) loadCompanies(populateProjectCompanySelects);
            ensureProjectEditCard();
            bindProjectCreate();
            bindProjectEditForm();
            bindProjectBootstrapForm();
            var bootstrapForm = qs('[data-project-bootstrap-form]');
            if (bootstrapForm && bootstrapForm.closest('section')) bootstrapForm.closest('section').hidden = true;
            renderProjectStats();
            renderProjectCritical();
            renderProjectList(state.projects);
            var search = qs('[data-project-search]');
            if (search && search.dataset.bound !== '1') {
                search.dataset.bound = '1';
                search.addEventListener('input', function () {
                    try {
                        var query = search.value.toLocaleLowerCase('ru');
                        renderProjectList((state.projects || []).filter(function (project) {
                            return [project && project.title, project && project.address, project && project.client_name, project && project.status]
                                .join(' ')
                                .toLocaleLowerCase('ru')
                                .indexOf(query) !== -1;
                        }));
                    } catch (error) {
                        console.error('Project search render failed', error);
                        renderProjectList(state.projects || []);
                    }
                });
            }
            var close = qs('[data-close-detail]');
            if (close && close.dataset.bound !== '1') {
                close.dataset.bound = '1';
                close.addEventListener('click', function () {
                    state.selectedProject = null;
                    var detail = qs('[data-project-detail]');
                    if (detail) detail.hidden = true;
                    setProjectFocusMode(false);
                    try {
                        var closeParams = new URLSearchParams(location.search);
                        closeParams.delete('openProject');
                        var closeQuery = closeParams.toString();
                        history.replaceState(null, '', location.pathname + (closeQuery ? '?' + closeQuery : ''));
                    } catch (error) {}
                });
            }
            qsa('[data-tab]').forEach(function (button) {
                if (button.dataset.projectTabBound === '1') return;
                if (isProjectTabHidden(button.dataset.tab)) {
                    button.classList.add('hidden');
                    button.setAttribute('aria-hidden', 'true');
                    return;
                }
                if (!isSuperAdminRole() && state.user && hasRole('customer') && ['execution', 'materials', 'tasks', 'finance'].indexOf(button.dataset.tab) !== -1) {
                    button.classList.add('hidden');
                    return;
                }
                if (button.dataset.tab === 'finance' && !canSeeFinances()) {
                    button.classList.add('hidden');
                    return;
                }
                button.dataset.projectTabBound = '1';
                button.addEventListener('click', function () {
                    activateProjectTab(button.dataset.tab);
                });
            });
            var params = new URLSearchParams(location.search);
            var openProjectId = Number(params.get('openProject') || 0);
            if (openProjectId && (!state.selectedProject || Number(state.selectedProject.id) !== openProjectId)) {
                var matched = (state.projects || []).some(function (project) { return Number(project.id) === openProjectId; });
                if (matched) openProject(openProjectId);
            }
        } catch (error) {
            console.error('renderProjectsPage failed', error);
            renderProjectList(Array.isArray(state.projects) ? state.projects : []);
        }
    }

    function renderInlineMarketButton(projectId, tab, extraClass) {
        return '';
    }

    function materialRow(item, projectId, insight) {
        item = item || {};
        var effectiveItem = materialEffectiveForProgress(projectId, effectiveMaterialFromReports(projectId, item));
        var effectiveSectionTitle = sectionTitleForMaterial(effectiveItem);
        var progress = materialActualProgress(projectId, effectiveItem);
        var isDone = progress.total > 0 && progress.actual >= progress.total;
        var warehouseBadge = renderWarehouseMatchBadge(projectId, effectiveItem);
        var deliveryField = renderMaterialDeliveryField(projectId, effectiveItem);
        var reportMark = effectiveItem.reportApplied && Number(effectiveItem.purchasedQty || 0) >= Number(effectiveItem.plannedQty || 0)
            ? '<br><span class="material-report-mark">\u0423\u0447\u0442\u0435\u043d\u043e \u0438\u0437 \u043e\u0442\u0447\u0435\u0442\u0430</span>'
            : '';
        return '<div class="material-row work-row estimate-compact-row material-estimate-row' + (isDone ? ' material-row-done work-row-done' : '') + (progress.actual > 0 && !isDone ? ' material-row-partial' : '') + '" data-item-id="' + escapeHtml(effectiveItem.id || '') + '">' +
            '<div class="work-row-main">' +
                '<label class="section-work-check section-material-check quantity-work-check estimate-compact-check' + (isDone ? ' is-done' : '') + (progress.actual > 0 && !isDone ? ' is-partial' : '') + '">' +
                    '<input type="checkbox" data-section-material-check data-item-id="' + escapeHtml(effectiveItem.id || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(effectiveSectionTitle) + '" data-material-id="' + escapeHtml(effectiveItem.id || '') + '" data-material-title="' + escapeHtml(effectiveItem.title || '') + '" data-material-unit="' + escapeHtml(effectiveItem.unit || '') + '" data-material-qty="' + escapeHtml(String(effectiveItem.plannedQty != null ? effectiveItem.plannedQty : effectiveItem.planned_qty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
                    '<span class="section-work-check-copy"><b>' + escapeHtml(effectiveItem.title || '') + '</b>' + reportMark + '</span>' +
                '</label>' +
                warehouseBadge +
            '</div>' +
            '<div class="work-row-side estimate-compact-side">' +
                renderCompactActualQtyEditor('material', projectId, '', effectiveItem, progress) +
                deliveryField +
                '<div class="material-chain-actions">' + renderInlineMarketButton(projectId, 'materials') + renderCounterpartyPicker(projectId, effectiveItem, insight, { empty: '\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a', selected: insight && insight.selectedName ? insight.selectedName : '\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a', none: '\u041d\u0435\u0442 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u0432' }, 'supplier') + '</div>' +
            '</div>' +
        '</div>';
    }


    function renderMaterials(items, projectId, insights) {
        var rawMaterials = (items || []).filter(function (item) {
            return String(item.itemKind || 'material').toLowerCase() !== 'work';
        });
        var materials = rawMaterials.filter(function (item) {
            return item && !item.is_deleted && !item.isDeleted && String(item.title || '').trim();
        }).map(function (item) {
            return effectiveMaterialFromReports(projectId, item);
        });
        if (rawMaterials.length !== materials.length && window.console) {
            console.log('Бэкенд прислал материалов всего:', rawMaterials.length);
            rawMaterials.forEach(function (item) {
                if (!item || !String(item.title || '').trim()) console.warn('Материал пропущен: нет названия', item);
                if (item && (item.is_deleted || item.isDeleted)) console.warn('Материал пропущен: удален', item);
            });
            console.log('Физически будет отрисовано материалов:', materials.length);
        }
        if (!materials.length) return '<p class="muted">\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u043f\u043e \u0441\u043c\u0435\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b.</p>';
        var progress = materialProgress(projectId, materials);
        var visibleMaterials = materials;
        var groups = groupMaterialsBySection(visibleMaterials);
        var totalSections = estimateTotalSectionCount(items, groups.map(function (group) { return group.title; }));
        return '<div class="execution-summary material-progress-summary estimate-summary-compact">' +
            stat('\u0412\u0441\u0435\u0433\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0439', String(materials.length)) +
            stat('\u0412\u0441\u0435\u0433\u043e \u0440\u0430\u0437\u0434\u0435\u043b\u043e\u0432', String(totalSections)) +
            stat('\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432 \u0437\u0430\u043a\u0440\u044b\u0442\u043e', String(progress.done) + ' \u0438\u0437 ' + String(progress.total), progress.total && progress.done >= progress.total ? 'success' : '') +
        '</div>' +
        renderCounterpartyFilter(projectId, 'supplier', materials, insights || {}) +
        renderGroupedMaterials(groups, projectId, insights || {});
    }


    function renderWorksPanel(stages, items) {
        var projectId = state.selectedProject ? state.selectedProject.id : null;
        var stageMap = buildStageLookup(stages || []);
        var workStages = (stages || []).filter(function (stage) { return String(stage.stage_kind || '') !== 'section'; });
        var rawEstimateWorks = (items || []).filter(function (item) { return String(item.itemKind || '').toLowerCase() === 'work'; });
        var estimateWorks = rawEstimateWorks.filter(function (item) {
            return item && !item.is_deleted && !item.isDeleted && String(item.title || '').trim();
        });
        if (rawEstimateWorks.length !== estimateWorks.length && window.console) {
            console.log('Бэкенд прислал работ всего:', rawEstimateWorks.length);
            rawEstimateWorks.forEach(function (item) {
                if (!item || !String(item.title || '').trim()) console.warn('Работа пропущена: нет названия', item);
                if (item && (item.is_deleted || item.isDeleted)) console.warn('Работа пропущена: удалена', item);
            });
            console.log('Физически будет отрисовано работ:', estimateWorks.length);
        }
        if (!workStages.length && !estimateWorks.length) return '<p class="muted">\u0420\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u0441\u043c\u0435\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b.</p>';
        var visibleEstimateWorks = estimateWorks;
        var visibleWorkStages = workStages;
        var groups = {};
        var order = [];
        function ensureGroup(title) {
            var sectionTitle = canonicalEstimateSectionTitle(title);
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            return groups[sectionTitle];
        }
        visibleWorkStages.forEach(function (stage) { ensureGroup(rootSectionTitleForStage(stage, stageMap)).stageRows.push(stage); });
        visibleEstimateWorks.forEach(function (item) { ensureGroup(item.sectionTitle || item.section_title || item.stageTitle || item.sectionId).estimateRows.push(item); });
        var originalSectionOrder = order.slice();
        var sectionNumbers = buildEstimateSectionNumberMap(originalSectionOrder);
        var scheduleOrder = workScheduleSections(projectId).map(function (section) { return canonicalEstimateSectionTitle(section && (section.title || section.sectionId)); }).filter(Boolean);
        if (scheduleOrder.length) {
            var scheduledMap = {};
            order = scheduleOrder.filter(function (title) {
                if (!groups[title]) return false;
                scheduledMap[title] = 1;
                return true;
            }).concat(order.filter(function (title) { return !scheduledMap[title]; }));
        }
        order.sort(function (left, right) {
            var leftNumber = sectionNumbers[left] || explicitEstimateSectionNumber(left) || 9999;
            var rightNumber = sectionNumbers[right] || explicitEstimateSectionNumber(right) || 9999;
            if (leftNumber !== rightNumber) return leftNumber - rightNumber;
            return originalSectionOrder.indexOf(left) - originalSectionOrder.indexOf(right);
        });
        var doneEstimateWorks = projectId ? estimateWorks.filter(function (item) {
            var sectionTitle = canonicalEstimateSectionTitle(item.sectionTitle || item.section_title || item.stageTitle || item.sectionId);
            return isProjectWorkDone(projectId, sectionTitle, item);
        }).length : 0;
        var totalWorkPositions = estimateWorks.length || workStages.length;
        var doneWorkPositions = estimateWorks.length ? doneEstimateWorks : workStages.filter(function (stage) { return Number(stage.progress || 0) >= 100; }).length;
        var totalSections = estimateTotalSectionCount(items, order);
        return '<div class="execution-summary work-progress-summary">' +
            stat('\u0412\u0441\u0435\u0433\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0439', String(totalWorkPositions)) +
            stat('\u0412\u0441\u0435\u0433\u043e \u0440\u0430\u0437\u0434\u0435\u043b\u043e\u0432', String(totalSections)) +
            stat('\u0420\u0430\u0431\u043e\u0442 \u0433\u043e\u0442\u043e\u0432\u043e', String(doneWorkPositions) + ' \u0438\u0437 ' + String(totalWorkPositions), totalWorkPositions && doneWorkPositions >= totalWorkPositions ? 'success' : '') +
        '</div>' +
        renderCounterpartyFilter(projectId, 'contractor', estimateWorks, state.materialInsightsByProject[projectId] || {}) +
        (visibleEstimateWorks.length || visibleWorkStages.length ? '<div class="estimate-section-list">' + order.map(function (title, index) {
            var group = groups[title];
            var workProgress = workProgressForRows(projectId, title, group.estimateRows);
            var scheduleMeta = workSectionScheduleMeta(projectId, title, index, workProgress);
            var open = isEstimateSectionOpen(projectId, 'works', title, index);
            var head = renderEstimateAccordionHead(
                projectId,
                'works',
                title,
                index,
                renderBulkSectionCheckbox(projectId, title, 'works', workProgress) + '<h3>' + escapeHtml(estimateDisplaySectionTitleWithNumber(title, index, sectionNumbers)) + '</h3>' + (workProgress.total ? sectionProgressBadge('works', workProgress, '') : ''),
                scheduleMeta.html + renderInlineMarketButton(projectId, 'works', 'inline-market-section') + '<span class="badge estimate-section-count">' + escapeHtml(String(group.stageRows.length + group.estimateRows.length) + ' \u043f\u043e\u0437.') + '</span>',
                '',
                sectionProgressStrip(workProgress, { total: 0, done: 0, percent: 0 }, title)
            );
            return '<section class="estimate-section estimate-section-card estimate-section-collapsible work-section-card' + scheduleMeta.className + (open ? ' is-open' : '') + '">' +
                head +
                renderEstimateSectionBody(open,
                    group.stageRows.map(function (stage) {
                        var meta = [stagePathLabel(stage, stageMap), stage.planned_start && stage.planned_end ? (stage.planned_start + ' - ' + stage.planned_end) : '', stage.responsible || ''].filter(Boolean).join(' \u2022 ');
                        return '<div class="material-row work-row"><div class="work-row-main"><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta || '\u0420\u0430\u0431\u043e\u0442\u0430') + '</small></div><div class="work-row-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' \u2022 ' + percent(stage.progress) + '%</span></div></div>';
                    }).join('') +
                    group.estimateRows.map(function (item) { return renderEstimateWorkItem(item, title, projectId, scheduleMeta.kind); }).join('')
                ) +
            '</section>';
        }).join('') + '</div>' : '<div class="market-empty">\u041f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c\u0443 \u0444\u0438\u043b\u044c\u0442\u0440\u0443 \u043f\u043e\u0437\u0438\u0446\u0438\u0439 \u043d\u0435\u0442.</div>');
    }


    function openProject(projectId) {
        var root = qs('[data-project-detail]');
        if (!root) return;
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;
        var loadingToken = beginProjectLoading(project.id);
        try {
            var params = new URLSearchParams(location.search);
            params.set('openProject', String(projectId));
            history.replaceState(null, '', location.pathname + '?' + params.toString());
        } catch (historyError) {}
        function panel(name) { return qs('[data-panel="' + name + '"]'); }
        state.selectedProject = project;
        root.hidden = false;
        setProjectFocusMode(true);
        ensureProjectWorksTab();
        document.documentElement.classList.remove('projects-booting');
        document.documentElement.classList.remove('project-route-loading');
        var overviewPanel = panel('overview');
        var materialsPanel = panel('materials');
        var worksPanel = panel('works');
        var schedulePanel = panel('schedule');
        var reportsPanel = panel('reports');
        var tasksPanel = panel('tasks');
        var financePanel = panel('finance');
        var documentsPanel = panel('documents');
        var chatPanel = panel('chat');
        var aiPanel = panel('ai');
        var titleNode = qs('[data-detail-title]') || qs('[data-project-title]');
        var scheduleRenderTimer = null;
        function renderScheduleNow(stages) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            if (schedulePanel) safeReplaceChildren(schedulePanel, renderSchedulePanel(stages || state.stagesByProject[project.id] || [], project));
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
            loadSelectedProjectMaterialSchedule(false);
        }
        function queueScheduleRender(stages) {
            if (scheduleRenderTimer) clearTimeout(scheduleRenderTimer);
            scheduleRenderTimer = setTimeout(function () {
                scheduleRenderTimer = null;
                renderScheduleNow(stages);
            }, 80);
        }
        if (titleNode) titleNode.textContent = project.title || '\u041e\u0442\u043a\u0440\u044b\u0442\u044b\u0439 \u043e\u0431\u044a\u0435\u043a\u0442';
        if (overviewPanel) {
            safeReplaceChildren(overviewPanel, renderProjectOverviewHero(project));
            refreshLucideIcons(overviewPanel);
        }
        if (materialsPanel) safeReplaceChildren(materialsPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b...</p>');
        if (worksPanel) safeReplaceChildren(worksPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0440\u0430\u0431\u043e\u0442\u044b...</p>');
        renderScheduleNow(state.stagesByProject[project.id] || []);
        if (reportsPanel) safeReplaceChildren(reportsPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043e\u0442\u0447\u0435\u0442\u044b...</p>');
        if (tasksPanel) safeReplaceChildren(tasksPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0437\u0430\u0434\u0430\u0447\u0438...</p>');
        if (financePanel) safeReplaceChildren(financePanel, '');
        if (documentsPanel) safeReplaceChildren(documentsPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b...</p>');
        if (chatPanel) safeReplaceChildren(chatPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0447\u0430\u0442...</p>');
        if (aiPanel) safeReplaceChildren(aiPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0430\u043d\u0430\u043b\u0438\u0437...</p>');
        bindProjectOverviewActions();
        syncProjectTabVisibility(root);
        activateProjectTab('overview');
        loadMaterials(project.id, function (items) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            if (materialsPanel) safeReplaceChildren(materialsPanel, renderProjectMaterialsTab(project, items, state.materialInsightsByProject[project.id] || null));
            if (worksPanel) safeReplaceChildren(worksPanel, renderProjectWorksTab(project, state.stagesByProject[project.id] || [], items));
            bindProjectMarketToggles(project.id);
            bindProjectChainActions();
            bindMaterialManualChecks(project.id);
        });
        loadMaterialInsights(project.id, function (insights) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            if (materialsPanel && state.materialsByProject[project.id]) safeReplaceChildren(materialsPanel, renderProjectMaterialsTab(project, state.materialsByProject[project.id] || [], insights || {}));
            bindProjectMarketToggles(project.id);
            bindProjectChainActions();
        });
        loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function () {
            if (!isCurrentProject(project.id, loadingToken)) return;
            queueScheduleRender(state.stagesByProject[project.id] || []);
        });
        loadProjectNotifications(project.id, function () {
            if (!isCurrentProject(project.id, loadingToken)) return;
            queueScheduleRender(state.stagesByProject[project.id] || []);
        });
        loadAnalysis(project.id, function (analysis) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            if (aiPanel) safeReplaceChildren(aiPanel, renderBackendAnalysis(analysis));
        });
        loadStages(project.id, function (stages) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            queueScheduleRender(stages);
            if (worksPanel) safeReplaceChildren(worksPanel, renderProjectWorksTab(project, stages, state.materialsByProject[project.id] || []));
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindMaterialManualChecks(project.id);
            loadExecutionInsights(project.id, stages);
        });
        refreshProjectReportsTab(project.id, loadingToken);
        loadTasks(project.id, loadingToken);
        loadDocuments(project.id, loadingToken);
        loadProjectChats(project.id, loadingToken);
        loadProjectAssignments(project.id, loadingToken);
        bindProjectChainActions();
    }

    function ensureProjectWorksTab() {
        var tabsRoot = qs('[data-project-detail] .tabs');
        if (tabsRoot && !qs('[data-tab="works"]', tabsRoot)) {
            var materialsTab = qs('[data-tab="materials"]', tabsRoot);
            if (materialsTab) materialsTab.insertAdjacentHTML('afterend', '<button class="tab" data-tab="works">\u0420\u0430\u0431\u043e\u0442\u044b</button>');
        }
        var detail = qs('[data-project-detail]');
        if (detail && !qs('[data-panel="works"]', detail)) {
            var materialsPanel = qs('[data-panel="materials"]', detail);
            if (materialsPanel) materialsPanel.insertAdjacentHTML('afterend', '<div class="tab-panel" data-panel="works"></div>');
        }
    }


    var PROJECT_STATUS_OPTIONS = ['Подготовка', 'В работе', 'На паузе', 'Завершен'];

    function projectStatusOptions(status) {
        var current = String(status || 'Подготовка');
        var options = PROJECT_STATUS_OPTIONS.slice();
        if (options.indexOf(current) === -1) options.unshift(current);
        return options.map(function (option) {
            return '<option value="' + escapeHtml(option) + '"' + (option === current ? ' selected' : '') + '>' + escapeHtml(option) + '</option>';
        }).join('');
    }

    function renderProjectStatusControl(project) {
        var status = project && project.status ? project.status : '\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430';
        if (!isAdminRole()) return '<span class="badge">' + escapeHtml(status) + '</span>';
        return '<label class="project-status-control">' +
            '<span>Статус</span>' +
            '<select data-project-status-select data-project-id="' + escapeHtml(project.id || '') + '">' + projectStatusOptions(status) + '</select>' +
        '</label>';
    }

    renderProjectOverviewHero = function (project) {
        var status = project.status || 'Подготовка';
        var budget = project.budget == null ? 'Не указано' : money(project.budget);
        var paid = project.paid == null ? '0 ₽' : money(project.paid);
        return '<section class="project-overview-hero">' +
            '<div class="project-overview-head">' +
                '<div>' +
                    '<span class="section-label">Объект</span>' +
                    '<h3>' + escapeHtml(project.title || 'Без названия') + '</h3>' +
                    '<p>' + escapeHtml(project.address || 'Адрес не указан') + '</p>' +
                '</div>' +
            '</div>' +
            renderStrongProgress(percent(project.progress), 'Текущая готовность', true) +
            '<div class="data-grid project-overview-grid">' +
                dataItem('Заказчик', project.client_name || 'Не указан') +
                dataItem('Номер договора', project.contract_no || 'Не указано') +
                dataItem('Бюджет', budget) +
                dataItem('Оплачено', paid) +
                dataItem('Старт', project.started_at || '—') +
                dataItem('Дедлайн', project.deadline_at || '—') +
                dataItem('Город', project.city || 'Не указан') +
                dataItem('Регион', project.region || 'Не указан') +
            '</div>' +
            (project.description ? '<div class="object-description">' + escapeHtml(project.description) + '</div>' : '') +
        '</section>';
    };

    renderProjectTabViewSwitcher = function (projectId, tab, title, subtitle) {
        var mode = getProjectTabMode(projectId, tab);
        return '<div class="market-toolbar">' +
            '<div><h3>' + escapeHtml(title) + '</h3>' + (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div>' +
            '<div class="segmented compact" data-market-switcher>' +
                '<button type="button" class="' + (mode === 'list' ? 'active' : '') + '" data-market-mode="list" data-market-tab="' + tab + '">Список</button>' +
                '<button type="button" class="' + (mode === 'market' ? 'active' : '') + '" data-market-mode="market" data-market-tab="' + tab + '">Анализ рынка</button>' +
            '</div>' +
        '</div>';
    };

    renderProjectMaterialsTab = function (project, items, insights) {
        var header = renderProjectTabViewSwitcher(project.id, 'materials', 'Материалы', '');
        if (getProjectTabMode(project.id, 'materials') === 'market') return header + renderProjectMarketBlock(project.id, 'material');
        return header + renderMaterials(items, project.id, insights);
    };

    renderProjectWorksTab = function (project, stages, items) {
        var header = renderProjectTabViewSwitcher(project.id, 'works', 'Работы', '');
        if (getProjectTabMode(project.id, 'works') === 'market') return header + renderProjectMarketBlock(project.id, 'work');
        return header + renderWorksPanel(stages, items);
    };

    renderProjectReportForm = function (project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card">' +
            '<div class="report-drawer-caption">Новый отчет</div>' +
            '<div class="card-head"><div><h3>Отчет по объекту за день</h3><span class="muted">Коротко опиши, что сделали сегодня. Система соберет нормальный текст отчета и покажет, какие работы и материалы будут отмечены.</span></div></div>' +
            '<form class="project-form report-intake-form report-chat-form" data-log-form>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<div class="report-chat-header">' +
                    '<label><span>Дата</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                    '<label><span>Заголовок</span><input name="title" placeholder="Например: День 1 — демонтаж и подготовка" required></label>' +
                '</div>' +
                '<div class="report-chat-composer">' +
                    '<div class="report-chat-role">Готовый отчет</div>' +
                    '<label class="report-chat-bubble-input">' +
                        '<span>Текст отчета</span>' +
                        '<textarea name="work_done" rows="6" placeholder="Здесь будет итоговый текст отчета. Можно править вручную." required></textarea>' +
                    '</label>' +
                '</div>' +
                '<div class="report-chat-composer report-chat-composer-assistant">' +
                    '<div class="report-chat-role">Быстрый ввод</div>' +
                    '<label class="report-chat-bubble-input assistant">' +
                        '<span>Что сделали сегодня</span>' +
                        '<textarea name="raw_input" rows="4" placeholder="Например: демонтировали стены полностью, поставили розетки половину, купили все розетки."></textarea>' +
                    '</label>' +
                '</div>' +
                '<div class="report-facts-grid">' +
                    '<label><span>Людей на объекте</span><input name="workers_count" type="number" min="0" step="1" placeholder="0"></label>' +
                    '<label><span>Прогресс объекта, %</span><input name="progress_percent" type="number" min="0" max="100" step="1" placeholder="18"></label>' +
                    '<label><span>Видимость</span><select name="is_client_visible"><option value="1">Виден заказчику</option><option value="0">Внутренний отчет</option></select></label>' +
                    '<label class="wide"><span>Техника / поставки</span><input name="equipment" placeholder="Манипулятор, подъемник, завоз кабеля, поставка розеток..."></label>' +
                    '<label><span>Блокеры</span><input name="blockers" placeholder="Что мешает работе"></label>' +
                    '<label><span>Следующий шаг</span><input name="next_steps" placeholder="Что делаем дальше"></label>' +
                '</div>' +
                '<div class="assistant-confirm-card report-confirm-card">' +
                    '<b>Предпросмотр применения</b>' +
                    '<div class="assistant-confirm-list">' +
                        '<span>Сначала проверь, какие работы и материалы будут отмечены.</span>' +
                        '<span>После сохранения изменения сразу появятся в графике, работах и материалах объекта.</span>' +
                    '</div>' +
                    '<label class="check-inline report-confirm"><input type="checkbox" name="confirm_report" required> Подтверждаю сохранение отчета и применение изменений</label>' +
                '</div>' +
                '<div class="form-error" data-log-error></div>' +
                '<div class="report-intake-actions">' +
                    '<button class="ghost" type="button" data-report-open-ai>Открыть ассистента</button>' +
                    '<button class="primary" type="submit">Сохранить отчет</button>' +
                '</div>' +
            '</form>' +
        '</section>';
    };

    renderProjectReportsPanel = function (project) {
        return '<div class="project-reports-shell">' +
            '<section class="subsection report-calendar-top">' +
                '<div class="card-head"><div><h3>Календарь отчетов</h3><span class="muted">Отчеты по дням, контроль пропусков и быстрый вход в нужную дату.</span></div>' +
                    (canCreateProjectReport() ? '<button class="primary compact" type="button" data-open-project-report-create>Новый отчет</button>' : '') +
                '</div>' +
                '<section class="stats-grid" data-logs-stats></section>' +
                '<div data-logs-alerts></div>' +
                '<div data-logs-calendar></div>' +
            '</section>' +
            '<section class="project-reports-grid">' +
                '<div data-logs-day-view></div>' +
                '<div class="project-reports-side">' +
                    '<section class="subsection report-assistant-card">' +
                        '<div class="card-head"><div><h3>Быстрый сценарий</h3><span class="muted">Надиктовал коротко, проверил предпросмотр, сохранил — и объект обновился.</span></div>' +
                            (canCreateProjectReport() ? '<button class="ghost compact" type="button" data-open-project-report-create>Создать отчет</button>' : '') +
                        '</div>' +
                        '<div class="assistant-confirm-list">' +
                            '<span>Закрытые работы автоматически отмечаются в графике и во вкладке работ.</span>' +
                            '<span>Закупленные или использованные материалы сразу меняют количества в карточках материалов.</span>' +
                        '</div>' +
                    '</section>' +
                '</div>' +
            '</section>' +
            '<section class="subsection">' +
                '<div class="card-head"><div><h3>Архив отчетов</h3><span class="muted">Все сохраненные отчеты по объекту в одном месте.</span></div></div>' +
                '<div data-report-archive-list data-logs-list><div class="report-archive-empty"><b>Архив отчетов</b><span>Сохраненные отчеты появятся здесь.</span></div></div>' +
            '</section>' +
        '</div>';
    };

    refreshProjectReportsTab = function (projectId) {
        var panel = qs('[data-panel="reports"]');
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!panel || !project) return;
        var oldDrawer = qs('[data-drawer-id="project-report-create"]');
        if (oldDrawer) oldDrawer.remove();
        panel.innerHTML = renderProjectReportsPanel(project);
        ensureProjectReportDrawer();
        bindLogForm();
        bindProjectReportAssistantActions();
        loadProjectLogs(projectId, function (logs) {
            loadProjectNotifications(projectId, function (notifications) {
                if (!state.logsSelectedDateByProject[projectId]) {
                    state.logsSelectedDateByProject[projectId] = (logs[0] && logs[0].report_date) || project.started_at || APP_TODAY;
                }
                renderLogsStats(logs, notifications);
                renderLogsAlerts(notifications);
                renderLogsCalendar(project, logs);
                renderLogsList(project, logs);
            });
        });
    };

    renderLogsStats = function (logs, notifications) {
        var root = qs('[data-logs-stats]');
        if (!root) return;
        root.innerHTML =
            stat('Отчетов', logs.length) +
            stat('Отчет сегодня', notifications && notifications.missingDailyReport ? 'нет' : 'есть', notifications && notifications.missingDailyReport ? 'danger' : '');
    };

    renderLogsAlerts = function (notifications) {
        var root = qs('[data-logs-alerts]');
        if (!root) return;
        if (!notifications) {
            root.innerHTML = '';
            return;
        }
        var cards = [];
        if (notifications.missingDailyReport) {
            cards.push('<article class="notice-card notice-warn"><b>Сегодня еще нет отчета</b><small>Добавь дневной факт, чтобы объект и график не теряли актуальность.</small></article>');
        }
        if (notifications.blockerLogs && notifications.blockerLogs.length) {
            var latestBlocker = notifications.blockerLogs[0];
            cards.push('<article class="notice-card notice-danger"><b>Есть свежий блокер</b><small>' + escapeHtml((latestBlocker.report_date || 'Без даты') + ': ' + (latestBlocker.blockers || 'Описание не указано')) + '</small></article>');
        }
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            cards.push('<article class="notice-card"><b>Просроченных задач: ' + notifications.overdueTasks.length + '</b><small>Проверь связанные задачи по объекту и обнови план.</small></article>');
        }
        root.innerHTML = cards.join('');
    };

    renderLogsCalendar = function (project, logs) {
        var root = qs('[data-logs-calendar]');
        if (!root || !project) return;
        var projectId = Number(project.id);
        var selectedDate = state.logsSelectedDateByProject[projectId] || (logs[0] && logs[0].report_date) || APP_TODAY;
        var monthStart = state.logsCalendarMonthByProject[projectId] || logsMonthStartIso(selectedDate);
        state.logsCalendarMonthByProject[projectId] = monthStart;
        var monthDate = new Date(monthStart + 'T00:00:00Z');
        var year = monthDate.getUTCFullYear();
        var month = monthDate.getUTCMonth();
        var firstWeekday = (monthDate.getUTCDay() + 6) % 7;
        var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        var dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        var logsByDate = {};
        logs.forEach(function (log) {
            if (!logsByDate[log.report_date]) logsByDate[log.report_date] = 0;
            logsByDate[log.report_date] += 1;
        });
        var cells = [];
        for (var blank = 0; blank < firstWeekday; blank += 1) cells.push('<div class="logs-calendar-day is-empty"></div>');
        for (var day = 1; day <= daysInMonth; day += 1) {
            var iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
            var classes = ['logs-calendar-day'];
            if (iso === APP_TODAY) classes.push('is-today');
            if (iso === selectedDate) classes.push('is-selected');
            if (logsByDate[iso]) classes.push('has-report');
            cells.push('<button class="' + classes.join(' ') + '" type="button" data-log-date="' + iso + '"><strong>' + day + '</strong>' + (logsByDate[iso] ? '<span>' + logsByDate[iso] + '</span>' : '') + '</button>');
        }
        root.innerHTML =
            '<div class="logs-calendar-card">' +
                '<div class="logs-calendar-head">' +
                    '<button class="ghost" type="button" data-log-month-shift="-1">Назад</button>' +
                    '<b>' + escapeHtml(formatRuMonthYear(monthStart)) + '</b>' +
                    '<button class="ghost" type="button" data-log-month-shift="1">Вперед</button>' +
                '</div>' +
                '<div class="logs-calendar-grid logs-calendar-weekdays">' + dayLabels.map(function (dayLabel) {
                    return '<span>' + dayLabel + '</span>';
                }).join('') + '</div>' +
                '<div class="logs-calendar-grid">' + cells.join('') + '</div>' +
            '</div>';
        bindLogsCalendar(project, logs);
        renderLogsDayView(project, logs);
    };

    renderLogsDayView = function (project, logs) {
        var root = qs('[data-logs-day-view]');
        if (!root || !project) return;
        var projectId = Number(project.id);
        var selectedDate = state.logsSelectedDateByProject[projectId] || (logs[0] && logs[0].report_date) || APP_TODAY;
        var selectedLogs = logs.filter(function (log) { return log.report_date === selectedDate; });
        if (!selectedLogs.length) {
            root.innerHTML =
                '<div class="logs-day-panel report-chat-panel">' +
                    '<div class="logs-day-panel-head"><b>' + escapeHtml(formatRuDate(selectedDate)) + '</b><span class="badge">0</span></div>' +
                    '<div class="report-chat-empty"><b>На этот день отчета пока нет</b><p class="muted">Выбери день в календаре или создай новый отчет.</p></div>' +
                '</div>';
            return;
        }
        root.innerHTML =
            '<div class="logs-day-panel report-chat-panel">' +
                '<div class="logs-day-panel-head"><b>' + escapeHtml(formatRuDate(selectedDate)) + '</b><span class="badge">' + selectedLogs.length + ' шт.</span></div>' +
                '<div class="report-chat-list">' + selectedLogs.map(function (log) {
                    return '<article class="report-chat-message">' +
                        '<div class="report-chat-meta">' +
                            '<div><span>' + escapeHtml(log.author_name || 'Без автора') + '</span><h4>' + escapeHtml(log.title) + '</h4></div>' +
                            '<div class="report-chat-side"><div class="project-badges">' +
                                (log.progress_percent != null && log.progress_percent !== '' ? '<span class="badge success">' + escapeHtml(Math.round(Number(log.progress_percent) || 0)) + '%</span>' : '') +
                                '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + (Number(log.is_client_visible) === 1 ? 'Заказчику' : 'Внутренний') + '</span>' +
                            '</div>' + renderProjectReportDeleteButton(projectId, log, true) + '</div>' +
                        '</div>' +
                        '<div class="report-chat-bubble"><p>' + escapeHtml(log.work_done) + '</p><div class="log-details">' +
                            (log.equipment ? '<div><span>Техника / поставки</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                            (log.blockers ? '<div class="log-risk"><span>Блокеры</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                            (log.next_steps ? '<div><span>Следующий шаг</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                        '</div>' +
                        (log.raw_input ? '<small class="muted">Исходный ввод: ' + escapeHtml(log.raw_input) + '</small>' : '') +
                        '</div><small class="report-chat-date">' + escapeHtml(log.report_date || 'Без даты') + '</small></article>';
                }).join('') + '</div>' +
            '</div>';
        bindProjectReportDeleteActions();
    };


    finalSectionWorkDigest = function (section) {
        var items = Array.isArray(section.items) ? section.items : [];
        var workCount = liveScheduleSectionItems(section).length;
        var kinds = {};
        var volumes = {};
        var topTitles = [];
        items.forEach(function (item) {
            var title = String(item.title || '').trim();
            if (title) {
                if (topTitles.length < 3) topTitles.push(finalSectionSummaryTitle(title));
                var firstWord = title.replace(/^[^A-Za-z\u0400-\u04FF0-9]+/, '').split(/\s+/)[0].toLowerCase();
                if (firstWord) kinds[firstWord] = (kinds[firstWord] || 0) + 1;
            }
            var qty = Number(item.planned_qty != null ? item.planned_qty : item.plannedQty);
            var unit = String(item.unit || '').trim();
            if (unit && isFinite(qty) && qty > 0) volumes[unit] = (volumes[unit] || 0) + qty;
        });
        var topKinds = Object.keys(kinds).sort(function (left, right) {
            return kinds[right] - kinds[left];
        }).slice(0, 3).map(function (word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        });
        var lead = workCount ? (String(workCount) + ' работ') : 'Работы раздела';
        if (topKinds.length) lead += ': ' + topKinds.join(', ');
        var volumeLine = Object.keys(volumes).sort(function (left, right) {
            return volumes[right] - volumes[left];
        }).slice(0, 3).map(function (unit) {
            return finalSectionSummaryNumber(volumes[unit]) + ' ' + unit;
        }).join(' • ');
        return {
            lead: lead,
            volume: volumeLine ? ('Объемы: ' + volumeLine) : '',
            titles: topTitles.join(' • ')
        };
    };

    renderScheduleScale = function (range) {
        var marks = [];
        var steps = range.totalDays <= 4 ? range.totalDays : 5;
        for (var index = 0; index < steps; index += 1) {
            var offset = steps === 1 ? 0 : Math.round(((range.totalDays - 1) * index) / (steps - 1));
            var iso = addDaysToIso(range.start, offset);
            var left = range.totalDays === 1 ? 0 : (offset / (range.totalDays - 1)) * 100;
            var sideClass = index === 0 ? ' is-start' : (index === steps - 1 ? ' is-end' : '');
            marks.push('<span class="schedule-gantt-mark' + sideClass + '" style="left:' + left + '%"><i></i><b>' + escapeHtml(finalGraphDate(iso)) + '</b></span>');
        }
        return '<div class="schedule-gantt-scale"><div class="schedule-gantt-scale-line"></div>' + marks.join('') + '</div>' +
            '<div class="schedule-gantt-legend"><span><i class="legend-dot"></i> контрольные даты</span><span><i class="legend-bar"></i> окно раздела</span><span><i class="legend-today"></i> сегодня</span></div>';
    };

    renderSectionScheduleBrief = function (section) {
        var project = state.selectedProject;
        var progress = project ? scheduleSectionProgress(project.id, section) : { percent: 0 };
        var deadlineState = scheduleDeadlineState(section.startDate, section.endDate, progress.percent, section.estimatedDays);
        var briefValue = deadlineState.daysLeft == null ? String(section.estimatedDays || 0) : String(deadlineState.daysLeft);
        var briefLabel = deadlineState.daysLeft == null ? 'дн.' : 'осталось';
        return '<article class="section-schedule-brief' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-brief-head"><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small></div>' +
            '<div class="section-schedule-brief-duration' + (deadlineState.kind ? (' is-' + deadlineState.kind) : '') + '"><strong>' + escapeHtml(briefValue) + '</strong><span>' + escapeHtml(briefLabel) + '</span></div>' +
            '<p>' + escapeHtml(finalSectionWorkDigest(section).lead) + '</p>' +
        '</article>';
    };


    function scheduleMilestonePercent(isoDate, startDate, endDate) {
        var start = isoTime(startDate);
        var end = isoTime(endDate);
        var point = isoTime(isoDate);
        if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(point) || end <= start) return 0;
        return Math.max(0, Math.min(100, Math.round(((point - start) / (end - start)) * 1000) / 10));
    }

    function renderScheduleSectionMilestones(project, sections, startDate, endDate) {
        var rows = (sections || []).map(function (section, index) {
            var progress = scheduleSectionProgress(project.id, section);
            var done = progress.total > 0 && progress.percent >= 100;
            var left = scheduleMilestonePercent(section.endDate || endDate, startDate, endDate);
            return '<span class="schedule-progress-milestone' + (done ? ' is-done' : ' is-open') + '" style="left:' + left + '%" title="' + escapeHtml((section.title || '') + ' - ' + finalGraphDate(section.endDate)) + '">' +
                '<i></i><b>' + escapeHtml('Р' + String(index + 1)) + '</b>' +
            '</span>';
        }).join('');
        return rows ? '<div class="schedule-progress-milestones">' + rows + '</div>' : '';
    }

    function materialChecklistStorageKey(projectId) {
        return 'pmbi.material.checklist.' + String(projectId || '');
    }

    function materialCompletionKey(item) {
        return [
            normalizedWorkKeyPart(item && item.id),
            normalizedWorkKeyPart(item && item.title),
            normalizedWorkQty(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty)),
            normalizedWorkKeyPart(item && item.unit)
        ].join('|');
    }

    function isMaterialManuallyDone(projectId, item) {
        var map = readStoredJson(materialChecklistStorageKey(projectId));
        return map[materialCompletionKey(item)] === 1;
    }

    function setMaterialManuallyDone(projectId, item, isDone) {
        var map = readStoredJson(materialChecklistStorageKey(projectId));
        var key = materialCompletionKey(item);
        if (isDone) map[key] = 1;
        else delete map[key];
        writeStoredJson(materialChecklistStorageKey(projectId), map);
    }

    function materialEffectiveForProgress(projectId, item) {
        var effective = effectiveMaterialFromReports(projectId, item);
        if (isMaterialManuallyDone(projectId, item)) {
            var planned = Number(effective.plannedQty || effective.planned_qty || 0);
            effective.manualClosed = true;
            effective.supplyStatus = 'in_stock';
            if (planned > 0) {
                effective.purchasedQty = finalSectionSummaryNumber(Math.max(Number(effective.purchasedQty || 0), planned));
                effective.stockQty = finalSectionSummaryNumber(Math.max(Number(effective.stockQty || 0), planned));
                effective.missingQty = 0;
            }
        }
        return effective;
    }

    function isMaterialDone(projectId, item) {
        if (isMaterialManuallyDone(projectId, item)) return true;
        var effective = effectiveMaterialFromReports(projectId, item);
        var planned = Number(effective.plannedQty || effective.planned_qty || 0);
        var purchased = Number(effective.purchasedQty || 0);
        var stock = Number(effective.stockQty || 0);
        var used = Number(effective.usedQty || 0);
        if (planned > 0 && Math.max(purchased, stock, used) >= planned) return true;
        return String(effective.supplyStatus || '') === 'in_stock' && planned > 0;
    }

    function materialProgress(projectId, items) {
        var rows = (items || []).filter(function (item) {
            return String(item.itemKind || 'material').toLowerCase() !== 'work';
        });
        var done = rows.filter(function (item) {
            return isMaterialDone(projectId, item);
        }).length;
        return {
            total: rows.length,
            done: done,
            left: Math.max(0, rows.length - done),
            percent: rows.length ? Math.round((done / rows.length) * 100) : 0
        };
    }

    function isProjectWorkDone(projectId, sectionTitle, item) {
        if (!projectId) return false;
        if (isScheduleWorkDone(projectId, sectionTitle, item)) return true;
        var canonicalSectionTitle = canonicalEstimateSectionTitle(sectionTitle);
        return workScheduleSections(projectId).some(function (section) {
            var scheduleTitle = canonicalEstimateSectionTitle(section && (section.title || section.sectionId));
            return section && scheduleTitle !== canonicalSectionTitle && isScheduleWorkDone(projectId, scheduleTitle, item);
        });
    }

    function workProgressForRows(projectId, sectionTitle, rows) {
        var workRows = rows || [];
        var done = projectId ? workRows.filter(function (item) {
            return isProjectWorkDone(projectId, sectionTitle, item);
        }).length : 0;
        return {
            total: workRows.length,
            done: done,
            left: Math.max(0, workRows.length - done),
            percent: workRows.length ? Math.round((done / workRows.length) * 100) : 0
        };
    }

    function sectionProgressBadge(kind, progress, label) {
        return '<span class="estimate-section-progress estimate-section-progress-' + kind + (progress.total && progress.done >= progress.total ? ' is-complete' : '') + '">' +
            '<strong>' + escapeHtml(String(progress.done) + ' \u0438\u0437 ' + String(progress.total)) + '</strong>' +
            (label ? '<small>' + escapeHtml(label) + '</small>' : '') +
        '</span>';
    }

    function sectionProgressLine(kind, label, progress, sectionId) {
        progress = progress || { total: 0, done: 0, percent: 0 };
        var total = Number(progress.total || 0);
        var done = Number(progress.done || 0);
        var percentValue = total ? percent(progress.percent != null ? progress.percent : Math.round((done / total) * 100)) : 0;
        return '<div class="estimate-section-progress-line estimate-section-progress-line-' + escapeHtml(kind) + '" data-progress-section-id="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '" data-section-progress="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '" data-section-progress-kind="' + escapeHtml(kind) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percentValue + '">' +
            '<div class="estimate-section-progress-line-head"><strong>' + escapeHtml(label) + '</strong><span data-progress-count>' + escapeHtml(total ? (String(done) + ' \u0438\u0437 ' + String(total)) : '\u041f\u043e\u0437\u0438\u0446\u0438\u0439 \u043d\u0435\u0442') + '</span></div>' +
            '<div class="section-schedule-progress-bar"><span style="width:' + percentValue + '%"></span><b class="section-schedule-progress-value" data-progress-text>' + escapeHtml(String(percentValue)) + '%</b></div>' +
        '</div>';
    }

    function sectionProgressStrip(workProgress, materialProgressValue, sectionId) {
        workProgress = workProgress || { total: 0, done: 0, percent: 0 };
        materialProgressValue = materialProgressValue || { total: 0, done: 0, percent: 0 };
        var lines = [];
        if (materialProgressValue.total || !workProgress.total) lines.push(sectionProgressLine('material', '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b', materialProgressValue, sectionId));
        if (workProgress.total || !materialProgressValue.total) lines.push(sectionProgressLine('work', '\u0420\u0430\u0431\u043e\u0442\u044b', workProgress, sectionId));
        return '<div class="estimate-section-progress-strip estimate-section-progress-split" data-progress-split-section="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '">' +
            lines.join('') +
        '</div>';
    }

    function unitMultiplierInfo(unit) {
        var raw = String(unit || '').trim();
        var match = raw.match(/^(\d+(?:[\.,]\d+)?)\s+(.+)$/);
        if (!match) return null;
        var multiplier = Number(String(match[1]).replace(',', '.'));
        if (!Number.isFinite(multiplier) || multiplier <= 1) return null;
        return {
            multiplier: multiplier,
            unit: match[2].trim()
        };
    }

    function calculatedWorkVolume(item) {
        var qty = Number(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty));
        var info = unitMultiplierInfo(item && item.unit);
        if (!Number.isFinite(qty) || !info) return null;
        return {
            qty: qty * info.multiplier,
            unit: info.unit
        };
    }

    function formatCalculatedWorkVolume(item) {
        var calculated = calculatedWorkVolume(item);
        if (!calculated) return '';
        return finalSectionSummaryNumber(calculated.qty) + ' ' + calculated.unit;
    }

    function renderWorkManualCheck(item, sectionTitle, projectId) {
        var isDone = projectId ? isProjectWorkDone(projectId, sectionTitle, item) : false;
        return '<label class="section-work-check work-list-check' + (isDone ? ' is-done' : '') + '">' +
            '<input type="checkbox" data-section-work-check data-item-id="' + escapeHtml(item.id || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-work-id="' + escapeHtml(item.id || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
            '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '') + '</b><small>' + escapeHtml(formatWorkLine(item) || '\u041e\u0431\u044a\u0435\u043c \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d') + '</small></span>' +
        '</label>';
    }

    function renderMaterialManualCheck(item, sectionTitle, projectId) {
        var effectiveItem = materialEffectiveForProgress(projectId, item);
        var isDone = isMaterialDone(projectId, item);
        var planned = Number(effectiveItem.plannedQty || effectiveItem.planned_qty || 0);
        var unitLabel = String(effectiveItem.unit || '').trim() || '\u0435\u0434.';
        var meta = [
            '\u041f\u043e \u0441\u043c\u0435\u0442\u0435: ' + finalSectionSummaryNumber(planned) + ' ' + unitLabel,
            '\u043a\u0443\u043f\u043b\u0435\u043d\u043e: ' + finalSectionSummaryNumber(effectiveItem.purchasedQty || 0),
            '\u043e\u0441\u0442\u0430\u0442\u043e\u043a: ' + finalSectionSummaryNumber(effectiveItem.stockQty || 0),
            effectiveItem.manualClosed ? '\u0437\u0430\u043a\u0440\u044b\u0442\u043e \u0432\u0440\u0443\u0447\u043d\u0443\u044e' : (effectiveItem.reportApplied ? '\u0437\u0430\u043a\u0440\u044b\u0442\u043e \u043f\u043e \u043e\u0442\u0447\u0435\u0442\u0443' : '')
        ].filter(Boolean).join(' \u2022 ');
        return '<label class="section-work-check section-material-check' + (isDone ? ' is-done' : '') + '">' +
            '<input type="checkbox" data-section-material-check data-item-id="' + escapeHtml(item.id || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-material-id="' + escapeHtml(item.id || '') + '" data-material-title="' + escapeHtml(item.title || '') + '" data-material-unit="' + escapeHtml(item.unit || '') + '" data-material-qty="' + escapeHtml(String(item.plannedQty != null ? item.plannedQty : item.planned_qty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
            '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '') + '</b><small>' + escapeHtml(meta) + '</small></span>' +
        '</label>';
    }

    function renderSectionMaterialsBlock(materialRows, sectionTitle, projectId) {
        if (!materialRows.length) return '';
        return '<div class="work-section-materials">' +
            '<div class="work-section-subhead"><strong>\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b</strong><span>' + escapeHtml(String(materialRows.length) + ' \u043f\u043e\u0437.') + '</span></div>' +
            '<div class="section-schedule-details material-check-list">' +
                materialRows.map(function (item) { return renderMaterialManualCheck(item, sectionTitle, projectId); }).join('') +
            '</div>' +
        '</div>';
    }

    renderGroupedMaterials = function (groups, projectId, insights) {
        insights = insights || {};
        return '<div class="estimate-section-list">' + (groups || []).map(function (group, index) {
            var originalTitle = canonicalEstimateSectionTitle(group && group.title);
            var progress = materialProgress(projectId, group.items || []);
            return '<section class="estimate-section">' +
                '<div class="card-head estimate-section-head"><div class="estimate-section-title"><h3>' + escapeHtml(materialSectionLabel(index)) + '</h3>' + sectionProgressBadge('materials', progress, '') + '</div><div class="work-section-head-side">' + renderInlineMarketButton(projectId, 'materials', 'inline-market-section') + (originalTitle ? '<small>' + escapeHtml(originalTitle) + '</small>' : '') + '</div></div>' +
                sectionProgressStrip({ total: 0, done: 0 }, progress, originalTitle) +
                '<div class="materials-list">' + group.items.map(function (item) {
                    return materialRow(item, projectId, insights[Number(item.id)] || null);
                }).join('') + '</div>' +
            '</section>';
        }).join('') + '</div>';
    };

    function workScheduleSections(projectId) {
        var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[projectId];
        return Array.isArray(summary && summary.sections) ? summary.sections : [];
    }

    function workScheduleSectionForTitle(projectId, title) {
        var normalizedTitle = normalizedWorkKeyPart(canonicalEstimateSectionTitle(title));
        return workScheduleSections(projectId).find(function (section) {
            return normalizedWorkKeyPart(canonicalEstimateSectionTitle(section && (section.title || section.sectionId))) === normalizedTitle;
        }) || null;
    }

    function workSectionScheduleMeta(projectId, title, index, progress) {
        var section = workScheduleSectionForTitle(projectId, title);
        if (!section) {
            return {
                className: '',
                kind: '',
                heading: materialSectionLabel(index),
                html: '<span class="work-section-date is-empty">\u0421\u0440\u043e\u043a \u043d\u0435 \u0437\u0430\u0434\u0430\u043d</span>'
            };
        }
        var deadlineState = scheduleDeadlineState(section.startDate, section.endDate, progress.percent, section.estimatedDays);
        return {
            className: deadlineState.kind ? (' work-section-' + deadlineState.kind) : '',
            kind: deadlineState.kind,
            section: section,
            deadlineState: deadlineState,
            heading: materialSectionLabel(index),
            html: '<span class="work-section-date">' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</span>' + scheduleDeadlineBadge(deadlineState)
        };
    }


    function rerenderProjectMaterialAndWorkViews(projectId) {
        var project = state.projects.find(function (item) {
            return Number(item.id) === Number(projectId);
        }) || state.selectedProject;
        if (!project || !state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        var stages = state.stagesByProject[projectId] || [];
        var materials = state.materialsByProject[projectId] || [];
        var insights = state.materialInsightsByProject[projectId] || {};
        var materialsPanel = qs('[data-panel="materials"]');
        var worksPanel = qs('[data-panel="works"]');
        var overviewMaterials = qs('[data-project-overview-materials]');
        if (materialsPanel) safeReplaceChildren(materialsPanel, renderProjectMaterialsTab(project, materials, insights));
        if (overviewMaterials) safeReplaceChildren(overviewMaterials, renderMaterials(materials, project.id, insights));
        if (worksPanel) safeReplaceChildren(worksPanel, renderProjectWorksTab(project, stages, materials));
        bindProjectMarketToggles(projectId);
        bindProjectChainActions();
        bindSectionScheduleRefresh(projectId);
        syncBulkSectionChecks();
    }

    function refreshSelectedProjectProgressViews(projectId) {
        if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        rerenderProjectMaterialAndWorkViews(projectId);
        var schedulePanel = qs('[data-panel="schedule"]');
        if (schedulePanel) {
            safeReplaceChildren(schedulePanel, renderSchedulePanel(state.stagesByProject[projectId] || [], state.selectedProject));
            bindAutoScheduleForm(projectId);
            bindScheduleStatusActions(projectId);
            bindSectionScheduleRefresh(projectId);
            bindSectionScheduleInteractions(projectId);
            bindActualQuantityInputs(projectId);
            loadSelectedProjectMaterialSchedule(false);
        }
    }

    function bindMaterialManualChecks(projectId) {
        qsa('[data-section-material-check]').forEach(function (input) {
            if (input.dataset.materialBound === '1') return;
            input.dataset.materialBound = '1';
            input.addEventListener('change', function () {
                var project = state.selectedProject;
                if (!project || Number(project.id) !== Number(projectId)) return;
                saveManualQuantityCheckbox(input);
            });
        });
    }

    var baseBindProjectChainActionsFinal = bindProjectChainActions;
    bindProjectChainActions = function () {
        baseBindProjectChainActionsFinal();
        if (state.selectedProject && state.selectedProject.id) bindMaterialManualChecks(state.selectedProject.id);
    };

    var baseLoadMaterialsForManualChecks = loadMaterials;
    loadMaterials = function (projectId, callback) {
        baseLoadMaterialsForManualChecks(projectId, function (items) {
            callback(items || []);
            setTimeout(function () {
                if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    bindMaterialManualChecks(projectId);
                }
            }, 0);
        });
    };

    function reportHasWholeIntent(text) {
        var normalized = normalizeReportText(text);
        return /(^|\s)(100%|все|всё|весь|вся|всю|полностью|целиком|закрыли|закрыто|закрыт|докупили|дозакупили)(\s|$)/.test(normalized)
            || /РІСЃРµ\b|РІРµСЃСЊ\b|РїРѕР»РЅРѕСЃС‚|Р·Р°РєСЂС‹Р»Рё/.test(normalized);
    }

    function reportHasPartialIntent(text) {
        var normalized = normalizeReportText(text);
        return /(50%|половин|наполовину|частич|часть|не все|не всё)/.test(normalized)
            || /РїРѕР»РѕРІРёРЅ|50%|С‡Р°СЃС‚РёС‡/.test(normalized);
    }

    function reportHasPurchaseIntent(text) {
        return clauseHasAnyStem(text, [
            'куп', 'закуп', 'зака', 'заве', 'дост', 'полу', 'прив', 'приобр',
            'РєСѓРї', 'Р·Р°РєСѓ', 'Р·Р°РєР°', 'Р·Р°РІРµ', 'РґРѕСЃС‚', 'РїРѕР»Сѓ', 'РїСЂРёРІ'
        ]);
    }

    function reportHasUseIntent(text) {
        return clauseHasAnyStem(text, [
            'уста', 'смон', 'пост', 'улож', 'испо', 'приме', 'перед', 'прове', 'смонт', 'монта', 'сдел',
            'СѓСЃС‚Р°', 'СЃРјРѕРЅ', 'РїРѕСЃС‚', 'СѓР»РѕР¶', 'РёСЃРїРѕ', 'РїСЂРёРјРµ', 'РїРµСЂРµРґ', 'РїСЂРѕРІРµ'
        ]);
    }

    function reportTextClauses(value) {
        return String(value || '')
            .split(/\n|[.!?;]+|,(?=\s*(?:там\s+)?(?:демонт|постав|куп|закуп|сдел|смонт|монт|установ|улож|использ|примен|перед|привез|завез|получ|закры))/i)
            .map(function (part) { return part.trim(); })
            .filter(Boolean);
    }

    function normalizeReportText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/С‘/g, 'Рµ')
            .replace(/[^a-z\u0400-\u04ff0-9%]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function reportQuantityFromClause(clauseText, item) {
        var raw = String(clauseText || '');
        var normalized = normalizeReportText(raw);
        var planned = Number(item.plannedQty != null ? item.plannedQty : item.planned_qty || 0);
        var unit = String(item.unit || '').trim();
        var percentMatch = normalized.match(/(\d+(?:[\.,]\d+)?)%/);
        if (percentMatch && planned > 0) {
            return planned * Math.max(0, Math.min(100, Number(String(percentMatch[1]).replace(',', '.')) || 0)) / 100;
        }
        if (unit) {
            var unitMatch = raw.match(new RegExp('(\\d+(?:[\\.,]\\d+)?)\\s*' + escapeRegex(unit), 'i'));
            if (unitMatch) return Number(String(unitMatch[1]).replace(',', '.')) || 0;
        }
        if (reportHasPartialIntent(normalized) && planned > 0) return planned * 0.5;
        if (reportHasWholeIntent(normalized) && planned > 0) return planned;
        var numberMatch = normalized.match(/(^|\s)(\d+(?:[\.,]\d+)?)(\s|$)/);
        if (numberMatch) return Number(String(numberMatch[2]).replace(',', '.')) || 0;
        return 0;
    }

    function reportWorkResultFromClause(clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var planned = Number(candidate.item.planned_qty != null ? candidate.item.planned_qty : candidate.item.plannedQty || 0);
        var qty = reportQuantityFromClause(clauseText, candidate.item);
        var partial = reportHasPartialIntent(clauseText);
        if (planned > 0 && qty > 0 && qty < planned) partial = true;
        return {
            sectionTitle: candidate.sectionTitle,
            item: candidate.item,
            score: score,
            done: !partial,
            partial: partial
        };
    }

    function reportMaterialResultFromClause(clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var normalized = normalizeReportText(clauseText);
        var qty = reportQuantityFromClause(clauseText, candidate.item);
        var planned = Number(candidate.item.plannedQty || candidate.item.planned_qty || 0);
        var purchase = reportHasPurchaseIntent(normalized);
        var used = reportHasUseIntent(normalized);
        if (!purchase && !used) used = true;
        if (!qty && planned > 0 && reportHasPartialIntent(normalized)) qty = planned * 0.5;
        if (!qty && planned > 0 && reportHasWholeIntent(normalized)) qty = planned;
        return {
            item: candidate.item,
            score: score,
            purchasedQty: purchase ? qty : 0,
            usedQty: used ? qty : 0
        };
    }

    ensureReportPreviewRoot = function (form) {
        var root = qs('[data-report-preview]', form);
        if (root) return root;
        var confirmCard = qs('.assistant-confirm-card', form);
        if (!confirmCard) return null;
        root = document.createElement('div');
        root.className = 'report-apply-preview';
        root.setAttribute('data-report-preview', '');
        confirmCard.insertBefore(root, qs('.report-confirm', confirmCard) || null);
        return root;
    };

    renderReportPreviewHtml = function (projectId, draft) {
        if (!draft.text && !draft.workMatches.length && !draft.materialMatches.length) {
            return '<div class="report-preview-empty">Напиши в поле выше, что сделали или закупили. Здесь появится текст отчета и список изменений.</div>';
        }
        var html = ['<div class="report-preview-grid">'];
        if (draft.text) {
            html.push('<section class="report-preview-card report-preview-card-main"><strong>Будет сохранен отчет</strong><p>' + escapeHtml(draft.text) + '</p></section>');
        }
        html.push('<section class="report-preview-card"><strong>Работы</strong>');
        if (draft.workMatches.length) {
            var workGroups = {};
            var workOrder = [];
            draft.workMatches.forEach(function (entry) {
                var sectionTitle = String(entry.sectionTitle || entry.item.sectionTitle || entry.item.stageTitle || 'Без раздела').trim() || 'Без раздела';
                if (!workGroups[sectionTitle]) {
                    workGroups[sectionTitle] = [];
                    workOrder.push(sectionTitle);
                }
                workGroups[sectionTitle].push(entry);
            });
            html.push('<div class="report-preview-sections">' + workOrder.map(function (sectionTitle) {
                return '<div class="report-preview-section"><b>' + escapeHtml(sectionTitle) + '</b>' + workGroups[sectionTitle].map(function (entry) {
                    return '<span>' + escapeHtml(entry.item.title + (entry.partial ? ' - частично' : '')) + '</span>';
                }).join('') + '</div>';
            }).join('') + '</div>');
        } else {
            html.push('<div class="report-preview-muted">Пока не найдены явные совпадения.</div>');
        }
        html.push('</section><section class="report-preview-card"><strong>Материалы</strong>');
        if (draft.materialMatches.length) {
            html.push('<div class="report-preview-sections">' + draft.materialMatches.map(function (entry) {
                var bits = [];
                if (entry.purchasedQty > 0) bits.push('куплено ' + finalSectionSummaryNumber(entry.purchasedQty));
                if (entry.usedQty > 0) bits.push('в работу ' + finalSectionSummaryNumber(entry.usedQty));
                var sectionTitle = String(entry.item.sectionTitle || entry.item.stageTitle || 'Материалы').trim() || 'Материалы';
                return '<div class="report-preview-section"><b>' + escapeHtml(sectionTitle) + '</b><span>' + escapeHtml(entry.item.title + ' - ' + bits.join(', ') + ' ' + quantityPlanInfo(entry.item).unit) + '</span></div>';
            }).join('') + '</div>');
        } else {
            html.push('<div class="report-preview-muted">Пока не найдены явные совпадения.</div>');
        }
        html.push('</section></div>');
        return html.join('');
    };

    renderProjectReportForm = function (project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card">' +
            '<div class="report-drawer-caption">Новый отчет</div>' +
            '<div class="card-head"><div><h3>Отчет по объекту за день</h3><span class="muted">Напиши одной фразой, что сделали или закупили. Система покажет текст отчета и изменения перед сохранением.</span></div></div>' +
            '<form class="project-form report-intake-form report-chat-form report-chat-simple-form" data-log-form>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<input type="hidden" name="title" value="">' +
                '<input type="hidden" name="workers_count" value="0">' +
                '<input type="hidden" name="progress_percent" value="">' +
                '<input type="hidden" name="is_client_visible" value="1">' +
                '<input type="hidden" name="equipment" value="">' +
                '<input type="hidden" name="blockers" value="">' +
                '<input type="hidden" name="next_steps" value="">' +
                '<div class="report-chat-header report-chat-header-compact">' +
                    '<label><span>Дата</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                '</div>' +
                '<div class="report-chat-composer report-chat-composer-assistant">' +
                    '<div class="report-chat-role">Быстрый ввод</div>' +
                    '<label class="report-chat-bubble-input assistant report-main-input">' +
                        '<span>Что сделали сегодня</span>' +
                        '<textarea name="raw_input" rows="5" required placeholder="Например: демонтировали стены полностью, поставили розетки половину, купили все розетки."></textarea>' +
                    '</label>' +
                '</div>' +
                '<div class="report-chat-composer">' +
                    '<div class="report-chat-role">Текст отчета</div>' +
                    '<label class="report-chat-bubble-input report-output-input">' +
                        '<span>Так будет сохранено</span>' +
                        '<textarea name="work_done" rows="4" readonly required placeholder="Здесь автоматически появится готовый текст отчета."></textarea>' +
                    '</label>' +
                '</div>' +
                '<div class="assistant-confirm-card report-confirm-card">' +
                    '<b>Предпросмотр применения</b>' +
                    '<label class="report-confirm"><span>Подтверждаю сохранение отчета и применение изменений</span><input type="checkbox" name="confirm_report" required></label>' +
                '</div>' +
                '<div class="form-error" data-log-error></div>' +
                '<div class="report-intake-actions">' +
                    '<button class="primary" type="submit">Сохранить отчет</button>' +
                '</div>' +
            '</form>' +
        '</section>';
    };

    bindReportPreview = function () {
        qsa('[data-log-form]').forEach(function (form) {
            if (form.dataset.reportPreviewBound === '1') return;
            form.dataset.reportPreviewBound = '1';
            var previewRoot = ensureReportPreviewRoot(form);
            var workDone = form.work_done;
            var rawInput = form.raw_input;
            var titleInput = form.title;
            function refreshPreview() {
                var rawText = rawInput ? rawInput.value.trim() : '';
                var projectId = Number(form.project_id && form.project_id.value || 0);
                var draft = buildProjectReportDraft(projectId, {
                    raw_input: rawText,
                    work_done: ''
                });
                if (workDone) {
                    workDone.value = rawText ? draft.text : '';
                    workDone.dataset.autogenerated = '1';
                }
                if (titleInput) {
                    titleInput.value = 'Отчет за ' + (form.report_date && form.report_date.value ? form.report_date.value : APP_TODAY);
                    titleInput.dataset.autogenerated = '1';
                }
                if (previewRoot) previewRoot.innerHTML = renderReportPreviewHtml(projectId, rawText ? draft : { text: '', workMatches: [], materialMatches: [] });
            }
            if (rawInput) rawInput.addEventListener('input', refreshPreview);
            if (form.report_date) form.report_date.addEventListener('change', refreshPreview);
            refreshPreview();
        });
    };


    renderProjectReportsPanel = function (project) {
        return '<div class="project-reports-shell">' +
            '<section class="subsection report-calendar-top report-calendar-compact">' +
                '<div class="card-head"><div><h3>Календарь отчетов</h3><span class="muted">Отчеты по дням, контроль пропусков и быстрый вход в нужную дату.</span></div></div>' +
                '<section class="stats-grid" data-logs-stats></section>' +
                '<div data-logs-alerts></div>' +
                '<div data-logs-calendar></div>' +
            '</section>' +
            '<section class="project-reports-grid report-daily-layout">' +
                '<div class="report-daily-compose-column">' +
                    (canCreateProjectReport() ? renderProjectReportForm(project) : '<div data-logs-day-view></div>') +
                '</div>' +
                '<section class="subsection report-archive-panel report-daily-timeline">' +
                    '<div class="card-head report-timeline-head"><div><h3>Предыдущие отчеты</h3><span class="muted">Лента суточных рапортов прорабов по объекту.</span></div></div>' +
                    '<div data-report-archive-list data-logs-list><div class="report-archive-empty"><b>Архив отчетов</b><span>Сохраненные отчеты появятся здесь.</span></div></div>' +
                '</section>' +
                (canCreateProjectReport() ? '<div class="report-day-view-hidden" data-logs-day-view></div>' : '') +
            '</section>' +
        '</div>';
    };

    refreshProjectReportsTab = function (projectId) {
        var panel = qs('[data-panel="reports"]');
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!panel || !project) return;
        var oldDrawer = qs('[data-drawer-id="project-report-create"]');
        if (oldDrawer) oldDrawer.remove();
        panel.innerHTML = renderProjectReportsPanel(project);
        ensureProjectReportDrawer();
        bindLogForm();
        bindProjectReportAssistantActions();
        loadProjectLogs(projectId, function (logs) {
            loadProjectNotifications(projectId, function (notifications) {
                if (!state.logsSelectedDateByProject[projectId]) {
                    state.logsSelectedDateByProject[projectId] = (logs[0] && logs[0].report_date) || project.started_at || APP_TODAY;
                }
                renderLogsStats(logs, notifications);
                renderLogsAlerts(notifications);
                renderLogsCalendar(project, logs);
                renderLogsList(project, logs);
            });
        });
    };


    renderReportPreviewHtml = function (projectId, draft) {
        draft = draft || { text: '', workMatches: [], materialMatches: [] };
        var workMatches = Array.isArray(draft.workMatches) ? draft.workMatches : [];
        var materialMatches = Array.isArray(draft.materialMatches) ? draft.materialMatches : [];
        if (!draft.text && !workMatches.length && !materialMatches.length) {
            return '<div class="report-preview-empty">Напиши в поле выше, что сделали или купили. Тут появится готовый текст отчета, работы по разделам и материалы, которые будут обновлены.</div>';
        }
        function groupedBySection(entries, fallback) {
            var groups = {};
            var order = [];
            entries.forEach(function (entry) {
                var item = entry.item || {};
                var title = String(entry.sectionTitle || item.sectionTitle || item.stageTitle || fallback || 'Без раздела').trim() || fallback || 'Без раздела';
                if (!groups[title]) {
                    groups[title] = [];
                    order.push(title);
                }
                groups[title].push(entry);
            });
            return order.map(function (title) {
                return { title: title, entries: groups[title] };
            });
        }
        var html = ['<div class="report-preview-board">'];
        html.push('<section class="report-preview-card report-preview-card-main"><div class="report-preview-title"><strong>Текст отчета</strong><span>Будет сохранено автоматически</span></div><p>' + escapeHtml(draft.text || 'Текст появится после ввода.') + '</p></section>');
        html.push('<section class="report-preview-card"><div class="report-preview-title"><strong>Работы</strong><span>Что отметится в графике и работах</span></div>');
        if (workMatches.length) {
            html.push('<div class="report-preview-sections">' + groupedBySection(workMatches, 'Работы').map(function (group) {
                return '<div class="report-preview-section"><b><small>Раздел</small>' + escapeHtml(group.title) + '</b><div class="report-preview-items">' + group.entries.map(function (entry) {
                    var item = entry.item || {};
                    return '<span class="' + (entry.partial ? 'is-partial' : 'is-done') + '">' + escapeHtml((entry.partial ? 'Частично: ' : 'Закрыть: ') + (item.title || 'Работа')) + '</span>';
                }).join('') + '</div></div>';
            }).join('') + '</div>');
        } else {
            html.push('<div class="report-preview-muted">Пока не нашел работы из графика. Можно написать точнее название работы или раздел.</div>');
        }
        html.push('</section><section class="report-preview-card"><div class="report-preview-title"><strong>Материалы</strong><span>Что изменится в материалах</span></div>');
        if (materialMatches.length) {
            html.push('<div class="report-preview-sections">' + groupedBySection(materialMatches, 'Материалы').map(function (group) {
                return '<div class="report-preview-section"><b><small>Раздел</small>' + escapeHtml(group.title) + '</b><div class="report-preview-items">' + group.entries.map(function (entry) {
                    var item = entry.item || {};
                    var bits = [];
                    if (entry.purchasedQty > 0) bits.push('куплено ' + finalSectionSummaryNumber(entry.purchasedQty));
                    if (entry.usedQty > 0) bits.push('в работу ' + finalSectionSummaryNumber(entry.usedQty));
                    return '<span class="is-material">' + escapeHtml((item.title || 'Материал') + (bits.length ? ' - ' + bits.join(', ') + ' ' + quantityPlanInfo(item).unit : '')) + '</span>';
                }).join('') + '</div></div>';
            }).join('') + '</div>');
        } else {
            html.push('<div class="report-preview-muted">Материалы пока не найдены. Если надо обновить закупку, напиши например: “купили все розетки”.</div>');
        }
        html.push('</section></div>');
        return html.join('');
    };

    renderProjectReportForm = function (project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card report-chat-intake report-daily-form-card">' +
            '<div class="report-drawer-caption">Суточный рапорт</div>' +
            '<div class="card-head report-form-head"><div><h3>Отчет за сегодня</h3><span class="muted">Коротко зафиксируйте факт работ, закупки и важные замечания по объекту.</span></div></div>' +
            '<form class="project-form report-intake-form report-chat-form report-chat-simple-form report-daily-form" data-log-form>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<input type="hidden" name="title" value="">' +
                '<input type="hidden" name="workers_count" value="0">' +
                '<input type="hidden" name="progress_percent" value="">' +
                '<input type="hidden" name="is_client_visible" value="1">' +
                '<input type="hidden" name="equipment" value="">' +
                '<input type="hidden" name="blockers" value="">' +
                '<input type="hidden" name="next_steps" value="">' +
                '<div class="report-chat-header report-chat-header-compact">' +
                    '<label><span>Дата</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                '</div>' +
                '<label class="report-chat-inputbox report-daily-textarea-field">' +
                    '<span>Что сделали сегодня</span>' +
                    '<textarea name="raw_input" rows="5" required placeholder="Например: демонтировали стены полностью, поставили розетки наполовину, купили все розетки."></textarea>' +
                '</label>' +
                '<label class="report-generated-box report-daily-generated-field">' +
                    '<span>Текст отчета</span>' +
                    '<textarea name="work_done" rows="4" readonly required tabindex="-1" placeholder="Пример: За день выполнен демонтаж стен, частично смонтированы розетки, закуплены розетки по смете."></textarea>' +
                '</label>' +
                '<div class="assistant-confirm-card report-confirm-card">' +
                    '<b>Что применится после сохранения</b>' +
                    '<div data-report-preview></div>' +
                    '<label class="report-confirm"><span>Подтверждаю сохранение отчета и применение изменений</span><input type="checkbox" name="confirm_report" required></label>' +
                '</div>' +
                '<div class="form-error" data-log-error></div>' +
                '<div class="report-intake-actions">' +
                    '<button class="primary report-submit-button" type="submit">Отправить отчет</button>' +
                '</div>' +
            '</form>' +
        '</section>';
    };

    var reportVoiceState = {
        recognition: null,
        input: null,
        button: null,
        active: false
    };
    var reportVoiceUnsupportedWarned = false;
    var reportVoiceToastTimer = null;

    function reportSpeechRecognitionConstructor() {
        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function reportVoiceMessage(value) {
        var messages = {
            micTitle: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434',
            micActive: '\u0418\u0434\u0435\u0442 \u0437\u0430\u043f\u0438\u0441\u044c',
            micBlocked: '\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043c\u0438\u043a\u0440\u043e\u0444\u043e\u043d\u0443 \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430',
            micError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434'
        };
        return messages[value] || '';
    }

    function reportVoiceIconHtml() {
        return '<span class="report-voice-idle" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path></svg></span><span class="report-voice-recording" aria-hidden="true"></span>';
    }

    function showReportVoiceToast(message) {
        var toast = qs('[data-report-voice-toast]');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'report-voice-toast';
            toast.setAttribute('data-report-voice-toast', '');
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('active');
        clearTimeout(reportVoiceToastTimer);
        reportVoiceToastTimer = setTimeout(function () {
            toast.classList.remove('active');
        }, 4200);
    }

    function setReportVoiceButtonState(button, stateName) {
        if (!button) return;
        button.classList.toggle('is-recording', stateName === 'active');
        button.classList.toggle('is-error', stateName === 'error');
        button.setAttribute('aria-pressed', stateName === 'active' ? 'true' : 'false');
        button.setAttribute('title', stateName === 'active' ? reportVoiceMessage('micActive') : reportVoiceMessage('micTitle'));
        button.setAttribute('aria-label', stateName === 'active' ? reportVoiceMessage('micActive') : reportVoiceMessage('micTitle'));
        if (stateName === 'error') {
            setTimeout(function () {
                button.classList.remove('is-error');
            }, 1400);
        }
    }

    function stopReportVoiceRecognition(keepButtonState) {
        var recognition = reportVoiceState.recognition;
        var button = reportVoiceState.button;
        reportVoiceState.active = false;
        reportVoiceState.recognition = null;
        reportVoiceState.input = null;
        reportVoiceState.button = null;
        if (!keepButtonState) setReportVoiceButtonState(button, 'idle');
        if (recognition) {
            try {
                recognition.stop();
            } catch (error) {}
        }
    }

    function appendReportVoiceText(input, text) {
        var addition = String(text || '').trim();
        if (!input || !addition) return;
        var current = String(input.value || '');
        var needsSpace = current && !/\s$/.test(current);
        input.value = current + (needsSpace ? ' ' : '') + addition;
        try {
            input.selectionStart = input.value.length;
            input.selectionEnd = input.value.length;
        } catch (error) {}
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function startReportVoiceRecognition(input, button) {
        var Recognition = reportSpeechRecognitionConstructor();
        if (!Recognition) {
            if (!reportVoiceUnsupportedWarned) {
                console.warn('Web Speech API is not supported in this browser.');
                reportVoiceUnsupportedWarned = true;
            }
            return;
        }
        if (reportVoiceState.active) stopReportVoiceRecognition();
        var recognition = new Recognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = false;
        recognition.continuous = true;
        recognition.onresult = function (event) {
            var parts = [];
            for (var index = event.resultIndex; index < event.results.length; index += 1) {
                var result = event.results[index];
                if (result && result.isFinal && result[0] && result[0].transcript) {
                    parts.push(result[0].transcript);
                }
            }
            appendReportVoiceText(input, parts.join(' '));
        };
        recognition.onerror = function (event) {
            var isBlocked = event && (event.error === 'not-allowed' || event.error === 'service-not-allowed');
            if (isBlocked) showReportVoiceToast(reportVoiceMessage('micBlocked'));
            else console.warn('Speech recognition error:', event && event.error ? event.error : event);
            setReportVoiceButtonState(button, 'error');
            stopReportVoiceRecognition(true);
        };
        recognition.onend = function () {
            if (reportVoiceState.recognition === recognition) stopReportVoiceRecognition();
        };
        reportVoiceState = {
            recognition: recognition,
            input: input,
            button: button,
            active: true
        };
        setReportVoiceButtonState(button, 'active');
        input.focus();
        try {
            recognition.start();
        } catch (error) {
            console.warn('Speech recognition start failed:', error);
            showReportVoiceToast(reportVoiceMessage('micError'));
            setReportVoiceButtonState(button, 'error');
            stopReportVoiceRecognition(true);
        }
    }

    function reportVoiceInputTargets(form) {
        return qsa('textarea, input', form).filter(function (input) {
            var type = String(input.getAttribute('type') || (input.tagName === 'TEXTAREA' ? 'textarea' : 'text')).toLowerCase();
            var textTypes = ['textarea', 'text', 'search', 'tel', 'url', 'email'];
            return textTypes.indexOf(type) !== -1 && !input.disabled && !input.readOnly;
        });
    }

    function bindReportVoiceInputs() {
        var Recognition = reportSpeechRecognitionConstructor();
        if (!Recognition) {
            if (!reportVoiceUnsupportedWarned) {
                console.warn('Web Speech API is not supported in this browser.');
                reportVoiceUnsupportedWarned = true;
            }
            return;
        }
        qsa('[data-log-form]').forEach(function (form) {
            if (form.dataset.reportVoiceFormBound !== '1') {
                form.dataset.reportVoiceFormBound = '1';
                form.addEventListener('submit', function () {
                    stopReportVoiceRecognition();
                });
            }
            reportVoiceInputTargets(form).forEach(function (input) {
                if (input.dataset.reportVoiceBound === '1') return;
                input.dataset.reportVoiceBound = '1';
                var wrapper = document.createElement('div');
                wrapper.className = 'report-voice-field';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
                var button = document.createElement('button');
                button.type = 'button';
                button.className = 'report-voice-button';
                button.innerHTML = reportVoiceIconHtml();
                button.setAttribute('aria-pressed', 'false');
                button.setAttribute('title', reportVoiceMessage('micTitle'));
                button.setAttribute('aria-label', reportVoiceMessage('micTitle'));
                wrapper.appendChild(button);
                button.addEventListener('mousedown', function (event) {
                    event.preventDefault();
                });
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    if (reportVoiceState.active && reportVoiceState.input === input) {
                        stopReportVoiceRecognition();
                        input.focus();
                        return;
                    }
                    startReportVoiceRecognition(input, button);
                });
                input.addEventListener('blur', function () {
                    setTimeout(function () {
                        if (reportVoiceState.input === input && document.activeElement !== button) {
                            stopReportVoiceRecognition();
                        }
                    }, 80);
                });
            });
        });
    }







    function reportAuthorInitials(name) {
        var text = String(name || '').trim();
        if (!text) return '??';
        return text.split(/\s+/).slice(0, 2).map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('');
    }

    function reportCreatedDateTime(log) {
        var raw = log && (log.created_at || log.createdAt);
        if (!raw) return finalGraphDate(log && log.report_date);
        var parsed = new Date(String(raw).replace(' ', 'T'));
        if (Number.isNaN(parsed.getTime())) return String(raw);
        return parsed.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
            parsed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    function reportLogStatus(log) {
        var text = [
            log && log.title,
            log && log.work_done,
            log && log.raw_input,
            log && log.blockers
        ].join(' ');
        if (log && log.blockers) return { kind: 'danger', label: 'Есть блокер' };
        if (/(чп|авари|простой|останов|срыв|критич|опасн|проблем)/i.test(text)) return { kind: 'danger', label: 'Проблема' };
        return { kind: 'success', label: 'В порядке' };
    }




    function renderLogsList(project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        logs = Array.isArray(logs) ? logs : [];
        if (!logs.length) {
            root.innerHTML = '<div class="report-archive-empty"><b>Отчетов пока нет</b><span>По объекту "' + escapeHtml(project && project.title ? project.title : 'Объект') + '" еще нет сохраненных суточных рапортов.</span></div>';
            return;
        }
        root.innerHTML = '<div class="report-archive-list">' + logs.map(function (log) {
            var title = log.title || ('\u041e\u0442\u0447\u0435\u0442 \u0437\u0430 ' + (log.report_date || '\u0434\u0430\u0442\u0443'));
            var visibility = Number(log.is_client_visible) === 1 ? '\u0412\u0438\u0434\u043d\u043e \u0437\u0430\u043a\u0430\u0437\u0447\u0438\u043a\u0443' : '\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439';
            var authorName = log.author_name || 'Без автора';
            var status = reportLogStatus(log);
            return '<article class="report-archive-card report-timeline-card log-card is-' + escapeHtml(status.kind) + '">' +
                '<div class="report-archive-head report-timeline-card-head log-top">' +
                    '<div class="report-author-block">' +
                        '<span class="report-author-avatar">' + escapeHtml(reportAuthorInitials(authorName)) + '</span>' +
                        '<div><strong>' + escapeHtml(authorName) + '</strong><small>' + escapeHtml(title) + '</small></div>' +
                    '</div>' +
                    '<div class="report-archive-side report-timeline-meta project-badges">' +
                        '<time>' + escapeHtml(reportCreatedDateTime(log)) + '</time>' +
                        '<span class="badge ' + (status.kind === 'danger' ? 'danger' : 'success') + '">' + escapeHtml(status.label) + '</span>' +
                        '<span class="badge">' + escapeHtml(finalGraphDate(log.report_date)) + '</span>' +
                        (log.progress_percent != null && log.progress_percent !== '' ? '<span class="badge success">' + escapeHtml(Math.round(Number(log.progress_percent) || 0)) + '%</span>' : '') +
                        '<span class="badge">' + escapeHtml(log.workers_count || 0) + ' \u0447\u0435\u043b.</span>' +
                        '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + visibility + '</span>' +
                        renderProjectReportDeleteButton(project && project.id, log, true) +
                    '</div>' +
                '</div>' +
                '<p>' + escapeHtml(log.work_done || '\u0422\u0435\u043a\u0441\u0442 \u043e\u0442\u0447\u0435\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d') + '</p>' +
                '<div class="log-details">' +
                    (log.equipment ? '<div><span>\u0422\u0435\u0445\u043d\u0438\u043a\u0430</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                    (log.blockers ? '<div class="log-risk"><span>\u0411\u043b\u043e\u043a\u0435\u0440</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                    (log.next_steps ? '<div><span>\u0414\u0430\u043b\u044c\u0448\u0435</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                '</div>' +
                (log.raw_input ? '<small class="muted">\u0418\u0441\u0445\u043e\u0434\u043d\u044b\u0439 \u0432\u0432\u043e\u0434: ' + escapeHtml(log.raw_input) + '</small>' : '') +
            '</article>';
        }).join('') + '</div>';
        bindProjectReportDeleteActions();
    }

    function bindLogForm() {
        bindReportPreview();
        bindReportVoiceInputs();
        qsa('[data-log-form]').forEach(function (form) {
            if (!form || form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var error = qs('[data-log-error]', form) || qs('[data-log-error]');
                if (error) error.classList.remove('active');
                var projectId = Number(form.project_id && form.project_id.value || 0);
                var selectedDate = form.report_date && form.report_date.value ? form.report_date.value : APP_TODAY;
                withSubmitLock(form, function () {
                    return api('/api/projects/' + projectId + '/daily-logs', {
                        method: 'POST',
                        body: JSON.stringify({
                            report_date: selectedDate,
                            title: form.title ? form.title.value.trim() : '',
                            work_done: form.work_done ? form.work_done.value.trim() : '',
                            workers_count: Number(form.workers_count && form.workers_count.value || 0),
                            equipment: form.equipment ? form.equipment.value.trim() : '',
                            blockers: form.blockers ? form.blockers.value.trim() : '',
                            next_steps: form.next_steps ? form.next_steps.value.trim() : '',
                            progress_percent: form.progress_percent ? form.progress_percent.value : '',
                            raw_input: form.raw_input ? form.raw_input.value.trim() : '',
                            is_client_visible: form.is_client_visible ? form.is_client_visible.value === '1' : true
                        })
                    }).then(function (data) {
                        var keepProject = form.project_id && form.project_id.value ? form.project_id.value : String(projectId);
                        form.reset();
                        if (form.project_id) form.project_id.value = keepProject;
                        if (form.report_date) form.report_date.value = APP_TODAY;
                        state.logsSelectedDateByProject[projectId] = selectedDate;
                        state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(selectedDate);
                        var pageSelect = qs('[data-logs-project]');
                        if (pageSelect) pageSelect.value = keepProject;
                        if (data && data.project) {
                            updateProjectInState(data.project);
                            renderProjectStats();
                            renderProjectCritical();
                            renderProjectList(state.projects);
                        }
                        closeSideDrawer(qs('[data-drawer-id="log-create"]'));
                        closeSideDrawer(qs('[data-drawer-id="project-report-create"]'));
                        var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || state.selectedProject || state.projects[0] || { id: projectId, title: '\u041e\u0431\u044a\u0435\u043a\u0442' };
                        loadProjectLogs(projectId, function (logs) {
                            loadProjectNotifications(projectId, function (notifications) {
                                renderLogsStats(logs, notifications);
                                renderLogsAlerts(notifications);
                                renderLogsCalendar(project, logs);
                                renderLogsList(project, logs);
                            });
                        });
                    }).catch(function (err) {
                        var message = appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043e\u0442\u0447\u0435\u0442');
                        if (error) {
                            error.textContent = message;
                            error.classList.add('active');
                        }
                    });
                });
            });
        });
    }

    function renderFinanceInvoiceForm() {
        return '<section class="subsection finance-invoice-card"><div class="card-head"><div><h3>\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0447\u0435\u0442 \u0432 \u0444\u0438\u043d\u043f\u043b\u0430\u043d</h3><span class="muted">PDF, PNG, JPG \u043e\u0442\u043a\u0440\u043e\u044e\u0442\u0441\u044f \u0432 \u043f\u0440\u0435\u0432\u044c\u044e, Excel \u0431\u0443\u0434\u0435\u0442 \u0440\u0430\u0437\u043e\u0431\u0440\u0430\u043d \u043f\u043e \u0448\u0430\u0431\u043b\u043e\u043d\u0443.</span></div></div>' +
            '<form class="finance-invoice-form" data-finance-invoice-form>' +
                '<label class="finance-suggest-field"><span>\u041d\u0430 \u0447\u0442\u043e \u0443\u0445\u043e\u0434\u044f\u0442 \u0434\u0435\u043d\u044c\u0433\u0438</span><input name="category" autocomplete="off" placeholder="\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u0440\u043e\u0437\u0435\u0442\u043a\u0438, \u043a\u0430\u0431\u0435\u043b\u044c, \u0434\u0435\u043c\u043e\u043d\u0442\u0430\u0436..." required><div class="finance-suggestion-list" data-finance-suggestions hidden></div></label>' +
                '<label><span>\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442</span><input name="counterparty_name" placeholder="\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a / \u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a"></label>' +
                '<label><span>\u0421\u0443\u043c\u043c\u0430</span><input name="amount" type="number" min="0" step="0.01" required></label>' +
                '<label><span>\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c \u0434\u043e</span><input name="planned_date" type="date"></label>' +
                '<label><span>\u041e\u043f\u043b\u0430\u0442\u0430</span><select name="payment_kind"><option value="bank_no_vat">\u0411\u0435\u0437\u043d\u0430\u043b \u0431\u0435\u0437 \u041d\u0414\u0421</option><option value="bank_vat">\u0411\u0435\u0437\u043d\u0430\u043b \u0441 \u041d\u0414\u0421</option><option value="cash">\u041d\u0430\u043b\u0438\u0447\u043d\u044b\u0435</option></select></label>' +
                '<label><span>\u0421\u0442\u0430\u0442\u0443\u0441</span><select name="status"><option value="approved" selected>\u041f\u043e\u0434\u0430\u043d \u043d\u0430 \u043e\u043f\u043b\u0430\u0442\u0443</option><option value="planned">\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e</option></select></label>' +
                '<label class="wide finance-file-field"><span>\u041f\u0440\u0438\u043a\u0440\u0435\u043f\u0438\u0442\u0435 \u0444\u0430\u0439\u043b</span><input class="custom-file-input" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>' +
                '<label class="wide"><span>\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439</span><input name="notes" placeholder="\u041d\u043e\u043c\u0435\u0440 \u0441\u0447\u0435\u0442\u0430, \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u0435 \u0438\u043b\u0438 \u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0430"></label>' +
                '<div class="form-error" data-finance-invoice-error></div>' +
                '<button class="primary" type="submit">\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0447\u0435\u0442</button>' +
            '</form></section>';
    }

    function renderFinanceEntryActions(canAddIncome) {
        return '<section class="finance-entry-actions">' +
            '<button class="primary finance-action-button" type="button" data-finance-open-modal="invoice"><i data-lucide="file-plus"></i><span>\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0447\u0435\u0442</span></button>' +
            (canAddIncome ? '<button class="ghost finance-action-button" type="button" data-finance-open-modal="income" data-director-finance><i data-lucide="wallet"></i><span>\u041f\u043e\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u0435</span></button>' : '') +
        '</section>';
    }

    function renderFinanceEntryModal(canAddIncome) {
        return '<div class="finance-form-modal" data-finance-form-modal hidden>' +
            '<div class="finance-form-backdrop" data-finance-modal-close></div>' +
            '<div class="finance-form-dialog" role="dialog" aria-modal="true">' +
                '<button class="finance-form-close" type="button" data-finance-modal-close aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c"><i data-lucide="x"></i></button>' +
                '<div class="finance-form-pane" data-finance-modal-pane="invoice">' + renderFinanceInvoiceForm() + '</div>' +
                (canAddIncome ? '<div class="finance-form-pane" data-finance-modal-pane="income" hidden>' + renderFinanceIncomeForm() + '</div>' : '') +
            '</div>' +
        '</div>';
    }

    function cleanupFinanceEntryModals() {
        qsa('body > [data-finance-form-modal]').forEach(function (modal) {
            modal.remove();
        });
        document.body.classList.remove('finance-modal-lock');
    }

    function closeFinanceEntryModal(modal) {
        modal = modal || qs('[data-finance-form-modal]');
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.classList.remove('finance-modal-lock');
        setTimeout(function () {
            if (!modal.classList.contains('is-open')) modal.hidden = true;
        }, 180);
    }

    function openFinanceEntryModal(type) {
        var modal = qs('[data-finance-form-modal]');
        if (!modal) return;
        type = type === 'income' ? 'income' : 'invoice';
        qsa('[data-finance-modal-pane]', modal).forEach(function (pane) {
            pane.hidden = pane.dataset.financeModalPane !== type;
        });
        modal.hidden = false;
        document.body.classList.add('finance-modal-lock');
        requestAnimationFrame(function () {
            modal.classList.add('is-open');
            var firstInput = qs('input, select, textarea, button[type="submit"]', modal);
            if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
        });
    }

    function bindFinanceEntryModal(root) {
        root = root || document;
        var modal = qs('[data-finance-form-modal]', root);
        if (modal && modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }
        qsa('[data-finance-open-modal]', root).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                openFinanceEntryModal(button.dataset.financeOpenModal);
            });
        });
        qsa('[data-finance-modal-close]', modal || root).forEach(function (node) {
            if (node.dataset.bound === '1') return;
            node.dataset.bound = '1';
            node.addEventListener('click', function () {
                closeFinanceEntryModal(node.closest('[data-finance-form-modal]'));
            });
        });
        if (!document.body.dataset.financeModalEscapeBound) {
            document.body.dataset.financeModalEscapeBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeFinanceEntryModal();
            });
        }
    }

    function renderFinanceRow(item) {
        var direction = item.direction === 'income' ? 'income' : 'expense';
        var status = item.status || 'planned';
        var title = item.category || financeDirectionLabel(direction);
        var counterparty = item.counterparty_name || '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d';
        return '<form class="finance-row finance-history-row finance-table-row is-' + escapeHtml(direction) + ' is-status-' + escapeHtml(status) + '" data-finance-edit-form data-finance-id="' + escapeHtml(item.id) + '">' +
            '<div class="finance-table-cell finance-cell-main">' +
                '<span class="finance-row-chip">' + escapeHtml(financeDirectionLabel(direction)) + '</span>' +
                '<b>' + escapeHtml(title) + '</b>' +
                '<small>' + escapeHtml(financePaymentLabel(item.payment_kind) + ' - ' + counterparty) + '</small>' +
                (item.notes ? '<em>' + escapeHtml(item.notes) + '</em>' : '') +
            '</div>' +
            '<div class="finance-table-cell finance-cell-status">' + renderFinanceStatusTracker(status) + '</div>' +
            '<div class="finance-table-cell finance-cell-doc">' + renderFinanceDocumentSlot(item) + '</div>' +
            '<div class="finance-table-cell finance-row-amount"><strong>' + escapeHtml(money(item.amount || 0)) + '</strong><small>\u041d\u0414\u0421 ' + escapeHtml(Number(item.vat_percent || 0)) + '%</small></div>' +
            '<div class="finance-table-cell finance-row-controls">' +
                '<label><span>\u041f\u043b\u0430\u043d</span><input name="planned_date" type="date" value="' + escapeHtml(item.planned_date || '') + '"></label>' +
                '<label><span>\u0424\u0430\u043a\u0442</span><input name="paid_date" type="date" value="' + escapeHtml(item.paid_date || '') + '"></label>' +
                '<label><span>\u0421\u0442\u0430\u0442\u0443\u0441</span><select name="status">' +
                    '<option value="planned"' + (status === 'planned' ? ' selected' : '') + '>\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e</option>' +
                    '<option value="approved"' + (status === 'approved' ? ' selected' : '') + '>\u041f\u043e\u0434\u0430\u043d \u043d\u0430 \u043e\u043f\u043b\u0430\u0442\u0443</option>' +
                    '<option value="paid"' + (status === 'paid' ? ' selected' : '') + '>\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e</option>' +
                    '<option value="cancelled"' + (status === 'cancelled' ? ' selected' : '') + '>\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043e</option>' +
                '</select></label>' +
                '<input name="notes" type="hidden" value="' + escapeHtml(item.notes || '') + '">' +
            '</div>' +
            '<div class="finance-table-cell finance-row-actions">' +
                '<button class="ghost compact finance-icon-button" type="submit" title="\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"><i data-lucide="save"></i><span>\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</span></button>' +
                (direction === 'expense' && status !== 'paid' && status !== 'cancelled' ? '<button class="primary compact finance-pay-button" type="button" data-finance-confirm-payment data-director-finance><i data-lucide="credit-card"></i><span>\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c</span></button>' : '') +
            '</div></form>';
    }

    function renderProjectFinances(projectId, items, summary) {
        var root = qs('[data-panel="finance"]');
        if (!root) return;
        items = Array.isArray(items) ? items : [];
        summary = summary || {};
        cleanupFinanceEntryModals();
        if (isForemanRole()) {
            safeReplaceChildren(root, renderFinanceEntryActions(false) + renderFinanceEntryModal(false));
            bindFinanceEntryModal(root);
            bindFinanceInvoiceForm(projectId);
            applyRoleVisibility(root);
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
            return;
        }
        safeReplaceChildren(root,
            '<div data-director-finance>' + renderFinanceHero(projectId, summary) + '</div>' +
            '<div data-director-finance>' + renderFinancePlanFromInvoices(items, summary) + '</div>' +
            renderFinanceEntryActions(true) +
            renderFinanceEntryModal(true) +
            '<section class="subsection finance-history-card ui-card" data-director-finance><div class="card-head finance-toolbar"><div><h3>\u0412\u0441\u0435 \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0435 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438</h3><span class="muted">\u0421\u0447\u0435\u0442\u0430, \u043e\u043f\u043b\u0430\u0442\u044b \u0438 \u043f\u043b\u0430\u043d\u043e\u0432\u044b\u0435 \u0434\u0430\u0442\u044b</span></div><div class="card-head-actions finance-toolbar-actions"><input class="search finance-search" type="search" placeholder="\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0441\u0447\u0435\u0442\u0430\u043c" data-finance-search></div></div><div class="finance-table"><div class="finance-table-head"><span>\u041e\u043f\u0435\u0440\u0430\u0446\u0438\u044f</span><span>\u0421\u0442\u0430\u0442\u0443\u0441</span><span>\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442</span><span>\u0421\u0443\u043c\u0430</span><span>\u0414\u0430\u0442\u044b</span><span>\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f</span></div><div class="finance-list">' +
                (items.length ? items.map(renderFinanceRow).join('') : '<p class="muted">\u041f\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0445 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0439.</p>') +
            '</div></div></section>');
        bindFinanceEntryModal(root);
        bindFinanceIncomeForm(projectId);
        bindFinanceInvoiceForm(projectId);
        bindFinanceEditors(projectId);
        bindFinanceDocumentActions();
        applyRoleVisibility(root);
        var financeSearch = qs('[data-finance-search]', root);
        if (financeSearch) {
            financeSearch.addEventListener('input', function () {
                var query = financeSearch.value.toLocaleLowerCase('ru').trim();
                qsa('.finance-history-card [data-finance-edit-form]', root).forEach(function (form) {
                    form.hidden = query && form.textContent.toLocaleLowerCase('ru').indexOf(query) === -1;
                });
            });
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    function bindFinanceInvoiceForm(projectId) {
        var form = qs('[data-finance-invoice-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        bindFinanceSuggestions(projectId, form);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-finance-invoice-error]', form) || qs('[data-finance-invoice-error]');
            if (error) error.classList.remove('active');
            withSubmitLock(form, function () {
                var file = form.file && form.file.files && form.file.files[0];
                var request;
                if (file) {
                    var formData = new FormData();
                    formData.append('file', file);
                    formData.append('category', form.category.value.trim());
                    formData.append('counterparty_name', form.counterparty_name.value.trim());
                    formData.append('amount', form.amount.value || '0');
                    formData.append('planned_date', form.planned_date.value);
                    formData.append('payment_kind', form.payment_kind.value);
                    formData.append('status', form.status.value || 'approved');
                    formData.append('notes', form.notes.value.trim());
                    request = apiFormData('/api/projects/' + projectId + '/finances/invoice-upload', formData);
                } else {
                    request = api('/api/projects/' + projectId + '/finances', {
                        method: 'POST',
                        body: JSON.stringify({
                            direction: 'expense',
                            category: form.category.value.trim(),
                            payment_kind: form.payment_kind.value,
                            amount: Number(form.amount.value || 0),
                            vat_percent: form.payment_kind.value === 'bank_vat' ? 20 : 0,
                            planned_date: form.planned_date.value,
                            paid_date: '',
                            counterparty_name: form.counterparty_name.value.trim(),
                            status: form.status.value || 'approved',
                            notes: form.notes.value.trim()
                        })
                    });
                }
                return request.then(function (data) {
                    closeFinanceEntryModal(form.closest('[data-finance-form-modal]'));
                    if (data && data.parsedInvoice) {
                        form.category.value = data.parsedInvoice.category || form.category.value;
                        form.counterparty_name.value = data.parsedInvoice.counterparty_name || form.counterparty_name.value;
                        form.amount.value = data.parsedInvoice.amount || form.amount.value;
                        showFinanceToast('\u0421\u0447\u0435\u0442 Excel \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d \u0438 \u043f\u043e\u0434\u0430\u043d \u043d\u0430 \u043e\u043f\u043b\u0430\u0442\u0443');
                    }
                    loadProjectFinances(projectId);
                }).catch(function (err) {
                    var message = appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0447\u0435\u0442');
                    if (message === '\u041e\u0448\u0438\u0431\u043a\u0430: \u0424\u043e\u0440\u043c\u0430\u0442 \u0444\u0430\u0439\u043b\u0430 \u043d\u0435 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0448\u0430\u0431\u043b\u043e\u043d\u0443 \u043e\u0442\u0447\u0435\u0442\u0430') showFinanceToast(message);
                    if (error) {
                        error.textContent = message;
                        error.classList.add('active');
                    }
                });
            });
        });
    }

    function bindFinanceEditors(projectId) {
        qsa('[data-finance-edit-form]').forEach(function (form) {
            if (!form || form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            function payload(status) {
                return {
                    planned_date: form.planned_date ? form.planned_date.value : '',
                    paid_date: status === 'paid' ? (form.paid_date && form.paid_date.value ? form.paid_date.value : APP_TODAY) : (form.paid_date ? form.paid_date.value : ''),
                    status: status,
                    notes: form.notes ? form.notes.value.trim() : ''
                };
            }
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var status = form.status ? form.status.value : 'planned';
                withSubmitLock(form, function () {
                    return api('/api/finances/' + form.dataset.financeId + '/update', {
                        method: 'POST',
                        body: JSON.stringify(payload(status))
                    }).then(function () {
                        loadProjectFinances(projectId);
                    }).catch(function (err) {
                        showFinanceToast(appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u0447\u0435\u0442'));
                    });
                });
            });
            qsa('[data-finance-confirm-payment]', form).forEach(function (button) {
                if (button.dataset.bound === '1') return;
                button.dataset.bound = '1';
                button.addEventListener('click', function () {
                    withSubmitLock(button, function () {
                        return api('/api/finance/pay-invoice', {
                            method: 'POST',
                            body: JSON.stringify({
                                finance_id: Number(form.dataset.financeId),
                                paid_date: APP_TODAY
                            })
                        }).then(function () {
                            loadProjectFinances(projectId);
                        }).catch(function (err) {
                            showFinanceToast(appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u043e\u043f\u043b\u0430\u0442\u0443'));
                        });
                    });
                });
            });
        });
    }

    function financePlanBucket(item) {
        var dateText = String(item.planned_date || item.paid_date || '').trim();
        var today = new Date(APP_TODAY + 'T00:00:00');
        var due = dateText ? new Date(dateText + 'T00:00:00') : null;
        if (!due || isNaN(due.getTime())) return { key: 'no-date', title: 'Без даты оплаты', kind: 'warn' };
        var days = Math.round((due.getTime() - today.getTime()) / 86400000);
        if (days < 0) return { key: 'overdue', title: 'Просрочено', kind: 'danger' };
        if (days === 0) return { key: 'today', title: 'Оплатить сегодня', kind: 'danger' };
        if (days <= 7) return { key: 'week', title: 'На этой неделе', kind: 'warn' };
        return { key: 'later', title: 'Позже', kind: '' };
    }

    function renderFinancePlanFromInvoices(items, summary) {
        var invoices = (Array.isArray(items) ? items : []).filter(function (item) {
            return item && item.direction === 'expense' && item.status !== 'paid' && item.status !== 'cancelled';
        });
        var total = invoices.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
        var overdue = invoices.filter(function (item) { return financePlanBucket(item).key === 'overdue'; });
        var week = invoices.filter(function (item) {
            var key = financePlanBucket(item).key;
            return key === 'today' || key === 'week';
        });
        var order = ['overdue', 'today', 'week', 'later', 'no-date'];
        var groups = {};
        invoices.forEach(function (item) {
            var bucket = financePlanBucket(item);
            if (!groups[bucket.key]) groups[bucket.key] = { bucket: bucket, items: [] };
            groups[bucket.key].items.push(item);
        });
        var planRows = order.filter(function (key) { return groups[key] && groups[key].items.length; }).map(function (key) {
            var group = groups[key];
            var groupTotal = group.items.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
            return '<section class="finance-plan-group">' +
                '<div class="finance-plan-group-head"><div><b>' + escapeHtml(group.bucket.title) + '</b><span>' + escapeHtml(String(group.items.length) + ' счетов') + '</span></div><strong>' + escapeHtml(money(groupTotal)) + '</strong></div>' +
                '<div class="finance-plan-items">' + group.items.map(function (item) {
                    var title = item.category || item.notes || 'Счет к оплате';
                    var dateText = item.planned_date || 'дата не указана';
                    return '<form class="finance-plan-item ' + (group.bucket.kind ? 'is-' + group.bucket.kind : '') + '" data-finance-edit-form data-finance-id="' + escapeHtml(item.id) + '">' +
                        '<div><b>' + escapeHtml(title) + '</b><small>' + escapeHtml((item.counterparty_name || 'Контрагент не указан') + ' • ' + financePaymentLabel(item.payment_kind)) + '</small></div>' +
                        '<div><span>Оплатить</span><input name="planned_date" type="date" value="' + escapeHtml(item.planned_date || '') + '"></div>' +
                        '<input name="paid_date" type="hidden" value="' + escapeHtml(item.paid_date || '') + '">' +
                        '<div><strong>' + escapeHtml(money(item.amount || 0)) + '</strong><small>' + escapeHtml(dateText) + '</small></div>' +
                        '<select name="status">' +
                            '<option value="planned"' + (item.status === 'planned' ? ' selected' : '') + '>Запланировано</option>' +
                            '<option value="approved"' + (item.status === 'approved' ? ' selected' : '') + '>Согласовано</option>' +
                            '<option value="paid"' + (item.status === 'paid' ? ' selected' : '') + '>Оплачено</option>' +
                            '<option value="cancelled"' + (item.status === 'cancelled' ? ' selected' : '') + '>Отменено</option>' +
                        '</select>' +
                        '<input name="notes" type="hidden" value="' + escapeHtml(item.notes || '') + '">' +
                        '<button class="ghost compact" type="submit">Сохранить</button>' +
                    '</form>';
                }).join('') + '</div>' +
            '</section>';
        }).join('');
        return '<section class="subsection finance-plan-board">' +
            '<div class="card-head"><div><h3>Финплан от счетов</h3><span class="muted">Все неоплаченные счета раскладываются по срокам оплаты.</span></div></div>' +
            '<section class="stats-grid finance-plan-stats">' +
                stat('К оплате', money(total), total ? 'warn' : '') +
                stat('Просрочено', money(overdue.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0)), overdue.length ? 'danger' : '') +
                stat('7 дней', money(week.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0)), week.length ? 'warn' : '') +
                stat('Оплачено', money(summary.paidExpense || 0)) +
            '</section>' +
            (planRows || '<div class="finance-plan-empty">Неоплаченных счетов нет. Добавь счет ниже, и он появится в плане.</div>') +
        '</section>';
    }





    function financeEstimateTotal(projectId, summary) {
        var apiTotal = Number(summary && summary.estimateTotal);
        if (Number.isFinite(apiTotal) && apiTotal > 0) return apiTotal;
        var items = state.materialsByProject && state.materialsByProject[projectId] ? state.materialsByProject[projectId] : [];
        var total = (items || []).reduce(function (sum, item) {
            var qty = Number(item.plannedQty != null ? item.plannedQty : item.planned_qty || 0);
            var price = Number(item.plannedPrice != null ? item.plannedPrice : item.planned_price || 0);
            return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
        }, 0);
        if (total > 0) return total;
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        return Number(project && project.budget || 0);
    }

    function financeSuggestionItems(projectId) {
        var items = state.materialsByProject && state.materialsByProject[projectId] ? state.materialsByProject[projectId] : [];
        return (items || []).map(function (item) {
            var qty = Number(item.plannedQty != null ? item.plannedQty : item.planned_qty || 0);
            var price = Number(item.plannedPrice != null ? item.plannedPrice : item.planned_price || 0);
            var amount = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;
            var kind = String(item.itemKind || 'material').toLowerCase() === 'work' ? 'Работа' : 'Материал';
            return {
                title: item.title || '',
                section: item.sectionTitle || item.stageTitle || '',
                kind: kind,
                amount: amount,
                unit: item.unit || '',
                qty: qty
            };
        }).filter(function (item) { return item.title; });
    }

    function financeRatioMoney(current, total) {
        return money(current || 0).replace(/\s?₽$/, '') + ' / ' + money(total || 0);
    }

    function renderFinanceHero(projectId, summary) {
        var estimateTotal = financeEstimateTotal(projectId, summary);
        var plannedExpense = Number(summary && summary.plannedExpense || 0);
        var paidExpense = Number(summary && summary.paidExpense || 0);
        var paidIncome = Number(summary && summary.paidIncome || 0);
        var balance = Number(summary && summary.balance || 0);
        var leftByEstimate = Math.max(0, estimateTotal - paidExpense);
        var paidPercent = estimateTotal ? Math.min(100, Math.round((paidExpense / estimateTotal) * 100)) : 0;
        var incomePercent = estimateTotal ? Math.min(100, Math.round((paidIncome / estimateTotal) * 100)) : 0;
        return '<section class="finance-hero finance-hero-v2">' +
            '<div class="finance-hero-main"><span>Всего по смете</span><h3>' + escapeHtml(money(estimateTotal || 0)) + '</h3><p>Поступления сразу попадают в баланс, расходы уменьшают остаток после оплаты счетов.</p></div>' +
            '<div class="finance-balance-panel ' + (balance < 0 ? 'is-danger' : 'is-positive') + '">' +
                '<span>Текущий баланс</span>' +
                '<strong>' + escapeHtml(money(balance)) + '</strong>' +
                '<small>Поступления: <b>' + escapeHtml(financeRatioMoney(paidIncome, estimateTotal)) + '</b></small>' +
            '</div>' +
            '<div class="finance-hero-progress"><div><b>' + escapeHtml(String(paidPercent) + '%') + '</b><span>оплачено от сметы</span></div><i><em style="width:' + paidPercent + '%"></em></i></div>' +
            '<div class="finance-hero-grid">' +
                '<article class="is-income"><span>Поступило</span><strong class="finance-ratio-value">' + escapeHtml(financeRatioMoney(paidIncome, estimateTotal)) + '</strong><small>' + escapeHtml(String(incomePercent) + '% от сметы') + '</small></article>' +
                '<article class="is-expense"><span>Оплачено расходов</span><strong class="finance-ratio-value">' + escapeHtml(financeRatioMoney(paidExpense, estimateTotal)) + '</strong><small>уходит из баланса</small></article>' +
                '<article><span>План счетов</span><strong>' + escapeHtml(money(plannedExpense)) + '</strong><small>ожидает оплаты</small></article>' +
                '<article><span>Остаток по смете</span><strong>' + escapeHtml(money(leftByEstimate)) + '</strong><small>смета минус оплачено</small></article>' +
            '</div>' +
        '</section>';
    }

    function renderFinancePlanFromInvoices(items, summary) {
        var invoices = (Array.isArray(items) ? items : []).filter(function (item) {
            return item && item.direction === 'expense' && item.status !== 'paid' && item.status !== 'cancelled';
        });
        var total = invoices.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
        var overdue = invoices.filter(function (item) { return financePlanBucket(item).key === 'overdue'; });
        var week = invoices.filter(function (item) {
            var key = financePlanBucket(item).key;
            return key === 'today' || key === 'week';
        });
        var order = ['overdue', 'today', 'week', 'later', 'no-date'];
        var labels = {
            overdue: '\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e',
            today: '\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c \u0441\u0435\u0433\u043e\u0434\u043d\u044f',
            week: '\u041d\u0430 \u044d\u0442\u043e\u0439 \u043d\u0435\u0434\u0435\u043b\u0435',
            later: '\u041f\u043e\u0437\u0436\u0435',
            'no-date': '\u0411\u0435\u0437 \u0434\u0430\u0442\u044b \u043e\u043f\u043b\u0430\u0442\u044b'
        };
        var groups = {};
        invoices.forEach(function (item) {
            var bucket = financePlanBucket(item);
            if (!groups[bucket.key]) groups[bucket.key] = { bucket: bucket, items: [] };
            groups[bucket.key].items.push(item);
        });
        var planRows = order.filter(function (key) { return groups[key] && groups[key].items.length; }).map(function (key) {
            var group = groups[key];
            var groupTotal = group.items.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
            return '<section class="finance-plan-group">' +
                '<div class="finance-plan-group-head"><div><b>' + escapeHtml(labels[key] || group.bucket.title) + '</b><span>' + escapeHtml(String(group.items.length) + ' \u0441\u0447\u0435\u0442\u043e\u0432') + '</span></div><strong>' + escapeHtml(money(groupTotal)) + '</strong></div>' +
                '<div class="finance-plan-items finance-plan-table">' + group.items.map(function (item) {
                    var title = item.category || item.notes || '\u0421\u0447\u0435\u0442 \u043a \u043e\u043f\u043b\u0430\u0442\u0435';
                    var dateText = item.planned_date || '\u0434\u0430\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430';
                    return '<form class="finance-plan-item ' + (group.bucket.kind ? 'is-' + group.bucket.kind : '') + '" data-finance-edit-form data-finance-id="' + escapeHtml(item.id) + '">' +
                        '<div><b>' + escapeHtml(title) + '</b><small>' + escapeHtml((item.counterparty_name || '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d') + ' - ' + financePaymentLabel(item.payment_kind)) + '</small></div>' +
                        '<div><span>\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c</span><input name="planned_date" type="date" value="' + escapeHtml(item.planned_date || '') + '"></div>' +
                        '<input name="paid_date" type="hidden" value="' + escapeHtml(item.paid_date || '') + '">' +
                        '<div><strong>' + escapeHtml(money(item.amount || 0)) + '</strong><small>' + escapeHtml(dateText) + '</small></div>' +
                        '<select name="status">' +
                            '<option value="planned"' + (item.status === 'planned' ? ' selected' : '') + '>\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e</option>' +
                            '<option value="approved"' + (item.status === 'approved' ? ' selected' : '') + '>\u041f\u043e\u0434\u0430\u043d \u043d\u0430 \u043e\u043f\u043b\u0430\u0442\u0443</option>' +
                            '<option value="paid"' + (item.status === 'paid' ? ' selected' : '') + '>\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e</option>' +
                            '<option value="cancelled"' + (item.status === 'cancelled' ? ' selected' : '') + '>\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043e</option>' +
                        '</select>' +
                        '<input name="notes" type="hidden" value="' + escapeHtml(item.notes || '') + '">' +
                        '<button class="ghost compact finance-icon-button" type="submit"><i data-lucide="save"></i><span>\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</span></button>' +
                    '</form>';
                }).join('') + '</div>' +
            '</section>';
        }).join('');
        return '<section class="subsection finance-plan-board">' +
            '<div class="card-head"><div><h3>\u0424\u0438\u043d\u043f\u043b\u0430\u043d \u043e\u0442 \u0441\u0447\u0435\u0442\u043e\u0432</h3><span class="muted">\u041d\u0435\u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0441\u0447\u0435\u0442\u0430 \u0441\u043e\u0431\u0440\u0430\u043d\u044b \u043f\u043e \u0441\u0440\u043e\u043a\u0430\u043c \u043e\u043f\u043b\u0430\u0442\u044b.</span></div></div>' +
            '<section class="stats-grid finance-plan-stats">' +
                stat('\u041a \u043e\u043f\u043b\u0430\u0442\u0435', money(total), total ? 'warn' : '') +
                stat('\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e', money(overdue.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0)), overdue.length ? 'danger' : '') +
                stat('7 \u0434\u043d\u0435\u0439', money(week.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0)), week.length ? 'warn' : '') +
                stat('\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e', money(summary.paidExpense || 0)) +
            '</section>' +
            (planRows || '<div class="finance-plan-empty">\u041d\u0435\u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0445 \u0441\u0447\u0435\u0442\u043e\u0432 \u043d\u0435\u0442. \u0414\u043e\u0431\u0430\u0432\u044c \u0441\u0447\u0435\u0442 \u043d\u0438\u0436\u0435, \u0438 \u043e\u043d \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0432 \u043f\u043b\u0430\u043d\u0435.</div>') +
        '</section>';
    }

    function renderFinanceHero(projectId, summary) {
        var estimateTotal = financeEstimateTotal(projectId, summary);
        var plannedExpense = Number(summary && summary.plannedExpense || 0);
        var paidExpense = Number(summary && summary.paidExpense || 0);
        var paidIncome = Number(summary && summary.paidIncome || 0);
        var balance = Number(summary && summary.balance || 0);
        var paidPercent = estimateTotal ? Math.min(100, Math.round((paidExpense / estimateTotal) * 100)) : 0;
        return '<section class="finance-hero finance-hero-v2">' +
            '<article class="finance-summary-card"><div class="finance-summary-icon"><i data-lucide="piggy-bank"></i></div><span>\u041e\u0431\u0449\u0438\u0439 \u0431\u044e\u0434\u0436\u0435\u0442</span><strong>' + escapeHtml(money(estimateTotal || 0)) + '</strong><small>\u0412\u0441\u0435\u0433\u043e \u043f\u043e \u0441\u043c\u0435\u0442\u0435</small></article>' +
            '<article class="finance-summary-card is-warn"><div class="finance-summary-icon"><i data-lucide="clock"></i></div><span>\u041f\u043e\u0434\u0430\u043d\u043e / \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043e</span><strong>' + escapeHtml(money(plannedExpense)) + '</strong><small>\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u043f\u043b\u0430\u0442\u044b</small></article>' +
            '<article class="finance-summary-card is-success"><div class="finance-summary-icon"><i data-lucide="check-circle-2"></i></div><span>\u0424\u0430\u043a\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043e</span><strong>' + escapeHtml(money(paidExpense)) + '</strong><small>' + escapeHtml(String(paidPercent) + '% \u043e\u0442 \u0441\u043c\u0435\u0442\u044b') + '</small></article>' +
            '<article class="finance-summary-card is-strong ' + (balance < 0 ? 'is-danger' : '') + '"><div class="finance-summary-icon"><i data-lucide="wallet-cards"></i></div><span>\u0411\u0430\u043b\u0430\u043d\u0441</span><strong>' + escapeHtml(money(balance)) + '</strong><small>\u041f\u043e\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u044f \u043c\u0438\u043d\u0443\u0441 \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0440\u0430\u0441\u0445\u043e\u0434\u044b</small></article>' +
        '</section>';
    }


    function renderFinanceIncomeForm() {
        return '<section class="subsection finance-income-card"><div class="card-head"><div><h3>Поступление денег</h3><span class="muted">Сюда заносим оплату от заказчика, аванс или другое пополнение баланса.</span></div></div>' +
            '<form class="finance-income-form" data-finance-income-form>' +
                '<label><span>Источник</span><input name="counterparty_name" placeholder="Заказчик / инвестор / касса"></label>' +
                '<label><span>Сумма поступления</span><input name="amount" type="number" min="0" step="0.01" required></label>' +
                '<label><span>Дата</span><input name="paid_date" type="date" value="' + escapeHtml(APP_TODAY) + '"></label>' +
                '<label><span>Тип оплаты</span><select name="payment_kind"><option value="bank_no_vat">Безнал без НДС</option><option value="bank_vat">Безнал с НДС</option><option value="cash">Наличные</option></select></label>' +
                '<label class="wide"><span>Комментарий</span><input name="notes" placeholder="Например: аванс по договору, доплата за этап"></label>' +
                '<div class="form-error" data-finance-income-error></div>' +
                '<button class="primary" type="submit">Добавить поступление</button>' +
            '</form></section>';
    }


    function bindFinanceIncomeForm(projectId) {
        var form = qs('[data-finance-income-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-finance-income-error]');
            if (error) error.classList.remove('active');
            var date = form.paid_date.value || APP_TODAY;
            api('/api/projects/' + projectId + '/finances', {
                method: 'POST',
                body: JSON.stringify({
                    direction: 'income',
                    category: 'Поступление',
                    payment_kind: form.payment_kind.value,
                    amount: Number(form.amount.value || 0),
                    vat_percent: form.payment_kind.value === 'bank_vat' ? 20 : 0,
                    planned_date: date,
                    paid_date: date,
                    counterparty_name: form.counterparty_name.value.trim(),
                    status: 'paid',
                    notes: form.notes.value.trim()
                })
            }).then(function () {
                closeFinanceEntryModal(form.closest('[data-finance-form-modal]'));
                form.reset();
                form.paid_date.value = APP_TODAY;
                form.payment_kind.value = 'bank_no_vat';
                loadProjectFinances(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось добавить поступление';
                    error.classList.add('active');
                }
            });
        });
    }


    function bindFinanceSuggestions(projectId, form) {
        var input = form && form.category;
        var amount = form && form.amount;
        var notes = form && form.notes;
        var root = qs('[data-finance-suggestions]', form);
        if (!input || !root) return;
        function renderList() {
            var query = normalizeReportText(input.value);
            var suggestions = financeSuggestionItems(projectId);
            if (!query) {
                root.hidden = true;
                root.innerHTML = '';
                return;
            }
            var matches = suggestions.filter(function (item) {
                return normalizeReportText(item.title + ' ' + item.section).indexOf(query) !== -1;
            }).slice(0, 8);
            if (!matches.length) {
                root.hidden = true;
                root.innerHTML = '';
                return;
            }
            root.hidden = false;
            root.innerHTML = matches.map(function (item, index) {
                var meta = [item.kind, item.section, item.qty ? (finalSectionSummaryNumber(item.qty) + ' ' + item.unit) : '', item.amount ? money(item.amount) : ''].filter(Boolean).join(' • ');
                return '<button type="button" data-finance-suggestion-index="' + index + '"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta) + '</small></button>';
            }).join('');
            qsa('[data-finance-suggestion-index]', root).forEach(function (button) {
                button.addEventListener('click', function () {
                    var item = matches[Number(button.dataset.financeSuggestionIndex || 0)];
                    if (!item) return;
                    input.value = item.title;
                    if (amount && item.amount > 0 && !Number(amount.value || 0)) amount.value = String(Math.round(item.amount * 100) / 100);
                    if (notes && !notes.value.trim()) notes.value = [item.kind, item.section].filter(Boolean).join(': ');
                    root.hidden = true;
                });
            });
        }
        input.addEventListener('input', renderList);
        input.addEventListener('focus', renderList);
        document.addEventListener('click', function (event) {
            if (event.target === input || event.target.closest('[data-finance-suggestions]')) return;
            root.hidden = true;
        });
    }

    function reminderProjectTitle(projectId) {
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        return project ? project.title : 'Объект';
    }

    function reminderScopeText(scope, detail) {
        var cleanScope = String(scope || '').trim();
        var cleanDetail = String(detail || '').trim();
        if (cleanScope && cleanDetail && normalizeReportText(cleanScope) !== normalizeReportText(cleanDetail)) return cleanScope + ' / ' + cleanDetail;
        return cleanScope || cleanDetail || 'Объект';
    }

    function reminderTaskScope(task) {
        return reminderScopeText(task.sectionTitle || 'Задачи объекта', task.stageTitle || '');
    }

    function reminderStageScope(stage) {
        return reminderScopeText('График работ', stage.sectionTitle || stage.title || 'Этап');
    }

    function reminderBlockerScope(log) {
        return reminderScopeText(log.sectionTitle || 'Отчеты', 'блокеры');
    }

    function reminderProcurementScope(alert) {
        return reminderScopeText(alert.sectionTitle || 'Материалы', alert.stageTitle || '');
    }

    function reminderTaskText(task, stateText) {
        var bits = [
            task.title || 'Задача',
            task.assignee_name ? ('исполнитель: ' + task.assignee_name) : '',
            task.due_at ? stateText + ' ' + task.due_at : ''
        ];
        return bits.filter(Boolean).join(' • ');
    }

    function reminderStageText(stage) {
        var bits = [
            stage.title || 'Этап',
            stage.progress != null ? ('готовность ' + percent(stage.progress) + '%') : '',
            stage.planned_end ? ('план до ' + stage.planned_end) : '',
            stage.status_code ? ('статус: ' + statusLabel(stage.status_code)) : ''
        ];
        return bits.filter(Boolean).join(' • ');
    }

    function reminderProcurementText(alert) {
        var bits = [
            alert.title || 'Материал',
            alert.orderByDate ? ('заказать до ' + alert.orderByDate) : '',
            alert.startDate ? ('нужно к старту ' + alert.startDate) : '',
            alert.leadDays ? ('срок поставки ' + alert.leadDays + ' дн.') : ''
        ];
        return bits.filter(Boolean).join(' • ');
    }

    function buildReminderItemsForProject(project, notifications) {
        var projectId = Number(project.id);
        var title = project.title || 'Объект';
        var items = [];
        if (!notifications) return items;
        if (notifications.missingDailyReport) {
            items.push({ kind: 'danger', label: 'Нет отчета сегодня', title: title, scope: 'Отчеты / дневной журнал', text: 'Нужно добавить отчет за сегодня.', href: '/app/projects?openProject=' + projectId });
        }
        (notifications.overdueTasks || []).forEach(function (task) {
            items.push({ kind: 'danger', label: 'Просрочена задача', title: title, scope: reminderTaskScope(task), text: reminderTaskText(task, 'срок был'), href: '/app/projects?openProject=' + projectId });
        });
        (notifications.dueSoonTasks || []).forEach(function (task) {
            items.push({ kind: 'warn', label: 'Скоро срок', title: title, scope: reminderTaskScope(task), text: reminderTaskText(task, 'до'), href: '/app/projects?openProject=' + projectId });
        });
        (notifications.blockerLogs || []).forEach(function (log) {
            items.push({ kind: 'danger', label: 'Блокер', title: title, scope: reminderBlockerScope(log), text: (log.blockers || log.title || 'есть блокер') + (log.report_date ? ' • отчет от ' + log.report_date : ''), href: '/app/projects?openProject=' + projectId });
        });
        (notifications.problemStages || []).forEach(function (stage) {
            items.push({ kind: 'warn', label: 'Проблемный этап', title: title, scope: reminderStageScope(stage), text: reminderStageText(stage), href: '/app/projects?openProject=' + projectId });
        });
        (notifications.procurementAlerts || []).slice(0, 4).forEach(function (alert) {
            var kind = alert.status === 'critical' ? 'danger' : 'warn';
            items.push({ kind: kind, label: kind === 'danger' ? 'Закупка горит' : 'Скоро закупка', title: title, scope: reminderProcurementScope(alert), text: reminderProcurementText(alert), href: '/app/projects?openProject=' + projectId });
        });
        return items;
    }

    function renderReminderBell(items, loading) {
        var button = qs('[data-reminder-toggle]');
        var count = qs('[data-reminder-count]');
        var list = qs('[data-reminder-list]');
        var subtitle = qs('[data-reminder-subtitle]');
        if (!button || !count || !list) return;
        items = Array.isArray(items) ? items : [];
        button.classList.toggle('has-alerts', items.length > 0);
        count.hidden = !items.length;
        count.textContent = String(Math.min(99, items.length));
        if (subtitle) subtitle.textContent = loading ? 'Проверяем объекты...' : (items.length ? String(items.length) + ' активных напоминаний' : 'Сейчас ничего не горит');
        if (loading) {
            list.innerHTML = '<div class="reminder-empty"></div>';
            return;
        }
        if (!items.length) {
            list.innerHTML = '<div class="reminder-empty"><b>Все спокойно</b><span>Просрочек, блокеров и срочных закупок нет.</span></div>';
            return;
        }
        list.innerHTML = '<div class="reminder-list">' + items.slice(0, 20).map(function (item) {
            return '<a class="reminder-item is-' + escapeHtml(item.kind || 'info') + '" href="' + escapeHtml(item.href || '/app/projects') + '">' +
                '<div><span>' + escapeHtml(item.label || 'Напоминание') + '</span><b>' + escapeHtml(item.title || 'Объект') + '</b>' + (item.scope ? '<strong class="reminder-scope">Раздел: ' + escapeHtml(item.scope) + '</strong>' : '') + '<small>' + escapeHtml(item.text || '') + '</small></div>' +
            '</a>';
        }).join('') + '</div>';
    }

    function refreshReminderBell() {
        if (!qsa('[data-reminder-toggle]').length) return;
        if (!state.projects.length) {
            renderReminderBell([], false);
            return;
        }
        renderReminderBell([], true);
        Promise.all(state.projects.map(function (project) {
            return api('/api/projects/' + project.id + '/notifications').then(function (notifications) {
                state.notificationsByProject[project.id] = notifications || {};
                return buildReminderItemsForProject(project, notifications || {});
            }).catch(function () { return []; });
        })).then(function (groups) {
            var items = [];
            groups.forEach(function (group) { items = items.concat(group); });
            renderReminderBell(items, false);
        });
    }

    function initReminderBell() {
        var button = qs('[data-reminder-toggle]');
        var popover = qs('[data-reminder-popover]');
        var refresh = qs('[data-reminder-refresh]');
        if (!button || !popover || button.dataset.bound === '1') return;
        button.dataset.bound = '1';
        button.addEventListener('click', function (event) {
            event.preventDefault();
            popover.hidden = !popover.hidden;
            if (!popover.hidden) refreshReminderBell();
        });
        if (refresh) {
            refresh.addEventListener('click', function (event) {
                event.preventDefault();
                refreshReminderBell();
            });
        }
        document.addEventListener('click', function (event) {
            if (popover.hidden) return;
            if (event.target.closest('[data-reminder-popover]') || event.target.closest('[data-reminder-toggle]')) return;
            popover.hidden = true;
        });
    }

    var baseLoadProjectsForReminders = loadProjects;
    loadProjects = function (callback) {
        return baseLoadProjectsForReminders(function () {
            refreshReminderBell();
            if (callback) callback();
        });
    };

    var baseInitShellForReminders = initShell;
    initShell = function () {
        baseInitShellForReminders();
        initReminderBell();
    };

    var baseRenderLogsStatsForArchive = renderLogsStats;
    renderLogsStats = function (logs, notifications) {
        baseRenderLogsStatsForArchive(logs, notifications);
        if (qsa('[data-report-archive-list]').length) {
            renderLogsList(state.selectedProject || {}, logs);
        }
    };

    function removeProjectAssignmentsBlock() {
        qsa('[data-project-assignments]').forEach(function (root) {
            var section = root.closest('.subsection');
            if (section) section.remove();
            else root.remove();
        });
    }

    loadProjectAssignments = function () {
        removeProjectAssignmentsBlock();
    };

    function sameWorkForScheduleSync(left, right) {
        if (!left || !right) return false;
        var leftTitle = normalizedWorkKeyPart(left.title);
        var rightTitle = normalizedWorkKeyPart(right.title);
        if (!leftTitle || leftTitle !== rightTitle) return false;
        var leftUnit = normalizedWorkKeyPart(left.unit);
        var rightUnit = normalizedWorkKeyPart(right.unit);
        var leftQty = normalizedWorkQty(left.planned_qty != null ? left.planned_qty : left.plannedQty);
        var rightQty = normalizedWorkQty(right.planned_qty != null ? right.planned_qty : right.plannedQty);
        if (leftUnit && rightUnit && leftUnit !== rightUnit) return false;
        if (leftQty && rightQty && leftQty !== rightQty) return false;
        return true;
    }

    var baseIsScheduleWorkDoneInlineSync = isScheduleWorkDone;
    isScheduleWorkDone = function (projectId, sectionTitle, item) {
        if (baseIsScheduleWorkDoneInlineSync(projectId, sectionTitle, item)) return true;
        var map = readStoredJson(scheduleChecklistStorageKey(projectId));
        var target = {
            title: item && item.title,
            unit: item && item.unit,
            planned_qty: item && (item.planned_qty != null ? item.planned_qty : item.plannedQty)
        };
        return Object.keys(map).some(function (key) {
            if (map[key] !== 1) return false;
            var parts = key.split('|');
            return sameWorkForScheduleSync(target, {
                title: parts[1] || '',
                planned_qty: parts[2] || '',
                unit: parts[3] || ''
            });
        });
    };

    setScheduleWorkDone = function (projectId, sectionTitle, item, isDone) {
        var map = readStoredJson(scheduleChecklistStorageKey(projectId));
        var target = {
            title: item && item.title,
            unit: item && item.unit,
            planned_qty: item && (item.planned_qty != null ? item.planned_qty : item.plannedQty)
        };
        var keys = [scheduleWorkKey(sectionTitle, target)];
        workScheduleSections(projectId).forEach(function (section) {
            (Array.isArray(section.items) ? section.items : []).forEach(function (sectionItem) {
                if (sameWorkForScheduleSync(target, sectionItem)) {
                    keys.push(scheduleWorkKey(section.title, sectionItem));
                }
            });
        });
        keys.forEach(function (key) {
            if (isDone) map[key] = 1;
            else delete map[key];
        });
        writeStoredJson(scheduleChecklistStorageKey(projectId), map);
    };

    function normalizedQuantityNumber(value) {
        var number = Number(String(value == null ? '' : value).replace(',', '.').replace(/[^\d.\-]/g, ''));
        return Number.isFinite(number) ? number : 0;
    }

    function unitTextParts(unit) {
        var raw = String(unit || '').trim();
        var compact = raw.replace(/\s+/g, ' ');
        var numericOnly = compact.match(/^(\d+(?:[\.,]\d+)?)$/);
        if (numericOnly) {
            return { multiplier: normalizedQuantityNumber(numericOnly[1]), unit: 'штук', rawUnit: raw, hasMultiplier: true };
        }
        var withUnit = compact.match(/^(\d+(?:[\.,]\d+)?)\s*(.+)$/);
        if (withUnit) {
            var multiplier = normalizedQuantityNumber(withUnit[1]);
            return {
                multiplier: multiplier > 0 ? multiplier : 1,
                unit: withUnit[2].trim() || 'штук',
                rawUnit: raw,
                hasMultiplier: multiplier > 0 && multiplier !== 1
            };
        }
        return { multiplier: 1, unit: raw || 'штук', rawUnit: raw, hasMultiplier: false };
    }

    function quantityPlanInfo(item) {
        var qty = normalizedQuantityNumber(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty));
        var parts = unitTextParts(item && item.unit);
        var normalizedQty = qty;
        if (parts.hasMultiplier && parts.multiplier >= 100 && qty >= parts.multiplier) {
            normalizedQty = qty / parts.multiplier;
        }
        var total = Math.max(0, normalizedQty * (parts.multiplier || 1));
        return {
            rawQty: normalizedQty,
            sourceQty: qty,
            totalQty: total,
            unit: parts.unit || 'штук',
            rawUnit: parts.rawUnit || '',
            multiplier: parts.multiplier || 1,
            hasMultiplier: !!parts.hasMultiplier
        };
    }

    function quantityText(value) {
        return finalSectionSummaryNumber(Math.max(0, normalizedQuantityNumber(value)));
    }

    unitMultiplierInfo = function (unit) {
        var parts = unitTextParts(unit);
        if (!parts.hasMultiplier) return null;
        return { multiplier: parts.multiplier, unit: parts.unit };
    };

    calculatedWorkVolume = function (item) {
        var info = quantityPlanInfo(item);
        if (!info.hasMultiplier) return null;
        return { qty: info.totalQty, unit: info.unit };
    };

    formatCalculatedWorkVolume = function (item) {
        var info = quantityPlanInfo(item);
        if (!info.totalQty) return '';
        return quantityText(info.totalQty) + ' ' + info.unit;
    };

    function storedActualQty(value, totalQty) {
        if (value === 1) return totalQty;
        if (value && typeof value === 'object') return normalizedQuantityNumber(value.qty);
        return normalizedQuantityNumber(value);
    }

    function storedActualForcedOpen(value) {
        return !!(value && typeof value === 'object' && value.open === 1);
    }

    function clampActualQty(value, totalQty) {
        var qty = normalizedQuantityNumber(value);
        if (!Number.isFinite(qty) || qty <= 0) return 0;
        return totalQty > 0 ? Math.min(qty, totalQty) : qty;
    }

    function materialManualActualQty(projectId, item) {
        var plan = quantityPlanInfo(item);
        if (item && item.isCompleted) return plan.totalQty;
        if (item && Number(item.actualQty || 0) > 0) return clampActualQty(item.actualQty, plan.totalQty);
        var map = readStoredJson(materialChecklistStorageKey(projectId));
        return clampActualQty(storedActualQty(map[materialCompletionKey(item)], plan.totalQty), plan.totalQty);
    }

    function materialManualForcedOpen(projectId, item) {
        var map = readStoredJson(materialChecklistStorageKey(projectId));
        return storedActualForcedOpen(map[materialCompletionKey(item)]);
    }

    function setMaterialManualActualQty(projectId, item, qty) {
        var map = readStoredJson(materialChecklistStorageKey(projectId));
        var key = materialCompletionKey(item);
        var plan = quantityPlanInfo(item);
        var actual = clampActualQty(qty, plan.totalQty);
        if (!actual) map[key] = { qty: 0, open: 1 };
        else if (plan.totalQty > 0 && actual >= plan.totalQty) map[key] = 1;
        else map[key] = { qty: actual };
        writeStoredJson(materialChecklistStorageKey(projectId), map);
    }

    setMaterialManuallyDone = function (projectId, item, isDone) {
        setMaterialManualActualQty(projectId, item, isDone ? quantityPlanInfo(item).totalQty : 0);
    };

    isMaterialManuallyDone = function (projectId, item) {
        var plan = quantityPlanInfo(item);
        return plan.totalQty > 0 && materialManualActualQty(projectId, item) >= plan.totalQty;
    };

    function effectiveQtyInFinalUnits(item, rawQty) {
        return normalizedQuantityNumber(rawQty) * (quantityPlanInfo(item).multiplier || 1);
    }

    function materialActualProgress(projectId, item) {
        var effective = effectiveMaterialFromReports(projectId, item);
        var plan = quantityPlanInfo(effective);
        var actual = materialManualForcedOpen(projectId, item) ? 0 : Math.max(
            materialManualActualQty(projectId, item),
            effectiveQtyInFinalUnits(effective, effective.stockQty),
            effectiveQtyInFinalUnits(effective, effective.purchasedQty),
            effectiveQtyInFinalUnits(effective, effective.usedQty)
        );
        return {
            actual: clampActualQty(actual, plan.totalQty),
            total: plan.totalQty,
            unit: plan.unit,
            rawQty: plan.rawQty,
            rawUnit: plan.rawUnit,
            multiplier: plan.multiplier,
            hasMultiplier: plan.hasMultiplier
        };
    }

    materialEffectiveForProgress = function (projectId, item) {
        var effective = effectiveMaterialFromReports(projectId, item);
        var progress = materialActualProgress(projectId, item);
        if (progress.actual > 0) effective.manualPartial = materialManualActualQty(projectId, item) > 0 && progress.actual < progress.total;
        if (progress.total > 0 && progress.actual >= progress.total) {
            effective.manualClosed = materialManualActualQty(projectId, item) > 0;
            effective.supplyStatus = 'in_stock';
            effective.missingQty = 0;
        }
        return effective;
    };

    isMaterialDone = function (projectId, item) {
        if (materialManualForcedOpen(projectId, item)) return false;
        var progress = materialActualProgress(projectId, item);
        if (progress.total > 0 && progress.actual >= progress.total) return true;
        var effective = effectiveMaterialFromReports(projectId, item);
        return String(effective.supplyStatus || '') === 'in_stock' && progress.total > 0;
    };

    function workMatchingKeys(projectId, sectionTitle, item) {
        if (item && item.id) return ['id|' + String(item.id)];
        return [scheduleWorkKey(sectionTitle, item)].filter(Boolean);
    }

    function reportWorkDoneQty(projectId, sectionTitle, item) {
        var plan = quantityPlanInfo(item);
        var effects = reportEffectsState(projectId);
        return effects.works[scheduleWorkKey(sectionTitle, item)] === 1 ? plan.totalQty : 0;
    }

    function workManualActualQty(projectId, sectionTitle, item) {
        var plan = quantityPlanInfo(item);
        if (item && item.isCompleted) return plan.totalQty;
        if (item && Number(item.actualQty || 0) > 0) return clampActualQty(item.actualQty, plan.totalQty);
        var map = readStoredJson(scheduleChecklistStorageKey(projectId));
        return workMatchingKeys(projectId, sectionTitle, item).reduce(function (maxQty, key) {
            return Math.max(maxQty, storedActualQty(map[key], plan.totalQty));
        }, 0);
    }

    function workManualForcedOpen(projectId, sectionTitle, item) {
        var map = readStoredJson(scheduleChecklistStorageKey(projectId));
        return workMatchingKeys(projectId, sectionTitle, item).some(function (key) {
            return storedActualForcedOpen(map[key]);
        });
    }

    function workActualProgress(projectId, sectionTitle, item) {
        var plan = quantityPlanInfo(item);
        var actual = workManualForcedOpen(projectId, sectionTitle, item) ? 0 : Math.max(
            workManualActualQty(projectId, sectionTitle, item),
            reportWorkDoneQty(projectId, sectionTitle, item)
        );
        return {
            actual: clampActualQty(actual, plan.totalQty),
            total: plan.totalQty,
            unit: plan.unit,
            rawQty: plan.rawQty,
            rawUnit: plan.rawUnit,
            multiplier: plan.multiplier,
            hasMultiplier: plan.hasMultiplier
        };
    }

    function setWorkActualQty(projectId, sectionTitle, item, qty) {
        var map = readStoredJson(scheduleChecklistStorageKey(projectId));
        var plan = quantityPlanInfo(item);
        var actual = clampActualQty(qty, plan.totalQty);
        workMatchingKeys(projectId, sectionTitle, item).forEach(function (key) {
            if (!actual) map[key] = { qty: 0, open: 1 };
            else if (plan.totalQty > 0 && actual >= plan.totalQty) map[key] = 1;
            else map[key] = { qty: actual };
        });
        writeStoredJson(scheduleChecklistStorageKey(projectId), map);
    }

    setScheduleWorkDone = function (projectId, sectionTitle, item, isDone) {
        setWorkActualQty(projectId, sectionTitle, item, isDone ? quantityPlanInfo(item).totalQty : 0);
    };

    isScheduleWorkDone = function (projectId, sectionTitle, item) {
        var progress = workActualProgress(projectId, sectionTitle, item);
        return progress.total > 0 && progress.actual >= progress.total;
    };

    isProjectWorkDone = function (projectId, sectionTitle, item) {
        if (!projectId) return false;
        return isScheduleWorkDone(projectId, sectionTitle, item);
    };

    workProgressForRows = function (projectId, sectionTitle, rows) {
        var workRows = rows || [];
        var done = 0;
        var totalQty = 0;
        var actualQty = 0;
        workRows.forEach(function (item) {
            var progress = projectId ? workActualProgress(projectId, sectionTitle, item) : { actual: 0, total: quantityPlanInfo(item).totalQty };
            totalQty += progress.total || 0;
            actualQty += Math.min(progress.actual || 0, progress.total || 0);
            if (progress.total > 0 && progress.actual >= progress.total) done += 1;
        });
        return {
            total: workRows.length,
            done: done,
            left: Math.max(0, workRows.length - done),
            percent: totalQty ? Math.round((actualQty / totalQty) * 100) : (workRows.length ? Math.round((done / workRows.length) * 100) : 0)
        };
    };

    function renderActualQtyEditor(kind, projectId, sectionTitle, item, progress) {
        var itemId = item && item.id || '';
        var stepValue = Math.abs((progress.total || 0) - Math.round(progress.total || 0)) < 0.0001 ? '1' : '0.1';
        return '<label class="quantity-actual-editor quantity-actual-' + escapeHtml(kind) + '">' +
            '<span><b>' + escapeHtml(quantityText(progress.actual)) + '</b> <small>из</small> <em>' + escapeHtml(quantityText(progress.total)) + '</em></span>' +
            '<div><input class="quantity-actual-input" type="number" min="0" max="' + escapeHtml(String(progress.total || '')) + '" step="' + stepValue + '" value="' + escapeHtml(String(Math.round((progress.actual || 0) * 10) / 10)) + '" data-actual-qty-input data-actual-kind="' + escapeHtml(kind) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-item-id="' + escapeHtml(itemId) + '" data-item-title="' + escapeHtml(item && item.title || '') + '" data-item-unit="' + escapeHtml(item && item.unit || '') + '" data-item-qty="' + escapeHtml(String(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty) || '')) + '"><em>' + escapeHtml(progress.unit || 'штук') + '</em></div>' +
        '</label>';
    }

    renderWorkManualCheck = function (item, sectionTitle, projectId) {
        var progress = projectId ? workActualProgress(projectId, sectionTitle, item) : { actual: 0, total: quantityPlanInfo(item).totalQty, unit: quantityPlanInfo(item).unit };
        var isDone = progress.total > 0 && progress.actual >= progress.total;
        return '<div class="section-work-check work-list-check quantity-work-check' + (isDone ? ' is-done' : '') + (progress.actual > 0 && !isDone ? ' is-partial' : '') + '" data-item-id="' + escapeHtml(item.id || '') + '">' +
            '<label class="quantity-check-main"><input type="checkbox" data-section-work-check data-item-id="' + escapeHtml(item.id || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-work-id="' + escapeHtml(item.id || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
            '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '') + '</b><small>' + escapeHtml(formatWorkLine(item) || 'Объем не указан') + (progress.hasMultiplier ? (' • пересчет: ' + quantityText(progress.rawQty) + ' x ' + quantityText(progress.multiplier) + ' = ' + quantityText(progress.total) + ' ' + progress.unit) : '') + '</small></span></label>' +
            renderActualQtyEditor('work', projectId, sectionTitle, item, progress) +
        '</div>';
    };

    renderMaterialManualCheck = function (item, sectionTitle, projectId) {
        var effectiveItem = materialEffectiveForProgress(projectId, item);
        var progress = materialActualProgress(projectId, item);
        var isDone = progress.total > 0 && progress.actual >= progress.total;
        var meta = [
            'по смете: ' + quantityText(progress.total) + ' ' + progress.unit,
            progress.hasMultiplier ? ('пересчет: ' + quantityText(progress.rawQty) + ' x ' + quantityText(progress.multiplier)) : '',
            effectiveItem.manualClosed ? 'закрыто вручную' : (effectiveItem.manualPartial ? 'частично вручную' : (effectiveItem.reportApplied ? 'обновлено по отчету' : ''))
        ].filter(Boolean).join(' • ');
        return '<div class="section-work-check section-material-check quantity-work-check' + (isDone ? ' is-done' : '') + (progress.actual > 0 && !isDone ? ' is-partial' : '') + '" data-item-id="' + escapeHtml(item.id || '') + '">' +
            '<label class="quantity-check-main"><input type="checkbox" data-section-material-check data-item-id="' + escapeHtml(item.id || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-material-id="' + escapeHtml(item.id || '') + '" data-material-title="' + escapeHtml(item.title || '') + '" data-material-unit="' + escapeHtml(item.unit || '') + '" data-material-qty="' + escapeHtml(String(item.plannedQty != null ? item.plannedQty : item.planned_qty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
            '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '') + '</b><small>' + escapeHtml(meta) + '</small></span></label>' +
            renderActualQtyEditor('material', projectId, sectionTitle, item, progress) +
        '</div>';
    };


    var baseRenderSectionScheduleRowQuantity = renderSectionScheduleRow;

    function actualQuantityInputItem(input) {
        return {
            id: input.getAttribute('data-item-id') || '',
            title: input.getAttribute('data-item-title') || '',
            unit: input.getAttribute('data-item-unit') || '',
            plannedQty: input.getAttribute('data-item-qty') || ''
        };
    }

    function updateActualQuantityLabel(input, value) {
        var editor = input && input.closest ? input.closest('.quantity-actual-editor') : null;
        var label = editor ? qs('span b', editor) : null;
        if (label) label.textContent = quantityText(value);
    }

    function updateManualCheckboxDom(input, checked) {
        if (!input) return;
        var itemId = input.getAttribute('data-item-id') || input.getAttribute('data-work-id') || input.getAttribute('data-material-id') || '';
        if (itemId) {
            var element = qs('[data-item-id="' + progressSelectorValue(itemId) + '"]');
            if (!element) return;
        }
        var wrap = input && input.closest ? input.closest('.section-work-check, .material-row, .work-row, .calendar-modal-row') : null;
        if (wrap) {
            wrap.classList.toggle('is-done', checked);
            wrap.classList.toggle('work-row-done', checked);
            wrap.classList.toggle('material-row-done', checked);
            if (checked) wrap.classList.remove('is-partial', 'work-row-partial', 'material-row-partial');
        }
        var row = input && input.closest ? input.closest('.quantity-work-check, .estimate-compact-row, .section-work-check') : null;
        var actual = row ? qs('[data-actual-qty-input]', row) : null;
        if (actual) {
            actual.value = checked ? (actual.getAttribute('max') || actual.getAttribute('data-item-qty') || actual.value) : '0';
            updateActualQuantityLabel(actual, actual.value);
        }
    }

    function updateMaterialScheduleItemDom(materialId, completed) {
        if (!materialId) return;
        var selector = '[data-material-schedule-item][data-material-id="' + progressSelectorValue(materialId) + '"]';
        qsa(selector).forEach(function (node) {
            ['is-done', 'is-neutral', 'is-warning', 'is-overdue', 'is-muted'].forEach(function (cls) {
                node.classList.remove(cls);
            });
            node.classList.add(completed ? 'is-done' : 'is-neutral');
            var status = completed ? 'Закуплено' : 'В плане';
            var label = qs('span', node);
            if (label) label.textContent = status;
            if (node.setAttribute) node.setAttribute('aria-label', (node.getAttribute('aria-label') || '').replace(/:.*$/, ': ' + status));
        });
        Object.keys(state.materialScheduleByProject || {}).forEach(function (projectKey) {
            var schedule = state.materialScheduleByProject[projectKey];
            (Array.isArray(schedule && schedule.items) ? schedule.items : []).forEach(function (item) {
                if (Number(item && item.id || 0) !== Number(materialId)) return;
                item.status = completed ? 'purchased' : 'neutral';
                item.statusLabel = completed ? 'Закуплено' : 'В плане';
                item.color = completed ? 'done' : 'green';
                if (completed) item.missingQty = 0;
            });
        });
    }

    function postProgressItem(projectId, payload, sectionFallback) {
        return api('/api/projects/' + projectId + '/progress-item', {
            method: 'POST',
            body: JSON.stringify(payload || {})
        }).then(function (data) {
            applyProgressApiResponse(projectId, data, sectionFallback);
            return data;
        }).catch(function (error) {
            showAppNotice(appErrorMessage(error, 'Не удалось синхронизировать прогресс'), 'error');
            throw error;
        });
    }

    function bulkCompleteSectionProgress(projectId, sectionId, completed, itemIds) {
        return api('/api/projects/' + encodeURIComponent(projectId) + '/sections/' + encodeURIComponent(progressSectionId(sectionId)) + '/bulk-complete', {
            method: 'POST',
            body: JSON.stringify({
                sectionId: progressSectionId(sectionId),
                sectionTitle: sectionId || '',
                itemIds: itemIds || [],
                completed: completed !== false
            })
        }).then(function (data) {
            applyProgressApiResponse(projectId, data, sectionId);
            return data;
        });
    }

    function sectionBulkScope(input) {
        return input && input.closest ? (input.closest('.estimate-section-collapsible') || input.closest('.section-schedule-card') || input.closest('.estimate-section')) : null;
    }

    function updateBulkSectionCheckState(scope) {
        if (!scope) return;
        var bulk = qs('[data-bulk-section-check]', scope);
        var children = qsa('[data-section-material-check], [data-section-work-check]', scope).filter(function (input) {
            return !input.hasAttribute('data-bulk-section-check');
        });
        if (bulk) {
            bulk.checked = !!(children.length && children.every(function (input) { return input.checked; }));
            bulk.indeterminate = false;
        }
        updateRenderedSectionProgressFromDom(scope, children);
    }

    function updateRenderedSectionProgressFromDom(scope, children) {
        if (!scope) return;
        children = children || qsa('[data-section-material-check], [data-section-work-check]', scope).filter(function (input) {
            return !input.hasAttribute('data-bulk-section-check');
        });
        qsa('[data-section-progress-kind]', scope).forEach(function (node) {
            var kind = node.getAttribute('data-section-progress-kind') || '';
            var group = children.filter(function (input) {
                return kind === 'material' ? input.hasAttribute('data-section-material-check') : input.hasAttribute('data-section-work-check');
            });
            var kindDone = group.filter(function (input) { return input.checked; }).length;
            var kindPercent = group.length ? Math.round((kindDone / group.length) * 100) : 0;
            updateProgressNode(node, kindPercent, kindPercent + '%');
            node.setAttribute('aria-valuenow', String(kindPercent));
            var count = qs('[data-progress-count]', node);
            if (count) count.textContent = group.length ? (String(kindDone) + ' РёР· ' + String(group.length)) : 'РџРѕР·РёС†РёР№ РЅРµС‚';
        });
        var total = children.length;
        var done = children.filter(function (input) { return input.checked; }).length;
        var nextPercent = total ? Math.round((done / total) * 100) : 0;
        qsa('[data-section-progress]:not([data-section-progress-kind]), [data-progress-section-id]:not([data-section-progress-kind])', scope).forEach(function (node) {
            updateProgressNode(node, nextPercent, nextPercent + '%');
            node.setAttribute('aria-valuenow', String(nextPercent));
        });
        qsa('.estimate-section-progress strong', scope).forEach(function (node) {
            node.textContent = String(done) + ' из ' + String(total);
        });
        qsa('.project-badges .badge, .section-schedule-progress-meta span', scope).forEach(function (node) {
            var text = String(node.textContent || '');
            if (/готов|выполн|закрыт/i.test(text)) {
                node.textContent = String(done) + (text.indexOf('/') !== -1 ? '/' : ' из ') + String(total) + (text.indexOf('готов') !== -1 ? ' готово' : ' выполнено');
            }
        });
    }

    function syncBulkSectionChecks(root) {
        qsa('[data-bulk-section-check]', root || document).forEach(function (input) {
            updateBulkSectionCheckState(sectionBulkScope(input));
        });
    }

    function bulkSectionItemIds(scope) {
        var ids = [];
        if (!scope) return ids;
        qsa('[data-section-material-check], [data-section-work-check]', scope).forEach(function (input) {
            if (input.hasAttribute('data-bulk-section-check')) return;
            var raw = input.getAttribute('data-material-id') || input.getAttribute('data-work-id') || '';
            var id = Number(raw || 0);
            if (id && ids.indexOf(id) === -1) ids.push(id);
        });
        return ids;
    }

    function completeBulkSectionLocally(scope, checked) {
        if (!scope) return;
        qsa('[data-section-material-check], [data-section-work-check]', scope).forEach(function (input) {
            if (input.hasAttribute('data-bulk-section-check')) return;
            input.checked = checked;
            var wrap = input.closest ? input.closest('.section-work-check, .material-row, .work-row') : null;
            if (wrap) {
                wrap.classList.toggle('is-done', checked);
                wrap.classList.toggle('work-row-done', checked);
                wrap.classList.toggle('material-row-done', checked);
                if (checked) wrap.classList.remove('is-partial', 'work-row-partial', 'material-row-partial');
            }
        });
        qsa('[data-actual-qty-input]', scope).forEach(function (input) {
            var max = input.getAttribute('max') || input.getAttribute('data-item-qty') || '';
            input.value = checked ? max : '0';
            updateActualQuantityLabel(input, input.value);
        });
    }

    function handleBulkSectionCheck(input) {
        var projectId = Number(input.getAttribute('data-project-id') || 0);
        var sectionTitle = input.getAttribute('data-section-title') || input.getAttribute('data-bulk-section-check') || '';
        var scope = sectionBulkScope(input);
        var itemIds = bulkSectionItemIds(scope);
        var checked = !!input.checked;
        completeBulkSectionLocally(scope, checked);
        input.indeterminate = false;
        return withSubmitLock(input, function () {
            return bulkCompleteSectionProgress(projectId, sectionTitle, checked, itemIds).then(function () {
                if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    refreshSelectedProjectProgressViews(projectId);
                }
            });
        }).catch(function (error) {
            input.checked = !checked;
            completeBulkSectionLocally(scope, !checked);
            updateBulkSectionCheckState(scope);
            showAppNotice(appErrorMessage(error, 'Не удалось закрыть раздел'), 'error');
        });
    }

    function saveActualQuantityInput(input, shouldRerender) {
        var projectId = Number(input.getAttribute('data-project-id') || 0);
        if (!projectId) return;
        var item = actualQuantityInputItem(input);
        var value = input.value;
        if (input.getAttribute('data-actual-kind') === 'work') {
            setWorkActualQty(projectId, input.getAttribute('data-section-title') || '', item, value);
        } else {
            setMaterialManualActualQty(projectId, item, value);
        }
        updateActualQuantityLabel(input, value);
        if (!shouldRerender) return;
        if (input.dataset.progressSyncedValue !== String(value)) {
            input.dataset.progressSyncedValue = String(value);
            postProgressItem(projectId, {
                kind: input.getAttribute('data-actual-kind') || '',
                itemId: input.getAttribute('data-item-id') || '',
                sectionTitle: input.getAttribute('data-section-title') || '',
                title: item.title,
                unit: item.unit,
                actualQty: value,
                completed: Number(value || 0) >= quantityPlanInfo(item).totalQty
            }, input.getAttribute('data-section-title') || '').then(function () {
                refreshSelectedProjectProgressViews(projectId);
            });
        }
        updateBulkSectionCheckState(sectionBulkScope(input));
        if (input.getAttribute('data-actual-kind') === 'material') {
            updateMaterialScheduleItemDom(input.getAttribute('data-item-id') || '', Number(value || 0) >= quantityPlanInfo(item).totalQty);
        }
    }

    function saveManualQuantityCheckbox(input) {
        var projectId = Number(input.getAttribute('data-project-id') || 0);
        if (!projectId) return;
        var checked = !!input.checked;
        var sectionTitle = input.getAttribute('data-section-title') || '';
        var payload = null;
        var materialId = '';
        if (input.hasAttribute('data-section-work-check')) {
            var workItem = {
                id: input.getAttribute('data-work-id') || '',
                title: input.getAttribute('data-work-title') || '',
                unit: input.getAttribute('data-work-unit') || '',
                planned_qty: input.getAttribute('data-work-qty') || ''
            };
            setScheduleWorkDone(projectId, sectionTitle, workItem, checked);
            payload = {
                kind: 'work',
                itemId: workItem.id,
                sectionTitle: sectionTitle,
                title: workItem.title,
                unit: workItem.unit,
                actualQty: checked ? quantityPlanInfo(workItem).totalQty : 0,
                completed: checked
            };
        } else if (input.hasAttribute('data-section-material-check')) {
            var materialItem = {
                id: input.getAttribute('data-material-id') || '',
                title: input.getAttribute('data-material-title') || '',
                unit: input.getAttribute('data-material-unit') || '',
                plannedQty: input.getAttribute('data-material-qty') || ''
            };
            materialId = materialItem.id;
            setMaterialManuallyDone(projectId, materialItem, checked);
            payload = {
                kind: 'material',
                itemId: materialItem.id,
                sectionTitle: sectionTitle,
                title: materialItem.title,
                unit: materialItem.unit,
                actualQty: checked ? quantityPlanInfo(materialItem).totalQty : 0,
                completed: checked
            };
        }
        if (!payload) return;
        updateManualCheckboxDom(input, checked);
        updateBulkSectionCheckState(sectionBulkScope(input));
        return withSubmitLock(input, function () {
            return postProgressItem(projectId, payload, sectionTitle).then(function () {
                updateManualCheckboxDom(input, checked);
                updateBulkSectionCheckState(sectionBulkScope(input));
                if (materialId) updateMaterialScheduleItemDom(materialId, checked);
                refreshSelectedProjectProgressViews(projectId);
                var activeModal = qs('[data-calendar-modal]');
                if (materialId && activeModal && !activeModal.hidden && activeModal.getAttribute('data-project-id') === String(projectId)) {
                    showDayMaterialsModal(projectId, activeModal.getAttribute('data-calendar-modal-day'), materialScheduleDayItems(projectId, activeModal.getAttribute('data-calendar-modal-day')));
                }
            });
        }).catch(function () {
            input.checked = !checked;
            if (payload.kind === 'work' && typeof workItem !== 'undefined') {
                setScheduleWorkDone(projectId, sectionTitle, workItem, !checked);
            } else if (payload.kind === 'material' && typeof materialItem !== 'undefined') {
                setMaterialManuallyDone(projectId, materialItem, !checked);
                updateMaterialScheduleItemDom(materialId, !checked);
            }
            updateManualCheckboxDom(input, !checked);
            updateBulkSectionCheckState(sectionBulkScope(input));
        });
    }

    function installActualQuantityDelegates() {
        if (document.body.dataset.actualQuantityDelegated === '1') return;
        document.body.dataset.actualQuantityDelegated = '1';
        document.addEventListener('click', function (event) {
            var bulk = event.target && event.target.closest ? event.target.closest('[data-bulk-section-check], .bulk-section-check') : null;
            if (!bulk) return;
            event.stopPropagation();
        }, true);
        document.addEventListener('input', function (event) {
            var input = event.target && event.target.closest ? event.target.closest('[data-actual-qty-input]') : null;
            if (!input) return;
            saveActualQuantityInput(input, false);
        }, true);
        document.addEventListener('change', function (event) {
            var actualInput = event.target && event.target.closest ? event.target.closest('[data-actual-qty-input]') : null;
            if (actualInput) {
                event.stopPropagation();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                saveActualQuantityInput(actualInput, true);
                updateBulkSectionCheckState(sectionBulkScope(actualInput));
                syncBulkSectionChecks();
                return;
            }
            var bulkCheckbox = event.target && event.target.closest ? event.target.closest('[data-bulk-section-check]') : null;
            if (bulkCheckbox) {
                event.stopPropagation();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                handleBulkSectionCheck(bulkCheckbox);
                return;
            }
            var checkbox = event.target && event.target.closest ? event.target.closest('[data-section-work-check], [data-section-material-check]') : null;
            if (!checkbox) return;
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            saveManualQuantityCheckbox(checkbox);
            updateBulkSectionCheckState(sectionBulkScope(checkbox));
            syncBulkSectionChecks();
        }, true);
    }

    function bindActualQuantityInputs(projectId) {
        installActualQuantityDelegates();
        qsa('[data-actual-qty-input]').forEach(function (input) {
            if (input.dataset.actualBound === '1') return;
            input.dataset.actualBound = '1';
            input.addEventListener('click', function (event) { event.stopPropagation(); });
            var editor = input.closest ? input.closest('.quantity-actual-editor') : null;
            if (editor && editor.dataset.actualEditorBound !== '1') {
                editor.dataset.actualEditorBound = '1';
                editor.addEventListener('click', function (event) {
                    event.stopPropagation();
                    if (event.target !== input) {
                        input.focus();
                        input.select();
                    }
                });
            }
            input.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') input.blur();
                if (event.key === 'Escape') {
                    input.value = input.defaultValue;
                    input.blur();
                }
            });
            input.addEventListener('input', function () {
                saveActualQuantityInput(input, false);
            });
            input.addEventListener('change', function () {
                saveActualQuantityInput(input, true);
            });
            input.addEventListener('blur', function () {
                saveActualQuantityInput(input, true);
            });
        });
    }

    function reportUnitPattern(unit) {
        var normalized = normalizeReportText(unit);
        if (!normalized) return '';
        if (normalized === 'м2' || normalized.indexOf('квадрат') !== -1) return '(?:м2|м²|кв\\.?\\s*м|м\\s*кв\\.?|метр(?:ов|а)?\\s+квадрат\\w*)';
        if (normalized === 'м3' || normalized.indexOf('куб') !== -1) return '(?:м3|м³|куб\\.?\\s*м|м\\s*куб\\.?|метр(?:ов|а)?\\s+куб\\w*)';
        if (normalized === 'м' || normalized.indexOf('метр') !== -1) return '(?:м|метр(?:ов|а)?)';
        if (normalized === 'шт' || normalized.indexOf('штук') !== -1 || normalized.indexOf('ед') !== -1) return '(?:шт\\.?|штук[аи]?|ед\\.?)';
        return escapeRegex(unit);
    }

    function reportQuantityUnitPatterns(item) {
        var plan = quantityPlanInfo(item);
        var patterns = [];
        [plan.unit, plan.rawUnit].forEach(function (unit) {
            var parts = unitTextParts(unit);
            [parts.unit, unit].forEach(function (candidate) {
                var pattern = reportUnitPattern(candidate);
                if (pattern && patterns.indexOf(pattern) === -1) patterns.push(pattern);
            });
        });
        return patterns;
    }

    reportQuantityFromClause = function (clauseText, item) {
        var raw = String(clauseText || '');
        var normalized = normalizeReportText(raw);
        var plan = quantityPlanInfo(item);
        var percentMatch = normalized.match(/(\d+(?:[\.,]\d+)?)%/);
        if (percentMatch && plan.totalQty > 0) {
            return plan.totalQty * Math.max(0, Math.min(100, normalizedQuantityNumber(percentMatch[1]))) / 100;
        }
        var unitPatterns = reportQuantityUnitPatterns(item);
        for (var i = 0; i < unitPatterns.length; i += 1) {
            var unitMatch = raw.match(new RegExp('(\\d+(?:[\\.,]\\d+)?)\\s*' + unitPatterns[i], 'i'));
            if (unitMatch) return normalizedQuantityNumber(unitMatch[1]);
        }
        if (reportHasPartialIntent(normalized) && plan.totalQty > 0) return plan.totalQty * 0.5;
        if (reportHasWholeIntent(normalized) && plan.totalQty > 0) return plan.totalQty;
        var numberMatch = normalized.match(/(^|\s)(\d+(?:[\.,]\d+)?)(\s|$)/);
        if (numberMatch) return normalizedQuantityNumber(numberMatch[2]);
        return 0;
    };

    reportWorkResultFromClause = function (clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var plan = quantityPlanInfo(candidate.item);
        var qty = clampActualQty(reportQuantityFromClause(clauseText, candidate.item), plan.totalQty);
        var partial = reportHasPartialIntent(clauseText) || (plan.totalQty > 0 && qty > 0 && qty < plan.totalQty);
        var done = plan.totalQty > 0 ? qty >= plan.totalQty : !partial;
        return {
            sectionTitle: candidate.sectionTitle,
            item: candidate.item,
            score: score,
            done: done,
            partial: partial,
            actualQty: done ? plan.totalQty : qty
        };
    };

    reportMaterialResultFromClause = function (clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var normalized = normalizeReportText(clauseText);
        var plan = quantityPlanInfo(candidate.item);
        var qty = clampActualQty(reportQuantityFromClause(clauseText, candidate.item), plan.totalQty);
        var purchase = reportHasPurchaseIntent(normalized);
        var used = reportHasUseIntent(normalized);
        if (!purchase && !used) used = true;
        if (!qty && plan.totalQty > 0 && reportHasPartialIntent(normalized)) qty = plan.totalQty * 0.5;
        if (!qty && plan.totalQty > 0 && reportHasWholeIntent(normalized)) qty = plan.totalQty;
        qty = clampActualQty(qty, plan.totalQty);
        return {
            item: candidate.item,
            score: score,
            purchasedQty: purchase ? qty : 0,
            usedQty: used ? qty : 0
        };
    };

    effectiveMaterialFromReports = function (projectId, item) {
        var effective = Object.assign({}, item || {});
        var effects = reportEffectsState(projectId);
        var materialEffect = effects.materials[Number(item && item.id)];
        if (!materialEffect) return effective;
        var plan = quantityPlanInfo(effective);
        var multiplier = plan.multiplier || 1;
        var basePurchased = Number(effective.purchasedQty || 0);
        var baseUsed = Number(effective.usedQty || 0);
        var baseStock = Number(effective.stockQty || 0);
        var purchasedRaw = Number(materialEffect.purchasedQty || 0) / multiplier;
        var usedRaw = Number(materialEffect.usedQty || 0) / multiplier;
        var purchased = basePurchased + purchasedRaw;
        var used = baseUsed + usedRaw;
        if (plan.rawQty > 0) {
            purchased = Math.min(plan.rawQty, purchased);
            used = Math.min(plan.rawQty, used);
        }
        var stock = Math.max(0, baseStock + purchasedRaw - usedRaw);
        if (plan.rawQty > 0) stock = Math.min(plan.rawQty, stock);
        effective.purchasedQty = finalSectionSummaryNumber(purchased);
        effective.usedQty = finalSectionSummaryNumber(used);
        effective.stockQty = finalSectionSummaryNumber(stock);
        effective.missingQty = Math.max(0, plan.rawQty - Math.max(purchased, stock));
        effective.reportApplied = purchased > basePurchased || used > baseUsed;
        if (plan.rawQty > 0 && purchased >= plan.rawQty) effective.supplyStatus = 'in_stock';
        return effective;
    };

    reportWorkDoneQty = function (projectId, sectionTitle, item) {
        var plan = quantityPlanInfo(item);
        var effects = reportEffectsState(projectId);
        return storedActualQty(effects.works[scheduleWorkKey(sectionTitle, item)], plan.totalQty);
    };

    var baseBindProjectChainActionsForQuantities = bindProjectChainActions;
    bindProjectChainActions = function () {
        baseBindProjectChainActionsForQuantities();
        if (state.selectedProject && state.selectedProject.id) bindActualQuantityInputs(state.selectedProject.id);
    };

    function isScheduleProjectOpen(projectId) {
        state.scheduleProjectOpenByProject = state.scheduleProjectOpenByProject || {};
        return state.scheduleProjectOpenByProject[String(projectId)] === true;
    }

    function setScheduleProjectOpen(projectId, isOpen) {
        state.scheduleProjectOpenByProject = state.scheduleProjectOpenByProject || {};
        if (isOpen) state.scheduleProjectOpenByProject[String(projectId)] = true;
        else delete state.scheduleProjectOpenByProject[String(projectId)];
    }

    function scheduleProjectDetails(projectId) {
        state.scheduleProjectDetailsByProject = state.scheduleProjectDetailsByProject || {};
        return state.scheduleProjectDetailsByProject[String(projectId)] || null;
    }

    function setScheduleProjectDetails(projectId, details) {
        state.scheduleProjectDetailsByProject = state.scheduleProjectDetailsByProject || {};
        state.scheduleProjectDetailsByProject[String(projectId)] = details;
    }

    function scheduleProjectBody(projectId) {
        return qs('[data-schedule-project-body="' + String(projectId) + '"]');
    }

    function scheduleProjectById(projectId) {
        return state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || null;
    }

    function scheduleForecastPromise(project, force) {
        return new Promise(function (resolve) {
            loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function (summary) {
                resolve(summary);
            }, force);
        });
    }

    function renderScheduleProjectObjectSummary(project, details) {
        var stages = details && Array.isArray(details.stages) ? details.stages : null;
        var notifications = details && details.notifications ? details.notifications : null;
        var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[project.id];
        var sections = Array.isArray(summary && summary.sections) ? summary.sections : [];
        var progress = summary ? projectScheduleProgress(project, summary) : { percent: percent(project.progress), done: 0, total: 0 };
        var overdue = stages ? stages.filter(function (stage) { return isStageOverdue(stage, APP_TODAY); }).length : 0;
        var nextDate = stages ? collectNextStageDate(stages) : (project.deadline_at || '');
        var reportText = notifications && notifications.latestDailyLog && notifications.latestDailyLog.report_date
            ? ('Последний отчет: ' + notifications.latestDailyLog.report_date)
            : (notifications && notifications.missingDailyReport ? 'Нет свежего отчета' : 'Раскройте объект для деталей');
        return '<div class="schedule-project-summary schedule-project-summary-compact">' +
            stat('Готовность', String(progress.percent || 0) + '%') +
            stat('Статус', project.status || 'В работе') +
            stat('Старт', project.started_at || '-') +
            stat('Дедлайн', project.deadline_at || '-') +
            stat('Разделов', sections.length ? String(sections.length) : (stages ? String(stages.length) : '-')) +
            stat('Просрочено', stages ? String(overdue) : '-', overdue ? 'danger' : '') +
            stat('Ближайшая дата', nextDate || '-') +
            stat('Отчет', reportText, notifications && notifications.missingDailyReport ? 'danger' : '') +
        '</div>';
    }

    function renderScheduleProjectDetails(project, details) {
        details = details || {};
        var stages = Array.isArray(details.stages) ? details.stages : [];
        var notifications = details.notifications || null;
        var materials = Array.isArray(details.materials) ? details.materials : [];
        var tasks = Array.isArray(details.tasks) ? details.tasks : [];
        var topBar = '<section class="schedule-project-topbar">' +
            '<div class="schedule-project-topbar-copy"><h3>' + escapeHtml(project.title || 'Объект') + '</h3><span class="muted">' + escapeHtml(project.address || project.client_name || 'Адрес не указан') + '</span></div>' +
            (canManageSchedule() ? '<button class="primary schedule-autoplan-button" type="button" data-auto-schedule-open data-project-id="' + escapeHtml(project.id) + '">⚙️ Автоплан графика</button>' : '') +
        '</section>';
        var objectInfo = '<section class="schedule-object-info">' +
            dataItem('Заказчик', project.client_name || 'Не указан') +
            dataItem('Адрес', project.address || 'Не указан') +
            dataItem('Договор', project.contract_no || '-') +
            dataItem('Готовность объекта', percent(project.progress) + '%') +
            dataItem('Старт', project.started_at || '-') +
            dataItem('Дедлайн', project.deadline_at || '-') +
        '</section>';
        return topBar +
            objectInfo +
            renderSectionScheduleForecast(project) +
            renderScheduleActionCenter(project, stages, notifications, materials, tasks) +
            renderScheduleCalendar(project, stages) +
            (stages.length ? renderStages(stages) : '<div class="section-schedule-empty">Этапы объекта пока не заполнены.</div>');
    }

    function renderScheduleProject(project) {
        var open = isScheduleProjectOpen(project.id);
        var details = scheduleProjectDetails(project.id);
        var types = hasRole('customer') ? ['customer'] : ['internal', 'customer'];
        var badges = types.map(function (type) {
            var stateMeta = getScheduleState(project, type);
            var shortLabel = type === 'customer' ? 'Заказчик' : 'Внутренний';
            return '<span class="badge ' + scheduleStateKind(stateMeta) + '">' + escapeHtml(shortLabel + ' v' + stateMeta.version + ' • ' + scheduleStateTitle(stateMeta)) + '</span>';
        }).join('');
        return '<section class="schedule-project schedule-project-accordion ui-card' + (open ? ' is-open' : '') + '">' +
            '<button class="schedule-project-toggle" type="button" data-schedule-project-toggle data-project-id="' + escapeHtml(project.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
                '<span class="schedule-project-toggle-main"><b>' + escapeHtml(project.title || 'Объект') + '</b><small>' + escapeHtml(project.address || project.client_name || 'Адрес не указан') + '</small></span>' +
                '<span class="project-badges">' + badges + '<span class="badge">' + escapeHtml(percent(project.progress) + '%') + '</span></span>' +
                '<span class="section-schedule-chevron" aria-hidden="true">' + (open ? '-' : '+') + '</span>' +
            '</button>' +
            renderScheduleProjectObjectSummary(project, details) +
            '<div class="schedule-project-body' + (open ? ' is-open' : '') + '" data-schedule-project-body="' + escapeHtml(project.id) + '" aria-hidden="' + (open ? 'false' : 'true') + '">' +
                (details ? renderScheduleProjectDetails(project, details) : (open ? '<div class="section-schedule-empty"></div>' : '')) +
            '</div>' +
        '</section>';
    }

    function loadScheduleProjectDetails(project, force) {
        if (!project || !project.id) return;
        var projectId = project.id;
        state.scheduleProjectLoadingByProject = state.scheduleProjectLoadingByProject || {};
        if (!force && scheduleProjectDetails(projectId)) {
            refreshScheduleProjectBody(projectId);
            return;
        }
        if (state.scheduleProjectLoadingByProject[String(projectId)]) return;
        state.scheduleProjectLoadingByProject[String(projectId)] = true;
        var body = scheduleProjectBody(projectId);
        if (body) body.innerHTML = '<div class="section-schedule-empty"></div>';
        Promise.all([
            api('/api/projects/' + projectId + '/stages').catch(function () { return { stages: [] }; }),
            api('/api/projects/' + projectId + '/notifications').catch(function () { return null; }),
            api('/api/projects/' + projectId + '/materials/summary').catch(function () { return { items: [] }; }),
            api('/api/projects/' + projectId + '/tasks').catch(function () { return { tasks: [] }; }),
            scheduleForecastPromise(project, force)
        ]).then(function (results) {
            var stages = Array.isArray(results[0].stages) ? results[0].stages : [];
            var materials = Array.isArray(results[2].items) ? results[2].items : [];
            state.stagesByProject[projectId] = stages;
            state.materialsByProject[projectId] = materials;
            state.notificationsByProject[projectId] = results[1] || null;
            setScheduleProjectDetails(projectId, {
                stages: stages,
                notifications: results[1] || null,
                materials: materials,
                tasks: Array.isArray(results[3].tasks) ? results[3].tasks : []
            });
            state.scheduleProjectLoadingByProject[String(projectId)] = false;
            renderSchedulePage();
        }).catch(function () {
            state.scheduleProjectLoadingByProject[String(projectId)] = false;
            var target = scheduleProjectBody(projectId);
            if (target) target.innerHTML = '<div class="section-schedule-empty">Не удалось загрузить данные объекта.</div>';
        });
    }

    function refreshScheduleProjectBody(projectId) {
        var project = scheduleProjectById(projectId);
        var body = scheduleProjectBody(projectId);
        if (!project || !body || !isScheduleProjectOpen(projectId)) return;
        body.innerHTML = renderScheduleProjectDetails(project, scheduleProjectDetails(projectId));
        bindSchedulePageProjectDetails(projectId);
    }

    function bindSchedulePageActualQuantityInputs(projectId) {
        installActualQuantityDelegates();
        var body = scheduleProjectBody(projectId);
        qsa('[data-actual-qty-input]', body).forEach(function (input) {
            if (input.dataset.schedulePageActualBound === '1') return;
            input.dataset.schedulePageActualBound = '1';
            input.addEventListener('click', function (event) { event.stopPropagation(); });
            var editor = input.closest ? input.closest('.quantity-actual-editor') : null;
            if (editor && editor.dataset.actualEditorBound !== '1') {
                editor.dataset.actualEditorBound = '1';
                editor.addEventListener('click', function (event) {
                    event.stopPropagation();
                    if (event.target !== input) {
                        input.focus();
                        input.select();
                    }
                });
            }
            input.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') input.blur();
                if (event.key === 'Escape') {
                    input.value = input.defaultValue;
                    input.blur();
                }
            });
            input.addEventListener('change', function () {
                var item = {
                    id: input.getAttribute('data-item-id') || '',
                    title: input.getAttribute('data-item-title') || '',
                    unit: input.getAttribute('data-item-unit') || '',
                    plannedQty: input.getAttribute('data-item-qty') || ''
                };
                if (input.getAttribute('data-actual-kind') === 'work') {
                    setWorkActualQty(projectId, input.getAttribute('data-section-title') || '', item, input.value);
                } else {
                    setMaterialManualActualQty(projectId, item, input.value);
                }
                renderSchedulePage();
            });
        });
    }

    function bindSchedulePageProjectDetails(projectId) {
        var body = scheduleProjectBody(projectId);
        var project = scheduleProjectById(projectId);
        if (!body || !project) return;
        qsa('[data-section-schedule-toggle]', body).forEach(function (button) {
            if (button.dataset.schedulePageBound === '1') return;
            button.dataset.schedulePageBound = '1';
            var toggleSection = function () {
                var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[projectId];
                var sections = Array.isArray(summary && summary.sections) ? summary.sections : [];
                var key = button.getAttribute('data-section-key') || '';
                var section = sections.find(function (entry) { return scheduleSectionKey(entry) === key; });
                if (!section) return;
                toggleScheduleSectionDom(button, projectId, section);
            };
            button.addEventListener('click', toggleSection);
            button.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleSection();
            });
        });
        qsa('[data-section-work-check]', body).forEach(function (input) {
            if (input.dataset.schedulePageWorkBound === '1') return;
            input.dataset.schedulePageWorkBound = '1';
            input.addEventListener('change', function () {
                setScheduleWorkDone(projectId, input.getAttribute('data-section-title') || '', {
                    title: input.getAttribute('data-work-title') || '',
                    unit: input.getAttribute('data-work-unit') || '',
                    planned_qty: input.getAttribute('data-work-qty') || ''
                }, input.checked);
                renderSchedulePage();
            });
        });
        qsa('[data-section-schedule-refresh]', body).forEach(function (button) {
            if (button.dataset.schedulePageRefreshBound === '1') return;
            button.dataset.schedulePageRefreshBound = '1';
            button.addEventListener('click', function () {
                button.disabled = true;
                loadScheduleProjectDetails(project, true);
            });
        });
        bindScheduleActionButtons();
        bindSchedulePageActualQuantityInputs(projectId);
    }

    function bindScheduleProjectAccordions() {
        qsa('[data-schedule-project-toggle]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var projectId = button.getAttribute('data-project-id');
                var project = scheduleProjectById(projectId);
                if (!project) return;
                var nextOpen = !isScheduleProjectOpen(projectId);
                setScheduleProjectOpen(projectId, nextOpen);
                var container = button.closest ? button.closest('.schedule-project-accordion') : null;
                var body = container && container.querySelector ? container.querySelector('[data-schedule-project-body]') : null;
                var chevron = button.querySelector ? button.querySelector('.section-schedule-chevron') : null;
                button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                if (container) container.classList.toggle('is-open', nextOpen);
                if (body) {
                    body.classList.toggle('is-open', nextOpen);
                    body.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
                    if (nextOpen && !scheduleProjectDetails(projectId)) {
                        body.innerHTML = '<div class="section-schedule-empty"></div>';
                    }
                }
                if (chevron) chevron.textContent = nextOpen ? '-' : '+';
                if (nextOpen) {
                    if (scheduleProjectDetails(projectId)) bindSchedulePageProjectDetails(projectId);
                    else loadScheduleProjectDetails(project, false);
                }
            });
        });
        (state.projects || []).forEach(function (project) {
            if (isScheduleProjectOpen(project.id)) {
                if (scheduleProjectDetails(project.id)) bindSchedulePageProjectDetails(project.id);
                else loadScheduleProjectDetails(project, false);
            }
        });
    }

    function renderSchedulePage() {
        var root = qs('[data-schedule-list]');
        if (!root) return;
        state.scheduleQuickActions = {};
        state.scheduleProjectOpenByProject = state.scheduleProjectOpenByProject || {};
        if (!state.projects.length) {
            root.innerHTML = '<p class="muted">Нет объектов для графика.</p>';
            return;
        }
        root.innerHTML = '<div class="schedule-project-list">' + state.projects.map(function (project) {
            return renderScheduleProject(project);
        }).join('') + '</div>';
        bindScheduleProjectAccordions();
    }

    function estimateSectionStorageKey(projectId, kind) {
        return 'pmbi.estimate.sections.' + String(kind || 'items') + '.' + String(projectId || '');
    }

    function estimateSectionKey(kind, title, index) {
        return [
            String(kind || 'items'),
            normalizedWorkKeyPart(title || ''),
            String(index || 0)
        ].join('|');
    }

    function isEstimateSectionOpen(projectId, kind, title, index) {
        var map = readStoredJson(estimateSectionStorageKey(projectId, kind));
        return map[estimateSectionKey(kind, title, index)] === 1;
    }

    function setEstimateSectionOpen(projectId, kind, title, index, isOpen) {
        var map = readStoredJson(estimateSectionStorageKey(projectId, kind));
        var key = estimateSectionKey(kind, title, index);
        if (isOpen) map[key] = 1;
        else delete map[key];
        writeStoredJson(estimateSectionStorageKey(projectId, kind), map);
    }

    function renderEstimateAccordionHead(projectId, kind, title, index, mainHtml, sideHtml, subHtml, progressHtml) {
        var isOpen = isEstimateSectionOpen(projectId, kind, title, index);
        return '<div class="card-head estimate-section-head estimate-accordion-head" role="button" tabindex="0" data-estimate-section-toggle data-project-id="' + escapeHtml(projectId || '') + '" data-estimate-kind="' + escapeHtml(kind) + '" data-section-title="' + escapeHtml(title || '') + '" data-section-index="' + escapeHtml(String(index || 0)) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
            '<div class="estimate-accordion-main">' +
                '<div class="estimate-section-title">' + mainHtml + '</div>' +
                (subHtml ? '<small>' + subHtml + '</small>' : '') +
                (progressHtml || '') +
            '</div>' +
            '<div class="work-section-head-side">' + (sideHtml || '') + '<span class="section-schedule-chevron" aria-hidden="true">' + (isOpen ? '-' : '+') + '</span></div>' +
        '</div>';
    }

    function renderBulkSectionCheckbox(projectId, sectionTitle, kind, progress) {
        var sectionId = progressSectionId(sectionTitle || '');
        var checked = !!(progress && progress.total && progress.done >= progress.total);
        return '<label class="bulk-section-check" title="Закрыть весь раздел">' +
            '<input type="checkbox" data-bulk-section-check="' + escapeHtml(sectionId) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-bulk-kind="' + escapeHtml(kind || 'items') + '"' + (checked ? ' checked' : '') + '>' +
            '<span aria-hidden="true"></span>' +
        '</label>';
    }

    function renderEstimateSectionBody(isOpen, contentHtml) {
        return '<div class="estimate-section-body-shell' + (isOpen ? ' is-open' : '') + '" aria-hidden="' + (isOpen ? 'false' : 'true') + '">' +
            '<div class="estimate-section-body-clip"><div class="materials-list estimate-section-body">' + (contentHtml || '') + '</div></div>' +
        '</div>';
    }

    function toggleEstimateSectionFromHead(button, fallbackProjectId) {
        var targetProjectId = Number(button.getAttribute('data-project-id') || fallbackProjectId || 0);
        var kind = button.getAttribute('data-estimate-kind') || 'items';
        var title = button.getAttribute('data-section-title') || '';
        var index = Number(button.getAttribute('data-section-index') || 0);
        var isOpen = button.getAttribute('aria-expanded') !== 'true';
        var section = button.closest ? button.closest('.estimate-section-collapsible') : null;
        var body = section && section.querySelector ? section.querySelector('.estimate-section-body-shell') : null;
        var chevron = button.querySelector ? button.querySelector('.section-schedule-chevron') : null;
        setEstimateSectionOpen(targetProjectId, kind, title, index, isOpen);
        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (chevron) chevron.textContent = isOpen ? '-' : '+';
        if (section) section.classList.toggle('is-open', isOpen);
        if (body) {
            body.classList.toggle('is-open', isOpen);
            body.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        }
    }

    function estimateDisplaySectionTitle(title, index) {
        var clean = String(title || '').replace(/\s+/g, ' ').trim();
        if (!clean) return materialSectionLabel(index);
        if (/^раздел\s*\d+/i.test(clean)) return clean;
        return materialSectionLabel(index) + ' ' + clean;
    }

    function explicitEstimateSectionNumber(title) {
        var match = String(title || '').trim().match(/^раздел\s*(\d+)/i);
        return match ? Number(match[1]) : 0;
    }

    function buildEstimateSectionNumberMap(sectionTitles) {
        var used = {};
        (sectionTitles || []).forEach(function (title) {
            var number = explicitEstimateSectionNumber(title);
            if (number > 0) used[number] = 1;
        });
        var next = 1;
        var map = {};
        (sectionTitles || []).forEach(function (title, index) {
            var key = String(title || '').trim() || 'Без раздела';
            if (map[key]) return;
            var explicit = explicitEstimateSectionNumber(key);
            if (explicit > 0) {
                map[key] = explicit;
                return;
            }
            while (used[next]) next += 1;
            map[key] = next;
            used[next] = 1;
            next += 1;
        });
        return map;
    }

    function estimateDisplaySectionTitleWithNumber(title, fallbackIndex, sectionNumbers) {
        var clean = String(title || '').replace(/\s+/g, ' ').trim();
        if (/^раздел\s*\d+/i.test(clean)) return clean;
        var number = sectionNumbers && sectionNumbers[clean || 'Без раздела'];
        if (!number) number = fallbackIndex + 1;
        if (!clean || clean === 'Без раздела') return 'Раздел ' + String(number);
        return 'Раздел ' + String(number) + ' ' + clean;
    }

    function renderCompactActualQtyEditor(kind, projectId, sectionTitle, item, progress) {
        var itemId = item && item.id || '';
        var stepValue = Math.abs((progress.total || 0) - Math.round(progress.total || 0)) < 0.0001 ? '1' : '0.1';
        return '<label class="quantity-actual-editor quantity-actual-compact quantity-actual-' + escapeHtml(kind) + '" title="\u041d\u0430\u0436\u043c\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0443\u043a\u0430\u0437\u0430\u0442\u044c \u0444\u0430\u043a\u0442">' +
            '<span><b>' + escapeHtml(quantityText(progress.actual)) + '</b> <small>\u0438\u0437</small> <em>' + escapeHtml(quantityText(progress.total)) + '</em></span>' +
            '<div><input class="quantity-actual-input" type="number" min="0" max="' + escapeHtml(String(progress.total || '')) + '" step="' + stepValue + '" value="' + escapeHtml(String(Math.round((progress.actual || 0) * 10) / 10)) + '" data-actual-qty-input data-actual-kind="' + escapeHtml(kind) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-item-id="' + escapeHtml(itemId) + '" data-item-title="' + escapeHtml(item && item.title || '') + '" data-item-unit="' + escapeHtml(item && item.unit || '') + '" data-item-qty="' + escapeHtml(String(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty) || '')) + '"><em>' + escapeHtml(progress.unit || '\u0435\u0434.') + '</em></div>' +
        '</label>';
    }


    function renderCounterpartyPicker(projectId, item, insight, labels, kind) {
        if (!canManageSuppliers()) return '';
        labels = labels || {};
        kind = kind === 'contractor' ? 'contractor' : 'supplier';
        var companies = (state.companies || []).filter(function (company) {
            return company && company.type === kind;
        });
        var options = insight && Array.isArray(insight.options) ? insight.options : [];
        var projectOptions = state.materialInsightsByProject[projectId] && Array.isArray(state.materialInsightsByProject[projectId].__allOptions)
            ? state.materialInsightsByProject[projectId].__allOptions
            : [];
        var knownNames = {};
        companies.forEach(function (company) {
            var name = String(company && company.name || '').trim().toLowerCase();
            if (name) knownNames[name] = 1;
        });
        var extraOptions = projectOptions.filter(function (option) {
            if (!option || option.candidateType !== kind) return false;
            var name = String(option.name || option.company || '').trim().toLowerCase();
            if (!name || knownNames[name]) return false;
            knownNames[name] = 1;
            return true;
        });
        var selectedByType = insight && insight.selectedByType ? insight.selectedByType[kind] : null;
        if (!selectedByType) {
            selectedByType = options.find(function (option) {
                return option && option.candidateType === kind && option.status === 'selected';
            }) || null;
        }
        var isSelected = !!selectedByType;
        var itemQty = item && (item.plannedQty != null ? item.plannedQty : item.planned_qty);
        function offerForCompany(company) {
            var companyId = Number(company && company.id || 0);
            var companyName = String(company && company.name || '').trim().toLowerCase();
            return options.find(function (option) {
                if (!option || option.candidateType !== kind) return false;
                if (companyId && Number(option.companyId || 0) === companyId) return true;
                return companyName && String(option.name || option.company || '').trim().toLowerCase() === companyName;
            }) || null;
        }
        function selectedCounterpartyLabel() {
            if (!isSelected) return escapeHtml(labels.empty || '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442');
            var selectedName = selectedByType.name || labels.selected || '\u0412\u044b\u0431\u0440\u0430\u043d';
            var selectedCompanyId = selectedByType.companyId || '';
            if (!selectedCompanyId && selectedName) {
                var matchedCompany = companies.find(function (company) {
                    return String(company && company.name || '').trim().toLowerCase() === String(selectedName || '').trim().toLowerCase();
                });
                selectedCompanyId = matchedCompany && matchedCompany.id || '';
            }
            return '<span class="supplier-link-click" data-supplier-id="' + escapeHtml(selectedCompanyId || '') + '" data-supplier-name="' + escapeHtml(selectedName || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-counterparty-kind="' + escapeHtml(kind) + '">' + escapeHtml(selectedName) + '</span>';
        }
        return '<div class="material-supplier-picker counterparty-picker">' +
            '<button class="ghost material-link compact' + (isSelected ? ' is-selected' : '') + '" type="button" data-supplier-toggle data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(item.id) + '" data-counterparty-kind="' + escapeHtml(kind) + '">' + selectedCounterpartyLabel() + '</button>' +
            '<div class="material-supplier-menu" data-supplier-menu hidden>' +
                '<div class="material-supplier-menu-title">' + escapeHtml(kind === 'contractor' ? '\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u043e\u0432' : '\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u0432') + '</div>' +
                '<button class="material-supplier-option material-supplier-option-empty" type="button" data-supplier-select data-supplier-clear data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(item.id) + '" data-offer-id="' + escapeHtml(selectedByType && selectedByType.id || '') + '" data-candidate-type="' + escapeHtml(kind) + '">' +
                    '<strong>\u2014</strong>' +
                '</button>' +
                ((companies.length || extraOptions.length) ? companies.map(function (company) {
                    var offer = offerForCompany(company) || {};
                    var companyId = Number(company.id || 0);
                    var selected = !!(selectedByType && (Number(selectedByType.companyId || 0) === companyId || String(selectedByType.name || '').trim() === String(company.name || '').trim()));
                    var meta = [company.phone || '', company.email || '', company.inn ? ('\u0418\u041d\u041d ' + company.inn) : ''].filter(Boolean).join(' \u2022 ');
                    return '<button class="material-supplier-option' + (selected ? ' is-selected' : '') + '" type="button" data-supplier-select data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(item.id) + '" data-offer-id="' + escapeHtml(offer.id || '') + '" data-company-id="' + escapeHtml(companyId) + '" data-company-name="' + escapeHtml(company.name || '') + '" data-candidate-type="' + escapeHtml(kind) + '" data-item-title="' + escapeHtml(item && item.title || '') + '" data-item-unit="' + escapeHtml(item && item.unit || '') + '" data-item-qty="' + escapeHtml(itemQty == null ? '' : String(itemQty)) + '" data-status="' + escapeHtml(offer.status || 'new') + '" data-price="' + escapeHtml(offer.price || 0) + '" data-qty="' + escapeHtml(offer.qty || itemQty || 0) + '" data-phone="' + escapeHtml(offer.phone || company.phone || '') + '" data-source-url="' + escapeHtml(offer.sourceUrl || '') + '" data-notes="' + escapeHtml(offer.notes || '') + '"><strong>' + escapeHtml(company.name || '') + '</strong>' + (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + '</button>';
                }).join('') + extraOptions.map(function (option) {
                    var sameItem = Number(option.estimateItemId || 0) === Number(item && item.id || 0);
                    var meta = [option.company || '', option.phone || '', option.price > 0 ? (finalSectionSummaryNumber(option.price) + ' \u20bd') : ''].filter(Boolean).join(' \u2022 ');
                    return '<button class="material-supplier-option' + (option.status === 'selected' && sameItem ? ' is-selected' : '') + '" type="button" data-supplier-select data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(item.id) + '" data-offer-id="' + escapeHtml(sameItem ? option.id : '') + '" data-company-id="' + escapeHtml(option.companyId || '') + '" data-company-name="' + escapeHtml(option.name || '') + '" data-candidate-type="' + escapeHtml(kind) + '" data-item-title="' + escapeHtml(item && item.title || '') + '" data-item-unit="' + escapeHtml(item && item.unit || '') + '" data-item-qty="' + escapeHtml(itemQty == null ? '' : String(itemQty)) + '" data-status="' + escapeHtml(option.status || 'new') + '" data-price="' + escapeHtml(option.price || 0) + '" data-qty="' + escapeHtml(option.qty || itemQty || 0) + '" data-phone="' + escapeHtml(option.phone || '') + '" data-source-url="' + escapeHtml(option.sourceUrl || '') + '" data-notes="' + escapeHtml(option.notes || '') + '"><strong>' + escapeHtml(option.name || '') + '</strong>' + (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + '</button>';
                }).join('') : '<div class="material-supplier-empty">' + escapeHtml(labels.none || '\u041d\u0435\u0442 \u043a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442\u043e\u0432') + '</div>') +
            '</div>' +
        '</div>';
    }


    function bindEstimateSectionToggles(projectId) {
        if (!document.body.dataset.estimateSectionToggleDelegated) {
            document.body.dataset.estimateSectionToggleDelegated = '1';
            document.addEventListener('click', function (event) {
                var button = event.target && event.target.closest ? event.target.closest('[data-estimate-section-toggle]') : null;
                if (!button) return;
                event.preventDefault();
                toggleEstimateSectionFromHead(button, projectId);
            });
            document.addEventListener('keydown', function (event) {
                var button = event.target && event.target.closest ? event.target.closest('[data-estimate-section-toggle]') : null;
                if (!button) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleEstimateSectionFromHead(button, projectId);
            });
        }
    }

    renderEstimateWorkItem = function (item, sectionTitle, projectId, riskKind) {
        var insight = (state.materialInsightsByProject[projectId] || {})[Number(item.id)] || null;
        var progress = projectId ? workActualProgress(projectId, sectionTitle, item) : { actual: 0, total: quantityPlanInfo(item).totalQty, unit: quantityPlanInfo(item).unit };
        var isDone = progress.total > 0 && progress.actual >= progress.total;
        return '<div class="material-row work-row estimate-compact-row' + (isDone ? ' work-row-done' : '') + (progress.actual > 0 && !isDone ? ' work-row-partial' : '') + (!isDone && riskKind ? (' work-row-' + riskKind) : '') + '" data-item-id="' + escapeHtml(item.id || '') + '">' +
            '<div class="work-row-main">' +
                '<div class="section-work-check work-list-check quantity-work-check estimate-compact-check' + (isDone ? ' is-done' : '') + (progress.actual > 0 && !isDone ? ' is-partial' : '') + '">' +
                    '<label class="quantity-check-main"><input type="checkbox" data-section-work-check data-item-id="' + escapeHtml(item.id || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-work-id="' + escapeHtml(item.id || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
                    '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '') + '</b></span></label>' +
                '</div>' +
            '</div>' +
            '<div class="work-row-side estimate-compact-side">' +
                renderCompactActualQtyEditor('work', projectId, sectionTitle, item, progress) +
                '<div class="material-chain-actions">' + renderInlineMarketButton(projectId, 'works') + renderCounterpartyPicker(projectId, item, insight, { empty: '\u041f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a', selected: insight && insight.selectedName ? insight.selectedName : '\u041f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a', none: '\u041d\u0435\u0442 \u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u043e\u0432' }, 'contractor') + '</div>' +
            '</div>' +
        '</div>';
    };


    function counterpartyFilterKey(kind) {
        return kind === 'contractor' || kind === 'works' || kind === 'work' ? 'contractor' : 'supplier';
    }

    function counterpartyFilterValue(projectId, kind) {
        var key = String(projectId || '') + ':' + counterpartyFilterKey(kind);
        return (state.materialCounterpartyFiltersByProject && state.materialCounterpartyFiltersByProject[key]) || 'all';
    }

    function setCounterpartyFilterValue(projectId, kind, value) {
        var key = String(projectId || '') + ':' + counterpartyFilterKey(kind);
        if (!state.materialCounterpartyFiltersByProject) state.materialCounterpartyFiltersByProject = {};
        state.materialCounterpartyFiltersByProject[key] = ['all', 'with', 'without'].indexOf(value) !== -1 ? value : 'all';
    }

    function selectedCounterpartyForItem(projectId, item, kind, insights) {
        var itemId = Number(item && item.id || 0);
        var insight = (insights || state.materialInsightsByProject[projectId] || {})[itemId] || null;
        var type = counterpartyFilterKey(kind);
        if (insight && insight.selectedByType && insight.selectedByType[type]) return insight.selectedByType[type];
        if (!insight || !Array.isArray(insight.options)) return null;
        return insight.options.find(function (option) {
            return option && option.candidateType === type && option.status === 'selected';
        }) || null;
    }

    function filterItemsByCounterparty(projectId, items, kind, insights) {
        var value = counterpartyFilterValue(projectId, kind);
        if (value === 'all') return items || [];
        return (items || []).filter(function (item) {
            var hasCounterparty = !!selectedCounterpartyForItem(projectId, item, kind, insights);
            return value === 'with' ? hasCounterparty : !hasCounterparty;
        });
    }

    function renderCounterpartyFilter(projectId, kind, items, insights) {
        var type = counterpartyFilterKey(kind);
        var total = (items || []).length;
        var withCounterparty = (items || []).filter(function (item) {
            return !!selectedCounterpartyForItem(projectId, item, type, insights);
        }).length;
        var withoutCounterparty = Math.max(0, total - withCounterparty);
        var value = counterpartyFilterValue(projectId, type);
        var nounWith = type === 'contractor' ? '\u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u043e\u043c' : '\u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u043c';
        var nounWithout = type === 'contractor' ? '\u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u0430' : '\u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430';
        return '<div class="counterparty-filter-bar">' +
            '<label><span>\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442</span>' +
                '<select data-counterparty-filter data-project-id="' + escapeHtml(projectId || '') + '" data-counterparty-kind="' + escapeHtml(type) + '">' +
                    '<option value="all"' + (value === 'all' ? ' selected' : '') + '>\u0412\u0441\u0435 \u043f\u043e\u0437\u0438\u0446\u0438\u0438 (' + escapeHtml(total) + ')</option>' +
                    '<option value="with"' + (value === 'with' ? ' selected' : '') + '>\u0421 ' + escapeHtml(nounWith) + ' (' + escapeHtml(withCounterparty) + ')</option>' +
                    '<option value="without"' + (value === 'without' ? ' selected' : '') + '>\u0411\u0435\u0437 ' + escapeHtml(nounWithout) + ' (' + escapeHtml(withoutCounterparty) + ')</option>' +
                '</select>' +
            '</label>' +
        '</div>';
    }


    function bindCounterpartyFilters(projectId) {
        qsa('[data-counterparty-filter]').forEach(function (select) {
            if (select.dataset.counterpartyFilterBound === '1') return;
            select.dataset.counterpartyFilterBound = '1';
            select.addEventListener('change', function () {
                var targetProjectId = Number(select.getAttribute('data-project-id') || projectId || 0);
                var kind = select.getAttribute('data-counterparty-kind') || 'supplier';
                setCounterpartyFilterValue(targetProjectId, kind, select.value);
                if (typeof rerenderProjectMaterialAndWorkViews === 'function') {
                    rerenderProjectMaterialAndWorkViews(targetProjectId);
                    return;
                }
                rerenderProjectMarketTab(targetProjectId, kind === 'contractor' ? 'works' : 'materials');
            });
        });
    }

    renderGroupedMaterials = function (groups, projectId, insights) {
        insights = insights || {};
        var sectionNumbers = buildEstimateSectionNumberMap((groups || []).map(function (group) {
            return canonicalEstimateSectionTitle(group && group.title);
        }));
        return '<div class="estimate-section-list">' + (groups || []).map(function (group, index) {
            var title = canonicalEstimateSectionTitle(group && group.title);
            var progress = materialProgress(projectId, group.items || []);
            var open = isEstimateSectionOpen(projectId, 'materials', title, index);
            var head = renderEstimateAccordionHead(
                projectId,
                'materials',
                title,
                index,
                renderBulkSectionCheckbox(projectId, title, 'materials', progress) + '<h3>' + escapeHtml(estimateDisplaySectionTitleWithNumber(title, index, sectionNumbers)) + '</h3>' + sectionProgressBadge('materials', progress, ''),
                '<span class="badge estimate-section-count">' + escapeHtml(String((group.items || []).length) + ' поз.') + '</span>',
                '',
                sectionProgressStrip({ total: 0, done: 0 }, progress, title)
            );
            return '<section class="estimate-section estimate-section-card estimate-section-collapsible' + (open ? ' is-open' : '') + '">' +
                head +
                renderEstimateSectionBody(open, (group.items || []).map(function (item) {
                    return materialRow(item, projectId, insights[Number(item.id)] || null);
                }).join('')) +
            '</section>';
        }).join('') + '</div>';
    };

    function estimateSectionTitleForCount(item) {
        return canonicalEstimateSectionTitle(item && (item.sectionTitle || item.section_title || item.stageTitle || item.sectionId));
    }


    function estimateTotalSectionCount(items, fallbackOrder) {
        var seen = {};
        var count = 0;
        (items || []).forEach(function (item) {
            var title = estimateSectionTitleForCount(item);
            if (seen[title]) return;
            seen[title] = 1;
            count += 1;
        });
        if (count) return count;
        (fallbackOrder || []).forEach(function (title) {
            title = String(title || '').trim() || 'Без раздела';
            if (seen[title]) return;
            seen[title] = 1;
            count += 1;
        });
        return count;
    }

    function marketSourceType(source) {
        var url = String(source && source.url || '').toLowerCase();
        return url.indexOf('avito') !== -1 ? 'avito' : (url ? 'other' : 'manual');
    }

    function marketCandidateTitle(row, source, kind) {
        var sourceTitle = String(source && source.title || '').trim();
        if (sourceTitle) return sourceTitle;
        return (kind === 'work' ? '\u041f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a: ' : '\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a: ') + String(row && row.title || '').trim();
    }


    function extractPhoneFromText(value) {
        var text = String(value || '');
        var match = text.match(/(?:\+7|8)[\s\-().]*\d{3}[\s\-().]*\d{3}[\s\-().]*\d{2}[\s\-().]*\d{2}/);
        return match ? match[0].replace(/\s+/g, ' ').trim() : '';
    }

    function renderMarketCreateButton(projectId, row, kind) {
        if (!canManageSuppliers()) return '';
        var source = Array.isArray(row.sources) && row.sources.length ? row.sources[0] : {};
        var type = kind === 'work' ? 'contractor' : 'supplier';
        var label = kind === 'work' ? '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u0430' : '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430';
        var sourceText = [source.phone || '', source.snippet || '', source.title || '', row.statusNote || ''].join(' ');
        return '<button class="ghost compact market-create-counterparty" type="button" data-market-create-offer data-project-id="' + escapeHtml(projectId) + '" data-market-tab="' + (kind === 'work' ? 'works' : 'materials') + '" data-candidate-type="' + escapeHtml(type) + '" data-candidate-name="' + escapeHtml(marketCandidateTitle(row, source, kind)) + '" data-estimate-item-id="' + escapeHtml(row.estimateItemId || '') + '" data-source-type="' + escapeHtml(marketSourceType(source)) + '" data-source-url="' + escapeHtml(source.url || '') + '" data-source-snippet="' + escapeHtml(source.snippet || '') + '" data-contact-phone="' + escapeHtml(source.phone || extractPhoneFromText(sourceText)) + '" data-price="' + escapeHtml(row.marketPrice == null ? (source.price || 0) : row.marketPrice) + '" data-qty="' + escapeHtml(row.plannedQty || 0) + '" data-unit="' + escapeHtml(row.unit || '') + '" data-notes="' + escapeHtml([row.title, source.snippet || '', source.domain || ''].filter(Boolean).join(' \u2022 ')) + '">' + label + '</button>';
    }


    function renderMarketTable(rows, kind, projectId) {
        if (!rows.length) {
            return '<div class="market-empty">\u041f\u043e \u044d\u0442\u043e\u043c\u0443 \u0440\u0430\u0437\u0434\u0435\u043b\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u0442\u0440\u043e\u043a \u0434\u043b\u044f \u0430\u043d\u0430\u043b\u0438\u0437\u0430.</div>';
        }
        return '<div class="market-table-wrap"><table class="market-table">' +
            '<thead><tr>' +
                '<th>\u041f\u043e\u0437\u0438\u0446\u0438\u044f</th>' +
                '<th>\u0421\u043c\u0435\u0442\u0430</th>' +
                '<th>\u0420\u044b\u043d\u043e\u043a</th>' +
                '<th>\u0420\u0430\u0437\u043d\u0438\u0446\u0430</th>' +
                '<th>\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438</th>' +
                '<th>\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435</th>' +
            '</tr></thead><tbody>' +
            rows.map(function (row) {
                var meta = [
                    row.sectionTitle || '',
                    row.plannedQty ? ('\u041e\u0431\u044a\u0435\u043c: ' + row.plannedQty + ' ' + (row.unit || '')) : '',
                    row.positionIndex ? ('\u2116 ' + row.positionIndex) : ''
                ].filter(Boolean).join(' \u2022 ');
                var marketCell = row.marketPrice == null
                    ? '<span class="market-missing">\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445</span>'
                    : '<strong>' + escapeHtml(money(row.marketPrice)) + '</strong>' +
                        (row.marketType ? '<small>' + escapeHtml(kind === 'work' ? '\u0420\u0430\u0431\u043e\u0442\u044b AutoBot' : '\u0420\u044b\u043d\u043e\u043a AutoBot') + '</small>' : '');
                return '<tr>' +
                    '<td><b>' + escapeHtml(row.title) + '</b><small>' + escapeHtml(meta || '\u0411\u0435\u0437 \u0440\u0430\u0437\u0434\u0435\u043b\u0430') + '</small></td>' +
                    '<td><strong>' + escapeHtml(money(row.estimateUnitPrice || 0)) + '</strong><small>\u0412\u0441\u0435\u0433\u043e: ' + escapeHtml(money(row.estimateTotal || 0)) + '</small></td>' +
                    '<td>' + marketCell + (row.statusNote ? '<small>' + escapeHtml(row.statusNote) + '</small>' : '') + '</td>' +
                    '<td>' + formatMarketDelta(row.deltaPerUnit) + '</td>' +
                    '<td>' + renderMarketSources(row) + '</td>' +
                    '<td>' + renderMarketCreateButton(projectId, row, kind) + '</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>';
    }


    function renderProjectMarketBlock(projectId, kind) {
        var cache = (state.marketAnalysisByProject[projectId] || {})[kind];
        if (!cache || cache.loading) {
            return '<div class="market-empty">\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u043c \u0430\u043d\u0430\u043b\u0438\u0437 \u0440\u044b\u043d\u043a\u0430 \u0438\u0437 AutoBot...</div>';
        }
        var rows = Array.isArray(cache.rows) ? cache.rows : [];
        if (cache.error && !rows.length) {
            return '<div class="market-empty">' + escapeHtml(marketErrorLabel(cache.error)) + '</div>';
        }
        var summary = cache.summary || {};
        return '<div class="execution-summary">' +
            stat('\u0412\u0441\u0435\u0433\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0439', String(summary.total || 0)) +
            stat('\u0415\u0441\u0442\u044c \u0440\u044b\u043d\u043e\u043a', String(summary.withMarketData || 0), summary.withMarketData ? '' : 'warn') +
            stat('\u0411\u0435\u0437 \u0440\u044b\u043d\u043a\u0430', String(summary.withoutMarketData || 0), summary.withoutMarketData ? 'warn' : '') +
        '</div>' + renderMarketTable(rows, kind, projectId);
    }

    function marketCounterpartyModal() {
        var modal = qs('[data-market-counterparty-modal]');
        if (modal) return modal;
        document.body.insertAdjacentHTML('beforeend',
            '<div class="market-counterparty-modal" data-market-counterparty-modal hidden>' +
                '<button class="market-counterparty-backdrop" type="button" data-market-counterparty-close aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c"></button>' +
                '<section class="market-counterparty-dialog" role="dialog" aria-modal="true" aria-label="\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442\u0430">' +
                    '<div class="card-head">' +
                        '<div><h3 data-market-counterparty-title>\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442\u0430</h3><span class="muted">\u0414\u0430\u043d\u043d\u044b\u0435 \u0432\u0437\u044f\u0442\u044b \u0438\u0437 \u0441\u0442\u0440\u043e\u043a\u0438 \u0430\u043d\u0430\u043b\u0438\u0437\u0430 \u0440\u044b\u043d\u043a\u0430.</span></div>' +
                        '<button class="ghost" type="button" data-market-counterparty-close>\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>' +
                    '</div>' +
                    '<form class="supplier-form market-counterparty-form" data-market-counterparty-form>' +
                        '<input type="hidden" name="project_id">' +
                        '<input type="hidden" name="estimate_item_id">' +
                        '<input type="hidden" name="candidate_type">' +
                        '<input type="hidden" name="market_tab">' +
                        '<input type="hidden" name="source_type">' +
                        '<input type="hidden" name="price">' +
                        '<input type="hidden" name="qty">' +
                        '<input type="hidden" name="unit">' +
                        '<label class="wide"><span>\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435</span><input name="name" required></label>' +
                        '<label><span>\u0422\u0435\u043b\u0435\u0444\u043e\u043d</span><input name="phone" placeholder="+7..."></label>' +
                        '<label><span>\u0421\u0430\u0439\u0442 / \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a</span><input name="source_url" placeholder="https://..."></label>' +
                        '<label class="wide"><span>\u0417\u0430\u043c\u0435\u0442\u043a\u0430</span><textarea name="notes"></textarea></label>' +
                        '<div class="form-error" data-market-counterparty-error></div>' +
                        '<button class="primary" type="submit" data-market-counterparty-submit>\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0438 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u0442\u044c</button>' +
                    '</form>' +
                '</section>' +
            '</div>'
        );
        modal = qs('[data-market-counterparty-modal]');
        qsa('[data-market-counterparty-close]', modal).forEach(function (button) {
            button.addEventListener('click', closeMarketCounterpartyModal);
        });
        var form = qs('[data-market-counterparty-form]', modal);
        form.addEventListener('submit', submitMarketCounterpartyForm);
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && modal && !modal.hidden) closeMarketCounterpartyModal();
        });
        return modal;
    }
    function closeMarketCounterpartyModal() {
        var modal = qs('[data-market-counterparty-modal]');
        if (!modal) return;
        modal.hidden = true;
        modal.removeAttribute('data-open');
    }

    function openMarketCounterpartyModal(button) {
        var modal = marketCounterpartyModal();
        var form = qs('[data-market-counterparty-form]', modal);
        var title = qs('[data-market-counterparty-title]', modal);
        var type = button.getAttribute('data-candidate-type') === 'contractor' ? 'contractor' : 'supplier';
        if (title) title.textContent = type === 'contractor' ? '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u0430' : '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430';
        form.project_id.value = button.getAttribute('data-project-id') || '';
        form.estimate_item_id.value = button.getAttribute('data-estimate-item-id') || '';
        form.candidate_type.value = type;
        form.market_tab.value = button.getAttribute('data-market-tab') || (type === 'contractor' ? 'works' : 'materials');
        form.source_type.value = button.getAttribute('data-source-type') || 'manual';
        form.price.value = button.getAttribute('data-price') || '0';
        form.qty.value = button.getAttribute('data-qty') || '0';
        form.unit.value = button.getAttribute('data-unit') || '';
        form.name.value = button.getAttribute('data-candidate-name') || '';
        form.phone.value = button.getAttribute('data-contact-phone') || extractPhoneFromText([
            button.getAttribute('data-candidate-name') || '',
            button.getAttribute('data-source-snippet') || '',
            button.getAttribute('data-notes') || ''
        ].join(' '));
        form.source_url.value = button.getAttribute('data-source-url') || '';
        form.notes.value = button.getAttribute('data-notes') || '';
        var error = qs('[data-market-counterparty-error]', modal);
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        modal.hidden = false;
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            form.name.focus();
            form.name.select();
        });
    }

    function submitMarketCounterpartyForm(event) {
        event.preventDefault();
        var form = event.currentTarget;
        var error = qs('[data-market-counterparty-error]', form);
        var submit = qs('[data-market-counterparty-submit]', form);
        var projectId = Number(form.project_id.value || 0);
        if (!projectId) return;
        if (error) error.classList.remove('active');
        if (submit) submit.disabled = true;
        api('/api/projects/' + projectId + '/market-counterparty', {
            method: 'POST',
            body: JSON.stringify({
                candidate_type: form.candidate_type.value,
                name: form.name.value.trim(),
                phone: form.phone.value.trim(),
                source_url: form.source_url.value.trim(),
                source_type: form.source_type.value,
                estimate_item_id: form.estimate_item_id.value,
                price: Number(form.price.value || 0),
                qty: Number(form.qty.value || 0),
                unit: form.unit.value.trim(),
                notes: form.notes.value.trim()
            })
        }).then(function (data) {
            if (data && data.company) {
                state.companies = (state.companies || []).filter(function (company) {
                    return Number(company.id) !== Number(data.company.id);
                }).concat([data.company]);
                state.companiesAllLoaded = false;
            }
            delete state.materialInsightsByProject[projectId];
            closeMarketCounterpartyModal();
            loadMaterialInsights(projectId, function () {
                if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    if (typeof rerenderProjectMaterialAndWorkViews === 'function') rerenderProjectMaterialAndWorkViews(projectId);
                    rerenderProjectMarketTab(projectId, form.market_tab.value || (form.candidate_type.value === 'contractor' ? 'works' : 'materials'));
                }
            });
        }).catch(function (err) {
            if (error) {
                error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось создать контрагента';
                error.classList.add('active');
            }
        }).finally(function () {
            if (submit) submit.disabled = false;
        });
    }

    function bindMarketCreateButtons(projectId) {
        qsa('[data-market-create-offer]').forEach(function (button) {
            if (button.dataset.marketCreateBound === '1') return;
            button.dataset.marketCreateBound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                openMarketCounterpartyModal(button);
            });
        });
    }

    var baseBindProjectMarketTogglesCounterparties = bindProjectMarketToggles;
    bindProjectMarketToggles = function (projectId) {
        baseBindProjectMarketTogglesCounterparties(projectId);
        bindMarketCreateButtons(projectId);
        bindCounterpartyFilters(projectId);
        bindEstimateSectionToggles(projectId);
    };

    var baseBindProjectChainActionsCounterparties = bindProjectChainActions;
    bindProjectChainActions = function () {
        baseBindProjectChainActionsCounterparties();
        if (state.selectedProject && state.selectedProject.id) bindCounterpartyFilters(state.selectedProject.id);
        if (state.selectedProject && state.selectedProject.id) bindEstimateSectionToggles(state.selectedProject.id);
    };

    function materialScheduleForProject(projectId) {
        state.materialScheduleByProject = state.materialScheduleByProject || {};
        return state.materialScheduleByProject[String(projectId)] || null;
    }

    function setMaterialScheduleForProject(projectId, schedule) {
        state.materialScheduleByProject = state.materialScheduleByProject || {};
        state.materialScheduleVersionByProject = state.materialScheduleVersionByProject || {};
        var key = String(projectId);
        state.materialScheduleVersionByProject[key] = (state.materialScheduleVersionByProject[key] || 0) + 1;
        if (schedule && typeof schedule === 'object') schedule.__renderVersion = state.materialScheduleVersionByProject[key];
        state.materialScheduleByProject[key] = normalizeMaterialSchedule(schedule) || null;
    }

    function normalizeMaterialSchedule(schedule) {
        if (!schedule || !Array.isArray(schedule.items)) return schedule;
        schedule.items = schedule.items.map(function (item) {
            if (!item.deadlineDate && item.deliveryTargetDate) item.deadlineDate = item.deliveryTargetDate;
            if (!item.purchaseStartDate && item.purchaseByDate) item.purchaseStartDate = item.purchaseByDate;
            if (!item.purchaseByDate && item.purchaseStartDate) item.purchaseByDate = item.purchaseStartDate;
            return item;
        });
        return schedule;
    }

    function fallbackMaterialLeadDays(item) {
        var text = String([item && item.title, item && item.notes, item && item.unit].filter(Boolean).join(' ')).toLowerCase();
        var base = 7;
        if (/фасад|окн|двер|жалюз|витраж/.test(text)) base = 16;
        else if (/электр|кабел|щит|свет|видео|trassir|ip/.test(text)) base = 12;
        else if (/сантех|труб|вод|канал|отоп/.test(text)) base = 12;
        else if (/вент|кондиц|дымо/.test(text)) base = 16;
        else if (/кров|крыша|гидро/.test(text)) base = 10;
        else if (/бетон|арматур|стяж/.test(text)) base = 6;
        else if (/кирпич|блок|клад/.test(text)) base = 7;
        var amount = Number(item && item.plannedQty || 0) * Number(item && item.plannedPrice || 0);
        if (amount >= 250000) base += 1;
        if (amount >= 700000) base += 1;
        if (amount >= 1500000) base += 1;
        return Math.min(24, base);
    }

    function buildClientMaterialSchedule(projectId, materials) {
        var today = APP_TODAY;
        var warningDays = 5;
        var rangeDates = [today];
        var summary = { total: 0, purchased: 0, overdue: 0, warning: 0, neutral: 0, unscheduled: 0 };
        var items = (materials || []).filter(function (item) {
            return String(item.itemKind || 'material').toLowerCase() !== 'work';
        }).map(function (item) {
            var leadDays = Number(item.deliveryDays);
            if (!Number.isFinite(leadDays)) leadDays = fallbackMaterialLeadDays(item);
            leadDays = Math.max(0, Math.min(90, Math.round(leadDays)));
            var deadlineDate = item.needByDate || item.stageStartDate || item.stageEndDate || '';
            var purchaseStart = deadlineDate ? isoDateAdd(deadlineDate, -leadDays) : '';
            var daysUntilPurchase = purchaseStart ? signedDaysBetween(today, purchaseStart) : null;
            var daysUntilDeadline = deadlineDate ? signedDaysBetween(today, deadlineDate) : null;
            var missingQty = Number(item.missingQty || 0);
            var status = 'neutral';
            var statusLabel = 'В плане';
            var color = 'green';
            if (missingQty <= 0) {
                status = 'purchased';
                statusLabel = 'Закуплено';
                color = 'done';
                summary.purchased += 1;
            } else if (!deadlineDate) {
                status = 'unscheduled';
                statusLabel = 'Нет даты закупки';
                color = 'muted';
                summary.unscheduled += 1;
            } else if (daysUntilPurchase < 0) {
                status = 'overdue';
                statusLabel = 'Просрочено';
                color = 'red';
                summary.overdue += 1;
            } else if (daysUntilPurchase <= warningDays) {
                status = 'warning';
                statusLabel = 'Пора платить';
                color = 'yellow';
                summary.warning += 1;
            } else {
                summary.neutral += 1;
            }
            [purchaseStart, deadlineDate].filter(Boolean).forEach(function (dateValue) { rangeDates.push(dateValue); });
            summary.total += 1;
            return {
                id: item.id,
                projectId: projectId,
                title: item.title || '',
                unit: item.unit || '',
                plannedQty: Number(item.plannedQty || 0),
                plannedPrice: Number(item.plannedPrice || 0),
                purchasedQty: Number(item.purchasedQty || 0),
                receivedQty: Number(item.receivedQty || 0),
                missingQty: missingQty,
                purchaseProgress: Number(item.purchaseProgress || 0),
                status: status,
                statusLabel: statusLabel,
                color: color,
                purchaseStartDate: purchaseStart || null,
                purchaseByDate: purchaseStart || null,
                alertStartDate: purchaseStart ? isoDateAdd(purchaseStart, -warningDays) : null,
                deadlineDate: deadlineDate || null,
                deliveryTargetDate: deadlineDate || null,
                deliveryLeadDays: leadDays,
                estimatedDeliveryDays: fallbackMaterialLeadDays(item),
                warningDays: warningDays,
                daysUntilPurchase: daysUntilPurchase,
                daysUntilDeadline: daysUntilDeadline,
                sectionTitle: item.sectionTitle || '',
                relatedWork: {
                    stageId: item.stageId,
                    title: item.stageTitle || item.sectionTitle || '',
                    startDate: item.stageStartDate,
                    endDate: item.stageEndDate
                },
                supplier: null,
                materialUrl: '/app/projects?openProject=' + projectId + '&tab=materials&materialId=' + item.id
            };
        }).sort(function (a, b) {
            return String(a.deadlineDate || '9999-12-31').localeCompare(String(b.deadlineDate || '9999-12-31')) || String(a.purchaseStartDate || '9999-12-31').localeCompare(String(b.purchaseStartDate || '9999-12-31')) || String(a.title).localeCompare(String(b.title));
        });
        rangeDates.sort();
        var start = rangeDates[0] || today;
        var end = rangeDates[rangeDates.length - 1] || isoDateAdd(start, 7);
        if (start === end) end = isoDateAdd(start, 7);
        return {
            projectId: projectId,
            today: today,
            settings: { warningDays: warningDays, neutralDays: 7 },
            range: { start: start, end: end },
            summary: summary,
            items: items,
            fallback: true
        };
    }

    function loadMaterialSchedule(projectId, callback, force) {
        if (!projectId || hasRole('customer')) {
            if (callback) callback(null);
            return;
        }
        state.materialScheduleByProject = state.materialScheduleByProject || {};
        state.materialScheduleLoadingByProject = state.materialScheduleLoadingByProject || {};
        state.materialScheduleCallbacksByProject = state.materialScheduleCallbacksByProject || {};

        var key = String(projectId);
        var cached = materialScheduleForProject(projectId);
        if (!force && cached) {
            if (callback) callback(cached);
            return;
        }
        if (callback) {
            state.materialScheduleCallbacksByProject[key] = state.materialScheduleCallbacksByProject[key] || [];
            state.materialScheduleCallbacksByProject[key].push(callback);
        }
        if (state.materialScheduleLoadingByProject[key]) return;
        if (force) delete state.materialScheduleByProject[key];
        state.materialScheduleLoadingByProject[key] = true;

        function finish(schedule) {
            state.materialScheduleLoadingByProject[key] = false;
            var callbacks = state.materialScheduleCallbacksByProject[key] || [];
            delete state.materialScheduleCallbacksByProject[key];
            callbacks.forEach(function (fn) {
                try { fn(schedule || null); } catch (callbackError) {}
            });
        }
        api('/api/projects/' + encodeURIComponent(projectId) + '/material-schedule' + (force ? '?fresh=1' : '')).then(function (schedule) {
            setMaterialScheduleForProject(projectId, schedule || { items: [] });
            finish(materialScheduleForProject(projectId));
        }).catch(function (err) {
            if (err && err.status === 404) {
                api('/api/projects/' + encodeURIComponent(projectId) + '/materials-summary').then(function (data) {
                    var schedule = buildClientMaterialSchedule(projectId, Array.isArray(data && data.items) ? data.items : []);
                    setMaterialScheduleForProject(projectId, schedule);
                    finish(materialScheduleForProject(projectId));
                }).catch(function (fallbackErr) {
                    var fallbackCode = fallbackErr && fallbackErr.status ? (' HTTP ' + fallbackErr.status) : '';
                    var fallbackReason = fallbackErr && fallbackErr.payload && fallbackErr.payload.error ? (': ' + fallbackErr.payload.error) : '';
                    setMaterialScheduleForProject(projectId, { error: 'Не удалось загрузить график материалов' + fallbackCode + fallbackReason + '.', items: [] });
                    finish(materialScheduleForProject(projectId));
                });
                return;
            }
            var code = err && err.status ? (' HTTP ' + err.status) : '';
            var reason = err && err.payload && err.payload.error ? (': ' + err.payload.error) : '';
            setMaterialScheduleForProject(projectId, { error: 'Не удалось загрузить график материалов' + code + reason + '.', items: [] });
            finish(materialScheduleForProject(projectId));
        });
    }

    function materialScheduleStatusClass(item) {
        var color = String(item && item.color || '').toLowerCase();
        if (color === 'red' || item.status === 'overdue') return 'is-overdue';
        if (color === 'yellow' || item.status === 'warning') return 'is-warning';
        if (item.status === 'purchased' || color === 'done') return 'is-done';
        if (item.status === 'unscheduled' || color === 'muted') return 'is-muted';
        return 'is-neutral';
    }

    function materialScheduleStatusBadge(item) {
        if (!item) return '';
        if (item.status === 'overdue') return 'danger';
        if (item.status === 'warning') return 'warn';
        if (item.status === 'purchased' || item.status === 'in_transit') return 'success';
        return '';
    }

    function materialScheduleDayText(item) {
        var days = item && item.daysUntilPurchase;
        if (days == null || days === '') return 'Дата закупки не указана';
        days = Number(days);
        if (!Number.isFinite(days)) return 'Дата закупки не указана';
        if (days < 0) return 'Просрочено на ' + Math.abs(days) + ' дн.';
        if (days === 0) return 'Закупить сегодня';
        return 'До закупки ' + days + ' дн.';
    }

    function materialScheduleRange(schedule) {
        var range = schedule && schedule.range ? schedule.range : {};
        var dates = [range.start, range.end, APP_TODAY].filter(Boolean).sort();
        var start = dates[0] || APP_TODAY;
        var end = dates[dates.length - 1] || isoDateAdd(start, 7);
        var totalDays = Math.max(1, scheduleDayDiff(start, end) + 1);
        return { start: start, end: end, totalDays: totalDays };
    }

    function materialSchedulePercent(range, iso) {
        if (!iso) return 0;
        var offset = Math.max(0, Math.min(range.totalDays - 1, scheduleDayDiff(range.start, iso)));
        return range.totalDays === 1 ? 0 : (offset / (range.totalDays - 1)) * 100;
    }

    function renderMaterialScheduleScale(range) {
        return '<div class="material-schedule-scale">' +
            '<span style="left:0%"><b>' + escapeHtml(formatDisplayDate(range.start)) + '</b></span>' +
            '<i style="left:' + materialSchedulePercent(range, APP_TODAY) + '%"></i>' +
            '<span style="left:100%"><b>' + escapeHtml(formatDisplayDate(range.end)) + '</b></span>' +
        '</div>';
    }

    function renderMaterialScheduleTimeline(projectId) {
        if (!projectId || hasRole('customer')) return '';
        var schedule = materialScheduleForProject(projectId);
        if (!schedule) {
            return '<section class="card material-schedule-card"><div class="card-head"><div><h3>График материалов</h3><span class="muted">Контроль закупочных дедлайнов.</span></div></div><div class="section-schedule-empty"></div></section>';
        }
        if (schedule.error) {
            return '<section class="card material-schedule-card"><div class="card-head"><div><h3>График материалов</h3><span class="muted">Контроль закупочных дедлайнов.</span></div></div><div class="section-schedule-empty">' + escapeHtml(schedule.error) + '</div></section>';
        }
        var items = Array.isArray(schedule.items) ? schedule.items : [];
        var summary = schedule.summary || {};
        if (!items.length) {
            return '<section class="card material-schedule-card"><div class="card-head"><div><h3>График материалов</h3><span class="muted">Материалы подтягиваются из вкладки материалов объекта.</span></div></div><div class="section-schedule-empty">Материалы по объекту пока не загружены.</div></section>';
        }
        var range = materialScheduleRange(schedule);
        return '<section class="card material-schedule-card" data-material-schedule="' + escapeHtml(projectId) + '">' +
            '<div class="card-head"><div><h3>График материалов</h3><span class="muted">Метка стоит в дату, к которой надо купить. Доставка учитывается отдельным запасом.</span></div></div>' +
            '<div class="execution-summary material-schedule-summary">' +
                stat('Всего', String(summary.total || items.length)) +
                stat('Просрочено', String(summary.overdue || 0), summary.overdue ? 'danger' : '') +
                stat('Пора платить', String(summary.warning || 0), summary.warning ? 'warn' : '') +
                stat('Закуплено', String(summary.purchased || 0), summary.purchased ? 'success' : '') +
                stat('Сегодня', schedule.today || APP_TODAY) +
            '</div>' +
            '<div class="material-schedule-legend"><span><i class="is-neutral"></i>В плане</span><span><i class="is-warning"></i>Внимание</span><span><i class="is-overdue"></i>Просрочено</span><span><i class="is-done"></i>Закуплено</span></div>' +
            renderMaterialScheduleScale(range) +
            '<div class="material-schedule-list">' + items.map(function (item) {
                var pointLeft = materialSchedulePercent(range, item.purchaseByDate);
                var deliveryLeft = materialSchedulePercent(range, item.deliveryTargetDate);
                var lineLeft = Math.min(pointLeft, deliveryLeft);
                var lineWidth = Math.abs(deliveryLeft - pointLeft);
                var meta = [
                    item.purchaseByDate ? ('купить до ' + formatDisplayDate(item.purchaseByDate)) : 'без даты закупки',
                    item.deliveryTargetDate ? ('доставка к ' + formatDisplayDate(item.deliveryTargetDate)) : '',
                    'запас ' + (item.deliveryLeadDays || 0) + ' дн.',
                    item.relatedWork && item.relatedWork.title ? ('работа: ' + item.relatedWork.title) : ''
                ].filter(Boolean).join(' • ');
                return '<div class="material-schedule-row">' +
                    '<div class="material-schedule-meta"><b>' + escapeHtml(item.title || '') + '</b><small>' + escapeHtml(meta) + '</small></div>' +
                    '<div class="material-schedule-track">' +
                        (item.deliveryTargetDate && item.purchaseByDate ? '<span class="material-schedule-lead" style="left:' + lineLeft + '%;width:' + Math.max(lineWidth, 1) + '%"></span>' : '') +
                        '<button class="material-schedule-point ' + materialScheduleStatusClass(item) + '" type="button" style="left:' + pointLeft + '%" data-material-schedule-item data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(item.id || '') + '" aria-label="' + escapeHtml((item.title || '') + ': ' + (item.statusLabel || '')) + '"><span>' + escapeHtml(item.statusLabel || '') + '</span></button>' +
                    '</div>' +
                    '<div class="material-schedule-side"><span class="badge ' + materialScheduleStatusBadge(item) + '">' + escapeHtml(materialScheduleDayText(item)) + '</span></div>' +
                '</div>';
            }).join('') + '</div>' +
        '</section>';
    }

    function materialScheduleView(projectId) {
        state.materialScheduleViewByProject = state.materialScheduleViewByProject || {};
        var key = String(projectId || '');
        if (!state.materialScheduleViewByProject[key]) {
            state.materialScheduleViewByProject[key] = { mode: 'month', cursor: APP_TODAY.slice(0, 7) + '-01' };
        }
        return state.materialScheduleViewByProject[key];
    }

    function setMaterialScheduleView(projectId, patch) {
        var view = materialScheduleView(projectId);
        Object.keys(patch || {}).forEach(function (key) { view[key] = patch[key]; });
    }

    function isoMonthStart(iso) {
        return String(iso || APP_TODAY).slice(0, 7) + '-01';
    }

    function isoMonthAdd(iso, months) {
        var start = isoMonthStart(iso);
        var year = Number(start.slice(0, 4));
        var month = Number(start.slice(5, 7));
        if (!Number.isFinite(year) || !Number.isFinite(month)) return isoMonthStart(APP_TODAY);
        var date = new Date(Date.UTC(year, month - 1 + Number(months || 0), 1));
        return date.toISOString().slice(0, 10);
    }

    function isoWeekStart(iso) {
        var base = Date.parse(String(iso || APP_TODAY) + 'T00:00:00Z');
        if (Number.isNaN(base)) return APP_TODAY;
        var date = new Date(base);
        var day = date.getUTCDay() || 7;
        return new Date(base - (day - 1) * 86400000).toISOString().slice(0, 10);
    }

    function isoMonthDays(iso) {
        var start = isoMonthStart(iso);
        var year = Number(start.slice(0, 4));
        var month = Number(start.slice(5, 7));
        var first = new Date(Date.UTC(year, month - 1, 1));
        var last = new Date(Date.UTC(year, month, 0));
        var gridStart = isoWeekStart(first.toISOString().slice(0, 10));
        var gridEnd = isoDateAdd(isoWeekStart(last.toISOString().slice(0, 10)), 6);
        var days = [];
        for (var cursor = gridStart, safetyLimit = 0; cursor <= gridEnd && safetyLimit < 45; cursor = materialScheduleSafeIsoAdd(cursor, 1), safetyLimit += 1) {
            if (!materialScheduleIsoDate(cursor)) break;
            days.push(cursor);
        }
        return days;
    }

    function materialCalendarDays(projectId) {
        var view = materialScheduleView(projectId);
        if (view.mode === 'week') {
            var start = isoWeekStart(view.cursor || APP_TODAY);
            return [0, 1, 2, 3, 4, 5, 6].map(function (offset) { return materialScheduleSafeIsoAdd(start, offset) || APP_TODAY; });
        }
        return isoMonthDays(view.cursor || APP_TODAY);
    }

    function materialCalendarTitle(projectId) {
        var view = materialScheduleView(projectId);
        var days = materialCalendarDays(projectId).filter(materialScheduleIsoDate);
        if (!days.length) days = [APP_TODAY];
        if (view.mode === 'week') return formatDisplayDate(days[0]) + ' - ' + formatDisplayDate(days[6]);
        return formatDisplayDate(isoMonthStart(view.cursor || APP_TODAY)).slice(3);
    }

    function materialCalendarMove(projectId, direction) {
        var view = materialScheduleView(projectId);
        var normalizedDirection = direction < 0 ? -1 : 1;
        var next = view.mode === 'week'
            ? (materialScheduleSafeIsoAdd(isoWeekStart(view.cursor || APP_TODAY), normalizedDirection * 7) || APP_TODAY)
            : isoMonthAdd(view.cursor || APP_TODAY, normalizedDirection);
        setMaterialScheduleView(projectId, { cursor: view.mode === 'week' ? isoWeekStart(next) : isoMonthStart(next) });
    }

    function materialScheduleQtyTitle(item) {
        return finalSectionSummaryNumber(item.plannedQty || 0) + ' ' + (item.unit || 'ед.') + ' ' + (item.title || '');
    }

    function materialCalendarItemsForDay(items, day, field) {
        return (items || []).filter(function (item) { return String(item && item[field] || '') === day; });
    }

    function materialCalendarHasWindow(items, day) {
        return (items || []).some(function (item) {
            if (item.status === 'purchased' || item.status === 'in_transit') return false;
            if (!item.purchaseStartDate || !item.deadlineDate) return false;
            return item.purchaseStartDate <= day && item.deadlineDate >= day;
        });
    }

    function renderMaterialCalendarCard(item, compact) {
        return '<div class="material-calendar-card ' + materialScheduleStatusClass(item) + (compact ? ' is-start' : '') + '">' +
            '<b>' + escapeHtml(item && item.title || '') + '</b>' +
        '</div>';
    }

    function renderMaterialCalendarOverflow(count) {
        return count > 0 ? '<div class="calendar-more-badge">+' + escapeHtml(String(count)) + ' еще</div>' : '';
    }

    function materialScheduleIsoDate(value) {
        var text = String(value || '').trim();
        var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return '';
        var year = Number(match[1]);
        var month = Number(match[2]);
        var day = Number(match[3]);
        var date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
        return text;
    }

    function materialScheduleSafeIsoAdd(isoDate, days) {
        isoDate = materialScheduleIsoDate(isoDate);
        if (!isoDate) return '';
        var date = new Date(isoDate + 'T00:00:00Z');
        date.setUTCDate(date.getUTCDate() + Number(days || 0));
        var next = date.toISOString().slice(0, 10);
        return materialScheduleIsoDate(next);
    }

    function materialScheduleIsUnbought(item) {
        if (!item || item.status === 'purchased' || item.status === 'in_transit') return false;
        if (item.missingQty != null && Number(item.missingQty || 0) <= 0) return false;
        return true;
    }

    function materialScheduleNeedsAttention(item, dateValue) {
        dateValue = materialScheduleIsoDate(dateValue);
        if (!dateValue || !materialScheduleIsUnbought(item)) return false;
        var warningDays = Number(item.warningDays);
        if (!Number.isFinite(warningDays)) warningDays = 5;
        warningDays = Math.max(0, Math.min(30, Math.round(warningDays)));
        return dateValue <= (materialScheduleSafeIsoAdd(APP_TODAY, warningDays) || APP_TODAY);
    }

    function materialScheduleNeedsCriticalPing(item, day) {
        if (!materialScheduleIsUnbought(item)) return false;
        var status = String(item && item.status || '').trim().toLowerCase();
        var color = String(item && item.color || '').trim().toLowerCase();
        return status === 'overdue' || status === 'warning' || color === 'red' || color === 'yellow';
    }

    function materialScheduleAlertIsoDate(value) {
        var text = String(value || '').trim();
        var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return '';
        var year = Number(match[1]);
        if (!Number.isFinite(year) || year < 2026 || year > 2028) return '';
        return materialScheduleIsoDate(text);
    }

    function materialSchedulePlanningIsoDate(value) {
        var iso = materialScheduleIsoDate(value);
        if (!iso) return '';
        var year = Number(iso.slice(0, 4));
        if (!Number.isFinite(year) || year < 2026 || year > 2028) return '';
        return iso;
    }

    function materialScheduleHasBadPlanningYear(item) {
        return [item && item.purchaseStartDate, item && item.purchaseByDate, item && item.deadlineDate, item && item.deliveryTargetDate].some(function (value) {
            var text = String(value || '').trim();
            if (!text) return false;
            var match = text.match(/^(\d{4})-\d{2}-\d{2}$/);
            if (!match) return false;
            var year = Number(match[1]);
            return !Number.isFinite(year) || year < 2026 || year > 2028;
        });
    }

    function materialScheduleCalendarModel(projectId, schedule) {
        var view = materialScheduleView(projectId);
        var cacheKey = [view.mode, view.cursor, schedule && schedule.__renderVersion || 0].join('|');
        if (schedule && schedule.__calendarModel && schedule.__calendarModel.key === cacheKey) return schedule.__calendarModel;
        var days = materialCalendarDays(projectId).filter(materialScheduleIsoDate);
        if (!days.length) days = [APP_TODAY];
        var daySet = {};
        var deadlinesByDay = {};
        var startsByDay = {};
        var hasWindowByDay = {};
        var navAlerts = { prev: false, next: false };
        var visibleStart = days[0];
        var visibleEnd = days[days.length - 1] || visibleStart;
        days.forEach(function (day) {
            daySet[day] = true;
            deadlinesByDay[day] = [];
            startsByDay[day] = [];
        });
        (schedule && Array.isArray(schedule.items) ? schedule.items : []).forEach(function (item) {
            if (materialScheduleHasBadPlanningYear(item)) return;
            var purchaseStartDate = materialSchedulePlanningIsoDate(item && item.purchaseStartDate);
            var deadlineDate = materialSchedulePlanningIsoDate(item && item.deadlineDate);
            if (purchaseStartDate && deadlineDate) {
                var fullSpan = scheduleDayDiff(purchaseStartDate, deadlineDate);
                if (fullSpan > 45) {
                    deadlineDate = materialScheduleSafeIsoAdd(purchaseStartDate, 30) || deadlineDate;
                    item.deadlineDate = deadlineDate;
                    item.deliveryTargetDate = deadlineDate;
                }
            }
            if (deadlineDate && daySet[deadlineDate]) deadlinesByDay[deadlineDate].push(item);
            if (purchaseStartDate && daySet[purchaseStartDate]) startsByDay[purchaseStartDate].push(item);
            var alertStatus = String(item && item.status || '').trim().toLowerCase();
            var isAlertClosed = alertStatus === 'purchased' ||
                alertStatus === 'in_transit' ||
                alertStatus === 'delivered' ||
                alertStatus === 'completed' ||
                Boolean(item && (item.is_completed || item.isCompleted || item.completed));
            if (!isAlertClosed) {
                var alertPurchaseStartDate = materialScheduleAlertIsoDate(item && item.purchaseStartDate);
                var alertDeadlineDate = materialScheduleAlertIsoDate(item && item.deadlineDate);
                if (alertPurchaseStartDate && alertDeadlineDate) {
                    [alertPurchaseStartDate, alertDeadlineDate].forEach(function (dateValue) {
                        if (!materialScheduleNeedsAttention(item, dateValue)) return;
                        if (dateValue < visibleStart) navAlerts.prev = true;
                        if (dateValue > visibleEnd) navAlerts.next = true;
                    });
                }
            }
            if (!materialScheduleIsUnbought(item) || !purchaseStartDate || !deadlineDate) return;
            if (purchaseStartDate > deadlineDate) return;
            if (scheduleDayDiff(purchaseStartDate, deadlineDate) > 45) {
                deadlineDate = materialScheduleSafeIsoAdd(purchaseStartDate, 30) || deadlineDate;
            }
            var cursor = purchaseStartDate < days[0] ? days[0] : purchaseStartDate;
            var end = deadlineDate > days[days.length - 1] ? days[days.length - 1] : deadlineDate;
            var safetyLimit = 0;
            while (cursor <= end) {
                if (daySet[cursor]) hasWindowByDay[cursor] = true;
                cursor = materialScheduleSafeIsoAdd(cursor, 1);
                safetyLimit += 1;
                if (!cursor || safetyLimit >= 31) break;
            }
        });
        var model = {
            key: cacheKey,
            view: view,
            days: days,
            deadlinesByDay: deadlinesByDay,
            startsByDay: startsByDay,
            hasWindowByDay: hasWindowByDay,
            navAlerts: navAlerts,
            monthPrefix: String(view.cursor || APP_TODAY).slice(0, 7)
        };
        if (schedule && typeof schedule === 'object') schedule.__calendarModel = model;
        return model;
    }

    function renderMaterialCalendarCell(day, projectId, model) {
        var viewMode = model.view.mode;
        var deadlineItems = model.deadlinesByDay[day] || [];
        var startItems = model.startsByDay[day] || [];
        var allItems = startItems.concat(deadlineItems);
        var previewItems = allItems.slice(0, 2);
        var isOtherMonth = viewMode === 'month' && day.slice(0, 7) !== model.monthPrefix;
        var weekday = new Date(day + 'T00:00:00Z').getUTCDay();
        var isWeekend = weekday === 0 || weekday === 6;
        var hasCriticalPing = allItems.some(function (item) { return materialScheduleNeedsCriticalPing(item, day); });
        var selectedMap = state.materialScheduleSelectedDayByProject || {};
        var cls = 'material-calendar-day' + (day === APP_TODAY ? ' is-today' : '') + (String(selectedMap[projectId] || '') === day ? ' is-selected' : '') + (isWeekend ? ' is-weekend' : '') + (isOtherMonth ? ' is-outside' : '') + (model.hasWindowByDay[day] ? ' has-window' : '') + (allItems.length ? ' has-materials' : '') + (hasCriticalPing ? ' has-critical-materials' : '');
        var previewHtml = previewItems.length ? '<div class="material-calendar-preview">' +
            previewItems.map(function (item) { return renderMaterialCalendarCard(item, true); }).join('') +
            renderMaterialCalendarOverflow(allItems.length - previewItems.length) +
        '</div>' : '';
        return '<div class="' + cls + '" data-material-calendar-day="' + escapeHtml(day) + '" data-project-id="' + escapeHtml(projectId) + '">' +
            '<div class="material-calendar-date"><b class="calendar-day-number ' + (day === APP_TODAY ? 'is-today' : '') + '">' + escapeHtml(String(Number(day.slice(8, 10)))) + '</b><span>' + escapeHtml(formatDisplayDate(day)) + '</span></div>' +
            previewHtml +
        '</div>';
    }

    function renderMaterialScheduleTimeline(projectId) {
        if (!projectId || hasRole('customer')) return '';
        var schedule = materialScheduleForProject(projectId);
        if (!schedule) {
            return '<section class="card material-schedule-card"><div class="card-head"><div><h3>Календарь закупок</h3><span class="muted">Контроль закупочных дедлайнов.</span></div></div><div class="section-schedule-empty"></div></section>';
        }
        if (schedule.error) {
            return '<section class="card material-schedule-card"><div class="card-head"><div><h3>Календарь закупок</h3><span class="muted">Контроль закупочных дедлайнов.</span></div></div><div class="section-schedule-empty">' + escapeHtml(schedule.error) + '</div></section>';
        }
        var items = Array.isArray(schedule.items) ? schedule.items : [];
        var summary = schedule.summary || {};
        if (!items.length) {
            return '<section class="card material-schedule-card"><div class="card-head"><div><h3>Календарь закупок</h3><span class="muted">Материалы подтягиваются из вкладки материалов объекта.</span></div></div><div class="section-schedule-empty">Материалы по объекту пока не загружены.</div></section>';
        }
        var view = materialScheduleView(projectId);
        var days = materialCalendarDays(projectId);
        var model = materialScheduleCalendarModel(projectId, schedule);
        var weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        var alertTitle = 'Внимание: в скрытом периоде есть некупленные материалы!';
        var prevAlertClass = model.navAlerts && model.navAlerts.prev ? ' arrow-alert' : '';
        var nextAlertClass = model.navAlerts && model.navAlerts.next ? ' arrow-alert' : '';
        var toggleMode = view.mode === 'week' ? 'month' : 'week';
        var toggleText = view.mode === 'week' ? '↕ Развернуть в месяц' : '↕ Свернуть в неделю';
        return '<section class="card material-schedule-card" data-material-schedule="' + escapeHtml(projectId) + '">' +
            '<div class="card-head"><div><h3>Календарь закупок</h3></div></div>' +
            '<div class="execution-summary material-schedule-summary">' +
                stat('Всего', String(summary.total || items.length)) +
                stat('Просрочено', String(summary.overdue || 0), summary.overdue ? 'danger' : '') +
                stat('Закажи сейчас', String(summary.warning || 0), summary.warning ? 'warn' : '') +
                stat('Закуплено/в пути', String(summary.purchased || 0), summary.purchased ? 'success' : '') +
                stat('Сегодня', schedule.today || APP_TODAY) +
            '</div>' +
            '<div class="material-calendar-toolbar">' +
                '<div class="material-calendar-nav"><button class="ghost compact material-calendar-arrow' + prevAlertClass + '" type="button" data-material-calendar-nav data-direction="-1" data-project-id="' + escapeHtml(projectId) + '"' + (prevAlertClass ? ' title="' + escapeHtml(alertTitle) + '" aria-label="' + escapeHtml(alertTitle) + '" data-material-calendar-alert="1"' : '') + '>&lt;</button><strong>' + escapeHtml(materialCalendarTitle(projectId)) + '</strong><button class="ghost compact material-calendar-arrow' + nextAlertClass + '" type="button" data-material-calendar-nav data-direction="1" data-project-id="' + escapeHtml(projectId) + '"' + (nextAlertClass ? ' title="' + escapeHtml(alertTitle) + '" aria-label="' + escapeHtml(alertTitle) + '" data-material-calendar-alert="1"' : '') + '>&gt;</button></div>' +
                '<div class="material-calendar-modes"><button class="ghost compact material-calendar-toggle" type="button" data-material-calendar-mode="' + escapeHtml(toggleMode) + '" data-project-id="' + escapeHtml(projectId) + '">' + escapeHtml(toggleText) + '</button></div>' +
            '</div>' +
            '<div class="material-schedule-legend"><span><i class="is-neutral"></i>В плане</span><span><i class="is-warning"></i>Закажи сейчас</span><span><i class="is-overdue"></i>Просрочено</span><span><i class="is-done"></i>Закуплено/в пути</span></div>' +
            '<div class="material-calendar-weekdays">' + weekDays.map(function (day) { return '<b>' + escapeHtml(day) + '</b>'; }).join('') + '</div>' +
            '<div class="material-calendar-grid is-' + escapeHtml(view.mode) + (view.mode === 'week' ? ' collapsed' : '') + '">' + days.map(function (day) { return renderMaterialCalendarCell(day, projectId, model); }).join('') + '</div>' +
        '</section>';
    }

    function materialScheduleFindItem(projectId, materialId) {
        var schedule = materialScheduleForProject(projectId);
        var items = schedule && Array.isArray(schedule.items) ? schedule.items : [];
        return items.find(function (item) { return Number(item.id) === Number(materialId); }) || null;
    }

    function materialScheduleDayItems(projectId, day) {
        var schedule = materialScheduleForProject(projectId);
        if (!schedule) return [];
        var model = materialScheduleCalendarModel(projectId, schedule);
        var seen = {};
        return (model.startsByDay[day] || []).concat(model.deadlinesByDay[day] || []).filter(function (item) {
            var key = String(item && item.id || '') + '|' + String(item && item.title || '');
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function closeDayMaterialsModal() {
        var modal = qs('[data-calendar-modal]');
        document.body.classList.remove('cal-modal-open');
        if (modal) {
            var closeProjectId = modal.getAttribute('data-project-id') || '';
            if (state.materialScheduleSelectedDayByProject && closeProjectId) delete state.materialScheduleSelectedDayByProject[closeProjectId];
        }
        qsa('.material-calendar-day.is-selected').forEach(function (cell) {
            cell.classList.remove('is-selected');
        });
        if (!modal) return;
        window.setTimeout(function () {
            if (!document.body.classList.contains('cal-modal-open')) modal.hidden = true;
        }, 180);
    }

    function ensureDayMaterialsModal() {
        var modal = qs('[data-calendar-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'calendar-modal-overlay';
        modal.hidden = true;
        modal.setAttribute('data-calendar-modal', '1');
        modal.innerHTML =
            '<section class="calendar-modal-card" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">' +
                '<button class="calendar-modal-close" type="button" data-calendar-modal-close aria-label="Закрыть">×</button>' +
                '<div data-calendar-modal-content></div>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target === modal || (event.target.closest && event.target.closest('[data-calendar-modal-close]'))) {
                event.preventDefault();
                closeDayMaterialsModal();
            }
        });
        modal.addEventListener('click', function (event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-calendar-modal-mark-purchased]') : null;
            if (!button) return;
            event.preventDefault();
            var projectId = button.getAttribute('data-project-id') || '';
            var materialId = button.getAttribute('data-material-id') || '';
            var item = materialScheduleFindItem(projectId, materialId);
            if (!item) return;
            withSubmitLock(button, function () {
                return api('/api/projects/' + projectId + '/stock-moves', {
                    method: 'POST',
                    body: JSON.stringify({
                        estimate_item_id: Number(materialId),
                        move_type: 'purchase',
                        qty: Math.max(0.01, Number(item.missingQty || item.plannedQty || 1)),
                        price: Number(item.plannedPrice || 0),
                        comment: 'Отмечено из календаря закупок'
                    })
                }).then(function () {
                    item.status = 'purchased';
                    item.statusLabel = 'Закуплено/в пути';
                    item.color = 'done';
                    item.missingQty = 0;
                    updateMaterialScheduleItemDom(materialId, true);
                    showDayMaterialsModal(projectId, modal.getAttribute('data-calendar-modal-day'), materialScheduleDayItems(projectId, modal.getAttribute('data-calendar-modal-day')));
                });
            }).catch(function (error) {
                showAppNotice(appErrorMessage(error, 'Не удалось обновить статус материала'), 'error');
            });
        });
        document.body.appendChild(modal);
        if (!document.body.dataset.calendarModalEscBound) {
            document.body.dataset.calendarModalEscBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && document.body.classList.contains('cal-modal-open')) closeDayMaterialsModal();
            });
        }
        return modal;
    }

    function renderDayMaterialModalRow(projectId, item) {
        var qty = finalSectionSummaryNumber(item.plannedQty || item.planned_qty || 0) + ' ' + (item.unit || 'ед.');
        var status = item.statusLabel || materialScheduleDayText(item) || 'В плане';
        var hasMissingQty = item.missingQty !== undefined && item.missingQty !== null && item.missingQty !== '';
        var done = String(item.status || '') === 'purchased' || String(item.status || '') === 'in_stock' || (hasMissingQty && Number(item.missingQty) <= 0);
        return '<article class="calendar-modal-row ' + materialScheduleStatusClass(item) + '" data-material-id="' + escapeHtml(item.id || '') + '">' +
            '<div class="calendar-modal-row-main">' +
                '<strong><span>' + escapeHtml(qty) + '</span> ' + escapeHtml(item.title || 'Материал') + '</strong>' +
                '<small>' + escapeHtml(status) + '</small>' +
            '</div>' +
            '<button class="ghost compact calendar-modal-status-btn" type="button" data-calendar-modal-mark-purchased data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(item.id || '') + '"' + (done ? ' disabled' : '') + '>' + (done ? 'Готово' : 'Куплено/в пути') + '</button>' +
        '</article>';
    }

    function materialModalQuantityMeta(item) {
        var plan = quantityPlanInfo(item);
        var unit = plan.unit || (item && item.unit) || 'РµРґ.';
        var main = quantityText(plan.totalQty) + ' ' + unit;
        return {
            main: main,
            formula: plan.hasMultiplier ? (quantityText(plan.rawQty) + ' x ' + quantityText(plan.multiplier) + ' = ' + main) : ''
        };
    }

    renderDayMaterialModalRow = function (projectId, item) {
        var qty = materialModalQuantityMeta(item);
        var done = isMaterialDone(projectId, item);
        var status = done ? 'Р“РѕС‚РѕРІРѕ' : (item.statusLabel || materialScheduleDayText(item) || 'Р’ РїР»Р°РЅРµ');
        var statusClass = done ? 'is-done' : materialScheduleStatusClass(item).replace('is-done', 'is-neutral');
        return '<article class="calendar-modal-row ' + statusClass + (done ? ' is-done' : '') + '" data-item-id="' + escapeHtml(item.id || '') + '" data-material-id="' + escapeHtml(item.id || '') + '">' +
            '<label class="calendar-modal-check"><input type="checkbox" data-section-material-check data-calendar-material-check data-item-id="' + escapeHtml(item.id || '') + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(item.sectionTitle || item.stageTitle || '') + '" data-material-id="' + escapeHtml(item.id || '') + '" data-material-title="' + escapeHtml(item.title || '') + '" data-material-unit="' + escapeHtml(item.unit || '') + '" data-material-qty="' + escapeHtml(String(item.plannedQty != null ? item.plannedQty : item.planned_qty || '')) + '"' + (done ? ' checked' : '') + '></label>' +
            '<div class="calendar-modal-row-main">' +
                '<strong><span>' + escapeHtml(qty.main) + '</span> ' + escapeHtml(item.title || 'РњР°С‚РµСЂРёР°Р»') + '</strong>' +
                '<small>' + escapeHtml([status, qty.formula].filter(Boolean).join(' • ')) + '</small>' +
            '</div>' +
        '</article>';
    };

    function showDayMaterialsModal(projectId, day, items) {
        if (!day || !Array.isArray(items) || !items.length) return;
        var modal = ensureDayMaterialsModal();
        var content = qs('[data-calendar-modal-content]', modal);
        state.materialScheduleSelectedDayByProject = state.materialScheduleSelectedDayByProject || {};
        state.materialScheduleSelectedDayByProject[projectId] = day;
        modal.setAttribute('data-calendar-modal-day', day);
        modal.setAttribute('data-project-id', projectId || '');
        qsa('.material-calendar-day.is-selected').forEach(function (cell) {
            cell.classList.remove('is-selected');
        });
        qsa('[data-material-calendar-day="' + progressSelectorValue(day) + '"][data-project-id="' + progressSelectorValue(projectId) + '"]').forEach(function (cell) {
            cell.classList.add('is-selected');
        });
        var html =
            '<div class="calendar-modal-head">' +
                '<p>Закупки</p>' +
                '<h3 id="calendar-modal-title">Закупки на ' + escapeHtml(formatDisplayDate(day)) + '</h3>' +
            '</div>' +
            '<div class="calendar-modal-list">' + items.map(function (item) { return renderDayMaterialModalRow(projectId, item); }).join('') + '</div>';
        safeReplaceChildren(content, html);
        modal.hidden = false;
        window.requestAnimationFrame(function () {
            document.body.classList.add('cal-modal-open');
        });
    }

    function closeMaterialScheduleDrawer() {
        qsa('[data-material-schedule-drawer]').forEach(function (node) {
            if (node.parentNode) node.parentNode.removeChild(node);
        });
    }

    function openMaterialScheduleDrawer(projectId, materialId) {
        var item = materialScheduleFindItem(projectId, materialId);
        if (!item) return;
        closeMaterialScheduleDrawer();
        var qty = finalSectionSummaryNumber(item.plannedQty || 0) + ' ' + (item.unit || 'ед.');
        var relatedWork = item.relatedWork && item.relatedWork.title ? item.relatedWork.title : 'Не связана';
        var supplier = item.supplier && item.supplier.name ? item.supplier.name : 'Поставщик не выбран';
        var drawer = document.createElement('aside');
        drawer.className = 'material-schedule-drawer';
        drawer.setAttribute('data-material-schedule-drawer', '1');
        drawer.innerHTML =
            '<button class="material-schedule-drawer-close" type="button" data-material-schedule-close aria-label="Закрыть">×</button>' +
            '<div class="material-schedule-drawer-head"><span class="badge ' + materialScheduleStatusBadge(item) + '">' + escapeHtml(item.statusLabel || '') + '</span><h3>' + escapeHtml(item.title || '') + '</h3></div>' +
            '<div class="material-schedule-drawer-grid">' +
                dataItem('Количество', qty) +
                dataItem('Статус', item.statusLabel || '') +
                dataItem('Закупить до', item.purchaseByDate ? formatDisplayDate(item.purchaseByDate) : 'Не указано') +
                dataItem('Доставка', String(item.deliveryLeadDays || 0) + ' дн.') +
                dataItem('Связанная работа', relatedWork) +
                dataItem('Поставщик', supplier) +
            '</div>' +
            '<div class="material-schedule-drawer-actions">' +
                '<button class="primary compact" type="button" data-material-schedule-goto data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(materialId) + '">К материалу</button>' +
                (item.relatedWork && item.relatedWork.title ? '<button class="ghost compact" type="button" data-material-schedule-work>К работам</button>' : '') +
            '</div>';
        document.body.appendChild(drawer);
    }

    function openMaterialScheduleDrawer(projectId, materialId) {
        var item = materialScheduleFindItem(projectId, materialId);
        if (!item) return;
        closeMaterialScheduleDrawer();
        var qty = finalSectionSummaryNumber(item.plannedQty || 0) + ' ' + (item.unit || 'ед.');
        var missingQty = finalSectionSummaryNumber(item.missingQty || 0) + ' ' + (item.unit || 'ед.');
        var relatedWork = item.relatedWork && item.relatedWork.title ? item.relatedWork.title : 'Не связана';
        var supplier = item.supplier && item.supplier.name ? item.supplier.name : 'Поставщик не выбран';
        var planText = 'Оплатить до: ' + (item.purchaseStartDate ? formatDisplayDate(item.purchaseStartDate) : 'не указано') +
            ' | Доставка: ' + String(item.deliveryLeadDays || 0) + ' дн. | Дедлайн на объекте: ' + (item.deadlineDate ? formatDisplayDate(item.deadlineDate) : 'не указан');
        var drawer = document.createElement('aside');
        drawer.className = 'material-schedule-drawer';
        drawer.setAttribute('data-material-schedule-drawer', '1');
        drawer.innerHTML =
            '<button class="material-schedule-drawer-close" type="button" data-material-schedule-close aria-label="Закрыть">×</button>' +
            '<div class="material-schedule-drawer-head"><span class="badge ' + materialScheduleStatusBadge(item) + '">' + escapeHtml(item.statusLabel || '') + '</span><h3>' + escapeHtml(item.title || '') + '</h3><p>' + escapeHtml(planText) + '</p></div>' +
            '<div class="material-schedule-drawer-grid">' +
                dataItem('Количество', qty) +
                dataItem('Осталось купить', missingQty) +
                dataItem('Оплатить до', item.purchaseStartDate ? formatDisplayDate(item.purchaseStartDate) : 'Не указано') +
                dataItem('Дедлайн', item.deadlineDate ? formatDisplayDate(item.deadlineDate) : 'Не указан') +
                dataItem('Связанная работа', relatedWork) +
                dataItem('Поставщик', supplier) +
            '</div>' +
            '<label class="material-schedule-delivery-field"><span>Срок доставки, дней</span><input type="number" min="0" max="90" step="1" value="' + escapeHtml(String(item.deliveryLeadDays || 0)) + '" data-material-schedule-delivery-input></label>' +
            '<div class="material-schedule-drawer-actions">' +
                '<button class="primary compact" type="button" data-material-schedule-mark-purchased data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(materialId) + '"' + (Number(item.missingQty || 0) <= 0 ? ' disabled' : '') + '>Отметить как закуплено</button>' +
                '<button class="ghost compact" type="button" data-material-schedule-save-delivery data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(materialId) + '">Сохранить срок</button>' +
                '<button class="ghost compact" type="button" data-material-schedule-goto data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(materialId) + '">К материалу</button>' +
                (item.relatedWork && item.relatedWork.title ? '<button class="ghost compact" type="button" data-material-schedule-work>К работам</button>' : '') +
            '</div>';
        document.body.appendChild(drawer);
    }

    function refreshMaterialScheduleProject(projectId, force) {
        if (force && state.materialScheduleByProject) delete state.materialScheduleByProject[String(projectId)];
        loadMaterialSchedule(projectId, function (schedule) {
            var details = scheduleProjectDetails(projectId);
            if (details) {
                details.materialSchedule = schedule;
                setScheduleProjectDetails(projectId, details);
            }
            var body = scheduleProjectBody(projectId);
            var project = scheduleProjectById(projectId) || state.selectedProject;
            if (body && project && isScheduleProjectOpen(projectId)) {
                body.innerHTML = renderScheduleProjectDetails(project, scheduleProjectDetails(projectId) || { materialSchedule: schedule });
                bindSchedulePageProjectDetails(projectId);
            }
            if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                if (replaceSelectedProjectMaterialCalendar(projectId)) return;
                bindAutoScheduleForm(projectId);
                bindScheduleStatusActions(projectId);
                bindSectionScheduleRefresh(projectId);
            }
        }, force);
    }

    function materialScheduleRenderKey(projectId) {
        var schedule = materialScheduleForProject(projectId);
        var view = materialScheduleView(projectId);
        return [
            String(projectId || ''),
            schedule && schedule.__renderVersion || 0,
            schedule && schedule.error || '',
            view.mode || 'month',
            view.cursor || ''
        ].join('|');
    }

    function renderMaterialScheduleContainer(projectId) {
        return '<div id="material-calendar-target" class="material-schedule-container" data-material-schedule-container="' + escapeHtml(projectId || '') + '">' +
            renderMaterialScheduleTimeline(projectId) +
        '</div>';
    }

    function ensureMaterialScheduleContainer(projectId) {
        var panel = qs('[data-panel="schedule"]');
        if (!panel) return null;
        var container = panel.querySelector('#material-calendar-target') || panel.querySelector('.material-schedule-container');
        if (container) {
            container.id = 'material-calendar-target';
            container.setAttribute('data-material-schedule-container', String(projectId || ''));
            return container;
        }

        container = document.createElement('div');
        container.id = 'material-calendar-target';
        container.className = 'material-schedule-container';
        container.setAttribute('data-material-schedule-container', String(projectId || ''));

        var legacyBlock = panel.querySelector('.material-schedule-card');
        if (legacyBlock && legacyBlock.parentNode === panel) {
            panel.insertBefore(container, legacyBlock);
            container.appendChild(legacyBlock);
            return container;
        }

        panel.insertBefore(container, panel.firstChild);
        return container;
    }

    function bindMaterialCalendarCells(root) {
        qsa('.material-calendar-day.has-materials', root || document).forEach(function (cell) {
            if (cell.dataset.materialCalendarCellBound === '1') return;
            cell.dataset.materialCalendarCellBound = '1';
            cell.addEventListener('click', function (event) {
                if (event.target && event.target.closest && event.target.closest('[data-material-schedule-item], button, a, input, select, textarea')) return;
                event.preventDefault();
                var target = event.currentTarget;
                var day = target.getAttribute('data-material-calendar-day') || '';
                var projectId = target.getAttribute('data-project-id') || '';
                var items = materialScheduleDayItems(projectId, day);
                showDayMaterialsModal(projectId, day, items);
            });
        });
    }

    function replaceSelectedProjectMaterialCalendar(projectId) {
        if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return false;
        var container = ensureMaterialScheduleContainer(projectId);
        if (!container) return false;
        if (state.isMaterialScheduleRendering) return true;
        state.renderingScheduleForProject = state.renderingScheduleForProject || null;
        var projectKey = String(projectId);
        if (state.renderingScheduleForProject === projectKey) return true;
        var renderKey = materialScheduleRenderKey(projectId);
        if (container.getAttribute('data-material-schedule-render-key') === renderKey) return true;
        state.isMaterialScheduleRendering = true;
        state.renderingScheduleForProject = projectKey;
        try {
            var cleanHTML = renderMaterialScheduleTimeline(projectId);
            safeReplaceChildren(container, cleanHTML);
            bindMaterialCalendarCells(container);
            container.setAttribute('data-material-schedule-render-key', renderKey);
        } catch (err) {
            if (window.console && console.error) console.error('Critical material schedule render error:', err);
        } finally {
            state.isMaterialScheduleRendering = false;
            if (state.renderingScheduleForProject === projectKey) state.renderingScheduleForProject = null;
        }
        return true;
    }

    function isSelectedProjectScheduleTabActive() {
        var panel = qs('[data-panel="schedule"]');
        return !!(panel && panel.classList.contains('active'));
    }

    function loadSelectedProjectMaterialSchedule(force) {
        if (state.isMaterialScheduleRendering) return;
        if (!state.selectedProject || hasRole('customer') || !isSelectedProjectScheduleTabActive()) return;
        var projectId = state.selectedProject.id;
        replaceSelectedProjectMaterialCalendar(projectId);
        loadMaterialSchedule(projectId, function () {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId) || !isSelectedProjectScheduleTabActive()) return;
            replaceSelectedProjectMaterialCalendar(projectId);
        }, force);
    }

    function focusProjectMaterialRow(materialId) {
        var input = qs('[data-section-material-check][data-material-id="' + String(materialId) + '"]');
        var row = input && input.closest ? input.closest('.material-row') : null;
        if (!row) return;
        row.classList.add('material-row-focus');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { row.classList.remove('material-row-focus'); }, 1800);
    }

    function bindMaterialScheduleTimeline() {
        bindMaterialCalendarCells(document);
        if (document.body.dataset.materialScheduleDelegated === '1') return;
        document.body.dataset.materialScheduleDelegated = '1';
        document.addEventListener('click', function (event) {
            var close = event.target && event.target.closest ? event.target.closest('[data-material-schedule-close]') : null;
            if (close) {
                closeMaterialScheduleDrawer();
                return;
            }
            var nav = event.target && event.target.closest ? event.target.closest('[data-material-calendar-nav]') : null;
            if (nav) {
                event.preventDefault();
                var navProjectId = nav.getAttribute('data-project-id') || '';
                materialCalendarMove(navProjectId, Number(nav.getAttribute('data-direction') || 1));
                refreshMaterialScheduleProject(navProjectId, false);
                return;
            }
            var mode = event.target && event.target.closest ? event.target.closest('[data-material-calendar-mode]') : null;
            if (mode) {
                event.preventDefault();
                var modeProjectId = mode.getAttribute('data-project-id') || '';
                var nextMode = mode.getAttribute('data-material-calendar-mode') === 'week' ? 'week' : 'month';
                var switchView = function () {
                    setMaterialScheduleView(modeProjectId, { mode: nextMode, cursor: nextMode === 'week' ? isoWeekStart(APP_TODAY) : isoMonthStart(APP_TODAY) });
                    refreshMaterialScheduleProject(modeProjectId, false);
                };
                if (nextMode === 'week') {
                    var scheduleCard = mode.closest ? mode.closest('[data-material-schedule]') : null;
                    var activeGrid = scheduleCard && scheduleCard.querySelector ? scheduleCard.querySelector('.material-calendar-grid') : null;
                    var weekStart = isoWeekStart(APP_TODAY);
                    var weekEnd = materialScheduleSafeIsoAdd(weekStart, 6) || weekStart;
                    if (activeGrid) {
                        activeGrid.classList.add('is-collapsing-week', 'collapsed');
                        qsa('[data-material-calendar-day]', activeGrid).forEach(function (cell) {
                            var cellDay = materialScheduleIsoDate(cell.getAttribute('data-material-calendar-day'));
                            if (!cellDay || cellDay < weekStart || cellDay > weekEnd) cell.classList.add('is-collapse-hidden');
                        });
                        window.setTimeout(switchView, 220);
                        return;
                    }
                }
                switchView();
                return;
            }
            var point = event.target && event.target.closest ? event.target.closest('[data-material-schedule-item]') : null;
            if (point) {
                event.preventDefault();
                event.stopPropagation();
                openMaterialScheduleDrawer(point.getAttribute('data-project-id'), point.getAttribute('data-material-id'));
                return;
            }
            var saveDelivery = event.target && event.target.closest ? event.target.closest('[data-material-schedule-save-delivery]') : null;
            if (saveDelivery) {
                event.preventDefault();
                var saveProjectId = saveDelivery.getAttribute('data-project-id') || '';
                var saveMaterialId = saveDelivery.getAttribute('data-material-id') || '';
                var drawer = saveDelivery.closest ? saveDelivery.closest('[data-material-schedule-drawer]') : null;
                var input = drawer && drawer.querySelector ? drawer.querySelector('[data-material-schedule-delivery-input]') : null;
                saveDelivery.disabled = true;
                api('/api/materials/' + saveMaterialId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({ delivery_days: input ? Number(input.value || 0) : 0 })
                }).then(function (data) {
                    if (data && Array.isArray(data.items)) state.materialsByProject[saveProjectId] = data.items;
                    closeMaterialScheduleDrawer();
                    refreshMaterialScheduleProject(saveProjectId, true);
                }).finally(function () {
                    saveDelivery.disabled = false;
                });
                return;
            }
            var markPurchased = event.target && event.target.closest ? event.target.closest('[data-material-schedule-mark-purchased]') : null;
            if (markPurchased) {
                event.preventDefault();
                var purchaseProjectId = markPurchased.getAttribute('data-project-id') || '';
                var purchaseMaterialId = markPurchased.getAttribute('data-material-id') || '';
                var material = materialScheduleFindItem(purchaseProjectId, purchaseMaterialId);
                if (!material) return;
                markPurchased.disabled = true;
                api('/api/projects/' + purchaseProjectId + '/stock-moves', {
                    method: 'POST',
                    body: JSON.stringify({
                        estimate_item_id: Number(purchaseMaterialId),
                        move_type: 'purchase',
                        qty: Math.max(0.01, Number(material.missingQty || material.plannedQty || 1)),
                        price: Number(material.plannedPrice || 0),
                        comment: 'Отмечено из календаря закупок'
                    })
                }).then(function () {
                    closeMaterialScheduleDrawer();
                    loadMaterials(purchaseProjectId, function () {
                        refreshMaterialScheduleProject(purchaseProjectId, true);
                    });
                }).finally(function () {
                    markPurchased.disabled = false;
                });
                return;
            }
            var goto = event.target && event.target.closest ? event.target.closest('[data-material-schedule-goto]') : null;
            if (goto) {
                var gotoProjectId = Number(goto.getAttribute('data-project-id') || 0);
                var gotoMaterialId = goto.getAttribute('data-material-id') || '';
                closeMaterialScheduleDrawer();
                if (!state.selectedProject || Number(state.selectedProject.id) !== gotoProjectId) {
                    location.href = '/app/projects?openProject=' + gotoProjectId + '&tab=materials&materialId=' + encodeURIComponent(gotoMaterialId);
                    return;
                }
                activateProjectTab('materials');
                setTimeout(function () { focusProjectMaterialRow(gotoMaterialId); }, 80);
                return;
            }
            var work = event.target && event.target.closest ? event.target.closest('[data-material-schedule-work]') : null;
            if (work) {
                closeMaterialScheduleDrawer();
                activateProjectTab('works');
            }
        });
    }

    var baseRenderScheduleProjectDetailsForMaterialSchedule = renderScheduleProjectDetails;
    renderScheduleProjectDetails = function (project, details) {
        if (details && details.materialSchedule) setMaterialScheduleForProject(project.id, details.materialSchedule);
        return baseRenderScheduleProjectDetailsForMaterialSchedule(project, details);
    };

    var baseLoadScheduleProjectDetailsForMaterialSchedule = loadScheduleProjectDetails;
    loadScheduleProjectDetails = function (project, force) {
        baseLoadScheduleProjectDetailsForMaterialSchedule(project, force);
        if (!project || !project.id || hasRole('customer')) return;
        loadMaterialSchedule(project.id, function (schedule) {
            var details = scheduleProjectDetails(project.id);
            if (details) {
                details.materialSchedule = schedule;
                setScheduleProjectDetails(project.id, details);
            }
            var body = scheduleProjectBody(project.id);
            if (body && isScheduleProjectOpen(project.id)) {
                body.innerHTML = renderScheduleProjectDetails(project, scheduleProjectDetails(project.id) || { materialSchedule: schedule });
                bindSchedulePageProjectDetails(project.id);
            }
        }, force);
    };
    var materialScheduleOpenTokens = {};

    var baseActivateProjectTabForMaterialSchedule = activateProjectTab;
    activateProjectTab = function (tabName) {
        baseActivateProjectTabForMaterialSchedule(tabName);
        if (tabName !== 'schedule') return;
        loadSelectedProjectMaterialSchedule(false);
    };

    function warehouseQtyText(item) {
        var qty = Number(item && item.qty || 0);
        var value = Math.round(qty * 100) / 100;
        return value + ' ' + (item && item.unit ? item.unit : 'ед.');
    }

    function warehouseTypeLabel(type) {
        return String(type || '') === 'tool' ? 'Инструмент' : 'Материал';
    }

    function warehouseConditionLabel(item) {
        if (String(item && item.itemType || item && item.type || '') === 'tool') return item.conditionStatus || item.condition || 'Б/У';
        return Number(item && item.qty || 0) > 0 ? 'В наличии' : 'Нет остатка';
    }

    function warehouseNormalizeSearch(value) {
        return String(value || '').toLocaleLowerCase('ru')
            .replace(/ё/g, 'е')
            .replace(/\bпровод\b/g, 'кабель')
            .replace(/(?<=\d)[хx×](?=\d)/g, 'x')
            .replace(/(?<=\d),(?=\d)/g, '.')
            .replace(/[^0-9a-zа-я.]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function warehouseLevenshtein(a, b) {
        a = warehouseNormalizeSearch(a);
        b = warehouseNormalizeSearch(b);
        if (a === b) return 0;
        if (!a) return b.length;
        if (!b) return a.length;
        var previous = [];
        for (var j = 0; j <= b.length; j += 1) previous[j] = j;
        for (var i = 1; i <= a.length; i += 1) {
            var current = [i];
            for (j = 1; j <= b.length; j += 1) {
                current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
            }
            previous = current;
        }
        return previous[b.length];
    }

    function warehouseDice(a, b) {
        a = warehouseNormalizeSearch(a).replace(/\s+/g, '');
        b = warehouseNormalizeSearch(b).replace(/\s+/g, '');
        if (a.length < 2 || b.length < 2) return 0;
        var counts = {};
        for (var i = 0; i < b.length - 1; i += 1) {
            var gram = b.slice(i, i + 2);
            counts[gram] = (counts[gram] || 0) + 1;
        }
        var overlap = 0;
        for (i = 0; i < a.length - 1; i += 1) {
            gram = a.slice(i, i + 2);
            if (counts[gram]) {
                overlap += 1;
                counts[gram] -= 1;
            }
        }
        return (2 * overlap) / ((a.length - 1) + (b.length - 1));
    }

    function warehouseFuzzyScore(query, value) {
        var left = warehouseNormalizeSearch(query);
        var right = warehouseNormalizeSearch(value);
        if (!left || !right) return 0;
        if (right.indexOf(left) !== -1 || left.indexOf(right) !== -1) return 1;
        var lev = 1 - (warehouseLevenshtein(left, right) / Math.max(left.length, right.length, 1));
        return Math.max(lev, warehouseDice(left, right));
    }

    function warehouseItemSearchScore(query, item) {
        var normalizedQuery = warehouseNormalizeSearch(query);
        if (!normalizedQuery) return 1;
        var fields = [
            item && item.name,
            item && item.sku,
            item && item.category,
            warehouseTypeLabel(item && (item.itemType || item.type)),
            item && item.conditionStatus
        ].filter(Boolean);
        var best = 0;
        fields.forEach(function (field) {
            best = Math.max(best, warehouseFuzzyScore(normalizedQuery, field));
        });
        best = Math.max(best, warehouseFuzzyScore(normalizedQuery, fields.join(' ')));

        var queryTokens = normalizedQuery.split(' ').filter(Boolean);
        var fieldTokens = warehouseNormalizeSearch(fields.join(' ')).split(' ').filter(Boolean);
        queryTokens.forEach(function (queryToken) {
            fieldTokens.forEach(function (fieldToken) {
                best = Math.max(best, warehouseFuzzyScore(queryToken, fieldToken));
            });
        });
        return best;
    }

    function loadWarehouseCatalog(callback) {
        api('/api/warehouse-items').then(function (data) {
            state.warehouseCatalog = Array.isArray(data.items) ? data.items : [];
            callback(state.warehouseCatalog);
        }).catch(function () {
            state.warehouseCatalog = [];
            callback([]);
        });
    }

    function warehouseFilteredItems(items) {
        var search = qs('[data-warehouse-search]');
        var type = qs('[data-warehouse-type-filter]');
        var category = qs('[data-warehouse-category-filter]');
        var stock = qs('[data-warehouse-stock-filter]');
        var query = search ? warehouseNormalizeSearch(search.value) : '';
        var typeValue = type ? type.value : 'all';
        var categoryValue = category ? category.value : 'all';
        var stockValue = stock ? stock.value : 'all';
        return (items || []).filter(function (item) {
            var matchesQuery = !query || warehouseItemSearchScore(query, item) >= 0.70;
            var matchesType = typeValue === 'all' || String(item.itemType || item.type) === typeValue;
            var matchesCategory = categoryValue === 'all' || String(item.category || '') === categoryValue;
            var matchesStock = stockValue === 'all' || (stockValue === 'available' ? Number(item.qty || 0) > 0 : Number(item.qty || 0) <= 0);
            return matchesQuery && matchesType && matchesCategory && matchesStock;
        });
    }

    function renderWarehouseCatalog(items) {
        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        if (!items.length) {
            root.innerHTML = '<p class="muted">Позиции склада не найдены.</p>';
            return;
        }
        root.innerHTML =
            '<div class="warehouse-table-wrap"><table class="warehouse-table warehouse-inventory-table ui-table">' +
                '<thead><tr><th>Тип</th><th>Наименование</th><th>Код / артикул</th><th>Текущий остаток</th><th>Статус</th><th></th></tr></thead>' +
                '<tbody>' + items.map(function (item) {
                    var disabled = Number(item.qty || 0) <= 0 ? ' disabled' : '';
                    return '<tr>' +
                        '<td><span class="badge">' + escapeHtml(warehouseTypeLabel(item.itemType || item.type)) + '</span></td>' +
                        '<td><b>' + escapeHtml(item.name || '') + '</b><small>' + escapeHtml(item.category || '') + '</small></td>' +
                        '<td>' + escapeHtml(item.sku || '—') + '</td>' +
                        '<td><strong>' + escapeHtml(warehouseQtyText(item)) + '</strong></td>' +
                        '<td><span class="badge ' + (Number(item.qty || 0) <= 0 ? 'danger' : (String(item.conditionStatus || '').indexOf('ремонт') !== -1 ? 'warn' : 'success')) + '">' + escapeHtml(warehouseConditionLabel(item)) + '</span></td>' +
                        '<td><button class="ghost compact" type="button" data-warehouse-issue data-warehouse-item-id="' + escapeHtml(item.id) + '"' + disabled + '>Выдать на объект</button></td>' +
                    '</tr>';
                }).join('') + '</tbody>' +
            '</table></div>';
    }

    function renderWarehouseStats(items) {
        var node = qs('[data-warehouse-analysis]');
        if (!node) return;
        var materials = (items || []).filter(function (item) { return String(item.itemType || item.type) === 'material'; }).length;
        var tools = (items || []).filter(function (item) { return String(item.itemType || item.type) === 'tool'; }).length;
        var available = (items || []).filter(function (item) { return Number(item.qty || 0) > 0; }).length;
        var repair = (items || []).filter(function (item) { return String(item.conditionStatus || '').toLocaleLowerCase('ru').indexOf('ремонт') !== -1; }).length;
        node.innerHTML =
            '<div class="analysis-pill"><span>Материалы</span><strong>' + materials + '</strong></div>' +
            '<div class="analysis-pill"><span>Инструменты</span><strong>' + tools + '</strong></div>' +
            '<div class="analysis-pill"><span>В наличии</span><strong>' + available + '</strong></div>' +
            '<div class="analysis-pill"><span>Требуют ремонта</span><strong>' + repair + '</strong></div>';
    }

    function populateWarehouseCategories(items) {
        var select = qs('[data-warehouse-category-filter]');
        if (!select) return;
        var keep = select.value || 'all';
        var categories = [];
        (items || []).forEach(function (item) {
            var category = String(item.category || '').trim();
            if (category && categories.indexOf(category) === -1) categories.push(category);
        });
        select.innerHTML = '<option value="all">Все категории</option>' + categories.sort().map(function (category) {
            return '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>';
        }).join('');
        select.value = categories.indexOf(keep) !== -1 ? keep : 'all';
    }

    function rerenderWarehouseCatalog() {
        renderWarehouseCatalog(warehouseFilteredItems(state.warehouseCatalog || []));
    }

    function bindWarehouseCatalogControls() {
        qsa('[data-warehouse-search], [data-warehouse-type-filter], [data-warehouse-category-filter], [data-warehouse-stock-filter]').forEach(function (node) {
            if (node.dataset.inventoryBound === '1') return;
            node.dataset.inventoryBound = '1';
            node.addEventListener(node.tagName === 'INPUT' ? 'input' : 'change', rerenderWarehouseCatalog);
        });
        if (document.body.dataset.warehouseIssueDelegated === '1') return;
        document.body.dataset.warehouseIssueDelegated = '1';
        document.addEventListener('click', function (event) {
            var issue = event.target && event.target.closest ? event.target.closest('[data-warehouse-issue]') : null;
            if (issue) {
                event.preventDefault();
                openWarehouseTransferModal(Number(issue.getAttribute('data-warehouse-item-id') || 0));
            }
        });
    }

    renderWarehousePage = function () {
        var root = qs('[data-warehouse-summary]');
        if (!root) return;
        root.innerHTML = '';
        loadWarehouseCatalog(function (items) {
            populateWarehouseCategories(items);
            renderWarehouseStats(items);
            renderWarehouseCatalog(warehouseFilteredItems(items));
            bindWarehouseCatalogControls();
            bindWarehouseTransferModal();
            bindWarehouseReceiptModal();
            applyWarehouseIssueFocus();
        });
    };

    function currentWarehouseItem(itemId) {
        return (state.warehouseCatalog || []).find(function (item) { return Number(item.id) === Number(itemId); }) || null;
    }

    function openWarehouseTransferModal(itemId, forcedProjectId) {
        var modal = qs('[data-warehouse-transfer-modal]');
        var form = qs('[data-warehouse-transfer-form]');
        var info = qs('[data-warehouse-transfer-item]');
        var projectSelect = qs('[data-warehouse-transfer-projects]');
        var item = currentWarehouseItem(itemId);
        if (!modal || !form || !item) return;
        if (projectSelect) {
            projectSelect.innerHTML = (state.projects || []).map(function (project) {
                return '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.title || '') + '</option>';
            }).join('');
            if (forcedProjectId) projectSelect.value = String(forcedProjectId);
        }
        form.warehouse_item_id.value = String(item.id);
        form.qty.value = '';
        form.qty.max = String(item.qty || 0);
        form.available.value = warehouseQtyText(item);
        form.comment.value = '';
        if (info) {
            info.innerHTML = '<b>' + escapeHtml(item.name || '') + '</b><small>' + escapeHtml([item.sku, item.category, warehouseQtyText(item)].filter(Boolean).join(' • ')) + '</small>';
        }
        var error = qs('[data-warehouse-transfer-error]');
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        modal.hidden = false;
        document.body.classList.add('warehouse-transfer-open');
        setTimeout(function () { if (form.qty) form.qty.focus(); }, 40);
    }

    function closeWarehouseTransferModal() {
        var modal = qs('[data-warehouse-transfer-modal]');
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('warehouse-transfer-open');
    }

    function bindWarehouseTransferModal() {
        qsa('[data-warehouse-transfer-close]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', closeWarehouseTransferModal);
        });
        var form = qs('[data-warehouse-transfer-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var item = currentWarehouseItem(Number(form.warehouse_item_id.value || 0));
            var qty = Number(form.qty.value || 0);
            var error = qs('[data-warehouse-transfer-error]');
            if (error) error.classList.remove('active');
            if (!item || qty <= 0 || qty > Number(item.qty || 0)) {
                if (error) {
                    error.textContent = 'Количество должно быть больше нуля и не больше текущего остатка.';
                    error.classList.add('active');
                }
                return;
            }
            api('/api/warehouse-items/' + encodeURIComponent(item.id) + '/transfer', {
                method: 'POST',
                body: JSON.stringify({
                    project_id: Number(form.project_id.value),
                    qty: qty,
                    comment: form.comment.value.trim()
                })
            }).then(function (data) {
                var projectId = Number(form.project_id.value);
                delete state.materialsByProject[projectId];
                closeWarehouseTransferModal();
                loadWarehouseCatalog(function (items) {
                    populateWarehouseCategories(items);
                    renderWarehouseStats(items);
                    renderWarehouseCatalog(warehouseFilteredItems(items));
                });
                if (data && data.items) state.materialsByProject[projectId] = data.items;
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error === 'qty_exceeds_stock'
                        ? 'Нельзя выдать больше, чем есть на складе.'
                        : (err.payload && err.payload.error ? err.payload.error : 'Не удалось выполнить выдачу.');
                    error.classList.add('active');
                }
            });
        });
    }

    function openWarehouseReceiptModal(mode) {
        var modal = qs('[data-warehouse-receipt-modal]');
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add('warehouse-transfer-open');
        setWarehouseReceiptMode(mode || 'manual');
        populateWarehouseReturnProjects();
        resetWarehouseManualReceipt();
        resetWarehouseReturnForm();
        setTimeout(function () {
            var input = qs('[data-warehouse-manual-name]');
            if (input && !qs('[data-warehouse-return-form]:not([hidden])')) input.focus();
        }, 40);
    }

    function closeWarehouseReceiptModal() {
        var modal = qs('[data-warehouse-receipt-modal]');
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('warehouse-transfer-open');
    }

    function setWarehouseReceiptMode(mode) {
        mode = mode === 'return' ? 'return' : 'manual';
        var manualForm = qs('[data-warehouse-manual-receipt-form]');
        var returnForm = qs('[data-warehouse-return-form]');
        qsa('[data-warehouse-receipt-mode] input[type="radio"]').forEach(function (input) {
            input.checked = input.value === mode;
        });
        if (manualForm) manualForm.hidden = mode !== 'manual';
        if (returnForm) returnForm.hidden = mode !== 'return';
    }

    function resetWarehouseManualReceipt() {
        var form = qs('[data-warehouse-manual-receipt-form]');
        if (!form) return;
        form.reset();
        form.warehouse_item_id.value = '';
        if (form.item_type) form.item_type.value = 'material';
        if (form.unit) form.unit.value = 'шт';
        updateWarehouseToolStatusField();
        renderWarehouseManualSuggestions([]);
        var error = qs('[data-warehouse-manual-receipt-error]');
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
    }

    function updateWarehouseToolStatusField() {
        var form = qs('[data-warehouse-manual-receipt-form]');
        var status = qs('[data-warehouse-tool-status]');
        if (!form || !status) return;
        status.hidden = form.item_type.value !== 'tool';
    }

    function warehouseManualSuggestionItems(query, type) {
        query = warehouseNormalizeSearch(query);
        if (!query) return [];
        return (state.warehouseCatalog || []).map(function (item) {
            return { item: item, score: warehouseItemSearchScore(query, item) };
        }).filter(function (entry) {
            return String(entry.item.itemType || entry.item.type) === type && entry.score >= 0.70;
        }).sort(function (a, b) {
            return b.score - a.score;
        }).slice(0, 6);
    }

    function renderWarehouseManualSuggestions(entries) {
        var root = qs('[data-warehouse-manual-suggestions]');
        if (!root) return;
        if (!entries || !entries.length) {
            root.hidden = true;
            root.innerHTML = '';
            return;
        }
        root.hidden = false;
        root.innerHTML = entries.map(function (entry) {
            var item = entry.item;
            return '<button type="button" data-warehouse-manual-suggest data-warehouse-item-id="' + escapeHtml(item.id) + '">' +
                '<strong>' + escapeHtml(item.name || '') + '</strong>' +
                '<small>' + escapeHtml([item.sku, warehouseQtyText(item), Math.round(entry.score * 100) + '%'].filter(Boolean).join(' • ')) + '</small>' +
            '</button>';
        }).join('');
    }

    function selectWarehouseManualSuggestion(itemId) {
        var form = qs('[data-warehouse-manual-receipt-form]');
        var item = currentWarehouseItem(itemId);
        if (!form || !item) return;
        form.warehouse_item_id.value = String(item.id);
        form.item_type.value = String(item.itemType || item.type || 'material');
        form.name.value = item.name || '';
        form.unit.value = item.unit || 'шт';
        if (form.condition_status && item.conditionStatus) form.condition_status.value = item.conditionStatus;
        updateWarehouseToolStatusField();
        renderWarehouseManualSuggestions([]);
        if (form.qty) form.qty.focus();
    }

    function bindWarehouseReceiptModal() {
        var open = qs('[data-warehouse-receipt-open]');
        if (open && open.dataset.bound !== '1') {
            open.dataset.bound = '1';
            open.addEventListener('click', function (event) {
                event.preventDefault();
                openWarehouseReceiptModal('manual');
            });
        }
        qsa('[data-warehouse-receipt-close]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', closeWarehouseReceiptModal);
        });
        qsa('[data-warehouse-receipt-mode] input[type="radio"]').forEach(function (input) {
            if (input.dataset.bound === '1') return;
            input.dataset.bound = '1';
            input.addEventListener('change', function () {
                if (input.checked) setWarehouseReceiptMode(input.value);
            });
        });
        bindWarehouseManualReceiptForm();
        bindWarehouseReturnForm();
    }

    function bindWarehouseManualReceiptForm() {
        var form = qs('[data-warehouse-manual-receipt-form]');
        if (!form) return;
        if (form.item_type && form.item_type.dataset.bound !== '1') {
            form.item_type.dataset.bound = '1';
            form.item_type.addEventListener('change', function () {
                form.warehouse_item_id.value = '';
                updateWarehouseToolStatusField();
                renderWarehouseManualSuggestions(warehouseManualSuggestionItems(form.name.value, form.item_type.value));
            });
        }
        if (form.name && form.name.dataset.bound !== '1') {
            form.name.dataset.bound = '1';
            form.name.addEventListener('input', function () {
                form.warehouse_item_id.value = '';
                renderWarehouseManualSuggestions(warehouseManualSuggestionItems(form.name.value, form.item_type.value));
            });
        }
        if (!document.body.dataset.warehouseManualSuggestDelegated) {
            document.body.dataset.warehouseManualSuggestDelegated = '1';
            document.addEventListener('click', function (event) {
                var suggestion = event.target && event.target.closest ? event.target.closest('[data-warehouse-manual-suggest]') : null;
                if (suggestion) {
                    event.preventDefault();
                    selectWarehouseManualSuggestion(Number(suggestion.getAttribute('data-warehouse-item-id') || 0));
                }
            });
        }
        if (form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-warehouse-manual-receipt-error]');
            if (error) error.classList.remove('active');
            api('/api/warehouse-items/receipt', {
                method: 'POST',
                body: JSON.stringify({
                    mode: 'manual',
                    warehouse_item_id: form.warehouse_item_id.value,
                    item_type: form.item_type.value,
                    name: form.name.value.trim(),
                    qty: Number(form.qty.value || 0),
                    unit: form.unit.value,
                    condition_status: form.item_type.value === 'tool' && form.condition_status ? form.condition_status.value : ''
                })
            }).then(function () {
                closeWarehouseReceiptModal();
                loadWarehouseCatalog(function (items) {
                    populateWarehouseCategories(items);
                    renderWarehouseStats(items);
                    renderWarehouseCatalog(warehouseFilteredItems(items));
                });
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить приход.';
                    error.classList.add('active');
                }
            });
        });
    }

    function populateWarehouseReturnProjects() {
        var select = qs('[data-warehouse-return-projects]');
        if (!select) return;
        select.innerHTML = '<option value="">Выберите объект</option>' + (state.projects || []).filter(function (project) {
            return Number(project.progress || 0) < 100;
        }).map(function (project) {
            return '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.title || '') + '</option>';
        }).join('');
    }

    function resetWarehouseReturnForm() {
        var form = qs('[data-warehouse-return-form]');
        if (!form) return;
        form.reset();
        var materialSelect = qs('[data-warehouse-return-materials]');
        if (materialSelect) {
            materialSelect.innerHTML = '<option value="">Сначала выберите объект</option>';
            materialSelect.disabled = true;
        }
        if (form.qty) {
            form.qty.value = '';
            form.qty.disabled = true;
            form.qty.removeAttribute('max');
        }
        updateWarehouseReturnAvailable(null);
        var error = qs('[data-warehouse-return-error]');
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
    }

    function warehouseReturnItems(projectId) {
        var items = state.materialsByProject[projectId] || [];
        return (items || []).filter(function (item) {
            return String(item.itemKind || 'material').toLowerCase() !== 'work' && Number(item.stockQty || 0) > 0;
        });
    }

    function updateWarehouseReturnMaterials(projectId) {
        var form = qs('[data-warehouse-return-form]');
        var materialSelect = qs('[data-warehouse-return-materials]');
        if (!form || !materialSelect) return;
        materialSelect.disabled = true;
        materialSelect.innerHTML = '<option value="">Выбери объект</option>';
        if (form.qty) {
            form.qty.value = '';
            form.qty.disabled = true;
        }
        updateWarehouseReturnAvailable(null);
        if (!projectId) {
            materialSelect.innerHTML = '<option value="">Сначала выберите объект</option>';
            return;
        }
        loadMaterials(projectId, function () {
            var items = warehouseReturnItems(projectId);
            if (!items.length) {
                materialSelect.innerHTML = '<option value="">Нет позиций с остатком на объекте</option>';
                return;
            }
            materialSelect.disabled = false;
            materialSelect.innerHTML = '<option value="">Выберите позицию</option>' + items.map(function (item) {
                return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.title || '') + ' • ' + escapeHtml(item.stockQty || 0) + ' ' + escapeHtml(item.unit || '') + '</option>';
            }).join('');
        });
    }

    function currentWarehouseReturnItem() {
        var form = qs('[data-warehouse-return-form]');
        if (!form || !form.project_id || !form.estimate_item_id) return null;
        var projectId = Number(form.project_id.value || 0);
        var materialId = Number(form.estimate_item_id.value || 0);
        return warehouseReturnItems(projectId).find(function (item) { return Number(item.id) === materialId; }) || null;
    }

    function updateWarehouseReturnAvailable(item) {
        var label = qs('[data-warehouse-return-available]');
        var form = qs('[data-warehouse-return-form]');
        if (!label) return;
        if (!item) {
            label.textContent = 'Доступно для возврата: выберите позицию';
            return;
        }
        label.textContent = 'Доступно для возврата: ' + item.stockQty + ' ' + (item.unit || 'ед.');
        if (form && form.qty) {
            form.qty.disabled = false;
            form.qty.max = String(item.stockQty || 0);
            form.qty.value = '';
            form.qty.focus();
        }
    }

    function bindWarehouseReturnForm() {
        var form = qs('[data-warehouse-return-form]');
        if (!form) return;
        if (form.project_id && form.project_id.dataset.bound !== '1') {
            form.project_id.dataset.bound = '1';
            form.project_id.addEventListener('change', function () {
                updateWarehouseReturnMaterials(Number(form.project_id.value || 0));
            });
        }
        if (form.estimate_item_id && form.estimate_item_id.dataset.bound !== '1') {
            form.estimate_item_id.dataset.bound = '1';
            form.estimate_item_id.addEventListener('change', function () {
                updateWarehouseReturnAvailable(currentWarehouseReturnItem());
            });
        }
        if (form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var item = currentWarehouseReturnItem();
            var qty = Number(form.qty.value || 0);
            var error = qs('[data-warehouse-return-error]');
            if (error) error.classList.remove('active');
            if (!item || qty <= 0 || qty > Number(item.stockQty || 0)) {
                if (error) {
                    error.textContent = 'Количество должно быть больше нуля и не больше остатка на объекте.';
                    error.classList.add('active');
                }
                return;
            }
            var projectId = Number(form.project_id.value || 0);
            api('/api/warehouse-items/receipt', {
                method: 'POST',
                body: JSON.stringify({
                    mode: 'return',
                    project_id: projectId,
                    estimate_item_id: Number(form.estimate_item_id.value),
                    qty: qty
                })
            }).then(function (data) {
                if (data && data.items) state.materialsByProject[projectId] = data.items;
                closeWarehouseReceiptModal();
                loadWarehouseCatalog(function (items) {
                    populateWarehouseCategories(items);
                    renderWarehouseStats(items);
                    renderWarehouseCatalog(warehouseFilteredItems(items));
                });
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error === 'qty_exceeds_object_stock'
                        ? 'Нельзя вернуть больше, чем числится на объекте.'
                        : (err.payload && err.payload.error ? err.payload.error : 'Не удалось оформить возврат.');
                    error.classList.add('active');
                }
            });
        });
    }

    function applyWarehouseIssueFocus() {
        if (page !== 'warehouse') return;
        var params = new URLSearchParams(location.search);
        var itemId = Number(params.get('issueWarehouseItem') || 0);
        var projectId = Number(params.get('projectId') || 0);
        if (itemId) openWarehouseTransferModal(itemId, projectId);
    }

    function loadWarehouseMatches(projectId, callback) {
        if (!projectId || hasRole('customer')) {
            callback({});
            return;
        }
        api('/api/projects/' + projectId + '/warehouse-matches').then(function (data) {
            callback(data && data.matches ? data.matches : {});
        }).catch(function () {
            callback({});
        });
    }

    var baseLoadMaterialsForWarehouseMatches = loadMaterials;
    loadMaterials = function (projectId, callback) {
        baseLoadMaterialsForWarehouseMatches(projectId, function (items) {
            loadWarehouseMatches(projectId, function (matches) {
                var enriched = (items || []).map(function (item) {
                    var match = matches[String(item.id)];
                    return match ? Object.assign({}, item, { warehouseMatch: match }) : item;
                });
                state.materialsByProject[projectId] = enriched;
                callback(enriched);
            });
        });
    };

    function renderWarehouseMatchBadge(projectId, item) {
        var match = item && item.warehouseMatch;
        if (!match || Number(match.qty || 0) <= 0) return '';
        var exact = Number(match.score || 0) >= 0.92;
        var label = exact ? '\u0415\u0441\u0442\u044c \u043d\u0430 \u0441\u043a\u043b\u0430\u0434\u0435' : '\u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e, \u0435\u0441\u0442\u044c \u043d\u0430 \u0441\u043a\u043b\u0430\u0434\u0435';
        var title = '\u041d\u0430 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0435\u043c \u0441\u043a\u043b\u0430\u0434\u0435 \u0441\u0435\u0439\u0447\u0430\u0441 \u0435\u0441\u0442\u044c ' + warehouseQtyText(match) + '. \u041f\u043e\u0445\u043e\u0436\u0430\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u044f: ' + (match.name || '') + '.';
        return '<button class="warehouse-match-badge" type="button" data-warehouse-match-badge data-project-id="' + escapeHtml(projectId || '') + '" data-material-id="' + escapeHtml(item.id || '') + '" data-warehouse-item-id="' + escapeHtml(match.id || '') + '" data-title="' + escapeHtml(item.title || '') + '" data-match-name="' + escapeHtml(match.name || '') + '" data-match-qty="' + escapeHtml(warehouseQtyText(match)) + '" data-match-score="' + escapeHtml(Math.round(Number(match.score || 0) * 100)) + '" title="' + escapeHtml(title) + '">' + escapeHtml(label) + '</button>';
    }


    function closeWarehouseMatchPopover() {
        qsa('[data-warehouse-match-popover]').forEach(function (node) {
            if (node.parentNode) node.parentNode.removeChild(node);
        });
    }

    function openWarehouseMatchPopover(button) {
        closeWarehouseMatchPopover();
        var popover = document.createElement('div');
        popover.className = 'warehouse-match-popover';
        popover.setAttribute('data-warehouse-match-popover', '1');
        popover.innerHTML =
            '<button class="warehouse-match-close" type="button" data-warehouse-match-close aria-label="Закрыть">×</button>' +
            '<strong>' + escapeHtml(button.getAttribute('data-title') || '') + '</strong>' +
            '<p>На внутреннем складе сейчас есть ' + escapeHtml(button.getAttribute('data-match-qty') || '') + '. Система нашла похожую позицию: <b>' + escapeHtml(button.getAttribute('data-match-name') || '') + '</b> (' + escapeHtml(button.getAttribute('data-match-score') || '0') + '%).</p>' +
            '<button class="primary compact" type="button" data-warehouse-match-issue data-project-id="' + escapeHtml(button.getAttribute('data-project-id') || '') + '" data-warehouse-item-id="' + escapeHtml(button.getAttribute('data-warehouse-item-id') || '') + '">Выдать со склада</button>';
        document.body.appendChild(popover);
        var rect = button.getBoundingClientRect();
        popover.style.left = Math.min(window.innerWidth - 340, Math.max(12, rect.left)) + 'px';
        popover.style.top = Math.max(12, rect.bottom + 8) + 'px';
    }

    if (!document.body.dataset.warehouseMatchDelegated) {
        document.body.dataset.warehouseMatchDelegated = '1';
        document.addEventListener('click', function (event) {
            var close = event.target && event.target.closest ? event.target.closest('[data-warehouse-match-close]') : null;
            if (close) {
                closeWarehouseMatchPopover();
                return;
            }
            var issue = event.target && event.target.closest ? event.target.closest('[data-warehouse-match-issue]') : null;
            if (issue) {
                var projectId = issue.getAttribute('data-project-id') || '';
                var warehouseItemId = issue.getAttribute('data-warehouse-item-id') || '';
                location.href = '/app/warehouse?issueWarehouseItem=' + encodeURIComponent(warehouseItemId) + '&projectId=' + encodeURIComponent(projectId);
                return;
            }
            var badge = event.target && event.target.closest ? event.target.closest('[data-warehouse-match-badge]') : null;
            if (badge) {
                event.preventDefault();
                event.stopPropagation();
                openWarehouseMatchPopover(badge);
                return;
            }
            if (!event.target.closest || !event.target.closest('[data-warehouse-match-popover]')) closeWarehouseMatchPopover();
        });
    }

    function renderMaterialDeliveryField(projectId, item) {
        if (!item || String(item.itemKind || 'material').toLowerCase() === 'work') return '';
        var value = item.deliveryDays == null ? (item.estimatedDeliveryDays || '') : item.deliveryDays;
        return '<label class="material-delivery-field" title="\u0421\u0440\u043e\u043a \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u0432 \u0434\u043d\u044f\u0445"><span>\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430</span><input type="number" min="0" max="90" step="1" value="' + escapeHtml(value == null ? '' : String(value)) + '" data-material-delivery-days data-project-id="' + escapeHtml(projectId || '') + '" data-material-id="' + escapeHtml(item.id || '') + '"></label>';
    }


    if (!document.body.dataset.materialDeliveryDelegated) {
        document.body.dataset.materialDeliveryDelegated = '1';
        document.addEventListener('change', function (event) {
            var input = event.target && event.target.closest ? event.target.closest('[data-material-delivery-days]') : null;
            if (!input) return;
            var projectId = input.getAttribute('data-project-id') || '';
            var materialId = input.getAttribute('data-material-id') || '';
            input.disabled = true;
            api('/api/materials/' + materialId + '/update', {
                method: 'POST',
                body: JSON.stringify({ delivery_days: Number(input.value || 0) })
            }).then(function (data) {
                if (data && Array.isArray(data.items)) state.materialsByProject[projectId] = data.items;
                if (state.materialScheduleByProject) delete state.materialScheduleByProject[String(projectId)];
                if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    var materialsPanel = qs('[data-panel="materials"]');
                    if (materialsPanel) safeReplaceChildren(materialsPanel, renderProjectMaterialsTab(state.selectedProject, state.materialsByProject[projectId] || [], state.materialInsightsByProject[projectId] || {}));
                    var schedulePanel = qs('[data-panel="schedule"]');
                    if (schedulePanel) refreshMaterialScheduleProject(projectId, true);
                }
            }).finally(function () {
                input.disabled = false;
            });
        });
    }

    financeStatusLabel = function (status) {
        return {
            planned: '\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e',
            approved: '\u041f\u043e\u0434\u0430\u043d \u043d\u0430 \u043e\u043f\u043b\u0430\u0442\u0443',
            paid: '\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e',
            cancelled: '\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043e'
        }[status] || status || '\u0421\u0442\u0430\u0442\u0443\u0441';
    };

    function financeDocumentFromItem(item) {
        if (!item) return null;
        if (item.document && item.document.id) return item.document;
        if (!item.document_id) return null;
        return {
            id: item.document_id,
            original_name: item.document_original_name || '',
            mime_type: item.document_mime_type || '',
            file_ext: item.document_file_ext || '',
            view_url: '/api/documents/' + item.document_id + '/view',
            download_url: '/api/documents/' + item.document_id + '/download',
            can_preview: String(item.document_mime_type || '').indexOf('image/') === 0 || String(item.document_file_ext || '') === '.pdf'
        };
    }

    function financeDocumentKind(doc) {
        var mime = String(doc && doc.mime_type || '').toLowerCase();
        var ext = String(doc && doc.file_ext || '').toLowerCase();
        if (mime.indexOf('image/') === 0 || ext === '.png' || ext === '.jpg' || ext === '.jpeg') return 'image';
        if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
        if (ext === '.xlsx' || ext === '.xls' || mime.indexOf('spreadsheet') !== -1 || mime.indexOf('excel') !== -1) return 'excel';
        return 'file';
    }

    function renderFinanceDocumentSlot(item) {
        var doc = financeDocumentFromItem(item);
        if (!doc) return '<div class="finance-doc-slot is-empty" data-finance-document-slot></div>';
        return '<div class="finance-doc-slot" data-finance-document-slot ' +
            'data-doc-id="' + escapeHtml(doc.id) + '" ' +
            'data-doc-kind="' + escapeHtml(financeDocumentKind(doc)) + '" ' +
            'data-doc-name="' + escapeHtml(doc.original_name || '\u0421\u0447\u0435\u0442') + '" ' +
            'data-doc-view-url="' + escapeHtml(doc.view_url || '') + '" ' +
            'data-doc-download-url="' + escapeHtml(doc.download_url || '') + '"></div>';
    }

    function clearFinanceNode(node) {
        while (node && node.firstChild) node.removeChild(node.firstChild);
    }

    function showFinanceToast(message) {
        var toast = qs('[data-finance-toast]');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'finance-toast';
            toast.setAttribute('data-finance-toast', '');
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('active');
        clearTimeout(showFinanceToast.timer);
        showFinanceToast.timer = setTimeout(function () {
            toast.classList.remove('active');
        }, 4200);
    }

    function ensureFinancePreviewModal() {
        var modal = qs('[data-finance-preview-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'finance-preview-modal';
        modal.setAttribute('data-finance-preview-modal', '');
        modal.hidden = true;

        var backdrop = document.createElement('div');
        backdrop.className = 'finance-preview-backdrop';
        backdrop.setAttribute('data-finance-preview-close', '');
        modal.appendChild(backdrop);

        var dialog = document.createElement('div');
        dialog.className = 'finance-preview-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        modal.appendChild(dialog);

        var head = document.createElement('div');
        head.className = 'finance-preview-head';
        dialog.appendChild(head);

        var title = document.createElement('b');
        title.setAttribute('data-finance-preview-title', '');
        head.appendChild(title);

        var close = document.createElement('button');
        close.className = 'ghost compact';
        close.type = 'button';
        close.textContent = 'X';
        close.setAttribute('aria-label', '\u0417\u0430\u043a\u0440\u044b\u0442\u044c');
        close.setAttribute('data-finance-preview-close', '');
        head.appendChild(close);

        var body = document.createElement('div');
        body.className = 'finance-preview-body';
        body.setAttribute('data-finance-preview-body', '');
        dialog.appendChild(body);

        modal.addEventListener('click', function (event) {
            if (!event.target.closest('[data-finance-preview-close]')) return;
            modal.hidden = true;
            clearFinanceNode(body);
        });
        document.body.appendChild(modal);
        return modal;
    }

    function openFinanceDocumentPreview(slot) {
        var kind = slot.dataset.docKind;
        if (kind !== 'image' && kind !== 'pdf') return;
        var modal = ensureFinancePreviewModal();
        var title = qs('[data-finance-preview-title]', modal);
        var body = qs('[data-finance-preview-body]', modal);
        if (title) title.textContent = slot.dataset.docName || '\u0421\u0447\u0435\u0442';
        clearFinanceNode(body);
        if (kind === 'image') {
            var image = document.createElement('img');
            image.src = slot.dataset.docViewUrl;
            image.alt = slot.dataset.docName || '\u0421\u0447\u0435\u0442';
            body.appendChild(image);
        } else {
            var frame = document.createElement('iframe');
            frame.src = slot.dataset.docViewUrl;
            frame.title = slot.dataset.docName || 'PDF';
            body.appendChild(frame);
        }
        modal.hidden = false;
    }

    function bindFinanceDocumentActions() {
        qsa('[data-finance-document-slot]').forEach(function (slot) {
            if (slot.dataset.bound === '1' || !slot.dataset.docId) return;
            slot.dataset.bound = '1';
            var kind = slot.dataset.docKind;
            if (kind === 'excel') {
                var link = document.createElement('a');
                link.className = 'finance-doc-pill is-excel';
                link.href = slot.dataset.docDownloadUrl || '#';
                link.title = '\u0421\u043a\u0430\u0447\u0430\u0442\u044c Excel';
                link.setAttribute('download', '');
                link.innerHTML = '<i data-lucide="file-spreadsheet"></i>';
                slot.appendChild(link);
                return;
            }
            var button = document.createElement('button');
            button.className = 'finance-doc-pill ' + (kind === 'image' ? 'is-thumb' : 'is-eye');
            button.type = 'button';
            button.title = kind === 'file' ? '\u0421\u043a\u0430\u0447\u0430\u0442\u044c' : '\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440';
            button.innerHTML = '<i data-lucide="' + (kind === 'image' || kind === 'pdf' ? 'eye' : 'file') + '"></i>';
            button.addEventListener('click', function () {
                if (kind === 'file') {
                    window.open(slot.dataset.docDownloadUrl, '_blank', 'noopener');
                    return;
                }
                openFinanceDocumentPreview(slot);
            });
            slot.appendChild(button);
        });
    }

    function renderFinanceStatusTracker(status) {
        var paid = status === 'paid';
        var cancelled = status === 'cancelled';
        return '<div class="finance-status-track ' + (paid ? 'is-paid' : '') + (cancelled ? ' is-cancelled' : '') + '">' +
            '<span class="finance-status-step is-submitted">' + escapeHtml(financeStatusLabel(cancelled ? 'cancelled' : 'approved')) + '</span>' +
            '<span class="finance-status-line"></span>' +
            '<span class="finance-status-step is-paid">' + escapeHtml(financeStatusLabel('paid')) + '</span>' +
        '</div>';
    }






    function userHasRoleCode(user, role) {
        if (!user) return false;
        if (normalizeRole(user.role) === role) return true;
        var roles = Array.isArray(user.roles) ? user.roles : [];
        return roles.some(function (item) {
            return normalizeRole(item && item.code ? item.code : item) === role;
        });
    }

    function ensureProjectAccessModal() {
        var modal = qs('[data-project-access-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'project-access-modal hidden';
        modal.setAttribute('data-project-access-modal', '');
        modal.innerHTML =
            '<button class="project-access-backdrop" type="button" data-project-access-close aria-label="Закрыть"></button>' +
            '<section class="project-access-dialog" role="dialog" aria-modal="true" aria-label="Доступ к объекту">' +
                '<div class="card-head">' +
                    '<div><h3>Доступ к объекту</h3><span class="muted" data-project-access-title></span></div>' +
                    '<button class="ghost compact" type="button" data-project-access-close>Закрыть</button>' +
                '</div>' +
                '<form data-project-access-form>' +
                    '<div class="project-access-list" data-project-access-list></div>' +
                    '<div class="form-error" data-project-access-error></div>' +
                    '<button class="primary" type="submit">Сохранить доступ</button>' +
                '</form>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (!event.target.closest('[data-project-access-close]')) return;
            closeProjectAccessModal();
        });
        var form = qs('[data-project-access-form]', modal);
        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                saveProjectAccess(form);
            });
        }
        document.body.appendChild(modal);
        return modal;
    }

    function closeProjectAccessModal() {
        var modal = qs('[data-project-access-modal]');
        if (!modal) return;
        modal.classList.add('hidden');
    }

    function renderProjectAccessModal(project, foremen) {
        var modal = ensureProjectAccessModal();
        var title = qs('[data-project-access-title]', modal);
        var list = qs('[data-project-access-list]', modal);
        var assigned = Array.isArray(project.assigned_foremen) ? project.assigned_foremen.map(Number) : [];
        if (title) title.textContent = project.title || '';
        if (list) {
            if (!foremen.length) {
                safeReplaceChildren(list, '<p class="muted">Прорабы пока не созданы.</p>');
            } else {
                safeReplaceChildren(list, foremen.map(function (user) {
                    var checked = assigned.indexOf(Number(user.id)) !== -1 ? ' checked' : '';
                    var meta = [user.login, user.email, user.phone].filter(Boolean).join(' - ');
                    return '<label class="project-access-row">' +
                        '<input type="checkbox" name="foreman_ids" value="' + escapeHtml(user.id) + '"' + checked + '> ' +
                        '<span><b>' + escapeHtml(user.name || user.login) + '</b><small>' + escapeHtml(meta || 'foreman') + '</small></span>' +
                    '</label>';
                }).join(''));
            }
        }
        var form = qs('[data-project-access-form]', modal);
        if (form) form.dataset.projectId = project.id;
        modal.classList.remove('hidden');
    }

    function openProjectAccessModal() {
        if (!isDirectorRole()) return;
        var project = state.selectedProject;
        if (!project) {
            showAppNotice('Сначала открой объект.', 'warn');
            return;
        }
        loadUserDirectory(function (users) {
            var foremen = users.filter(function (user) {
                return userHasRoleCode(user, 'foreman');
            });
            renderProjectAccessModal(project, foremen);
        });
    }

    function saveProjectAccess(form) {
        var projectId = Number(form.dataset.projectId || 0);
        var error = qs('[data-project-access-error]');
        if (error) error.classList.remove('active');
        var foremanIds = qsa('input[name="foreman_ids"]:checked', form).map(function (input) {
            return Number(input.value);
        });
        withSubmitLock(form, function () {
            return api('/api/users/manage', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'set_project_foremen',
                    project_id: projectId,
                    foreman_ids: foremanIds
                })
            }).then(function (data) {
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
                if (project) project.assigned_foremen = Array.isArray(data.assigned_foremen) ? data.assigned_foremen : foremanIds;
                if (state.selectedProject && Number(state.selectedProject.id) === projectId) {
                    state.selectedProject.assigned_foremen = project ? project.assigned_foremen : foremanIds;
                    loadProjectAssignments(projectId);
                }
                closeProjectAccessModal();
                showAppNotice('Доступ к объекту сохранён.', 'success');
            }).catch(function (err) {
                var message = appErrorMessage(err, 'Не удалось сохранить доступ.');
                if (error) {
                    error.textContent = message;
                    error.classList.add('active');
                }
                showAppNotice(message, 'error');
            });
        });
    }

    document.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-project-access-open]') : null;
        if (!button) return;
        event.preventDefault();
        openProjectAccessModal();
    });

    function openSupplierDeepLink(link) {
        if (!link) return;
        var supplierId = link.getAttribute('data-supplier-id') || '';
        var supplierName = link.getAttribute('data-supplier-name') || link.textContent || '';
        var projectId = link.getAttribute('data-project-id') || '';
        var kind = link.getAttribute('data-counterparty-kind') || '';
        var params = new URLSearchParams();
        if (projectId) params.set('projectId', projectId);
        if (supplierId) params.set('supplierId', supplierId);
        if (supplierName) params.set('supplierName', supplierName.trim());
        if (kind) params.set('counterpartyKind', kind);
        location.href = '/app/suppliers' + (params.toString() ? '?' + params.toString() : '');
    }

    document.addEventListener('click', function (event) {
        var link = event.target && event.target.closest ? event.target.closest('.supplier-link-click') : null;
        if (!link) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        openSupplierDeepLink(link);
    }, true);

    function topbarPageTitle() {
        var labels = {
            dashboard: 'Панель',
            projects: state.selectedProject && state.selectedProject.title ? state.selectedProject.title : 'Объекты',
            autobot: 'AutoBot',
            schedule: 'График работ',
            logs: 'Журнал работ',
            warehouse: 'Склад',
            suppliers: 'Контрагенты',
            chats: 'Чаты',
            users: 'Сотрудники',
            reports: 'Отчётность',
            companies: 'Компании'
        };
        return labels[page] || 'PM.bi';
    }

    function renderTopbarTemplate() {
        return '' +
            '<div class="topbar-left">' +
                '<button class="menu-btn topbar-icon-button" type="button" data-menu-toggle aria-label="Навигация" title="Навигация">' +
                    '<i data-lucide="panel-left" aria-hidden="true"></i>' +
                '</button>' +
                '<div class="topbar-page">' +
                    '<span class="topbar-page-icon" aria-hidden="true"><i data-lucide="' + (page === 'dashboard' ? 'layout-dashboard' : 'folder-kanban') + '"></i></span>' +
                    '<div class="topbar-page-copy">' +
                        '<span class="topbar-page-kicker">Рабочее пространство</span>' +
                        '<strong>' + escapeHtml(topbarPageTitle()) + '</strong>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="topbar-actions">' +
                '<div class="topbar-reminders-wrap">' +
                    '<button class="topbar-icon-button reminder-circle" type="button" data-reminder-toggle aria-label="Уведомления" title="Уведомления">' +
                        '<i data-lucide="bell" aria-hidden="true"></i>' +
                        '<span class="reminder-count" data-reminder-count hidden>0</span>' +
                    '</button>' +
                    '<div class="reminder-popover" data-reminder-popover hidden>' +
                        '<div class="reminder-popover-head">' +
                            '<div>' +
                                '<strong>Что горит</strong>' +
                                '<span data-reminder-subtitle>Проверяем объекты...</span>' +
                            '</div>' +
                            '<button class="ghost compact" type="button" data-reminder-refresh>Обновить</button>' +
                        '</div>' +
                        '<div data-reminder-list></div>' +
                    '</div>' +
                '</div>' +
                '<button class="topbar-icon-button ai-circle" type="button" data-ai-open aria-label="Открыть AI помощника" title="AI помощник">' +
                    '<i data-lucide="bot" aria-hidden="true"></i>' +
                '</button>' +
                '<div class="topbar-profile-wrap">' +
                    '<button class="topbar-profile" type="button" data-user-toggle aria-expanded="false" aria-label="Открыть личный кабинет" title="Личный кабинет">' +
                        userAvatarMarkup(state.currentUser || state.user || {}, 'topbar-avatar') +
                        '<i data-lucide="chevron-down" aria-hidden="true"></i>' +
                    '</button>' +
                    '<div class="user-popover" data-user-popover hidden>' +
                        '<div class="user-popover-head">' +
                            '<strong data-current-user>Профиль</strong>' +
                            '<span data-current-role>Роль</span>' +
                        '</div>' +
                        '<button class="topbar-profile-menu-item" type="button" data-profile-open>' +
                            '<i data-lucide="user-cog" aria-hidden="true"></i>' +
                            '<span>👤 Личный кабинет</span>' +
                        '</button>' +
                        '<button class="topbar-logout" type="button" data-logout aria-label="Выйти" title="Выйти">' +
                            '<i data-lucide="log-out" aria-hidden="true"></i>' +
                            '<span>Выйти</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function renderAppTopbar() {
        var topbar = qs('.topbar');
        if (!topbar) return;
        safeReplaceChildren(topbar, renderTopbarTemplate());
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({
                attrs: {
                    'aria-hidden': 'true'
                }
            });
        }
    }

    var baseInitShellForTopbarPolish = initShell;
    initShell = function () {
        renderAppTopbar();
        baseInitShellForTopbarPolish();
    };

    var baseEnsureProjectReportDrawerUx = ensureProjectReportDrawer;
    ensureProjectReportDrawer = function () {
        var drawer = baseEnsureProjectReportDrawerUx();
        if (drawer) {
            drawer.classList.add('reports-drawer-frame');
            var backdrop = qs('.side-drawer-backdrop', drawer);
            var panel = qs('.side-drawer-panel', drawer);
            if (backdrop) backdrop.classList.add('drawer-overlay');
            if (panel) panel.classList.add('reports-drawer-panel');
        }
        return drawer;
    };

    renderProjectReportsPanel = function (project) {
        return '<div class="project-reports-shell">' +
            '<section class="subsection report-calendar-top report-calendar-compact">' +
                '<div class="card-head report-page-head report-page-head-action">' +
                    (canCreateProjectReport() ? '<button class="primary compact report-create-button" type="button" data-open-project-report-create><i data-lucide="plus-circle"></i><span>Написать отчет</span></button>' : '') +
                '</div>' +
                '<section class="stats-grid" data-logs-stats></section>' +
                '<div data-logs-alerts></div>' +
                '<div data-logs-calendar></div>' +
            '</section>' +
            '<section class="project-reports-grid report-daily-layout report-daily-layout-full">' +
                '<section class="subsection report-archive-panel report-daily-timeline">' +
                    '<div class="card-head report-timeline-head"><div><h3>Прошедшие отчеты</h3><span class="muted">Аккуратная лента суточных рапортов по объекту.</span></div></div>' +
                    '<div data-report-archive-list data-logs-list><div class="report-archive-empty"><b>Архив отчетов</b><span>Сохраненные отчеты появятся здесь.</span></div></div>' +
                '</section>' +
                (canCreateProjectReport() ? '<div class="report-day-view-hidden" data-logs-day-view></div>' : '') +
            '</section>' +
            (canCreateProjectReport() ? '<div class="reports-drawer-host" data-project-report-create-card hidden>' + renderProjectReportForm(project) + '</div>' : '') +
        '</div>';
    };

    renderProjectReportForm = function (project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card report-chat-intake report-daily-form-card reports-drawer">' +
            '<div class="report-drawer-caption">Суточный рапорт</div>' +
            '<div class="card-head report-form-head"><div><h3>Новый отчет</h3><span class="muted">Коротко зафиксируйте факт работ, закупки и важные замечания по объекту.</span></div></div>' +
            '<form class="project-form report-intake-form report-chat-form report-chat-simple-form report-daily-form" data-log-form>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<input type="hidden" name="title" value="">' +
                '<input type="hidden" name="workers_count" value="0">' +
                '<input type="hidden" name="progress_percent" value="">' +
                '<input type="hidden" name="is_client_visible" value="1">' +
                '<input type="hidden" name="equipment" value="">' +
                '<input type="hidden" name="blockers" value="">' +
                '<input type="hidden" name="next_steps" value="">' +
                '<div class="report-chat-header report-chat-header-compact">' +
                    '<label><span>Дата</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                '</div>' +
                '<label class="report-chat-inputbox report-daily-textarea-field">' +
                    '<span>Что сделали сегодня</span>' +
                    '<textarea name="raw_input" rows="5" required placeholder="Например: демонтировали стены полностью, поставили розетки наполовину, купили все розетки."></textarea>' +
                '</label>' +
                '<label class="report-generated-box report-daily-generated-field">' +
                    '<span>Текст отчета</span>' +
                    '<textarea name="work_done" rows="4" readonly required tabindex="-1" placeholder="Готовый текст появится автоматически после ввода."></textarea>' +
                '</label>' +
                '<div class="assistant-confirm-card report-confirm-card">' +
                    '<b>Что применится после сохранения</b>' +
                    '<div data-report-preview></div>' +
                    '<label class="report-confirm"><span>Подтверждаю сохранение отчета и применение изменений</span><input type="checkbox" name="confirm_report" required></label>' +
                '</div>' +
                '<div class="form-error" data-log-error></div>' +
                '<div class="report-intake-actions">' +
                    '<button class="primary report-submit-button" type="submit">Отправить отчет</button>' +
                '</div>' +
            '</form>' +
        '</section>';
    };

    renderLogsList = function (project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        logs = Array.isArray(logs) ? logs : [];
        if (!logs.length) {
            safeReplaceChildren(root, '<div class="report-archive-empty"><b>Отчетов пока нет</b><span>По объекту "' + escapeHtml(project && project.title ? project.title : 'Объект') + '" еще нет сохраненных суточных рапортов.</span></div>');
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
            return;
        }
        safeReplaceChildren(root, '<div class="report-archive-list">' + logs.map(function (log) {
            var authorName = log.author_name || 'Без автора';
            var status = reportLogStatus(log);
            var reportDateLabel = finalGraphDate(log.report_date || APP_TODAY);
            return '<article class="report-archive-card report-timeline-card log-card is-' + escapeHtml(status.kind) + (status.kind === 'danger' ? ' is-danger' : '') + '">' +
                '<div class="report-timeline-card-top">' +
                    '<div class="report-date-badge"><i data-lucide="calendar"></i><strong>Отчет за ' + escapeHtml(reportDateLabel) + '</strong></div>' +
                    '<div class="report-timeline-meta">' +
                        '<time>' + escapeHtml(reportCreatedDateTime(log)) + '</time>' +
                        '<span class="badge ' + (status.kind === 'danger' ? 'danger' : 'success') + '">' + escapeHtml(status.label) + '</span>' +
                        renderProjectReportDeleteButton(project && project.id, log, true) +
                    '</div>' +
                '</div>' +
                '<div class="report-timeline-card-body">' +
                    '<div class="report-author-block report-author-column">' +
                        '<span class="report-author-avatar">' + escapeHtml(reportAuthorInitials(authorName)) + '</span>' +
                        '<div><small>Прораб</small><strong>' + escapeHtml(authorName) + '</strong></div>' +
                    '</div>' +
                    '<div class="report-timeline-content">' +
                        '<p>' + escapeHtml(log.work_done || 'Текст отчета не указан') + '</p>' +
                        '<div class="log-details">' +
                            (log.equipment ? '<div><span>Техника</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                            (log.blockers ? '<div class="log-risk"><span>Блокер</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                            (log.next_steps ? '<div><span>Дальше</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                        '</div>' +
                        (log.raw_input ? '<small class="muted">Исходный ввод: ' + escapeHtml(log.raw_input) + '</small>' : '') +
                    '</div>' +
                '</div>' +
            '</article>';
        }).join('') + '</div>');
        bindProjectReportDeleteActions();
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    };

    function projectOverviewMetaItemV2(label, value) {
        return '<div class="project-overview-meta-item"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value || '—') + '</strong></div>';
    }

    function projectOverviewCompactTextV2(value, maxLength) {
        var text = String(value || '').trim().replace(/\s+/g, ' ');
        var limit = Number(maxLength) || 96;
        if (!text) return '';
        if (text.length <= limit) return text;
        return text.slice(0, Math.max(0, limit - 1)).trim() + '…';
    }

    function projectOverviewMetricV2(label, value, icon, note, contentHtml, className) {
        return '<article class="project-overview-widget ui-card' + (className ? (' ' + className) : '') + '">' +
            '<div class="project-overview-widget-head">' +
                '<span class="project-overview-widget-label">' + escapeHtml(label) + '</span>' +
                '<span class="project-overview-widget-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(icon || 'circle') + '"></i></span>' +
            '</div>' +
            '<div class="project-overview-widget-value">' + escapeHtml(value || '0') + '</div>' +
            (note ? '<div class="project-overview-widget-note">' + escapeHtml(note) + '</div>' : '') +
            (contentHtml ? '<div class="project-overview-widget-body">' + contentHtml + '</div>' : '') +
        '</article>';
    }

    function projectOverviewIsoDateV2(value) {
        var raw = String(value || '').trim();
        var match = raw.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/);
        return match ? (match[1] + '-' + match[2] + '-' + match[3]) : '';
    }

    function projectOverviewRelativeDateV2(value) {
        var iso = projectOverviewIsoDateV2(value);
        if (!iso) return 'Без даты';
        var diff = signedDaysBetween(APP_TODAY, iso);
        if (diff === 0) return 'Сегодня';
        if (diff === -1) return 'Вчера';
        if (diff === 1) return 'Завтра';
        return formatDisplayDate(iso);
    }

    function projectOverviewDeadlineToneV2(value) {
        var iso = projectOverviewIsoDateV2(value);
        var diff = iso ? signedDaysBetween(APP_TODAY, iso) : null;
        if (diff == null) return '';
        if (diff < 0) return 'danger';
        if (diff <= 2) return 'warn';
        return '';
    }

    function projectOverviewDeadlineHintV2(value) {
        var iso = projectOverviewIsoDateV2(value);
        var diff = iso ? signedDaysBetween(APP_TODAY, iso) : null;
        if (diff == null) return 'Без срока';
        if (diff < 0) return 'Просрочено на ' + Math.abs(diff) + ' дн.';
        if (diff === 0) return 'Срок сегодня';
        if (diff <= 5) return 'Осталось ' + diff + ' дн.';
        return 'Запланировано';
    }

    function projectOverviewWidgetProgressV2(progress, doneStages, totalStages) {
        var safeProgress = percent(progress);
        var note = totalStages ? (String(doneStages) + ' из ' + String(totalStages) + ' этапов закрыто') : 'Этапы ещё формируются';
        return projectOverviewMetricV2(
            'Прогресс этапа',
            safeProgress + '%',
            'activity',
            note,
            '<div class="project-overview-inline-stats">' +
                '<span><b>' + escapeHtml(String(doneStages)) + '</b><small>готово</small></span>' +
                '<span><b>' + escapeHtml(String(Math.max(0, totalStages - doneStages))) + '</b><small>в работе</small></span>' +
            '</div>' +
            '<div class="project-overview-widget-progress"><span style="width:' + safeProgress + '%"></span></div>',
            'is-accent'
        );
    }

    function projectOverviewWidgetSupplyV2(materials) {
        var list = Array.isArray(materials) ? materials : [];
        var onSite = 0;
        var onRoute = 0;
        var required = 0;
        list.forEach(function (item) {
            var status = String(item && item.supplyStatus || '');
            if (status === 'in_stock') onSite += 1;
            if (status === 'planned' || status === 'soon') onRoute += 1;
            if (status === 'required') required += 1;
        });
        return projectOverviewMetricV2(
            'Закупки / Склад',
            String(onSite),
            'boxes',
            required ? ('Критично закрыть: ' + required) : 'Склад и поставки под контролем',
            '<div class="project-overview-kpi-pairs">' +
                '<div><span>На объекте</span><strong>' + escapeHtml(String(onSite)) + '</strong></div>' +
                '<div><span>Едет</span><strong>' + escapeHtml(String(onRoute)) + '</strong></div>' +
            '</div>'
        );
    }

    function projectOverviewWidgetFinanceV2(project) {
        var budget = Number(project && project.budget || 0);
        var spent = Number(project && (project.spent != null ? project.spent : project.paid) || 0);
        var margin = budget > 0 ? Math.round(((budget - spent) / budget) * 100) : 0;
        return projectOverviewMetricV2(
            'Финансы',
            money(spent),
            'trending-up',
            budget > 0 ? ('Маржинальность ' + margin + '%') : 'Бюджет не заполнен',
            '<div class="project-overview-kpi-pairs project-overview-finance-pairs">' +
                '<div><span>Бюджет</span><strong>' + escapeHtml(money(budget)) + '</strong></div>' +
                '<div><span>Маржа</span><strong>' + escapeHtml(String(margin)) + '%</strong></div>' +
            '</div>',
            isAdminRole() ? '' : 'hidden'
        );
    }

    function projectOverviewWidgetControlV2(project, tasks, logs) {
        var activeTasks = (tasks || []).filter(function (task) { return task.status !== 'done'; }).length;
        var latestLog = logs && logs.length ? logs[0] : null;
        return projectOverviewMetricV2(
            'Контур контроля',
            String(activeTasks),
            'shield-alert',
            project && project.deadline_at ? projectOverviewDeadlineHintV2(project.deadline_at) : 'Дедлайн не задан',
            '<div class="project-overview-kpi-pairs">' +
                '<div><span>Открытых задач</span><strong>' + escapeHtml(String(activeTasks)) + '</strong></div>' +
                '<div><span>Последний лог</span><strong>' + escapeHtml(latestLog && latestLog.report_date ? formatDisplayDate(latestLog.report_date) : '—') + '</strong></div>' +
            '</div>'
        );
    }

    function projectOverviewTimelineEventsV2(data) {
        var events = [];
        var tasks = data.tasks || [];
        var logs = data.logs || [];
        var materials = data.materials || [];
        var stages = data.stages || [];
        logs.slice(0, 4).forEach(function (log) {
            events.push({
                date: projectOverviewIsoDateV2(log.report_date || log.created_at),
                icon: log.blockers ? 'triangle-alert' : 'messages-square',
                title: log.title || 'Ежедневный отчет',
                text: log.blockers ? ('Блокер: ' + projectOverviewCompactTextV2(log.blockers, 84)) : projectOverviewCompactTextV2(log.work_done || 'Обновлен ежедневный отчет.', 96),
                tone: log.blockers ? 'danger' : '',
                meta: (log.author_name || 'Прораб') + ' • ' + projectOverviewRelativeDateV2(log.report_date || log.created_at)
            });
        });
        tasks.filter(function (task) {
            return task.status !== 'done' && (task.priority === 'high' || (task.due_at && task.due_at <= isoDateAdd(APP_TODAY, 3)));
        }).slice(0, 3).forEach(function (task) {
            events.push({
                date: projectOverviewIsoDateV2(task.due_at || task.created_at),
                icon: task.status === 'review' ? 'clipboard-check' : 'check-check',
                title: task.title || 'Задача',
                text: 'Статус: ' + statusLabel(task.status) + (task.due_at ? ' • срок ' + formatDisplayDate(task.due_at) : ''),
                tone: task.due_at && task.due_at < APP_TODAY ? 'danger' : (task.priority === 'high' ? 'warn' : ''),
                meta: 'Задачи • ' + projectOverviewRelativeDateV2(task.due_at || task.created_at)
            });
        });
        materials.filter(function (item) {
            return Number(item.missingQty || 0) > 0 && ['required', 'soon'].indexOf(String(item.supplyStatus || '')) !== -1;
        }).slice(0, 3).forEach(function (item) {
            events.push({
                date: projectOverviewIsoDateV2(item.needByDate || item.stageStartDate || item.stageEndDate),
                icon: 'package-search',
                title: item.title || 'Материал',
                text: 'Нехватка ' + String(item.missingQty || 0) + ' ' + (item.unit || '') + (item.needByDate ? (' • к ' + formatDisplayDate(item.needByDate)) : ''),
                tone: item.supplyStatus === 'required' ? 'danger' : 'warn',
                meta: 'Снабжение • ' + projectOverviewRelativeDateV2(item.needByDate || item.stageStartDate || item.stageEndDate)
            });
        });
        stages.filter(function (stage) {
            return stage.status_code === 'blocked' || stage.status_code === 'overdue';
        }).slice(0, 2).forEach(function (stage) {
            events.push({
                date: projectOverviewIsoDateV2(stage.planned_end || stage.updated_at),
                icon: 'hard-hat',
                title: stage.title || 'Этап',
                text: 'Статус: ' + statusLabel(stage.status_code) + ' • прогресс ' + percent(stage.progress) + '%',
                tone: 'danger',
                meta: 'Этапы • ' + projectOverviewRelativeDateV2(stage.planned_end || stage.updated_at)
            });
        });
        return events.sort(function (left, right) {
            return String(right.date || '').localeCompare(String(left.date || ''));
        }).slice(0, 8);
    }

    function projectOverviewDeadlineItemsV2(tasks, materials) {
        var horizon = isoDateAdd(APP_TODAY, 5);
        var items = [];
        (tasks || []).forEach(function (task) {
            if (task.status === 'done' || !task.due_at || task.due_at > horizon) return;
            items.push({
                date: task.due_at,
                icon: 'list-todo',
                title: task.title || 'Задача',
                text: 'Статус: ' + statusLabel(task.status),
                tone: projectOverviewDeadlineToneV2(task.due_at) || (task.priority === 'high' ? 'warn' : ''),
                note: projectOverviewDeadlineHintV2(task.due_at)
            });
        });
        (materials || []).forEach(function (item) {
            if (['required', 'soon'].indexOf(String(item.supplyStatus || '')) === -1) return;
            if (!item.needByDate || item.needByDate > horizon) return;
            items.push({
                date: item.needByDate,
                icon: 'boxes',
                title: item.title || 'Материал',
                text: (item.supplyStatus === 'required' ? 'Критическая закупка' : 'Нужно подтянуть поставку') + (item.missingQty ? (' • нехватка ' + item.missingQty + ' ' + (item.unit || '')) : ''),
                tone: projectOverviewDeadlineToneV2(item.needByDate) || planningStatusClass(item.supplyStatus),
                note: projectOverviewDeadlineHintV2(item.needByDate)
            });
        });
        return items.sort(function (left, right) {
            return String(left.date || '').localeCompare(String(right.date || ''));
        }).slice(0, 8);
    }

    renderProjectOverviewHero = function (project) {
        return '<section class="project-overview-shell">' +
            '<section class="project-overview-hero ui-card">' +
                '<div class="project-overview-head">' +
                    '<div class="project-overview-heading">' +
                        '<h3>' + escapeHtml(project.title || 'Без названия') + '</h3>' +
                        '<p>' + escapeHtml(project.address || 'Адрес не указан') + '</p>' +
                    '</div>' +
                '</div>' +
                '<div class="project-overview-meta">' +
                    projectOverviewMetaItemV2('Заказчик', project.client_name || 'Не указан') +
                    projectOverviewMetaItemV2('Договор', project.contract_no || 'Не указан') +
                    projectOverviewMetaItemV2('Старт', project.started_at ? formatDisplayDate(project.started_at) : '—') +
                    projectOverviewMetaItemV2('Дедлайн', project.deadline_at ? formatDisplayDate(project.deadline_at) : '—') +
                    projectOverviewMetaItemV2('Город', project.city || 'Не указан') +
                    projectOverviewMetaItemV2('Регион', project.region || 'Не указан') +
                '</div>' +
                (project.description ? '<div class="object-description project-overview-description">' + escapeHtml(project.description) + '</div>' : '') +
            '</section>' +
            '<div data-project-hub>' +
                '<div class="project-overview-kpi-grid">' +
                    projectOverviewWidgetProgressV2(project.progress, 0, 0) +
                    projectOverviewWidgetSupplyV2([]) +
                    projectOverviewWidgetFinanceV2(project) +
                    projectOverviewWidgetControlV2(project, [], []) +
                '</div>' +
            '</div>' +
        '</section>';
    };

    renderProjectHub = function (project, data) {
        var tasks = data.tasks || [];
        var logs = data.logs || [];
        var materials = data.materials || [];
        var stages = data.stages || [];
        var doneStages = stages.filter(function (stage) {
            return ['completed', 'approved'].indexOf(stage.status_code) !== -1 || percent(stage.progress) >= 100;
        }).length;
        return '<div class="project-overview-kpi-grid">' +
            projectOverviewWidgetProgressV2(project.progress, doneStages, stages.length) +
            projectOverviewWidgetSupplyV2(materials) +
            projectOverviewWidgetFinanceV2(project) +
            projectOverviewWidgetControlV2(project, tasks, logs) +
        '</div>';
    };

    bindMaterialScheduleTimeline();
    installVisibleDateFormatter();

    if (page === 'login') initLogin();
    else initShell();
})();
