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
    var apiFormData = PMBI.apiFormData;
    var clearApiCache = PMBI.clearApiCache;
    var debounce = PMBI.debounce;
    var money = PMBI.money;
    var percent = PMBI.percent;
    var canonicalEstimateSectionTitle = PMBI.canonicalEstimateSectionTitle;
    var canonicalEstimateSectionId = PMBI.canonicalEstimateSectionId;
    var progressSelectorValue = PMBI.progressSelectorValue;
    var updateProjectProgressState = PMBI.updateProjectProgressState;
    var updateProgressNode = PMBI.updateProgressNode;
    var updateUIProgress = PMBI.updateUIProgress;
    var isoDateAdd = PMBI.isoDateAdd;
    var safeExternalUrl = PMBI.safeExternalUrl;
    var safeTelHref = PMBI.safeTelHref;
    var hasRole = PMBI.hasRole;
    var canManageSuppliers = PMBI.canManageSuppliers;
    var canManageDocuments = PMBI.canManageDocuments;
    var canViewProcurementPrices = PMBI.canViewProcurementPrices;
    var canSeeFinances = PMBI.canSeeFinances;

    function appCall(name, args) {
        var fn = PMBI.app && PMBI.app[name];
        if (typeof fn !== 'function') {
            throw new Error('PMBI.app.' + name + ' is not available');
        }
        return fn.apply(null, args);
    }
    function loadProjects() { return appCall('loadProjects', arguments); }
    function loadMaterials() { return appCall('loadMaterials', arguments); }
    function loadMaterialInsights() { return appCall('loadMaterialInsights', arguments); }
    function loadTasks() { return appCall('loadTasks', arguments); }
    function loadStages() { return appCall('loadStages', arguments); }
    function loadProjectNotifications() { return appCall('loadProjectNotifications', arguments); }
    function loadDocuments() { return appCall('loadDocuments', arguments); }
    function renderProjectList() { return appCall('renderProjectList', arguments); }
    function renderProjectStats() { return appCall('renderProjectStats', arguments); }
    function renderProjectCritical() { return appCall('renderProjectCritical', arguments); }
    function renderDashboard() { return appCall('renderDashboard', arguments); }
    function renderProjectShell() { return appCall('renderProjectShell', arguments); }
    function renderProjectHeader() { return appCall('renderProjectHeader', arguments); }
    function renderProjectTabs() { return appCall('renderProjectTabs', arguments); }
    function renderProjectHub() { return appCall('renderProjectHub', arguments); }
    function renderProjectOverviewHero() { return appCall('renderProjectOverviewHero', arguments); }
    function selectedProject() { return appCall('selectedProject', arguments); }
    function setSelectedProject() { return appCall('setSelectedProject', arguments); }
    function updateProjectInState() { return appCall('updateProjectInState', arguments); }
    function updateProjectCache() { return appCall('updateProjectCache', arguments); }
    function activateProjectTab() { return appCall('activateProjectTab', arguments); }
    function openProject() { return appCall('openProject', arguments); }
    function stat() { return appCall('stat', arguments); }
    function statusLabel() { return appCall('statusLabel', arguments); }
    function planningStatusClass() { return appCall('planningStatusClass', arguments); }
    function marketStatusLabel() { return appCall('marketStatusLabel', arguments); }
    function missingQty() { return appCall('missingQty', arguments); }
    function missingWorkQty() { return appCall('missingWorkQty', arguments); }
    function quantityPlanInfo() { return appCall('quantityPlanInfo', arguments); }
    function quantityText() { return appCall('quantityText', arguments); }
    function finalSectionSummaryNumber() { return appCall('finalSectionSummaryNumber', arguments); }
    function materialProgress() { return appCall('materialProgress', arguments); }
    function materialActualProgress() { return appCall('materialActualProgress', arguments); }
    function workActualProgress() { return appCall('workActualProgress', arguments); }
    function workProgressForRows() { return appCall('workProgressForRows', arguments); }
    function renderBulkSectionCheckbox() { return appCall('renderBulkSectionCheckbox', arguments); }
    function sectionProgressStrip() { return appCall('sectionProgressStrip', arguments); }
    function renderMaterialManualCheck() { return appCall('renderMaterialManualCheck', arguments); }
    function renderWorkManualCheck() { return appCall('renderWorkManualCheck', arguments); }
    function renderMaterials() { return appCall('renderMaterials', arguments); }
    function materialRow() { return appCall('materialRow', arguments); }
    function renderWorksPanel() { return appCall('renderWorksPanel', arguments); }
    function renderInlineMarketButton() { return appCall('renderInlineMarketButton', arguments); }
    function renderEstimateAccordionHead() { return appCall('renderEstimateAccordionHead', arguments); }
    function renderEstimateSectionBody() { return appCall('renderEstimateSectionBody', arguments); }
    function isEstimateSectionOpen() { return appCall('isEstimateSectionOpen', arguments); }
    function setEstimateSectionOpen() { return appCall('setEstimateSectionOpen', arguments); }
    function toggleEstimateSectionFromHead() { return appCall('toggleEstimateSectionFromHead', arguments); }
    function materialSectionLabel() { return appCall('materialSectionLabel', arguments); }
    function sectionProgressBadge() { return appCall('sectionProgressBadge', arguments); }
    function buildEstimateSectionNumberMap() { return appCall('buildEstimateSectionNumberMap', arguments); }
    function estimateDisplaySectionTitleWithNumber() { return appCall('estimateDisplaySectionTitleWithNumber', arguments); }
    function bindEstimateSectionToggles() { return appCall('bindEstimateSectionToggles', arguments); }
    function renderProjectMarketBlock() { return appCall('renderProjectMarketBlock', arguments); }
    function getProjectTabMode() { return appCall('getProjectTabMode', arguments); }
    function setProjectTabMode() { return appCall('setProjectTabMode', arguments); }
    function loadProjectMarketAnalysis() { return appCall('loadProjectMarketAnalysis', arguments); }
    function rerenderProjectMaterialAndWorkViews() { return appCall('rerenderProjectMaterialAndWorkViews', arguments); }
    function refreshSelectedProjectProgressViews() { return appCall('refreshSelectedProjectProgressViews', arguments); }
    function bindProjectChainActions() { return appCall('bindProjectChainActions', arguments); }
    function renderCompactActualQtyEditor() { return appCall('renderCompactActualQtyEditor', arguments); }
    function refreshMaterialScheduleProject() { return appCall('refreshMaterialScheduleProject', arguments); }
    function renderProjectFinances() { return appCall('renderProjectFinances', arguments); }
    function loadProjectFinances() { return appCall('loadProjectFinances', arguments); }
    function renderFinancePanel() { return appCall('renderFinancePanel', arguments); }
    function renderDocumentsPanel() { return appCall('renderDocumentsPanel', arguments); }
    function renderTasks() { return appCall('renderTasks', arguments); }
    function renderTaskFilters() { return appCall('renderTaskFilters', arguments); }
    function bindTaskEvents() { return appCall('bindTaskEvents', arguments); }
    function isValidUserEmail() { return appCall('isValidUserEmail', arguments); }
    function formatUserPhone() { return appCall('formatUserPhone', arguments); }
    function isCompleteUserPhone() { return appCall('isCompleteUserPhone', arguments); }
    function setupCompanyCreateModal() { return appCall('setupCompanyCreateModal', arguments); }
    function resetCompanyCreateForm() { return appCall('resetCompanyCreateForm', arguments); }
    function closeCompanyCreateModal() { return appCall('closeCompanyCreateModal', arguments); }
    function renderGroupedMaterials() { return ''; }
    function renderEstimateWorkItem() { return ''; }
    // company core helpers
    function loadCompanies(callback, type) {
        var path = '/api/companies' + (type ? '?type=' + encodeURIComponent(type) : '');
        var cacheKey = type ? 'companies:' + type : 'companies:all';
        api(path, {
            cacheKey: cacheKey,
            cacheTtl: 60 * 1000,
            requestGroup: 'companies-directory'
        }).then(function (data) {
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

    // legacy warehouse pages
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
                    resolve(items.filter(function (item) {
                        return String(item.itemKind || 'material').toLowerCase() !== 'work';
                    }).map(function (item) {
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
                if (PMBI.app && typeof PMBI.app.refreshReminderBell === 'function') PMBI.app.refreshReminderBell();
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
                    error.textContent = err.payload && (err.payload.message || err.payload.error) ? (err.payload.message || err.payload.error) : 'Не удалось импортировать смету';
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
                '<article class="warehouse-alert warehouse-alert-warn"><strong>Скоро понадобятся</strong><span>' + soon.length + '</span></article>' +
                '<article class="warehouse-alert"><strong>Без плана</strong><span>' + planned.length + '</span></article>' +
            '</section>' +
            (urgentRows.length
                ? '<div class="warehouse-hot-list">' + urgentRows.map(function (item) {
                    return '<div class="warehouse-hot-row">' +
                        '<div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.projectTitle) + ' • нужно к ' + escapeHtml(item.needByDate || 'без даты') + (item.stageTitle ? ' • этап: ' + escapeHtml(item.stageTitle) : '') + '</small></div>' +
                        '<div class="warehouse-hot-qty"><small>Не хватает</small><strong>' + escapeHtml(quantityText(item.missingQty)) + ' ' + escapeHtml(item.unit || 'ед.') + '</strong><span class="badge ' + planningStatusClass(item.supplyStatus) + '">' + escapeHtml(item.supplyLabel || 'Статус не задан') + '</span></div>' +
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
                    '<th>Объект</th><th>Материал</th><th>По смете</th><th>На складе</th><th>Не хватает</th><th>Нужно к</th><th>Статус</th>' +
                '</tr></thead>' +
                '<tbody>' + items.map(warehouseLedgerRow).join('') + '</tbody>' +
            '</table></div>';
    }

    function warehouseLedgerRow(item) {
        var missing = Number(item.missingQty) || 0;
        var rowRisk = item.supplyStatus === 'required' || missing > 0;
        return '<tr class="' + (rowRisk ? 'row-risk' : '') + '">' +
            '<td><b>' + escapeHtml(item.projectTitle) + '</b><small>' + escapeHtml(item.clientName || item.projectAddress || '') + '</small></td>' +
            '<td><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.sectionTitle || 'Без раздела') + (item.stageTitle ? ' • ' + escapeHtml(item.stageTitle) : '') + (item.notes ? ' • ' + escapeHtml(item.notes) : '') + '</small></td>' +
            '<td data-label="По смете"><strong class="warehouse-volume">' + escapeHtml(quantityText(item.plannedQty)) + ' ' + escapeHtml(item.unit || 'ед.') + '</strong></td>' +
            '<td data-label="На складе"><strong class="warehouse-volume' + (Number(item.stockQty || 0) <= 0 ? ' is-empty' : '') + '">' + escapeHtml(quantityText(item.stockQty)) + ' ' + escapeHtml(item.unit || 'ед.') + '</strong></td>' +
            '<td data-label="Не хватает"><strong class="warehouse-volume' + (missing > 0 ? ' is-missing' : '') + '">' + escapeHtml(quantityText(missing)) + ' ' + escapeHtml(item.unit || 'ед.') + '</strong></td>' +
            '<td data-label="Нужно к">' + escapeHtml(item.needByDate || '—') + '</td>' +
            '<td data-label="Статус"><span class="badge ' + planningStatusClass(item.supplyStatus) + '">' + escapeHtml(item.supplyLabel || '—') + '</span></td>' +
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

    // companies page
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
                    firstName: form.first_name.value.trim(),
                    lastName: form.last_name.value.trim(),
                    name: [form.first_name.value.trim(), form.last_name.value.trim()].filter(Boolean).join(' '),
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
            search.addEventListener('input', debounce(function () {
                renderFilteredCompaniesList(state.companies || []);
            }, 300));
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
            clearApiCache('companies');
            withSubmitLock(form, function () {
                return api('/api/companies', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: form.type.value,
                        firstName: form.first_name.value.trim(),
                        lastName: form.last_name.value.trim(),
                        name: [form.first_name.value.trim(), form.last_name.value.trim()].filter(Boolean).join(' '),
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

    // suppliers page
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

    function supplierModalFocusableNodes(modal) {
        if (!modal) return [];
        return qsa('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', modal).filter(function (node) {
            return !node.classList.contains('supplier-create-backdrop') && !node.classList.contains('supplier-detail-backdrop') && node.getAttribute('aria-hidden') !== 'true';
        });
    }

    function rememberSupplierModalFocus(modal) {
        var active = document.activeElement;
        modal._returnFocus = active && active !== document.body ? active : null;
    }

    function restoreSupplierModalFocus(modal) {
        var returnFocus = modal && modal._returnFocus;
        if (!qs('[data-supplier-create-modal][data-open="1"], [data-supplier-detail-modal][data-open="1"]') && returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
            returnFocus.focus();
        }
    }

    function bindSupplierModalEscape() {
        if (document.body.dataset.supplierModalEscapeBound === '1') return;
        document.body.dataset.supplierModalEscapeBound = '1';
        document.addEventListener('keydown', function (event) {
            var modal = qsa('[data-supplier-create-modal][data-open="1"], [data-supplier-detail-modal][data-open="1"]').slice(-1)[0];
            if (!modal) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                if (modal.hasAttribute('data-supplier-create-modal')) closeSupplierCreateModal();
                else closeSupplierDetailModal();
                return;
            }
            if (event.key !== 'Tab') return;
            var focusable = supplierModalFocusableNodes(modal);
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        });
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
        bindSupplierModalEscape();
    }

    function openSupplierCreateModal() {
        var modal = qs('[data-supplier-create-modal]');
        if (!modal) return;
        var error = qs('[data-supplier-create-error]', modal);
        if (error) {
            error.textContent = '';
            error.classList.remove('active');
        }
        rememberSupplierModalFocus(modal);
        modal.classList.remove('hidden');
        document.body.classList.add('supplier-create-open');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            var first = qs('[data-supplier-create-form] input:not([type="hidden"]), [data-supplier-create-form] select, [data-supplier-create-form] textarea', modal);
            if (first) first.focus();
        });
    }

    function closeSupplierCreateModal() {
        var modal = qs('[data-supplier-create-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.removeAttribute('data-open');
        document.body.classList.remove('supplier-create-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) {
                modal.classList.add('hidden');
                restoreSupplierModalFocus(modal);
            }
        }, 220);
    }

    function setupSupplierDetailModal() {
        var modal = qs('[data-supplier-detail-modal]');
        if (!modal || modal.dataset.bound === '1') return;
        modal.dataset.bound = '1';
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-supplier-detail-close]')) closeSupplierDetailModal();
        });
        bindSupplierModalEscape();
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
        if (!canViewProcurementPrices()) return '';
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
        var sourceUrl = safeExternalUrl(offer.source_url || '');
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
                (canViewProcurementPrices() ? supplierDetailItem('\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435', supplierOfferCompareText(offer)) : '') +
                supplierDetailItem('\u0410\u0432\u0442\u043e\u0440', offer.author_name || '') +
            '</div>' +
            (sourceUrl ? '<a class="supplier-detail-link" href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i><span>\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a</span></a>' : '') +
            '<section class="supplier-detail-notes"><h4>\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439</h4><p>' + escapeHtml(offer.notes || '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d.') + '</p></section>' +
        '</article>';
    }

    function openSupplierDetailModal(offerId) {
        var modal = qs('[data-supplier-detail-modal]');
        var offer = supplierOfferById(offerId);
        if (!modal || !offer) return;
        rememberSupplierModalFocus(modal);
        safeReplaceChildren(qs('[data-supplier-detail-body]', modal), renderSupplierDetail(offer));
        refreshLucideIcons(modal);
        modal.classList.remove('hidden');
        document.body.classList.add('supplier-detail-open');
        requestAnimationFrame(function () {
            modal.setAttribute('data-open', '1');
            var close = qs('[data-supplier-detail-close]', modal);
            if (close) close.focus();
        });
    }

    function closeSupplierDetailModal() {
        var modal = qs('[data-supplier-detail-modal]');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.removeAttribute('data-open');
        document.body.classList.remove('supplier-detail-open');
        setTimeout(function () {
            if (!modal.hasAttribute('data-open')) {
                modal.classList.add('hidden');
                restoreSupplierModalFocus(modal);
            }
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
            state.supplierOfferHistory = Array.isArray(data.history) ? data.history : [];
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
            (canViewProcurementPrices() ? stat('Лучшая экономия', bestSavings == null ? '—' : money(Math.abs(bestSavings))) : '');
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
        }
        safeReplaceChildren(root, '<div class="suppliers-list counterparties-grid">' + offers.map(function (offer) {
            var compare = offer.compareToEstimate || {};
            var delta = typeof compare.deltaTotal === 'number' ? compare.deltaTotal : null;
            var compareText = delta == null
                ? 'Смета не привязана'
                : (delta < 0 ? 'Экономия ' + money(Math.abs(delta)) : (delta > 0 ? 'Переплата ' + money(delta) : 'Ровно по смете'));
            var compareClass = delta == null ? '' : (delta > 0 ? 'danger' : '');
            var isFocused = materialId && Number(offer.estimate_item_id || 0) === materialId;
            var sourceUrl = safeExternalUrl(offer.source_url || '');
            if (supplierOfferMatchesFocus(offer, supplierFocus)) isFocused = true;
            return '<form class="supplier-offer-row counterparty-card' + (isFocused ? ' supplier-offer-row-focused' : '') + '" data-supplier-edit-form data-offer-id="' + offer.id + '" data-supplier-company-id="' + escapeHtml(offer.company_id || offer.companyId || '') + '" data-supplier-company-name="' + escapeHtml(offer.company_name || offer.candidate_name || '') + '">' +
                renderCounterpartyCard(offer, {
                    projectId: projectId,
                    offers: offers,
                    statText: counterpartyBindingStats(offer, offers, projectId)
                }).replace(/^<article class="counterparty-card">/, '').replace(/<\/article>$/, '') +
                '<div class="supplier-offer-main"><b>' + escapeHtml(offer.candidate_name) + '</b><small>' +
                    escapeHtml((offer.company_name || 'без компании') + ' • ' + (offer.material_title || 'без привязки к смете') + ' • ' + (offer.author_name || '')) +
                    (sourceUrl ? '<br><a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">Открыть источник</a>' : '') +
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
                '<div class="supplier-offer-meta">' + (canViewProcurementPrices() ? '<span class="badge ' + compareClass + '">' + escapeHtml(compareText) + '</span>' : '') + '<button class="ghost" type="submit">Сохранить</button></div>' +
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
                    if (state.marketAnalysisByProject) delete state.marketAnalysisByProject[projectId];
                    loadSupplierOffers(projectId);
                });
            });
        });
    }

    // project market tabs
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
            var sourceUrl = safeExternalUrl(source.url || '');
            return sourceUrl
                ? '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>'
                : '<span>' + escapeHtml(label) + '</span>';
        }).join('');
        var more = row.sourceCount > 3 ? '<span class="market-source-more">+' + (row.sourceCount - 3) + '</span>' : '';
        return '<div class="market-sources">' + visible + more + '</div>';
    }



    function renderProjectTabViewSwitcher(projectId, tab, title, subtitle) {
        if (hasRole('customer')) {
            return '<div class="market-toolbar"><div><h3>' + escapeHtml(title) + '</h3><p>' +
                escapeHtml('\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u043e\u0437\u0438\u0446\u0438\u0439 \u0431\u0435\u0437 \u0437\u0430\u043a\u0440\u044b\u0442\u044b\u0445 \u0446\u0435\u043d\u043e\u0432\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445.') + '</p></div></div>';
        }
        var mode = getProjectTabMode(projectId, tab);
        var marketLabel = canViewProcurementPrices() ? '\u0426\u0435\u043d\u044b \u0438 \u043c\u0430\u0440\u0436\u0430' : '\u0412\u0432\u0435\u0441\u0442\u0438 \u0446\u0435\u043d\u0443';
        return '<div class="market-toolbar">' +
            '<div><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(subtitle) + '</p></div>' +
            '<div class="segmented compact" data-market-switcher>' +
                '<button type="button" class="' + (mode === 'list' ? 'active' : '') + '" data-market-mode="list" data-market-tab="' + tab + '">\u0421\u043f\u0438\u0441\u043e\u043a</button>' +
                '<button type="button" class="' + (mode === 'market' ? 'active' : '') + '" data-market-mode="market" data-market-tab="' + tab + '">' + marketLabel + '</button>' +
            '</div>' +
        '</div>';
    }

    function renderProjectMaterialsTab(project, items, insights) {
        var header = renderProjectTabViewSwitcher(project.id, 'materials', '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b', '\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u043e\u0437\u0438\u0446\u0438\u0439 \u0438 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0432\u0438\u0434 \u0441 \u0446\u0435\u043d\u0430\u043c\u0438 \u0440\u044b\u043d\u043a\u0430 \u0438\u0437 AutoBot.');
        if (!hasRole('customer') && getProjectTabMode(project.id, 'materials') === 'market') {
            return header + renderProjectMarketBlock(project.id, 'material');
        }
        return header + renderMaterials(items, project.id, insights);
    }

    function renderProjectWorksTab(project, stages, items) {
        var header = renderProjectTabViewSwitcher(project.id, 'works', '\u0420\u0430\u0431\u043e\u0442\u044b', '\u0422\u0435\u043a\u0443\u0449\u0438\u0435 \u0440\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u0441\u043c\u0435\u0442\u0435 \u0438 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0432\u043e\u0434\u043a\u0430 \u043f\u043e \u0440\u044b\u043d\u043e\u0447\u043d\u044b\u043c \u0446\u0435\u043d\u0430\u043c.');
        if (!hasRole('customer') && getProjectTabMode(project.id, 'works') === 'market') {
            return header + renderProjectMarketBlock(project.id, 'work');
        }
        return header + renderWorksPanel(stages, items);
    }

    function rerenderProjectMarketTab(projectId, tab) {
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); });
        if (!project) return;
        rerenderProjectMaterialAndWorkViews(projectId);
    }

    function bindProjectMarketToggles(projectId) {
        if (hasRole('customer')) return;
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

    // counterparty market and warehouse catalog
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
        if (!canViewProcurementPrices()) return '';
        if (!canManageSuppliers()) return '';
        var source = Array.isArray(row.sources) && row.sources.length ? row.sources[0] : {};
        var type = kind === 'work' ? 'contractor' : 'supplier';
        var label = kind === 'work' ? '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u0434\u0440\u044f\u0434\u0447\u0438\u043a\u0430' : '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u0430';
        var sourceText = [source.phone || '', source.snippet || '', source.title || '', row.statusNote || ''].join(' ');
        return '<button class="ghost compact market-create-counterparty" type="button" data-market-create-offer data-project-id="' + escapeHtml(projectId) + '" data-market-tab="' + (kind === 'work' ? 'works' : 'materials') + '" data-candidate-type="' + escapeHtml(type) + '" data-candidate-name="' + escapeHtml(marketCandidateTitle(row, source, kind)) + '" data-estimate-item-id="' + escapeHtml(row.estimateItemId || '') + '" data-source-type="' + escapeHtml(marketSourceType(source)) + '" data-source-url="' + escapeHtml(source.url || '') + '" data-source-snippet="' + escapeHtml(source.snippet || '') + '" data-contact-phone="' + escapeHtml(source.phone || extractPhoneFromText(sourceText)) + '" data-price="' + escapeHtml(row.marketPrice == null ? (source.price || 0) : row.marketPrice) + '" data-qty="' + escapeHtml(row.plannedQty || 0) + '" data-unit="' + escapeHtml(row.unit || '') + '" data-notes="' + escapeHtml([row.title, source.snippet || '', source.domain || ''].filter(Boolean).join(' \u2022 ')) + '">' + label + '</button>';
    }


    function formatMarketAnalysisDate(timestamp) {
        if (!timestamp) return '';
        try {
            return new Date(Number(timestamp) * 1000).toLocaleDateString('ru-RU');
        } catch (error) {
            return '';
        }
    }

    function formatMarketMargin(value) {
        if (value == null) return '<span class="market-margin market-margin-empty">&mdash;</span>';
        var numeric = Number(value);
        var cls = numeric > 0 ? 'market-margin-positive' : (numeric < 0 ? 'market-margin-negative' : 'market-margin-zero');
        var prefix = numeric > 0 ? '+' : '';
        return '<strong class="market-margin ' + cls + '">' + escapeHtml(prefix + String(Math.round(numeric * 100) / 100) + '%') + '</strong>';
    }

    function formatProcurementLimit(limit) {
        limit = limit || {};
        if (!limit.configured) {
            return '<span class="procurement-limit is-empty">\u041d\u0435 \u0437\u0430\u0434\u0430\u043d</span>' +
                '<button class="ghost compact procurement-limit-link" type="button" data-market-open-finance>\u041d\u0430\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u0432 \u0444\u0438\u043d\u0430\u043d\u0441\u0430\u0445</button>';
        }
        var total = money(Number(limit.limitNetKopecks || 0) / 100);
        var version = limit.baselineVersion ? ('\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u0430\u044f \u0431\u0430\u0437\u0430 v' + limit.baselineVersion) : '\u0423\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d\u043d\u0430\u044f \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u0430\u044f \u0431\u0430\u0437\u0430';
        if (limit.status === 'awaiting_offer') {
            return '<strong class="procurement-limit is-waiting">' + escapeHtml(total) + '</strong><small>' + escapeHtml(version + ' \u00b7 \u043e\u0436\u0438\u0434\u0430\u0435\u0442 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u0443\u044e \u0446\u0435\u043d\u0443') + '</small>';
        }
        if (limit.status === 'exceeded') {
            var overrun = money(Number(limit.overrunKopecks || 0) / 100);
            var reason = limit.reasonHint === 'additional_volume'
                ? '\u0412\u043e\u0437\u043c\u043e\u0436\u0435\u043d \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u043e\u0431\u044a\u0451\u043c'
                : '\u0426\u0435\u043d\u0430 \u0432\u044b\u0448\u0435 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d\u043d\u043e\u0433\u043e \u043b\u0438\u043c\u0438\u0442\u0430';
            return '<strong class="procurement-limit is-exceeded">' + escapeHtml(total) + '</strong>' +
                '<small class="procurement-limit-alert">\u041f\u0435\u0440\u0435\u0440\u0430\u0441\u0445\u043e\u0434 ' + escapeHtml(overrun) + '</small>' +
                '<small>' + escapeHtml(reason + ' \u00b7 ' + version) + '</small>';
        }
        var reserve = Math.max(0, Number(limit.varianceKopecks || 0));
        return '<strong class="procurement-limit is-within">' + escapeHtml(total) + '</strong>' +
            '<small class="procurement-limit-ok">\u0412 \u043f\u0440\u0435\u0434\u0435\u043b\u0430\u0445 \u00b7 \u0440\u0435\u0437\u0435\u0440\u0432 ' + escapeHtml(money(reserve / 100)) + '</small>' +
            '<small>' + escapeHtml(version) + '</small>';
    }

    function renderRestrictedMarketTable(rows, kind, projectId, canSubmitPrice) {
        if (!rows.length) {
            return '<div class="market-empty">\u041d\u0435\u0442 \u043f\u043e\u0437\u0438\u0446\u0438\u0439 \u0434\u043b\u044f \u0432\u0432\u043e\u0434\u0430 \u0446\u0435\u043d\u044b.</div>';
        }
        return '<div class="market-table-wrap"><table class="market-table market-price-entry-table">' +
            '<thead><tr><th>\u041f\u043e\u0437\u0438\u0446\u0438\u044f</th><th>\u0412\u0430\u0448\u0430 \u0446\u0435\u043d\u0430</th></tr></thead><tbody>' +
            rows.map(function (row) {
                var field = canSubmitPrice
                    ? '<form class="market-price-entry" data-market-price-entry data-project-id="' + escapeHtml(projectId) + '" data-estimate-item-id="' + escapeHtml(row.estimateItemId || '') + '" data-market-kind="' + escapeHtml(kind) + '">' +
                        '<input name="price" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0446\u0435\u043d\u0443">' +
                        '<button class="primary compact" type="submit">\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</button>' +
                        '<small data-market-price-entry-status></small>' +
                    '</form>'
                    : '<span class="muted">\u0412\u0432\u043e\u0434 \u0446\u0435\u043d\u044b \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0434\u043b\u044f \u044d\u0442\u043e\u0439 \u0440\u043e\u043b\u0438</span>';
                return '<tr><td data-label="\u041f\u043e\u0437\u0438\u0446\u0438\u044f"><b>' + escapeHtml(row.title || '') + '</b></td><td data-label="\u0412\u0430\u0448\u0430 \u0446\u0435\u043d\u0430">' + field + '</td></tr>';
            }).join('') +
            '</tbody></table></div>';
    }

    function renderMarketTable(rows, kind, projectId, cache) {
        if (!canViewProcurementPrices()) {
            return renderRestrictedMarketTable(rows, kind, projectId, !!(cache && cache.canSubmitPrice));
        }
        if (!rows.length) {
            return '<div class="market-empty">\u041f\u043e \u044d\u0442\u043e\u043c\u0443 \u0440\u0430\u0437\u0434\u0435\u043b\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u0442\u0440\u043e\u043a \u0434\u043b\u044f \u0430\u043d\u0430\u043b\u0438\u0437\u0430.</div>';
        }
        return '<div class="market-table-wrap"><table class="market-table">' +
            '<thead><tr>' +
                '<th>\u041f\u043e\u0437\u0438\u0446\u0438\u044f</th>' +
                '<th>\u0426\u0435\u043d\u0430 \u0441\u043c\u0435\u0442\u044b</th>' +
                '<th>\u0426\u0435\u043d\u0430 \u0418\u0418</th>' +
                '<th>\u041b\u0438\u043c\u0438\u0442 \u0437\u0430\u043a\u0443\u043f\u043a\u0438</th>' +
                '<th>\u0412\u0432\u0435\u0434\u0435\u043d\u043d\u0430\u044f \u0446\u0435\u043d\u0430</th>' +
                '<th>\u041c\u0430\u0440\u0436\u0430</th>' +
                '<th>\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0418\u0418</th>' +
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
                        '<small>' + escapeHtml((row.marketPriceIsStale ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0439 \u0441\u043d\u0438\u043c\u043e\u043a' : 'AutoBot') + (formatMarketAnalysisDate(row.marketAnalyzedAt) ? ' \u2022 ' + formatMarketAnalysisDate(row.marketAnalyzedAt) : '')) + '</small>';
                var activeOffer = row.activeOffer || null;
                var procurementLimit = row.procurementLimit || {};
                var activeOfferMeta = [];
                if (activeOffer && activeOffer.candidateName) activeOfferMeta.push(activeOffer.candidateName);
                if (activeOffer && activeOffer.enteredBy) {
                    activeOfferMeta.push('\u0412\u0432\u0451\u043b: ' + activeOffer.enteredBy + (formatMarketAnalysisDate(activeOffer.enteredAt) ? ' \u2022 ' + formatMarketAnalysisDate(activeOffer.enteredAt) : ''));
                }
                if (activeOffer && activeOffer.activatedBy) {
                    activeOfferMeta.push('\u0410\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u043b: ' + activeOffer.activatedBy + (formatMarketAnalysisDate(activeOffer.activatedAt) ? ' \u2022 ' + formatMarketAnalysisDate(activeOffer.activatedAt) : ''));
                }
                var enteredCell = row.enteredPrice == null
                    ? '<span class="market-missing">\u041d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0433\u043e \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f</span>'
                    : '<strong>' + escapeHtml(money(row.enteredPrice)) + '</strong>' +
                        activeOfferMeta.map(function (item) { return '<small>' + escapeHtml(item) + '</small>'; }).join('');
                var source = row.marketSource || {};
                var sourceUrl = safeExternalUrl(source.url || '');
                var sourceCell = sourceUrl
                    ? '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(source.name || '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a') + '</a>'
                    : (source.name ? '<span>' + escapeHtml(source.name) + '</span>' : renderMarketSources(row));
                return '<tr' + (procurementLimit.status === 'exceeded' ? ' class="market-row-limit-exceeded"' : '') + '>' +
                    '<td data-label="\u041f\u043e\u0437\u0438\u0446\u0438\u044f"><b>' + escapeHtml(row.title) + '</b><small>' + escapeHtml(meta || '\u0411\u0435\u0437 \u0440\u0430\u0437\u0434\u0435\u043b\u0430') + '</small></td>' +
                    '<td data-label="\u0426\u0435\u043d\u0430 \u0441\u043c\u0435\u0442\u044b"><strong>' + escapeHtml(money(row.estimateUnitPrice || 0)) + '</strong><small>\u0412\u0441\u0435\u0433\u043e: ' + escapeHtml(money(row.estimateTotal || 0)) + '</small></td>' +
                    '<td data-label="\u0426\u0435\u043d\u0430 \u0418\u0418">' + marketCell + (row.statusNote ? '<small>' + escapeHtml(row.statusNote) + '</small>' : '') + '</td>' +
                    '<td data-label="\u041b\u0438\u043c\u0438\u0442 \u0437\u0430\u043a\u0443\u043f\u043a\u0438">' + formatProcurementLimit(procurementLimit) + '</td>' +
                    '<td data-label="\u0412\u0432\u0435\u0434\u0435\u043d\u043d\u0430\u044f \u0446\u0435\u043d\u0430">' + enteredCell + '</td>' +
                    '<td data-label="\u041c\u0430\u0440\u0436\u0430">' + formatMarketMargin(row.marginPercent) + '</td>' +
                    '<td data-label="\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0418\u0418">' + sourceCell + (row.marketEstimateVersion ? '<small>\u0412\u0435\u0440\u0441\u0438\u044f: ' + escapeHtml(row.marketEstimateVersion) + '</small>' : '') + '</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>';
    }


    function renderProjectMarketBlock(projectId, kind) {
        var cache = (state.marketAnalysisByProject[projectId] || {})[kind];
        if (!cache || cache.loading || cache.status === 'pending') {
            return '<div class="market-empty">\u0410\u043d\u0430\u043b\u0438\u0437 \u0440\u044b\u043d\u043a\u0430 \u0438\u0437 AutoBot \u0432\u044bполняетс\u044f...</div>';
        }
        var rows = Array.isArray(cache.rows) ? cache.rows : [];
        if (cache.error && !rows.length) {
            return '<div class="market-empty">' + escapeHtml(marketErrorLabel(cache.error)) + '</div>';
        }
        var summary = cache.summary || {};
        if (!canViewProcurementPrices()) {
            return renderMarketTable(rows, kind, projectId, cache);
        }
        return '<div class="execution-summary">' +
            stat('\u0412\u0441\u0435\u0433\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0439', String(summary.total || 0)) +
            stat('\u0415\u0441\u0442\u044c \u0440\u044b\u043d\u043e\u043a', String(summary.withMarketData || 0), summary.withMarketData ? '' : 'warn') +
            stat('\u0411\u0435\u0437 \u0440\u044b\u043d\u043a\u0430', String(summary.withoutMarketData || 0), summary.withoutMarketData ? 'warn' : '') +
        '</div>' + renderMarketTable(rows, kind, projectId, cache);
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
                    clearApiCache('companies');
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

    function bindMarketPriceEntryForms(projectId) {
        qsa('[data-market-open-finance]').forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                activateProjectTab('finance');
            });
        });
        qsa('[data-market-price-entry]').forEach(function (form) {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var input = form.elements.price;
                var status = qs('[data-market-price-entry-status]', form);
                var submit = qs('button[type="submit"]', form);
                var price = Number(input && input.value || 0);
                var itemId = Number(form.getAttribute('data-estimate-item-id') || 0);
                var user = state.currentUser || state.user || {};
                var candidateName = String(user.name || [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' ') || user.login || '\u0420\u0443\u0447\u043d\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435').trim();
                if (!itemId || !Number.isFinite(price) || price < 0) return;
                if (status) {
                    status.textContent = '';
                    status.className = '';
                }
                if (submit) submit.disabled = true;
                api('/api/projects/' + projectId + '/supplier-offers', {
                    method: 'POST',
                    body: JSON.stringify({
                        estimate_item_id: itemId,
                        candidate_type: form.getAttribute('data-market-kind') === 'work' ? 'contractor' : 'supplier',
                        candidate_name: candidateName,
                        source_type: 'manual',
                        status: 'quoted',
                        price: price
                    })
                }).then(function () {
                    if (input) input.value = '';
                    if (status) {
                        status.textContent = '\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e';
                        status.className = 'is-success';
                    }
                    delete state.materialInsightsByProject[projectId];
                }).catch(function (error) {
                    if (status) {
                        status.textContent = error && error.payload && error.payload.error ? error.payload.error : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c';
                        status.className = 'is-error';
                    }
                }).finally(function () {
                    if (submit) submit.disabled = false;
                });
            });
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
        bindMarketPriceEntryForms(projectId);
        bindCounterpartyFilters(projectId);
        bindEstimateSectionToggles(projectId);
    };

    var baseBindProjectChainActionsCounterparties = bindProjectChainActions;
    bindProjectChainActions = function () {
        baseBindProjectChainActionsCounterparties();
        if (state.selectedProject && state.selectedProject.id) bindCounterpartyFilters(state.selectedProject.id);
        if (state.selectedProject && state.selectedProject.id) bindEstimateSectionToggles(state.selectedProject.id);
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
        }).catch(function (error) {
            state.warehouseCatalog = [];
            callback([], error);
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
            root.innerHTML = '<div class="warehouse-empty-state"><i data-lucide="package-open"></i><b>Ничего не найдено</b><span>Добавь первый приход или измени поиск.</span></div>';
            refreshLucideIcons(root);
            return;
        }
        root.innerHTML =
            '<div class="warehouse-table-wrap"><table class="warehouse-table warehouse-inventory-table ui-table">' +
                '<thead><tr><th>Что на складе</th><th>Остаток</th><th></th></tr></thead>' +
                '<tbody>' + items.map(function (item) {
                    var disabled = Number(item.qty || 0) <= 0 ? ' disabled' : '';
                    var details = [item.sku ? 'Арт. ' + item.sku : '', item.category || '', warehouseConditionLabel(item)].filter(Boolean).join(' · ');
                    return '<tr>' +
                        '<td><div class="warehouse-item-title"><span class="badge">' + escapeHtml(warehouseTypeLabel(item.itemType || item.type)) + '</span><b>' + escapeHtml(item.name || '') + '</b></div><small>' + escapeHtml(details) + '</small></td>' +
                        '<td data-label="Остаток"><strong class="warehouse-qty' + (Number(item.qty || 0) <= 0 ? ' is-empty' : '') + '">' + escapeHtml(warehouseQtyText(item)) + '</strong></td>' +
                        '<td><button class="ghost compact" type="button" data-warehouse-issue data-warehouse-item-id="' + escapeHtml(item.id) + '"' + disabled + '>' + (disabled ? 'Нет в наличии' : 'Выдать') + '</button></td>' +
                    '</tr>';
                }).join('') + '</tbody>' +
            '</table></div>';
        refreshLucideIcons(root);
    }

    function renderWarehouseStats(items) {
        var node = qs('[data-warehouse-analysis]');
        if (!node) return;
        var available = (items || []).filter(function (item) { return Number(item.qty || 0) > 0; }).length;
        node.innerHTML =
            '<div class="analysis-pill"><span>Всего позиций</span><strong>' + (items || []).length + '</strong></div>' +
            '<div class="analysis-pill"><span>Сейчас в наличии</span><strong>' + available + '</strong></div>';
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
        showSkeleton(root, 'table', 1);
        showSkeleton(qs('[data-warehouse-analysis]'), 'stats', 2);
        loadWarehouseCatalog(function (items, loadError) {
            if (loadError) {
                safeReplaceChildren(root,
                    '<div class="warehouse-empty-state is-error" role="alert">' +
                        '<i data-lucide="triangle-alert" aria-hidden="true"></i>' +
                        '<b>\u0421\u043a\u043b\u0430\u0434 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0441\u044f</b>' +
                        '<span>\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0435 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0443.</span>' +
                        '<button class="ghost compact" type="button" data-warehouse-retry>\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c</button>' +
                    '</div>'
                );
                safeReplaceChildren(qs('[data-warehouse-analysis]'), '');
                var retry = qs('[data-warehouse-retry]', root);
                if (retry) retry.addEventListener('click', renderWarehousePage, { once: true });
                refreshLucideIcons(root);
                return;
            }
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

    function warehouseModalFocusableNodes(modal) {
        if (!modal) return [];
        return qsa('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', modal).filter(function (node) {
            return !node.classList.contains('warehouse-transfer-backdrop') && node.getAttribute('aria-hidden') !== 'true' && !node.closest('[hidden]');
        });
    }

    function rememberWarehouseModalFocus(modal) {
        if (!modal) return;
        var active = document.activeElement;
        modal._returnFocus = active && active !== document.body ? active : null;
        if (document.body.dataset.warehouseModalKeyboardBound === '1') return;
        document.body.dataset.warehouseModalKeyboardBound = '1';
        document.addEventListener('keydown', function (event) {
            var openModal = qs('[data-warehouse-transfer-modal]:not([hidden]), [data-warehouse-receipt-modal]:not([hidden])');
            if (!openModal) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                if (openModal.hasAttribute('data-warehouse-receipt-modal')) closeWarehouseReceiptModal();
                else closeWarehouseTransferModal();
                return;
            }
            if (event.key !== 'Tab') return;
            var focusable = warehouseModalFocusableNodes(openModal);
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !openModal.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !openModal.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    function restoreWarehouseModalFocus(modal) {
        var returnFocus = modal && modal._returnFocus;
        if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
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
        rememberWarehouseModalFocus(modal);
        modal.hidden = false;
        document.body.classList.add('warehouse-transfer-open');
        setTimeout(function () { if (form.qty) form.qty.focus(); }, 40);
    }

    function closeWarehouseTransferModal() {
        var modal = qs('[data-warehouse-transfer-modal]');
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('warehouse-transfer-open');
        restoreWarehouseModalFocus(modal);
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
        rememberWarehouseModalFocus(modal);
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
        restoreWarehouseModalFocus(modal);
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
        if (currentPage() !== 'warehouse') return;
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
                var nextItems = data && Array.isArray(data.items) ? data.items : (state.materialsByProject[projectId] || []);
                if (state.materialScheduleByProject) delete state.materialScheduleByProject[String(projectId)];
                if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
                    loadWarehouseMatches(projectId, function (matches) {
                        state.materialsByProject[projectId] = nextItems.map(function (item) {
                            var match = matches && matches[String(item.id)];
                            return match ? Object.assign({}, item, { warehouseMatch: match }) : item;
                        });
                        rerenderProjectMaterialAndWorkViews(projectId);
                        refreshMaterialScheduleProject(projectId, true);
                    });
                }
            }).finally(function () {
                input.disabled = false;
            });
        });
    }

    PMBI.procurement = PMBI.procurement || {};
        if (typeof loadCompanies === 'function') PMBI.procurement.loadCompanies = loadCompanies;
        if (typeof ensureCounterpartyCompanies === 'function') PMBI.procurement.ensureCounterpartyCompanies = ensureCounterpartyCompanies;
        if (typeof companyTypeLabel === 'function') PMBI.procurement.companyTypeLabel = companyTypeLabel;
        if (typeof counterpartyTypeLabel === 'function') PMBI.procurement.counterpartyTypeLabel = counterpartyTypeLabel;
        if (typeof counterpartyTypeClass === 'function') PMBI.procurement.counterpartyTypeClass = counterpartyTypeClass;
        if (typeof counterpartyInitials === 'function') PMBI.procurement.counterpartyInitials = counterpartyInitials;
        if (typeof counterpartyAvatarStyle === 'function') PMBI.procurement.counterpartyAvatarStyle = counterpartyAvatarStyle;
        if (typeof counterpartyWebsite === 'function') PMBI.procurement.counterpartyWebsite = counterpartyWebsite;
        if (typeof counterpartyBindingStats === 'function') PMBI.procurement.counterpartyBindingStats = counterpartyBindingStats;
        if (typeof renderCounterpartyCard === 'function') PMBI.procurement.renderCounterpartyCard = renderCounterpartyCard;
        if (typeof initCompaniesPage === 'function') PMBI.procurement.initCompaniesPage = initCompaniesPage;
        if (typeof initCompaniesPageLegacyUnused === 'function') PMBI.procurement.initCompaniesPageLegacyUnused = initCompaniesPageLegacyUnused;
        if (typeof renderCompaniesList === 'function') PMBI.procurement.renderCompaniesList = renderCompaniesList;
        if (typeof companySearchMatches === 'function') PMBI.procurement.companySearchMatches = companySearchMatches;
        if (typeof renderFilteredCompaniesList === 'function') PMBI.procurement.renderFilteredCompaniesList = renderFilteredCompaniesList;
        if (typeof initSuppliersPage === 'function') PMBI.procurement.initSuppliersPage = initSuppliersPage;
        if (typeof renderSuppliersContext === 'function') PMBI.procurement.renderSuppliersContext = renderSuppliersContext;
        if (typeof renderSupplierStats === 'function') PMBI.procurement.renderSupplierStats = renderSupplierStats;
        if (typeof renderSupplierList === 'function') PMBI.procurement.renderSupplierList = renderSupplierList;
        if (typeof renderSupplierCompactCard === 'function') PMBI.procurement.renderSupplierCompactCard = renderSupplierCompactCard;
        if (typeof bindSupplierCards === 'function') PMBI.procurement.bindSupplierCards = bindSupplierCards;
        if (typeof bindSupplierCreateForm === 'function') PMBI.procurement.bindSupplierCreateForm = bindSupplierCreateForm;
        if (typeof bindSupplierEditors === 'function') PMBI.procurement.bindSupplierEditors = bindSupplierEditors;
        if (typeof openSupplierCreateModal === 'function') PMBI.procurement.openSupplierCreateModal = openSupplierCreateModal;
        if (typeof closeSupplierCreateModal === 'function') PMBI.procurement.closeSupplierCreateModal = closeSupplierCreateModal;
        if (typeof openSupplierDetailModal === 'function') PMBI.procurement.openSupplierDetailModal = openSupplierDetailModal;
        if (typeof closeSupplierDetailModal === 'function') PMBI.procurement.closeSupplierDetailModal = closeSupplierDetailModal;
        if (typeof renderProjectMaterialsTab === 'function') PMBI.procurement.renderProjectMaterialsTab = renderProjectMaterialsTab;
        if (typeof renderProjectWorksTab === 'function') PMBI.procurement.renderProjectWorksTab = renderProjectWorksTab;
        if (typeof rerenderProjectMarketTab === 'function') PMBI.procurement.rerenderProjectMarketTab = rerenderProjectMarketTab;
        if (typeof bindProjectMarketToggles === 'function') PMBI.procurement.bindProjectMarketToggles = bindProjectMarketToggles;
        if (typeof renderProjectTabViewSwitcher === 'function') PMBI.procurement.renderProjectTabViewSwitcher = renderProjectTabViewSwitcher;
        if (typeof renderCounterpartyPicker === 'function') PMBI.procurement.renderCounterpartyPicker = renderCounterpartyPicker;
        if (typeof renderCounterpartyFilter === 'function') PMBI.procurement.renderCounterpartyFilter = renderCounterpartyFilter;
        if (typeof filterItemsByCounterparty === 'function') PMBI.procurement.filterItemsByCounterparty = filterItemsByCounterparty;
        if (typeof bindCounterpartyFilters === 'function') PMBI.procurement.bindCounterpartyFilters = bindCounterpartyFilters;
        if (typeof renderGroupedMaterials === 'function') PMBI.procurement.renderGroupedMaterials = renderGroupedMaterials;
        if (typeof renderEstimateWorkItem === 'function') PMBI.procurement.renderEstimateWorkItem = renderEstimateWorkItem;
        if (typeof renderProjectMarketBlock === 'function') PMBI.procurement.renderProjectMarketBlock = renderProjectMarketBlock;
        if (typeof bindMarketCreateButtons === 'function') PMBI.procurement.bindMarketCreateButtons = bindMarketCreateButtons;
        if (typeof loadWarehouseCatalog === 'function') PMBI.procurement.loadWarehouseCatalog = loadWarehouseCatalog;
        if (typeof renderWarehouseCatalog === 'function') PMBI.procurement.renderWarehouseCatalog = renderWarehouseCatalog;
        if (typeof renderWarehouseStats === 'function') PMBI.procurement.renderWarehouseStats = renderWarehouseStats;
        if (typeof bindWarehouseCatalogControls === 'function') PMBI.procurement.bindWarehouseCatalogControls = bindWarehouseCatalogControls;
        if (typeof renderWarehousePage === 'function') PMBI.procurement.renderWarehousePage = renderWarehousePage;
        if (typeof warehouseQtyText === 'function') PMBI.procurement.warehouseQtyText = warehouseQtyText;
        if (typeof warehouseTypeLabel === 'function') PMBI.procurement.warehouseTypeLabel = warehouseTypeLabel;
        if (typeof warehouseConditionLabel === 'function') PMBI.procurement.warehouseConditionLabel = warehouseConditionLabel;
        if (typeof warehouseNormalizeSearch === 'function') PMBI.procurement.warehouseNormalizeSearch = warehouseNormalizeSearch;
        if (typeof warehouseFilteredItems === 'function') PMBI.procurement.warehouseFilteredItems = warehouseFilteredItems;
        if (typeof rerenderWarehouseCatalog === 'function') PMBI.procurement.rerenderWarehouseCatalog = rerenderWarehouseCatalog;
        if (typeof openWarehouseTransferModal === 'function') PMBI.procurement.openWarehouseTransferModal = openWarehouseTransferModal;
        if (typeof closeWarehouseTransferModal === 'function') PMBI.procurement.closeWarehouseTransferModal = closeWarehouseTransferModal;
        if (typeof bindWarehouseTransferModal === 'function') PMBI.procurement.bindWarehouseTransferModal = bindWarehouseTransferModal;
        if (typeof openWarehouseReceiptModal === 'function') PMBI.procurement.openWarehouseReceiptModal = openWarehouseReceiptModal;
        if (typeof closeWarehouseReceiptModal === 'function') PMBI.procurement.closeWarehouseReceiptModal = closeWarehouseReceiptModal;
        if (typeof bindWarehouseReceiptModal === 'function') PMBI.procurement.bindWarehouseReceiptModal = bindWarehouseReceiptModal;
        if (typeof bindWarehouseManualReceiptForm === 'function') PMBI.procurement.bindWarehouseManualReceiptForm = bindWarehouseManualReceiptForm;
        if (typeof bindWarehouseReturnForm === 'function') PMBI.procurement.bindWarehouseReturnForm = bindWarehouseReturnForm;
        if (typeof loadWarehouseMatches === 'function') PMBI.procurement.loadWarehouseMatches = loadWarehouseMatches;
        if (typeof renderWarehouseMatchBadge === 'function') PMBI.procurement.renderWarehouseMatchBadge = renderWarehouseMatchBadge;
        if (typeof closeWarehouseMatchPopover === 'function') PMBI.procurement.closeWarehouseMatchPopover = closeWarehouseMatchPopover;
        if (typeof openWarehouseMatchPopover === 'function') PMBI.procurement.openWarehouseMatchPopover = openWarehouseMatchPopover;
        if (typeof renderMaterialDeliveryField === 'function') PMBI.procurement.renderMaterialDeliveryField = renderMaterialDeliveryField;
        if (typeof applyWarehouseIssueFocus === 'function') PMBI.procurement.applyWarehouseIssueFocus = applyWarehouseIssueFocus;
    window.PMBI = PMBI;
})();
