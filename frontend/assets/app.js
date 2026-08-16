(function () {
    'use strict';

    var PMBI = window.PMBI || {};
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
    var safeReplaceChildren = PMBI.safeReplaceChildren;
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
    var isAdminRole = PMBI.isAdminRole;
    var currentPermissions = PMBI.currentPermissions;
    var personDisplayName = PMBI.personDisplayName;
    var allowedModules = PMBI.allowedModules;
    var canManageTeam = PMBI.canManageTeam;
    var canManageDailyTasks = PMBI.canManageDailyTasks;
    var canViewPrivateContacts = PMBI.canViewPrivateContacts;
    var canSeeFinances = PMBI.canSeeFinances;
    var canManageSuppliers = PMBI.canManageSuppliers;
    var canManageDocuments = PMBI.canManageDocuments;
    var canManageSchedule = PMBI.canManageSchedule;
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
    function loadProjectLogs() {}
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

        var form = qs('[data-login-form]');
        if (!form) return;
        if (form.rememberMe) form.rememberMe.checked = rememberSessionEnabled();
        if (rememberSessionEnabled()) {
            if (wasAutoLoginAttempted()) {
                stopBrokenAutoLogin();
            } else {
                markAutoLoginAttempted();
                loadCurrentUser({ silentLoader: true, force: true }).then(function () {
                    location.replace(nextPath());
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
            }).then(function () {
                setRememberSession(rememberMe);
                clearAutoLoginAttempt();
                location.replace(nextPath());
            }).catch(function () {
                setRememberSession(false);
                clearAutoLoginAttempt();
                if (error) error.classList.add('active');
                if (button) button.disabled = false;
            });
        });
    }

    function logoutCurrentUser() {
        setRememberSession(false);
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
            checkDailyStandup();
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
            if (visible && link.dataset.nav === page) link.classList.add('active');
        });
    };

    function initPage() {
        if (page === 'dashboard') initDashboardPage();
        if (page === 'daily_tasks') initDailyTasksPage();
        if (page === 'projects') loadUserDirectory(function () {
            loadProjects(function () {
                loadDashboard(renderProjectsPage);
            });
        });
        if (page === 'warehouse') loadProjects(renderWarehousePage);
        if (page === 'suppliers') loadProjects(initSuppliersPage);
        if (page === 'schedule') loadProjects(renderSchedulePage);
        if (page === 'logs') loadProjects(renderLogsPage);
        if (page === 'users') initUsersPage();
        if (page === 'companies') initCompaniesPage();
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

    function closeProjectDetail() {
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
        if (tabName === 'schedule' && PMBI.planning && typeof PMBI.planning.loadSelectedProjectMaterialSchedule === 'function') {
            PMBI.planning.loadSelectedProjectMaterialSchedule(false);
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

    function bindProjectTabClicks() {
        var detail = qs('[data-project-detail]');
        var tabsRoot = detail && qs('.tabs', detail);
        if (!tabsRoot || tabsRoot.dataset.projectTabsBound === '1') return;
        tabsRoot.dataset.projectTabsBound = '1';
        tabsRoot.addEventListener('click', function (event) {
            var button = event.target && event.target.closest('[data-tab]');
            if (!button || !tabsRoot.contains(button)) return;
            event.preventDefault();
            var tabName = button.dataset.tab || 'overview';
            if (button.classList.contains('hidden') || button.getAttribute('aria-hidden') === 'true') return;
            if (tabName === 'finance' && !canSeeFinances()) return;
            activateProjectTab(tabName);
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
        api('/api/users').then(function (data) {
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
                    initTaskDragAndDrop(projectId);
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
        var cards = tasks.length ? tasks.map(function (task) { return renderTaskRow(task, users); }).join('') : '';
        return '<section class="tasks-column tasks-column-' + column.status + '" data-task-column-status="' + escapeHtml(column.status) + '">' +
            '<div class="tasks-column-head">' +
                '<h3>' + escapeHtml(column.title) + '</h3>' +
                '<span>' + tasks.length + '</span>' +
            '</div>' +
            '<div class="tasks-column-list" data-task-drop-list data-task-status="' + escapeHtml(column.status) + '" data-empty="' + (tasks.length ? '0' : '1') + '">' + cards + '</div>' +
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

    function renderTaskRow(task, users) {
        var userOptions = '<option value="">Без ответственного</option>' + users.map(function (user) {
            return '<option value="' + user.id + '"' + (Number(task.assignee_id) === Number(user.id) ? ' selected' : '') + '>' + escapeHtml(user.name) + '</option>';
        }).join('');
        var priority = task.priority || 'normal';
        var isOverdue = task.status !== 'done' && task.due_at && task.due_at < APP_TODAY;
        var assigneeName = taskAssigneeName(task, users);
        var completedAt = task.completed_at || task.completedAt || '';
        var completedTime = completedAt ? dailyTaskTime(completedAt) : '';
        return '<form class="task-card ui-card' + (isOverdue ? ' task-card-overdue' : '') + '" data-task-edit-form data-task-id="' + task.id + '" data-task-current-status="' + escapeHtml(taskColumnStatus(task.status)) + '">' +
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
                    taskAssigneeAvatar(task, users) +
                    '<span>' + escapeHtml(assigneeName) + '</span>' +
                '</div>' +
                '<div class="task-deadline' + (isOverdue ? ' task-deadline-overdue' : '') + '">' +
                    '<span class="task-deadline-icon" aria-hidden="true"></span>' +
                    '<span>' + escapeHtml(task.due_at ? formatDisplayDate(task.due_at) : 'Без срока') + '</span>' +
                '</div>' +
                (completedTime ? '<div class="task-completed-time"><i data-lucide="clock" aria-hidden="true"></i><span>Выполнено в ' + escapeHtml(completedTime) + '</span></div>' : '') +
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
            qsa('.tasks-empty', list).forEach(function (empty) {
                empty.remove();
            });
            list.dataset.empty = cards.length ? '0' : '1';
            var column = list.closest('[data-task-column-status]');
            var count = column ? qs('.tasks-column-head span', column) : null;
            if (count) count.textContent = String(cards.length);
        });
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
                handle: '[data-task-edit-form]',
                filter: 'input, select, textarea, button, option, .task-card-controls, .task-card-controls *',
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
        var modals = qsa('body > [data-task-create-modal]');
        modals.slice(0, -1).forEach(function (modal) { modal.remove(); });
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
                var foremenMeta = projectForemenMeta(project);
                var statusBadge = '<span class="project-status-badge is-' + escapeHtml(statusMeta.tone) + '">' + escapeHtml(statusMeta.label) + '</span>';
                var menuItems = [];
                if (canEditProjectFromCard()) menuItems.push('<button type="button" data-project-edit="' + escapeHtml(project.id || '') + '"><i data-lucide="pencil"></i><span>Редактировать</span></button>');
                if (canManageProjectAccess()) menuItems.push('<button type="button" data-project-card-access="' + escapeHtml(project.id || '') + '"><i data-lucide="users"></i><span>Доступ прораба</span></button>');
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
            bindProjectBackButton();
            syncProjectTabVisibility(qs('[data-project-detail]') || document);
            bindProjectTabClicks();
            refreshLucideIcons(qs('[data-project-detail]') || document);
            var params = new URLSearchParams(location.search);
            var openProjectId = Number(params.get('openProject') || 0);
            var openProjectTab = params.get('tab') || '';
            if (openProjectId && (!state.selectedProject || Number(state.selectedProject.id) !== openProjectId)) {
                var matched = (state.projects || []).some(function (project) { return Number(project.id) === openProjectId; });
                if (matched) {
                    openProject(openProjectId);
                    if (openProjectTab) activateProjectTab(openProjectTab);
                }
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
        bindProjectTabClicks();
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
                dataItem('Бюджет', budget) +
                dataItem('Оплачено', paid) +
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

    function sectionProgressLine(kind, label, progress, sectionId) {
        progress = progress || { total: 0, done: 0, percent: 0 };
        var total = Number(progress.total || 0);
        var done = Number(progress.done || 0);
        var percentValue = total ? percent(progress.percent != null ? progress.percent : Math.round((done / total) * 100)) : 0;
        return '<div class="estimate-section-progress-line estimate-section-progress-line-' + escapeHtml(kind) + '" data-progress-section-id="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '" data-section-progress="' + escapeHtml(canonicalEstimateSectionId(sectionId)) + '" data-section-progress-kind="' + escapeHtml(kind) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percentValue + '">' +
            '<div class="estimate-section-progress-line-head"><strong>' + escapeHtml(label) + '</strong><span data-progress-count>' + escapeHtml(total ? (String(done) + '\u0020\u0438\u0437\u0020' + String(total)) : '\u041f\u043e\u0437\u0438\u0446\u0438\u0439 \u043d\u0435\u0442') + '</span></div>' +
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
            if (state.reminderProjectsLoading) {
                renderReminderBell([], true);
                return;
            }
            state.reminderProjectsLoading = true;
            renderReminderBell([], true);
            api('/api/projects', { silentLoader: true }).then(function (data) {
                state.projects = Array.isArray(data.projects) ? data.projects : [];
                state.reminderProjectsLoading = false;
                refreshReminderBell();
            }).catch(function () {
                state.reminderProjectsLoading = false;
                renderReminderBell([], false);
            });
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
            if (count) count.textContent = group.length ? (String(kindDone) + '\u0020\u0438\u0437\u0020' + String(group.length)) : 'РџРѕР·РёС†РёР№ РЅРµС‚';
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
                    var meta = [user.login].filter(Boolean).join(' - ');
                    return '<label class="project-access-row">' +
                        '<input type="checkbox" name="foreman_ids" value="' + escapeHtml(user.id) + '"' + checked + '> ' +
                        '<span><b>' + escapeHtml(personDisplayName(user) || user.login) + '</b><small>' + escapeHtml(meta || 'foreman') + '</small></span>' +
                    '</label>';
                }).join(''));
            }
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
            renderProjectAccessModal(project, foremen);
        });
    }

    function saveProjectAccess(form) {
        if (!canManageProjectAccess()) {
            showAppNotice('Доступ разрешен только Главному Админу', 'error');
            return;
        }
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
                renderProjectList(state.projects);
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
        return '' +
            '<div class="topbar-left">' +
                '<button class="menu-btn topbar-icon-button" type="button" data-menu-toggle aria-label="Навигация" title="Навигация">' +
                    '<i data-lucide="panel-left" aria-hidden="true"></i>' +
                '</button>' +
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
        var overviewStart = projectDisplayStartDate(project);
        var overviewDeadline = projectDisplayDeadlineDate(project);
        return '<section class="project-overview-shell">' +
            '<section class="project-overview-hero ui-card">' +
                '<div class="project-overview-head">' +
                    '<div class="project-overview-heading">' +
                        '<h3 class="project-overview-title"><span class="project-card-icon project-overview-title-icon" aria-hidden="true"><i data-lucide="building-2"></i></span><span>' + escapeHtml(project.title || 'Без названия') + '</span></h3>' +
                        '<p class="project-overview-address"><span class="project-meta-icon" aria-hidden="true"><i data-lucide="map-pin"></i></span><span>' + escapeHtml(project.address || 'Адрес не указан') + '</span></p>' +
                    '</div>' +
                '</div>' +
                '<div class="project-overview-meta">' +
                    projectOverviewMetaItemV2('Заказчик', project.client_name || 'Не указан') +
                    projectOverviewMetaItemV2('Договор', project.contract_no || 'Не указан') +
                    projectOverviewMetaItemV2('Старт', overviewStart ? formatDisplayDate(overviewStart) : '—') +
                    projectOverviewMetaItemV2('Дедлайн', overviewDeadline ? formatDisplayDate(overviewDeadline) : '—') +
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

    if (page === 'login') initLogin();
    else initShell();
})();
