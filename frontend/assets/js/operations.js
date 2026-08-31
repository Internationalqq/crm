(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    var page = PMBI.page;
    function currentPage() { return PMBI.page || page; }
    var APP_TODAY = PMBI.APP_TODAY;
    var state = PMBI.state;
    var qs = PMBI.qs;
    var qsa = PMBI.qsa;
    var safeReplaceChildren = PMBI.safeReplaceChildren;
    var showSkeleton = PMBI.showSkeleton;
    var refreshLucideIcons = PMBI.refreshLucideIcons;
    var showAppNotice = PMBI.showAppNotice;
    var appErrorMessage = PMBI.appErrorMessage;
    var withSubmitLock = PMBI.withSubmitLock;
    var escapeHtml = PMBI.escapeHtml;
    var formatDisplayDate = PMBI.formatDisplayDate;
    var formatRuDate = PMBI.formatRuDate;
    var api = PMBI.api;
    var debounce = PMBI.debounce;
    var apiFormData = PMBI.apiFormData;
    var money = PMBI.money;
    var percent = PMBI.percent;
    var normalizeRole = PMBI.normalizeRole;
    var hasRole = PMBI.hasRole;
    var isGuestRole = PMBI.isGuestRole || function () { return hasRole('guest'); };
    var canManageTeam = PMBI.canManageTeam;
    var canViewPrivateContacts = PMBI.canViewPrivateContacts;
    var canManageDailyTasks = PMBI.canManageDailyTasks;
    var canManageSuppliers = PMBI.canManageSuppliers;
    var canManageSchedule = PMBI.canManageSchedule;
    var canViewProjectEconomics = PMBI.canViewProjectEconomics || function () { return false; };
    var canDeleteProject = PMBI.canDeleteProject || function () { return hasRole('admin'); };
    var canSeeFinances = PMBI.canSeeFinances;
    var currentRoleLabel = PMBI.currentRoleLabel;
    var personDisplayName = PMBI.personDisplayName;
    var effectiveUserRoles = PMBI.effectiveUserRoles;
    var isClerkEnabled = PMBI.isClerkEnabled;
    var PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
    var userInitials = PMBI.userInitials;
    var safeTelHref = PMBI.safeTelHref;
    var safeAvatarUrl = PMBI.safeAvatarUrl;
    var displayUserName = PMBI.displayUserName;
    var rememberUserInitial = PMBI.rememberUserInitial;
    var profileUserInitials = PMBI.profileUserInitials;

    function currentLocalDateIso() {
        var value = new Date();
        return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
    }

    function appCall(name, args) {
        var fn = PMBI.app && PMBI.app[name];
        if (typeof fn !== 'function') {
            throw new Error('PMBI.app.' + name + ' is not available');
        }
        return fn.apply(null, args);
    }

    function projectScheduleSummary(project) {
        if (!project || !project.id || !state.sectionScheduleByProject) return null;
        return state.sectionScheduleByProject[project.id] || state.sectionScheduleByProject[String(project.id)] || null;
    }

    function projectDisplayStartDate(project) {
        var summary = projectScheduleSummary(project);
        return String(summary && (summary.startDate || summary.projectStart) || project && (project.started_at || project.startDate) || '').trim();
    }

    function projectDisplayDeadlineDate(project) {
        var summary = projectScheduleSummary(project);
        return String(summary && (summary.finishDate || summary.projectEnd) || project && (project.deadline_at || project.deadline) || '').trim();
    }

    function loadProjects() { return appCall('loadProjects', arguments); }
    function loadDashboard() { return appCall('loadDashboard', arguments); }
    function loadProjectNotifications() { return appCall('loadProjectNotifications', arguments); }
    function loadMaterials() { return appCall('loadMaterials', arguments); }
    function loadStages() { return appCall('loadStages', arguments); }
    function loadProjectLogs() { return appCall('loadProjectLogs', arguments); }
    function renderUser() { return appCall('renderUser', arguments); }
    function applyRoleVisibility() { return appCall('applyRoleVisibility', arguments); }
    function renderProjectStats() { return appCall('renderProjectStats', arguments); }
    function renderProjectCritical() { return appCall('renderProjectCritical', arguments); }
    function renderProjectList() { return appCall('renderProjectList', arguments); }
    function renderTasks() { return appCall('renderTasks', arguments); }
    function renderTaskFilters() { return appCall('renderTaskFilters', arguments); }
    function bindTaskEvents() { return appCall('bindTaskEvents', arguments); }
    function renderProjectShell() { return appCall('renderProjectShell', arguments); }
    function renderProjectHeader() { return appCall('renderProjectHeader', arguments); }
    function renderProjectTabs() { return appCall('renderProjectTabs', arguments); }
    function renderProjectHub() { return appCall('renderProjectHub', arguments); }
    function renderProjectOverviewHero() { return appCall('renderProjectOverviewHero', arguments); }
    function refreshProjectOverview() { return appCall('refreshProjectOverview', arguments); }
    function selectedProject() { return appCall('selectedProject', arguments); }
    function setSelectedProject() { return appCall('setSelectedProject', arguments); }
    function updateProjectInState() { return appCall('updateProjectInState', arguments); }
    function updateProjectCache() { return appCall('updateProjectCache', arguments); }
    function setProjectFocusMode() { return appCall('setProjectFocusMode', arguments); }
    function openProject() { return appCall('openProject', arguments); }
    function activateProjectTab() { return appCall('activateProjectTab', arguments); }
    function stat() { return appCall('stat', arguments); }
    function statusLabel() { return appCall('statusLabel', arguments); }
    function beginProjectLoading() { return appCall('beginProjectLoading', arguments); }
    function isCurrentProject() {
        if (typeof PMBI.isCurrentProject === 'function') {
            return PMBI.isCurrentProject.apply(PMBI, arguments);
        }
        return appCall('isCurrentProject', arguments);
    }
    function openSideDrawer() { return appCall('openSideDrawer', arguments); }
    function closeSideDrawer() { return appCall('closeSideDrawer', arguments); }
    function ensureSideDrawerFromCard() { return appCall('ensureSideDrawerFromCard', arguments); }
    function renderSchedulePage() { return appCall('renderSchedulePage', arguments); }
    function renderSchedulePanel() { return appCall('renderSchedulePanel', arguments); }
    function scheduleSectionProgress() { return appCall('scheduleSectionProgress', arguments); }
    function scheduleDeadlineState() { return appCall('scheduleDeadlineState', arguments); }
    function scheduleDeadlineBadge() { return appCall('scheduleDeadlineBadge', arguments); }
    function finalSectionScheduleCardClass() { return appCall('finalSectionScheduleCardClass', arguments); }
    function finalGraphDate() { return appCall('finalGraphDate', arguments); }
    function finalSectionWorkDigest() { return appCall('finalSectionWorkDigest', arguments); }
    function groupMaterialsBySection() { return appCall('groupMaterialsBySection', arguments); }
    function sectionTitleForMaterial() { return appCall('sectionTitleForMaterial', arguments); }
    function materialSectionLabel() { return appCall('materialSectionLabel', arguments); }
    function renderMaterials() { return appCall('renderMaterials', arguments); }
    function renderWorksPanel() { return appCall('renderWorksPanel', arguments); }
    function renderProjectMaterialsTab() { return appCall('renderProjectMaterialsTab', arguments); }
    function renderProjectWorksTab() { return appCall('renderProjectWorksTab', arguments); }
    function bindProjectMarketToggles() { return appCall('bindProjectMarketToggles', arguments); }
    function refreshSelectedProjectProgressViews() { return appCall('refreshSelectedProjectProgressViews', arguments); }
    function rerenderProjectMaterialAndWorkViews() { return appCall('rerenderProjectMaterialAndWorkViews', arguments); }
    function effectiveMaterialFromReports() { return appCall('effectiveMaterialFromReports', arguments); }
    function reportWorkDoneQty() { return appCall('reportWorkDoneQty', arguments); }
    function renderFinancePanel() { return appCall('renderFinancePanel', arguments); }
    function loadProjectFinances() { return appCall('loadProjectFinances', arguments); }
    function renderDocumentsPanel() { return appCall('renderDocumentsPanel', arguments); }
    function loadDocuments() { return appCall('loadDocuments', arguments); }
    function bindProjectChainActions() { return appCall('bindProjectChainActions', arguments); }
    function installActualQuantityDelegates() { return appCall('installActualQuantityDelegates', arguments); }
    function bindActualQuantityInputs() { return appCall('bindActualQuantityInputs', arguments); }
    function syncCurrentUserHeader() { return appCall('syncCurrentUserHeader', arguments); }
    function topbarAvatarInner() {
        if (typeof PMBI.topbarAvatarInner === 'function') return PMBI.topbarAvatarInner.apply(PMBI, arguments);
        return appCall('topbarAvatarInner', arguments);
    }
    function forceTopbarAvatar() {
        if (typeof PMBI.forceTopbarAvatar === 'function') return PMBI.forceTopbarAvatar.apply(PMBI, arguments);
        return appCall('forceTopbarAvatar', arguments);
    }
    function initReminderBell() { return appCall('initReminderBell', arguments); }
    function refreshReminderBell() { return appCall('refreshReminderBell', arguments); }
    function renderAppTopbar() { return appCall('renderAppTopbar', arguments); }
    function bindUserMenu() { return appCall('bindUserMenu', arguments); }
    function initAiAssistant() { return appCall('initAiAssistant', arguments); }
    function bindAutobotImmersiveMode() { return appCall('bindAutobotImmersiveMode', arguments); }
    function applySidebarPreference() { return appCall('applySidebarPreference', arguments); }
    function syncSidebarToggleTitle() { return appCall('syncSidebarToggleTitle', arguments); }
    function toggleSidebarCollapsed() { return appCall('toggleSidebarCollapsed', arguments); }
    function loadCompanies() { return appCall('loadCompanies', arguments); }
    function populateProjectCompanySelects() { return appCall('populateProjectCompanySelects', arguments); }
    function logsMonthStartIso() { return appCall('logsMonthStartIso', arguments); }
    function formatRuMonthYear(monthIso) {
        var date = new Date(String(monthIso || logsMonthStartIso(APP_TODAY)).slice(0, 10) + 'T00:00:00Z');
        if (isNaN(date.getTime())) return String(monthIso || '');
        return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
    }
    function bindLogsCalendar() { return appCall('bindLogsCalendar', arguments); }
    function renderLogsCalendar() { return appCall('renderLogsCalendar', arguments); }
    function renderLogsDayView() { return appCall('renderLogsDayView', arguments); }
    function buildProjectReportDraft() { return appCall('buildProjectReportDraft', arguments); }
    function bindReportPreview() { return appCall('bindReportPreview', arguments); }
    function bindReportVoiceInputs() { return appCall('bindReportVoiceInputs', arguments); }
    function reportAuthorInitials() { return appCall('reportAuthorInitials', arguments); }
    function reportCreatedDateTime() { return appCall('reportCreatedDateTime', arguments); }
    function reportLogStatus() { return appCall('reportLogStatus', arguments); }
    function finalSectionSummaryNumber() { return appCall('finalSectionSummaryNumber', arguments); }
    function renderProjectReportDeleteButton(projectId, log, compact) {
        if (!canCreateProjectReport() || !projectId || !log || !log.id) return '';
        if (Number(log.has_applied_actions || log.hasAppliedActions || 0) > 0) {
            return '<span class="report-actions-locked" title="Отчёт изменил учёт материалов и хранится как первичный документ"><i data-lucide="lock-keyhole"></i><span>Учёт применён</span></span>';
        }
        return '<button class="ghost report-delete-btn' + (compact ? ' compact' : '') + '" type="button" data-project-report-delete="' + escapeHtml(log.id) + '" data-project-id="' + escapeHtml(projectId) + '" aria-label="Удалить отчет" title="Удалить отчет"><i data-lucide="trash-2"></i><span>Удалить</span></button>';
    }
    function renderProjectReportEditButton(projectId, log, compact) {
        if (!canCreateProjectReport() || !projectId || !log || !log.id || projectReportEntryKind(log) === 'section-progress') return '';
        return '<button class="ghost report-edit-btn' + (compact ? ' compact' : '') + '" type="button" data-project-report-edit="' + escapeHtml(log.id) + '" data-project-id="' + escapeHtml(projectId) + '" aria-label="Исправить текст отчёта" title="Исправить текст отчёта"><i data-lucide="pencil-line"></i><span>Исправить</span></button>';
    }

    function projectReportLogById(projectId, logId) {
        var logs = state.projectLogsByProject && state.projectLogsByProject[Number(projectId)] || [];
        return logs.find(function (log) { return Number(log && log.id || 0) === Number(logId); }) || null;
    }

    function reloadProjectReportsAfterChange(projectId) {
        if (state.materialsByProject) delete state.materialsByProject[projectId];
        if (window.PMBI && PMBI.warehouseControl && typeof PMBI.warehouseControl.load === 'function') {
            PMBI.warehouseControl.load(projectId, true);
        }
        refreshProjectOverview(projectId);
        refreshReminderBell();
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || state.selectedProject || { id: projectId, title: 'Объект' };
        loadProjectLogs(projectId, function (logs) {
            loadProjectNotifications(projectId, function (notifications) {
                renderLogsStats(logs, notifications);
                renderLogsAlerts(notifications);
                renderLogsCalendar(project, logs);
                renderLogsList(project, logs);
            });
        });
    }
    function bindProjectReportDeleteActions() {
        qsa('[data-project-report-edit]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                openProjectReportTextEditor(Number(button.dataset.projectId || 0), Number(button.dataset.projectReportEdit || 0));
            });
        });
        qsa('[data-report-stock-move-reverse]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var projectId = Number(button.dataset.projectId || 0);
                var stockMoveId = Number(button.dataset.reportStockMoveReverse || 0);
                if (!projectId || !stockMoveId || !window.confirm('Отменить этот расход и вернуть количество в остаток материала?')) return;
                button.disabled = true;
                api('/api/projects/' + projectId + '/stock-moves/' + stockMoveId + '/reverse', {
                    method: 'POST',
                    body: JSON.stringify({ reason: 'Исправление ошибочного расхода из дневного отчёта' })
                }).then(function () {
                    showAppNotice('Расход отменён, количество возвращено в остаток.', 'success');
                    reloadProjectReportsAfterChange(projectId);
                }).catch(function (error) {
                    button.disabled = false;
                    showAppNotice(appErrorMessage(error, 'Не удалось отменить расход.'), 'error');
                });
            });
        });
        qsa('[data-report-worker-statement]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var projectId = Number(button.dataset.projectId || 0);
                var log = projectReportLogById(projectId, Number(button.dataset.reportWorkerStatement || 0));
                if (log) openProjectReportWorkerStatement(projectId, log);
            });
        });
        qsa('[data-project-report-delete]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var projectId = Number(button.dataset.projectId || 0);
                var logId = Number(button.dataset.projectReportDelete || 0);
                if (!projectId || !logId) return;
                if (!window.confirm('Удалить этот отчет? Действие нельзя отменить.')) return;
                button.disabled = true;
                api('/api/projects/' + projectId + '/daily-logs/' + logId + '/delete', { method: 'POST' }).then(function (data) {
                    if (data && data.project) {
                        updateProjectInState(data.project);
                        renderProjectStats();
                        renderProjectCritical();
                        renderProjectList(state.projects);
                    }
                    refreshProjectOverview(projectId);
                    refreshReminderBell();
                    showAppNotice('Отчет удалён.', 'success');
                    var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || state.selectedProject || { id: projectId, title: 'Объект' };
                    loadProjectLogs(projectId, function (logs) {
                        loadProjectNotifications(projectId, function (notifications) {
                            renderLogsStats(logs, notifications);
                            renderLogsAlerts(notifications);
                            renderLogsCalendar(project, logs);
                            renderLogsList(project, logs);
                        });
                    });
                }).catch(function (error) {
                    button.disabled = false;
                    showAppNotice(reportActionErrorMessage(error, 'Не удалось удалить отчёт.'), 'error');
                });
            });
        });
    }

    function closeProjectReportTextEditor(dialog) {
        if (!dialog) return;
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
    }

    function ensureProjectReportTextEditor() {
        var dialog = qs('[data-report-text-editor]');
        if (dialog) return dialog;
        dialog = document.createElement('dialog');
        dialog.className = 'report-text-editor';
        dialog.setAttribute('data-report-text-editor', '');
        dialog.innerHTML = '<form class="report-text-editor-card" data-report-text-editor-form><div class="report-text-editor-head"><div><b>Исправить отчёт</b><small>Учёт работ и материалов останется без изменений</small></div><button type="button" data-report-text-editor-close aria-label="Закрыть"><i data-lucide="x" aria-hidden="true"></i></button></div><label><span>Описание дня</span><textarea name="work_done" rows="8" required></textarea></label><label><span>Блокеры</span><textarea name="blockers" rows="2"></textarea></label><label><span>Следующий шаг</span><input name="next_steps"></label><div class="form-error" data-report-text-editor-error role="alert"></div><div class="report-text-editor-actions"><button class="ghost" type="button" data-report-text-editor-close>Отмена</button><button class="primary" type="submit">Сохранить исправления</button></div></form>';
        document.body.appendChild(dialog);
        refreshLucideIcons(dialog);
        qsa('[data-report-text-editor-close]', dialog).forEach(function (button) {
            button.addEventListener('click', function () { closeProjectReportTextEditor(dialog); });
        });
        dialog.addEventListener('click', function (event) { if (event.target === dialog) closeProjectReportTextEditor(dialog); });
        var form = qs('[data-report-text-editor-form]', dialog);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var projectId = Number(dialog.dataset.projectId || 0);
            var logId = Number(dialog.dataset.logId || 0);
            var error = qs('[data-report-text-editor-error]', form);
            if (error) { error.textContent = ''; error.classList.remove('active'); }
            withSubmitLock(form, function () {
                return api('/api/projects/' + projectId + '/daily-logs/' + logId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        work_done: form.elements.work_done.value.trim(),
                        blockers: form.elements.blockers.value.trim(),
                        next_steps: form.elements.next_steps.value.trim()
                    })
                }).then(function (data) {
                    var logs = state.projectLogsByProject && state.projectLogsByProject[projectId];
                    if (data && data.log && Array.isArray(logs)) {
                        state.projectLogsByProject[projectId] = logs.map(function (log) {
                            return Number(log.id) === Number(data.log.id) ? data.log : log;
                        });
                    }
                    closeProjectReportTextEditor(dialog);
                    showAppNotice('Текст отчёта исправлен. Учёт не изменён.', 'success');
                    reloadProjectReportsAfterChange(projectId);
                }).catch(function (requestError) {
                    var message = appErrorMessage(requestError, 'Не удалось сохранить исправления.');
                    if (error) { error.textContent = message; error.classList.add('active'); }
                    showAppNotice(message, 'error');
                });
            });
        });
        return dialog;
    }

    function openProjectReportTextEditor(projectId, logId) {
        var log = projectReportLogById(projectId, logId);
        if (!log) return;
        var dialog = ensureProjectReportTextEditor();
        var form = qs('[data-report-text-editor-form]', dialog);
        dialog.dataset.projectId = String(projectId);
        dialog.dataset.logId = String(logId);
        form.elements.work_done.value = String(log.work_done || '');
        form.elements.blockers.value = String(log.blockers || '');
        form.elements.next_steps.value = String(log.next_steps || '');
        var error = qs('[data-report-text-editor-error]', form);
        if (error) { error.textContent = ''; error.classList.remove('active'); }
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        setTimeout(function () { form.elements.work_done.focus(); }, 30);
    }

    function openProjectReportWorkerStatement(projectId, log) {
        var workforce = Array.isArray(log && log.workforce) ? log.workforce : [];
        var rows = [];
        workforce.forEach(function (entry) {
            (Array.isArray(entry.names) ? entry.names : []).forEach(function (name) {
                rows.push({ name: name, role: entry.role || '', hours: entry.hours || 0 });
            });
        });
        if (!rows.length) {
            showAppNotice('Сначала укажите ФИО работников в составе смены.', 'warn');
            return;
        }
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || {};
        var popup = window.open('', '_blank');
        if (!popup) {
            showAppNotice('Браузер заблокировал окно ведомости. Разрешите всплывающие окна и повторите.', 'error');
            return;
        }
        try { popup.opener = null; } catch (error) {}
        var title = 'Ведомость на подпись — ' + String(project.title || 'Объект');
        var bodyRows = rows.map(function (worker, index) {
            return '<tr><td>' + escapeHtml(index + 1) + '</td><td>' + escapeHtml(worker.name) + '</td><td>' + escapeHtml(worker.role) + '</td><td>' + escapeHtml(finalSectionSummaryNumber(worker.hours)) + '</td><td class="blank"></td><td class="signature"></td><td class="date"></td></tr>';
        }).join('');
        var html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(title) + '</title><style>body{margin:0;padding:32px;font:14px Arial,sans-serif;color:#111}h1{margin:0 0 8px;font-size:22px}p{margin:4px 0}.meta{margin:0 0 24px;color:#444}.toolbar{margin-bottom:20px}.toolbar button{padding:10px 16px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{height:42px;padding:7px;border:1px solid #222;text-align:left;vertical-align:middle}th{background:#f1f5f9;font-size:12px}th:first-child,td:first-child{width:34px;text-align:center}th:nth-child(4),td:nth-child(4){width:58px;text-align:center}th:nth-child(5),td:nth-child(5){width:90px}th:nth-child(6),td:nth-child(6){width:110px}th:nth-child(7),td:nth-child(7){width:80px}.note{margin-top:12px;font-size:12px;color:#555}@media print{body{padding:0}.toolbar{display:none}@page{size:A4 landscape;margin:12mm}}</style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Печать / сохранить PDF</button></div><h1>Ведомость о получении денежных средств</h1><div class="meta"><p><b>Объект:</b> ' + escapeHtml(project.title || '—') + '</p><p><b>Смена:</b> ' + escapeHtml(finalGraphDate(log.report_date)) + '</p><p><b>Отчёт:</b> ' + escapeHtml(log.title || ('№ ' + log.id)) + '</p></div><table><thead><tr><th>№</th><th>ФИО</th><th>Специальность</th><th>Часов</th><th>Сумма</th><th>Подпись</th><th>Дата</th></tr></thead><tbody>' + bodyRows + '</tbody></table><p class="note">Сумма, подпись и дата заполняются при фактической выдаче денежных средств. Формирование ведомости само по себе не отмечает выплату в системе.</p></body></html>';
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
    }

    function teamCurrentUser() {
        return (window.PMBI && window.PMBI.state && window.PMBI.state.currentUser) || null;
    }

    function initTeamPage() {
        return initUsersPage.apply(null, arguments);
    }
    // roles helpers
    function loadRoles(callback) {
        if (state.roles.length) {
            syncUserRoleOptions();
            if (callback) callback(state.roles);
            return;
        }
        api('/api/roles', {
            cacheKey: 'roles',
            cacheTtl: 15 * 60 * 1000,
            requestGroup: 'roles-directory'
        }).then(function (data) {
            state.roles = Array.isArray(data.roles) ? data.roles : [];
            syncUserRoleOptions();
            if (callback) callback(state.roles);
        }).catch(function () {
            state.roles = [];
            syncUserRoleOptions();
            if (callback) callback(state.roles);
        });
    }

    function roleOptionLabel(role) {
        return role && (role.name || role.roleLabel || role.code) || '';
    }

    function syncUserRoleOptions(selected) {
        var select = qs('[data-user-role-select]');
        if (!select) return;
        selected = selected || select.value || 'foreman';
        var roles = (state.roles || []).filter(function (role) {
            var code = normalizeRole(role && role.code);
            return code !== 'admin' && code !== 'guest';
        });
        if (!roles.length) roles = [{ code: 'foreman', name: 'Прораб' }];
        safeReplaceChildren(select, roles.map(function (role) {
            var code = normalizeRole(role.code);
            return '<option value="' + escapeHtml(code) + '"' + (String(selected) === String(code) ? ' selected' : '') + '>' + escapeHtml(roleOptionLabel(role)) + '</option>';
        }).join(''));
    }

    // team users reports shell
    function initUsersPage() {
        var user = (window.PMBI && window.PMBI.state && window.PMBI.state.currentUser) || {};
        if (!isGuestRole()) {
            setupGuestAccessManagement();
        }
        if (!canManageTeam()) {
            var formContainer = qs('[data-user-create-container]');
            if (formContainer) formContainer.remove();
            var openBtn = qs('[data-user-create-open]');
            if (openBtn) openBtn.remove();
            var modal = qs('[data-user-create-modal]');
            if (modal) modal.remove();
        } else {
            setupAdminUserManagement();
        }
        loadUsers();
        loadProjects(function () {
            renderUserProjectAccessChecks();
            renderGuestAccessProjectOptions();
            loadUsers();
        });
        startTeamAutoRefresh();
        var refresh = qs('[data-users-refresh]');
        if (refresh && refresh.dataset.usersRefreshBound !== '1') {
            refresh.dataset.usersRefreshBound = '1';
            refresh.addEventListener('click', loadUsers);
        }
        var form = qs('[data-user-create-form]');
        if (!form) return;
        if (!canManageTeam()) return;
        bindLockedUserCreateForm(form);
    }

    function setupAdminUserManagement() {
        var formContainer = qs('[data-user-create-container]');
        if (formContainer && !qs('[data-user-create-open]', formContainer)) {
            var button = document.createElement('button');
            button.className = 'primary';
            button.type = 'button';
            button.setAttribute('data-user-create-open', '');
            button.textContent = '+ \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430';
            formContainer.appendChild(button);
        }
        setupUserCreateModal();
        var form = qs('[data-user-create-form]');
        if (form) bindLockedUserCreateForm(form);
    }

    var guestAccessReturnFocus = null;

    function setupGuestAccessManagement() {
        var container = qs('[data-guest-access-container]');
        if (!container) return;
        if (!qs('[data-guest-access-open]', container)) {
            var button = document.createElement('button');
            button.className = 'ghost guest-access-trigger';
            button.type = 'button';
            button.setAttribute('data-guest-access-open', '');
            button.innerHTML = '<i data-lucide="key-round" aria-hidden="true"></i><span>Добавить гостевой доступ</span>';
            container.appendChild(button);
        }
        setupGuestAccessModal();
        refreshLucideIcons(container);
    }

    function createGuestAccessModal() {
        var existing = qs('[data-guest-access-modal]');
        if (existing) return existing;
        var modal = document.createElement('div');
        modal.className = 'guest-access-modal hidden';
        modal.setAttribute('data-guest-access-modal', '');
        safeReplaceChildren(modal,
            '<button class="guest-access-backdrop" type="button" data-guest-access-close aria-label="Закрыть"></button>' +
            '<section class="guest-access-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-access-title">' +
                '<form class="card guest-access-card" data-guest-access-form>' +
                    '<button class="guest-access-close" type="button" data-guest-access-close aria-label="Закрыть"><i data-lucide="x" aria-hidden="true"></i></button>' +
                    '<div class="guest-access-heading">' +
                        '<span class="guest-access-icon" aria-hidden="true"><i data-lucide="key-round"></i></span>' +
                        '<div><span class="guest-access-kicker">Доступ для заказчика</span><h3 id="guest-access-title">Новый гостевой доступ</h3></div>' +
                    '</div>' +
                    '<p class="guest-access-lead">Выберите один объект. Логин и пароль система создаст автоматически.</p>' +
                    '<div data-guest-access-fields>' +
                        '<label class="guest-access-project-field"><span>Объект</span><select name="project_id" data-guest-access-project aria-describedby="guest-access-project-status" required></select><small id="guest-access-project-status" class="guest-access-project-status" data-guest-access-project-status aria-live="polite" hidden></small></label>' +
                    '</div>' +
                    '<div class="form-error" data-guest-access-error></div>' +
                    '<button class="primary guest-access-submit" type="submit" data-guest-access-submit><i data-lucide="wand-sparkles" aria-hidden="true"></i><span>Создать доступ</span></button>' +
                    '<section class="guest-access-result" data-guest-access-result hidden aria-live="polite">' +
                        '<div class="guest-access-success"><i data-lucide="circle-check" aria-hidden="true"></i><div><strong>Доступ готов</strong><span data-guest-access-object></span></div></div>' +
                        '<div class="guest-access-credentials">' +
                            '<div><span>Логин</span><code data-guest-access-login></code></div>' +
                            '<div><span>Пароль</span><code data-guest-access-password></code></div>' +
                        '</div>' +
                        '<p class="guest-access-once"><i data-lucide="shield-alert" aria-hidden="true"></i><span>Сохраните реквизиты сейчас: пароль показывается только один раз.</span></p>' +
                        '<div class="guest-access-result-actions">' +
                            '<button class="primary" type="button" data-guest-access-copy><i data-lucide="copy" aria-hidden="true"></i><span>Скопировать реквизиты</span></button>' +
                            '<button class="ghost" type="button" data-guest-access-new>Создать ещё</button>' +
                        '</div>' +
                    '</section>' +
                '</form>' +
            '</section>'
        );
        document.body.appendChild(modal);
        return modal;
    }

    function renderGuestAccessProjectOptions(modal, options) {
        modal = modal || qs('[data-guest-access-modal]');
        if (!modal) return;
        var select = qs('[data-guest-access-project]', modal);
        if (!select) return;
        var settings = options || {};
        var projects = Array.isArray(state.projects) ? state.projects : [];
        var selectedProjectId = String(select.value || '');
        var placeholder = 'Выберите объект';
        if (settings.loading && !projects.length) placeholder = 'Загружаем объекты…';
        else if (settings.loadFailed && !projects.length) placeholder = 'Не удалось загрузить объекты';
        else if (!projects.length && state.projectsLoaded) placeholder = 'Нет доступных объектов';
        safeReplaceChildren(select,
            '<option value="">' + placeholder + '</option>' + projects.map(function (project) {
                return '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.title || ('Объект #' + project.id)) + '</option>';
            }).join('')
        );
        if (selectedProjectId && projects.some(function (project) { return String(project.id) === selectedProjectId; })) {
            select.value = selectedProjectId;
        }
        select.disabled = projects.length === 0;
        select.setAttribute('aria-busy', settings.loading ? 'true' : 'false');
        var submit = qs('[data-guest-access-submit]', modal);
        if (submit) submit.disabled = projects.length === 0;
        var status = qs('[data-guest-access-project-status]', modal);
        if (status) {
            var statusText = '';
            var statusTone = '';
            if (settings.loading) {
                statusText = projects.length ? 'Обновляем список объектов…' : 'Загружаем доступные объекты…';
                statusTone = 'loading';
            } else if (settings.loadFailed) {
                statusText = 'Не удалось загрузить объекты. Откройте окно ещё раз, чтобы повторить.';
                statusTone = 'error';
            } else if (!projects.length && state.projectsLoaded) {
                statusText = 'Для вашей учётной записи пока нет доступных объектов.';
                statusTone = 'empty';
            }
            status.textContent = statusText;
            status.hidden = !statusText;
            if (statusTone) status.setAttribute('data-tone', statusTone);
            else status.removeAttribute('data-tone');
        }
    }

    function loadGuestAccessProjects(modal) {
        modal = modal || qs('[data-guest-access-modal]');
        if (!modal) return;
        renderGuestAccessProjectOptions(modal, { loading: true });
        return loadProjects(function () {
            renderGuestAccessProjectOptions(modal, { loadFailed: !state.projectsLoaded });
            var select = qs('[data-guest-access-project]', modal);
            if (modal.hasAttribute('data-open') && select && !select.disabled) select.focus();
        });
    }

    function scrubGuestAccessCredentials(modal) {
        ['[data-guest-access-login]', '[data-guest-access-password]', '[data-guest-access-object]'].forEach(function (selector) {
            var node = qs(selector, modal);
            if (node) node.textContent = '';
        });
    }

    function resetGuestAccessModal() {
        var modal = qs('[data-guest-access-modal]');
        if (!modal) return;
        var form = qs('[data-guest-access-form]', modal);
        if (form) form.reset();
        scrubGuestAccessCredentials(modal);
        var fields = qs('[data-guest-access-fields]', modal);
        var result = qs('[data-guest-access-result]', modal);
        var submit = qs('[data-guest-access-submit]', modal);
        var error = qs('[data-guest-access-error]', modal);
        if (fields) fields.hidden = false;
        if (result) result.hidden = true;
        if (submit) submit.hidden = false;
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        renderGuestAccessProjectOptions(modal);
    }

    function openGuestAccessModal(event) {
        var modal = qs('[data-guest-access-modal]');
        if (!modal) return;
        guestAccessReturnFocus = event && event.currentTarget ? event.currentTarget : document.activeElement;
        resetGuestAccessModal();
        modal.classList.remove('hidden');
        document.body.classList.add('guest-access-modal-open');
        loadGuestAccessProjects(modal);
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            var select = qs('[data-guest-access-project]', modal);
            if (select && !select.disabled) select.focus();
        });
    }

    function closeGuestAccessModal() {
        var modal = qs('[data-guest-access-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        scrubGuestAccessCredentials(modal);
        modal.removeAttribute('data-open');
        document.body.classList.remove('guest-access-modal-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) {
                modal.classList.add('hidden');
                resetGuestAccessModal();
                if (guestAccessReturnFocus && typeof guestAccessReturnFocus.focus === 'function') guestAccessReturnFocus.focus();
                guestAccessReturnFocus = null;
            }
        }, 220);
    }

    function copyGuestAccessText(value) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
        return new Promise(function (resolve, reject) {
            var textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                if (!document.execCommand('copy')) throw new Error('copy_failed');
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                textarea.remove();
            }
        });
    }

    function setupGuestAccessModal() {
        var modal = createGuestAccessModal();
        if (!modal) return;
        qsa('[data-guest-access-open]').forEach(function (button) {
            if (button.dataset.guestAccessOpenBound === '1') return;
            button.dataset.guestAccessOpenBound = '1';
            button.addEventListener('click', openGuestAccessModal);
        });
        if (modal.dataset.guestAccessReady === '1') return;
        modal.dataset.guestAccessReady = '1';
        qsa('[data-guest-access-close]', modal).forEach(function (button) {
            button.addEventListener('click', closeGuestAccessModal);
        });
        var form = qs('[data-guest-access-form]', modal);
        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var select = qs('[data-guest-access-project]', form);
                var error = qs('[data-guest-access-error]', form);
                var projectId = Number(select && select.value);
                if (!projectId) {
                    if (error) {
                        error.textContent = 'Выберите объект.';
                        error.classList.add('active');
                    }
                    return;
                }
                if (error) error.classList.remove('active');
                withSubmitLock(form, function () {
                    return api('/api/users/guest-access', {
                        method: 'POST',
                        body: JSON.stringify({ projectId: projectId })
                    }).then(function (data) {
                        var credentials = data && data.credentials || {};
                        var guest = data && data.guest || {};
                        var project = guest.project || {};
                        qs('[data-guest-access-login]', modal).textContent = String(credentials.login || '');
                        qs('[data-guest-access-password]', modal).textContent = String(credentials.password || '');
                        qs('[data-guest-access-object]', modal).textContent = String(project.title || 'Выбранный объект');
                        qs('[data-guest-access-fields]', modal).hidden = true;
                        qs('[data-guest-access-submit]', modal).hidden = true;
                        qs('[data-guest-access-result]', modal).hidden = false;
                        refreshLucideIcons(modal);
                        showAppNotice('Гостевой доступ создан. Передайте реквизиты гостю.', 'success');
                        loadUsers();
                    }).catch(function (requestError) {
                        var message = appErrorMessage(requestError, 'Не удалось создать гостевой доступ');
                        if (error) {
                            error.textContent = message;
                            error.classList.add('active');
                        }
                        throw requestError;
                    });
                });
            });
        }
        var copyButton = qs('[data-guest-access-copy]', modal);
        if (copyButton) {
            copyButton.addEventListener('click', function () {
                var login = qs('[data-guest-access-login]', modal).textContent;
                var password = qs('[data-guest-access-password]', modal).textContent;
                copyGuestAccessText('Логин: ' + login + '\nПароль: ' + password).then(function () {
                    showAppNotice('Логин и пароль скопированы.', 'success');
                }).catch(function () {
                    showAppNotice('Не удалось скопировать. Скопируйте реквизиты вручную.', 'error');
                });
            });
        }
        var newButton = qs('[data-guest-access-new]', modal);
        if (newButton) {
            newButton.addEventListener('click', function () {
                resetGuestAccessModal();
                var select = qs('[data-guest-access-project]', modal);
                if (select && !select.disabled) select.focus();
            });
        }
        if (document.documentElement.dataset.guestAccessEscapeBound !== '1') {
            document.documentElement.dataset.guestAccessEscapeBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeGuestAccessModal();
            });
        }
        renderGuestAccessProjectOptions();
        refreshLucideIcons(modal);
    }

    function bindLockedUserCreateForm(form) {
        if (!form || form.dataset.lockedSubmitBound === '1') return;
        form.dataset.lockedSubmitBound = '1';
        bindUserPhoneMask(form);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!canManageTeam()) {
                showAppNotice('Доступ разрешен только Админу', 'error');
                return;
            }
            var error = qs('[data-user-create-error]', form);
            if (error) error.classList.remove('active');
            var privateEdit = !!(form.user_id && form.user_id.value) && !canViewPrivateContacts() && !String(form.email.value || '').trim() && !String(form.phone.value || '').trim();
            if (!privateEdit && !isValidUserEmail(form.email.value)) {
                showAppNotice('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 Email', 'error');
                if (form.email) form.email.focus();
                return;
            }
            form.phone.value = formatUserPhone(form.phone.value);
            if (!privateEdit && !isCompleteUserPhone(form.phone.value)) {
                showAppNotice('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430', 'error');
                if (form.phone) form.phone.focus();
                return;
            }
            if (!privateEdit && isClerkEnabled() && !String(form.email.value || '').trim()) {
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
            var endpoint = '/api/users/manage';
            var firstName = String(form.first_name && form.first_name.value || '').trim();
            var lastName = String(form.last_name && form.last_name.value || '').trim();
            var fullName = [firstName, lastName].filter(Boolean).join(' ');
            withSubmitLock(form, function () {
                return api(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: form.user_id ? form.user_id.value : '',
                        firstName: firstName,
                        lastName: lastName,
                        first_name: firstName,
                        last_name: lastName,
                        name: fullName,
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

    function safeUserDisplayName(user) {
        user = user || {};
        var splitName = (String(user.last_name || user.lastName || '') + ' ' + String(user.first_name || user.firstName || '')).trim();
        return user.displayName || user.name || splitName || user.login || '';
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
        if (form.phone) {
            form.phone.required = true;
            form.phone.placeholder = '+7 (999) 123-45-67';
        }
        if (form.email) {
            form.email.value = '';
            form.email.required = true;
            form.email.placeholder = '';
        }
        if (form.first_name) form.first_name.value = '';
        if (form.last_name) form.last_name.value = '';
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
            '<div class="team-name-row"><label><span>Имя</span><input name="first_name" required></label><label><span>Фамилия</span><input name="last_name"></label></div>' +
            '<label><span>\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 \u043b\u043e\u0433\u0438\u043d</span><input name="login" required></label>' +
            '<label><span>Email \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430</span><input name="email" type="email" required></label>' +
            '<label><span>\u0422\u0435\u043b\u0435\u0444\u043e\u043d</span><input name="phone" required></label>' +
            '<label><span>\u0421\u0442\u0430\u0440\u0442\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c Clerk</span><input name="password" type="password" minlength="10" required></label>' +
            '<div class="team-role-row"><label><span>\u0420\u043e\u043b\u044c</span><select name="role" required data-user-role-select><option value="foreman">\u041f\u0440\u043e\u0440\u0430\u0431</option></select></label><button class="ghost compact" type="button" data-role-create-open>+ \u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0440\u043e\u043b\u044c</button></div>' +
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
        loadRoles();
        ensureRoleCreateModal();
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
        syncUserRoleOptions();
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
        api('/api/users').then(function (data) {
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
                var displayName = safeUserDisplayName(user);
                return '<div class="user-row"><div><b>' + escapeHtml(displayName) + '</b><small>' + escapeHtml(contacts) + '</small></div><div class="badge-list">' + roleBadges + '</div></div>';
            }).join('') + '</div>';
        }).catch(function () {
            root.innerHTML = '<p class="muted">Не удалось загрузить список команды. Обнови страницу или попробуй позже.</p>';
        });
    }

    function userRoleLabel(role) {
        var code = normalizeRole(role && (role.code || role) || '');
        if (code === 'main_admin') return 'Главный Админ';
        if (code === 'admin') return '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440';
        if (code === 'director') return '\u0414\u0438\u0440\u0435\u043a\u0442\u043e\u0440';
        if (code === 'foreman') return '\u041f\u0440\u043e\u0440\u0430\u0431';
        return role && (role.name || role.roleLabel) || code || '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a';
    }

    function userRoleClass(role) {
        var code = normalizeRole(role && (role.code || role) || '');
        if (code === 'main_admin') return ' is-admin';
        if (code === 'admin') return ' is-admin';
        if (code === 'director') return ' is-director';
        if (code === 'foreman') return ' is-foreman';
        return '';
    }

    function userAssignedProjects(user) {
        var direct = Array.isArray(user && user.assignedProjects) ? user.assignedProjects : (Array.isArray(user && user.assigned_projects) ? user.assigned_projects : (Array.isArray(user && user.projects) ? user.projects : []));
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

    function startTeamAutoRefresh() {
        if (currentPage() !== 'users' || state.teamRefreshTimer) return;
        state.teamRefreshTimer = setInterval(function () {
            if (document.hidden) return;
            loadProjects(function () {
                loadUsers({ silent: true });
            });
        }, 8000);
    }

    function userCurrentObjectLabel(user) {
        var explicit = String(user && user.currentObjectName || '').trim();
        if (explicit) return explicit;
        var assigned = userAssignedProjects(user);
        if (!assigned.length) return 'Офис';
        var first = assigned[0] || {};
        return first.title || first.name || first.projectTitle || 'На объекте';
    }

    function userWorkStatus(user) {
        var status = String(user && user.workStatus || '').trim();
        if (status) return status;
        return userAssignedProjects(user).length ? 'На объекте' : 'Вне объекта';
    }

    function userWorkStatusTone(user) {
        return String(user && user.workStatusTone || '').trim() || (userAssignedProjects(user).length ? 'green' : 'muted');
    }

    function renderUserCard(user) {
        user = user || {};
        var displayName = safeUserDisplayName(user);
        var roles = effectiveUserRoles(user);
        var roleBadges = roles.map(function (role) {
            return '<span class="employee-role-badge' + userRoleClass(role) + '">' + escapeHtml(userRoleLabel(role)) + '</span>';
        }).join('');
        var avatar = user.avatarUrl ? '<img src="' + escapeHtml(user.avatarUrl) + '" alt="">' : escapeHtml(userInitials(user));
        return '<article class="employee-card" data-employee-card data-user-id="' + escapeHtml(user.id || '') + '">' +
            '<div class="employee-card-top">' +
                '<div class="employee-avatar" aria-hidden="true">' + avatar + '</div>' +
                '<div class="employee-main"><h3>' + escapeHtml(displayName || 'Сотрудник') + '</h3><div class="employee-role-list">' + roleBadges + '</div></div>' +
            '</div>' +
            '<div class="employee-card-meta">' +
                '<div><span>Закрепленный объект</span><strong>' + escapeHtml(userCurrentObjectLabel(user)) + '</strong></div>' +
                '<div class="employee-status employee-status-' + escapeHtml(userWorkStatusTone(user)) + '"><i></i><span>' + escapeHtml(userWorkStatus(user)) + '</span></div>' +
            '</div>' +
        '</article>';
    }

    function canDeleteEmployeeAccounts() {
        return canManageTeam();
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
                if (!canManageTeam()) return;
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
        var guestAccount = !!user.isGuest || effectiveUserRoles(user).some(function (item) {
            return normalizeRole(item && item.code || item) === 'guest';
        });
        var avatarUrl = safeAvatarUrl(user.avatarUrl || user.avatar_url || user.avatar || '');
        var avatar = avatarUrl ? '<img src="' + escapeHtml(avatarUrl) + '" alt="">' : escapeHtml(userInitials(user));
        var projects = userAssignedProjects(user);
        var projectsHtml = projects.length ? projects.map(function (project) {
            var projectId = project && (project.id || project.project_id || project.projectId);
            var title = project && (project.title || project.name || project.projectTitle) || ('#' + projectId);
            return '<a class="employee-profile-project" href="/app/projects?openProject=' + encodeURIComponent(projectId || '') + '">' + escapeHtml(title) + '</a>';
        }).join('') : '<span class="employee-project-empty">\u041e\u0431\u044a\u0435\u043a\u0442\u044b \u043d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u044b</span>';
        var deleteButton = canDeleteEmployeeAccounts()
            ? '<button class="employee-profile-delete" type="button" data-employee-delete data-user-id="' + escapeHtml(user.id || '') + '"><i data-lucide="trash-2"></i><span>' + (guestAccount ? 'Удалить гостевой доступ' : '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430') + '</span></button>'
            : '';
        var editButton = canManageTeam() && !guestAccount
            ? '<button class="ghost" type="button" data-employee-profile-edit data-user-id="' + escapeHtml(user.id || '') + '"><i data-lucide="pencil"></i><span>\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c</span></button>'
            : '';
        return '<div class="employee-profile-card">' +
            '<button class="ghost compact employee-profile-close" type="button" data-employee-profile-close>\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>' +
            '<div class="employee-profile-head">' +
                '<div class="employee-profile-avatar" aria-hidden="true">' + avatar + '</div>' +
                '<h3>' + escapeHtml(personDisplayName(user) || 'Сотрудник') + '</h3>' +
                '<span class="employee-role-badge' + userRoleClass(role) + '">' + escapeHtml(userRoleLabel(role)) + '</span>' +
            '</div>' +
            (user.phone || user.email ? '<div class="employee-profile-contacts">' +
                (user.phone ? '<a href="' + escapeHtml(safeTelHref(user.phone || '')) + '"><i data-lucide="phone"></i><span>' + escapeHtml(user.phone) + '</span></a>' : '') +
                (user.email ? '<a href="mailto:' + escapeHtml(user.email || '') + '"><i data-lucide="mail"></i><span>' + escapeHtml(user.email) + '</span></a>' : '') +
            '</div>' : '<div class="employee-profile-private">Контакты скрыты</div>') +
            '<section class="employee-profile-section"><h4>\u0417\u0430\u043a\u0440\u0435\u043f\u043b\u0435\u043d\u043d\u044b\u0435 \u043e\u0431\u044a\u0435\u043a\u0442\u044b</h4><div class="employee-profile-projects">' + projectsHtml + '</div></section>' +
            '<div class="employee-profile-actions">' +
                editButton +
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
        if (!canManageTeam()) return;
        closeEmployeeProfileModal();
        openUserCreateModal({ keepValues: true });
        var form = qs('[data-user-create-form]');
        if (!form) return;
        resetUserCreateForm(form);
        if (form.user_id) form.user_id.value = user.id || '';
        if (form.first_name) form.first_name.value = user.firstName || user.first_name || '';
        if (form.last_name) form.last_name.value = user.lastName || user.last_name || '';
        if (form.login) form.login.value = user.login || '';
        if (form.email) form.email.value = user.email || '';
        if (form.phone) form.phone.value = formatUserPhone(user.phone || '');
        if (!canViewPrivateContacts() && !user.email && !user.phone) {
            if (form.email) {
                form.email.required = false;
                form.email.placeholder = 'Скрыто';
            }
            if (form.phone) {
                form.phone.required = false;
                form.phone.placeholder = 'Скрыто';
            }
        }
        if (form.password) {
            form.password.value = '';
            form.password.required = false;
        }
        var role = employeePrimaryRole(user);
        syncUserRoleOptions(normalizeRole(role && role.code || user.role || 'foreman'));
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
        var guestAccount = !!user.isGuest || effectiveUserRoles(user).some(function (item) {
            return normalizeRole(item && item.code || item) === 'guest';
        });
        var name = personDisplayName(user) || user.login || '\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430';
        var confirmMessage = guestAccount
            ? 'Удалить гостевой доступ «' + name + '»? Гость сразу потеряет доступ к объекту.'
            : '\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430 ' + name + ' \u0438\u0437 \u0441\u0438\u0441\u0442\u0435\u043c\u044b? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e';
        if (!window.confirm(confirmMessage)) return;
        withSubmitLock(button, function () {
            return api('/api/users/manage/' + encodeURIComponent(user.id), { method: 'DELETE' }).then(function () {
                showAppNotice(guestAccount ? 'Гостевой доступ удалён' : '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u0443\u0434\u0430\u043b\u0435\u043d', 'success');
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

    function employeeGroupKey(user) {
        var roles = effectiveUserRoles(user);
        var codes = roles.map(function (role) { return normalizeRole(role && role.code || role); });
        var labels = roles.map(function (role) { return String(userRoleLabel(role)).toLowerCase(); });
        if (codes.indexOf('guest') !== -1) return 'guest';
        if (codes.indexOf('director') !== -1) return 'director';
        if (codes.indexOf('foreman') !== -1) return 'foreman';
        if (codes.indexOf('programmer') !== -1 || codes.indexOf('developer') !== -1 || labels.some(function (label) {
            return label.indexOf('програм') !== -1 || label.indexOf('разработ') !== -1;
        })) return 'programmer';
        return 'other';
    }

    function renderTeamGroups(users) {
        var groups = [
            { key: 'director', title: 'Директор' },
            { key: 'foreman', title: 'Прорабы' },
            { key: 'guest', title: 'Гостевые доступы' },
            { key: 'programmer', title: 'Программисты' },
            { key: 'other', title: 'Остальные роли' }
        ];
        return '<div class="team-groups">' + groups.map(function (group) {
            var items = users.filter(function (user) {
                return employeeGroupKey(user) === group.key;
            });
            if (!items.length && group.key !== 'other') return '';
            if (!items.length) return '';
            return '<section class="team-group team-group-' + escapeHtml(group.key) + '">' +
                '<div class="team-group-head"><h3>' + escapeHtml(group.title) + '</h3><span>' + items.length + '</span></div>' +
                '<div class="users-list employees-grid">' + items.map(renderUserCard).join('') + '</div>' +
            '</section>';
        }).join('') + '</div>';
    }

    loadUsers = function (options) {
        options = options || {};
        var root = qs('[data-users-list]');
        if (!root) return Promise.resolve();
        if (!options.silent && (!root.children.length || qs('[data-pmbi-skeleton]', root))) {
            showSkeleton(root, 'team', 3);
        }
        return api('/api/users').then(function (data) {
            var users = Array.isArray(data.users) ? data.users : [];
            state.users = users;
            safeReplaceChildren(root, users.length
                ? renderTeamGroups(users)
                : '<p class="muted">\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u044b.</p>');
            bindEmployeeCards(root);
            refreshLucideIcons(root);
        }).catch(function () {
            safeReplaceChildren(root, '<p class="muted">\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u043a\u043e\u043c\u0430\u043d\u0434\u044b. \u041e\u0431\u043d\u043e\u0432\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438\u043b\u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u043f\u043e\u0437\u0436\u0435.</p>');
        });
    };

    function initReportsPage() {
        api('/api/dashboard').then(function (data) {
            var stats = qs('[data-dashboard-stats]');
            if (stats) {
                var portfolio = data.portfolioEconomics || {};
                var dashboardCashBalance = data.cashBalance;
                stats.innerHTML =
                    stat('Объектов', data.projectsCount) +
                    stat('В работе', data.activeProjects) +
                    stat('Средний прогресс', data.avgProgress + '%') +
                    stat('Нехватки', data.shortagesCount, data.shortagesCount ? 'danger' : '') +
                    stat('Открытые задачи', data.openTasksCount) +
                    (canViewProjectEconomics() ?
                        stat('Договорная выручка', portfolio.contractRevenueNetKopecks == null ? 'Нет утверждённой базы' : money(Number(portfolio.contractRevenueNetKopecks) / 100)) +
                        stat('Прогнозная маржа', portfolio.forecastMarginNetKopecks == null ? 'Нет актуального прогноза' : money(Number(portfolio.forecastMarginNetKopecks) / 100), Number(portfolio.forecastMarginNetKopecks || 0) < 0 ? 'danger' : '') +
                        stat('Без финансовой базы', portfolio.unconfiguredProjects == null ? '—' : portfolio.unconfiguredProjects, Number(portfolio.unconfiguredProjects || 0) ? 'warn' : '') +
                        stat('Прогноз требует внимания', portfolio.forecastAttentionProjects == null ? '—' : portfolio.forecastAttentionProjects, Number(portfolio.forecastAttentionProjects || 0) ? 'warn' : '') : '') +
                    stat('Кассовый остаток', dashboardCashBalance == null ? 'Скрыто' : money(dashboardCashBalance), dashboardCashBalance < 0 ? 'danger' : '');
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

    // logs page
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
        var photos = logs.reduce(function (sum, log) {
            return sum + (Array.isArray(log.photos) ? log.photos.length : 0);
        }, 0);
        root.innerHTML =
            stat('Отчетов', logs.length) +
            stat('Видно заказчику', visible) +
            stat('Внутренние', internal) +
            stat('Людей в отчетах', workers) +
            stat('С блокерами', blockers, blockers ? 'danger' : '') +
            stat('Фотографий', photos, photos ? '' : 'warn') +
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
        return !hasRole('customer') && !hasRole('guest');
    }

    function canApplyDailyReportMaterialActions() {
        return !!(canManageSchedule && canManageSchedule()) || hasRole('purchaser');
    }

    function canApplyDailyReportWorkActions() {
        return !!(canManageSchedule && canManageSchedule());
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
                cardHead.insertAdjacentHTML('beforeend', '<button class="ghost report-modal-close" type="button" data-close-project-report-create aria-label="Закрыть форму отчета"><span class="report-modal-close-mark" aria-hidden="true"><i data-lucide="x"></i></span><span class="report-modal-close-label">Закрыть</span></button>');
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
            if (panel) {
                panel.classList.add('reports-drawer-panel');
                panel.setAttribute('role', 'dialog');
                panel.setAttribute('aria-modal', 'true');
                panel.setAttribute('aria-labelledby', 'project-report-modal-title');
            }
        }
        var openButtons = qsa('[data-open-project-report-create]');
        openButtons.forEach(function (button) {
            if (!drawer || button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                openSideDrawer(drawer);
                setTimeout(function () {
                    var firstField = qs('textarea[name="raw_input"]', drawer);
                    if (firstField) firstField.focus();
                }, 80);
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

    var baseEnsureProjectReportDrawerUx = ensureProjectReportDrawer;

    function renderProjectReportForm(project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || APP_TODAY;
        return '<section class="subsection report-intake-card">' +
            '<div class="report-drawer-caption">Новый отчет</div>' +
            '<div class="card-head"><div><h3>Новый отчет за день</h3><span class="muted">Фиксируем факт работ, поставки и блокеры.</span></div></div>' +
            '<form class="project-form report-intake-form" data-log-form>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<div class="report-intake-grid">' +
                    '<label><span>Дата</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                    '<label><span>Заголовок</span><input name="title" placeholder="Например: День 1 — старт и завоз материалов" required></label>' +
                    '<label class="wide"><span>Что сделали</span><textarea name="work_done" rows="4" placeholder="Какие работы закрыли, что закупили, что выполнили на объекте" required></textarea></label>' +
                    '<label class="wide"><span>Текст / диктовка для ассистента</span><textarea name="raw_input" rows="3" placeholder="Сегодня начали работы, завезли кабель, закрыли демонтаж, ждем поставку окон..."></textarea></label>' +
                    '<label><span>Людей на объекте</span><input name="workers_count" type="number" min="0" step="1" placeholder="0"></label>' +
                    '<label class="wide"><span>Техника / поставки</span><input name="equipment" placeholder="Манипулятор, бетон, кабель, окна, вышка..."></label>' +
                    '<label><span>Блокеры</span><input name="blockers" placeholder="Что мешает идти дальше"></label>' +
                    '<label><span>Следующий шаг</span><input name="next_steps" placeholder="Что делаем следующим днем"></label>' +
                    '<label><span>Видимость</span><select name="is_client_visible"><option value="1">Видно заказчику</option><option value="0">Внутренний отчет</option></select></label>' +
                '</div>' +
                '<div class="assistant-confirm-card">' +
                    '<b>Подтверждение изменений</b>' +
                    '<div class="assistant-confirm-list">' +
                        '<span>Сейчас отчет сохраняет факт дня. Прогресс объекта меняется отдельно.</span>' +
                    '<span>Следующим шагом сюда подключим подтверждение изменений по материалам, работам и складу через AI-ассистента.</span>' +
                '</div>' +
                '<label class="check-inline report-confirm"><input type="checkbox" name="confirm_report" required> Подтверждаю сохранение отчета</label>' +
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
        if (oldDrawer) {
            disposeReportDraftForm(qs('[data-report-draft-form]', oldDrawer));
            oldDrawer.remove();
        }
        safeReplaceChildren(panel, renderProjectReportsPanel(project));
        var reportDrawer = ensureProjectReportDrawer();
        bindLogForm();
        bindProjectReportAssistantActions();
        refreshLucideIcons(panel);
        if (reportDrawer) refreshLucideIcons(reportDrawer);
        loadProjectLogs(projectId, function (logs) {
            if (hasRole('guest')) {
                if (!isCurrentProject(projectId, loadingToken)) return;
                if (!state.logsSelectedDateByProject[projectId]) {
                    state.logsSelectedDateByProject[projectId] = projectReportDefaultSelectedDate(logs, project.started_at || APP_TODAY);
                }
                renderLogsStats(logs, null);
                renderLogsAlerts(null);
                renderLogsCalendar(project, logs);
                renderLogsList(project, logs);
                return;
            }
            loadProjectNotifications(projectId, function (notifications) {
                if (!isCurrentProject(projectId, loadingToken)) return;
                if (!state.logsSelectedDateByProject[projectId]) {
                    state.logsSelectedDateByProject[projectId] = projectReportDefaultSelectedDate(logs, project.started_at || APP_TODAY);
                }
                renderLogsStats(logs, notifications);
                renderLogsAlerts(notifications);
                renderLogsCalendar(project, logs);
                renderLogsList(project, logs);
            });
        });
    }



    function renderProjectOverviewHero(project) {
        var overviewStart = projectDisplayStartDate(project);
        var overviewDeadline = projectDisplayDeadlineDate(project);
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
                dataItem('Экономика', 'См. раздел «Финансы»') +
                dataItem('Дата договора', project.contract_date ? formatDisplayDate(project.contract_date) : '—') +
                dataItem('Старт', overviewStart ? formatDisplayDate(overviewStart) : '—') +
                dataItem('Дедлайн', overviewDeadline ? formatDisplayDate(overviewDeadline) : '—') +
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
                    '<input name="budget" type="hidden">' +
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
        var deleteButton = qs('[data-project-delete]', card);
        if (deleteButton) deleteButton.hidden = !canDeleteProject();
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

    function waitForProjectControl(selector, callback, attempts) {
        var remaining = Number(attempts == null ? 32 : attempts);
        var node = qs(selector);
        if (node) {
            callback(node);
            return;
        }
        if (remaining <= 0) {
            showAppNotice('Раздел ещё загружается. Попробуйте действие ещё раз.', 'error');
            return;
        }
        window.setTimeout(function () {
            waitForProjectControl(selector, callback, remaining - 1);
        }, 120);
    }

    function projectQuickActionAllowed(action) {
        if (action === 'report') return canCreateProjectReport();
        if (action === 'document') return typeof PMBI.canManageDocuments === 'function' && PMBI.canManageDocuments();
        if (action === 'material') return typeof PMBI.canManageSchedule === 'function' && PMBI.canManageSchedule();
        if (action === 'task') return hasRole('admin') || hasRole('director');
        if (action === 'invoice') return canSeeFinances();
        return true;
    }

    function runProjectQuickAction(button) {
        var action = button.dataset.projectQuickAction || '';
        var menu = button.closest('details');
        if (menu) menu.open = false;
        if (!projectQuickActionAllowed(action)) {
            showAppNotice('У вашей роли нет доступа к этому действию.', 'error');
            return;
        }
        if (action === 'edit') {
            if (state.selectedProject) openProjectEdit(state.selectedProject.id);
            return;
        }
        if (action === 'report') {
            var projectId = Number(state.selectedProject && state.selectedProject.id || 0);
            var startVoice = button.hasAttribute('data-report-start-voice');
            if (!projectId) return;
            var todayIso = currentLocalDateIso();
            state.logsSelectedDateByProject[projectId] = todayIso;
            state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(todayIso);
            activateProjectTab('reports');
            waitForProjectControl('[data-drawer-id="project-report-create"]', function (drawer) {
                var form = qs('[data-log-form]', drawer);
                if (form && form.report_date && form.dataset.reportDraftRestored !== '1' && !form._reportDraftRestoring) {
                    form.dataset.reportDateTouched = '0';
                    form.report_date.value = todayIso;
                    form.report_date.dispatchEvent(new Event('change', { bubbles: true }));
                }
                openSideDrawer(drawer);
                if (startVoice && PMBI.app && typeof PMBI.app.startPrimaryReportVoice === 'function') {
                    PMBI.app.startPrimaryReportVoice(form);
                }
                window.setTimeout(function () {
                    var firstField = qs('textarea[name="raw_input"]', drawer);
                    if (firstField) firstField.focus();
                }, 80);
            });
            return;
        }
        if (action === 'material') {
            activateProjectTab('warehouse-control');
            waitForProjectControl('[data-warehouse-dialog-open="movement"]', function (control) {
                control.click();
            });
            return;
        }
        var config = {
            document: { tab: 'documents', selector: '[data-document-upload-toggle], [data-document-empty-add]' },
            invoice: { tab: 'finance', selector: '[data-finance-open-modal="invoice"]' },
            task: { tab: 'tasks', selector: '[data-task-create-toggle]' }
        }[action];
        if (!config) return;
        activateProjectTab(config.tab);
        waitForProjectControl(config.selector, function (control) {
            control.click();
            if (action !== 'document') return;
            var documentType = button.dataset.documentType || '';
            var form = qs('[data-document-upload-form]');
            if (form && form.doc_type && documentType) {
                form.doc_type.value = documentType;
                form.doc_type.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    function bindProjectOverviewActions() {
        qsa('[data-project-tab-target]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var tabTarget = button.dataset.projectTabTarget;
                var scheduleMode = button.dataset.projectScheduleModeTarget;
                var selectedProjectId = state.selectedProject && Number(state.selectedProject.id || 0);
                if (tabTarget === 'schedule' && selectedProjectId && (scheduleMode === 'table' || scheduleMode === 'market')) {
                    setProjectTabMode(selectedProjectId, 'schedule', scheduleMode);
                }
                activateProjectTab(tabTarget);
                if (tabTarget === 'schedule' && scheduleMode) {
                    var modeButton = qs('[data-panel="schedule"] [data-project-schedule-mode="' + scheduleMode + '"]');
                    if (modeButton) modeButton.click();
                }
                var menu = button.closest('details');
                if (menu) menu.open = false;
            });
        });
        qsa('[data-project-quick-action]').forEach(function (button) {
            var action = button.dataset.projectQuickAction || '';
            var allowed = projectQuickActionAllowed(action);
            button.classList.toggle('hidden', !allowed);
            button.setAttribute('aria-hidden', allowed ? 'false' : 'true');
            if (button.dataset.quickActionBound === '1') return;
            button.dataset.quickActionBound = '1';
            button.addEventListener('click', function () { runProjectQuickAction(button); });
        });
        qsa('.project-mobile-capture, .project-add-menu').forEach(function (container) {
            var visibleActions = qsa('[data-project-quick-action]', container).filter(function (button) {
                return !button.classList.contains('hidden');
            });
            container.classList.toggle('hidden', visibleActions.length === 0);
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
                        refreshProjectOverview(projectId);
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

    function bindAutobotCrmNavigation() {
        if (window.__pmbiAutobotCrmNavigationBound) return;
        window.__pmbiAutobotCrmNavigationBound = true;
        window.addEventListener('message', function (event) {
            var data = event && event.data;
            if (!data || data.type !== 'pmbi:navigate') return;
            var href = String(data.href || '').trim();
            if (!href) return;
            try {
                var url = new URL(href, location.origin);
                if (url.pathname !== '/app/projects') return;
                location.href = url.pathname + url.search + url.hash;
            } catch (error) {}
        });
    }

    function fillAutobotProjectSelects() {
        qsa('[data-autobot-projects], [data-autobot-estimate-projects]').forEach(function (select) {
            select.innerHTML = state.projects.map(function (project) {
                return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
            }).join('');
        });
    }

    function autobotProjectHref(projectId, tab) {
        var params = new URLSearchParams();
        if (projectId) params.set('openProject', String(projectId));
        if (tab) params.set('tab', tab);
        return '/app/projects' + (params.toString() ? '?' + params.toString() : '');
    }

    function bindAutobotResultActions(root) {
        if (!root || root.dataset.resultActionsBound === '1') return;
        root.dataset.resultActionsBound = '1';
        root.addEventListener('click', function (event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-autobot-result-action]') : null;
            if (!button || !root.contains(button)) return;
            event.preventDefault();
            location.href = button.getAttribute('data-href') || '/app/projects';
        });
    }

    function renderAutobotResult(root, project, text, secondaryHref, secondaryText, primaryHref) {
        if (!root) return;
        root.hidden = false;
        var projectHref = primaryHref || autobotProjectHref(project && project.id);
        var nextHref = secondaryHref || projectHref || '/app/projects';
        root.innerHTML =
            '<div class="autobot-result-head">' +
                '<strong>' + escapeHtml(project.title || 'Объект CRM') + '</strong>' +
                '<span class="badge success">Готово</span>' +
            '</div>' +
            '<p>' + escapeHtml(text) + '</p>' +
            '<div class="autobot-actions">' +
                '<button class="primary" type="button" data-autobot-result-action data-href="' + escapeHtml(projectHref) + '">Открыть в CRM</button>' +
                '<button class="ghost" type="button" data-autobot-result-action data-href="' + escapeHtml(nextHref) + '">' + escapeHtml(secondaryText || 'Перейти дальше') + '</button>' +
            '</div>';
        bindAutobotResultActions(root);
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
                    renderAutobotResult(result, data.project, 'Тендерный пакет загружен в существующий объект.', autobotProjectHref(data.project.id), 'Открыть объект');
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
                renderAutobotResult(result, data.project, 'Новый объект создан и заполнен тендерным пакетом.', autobotProjectHref(data.project.id), 'Открыть объект');
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
                renderAutobotResult(result, project, 'Смета добавлена в материалы объекта.', autobotProjectHref(projectId, 'schedule'), 'Открыть объект', autobotProjectHref(projectId, 'schedule'));
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
            bindAutobotCrmNavigation();
            bindAutobotFrameLoader();
            bindAutobotOfflineCheck();
            return;
        }
        bindAutobotCrmNavigation();
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

    function initPage() {
        if (currentPage() === 'dashboard') initDashboardPage();
        if (currentPage() === 'daily_tasks') initDailyTasksPage();
        if (currentPage() === 'projects') loadProjects(function () {
            loadDashboard(renderProjectsPage);
        });
        if (currentPage() === 'autobot') {
            setAutoBotPageLoading();
            loadProjects(renderAutobotPage);
        }
        if (currentPage() === 'warehouse') loadProjects(renderWarehousePage);
        if (currentPage() === 'suppliers') loadProjects(initSuppliersPage);
        if (currentPage() === 'schedule') loadProjects(renderSchedulePage);
        if (currentPage() === 'logs') loadProjects(renderLogsPage);
        if (currentPage() === 'users') initUsersPage();
        if (currentPage() === 'companies') initCompaniesPage();
    }

    function bindAutobotImmersiveMode() {
        if (currentPage() !== 'autobot' || window.__pmbiAutobotImmersiveBound) return;
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
        state.projectTabModesByProject[projectId][tab] = mode === 'market' || mode === 'table' ? mode : 'list';
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

    function profileAvatarPreviewClass(user) {
        user = user || {};
        return 'topbar-avatar' + (safeAvatarUrl(user.avatarUrl || user.avatar_url) ? ' has-image' : '');
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
                        '<span class="' + profileAvatarPreviewClass(user) + '" data-profile-avatar-preview>' + profileAvatarInner(user) + '</span>' +
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
            '</form>' +
            '<section class="profile-password-section" data-profile-password-section>' +
                '<button class="profile-password-toggle" type="button" data-profile-password-open>' +
                    '<span class="profile-password-toggle-icon"><i data-lucide="key-round" aria-hidden="true"></i></span>' +
                    '<span class="profile-password-toggle-text"><b>Сменить пароль</b><small>Откройте, если вошли с временным паролем или хотите обновить доступ.</small></span>' +
                    '<i class="profile-password-toggle-chevron" data-lucide="arrow-up-right" aria-hidden="true"></i>' +
                '</button>' +
            '</section>';
    }

    function renderProfilePasswordModalContent() {
        return '' +
            '<div class="profile-password-modal-head">' +
                '<span class="profile-password-modal-icon"><i data-lucide="key-round" aria-hidden="true"></i></span>' +
                '<div><h3 id="profile-password-modal-title">Смена пароля</h3><p>Введите текущий пароль и задайте новый.</p></div>' +
            '</div>' +
            '<form class="profile-password-form" data-profile-password-form>' +
                '<label><span>Текущий пароль</span><input name="currentPassword" type="password" autocomplete="current-password"></label>' +
                '<label><span>Новый пароль</span><input name="newPassword" type="password" autocomplete="new-password" minlength="8"></label>' +
                '<label><span>Повторите новый пароль</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8"></label>' +
                '<div class="form-error" data-profile-password-error></div>' +
                '<div class="form-success" data-profile-password-success></div>' +
                '<button class="primary profile-password-button" type="submit">Обновить пароль</button>' +
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

    function closeProfilePasswordModal() {
        var modal = qs('[data-profile-password-modal]');
        if (!modal) return;
        modal.classList.remove('is-open');
        window.setTimeout(function () {
            if (!modal.classList.contains('is-open')) modal.hidden = true;
        }, 180);
    }

    function ensureProfilePasswordModal() {
        var modal = qs('[data-profile-password-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'profile-password-modal-overlay';
        modal.hidden = true;
        modal.setAttribute('data-profile-password-modal', '1');
        modal.innerHTML =
            '<section class="profile-password-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-password-modal-title">' +
                '<button class="calendar-modal-close" type="button" data-profile-password-close aria-label="Закрыть">×</button>' +
                '<div data-profile-password-content></div>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target === modal || (event.target.closest && event.target.closest('[data-profile-password-close]'))) {
                event.preventDefault();
                closeProfilePasswordModal();
            }
        });
        document.body.appendChild(modal);
        if (!document.body.dataset.profilePasswordEscBound) {
            document.body.dataset.profilePasswordEscBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && !qs('[data-profile-password-modal][hidden]')) closeProfilePasswordModal();
            });
        }
        return modal;
    }

    function bindProfilePasswordForm(modal) {
        var passwordForm = qs('[data-profile-password-form]', modal);
        if (!passwordForm || passwordForm.dataset.bound === '1') return;
        passwordForm.dataset.bound = '1';
        passwordForm.addEventListener('submit', function (event) {
            event.preventDefault();
            var errorNode = qs('[data-profile-password-error]', passwordForm);
            var successNode = qs('[data-profile-password-success]', passwordForm);
            if (errorNode) {
                errorNode.textContent = '';
                errorNode.classList.remove('active');
            }
            if (successNode) {
                successNode.textContent = '';
                successNode.classList.remove('active');
            }
            var currentPassword = String(passwordForm.elements.currentPassword.value || '');
            var newPassword = String(passwordForm.elements.newPassword.value || '');
            var confirmPassword = String(passwordForm.elements.confirmPassword.value || '');
            function showPasswordError(message) {
                if (!errorNode) return;
                errorNode.textContent = message;
                errorNode.classList.add('active');
            }
            if (!currentPassword) {
                showPasswordError('Введите текущий пароль.');
                return;
            }
            if (newPassword.length < 8) {
                showPasswordError('Новый пароль должен быть не короче 8 символов.');
                return;
            }
            if (newPassword !== confirmPassword) {
                showPasswordError('Новый пароль и повтор не совпадают.');
                return;
            }
            withSubmitLock(passwordForm, function () {
                return api('/api/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    })
                }).then(function () {
                    passwordForm.reset();
                    if (successNode) {
                        successNode.textContent = 'Пароль успешно изменен.';
                        successNode.classList.add('active');
                    }
                    showAppNotice('Пароль успешно изменен', 'success');
                    window.setTimeout(closeProfilePasswordModal, 900);
                });
            }).catch(function (error) {
                showPasswordError(appErrorMessage(error, 'Не удалось обновить пароль.'));
            });
        });
    }

    function openProfilePasswordModal() {
        var modal = ensureProfilePasswordModal();
        var content = qs('[data-profile-password-content]', modal);
        safeReplaceChildren(content, renderProfilePasswordModalContent());
        bindProfilePasswordForm(modal);
        modal.hidden = false;
        window.requestAnimationFrame(function () {
            modal.classList.add('is-open');
        });
        refreshLucideIcons(modal);
        var input = qs('input', modal);
        if (input) window.setTimeout(function () { input.focus(); }, 120);
    }

    function bindProfileModal(modal) {
        var form = qs('[data-profile-form]', modal);
        var passwordOpen = qs('[data-profile-password-open]', modal);
        var avatarFile = form ? qs('[data-profile-avatar-file]', form) : null;
        var avatarPreview = qs('[data-profile-avatar-preview]', modal);
        var avatarPick = qs('[data-profile-avatar-pick]', modal);
        if (passwordOpen && passwordOpen.dataset.bound !== '1') {
            passwordOpen.dataset.bound = '1';
            passwordOpen.addEventListener('click', function (event) {
                event.preventDefault();
                openProfilePasswordModal();
            });
        }
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
                if (file.size > PROFILE_AVATAR_MAX_BYTES) {
                    avatarFile.value = '';
                    showAppNotice('\u0410\u0432\u0430\u0442\u0430\u0440\u043a\u0430 \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u043c\u0435\u043d\u044c\u0448\u0435 5 \u041c\u0411', 'error');
                    return;
                }
                var previewUrl = URL.createObjectURL(file);
                avatarPreview.classList.add('has-image');
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
                    if (avatarFile.files[0].size > PROFILE_AVATAR_MAX_BYTES) {
                        showAppNotice('\u0410\u0432\u0430\u0442\u0430\u0440\u043a\u0430 \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u043c\u0435\u043d\u044c\u0448\u0435 5 \u041c\u0411', 'error');
                        return Promise.resolve(null);
                    }
                    formData.append('avatar', avatarFile.files[0]);
                }
                return apiFormData('/api/auth/update-profile', formData).then(function (data) {
                    applyProfileUser(data.user);
                    showAppNotice('\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d', 'success');
                    closeProfileModal();
                }).catch(function (error) {
                    return recoverProfileSave(error).then(function () {
                        showAppNotice('\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d', 'success');
                        closeProfileModal();
                    });
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

    function toggleAiAssistantDrawer(forceOpen) {
        var shell = qs('[data-ai-shell]');
        var form = qs('[data-ai-form]');
        var input = form ? qs('textarea[name="message"]', form) : null;
        if (!shell) return;
        var shouldOpen = forceOpen != null ? !!forceOpen : shell.hidden;
        if (shouldOpen) {
            shell.hidden = false;
            document.body.classList.add('ai-open');
            window.requestAnimationFrame(function () {
                shell.setAttribute('data-open', '1');
                if (input) {
                    setTimeout(function () { input.focus(); }, 40);
                }
            });
            return;
        }
        shell.setAttribute('data-open', '0');
        document.body.classList.remove('ai-open');
        setTimeout(function () {
            if (shell.getAttribute('data-open') !== '1') shell.hidden = true;
        }, 260);
    }

    function syncCurrentUserHeader(user) {
        user = user || state.currentUser || state.user || {};
        rememberUserInitial(user);
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
            safeReplaceChildren(node, topbarAvatarInner(user));
        });
        qsa('[data-current-user-avatar]').forEach(function (node) {
            safeReplaceChildren(node, topbarAvatarInner(user));
        });
        forceTopbarAvatar(user);
        refreshLucideIcons(qs('.topbar') || document);
    }

    function applyProfileUser(user) {
        if (!user) return null;
        state.currentUser = user;
        state.user = user;
        if (Array.isArray(state.users)) {
            state.users = state.users.map(function (item) {
                return item && Number(item.id) === Number(user.id) ? Object.assign({}, item, user) : item;
            });
        }
        if (typeof PMBI.applyCurrentUser === 'function') PMBI.applyCurrentUser(user);
        syncCurrentUserHeader(user);
        try {
            window.dispatchEvent(new CustomEvent('pmbi:user-updated', { detail: { user: user } }));
        } catch (error) {}
        return user;
    }

    function recoverProfileSave(error) {
        if (error && error.status && error.status < 500) return Promise.reject(error);
        if (!PMBI.loadCurrentUser) return Promise.reject(error);
        return PMBI.loadCurrentUser({ force: true, silentLoader: true }).then(function (user) {
            if (!user) throw error;
            applyProfileUser(user);
            return { recovered: true, user: user };
        }).catch(function () {
            throw error;
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
            toggleAiAssistantDrawer(true);
        }

        function closeAssistant() {
            toggleAiAssistantDrawer(false);
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
        var topbar = qs('.topbar');
        if (topbar && !topbar.dataset.renderingUser) {
            topbar.dataset.renderingUser = '1';
            renderAppTopbar();
            delete topbar.dataset.renderingUser;
        }
        var userBadge = qs('[data-user-badge]');
        var name = displayUserName(state.user);
        syncCurrentUserHeader(state.user);
        if (userBadge) {
            safeReplaceChildren(userBadge, topbarAvatarInner(state.user));
            refreshLucideIcons(userBadge);
        }
    }

    function bindProjectEditOverlayClose(card) {
        if (!card || card.dataset.overlayBound === '1') return;
        card.dataset.overlayBound = '1';
        card.addEventListener('click', function (event) {
            var target = event.target;
            if (
                target === card ||
                (target && target.closest && target.closest('.project-edit-backdrop')) ||
                (target && target.classList && target.classList.contains('project-edit-dialog'))
            ) {
                event.preventDefault();
                closeProjectEditCard();
            }
        });
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
                        '<label><span>Компания</span><select name="own_legal_entity_id" data-project-own-company><option value="">Компания не указана</option></select></label>' +
                        '<label><span>Заказчик</span><input name="client_name" required></label>' +
                        '<label class="wide"><span>Адрес</span><input name="address" required></label>' +
                        '<label><span>Статус</span><input name="status"></label>' +
                        '<label><span>Договор</span><input name="contract_no"></label>' +
                        '<input name="budget" type="hidden">' +
                        '<label><span>Старт</span><input name="started_at" type="date"></label>' +
                        '<label><span>Дедлайн</span><input name="deadline_at" type="date"></label>' +
                        '<label><span>Город</span><input name="city"></label>' +
                        '<label><span>Регион</span><input name="region"></label>' +
                        '<label class="wide"><span>Описание</span><textarea name="description" rows="4"></textarea></label>' +
                        '<div class="form-error" data-project-edit-error></div>' +
                        '<div class="project-edit-actions">' +
                            '<button class="danger" type="button" data-project-delete>Удалить пустой объект</button>' +
                            '<button class="primary" type="submit">Сохранить</button>' +
                        '</div>' +
                    '</form>' +
                '</section>' +
            '</div>'
        );
        bindProjectEditOverlayClose(qs('[data-project-edit-card]'));
        applyRoleVisibility(qs('[data-project-edit-card]'));
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
        var deleteButton = qs('[data-project-delete]', card);
        if (deleteButton) deleteButton.hidden = !canDeleteProject();
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

    function removeDeletedProjectFromUi(projectId) {
        state.projects = (state.projects || []).filter(function (item) {
            return Number(item.id) !== Number(projectId);
        });
        if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
            state.selectedProject = null;
            var detail = qs('[data-project-detail]');
            if (detail) detail.hidden = true;
            try {
                setProjectFocusMode(false);
            } catch (focusError) {
                console.error('Project delete focus reset failed', focusError);
            }
        }
        try {
            var params = new URLSearchParams(location.search);
            if (Number(params.get('openProject') || 0) === Number(projectId)) {
                params.delete('openProject');
                history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : ''));
            }
        } catch (historyError) {}
        try {
            renderProjectStats();
            renderProjectCritical();
            renderProjectList(state.projects);
        } catch (renderError) {
            console.error('Project delete UI refresh failed', renderError);
        }
    }

    function bindProjectDeleteAction(form) {
        var deleteButton = qs('[data-project-delete]');
        if (!form || !deleteButton || deleteButton.dataset.bound === '1') return;
        deleteButton.dataset.bound = '1';
        deleteButton.addEventListener('click', function (event) {
            event.preventDefault();
            var projectId = Number(form.project_id.value);
            if (!projectId) return;
            if (!canDeleteProject()) {
                showAppNotice('Удалять объект может только Админ.', 'error');
                return;
            }
            var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
            var projectTitle = project && project.title ? project.title : 'этот объект';
            if (!window.confirm('Удалить пустой объект "' + projectTitle + '"? Объект с деньгами, документами, материалами или фактами работ система удалить не даст.')) return;
            var error = qs('[data-project-edit-error]');
            if (error) error.classList.remove('active');
            deleteButton.disabled = true;
            api('/api/projects/' + projectId + '/delete', {
                method: 'POST'
            }).then(function () {
                removeDeletedProjectFromUi(projectId);
                closeProjectEditCard();
                showAppNotice('Объект удален.', 'success');
            }).catch(function (err) {
                var message = appErrorMessage(err, 'Не удалось удалить объект');
                if (error) {
                    error.textContent = message;
                    error.classList.add('active');
                }
                showAppNotice(message, 'error');
            }).finally(function () {
                deleteButton.disabled = false;
            });
        });
    }

    function bindProjectDeleteDelegation() {
        if (document.body.dataset.projectDeleteDelegatedBound === '1') return;
        document.body.dataset.projectDeleteDelegatedBound = '1';
        document.addEventListener('click', function (event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-project-delete]') : null;
            if (!button || button.disabled || button.dataset.bound === '1') return;
            var form = button.closest('[data-project-edit-card]') ? qs('[data-project-edit-form]', button.closest('[data-project-edit-card]')) : qs('[data-project-edit-form]');
            if (!form) return;
            bindProjectDeleteAction(form);
            button.click();
        });
    }

    function bindProjectEditForm() {
        ensureProjectEditCard();
        bindProjectEditOverlayClose(qs('[data-project-edit-card]'));
        bindProjectDeleteDelegation();
        qsa('[data-close-project-edit]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                closeProjectEditCard();
            });
        });

        var form = qs('[data-project-edit-form]');
        bindProjectDeleteAction(form);
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
                    own_legal_entity_id: form.own_legal_entity_id ? form.own_legal_entity_id.value : '',
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
                var code = String(err && err.payload && err.payload.error || '');
                error.textContent = code === 'own_legal_entity_required'
                    ? 'Выберите компанию объекта.'
                    : (code === 'own_legal_entity_not_found' || code === 'bad_company_id'
                        ? 'Компания не найдена. Обновите страницу и выберите её снова.'
                        : appErrorMessage(err, 'Не удалось сохранить объект'));
                error.classList.add('active');
            });
        });

        var deleteButton = qs('[data-project-delete]');
        if (deleteButton && deleteButton.dataset.bound !== '1') {
            deleteButton.dataset.bound = '1';
            deleteButton.addEventListener('click', function () {
                var projectId = Number(form.project_id.value);
                if (!projectId) return;
                if (!canDeleteProject()) {
                    showAppNotice('Удалять объект может только Админ.', 'error');
                    return;
                }
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
                var projectTitle = project && project.title ? project.title : 'этот объект';
                if (!window.confirm('Удалить пустой объект "' + projectTitle + '"? Объект с деньгами, документами, материалами или фактами работ система удалить не даст.')) return;
                var error = qs('[data-project-edit-error]');
                if (error) error.classList.remove('active');
                deleteButton.disabled = true;
                api('/api/projects/' + projectId + '/delete', {
                    method: 'POST'
                }).then(function () {
                    removeDeletedProjectFromUi(projectId);
                    closeProjectEditCard();
                    showAppNotice('Объект удален.', 'success');
                }).catch(function (err) {
                    var message = appErrorMessage(err, 'Не удалось удалить объект');
                    if (error) {
                        error.textContent = message;
                        error.classList.add('active');
                    }
                    showAppNotice(message, 'error');
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

    function sideDrawerFocusableNodes(drawer) {
        if (!drawer) return [];
        return qsa('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer).filter(function (node) {
            return node.getAttribute('aria-hidden') !== 'true' && !node.closest('[hidden]');
        });
    }

    function openSideDrawer(drawer) {
        if (!drawer) return;
        var returnFocus = document.activeElement;
        qsa('.side-drawer[data-open="1"]').forEach(function (node) {
            if (node !== drawer) closeSideDrawer(node, { restoreFocus: false });
        });
        drawer._returnFocus = returnFocus && returnFocus !== document.body ? returnFocus : null;
        drawer.hidden = false;
        requestAnimationFrame(function () {
            drawer.setAttribute('data-open', '1');
            syncDrawerBodyState();
            var panel = qs('.side-drawer-panel', drawer);
            var first = sideDrawerFocusableNodes(panel).find(function (node) {
                return !node.hasAttribute('data-drawer-close');
            });
            if (first) first.focus();
            else if (panel) panel.focus();
        });
    }

    function closeSideDrawer(drawer, options) {
        if (!drawer) return;
        options = options || {};
        var returnFocus = drawer._returnFocus;
        var reportForm = qs('[data-report-draft-form]', drawer);
        if (reportForm) saveReportDraftNow(reportForm);
        drawer.setAttribute('data-open', '0');
        setTimeout(function () {
            if (drawer.getAttribute('data-open') !== '1') {
                drawer.hidden = true;
                if (options.restoreFocus !== false && !qs('.side-drawer[data-open="1"]') && returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
                    returnFocus.focus();
                }
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
            '<section class="side-drawer-panel" role="dialog" aria-modal="true" tabindex="-1"' + (options.dialogLabel ? ' aria-label="' + escapeHtml(options.dialogLabel) + '"' : '') + '></section>';
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

        // Capture the whole surface outside the sheet so dismissal stays
        // reliable even if another drawer binding has already marked the
        // backdrop as handled. Clicks that start inside the dialog pass through.
        wrapper.addEventListener('click', function (event) {
            var target = event.target;
            if (target && target.closest && target.closest('.side-drawer-panel')) return;
            event.preventDefault();
            event.stopPropagation();
            closeSideDrawer(wrapper);
        }, true);

        if (!document.body.dataset.sideDrawerEscapeBound) {
            document.body.dataset.sideDrawerEscapeBound = '1';
            document.addEventListener('keydown', function (event) {
                var activeDrawer = qsa('.side-drawer[data-open="1"]').slice(-1)[0];
                if (!activeDrawer) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeSideDrawer(activeDrawer);
                    return;
                }
                if (event.key !== 'Tab') return;
                var panel = qs('.side-drawer-panel', activeDrawer);
                var focusable = sideDrawerFocusableNodes(panel);
                if (!focusable.length) {
                    event.preventDefault();
                    if (panel) panel.focus();
                    return;
                }
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
                    event.preventDefault();
                    first.focus();
                }
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
            closeLabel: 'Закрыть форму отчёта',
            dialogLabel: 'Добавить дневной отчёт'
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
        if (form.own_legal_entity_id) form.own_legal_entity_id.value = project.own_legal_entity_id == null ? '' : String(project.own_legal_entity_id);
        form.budget.value = project.budget == null ? '' : Number(project.budget);
        form.started_at.value = project.started_at || '';
        form.deadline_at.value = project.deadline_at || '';
        if (form.city) form.city.value = project.city || '';
        if (form.region) form.region.value = project.region || '';
        if (form.description) form.description.value = project.description || '';
        var deleteButton = qs('[data-project-delete]', card);
        if (deleteButton) deleteButton.hidden = !canDeleteProject();
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
            dialogLabel: 'Создать объект',
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
                    var code = String(err && err.payload && err.payload.error || '');
                    var message = code === 'own_legal_entity_required'
                        ? 'Выберите компанию объекта.'
                        : (code === 'own_legal_entity_not_found' || code === 'bad_company_id'
                            ? 'Компания не найдена. Обновите страницу и выберите её снова.'
                            : appErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442'));
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

    // role create modal
    function ensureRoleCreateModal() {
        var modal = qs('[data-role-create-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'role-create-modal hidden';
        modal.setAttribute('data-role-create-modal', '');
        modal.innerHTML =
            '<button class="role-create-backdrop" type="button" data-role-create-close aria-label="Закрыть"></button>' +
            '<section class="role-create-dialog" role="dialog" aria-modal="true" aria-label="Создать роль">' +
                '<form class="role-create-form" data-role-create-form>' +
                    '<button class="ghost compact user-create-close" type="button" data-role-create-close>Закрыть</button>' +
                    '<h3>Создать роль</h3>' +
                    '<label><span>Название роли</span><input name="name" placeholder="Программист" required></label>' +
                    '<div class="role-permission-list">' +
                        '<label><input type="checkbox" name="projects_view"> <span>Доступ к Объектам: просмотр</span></label>' +
                        '<label><input type="checkbox" name="projects_edit"> <span>Доступ к Объектам: редактирование</span></label>' +
                        '<label><input type="checkbox" name="schedule"> <span>Доступ к Календарю</span></label>' +
                        '<label><input type="checkbox" name="suppliers"> <span>Доступ к Контрагентам</span></label>' +
                        '<label><input type="checkbox" name="daily_own" checked> <span>Задачи сотрудников: только свои</span></label>' +
                        '<label><input type="checkbox" name="daily_all"> <span>Задачи сотрудников: всех сотрудников как Директор</span></label>' +
                        '<label><input type="checkbox" name="full_access"> <span>Полный доступ ко всему сайту</span></label>' +
                    '</div>' +
                    '<div class="form-error" data-role-create-error></div>' +
                    '<button class="primary" type="submit">Создать роль</button>' +
                '</form>' +
            '</section>';
        document.body.appendChild(modal);
        qsa('[data-role-create-close]', modal).forEach(function (button) {
            button.addEventListener('click', closeRoleCreateModal);
        });
        qs('[data-role-create-form]', modal).addEventListener('submit', submitRoleCreateForm);
        return modal;
    }

    function openRoleCreateModal() {
        var modal = ensureRoleCreateModal();
        var form = qs('[data-role-create-form]', modal);
        if (form) form.reset();
        modal.classList.remove('hidden');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            var input = qs('input[name="name"]', modal);
            if (input) input.focus();
        });
    }

    function closeRoleCreateModal() {
        var modal = qs('[data-role-create-modal]');
        if (!modal) return;
        modal.removeAttribute('data-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) modal.classList.add('hidden');
        }, 180);
    }

    function rolePermissionsFromForm(form) {
        var full = !!form.full_access.checked;
        var modules = ['dashboard', 'daily_tasks'];
        var permissions = {
            modules: modules,
            dailyTasks: form.daily_all.checked ? 'all' : 'own'
        };
        if (form.projects_view.checked || form.projects_edit.checked) {
            modules.push('projects');
            permissions.projects = form.projects_edit.checked ? 'edit' : 'view';
        }
        if (form.schedule.checked) modules.push('schedule');
        if (form.suppliers.checked) {
            modules.push('suppliers');
            permissions.suppliers = 'edit';
        }
        if (form.daily_all.checked) {
            permissions.manageUsers = true;
            permissions.manageRoles = true;
            if (modules.indexOf('users') === -1) modules.push('users');
        }
        if (full) {
            permissions.fullAccess = true;
            permissions.modules = ['dashboard', 'daily_tasks', 'projects', 'autobot', 'companies', 'schedule', 'logs', 'warehouse', 'suppliers', 'users'];
            permissions.projects = 'edit';
            permissions.dailyTasks = 'all';
            permissions.manageUsers = true;
            permissions.manageRoles = true;
        }
        if (!full) {
            permissions.modules = modules.filter(function (module, index) {
                return modules.indexOf(module) === index;
            });
        }
        return permissions;
    }

    function submitRoleCreateForm(event) {
        event.preventDefault();
        if (!canManageTeam()) {
            showAppNotice('Доступ разрешен только Главному Админу', 'error');
            return;
        }
        var form = event.currentTarget;
        var error = qs('[data-role-create-error]', form);
        if (error) error.classList.remove('active');
        withSubmitLock(form, function () {
            return api('/api/roles', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name.value.trim(),
                    permissions: rolePermissionsFromForm(form)
                })
            }).then(function (data) {
                var role = data && data.role;
                if (role) {
                    state.roles.push(role);
                    syncUserRoleOptions(role.code);
                }
                closeRoleCreateModal();
                showAppNotice('Роль создана.', 'success');
            }).catch(function (err) {
                var message = appErrorMessage(err, 'Не удалось создать роль');
                if (error) {
                    error.textContent = message;
                    error.classList.add('active');
                }
                throw err;
            });
        });
    }

    // logs archive and form binding
    function renderLogsList(project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        logs = Array.isArray(logs) ? logs : [];
        if (!logs.length) {
            root.innerHTML = '<div class="report-archive-empty"><b>Отчетов пока нет</b><span>По объекту "' + escapeHtml(project && project.title ? project.title : 'Объект') + '" еще нет сохраненных суточных отчетов.</span></div>';
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
                        '<span class="badge">' + escapeHtml(log.workers_count || 0) + ' \u0447\u0435\u043b.</span>' +
                        '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + visibility + '</span>' +
                        renderProjectReportEditButton(project && project.id, log, true) +
                        renderProjectReportDeleteButton(project && project.id, log, true) +
                    '</div>' +
                '</div>' +
                projectReportDocumentHtml(log) +
                '<div class="log-details">' +
                    (log.equipment ? '<div><span>\u0422\u0435\u0445\u043d\u0438\u043a\u0430</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                '</div>' +
                (log.raw_input ? '<small class="muted">\u0418\u0441\u0445\u043e\u0434\u043d\u044b\u0439 \u0432\u0432\u043e\u0434: ' + escapeHtml(log.raw_input) + '</small>' : '') +
            '</article>';
        }).join('') + '</div>';
        bindProjectReportDeleteActions();
    }

    function reportFormControl(form, name) {
        if (!form || !form.elements || typeof form.elements.namedItem !== 'function') return null;
        return form.elements.namedItem(name);
    }

    function showLogFormError(form, error, message, control) {
        if (error) {
            error.textContent = message;
            error.classList.add('active');
        }
        showAppNotice(message, 'error');
        if (control && typeof control.focus === 'function') control.focus();
    }

    function reportClientRequestId(form) {
        if (form.dataset.clientRequestId) return form.dataset.clientRequestId;
        var value = '';
        if (window.crypto && typeof window.crypto.randomUUID === 'function') value = window.crypto.randomUUID();
        if (!value) value = 'daily-report-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        form.dataset.clientRequestId = value;
        return value;
    }

    function reportConfirmedActions(form, requestId) {
        return qsa('[data-report-effect]:checked', form).map(function (input) {
            var card = input.closest ? input.closest('.report-effect-card') : null;
            var qtyInput = card ? qs('[data-report-effect-qty]', card) : null;
            var actionType = input.getAttribute('data-effect-kind') || '';
            var qty = Number(qtyInput ? qtyInput.value : input.getAttribute('data-effect-qty') || 0);
            var action = {
                action_type: actionType,
                estimate_item_id: Number(input.getAttribute('data-item-id') || 0),
                qty: qty,
                client_action_id: String(requestId || '') + ':' + (input.getAttribute('data-client-action-id') || '')
            };
            if (actionType === 'work_progress') {
                var originalQty = Number(input.getAttribute('data-original-effect-qty') || 0);
                var quantityMode = String(input.getAttribute('data-quantity-mode') || 'delta_qty');
                var inputValue = Number(input.getAttribute('data-input-value'));
                var edited = Math.abs(qty - originalQty) > 1e-9;
                action.quantity_mode = edited ? 'delta_qty' : quantityMode;
                action.input_value = edited || !isFinite(inputValue) ? qty : inputValue;
            }
            return action;
        }).filter(function (action) {
            var materialAction = /^material_(purchase|receipt|use)$/.test(action.action_type) && canApplyDailyReportMaterialActions();
            var workAction = action.action_type === 'work_progress' && canApplyDailyReportWorkActions();
            return (materialAction || workAction) && action.estimate_item_id > 0 && action.qty > 0;
        });
    }

    function reportActionErrorMessage(error, fallback) {
        var code = error && error.payload && error.payload.error ? String(error.payload.error) : '';
        var labels = {
            bad_confirmed_actions: 'Не удалось прочитать выбранные действия. Обновите предпросмотр и повторите.',
            too_many_confirmed_actions: 'В одном отчёте выбрано слишком много действий.',
            bad_confirmed_action: 'Одно из распознанных действий заполнено неверно.',
            bad_confirmed_action_type: 'Тип одного из действий не поддерживается.',
            bad_confirmed_action_values: 'Проверьте позицию и количество в распознанных действиях.',
            bad_estimate_item_id: 'Работа или материал не выбраны.',
            bad_qty: 'Количество должно быть больше нуля.',
            bad_work_quantity_mode: 'Не удалось определить, как применить объём работы.',
            bad_work_input_value: 'Проверьте объём или процент выполненной работы.',
            bad_work_percent: 'Процент выполненной работы должен быть больше нуля и не превышать 100%.',
            bad_report_date: 'Проверьте дату отчёта.',
            daily_log_actions_forbidden: 'У вас нет права менять учёт материалов. Обновите страницу или обратитесь к администратору.',
            daily_log_work_actions_forbidden: 'У вас нет права менять фактический объём работ. Обновите страницу или обратитесь к администратору.',
            daily_log_action_no_quantity_limit: 'Для материала не задан плановый объём, поэтому действие нельзя применить из отчёта.',
            daily_log_work_action_no_quantity_limit: 'Для работы не задан плановый объём, поэтому факт нельзя применить из отчёта.',
            daily_log_action_qty_exceeds_limit: 'Количество больше допустимого остатка. Проверьте заказ, поставку или наличие на объекте.',
            daily_log_work_action_qty_exceeds_limit: 'Объём работы больше оставшегося плана. Проверьте значение из отчёта.',
            daily_log_work_action_no_positive_delta: 'Указанный итог уже достигнут. Проверьте текущий факт работы.',
            estimate_item_project_mismatch: 'Материал не найден в смете этого объекта. Обновите страницу.',
            estimate_item_not_material: 'Выбранная позиция относится к работам, а не к материалам.',
            estimate_item_not_work: 'Выбранная позиция не относится к работам.',
            client_action_already_applied: 'Это действие уже применено в другом отчёте. Обновите страницу.',
            daily_log_action_conflict: 'Отчёт уже сохранён или данные успели измениться. Обновите журнал.',
            daily_log_has_applied_actions: 'Этот отчёт изменил учёт работ или материалов, поэтому удалить его напрямую нельзя.',
            bad_workforce_entries: 'Не удалось прочитать состав смены.',
            bad_workforce_entry: 'Проверьте строки людей на смене.',
            bad_workforce_label: 'Укажите специальность или название бригады.',
            bad_workforce_count: 'Количество людей должно быть целым числом больше нуля.',
            bad_workforce_hours: 'Часы смены должны быть больше нуля и не больше 24.',
            bad_workforce_names: 'Проверьте список ФИО работников.',
            bad_workforce_name: 'ФИО работника слишком длинное.',
            too_many_workforce_names: 'В одном отчёте указано слишком много работников.',
            bad_equipment_entries: 'Не удалось прочитать список техники.',
            bad_equipment_entry: 'Проверьте строки техники.',
            bad_equipment_label: 'Укажите вид техники.',
            bad_equipment_count: 'Количество техники должно быть целым числом больше нуля.',
            bad_equipment_hours: 'Часы техники должны быть больше нуля и не больше 24.',
            daily_log_photo_limit: 'К одному отчёту можно прикрепить не больше 8 фотографий.',
            daily_log_photo_too_large: 'Фотография слишком большая.',
            bad_daily_log_photo_format: 'Файл не удалось распознать как фотографию.',
            daily_log_photo_in_use: 'Фото из этого отчёта уже связано с финансовым или исполнительным документом. Сначала уберите эту связь.'
        };
        return labels[code] || appErrorMessage(error, fallback);
    }

    function reportResourceConfig(kind) {
        return kind === 'equipment'
            ? { label: 'Техника', placeholder: 'Например, экскаватор', unit: 'машино-ч' }
            : { label: 'Люди', placeholder: 'Например, электрики', unit: 'чел.-ч' };
    }

    function reportResourceRowHtml(kind) {
        var config = reportResourceConfig(kind);
        var datalist = kind === 'equipment' ? 'report-equipment-types' : 'report-workforce-types';
        return '<div class="report-resource-row' + (kind === 'workforce' ? ' is-workforce-row' : '') + '" data-report-resource-row="' + kind + '">' +
            '<label class="report-resource-name"><span>' + (kind === 'equipment' ? 'Вид техники' : 'Специалист / бригада') + '</span><input type="text" list="' + datalist + '" placeholder="' + config.placeholder + '" data-report-resource-label></label>' +
            '<label><span>Количество</span><input type="number" min="1" max="999" step="1" value="1" inputmode="numeric" data-report-resource-count></label>' +
            '<label><span>' + (kind === 'equipment' ? 'Часов работы' : 'Часов на человека') + '</span><input type="number" min="0.25" max="24" step="0.25" value="8" inputmode="decimal" data-report-resource-hours></label>' +
            (kind === 'workforce' ? '<label class="report-resource-workers"><span>ФИО работников · по одному в строке</span><textarea rows="2" placeholder="Иванов Иван Иванович&#10;Петров Пётр Сергеевич" data-report-resource-names></textarea><small>Количество людей подставится по списку автоматически</small></label>' : '') +
            '<button class="report-resource-remove" type="button" data-report-resource-remove aria-label="Удалить строку ' + config.label.toLowerCase() + '"><i data-lucide="x" aria-hidden="true"></i></button>' +
        '</div>';
    }

    function reportWorkerNames(value) {
        var seen = {};
        return String(value || '').split(/[\r\n;]+/).map(function (name) {
            return name.replace(/\s+/g, ' ').trim();
        }).filter(function (name) {
            var key = name.toLowerCase();
            if (!name || seen[key]) return false;
            seen[key] = true;
            return true;
        }).slice(0, 250);
    }

    function reportResourceRows(form, kind) {
        return qsa('[data-report-resource-row="' + kind + '"]', form);
    }

    function syncReportResourceSummary(form, kind) {
        var count = 0;
        var hours = 0;
        reportResourceRows(form, kind).forEach(function (row) {
            var countInput = qs('[data-report-resource-count]', row);
            var hoursInput = qs('[data-report-resource-hours]', row);
            var namesInput = kind === 'workforce' ? qs('[data-report-resource-names]', row) : null;
            var names = reportWorkerNames(namesInput && namesInput.value || '');
            if (names.length && countInput && Number(countInput.value || 0) !== names.length) {
                countInput.value = String(names.length);
            }
            var rowCount = Math.max(0, Number(countInput && countInput.value || 0));
            var rowHours = Math.max(0, Number(hoursInput && hoursInput.value || 0));
            count += rowCount;
            hours += rowCount * rowHours;
        });
        var countNode = qs('[data-report-resource-total="' + kind + '"]', form);
        var hoursNode = qs('[data-report-resource-hours-total="' + kind + '"]', form);
        if (countNode) countNode.textContent = String(count);
        if (hoursNode) hoursNode.textContent = finalSectionSummaryNumber(hours) + ' ' + reportResourceConfig(kind).unit;
        if (kind === 'workforce') {
            var workersControl = reportFormControl(form, 'workers_count');
            if (workersControl) workersControl.value = String(count);
        }
        form.dispatchEvent(new CustomEvent('pmbi:report-preview-meta-changed', { bubbles: true }));
    }

    function addReportResourceRow(form, kind) {
        var list = qs('[data-report-resource-list="' + kind + '"]', form);
        if (!list || reportResourceRows(form, kind).length >= 40) return;
        list.insertAdjacentHTML('beforeend', reportResourceRowHtml(kind));
        refreshLucideIcons(list);
        syncReportResourceSummary(form, kind);
        var rows = reportResourceRows(form, kind);
        var input = rows.length ? qs('[data-report-resource-label]', rows[rows.length - 1]) : null;
        if (input) input.focus();
    }

    function collectReportResources(form, kind) {
        var entries = [];
        var invalid = null;
        reportResourceRows(form, kind).forEach(function (row, index) {
            if (invalid) return;
            var labelInput = qs('[data-report-resource-label]', row);
            var countInput = qs('[data-report-resource-count]', row);
            var hoursInput = qs('[data-report-resource-hours]', row);
            var namesInput = kind === 'workforce' ? qs('[data-report-resource-names]', row) : null;
            var label = String(labelInput && labelInput.value || '').trim();
            var names = reportWorkerNames(namesInput && namesInput.value || '');
            var count = names.length || Number(countInput && countInput.value || 0);
            var hours = Number(hoursInput && hoursInput.value || 0);
            if (!label || !Number.isInteger(count) || count < 1 || count > 999 || !(hours > 0) || hours > 24) {
                invalid = {
                    control: !label ? labelInput : (!Number.isInteger(count) || count < 1 || count > 999 ? countInput : hoursInput),
                    message: 'Заполните строку «' + reportResourceConfig(kind).label + '»: название, количество и часы смены.'
                };
                return;
            }
            var entry = { count: count, hours: hours };
            entry[kind === 'equipment' ? 'name' : 'role'] = label;
            if (kind === 'workforce' && names.length) entry.names = names;
            entries.push(entry);
        });
        return { entries: entries, invalid: invalid };
    }

    function bindReportResources(form) {
        if (!form || form.dataset.reportResourcesBound === '1') return;
        if (!qs('[data-report-resource-list]', form)) return;
        form.dataset.reportResourcesBound = '1';
        qsa('[data-report-resource-add]', form).forEach(function (button) {
            button.addEventListener('click', function () {
                addReportResourceRow(form, button.getAttribute('data-report-resource-add') || 'workforce');
                form.dispatchEvent(new CustomEvent('pmbi:report-draft-changed', { bubbles: true }));
            });
        });
        qsa('[data-report-resource-list]', form).forEach(function (list) {
            list.addEventListener('input', function (event) {
                var row = event.target && event.target.closest ? event.target.closest('[data-report-resource-row]') : null;
                if (row) syncReportResourceSummary(form, row.getAttribute('data-report-resource-row') || 'workforce');
            });
            list.addEventListener('click', function (event) {
                var remove = event.target && event.target.closest ? event.target.closest('[data-report-resource-remove]') : null;
                if (!remove) return;
                var row = remove.closest('[data-report-resource-row]');
                var kind = row ? row.getAttribute('data-report-resource-row') : 'workforce';
                if (row) row.remove();
                syncReportResourceSummary(form, kind || 'workforce');
                form.dispatchEvent(new CustomEvent('pmbi:report-draft-changed', { bubbles: true }));
            });
        });
        var repeatShiftButton = qs('[data-report-repeat-last-shift]', form);
        if (repeatShiftButton) repeatShiftButton.addEventListener('click', function () {
            var projectControl = reportFormControl(form, 'project_id');
            var projectId = Number(projectControl && projectControl.value || 0);
            var logs = state.projectLogsByProject && state.projectLogsByProject[projectId] || [];
            var previous = logs.find(function (log) {
                return Array.isArray(log && log.workforce) && log.workforce.length;
            });
            if (!previous) {
                showAppNotice('В прошлых отчётах состав смены пока не найден.', 'info');
                return;
            }
            if (reportResourceRows(form, 'workforce').length && !window.confirm('Заменить текущий состав смены данными из прошлого отчёта?')) return;
            restoreReportDraftResources(form, 'workforce', previous.workforce.map(function (entry) {
                return {
                    label: entry.role,
                    count: entry.count,
                    hours: entry.hours,
                    names: Array.isArray(entry.names) ? entry.names : []
                };
            }));
            refreshLucideIcons(form);
            form.dispatchEvent(new CustomEvent('pmbi:report-draft-changed', { bubbles: true }));
            showAppNotice('Состав прошлой смены добавлен.', 'success');
        });
        syncReportResourceSummary(form, 'workforce');
        syncReportResourceSummary(form, 'equipment');
    }

    var REPORT_DRAFT_VERSION = 2;
    var REPORT_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
    var REPORT_DRAFT_STORAGE_PREFIX = 'pmbi.daily-report-draft.v2';
    var REPORT_DRAFT_PHOTO_DB = 'pmbi-report-draft-photos';
    var REPORT_DRAFT_PHOTO_STORE = 'photos';
    var reportDraftPhotoDbPromise = null;

    function reportDraftOwnerId() {
        var user = state.currentUser || state.user || {};
        return Number(user.id || 0) > 0 ? String(user.id) : '';
    }

    function reportDraftStorageKey(form) {
        var projectControl = reportFormControl(form, 'project_id');
        var projectId = Number(projectControl && projectControl.value || 0);
        var ownerId = reportDraftOwnerId();
        if (!projectId || !ownerId) return '';
        return REPORT_DRAFT_STORAGE_PREFIX + ':u:' + ownerId + ':p:' + projectId;
    }

    function reportDraftStatus(form, tone, message, canClear) {
        var root = qs('[data-report-draft-status]', form);
        if (!root) return;
        root.classList.remove('is-saving', 'is-saved', 'is-restored', 'is-warning');
        if (tone) root.classList.add('is-' + tone);
        var textNode = qs('[data-report-draft-status-text]', root);
        if (textNode) textNode.textContent = message;
        var clearButton = qs('[data-report-draft-clear]', root);
        if (clearButton) clearButton.hidden = !canClear;
    }

    function reportDraftTimeLabel(timestamp) {
        try {
            return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
        } catch (error) {
            var date = new Date(timestamp);
            return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
        }
    }

    function reportDraftResourceSnapshot(form, kind) {
        return reportResourceRows(form, kind).map(function (row) {
            var label = qs('[data-report-resource-label]', row);
            var count = qs('[data-report-resource-count]', row);
            var hours = qs('[data-report-resource-hours]', row);
            var names = qs('[data-report-resource-names]', row);
            return {
                label: String(label && label.value || ''),
                count: String(count && count.value || ''),
                hours: String(hours && hours.value || ''),
                names: reportWorkerNames(names && names.value || '')
            };
        }).slice(0, 40);
    }

    function reportDraftPhotoManifest(form) {
        return reportPhotoDrafts(form).map(function (draft) {
            return {
                id: String(draft.id || ''),
                name: String(draft.name || 'Фото'),
                type: String(draft.blob && draft.blob.type || draft.type || ''),
                size: Number(draft.blob && draft.blob.size || draft.size || 0),
                status: String(draft.status || 'ready'),
                serverPhoto: draft.serverPhoto || null,
                persisted: draft.persisted !== false
            };
        }).filter(function (item) { return !!item.id; }).slice(0, 8);
    }

    function reportDraftPreviewSnapshot(form) {
        var controller = form && form._reportPreviewDraftController;
        if (!controller || typeof controller.serialize !== 'function') return { manualSelections: [], effectOverrides: [] };
        try {
            return controller.serialize();
        } catch (error) {
            return { manualSelections: [], effectOverrides: [] };
        }
    }

    function serializeReportDraft(form) {
        var projectControl = reportFormControl(form, 'project_id');
        var dateControl = reportFormControl(form, 'report_date');
        var visibilityControl = reportFormControl(form, 'is_client_visible');
        var rawControl = reportFormControl(form, 'raw_input');
        var workDoneControl = reportFormControl(form, 'work_done');
        var blockersControl = reportFormControl(form, 'blockers');
        var nextStepsControl = reportFormControl(form, 'next_steps');
        var extra = qs('.report-extra-fields', form);
        return {
            version: REPORT_DRAFT_VERSION,
            ownerId: reportDraftOwnerId(),
            projectId: Number(projectControl && projectControl.value || 0),
            updatedAt: Date.now(),
            phase: String(form._reportDraftPhase || (Number(form.dataset.savedDailyLogId || 0) ? 'photo_retry' : 'editing')),
            clientRequestId: String(form.dataset.clientRequestId || ''),
            savedDailyLogId: Number(form.dataset.savedDailyLogId || 0),
            reportDate: String(dateControl && dateControl.value || ''),
            reportDateTouched: form.dataset.reportDateTouched === '1',
            isClientVisible: String(visibilityControl && visibilityControl.value || '1'),
            rawInput: String(rawControl && rawControl.value || ''),
            workDone: String(workDoneControl && workDoneControl.value || ''),
            workDoneManual: !!(workDoneControl && workDoneControl.dataset.reportManual === '1'),
            blockers: String(blockersControl && blockersControl.value || ''),
            nextSteps: String(nextStepsControl && nextStepsControl.value || ''),
            extraOpen: !!(extra && extra.open),
            workforce: reportDraftResourceSnapshot(form, 'workforce'),
            equipment: reportDraftResourceSnapshot(form, 'equipment'),
            assistant: reportDraftPreviewSnapshot(form),
            photos: reportDraftPhotoManifest(form),
            submitPayload: form._reportDraftSubmitPayload || null
        };
    }

    function reportDraftIsMeaningful(snapshot) {
        if (!snapshot) return false;
        var assistant = snapshot.assistant || {};
        return snapshot.phase !== 'editing'
            || !!String(snapshot.rawInput || '').trim()
            || !!String(snapshot.workDone || '').trim()
            || !!String(snapshot.blockers || '').trim()
            || !!String(snapshot.nextSteps || '').trim()
            || snapshot.reportDateTouched
            || String(snapshot.isClientVisible || '1') !== '1'
            || (snapshot.workforce || []).length > 0
            || (snapshot.equipment || []).length > 0
            || (snapshot.photos || []).length > 0
            || (assistant.manualSelections || []).length > 0
            || (assistant.effectOverrides || []).length > 0;
    }

    function readReportDraft(form) {
        var key = reportDraftStorageKey(form);
        if (!key) return null;
        try {
            var snapshot = JSON.parse(window.localStorage.getItem(key) || 'null');
            if (!snapshot || Number(snapshot.version) !== REPORT_DRAFT_VERSION) return null;
            if (String(snapshot.ownerId || '') !== reportDraftOwnerId()) return null;
            if (Number(snapshot.projectId || 0) !== Number(reportFormControl(form, 'project_id').value || 0)) return null;
            if (!Number(snapshot.updatedAt) || Date.now() - Number(snapshot.updatedAt) > REPORT_DRAFT_TTL_MS) {
                window.localStorage.removeItem(key);
                clearReportDraftPhotoStorage(key);
                return null;
            }
            return snapshot;
        } catch (error) {
            return null;
        }
    }

    function saveReportDraftNow(form) {
        if (!form || form._reportDraftDisposed || form._reportDraftRestoring || form._reportDraftSuppress) return false;
        if (form._reportDraftTimer) {
            clearTimeout(form._reportDraftTimer);
            form._reportDraftTimer = null;
        }
        var key = reportDraftStorageKey(form);
        if (!key) return false;
        var snapshot = serializeReportDraft(form);
        try {
            if (!reportDraftIsMeaningful(snapshot)) {
                window.localStorage.removeItem(key);
                reportDraftStatus(form, '', 'Черновик будет сохраняться автоматически', false);
                return true;
            }
            window.localStorage.setItem(key, JSON.stringify(snapshot));
            if (snapshot.phase === 'photo_retry') {
                reportDraftStatus(form, 'warning', 'Отчёт сохранён · осталось загрузить фото', true);
            } else if (snapshot.phase === 'submitting') {
                reportDraftStatus(form, 'saving', 'Отправляем отчёт…', false);
            } else if (form._reportDraftPhotoStorageFailed) {
                reportDraftStatus(form, 'warning', 'Текст сохранён · часть фото нужно выбрать повторно', true);
            } else {
                reportDraftStatus(form, 'saved', 'Черновик сохранён на этом устройстве · ' + reportDraftTimeLabel(snapshot.updatedAt), true);
            }
            return true;
        } catch (error) {
            reportDraftStatus(form, 'warning', 'Не удалось сохранить черновик на этом устройстве', true);
            return false;
        }
    }

    function scheduleReportDraftSave(form, immediate) {
        if (!form || form._reportDraftDisposed || form._reportDraftRestoring || form._reportDraftSuppress) return;
        if (form._reportDraftTimer) clearTimeout(form._reportDraftTimer);
        if (immediate) {
            saveReportDraftNow(form);
            return;
        }
        reportDraftStatus(form, 'saving', 'Сохраняем черновик…', true);
        form._reportDraftTimer = setTimeout(function () {
            form._reportDraftTimer = null;
            saveReportDraftNow(form);
        }, 350);
    }

    function openReportDraftPhotoDb() {
        if (reportDraftPhotoDbPromise) return reportDraftPhotoDbPromise;
        reportDraftPhotoDbPromise = new Promise(function (resolve, reject) {
            if (!window.indexedDB) {
                reject(new Error('indexeddb_unavailable'));
                return;
            }
            var request = window.indexedDB.open(REPORT_DRAFT_PHOTO_DB, 1);
            request.onupgradeneeded = function () {
                var database = request.result;
                if (!database.objectStoreNames.contains(REPORT_DRAFT_PHOTO_STORE)) {
                    database.createObjectStore(REPORT_DRAFT_PHOTO_STORE, { keyPath: 'key' });
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error || new Error('indexeddb_open_failed')); };
            request.onblocked = function () { reject(new Error('indexeddb_blocked')); };
        }).catch(function (error) {
            reportDraftPhotoDbPromise = null;
            throw error;
        });
        return reportDraftPhotoDbPromise;
    }

    function reportDraftPhotoRecordKey(draftKey, photoId) {
        return draftKey + ':photo:' + String(photoId || '');
    }

    function writeReportDraftPhotoRecord(draftKey, draft, blob) {
        return openReportDraftPhotoDb().then(function (database) {
            return new Promise(function (resolve, reject) {
                if (draft.removed) {
                    resolve(false);
                    return;
                }
                var transaction = database.transaction(REPORT_DRAFT_PHOTO_STORE, 'readwrite');
                transaction.objectStore(REPORT_DRAFT_PHOTO_STORE).put({
                    key: reportDraftPhotoRecordKey(draftKey, draft.id),
                    draftKey: draftKey,
                    photoId: String(draft.id),
                    name: String(draft.name || 'Фото'),
                    type: String(blob && blob.type || ''),
                    size: Number(blob && blob.size || 0),
                    blob: blob,
                    updatedAt: Date.now()
                });
                transaction.oncomplete = function () { resolve(true); };
                transaction.onerror = function () { reject(transaction.error || new Error('indexeddb_write_failed')); };
                transaction.onabort = function () { reject(transaction.error || new Error('indexeddb_write_aborted')); };
            });
        });
    }

    function persistReportDraftPhoto(form, draft, blob) {
        var draftKey = reportDraftStorageKey(form);
        if (!draftKey || !draft || !blob) return Promise.resolve(false);
        draft.persisted = false;
        draft._storagePromise = Promise.resolve(draft._storagePromise).catch(function () {}).then(function () {
            return writeReportDraftPhotoRecord(draftKey, draft, blob);
        }).then(function (saved) {
            if (saved && !draft.removed) draft.persisted = true;
            if (!form._reportDraftDisposed) scheduleReportDraftSave(form, true);
            return saved;
        }).catch(function () {
            draft.persisted = false;
            form._reportDraftPhotoStorageFailed = true;
            if (!form._reportDraftDisposed) scheduleReportDraftSave(form, true);
            return false;
        });
        return draft._storagePromise;
    }

    function deleteReportDraftPhoto(form, draft) {
        var draftKey = reportDraftStorageKey(form);
        if (!draftKey || !draft || !draft.id) return Promise.resolve();
        return Promise.resolve(draft._storagePromise).catch(function () {}).then(function () {
            return openReportDraftPhotoDb().then(function (database) {
                return new Promise(function (resolve) {
                    var transaction = database.transaction(REPORT_DRAFT_PHOTO_STORE, 'readwrite');
                    transaction.objectStore(REPORT_DRAFT_PHOTO_STORE).delete(reportDraftPhotoRecordKey(draftKey, draft.id));
                    transaction.oncomplete = function () { resolve(); };
                    transaction.onerror = function () { resolve(); };
                    transaction.onabort = function () { resolve(); };
                });
            }).catch(function () {});
        });
    }

    function readReportDraftPhoto(draftKey, photoId) {
        return openReportDraftPhotoDb().then(function (database) {
            return new Promise(function (resolve) {
                var request = database.transaction(REPORT_DRAFT_PHOTO_STORE, 'readonly')
                    .objectStore(REPORT_DRAFT_PHOTO_STORE)
                    .get(reportDraftPhotoRecordKey(draftKey, photoId));
                request.onsuccess = function () { resolve(request.result || null); };
                request.onerror = function () { resolve(null); };
            });
        }).catch(function () { return null; });
    }

    function readReportDraftPhotoWithRetry(draftKey, photoId, attemptsLeft) {
        return readReportDraftPhoto(draftKey, photoId).then(function (record) {
            if (record || !(attemptsLeft > 0)) return record;
            return new Promise(function (resolve) {
                setTimeout(resolve, 150);
            }).then(function () {
                return readReportDraftPhotoWithRetry(draftKey, photoId, attemptsLeft - 1);
            });
        });
    }

    function clearReportDraftPhotoStorage(draftKey) {
        if (!draftKey) return Promise.resolve();
        return openReportDraftPhotoDb().then(function (database) {
            return new Promise(function (resolve) {
                var transaction = database.transaction(REPORT_DRAFT_PHOTO_STORE, 'readwrite');
                var request = transaction.objectStore(REPORT_DRAFT_PHOTO_STORE).openCursor();
                request.onsuccess = function () {
                    var cursor = request.result;
                    if (!cursor) return;
                    if (cursor.value && cursor.value.draftKey === draftKey) cursor.delete();
                    cursor.continue();
                };
                transaction.oncomplete = function () { resolve(); };
                transaction.onerror = function () { resolve(); };
                transaction.onabort = function () { resolve(); };
            });
        }).catch(function () {});
    }

    function cleanupExpiredReportDraftPhotoStorage() {
        var cutoff = Date.now() - REPORT_DRAFT_TTL_MS;
        return openReportDraftPhotoDb().then(function (database) {
            return new Promise(function (resolve) {
                var transaction = database.transaction(REPORT_DRAFT_PHOTO_STORE, 'readwrite');
                var request = transaction.objectStore(REPORT_DRAFT_PHOTO_STORE).openCursor();
                request.onsuccess = function () {
                    var cursor = request.result;
                    if (!cursor) return;
                    if (!Number(cursor.value && cursor.value.updatedAt) || Number(cursor.value.updatedAt) < cutoff) cursor.delete();
                    cursor.continue();
                };
                transaction.oncomplete = function () { resolve(); };
                transaction.onerror = function () { resolve(); };
                transaction.onabort = function () { resolve(); };
            });
        }).catch(function () {});
    }

    function restoreReportDraftResources(form, kind, entries) {
        var list = qs('[data-report-resource-list="' + kind + '"]', form);
        if (!list) return;
        list.innerHTML = '';
        (Array.isArray(entries) ? entries : []).slice(0, 40).forEach(function (entry) {
            list.insertAdjacentHTML('beforeend', reportResourceRowHtml(kind));
            var row = reportResourceRows(form, kind).slice(-1)[0];
            if (!row) return;
            var label = qs('[data-report-resource-label]', row);
            var count = qs('[data-report-resource-count]', row);
            var hours = qs('[data-report-resource-hours]', row);
            var names = qs('[data-report-resource-names]', row);
            if (label) label.value = String(entry && entry.label || '');
            if (count) count.value = String(entry && entry.count || '');
            if (hours) hours.value = String(entry && entry.hours || '');
            if (names) names.value = (Array.isArray(entry && entry.names) ? entry.names : []).join('\n');
        });
        syncReportResourceSummary(form, kind);
    }

    function restoreReportDraftPhotos(form, snapshot) {
        var manifest = Array.isArray(snapshot.photos) ? snapshot.photos.slice(0, 8) : [];
        var draftKey = reportDraftStorageKey(form);
        return Promise.all(manifest.map(function (item) {
            if (item.status === 'uploaded' && item.serverPhoto) {
                return {
                    id: String(item.id),
                    name: String(item.name || 'Фото'),
                    status: 'uploaded',
                    blob: null,
                    url: String(item.serverPhoto.view_url || ''),
                    serverPhoto: item.serverPhoto,
                    persisted: true
                };
            }
            return readReportDraftPhotoWithRetry(draftKey, item.id, 4).then(function (record) {
                if (!record || !record.blob) {
                    form._reportDraftPhotoStorageFailed = true;
                    return {
                        id: String(item.id),
                        name: String(item.name || 'Фото'),
                        status: 'error',
                        blob: null,
                        url: '',
                        storageMissing: true,
                        persisted: false
                    };
                }
                var restoredStatus = item.status === 'upload-error' || item.status === 'uploading' ? 'upload-error' : item.status;
                if (restoredStatus === 'loading') restoredStatus = 'ready';
                if (restoredStatus !== 'ready' && restoredStatus !== 'upload-error' && restoredStatus !== 'error') restoredStatus = 'ready';
                return {
                    id: String(item.id),
                    name: String(record.name || item.name || 'Фото'),
                    type: String(record.type || item.type || ''),
                    size: Number(record.size || item.size || 0),
                    status: restoredStatus,
                    blob: record.blob,
                    url: URL.createObjectURL(record.blob),
                    serverPhoto: item.serverPhoto || null,
                    persisted: true
                };
            });
        })).then(function (drafts) {
            clearReportPhotoDrafts(form);
            form._reportPhotoDrafts = drafts;
            renderReportPhotoDrafts(form);
            return drafts;
        });
    }

    function setReportDraftRestoringMode(form, active) {
        if (!form) return;
        if (form.classList) form.classList.toggle('is-draft-restoring', !!active);
        qsa('input, textarea, select, button', form).forEach(function (control) {
            if (active) {
                if (!control.disabled) {
                    control.disabled = true;
                    control.dataset.reportRestoreDisabled = '1';
                }
            } else if (control.dataset.reportRestoreDisabled === '1') {
                control.disabled = false;
                delete control.dataset.reportRestoreDisabled;
            }
        });
    }

    function setReportSubmissionRecoveryMode(form, active, pendingLabel) {
        if (!form) return;
        if (form.classList) form.classList.toggle('is-submission-recovery', !!active);
        qsa('input, textarea, select, button', form).forEach(function (control) {
            var keepEnabled = control.matches('[data-report-draft-clear], .report-submit-button');
            if (active) {
                if (!keepEnabled && !control.disabled) {
                    control.disabled = true;
                    control.dataset.reportRecoveryDisabled = '1';
                }
            } else if (control.dataset.reportRecoveryDisabled === '1') {
                control.disabled = false;
                delete control.dataset.reportRecoveryDisabled;
            }
        });
        var submitLabel = qs('.report-submit-button > span:first-child', form);
        if (submitLabel) {
            if (!submitLabel.dataset.defaultLabel) submitLabel.dataset.defaultLabel = submitLabel.textContent;
            submitLabel.textContent = active ? (pendingLabel || 'Проверить отправку') : submitLabel.dataset.defaultLabel;
        }
    }

    function clearReportDraft(form) {
        if (!form) return;
        var key = reportDraftStorageKey(form);
        if (form._reportDraftTimer) clearTimeout(form._reportDraftTimer);
        form._reportDraftTimer = null;
        try { if (key) window.localStorage.removeItem(key); } catch (error) {}
        clearReportDraftPhotoStorage(key);
        form._reportDraftPhase = 'editing';
        form._reportDraftSubmitPayload = null;
        form._reportDraftPhotoStorageFailed = false;
        delete form.dataset.clientRequestId;
        delete form.dataset.savedDailyLogId;
        delete form.dataset.reportDraftRestored;
        reportDraftStatus(form, '', 'Черновик будет сохраняться автоматически', false);
    }

    function closeReportDraftClearDialog(form, restoreFocus) {
        if (!form) return;
        var drawer = form.closest ? form.closest('.reports-drawer') : null;
        var dialog = drawer ? qs('[data-report-clear-dialog]', drawer) : null;
        if (!dialog || dialog.hidden) return;
        dialog.hidden = true;
        dialog.setAttribute('aria-hidden', 'true');
        if (restoreFocus !== false) {
            var opener = form._reportClearDialogOpener;
            if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
        }
        form._reportClearDialogOpener = null;
    }

    function openReportDraftClearDialog(form, opener) {
        if (form && form.dataset.submitLocked === '1') {
            showAppNotice('Дождитесь ответа сервера перед очисткой отчёта.', 'warn');
            return;
        }
        if (!form) return;
        var drawer = form.closest ? form.closest('.reports-drawer') : null;
        var dialog = drawer ? qs('[data-report-clear-dialog]', drawer) : null;
        if (!dialog) return;
        form._reportClearDialogOpener = opener || document.activeElement;
        dialog.hidden = false;
        dialog.setAttribute('aria-hidden', 'false');
        var cancel = qs('[data-report-draft-clear-cancel]', dialog);
        if (cancel && typeof cancel.focus === 'function') cancel.focus();
    }

    function discardReportDraft(form) {
        if (form && form.dataset.submitLocked === '1') {
            showAppNotice('Дождитесь ответа сервера перед очисткой отчёта.', 'warn');
            return;
        }
        if (!form) return;
        closeReportDraftClearDialog(form, false);
        form._reportDraftSuppress = true;
        setReportSubmissionRecoveryMode(form, false);
        setReportDraftRestoringMode(form, false);
        clearReportDraft(form);
        setReportPhotoRetryMode(form, 0);
        form.reset();
        clearReportPhotoDrafts(form);
        qsa('[data-report-resource-list]', form).forEach(function (list) { list.innerHTML = ''; });
        syncReportResourceSummary(form, 'workforce');
        syncReportResourceSummary(form, 'equipment');
        form.dataset.reportDateTouched = '0';
        var dateControl = reportFormControl(form, 'report_date');
        if (dateControl) dateControl.value = currentLocalDateIso();
        var rawControl = reportFormControl(form, 'raw_input');
        if (rawControl) rawControl.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(function () {
            form._reportDraftSuppress = false;
            reportDraftStatus(form, '', 'Черновик будет сохраняться автоматически', false);
        }, 0);
    }

    function restoreReportDraft(form) {
        var snapshot = readReportDraft(form);
        if (!snapshot || !reportDraftIsMeaningful(snapshot)) {
            reportDraftStatus(form, '', 'Черновик будет сохраняться автоматически', false);
            return;
        }
        form._reportDraftRestoring = true;
        form._reportDraftPhase = String(snapshot.phase || 'editing');
        form._reportDraftSubmitPayload = snapshot.submitPayload || null;
        if (snapshot.clientRequestId) form.dataset.clientRequestId = String(snapshot.clientRequestId);
        if (form._reportDraftPhase === 'submitting' && !form._reportDraftSubmitPayload) {
            form._reportDraftPhase = 'editing';
            delete form.dataset.clientRequestId;
        }
        setReportDraftRestoringMode(form, true);
        form.dataset.reportDraftRestored = '1';
        form.dataset.reportDateTouched = snapshot.reportDateTouched ? '1' : '0';
        if (Number(snapshot.savedDailyLogId || 0)) form.dataset.savedDailyLogId = String(snapshot.savedDailyLogId);
        var values = {
            report_date: snapshot.reportDate,
            is_client_visible: snapshot.isClientVisible,
            raw_input: snapshot.rawInput,
            work_done: snapshot.workDone,
            blockers: snapshot.blockers,
            next_steps: snapshot.nextSteps
        };
        Object.keys(values).forEach(function (name) {
            var control = reportFormControl(form, name);
            if (control && values[name] != null) control.value = String(values[name]);
        });
        var restoredWorkDone = reportFormControl(form, 'work_done');
        if (restoredWorkDone) restoredWorkDone.dataset.reportManual = snapshot.workDoneManual ? '1' : '0';
        var extra = qs('.report-extra-fields', form);
        if (extra) extra.open = !!snapshot.extraOpen;
        restoreReportDraftResources(form, 'workforce', snapshot.workforce);
        restoreReportDraftResources(form, 'equipment', snapshot.equipment);
        reportDraftStatus(form, 'saving', 'Восстанавливаем черновик…', true);
        setTimeout(function () {
            if (form._reportDraftDisposed) {
                form._reportDraftRestoring = false;
                return;
            }
            Promise.resolve().then(function () {
                var controller = form._reportPreviewDraftController;
                if (controller && typeof controller.restore === 'function') {
                    controller.restore(snapshot.assistant || {});
                } else {
                    var rawControl = reportFormControl(form, 'raw_input');
                    if (rawControl) rawControl.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return restoreReportDraftPhotos(form, snapshot);
            }).then(function () {
                if (form._reportDraftDisposed) {
                    form._reportDraftRestoring = false;
                    return;
                }
                form._reportDraftRestoring = false;
                setReportDraftRestoringMode(form, false);
                if (Number(snapshot.savedDailyLogId || 0)) {
                    setReportPhotoRetryMode(form, Number(snapshot.savedDailyLogId));
                    form._reportDraftPhase = 'photo_retry';
                } else if (form._reportDraftPhase === 'submitting' && form._reportDraftSubmitPayload) {
                    setReportSubmissionRecoveryMode(form, true, 'Проверить отправку');
                }
                var message = 'Восстановлен черновик от ' + reportDraftTimeLabel(snapshot.updatedAt);
                if (form._reportDraftPhase === 'submitting') {
                    message = 'Предыдущая отправка могла сохраниться · нажмите «Проверить отправку»';
                } else if (form._reportDraftPhase === 'photo_retry') {
                    message = 'Отчёт сохранён · осталось загрузить фото';
                }
                if (form._reportDraftPhotoStorageFailed) message += ' · часть фото нужно выбрать снова';
                reportDraftStatus(form, form._reportDraftPhotoStorageFailed || form._reportDraftPhase !== 'editing' ? 'warning' : 'restored', message, true);
            }).catch(function () {
                if (form._reportDraftDisposed) {
                    form._reportDraftRestoring = false;
                    return;
                }
                form._reportDraftRestoring = false;
                setReportDraftRestoringMode(form, false);
                form._reportDraftPhotoStorageFailed = true;
                if (Number(snapshot.savedDailyLogId || 0)) {
                    setReportPhotoRetryMode(form, Number(snapshot.savedDailyLogId));
                    form._reportDraftPhase = 'photo_retry';
                } else if (form._reportDraftPhase === 'submitting' && form._reportDraftSubmitPayload) {
                    setReportSubmissionRecoveryMode(form, true, 'Проверить отправку');
                }
                var restoreErrorMessage = form._reportDraftPhase === 'submitting'
                    ? 'Предыдущая отправка могла сохраниться · нажмите «Проверить отправку»'
                    : 'Текст восстановлен · фото нужно выбрать повторно';
                reportDraftStatus(form, 'warning', restoreErrorMessage, true);
            });
        }, 0);
    }

    function bindReportDraftPersistence(form) {
        if (!form || !form.hasAttribute('data-report-draft-form') || form.dataset.reportDraftBound === '1') return;
        form.dataset.reportDraftBound = '1';
        form._reportDraftDisposed = false;
        form.addEventListener('input', function (event) {
            if (event.target && event.target.matches('[data-report-photo-input]')) return;
            scheduleReportDraftSave(form, false);
        });
        form.addEventListener('change', function (event) {
            var reportDate = reportFormControl(form, 'report_date');
            if (event.isTrusted && event.target === reportDate) form.dataset.reportDateTouched = '1';
            scheduleReportDraftSave(form, true);
        });
        form.addEventListener('pmbi:report-draft-changed', function () { scheduleReportDraftSave(form, true); });
        var clearButton = qs('[data-report-draft-clear]', form);
        if (clearButton) clearButton.addEventListener('click', function () { openReportDraftClearDialog(form, clearButton); });
        var drawer = form.closest ? form.closest('.reports-drawer') : null;
        var clearDialog = drawer ? qs('[data-report-clear-dialog]', drawer) : null;
        if (clearDialog) {
            var cancelClear = qs('[data-report-draft-clear-cancel]', clearDialog);
            var confirmClear = qs('[data-report-draft-clear-confirm]', clearDialog);
            if (cancelClear) cancelClear.addEventListener('click', function () { closeReportDraftClearDialog(form, true); });
            if (confirmClear) confirmClear.addEventListener('click', function () { discardReportDraft(form); });
            clearDialog.addEventListener('click', function (event) {
                if (event.target === clearDialog) closeReportDraftClearDialog(form, true);
            });
            clearDialog.addEventListener('keydown', function (event) {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                closeReportDraftClearDialog(form, true);
            });
        }
        form._reportDraftSaveNow = function () { return saveReportDraftNow(form); };
        restoreReportDraft(form);
        if (document.body.dataset.reportDraftLifecycleBound !== '1') {
            document.body.dataset.reportDraftLifecycleBound = '1';
            cleanupExpiredReportDraftPhotoStorage();
            window.addEventListener('pagehide', flushReportDrafts);
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'hidden') flushReportDrafts();
            });
        }
    }

    function flushReportDrafts() {
        qsa('[data-report-draft-form]').forEach(function (form) {
            if (form._reportDraftSaveNow) form._reportDraftSaveNow();
        });
    }

    function disposeReportDrafts() {
        qsa('[data-report-draft-form]').forEach(disposeReportDraftForm);
        qsa('[data-drawer-id="project-report-create"]').forEach(function (drawer) { drawer.remove(); });
    }

    function disposeReportDraftForm(form) {
        if (!form) return;
        saveReportDraftNow(form);
        form._reportDraftDisposed = true;
        reportPhotoDrafts(form).forEach(function (draft) {
            // Let an in-flight IndexedDB write finish so a fast route change
            // cannot lose the selected file. The detached form itself must not
            // schedule another snapshot and overwrite a newer reopened draft.
            draft.detached = true;
            if (draft.url) URL.revokeObjectURL(draft.url);
            draft.url = '';
        });
    }

    function reportPhotoDrafts(form) {
        if (!Array.isArray(form._reportPhotoDrafts)) form._reportPhotoDrafts = [];
        return form._reportPhotoDrafts;
    }

    function reportPhotoDraftId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        return Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function reportPhotoSize(bytes) {
        var value = Math.max(0, Number(bytes) || 0);
        return value >= 1024 * 1024 ? (value / 1024 / 1024).toFixed(1) + ' МБ' : Math.max(1, Math.round(value / 1024)) + ' КБ';
    }

    function loadReportPhotoImageFallback(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var image = new Image();
            image.onload = function () {
                resolve({ image: image, width: image.naturalWidth, height: image.naturalHeight, close: function () { URL.revokeObjectURL(url); } });
            };
            image.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('bad_image'));
            };
            image.src = url;
        });
    }

    function loadReportPhotoImage(file) {
        if (typeof window.createImageBitmap === 'function') {
            return window.createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bitmap) {
                return { image: bitmap, width: bitmap.width, height: bitmap.height, close: function () { if (bitmap.close) bitmap.close(); } };
            }).catch(function () {
                return loadReportPhotoImageFallback(file);
            });
        }
        return loadReportPhotoImageFallback(file);
    }

    function reportCanvasBlob(canvas, type, quality) {
        return new Promise(function (resolve) {
            canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
        });
    }

    function compressReportPhoto(file) {
        return loadReportPhotoImage(file).then(function (loaded) {
            var maxEdge = 1920;
            var scale = Math.min(1, maxEdge / Math.max(loaded.width, loaded.height));
            var width = Math.max(1, Math.round(loaded.width * scale));
            var height = Math.max(1, Math.round(loaded.height * scale));
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var context = canvas.getContext('2d');
            if (!context) {
                loaded.close();
                throw new Error('canvas_context_unavailable');
            }
            context.drawImage(loaded.image, 0, 0, width, height);
            loaded.close();
            return reportCanvasBlob(canvas, 'image/webp', 0.82).then(function (blob) {
                if (!blob || !blob.size) return reportCanvasBlob(canvas, 'image/jpeg', 0.82);
                return blob;
            }).then(function (blob) {
                if (!blob) throw new Error('image_compression_failed');
                if (blob.size <= 1800 * 1024) return blob;
                return reportCanvasBlob(canvas, blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.68).then(function (smaller) {
                    return smaller && smaller.size ? smaller : blob;
                });
            }).then(function (blob) {
                return { blob: blob, width: width, height: height };
            });
        });
    }

    function renderReportPhotoDrafts(form) {
        var root = qs('[data-report-photo-list]', form);
        if (!root) return;
        var drafts = reportPhotoDrafts(form);
        if (!drafts.length) {
            root.innerHTML = '<div class="report-photo-empty"><span aria-hidden="true"><i data-lucide="image-plus"></i></span><b>Фото пока не выбраны</b><small>Можно прикрепить до 8 снимков</small></div>';
            refreshLucideIcons(root);
            form.dispatchEvent(new CustomEvent('pmbi:report-preview-meta-changed', { bubbles: true }));
            return;
        }
        root.innerHTML = drafts.map(function (draft) {
            var status = draft.status === 'loading' ? 'Сжимаем…'
                : (draft.status === 'uploading' ? 'Загружаем…'
                : (draft.status === 'uploaded' ? 'Загружено'
                : (draft.status === 'upload-error' ? 'Не загрузилось — можно повторить'
                : (draft.status === 'error' ? 'Не удалось обработать' : reportPhotoSize(draft.blob && draft.blob.size)))));
            return '<article class="report-photo-draft is-' + escapeHtml(draft.status) + '" data-report-photo-id="' + escapeHtml(draft.id) + '">' +
                (draft.url ? '<img src="' + escapeHtml(draft.url) + '" alt="">' : '<span class="report-photo-loading" aria-hidden="true"></span>') +
                '<div><b>' + escapeHtml(draft.name) + '</b><small>' + escapeHtml(status) + '</small></div>' +
                (draft.status === 'uploaded' ? '<span class="report-photo-uploaded-mark" aria-hidden="true"><i data-lucide="check"></i></span>' : '<button type="button" data-report-photo-remove aria-label="Убрать фото"><i data-lucide="x" aria-hidden="true"></i></button>') +
            '</article>';
        }).join('');
        refreshLucideIcons(root);
        form.dispatchEvent(new CustomEvent('pmbi:report-preview-meta-changed', { bubbles: true }));
    }

    function clearReportPhotoDrafts(form) {
        reportPhotoDrafts(form).forEach(function (draft) {
            draft.removed = true;
            if (draft.url) URL.revokeObjectURL(draft.url);
            draft.url = '';
        });
        form._reportPhotoDrafts = [];
        renderReportPhotoDrafts(form);
    }

    function setReportPhotoRetryMode(form, dailyLogId) {
        var active = Number(dailyLogId || 0) > 0;
        if (active) form.dataset.savedDailyLogId = String(dailyLogId);
        else delete form.dataset.savedDailyLogId;
        form.classList.toggle('is-photo-retry', active);
        qsa('input, textarea, select, button', form).forEach(function (control) {
            var keepEnabled = control.matches('[data-report-draft-clear], [data-report-photo-input], [data-report-photo-remove], .report-submit-button');
            if (active) {
                if (!keepEnabled && !control.disabled) {
                    control.disabled = true;
                    control.dataset.reportRetryDisabled = '1';
                }
            } else if (control.dataset.reportRetryDisabled === '1') {
                control.disabled = false;
                delete control.dataset.reportRetryDisabled;
            }
        });
        var submitLabel = qs('.report-submit-button > span:first-child', form);
        if (submitLabel) {
            if (!submitLabel.dataset.defaultLabel) submitLabel.dataset.defaultLabel = submitLabel.textContent;
            submitLabel.textContent = active ? 'Повторить загрузку фото' : submitLabel.dataset.defaultLabel;
        }
    }

    function bindReportPhotoPicker(form) {
        if (!form || form.dataset.reportPhotosBound === '1') return;
        form.dataset.reportPhotosBound = '1';
        var input = qs('[data-report-photo-input]', form);
        var list = qs('[data-report-photo-list]', form);
        if (!input || !list) return;
        renderReportPhotoDrafts(form);
        input.addEventListener('change', function () {
            var drafts = reportPhotoDrafts(form);
            Array.prototype.slice.call(input.files || []).slice(0, Math.max(0, 8 - drafts.length)).forEach(function (file) {
                var draft = { id: reportPhotoDraftId(), name: file.name || 'Фото', type: file.type || '', size: file.size || 0, status: 'loading', blob: null, url: '', persisted: false };
                drafts.push(draft);
                renderReportPhotoDrafts(form);
                if (!/^image\//.test(String(file.type || '')) || file.size > 20 * 1024 * 1024) {
                    draft.status = 'error';
                    renderReportPhotoDrafts(form);
                    scheduleReportDraftSave(form, true);
                    return;
                }
                persistReportDraftPhoto(form, draft, file);
                scheduleReportDraftSave(form, true);
                compressReportPhoto(file).then(function (result) {
                    if (draft.removed || drafts.indexOf(draft) === -1) return;
                    draft.blob = result.blob;
                    draft.name = String(draft.name).replace(/\.[^.]+$/, '') + (result.blob.type === 'image/webp' ? '.webp' : '.jpg');
                    draft.type = result.blob.type || '';
                    draft.size = result.blob.size || 0;
                    draft.status = 'ready';
                    if (!form._reportDraftDisposed) {
                        draft.url = URL.createObjectURL(result.blob);
                        renderReportPhotoDrafts(form);
                    }
                    persistReportDraftPhoto(form, draft, result.blob);
                    if (!form._reportDraftDisposed) scheduleReportDraftSave(form, true);
                }).catch(function () {
                    if (draft.removed || drafts.indexOf(draft) === -1) return;
                    draft.status = 'error';
                    if (!form._reportDraftDisposed) {
                        renderReportPhotoDrafts(form);
                        scheduleReportDraftSave(form, true);
                    }
                });
            });
            input.value = '';
        });
        list.addEventListener('click', function (event) {
            var remove = event.target && event.target.closest ? event.target.closest('[data-report-photo-remove]') : null;
            if (!remove) return;
            var card = remove.closest('[data-report-photo-id]');
            var id = card ? card.getAttribute('data-report-photo-id') : '';
            var index = reportPhotoDrafts(form).findIndex(function (draft) { return draft.id === id; });
            if (index < 0) return;
            var removed = reportPhotoDrafts(form).splice(index, 1)[0];
            if (removed && removed.status === 'uploaded') {
                reportPhotoDrafts(form).splice(index, 0, removed);
                return;
            }
            if (removed) removed.removed = true;
            if (removed && removed.url) URL.revokeObjectURL(removed.url);
            if (removed) deleteReportDraftPhoto(form, removed);
            renderReportPhotoDrafts(form);
            scheduleReportDraftSave(form, true);
        });
    }

    function uploadReportPhotos(projectId, dailyLogId, form, requestId) {
        var allDrafts = reportPhotoDrafts(form);
        var drafts = allDrafts.filter(function (draft) {
            return (draft.status === 'ready' || draft.status === 'upload-error') && draft.blob;
        });
        if (!drafts.length) {
            return Promise.resolve({
                photos: allDrafts.map(function (draft) { return draft.serverPhoto; }).filter(Boolean),
                failed: allDrafts.filter(function (draft) { return draft.status === 'upload-error' || draft.status === 'error'; }).length
            });
        }
        drafts.forEach(function (draft) {
            draft.status = 'uploading';
            draft.uploadError = null;
        });
        renderReportPhotoDrafts(form);
        scheduleReportDraftSave(form, true);
        return Promise.all(drafts.map(function (draft) {
            var payload = new FormData();
            payload.append('client_photo_id', String(requestId) + ':photo:' + draft.id);
            payload.append('file', draft.blob, draft.name);
            return apiFormData('/api/projects/' + projectId + '/daily-logs/' + dailyLogId + '/photos', payload, {
                loaderText: 'Загружаем фото…'
            }).then(function (data) {
                draft.status = 'uploaded';
                draft.serverPhoto = data && data.photo;
                deleteReportDraftPhoto(form, draft);
                scheduleReportDraftSave(form, true);
                return { photo: data && data.photo, error: null };
            }).catch(function (error) {
                draft.status = 'upload-error';
                draft.uploadError = error;
                scheduleReportDraftSave(form, true);
                return { photo: null, error: error };
            });
        })).then(function (results) {
            renderReportPhotoDrafts(form);
            scheduleReportDraftSave(form, true);
            return {
                photos: allDrafts.map(function (draft) { return draft.serverPhoto; }).filter(Boolean),
                failed: allDrafts.filter(function (draft) { return draft.status === 'upload-error' || draft.status === 'error'; }).length
            };
        });
    }

    function bindLogForm() {
        qsa('[data-log-form]').forEach(function (form) {
            if (!form || form.dataset.bound === '1') return;
            bindReportResources(form);
            bindReportPhotoPicker(form);
            bindReportDraftPersistence(form);
            form.dataset.bound = '1';
            var boundDateControl = reportFormControl(form, 'report_date');
            if (boundDateControl) boundDateControl.addEventListener('change', function (event) {
                if (event.isTrusted) form.dataset.reportDateTouched = '1';
            });
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var reportOnly = !!(event.submitter && event.submitter.matches && event.submitter.matches('[data-report-only-submit]'));
                var error = qs('[data-log-error]', form) || qs('[data-log-error]');
                if (error) {
                    error.textContent = '';
                    error.classList.remove('active');
                }
                var projectControl = reportFormControl(form, 'project_id');
                var dateControl = reportFormControl(form, 'report_date');
                var titleControl = reportFormControl(form, 'title');
                var workDoneControl = reportFormControl(form, 'work_done');
                var rawInputControl = reportFormControl(form, 'raw_input');
                var workersControl = reportFormControl(form, 'workers_count');
                var equipmentControl = reportFormControl(form, 'equipment');
                var blockersControl = reportFormControl(form, 'blockers');
                var nextStepsControl = reportFormControl(form, 'next_steps');
                var visibilityControl = reportFormControl(form, 'is_client_visible');
                var savedDailyLogIdBeforeSubmit = Number(form.dataset.savedDailyLogId || 0);
                var recoveredSubmissionPayload = !savedDailyLogIdBeforeSubmit
                    && form._reportDraftPhase === 'submitting'
                    && form._reportDraftSubmitPayload
                    ? form._reportDraftSubmitPayload
                    : null;
                var recoveringSubmission = !!recoveredSubmissionPayload;
                var richResourceMode = !!qs('[data-report-resource-list]', form);
                var workforceResult = richResourceMode ? collectReportResources(form, 'workforce') : { entries: [], invalid: null };
                var equipmentResult = richResourceMode ? collectReportResources(form, 'equipment') : { entries: [], invalid: null };
                var photoDraftIssue = reportPhotoDrafts(form).find(function (draft) {
                    return draft.status === 'loading' || draft.status === 'uploading' || draft.status === 'error';
                });
                var invalidManualSelection = !recoveringSubmission && !reportOnly ? qsa('[data-report-manual-row]', form).map(function (row) {
                    var quantity = qs('[data-report-manual-qty]', row);
                    var action = qs('[data-report-manual-action]', row);
                    if (action && !String(action.value || '').trim()) {
                        return { control: action, message: 'Выберите действие для материала.' };
                    }
                    if (quantity && !quantity.disabled && !(Number(quantity.value) > 0)) {
                        return { control: quantity, message: 'Укажите количество больше нуля.' };
                    }
                    return null;
                }).find(Boolean) : null;
                var invalidEffectQty = (reportOnly ? [] : qsa('[data-report-effect]:checked', form)).map(function (input) {
                    var card = input.closest ? input.closest('.report-effect-card') : null;
                    var qtyInput = card ? qs('[data-report-effect-qty]', card) : null;
                    return { toggle: input, qty: qtyInput };
                }).find(function (entry) {
                    if (!entry.qty || !(Number(entry.qty.value) > 0)) return true;
                    var maxQty = Number(entry.toggle.getAttribute('data-effect-max') || entry.qty.getAttribute('max') || 0);
                    return !(maxQty > 0) || Number(entry.qty.value) > maxQty + 1e-9;
                }) || null;
                var clientRequestId = String(recoveredSubmissionPayload && recoveredSubmissionPayload.client_request_id || reportClientRequestId(form));
                if (clientRequestId) form.dataset.clientRequestId = clientRequestId;
                var confirmedActions = reportOnly ? [] : reportConfirmedActions(form, clientRequestId);
                var projectId = Number(projectControl && projectControl.value || 0);
                var todayIso = currentLocalDateIso();
                if (dateControl && form.dataset.reportDateTouched !== '1' && (!dateControl.value || dateControl.value === APP_TODAY)) {
                    dateControl.value = todayIso;
                }
                var selectedDate = dateControl && dateControl.value ? dateControl.value : todayIso;
                var sourceText = rawInputControl ? rawInputControl.value.trim() : '';
                var reportText = workDoneControl ? workDoneControl.value.trim() : '';
                if (!reportText) reportText = sourceText;
                var reportTitle = titleControl ? titleControl.value.trim() : '';
                if (!reportTitle) reportTitle = '\u041e\u0442\u0447\u0435\u0442 \u0437\u0430 ' + selectedDate;
                if (recoveringSubmission) {
                    selectedDate = String(recoveredSubmissionPayload.report_date || selectedDate);
                    sourceText = String(recoveredSubmissionPayload.raw_input || sourceText);
                    reportText = String(recoveredSubmissionPayload.work_done || reportText);
                    reportTitle = String(recoveredSubmissionPayload.title || reportTitle);
                }

                if (!projectId) {
                    showLogFormError(form, error, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442. \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435.', projectControl);
                    return;
                }
                if (!reportText) {
                    showLogFormError(form, error, '\u041e\u043f\u0438\u0448\u0438\u0442\u0435, \u0447\u0442\u043e \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u043e \u043d\u0430 \u043e\u0431\u044a\u0435\u043a\u0442\u0435.', rawInputControl || workDoneControl);
                    return;
                }
                if (!recoveringSubmission && workforceResult.invalid) {
                    showLogFormError(form, error, workforceResult.invalid.message, workforceResult.invalid.control);
                    return;
                }
                if (!recoveringSubmission && equipmentResult.invalid) {
                    showLogFormError(form, error, equipmentResult.invalid.message, equipmentResult.invalid.control);
                    return;
                }
                if (!recoveringSubmission && photoDraftIssue) {
                    showLogFormError(form, error, photoDraftIssue.status === 'loading' || photoDraftIssue.status === 'uploading' ? 'Подождите, пока фотографии подготовятся.' : 'Удалите фотографию, которую не удалось обработать, и выберите её снова.', qs('[data-report-photo-input]', form));
                    return;
                }
                if (!recoveringSubmission && invalidManualSelection) {
                    showLogFormError(form, error, invalidManualSelection.message, invalidManualSelection.control);
                    return;
                }
                if (!recoveringSubmission && invalidEffectQty) {
                    showLogFormError(form, error, 'Количество должно быть больше нуля и не превышать доступный остаток.', invalidEffectQty.qty);
                    return;
                }

                if (titleControl) titleControl.value = reportTitle;
                if (workDoneControl) workDoneControl.value = reportText;
                if (richResourceMode && workersControl) workersControl.value = String(workforceResult.entries.reduce(function (sum, entry) { return sum + entry.count; }, 0));
                if (richResourceMode && equipmentControl) equipmentControl.value = equipmentResult.entries.map(function (entry) {
                    return entry.name + ' — ' + entry.count + ' ед., ' + entry.hours + ' ч';
                }).join('; ');
                var freshReportPayload = {
                    report_date: selectedDate,
                    title: reportTitle,
                    work_done: reportText,
                    workers_count: Number(workersControl && workersControl.value || 0),
                    workforce: workforceResult.entries,
                    equipment: equipmentControl ? equipmentControl.value.trim() : '',
                    equipment_entries: equipmentResult.entries,
                    blockers: blockersControl ? blockersControl.value.trim() : '',
                    next_steps: nextStepsControl ? nextStepsControl.value.trim() : '',
                    raw_input: sourceText,
                    is_client_visible: visibilityControl ? visibilityControl.value === '1' : true,
                    client_request_id: clientRequestId,
                    confirmed_actions: confirmedActions
                };
                var reportPayload = Object.assign({}, recoveringSubmission ? recoveredSubmissionPayload : freshReportPayload);
                delete reportPayload.progress_percent;
                delete reportPayload.progressPercent;
                clientRequestId = String(reportPayload.client_request_id || clientRequestId);
                if (clientRequestId) form.dataset.clientRequestId = clientRequestId;
                form._reportDraftPhase = savedDailyLogIdBeforeSubmit ? 'photo_retry' : 'submitting';
                form._reportDraftSubmitPayload = savedDailyLogIdBeforeSubmit ? null : reportPayload;
                setReportSubmissionRecoveryMode(
                    form,
                    true,
                    savedDailyLogIdBeforeSubmit ? 'Загружаем фото…' : (recoveringSubmission ? 'Проверяем отправку…' : 'Отправляем отчёт…')
                );
                saveReportDraftNow(form);
                withSubmitLock(form, function () {
                    var savedDailyLogId = Number(form.dataset.savedDailyLogId || 0);
                    var savedLog = savedDailyLogId && state.projectLogsByProject && Array.isArray(state.projectLogsByProject[projectId])
                        ? state.projectLogsByProject[projectId].find(function (log) { return Number(log && log.id || 0) === savedDailyLogId; })
                        : null;
                    var saveReport = savedDailyLogId ? Promise.resolve({
                        id: savedDailyLogId,
                        log: savedLog || { id: savedDailyLogId, project_id: projectId, report_date: selectedDate, title: reportTitle, work_done: reportText },
                        appliedActions: []
                    }) : api('/api/projects/' + projectId + '/daily-logs', {
                        method: 'POST',
                        body: JSON.stringify(reportPayload)
                    });
                    return saveReport.then(function (data) {
                        var dailyLogId = Number(data && (data.id || (data.log && data.log.id)) || 0);
                        if (!dailyLogId) throw new Error('daily_log_id_missing');
                        form.dataset.savedDailyLogId = String(dailyLogId);
                        form.classList.add('is-photo-retry');
                        form._reportDraftPhase = 'photo_retry';
                        form._reportDraftSubmitPayload = null;
                        saveReportDraftNow(form);
                        return uploadReportPhotos(projectId, dailyLogId, form, clientRequestId).then(function (photoUpload) {
                            data.photoUpload = photoUpload;
                            if (data.log) data.log.photos = photoUpload.photos;
                            return data;
                        });
                    }).then(function (data) {
                        var keepProject = projectControl && projectControl.value ? projectControl.value : String(projectId);
                        var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || state.selectedProject || state.projects[0] || { id: projectId, title: '\u041e\u0431\u044a\u0435\u043a\u0442' };
                        var failedPhotos = Number(data && data.photoUpload && data.photoUpload.failed || 0);
                        setReportSubmissionRecoveryMode(form, false);
                        setReportPhotoRetryMode(form, failedPhotos ? Number(form.dataset.savedDailyLogId || 0) : 0);
                        if (data && data.log) {
                            if (!state.projectLogsByProject) state.projectLogsByProject = {};
                            var currentLogs = Array.isArray(state.projectLogsByProject[projectId]) ? state.projectLogsByProject[projectId] : [];
                            var savedLogId = Number(data.log.id || 0);
                            var updatedLogs = [data.log].concat(currentLogs.filter(function (log) {
                                return Number(log && log.id || 0) !== savedLogId;
                            }));
                            state.projectLogsByProject[projectId] = updatedLogs;
                            renderLogsStats(updatedLogs, null);
                            renderLogsCalendar(project, updatedLogs);
                            renderLogsList(project, updatedLogs);
                        }
                        if (!failedPhotos) {
                            form._reportDraftSuppress = true;
                            clearReportDraft(form);
                            form.reset();
                            clearReportPhotoDrafts(form);
                            qsa('[data-report-resource-list]', form).forEach(function (list) { list.innerHTML = ''; });
                            syncReportResourceSummary(form, 'workforce');
                            syncReportResourceSummary(form, 'equipment');
                            delete form.dataset.clientRequestId;
                            if (projectControl) projectControl.value = keepProject;
                            if (dateControl) dateControl.value = currentLocalDateIso();
                            form.dataset.reportDateTouched = '0';
                            if (rawInputControl) rawInputControl.dispatchEvent(new Event('input', { bubbles: true }));
                            setTimeout(function () { form._reportDraftSuppress = false; }, 0);
                        }
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
                        if (!failedPhotos) {
                            closeSideDrawer(qs('[data-drawer-id="log-create"]'));
                            closeSideDrawer(qs('[data-drawer-id="project-report-create"]'));
                        }
                        var appliedCount = data && Array.isArray(data.appliedActions) ? data.appliedActions.length : 0;
                        var uploadedPhotos = data && data.photoUpload && Array.isArray(data.photoUpload.photos) ? data.photoUpload.photos.length : 0;
                        if (failedPhotos) {
                            showLogFormError(form, error, 'Отчёт сохранён, но не загрузилось фото: ' + failedPhotos + '. Нажмите сохранить ещё раз, чтобы повторить загрузку.');
                        } else {
                            var noticeParts = ['Отчёт сохранён'];
                            if (appliedCount) noticeParts.push('действий применено: ' + appliedCount);
                            if (uploadedPhotos) noticeParts.push('фото: ' + uploadedPhotos);
                            showAppNotice(noticeParts.join(' · ') + '.', 'success');
                        }
                        if (appliedCount) {
                            delete state.materialsByProject[projectId];
                            loadMaterials(projectId, function () {
                                rerenderProjectMaterialAndWorkViews(projectId);
                            });
                            if (PMBI.warehouseControl && typeof PMBI.warehouseControl.load === 'function') {
                                PMBI.warehouseControl.load(projectId, true).catch(function () {});
                            }
                        }
                        refreshReminderBell();
                        loadProjectLogs(projectId, function (logs) {
                            loadProjectNotifications(projectId, function (notifications) {
                                renderLogsStats(logs, notifications);
                                renderLogsAlerts(notifications);
                                renderLogsCalendar(project, logs);
                                renderLogsList(project, logs);
                            });
                        });
                    }).catch(function (err) {
                        var savedDailyLogId = Number(form.dataset.savedDailyLogId || 0);
                        var responseStatus = Number(err && err.status || 0);
                        var definitiveRejection = responseStatus >= 400 && responseStatus < 500;
                        setReportSubmissionRecoveryMode(form, false);
                        if (savedDailyLogId) {
                            form._reportDraftPhase = 'photo_retry';
                            form._reportDraftSubmitPayload = null;
                            setReportPhotoRetryMode(form, savedDailyLogId);
                        } else if (definitiveRejection) {
                            form._reportDraftPhase = 'editing';
                            form._reportDraftSubmitPayload = null;
                            delete form.dataset.clientRequestId;
                        } else {
                            form._reportDraftPhase = 'submitting';
                            form._reportDraftSubmitPayload = reportPayload;
                            setReportSubmissionRecoveryMode(form, true, 'Проверить отправку');
                        }
                        saveReportDraftNow(form);
                        var message = reportActionErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043e\u0442\u0447\u0435\u0442');
                        if (!savedDailyLogId && !definitiveRejection) {
                            message = 'Не удалось подтвердить ответ сервера. Черновик сохранён — нажмите «Проверить отправку», чтобы безопасно продолжить.';
                            reportDraftStatus(form, 'warning', message, true);
                        }
                        showLogFormError(form, error, message);
                    });
                });
            });
        });
        try {
            bindReportPreview();
        } catch (previewError) {
            console.warn('Report preview initialization failed:', previewError);
        }
        try {
            bindReportVoiceInputs();
        } catch (voiceError) {
            console.warn('Report voice input initialization failed:', voiceError);
        }
    }

    // Project reports workspace. The standalone work log keeps its denser
    // operational view; the project tab gets a calmer, date-led experience.
    var baseRenderLogsStatsForProjectReports = renderLogsStats;
    var baseRenderLogsAlertsForProjectReports = renderLogsAlerts;
    var baseRenderLogsCalendarForProjectReports = renderLogsCalendar;
    var baseRenderLogsDayViewForProjectReports = renderLogsDayView;
    var baseRenderLogsListForProjectReports = renderLogsList;

    function projectReportsSurfaceRoot() {
        if (currentPage() !== 'projects') return null;
        return qs('[data-panel="reports"] .report-workspace');
    }

    function projectReportSortTimestamp(log) {
        var raw = log && (log.created_at || log.createdAt);
        if (raw == null || raw === '') return 0;
        var numeric = Number(raw);
        if (Number.isFinite(numeric)) return Math.abs(numeric) < 1000000000000 ? numeric * 1000 : numeric;
        var parsed = Date.parse(String(raw).replace(' ', 'T'));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function projectReportSortedLogs(logs) {
        return (Array.isArray(logs) ? logs.slice() : []).sort(function (left, right) {
            var dateOrder = String(right.report_date || '').localeCompare(String(left.report_date || ''));
            if (dateOrder) return dateOrder;
            var createdOrder = projectReportSortTimestamp(right) - projectReportSortTimestamp(left);
            if (createdOrder) return createdOrder;
            return Number(right.id || 0) - Number(left.id || 0);
        });
    }

    var projectReportLegacySectionProgressTitles = {
        'Групповое завершение работ': true,
        'Работы раздела возвращены в работу': true,
        'Групповое закрытие раздела': true,
        'Раздел снят с выполнения': true
    };

    function projectReportEntryKind(log) {
        var explicitKind = String(log && (log.entry_kind || log.entryKind) || '').trim().toLowerCase();
        if (explicitKind === 'section_progress') return 'section-progress';
        if (explicitKind === 'field_report') return 'field-report';
        return projectReportLegacySectionProgressTitles[String(log && log.title || '').trim()]
            ? 'section-progress'
            : 'field-report';
    }

    function projectReportFieldLogs(logs) {
        return projectReportSortedLogs(logs).filter(function (log) {
            return projectReportEntryKind(log) === 'field-report';
        });
    }

    function projectReportActionLogs(logs) {
        return projectReportSortedLogs(logs).filter(function (log) {
            return projectReportEntryKind(log) === 'section-progress';
        });
    }

    function projectReportDefaultSelectedDate(logs, fallbackDate) {
        var reports = projectReportFieldLogs(logs);
        return (reports[0] && reports[0].report_date) || fallbackDate || currentLocalDateIso();
    }

    function projectReportEntryTypeHtml(log) {
        var kind = projectReportEntryKind(log);
        if (kind === 'section-progress') {
            return '<span class="report-entry-type is-routine"><i data-lucide="check"></i><span>Обновление прогресса</span></span>';
        }
        return '<span class="report-entry-type is-field"><i data-lucide="hard-hat"></i><span>Зафиксировано на объекте</span></span>';
    }

    function projectReportStatusHtml(log, status) {
        if (projectReportEntryKind(log) === 'section-progress' && status.kind !== 'danger') return '';
        return '<span class="report-status-pill is-' + escapeHtml(status.kind) + '">' + escapeHtml(status.label) + '</span>';
    }

    function projectReportDateTime(isoDate) {
        if (!isoDate) return NaN;
        return new Date(String(isoDate).slice(0, 10) + 'T00:00:00Z').getTime();
    }

    function projectReportRelativeDate(isoDate) {
        if (!isoDate) return 'Ещё нет';
        var diff = Math.round((projectReportDateTime(currentLocalDateIso()) - projectReportDateTime(isoDate)) / 86400000);
        if (diff === 0) return 'Сегодня';
        if (diff === 1) return 'Вчера';
        return finalGraphDate(isoDate);
    }

    function projectReportMetric(icon, label, value, note, tone) {
        return '<article class="report-kpi' + (tone ? (' is-' + tone) : '') + '">' +
            '<span class="report-kpi-icon" aria-hidden="true"><i data-lucide="' + escapeHtml(icon) + '"></i></span>' +
            '<div><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(note) + '</span></div>' +
        '</article>';
    }

    function projectReportShiftHtml(log) {
        var workforce = Array.isArray(log && log.workforce) ? log.workforce : [];
        var equipmentEntries = Array.isArray(log && log.equipment_entries) ? log.equipment_entries : [];
        if (!workforce.length && !equipmentEntries.length) return '';
        function resourceGroup(kind, title, entries) {
            if (!entries.length) return '';
            return '<section class="report-shift-group is-' + kind + '"><div class="report-shift-group-head"><span aria-hidden="true"><i data-lucide="' + (kind === 'workforce' ? 'users-round' : 'truck') + '"></i></span><div><b>' + title + '</b><small>' + entries.length + ' ' + (entries.length === 1 ? 'тип' : 'поз.') + '</small></div></div><div class="report-shift-list">' + entries.map(function (entry) {
                var label = kind === 'workforce' ? entry.role : entry.name;
                var totalHours = Number(entry.count || 0) * Number(entry.hours || 0);
                var names = kind === 'workforce' && Array.isArray(entry.names) ? entry.names : [];
                return '<div class="report-shift-row"><div><strong>' + escapeHtml(label || 'Без названия') + '</strong><small>' + escapeHtml(entry.count || 0) + (kind === 'workforce' ? ' чел.' : ' ед.') + ' × ' + escapeHtml(finalSectionSummaryNumber(entry.hours || 0)) + ' ч</small>' + (names.length ? '<span class="report-shift-worker-names">' + names.map(function (name) { return '<em>' + escapeHtml(name) + '</em>'; }).join('') + '</span>' : '') + '</div><b>' + escapeHtml(finalSectionSummaryNumber(totalHours)) + '<span>' + (kind === 'workforce' ? ' чел.-ч' : ' маш.-ч') + '</span></b></div>';
            }).join('') + '</div></section>';
        }
        var namedWorkers = workforce.reduce(function (sum, entry) {
            return sum + (Array.isArray(entry.names) ? entry.names.length : 0);
        }, 0);
        return '<div class="report-shift-board">' +
            resourceGroup('workforce', 'Люди на смене', workforce) +
            resourceGroup('equipment', 'Техника на смене', equipmentEntries) +
            (namedWorkers ? '<div class="report-shift-document-action"><button class="ghost compact" type="button" data-report-worker-statement="' + escapeHtml(log.id) + '" data-project-id="' + escapeHtml(log.project_id) + '"><i data-lucide="file-signature" aria-hidden="true"></i>Ведомость на подпись</button><small>' + escapeHtml(namedWorkers) + ' работников</small></div>' : '') +
        '</div>';
    }

    function projectReportPhotosHtml(log) {
        var photos = Array.isArray(log && log.photos) ? log.photos : [];
        if (!photos.length) return '';
        return '<section class="report-entry-photos"><div class="report-entry-photos-head"><div><span class="report-entry-photos-icon" aria-hidden="true"><i data-lucide="images"></i></span><span><b>Фото с объекта</b><small>' + photos.length + ' ' + (photos.length === 1 ? 'снимок' : 'снимка') + '</small></span></div><span>Нажмите для просмотра</span></div><div class="report-photo-gallery">' + photos.map(function (photo, index) {
            var photoTitle = photo.title || ('Фото ' + (index + 1));
            return '<button type="button" class="report-photo-tile" data-report-photo-open data-report-photo-index="' + index + '" data-report-photo-url="' + escapeHtml(photo.view_url || '') + '" data-report-photo-title="' + escapeHtml(photoTitle) + '" aria-label="Открыть фото ' + (index + 1) + ' из ' + photos.length + ': ' + escapeHtml(photoTitle) + '"><img src="' + escapeHtml(photo.view_url || '') + '" alt="' + escapeHtml(photoTitle) + '" loading="lazy" decoding="async"><span aria-hidden="true"><i data-lucide="maximize-2"></i></span></button>';
        }).join('') + '</div></section>';
    }

    function closeProjectReportPhotoViewer(viewer) {
        if (!viewer) return;
        if (typeof viewer.close === 'function') viewer.close();
        else {
            viewer.removeAttribute('open');
            var opener = viewer._reportOpener;
            viewer._reportOpener = null;
            if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
        }
    }

    function ensureProjectReportPhotoViewer() {
        var viewer = qs('[data-report-photo-viewer]');
        if (viewer) return viewer;
        viewer = document.createElement('dialog');
        viewer.className = 'report-photo-viewer';
        viewer.setAttribute('data-report-photo-viewer', '');
        viewer.setAttribute('aria-modal', 'true');
        viewer.setAttribute('aria-labelledby', 'report-photo-viewer-title');
        viewer.innerHTML = '<div class="report-photo-viewer-shell"><div class="report-photo-viewer-head"><div><b id="report-photo-viewer-title" data-report-photo-viewer-title>Фото отчёта</b><small data-report-photo-viewer-count aria-live="polite"></small></div><button type="button" data-report-photo-viewer-close aria-label="Закрыть"><i data-lucide="x" aria-hidden="true"></i></button></div><div class="report-photo-viewer-stage"><button type="button" data-report-photo-viewer-prev aria-label="Предыдущее фото"><i data-lucide="chevron-left" aria-hidden="true"></i></button><img data-report-photo-viewer-image alt=""><button type="button" data-report-photo-viewer-next aria-label="Следующее фото"><i data-lucide="chevron-right" aria-hidden="true"></i></button></div></div>';
        document.body.appendChild(viewer);
        refreshLucideIcons(viewer);
        qs('[data-report-photo-viewer-close]', viewer).addEventListener('click', function () { closeProjectReportPhotoViewer(viewer); });
        qs('[data-report-photo-viewer-prev]', viewer).addEventListener('click', function () { showProjectReportViewerPhoto(viewer, Number(viewer._reportPhotoIndex || 0) - 1); });
        qs('[data-report-photo-viewer-next]', viewer).addEventListener('click', function () { showProjectReportViewerPhoto(viewer, Number(viewer._reportPhotoIndex || 0) + 1); });
        viewer.addEventListener('click', function (event) { if (event.target === viewer) closeProjectReportPhotoViewer(viewer); });
        viewer.addEventListener('close', function () {
            var opener = viewer._reportOpener;
            viewer._reportOpener = null;
            if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
        });
        viewer.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') showProjectReportViewerPhoto(viewer, Number(viewer._reportPhotoIndex || 0) - 1);
            if (event.key === 'ArrowRight') showProjectReportViewerPhoto(viewer, Number(viewer._reportPhotoIndex || 0) + 1);
            if (event.key === 'Escape' && typeof viewer.close !== 'function') closeProjectReportPhotoViewer(viewer);
        });
        return viewer;
    }

    function showProjectReportViewerPhoto(viewer, index) {
        var photos = Array.isArray(viewer && viewer._reportPhotos) ? viewer._reportPhotos : [];
        if (!viewer || !photos.length) return;
        index = (Number(index) + photos.length) % photos.length;
        viewer._reportPhotoIndex = index;
        var photo = photos[index];
        var image = qs('[data-report-photo-viewer-image]', viewer);
        var title = qs('[data-report-photo-viewer-title]', viewer);
        var count = qs('[data-report-photo-viewer-count]', viewer);
        if (image) {
            image.src = photo.url;
            image.alt = photo.title;
        }
        if (title) title.textContent = photo.title;
        if (count) count.textContent = (index + 1) + ' из ' + photos.length;
        var hasMany = photos.length > 1;
        var previous = qs('[data-report-photo-viewer-prev]', viewer);
        var next = qs('[data-report-photo-viewer-next]', viewer);
        if (previous) previous.hidden = !hasMany;
        if (next) next.hidden = !hasMany;
    }

    function bindProjectReportPhotoActions(root) {
        qsa('[data-report-photo-open]', root || document).forEach(function (button) {
            if (button.dataset.reportPhotoBound === '1') return;
            button.dataset.reportPhotoBound = '1';
            button.addEventListener('click', function () {
                var gallery = button.closest ? button.closest('.report-photo-gallery') : null;
                var photos = qsa('[data-report-photo-open]', gallery || root || document).map(function (item) {
                    return {
                        url: item.getAttribute('data-report-photo-url') || '',
                        title: item.getAttribute('data-report-photo-title') || 'Фото отчёта'
                    };
                }).filter(function (photo) { return !!photo.url; });
                if (!photos.length) return;
                var viewer = ensureProjectReportPhotoViewer();
                viewer._reportOpener = button;
                viewer._reportPhotos = photos;
                showProjectReportViewerPhoto(viewer, Number(button.getAttribute('data-report-photo-index') || 0));
                if (typeof viewer.showModal === 'function') {
                    if (!viewer.open) viewer.showModal();
                }
                else viewer.setAttribute('open', '');
            });
        });
    }

    function projectReportDetailsHtml(log) {
        var rows = [];
        if (log.equipment && !(Array.isArray(log.equipment_entries) && log.equipment_entries.length)) {
            rows.push('<div class="report-fact-row"><i data-lucide="truck"></i><div><span>Техника и поставки</span><strong>' + escapeHtml(log.equipment) + '</strong></div></div>');
        }
        return projectReportShiftHtml(log) + (rows.length ? '<div class="report-fact-list">' + rows.join('') + '</div>' : '') + projectReportPhotosHtml(log);
    }

    function projectReportMetaHtml(log) {
        var parts = [];
        if (Number(log.workers_count || 0) > 0) {
            parts.push('<span class="report-meta-chip"><i data-lucide="users"></i>' + escapeHtml(log.workers_count) + ' чел.</span>');
        }
        if (Number(log.worker_hours || 0) > 0) {
            parts.push('<span class="report-meta-chip"><i data-lucide="clock-3"></i>' + escapeHtml(finalSectionSummaryNumber(log.worker_hours)) + ' чел.-ч</span>');
        }
        if (Number(log.equipment_hours || 0) > 0) {
            parts.push('<span class="report-meta-chip"><i data-lucide="timer"></i>' + escapeHtml(finalSectionSummaryNumber(log.equipment_hours)) + ' маш.-ч</span>');
        }
        if (Array.isArray(log.photos) && log.photos.length) {
            parts.push('<span class="report-meta-chip"><i data-lucide="image"></i>' + escapeHtml(log.photos.length) + ' фото</span>');
        }
        parts.push('<span class="report-meta-chip"><i data-lucide="' + (Number(log.is_client_visible) === 1 ? 'eye' : 'lock-keyhole') + '"></i>' + (Number(log.is_client_visible) === 1 ? 'Виден заказчику' : 'Внутренний') + '</span>');
        return '<div class="report-entry-meta">' + parts.join('') + '</div>';
    }

    function projectReportSourceHtml(log) {
        if (projectReportEntryKind(log) === 'section-progress') return '';
        if (!log.raw_input || String(log.raw_input).trim() === String(log.work_done || '').trim()) return '';
        return '<details class="report-source-note"><summary>Исходная запись</summary><p>' + escapeHtml(log.raw_input) + '</p></details>';
    }

    function projectReportStoredNormalize(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^a-z\u0400-\u04ff0-9%]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function projectReportStoredPhraseParts(value) {
        return String(value || '')
            .split(/\n+|[!?;]+|\.(?!\d)/)
            .map(function (part) { return part.trim().replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim(); })
            .filter(Boolean);
    }

    function createProjectReportStoredPhraseDeduper(baseText) {
        var normalizedPhrases = projectReportStoredPhraseParts(baseText).map(projectReportStoredNormalize).filter(Boolean);
        return function (value) {
            var unique = [];
            projectReportStoredPhraseParts(value).forEach(function (phrase) {
                var normalizedPhrase = projectReportStoredNormalize(phrase);
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

    function projectReportStoredDocumentData(log) {
        var rows = { works: [], materials: [], additional: [], blockers: [], next: [] };
        var seen = {};
        var workDone = String(log && log.work_done || '').trim();

        function add(kind, title, detail) {
            title = String(title || '').trim().replace(/[.!?]+$/, '').trim();
            detail = String(detail || '').trim();
            if (!title) return;
            var key = kind + ':' + projectReportStoredNormalize(title + ' ' + detail);
            if (seen[key]) return;
            seen[key] = true;
            rows[kind].push({ title: title, detail: detail });
        }

        var labels = [
            { prefix: 'Частично выполнены', kind: 'works', detail: 'Частично выполнено' },
            { prefix: 'Дополнительно выполнено', kind: 'additional', detail: 'Дополнительная работа' },
            { prefix: 'Выполнены работы', kind: 'works', detail: 'Выполнено' },
            { prefix: 'По работам зафиксировано', kind: 'works', detail: 'Зафиксировано' },
            { prefix: 'Заказаны материалы', kind: 'materials', detail: 'Заказано' },
            { prefix: 'Приняты на объекте', kind: 'materials', detail: 'Принято' },
            { prefix: 'В работу/монтаж переданы', kind: 'materials', detail: 'Передано в работу' },
            { prefix: 'По материалам зафиксировано', kind: 'materials', detail: 'Зафиксировано' },
            { prefix: 'Заказано', kind: 'materials', detail: 'Заказ' },
            { prefix: 'Закуплено', kind: 'materials', detail: 'Покупка' },
            { prefix: 'Доставлено на объект', kind: 'materials', detail: 'Поставка' },
            { prefix: 'Проблемы и ограничения', kind: 'blockers', detail: 'Блокер' },
            { prefix: 'Следующий шаг', kind: 'next', detail: 'Следующий шаг' },
            { prefix: 'Дополнительно зафиксировано', kind: 'additional', detail: 'Дополнительно' }
        ];

        String(workDone || '').split(/\n+|[.!?]+\s+(?=[A-ZА-ЯЁ])/).map(function (part) {
            return part.trim();
        }).filter(Boolean).forEach(function (sentence) {
            var match = labels.find(function (entry) {
                return sentence.indexOf(entry.prefix + ':') === 0;
            });
            if (!match) return;
            String(sentence.slice(match.prefix.length + 1) || '').split(/\s*;\s*|,\s+(?=[A-Z\u0410-\u042f\u0401])/).forEach(function (part) {
                add(match.kind, part, match.detail);
            });
        });

        var uniqueSupplementalPhrases = createProjectReportStoredPhraseDeduper(workDone);
        var supplementalEntries = [
            { label: 'Проблемы и ограничения', value: log && log.blockers, kind: 'blockers', detail: 'Блокер' },
            { label: 'Следующий шаг', value: log && log.next_steps, kind: 'next', detail: 'Следующий шаг' }
        ].map(function (entry) {
            entry.phrases = uniqueSupplementalPhrases(entry.value);
            return entry;
        });
        supplementalEntries.forEach(function (entry) {
            entry.phrases.forEach(function (phrase) {
                add(entry.kind, phrase, entry.detail);
            });
        });

        var fullParts = workDone ? [workDone] : [];
        supplementalEntries.forEach(function (entry) {
            if (!entry.phrases.length) return;
            fullParts.push(entry.label + ': ' + entry.phrases.join('. ') + '.');
        });
        return { rows: rows, fullText: fullParts.join('\n\n') || 'Текст отчёта не указан' };
    }

    function projectReportDocumentHtml(log) {
        var documentData = projectReportStoredDocumentData(log);
        function group(kind, icon, title) {
            var rows = documentData.rows[kind] || [];
            if (!rows.length) return '';
            return '<section class="report-final-group is-' + kind + '" data-report-saved-section="' + kind + '" aria-label="' + escapeHtml(title) + '">' +
                '<div class="report-final-group-head"><span aria-hidden="true"><i data-lucide="' + icon + '"></i></span><div><b>' + escapeHtml(title) + '</b><small>' + rows.length + '</small></div></div>' +
                '<ul class="report-final-list">' + rows.map(function (row) {
                    return '<li><span class="report-final-row-copy"><b>' + escapeHtml(row.title) + '</b><small>' + escapeHtml(row.detail) + '</small></span></li>';
                }).join('') + '</ul>' +
            '</section>';
        }
        return '<section class="report-entry-document" data-report-saved-document aria-label="Содержание отчёта">' +
            '<section class="report-final-full" aria-label="Описание дня"><span><i data-lucide="align-left" aria-hidden="true"></i>Описание дня</span><p class="report-entry-full-copy">' + escapeHtml(documentData.fullText) + '</p></section>' +
            '<div class="report-final-groups">' +
                group('works', 'hammer', 'Работы') +
                group('materials', 'package-check', 'Материалы') +
                group('additional', 'sparkles', 'Доп. работы') +
                group('blockers', 'octagon-alert', 'Блокеры') +
                group('next', 'arrow-right', 'Следующий шаг') +
            '</div>' +
            projectReportAppliedActionsHtml(log) +
        '</section>';
    }

    function projectReportAppliedActionsHtml(log) {
        var actions = Array.isArray(log && log.applied_actions) ? log.applied_actions : [];
        if (!actions.length) return '';
        var labels = {
            material_purchase: 'Заказ материала',
            material_receipt: 'Приход материала',
            material_use: 'Расход материала',
            work_progress: 'Факт работы'
        };
        return '<details class="report-applied-actions"><summary><span><i data-lucide="clipboard-check" aria-hidden="true"></i><b>Учёт из отчёта</b></span><small>' + escapeHtml(actions.length) + '</small><i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="report-applied-action-list">' + actions.map(function (action) {
            var title = action.kind === 'work' ? action.workTitle : action.materialTitle;
            var reversed = !!action.isReversed;
            var canReverseUse = action.kind === 'material' && action.type === 'material_use' && !reversed && canApplyDailyReportMaterialActions();
            return '<div class="report-applied-action' + (reversed ? ' is-reversed' : '') + '"><span><b>' + escapeHtml(labels[action.type] || 'Учёт') + '</b><small>' + escapeHtml(title || 'Позиция') + ' · ' + escapeHtml(finalSectionSummaryNumber(action.qty || 0)) + ' ' + escapeHtml(action.unit || '') + '</small></span>' +
                (reversed ? '<em><i data-lucide="undo-2" aria-hidden="true"></i>Отменено</em>' : (canReverseUse ? '<button class="ghost compact" type="button" data-report-stock-move-reverse="' + escapeHtml(action.stockMoveId) + '" data-project-id="' + escapeHtml(log.project_id) + '" data-report-id="' + escapeHtml(log.id) + '"><i data-lucide="undo-2" aria-hidden="true"></i>Отменить расход</button>' : '<em>Учтено</em>')) +
            '</div>';
        }).join('') + '</div></details>';
    }

    function projectReportDateParts(isoDate) {
        var date = new Date(String(isoDate || APP_TODAY).slice(0, 10) + 'T00:00:00Z');
        if (isNaN(date.getTime())) return { day: '—', month: 'Без даты', year: '' };
        return {
            day: String(date.getUTCDate()).padStart(2, '0'),
            month: new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
            year: String(date.getUTCFullYear())
        };
    }

    function projectReportCountLabel(count) {
        count = Math.max(0, Number(count) || 0);
        var lastTwo = count % 100;
        var last = count % 10;
        if (lastTwo >= 11 && lastTwo <= 14) return count + ' записей';
        if (last === 1) return count + ' запись';
        if (last >= 2 && last <= 4) return count + ' записи';
        return count + ' записей';
    }

    function projectReportActionCountLabel(count) {
        count = Math.max(0, Number(count) || 0);
        var lastTwo = count % 100;
        var last = count % 10;
        if (lastTwo >= 11 && lastTwo <= 14) return count + ' действий';
        if (last === 1) return count + ' действие';
        if (last >= 2 && last <= 4) return count + ' действия';
        return count + ' действий';
    }

    function projectReportCalendarCountLabel(count) {
        count = Math.max(0, Number(count) || 0);
        var lastTwo = count % 100;
        var last = count % 10;
        if (lastTwo >= 11 && lastTwo <= 14) return count + ' отчетов';
        if (last === 1) return count + ' отчет';
        if (last >= 2 && last <= 4) return count + ' отчета';
        return count + ' отчетов';
    }

    function projectReportCalendarDayLabel(count) {
        count = Math.max(0, Number(count) || 0);
        var lastTwo = count % 100;
        var last = count % 10;
        if (lastTwo >= 11 && lastTwo <= 14) return count + ' дней';
        if (last === 1) return count + ' день';
        if (last >= 2 && last <= 4) return count + ' дня';
        return count + ' дней';
    }

    function projectReportCalendarMonthTitle(monthIso) {
        var title = formatRuMonthYear(monthIso);
        return title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
    }

    renderLogsStats = function (logs, notifications) {
        if (!projectReportsSurfaceRoot()) {
            return baseRenderLogsStatsForProjectReports(logs, notifications);
        }
        logs = projectReportFieldLogs(logs);
        var root = qs('[data-panel="reports"] [data-logs-stats]');
        if (!root) return;
        var uniqueDates = {};
        logs.forEach(function (log) { if (log.report_date) uniqueDates[log.report_date] = true; });
        var todayTime = projectReportDateTime(currentLocalDateIso());
        var recentDays = Object.keys(uniqueDates).filter(function (isoDate) {
            var diff = Math.round((todayTime - projectReportDateTime(isoDate)) / 86400000);
            return diff >= 0 && diff < 7;
        }).length;
        var latest = logs[0] || null;
        var photoCount = logs.reduce(function (sum, log) {
            return sum + (Array.isArray(log.photos) ? log.photos.length : 0);
        }, 0);
        var riskCount = logs.filter(function (log) { return String(log.blockers || '').trim(); }).length;
        var hasTodayReport = logs.some(function (log) { return log.report_date === currentLocalDateIso(); });
        root.innerHTML =
            projectReportMetric('files', 'Всего отчетов', String(logs.length), logs.length ? 'Вся история объекта' : 'История пока пуста') +
            projectReportMetric('calendar-check-2', 'Последняя фиксация', projectReportRelativeDate(latest && latest.report_date), latest ? finalGraphDate(latest.report_date) : 'Добавьте первый отчет', hasTodayReport ? 'success' : 'warning') +
            projectReportMetric('calendar-range', 'За 7 дней', recentDays + ' из 7', recentDays >= 5 ? 'Ритм ведения хороший' : 'Есть дни без фиксации', recentDays >= 5 ? 'success' : 'warning') +
            projectReportMetric(riskCount ? 'triangle-alert' : 'images', riskCount ? 'Отчёты с риском' : 'Фото в отчётах', riskCount ? String(riskCount) : String(photoCount), riskCount ? 'Проверьте отмеченные блокеры' : (photoCount ? 'Материалы по объекту' : 'Пока без фотографий'), riskCount ? 'danger' : 'accent');
        refreshLucideIcons(root);
    };

    renderLogsAlerts = function (notifications) {
        if (!projectReportsSurfaceRoot()) {
            return baseRenderLogsAlertsForProjectReports(notifications);
        }
        var root = qs('[data-panel="reports"] [data-logs-alerts]');
        if (!root) return;
        if (!notifications) {
            root.innerHTML = '';
            return;
        }
        var items = [];
        var missingDailyReport = Boolean(notifications.missingDailyReport);
        var selectedProjectId = Number(state.selectedProject && state.selectedProject.id || 0);
        if (canCreateProjectReport() && selectedProjectId && state.projectLogsByProject && Object.prototype.hasOwnProperty.call(state.projectLogsByProject, selectedProjectId)) {
            missingDailyReport = !projectReportFieldLogs(state.projectLogsByProject[selectedProjectId]).some(function (log) {
                return log.report_date === currentLocalDateIso();
            });
        }
        if (missingDailyReport) {
            items.push('<article class="report-attention-item is-warning"><span><i data-lucide="clock-3"></i></span><div><strong>Сегодня нет отчета</strong><small>Зафиксируйте факт дня, чтобы календарь объекта оставался актуальным.</small></div></article>');
        }
        if (notifications.blockerLogs && notifications.blockerLogs.length) {
            var latestBlocker = notifications.blockerLogs[0];
            items.push('<article class="report-attention-item is-danger"><span><i data-lucide="triangle-alert"></i></span><div><strong>Есть свежий блокер</strong><small>' + escapeHtml((latestBlocker.report_date ? finalGraphDate(latestBlocker.report_date) + ' · ' : '') + (latestBlocker.blockers || 'Описание не указано')) + '</small></div></article>');
        }
        if (notifications.overdueTasks && notifications.overdueTasks.length) {
            items.push('<article class="report-attention-item is-warning"><span><i data-lucide="list-todo"></i></span><div><strong>Просрочено задач: ' + escapeHtml(notifications.overdueTasks.length) + '</strong><small>Сверьте задачи с последним фактом работ и обновите план.</small></div></article>');
        }
        if (!items.length) {
            items.push('<article class="report-attention-item is-success"><span><i data-lucide="circle-check"></i></span><div><strong>По отчётности всё спокойно</strong><small>Свежих блокеров и просроченных задач не обнаружено.</small></div></article>');
        }
        root.innerHTML = '<div class="report-attention-list">' + items.join('') + '</div>';
        refreshLucideIcons(root);
    };

    // final project reports overrides
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
        return '<div class="project-reports-shell report-workspace">' +
            '<section class="report-workspace-hero">' +
                '<div class="report-workspace-heading">' +
                    '<span class="report-workspace-kicker"><i data-lucide="clipboard-check"></i>Журнал объекта</span>' +
                    '<h3>Дневной журнал</h3>' +
                    '<p>Факт работ по дням, прогресс и важные замечания по объекту «' + escapeHtml(project.title || 'Без названия') + '».</p>' +
                '</div>' +
            '</section>' +
            '<div data-logs-alerts></div>' +
            '<section class="report-kpi-grid" data-logs-stats aria-label="Сводка по отчётам"></section>' +
            '<section class="report-workspace-main">' +
                '<section class="report-pane report-selected-day-pane">' +
                    '<div data-logs-day-view><div class="report-day-loading" aria-hidden="true"></div></div>' +
                '</section>' +
                '<section class="report-pane report-calendar-pane">' +
                    '<div data-logs-calendar><div class="report-calendar-loading" aria-hidden="true"></div></div>' +
                '</section>' +
            '</section>' +
            '<section class="report-pane report-history-pane report-actions-pane">' +
                '<details class="report-actions-history" data-report-actions-history>' +
                    '<summary class="report-actions-history-toggle">' +
                        '<span class="report-actions-history-icon" aria-hidden="true"><i data-lucide="history"></i></span>' +
                        '<span class="report-actions-history-copy"><span class="report-pane-kicker">Хронология</span><strong>Последние действия</strong><small>Служебные отметки о выполнении и возврате работ.</small></span>' +
                        '<span class="report-history-count" data-report-action-count>0 действий</span>' +
                        '<span class="report-actions-history-chevron" aria-hidden="true"><i data-lucide="chevron-down"></i></span>' +
                    '</summary>' +
                    '<div class="report-actions-history-body"><div data-report-archive-list data-logs-list><div class="report-archive-empty"><b>Действий пока нет</b><span>Изменения по работам появятся здесь автоматически.</span></div></div></div>' +
                '</details>' +
            '</section>' +
            (canCreateProjectReport() ? '<div class="reports-drawer-host" data-project-report-create-card hidden>' + renderProjectReportForm(project) + '</div>' : '') +
        '</div>';
    };

    renderProjectReportForm = function (project) {
        if (!canCreateProjectReport()) return '';
        var selectedDate = state.logsSelectedDateByProject[Number(project.id)] || currentLocalDateIso();
        return '<section class="subsection report-intake-card report-chat-intake report-daily-form-card reports-drawer">' +
            '<header class="card-head report-form-head report-modal-header">' +
                '<div class="report-modal-heading">' +
                    '<span class="report-modal-title-icon" aria-hidden="true"><i data-lucide="notebook-pen"></i></span>' +
                    '<div class="report-modal-title-copy">' +
                        '<div class="report-drawer-caption"><span>Журнал объекта</span></div>' +
                        '<h3 id="project-report-modal-title">Отчёт за день</h3>' +
                        '<span class="muted">Надиктуйте события дня — система разложит данные по разделам отчёта.</span>' +
                        '<span class="report-modal-project">' + escapeHtml(project.title || 'Объект') + '</span>' +
                    '</div>' +
                '</div>' +
            '</header>' +
            '<div class="report-modal-scroll" data-report-modal-scroll>' +
            '<form class="project-form report-intake-form report-chat-form report-chat-simple-form report-daily-form" data-log-form data-report-draft-form novalidate>' +
                '<div class="report-draft-status" data-report-draft-status aria-live="polite">' +
                    '<button type="button" data-report-draft-clear hidden><i data-lucide="trash-2" aria-hidden="true"></i><span>Очистить</span></button>' +
                    '<span class="report-draft-status-dot" aria-hidden="true"></span>' +
                    '<span data-report-draft-status-text>Черновик будет сохраняться автоматически</span>' +
                '</div>' +
                '<input type="hidden" name="project_id" value="' + escapeHtml(project.id) + '">' +
                '<input type="hidden" name="title" value="">' +
                '<section class="report-form-section report-form-meta-section">' +
                    '<div class="report-form-section-head"><span class="report-section-icon" aria-hidden="true"><i data-lucide="calendar-days"></i></span><div><b>Дата и доступ</b><small>Укажите день и выберите, кто увидит отчет</small></div></div>' +
                    '<div class="report-chat-header report-chat-header-compact">' +
                        '<label><span class="report-compact-field-label"><i data-lucide="calendar-days" aria-hidden="true"></i>Дата отчета</span><input name="report_date" type="date" value="' + escapeHtml(selectedDate) + '" required></label>' +
                        '<label><span class="report-compact-field-label"><i data-lucide="eye" aria-hidden="true"></i>Кому доступен</span><select name="is_client_visible"><option value="1">Заказчику и команде</option><option value="0">Только команде</option></select></label>' +
                    '</div>' +
                '</section>' +
                '<section class="report-form-section report-form-main-section">' +
                    '<div class="report-form-section-head"><span class="report-section-icon" aria-hidden="true"><i data-lucide="message-square-text"></i></span><div><b>Расскажите, что произошло</b><small>Работы, заказы, поставки и проблемы — одной фразой</small></div><span class="report-section-required">Обязательно</span></div>' +
                    '<label class="report-chat-inputbox report-daily-textarea-field">' +
                        '<textarea name="raw_input" rows="6" required aria-label="Опишите, что произошло" placeholder="Например: завершили демонтаж перегородок, приняли кабель, монтаж розеток выполнен наполовину. Ждём согласование щита."></textarea>' +
                        '<small class="report-field-hint">Нажмите «Диктовать» или пишите свободно. Пример: «Заказал дверные ручки, привезли кабель 40 м»</small>' +
                    '</label>' +
                    '<div class="report-live-assist" data-report-live-assist aria-live="polite" hidden></div>' +
                '</section>' +
                '<section class="report-form-section report-resources-section">' +
                    '<div class="report-form-section-head"><span class="report-section-icon" aria-hidden="true"><i data-lucide="users-round"></i></span><div><b>Состав смены</b><small>Добавьте каждую специальность и технику отдельно</small></div></div>' +
                    '<div class="report-resource-grid">' +
                        '<article class="report-resource-card is-workforce">' +
                            '<div class="report-resource-head"><span class="report-resource-symbol" aria-hidden="true"><i data-lucide="hard-hat"></i></span><div><b>Люди на смене</b><small>Количество и часы на человека</small></div><div class="report-resource-total"><strong data-report-resource-total="workforce">0</strong><span>чел.</span><small data-report-resource-hours-total="workforce">0 чел.-ч</small></div></div>' +
                            '<div class="report-resource-list" data-report-resource-list="workforce"></div>' +
                            '<div class="report-resource-card-actions"><button class="report-resource-add" type="button" data-report-resource-add="workforce"><span aria-hidden="true"><i data-lucide="plus"></i></span>Добавить людей</button><button class="report-resource-repeat" type="button" data-report-repeat-last-shift><span aria-hidden="true"><i data-lucide="history"></i></span>Повторить прошлую смену</button></div>' +
                            '<label class="report-visually-hidden"><span>Всего людей</span><input name="workers_count" type="number" min="0" step="1" value="0" readonly tabindex="-1"></label>' +
                        '</article>' +
                        '<article class="report-resource-card is-equipment">' +
                            '<div class="report-resource-head"><span class="report-resource-symbol" aria-hidden="true"><i data-lucide="truck"></i></span><div><b>Техника на смене</b><small>Единицы и фактические часы</small></div><div class="report-resource-total"><strong data-report-resource-total="equipment">0</strong><span>ед.</span><small data-report-resource-hours-total="equipment">0 машино-ч</small></div></div>' +
                            '<div class="report-resource-list" data-report-resource-list="equipment"></div>' +
                            '<button class="report-resource-add" type="button" data-report-resource-add="equipment"><span aria-hidden="true"><i data-lucide="plus"></i></span>Добавить технику</button>' +
                            '<input name="equipment" type="hidden" value="">' +
                        '</article>' +
                    '</div>' +
                    '<datalist id="report-workforce-types"><option value="Разнорабочие"><option value="Электрики"><option value="Сантехники"><option value="Монтажники"><option value="Отделочники"><option value="Маляры"><option value="Плиточники"><option value="Сварщики"></datalist>' +
                    '<datalist id="report-equipment-types"><option value="Экскаватор"><option value="Манипулятор"><option value="Автовышка"><option value="Погрузчик"><option value="Компрессор"><option value="Бетононасос"><option value="Кран"></datalist>' +
                '</section>' +
                '<section class="report-form-section report-photos-section">' +
                    '<div class="report-form-section-head"><span class="report-section-icon" aria-hidden="true"><i data-lucide="images"></i></span><div><b>Фотографии</b><small>До 8 снимков — размер уменьшим автоматически</small></div></div>' +
                    '<label class="report-photo-picker"><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-report-photo-input><span class="report-photo-picker-icon" aria-hidden="true"><i data-lucide="image-plus"></i></span><span class="report-photo-picker-copy"><b>Добавить фотографии</b><small>Снимки с объекта или фото с телефона</small></span><span class="report-photo-picker-action"><i data-lucide="upload" aria-hidden="true"></i><span>Выбрать</span></span></label>' +
                    '<div class="report-photo-drafts" data-report-photo-list></div>' +
                '</section>' +
                '<details class="report-extra-fields">' +
                    '<summary><span class="report-extra-summary-icon" aria-hidden="true"><i data-lucide="route"></i></span><span><b>Блокеры и следующий шаг</b><small>Необязательно · что мешает и что делать дальше</small></span><span class="report-extra-chevron" aria-hidden="true"><i data-lucide="chevron-down"></i></span></summary>' +
                    '<div class="report-extra-grid">' +
                        '<label class="wide"><span class="report-compact-field-label"><i data-lucide="octagon-alert" aria-hidden="true"></i>Блокеры</span><textarea name="blockers" rows="1" placeholder="Что мешает продолжать работы"></textarea></label>' +
                        '<label class="wide"><span class="report-compact-field-label"><i data-lucide="arrow-right" aria-hidden="true"></i>Следующий шаг</span><input name="next_steps" placeholder="Что команда делает дальше"></label>' +
                    '</div>' +
                '</details>' +
                '<section class="report-ready-card" data-report-review hidden>' +
                    '<div class="report-action-staging" data-report-preview></div>' +
                    '<section class="report-final-message" data-report-final-document aria-labelledby="report-final-message-title">' +
                        '<div class="report-final-message-head"><span class="report-final-message-label" id="report-final-message-title"><i data-lucide="file-check-2" aria-hidden="true"></i>Готовый отчёт</span><small>Обновляется по мере заполнения</small></div>' +
                        '<div class="report-final-summary" data-report-final-summary></div>' +
                        '<section class="report-final-full" data-report-final-section="full-text" aria-label="Описание дня">' +
                            '<div class="report-final-text-head"><span><i data-lucide="align-left" aria-hidden="true"></i>Описание дня</span><button type="button" data-report-text-regenerate><i data-lucide="rotate-ccw" aria-hidden="true"></i>Вернуть исходный текст</button></div>' +
                            '<textarea name="work_done" rows="5" required data-report-final-text data-report-manual="0" aria-label="Описание дня"></textarea>' +
                            '<small class="report-final-text-hint">Это ваш текст. Работы, материалы и количества ниже не будут его переписывать.</small>' +
                        '</section>' +
                        '<div class="report-final-groups" data-report-final-groups></div>' +
                        '<div class="report-final-shift" data-report-final-shift></div>' +
                        '<div class="report-final-photos" data-report-final-photos></div>' +
                    '</section>' +
                '</section>' +
                '<div class="form-error" data-log-error role="alert" aria-atomic="true"></div>' +
                '<div class="report-intake-actions">' +
                    '<small>Работы и материалы будут учтены при сохранении отчёта.</small>' +
                    '<span class="report-submit-group"><button class="ghost report-only-button" type="submit" data-report-only-submit><span>Только отчёт</span></button><button class="primary report-submit-button" type="submit"><span>Сохранить и учесть</span></button></span>' +
                '</div>' +
            '</form>' +
            '<div class="report-clear-dialog" data-report-clear-dialog role="presentation" aria-hidden="true" hidden>' +
                '<section class="report-clear-dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="report-clear-dialog-title" aria-describedby="report-clear-dialog-copy">' +
                    '<span class="report-clear-dialog-icon" aria-hidden="true"><i data-lucide="trash-2"></i></span>' +
                    '<div class="report-clear-dialog-copy"><h4 id="report-clear-dialog-title">Очистить черновик?</h4><p id="report-clear-dialog-copy">Удалятся текст, выбранные работы и материалы, состав смены и фотографии.</p></div>' +
                    '<div class="report-clear-dialog-actions"><button class="ghost" type="button" data-report-draft-clear-cancel>Оставить черновик</button><button class="danger" type="button" data-report-draft-clear-confirm>Очистить</button></div>' +
                '</section>' +
            '</div>' +
            '</div>' +
        '</section>';
    };

    function bindProjectReportsCalendar(project, logs) {
        var projectId = Number(project.id);
        var scope = qs('[data-panel="reports"]');
        if (!scope) return;
        qsa('[data-log-date]', scope).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                state.logsSelectedDateByProject[projectId] = button.dataset.logDate;
                state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(button.dataset.logDate);
                var form = qs('[data-log-form]');
                if (form && form.report_date) {
                    form.dataset.reportDateTouched = '1';
                    form.report_date.value = button.dataset.logDate;
                    form.report_date.dispatchEvent(new Event('change', { bubbles: true }));
                }
                renderLogsCalendar(project, logs);
            });
        });
        qsa('[data-log-month-shift]', scope).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var current = state.logsCalendarMonthByProject[projectId] || logsMonthStartIso(currentLocalDateIso());
                var date = new Date(current + 'T00:00:00Z');
                date.setUTCMonth(date.getUTCMonth() + Number(button.dataset.logMonthShift || 0));
                state.logsCalendarMonthByProject[projectId] = date.toISOString().slice(0, 10);
                renderLogsCalendar(project, logs);
            });
        });
        var todayButton = qs('[data-report-calendar-today]', scope);
        if (todayButton && todayButton.dataset.bound !== '1') {
            todayButton.dataset.bound = '1';
            todayButton.addEventListener('click', function () {
                var todayIso = currentLocalDateIso();
                state.logsSelectedDateByProject[projectId] = todayIso;
                state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(todayIso);
                var form = qs('[data-log-form]');
                if (form && form.report_date) {
                    form.dataset.reportDateTouched = '0';
                    form.report_date.value = todayIso;
                    form.report_date.dispatchEvent(new Event('change', { bubbles: true }));
                }
                renderLogsCalendar(project, logs);
            });
        }
        var createButton = qs('[data-report-create-selected]', scope);
        if (createButton && createButton.dataset.bound !== '1') {
            createButton.dataset.bound = '1';
            createButton.addEventListener('click', function () {
                var drawer = ensureProjectReportDrawer();
                if (drawer) {
                    openSideDrawer(drawer);
                    setTimeout(function () {
                        var firstField = qs('textarea[name="raw_input"]', drawer);
                        if (firstField) firstField.focus();
                    }, 80);
                }
            });
        }
    }

    renderLogsCalendar = function (project, logs) {
        if (!projectReportsSurfaceRoot()) {
            return baseRenderLogsCalendarForProjectReports(project, logs);
        }
        var root = qs('[data-panel="reports"] [data-logs-calendar]');
        if (!root || !project) return;
        logs = projectReportFieldLogs(logs);
        var projectId = Number(project.id);
        var todayIso = currentLocalDateIso();
        var selectedDate = state.logsSelectedDateByProject[projectId] || projectReportDefaultSelectedDate(logs, project.started_at || todayIso);
        if (!state.logsCalendarMonthByProject[projectId]) state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(selectedDate);
        var monthIso = state.logsCalendarMonthByProject[projectId];
        var monthDate = new Date(monthIso + 'T00:00:00Z');
        var monthIndex = monthDate.getUTCMonth();
        var firstWeekday = (monthDate.getUTCDay() + 6) % 7;
        var cursor = new Date(monthDate.getTime());
        cursor.setUTCDate(cursor.getUTCDate() - firstWeekday);
        var byDate = {};
        logs.forEach(function (log) {
            if (!log.report_date) return;
            byDate[log.report_date] = byDate[log.report_date] || [];
            byDate[log.report_date].push(log);
        });
        var monthKey = monthIso.slice(0, 7);
        var monthLogs = logs.filter(function (log) { return String(log.report_date || '').slice(0, 7) === monthKey; });
        var monthReportDates = {};
        var monthRiskDates = {};
        monthLogs.forEach(function (log) {
            monthReportDates[log.report_date] = true;
            if (String(log.blockers || '').trim()) monthRiskDates[log.report_date] = true;
        });
        var reportDaysCount = Object.keys(monthReportDates).length;
        var riskDaysCount = Object.keys(monthRiskDates).length;
        var monthSummary = monthLogs.length
            ? projectReportCalendarCountLabel(monthLogs.length) + ' за ' + projectReportCalendarDayLabel(reportDaysCount)
            : 'В этом месяце отчетов нет';
        if (riskDaysCount) monthSummary += ' · ' + projectReportCalendarDayLabel(riskDaysCount) + ' с блокером';
        var dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        var cells = [];
        for (var index = 0; index < 42; index += 1) {
            var isoDate = cursor.toISOString().slice(0, 10);
            var dayLogs = byDate[isoDate] || [];
            var hasRisk = dayLogs.some(function (log) { return String(log.blockers || '').trim(); });
            var isOutside = cursor.getUTCMonth() !== monthIndex;
            var classes = ['report-calendar-day'];
            if (isOutside) classes.push('is-outside');
            if (index % 7 >= 5) classes.push('is-weekend');
            if (isoDate === todayIso) classes.push('is-today');
            if (dayLogs.length) classes.push('has-report');
            if (hasRisk) classes.push('has-risk');
            if (selectedDate === isoDate) classes.push('is-selected');
            var reportCountLabel = projectReportCalendarCountLabel(dayLogs.length);
            var label = formatRuDate(isoDate) + (dayLogs.length ? (', ' + reportCountLabel) : ', отчетов нет') + (hasRisk ? ', есть блокер' : '');
            var statusHtml = dayLogs.length
                ? '<span class="report-calendar-report-count"><i aria-hidden="true"></i><span>' + escapeHtml(reportCountLabel) + '</span></span>'
                : '';
            if (hasRisk) statusHtml += '<span class="report-calendar-risk"><i aria-hidden="true"></i><span>Блокер</span></span>';
            cells.push('<button class="' + classes.join(' ') + '" type="button" data-log-date="' + isoDate + '" aria-label="' + escapeHtml(label) + '" aria-pressed="' + (selectedDate === isoDate ? 'true' : 'false') + '"' + (isoDate === todayIso ? ' aria-current="date"' : '') + '>' +
                '<span class="report-calendar-day-top"><strong>' + cursor.getUTCDate() + '</strong></span>' +
                '<span class="report-calendar-day-status">' + statusHtml + '</span>' +
            '</button>');
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        root.innerHTML = '<div class="report-calendar-card">' +
            '<div class="report-calendar-toolbar">' +
                '<div class="report-calendar-month-copy" aria-live="polite"><strong>' + escapeHtml(projectReportCalendarMonthTitle(monthIso)) + '</strong><span>' + escapeHtml(monthSummary) + '</span></div>' +
                '<div class="report-calendar-controls" aria-label="Навигация по календарю">' +
                    '<button class="ghost report-calendar-nav" type="button" data-log-month-shift="-1" aria-label="Предыдущий месяц"><span class="report-calendar-nav-mark" aria-hidden="true">‹</span></button>' +
                    '<button class="ghost compact report-calendar-today" type="button" data-report-calendar-today>Сегодня</button>' +
                    '<button class="ghost report-calendar-nav" type="button" data-log-month-shift="1" aria-label="Следующий месяц"><span class="report-calendar-nav-mark" aria-hidden="true">›</span></button>' +
                '</div>' +
            '</div>' +
            '<div class="report-calendar-grid report-calendar-weekdays" aria-hidden="true">' + dayLabels.map(function (dayLabel, dayIndex) { return '<span' + (dayIndex >= 5 ? ' class="is-weekend"' : '') + '>' + dayLabel + '</span>'; }).join('') + '</div>' +
            '<div class="report-calendar-grid report-calendar-days">' + cells.join('') + '</div>' +
        '</div>';
        renderLogsDayView(project, logs);
        bindProjectReportsCalendar(project, logs);
    };

    renderLogsDayView = function (project, logs) {
        if (!projectReportsSurfaceRoot()) {
            return baseRenderLogsDayViewForProjectReports(project, logs);
        }
        var root = qs('[data-panel="reports"] [data-logs-day-view]');
        if (!root || !project) return;
        logs = projectReportFieldLogs(logs);
        var projectId = Number(project.id);
        var todayIso = currentLocalDateIso();
        var selectedDate = state.logsSelectedDateByProject[projectId] || projectReportDefaultSelectedDate(logs, todayIso);
        var selectedLogs = logs.filter(function (log) { return log.report_date === selectedDate; });
        var isToday = selectedDate === todayIso;
        var heading = '<div class="report-selected-day-head"><div><span class="report-pane-kicker">Выбранный день</span><h3>' + escapeHtml(formatRuDate(selectedDate)) + '</h3></div><span class="report-day-count' + (selectedLogs.length ? ' has-value' : '') + '" aria-label="Отчетов за день: ' + selectedLogs.length + '">' + selectedLogs.length + '</span></div>';
        if (!selectedLogs.length) {
            root.innerHTML = heading + '<div class="report-selected-day-empty"><span class="report-empty-icon"><i data-lucide="calendar-plus"></i></span><strong>' + (isToday ? 'Сегодня отчета ещё нет' : 'За этот день отчёта нет') + '</strong><p>' + (canCreateProjectReport() ? 'Можно сразу создать отчет — выбранная дата уже подставлена в форму.' : 'Выберите другую дату в календаре, чтобы открыть сохранённый отчет.') + '</p>' +
                (canCreateProjectReport() && !isToday ? '<button class="ghost compact" type="button" data-report-create-selected><i data-lucide="plus"></i><span>Создать за эту дату</span></button>' : '') + '</div>';
            refreshLucideIcons(root);
            return;
        }
        root.innerHTML = heading + '<div class="report-selected-day-list">' + selectedLogs.map(function (log) {
            var authorName = log.author_name || 'Без автора';
            var status = reportLogStatus(log);
            var entryKind = projectReportEntryKind(log);
            return '<article class="report-day-entry is-' + entryKind + (status.kind === 'danger' ? ' is-danger' : '') + '" data-report-entry-kind="' + entryKind + '">' +
                '<div class="report-day-entry-head"><div class="report-author-block"><span class="report-author-avatar">' + escapeHtml(reportAuthorInitials(authorName)) + '</span><div><strong>' + escapeHtml(authorName) + '</strong><small>' + escapeHtml(reportCreatedDateTime(log)) + '</small></div></div><div class="report-entry-actions">' + projectReportEntryTypeHtml(log) + projectReportStatusHtml(log, status) + renderProjectReportEditButton(projectId, log, true) + renderProjectReportDeleteButton(projectId, log, true) + '</div></div>' +
                projectReportDocumentHtml(log) +
                projectReportMetaHtml(log) + projectReportDetailsHtml(log) + projectReportSourceHtml(log) +
            '</article>';
        }).join('') + '</div>';
        bindProjectReportDeleteActions();
        bindProjectReportPhotoActions(root);
        refreshLucideIcons(root);
    };

    renderLogsList = function (project, logs) {
        if (!projectReportsSurfaceRoot()) {
            return baseRenderLogsListForProjectReports(project, logs);
        }
        var root = qs('[data-panel="reports"] [data-logs-list]');
        if (!root) return;
        logs = projectReportActionLogs(logs);
        var count = qs('[data-report-action-count]');
        if (count) count.textContent = projectReportActionCountLabel(logs.length);
        if (!logs.length) {
            safeReplaceChildren(root, '<div class="report-archive-empty"><span class="report-empty-icon"><i data-lucide="list-checks"></i></span><b>Действий пока нет</b><span>Отметки о выполнении и возврате работ по объекту «' + escapeHtml(project && project.title ? project.title : 'Объект') + '» появятся здесь автоматически.</span></div>');
            refreshLucideIcons(root);
            return;
        }
        var groups = [];
        logs.forEach(function (log) {
            var key = String(log.report_date || '').slice(0, 7) || 'no-date';
            var group = groups.find(function (item) { return item.key === key; });
            if (!group) {
                group = { key: key, label: key === 'no-date' ? 'Без даты' : formatRuMonthYear(key + '-01'), logs: [] };
                groups.push(group);
            }
            group.logs.push(log);
        });
        safeReplaceChildren(root, '<div class="report-history-groups">' + groups.map(function (group) {
            return '<section class="report-history-group"><div class="report-history-month"><strong>' + escapeHtml(group.label) + '</strong><span>' + group.logs.length + '</span></div><div class="report-archive-list">' + group.logs.map(function (log) {
                var authorName = log.author_name || 'Без автора';
                var status = reportLogStatus(log);
                var dateParts = projectReportDateParts(log.report_date);
                var entryKind = projectReportEntryKind(log);
                return '<article class="report-history-entry is-' + entryKind + (status.kind === 'danger' ? ' is-danger' : '') + '" data-report-entry-kind="' + entryKind + '">' +
                    '<div class="report-history-date"><strong>' + escapeHtml(dateParts.day) + '</strong><span>' + escapeHtml(dateParts.month) + '</span><small>' + escapeHtml(dateParts.year) + '</small></div>' +
                    '<div class="report-history-content">' +
                        '<div class="report-history-entry-head"><div class="report-author-inline"><span class="report-author-avatar">' + escapeHtml(reportAuthorInitials(authorName)) + '</span><div><strong>' + escapeHtml(authorName) + '</strong><small>' + escapeHtml(reportCreatedDateTime(log)) + '</small></div></div><div class="report-entry-actions">' + projectReportEntryTypeHtml(log) + projectReportStatusHtml(log, status) + renderProjectReportEditButton(project && project.id, log, true) + renderProjectReportDeleteButton(project && project.id, log, true) + '</div></div>' +
                        projectReportDocumentHtml(log) +
                        projectReportMetaHtml(log) + projectReportDetailsHtml(log) + projectReportSourceHtml(log) +
                    '</div>' +
                '</article>';
            }).join('') + '</div></section>';
        }).join('') + '</div>');
        bindProjectReportDeleteActions();
        bindProjectReportPhotoActions(root);
        refreshLucideIcons(root);
    };

    PMBI.operations = PMBI.operations || {};
        if (typeof loadRoles === 'function') PMBI.operations.loadRoles = loadRoles;
        if (typeof roleOptionLabel === 'function') PMBI.operations.roleOptionLabel = roleOptionLabel;
        if (typeof syncUserRoleOptions === 'function') PMBI.operations.syncUserRoleOptions = syncUserRoleOptions;
        if (typeof initUsersPage === 'function') PMBI.operations.initUsersPage = initUsersPage;
        if (typeof initTeamPage === 'function') PMBI.operations.initTeamPage = initTeamPage;
        if (typeof bindLockedUserCreateForm === 'function') PMBI.operations.bindLockedUserCreateForm = bindLockedUserCreateForm;
        if (typeof formatUserPhone === 'function') PMBI.operations.formatUserPhone = formatUserPhone;
        if (typeof isCompleteUserPhone === 'function') PMBI.operations.isCompleteUserPhone = isCompleteUserPhone;
        if (typeof isValidUserEmail === 'function') PMBI.operations.isValidUserEmail = isValidUserEmail;
        if (typeof bindUserPhoneMask === 'function') PMBI.operations.bindUserPhoneMask = bindUserPhoneMask;
        if (typeof setupCompanyCreateModal === 'function') PMBI.operations.setupCompanyCreateModal = setupCompanyCreateModal;
        if (typeof resetCompanyCreateForm === 'function') PMBI.operations.resetCompanyCreateForm = resetCompanyCreateForm;
        if (typeof closeCompanyCreateModal === 'function') PMBI.operations.closeCompanyCreateModal = closeCompanyCreateModal;
        if (typeof createUserCreateForm === 'function') PMBI.operations.createUserCreateForm = createUserCreateForm;
        if (typeof setupUserCreateModal === 'function') PMBI.operations.setupUserCreateModal = setupUserCreateModal;
        if (typeof renderUserProjectAccessChecks === 'function') PMBI.operations.renderUserProjectAccessChecks = renderUserProjectAccessChecks;
        if (typeof loadUsers === 'function') PMBI.operations.loadUsers = loadUsers;
        if (typeof startTeamAutoRefresh === 'function') PMBI.operations.startTeamAutoRefresh = startTeamAutoRefresh;
        if (typeof renderUserCard === 'function') PMBI.operations.renderUserCard = renderUserCard;
        if (typeof renderTeamGroups === 'function') PMBI.operations.renderTeamGroups = renderTeamGroups;
        if (typeof openEmployeeProfile === 'function') PMBI.operations.openEmployeeProfile = openEmployeeProfile;
        if (typeof closeEmployeeProfileModal === 'function') PMBI.operations.closeEmployeeProfileModal = closeEmployeeProfileModal;
        if (typeof openEmployeeEditForm === 'function') PMBI.operations.openEmployeeEditForm = openEmployeeEditForm;
        if (typeof initReportsPage === 'function') PMBI.operations.initReportsPage = initReportsPage;
        if (typeof collectDirectorReportData === 'function') PMBI.operations.collectDirectorReportData = collectDirectorReportData;
        if (typeof renderReportsFocus === 'function') PMBI.operations.renderReportsFocus = renderReportsFocus;
        if (typeof renderReportsStats === 'function') PMBI.operations.renderReportsStats = renderReportsStats;
        if (typeof renderReportsCritical === 'function') PMBI.operations.renderReportsCritical = renderReportsCritical;
        if (typeof renderReportsNarrative === 'function') PMBI.operations.renderReportsNarrative = renderReportsNarrative;
        if (typeof renderLogsPage === 'function') PMBI.operations.renderLogsPage = renderLogsPage;
        if (typeof renderLogsStats === 'function') PMBI.operations.renderLogsStats = renderLogsStats;
        if (typeof renderLogsAlerts === 'function') PMBI.operations.renderLogsAlerts = renderLogsAlerts;
        if (typeof renderLogsCalendar === 'function') PMBI.operations.renderLogsCalendar = renderLogsCalendar;
        if (typeof renderLogsDayView === 'function') PMBI.operations.renderLogsDayView = renderLogsDayView;
        if (typeof renderLogsList === 'function') PMBI.operations.renderLogsList = renderLogsList;
        if (typeof renderProjectReportDeleteButton === 'function') PMBI.operations.renderProjectReportDeleteButton = renderProjectReportDeleteButton;
        if (typeof bindProjectReportDeleteActions === 'function') PMBI.operations.bindProjectReportDeleteActions = bindProjectReportDeleteActions;
        if (typeof bindLogForm === 'function') PMBI.operations.bindLogForm = bindLogForm;
        if (typeof flushReportDrafts === 'function') PMBI.operations.flushReportDrafts = flushReportDrafts;
        if (typeof disposeReportDrafts === 'function') PMBI.operations.disposeReportDrafts = disposeReportDrafts;
        if (typeof openProfileModal === 'function') PMBI.operations.openProfileModal = openProfileModal;
        if (typeof toggleAiAssistantDrawer === 'function') PMBI.operations.toggleAiAssistantDrawer = toggleAiAssistantDrawer;
        if (typeof initAiAssistant === 'function') PMBI.operations.initAiAssistant = initAiAssistant;
        if (typeof canCreateProjectReport === 'function') PMBI.operations.canCreateProjectReport = canCreateProjectReport;
        if (typeof bindProjectReportAssistantActions === 'function') PMBI.operations.bindProjectReportAssistantActions = bindProjectReportAssistantActions;
        if (typeof bindProjectOverviewActions === 'function') PMBI.operations.bindProjectOverviewActions = bindProjectOverviewActions;
        if (typeof bindProjectCreate === 'function') PMBI.operations.bindProjectCreate = bindProjectCreate;
        if (typeof ensureProjectEditCard === 'function') PMBI.operations.ensureProjectEditCard = ensureProjectEditCard;
        if (typeof openProjectEdit === 'function') PMBI.operations.openProjectEdit = openProjectEdit;
        if (typeof bindProjectEditForm === 'function') PMBI.operations.bindProjectEditForm = bindProjectEditForm;
        if (typeof getProjectTabMode === 'function') PMBI.operations.getProjectTabMode = getProjectTabMode;
        if (typeof setProjectTabMode === 'function') PMBI.operations.setProjectTabMode = setProjectTabMode;
        if (typeof ensureProjectReportDrawer === 'function') PMBI.operations.ensureProjectReportDrawer = ensureProjectReportDrawer;
        if (typeof renderProjectReportForm === 'function') PMBI.operations.renderProjectReportForm = renderProjectReportForm;
        if (typeof renderProjectReportsPanel === 'function') PMBI.operations.renderProjectReportsPanel = renderProjectReportsPanel;
        if (typeof refreshProjectReportsTab === 'function') PMBI.operations.refreshProjectReportsTab = refreshProjectReportsTab;
        if (typeof ensureRoleCreateModal === 'function') PMBI.operations.ensureRoleCreateModal = ensureRoleCreateModal;
        if (typeof openRoleCreateModal === 'function') PMBI.operations.openRoleCreateModal = openRoleCreateModal;
        if (typeof closeRoleCreateModal === 'function') PMBI.operations.closeRoleCreateModal = closeRoleCreateModal;
        if (typeof rolePermissionsFromForm === 'function') PMBI.operations.rolePermissionsFromForm = rolePermissionsFromForm;
        if (typeof submitRoleCreateForm === 'function') PMBI.operations.submitRoleCreateForm = submitRoleCreateForm;
    window.PMBI = PMBI;
})();
