(function () {
    'use strict';

    var page = document.body.dataset.page;
    var APP_TODAY = '2026-07-27';
    var state = {
        user: null,
        projects: [],
        users: [],
        roles: [],
        companies: [],
        selectedProject: null,
        stagesByProject: {},
        materialsByProject: {},
        materialInsightsByProject: {},
        marketAnalysisByProject: {},
        notificationsByProject: {},
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

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
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
        options = options || {};
        options.credentials = 'same-origin';
        return authHeaders().then(function (headers) {
            options.headers = Object.assign({ Accept: 'application/json' }, headers, options.headers || {});
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
        });
    }

    function apiFormData(path, formData, options) {
        options = options || {};
        return authHeaders().then(function (headers) {
            return fetch(path, {
                method: options.method || 'POST',
                body: formData,
                credentials: 'same-origin',
                headers: Object.assign({ Accept: 'application/json' }, headers, options.headers || {})
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
        });
    }

    function money(value) {
        return new Intl.NumberFormat('ru-RU').format(Number(value) || 0) + ' ₽';
    }

    function percent(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function isoDateAdd(isoDate, days) {
        if (!isoDate) return '';
        var date = new Date(isoDate + 'T00:00:00');
        date.setDate(date.getDate() + Number(days || 0));
        return date.toISOString().slice(0, 10);
    }

    function formatRuDate(isoDate) {
        if (!isoDate) return '—';
        var date = new Date(isoDate + 'T00:00:00');
        if (isNaN(date.getTime())) return isoDate;
        return new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
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
        if (role === 'buyer') return 'purchaser';
        if (role === 'client') return 'customer';
        return role;
    }

    function hasRole(role) {
        if (!state.user) return false;
        var current = normalizeRole(state.user.role);
        if (current === role) return true;
        var roles = Array.isArray(state.user.roles) ? state.user.roles : [];
        return roles.map(normalizeRole).indexOf(role) !== -1;
    }

    function isAdminRole() {
        return hasRole('admin') || hasRole('director');
    }

    function canSeeFinances() {
        return hasRole('admin') || hasRole('director') || hasRole('financier') || hasRole('accountant');
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
        node.textContent = state.user.name + ' • ' + state.user.roleLabel;
    }

    function applyRole() {
        if (!state.user) return;
        state.user.role = normalizeRole(state.user.role);
        document.body.classList.add('role-' + state.user.role);
        qsa('[data-director-only]').forEach(function (node) {
            if (!isAdminRole()) node.remove();
        });
        qsa('[data-director-action]').forEach(function (node) {
            if (!isAdminRole()) node.remove();
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
        if (page === 'suppliers') loadProjects(initSuppliersPage);
        if (page === 'schedule') loadProjects(renderSchedulePage);
        if (page === 'logs') loadProjects(renderLogsPage);
        if (page === 'chats') loadProjects(renderChatsPage);
        if (page === 'users') initUsersPage();
        if (page === 'companies') initCompaniesPage();
        if (page === 'reports') initReportsPage();
    }

    function loadProjects(callback) {
        api('/api/projects').then(function (data) {
            state.projects = Array.isArray(data.projects) ? data.projects : [];
            if (page === 'projects' && qs('[data-projects-list]')) {
                renderProjectList(state.projects);
            }
            callback();
        }).catch(function () {
            if (page === 'projects' && qs('[data-projects-list]')) {
                qs('[data-projects-list]').innerHTML = '<div class="muted">Не удалось загрузить объекты. Обнови страницу или войди заново.</div>';
            }
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
            if (callback) callback(state.companies);
        }).catch(function () {
            state.companies = [];
            if (callback) callback(state.companies);
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
    }

    function renderDashboardStats(data) {
        var root = qs('[data-dashboard-stats]');
        if (!root) return;
        var html =
            stat('Объектов', data.projectsCount == null ? 0 : data.projectsCount) +
            stat('В работе', data.activeProjects == null ? 0 : data.activeProjects) +
            stat('Открытых задач', data.openTasksCount == null ? 0 : data.openTasksCount, data.openTasksCount ? 'warn' : '');
        if (state.user && isAdminRole()) {
            html +=
                stat('Бюджет', data.totalBudget == null ? 'Скрыто' : money(data.totalBudget)) +
                stat('Оплачено', data.totalPaid == null ? 'Скрыто' : money(data.totalPaid)) +
                stat('Маржа', data.profitNow == null ? 'Скрыто' : money(data.profitNow), data.profitNow < 0 ? 'danger' : '');
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
                return '<div class="risk-item"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + '</small></div><span class="badge danger">+' + escapeHtml(item.missingQty) + ' ' + escapeHtml(item.unit) + '</span></div>';
            }).join('') + '</div>'
            : '<p class="muted">Критичных нехваток и блокеров сейчас не видно. Держим темп по объектам и ежедневно фиксируем факт.</p>';
    }

    function renderStrongProgress(progress, label, large) {
        var safeProgress = percent(progress);
        var sizeClass = large ? ' progress-strong-lg' : '';
        return '<div class="progress-strong' + sizeClass + '">' +
            '<div class="progress-strong-head"><span>' + escapeHtml(label || 'Готовность') + '</span><strong>' + safeProgress + '%</strong></div>' +
            '<div class="progress progress-strong-track"><i style="width:' + safeProgress + '%"></i></div>' +
        '</div>';
    }

    function renderProjectsPage() {
        if (isAdminRole()) {
            loadCompanies(populateProjectCompanySelects);
        }
        bindProjectCreate();
        bindProjectBootstrapForm();
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
            state.selectedProject = null;
            qs('[data-project-detail]').hidden = true;
            setProjectFocusMode(false);
        });
        qsa('[data-tab]').forEach(function (button) {
            if (state.user && hasRole('customer') && ['execution', 'materials', 'tasks', 'finance'].indexOf(button.dataset.tab) !== -1) {
                button.remove();
                return;
            }
            if (button.dataset.tab === 'finance' && !canSeeFinances()) {
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
        var tab = qs('[data-tab="' + tabName + '"]');
        var panel = qs('[data-panel="' + tabName + '"]');
        if (!tab || !panel) return;
        qsa('[data-tab]').forEach(function (node) { node.classList.remove('active'); });
        qsa('[data-panel]').forEach(function (node) { node.classList.remove('active'); });
        tab.classList.add('active');
        panel.classList.add('active');
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

    function stat(label, value, kind) {
        return '<div class="stat-card ' + (kind || '') + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
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
            normal: 'Обычный',
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
        var sortedProjects = projects.slice().sort(function (left, right) {
            var leftCompleted = isCompletedProject(left) ? 1 : 0;
            var rightCompleted = isCompletedProject(right) ? 1 : 0;
            if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;
            return Number(right.id) - Number(left.id);
        });
        var criticalByProject = {};
        var criticalItems = state.dashboard && Array.isArray(state.dashboard.criticalItems) ? state.dashboard.criticalItems : [];
        criticalItems.forEach(function (item) {
            criticalByProject[item.projectId] = (criticalByProject[item.projectId] || 0) + 1;
        });
        root.innerHTML = sortedProjects.map(function (project) {
            var progress = percent(project.progress);
            var criticalCount = criticalByProject[project.id] || 0;
            var completed = isCompletedProject(project);
            var riskBadge = (!completed && criticalCount) ? '<span class="badge danger">Нехватки: ' + criticalCount + '</span>' : '';
            var statusBadge = completed ? '<span class="badge success">Завершен</span>' : '<span class="badge">' + escapeHtml(project.status) + '</span>';
            return '<article class="project-card ' + (completed ? 'project-completed ' : '') + (!completed && criticalCount ? 'project-risk' : '') + '" data-project-id="' + project.id + '">' +
                '<div class="project-top"><div><h3>' + escapeHtml(project.title) + '</h3><p>' + escapeHtml(project.address) + '</p></div><div class="project-badges">' + statusBadge + riskBadge + '</div></div>' +
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

    function renderProjectList(projects) {
        var root = qs('[data-projects-list]');
        if (!root) return;
        if (!projects.length) {
            root.innerHTML = '<div class="muted">Объекты пока не найдены.</div>';
            return;
        }
        var sortedProjects = projects.slice().sort(function (left, right) {
            var leftCompleted = isCompletedProject(left) ? 1 : 0;
            var rightCompleted = isCompletedProject(right) ? 1 : 0;
            if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;
            return Number(right.id) - Number(left.id);
        });
        var criticalByProject = {};
        var criticalItems = state.dashboard && Array.isArray(state.dashboard.criticalItems) ? state.dashboard.criticalItems : [];
        criticalItems.forEach(function (item) {
            criticalByProject[item.projectId] = (criticalByProject[item.projectId] || 0) + 1;
        });
        root.innerHTML = sortedProjects.map(function (project) {
            var progress = percent(project.progress);
            var criticalCount = criticalByProject[project.id] || 0;
            var completed = isCompletedProject(project);
            var riskBadge = (!completed && criticalCount) ? '<span class="badge danger">Нехватки: ' + criticalCount + '</span>' : '';
            var statusBadge = completed ? '<span class="badge success">Завершен</span>' : '<span class="badge">' + escapeHtml(project.status || 'В работе') + '</span>';
            return '<article class="project-card ' + (completed ? 'project-completed ' : '') + (!completed && criticalCount ? 'project-risk' : '') + '" data-project-id="' + project.id + '">' +
                '<div class="project-top"><div><h3>' + escapeHtml(project.title) + '</h3><p>' + escapeHtml(project.address || 'Адрес не указан') + '</p></div><div class="project-badges">' + statusBadge + riskBadge + '</div></div>' +
                '<div class="meta-grid">' +
                    '<div><span>Заказчик</span><strong>' + escapeHtml(project.client_name || 'Не указан') + '</strong></div>' +
                    '<div><span>Бюджет</span><strong>' + escapeHtml(project.budget == null ? 'Скрыто' : money(project.budget)) + '</strong></div>' +
                    '<div><span>Дедлайн</span><strong>' + escapeHtml(project.deadline_at || '—') + '</strong></div>' +
                '</div>' +
                renderStrongProgress(progress, 'Готовность объекта', false) +
            '</article>';
        }).join('');
        qsa('[data-project-id]', root).forEach(function (card) {
            card.addEventListener('click', function () {
                openProject(Number(card.dataset.projectId));
            });
        });
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

    renderScheduleRows = function (stages, customerMode) {
        var today = APP_TODAY;
        if (!stages.length) return '<p class="muted">Нет этапов для отображения.</p>';
        return '<div class="timeline">' + stages.map(function (stage) {
            var start = customerMode ? (stage.customer_start || stage.planned_start || '—') : (stage.planned_start || '—');
            var end = customerMode ? (stage.customer_end || stage.planned_end || '—') : (stage.planned_end || '—');
            var summary = customerMode
                ? (start + ' — ' + end + ' • ' + statusLabel(stage.status_code))
                : buildScheduleStageSummary(stage, today);
            var kicker = [timelineStageKindLabel(stage), !customerMode ? (stage.responsible || '') : ''].filter(Boolean).join(' • ');
            return '<div class="timeline-row ' + scheduleTimelineClass(stage, today) + timelineStageKindClass(stage) + '">' +
                '<div class="timeline-main">' +
                    (kicker ? '<small class="timeline-kicker">' + escapeHtml(kicker) + '</small>' : '') +
                    '<b>' + escapeHtml(stage.title) + '</b><span>' + escapeHtml(summary) + '</span>' +
                '</div>' +
                renderTimelineProgressCell(stage) +
                '<div class="timeline-badges">' + renderScheduleStageBadges(stage, today, customerMode) + '</div>' +
            '</div>';
        }).join('') + '</div>';
    };

    renderSectionScheduleRow = function (section, range) {
        var planStyle = scheduleBarStyle(section.startDate, section.endDate, range);
        var assumptionBadge = section.hasAssumptions ? '<span class="badge warn">Есть допущения</span>' : '<span class="badge success">По нормам</span>';
        var sources = Array.isArray(section.sources) ? section.sources.slice(0, 3) : [];
        var items = Array.isArray(section.items) ? section.items : [];
        return '<article class="section-schedule-card' + sectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-title">' +
                    '<div><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml((section.startDate || '—') + ' - ' + (section.endDate || '—')) + '</small></div>' +
                    '<div class="project-badges">' +
                        '<span class="badge">' + escapeHtml(String(section.workItems || items.length || 0) + ' работ') + '</span>' +
                        '<span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span>' +
                        '<span class="badge success">' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</span>' +
                        assumptionBadge +
                    '</div>' +
                '</div>' +
                '<div class="section-schedule-track">' +
                    '<div class="schedule-gantt-track">' +
                        '<span class="schedule-gantt-today" style="left:' + scheduleTodayPercent(range) + '%"></span>' +
                        (planStyle ? '<span class="schedule-gantt-bar schedule-gantt-plan" style="' + planStyle + '"></span>' : '') +
                    '</div>' +
                    '<div class="section-schedule-track-meta"><span>Плановый интервал</span><strong>' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</strong></div>' +
                '</div>' +
                '<div class="section-schedule-meta">' +
                    '<strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong>' +
                    '<span>' + escapeHtml('чисто по нормам: ' + String(section.estimatedHours || 0) + ' чел.-ч') + '</span>' +
                '</div>' +
                (sources.length ? '<div class="section-schedule-sources">' + sources.map(function (source) {
                    var label = escapeHtml(source.label || 'Источник');
                    if (source.url) {
                        return '<a href="' + escapeHtml(source.url) + '" target="_blank" rel="noreferrer">' + label + '</a>';
                    }
                    return '<span>' + label + '</span>';
                }).join('') + '</div>' : '') +
                '<div class="section-schedule-items">' + items.slice(0, 8).map(function (item) {
                    return '<div class="section-schedule-item">' +
                        '<span>' + escapeHtml(item.title) + '</span>' +
                        '<small>' + escapeHtml(String(item.planned_qty) + ' ' + item.unit + ' • ' + Math.round(Number(item.estimated_hours || 0) * 10) / 10 + ' чел.-ч') + '</small>' +
                    '</div>';
                }).join('') + (items.length > 8 ? '<div class="section-schedule-item more"><span>Еще работ: ' + escapeHtml(String(items.length - 8)) + '</span></div>' : '') + '</div>' +
            '</div>' +
        '</article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div>' +
                '<div class="section-schedule-empty">Собираем расчет по смете...</div>' +
            '</section>';
        }
        if (summary.error) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div>' +
                '<div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div>' +
            '</section>';
        }
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div>' +
            '</section>';
        }
        var range = {
            start: summary.startDate,
            end: summary.finishDate,
            totalDays: Math.max(1, Number(summary.totalDays || 1))
        };
        return '<section class="card section-schedule-board">' +
            '<div class="card-head">' +
                '<div><h3>График по разделам сметы</h3><span class="muted">Последовательность разделов и плановое окно по каждому разделу.</span></div>' +
                '<button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button>' +
            '</div>' +
            '<div class="execution-summary">' +
                stat('Старт', summary.startDate || '—') +
                stat('Финиш', summary.finishDate || '—') +
                stat('Разделов', String(sections.length)) +
                stat('Дней', String(summary.totalDays || 0)) +
                stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) +
                stat('Основа', 'Работы сметы') +
            '</div>' +
            renderScheduleScale(range) +
            '<div class="section-schedule-list">' + sections.map(function (section) {
                return renderSectionScheduleRow(section, range);
            }).join('') + '</div>' +
        '</section>';
    };

    function finalFormatScheduleDate(iso) {
        if (!iso) return '—';
        var parts = String(iso).split('-');
        if (parts.length !== 3) return iso;
        return parts[2] + '.' + parts[1] + '.' + parts[0];
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

    renderSectionScheduleRow = function (section, range) {
        var planStyle = scheduleBarStyle(section.startDate, section.endDate, range);
        var assumptionBadge = section.hasAssumptions ? '<span class="badge warn">Есть допущения</span>' : '<span class="badge success">По нормам</span>';
        var items = Array.isArray(section.items) ? section.items : [];
        var topItems = items.slice(0, 3).map(function (item) { return item.title; }).filter(Boolean).join(' • ');
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-title">' +
                    '<div><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml(finalFormatScheduleDate(section.startDate) + ' - ' + finalFormatScheduleDate(section.endDate)) + '</small></div>' +
                    '<div class="project-badges"><span class="badge">' + escapeHtml(String(section.workItems || items.length || 0) + ' работ') + '</span><span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span><span class="badge success">' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</span>' + assumptionBadge + '</div>' +
                '</div>' +
                '<div class="section-schedule-track"><div class="schedule-gantt-track"><span class="schedule-gantt-today" style="left:' + scheduleTodayPercent(range) + '%"></span>' + (planStyle ? '<span class="schedule-gantt-bar schedule-gantt-plan" style="' + planStyle + '"></span>' : '') + '</div><div class="section-schedule-track-meta"><span>Плановый интервал</span><strong>' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</strong></div></div>' +
                '<div class="section-schedule-meta"><strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong><span>' + escapeHtml('чисто по нормам: ' + String(section.estimatedHours || 0) + ' чел.-ч') + '</span></div>' +
                '<div class="section-schedule-reco"><span>Как ускорить</span><strong>' + escapeHtml(sectionAccelerationHint(section)) + '</strong></div>' +
                (topItems ? '<div class="section-schedule-caption">' + escapeHtml(topItems) + '</div>' : '') +
            '</div>' +
        '</article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">Собираем расчет по смете...</div></section>';
        if (summary.error) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div></section>';
        var range = { start: summary.startDate, end: summary.finishDate, totalDays: Math.max(1, Number(summary.totalDays || 1)) };
        return '<section class="card section-schedule-board">' +
            '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Последовательность разделов и плановое окно по каждому разделу.</span></div><button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button></div>' +
            '<div class="execution-summary">' +
                stat('Старт', finalFormatScheduleDate(summary.startDate)) +
                stat('Финиш', finalFormatScheduleDate(summary.finishDate)) +
                stat('Разделов', String(sections.length)) +
                stat('Дней', String(summary.totalDays || 0)) +
                stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) +
                stat('Основа', 'Работы сметы') +
            '</div>' +
            '<div class="section-schedule-brief-list">' + sections.map(function (section) { return renderSectionScheduleBrief(section); }).join('') + '</div>' +
            renderScheduleScale(range) +
            '<div class="section-schedule-list">' + sections.map(function (section) { return renderSectionScheduleRow(section, range); }).join('') + '</div>' +
        '</section>';
    };

    renderSchedulePanel = function (stages, project) {
        var planner = renderSchedulePlanner(project, stages);
        var forecast = renderSectionScheduleForecast(project);
        return planner + forecast;
        var internal = stages;
        var customer = stages.filter(function (stage) { return Number(stage.is_client_visible) === 1; });
        return planner + forecast + '<div class="schedule-split">' +
            '<section class="card schedule-card"><div class="card-head"><h3>Внутренний график</h3></div>' + renderScheduleRows(internal, false) + '</section>' +
            '<section class="card schedule-card"><div class="card-head"><h3>График для заказчика</h3></div>' + renderScheduleRows(customer, true) + '</section>' +
        '</div>';
    };

    function openProject(projectId) {
        var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
        if (!project) return;
        state.selectedProject = project;
        setProjectFocusMode(true);
        qs('[data-project-detail]').hidden = false;
        qs('[data-detail-title]').textContent = project.title;
        activateProjectTab('overview');
        var detailCard = qs('[data-project-detail]');
        if (detailCard && typeof detailCard.scrollIntoView === 'function') {
            detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var focusRoot = qs('[data-project-focus]');
        if (!focusRoot) {
            var overviewPanel = qs('[data-panel="overview"]');
            if (overviewPanel) {
                overviewPanel.insertAdjacentHTML('beforebegin', '<section class="project-focus" data-project-focus></section>');
                focusRoot = qs('[data-project-focus]');
            }
        }
        if (focusRoot) focusRoot.innerHTML = renderProjectFocus(project) + renderStrongProgress(percent(project.progress), 'Текущая готовность', true);
        qs('[data-panel="overview"]').innerHTML =
            '<div class="object-actions">' +
                '<a href="/app/warehouse">Склад</a>' +
                '<a href="/app/schedule">График работ</a>' +
                '<a href="/app/logs">Журнал работ</a>' +
                '<a href="/app/chats">Чаты</a>' +
                (state.user && isAdminRole() ? '<a href="/app/reports">Отчетность</a>' : '') +
            '</div>' +
            '<div class="data-grid">' +
                dataItem('Адрес', project.address || 'Не указано') +
                dataItem('Город', project.city || 'Не указано') +
                dataItem('Регион', project.region || 'Не указано') +
                dataItem('Заказчик', project.client_name || 'Не указано') +
                dataItem('Номер договора', project.contract_no || 'Не указано') +
                dataItem('Дата договора', project.contract_date || '—') +
                dataItem('Статус', project.status || 'Подготовка') +
                dataItem('Прогресс', percent(project.progress) + '%') +
                dataItem('Бюджет', project.budget == null ? 'Скрыто ролью' : money(project.budget)) +
                dataItem('Оплачено', project.paid == null ? 'Скрыто ролью' : money(project.paid)) +
                dataItem('Старт', project.started_at || '—') +
                dataItem('Дедлайн', project.deadline_at || '—') +
            '</div>' +
            (project.description ? '<div class="object-description">' + escapeHtml(project.description) + '</div>' : '') +
            '<section class="subsection"><div class="card-head"><h3>Назначения на объект</h3></div><div data-project-assignments>Загрузка назначений...</div></section>';
        qs('[data-panel="execution"]').innerHTML = '<p class="muted">Загрузка структуры объекта...</p>';
        qs('[data-panel="schedule"]').innerHTML = renderSchedule(project);
        qs('[data-panel="tasks"]').innerHTML = '<p class="muted">Загрузка задач...</p>';
        qs('[data-panel="documents"]').innerHTML = '<p class="muted">Загрузка документов...</p>';
        qs('[data-panel="chat"]').innerHTML = '<p class="muted">Загрузка чатов...</p>';
        qs('[data-panel="ai"]').innerHTML = renderAi(project, []);
        loadMaterials(project.id, function (items) {
            var overview = qs('[data-panel="overview"]');
            if (overview && !qs('[data-project-overview-materials]', overview)) {
                overview.insertAdjacentHTML('beforeend', '<section class="subsection"><div class="card-head"><h3>Материалы по смете и складу</h3></div><div data-project-overview-materials></div></section>');
            }
            var overviewMaterials = qs('[data-project-overview-materials]', overview || document);
            loadMaterialInsights(project.id, function (insights) {
                qs('[data-panel="materials"]').innerHTML = renderMaterials(items, project.id, insights);
                if (overviewMaterials) overviewMaterials.innerHTML = renderMaterials(items, project.id, insights);
                bindProjectChainActions();
                qs('[data-panel="ai"]').innerHTML = renderAi(project, items);
            });
        });
        loadAnalysis(project.id, function (analysis) {
            qs('[data-panel="ai"]').innerHTML = renderBackendAnalysis(analysis);
        });
        loadStages(project.id, function (stages) {
            qs('[data-panel="execution"]').innerHTML = renderExecutionPanel(stages, project.id);
            qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, project);
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            loadExecutionInsights(project.id, stages);
        });
        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
    }

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

    function loadProjectAssignments(projectId) {
        var root = qs('[data-project-assignments]');
        if (!root) return;
        loadProjectHub(projectId, state.selectedProject);
        api('/api/projects/' + projectId + '/assignments').then(function (data) {
            var assignments = Array.isArray(data.assignments) ? data.assignments : [];
            if (!isAdminRole()) {
                renderProjectAssignments(projectId, assignments);
                return;
            }
            loadRoles(function () {
                loadUserDirectory(function () {
                    renderProjectAssignments(projectId, assignments);
                });
            });
        }).catch(function () {
            root.innerHTML = '<p class="muted">Не удалось загрузить назначения.</p>';
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
        root.innerHTML = rows + (isAdminRole() ? renderAssignmentForm() : '');
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
            callback(state.materialInsightsByProject[projectId]);
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
            offers.forEach(function (offer) {
                var materialId = Number(offer.estimate_item_id || 0);
                if (!materialId) return;
                if (!insights[materialId]) {
                    insights[materialId] = {
                        total: 0,
                        selected: 0,
                        quoted: 0,
                        called: 0,
                        selectedName: '',
                        selectedOfferId: 0,
                        options: []
                    };
                }
                insights[materialId].total += 1;
                if (offer.status === 'selected') insights[materialId].selected += 1;
                if (offer.status === 'quoted') insights[materialId].quoted += 1;
                if (offer.status === 'called') insights[materialId].called += 1;
                if (offer.status === 'selected' && !insights[materialId].selectedName) {
                    insights[materialId].selectedName = offer.candidate_name || offer.company_name || '';
                    insights[materialId].selectedOfferId = Number(offer.id || 0);
                }
                insights[materialId].options.push({
                    id: Number(offer.id || 0),
                    name: offer.candidate_name || offer.company_name || 'Поставщик',
                    company: offer.company_name || '',
                    status: offer.status || 'new',
                    price: Number(offer.price || 0),
                    qty: Number(offer.qty || 0),
                    phone: offer.phone || '',
                    sourceUrl: offer.source_url || '',
                    notes: offer.notes || ''
                });
            });
            state.materialInsightsByProject[projectId] = insights;
            callback(insights);
        }).catch(function () {
            state.materialInsightsByProject[projectId] = {};
            callback({});
        });
    }

    function loadProjectMarketAnalysis(projectId, kind, callback, force) {
        kind = kind === 'work' ? 'work' : 'material';
        if (!state.marketAnalysisByProject[projectId]) state.marketAnalysisByProject[projectId] = {};
        var cache = state.marketAnalysisByProject[projectId][kind];
        if (!force && cache && cache.rows) {
            callback(cache);
            return;
        }
        if (cache && cache.loading) return;
        state.marketAnalysisByProject[projectId][kind] = { loading: true, rows: [] };
        api('/api/projects/' + projectId + '/market-analysis?kind=' + kind).then(function (data) {
            state.marketAnalysisByProject[projectId][kind] = {
                loading: false,
                error: '',
                rows: Array.isArray(data.rows) ? data.rows : [],
                summary: data.summary || {},
                estimateId: data.estimateId || ''
            };
            callback(state.marketAnalysisByProject[projectId][kind]);
        }).catch(function (error) {
            state.marketAnalysisByProject[projectId][kind] = {
                loading: false,
                error: (error && error.payload && error.payload.error) || 'market_analysis_failed',
                rows: [],
                summary: {}
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

    function bindProjectChainActions() {
        qsa('[data-supplier-toggle]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                var picker = button.closest('.material-supplier-picker');
                var menu = picker ? qs('[data-supplier-menu]', picker) : null;
                if (!menu) return;
                qsa('[data-supplier-menu]').forEach(function (node) {
                    if (node !== menu) node.hidden = true;
                });
                menu.hidden = !menu.hidden;
            });
        });

        qsa('[data-supplier-select]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                var projectId = Number(button.dataset.projectId || 0);
                var offerId = Number(button.dataset.offerId || 0);
                if (!projectId || !offerId) return;
                button.disabled = true;
                api('/api/supplier-offers/' + offerId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        status: 'selected',
                        price: Number(button.dataset.price || 0),
                        qty: Number(button.dataset.qty || 0),
                        phone: button.dataset.phone || '',
                        source_url: button.dataset.sourceUrl || '',
                        notes: button.dataset.notes || ''
                    })
                }).then(function () {
                    delete state.materialInsightsByProject[projectId];
                    loadMaterialInsights(projectId, function (insights) {
                        if (state.materialsByProject[projectId]) {
                            var materialsHtml = renderMaterials(state.materialsByProject[projectId], projectId, insights || {});
                            var materialsPanel = qs('[data-panel="materials"]');
                            if (materialsPanel && state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                                materialsPanel.innerHTML = materialsHtml;
                            }
                            var overviewMaterials = qs('[data-project-overview-materials]');
                            if (overviewMaterials && state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                                overviewMaterials.innerHTML = materialsHtml;
                            }
                            bindProjectChainActions();
                        }
                    });
                }).finally(function () {
                    button.disabled = false;
                });
            });
        });

        if (!document.body.dataset.materialSupplierMenuBound) {
            document.body.dataset.materialSupplierMenuBound = '1';
            document.addEventListener('click', function () {
                qsa('[data-supplier-menu]').forEach(function (node) { node.hidden = true; });
            });
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
        var insights = '<div class="execution-insights" data-execution-insights><p class="muted">Собираем сводку по задачам и отчетам...</p></div>';
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

    function renderSchedulePanel(stages, project) {
        var planner = renderSchedulePlanner(project, stages);
        var controlBoard = renderScheduleStateBoard(project);
        if (!stages.length) return planner + controlBoard + renderSchedule(project);
        var internal = stages;
        var customer = stages.filter(function (stage) { return Number(stage.is_client_visible) === 1; });
        return planner + controlBoard + '<div class="schedule-split">' +
            '<section class="card schedule-card"><div class="card-head"><h3>Внутренний график</h3></div>' + renderScheduleRows(internal, false) + '</section>' +
            '<section class="card schedule-card"><div class="card-head"><h3>График для заказчика</h3></div>' + renderScheduleRows(customer, true) + '</section>' +
        '</div>';
    }

    function renderSchedulePlanner(project, stages) {
        if (!project || !canManageSchedule()) return '';
        var summary = state.schedulePlanByProject[project.id];
        var longest = summary && Array.isArray(summary.longestStages) ? summary.longestStages.slice(0, 3) : [];
        var hotspots = summary && Array.isArray(summary.procurementHotspots) ? summary.procurementHotspots.slice(0, 3) : [];
        return '<section class="card schedule-planner">' +
            '<div class="card-head">' +
                '<div><h3>Автоплан графика</h3><span class="muted">Собирает даты этапов из сметы и текущей структуры объекта.</span></div>' +
            '</div>' +
            '<form class="schedule-planner-form" data-auto-schedule-form data-project-id="' + project.id + '">' +
                '<label><span>Старт планирования</span><input name="start_date" type="date" value="' + escapeHtml(project.started_at || APP_TODAY) + '"></label>' +
                '<div class="schedule-planner-meta">' +
                    '<span class="badge">' + escapeHtml('Этапов: ' + stages.length) + '</span>' +
                    '<span class="badge">' + escapeHtml('Материалы: ' + ((state.materialsByProject[project.id] || []).length || 'по смете')) + '</span>' +
                '</div>' +
                '<button class="primary" type="submit">Построить график</button>' +
                '<div class="form-error" data-auto-schedule-error></div>' +
            '</form>' +
            (summary ? '<div class="schedule-plan-summary">' +
                '<div class="execution-summary">' +
                    stat('Старт', summary.projectStart || '—') +
                    stat('Финиш', summary.projectEnd || 'Не указан') +
                    stat('Этапов', String(summary.stagesPlanned || 0)) +
                    stat('Материалы', String(summary.materialsPlanned || 0)) +
                    stat('Автопривязка', String(summary.materialsAutoLinked || 0), summary.materialsAutoLinked ? 'warn' : '') +
                    stat('Сдвиг финиша', String(summary.deadlineOverrunDays || 0) + ' дн.', summary.deadlineOverrunDays ? 'danger' : '') +
                '</div>' +
                (longest.length ? '<div class="materials-list">' + longest.map(function (item) {
                    return '<div class="material-row"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.planned_start + ' — ' + item.planned_end) + '</small></div><span class="badge warn">' + escapeHtml(item.duration_days + ' дн.') + '</span></div>';
                }).join('') + '</div>' : '') +
                (hotspots.length ? '<div class="materials-list">' + hotspots.map(function (item) {
                    return '<div class="material-row"><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml('Закупить заранее за ' + item.lead_days + ' дн.') + '</small></div><span class="badge ' + (item.need_by_date < APP_TODAY ? 'danger' : 'warn') + '">' + escapeHtml(item.need_by_date) + '</span></div>';
                }).join('') + '</div>' : '') +
            '</div>' : '') +
        '</section>';
    }

    function renderScheduleRows(stages, customerMode) {
        var today = APP_TODAY;
        if (!stages.length) return '<p class="muted">Нет этапов для отображения.</p>';
        return '<div class="timeline">' + stages.map(function (stage) {
            var progress = percent(stage.progress);
            var start = customerMode ? (stage.customer_start || stage.planned_start || '—') : (stage.planned_start || '—');
            var end = customerMode ? (stage.customer_end || stage.planned_end || '—') : (stage.planned_end || '—');
            var summary = customerMode
                ? (start + ' — ' + end + ' • ' + statusLabel(stage.status_code))
                : buildScheduleStageSummary(stage, today);
            return '<div class="timeline-row ' + scheduleTimelineClass(stage, today) + '">' +
                '<div class="timeline-main"><b>' + escapeHtml(stage.title) + '</b><span>' + escapeHtml(summary) + '</span></div>' +
                '<i style="width:' + progress + '%"></i>' +
                '<strong>' + progress + '%</strong>' +
                '<div class="timeline-badges">' + renderScheduleStageBadges(stage, today, customerMode) + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }

    function buildScheduleStageSummary(stage, today) {
        var parts = [
            (stage.planned_start || '—') + ' — ' + (stage.planned_end || '—'),
            statusLabel(stage.status_code)
        ];
        if (stage.fact_start || stage.fact_end) {
            parts.push('факт: ' + (stage.fact_start || '—') + ' — ' + (stage.fact_end || '—'));
        }
        if (stage.responsible) {
            parts.push(stage.responsible);
        }
        if (isStageBehindPlan(stage, today)) {
            parts.push('отставание от темпа');
        } else if (isStageOverdue(stage, today)) {
            parts.push('срок просрочен');
        }
        return parts.join(' • ');
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
            badges.push('<span class="badge danger">Блокер</span>');
        } else if (isStageOverdue(stage, today)) {
            badges.push('<span class="badge danger">Просрочен</span>');
        } else if (isStageBehindPlan(stage, today)) {
            badges.push('<span class="badge warn">Отстает</span>');
        } else if (percent(stage.progress) >= 100 || stage.status_code === 'approved' || stage.status_code === 'completed') {
            badges.push('<span class="badge success">Закрыт</span>');
        } else {
            badges.push('<span class="badge">' + escapeHtml(statusLabel(stage.status_code)) + '</span>');
        }
        if (!customerMode && stage.depends_on_materials) {
            badges.push('<span class="badge warn">Материалы</span>');
        }
        return badges.join('');
    }

    function bindAutoScheduleForm(projectId) {
        var form = qs('[data-auto-schedule-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-auto-schedule-error]');
            if (error) error.classList.remove('active');
            api('/api/projects/' + projectId + '/auto-schedule', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: form.start_date.value
                })
            }).then(function (data) {
                updateProjectInState(data.project);
                state.schedulePlanByProject[projectId] = data.summary || null;
                state.stagesByProject[projectId] = null;
                state.materialsByProject[projectId] = null;
                openProject(projectId);
                activateProjectTab('schedule');
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось построить график';
                    error.classList.add('active');
                }
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

    function loadTasks(projectId) {
        api('/api/projects/' + projectId + '/tasks').then(function (data) {
            var tasks = Array.isArray(data.tasks) ? data.tasks : [];
            loadProjectNotifications(projectId, function (notifications) {
                loadUserDirectory(function (users) {
                    qs('[data-panel="tasks"]').innerHTML = renderTasks(tasks, projectId, users, notifications);
                    bindTaskForm(projectId);
                    bindTaskEditors(projectId);
                });
            });
        }).catch(function () {
            qs('[data-panel="tasks"]').innerHTML = '<p class="muted">Задачи недоступны для этой роли.</p>';
        });
    }

    function renderTasks(tasks, projectId, users, notifications) {
        var today = APP_TODAY;
        var overdue = tasks.filter(function (task) {
            return task.status !== 'done' && task.due_at && task.due_at < today;
        }).length;
        var inProgress = tasks.filter(function (task) { return task.status === 'in_progress'; }).length;
        var open = tasks.filter(function (task) { return task.status === 'open'; }).length;
        var summary = '<div class="execution-summary">' +
            stat('Задач всего', String(tasks.length)) +
            stat('Открытые', String(open), open ? 'warn' : '') +
            stat('В работе', String(inProgress), inProgress ? 'warn' : '') +
            stat('Просрочены', String(overdue), overdue ? 'danger' : '') +
            stat('Скоро срок', String(notifications && notifications.dueSoonTasks ? notifications.dueSoonTasks.length : 0)) +
            stat('Блокеры', String(notifications && notifications.blockerLogs ? notifications.blockerLogs.length : 0), notifications && notifications.blockerLogs && notifications.blockerLogs.length ? 'danger' : '') +
        '</div>';
        var alerts = renderTaskAlerts(notifications);
        var list = tasks.length
            ? '<div class="task-list">' + tasks.map(function (task) {
                return renderTaskRow(task, users || []);
            }).join('') + '</div>'
            : '<p class="muted">Задач пока нет.</p>';
        return summary + alerts + list + (hasRole('customer') ? '' : renderTaskCreateForm(projectId, users || []));
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

    function renderTaskRow(task, users) {
        var userOptions = '<option value="">Без ответственного</option>' + users.map(function (user) {
            return '<option value="' + user.id + '"' + (Number(task.assignee_id) === Number(user.id) ? ' selected' : '') + '>' + escapeHtml(user.name) + '</option>';
        }).join('');
        var riskClass = task.status !== 'done' && task.due_at && task.due_at < APP_TODAY ? ' execution-row-overdue' : '';
        return '<form class="task-row' + riskClass + '" data-task-edit-form data-task-id="' + task.id + '">' +
            '<div class="task-row-main"><b>' + escapeHtml(task.title) + '</b><small>' + escapeHtml(task.description || 'Без описания') + '</small></div>' +
            '<select name="status"><option value="open"' + (task.status === 'open' ? ' selected' : '') + '>Открыта</option><option value="in_progress"' + (task.status === 'in_progress' ? ' selected' : '') + '>В работе</option><option value="done"' + (task.status === 'done' ? ' selected' : '') + '>Готово</option></select>' +
            '<select name="priority"><option value="low"' + (task.priority === 'low' ? ' selected' : '') + '>Низкий</option><option value="normal"' + (task.priority === 'normal' ? ' selected' : '') + '>Обычный</option><option value="high"' + (task.priority === 'high' ? ' selected' : '') + '>Высокий</option></select>' +
            '<input name="due_at" type="date" value="' + escapeHtml(task.due_at || '') + '">' +
            '<select name="assignee_id">' + userOptions + '</select>' +
            '<button class="ghost" type="submit">Сохранить</button>' +
        '</form>';
    }

    function renderTaskCreateForm(projectId, users) {
        var userOptions = '<option value="">Без ответственного</option>' + users.map(function (user) {
            return '<option value="' + user.id + '">' + escapeHtml(user.name) + '</option>';
        }).join('');
        return '<form class="task-create-form" data-task-form data-project-id="' + projectId + '">' +
            '<div class="card-head"><h3>Новая задача</h3></div>' +
            '<input name="title" placeholder="Название задачи">' +
            '<input name="description" placeholder="Короткое описание">' +
            '<select name="priority"><option value="normal">Обычный</option><option value="high">Высокий</option><option value="low">Низкий</option></select>' +
            '<input name="due_at" type="date">' +
            '<select name="assignee_id">' + userOptions + '</select>' +
            '<button type="submit">Добавить</button>' +
        '</form>';
    }

    function bindTaskForm(projectId) {
        var form = qs('[data-task-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!form.title.value.trim()) return;
            api('/api/projects/' + projectId + '/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title: form.title.value.trim(),
                    description: form.description ? form.description.value.trim() : '',
                    priority: form.priority ? form.priority.value : 'normal',
                    due_at: form.due_at ? form.due_at.value : '',
                    assignee_id: form.assignee_id ? form.assignee_id.value : ''
                })
            }).then(function () {
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

    function loadProjectFinances(projectId) {
        api('/api/projects/' + projectId + '/finances').then(function (data) {
            renderProjectFinances(projectId, Array.isArray(data.items) ? data.items : [], data.summary || {});
        }).catch(function () {
            qs('[data-panel="finance"]').innerHTML = '<p class="muted">Не удалось загрузить финансы по объекту.</p>';
        });
    }

    function renderProjectFinances(projectId, items, summary) {
        var root = qs('[data-panel="finance"]');
        if (!root) return;
        root.innerHTML =
            '<section class="stats-grid">' +
                stat('План расходов', money(summary.plannedExpense || 0)) +
                stat('Оплачено расходов', money(summary.paidExpense || 0), summary.paidExpense > (summary.plannedExpense || 0) ? 'danger' : '') +
                stat('Поступило', money(summary.paidIncome || 0)) +
                stat('Баланс', money(summary.balance || 0), (summary.balance || 0) < 0 ? 'danger' : '') +
            '</section>' +
            renderFinanceCreateForm() +
            '<section class="subsection"><div class="card-head"><h3>Финансовые операции</h3></div><div class="finance-list">' +
                (items.length ? items.map(renderFinanceRow).join('') : '<p class="muted">По объекту пока нет финансовых операций.</p>') +
            '</div></section>';
        bindFinanceCreateForm(projectId);
        bindFinanceEditors(projectId);
    }

    function renderFinanceCreateForm() {
        return '<section class="subsection"><div class="card-head"><h3>Добавить операцию</h3></div>' +
            '<form class="supplier-form" data-finance-create-form>' +
                '<label><span>Тип</span><select name="direction"><option value="expense">Расход</option><option value="income">Поступление</option></select></label>' +
                '<label><span>Категория</span><input name="category" placeholder="Материалы, подрядчик, аванс"></label>' +
                '<label><span>Вид оплаты</span><select name="payment_kind"><option value="cash">Наличные</option><option value="bank_no_vat">Безнал без НДС</option><option value="bank_vat">Безнал с НДС</option></select></label>' +
                '<label><span>Сумма</span><input name="amount" type="number" min="0" step="0.01" required></label>' +
                '<label><span>НДС %</span><input name="vat_percent" type="number" min="0" step="0.01" value="0"></label>' +
                '<label><span>Плановая дата</span><input name="planned_date" type="date"></label>' +
                '<label><span>Фактическая дата</span><input name="paid_date" type="date"></label>' +
                '<label><span>Контрагент</span><input name="counterparty_name" placeholder="Поставщик или заказчик"></label>' +
                '<label><span>Статус</span><select name="status"><option value="planned">Запланировано</option><option value="approved">Согласовано</option><option value="paid">Оплачено</option><option value="cancelled">Отменено</option></select></label>' +
                '<label class="wide"><span>Комментарий</span><textarea name="notes" placeholder="Счет, пояснение, привязка к поставке"></textarea></label>' +
                '<div class="form-error" data-finance-create-error></div>' +
                '<button class="primary" type="submit">Сохранить операцию</button>' +
            '</form></section>';
    }

    function renderFinanceRow(item) {
        return '<form class="finance-row" data-finance-edit-form data-finance-id="' + item.id + '">' +
            '<div><b>' + escapeHtml(item.category || financeDirectionLabel(item.direction)) + '</b><small>' + escapeHtml(financeDirectionLabel(item.direction) + ' • ' + financePaymentLabel(item.payment_kind)) + '</small><small>' + escapeHtml(item.counterparty_name || 'Контрагент не указан') + '</small></div>' +
            '<div><strong>' + escapeHtml(money(item.amount || 0)) + '</strong><small>НДС ' + escapeHtml(Number(item.vat_percent || 0)) + '%</small></div>' +
            '<div><small>План</small><input name="planned_date" type="date" value="' + escapeHtml(item.planned_date || '') + '"></div>' +
            '<div><small>Факт</small><input name="paid_date" type="date" value="' + escapeHtml(item.paid_date || '') + '"></div>' +
            '<div><small>Статус</small><select name="status">' +
                '<option value="planned"' + (item.status === 'planned' ? ' selected' : '') + '>Запланировано</option>' +
                '<option value="approved"' + (item.status === 'approved' ? ' selected' : '') + '>Согласовано</option>' +
                '<option value="paid"' + (item.status === 'paid' ? ' selected' : '') + '>Оплачено</option>' +
                '<option value="cancelled"' + (item.status === 'cancelled' ? ' selected' : '') + '>Отменено</option>' +
            '</select></div>' +
            '<button class="ghost" type="submit">Сохранить</button>' +
        '</form>';
    }

    function bindFinanceCreateForm(projectId) {
        var form = qs('[data-finance-create-form]');
        if (!form || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var error = qs('[data-finance-create-error]');
            if (error) error.classList.remove('active');
            api('/api/projects/' + projectId + '/finances', {
                method: 'POST',
                body: JSON.stringify({
                    direction: form.direction.value,
                    category: form.category.value.trim(),
                    payment_kind: form.payment_kind.value,
                    amount: Number(form.amount.value || 0),
                    vat_percent: Number(form.vat_percent.value || 0),
                    planned_date: form.planned_date.value,
                    paid_date: form.paid_date.value,
                    counterparty_name: form.counterparty_name.value.trim(),
                    status: form.status.value,
                    notes: form.notes.value.trim()
                })
            }).then(function () {
                form.reset();
                form.direction.value = 'expense';
                form.payment_kind.value = 'cash';
                form.status.value = 'planned';
                loadProjectFinances(projectId);
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить финансовую операцию';
                    error.classList.add('active');
                }
            });
        });
    }

    function bindFinanceEditors(projectId) {
        qsa('[data-finance-edit-form]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                api('/api/finances/' + form.dataset.financeId + '/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        planned_date: form.planned_date.value,
                        paid_date: form.paid_date.value,
                        status: form.status.value,
                        notes: form.notes.value.trim()
                    })
                }).then(function () {
                    loadProjectFinances(projectId);
                });
            });
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

    function loadProjectChats(projectId) {
        api('/api/projects/' + projectId + '/chats').then(function (data) {
            var chats = Array.isArray(data.chats) ? data.chats : [];
            if (!chats.length) {
                qs('[data-panel="chat"]').innerHTML = '<p class="muted">Чаты пока не созаны.</p>';
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
        root.innerHTML = '<p class="muted">Загрузка общей ведомости склада...</p>';
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
        root.innerHTML = '<p class="muted">Загрузка общей ведомости склада...</p>';
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
                form.notes.value = '';
                stageSelect.value = '';
                return;
            }
            materialSelect.value = String(material.id);
            form.need_by_date.value = material.needByDate || '';
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
        root.innerHTML = '<p class="muted">Загрузка графика...</p>';
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
        if (!iso) return '—';
        var parts = String(iso).split('-');
        if (parts.length !== 3) return iso;
        return parts[2] + '.' + parts[1];
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

    function renderLogsList(project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        if (!logs.length) {
            root.innerHTML = '<p class="muted">По объекту «' + escapeHtml(project.title) + '» пока нет дневных отчетов.</p>';
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
                '<small class="muted">Автор отчета: ' + escapeHtml(log.author_name || '—') + '</small>' +
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
                form.report_date.value = APP_TODAY;
                var pageSelect = qs('[data-logs-project]');
                if (pageSelect) pageSelect.value = keepProject;
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || state.projects[0];
                loadProjectLogs(projectId, function (logs) {
                    renderLogsStats(logs);
                    renderLogsList(project, logs);
                });
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить отчет';
                    error.classList.add('active');
                }
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

    function initCompaniesPage() {
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

    function renderCompaniesList(companies) {
        var root = qs('[data-companies-list]');
        if (!root) return;
        if (!companies.length) {
            root.innerHTML = '<p class="muted">Компании пока не добавлены.</p>';
            return;
        }
        root.innerHTML = '<div class="companies-list">' + companies.map(function (company) {
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
        }).join('') + '</div>';
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
            api('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name.value.trim(),
                    login: form.login.value.trim(),
                    email: form.email.value.trim(),
                    phone: form.phone.value.trim(),
                    password: form.password.value,
                    role: form.role.value,
                    roles: roles
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

    function renderMaterials(items, projectId, insights) {
        if (!items.length) return '<p class="muted">\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u043f\u043e \u0441\u043c\u0435\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b.</p>';
        var required = items.filter(function (item) { return item.supplyStatus === 'required'; }).length;
        var soon = items.filter(function (item) { return item.supplyStatus === 'soon'; }).length;
        var planned = items.filter(function (item) { return item.supplyStatus === 'planned'; }).length;
        var safe = items.filter(function (item) { return item.supplyStatus === 'in_stock'; }).length;
        insights = insights || {};
        return '<div class="execution-summary">' +
            stat('\u0412\u0441\u0435\u0433\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0439', String(items.length)) +
            stat('\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f', String(required), required ? 'danger' : '') +
            stat('\u0421\u043a\u043e\u0440\u043e', String(soon), soon ? 'warn' : '') +
            stat('\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c', String(planned), planned ? 'warn' : '') +
            stat('\u0412 \u043d\u0430\u043b\u0438\u0447\u0438\u0438', String(safe)) +
            stat('\u041d\u0435\u0445\u0432\u0430\u0442\u043a\u0438', String(items.filter(function (item) { return Number(item.missingQty) > 0; }).length), items.some(function (item) { return Number(item.missingQty) > 0; }) ? 'danger' : '') +
        '</div><div class="materials-list">' + items.map(function (item) { return materialRow(item, projectId, insights[Number(item.id)] || null); }).join('') + '</div>';
    }

    function materialRow(item, projectId, insight) {
        var missing = Number(item.missingQty) || 0;
        var meta = [
            '\u041f\u043e \u0441\u043c\u0435\u0442\u0435: ' + item.plannedQty + ' ' + escapeHtml(item.unit),
            '\u043a\u0443\u043f\u043b\u0435\u043d\u043e: ' + item.purchasedQty,
            '\u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u043e: ' + item.usedQty,
            '\u043e\u0441\u0442\u0430\u0442\u043e\u043a: ' + item.stockQty,
            item.needByDate ? '\u043d\u0443\u0436\u043d\u043e \u043a ' + item.needByDate : '',
            item.stageTitle ? '\u044d\u0442\u0430\u043f: ' + item.stageTitle : ''
        ].filter(Boolean).join(' \u2022 ');
        var supplyNote = '';
        if (insight) {
            supplyNote = insight.selected
                ? '\u0412\u044b\u0431\u0440\u0430\u043d \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a: ' + insight.selected
                : insight.quoted
                    ? '\u041f\u0440\u043e\u0441\u0447\u0438\u0442\u0430\u043d\u043e \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439: ' + insight.quoted
                    : insight.called
                        ? '\u0423\u0436\u0435 \u0432 \u043e\u0431\u0437\u0432\u043e\u043d\u0435: ' + insight.called
                        : '\u0412 \u0440\u0430\u0431\u043e\u0442\u0435 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u0432: ' + insight.total;
        } else if (canManageSuppliers()) {
            supplyNote = '\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a \u043f\u043e \u044d\u0442\u043e\u0439 \u043f\u043e\u0437\u0438\u0446\u0438\u0438 \u0435\u0449\u0435 \u043d\u0435 \u0437\u0430\u0432\u0435\u0434\u0435\u043d\u2011';
        }
        var actions = '<div class="material-chain-actions">' +
            (canManageSuppliers() ? '<a class="ghost material-link" href="/app/suppliers?projectId=' + projectId + '&materialId=' + item.id + '">\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a</a>' : '') +
            (canSeeFinances() ? '<button class="ghost material-link" type="button" data-open-finance-tab>\u0424\u0438\u043d\u0430\u043d\u0441\u044b</button>' : '') +
        '</div>';
        return '<div class="material-row material-row-linked">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + meta + (item.notes ? '<br>' + escapeHtml(item.notes) : '') + (supplyNote ? '<br>' + escapeHtml(supplyNote) : '') + '</small></div>' +
            '<div class="material-chain-side"><span class="badge ' + planningStatusClass(item.supplyStatus || (missing > 0 ? 'required' : 'in_stock')) + '">' + escapeHtml(item.supplyLabel || (missing > 0 ? ('\u041d\u0443\u0436\u043d\u043e \u0437\u0430\u043a\u0440\u044b\u0442\u044c \u043d\u0435\u0445\u0432\u0430\u0442\u043a\u0443: ' + missing + ' ' + item.unit) : '\u0421\u0442\u0430\u0442\u0443\u0441 \u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d')) + '</span>' + actions + '</div>' +
        '</div>';
    }

    function loadProjectHub(projectId, project) {

        var overview = qs('[data-panel="overview"]');
        if (!overview) return;
        var root = qs('[data-project-hub]', overview);
        if (!root) {
            overview.insertAdjacentHTML('beforeend', '<section class="subsection"><div class="card-head"><h3>Как объект живет сейчас</h3></div><div data-project-hub><p class="muted">Собираем единую картину по объекту...</p></div></section>');
            root = qs('[data-project-hub]', overview);
        }
        if (!root) return;
        root.innerHTML = '<p class="muted">Собираем единую картину по объекту...</p>';
        Promise.all([
            api('/api/projects/' + projectId + '/notifications').catch(function () { return {}; }),
            api('/api/projects/' + projectId + '/tasks').catch(function () { return { tasks: [] }; }),
            api('/api/projects/' + projectId + '/documents').catch(function () { return { documents: [] }; }),
            api('/api/projects/' + projectId + '/daily-logs').catch(function () { return { logs: [] }; }),
            api('/api/projects/' + projectId + '/materials-summary').catch(function () { return { items: [] }; }),
            api('/api/projects/' + projectId + '/stages').catch(function () { return { stages: [] }; })
        ]).then(function (results) {
            var notifications = results[0] || {};
            var tasks = Array.isArray(results[1].tasks) ? results[1].tasks : [];
            var documents = Array.isArray(results[2].documents) ? results[2].documents : [];
            var logs = Array.isArray(results[3].logs) ? results[3].logs : [];
            var materials = Array.isArray(results[4].items) ? results[4].items : [];
            var stages = Array.isArray(results[5].stages) ? results[5].stages : [];
            root.innerHTML = renderProjectHub(project || state.selectedProject || {}, {
                notifications: notifications,
                tasks: tasks,
                documents: documents,
                logs: logs,
                materials: materials,
                stages: stages
            });
        }).catch(function () {
            root.innerHTML = '<p class="muted">Не удалось собрать общую картину по объекту.</p>';
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
        var initialParams = new URLSearchParams(location.search);
        var initialProjectId = Number(initialParams.get('projectId') || 0);
        var initialMaterialId = Number(initialParams.get('materialId') || 0);
        var focusApplied = false;
        var options = state.projects.map(function (project) {
            return '<option value="' + project.id + '">' + escapeHtml(project.title) + '</option>';
        }).join('');
        projectSelect.innerHTML = options;
        formProjectSelect.innerHTML = options;
        loadCompanies(function (companies) {
            fillSupplierCompanyOptions(companies || []);
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
            loadSupplierOffers(projectId, !focusApplied ? initialMaterialId : 0);
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

    function loadSupplierOffers(projectId, materialId) {
        api('/api/projects/' + projectId + '/supplier-offers').then(function (data) {
            var offers = Array.isArray(data.offers) ? data.offers : [];
            renderSupplierStats(offers);
            renderSupplierList(projectId, offers, materialId);
            bindSupplierEditors(projectId);
        }).catch(function () {
            var root = qs('[data-suppliers-list]');
            if (root) root.innerHTML = '<p class="muted">Не удалось загрузить предложения.</p>';
        });
    }

    function renderSuppliersContext(projectId, items, materialId) {
        var root = qs('[data-suppliers-context]');
        if (!root) return;
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

    function renderSupplierList(projectId, offers, materialId) {
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
            root.innerHTML = '<p class="muted">По объекту пока нет кандидатов. Добавь первого поставщика или подрядчика справа.</p>';
            return;
        }
        root.innerHTML = offers.map(function (offer) {
            var compare = offer.compareToEstimate || {};
            var delta = typeof compare.deltaTotal === 'number' ? compare.deltaTotal : null;
            var compareText = delta == null
                ? 'Смета не привязана'
                : (delta < 0 ? 'Экономия ' + money(Math.abs(delta)) : (delta > 0 ? 'Переплата ' + money(delta) : 'Ровно по смете'));
            var compareClass = delta == null ? '' : (delta > 0 ? 'danger' : '');
            var isFocused = materialId && Number(offer.estimate_item_id || 0) === materialId;
            return '<form class="supplier-offer-row' + (isFocused ? ' supplier-offer-row-focused' : '') + '" data-supplier-edit-form data-offer-id="' + offer.id + '">' +
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
        }).join('');
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

    function loadDocuments(projectId) {
        var docsRequest = api('/api/projects/' + projectId + '/documents');
        var executiveRequest = hasRole('customer')
            ? Promise.resolve(null)
            : api('/api/projects/' + projectId + '/executive-docs').catch(function () { return null; });
        Promise.all([docsRequest, executiveRequest]).then(function (result) {
            var data = result[0] || {};
            var executive = result[1];
            var docs = Array.isArray(data.documents) ? data.documents : [];
            var panel = qs('[data-panel="documents"]');
            if (!panel) return;
            panel.innerHTML =
                (executive ? renderExecutiveChecklist(executive) : '') +
                renderDocumentUpload(projectId) +
                (docs.length
                    ? '<div class="documents-list">' + docs.map(renderDocumentRow).join('') + '</div>'
                    : '<p class="muted">Документы по объекту пока не загружены.</p>');
            bindDocumentUpload(projectId);
            bindExecutiveDocActions(projectId);
        }).catch(function () {
            qs('[data-panel="documents"]').innerHTML = '<p class="muted">Документы недоступны.</p>';
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

    function renderLogsList(project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        if (!logs.length) {
            root.innerHTML = '<p class="muted">По объекту "' + escapeHtml(project.title) + '" пока нет дневных отчетов.</p>';
            return;
        }
        root.innerHTML = logs.map(function (log) {
            return '<article class="log-card">' +
                '<div class="log-top">' +
                    '<div><span>' + escapeHtml(log.report_date || '—') + '</span><h4>' + escapeHtml(log.title) + '</h4></div>' +
                    '<div class="project-badges">' +
                        (log.progress_percent != null && log.progress_percent !== '' ? '<span class="badge success">' + escapeHtml(Math.round(Number(log.progress_percent) || 0)) + '%</span>' : '') +
                        '<span class="badge">' + escapeHtml(log.workers_count || 0) + ' чел.</span>' +
                        '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + (Number(log.is_client_visible) === 1 ? 'Видно заказчику' : 'Внутренний') + '</span>' +
                    '</div>' +
                '</div>' +
                '<p>' + escapeHtml(log.work_done) + '</p>' +
                '<div class="log-details">' +
                    (log.equipment ? '<div><span>Техника</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                    (log.blockers ? '<div class="log-risk"><span>Блокер</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                    (log.next_steps ? '<div><span>Дальше</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                '</div>' +
                (log.raw_input ? '<small class="muted">Исходный ввод: ' + escapeHtml(log.raw_input) + '</small>' : '') +
                '<small class="muted">Автор отчета: ' + escapeHtml(log.author_name || '—') + '</small>' +
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
                    progress_percent: form.progress_percent ? form.progress_percent.value : '',
                    raw_input: form.raw_input ? form.raw_input.value.trim() : '',
                    is_client_visible: form.is_client_visible.value === '1'
                })
            }).then(function (data) {
                var keepProject = form.project_id.value;
                var selectedDate = form.report_date.value || APP_TODAY;
                form.reset();
                form.project_id.value = keepProject;
                form.report_date.value = APP_TODAY;
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
                closeSideDrawer(qs('[data-drawer-id="project-report-create"]'));
                var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || state.projects[0];
                loadProjectLogs(projectId, function (logs) {
                    loadProjectNotifications(projectId, function (notifications) {
                        renderLogsStats(logs, notifications);
                        renderLogsAlerts(notifications);
                        renderLogsCalendar(project, logs);
                        renderLogsList(project, logs);
                    });
                });
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить отчет';
                    error.classList.add('active');
                }
            });
        });
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
                '<div data-logs-list></div>' +
            '</section>' +
            (canCreateProjectReport() ? '<section class="subsection report-intake-card" data-project-report-create-card hidden>' + renderProjectReportForm(project).replace('<section class="subsection report-intake-card">', '').replace(/<\/section>$/, '') + '</section>' : '') +
        '</div>';
    }

    function refreshProjectReportsTab(projectId) {
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
    }

    function renderProjectOverviewActions(project) {
        var actions = [
            '<button class="ghost" type="button" data-project-tab-target="materials">Материалы</button>',
            '<button class="ghost" type="button" data-project-tab-target="schedule">График работ</button>',
            '<button class="ghost" type="button" data-project-tab-target="reports">Отчеты</button>',
            '<button class="ghost" type="button" data-project-tab-target="tasks">Задачи</button>',
            '<button class="ghost" type="button" data-project-tab-target="documents">Документы</button>',
            '<button class="ghost" type="button" data-project-tab-target="chat">Чат</button>',
            '<a href="/app/logs">Журнал работ</a>'
        ];
        if (canSeeFinances()) {
            actions.splice(5, 0, '<button class="ghost" type="button" data-project-tab-target="finance">Финансы</button>');
        }
        if (project && project.id) {
            actions[actions.length - 1] = '<a href="/app/logs?projectId=' + project.id + '">Журнал работ</a>';
        }
        return '<div class="object-actions">' + actions.join('') + '</div>';
    }

    function renderProjectOverviewHero(project) {
        var status = project.status || 'Подготовка';
        var budget = project.budget == null ? 'Скрыто ролью' : money(project.budget);
        var paid = project.paid == null ? 'Скрыто ролью' : money(project.paid);
        return '<section class="project-overview-hero">' +
            '<div class="project-overview-head">' +
                '<div>' +
                    '<span class="section-label">Обзор</span>' +
                    '<h3>' + escapeHtml(project.title || 'Без названия') + '</h3>' +
                    '<p>' + escapeHtml(project.address || 'Адрес не указан') + '</p>' +
                '</div>' +
                '<div class="project-overview-badges">' +
                    '<span class="badge">' + escapeHtml(status) + '</span>' +
                    '<span class="badge success">Готовность ' + percent(project.progress) + '%</span>' +
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
            '<section class="card" data-project-edit-card data-project-overview-section hidden>' +
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
    }

    function bindProjectOverviewActions() {
        qsa('[data-project-tab-target]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                activateProjectTab(button.dataset.projectTabTarget);
            });
        });
    }

    function renderProjectList(projects) {
        var root = qs('[data-projects-list]');
        if (!root) return;
        if (!projects.length) {
            root.innerHTML = '<div class="muted">Объекты пока не найдены.</div>';
            return;
        }
        var sortedProjects = projects.slice().sort(function (left, right) {
            var leftCompleted = isCompletedProject(left) ? 1 : 0;
            var rightCompleted = isCompletedProject(right) ? 1 : 0;
            if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;
            return Number(right.id) - Number(left.id);
        });
        var criticalByProject = {};
        var criticalItems = state.dashboard && Array.isArray(state.dashboard.criticalItems) ? state.dashboard.criticalItems : [];
        criticalItems.forEach(function (item) {
            criticalByProject[item.projectId] = (criticalByProject[item.projectId] || 0) + 1;
        });
        root.innerHTML = sortedProjects.map(function (project) {
            var progress = percent(project.progress);
            var criticalCount = criticalByProject[project.id] || 0;
            var completed = isCompletedProject(project);
            var riskBadge = (!completed && criticalCount) ? '<span class="badge danger">Нехватки: ' + criticalCount + '</span>' : '';
            var statusBadge = completed ? '<span class="badge success">Завершен</span>' : '<span class="badge">' + escapeHtml(project.status || 'В работе') + '</span>';
            var editButton = isAdminRole()
                ? '<button class="project-card-menu" type="button" aria-label="Редактировать объект" data-project-edit="' + project.id + '">&#8942;</button>'
                : '';
            return '<article class="project-card ' + (completed ? 'project-completed ' : '') + (!completed && criticalCount ? 'project-risk' : '') + '" data-project-id="' + project.id + '">' +
                '<div class="project-top">' +
                    '<div><h3>' + escapeHtml(project.title) + '</h3><p>' + escapeHtml(project.address || 'Адрес не указан') + '</p></div>' +
                    '<div class="project-card-tools"><div class="project-badges">' + statusBadge + riskBadge + '</div>' + editButton + '</div>' +
                '</div>' +
                '<div class="meta-grid">' +
                    '<div><span>Заказчик</span><strong>' + escapeHtml(project.client_name || 'Не указан') + '</strong></div>' +
                    '<div><span>Бюджет</span><strong>' + escapeHtml(project.budget == null ? 'Скрыто' : money(project.budget)) + '</strong></div>' +
                    '<div><span>Дедлайн</span><strong>' + escapeHtml(project.deadline_at || '—') + '</strong></div>' +
                '</div>' +
                renderStrongProgress(progress, 'Готовность объекта', false) +
            '</article>';
        }).join('');
        qsa('[data-project-id]', root).forEach(function (card) {
            card.addEventListener('click', function (event) {
                if (event.target && event.target.closest('[data-project-edit]')) return;
                openProject(Number(card.dataset.projectId));
            });
        });
        qsa('[data-project-edit]', root).forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openProjectEdit(Number(button.dataset.projectEdit));
            });
        });
    }

    function openProject(projectId) {
        var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
        if (!project) return;
        state.selectedProject = project;
        setProjectFocusMode(true);
        qs('[data-project-detail]').hidden = false;
        qs('[data-detail-title]').textContent = project.title;
        activateProjectTab('overview');
        var detailCard = qs('[data-project-detail]');
        if (detailCard && typeof detailCard.scrollIntoView === 'function') {
            detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var focusRoot = qs('[data-project-focus]');
        if (focusRoot) {
            focusRoot.innerHTML = '';
            focusRoot.hidden = true;
        }
        qs('[data-panel="overview"]').innerHTML =
            renderProjectOverviewHero(project) +
            renderProjectOverviewActions(project) +
            '<section class="subsection"><div class="card-head"><h3>Назначения на объект</h3></div><div data-project-assignments>Загрузка назначений...</div></section>';
        qs('[data-panel="execution"]').innerHTML = '<p class="muted">Загрузка структуры объекта...</p>';
        qs('[data-panel="schedule"]').innerHTML = renderSchedule(project);
        qs('[data-panel="tasks"]').innerHTML = '<p class="muted">Загрузка задач...</p>';
        qs('[data-panel="documents"]').innerHTML = '<p class="muted">Загрузка документов...</p>';
        qs('[data-panel="chat"]').innerHTML = '<p class="muted">Загрузка чатов...</p>';
        qs('[data-panel="ai"]').innerHTML = renderAi(project, []);
        bindProjectOverviewActions();
        loadMaterials(project.id, function (items) {
            var overview = qs('[data-panel="overview"]');
            if (overview && !qs('[data-project-overview-materials]', overview)) {
                overview.insertAdjacentHTML('beforeend', '<section class="subsection"><div class="card-head"><h3>Материалы по смете и складу</h3></div><div data-project-overview-materials></div></section>');
            }
            var overviewMaterials = qs('[data-project-overview-materials]', overview || document);
            loadMaterialInsights(project.id, function (insights) {
                qs('[data-panel="materials"]').innerHTML = renderMaterials(items, project.id, insights);
                if (overviewMaterials) overviewMaterials.innerHTML = renderMaterials(items, project.id, insights);
                bindProjectChainActions();
                qs('[data-panel="ai"]').innerHTML = renderAi(project, items);
            });
        });
        loadAnalysis(project.id, function (analysis) {
            qs('[data-panel="ai"]').innerHTML = renderBackendAnalysis(analysis);
        });
        loadStages(project.id, function (stages) {
            qs('[data-panel="execution"]').innerHTML = renderExecutionPanel(stages, project.id);
            qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, project);
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            loadExecutionInsights(project.id, stages);
        });
        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
    }

    function renderProjectsPage() {
        if (isAdminRole()) {
            loadCompanies(populateProjectCompanySelects);
        }
        ensureProjectEditCard();
        bindProjectCreate();
        bindProjectEditForm();
        bindProjectBootstrapForm();
        var bootstrapForm = qs('[data-project-bootstrap-form]');
        if (bootstrapForm && bootstrapForm.closest('section')) {
            bootstrapForm.closest('section').hidden = true;
        }
        renderProjectStats();
        renderProjectCritical();
        renderProjectList(state.projects);
        var search = qs('[data-project-search]');
        if (search && search.dataset.bound !== '1') {
            search.dataset.bound = '1';
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
        if (close && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', function () {
                state.selectedProject = null;
                qs('[data-project-detail]').hidden = true;
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
            if (state.user && hasRole('customer') && ['execution', 'materials', 'tasks', 'finance'].indexOf(button.dataset.tab) !== -1) {
                button.remove();
                return;
            }
            if (button.dataset.tab === 'finance' && !canSeeFinances()) {
                button.remove();
                return;
            }
            button.dataset.projectTabBound = '1';
            button.addEventListener('click', function () {
                activateProjectTab(button.dataset.tab);
            });
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
                api('/api/projects/' + existingId + '/bootstrap', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).then(function (data) {
                    updateProjectInState(data.project);
                    renderProjectList(state.projects);
                    fillAutobotProjectSelects();
                    renderAutobotResult(result, data.project, 'Тендерный пакет загружен в существующий объект.', '/app/projects?openProject=' + data.project.id, 'Открыть объект');
                }).catch(function (err) {
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
            api('/api/projects/' + projectId + '/estimate-import', {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(function (data) {
                var project = state.projects.find(function (item) { return Number(item.id) === projectId; }) || { id: projectId, title: 'Объект CRM' };
                state.materialsByProject[projectId] = data.items || [];
                renderAutobotResult(result, project, 'Смета добавлена в материалы объекта.', '/app/warehouse', 'Открыть склад');
            }).catch(function (err) {
                if (!error) return;
                error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось загрузить смету';
                error.classList.add('active');
            });
        });
    }

    function renderAutobotPage() {
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
            if (!isAdminRole()) node.remove();
        });
        qsa('[data-director-action]').forEach(function (node) {
            if (!isAdminRole()) node.remove();
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
        if (page === 'autobot') loadProjects(renderAutobotPage);
        if (page === 'warehouse') loadProjects(renderWarehousePage);
        if (page === 'suppliers') loadProjects(initSuppliersPage);
        if (page === 'schedule') loadProjects(renderSchedulePage);
        if (page === 'logs') loadProjects(renderLogsPage);
        if (page === 'chats') loadProjects(renderChatsPage);
        if (page === 'users') initUsersPage();
        if (page === 'companies') initCompaniesPage();
        if (page === 'reports') initReportsPage();
    }

    function renderProjectsPage() {
        if (isAdminRole()) {
            loadCompanies(populateProjectCompanySelects);
        }
        ensureProjectEditCard();
        bindProjectCreate();
        bindProjectEditForm();
        bindProjectBootstrapForm();
        var bootstrapForm = qs('[data-project-bootstrap-form]');
        if (bootstrapForm && bootstrapForm.closest('section')) {
            bootstrapForm.closest('section').hidden = true;
        }
        renderProjectStats();
        renderProjectCritical();
        renderProjectList(state.projects);
        var search = qs('[data-project-search]');
        if (search && search.dataset.bound !== '1') {
            search.dataset.bound = '1';
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
        if (close && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', function () {
                state.selectedProject = null;
                qs('[data-project-detail]').hidden = true;
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
            if (state.user && hasRole('customer') && ['execution', 'materials', 'tasks', 'finance'].indexOf(button.dataset.tab) !== -1) {
                button.remove();
                return;
            }
            if (button.dataset.tab === 'finance' && !canSeeFinances()) {
                button.remove();
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
            var matched = state.projects.some(function (project) { return Number(project.id) === openProjectId; });
            if (matched) {
                openProject(openProjectId);
            }
        }
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
        syncSidebarToggleTitle();
    }

    function toggleSidebarCollapsed() {
        var collapsed = !document.body.classList.contains('sidebar-collapsed');
        document.body.classList.toggle('sidebar-collapsed', collapsed);
        try {
            window.localStorage.setItem('pmbi_sidebar_collapsed', collapsed ? '1' : '0');
        } catch (error) {}
        syncSidebarToggleTitle();
    }

    function syncSidebarToggleTitle() {
        var collapsed = document.body.classList.contains('sidebar-collapsed');
        var title = collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар';
        qsa('[data-menu-toggle], [data-sidebar-toggle]').forEach(function (toggle) {
            toggle.title = title;
            toggle.setAttribute('aria-label', title);
        });
    }

    function openProject(projectId) {
        var root = qs('[data-project-detail]');
        if (!root) return;
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;
        state.selectedProject = project;
        root.hidden = false;
        setProjectFocusMode(true);
        ensureProjectWorksTab();

        var detailTitle = qs('[data-project-title]') || qs('[data-detail-title]');
        var overviewPanel = qs('[data-panel="overview"]');
        var executionPanel = qs('[data-panel="execution"]');
        var materialsPanel = qs('[data-panel="materials"]');
        var worksPanel = qs('[data-panel="works"]');
        var schedulePanel = qs('[data-panel="schedule"]');
        var tasksPanel = qs('[data-panel="tasks"]');
        var financePanel = qs('[data-panel="finance"]');
        var documentsPanel = qs('[data-panel="documents"]');
        var chatPanel = qs('[data-panel="chat"]');
        var aiPanel = qs('[data-panel="ai"]');

        if (detailTitle) detailTitle.textContent = project.title || 'Карточка объекта';
        if (overviewPanel) overviewPanel.innerHTML = renderProjectOverview(project);
        if (executionPanel) executionPanel.innerHTML = '<p class="muted">Загружаем структуру объекта...</p>';
        if (materialsPanel) materialsPanel.innerHTML = '<p class="muted">Загружаем материалы...</p>';
        if (worksPanel) worksPanel.innerHTML = '<p class="muted">Загружаем работы...</p>';
        if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
        if (tasksPanel) tasksPanel.innerHTML = '<p class="muted">Загружаем задачи...</p>';
        if (financePanel) financePanel.innerHTML = '';
        if (documentsPanel) documentsPanel.innerHTML = '<p class="muted">Загружаем документы...</p>';
        if (chatPanel) chatPanel.innerHTML = '<p class="muted">Загружаем чат...</p>';
        if (aiPanel) aiPanel.innerHTML = '';

        bindProjectOverviewActions();
        activateProjectTab('overview');

        loadMaterials(project.id, function (items) {
            if (materialsPanel) {
                materialsPanel.innerHTML = renderMaterials(items, project.id, state.materialInsightsByProject[project.id] || null);
            }
            var overviewMaterials = qs('[data-panel="overview-materials"]') || qs('[data-project-overview-materials]');
            if (overviewMaterials && typeof renderOverviewMaterials === 'function') {
                overviewMaterials.innerHTML = renderOverviewMaterials(items);
            }
            if (state.stagesByProject[project.id] && worksPanel) {
                worksPanel.innerHTML = renderWorksPanel(state.stagesByProject[project.id], items);
            }
        });

        loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function () {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            var stages = state.stagesByProject[project.id] || [];
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(stages, project);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
        });

        loadAnalysis(project.id, function (analysis) {
            if (aiPanel) aiPanel.innerHTML = renderBackendAnalysis(analysis);
        });

        loadStages(project.id, function (stages) {
            if (executionPanel) executionPanel.innerHTML = renderExecutionPanel(stages, project.id);
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(stages, project);
            if (worksPanel) {
                worksPanel.innerHTML = renderWorksPanel(stages, state.materialsByProject[project.id] || []);
            }
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
            loadExecutionInsights(project.id, stages);
        });

        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
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

    renderSchedulePanel = function (stages, project) {
        var planner = renderSchedulePlanner(project, stages);
        var forecast = renderSectionScheduleForecast(project);
        var procurement = renderScheduleProcurementBoard(project);
        var controlBoard = renderScheduleStateBoard(project);
        if (!stages.length) return planner + forecast + procurement + controlBoard + renderSchedule(project);
        var internal = stages;
        var customer = stages.filter(function (stage) { return Number(stage.is_client_visible) === 1; });
        return planner + forecast + procurement + controlBoard + '<div class="schedule-split">' +
            '<section class="card schedule-card"><div class="card-head"><h3>Внутренний график</h3></div>' + renderScheduleRows(internal, false) + '</section>' +
            '<section class="card schedule-card"><div class="card-head"><h3>График для заказчика</h3></div>' + renderScheduleRows(customer, true) + '</section>' +
        '</div>';
    };

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

    renderScheduleRows = function (stages, customerMode) {
        var today = APP_TODAY;
        if (!stages.length) return '<p class="muted">Нет этапов для отображения.</p>';
        return '<div class="timeline">' + stages.map(function (stage) {
            var progress = percent(stage.progress);
            var progressTrackClass = progress <= 0 ? ' timeline-progress-empty' : '';
            var start = customerMode ? (stage.customer_start || stage.planned_start || '—') : (stage.planned_start || '—');
            var end = customerMode ? (stage.customer_end || stage.planned_end || '—') : (stage.planned_end || '—');
            var summary = customerMode
                ? (start + ' — ' + end + ' • ' + statusLabel(stage.status_code))
                : buildScheduleStageSummary(stage, today);
            return '<div class="timeline-row ' + scheduleTimelineClass(stage, today) + '">' +
                '<div class="timeline-main"><b>' + escapeHtml(stage.title) + '</b><span>' + escapeHtml(summary) + '</span></div>' +
                '<div class="timeline-progress' + progressTrackClass + '">' + (progress > 0 ? '<i style="width:' + progress + '%"></i>' : '') + '</div>' +
                '<strong class="timeline-progress-value">' + progress + '%</strong>' +
                '<div class="timeline-badges">' + renderScheduleStageBadges(stage, today, customerMode) + '</div>' +
            '</div>';
        }).join('') + '</div>';
    };

    renderSchedulePanel = function (stages, project) {
        var planner = renderSchedulePlanner(project, stages);
        var forecast = renderSectionScheduleForecast(project);
        var procurement = renderScheduleProcurementBoard(project);
        if (!stages.length) return planner + forecast + procurement + renderSchedule(project);
        var internal = stages;
        var customer = stages.filter(function (stage) { return Number(stage.is_client_visible) === 1; });
        return planner + forecast + procurement + '<div class="schedule-split">' +
            '<section class="card schedule-card"><div class="card-head"><h3>Внутренний график</h3></div>' + renderScheduleRows(internal, false) + '</section>' +
            '<section class="card schedule-card"><div class="card-head"><h3>График для заказчика</h3></div>' + renderScheduleRows(customer, true) + '</section>' +
        '</div>';
    };

    function getProjectTabMode(projectId, tab) {
        if (!state.projectTabModesByProject[projectId]) state.projectTabModesByProject[projectId] = {};
        return state.projectTabModesByProject[projectId][tab] || 'list';
    }

    function setProjectTabMode(projectId, tab, mode) {
        if (!state.projectTabModesByProject[projectId]) state.projectTabModesByProject[projectId] = {};
        state.projectTabModesByProject[projectId][tab] = mode === 'market' ? 'market' : 'list';
    }

    function marketErrorLabel(code) {
        if (code === 'estimate_not_linked') return 'Объект пока не связан со сметой AutoBot.';
        if (code === 'autobot_unavailable') return 'AutoBot сейчас недоступен, попробуй чуть позже.';
        return 'Не удалось загрузить анализ рынка.';
    }

    function formatMarketDelta(delta) {
        if (delta == null) return '<span class="muted">—</span>';
        if (delta === 0) return '<span class="market-delta market-delta-even">Ровно по смете</span>';
        var cls = delta < 0 ? 'market-delta-save' : 'market-delta-over';
        var label = delta < 0 ? 'Ниже' : 'Выше';
        return '<span class="market-delta ' + cls + '">' + label + ' на ' + escapeHtml(money(Math.abs(delta))) + '</span>';
    }

    function renderMarketSources(row) {
        var sources = Array.isArray(row.sources) ? row.sources : [];
        if (!sources.length) return '<span class="muted">Нет источников</span>';
        var visible = sources.slice(0, 3).map(function (source) {
            var label = source.domain || source.title || 'Источник';
            return '<a href="' + escapeHtml(source.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>';
        }).join('');
        var more = row.sourceCount > 3 ? '<span class="market-source-more">+' + (row.sourceCount - 3) + '</span>' : '';
        return '<div class="market-sources">' + visible + more + '</div>';
    }

    function renderMarketTable(rows, kind) {
        if (!rows.length) {
            return '<div class="market-empty">По этому разделу пока нет строк для анализа.</div>';
        }
        return '<div class="market-table-wrap"><table class="market-table">' +
            '<thead><tr>' +
                '<th>Позиция</th>' +
                '<th>Смета</th>' +
                '<th>Рынок</th>' +
                '<th>Разница</th>' +
                '<th>Источники</th>' +
            '</tr></thead><tbody>' +
            rows.map(function (row) {
                var meta = [
                    row.sectionTitle || '',
                    row.plannedQty ? ('Объем: ' + row.plannedQty + ' ' + (row.unit || '')) : '',
                    row.positionIndex ? ('№ ' + row.positionIndex) : ''
                ].filter(Boolean).join(' • ');
                var marketCell = row.marketPrice == null
                    ? '<span class="market-missing">Нет данных</span>'
                    : '<strong>' + escapeHtml(money(row.marketPrice)) + '</strong>' +
                        (row.marketType ? '<small>' + escapeHtml(kind === 'work' ? 'Работы AutoBot' : 'Рынок AutoBot') + '</small>' : '');
                return '<tr>' +
                    '<td><b>' + escapeHtml(row.title) + '</b><small>' + escapeHtml(meta || 'Без раздела') + '</small></td>' +
                    '<td><strong>' + escapeHtml(money(row.estimateUnitPrice || 0)) + '</strong><small>Всего: ' + escapeHtml(money(row.estimateTotal || 0)) + '</small></td>' +
                    '<td>' + marketCell + (row.statusNote ? '<small>' + escapeHtml(row.statusNote) + '</small>' : '') + '</td>' +
                    '<td>' + formatMarketDelta(row.deltaPerUnit) + '</td>' +
                    '<td>' + renderMarketSources(row) + '</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>';
    }

    function renderProjectMarketBlock(projectId, kind) {
        var cache = (state.marketAnalysisByProject[projectId] || {})[kind];
        if (!cache || cache.loading) {
            return '<div class="market-empty">Собираем анализ рынка из AutoBot...</div>';
        }
        if (cache.error) {
            return '<div class="market-empty">' + escapeHtml(marketErrorLabel(cache.error)) + '</div>';
        }
        var summary = cache.summary || {};
        return '<div class="execution-summary">' +
            stat('Всего позиций', String(summary.total || 0)) +
            stat('Есть рынок', String(summary.withMarketData || 0), summary.withMarketData ? '' : 'warn') +
            stat('Без рынка', String(summary.withoutMarketData || 0), summary.withoutMarketData ? 'warn' : '') +
        '</div>' + renderMarketTable(cache.rows || [], kind);
    }

    function renderProjectTabViewSwitcher(projectId, tab, title, subtitle) {
        var mode = getProjectTabMode(projectId, tab);
        return '<div class="market-toolbar">' +
            '<div><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(subtitle) + '</p></div>' +
            '<div class="segmented compact" data-market-switcher>' +
                '<button type="button" class="' + (mode === 'list' ? 'active' : '') + '" data-market-mode="list" data-market-tab="' + tab + '">Список</button>' +
                '<button type="button" class="' + (mode === 'market' ? 'active' : '') + '" data-market-mode="market" data-market-tab="' + tab + '">Анализ рынка</button>' +
            '</div>' +
        '</div>';
    }

    function renderProjectMaterialsTab(project, items, insights) {
        var header = renderProjectTabViewSwitcher(project.id, 'materials', 'Материалы', 'Список позиций и отдельный вид с ценами рынка из AutoBot.');
        if (getProjectTabMode(project.id, 'materials') === 'market') {
            return header + renderProjectMarketBlock(project.id, 'material');
        }
        return header + renderMaterials(items, project.id, insights);
    }

    function renderProjectWorksTab(project, stages, items) {
        var header = renderProjectTabViewSwitcher(project.id, 'works', 'Работы', 'Текущие работы по смете и отдельная сводка по рыночным ценам.');
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
                materialsPanel.innerHTML = renderProjectMaterialsTab(
                    project,
                    state.materialsByProject[projectId] || [],
                    state.materialInsightsByProject[projectId] || {}
                );
            }
        }
        if (tab === 'works') {
            var worksPanel = qs('[data-panel="works"]');
            if (worksPanel) {
                worksPanel.innerHTML = renderProjectWorksTab(
                    project,
                    state.stagesByProject[projectId] || [],
                    state.materialsByProject[projectId] || []
                );
            }
        }
        bindProjectMarketToggles(projectId);
        bindProjectChainActions();
    }

    function bindProjectMarketToggles(projectId) {
        qsa('[data-market-mode]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
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

    openProject = function (projectId) {
        var root = qs('[data-project-detail]');
        if (!root) return;
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;
        state.selectedProject = project;
        root.hidden = false;
        setProjectFocusMode(true);
        ensureProjectWorksTab();

        var detailTitle = qs('[data-project-title]') || qs('[data-detail-title]');
        var overviewPanel = qs('[data-panel="overview"]');
        var executionPanel = qs('[data-panel="execution"]');
        var materialsPanel = qs('[data-panel="materials"]');
        var worksPanel = qs('[data-panel="works"]');
        var schedulePanel = qs('[data-panel="schedule"]');
        var tasksPanel = qs('[data-panel="tasks"]');
        var financePanel = qs('[data-panel="finance"]');
        var documentsPanel = qs('[data-panel="documents"]');
        var chatPanel = qs('[data-panel="chat"]');
        var aiPanel = qs('[data-panel="ai"]');

        if (detailTitle) detailTitle.textContent = project.title || 'Карточка объекта';
        if (overviewPanel) overviewPanel.innerHTML = renderProjectOverview(project);
        if (executionPanel) executionPanel.innerHTML = '<p class="muted">Загружаем структуру объекта...</p>';
        if (materialsPanel) materialsPanel.innerHTML = '<p class="muted">Загружаем материалы...</p>';
        if (worksPanel) worksPanel.innerHTML = '<p class="muted">Загружаем работы...</p>';
        if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
        if (tasksPanel) tasksPanel.innerHTML = '<p class="muted">Загружаем задачи...</p>';
        if (financePanel) financePanel.innerHTML = '';
        if (documentsPanel) documentsPanel.innerHTML = '<p class="muted">Загружаем документы...</p>';
        if (chatPanel) chatPanel.innerHTML = '<p class="muted">Загружаем чат...</p>';
        if (aiPanel) aiPanel.innerHTML = '';

        bindProjectOverviewActions();
        activateProjectTab('overview');

        loadMaterials(project.id, function (items) {
            if (materialsPanel) {
                materialsPanel.innerHTML = renderMaterials(items, project.id, state.materialInsightsByProject[project.id] || null);
            }
            var overviewMaterials = qs('[data-panel="overview-materials"]') || qs('[data-project-overview-materials]');
            if (overviewMaterials && typeof renderOverviewMaterials === 'function') {
                overviewMaterials.innerHTML = renderOverviewMaterials(items);
            }
            if (state.stagesByProject[project.id] && worksPanel) {
                worksPanel.innerHTML = renderWorksPanel(state.stagesByProject[project.id], items);
            }
        });

        loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function () {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            var stages = state.stagesByProject[project.id] || [];
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(stages, project);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
        });

        loadAnalysis(project.id, function (analysis) {
            if (aiPanel) aiPanel.innerHTML = renderBackendAnalysis(analysis);
        });

        loadStages(project.id, function (stages) {
            if (executionPanel) executionPanel.innerHTML = renderExecutionPanel(stages, project.id);
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(stages, project);
            if (worksPanel) {
                worksPanel.innerHTML = renderWorksPanel(stages, state.materialsByProject[project.id] || []);
            }
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
            loadExecutionInsights(project.id, stages);
        });

        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
    };

    renderSchedulePanel = function (stages, project) {
        var planner = renderSchedulePlanner(project, stages);
        var forecast = renderSectionScheduleForecast(project);
        return planner + forecast;
    };

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
        var currentUser = qs('[data-current-user]');
        var currentRole = qs('[data-current-role]');
        var userBadge = qs('[data-user-badge]');
        var name = state.user.name || state.user.login || 'Пользователь';
        var roleLabel = state.user.roleLabel || state.user.role || '';
        if (currentUser) currentUser.textContent = name;
        if (currentRole) currentRole.textContent = roleLabel;
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
        return String(item.sectionTitle || item.section_title || item.stageTitle || '').trim() || 'Без раздела';
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

    function renderWorksPanel(estimateItems, stages) {
        var estimateWorks = (estimateItems || []).filter(function (item) {
            return normalizeItemKindClient(item.itemKind || item.item_kind) === 'work';
        });
        if (estimateWorks.length) {
            var groupedEstimateWorks = groupEstimateItemsBySection(estimateWorks);
            return '<div class="execution-summary">' +
                stat('Работ', String(estimateWorks.length)) +
                stat('Разделов', String(groupedEstimateWorks.length)) +
                stat('Источник', 'Смета') +
            '</div>' +
            groupedEstimateWorks.map(function (group) {
                return '<section class="subsection">' +
                    '<div class="card-head"><h3>' + escapeHtml(group.sectionTitle) + '</h3><span class="muted">' + escapeHtml(String(group.items.length) + ' поз.') + '</span></div>' +
                    '<div class="materials-list">' + group.items.map(renderEstimateWorkRow).join('') + '</div>' +
                '</section>';
            }).join('');
        }

        var stageData = buildStageMaps(stages || []);
        var works = (stages || []).filter(function (stage) {
            var stageKind = String(stage.stage_kind || '').trim().toLowerCase();
            var children = stageData.childrenMap[Number(stage.id)] || [];
            return stageKind === 'work' || (stageKind && stageKind !== 'section' && children.length === 0);
        });
        if (!works.length) {
            return '<p class="muted">Работы по разделам появятся после импорта сметы/структуры с разбивкой.</p>';
        }
        var grouped = {};
        var order = [];
        works.forEach(function (stage) {
            var root = stageRootSection(stage, stageData.stageMap);
            var sectionTitle = String(root && root.title || 'Без раздела').trim() || 'Без раздела';
            if (!grouped[sectionTitle]) {
                grouped[sectionTitle] = [];
                order.push(sectionTitle);
            }
            grouped[sectionTitle].push(stage);
        });
        return '<div class="execution-summary">' +
            stat('Работ', String(works.length)) +
            stat('Разделов', String(order.length)) +
            stat('Источник', 'График') +
        '</div>' +
        order.map(function (sectionTitle) {
            return '<section class="subsection">' +
                '<div class="card-head"><h3>' + escapeHtml(sectionTitle) + '</h3><span class="muted">' + escapeHtml(String(grouped[sectionTitle].length) + ' работ') + '</span></div>' +
                '<div class="materials-list">' + grouped[sectionTitle].map(function (stage) {
                    return renderStageWorkRow(stage, stageData.stageMap);
                }).join('') + '</div>' +
            '</section>';
        }).join('');
    }

    function renderMaterials(items, projectId, insights) {
        var materialItems = (items || []).filter(function (item) {
            return normalizeItemKindClient(item.itemKind || item.item_kind) !== 'work';
        });
        return renderMaterialsGrouped(materialItems, projectId, insights || {});
    }

    function openProject(projectId) {
        var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
        if (!project) return;
        ensureProjectWorksSurface();
        state.selectedProject = project;
        setProjectFocusMode(true);
        qs('[data-project-detail]').hidden = false;
        qs('[data-detail-title]').textContent = project.title;
        activateProjectTab('overview');
        var detailCard = qs('[data-project-detail]');
        if (detailCard && typeof detailCard.scrollIntoView === 'function') {
            detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var focusRoot = qs('[data-project-focus]');
        if (focusRoot) {
            focusRoot.innerHTML = '';
            focusRoot.hidden = true;
        }
        qs('[data-panel="overview"]').innerHTML =
            renderProjectOverviewHero(project) +
            renderProjectOverviewActions(project) +
            '<section class="subsection"><div class="card-head"><h3>Назначения на объект</h3></div><div data-project-assignments>Загрузка назначений...</div></section>';
        qs('[data-panel="execution"]').innerHTML = '<p class="muted">Загрузка структуры объекта...</p>';
        qs('[data-panel="materials"]').innerHTML = '<p class="muted">Загрузка материалов...</p>';
        if (qs('[data-panel="works"]')) qs('[data-panel="works"]').innerHTML = '<p class="muted">Загрузка работ...</p>';
        qs('[data-panel="schedule"]').innerHTML = renderSchedule(project);
        qs('[data-panel="tasks"]').innerHTML = '<p class="muted">Загрузка задач...</p>';
        qs('[data-panel="documents"]').innerHTML = '<p class="muted">Загрузка документов...</p>';
        qs('[data-panel="chat"]').innerHTML = '<p class="muted">Загрузка чатов...</p>';
        qs('[data-panel="ai"]').innerHTML = renderAi(project, []);
        bindProjectOverviewActions();
        loadMaterials(project.id, function (items) {
            var overview = qs('[data-panel="overview"]');
            if (overview && !qs('[data-project-overview-materials]', overview)) {
                overview.insertAdjacentHTML('beforeend', '<section class="subsection"><div class="card-head"><h3>Материалы по смете</h3></div><div data-project-overview-materials></div></section>');
            }
            var overviewMaterials = qs('[data-project-overview-materials]', overview || document);
            loadMaterialInsights(project.id, function (insights) {
                qs('[data-panel="materials"]').innerHTML = renderMaterials(items, project.id, insights);
                if (overviewMaterials) overviewMaterials.innerHTML = renderMaterials(items, project.id, insights);
                bindProjectChainActions();
                qs('[data-panel="ai"]').innerHTML = renderAi(project, items.filter(function (item) {
                    return normalizeItemKindClient(item.itemKind || item.item_kind) !== 'work';
                }));
                loadStages(project.id, function (stages) {
                    var worksPanel = qs('[data-panel="works"]');
                    if (worksPanel) worksPanel.innerHTML = renderWorksPanel(items, stages);
                    qs('[data-panel="execution"]').innerHTML = renderExecutionPanel(stages, project.id);
                    qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, project);
                    bindStageCreateForm(project.id);
                    bindStageEditors(project.id);
                    bindAutoScheduleForm(project.id);
                    bindScheduleStatusActions(project.id);
                    loadExecutionInsights(project.id, stages);
                });
            });
        });
        loadAnalysis(project.id, function (analysis) {
            qs('[data-panel="ai"]').innerHTML = renderBackendAnalysis(analysis);
        });
        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
    }

    function renderProjectsPage() {
        ensureProjectWorksSurface();
        if (isAdminRole()) {
            loadCompanies(populateProjectCompanySelects);
        }
        ensureProjectEditCard();
        bindProjectCreate();
        bindProjectEditForm();
        bindProjectBootstrapForm();
        var bootstrapForm = qs('[data-project-bootstrap-form]');
        if (bootstrapForm && bootstrapForm.closest('section')) {
            bootstrapForm.closest('section').hidden = true;
        }
        renderProjectStats();
        renderProjectCritical();
        renderProjectList(state.projects);
        var search = qs('[data-project-search]');
        if (search && search.dataset.bound !== '1') {
            search.dataset.bound = '1';
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
        if (close && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', function () {
                state.selectedProject = null;
                qs('[data-project-detail]').hidden = true;
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
            if (state.user && hasRole('customer') && ['execution', 'materials', 'works', 'tasks', 'finance'].indexOf(button.dataset.tab) !== -1) {
                button.remove();
                return;
            }
            if (button.dataset.tab === 'finance' && !canSeeFinances()) {
                button.remove();
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
            var matched = state.projects.some(function (project) { return Number(project.id) === openProjectId; });
            if (matched) {
                openProject(openProjectId);
            }
        }
    }

    function syncDrawerBodyState() {
        var hasOpenDrawer = qsa('.side-drawer[data-open="1"], .project-edit-modal[data-open="1"]').length > 0;
        document.body.classList.toggle('side-drawer-open', hasOpenDrawer);
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
                closeSideDrawer(drawer);
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
                    progress_percent: form.progress_percent ? form.progress_percent.value : '',
                    raw_input: form.raw_input ? form.raw_input.value.trim() : '',
                    is_client_visible: form.is_client_visible.value === '1'
                })
            }).then(function (data) {
                var keepProject = form.project_id.value;
                var selectedDate = form.report_date.value || APP_TODAY;
                form.reset();
                form.project_id.value = keepProject;
                form.report_date.value = APP_TODAY;
                state.logsSelectedDateByProject[projectId] = selectedDate;
                state.logsCalendarMonthByProject[projectId] = logsMonthStartIso(selectedDate);
                var pageSelect = qs('[data-logs-project]');
                if (pageSelect) pageSelect.value = keepProject;
                if (data && data.project) updateProjectInState(data.project);
                var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || state.projects[0];
                loadProjectLogs(projectId, function (logs) {
                    loadProjectNotifications(projectId, function (notifications) {
                        renderLogsStats(logs, notifications);
                        renderLogsAlerts(notifications);
                        renderLogsCalendar(project, logs);
                        renderLogsList(project, logs);
                    });
                });
                closeSideDrawer(qs('[data-drawer-id="log-create"]'));
            }).catch(function (err) {
                if (error) {
                    error.textContent = err.payload && err.payload.error ? err.payload.error : 'Не удалось сохранить отчёт';
                    error.classList.add('active');
                }
            });
        });
    }

    function ensureProjectWorksTab() {
        var tabsRoot = qs('[data-project-detail] .tabs');
        if (tabsRoot && !qs('[data-tab="works"]', tabsRoot)) {
            var materialsTab = qs('[data-tab="materials"]', tabsRoot);
            if (materialsTab) materialsTab.insertAdjacentHTML('afterend', '<button class="tab" data-tab="works">Работы</button>');
        }
        var detail = qs('[data-project-detail]');
        if (detail && !qs('[data-panel="works"]', detail)) {
            var materialsPanel = qs('[data-panel="materials"]', detail);
            if (materialsPanel) materialsPanel.insertAdjacentHTML('afterend', '<div class="tab-panel" data-panel="works"></div>');
        }
    }

    function groupMaterialsBySection(items) {
        var groups = {};
        var order = [];
        (items || []).forEach(function (item) {
            var sectionTitle = String(item.sectionTitle || item.stageTitle || '').trim() || 'Без раздела';
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
            var originalTitle = String(group.title || '').trim();
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

    function renderWorksPanel(stages, items) {
        var stageMap = buildStageLookup(stages || []);
        var workStages = (stages || []).filter(function (stage) {
            return String(stage.stage_kind || '') !== 'section';
        });
        var estimateWorks = (items || []).filter(function (item) {
            return String(item.itemKind || '').toLowerCase() === 'work';
        });
        if (!workStages.length && !estimateWorks.length) {
            return '<p class="muted">Работы по смете пока не загружены.</p>';
        }

        var groups = {};
        var order = [];

        workStages.forEach(function (stage) {
            var sectionTitle = rootSectionTitleForStage(stage, stageMap);
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            groups[sectionTitle].stageRows.push(stage);
        });

        estimateWorks.forEach(function (item) {
            var sectionTitle = String(item.sectionTitle || item.stageTitle || '').trim() || 'Без раздела';
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            groups[sectionTitle].estimateRows.push(item);
        });

        var active = workStages.filter(function (stage) {
            return ['started', 'in_progress'].indexOf(stage.status_code) !== -1;
        }).length;
        var done = workStages.filter(function (stage) {
            return ['completed', 'approved'].indexOf(stage.status_code) !== -1 || percent(stage.progress) >= 100;
        }).length;
        var blocked = workStages.filter(function (stage) {
            return stage.status_code === 'blocked';
        }).length;

        return '<div class="execution-summary">' +
            stat('Разделов', String(order.length)) +
            stat('Работ', String(workStages.length || estimateWorks.length)) +
            stat('В работе', String(active), active ? 'warn' : '') +
            stat('Завершено', String(done)) +
            stat('Блокеры', String(blocked), blocked ? 'danger' : '') +
            stat('Позиции сметы', String(estimateWorks.length)) +
        '</div><div class="estimate-section-list">' + order.map(function (title) {
            var group = groups[title];
            return '<section class="estimate-section">' +
                '<div class="card-head estimate-section-head"><div class="estimate-section-title"><h3>' + escapeHtml(materialSectionLabel(order.indexOf(title))) + '</h3><span class="badge estimate-section-count">' + escapeHtml(group.stageRows.length + group.estimateRows.length) + ' поз.</span></div><small>' + escapeHtml(title) + '</small></div>' +
                '<div class="materials-list">' +
                    group.stageRows.map(function (stage) {
                        var meta = [
                            stagePathLabel(stage, stageMap),
                            stage.planned_start && stage.planned_end ? (stage.planned_start + ' — ' + stage.planned_end) : '',
                            stage.responsible || ''
                        ].filter(Boolean).join(' • ');
                        return '<div class="material-row work-row">' +
                            '<div><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta || 'Работа') + '</small></div>' +
                            '<div class="material-chain-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' • ' + percent(stage.progress) + '%</span></div>' +
                        '</div>';
                    }).join('') +
                    group.estimateRows.map(renderEstimateWorkItem).join('') +
                '</div>' +
            '</section>';
        }).join('') + '</div>';
    }

    function renderMaterials(items, projectId, insights) {
        var materials = (items || []).filter(function (item) {
            return String(item.itemKind || 'material').toLowerCase() !== 'work';
        });
        if (!materials.length) return '<p class="muted">Материалы по смете пока не загружены.</p>';
        var required = materials.filter(function (item) { return item.supplyStatus === 'required'; }).length;
        var soon = materials.filter(function (item) { return item.supplyStatus === 'soon'; }).length;
        var planned = materials.filter(function (item) { return item.supplyStatus === 'planned'; }).length;
        var safe = materials.filter(function (item) { return item.supplyStatus === 'in_stock'; }).length;
        insights = insights || {};
        var groups = groupMaterialsBySection(materials);
        return '<div class="execution-summary">' +
            stat('Всего позиций', String(materials.length)) +
            stat('Разделов', String(groups.length)) +
            stat('Требуется', String(required), required ? 'danger' : '') +
            stat('Скоро', String(soon), soon ? 'warn' : '') +
            stat('Запланировать', String(planned), planned ? 'warn' : '') +
            stat('В наличии', String(safe)) +
        '</div>' + renderGroupedMaterials(groups, projectId, insights);
    }

    function openProject(projectId) {
        var project = state.projects.find(function (item) { return Number(item.id) === projectId; });
        if (!project) return;
        ensureProjectWorksTab();
        state.selectedProject = project;
        setProjectFocusMode(true);
        qs('[data-project-detail]').hidden = false;
        qs('[data-detail-title]').textContent = project.title;
        activateProjectTab('overview');
        var detailCard = qs('[data-project-detail]');
        if (detailCard && typeof detailCard.scrollIntoView === 'function') {
            detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var focusRoot = qs('[data-project-focus]');
        if (focusRoot) {
            focusRoot.innerHTML = '';
            focusRoot.hidden = true;
        }
        qs('[data-panel="overview"]').innerHTML =
            renderProjectOverviewHero(project) +
            renderProjectOverviewActions(project) +
            '<section class="subsection"><div class="card-head"><h3>Назначения на объект</h3></div><div data-project-assignments>Загрузка назначений...</div></section>';
        qs('[data-panel="execution"]').innerHTML = '<p class="muted">Загрузка структуры объекта...</p>';
        qs('[data-panel="materials"]').innerHTML = '<p class="muted">Загрузка материалов...</p>';
        if (qs('[data-panel="works"]')) qs('[data-panel="works"]').innerHTML = '<p class="muted">Загрузка работ...</p>';
        qs('[data-panel="schedule"]').innerHTML = renderSchedule(project);
        qs('[data-panel="tasks"]').innerHTML = '<p class="muted">Загрузка задач...</p>';
        qs('[data-panel="documents"]').innerHTML = '<p class="muted">Загрузка документов...</p>';
        qs('[data-panel="chat"]').innerHTML = '<p class="muted">Загрузка чатов...</p>';
        qs('[data-panel="ai"]').innerHTML = renderAi(project, []);
        bindProjectOverviewActions();
        loadMaterials(project.id, function (items) {
            var overview = qs('[data-panel="overview"]');
            if (overview && !qs('[data-project-overview-materials]', overview)) {
                overview.insertAdjacentHTML('beforeend', '<section class="subsection"><div class="card-head"><h3>Материалы по смете</h3></div><div data-project-overview-materials></div></section>');
            }
            var overviewMaterials = qs('[data-project-overview-materials]', overview || document);
            loadMaterialInsights(project.id, function (insights) {
                qs('[data-panel="materials"]').innerHTML = renderMaterials(items, project.id, insights);
                if (overviewMaterials) overviewMaterials.innerHTML = renderMaterials(items, project.id, insights);
                bindProjectChainActions();
                qs('[data-panel="ai"]').innerHTML = renderAi(project, items);
                if (state.stagesByProject[project.id] && qs('[data-panel="works"]')) {
                    qs('[data-panel="works"]').innerHTML = renderWorksPanel(state.stagesByProject[project.id], items);
                }
            });
        });
        loadAnalysis(project.id, function (analysis) {
            qs('[data-panel="ai"]').innerHTML = renderBackendAnalysis(analysis);
        });
        loadStages(project.id, function (stages) {
            qs('[data-panel="execution"]').innerHTML = renderExecutionPanel(stages, project.id);
            qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, project);
            if (qs('[data-panel="works"]')) {
                qs('[data-panel="works"]').innerHTML = renderWorksPanel(stages, state.materialsByProject[project.id] || []);
            }
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            loadExecutionInsights(project.id, stages);
        });
        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
    }

    function renderProjectsPage() {
        renderProjectList(state.projects);
        try {
            ensureProjectWorksTab();
        } catch (error) {}
        var params = new URLSearchParams(location.search);
        var openProjectId = Number(params.get('openProject') || 0);
        try {
            if (isAdminRole()) {
                loadCompanies(populateProjectCompanySelects);
            }
        } catch (error) {}
        try { ensureProjectEditCard(); } catch (error) {}
        try { bindProjectCreate(); } catch (error) {}
        try { bindProjectEditForm(); } catch (error) {}
        try { bindProjectBootstrapForm(); } catch (error) {}
        var bootstrapForm = qs('[data-project-bootstrap-form]');
        if (bootstrapForm && bootstrapForm.closest('section')) {
            bootstrapForm.closest('section').hidden = true;
        }
        try { renderProjectStats(); } catch (error) {}
        try { renderProjectCritical(); } catch (error) {}
        renderProjectList(state.projects);
        var search = qs('[data-project-search]');
        if (search && search.dataset.bound !== '1') {
            search.dataset.bound = '1';
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
        if (close && close.dataset.bound !== '1') {
            close.dataset.bound = '1';
            close.addEventListener('click', function () {
                state.selectedProject = null;
                qs('[data-project-detail]').hidden = true;
                setProjectFocusMode(false);
                document.documentElement.classList.remove('projects-booting');
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
            if (state.user && hasRole('customer') && ['execution', 'materials', 'works', 'tasks', 'finance'].indexOf(button.dataset.tab) !== -1) {
                button.remove();
                return;
            }
            if (button.dataset.tab === 'finance' && !canSeeFinances()) {
                button.remove();
                return;
            }
            button.dataset.projectTabBound = '1';
            button.addEventListener('click', function () {
                activateProjectTab(button.dataset.tab);
            });
        });
        if (openProjectId && (!state.selectedProject || Number(state.selectedProject.id) !== openProjectId)) {
            var matched = state.projects.some(function (project) { return Number(project.id) === openProjectId; });
            if (matched) {
                openProject(openProjectId);
                return;
            }
        }
        state.selectedProject = null;
        if (qs('[data-project-detail]')) {
            qs('[data-project-detail]').hidden = true;
        }
        setProjectFocusMode(false);
        document.documentElement.classList.remove('projects-booting');
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

    function renderSectionScheduleForecast(project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div>' +
                '<div class="section-schedule-empty">Собираем расчет по смете...</div>' +
            '</section>';
        }
        if (summary.error) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div>' +
                '<div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div>' +
            '</section>';
        }
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div>' +
            '</section>';
        }
        var range = {
            start: summary.startDate,
            end: summary.finishDate,
            totalDays: Math.max(1, Number(summary.totalDays || 1))
        };
        return '<section class="card section-schedule-board">' +
            '<div class="card-head">' +
                '<div><h3>График по разделам сметы</h3><span class="muted">Последовательность разделов, расчет в днях для бригады среднего уровня.</span></div>' +
                '<button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button>' +
            '</div>' +
            '<div class="execution-summary">' +
                stat('Старт', summary.startDate || '—') +
                stat('Финиш', summary.finishDate || '—') +
                stat('Разделов', String(sections.length)) +
                stat('Дней', String(summary.totalDays || 0)) +
                stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) +
                stat('Основа', 'Работы сметы') +
            '</div>' +
            renderScheduleScale(range) +
            '<div class="section-schedule-list">' + sections.map(function (section) {
                return renderSectionScheduleRow(section, range);
            }).join('') + '</div>' +
        '</section>';
    }

    function renderSectionScheduleRow(section, range) {
        var planStyle = scheduleBarStyle(section.startDate, section.endDate, range);
        var assumptionBadge = section.hasAssumptions ? '<span class="badge warn">Есть допущения</span>' : '<span class="badge success">По нормам</span>';
        var sources = Array.isArray(section.sources) ? section.sources.slice(0, 3) : [];
        var items = Array.isArray(section.items) ? section.items : [];
        return '<article class="section-schedule-card">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-title">' +
                    '<div><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml((section.startDate || '—') + ' - ' + (section.endDate || '—')) + '</small></div>' +
                    '<div class="project-badges">' +
                        '<span class="badge">' + escapeHtml(String(section.workItems || items.length || 0) + ' работ') + '</span>' +
                        '<span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span>' +
                        '<span class="badge success">' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</span>' +
                        assumptionBadge +
                    '</div>' +
                '</div>' +
                '<div class="section-schedule-track">' +
                    '<div class="schedule-gantt-track">' +
                        '<span class="schedule-gantt-today" style="left:' + scheduleTodayPercent(range) + '%"></span>' +
                        (planStyle ? '<span class="schedule-gantt-bar schedule-gantt-plan" style="' + planStyle + '"></span>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="section-schedule-meta">' +
                    '<strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong>' +
                    '<span>' + escapeHtml('чисто по нормам: ' + String(section.estimatedHours || 0) + ' чел.-ч') + '</span>' +
                '</div>' +
                (sources.length ? '<div class="section-schedule-sources">' + sources.map(function (source) {
                    var label = escapeHtml(source.label || 'Источник');
                    if (source.url) {
                        return '<a href="' + escapeHtml(source.url) + '" target="_blank" rel="noreferrer">' + label + '</a>';
                    }
                    return '<span>' + label + '</span>';
                }).join('') + '</div>' : '') +
                '<div class="section-schedule-items">' + items.slice(0, 8).map(function (item) {
                    return '<div class="section-schedule-item">' +
                        '<span>' + escapeHtml(item.title) + '</span>' +
                        '<small>' + escapeHtml(String(item.planned_qty) + ' ' + item.unit + ' • ' + Math.round(Number(item.estimated_hours || 0) * 10) / 10 + ' чел.-ч') + '</small>' +
                    '</div>';
                }).join('') + (items.length > 8 ? '<div class="section-schedule-item more"><span>Еще работ: ' + escapeHtml(String(items.length - 8)) + '</span></div>' : '') + '</div>' +
            '</div>' +
        '</article>';
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
                    qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, state.selectedProject);
                    bindAutoScheduleForm(projectId);
                    bindScheduleStatusActions(projectId);
                    bindSectionScheduleRefresh(projectId);
                }, true);
            });
        });
    }

    function renderSchedulePanel(stages, project) {
        var planner = renderSchedulePlanner(project, stages);
        var forecast = renderSectionScheduleForecast(project);
        var controlBoard = renderScheduleStateBoard(project);
        if (!stages.length) return planner + forecast + controlBoard + renderSchedule(project);
        var internal = stages;
        var customer = stages.filter(function (stage) { return Number(stage.is_client_visible) === 1; });
        return planner + forecast + controlBoard + '<div class="schedule-split">' +
            '<section class="card schedule-card"><div class="card-head"><h3>Внутренний график</h3></div>' + renderScheduleRows(internal, false) + '</section>' +
            '<section class="card schedule-card"><div class="card-head"><h3>График для заказчика</h3></div>' + renderScheduleRows(customer, true) + '</section>' +
        '</div>';
    }

    function openProject(projectId) {
        var root = qs('[data-project-detail]');
        if (!root) return;
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;
        state.selectedProject = project;
        root.hidden = false;
        setProjectFocusMode(true);
        ensureProjectWorksTab();
        qs('[data-project-title]').textContent = project.title;
        qs('[data-panel="overview"]').innerHTML = renderProjectOverview(project);
        qs('[data-panel="materials"]').innerHTML = '<p class="muted">Загружаем материалы...</p>';
        if (qs('[data-panel="works"]')) qs('[data-panel="works"]').innerHTML = '<p class="muted">Загружаем работы...</p>';
        qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
        qs('[data-panel="tasks"]').innerHTML = '';
        qs('[data-panel="documents"]').innerHTML = '';
        qs('[data-panel="executive"]').innerHTML = '';
        qs('[data-panel="chat"]').innerHTML = '';
        qs('[data-panel="analysis"]').innerHTML = '';
        if (qs('[data-panel="finance"]')) qs('[data-panel="finance"]').innerHTML = '';
        bindProjectOverviewActions();
        activateProjectTab('overview');

        loadMaterials(project.id, function (items) {
            qs('[data-panel="materials"]').innerHTML = renderMaterials(items, project.id, state.materialInsightsByProject[project.id] || null);
            if (qs('[data-panel="overview-materials"]')) {
                qs('[data-panel="overview-materials"]').innerHTML = renderOverviewMaterials(items);
            }
            if (state.stagesByProject[project.id] && qs('[data-panel="works"]')) {
                qs('[data-panel="works"]').innerHTML = renderWorksPanel(state.stagesByProject[project.id], items);
            }
        });
        loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function () {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            var stages = state.stagesByProject[project.id] || [];
            qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, project);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
        });
        loadAnalysis(project.id, function (analysis) {
            qs('[data-panel="ai"]').innerHTML = renderBackendAnalysis(analysis);
        });
        loadStages(project.id, function (stages) {
            qs('[data-panel="execution"]').innerHTML = renderExecutionPanel(stages, project.id);
            qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, project);
            if (qs('[data-panel="works"]')) {
                qs('[data-panel="works"]').innerHTML = renderWorksPanel(stages, state.materialsByProject[project.id] || []);
            }
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
            loadExecutionInsights(project.id, stages);
        });
        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
    }

    function finalSectionScheduleCardClass(section) {
        var start = String(section.startDate || '').trim();
        var end = String(section.endDate || '').trim();
        if (start && end && start <= APP_TODAY && end >= APP_TODAY) return ' is-current';
        if (end && end < APP_TODAY) return ' is-past';
        if (start && start > APP_TODAY) return ' is-upcoming';
        return '';
    }

    renderScheduleRows = function (stages, customerMode) {
        var today = APP_TODAY;
        if (!stages.length) return '<p class="muted">Нет этапов для отображения.</p>';
        return '<div class="timeline">' + stages.map(function (stage) {
            var start = customerMode ? (stage.customer_start || stage.planned_start || '—') : (stage.planned_start || '—');
            var end = customerMode ? (stage.customer_end || stage.planned_end || '—') : (stage.planned_end || '—');
            var summary = customerMode
                ? (start + ' — ' + end + ' • ' + statusLabel(stage.status_code))
                : buildScheduleStageSummary(stage, today);
            var kicker = [timelineStageKindLabel(stage), !customerMode ? (stage.responsible || '') : ''].filter(Boolean).join(' • ');
            return '<div class="timeline-row ' + scheduleTimelineClass(stage, today) + timelineStageKindClass(stage) + '">' +
                '<div class="timeline-main">' +
                    (kicker ? '<small class="timeline-kicker">' + escapeHtml(kicker) + '</small>' : '') +
                    '<b>' + escapeHtml(stage.title) + '</b><span>' + escapeHtml(summary) + '</span>' +
                '</div>' +
                renderTimelineProgressCell(stage) +
                '<div class="timeline-badges">' + renderScheduleStageBadges(stage, today, customerMode) + '</div>' +
            '</div>';
        }).join('') + '</div>';
    };

    function sectionAccelerationHint(section) {
        var days = Number(section.estimatedDays || 0);
        var crew = Number(section.crewSize || 0);
        var itemsCount = Number(section.workItems || (Array.isArray(section.items) ? section.items.length : 0));
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
        var itemsCount = Number(section.workItems || (Array.isArray(section.items) ? section.items.length : 0));
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

    renderSectionScheduleRow = function (section, range) {
        var planStyle = scheduleBarStyle(section.startDate, section.endDate, range);
        var assumptionBadge = section.hasAssumptions ? '<span class="badge warn">Есть допущения</span>' : '<span class="badge success">По нормам</span>';
        var items = Array.isArray(section.items) ? section.items : [];
        var topItems = items.slice(0, 3).map(function (item) {
            return item.title;
        }).filter(Boolean).join(' • ');
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-title">' +
                    '<div><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml((section.startDate || '—') + ' - ' + (section.endDate || '—')) + '</small></div>' +
                    '<div class="project-badges">' +
                        '<span class="badge">' + escapeHtml(String(section.workItems || items.length || 0) + ' работ') + '</span>' +
                        '<span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span>' +
                        '<span class="badge success">' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</span>' +
                        assumptionBadge +
                    '</div>' +
                '</div>' +
                '<div class="section-schedule-track">' +
                    '<div class="schedule-gantt-track">' +
                        '<span class="schedule-gantt-today" style="left:' + scheduleTodayPercent(range) + '%"></span>' +
                        (planStyle ? '<span class="schedule-gantt-bar schedule-gantt-plan" style="' + planStyle + '"></span>' : '') +
                    '</div>' +
                    '<div class="section-schedule-track-meta"><span>Плановый интервал</span><strong>' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</strong></div>' +
                '</div>' +
                '<div class="section-schedule-meta">' +
                    '<strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong>' +
                    '<span>' + escapeHtml('чисто по нормам: ' + String(section.estimatedHours || 0) + ' чел.-ч') + '</span>' +
                '</div>' +
                '<div class="section-schedule-reco">' +
                    '<span>Как ускорить</span>' +
                    '<strong>' + escapeHtml(sectionAccelerationHint(section)) + '</strong>' +
                '</div>' +
                (topItems ? '<div class="section-schedule-caption">' + escapeHtml(topItems) + '</div>' : '') +
            '</div>' +
        '</article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div>' +
                '<div class="section-schedule-empty">Собираем расчет по смете...</div>' +
            '</section>';
        }
        if (summary.error) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div>' +
                '<div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div>' +
            '</section>';
        }
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) {
            return '<section class="card section-schedule-board">' +
                '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div>' +
            '</section>';
        }
        var range = {
            start: summary.startDate,
            end: summary.finishDate,
            totalDays: Math.max(1, Number(summary.totalDays || 1))
        };
        return '<section class="card section-schedule-board">' +
            '<div class="card-head">' +
                '<div><h3>График по разделам сметы</h3><span class="muted">Последовательность разделов и плановое окно по каждому разделу.</span></div>' +
                '<button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button>' +
            '</div>' +
            '<div class="execution-summary">' +
                stat('Старт', summary.startDate || '—') +
                stat('Финиш', summary.finishDate || '—') +
                stat('Разделов', String(sections.length)) +
                stat('Дней', String(summary.totalDays || 0)) +
                stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) +
                stat('Основа', 'Работы сметы') +
            '</div>' +
            '<div class="section-schedule-brief-list">' + sections.map(function (section) {
                return renderSectionScheduleBrief(section);
            }).join('') + '</div>' +
            renderScheduleScale(range) +
            '<div class="section-schedule-list">' + sections.map(function (section) {
                return renderSectionScheduleRow(section, range);
            }).join('') + '</div>' +
        '</section>';
    };

    renderSchedulePanel = function (stages, project) {
        var planner = renderSchedulePlanner(project, stages);
        var forecast = renderSectionScheduleForecast(project);
        return planner + forecast;
        var internal = stages;
        var customer = stages.filter(function (stage) { return Number(stage.is_client_visible) === 1; });
        return planner + forecast + '<div class="schedule-split">' +
            '<section class="card schedule-card"><div class="card-head"><h3>Внутренний график</h3></div>' + renderScheduleRows(internal, false) + '</section>' +
            '<section class="card schedule-card"><div class="card-head"><h3>График для заказчика</h3></div>' + renderScheduleRows(customer, true) + '</section>' +
        '</div>';
    };

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

    renderSectionScheduleRow = function (project, section) {
        var items = Array.isArray(section.items) ? section.items : [];
        var progress = scheduleSectionProgress(project.id, section);
        var isOpen = isScheduleSectionOpen(project.id, section, false);
        var digest = finalSectionWorkDigest(section);
        var deadlineState = scheduleDeadlineState(section.startDate, section.endDate, progress.percent, section.estimatedDays);
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + (progress.percent >= 100 && progress.total ? ' is-done' : '') + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-summary" role="button" tabindex="0" data-section-schedule-toggle data-project-id="' + project.id + '" data-section-key="' + escapeHtml(scheduleSectionKey(section)) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
                    '<div class="section-schedule-summary-head">' +
                        '<div class="section-schedule-summary-copy">' +
                            '<div class="section-schedule-heading">' +
                                '<span class="section-schedule-label">Раздел</span>' +
                                '<div class="section-schedule-title"><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small></div>' +
                            '</div>' +
                            '<div class="project-badges"><span class="badge">' + escapeHtml(String(progress.total || section.workItems || 0) + ' работ') + '</span><span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span>' + scheduleDeadlineBadge(deadlineState) + (progress.total ? '<span class="badge">' + escapeHtml(String(progress.done) + '/' + String(progress.total) + ' готово') + '</span>' : '') + '</div>' +
                        '</div>' +
                        '<span class="section-schedule-chevron" aria-hidden="true">' + (isOpen ? '-' : '+') + '</span>' +
                    '</div>' +
                    '<div class="section-schedule-progress"><div class="section-schedule-progress-bar"><span style="width:' + progress.percent + '%"></span></div><div class="section-schedule-progress-meta"><strong>' + escapeHtml(String(progress.percent)) + '%</strong><span>' + escapeHtml(progress.total ? (String(progress.done) + ' из ' + String(progress.total) + ' работ выполнено') : 'Работы появятся после загрузки сметы') + '</span></div></div>' +
                    '<div class="section-schedule-meta"><strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong><span>' + escapeHtml(digest.volume || deadlineState.label) + '</span></div>' +
                    (digest.titles ? '<div class="section-schedule-caption">' + escapeHtml(digest.titles) + '</div>' : '') +
                '</div>' +
                (isOpen ? '<div class="section-schedule-details">' + items.map(function (item) {
                    var workDone = isScheduleWorkDone(project.id, section.title, item);
                    return '<label class="section-work-check' + (workDone ? ' is-done' : '') + '"><input type="checkbox" data-section-work-check data-project-id="' + project.id + '" data-section-title="' + escapeHtml(section.title) + '" data-work-title="' + escapeHtml(item.title) + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (workDone ? ' checked' : '') + '><span class="section-work-check-copy"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(formatWorkLine(item) || 'Объем не указан') + '</small></span></label>';
                }).join('') + (items.length ? '' : '<div class="section-schedule-empty inline">В этом разделе пока нет работ для отметки.</div>') + '</div>' : '') +
            '</div></article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">Собираем расчет по смете...</div></section>';
        if (summary.error) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div></section>';
        var deadline = String(project.deadline_at || project.deadline || summary.finishDate || '').trim();
        var daysLeft = deadline ? daysBetween(APP_TODAY, deadline) : null;
        var overallProgress = projectScheduleProgress(project, summary);
        var projectDeadlineState = scheduleDeadlineState(summary.startDate, deadline || summary.finishDate, overallProgress.percent, summary.totalDays);
        return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Фактический прогресс по разделам и отмеченным работам.</span></div><button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button></div>' +
            '<div class="execution-summary">' + stat('Старт', finalGraphDate(summary.startDate)) + stat('Дедлайн', finalGraphDate(deadline || summary.finishDate)) + stat('До дедлайна', daysLeft == null ? '—' : String(daysLeft), projectDeadlineState.kind) + stat('Разделов', String(sections.length)) + stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) + '</div>' +
            '<div class="section-schedule-overview"><div class="section-schedule-overview-head"><strong>Прогресс по разделам</strong><span>' + escapeHtml(overallProgress.total ? (String(overallProgress.done) + ' из ' + String(overallProgress.total) + ' работ отмечено') : 'Отмечайте выполненные работы внутри разделов') + '</span></div><div class="section-schedule-progress"><div class="section-schedule-progress-bar"><span style="width:' + overallProgress.percent + '%"></span></div><div class="section-schedule-progress-meta"><strong>' + escapeHtml(String(overallProgress.percent)) + '%</strong><span>' + escapeHtml(projectDeadlineState.label) + '</span></div></div></div>' +
            '<div class="section-schedule-list">' + sections.map(function (section) { return renderSectionScheduleRow(project, section); }).join('') + '</div></section>';
    };

    materialRow = function (item, projectId, insight) {
        var missing = Number(item.missingQty) || 0;
        var stock = Number(item.stockQty) || 0;
        var planned = Number(item.plannedQty) || 0;
        var unitLabel = String(item.unit || '').trim() || 'ед.';
        var meta = [
            'По смете: ' + item.plannedQty + ' ' + escapeHtml(item.unit),
            'куплено: ' + item.purchasedQty,
            'использовано: ' + item.usedQty,
            'остаток: ' + item.stockQty,
            item.needByDate ? 'нужно к ' + item.needByDate : '',
            item.stageTitle ? 'этап: ' + item.stageTitle : ''
        ].filter(Boolean).join(' • ');
        var supplyNote = '';
        if (insight) {
            supplyNote = insight.selectedName
                ? 'Выбран поставщик: ' + insight.selectedName
                : insight.quoted
                    ? 'Просчитано предложений: ' + insight.quoted
                    : insight.called
                        ? 'Уже в обзвоне: ' + insight.called
                        : 'В работе поставщиков: ' + insight.total;
        } else if (canManageSuppliers()) {
            supplyNote = 'Поставщик по этой позиции еще не заведен';
        }
        var actions = '<div class="material-chain-actions">' + renderMaterialSupplierPicker(projectId, item, insight) + '</div>';
        var statusLabel = finalSectionSummaryNumber(stock) + '/' + finalSectionSummaryNumber(planned) + ' ' + unitLabel;
        return '<div class="material-row material-row-linked">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + meta + (supplyNote ? '<br>' + escapeHtml(supplyNote) : '') + '</small></div>' +
            '<div class="material-chain-side"><span class="badge ' + planningStatusClass(item.supplyStatus || (missing > 0 ? 'required' : 'in_stock')) + '">' + escapeHtml(statusLabel) + '</span>' + actions + '</div>' +
        '</div>';
    };

    renderEstimateWorkItem = function (item) {
        var plannedQty = Number(item.plannedQty || item.planned_qty || 0);
        var unitLabel = String(item.unit || '').trim() || 'ед.';
        var estimatedHours = Number(item.estimated_hours || item.estimatedHours || 0);
        var meta = [
            item.unit ? ('Ед.: ' + item.unit) : '',
            item.stageTitle ? ('Этап: ' + item.stageTitle) : ''
        ].filter(Boolean).join(' • ');
        var sideBadges = [
            '<span class="badge work-amount-badge">' + escapeHtml(finalSectionSummaryNumber(plannedQty) + ' ' + unitLabel) + '</span>'
        ];
        if (estimatedHours > 0) {
            sideBadges.push('<span class="badge work-hours-badge">' + escapeHtml(finalSectionSummaryNumber(estimatedHours) + ' чел.-ч') + '</span>');
        }
        return '<div class="material-row work-row">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta || 'Работа из сметы') + '</small></div>' +
            '<div class="material-chain-side work-row-side">' + sideBadges.join('') + '</div>' +
        '</div>';
    };

    openProject = function (projectId) {
        try {
            var root = qs('[data-project-detail]');
            if (!root) return;

            var project = state.projects.find(function (item) {
                return Number(item.id) === Number(projectId);
            });
            if (!project) return;
            try {
                var projectParams = new URLSearchParams(location.search);
                projectParams.set('openProject', String(projectId));
                var projectQuery = projectParams.toString();
                history.replaceState(null, '', location.pathname + (projectQuery ? '?' + projectQuery : ''));
            } catch (historyError) {}

            function panel(name) {
                return qs('[data-panel="' + name + '"]');
            }

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
            var titleNode = qs('[data-detail-title]');

            state.selectedProject = project;
            root.hidden = false;
            setProjectFocusMode(true);
            ensureProjectWorksTab();
            document.documentElement.classList.remove('projects-booting');
            document.documentElement.classList.remove('project-route-loading');

            if (!worksPanel) worksPanel = panel('works');
            if (titleNode) titleNode.textContent = project.title;
            if (overviewPanel) {
                overviewPanel.innerHTML =
                    renderProjectOverviewHero(project) +
                    renderProjectOverviewActions(project) +
                    '<section class="subsection"><div class="card-head"><h3>Назначения на объект</h3></div><div data-project-assignments>Загрузка назначений...</div></section>' +
                    '<section class="subsection"><div class="card-head"><h3>Материалы по смете</h3></div><div data-project-overview-materials><p class="muted">Загружаем материалы...</p></div></section>';
            }
            if (materialsPanel) materialsPanel.innerHTML = '<p class="muted">Загружаем материалы...</p>';
            if (worksPanel) worksPanel.innerHTML = '<p class="muted">Загружаем работы...</p>';
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
            if (reportsPanel) reportsPanel.innerHTML = '<p class="muted">Собираем отчеты по объекту...</p>';
            if (tasksPanel) tasksPanel.innerHTML = '';
            if (financePanel) financePanel.innerHTML = '';
            if (documentsPanel) documentsPanel.innerHTML = '';
            if (chatPanel) chatPanel.innerHTML = '';
            if (aiPanel) aiPanel.innerHTML = '<p class="muted">Собираем аналитику...</p>';

            bindProjectOverviewActions();
            activateProjectTab('overview');

            loadMaterials(project.id, function (items) {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (materialsPanel) {
                    materialsPanel.innerHTML = renderProjectMaterialsTab(project, items, state.materialInsightsByProject[project.id] || null);
                }
                var overviewMaterials = qs('[data-project-overview-materials]');
                if (overviewMaterials) {
                    overviewMaterials.innerHTML = renderMaterials(items, project.id, state.materialInsightsByProject[project.id] || null);
                }
                if (panel('works')) {
                    panel('works').innerHTML = renderProjectWorksTab(project, state.stagesByProject[project.id] || [], items);
                }
                bindProjectMarketToggles(project.id);
            });

            loadMaterialInsights(project.id, function (insights) {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (materialsPanel && state.materialsByProject[project.id]) {
                    materialsPanel.innerHTML = renderProjectMaterialsTab(project, state.materialsByProject[project.id] || [], insights || {});
                }
                var overviewMaterials = qs('[data-project-overview-materials]');
                if (overviewMaterials && state.materialsByProject[project.id]) {
                    overviewMaterials.innerHTML = renderMaterials(state.materialsByProject[project.id] || [], project.id, insights || {});
                }
                bindProjectMarketToggles(project.id);
                bindProjectChainActions();
            });

            loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function () {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (schedulePanel) {
                    schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
                }
                bindAutoScheduleForm(project.id);
                bindScheduleStatusActions(project.id);
                bindSectionScheduleRefresh(project.id);
            });

            loadProjectNotifications(project.id, function () {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (schedulePanel) {
                    schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
                }
                bindAutoScheduleForm(project.id);
                bindScheduleStatusActions(project.id);
                bindSectionScheduleRefresh(project.id);
            });

            loadAnalysis(project.id, function (analysis) {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (aiPanel) aiPanel.innerHTML = renderBackendAnalysis(analysis);
            });

            loadStages(project.id, function (stages) {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(stages, project);
                if (panel('works')) {
                    panel('works').innerHTML = renderProjectWorksTab(project, stages, state.materialsByProject[project.id] || []);
                }
                bindStageCreateForm(project.id);
                bindStageEditors(project.id);
                bindAutoScheduleForm(project.id);
                bindScheduleStatusActions(project.id);
                bindSectionScheduleRefresh(project.id);
                loadExecutionInsights(project.id, stages);
                bindProjectMarketToggles(project.id);
            });

            loadProjectMarketAnalysis(project.id, 'material', function () {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (getProjectTabMode(project.id, 'materials') !== 'market') return;
                rerenderProjectMarketTab(project.id, 'materials');
            });

            loadProjectMarketAnalysis(project.id, 'work', function () {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
                if (getProjectTabMode(project.id, 'works') !== 'market') return;
                rerenderProjectMarketTab(project.id, 'works');
            });

            refreshProjectReportsTab(project.id);
            loadTasks(project.id);
            if (canSeeFinances()) loadProjectFinances(project.id);
            loadDocuments(project.id);
            loadProjectChats(project.id);
            loadProjectAssignments(project.id);
            bindProjectChainActions();
            bindProjectMarketToggles(project.id);
        } catch (error) {
            document.documentElement.classList.remove('project-route-loading');
            var fallbackRoot = qs('[data-project-detail]');
            var fallbackOverview = qs('[data-panel="overview"]');
            if (fallbackRoot) fallbackRoot.hidden = false;
            if (fallbackOverview) {
                fallbackOverview.innerHTML = '<section class="subsection"><div class="card-head"><h3>Не удалось открыть объект</h3></div><p class="muted">Мы поймали ошибку рендера. Обнови страницу, а я уже поправил этот путь.</p></section>';
            }
            activateProjectTab('overview');
            try { console.error(error); } catch (consoleError) {}
        }
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

    renderLogsList = function (project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        if (!logs.length) {
            root.innerHTML = '<p class="muted">По объекту "' + escapeHtml(project.title) + '" пока нет дневных отчетов.</p>';
            return;
        }
        root.innerHTML = logs.map(function (log) {
            return '<article class="log-card">' +
                '<div class="log-top">' +
                    '<div><span>' + escapeHtml(log.report_date || '—') + '</span><h4>' + escapeHtml(log.title) + '</h4></div>' +
                    '<div class="log-top-side">' +
                        '<div class="project-badges">' +
                            (log.progress_percent != null && log.progress_percent !== '' ? '<span class="badge success">' + escapeHtml(Math.round(Number(log.progress_percent) || 0)) + '%</span>' : '') +
                            '<span class="badge">' + escapeHtml(log.workers_count || 0) + ' чел.</span>' +
                            '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + (Number(log.is_client_visible) === 1 ? 'Видно заказчику' : 'Внутренний') + '</span>' +
                        '</div>' +
                        renderProjectReportDeleteButton(project.id, log, true) +
                    '</div>' +
                '</div>' +
                '<p>' + escapeHtml(log.work_done) + '</p>' +
                '<div class="log-details">' +
                    (log.equipment ? '<div><span>Техника</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                    (log.blockers ? '<div class="log-risk"><span>Блокер</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                    (log.next_steps ? '<div><span>Дальше</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                '</div>' +
                (log.raw_input ? '<small class="muted">Исходный ввод: ' + escapeHtml(log.raw_input) + '</small>' : '') +
                '<small class="muted">Автор отчета: ' + escapeHtml(log.author_name || '—') + '</small>' +
            '</article>';
        }).join('');
        bindProjectReportDeleteActions();
    };

    function finalGraphDate(iso) {
        if (!iso) return '—';
        var parts = String(iso).split('-');
        if (parts.length !== 3) return iso;
        return parts[2] + '.' + parts[1] + '.' + parts[0];
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
        var workCount = Number(section.workItems || items.length || 0);
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

    renderSectionScheduleRow = function (section, range) {
        var assumptionBadge = section.hasAssumptions ? '<span class="badge warn">Есть допущения</span>' : '<span class="badge success">По нормам</span>';
        var items = Array.isArray(section.items) ? section.items : [];
        var digest = finalSectionWorkDigest(section);
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-title">' +
                    '<div><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small></div>' +
                    '<div class="project-badges"><span class="badge">' + escapeHtml(String(section.workItems || items.length || 0) + ' работ') + '</span><span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span><span class="badge success">' + escapeHtml(String(section.estimatedDays || 0) + ' дн.') + '</span>' + assumptionBadge + '</div>' +
                '</div>' +
                '<div class="section-schedule-meta"><strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong><span>' + escapeHtml('чисто по нормам: ' + String(section.estimatedHours || 0) + ' чел.-ч') + '</span></div>' +
                '<div class="section-schedule-reco"><span>Работы раздела</span><strong>' + escapeHtml(digest.lead) + '</strong>' + (digest.volume ? '<small>' + escapeHtml(digest.volume) + '</small>' : '') + '</div>' +
                (digest.titles ? '<div class="section-schedule-caption">' + escapeHtml(digest.titles) + '</div>' : '') +
            '</div>' +
        '</article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">Собираем расчет по смете...</div></section>';
        if (summary.error) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div></section>';
        var range = { start: summary.startDate, end: summary.finishDate, totalDays: Math.max(1, Number(summary.totalDays || 1)) };
        return '<section class="card section-schedule-board">' +
            '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Последовательность разделов и плановое окно по каждому разделу.</span></div><button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button></div>' +
            '<div class="execution-summary">' +
                stat('Старт', finalGraphDate(summary.startDate)) +
                stat('Дедлайн', finalGraphDate(summary.finishDate)) +
                stat('Разделов', String(sections.length)) +
                stat('Дней', String(summary.totalDays || 0)) +
                stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) +
                stat('Основа', 'Работы сметы') +
            '</div>' +
            '<div class="section-schedule-brief-list">' + sections.map(function (section) { return renderSectionScheduleBrief(section); }).join('') + '</div>' +
            renderScheduleScale(range) +
            '<div class="section-schedule-list">' + sections.map(function (section) { return renderSectionScheduleRow(section, range); }).join('') + '</div>' +
        '</section>';
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
            normalizedWorkKeyPart(section && section.title),
            normalizedWorkKeyPart(section && section.startDate),
            normalizedWorkKeyPart(section && section.endDate)
        ].join('|');
    }

    function scheduleWorkKey(sectionTitle, item) {
        return [
            normalizedWorkKeyPart(sectionTitle),
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

    function scheduleSectionProgress(projectId, section) {
        var items = Array.isArray(section && section.items) ? section.items : [];
        var total = items.length;
        var done = items.filter(function (item) {
            return isScheduleWorkDone(projectId, section.title, item);
        }).length;
        return {
            total: total,
            done: done,
            percent: total ? Math.round((done / total) * 100) : 0
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
        qs('[data-panel="schedule"]').innerHTML = renderSchedulePanel(stages, project);
        if (qs('[data-panel="works"]')) {
            qs('[data-panel="works"]').innerHTML = renderWorksPanel(stages, items);
        }
        bindAutoScheduleForm(projectId);
        bindScheduleStatusActions(projectId);
        bindSectionScheduleRefresh(projectId);
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
                var openNow = button.getAttribute('aria-expanded') === 'true';
                setScheduleSectionOpen(projectId, section, !openNow);
                rerenderProjectWorkProgress(projectId);
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
                setScheduleWorkDone(
                    projectId,
                    input.getAttribute('data-section-title') || '',
                    {
                        title: input.getAttribute('data-work-title') || '',
                        unit: input.getAttribute('data-work-unit') || '',
                        planned_qty: input.getAttribute('data-work-qty') || ''
                    },
                    input.checked
                );
                rerenderProjectWorkProgress(projectId);
            });
        });
    }

    var baseBindSectionScheduleRefresh = bindSectionScheduleRefresh;
    bindSectionScheduleRefresh = function (projectId) {
        baseBindSectionScheduleRefresh(projectId);
        bindSectionScheduleInteractions(projectId);
    };

    renderEstimateWorkItem = function (item, sectionTitle, projectId) {
        var isDone = projectId ? isScheduleWorkDone(projectId, sectionTitle, item) : false;
        var plannedQty = item.plannedQty != null ? item.plannedQty : item.planned_qty;
        var meta = [
            item.unit ? ('Ед.: ' + item.unit) : '',
            plannedQty != null && plannedQty !== '' ? ('Объем: ' + formattedWorkQty(plannedQty)) : '',
            item.stageTitle ? ('Этап: ' + item.stageTitle) : ''
        ].filter(Boolean).join(' • ');
        var hours = Number(item.estimated_hours || item.estimatedHours || 0);
        return '<div class="material-row work-row' + (isDone ? ' work-row-done' : '') + '">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta || 'Работа из сметы') + (item.notes ? '<br>' + escapeHtml(item.notes) : '') + '</small></div>' +
            '<div class="work-row-side">' +
                '<span class="badge work-amount-badge">' + escapeHtml(formattedWorkQty(plannedQty || 0) + ' ' + (item.unit || 'ед.')) + '</span>' +
                (hours > 0 ? '<span class="badge work-hours-badge">' + escapeHtml((Math.round(hours * 10) / 10).toString().replace('.', ',') + ' чел.-ч') + '</span>' : '') +
                (isDone ? '<span class="badge success">Готово</span>' : '') +
            '</div>' +
        '</div>';
    };

    renderWorksPanel = function (stages, items) {
        var projectId = state.selectedProject ? state.selectedProject.id : null;
        var stageMap = buildStageLookup(stages || []);
        var workStages = (stages || []).filter(function (stage) {
            return String(stage.stage_kind || '') !== 'section';
        });
        var estimateWorks = (items || []).filter(function (item) {
            return String(item.itemKind || '').toLowerCase() === 'work';
        });
        if (!workStages.length && !estimateWorks.length) {
            return '<p class="muted">Работы по смете пока не загружены.</p>';
        }

        var groups = {};
        var order = [];

        workStages.forEach(function (stage) {
            var sectionTitle = rootSectionTitleForStage(stage, stageMap);
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            groups[sectionTitle].stageRows.push(stage);
        });

        estimateWorks.forEach(function (item) {
            var sectionTitle = String(item.sectionTitle || item.stageTitle || '').trim() || 'Без раздела';
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            groups[sectionTitle].estimateRows.push(item);
        });

        var doneEstimateWorks = projectId ? estimateWorks.filter(function (item) {
            var sectionTitle = String(item.sectionTitle || item.stageTitle || '').trim() || 'Без раздела';
            return isScheduleWorkDone(projectId, sectionTitle, item);
        }).length : 0;

        return '<div class="execution-summary">' +
            stat('Разделов', String(order.length)) +
            stat('Работ', String(estimateWorks.length || workStages.length)) +
            stat('Готово', String(doneEstimateWorks)) +
            stat('Осталось', String(Math.max(0, estimateWorks.length - doneEstimateWorks)), estimateWorks.length - doneEstimateWorks ? 'warn' : '') +
        '</div><div class="estimate-section-list">' + order.map(function (title, index) {
            var group = groups[title];
            var totalEstimateRows = group.estimateRows.length;
            var doneRows = projectId ? group.estimateRows.filter(function (item) {
                return isScheduleWorkDone(projectId, title, item);
            }).length : 0;
            return '<section class="estimate-section">' +
                '<div class="card-head estimate-section-head"><div class="estimate-section-title"><h3>' + escapeHtml(materialSectionLabel(index)) + '</h3><span class="badge estimate-section-count">' + escapeHtml(String(group.stageRows.length + totalEstimateRows)) + ' поз.</span>' + (totalEstimateRows ? '<span class="badge">' + escapeHtml(String(doneRows) + '/' + String(totalEstimateRows) + ' работ') + '</span>' : '') + '</div><small>' + escapeHtml(title) + '</small></div>' +
                '<div class="materials-list">' +
                    group.stageRows.map(function (stage) {
                        var meta = [
                            stagePathLabel(stage, stageMap),
                            stage.planned_start && stage.planned_end ? (stage.planned_start + ' — ' + stage.planned_end) : '',
                            stage.responsible || ''
                        ].filter(Boolean).join(' • ');
                        return '<div class="material-row work-row">' +
                            '<div><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta || 'Работа') + '</small></div>' +
                            '<div class="material-chain-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' • ' + percent(stage.progress) + '%</span></div>' +
                        '</div>';
                    }).join('') +
                    group.estimateRows.map(function (item) {
                        return renderEstimateWorkItem(item, title, projectId);
                    }).join('') +
                '</div>' +
            '</section>';
        }).join('') + '</div>';
    };

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

    renderSectionScheduleRow = function (project, section, index) {
        var items = Array.isArray(section.items) ? section.items : [];
        var progress = scheduleSectionProgress(project.id, section);
        var isOpen = isScheduleSectionOpen(project.id, section, false);
        var digest = finalSectionWorkDigest(section);
        var deadlineState = scheduleDeadlineState(section.startDate, section.endDate, progress.percent, section.estimatedDays);
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + (progress.percent >= 100 && progress.total ? ' is-done' : '') + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-title">' +
                    '<div><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small></div>' +
                    '<div class="project-badges"><span class="badge">' + escapeHtml(String(progress.total || section.workItems || 0) + ' работ') + '</span><span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span>' + scheduleDeadlineBadge(deadlineState) + (progress.total ? '<span class="badge">' + escapeHtml(String(progress.done) + '/' + String(progress.total) + ' готово') + '</span>' : '') + '</div>' +
                '</div>' +
                '<button class="section-schedule-toggle" type="button" data-section-schedule-toggle data-project-id="' + project.id + '" data-section-key="' + escapeHtml(scheduleSectionKey(section)) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' + (isOpen ? 'Свернуть раздел' : 'Открыть работы') + '</button>' +
                '<div class="section-schedule-progress">' +
                    '<div class="section-schedule-progress-bar"><span style="width:' + progress.percent + '%"></span></div>' +
                    '<div class="section-schedule-progress-meta"><strong>' + escapeHtml(String(progress.percent)) + '%</strong><span>' + escapeHtml(String(progress.done) + '/' + String(progress.total || 0) + ' работ') + '</span></div>' +
                '</div>' +
                '<div class="section-schedule-track">' +
                    '<div class="schedule-gantt-track">' +
                        '<span class="schedule-gantt-today" style="left:' + scheduleTodayPercent(range) + '%"></span>' +
                        (planStyle ? '<span class="schedule-gantt-bar schedule-gantt-plan" style="' + planStyle + '"></span>' : '') +
                    '</div>' +
                    '<div class="section-schedule-track-meta' + (deadlineState.kind ? (' is-' + deadlineState.kind) : '') + '"><span>Плановый интервал</span><strong>' + escapeHtml(deadlineState.label) + '</strong></div>' +
                '</div>' +
                '<div class="section-schedule-meta"><strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong><span>' + escapeHtml(digest.volume || 'Объемы будут считаться по работам раздела') + '</span></div>' +
                (digest.titles ? '<div class="section-schedule-caption">' + escapeHtml(digest.titles) + '</div>' : '') +
                (isOpen ? '<div class="section-schedule-details">' + items.map(function (item) {
                    var workDone = isScheduleWorkDone(project.id, section.title, item);
                    return '<label class="section-work-check' + (workDone ? ' is-done' : '') + '">' +
                        '<input type="checkbox" data-section-work-check data-project-id="' + project.id + '" data-section-title="' + escapeHtml(section.title) + '" data-work-title="' + escapeHtml(item.title) + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (workDone ? ' checked' : '') + '>' +
                        '<span class="section-work-check-copy"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(formatWorkLine(item) || 'Объем не указан') + '</small></span>' +
                    '</label>';
                }).join('') + (items.length ? '' : '<div class="section-schedule-empty inline">В этом разделе пока нет работ для отметки.</div>') + '</div>' : '') +
            '</div>' +
        '</article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">Собираем расчет по смете...</div></section>';
        if (summary.error) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div></section>';
        var range = { start: summary.startDate, end: summary.finishDate, totalDays: Math.max(1, Number(summary.totalDays || 1)) };
        var deadline = String(project.deadline_at || project.deadline || summary.finishDate || '').trim();
        var daysLeft = deadline ? daysBetween(APP_TODAY, deadline) : null;
        var overallProgress = projectScheduleProgress(project, summary);
        var projectDeadlineState = scheduleDeadlineState(summary.startDate, deadline || summary.finishDate, overallProgress.percent, summary.totalDays);
        return '<section class="card section-schedule-board">' +
            '<div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Последовательность разделов и контроль по факту выполнения работ.</span></div><button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button></div>' +
            '<div class="execution-summary">' +
                stat('Старт', finalGraphDate(summary.startDate)) +
                stat('Дедлайн', finalGraphDate(deadline || summary.finishDate)) +
                stat('До дедлайна', daysLeft == null ? '—' : String(daysLeft), projectDeadlineState.kind) +
                stat('Разделов', String(sections.length)) +
                stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) +
            '</div>' +
            '<div class="section-schedule-brief-list">' + sections.map(function (section) { return renderSectionScheduleBrief(section); }).join('') + '</div>' +
            renderScheduleScale(range) +
            '<div class="section-schedule-list">' + sections.map(function (section, index) { return renderSectionScheduleRow(project, section, range, index); }).join('') + '</div>' +
        '</section>';
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
                    sectionTitle: section.title,
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
                sectionTitle: String(item.sectionTitle || item.stageTitle || '').trim() || '\u0411\u0435\u0437 \u0440\u0430\u0437\u0434\u0435\u043b\u0430',
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
                if (!workMatchesMap[key] || result.score > workMatchesMap[key].score || (result.done && !workMatchesMap[key].done)) {
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
            var planned = Number(entry.item.plannedQty || 0);
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
                return entry.item.title + ' ' + finalSectionSummaryNumber(entry.purchasedQty) + ' ' + (entry.item.unit || '');
            }).join(', ') + '.');
        }
        if (usedMaterials.length) {
            generatedParts.push('\u0412 \u0440\u0430\u0431\u043e\u0442\u0443/\u043c\u043e\u043d\u0442\u0430\u0436 \u043f\u0435\u0440\u0435\u0434\u0430\u043d\u044b: ' + usedMaterials.map(function (entry) {
                return entry.item.title + ' ' + finalSectionSummaryNumber(entry.usedQty) + ' ' + (entry.item.unit || '');
            }).join(', ') + '.');
        }

        return {
            text: generatedParts.join(' ') || String(payload && (payload.work_done || payload.raw_input) || '').trim(),
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
                if (entry.done) works[scheduleWorkKey(entry.sectionTitle, entry.item)] = 1;
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
        if (materialsPanel) materialsPanel.innerHTML = renderProjectMaterialsTab(project, materials, insights);
        if (overviewMaterials) overviewMaterials.innerHTML = renderMaterials(materials, project.id, insights);
        if (worksPanel) worksPanel.innerHTML = renderProjectWorksTab(project, state.stagesByProject[projectId] || [], materials);
        if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[projectId] || [], project);
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

    var baseRenderMaterials = renderMaterials;
    renderMaterials = function (items, projectId, insights) {
        var effectiveItems = (items || []).map(function (item) {
            return effectiveMaterialFromReports(projectId, item);
        });
        return baseRenderMaterials(effectiveItems, projectId, insights);
    };

    var baseMaterialRow = materialRow;
    materialRow = function (item, projectId, insight) {
        var effectiveItem = effectiveMaterialFromReports(projectId, item);
        var html = baseMaterialRow(effectiveItem, projectId, insight);
        if (effectiveItem.reportApplied && Number(effectiveItem.purchasedQty || 0) >= Number(effectiveItem.plannedQty || 0)) {
            html = html.replace('material-row material-row-linked', 'material-row material-row-linked material-row-done');
            html = html.replace('</small></div>', '<br><span class="material-report-mark">\u0417\u0430\u043a\u0440\u044b\u0442\u043e \u043f\u043e \u043e\u0442\u0447\u0435\u0442\u0430\u043c</span></small></div>');
        }
        return html;
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

    var baseBindLogForm = bindLogForm;
    bindLogForm = function () {
        baseBindLogForm();
        bindReportPreview();
    };

    renderProjectOverviewActions = function (project) {
        var actions = [
            '<button class="ghost" type="button" data-project-tab-target="materials">Материалы</button>',
            '<button class="ghost" type="button" data-project-tab-target="works">Работы</button>',
            '<button class="ghost" type="button" data-project-tab-target="schedule">График работ</button>',
            '<button class="ghost" type="button" data-project-tab-target="reports">Отчеты</button>',
            '<button class="ghost" type="button" data-project-tab-target="tasks">Задачи</button>',
            '<button class="ghost" type="button" data-project-tab-target="documents">Документы</button>',
            '<button class="ghost" type="button" data-project-tab-target="chat">Чат</button>',
            '<a href="/app/logs">Журнал работ</a>'
        ];
        if (canSeeFinances()) actions.splice(5, 0, '<button class="ghost" type="button" data-project-tab-target="finance">Финансы</button>');
        if (project && project.id) actions[actions.length - 1] = '<a href="/app/logs?projectId=' + project.id + '">Журнал работ</a>';
        return '<div class="object-actions">' + actions.join('') + '</div>';
    };

    ensureProjectWorksTab = function () {
        var tabsRoot = qs('[data-project-detail] .tabs');
        if (tabsRoot && !qs('[data-tab="works"]', tabsRoot)) {
            var materialsTab = qs('[data-tab="materials"]', tabsRoot);
            if (materialsTab) materialsTab.insertAdjacentHTML('afterend', '<button class="tab" data-tab="works">Работы</button>');
        }
        var detail = qs('[data-project-detail]');
        if (detail && !qs('[data-panel="works"]', detail)) {
            var materialsPanel = qs('[data-panel="materials"]', detail);
            if (materialsPanel) materialsPanel.insertAdjacentHTML('afterend', '<div class="tab-panel" data-panel="works"></div>');
        }
    };

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
                '<div class="project-overview-badges">' +
                    '<span class="badge">' + escapeHtml(status) + '</span>' +
                    '<span class="badge success">Готовность ' + percent(project.progress) + '%</span>' +
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
            '<div><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(subtitle) + '</p></div>' +
            '<div class="segmented compact" data-market-switcher>' +
                '<button type="button" class="' + (mode === 'list' ? 'active' : '') + '" data-market-mode="list" data-market-tab="' + tab + '">Список</button>' +
                '<button type="button" class="' + (mode === 'market' ? 'active' : '') + '" data-market-mode="market" data-market-tab="' + tab + '">Анализ рынка</button>' +
            '</div>' +
        '</div>';
    };

    renderProjectMaterialsTab = function (project, items, insights) {
        var header = renderProjectTabViewSwitcher(project.id, 'materials', 'Материалы', 'Позиции сметы, фактические количества и подбор поставщиков.');
        if (getProjectTabMode(project.id, 'materials') === 'market') return header + renderProjectMarketBlock(project.id, 'material');
        return header + renderMaterials(items, project.id, insights);
    };

    renderProjectWorksTab = function (project, stages, items) {
        var header = renderProjectTabViewSwitcher(project.id, 'works', 'Работы', 'Работы из сметы, объемы и отметка выполнения по графику.');
        if (getProjectTabMode(project.id, 'works') === 'market') return header + renderProjectMarketBlock(project.id, 'work');
        return header + renderWorksPanel(stages, items);
    };

    openProject = function (projectId) {
        var root = qs('[data-project-detail]');
        if (!root) return;
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;

        try {
            var params = new URLSearchParams(location.search);
            params.set('openProject', String(projectId));
            history.replaceState(null, '', location.pathname + '?' + params.toString());
        } catch (historyError) {}

        function panel(name) {
            return qs('[data-panel="' + name + '"]');
        }

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
        var titleNode = qs('[data-detail-title]');

        if (titleNode) titleNode.textContent = project.title || 'Карточка объекта';
        if (overviewPanel) {
            overviewPanel.innerHTML =
                renderProjectOverviewHero(project) +
                renderProjectOverviewActions(project) +
                '<section class="subsection"><div class="card-head"><h3>Назначения на объект</h3></div><div data-project-assignments>Загрузка назначений...</div></section>' +
                '<section class="subsection"><div class="card-head"><h3>Материалы по смете</h3></div><div data-project-overview-materials><p class="muted">Загрузка материалов...</p></div></section>';
        }
        if (materialsPanel) materialsPanel.innerHTML = '<p class="muted">Загрузка материалов...</p>';
        if (worksPanel) worksPanel.innerHTML = '<p class="muted">Загрузка работ...</p>';
        if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
        if (reportsPanel) reportsPanel.innerHTML = '<p class="muted">Загрузка отчетов...</p>';
        if (tasksPanel) tasksPanel.innerHTML = '<p class="muted">Загрузка задач...</p>';
        if (financePanel) financePanel.innerHTML = canSeeFinances() ? '<p class="muted">Загрузка финансов...</p>' : '';
        if (documentsPanel) documentsPanel.innerHTML = '<p class="muted">Загрузка документов...</p>';
        if (chatPanel) chatPanel.innerHTML = '<p class="muted">Загрузка чата...</p>';
        if (aiPanel) aiPanel.innerHTML = '<p class="muted">Загрузка анализа...</p>';

        bindProjectOverviewActions();
        activateProjectTab('overview');

        loadMaterials(project.id, function (items) {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            if (materialsPanel) materialsPanel.innerHTML = renderProjectMaterialsTab(project, items, state.materialInsightsByProject[project.id] || null);
            var overviewMaterials = qs('[data-project-overview-materials]');
            if (overviewMaterials) overviewMaterials.innerHTML = renderMaterials(items, project.id, state.materialInsightsByProject[project.id] || null);
            if (worksPanel) worksPanel.innerHTML = renderProjectWorksTab(project, state.stagesByProject[project.id] || [], items);
            bindProjectMarketToggles(project.id);
        });

        loadMaterialInsights(project.id, function (insights) {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            if (materialsPanel && state.materialsByProject[project.id]) {
                materialsPanel.innerHTML = renderProjectMaterialsTab(project, state.materialsByProject[project.id] || [], insights || {});
            }
            var overviewMaterials = qs('[data-project-overview-materials]');
            if (overviewMaterials && state.materialsByProject[project.id]) {
                overviewMaterials.innerHTML = renderMaterials(state.materialsByProject[project.id] || [], project.id, insights || {});
            }
            bindProjectMarketToggles(project.id);
            bindProjectChainActions();
        });

        loadSectionScheduleForecast(project.id, project.started_at || APP_TODAY, function () {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
        });

        loadProjectNotifications(project.id, function () {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(state.stagesByProject[project.id] || [], project);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
        });

        loadAnalysis(project.id, function (analysis) {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            if (aiPanel) aiPanel.innerHTML = renderBackendAnalysis(analysis);
        });

        loadStages(project.id, function (stages) {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(project.id)) return;
            if (schedulePanel) schedulePanel.innerHTML = renderSchedulePanel(stages, project);
            if (worksPanel) worksPanel.innerHTML = renderProjectWorksTab(project, stages, state.materialsByProject[project.id] || []);
            bindStageCreateForm(project.id);
            bindStageEditors(project.id);
            bindAutoScheduleForm(project.id);
            bindScheduleStatusActions(project.id);
            bindSectionScheduleRefresh(project.id);
            loadExecutionInsights(project.id, stages);
        });

        refreshProjectReportsTab(project.id);
        loadTasks(project.id);
        if (canSeeFinances()) loadProjectFinances(project.id);
        loadDocuments(project.id);
        loadProjectChats(project.id);
        loadProjectAssignments(project.id);
        bindProjectChainActions();
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
                '<div data-logs-list></div>' +
            '</section>' +
            (canCreateProjectReport() ? '<section class="subsection report-intake-card" data-project-report-create-card hidden>' + renderProjectReportForm(project).replace('<section class="subsection report-intake-card">', '').replace(/<\/section>$/, '') + '</section>' : '') +
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
        var visible = logs.filter(function (log) { return Number(log.is_client_visible) === 1; }).length;
        var internal = logs.length - visible;
        var workers = logs.reduce(function (sum, log) { return sum + Number(log.workers_count || 0); }, 0);
        var blockers = logs.filter(function (log) { return String(log.blockers || '').trim(); }).length;
        var latestProgress = logs.reduce(function (max, log) {
            var value = Number(log.progress_percent);
            return Number.isFinite(value) ? Math.max(max, value) : max;
        }, -1);
        root.innerHTML =
            stat('Отчетов', logs.length) +
            stat('Видно заказчику', visible) +
            stat('Внутренние', internal) +
            stat('Людей в отчетах', workers) +
            stat('С блокерами', blockers, blockers ? 'danger' : '') +
            stat('Прогресс по журналу', latestProgress >= 0 ? (Math.round(latestProgress) + '%') : '—', latestProgress >= 0 ? '' : 'warn') +
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

    renderLogsList = function (project, logs) {
        var root = qs('[data-logs-list]');
        if (!root) return;
        if (!logs.length) {
            root.innerHTML = '<p class="muted">По объекту "' + escapeHtml(project.title) + '" пока нет сохраненных отчетов.</p>';
            return;
        }
        root.innerHTML = logs.map(function (log) {
            return '<article class="log-card">' +
                '<div class="log-top">' +
                    '<div><span>' + escapeHtml(log.report_date || 'Без даты') + '</span><h4>' + escapeHtml(log.title) + '</h4></div>' +
                    '<div class="log-top-side"><div class="project-badges">' +
                        (log.progress_percent != null && log.progress_percent !== '' ? '<span class="badge success">' + escapeHtml(Math.round(Number(log.progress_percent) || 0)) + '%</span>' : '') +
                        '<span class="badge">' + escapeHtml(log.workers_count || 0) + ' чел.</span>' +
                        '<span class="badge ' + (Number(log.is_client_visible) === 1 ? '' : 'warn') + '">' + (Number(log.is_client_visible) === 1 ? 'Заказчику' : 'Внутренний') + '</span>' +
                    '</div>' + renderProjectReportDeleteButton(project.id, log, true) + '</div>' +
                '</div>' +
                '<p>' + escapeHtml(log.work_done) + '</p>' +
                '<div class="log-details">' +
                    (log.equipment ? '<div><span>Техника / поставки</span><strong>' + escapeHtml(log.equipment) + '</strong></div>' : '') +
                    (log.blockers ? '<div class="log-risk"><span>Блокеры</span><strong>' + escapeHtml(log.blockers) + '</strong></div>' : '') +
                    (log.next_steps ? '<div><span>Следующий шаг</span><strong>' + escapeHtml(log.next_steps) + '</strong></div>' : '') +
                '</div>' +
                (log.raw_input ? '<small class="muted">Исходный ввод: ' + escapeHtml(log.raw_input) + '</small>' : '') +
                '<small class="muted">Автор: ' + escapeHtml(log.author_name || 'Без автора') + '</small>' +
            '</article>';
        }).join('');
        bindProjectReportDeleteActions();
    };

    finalSectionWorkDigest = function (section) {
        var items = Array.isArray(section.items) ? section.items : [];
        var workCount = Number(section.workItems || items.length || 0);
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

    renderSectionScheduleRow = function (project, section, index) {
        var items = Array.isArray(section.items) ? section.items : [];
        var progress = scheduleSectionProgress(project.id, section);
        var isOpen = isScheduleSectionOpen(project.id, section, false);
        var digest = finalSectionWorkDigest(section);
        var deadlineState = scheduleDeadlineState(section.startDate, section.endDate, progress.percent, section.estimatedDays);
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + (progress.percent >= 100 && progress.total ? ' is-done' : '') + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-title"><div><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small></div>' +
                '<div class="project-badges"><span class="badge">' + escapeHtml(String(progress.total || section.workItems || 0) + ' работ') + '</span><span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span>' + scheduleDeadlineBadge(deadlineState) + (progress.total ? '<span class="badge">' + escapeHtml(String(progress.done) + '/' + String(progress.total) + ' готово') + '</span>' : '') + '</div></div>' +
                '<button class="section-schedule-toggle" type="button" data-section-schedule-toggle data-project-id="' + project.id + '" data-section-key="' + escapeHtml(scheduleSectionKey(section)) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' + (isOpen ? 'Свернуть раздел' : 'Открыть работы') + '</button>' +
                '<div class="section-schedule-progress"><div class="section-schedule-progress-bar"><span style="width:' + progress.percent + '%"></span></div><div class="section-schedule-progress-meta"><strong>' + escapeHtml(String(progress.percent)) + '%</strong><span>' + escapeHtml(String(progress.done) + '/' + String(progress.total || 0) + ' работ') + '</span></div></div>' +
                '<div class="section-schedule-track"><div class="schedule-gantt-track"><span class="schedule-gantt-today" style="left:' + scheduleTodayPercent(range) + '%"></span>' + (planStyle ? '<span class="schedule-gantt-bar schedule-gantt-plan" style="' + planStyle + '"></span>' : '') + '</div><div class="section-schedule-track-meta' + (deadlineState.kind ? (' is-' + deadlineState.kind) : '') + '"><span>Плановый интервал</span><strong>' + escapeHtml(deadlineState.label) + '</strong></div></div>' +
                '<div class="section-schedule-meta"><strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong><span>' + escapeHtml(digest.volume || 'Объемы будут считаться по работам раздела') + '</span></div>' +
                (digest.titles ? '<div class="section-schedule-caption">' + escapeHtml(digest.titles) + '</div>' : '') +
                (isOpen ? '<div class="section-schedule-details">' + items.map(function (item) {
                    var workDone = isScheduleWorkDone(project.id, section.title, item);
                    return '<label class="section-work-check' + (workDone ? ' is-done' : '') + '"><input type="checkbox" data-section-work-check data-project-id="' + project.id + '" data-section-title="' + escapeHtml(section.title) + '" data-work-title="' + escapeHtml(item.title) + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (workDone ? ' checked' : '') + '><span class="section-work-check-copy"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(formatWorkLine(item) || 'Объем не указан') + '</small></span></label>';
                }).join('') + (items.length ? '' : '<div class="section-schedule-empty inline">В этом разделе пока нет работ для отметки.</div>') + '</div>' : '') +
            '</div></article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">Собираем расчет по смете...</div></section>';
        if (summary.error) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div></section>';
        var range = { start: summary.startDate, end: summary.finishDate, totalDays: Math.max(1, Number(summary.totalDays || 1)) };
        var deadline = String(project.deadline_at || project.deadline || summary.finishDate || '').trim();
        var daysLeft = deadline ? daysBetween(APP_TODAY, deadline) : null;
        var overallProgress = projectScheduleProgress(project, summary);
        var projectDeadlineState = scheduleDeadlineState(summary.startDate, deadline || summary.finishDate, overallProgress.percent, summary.totalDays);
        return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Последовательность разделов и контроль по факту выполнения работ.</span></div><button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button></div>' +
            '<div class="execution-summary">' + stat('Старт', finalGraphDate(summary.startDate)) + stat('Дедлайн', finalGraphDate(deadline || summary.finishDate)) + stat('До дедлайна', daysLeft == null ? '—' : String(daysLeft), projectDeadlineState.kind) + stat('Разделов', String(sections.length)) + stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) + '</div>' +
            '<div class="section-schedule-brief-list">' + sections.map(function (section) { return renderSectionScheduleBrief(section); }).join('') + '</div>' + renderScheduleScale(range) + '<div class="section-schedule-list">' + sections.map(function (section, index) { return renderSectionScheduleRow(project, section, range, index); }).join('') + '</div></section>';
    };

    materialRow = function (item, projectId, insight) {
        var effectiveItem = effectiveMaterialFromReports(projectId, item);
        var missing = Number(effectiveItem.missingQty) || 0;
        var stock = Number(effectiveItem.stockQty) || 0;
        var planned = Number(effectiveItem.plannedQty) || 0;
        var unitLabel = String(effectiveItem.unit || '').trim() || 'ед.';
        var meta = [
            'По смете: ' + finalSectionSummaryNumber(effectiveItem.plannedQty) + ' ' + unitLabel,
            'куплено: ' + finalSectionSummaryNumber(effectiveItem.purchasedQty),
            'использовано: ' + finalSectionSummaryNumber(effectiveItem.usedQty),
            'остаток: ' + finalSectionSummaryNumber(effectiveItem.stockQty),
            effectiveItem.needByDate ? ('нужно к ' + effectiveItem.needByDate) : '',
            effectiveItem.stageTitle ? ('этап: ' + effectiveItem.stageTitle) : ''
        ].filter(Boolean).join(' • ');
        var supplyNote = '';
        if (insight) {
            supplyNote = insight.selectedName
                ? 'Выбран поставщик: ' + insight.selectedName
                : insight.quoted
                    ? 'Просчитано предложений: ' + insight.quoted
                    : insight.called
                        ? 'Уже в обзвоне: ' + insight.called
                        : 'В работе поставщиков: ' + insight.total;
        } else if (canManageSuppliers()) {
            supplyNote = 'Поставщик по этой позиции еще не выбран.';
        }
        var statusLabel = finalSectionSummaryNumber(stock) + '/' + finalSectionSummaryNumber(planned) + ' ' + unitLabel;
        return '<div class="material-row material-row-linked' + (effectiveItem.reportApplied && Number(effectiveItem.purchasedQty || 0) >= Number(effectiveItem.plannedQty || 0) ? ' material-row-done' : '') + '">' +
            '<div><b>' + escapeHtml(effectiveItem.title) + '</b><small>' + escapeHtml(meta) + (supplyNote ? '<br>' + escapeHtml(supplyNote) : '') + (effectiveItem.reportApplied && Number(effectiveItem.purchasedQty || 0) >= Number(effectiveItem.plannedQty || 0) ? '<br><span class="material-report-mark">Закрыто по отчетам</span>' : '') + '</small></div>' +
            '<div class="material-chain-side"><span class="badge ' + planningStatusClass(effectiveItem.supplyStatus || (missing > 0 ? 'required' : 'in_stock')) + '">' + escapeHtml(statusLabel) + '</span><div class="material-chain-actions">' + renderMaterialSupplierPicker(projectId, effectiveItem, insight) + '</div></div>' +
        '</div>';
    };

    renderEstimateWorkItem = function (item, sectionTitle, projectId) {
        var isDone = projectId ? isScheduleWorkDone(projectId, sectionTitle, item) : false;
        var plannedQty = item.plannedQty != null ? item.plannedQty : item.planned_qty;
        var meta = [
            item.unit ? ('Ед.: ' + item.unit) : '',
            plannedQty != null && plannedQty !== '' ? ('Объем: ' + formattedWorkQty(plannedQty)) : '',
            item.stageTitle ? ('Этап: ' + item.stageTitle) : ''
        ].filter(Boolean).join(' • ');
        var hours = Number(item.estimated_hours || item.estimatedHours || 0);
        return '<div class="material-row work-row' + (isDone ? ' work-row-done' : '') + '">' +
            '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(meta || 'Работа из сметы') + (item.notes ? '<br>' + escapeHtml(item.notes) : '') + '</small></div>' +
            '<div class="work-row-side"><span class="badge work-amount-badge">' + escapeHtml(formattedWorkQty(plannedQty || 0) + ' ' + (item.unit || 'ед.')) + '</span>' +
            (hours > 0 ? '<span class="badge work-hours-badge">' + escapeHtml((Math.round(hours * 10) / 10).toString().replace('.', ',') + ' чел.-ч') + '</span>' : '') +
            (isDone ? '<span class="badge success">Готово</span>' : '') + '</div></div>';
    };

    renderWorksPanel = function (stages, items) {
        var projectId = state.selectedProject ? state.selectedProject.id : null;
        var stageMap = buildStageLookup(stages || []);
        var workStages = (stages || []).filter(function (stage) {
            return String(stage.stage_kind || '') !== 'section';
        });
        var estimateWorks = (items || []).filter(function (item) {
            return String(item.itemKind || '').toLowerCase() === 'work';
        });
        if (!workStages.length && !estimateWorks.length) return '<p class="muted">Работы по смете пока не загружены.</p>';
        var groups = {};
        var order = [];
        workStages.forEach(function (stage) {
            var sectionTitle = rootSectionTitleForStage(stage, stageMap);
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            groups[sectionTitle].stageRows.push(stage);
        });
        estimateWorks.forEach(function (item) {
            var sectionTitle = String(item.sectionTitle || item.stageTitle || '').trim() || 'Без раздела';
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            groups[sectionTitle].estimateRows.push(item);
        });
        var doneEstimateWorks = projectId ? estimateWorks.filter(function (item) {
            var sectionTitle = String(item.sectionTitle || item.stageTitle || '').trim() || 'Без раздела';
            return isScheduleWorkDone(projectId, sectionTitle, item);
        }).length : 0;
        return '<div class="execution-summary">' +
            stat('Разделов', String(order.length)) +
            stat('Работ', String(estimateWorks.length || workStages.length)) +
            stat('Готово', String(doneEstimateWorks)) +
            stat('Осталось', String(Math.max(0, estimateWorks.length - doneEstimateWorks)), estimateWorks.length - doneEstimateWorks ? 'warn' : '') +
        '</div><div class="estimate-section-list">' + order.map(function (title, index) {
            var group = groups[title];
            var totalEstimateRows = group.estimateRows.length;
            var doneRows = projectId ? group.estimateRows.filter(function (item) {
                return isScheduleWorkDone(projectId, title, item);
            }).length : 0;
            return '<section class="estimate-section"><div class="card-head estimate-section-head"><div class="estimate-section-title"><h3>' + escapeHtml(materialSectionLabel(index)) + '</h3><span class="badge estimate-section-count">' + escapeHtml(String(group.stageRows.length + totalEstimateRows)) + ' поз.</span>' + (totalEstimateRows ? '<span class="badge">' + escapeHtml(String(doneRows) + '/' + String(totalEstimateRows) + ' работ') + '</span>' : '') + '</div><small>' + escapeHtml(title) + '</small></div><div class="materials-list">' +
                group.stageRows.map(function (stage) {
                    var meta = [
                        stagePathLabel(stage, stageMap),
                        stage.planned_start && stage.planned_end ? (stage.planned_start + ' — ' + stage.planned_end) : '',
                        stage.responsible || ''
                    ].filter(Boolean).join(' • ');
                    return '<div class="material-row work-row"><div><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta || 'Работа') + '</small></div><div class="material-chain-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' • ' + percent(stage.progress) + '%</span></div></div>';
                }).join('') +
                group.estimateRows.map(function (item) { return renderEstimateWorkItem(item, title, projectId); }).join('') +
            '</div></section>';
        }).join('') + '</div>';
    };

    renderSectionScheduleRow = function (project, section) {
        var items = Array.isArray(section.items) ? section.items : [];
        var progress = scheduleSectionProgress(project.id, section);
        var isOpen = isScheduleSectionOpen(project.id, section, false);
        var digest = finalSectionWorkDigest(section);
        var deadlineState = scheduleDeadlineState(section.startDate, section.endDate, progress.percent, section.estimatedDays);
        return '<article class="section-schedule-card' + finalSectionScheduleCardClass(section) + (progress.percent >= 100 && progress.total ? ' is-done' : '') + '">' +
            '<div class="section-schedule-main">' +
                '<div class="section-schedule-summary" role="button" tabindex="0" data-section-schedule-toggle data-project-id="' + project.id + '" data-section-key="' + escapeHtml(scheduleSectionKey(section)) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
                    '<div class="section-schedule-summary-head">' +
                        '<div class="section-schedule-summary-copy">' +
                            '<div class="section-schedule-heading">' +
                                '<span class="section-schedule-label">Раздел</span>' +
                                '<div class="section-schedule-title"><h4>' + escapeHtml(section.title) + '</h4><small>' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</small></div>' +
                            '</div>' +
                            '<div class="project-badges"><span class="badge">' + escapeHtml(String(progress.total || section.workItems || 0) + ' работ') + '</span><span class="badge">' + escapeHtml(String(section.crewSize || 0) + ' чел.') + '</span>' + scheduleDeadlineBadge(deadlineState) + (progress.total ? '<span class="badge">' + escapeHtml(String(progress.done) + '/' + String(progress.total) + ' готово') + '</span>' : '') + '</div>' +
                        '</div>' +
                        '<span class="section-schedule-chevron" aria-hidden="true">' + (isOpen ? '-' : '+') + '</span>' +
                    '</div>' +
                    '<div class="section-schedule-progress"><div class="section-schedule-progress-bar"><span style="width:' + progress.percent + '%"></span></div><div class="section-schedule-progress-meta"><strong>' + escapeHtml(String(progress.percent)) + '%</strong><span>' + escapeHtml(progress.total ? (String(progress.done) + ' из ' + String(progress.total) + ' работ выполнено') : 'Работы появятся после загрузки сметы') + '</span></div></div>' +
                    '<div class="section-schedule-meta"><strong>' + escapeHtml(String(section.bufferedHours || section.estimatedHours || 0) + ' чел.-ч') + '</strong><span>' + escapeHtml(digest.volume || deadlineState.label) + '</span></div>' +
                    (digest.titles ? '<div class="section-schedule-caption">' + escapeHtml(digest.titles) + '</div>' : '') +
                '</div>' +
                (isOpen ? '<div class="section-schedule-details">' + items.map(function (item) {
                    var workDone = isScheduleWorkDone(project.id, section.title, item);
                    return '<label class="section-work-check' + (workDone ? ' is-done' : '') + '"><input type="checkbox" data-section-work-check data-project-id="' + project.id + '" data-section-title="' + escapeHtml(section.title) + '" data-work-title="' + escapeHtml(item.title) + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (workDone ? ' checked' : '') + '><span class="section-work-check-copy"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(formatWorkLine(item) || 'Объем не указан') + '</small></span></label>';
                }).join('') + (items.length ? '' : '<div class="section-schedule-empty inline">В этом разделе пока нет работ для отметки.</div>') + '</div>' : '') +
            '</div></article>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">Собираем расчет по смете...</div></section>';
        if (summary.error) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div></section>';
        var deadline = String(project.deadline_at || project.deadline || summary.finishDate || '').trim();
        var daysLeft = deadline ? daysBetween(APP_TODAY, deadline) : null;
        var overallProgress = projectScheduleProgress(project, summary);
        var projectDeadlineState = scheduleDeadlineState(summary.startDate, deadline || summary.finishDate, overallProgress.percent, summary.totalDays);
        return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Фактический прогресс по разделам и отмеченным работам.</span></div><button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button></div>' +
            '<div class="execution-summary">' + stat('Старт', finalGraphDate(summary.startDate)) + stat('Дедлайн', finalGraphDate(deadline || summary.finishDate)) + stat('До дедлайна', daysLeft == null ? '—' : String(daysLeft), projectDeadlineState.kind) + stat('Разделов', String(sections.length)) + stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) + '</div>' +
            '<div class="section-schedule-overview"><div class="section-schedule-overview-head"><strong>Прогресс по разделам</strong><span>' + escapeHtml(overallProgress.total ? (String(overallProgress.done) + ' из ' + String(overallProgress.total) + ' работ отмечено') : 'Отмечайте выполненные работы внутри разделов') + '</span></div><div class="section-schedule-progress"><div class="section-schedule-progress-bar"><span style="width:' + overallProgress.percent + '%"></span></div><div class="section-schedule-progress-meta"><strong>' + escapeHtml(String(overallProgress.percent)) + '%</strong><span>' + escapeHtml(projectDeadlineState.label) + '</span></div></div></div>' +
            '<div class="section-schedule-list">' + sections.map(function (section) { return renderSectionScheduleRow(project, section); }).join('') + '</div></section>';
    };

    renderSectionScheduleForecast = function (project) {
        var summary = project ? state.sectionScheduleByProject[project.id] : null;
        if (!project) return '';
        if (!summary) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">Собираем расчет по смете...</div></section>';
        if (summary.error) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Считаем длительность по рабочим позициям и типовым нормам.</span></div></div><div class="section-schedule-empty">' + escapeHtml(summary.error) + '</div></section>';
        var sections = Array.isArray(summary.sections) ? summary.sections : [];
        if (!sections.length) return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">В смете пока нет рабочих позиций для расчета.</span></div></div></section>';
        var deadline = String(project.deadline_at || project.deadline || summary.finishDate || '').trim();
        var daysLeft = deadline ? daysBetween(APP_TODAY, deadline) : null;
        var overallProgress = projectScheduleProgress(project, summary);
        var projectDeadlineState = scheduleDeadlineState(summary.startDate, deadline || summary.finishDate, overallProgress.percent, summary.totalDays);
        return '<section class="card section-schedule-board"><div class="card-head"><div><h3>График по разделам сметы</h3><span class="muted">Фактический прогресс по разделам и отмеченным работам.</span></div><button class="ghost" type="button" data-section-schedule-refresh data-project-id="' + project.id + '">Пересчитать</button></div>' +
            '<div class="execution-summary">' + stat('Старт', finalGraphDate(summary.startDate)) + stat('Дедлайн', finalGraphDate(deadline || summary.finishDate)) + stat('Осталось дней', daysLeft == null ? '—' : String(daysLeft), projectDeadlineState.kind) + stat('Разделов', String(sections.length)) + stat('Чел.-ч', String(Math.round(Number(summary.totalHours || 0)))) + '</div>' +
            '<div class="section-schedule-overview"><div class="section-schedule-overview-head"><strong>Прогресс по разделам</strong><span>' + escapeHtml(overallProgress.total ? (String(overallProgress.done) + ' из ' + String(overallProgress.total) + ' работ отмечено') : 'Отмечайте выполненные работы внутри разделов') + '</span></div><div class="section-schedule-progress"><div class="section-schedule-progress-bar"><span style="width:' + overallProgress.percent + '%"></span></div><div class="section-schedule-progress-meta"><strong>' + escapeHtml(String(overallProgress.percent)) + '%</strong><span>' + escapeHtml(projectDeadlineState.label) + '</span></div></div></div>' +
            '<div class="section-schedule-list">' + sections.map(function (section) { return renderSectionScheduleRow(project, section); }).join('') + '</div></section>';
    };

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

    function workProgressForRows(projectId, sectionTitle, rows) {
        var workRows = rows || [];
        var done = projectId ? workRows.filter(function (item) {
            return isScheduleWorkDone(projectId, sectionTitle, item);
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

    function sectionProgressStrip(workProgress, materialProgressValue) {
        var total = workProgress.total + materialProgressValue.total;
        var done = workProgress.done + materialProgressValue.done;
        var percentValue = total ? Math.round((done / total) * 100) : 0;
        return '<div class="estimate-section-progress-strip">' +
            '<div class="section-schedule-progress-bar"><span style="width:' + percentValue + '%"></span></div>' +
            '<span>' + escapeHtml(total ? (String(done) + ' \u0438\u0437 ' + String(total) + ' \u0437\u0430\u043a\u0440\u044b\u0442\u043e') : '\u041f\u043e\u0437\u0438\u0446\u0438\u0439 \u043d\u0435\u0442') + '</span>' +
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
        var isDone = projectId ? isScheduleWorkDone(projectId, sectionTitle, item) : false;
        return '<label class="section-work-check work-list-check' + (isDone ? ' is-done' : '') + '">' +
            '<input type="checkbox" data-section-work-check data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(item.unit || '') + '" data-work-qty="' + escapeHtml(String(item.planned_qty != null ? item.planned_qty : item.plannedQty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
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
            '<input type="checkbox" data-section-material-check data-project-id="' + escapeHtml(projectId || '') + '" data-section-title="' + escapeHtml(sectionTitle || '') + '" data-material-id="' + escapeHtml(item.id || '') + '" data-material-title="' + escapeHtml(item.title || '') + '" data-material-unit="' + escapeHtml(item.unit || '') + '" data-material-qty="' + escapeHtml(String(item.plannedQty != null ? item.plannedQty : item.planned_qty || '')) + '"' + (isDone ? ' checked' : '') + '>' +
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

    materialRow = function (item, projectId, insight) {
        var effectiveItem = materialEffectiveForProgress(projectId, item);
        var missing = Number(effectiveItem.missingQty) || 0;
        var stock = Number(effectiveItem.stockQty) || 0;
        var planned = Number(effectiveItem.plannedQty) || 0;
        var unitLabel = String(effectiveItem.unit || '').trim() || '\u0435\u0434.';
        var isDone = isMaterialDone(projectId, item);
        var meta = [
            '\u041f\u043e \u0441\u043c\u0435\u0442\u0435: ' + finalSectionSummaryNumber(effectiveItem.plannedQty) + ' ' + unitLabel,
            '\u043a\u0443\u043f\u043b\u0435\u043d\u043e: ' + finalSectionSummaryNumber(effectiveItem.purchasedQty),
            '\u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u043e: ' + finalSectionSummaryNumber(effectiveItem.usedQty),
            '\u043e\u0441\u0442\u0430\u0442\u043e\u043a: ' + finalSectionSummaryNumber(effectiveItem.stockQty),
            effectiveItem.needByDate ? ('\u043d\u0443\u0436\u043d\u043e \u043a ' + effectiveItem.needByDate) : '',
            effectiveItem.stageTitle ? ('\u044d\u0442\u0430\u043f: ' + effectiveItem.stageTitle) : ''
        ].filter(Boolean).join(' \u2022 ');
        var supplyNote = '';
        if (insight) {
            supplyNote = insight.selectedName
                ? '\u0412\u044b\u0431\u0440\u0430\u043d \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a: ' + insight.selectedName
                : insight.quoted
                    ? '\u041f\u0440\u043e\u0441\u0447\u0438\u0442\u0430\u043d\u043e \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439: ' + insight.quoted
                    : insight.called
                        ? '\u0423\u0436\u0435 \u0432 \u043e\u0431\u0437\u0432\u043e\u043d\u0435: ' + insight.called
                        : '\u0412 \u0440\u0430\u0431\u043e\u0442\u0435 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u0432: ' + insight.total;
        } else if (canManageSuppliers()) {
            supplyNote = '\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a \u043f\u043e \u044d\u0442\u043e\u0439 \u043f\u043e\u0437\u0438\u0446\u0438\u0438 \u0435\u0449\u0435 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d.';
        }
        var completionQty = Math.max(
            stock,
            Number(effectiveItem.purchasedQty || 0),
            Number(effectiveItem.usedQty || 0),
            isDone ? planned : 0
        );
        var completionLabel = planned > 0
            ? (finalSectionSummaryNumber(completionQty) + '/' + finalSectionSummaryNumber(planned) + ' ' + unitLabel)
            : (isDone ? '\u0417\u0430\u043a\u0440\u044b\u0442\u043e' : finalSectionSummaryNumber(stock) + ' ' + unitLabel);
        var closeMark = effectiveItem.manualClosed ? '\u0417\u0430\u043a\u0440\u044b\u0442\u043e \u0432\u0440\u0443\u0447\u043d\u0443\u044e' : (effectiveItem.reportApplied && isDone ? '\u0417\u0430\u043a\u0440\u044b\u0442\u043e \u043f\u043e \u043e\u0442\u0447\u0435\u0442\u0430\u043c' : '');
        return '<div class="material-row material-row-linked' + (isDone ? ' material-row-done' : '') + '">' +
            '<label class="material-row-check" title="' + escapeHtml(isDone ? '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b \u0437\u0430\u043a\u0440\u044b\u0442' : '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b \u0432\u0440\u0443\u0447\u043d\u0443\u044e') + '"><input type="checkbox" data-section-material-check data-project-id="' + escapeHtml(projectId || '') + '" data-material-id="' + escapeHtml(item.id || '') + '" data-material-title="' + escapeHtml(item.title || '') + '" data-material-unit="' + escapeHtml(item.unit || '') + '" data-material-qty="' + escapeHtml(String(item.plannedQty != null ? item.plannedQty : item.planned_qty || '')) + '"' + (isDone ? ' checked' : '') + '><span></span></label>' +
            '<div><b>' + escapeHtml(effectiveItem.title) + '</b><small>' + escapeHtml(meta) + (supplyNote ? '<br>' + escapeHtml(supplyNote) : '') + (closeMark ? '<br><span class="material-report-mark">' + escapeHtml(closeMark) + '</span>' : '') + '</small></div>' +
            '<div class="material-chain-side"><span class="badge material-complete-badge ' + planningStatusClass(effectiveItem.supplyStatus || (missing > 0 ? 'required' : 'in_stock')) + '">' + escapeHtml(completionLabel) + '</span><div class="material-chain-actions">' + renderMaterialSupplierPicker(projectId, effectiveItem, insight) + '</div></div>' +
        '</div>';
    };

    renderGroupedMaterials = function (groups, projectId, insights) {
        insights = insights || {};
        return '<div class="estimate-section-list">' + (groups || []).map(function (group, index) {
            var originalTitle = String(group.title || '').trim();
            var progress = materialProgress(projectId, group.items || []);
            return '<section class="estimate-section">' +
                '<div class="card-head estimate-section-head"><div class="estimate-section-title"><h3>' + escapeHtml(materialSectionLabel(index)) + '</h3>' + sectionProgressBadge('materials', progress, '') + '</div>' + (originalTitle ? '<small>' + escapeHtml(originalTitle) + '</small>' : '') + '</div>' +
                sectionProgressStrip({ total: 0, done: 0 }, progress) +
                '<div class="materials-list">' + group.items.map(function (item) {
                    return materialRow(item, projectId, insights[Number(item.id)] || null);
                }).join('') + '</div>' +
            '</section>';
        }).join('') + '</div>';
    };

    renderMaterials = function (items, projectId, insights) {
        var materials = (items || []).filter(function (item) {
            return String(item.itemKind || 'material').toLowerCase() !== 'work';
        });
        if (!materials.length) return '<p class="muted">\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u043f\u043e \u0441\u043c\u0435\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b.</p>';
        var effectiveMaterials = materials.map(function (item) {
            return materialEffectiveForProgress(projectId, item);
        });
        var required = effectiveMaterials.filter(function (item) { return item.supplyStatus === 'required'; }).length;
        var soon = effectiveMaterials.filter(function (item) { return item.supplyStatus === 'soon'; }).length;
        var planned = effectiveMaterials.filter(function (item) { return item.supplyStatus === 'planned'; }).length;
        var progress = materialProgress(projectId, materials);
        var groups = groupMaterialsBySection(materials);
        return '<div class="execution-summary material-progress-summary">' +
            stat('\u0412\u0441\u0435\u0433\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0439', String(materials.length)) +
            stat('\u0420\u0430\u0437\u0434\u0435\u043b\u043e\u0432', String(groups.length)) +
            stat('\u0417\u0430\u043a\u0440\u044b\u0442\u043e', String(progress.done) + ' \u0438\u0437 ' + String(progress.total), progress.total && progress.done >= progress.total ? 'success' : '') +
            stat('\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c', String(progress.left), progress.left ? 'warn' : '') +
            stat('\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f', String(required), required ? 'danger' : '') +
            stat('\u0421\u043a\u043e\u0440\u043e', String(soon), soon ? 'warn' : '') +
            stat('\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c', String(planned), planned ? 'warn' : '') +
        '</div>' + renderGroupedMaterials(groups, projectId, insights || {});
    };

    function workScheduleSections(projectId) {
        var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[projectId];
        return Array.isArray(summary && summary.sections) ? summary.sections : [];
    }

    function workScheduleSectionForTitle(projectId, title) {
        var normalizedTitle = normalizedWorkKeyPart(title);
        return workScheduleSections(projectId).find(function (section) {
            return normalizedWorkKeyPart(section && section.title) === normalizedTitle;
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
            heading: materialSectionLabel(index),
            html: '<span class="work-section-date">' + escapeHtml(finalGraphDate(section.startDate) + ' - ' + finalGraphDate(section.endDate)) + '</span>' + scheduleDeadlineBadge(deadlineState)
        };
    }

    renderEstimateWorkItem = function (item, sectionTitle, projectId, riskKind) {
        var isDone = projectId ? isScheduleWorkDone(projectId, sectionTitle, item) : false;
        var plannedQty = item.plannedQty != null ? item.plannedQty : item.planned_qty;
        var calculatedVolume = formatCalculatedWorkVolume(item);
        var meta = [
            item.unit ? ('\u0415\u0434.: ' + item.unit) : '',
            plannedQty != null && plannedQty !== '' ? ('\u041e\u0431\u044a\u0435\u043c: ' + formattedWorkQty(plannedQty)) : '',
            calculatedVolume ? ('\u0418\u0442\u043e\u0433\u043e: ' + calculatedVolume) : '',
            item.stageTitle ? ('\u042d\u0442\u0430\u043f: ' + item.stageTitle) : ''
        ].filter(Boolean).join(' \u2022 ');
        var hours = Number(item.estimated_hours || item.estimatedHours || 0);
        var badges = [];
        if (calculatedVolume) badges.push('<span class="badge work-total-badge success">' + escapeHtml(calculatedVolume) + '</span>');
        else badges.push('<span class="badge work-amount-badge">' + escapeHtml(formattedWorkQty(plannedQty || 0) + ' ' + (item.unit || '\u0435\u0434.')) + '</span>');
        if (hours > 0) badges.push('<span class="badge work-hours-badge">' + escapeHtml(finalSectionSummaryNumber(hours) + ' \u0447\u0435\u043b.-\u0447') + '</span>');
        if (isDone) badges.push('<span class="badge success">\u0413\u043e\u0442\u043e\u0432\u043e</span>');
        return '<div class="material-row work-row' + (isDone ? ' work-row-done' : '') + (!isDone && riskKind ? (' work-row-' + riskKind) : '') + '">' +
            '<div class="work-row-main">' + renderWorkManualCheck(item, sectionTitle, projectId) + '</div>' +
            '<div class="work-row-side">' + badges.join('') + '</div>' +
        '</div>';
    };

    renderWorksPanel = function (stages, items) {
        var projectId = state.selectedProject ? state.selectedProject.id : null;
        var stageMap = buildStageLookup(stages || []);
        var workStages = (stages || []).filter(function (stage) {
            return String(stage.stage_kind || '') !== 'section';
        });
        var estimateWorks = (items || []).filter(function (item) {
            return String(item.itemKind || '').toLowerCase() === 'work';
        });
        if (!workStages.length && !estimateWorks.length) return '<p class="muted">\u0420\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u0441\u043c\u0435\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b.</p>';
        var groups = {};
        var order = [];
        function ensureGroup(title) {
            var sectionTitle = String(title || '').trim() || '\u0411\u0435\u0437 \u0440\u0430\u0437\u0434\u0435\u043b\u0430';
            if (!groups[sectionTitle]) {
                groups[sectionTitle] = { stageRows: [], estimateRows: [] };
                order.push(sectionTitle);
            }
            return groups[sectionTitle];
        }
        workStages.forEach(function (stage) {
            ensureGroup(rootSectionTitleForStage(stage, stageMap)).stageRows.push(stage);
        });
        estimateWorks.forEach(function (item) {
            ensureGroup(item.sectionTitle || item.stageTitle).estimateRows.push(item);
        });
        var scheduleOrder = workScheduleSections(projectId).map(function (section) {
            return String(section.title || '').trim();
        }).filter(Boolean);
        if (scheduleOrder.length) {
            var scheduledMap = {};
            order = scheduleOrder.filter(function (title) {
                if (!groups[title]) return false;
                scheduledMap[title] = 1;
                return true;
            }).concat(order.filter(function (title) {
                return !scheduledMap[title];
            }));
        }
        var doneEstimateWorks = projectId ? estimateWorks.filter(function (item) {
            var sectionTitle = String(item.sectionTitle || item.stageTitle || '').trim() || '\u0411\u0435\u0437 \u0440\u0430\u0437\u0434\u0435\u043b\u0430';
            return isScheduleWorkDone(projectId, sectionTitle, item);
        }).length : 0;
        return '<div class="execution-summary work-progress-summary">' +
            stat('\u0420\u0430\u0437\u0434\u0435\u043b\u043e\u0432', String(order.length)) +
            stat('\u0420\u0430\u0431\u043e\u0442', String(estimateWorks.length || workStages.length)) +
            stat('\u0420\u0430\u0431\u043e\u0442 \u0433\u043e\u0442\u043e\u0432\u043e', String(doneEstimateWorks) + ' \u0438\u0437 ' + String(estimateWorks.length), estimateWorks.length && doneEstimateWorks >= estimateWorks.length ? 'success' : '') +
            stat('\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c', String(Math.max(0, estimateWorks.length - doneEstimateWorks)), estimateWorks.length - doneEstimateWorks ? 'warn' : '') +
        '</div><div class="estimate-section-list">' + order.map(function (title, index) {
            var group = groups[title];
            var workProgress = workProgressForRows(projectId, title, group.estimateRows);
            var scheduleMeta = workSectionScheduleMeta(projectId, title, index, workProgress);
            var activeRows = group.estimateRows.filter(function (item) {
                return !projectId || !isScheduleWorkDone(projectId, title, item);
            });
            var doneRows = group.estimateRows.filter(function (item) {
                return projectId && isScheduleWorkDone(projectId, title, item);
            });
            var completedBlock = doneRows.length
                ? '<details class="work-completed-fold"><summary>\u0417\u0430\u043a\u0440\u044b\u0442\u044b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b: ' + escapeHtml(String(doneRows.length)) + '</summary><div class="materials-list work-completed-list">' + doneRows.map(function (item) { return renderEstimateWorkItem(item, title, projectId); }).join('') + '</div></details>'
                : '';
            return '<section class="estimate-section work-section-card' + scheduleMeta.className + '">' +
                '<div class="card-head estimate-section-head work-section-head"><div class="estimate-section-title"><h3>' + escapeHtml(scheduleMeta.heading) + '</h3>' + (workProgress.total ? sectionProgressBadge('works', workProgress, '') : '') + '</div><div class="work-section-head-side">' + scheduleMeta.html + '</div><small>' + escapeHtml(title) + '</small></div>' +
                sectionProgressStrip(workProgress, { total: 0, done: 0 }) +
                '<div class="materials-list">' +
                    group.stageRows.map(function (stage) {
                        var meta = [
                            stagePathLabel(stage, stageMap),
                            stage.planned_start && stage.planned_end ? (stage.planned_start + ' - ' + stage.planned_end) : '',
                            stage.responsible || ''
                        ].filter(Boolean).join(' \u2022 ');
                        return '<div class="material-row work-row"><div><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(meta || '\u0420\u0430\u0431\u043e\u0442\u0430') + '</small></div><div class="material-chain-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' \u2022 ' + percent(stage.progress) + '%</span></div></div>';
                    }).join('') +
                    activeRows.map(function (item) { return renderEstimateWorkItem(item, title, projectId, scheduleMeta.kind); }).join('') +
                    (!activeRows.length && doneRows.length ? '<div class="section-schedule-empty inline">\u0412\u0441\u0435 \u0440\u0430\u0431\u043e\u0442\u044b \u0440\u0430\u0437\u0434\u0435\u043b\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u044b.</div>' : '') +
                '</div>' + completedBlock +
            '</section>';
        }).join('') + '</div>';
    };

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
        if (materialsPanel) materialsPanel.innerHTML = renderProjectMaterialsTab(project, materials, insights);
        if (overviewMaterials) overviewMaterials.innerHTML = renderMaterials(materials, project.id, insights);
        if (worksPanel) worksPanel.innerHTML = renderProjectWorksTab(project, stages, materials);
        bindProjectMarketToggles(projectId);
        bindProjectChainActions();
        bindSectionScheduleRefresh(projectId);
    }

    function bindMaterialManualChecks(projectId) {
        qsa('[data-section-material-check]').forEach(function (input) {
            if (input.dataset.materialBound === '1') return;
            input.dataset.materialBound = '1';
            input.addEventListener('change', function () {
                var project = state.selectedProject;
                if (!project || Number(project.id) !== Number(projectId)) return;
                setMaterialManuallyDone(projectId, {
                    id: input.getAttribute('data-material-id') || '',
                    title: input.getAttribute('data-material-title') || '',
                    unit: input.getAttribute('data-material-unit') || '',
                    plannedQty: input.getAttribute('data-material-qty') || ''
                }, input.checked);
                rerenderProjectMaterialAndWorkViews(projectId);
            });
        });
    }

    var baseBindProjectChainActionsFinal = bindProjectChainActions;
    bindProjectChainActions = function () {
        baseBindProjectChainActionsFinal();
        if (state.selectedProject && state.selectedProject.id) bindMaterialManualChecks(state.selectedProject.id);
    };

    var baseBindSectionScheduleRefreshFinal = bindSectionScheduleRefresh;
    bindSectionScheduleRefresh = function (projectId) {
        baseBindSectionScheduleRefreshFinal(projectId);
        bindMaterialManualChecks(projectId);
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

    if (page === 'login') initLogin();
    else initShell();
})();
