(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    var page = PMBI.page;
    function currentPage() { return PMBI.page || page; }
    var state = PMBI.state;
    var qs = PMBI.qs;
    var qsa = PMBI.qsa;
    var safeReplaceChildren = PMBI.safeReplaceChildren;
    var refreshLucideIcons = PMBI.refreshLucideIcons;
    var showAppNotice = PMBI.showAppNotice;
    var appErrorMessage = PMBI.appErrorMessage;
    var withSubmitLock = PMBI.withSubmitLock;
    var escapeHtml = PMBI.escapeHtml;
    var safeAvatarUrl = PMBI.safeAvatarUrl;
    var profileUserInitials = PMBI.profileUserInitials;
    var personDisplayName = PMBI.personDisplayName;
    var normalizeRole = PMBI.normalizeRole;
    var hasRole = PMBI.hasRole;
    var canManageDailyTasks = PMBI.canManageDailyTasks;
    var formatDisplayDate = PMBI.formatDisplayDate;
    var api = PMBI.api;
    function dailyTaskStatusLabel(status) {
        return {
            planned: 'План на сегодня',
            in_progress: 'В процессе',
            done: 'Выполнено',
            archived: 'Архив'
        }[status] || 'План на сегодня';
    }

    function dailyTaskColumns() {
        return [
            { status: 'planned', title: 'План на сегодня', icon: 'list-todo' },
            { status: 'in_progress', title: 'В процессе', icon: 'loader-circle' },
            { status: 'done', title: 'Выполнено', icon: 'badge-check' }
        ];
    }

    function dailyTaskTime(value) {
        if (!value) return '';
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            var match = String(value).match(/T(\d{2}):(\d{2})/);
            return match ? match[1] + ':' + match[2] : '';
        }
        return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }

    function dailyTaskUserName(task) {
        if (task.userName) return task.userName;
        var match = dailyTaskUsers().filter(function (user) {
            return Number(user.id) === Number(task.userId);
        })[0];
        return match ? match.name : '';
    }

    function dailyTaskVisibleUsers() {
        return dailyTaskUsers().filter(function (user) {
            var role = normalizeRole(user.role);
            return role !== 'customer' && role !== 'client';
        });
    }

    function renderDailyTaskProgress(tasks) {
        var root = qs('[data-daily-progress]');
        if (!root) return;
        var total = tasks.length;
        var done = tasks.filter(function (task) { return task.status === 'done'; }).length;
        var active = tasks.filter(function (task) { return task.status === 'in_progress'; }).length;
        var percentValue = total ? Math.round((done / total) * 100) : 0;
        safeReplaceChildren(root,
            '<span><b>' + done + '/' + total + '</b> выполнено</span>' +
            '<span><b>' + active + '</b> в процессе</span>' +
            '<span class="daily-task-progress-bar"><i style="width:' + percentValue + '%"></i></span>'
        );
    }

    function renderDailyTaskCard(task) {
        var completedTime = task.completedAt ? dailyTaskTime(task.completedAt) : '';
        var userName = dailyTaskUserName(task);
        var issuedByManager = dailyTaskIssuedByManager(task);
        return '<article class="daily-task-card" data-daily-task-card data-daily-task-id="' + escapeHtml(task.id) + '" data-daily-task-status="' + escapeHtml(task.status) + '">' +
            '<div class="daily-task-card-top">' +
                '<span class="daily-task-pill">' + escapeHtml(dailyTaskStatusLabel(task.status)) + '</span>' +
                '<button class="daily-task-icon-btn" type="button" data-daily-task-archive title="Отправить в архив" aria-label="Отправить в архив"><i data-lucide="archive"></i></button>' +
            '</div>' +
            '<p class="daily-task-text">' + escapeHtml(task.text) + '</p>' +
            '<div class="daily-task-meta">' +
                (canManageDailyTasks() ? '<span><i data-lucide="user-round"></i>' + escapeHtml(userName || 'Сотрудник') + '</span>' : '') +
                (issuedByManager ? '<span class="daily-director-badge">Выдано руководителем</span>' : '') +
                '<span><i data-lucide="calendar"></i>' + escapeHtml(formatDisplayDate(task.date)) + '</span>' +
                (completedTime ? '<span class="daily-task-done-time"><i data-lucide="clock"></i>Выполнено в ' + escapeHtml(completedTime) + '</span>' : '') +
            '</div>' +
        '</article>';
    }

    function renderDailyTaskBoard(tasks) {
        var root = qs('[data-daily-board]');
        if (!root) return;
        var html = dailyTaskColumns().map(function (column) {
            var items = tasks.filter(function (task) { return task.status === column.status; });
            return '<section class="daily-task-column" data-daily-drop-list data-daily-status="' + escapeHtml(column.status) + '">' +
                '<div class="daily-task-column-head">' +
                    '<h3><i data-lucide="' + escapeHtml(column.icon) + '"></i><span>' + escapeHtml(column.title) + '</span></h3>' +
                    '<b>' + items.length + '</b>' +
                '</div>' +
                '<div class="daily-task-list">' + (items.length ? items.map(renderDailyTaskCard).join('') : '<div class="daily-task-empty">Задач нет</div>') + '</div>' +
            '</section>';
        }).join('');
        safeReplaceChildren(root, html);
        renderDailyTaskProgress(tasks);
        refreshLucideIcons(root);
        initDailyTaskDragAndDrop();
    }

    function renderDailyTaskArchive(tasks) {
        var root = qs('[data-daily-archive-list]');
        if (!root) return;
        if (!tasks.length) {
            safeReplaceChildren(root, '<div class="daily-task-empty archive-empty">Архив пока пуст</div>');
            return;
        }
        safeReplaceChildren(root, '<div class="daily-task-archive-list">' + tasks.map(function (task) {
            var doneTime = task.completedAt ? dailyTaskTime(task.completedAt) : '';
            return '<article class="daily-task-archive-row">' +
                '<div><strong>' + escapeHtml(task.text) + '</strong><small>' + escapeHtml(dailyTaskUserName(task) || 'Сотрудник') + ' · ' + escapeHtml(formatDisplayDate(task.date)) + '</small></div>' +
                '<span class="daily-task-pill">' + escapeHtml(task.status === 'archived' ? 'Отменено' : (doneTime ? 'Выполнено в ' + doneTime : 'Выполнено')) + '</span>' +
            '</article>';
        }).join('') + '</div>');
        refreshLucideIcons(root);
    }

    function dailyTaskQuery(archive) {
        var params = new URLSearchParams();
        if (archive) params.set('archive', '1');
        if (canManageDailyTasks() && state.dailySelectedUserId && state.dailySelectedUserId !== 'all') {
            params.set('userId', state.dailySelectedUserId);
        }
        var query = params.toString();
        return '/api/daily-tasks' + (query ? '?' + query : '');
    }

    function loadDailyTasks() {
        return api(dailyTaskQuery(false)).then(function (data) {
            state.dailyTasks = Array.isArray(data.tasks) ? data.tasks : [];
            renderDailyTaskBoard(state.dailyTasks);
        }).catch(function (error) {
            showAppNotice(appErrorMessage(error, 'Не удалось загрузить задачи сотрудников.'), 'error');
        });
    }

    function loadDailyArchive() {
        return api(dailyTaskQuery(true)).then(function (data) {
            state.dailyArchive = Array.isArray(data.tasks) ? data.tasks : [];
            renderDailyTaskArchive(state.dailyArchive);
        }).catch(function (error) {
            showAppNotice(appErrorMessage(error, 'Не удалось загрузить архив задач.'), 'error');
        });
    }

    function updateDailyTask(taskId, payload) {
        return api('/api/daily-tasks/' + encodeURIComponent(taskId) + '/update', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    function syncDailyTaskDropLists() {
        qsa('[data-daily-drop-list]').forEach(function (column) {
            var list = qs('.daily-task-list', column);
            var cards = qsa('[data-daily-task-card]', list);
            var empty = qs('.daily-task-empty', list);
            if (!cards.length && !empty) {
                empty = document.createElement('div');
                empty.className = 'daily-task-empty';
                empty.textContent = 'Задач нет';
                list.appendChild(empty);
            }
            if (empty) empty.hidden = cards.length > 0;
            var count = qs('.daily-task-column-head b', column);
            if (count) count.textContent = String(cards.length);
        });
    }

    function initDailyTaskDragAndDrop() {
        if (!window.Sortable) {
            if (window.console) console.warn('SortableJS не загружен: перетаскивание задач сотрудников отключено.');
            return;
        }
        qsa('[data-daily-drop-list] .daily-task-list').forEach(function (list) {
            if (list.dataset.sortableBound === '1') return;
            list.dataset.sortableBound = '1';
            window.Sortable.create(list, {
                group: 'daily-tasks',
                animation: 150,
                invertSwap: true,
                swapThreshold: 0.22,
                draggable: '[data-daily-task-card]',
                handle: '[data-daily-task-card]',
                filter: 'button, input, select, textarea, option, p, span, strong, small, .daily-task-text, .daily-task-meta',
                preventOnFilter: false,
                ghostClass: 'daily-sortable-ghost',
                chosenClass: 'daily-sortable-chosen',
                dragClass: 'daily-sortable-drag',
                fallbackClass: 'daily-sortable-drag',
                forceFallback: true,
                fallbackOnBody: true,
                emptyInsertThreshold: 24,
                onChoose: function (event) {
                    qsa('.daily-task-list').forEach(function (dropList) { dropList.classList.add('is-drop-ready'); });
                    if (event.item) event.item.classList.add('is-daily-dragging-source');
                },
                onUnchoose: function (event) {
                    qsa('.daily-task-list').forEach(function (dropList) { dropList.classList.remove('is-drop-ready', 'is-drag-over'); });
                    if (event.item) event.item.classList.remove('is-daily-dragging-source');
                },
                onMove: function (event) {
                    qsa('.daily-task-list').forEach(function (dropList) {
                        dropList.classList.toggle('is-drag-over', dropList === event.to);
                    });
                    return true;
                },
                onEnd: function (event) {
                    qsa('.daily-task-list').forEach(function (dropList) { dropList.classList.remove('is-drop-ready', 'is-drag-over'); });
                    syncDailyTaskDropLists();
                    var card = event.item;
                    var targetColumn = event.to ? event.to.closest('[data-daily-drop-list]') : null;
                    var status = targetColumn ? targetColumn.dataset.dailyStatus : '';
                    var previousStatus = card ? card.dataset.dailyTaskStatus : '';
                    if (!card || !status || status === previousStatus) return;
                    card.classList.add('is-daily-saving');
                    updateDailyTask(card.dataset.dailyTaskId, {
                        status: status,
                        text: qs('.daily-task-text', card) ? qs('.daily-task-text', card).textContent : ''
                    }).then(function () {
                        return loadDailyTasks();
                    }).catch(function (error) {
                        showAppNotice(appErrorMessage(error, 'Не удалось перенести задачу.'), 'error');
                        loadDailyTasks();
                    });
                }
            });
        });
    }

    function renderDailyUserFilter() {
        var tools = qs('[data-daily-director-tools]');
        var select = qs('[data-daily-user-filter]');
        if (!tools || !select) return;
        tools.hidden = !canManageDailyTasks();
        if (!canManageDailyTasks()) return;
        var options = '<option value="all">Все сотрудники</option>' + dailyTaskVisibleUsers().map(function (user) {
            return '<option value="' + escapeHtml(user.id) + '"' + (String(state.dailySelectedUserId) === String(user.id) ? ' selected' : '') + '>' + escapeHtml(personDisplayName(user) || user.login) + '</option>';
        }).join('');
        safeReplaceChildren(select, options);
        if (select.dataset.bound !== '1') {
            select.dataset.bound = '1';
            select.addEventListener('change', function () {
                state.dailySelectedUserId = select.value || 'all';
                loadDailyTasks();
                if (!qs('[data-daily-archive]').hidden) loadDailyArchive();
            });
        }
    }

    function ensureDailyQuickModal() {
        var modal = qs('[data-daily-quick-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'daily-standup-modal';
        modal.setAttribute('data-daily-quick-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<button class="daily-standup-backdrop" type="button" data-daily-quick-close aria-label="Закрыть"></button>' +
            '<section class="daily-standup-dialog" role="dialog" aria-modal="true" aria-label="Новая задача">' +
                '<div class="daily-standup-head"><div><span class="section-label">Новая задача</span><h3>Добавить в план</h3></div><button class="ghost compact" type="button" data-daily-quick-close>Закрыть</button></div>' +
                '<form data-daily-quick-form><textarea name="text" rows="5" placeholder="Каждая строка станет отдельной задачей"></textarea><div class="daily-standup-actions"><button class="primary" type="submit">Добавить</button></div></form>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-daily-quick-close]')) modal.hidden = true;
        });
        qs('[data-daily-quick-form]', modal).addEventListener('submit', function (event) {
            event.preventDefault();
            var form = event.currentTarget;
            withSubmitLock(form, function () {
                return api('/api/daily-tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        text: form.text.value,
                        userId: canManageDailyTasks() && state.dailySelectedUserId !== 'all' ? state.dailySelectedUserId : undefined
                    })
                }).then(function () {
                    form.reset();
                    modal.hidden = true;
                    loadDailyTasks();
                });
            }).catch(function (error) {
                showAppNotice(appErrorMessage(error, 'Не удалось добавить задачу.'), 'error');
            });
        });
        document.body.appendChild(modal);
        return modal;
    }

    function openDailyQuickModal() {
        var modal = ensureDailyQuickModal();
        modal.hidden = false;
        var textarea = qs('textarea', modal);
        if (textarea) textarea.focus();
        refreshLucideIcons(modal);
    }

    function dailyStandupDateKey(date) {
        var value = date || new Date();
        var year = value.getFullYear();
        var month = String(value.getMonth() + 1).padStart(2, '0');
        var day = String(value.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function dailyStandupStorageKey() {
        var userId = state.user && state.user.id ? String(state.user.id) : 'anonymous';
        return 'last_standup_date_' + userId;
    }

    function dailyStandupCanCheckNow() {
        var now = new Date();
        if (now.getHours() < 8) return false;
        try {
            var today = dailyStandupDateKey(now);
            return window.localStorage.getItem(dailyStandupStorageKey()) !== today;
        } catch (error) {
            return true;
        }
    }

    function markDailyStandupDone(date) {
        try {
            var value = date || dailyStandupDateKey();
            window.localStorage.setItem(dailyStandupStorageKey(), value);
            if (window.localStorage.getItem('last_standup_date') === value) {
                window.localStorage.removeItem('last_standup_date');
            }
        } catch (error) {}
    }

    function dailyStandupNewTasks(modal) {
        return qsa('[data-daily-standup-new-task]', modal).map(function (node) {
            return (node.textContent || '').trim();
        }).filter(Boolean);
    }

    function renderDailyStandupNewTasks(modal, tasks) {
        var list = qs('[data-daily-standup-new-list]', modal);
        if (!list) return;
        if (!tasks.length) {
            safeReplaceChildren(list, '');
            list.hidden = true;
            return;
        }
        list.hidden = false;
        safeReplaceChildren(list, tasks.map(function (task) {
            return '<button class="daily-standup-new-task" type="button" data-daily-standup-new-task title="Убрать задачу">' + escapeHtml(task) + '</button>';
        }).join(''));
    }

    function addDailyStandupNewTask(modal, rawText) {
        if (!modal) return;
        var textarea = qs('[data-daily-standup-new-textarea]', modal);
        var value = typeof rawText === 'string' ? rawText.trim() : String(textarea && textarea.value || '').trim();
        if (!value) return;
        var tasks = dailyStandupNewTasks(modal);
        value.split(/\r?\n|;/).map(function (item) { return item.trim(); }).filter(Boolean).forEach(function (item) {
            tasks.push(item);
        });
        if (textarea) textarea.value = '';
        renderDailyStandupNewTasks(modal, tasks);
        if (textarea) textarea.focus();
    }

    function closeDailyStandupModal(modal) {
        if (!modal) return;
        modal.classList.add('is-closing');
        setTimeout(function () {
            if (modal.parentNode) modal.parentNode.removeChild(modal);
        }, 180);
    }

    function ensureDailyStandupModal(data) {
        var modal = qs('[data-daily-standup-modal]');
        if (modal) modal.remove();
        data = data || {};
        var carryover = Array.isArray(data.carryover) ? data.carryover : [];
        modal = document.createElement('div');
        modal.className = 'daily-standup-modal is-open';
        modal.setAttribute('data-daily-standup-modal', '');
        modal.innerHTML =
            '<div class="daily-standup-backdrop"></div>' +
            '<section class="daily-standup-dialog" role="dialog" aria-modal="true" aria-label="План на сегодня">' +
                '<div class="daily-standup-head"><h3>План на сегодня 🚀</h3></div>' +
                '<div class="daily-standup-block">' +
                    '<strong>Осталось сделать</strong>' +
                    (carryover.length ? '<div class="daily-carryover-list">' + carryover.map(function (task) {
                    return '<article class="daily-carryover-item" data-carryover-id="' + escapeHtml(task.id) + '" data-carryover-action="transfer">' +
                        '<p>' + escapeHtml(task.text) + '</p>' +
                        '<small>' + escapeHtml(formatDisplayDate(task.date)) + '</small>' +
                    '</article>';
                }).join('') + '</div>' : '<div class="daily-standup-empty">Незавершённых задач нет</div>') +
                '</div>' +
                '<form data-daily-standup-form>' +
                    '<div class="daily-standup-block">' +
                        '<strong>Добавить новые задачи</strong>' +
                        '<div class="daily-standup-new-row">' +
                            '<textarea data-daily-standup-new-textarea rows="5" placeholder="Каждая строка станет отдельной задачей"></textarea>' +
                            '<button class="ghost compact" type="button" data-daily-standup-new-add>Добавить</button>' +
                        '</div>' +
                        '<div class="daily-standup-new-list" data-daily-standup-new-list hidden></div>' +
                    '</div>' +
                    '<div class="daily-standup-actions"><button class="primary" type="submit">Начать рабочий день</button></div>' +
                '</form>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-daily-standup-new-add]')) {
                addDailyStandupNewTask(modal);
                return;
            }
            var newTask = event.target.closest('[data-daily-standup-new-task]');
            if (newTask) {
                var tasks = dailyStandupNewTasks(modal).filter(function (task) {
                    return task !== (newTask.textContent || '').trim();
                });
                renderDailyStandupNewTasks(modal, tasks);
            }
        });
        qs('[data-daily-standup-form]', modal).addEventListener('submit', function (event) {
            event.preventDefault();
            var form = event.currentTarget;
            var actions = qsa('[data-carryover-id]', modal).map(function (item) {
                return { id: item.dataset.carryoverId, action: item.dataset.carryoverAction || 'transfer' };
            });
            var textarea = qs('[data-daily-standup-new-textarea]', modal);
            if (textarea && String(textarea.value || '').trim()) addDailyStandupNewTask(modal);
            var tasks = dailyStandupNewTasks(modal);
            withSubmitLock(form, function () {
                return api('/api/daily-tasks/standup', {
                    method: 'POST',
                    body: JSON.stringify({ tasks: tasks, carryover: actions })
                }).then(function (response) {
                    markDailyStandupDone(response && response.today ? response.today : dailyStandupDateKey());
                    closeDailyStandupModal(modal);
                    if (currentPage() === 'daily_tasks') loadDailyTasks();
                });
            }).catch(function (error) {
                showAppNotice(appErrorMessage(error, 'Не удалось сохранить утренний стендап.'), 'error');
            });
        });
        document.body.appendChild(modal);
        var textarea = qs('[data-daily-standup-new-textarea]', modal);
        if (textarea) textarea.focus();
        refreshLucideIcons(modal);
        return modal;
    }

    function checkDailyStandup() {
        if (hasRole('admin')) return;
        if (hasRole('customer') || hasRole('client')) return;
        if (!dailyStandupCanCheckNow()) return;
        api('/api/daily-tasks/standup', { silentLoader: true }).then(function (data) {
            if (data && data.shouldShow) {
                ensureDailyStandupModal(data);
            } else if (data && data.today) {
                markDailyStandupDone(data.today);
            }
        }).catch(function () {});
    }

    function initDailyTasksPage() {
        var quick = qs('[data-daily-quick-add]');
        if (quick && quick.dataset.bound !== '1') {
            quick.dataset.bound = '1';
            quick.addEventListener('click', openDailyQuickModal);
        }
        var archive = qs('[data-daily-archive]');
        var archiveToggle = qs('[data-daily-archive-toggle]');
        if (archiveToggle && archiveToggle.dataset.bound !== '1') {
            archiveToggle.dataset.bound = '1';
            archiveToggle.addEventListener('click', function () {
                if (!archive) return;
                archive.hidden = !archive.hidden;
                if (!archive.hidden) loadDailyArchive();
            });
        }
        var archiveRefresh = qs('[data-daily-archive-refresh]');
        if (archiveRefresh && archiveRefresh.dataset.bound !== '1') {
            archiveRefresh.dataset.bound = '1';
            archiveRefresh.addEventListener('click', loadDailyArchive);
        }
        document.addEventListener('click', function (event) {
            var button = event.target.closest('[data-daily-task-archive]');
            if (!button) return;
            var card = button.closest('[data-daily-task-card]');
            if (!card) return;
            event.preventDefault();
            updateDailyTask(card.dataset.dailyTaskId, {
                status: 'archived',
                text: qs('.daily-task-text', card) ? qs('.daily-task-text', card).textContent : ''
            }).then(function () {
                loadDailyTasks();
                if (archive && !archive.hidden) loadDailyArchive();
            }).catch(function (error) {
                showAppNotice(appErrorMessage(error, 'Не удалось отправить задачу в архив.'), 'error');
            });
        });
        if (canManageDailyTasks()) {
            loadUserDirectory(function () {
                renderDailyUserFilter();
                loadDailyTasks();
            });
        } else {
            renderDailyUserFilter();
            loadDailyTasks();
        }
    }

    function dailyTaskUserById(userId) {
        return dailyTaskUsers().filter(function (user) {
            return Number(user.id) === Number(userId);
        })[0] || null;
    }

    function normalizeDailyUser(user) {
        user = user || {};
        var name = String(personDisplayName(user) || user.fullName || user.login || 'Сотрудник').trim();
        return {
            id: Number(user.id) || 0,
            name: name || 'Сотрудник',
            displayName: name || 'Сотрудник',
            firstName: user.firstName || user.first_name || '',
            lastName: user.lastName || user.last_name || '',
            avatar: safeAvatarUrl(user.avatar || user.avatarUrl || user.avatar_url || user.userAvatarUrl) || '',
            role: normalizeRole(user.role || 'employee')
        };
    }

    function dailyTaskUsers() {
        return (state.users || []).map(normalizeDailyUser).filter(function (user) {
            return user.id > 0;
        });
    }

    function dailyPersonAvatar(user, className) {
        user = normalizeDailyUser(user);
        className = className || '';
        if (user.avatar) {
            return '<span class="daily-person-avatar ' + escapeHtml(className) + '" aria-hidden="true"><img src="' + escapeHtml(user.avatar) + '" alt=""></span>';
        }
        return '<span class="daily-person-avatar ' + escapeHtml(className) + '" aria-hidden="true">' + escapeHtml(profileUserInitials({ name: user.name })) + '</span>';
    }

    function dailyAvatar(user, label, className) {
        user = normalizeDailyUser(user);
        label = label || user.name || 'Сотрудник';
        className = className || '';
        if (user.avatar) {
            return '<span class="daily-avatar ' + escapeHtml(className) + '" title="' + escapeHtml(label) + '"><img src="' + escapeHtml(user.avatar) + '" alt=""></span>';
        }
        return '<span class="daily-avatar ' + escapeHtml(className) + '" title="' + escapeHtml(label) + '">' + escapeHtml(profileUserInitials({ name: label })) + '</span>';
    }

    function dailyTaskAssignee(task) {
        return dailyTaskUserById(task.userId) || normalizeDailyUser({
            id: task.userId,
            name: task.userName || 'Сотрудник',
            avatar: task.userAvatar || task.userAvatarUrl || ''
        });
    }

    function dailyTaskCreator(task) {
        return dailyTaskUserById(task.createdBy) || normalizeDailyUser({
            id: task.createdBy,
            name: task.creatorName || 'Директор',
            role: task.creatorRole || '',
            avatar: task.creatorAvatar || task.creatorAvatarUrl || ''
        });
    }

    function dailyTaskIsDone(task) {
        return task && task.status === 'done';
    }

    function dailyTaskCanComplete(task) {
        return task && state.user && String(task.userId) === String(state.user.id);
    }

    function dailyTaskCanManage(task) {
        return !!(task && (canManageDailyTasks() || dailyTaskCanComplete(task)));
    }

    function dailyTaskStatusAction(task) {
        if (!dailyTaskCanComplete(task)) return null;
        if (task.status === 'planned') return { status: 'in_progress', label: 'В работу' };
        if (task.status === 'in_progress') return { status: 'planned', label: 'Снять с работы' };
        return null;
    }

    function dailyTaskIssuedByManager(task) {
        if (!task || !task.fromBoss) return false;
        if (!task.createdBy || !task.userId) return true;
        return String(task.createdBy) !== String(task.userId);
    }
    function dailyTaskCreatedText(task) {
        var raw = task && task.createdAt;
        if (!raw) return '';
        var date = null;
        if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
            date = new Date(Number(raw) * 1000);
        } else {
            date = new Date(String(raw));
        }
        if (!date || Number.isNaN(date.getTime())) return '';
        var day = String(date.getDate()).padStart(2, '0');
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var year = date.getFullYear();
        var time = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
        return day + '.' + month + '.' + year + ' ' + time;
    }

    function renderDailyTaskProgress(tasks) {
        var root = qs('[data-daily-progress]');
        if (!root) return;
        var total = tasks.length;
        var done = tasks.filter(dailyTaskIsDone).length;
        safeReplaceChildren(root,
            '<span><b>' + done + '/' + total + '</b> выполнено</span>' +
            '<span class="daily-task-progress-bar"><i style="width:' + (total ? Math.round(done / total * 100) : 0) + '%"></i></span>'
        );
    }

    function renderDailyPeopleList() {
        var root = qs('[data-daily-people-list]');
        if (!root) return;
        var currentUserId = state.user && state.user.id ? Number(state.user.id) : 0;
        var users = dailyTaskVisibleUsers().filter(function (user) {
            return !currentUserId || Number(user.id) !== currentUserId;
        });
        var activeKey = state.dailyMyOnly ? 'my' : String(state.dailySelectedUserId || 'all');
        var current = qs('[data-daily-people-current]');
        var currentAvatar = qs('[data-daily-people-current-avatar]');
        var activeUser = activeKey !== 'all' && activeKey !== 'my' ? dailyTaskUserById(activeKey) : null;
        if (current) {
            current.textContent = activeKey === 'my' ? 'Мои задачи' : (activeUser ? activeUser.name : 'Все пользователи');
        }
        if (currentAvatar) {
            var currentUser = activeKey === 'my' ? (state.user || { name: 'Мои задачи' }) : activeUser;
            currentAvatar.hidden = !currentUser;
            safeReplaceChildren(currentAvatar, currentUser ? dailyPersonAvatar(currentUser) : '');
        }
        var items = [
            '<button class="daily-person-item daily-person-item-all' + (activeKey === 'all' ? ' active' : '') + '" type="button" data-daily-person="all">' +
                '<span class="daily-person-name">Все пользователи</span>' +
            '</button>',
            '<button class="daily-person-item' + (activeKey === 'my' ? ' active' : '') + '" type="button" data-daily-person="my">' +
                dailyPersonAvatar(state.user || { name: 'Мои задачи' }) +
                '<span class="daily-person-name">Мои задачи</span>' +
            '</button>'
        ].concat(users.map(function (user) {
            return '<button class="daily-person-item' + (activeKey === String(user.id) ? ' active' : '') + '" type="button" data-daily-person="' + escapeHtml(user.id) + '">' +
                dailyPersonAvatar(user) +
                '<span class="daily-person-name">' + escapeHtml(user.name) + '</span>' +
            '</button>';
        }));
        safeReplaceChildren(root, items.join(''));
    }

    function renderDailyTaskRow(task) {
        var assignee = dailyTaskAssignee(task);
        var creator = dailyTaskCreator(task);
        var done = dailyTaskIsDone(task);
        var canComplete = dailyTaskCanComplete(task);
        var canManage = dailyTaskCanManage(task);
        var boss = dailyTaskIssuedByManager(task);
        var action = dailyTaskStatusAction(task);
        var createdText = dailyTaskCreatedText(task);
        var taskMenu = canManage
            ? '<div class="daily-task-menu-wrap">' +
                '<button class="daily-task-menu-toggle" type="button" data-daily-task-menu-toggle aria-label="Действия с задачей" aria-expanded="false"><i data-lucide="ellipsis"></i></button>' +
                '<div class="daily-task-menu-panel" data-daily-task-menu-panel hidden>' +
                    '<button type="button" data-daily-task-edit><i data-lucide="pencil"></i><span>Редактировать</span></button>' +
                    '<button class="is-danger" type="button" data-daily-task-delete><i data-lucide="trash-2"></i><span>Удалить</span></button>' +
                '</div>' +
            '</div>'
            : '';
        return '<article class="daily-list-row' + (done ? ' is-done' : '') + (task.status === 'in_progress' ? ' is-in-progress' : '') + (boss ? ' is-from-boss' : '') + (!canComplete ? ' is-readonly' : '') + '" data-daily-task-id="' + escapeHtml(task.id) + '" data-daily-task-owner-id="' + escapeHtml(task.userId) + '">' +
            '<div class="daily-row-avatars">' +
                dailyAvatar(assignee, assignee.name || task.userName || 'Сотрудник') +
            '</div>' +
            '<div class="daily-row-main">' +
                '<div class="daily-row-text"><span data-daily-row-text-label>' + escapeHtml(task.text) + '</span><span class="daily-undo-timer" data-daily-undo-timer hidden>5</span></div>' +
                '<div class="daily-row-meta">' +
                    '<span class="daily-row-user">' + escapeHtml(assignee.name || 'Сотрудник') + '</span>' +
                    (boss ? '<span class="daily-director-badge">Выдано руководителем</span>' : '') +
                '</div>' +
            '</div>' +
            '<div class="daily-row-action">' +
                (createdText ? '<time class="daily-row-created" datetime="' + escapeHtml(String(task.createdAt || '')) + '">Создано ' + escapeHtml(createdText) + '</time>' : '') +
                (action ? '<button class="daily-status-action" type="button" data-daily-status-action="' + escapeHtml(action.status) + '">' + escapeHtml(action.label) + '</button>' : '') +
                taskMenu +
            '</div>' +
        '</article>';
    }

    function renderDailyTaskList(tasks) {
        var root = qs('[data-daily-task-feed]');
        if (!root) return;
        safeReplaceChildren(root, tasks.length ? tasks.map(renderDailyTaskRow).join('') : '<div class="daily-task-empty">Задач нет</div>');
        renderDailyTaskProgress(tasks);
        refreshLucideIcons(root);
    }

    function renderDailyTaskArchive(tasks) {
        var root = qs('[data-daily-archive-modal-list]');
        if (!root) return;
        if (!tasks.length) {
            safeReplaceChildren(root, '<div class="daily-task-empty archive-empty">Архив пока пуст</div>');
            return;
        }
        safeReplaceChildren(root, '<div class="daily-archive-clean-list">' + tasks.map(function (task) {
            var assignee = dailyTaskAssignee(task);
            var completedTime = task.completedAt ? dailyTaskTime(task.completedAt) : '';
            var archivedTime = task.archivedAt ? dailyTaskTime(task.archivedAt) : '';
            var archiveLabel = completedTime ? ('Выполнено в ' + completedTime) : (archivedTime ? ('Отменено в ' + archivedTime) : 'Отменено');
            var canManage = dailyTaskCanManage(task);
            return '<article class="daily-archive-clean-row" data-daily-archive-task-id="' + escapeHtml(task.id) + '">' +
                '<div class="daily-row-avatars">' + dailyAvatar(assignee, assignee.name || task.userName || 'Сотрудник') + '</div>' +
                '<div><strong>' + escapeHtml(task.text) + '</strong><small>' + escapeHtml(assignee.name || task.userName || 'Сотрудник') + ' · ' + escapeHtml(formatDisplayDate(task.date)) + '</small></div>' +
                '<div class="daily-archive-row-actions">' +
                    '<span>' + escapeHtml(archiveLabel) + '</span>' +
                    (canManage ? '<button class="ghost compact" type="button" data-daily-archive-restore>Вернуть</button>' : '') +
                    (canManage ? '<button class="ghost compact danger" type="button" data-daily-archive-delete>Удалить</button>' : '') +
                '</div>' +
            '</article>';
        }).join('') + '</div>');
        refreshLucideIcons(root);
    }

    function dailyTaskQuery(archive) {
        var params = new URLSearchParams();
        if (archive) params.set('archive', '1');
        if (state.dailyMyOnly) {
            if (state.user && state.user.id) params.set('userId', state.user.id);
        } else if (state.dailySelectedUserId && state.dailySelectedUserId !== 'all') {
            params.set('userId', state.dailySelectedUserId);
        }
        var query = params.toString();
        return '/api/daily-tasks' + (query ? '?' + query : '');
    }

    function loadDailyTasks() {
        var requestToken = (state.dailyTasksRequestToken || 0) + 1;
        state.dailyTasksRequestToken = requestToken;
        return api(dailyTaskQuery(false)).then(function (data) {
            if (requestToken !== state.dailyTasksRequestToken) return;
            clearDailyCompletionTimers();
            state.dailyTasks = Array.isArray(data.tasks) ? data.tasks : [];
            if (Array.isArray(data.users)) state.users = data.users.map(normalizeDailyUser);
            renderDailyPeopleList();
            renderDailyTaskList(state.dailyTasks);
        }).catch(function (error) {
            showAppNotice(appErrorMessage(error, 'Не удалось загрузить задачи сотрудников.'), 'error');
        });
    }

    function clearDailyCompletionTimers() {
        Object.keys(state.dailyCompletionTimers || {}).forEach(function (taskId) {
            var entry = state.dailyCompletionTimers[taskId];
            if (entry && entry.timerId) clearInterval(entry.timerId);
            delete state.dailyCompletionTimers[taskId];
        });
    }

    function loadDailyArchive() {
        var requestToken = (state.dailyArchiveRequestToken || 0) + 1;
        state.dailyArchiveRequestToken = requestToken;
        return api(dailyTaskQuery(true)).then(function (data) {
            if (requestToken !== state.dailyArchiveRequestToken) return;
            state.dailyArchive = Array.isArray(data.tasks) ? data.tasks : [];
            if (Array.isArray(data.users)) state.users = data.users.map(normalizeDailyUser);
            renderDailyTaskArchive(state.dailyArchive);
        }).catch(function (error) {
            showAppNotice(appErrorMessage(error, 'Не удалось загрузить архив задач.'), 'error');
        });
    }

    function deleteDailyTask(taskId) {
        return api('/api/daily-tasks/' + encodeURIComponent(taskId) + '/delete', {
            method: 'POST',
            body: JSON.stringify({})
        });
    }

    function dailyTaskById(taskId) {
        return (state.dailyTasks || []).filter(function (task) {
            return String(task.id) === String(taskId);
        })[0] || null;
    }

    function closeDailyTaskMenus(exceptPanel) {
        qsa('[data-daily-task-menu-panel]').forEach(function (panel) {
            if (panel === exceptPanel) return;
            panel.hidden = true;
            var toggle = panel.parentNode && qs('[data-daily-task-menu-toggle]', panel.parentNode);
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
    }

    function syncDailyEditUsers(modal, task) {
        var select = qs('[data-daily-edit-user]', modal);
        if (!select) return;
        var canReassign = canManageDailyTasks();
        var field = select.closest('.daily-create-field');
        var users = canReassign ? dailyTaskVisibleUsers() : [dailyTaskAssignee(task)];
        if (field) field.hidden = !canReassign;
        select.disabled = !canReassign;
        safeReplaceChildren(select, users.map(function (user) {
            return '<option value="' + escapeHtml(user.id) + '"' + (String(task.userId) === String(user.id) ? ' selected' : '') + '>' + escapeHtml(personDisplayName(user) || user.login || 'Сотрудник') + '</option>';
        }).join(''));
    }

    function ensureDailyEditModal() {
        var modal = qs('[data-daily-edit-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'daily-standup-modal';
        modal.setAttribute('data-daily-edit-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<button class="daily-standup-backdrop" type="button" data-daily-edit-close aria-label="Закрыть"></button>' +
            '<section class="daily-standup-dialog daily-task-create-dialog daily-task-edit-dialog" role="dialog" aria-modal="true" aria-label="Редактировать задачу">' +
                '<div class="daily-standup-head"><div><h3>Редактировать задачу</h3></div><button class="ghost compact" type="button" data-daily-edit-close>Закрыть</button></div>' +
                '<form data-daily-edit-form>' +
                    '<label class="daily-create-field"><span>Исполнитель</span><select name="userId" data-daily-edit-user></select></label>' +
                    '<label class="daily-create-field daily-edit-text-field"><span>Задача</span><textarea name="text" rows="5" required></textarea></label>' +
                    '<div class="daily-standup-actions"><button class="primary" type="submit">Сохранить</button></div>' +
                '</form>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-daily-edit-close]')) modal.hidden = true;
        });
        qs('[data-daily-edit-form]', modal).addEventListener('submit', function (event) {
            event.preventDefault();
            var form = event.currentTarget;
            var task = dailyTaskById(modal.getAttribute('data-daily-edit-task-id'));
            if (!task || !dailyTaskCanManage(task)) {
                modal.hidden = true;
                showAppNotice('Нет доступа к редактированию этой задачи.', 'error');
                return;
            }
            withSubmitLock(form, function () {
                return updateDailyTask(task.id, {
                    text: form.text.value,
                    userId: form.userId && form.userId.value ? form.userId.value : task.userId,
                    status: task.status,
                    date: task.date
                }).then(function () {
                    modal.hidden = true;
                    return loadDailyTasks();
                });
            }).catch(function (error) {
                showAppNotice(appErrorMessage(error, 'Не удалось сохранить задачу.'), 'error');
            });
        });
        document.body.appendChild(modal);
        return modal;
    }

    function openDailyEditModal(task) {
        if (!dailyTaskCanManage(task)) return;
        var modal = ensureDailyEditModal();
        var form = qs('[data-daily-edit-form]', modal);
        modal.setAttribute('data-daily-edit-task-id', task.id);
        syncDailyEditUsers(modal, task);
        form.text.value = task.text || '';
        modal.hidden = false;
        form.text.focus();
        form.text.select();
        refreshLucideIcons(modal);
    }

    function deleteDailyActiveTask(row, task) {
        if (!task || !dailyTaskCanManage(task) || row.classList.contains('is-saving')) return;
        openDailyDeleteModal(task, 'active');
    }

    function dailyArchiveTaskById(taskId) {
        return (state.dailyArchive || []).filter(function (task) {
            return String(task.id) === String(taskId);
        })[0] || null;
    }

    function removeDailyArchiveTask(taskId) {
        state.dailyArchive = (state.dailyArchive || []).filter(function (task) {
            return String(task.id) !== String(taskId);
        });
        renderDailyTaskArchive(state.dailyArchive);
    }

    function restoreDailyArchiveTask(button, row) {
        var taskId = row.getAttribute('data-daily-archive-task-id');
        var task = dailyArchiveTaskById(taskId);
        if (!task || button.disabled) return;
        button.disabled = true;
        updateDailyTask(taskId, {
            status: 'planned',
            text: task.text || '',
            date: task.date || undefined
        }).then(function () {
            removeDailyArchiveTask(taskId);
            loadDailyTasks();
        }).catch(function (error) {
            button.disabled = false;
            showAppNotice(appErrorMessage(error, 'Не удалось вернуть задачу.'), 'error');
        });
    }

    function deleteDailyArchiveTask(button, row) {
        var taskId = row.getAttribute('data-daily-archive-task-id');
        var task = dailyArchiveTaskById(taskId);
        if (!task || button.disabled || !dailyTaskCanManage(task)) return;
        openDailyDeleteModal(task, 'archive');
    }

    function closeDailyDeleteModal(modal) {
        if (!modal || modal.classList.contains('is-saving')) return;
        modal.hidden = true;
        modal.removeAttribute('data-daily-delete-task-id');
        modal.removeAttribute('data-daily-delete-source');
    }

    function finishDailyTaskDelete(modal, task, source) {
        if (source === 'archive') {
            removeDailyArchiveTask(task.id);
        } else {
            state.dailyTasks = (state.dailyTasks || []).filter(function (item) {
                return String(item.id) !== String(task.id);
            });
            renderDailyTaskList(state.dailyTasks);
        }
        modal.classList.remove('is-saving');
        var confirmButton = qs('[data-daily-delete-confirm]', modal);
        if (confirmButton) confirmButton.disabled = false;
        closeDailyDeleteModal(modal);
        showAppNotice('Задача удалена.', 'success');
    }

    function ensureDailyDeleteModal() {
        var modal = qs('[data-daily-delete-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'daily-standup-modal daily-task-delete-modal';
        modal.setAttribute('data-daily-delete-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<button class="daily-standup-backdrop" type="button" data-daily-delete-cancel aria-label="Отменить удаление"></button>' +
            '<section class="daily-standup-dialog daily-task-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="daily-task-delete-title" aria-describedby="daily-task-delete-description">' +
                '<div class="daily-task-delete-icon" aria-hidden="true"><i data-lucide="trash-2"></i></div>' +
                '<div class="daily-task-delete-copy">' +
                    '<h3 id="daily-task-delete-title">Удалить задачу?</h3>' +
                    '<p id="daily-task-delete-description">Она исчезнет у исполнителя и восстановить её будет нельзя.</p>' +
                '</div>' +
                '<div class="daily-task-delete-preview">' +
                    '<strong data-daily-delete-task-text></strong>' +
                    '<span data-daily-delete-task-user></span>' +
                '</div>' +
                '<div class="daily-task-delete-actions">' +
                    '<button class="daily-task-delete-cancel" type="button" data-daily-delete-cancel>Отмена</button>' +
                    '<button class="daily-task-delete-confirm" type="button" data-daily-delete-confirm><i data-lucide="trash-2"></i><span>Удалить</span></button>' +
                '</div>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-daily-delete-cancel]')) {
                closeDailyDeleteModal(modal);
                return;
            }
            var confirmButton = event.target.closest('[data-daily-delete-confirm]');
            if (!confirmButton || confirmButton.disabled) return;
            var taskId = modal.getAttribute('data-daily-delete-task-id');
            var source = modal.getAttribute('data-daily-delete-source') || 'active';
            var task = source === 'archive' ? dailyArchiveTaskById(taskId) : dailyTaskById(taskId);
            if (!task || !dailyTaskCanManage(task)) {
                closeDailyDeleteModal(modal);
                showAppNotice('Нет доступа к удалению этой задачи.', 'error');
                return;
            }
            confirmButton.disabled = true;
            modal.classList.add('is-saving');
            deleteDailyTask(task.id).then(function () {
                finishDailyTaskDelete(modal, task, source);
            }).catch(function (error) {
                if (error && (error.message === 'task_not_found' || error.status === 404)) {
                    finishDailyTaskDelete(modal, task, source);
                    return;
                }
                modal.classList.remove('is-saving');
                confirmButton.disabled = false;
                var databaseMessage = error && error.payload && error.payload.message ? String(error.payload.message) : '';
                var fallback = /unable to open database file/i.test(databaseMessage)
                    ? 'База данных временно недоступна. Попробуйте удалить задачу ещё раз.'
                    : 'Не удалось удалить задачу.';
                showAppNotice(/unable to open database file/i.test(databaseMessage) ? fallback : appErrorMessage(error, fallback), 'error');
            });
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeDailyDeleteModal(modal);
        });
        document.body.appendChild(modal);
        return modal;
    }

    function openDailyDeleteModal(task, source) {
        if (!task || !dailyTaskCanManage(task)) return;
        var modal = ensureDailyDeleteModal();
        var assignee = dailyTaskAssignee(task);
        var text = qs('[data-daily-delete-task-text]', modal);
        var user = qs('[data-daily-delete-task-user]', modal);
        var cancel = qs('.daily-task-delete-cancel', modal);
        modal.setAttribute('data-daily-delete-task-id', task.id);
        modal.setAttribute('data-daily-delete-source', source || 'active');
        if (text) text.textContent = task.text || 'Без названия';
        if (user) user.textContent = 'Исполнитель: ' + (assignee.name || task.userName || 'Сотрудник');
        modal.hidden = false;
        refreshLucideIcons(modal);
        if (cancel) cancel.focus();
    }

    function ensureDailyArchiveModal() {
        var modal = qs('[data-daily-archive-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'daily-archive-modal';
        modal.setAttribute('data-daily-archive-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<button class="daily-archive-backdrop" type="button" data-daily-archive-close aria-label="Закрыть архив"></button>' +
            '<section class="daily-archive-dialog" role="dialog" aria-modal="true" aria-label="Архив задач">' +
                '<div class="daily-archive-head"><div><span class="section-label">Архив задач</span><h3>Выполненные задачи прошлых дней</h3></div><button class="ghost compact" type="button" data-daily-archive-close>Закрыть</button></div>' +
                '<div class="daily-archive-body" data-daily-archive-modal-list></div>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            var restore = event.target.closest('[data-daily-archive-restore]');
            if (restore) {
                var restoreRow = restore.closest('[data-daily-archive-task-id]');
                if (restoreRow) restoreDailyArchiveTask(restore, restoreRow);
                return;
            }
            var del = event.target.closest('[data-daily-archive-delete]');
            if (del) {
                var deleteRow = del.closest('[data-daily-archive-task-id]');
                if (deleteRow) deleteDailyArchiveTask(del, deleteRow);
                return;
            }
            if (!event.target.closest('[data-daily-archive-close]')) return;
            modal.hidden = true;
            document.body.classList.remove('daily-archive-opened');
        });
        document.body.appendChild(modal);
        return modal;
    }

    function openDailyArchiveModal() {
        var modal = ensureDailyArchiveModal();
        modal.hidden = false;
        document.body.classList.add('daily-archive-opened');
        loadDailyArchive();
        refreshLucideIcons(modal);
    }

    function ensureDailyQuickModal() {
        var modal = qs('[data-daily-quick-modal]');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'daily-standup-modal';
        modal.setAttribute('data-daily-quick-modal', '');
        modal.hidden = true;
        modal.innerHTML =
            '<button class="daily-standup-backdrop" type="button" data-daily-quick-close aria-label="Закрыть"></button>' +
            '<section class="daily-standup-dialog daily-task-create-dialog" role="dialog" aria-modal="true" aria-label="Новая задача">' +
                '<div class="daily-standup-head"><div><h3>Добавить задачу</h3></div><button class="ghost compact" type="button" data-daily-quick-close>Закрыть</button></div>' +
                '<form data-daily-quick-form>' +
                    '<label class="daily-create-field"><span>Исполнитель</span><select name="userId" data-daily-create-user></select></label>' +
                    '<textarea name="text" rows="5" placeholder="Каждая строка станет отдельной задачей"></textarea>' +
                    '<div class="daily-standup-actions"><button class="primary" type="submit">Добавить</button></div>' +
                '</form>' +
            '</section>';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-daily-quick-close]')) modal.hidden = true;
        });
        qs('[data-daily-quick-form]', modal).addEventListener('submit', function (event) {
            event.preventDefault();
            var form = event.currentTarget;
            withSubmitLock(form, function () {
                return api('/api/daily-tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        text: form.text.value,
                        userId: form.userId && form.userId.value ? form.userId.value : (state.user && state.user.id)
                    })
                }).then(function () {
                    form.reset();
                    modal.hidden = true;
                    loadDailyTasks();
                });
            }).catch(function (error) {
                showAppNotice(appErrorMessage(error, 'Не удалось добавить задачу.'), 'error');
            });
        });
        document.body.appendChild(modal);
        return modal;
    }

    function syncDailyCreateUsers(modal) {
        var select = qs('[data-daily-create-user]', modal);
        if (!select) return;
        var canAssignUser = canManageDailyTasks();
        var field = select.closest('.daily-create-field');
        var users = canAssignUser ? dailyTaskVisibleUsers() : (state.user ? [state.user] : []);
        var currentId = canAssignUser && !state.dailyMyOnly ? (state.dailySelectedUserId !== 'all' ? state.dailySelectedUserId : (state.user && state.user.id)) : (state.user && state.user.id);
        if (field) field.hidden = !canAssignUser;
        select.disabled = !canAssignUser;
        if (!users.length && state.user) users = [state.user];
        if (!currentId && state.user) currentId = state.user.id;
        safeReplaceChildren(select, users.map(function (user) {
            return '<option value="' + escapeHtml(user.id) + '"' + (String(currentId) === String(user.id) ? ' selected' : '') + '>' + escapeHtml(personDisplayName(user) || user.login) + '</option>';
        }).join(''));
    }

    function openDailyQuickModal() {
        var modal = ensureDailyQuickModal();
        syncDailyCreateUsers(modal);
        modal.hidden = false;
        var textarea = qs('textarea', modal);
        if (textarea) textarea.focus();
        refreshLucideIcons(modal);
    }

    function dailyTaskTimerNode(row) {
        var timer = qs('[data-daily-undo-timer]', row);
        if (timer) return timer;
        var text = qs('.daily-row-text', row);
        if (!text) return null;
        timer = document.createElement('span');
        timer.className = 'daily-undo-timer';
        timer.setAttribute('data-daily-undo-timer', '');
        timer.hidden = true;
        timer.textContent = '5';
        text.appendChild(timer);
        return timer;
    }

    function dailyTaskTextValue(row) {
        var label = qs('[data-daily-row-text-label]', row);
        return label ? label.textContent : (qs('.daily-row-text', row).textContent || '');
    }

    function dailyTaskClickPoint(event, row) {
        if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            return { x: event.clientX, y: event.clientY };
        }
        var rect = row.getBoundingClientRect();
        return {
            x: rect.left + Math.min(rect.width - 24, Math.max(24, rect.width * 0.52)),
            y: rect.top + rect.height * 0.45
        };
    }

    function showDailyTaskSuccessPop(event, row) {
        var point = dailyTaskClickPoint(event, row);
        var pop = document.createElement('span');
        pop.className = 'pop-success';
        pop.textContent = 'Красавчик! 🔥';
        pop.style.left = (point.x + 12) + 'px';
        pop.style.top = (point.y - 4) + 'px';
        document.body.appendChild(pop);
        setTimeout(function () {
            if (pop.parentNode) pop.parentNode.removeChild(pop);
        }, 1650);
    }

    function animateDailyTaskToArchive(row, done) {
        var archiveButton = qs('[data-daily-archive-toggle]');
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!archiveButton || reduceMotion || !row.getBoundingClientRect || !window.Element || !window.Element.prototype.animate) {
            done();
            return;
        }
        var rowRect = row.getBoundingClientRect();
        var targetRect = archiveButton.getBoundingClientRect();
        var flyer = row.cloneNode(true);
        var deltaX = targetRect.left + targetRect.width / 2 - (rowRect.left + rowRect.width / 2);
        var deltaY = targetRect.top + targetRect.height / 2 - (rowRect.top + rowRect.height / 2);
        flyer.classList.add('daily-archive-flyer');
        flyer.style.left = rowRect.left + 'px';
        flyer.style.top = rowRect.top + 'px';
        flyer.style.width = rowRect.width + 'px';
        flyer.style.height = rowRect.height + 'px';
        document.body.appendChild(flyer);
        row.classList.add('is-archive-source');
        archiveButton.classList.add('is-archive-catch');
        var animation = flyer.animate([
            { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: 0 },
            { transform: 'translate3d(' + Math.round(deltaX * .46) + 'px, ' + Math.round(deltaY * .18 - 18) + 'px, 0) scale(.82)', opacity: .92, offset: .45 },
            { transform: 'translate3d(' + Math.round(deltaX) + 'px, ' + Math.round(deltaY) + 'px, 0) scale(0)', opacity: 0, offset: 1 }
        ], {
            duration: 760,
            easing: 'cubic-bezier(.18, .9, .22, 1)',
            fill: 'forwards'
        });
        animation.onfinish = function () {
            if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
            archiveButton.classList.remove('is-archive-catch');
            done();
        };
        animation.oncancel = animation.onfinish;
    }

    function cancelDailyTaskCompletion(row) {
        var taskId = row.getAttribute('data-daily-task-id');
        var entry = state.dailyCompletionTimers && state.dailyCompletionTimers[taskId];
        if (entry && entry.timerId) clearInterval(entry.timerId);
        if (state.dailyCompletionTimers) delete state.dailyCompletionTimers[taskId];
        row.classList.remove('is-done', 'is-pending-complete', 'is-saving', 'is-archiving', 'is-archive-source');
        row.setAttribute('aria-pressed', 'false');
        var timer = dailyTaskTimerNode(row);
        if (timer) {
            timer.hidden = true;
            timer.classList.remove('is-running');
            timer.textContent = '5';
        }
    }

    function finishDailyTaskCompletion(row, task) {
        var taskId = row.getAttribute('data-daily-task-id');
        if (state.dailyCompletionTimers) delete state.dailyCompletionTimers[taskId];
        row.classList.remove('is-pending-complete');
        row.classList.add('is-saving');
        updateDailyTask(taskId, {
            status: 'done',
            text: task.text || dailyTaskTextValue(row)
        }).then(function (data) {
            var updated = data && data.task ? data.task : null;
            state.dailyTasks = (state.dailyTasks || []).filter(function (item) {
                return String(item.id) !== String(taskId);
            });
            if (updated) state.dailyArchive = [updated].concat(state.dailyArchive || []);
            animateDailyTaskToArchive(row, function () {
                row.classList.add('is-archiving');
                if (row.parentNode) row.parentNode.removeChild(row);
                renderDailyTaskProgress(state.dailyTasks);
                if (!state.dailyTasks.length) renderDailyTaskList(state.dailyTasks);
                var archiveModal = qs('[data-daily-archive-modal]');
                if (archiveModal && !archiveModal.hidden) loadDailyArchive();
            });
        }).catch(function (error) {
            row.classList.remove('is-done', 'is-saving', 'is-archiving', 'is-archive-source');
            row.setAttribute('aria-pressed', 'false');
            var timer = dailyTaskTimerNode(row);
            if (timer) {
                timer.hidden = true;
                timer.classList.remove('is-running');
                timer.textContent = '5';
            }
            showAppNotice(appErrorMessage(error, 'Не удалось завершить задачу.'), 'error');
        });
    }

    function setDailyTaskDone(row, done, event) {
        var taskId = row.getAttribute('data-daily-task-id');
        if (!done || row.classList.contains('is-pending-complete')) {
            cancelDailyTaskCompletion(row);
            return;
        }
        if (row.classList.contains('is-saving')) return;
        var task = (state.dailyTasks || []).filter(function (item) { return String(item.id) === String(taskId); })[0] || {};
        if (!dailyTaskCanComplete(task)) {
            showAppNotice('Выполнить задачу может только ее исполнитель.', 'error');
            return;
        }
        var timer = dailyTaskTimerNode(row);
        row.classList.add('is-done', 'is-pending-complete');
        row.setAttribute('aria-pressed', 'true');
        if (timer) {
            timer.hidden = false;
            timer.classList.remove('is-running');
            timer.textContent = '5';
            void timer.offsetWidth;
            timer.classList.add('is-running');
        }
        showDailyTaskSuccessPop(event, row);
        var entry = {
            remaining: 5,
            timerId: setInterval(function () {
                entry.remaining -= 1;
                var timer = dailyTaskTimerNode(row);
                if (timer) timer.textContent = String(Math.max(entry.remaining, 0));
                if (entry.remaining <= 0) {
                    clearInterval(entry.timerId);
                    finishDailyTaskCompletion(row, task);
                }
            }, 1000)
        };
        state.dailyCompletionTimers[taskId] = entry;
    }

    function setDailyTaskStatus(row, status, event) {
        var taskId = row.getAttribute('data-daily-task-id');
        var task = (state.dailyTasks || []).filter(function (item) { return String(item.id) === String(taskId); })[0] || {};
        if (!dailyTaskCanComplete(task)) {
            showAppNotice('Изменить статус задачи может только ее исполнитель.', 'error');
            return;
        }
        if (status === 'done') {
            setDailyTaskDone(row, true, event);
            return;
        }
        if (status !== 'in_progress' && status !== 'planned') return;
        if (row.classList.contains('is-saving')) return;
        cancelDailyTaskCompletion(row);
        row.classList.add('is-saving');
        updateDailyTask(taskId, {
            status: status,
            text: task.text || dailyTaskTextValue(row)
        }).then(function () {
            return loadDailyTasks();
        }).catch(function (error) {
            row.classList.remove('is-saving');
            showAppNotice(appErrorMessage(error, 'Не удалось изменить статус задачи.'), 'error');
        });
    }

    function bindDailyTaskPageEvents() {
        var quick = qs('[data-daily-quick-add]');
        if (quick && quick.dataset.bound !== '1') {
            quick.dataset.bound = '1';
            quick.addEventListener('click', openDailyQuickModal);
        }
        var archive = qs('[data-daily-archive-toggle]');
        if (archive && archive.dataset.bound !== '1') {
            archive.dataset.bound = '1';
            archive.addEventListener('click', openDailyArchiveModal);
        }
        var peopleToggle = qs('[data-daily-people-toggle]');
        var peopleDropdown = qs('[data-daily-people-dropdown]');
        var people = qs('[data-daily-people-list]');
        if (peopleToggle && people && peopleToggle.dataset.bound !== '1') {
            peopleToggle.dataset.bound = '1';
            peopleToggle.addEventListener('click', function (event) {
                event.preventDefault();
                var open = people.hidden;
                people.hidden = !open;
                peopleToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }
        if (people && people.dataset.bound !== '1') {
            people.dataset.bound = '1';
            people.addEventListener('click', function (event) {
                var button = event.target.closest('[data-daily-person]');
                if (!button) return;
                var value = button.getAttribute('data-daily-person') || 'all';
                state.dailyMyOnly = value === 'my';
                state.dailySelectedUserId = state.dailyMyOnly ? 'all' : value;
                people.hidden = true;
                if (peopleToggle) peopleToggle.setAttribute('aria-expanded', 'false');
                loadDailyTasks();
            });
        }
        if (peopleDropdown && peopleDropdown.dataset.closeBound !== '1') {
            peopleDropdown.dataset.closeBound = '1';
            document.addEventListener('click', function (event) {
                if (!people || !peopleToggle || event.target.closest('[data-daily-people-dropdown]')) return;
                people.hidden = true;
                peopleToggle.setAttribute('aria-expanded', 'false');
            });
        }
        var feed = qs('[data-daily-task-feed]');
        if (feed && feed.dataset.bound !== '1') {
            feed.dataset.bound = '1';
            feed.addEventListener('click', function (event) {
                var menuToggle = event.target.closest('[data-daily-task-menu-toggle]');
                if (menuToggle) {
                    event.preventDefault();
                    event.stopPropagation();
                    var panel = qs('[data-daily-task-menu-panel]', menuToggle.parentNode);
                    var willOpen = panel && panel.hidden;
                    closeDailyTaskMenus(willOpen ? panel : null);
                    if (panel) panel.hidden = !willOpen;
                    menuToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                    return;
                }
                var editButton = event.target.closest('[data-daily-task-edit]');
                var deleteButton = event.target.closest('[data-daily-task-delete]');
                if (editButton || deleteButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    var manageRow = (editButton || deleteButton).closest('[data-daily-task-id]');
                    var manageTask = manageRow && dailyTaskById(manageRow.getAttribute('data-daily-task-id'));
                    closeDailyTaskMenus();
                    if (editButton) openDailyEditModal(manageTask);
                    if (deleteButton) deleteDailyActiveTask(manageRow, manageTask);
                    return;
                }
                var statusButton = event.target.closest('[data-daily-status-action]');
                if (statusButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeDailyTaskMenus();
                    var actionRow = statusButton.closest('[data-daily-task-id]');
                    if (actionRow) setDailyTaskStatus(actionRow, statusButton.getAttribute('data-daily-status-action'), event);
                    return;
                }
                if (event.target.closest('[data-daily-task-menu-panel]')) return;
                if (event.target.closest('a, button, input, select, textarea, label')) return;
                var row = event.target.closest('[data-daily-task-id]');
                if (!row) return;
                var taskId = row.getAttribute('data-daily-task-id');
                var task = (state.dailyTasks || []).filter(function (item) { return String(item.id) === String(taskId); })[0] || {};
                if (task.status === 'in_progress') {
                    setDailyTaskDone(row, true, event);
                }
            });
            feed.addEventListener('keydown', function (event) {
                if (event.target.closest('a, button, input, select, textarea, label')) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                var row = event.target.closest('[data-daily-task-id]');
                if (!row) return;
                event.preventDefault();
                var taskId = row.getAttribute('data-daily-task-id');
                var task = (state.dailyTasks || []).filter(function (item) { return String(item.id) === String(taskId); })[0] || {};
                if (task.status === 'in_progress') {
                    setDailyTaskDone(row, true, event);
                }
            });
        }
        if (document.documentElement.dataset.dailyTaskMenuBound !== '1') {
            document.documentElement.dataset.dailyTaskMenuBound = '1';
            document.addEventListener('click', function (event) {
                if (!event.target.closest('[data-daily-task-menu-toggle], [data-daily-task-menu-panel]')) closeDailyTaskMenus();
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeDailyTaskMenus();
            });
        }
    }

    function initDailyTasksPage() {
        state.dailySelectedUserId = 'all';
        state.dailyMyOnly = false;
        bindDailyTaskPageEvents();
        loadDailyTasks();
    }


    PMBI.dailyTasks = Object.assign(PMBI.dailyTasks || {}, {
        initDailyTasksPage: initDailyTasksPage,
        checkDailyStandup: checkDailyStandup,
        loadDailyTasks: loadDailyTasks,
        loadDailyArchive: loadDailyArchive
    });
    window.PMBI = PMBI;
})();
