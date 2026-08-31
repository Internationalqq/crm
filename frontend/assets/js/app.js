(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    if (PMBI.app && PMBI.app.__loaded) return;
    PMBI.app = PMBI.app || {};
    PMBI.app.__loaded = true;
    var page = PMBI.page;
    var APP_TODAY = PMBI.APP_TODAY;
    var state = PMBI.state;
    var rememberSessionEnabled = PMBI.rememberSessionEnabled;
    var setRememberSession = PMBI.setRememberSession;
    var wasAutoLoginAttempted = PMBI.wasAutoLoginAttempted;
    var markAutoLoginAttempted = PMBI.markAutoLoginAttempted;
    var clearAutoLoginAttempt = PMBI.clearAutoLoginAttempt;
    var resetRememberAuthState = PMBI.resetRememberAuthState;
    var loadCurrentUser = PMBI.loadCurrentUser;
    var qs = PMBI.qs;
    var qsa = PMBI.qsa;
    var bindHorizontalWheelScroll = PMBI.bindHorizontalWheelScroll;
    var safeReplaceChildren = PMBI.safeReplaceChildren;
    var showSkeleton = PMBI.showSkeleton;
    var refreshLucideIcons = PMBI.refreshLucideIcons;
    var showAppNotice = PMBI.showAppNotice;
    var getAutoBotLoaderHTML = PMBI.getAutoBotLoaderHTML;
    var appErrorMessage = PMBI.appErrorMessage;
    var withSubmitLock = PMBI.withSubmitLock;
    var beginProjectLoading = PMBI.beginProjectLoading;
    var isCurrentProject = PMBI.isCurrentProject;
    var escapeHtml = PMBI.escapeHtml;
    var displayUserName = PMBI.displayUserName;
    var safeAvatarUrl = PMBI.safeAvatarUrl;
    var computeUserInitial = PMBI.computeUserInitial;
    var rememberUserInitial = PMBI.rememberUserInitial;
    var profileUserInitials = PMBI.profileUserInitials;
    var userAvatarMarkup = PMBI.userAvatarMarkup;
    var topbarAvatarInner = PMBI.topbarAvatarInner;
    var forceTopbarAvatar = PMBI.forceTopbarAvatar;
    var safeExternalUrl = PMBI.safeExternalUrl;
    var safeTelHref = PMBI.safeTelHref;
    var formatDisplayDate = PMBI.formatDisplayDate;
    var installVisibleDateFormatter = PMBI.installVisibleDateFormatter;
    var isClerkEnabled = PMBI.isClerkEnabled;
    var loadClerk = PMBI.loadClerk;
    var api = PMBI.api;
    var apiFormData = PMBI.apiFormData;
    var clearApiCache = PMBI.clearApiCache;
    var abortApiRequests = PMBI.abortApiRequests;
    var debounce = PMBI.debounce;
    var money = PMBI.money;
    var percent = PMBI.percent;
    var progressSectionId = PMBI.progressSectionId;
    var canonicalEstimateSectionTitle = PMBI.canonicalEstimateSectionTitle;
    var canonicalEstimateSectionId = PMBI.canonicalEstimateSectionId;
    var progressSelectorValue = PMBI.progressSelectorValue;
    var updateProjectProgressState = PMBI.updateProjectProgressState;
    var updateProgressNode = PMBI.updateProgressNode;
    var updateUIProgress = PMBI.updateUIProgress;
    var applyProgressApiResponse = PMBI.applyProgressApiResponse;
    var isoDateAdd = PMBI.isoDateAdd;
    var formatRuDate = PMBI.formatRuDate;
    var downloadTextFile = PMBI.downloadTextFile;
    var downloadCsv = PMBI.downloadCsv;
    var normalizeRole = PMBI.normalizeRole;
    var hasRole = PMBI.hasRole;
    var currentRoleLabel = PMBI.currentRoleLabel;
    var isBootstrapAdminUser = PMBI.isBootstrapAdminUser;
    var effectiveUserRoles = PMBI.effectiveUserRoles;
    var isSuperAdminRole = PMBI.isSuperAdminRole;
    var isMainAdminRole = PMBI.isMainAdminRole;
    var isDirectorRole = PMBI.isDirectorRole;
    var isForemanRole = PMBI.isForemanRole;
    var isGuestRole = PMBI.isGuestRole || function () { return hasRole('guest'); };
    var isAdminRole = PMBI.isAdminRole;
    var currentPermissions = PMBI.currentPermissions;
    var personDisplayName = PMBI.personDisplayName;
    var allowedModules = PMBI.allowedModules;
    var canManageTeam = PMBI.canManageTeam;
    var canManageDailyTasks = PMBI.canManageDailyTasks;
    var canViewPrivateContacts = PMBI.canViewPrivateContacts;
    var canViewProcurementPrices = PMBI.canViewProcurementPrices;
    var canSeeFinances = PMBI.canSeeFinances;
    var canViewProjectEconomics = PMBI.canViewProjectEconomics;
    var canManageSuppliers = PMBI.canManageSuppliers;
    var canManageDocuments = PMBI.canManageDocuments;
    var canManageSchedule = PMBI.canManageSchedule;
    function canApplyDailyReportMaterialActions() {
        return !!(canManageSchedule && canManageSchedule()) || hasRole('purchaser');
    }

    function canApplyDailyReportWorkActions() {
        return !!(canManageSchedule && canManageSchedule());
    }
    var nextPath = PMBI.nextPath;
    var userInitials = PMBI.userInitials;
    var readStoredJson = (window.PMBI.core && window.PMBI.core.readStoredJson) || window.readStoredJson || PMBI.readStoredJson;
    var writeStoredJson = (window.PMBI.core && window.PMBI.core.writeStoredJson) || window.writeStoredJson || PMBI.writeStoredJson;
    function initDailyTasksPage() {
        return PMBI.dailyTasks && PMBI.dailyTasks.initDailyTasksPage ? PMBI.dailyTasks.initDailyTasksPage() : null;
    }
    function checkDailyStandup() {
        return PMBI.dailyTasks && PMBI.dailyTasks.checkDailyStandup ? PMBI.dailyTasks.checkDailyStandup() : null;
    }
    function finalGraphDate(iso) {
        return formatDisplayDate(iso);
    }
    function planningCall(name, args) {
        var fn = PMBI.planning && PMBI.planning[name];
        if (typeof fn !== 'function') {
            throw new Error('PMBI.planning.' + name + ' is not available');
        }
        return fn.apply(null, args);
    }
    function renderSchedulePage() { return planningCall('renderSchedulePage', arguments); }
    function renderSchedulePanel() { return planningCall('renderSchedulePanel', arguments); }
    function renderScheduleStateBoard() { return planningCall('renderScheduleStateBoard', arguments); }
    function bindScheduleStatusActions() { return planningCall('bindScheduleStatusActions', arguments); }
    function closeAutoScheduleDrawer() { return planningCall('closeAutoScheduleDrawer', arguments); }
    function openAutoScheduleDrawer() { return planningCall('openAutoScheduleDrawer', arguments); }
    function bindAutoScheduleForm() { return planningCall('bindAutoScheduleForm', arguments); }
    function loadSectionScheduleForecast() { return planningCall('loadSectionScheduleForecast', arguments); }
    function renderSectionScheduleForecast() { return planningCall('renderSectionScheduleForecast', arguments); }
    function bindSectionScheduleRefresh() { return planningCall('bindSectionScheduleRefresh', arguments); }
    function bindSectionScheduleInteractions() { return planningCall('bindSectionScheduleInteractions', arguments); }
    function renderScheduleProcurementBoard() { return planningCall('renderScheduleProcurementBoard', arguments); }
    function renderSectionScheduleRow() { return planningCall('renderSectionScheduleRow', arguments); }
    function renderScheduleScale() { return planningCall('renderScheduleScale', arguments); }
    function scheduleDeadlineState() { return planningCall('scheduleDeadlineState', arguments); }
    function scheduleDeadlineBadge() { return planningCall('scheduleDeadlineBadge', arguments); }
    function renderSectionScheduleBrief() { return planningCall('renderSectionScheduleBrief', arguments); }
    function materialProgress() { return planningCall('materialProgress', arguments); }
    function workProgress() { return planningCall('workProgress', arguments); }
    function workProgressForRows() { return planningCall('workProgressForRows', arguments); }
    function scheduleSectionProgress() { return planningCall('scheduleSectionProgress', arguments); }
    function liveScheduleSectionItems() { return planningCall('liveScheduleSectionItems', arguments); }
    function sectionTitleForMaterial() { return planningCall('sectionTitleForMaterial', arguments); }
    function finalSectionSummaryNumber() { return planningCall('finalSectionSummaryNumber', arguments); }
    function finalSectionSummaryTitle() { return planningCall('finalSectionSummaryTitle', arguments); }
    function normalizedWorkKeyPart() { return planningCall('normalizedWorkKeyPart', arguments); }
    function normalizedWorkQty() { return planningCall('normalizedWorkQty', arguments); }
    function isScheduleWorkDone() { return planningCall('isScheduleWorkDone', arguments); }
    function scheduleWorkKey() { return planningCall('scheduleWorkKey', arguments); }
    function estimateTotalSectionCount() { return planningCall('estimateTotalSectionCount', arguments); }
    function scheduleChecklistStorageKey() { return planningCall('scheduleChecklistStorageKey', arguments); }
    function setScheduleWorkDone() { return planningCall('setScheduleWorkDone', arguments); }
    function scheduleProjectDetails() { return planningCall('scheduleProjectDetails', arguments); }
    function setScheduleProjectDetails() { return planningCall('setScheduleProjectDetails', arguments); }
    function refreshScheduleProjectBody() { return planningCall('refreshScheduleProjectBody', arguments); }
    function materialScheduleForProject() { return planningCall('materialScheduleForProject', arguments); }
    function setMaterialScheduleForProject() { return planningCall('setMaterialScheduleForProject', arguments); }
    function loadMaterialSchedule() { return planningCall('loadMaterialSchedule', arguments); }
    function renderMaterialScheduleContainer() { return planningCall('renderMaterialScheduleContainer', arguments); }
    function replaceSelectedProjectMaterialCalendar() { return planningCall('replaceSelectedProjectMaterialCalendar', arguments); }
    function loadSelectedProjectMaterialSchedule() { return planningCall('loadSelectedProjectMaterialSchedule', arguments); }
    function focusProjectMaterialRow() { return planningCall('focusProjectMaterialRow', arguments); }
    function bindMaterialScheduleTimeline() { return planningCall('bindMaterialScheduleTimeline', arguments); }
    function loadProjectLogs(projectId, callback) {
        return api('/api/projects/' + projectId + '/daily-logs').then(function (data) {
            var logs = Array.isArray(data && data.logs) ? data.logs : [];
            if (typeof callback === 'function') callback(logs);
            return logs;
        }).catch(function () {
            var cachedLogs = state.projectLogsByProject && Array.isArray(state.projectLogsByProject[projectId])
                ? state.projectLogsByProject[projectId]
                : [];
            if (typeof callback === 'function') callback(cachedLogs);
            return cachedLogs;
        });
    }
    function finalSectionWorkDigest() { return { lead: '', volume: '', titles: '' }; }
    function procurementCall(name, args) {
        var fn = PMBI.procurement && PMBI.procurement[name];
        if (typeof fn !== 'function') {
            throw new Error('PMBI.procurement.' + name + ' is not available');
        }
        return fn.apply(null, args);
    }
    function loadCompanies() { return procurementCall('loadCompanies', arguments); }
    function ensureCounterpartyCompanies() { return procurementCall('ensureCounterpartyCompanies', arguments); }
    function companyTypeLabel() { return procurementCall('companyTypeLabel', arguments); }
    function counterpartyTypeLabel() { return procurementCall('counterpartyTypeLabel', arguments); }
    function counterpartyTypeClass() { return procurementCall('counterpartyTypeClass', arguments); }
    function counterpartyInitials() { return procurementCall('counterpartyInitials', arguments); }
    function counterpartyAvatarStyle() { return procurementCall('counterpartyAvatarStyle', arguments); }
    function counterpartyWebsite() { return procurementCall('counterpartyWebsite', arguments); }
    function counterpartyBindingStats() { return procurementCall('counterpartyBindingStats', arguments); }
    function renderCounterpartyCard() { return procurementCall('renderCounterpartyCard', arguments); }
    function initCompaniesPage() { return procurementCall('initCompaniesPage', arguments); }
    function initSuppliersPage() { return procurementCall('initSuppliersPage', arguments); }
    function renderWarehousePage() { return procurementCall('renderWarehousePage', arguments); }
    function renderProjectMaterialsTab() { return procurementCall('renderProjectMaterialsTab', arguments); }
    function renderProjectWorksTab() { return procurementCall('renderProjectWorksTab', arguments); }
    function rerenderProjectMarketTab() { return procurementCall('rerenderProjectMarketTab', arguments); }
    function bindProjectMarketToggles() { return procurementCall('bindProjectMarketToggles', arguments); }
    function renderCounterpartyPicker() { return procurementCall('renderCounterpartyPicker', arguments); }
    function renderCounterpartyFilter() { return procurementCall('renderCounterpartyFilter', arguments); }
    function filterItemsByCounterparty() { return procurementCall('filterItemsByCounterparty', arguments); }
    function bindCounterpartyFilters() { return procurementCall('bindCounterpartyFilters', arguments); }
    function renderGroupedMaterials() { return procurementCall('renderGroupedMaterials', arguments); }
    function renderEstimateWorkItem() { return procurementCall('renderEstimateWorkItem', arguments); }
    function renderProjectMarketBlock() { return procurementCall('renderProjectMarketBlock', arguments); }
    function renderProjectTabViewSwitcher() { return procurementCall('renderProjectTabViewSwitcher', arguments); }
    function bindMarketCreateButtons() { return procurementCall('bindMarketCreateButtons', arguments); }
    function warehouseQtyText() { return procurementCall('warehouseQtyText', arguments); }
    function warehouseTypeLabel() { return procurementCall('warehouseTypeLabel', arguments); }
    function warehouseConditionLabel() { return procurementCall('warehouseConditionLabel', arguments); }
    function loadWarehouseCatalog() { return procurementCall('loadWarehouseCatalog', arguments); }
    function renderWarehouseCatalog() { return procurementCall('renderWarehouseCatalog', arguments); }
    function loadWarehouseMatches() { return procurementCall('loadWarehouseMatches', arguments); }
    function renderWarehouseMatchBadge() { return procurementCall('renderWarehouseMatchBadge', arguments); }
    function renderMaterialDeliveryField() { return procurementCall('renderMaterialDeliveryField', arguments); }
    function renderProjectOverviewHero() { return ''; }
    function operationsCall(name, args) {
        var fn = PMBI.operations && PMBI.operations[name];
        if (typeof fn !== 'function') {
            throw new Error('PMBI.operations.' + name + ' is not available');
        }
        return fn.apply(null, args);
    }
    function loadRoles() { return operationsCall('loadRoles', arguments); }
    function roleOptionLabel() { return operationsCall('roleOptionLabel', arguments); }
    function syncUserRoleOptions() { return operationsCall('syncUserRoleOptions', arguments); }
    function initUsersPage() { return operationsCall('initUsersPage', arguments); }
    function initTeamPage() { return operationsCall('initTeamPage', arguments); }
    function initReportsPage() { return operationsCall('initReportsPage', arguments); }
    function renderLogsPage() { return operationsCall('renderLogsPage', arguments); }
    function loadUsers() { return operationsCall('loadUsers', arguments); }
    function formatUserPhone() { return operationsCall('formatUserPhone', arguments); }
    function isCompleteUserPhone() { return operationsCall('isCompleteUserPhone', arguments); }
    function isValidUserEmail() { return operationsCall('isValidUserEmail', arguments); }
    function bindUserPhoneMask() { return operationsCall('bindUserPhoneMask', arguments); }
    function setupCompanyCreateModal() { return operationsCall('setupCompanyCreateModal', arguments); }
    function resetCompanyCreateForm() { return operationsCall('resetCompanyCreateForm', arguments); }
    function closeCompanyCreateModal() { return operationsCall('closeCompanyCreateModal', arguments); }
    function openProfileModal() { return operationsCall('openProfileModal', arguments); }
    function toggleAiAssistantDrawer() { return operationsCall('toggleAiAssistantDrawer', arguments); }
    function canCreateProjectReport() { return operationsCall('canCreateProjectReport', arguments); }
    function bindProjectOverviewActions() { return operationsCall('bindProjectOverviewActions', arguments); }
    function ensureProjectEditCard() { return operationsCall('ensureProjectEditCard', arguments); }
    function openProjectEdit() { return operationsCall('openProjectEdit', arguments); }
    function bindProjectEditForm() { return operationsCall('bindProjectEditForm', arguments); }
    function ensureProjectReportDrawer() { return operationsCall('ensureProjectReportDrawer', arguments); }
    function renderProjectReportForm() { return operationsCall('renderProjectReportForm', arguments); }
    function renderProjectReportsPanel() { return operationsCall('renderProjectReportsPanel', arguments); }
    function refreshProjectReportsTab() { return operationsCall('refreshProjectReportsTab', arguments); }
    function bindProjectReportAssistantActions() { return operationsCall('bindProjectReportAssistantActions', arguments); }
    function getProjectTabMode() { return operationsCall('getProjectTabMode', arguments); }
    function setProjectTabMode() { return operationsCall('setProjectTabMode', arguments); }
    function renderLogsStats() { return operationsCall('renderLogsStats', arguments); }
    function renderLogsAlerts() { return operationsCall('renderLogsAlerts', arguments); }
    function renderLogsCalendar() { return operationsCall('renderLogsCalendar', arguments); }
    function renderLogsDayView() { return operationsCall('renderLogsDayView', arguments); }
    function renderLogsList() { return operationsCall('renderLogsList', arguments); }
    function bindLogForm() { return operationsCall('bindLogForm', arguments); }
    function ensureRoleCreateModal() { return operationsCall('ensureRoleCreateModal', arguments); }
    function openRoleCreateModal() { return operationsCall('openRoleCreateModal', arguments); }
    function closeRoleCreateModal() { return operationsCall('closeRoleCreateModal', arguments); }
    function rolePermissionsFromForm() { return operationsCall('rolePermissionsFromForm', arguments); }
    function submitRoleCreateForm() { return operationsCall('submitRoleCreateForm', arguments); }
    function showLoginError(message) {
        var error = qs('[data-login-error]');
        if (!error) return;
        error.textContent = message;
        error.classList.add('active');
    }

    function autoLoginErrorMessage() {
        return 'Сессия устарела или доступ изменился. Введите пароль заново.';
    }

    function stopBrokenAutoLogin(message) {
        return resetRememberAuthState().finally(function () {
            var form = qs('[data-login-form]');
            if (form && form.rememberMe) form.rememberMe.checked = false;
            showLoginError(message || autoLoginErrorMessage());
        });
    }

    function bindPasswordResetForm() {
        var form = qs('[data-password-reset-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-password-reset-error]');
            var success = qs('[data-password-reset-success]');
            var button = form.querySelector('button[type="submit"]');
            if (error) {
                error.textContent = '';
                error.classList.remove('active');
            }
            if (success) {
                success.textContent = '';
                success.classList.remove('active');
            }
            var email = String(form.email && form.email.value || '').trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                if (error) {
                    error.textContent = 'Введите email, указанный в учетной записи.';
                    error.classList.add('active');
                }
                return;
            }
            if (button) button.disabled = true;
            api('/api/auth/request-password-reset', {
                method: 'POST',
                body: JSON.stringify({ email: email })
            }).then(function (data) {
                if (success) {
                    success.textContent = data && data.message || 'Если такой email есть в системе, новый пароль отправлен на почту.';
                    success.classList.add('active');
                }
                form.reset();
            }).catch(function (err) {
                if (error) {
                    error.textContent = appErrorMessage(err, 'Не удалось отправить новый пароль. Попробуйте позже.');
                    error.classList.add('active');
                }
            }).finally(function () {
                if (button) button.disabled = false;
            });
        });
    }

    function initLogin() {
        bindPasswordResetForm();
        if (isClerkEnabled()) {
            var root = qs('[data-login-clerk-root]');
            var resetPanel = qs('[data-password-reset-panel]');
            if (resetPanel) resetPanel.hidden = true;
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
        }

        var form = qs('[data-login-form]');
        if (!form) return;
        if (form.rememberMe) form.rememberMe.checked = rememberSessionEnabled();
        if (rememberSessionEnabled()) {
            if (wasAutoLoginAttempted()) {
                stopBrokenAutoLogin();
            } else {
                markAutoLoginAttempted();
                loadCurrentUser({ silentLoader: true, force: true }).then(function (user) {
                    location.replace(user && (user.isGuest || normalizeRole(user.role) === 'guest') ? '/app/projects' : nextPath());
                }).catch(function () {
                    stopBrokenAutoLogin();
                });
            }
        }
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-login-error]');
            if (error) error.classList.remove('active');
            var button = form.querySelector('button');
            if (button) button.disabled = true;
            var rememberMe = !!(form.rememberMe && form.rememberMe.checked);
            api('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    login: form.login.value.trim(),
                    password: form.password.value,
                    rememberMe: rememberMe
                })
            }).then(function (data) {
                setRememberSession(rememberMe);
                clearAutoLoginAttempt();
                var user = data && data.user || {};
                location.replace(user.isGuest || normalizeRole(user.role) === 'guest' ? '/app/projects' : nextPath());
            }).catch(function () {
                setRememberSession(false);
                clearAutoLoginAttempt();
                if (error) error.classList.add('active');
                if (button) button.disabled = false;
            });
        });
    }

    function logoutCurrentUser() {
        var publicLandingPath = '/';
        setRememberSession(false);
        clearAutoLoginAttempt();

        function showLogoutFailure(error) {
            showAppNotice(appErrorMessage(error, 'Не удалось выйти. Попробуйте ещё раз.'), 'error');
        }

        if (isClerkEnabled()) {
            loadClerk().then(function (clerk) {
                if (!clerk) throw new Error('clerk_unavailable');
                return api('/api/auth/logout', { method: 'POST' }).then(function () {
                    return clerk.signOut({
                        redirectUrl: state.authConfig.clerkAfterSignOutUrl || publicLandingPath
                    });
                });
            }).catch(showLogoutFailure);
            return;
        }
        api('/api/auth/logout', { method: 'POST' }).then(function () {
            location.replace(publicLandingPath);
        }).catch(showLogoutFailure);
    }

    function bindLogoutButtons() {
        if (document.documentElement.dataset.logoutBound === '1') return;
        document.documentElement.dataset.logoutBound = '1';
        document.addEventListener('click', function (event) {
            var logout = event.target && event.target.closest ? event.target.closest('[data-logout]') : null;
            if (!logout) return;
            event.preventDefault();
            logoutCurrentUser();
        });
    }

    function initShell() {
        loadCurrentUser({ force: true }).then(function (user) {
            clearAutoLoginAttempt();
            renderUser();
            applyRole();
            initPage();
            if (!isGuestRole()) checkDailyStandup();
        }).catch(function (err) {
            // Жесткий предохранитель: если пользователь уже находится внутри рабочего приложения (/app/),
            // не нужно выкидывать его на логин при фоновых заминках сети или кэша, если сервер не вернул жесткий 401 статус!
            if (location.pathname.indexOf('/app/') !== -1 && err.status !== 401) {
                console.warn('Фоновая заминка loadCurrentUser проигнорирована предохранителем:', err);
                return;
            }

            if (rememberSessionEnabled() || wasAutoLoginAttempted()) {
                stopBrokenAutoLogin().finally(function () {
                    location.replace('/login');
                });
                return;
            }
            location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
        });

        bindLogoutButtons();

        initAiAssistant();
        initPositionEditor();

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
        node.textContent = displayUserName(state.user);
        state.currentUser = state.user;
        forceTopbarAvatar(state.user);
        if (window.PMBI && window.PMBI.app && typeof window.PMBI.app.syncCurrentUserHeader === 'function') {
            window.PMBI.app.syncCurrentUserHeader(state.user);
        }
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
        var allowed = allowedModules();
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
        var guest = isGuestRole();
        qsa('[data-director-only], [data-director-action]', root).forEach(function (node) {
            node.classList.toggle('hidden', !director);
        });
        qsa('[data-director-finance]', root).forEach(function (node) {
            node.classList.toggle('hidden', !canViewProjectEconomics());
        });
        qsa('[data-project-economics-only]', root).forEach(function (node) {
            node.classList.toggle('hidden', !canViewProjectEconomics());
        });
        qsa('[data-foreman-hidden]', root).forEach(function (node) {
            node.classList.toggle('hidden', isForemanRole());
        });
        qsa('[data-project-quick-action]', root).forEach(function (node) {
            var action = node.dataset.projectQuickAction || '';
            var visible = !guest;
            if (action === 'report') visible = visible && !hasRole('customer');
            if (action === 'document') visible = visible && canManageDocuments();
            if (action === 'material') visible = visible && canManageSchedule();
            if (action === 'task') visible = visible && canCreateProjectTask();
            if (action === 'invoice') visible = visible && canSeeFinances();
            node.classList.toggle('hidden', !visible);
            node.setAttribute('aria-hidden', visible ? 'false' : 'true');
        });
        qsa('.project-mobile-capture, .project-add-menu', root).forEach(function (container) {
            var hasVisibleAction = qsa('[data-project-quick-action]', container).some(function (node) {
                return !node.classList.contains('hidden');
            });
            container.classList.toggle('hidden', !hasVisibleAction);
        });
        qsa('[data-open-project-create], [data-project-create-card], .topbar-reminders-wrap, [data-header-ai-trigger], [data-profile-open]', root).forEach(function (node) {
            node.classList.toggle('hidden', guest);
            if (guest) node.hidden = true;
        });
        qsa('[data-guest-sign-in]', root).forEach(function (node) {
            node.hidden = !guest;
        });
        qsa('.topbar-profile-wrap', root).forEach(function (node) {
            node.hidden = guest;
        });
        qsa('.sidebar .brand', root).forEach(function (link) {
            if (guest) link.setAttribute('href', '/app/projects');
        });
        syncProjectTabVisibility(root);
    }

    renderUser = function () {
        var node = qs('[data-current-user]');
        var roleNode = qs('[data-current-role]');
        var user = state.currentUser || state.user;
        if (!node || !user) return;
        node.textContent = personDisplayName(user) || user.login || '';
        if (roleNode) roleNode.textContent = currentRoleLabel(user);
    };

    applyRole = function () {
        if (!state.user) return;
        state.user.role = normalizeRole(state.user.role);
        state.currentUser = state.user;
        document.body.classList.add('role-' + state.user.role);
        applyRoleVisibility(document);
        var allowed = allowedModules();
        qsa('[data-nav]').forEach(function (link) {
            var visible = allowed.indexOf(link.dataset.nav) !== -1;
            link.classList.toggle('hidden', !visible);
            link.classList.toggle('active', visible && link.dataset.nav === page);
        });
    };

    function initPage() {
        if (page === 'dashboard') initDashboardPage();
        if (page === 'daily_tasks') initDailyTasksPage();
        if (page === 'projects') {
            if (isGuestRole()) {
                loadProjects(function () {
                    renderProjectsPage();
                });
                return;
            }
            // The project itself is the critical path for notification deep links.
            // Directory and dashboard data are independent and can finish in the background.
            loadUserDirectory(function () {});
            loadProjects(function () {
                renderProjectsPage();
                loadDashboard(function () {
                    renderProjectStats();
                    renderProjectCritical();
                });
            });
        }
        if (page === 'warehouse') loadProjects(renderWarehousePage);
        if (page === 'suppliers') loadProjects(initSuppliersPage);
        if (page === 'schedule') loadProjects(renderSchedulePage);
        if (page === 'logs') loadProjects(renderLogsPage);
        if (page === 'users') initUsersPage();
        if (page === 'companies') initCompaniesPage();
        if (page === 'autobot' && PMBI.autobot && typeof PMBI.autobot.init === 'function') PMBI.autobot.init();
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
        return api('/api/projects', {
            cacheKey: 'projects',
            cacheTtl: 60 * 1000,
            requestGroup: 'projects-list'
        }).then(function (data) {
            state.projects = Array.isArray(data && data.projects) ? data.projects : [];
            state.projectCompanies = Array.isArray(data && data.portfolioCompanies) ? data.portfolioCompanies : [];
            state.projectsLoaded = true;
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
            state.projectsLoaded = false;
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
        api('/api/dashboard', { requestGroup: 'dashboard' }).then(function (data) {
            state.dashboard = data;
            callback();
        }).catch(function () {
            state.dashboard = null;
            callback();
        });
    }

    var PROJECT_COMPANY_LABELS = { uess: 'УЭСС', pm: 'ПМ', strategy: 'Стратегия' };

    function projectCompanyCode(value) {
        var normalized = String(value || '').toLocaleLowerCase('ru').replace(/[^a-zа-я0-9]+/g, '');
        return { 'уэсс': 'uess', uess: 'uess', 'пм': 'pm', pm: 'pm', 'стратегия': 'strategy', strategy: 'strategy' }[normalized] || '';
    }

    function projectCompanyOptions() {
        var source = Array.isArray(state.projectCompanies) && state.projectCompanies.length
            ? state.projectCompanies
            : (state.companies || []).filter(function (company) { return company.type === 'own_legal_entity'; });
        var byCode = {};
        source.forEach(function (company) {
            var code = String(company.code || projectCompanyCode(company.name));
            if (PROJECT_COMPANY_LABELS[code] && !byCode[code]) {
                byCode[code] = { id: Number(company.id || 0), code: code, name: PROJECT_COMPANY_LABELS[code] };
            }
        });
        return ['uess', 'pm', 'strategy'].map(function (code) { return byCode[code]; }).filter(Boolean);
    }

    function populateProjectCompanySelects() {
        qsa('[data-project-customer-company]').forEach(function (customerSelect) {
            var customerCompanies = (state.companies || []).filter(function (company) {
                return company.type === 'client' || company.type === 'other';
            });
            var customerValue = customerSelect.value;
            customerSelect.innerHTML = '<option value="">Без привязки</option>' + customerCompanies.map(function (company) {
                return '<option value="' + company.id + '">' + escapeHtml(company.name) + '</option>';
            }).join('');
            if (customerValue) customerSelect.value = customerValue;
        });
        var ownCompanies = projectCompanyOptions();
        qsa('[data-project-own-company]').forEach(function (ownSelect) {
            var ownValue = ownSelect.value;
            ownSelect.innerHTML = '<option value="">Выберите компанию</option>' + ownCompanies.map(function (company) {
                return '<option value="' + company.id + '" data-project-company-code="' + escapeHtml(company.code) + '">' + escapeHtml(company.name) + '</option>';
            }).join('');
            if (ownValue) ownSelect.value = ownValue;
        });
    }

    function initDashboardPage() {
        var statsRoot = qs('[data-dashboard-stats]');
        if (statsRoot && qs('[data-pmbi-skeleton]', statsRoot)) {
            showSkeleton(statsRoot, 'stats', canViewProjectEconomics() ? 8 : 3);
        }
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
        if (state.user && canViewProjectEconomics()) {
            var portfolio = data.portfolioEconomics || {};
            var dashboardCashBalance = data.cashBalance;
            html +=
                stat('Договорная выручка', portfolio.contractRevenueNetKopecks == null ? 'Нет утверждённой базы' : economicsMoney(portfolio.contractRevenueNetKopecks), '', 'badge-russian-ruble') +
                stat('Прогнозная маржа', portfolio.forecastMarginNetKopecks == null ? 'Нет актуального прогноза' : economicsMoney(portfolio.forecastMarginNetKopecks), Number(portfolio.forecastMarginNetKopecks || 0) < 0 ? 'danger' : '', 'trending-up') +
                stat('Без финансовой базы', portfolio.unconfiguredProjects == null ? '—' : portfolio.unconfiguredProjects, Number(portfolio.unconfiguredProjects || 0) ? 'warn' : '', 'triangle-alert') +
                stat('Прогноз требует внимания', portfolio.forecastAttentionProjects == null ? '—' : portfolio.forecastAttentionProjects, Number(portfolio.forecastAttentionProjects || 0) ? 'warn' : '', 'refresh-cw') +
                stat('Кассовый остаток', dashboardCashBalance == null ? 'Скрыто' : money(dashboardCashBalance), dashboardCashBalance < 0 ? 'danger' : '', 'wallet-cards');
        }
        root.innerHTML = html;
    }

    var PROJECT_COVER_FALLBACKS = [
        '/assets/images/project-cover-site.webp',
        '/assets/images/project-cover-interior.webp',
        '/assets/images/project-cover-exterior.webp'
    ];

    function projectFallbackCoverUrl(project) {
        project = project || {};
        var numericId = Number(project.id);
        var seed = Number.isFinite(numericId) && numericId
            ? Math.abs(Math.round(numericId))
            : String(project.title || project.address || 'project').split('').reduce(function (sum, char) {
                return sum + char.charCodeAt(0);
            }, 0);
        return PROJECT_COVER_FALLBACKS[seed % PROJECT_COVER_FALLBACKS.length];
    }

    function projectUploadedCoverUrl(project) {
        var value = String(project && project.cover_photo_url || '').trim();
        return /^\/api\/documents\/\d+\/view$/.test(value) ? value : '';
    }

    function projectCoverVisual(project) {
        var uploadedUrl = projectUploadedCoverUrl(project);
        return {
            url: uploadedUrl || projectFallbackCoverUrl(project),
            uploaded: !!uploadedUrl,
            title: String(project && project.cover_photo_title || 'Фото объекта')
        };
    }

    function projectCoverMedia(project, className, loading) {
        var visual = projectCoverVisual(project);
        return '<span class="' + escapeHtml(className || 'project-cover-media') + (visual.uploaded ? ' has-uploaded-photo' : ' is-curated-cover') + '" data-project-cover-state="' + (visual.uploaded ? 'uploaded' : 'fallback') + '">' +
            '<img src="' + escapeHtml(visual.url) + '" alt="" loading="' + (loading === 'eager' ? 'eager' : 'lazy') + '" decoding="async">' +
        '</span>';
    }

    function projectDocumentImageUrl(doc) {
        var viewUrl = String(doc && doc.view_url || '').trim();
        var mimeType = String(doc && doc.mime_type || '').toLowerCase();
        var extension = String(doc && (doc.file_ext || doc.original_name || '') || '').toLowerCase();
        var isImage = mimeType.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp)$/.test(extension);
        return isImage && /^\/api\/documents\/\d+\/view$/.test(viewUrl) ? viewUrl : '';
    }

    function projectPhotoDocuments(documents) {
        return (Array.isArray(documents) ? documents : []).filter(function (doc) {
            return !!projectDocumentImageUrl(doc);
        });
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
            var cover = projectCoverVisual(project);
            return '<a class="dashboard-project" href="/app/projects?openProject=' + encodeURIComponent(project.id) + '" data-dashboard-project-id="' + project.id + '">' +
                '<span class="dashboard-project-cover' + (cover.uploaded ? ' has-uploaded-photo' : ' is-curated-cover') + '" aria-hidden="true">' +
                    '<img src="' + escapeHtml(cover.url) + '" alt="" loading="lazy" decoding="async">' +
                '</span>' +
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

    function closeProjectDetail() {
        if (typeof documentWorkspaceCleanup === 'function') documentWorkspaceCleanup();
        state.selectedProject = null;
        var detail = qs('[data-project-detail]');
        if (detail) detail.hidden = true;
        setProjectFocusMode(false);
        try {
            var closeParams = new URLSearchParams(location.search);
            closeParams.delete('openProject');
            closeParams.delete('materialId');
            closeParams.delete('workId');
            closeParams.delete('stageId');
            closeParams.delete('sectionTitle');
            var closeQuery = closeParams.toString();
            history.replaceState(null, '', location.pathname + (closeQuery ? '?' + closeQuery : ''));
            syncRouterLocation();
        } catch (error) {}
    }

    function bindProjectBackButton() {
        qsa('[data-close-detail]').forEach(function (button) {
            if (button.dataset.projectBackBound === '1') return;
            button.dataset.projectBackBound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                closeProjectDetail();
            });
        });
    }

    function activateProjectTab(tabName) {
        if (tabName === 'materials' || tabName === 'works') tabName = 'schedule';
        var root = qs('[data-project-detail]') || document;
        syncProjectTabVisibility(root);
        if (isProjectTabHidden(tabName)) tabName = isGuestRole() ? 'reports' : 'overview';
        var tab = qs('[data-tab="' + tabName + '"]', root);
        var panel = qs('[data-panel="' + tabName + '"]', root);
        if (!tab || !panel) return;
        qsa('[data-tab]', root).forEach(function (node) {
            var active = node === tab;
            node.classList.toggle('active', active);
            node.setAttribute('aria-selected', active ? 'true' : 'false');
            node.tabIndex = active ? 0 : -1;
            if (active) node.setAttribute('aria-current', 'page');
            else node.removeAttribute('aria-current');
        });
        qsa('[data-panel]', root).forEach(function (node) {
            var active = node === panel;
            node.classList.toggle('active', active);
            node.hidden = !active;
        });
        tab.classList.add('active');
        tab.setAttribute('aria-current', 'page');
        panel.hidden = false;
        if (typeof tab.scrollIntoView === 'function') {
            try { tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch (scrollError) {}
        }
        qsa('.project-detail-nav details[open]', root).forEach(function (menu) { menu.open = false; });
        try {
            var tabParams = new URLSearchParams(location.search);
            if (tabName === 'overview') tabParams.delete('tab');
            else tabParams.set('tab', tabName);
            history.replaceState(null, '', location.pathname + (tabParams.toString() ? ('?' + tabParams.toString()) : ''));
            syncRouterLocation();
        } catch (historyError) {}
        if (tabName === 'finance' && canSeeFinances() && state.selectedProject) {
            loadProjectFinances(state.selectedProject.id, state.projectLoadingToken);
        }
        if (tabName === 'calendar' && PMBI.planning && typeof PMBI.planning.loadSelectedProjectMaterialSchedule === 'function') {
            PMBI.planning.loadSelectedProjectMaterialSchedule(false);
        }
        if (tabName === 'production-schedule' && PMBI.planning && typeof PMBI.planning.loadSelectedProjectProductionSchedule === 'function') {
            PMBI.planning.loadSelectedProjectProductionSchedule(false);
        }
        if (tabName === 'estimate-reconciliation' && PMBI.estimateReconciliation && typeof PMBI.estimateReconciliation.loadSelectedProject === 'function') {
            PMBI.estimateReconciliation.loadSelectedProject(false).catch(function () {});
        }
        if (tabName === 'warehouse-control' && PMBI.warehouseControl && typeof PMBI.warehouseControl.loadSelectedProject === 'function') {
            PMBI.warehouseControl.loadSelectedProject(false).catch(function () {});
        }
        if (state.selectedProject) focusProjectDeepLink(state.selectedProject.id);
    }

    function isProjectTabHidden(tabName) {
        if (isGuestRole()) return ['reports', 'production-schedule'].indexOf(tabName) === -1;
        if ((tabName === 'calendar' || tabName === 'estimate-reconciliation' || tabName === 'warehouse-control') && hasRole('customer')) return true;
        if (hasRole('admin') || hasRole('director')) return false;
        return false;
    }

    function syncProjectTabVisibility(root) {
        root = root || qs('[data-project-detail]') || document;
        var reportsTabLabel = qs('[data-tab="reports"] span', root);
        if (reportsTabLabel) reportsTabLabel.textContent = isGuestRole() ? 'Отчёты' : 'Журнал';
        var roleHiddenTabs = isGuestRole() ? {
            overview: true,
            schedule: true,
            'warehouse-control': true,
            tasks: true,
            reports: false,
            documents: true,
            finance: true,
            calendar: true,
            'production-schedule': false,
            'estimate-reconciliation': true,
            chat: true,
            ai: true
        } : {
            calendar: hasRole('customer'),
            'estimate-reconciliation': hasRole('customer'),
            'warehouse-control': hasRole('customer'),
            reports: false,
            finance: !canSeeFinances()
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
        qsa('[data-project-quick-action="invoice"]', root).forEach(function (node) {
            node.hidden = !canSeeFinances();
        });
    }

    function bindProjectTabClicks() {
        var detail = qs('[data-project-detail]');
        var tabsRoot = detail && qs('.project-detail-nav', detail);
        if (!tabsRoot) return;
        if (bindHorizontalWheelScroll) bindHorizontalWheelScroll(qs('.project-tab-cluster > .tabs', tabsRoot));
        if (tabsRoot.dataset.projectTabsBound === '1') return;
        tabsRoot.dataset.projectTabsBound = '1';
        tabsRoot.addEventListener('click', function (event) {
            var button = event.target && event.target.closest('[data-tab]');
            if (!button || !tabsRoot.contains(button)) return;
            event.preventDefault();
            var tabName = button.dataset.tab || 'overview';
            if (button.classList.contains('hidden') || button.getAttribute('aria-hidden') === 'true') return;
            if (tabName === 'finance' && !canSeeFinances()) return;
            activateProjectTab(tabName);
            var menu = button.closest('details');
            if (menu) menu.open = false;
        });
        tabsRoot.addEventListener('keydown', function (event) {
            var current = event.target && event.target.closest('[data-tab]');
            if (!current || !tabsRoot.contains(current)) return;
            var tabs = qsa('[data-tab]', tabsRoot).filter(function (node) {
                return !node.disabled && !node.classList.contains('hidden') && node.getAttribute('aria-hidden') !== 'true';
            });
            var currentIndex = tabs.indexOf(current);
            if (currentIndex < 0 || !tabs.length) return;
            var nextIndex = currentIndex;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            else if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = tabs.length - 1;
            else return;
            event.preventDefault();
            tabs[nextIndex].focus();
            activateProjectTab(tabs[nextIndex].dataset.tab || 'overview');
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

    function projectScheduleSummary(project) {
        if (!project || !project.id || !state.sectionScheduleByProject) return null;
        return state.sectionScheduleByProject[project.id] || state.sectionScheduleByProject[String(project.id)] || null;
    }

    function projectSummaryStartDate(summary) {
        return String(summary && (summary.startDate || summary.projectStart) || '').trim();
    }

    function projectSummaryFinishDate(summary) {
        return String(summary && (summary.finishDate || summary.projectEnd) || '').trim();
    }

    function projectDisplayStartDate(project) {
        var summaryStart = projectSummaryStartDate(projectScheduleSummary(project));
        return summaryStart || String(project && (project.started_at || project.startDate) || '').trim();
    }

    function projectDisplayDeadlineDate(project) {
        var summaryFinish = projectSummaryFinishDate(projectScheduleSummary(project));
        return summaryFinish || String(project && (project.deadline_at || project.deadline) || '').trim();
    }

    function bindProjectCreate() {
        if (PMBI.operations && typeof PMBI.operations.bindProjectCreate === 'function') {
            PMBI.operations.bindProjectCreate();
            return;
        }
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
                clearApiCache('projects');
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
                clearApiCache('projects');
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
            submitted: 'На согласовании',
            reviewed: 'Проверен',
            approved: 'Утвержден',
            signed: 'Подписан',
            ready: 'Готов',
            accepted: 'Принят',
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
            card.hidden = false;
            root.innerHTML = '<p class="muted project-critical-empty">Критичных нехваток пока нет.</p>';
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
                    items: [],
                    sections: {}
                };
            }
            groups[key].items.push(item);
            var sectionTitle = criticalSectionTitle(item) || 'Без раздела';
            var sectionKey = sectionTitle.toLocaleLowerCase('ru');
            if (!groups[key].sections[sectionKey]) {
                groups[key].sections[sectionKey] = {
                    title: sectionTitle,
                    items: []
                };
            }
            groups[key].sections[sectionKey].items.push(item);
        });
        var orderedGroups = Object.keys(groups).map(function (key) {
            return groups[key];
        }).sort(function (left, right) {
            return right.items.length - left.items.length;
        });
        root.innerHTML = '<div class="quick-alert-list quick-alert-groups">' + orderedGroups.map(function (group, index) {
            var first = group.items[0] || {};
            var groupLevel = criticalUrgencyLevel(group.items);
            var sectionGroups = Object.keys(group.sections).map(function (key) {
                return group.sections[key];
            });
            var summaryMeta = [
                String(group.items.length) + ' поз.',
                String(sectionGroups.length) + ' разд.',
                criticalDaysText(first)
            ].filter(Boolean).join(' • ');
            return '<details class="quick-alert quick-alert-group is-' + groupLevel + '">' +
                '<summary>' +
                    '<span><b>' + escapeHtml(group.projectTitle) + '</b><small>' + escapeHtml(summaryMeta || 'Есть критичные позиции') + '</small></span>' +
                    '<strong>' + escapeHtml(String(group.items.length)) + '</strong>' +
                '</summary>' +
                '<div class="quick-alert-details">' + sectionGroups.map(function (section) {
                    return '<section class="quick-alert-section">' +
                        '<div class="quick-alert-section-head"><span>' + escapeHtml(section.title) + '</span><strong>' + escapeHtml(String(section.items.length)) + ' поз.</strong></div>' +
                        '<div class="quick-alert-section-items">' + section.items.map(function (item) {
                            var itemLevel = criticalUrgencyLevel([item]);
                            var itemStageTitle = criticalStageTitle(item);
                            var meta = [
                                String(item.itemKind || 'material').toLowerCase() === 'work' ? 'Работа' : 'Материал',
                                itemStageTitle ? ('Этап: ' + itemStageTitle) : '',
                                item.workDate ? ('работа: ' + finalGraphDate(item.workDate)) : '',
                                criticalDaysText(item)
                            ].filter(Boolean).join(' • ');
                            return '<a class="quick-alert-detail is-' + itemLevel + '" href="/app/projects?openProject=' + escapeHtml(item.projectId || '') + '">' +
                                '<span><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta) + '</small></span>' +
                                '<strong>' + escapeHtml(quantityText(item.missingQty)) + ' ' + escapeHtml(item.unit) + '</strong>' +
                            '</a>';
                        }).join('') + '</div>' +
                    '</section>';
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
                '<div><span>Экономика</span><strong>Раздел «Финансы»</strong></div>' +
                '<div><span>Дата договора</span><strong>' + escapeHtml(project.contract_date || '—') + '</strong></div>' +
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
        api('/api/users', {
            cacheKey: 'users-directory',
            cacheTtl: 5 * 60 * 1000,
            requestGroup: 'users-directory'
        }).then(function (data) {
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

    function refreshOpenReportPreviewsForProject(projectId) {
        qsa('[data-log-form]').forEach(function (form) {
            var projectControl = form.elements && form.elements.namedItem ? form.elements.namedItem('project_id') : null;
            var rawInput = form.elements && form.elements.namedItem ? form.elements.namedItem('raw_input') : null;
            if (Number(projectControl && projectControl.value || 0) !== Number(projectId) || !rawInput || !rawInput.value.trim()) return;
            rawInput.dispatchEvent(new Event('input', { bubbles: true }));
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
            refreshOpenReportPreviewsForProject(projectId);
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
        var pollKey = String(projectId) + ':' + kind;
        var isReady = cache && (cache.status === 'ready' || cache.status === 'restricted');
        if (force && state.marketAnalysisPollTimers[pollKey]) {
            clearTimeout(state.marketAnalysisPollTimers[pollKey]);
            delete state.marketAnalysisPollTimers[pollKey];
        }
        if (!force && isReady) {
            callback(cache);
            return;
        }
        if (cache && cache.loading) return;
        function apply(data) {
            var rows = Array.isArray(data && data.rows) ? data.rows : [];
            var status = String(data && data.status || (rows.length ? 'ready' : 'error'));
            state.marketAnalysisByProject[projectId][kind] = {
                loading: status === 'pending',
                status: status,
                error: status === 'error' ? String(data && data.error || 'market_analysis_failed') : '',
                rows: rows,
                summary: data && data.summary || {},
                estimateId: data && data.estimateId || '',
                estimateVersion: data && data.estimateVersion || '',
                analyzedAt: data && data.analyzedAt || null,
                canViewProcurementPrices: data && data.canViewProcurementPrices === true,
                canSubmitPrice: data && data.canSubmitPrice === true
            };
            callback(state.marketAnalysisByProject[projectId][kind]);
            return status;
        }
        function poll() {
            api('/api/projects/' + projectId + '/market-analysis?kind=' + kind, { silentLoader: true }).then(function (data) {
                var status = apply(data);
                if (status === 'pending') {
                    state.marketAnalysisPollTimers[pollKey] = setTimeout(poll, 2500);
                } else {
                    delete state.marketAnalysisPollTimers[pollKey];
                }
            }).catch(function (error) {
                var payload = error && error.payload || {};
                var rows = Array.isArray(payload.rows) ? payload.rows : [];
                state.marketAnalysisByProject[projectId][kind] = {
                    loading: false,
                    status: 'error',
                    error: rows.length ? '' : (payload.error || 'market_analysis_failed'),
                    rows: rows,
                    summary: payload.summary || {}
                };
                callback(state.marketAnalysisByProject[projectId][kind]);
                delete state.marketAnalysisPollTimers[pollKey];
            });
        }
        state.marketAnalysisByProject[projectId][kind] = { loading: true, status: 'pending', rows: [] };
        callback(state.marketAnalysisByProject[projectId][kind]);
        poll();
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
        if (state.marketAnalysisByProject) delete state.marketAnalysisByProject[projectId];
        loadMaterialInsights(projectId, function (insights) {
            if (typeof rerenderProjectMaterialAndWorkViews === 'function') {
                rerenderProjectMaterialAndWorkViews(projectId);
                return;
            }
            if (state.materialsByProject[projectId]) {
                var materialsHtml = renderMaterials(state.materialsByProject[projectId], projectId, insights || {});
                var schedulePanel = qs('[data-panel="schedule"]');
                if (schedulePanel && state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    safeReplaceChildren(schedulePanel, renderSchedulePanel(state.stagesByProject[projectId] || [], state.selectedProject));
                }
                var overviewMaterials = qs('[data-project-overview-materials]');
                if (overviewMaterials && state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    safeReplaceChildren(overviewMaterials, materialsHtml);
                }
                bindProjectChainActions();
            }
        });
    }

    function attachCounterpartyToEstimateItem(button, limitOverrideReason) {
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
                    notes: button.dataset.notes || '',
                    limit_override_reason: limitOverrideReason || ''
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
                notes: button.dataset.notes || '',
                limit_override_reason: limitOverrideReason || ''
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
        request.catch(function (error) {
            var payload = error && error.payload || {};
            if (!button.hasAttribute('data-supplier-clear') && payload.error === 'procurement_limit_exceeded') {
                var check = payload.limitCheck || {};
                var overrun = money(Number(check.overrunKopecks || 0) / 100);
                var reason = window.prompt(
                    '\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0432\u044b\u0448\u0435 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d\u043d\u043e\u0433\u043e \u043b\u0438\u043c\u0438\u0442\u0430 \u043d\u0430 ' + overrun + '.\n\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u0435 \u0434\u043b\u044f \u0432\u044b\u0431\u043e\u0440\u0430 \u044d\u0442\u043e\u0439 \u0446\u0435\u043d\u044b:'
                );
                if (reason && reason.trim()) {
                    return attachCounterpartyToEstimateItem(button, reason.trim());
                }
                var cancelled = new Error('limit_override_cancelled');
                cancelled.limitOverrideCancelled = true;
                throw cancelled;
            }
            throw error;
        }).then(function () {
            refreshCounterpartyProjectViews(projectId);
        }).catch(function (error) {
            if (error && error.limitOverrideCancelled) return;
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
                    bindSectionScheduleRefresh(projectId);
                    bindSectionScheduleInteractions(projectId);
                    bindProjectMarketToggles(projectId);
                    bindProjectChainActions();
                    if (PMBI.planning && typeof PMBI.planning.bindProjectScheduleViews === 'function') PMBI.planning.bindProjectScheduleViews(projectId);
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
                        bindSectionScheduleRefresh(projectId);
                        bindSectionScheduleInteractions(projectId);
                        bindProjectMarketToggles(projectId);
                        bindProjectChainActions();
                        if (PMBI.planning && typeof PMBI.planning.bindProjectScheduleViews === 'function') PMBI.planning.bindProjectScheduleViews(projectId);
                        loadExecutionInsights(projectId, stages);
                    });
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

    function loadProjectNotifications(projectId, callback) {
        api('/api/projects/' + projectId + '/notifications').then(function (data) {
            callback(data || null);
        }).catch(function () {
            callback(null);
        });
    }

    var taskViewState = {
        projectId: null,
        query: '',
        assignee: 'all',
        priority: 'all',
        deadline: 'all'
    };

    function canCreateProjectTask() {
        return hasRole('admin') || hasRole('director');
    }

    function resetTaskViewState(projectId) {
        if (Number(taskViewState.projectId) === Number(projectId)) return;
        taskViewState = {
            projectId: projectId,
            query: '',
            assignee: 'all',
            priority: 'all',
            deadline: 'all'
        };
    }

    function loadTasks(projectId, loadingToken) {
        resetTaskViewState(projectId);
        api('/api/projects/' + projectId + '/tasks').then(function (data) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            var tasks = Array.isArray(data.tasks) ? data.tasks : [];
            loadProjectNotifications(projectId, function (notifications) {
                loadUserDirectory(function (users) {
                    if (!isCurrentProject(projectId, loadingToken)) return;
                    safeReplaceChildren(qs('[data-panel="tasks"]'), renderTasks(tasks, projectId, users, notifications));
                    bindTaskForm(projectId);
                    bindTaskEditors(projectId);
                    bindTaskFilters(projectId);
                    initTaskDragAndDrop(projectId);
                    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                });
            });
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return;
            safeReplaceChildren(qs('[data-panel="tasks"]'), '<section class="task-access-state"><i data-lucide="shield-alert" aria-hidden="true"></i><div><b>Раздел задач недоступен</b><span>У вашей роли нет доступа к задачам этого объекта.</span></div></section>');
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
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
        var completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        var canCreate = canCreateProjectTask();
        var header = '<header class="task-workspace-head">' +
            '<div class="task-workspace-title">' +
                '<span class="task-workspace-kicker"><i data-lucide="list-checks" aria-hidden="true"></i> Управление работой</span>' +
                '<h2>Задачи объекта</h2>' +
                '<p>Планируйте работу, назначайте ответственных и двигайте карточки между этапами.</p>' +
            '</div>' +
            (canCreate ? '<button class="primary task-create-toggle" type="button" data-task-create-toggle><i data-lucide="plus" aria-hidden="true"></i><span>Новая задача</span></button>' : '') +
        '</header>';
        var summary = '<section class="task-overview" aria-label="Сводка по задачам">' +
            '<div class="task-progress-card">' +
                '<div class="task-progress-copy"><span>Готовность задач</span><strong>' + completion + '%</strong><small>' + done + ' из ' + tasks.length + ' завершено</small></div>' +
                '<div class="task-progress-track" role="progressbar" aria-label="Готовность задач" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + completion + '"><i style="width:' + completion + '%"></i></div>' +
            '</div>' +
            '<div class="task-metrics">' +
                renderTaskMetric('Всего', tasks.length, 'layers-3', '') +
                renderTaskMetric('В очереди', open, 'circle-dashed', '') +
                renderTaskMetric('В работе', inProgress, 'loader-circle', 'is-active') +
                renderTaskMetric('На проверке', review, 'scan-eye', '') +
                renderTaskMetric('Просрочено', overdue, 'alarm-clock', overdue ? 'is-danger' : '') +
            '</div>' +
        '</section>';
        var alerts = renderTaskAlerts(notifications);
        var filters = tasks.length ? renderTaskFilters(users || [], tasks.length) : '';
        var board = renderTaskBoard(tasks, users || [], canCreate);
        var createModal = canCreate ? renderTaskCreateModal(projectId, users || []) : '';
        return '<section class="tasks-ui" data-task-workspace data-project-id="' + escapeHtml(projectId) + '">' + header + summary + alerts + filters + board + createModal + '</section>';
    }

    function renderTaskMetric(label, value, icon, kind) {
        return '<div class="task-metric ' + escapeHtml(kind || '') + '">' +
            '<span class="task-metric-icon"><i data-lucide="' + escapeHtml(icon) + '" aria-hidden="true"></i></span>' +
            '<span><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(value) + '</strong></span>' +
        '</div>';
    }

    function renderTaskFilters(users, total) {
        var userOptions = users.map(function (user) {
            return '<option value="' + escapeHtml(user.id) + '">' + escapeHtml(user.name) + '</option>';
        }).join('');
        return '<section class="task-toolbar" aria-label="Фильтры задач">' +
            '<label class="task-search"><i data-lucide="search" aria-hidden="true"></i><span class="sr-only">Поиск задач</span><input type="search" data-task-filter-query placeholder="Найти задачу" autocomplete="off" value="' + escapeHtml(taskViewState.query) + '"></label>' +
            '<label><span class="sr-only">Исполнитель</span><select data-task-filter-assignee aria-label="Исполнитель"><option value="all">Все исполнители</option><option value="none">Без ответственного</option>' + userOptions + '</select></label>' +
            '<label><span class="sr-only">Приоритет</span><select data-task-filter-priority aria-label="Приоритет"><option value="all">Любой приоритет</option><option value="high">Высокий</option><option value="normal">Средний</option><option value="low">Низкий</option></select></label>' +
            '<label><span class="sr-only">Срок</span><select data-task-filter-deadline aria-label="Срок"><option value="all">Любой срок</option><option value="overdue">Просроченные</option><option value="today">На сегодня</option><option value="none">Без срока</option></select></label>' +
            '<button class="ghost compact task-filter-reset" type="button" data-task-filter-reset hidden><i data-lucide="x" aria-hidden="true"></i><span>Сбросить</span></button>' +
            '<span class="task-filter-result" data-task-filter-result>Показано ' + total + ' из ' + total + '</span>' +
        '</section>';
    }

    function renderTaskAlerts(notifications) {
        if (!notifications) return '';
        var cards = [];
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            cards.push('<article class="task-alert is-danger"><span><i data-lucide="alarm-clock" aria-hidden="true"></i></span><div><b>Просрочено задач: ' + notifications.overdueTasks.length + '</b><small>Проверьте сроки или обновите статус.</small></div><button class="ghost compact" type="button" data-task-show-overdue>Показать</button></article>');
        }
        if (notifications.problemStages && notifications.problemStages.length) {
            cards.push('<article class="task-alert"><span><i data-lucide="triangle-alert" aria-hidden="true"></i></span><div><b>Проблемных этапов: ' + notifications.problemStages.length + '</b><small>Есть блокировки или отставание по плану.</small></div></article>');
        }
        return cards.length ? '<section class="task-alerts" aria-label="Важные уведомления">' + cards.join('') + '</section>' : '';
    }

    function taskColumnStatus(status) {
        if (status === 'in_progress' || status === 'review' || status === 'done') return status;
        return 'open';
    }

    function renderTaskBoard(tasks, users, canCreate) {
        if (!tasks.length) {
            return '<section class="task-zero-state">' +
                '<span class="task-zero-icon"><i data-lucide="clipboard-check" aria-hidden="true"></i></span>' +
                '<div><h3>Задач пока нет</h3><p>Создайте первую задачу, назначьте исполнителя и срок — она сразу появится на доске.</p></div>' +
                (canCreate ? '<button class="primary" type="button" data-task-create-toggle><i data-lucide="plus" aria-hidden="true"></i><span>Создать задачу</span></button>' : '') +
            '</section>';
        }
        var columns = [
            { status: 'open', title: 'В очереди', hint: 'Запланировано', icon: 'circle-dashed' },
            { status: 'in_progress', title: 'В работе', hint: 'Выполняется сейчас', icon: 'loader-circle' },
            { status: 'review', title: 'На проверке', hint: 'Ожидает приёмки', icon: 'scan-eye' },
            { status: 'done', title: 'Готово', hint: 'Работа завершена', icon: 'circle-check' }
        ];
        return '<section class="tasks-board" aria-label="Доска задач">' + columns.map(function (column) {
            var items = tasks.filter(function (task) {
                return taskColumnStatus(task.status) === column.status;
            });
            return renderTaskColumn(column, items, users);
        }).join('') + '</section>';
    }

    function renderTaskColumn(column, tasks, users) {
        var cards = tasks.length ? tasks.map(function (task) { return renderTaskRow(task, users); }).join('') : '';
        return '<section class="tasks-column tasks-column-' + column.status + '" data-task-column-status="' + escapeHtml(column.status) + '">' +
            '<div class="tasks-column-head">' +
                '<span class="tasks-column-icon"><i data-lucide="' + escapeHtml(column.icon) + '" aria-hidden="true"></i></span>' +
                '<div><h3>' + escapeHtml(column.title) + '</h3><small>' + escapeHtml(column.hint) + '</small></div>' +
                '<span class="tasks-column-count" data-task-column-count>' + tasks.length + '</span>' +
            '</div>' +
            '<div class="tasks-column-list" data-task-drop-list data-task-status="' + escapeHtml(column.status) + '" data-empty="' + (tasks.length ? '0' : '1') + '">' + cards +
                '<div class="task-column-empty" data-task-column-empty><i data-lucide="' + escapeHtml(column.icon) + '" aria-hidden="true"></i><span>Здесь пока пусто</span><small>Перетащите задачу в эту колонку</small></div>' +
            '</div>' +
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

    function taskAssigneeUser(task, users) {
        var match = (users || []).filter(function (user) {
            return Number(user.id) === Number(task.assignee_id);
        })[0];
        if (match) return match;
        if (task && task.assignee_id) {
            return {
                id: task.assignee_id,
                name: task.assignee_name || '',
                displayName: task.assignee_name || '',
                avatarUrl: task.assignee_avatar_url || task.assigneeAvatarUrl || task.assignee_avatar || task.assigneeAvatar || ''
            };
        }
        return null;
    }

    function taskAssigneeAvatar(task, users) {
        var user = taskAssigneeUser(task, users);
        if (!user || !user.id) {
            return '<span class="task-avatar" aria-hidden="true">—</span>';
        }
        if (typeof userAvatarMarkup === 'function') {
            return userAvatarMarkup(user, 'task-avatar');
        }
        return '<span class="task-avatar" aria-hidden="true">' + escapeHtml(taskInitials(taskAssigneeName(task, users))) + '</span>';
    }

    function taskInitials(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length || name === 'Без ответственного') return '—';
        return parts.slice(0, 2).map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('');
    }

    function taskCompletionTime(value) {
        if (!value) return '';
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            var match = String(value).match(/T(\d{2}):(\d{2})/);
            return match ? match[1] + ':' + match[2] : '';
        }
        return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }

    function renderTaskRow(task, users) {
        var userOptions = '<option value="">Без ответственного</option>' + users.map(function (user) {
            return '<option value="' + user.id + '"' + (Number(task.assignee_id) === Number(user.id) ? ' selected' : '') + '>' + escapeHtml(user.name) + '</option>';
        }).join('');
        var priority = task.priority || 'normal';
        var isOverdue = task.status !== 'done' && task.due_at && task.due_at < APP_TODAY;
        var assigneeName = taskAssigneeName(task, users);
        var completedAt = task.completed_at || task.completedAt || '';
        var completedTime = completedAt ? taskCompletionTime(completedAt) : '';
        var status = taskColumnStatus(task.status);
        var nextStatus = status === 'done' ? 'in_progress' : 'done';
        var quickLabel = status === 'done' ? 'Вернуть в работу' : 'Отметить выполненной';
        var description = task.description || '';
        return '<form class="task-card ui-card' + (isOverdue ? ' task-card-overdue' : '') + (status === 'done' ? ' task-card-done' : '') + '" data-task-edit-form data-task-id="' + escapeHtml(task.id) + '" data-task-current-status="' + escapeHtml(status) + '" data-task-search-text="' + escapeHtml((task.title || '') + ' ' + description + ' ' + assigneeName).toLowerCase() + '" data-task-assignee="' + escapeHtml(task.assignee_id || 'none') + '" data-task-priority="' + escapeHtml(priority) + '" data-task-due="' + escapeHtml(task.due_at || '') + '">' +
            '<div class="task-card-top">' +
                '<button class="task-drag-handle" type="button" data-task-drag-handle aria-label="Перетащить задачу" title="Перетащить задачу"><i data-lucide="grip-vertical" aria-hidden="true"></i></button>' +
                '<div class="task-card-badges">' +
                    '<span class="task-priority task-priority-' + taskPriorityClass(priority) + '">' + escapeHtml(priorityLabel(priority)) + ' приоритет</span>' +
                    (isOverdue ? '<span class="task-overdue-badge"><i data-lucide="alarm-clock" aria-hidden="true"></i> Просрочено</span>' : '') +
                '</div>' +
                '<button class="task-edit-toggle" type="button" data-task-edit-toggle aria-expanded="false" aria-label="Изменить задачу" title="Изменить задачу"><i data-lucide="settings-2" aria-hidden="true"></i></button>' +
            '</div>' +
            '<div class="task-card-body">' +
                '<h4>' + escapeHtml(task.title || 'Без названия') + '</h4>' +
                (description ? '<p>' + escapeHtml(description) + '</p>' : '') +
            '</div>' +
            '<div class="task-card-footer">' +
                '<div class="task-assignee">' +
                    taskAssigneeAvatar(task, users) +
                    '<span>' + escapeHtml(assigneeName) + '</span>' +
                '</div>' +
                '<div class="task-deadline' + (isOverdue ? ' task-deadline-overdue' : '') + '">' +
                    '<i data-lucide="calendar-days" aria-hidden="true"></i>' +
                    '<span>' + escapeHtml(task.due_at ? formatDisplayDate(task.due_at) : 'Без срока') + '</span>' +
                '</div>' +
                (completedTime ? '<div class="task-completed-time"><i data-lucide="clock" aria-hidden="true"></i><span>Выполнено в ' + escapeHtml(completedTime) + '</span></div>' : '') +
            '</div>' +
            '<div class="task-card-actions">' +
                '<button class="task-quick-status" type="button" data-task-quick-status="' + escapeHtml(nextStatus) + '"><i data-lucide="' + (status === 'done' ? 'rotate-ccw' : 'check') + '" aria-hidden="true"></i><span>' + escapeHtml(quickLabel) + '</span></button>' +
            '</div>' +
            '<div class="task-card-editor" data-task-card-editor hidden>' +
                '<div class="task-editor-grid">' +
                    '<label class="wide"><span>Название</span><input name="title" value="' + escapeHtml(task.title || '') + '" required></label>' +
                    '<label class="wide"><span>Описание</span><textarea name="description" rows="3" placeholder="Что именно нужно сделать">' + escapeHtml(description) + '</textarea></label>' +
                    '<label><span>Статус</span><select name="status"><option value="open"' + (status === 'open' ? ' selected' : '') + '>В очереди</option><option value="in_progress"' + (status === 'in_progress' ? ' selected' : '') + '>В работе</option><option value="review"' + (status === 'review' ? ' selected' : '') + '>На проверке</option><option value="done"' + (status === 'done' ? ' selected' : '') + '>Готово</option></select></label>' +
                    '<label><span>Приоритет</span><select name="priority"><option value="low"' + (priority === 'low' ? ' selected' : '') + '>Низкий</option><option value="normal"' + (priority === 'normal' ? ' selected' : '') + '>Средний</option><option value="high"' + (priority === 'high' ? ' selected' : '') + '>Высокий</option></select></label>' +
                    '<label><span>Срок</span><input name="due_at" type="date" value="' + escapeHtml(task.due_at || '') + '"></label>' +
                    '<label><span>Исполнитель</span><select name="assignee_id">' + userOptions + '</select></label>' +
                '</div>' +
                '<div class="task-editor-error" data-task-editor-error role="alert" hidden></div>' +
                '<div class="task-editor-actions"><button class="ghost" type="button" data-task-edit-cancel>Отмена</button><button class="primary task-save" type="submit"><i data-lucide="check" aria-hidden="true"></i><span>Сохранить</span></button></div>' +
            '</div>' +
        '</form>';
    }

    function taskStatusFromDropList(list) {
        if (!list) return '';
        return list.dataset.taskStatus || (list.closest('[data-task-column-status]') || {}).dataset.taskColumnStatus || '';
    }

    function taskDropListFromPoint(event) {
        var originalEvent = event && event.originalEvent;
        if (!originalEvent || typeof document.elementFromPoint !== 'function') return null;
        var clientX = originalEvent.clientX;
        var clientY = originalEvent.clientY;
        if ((!clientX && clientX !== 0) || (!clientY && clientY !== 0)) {
            var touch = originalEvent.changedTouches && originalEvent.changedTouches[0];
            if (!touch) touch = originalEvent.touches && originalEvent.touches[0];
            if (!touch) return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        }
        var element = document.elementFromPoint(clientX, clientY);
        return element ? element.closest('[data-task-drop-list]') : null;
    }

    function taskDragPoint(event) {
        var originalEvent = event && event.originalEvent;
        if (!originalEvent) return null;
        var clientX = originalEvent.clientX;
        var clientY = originalEvent.clientY;
        if ((!clientX && clientX !== 0) || (!clientY && clientY !== 0)) {
            var touch = originalEvent.changedTouches && originalEvent.changedTouches[0];
            if (!touch) touch = originalEvent.touches && originalEvent.touches[0];
            if (!touch) return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        }
        return { x: clientX, y: clientY };
    }

    function isTaskDragPointInsideList(list, event) {
        var point = taskDragPoint(event);
        if (!list || !point || typeof list.getBoundingClientRect !== 'function') return true;
        var rect = list.getBoundingClientRect();
        return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    }

    function refreshTaskProgressAfterMove(projectId) {
        if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
            refreshSelectedProjectProgressViews(projectId);
            loadStages(projectId, function (stages) {
                loadExecutionInsights(projectId, stages);
            });
        }
    }

    function persistTaskDragMove(projectId, form, status, previousStatus, previousList, previousIndex) {
        if (!form || !form.dataset.taskId || !status) return;
        if (form.status) form.status.value = status;
        form.dataset.taskCurrentStatus = status;
        form.classList.add('is-task-drag-saving');
        syncTaskDropLists();
        api('/api/tasks/' + form.dataset.taskId + '/update', {
            method: 'POST',
            body: JSON.stringify({
                status: status,
                priority: form.priority ? form.priority.value : 'normal',
                due_at: form.due_at ? form.due_at.value : '',
                assignee_id: form.assignee_id ? form.assignee_id.value : ''
            })
        }).then(function () {
            form.classList.remove('is-task-drag-saving');
            refreshTaskProgressAfterMove(projectId);
            loadTasks(projectId);
        }).catch(function (err) {
            form.classList.remove('is-task-drag-saving');
            form.dataset.taskCurrentStatus = previousStatus || '';
            if (form.status) form.status.value = previousStatus || 'open';
            if (previousList) {
                var children = qsa('[data-task-edit-form]', previousList);
                var beforeNode = children[Math.max(0, Number(previousIndex) || 0)] || null;
                previousList.insertBefore(form, beforeNode);
            }
            syncTaskDropLists();
            showFinanceToast(appErrorMessage(err, 'Не удалось перенести задачу'));
        });
    }

    function syncTaskDropLists() {
        qsa('[data-task-drop-list]').forEach(function (list) {
            var cards = qsa('[data-task-edit-form]', list);
            list.dataset.empty = cards.length ? '0' : '1';
            var column = list.closest('[data-task-column-status]');
            var count = column ? qs('[data-task-column-count]', column) : null;
            if (count) count.textContent = String(cards.length);
        });
    }

    function taskFiltersAreActive() {
        return !!taskViewState.query || taskViewState.assignee !== 'all' || taskViewState.priority !== 'all' || taskViewState.deadline !== 'all';
    }

    function taskMatchesDeadline(form) {
        var filter = taskViewState.deadline;
        var due = form.dataset.taskDue || '';
        if (filter === 'all') return true;
        if (filter === 'none') return !due;
        if (filter === 'today') return due === APP_TODAY;
        if (filter === 'overdue') return !!due && due < APP_TODAY && form.dataset.taskCurrentStatus !== 'done';
        return true;
    }

    function taskMatchesFilters(form) {
        if (taskViewState.query && (form.dataset.taskSearchText || '').indexOf(taskViewState.query) === -1) return false;
        if (taskViewState.assignee !== 'all' && (form.dataset.taskAssignee || 'none') !== taskViewState.assignee) return false;
        if (taskViewState.priority !== 'all' && (form.dataset.taskPriority || 'normal') !== taskViewState.priority) return false;
        return taskMatchesDeadline(form);
    }

    function applyTaskFilters() {
        var workspace = qs('[data-task-workspace]');
        if (!workspace) return;
        var cards = qsa('[data-task-edit-form]', workspace);
        var visibleTotal = 0;
        cards.forEach(function (form) {
            var visible = taskMatchesFilters(form);
            form.hidden = !visible;
            if (visible) visibleTotal += 1;
        });
        qsa('[data-task-drop-list]', workspace).forEach(function (list) {
            var visibleCards = qsa('[data-task-edit-form]', list).filter(function (form) { return !form.hidden; });
            var allCards = qsa('[data-task-edit-form]', list);
            list.dataset.empty = visibleCards.length ? '0' : '1';
            var column = list.closest('[data-task-column-status]');
            var count = column ? qs('[data-task-column-count]', column) : null;
            var empty = qs('[data-task-column-empty]', list);
            if (count) count.textContent = String(visibleCards.length);
            if (empty) {
                var title = qs('span', empty);
                var hint = qs('small', empty);
                if (taskFiltersAreActive() && allCards.length) {
                    if (title) title.textContent = 'Нет совпадений';
                    if (hint) hint.textContent = 'Измените или сбросьте фильтры';
                } else {
                    if (title) title.textContent = 'Здесь пока пусто';
                    if (hint) hint.textContent = 'Перетащите задачу в эту колонку';
                }
            }
        });
        var result = qs('[data-task-filter-result]', workspace);
        if (result) result.textContent = 'Показано ' + visibleTotal + ' из ' + cards.length;
        var reset = qs('[data-task-filter-reset]', workspace);
        if (reset) reset.hidden = !taskFiltersAreActive();
    }

    function bindTaskFilters() {
        var workspace = qs('[data-task-workspace]');
        if (!workspace) return;
        var query = qs('[data-task-filter-query]', workspace);
        var assignee = qs('[data-task-filter-assignee]', workspace);
        var priority = qs('[data-task-filter-priority]', workspace);
        var deadline = qs('[data-task-filter-deadline]', workspace);
        if (query) query.value = taskViewState.query;
        if (assignee) assignee.value = taskViewState.assignee;
        if (priority) priority.value = taskViewState.priority;
        if (deadline) deadline.value = taskViewState.deadline;
        if (query) query.addEventListener('input', function () {
            taskViewState.query = query.value.trim().toLowerCase();
            applyTaskFilters();
        });
        [assignee, priority, deadline].forEach(function (control) {
            if (!control) return;
            control.addEventListener('change', function () {
                if (control === assignee) taskViewState.assignee = control.value;
                if (control === priority) taskViewState.priority = control.value;
                if (control === deadline) taskViewState.deadline = control.value;
                applyTaskFilters();
            });
        });
        var reset = qs('[data-task-filter-reset]', workspace);
        if (reset) reset.addEventListener('click', function () {
            taskViewState.query = '';
            taskViewState.assignee = 'all';
            taskViewState.priority = 'all';
            taskViewState.deadline = 'all';
            if (query) query.value = '';
            if (assignee) assignee.value = 'all';
            if (priority) priority.value = 'all';
            if (deadline) deadline.value = 'all';
            applyTaskFilters();
            if (query) query.focus();
        });
        var overdue = qs('[data-task-show-overdue]', workspace);
        if (overdue) overdue.addEventListener('click', function () {
            taskViewState.deadline = 'overdue';
            if (deadline) deadline.value = 'overdue';
            applyTaskFilters();
            var board = qs('.tasks-board', workspace);
            if (board && typeof board.scrollIntoView === 'function') board.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        applyTaskFilters();
    }

    function initTaskDragAndDrop(projectId) {
        if (!window.Sortable) {
            if (window.console) console.warn('SortableJS не загружен: перетаскивание задач отключено.');
            return;
        }
        syncTaskDropLists();
        qsa('[data-task-drop-list]').forEach(function (list) {
            if (list.dataset.sortableBound === '1') return;
            list.dataset.sortableBound = '1';
            window.Sortable.create(list, {
                group: {
                    name: 'shared-tasks',
                    pull: true,
                    put: true
                },
                delay: 0,
                delayOnTouchOnly: false,
                animation: 150,
                invertSwap: false,
                swapThreshold: 0.65,
                draggable: '[data-task-edit-form]',
                handle: '[data-task-drag-handle]',
                filter: 'input, select, textarea, button:not([data-task-drag-handle]), option, .task-card-editor, .task-card-editor *',
                preventOnFilter: false,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                fallbackClass: 'sortable-drag',
                forceFallback: false,
                touchStartThreshold: 0,
                emptyInsertThreshold: 18,
                onAdd: function (event) {
                    if (event.to) event.to.classList.remove('is-drag-over');
                },
                onChoose: function (event) {
                    qsa('[data-task-drop-list]').forEach(function (dropList) {
                        dropList.classList.add('is-drop-ready');
                    });
                    if (event.item) event.item.classList.add('is-task-dragging-source');
                },
                onUnchoose: function (event) {
                    qsa('[data-task-drop-list]').forEach(function (dropList) {
                        dropList.classList.remove('is-drop-ready', 'is-drag-over');
                    });
                    if (event.item) event.item.classList.remove('is-task-dragging-source');
                },
                onMove: function (event) {
                    if (!isTaskDragPointInsideList(event.to, event)) {
                        if (event.to) event.to.classList.remove('is-drag-over');
                        return false;
                    }
                    qsa('[data-task-drop-list]').forEach(function (dropList) {
                        dropList.classList.toggle('is-drag-over', dropList === event.to);
                    });
                    return true;
                },
                onEnd: function (event) {
                    qsa('[data-task-drop-list]').forEach(function (dropList) {
                        dropList.classList.remove('is-drop-ready', 'is-drag-over');
                    });
                    var form = event.item;
                    if (!form) return;
                    form.classList.remove('is-task-dragging-source');
                    var pointList = taskDropListFromPoint(event);
                    var targetList = pointList || event.to;
                    if (targetList && targetList !== form.parentNode) {
                        targetList.appendChild(form);
                    }
                    syncTaskDropLists();
                    var status = taskStatusFromDropList(targetList);
                    var previousStatus = form.dataset.taskCurrentStatus || taskStatusFromDropList(event.from) || 'open';
                    if (!status || status === previousStatus) return;
                    persistTaskDragMove(projectId, form, status, previousStatus, event.from, event.oldIndex);
                }
            });
        });
    }

    function renderTaskCreateForm(projectId, users) {
        var userOptions = '<option value="">Без ответственного</option>' + users.map(function (user) {
            return '<option value="' + user.id + '">' + escapeHtml(user.name) + '</option>';
        }).join('');
        return '<form class="task-create-form" data-task-form data-project-id="' + escapeHtml(projectId) + '">' +
            '<div class="task-create-head"><span class="task-create-head-icon"><i data-lucide="clipboard-plus" aria-hidden="true"></i></span><div><span>Задача объекта</span><h3 id="task-create-title">Новая задача</h3><p>Опишите результат, выберите ответственного и задайте срок.</p></div></div>' +
            '<div class="task-create-grid">' +
                '<label class="wide"><span>Название <b>*</b></span><input name="title" placeholder="Например: принять кладку второго этажа" maxlength="160" required autofocus></label>' +
                '<label class="wide"><span>Описание</span><textarea name="description" rows="4" placeholder="Что должно быть сделано и какой результат ожидается"></textarea></label>' +
                '<label><span>Статус</span><select name="status" aria-label="Статус"><option value="open">В очереди</option><option value="in_progress">В работе</option><option value="review">На проверке</option><option value="done">Готово</option></select></label>' +
                '<label><span>Приоритет</span><select name="priority" aria-label="Приоритет"><option value="normal">Средний</option><option value="high">Высокий</option><option value="low">Низкий</option></select></label>' +
                '<label><span>Срок</span><input name="due_at" aria-label="Срок" type="date"></label>' +
                '<label><span>Исполнитель</span><select name="assignee_id" aria-label="Исполнитель">' + userOptions + '</select></label>' +
            '</div>' +
            '<div class="task-create-error" data-task-create-error role="alert" hidden></div>' +
            '<div class="task-create-actions"><button class="ghost" type="button" data-task-create-close>Отмена</button><button class="primary" type="submit"><i data-lucide="plus" aria-hidden="true"></i><span>Создать задачу</span></button></div>' +
        '</form>';
    }

    function renderTaskCreateModal(projectId, users) {
        return '<div class="task-create-modal" data-task-create-modal hidden>' +
            '<div class="task-create-backdrop" data-task-create-close></div>' +
            '<div class="task-create-dialog" role="dialog" aria-modal="true" aria-labelledby="task-create-title">' +
                '<button class="task-create-close" type="button" data-task-create-close aria-label="Закрыть"><i data-lucide="x"></i></button>' +
                renderTaskCreateForm(projectId, users) +
            '</div>' +
        '</div>';
    }

    function cleanupTaskCreateModals() {
        var modals = qsa('body > [data-task-create-modal]');
        modals.slice(0, -1).forEach(function (modal) { modal.remove(); });
        document.body.classList.remove('task-modal-lock');
    }

    var taskCreateLastTrigger = null;

    function closeTaskCreateModal(modal) {
        modal = modal || qs('[data-task-create-modal]');
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.classList.remove('task-modal-lock');
        setTimeout(function () {
            if (!modal.classList.contains('is-open')) modal.hidden = true;
        }, 180);
        if (taskCreateLastTrigger && typeof taskCreateLastTrigger.focus === 'function') {
            taskCreateLastTrigger.focus();
        }
    }

    function openTaskCreateModal(trigger) {
        var modal = qs('[data-task-create-modal]');
        if (!modal) return;
        taskCreateLastTrigger = trigger || document.activeElement;
        modal.hidden = false;
        document.body.classList.add('task-modal-lock');
        requestAnimationFrame(function () {
            modal.classList.add('is-open');
            var firstInput = qs('input, select, textarea, button[type="submit"]', modal);
            if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
        });
    }

    function bindTaskForm(projectId) {
        var panel = qs('[data-panel="tasks"]') || document;
        var modal = qs('[data-task-create-modal]', panel) || qs('[data-task-create-modal]');
        qsa('body > [data-task-create-modal]').forEach(function (oldModal) {
            if (oldModal !== modal) oldModal.remove();
        });
        if (modal && modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }
        cleanupTaskCreateModals();
        var form = qs('[data-task-form]', modal || panel);
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        qsa('[data-task-create-toggle]').forEach(function (toggle) {
            if (!modal || toggle.dataset.bound === '1') return;
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', function () {
                openTaskCreateModal(toggle);
            });
        });
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
            var error = qs('[data-task-create-error]', form);
            var submit = qs('button[type="submit"]', form);
            if (!form.title.value.trim()) {
                if (error) {
                    error.hidden = false;
                    error.textContent = 'Введите название задачи.';
                }
                form.title.focus();
                return;
            }
            if (error) error.hidden = true;
            if (submit) submit.disabled = true;
            form.classList.add('is-saving');
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
                showFinanceToast('Задача создана');
                loadTasks(projectId);
            }).catch(function (err) {
                if (submit) submit.disabled = false;
                form.classList.remove('is-saving');
                if (error) {
                    error.hidden = false;
                    error.textContent = appErrorMessage(err, 'Не удалось создать задачу');
                }
            });
        });
    }

    function taskEditorPayload(form, statusOverride) {
        return {
            title: form.title ? form.title.value.trim() : '',
            description: form.description ? form.description.value.trim() : '',
            status: statusOverride || (form.status ? form.status.value : form.dataset.taskCurrentStatus || 'open'),
            priority: form.priority ? form.priority.value : 'normal',
            due_at: form.due_at ? form.due_at.value : '',
            assignee_id: form.assignee_id ? form.assignee_id.value : ''
        };
    }

    function setTaskEditorOpen(form, open, reset) {
        if (!form) return;
        var editor = qs('[data-task-card-editor]', form);
        var toggle = qs('[data-task-edit-toggle]', form);
        if (!editor || !toggle) return;
        if (!open && reset && typeof form.reset === 'function') form.reset();
        editor.hidden = !open;
        form.classList.toggle('is-editing', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            var title = form.title;
            if (title && typeof title.focus === 'function') title.focus();
        }
    }

    function saveTaskEditor(projectId, form, statusOverride) {
        var error = qs('[data-task-editor-error]', form);
        var payload = taskEditorPayload(form, statusOverride);
        if (!payload.title) {
            setTaskEditorOpen(form, true, false);
            if (error) {
                error.hidden = false;
                error.textContent = 'Введите название задачи.';
            }
            return Promise.reject(new Error('title_required'));
        }
        if (error) error.hidden = true;
        form.classList.add('is-task-drag-saving');
        qsa('button, input, select, textarea', form).forEach(function (control) { control.disabled = true; });
        return api('/api/tasks/' + form.dataset.taskId + '/update', {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(function () {
            showFinanceToast(statusOverride === 'done' ? 'Задача выполнена' : 'Задача сохранена');
            loadTasks(projectId);
            if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                loadStages(projectId, function (stages) {
                    loadExecutionInsights(projectId, stages);
                });
            }
        }).catch(function (err) {
            form.classList.remove('is-task-drag-saving');
            qsa('button, input, select, textarea', form).forEach(function (control) { control.disabled = false; });
            if (error) {
                error.hidden = false;
                error.textContent = appErrorMessage(err, 'Не удалось сохранить задачу');
            }
            if (statusOverride) setTaskEditorOpen(form, true, false);
            throw err;
        });
    }

    function bindTaskEditors(projectId) {
        qsa('[data-task-edit-form]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            var toggle = qs('[data-task-edit-toggle]', form);
            var cancel = qs('[data-task-edit-cancel]', form);
            var quickStatus = qs('[data-task-quick-status]', form);
            if (toggle) toggle.addEventListener('click', function () {
                var open = toggle.getAttribute('aria-expanded') !== 'true';
                qsa('[data-task-edit-form].is-editing').forEach(function (other) {
                    if (other !== form) setTaskEditorOpen(other, false, true);
                });
                setTaskEditorOpen(form, open, !open);
            });
            if (cancel) cancel.addEventListener('click', function () {
                setTaskEditorOpen(form, false, true);
            });
            if (quickStatus) quickStatus.addEventListener('click', function () {
                saveTaskEditor(projectId, form, quickStatus.dataset.taskQuickStatus).catch(function () {});
            });
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                saveTaskEditor(projectId, form).catch(function () {});
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

    function economicsMoney(kopecks) {
        var value = Number(kopecks);
        return Number.isFinite(value) ? money(value / 100) : '—';
    }

    function economicsPercent(value) {
        var number = Number(value);
        if (value == null || !Number.isFinite(number)) return '—';
        return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(number) + '%';
    }

    function economicsMetric(label, value, hint, tone, icon) {
        return '<article class="economics-metric' + (tone ? ' is-' + escapeHtml(tone) : '') + '">' +
            '<div class="economics-metric-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(icon || 'circle-dollar-sign') + '"></i></div>' +
            '<span>' + escapeHtml(label) + '</span>' +
            '<strong>' + escapeHtml(value) + '</strong>' +
            '<small>' + escapeHtml(hint || '') + '</small>' +
        '</article>';
    }

    function economicsComponentTypeLabel(type) {
        return {
            remaining_commitment: 'Остаток обязательства',
            uncontracted: 'Незаконтрактованный остаток',
            adjustment: 'Корректировка',
            risk: 'Риск'
        }[type] || type || 'Компонент';
    }

    function economicsSourceLabel(type) {
        return {
            approved_commitment: 'Утвержденное обязательство',
            active_supplier_offer: 'Активное предложение',
            autobot_snapshot: 'Снимок AutoBot',
            target_budget: 'Целевая себестоимость',
            manual_unit_price: 'Ручная прогнозная цена',
            manual_adjustment: 'Ручная корректировка',
            manual_risk: 'Ручной риск'
        }[type] || type || 'Источник';
    }

    function economicsSourceDate(timestamp) {
        var value = Number(timestamp || 0);
        if (!value) return '—';
        try {
            return new Intl.DateTimeFormat('ru-RU').format(new Date(value * 1000));
        } catch (error) {
            return '—';
        }
    }

    function renderEconomicsCashFlow(cashFlow) {
        cashFlow = cashFlow || {};
        var balance = Number(cashFlow.cashBalanceGrossKopecks || 0);
        return '<section class="economics-group economics-cash-group">' +
            '<div class="economics-group-head"><div><h4>Денежный поток</h4><p>Фактические поступления и оплаты с НДС. На прибыль и EAC не влияет.</p></div><span class="economics-mode-badge">с НДС</span></div>' +
            '<div class="economics-metrics economics-cash-metrics">' +
                economicsMetric('Получено', economicsMoney(cashFlow.cashReceivedGrossKopecks), 'Фактические поступления', '', 'arrow-down-left') +
                economicsMetric('Оплачено', economicsMoney(cashFlow.cashPaidGrossKopecks), 'Фактические выплаты', '', 'arrow-up-right') +
                economicsMetric('Кассовый остаток', economicsMoney(balance), 'Получено минус оплачено', balance < 0 ? 'negative' : (balance > 0 ? 'positive' : 'neutral'), 'wallet-cards') +
            '</div>' +
        '</section>';
    }

    function renderEconomicsComponents(forecast) {
        var components = Array.isArray(forecast && forecast.components) ? forecast.components : [];
        if (!components.length) return '';
        return '<details class="economics-components">' +
            '<summary><span>Из чего состоит ETC</span><b>' + escapeHtml(String(components.length)) + '</b></summary>' +
            '<div class="economics-components-head"><span>Компонент</span><span>Источник</span><span>Количество</span><span>Сумма без НДС</span></div>' +
            components.map(function (component) {
                var quantity = component.quantity == null
                    ? '—'
                    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(Number(component.quantity)) + (component.unit ? ' ' + component.unit : '');
                var signedAmount = Number(component.signedNetAmountKopecks || 0);
                var sourceMeta = economicsSourceDate(component.sourceSnapshotAt) + (component.sourceVersion ? ' · ' + component.sourceVersion : '');
                return '<div class="economics-component-row">' +
                    '<div><b>' + escapeHtml(component.title || economicsComponentTypeLabel(component.componentType)) + '</b><small>' + escapeHtml(economicsComponentTypeLabel(component.componentType)) + '</small></div>' +
                    '<div><span>' + escapeHtml(economicsSourceLabel(component.sourceType)) + '</span><small>' + escapeHtml(sourceMeta) + '</small></div>' +
                    '<span>' + escapeHtml(quantity) + '</span>' +
                    '<strong class="' + (signedAmount < 0 ? 'is-negative' : '') + '">' + escapeHtml(economicsMoney(signedAmount)) + '</strong>' +
                '</div>';
            }).join('') +
        '</details>';
    }

    function renderProjectEconomics(data, loadError) {
        if (loadError) {
            return '<section class="project-economics ui-card is-error" data-project-economics>' +
                '<div class="economics-head"><div><span class="section-label">Результат объекта · без НДС</span><h3>Экономическая сводка временно недоступна</h3><p>Платежи и счета продолжают работать в соседних разделах.</p></div></div>' +
            '</section>';
        }
        data = data || {};
        if (data.status === 'not_configured') {
            return '';
        }

        var current = data.current || {};
        var forecast = data.forecast || null;
        var forecastStatus = data.forecastStatus || 'not_calculated';
        var statusLabel = forecastStatus === 'stale' ? 'Требует пересчета' : (forecast ? 'Актуален' : 'Не рассчитан');
        var statusTone = forecastStatus === 'stale' ? 'is-danger' : (forecast ? 'is-success' : 'is-warning');
        var baseline = data.baseline || {};
        var forecastMargin = forecast ? Number(forecast.forecastMarginNetKopecks || 0) : null;
        var forecastEac = forecast ? Number(forecast.eacNetKopecks || 0) : null;
        var actualCost = Number(current.actualCostNetKopecks || 0);
        var costProgress = forecastEac > 0 ? Math.max(0, Math.min(100, Math.round(actualCost / forecastEac * 100))) : 0;
        var marginTone = forecastMargin == null ? '' : (forecastMargin < 0 ? 'is-danger' : 'is-success');
        var html = '<section class="project-economics ui-card" data-project-economics>' +
            '<div class="economics-head"><div><span class="section-label">Результат объекта · без НДС</span><h3>От плана к ожидаемому итогу</h3><p>Здесь показаны прибыль и стоимость работ. Реальное движение денег вынесено отдельно.</p></div><div class="economics-head-badges"><span class="economics-mode-badge">База v' + escapeHtml(baseline.versionNo || '—') + '</span><span class="economics-status ' + statusTone + '">' + escapeHtml(statusLabel) + '</span></div></div>' +
            '<div class="economics-story-grid">' +
                '<article class="economics-story-card"><header><span>1 · План</span><i data-lucide="landmark"></i></header>' +
                    '<div class="economics-story-value"><small>Договорная выручка</small><strong>' + escapeHtml(economicsMoney(current.contractRevenueNetKopecks)) + '</strong></div>' +
                    '<div class="economics-story-row"><span>Целевая себестоимость</span><b>' + escapeHtml(economicsMoney(current.targetCostNetKopecks)) + '</b></div>' +
                '</article>' +
                '<article class="economics-story-card"><header><span>2 · Исполнение</span><i data-lucide="hard-hat"></i></header>' +
                    '<div class="economics-story-value"><small>Факт затрат</small><strong>' + escapeHtml(economicsMoney(current.actualCostNetKopecks)) + '</strong></div>' +
                    '<div class="economics-story-row"><span>Обязательства</span><b>' + escapeHtml(economicsMoney(current.committedTotalNetKopecks)) + '</b></div>' +
                    '<div class="economics-story-row"><span>Остаток обязательств</span><b>' + escapeHtml(economicsMoney(current.remainingCommitmentNetKopecks)) + '</b></div>' +
                '</article>' +
                '<article class="economics-story-card economics-story-result ' + marginTone + '"><header><span>3 · Прогноз</span><i data-lucide="chart-no-axes-combined"></i></header>' +
                    (forecast
                        ? '<div class="economics-story-value"><small>Прогнозная маржа</small><strong>' + escapeHtml(economicsMoney(forecastMargin)) + '</strong><em>' + escapeHtml(economicsPercent(forecast.forecastMarginPercent)) + ' от выручки</em></div>' +
                            '<div class="economics-story-row"><span>EAC · итоговая себестоимость</span><b>' + escapeHtml(economicsMoney(forecast.eacNetKopecks)) + '</b></div>' +
                            '<div class="economics-story-row"><span>ETC · осталось потратить</span><b>' + escapeHtml(economicsMoney(forecast.etcNetKopecks)) + '</b></div>'
                        : '<div class="economics-story-empty"><b>Прогноз не рассчитан</b><span>План и факт уже видны, но итоговая себестоимость и маржа появятся после расчёта.</span></div>') +
                '</article>' +
            '</div>';

        if (!forecast) {
            html += '<div class="economics-notice is-warning"><i data-lucide="calculator"></i><div><b>Нужен первый прогноз до завершения</b><span>ETC, EAC и прогнозная маржа не рассчитаны. Перейдите в управленческий учёт и создайте расчёт.</span></div><button class="ghost compact" type="button" data-finance-view-target="management" data-econ-mode-target="forecast">Рассчитать прогноз</button></div>';
        } else {
            var variance = Number(forecast.budgetVarianceNetKopecks || 0);
            html += '<div class="economics-forecast-foot">' +
                '<div><span>Освоено по факту от EAC</span><b>' + escapeHtml(String(costProgress) + '%') + '</b><i><em style="width:' + costProgress + '%"></em></i></div>' +
                '<div><span>Отклонение от бюджета</span><strong class="' + (variance < 0 ? 'is-negative' : (variance > 0 ? 'is-positive' : '')) + '">' + escapeHtml(economicsMoney(variance)) + '</strong><small>' + escapeHtml(variance < 0 ? 'прогнозный перерасход' : (variance > 0 ? 'прогнозная экономия' : 'в пределах бюджета')) + '</small></div>' +
                '<div><span>Версия прогноза</span><strong>v' + escapeHtml(forecast.versionNo || '—') + '</strong><small>на ' + escapeHtml(formatDisplayDate(forecast.calculationDate) || forecast.calculationDate || '—') + '</small></div>' +
            '</div>' +
            (forecastStatus === 'stale' ? '<div class="economics-notice is-danger"><i data-lucide="refresh-cw"></i><div><b>Исходные данные изменились</b><span>Для решения нужен новый расчёт; текущая версия сохранена в истории.</span></div><button class="ghost compact" type="button" data-finance-view-target="management" data-econ-mode-target="forecast">Пересчитать</button></div>' : '') +
            renderEconomicsComponents(forecast);
        }
        return html + '</section>';
    }

    function loadProjectEconomicsData(projectId, force) {
        if (!canViewProjectEconomics()) return Promise.resolve(null);
        state.projectEconomicsByProject = state.projectEconomicsByProject || {};
        state.projectEconomicsPromisesByProject = state.projectEconomicsPromisesByProject || {};
        if (!force && state.projectEconomicsByProject[projectId]) {
            return Promise.resolve(state.projectEconomicsByProject[projectId]);
        }
        if (state.projectEconomicsPromisesByProject[projectId]) {
            return state.projectEconomicsPromisesByProject[projectId];
        }
        var request = api('/api/projects/' + projectId + '/economics', {
            silentLoader: true,
            requestGroup: 'project-economics-' + projectId
        }).then(function (data) {
            state.projectEconomicsByProject[projectId] = data || {};
            return data || {};
        }).finally(function () {
            delete state.projectEconomicsPromisesByProject[projectId];
        });
        state.projectEconomicsPromisesByProject[projectId] = request;
        return request;
    }

    function loadProjectFinances(projectId, loadingToken, options) {
        options = options || {};
        if (!options.preserveEconomicsManagementCache && PMBI.economicsManagement && typeof PMBI.economicsManagement.invalidate === 'function') {
            PMBI.economicsManagement.invalidate(projectId);
        }
        var financesRequest = api('/api/projects/' + projectId + '/finances').then(function (data) {
            return { data: data || {}, error: null };
        }).catch(function (error) {
            return { data: {}, error: error || true };
        });
        var economicsRequest = canViewProjectEconomics()
            ? loadProjectEconomicsData(projectId, true).then(function (data) {
                return { data: data || {}, error: null };
            }).catch(function (error) {
                return { data: null, error: error || true };
            })
            : Promise.resolve({ data: null, error: null });
        Promise.all([financesRequest, economicsRequest]).then(function (results) {
            if (!isCurrentProject(projectId, loadingToken)) return;
            var finances = results[0];
            var economics = results[1];
            renderProjectFinances(
                projectId,
                Array.isArray(finances.data.items) ? finances.data.items : [],
                finances.data.summary || {},
                economics.data,
                economics.error,
                finances.error
            );
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
        var fileInput = form.querySelector('[data-document-file]');
        var fileName = form.querySelector('[data-document-file-name]');
        var fileMeta = form.querySelector('[data-document-file-meta]');
        var dropzone = form.querySelector('[data-document-dropzone]');
        var submitButton = form.querySelector('[data-document-upload-submit]');

        function syncSelectedFile() {
            var file = fileInput && fileInput.files && fileInput.files[0];
            if (fileName) fileName.textContent = file ? file.name : 'Выберите файл или перетащите его сюда';
            if (fileMeta) fileMeta.textContent = file
                ? (formatBytes(file.size) + ' · файл готов к загрузке')
                : 'Любой рабочий формат, до 25 МБ';
            if (dropzone) dropzone.classList.toggle('has-file', !!file);
            if (file && form.title && !form.title.value.trim()) {
                form.title.value = file.name.replace(/\.[^.]+$/, '');
            }
        }

        if (fileInput) fileInput.addEventListener('change', syncSelectedFile);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = form.querySelector('[data-document-upload-error]');
            if (error) error.classList.remove('active');
            if (!form.file.files || !form.file.files[0]) {
                if (error) {
                    error.textContent = 'Нужно выбрать файл';
                    error.classList.add('active');
                }
                return;
            }
            if (form.file.files[0].size > 25 * 1024 * 1024) {
                if (error) {
                    error.textContent = 'Файл больше 25 МБ. Выберите файл меньшего размера.';
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
            if (form.stage_id && form.stage_id.value) data.append('stage_id', form.stage_id.value);
            if (form.is_client_visible.checked) data.append('is_client_visible', '1');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.classList.add('is-loading');
                submitButton.setAttribute('aria-busy', 'true');
            }
            apiFormData('/api/projects/' + projectId + '/documents', data).then(function () {
                form.reset();
                syncSelectedFile();
                showAppNotice('Документ загружен.', 'success');
                loadDocuments(projectId);
                refreshProjectOverview(projectId);
            }).catch(function (err) {
                if (error) {
                    var errorCode = err && err.payload && err.payload.error;
                    error.textContent = {
                        file_required: 'Нужно выбрать файл.',
                        empty_file: 'Выбранный файл пуст.',
                        upload_too_large: 'Файл больше 25 МБ. Выберите файл меньшего размера.',
                        forbidden: 'У вас нет прав на загрузку документов.'
                    }[errorCode] || 'Не удалось загрузить документ. Попробуйте ещё раз.';
                    error.classList.add('active');
                }
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.classList.remove('is-loading');
                    submitButton.removeAttribute('aria-busy');
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
                return '<button class="chat-item ' + (index === 0 ? 'active' : '') + '" type="button" data-open-chat="' + chat.id + '"><b>' + escapeHtml(chat.title) + '</b><span>' + escapeHtml(chat.projectTitle) + '</span></button>';
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
            api('/api/projects/' + projectId + '/stages').catch(function () { return { stages: [] }; }),
            canViewProjectEconomics()
                ? loadProjectEconomicsData(projectId, false).catch(function () { return { status: 'unavailable' }; })
                : Promise.resolve(null),
            canSeeFinances()
                ? api('/api/projects/' + projectId + '/finances', { silentLoader: true }).catch(function () { return { items: [], summary: {}, unavailable: true }; })
                : Promise.resolve(null),
            api('/api/projects/' + projectId + '/assignments', { silentLoader: true }).catch(function () { return { assignments: [] }; })
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
                stages: stages,
                economics: results[6] || null,
                finances: results[7] || null,
                assignments: results[8] || { assignments: [] }
            }));
            syncProjectOverviewCover(project || state.selectedProject || {}, documents);
            refreshLucideIcons(root);
            bindProjectOverviewActions();
            syncProjectTabVisibility(qs('[data-project-detail]') || document);
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
            service_act: 'Акт оказанных услуг',
            letter: 'Письмо',
            correspondence: 'Переписка',
            invoice: 'Счет',
            delivery_note: 'Накладная',
            upd: 'УПД',
            transport_waybill: 'Транспортная накладная / ТТН',
            route_sheet: 'Путевой лист',
            cash_receipt: 'Кассовый чек',
            archive: 'Архив',
            photo_report: 'Фотоотчет',
            finance: 'Финансы',
            other: 'Другое',
            file: 'Файл'
        }[type] || type || 'Документ';
    }

    function documentTypeIcon(type, fileExt) {
        var extension = String(fileExt || '').toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].indexOf(extension) !== -1) return 'image';
        if (extension === '.pdf') return 'file-text';
        if (['.xls', '.xlsx', '.csv'].indexOf(extension) !== -1) return 'file-spreadsheet';
        if (['.zip', '.rar', '.7z'].indexOf(extension) !== -1) return 'file-archive';
        return {
            contract: 'scroll-text',
            act: 'file-check-2',
            hidden_work_act: 'clipboard-check',
            inspection_act: 'clipboard-search',
            estimate: 'table-2',
            project_doc: 'panels-top-left',
            executive: 'badge-check',
            technical_solution: 'wrench',
            letter: 'mail',
            correspondence: 'messages-square',
            invoice: 'receipt-text',
            delivery_note: 'package-check',
            upd: 'files',
            transport_waybill: 'truck',
            route_sheet: 'route',
            cash_receipt: 'receipt',
            archive: 'archive',
            photo_report: 'images',
            finance: 'wallet-cards'
        }[type] || 'file';
    }

    function documentStatusTone(status) {
        if (['reviewed', 'approved', 'signed', 'ready', 'accepted'].indexOf(status) !== -1) return 'is-success';
        if (status === 'draft') return 'is-draft';
        if (status === 'internal') return 'is-internal';
        return 'is-neutral';
    }

    function documentFileExtension(doc) {
        var extension = String(doc && doc.file_ext || '').replace(/^\./, '').trim();
        if (!extension && doc && doc.original_name && doc.original_name.indexOf('.') !== -1) {
            extension = doc.original_name.split('.').pop();
        }
        return (extension || 'FILE').slice(0, 5).toUpperCase();
    }

    function documentCountLabel(value) {
        var count = Number(value) || 0;
        var mod100 = count % 100;
        var mod10 = count % 10;
        if (mod100 >= 11 && mod100 <= 14) return count + ' документов';
        if (mod10 === 1) return count + ' документ';
        if (mod10 >= 2 && mod10 <= 4) return count + ' документа';
        return count + ' документов';
    }

    function documentDisplayDate(doc) {
        var value = doc && (doc.updated_at || doc.created_at);
        return value ? formatDisplayDate(value) : '';
    }

    var documentWorkspaceCleanup = null;
    var documentTypeChoices = [
        'contract', 'estimate', 'project_doc', 'hidden_work_act', 'inspection_act',
        'executive', 'technical_solution', 'act', 'service_act', 'invoice',
        'delivery_note', 'upd', 'transport_waybill', 'route_sheet', 'cash_receipt',
        'photo_report', 'letter', 'correspondence', 'archive', 'finance', 'other', 'file'
    ];
    var documentStatusChoices = ['draft', 'submitted', 'reviewed', 'approved', 'signed', 'ready', 'accepted', 'internal'];
    var documentStatusRank = { draft: 0, submitted: 1, reviewed: 2, approved: 3, signed: 4, ready: 5, accepted: 5 };
    var documentProtectedStatuses = ['submitted', 'reviewed', 'approved', 'signed', 'ready', 'accepted'];

    function documentSelectOptions(values, labeler) {
        return values.map(function (value) {
            return '<option value="' + escapeHtml(value) + '">' + escapeHtml(labeler(value)) + '</option>';
        }).join('');
    }

    function mountDocumentWorkspaceOverlays(projectId, canManage) {
        var contextMenu = document.createElement('div');
        contextMenu.className = 'document-context-menu';
        contextMenu.setAttribute('data-document-context-menu', '');
        contextMenu.setAttribute('role', 'menu');
        contextMenu.setAttribute('aria-label', 'Действия с документом');
        contextMenu.hidden = true;
        contextMenu.innerHTML =
            '<button type="button" role="menuitem" data-document-context-action="open"><i data-lucide="external-link"></i><span>Открыть</span></button>' +
            '<button type="button" role="menuitem" data-document-context-action="download"><i data-lucide="download"></i><span>Скачать</span></button>' +
            (canManage
                ? '<span class="document-context-separator" role="separator"></span>' +
                  '<button type="button" role="menuitem" data-document-context-action="edit"><i data-lucide="file-pen-line"></i><span>Редактировать</span></button>' +
                  '<button class="is-danger" type="button" role="menuitem" data-document-context-action="delete"><i data-lucide="trash-2"></i><span>Удалить</span></button>'
                : '');
        document.body.appendChild(contextMenu);

        var editor = null;
        if (canManage) {
            var stages = (state.stagesByProject && state.stagesByProject[projectId]) ? state.stagesByProject[projectId] : [];
            var stageOptions = '<option value="">Без этапа</option>' + stages.map(function (stage) {
                return '<option value="' + escapeHtml(stage.id) + '">' + escapeHtml(stage.title || ('Этап #' + stage.id)) + '</option>';
            }).join('');
            editor = document.createElement('div');
            editor.className = 'document-editor-modal';
            editor.setAttribute('data-document-editor-modal', '');
            editor.hidden = true;
            editor.innerHTML =
                '<button class="document-editor-backdrop" type="button" data-document-editor-close tabindex="-1" aria-label="Закрыть окно"></button>' +
                '<section class="document-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="document-editor-title">' +
                    '<form data-document-editor-form>' +
                        '<header class="document-editor-head"><div><span class="section-label">Карточка документа</span><h2 id="document-editor-title">Редактировать документ</h2><p data-document-editor-file></p></div>' +
                        '<button class="document-icon-button" type="button" data-document-editor-close aria-label="Закрыть"><i data-lucide="x"></i></button></header>' +
                        '<div class="document-editor-grid">' +
                            '<label class="document-field document-field-wide"><span>Название</span><input name="title" maxlength="240" required autocomplete="off"></label>' +
                            '<label class="document-field"><span>Тип документа</span><select name="doc_type">' + documentSelectOptions(documentTypeChoices, docTypeLabel) + '</select></label>' +
                            '<label class="document-field"><span>Статус</span><select name="status">' + documentSelectOptions(documentStatusChoices, statusLabel) + '</select></label>' +
                            '<label class="document-field"><span>Этап работ</span><select name="stage_id">' + stageOptions + '</select></label>' +
                            '<label class="document-field document-field-wide"><span>Комментарий</span><textarea name="notes" rows="4" maxlength="4000" placeholder="Что важно знать об этом документе"></textarea></label>' +
                        '</div>' +
                        '<footer class="document-editor-footer"><label class="document-visibility-switch"><input type="checkbox" name="is_client_visible"><span aria-hidden="true"></span><strong>Доступен заказчику</strong><small>Заказчик увидит документ в своём кабинете</small></label>' +
                        '<div class="document-editor-actions"><button class="ghost" type="button" data-document-editor-close>Отмена</button><button class="primary" type="submit" data-document-editor-save><i data-lucide="save"></i><span>Сохранить</span></button></div></footer>' +
                        '<div class="form-error" data-document-editor-error role="alert" hidden></div>' +
                    '</form>' +
                '</section>';
            document.body.appendChild(editor);
        }
        refreshLucideIcons(contextMenu);
        if (editor) refreshLucideIcons(editor);
        return { menu: contextMenu, editor: editor };
    }

    function renderDocumentRow(doc) {
        var hasFile = !!doc.storage_path;
        var title = doc.title || doc.original_name || 'Документ без названия';
        var imageUrl = projectDocumentImageUrl(doc);
        var fileMeta = [doc.original_name || '', doc.size_bytes ? formatBytes(doc.size_bytes) : ''].filter(Boolean).join(' · ');
        var details = [];
        if (doc.stage_title) details.push('<span><i data-lucide="layers-3"></i>' + escapeHtml(doc.stage_title) + '</span>');
        if (doc.uploaded_by_name) details.push('<span><i data-lucide="user-round"></i>' + escapeHtml(doc.uploaded_by_name) + '</span>');
        if (documentDisplayDate(doc)) details.push('<span><i data-lucide="calendar-days"></i>' + escapeHtml(documentDisplayDate(doc)) + '</span>');
        var actions = doc.storage_path
            ? ((doc.can_preview ? '<a class="document-action is-primary" href="' + escapeHtml(doc.view_url) + '" target="_blank" rel="noreferrer" aria-label="Открыть ' + escapeHtml(title) + '"><i data-lucide="eye"></i><span>Открыть</span></a>' : '') +
               '<a class="document-action" href="' + escapeHtml(doc.download_url) + '" target="_blank" rel="noreferrer" aria-label="Скачать ' + escapeHtml(title) + '"><i data-lucide="download"></i><span>Скачать</span></a>')
            : '<span class="document-no-file"><i data-lucide="file-clock"></i>Файл ожидается</span>';
        var fileVisual = imageUrl
            ? '<div class="document-file-visual has-image" aria-hidden="true"><img src="' + escapeHtml(imageUrl) + '" alt="" loading="lazy" decoding="async"><span>' + escapeHtml(documentFileExtension(doc)) + '</span></div>'
            : '<div class="document-file-visual" aria-hidden="true"><i data-lucide="' + escapeHtml(documentTypeIcon(doc.doc_type, doc.file_ext)) + '"></i><span>' + escapeHtml(documentFileExtension(doc)) + '</span></div>';
        var hasContextActions = hasFile || canManageDocuments();
        var moreAction = hasContextActions
            ? '<button class="document-action is-menu" type="button" data-document-menu-button aria-haspopup="menu" aria-label="Действия с документом ' + escapeHtml(title) + '" title="Действия (правый клик)"><i data-lucide="ellipsis"></i></button>'
            : '';
        var contextAttributes = hasContextActions
            ? ' tabindex="0" aria-label="' + escapeHtml(title) + '. Действия — правый клик или Shift+F10"'
            : '';
        return '<article class="document-row document-card ' + (hasFile ? 'has-file' : 'is-fileless') + '" data-document-card data-document-id="' + escapeHtml(doc.id) + '"' + contextAttributes + '>' +
            fileVisual +
            '<div class="document-card-content">' +
                '<div class="document-card-title-row">' +
                    '<div class="document-card-title"><h4>' + escapeHtml(title) + '</h4>' +
                        (fileMeta ? '<p title="' + escapeHtml(doc.original_name || '') + '">' + escapeHtml(fileMeta) + '</p>' : '<p>Карточка создана, файл ещё не приложен</p>') +
                    '</div>' +
                    '<span class="document-status ' + documentStatusTone(doc.status) + '">' + escapeHtml(statusLabel(doc.status)) + '</span>' +
                '</div>' +
                '<div class="document-card-chips">' +
                    '<span class="document-chip"><i data-lucide="folder"></i>' + escapeHtml(docTypeLabel(doc.doc_type)) + '</span>' +
                    '<span class="document-chip ' + (doc.is_client_visible ? 'is-visible' : '') + '"><i data-lucide="' + (doc.is_client_visible ? 'users-round' : 'lock-keyhole') + '"></i>' + (doc.is_client_visible ? 'Доступен заказчику' : 'Только команда') + '</span>' +
                '</div>' +
                (details.length ? '<div class="document-card-meta">' + details.join('') + '</div>' : '') +
                (doc.notes ? '<p class="document-card-note">' + escapeHtml(doc.notes) + '</p>' : '') +
            '</div>' +
            '<div class="document-actions">' + actions + moreAction + '</div>' +
        '</article>';
    }

    function renderDocumentUpload(projectId) {
        if (!canManageDocuments()) return '';
        var stages = (state.stagesByProject && state.stagesByProject[projectId]) ? state.stagesByProject[projectId] : [];
        var stageOptions = '<option value="">Без этапа</option>' + stages.filter(function (stage) {
            return stage.stage_kind !== 'section';
        }).map(function (stage) {
            return '<option value="' + stage.id + '">' + escapeHtml(stage.title) + '</option>';
        }).join('');
        var fileInputId = 'project-document-file-' + projectId;
        return '<form class="document-upload-form" data-document-upload-form data-project-id="' + projectId + '" hidden>' +
            '<div class="document-upload-head">' +
                '<div><span class="section-label">Новый файл</span><h3>Добавить документ</h3><p>Заполните только важное — название подставится из имени файла автоматически.</p></div>' +
                '<button class="document-icon-button" type="button" data-document-upload-close aria-label="Закрыть форму"><i data-lucide="x"></i></button>' +
            '</div>' +
            '<label class="document-dropzone" data-document-dropzone for="' + fileInputId + '">' +
                '<input id="' + fileInputId + '" name="file" type="file" required data-document-file>' +
                '<span class="document-dropzone-icon" aria-hidden="true"><i data-lucide="cloud-upload"></i></span>' +
                '<span class="document-dropzone-copy"><strong data-document-file-name>Выберите файл или перетащите его сюда</strong><small data-document-file-meta>Любой рабочий формат, до 25 МБ</small></span>' +
                '<span class="document-dropzone-action">Выбрать</span>' +
            '</label>' +
            '<div class="document-upload-grid">' +
                '<label class="document-field document-field-wide"><span>Название</span><input name="title" placeholder="Например, Акт выполненных работ № 12"></label>' +
                '<label class="document-field"><span>Тип документа</span><select name="doc_type">' +
                '<option value="contract">Договор</option>' +
                '<option value="estimate">Смета</option>' +
                '<option value="project_doc">Проектная документация</option>' +
                '<option value="hidden_work_act">Акт скрытых работ</option>' +
                '<option value="inspection_act">Акт осмотра</option>' +
                '<option value="executive">Исполнительная документация</option>' +
                '<option value="technical_solution">Техрешение</option>' +
                '<option value="act">Акт</option>' +
                '<option value="invoice">Счет</option>' +
                '<option value="delivery_note">Накладная</option>' +
                '<option value="upd">УПД</option>' +
                '<option value="transport_waybill">Транспортная накладная / ТТН</option>' +
                '<option value="route_sheet">Путевой лист</option>' +
                '<option value="cash_receipt">Кассовый чек</option>' +
                '<option value="photo_report">Фотоотчет</option>' +
                '<option value="correspondence">Переписка</option>' +
                '<option value="archive">Архив</option>' +
                '<option value="finance">Финансы</option>' +
                '<option value="other">Другое</option>' +
                '</select></label>' +
                '<label class="document-field"><span>Этап работ</span><select name="stage_id">' + stageOptions + '</select></label>' +
                '<label class="document-field"><span>Статус</span><select name="status">' +
                '<option value="draft">Черновик</option>' +
                '<option value="reviewed">Проверен</option>' +
                '<option value="approved">Утвержден</option>' +
                '<option value="signed">Подписан</option>' +
                '<option value="internal">Внутренний</option>' +
                '<option value="ready">Готов</option>' +
                '</select></label>' +
                '<label class="document-field document-field-wide"><span>Комментарий</span><textarea name="notes" rows="3" placeholder="Что важно знать об этом документе"></textarea></label>' +
            '</div>' +
            '<div class="document-upload-footer">' +
                '<label class="document-visibility-switch"><input type="checkbox" name="is_client_visible" value="1"><span aria-hidden="true"></span><strong>Доступен заказчику</strong><small>Заказчик увидит документ в своём кабинете</small></label>' +
                '<div class="document-upload-actions"><button class="ghost" type="button" data-document-upload-close>Отмена</button><button class="primary" type="submit" data-document-upload-submit><i data-lucide="upload"></i><span>Загрузить документ</span></button></div>' +
            '</div>' +
            '<div class="form-error" data-document-upload-error role="alert"></div>' +
        '</form>';
    }

    function renderDocumentStat(icon, label, value, tone) {
        return '<div class="document-stat ' + (tone || '') + '">' +
            '<span class="document-stat-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(icon) + '"></i></span>' +
            '<span><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(value) + '</strong></span>' +
        '</div>';
    }

    function renderDocumentEmptyState(canUpload, isFiltered) {
        if (isFiltered) {
            return '<div class="documents-empty is-filtered">' +
                '<span class="documents-empty-icon" aria-hidden="true"><i data-lucide="search-x"></i></span>' +
                '<h4>Ничего не найдено</h4><p>Измените запрос или сбросьте фильтры.</p>' +
                '<button class="ghost" type="button" data-document-filter-reset-empty>Сбросить фильтры</button>' +
            '</div>';
        }
        return '<div class="documents-empty">' +
            '<span class="documents-empty-icon" aria-hidden="true"><i data-lucide="folder-open"></i></span>' +
            '<h4>В папке пока пусто</h4><p>' + (canUpload ? 'Добавьте первый документ — он сразу появится в общей библиотеке объекта.' : 'Документы появятся здесь после загрузки командой проекта.') + '</p>' +
            (canUpload ? '<button class="primary" type="button" data-document-empty-add><i data-lucide="plus"></i><span>Добавить документ</span></button>' : '') +
        '</div>';
    }

    function renderDocumentLibrary(docs) {
        var types = [];
        var statuses = [];
        docs.forEach(function (doc) {
            if (doc.doc_type && types.indexOf(doc.doc_type) === -1) types.push(doc.doc_type);
            if (doc.status && statuses.indexOf(doc.status) === -1) statuses.push(doc.status);
        });
        types.sort(function (left, right) { return docTypeLabel(left).localeCompare(docTypeLabel(right), 'ru'); });
        var statusOrder = ['draft', 'reviewed', 'approved', 'signed', 'ready', 'internal'];
        statuses.sort(function (left, right) {
            var leftIndex = statusOrder.indexOf(left);
            var rightIndex = statusOrder.indexOf(right);
            if (leftIndex === -1) leftIndex = statusOrder.length;
            if (rightIndex === -1) rightIndex = statusOrder.length;
            return leftIndex - rightIndex;
        });
        var typeOptions = types.map(function (type) {
            return '<option value="' + escapeHtml(type) + '">' + escapeHtml(docTypeLabel(type)) + '</option>';
        }).join('');
        var statusOptions = statuses.map(function (status) {
            return '<option value="' + escapeHtml(status) + '">' + escapeHtml(statusLabel(status)) + '</option>';
        }).join('');
        var visibilityFilter = hasRole('customer') ? '' :
            '<label class="document-filter"><span>Доступ</span><select data-document-filter-visibility><option value="">Любой</option><option value="client">Заказчику</option><option value="internal">Только команде</option></select></label>';
        return '<section class="document-library" aria-labelledby="document-library-title">' +
            '<div class="document-library-head">' +
                '<div><span class="section-label">Библиотека</span><h3 id="document-library-title">Все документы</h3><p data-document-results>' + escapeHtml(documentCountLabel(docs.length)) + ' · сначала новые</p></div>' +
            '</div>' +
            '<div class="document-toolbar">' +
                '<label class="document-search"><i data-lucide="search" aria-hidden="true"></i><span class="sr-only">Поиск документов</span><input type="search" data-document-search placeholder="Название, файл, этап или автор" autocomplete="off"></label>' +
                '<label class="document-filter"><span>Тип</span><select data-document-filter-type><option value="">Все типы</option>' + typeOptions + '</select></label>' +
                '<label class="document-filter"><span>Статус</span><select data-document-filter-status><option value="">Все статусы</option>' + statusOptions + '</select></label>' +
                visibilityFilter +
                '<button class="document-filter-reset" type="button" data-document-filter-reset hidden><i data-lucide="rotate-ccw"></i><span>Сбросить</span></button>' +
            '</div>' +
            '<div class="documents-list" data-documents-list aria-live="polite">' +
                (docs.length ? docs.map(renderDocumentRow).join('') : renderDocumentEmptyState(canManageDocuments(), false)) +
            '</div>' +
        '</section>';
    }

    function renderDocumentsWorkspace(projectId, docs, executive) {
        var readyStatuses = ['reviewed', 'approved', 'signed', 'ready'];
        var ready = docs.filter(function (doc) { return readyStatuses.indexOf(doc.status) !== -1; }).length;
        var clientVisible = docs.filter(function (doc) { return !!doc.is_client_visible; }).length;
        var drafts = docs.filter(function (doc) { return doc.status === 'draft'; }).length;
        var canUpload = canManageDocuments();
        return '<section class="documents-workspace" data-documents-workspace>' +
            '<header class="documents-hero">' +
                '<div class="documents-hero-main">' +
                    '<span class="documents-hero-icon" aria-hidden="true"><i data-lucide="folder-kanban"></i></span>' +
                    '<div><span class="section-label">Папка объекта</span><h2>Документы</h2><p>' + (hasRole('customer') ? 'Актуальные документы, которые команда открыла для вас.' : 'Договоры, акты, сметы и рабочие файлы в одном понятном месте.') + '</p></div>' +
                '</div>' +
                (canUpload ? '<button class="primary documents-add-button" type="button" data-document-upload-toggle aria-expanded="false"><i data-lucide="plus"></i><span>Добавить документ</span></button>' : '') +
                '<div class="document-stats" data-documents-summary>' +
                    renderDocumentStat('files', 'Всего', String(docs.length)) +
                    renderDocumentStat('badge-check', 'Готовы', String(ready), ready ? 'is-success' : '') +
                    renderDocumentStat('users-round', 'Заказчику', String(clientVisible), clientVisible ? 'is-accent' : '') +
                    renderDocumentStat('file-pen-line', 'Черновики', String(drafts), drafts ? 'is-draft' : '') +
                '</div>' +
            '</header>' +
            renderDocumentUpload(projectId) +
            renderDocumentLibrary(docs) +
            (executive ? renderExecutiveChecklist(executive) : '') +
        '</section>';
    }

    function documentSearchValue(doc) {
        return [
            doc.title,
            doc.original_name,
            doc.notes,
            doc.stage_title,
            doc.uploaded_by_name,
            docTypeLabel(doc.doc_type),
            statusLabel(doc.status)
        ].filter(Boolean).join(' ').toLocaleLowerCase('ru');
    }

    function bindDocumentWorkspace(projectId, docs) {
        var root = qs('[data-documents-workspace]');
        if (!root) return;
        if (typeof documentWorkspaceCleanup === 'function') documentWorkspaceCleanup();
        var canManage = canManageDocuments();
        var overlays = mountDocumentWorkspaceOverlays(projectId, canManage);
        var contextMenu = overlays.menu;
        var editor = overlays.editor;
        var activeDocument = null;
        var activeDocumentRow = null;
        var editorReturnFocus = null;
        var editorSubmitting = false;
        var deletingDocumentId = null;
        var form = root.querySelector('[data-document-upload-form]');
        var toggles = Array.prototype.slice.call(root.querySelectorAll('[data-document-upload-toggle], [data-document-empty-add]'));

        function setUploadOpen(open) {
            if (!form) return;
            form.hidden = !open;
            toggles.forEach(function (button) { button.setAttribute('aria-expanded', open ? 'true' : 'false'); });
            if (open) {
                form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                var fileInput = form.querySelector('[data-document-file]');
                if (fileInput) fileInput.focus({ preventScroll: true });
            }
        }

        toggles.forEach(function (button) {
            button.addEventListener('click', function () { setUploadOpen(!form || form.hidden); });
        });
        Array.prototype.slice.call(root.querySelectorAll('[data-document-upload-close]')).forEach(function (button) {
            button.addEventListener('click', function () { setUploadOpen(false); });
        });
        if (form) {
            form.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') setUploadOpen(false);
            });
        }

        function documentByRow(row) {
            var documentId = Number(row && row.getAttribute('data-document-id') || 0);
            return docs.find(function (doc) { return Number(doc.id) === documentId; }) || null;
        }

        function documentActionError(error, fallback) {
            var errorCode = error && error.payload && error.payload.error;
            return {
                document_in_use: 'Документ связан с финансовой или производственной записью. Сначала отвяжите его от этой записи.',
                document_not_deletable: 'Удалять можно только черновики. Проверенные, утверждённые и подписанные документы остаются в истории объекта.',
                document_classification_in_use: 'Тип и статус связанного документа менять нельзя. Остальные поля можно отредактировать.',
                document_classification_locked: 'Тип проверенного или утверждённого документа уже зафиксирован.',
                document_status_regression: 'Финальный статус документа нельзя вернуть на более ранний этап.',
                document_payload_must_be_object: 'Не удалось прочитать данные формы документа.',
                document_title_required: 'Укажите название документа.',
                document_title_too_long: 'Название документа слишком длинное.',
                document_notes_too_long: 'Комментарий слишком длинный.',
                document_stage_not_found: 'Выбранный этап не относится к этому объекту.',
                bad_document_type: 'Выберите корректный тип документа.',
                bad_document_status: 'Выберите корректный статус документа.',
                bad_document_visibility: 'Не удалось сохранить настройку доступа.',
                immutable_document_field: 'Файл и системные реквизиты документа нельзя изменить в этой форме.',
                forbidden: 'У вас нет прав на управление документами.',
                document_forbidden: 'Нет доступа к этому документу.',
                document_not_found: 'Документ уже удалён или недоступен.'
            }[errorCode] || appErrorMessage(error, fallback);
        }

        function closeContextMenu(restoreFocus) {
            if (!contextMenu) return;
            var focusWasInsideMenu = contextMenu.contains(document.activeElement);
            contextMenu.hidden = true;
            contextMenu.style.left = '';
            contextMenu.style.top = '';
            if (activeDocumentRow) activeDocumentRow.classList.remove('is-context-active');
            if ((restoreFocus || focusWasInsideMenu) && activeDocumentRow && document.contains(activeDocumentRow)) activeDocumentRow.focus();
            activeDocument = null;
            activeDocumentRow = null;
        }

        function placeContextMenu(x, y) {
            contextMenu.hidden = false;
            contextMenu.style.visibility = 'hidden';
            contextMenu.style.left = '0px';
            contextMenu.style.top = '0px';
            var inset = 8;
            var width = contextMenu.offsetWidth || 220;
            var height = contextMenu.offsetHeight || 180;
            var left = Math.max(inset, Math.min(Number(x) || inset, window.innerWidth - width - inset));
            var top = Math.max(inset, Math.min(Number(y) || inset, window.innerHeight - height - inset));
            contextMenu.style.left = left + 'px';
            contextMenu.style.top = top + 'px';
            contextMenu.style.visibility = '';
        }

        function openContextMenu(row, x, y, focusMenu) {
            var doc = documentByRow(row);
            if (!doc || (!doc.storage_path && !canManage)) return false;
            closeContextMenu(false);
            activeDocument = doc;
            activeDocumentRow = row;
            row.classList.add('is-context-active');
            var openAction = contextMenu.querySelector('[data-document-context-action="open"]');
            var downloadAction = contextMenu.querySelector('[data-document-context-action="download"]');
            var deleteAction = contextMenu.querySelector('[data-document-context-action="delete"]');
            if (openAction) openAction.hidden = !doc.storage_path;
            if (downloadAction) downloadAction.hidden = !doc.storage_path;
            if (deleteAction) deleteAction.hidden = String(doc.status || '').toLowerCase() !== 'draft' || deletingDocumentId === Number(doc.id);
            contextMenu.setAttribute('aria-label', 'Действия с документом ' + (doc.title || doc.original_name || 'без названия'));
            placeContextMenu(x, y);
            if (focusMenu) {
                var firstAction = contextMenu.querySelector('button:not([hidden])');
                if (firstAction) firstAction.focus({ preventScroll: true });
            }
            return true;
        }

        function ensureSelectValue(select, value, label) {
            value = value == null ? '' : String(value);
            if (value && !Array.prototype.some.call(select.options, function (option) { return option.value === value; })) {
                var option = document.createElement('option');
                option.value = value;
                option.textContent = label || value;
                select.appendChild(option);
            }
            select.value = value;
        }

        function closeDocumentEditor(restoreFocus) {
            if (!editor || editorSubmitting) return;
            editor.hidden = true;
            document.body.classList.remove('document-editor-open');
            var error = editor.querySelector('[data-document-editor-error]');
            if (error) { error.hidden = true; error.textContent = ''; }
            activeDocument = null;
            if (restoreFocus && editorReturnFocus && document.contains(editorReturnFocus)) editorReturnFocus.focus();
            editorReturnFocus = null;
        }

        function openDocumentEditor(doc, row) {
            if (!editor || !doc || !canManage) return;
            closeContextMenu(false);
            activeDocument = doc;
            editorReturnFocus = row || document.activeElement;
            var editForm = editor.querySelector('[data-document-editor-form]');
            editForm.elements.title.value = doc.title || doc.original_name || '';
            ensureSelectValue(editForm.elements.doc_type, doc.doc_type || 'file', docTypeLabel(doc.doc_type));
            ensureSelectValue(editForm.elements.status, doc.status || 'draft', statusLabel(doc.status));
            var currentStatus = String(doc.status || 'draft').toLowerCase();
            var classificationProtected = documentProtectedStatuses.indexOf(currentStatus) !== -1;
            editForm.elements.doc_type.disabled = classificationProtected;
            Array.prototype.forEach.call(editForm.elements.status.options, function (option) {
                var nextRank = documentStatusRank[option.value];
                option.disabled = classificationProtected && (nextRank == null || nextRank < documentStatusRank[currentStatus]);
            });
            var currentStages = (state.stagesByProject && state.stagesByProject[projectId]) ? state.stagesByProject[projectId] : [];
            editForm.elements.stage_id.innerHTML = '<option value="">Без этапа</option>' + currentStages.filter(function (stage) {
                return stage.stage_kind !== 'section';
            }).map(function (stage) {
                return '<option value="' + escapeHtml(stage.id) + '">' + escapeHtml(stage.title || ('Этап #' + stage.id)) + '</option>';
            }).join('');
            ensureSelectValue(editForm.elements.stage_id, doc.stage_id || '', doc.stage_title || (doc.stage_id ? ('Этап #' + doc.stage_id) : ''));
            editForm.elements.notes.value = doc.notes || '';
            editForm.elements.is_client_visible.checked = !!doc.is_client_visible;
            var fileMeta = editor.querySelector('[data-document-editor-file]');
            if (fileMeta) fileMeta.textContent = doc.original_name ? ('Файл: ' + doc.original_name) : 'Карточка без загруженного файла';
            var error = editor.querySelector('[data-document-editor-error]');
            if (error) { error.hidden = true; error.textContent = ''; }
            editor.hidden = false;
            document.body.classList.add('document-editor-open');
            setTimeout(function () {
                editForm.elements.title.focus({ preventScroll: true });
                editForm.elements.title.select();
            }, 0);
        }

        function openDocumentUrl(url) {
            if (!url) return;
            var opened = window.open(url, '_blank', 'noopener,noreferrer');
            if (opened) opened.opener = null;
        }

        function focusDocumentWorkspaceAfterRefresh(documentId) {
            requestAnimationFrame(function () {
                var refreshedRoot = qs('[data-documents-workspace]');
                if (!refreshedRoot) return;
                var target = documentId
                    ? refreshedRoot.querySelector('[data-document-id="' + Number(documentId) + '"]')
                    : null;
                if (!target) target = refreshedRoot.querySelector('h2, [data-document-search]');
                if (!target) return;
                if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            });
        }

        function deleteDocument(doc, row) {
            if (!doc || !canManage) return;
            if (String(doc.status || '').toLowerCase() !== 'draft') {
                showAppNotice(documentActionError({ payload: { error: 'document_not_deletable' } }, ''), 'warn');
                return;
            }
            if (deletingDocumentId !== null) {
                showAppNotice('Дождитесь завершения текущего удаления документа.', 'warn');
                return;
            }
            var title = doc.title || doc.original_name || 'Документ без названия';
            if (!window.confirm('Удалить документ «' + title + '»? Файл и карточка документа будут удалены без возможности восстановления.')) {
                if (row && document.contains(row)) row.focus();
                return;
            }
            deletingDocumentId = Number(doc.id);
            if (row) {
                row.classList.add('is-deleting');
                row.setAttribute('aria-busy', 'true');
            }
            api('/api/documents/' + doc.id, { method: 'DELETE' }).then(function (result) {
                if (result && result.file_cleanup_failed) {
                    showAppNotice('Карточка удалена, но файл не удалось очистить автоматически. Ошибка записана в журнал.', 'warn');
                } else {
                    showAppNotice('Документ удалён.', 'success');
                }
                refreshProjectOverview(projectId);
                return loadDocuments(projectId).then(function () { focusDocumentWorkspaceAfterRefresh(null); });
            }).catch(function (error) {
                showAppNotice(documentActionError(error, 'Не удалось удалить документ.'), 'error');
            }).finally(function () {
                deletingDocumentId = null;
                if (row && document.contains(row)) {
                    row.classList.remove('is-deleting');
                    row.removeAttribute('aria-busy');
                }
            });
        }

        function onRootContextMenu(event) {
            var row = event.target && event.target.closest ? event.target.closest('[data-document-card]') : null;
            if (!row || !root.contains(row)) return;
            if (!openContextMenu(row, event.clientX, event.clientY, true)) return;
            event.preventDefault();
        }

        function onRootClick(event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-document-menu-button]') : null;
            if (!button || !root.contains(button)) return;
            var row = button.closest('[data-document-card]');
            if (!row) return;
            event.preventDefault();
            var rect = button.getBoundingClientRect();
            openContextMenu(row, rect.right, rect.bottom + 4, true);
        }

        function onRootKeydown(event) {
            var isContextKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
            if (!isContextKey) return;
            var row = event.target && event.target.closest ? event.target.closest('[data-document-card]') : null;
            if (!row || !root.contains(row)) return;
            var rect = row.getBoundingClientRect();
            if (!openContextMenu(row, rect.left + Math.min(rect.width, 260), rect.top + Math.min(rect.height, 48), true)) return;
            event.preventDefault();
        }

        function onOutsideClick(event) {
            if (contextMenu.hidden || contextMenu.contains(event.target)) return;
            if (event.target && event.target.closest && event.target.closest('[data-document-menu-button]')) return;
            closeContextMenu(false);
        }

        function onDocumentKeydown(event) {
            if (event.key !== 'Escape' || !contextMenu || contextMenu.hidden) return;
            event.preventDefault();
            closeContextMenu(true);
        }

        function onViewportChange() {
            closeContextMenu(false);
        }

        root.addEventListener('contextmenu', onRootContextMenu);
        root.addEventListener('click', onRootClick);
        root.addEventListener('keydown', onRootKeydown);
        document.addEventListener('click', onOutsideClick);
        document.addEventListener('keydown', onDocumentKeydown);
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);

        contextMenu.addEventListener('click', function (event) {
            var actionButton = event.target && event.target.closest ? event.target.closest('[data-document-context-action]') : null;
            if (!actionButton || !activeDocument) return;
            var action = actionButton.getAttribute('data-document-context-action');
            var doc = activeDocument;
            var row = activeDocumentRow;
            if (action !== 'edit') closeContextMenu(true);
            if (action === 'open') openDocumentUrl(doc.view_url || doc.download_url);
            else if (action === 'download') openDocumentUrl(doc.download_url);
            else if (action === 'edit') openDocumentEditor(doc, row);
            else if (action === 'delete') deleteDocument(doc, row);
        });

        contextMenu.addEventListener('keydown', function (event) {
            if (event.key === 'Tab') {
                closeContextMenu(false);
                return;
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) === -1) return;
            var actions = Array.prototype.slice.call(contextMenu.querySelectorAll('button:not([hidden]):not([disabled])'));
            if (!actions.length) return;
            event.preventDefault();
            var currentIndex = actions.indexOf(document.activeElement);
            var nextIndex = event.key === 'Home' ? 0
                : (event.key === 'End' ? actions.length - 1
                    : (event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1));
            if (nextIndex < 0) nextIndex = actions.length - 1;
            if (nextIndex >= actions.length) nextIndex = 0;
            actions[nextIndex].focus();
        });

        if (editor) {
            Array.prototype.slice.call(editor.querySelectorAll('[data-document-editor-close]')).forEach(function (button) {
                button.addEventListener('click', function () { closeDocumentEditor(true); });
            });
            editor.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeDocumentEditor(true);
                    return;
                }
                if (event.key !== 'Tab') return;
                var focusable = Array.prototype.slice.call(editor.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')).filter(function (node) { return !node.hidden && node.tabIndex >= 0; });
                if (!focusable.length) return;
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            });
            var editForm = editor.querySelector('[data-document-editor-form]');
            editForm.addEventListener('submit', function (event) {
                event.preventDefault();
                if (!activeDocument || editorSubmitting) return;
                var title = editForm.elements.title.value.trim();
                var error = editor.querySelector('[data-document-editor-error]');
                if (!title) {
                    error.textContent = 'Укажите название документа.';
                    error.hidden = false;
                    editForm.elements.title.focus();
                    return;
                }
                var saveButton = editor.querySelector('[data-document-editor-save]');
                var documentId = activeDocument.id;
                editorSubmitting = true;
                saveButton.disabled = true;
                saveButton.setAttribute('aria-busy', 'true');
                error.hidden = true;
                api('/api/documents/' + documentId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: title,
                        doc_type: editForm.elements.doc_type.value,
                        status: editForm.elements.status.value,
                        stage_id: editForm.elements.stage_id.value ? Number(editForm.elements.stage_id.value) : null,
                        notes: editForm.elements.notes.value.trim(),
                        is_client_visible: editForm.elements.is_client_visible.checked
                    })
                }).then(function () {
                    editorSubmitting = false;
                    closeDocumentEditor(true);
                    showAppNotice('Документ обновлён.', 'success');
                    refreshProjectOverview(projectId);
                    return loadDocuments(projectId).then(function () { focusDocumentWorkspaceAfterRefresh(documentId); });
                }).catch(function (requestError) {
                    error.textContent = documentActionError(requestError, 'Не удалось сохранить документ.');
                    error.hidden = false;
                }).finally(function () {
                    editorSubmitting = false;
                    saveButton.disabled = false;
                    saveButton.removeAttribute('aria-busy');
                });
            });
        }

        documentWorkspaceCleanup = function () {
            root.removeEventListener('contextmenu', onRootContextMenu);
            root.removeEventListener('click', onRootClick);
            root.removeEventListener('keydown', onRootKeydown);
            document.removeEventListener('click', onOutsideClick);
            document.removeEventListener('keydown', onDocumentKeydown);
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('scroll', onViewportChange, true);
            document.body.classList.remove('document-editor-open');
            if (contextMenu && contextMenu.parentNode) contextMenu.parentNode.removeChild(contextMenu);
            if (editor && editor.parentNode) editor.parentNode.removeChild(editor);
            documentWorkspaceCleanup = null;
        };

        var list = root.querySelector('[data-documents-list]');
        var search = root.querySelector('[data-document-search]');
        var typeFilter = root.querySelector('[data-document-filter-type]');
        var statusFilter = root.querySelector('[data-document-filter-status]');
        var visibilityFilter = root.querySelector('[data-document-filter-visibility]');
        var resultText = root.querySelector('[data-document-results]');
        var resetButton = root.querySelector('[data-document-filter-reset]');
        if (!list || !search || !typeFilter || !statusFilter) return;

        function resetFilters() {
            search.value = '';
            typeFilter.value = '';
            statusFilter.value = '';
            if (visibilityFilter) visibilityFilter.value = '';
            applyFilters();
            search.focus();
        }

        function applyFilters() {
            var query = search.value.trim().toLocaleLowerCase('ru');
            var type = typeFilter.value;
            var status = statusFilter.value;
            var visibility = visibilityFilter ? visibilityFilter.value : '';
            var filtered = docs.filter(function (doc) {
                if (query && documentSearchValue(doc).indexOf(query) === -1) return false;
                if (type && doc.doc_type !== type) return false;
                if (status && doc.status !== status) return false;
                if (visibility === 'client' && !doc.is_client_visible) return false;
                if (visibility === 'internal' && doc.is_client_visible) return false;
                return true;
            });
            var filtersActive = !!(query || type || status || visibility);
            safeReplaceChildren(list, filtered.length ? filtered.map(renderDocumentRow).join('') : renderDocumentEmptyState(canManageDocuments(), filtersActive));
            if (resultText) resultText.textContent = filtersActive
                ? (documentCountLabel(filtered.length) + ' из ' + docs.length)
                : (documentCountLabel(docs.length) + ' · сначала новые');
            if (resetButton) resetButton.hidden = !filtersActive;
            var emptyReset = list.querySelector('[data-document-filter-reset-empty]');
            if (emptyReset) emptyReset.addEventListener('click', resetFilters);
            var emptyAdd = list.querySelector('[data-document-empty-add]');
            if (emptyAdd) emptyAdd.addEventListener('click', function () { setUploadOpen(true); });
            refreshLucideIcons(list);
        }

        search.addEventListener('input', applyFilters);
        typeFilter.addEventListener('change', applyFilters);
        statusFilter.addEventListener('change', applyFilters);
        if (visibilityFilter) visibilityFilter.addEventListener('change', applyFilters);
        if (resetButton) resetButton.addEventListener('click', resetFilters);
    }

    function renderExecutiveSummary(summary) {
        if (!summary) return '';
        return '<section class="executive-summary">' +
            '<div class="executive-stat"><span>Этапов</span><strong>' + escapeHtml(summary.stages) + '</strong></div>' +
            '<div class="executive-stat"><span>Обязательных</span><strong>' + escapeHtml(summary.required) + '</strong></div>' +
            '<div class="executive-stat"><span>Готово</span><strong>' + escapeHtml(summary.ready) + '</strong></div>' +
            '<div class="executive-stat executive-stat-' + (summary.missing ? 'warn' : 'ok') + '"><span>Осталось</span><strong>' + escapeHtml(summary.missing) + '</strong></div>' +
        '</section>';
    }

    function renderExecutiveChecklist(data) {
        if (!data || !Array.isArray(data.checklist) || !data.checklist.length) {
            return '<details class="executive-docs-block">' +
                '<summary><span class="executive-summary-icon"><i data-lucide="clipboard-list"></i></span><span class="executive-summary-copy"><strong>Исполнительная документация</strong><small>Для текущих этапов пока нет обязательных шаблонов</small></span><i class="executive-summary-chevron" data-lucide="chevron-down"></i></summary>' +
                '<div class="executive-docs-body"><div class="documents-empty is-compact"><span class="documents-empty-icon"><i data-lucide="list-checks"></i></span><h4>Контур пока не сформирован</h4><p>Подсказки появятся после добавления этапов работ.</p></div></div>' +
            '</details>';
        }
        var summary = data.summary || {};
        var completed = Number(summary.required || 0) > 0 && Number(summary.missing || 0) === 0;
        return '<details class="executive-docs-block">' +
            '<summary>' +
                '<span class="executive-summary-icon"><i data-lucide="clipboard-check"></i></span>' +
                '<span class="executive-summary-copy"><strong>Исполнительная документация</strong><small>Акты и техрешения по этапам · ' + escapeHtml(completed ? 'комплект собран' : ('осталось ' + (summary.missing || 0))) + '</small></span>' +
                '<span class="executive-summary-progress ' + (completed ? 'is-complete' : '') + '">' + escapeHtml(summary.ready || 0) + ' / ' + escapeHtml(summary.required || 0) + '</span>' +
                '<i class="executive-summary-chevron" data-lucide="chevron-down"></i>' +
            '</summary>' +
            '<div class="executive-docs-body">' +
                renderExecutiveSummary(summary) +
                '<div class="executive-stage-list">' + data.checklist.map(function (stage) {
                return '<article class="executive-stage">' +
                    '<div class="executive-stage-head">' +
                        '<div class="executive-stage-title"><span class="executive-stage-icon"><i data-lucide="layers-3"></i></span><div><b>' + escapeHtml(stage.stageTitle) + '</b><small>' + escapeHtml(statusLabel(stage.statusCode)) + (stage.plannedEnd ? ' · план до ' + escapeHtml(formatDisplayDate(stage.plannedEnd)) : '') + '</small></div></div>' +
                        '<span class="executive-stage-progress">' + escapeHtml(stage.progress) + '%</span>' +
                    '</div>' +
                    '<div class="executive-progress-track" aria-label="Готовность этапа ' + escapeHtml(stage.progress) + '%"><span style="width:' + Math.max(0, Math.min(100, Number(stage.progress) || 0)) + '%"></span></div>' +
                    '<div class="executive-item-list">' + stage.items.map(function (item) {
                        var stateClass = item.isReady ? 'executive-item-ready' : (item.optional ? 'executive-item-optional' : 'executive-item-missing');
                        var hint = item.isReady
                            ? ('готово: ' + item.readyCount)
                            : (item.existingCount ? ('черновиков: ' + item.existingCount) : (item.optional ? 'опционально' : 'нужно создать'));
                        var button = '';
                        if (data.canManage) {
                            button = '<button class="ghost compact" type="button" data-executive-create data-stage-id="' + stage.stageId + '" data-template-code="' + escapeHtml(item.code) + '"><i data-lucide="file-plus-2"></i><span>Создать черновик</span></button>';
                        }
                        return '<div class="executive-item ' + stateClass + '">' +
                            '<span class="executive-item-state"><i data-lucide="' + (item.isReady ? 'check' : (item.optional ? 'minus' : 'circle')) + '"></i></span>' +
                            '<div class="executive-item-copy"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(hint) + '</small></div>' +
                            '<div class="executive-item-side">' +
                                button +
                            '</div>' +
                        '</div>';
                    }).join('') + '</div>' +
                '</article>';
                }).join('') + '</div>' +
            '</div>' +
        '</details>';
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
        return Promise.all([docsRequest, executiveRequest]).then(function (result) {
            if (!isCurrentProject(projectId, loadingToken)) return false;
            var data = result[0] || {};
            var executive = result[1];
            var docs = Array.isArray(data.documents) ? data.documents : [];
            var panel = qs('[data-panel="documents"]');
            if (!panel) return false;
            safeReplaceChildren(panel, renderDocumentsWorkspace(projectId, docs, executive));
            bindDocumentWorkspace(projectId, docs);
            bindDocumentUpload(projectId);
            bindExecutiveDocActions(projectId);
            refreshLucideIcons(panel);
            return true;
        }).catch(function () {
            if (!isCurrentProject(projectId, loadingToken)) return false;
            if (typeof documentWorkspaceCleanup === 'function') documentWorkspaceCleanup();
            safeReplaceChildren(qs('[data-panel="documents"]'), '<div class="documents-load-error"><span><i data-lucide="folder-x"></i></span><div><h3>Документы не загрузились</h3><p>Проверьте соединение и откройте раздел ещё раз.</p></div><button class="ghost" type="button" data-documents-retry>Повторить</button></div>');
            var retry = qs('[data-documents-retry]');
            if (retry) retry.addEventListener('click', function () { loadDocuments(projectId); });
            refreshLucideIcons(qs('[data-panel="documents"]'));
            return false;
        });
    }

    function logsMonthStartIso(isoDate) {
        var base = isoDate || APP_TODAY;
        return String(base).slice(0, 7) + '-01';
    }

    function formatRuMonthYear(monthIso) {
        var date = new Date(String(monthIso || logsMonthStartIso(APP_TODAY)).slice(0, 10) + 'T00:00:00Z');
        if (Number.isNaN(date.getTime())) return String(monthIso || '');
        return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
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
            clauseText: clauseText,
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
            reportUnit: reportExplicitQuantityUnit(clauseText),
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

    function reportExplicitQuantityUnit(clauseText) {
        var match = String(clauseText || '').match(/(?:^|[\s(])\d+(?:[\.,]\d+)?\s*(пог\.?\s*м|кв\.?\s*м|куб\.?\s*м|м(?:2|3|²|³)?|шт\.?|штук[аи]?|ед\.?|кг|т|л|компл(?:ект)?(?:ов|а)?|упак(?:овок|овки|овка)?)(?=$|[\s,.;!?)])/i);
        if (!match) return '';
        var raw = String(match[1] || '').toLowerCase().trim();
        var compact = raw.replace(/[.\s]+/g, '');
        if (compact === 'м2' || compact === 'м²' || compact === 'квм') return 'м2';
        if (compact === 'м3' || compact === 'м³' || compact === 'кубм') return 'м3';
        if (compact === 'погм') return 'пог. м';
        if (compact === 'м') return 'м';
        if (/^шт|^штук/.test(compact)) return 'шт';
        if (/^ед/.test(compact)) return 'ед.';
        if (/^компл/.test(compact)) return 'компл.';
        if (/^упак/.test(compact)) return 'упак.';
        return compact;
    }

    function reportSafeQuantityUnit(value) {
        var raw = String(value || '').trim();
        var normalized = normalizeReportText(raw);
        if (!normalized || /^(?:n a|na|none|null|undefined|unknown|нет|без единицы|не указано)$/.test(normalized)) return '';
        return raw;
    }

    function reportNormalizeManualQuantityUnit(value) {
        var raw = String(value || '').trim();
        if (!raw) return '';
        return reportExplicitQuantityUnit('1 ' + raw) || '';
    }

    function reportEntryQuantityUnit(entry) {
        entry = entry || {};
        var item = entry.item || entry;
        var plan = quantityPlanInfo(item || {});
        var rawCatalogUnit = plan.rawUnit || (item && item.unit) || '';
        if (reportSafeQuantityUnit(rawCatalogUnit)) {
            return reportSafeQuantityUnit(plan.unit) || reportSafeQuantityUnit(rawCatalogUnit) || 'ед.';
        }
        return reportSafeQuantityUnit(entry.reportUnit) || 'ед.';
    }

    function reportEntryPlanTotal(entry) {
        var item = entry && entry.item || entry || {};
        var plan = quantityPlanInfo(item);
        var total = Number(plan && plan.totalQty);
        if (!isFinite(total) || total <= 0) {
            total = Number(item.plannedQty != null ? item.plannedQty : item.planned_qty || 0);
        }
        return isFinite(total) && total > 0 ? total : 0;
    }

    function reportWorkNarrativeQuantity(entry) {
        entry = entry || {};
        var unit = reportEntryQuantityUnit(entry);
        var planTotal = reportEntryPlanTotal(entry);
        var qty = Math.max(0, Number(entry.actualQty || 0));
        var quantityLabel = String(entry.quantityLabel || '').trim();
        if (entry.quantityMode === 'target_percent' && Number(entry.quantityValue) >= 0) {
            var percent = finalSectionSummaryNumber(entry.quantityValue) + '%';
            if (qty > 0 && planTotal > 0) {
                return percent + ' (' + finalSectionSummaryNumber(qty) + ' ' + unit + ' из ' + finalSectionSummaryNumber(planTotal) + ' ' + unit + ')';
            }
            return percent;
        }
        if (entry.quantityMode === 'delta_qty' && qty > 0 && isFinite(Number(entry.baseActualQty))) {
            var resultQty = Math.max(0, Number(entry.resultActualQty));
            if (!isFinite(resultQty)) resultQty = Math.max(0, Number(entry.baseActualQty || 0)) + qty;
            var shiftAmount = quantityLabel || (finalSectionSummaryNumber(qty) + ' ' + unit);
            if (planTotal > 0) {
                var remainingQty = Math.max(planTotal - resultQty, 0);
                return shiftAmount + ' за смену (всего ' + finalSectionSummaryNumber(resultQty) + ' из ' + finalSectionSummaryNumber(planTotal) + ' ' + unit + (remainingQty > 0 ? ', осталось ' + finalSectionSummaryNumber(remainingQty) + ' ' + unit : ', план выполнен') + ')';
            }
            return shiftAmount + ' за смену';
        }
        if (qty > 0) {
            var amount = quantityLabel || (finalSectionSummaryNumber(qty) + ' ' + unit);
            if (planTotal > 0 && qty < planTotal) return amount + ' из ' + finalSectionSummaryNumber(planTotal) + ' ' + unit;
            return amount;
        }
        if (entry.done) {
            return planTotal > 0 ? 'полностью (' + finalSectionSummaryNumber(planTotal) + ' ' + unit + ')' : 'полностью';
        }
        return quantityLabel;
    }

    function reportMaterialNarrativeQuantity(entry, actionKind, deltaQty) {
        entry = entry || {};
        var item = entry.item || {};
        var unit = reportEntryQuantityUnit(entry);
        var planTotal = reportEntryPlanTotal(entry);
        var delta = Math.max(0, Number(deltaQty || 0));
        var baseQty = 0;
        if (actionKind === 'purchase') {
            baseQty = Math.max(Number(item.purchasedQty || item.purchased_qty || 0), Number(item.receivedQty || item.received_qty || 0));
        } else if (actionKind === 'receipt') {
            baseQty = Number(item.receivedQty || item.received_qty || 0);
        } else if (actionKind === 'use') {
            baseQty = Number(item.usedQty || item.used_qty || 0) + Number(item.writeoffQty || item.writeoff_qty || 0);
        }
        baseQty = Math.max(0, isFinite(baseQty) ? baseQty : 0);
        var resultQty = planTotal > 0 ? Math.min(planTotal, baseQty + delta) : baseQty + delta;
        var text = finalSectionSummaryNumber(delta) + ' ' + unit;
        if (planTotal <= 0) return text;
        if (baseQty > 0) {
            text += ' за смену (всего ' + finalSectionSummaryNumber(resultQty) + ' из ' + finalSectionSummaryNumber(planTotal) + ' ' + unit;
        } else {
            text += ' из ' + finalSectionSummaryNumber(planTotal) + ' ' + unit;
            if (resultQty < planTotal) text += ' (осталось ' + finalSectionSummaryNumber(planTotal - resultQty) + ' ' + unit + ')';
            return text;
        }
        if (resultQty < planTotal) text += ', осталось ' + finalSectionSummaryNumber(planTotal - resultQty) + ' ' + unit;
        return text + ')';
    }

    function reportSentence(value) {
        var text = reportTrimSentence(value);
        if (!text) return '';
        text = text.charAt(0).toUpperCase() + text.slice(1);
        return /[.!?]$/.test(text) ? text : text + '.';
    }

    function reportPhraseParts(value) {
        return String(value || '')
            .split(/\n+|[!?;]+|\.(?!\d)/)
            .map(reportTrimSentence)
            .filter(Boolean);
    }

    function createReportPhraseDeduper(baseText) {
        var normalizedPhrases = reportPhraseParts(baseText).map(normalizeReportText).filter(Boolean);
        return function (value) {
            var unique = [];
            reportPhraseParts(value).forEach(function (phrase) {
                var normalizedPhrase = normalizeReportText(phrase);
                if (!normalizedPhrase) return;
                if (normalizedPhrases.some(function (knownPhrase) {
                    return (' ' + knownPhrase + ' ').indexOf(' ' + normalizedPhrase + ' ') !== -1;
                })) return;
                unique.push(phrase);
                normalizedPhrases.push(normalizedPhrase);
            });
            return unique;
        };
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
        if (generatedParts && generatedParts.length) return generatedParts.join('\n');
        var clauses = reportTextClauses(rawText);
        var sentences = clauses.map(reportNarrativeSentence).filter(Boolean);
        return sentences.length ? sentences.join('\n') : reportSentence(rawText);
    }

    function reportMaterialMatchIsConcrete(entry) {
        return !!entry
            && !entry.ambiguous
            && (
                Number(entry.purchasedQty || 0) > 0
                || Number(entry.receivedQty || 0) > 0
                || Number(entry.usedQty || 0) > 0
            );
    }

    function reportWorkMatchIsConcrete(entry) {
        return !!entry && !entry.ambiguous && !!(entry.done || entry.partial);
    }

    function reportMatchConsumesClause(entry, concreteMatcher) {
        return !!entry
            && !entry.ambiguous
            && (
                (typeof concreteMatcher === 'function' && concreteMatcher(entry))
                || !!entry.selectedManually
                || !!entry.actionEligible
                || !!entry.semanticMatch
            );
    }

    function reportMatchSourceText(entry) {
        var clauses = Array.isArray(entry && entry.consumedClauseTexts) && entry.consumedClauseTexts.length
            ? entry.consumedClauseTexts
            : (Array.isArray(entry && entry.clauseTexts) && entry.clauseTexts.length
                ? entry.clauseTexts
                : [entry && entry.clauseText]);
        return clauses.map(reportTrimSentence).filter(Boolean).join('; ');
    }

    function projectReportClauseKeysFromEntries(entries, includeAllClauses) {
        var keys = {};
        (entries || []).forEach(function (entry) {
            var clauses = !includeAllClauses && Array.isArray(entry && entry.consumedClauseTexts)
                ? entry.consumedClauseTexts
                : (Array.isArray(entry && entry.clauseTexts)
                    ? entry.clauseTexts
                    : [entry && entry.clauseText]);
            clauses.forEach(function (value) {
                var clause = String(value || '').trim();
                if (clause) keys[normalizeReportText(clause)] = true;
            });
        });
        return keys;
    }

    function projectReportMatchedClauseKeys(workMatches, materialMatches) {
        return projectReportClauseKeysFromEntries(
            (workMatches || []).filter(function (entry) {
                return reportMatchConsumesClause(entry, reportWorkMatchIsConcrete);
            }).concat((materialMatches || []).filter(function (entry) {
                return reportMatchConsumesClause(entry, reportMaterialMatchIsConcrete);
            }))
        );
    }

    function projectReportUnmatchedClauses(text, workMatches, materialMatches) {
        var matched = projectReportMatchedClauseKeys(workMatches, materialMatches);
        return reportTextClauses(text).filter(function (clause) {
            return !matched[normalizeReportText(clause)];
        });
    }

    function projectReportPreviewAdditionalClauses(text, workMatches, materialMatches) {
        var semanticMatches = (workMatches || []).filter(function (entry) {
            return reportMatchConsumesClause(entry, reportWorkMatchIsConcrete);
        }).concat((materialMatches || []).filter(function (entry) {
            return reportMatchConsumesClause(entry, reportMaterialMatchIsConcrete);
        }));
        var ambiguousMatches = (workMatches || []).filter(function (entry) {
            return !!(entry && entry.ambiguous);
        }).concat((materialMatches || []).filter(function (entry) {
            return !!(entry && entry.ambiguous);
        }));
        var claimed = projectReportClauseKeysFromEntries(semanticMatches);
        var ambiguousClaimed = projectReportClauseKeysFromEntries(ambiguousMatches, true);
        Object.keys(ambiguousClaimed).forEach(function (key) { claimed[key] = true; });
        return reportTextClauses(text).filter(function (clause) {
            return !claimed[normalizeReportText(clause)];
        });
    }

    function pruneProjectReportManualSelections(manualSelections, text) {
        manualSelections = manualSelections || {};
        var currentClauses = {};
        reportTextClauses(text).forEach(function (clause) {
            var key = normalizeReportText(clause);
            if (key) currentClauses[key] = true;
        });
        Object.keys(manualSelections).forEach(function (key) {
            var selected = manualSelections[key];
            var clauseKey = normalizeReportText(selected && selected.clauseText || '');
            if (!clauseKey || !currentClauses[clauseKey]) delete manualSelections[key];
        });
        return manualSelections;
    }

    function projectReportClauseCategory(clause) {
        var normalized = normalizeReportText(clause);
        if (/(^|\s)(завтра|далее|следующ|планир|будем|предстоит)(\s|$)/.test(normalized)) return 'next';
        if (/(ждем|ждём|ожида|нет\s|меша|задерж|проблем|блок|не можем|не\s+согласован|согласовани[ея])/.test(normalized)) return 'blocker';
        if (reportHasOrderIntent(normalized)) return 'order';
        if (reportHasPurchaseIntent(normalized)) return 'purchase';
        if (reportHasReceiptIntent(normalized)) return 'delivery';
        if (/(сдел|выполн|смонт|монт|установ|улож|демонт|покрас|залил|подключ|почин|дополн)/.test(normalized)) return 'work';
        return 'note';
    }

    function projectReportAdditionalParts(clauses, hasRecognizedWork) {
        var groups = { work: [], order: [], purchase: [], delivery: [], blocker: [], next: [], note: [] };
        clauses.forEach(function (clause) {
            groups[projectReportClauseCategory(clause)].push(reportTrimSentence(clause));
        });
        var labels = {
            work: hasRecognizedWork ? 'Дополнительно выполнено' : 'Выполнены работы',
            order: 'Заказано',
            purchase: 'Закуплено',
            delivery: 'Доставлено на объект',
            blocker: 'Проблемы и ограничения',
            next: 'Следующий шаг',
            note: 'Дополнительно зафиксировано'
        };
        return ['work', 'order', 'purchase', 'delivery', 'blocker', 'next', 'note'].map(function (kind) {
            if (!groups[kind].length) return '';
            return reportSentence(labels[kind] + ': ' + groups[kind].join('; '));
        }).filter(Boolean);
    }

    function buildProjectReportTextFromMatches(text, workMatches, materialMatches) {
        workMatches = Array.isArray(workMatches) ? workMatches : [];
        materialMatches = Array.isArray(materialMatches) ? materialMatches : [];
        var generatedParts = [];
        var completedWorks = workMatches.filter(function (entry) { return reportWorkMatchIsConcrete(entry) && entry.done; });
        var partialWorks = workMatches.filter(function (entry) { return reportWorkMatchIsConcrete(entry) && entry.partial; });
        var notedWorks = workMatches.filter(function (entry) {
            return reportMatchConsumesClause(entry, reportWorkMatchIsConcrete) && !reportWorkMatchIsConcrete(entry);
        });
        var purchasedMaterials = materialMatches.filter(function (entry) { return reportMaterialMatchIsConcrete(entry) && entry.purchasedQty > 0; });
        var receivedMaterials = materialMatches.filter(function (entry) { return reportMaterialMatchIsConcrete(entry) && entry.receivedQty > 0; });
        var usedMaterials = materialMatches.filter(function (entry) { return reportMaterialMatchIsConcrete(entry) && entry.usedQty > 0; });
        var notedMaterials = materialMatches.filter(function (entry) {
            return reportMatchConsumesClause(entry, reportMaterialMatchIsConcrete) && !reportMaterialMatchIsConcrete(entry);
        });
        if (completedWorks.length) {
            generatedParts.push('\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b \u0440\u0430\u0431\u043e\u0442\u044b: ' + completedWorks.map(function (entry) {
                var quantity = reportWorkNarrativeQuantity(entry);
                return entry.item.title + (quantity ? ' — ' + quantity : '');
            }).join('; ') + '.');
        }
        if (partialWorks.length) {
            generatedParts.push('\u0427\u0430\u0441\u0442\u0438\u0447\u043d\u043e \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b: ' + partialWorks.map(function (entry) {
                var quantity = reportWorkNarrativeQuantity(entry);
                return entry.item.title + (quantity ? ' — ' + quantity : '');
            }).join('; ') + '.');
        }
        if (notedWorks.length) {
            generatedParts.push('\u041f\u043e \u0440\u0430\u0431\u043e\u0442\u0430\u043c \u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043e: ' + notedWorks.map(function (entry) {
                return entry.item.title;
            }).join('; ') + '.');
        }
        if (purchasedMaterials.length) {
            generatedParts.push('\u0417\u0430\u043a\u0430\u0437\u0430\u043d\u044b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b: ' + purchasedMaterials.map(function (entry) {
                return entry.item.title + ' ' + reportMaterialNarrativeQuantity(entry, 'purchase', entry.purchasedQty);
            }).join('; ') + '.');
        }
        if (receivedMaterials.length) {
            generatedParts.push('\u041f\u0440\u0438\u043d\u044f\u0442\u044b \u043d\u0430 \u043e\u0431\u044a\u0435\u043a\u0442\u0435: ' + receivedMaterials.map(function (entry) {
                return entry.item.title + ' ' + reportMaterialNarrativeQuantity(entry, 'receipt', entry.receivedQty);
            }).join('; ') + '.');
        }
        if (usedMaterials.length) {
            generatedParts.push('\u0412 \u0440\u0430\u0431\u043e\u0442\u0443/\u043c\u043e\u043d\u0442\u0430\u0436 \u043f\u0435\u0440\u0435\u0434\u0430\u043d\u044b: ' + usedMaterials.map(function (entry) {
                return entry.item.title + ' ' + reportMaterialNarrativeQuantity(entry, 'use', entry.usedQty);
            }).join('; ') + '.');
        }
        if (notedMaterials.length) {
            generatedParts.push('\u041f\u043e \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0430\u043c \u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043e: ' + notedMaterials.map(function (entry) {
                return reportMatchSourceText(entry) || entry.item.title;
            }).join('; ') + '.');
        }
        var unmatchedClauses = projectReportUnmatchedClauses(text, workMatches, materialMatches);
        generatedParts = generatedParts.concat(projectReportAdditionalParts(unmatchedClauses, completedWorks.length + partialWorks.length > 0));
        return buildReadableProjectReportText(text, generatedParts);
    }

    function buildProjectReportFullText(text, blockers, nextSteps) {
        var parts = [];
        var baseText = String(text || '').trim();
        var uniqueSupplementalPhrases = createReportPhraseDeduper(baseText);
        if (baseText) parts.push(baseText);
        [
            { label: 'Проблемы и ограничения', value: blockers },
            { label: 'Следующий шаг', value: nextSteps }
        ].forEach(function (entry) {
            var phrases = uniqueSupplementalPhrases(entry.value);
            if (!phrases.length) return;
            parts.push(reportSentence(entry.label + ': ' + phrases.join('. ')));
        });
        return parts.join('\n\n');
    }

    function renderStructuredFinalReportHtml(draft, blockers, nextSteps) {
        draft = draft || { workMatches: [], materialMatches: [], unmatchedClauses: [] };
        var workRows = [];
        var materialRows = [];
        var additionalRows = [];
        var blockerRows = [];
        var nextRows = [];

        function addUnique(rows, title, detail) {
            title = reportTrimSentence(title);
            detail = reportTrimSentence(detail);
            if (!title) return;
            var key = normalizeReportText(title + ' ' + detail);
            if (rows.some(function (row) { return row.key === key; })) return;
            rows.push({ key: key, title: title, detail: detail });
        }

        function quantityDetail(label, value, entry) {
            var unit = reportEntryQuantityUnit(entry);
            return label + ' ' + finalSectionSummaryNumber(value) + (unit ? ' ' + unit : '');
        }

        (draft.workMatches || []).forEach(function (entry) {
            if (!reportMatchConsumesClause(entry, reportWorkMatchIsConcrete)) return;
            var detail = entry.done ? 'Выполнено' : (entry.partial ? 'Частично выполнено' : 'Упомянуто в отчёте');
            var narrativeQuantity = reportWorkNarrativeQuantity(entry);
            if (narrativeQuantity) detail += ' · ' + narrativeQuantity;
            addUnique(workRows, entry.item && entry.item.title || 'Работа', detail);
        });

        (draft.materialMatches || []).forEach(function (entry) {
            if (!reportMatchConsumesClause(entry, reportMaterialMatchIsConcrete)) return;
            var details = [];
            if (Number(entry.purchasedQty || 0) > 0) details.push(quantityDetail('Заказано', entry.purchasedQty, entry));
            if (Number(entry.receivedQty || 0) > 0) details.push(quantityDetail('Принято', entry.receivedQty, entry));
            if (Number(entry.usedQty || 0) > 0) details.push(quantityDetail('Передано в работу', entry.usedQty, entry));
            addUnique(materialRows, entry.item && entry.item.title || 'Материал', details.join(' · ') || reportMatchSourceText(entry) || 'Упомянуто в отчёте');
        });

        // Free-form author text stays free-form. Only catalog matches and the
        // dedicated blocker/next-step fields become structured groups.

        var uniqueSupplementalPhrases = createReportPhraseDeduper(
            draft.text || (draft.unmatchedClauses || []).join('. ')
        );
        uniqueSupplementalPhrases(blockers).forEach(function (phrase) {
            addUnique(blockerRows, phrase, 'Блокер');
        });
        uniqueSupplementalPhrases(nextSteps).forEach(function (phrase) {
            addUnique(nextRows, phrase, 'Следующий шаг');
        });

        function rowsHtml(rows) {
            return '<ul class="report-final-list">' + rows.map(function (row) {
                return '<li><span class="report-final-row-copy"><b>' + escapeHtml(row.title) + '</b><small>' + escapeHtml(row.detail) + '</small></span></li>';
            }).join('') + '</ul>';
        }

        function groupHtml(kind, icon, title, rows) {
            if (!rows.length) return '';
            return '<section class="report-final-group is-' + escapeHtml(kind) + '" data-report-final-section="' + escapeHtml(kind) + '" aria-label="' + escapeHtml(title) + '">' +
                '<div class="report-final-group-head"><span aria-hidden="true"><i data-lucide="' + escapeHtml(icon) + '"></i></span><div><b>' + escapeHtml(title) + '</b><small>' + escapeHtml(rows.length) + '</small></div></div>' +
                rowsHtml(rows) +
            '</section>';
        }

        return groupHtml('works', 'hammer', 'Работы', workRows) +
            groupHtml('materials', 'package-check', 'Материалы', materialRows) +
            groupHtml('additional', 'sparkles', 'Доп. работы', additionalRows) +
            groupHtml('blockers', 'octagon-alert', 'Блокеры', blockerRows) +
            groupHtml('next', 'arrow-right', 'Следующий шаг', nextRows);
    }

    function buildProjectReportDraft(projectId, payload) {
        var text = String(payload && payload.raw_input || '').trim() || String(payload && payload.work_done || '').trim();
        var clauses = reportTextClauses(text);
        var materialChoicesByClause = payload && payload.material_choices_by_clause || {};
        var workChoicesByClause = payload && payload.work_choices_by_clause || {};
        var workMatchesMap = {};
        var ambiguousWorkMatches = [];
        var materialMatchesMap = {};

        clauses.forEach(function (clause) {
            var workCandidates = workCandidatesForProject(projectId);
            var selectedWorkId = Number(workChoicesByClause[normalizeReportText(clause)] || 0);
            var clauseWorkMatches = workCandidates.map(function (candidate) {
                var result = reportWorkResultFromClause(clause, candidate);
                return result;
            }).filter(Boolean);
            var bestWorkScore = clauseWorkMatches.reduce(function (score, result) {
                return Math.max(score, Number(result.score || 0));
            }, 0);
            var bestWorkMatches = clauseWorkMatches.filter(function (result) {
                return Number(result.score || 0) === bestWorkScore;
            });
            if (selectedWorkId > 0) {
                var selectedWorkResult = clauseWorkMatches.find(function (result) {
                    return Number(result.item && result.item.id || 0) === selectedWorkId;
                });
                if (!selectedWorkResult) {
                    var selectedWorkCandidate = workCandidates.find(function (candidate) {
                        return Number(candidate.item && candidate.item.id || 0) === selectedWorkId;
                    });
                    if (selectedWorkCandidate) selectedWorkResult = reportManualWorkEntry(selectedWorkCandidate, clause);
                }
                bestWorkMatches = selectedWorkResult ? [selectedWorkResult] : [];
            }
            bestWorkMatches.forEach(function (result) {
                result.selectedManually = selectedWorkId > 0;
                result.ambiguous = !result.selectedManually && bestWorkMatches.length > 1;
                if (result.ambiguous) {
                    result.actionEligible = false;
                    ambiguousWorkMatches.push(result);
                    return;
                }
                var key = scheduleWorkKey(result.sectionTitle, result.item);
                if (!workMatchesMap[key]) {
                    workMatchesMap[key] = {
                        sectionTitle: result.sectionTitle,
                        item: result.item,
                        results: []
                    };
                }
                workMatchesMap[key].results.push(result);
            });
            var clauseHasRecognizedWork = bestWorkMatches.some(function (result) {
                return !result.ambiguous && reportMatchConsumesClause(result, reportWorkMatchIsConcrete);
            });

            var materialCandidates = materialCandidatesForProject(projectId);
            var selectedMaterialId = Number(materialChoicesByClause[normalizeReportText(clause)] || 0);
            var clauseMaterialMatches = materialCandidates.map(function (candidate) {
                return reportMaterialResultFromClause(clause, candidate);
            }).filter(Boolean);
            var bestMaterialScore = clauseMaterialMatches.reduce(function (score, result) {
                return Math.max(score, Number(result.score || 0));
            }, 0);
            var bestMaterialMatches = clauseMaterialMatches.filter(function (result) {
                return Number(result.score || 0) === bestMaterialScore;
            });
            if (selectedMaterialId > 0) {
                var selectedResult = clauseMaterialMatches.find(function (result) {
                    return Number(result.item && result.item.id || 0) === selectedMaterialId;
                });
                if (!selectedResult) {
                    var selectedCandidate = materialCandidates.find(function (candidate) {
                        return Number(candidate.item && candidate.item.id || 0) === selectedMaterialId;
                    });
                    if (selectedCandidate) selectedResult = reportManualMaterialEntry(selectedCandidate, clause);
                }
                bestMaterialMatches = selectedResult ? [selectedResult] : [];
            }
            if (!selectedMaterialId && clauseHasRecognizedWork) {
                bestMaterialMatches = bestMaterialMatches.filter(reportMaterialMatchIsConcrete);
            }
            bestMaterialMatches.forEach(function (result) {
                var materialId = Number(result.item.id);
                if (!materialMatchesMap[materialId]) {
                    materialMatchesMap[materialId] = {
                        item: result.item,
                        reportUnit: '',
                        clauseTexts: [],
                        consumedClauseTexts: [],
                        purchasedQty: 0,
                        receivedQty: 0,
                        usedQty: 0,
                        quantityOperations: { purchase: [], receipt: [], use: [] },
                        hasUnambiguous: false,
                        semanticMatch: false
                    };
                }
                result.selectedManually = selectedMaterialId > 0;
                result.ambiguous = !result.selectedManually && bestMaterialMatches.length > 1;
                if (result.selectedManually && materialMatchesMap[materialId].ambiguous) {
                    materialMatchesMap[materialId].clauseTexts = [];
                    materialMatchesMap[materialId].purchasedQty = 0;
                    materialMatchesMap[materialId].receivedQty = 0;
                    materialMatchesMap[materialId].usedQty = 0;
                    materialMatchesMap[materialId].reportUnit = '';
                    materialMatchesMap[materialId].actionEligible = false;
                    materialMatchesMap[materialId].consumedClauseTexts = [];
                    materialMatchesMap[materialId].quantityOperations = { purchase: [], receipt: [], use: [] };
                    materialMatchesMap[materialId].hasUnambiguous = false;
                    materialMatchesMap[materialId].semanticMatch = false;
                }
                materialMatchesMap[materialId].selectedManually = !!(materialMatchesMap[materialId].selectedManually || result.selectedManually);
                materialMatchesMap[materialId].hasUnambiguous = !!(materialMatchesMap[materialId].hasUnambiguous || !result.ambiguous);
                materialMatchesMap[materialId].ambiguous = materialMatchesMap[materialId].selectedManually
                    ? false
                    : !materialMatchesMap[materialId].hasUnambiguous;
                if (result.clauseText && materialMatchesMap[materialId].clauseTexts.indexOf(result.clauseText) === -1) {
                    materialMatchesMap[materialId].clauseTexts.push(result.clauseText);
                }
                if (!result.ambiguous) {
                    if (!materialMatchesMap[materialId].reportUnit && result.reportUnit) {
                        materialMatchesMap[materialId].reportUnit = result.reportUnit;
                    }
                    materialMatchesMap[materialId].actionEligible = !!(materialMatchesMap[materialId].actionEligible || result.actionEligible);
                    materialMatchesMap[materialId].semanticMatch = !!(materialMatchesMap[materialId].semanticMatch || result.semanticMatch);
                    if (result.clauseText && reportMatchConsumesClause(result, reportMaterialMatchIsConcrete) && materialMatchesMap[materialId].consumedClauseTexts.indexOf(result.clauseText) === -1) {
                        materialMatchesMap[materialId].consumedClauseTexts.push(result.clauseText);
                    }
                    materialMatchesMap[materialId].purchasedQty += Number(result.purchasedQty || 0);
                    materialMatchesMap[materialId].receivedQty += Number(result.receivedQty || 0);
                    materialMatchesMap[materialId].usedQty += Number(result.usedQty || 0);
                    [
                        { kind: 'purchase', intent: result.purchaseIntent, qty: result.purchasedQty },
                        { kind: 'receipt', intent: result.receiptIntent, qty: result.receivedQty },
                        { kind: 'use', intent: result.useIntent, qty: result.usedQty }
                    ].forEach(function (operation) {
                        var targetMode = result.quantityMode === 'target_qty' || result.quantityMode === 'target_percent';
                        if (!operation.intent && !(Number(operation.qty) > 0)) return;
                        if (!(Number(operation.qty) > 0) && !(targetMode && Number(result.targetQty) >= 0)) return;
                        materialMatchesMap[materialId].quantityOperations[operation.kind].push({
                            mode: targetMode ? result.quantityMode : 'delta_qty',
                            targetQty: targetMode ? Number(result.targetQty) : null,
                            qty: Number(operation.qty || 0)
                        });
                    });
                }
            });
        });

        var workMatches = Object.keys(workMatchesMap).map(function (key) {
            var aggregate = workMatchesMap[key];
            var results = aggregate.results || [];
            var plan = quantityPlanInfo(aggregate.item);
            var progress = workActualProgress(projectId, aggregate.sectionTitle, aggregate.item);
            if (results.length === 1) {
                var singleResult = Object.assign({}, results[0]);
                var singleQty = clampActualQty(singleResult.actualQty, plan.totalQty);
                var singleTargetMode = singleResult.quantityMode === 'target_qty' || singleResult.quantityMode === 'target_percent';
                var singleAppliedQty = singleTargetMode
                    ? singleQty
                    : (plan.totalQty > 0
                        ? Math.min(singleQty, Math.max(Number(progress.total || 0) - Number(progress.actual || 0), 0))
                        : singleQty);
                singleResult.requestedQty = singleQty;
                singleResult.baseActualQty = Number(progress.actual || 0);
                singleResult.actualQty = singleAppliedQty;
                singleResult.resultActualQty = singleTargetMode
                    ? Math.max(Number(progress.actual || 0), singleAppliedQty)
                    : (plan.totalQty > 0
                        ? Math.min(Number(progress.total || 0), Number(progress.actual || 0) + singleAppliedQty)
                        : Number(progress.actual || 0) + singleAppliedQty);
                if (singleTargetMode && singleQty > 0 && singleResult.resultActualQty > singleQty) {
                    singleResult.actualQty = singleResult.resultActualQty;
                    if (singleResult.quantityMode === 'target_percent') {
                        singleResult.quantityValue = plan.totalQty > 0 ? singleResult.resultActualQty / plan.totalQty * 100 : 0;
                        singleResult.quantityLabel = finalSectionSummaryNumber(singleResult.quantityValue) + '%';
                    } else {
                        singleResult.quantityValue = singleResult.resultActualQty;
                        singleResult.quantityLabel = reportWorkQuantityLabel('', aggregate.item, singleResult.resultActualQty);
                    }
                } else if (!singleTargetMode) {
                    singleResult.quantityMode = 'delta_qty';
                    singleResult.quantityValue = singleAppliedQty;
                    singleResult.quantityLabel = reportWorkQuantityLabel('', aggregate.item, singleAppliedQty);
                }
                singleResult.actionEligible = plan.totalQty > 0 && (singleTargetMode
                    ? singleAppliedQty > Number(progress.actual || 0)
                    : singleAppliedQty > 0);
                if (plan.totalQty > 0) {
                    singleResult.done = singleResult.resultActualQty >= plan.totalQty;
                    singleResult.partial = (singleResult.resultActualQty > 0 && !singleResult.done) ||
                        (!!singleResult.partial && !(singleAppliedQty > 0));
                }
                return singleResult;
            }
            var runningQty = Number(progress.actual || 0);
            var clauseTexts = [];
            results.forEach(function (result) {
                var resultQty = clampActualQty(result.actualQty, plan.totalQty);
                if (result.quantityMode === 'target_qty' || result.quantityMode === 'target_percent') {
                    runningQty = Math.max(runningQty, resultQty);
                } else {
                    runningQty = Math.min(plan.totalQty, runningQty + resultQty);
                }
                if (result.clauseText && clauseTexts.indexOf(result.clauseText) === -1) clauseTexts.push(result.clauseText);
            });
            var deltaQty = Math.max(0, runningQty - Number(progress.actual || 0));
            return {
                sectionTitle: aggregate.sectionTitle,
                item: aggregate.item,
                clauseText: clauseTexts.join('. '),
                clauseTexts: clauseTexts,
                score: Math.max.apply(Math, results.map(function (result) { return Number(result.score || 0); })),
                actualQty: deltaQty,
                quantityLabel: reportWorkQuantityLabel('', aggregate.item, deltaQty),
                quantityMode: 'delta_qty',
                quantityValue: deltaQty,
                requestedQty: results.reduce(function (total, result) { return total + Math.max(0, Number(result.actualQty || 0)); }, 0),
                baseActualQty: Number(progress.actual || 0),
                resultActualQty: runningQty,
                actionEligible: deltaQty > 0 || results.some(function (result) { return !!result.actionEligible; }),
                done: plan.totalQty > 0 && runningQty >= plan.totalQty,
                partial: plan.totalQty > 0 && runningQty > 0 && runningQty < plan.totalQty,
                ambiguous: false,
                selectedManually: results.some(function (result) { return !!result.selectedManually; })
            };
        }).concat(ambiguousWorkMatches);
        var materialMatches = Object.keys(materialMatchesMap).map(function (key) {
            var entry = materialMatchesMap[key];
            var planned = quantityPlanInfo(entry.item).totalQty;
            if (planned > 0) {
                var alreadyPurchased = Number(entry.item.purchasedQty || entry.item.purchased_qty || 0);
                var alreadyReceived = Number(entry.item.receivedQty || entry.item.received_qty || 0);
                var alreadyUsed = Number(entry.item.usedQty || entry.item.used_qty || 0) + Number(entry.item.writeoffQty || entry.item.writeoff_qty || 0);
                entry.purchaseMaxQty = Math.max(planned - Math.max(alreadyPurchased, alreadyReceived), 0);
                entry.receiptMaxQty = Math.max(planned - alreadyReceived, 0);
                entry.useMaxQty = Math.max(Number(entry.item.stockBalanceQty != null ? entry.item.stockBalanceQty : (alreadyReceived - alreadyUsed)) || 0, 0);
                function materialOperationDelta(baseQty, maxQty, operations, fallbackQty) {
                    if (!Array.isArray(operations) || !operations.length) return Math.min(maxQty, Number(fallbackQty || 0));
                    var upperQty = baseQty + maxQty;
                    var runningQty = baseQty;
                    operations.forEach(function (operation) {
                        if ((operation.mode === 'target_qty' || operation.mode === 'target_percent') && isFinite(Number(operation.targetQty))) {
                            runningQty = Math.max(runningQty, Math.min(upperQty, Number(operation.targetQty)));
                        } else {
                            runningQty = Math.min(upperQty, runningQty + Math.max(0, Number(operation.qty || 0)));
                        }
                    });
                    return Math.max(0, runningQty - baseQty);
                }
                var operations = entry.quantityOperations || {};
                entry.purchasedQty = materialOperationDelta(Math.max(alreadyPurchased, alreadyReceived), entry.purchaseMaxQty, operations.purchase, entry.purchasedQty);
                entry.receivedQty = materialOperationDelta(alreadyReceived, entry.receiptMaxQty, operations.receipt, entry.receivedQty);
                entry.usedQty = materialOperationDelta(alreadyUsed, entry.useMaxQty, operations.use, entry.usedQty);
            }
            delete entry.quantityOperations;
            return entry;
        });

        return {
            text: buildProjectReportTextFromMatches(text, workMatches, materialMatches),
            workMatches: workMatches,
            materialMatches: materialMatches,
            unmatchedClauses: projectReportUnmatchedClauses(text, workMatches, materialMatches),
            previewAdditionalClauses: projectReportPreviewAdditionalClauses(text, workMatches, materialMatches)
        };
    }

    function rebuildProjectReportEffects(projectId) {
        if (!state.projectLogsByProject) state.projectLogsByProject = {};
        if (!state.projectReportEffectsByProject) state.projectReportEffectsByProject = {};
        // Daily report text is evidence, not a stock ledger. Quantities are
        // applied only through the audited warehouse workflow.
        state.projectReportEffectsByProject[projectId] = { works: {}, materials: {} };
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
        var schedulePanel = qs('[data-panel="schedule"]');
        var overviewMaterials = qs('[data-project-overview-materials]');
        if (overviewMaterials) safeReplaceChildren(overviewMaterials, renderMaterials(materials, project.id, insights));
        if (schedulePanel) safeReplaceChildren(schedulePanel, renderSchedulePanel(state.stagesByProject[projectId] || [], project));
        bindProjectChainActions();
        bindProjectMarketToggles(projectId);
        bindAutoScheduleForm(projectId);
        bindScheduleStatusActions(projectId);
        bindSectionScheduleRefresh(projectId);
        bindSectionScheduleInteractions(projectId);
        bindActualQuantityInputs(projectId);
        if (PMBI.planning && typeof PMBI.planning.bindProjectScheduleViews === 'function') PMBI.planning.bindProjectScheduleViews(projectId);
    }

    var baseLoadProjectLogs = loadProjectLogs;
    loadProjectLogs = function (projectId, callback) {
        return baseLoadProjectLogs(projectId, function (logs) {
            if (!state.projectLogsByProject) state.projectLogsByProject = {};
            state.projectLogsByProject[projectId] = logs || [];
            rebuildProjectReportEffects(projectId);
            rerenderProjectReportDrivenViews(projectId);
            if (typeof callback === 'function') callback(logs || []);
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
            return '<span>Опишите факт дня — здесь появится готовый текст отчета и подсказки по распознанным позициям.</span>';
        }
        var parts = [];
        if (draft.text) {
            parts.push('<span><b>Текст отчета:</b> ' + escapeHtml(draft.text) + '</span>');
        }
        if (draft.workMatches.length) {
            parts.push('<span><b>Распознаны работы:</b> ' + escapeHtml(draft.workMatches.map(function (entry) {
                return entry.item.title + (entry.partial ? ' (\u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e)' : '');
            }).join(', ')) + '</span>');
        } else {
            parts.push('<span><b>Работы:</b> явных совпадений со сметой не найдено.</span>');
        }
        if (draft.materialMatches.length) {
            parts.push('<span><b>Распознаны материалы:</b> ' + escapeHtml(draft.materialMatches.map(function (entry) {
                var bits = [];
                if (entry.purchasedQty > 0) bits.push('\u043a\u0443\u043f\u043b\u0435\u043d\u043e ' + finalSectionSummaryNumber(entry.purchasedQty));
                if (entry.usedQty > 0) bits.push('\u0432 \u0440\u0430\u0431\u043e\u0442\u0443 ' + finalSectionSummaryNumber(entry.usedQty));
                return entry.item.title + ' (' + bits.join(', ') + ' ' + reportEntryQuantityUnit(entry) + ')';
            }).join('; ')) + '</span>');
        } else {
            parts.push('<span><b>Материалы:</b> явных совпадений со сметой не найдено.</span>');
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

    function projectCompanyForProject(project) {
        var code = String(project && project.portfolio_company || '');
        if (!PROJECT_COMPANY_LABELS[code]) code = projectCompanyCode(project && project.portfolio_company_label);
        return code;
    }

    function syncProjectCompanyFilter(projects) {
        var root = qs('[data-project-company-filter]');
        if (!root) return;
        var active = String(state.projectCompanyFilter || 'all');
        if (!PROJECT_COMPANY_LABELS[active] && active !== 'all') active = 'all';
        state.projectCompanyFilter = active;
        var counts = { all: projects.length, uess: 0, pm: 0, strategy: 0 };
        projects.forEach(function (project) {
            var code = projectCompanyForProject(project);
            if (counts[code] != null) counts[code] += 1;
        });
        qsa('[data-project-company-filter-value]', root).forEach(function (button) {
            var value = button.getAttribute('data-project-company-filter-value') || 'all';
            var selected = value === active;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
            var count = qs('[data-project-company-count="' + value + '"]', button);
            if (count) count.textContent = String(counts[value] || 0);
        });
    }

    function projectOverviewFilteredProjects(projects) {
        projects = Array.isArray(projects) ? projects : [];
        var search = qs('[data-project-search]');
        var query = String(search && search.value || '').trim().toLocaleLowerCase('ru');
        var company = String(state.projectCompanyFilter || 'all');
        return projects.filter(function (project) {
            if (company !== 'all' && projectCompanyForProject(project) !== company) return false;
            if (!query) return true;
            return [project && project.title, project && project.address, project && project.client_name, project && project.status, project && project.portfolio_company_label]
                .join(' ')
                .toLocaleLowerCase('ru')
                .indexOf(query) !== -1;
        });
    }

    function applyProjectOverviewFilters() {
        renderProjectList(state.projects || []);
    }

    function bindProjectCompanyFilter() {
        var root = qs('[data-project-company-filter]');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';
        root.addEventListener('click', function (event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-project-company-filter-value]') : null;
            if (!button) return;
            state.projectCompanyFilter = button.getAttribute('data-project-company-filter-value') || 'all';
            applyProjectOverviewFilters();
        });
    }

    function renderProjectList(projects) {
        var root = qs('[data-projects-list]');
        if (!root) return;
        try {
            projects = Array.isArray(projects) ? projects : [];
            if (!isGuestRole() && qs('[data-project-company-filter]')) {
                var sourceProjects = Array.isArray(state.projects) ? state.projects : projects;
                syncProjectCompanyFilter(sourceProjects);
                projects = projectOverviewFilteredProjects(sourceProjects);
            }
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
            function projectAvatarChip(person, index) {
                var avatarUrl = safeAvatarUrl(person && (person.avatarUrl || person.avatar_url || person.avatar || ''));
                var attrs = ' class="project-avatar-chip is-profile-avatar' + (avatarUrl ? ' has-image' : '') + '" style="z-index:' + (10 - index) + '" title="' + escapeHtml(person.name) + '" aria-label="' + escapeHtml(person.name) + '"';
                if (avatarUrl) {
                    return '<span' + attrs + '><img src="' + escapeHtml(avatarUrl) + '" alt=""></span>';
                }
                return '<span' + attrs + '>' + escapeHtml(profileUserInitials(person.user || person) || 'П') + '</span>';
            }
            function projectForemenMeta(project) {
                var assigned = Array.isArray(project && project.assigned_foremen) ? project.assigned_foremen : [];
                var people = assigned.map(function (userId) {
                    var user = projectUserById(userId);
                    return {
                        id: userId,
                        name: user && (user.name || user.login) ? (user.name || user.login) : ('Прораб #' + userId),
                        user: user || null,
                        avatarUrl: user && (user.avatarUrl || user.avatar_url || user.avatar || '')
                    };
                });
                var preview = people.slice(0, 4).map(function (person, index) {
                    return projectAvatarChip(person, index);
                }).join('');
                return {
                    count: people.length,
                    label: people.length ? (people.length + ' прораб' + (people.length > 1 ? 'а' : '')) : 'Прорабы не назначены',
                    avatars: preview || '<span class="project-avatar-chip is-empty" aria-hidden="true">+</span>'
                };
            }
            function currentUserId() {
                var user = state.currentUser || state.user || {};
                return Number(user.id || 0);
            }
            function isProjectAssignedToCurrentForeman(project) {
                var assigned = Array.isArray(project && project.assigned_foremen) ? project.assigned_foremen.map(Number) : [];
                return !!currentUserId() && assigned.indexOf(currentUserId()) !== -1;
            }
            function canCurrentForemanClaimProject(project) {
                var assigned = Array.isArray(project && project.assigned_foremen) ? project.assigned_foremen : [];
                return isForemanRole() && !isCompletedProject(project) && (!assigned.length || isProjectAssignedToCurrentForeman(project));
            }
            function canEditProjectFromCard() {
                return isAdminRole() || currentPermissions().projects === 'edit';
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
                if (isGuestRole()) {
                    return '<article class="project-card guest-project-card ' + (completed ? 'project-completed ' : '') + '" data-project-id="' + escapeHtml(project.id || '') + '">' +
                        '<div class="project-card-shell">' +
                            '<div class="project-card-headline">' +
                                '<div class="project-card-icon" aria-hidden="true"><i data-lucide="building-2"></i></div>' +
                                '<div class="project-card-heading"><span class="guest-project-kicker">Объект в гостевом доступе</span><h3>' + escapeHtml(project.title || 'Объект') + '</h3><p>Актуальные отчёты и план производства работ</p></div>' +
                                '<span class="project-status-badge is-' + escapeHtml(statusMeta.tone) + '">' + escapeHtml(statusMeta.label) + '</span>' +
                            '</div>' +
                            '<div class="project-card-progress">' +
                                '<div class="project-progress-label"><span>Готовность объекта</span><strong>' + escapeHtml(String(progress)) + '%</strong></div>' +
                                '<div class="project-progress-track" aria-hidden="true"><span class="project-progress-bar" style="width:' + progress + '%"></span></div>' +
                            '</div>' +
                            '<div class="guest-project-actions">' +
                                '<button class="guest-project-action" type="button" data-project-quick-tab="reports" data-project-id="' + escapeHtml(project.id || '') + '"><span class="guest-project-action-icon"><i data-lucide="notebook-tabs"></i></span><span class="guest-project-action-copy"><strong>Отчёты</strong><small>Ход работ и события</small></span><i class="guest-project-action-arrow" data-lucide="arrow-right"></i></button>' +
                                '<button class="guest-project-action is-production" type="button" data-project-quick-tab="production-schedule" data-project-id="' + escapeHtml(project.id || '') + '"><span class="guest-project-action-icon"><i data-lucide="calendar-range"></i></span><span class="guest-project-action-copy"><strong>График производства</strong><small>План работ по дням</small></span><i class="guest-project-action-arrow" data-lucide="arrow-right"></i></button>' +
                            '</div>' +
                        '</div>' +
                    '</article>';
                }
                var foremenMeta = projectForemenMeta(project);
                var statusBadge = '<span class="project-status-badge is-' + escapeHtml(statusMeta.tone) + '">' + escapeHtml(statusMeta.label) + '</span>';
                var companyCode = projectCompanyForProject(project);
                var companyBadge = companyCode
                    ? '<span class="project-company-badge is-' + escapeHtml(companyCode) + '">' + escapeHtml(PROJECT_COMPANY_LABELS[companyCode]) + '</span>'
                    : '<span class="project-company-badge is-unassigned">Компания не указана</span>';
                var menuItems = [];
                if (canEditProjectFromCard()) menuItems.push('<button type="button" data-project-edit="' + escapeHtml(project.id || '') + '"><i data-lucide="pencil"></i><span>Редактировать</span></button>');
                if (canManageProjectAccess()) menuItems.push('<button type="button" data-project-card-access="' + escapeHtml(project.id || '') + '"><i data-lucide="users"></i><span>Ответственные объекта</span></button>');
                if (canCurrentForemanClaimProject(project)) {
                    menuItems.push('<button type="button" data-project-claim-foreman="' + escapeHtml(project.id || '') + '"><i data-lucide="hand"></i><span>' + (isProjectAssignedToCurrentForeman(project) ? 'Уже мой объект' : 'Взять объект') + '</span></button>');
                }
                var editButton = menuItems.length
                    ? '<div class="project-card-menu-wrap"><button class="project-card-menu" type="button" aria-label="Действия с объектом" data-project-menu-toggle="' + escapeHtml(project.id || '') + '"><i data-lucide="ellipsis"></i></button><div class="project-card-menu-panel" data-project-menu-panel="' + escapeHtml(project.id || '') + '" hidden>' + menuItems.join('') + '</div></div>'
                    : '';
                var riskBadge = (!completed && criticalCount)
                    ? '<span class="project-inline-note is-danger"><i data-lucide="triangle-alert"></i><span>Нехватки: ' + escapeHtml(String(criticalCount)) + '</span></span>'
                    : '';
                var displayStartDate = projectDisplayStartDate(project);
                var displayDeadlineDate = projectDisplayDeadlineDate(project);
                var deadlineText = displayStartDate || displayDeadlineDate
                    ? escapeHtml((displayStartDate ? formatDisplayDate(displayStartDate) : 'Без старта') + ' - ' + (displayDeadlineDate ? formatDisplayDate(displayDeadlineDate) : 'Без дедлайна'))
                    : 'Сроки не указаны';
                var financeQuickAction = canSeeFinances()
                    ? '<button class="project-quick-action" type="button" data-project-quick-tab="finance" data-project-id="' + escapeHtml(project.id || '') + '" aria-label="Финансы"><i data-lucide="wallet"></i></button>'
                    : '';
                var coverVisual = projectCoverVisual(project);
                return '<article class="project-card ' + (completed ? 'project-completed ' : '') + (!completed && criticalCount ? 'project-risk' : '') + '" data-project-id="' + escapeHtml(project.id || '') + '">' +
                    '<div class="project-card-shell">' +
                        '<div class="project-card-cover">' +
                            projectCoverMedia(project, 'project-card-cover-media', 'lazy') +
                            '<span class="project-card-cover-label"><i data-lucide="' + (coverVisual.uploaded ? 'camera' : 'image') + '"></i>' + (coverVisual.uploaded ? 'Фото объекта' : 'Обложка объекта') + '</span>' +
                        '</div>' +
                        '<div class="project-card-headline">' +
                            '<div class="project-card-icon" aria-hidden="true"><i data-lucide="' + (completed ? 'folder-git-2' : 'building-2') + '"></i></div>' +
                            '<div class="project-card-heading">' +
                                '<h3>' + escapeHtml(project.title || '\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f') + '</h3>' +
                                '<p>' + escapeHtml(project.client_name || 'Заказчик не указан') + '</p>' +
                            '</div>' +
                            '<div class="project-card-tools"><div class="project-badges">' + companyBadge + statusBadge + '</div>' + editButton + '</div>' +
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
                            '<button class="project-quick-action" type="button" data-project-quick-tab="schedule" data-project-id="' + escapeHtml(project.id || '') + '" aria-label="Работы"><i data-lucide="hammer"></i></button>' +
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
                    if (event.target && event.target.closest('[data-project-edit], [data-project-quick-tab], [data-project-menu-toggle], [data-project-card-access], [data-project-claim-foreman], .project-card-menu-panel')) return;
                    openProject(Number(card.dataset.projectId));
                });
            });
            qsa('[data-project-menu-toggle]', root).forEach(function (button) {
                if (button.dataset.projectMenuBound === '1') return;
                button.dataset.projectMenuBound = '1';
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var panel = qs('[data-project-menu-panel="' + button.dataset.projectMenuToggle + '"]', root);
                    qsa('[data-project-menu-panel]', root).forEach(function (item) {
                        if (item !== panel) item.hidden = true;
                    });
                    if (panel) panel.hidden = !panel.hidden;
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
            qsa('[data-project-card-access]', root).forEach(function (button) {
                if (button.dataset.projectAccessBound === '1') return;
                button.dataset.projectAccessBound = '1';
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var projectId = Number(button.dataset.projectCardAccess || 0);
                    var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
                    if (!project) return;
                    state.selectedProject = project;
                    openProjectAccessModal();
                });
            });
            qsa('[data-project-claim-foreman]', root).forEach(function (button) {
                if (button.dataset.projectClaimBound === '1') return;
                button.dataset.projectClaimBound = '1';
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var projectId = Number(button.dataset.projectClaimForeman || 0);
                    if (!projectId || button.disabled) return;
                    button.disabled = true;
                    api('/api/projects/' + projectId + '/claim-foreman', { method: 'POST', body: JSON.stringify({}) }).then(function (data) {
                        if (data && data.project) updateProjectInState(data.project);
                        renderProjectList(state.projects);
                        showAppNotice('Объект закреплён за вами.', 'success');
                    }).catch(function (err) {
                        var fallback = err && err.payload && err.payload.error === 'project_already_has_foreman'
                            ? 'У объекта уже есть прораб.'
                            : 'Не удалось взять объект.';
                        showAppNotice(appErrorMessage(err, fallback), 'error');
                        button.disabled = false;
                    });
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
            if (isGuestRole()) {
                var guestPageHead = qs('.page-head[data-project-overview-section]');
                var guestEyebrow = guestPageHead && qs('.eyebrow', guestPageHead);
                var guestDescription = guestPageHead && qs('div > p:last-child', guestPageHead);
                if (guestEyebrow) guestEyebrow.textContent = 'Гостевой доступ';
                if (guestDescription) guestDescription.textContent = 'Выберите объект, чтобы посмотреть опубликованные отчёты и график производства.';
            }
            ensureProjectEditCard();
            populateProjectCompanySelects();
            if (isAdminRole()) loadCompanies(populateProjectCompanySelects);
            var companyFilter = qs('[data-project-company-filter]');
            if (companyFilter) companyFilter.hidden = isGuestRole();
            bindProjectCompanyFilter();
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
                var applyProjectSearch = debounce(function () {
                    try {
                        applyProjectOverviewFilters();
                    } catch (error) {
                        console.error('Project search render failed', error);
                        renderProjectList(state.projects || []);
                    }
                }, 300);
                search.addEventListener('input', applyProjectSearch);
            }
            bindProjectBackButton();
            syncProjectTabVisibility(qs('[data-project-detail]') || document);
            bindProjectTabClicks();
            refreshLucideIcons(qs('[data-project-detail]') || document);
            var params = new URLSearchParams(location.search);
            var openProjectId = Number(params.get('openProject') || 0);
            var openProjectTab = params.get('tab') || '';
            if (params.get('materialId')) openProjectTab = 'warehouse-control';
            var projectDetailRoot = qs('[data-project-detail]');
            var selectedProjectMatches = !!(state.selectedProject && Number(state.selectedProject.id) === openProjectId);
            if (openProjectId && (!selectedProjectMatches || !projectDetailRoot || projectDetailRoot.hidden)) {
                var matched = (state.projects || []).some(function (project) { return Number(project.id) === openProjectId; });
                if (matched) {
                    openProject(openProjectId);
                    if (openProjectTab) activateProjectTab(openProjectTab);
                }
            } else if (openProjectId && openProjectTab) {
                activateProjectTab(openProjectTab);
            }
            if (openProjectId) focusProjectDeepLink(openProjectId);
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
        var estimateMaterials = (items || []).filter(function (item) {
            return item && !item.is_deleted && !item.isDeleted && String(item.title || '').trim() && String(item.itemKind || 'material').toLowerCase() !== 'work';
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
                groups[sectionTitle] = { stageRows: [], estimateRows: [], materialRows: [] };
                order.push(sectionTitle);
            }
            return groups[sectionTitle];
        }
        visibleWorkStages.forEach(function (stage) { ensureGroup(rootSectionTitleForStage(stage, stageMap)).stageRows.push(stage); });
        visibleEstimateWorks.forEach(function (item) { ensureGroup(item.sectionTitle || item.section_title || item.stageTitle || item.sectionId).estimateRows.push(item); });
        estimateMaterials.forEach(function (item) { ensureGroup(item.sectionTitle || item.section_title || item.stageTitle || item.sectionId).materialRows.push(item); });
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
        (order.length ? '<div class="estimate-section-list">' + order.map(function (title, index) {
            var group = groups[title];
            var workProgress = workProgressForRows(projectId, title, group.estimateRows);
            var materialProgressValue = materialProgress(projectId, group.materialRows);
            var sectionProgress = {
                total: workProgress.total + materialProgressValue.total,
                done: workProgress.done + materialProgressValue.done
            };
            var scheduleMeta = workSectionScheduleMeta(projectId, title, index, workProgress);
            var open = isEstimateSectionOpen(projectId, 'works', title, index);
            var workRowsHtml = group.stageRows.map(function (stage) {
                var meta = [stagePathLabel(stage, stageMap), stage.planned_start && stage.planned_end ? (stage.planned_start + ' - ' + stage.planned_end) : '', stage.responsible || ''].filter(Boolean).join(' \u2022 ');
                return '<div class="material-row work-row"><div class="work-row-main"><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta || '\u0420\u0430\u0431\u043e\u0442\u0430') + '</small></div><div class="work-row-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' \u2022 ' + percent(stage.progress) + '%</span></div></div>';
            }).join('') +
            group.estimateRows.map(function (item) { return renderEstimateWorkItem(item, title, projectId, scheduleMeta.kind); }).join('');
            var materialsHtml = group.materialRows.map(function (item) {
                return renderMaterialManualCheck(item, title, projectId);
            }).join('');
            var head = renderEstimateAccordionHead(
                projectId,
                'works',
                title,
                index,
                '<span class="section-work-section-icon" aria-hidden="true"><i data-lucide="layers-3"></i></span><h3>' + escapeHtml(estimateDisplaySectionTitleWithNumber(title, index, sectionNumbers)) + '</h3>' + sectionProgressBadge('works', workProgress, ''),
                scheduleMeta.html + renderInlineMarketButton(projectId, 'works', 'inline-market-section') + sectionPresenceBadge('work', '\u0420\u0430\u0431\u043e\u0442\u044b', workProgress) + sectionPresenceBadge('material', '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b', materialProgressValue) + '<span class="badge estimate-section-count">' + escapeHtml(String(group.stageRows.length + group.estimateRows.length + group.materialRows.length) + ' \u043f\u043e\u0437.') + '</span>',
                '',
                sectionProgressStrip(workProgress, materialProgressValue, title)
            );
            return '<section class="estimate-section estimate-section-card estimate-section-collapsible work-section-card' + scheduleMeta.className + (open ? ' is-open' : '') + '">' +
                head +
                renderEstimateSectionBody(open,
                    '<div class="section-schedule-detail-grid">' +
                        '<section class="section-schedule-detail-column"><div class="section-schedule-detail-title"><strong>\u0420\u0430\u0431\u043e\u0442\u044b</strong><span>' + escapeHtml(String(workProgress.done) + ' \u0438\u0437 ' + String(workProgress.total)) + '</span></div><div class="section-schedule-detail-list">' + (workRowsHtml || '<div class="section-schedule-empty inline">\u0412 \u044d\u0442\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043d\u0435\u0442 \u0440\u0430\u0431\u043e\u0442 \u043f\u043e \u0441\u043c\u0435\u0442\u0435.</div>') + '</div></section>' +
                        '<section class="section-schedule-detail-column"><div class="section-schedule-detail-title"><strong>\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b</strong><span>' + escapeHtml(String(materialProgressValue.done) + ' \u0438\u0437 ' + String(materialProgressValue.total)) + '</span></div><div class="section-schedule-detail-list">' + (materialsHtml || '<div class="section-schedule-empty inline">\u0412 \u044d\u0442\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043d\u0435\u0442 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432 \u043f\u043e \u0441\u043c\u0435\u0442\u0435.</div>') + '</div></section>' +
                    '</div>'
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
        var requestedMaterialId = '';
        try {
            var params = new URLSearchParams(location.search);
            requestedMaterialId = params.get('materialId') || '';
            params.set('openProject', String(projectId));
            if (requestedMaterialId) params.set('tab', 'warehouse-control');
            history.replaceState(null, '', location.pathname + '\u003f' + params.toString());
            syncRouterLocation();
        } catch (historyError) {}
        function panel(name) { return qs('[data-panel="' + name + '"]'); }
        state.selectedProject = project;
        root.hidden = false;
        setProjectFocusMode(true);
        bindProjectTabClicks();
        document.documentElement.classList.remove('projects-booting');
        document.documentElement.classList.remove('project-route-loading');
        var overviewPanel = panel('overview');
        var schedulePanel = panel('schedule');
        var reconciliationPanel = panel('estimate-reconciliation');
        var warehouseControlPanel = panel('warehouse-control');
        var calendarPanel = panel('calendar');
        var productionSchedulePanel = panel('production-schedule');
        var reportsPanel = panel('reports');
        var tasksPanel = panel('tasks');
        var financePanel = panel('finance');
        var documentsPanel = panel('documents');
        var chatPanel = panel('chat');
        var aiPanel = panel('ai');
        var titleNode = qs('[data-detail-title]') || qs('[data-project-title]');
        if (isGuestRole()) {
            if (titleNode) titleNode.textContent = project.title || 'Объект';
            if (reportsPanel) showSkeleton(reportsPanel, 'feed', 3);
            if (productionSchedulePanel) showSkeleton(productionSchedulePanel, 'table', 1);
            syncProjectTabVisibility(root);
            var guestTab = 'reports';
            try {
                var guestParams = new URLSearchParams(location.search);
                if (guestParams.get('tab') === 'production-schedule') guestTab = 'production-schedule';
            } catch (guestTabError) {}
            activateProjectTab(guestTab);
            refreshProjectReportsTab(project.id, loadingToken);
            return;
        }
        var scheduleRenderTimer = null;
        function renderScheduleNow(stages) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            if (schedulePanel) safeReplaceChildren(schedulePanel, renderSchedulePanel(stages || state.stagesByProject[project.id] || [], project));
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
            bindSectionScheduleInteractions(project.id);
            bindActualQuantityInputs(project.id);
            bindProjectMarketToggles(project.id);
            bindProjectChainActions();
            if (PMBI.planning && typeof PMBI.planning.bindProjectScheduleViews === 'function') PMBI.planning.bindProjectScheduleViews(project.id);
            focusProjectDeepLink(project.id);
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
        renderScheduleNow(state.stagesByProject[project.id] || []);
        if (reconciliationPanel) safeReplaceChildren(reconciliationPanel, '<p class="muted">Сверка загрузится при открытии вкладки.</p>');
        if (warehouseControlPanel) safeReplaceChildren(warehouseControlPanel, '<p class="muted">Склад загрузится при открытии вкладки.</p>');
        if (calendarPanel && PMBI.planning && typeof PMBI.planning.renderProjectCalendarPanel === 'function') {
            safeReplaceChildren(calendarPanel, PMBI.planning.renderProjectCalendarPanel(project));
        }
        if (productionSchedulePanel) safeReplaceChildren(productionSchedulePanel, '<p class="muted">График производства загрузится при открытии вкладки.</p>');
        if (reportsPanel) safeReplaceChildren(reportsPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043e\u0442\u0447\u0435\u0442\u044b...</p>');
        if (tasksPanel) safeReplaceChildren(tasksPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0437\u0430\u0434\u0430\u0447\u0438...</p>');
        if (financePanel) safeReplaceChildren(financePanel, '');
        if (documentsPanel) safeReplaceChildren(documentsPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b...</p>');
        if (chatPanel) safeReplaceChildren(chatPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0447\u0430\u0442...</p>');
        if (aiPanel) safeReplaceChildren(aiPanel, '<p class="muted">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0430\u043d\u0430\u043b\u0438\u0437...</p>');
        if (!Array.isArray(state.stagesByProject[project.id]) || !state.stagesByProject[project.id].length) showSkeleton(schedulePanel, 'table', 1);
        showSkeleton(reconciliationPanel, 'panel', 1);
        showSkeleton(warehouseControlPanel, 'table', 1);
        showSkeleton(productionSchedulePanel, 'table', 1);
        showSkeleton(reportsPanel, 'feed', 3);
        showSkeleton(tasksPanel, 'feed', 3);
        showSkeleton(financePanel, 'panel', 1);
        showSkeleton(documentsPanel, 'feed', 3);
        showSkeleton(chatPanel, 'feed', 3);
        showSkeleton(aiPanel, 'panel', 1);
        bindProjectOverviewActions();
        syncProjectTabVisibility(root);
        activateProjectTab('overview');
        loadMaterials(project.id, function (items) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            queueScheduleRender(state.stagesByProject[project.id] || []);
            bindMaterialManualChecks(project.id);
            loadWarehouseMatches(project.id, function (matches) {
                if (!isCurrentProject(project.id, loadingToken)) return;
                state.materialsByProject[project.id] = (state.materialsByProject[project.id] || items || []).map(function (item) {
                    var match = matches && matches[String(item.id)];
                    return match ? Object.assign({}, item, { warehouseMatch: match }) : item;
                });
                queueScheduleRender(state.stagesByProject[project.id] || []);
            });
        });
        loadMaterialInsights(project.id, function (insights) {
            if (!isCurrentProject(project.id, loadingToken)) return;
            queueScheduleRender(state.stagesByProject[project.id] || []);
        });
        loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function () {
            if (!isCurrentProject(project.id, loadingToken)) return;
            if (overviewPanel) {
                safeReplaceChildren(overviewPanel, renderProjectOverviewHero(project));
                refreshLucideIcons(overviewPanel);
                bindProjectOverviewActions();
            }
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
        var overviewStart = projectDisplayStartDate(project);
        var overviewDeadline = projectDisplayDeadlineDate(project);
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
                dataItem('Экономика', 'См. раздел «Финансы»') +
                dataItem('Дата договора', project.contract_date ? formatDisplayDate(project.contract_date) : '—') +
                dataItem('Старт', overviewStart ? formatDisplayDate(overviewStart) : '—') +
                dataItem('Дедлайн', overviewDeadline ? formatDisplayDate(overviewDeadline) : '—') +
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
                    '<b>Предпросмотр отчёта</b>' +
                    '<div class="assistant-confirm-list">' +
                        '<span>Сначала проверь, какие работы и материалы будут отмечены.</span>' +
                        '<span>После сохранения изменения сразу появятся в графике, работах и материалах объекта.</span>' +
                    '</div>' +
                    '<label class="check-inline report-confirm"><input type="checkbox" name="confirm_report" required> Подтверждаю сохранение отчёта; склад и факт заполняются отдельно</label>' +
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

    function legacyMaterialProgress(projectId, items) {
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

    function legacyWorkProgressForRows(projectId, sectionTitle, rows) {
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

    function sectionPresenceBadge(kind, label, progress) {
        progress = progress || { total: 0, done: 0 };
        var total = Number(progress.total || 0);
        var done = Number(progress.done || 0);
        var text = total ? (String(done) + ' \u0438\u0437 ' + String(total)) : '\u043d\u0435\u0442';
        return '<span class="section-presence-badge section-presence-badge-' + escapeHtml(kind) + (total ? '' : ' is-empty') + '">' +
            '<strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(text) + '</span>' +
        '</span>';
    }

    function sectionProgressLine(kind, label, progress, sectionId) {
        progress = progress || { total: 0, done: 0, percent: 0 };
        var total = Number(progress.total || 0);
        var done = Number(progress.done || 0);
        var percentValue = total ? percent(progress.percent != null ? progress.percent : Math.round((done / total) * 100)) : 0;
        return '<div class="estimate-section-progress-line estimate-section-progress-line-' + escapeHtml(kind) + '" data-progress-section-id="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '" data-section-progress="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '" data-section-progress-kind="' + escapeHtml(kind) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percentValue + '">' +
            '<div class="estimate-section-progress-line-head"><strong>' + escapeHtml(label) + '</strong><span data-progress-count>' + escapeHtml(total ? (String(done) + '\u0020\u0438\u0437\u0020' + String(total)) : '\u041f\u043e\u0437\u0438\u0446\u0438\u0439 \u043d\u0435\u0442') + '</span></div>' +
            '<div class="section-schedule-progress-bar"><span style="width:' + percentValue + '%"></span>' + (total ? '<b class="section-schedule-progress-value" data-progress-text>' + escapeHtml(String(percentValue)) + '%</b>' : '') + '</div>' +
        '</div>';
    }

    function sectionProgressStrip(workProgress, materialProgressValue, sectionId) {
        workProgress = workProgress || { total: 0, done: 0, percent: 0 };
        materialProgressValue = materialProgressValue || { total: 0, done: 0, percent: 0 };
        return '<div class="estimate-section-progress-strip estimate-section-progress-split" data-progress-split-section="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '">' +
            sectionProgressLine('material', '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b', materialProgressValue, sectionId) +
            sectionProgressLine('work', '\u0420\u0430\u0431\u043e\u0442\u044b', workProgress, sectionId) +
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
        var canEditActual = !!(canManageSchedule && canManageSchedule());
        var quantityInteraction = canEditActual ? ' data-work-quantity-open data-work-id="' + escapeHtml(item.id || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" role="button" tabindex="0" aria-label="' + escapeHtml('Внести выполненный объём: ' + String(item.title || 'Работа')) + '"' : '';
        return '<div class="section-work-check work-list-check' + (canEditActual ? ' work-quantity-row' : '') + (isDone ? ' is-done' : '') + '" data-item-id="' + escapeHtml(item.id || '') + '"' + quantityInteraction + '>' +
            '<span class="section-work-row-icon" aria-hidden="true"><i data-lucide="hard-hat"></i></span>' +
            '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '') + '</b><small>' + escapeHtml(formatWorkLine(item) || '\u041e\u0431\u044a\u0435\u043c \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d') + '</small></span>' +
        '</div>';
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
        var overviewMaterials = qs('[data-project-overview-materials]');
        var insights = state.materialInsightsByProject[projectId] || {};
        if (overviewMaterials) safeReplaceChildren(overviewMaterials, renderMaterials(materials, project.id, insights));
        var schedulePanel = qs('[data-panel="schedule"]');
        if (schedulePanel) safeReplaceChildren(schedulePanel, renderSchedulePanel(stages, project));
        bindProjectMarketToggles(projectId);
        bindProjectChainActions();
        bindSectionScheduleRefresh(projectId);
        bindSectionScheduleInteractions(projectId);
        bindActualQuantityInputs(projectId);
        if (PMBI.planning && typeof PMBI.planning.bindProjectScheduleViews === 'function') PMBI.planning.bindProjectScheduleViews(projectId);
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
            bindProjectMarketToggles(projectId);
            bindProjectChainActions();
            if (PMBI.planning && typeof PMBI.planning.bindProjectScheduleViews === 'function') PMBI.planning.bindProjectScheduleViews(projectId);
        }
    }

    function bindMaterialManualChecks(projectId) {
        installActualQuantityDelegates();
        qsa('[data-section-material-check]').forEach(function (input) {
            if (input.dataset.materialBound === '1') return;
            input.dataset.materialBound = '1';
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

    function reportQuantityFractionFromClause(text) {
        var normalized = normalizeReportText(text);
        var percentMatch = normalized.match(/(\d+(?:[\.,]\d+)?)\s*%/);
        if (percentMatch) {
            return Math.max(0, Math.min(1, normalizedQuantityNumber(percentMatch[1]) / 100));
        }
        if (/(^|\s)(?:половин[а-я]*|наполовину)(?=\s|$)/.test(normalized)) return 0.5;
        if (/(^|\s)(?:четверт[а-я]*)(?=\s|$)/.test(normalized)) return 0.25;
        if (/(^|\s)(?:трет[а-я]*)(?=\s|$)/.test(normalized)) return 1 / 3;
        return null;
    }

    function reportWorkQuantityMode(clauseText, item, qty) {
        var normalized = normalizeReportText(clauseText);
        var fraction = reportQuantityFractionFromClause(normalized);
        if (fraction != null) {
            return {
                mode: 'target_percent',
                value: Math.round(fraction * 100000) / 1000
            };
        }
        if (/(?:^|\s)\d+(?:[\.,]\d+)?\s*(?:из|\/|от)\s*\d+(?:[\.,]\d+)?(?:\s|$)/.test(normalized)
            || /(^|\s)(?:всего|итого|готово|факт|на данный момент)(?=\s|$)/.test(normalized)) {
            return { mode: 'target_qty', value: Number(qty || 0) };
        }
        if (Number(qty) > 0) return { mode: 'delta_qty', value: Number(qty) };
        var plan = quantityPlanInfo(item);
        return { mode: 'target_qty', value: Number(plan.totalQty || 0) };
    }

    function reportMaterialQuantityIntent(clauseText, item, qty) {
        var normalized = normalizeReportText(clauseText);
        var plan = quantityPlanInfo(item);
        var fraction = reportQuantityFractionFromClause(normalized);
        if (fraction != null && Number(plan.totalQty || 0) > 0) {
            return {
                mode: 'target_percent',
                value: Math.round(fraction * 100000) / 1000,
                targetQty: Number(plan.totalQty) * fraction
            };
        }
        if (Number(qty) > 0 && (
            /(?:^|\s)\d+(?:[\.,]\d+)?\s*(?:из|\/|от)\s*\d+(?:[\.,]\d+)?(?:\s|$)/.test(normalized)
            || /(^|\s)(?:всего|итого|факт|на данный момент)(?=\s|$)/.test(normalized)
        )) {
            return { mode: 'target_qty', value: Number(qty), targetQty: Number(qty) };
        }
        return { mode: 'delta_qty', value: Number(qty || 0), targetQty: null };
    }

    function reportHasOrderIntent(text) {
        var normalized = normalizeReportText(text);
        return /(^|\s)(?:заказ(?:ал(?:а|и)?|ан(?:а|о|ы)?|ать)?|оформил(?:а|и)?\s+заказ)(?=\s|$)/.test(normalized);
    }

    function reportHasPurchaseIntent(text) {
        var normalized = normalizeReportText(text);
        return reportHasOrderIntent(normalized)
            || /(^|\s)(?:купил(?:а|и)?|куплен(?:а|о|ы)?|закупил(?:а|и)?|закуплен(?:а|о|ы)?|приобрел(?:а|и)?|приобретен(?:а|о|ы)?|докупил(?:а|и)?|дозакупил(?:а|и)?)(?=\s|$)/.test(normalized);
    }

    function reportHasReceiptIntent(text) {
        var normalized = normalizeReportText(text);
        return /(^|\s)(?:завез(?:ла|ли|ен(?:а|о|ы)?)?|привез(?:ла|ли|ен(?:а|о|ы)?)?|доставил(?:а|и)?|доставлен(?:а|о|ы)?|получил(?:а|и)?|получен(?:а|о|ы)?|принял(?:а|и)?|принят(?:а|о|ы)?|отгрузил(?:а|и)?|отгружен(?:а|о|ы)?)(?=\s|$)/.test(normalized);
    }

    function reportHasUseIntent(text) {
        var normalized = normalizeReportText(text);
        return /(^|\s)(?:установил(?:а|и)?|установлен(?:а|о|ы)?|смонтировал(?:а|и)?|смонтирован(?:а|о|ы)?|монтировал(?:а|и)?|монтирован(?:а|о|ы)?|уложил(?:а|и)?|уложен(?:а|о|ы)?|использовал(?:а|и)?|использован(?:а|о|ы)?|потратил(?:а|и)?|израсходовал(?:а|и)?|расходовал(?:а|и)?|израсходован(?:а|о|ы)?|применил(?:а|и)?|применен(?:а|о|ы)?|передал(?:а|и)?|передан(?:а|о|ы)?|провел(?:а|и)?|проведен(?:а|о|ы)?|проложил(?:а|и)?|проложен(?:а|о|ы)?|поставил(?:а|и)?|поставлен(?:а|о|ы)?|подключил(?:а|и)?|подключен(?:а|о|ы)?)(?=\s|$)/.test(normalized);
    }

    function reportHasWorkCompletionIntent(text) {
        var normalized = normalizeReportText(text);
        if (!normalized) return false;
        if (/(сделал(?:и|а)?\s+заказ|оформил(?:и|а)?.*\sзаказ)/.test(normalized)) return false;
        if (/\d+(?:[\.,]\d+)?\s*%/.test(normalized)) return true;
        return /(^|\s)(?:сделал(?:и|а)?|выполнил(?:и|а)?|выполнен(?:а|о|ы)?|завершил(?:и|а)?|заверш[её]н(?:а|о|ы)?|закончил(?:и|а)?|закрыл(?:и|а)?|закрыт(?:а|о|ы)?|смонтировал(?:и|а)?|смонтирован(?:а|о|ы)?|установил(?:и|а)?|установлен(?:а|о|ы)?|уложил(?:и|а)?|уложен(?:а|о|ы)?|демонтировал(?:и|а)?|демонтирован(?:а|о|ы)?|покрасил(?:и|а)?|покрашен(?:а|о|ы)?|залил(?:и|а)?|залит(?:а|о|ы)?|подключил(?:и|а)?|подключ[её]н(?:а|о|ы)?|собрал(?:и|а)?|собран(?:а|о|ы)?|подготовил(?:и|а)?|подготовлен(?:а|о|ы)?|починил(?:и|а)?|отремонтировал(?:и|а)?|восстановил(?:и|а)?|убрал(?:и|а)?|пров[её]л(?:и|а)?|произв[её]л(?:и|а)?|готов(?:а|о|ы)?)(\s|$)/.test(normalized);
    }

    function reportTextClauses(value) {
        var clauses = String(value || '')
            .split(/\n|[.!?;]+|,\s*(?:и\s+)?(?=(?:там\s+)?(?:(?:дополнительно|также|потом|затем|еще|ещё)\s+)?(?:демонт|постав|куп|закуп|заказ|приобр|сдел|выполн|смонт|монт|установ|улож|использ|потрат|израсход|расход|примен|перед|привез|завез|достав|получ|закры|покрас|залил|подключ|собрал|подготов|почин|отремонт|восстанов|провел|провёл|произвел|произвёл|убрал))|\s+(?:и\s+)?(?=(?:(?:дополнительно|также|потом|затем|еще|ещё)\s+)?(?:купили|купил|закупили|заказали|заказал|приобрели|сделали|сделал|выполнили|выполнил|смонтировали|установили|уложили|использовали|использовал|потратили|потратил|израсходовали|израсходовал|расходовали|расходовал|демонтировали|покрасили|покрасил|залили|залил|подключили|подключил|собрали|собрал|подготовили|подготовил|починили|починил|отремонтировали|отремонтировал|восстановили|восстановил|провели|провел|провёл|произвели|произвел|произвёл|убрали|убрал|привезли|завезли|доставили|получили|приняли|ждем|ждём|планируем|будем)(?=\s|$))/i)
            .map(function (part) { return part.trim(); })
            .filter(Boolean);
        clauses = clauses.reduce(function (result, clause) {
            if (/^(?:дополнительно|также|потом|затем|еще|ещё|частично|наполовину|полностью)$/i.test(clause)) {
                result.push(clause);
                return result;
            }
            var previous = result[result.length - 1] || '';
            if (/^(?:дополнительно|также|потом|затем|еще|ещё|частично|наполовину|полностью)$/i.test(previous)) {
                result[result.length - 1] = previous + ' ' + clause;
            } else {
                result.push(clause);
            }
            return result;
        }, []);
        var actionWordPattern = /(?:^|\s)(купили|купил|купила|закупили|закупил|закупила|заказали|заказал|заказала|заказаны|заказан|заказана|заказано|приобрели|приобрел|приобрела|привезли|привез|привезла|завезли|завез|завезла|доставили|доставил|доставила|получили|получил|получила|приняли|принял|приняла|использовали|использовал|использовала|потратили|потратил|потратила|израсходовали|израсходовал|израсходовала|расходовали|расходовал|расходовала|передали|передал|передала|сделали|сделал|сделала|выполнили|выполнил|выполнила|смонтировали|смонтировал|смонтировала|смонтированы|смонтирован|смонтирована|смонтировано|установили|установил|установила|уложили|уложил|уложила|демонтировали|демонтировал|демонтировала|покрасили|покрасил|покрасила|залили|залил|залила|подключили|подключил|подключила|собрали|собрал|собрала|подготовили|подготовил|подготовила|починили|починил|починила|отремонтировали|отремонтировал|отремонтировала|восстановили|восстановил|восстановила|провели|провел|провёл|произвели|произвел|произвёл|убрали|убрал|убрала)(?=\s|$)/i;
        var quantityWithUnitPattern = /\d+(?:[\.,]\d+)?\s*(?:шт\.?|штук[аи]?|ед\.?|м(?:2|3|²|³)?|кв\.?\s*м|куб\.?\s*м|кг|т|л|компл(?:ект)?(?:ов|а)?|упак(?:овок|овки|овка)?)(?=\s|$)/i;
        var enumeratedBoundaryPattern = /(?:\s+(?:и|а)\s+|,\s*)(?=[^,.;!?]{0,72}\d+(?:[\.,]\d+)?\s*(?:шт\.?|штук[аи]?|ед\.?|м(?:2|3|²|³)?|кв\.?\s*м|куб\.?\s*м|кг|т|л|компл(?:ект)?(?:ов|а)?|упак(?:овок|овки|овка)?)(?=\s|$))/i;
        return clauses.reduce(function (result, clause) {
            var narrativeParts = String(clause || '').split(/,\s*(?=(?:(?:но|однако)\s+)?(?:он|она|оно|они|это)(?=\s|$))/i);
            narrativeParts.forEach(function (narrativePart) {
                var enumeratedParts = String(narrativePart || '').split(enumeratedBoundaryPattern).map(function (part) {
                    return part.trim();
                }).filter(Boolean);
                if (enumeratedParts.length < 2 || !quantityWithUnitPattern.test(enumeratedParts[0])) {
                    if (narrativePart.trim()) result.push(narrativePart.trim());
                    return;
                }
                var inheritedAction = '';
                enumeratedParts.forEach(function (part) {
                    var actionMatch = part.match(actionWordPattern);
                    if (actionMatch) inheritedAction = actionMatch[1];
                    else if (inheritedAction && quantityWithUnitPattern.test(part)) part = inheritedAction + ' ' + part;
                    result.push(part);
                });
            });
            return result;
        }, []);
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
        var outOfMatch = normalized.match(/(?:^|\s)(\d+(?:[\.,]\d+)?)\s*(?:из|\/|от)\s*(\d+(?:[\.,]\d+)?)(?:\s|$)/);
        if (outOfMatch) return normalizedQuantityNumber(outOfMatch[1]);
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
        if (!reportHasWorkCompletionIntent(clauseText)) return null;
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var planned = Number(candidate.item.planned_qty != null ? candidate.item.planned_qty : candidate.item.plannedQty || 0);
        var qty = reportQuantityFromClause(clauseText, candidate.item);
        var partial = reportHasPartialIntent(clauseText);
        if (planned > 0 && qty > 0 && qty < planned) partial = true;
        var quantityIntent = reportWorkQuantityMode(clauseText, candidate.item, qty);
        return {
            sectionTitle: candidate.sectionTitle,
            item: candidate.item,
            clauseText: clauseText,
            score: score,
            actualQty: qty,
            quantityLabel: reportWorkQuantityLabel(clauseText, candidate.item, qty),
            quantityMode: quantityIntent.mode,
            quantityValue: quantityIntent.value,
            actionEligible: planned > 0 && (qty > 0 || !partial),
            done: !partial,
            partial: partial
        };
    }

    function reportWorkQuantityLabel(clauseText, item, qty) {
        var percentMatch = String(clauseText || '').match(/(\d+(?:[\.,]\d+)?)\s*%/);
        if (percentMatch) return String(percentMatch[1]).replace(',', '.') + '%';
        if (!(Number(qty) > 0)) return '';
        var unit = String(item && item.unit || '').trim();
        return finalSectionSummaryNumber(qty) + (unit ? ' ' + unit : '');
    }

    function reportMaterialResultFromClause(clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var normalized = normalizeReportText(clauseText);
        var item = candidate.item;
        var qty = reportQuantityFromClause(clauseText, item);
        var planned = Number(item.plannedQty || item.planned_qty || 0);
        var purchasedAlready = Number(item.purchasedQty || item.purchased_qty || 0);
        var receivedAlready = Number(item.receivedQty || item.received_qty || 0);
        var usedAlready = Number(item.usedQty || item.used_qty || 0) + Number(item.writeoffQty || item.writeoff_qty || 0);
        var toOrder = Math.max(planned - Math.max(purchasedAlready, receivedAlready), 0);
        var toReceive = Math.max(Math.max(planned, purchasedAlready) - receivedAlready, 0);
        var onSite = Math.max(Number(item.stockBalanceQty != null ? item.stockBalanceQty : (receivedAlready - usedAlready)) || 0, 0);
        var purchase = reportHasPurchaseIntent(normalized);
        var receipt = reportHasReceiptIntent(normalized);
        var used = reportHasUseIntent(normalized);
        if (receipt && /поставк|отгруз/.test(normalized)) used = false;
        var targetFraction = reportQuantityFractionFromClause(normalized);
        if (targetFraction != null && planned > 0) {
            var targetQty = planned * targetFraction;
            if (purchase) qty = Math.max(targetQty - Math.max(purchasedAlready, receivedAlready), 0);
            else if (receipt) qty = Math.max(targetQty - receivedAlready, 0);
            else if (used) qty = Math.max(targetQty - usedAlready, 0);
        }
        if (!qty && targetFraction == null && purchase) qty = toOrder;
        if (!qty && targetFraction == null && receipt) qty = toReceive;
        if (!qty && targetFraction == null && used && reportHasWholeIntent(normalized)) qty = onSite;
        var purchasedQty = purchase ? Math.min(qty, planned > 0 ? toOrder : qty) : 0;
        var receivedQty = receipt ? Math.min(qty, (planned > 0 || purchasedAlready > 0) ? toReceive : qty) : 0;
        var usedQty = used ? Math.min(qty, onSite || qty) : 0;
        return {
            item: item,
            score: score,
            clauseText: clauseText,
            reportUnit: reportExplicitQuantityUnit(clauseText),
            actionEligible: purchasedQty > 0 || receivedQty > 0 || usedQty > 0,
            semanticMatch: purchase || receipt || used,
            purchasedQty: purchasedQty,
            receivedQty: receivedQty,
            usedQty: usedQty
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
                return '<div class="report-preview-section"><b>' + escapeHtml(sectionTitle) + '</b><span>' + escapeHtml(entry.item.title + ' - ' + bits.join(', ') + ' ' + reportEntryQuantityUnit(entry)) + '</span></div>';
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
                    '<b>Предпросмотр отчёта</b>' +
                    '<label class="report-confirm"><span>Подтверждаю сохранение отчёта; склад и факт заполняются отдельно</span><input type="checkbox" name="confirm_report" required></label>' +
                '</div>' +
                '<div class="form-error" data-log-error></div>' +
                '<div class="report-intake-actions">' +
                    '<button class="primary" type="submit">Сохранить отчет</button>' +
                '</div>' +
            '</form>' +
        '</section>';
    };

    function reportSuggestionKey(kind, candidate) {
        var item = candidate && candidate.item || {};
        return kind + ':' + String(item.id || normalizeReportText(item.title || 'position'));
    }

    function reportSuggestionSection(candidate, fallback) {
        var item = candidate && candidate.item || {};
        return String(candidate && candidate.sectionTitle || item.sectionTitle || item.section_title || item.stageTitle || fallback || '').trim();
    }

    function reportSuggestionScore(candidate, queryTokens, normalizedQuery) {
        var item = candidate && candidate.item || {};
        var title = normalizeReportText(item.title || '');
        var section = normalizeReportText(reportSuggestionSection(candidate, ''));
        var candidateTokens = Array.isArray(candidate && candidate.tokens) ? candidate.tokens : reportTokens(title);
        var score = 0;
        if (normalizedQuery.length >= 3 && title.indexOf(normalizedQuery) !== -1) score += 48;
        queryTokens.forEach(function (queryToken) {
            candidateTokens.forEach(function (candidateToken) {
                if (queryToken === candidateToken) score += 16;
                else if (queryToken.length >= 3 && (candidateToken.indexOf(queryToken) === 0 || queryToken.indexOf(candidateToken) === 0)) score += 8;
            });
            if (section.indexOf(queryToken) !== -1) score += 2;
        });
        return score;
    }

    function reportLiveSuggestions(projectId, rawText) {
        var clauses = reportTextClauses(rawText);
        var query = normalizeReportText(clauses.length ? clauses[clauses.length - 1] : rawText);
        var queryTokens = reportTokens(query);
        if (!query || query.length < 3 || !queryTokens.length) return [];
        var suggestions = [];
        workCandidatesForProject(projectId).forEach(function (candidate) {
            var score = reportSuggestionScore(candidate, queryTokens, query);
            if (score > 0) suggestions.push({ kind: 'work', candidate: candidate, score: score });
        });
        materialCandidatesForProject(projectId).forEach(function (candidate) {
            var score = reportSuggestionScore(candidate, queryTokens, query);
            if (score > 0) suggestions.push({ kind: 'material', candidate: candidate, score: score });
        });
        var seen = {};
        return suggestions.sort(function (left, right) {
            if (right.score !== left.score) return right.score - left.score;
            return String(left.candidate.item.title || '').localeCompare(String(right.candidate.item.title || ''), 'ru');
        }).filter(function (suggestion) {
            var key = reportSuggestionKey(suggestion.kind, suggestion.candidate);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        }).slice(0, 8);
    }

    function reportManualWorkEntry(candidate, rawText) {
        var manualSelection = arguments[2] || null;
        var progressSnapshot = arguments[3] || null;
        var item = candidate && candidate.item || {};
        var clauses = reportTextClauses(rawText);
        var clauseText = clauses.length ? clauses[clauses.length - 1] : rawText;
        var plan = quantityPlanInfo(item);
        var baseActualQty = clampActualQty(progressSnapshot && progressSnapshot.actual || 0, plan.totalQty);
        var resultActualQty = baseActualQty;
        var requestedQty = 0;
        var qty = clampActualQty(reportQuantityFromClause(clauseText, item), plan.totalQty);
        var hasCompletionIntent = reportHasWorkCompletionIntent(clauseText);
        var partial = reportHasPartialIntent(clauseText) || (plan.totalQty > 0 && qty > 0 && qty < plan.totalQty);
        var done = plan.totalQty > 0 && (qty >= plan.totalQty || (hasCompletionIntent && !qty && !partial));
        var appliedQty = done && plan.totalQty > 0 ? plan.totalQty : qty;
        var quantityIntent = appliedQty > 0
            ? reportWorkQuantityMode(clauseText, item, appliedQty)
            : { mode: 'delta_qty', value: 0 };
        var reportUnit = reportExplicitQuantityUnit(clauseText);
        if (manualSelection) {
            var manualMode = String(manualSelection.manualWorkMode || 'delta_qty');
            var manualValue = Math.max(0, Number(manualSelection.manualQty || 0));
            requestedQty = manualValue;
            reportUnit = reportNormalizeManualQuantityUnit(manualSelection.manualUnit) || reportUnit;
            if (manualMode === 'complete') {
                appliedQty = Number(plan.totalQty || 0);
                quantityIntent = { mode: 'target_qty', value: appliedQty };
                done = appliedQty > 0;
                partial = false;
                resultActualQty = appliedQty;
            } else if (manualMode === 'percent') {
                manualValue = Math.min(100, manualValue);
                if (manualValue > 0 && Number(plan.totalQty || 0) > 0) {
                    manualValue = Math.max(manualValue, baseActualQty / Number(plan.totalQty) * 100);
                }
                appliedQty = Number(plan.totalQty || 0) * manualValue / 100;
                quantityIntent = { mode: 'target_percent', value: manualValue };
                done = Number(plan.totalQty || 0) > 0 && appliedQty >= Number(plan.totalQty || 0);
                partial = appliedQty > 0 && !done;
                resultActualQty = appliedQty;
            } else if (manualMode === 'target_qty') {
                appliedQty = clampActualQty(manualValue, plan.totalQty);
                if (manualValue > 0 && Number(plan.totalQty || 0) > 0) appliedQty = Math.max(baseActualQty, appliedQty);
                quantityIntent = { mode: manualMode, value: appliedQty };
                resultActualQty = appliedQty;
                done = Number(plan.totalQty || 0) > 0 && resultActualQty >= Number(plan.totalQty || 0);
                partial = resultActualQty > 0 && !done;
            } else if (manualMode === 'delta_qty') {
                var hasWorkPlan = Number(plan.totalQty || 0) > 0;
                var remainingQty = hasWorkPlan ? Math.max(Number(plan.totalQty || 0) - baseActualQty, 0) : manualValue;
                appliedQty = hasWorkPlan
                    ? Math.min(clampActualQty(manualValue, plan.totalQty), remainingQty)
                    : manualValue;
                resultActualQty = hasWorkPlan
                    ? Math.min(Number(plan.totalQty || 0), baseActualQty + appliedQty)
                    : baseActualQty + appliedQty;
                quantityIntent = { mode: manualMode, value: appliedQty };
                done = hasWorkPlan ? resultActualQty >= Number(plan.totalQty || 0) : appliedQty > 0;
                partial = hasWorkPlan && resultActualQty > 0 && !done;
            } else {
                appliedQty = 0;
                quantityIntent = { mode: 'delta_qty', value: 0 };
                done = false;
                partial = false;
                resultActualQty = baseActualQty;
            }
            qty = appliedQty;
        }
        var quantityUnit = reportUnit || reportSafeQuantityUnit(item.unit);
        var quantityLabel = quantityIntent.mode === 'target_percent' && Number(quantityIntent.value) >= 0
            ? finalSectionSummaryNumber(quantityIntent.value) + '%'
            : (appliedQty > 0 ? finalSectionSummaryNumber(appliedQty) + (quantityUnit ? ' ' + quantityUnit : '') : '');
        var actionEligible = plan.totalQty > 0 && appliedQty > 0;
        if (manualSelection && (quantityIntent.mode === 'target_qty' || quantityIntent.mode === 'target_percent')) {
            actionEligible = appliedQty > baseActualQty;
        }
        return {
            sectionTitle: candidate && candidate.sectionTitle || item.sectionTitle || item.section_title || '',
            item: item,
            clauseText: clauseText,
            score: 100,
            actualQty: appliedQty,
            reportUnit: reportUnit,
            quantityLabel: manualSelection ? quantityLabel : reportWorkQuantityLabel(clauseText, item, qty),
            quantityMode: quantityIntent.mode,
            quantityValue: quantityIntent.value,
            requestedQty: requestedQty,
            baseActualQty: baseActualQty,
            resultActualQty: resultActualQty,
            actionEligible: actionEligible,
            done: done,
            partial: partial,
            ambiguous: false,
            selectedManually: true
        };
    }

    function reportManualMaterialEntry(candidate, rawText) {
        var manualSelection = arguments[2] || null;
        var item = candidate && candidate.item || {};
        var clauses = reportTextClauses(rawText);
        var clauseText = clauses.length ? clauses[clauses.length - 1] : rawText;
        var normalized = normalizeReportText(clauseText);
        var plan = quantityPlanInfo(item);
        var planned = Number(plan.totalQty || 0);
        var purchasedAlready = Number(item.purchasedQty || item.purchased_qty || 0);
        var receivedAlready = Number(item.receivedQty || item.received_qty || 0);
        var usedAlready = Number(item.usedQty || item.used_qty || 0) + Number(item.writeoffQty || item.writeoff_qty || 0);
        var purchaseMaxQty = Math.max(planned - Math.max(purchasedAlready, receivedAlready), 0);
        var receiptMaxQty = Math.max(planned - receivedAlready, 0);
        var useMaxQty = Math.max(Number(item.stockBalanceQty != null ? item.stockBalanceQty : (receivedAlready - usedAlready)) || 0, 0);
        var qty = reportQuantityFromClause(clauseText, item);
        var purchase = reportHasPurchaseIntent(normalized);
        var receipt = reportHasReceiptIntent(normalized);
        var used = reportHasUseIntent(normalized);
        if (receipt && /поставк|отгруз/.test(normalized)) used = false;
        var quantityIntent = reportMaterialQuantityIntent(clauseText, item, qty);
        var targetQty = quantityIntent.targetQty;
        var qualitativePartial = reportHasPartialIntent(normalized) && targetQty == null && !(qty > 0);
        var reportUnit = reportExplicitQuantityUnit(clauseText);
        if (manualSelection) {
            var manualAction = String(manualSelection.manualAction || '');
            purchase = manualAction === 'purchase';
            receipt = manualAction === 'receipt';
            used = manualAction === 'use';
            var manualValue = Math.max(0, Number(manualSelection.manualQty || 0));
            var manualMode = String(manualSelection.manualQuantityMode || 'delta_qty');
            reportUnit = reportNormalizeManualQuantityUnit(manualSelection.manualUnit) || reportUnit;
            qualitativePartial = false;
            if (manualMode === 'target_percent') {
                var manualPercent = Math.min(100, manualValue);
                targetQty = planned * manualPercent / 100;
                quantityIntent = { mode: 'target_percent', value: manualPercent, targetQty: targetQty };
            } else if (manualMode === 'target_qty') {
                targetQty = manualValue;
                quantityIntent = { mode: 'target_qty', value: manualValue, targetQty: targetQty };
            } else {
                targetQty = null;
                qty = manualValue;
                quantityIntent = { mode: 'delta_qty', value: manualValue, targetQty: null };
            }
        }
        if (targetQty != null && planned > 0) {
            if (purchase) qty = Math.max(targetQty - Math.max(purchasedAlready, receivedAlready), 0);
            else if (receipt) qty = Math.max(targetQty - receivedAlready, 0);
            else if (used) qty = Math.max(targetQty - usedAlready, 0);
        }
        if (!manualSelection && !qty && targetQty == null && purchase && !qualitativePartial) qty = purchaseMaxQty;
        if (!manualSelection && !qty && targetQty == null && receipt && !qualitativePartial) qty = receiptMaxQty;
        if (!manualSelection && !qty && targetQty == null && used && !qualitativePartial && reportHasWholeIntent(normalized)) qty = useMaxQty;
        return {
            item: item,
            clauseText: clauseText,
            reportUnit: reportUnit,
            ambiguous: false,
            actionEligible: Number(qty || 0) > 0 && (purchase || receipt || used) && !qualitativePartial,
            semanticMatch: purchase || receipt || used,
            purchaseIntent: purchase,
            receiptIntent: receipt,
            useIntent: used,
            quantityMode: quantityIntent.mode,
            quantityValue: quantityIntent.value,
            targetQty: targetQty,
            purchaseMaxQty: purchaseMaxQty,
            receiptMaxQty: receiptMaxQty,
            useMaxQty: useMaxQty,
            purchasedQty: purchase ? Math.min(qty, purchaseMaxQty || qty) : 0,
            receivedQty: receipt ? Math.min(qty, receiptMaxQty || qty) : 0,
            usedQty: used ? Math.min(qty, useMaxQty || qty) : 0,
            selectedManually: true
        };
    }

    function reportClearManualSelectionEffectOverrides(overrides, selected) {
        overrides = overrides || {};
        selected = selected || {};
        var item = selected.candidate && selected.candidate.item || {};
        var itemId = Number(item.id || 0);
        if (!(itemId > 0)) return overrides;
        var actionTypes = selected.kind === 'work'
            ? ['work_progress']
            : ['material_purchase', 'material_receipt', 'material_use'];
        actionTypes.forEach(function (actionType) {
            delete overrides[actionType + ':' + String(itemId)];
        });
        return overrides;
    }

    bindReportPreview = function () {
        qsa('[data-log-form]').forEach(function (form) {
            if (form.dataset.reportPreviewBound === '1') return;
            form.dataset.reportPreviewBound = '1';
            var previewRoot = ensureReportPreviewRoot(form);
            var workDone = form.work_done;
            var rawInput = form.raw_input;
            var titleInput = form.title;
            var liveAssist = qs('[data-report-live-assist]', form);
            var reviewCard = qs('[data-report-review]', form);
            var finalGroups = qs('[data-report-final-groups]', form);
            var finalText = qs('[data-report-final-text]', form);
            var finalSummary = qs('[data-report-final-summary]', form);
            var finalShift = qs('[data-report-final-shift]', form);
            var finalPhotos = qs('[data-report-final-photos]', form);
            var activeDraft = null;
            var activeRawText = '';
            var activeSuggestionsByKey = {};
            var manualSelections = {};
            var effectOverrides = {};

            function reportTextIsManual() {
                return !!(workDone && workDone.dataset.reportManual === '1');
            }

            function syncAuthorReportText(value, force) {
                if (!workDone || (!force && reportTextIsManual())) return;
                workDone.value = String(value || '');
                workDone.dataset.reportManual = '0';
                workDone.dataset.autogenerated = '1';
            }

            function createManualSelection(suggestion, clauseText) {
                var selected = Object.assign({}, suggestion || {});
                var candidate = selected.candidate || {};
                var item = candidate.item || {};
                var normalized = normalizeReportText(clauseText);
                var parsedQty = Math.max(0, Number(reportQuantityFromClause(clauseText, item) || 0));
                var explicitUnit = reportNormalizeManualQuantityUnit(reportExplicitQuantityUnit(clauseText));
                var catalogUnit = reportSafeQuantityUnit(item.unit);
                selected.clauseText = String(clauseText || '');
                selected.manualQty = '';
                selected.manualUnit = explicitUnit || catalogUnit || '';
                if (selected.kind === 'work') {
                    var fraction = reportQuantityFractionFromClause(normalized);
                    if (fraction != null) {
                        selected.manualWorkMode = 'percent';
                        selected.manualQty = finalSectionSummaryNumber(fraction * 100);
                    } else if (parsedQty > 0) {
                        var workIntent = reportWorkQuantityMode(clauseText, item, parsedQty);
                        selected.manualWorkMode = workIntent.mode === 'target_qty' ? 'target_qty' : 'delta_qty';
                        selected.manualQty = finalSectionSummaryNumber(workIntent.value || parsedQty);
                    } else if (reportHasWorkCompletionIntent(normalized) && !reportHasPartialIntent(normalized)) {
                        selected.manualWorkMode = 'complete';
                    } else selected.manualWorkMode = 'delta_qty';
                    return selected;
                }
                if (reportHasReceiptIntent(normalized)) selected.manualAction = 'receipt';
                else if (reportHasUseIntent(normalized)) selected.manualAction = 'use';
                else if (reportHasPurchaseIntent(normalized)) selected.manualAction = 'purchase';
                else selected.manualAction = '';
                var materialIntent = reportMaterialQuantityIntent(clauseText, item, parsedQty);
                selected.manualQuantityMode = materialIntent.mode || 'delta_qty';
                if (selected.manualQuantityMode === 'target_percent') {
                    selected.manualQty = finalSectionSummaryNumber(materialIntent.value || 0);
                } else if (parsedQty > 0) {
                    selected.manualQty = finalSectionSummaryNumber(parsedQty);
                }
                return selected;
            }

            function reportEffectOverrideKey(input) {
                if (!input) return '';
                return String(input.getAttribute('data-effect-kind') || '') + ':' + String(input.getAttribute('data-item-id') || '');
            }

            function captureEffectOverrides() {
                if (!previewRoot) return;
                qsa('[data-report-effect]', previewRoot).forEach(function (input) {
                    var key = reportEffectOverrideKey(input);
                    if (!key || /:$/.test(key)) return;
                    var card = input.closest ? input.closest('.report-effect-card') : null;
                    var qtyInput = card ? qs('[data-report-effect-qty]', card) : null;
                    effectOverrides[key] = {
                        key: key,
                        actionType: String(input.getAttribute('data-effect-kind') || ''),
                        itemId: Number(input.getAttribute('data-item-id') || 0),
                        checked: !!input.checked,
                        qty: Number(qtyInput ? qtyInput.value : input.getAttribute('data-effect-qty') || 0)
                    };
                });
            }

            function applyEffectOverrides() {
                if (!previewRoot) return;
                qsa('[data-report-effect]', previewRoot).forEach(function (input) {
                    var override = effectOverrides[reportEffectOverrideKey(input)];
                    if (!override) return;
                    input.checked = override.checked !== false;
                    var card = input.closest ? input.closest('.report-effect-card') : null;
                    var qtyInput = card ? qs('[data-report-effect-qty]', card) : null;
                    if (!qtyInput || !isFinite(Number(override.qty)) || Number(override.qty) <= 0) return;
                    var maxQty = Number(qtyInput.getAttribute('max') || input.getAttribute('data-effect-max') || 0);
                    qtyInput.value = String(maxQty > 0 ? Math.min(Number(override.qty), maxQty) : Number(override.qty));
                });
            }

            function notifyReportDraftChanged() {
                if (form._reportDraftRestoring || form._reportDraftSuppress) return;
                form.dispatchEvent(new CustomEvent('pmbi:report-draft-changed', { bubbles: true }));
            }

            function manualWorkControlState(selected) {
                selected = selected || {};
                var candidate = selected.candidate || {};
                var item = candidate.item || {};
                var planTotal = reportEntryPlanTotal(item);
                var sectionTitle = candidate.sectionTitle || candidate.stageTitle || item.sectionTitle || item.section_title || '';
                var projectId = Number(form.project_id && form.project_id.value || 0);
                var progress = workActualProgress(projectId, sectionTitle, item);
                var baseQty = Math.max(0, Number(progress.actual || 0));
                var remainingBefore = planTotal > 0 ? Math.max(planTotal - baseQty, 0) : 0;
                var mode = String(selected.manualWorkMode || 'delta_qty');
                var rawValue = String(selected.manualQty == null ? '' : selected.manualQty).trim();
                var requestedQty = rawValue === '' ? 0 : Math.max(0, Number(rawValue) || 0);
                var appliedQty = requestedQty;
                var resultQty = baseQty;
                if (mode === 'delta_qty') {
                    if (planTotal > 0) appliedQty = Math.min(requestedQty, remainingBefore);
                    resultQty = baseQty + appliedQty;
                } else if (mode === 'target_qty') {
                    resultQty = planTotal > 0 ? Math.min(requestedQty, planTotal) : requestedQty;
                } else if (mode === 'percent') {
                    appliedQty = Math.min(100, requestedQty);
                    resultQty = planTotal > 0 ? planTotal * appliedQty / 100 : 0;
                } else if (mode === 'complete') {
                    resultQty = planTotal;
                }
                var requestedResultQty = resultQty;
                if (planTotal > 0) resultQty = Math.min(planTotal, Math.max(baseQty, resultQty));
                var unit = reportSafeQuantityUnit(item.unit) || reportNormalizeManualQuantityUnit(selected.manualUnit) || 'ед.';
                var remainingAfter = planTotal > 0 ? Math.max(planTotal - resultQty, 0) : 0;
                return {
                    planTotal: planTotal,
                    unit: unit,
                    mode: mode,
                    requestedQty: requestedQty,
                    appliedQty: appliedQty,
                    baseQty: baseQty,
                    resultQty: resultQty,
                    remainingBefore: remainingBefore,
                    remainingAfter: remainingAfter,
                    limited: mode === 'delta_qty' && planTotal > 0 && requestedQty > remainingBefore,
                    belowCurrent: rawValue !== '' && planTotal > 0 &&
                        (mode === 'target_qty' || mode === 'percent') && requestedResultQty < baseQty,
                    minimumValue: mode === 'percent' && planTotal > 0 ? baseQty / planTotal * 100 : baseQty,
                    planCopy: planTotal > 0
                        ? 'План: ' + finalSectionSummaryNumber(planTotal) + ' ' + unit + ' · до отчёта: ' + finalSectionSummaryNumber(baseQty) + ' ' + unit + ' · остаток: ' + finalSectionSummaryNumber(remainingBefore) + ' ' + unit
                        : '',
                    resultCopy: planTotal > 0 && mode !== 'report' && (requestedQty > 0 || mode === 'complete')
                        ? 'После отчёта: ' + finalSectionSummaryNumber(resultQty) + ' ' + unit + (remainingAfter > 0 ? ' · останется ' + finalSectionSummaryNumber(remainingAfter) + ' ' + unit : ' · план выполнен')
                        : ''
                };
            }

            function normalizeManualWorkSelection(selected) {
                if (!selected || selected.kind !== 'work') return null;
                var controlState = manualWorkControlState(selected);
                if (controlState.limited) {
                    selected.manualQty = finalSectionSummaryNumber(controlState.appliedQty);
                    selected.manualLimitNotice = 'Введено ' + finalSectionSummaryNumber(controlState.requestedQty) + ' ' + controlState.unit + ' — учтён доступный остаток ' + finalSectionSummaryNumber(controlState.appliedQty) + ' ' + controlState.unit + '.';
                } else if (controlState.belowCurrent) {
                    selected.manualQty = finalSectionSummaryNumber(controlState.minimumValue);
                    selected.manualLimitNotice = controlState.mode === 'percent'
                        ? 'Уже выполнено ' + finalSectionSummaryNumber(controlState.minimumValue) + '% — готовность не может быть ниже текущей.'
                        : 'Уже выполнено ' + finalSectionSummaryNumber(controlState.baseQty) + ' ' + controlState.unit + ' — общий объём не может быть ниже текущего.';
                } else {
                    return controlState;
                }
                return manualWorkControlState(selected);
            }

            function refreshManualWorkControlCopy(row, selected) {
                if (!row || !selected || selected.kind !== 'work') return;
                var controlState = manualWorkControlState(selected);
                var planNode = qs('[data-report-work-plan]', row);
                var resultNode = qs('[data-report-work-result]', row);
                var limitNode = qs('[data-report-manual-limit]', row);
                if (planNode) planNode.textContent = controlState.planCopy;
                if (resultNode) {
                    resultNode.textContent = controlState.resultCopy;
                    resultNode.hidden = !controlState.resultCopy;
                }
                if (limitNode) {
                    limitNode.textContent = String(selected.manualLimitNotice || '');
                    limitNode.hidden = !selected.manualLimitNotice;
                }
            }

            function reportPreviewDraftSnapshot() {
                captureEffectOverrides();
                var selections = Object.keys(manualSelections).map(function (key) {
                    var selected = manualSelections[key] || {};
                    var candidate = selected.candidate || {};
                    var item = candidate.item || {};
                    var itemSnapshot = {};
                    Object.keys(item).forEach(function (itemKey) {
                        var value = item[itemKey];
                        if (value == null || ['string', 'number', 'boolean'].indexOf(typeof value) !== -1) itemSnapshot[itemKey] = value;
                    });
                    return {
                        key: key,
                        kind: selected.kind === 'work' ? 'work' : 'material',
                        clauseText: String(selected.clauseText || ''),
                        sectionTitle: String(candidate.sectionTitle || candidate.stageTitle || ''),
                        manualAction: String(selected.manualAction || ''),
                        manualWorkMode: String(selected.manualWorkMode || ''),
                        manualQuantityMode: String(selected.manualQuantityMode || ''),
                        manualQty: String(selected.manualQty == null ? '' : selected.manualQty),
                        manualUnit: String(selected.manualUnit || ''),
                        item: itemSnapshot
                    };
                });
                return {
                    manualSelections: selections,
                    effectOverrides: Object.keys(effectOverrides).map(function (key) { return effectOverrides[key]; })
                };
            }

            function restoreReportPreviewDraft(snapshot) {
                snapshot = snapshot || {};
                manualSelections = {};
                (Array.isArray(snapshot.manualSelections) ? snapshot.manualSelections : []).slice(0, 12).forEach(function (entry) {
                    if (!entry || !entry.key || !entry.item || (!entry.item.id && !entry.item.title)) return;
                    var restored = createManualSelection({
                        kind: entry.kind === 'work' ? 'work' : 'material',
                        candidate: {
                            sectionTitle: String(entry.sectionTitle || ''),
                            item: entry.item
                        }
                    }, String(entry.clauseText || ''));
                    if (entry.manualAction) restored.manualAction = String(entry.manualAction);
                    if (entry.manualWorkMode) restored.manualWorkMode = String(entry.manualWorkMode);
                    if (entry.manualQuantityMode) restored.manualQuantityMode = String(entry.manualQuantityMode);
                    if (restored.kind === 'work' && restored.manualWorkMode === 'report') restored.manualWorkMode = 'delta_qty';
                    if (restored.kind === 'material' && restored.manualAction === 'report') restored.manualAction = '';
                    if (entry.manualQty != null) restored.manualQty = String(entry.manualQty);
                    if (entry.manualUnit != null) restored.manualUnit = reportNormalizeManualQuantityUnit(entry.manualUnit);
                    normalizeManualWorkSelection(restored);
                    manualSelections[String(entry.key)] = restored;
                });
                effectOverrides = {};
                (Array.isArray(snapshot.effectOverrides) ? snapshot.effectOverrides : []).slice(0, 24).forEach(function (entry) {
                    if (!entry || !entry.actionType || !(Number(entry.itemId) > 0)) return;
                    var key = String(entry.actionType) + ':' + String(Number(entry.itemId));
                    effectOverrides[key] = {
                        key: key,
                        actionType: String(entry.actionType),
                        itemId: Number(entry.itemId),
                        checked: entry.checked !== false,
                        qty: Number(entry.qty || 0)
                    };
                });
                refreshPreview({ skipCapture: true });
            }

            function sameSuggestionEntry(entry, selected) {
                var entryItem = entry && entry.item || {};
                var selectedItem = selected && selected.candidate && selected.candidate.item || {};
                if (entryItem.id && selectedItem.id) return Number(entryItem.id) === Number(selectedItem.id);
                return normalizeReportText(entryItem.title || '') === normalizeReportText(selectedItem.title || '');
            }

            function manualMaterialChoicesByClause() {
                var choices = {};
                Object.keys(manualSelections).forEach(function (key) {
                    var selected = manualSelections[key];
                    var item = selected && selected.candidate && selected.candidate.item || {};
                    var clauseKey = normalizeReportText(selected && selected.clauseText || '');
                    if (selected && selected.kind === 'material' && clauseKey && Number(item.id || 0) > 0) {
                        choices[clauseKey] = Number(item.id);
                    }
                });
                return choices;
            }

            function manualWorkChoicesByClause() {
                var choices = {};
                Object.keys(manualSelections).forEach(function (key) {
                    var selected = manualSelections[key];
                    var item = selected && selected.candidate && selected.candidate.item || {};
                    var clauseKey = normalizeReportText(selected && selected.clauseText || '');
                    if (selected && selected.kind === 'work' && clauseKey && Number(item.id || 0) > 0) {
                        choices[clauseKey] = Number(item.id);
                    }
                });
                return choices;
            }

            function mergeManualSelections(draft, rawText) {
                pruneProjectReportManualSelections(manualSelections, rawText);
                var clauses = reportTextClauses(rawText);
                var latestClause = clauses.length ? clauses[clauses.length - 1] : rawText;
                var projectId = Number(form.project_id && form.project_id.value || 0);
                Object.keys(manualSelections).forEach(function (key) {
                    var selected = manualSelections[key];
                    if (!selected || !selected.candidate) return;
                    var selectedClause = String(selected.clauseText || latestClause || rawText).trim();
                    if (selected.kind === 'work') {
                        var existingWork = draft.workMatches.find(function (entry) { return sameSuggestionEntry(entry, selected); });
                        var selectedItem = selected.candidate.item || {};
                        var selectedSection = selected.candidate.sectionTitle || selectedItem.sectionTitle || selectedItem.section_title || '';
                        var manualWorkProgress = workActualProgress(projectId, selectedSection, selectedItem);
                        var manualWork = reportManualWorkEntry(selected.candidate, selectedClause, selected, manualWorkProgress);
                        if (existingWork) {
                            existingWork.selectedManually = true;
                            existingWork.ambiguous = false;
                            if (!existingWork.clauseText) existingWork.clauseText = selectedClause;
                            if (Array.isArray(existingWork.clauseTexts) && selectedClause && existingWork.clauseTexts.indexOf(selectedClause) === -1) existingWork.clauseTexts.push(selectedClause);
                            ['actualQty', 'reportUnit', 'quantityLabel', 'quantityMode', 'quantityValue', 'requestedQty', 'baseActualQty', 'resultActualQty', 'actionEligible', 'done', 'partial'].forEach(function (property) {
                                existingWork[property] = manualWork[property];
                            });
                            return;
                        }
                        draft.workMatches.push(manualWork);
                        return;
                    }
                    var existingMaterial = draft.materialMatches.find(function (entry) { return sameSuggestionEntry(entry, selected); });
                    var manualMaterial = reportManualMaterialEntry(selected.candidate, selectedClause, selected);
                    if (existingMaterial) {
                        existingMaterial.selectedManually = true;
                        existingMaterial.ambiguous = false;
                        if (!Array.isArray(existingMaterial.clauseTexts)) existingMaterial.clauseTexts = [];
                        if (!Array.isArray(existingMaterial.consumedClauseTexts)) existingMaterial.consumedClauseTexts = [];
                        if (selectedClause && existingMaterial.clauseTexts.indexOf(selectedClause) === -1) existingMaterial.clauseTexts.push(selectedClause);
                        if (selectedClause && existingMaterial.consumedClauseTexts.indexOf(selectedClause) === -1) existingMaterial.consumedClauseTexts.push(selectedClause);
                        ['reportUnit', 'actionEligible', 'semanticMatch', 'purchaseIntent', 'receiptIntent', 'useIntent', 'quantityMode', 'quantityValue', 'targetQty', 'purchaseMaxQty', 'receiptMaxQty', 'useMaxQty', 'purchasedQty', 'receivedQty', 'usedQty'].forEach(function (property) {
                            existingMaterial[property] = manualMaterial[property];
                        });
                        return;
                    }
                    draft.materialMatches.push(manualMaterial);
                });
                draft.text = buildProjectReportTextFromMatches(rawText, draft.workMatches, draft.materialMatches);
                draft.unmatchedClauses = projectReportUnmatchedClauses(rawText, draft.workMatches, draft.materialMatches);
                draft.previewAdditionalClauses = projectReportPreviewAdditionalClauses(rawText, draft.workMatches, draft.materialMatches);
                return draft;
            }

            function renderLiveAssist(rawText) {
                if (!liveAssist) return;
                var projectId = Number(form.project_id && form.project_id.value || 0);
                var suggestions = reportLiveSuggestions(projectId, rawText).filter(function (suggestion) {
                    return !manualSelections[reportSuggestionKey(suggestion.kind, suggestion.candidate)];
                });
                activeSuggestionsByKey = {};
                suggestions.forEach(function (suggestion) {
                    activeSuggestionsByKey[reportSuggestionKey(suggestion.kind, suggestion.candidate)] = suggestion;
                });
                function selectedOption(value, currentValue, label) {
                    return '<option value="' + escapeHtml(value) + '"' + (String(value) === String(currentValue) ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
                }
                function manualSelectionControls(selected, key, item) {
                    var planTotal = reportEntryPlanTotal(item);
                    var selectedUnit = reportSafeQuantityUnit(item.unit) || reportNormalizeManualQuantityUnit(selected.manualUnit) || 'ед.';
                    var maxAttribute = planTotal > 0 ? ' max="' + escapeHtml(planTotal) + '"' : '';
                    if (selected.kind === 'work') {
                        normalizeManualWorkSelection(selected);
                        var qtyValue = String(selected.manualQty == null ? '' : selected.manualQty);
                        var workMode = String(selected.manualWorkMode || 'delta_qty');
                        var isPercent = workMode === 'percent';
                        var workControlState = manualWorkControlState(selected);
                        var workMax = workMode === 'delta_qty' && planTotal > 0 ? workControlState.remainingBefore : planTotal;
                        var qtyMax = isPercent ? ' max="100"' : (workMax >= 0 && planTotal > 0 ? ' max="' + escapeHtml(workMax) + '"' : '');
                        var workMin = planTotal > 0 && (workMode === 'target_qty' || workMode === 'percent')
                            ? workControlState.minimumValue
                            : 0;
                        return '<div class="report-live-picked-controls is-work">' +
                            '<label><span>Количество</span><span class="report-live-picked-number"><input type="number" min="' + escapeHtml(finalSectionSummaryNumber(workMin)) + '"' + qtyMax + ' step="0.001" value="' + escapeHtml(qtyValue) + '" data-report-manual-qty aria-label="Количество работы: ' + escapeHtml(item.title || 'работа') + '"' + (workMode === 'complete' ? ' disabled' : '') + '><em>' + escapeHtml(isPercent ? '%' : selectedUnit) + '</em></span></label>' +
                            (workControlState.planCopy ? '<div class="report-live-picked-progress"><small class="report-live-picked-plan" data-report-work-plan>' + escapeHtml(workControlState.planCopy) + '</small><small class="report-live-picked-result" data-report-work-result' + (workControlState.resultCopy ? '' : ' hidden') + '>' + escapeHtml(workControlState.resultCopy) + '</small><small class="report-live-picked-limit" data-report-manual-limit' + (selected.manualLimitNotice ? '' : ' hidden') + '>' + escapeHtml(selected.manualLimitNotice || '') + '</small></div>' : '') +
                        '</div>';
                    }
                    var qtyValue = String(selected.manualQty == null ? '' : selected.manualQty);
                    var action = String(selected.manualAction || '');
                    var quantityMode = String(selected.manualQuantityMode || 'delta_qty');
                    var materialPercent = quantityMode === 'target_percent';
                    return '<div class="report-live-picked-controls is-material">' +
                        '<label><span>Действие</span><select data-report-manual-action aria-label="Действие с материалом: ' + escapeHtml(item.title || 'материал') + '">' +
                            '<option value=""' + (action ? '' : ' selected') + ' disabled>Выберите действие</option>' +
                            selectedOption('purchase', action, 'Куплено / заказано') +
                            selectedOption('receipt', action, 'Принято на объект') +
                            selectedOption('use', action, 'Передано в работу') +
                        '</select></label>' +
                        '<label><span>Количество</span><span class="report-live-picked-number"><input type="number" min="0"' + (materialPercent ? ' max="100"' : maxAttribute) + ' step="0.001" value="' + escapeHtml(qtyValue) + '" data-report-manual-qty aria-label="Количество материала: ' + escapeHtml(item.title || 'материал') + '"><em>' + escapeHtml(materialPercent ? '%' : selectedUnit) + '</em></span></label>' +
                        (!action ? '<small class="report-live-picked-action-note"><i data-lucide="circle-alert" aria-hidden="true"></i>Укажите, что сделали с материалом</small>' : '') +
                        (planTotal > 0 ? '<div class="report-live-picked-progress"><small class="report-live-picked-plan">План: ' + escapeHtml(finalSectionSummaryNumber(planTotal)) + ' ' + escapeHtml(selectedUnit) + '</small></div>' : '') +
                    '</div>';
                }
                var selectedItems = Object.keys(manualSelections).map(function (key) {
                    var selected = manualSelections[key];
                    var item = selected.candidate.item || {};
                    var label = selected.kind === 'work' ? 'Работа' : 'Материал';
                    return '<div class="report-live-picked-item is-' + selected.kind + '" data-report-manual-row data-report-manual-key="' + escapeHtml(key) + '"><small>' + label + '</small><b>' + escapeHtml(item.title || 'Позиция') + '</b><button type="button" data-report-suggestion-remove="' + escapeHtml(key) + '" aria-label="Убрать позицию ' + escapeHtml(item.title || '') + '"><i data-lucide="x" aria-hidden="true"></i></button>' + manualSelectionControls(selected, key, item) + '</div>';
                }).join('');
                var suggestionsHtml = suggestions.map(function (suggestion) {
                    var item = suggestion.candidate.item || {};
                    var key = reportSuggestionKey(suggestion.kind, suggestion.candidate);
                    var label = suggestion.kind === 'work' ? 'Работа' : 'Материал';
                    var section = reportSuggestionSection(suggestion.candidate, suggestion.kind === 'work' ? 'График работ' : 'Смета материалов');
                    var safeUnit = suggestion.kind === 'material' ? reportSafeQuantityUnit(item.unit) : '';
                    var unit = safeUnit ? (' · ' + safeUnit) : '';
                    return '<button class="report-live-suggestion is-' + suggestion.kind + '" type="button" data-report-suggestion="' + escapeHtml(key) + '">' +
                        '<span class="report-live-kind">' + label + '</span>' +
                        '<span class="report-live-copy"><b>' + escapeHtml(item.title || 'Позиция') + '</b><small>' + escapeHtml(section + unit) + '</small></span>' +
                        '<span class="report-live-add" aria-hidden="true"><i data-lucide="plus"></i></span>' +
                    '</button>';
                }).join('');
                var hasQuery = normalizeReportText(rawText).length >= 3;
                liveAssist.hidden = !selectedItems && !hasQuery;
                if (liveAssist.hidden) {
                    liveAssist.innerHTML = '';
                    return;
                }
                liveAssist.innerHTML =
                    '<div class="report-live-assist-head"><div><b>Подсказки по объекту</b><span>Выберите, что вы имели в виду</span></div><small>' + (suggestions.length ? ('Найдено: ' + suggestions.length) : 'Можно продолжить ввод') + '</small></div>' +
                    (selectedItems ? '<div class="report-live-picked">' + selectedItems + '</div>' : '') +
                    (suggestionsHtml ? '<div class="report-live-suggestions">' + suggestionsHtml + '</div>' : '<div class="report-live-empty">Совпадений пока нет. Продолжайте писать название работы или материала.</div>');
                refreshLucideIcons(liveAssist);
            }
            function refreshStructuredFinalReport() {
                if (!finalGroups || !activeDraft) return;
                finalGroups.innerHTML = renderStructuredFinalReportHtml(
                    activeDraft,
                    form.blockers && form.blockers.value || '',
                    form.next_steps && form.next_steps.value || ''
                );
                if (finalText && finalText === workDone) syncAuthorReportText(activeRawText);
                var workforceRows = qsa('[data-report-resource-row="workforce"]', form).map(function (row) {
                    var label = qs('[data-report-resource-label]', row);
                    var count = qs('[data-report-resource-count]', row);
                    var hours = qs('[data-report-resource-hours]', row);
                    var names = qs('[data-report-resource-names]', row);
                    return {
                        label: String(label && label.value || '').trim(),
                        count: Math.max(0, Number(count && count.value || 0)),
                        hours: Math.max(0, Number(hours && hours.value || 0)),
                        names: String(names && names.value || '').split(/[\r\n;]+/).map(function (name) { return name.replace(/\s+/g, ' ').trim(); }).filter(Boolean)
                    };
                }).filter(function (entry) { return entry.label && entry.count > 0; });
                var equipmentRows = qsa('[data-report-resource-row="equipment"]', form).map(function (row) {
                    var label = qs('[data-report-resource-label]', row);
                    var count = qs('[data-report-resource-count]', row);
                    var hours = qs('[data-report-resource-hours]', row);
                    return {
                        label: String(label && label.value || '').trim(),
                        count: Math.max(0, Number(count && count.value || 0)),
                        hours: Math.max(0, Number(hours && hours.value || 0))
                    };
                }).filter(function (entry) { return entry.label && entry.count > 0; });
                var workforceCount = workforceRows.reduce(function (sum, entry) { return sum + entry.count; }, 0);
                var equipmentCount = equipmentRows.reduce(function (sum, entry) { return sum + entry.count; }, 0);
                var photoDrafts = (Array.isArray(form._reportPhotoDrafts) ? form._reportPhotoDrafts : []).filter(function (draft) {
                    return draft && !draft.removed && draft.status !== 'error' && draft.status !== 'upload-error';
                });
                if (finalSummary) {
                    var reportDate = form.report_date && form.report_date.value ? formatRuDate(form.report_date.value) : 'Без даты';
                    var visibility = form.is_client_visible && form.is_client_visible.options && form.is_client_visible.selectedIndex >= 0
                        ? form.is_client_visible.options[form.is_client_visible.selectedIndex].textContent
                        : 'Команде';
                    var blockerCount = reportTextClauses(form.blockers && form.blockers.value || '').length;
                    var chips = [
                        ['calendar-days', reportDate],
                        [form.is_client_visible && form.is_client_visible.value === '0' ? 'lock-keyhole' : 'eye', visibility]
                    ];
                    if (workforceCount > 0) chips.push(['users', workforceCount + ' чел.']);
                    if (equipmentCount > 0) chips.push(['truck', equipmentCount + ' ед. техники']);
                    chips.push(['image', photoDrafts.length + ' фото']);
                    if (blockerCount) chips.push(['octagon-alert', blockerCount + ' блок.']);
                    finalSummary.innerHTML = chips.map(function (chip) {
                        return '<span><i data-lucide="' + escapeHtml(chip[0]) + '" aria-hidden="true"></i>' + escapeHtml(chip[1]) + '</span>';
                    }).join('');
                }
                if (finalShift) {
                    var shiftRows = workforceRows.map(function (entry) {
                        var namesCopy = entry.names.length ? '<span class="report-final-worker-names">' + entry.names.map(function (name) { return '<em>' + escapeHtml(name) + '</em>'; }).join('') + '</span>' : '';
                        return '<li><span class="report-final-row-copy"><b>' + escapeHtml(entry.label) + '</b><small>' + escapeHtml(finalSectionSummaryNumber(entry.count) + ' чел. · ' + finalSectionSummaryNumber(entry.hours) + ' ч/чел. · ' + finalSectionSummaryNumber(entry.count * entry.hours) + ' чел.-ч') + '</small>' + namesCopy + '</span></li>';
                    }).concat(equipmentRows.map(function (entry) {
                        return '<li><span class="report-final-row-copy"><b>' + escapeHtml(entry.label) + '</b><small>' + escapeHtml(finalSectionSummaryNumber(entry.count) + ' ед. · ' + finalSectionSummaryNumber(entry.hours) + ' ч · ' + finalSectionSummaryNumber(entry.count * entry.hours) + ' маш.-ч') + '</small></span></li>';
                    }));
                    finalShift.innerHTML = shiftRows.length
                        ? '<section class="report-final-group is-shift" data-report-final-section="shift"><div class="report-final-group-head"><span aria-hidden="true"><i data-lucide="users-round"></i></span><div><b>Состав смены</b><small>' + escapeHtml(shiftRows.length) + '</small></div></div><ul class="report-final-list">' + shiftRows.join('') + '</ul></section>'
                        : '';
                }
                if (finalPhotos) {
                    var photoLinks = photoDrafts.filter(function (draft) { return !!draft.url; }).map(function (draft, index) {
                        return '<a href="' + escapeHtml(draft.url) + '" target="_blank" rel="noopener" aria-label="Открыть фотографию ' + escapeHtml(index + 1) + '"><img src="' + escapeHtml(draft.url) + '" alt=""></a>';
                    });
                    finalPhotos.innerHTML = photoDrafts.length
                        ? '<section class="report-final-photo-section" data-report-final-section="photos"><div class="report-final-group-head"><span aria-hidden="true"><i data-lucide="images"></i></span><div><b>Фотографии</b><small>' + escapeHtml(photoDrafts.length) + '</small></div></div>' + (photoLinks.length ? '<div class="report-final-photo-grid">' + photoLinks.join('') + '</div>' : '<small class="report-final-photo-processing">Фотографии подготавливаются…</small>') + '</section>'
                        : '';
                }
                refreshLucideIcons(finalGroups);
                if (finalSummary) refreshLucideIcons(finalSummary);
                if (finalShift) refreshLucideIcons(finalShift);
                if (finalPhotos) refreshLucideIcons(finalPhotos);
            }
            function syncReportTextFromEffectQuantities() {
                if (!previewRoot || !activeDraft) return;
                qsa('[data-report-effect]', previewRoot).forEach(function (input) {
                    var itemId = Number(input.getAttribute('data-item-id') || 0);
                    var kind = input.getAttribute('data-effect-kind') || '';
                    var card = input.closest ? input.closest('.report-effect-card') : null;
                    var qtyInput = card ? qs('[data-report-effect-qty]', card) : null;
                    var qty = Number(qtyInput ? qtyInput.value : input.getAttribute('data-effect-qty') || 0);
                    if (!isFinite(qty) || qty < 0) return;
                    if (kind === 'work_progress') {
                        var workEntry = (activeDraft.workMatches || []).find(function (candidate) {
                            return Number(candidate && candidate.item && candidate.item.id || 0) === itemId && !candidate.ambiguous;
                        });
                        var originalQty = Number(input.getAttribute('data-original-effect-qty') || 0);
                        if (workEntry) {
                            if (!workEntry._effectOriginal) {
                                workEntry._effectOriginal = {
                                    actualQty: workEntry.actualQty,
                                    quantityMode: workEntry.quantityMode,
                                    quantityValue: workEntry.quantityValue,
                                    quantityLabel: workEntry.quantityLabel,
                                    resultActualQty: workEntry.resultActualQty,
                                    done: workEntry.done,
                                    partial: workEntry.partial
                                };
                            }
                            if (Math.abs(qty - originalQty) > 1e-9) {
                                workEntry.actualQty = qty;
                                workEntry.quantityMode = 'delta_qty';
                                workEntry.quantityValue = qty;
                                workEntry.quantityLabel = reportWorkQuantityLabel('', workEntry.item || {}, qty);
                                workEntry.resultActualQty = Math.max(0, Number(workEntry.baseActualQty || 0)) + qty;
                                var workPlanTotal = reportEntryPlanTotal(workEntry);
                                workEntry.done = workPlanTotal > 0 && workEntry.resultActualQty >= workPlanTotal;
                                workEntry.partial = workEntry.resultActualQty > 0 && !workEntry.done;
                            } else {
                                workEntry.actualQty = workEntry._effectOriginal.actualQty;
                                workEntry.quantityMode = workEntry._effectOriginal.quantityMode;
                                workEntry.quantityValue = workEntry._effectOriginal.quantityValue;
                                workEntry.quantityLabel = workEntry._effectOriginal.quantityLabel;
                                workEntry.resultActualQty = workEntry._effectOriginal.resultActualQty;
                                workEntry.done = workEntry._effectOriginal.done;
                                workEntry.partial = workEntry._effectOriginal.partial;
                            }
                        }
                        return;
                    }
                    var entry = (activeDraft.materialMatches || []).find(function (candidate) {
                        return Number(candidate && candidate.item && candidate.item.id || 0) === itemId;
                    });
                    if (!entry) return;
                    if (kind === 'material_purchase') entry.purchasedQty = qty;
                    if (kind === 'material_receipt') entry.receivedQty = qty;
                    if (kind === 'material_use') entry.usedQty = qty;
                });
                activeDraft.text = buildProjectReportTextFromMatches(activeRawText, activeDraft.workMatches, activeDraft.materialMatches);
                activeDraft.unmatchedClauses = projectReportUnmatchedClauses(activeRawText, activeDraft.workMatches, activeDraft.materialMatches);
                activeDraft.previewAdditionalClauses = projectReportPreviewAdditionalClauses(activeRawText, activeDraft.workMatches, activeDraft.materialMatches);
                syncAuthorReportText(activeRawText);
                refreshStructuredFinalReport();
            }
            function refreshEffectsSummary() {
                if (!previewRoot) return;
                syncReportTextFromEffectQuantities();
                qsa('[data-report-effect]', previewRoot).forEach(function (input) {
                    var card = input.closest ? input.closest('.report-effect-card') : null;
                    var qtyInput = card ? qs('[data-report-effect-qty]', card) : null;
                    if (qtyInput) qtyInput.disabled = !input.checked;
                    if (card && card.classList) card.classList.toggle('is-disabled', !input.checked);
                    var resultNode = card ? qs('[data-report-effect-result]', card) : null;
                    if (resultNode) {
                        var baseQty = Math.max(0, Number(input.getAttribute('data-effect-base') || 0));
                        var reportQty = input.checked ? Math.max(0, Number(qtyInput && qtyInput.value || 0)) : 0;
                        var unitNode = card ? qs('.report-effect-quantity em', card) : null;
                        resultNode.textContent = finalSectionSummaryNumber(baseQty + reportQty) + ' ' + String(unitNode && unitNode.textContent || 'ед.');
                    }
                });
            }
            function refreshPreview(options) {
                if (!options || options.skipCapture !== true) captureEffectOverrides();
                var rawText = rawInput ? rawInput.value.trim() : '';
                var projectId = Number(form.project_id && form.project_id.value || 0);
                var draft = buildProjectReportDraft(projectId, {
                    raw_input: rawText,
                    work_done: '',
                    work_choices_by_clause: manualWorkChoicesByClause(),
                    material_choices_by_clause: manualMaterialChoicesByClause()
                });
                draft = mergeManualSelections(draft, rawText);
                activeDraft = draft;
                activeRawText = rawText;
                if (reviewCard) reviewCard.hidden = !rawText;
                syncAuthorReportText(rawText);
                if (titleInput) {
                    titleInput.value = 'Отчет за ' + (form.report_date && form.report_date.value ? form.report_date.value : APP_TODAY);
                    titleInput.dataset.autogenerated = '1';
                }
                if (previewRoot) {
                    previewRoot.innerHTML = renderReportPreviewHtml(projectId, rawText ? draft : { text: '', workMatches: [], materialMatches: [] });
                    refreshLucideIcons(previewRoot);
                }
                applyEffectOverrides();
                if (!options || options.skipLiveAssist !== true) renderLiveAssist(rawText);
                refreshEffectsSummary();
            }
            if (rawInput) rawInput.addEventListener('input', refreshPreview);
            if (workDone) workDone.addEventListener('input', function () {
                workDone.dataset.reportManual = '1';
                workDone.dataset.autogenerated = '0';
                notifyReportDraftChanged();
            });
            var regenerateTextButton = qs('[data-report-text-regenerate]', form);
            if (regenerateTextButton) regenerateTextButton.addEventListener('click', function () {
                syncAuthorReportText(rawInput ? rawInput.value : '', true);
                refreshStructuredFinalReport();
                notifyReportDraftChanged();
                if (workDone) workDone.focus();
            });
            if (form.report_date) form.report_date.addEventListener('change', refreshPreview);
            [form.blockers, form.next_steps].forEach(function (control) {
                if (control) control.addEventListener('input', refreshStructuredFinalReport);
            });
            form.addEventListener('pmbi:report-preview-meta-changed', refreshStructuredFinalReport);
            form.addEventListener('input', function (event) {
                if (event.target && event.target.closest && event.target.closest('[data-report-resource-row]')) refreshStructuredFinalReport();
            });
            if (form.is_client_visible) form.is_client_visible.addEventListener('change', refreshStructuredFinalReport);
            if (previewRoot) previewRoot.addEventListener('change', function (event) {
                if (event.target && event.target.matches('[data-report-effect], [data-report-effect-qty]')) {
                    captureEffectOverrides();
                    refreshEffectsSummary();
                    notifyReportDraftChanged();
                }
            });
            if (previewRoot) previewRoot.addEventListener('input', function (event) {
                if (event.target && event.target.matches('[data-report-effect-qty]')) {
                    captureEffectOverrides();
                    refreshEffectsSummary();
                    notifyReportDraftChanged();
                }
            });
            function updateManualSelectionControl(target) {
                var row = target && target.closest ? target.closest('[data-report-manual-row]') : null;
                var key = row ? row.getAttribute('data-report-manual-key') || '' : '';
                var selected = manualSelections[key];
                if (!selected) return null;
                delete selected.manualLimitNotice;
                if (target.matches('[data-report-manual-action]')) selected.manualAction = String(target.value || '');
                else if (target.matches('[data-report-manual-qty]')) {
                    selected.manualQty = String(target.value || '');
                    if (selected.kind === 'work') selected.manualWorkMode = 'delta_qty';
                    if (selected.kind === 'material') selected.manualQuantityMode = 'delta_qty';
                }
                else return null;
                return selected;
            }
            if (liveAssist) liveAssist.addEventListener('input', function (event) {
                if (!event.target || !event.target.matches('[data-report-manual-qty]')) return;
                captureEffectOverrides();
                var selected = updateManualSelectionControl(event.target);
                if (!selected) return;
                normalizeManualWorkSelection(selected);
                if (selected.manualLimitNotice) event.target.value = String(selected.manualQty || '');
                refreshManualWorkControlCopy(event.target.closest('[data-report-manual-row]'), selected);
                reportClearManualSelectionEffectOverrides(effectOverrides, selected);
                refreshPreview({ skipCapture: true, skipLiveAssist: true });
                notifyReportDraftChanged();
            });
            if (liveAssist) liveAssist.addEventListener('change', function (event) {
                if (!event.target || !event.target.matches('[data-report-manual-action], [data-report-manual-qty]')) return;
                captureEffectOverrides();
                var selected = updateManualSelectionControl(event.target);
                if (!selected) return;
                normalizeManualWorkSelection(selected);
                reportClearManualSelectionEffectOverrides(effectOverrides, selected);
                refreshPreview({ skipCapture: true });
                notifyReportDraftChanged();
            });
            if (liveAssist) liveAssist.addEventListener('click', function (event) {
                var addButton = event.target && event.target.closest ? event.target.closest('[data-report-suggestion]') : null;
                var removeButton = event.target && event.target.closest ? event.target.closest('[data-report-suggestion-remove]') : null;
                if (addButton) {
                    var suggestionKey = addButton.getAttribute('data-report-suggestion') || '';
                    if (activeSuggestionsByKey[suggestionKey]) {
                        var currentText = rawInput ? rawInput.value.trim() : '';
                        var currentClauses = reportTextClauses(currentText);
                        var selectedClause = currentClauses.length
                            ? currentClauses[currentClauses.length - 1]
                            : currentText;
                        captureEffectOverrides();
                        manualSelections[suggestionKey] = createManualSelection(activeSuggestionsByKey[suggestionKey], selectedClause);
                        normalizeManualWorkSelection(manualSelections[suggestionKey]);
                        reportClearManualSelectionEffectOverrides(effectOverrides, manualSelections[suggestionKey]);
                    }
                    refreshPreview({ skipCapture: true });
                    notifyReportDraftChanged();
                    if (rawInput) rawInput.focus();
                    return;
                }
                if (removeButton) {
                    var removeKey = removeButton.getAttribute('data-report-suggestion-remove') || '';
                    captureEffectOverrides();
                    reportClearManualSelectionEffectOverrides(effectOverrides, manualSelections[removeKey]);
                    delete manualSelections[removeKey];
                    refreshPreview({ skipCapture: true });
                    notifyReportDraftChanged();
                    if (rawInput) rawInput.focus();
                }
            });
            form.addEventListener('reset', function () {
                manualSelections = {};
                activeSuggestionsByKey = {};
                effectOverrides = {};
                if (workDone) {
                    workDone.dataset.reportManual = '0';
                    workDone.dataset.autogenerated = '1';
                }
            });
            form._reportPreviewDraftController = {
                serialize: reportPreviewDraftSnapshot,
                restore: restoreReportPreviewDraft,
                refresh: refreshPreview
            };
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
                    '<div class="card-head report-timeline-head"><div><h3>Предыдущие отчеты</h3><span class="muted">Лента суточных отчетов по объекту.</span></div></div>' +
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
        var workMatches = (Array.isArray(draft.workMatches) ? draft.workMatches : []).filter(function (entry) {
            return !!(entry && entry.ambiguous) || reportMatchConsumesClause(entry, reportWorkMatchIsConcrete);
        });
        var materialMatches = (Array.isArray(draft.materialMatches) ? draft.materialMatches : []).filter(function (entry) {
            return !!(entry && entry.ambiguous) || reportMatchConsumesClause(entry, reportMaterialMatchIsConcrete);
        });
        var unmatchedClauses = Array.isArray(draft.previewAdditionalClauses)
            ? draft.previewAdditionalClauses
            : (Array.isArray(draft.unmatchedClauses) ? draft.unmatchedClauses : []);
        if (!draft.text && !workMatches.length && !materialMatches.length) {
            return '<div class="report-preview-empty"><span class="report-preview-empty-icon" aria-hidden="true"><i data-lucide="message-square-dashed"></i></span><span class="report-preview-empty-copy"><b>Можно просто сказать, что произошло</b><span>Например: «Заказал дверные ручки. Привезли кабель 40 м. Ждём электрика».</span></span></div>';
        }
        function previewTitle(icon, title, note) {
            return '<div class="report-preview-title"><span class="report-preview-title-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(icon) + '"></i></span><span class="report-preview-title-copy"><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(note) + '</small></span></div>';
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
        var effectCount = 0;
        function reportEffectValue(value) {
            return finalSectionSummaryNumber(Math.max(0, Number(value) || 0));
        }
        function quantityEffect(entry, kind, qty, maxQty, label, note, baseQty, plannedQty, canApply, quantityMode, quantityValue, baseLabel) {
            if (!canApply || !(Number(qty) > 0) || !(Number(maxQty) > 0) || entry.ambiguous) return '';
            effectCount += 1;
            var item = entry.item || {};
            var unit = reportEntryQuantityUnit(entry);
            var actionId = kind + ':' + String(item.id || '') + ':' + String(effectCount);
            var controlId = 'report-effect-' + String(item.id || 'item') + '-' + String(effectCount);
            var safeQty = Math.min(Number(qty) || 0, Number(maxQty) || 0);
            var resultQty = Math.min(Number(plannedQty) || (Number(baseQty) + safeQty), Number(baseQty) + safeQty);
            return '<div class="report-effect-card report-effect-staging-row is-' + escapeHtml(kind) + '">' +
                '<label class="report-effect-toggle" for="' + escapeHtml(controlId) + '">' +
                    '<input id="' + escapeHtml(controlId) + '" type="checkbox" checked data-report-effect data-effect-kind="' + escapeHtml(kind) + '" data-item-id="' + escapeHtml(item.id || '') + '" data-effect-qty="' + escapeHtml(safeQty) + '" data-effect-max="' + escapeHtml(Number(maxQty)) + '" data-effect-base="' + escapeHtml(Number(baseQty) || 0) + '" data-original-effect-qty="' + escapeHtml(safeQty) + '" data-quantity-mode="' + escapeHtml(quantityMode || 'delta_qty') + '" data-input-value="' + escapeHtml(quantityValue != null ? quantityValue : safeQty) + '" data-client-action-id="' + escapeHtml(actionId) + '">' +
                    '<span class="report-effect-check" aria-hidden="true"><i data-lucide="check"></i></span>' +
                    '<span class="report-effect-copy"><b>' + escapeHtml(label) + '</b><strong>' + escapeHtml(item.title || 'Позиция') + '</strong><small>' + escapeHtml(note) + '</small></span>' +
                '</label>' +
                '<div class="report-effect-metrics">' +
                    '<span class="report-effect-metric"><small>План</small><b>' + escapeHtml(reportEffectValue(plannedQty)) + ' ' + escapeHtml(unit || 'ед.') + '</b></span>' +
                    '<span class="report-effect-metric"><small>' + escapeHtml(baseLabel || 'Уже учтено') + '</small><b>' + escapeHtml(reportEffectValue(baseQty)) + ' ' + escapeHtml(unit || 'ед.') + '</b></span>' +
                    '<label class="report-effect-quantity report-effect-metric"><span>Из отчёта</span><input type="number" min="0.001" max="' + escapeHtml(Number(maxQty)) + '" step="0.001" value="' + escapeHtml(safeQty) + '" data-report-effect-qty aria-label="Количество из отчёта: ' + escapeHtml(item.title || 'позиция') + '"><em>' + escapeHtml(unit || 'ед.') + '</em></label>' +
                    '<span class="report-effect-metric report-effect-result"><small>Итого</small><b data-report-effect-result>' + escapeHtml(reportEffectValue(resultQty)) + ' ' + escapeHtml(unit || 'ед.') + '</b></span>' +
                '</div>' +
            '</div>';
        }
        function materialEffect(entry, kind, qty, maxQty, label, note) {
            var item = entry.item || {};
            var plan = quantityPlanInfo(item);
            var purchased = Number(item.purchasedQty || item.purchased_qty || 0);
            var received = Number(item.receivedQty || item.received_qty || 0);
            var used = Number(item.usedQty || item.used_qty || 0) + Number(item.writeoffQty || item.writeoff_qty || 0);
            var baseQty = kind === 'material_purchase' ? Math.max(purchased, received) : (kind === 'material_receipt' ? received : used);
            var baseLabel = kind === 'material_purchase' ? 'Уже закуплено' : (kind === 'material_receipt' ? 'Уже принято' : 'Уже использовано');
            return quantityEffect(entry, kind, qty, maxQty, label, note, baseQty, plan.totalQty, canApplyDailyReportMaterialActions(), 'delta_qty', qty, baseLabel);
        }
        function workEffect(entry) {
            var item = entry.item || {};
            var progress = workActualProgress(projectId, entry.sectionTitle, item);
            var remaining = Math.max(Number(progress.total || 0) - Number(progress.actual || 0), 0);
            var quantityMode = entry.quantityMode || 'delta_qty';
            var reportQty = Number(entry.actualQty || 0);
            var appliedQty = quantityMode === 'target_qty' || quantityMode === 'target_percent'
                ? Math.max(reportQty - Number(progress.actual || 0), 0)
                : reportQty;
            appliedQty = Math.min(appliedQty, remaining);
            return quantityEffect(
                entry,
                'work_progress',
                appliedQty,
                remaining,
                entry.partial ? 'Частично выполнено' : 'Выполнено',
                quantityMode === 'target_percent' ? ('распознано ' + reportEffectValue(entry.quantityValue) + '% готовности') : 'увеличит фактический объём работы',
                progress.actual,
                progress.total,
                canApplyDailyReportWorkActions(),
                quantityMode,
                entry.quantityValue,
                'Уже выполнено'
            );
        }
        var html = ['<div class="report-action-staging-inner">'];
        if (workMatches.length) {
            html.push(workMatches.map(function (entry) {
                return entry.ambiguous ? '' : workEffect(entry);
            }).join(''));
        }
        if (materialMatches.length) {
            html.push(materialMatches.map(function (entry) {
                    if (entry.ambiguous) return '';
                    var actions = [
                        materialEffect(entry, 'material_purchase', entry.purchasedQty, entry.purchaseMaxQty, 'Заказано', 'склад не увеличится'),
                        materialEffect(entry, 'material_receipt', entry.receivedQty, entry.receiptMaxQty, 'Принято на объект', 'увеличит физический остаток'),
                        materialEffect(entry, 'material_use', entry.usedQty, entry.useMaxQty, 'Передано в работу', 'уменьшит остаток на объекте')
                    ].filter(Boolean);
                    return actions.join('');
                }).join(''));
        }
        html.push('</div>');
        if (!effectCount) return '<div class="report-action-staging-empty"><i data-lucide="file-text" aria-hidden="true"></i><span><b>Сохранится только текст отчёта</b><small>Учёт работ и материалов не изменится</small></span></div>';
        return '<div class="report-action-staging-head"><span><i data-lucide="list-checks" aria-hidden="true"></i><b>Что попадёт в учёт</b></span><small>Снимите галочку или исправьте количество</small></div>' + html.join('');
    };

    renderProjectReportForm = function (project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card report-chat-intake report-daily-form-card">' +
            '<div class="report-drawer-caption">Суточный отчет</div>' +
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
                    '<label class="report-confirm"><span>Подтверждаю сохранение отчёта; склад и факт заполняются отдельно</span><input type="checkbox" name="confirm_report" required></label>' +
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
        baseValue: '',
        active: false
    };
    var reportVoiceUnsupportedWarned = false;
    var reportVoiceToastTimer = null;

    function reportSpeechRecognitionConstructor() {
        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function reportVoiceUnavailableMessage() {
        if (window.isSecureContext === false) {
            return 'Голосовой ввод доступен только через защищённое соединение HTTPS.';
        }
        if (!reportSpeechRecognitionConstructor()) {
            return 'Голосовой ввод недоступен в этом браузере — напишите отчёт текстом.';
        }
        return '';
    }

    function reportVoiceMessage(value) {
        var messages = {
            micTitle: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434',
            micActive: '\u0418\u0434\u0435\u0442 \u0437\u0430\u043f\u0438\u0441\u044c',
            micBlocked: '\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043c\u0438\u043a\u0440\u043e\u0444\u043e\u043d\u0443 \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430',
            micError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434',
            micMissing: 'Микрофон не найден или занят другим приложением.',
            micNetwork: 'Не удалось подключиться к распознаванию речи. Проверьте интернет и попробуйте ещё раз.',
            micNoSpeech: 'Речь не распознана. Нажмите «Диктовать» и говорите после включения микрофона.'
        };
        return messages[value] || '';
    }

    function reportVoiceErrorMessage(errorCode) {
        if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') return reportVoiceMessage('micBlocked');
        if (errorCode === 'audio-capture') return reportVoiceMessage('micMissing');
        if (errorCode === 'network') return reportVoiceMessage('micNetwork');
        if (errorCode === 'no-speech') return reportVoiceMessage('micNoSpeech');
        return reportVoiceMessage('micError');
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
        var label = qs('[data-report-voice-label]', button);
        if (label) label.textContent = stateName === 'active' ? 'Готово' : 'Диктовать';
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
        reportVoiceState.baseValue = '';
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
        var unavailableMessage = reportVoiceUnavailableMessage();
        if (unavailableMessage) {
            if (!reportVoiceUnsupportedWarned) {
                console.warn(unavailableMessage);
                reportVoiceUnsupportedWarned = true;
            }
            showReportVoiceToast(unavailableMessage);
            return;
        }
        if (reportVoiceState.active) stopReportVoiceRecognition();
        var recognition = new Recognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = function (event) {
            var parts = [];
            for (var index = 0; index < event.results.length; index += 1) {
                var result = event.results[index];
                if (result && result[0] && result[0].transcript) {
                    parts.push(result[0].transcript);
                }
            }
            var spoken = parts.join(' ').trim();
            var baseValue = String(reportVoiceState.baseValue || '');
            input.value = baseValue + (baseValue && spoken ? (/\s$/.test(baseValue) ? '' : ' ') : '') + spoken;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        recognition.onerror = function (event) {
            var errorCode = event && event.error ? String(event.error) : '';
            if (errorCode !== 'aborted') {
                showReportVoiceToast(reportVoiceErrorMessage(errorCode));
                console.warn('Speech recognition error:', errorCode || event);
            }
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
            baseValue: String(input.value || ''),
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
        var primary = qs('[name="raw_input"]', form);
        if (primary && !primary.disabled && !primary.readOnly) return [primary];
        return qsa('textarea, input', form).filter(function (input) {
            var type = String(input.getAttribute('type') || (input.tagName === 'TEXTAREA' ? 'textarea' : 'text')).toLowerCase();
            var textTypes = ['textarea', 'text', 'search', 'tel', 'url', 'email'];
            return textTypes.indexOf(type) !== -1 && !input.disabled && !input.readOnly;
        });
    }

    function bindReportVoiceInputs() {
        var unavailableMessage = reportVoiceUnavailableMessage();
        if (unavailableMessage) {
            if (!reportVoiceUnsupportedWarned) {
                console.warn(unavailableMessage);
                reportVoiceUnsupportedWarned = true;
            }
            qsa('[data-log-form]').forEach(function (form) {
                var input = qs('[name="raw_input"]', form);
                if (!input || qs('[data-report-voice-unavailable]', form)) return;
                var note = document.createElement('small');
                note.className = 'report-voice-unavailable';
                note.setAttribute('data-report-voice-unavailable', '');
                note.textContent = unavailableMessage;
                input.parentNode.insertBefore(note, input.nextSibling);
            });
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
                var isMainReportInput = input.name === 'raw_input';
                if (isMainReportInput) button.classList.add('is-primary');
                button.innerHTML = reportVoiceIconHtml() + (isMainReportInput ? '<span class="report-voice-label" data-report-voice-label>Диктовать</span>' : '');
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
        var numeric = Number(raw);
        var parsed = Number.isFinite(numeric)
            ? new Date(Math.abs(numeric) < 1000000000000 ? numeric * 1000 : numeric)
            : new Date(String(raw).replace(' ', 'T'));
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

    function renderProjectReportDeleteButton() {
        var handler = PMBI.operations && PMBI.operations.renderProjectReportDeleteButton;
        return typeof handler === 'function' ? handler.apply(null, arguments) : '';
    }

    function bindProjectReportDeleteActions() {
        var handler = PMBI.operations && PMBI.operations.bindProjectReportDeleteActions;
        if (typeof handler === 'function') return handler.apply(null, arguments);
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
        qsa('body > [data-finance-delete-modal]').forEach(function (modal) {
            modal.remove();
        });
        qsa('body > [data-finance-payment-modal]').forEach(function (modal) {
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

    function financePaymentOverview(items) {
        var pending = (Array.isArray(items) ? items : []).filter(function (item) {
            return item && item.direction === 'expense' && item.status !== 'paid' && item.status !== 'cancelled';
        });
        var result = {
            pending: pending,
            pendingTotal: 0,
            overdue: [],
            overdueTotal: 0,
            week: [],
            weekTotal: 0,
            noDate: []
        };
        pending.forEach(function (item) {
            var amount = Number(item.amount || 0);
            var bucket = financePlanBucket(item).key;
            result.pendingTotal += amount;
            if (bucket === 'overdue') {
                result.overdue.push(item);
                result.overdueTotal += amount;
            }
            if (bucket === 'today' || bucket === 'week') {
                result.week.push(item);
                result.weekTotal += amount;
            }
            if (bucket === 'no-date') result.noDate.push(item);
        });
        return result;
    }

    function financeCountText(count, one, few, many) {
        count = Math.abs(Number(count || 0));
        var mod100 = count % 100;
        var mod10 = count % 10;
        var word = mod100 >= 11 && mod100 <= 14 ? many : (mod10 === 1 ? one : (mod10 >= 2 && mod10 <= 4 ? few : many));
        return String(count) + ' ' + word;
    }

    function renderFinanceWorkspaceHead(items, canAddIncome, canViewManagement) {
        var paymentOverview = financePaymentOverview(items);
        return '<section class="finance-commandbar" data-finance-workspace-head>' +
            '<div class="finance-commandbar-copy"><span class="section-label">Финансы объекта</span><h2>Главное о деньгах — на одном экране</h2><p>Сначала посмотрите итог и риски, затем переходите к счетам или управленческому учёту.</p>' +
                '<div class="finance-primer" aria-label="Как читать финансовые показатели">' +
                    '<span><i data-lucide="trending-up"></i><b>Результат</b> прибыль и затраты без НДС</span>' +
                    '<span><i data-lucide="wallet-cards"></i><b>Деньги</b> поступления и оплаты с НДС</span>' +
                    '<span><i data-lucide="circle-equal"></i><b>Важно</b> Баланс поступлений и оплат не является прибылью или маржой.</span>' +
                '</div>' +
            '</div>' +
            renderFinanceEntryActions(canAddIncome) +
        '</section>' +
        '<nav class="finance-section-nav" data-finance-view-tabs aria-label="Разделы финансов">' +
            '<button type="button" data-finance-view="overview" aria-selected="true"><i data-lucide="layout-dashboard"></i><span>Обзор<small>Итог и риски</small></span></button>' +
            '<button type="button" data-finance-view="payments" aria-selected="false"><i data-lucide="calendar-days"></i><span>К оплате<small>' + escapeHtml(paymentOverview.pending.length ? financeCountText(paymentOverview.pending.length, 'счёт', 'счёта', 'счетов') : 'Всё оплачено') + '</small></span>' + (paymentOverview.overdue.length ? '<b class="finance-nav-alert">' + escapeHtml(paymentOverview.overdue.length) + '</b>' : '') + '</button>' +
            '<button type="button" data-finance-view="operations" aria-selected="false"><i data-lucide="list-filter"></i><span>Операции<small>' + escapeHtml(financeCountText((items || []).length, 'запись', 'записи', 'записей')) + '</small></span></button>' +
            (canViewManagement ? '<button type="button" data-finance-view="management" aria-selected="false"><i data-lucide="sliders-horizontal"></i><span>Управленческий учёт<small>План → прогноз</small></span></button>' : '') +
        '</nav>';
    }

    function renderFinanceExecutiveSummary(items, summary, economicsData, economicsError, financeError) {
        var paymentOverview = financePaymentOverview(items);
        var forecast = economicsData && economicsData.forecast || null;
        var margin = forecast ? Number(forecast.forecastMarginNetKopecks || 0) : null;
        var balance = Number(summary && summary.balance || 0);
        var marginHint = economicsError
            ? 'Сводка временно недоступна'
            : (!canViewProjectEconomics() ? 'Доступ по роли ограничен' : (forecast ? economicsPercent(forecast.forecastMarginPercent) + ' от выручки' : 'Нужно рассчитать прогноз'));
        return '<section class="finance-executive-summary" aria-label="Главные финансовые показатели">' +
            '<article class="finance-executive-card ' + (margin == null ? 'is-neutral' : (margin < 0 ? 'is-danger' : 'is-success')) + '"><div class="finance-executive-icon"><i data-lucide="trending-up"></i></div><span>Прогнозная маржа</span><strong>' + escapeHtml(margin == null ? '—' : economicsMoney(margin)) + '</strong><small>' + escapeHtml(marginHint) + '</small></article>' +
            '<article class="finance-executive-card ' + (!financeError && balance < 0 ? 'is-danger' : 'is-primary') + '"><div class="finance-executive-icon"><i data-lucide="wallet-cards"></i></div><span>Денег сейчас</span><strong>' + escapeHtml(financeError ? '—' : money(balance)) + '</strong><small>' + escapeHtml(financeError ? 'Данные временно недоступны' : 'Поступило минус оплачено') + '</small></article>' +
            '<article class="finance-executive-card ' + (!financeError && paymentOverview.week.length ? 'is-primary' : 'is-neutral') + '"><div class="finance-executive-icon"><i data-lucide="calendar-clock"></i></div><span>Оплатить за 7 дней</span><strong>' + escapeHtml(financeError ? '—' : money(paymentOverview.weekTotal)) + '</strong><small>' + escapeHtml(financeError ? 'Данные временно недоступны' : (paymentOverview.week.length ? financeCountText(paymentOverview.week.length, 'счёт требует', 'счёта требуют', 'счетов требуют') + ' внимания' : 'Платежей на неделю нет')) + '</small></article>' +
            '<article class="finance-executive-card ' + (!financeError && paymentOverview.overdue.length ? 'is-danger' : 'is-neutral') + '"><div class="finance-executive-icon"><i data-lucide="triangle-alert"></i></div><span>Просрочено</span><strong>' + escapeHtml(financeError ? '—' : money(paymentOverview.overdueTotal)) + '</strong><small>' + escapeHtml(financeError ? 'Данные временно недоступны' : (paymentOverview.overdue.length ? financeCountText(paymentOverview.overdue.length, 'счёт', 'счёта', 'счетов') + ' без оплаты' : 'Просроченных счетов нет')) + '</small></article>' +
        '</section>';
    }

    function renderFinancePayablesCallout(items) {
        var overview = financePaymentOverview(items);
        if (!overview.pending.length) {
            return '<section class="finance-payables-callout is-clear" data-finance-payables-callout data-director-finance>' +
                '<div class="finance-payables-callout-icon"><i data-lucide="circle-check-big"></i></div>' +
                '<div class="finance-payables-callout-copy"><span>Счета к оплате</span><h3>Всё оплачено</h3><p>Новых счетов и просроченных платежей нет.</p></div>' +
                '<button class="ghost compact" type="button" data-finance-view-target="payments"><span>Открыть раздел</span><i data-lucide="arrow-right"></i></button>' +
            '</section>';
        }
        var dated = overview.pending.filter(function (item) { return item.planned_date; }).sort(function (left, right) {
            return String(left.planned_date).localeCompare(String(right.planned_date));
        });
        var nextPayment = dated[0] || null;
        var detail = overview.overdue.length
            ? financeCountText(overview.overdue.length, 'счёт просрочен', 'счёта просрочены', 'счетов просрочены') + ' на ' + money(overview.overdueTotal)
            : (nextPayment ? 'Ближайший срок — ' + formatDisplayDate(nextPayment.planned_date) : 'Есть счета без даты оплаты');
        return '<section class="finance-payables-callout' + (overview.overdue.length ? ' has-overdue' : '') + '" data-finance-payables-callout data-director-finance>' +
            '<div class="finance-payables-callout-icon"><i data-lucide="receipt-text"></i></div>' +
            '<div class="finance-payables-callout-copy"><span>Счета к оплате</span><h3>' + escapeHtml(money(overview.pendingTotal)) + '</h3><p>' + escapeHtml(financeCountText(overview.pending.length, 'счёт ожидает', 'счёта ожидают', 'счетов ожидают') + ' оплаты · ' + detail) + '</p></div>' +
            '<button class="primary" type="button" data-finance-view-target="payments"><span>Перейти к оплате</span><i data-lucide="arrow-right"></i></button>' +
        '</section>';
    }

    function renderFinanceOperations(items) {
        items = Array.isArray(items) ? items : [];
        var unpaidCount = items.filter(function (item) {
            return item.direction === 'expense' && item.status !== 'paid' && item.status !== 'cancelled';
        }).length;
        var incomeCount = items.filter(function (item) { return item.direction === 'income'; }).length;
        var paidCount = items.filter(function (item) { return item.status === 'paid'; }).length;
        return '<section class="subsection finance-history-card ui-card"><div class="card-head finance-toolbar"><div><span class="section-label">Журнал</span><h3>Все финансовые операции</h3><span class="muted">Счета, поступления, оплаты и документы в одном списке.</span></div><div class="card-head-actions finance-toolbar-actions"><label class="finance-search-field"><i data-lucide="search"></i><input class="search finance-search" type="search" placeholder="Счёт или контрагент" aria-label="Поиск по операциям" data-finance-search></label></div></div>' +
            '<div class="finance-filter-bar" data-finance-filters aria-label="Фильтр операций">' +
                '<button class="active" type="button" data-finance-filter="all">Все <b>' + escapeHtml(items.length) + '</b></button>' +
                '<button type="button" data-finance-filter="payable">К оплате <b>' + escapeHtml(unpaidCount) + '</b></button>' +
                '<button type="button" data-finance-filter="income">Поступления <b>' + escapeHtml(incomeCount) + '</b></button>' +
                '<button type="button" data-finance-filter="paid">Оплачено <b>' + escapeHtml(paidCount) + '</b></button>' +
            '</div>' +
            '<div class="finance-table"><div class="finance-table-head"><span>Операция</span><span>Статус</span><span>Документ</span><span>Сумма</span><span>Даты</span><span>Действия</span></div><div class="finance-list">' +
                (items.length ? items.map(renderFinanceRow).join('') : '<div class="finance-empty-state"><i data-lucide="receipt-text"></i><b>Операций пока нет</b><span>Добавьте первый счёт или поступление кнопками наверху.</span></div>') +
            '</div></div><div class="finance-filter-empty" data-finance-filter-empty hidden><i data-lucide="search-x"></i><b>Ничего не найдено</b><span>Измените поиск или выберите другой фильтр.</span></div></section>';
    }

    function setFinanceWorkspaceView(root, projectId, view, economicsMode) {
        if (!root) return;
        var allowed = qsa('[data-finance-view]', root).map(function (button) { return button.dataset.financeView; });
        if (allowed.indexOf(view) === -1) view = 'overview';
        state.financeViewByProject = state.financeViewByProject || {};
        state.financeViewByProject[String(projectId)] = view;
        qsa('[data-finance-view]', root).forEach(function (button) {
            var active = button.dataset.financeView === view;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        qsa('[data-finance-view-panel]', root).forEach(function (panelNode) {
            panelNode.hidden = panelNode.dataset.financeViewPanel !== view;
        });
        if (view === 'management' && economicsMode) {
            var modeButton = qs('[data-econ-mode="' + economicsMode + '"]', root);
            if (modeButton) modeButton.click();
        }
    }

    function bindFinanceWorkspaceNavigation(root, projectId) {
        if (!root) return;
        qsa('[data-finance-view]', root).forEach(function (button) {
            button.addEventListener('click', function () {
                setFinanceWorkspaceView(root, projectId, button.dataset.financeView);
            });
        });
        qsa('[data-finance-view-target]', root).forEach(function (button) {
            button.addEventListener('click', function () {
                setFinanceWorkspaceView(root, projectId, button.dataset.financeViewTarget, button.dataset.econModeTarget || '');
            });
        });
        var selected = state.financeViewByProject && state.financeViewByProject[String(projectId)] || 'overview';
        setFinanceWorkspaceView(root, projectId, selected);
    }

    function bindFinanceOperationFilters(root) {
        var search = qs('[data-finance-search]', root);
        var buttons = qsa('[data-finance-filter]', root);
        if (!search || !buttons.length) return;
        var forms = qsa('.finance-history-card [data-finance-edit-form]', root);
        if (!forms.length) return;
        var activeFilter = 'all';
        function update() {
            var query = search.value.toLocaleLowerCase('ru').trim();
            var visible = 0;
            forms.forEach(function (form) {
                var searchableText = form.dataset.financeSearchText || form.textContent.toLocaleLowerCase('ru');
                var matchesQuery = !query || searchableText.indexOf(query) !== -1;
                var matchesFilter = activeFilter === 'all' ||
                    (activeFilter === 'payable' && form.dataset.financeDirection === 'expense' && form.dataset.financeStatus !== 'paid' && form.dataset.financeStatus !== 'cancelled') ||
                    (activeFilter === 'income' && form.dataset.financeDirection === 'income') ||
                    (activeFilter === 'paid' && form.dataset.financeStatus === 'paid');
                form.hidden = !(matchesQuery && matchesFilter);
                if (!form.hidden) visible += 1;
            });
            var empty = qs('[data-finance-filter-empty]', root);
            if (empty) empty.hidden = visible > 0;
        }
        search.addEventListener('input', debounce(update, 180));
        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                activeFilter = button.dataset.financeFilter || 'all';
                buttons.forEach(function (item) { item.classList.toggle('active', item === button); });
                update();
            });
        });
    }

    function startPrimaryReportVoice(form) {
        var input = form ? qs('[name="raw_input"]', form) : null;
        if (!input) return false;
        var unavailableMessage = reportVoiceUnavailableMessage();
        if (unavailableMessage) {
            showReportVoiceToast(unavailableMessage);
            input.focus();
            return false;
        }
        bindReportVoiceInputs();
        var wrapper = input.closest ? input.closest('.report-voice-field') : null;
        var button = wrapper ? qs('.report-voice-button', wrapper) : null;
        if (!button) return false;
        startReportVoiceRecognition(input, button);
        return true;
    }

    function renderFinanceRow(item) {
        var direction = item.direction === 'income' ? 'income' : 'expense';
        var status = item.status || 'planned';
        var title = item.category || financeDirectionLabel(direction);
        var counterparty = item.counterparty_name || '\u041a\u043e\u043d\u0442\u0440\u0430\u0433\u0435\u043d\u0442 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d';
        var searchText = [title, counterparty, item.notes || '', financePaymentLabel(item.payment_kind), money(item.amount || 0)].join(' ').toLocaleLowerCase('ru');
        return '<form class="finance-row finance-history-row finance-table-row is-' + escapeHtml(direction) + ' is-status-' + escapeHtml(status) + '" data-finance-edit-form data-finance-id="' + escapeHtml(item.id) + '" data-finance-direction="' + escapeHtml(direction) + '" data-finance-status="' + escapeHtml(status) + '" data-finance-search-text="' + escapeHtml(searchText) + '">' +
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
                (direction === 'expense' && status !== 'paid' && status !== 'cancelled' ? '<button class="primary compact finance-pay-button" type="button" data-finance-confirm-payment data-director-action><i data-lucide="credit-card"></i><span>\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c</span></button>' : '') +
                (status === 'planned' && !item.document_id ? '<button class="ghost compact danger finance-delete-button" type="button" data-finance-delete data-finance-delete-direction="' + escapeHtml(direction) + '" data-finance-delete-title="' + escapeHtml(title) + '" data-finance-delete-amount="' + escapeHtml(item.amount || 0) + '" data-finance-delete-has-document="0" title="\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043e\u0448\u0438\u0431\u043e\u0447\u043d\u044b\u0439 \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a"><i data-lucide="trash-2"></i><span>\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a</span></button>' : '') +
            '</div></form>';
    }

    function renderProjectFinancesLegacy(projectId, items, summary, economicsData, economicsError, financeError) {
        var root = qs('[data-panel="finance"]');
        if (!root) return;
        items = Array.isArray(items) ? items : [];
        summary = summary || {};
        cleanupFinanceEntryModals();
        var economicsHtml = canViewProjectEconomics()
            ? renderProjectEconomics(economicsData, economicsError)
            : '';
        var managementHtml = canViewProjectEconomics() && PMBI.economicsManagement
            ? PMBI.economicsManagement.render(projectId, economicsData || null)
            : '';
        function bindEconomicsManagement() {
            if (!managementHtml || !PMBI.economicsManagement) return;
            PMBI.economicsManagement.bind(root, projectId, function () {
                state.projectEconomicsByProject = state.projectEconomicsByProject || {};
                delete state.projectEconomicsByProject[projectId];
                if (state.marketAnalysisByProject) delete state.marketAnalysisByProject[projectId];
                loadProjectFinances(projectId, undefined, { preserveEconomicsManagementCache: true });
            });
        }
        if (isForemanRole()) {
            safeReplaceChildren(root, '<section class="finance-commandbar is-limited"><div class="finance-commandbar-copy"><span class="section-label">Счета объекта</span><h2>Передать счёт на оплату</h2><p>Загрузите документ и основные реквизиты — финансовая команда увидит его в платёжном плане.</p></div>' + renderFinanceEntryActions(false) + '</section>' + renderFinanceEntryModal(false));
            bindFinanceEntryModal(root);
            bindFinanceInvoiceForm(projectId);
            applyRoleVisibility(root);
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
            return;
        }
        safeReplaceChildren(root,
            economicsHtml +
            managementHtml +
            '<section class="finance-cash-heading ui-card" data-director-finance><div><span class="section-label">Денежные операции</span><h3>Платежи и платежный календарь</h3><p>Кассовое представление с НДС. Баланс поступлений и оплат не является прибылью или маржой.</p></div><span class="economics-mode-badge">с НДС</span></section>' +
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
        bindEconomicsManagement();
        applyRoleVisibility(root);
        var financeSearch = qs('[data-finance-search]', root);
        if (financeSearch) {
            financeSearch.addEventListener('input', debounce(function () {
                var query = financeSearch.value.toLocaleLowerCase('ru').trim();
                qsa('.finance-history-card [data-finance-edit-form]', root).forEach(function (form) {
                    form.hidden = query && form.textContent.toLocaleLowerCase('ru').indexOf(query) === -1;
                });
            }, 300));
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    function renderProjectFinances(projectId, items, summary, economicsData, economicsError, financeError) {
        var root = qs('[data-panel="finance"]');
        if (!root) return;
        items = Array.isArray(items) ? items : [];
        summary = summary || {};
        cleanupFinanceEntryModals();
        var economicsHtml = canViewProjectEconomics()
            ? renderProjectEconomics(economicsData, economicsError)
            : '';
        var managementHtml = canViewProjectEconomics() && PMBI.economicsManagement
            ? PMBI.economicsManagement.render(projectId, economicsData || null)
            : '';

        function bindEconomicsManagement() {
            if (!managementHtml || !PMBI.economicsManagement) return;
            PMBI.economicsManagement.bind(root, projectId, function () {
                state.projectEconomicsByProject = state.projectEconomicsByProject || {};
                delete state.projectEconomicsByProject[projectId];
                if (state.marketAnalysisByProject) delete state.marketAnalysisByProject[projectId];
                loadProjectFinances(projectId, undefined, { preserveEconomicsManagementCache: true });
            });
        }

        if (isForemanRole()) {
            safeReplaceChildren(root, '<section class="finance-commandbar is-limited"><div class="finance-commandbar-copy"><span class="section-label">Счета объекта</span><h2>Передать счёт на оплату</h2><p>Загрузите документ и основные реквизиты — финансовая команда увидит его в платёжном плане.</p></div>' + renderFinanceEntryActions(false) + '</section>' + renderFinanceEntryModal(false));
            bindFinanceEntryModal(root);
            bindFinanceInvoiceForm(projectId);
            applyRoleVisibility(root);
            refreshLucideIcons(root);
            return;
        }

        var canViewManagement = canViewProjectEconomics() && !!managementHtml;
        var overviewPanel = '<section class="finance-view-panel" data-finance-view-panel="overview">' +
            renderFinanceExecutiveSummary(items, summary, economicsData, economicsError, financeError) +
            (financeError ? '' : renderFinancePayablesCallout(items)) +
            economicsHtml +
            (financeError ? '' : '<div data-director-finance>' + renderFinanceHero(projectId, summary, items) + '</div>') +
        '</section>';
        var unavailable = '<div class="finance-filter-empty"><i data-lucide="cloud-off"></i><b>Данные временно недоступны</b><span>Обновите раздел немного позже.</span></div>';
        var paymentsPanel = '<section class="finance-view-panel" data-finance-view-panel="payments" hidden data-director-finance>' + (financeError ? unavailable : renderFinancePlanFromInvoices(items, summary)) + '</section>';
        var operationsPanel = '<section class="finance-view-panel" data-finance-view-panel="operations" hidden data-director-finance>' + (financeError ? unavailable : renderFinanceOperations(items)) + '</section>';
        var managementPanel = canViewManagement
            ? '<section class="finance-view-panel" data-finance-view-panel="management" hidden>' + managementHtml + '</section>'
            : '';
        var errorPanel = financeError
            ? '<section class="finance-data-error ui-card"><div class="economics-notice is-danger"><i data-lucide="circle-alert"></i><div><b>Денежные операции не загрузились</b><span>Экономическая сводка остаётся доступной. Обновите раздел немного позже.</span></div></div></section>'
            : '';

        safeReplaceChildren(root,
            '<div class="finance-workspace" data-finance-workspace data-project-id="' + escapeHtml(projectId) + '">' +
                renderFinanceWorkspaceHead(items, true, canViewManagement) +
                errorPanel + overviewPanel +
                paymentsPanel + operationsPanel +
                managementPanel + renderFinanceEntryModal(true) +
            '</div>');
        bindFinanceEntryModal(root);
        bindFinanceIncomeForm(projectId);
        bindFinanceInvoiceForm(projectId);
        if (!financeError) {
            bindFinanceEditors(projectId);
            bindFinanceDocumentActions();
            bindFinanceOperationFilters(root);
        }
        bindEconomicsManagement();
        bindFinanceWorkspaceNavigation(root, projectId);
        applyRoleVisibility(root);
        refreshLucideIcons(root);
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
                    openFinancePaymentModal(form, button, projectId);
                });
            });
            qsa('[data-finance-payable-settings]', form).forEach(function (button) {
                if (button.dataset.bound === '1') return;
                button.dataset.bound = '1';
                button.addEventListener('click', function () {
                    var editor = qs('[data-finance-payable-editor]', form);
                    if (!editor) return;
                    var willOpen = editor.hidden;
                    editor.hidden = !willOpen;
                    button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                    var label = qs('span', button);
                    if (label) label.textContent = willOpen ? 'Скрыть' : 'Настроить';
                    if (willOpen) {
                        var firstInput = qs('input, select', editor);
                        if (firstInput) firstInput.focus();
                    }
                });
            });
            qsa('[data-finance-delete]', form).forEach(function (button) {
                if (button.dataset.bound === '1') return;
                button.dataset.bound = '1';
                button.addEventListener('click', function () {
                    openFinanceDeleteModal(form, button, projectId);
                });
            });
        });
    }

    function closeFinancePaymentModal(modal) {
        modal = modal || qs('[data-finance-payment-modal]');
        if (!modal || modal.classList.contains('is-saving')) return;
        modal.classList.remove('is-open');
        document.body.classList.remove('finance-modal-lock');
        setTimeout(function () {
            if (!modal.classList.contains('is-open')) modal.hidden = true;
        }, 180);
    }

    function financePaymentErrorMessage(error) {
        var code = error && error.payload && error.payload.error;
        if (code === 'finance_entry_has_payment_allocations') {
            return 'У этого счёта уже есть разнесение. Проверьте финансовую историю перед изменением оплаты.';
        }
        if (code === 'forbidden') return 'У вас нет права подтверждать оплату счетов.';
        if (code === 'finance_not_found') return 'Счёт уже изменён или не найден. Обновите раздел.';
        return appErrorMessage(error, 'Не удалось подтвердить оплату. Попробуйте ещё раз.');
    }

    function ensureFinancePaymentModal() {
        var modal = qs('[data-finance-payment-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'finance-payment-modal';
        modal.setAttribute('data-finance-payment-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<button class="finance-payment-backdrop" type="button" data-finance-payment-cancel aria-label="Закрыть окно оплаты"></button>' +
            '<section class="finance-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-payment-title">' +
                '<div class="finance-payment-dialog-head"><div class="finance-payment-dialog-icon"><i data-lucide="circle-check-big"></i></div><div><span>Подтверждение</span><h3 id="finance-payment-title">Отметить счёт оплаченным</h3></div></div>' +
                '<div class="finance-payment-preview"><strong data-finance-payment-preview-title></strong><span data-finance-payment-preview-amount></span></div>' +
                '<label class="finance-payment-date"><span>Дата оплаты</span><input type="date" value="' + escapeHtml(APP_TODAY) + '" data-finance-payment-date></label>' +
                '<p class="finance-payment-hint"><i data-lucide="info"></i><span>После подтверждения счёт исчезнет из «К оплате» и появится в оплаченных операциях.</span></p>' +
                '<div class="finance-payment-error" data-finance-payment-error role="status" aria-live="polite"></div>' +
                '<div class="finance-payment-actions"><button class="ghost" type="button" data-finance-payment-cancel>Отмена</button><button class="primary" type="button" data-finance-payment-confirm><i data-lucide="check"></i><span>Подтвердить оплату</span></button></div>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-finance-payment-cancel]')) {
                closeFinancePaymentModal(modal);
                return;
            }
            var confirmButton = event.target.closest('[data-finance-payment-confirm]');
            if (!confirmButton || confirmButton.disabled) return;
            var dateInput = qs('[data-finance-payment-date]', modal);
            var errorNode = qs('[data-finance-payment-error]', modal);
            if (errorNode) errorNode.textContent = '';
            modal.classList.add('is-saving');
            withSubmitLock(confirmButton, function () {
                return api('/api/finance/pay-invoice', {
                    method: 'POST',
                    body: JSON.stringify({
                        finance_id: Number(modal.dataset.financeId),
                        paid_date: dateInput && dateInput.value ? dateInput.value : APP_TODAY
                    })
                });
            }).then(function () {
                var activeProjectId = modal.dataset.projectId;
                modal.classList.remove('is-saving');
                closeFinancePaymentModal(modal);
                showFinanceToast('Счёт отмечен оплаченным. Финансовые итоги обновлены.');
                return loadProjectFinances(activeProjectId);
            }).catch(function (error) {
                modal.classList.remove('is-saving');
                if (errorNode) errorNode.textContent = financePaymentErrorMessage(error);
                confirmButton.focus();
            });
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeFinancePaymentModal(modal);
        });
        document.body.appendChild(modal);
        refreshLucideIcons(modal);
        return modal;
    }

    function openFinancePaymentModal(form, button, projectId) {
        var modal = ensureFinancePaymentModal();
        var titleNode = qs('.finance-payable-main b, .finance-cell-main b', form);
        var amountNode = qs('.finance-payable-amount strong, .finance-row-amount strong', form);
        modal.dataset.financeId = form.dataset.financeId;
        modal.dataset.projectId = String(projectId);
        qs('[data-finance-payment-preview-title]', modal).textContent = button.dataset.financePaymentTitle || (titleNode ? titleNode.textContent : 'Счёт к оплате');
        qs('[data-finance-payment-preview-amount]', modal).textContent = button.dataset.financePaymentAmount ? money(Number(button.dataset.financePaymentAmount)) : (amountNode ? amountNode.textContent : '—');
        qs('[data-finance-payment-date]', modal).value = APP_TODAY;
        qs('[data-finance-payment-error]', modal).textContent = '';
        modal.hidden = false;
        document.body.classList.add('finance-modal-lock');
        requestAnimationFrame(function () {
            modal.classList.add('is-open');
            var confirmButton = qs('[data-finance-payment-confirm]', modal);
            if (confirmButton) confirmButton.focus();
        });
    }

    function closeFinanceDeleteModal(modal) {
        modal = modal || qs('[data-finance-delete-modal]');
        if (!modal || modal.classList.contains('is-saving')) return;
        modal.classList.remove('is-open');
        document.body.classList.remove('finance-modal-lock');
        setTimeout(function () {
            if (!modal.classList.contains('is-open')) modal.hidden = true;
        }, 180);
    }

    function financeDeleteErrorMessage(error) {
        var code = error && error.payload && error.payload.error;
        if (code === 'finance_entry_has_payment_allocations') {
            return 'Эта операция уже участвует в разнесении и стала частью финансовой истории. Удалить её нельзя — используйте сторно или отмену.';
        }
        if (code === 'finance_entry_is_not_deletable_draft') {
            return 'Удалять можно только ошибочный черновик без документа. Для реальной операции используйте отмену или сторно — история останется целой.';
        }
        if (code === 'finance_not_found') return 'Операция уже удалена или не найдена.';
        if (code === 'forbidden') return 'У вас нет доступа к удалению финансовых операций.';
        return appErrorMessage(error, 'Не удалось удалить финансовую операцию. Попробуйте ещё раз.');
    }

    function ensureFinanceDeleteModal() {
        var modal = qs('[data-finance-delete-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'finance-delete-modal';
        modal.setAttribute('data-finance-delete-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<button class="finance-delete-backdrop" type="button" data-finance-delete-cancel aria-label="Отменить удаление"></button>' +
            '<section class="finance-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="finance-delete-title" aria-describedby="finance-delete-description">' +
                '<div class="finance-delete-icon" aria-hidden="true"><i data-lucide="trash-2"></i></div>' +
                '<div class="finance-delete-copy">' +
                    '<h3 id="finance-delete-title" data-finance-delete-heading>Удалить черновик?</h3>' +
                    '<p id="finance-delete-description">Удаляйте только ошибочную запись. Согласованные и оплаченные операции система сохраняет в истории.</p>' +
                '</div>' +
                '<div class="finance-delete-preview"><strong data-finance-delete-preview-title></strong><span data-finance-delete-preview-amount></span></div>' +
                '<p class="finance-delete-document-note" data-finance-delete-document-note hidden><i data-lucide="file-check-2"></i><span>Прикреплённый файл останется в разделе «Документы» объекта.</span></p>' +
                '<div class="finance-delete-error" data-finance-delete-error role="status" aria-live="polite"></div>' +
                '<div class="finance-delete-actions">' +
                    '<button class="ghost" type="button" data-finance-delete-cancel>Оставить</button>' +
                    '<button class="danger" type="button" data-finance-delete-confirm><i data-lucide="trash-2"></i><span>Удалить черновик</span></button>' +
                '</div>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-finance-delete-cancel]')) {
                closeFinanceDeleteModal(modal);
                return;
            }
            var confirmButton = event.target.closest('[data-finance-delete-confirm]');
            if (!confirmButton || confirmButton.disabled) return;
            var financeId = modal.dataset.financeId;
            var activeProjectId = modal.dataset.projectId;
            var errorNode = qs('[data-finance-delete-error]', modal);
            if (errorNode) errorNode.textContent = '';
            modal.classList.add('is-saving');
            withSubmitLock(confirmButton, function () {
                return api('/api/finances/' + encodeURIComponent(financeId), { method: 'DELETE' });
            }).then(function () {
                modal.classList.remove('is-saving');
                closeFinanceDeleteModal(modal);
                showFinanceToast('Финансовая операция удалена. Итоги объекта пересчитаны.');
                return loadProjectFinances(activeProjectId);
            }).catch(function (error) {
                modal.classList.remove('is-saving');
                if (errorNode) errorNode.textContent = financeDeleteErrorMessage(error);
                confirmButton.focus();
            });
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeFinanceDeleteModal(modal);
        });
        document.body.appendChild(modal);
        refreshLucideIcons(modal);
        return modal;
    }

    function openFinanceDeleteModal(form, button, projectId) {
        var modal = ensureFinanceDeleteModal();
        var direction = button.dataset.financeDeleteDirection || form.dataset.financeDirection || 'expense';
        var hasDocument = button.dataset.financeDeleteHasDocument === '1';
        var heading = direction === 'income' ? 'Удалить черновик поступления?' : 'Удалить черновик расхода?';
        modal.dataset.financeId = form.dataset.financeId;
        modal.dataset.projectId = String(projectId);
        qs('[data-finance-delete-heading]', modal).textContent = heading;
        qs('[data-finance-delete-preview-title]', modal).textContent = button.dataset.financeDeleteTitle || 'Финансовая операция';
        qs('[data-finance-delete-preview-amount]', modal).textContent = money(Number(button.dataset.financeDeleteAmount || 0));
        qs('[data-finance-delete-document-note]', modal).hidden = !hasDocument;
        qs('[data-finance-delete-error]', modal).textContent = '';
        modal.hidden = false;
        document.body.classList.add('finance-modal-lock');
        requestAnimationFrame(function () {
            modal.classList.add('is-open');
            var confirmButton = qs('[data-finance-delete-confirm]', modal);
            if (confirmButton) confirmButton.focus();
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
        return 0;
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


    function renderFinancePlanFromInvoices(items, summary) {
        var overview = financePaymentOverview(items);
        var order = ['overdue', 'today', 'week', 'later', 'no-date'];
        var groups = {};
        overview.pending.forEach(function (item) {
            var bucket = financePlanBucket(item);
            if (!groups[bucket.key]) groups[bucket.key] = { bucket: bucket, items: [] };
            groups[bucket.key].items.push(item);
        });
        var icons = { overdue: 'circle-alert', today: 'calendar-check-2', week: 'calendar-days', later: 'calendar-range', 'no-date': 'calendar-x-2' };
        var planRows = order.filter(function (key) { return groups[key] && groups[key].items.length; }).map(function (key) {
            var group = groups[key];
            var groupTotal = group.items.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
            return '<section class="finance-payable-group is-' + escapeHtml(key) + '">' +
                '<header class="finance-payable-group-head"><div><i data-lucide="' + escapeHtml(icons[key] || 'calendar') + '"></i><span><b>' + escapeHtml(group.bucket.title) + '</b><small>' + escapeHtml(financeCountText(group.items.length, 'счёт', 'счёта', 'счетов')) + '</small></span></div><strong>' + escapeHtml(money(groupTotal)) + '</strong></header>' +
                '<div class="finance-payable-list">' + group.items.map(function (item) {
                    var title = item.category || item.notes || 'Счёт к оплате';
                    var editorId = 'finance-payable-editor-' + String(item.id);
                    var dueDate = item.planned_date ? formatDisplayDate(item.planned_date) : 'Не указан';
                    var statusText = key === 'overdue' ? 'Срок прошёл' : (key === 'today' ? 'Сегодня' : (key === 'week' ? 'В ближайшие 7 дней' : (key === 'no-date' ? 'Нужно назначить' : 'Запланировано')));
                    return '<form class="finance-payable-row is-' + escapeHtml(key) + '" data-finance-edit-form data-finance-id="' + escapeHtml(item.id) + '" data-finance-direction="expense" data-finance-status="' + escapeHtml(item.status || 'planned') + '">' +
                        '<div class="finance-payable-main"><div class="finance-payable-file-icon"><i data-lucide="receipt-text"></i></div><div><b>' + escapeHtml(title) + '</b><small>' + escapeHtml((item.counterparty_name || 'Контрагент не указан') + ' · ' + financePaymentLabel(item.payment_kind)) + '</small></div>' + renderFinanceDocumentSlot(item) + '</div>' +
                        '<div class="finance-payable-due"><span>Срок оплаты</span><b>' + escapeHtml(dueDate) + '</b><small class="' + (key === 'overdue' ? 'is-overdue' : '') + '">' + escapeHtml(statusText) + '</small></div>' +
                        '<input name="paid_date" type="hidden" value="' + escapeHtml(item.paid_date || '') + '">' +
                        '<div class="finance-payable-amount"><span>Сумма</span><strong>' + escapeHtml(money(item.amount || 0)) + '</strong><small>' + escapeHtml(financePaymentLabel(item.payment_kind)) + '</small></div>' +
                        '<input name="notes" type="hidden" value="' + escapeHtml(item.notes || '') + '">' +
                        '<div class="finance-payable-actions"><button class="primary finance-payable-pay" type="button" data-finance-confirm-payment data-director-action data-finance-payment-title="' + escapeHtml(title) + '" data-finance-payment-amount="' + escapeHtml(item.amount || 0) + '"><i data-lucide="check"></i><span>Оплатить</span></button><button class="ghost compact finance-payable-settings" type="button" data-finance-payable-settings aria-expanded="false" aria-controls="' + escapeHtml(editorId) + '"><i data-lucide="sliders-horizontal"></i><span>Настроить</span></button></div>' +
                        '<div class="finance-payable-editor" id="' + escapeHtml(editorId) + '" data-finance-payable-editor hidden>' +
                            '<label><span>Оплатить до</span><input name="planned_date" type="date" value="' + escapeHtml(item.planned_date || '') + '"></label>' +
                            '<label><span>Статус</span><select name="status"><option value="planned"' + (item.status === 'planned' ? ' selected' : '') + '>Запланировано</option><option value="approved"' + (item.status === 'approved' ? ' selected' : '') + '>Подан на оплату</option><option value="cancelled"' + (item.status === 'cancelled' ? ' selected' : '') + '>Отменено</option></select></label>' +
                            '<button class="ghost compact" type="submit"><i data-lucide="save"></i><span>Сохранить изменения</span></button>' +
                            (item.status === 'planned' && !item.document_id ? '<button class="ghost compact danger finance-delete-button" type="button" data-finance-delete data-finance-delete-direction="expense" data-finance-delete-title="' + escapeHtml(title) + '" data-finance-delete-amount="' + escapeHtml(item.amount || 0) + '" data-finance-delete-has-document="0"><i data-lucide="trash-2"></i><span>Удалить черновик</span></button>' : '') +
                        '</div>' +
                    '</form>';
                }).join('') + '</div>' +
            '</section>';
        }).join('');
        return '<section class="finance-payables-board ui-card" data-finance-payables-board>' +
            '<header class="finance-payables-head"><div><span class="section-label">К оплате</span><h3>Счета, которые ждут оплаты</h3><p>Сначала просроченные, затем ближайшие. Один счёт — одно понятное действие.</p></div><button class="ghost" type="button" data-finance-open-modal="invoice"><i data-lucide="plus"></i><span>Добавить счёт</span></button></header>' +
            '<section class="finance-payables-balance"><div><span>Всего к оплате</span><strong>' + escapeHtml(money(overview.pendingTotal)) + '</strong><small>' + escapeHtml(financeCountText(overview.pending.length, 'неоплаченный счёт', 'неоплаченных счёта', 'неоплаченных счетов')) + '</small></div><div class="finance-payables-facts">' +
                '<span class="' + (overview.overdue.length ? 'is-overdue' : '') + '"><i data-lucide="circle-alert"></i><b>' + escapeHtml(String(overview.overdue.length)) + '</b> просрочено</span>' +
                '<span><i data-lucide="calendar-days"></i><b>' + escapeHtml(String(overview.week.length)) + '</b> на 7 дней</span>' +
                '<span><i data-lucide="calendar-x-2"></i><b>' + escapeHtml(String(overview.noDate.length)) + '</b> без даты</span>' +
            '</div>' +
            '</section>' +
            (planRows || '<div class="finance-plan-empty"><i data-lucide="badge-check"></i><b>Все счета оплачены</b><span>Новых платежей сейчас нет.</span><button class="ghost" type="button" data-finance-open-modal="invoice">Добавить счёт</button></div>') +
        '</section>';
    }

    function renderFinanceHero(projectId, summary, items) {
        var paidExpense = Number(summary && summary.paidExpense || 0);
        var paidIncome = Number(summary && summary.paidIncome || 0);
        var balance = Number(summary && summary.balance || 0);
        var overview = financePaymentOverview(items);
        var movementMax = Math.max(paidIncome, paidExpense, 1);
        var incomeWidth = Math.round(paidIncome / movementMax * 100);
        var expenseWidth = Math.round(paidExpense / movementMax * 100);
        return '<section class="finance-cash-overview ui-card">' +
            '<div class="finance-cash-head"><div><span class="section-label">Движение денег · с НДС</span><h3>Деньги на счетах и в кассе</h3><p>Показывает, сколько реально получено и оплачено. Не заменяет расчёт прибыли выше.</p></div><button class="ghost compact" type="button" data-finance-view-target="payments"><i data-lucide="calendar-days"></i><span>Открыть календарь</span></button></div>' +
            '<div class="finance-cash-layout">' +
                '<article class="finance-cash-balance ' + (balance < 0 ? 'is-danger' : '') + '"><span>Доступный денежный остаток</span><strong>' + escapeHtml(money(balance)) + '</strong><small>Получено ' + escapeHtml(money(paidIncome)) + ' − оплачено ' + escapeHtml(money(paidExpense)) + '</small></article>' +
                '<div class="finance-cash-movement">' +
                    '<div><span><i class="is-income" data-lucide="arrow-down-left"></i>Поступило</span><b>' + escapeHtml(money(paidIncome)) + '</b><em><i style="width:' + incomeWidth + '%"></i></em></div>' +
                    '<div><span><i class="is-expense" data-lucide="arrow-up-right"></i>Оплачено</span><b>' + escapeHtml(money(paidExpense)) + '</b><em><i style="width:' + expenseWidth + '%"></i></em></div>' +
                    '<div><span><i class="is-pending" data-lucide="clock-3"></i>Ещё к оплате</span><b>' + escapeHtml(money(overview.pendingTotal)) + '</b><small>' + escapeHtml(overview.pending.length ? financeCountText(overview.pending.length, 'счёт', 'счёта', 'счетов') + ' в календаре' : 'Нет неоплаченных счетов') + '</small></div>' +
                '</div>' +
            '</div>' +
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

    var activePositionEditor = null;
    var positionEditorReturnFocus = null;
    var positionEditorSubmitting = false;
    var positionEditorDurationSubmitting = false;

    function positionEditorHalfDay(value) {
        var number = Number(String(value == null ? '' : value).replace(',', '.'));
        if (!Number.isFinite(number) || number <= 0) return null;
        return Math.max(0.5, Math.min(3650, Math.round(number * 2) / 2));
    }

    function positionEditorItemFromRow(row) {
        var projectId = Number(row.getAttribute('data-position-project') || (state.selectedProject && state.selectedProject.id) || 0);
        var itemId = Number(row.getAttribute('data-position-id') || 0);
        var kind = row.getAttribute('data-position-kind') === 'work' ? 'work' : 'material';
        var scheduleAutoDays = positionEditorHalfDay(row.getAttribute('data-position-auto-days'));
        var scheduleDurationDays = positionEditorHalfDay(row.getAttribute('data-position-duration-days'));
        var source = ((state.materialsByProject && state.materialsByProject[projectId]) || []).find(function (item) {
            return Number(item && item.id || 0) === itemId;
        }) || {};
        return {
            projectId: projectId,
            itemId: itemId,
            kind: kind,
            title: String(source.title != null ? source.title : (row.getAttribute('data-position-title') || '')).trim(),
            unit: String(source.sourceUnit || source.unit || row.getAttribute('data-position-unit') || '').trim(),
            plannedQty: source.sourcePlannedQty != null
                ? source.sourcePlannedQty
                : (source.planned_qty != null ? source.planned_qty : (source.plannedQty != null ? source.plannedQty : row.getAttribute('data-position-qty') || '')),
            plannedPrice: source.planned_price != null
                ? source.planned_price
                : (source.plannedPrice != null ? source.plannedPrice : (row.getAttribute('data-position-price') || 0)),
            sectionTitle: String(source.sectionTitle || source.section_title || row.getAttribute('data-position-section') || '').trim(),
            scheduleAutoDays: scheduleAutoDays,
            scheduleDurationDays: scheduleDurationDays,
            scheduleDurationOverridden: row.getAttribute('data-position-duration-overridden') === '1'
        };
    }

    function ensurePositionEditorModal() {
        var existing = qs('[data-position-editor-modal]');
        if (existing) return existing;
        var modal = document.createElement('div');
        modal.className = 'position-editor-overlay';
        modal.hidden = true;
        modal.setAttribute('data-position-editor-modal', '');
        modal.innerHTML = '<section class="position-editor-card" role="dialog" aria-modal="true" aria-labelledby="position-editor-title" aria-describedby="position-editor-note">' +
            '<header class="position-editor-head"><div class="position-editor-heading"><span class="position-editor-icon" aria-hidden="true"><i data-lucide="pencil-line"></i></span><div><span class="position-editor-kicker" data-position-editor-kicker>Сметная позиция</span><h2 id="position-editor-title">Редактировать позицию</h2></div></div><button class="position-editor-close" type="button" data-position-editor-close aria-label="Закрыть"><i data-lucide="x" aria-hidden="true"></i></button></header>' +
            '<form class="position-editor-form" data-position-editor-form novalidate>' +
                '<label class="position-editor-field is-wide"><span>Название</span><input name="title" maxlength="300" autocomplete="off" required></label>' +
                '<fieldset class="position-editor-kind"><legend>Тип позиции</legend><div class="position-editor-kind-switch">' +
                    '<label><input type="radio" name="position_kind" value="material"><span><i data-lucide="package" aria-hidden="true"></i>Материал</span></label>' +
                    '<label><input type="radio" name="position_kind" value="work"><span><i data-lucide="hammer" aria-hidden="true"></i>Работа</span></label>' +
                '</div><p class="position-editor-kind-warning" data-position-kind-warning role="status" aria-live="polite" hidden></p></fieldset>' +
                '<div class="position-editor-grid"><label class="position-editor-field is-section"><span>Раздел</span><input name="section_title" maxlength="200" autocomplete="off" required></label><label class="position-editor-field"><span>Единица</span><input name="unit" maxlength="40" autocomplete="off" required></label><label class="position-editor-field"><span>Плановый объём</span><input name="planned_qty" type="number" min="0.000001" step="any" inputmode="decimal" required></label>' +
                    (canViewProcurementPrices() ? '<label class="position-editor-field"><span>Цена за единицу, ₽</span><input name="planned_price" type="number" min="0" step="0.01" inputmode="decimal" required></label>' : '') +
                '</div>' +
                '<section class="position-editor-duration" data-position-duration-panel hidden><header><div><span>Обычный график</span><strong>Длительность работы</strong></div><small data-position-duration-auto-hint></small></header><div class="position-editor-duration-controls">' +
                    '<div class="position-editor-duration-stepper" role="group" aria-label="Длительность работы в обычном графике"><button type="button" data-position-duration-step="-0.5" aria-label="Уменьшить на 0,5 дня">−</button><input name="schedule_duration_days" type="number" min="0.5" max="3650" step="0.5" inputmode="decimal" aria-label="Длительность работы, дней"><button type="button" data-position-duration-step="0.5" aria-label="Увеличить на 0,5 дня">+</button></div>' +
                    '<button class="position-editor-duration-auto" type="button" data-position-duration-auto>Авто</button><span class="position-editor-duration-status" data-position-duration-status role="status" aria-live="polite"></span>' +
                '</div><p>Сохраняется отдельно от строки сметы и не меняет «График производства».</p></section>' +
                '<p class="position-editor-note" id="position-editor-note"><i data-lucide="info" aria-hidden="true"></i><span>Меняется плановая строка сметы. Выполненный факт, заказы, приходы и расходы сохранятся.</span></p>' +
                '<div class="position-editor-error" data-position-editor-error role="alert" aria-live="polite" hidden></div>' +
                '<footer class="position-editor-actions"><button class="ghost" type="button" data-position-editor-close>Отмена</button><button class="primary" type="submit" data-position-editor-save><i data-lucide="check" aria-hidden="true"></i><span>Сохранить</span></button></footer>' +
            '</form>' +
        '</section>';
        document.body.appendChild(modal);
        refreshLucideIcons(modal);
        return modal;
    }

    function positionEditorErrorText(error) {
        var code = String(error && error.payload && error.payload.error || '');
        if (code === 'estimate_position_fields_required') return 'Заполните название, раздел, единицу и объём больше нуля.';
        if (code === 'estimate_position_fields_too_long') return 'Одно из полей получилось слишком длинным.';
        if (code === 'estimate_position_price_invalid') return 'Укажите корректную цену: число не меньше нуля.';
        if (code === 'price_fields_forbidden') return 'У вас нет права изменять сметную цену.';
        if (code === 'estimate_position_kind_mismatch') return 'Тип позиции изменился. Обновите страницу и попробуйте ещё раз.';
        if (code === 'bad_estimate_position_kind') return 'Выберите тип позиции: материал или работа.';
        if (code === 'estimate_position_title_kind_conflict') return 'Название похоже на другой тип. Выберите правильный тип выше или уточните название.';
        if (code === 'estimate_position_kind_change_blocked') {
            var blockers = Array.isArray(error.payload && error.payload.blockers) ? error.payload.blockers : [];
            var labels = blockers.map(function (item) { return String(item && item.label || '').trim(); }).filter(Boolean);
            return 'Перенос заблокирован, чтобы не потерять учёт.' + (labels.length ? (' Связано: ' + labels.slice(0, 3).join(', ') + (labels.length > 3 ? ' и другое.' : '.')) : '');
        }
        if (code === 'estimate_position_not_found') return 'Позиция больше не найдена в смете.';
        if (code === 'forbidden') return 'У вас нет права редактировать сметные позиции.';
        return appErrorMessage(error, 'Не удалось сохранить позицию. Попробуйте ещё раз.');
    }

    function updatePositionEditorDurationState(modal, item) {
        var panel = qs('[data-position-duration-panel]', modal);
        var form = qs('[data-position-editor-form]', modal);
        if (!panel || !form) return;
        var selectedKind = form.elements.position_kind && form.elements.position_kind.value === 'work' ? 'work' : 'material';
        var canEditDuration = !!item && item.kind === 'work' && selectedKind === 'work' && item.scheduleDurationDays != null;
        panel.hidden = !canEditDuration;
        if (!canEditDuration) return;
        var input = form.elements.schedule_duration_days;
        var autoButton = qs('[data-position-duration-auto]', panel);
        var autoHint = qs('[data-position-duration-auto-hint]', panel);
        if (input) {
            if (!positionEditorDurationSubmitting) input.value = String(item.scheduleDurationDays || item.scheduleAutoDays || 0.5);
            input.disabled = positionEditorDurationSubmitting;
        }
        if (autoHint) autoHint.textContent = item.scheduleAutoDays != null ? ('Авто: ' + String(item.scheduleAutoDays) + ' дн.') : 'Авторасчёт недоступен';
        if (autoButton) autoButton.disabled = positionEditorDurationSubmitting || !item.scheduleDurationOverridden;
        qsa('[data-position-duration-step]', panel).forEach(function (button) { button.disabled = positionEditorDurationSubmitting; });
        panel.classList.toggle('is-overridden', !!item.scheduleDurationOverridden);
    }

    function updatePositionEditorKindState(modal, originalKind) {
        var form = qs('[data-position-editor-form]', modal);
        if (!form) return;
        var selectedKind = form.elements.position_kind && form.elements.position_kind.value === 'work' ? 'work' : 'material';
        var changed = selectedKind !== originalKind;
        var kicker = qs('[data-position-editor-kicker]', modal);
        var warning = qs('[data-position-kind-warning]', modal);
        if (kicker) kicker.textContent = selectedKind === 'work' ? 'Работа' : 'Материал';
        modal.classList.toggle('is-work', selectedKind === 'work');
        modal.classList.toggle('is-material', selectedKind === 'material');
        if (warning) {
            warning.hidden = !changed;
            warning.textContent = changed
                ? (selectedKind === 'work'
                    ? 'После сохранения позиция появится в «Работах». Перед переносом проверим связанный учёт.'
                    : 'После сохранения позиция появится в «Материалах». Перед переносом проверим связанный учёт.')
                : '';
        }
        updatePositionEditorDurationState(modal, activePositionEditor);
    }

    function closePositionEditor(restoreFocus) {
        var modal = qs('[data-position-editor-modal]');
        if (!modal || positionEditorSubmitting) return;
        modal.hidden = true;
        document.body.classList.remove('position-editor-open');
        activePositionEditor = null;
        if (restoreFocus && positionEditorReturnFocus && document.contains(positionEditorReturnFocus) && typeof positionEditorReturnFocus.focus === 'function') {
            try { positionEditorReturnFocus.focus({ preventScroll: true }); } catch (focusError) { positionEditorReturnFocus.focus(); }
        }
        positionEditorReturnFocus = null;
    }

    function openPositionEditor(row, opener) {
        if (!row || !canManageSchedule()) return false;
        var item = positionEditorItemFromRow(row);
        if (!item.projectId || !item.itemId) return false;
        var modal = ensurePositionEditorModal();
        var form = qs('[data-position-editor-form]', modal);
        activePositionEditor = item;
        positionEditorReturnFocus = opener && opener.nodeType === 1 ? opener : (document.activeElement || row);
        positionEditorSubmitting = false;
        form.elements.title.value = item.title;
        form.elements.section_title.value = item.sectionTitle || 'Без раздела';
        form.elements.unit.value = item.unit;
        form.elements.planned_qty.value = String(item.plannedQty == null ? '' : item.plannedQty).replace(',', '.');
        if (form.elements.planned_price) {
            form.elements.planned_price.value = String(item.plannedPrice == null ? 0 : item.plannedPrice).replace(',', '.');
        }
        form.elements.position_kind.value = item.kind;
        updatePositionEditorKindState(modal, item.kind);
        var durationStatus = qs('[data-position-duration-status]', modal);
        if (durationStatus) { durationStatus.textContent = ''; durationStatus.classList.remove('is-error'); }
        var error = qs('[data-position-editor-error]', modal);
        if (error) { error.hidden = true; error.textContent = ''; }
        modal.hidden = false;
        document.body.classList.add('position-editor-open');
        refreshLucideIcons(modal);
        setTimeout(function () {
            try { form.elements.title.focus({ preventScroll: true }); } catch (focusError) { form.elements.title.focus(); }
            form.elements.title.select();
        }, 0);
        return true;
    }

    function refreshEditedPosition(item, response) {
        var projectId = item.projectId;
        var items = Array.isArray(response && response.items) ? response.items : [];
        if (Array.isArray(response && response.items)) state.materialsByProject[projectId] = items;
        var updated = response && response.item;
        if (!updated && items.length) updated = items.find(function (candidate) { return Number(candidate.id || 0) === item.itemId; });
        var savedKind = String(response && response.itemKind || (updated && updated.itemKind) || item.targetKind || item.kind) === 'work' ? 'work' : 'material';
        var kindChanged = savedKind !== item.kind;
        var project = state.projects.find(function (candidate) { return Number(candidate.id) === Number(projectId); }) || state.selectedProject;

        if (kindChanged) {
            rerenderProjectMaterialAndWorkViews(projectId);
            if (PMBI.planning && project && typeof PMBI.planning.loadSectionScheduleForecast === 'function') {
                PMBI.planning.loadSectionScheduleForecast(projectId, project.started_at || APP_TODAY, function () {
                    rerenderProjectMaterialAndWorkViews(projectId);
                    if (savedKind === 'work' && typeof PMBI.planning.focusProjectScheduleTarget === 'function') {
                        PMBI.planning.focusProjectScheduleTarget({ workId: item.itemId }, projectId);
                    }
                }, true);
            }
            if (savedKind === 'work') {
                activateProjectTab('schedule');
                if (PMBI.planning && typeof PMBI.planning.focusProjectScheduleTarget === 'function') {
                    PMBI.planning.focusProjectScheduleTarget({ workId: item.itemId }, projectId);
                }
                if (PMBI.warehouseControl && typeof PMBI.warehouseControl.load === 'function') {
                    PMBI.warehouseControl.load(projectId, true).catch(function () {});
                }
            } else if (PMBI.warehouseControl && typeof PMBI.warehouseControl.load === 'function') {
                var materialLoad = PMBI.warehouseControl.load(projectId, true);
                activateProjectTab('warehouse-control');
                materialLoad.then(function () {
                    if (typeof PMBI.warehouseControl.focusMaterial === 'function') PMBI.warehouseControl.focusMaterial(item.itemId, projectId);
                }).catch(function () {});
            }
            return;
        }

        if (savedKind === 'material' && PMBI.warehouseControl) {
            var patched = updated && typeof PMBI.warehouseControl.patchPosition === 'function'
                ? PMBI.warehouseControl.patchPosition(projectId, updated)
                : false;
            var focusMaterial = function () {
                if (typeof PMBI.warehouseControl.focusMaterial === 'function') PMBI.warehouseControl.focusMaterial(item.itemId, projectId);
            };
            if (patched) focusMaterial();
            else if (typeof PMBI.warehouseControl.load === 'function') PMBI.warehouseControl.load(projectId, true).then(focusMaterial).catch(function () {});
            return;
        }
        if (savedKind === 'work' && project && PMBI.planning && typeof PMBI.planning.loadSectionScheduleForecast === 'function') {
            PMBI.planning.loadSectionScheduleForecast(projectId, project.started_at || APP_TODAY, function () {
                rerenderProjectMaterialAndWorkViews(projectId);
                if (typeof PMBI.planning.focusProjectScheduleTarget === 'function') {
                    PMBI.planning.focusProjectScheduleTarget({ workId: item.itemId }, projectId);
                }
            }, true);
        }
    }

    function refreshPositionEditorSchedule(item) {
        var project = state.projects.find(function (candidate) { return Number(candidate.id) === Number(item.projectId); }) || state.selectedProject;
        if (!project || !PMBI.planning || typeof PMBI.planning.loadSectionScheduleForecast !== 'function') return;
        PMBI.planning.loadSectionScheduleForecast(item.projectId, project.started_at || APP_TODAY, function () {
            rerenderProjectMaterialAndWorkViews(item.projectId);
        }, true);
    }

    function patchPositionEditorDurationRows(item) {
        qsa('[data-position-editor][data-position-kind="work"]').forEach(function (row) {
            if (Number(row.getAttribute('data-position-project') || 0) !== Number(item.projectId)) return;
            if (Number(row.getAttribute('data-position-id') || 0) !== Number(item.itemId)) return;
            row.setAttribute('data-position-duration-days', item.scheduleDurationDays == null ? '' : String(item.scheduleDurationDays));
            row.setAttribute('data-position-auto-days', item.scheduleAutoDays == null ? '' : String(item.scheduleAutoDays));
            row.setAttribute('data-position-duration-overridden', item.scheduleDurationOverridden ? '1' : '0');
        });
    }

    function savePositionEditorDuration(reset, rawDays) {
        if (!activePositionEditor || activePositionEditor.kind !== 'work' || positionEditorDurationSubmitting) return Promise.resolve(null);
        var item = Object.assign({}, activePositionEditor);
        var durationDays = reset ? null : positionEditorHalfDay(rawDays);
        var modal = qs('[data-position-editor-modal]');
        var status = modal ? qs('[data-position-duration-status]', modal) : null;
        if (!reset && durationDays == null) {
            if (status) { status.textContent = 'Укажите длительность от 0,5 дня.'; status.classList.add('is-error'); }
            return Promise.resolve(null);
        }
        positionEditorDurationSubmitting = true;
        if (status) { status.textContent = 'Сохраняем…'; status.classList.remove('is-error'); }
        if (modal) updatePositionEditorDurationState(modal, activePositionEditor);
        return api('/api/projects/' + item.projectId + '/section-schedule-override', {
            method: 'POST',
            body: JSON.stringify(reset
                ? { item_id: item.itemId, reset: true }
                : { item_id: item.itemId, duration_days: durationDays })
        }).then(function (response) {
            positionEditorDurationSubmitting = false;
            item.scheduleDurationDays = reset ? item.scheduleAutoDays : durationDays;
            item.scheduleDurationOverridden = !reset;
            patchPositionEditorDurationRows(item);
            if (activePositionEditor && activePositionEditor.projectId === item.projectId && activePositionEditor.itemId === item.itemId) {
                activePositionEditor.scheduleDurationDays = item.scheduleDurationDays;
                activePositionEditor.scheduleDurationOverridden = item.scheduleDurationOverridden;
            }
            if (modal && activePositionEditor) updatePositionEditorDurationState(modal, activePositionEditor);
            if (status && activePositionEditor && activePositionEditor.projectId === item.projectId && activePositionEditor.itemId === item.itemId) {
                status.textContent = reset ? 'Авторасчёт восстановлен' : 'Сохранено';
                status.classList.remove('is-error');
            }
            refreshPositionEditorSchedule(item);
            return response;
        }).catch(function (error) {
            positionEditorDurationSubmitting = false;
            if (modal && activePositionEditor) updatePositionEditorDurationState(modal, activePositionEditor);
            var message = appErrorMessage(error, reset ? 'Не удалось вернуть автоматическую длительность.' : 'Не удалось сохранить длительность работы.');
            if (status && activePositionEditor && activePositionEditor.projectId === item.projectId && activePositionEditor.itemId === item.itemId) {
                status.textContent = message;
                status.classList.add('is-error');
            }
            showAppNotice(message, 'error');
            return null;
        });
    }

    function initPositionEditor() {
        if (document.documentElement.dataset.positionEditorBound === '1') return;
        document.documentElement.dataset.positionEditorBound = '1';
        document.addEventListener('contextmenu', function (event) {
            var row = event.target && event.target.closest ? event.target.closest('[data-position-editor]') : null;
            if (!row || !canManageSchedule()) return;
            event.preventDefault();
            openPositionEditor(row, event.target);
        });
        document.addEventListener('keydown', function (event) {
            var isContextKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
            if (!isContextKey) return;
            var row = event.target && event.target.closest ? event.target.closest('[data-position-editor]') : null;
            if (!row || !canManageSchedule()) return;
            event.preventDefault();
            openPositionEditor(row, event.target);
        });
        document.addEventListener('click', function (event) {
            var opener = event.target && event.target.closest ? event.target.closest('[data-position-editor-open]') : null;
            if (opener) {
                var row = opener.closest('[data-position-editor]');
                if (!row || !canManageSchedule()) return;
                event.preventDefault();
                event.stopPropagation();
                openPositionEditor(row, opener);
                return;
            }
            var close = event.target && event.target.closest ? event.target.closest('[data-position-editor-close]') : null;
            if (!close) return;
            event.preventDefault();
            closePositionEditor(true);
        });
        var modal = ensurePositionEditorModal();
        modal.addEventListener('mousedown', function (event) {
            if (event.target === modal) closePositionEditor(true);
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePositionEditor(true);
                return;
            }
            if (event.key !== 'Tab') return;
            var focusable = qsa('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', modal).filter(function (node) { return !node.hidden; });
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        var form = qs('[data-position-editor-form]', modal);
        form.addEventListener('change', function (event) {
            if (!event.target || event.target.name !== 'position_kind' || !activePositionEditor) return;
            updatePositionEditorKindState(modal, activePositionEditor.kind);
            var error = qs('[data-position-editor-error]', modal);
            if (error) { error.hidden = true; error.textContent = ''; }
        });
        qsa('[data-position-duration-step]', modal).forEach(function (button) {
            button.addEventListener('click', function () {
                var input = form.elements.schedule_duration_days;
                if (!input) return;
                var current = positionEditorHalfDay(input.value) || (activePositionEditor && activePositionEditor.scheduleDurationDays) || 0.5;
                var next = Math.max(0.5, Math.min(3650, Math.round((current + Number(button.dataset.positionDurationStep || 0)) * 2) / 2));
                input.value = String(next);
                savePositionEditorDuration(false, next);
            });
        });
        if (form.elements.schedule_duration_days) {
            form.elements.schedule_duration_days.addEventListener('change', function () {
                savePositionEditorDuration(false, form.elements.schedule_duration_days.value);
            });
            form.elements.schedule_duration_days.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                savePositionEditorDuration(false, form.elements.schedule_duration_days.value);
            });
        }
        var durationAuto = qs('[data-position-duration-auto]', modal);
        if (durationAuto) {
            durationAuto.addEventListener('click', function () { savePositionEditorDuration(true, null); });
        }
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!activePositionEditor || positionEditorSubmitting) return;
            var qty = Number(String(form.elements.planned_qty.value || '').replace(',', '.'));
            var priceInput = form.elements.planned_price;
            var price = priceInput ? Number(String(priceInput.value || '').replace(',', '.')) : null;
            var title = form.elements.title.value.trim();
            var unit = form.elements.unit.value.trim();
            var sectionTitle = form.elements.section_title.value.trim();
            var selectedKind = form.elements.position_kind.value === 'work' ? 'work' : 'material';
            var error = qs('[data-position-editor-error]', modal);
            if (!title || !unit || !sectionTitle || !Number.isFinite(qty) || qty <= 0) {
                error.textContent = 'Заполните название, раздел, единицу и объём больше нуля.';
                error.hidden = false;
                return;
            }
            if (priceInput && (!Number.isFinite(price) || price < 0)) {
                error.textContent = 'Укажите корректную цену: число не меньше нуля.';
                error.hidden = false;
                return;
            }
            var item = Object.assign({}, activePositionEditor);
            item.targetKind = selectedKind;
            var updatePayload = { title: title, unit: unit, plannedQty: qty, sectionTitle: sectionTitle, expectedKind: item.kind, targetKind: selectedKind };
            if (priceInput) updatePayload.plannedPrice = price;
            var save = qs('[data-position-editor-save]', modal);
            positionEditorSubmitting = true;
            save.disabled = true;
            save.setAttribute('aria-busy', 'true');
            error.hidden = true;
            api('/api/projects/' + item.projectId + '/estimate-items/' + item.itemId + '/update', {
                method: 'POST',
                body: JSON.stringify(updatePayload)
            }).then(function (response) {
                positionEditorSubmitting = false;
                closePositionEditor(false);
                refreshEditedPosition(item, response || {});
                refreshProjectOverview(item.projectId);
                var savedKind = String(response && response.itemKind || selectedKind) === 'work' ? 'work' : 'material';
                var moved = savedKind !== item.kind;
                showAppNotice(moved ? (savedKind === 'work' ? 'Перенесено в работы' : 'Перенесено в материалы') : (savedKind === 'work' ? 'Работа обновлена' : 'Материал обновлён'), 'success');
            }).catch(function (requestError) {
                error.textContent = positionEditorErrorText(requestError);
                error.hidden = false;
            }).finally(function () {
                positionEditorSubmitting = false;
                save.disabled = false;
                save.removeAttribute('aria-busy');
            });
        });
    }

    var positionHighlightTimer = null;
    var materialDeepLinkToken = 0;

    function highlightPositionRow(row) {
        if (!row) return false;
        if (positionHighlightTimer) clearTimeout(positionHighlightTimer);
        qsa('.position-target-focus').forEach(function (candidate) {
            if (candidate !== row) candidate.classList.remove('position-target-focus');
        });
        row.classList.add('position-target-focus');
        var reducedMotion = false;
        try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (motionError) {}
        if (typeof row.scrollIntoView === 'function') {
            try { row.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' }); } catch (scrollError) { row.scrollIntoView(); }
        }
        positionHighlightTimer = setTimeout(function () {
            row.classList.remove('position-target-focus');
            positionHighlightTimer = null;
        }, reducedMotion ? 1400 : 2400);
        return true;
    }

    function projectDeepLinkTarget(sourceUrl) {
        var url = sourceUrl instanceof URL ? sourceUrl : new URL(sourceUrl || location.href, location.href);
        var params = url.searchParams;
        return {
            projectId: Number(params.get('openProject') || 0),
            tab: params.get('tab') || '',
            materialId: Number(params.get('materialId') || 0),
            workId: Number(params.get('workId') || 0),
            stageId: Number(params.get('stageId') || 0),
            sectionTitle: params.get('sectionTitle') || ''
        };
    }

    function syncRouterLocation() {
        if (PMBI.router && typeof PMBI.router.syncCurrentUrl === 'function') PMBI.router.syncCurrentUrl();
    }

    function consumeProjectDeepLink(kind) {
        try {
            var params = new URLSearchParams(location.search);
            if (kind === 'material') params.delete('materialId');
            if (kind === 'work') params.delete('workId');
            if (kind === 'stage') params.delete('stageId');
            if (kind === 'work' || kind === 'stage') params.delete('sectionTitle');
            history.replaceState(history.state, '', location.pathname + (params.toString() ? ('?' + params.toString()) : ''));
            syncRouterLocation();
        } catch (historyError) {}
    }

    function focusProjectDeepLink(projectId, sourceUrl) {
        projectId = Number(projectId || 0);
        if (!projectId || !state.selectedProject || Number(state.selectedProject.id) !== projectId) return false;
        var target = projectDeepLinkTarget(sourceUrl || location.href);
        if (target.projectId && target.projectId !== projectId) return false;
        if (target.materialId && PMBI.warehouseControl && typeof PMBI.warehouseControl.load === 'function') {
            var requestToken = ++materialDeepLinkToken;
            PMBI.warehouseControl.load(projectId, false).then(function () {
                if (requestToken !== materialDeepLinkToken) return;
                var current = projectDeepLinkTarget(location.href);
                if (current.materialId !== target.materialId || current.projectId !== projectId) return;
                if (PMBI.warehouseControl.focusMaterial(target.materialId, projectId)) consumeProjectDeepLink('material');
            }).catch(function () {});
            return true;
        }
        if ((target.workId || target.stageId || target.sectionTitle) && PMBI.planning && typeof PMBI.planning.focusProjectScheduleTarget === 'function') {
            var focused = PMBI.planning.focusProjectScheduleTarget(target, projectId);
            if (focused) consumeProjectDeepLink(target.workId ? 'work' : 'stage');
            return focused;
        }
        return false;
    }

    function handleReminderNavigation(sourceUrl) {
        var url = sourceUrl instanceof URL ? sourceUrl : new URL(sourceUrl || '', location.href);
        if (page !== 'projects' || url.pathname !== '/app/projects') return false;
        var target = projectDeepLinkTarget(url);
        if (!target.projectId) return false;
        var project = state.projects.find(function (item) { return Number(item.id) === target.projectId; });
        var detail = qs('[data-project-detail]');
        if (!project || !detail) return false;
        try {
            if (url.href !== location.href) history.pushState({}, '', url.href);
        } catch (historyError) {}
        if (!state.selectedProject || Number(state.selectedProject.id) !== target.projectId || detail.hidden) openProject(target.projectId);
        var tab = target.materialId ? 'warehouse-control' : ((target.workId || target.stageId) ? 'schedule' : (target.tab || 'overview'));
        activateProjectTab(tab);
        focusProjectDeepLink(target.projectId, url);
        return true;
    }

    var reminderRequestToken = 0;
    var reminderRefreshInFlight = false;
    var reminderLastItems = [];
    var reminderLastStatus = { failedCount: 0, totalProjects: 0, fullFailure: false };
    var reminderLastNoticeSignature = '';
    var reminderLastNoticeKeys = {};
    var reminderNoticeTimer = 0;
    var reminderMotionTimer = 0;
    var reminderBoundaryTimer = 0;
    var reminderRefreshQueued = false;

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
            task.assignee_name ? ('исполнитель: ' + task.assignee_name) : '',
            task.due_at ? stateText + ' ' + formatDisplayDate(task.due_at) : ''
        ];
        return bits.filter(Boolean).join(' • ');
    }

    function reminderStageText(stage) {
        var plannedStart = stage.planned_start || stage.plannedStart || '';
        var plannedEnd = stage.planned_end || stage.plannedEnd || '';
        var statusCode = stage.status_code || stage.statusCode || '';
        var bits = [
            stage.progress != null ? ('готовность ' + percent(stage.progress) + '%') : '',
            plannedStart && stage.timing === 'soon' ? ('старт ' + formatDisplayDate(plannedStart)) : '',
            plannedEnd ? ('план до ' + formatDisplayDate(plannedEnd)) : '',
            statusCode ? ('статус: ' + statusLabel(statusCode)) : ''
        ];
        return bits.filter(Boolean).join(' • ');
    }

    function reminderSchedulePresentation(stage) {
        var timing = String(stage && stage.timing || '').toLowerCase();
        var plannedStart = stage && (stage.planned_start || stage.plannedStart) || '';
        var daysUntilStart = Number(stage && stage.daysUntilStart);
        var statusCode = String(stage && (stage.status_code || stage.statusCode) || '').toLowerCase();
        var alreadyStarted = Number(stage && stage.progress || 0) > 0 || statusCode === 'started' || statusCode === 'in_progress';
        if (timing === 'blocked') return { kind: 'danger', label: 'Заблокировано', focusWhen: 'today' };
        if (timing === 'overdue') return { kind: 'danger', label: 'Просрочено', focusWhen: 'today' };
        if (timing === 'due_today') return { kind: 'warn', label: 'Завершить сегодня', focusWhen: 'today' };
        if (timing === 'starts_today') return { kind: 'warn', label: 'Начать сегодня', focusWhen: 'today' };
        if (timing === 'today') return { kind: 'warn', label: alreadyStarted ? 'Сегодня в работе' : 'По плану сегодня', focusWhen: 'today' };
        if (timing === 'soon') {
            var soonLabel = daysUntilStart === 1 ? 'Начать завтра' : (plannedStart ? ('Начать ' + formatDisplayDate(plannedStart)) : 'Скоро начать');
            return { kind: 'info', label: soonLabel, focusWhen: 'soon' };
        }
        return { kind: 'warn', label: 'Проблемный этап', focusWhen: 'today' };
    }

    function reminderProcurementText(alert) {
        var bits = [
            alert.phase === 'order' && Number(alert.toOrderQty || alert.missingQty || 0) > 0
                ? ('заказать ' + quantityText(alert.toOrderQty || alert.missingQty) + (alert.unit ? (' ' + alert.unit) : ''))
                : '',
            alert.phase === 'order' && Number(alert.toReceiveQty || 0) > 0
                ? ('уже заказано, ждём ' + quantityText(alert.toReceiveQty) + (alert.unit ? (' ' + alert.unit) : ''))
                : '',
            alert.phase === 'delivery' && Number(alert.toReceiveQty || 0) > 0
                ? ('ждём ' + quantityText(alert.toReceiveQty) + (alert.unit ? (' ' + alert.unit) : ''))
                : (alert.leadDays ? ('срок поставки ' + alert.leadDays + ' дн.') : ''),
            (alert.needOnSiteDate || alert.startDate) ? ('на объект к ' + formatDisplayDate(alert.needOnSiteDate || alert.startDate)) : ''
        ];
        return bits.filter(Boolean).join(' • ');
    }

    function reminderProcurementSortAt(alert) {
        if (!alert) return '';
        return alert.phase === 'delivery'
            ? (alert.needOnSiteDate || alert.startDate || alert.orderByDate || '')
            : (alert.orderByDate || alert.needOnSiteDate || alert.startDate || '');
    }

    function reminderShortageText(alert) {
        var bits = [
            'Не хватает ' + quantityText(alert.missingQty) + (alert.unit ? (' ' + alert.unit) : ''),
            alert.workDate ? ('нужно к работе ' + formatDisplayDate(alert.workDate)) : (alert.needByDate ? ('нужно к ' + formatDisplayDate(alert.needByDate)) : '')
        ];
        return bits.filter(Boolean).join(' • ');
    }

    function reminderMaterialDetailText(alert) {
        alert = alert || {};
        var bits = [];
        if (Number(alert.leadDays || 0) > 0) bits.push('поставка ' + Number(alert.leadDays) + ' дн.');
        var targetDate = alert.needOnSiteDate || alert.startDate || alert.workDate || alert.needByDate || '';
        if (targetDate) bits.push('на объект к ' + formatDisplayDate(targetDate));
        return bits.join(' • ');
    }

    function reminderMaterialItem(projectId, projectTitle, alert, kind, label, text) {
        alert = alert || {};
        var actionKind = alert.phase === 'delivery' ? 'delivery' : 'order';
        var actionQty = actionKind === 'delivery'
            ? Number(alert.toReceiveQty || 0)
            : Number(alert.toOrderQty || alert.missingQty || 0);
        if (!Number.isFinite(actionQty) || actionQty < 0) actionQty = 0;
        return {
            group: 'materials',
            projectId: projectId,
            materialId: alert.materialId || '',
            actionKind: actionKind,
            actionQty: actionQty,
            unit: alert.unit || '',
            kind: kind,
            sortAt: reminderProcurementSortAt(alert),
            label: label,
            subject: alert.title || 'Материал',
            title: projectTitle,
            scope: reminderProcurementScope(alert),
            text: text,
            materialDetail: reminderMaterialDetailText(alert),
            href: '/app/projects?openProject=' + projectId + '&tab=warehouse-control&materialId=' + encodeURIComponent(alert.materialId || '')
        };
    }

    function buildReminderItemsForProject(project, notifications) {
        var projectId = Number(project.id);
        var title = project.title || 'Объект';
        var items = [];
        if (!notifications) return items;
        if (notifications.missingDailyReport && notifications.reportReminderActive) {
            items.push({ group: 'reports', projectId: projectId, sourceId: 'report:' + String(notifications.today || APP_TODAY), kind: 'warn', focusWhen: 'evening', sortAt: notifications.today || APP_TODAY, label: 'До конца дня', subject: 'Нет отчёта за сегодня', title: title, scope: 'Журнал объекта', text: 'Запишите выполненные работы, людей и технику. Можно надиктовать за минуту.', href: '/app/projects?openProject=' + projectId + '&tab=reports' });
        }
        (notifications.overdueTasks || []).forEach(function (task) {
            items.push({ group: 'tasks', projectId: projectId, sourceId: task.id || '', kind: 'danger', focusWhen: 'today', sortAt: task.due_at || '', label: 'Просрочено', subject: task.title || 'Задача', title: title, scope: reminderTaskScope(task), text: reminderTaskText(task, 'срок был'), href: '/app/projects?openProject=' + projectId + '&tab=tasks' });
        });
        (notifications.dueSoonTasks || []).forEach(function (task) {
            var dueDate = String(task.due_at || '').slice(0, 10);
            var isDueToday = !!dueDate && dueDate === String(notifications.today || APP_TODAY);
            var dueLabel = isDueToday ? 'Сделать сегодня' : 'Срок скоро';
            items.push({ group: 'tasks', projectId: projectId, sourceId: task.id || '', kind: isDueToday ? 'warn' : 'info', focusWhen: isDueToday ? 'today' : 'soon', sortAt: task.due_at || '', label: dueLabel, subject: task.title || 'Задача', title: title, scope: reminderTaskScope(task), text: reminderTaskText(task, isDueToday ? 'срок' : 'до'), href: '/app/projects?openProject=' + projectId + '&tab=tasks' });
        });
        (notifications.blockerLogs || []).forEach(function (log) {
            items.push({ group: 'journal', projectId: projectId, sourceId: log.id || '', kind: 'danger', focusWhen: 'today', sortAt: log.report_date || '', label: 'Блокер', subject: 'Проблема из отчёта', title: title, scope: reminderBlockerScope(log), text: (log.blockers || log.title || 'Есть блокер') + (log.report_date ? ' • отчёт от ' + formatDisplayDate(log.report_date) : ''), href: '/app/projects?openProject=' + projectId + '&tab=reports' });
        });
        var scheduleAlerts = Array.isArray(notifications.scheduleAlerts) ? notifications.scheduleAlerts : (notifications.problemStages || []);
        scheduleAlerts.forEach(function (stage) {
            var presentation = reminderSchedulePresentation(stage);
            var plannedStart = stage.planned_start || stage.plannedStart || '';
            var plannedEnd = stage.planned_end || stage.plannedEnd || '';
            items.push({ group: 'works', projectId: projectId, sourceId: stage.id || '', kind: presentation.kind, focusWhen: presentation.focusWhen, sortAt: plannedStart || plannedEnd, label: presentation.label, subject: stage.title || 'Этап работ', title: title, scope: reminderStageScope(stage), text: reminderStageText(stage), href: '/app/projects?openProject=' + projectId + '&tab=schedule&stageId=' + encodeURIComponent(stage.id || '') + '&sectionTitle=' + encodeURIComponent(stage.sectionTitle || stage.title || '') });
        });
        if (Array.isArray(notifications.shortageAlerts)) {
            var procurementByMaterialId = {};
            var renderedProcurement = {};
            (notifications.procurementAlerts || []).forEach(function (alert) {
                var procurementKey = String(alert.materialId || '');
                if (procurementKey) procurementByMaterialId[procurementKey] = alert;
            });
            notifications.shortageAlerts.forEach(function (shortage) {
                var materialKey = String(shortage.materialId || '');
                var procurement = procurementByMaterialId[materialKey] || {};
                if (procurement.materialId && materialKey) renderedProcurement[materialKey] = true;
                var daysUntilWork = shortage.daysUntilWork == null || shortage.daysUntilWork === '' ? null : Number(shortage.daysUntilWork);
                var urgentShortage = procurement.status === 'critical' || (daysUntilWork != null && Number.isFinite(daysUntilWork) && daysUntilWork <= 1);
                var kind = urgentShortage ? 'danger' : (procurement.status === 'watch' ? 'info' : 'warn');
                var merged = Object.assign({}, shortage, procurement);
                if (!merged.phase) merged.phase = 'order';
                var label = merged.phase === 'delivery'
                    ? ('Поставка к ' + formatDisplayDate(merged.needOnSiteDate || merged.startDate || merged.workDate || merged.needByDate))
                    : (merged.orderByDate ? ('Заказать до ' + formatDisplayDate(merged.orderByDate)) : (merged.status === 'critical' ? 'Закупка горит' : (merged.status === 'soon' ? 'Скоро закупка' : 'Нужно заказать')));
                var procurementText = procurement.orderByDate ? reminderProcurementText(merged) : reminderShortageText(shortage);
                items.push(reminderMaterialItem(projectId, title, merged, kind, label, procurementText));
            });
            (notifications.procurementAlerts || []).forEach(function (alert) {
                if (renderedProcurement[String(alert.materialId || '')]) return;
                var kind = alert.status === 'critical' ? 'danger' : (alert.status === 'soon' ? 'warn' : 'info');
                var label = alert.phase === 'delivery'
                    ? ('Поставка к ' + formatDisplayDate(alert.needOnSiteDate || alert.startDate))
                    : (alert.orderByDate ? ('Заказать до ' + formatDisplayDate(alert.orderByDate)) : (kind === 'danger' ? 'Закупка горит' : 'Скоро закупка'));
                items.push(reminderMaterialItem(projectId, title, alert, kind, label, reminderProcurementText(alert)));
            });
        } else {
            (notifications.procurementAlerts || []).forEach(function (alert) {
                var kind = alert.status === 'critical' ? 'danger' : (alert.status === 'soon' ? 'warn' : 'info');
                var label = alert.phase === 'delivery'
                    ? ('Поставка к ' + formatDisplayDate(alert.needOnSiteDate || alert.startDate))
                    : (alert.orderByDate ? ('Заказать до ' + formatDisplayDate(alert.orderByDate)) : (kind === 'danger' ? 'Закупка горит' : 'Скоро закупка'));
                items.push(reminderMaterialItem(projectId, title, alert, kind, label, reminderProcurementText(alert)));
            });
        }
        return items;
    }

    function reminderSeverityRank(kind) {
        var rank = { danger: 0, warn: 1, info: 2 }[kind];
        return rank == null ? 9 : rank;
    }

    function reminderSeverityLabel(kind) {
        return kind === 'danger' ? 'Срочно' : (kind === 'warn' ? 'Скоро' : 'Контроль');
    }

    function reminderPlural(count, one, few, many) {
        var value = Math.abs(Number(count || 0));
        var lastTwo = value % 100;
        var last = value % 10;
        if (lastTwo >= 11 && lastTwo <= 19) return many;
        if (last === 1) return one;
        if (last >= 2 && last <= 4) return few;
        return many;
    }

    function reminderGroupDefinitions() {
        return [
            { key: 'materials', title: 'Материалы', icon: 'package-search', order: 0 },
            { key: 'works', title: 'По графику', icon: 'hard-hat', order: 1 },
            { key: 'tasks', title: 'Задачи', icon: 'list-checks', order: 2 },
            { key: 'reports', title: 'Закрыть день', icon: 'notebook-pen', order: 3 },
            { key: 'other', title: 'Прочее', icon: 'bell', order: 4 },
            { key: 'journal', title: 'Блокеры', icon: 'triangle-alert', order: 5 }
        ];
    }

    function reminderMaterialProjectGroups(items) {
        var groups = [];
        var byProject = {};
        (items || []).forEach(function (item) {
            if (!item || item.group !== 'materials') return;
            var projectKey = item.projectId ? ('id:' + String(item.projectId)) : ('title:' + String(item.title || 'Объект'));
            if (!byProject[projectKey]) {
                byProject[projectKey] = {
                    key: projectKey,
                    projectId: item.projectId || '',
                    title: item.title || 'Объект',
                    items: [],
                    seen: {},
                    orderCount: 0,
                    deliveryCount: 0,
                    rank: 9,
                    sortAt: '9999-12-31'
                };
                groups.push(byProject[projectKey]);
            }
            var group = byProject[projectKey];
            var materialKey = item.materialId
                ? ('id:' + String(item.materialId))
                : ['fallback', item.subject || '', item.unit || '', item.actionKind || '', item.href || ''].join('|');
            if (group.seen[materialKey]) return;
            group.seen[materialKey] = true;
            group.items.push(item);
            var actionQty = Number(item.actionQty || 0);
            if (item.actionKind === 'delivery') group.deliveryCount += 1;
            else if (Number.isFinite(actionQty) && actionQty > 0) group.orderCount += 1;
            group.rank = Math.min(group.rank, reminderSeverityRank(item.kind));
            var sortAt = String(item.sortAt || '9999-12-31');
            if (sortAt < group.sortAt) group.sortAt = sortAt;
        });
        groups.forEach(function (group) {
            delete group.seen;
            group.items.sort(function (left, right) {
                var severityDifference = reminderSeverityRank(left.kind) - reminderSeverityRank(right.kind);
                if (severityDifference) return severityDifference;
                return String(left.sortAt || '9999-12-31').localeCompare(String(right.sortAt || '9999-12-31'));
            });
        });
        groups.sort(function (left, right) {
            return left.rank - right.rank || left.sortAt.localeCompare(right.sortAt) || String(left.title).localeCompare(String(right.title), 'ru');
        });
        return groups;
    }

    function reminderMaterialSnapshot(items) {
        var groups = reminderMaterialProjectGroups(items);
        return groups.reduce(function (summary, group) {
            summary.orderCount += group.orderCount;
            summary.deliveryCount += group.deliveryCount;
            if (group.orderCount > 0) summary.orderProjects += 1;
            var urgentOrderCount = 0;
            var urgentDeliveryCount = 0;
            group.items.forEach(function (item) {
                if (reminderSeverityRank(item.kind) !== 0) return;
                if (item.actionKind === 'delivery') urgentDeliveryCount += 1;
                else if (Number(item.actionQty || 0) > 0) urgentOrderCount += 1;
            });
            summary.todayOrderCount += urgentOrderCount;
            summary.todayDeliveryCount += urgentDeliveryCount;
            if (urgentOrderCount) summary.todayOrderProjects += 1;
            if (urgentDeliveryCount) summary.todayDeliveryProjects += 1;
            if (group.items.length) {
                summary.totalProjects += 1;
                if (group.rank === 0) summary.todayProjects += 1;
                else summary.soonProjects += 1;
            }
            return summary;
        }, {
            orderCount: 0,
            deliveryCount: 0,
            orderProjects: 0,
            totalProjects: 0,
            todayProjects: 0,
            soonProjects: 0,
            todayOrderCount: 0,
            todayOrderProjects: 0,
            todayDeliveryCount: 0,
            todayDeliveryProjects: 0
        });
    }

    function reminderFocusSnapshot(items) {
        var materials = reminderMaterialSnapshot(items);
        var works = (items || []).filter(function (item) { return item.group === 'works'; });
        var tasks = (items || []).filter(function (item) { return item.group === 'tasks'; });
        var reports = (items || []).filter(function (item) { return item.group === 'reports'; });
        var blockers = (items || []).filter(function (item) { return item.group === 'journal'; });
        var otherAttention = (items || []).filter(function (item) { return item.group === 'other' && (item.kind === 'danger' || item.kind === 'warn'); });
        var worksToday = works.filter(function (item) { return item.focusWhen === 'today'; }).length;
        var worksSoon = works.filter(function (item) { return item.focusWhen === 'soon'; }).length;
        var tasksToday = tasks.filter(function (item) { return item.focusWhen === 'today'; }).length;
        var tasksSoon = tasks.filter(function (item) { return item.focusWhen === 'soon'; }).length;
        var materialActions = materials.totalProjects;
        var actionCount = materialActions + works.length + tasks.length + reports.length + blockers.length + otherAttention.length;
        return {
            materials: materials,
            works: works.length,
            worksToday: worksToday,
            worksSoon: worksSoon,
            tasks: tasks.length,
            tasksToday: tasksToday,
            tasksSoon: tasksSoon,
            reports: reports.length,
            blockers: blockers.length,
            actionCount: actionCount,
            todayCount: worksToday + tasksToday + reports.length + blockers.length + otherAttention.length + materials.todayProjects,
            soonCount: worksSoon + tasksSoon + materials.soonProjects
        };
    }

    function reminderFocusCardMarkup(tone, icon, eyebrow, count, countLabel, detail) {
        return '<div class="reminder-focus-card is-' + escapeHtml(tone) + '" role="listitem">' +
            '<span class="reminder-focus-card-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(icon) + '"></i></span>' +
            '<span class="reminder-focus-card-copy"><small>' + escapeHtml(eyebrow) + '</small><strong>' + count + ' ' + escapeHtml(countLabel) + '</strong><em>' + escapeHtml(detail) + '</em></span>' +
        '</div>';
    }

    function reminderFocusOverviewMarkup(items) {
        var snapshot = reminderFocusSnapshot(items);
        var cards = [];
        if (snapshot.reports) {
            cards.push(reminderFocusCardMarkup('report', 'notebook-pen', 'До конца дня', snapshot.reports, reminderPlural(snapshot.reports, 'отчёт', 'отчёта', 'отчётов'), 'нет за сегодня'));
        }
        if (snapshot.works) {
            var workDetail = [];
            if (snapshot.worksToday) workDetail.push('сегодня ' + snapshot.worksToday);
            if (snapshot.worksSoon) workDetail.push('скоро ' + snapshot.worksSoon);
            cards.push(reminderFocusCardMarkup('works', 'hard-hat', 'По графику', snapshot.works, reminderPlural(snapshot.works, 'этап', 'этапа', 'этапов'), workDetail.join(' · ') || 'на контроле'));
        }
        if (snapshot.materials.orderCount || snapshot.materials.deliveryCount) {
            var hasOrders = snapshot.materials.orderCount > 0;
            var materialCount = hasOrders ? snapshot.materials.orderCount : snapshot.materials.deliveryCount;
            var materialProjects = hasOrders ? snapshot.materials.orderProjects : snapshot.materials.totalProjects;
            var materialDetail = materialProjects + ' ' + reminderPlural(materialProjects, 'объект', 'объекта', 'объектов');
            if (snapshot.materials.todayProjects) materialDetail += ' · срочно ' + snapshot.materials.todayProjects;
            if (hasOrders && snapshot.materials.deliveryCount) materialDetail += ' · в пути ' + snapshot.materials.deliveryCount;
            cards.push(reminderFocusCardMarkup(hasOrders ? 'order' : 'delivery', hasOrders ? 'shopping-cart' : 'truck', hasOrders ? 'Заказать' : 'В пути', materialCount, reminderPlural(materialCount, 'материал', 'материала', 'материалов'), materialDetail));
        }
        if (snapshot.tasks) {
            var taskDetail = [];
            if (snapshot.tasksToday) taskDetail.push('сегодня ' + snapshot.tasksToday);
            if (snapshot.tasksSoon) taskDetail.push('скоро ' + snapshot.tasksSoon);
            cards.push(reminderFocusCardMarkup('tasks', 'list-checks', 'Задачи', snapshot.tasks, reminderPlural(snapshot.tasks, 'задача', 'задачи', 'задач'), taskDetail.join(' · ') || 'на контроле'));
        }
        if (snapshot.blockers) {
            cards.push(reminderFocusCardMarkup('danger', 'triangle-alert', 'Блокеры', snapshot.blockers, reminderPlural(snapshot.blockers, 'сигнал', 'сигнала', 'сигналов'), 'мешают работе'));
        }
        if (!cards.length) return '';
        return '<section class="reminder-focus" aria-labelledby="reminder-focus-title">' +
            '<header class="reminder-focus-head"><span class="reminder-focus-head-icon" aria-hidden="true"><i data-lucide="sun"></i></span><strong id="reminder-focus-title">Фокус дня</strong><span>' + snapshot.actionCount + '</span></header>' +
            '<div class="reminder-focus-grid" role="list">' + cards.join('') + '</div>' +
        '</section>';
    }

    function reminderItemMarkup(item) {
        var kind = item.kind || 'info';
        var subject = item.subject || item.label || 'Напоминание';
        var accessibleLabel = [reminderSeverityLabel(kind), subject, item.label, item.title, item.scope, item.text].filter(Boolean).join('. ');
        return '<a class="reminder-item is-' + escapeHtml(kind) + '" href="' + escapeHtml(item.href || '/app/projects') + '" aria-label="' + escapeHtml(accessibleLabel) + '">' +
            '<span class="reminder-item-indicator" aria-hidden="true"></span>' +
            '<span class="reminder-item-copy">' +
                '<span class="reminder-item-topline"><strong class="reminder-item-title">' + escapeHtml(subject) + '</strong><span class="reminder-action-label">' + escapeHtml(item.label || reminderSeverityLabel(kind)) + '</span></span>' +
                '<span class="reminder-item-context"><b>' + escapeHtml(item.title || 'Объект') + '</b>' + (item.scope ? '<em>' + escapeHtml(item.scope) + '</em>' : '') + '</span>' +
                (item.text ? '<small class="reminder-item-detail">' + escapeHtml(item.text) + '</small>' : '') +
            '</span>' +
            '<span class="reminder-item-arrow" aria-hidden="true"><i data-lucide="chevron-right"></i></span>' +
        '</a>';
    }

    function reminderMaterialItemMarkup(item) {
        var kind = item.kind || 'info';
        var subject = item.subject || 'Материал';
        var actionKind = item.actionKind === 'delivery' ? 'delivery' : 'order';
        var actionQty = Number(item.actionQty || 0);
        var formattedQty = Number.isFinite(actionQty) && actionQty > 0 ? quantityText(actionQty) : '—';
        var formattedUnit = String(item.unit || '').trim();
        var actionLabel = actionKind === 'delivery' ? 'в пути' : 'заказать';
        var detail = [item.label, item.materialDetail].filter(Boolean).join(' · ');
        var accessibleLabel = [reminderSeverityLabel(kind), subject, item.title, item.scope, actionLabel + ' ' + formattedQty + (formattedUnit ? (' ' + formattedUnit) : ''), detail].filter(Boolean).join('. ');
        return '<a class="reminder-item reminder-material-item is-' + escapeHtml(kind) + '" href="' + escapeHtml(item.href || '/app/projects') + '" aria-label="' + escapeHtml(accessibleLabel) + '">' +
            '<span class="reminder-item-indicator" aria-hidden="true"></span>' +
            '<span class="reminder-item-copy">' +
                '<strong class="reminder-item-title">' + escapeHtml(subject) + '</strong>' +
                (item.scope ? '<span class="reminder-item-context"><em>' + escapeHtml(item.scope) + '</em></span>' : '') +
                (detail ? '<small class="reminder-item-detail">' + escapeHtml(detail) + '</small>' : '') +
            '</span>' +
            '<span class="reminder-material-amount is-' + actionKind + '"><b>' + escapeHtml(formattedQty) + (formattedUnit ? ' <small>' + escapeHtml(formattedUnit) + '</small>' : '') + '</b><em>' + actionLabel + '</em></span>' +
            '<span class="reminder-item-arrow" aria-hidden="true"><i data-lucide="chevron-right"></i></span>' +
        '</a>';
    }

    function reminderMaterialsGroupMarkup(group) {
        var projects = reminderMaterialProjectGroups(group.items);
        var orderCount = projects.reduce(function (total, project) { return total + project.orderCount; }, 0);
        var deliveryCount = projects.reduce(function (total, project) { return total + project.deliveryCount; }, 0);
        var headingId = 'reminder-group-materials';
        var groupTitle = orderCount ? 'По объектам' : 'Поставки по объектам';
        var groupCount = projects.length;
        return '<section class="reminder-group reminder-materials-group is-' + group.tone + '" data-reminder-group="materials" aria-labelledby="' + headingId + '">' +
            '<header class="reminder-group-head"><span class="reminder-group-icon" aria-hidden="true"><i data-lucide="package-search"></i></span><strong id="' + headingId + '">' + groupTitle + '</strong><span class="reminder-group-count">' + groupCount + '</span></header>' +
            '<div class="reminder-projects">' + projects.map(function (project) {
                var primaryCount = project.orderCount || project.deliveryCount;
                var primaryLabel = project.orderCount ? 'к заказу' : 'в пути';
                var projectMeta = project.orderCount
                    ? (project.orderCount + ' ' + reminderPlural(project.orderCount, 'материал', 'материала', 'материалов') + ' к заказу')
                    : (project.deliveryCount + ' ' + reminderPlural(project.deliveryCount, 'материал', 'материала', 'материалов') + ' в пути');
                if (project.orderCount && project.deliveryCount) projectMeta += ' · ' + project.deliveryCount + ' в пути';
                var summaryLabel = project.title + ': ' + projectMeta;
                return '<details class="reminder-project-card" data-reminder-project="' + escapeHtml(project.projectId || project.key) + '">' +
                    '<summary aria-label="' + escapeHtml(summaryLabel) + '">' +
                        '<span class="reminder-project-icon" aria-hidden="true"><i data-lucide="building-2"></i></span>' +
                        '<span class="reminder-project-copy"><strong>' + escapeHtml(project.title) + '</strong><small>' + escapeHtml(projectMeta) + '</small></span>' +
                        '<span class="reminder-project-count"><b>' + primaryCount + '</b><small>' + primaryLabel + '</small></span>' +
                        '<span class="reminder-project-chevron" aria-hidden="true"><i data-lucide="chevron-down"></i></span>' +
                    '</summary>' +
                    '<div class="reminder-project-list">' + project.items.map(reminderMaterialItemMarkup).join('') + '</div>' +
                '</details>';
            }).join('') + '</div>' +
        '</section>';
    }

    function reminderGroupsMarkup(items) {
        var definitions = reminderGroupDefinitions();
        var byKey = {};
        definitions.forEach(function (definition) { byKey[definition.key] = Object.assign({ items: [] }, definition); });
        items.forEach(function (item) {
            var key = byKey[item.group] ? item.group : 'other';
            byKey[key].items.push(item);
        });
        var groups = definitions.map(function (definition) {
            var group = byKey[definition.key];
            group.items.sort(function (left, right) {
                var severityDifference = reminderSeverityRank(left.kind) - reminderSeverityRank(right.kind);
                if (severityDifference) return severityDifference;
                return String(left.sortAt || '9999-12-31').localeCompare(String(right.sortAt || '9999-12-31'));
            });
            group.rank = group.items.length ? reminderSeverityRank(group.items[0].kind) : 9;
            group.tone = group.rank === 0 ? 'danger' : (group.rank === 1 ? 'warn' : 'info');
            return group;
        }).filter(function (group) { return group.items.length; });
        groups.sort(function (left, right) { return left.order - right.order; });
        return '<div class="reminder-groups">' + groups.map(function (group) {
            if (group.key === 'materials') return reminderMaterialsGroupMarkup(group);
            var headingId = 'reminder-group-' + group.key;
            return '<section class="reminder-group is-' + group.tone + '" data-reminder-group="' + escapeHtml(group.key) + '" aria-labelledby="' + escapeHtml(headingId) + '">' +
                '<header class="reminder-group-head"><span class="reminder-group-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(group.icon) + '"></i></span><strong id="' + escapeHtml(headingId) + '">' + escapeHtml(group.title) + '</strong><span class="reminder-group-count">' + group.items.length + '</span></header>' +
                '<div class="reminder-group-list">' + group.items.map(reminderItemMarkup).join('') + '</div>' +
            '</section>';
        }).join('') + '</div>';
    }

    function syncReminderRefreshState(loading) {
        qsa('[data-reminder-refresh]').forEach(function (control) {
            control.disabled = !!loading;
            control.setAttribute('aria-busy', loading ? 'true' : 'false');
        });
    }

    function reminderPartialStatusMarkup(status) {
        var failedCount = Number(status && status.failedCount || 0);
        if (!failedCount) return '';
        var totalProjects = Number(status && status.totalProjects || 0);
        var checkedCount = Math.max(totalProjects - failedCount, 0);
        return '<div class="reminder-partial" role="status">' +
            '<span class="reminder-partial-icon" aria-hidden="true"><i data-lucide="cloud-alert"></i></span>' +
            '<span class="reminder-partial-copy"><b>Часть данных недоступна</b><small>Проверено объектов: ' + checkedCount + ' из ' + totalProjects + '</small></span>' +
            '<button class="reminder-retry-button" type="button" data-reminder-refresh>Повторить</button>' +
        '</div>';
    }

    function reminderFailureMarkup() {
        return '<div class="reminder-error" role="status">' +
            '<span class="reminder-error-icon" aria-hidden="true"><i data-lucide="wifi-off"></i></span>' +
            '<b>Не удалось проверить объекты</b>' +
            '<span>Мы не будем показывать «всё спокойно», пока не получим актуальные данные.</span>' +
            '<button class="reminder-retry-button" type="button" data-reminder-refresh><i data-lucide="refresh-cw" aria-hidden="true"></i><span>Повторить</span></button>' +
        '</div>';
    }

    function reminderNoticeKey(item) {
        return [item.group, item.projectId, item.sourceId, item.materialId, item.kind, item.focusWhen, item.actionKind, item.actionQty, item.sortAt, item.subject].join(':');
    }

    function reminderNoticeSignature(items) {
        return (items || []).map(reminderNoticeKey).sort().join('|');
    }

    function reminderHasNewAttention(items) {
        var nextKeys = {};
        var hasNew = false;
        (items || []).forEach(function (item) {
            var key = reminderNoticeKey(item);
            nextKeys[key] = true;
            if (!reminderLastNoticeKeys[key]) hasNew = true;
        });
        reminderLastNoticeKeys = nextKeys;
        return hasNew;
    }

    function hideReminderNotice() {
        var toast = qs('[data-reminder-toast]');
        if (reminderNoticeTimer) window.clearTimeout(reminderNoticeTimer);
        reminderNoticeTimer = 0;
        if (!toast) return;
        toast.classList.remove('is-visible');
        toast.hidden = true;
    }

    function triggerReminderNotice(button, items) {
        if (!button || !items || !items.length) return;
        var wrap = button.closest ? button.closest('.topbar-reminders-wrap') : null;
        var toast = wrap ? qs('[data-reminder-toast]', wrap) : null;
        var popover = wrap ? qs('[data-reminder-popover]', wrap) : null;
        if (!toast && wrap) {
            toast = document.createElement('span');
            toast.className = 'reminder-toast';
            toast.setAttribute('data-reminder-toast', '');
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.setAttribute('aria-atomic', 'true');
            toast.hidden = true;
            wrap.appendChild(toast);
        }
        var snapshot = reminderFocusSnapshot(items);
        var projectIds = {};
        items.forEach(function (item) { if (item.projectId) projectIds[String(item.projectId)] = true; });
        var message;
        if (snapshot.reports) {
            message = 'За сегодня нет отчёта: ' + snapshot.reports + ' ' + reminderPlural(snapshot.reports, 'объект', 'объекта', 'объектов');
            if (snapshot.materials.orderCount) message += ' · заказать ' + snapshot.materials.orderCount + ' ' + reminderPlural(snapshot.materials.orderCount, 'материал', 'материала', 'материалов');
        } else if (snapshot.blockers) {
            message = 'Блокеры требуют решения: ' + snapshot.blockers;
        } else if (snapshot.materials.todayOrderCount) {
            message = 'Срочно заказать ' + snapshot.materials.todayOrderCount + ' ' + reminderPlural(snapshot.materials.todayOrderCount, 'материал', 'материала', 'материалов') + ' · ' + snapshot.materials.todayOrderProjects + ' ' + reminderPlural(snapshot.materials.todayOrderProjects, 'объект', 'объекта', 'объектов');
        } else if (snapshot.materials.todayDeliveryCount) {
            message = 'Срочно проверить поставку: ' + snapshot.materials.todayDeliveryCount + ' ' + reminderPlural(snapshot.materials.todayDeliveryCount, 'позиция', 'позиции', 'позиций') + ' · ' + snapshot.materials.todayDeliveryProjects + ' ' + reminderPlural(snapshot.materials.todayDeliveryProjects, 'объект', 'объекта', 'объектов');
        } else if (snapshot.worksToday) {
            message = 'Сегодня по графику: ' + snapshot.worksToday + ' ' + reminderPlural(snapshot.worksToday, 'этап', 'этапа', 'этапов');
        } else if (snapshot.tasksToday) {
            message = 'Задачи на сегодня: ' + snapshot.tasksToday;
        } else if (snapshot.materials.orderCount) {
            message = 'Нужно заказать ' + snapshot.materials.orderCount + ' ' + reminderPlural(snapshot.materials.orderCount, 'материал', 'материала', 'материалов') + ' · ' + snapshot.materials.orderProjects + ' ' + reminderPlural(snapshot.materials.orderProjects, 'объект', 'объекта', 'объектов');
        } else if (snapshot.materials.deliveryCount) {
            message = 'Материалы в пути: ' + snapshot.materials.deliveryCount + ' ' + reminderPlural(snapshot.materials.deliveryCount, 'позиция', 'позиции', 'позиций') + ' · ' + snapshot.materials.totalProjects + ' ' + reminderPlural(snapshot.materials.totalProjects, 'объект', 'объекта', 'объектов');
        } else if (snapshot.worksSoon) {
            message = 'Скоро по графику: ' + snapshot.worksSoon + ' ' + reminderPlural(snapshot.worksSoon, 'этап', 'этапа', 'этапов');
        } else {
            message = 'Требуют внимания: ' + snapshot.actionCount + ' · ' + Object.keys(projectIds).length + ' ' + reminderPlural(Object.keys(projectIds).length, 'объект', 'объекта', 'объектов');
        }
        button.classList.remove('is-notifying');
        void button.offsetWidth;
        button.classList.add('is-notifying');
        if (reminderMotionTimer) window.clearTimeout(reminderMotionTimer);
        reminderMotionTimer = window.setTimeout(function () {
            button.classList.remove('is-notifying');
            reminderMotionTimer = 0;
        }, 1900);
        if (!toast || (popover && !popover.hidden)) return;
        toast.textContent = message;
        toast.hidden = false;
        toast.classList.remove('is-visible');
        void toast.offsetWidth;
        toast.classList.add('is-visible');
        if (reminderNoticeTimer) window.clearTimeout(reminderNoticeTimer);
        reminderNoticeTimer = window.setTimeout(function () {
            toast.classList.remove('is-visible');
            toast.hidden = true;
            reminderNoticeTimer = 0;
        }, 4300);
    }

    function renderReminderBell(items, loading, status) {
        var button = qs('[data-reminder-toggle]');
        var count = qs('[data-reminder-count]');
        var list = qs('[data-reminder-list]');
        var subtitle = qs('[data-reminder-subtitle]');
        if (!button || !count || !list) return;
        items = Array.isArray(items) ? items : [];
        status = Object.assign({ failedCount: 0, totalProjects: 0, fullFailure: false }, status || {});
        if (!loading) {
            reminderLastItems = items.slice();
            reminderLastStatus = Object.assign({}, status);
        }
        var focusSnapshot = reminderFocusSnapshot(items);
        var attentionCount = focusSnapshot.actionCount;
        var hasRefreshError = Number(status.failedCount || 0) > 0;
        button.classList.toggle('has-alerts', attentionCount > 0);
        button.classList.toggle('has-error', hasRefreshError);
        count.hidden = !attentionCount && !hasRefreshError;
        count.textContent = attentionCount ? (attentionCount > 99 ? '99+' : String(attentionCount)) : (hasRefreshError ? '!' : '0');
        var buttonLabel = items.length
            ? ('Уведомления: ' + attentionCount + ' действий, ' + items.length + ' записей')
            : (status.failedCount ? 'Уведомления: проверка не завершена' : 'Уведомления: срочных нет');
        if (status.failedCount && items.length) buttonLabel += '. Проверка неполная';
        button.setAttribute('aria-label', buttonLabel);
        button.title = button.getAttribute('aria-label');
        var projectIds = {};
        items.forEach(function (item) { if (item.projectId) projectIds[String(item.projectId)] = true; });
        if (subtitle) {
            if (loading) subtitle.textContent = 'Проверяем объекты...';
            else if (status.fullFailure) subtitle.textContent = 'Нужно повторить проверку';
            else if (items.length) subtitle.textContent = 'Сегодня: ' + focusSnapshot.todayCount + ' • скоро: ' + focusSnapshot.soonCount;
            else if (status.failedCount) subtitle.textContent = 'Проверка выполнена не полностью';
            else subtitle.textContent = 'На сейчас всё спокойно';
        }
        list.setAttribute('aria-busy', loading ? 'true' : 'false');
        syncReminderRefreshState(loading);
        if (loading) {
            list.innerHTML = '<div class="reminder-loading" aria-label="Загружаем уведомления"><span></span><span></span><span></span></div>';
            return;
        }
        if (status.fullFailure) {
            list.innerHTML = reminderFailureMarkup();
            syncReminderRefreshState(false);
            refreshLucideIcons(list);
            return;
        }
        var noticeSignature = reminderNoticeSignature(items);
        var hasNewAttention = reminderHasNewAttention(items);
        if (noticeSignature && noticeSignature !== reminderLastNoticeSignature && hasNewAttention) triggerReminderNotice(button, items);
        reminderLastNoticeSignature = noticeSignature;
        if (!items.length) {
            list.innerHTML = reminderPartialStatusMarkup(status) + (status.failedCount
                ? '<div class="reminder-empty is-partial"><b>В проверенных объектах срочного нет</b><span>Остальные объекты пока не проверены.</span></div>'
                : '<div class="reminder-empty"><span class="reminder-empty-icon" aria-hidden="true"><i data-lucide="circle-check-big"></i></span><b>На сейчас всё спокойно</b><span>Просрочек, блокеров и срочных закупок нет.</span></div>');
            syncReminderRefreshState(false);
            refreshLucideIcons(list);
            return;
        }
        list.innerHTML = reminderPartialStatusMarkup(status) + reminderFocusOverviewMarkup(items) + reminderGroupsMarkup(items);
        syncReminderRefreshState(false);
        refreshLucideIcons(list);
    }

    function scheduleReminderBoundaryRefresh(refreshAt) {
        if (reminderBoundaryTimer) window.clearTimeout(reminderBoundaryTimer);
        reminderBoundaryTimer = 0;
        var timestamp = Date.parse(String(refreshAt || ''));
        if (!Number.isFinite(timestamp)) return;
        var delay = Math.max(1000, timestamp - Date.now() + 1000);
        reminderBoundaryTimer = window.setTimeout(function () {
            reminderBoundaryTimer = 0;
            if (!isGuestRole()) refreshReminderBell();
        }, Math.min(delay, 2147483000));
    }

    function flushReminderRefreshQueue() {
        if (!reminderRefreshQueued) return;
        reminderRefreshQueued = false;
        refreshReminderBell();
    }

    function refreshReminderBell() {
        if (!qsa('[data-reminder-toggle]').length) return;
        if (state.reminderProjectsLoading || reminderRefreshInFlight) {
            reminderRefreshQueued = true;
            return;
        }
        reminderRefreshQueued = false;
        if (!state.projectsLoaded) {
            var projectsRequestToken = ++reminderRequestToken;
            state.reminderProjectsLoading = true;
            renderReminderBell(reminderLastItems, true, reminderLastStatus);
            api('/api/projects', { silentLoader: true }).then(function (data) {
                if (projectsRequestToken !== reminderRequestToken) return;
                state.projects = Array.isArray(data.projects) ? data.projects : [];
                state.projectsLoaded = true;
                state.reminderProjectsLoading = false;
                refreshReminderBell();
            }).catch(function () {
                if (projectsRequestToken !== reminderRequestToken) return;
                state.reminderProjectsLoading = false;
                renderReminderBell([], false, { failedCount: 1, totalProjects: 0, fullFailure: true });
                flushReminderRefreshQueue();
            });
            return;
        }
        if (!state.projects.length) {
            renderReminderBell([], false, { failedCount: 0, totalProjects: 0, fullFailure: false });
            return;
        }
        var notificationsRequestToken = ++reminderRequestToken;
        reminderRefreshInFlight = true;
        renderReminderBell(reminderLastItems, true, reminderLastStatus);
        Promise.all(state.projects.map(function (project) {
            return api('/api/projects/' + project.id + '/notifications').then(function (notifications) {
                state.notificationsByProject[project.id] = notifications || {};
                return { ok: true, items: buildReminderItemsForProject(project, notifications || {}), nextRefreshAt: notifications && notifications.nextAttentionRefreshAt || '' };
            }).catch(function () { return { ok: false, items: [], nextRefreshAt: '' }; });
        })).then(function (results) {
            if (notificationsRequestToken !== reminderRequestToken) return;
            reminderRefreshInFlight = false;
            var items = [];
            var failedCount = 0;
            var nextRefreshAt = '';
            results.forEach(function (result) {
                if (!result.ok) failedCount += 1;
                items = items.concat(result.items || []);
                if (result.nextRefreshAt && (!nextRefreshAt || String(result.nextRefreshAt) < nextRefreshAt)) nextRefreshAt = String(result.nextRefreshAt);
            });
            scheduleReminderBoundaryRefresh(nextRefreshAt);
            renderReminderBell(items, false, {
                failedCount: failedCount,
                totalProjects: state.projects.length,
                fullFailure: failedCount >= state.projects.length
            });
            flushReminderRefreshQueue();
        }).catch(function () {
            if (notificationsRequestToken !== reminderRequestToken) return;
            reminderRefreshInFlight = false;
            renderReminderBell([], false, { failedCount: state.projects.length, totalProjects: state.projects.length, fullFailure: true });
            flushReminderRefreshQueue();
        });
    }

    function closeReminderPopover(restoreFocus) {
        var popover = qs('[data-reminder-popover]');
        var toggle = qs('[data-reminder-toggle]');
        if (popover) popover.hidden = true;
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            if (restoreFocus && typeof toggle.focus === 'function') toggle.focus();
        }
    }

    function initReminderBell() {
        if (document.documentElement.dataset.reminderBellBound === '1') return;
        document.documentElement.dataset.reminderBellBound = '1';
        document.addEventListener('click', function (event) {
            var toggle = event.target && event.target.closest ? event.target.closest('[data-reminder-toggle]') : null;
            var popover = qs('[data-reminder-popover]');
            if (toggle) {
                event.preventDefault();
                if (!popover) return;
                popover.hidden = !popover.hidden;
                toggle.setAttribute('aria-expanded', popover.hidden ? 'false' : 'true');
                if (!popover.hidden) {
                    hideReminderNotice();
                    refreshReminderBell();
                    refreshLucideIcons(popover);
                    var closeControl = qs('[data-reminder-close]', popover);
                    if (closeControl && typeof closeControl.focus === 'function') {
                        try { closeControl.focus({ preventScroll: true }); } catch (focusError) { closeControl.focus(); }
                    }
                }
                return;
            }
            var close = event.target && event.target.closest ? event.target.closest('[data-reminder-close]') : null;
            if (close) {
                event.preventDefault();
                closeReminderPopover(true);
                return;
            }
            var refresh = event.target && event.target.closest ? event.target.closest('[data-reminder-refresh]') : null;
            if (refresh) {
                event.preventDefault();
                refreshReminderBell();
                return;
            }
            var reminderLink = event.target && event.target.closest ? event.target.closest('.reminder-item') : null;
            if (reminderLink) {
                closeReminderPopover(false);
                return;
            }
            if (!popover) return;
            if (popover.hidden) return;
            if (event.target.closest('[data-reminder-popover]')) return;
            closeReminderPopover(false);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            var popover = qs('[data-reminder-popover]');
            if (!popover || popover.hidden) return;
            event.preventDefault();
            closeReminderPopover(true);
        });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && !isGuestRole()) refreshReminderBell();
        });
    }

    var baseLoadProjectsForReminders = loadProjects;
    loadProjects = function (callback) {
        return baseLoadProjectsForReminders(function () {
            if (!isGuestRole()) refreshReminderBell();
            if (callback) callback();
        });
    };

    var baseInitShellForReminders = initShell;
    initShell = function () {
        baseInitShellForReminders();
        initReminderBell();
        if (!isGuestRole()) refreshReminderBell();
    };

    function removeProjectAssignmentsBlock() {
        qsa('[data-project-assignments]').forEach(function (root) {
            var section = root.closest('.subsection');
            if (section) section.remove();
            else root.remove();
        });
    }

    loadProjectAssignments = function (projectId, loadingToken) {
        loadProjectHub(projectId, state.selectedProject, loadingToken);
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
        var number = Math.max(0, normalizedQuantityNumber(value));
        var rounded = Math.round(number * 1000) / 1000;
        return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(rounded);
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
        var keys = [];
        if (item && item.id) keys.push('id|' + String(item.id));
        keys.push(scheduleWorkKey(sectionTitle, item));
        return keys.filter(function (key, index) {
            return key && keys.indexOf(key) === index;
        });
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
            '<span><small class="quantity-actual-label">Факт</small><b>' + escapeHtml(quantityText(progress.actual)) + '</b><small class="quantity-actual-separator">из</small><em>' + escapeHtml(quantityText(progress.total)) + ' ' + escapeHtml(progress.unit || 'ед.') + '</em></span>' +
            '<div><input class="quantity-actual-input" type="number" min="0" max="' + escapeHtml(String(progress.total || '')) + '" step="' + stepValue + '" value="' + escapeHtml(String(Math.round((progress.actual || 0) * 10) / 10)) + '" data-actual-qty-input data-actual-kind="' + escapeHtml(kind) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-item-id="' + escapeHtml(itemId) + '" data-item-title="' + escapeHtml(item && item.title || '') + '" data-item-unit="' + escapeHtml(item && item.unit || '') + '" data-item-qty="' + escapeHtml(String(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty) || '')) + '"><em>' + escapeHtml(progress.unit || 'штук') + '</em></div>' +
        '</label>';
    }

    renderWorkManualCheck = function (item, sectionTitle, projectId) {
        var progress = projectId ? workActualProgress(projectId, sectionTitle, item) : { actual: 0, total: quantityPlanInfo(item).totalQty, unit: quantityPlanInfo(item).unit };
        var isDone = progress.total > 0 && progress.actual >= progress.total;
        var canEditActual = !!(canManageSchedule && canManageSchedule());
        var factAriaLabel = 'Внести выполненный объём: ' + String(item.title || 'Работа') + '. По смете ' + quantityText(progress.total) + ' ' + String(progress.unit || 'ед.') + ', сделано ' + quantityText(progress.actual) + ' ' + String(progress.unit || 'ед.');
        var quantityInteraction = canEditActual ? ' data-work-quantity-open data-work-id="' + escapeHtml(item.id || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" role="button" tabindex="0" aria-label="' + escapeHtml(factAriaLabel) + '"' : '';
        return '<div class="section-work-check work-list-check quantity-work-check' + (canEditActual ? ' work-quantity-row' : '') + (isDone ? ' is-done' : '') + (progress.actual > 0 && !isDone ? ' is-partial' : '') + '" data-item-id="' + escapeHtml(item.id || '') + '"' + quantityInteraction + '>' +
            '<div class="quantity-check-main"><span class="section-work-row-icon" aria-hidden="true"><i data-lucide="hard-hat"></i></span>' +
            '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '') + '</b><small>Сделано ' + escapeHtml(quantityText(progress.actual)) + ' из ' + escapeHtml(quantityText(progress.total)) + ' ' + escapeHtml(progress.unit || 'ед.') + '</small></span></div>' +
        '</div>';
    };

    renderMaterialManualCheck = function (item, sectionTitle, projectId) {
        var effectiveItem = materialEffectiveForProgress(projectId, item);
        var progress = materialActualProgress(projectId, item);
        var isDone = progress.total > 0 && progress.actual >= progress.total;
        var meta = [
            'по смете: ' + quantityText(progress.total) + ' ' + progress.unit,
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

    function normalizeBulkSectionKind(value) {
        value = String(value || '').trim().toLowerCase();
        if (value === 'work' || value === 'works') return 'work';
        if (value === 'material' || value === 'materials') return 'material';
        return '';
    }

    function bulkCompleteSectionProgress(projectId, sectionId, completed, itemIds, itemKind) {
        return api('/api/projects/' + encodeURIComponent(projectId) + '/sections/' + encodeURIComponent(progressSectionId(sectionId)) + '/bulk-complete', {
            method: 'POST',
            body: JSON.stringify({
                sectionId: progressSectionId(sectionId),
                sectionTitle: sectionId || '',
                itemIds: itemIds || [],
                itemKind: normalizeBulkSectionKind(itemKind),
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

    function sectionBulkInputs(scope, itemKind) {
        if (!scope) return [];
        var normalizedKind = normalizeBulkSectionKind(itemKind);
        var selector = normalizedKind === 'work'
            ? '[data-section-work-check]'
            : (normalizedKind === 'material' ? '[data-section-material-check]' : '[data-section-material-check], [data-section-work-check]');
        return qsa(selector, scope).filter(function (input) {
            return !input.hasAttribute('data-bulk-section-check');
        });
    }

    function updateBulkSectionCheckState(scope) {
        if (!scope) return;
        var bulk = qs('[data-bulk-section-check]', scope);
        var allChildren = sectionBulkInputs(scope, '');
        var children = sectionBulkInputs(scope, bulk ? bulk.getAttribute('data-bulk-kind') : '');
        if (bulk) {
            var done = children.filter(function (input) { return input.checked; }).length;
            bulk.checked = !!(children.length && done === children.length);
            bulk.indeterminate = !!(done && done < children.length);
        }
        updateRenderedSectionProgressFromDom(scope, allChildren);
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
            if (count) count.textContent = group.length ? (String(kindDone) + '\u0020\u0438\u0437\u0020' + String(group.length)) : '\u041f\u043e\u0437\u0438\u0446\u0438\u0439\u0020\u043d\u0435\u0442';
        });
        var total = children.length;
        var done = children.filter(function (input) { return input.checked; }).length;
        var nextPercent = total ? Math.round((done / total) * 100) : 0;
        qsa('[data-section-progress]:not([data-section-progress-kind]), [data-progress-section-id]:not([data-section-progress-kind])', scope).forEach(function (node) {
            updateProgressNode(node, nextPercent, nextPercent + '%');
            node.setAttribute('aria-valuenow', String(nextPercent));
        });
        qsa('.estimate-section-progress strong', scope).forEach(function (node) {
            node.textContent = String(done) + '\u0020\u0438\u0437\u0020' + String(total);
        });
        qsa('.project-badges .badge, .section-schedule-progress-meta span', scope).forEach(function (node) {
            var text = String(node.textContent || '');
            if (/готов|выполн|закрыт/i.test(text)) {
                node.textContent = String(done) + (text.indexOf('/') !== -1 ? '/' : '\u0020\u0438\u0437\u0020') + String(total) + (text.indexOf('готов') !== -1 ? ' готово' : ' выполнено');
            }
        });
    }

    function syncBulkSectionChecks(root) {
        qsa('[data-bulk-section-check]', root || document).forEach(function (input) {
            updateBulkSectionCheckState(sectionBulkScope(input));
        });
    }

    function bulkSectionItemIds(scope, itemKind) {
        var ids = [];
        if (!scope) return ids;
        sectionBulkInputs(scope, itemKind).forEach(function (input) {
            var raw = input.getAttribute('data-material-id') || input.getAttribute('data-work-id') || '';
            var id = Number(raw || 0);
            if (id && ids.indexOf(id) === -1) ids.push(id);
        });
        return ids;
    }

    function completeBulkSectionLocally(scope, checked, itemKind) {
        if (!scope) return;
        var normalizedKind = normalizeBulkSectionKind(itemKind);
        sectionBulkInputs(scope, normalizedKind).forEach(function (input) {
            var projectId = Number(input.getAttribute('data-project-id') || 0);
            var sectionTitle = input.getAttribute('data-section-title') || '';
            if (input.hasAttribute('data-section-work-check')) {
                setScheduleWorkDone(projectId, sectionTitle, {
                    id: input.getAttribute('data-work-id') || input.getAttribute('data-item-id') || '',
                    title: input.getAttribute('data-work-title') || '',
                    unit: input.getAttribute('data-work-unit') || '',
                    planned_qty: input.getAttribute('data-work-qty') || ''
                }, checked);
                input.dataset.localChecked = checked ? '1' : '0';
            } else if (input.hasAttribute('data-section-material-check')) {
                var materialItem = {
                    id: input.getAttribute('data-material-id') || input.getAttribute('data-item-id') || '',
                    title: input.getAttribute('data-material-title') || '',
                    unit: input.getAttribute('data-material-unit') || '',
                    plannedQty: input.getAttribute('data-material-qty') || ''
                };
                setMaterialManuallyDone(projectId, materialItem, checked);
                updateMaterialScheduleItemDom(materialItem.id, checked);
            }
            input.checked = checked;
            var wrap = input.closest ? input.closest('.section-work-check, .material-row, .work-row') : null;
            if (wrap) {
                wrap.classList.toggle('is-done', checked);
                wrap.classList.toggle('work-row-done', checked);
                wrap.classList.toggle('material-row-done', checked);
                if (checked) wrap.classList.remove('is-partial', 'work-row-partial', 'material-row-partial');
            }
        });
        qsa('[data-actual-qty-input]', scope).filter(function (input) {
            var actualKind = normalizeBulkSectionKind(input.getAttribute('data-actual-kind'));
            return !normalizedKind || actualKind === normalizedKind;
        }).forEach(function (input) {
            var max = input.getAttribute('max') || input.getAttribute('data-item-qty') || '';
            input.value = checked ? max : '0';
            updateActualQuantityLabel(input, input.value);
        });
    }

    function handleBulkSectionCheck(input) {
        var projectId = Number(input.getAttribute('data-project-id') || 0);
        var sectionTitle = input.getAttribute('data-section-title') || input.getAttribute('data-bulk-section-check') || '';
        var scope = sectionBulkScope(input);
        var bulkKind = normalizeBulkSectionKind(input.getAttribute('data-bulk-kind'));
        var itemIds = bulkSectionItemIds(scope, bulkKind);
        var checked = !!input.checked;
        completeBulkSectionLocally(scope, checked, bulkKind);
        input.indeterminate = false;
        updateBulkSectionCheckState(scope);
        return withSubmitLock(input, function () {
            return bulkCompleteSectionProgress(projectId, sectionTitle, checked, itemIds, bulkKind).then(function () {
                if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    refreshSelectedProjectProgressViews(projectId);
                }
            });
        }).catch(function (error) {
            input.checked = !checked;
            completeBulkSectionLocally(scope, !checked, bulkKind);
            updateBulkSectionCheckState(scope);
            showAppNotice(appErrorMessage(error, 'Не удалось закрыть раздел'), 'error');
        });
    }

    function saveActualQuantityInput(input, shouldRerender) {
        var projectId = Number(input.getAttribute('data-project-id') || 0);
        if (!projectId) return Promise.resolve(null);
        var item = actualQuantityInputItem(input);
        var value = input.value;
        if (input.getAttribute('data-actual-kind') === 'work') {
            setWorkActualQty(projectId, input.getAttribute('data-section-title') || '', item, value);
        } else {
            setMaterialManualActualQty(projectId, item, value);
        }
        updateActualQuantityLabel(input, value);
        if (!shouldRerender) return Promise.resolve(null);
        var planTotal = quantityPlanInfo(item).totalQty;
        var request = Promise.resolve(null);
        if (input.dataset.progressSyncedValue !== String(value)) {
            input.dataset.progressSyncedValue = String(value);
            request = postProgressItem(projectId, {
                kind: input.getAttribute('data-actual-kind') || '',
                itemId: input.getAttribute('data-item-id') || '',
                sectionTitle: input.getAttribute('data-section-title') || '',
                title: item.title,
                unit: item.unit,
                actualQty: value,
                completed: planTotal > 0 && Number(value || 0) >= planTotal
            }, input.getAttribute('data-section-title') || '').then(function () {
                refreshSelectedProjectProgressViews(projectId);
            });
        }
        updateBulkSectionCheckState(sectionBulkScope(input));
        if (input.getAttribute('data-actual-kind') === 'material') {
            updateMaterialScheduleItemDom(input.getAttribute('data-item-id') || '', planTotal > 0 && Number(value || 0) >= planTotal);
        }
        return request;
    }

    function closeWorkQuantityDialog(modal, restoreFocus) {
        modal = modal || qs('[data-work-quantity-dialog]');
        if (!modal) return;
        var form = qs('[data-work-quantity-form]', modal);
        if (form && form.dataset.submitLocked === '1') return;
        var returnFocus = modal._returnFocus || null;
        var workId = modal.getAttribute('data-work-id') || '';
        modal.remove();
        document.body.classList.remove('work-quantity-dialog-open');
        if (restoreFocus === false) return;
        if (!returnFocus || !document.contains(returnFocus)) {
            returnFocus = workId ? qs('[data-work-quantity-open][data-work-id="' + progressSelectorValue(workId) + '"]') : null;
        }
        if (returnFocus && typeof returnFocus.focus === 'function') {
            try { returnFocus.focus({ preventScroll: true }); } catch (focusError) { returnFocus.focus(); }
        }
    }

    function workQuantityDialogMetric(label, value, unit, tone) {
        return '<div class="work-quantity-dialog-metric' + (tone ? (' is-' + escapeHtml(tone)) : '') + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + (unit ? ' <small>' + escapeHtml(unit) + '</small>' : '') + '</strong></div>';
    }

    function openWorkQuantityDialog(projectId, sectionTitle, item, opener) {
        projectId = Number(projectId || 0);
        item = item || {};
        if (!projectId || !item.id) return Promise.reject(new Error('work_quantity_item_missing'));
        if (!canManageSchedule || !canManageSchedule()) return Promise.reject(new Error('work_quantity_forbidden'));
        closeWorkQuantityDialog(qs('[data-work-quantity-dialog]'), false);
        var progress = workActualProgress(projectId, sectionTitle, item);
        var total = Number(progress.total || 0);
        var actual = Number(progress.actual || 0);
        var remaining = total > 0 ? Math.max(total - actual, 0) : 0;
        var unit = String(progress.unit || item.unit || 'ед.').trim() || 'ед.';
        var titleId = 'work-quantity-dialog-title-' + String(item.id);
        var descriptionId = titleId + '-description';
        var maxAttribute = total > 0 ? (' max="' + escapeHtml(String(total)) + '"') : '';
        var stepValue = '0.001';
        var hintId = titleId + '-hint';
        var errorId = titleId + '-error';
        var modal = document.createElement('div');
        modal.className = 'work-quantity-dialog';
        modal.setAttribute('data-work-quantity-dialog', '');
        modal.setAttribute('data-work-id', String(item.id));
        modal.innerHTML = '<section class="work-quantity-dialog-card" role="dialog" aria-modal="true" aria-labelledby="' + escapeHtml(titleId) + '" aria-describedby="' + escapeHtml(descriptionId) + '">' +
            '<header class="work-quantity-dialog-head"><div><span class="section-label">Работы</span><h3 id="' + escapeHtml(titleId) + '">Выполнение работы</h3><p id="' + escapeHtml(descriptionId) + '">Укажите итоговый объём, выполненный на объекте.</p></div><button class="ghost compact" type="button" data-work-quantity-close aria-label="Закрыть"><i data-lucide="x"></i></button></header>' +
            '<form class="work-quantity-dialog-body" data-work-quantity-form novalidate>' +
                '<div class="work-quantity-dialog-work"><span class="work-quantity-dialog-work-icon" aria-hidden="true"><i data-lucide="hard-hat"></i></span><div><small>' + escapeHtml(sectionTitle || 'Работы по смете') + '</small><strong>' + escapeHtml(item.title || 'Работа') + '</strong></div></div>' +
                '<div class="work-quantity-dialog-metrics" aria-label="Текущий объём работы">' +
                    workQuantityDialogMetric('По смете', total > 0 ? quantityText(total) : 'Не указан', total > 0 ? unit : '', 'plan') +
                    workQuantityDialogMetric('Сделано', quantityText(actual), unit, 'actual') +
                    workQuantityDialogMetric('Осталось', total > 0 ? quantityText(remaining) : '—', total > 0 ? unit : '', 'remaining') +
                '</div>' +
                '<label class="work-quantity-dialog-field"><span>Сделано всего</span><div><input type="number" name="actual_qty" min="0"' + maxAttribute + ' step="' + stepValue + '" inputmode="decimal" value="' + escapeHtml(String(Math.round(actual * 1000) / 1000)) + '" aria-label="Сделано всего, ' + escapeHtml(unit) + '" aria-describedby="' + escapeHtml(hintId + ' ' + errorId) + '" required><em>' + escapeHtml(unit) + '</em></div><small id="' + escapeHtml(hintId) + '">Это итог по позиции, а не прибавка за смену.</small></label>' +
                '<div class="work-quantity-dialog-quick">' + (total > 0 ? '<button class="ghost compact" type="button" data-work-quantity-fill><i data-lucide="check-check"></i><span>Весь объём</span><small>' + escapeHtml(quantityText(total) + ' ' + unit) + '</small></button>' : '') + '<button class="ghost compact" type="button" data-work-quantity-clear><i data-lucide="rotate-ccw"></i><span>Обнулить</span></button></div>' +
                '<div class="form-error" id="' + escapeHtml(errorId) + '" data-work-quantity-error role="alert" aria-live="polite"></div>' +
                '<footer class="work-quantity-dialog-actions"><button class="ghost" type="button" data-work-quantity-close>Отмена</button><button class="primary" type="submit"><i data-lucide="check"></i><span>Сохранить объём</span></button></footer>' +
            '</form>' +
        '</section>';
        modal._returnFocus = opener || document.activeElement;
        document.body.appendChild(modal);
        document.body.classList.add('work-quantity-dialog-open');
        refreshLucideIcons(modal);
        var form = qs('[data-work-quantity-form]', modal);
        var input = form && form.elements.actual_qty;
        var actualMetric = qs('.work-quantity-dialog-metric.is-actual strong', modal);
        var remainingMetric = qs('.work-quantity-dialog-metric.is-remaining strong', modal);
        var errorNode = qs('[data-work-quantity-error]', form);
        function updateWorkQuantityPreview() {
            var previewValue = Number(String(input.value || '').replace(',', '.'));
            if (!Number.isFinite(previewValue) || previewValue < 0) return;
            if (actualMetric) actualMetric.textContent = quantityText(previewValue) + ' ' + unit;
            if (remainingMetric) remainingMetric.textContent = total > 0 ? (quantityText(Math.max(total - previewValue, 0)) + ' ' + unit) : '—';
        }
        input.addEventListener('input', function () {
            input.removeAttribute('aria-invalid');
            if (errorNode) {
                errorNode.textContent = '';
                errorNode.classList.remove('active');
            }
            updateWorkQuantityPreview();
        });
        qsa('[data-work-quantity-close]', modal).forEach(function (button) {
            button.addEventListener('click', function () { closeWorkQuantityDialog(modal); });
        });
        var fill = qs('[data-work-quantity-fill]', modal);
        if (fill) fill.addEventListener('click', function () { input.value = String(total); updateWorkQuantityPreview(); input.focus(); input.select(); });
        var clear = qs('[data-work-quantity-clear]', modal);
        if (clear) clear.addEventListener('click', function () { input.value = '0'; updateWorkQuantityPreview(); input.focus(); input.select(); });
        modal.addEventListener('mousedown', function (event) {
            if (event.target === modal) closeWorkQuantityDialog(modal);
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeWorkQuantityDialog(modal);
                return;
            }
            if (event.key !== 'Tab') return;
            var focusable = qsa('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])', modal).filter(function (node) {
                return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && node.offsetParent !== null;
            });
            if (!focusable.length) return;
            var firstFocusable = focusable[0];
            var lastFocusable = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === firstFocusable) {
                event.preventDefault();
                lastFocusable.focus();
            } else if (!event.shiftKey && document.activeElement === lastFocusable) {
                event.preventDefault();
                firstFocusable.focus();
            }
        });
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (errorNode) {
                errorNode.textContent = '';
                errorNode.classList.remove('active');
            }
            var value = Number(String(input.value || '').replace(',', '.'));
            if (!Number.isFinite(value) || value < 0 || (total > 0 && value > total)) {
                input.setAttribute('aria-invalid', 'true');
                if (errorNode) {
                    errorNode.textContent = total > 0 ? ('Введите число от 0 до ' + quantityText(total) + ' ' + unit + '.') : 'Введите корректный выполненный объём.';
                    errorNode.classList.add('active');
                }
                input.focus();
                return;
            }
            var previous = actual;
            input.removeAttribute('aria-invalid');
            withSubmitLock(form, function () {
                var syncInput = document.createElement('input');
                syncInput.value = String(value);
                syncInput.setAttribute('data-actual-kind', 'work');
                syncInput.setAttribute('data-project-id', String(projectId));
                syncInput.setAttribute('data-section-title', sectionTitle || '');
                syncInput.setAttribute('data-item-id', String(item.id));
                syncInput.setAttribute('data-item-title', item.title || '');
                syncInput.setAttribute('data-item-unit', item.unit || '');
                syncInput.setAttribute('data-item-qty', String(item.plannedQty != null ? item.plannedQty : item.planned_qty || ''));
                return saveActualQuantityInput(syncInput, true);
            }).then(function () {
                closeWorkQuantityDialog(modal);
                showAppNotice('Выполненный объём сохранён.', 'success');
            }).catch(function (error) {
                setWorkActualQty(projectId, sectionTitle, item, previous);
                if (errorNode) {
                    errorNode.textContent = appErrorMessage(error, 'Не удалось сохранить выполненный объём.');
                    errorNode.classList.add('active');
                }
            });
        });
        setTimeout(function () {
            if (!document.contains(input)) return;
            input.focus({ preventScroll: true });
            input.select();
        }, 0);
        return Promise.resolve(modal);
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
            input.dataset.localChecked = checked ? '1' : '0';
            input.checked = isScheduleWorkDone(projectId, sectionTitle, workItem);
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
        var syncKey = [
            payload.kind,
            projectId,
            payload.itemId || '',
            sectionTitle,
            checked ? '1' : '0'
        ].join('|');
        if (input.dataset.progressSyncPending === syncKey) return Promise.resolve(null);
        input.dataset.progressSyncPending = syncKey;
        updateManualCheckboxDom(input, checked);
        updateBulkSectionCheckState(sectionBulkScope(input));
        return withSubmitLock(input, function () {
            return postProgressItem(projectId, payload, sectionTitle).then(function () {
                if (payload.kind === 'work' && typeof workItem !== 'undefined') {
                    setScheduleWorkDone(projectId, sectionTitle, workItem, checked);
                    input.checked = isScheduleWorkDone(projectId, sectionTitle, workItem);
                    input.dataset.localChecked = checked ? '1' : '0';
                }
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
        }).finally(function () {
            if (input.dataset.progressSyncPending === syncKey) delete input.dataset.progressSyncPending;
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
        var outOfMatch = normalized.match(/(?:^|\s)(\d+(?:[\.,]\d+)?)\s*(?:из|\/|от)\s*(\d+(?:[\.,]\d+)?)(?:\s|$)/);
        if (outOfMatch) return normalizedQuantityNumber(outOfMatch[1]);
        var percentMatch = normalized.match(/(\d+(?:[\.,]\d+)?)%/);
        if (percentMatch && plan.totalQty > 0) {
            return plan.totalQty * Math.max(0, Math.min(100, normalizedQuantityNumber(percentMatch[1]))) / 100;
        }
        var unitPatterns = reportQuantityUnitPatterns(item);
        for (var i = 0; i < unitPatterns.length; i += 1) {
            var unitMatch = raw.match(new RegExp('(\\d+(?:[\\.,]\\d+)?)\\s*' + unitPatterns[i], 'i'));
            if (unitMatch) return normalizedQuantityNumber(unitMatch[1]);
        }
        if (/(^|\s)(?:половин[а-я]*|наполовину)(?=\s|$)/.test(normalized) && plan.totalQty > 0) return plan.totalQty * 0.5;
        if (reportHasWholeIntent(normalized) && plan.totalQty > 0) return plan.totalQty;
        var numberMatch = normalized.match(/(^|\s)(\d+(?:[\.,]\d+)?)(\s|$)/);
        if (numberMatch) return normalizedQuantityNumber(numberMatch[2]);
        return 0;
    };

    reportWorkResultFromClause = function (clauseText, candidate) {
        if (!reportHasWorkCompletionIntent(clauseText)) return null;
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var plan = quantityPlanInfo(candidate.item);
        var qty = clampActualQty(reportQuantityFromClause(clauseText, candidate.item), plan.totalQty);
        var partial = reportHasPartialIntent(clauseText) || (plan.totalQty > 0 && qty > 0 && qty < plan.totalQty);
        var done = plan.totalQty > 0 ? (qty > 0 ? qty >= plan.totalQty : !partial) : !partial;
        var appliedQty = done && plan.totalQty > 0 ? plan.totalQty : qty;
        var quantityIntent = appliedQty > 0
            ? reportWorkQuantityMode(clauseText, candidate.item, appliedQty)
            : { mode: 'delta_qty', value: 0 };
        return {
            sectionTitle: candidate.sectionTitle,
            item: candidate.item,
            clauseText: clauseText,
            score: score,
            done: done,
            partial: partial,
            actualQty: appliedQty,
            quantityLabel: reportWorkQuantityLabel(clauseText, candidate.item, qty),
            quantityMode: quantityIntent.mode,
            quantityValue: quantityIntent.value,
            actionEligible: plan.totalQty > 0 && appliedQty > 0
        };
    };

    reportMaterialResultFromClause = function (clauseText, candidate) {
        var clauseTokens = reportTokens(clauseText);
        var score = reportClauseMatchScore(candidate.tokens, clauseTokens);
        var needed = candidate.tokens.length >= 4 ? 2 : 1;
        if (score < needed) return null;
        var normalized = normalizeReportText(clauseText);
        var item = candidate.item;
        var plan = quantityPlanInfo(item);
        var qty = clampActualQty(reportQuantityFromClause(clauseText, item), plan.totalQty);
        var purchasedAlready = Number(item.purchasedQty || item.purchased_qty || 0);
        var receivedAlready = Number(item.receivedQty || item.received_qty || 0);
        var usedAlready = Number(item.usedQty || item.used_qty || 0) + Number(item.writeoffQty || item.writeoff_qty || 0);
        var toOrder = Math.max(plan.totalQty - Math.max(purchasedAlready, receivedAlready), 0);
        var orderedPending = Math.max(purchasedAlready - receivedAlready, 0);
        var physicalRemaining = Math.max(plan.totalQty - receivedAlready, 0);
        var onSite = Math.max(Number(item.stockBalanceQty != null ? item.stockBalanceQty : (receivedAlready - usedAlready)) || 0, 0);
        var purchase = reportHasPurchaseIntent(normalized);
        var receipt = reportHasReceiptIntent(normalized);
        var used = reportHasUseIntent(normalized);
        if (receipt && /поставк|отгруз/.test(normalized)) used = false;
        var quantityIntent = reportMaterialQuantityIntent(clauseText, item, qty);
        var targetQty = quantityIntent.targetQty;
        var qualitativePartial = reportHasPartialIntent(normalized) && targetQty == null && !(qty > 0);
        if (targetQty != null && plan.totalQty > 0) {
            if (purchase) qty = Math.max(targetQty - Math.max(purchasedAlready, receivedAlready), 0);
            else if (receipt) qty = Math.max(targetQty - receivedAlready, 0);
            else if (used) qty = Math.max(targetQty - usedAlready, 0);
        }
        if (!qty && targetQty == null && purchase && !qualitativePartial) qty = toOrder;
        if (!qty && targetQty == null && receipt && !qualitativePartial) qty = orderedPending || (reportHasWholeIntent(normalized) ? physicalRemaining : 0);
        if (!qty && targetQty == null && used && !qualitativePartial && reportHasWholeIntent(normalized)) qty = onSite;
        return {
            item: item,
            score: score,
            clauseText: clauseText,
            reportUnit: reportExplicitQuantityUnit(clauseText),
            actionEligible: Number(qty || 0) > 0 && (purchase || receipt || used) && !qualitativePartial,
            semanticMatch: purchase || receipt || used,
            purchaseIntent: purchase,
            receiptIntent: receipt,
            useIntent: used,
            quantityMode: quantityIntent.mode,
            quantityValue: quantityIntent.value,
            targetQty: targetQty,
            purchasedQty: purchase ? Math.min(qty, toOrder) : 0,
            receivedQty: receipt ? Math.min(qty, physicalRemaining) : 0,
            usedQty: used ? Math.min(qty, onSite) : 0,
            purchaseMaxQty: toOrder,
            receiptMaxQty: physicalRemaining,
            useMaxQty: onSite
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
        var itemKind = normalizeBulkSectionKind(kind);
        var itemLabel = itemKind === 'work' ? 'работы' : (itemKind === 'material' ? 'материалы' : 'позиции');
        var ariaLabel = 'Отметить все ' + itemLabel + ' раздела выполненными';
        var checked = !!(progress && progress.total && progress.done >= progress.total);
        var disabled = !(progress && progress.total) ? ' disabled' : '';
        return '<label class="bulk-section-check" title="' + escapeHtml(ariaLabel) + '">' +
            '<input type="checkbox" aria-label="' + escapeHtml(ariaLabel) + '" data-bulk-section-check="' + escapeHtml(sectionId) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-bulk-kind="' + escapeHtml(itemKind) + '"' + (checked ? ' checked' : '') + disabled + '>' +
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
            '<span><small class="quantity-actual-label">\u0424\u0430\u043a\u0442</small><b>' + escapeHtml(quantityText(progress.actual)) + '</b><small class="quantity-actual-separator">\u0438\u0437</small><em>' + escapeHtml(quantityText(progress.total)) + ' ' + escapeHtml(progress.unit || '\u0435\u0434.') + '</em></span>' +
            '<div><input class="quantity-actual-input" type="number" min="0" max="' + escapeHtml(String(progress.total || '')) + '" step="' + stepValue + '" value="' + escapeHtml(String(Math.round((progress.actual || 0) * 10) / 10)) + '" data-actual-qty-input data-actual-kind="' + escapeHtml(kind) + '" data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-item-id="' + escapeHtml(itemId) + '" data-item-title="' + escapeHtml(item && item.title || '') + '" data-item-unit="' + escapeHtml(item && item.unit || '') + '" data-item-qty="' + escapeHtml(String(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty) || '')) + '"><em>' + escapeHtml(progress.unit || '\u0435\u0434.') + '</em></div>' +
        '</label>';
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
        var icons = { planned: 'calendar-clock', approved: 'send', paid: 'circle-check', cancelled: 'circle-x' };
        return '<div class="finance-status-track is-status-' + escapeHtml(status || 'planned') + (status === 'paid' ? ' is-paid' : '') + (status === 'cancelled' ? ' is-cancelled' : '') + '">' +
            '<i data-lucide="' + escapeHtml(icons[status] || 'circle') + '"></i>' +
            '<span>' + escapeHtml(financeStatusLabel(status)) + '</span>' +
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

    function canManageProjectAccess() {
        return canManageTeam() || isDirectorRole() || isAdminRole();
    }

    function ensureProjectAccessModal() {
        var modal = qs('[data-project-access-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'project-access-modal hidden';
        modal.setAttribute('data-project-access-modal', '');
        modal.innerHTML =
            '<button class="project-access-backdrop" type="button" data-project-access-close aria-label="Закрыть"></button>' +
            '<section class="project-access-dialog" role="dialog" aria-modal="true" aria-label="Ответственные объекта">' +
                '<div class="card-head">' +
                    '<div><h3>Ответственные объекта</h3><span class="muted" data-project-access-title></span></div>' +
                    '<button class="ghost compact" type="button" data-project-access-close>Закрыть</button>' +
                '</div>' +
                '<form data-project-access-form>' +
                    '<section class="project-access-role-section"><h4>Прорабы</h4><div class="project-access-list" data-project-access-foremen></div></section>' +
                    '<section class="project-access-role-section"><h4>Снабжение</h4><div class="project-access-list" data-project-access-purchasers></div></section>' +
                    '<div class="form-error" data-project-access-error></div>' +
                    '<button class="primary" type="submit">Сохранить ответственных</button>' +
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

    function renderProjectAccessModal(project, foremen, purchasers) {
        var modal = ensureProjectAccessModal();
        var title = qs('[data-project-access-title]', modal);
        var foremenList = qs('[data-project-access-foremen]', modal);
        var purchasersList = qs('[data-project-access-purchasers]', modal);
        var assignedForemen = Array.isArray(project.assigned_foremen) ? project.assigned_foremen.map(Number) : [];
        var assignedPurchaser = Number(project.buyer_id || 0);
        if (title) title.textContent = project.title || '';
        if (foremenList) {
            if (!foremen.length) {
                safeReplaceChildren(foremenList, '<p class="muted">Прорабы пока не созданы.</p>');
            } else {
                safeReplaceChildren(foremenList, foremen.map(function (user) {
                    var checked = assignedForemen.indexOf(Number(user.id)) !== -1 ? ' checked' : '';
                    var meta = [user.login].filter(Boolean).join(' - ');
                    return '<label class="project-access-row">' +
                        '<input type="checkbox" name="foreman_ids" value="' + escapeHtml(user.id) + '"' + checked + '> ' +
                        '<span><b>' + escapeHtml(personDisplayName(user) || user.login) + '</b><small>' + escapeHtml(meta || 'foreman') + '</small></span>' +
                    '</label>';
                }).join(''));
            }
        }
        if (purchasersList) {
            var unassignedChecked = assignedPurchaser ? '' : ' checked';
            var purchaserRows = '<label class="project-access-row">' +
                '<input type="radio" name="purchaser_id" value=""' + unassignedChecked + '> ' +
                '<span><b>Не назначен</b><small>Снабжение без ответственного</small></span>' +
            '</label>';
            purchaserRows += purchasers.map(function (user) {
                var checked = assignedPurchaser === Number(user.id) ? ' checked' : '';
                var meta = [user.login].filter(Boolean).join(' - ');
                return '<label class="project-access-row">' +
                    '<input type="radio" name="purchaser_id" value="' + escapeHtml(user.id) + '"' + checked + '> ' +
                    '<span><b>' + escapeHtml(personDisplayName(user) || user.login) + '</b><small>' + escapeHtml(meta || 'purchaser') + '</small></span>' +
                '</label>';
            }).join('');
            if (!purchasers.length) purchaserRows += '<p class="muted">Снабженцы пока не созданы.</p>';
            safeReplaceChildren(purchasersList, purchaserRows);
        }
        var form = qs('[data-project-access-form]', modal);
        if (form) form.dataset.projectId = project.id;
        modal.classList.remove('hidden');
    }

    function openProjectAccessModal() {
        if (!canManageProjectAccess()) return;
        var project = state.selectedProject;
        if (!project) {
            showAppNotice('Сначала открой объект.', 'warn');
            return;
        }
        loadUserDirectory(function (users) {
            var foremen = users.filter(function (user) {
                return userHasRoleCode(user, 'foreman');
            });
            var purchasers = users.filter(function (user) {
                return userHasRoleCode(user, 'purchaser');
            });
            renderProjectAccessModal(project, foremen, purchasers);
        });
    }

    function saveProjectAccess(form) {
        if (!canManageProjectAccess()) {
            showAppNotice('Недостаточно прав для назначения ответственных.', 'error');
            return;
        }
        var projectId = Number(form.dataset.projectId || 0);
        var error = qs('[data-project-access-error]');
        if (error) error.classList.remove('active');
        var foremanIds = qsa('input[name="foreman_ids"]:checked', form).map(function (input) {
            return Number(input.value);
        });
        var purchaserInput = qs('input[name="purchaser_id"]:checked', form);
        var purchaserId = Number(purchaserInput && purchaserInput.value || 0);
        var purchaserIds = purchaserId ? [purchaserId] : [];
        withSubmitLock(form, function () {
            return api('/api/users/manage', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'set_project_foremen',
                    project_id: projectId,
                    foreman_ids: foremanIds,
                    purchaser_ids: purchaserIds
                })
            }).then(function (data) {
                var assignedForemen = Array.isArray(data.assigned_foremen) ? data.assigned_foremen : foremanIds;
                var assignedPurchasers = Array.isArray(data.assigned_purchasers) ? data.assigned_purchasers : purchaserIds;
                var assignedPurchaserId = assignedPurchasers.length ? Number(assignedPurchasers[0]) : null;
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
                if (project) {
                    project.assigned_foremen = assignedForemen;
                    project.buyer_id = assignedPurchaserId;
                }
                if (state.selectedProject && Number(state.selectedProject.id) === projectId) {
                    state.selectedProject.assigned_foremen = project ? project.assigned_foremen : assignedForemen;
                    state.selectedProject.buyer_id = project ? project.buyer_id : assignedPurchaserId;
                    loadProjectAssignments(projectId);
                }
                renderProjectList(state.projects);
                closeProjectAccessModal();
                showAppNotice('Ответственные объекта сохранены.', 'success');
            }).catch(function (err) {
                var message = appErrorMessage(err, 'Не удалось сохранить ответственных объекта.');
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
            daily_tasks: 'Задачи сотрудников',
            projects: state.selectedProject && state.selectedProject.title ? state.selectedProject.title : 'Объекты',
            autobot: 'AutoBot',
            schedule: 'График работ',
            logs: 'Журнал работ',
            warehouse: 'Склад',
            suppliers: 'Контрагенты',
            users: 'Сотрудники',
            companies: 'Компании'
        };
        return labels[page] || 'PM.bi';
    }

    function renderTopbarTemplate() {
        if (isGuestRole() || document.body.classList.contains('role-guest')) {
            return '' +
                '<div class="topbar-left">' +
                    '<a class="guest-topbar-brand" href="/app/projects" aria-label="PM.bi — объекты"><img src="/assets/logo.png?v=20260728-textfix2" alt=""><span>PM.bi</span></a>' +
                '</div>' +
                '<div class="topbar-actions">' +
                    '<button class="topbar-logout-action" type="button" data-logout>' +
                        '<i data-lucide="log-out" aria-hidden="true"></i>' +
                        '<span>Выйти</span>' +
                    '</button>' +
                '</div>';
        }
        return '' +
            '<div class="topbar-left">' +
                '<button class="menu-btn topbar-icon-button" type="button" data-menu-toggle aria-label="Навигация" title="Навигация">' +
                    '<i data-lucide="panel-left" aria-hidden="true"></i>' +
                '</button>' +
            '</div>' +
            '<div class="topbar-actions">' +
                '<div class="topbar-reminders-wrap">' +
                    '<button class="topbar-icon-button reminder-circle" type="button" data-reminder-toggle aria-label="Уведомления: срочных нет" title="Уведомления: срочных нет" aria-expanded="false" aria-haspopup="dialog" aria-controls="reminder-center-popover">' +
                        '<i data-lucide="bell" aria-hidden="true"></i>' +
                        '<span class="reminder-count" data-reminder-count hidden>0</span>' +
                    '</button>' +
                    '<div class="reminder-popover reminder-center" id="reminder-center-popover" data-reminder-popover role="dialog" aria-labelledby="reminder-center-title" hidden>' +
                        '<div class="reminder-popover-head">' +
                            '<div class="reminder-head-title">' +
                                '<span class="reminder-head-mark" aria-hidden="true"><i data-lucide="bell-ring"></i></span>' +
                                '<div>' +
                                    '<strong id="reminder-center-title">Центр внимания</strong>' +
                                    '<span data-reminder-subtitle aria-live="polite">Проверяем объекты...</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="reminder-head-actions">' +
                                '<button class="reminder-head-button reminder-refresh-button" type="button" data-reminder-refresh aria-label="Обновить уведомления" title="Обновить уведомления"><i data-lucide="refresh-cw" aria-hidden="true"></i><span>Обновить</span></button>' +
                                '<button class="reminder-head-button reminder-close-button" type="button" data-reminder-close aria-label="Закрыть уведомления" title="Закрыть"><i data-lucide="x" aria-hidden="true"></i></button>' +
                            '</div>' +
                        '</div>' +
                        '<div data-reminder-list></div>' +
                    '</div>' +
                    '<span class="reminder-toast" data-reminder-toast role="status" aria-live="polite" aria-atomic="true" hidden></span>' +
                '</div>' +
                '<button class="topbar-icon-button ai-circle" type="button" data-ai-open data-header-ai-trigger aria-label="Открыть AI помощника" title="AI помощник">' +
                    '<i data-lucide="sparkles" aria-hidden="true"></i>' +
                '</button>' +
                '<div class="topbar-profile-wrap">' +
                    '<button class="topbar-profile" type="button" data-user-toggle data-header-profile-trigger aria-expanded="false" aria-label="Открыть личный кабинет" title="Личный кабинет">' +
                        userAvatarMarkup(state.currentUser || state.user || {}, 'topbar-avatar') +
                        '<i data-lucide="chevron-down" aria-hidden="true"></i>' +
                    '</button>' +
                    '<div class="user-popover" data-user-popover hidden>' +
                        '<div class="user-popover-head">' +
                            '<div class="user-popover-name-row">' +
                                '<span class="user-popover-avatar" data-current-user-avatar aria-hidden="true">' + topbarAvatarInner(state.currentUser || state.user || {}) + '</span>' +
                                '<strong data-current-user>Профиль</strong>' +
                            '</div>' +
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
        var profileOpenLabel = qs('[data-profile-open] span', topbar);
        if (profileOpenLabel) profileOpenLabel.textContent = 'Личный кабинет';
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

    window.addEventListener('pmbi:user-updated', function (event) {
        var user = event && event.detail ? event.detail.user : null;
        if (!user) return;
        state.user = user;
        state.currentUser = user;
        renderAppTopbar();
        renderReminderBell(reminderLastItems, reminderRefreshInFlight || state.reminderProjectsLoading, reminderLastStatus);
        forceTopbarAvatar(user);
    });

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
        var note = totalStages ? (String(doneStages) + '\u0020\u0438\u0437\u0020' + String(totalStages) + ' этапов закрыто') : 'Этапы ещё формируются';
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
        var ordered = 0;
        var required = 0;
        list.forEach(function (item) {
            var status = String(item && item.supplyStatus || '');
            if (status === 'in_stock') onSite += 1;
            if (status === 'ordered') ordered += 1;
            if (status === 'required') required += 1;
        });
        return projectOverviewMetricV2(
            'Закупки / Склад',
            String(onSite),
            'boxes',
            required ? ('Критично закрыть: ' + required) : 'Склад и поставки под контролем',
            '<div class="project-overview-kpi-pairs">' +
                '<div><span>На объекте</span><strong>' + escapeHtml(String(onSite)) + '</strong></div>' +
                '<div><span>Заказано</span><strong>' + escapeHtml(String(ordered)) + '</strong></div>' +
            '</div>'
        );
    }

    function projectOverviewWidgetFinanceV2(project, economics) {
        if (!canViewProjectEconomics()) return '';
        if (!economics) {
            return projectOverviewMetricV2(
                'Экономика',
                'Загрузка…',
                'trending-up',
                'Собираем базу, факт и прогноз',
                '<div class="project-overview-kpi-pairs project-overview-finance-pairs"><div><span>Режим</span><strong>без НДС</strong></div><div><span>Статус</span><strong>—</strong></div></div>'
            );
        }
        if (economics.status === 'unavailable') {
            return projectOverviewMetricV2(
                'Экономика',
                'Недоступна',
                'triangle-alert',
                'Не удалось получить сводку',
                '<div class="project-overview-kpi-pairs project-overview-finance-pairs"><div><span>Режим</span><strong>без НДС</strong></div><div><span>Повтор</span><strong>Финансы</strong></div></div>',
                'is-warn'
            );
        }
        if (economics.status === 'not_configured') {
            return projectOverviewMetricV2(
                'Экономика',
                'Не настроена',
                'calculator',
                'Финансовая база не подтверждена',
                '<div class="project-overview-kpi-pairs project-overview-finance-pairs"><div><span>Прогноз</span><strong>—</strong></div><div><span>Маржа</span><strong>—</strong></div></div>',
                'is-warn'
            );
        }
        var forecast = economics.forecast || null;
        var current = economics.current || {};
        if (!forecast) {
            return projectOverviewMetricV2(
                'Экономика',
                economicsMoney(current.actualCostNetKopecks),
                'calculator',
                'Факт затрат · прогноз не утвержден',
                '<div class="project-overview-kpi-pairs project-overview-finance-pairs"><div><span>Целевая себестоимость</span><strong>' + escapeHtml(economicsMoney(current.targetCostNetKopecks)) + '</strong></div><div><span>Обязательства</span><strong>' + escapeHtml(economicsMoney(current.committedTotalNetKopecks)) + '</strong></div></div>',
                'is-warn'
            );
        }
        var stale = economics.forecastStatus === 'stale';
        var margin = Number(forecast.forecastMarginNetKopecks || 0);
        return projectOverviewMetricV2(
            'Прогнозная маржа',
            economicsMoney(margin),
            margin < 0 ? 'trending-down' : 'trending-up',
            stale ? 'Прогноз требует пересчета' : ('Маржинальность ' + economicsPercent(forecast.forecastMarginPercent)),
            '<div class="project-overview-kpi-pairs project-overview-finance-pairs"><div><span>EAC</span><strong>' + escapeHtml(economicsMoney(forecast.eacNetKopecks)) + '</strong></div><div><span>ETC</span><strong>' + escapeHtml(economicsMoney(forecast.etcNetKopecks)) + '</strong></div></div>',
            stale || margin < 0 ? 'is-warn' : ''
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

    function objectControlActionAttributesV3(item) {
        item = item || {};
        if (item.access) return ' data-project-access-open';
        if (item.quickAction) {
            return ' data-project-quick-action="' + escapeHtml(item.quickAction) + '"' +
                (item.documentType ? (' data-document-type="' + escapeHtml(item.documentType) + '"') : '');
        }
        if (item.tab) {
            return ' data-project-tab-target="' + escapeHtml(item.tab) + '"' +
                (item.scheduleMode ? (' data-project-schedule-mode-target="' + escapeHtml(item.scheduleMode) + '"') : '');
        }
        return '';
    }

    function objectControlDocumentListV3(documents, types) {
        var allowed = Array.isArray(types) ? types : [types];
        return (documents || []).filter(function (doc) {
            return allowed.indexOf(String(doc && doc.doc_type || '')) !== -1;
        });
    }

    function objectControlHasReadyDocumentV3(documents, types) {
        var readyStatuses = ['reviewed', 'approved', 'signed', 'ready'];
        return objectControlDocumentListV3(documents, types).some(function (doc) {
            return !!doc.storage_path && readyStatuses.indexOf(String(doc.status || '')) !== -1;
        });
    }

    function objectControlFinanceOverviewV3(finances) {
        var items = finances && Array.isArray(finances.items) ? finances.items : [];
        var pending = items.filter(function (item) {
            return item.direction === 'expense' && ['paid', 'cancelled'].indexOf(String(item.status || '')) === -1;
        });
        var overdue = pending.filter(function (item) {
            return item.planned_date && String(item.planned_date).slice(0, 10) < APP_TODAY;
        });
        return {
            items: items,
            pending: pending,
            overdue: overdue,
            pendingTotal: pending.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0),
            overdueTotal: overdue.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0),
            summary: finances && finances.summary ? finances.summary : {},
            unavailable: !!(finances && finances.unavailable)
        };
    }

    function objectControlQuickActionV3(action, label, note, icon, documentType) {
        return '<button class="object-quick-action" type="button" data-project-quick-action="' + escapeHtml(action) + '"' +
            (documentType ? (' data-document-type="' + escapeHtml(documentType) + '"') : '') + '>' +
            '<span aria-hidden="true"><i data-lucide="' + escapeHtml(icon) + '"></i></span>' +
            '<span><b>' + escapeHtml(label) + '</b><small>' + escapeHtml(note) + '</small></span>' +
        '</button>';
    }

    function renderObjectQuickCaptureV3() {
        var actions = [];
        if (canManageDocuments()) {
            actions.push(objectControlQuickActionV3('document', 'Фото', 'Результат или проблема', 'camera', 'photo_report'));
        }
        actions.push(objectControlQuickActionV3('material', 'Материал', 'Приход, расход, возврат', 'package-plus'));
        if (canCreateProjectTask()) actions.push(objectControlQuickActionV3('task', 'Задача', 'Ответственный и срок', 'list-plus'));
        if (canSeeFinances()) actions.push(objectControlQuickActionV3('invoice', 'Счёт', 'Поставить к оплате', 'receipt-text'));
        if (!actions.length) return '';
        return '<section class="object-quick-capture" aria-label="Быстро добавить событие">' +
            '<div class="object-quick-capture-head"><strong>Записать событие</strong><span>Одна точка входа для ежедневной работы</span></div>' +
            '<div class="object-quick-capture-actions">' + actions.join('') + '</div>' +
        '</section>';
    }

    function renderObjectAttentionItemV3(item) {
        var actionAttributes = objectControlActionAttributesV3(item);
        return '<article class="object-attention-item ' + (item.tone ? ('is-' + escapeHtml(item.tone)) : '') + '">' +
            '<span class="object-attention-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(item.icon || 'circle-alert') + '"></i></span>' +
            '<span class="object-attention-copy"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.text || '') + '</span></span>' +
            (actionAttributes ? ('<button class="object-attention-action" type="button"' + actionAttributes + '>' + escapeHtml(item.label || 'Открыть') + '</button>') : '') +
        '</article>';
    }

    function renderObjectAttentionPanelV3(items) {
        var visible = (items || []).slice(0, 7);
        var danger = visible.some(function (item) { return item.tone === 'danger'; });
        var content = visible.length
            ? '<div class="object-attention-list">' + visible.map(renderObjectAttentionItemV3).join('') + '</div>'
            : '<div class="object-control-empty"><i data-lucide="circle-check-big" aria-hidden="true"></i><strong>На сейчас всё спокойно</strong><span>Срочных решений не найдено. Вечером не забудьте закрыть день отчетом.</span></div>';
        return '<section class="object-panel object-attention-panel">' +
            '<div class="object-panel-head"><div class="object-panel-title"><span class="object-panel-kicker">Порядок действий</span><h3>Что требует решения</h3><p>Сначала красное, затем жёлтое — остальное система держит в фоне.</p></div>' +
            '<span class="object-attention-count ' + (danger ? 'is-danger' : '') + '">' + escapeHtml(String(visible.length)) + '</span></div>' +
            content +
        '</section>';
    }

    function renderObjectSetupItemV3(item) {
        var stateClass = item.complete ? 'is-complete' : (item.warning ? 'is-warning' : '');
        var icon = item.complete ? 'check' : (item.warning ? 'triangle-alert' : 'circle');
        var action = item.action
            ? '<button class="object-setup-open" type="button"' + objectControlActionAttributesV3(item.action) + '>' + escapeHtml(item.actionLabel || 'Открыть') + '</button>'
            : '';
        return '<div class="object-setup-item ' + stateClass + '">' +
            '<span class="object-setup-state" aria-hidden="true"><i data-lucide="' + icon + '"></i></span>' +
            '<span class="object-setup-copy"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.text) + '</small></span>' +
            action +
        '</div>';
    }

    function renderObjectSetupPanelV3(items) {
        var completed = items.filter(function (item) { return item.complete; }).length;
        var progress = items.length ? Math.round((completed / items.length) * 100) : 0;
        return '<section class="object-panel object-setup-panel">' +
            '<div class="object-panel-head"><div class="object-panel-title"><span class="object-panel-kicker">Основа учёта</span><h3>Объект настроен на ' + progress + '%</h3><p>Без этих пунктов цифрам и срокам нельзя доверять полностью.</p></div></div>' +
            '<div class="object-setup-progress"><span class="object-setup-track"><span style="width:' + progress + '%"></span></span><strong>' + completed + ' из ' + items.length + '</strong></div>' +
            '<div class="object-setup-list">' + items.map(renderObjectSetupItemV3).join('') + '</div>' +
        '</section>';
    }

    function renderObjectSnapshotV3(icon, label, value, note, tab, tone) {
        return '<button class="object-snapshot-card ' + (tone ? ('is-' + escapeHtml(tone)) : '') + '" type="button" data-project-tab-target="' + escapeHtml(tab) + '">' +
            '<span class="object-snapshot-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(icon) + '"></i></span>' +
            '<span class="object-snapshot-copy"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(note) + '</small></span>' +
        '</button>';
    }

    function renderObjectDocumentCategoryV3(documents, config) {
        var count = objectControlDocumentListV3(documents, config.types).length;
        var attrs = ' data-project-tab-target="documents"';
        if (!count && config.quickAction === 'invoice' && canSeeFinances()) {
            attrs = objectControlActionAttributesV3({ quickAction: 'invoice' });
        } else if (!count && canManageDocuments()) {
            attrs = objectControlActionAttributesV3({ quickAction: 'document', documentType: config.preset });
        }
        return '<button class="object-document-category ' + (count ? '' : 'is-empty') + '" type="button"' + attrs + '>' +
            '<span aria-hidden="true"><i data-lucide="' + escapeHtml(config.icon) + '"></i></span>' +
            '<span><b>' + escapeHtml(config.label) + '</b><small>' + escapeHtml(count ? documentCountLabel(count) : 'Добавить первый') + '</small></span>' +
        '</button>';
    }

    function renderObjectDocumentsPanelV3(documents) {
        var categories = [
            { label: 'Договор и смета', icon: 'scroll-text', types: ['contract', 'estimate', 'project_doc'], preset: 'contract' },
            { label: 'Накладные / УПД', icon: 'package-check', types: ['delivery_note', 'upd', 'transport_waybill'], preset: 'delivery_note' },
            { label: 'Путевые листы', icon: 'route', types: ['route_sheet'], preset: 'route_sheet' },
            { label: 'Счета и чеки', icon: 'receipt-text', types: ['invoice', 'cash_receipt', 'finance'], preset: 'invoice', quickAction: 'invoice' },
            { label: 'Акты и ИД', icon: 'file-check-2', types: ['act', 'hidden_work_act', 'inspection_act', 'executive'], preset: 'act' }
        ];
        return '<section class="object-panel object-document-panel">' +
            '<div class="object-panel-head"><div class="object-panel-title"><span class="object-panel-kicker">Первичка</span><h3>Документы по полкам</h3><p>Путевые, накладные, счета и акты больше не теряются в общей папке.</p></div>' +
            '<button class="object-attention-action" type="button" data-project-tab-target="documents">Все документы</button></div>' +
            '<div class="object-document-categories">' + categories.map(function (config) { return renderObjectDocumentCategoryV3(documents, config); }).join('') + '</div>' +
        '</section>';
    }

    function renderProjectPhotoGalleryV4(project, documents) {
        var photos = projectPhotoDocuments(documents).slice(0, 4);
        if (!photos.length) return '';
        return '<section class="object-photo-panel object-panel">' +
            '<div class="object-panel-head"><div class="object-panel-title"><span class="object-panel-kicker">С площадки</span><h3>Последние фото</h3><p>Живой визуальный прогресс объекта — без поиска по общей папке.</p></div>' +
            '<button class="object-attention-action" type="button" data-project-tab-target="documents">Все фото</button></div>' +
            '<div class="object-photo-grid">' + photos.map(function (doc) {
                var title = doc.title || doc.original_name || 'Фото объекта';
                var meta = [doc.stage_title || '', documentDisplayDate(doc)].filter(Boolean).join(' · ');
                return '<a class="object-photo-card" href="' + escapeHtml(projectDocumentImageUrl(doc)) + '" target="_blank" rel="noreferrer" aria-label="Открыть ' + escapeHtml(title) + '">' +
                    '<img src="' + escapeHtml(projectDocumentImageUrl(doc)) + '" alt="" loading="lazy" decoding="async">' +
                    '<span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(meta || project.title || 'Фото объекта') + '</small></span>' +
                '</a>';
            }).join('') + '</div>' +
        '</section>';
    }

    function syncProjectOverviewCover(project, documents) {
        var photo = projectPhotoDocuments(documents)[0];
        var image = qs('[data-project-cover-image]');
        var cover = image && image.closest('[data-project-cover-state]');
        if (!image || !cover) return;
        var label = qs('[data-project-cover-label]', cover);
        var note = qs('[data-project-cover-note]', cover);
        if (!photo) {
            image.src = projectFallbackCoverUrl(project);
            image.alt = '';
            cover.dataset.projectCoverState = 'fallback';
            cover.classList.remove('has-uploaded-photo');
            cover.classList.add('is-curated-cover');
            if (project) {
                project.cover_photo_url = '';
                project.cover_photo_title = '';
            }
            if (label) label.textContent = 'Визуальная обложка';
            if (note) note.textContent = 'Загрузите фотоотчёт — свежий снимок станет обложкой.';
            return;
        }
        image.src = projectDocumentImageUrl(photo);
        image.alt = '';
        cover.dataset.projectCoverState = 'uploaded';
        cover.classList.add('has-uploaded-photo');
        cover.classList.remove('is-curated-cover');
        if (label) label.textContent = 'Фото с объекта';
        if (note) note.textContent = [photo.title || photo.original_name || '', documentDisplayDate(photo)].filter(Boolean).join(' · ');
    }

    renderProjectOverviewHero = function (project) {
        var overviewStart = projectDisplayStartDate(project);
        var overviewDeadline = projectDisplayDeadlineDate(project);
        var safeProgress = percent(project.progress);
        var deadlineTone = projectOverviewDeadlineToneV2(overviewDeadline);
        var cover = projectCoverVisual(project);
        return '<section class="project-command-center">' +
            '<section class="object-identity-card">' +
                '<div class="object-identity-layout">' +
                    '<div class="object-identity-copy">' +
                        '<div class="object-identity-top">' +
                            '<div><span class="object-kicker">Пульт объекта</span><div class="object-title-row"><h2>' + escapeHtml(project.title || 'Без названия') + '</h2><span class="object-status-badge">' + escapeHtml(project.status || 'Подготовка') + '</span></div>' +
                            '<p class="object-address"><i data-lucide="map-pin" aria-hidden="true"></i><span>' + escapeHtml(project.address || 'Адрес не указан') + '</span></p></div>' +
                            '<div class="object-identity-progress"><div class="object-progress-copy"><span>Готовность объекта</span><strong>' + safeProgress + '%</strong></div><span class="object-progress-track"><span style="width:' + safeProgress + '%"></span></span>' +
                            '<span class="object-progress-deadline ' + (deadlineTone ? ('is-' + deadlineTone) : '') + '">' + escapeHtml(overviewDeadline ? (projectOverviewDeadlineHintV2(overviewDeadline) + ' · до ' + formatDisplayDate(overviewDeadline)) : 'Укажите срок объекта') + '</span></div>' +
                        '</div>' +
                        '<div class="object-identity-meta">' +
                            '<div class="object-meta-item"><span>Заказчик</span><strong>' + escapeHtml(project.client_name || 'Не указан') + '</strong></div>' +
                            '<div class="object-meta-item"><span>Договор</span><strong>' + escapeHtml(project.contract_no || 'Не указан') + '</strong></div>' +
                            '<div class="object-meta-item"><span>Период работ</span><strong>' + escapeHtml((overviewStart ? formatDisplayDate(overviewStart) : 'без даты') + ' — ' + (overviewDeadline ? formatDisplayDate(overviewDeadline) : 'без срока')) + '</strong></div>' +
                        '</div>' +
                    '</div>' +
                    '<figure class="object-identity-cover ' + (cover.uploaded ? 'has-uploaded-photo' : 'is-curated-cover') + '" data-project-cover-state="' + (cover.uploaded ? 'uploaded' : 'fallback') + '">' +
                        '<img data-project-cover-image src="' + escapeHtml(cover.url) + '" alt="" loading="eager" decoding="async">' +
                        '<figcaption><span><i data-lucide="camera" aria-hidden="true"></i><b data-project-cover-label>' + (cover.uploaded ? 'Фото с объекта' : 'Визуальная обложка') + '</b></span>' +
                        '<small data-project-cover-note>' + escapeHtml(cover.uploaded ? cover.title : 'Загрузите фотоотчёт — свежий снимок станет обложкой.') + '</small></figcaption>' +
                    '</figure>' +
                '</div>' +
            '</section>' +
            '<div data-project-hub><div class="object-loading-grid" aria-label="Собираем состояние объекта"><span class="object-loading-card"></span><span class="object-loading-card"></span><span class="object-loading-card"></span></div></div>' +
        '</section>';
    };

    renderProjectHub = function (project, data) {
        data = data || {};
        var notifications = data.notifications || {};
        var tasks = Array.isArray(data.tasks) ? data.tasks : [];
        var logs = Array.isArray(data.logs) ? data.logs : [];
        var documents = Array.isArray(data.documents) ? data.documents : [];
        var materials = Array.isArray(data.materials) ? data.materials : [];
        var stages = Array.isArray(data.stages) ? data.stages : [];
        var economics = data.economics || null;
        var finance = objectControlFinanceOverviewV3(data.finances || null);
        var assignments = data.assignments && Array.isArray(data.assignments.assignments) ? data.assignments.assignments : [];
        var readyStatuses = ['reviewed', 'approved', 'signed', 'ready'];
        var contractReady = objectControlHasReadyDocumentV3(documents, ['contract']);
        var hasDeliveryDocument = objectControlDocumentListV3(documents, ['delivery_note', 'upd', 'transport_waybill']).length > 0;
        var estimateTotal = Number(finance.summary.estimateTotal || 0);
        var projectBudget = Number(project.budget || 0);
        var estimateRatio = projectBudget > 0 && estimateTotal > 0 ? estimateTotal / projectBudget : 0;
        var estimateAnomaly = estimateRatio >= 2 || (estimateRatio > 0 && estimateRatio <= .5);
        var hasForeman = assignments.some(function (item) { return item.roleCode === 'foreman'; });
        var hasBuyer = assignments.some(function (item) { return ['purchaser', 'buyer'].indexOf(item.roleCode) !== -1; });
        var scheduleReady = stages.length > 0;
        var startedStages = stages.filter(function (stage) {
            return percent(stage.progress) > 0 || ['active', 'in_progress', 'completed', 'approved'].indexOf(String(stage.status_code || '')) !== -1;
        });
        var lateNotStartedStage = stages.find(function (stage) {
            var start = String(stage.planned_start || '').slice(0, 10);
            return start && start <= APP_TODAY && percent(stage.progress) === 0 && ['completed', 'approved'].indexOf(String(stage.status_code || '')) === -1;
        });
        var criticalMaterials = materials.filter(function (item) { return String(item.supplyStatus || '') === 'required'; });
        var soonMaterials = materials.filter(function (item) { return String(item.supplyStatus || '') === 'soon'; });
        var onSiteMaterials = materials.filter(function (item) {
            return String(item.supplyStatus || '') === 'in_stock' || Number(item.receivedQty || item.received_qty || item.availableQty || 0) > 0;
        });
        var activeTasks = tasks.filter(function (task) { return task.status !== 'done'; });
        var overdueTasks = Array.isArray(notifications.overdueTasks) ? notifications.overdueTasks : activeTasks.filter(function (task) {
            return task.due_at && String(task.due_at).slice(0, 10) < APP_TODAY;
        });
        var docsWithoutFile = documents.filter(function (doc) { return !doc.storage_path; });
        var docsForReview = documents.filter(function (doc) {
            return !doc.storage_path || readyStatuses.indexOf(String(doc.status || '')) === -1;
        });
        var passportReady = !!(project.title && project.client_name && project.address && project.deadline_at);
        var financialBaseReady = !canViewProjectEconomics() || !!(economics && economics.status && ['not_configured', 'unavailable'].indexOf(economics.status) === -1 && !estimateAnomaly);
        var attention = [];

        if (canViewProjectEconomics()) {
            if (!estimateTotal) {
                attention.push({ tone: 'danger', icon: 'file-warning', title: 'Нет рабочей сметы', text: 'Без исходной сметы нельзя контролировать стоимость материалов, работ и остаток бюджета.', label: 'Загрузить', tab: 'estimate-reconciliation' });
            } else if (estimateAnomaly) {
                attention.push({ tone: 'danger', icon: 'scale', title: 'Смета не сходится с бюджетом', text: 'Сумма строк ' + money(estimateTotal) + ', бюджет ' + money(projectBudget) + ' — разница примерно в ' + estimateRatio.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' раза. Проверьте импортированные объёмы и цены по строкам.', label: 'Разобрать сумму', tab: 'schedule', scheduleMode: 'table' });
            }
        }
        if (!contractReady) {
            attention.push({ tone: 'danger', icon: 'file-signature', title: 'Нет подтверждённого договора', text: 'Карточки или номера недостаточно: приложите подписанный файл и отметьте его готовым.', label: 'Загрузить', quickAction: 'document', documentType: 'contract' });
        }
        if (lateNotStartedStage) {
            attention.push({ tone: 'danger', icon: 'calendar-x-2', title: 'Работа должна была начаться', text: (lateNotStartedStage.title || 'Этап') + ' запланирован с ' + formatDisplayDate(lateNotStartedStage.planned_start) + ', но факт не зафиксирован.', label: 'Открыть работы', tab: 'schedule' });
        }
        if (finance.overdue.length) {
            attention.push({ tone: 'danger', icon: 'badge-russian-ruble', title: 'Просрочены оплаты: ' + finance.overdue.length, text: 'В платёжном календаре просрочено ' + money(finance.overdueTotal) + '.', label: 'Разобрать', tab: 'finance' });
        }
        if (criticalMaterials.length) {
            attention.push({ tone: 'danger', icon: 'package-x', title: 'Не хватает материалов: ' + criticalMaterials.length, text: 'Потребность уже наступила. Проверьте заказ, поставщика и дату прихода.', label: 'К материалам', tab: 'warehouse-control' });
        }
        if (overdueTasks.length) {
            attention.push({ tone: 'danger', icon: 'list-x', title: 'Просрочены задачи: ' + overdueTasks.length, text: 'Обновите срок или зафиксируйте результат — просрочка не должна висеть молча.', label: 'Разобрать', tab: 'tasks' });
        }
        if (notifications.missingDailyReport) {
            attention.push({ tone: 'warning', icon: 'notebook-pen', title: 'За сегодня нет отчета', text: 'Вечером зафиксируйте объёмы, людей, технику, поставки, фото и блокеры.' });
        }
        if (!hasRole('customer') && (!hasForeman || !hasBuyer)) {
            var missingRoles = [!hasForeman ? 'прораб' : '', !hasBuyer ? 'снабженец' : ''].filter(Boolean).join(' и ');
            attention.push({ tone: 'warning', icon: 'users-round', title: 'Не назначен ' + missingRoles, text: 'У каждого рабочего контура должен быть конкретный ответственный.', label: 'Назначить', access: canManageProjectAccess(), tab: canManageProjectAccess() ? '' : 'tasks' });
        }
        if (onSiteMaterials.length && !hasDeliveryDocument) {
            attention.push({ tone: 'warning', icon: 'package-open', title: 'Приход есть, накладной нет', text: 'Материал уже числится на объекте. Приложите накладную или УПД как основание прихода.', label: 'Приложить', quickAction: 'document', documentType: 'delivery_note' });
        }
        if (docsForReview.length) {
            attention.push({ tone: 'warning', icon: 'files', title: 'Документы требуют разбора: ' + docsForReview.length, text: (docsWithoutFile.length ? ('Без файла: ' + docsWithoutFile.length + '. ') : '') + 'Проверьте статус, тип и доступ заказчику.', label: 'Проверить', tab: 'documents' });
        }

        var setupItems = [
            { title: 'Паспорт объекта', text: passportReady ? 'Реквизиты и сроки заполнены' : 'Заполните заказчика, адрес и дедлайн', complete: passportReady, action: { quickAction: 'edit' } },
            { title: 'Договор', text: contractReady ? 'Подписанный файл на месте' : 'Нужен подписанный файл, не пустая карточка', complete: contractReady, action: { quickAction: 'document', documentType: 'contract' } },
            { title: 'Прораб', text: hasForeman ? 'Ответственный прораб назначен' : 'Назначьте ответственного прораба', complete: hasForeman, action: canManageProjectAccess() ? { access: true } : { tab: 'tasks' } },
            { title: 'Снабжение', text: hasBuyer ? 'Ответственный за снабжение назначен' : 'Назначьте ответственного за снабжение', complete: hasBuyer, action: canManageProjectAccess() ? { access: true } : { tab: 'tasks' } },
            { title: 'План работ', text: scheduleReady ? (stages.length + ' этапов в графике') : 'Разбейте объект на этапы и сроки', complete: scheduleReady, action: { tab: 'schedule' } },
            { title: 'Финансовая основа', text: !canViewProjectEconomics() ? 'Финансовый контур ведёт ответственная роль' : (estimateAnomaly ? 'Проверьте объёмы и цены строк сметы' : (financialBaseReady ? 'База готова к контролю' : 'Подтвердите бюджет, НДС и прогноз')), complete: financialBaseReady, warning: canViewProjectEconomics() && estimateAnomaly, action: canViewProjectEconomics() ? (estimateAnomaly ? { tab: 'schedule', scheduleMode: 'table' } : { tab: 'finance' }) : null }
        ];

        var supplyTone = criticalMaterials.length ? 'danger' : (soonMaterials.length ? 'warning' : '');
        var financeTone = finance.overdue.length || estimateAnomaly ? 'danger' : (finance.pending.length || !finance.items.length ? 'warning' : '');
        var documentTone = docsForReview.length ? 'warning' : '';
        var snapshots = [
            renderObjectSnapshotV3('hammer', 'Работы', percent(project.progress) + '%', startedStages.length + ' из ' + stages.length + ' этапов начаты', 'schedule', lateNotStartedStage ? 'danger' : ''),
            renderObjectSnapshotV3('boxes', 'Материалы', criticalMaterials.length ? (criticalMaterials.length + ' критично') : (onSiteMaterials.length + ' на объекте'), soonMaterials.length ? ('Скоро нужно: ' + soonMaterials.length) : 'Поставки без срочных сигналов', 'warehouse-control', supplyTone),
            renderObjectSnapshotV3('folder-check', 'Документы', String(documents.length), docsForReview.length ? ('Разобрать: ' + docsForReview.length) : 'Папка в порядке', 'documents', documentTone)
        ];
        if (canSeeFinances()) {
            snapshots.splice(2, 0, renderObjectSnapshotV3('wallet-cards', 'К оплате', finance.pending.length ? money(finance.pendingTotal) : '0 ₽', finance.overdue.length ? ('Просрочено: ' + money(finance.overdueTotal)) : (finance.items.length ? 'Просрочек нет' : 'Внесите входящие остатки'), 'finance', financeTone));
        }

        return renderObjectQuickCaptureV3() +
            '<div class="object-control-grid">' + renderObjectAttentionPanelV3(attention) + renderObjectSetupPanelV3(setupItems) + '</div>' +
            '<div class="object-snapshot-grid">' + snapshots.join('') + '</div>' +
            renderProjectPhotoGalleryV4(project, documents) +
            renderObjectDocumentsPanelV3(documents);
    };

    function refreshProjectOverview(projectId) {
        var selectedId = state.selectedProject && state.selectedProject.id;
        var targetId = Number(projectId || selectedId || 0);
        if (!targetId || !state.selectedProject || Number(selectedId) !== targetId) return;
        var freshProject = (state.projects || []).find(function (item) {
            return Number(item.id) === targetId;
        }) || state.selectedProject;
        state.selectedProject = freshProject;
        var overviewPanel = qs('[data-panel="overview"]');
        if (!overviewPanel) return;
        safeReplaceChildren(overviewPanel, renderProjectOverviewHero(freshProject));
        refreshLucideIcons(overviewPanel);
        bindProjectOverviewActions();
        loadProjectHub(targetId, freshProject, state.projectLoadingToken);
    }

    renderProjectReportsPanel = function () { return operationsCall('renderProjectReportsPanel', arguments); };
    renderProjectReportForm = function () { return operationsCall('renderProjectReportForm', arguments); };
    refreshProjectReportsTab = function () { return operationsCall('refreshProjectReportsTab', arguments); };
    renderLogsList = function () { return operationsCall('renderLogsList', arguments); };
    renderProjectMaterialsTab = function () { return procurementCall('renderProjectMaterialsTab', arguments); };
    renderProjectWorksTab = function () { return procurementCall('renderProjectWorksTab', arguments); };
    rerenderProjectMarketTab = function () { return procurementCall('rerenderProjectMarketTab', arguments); };
    bindProjectMarketToggles = function () { return procurementCall('bindProjectMarketToggles', arguments); };
    renderProjectTabViewSwitcher = function () { return procurementCall('renderProjectTabViewSwitcher', arguments); };
    renderGroupedMaterials = function () { return procurementCall('renderGroupedMaterials', arguments); };
    renderEstimateWorkItem = function () { return procurementCall('renderEstimateWorkItem', arguments); };

    PMBI.app = PMBI.app || {};
    if (typeof loadRoles === 'function') PMBI.app.loadRoles = loadRoles;
    if (typeof syncUserRoleOptions === 'function') PMBI.app.syncUserRoleOptions = syncUserRoleOptions;
    if (typeof loadUsers === 'function') PMBI.app.loadUsers = loadUsers;
    if (typeof formatUserPhone === 'function') PMBI.app.formatUserPhone = formatUserPhone;
    if (typeof isCompleteUserPhone === 'function') PMBI.app.isCompleteUserPhone = isCompleteUserPhone;
    if (typeof isValidUserEmail === 'function') PMBI.app.isValidUserEmail = isValidUserEmail;
    if (typeof bindUserPhoneMask === 'function') PMBI.app.bindUserPhoneMask = bindUserPhoneMask;
    if (typeof setupCompanyCreateModal === 'function') PMBI.app.setupCompanyCreateModal = setupCompanyCreateModal;
    if (typeof resetCompanyCreateForm === 'function') PMBI.app.resetCompanyCreateForm = resetCompanyCreateForm;
    if (typeof closeCompanyCreateModal === 'function') PMBI.app.closeCompanyCreateModal = closeCompanyCreateModal;
    if (typeof canCreateProjectReport === 'function') PMBI.app.canCreateProjectReport = canCreateProjectReport;
    if (typeof getProjectTabMode === 'function') PMBI.app.getProjectTabMode = getProjectTabMode;
    if (typeof setProjectTabMode === 'function') PMBI.app.setProjectTabMode = setProjectTabMode;
    if (typeof loadProjectMarketAnalysis === 'function') PMBI.app.loadProjectMarketAnalysis = loadProjectMarketAnalysis;
    if (typeof logsMonthStartIso === 'function') PMBI.app.logsMonthStartIso = logsMonthStartIso;
    if (typeof formatRuMonthYear === 'function') PMBI.app.formatRuMonthYear = formatRuMonthYear;
    if (typeof bindLogsCalendar === 'function') PMBI.app.bindLogsCalendar = bindLogsCalendar;
    if (typeof buildProjectReportDraft === 'function') PMBI.app.buildProjectReportDraft = buildProjectReportDraft;
    if (typeof bindReportPreview === 'function') PMBI.app.bindReportPreview = bindReportPreview;
    if (typeof bindReportVoiceInputs === 'function') PMBI.app.bindReportVoiceInputs = bindReportVoiceInputs;
    if (typeof startPrimaryReportVoice === 'function') PMBI.app.startPrimaryReportVoice = startPrimaryReportVoice;
    if (typeof reportAuthorInitials === 'function') PMBI.app.reportAuthorInitials = reportAuthorInitials;
    if (typeof reportCreatedDateTime === 'function') PMBI.app.reportCreatedDateTime = reportCreatedDateTime;
    if (typeof reportLogStatus === 'function') PMBI.app.reportLogStatus = reportLogStatus;
    if (typeof renderProjectReportDeleteButton === 'function') PMBI.app.renderProjectReportDeleteButton = renderProjectReportDeleteButton;
    if (typeof bindProjectReportDeleteActions === 'function') PMBI.app.bindProjectReportDeleteActions = bindProjectReportDeleteActions;
    if (typeof ensureProjectReportDrawer === 'function') PMBI.app.ensureProjectReportDrawer = ensureProjectReportDrawer;
    if (typeof renderProjectReportForm === 'function') PMBI.app.renderProjectReportForm = renderProjectReportForm;
    if (typeof renderProjectReportsPanel === 'function') PMBI.app.renderProjectReportsPanel = renderProjectReportsPanel;
    if (typeof refreshProjectReportsTab === 'function') PMBI.app.refreshProjectReportsTab = refreshProjectReportsTab;
    if (typeof renderLogsStats === 'function') PMBI.app.renderLogsStats = renderLogsStats;
    if (typeof renderLogsAlerts === 'function') PMBI.app.renderLogsAlerts = renderLogsAlerts;
    if (typeof renderLogsCalendar === 'function') PMBI.app.renderLogsCalendar = renderLogsCalendar;
    if (typeof renderLogsDayView === 'function') PMBI.app.renderLogsDayView = renderLogsDayView;
    if (typeof renderLogsList === 'function') PMBI.app.renderLogsList = renderLogsList;
    if (typeof bindLogForm === 'function') PMBI.app.bindLogForm = bindLogForm;
    if (typeof loadProjects === 'function') PMBI.app.loadProjects = loadProjects;
    if (typeof loadDashboard === 'function') PMBI.app.loadDashboard = loadDashboard;
    if (typeof loadProjectLogs === 'function') PMBI.app.loadProjectLogs = loadProjectLogs;
    if (typeof applyRoleVisibility === 'function') PMBI.app.applyRoleVisibility = applyRoleVisibility;
    if (typeof renderProjectStats === 'function') PMBI.app.renderProjectStats = renderProjectStats;
    if (typeof renderProjectList === 'function') PMBI.app.renderProjectList = renderProjectList;
    if (typeof openSideDrawer === 'function') PMBI.app.openSideDrawer = openSideDrawer;
    if (typeof closeSideDrawer === 'function') PMBI.app.closeSideDrawer = closeSideDrawer;
    if (typeof ensureSideDrawerFromCard === 'function') PMBI.app.ensureSideDrawerFromCard = ensureSideDrawerFromCard;
    if (typeof groupMaterialsBySection === 'function') PMBI.app.groupMaterialsBySection = groupMaterialsBySection;
    if (typeof syncCurrentUserHeader === 'function') PMBI.app.syncCurrentUserHeader = syncCurrentUserHeader;
    if (typeof initReminderBell === 'function') PMBI.app.initReminderBell = initReminderBell;
    if (typeof initPositionEditor === 'function') PMBI.app.initPositionEditor = initPositionEditor;
    if (typeof highlightPositionRow === 'function') PMBI.app.highlightPositionRow = highlightPositionRow;
    if (typeof focusProjectDeepLink === 'function') PMBI.app.focusProjectDeepLink = focusProjectDeepLink;
    if (typeof handleReminderNavigation === 'function') PMBI.app.handleReminderNavigation = handleReminderNavigation;
    if (typeof renderAppTopbar === 'function') PMBI.app.renderAppTopbar = renderAppTopbar;
    if (typeof populateProjectCompanySelects === 'function') PMBI.app.populateProjectCompanySelects = populateProjectCompanySelects;
    if (typeof updateProjectInState === 'function') PMBI.app.updateProjectInState = updateProjectInState;
    if (typeof setProjectFocusMode === 'function') PMBI.app.setProjectFocusMode = setProjectFocusMode;
    if (typeof openProject === 'function') PMBI.app.openProject = openProject;
    if (typeof refreshProjectOverview === 'function') PMBI.app.refreshProjectOverview = refreshProjectOverview;
    if (typeof activateProjectTab === 'function') PMBI.app.activateProjectTab = activateProjectTab;
    if (typeof isCompletedProject === 'function') PMBI.app.isCompletedProject = isCompletedProject;
    if (typeof statusLabel === 'function') PMBI.app.statusLabel = statusLabel;
    if (typeof stageStatusClass === 'function') PMBI.app.stageStatusClass = stageStatusClass;
    if (typeof isStageOverdue === 'function') PMBI.app.isStageOverdue = isStageOverdue;
    if (typeof isStageBehindPlan === 'function') PMBI.app.isStageBehindPlan = isStageBehindPlan;
    if (typeof daysBetween === 'function') PMBI.app.daysBetween = daysBetween;
    if (typeof signedDaysBetween === 'function') PMBI.app.signedDaysBetween = signedDaysBetween;
    if (typeof stat === 'function') PMBI.app.stat = stat;
    if (typeof renderStages === 'function') PMBI.app.renderStages = renderStages;
    if (typeof renderTaskCreateModal === 'function') PMBI.app.renderTaskCreateModal = renderTaskCreateModal;
    if (typeof normalizeTaskTitle === 'function') PMBI.app.normalizeTaskTitle = normalizeTaskTitle;
    if (typeof loadProjectNotifications === 'function') PMBI.app.loadProjectNotifications = loadProjectNotifications;
    if (typeof refreshReminderBell === 'function') PMBI.app.refreshReminderBell = refreshReminderBell;
    if (typeof loadMaterials === 'function') PMBI.app.loadMaterials = loadMaterials;
    if (typeof loadMaterialInsights === 'function') PMBI.app.loadMaterialInsights = loadMaterialInsights;
    if (typeof loadTasks === 'function') PMBI.app.loadTasks = loadTasks;
    if (typeof loadStages === 'function') PMBI.app.loadStages = loadStages;
    if (typeof renderMaterialsPanel === 'function') PMBI.app.renderMaterialsPanel = renderMaterialsPanel;
    if (typeof renderWorksPanel === 'function') PMBI.app.renderWorksPanel = renderWorksPanel;
    if (typeof renderMaterials === 'function') PMBI.app.renderMaterials = renderMaterials;
    if (typeof materialRow === 'function') PMBI.app.materialRow = materialRow;
    if (typeof renderInlineMarketButton === 'function') PMBI.app.renderInlineMarketButton = renderInlineMarketButton;
    if (typeof renderEstimateAccordionHead === 'function') PMBI.app.renderEstimateAccordionHead = renderEstimateAccordionHead;
    if (typeof renderEstimateSectionBody === 'function') PMBI.app.renderEstimateSectionBody = renderEstimateSectionBody;
    if (typeof isEstimateSectionOpen === 'function') PMBI.app.isEstimateSectionOpen = isEstimateSectionOpen;
    if (typeof setEstimateSectionOpen === 'function') PMBI.app.setEstimateSectionOpen = setEstimateSectionOpen;
    if (typeof toggleEstimateSectionFromHead === 'function') PMBI.app.toggleEstimateSectionFromHead = toggleEstimateSectionFromHead;
    if (typeof materialSectionLabel === 'function') PMBI.app.materialSectionLabel = materialSectionLabel;
    if (typeof sectionProgressBadge === 'function') PMBI.app.sectionProgressBadge = sectionProgressBadge;
    if (typeof sectionPresenceBadge === 'function') PMBI.app.sectionPresenceBadge = sectionPresenceBadge;
    if (typeof buildEstimateSectionNumberMap === 'function') PMBI.app.buildEstimateSectionNumberMap = buildEstimateSectionNumberMap;
    if (typeof estimateDisplaySectionTitleWithNumber === 'function') PMBI.app.estimateDisplaySectionTitleWithNumber = estimateDisplaySectionTitleWithNumber;
    if (typeof bindEstimateSectionToggles === 'function') PMBI.app.bindEstimateSectionToggles = bindEstimateSectionToggles;
    if (typeof setupCompanyCreateModal === 'function') PMBI.app.setupCompanyCreateModal = setupCompanyCreateModal;
    if (typeof resetCompanyCreateForm === 'function') PMBI.app.resetCompanyCreateForm = resetCompanyCreateForm;
    if (typeof closeCompanyCreateModal === 'function') PMBI.app.closeCompanyCreateModal = closeCompanyCreateModal;
    if (typeof loadCompanies === 'function') PMBI.app.loadCompanies = loadCompanies;
    if (typeof ensureCounterpartyCompanies === 'function') PMBI.app.ensureCounterpartyCompanies = ensureCounterpartyCompanies;
    if (typeof companyTypeLabel === 'function') PMBI.app.companyTypeLabel = companyTypeLabel;
    if (typeof counterpartyTypeLabel === 'function') PMBI.app.counterpartyTypeLabel = counterpartyTypeLabel;
    if (typeof counterpartyTypeClass === 'function') PMBI.app.counterpartyTypeClass = counterpartyTypeClass;
    if (typeof counterpartyInitials === 'function') PMBI.app.counterpartyInitials = counterpartyInitials;
    if (typeof counterpartyAvatarStyle === 'function') PMBI.app.counterpartyAvatarStyle = counterpartyAvatarStyle;
    if (typeof counterpartyWebsite === 'function') PMBI.app.counterpartyWebsite = counterpartyWebsite;
    if (typeof counterpartyBindingStats === 'function') PMBI.app.counterpartyBindingStats = counterpartyBindingStats;
    if (typeof renderCounterpartyCard === 'function') PMBI.app.renderCounterpartyCard = renderCounterpartyCard;
    if (typeof renderProjectMaterialsTab === 'function') PMBI.app.renderProjectMaterialsTab = renderProjectMaterialsTab;
    if (typeof renderProjectWorksTab === 'function') PMBI.app.renderProjectWorksTab = renderProjectWorksTab;
    if (typeof rerenderProjectMarketTab === 'function') PMBI.app.rerenderProjectMarketTab = rerenderProjectMarketTab;
    if (typeof bindProjectMarketToggles === 'function') PMBI.app.bindProjectMarketToggles = bindProjectMarketToggles;
    if (typeof renderCounterpartyPicker === 'function') PMBI.app.renderCounterpartyPicker = renderCounterpartyPicker;
    if (typeof renderCounterpartyFilter === 'function') PMBI.app.renderCounterpartyFilter = renderCounterpartyFilter;
    if (typeof filterItemsByCounterparty === 'function') PMBI.app.filterItemsByCounterparty = filterItemsByCounterparty;
    if (typeof bindCounterpartyFilters === 'function') PMBI.app.bindCounterpartyFilters = bindCounterpartyFilters;
    if (typeof renderGroupedMaterials === 'function') PMBI.app.renderGroupedMaterials = renderGroupedMaterials;
    if (typeof renderEstimateWorkItem === 'function') PMBI.app.renderEstimateWorkItem = renderEstimateWorkItem;
    if (typeof renderProjectMarketBlock === 'function') PMBI.app.renderProjectMarketBlock = renderProjectMarketBlock;
    if (typeof bindMarketCreateButtons === 'function') PMBI.app.bindMarketCreateButtons = bindMarketCreateButtons;
    if (typeof warehouseQtyText === 'function') PMBI.app.warehouseQtyText = warehouseQtyText;
    if (typeof warehouseTypeLabel === 'function') PMBI.app.warehouseTypeLabel = warehouseTypeLabel;
    if (typeof warehouseConditionLabel === 'function') PMBI.app.warehouseConditionLabel = warehouseConditionLabel;
    if (typeof loadWarehouseCatalog === 'function') PMBI.app.loadWarehouseCatalog = loadWarehouseCatalog;
    if (typeof renderWarehouseCatalog === 'function') PMBI.app.renderWarehouseCatalog = renderWarehouseCatalog;
    if (typeof loadWarehouseMatches === 'function') PMBI.app.loadWarehouseMatches = loadWarehouseMatches;
    if (typeof renderWarehouseMatchBadge === 'function') PMBI.app.renderWarehouseMatchBadge = renderWarehouseMatchBadge;
    if (typeof renderMaterialDeliveryField === 'function') PMBI.app.renderMaterialDeliveryField = renderMaterialDeliveryField;
    if (typeof renderProjectMaterialsTab === 'function') PMBI.app.renderProjectMaterialsTab = renderProjectMaterialsTab;
    if (typeof renderProjectWorksTab === 'function') PMBI.app.renderProjectWorksTab = renderProjectWorksTab;
    if (typeof rerenderProjectMarketTab === 'function') PMBI.app.rerenderProjectMarketTab = rerenderProjectMarketTab;
    if (typeof refreshCounterpartyProjectViews === 'function') PMBI.app.refreshCounterpartyProjectViews = refreshCounterpartyProjectViews;
    if (typeof bindProjectMarketToggles === 'function') PMBI.app.bindProjectMarketToggles = bindProjectMarketToggles;
    if (typeof bindCounterpartyFilters === 'function') PMBI.app.bindCounterpartyFilters = bindCounterpartyFilters;
    if (typeof bindActualQuantityInputs === 'function') PMBI.app.bindActualQuantityInputs = bindActualQuantityInputs;
    if (typeof installActualQuantityDelegates === 'function') PMBI.app.installActualQuantityDelegates = installActualQuantityDelegates;
    if (typeof renderMaterialManualCheck === 'function') PMBI.app.renderMaterialManualCheck = renderMaterialManualCheck;
    if (typeof renderWorkManualCheck === 'function') PMBI.app.renderWorkManualCheck = renderWorkManualCheck;
    if (typeof materialProgress === 'function') PMBI.app.materialProgress = materialProgress;
    if (typeof workProgressForRows === 'function') PMBI.app.workProgressForRows = workProgressForRows;
    if (typeof renderBulkSectionCheckbox === 'function') PMBI.app.renderBulkSectionCheckbox = renderBulkSectionCheckbox;
    if (typeof sectionProgressStrip === 'function') PMBI.app.sectionProgressStrip = sectionProgressStrip;
    if (typeof finalSectionWorkDigest === 'function') PMBI.app.finalSectionWorkDigest = finalSectionWorkDigest;
    if (typeof finalGraphDate === 'function') PMBI.app.finalGraphDate = finalGraphDate;
    if (typeof finalSectionSummaryNumber === 'function') PMBI.app.finalSectionSummaryNumber = finalSectionSummaryNumber;
    if (typeof buildStageLookup === 'function') PMBI.app.buildStageLookup = buildStageLookup;
    if (typeof rootSectionTitleForStage === 'function') PMBI.app.rootSectionTitleForStage = rootSectionTitleForStage;
    if (typeof quantityPlanInfo === 'function') PMBI.app.quantityPlanInfo = quantityPlanInfo;
    if (typeof quantityText === 'function') PMBI.app.quantityText = quantityText;
    if (typeof isMaterialDone === 'function') PMBI.app.isMaterialDone = isMaterialDone;
    if (typeof setMaterialManualActualQty === 'function') PMBI.app.setMaterialManualActualQty = setMaterialManualActualQty;
    if (typeof setWorkActualQty === 'function') PMBI.app.setWorkActualQty = setWorkActualQty;
    if (typeof effectiveMaterialFromReports === 'function') PMBI.app.effectiveMaterialFromReports = effectiveMaterialFromReports;
    if (typeof reportWorkDoneQty === 'function') PMBI.app.reportWorkDoneQty = reportWorkDoneQty;
    if (typeof materialEffectiveForProgress === 'function') PMBI.app.materialEffectiveForProgress = materialEffectiveForProgress;
    if (typeof materialActualProgress === 'function') PMBI.app.materialActualProgress = materialActualProgress;
    if (typeof workActualProgress === 'function') PMBI.app.workActualProgress = workActualProgress;
    if (typeof actualQuantityInputItem === 'function') PMBI.app.actualQuantityInputItem = actualQuantityInputItem;
    if (typeof renderCompactActualQtyEditor === 'function') PMBI.app.renderCompactActualQtyEditor = renderCompactActualQtyEditor;
    if (typeof saveActualQuantityInput === 'function') PMBI.app.saveActualQuantityInput = saveActualQuantityInput;
    if (typeof openWorkQuantityDialog === 'function') PMBI.app.openWorkQuantityDialog = openWorkQuantityDialog;
    if (typeof closeWorkQuantityDialog === 'function') PMBI.app.closeWorkQuantityDialog = closeWorkQuantityDialog;
    if (typeof saveManualQuantityCheckbox === 'function') PMBI.app.saveManualQuantityCheckbox = saveManualQuantityCheckbox;
    if (typeof rerenderProjectMaterialAndWorkViews === 'function') PMBI.app.rerenderProjectMaterialAndWorkViews = rerenderProjectMaterialAndWorkViews;
    if (typeof refreshSelectedProjectProgressViews === 'function') PMBI.app.refreshSelectedProjectProgressViews = refreshSelectedProjectProgressViews;
    if (typeof bindProjectChainActions === 'function') PMBI.app.bindProjectChainActions = bindProjectChainActions;
    if (typeof renderProjectCritical === 'function') PMBI.app.renderProjectCritical = renderProjectCritical;
    if (typeof planningStatusClass === 'function') PMBI.app.planningStatusClass = planningStatusClass;
    if (typeof marketStatusLabel === 'function') PMBI.app.marketStatusLabel = marketStatusLabel;
    if (typeof missingQty === 'function') PMBI.app.missingQty = missingQty;
    if (typeof missingWorkQty === 'function') PMBI.app.missingWorkQty = missingWorkQty;
    if (typeof scheduleDate === 'function') PMBI.app.scheduleDate = scheduleDate;
    if (typeof renderProjectMeta === 'function') PMBI.app.renderProjectMeta = renderProjectMeta;
    if (typeof renderProjectDocuments === 'function') PMBI.app.renderProjectDocuments = renderProjectDocuments;
    if (typeof renderParticipants === 'function') PMBI.app.renderParticipants = renderParticipants;
    if (typeof renderCounterparties === 'function') PMBI.app.renderCounterparties = renderCounterparties;
    if (typeof renderEquipmentPanel === 'function') PMBI.app.renderEquipmentPanel = renderEquipmentPanel;
    if (typeof renderDocumentsPanel === 'function') PMBI.app.renderDocumentsPanel = renderDocumentsPanel;
    if (typeof renderFinancePanel === 'function') PMBI.app.renderFinancePanel = renderFinancePanel;
    if (typeof renderTasks === 'function') PMBI.app.renderTasks = renderTasks;
    if (typeof renderTaskFilters === 'function') PMBI.app.renderTaskFilters = renderTaskFilters;
    if (typeof bindTaskEvents === 'function') PMBI.app.bindTaskEvents = bindTaskEvents;
    if (typeof bindProjectSearch === 'function') PMBI.app.bindProjectSearch = bindProjectSearch;
    if (typeof renderDashboard === 'function') PMBI.app.renderDashboard = renderDashboard;
    if (typeof renderProjectShell === 'function') PMBI.app.renderProjectShell = renderProjectShell;
    if (typeof renderProjectHeader === 'function') PMBI.app.renderProjectHeader = renderProjectHeader;
    if (typeof renderProjectTabs === 'function') PMBI.app.renderProjectTabs = renderProjectTabs;
    if (typeof selectedProject === 'function') PMBI.app.selectedProject = selectedProject;
    if (typeof setSelectedProject === 'function') PMBI.app.setSelectedProject = setSelectedProject;
    if (typeof updateProjectCache === 'function') PMBI.app.updateProjectCache = updateProjectCache;
    if (typeof renderProjectHub === 'function') PMBI.app.renderProjectHub = renderProjectHub;
    if (typeof renderProjectOverviewHero === 'function') PMBI.app.renderProjectOverviewHero = renderProjectOverviewHero;
    var appStarted = false;

    function cleanupBeforeRouteChange() {
        if (PMBI.operations && typeof PMBI.operations.flushReportDrafts === 'function') PMBI.operations.flushReportDrafts();
        if (PMBI.operations && typeof PMBI.operations.disposeReportDrafts === 'function') PMBI.operations.disposeReportDrafts();
        if (PMBI.autobot && typeof PMBI.autobot.cleanup === 'function') PMBI.autobot.cleanup();
        if (typeof documentWorkspaceCleanup === 'function') documentWorkspaceCleanup();
        if (abortApiRequests) {
            abortApiRequests('projects-list');
            abortApiRequests('dashboard');
            abortApiRequests('users-directory');
            abortApiRequests('roles-directory');
            abortApiRequests('companies-directory');
        }
        if (state.teamRefreshTimer) {
            clearInterval(state.teamRefreshTimer);
            state.teamRefreshTimer = null;
        }
        Object.keys(state.dailyCompletionTimers || {}).forEach(function (taskId) {
            var timer = state.dailyCompletionTimers[taskId];
            if (timer && timer.timerId) clearInterval(timer.timerId);
        });
        state.dailyCompletionTimers = {};
        Object.keys(state.marketAnalysisPollTimers || {}).forEach(function (pollKey) {
            clearTimeout(state.marketAnalysisPollTimers[pollKey]);
        });
        state.marketAnalysisPollTimers = {};
        document.body.classList.remove('menu-open', 'ai-open', 'cal-modal-open', 'project-edit-open', 'guest-access-modal-open', 'work-quantity-dialog-open');
        qsa('[data-guest-access-modal]').forEach(function (modal) { modal.remove(); });
        qsa('[data-work-quantity-dialog]').forEach(function (modal) { modal.remove(); });
    }

    function setPage(nextPage) {
        page = nextPage;
        PMBI.page = nextPage;
        cleanupBeforeRouteChange();
        applyRole();
        initPage();
        if (!isGuestRole()) checkDailyStandup();
    }

    function bootApp() {
        if (appStarted) return;
        appStarted = true;
        if (page === 'login') initLogin();
        else initShell();
    }

    PMBI.app.setPage = setPage;
    PMBI.app.cleanupBeforeRouteChange = cleanupBeforeRouteChange;
    PMBI.appBoot = bootApp;
    window.PMBI = PMBI;

    if (PMBI.planning && typeof PMBI.planning.bindMaterialScheduleTimeline === 'function') {
        bindMaterialScheduleTimeline();
    }
    installVisibleDateFormatter();

    document.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target : null;
        if (!target) return;

        var userToggle = target.closest('[data-user-toggle]');
        if (userToggle) {
            var profileWrap = userToggle.closest('.topbar-profile-wrap');
            var popover = profileWrap ? profileWrap.querySelector('[data-user-popover]') : null;
            if (popover) {
                event.preventDefault();
                event.stopPropagation();
                popover.hidden = !popover.hidden;
                userToggle.setAttribute('aria-expanded', popover.hidden ? 'false' : 'true');
                return;
            }
        }

        var profileBtn = target.closest('[data-profile-open]');
        if (profileBtn) {
            event.preventDefault();
            event.stopPropagation();
            var openPopover = profileBtn.closest('[data-user-popover]');
            var openToggle = openPopover && openPopover.parentElement ? openPopover.parentElement.querySelector('[data-user-toggle]') : null;
            if (openPopover) openPopover.hidden = true;
            if (openToggle) openToggle.setAttribute('aria-expanded', 'false');
            if (window.PMBI && window.PMBI.operations && typeof window.PMBI.operations.openProfileModal === 'function') {
                window.PMBI.operations.openProfileModal();
            } else if (typeof operationsCall === 'function') {
                operationsCall('openProfileModal', []);
            } else {
                console.error('Функция профиля не найдена');
            }
            return;
        }

        var aiBtn = target.closest('[data-header-ai-trigger], [data-ai-open]');
        if (aiBtn) {
            event.preventDefault();
            event.stopPropagation();
            if (window.PMBI && window.PMBI.operations && typeof window.PMBI.operations.toggleAiAssistantDrawer === 'function') {
                window.PMBI.operations.toggleAiAssistantDrawer();
            } else if (typeof operationsCall === 'function') {
                operationsCall('toggleAiAssistantDrawer', []);
            } else {
                console.error('Функция ИИ не найдена');
            }
            return;
        }
    }, true);

    if (PMBI.router && PMBI.router.deferAppBoot && typeof PMBI.router.registerApp === 'function') {
        PMBI.router.registerApp(bootApp);
    } else {
        bootApp();
    }
})();
