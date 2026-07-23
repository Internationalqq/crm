(function () {
    'use strict';

    var page = document.body.dataset.page;
    var state = {
        user: null,
        projects: [],
        selectedProject: null,
        materialsByProject: {},
        dashboard: null
    };

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function api(path, options) {
        options = options || {};
        options.credentials = 'same-origin';
        options.headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
        if (options.body && !options.headers['Content-Type']) options.headers['Content-Type'] = 'application/json';
        return fetch(path, options).then(function (response) {
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
    }

    function money(value) {
        return new Intl.NumberFormat('ru-RU').format(Number(value) || 0) + ' ₽';
    }

    function percent(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function nextPath() {
        var params = new URLSearchParams(location.search);
        var next = params.get('next');
        return next && next.indexOf('/app/') === 0 ? next : '/app/dashboard';
    }

    function initLogin() {
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
            renderUser();
            applyRole();
            initPage();
        }).catch(function () {
            location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
        });

        var logout = qs('[data-logout]');
        if (logout) {
            logout.addEventListener('click', function () {
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

    function renderUser() {
        var node = qs('[data-current-user]');
        if (!node || !state.user) return;
        node.textContent = state.user.name + ' · ' + state.user.roleLabel;
    }

    function applyRole() {
        if (!state.user) return;
        document.body.classList.add('role-' + state.user.role);
        qsa('[data-director-only]').forEach(function (node) {
            if (state.user.role !== 'director') node.remove();
        });
        qsa('[data-director-action]').forEach(function (node) {
            if (state.user.role !== 'director') node.remove();
        });
        var allowedNav = {
            director: ['dashboard', 'projects', 'schedule', 'logs', 'warehouse', 'chats', 'users', 'reports'],
            foreman: ['dashboard', 'projects', 'schedule', 'logs', 'warehouse', 'chats'],
            buyer: ['dashboard', 'projects', 'logs', 'warehouse', 'chats'],
            client: ['dashboard', 'projects', 'schedule', 'logs', 'chats']
        };
        var allowed = allowedNav[state.user.role] || [];
        qsa('[data-nav]').forEach(function (link) {
            if (allowed.indexOf(link.dataset.nav) === -1) {
                link.remove();
                return;
            }
            if (link.dataset.nav === page) link.classList.add('active');
        });
    }

    function initPage() {
        if (page === 'dashboard') initDashboardPage();
        if (page === 'projects') loadProjects(function () {
            loadDashboard(renderProjectsPage);
        });
        if (page === 'warehouse') loadProjects(renderWarehousePage);
        if (page === 'schedule') loadProjects(renderSchedulePage);
        if (page === 'logs') loadProjects(renderLogsPage);
        if (page === 'chats') loadProjects(renderChatsPage);
        if (page === 'users') initUsersPage();
        if (page === 'reports') initReportsPage();
    }

    function loadProjects(callback) {
        api('/api/projects').then(function (data) {
            state.projects = Array.isArray(data.projects) ? data.projects : [];
            callback();
        }).catch(function () {
            callback();
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
    }

    function renderDashboardStats(data) {
        var root = qs('[data-dashboard-stats]');
        if (!root) return;
        var html =
            stat('Объектов', data.projectsCount == null ? '—' : data.projectsCount) +
            stat('В работе', data.activeProjects == null ? '—' : data.activeProjects) +
            stat('Прогресс', (data.avgProgress == null ? 0 : data.avgProgress) + '%') +
            stat('Открытые задачи', data.openTasksCount == null ? '—' : data.openTasksCount);
        if (state.user && state.user.role !== 'client') {
            html += stat('Нехватки', data.shortagesCount == null ? '—' : data.shortagesCount, data.shortagesCount ? 'danger' : '');
        }
        if (state.user && state.user.role === 'director') {
            html +=
                stat('Бюджет', data.totalBudget == null ? '—' : money(data.totalBudget)) +
                stat('Оплачено', data.totalPaid == null ? '—' : money(data.totalPaid)) +
                stat('Маржа', data.profitNow == null ? '—' : money(data.profitNow), data.profitNow < 0 ? 'danger' : '');
        }
        root.innerHTML = html;
    }

    function renderDashboardProjects(projects) {
        var root = qs('[data-dashboard-projects]');
        if (!root) return;
        if (!projects.length) {
            root.innerHTML = '<p class="muted">Пока нет объектов. Создай первый объект — и панель начнёт собирать риски, задачи и материалы.</p>';
            return;
        }
        root.innerHTML = projects.map(function (project) {
            var progress = percent(project.progress);
            return '<a class="dashboard-project" href="/app/projects" data-dashboard-project-id="' + project.id + '">' +
                '<div class="project-row-main">' +
                    '<b>' + escapeHtml(project.title) + '</b>' +
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
                return '<div class="action-item"><span>' + (index + 1) + '</span><p>' + escapeHtml(item) + '</p></div>';
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
        root.innerHTML = items.length
            ? items.map(function (item) {
                return '<div class="activity-item">' +
                    '<span class="activity-kind">' + escapeHtml(labels[item.kind] || item.kind || 'Событие') + '</span>' +
                    '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.text || '') + '</small></div>' +
                '</div>';
            }).join('')
            : '<p class="muted">Событий пока нет. Когда команда начнёт писать в чат, вести склад и закрывать задачи — здесь появится лента.</p>';
    }

    function renderDashboardCritical(items) {
        var root = qs('[data-dashboard-critical]');
        if (!root) return;
        if (state.user && state.user.role === 'client') {
            root.innerHTML = '<p class="muted">Для заказчика скрыты внутренние закупки и себестоимость. Видны прогресс, график, документы и чат.</p>';
            return;
        }
        root.innerHTML = items.length
            ? '<div class="compact-risk-list">' + items.slice(0, 6).map(function (item) {
                return '<div class="risk-item"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + '</small></div><span class="badge danger">+' + escapeHtml(item.missingQty) + ' ' + escapeHtml(item.unit) + '</span></div>';
            }).join('') + '</div>'
            : '<p class="muted">Критичных нехваток нет. Если загрузить смету и вести склад, система будет подсвечивать недостающие позиции.</p>';
    }

    function renderProjectsPage() {
        bindProjectCreate();
        renderProjectStats();
        renderProjectCritical();
        renderProjectList(state.projects);
        var search = qs('[data-project-search]');
        if (search) {
            search.addEventListener('input', function () {
                var query = search.value.toLocaleLowerCase('ru');
                renderProjectList(state.projects.filter(function (project) {
                    return [project.title, project.address, project.client_name, project.status]
                        .join(' ')
                        .toLocaleLowerCase('ru')
                        .indexOf(query) !== -1;
                }));
            });
        }
        var close = qs('[data-close-detail]');
        if (close) close.addEventListener('click', function () {
            qs('[data-project-detail]').hidden = true;
        });
        qsa('[data-tab]').forEach(function (button) {
            if (state.user && state.user.role === 'client' && ['materials', 'tasks'].indexOf(button.dataset.tab) !== -1) {
                button.remove();
                return;
            }
            button.addEventListener('click', function () {
                qsa('[data-tab]').forEach(function (node) { node.classList.remove('active'); });
                qsa('[data-panel]').forEach(function (node) { node.classList.remove('active'); });
                button.classList.add('active');
                qs('[data-panel="' + button.dataset.tab + '"]').classList.add('active');
            });
        });
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
                    contract_no: form.contract_no.value.trim(),
                    budget: Number(form.budget.value || 0),
                    started_at: form.started_at.value,
                    deadline_at: form.deadline_at.value
                })
            }).then(function (data) {
                form.reset();
                if (card) card.hidden = true;
                state.projects.unshift(data.project);
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

    function renderProjectStats() {
        var root = qs('[data-project-stats]');
        if (!root) return;
        var total = state.projects.length;
        var active = state.projects.filter(function (p) { return String(p.status).toLocaleLowerCase('ru').indexOf('работ') !== -1; }).length;
        var avg = total ? Math.round(state.projects.reduce(function (sum, p) { return sum + Number(p.progress || 0); }, 0) / total) : 0;
        var dashboard = state.dashboard || {};
        root.innerHTML =
            stat('Всего объектов', dashboard.projectsCount == null ? total : dashboard.projectsCount) +
            stat('В работе', dashboard.activeProjects == null ? active : dashboard.activeProjects) +
            stat('Прогресс', (dashboard.avgProgress == null ? avg : dashboard.avgProgress) + '%') +
            stat('Нехватки', dashboard.shortagesCount == null ? '—' : dashboard.shortagesCount, dashboard.shortagesCount ? 'danger' : '');
    }

    function stat(label, value, kind) {
        return '<div class="stat-card ' + (kind || '') + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
    }

    function moveTypeLabel(type) {
        return {
            purchase: 'Закупка',
            receipt: 'Поступление',
            use: 'Использовано',
            writeoff: 'Списание'
        }[type] || type || 'Операция';
    }

    function docTypeLabel(type) {
        return {
            contract: 'Договор',
            act: 'Акт',
            photo_report: 'Фотоотчёт',
            finance: 'Финансы',
            file: 'Файл'
        }[type] || type || 'Документ';
    }

    function statusLabel(status) {
        return {
            draft: 'Черновик',
            signed: 'Подписан',
            ready: 'Готов',
            internal: 'Внутренний',
            open: 'Открыто',
            in_progress: 'В работе',
            done: 'Готово'
        }[status] || status || 'Статус';
    }

    function renderProjectCritical() {
        var card = qs('[data-project-critical-card]');
        var root = qs('[data-project-critical]');
        if (!card || !root) return;
        var items = state.dashboard && Array.isArray(state.dashboard.criticalItems) ? state.dashboard.criticalItems : [];
        if (!items.length) {
            card.hidden = true;
            return;
        }
        card.hidden = false;
        root.innerHTML = '<div class="quick-alert-list">' + items.slice(0, 4).map(function (item) {
            return '<div class="quick-alert"><b>' + escapeHtml(item.title) + '</b><span>' + escapeHtml(item.projectTitle) + '</span><strong>' + escapeHtml(item.missingQty) + ' ' + escapeHtml(item.unit) + '</strong></div>';
        }).join('') + '</div>';
    }

    function renderProjectList(projects) {
        var root = qs('[data-projects-list]');
        if (!root) return;
        if (!projects.length) {
            root.innerHTML = '<div class="muted">Объекты пока не найдены.</div>';
            return;
        }
        var criticalByProject = {};
        var criticalItems = state.dashboard && Array.isArray(state.dashboard.criticalItems) ? state.dashboard.criticalItems : [];
        criticalItems.forEach(function (item) {
            criticalByProject[item.projectId] = (criticalByProject[item.projectId] || 0) + 1;
        });
        root.innerHTML = projects.map(function (project) {
            var progress = percent(project.progress);
            var criticalCount = criticalByProject[project.id] || 0;
            return '<article class="project-card ' + (criticalCount ? 'project-risk' : '') + '" data-project-id="' + project.id + '">' +
                '<div class="project-top"><div><h3>' + escapeHtml(project.title) + '</h3><p>' + escapeHtml(project.address) + '</p></div><div class="project-badges"><span class="badge">' + escapeHtml(project.status) + '</span>' + (criticalCount ? '<span class="badge danger">Нехватки: ' + criticalCount + '</span>' : '') + '</div></div>' +
                '<div class="meta-grid">' +
                    '<div><span>Заказчик</span><strong>' + escapeHtml(project.client_name) + '</strong></div>' +
                    '<div><span>Бюджет</span><strong>' + escapeHtml(project.budget == null ? 'Скрыто' : money(project.budget)) + '</strong></div>' +
                    '<div><span>Дедлайн</span><strong>' + escapeHtml(project.deadline_at || '—') + '</strong></div>' +
                '</div>' +
                '<div class="progress-head"><span>Готовность</span><b>' + progress + '%</b></div><div class="progress"><i style="width:' + progress + '%"></i></div>' +
            '</article>';
        }).join('');
        qsa('[data-project-id]', root).forEach(function (card) {
            card.addEventListener('click', function () {
                openProject(Number(card.dataset.projectId));
            });
        });
    }

    function openProject(projectId) {
        var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
        if (!project) return;
        state.selectedProject = project;
        qs('[data-project-detail]').hidden = false;
        qs('[data-detail-title]').textContent = project.title;
        qs('[data-panel="overview"]').innerHTML =
            '<div class="object-actions">' +
                '<a href="/app/warehouse">Склад</a>' +
                '<a href="/app/schedule">График работ</a>' +
                '<a href="/app/logs">Журнал работ</a>' +
                '<a href="/app/chats">Чаты</a>' +
                (state.user && state.user.role === 'director' ? '<a href="/app/reports">Отчётность</a>' : '') +
            '</div>' +
            '<div class="data-grid">' +
                dataItem('Адрес', project.address) +
                dataItem('Заказчик', project.client_name) +
                dataItem('Статус', project.status) +
                dataItem('Прогресс', percent(project.progress) + '%') +
                dataItem('Бюджет', project.budget == null ? 'Скрыто ролью' : money(project.budget)) +
                dataItem('Оплачено', project.paid == null ? 'Скрыто ролью' : money(project.paid)) +
                dataItem('Старт', project.started_at || '—') +
                dataItem('Дедлайн', project.deadline_at || '—') +
            '</div>';
        qs('[data-panel="schedule"]').innerHTML = renderSchedule(project);
        qs('[data-panel="tasks"]').innerHTML = '<p class="muted">Загрузка задач...</p>';
        qs('[data-panel="documents"]').innerHTML = '<p class="muted">Загрузка документов...</p>';
        qs('[data-panel="chat"]').innerHTML = '<p class="muted">Загрузка чатов...</p>';
        qs('[data-panel="ai"]').innerHTML = renderAi(project, []);
        loadMaterials(project.id, function (items) {
            qs('[data-panel="materials"]').innerHTML = renderMaterials(items);
            qs('[data-panel="ai"]').innerHTML = renderAi(project, items);
        });
        loadAnalysis(project.id, function (analysis) {
            qs('[data-panel="ai"]').innerHTML = renderBackendAnalysis(analysis);
        });
        loadStages(project.id, function (stages) {
            if (stages.length) qs('[data-panel="schedule"]').innerHTML = renderStages(stages);
        });
        loadTasks(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
    }

    function dataItem(label, value) {
        return '<div class="data-item"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
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

    function renderMaterials(items) {
        if (!items.length) return '<p class="muted">Материалы по смете пока не загружены.</p>';
        return '<div class="materials-list">' + items.map(materialRow).join('') + '</div>';
    }

    function materialRow(item) {
        var missing = Number(item.missingQty) || 0;
        return '<div class="material-row">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>По смете: ' + item.plannedQty + ' ' + escapeHtml(item.unit) + ' · куплено: ' + item.purchasedQty + ' · использовано: ' + item.usedQty + ' · остаток: ' + item.stockQty + '</small></div>' +
            '<span class="badge ' + (missing > 0 ? 'danger' : '') + '">' + (missing > 0 ? 'Не хватает ' + missing + ' ' + escapeHtml(item.unit) : 'Закрыто') + '</span>' +
        '</div>';
    }

    function loadStages(projectId, callback) {
        api('/api/projects/' + projectId + '/stages').then(function (data) {
            callback(Array.isArray(data.stages) ? data.stages : []);
        }).catch(function () {
            callback([]);
        });
    }

    function renderStages(stages) {
        return '<div class="timeline">' + stages.map(function (stage) {
            var p = percent(stage.progress);
            return '<div class="timeline-row">' +
                '<b>' + escapeHtml(stage.title) + '</b>' +
                '<span>' + escapeHtml((stage.planned_start || '—') + ' → ' + (stage.planned_end || '—') + ' · ' + (stage.responsible || '')) + '</span>' +
                '<i style="width:' + p + '%"></i>' +
                '<strong>' + p + '%</strong>' +
            '</div>';
        }).join('') + '</div>';
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
            return '<div class="material-row"><div><b>' + escapeHtml(task.title) + '</b><small>' + escapeHtml(task.description || '') + ' · срок: ' + escapeHtml(task.due_at || '—') + '</small></div><span class="badge ' + (task.priority === 'high' ? 'danger' : '') + '">' + escapeHtml(statusLabel(task.status)) + '</span></div>';
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

    function loadDocuments(projectId) {
        api('/api/projects/' + projectId + '/documents').then(function (data) {
            var docs = Array.isArray(data.documents) ? data.documents : [];
            qs('[data-panel="documents"]').innerHTML = docs.length
                ? '<div class="materials-list">' + docs.map(function (doc) {
                    return '<div class="material-row"><div><b>' + escapeHtml(doc.title) + '</b><small>' + escapeHtml(docTypeLabel(doc.doc_type)) + '</small></div><span class="badge">' + escapeHtml(statusLabel(doc.status)) + '</span></div>';
                }).join('') + '</div>'
                : '<p class="muted">Документы пока не загружены.</p>';
        }).catch(function () {
            qs('[data-panel="documents"]').innerHTML = '<p class="muted">Документы недоступны.</p>';
        });
    }

    function loadProjectChats(projectId) {
        api('/api/projects/' + projectId + '/chats').then(function (data) {
            var chats = Array.isArray(data.chats) ? data.chats : [];
            if (!chats.length) {
                qs('[data-panel="chat"]').innerHTML = '<p class="muted">Чаты пока не созданы.</p>';
                return;
            }
            renderChat(chats[0]);
        }).catch(function () {
            qs('[data-panel="chat"]').innerHTML = '<p class="muted">Чаты недоступны для этой роли.</p>';
        });
    }

    function renderChat(chat) {
        api('/api/chats/' + chat.id + '/messages').then(function (data) {
            var messages = Array.isArray(data.messages) ? data.messages : [];
            qs('[data-panel="chat"]').innerHTML =
                '<div class="chat-window compact-chat">' +
                    messages.map(function (message) {
                        return '<div class="message"><b>' + escapeHtml(message.author_name) + '</b><p>' + escapeHtml(message.body) + '</p></div>';
                    }).join('') +
                    '<form class="chat-compose" data-chat-form data-chat-id="' + chat.id + '"><input name="body" placeholder="Сообщение"><button type="submit">Отправить</button></form>' +
                '</div>';
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
            ? 'Есть нехватка: ' + critical.map(function (item) { return item.title + ' — ' + item.missingQty + ' ' + item.unit; }).join(', ') + '. Нужно создать заявку на закупку, чтобы не сорвать график.'
            : 'Критичных нехваток по материалам пока нет. Следи за фактическими списаниями и сроками этапов.';
        return '<div class="card"><h3>AI-анализ объекта</h3><p class="muted">' + escapeHtml(text) + '</p></div>';
    }

    function loadAnalysis(projectId, callback) {
        api('/api/projects/' + projectId + '/analysis').then(callback).catch(function () {
            callback(null);
        });
    }

    function renderBackendAnalysis(analysis) {
        if (!analysis) return '<p class="muted">AI-анализ пока недоступен.</p>';
        return '<div class="analysis-strip">' +
                '<div class="analysis-pill"><span>Прогресс объекта</span><strong>' + escapeHtml(analysis.projectProgress) + '%</strong></div>' +
                '<div class="analysis-pill"><span>График работ</span><strong>' + escapeHtml(analysis.stageProgress) + '%</strong></div>' +
                '<div class="analysis-pill"><span>Материалы закрыты</span><strong>' + escapeHtml(analysis.materialPurchaseProgress) + '%</strong></div>' +
                '<div class="analysis-pill"><span>Нехватки</span><strong>' + escapeHtml(analysis.shortagesCount) + '</strong></div>' +
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
        root.innerHTML = '<p class="muted">Загрузка общей ведомости склада...</p>';
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
            root.innerHTML = '<p class="muted">Материалы пока не загружены. Импортируй смету от бота — и здесь появится общий склад по всем объектам.</p>';
            return;
        }
        root.innerHTML =
            '<div class="warehouse-table-wrap"><table class="warehouse-table">' +
                '<thead><tr>' +
                    '<th>Объект</th><th>Материал</th><th>Ед.</th><th>Смета</th><th>Куплено</th><th>Поступило</th><th>Использовано</th><th>Остаток</th><th>Нехватка</th><th>Статус</th>' +
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
            '<td><b>' + escapeHtml(item.title) + '</b><small>готовность закупки: ' + escapeHtml(item.purchaseProgress) + '%</small></td>' +
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

    function renderSchedulePage() {
        var root = qs('[data-schedule-list]');
        if (!root) return;
        if (!state.projects.length) {
            root.innerHTML = '<p class="muted">Нет объектов для графика.</p>';
            return;
        }
        root.innerHTML = '<p class="muted">Загрузка графика...</p>';
        Promise.all(state.projects.map(function (project) {
            return api('/api/projects/' + project.id + '/stages').then(function (data) {
                return { project: project, stages: Array.isArray(data.stages) ? data.stages : [] };
            }).catch(function () {
                return { project: project, stages: [] };
            });
        })).then(function (groups) {
            root.innerHTML = groups.map(function (group) {
                return '<section class="schedule-project"><h4>' + escapeHtml(group.project.title) + '</h4>' + renderStages(group.stages) + '</section>';
            }).join('');
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
        if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
        if (state.user && ['client', 'buyer'].indexOf(state.user.role) !== -1) {
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
            stat('Отчётов', logs.length) +
            stat('Видно заказчику', visible) +
            stat('Внутренние', internal) +
            stat('Людей в отчётах', workers) +
            stat('С блокерами', blockers, blockers ? 'danger' : '');
    }

    function renderLogsList(project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        if (!logs.length) {
            root.innerHTML = '<p class="muted">По объекту «' + escapeHtml(project.title) + '» пока нет дневных отчётов.</p>';
            return;
        }
        root.innerHTML = logs.map(function (log) {
            return '<article class="log-card">' +
                '<div class="log-top">' +
                    '<div><span>' + escapeHtml(log.report_date || '—') + '</span><h4>' + escapeHtml(log.title) + '</h4></div>' +
                    '<div class="project-badges"><span class="badge">' + escapeHtml(log.workers_count || 0) + ' чел.</span>' +
                    '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + (Number(log.is_client_visible) === 1 ? 'Видно заказчику' : 'Внутренний') + '</span></div>' +
                '</div>' +
                '<p>' + escapeHtml(log.work_done) + '</p>' +
                '<div class="log-details">' +
                    (log.equipment ? '<div><span>Техника</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                    (log.blockers ? '<div class="log-risk"><span>Блокер</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                    (log.next_steps ? '<div><span>Дальше</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                '</div>' +
                '<small class="muted">Автор: ' + escapeHtml(log.author_name || '—') + '</small>' +
            '</article>';
        }).join('');
    }

    function bindLogForm() {
        var form = qs('[data-log-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-log-error]');
            if (error) error.classList.remove('active');
            var projectId = Number(form.project_id.value);
            api('/api/projects/' + projectId + '/daily-logs', {
                method: 'POST',
                body: JSON.stringify({
                    report_date: form.report_date.value,
                    title: form.title.value.trim(),
                    work_done: form.work_done.value.trim(),
                    workers_count: Number(form.workers_count.value || 0),
                    equipment: form.equipment.value.trim(),
                    blockers: form.blockers.value.trim(),
                    next_steps: form.next_steps.value.trim(),
                    is_client_visible: form.is_client_visible.value === '1'
                })
            }).then(function () {
                var keepProject = form.project_id.value;
                form.reset();
                form.project_id.value = keepProject;
                form.report_date.value = new Date().toISOString().slice(0, 10);
                var pageSelect = qs('[data-logs-project]');
                if (pageSelect) pageSelect.value = keepProject;
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || state.projects[0];
                loadProjectLogs(projectId, function (logs) {
                    renderLogsStats(logs);
                    renderLogsList(project, logs);
                });
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить отчёт';
                    error.classList.add('active');
                }
            });
        });
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
                list.innerHTML = '<p class="muted">Чаты пока не созданы.</p>';
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

    function initUsersPage() {
        loadUsers();
        var refresh = qs('[data-users-refresh]');
        if (refresh) refresh.addEventListener('click', loadUsers);
        var form = qs('[data-user-create-form]');
        if (!form) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-user-create-error]');
            if (error) error.classList.remove('active');
            api('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name.value.trim(),
                    login: form.login.value.trim(),
                    password: form.password.value,
                    role: form.role.value
                })
            }).then(function () {
                form.reset();
                loadUsers();
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось создать пользователя';
                    error.classList.add('active');
                }
            });
        });
    }

    function loadUsers() {
        var root = qs('[data-users-list]');
        if (!root) return;
        api('/api/admin/users').then(function (data) {
            var users = Array.isArray(data.users) ? data.users : [];
            root.innerHTML = '<div class="users-list">' + users.map(function (user) {
                return '<div class="user-row"><div><b>' + escapeHtml(user.name) + '</b><small>' + escapeHtml(user.login) + '</small></div><span class="badge">' + escapeHtml(user.roleLabel || user.role) + '</span></div>';
            }).join('') + '</div>';
        }).catch(function () {
            root.innerHTML = '<p class="muted">Список пользователей доступен только директору.</p>';
        });
    }

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
            if (ai) ai.textContent = 'Отчётность доступна только директору.';
        });
    }

    if (page === 'login') initLogin();
    else initShell();
})();
