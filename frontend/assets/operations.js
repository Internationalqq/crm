(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    var page = PMBI.page;
    var APP_TODAY = PMBI.APP_TODAY;
    var state = PMBI.state;
    var qs = PMBI.qs;
    var qsa = PMBI.qsa;
    var safeReplaceChildren = PMBI.safeReplaceChildren;
    var refreshLucideIcons = PMBI.refreshLucideIcons;
    var showAppNotice = PMBI.showAppNotice;
    var appErrorMessage = PMBI.appErrorMessage;
    var withSubmitLock = PMBI.withSubmitLock;
    var escapeHtml = PMBI.escapeHtml;
    var formatDisplayDate = PMBI.formatDisplayDate;
    var formatRuDate = PMBI.formatRuDate;
    var api = PMBI.api;
    var apiFormData = PMBI.apiFormData;
    var money = PMBI.money;
    var percent = PMBI.percent;
    var normalizeRole = PMBI.normalizeRole;
    var hasRole = PMBI.hasRole;
    var canManageTeam = PMBI.canManageTeam;
    var canViewPrivateContacts = PMBI.canViewPrivateContacts;
    var canManageDailyTasks = PMBI.canManageDailyTasks;
    var canManageSuppliers = PMBI.canManageSuppliers;
    var canSeeFinances = PMBI.canSeeFinances;
    var currentRoleLabel = PMBI.currentRoleLabel;
    var personDisplayName = PMBI.personDisplayName;
    var effectiveUserRoles = PMBI.effectiveUserRoles;
    var isClerkEnabled = PMBI.isClerkEnabled;
    var userInitials = PMBI.userInitials;
    var safeTelHref = PMBI.safeTelHref;

    function appCall(name, args) {
        var fn = PMBI.app && PMBI.app[name];
        if (typeof fn !== 'function') {
            throw new Error('PMBI.app.' + name + ' is not available');
        }
        return fn.apply(null, args);
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
    function selectedProject() { return appCall('selectedProject', arguments); }
    function setSelectedProject() { return appCall('setSelectedProject', arguments); }
    function updateProjectInState() { return appCall('updateProjectInState', arguments); }
    function updateProjectCache() { return appCall('updateProjectCache', arguments); }
    function openProject() { return appCall('openProject', arguments); }
    function activateProjectTab() { return appCall('activateProjectTab', arguments); }
    function stat() { return appCall('stat', arguments); }
    function statusLabel() { return appCall('statusLabel', arguments); }
    function beginProjectLoading() { return appCall('beginProjectLoading', arguments); }
    function isCurrentProject() { return appCall('isCurrentProject', arguments); }
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
    function topbarAvatarInner() { return appCall('topbarAvatarInner', arguments); }
    function forceTopbarAvatar() { return appCall('forceTopbarAvatar', arguments); }
    function initReminderBell() { return appCall('initReminderBell', arguments); }
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
    function formatRuMonthYear() { return appCall('formatRuMonthYear', arguments); }
    function bindLogsCalendar() { return appCall('bindLogsCalendar', arguments); }
    function buildProjectReportDraft() { return appCall('buildProjectReportDraft', arguments); }
    function bindReportPreview() { return appCall('bindReportPreview', arguments); }
    function bindReportVoiceInputs() { return appCall('bindReportVoiceInputs', arguments); }
    function reportAuthorInitials() { return appCall('reportAuthorInitials', arguments); }
    function reportCreatedDateTime() { return appCall('reportCreatedDateTime', arguments); }
    function reportLogStatus() { return appCall('reportLogStatus', arguments); }
    function renderProjectReportDeleteButton() { return appCall('renderProjectReportDeleteButton', arguments); }
    function bindProjectReportDeleteActions() { return appCall('bindProjectReportDeleteActions', arguments); }
    function initTeamPage() { return initUsersPage.apply(null, arguments); }
    // roles helpers
    function loadRoles(callback) {
        if (state.roles.length) {
            syncUserRoleOptions();
            if (callback) callback(state.roles);
            return;
        }
        api('/api/roles').then(function (data) {
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
            return normalizeRole(role && role.code) !== 'admin';
        });
        if (!roles.length) roles = [{ code: 'foreman', name: 'Прораб' }];
        safeReplaceChildren(select, roles.map(function (role) {
            var code = normalizeRole(role.code);
            return '<option value="' + escapeHtml(code) + '"' + (String(selected) === String(code) ? ' selected' : '') + '>' + escapeHtml(roleOptionLabel(role)) + '</option>';
        }).join(''));
    }

    // team users reports shell
    function initUsersPage() {
        qsa('[data-user-create-open]').forEach(function (button) {
            button.hidden = !canManageTeam();
        });
        if (canManageTeam()) setupUserCreateModal();
        loadUsers();
        loadProjects(function () {
            renderUserProjectAccessChecks();
            loadUsers();
        });
        startTeamAutoRefresh();
        var refresh = qs('[data-users-refresh]');
        if (refresh) refresh.addEventListener('click', loadUsers);
        var form = qs('[data-user-create-form]');
        if (!form) return;
        if (!canManageTeam()) return;
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
            var endpoint = '/api/users/manage';
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
            if (!canManageTeam()) {
                showAppNotice('Доступ разрешен только Главному Админу', 'error');
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
                return '<div class="user-row"><div><b>' + escapeHtml(user.name) + '</b><small>' + escapeHtml(contacts) + '</small></div><div class="badge-list">' + roleBadges + '</div></div>';
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
        if (page !== 'users' || state.teamRefreshTimer) return;
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
        var roles = effectiveUserRoles(user);
        var roleBadges = roles.map(function (role) {
            return '<span class="employee-role-badge' + userRoleClass(role) + '">' + escapeHtml(userRoleLabel(role)) + '</span>';
        }).join('');
        var avatar = user.avatarUrl ? '<img src="' + escapeHtml(user.avatarUrl) + '" alt="">' : escapeHtml(userInitials(user));
        return '<article class="employee-card" data-employee-card data-user-id="' + escapeHtml(user.id || '') + '">' +
            '<div class="employee-card-top">' +
                '<div class="employee-avatar" aria-hidden="true">' + avatar + '</div>' +
                '<div class="employee-main"><h3>' + escapeHtml(personDisplayName(user) || 'Сотрудник') + '</h3><div class="employee-role-list">' + roleBadges + '</div></div>' +
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
        var projects = userAssignedProjects(user);
        var projectsHtml = projects.length ? projects.map(function (project) {
            var projectId = project && (project.id || project.project_id || project.projectId);
            var title = project && (project.title || project.name || project.projectTitle) || ('#' + projectId);
            return '<a class="employee-profile-project" href="/app/projects?openProject=' + encodeURIComponent(projectId || '') + '">' + escapeHtml(title) + '</a>';
        }).join('') : '<span class="employee-project-empty">\u041e\u0431\u044a\u0435\u043a\u0442\u044b \u043d\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u044b</span>';
        var deleteButton = canDeleteEmployeeAccounts()
            ? '<button class="employee-profile-delete" type="button" data-employee-delete data-user-id="' + escapeHtml(user.id || '') + '"><i data-lucide="trash-2"></i><span>\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430</span></button>'
            : '';
        var editButton = canManageTeam()
            ? '<button class="ghost" type="button" data-employee-profile-edit data-user-id="' + escapeHtml(user.id || '') + '"><i data-lucide="pencil"></i><span>\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c</span></button>'
            : '';
        return '<div class="employee-profile-card">' +
            '<button class="ghost compact employee-profile-close" type="button" data-employee-profile-close>\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>' +
            '<div class="employee-profile-head">' +
                '<div class="employee-profile-avatar" aria-hidden="true">' + escapeHtml(userInitials(user)) + '</div>' +
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
        var name = personDisplayName(user) || user.login || '\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430';
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

    function employeeGroupKey(user) {
        var roles = effectiveUserRoles(user);
        var codes = roles.map(function (role) { return normalizeRole(role && role.code || role); });
        var labels = roles.map(function (role) { return String(userRoleLabel(role)).toLowerCase(); });
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
        if (!options.silent) safeReplaceChildren(root, '');
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

    var baseEnsureProjectReportDrawerUx = ensureProjectReportDrawer;

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
        var overviewScheduleSummary = state.sectionScheduleByProject && project && project.id ? state.sectionScheduleByProject[project.id] : null;
        var overviewDeadline = String(project.deadline_at || project.deadline || (overviewScheduleSummary && overviewScheduleSummary.finishDate) || '').trim();
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
                dataItem('Старт', project.started_at ? formatDisplayDate(project.started_at) : '—') +
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
        if (page === 'dashboard') initDashboardPage();
        if (page === 'daily_tasks') initDailyTasksPage();
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
        if (page === 'users') initUsersPage();
        if (page === 'companies') initCompaniesPage();
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
            state.currentUser = data.user;
            if (typeof renderAppTopbar === 'function') renderAppTopbar();
            syncCurrentUserHeader(data.user);
            forceTopbarAvatar(data.user);
            setTimeout(function () { forceTopbarAvatar(data.user); }, 80);
            setTimeout(function () { forceTopbarAvatar(data.user); }, 350);
            renderUser();
            applyRole();
            refreshLucideIcons(document);
            initPage();
            checkDailyStandup();
        }).catch(function () {
            location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
        });

        var logout = qs('[data-logout]');
        if (logout && logout.dataset.bound !== '1') {
            logout.dataset.bound = '1';
            logout.addEventListener('click', function () {
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
        forceTopbarAvatar(user);
        refreshLucideIcons(document);
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

    // logs archive stats hook
    var baseRenderLogsStatsForArchive = renderLogsStats;
    renderLogsStats = function (logs, notifications) {
        baseRenderLogsStatsForArchive(logs, notifications);
        if (qsa('[data-report-archive-list]').length) {
            renderLogsList(state.selectedProject || {}, logs);
        }
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
        if (typeof bindLogForm === 'function') PMBI.operations.bindLogForm = bindLogForm;
        if (typeof openProfileModal === 'function') PMBI.operations.openProfileModal = openProfileModal;
        if (typeof toggleAiAssistantDrawer === 'function') PMBI.operations.toggleAiAssistantDrawer = toggleAiAssistantDrawer;
        if (typeof initAiAssistant === 'function') PMBI.operations.initAiAssistant = initAiAssistant;
        if (typeof canCreateProjectReport === 'function') PMBI.operations.canCreateProjectReport = canCreateProjectReport;
        if (typeof bindProjectReportAssistantActions === 'function') PMBI.operations.bindProjectReportAssistantActions = bindProjectReportAssistantActions;
        if (typeof bindProjectOverviewActions === 'function') PMBI.operations.bindProjectOverviewActions = bindProjectOverviewActions;
        if (typeof ensureProjectEditCard === 'function') PMBI.operations.ensureProjectEditCard = ensureProjectEditCard;
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
