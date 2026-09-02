(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    var page = PMBI.page;
    var APP_TODAY = PMBI.APP_TODAY;
    var state = PMBI.state;
    var qs = PMBI.qs;
    var qsa = PMBI.qsa;
    var safeReplaceChildren = PMBI.safeReplaceChildren;
    var skeletonMarkup = PMBI.skeletonMarkup;
    var refreshLucideIcons = PMBI.refreshLucideIcons;
    var showAppNotice = PMBI.showAppNotice;
    var appErrorMessage = PMBI.appErrorMessage;
    var withSubmitLock = PMBI.withSubmitLock;
    var escapeHtml = PMBI.escapeHtml;
    var formatDisplayDate = PMBI.formatDisplayDate;
    var api = PMBI.api;
    var money = PMBI.money;
    var percent = PMBI.percent;
    var canonicalEstimateSectionTitle = PMBI.canonicalEstimateSectionTitle;
    var canonicalEstimateSectionId = PMBI.canonicalEstimateSectionId;
    var progressSelectorValue = PMBI.progressSelectorValue;
    var updateProjectProgressState = PMBI.updateProjectProgressState;
    var updateProgressNode = PMBI.updateProgressNode;
    var updateUIProgress = PMBI.updateUIProgress;
    var isoDateAdd = PMBI.isoDateAdd;
    var hasRole = PMBI.hasRole;
    var canManageSchedule = PMBI.canManageSchedule;
    var canManageSuppliers = PMBI.canManageSuppliers;
    var canViewProcurementPrices = PMBI.canViewProcurementPrices;
    var isMainAdminRole = PMBI.isMainAdminRole;

    function appCall(name, args) {
        var fn = PMBI.app && PMBI.app[name];
        if (typeof fn !== 'function') {
            throw new Error('PMBI.app.' + name + ' is not available');
        }
        return fn.apply(null, args);
    }
    function updateProjectInState() { return appCall('updateProjectInState', arguments); }
    function openProject() { return appCall('openProject', arguments); }
    function activateProjectTab() { return appCall('activateProjectTab', arguments); }
    function isCompletedProject() { return appCall('isCompletedProject', arguments); }
    function statusLabel() { return appCall('statusLabel', arguments); }
    function stageStatusClass() { return appCall('stageStatusClass', arguments); }
    function isStageOverdue() { return appCall('isStageOverdue', arguments); }
    function isStageBehindPlan() { return appCall('isStageBehindPlan', arguments); }
    function daysBetween() { return appCall('daysBetween', arguments); }
    function signedDaysBetween() { return appCall('signedDaysBetween', arguments); }
    function stat() { return appCall('stat', arguments); }
    function renderStages() { return appCall('renderStages', arguments); }
    function renderTaskCreateModal() { return appCall('renderTaskCreateModal', arguments); }
    function normalizeTaskTitle() { return appCall('normalizeTaskTitle', arguments); }
    function loadProjectNotifications() { return appCall('loadProjectNotifications', arguments); }
    function loadMaterials() { return appCall('loadMaterials', arguments); }
    function loadWarehouseMatches() { return appCall('loadWarehouseMatches', arguments); }
    function loadMaterialInsights() { return appCall('loadMaterialInsights', arguments); }
    function loadTasks() { return appCall('loadTasks', arguments); }
    function loadStages() { return appCall('loadStages', arguments); }
    function renderMaterialsPanel() { return appCall('renderMaterialsPanel', arguments); }
    function renderWorksPanel() { return appCall('renderWorksPanel', arguments); }
    function renderProjectMaterialsTab() { return appCall('renderProjectMaterialsTab', arguments); }
    function renderProjectWorksTab() { return appCall('renderProjectWorksTab', arguments); }
    function rerenderProjectMarketTab() { return appCall('rerenderProjectMarketTab', arguments); }
    function refreshCounterpartyProjectViews() { return appCall('refreshCounterpartyProjectViews', arguments); }
    function bindProjectMarketToggles() { return appCall('bindProjectMarketToggles', arguments); }
    function getProjectTabMode() { return appCall('getProjectTabMode', arguments); }
    function setProjectTabMode() { return appCall('setProjectTabMode', arguments); }
    function loadProjectMarketAnalysis() { return appCall('loadProjectMarketAnalysis', arguments); }
    function renderProjectMarketBlock() { return appCall('renderProjectMarketBlock', arguments); }
    function buildStageLookup() { return appCall('buildStageLookup', arguments); }
    function rootSectionTitleForStage() { return appCall('rootSectionTitleForStage', arguments); }
    function bindActualQuantityInputs() { return appCall('bindActualQuantityInputs', arguments); }
    function installActualQuantityDelegates() { return appCall('installActualQuantityDelegates', arguments); }
    function renderMaterialManualCheck() { return appCall('renderMaterialManualCheck', arguments); }
    function renderWorkManualCheck() { return appCall('renderWorkManualCheck', arguments); }
    function renderBulkSectionCheckbox() { return appCall('renderBulkSectionCheckbox', arguments); }
    function finalSectionWorkDigest() { return appCall('finalSectionWorkDigest', arguments); }
    function finalGraphDate() { return appCall('finalGraphDate', arguments); }
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
    function quantityPlanInfo() { return appCall('quantityPlanInfo', arguments); }
    function quantityText() { return appCall('quantityText', arguments); }
    function isMaterialDone() { return appCall('isMaterialDone', arguments); }
    function setMaterialManualActualQty() { return appCall('setMaterialManualActualQty', arguments); }
    function setWorkActualQty() { return appCall('setWorkActualQty', arguments); }
    function effectiveMaterialFromReports() { return appCall('effectiveMaterialFromReports', arguments); }
    function reportWorkDoneQty() { return appCall('reportWorkDoneQty', arguments); }
    function materialEffectiveForProgress() { return appCall('materialEffectiveForProgress', arguments); }
    function materialActualProgress() { return appCall('materialActualProgress', arguments); }
    function workActualProgress() { return appCall('workActualProgress', arguments); }
    function actualQuantityInputItem() { return appCall('actualQuantityInputItem', arguments); }
    function saveActualQuantityInput() { return appCall('saveActualQuantityInput', arguments); }
    function saveManualQuantityCheckbox() { return appCall('saveManualQuantityCheckbox', arguments); }
    function rerenderProjectMaterialAndWorkViews() { return appCall('rerenderProjectMaterialAndWorkViews', arguments); }
    function refreshSelectedProjectProgressViews() { return appCall('refreshSelectedProjectProgressViews', arguments); }
    function bindProjectChainActions() { return appCall('bindProjectChainActions', arguments); }
    function openWorkQuantityDialog() { return appCall('openWorkQuantityDialog', arguments); }
    function renderProjectCritical() { return appCall('renderProjectCritical', arguments); }
    function planningStatusClass() { return appCall('planningStatusClass', arguments); }
    function marketStatusLabel() { return appCall('marketStatusLabel', arguments); }
    function missingQty() { return appCall('missingQty', arguments); }
    function missingWorkQty() { return appCall('missingWorkQty', arguments); }
    function scheduleDate() { return appCall('scheduleDate', arguments); }
    function renderProjectMeta() { return appCall('renderProjectMeta', arguments); }
    function renderProjectDocuments() { return appCall('renderProjectDocuments', arguments); }
    function renderParticipants() { return appCall('renderParticipants', arguments); }
    function renderCounterparties() { return appCall('renderCounterparties', arguments); }
    function renderEquipmentPanel() { return appCall('renderEquipmentPanel', arguments); }
    function renderDocumentsPanel() { return appCall('renderDocumentsPanel', arguments); }
    function renderFinancePanel() { return appCall('renderFinancePanel', arguments); }
    function renderTasks() { return appCall('renderTasks', arguments); }
    function renderTaskFilters() { return appCall('renderTaskFilters', arguments); }
    function bindTaskEvents() { return appCall('bindTaskEvents', arguments); }
    function bindProjectSearch() { return appCall('bindProjectSearch', arguments); }
    function renderDashboard() { return appCall('renderDashboard', arguments); }
    function renderProjectShell() { return appCall('renderProjectShell', arguments); }
    function renderProjectHeader() { return appCall('renderProjectHeader', arguments); }
    function renderProjectTabs() { return appCall('renderProjectTabs', arguments); }
    function selectedProject() { return appCall('selectedProject', arguments); }
    function setSelectedProject() { return appCall('setSelectedProject', arguments); }
    function updateProjectCache() { return appCall('updateProjectCache', arguments); }
    function renderProjectHub() { return appCall('renderProjectHub', arguments); }
    function renderProjectOverviewHero() { return appCall('renderProjectOverviewHero', arguments); }
    function renderEstimateWorkRow() { return appCall('renderEstimateWorkRow', arguments); }
    function renderProjectReportForm() { return appCall('renderProjectReportForm', arguments); }
    function renderLogsDayView() { return appCall('renderLogsDayView', arguments); }
    // schedule state helpers
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

    // schedule panel and autoplan drawer
    function renderAutoScheduleDrawer(project) {
        if (!project || !canManageSchedule()) return '';
        var startDate = project.started_at || APP_TODAY;
        return '<div class="drawer-overlay auto-schedule-overlay" data-auto-schedule-overlay aria-hidden="true"></div>' +
            '<div class="drawer-panel auto-schedule-drawer" data-auto-schedule-drawer aria-hidden="true">' +
                '<button class="drawer-close" type="button" data-auto-schedule-close aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c">\u00d7</button>' +
                '<div class="drawer-head"><h3>\u0410\u0432\u0442\u043e\u043f\u043b\u0430\u043d \u0433\u0440\u0430\u0444\u0438\u043a\u0430</h3><p>\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442 \u0434\u0430\u0442\u044b \u044d\u0442\u0430\u043f\u043e\u0432 \u0438\u0437 \u0441\u043c\u0435\u0442\u044b \u0438 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u044b \u043e\u0431\u044a\u0435\u043a\u0442\u0430.</p></div>' +
                '<form class="schedule-planner-form" data-auto-schedule-form data-project-id="' + project.id + '">' +
                    '<label><span>\u0421\u0442\u0430\u0440\u0442 \u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f</span><input name="start_date" type="date" value="' + escapeHtml(startDate) + '"></label>' +
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

    function estimateSourceIdentity(value) {
        value = value || {};
        var id = Number(value.estimateSourceId || value.estimate_source_id || 0);
        if (id) return 'id:' + String(id);
        var key = String(value.estimateSourceKey || value.estimate_source_key || '').trim();
        if (key) return 'key:' + key;
        return 'legacy';
    }

    function estimateSourceMeta(value) {
        value = value || {};
        return {
            key: estimateSourceIdentity(value),
            id: Number(value.estimateSourceId || value.estimate_source_id || 0) || null,
            type: String(value.estimateSourceType || value.estimate_source_type || 'legacy').toLowerCase(),
            title: String(value.estimateTitle || value.estimate_title || 'Ранее загруженная смета').trim() || 'Ранее загруженная смета',
            fileName: String(value.estimateFileName || value.estimate_file_name || 'Смета объекта').trim() || 'Смета объекта',
            tenderId: String(value.estimateTenderId || value.estimate_tender_id || '').trim(),
            externalId: String(value.estimateSourceExternalId || value.estimate_source_external_id || '').trim()
        };
    }

    function renderScheduleEstimateHeading(meta, sections) {
        var itemCount = (sections || []).reduce(function (sum, section) {
            return sum + liveScheduleSectionItems(section).length;
        }, 0);
        var sourceLabel = meta.type === 'tender' && meta.tenderId
            ? ('Тендер № ' + meta.tenderId)
            : (meta.type === 'legacy' ? 'Исходная смета объекта' : 'Смета');
        return '<header class="project-estimate-file-head">' +
            '<span class="project-estimate-file-icon" aria-hidden="true"><i data-lucide="file-spreadsheet"></i></span>' +
            '<div class="project-estimate-file-copy"><small>' + escapeHtml(sourceLabel) + '</small><h3>' + escapeHtml(meta.title) + '</h3>' +
                '<span title="' + escapeHtml(meta.fileName) + '">' + escapeHtml(meta.fileName) + '</span></div>' +
            '<div class="project-estimate-file-stats"><span>' + escapeHtml(String((sections || []).length)) + ' разд.</span><strong>' + escapeHtml(String(itemCount)) + ' работ</strong></div>' +
        '</header>';
    }

    function renderWorkProgressStrip(workProgress, sectionId) {
        workProgress = workProgress || { total: 0, done: 0, percent: 0 };
        var total = Number(workProgress.total || 0);
        var done = Number(workProgress.done || 0);
        var percentValue = total ? percent(workProgress.percent != null ? workProgress.percent : Math.round((done / total) * 100)) : 0;
        var normalizedSectionId = canonicalEstimateSectionId(sectionId);
        return '<div class="estimate-section-progress-strip estimate-section-progress-split estimate-section-progress-work-only" data-progress-split-section="' + escapeHtml(normalizedSectionId) + '">' +
            '<div class="estimate-section-progress-line estimate-section-progress-line-work" data-progress-section-id="' + escapeHtml(normalizedSectionId) + '" data-section-progress="' + escapeHtml(normalizedSectionId) + '" data-section-progress-kind="work" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percentValue + '">' +
                '<div class="estimate-section-progress-line-head"><strong>Работы</strong><span data-progress-count>' + escapeHtml(total ? (String(done) + ' из ' + String(total)) : 'Позиций нет') + '</span></div>' +
                '<div class="section-schedule-progress-bar"><span style="width:' + percentValue + '%"></span>' + (total ? '<b class="section-schedule-progress-value" data-progress-text>' + escapeHtml(String(percentValue)) + '%</b>' : '') + '</div>' +
            '</div>' +
        '</div>';
    }

    function workCompletionTone(actual, total) {
        var normalizedTotal = Number(total);
        if (!Number.isFinite(normalizedTotal) || normalizedTotal <= 0) return 'neutral';
        var normalizedActual = Number(actual);
        if (!Number.isFinite(normalizedActual)) normalizedActual = 0;
        var ratio = (Math.min(Math.max(0, normalizedActual), normalizedTotal) / normalizedTotal) * 100;
        if (ratio >= 60) return 'green';
        if (ratio > 40) return 'yellow';
        if (ratio > 20) return 'orange';
        return 'red';
    }

    function renderWorkRegisterQuantity(className, label, icon, tone, value, unit) {
        var numericValue = Number(value);
        var isValid = Number.isFinite(numericValue);
        var normalizedValue = isValid ? Math.max(0, numericValue) : 0;
        var formattedValue = isValid ? quantityText(normalizedValue) : '';
        var formattedUnit = String(unit || '').trim();
        var hasValue = isValid && (normalizedValue > 0 || tone === 'actual');
        var accessibleAmount = isValid
            ? formattedValue + (formattedUnit ? ' ' + formattedUnit : '')
            : 'нет данных';
        var visibleValue = hasValue
            ? escapeHtml(formattedValue) + (formattedUnit ? ' <small>' + escapeHtml(formattedUnit) + '</small>' : '')
            : '<span aria-hidden="true">—</span><span class="visually-hidden">' + escapeHtml(accessibleAmount) + '</span>';
        return '<span class="' + escapeHtml(className) + ' section-work-register-quantity is-' + escapeHtml(tone) + '" data-label="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label + ': ' + accessibleAmount) + '">' +
            '<small class="section-work-register-quantity-label"><i data-lucide="' + escapeHtml(icon) + '" aria-hidden="true"></i>' + escapeHtml(label) + '</small>' +
            '<strong class="section-work-register-quantity-value' + (hasValue ? '' : ' is-empty') + '">' + visibleValue + '</strong>' +
        '</span>';
    }

    function renderSectionScheduleRow(project, section) {
        section = section || {};
        var sectionTitle = canonicalEstimateSectionTitle(section.title || '');
        var items = Array.isArray(section.items) ? section.items : [];
        var allWorkItems = liveScheduleSectionItems(section);
        if (items.length !== allWorkItems.length && window.console) {
            console.log('Бэкенд прислал для раздела всего позиций:', items.length, section.title || '');
            items.forEach(function (item) {
                if (!item || !String(item.title || '').trim()) console.warn('Элемент пропущен: нет названия', item);
                if (item && (item.is_deleted || item.isDeleted)) console.warn('Элемент пропущен: удален', item);
            });
            console.log('Физически будет отрисовано позиций:', allWorkItems.length, section.title || '');
        }
        var visibleItems = allWorkItems;
        var canEditWorkActual = !!(canManageSchedule && canManageSchedule());
        var workProgress = workProgressForRows(project.id, sectionTitle, allWorkItems);
        var progress = workProgress;
        var allStages = state.stagesByProject[project.id] || [];
        var stageMap = buildStageLookup(allStages);
        var includeProjectStages = String(section.estimateSourceType || 'legacy').toLowerCase() === 'legacy';
        var stageDetails = allStages.filter(function (stage) {
            if (!includeProjectStages) return false;
            if (String(stage && stage.stage_kind || '') === 'section') return false;
            return canonicalEstimateSectionTitle(rootSectionTitleForStage(stage, stageMap)) === sectionTitle;
        }).map(function (stage) {
            return '<div class="section-work-check schedule-work-duration-row is-stage" data-stage-id="' + escapeHtml(stage.id || '') + '" data-section-title="' + escapeHtml(sectionTitle) + '"><div class="schedule-work-check-main">' +
                '<span class="section-work-stage-icon" aria-hidden="true"><i data-lucide="milestone"></i></span>' +
                '<span class="section-work-check-copy"><b>' + escapeHtml(stage.title || 'Этап') + '</b></span>' +
                '<span class="section-work-register-volume"><small>Ответственный</small><strong>' + escapeHtml(stage.responsible || 'Не назначен') + '</strong></span>' +
                '<span class="section-work-register-actual"><small>Прогресс</small><strong>' + percent(stage.progress) + '%</strong></span>' +
                '<span class="section-work-register-status"><small>Статус</small><strong>' + escapeHtml(statusLabel(stage.status_code)) + '</strong></span>' +
            '</div></div>';
        }).join('');
        var estimateWorkDetails = visibleItems.map(function (item) {
            var actualProgress = workActualProgress(project.id, sectionTitle, item);
            var workTone = workCompletionTone(actualProgress.actual, actualProgress.total);
            var workDone = actualProgress.total > 0
                ? actualProgress.actual >= actualProgress.total
                : isScheduleWorkDone(project.id, sectionTitle, item);
            var workPartial = !workDone && actualProgress.actual > 0;
            var workPercent = actualProgress.total > 0 ? Math.round((actualProgress.actual / actualProgress.total) * 100) : 0;
            var workStatus = workDone ? 'Выполнено' : (workPartial ? 'В работе · ' + String(workPercent) + '%' : 'В плане');
            var editUnit = item.sourceUnit || item.unit || '';
            var editQty = item.sourcePlannedQty != null ? item.sourcePlannedQty : (item.planned_qty != null ? item.planned_qty : item.plannedQty || '');
            var scheduleAutoDays = Number(item.autoDays || 0);
            var scheduleDurationDays = Number(item.durationDays || scheduleAutoDays || 0);
            var factAriaLabel = 'Внести выполненный объём: ' + String(item.title || 'Работа') + '. По смете ' + quantityText(actualProgress.total) + ' ' + String(actualProgress.unit || 'ед.') + ', сделано ' + quantityText(actualProgress.actual) + ' ' + String(actualProgress.unit || 'ед.');
            var quantityInteraction = canEditWorkActual
                ? ' data-work-quantity-open role="button" tabindex="0" aria-label="' + escapeHtml(factAriaLabel) + '" title="Нажмите — внести выполненный объём; правый клик — редактировать позицию"'
                : '';
            return '<div class="section-work-check schedule-work-duration-row' + (canEditWorkActual ? ' work-quantity-row' : '') + ' is-progress-' + escapeHtml(workTone) + (workDone ? ' is-done' : (workPartial ? ' is-partial' : '')) + '" data-item-id="' + escapeHtml(item.id || '') + '" data-work-row data-work-id="' + escapeHtml(item.id || '') + '" data-work-title="' + escapeHtml(item.title || '') + '" data-work-unit="' + escapeHtml(editUnit) + '" data-work-qty="' + escapeHtml(String(editQty)) + '" data-project-id="' + escapeHtml(project.id) + '" data-section-title="' + escapeHtml(sectionTitle) + '" data-position-editor data-position-kind="work" data-position-id="' + escapeHtml(item.id || '') + '" data-position-project="' + escapeHtml(project.id) + '" data-position-title="' + escapeHtml(item.title || '') + '" data-position-unit="' + escapeHtml(editUnit) + '" data-position-qty="' + escapeHtml(String(editQty)) + '" data-position-section="' + escapeHtml(sectionTitle) + '" data-position-auto-days="' + escapeHtml(scheduleAutoDays > 0 ? String(scheduleAutoDays) : '') + '" data-position-duration-days="' + escapeHtml(scheduleDurationDays > 0 ? String(scheduleDurationDays) : '') + '" data-position-duration-overridden="' + (item.isDurationOverridden ? '1' : '0') + '"' + quantityInteraction + '>' +
                '<div class="schedule-work-check-main"><span class="section-work-row-icon" aria-hidden="true"><i data-lucide="hard-hat"></i></span>' +
                    '<span class="section-work-check-copy"><b>' + escapeHtml(item.title || '\u0420\u0430\u0431\u043e\u0442\u0430') + '</b></span>' +
                    renderWorkRegisterQuantity('section-work-register-volume', 'По смете', 'ruler', 'plan', actualProgress.total, actualProgress.unit) +
                    renderWorkRegisterQuantity('section-work-register-actual', 'Сделано', 'badge-check', 'actual', actualProgress.actual, actualProgress.unit) +
                    '<span class="section-work-register-status"><small>Статус</small><strong class="section-work-register-status-value">' + escapeHtml(workStatus) + '</strong></span></div>' +
            '</div>';
        }).join('');
        var workDetails = stageDetails + estimateWorkDetails;
        if (!workDetails) workDetails = '<div class="section-schedule-empty inline">Работ в разделе пока нет.</div>';
        var details = '<div class="section-schedule-detail-grid is-work-only">' +
            '<section class="section-schedule-detail-column"><span class="visually-hidden">\u0420\u0430\u0431\u043e\u0442\u044b</span><div class="section-schedule-detail-list">' + workDetails + '</div></section>' +
        '</div>';
        var sectionStateLabel = workProgress.total && workProgress.percent >= 100 ? 'Выполнено' : (workProgress.percent > 0 ? 'В работе' : 'В плане');
        var sectionStateClass = workProgress.total && workProgress.percent >= 100 ? 'success' : (workProgress.percent > 0 ? 'warn' : 'neutral');
        return '<article class="section-schedule-card section-work-register-section' + finalSectionScheduleCardClass(section) + (progress.percent >= 100 && progress.total ? ' is-done' : '') + '" data-section-title="' + escapeHtml(sectionTitle) + '">' +
            '<div class="section-work-section-row">' +
                '<div class="section-schedule-title"><small>Раздел</small><div class="section-work-section-title-line"><span class="section-work-section-icon" aria-hidden="true"><i data-lucide="layers-3"></i></span><h4>' + escapeHtml(sectionTitle) + '</h4></div></div>' +
                '<div class="section-work-section-meta"><span class="section-work-section-volume"><small>Выполнено</small><strong>' + escapeHtml(String(workProgress.done) + ' из ' + String(workProgress.total)) + '</strong></span>' +
                '<span class="section-work-section-status"><small>Статус</small><span class="badge ' + sectionStateClass + '">' + sectionStateLabel + ' · ' + escapeHtml(String(workProgress.percent || 0)) + '%</span></span></div>' +
            '</div>' +
            '<div class="section-work-register-body">' + details + '</div>' +
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
        var overallProgress = projectScheduleProgress(project, summary);
        var estimateGroups = {};
        var estimateOrder = [];
        sections.forEach(function (section) {
            var meta = estimateSourceMeta(section);
            if (!estimateGroups[meta.key]) {
                estimateGroups[meta.key] = { meta: meta, sections: [] };
                estimateOrder.push(meta.key);
            }
            estimateGroups[meta.key].sections.push(section);
        });
        var groupedSections = estimateOrder.map(function (key) {
            var group = estimateGroups[key];
            return '<section class="project-estimate-file-group" data-estimate-source="' + escapeHtml(key) + '">' +
                renderScheduleEstimateHeading(group.meta, group.sections) +
                '<div class="section-work-register-head section-work-register-master-head" aria-hidden="true"><span></span><span class="section-work-register-head-label"><i data-lucide="hammer"></i>Работа</span><span class="section-work-register-head-label is-plan"><i data-lucide="ruler"></i>По смете</span><span class="section-work-register-head-label is-actual"><i data-lucide="badge-check"></i>Сделано</span><span class="section-work-register-head-label is-status"><i data-lucide="circle-check"></i>Статус</span></div>' +
                '<div class="section-schedule-list">' + group.sections.map(function (section) { return renderSectionScheduleRow(project, section); }).join('') + '</div>' +
            '</section>';
        }).join('');
        return '<section class="card section-schedule-board">' +
            '<div class="works-register-summary" aria-label="Сводка по работам">' +
                '<div class="works-register-summary-item"><span>Разделов</span><strong>' + escapeHtml(String(sections.length)) + '</strong></div>' +
                '<div class="works-register-summary-item"><span>Работ</span><strong>' + escapeHtml(String(overallProgress.total || 0)) + '</strong></div>' +
                '<div class="works-register-summary-item"><span>Выполнено</span><strong>' + escapeHtml(String(overallProgress.done || 0)) + '</strong></div>' +
                '<div class="works-register-summary-item"><span>Готовность</span><strong>' + escapeHtml(String(overallProgress.percent || 0)) + '%</strong></div>' +
            '</div>' +
            renderPinnedScheduleBrief(project, summary, sections) +
            '<div class="project-estimate-file-list">' + groupedSections + '</div></section>';
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
                    rerenderSelectedProjectSchedulePanel(projectId, false);
                    refreshMaterialScheduleProject(projectId, true);
                }, true);
            });
        });
        bindSectionScheduleInteractions(projectId);
        bindActualQuantityInputs(projectId);
    }

    function projectScheduleViewMode(projectId) {
        if (hasRole('customer')) return 'list';
        var mode = getProjectTabMode(projectId, 'schedule');
        return mode === 'market' || mode === 'table' ? mode : 'list';
    }

    function renderProjectScheduleViewSwitcher(project) {
        if (hasRole('customer')) {
            return '<div class="project-schedule-view-switcher market-toolbar"><div><h3>\u0420\u0430\u0431\u043e\u0442\u044b</h3><p>\u0420\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u0440\u0430\u0437\u0434\u0435\u043b\u0430\u043c \u0441\u043c\u0435\u0442\u044b \u0441 \u0444\u0430\u043a\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u043c \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u043e\u043c.</p></div></div>';
        }
        var mode = projectScheduleViewMode(project.id);
        var marketLabel = 'Анализ рынка';
        var heading = mode === 'list' ? 'Работы' : 'Материалы и работы';
        var description = mode === 'list'
            ? 'Работы по разделам сметы с фактическим прогрессом.'
            : (mode === 'table'
                ? 'Сводная смета материалов и работ с объёмом, ценой за единицу и общей стоимостью.'
                : (canViewProcurementPrices()
                    ? 'Цены, предложения, поставщики и подрядчики по позициям сметы.'
                    : 'Позиции сметы и поле для вашего ценового предложения.'));
        return '<div class="project-schedule-view-switcher market-toolbar">' +
            '<div><h3>' + heading + '</h3><p>' + description + '</p></div>' +
            '<div class="segmented compact" data-project-schedule-switcher>' +
                '<button type="button" class="' + (mode === 'list' ? 'active' : '') + '" data-project-schedule-mode="list">По разделам</button>' +
                '<button type="button" class="' + (mode === 'market' ? 'active' : '') + '" data-project-schedule-mode="market">' + marketLabel + '</button>' +
                '<button type="button" class="' + (mode === 'table' ? 'active' : '') + '" data-project-schedule-mode="table"><i data-lucide="table-2" aria-hidden="true"></i><span>Табличный вид</span></button>' +
            '</div>' +
        '</div>';
    }

    function renderProjectScheduleMarketAnalysis(project) {
        return '<div class="project-market-analysis-grid">' +
            '<section class="project-market-analysis-section"><div class="card-head"><div><span class="section-label">Материалы</span><h3>Рыночные цены материалов</h3></div></div>' + renderProjectMarketBlock(project.id, 'material') + '</section>' +
            '<section class="project-market-analysis-section"><div class="card-head"><div><span class="section-label">Работы</span><h3>Рыночные цены работ</h3></div></div>' + renderProjectMarketBlock(project.id, 'work') + '</section>' +
        '</div>';
    }

    function projectPriceTableEstimateRows(projectId, kind) {
        var isWork = kind === 'work';
        var result = [];
        var seen = {};
        function add(item, fallbackSection) {
            if (!item || item.is_deleted || item.isDeleted || !String(item.title || '').trim()) return;
            var itemKind = String(item.itemKind || item.item_kind || 'material').toLowerCase();
            if ((itemKind === 'work') !== isWork) return;
            var id = Number(item.estimateItemId || item.id || 0);
            var key = id ? ('id:' + id) : ('title:' + String(item.title || '').trim().toLocaleLowerCase('ru'));
            if (seen[key]) return;
            seen[key] = true;
            var plannedPrice = item.plannedPrice;
            if (plannedPrice == null) plannedPrice = item.planned_price;
            var plan = quantityPlanInfo(item);
            var multiplier = Number(item.unitMultiplier || plan.multiplier || 1);
            var sourceQty = Number(item.sourcePlannedQty != null ? item.sourcePlannedQty : plan.sourceQty || 0);
            var legacyAlreadyMultiplied = multiplier >= 100 && sourceQty >= multiplier;
            var priceDivisor = legacyAlreadyMultiplied ? 1 : Math.max(1, multiplier);
            var unitPrice = plannedPrice == null || plannedPrice === '' ? null : Number(plannedPrice) / priceDivisor;
            var totalPrice = unitPrice == null || !isFinite(unitPrice) ? null : Number(plan.totalQty || 0) * unitPrice;
            result.push({
                estimateItemId: id || '',
                title: String(item.title || ''),
                sectionTitle: String(item.sectionTitle || item.section_title || item.stageTitle || fallbackSection || ''),
                unit: String(plan.unit || item.unit || 'ед.'),
                plannedQty: Number(plan.totalQty || 0),
                estimateUnitPrice: unitPrice,
                estimateTotal: totalPrice,
                sourceItem: item
            });
        }
        (state.materialsByProject && (state.materialsByProject[projectId] || state.materialsByProject[String(projectId)]) || []).forEach(function (item) {
            add(item, '');
        });
        if (isWork) {
            var summary = state.sectionScheduleByProject && (state.sectionScheduleByProject[projectId] || state.sectionScheduleByProject[String(projectId)]);
            (Array.isArray(summary && summary.sections) ? summary.sections : []).forEach(function (section) {
                liveScheduleSectionItems(section).forEach(function (item) {
                    add(Object.assign({}, item, { itemKind: 'work' }), section.title || section.sectionId || '');
                });
            });
        }
        return result;
    }

    function projectPriceTableRowsWithMarket(projectId, kind, estimateRows) {
        var projectCache = state.marketAnalysisByProject && (state.marketAnalysisByProject[projectId] || state.marketAnalysisByProject[String(projectId)]);
        var marketRows = Array.isArray(projectCache && projectCache[kind] && projectCache[kind].rows)
            ? projectCache[kind].rows
            : [];
        var marketById = {};
        var marketByTitle = {};
        marketRows.forEach(function (row) {
            var id = Number(row && row.estimateItemId || 0);
            if (id) marketById[id] = row;
            var titleKey = String(row && row.title || '').trim().toLocaleLowerCase('ru');
            if (titleKey && !marketByTitle[titleKey]) marketByTitle[titleKey] = row;
        });
        return estimateRows.map(function (estimateRow) {
            var id = Number(estimateRow.estimateItemId || 0);
            var titleKey = String(estimateRow.title || '').trim().toLocaleLowerCase('ru');
            var marketRow = (id && marketById[id]) || marketByTitle[titleKey] || {};
            return Object.assign({}, estimateRow, {
                marketPrice: marketRow.marketPrice,
                marketPriceIsStale: marketRow.marketPriceIsStale === true,
                enteredPrice: marketRow.enteredPrice,
                activeOffer: marketRow.activeOffer || null
            });
        });
    }

    function projectPriceTableSectionGroups(rows) {
        var groups = {};
        var order = [];
        (rows || []).forEach(function (row) {
            var title = canonicalEstimateSectionTitle(row && row.sectionTitle || 'Без раздела');
            var key = canonicalEstimateSectionId(title);
            if (!groups[key]) {
                groups[key] = { title: title, rows: [] };
                order.push(key);
            }
            groups[key].rows.push(row);
        });
        return order.map(function (key) { return groups[key]; });
    }

    function projectPriceTableKind(projectId) {
        state.projectPriceTableKindByProject = state.projectPriceTableKindByProject || {};
        return state.projectPriceTableKindByProject[projectId] === 'work' ? 'work' : 'material';
    }

    function setProjectPriceTableKind(projectId, kind) {
        state.projectPriceTableKindByProject = state.projectPriceTableKindByProject || {};
        state.projectPriceTableKindByProject[projectId] = kind === 'work' ? 'work' : 'material';
    }

    function projectPriceTableMoney(value, missingLabel) {
        if (value == null || value === '' || !isFinite(Number(value))) {
            return '<span class="project-price-table-missing">—</span>' + (missingLabel ? '<small>' + escapeHtml(missingLabel) + '</small>' : '');
        }
        return '<strong>' + escapeHtml(money(Number(value))) + '</strong>';
    }

    function projectPriceTableMarketCell(row) {
        var value = projectPriceTableMoney(row && row.marketPrice, '');
        if (!row || row.marketPrice == null || row.marketPrice === '') return value;
        return value + '<small>' + (row.marketPriceIsStale ? 'Сохранённый снимок' : 'AutoBot') + '</small>';
    }

    function projectPriceTablePurchaserCell(row) {
        var value = projectPriceTableMoney(row && row.enteredPrice, '');
        if (!row || row.enteredPrice == null || row.enteredPrice === '') return value;
        var offer = row.activeOffer || {};
        return value + (offer.candidateName ? '<small>' + escapeHtml(offer.candidateName) + '</small>' : '');
    }

    function renderProjectEstimateTable(projectId, kind) {
        var isWork = kind === 'work';
        var noun = isWork ? 'Работы' : 'Материалы';
        var itemLabel = isWork ? 'Работа' : 'Материал';
        var counterpartyPriceLabel = isWork ? 'Цена подрядчика' : 'Цена закупщика';
        var canEdit = canManageSchedule();
        var columnCount = canEdit ? 7 : 6;
        var rows = projectPriceTableRowsWithMarket(projectId, kind, projectPriceTableEstimateRows(projectId, kind));
        var sectionGroups = projectPriceTableSectionGroups(rows);
        var body = '';
        var estimateItems = state.materialsByProject && (state.materialsByProject[projectId] || state.materialsByProject[String(projectId)]);
        if (!rows.length && !Array.isArray(estimateItems)) {
            body = skeletonMarkup('table', 1);
        } else if (!rows.length) {
            body = '<div class="project-price-table-state"><i data-lucide="inbox" aria-hidden="true"></i><span>В смете пока нет ' + (isWork ? 'работ' : 'материалов') + '.</span></div>';
        } else {
            body = (!canViewProcurementPrices()
                ? '<div class="project-price-table-access"><i data-lucide="lock-keyhole" aria-hidden="true"></i><span>Сметные цены доступны директору и администратору.</span></div>'
                : '') +
                '<div class="project-price-table-scroll"><table class="project-price-table">' +
                    '<thead><tr>' +
                        '<th>' + itemLabel + '</th>' +
                        '<th>Объём</th>' +
                        '<th>Цена за ед.</th>' +
                        '<th>Цена общая</th>' +
                        '<th><span>Цена ИИ</span><small>анализ рынка</small></th>' +
                        '<th>' + counterpartyPriceLabel + '</th>' +
                        (canEdit ? '<th>Действие</th>' : '') +
                    '</tr></thead>' +
                    '<tbody>' + sectionGroups.map(function (group) {
                        return '<tr class="project-price-table-section-row"><td colspan="' + columnCount + '"><span><b>' + escapeHtml(group.title) + '</b><small>' + group.rows.length + ' поз.</small></span></td></tr>' +
                            group.rows.map(function (row) {
                                var volume = quantityText(row.plannedQty || 0) + ' ' + String(row.unit || 'ед.');
                                var source = row.sourceItem || {};
                                var editable = canEdit && Number(row.estimateItemId || 0) > 0;
                                var sourceKind = String(source.itemKind || source.item_kind || kind).toLowerCase() === 'work' ? 'work' : 'material';
                                var sourceUnit = source.sourceUnit || source.unit || row.unit || '';
                                var sourceQty = source.sourcePlannedQty != null ? source.sourcePlannedQty : (source.planned_qty != null ? source.planned_qty : source.plannedQty);
                                var sourcePrice = source.planned_price != null ? source.planned_price : source.plannedPrice;
                                var sourceSection = source.sectionTitle || source.section_title || row.sectionTitle || '';
                                var editorAttrs = editable
                                    ? ' data-position-editor data-position-kind="' + sourceKind + '" data-position-id="' + escapeHtml(row.estimateItemId) + '" data-position-project="' + escapeHtml(projectId) + '" data-position-title="' + escapeHtml(source.title || row.title || '') + '" data-position-unit="' + escapeHtml(sourceUnit) + '" data-position-qty="' + escapeHtml(sourceQty == null ? '' : sourceQty) + '" data-position-price="' + escapeHtml(sourcePrice == null ? '' : sourcePrice) + '" data-position-section="' + escapeHtml(sourceSection) + '"'
                                    : '';
                                return '<tr' + editorAttrs + '>' +
                                    '<td data-label="' + itemLabel + '"><b>' + escapeHtml(row.title || 'Без названия') + '</b></td>' +
                                    '<td data-label="Объём"><strong>' + escapeHtml(volume) + '</strong></td>' +
                                    '<td data-label="Цена за ед.">' + projectPriceTableMoney(row.estimateUnitPrice, 'Не указана') + '</td>' +
                                    '<td data-label="Цена общая">' + projectPriceTableMoney(row.estimateTotal, 'Не рассчитана') + '</td>' +
                                    '<td data-label="Цена ИИ">' + projectPriceTableMarketCell(row) + '</td>' +
                                    '<td data-label="' + counterpartyPriceLabel + '">' + projectPriceTablePurchaserCell(row) + '</td>' +
                                    (canEdit ? '<td data-label="Действие">' + (editable ? '<button class="ghost compact" type="button" data-position-editor-open>Изменить</button>' : '<span class="muted">—</span>') + '</td>' : '') +
                                '</tr>';
                            }).join('');
                    }).join('') + '</tbody>' +
                '</table></div>';
        }
        return '<section class="project-price-table-panel project-price-table-panel-' + kind + '">' +
            '<header class="project-price-table-head"><div><span class="section-label">Смета</span><h3>' + noun + '</h3></div>' +
                '<div class="project-price-table-head-side"><span class="project-price-table-count">' + rows.length + ' поз.</span>' +
                    '<div class="project-price-kind-switcher" role="group" aria-label="Тип позиций сметы">' +
                        '<button type="button" class="' + (!isWork ? 'active' : '') + '" data-project-price-kind="material">Материалы</button>' +
                        '<button type="button" class="' + (isWork ? 'active' : '') + '" data-project-price-kind="work">Работы</button>' +
                    '</div>' +
                '</div>' +
            '</header>' + body +
        '</section>';
    }

    function renderProjectSchedulePriceTables(project) {
        var kind = projectPriceTableKind(project.id);
        return '<div class="project-price-tables" data-project-price-tables>' +
            renderProjectEstimateTable(project.id, kind) +
        '</div>';
    }

    function renderAdditionalProjectStages(stages, project) {
        var summary = project && state.sectionScheduleByProject ? state.sectionScheduleByProject[project.id] : null;
        var scheduled = {};
        (Array.isArray(summary && summary.sections) ? summary.sections : []).forEach(function (section) {
            scheduled[canonicalEstimateSectionTitle(section && (section.title || section.sectionId))] = true;
        });
        var stageMap = buildStageLookup(stages || []);
        var groups = {};
        var order = [];
        (stages || []).filter(function (stage) {
            return String(stage && stage.stage_kind || '') !== 'section';
        }).forEach(function (stage) {
            var title = canonicalEstimateSectionTitle(rootSectionTitleForStage(stage, stageMap));
            if (scheduled[title]) return;
            if (!groups[title]) {
                groups[title] = [];
                order.push(title);
            }
            groups[title].push(stage);
        });
        if (!order.length) return '';
        return '<section class="card section-schedule-board additional-project-stages"><div class="card-head"><div><h3>Дополнительные этапы работ</h3><span class="muted">Этапы объекта, которых пока нет в расчёте по смете.</span></div></div><div class="estimate-section-list">' + order.map(function (title) {
            var rows = groups[title].map(function (stage) {
                var meta = [stage.planned_start && stage.planned_end ? (stage.planned_start + ' - ' + stage.planned_end) : '', stage.responsible || ''].filter(Boolean).join(' • ');
                return '<div class="material-row work-row schedule-stage-row" data-stage-id="' + escapeHtml(stage.id || '') + '" data-section-title="' + escapeHtml(title || '') + '"><div class="work-row-main"><b>' + escapeHtml(stage.title || 'Этап') + '</b><small>' + escapeHtml(meta || 'Этап работ') + '</small></div><div class="work-row-side"><span class="badge ' + stageStatusClass(stage.status_code) + '">' + escapeHtml(statusLabel(stage.status_code)) + ' • ' + percent(stage.progress) + '%</span></div></div>';
            }).join('');
            return '<section class="estimate-section estimate-section-card"><div class="card-head"><h3>' + escapeHtml(title || 'Работы без раздела') + '</h3></div><div class="materials-list">' + rows + '</div></section>';
        }).join('') + '</div></section>';
    }

    function renderSchedulePanel(stages, project) {
        stages = Array.isArray(stages) ? stages : [];
        var switcher = project ? renderProjectScheduleViewSwitcher(project) : '';
        if (project && projectScheduleViewMode(project.id) === 'market') {
            return switcher + renderProjectScheduleMarketAnalysis(project);
        }
        if (project && projectScheduleViewMode(project.id) === 'table') {
            return switcher + renderProjectSchedulePriceTables(project);
        }
        var forecast = renderSectionScheduleForecast(project);
        return switcher + forecast;
    }

    function renderProjectCalendarPanel(project) {
        if (!project || hasRole('customer')) return '';
        return renderAutoScheduleDrawer(project) +
            '<section class="schedule-project-topbar calendar-project-topbar">' +
                '<div class="schedule-project-topbar-copy"><h3>Календарь объекта</h3><span class="muted">Даты работ, закупок и поставок по объекту.</span></div>' +
                (canManageSchedule() ? '<button class="primary schedule-autoplan-button" type="button" data-auto-schedule-open data-project-id="' + escapeHtml(project.id) + '"><i data-lucide="calendar-cog" aria-hidden="true"></i><span>Автоплан графика</span></button>' : '') +
            '</section>' +
            renderMaterialScheduleContainer(project.id);
    }

    function ensureProjectScheduleMarketAnalysis(projectId, force) {
        if (hasRole('customer')) return;
        ['material', 'work'].forEach(function (kind) {
            var cache = state.marketAnalysisByProject && state.marketAnalysisByProject[projectId]
                ? state.marketAnalysisByProject[projectId][kind]
                : null;
            if (!force && cache && (cache.loading || cache.status === 'pending' || cache.status === 'ready' || cache.status === 'restricted' || cache.status === 'error')) return;
            loadProjectMarketAnalysis(projectId, kind, function () {
                if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
                if (projectScheduleViewMode(projectId) !== 'market') return;
                rerenderSelectedProjectSchedulePanel(projectId, false);
            }, !!force);
        });
    }

    function rerenderSelectedProjectSchedulePanel(projectId, loadMarket) {
        var project = state.projects.find(function (item) { return Number(item.id) === Number(projectId); }) || state.selectedProject;
        var panel = qs('[data-panel="schedule"]');
        if (!project || !panel || !state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        safeReplaceChildren(panel, renderSchedulePanel(state.stagesByProject[projectId] || [], project));
        refreshLucideIcons(panel);
        bindAutoScheduleForm(projectId);
        bindScheduleStatusActions(projectId);
        bindSectionScheduleRefresh(projectId);
        bindSectionScheduleInteractions(projectId);
        bindActualQuantityInputs(projectId);
        bindProjectMarketToggles(projectId);
        bindProjectChainActions();
        bindProjectScheduleViews(projectId);
        if (loadMarket !== false && projectScheduleViewMode(projectId) === 'market') ensureProjectScheduleMarketAnalysis(projectId, false);
    }

    function bindProjectPriceTableViewportScroll(panel) {
        var shell = qs('[data-project-price-tables]', panel);
        var scroller = shell && qs('.project-price-table-scroll', shell);
        if (!shell || !scroller || shell.dataset.viewportScrollBound === '1') return;
        shell.dataset.viewportScrollBound = '1';
        shell.addEventListener('wheel', function (event) {
            if (event.ctrlKey || window.matchMedia('(max-width: 720px)').matches) return;
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            var delta = Number(event.deltaY || 0);
            if (event.deltaMode === 1) delta *= 24;
            if (event.deltaMode === 2) delta *= Math.max(1, window.innerHeight);
            if (!delta) return;

            var stickyTop = parseFloat(window.getComputedStyle(shell).top);
            if (!isFinite(stickyTop)) stickyTop = 68;
            var shellTop = shell.getBoundingClientRect().top;
            var tolerance = 2;

            if (delta > 0 && shellTop > stickyTop + tolerance) {
                event.preventDefault();
                var pageStep = Math.min(delta, shellTop - stickyTop);
                window.scrollBy(0, pageStep);
                var tableStep = delta - pageStep;
                if (tableStep > 0) scroller.scrollTop += tableStep;
                return;
            }

            if (shellTop < stickyTop - tolerance) return;
            if (Math.abs(shellTop - stickyTop) > tolerance) return;
            var maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            var nextScrollTop = Math.max(0, Math.min(maxScrollTop, scroller.scrollTop + delta));
            if (Math.abs(nextScrollTop - scroller.scrollTop) < 0.5) return;
            event.preventDefault();
            scroller.scrollTop = nextScrollTop;
        }, { passive: false });
    }

    function bindProjectScheduleViews(projectId) {
        if (hasRole('customer')) return;
        var panel = qs('[data-panel="schedule"]');
        if (!panel) return;
        qsa('[data-project-schedule-mode]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var requestedMode = button.getAttribute('data-project-schedule-mode');
                var mode = requestedMode === 'market' || requestedMode === 'table' ? requestedMode : 'list';
                setProjectTabMode(projectId, 'schedule', mode);
                rerenderSelectedProjectSchedulePanel(projectId, mode === 'market');
            });
        });
        qsa('[data-project-price-kind]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                setProjectPriceTableKind(projectId, button.getAttribute('data-project-price-kind'));
                rerenderSelectedProjectSchedulePanel(projectId, false);
            });
        });
        bindProjectPriceTableViewportScroll(panel);
        if (projectScheduleViewMode(projectId) === 'market') ensureProjectScheduleMarketAnalysis(projectId, false);
    }

    function storeMaterialsWithWarehouseMatches(projectId, items, callback) {
        loadWarehouseMatches(projectId, function (matches) {
            state.materialsByProject[projectId] = (items || []).map(function (item) {
                var match = matches && matches[String(item.id)];
                return match ? Object.assign({}, item, { warehouseMatch: match }) : item;
            });
            if (typeof callback === 'function') callback(state.materialsByProject[projectId]);
        });
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
        if (input && !input.value) input.value = APP_TODAY;
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
            var activeProjectId = form.getAttribute('data-project-id') || form.dataset.projectId || projectId;
            var startInput = form.elements && form.elements.start_date ? form.elements.start_date : form.querySelector('input[name="start_date"]');
            var requestedStart = startInput && startInput.value ? startInput.value : APP_TODAY;
            var autoScheduleStep = 'запрос автоплана';
            withSubmitLock(form, function () {
                return api('/api/projects/' + encodeURIComponent(activeProjectId) + '/auto-schedule', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: requestedStart
                })
            }).then(function (data) {
                autoScheduleStep = 'обновление состояния проекта';
                var updatedProject = Object.assign({ id: activeProjectId }, data.project || {});
                if (data.summary) {
                    if (!data.summary.startDate && data.summary.projectStart) data.summary.startDate = data.summary.projectStart;
                    if (!data.summary.finishDate && data.summary.projectEnd) data.summary.finishDate = data.summary.projectEnd;
                }
                if (data.summary && data.summary.startDate) updatedProject.started_at = data.summary.startDate;
                if (data.summary && data.summary.finishDate) updatedProject.deadline_at = data.summary.finishDate;
                updateProjectInState(updatedProject);
                state.schedulePlanByProject[activeProjectId] = data.summary || null;
                state.sectionScheduleByProject = state.sectionScheduleByProject || {};
                delete state.sectionScheduleByProject[activeProjectId];
                delete state.sectionScheduleByProject[String(activeProjectId)];
                setScheduleBriefPinned(activeProjectId, true);
                state.stagesByProject[activeProjectId] = null;
                state.materialsByProject[activeProjectId] = null;
                if (state.materialScheduleByProject) delete state.materialScheduleByProject[String(activeProjectId)];
                autoScheduleStep = 'загрузка календаря материалов';
                return api('/api/projects/' + encodeURIComponent(activeProjectId) + '/material-schedule?fresh=1').then(function (schedule) {
                    autoScheduleStep = 'обновление календаря на странице';
                    closeAutoScheduleDrawer();
                    setMaterialScheduleForProject(activeProjectId, schedule || { items: [] });
                    try {
                        openProject(activeProjectId);
                        activateProjectTab('calendar');
                        loadMaterialSchedule(activeProjectId, function (freshSchedule) {
                            var details = scheduleProjectDetails(activeProjectId);
                            if (details) {
                                details.materialSchedule = freshSchedule;
                                setScheduleProjectDetails(activeProjectId, details);
                            }
                            refreshScheduleProjectStats(activeProjectId);
                            replaceSelectedProjectMaterialCalendar(activeProjectId);
                            if (window.PMBI && window.PMBI.app && typeof window.PMBI.app.refreshProjectOverview === 'function') {
                                window.PMBI.app.refreshProjectOverview(activeProjectId);
                            }
                        }, true);
                    } catch (renderError) {
                        if (window.console && console.error) console.error('Auto schedule saved, but refresh failed:', renderError);
                        showAppNotice('График пересчитан. Обновите страницу, если календарь не обновился автоматически.', 'warn');
                    }
                });
            }).catch(function (err) {
                var rawMessage = err && err.payload && (err.payload.message || err.payload.error)
                    ? (err.payload.message || err.payload.error)
                    : (err && err.message ? err.message : 'Неизвестная ошибка');
                var statusText = err && err.status ? ('HTTP ' + err.status + ': ') : '';
                var message = 'Автоплан: ' + autoScheduleStep + '. ' + statusText + rawMessage;
                if (window.console && console.error) console.error('Auto schedule failed:', {
                    step: autoScheduleStep,
                    status: err && err.status,
                    payload: err && err.payload,
                    error: err
                });
                if (typeof window.alert === 'function') window.alert(message);
                if (error) {
                    error.textContent = message;
                    error.classList.add('active');
                }
            });
            });
        });
    }

    // legacy schedule page helpers
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

    // schedule procurement board
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

    // section schedule forecast and interactions
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
            var errorCode = err && err.payload && err.payload.error ? String(err.payload.error) : '';
            state.sectionScheduleByProject[projectId] = {
                error: errorCode === 'works_required'
                    ? 'Сначала загрузите смету с работами.'
                    : (errorCode || 'Не удалось рассчитать график по смете'),
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

    function scheduleChecklistStorageKey(projectId) {
        return 'project_schedule_checklist_' + projectId;
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

    function scheduleSectionDays(section) {
        var days = Number(section && (section.estimatedDays || section.durationDays || section.days || 0));
        if (Number.isFinite(days) && days > 0) return Math.round(days * 2) / 2;
        var start = section && section.startDate;
        var end = section && section.endDate;
        var calculated = start && end ? daysBetween(start, end) : 0;
        return Math.max(0, Math.round(Number(calculated || 0)));
    }

    function scheduleSectionDurationLabel(section) {
        return String(scheduleSectionDays(section)) + ' дней';
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
        var storageKey = 'project_schedule_checklist_' + projectId;
        var map = {};
        try { map = JSON.parse(window.localStorage.getItem(storageKey) || '{}') || {}; } catch (e) { map = {}; }
        var plan = quantityPlanInfo(item);
        var keys = scheduleWorkStorageKeys(sectionTitle, item);
        var forcedOpen = keys.some(function (key) {
            var value = map[key];
            return !!(value && typeof value === 'object' && value.open);
        });
        if (forcedOpen) return false;
        if (item && (item.isCompleted || item.is_completed)) return true;
        if (plan.totalQty > 0 && Number(item && (item.actualQty != null ? item.actualQty : item.actual_qty) || 0) >= plan.totalQty) return true;
        return keys.some(function (key) {
            var value = map[key];
            if (value === 1 || value === true) return true;
            if (!value || typeof value !== 'object') return false;
            if (value.completed || value.is_done || value.isDone) return true;
            return plan.totalQty > 0 && Number(value.qty || 0) >= plan.totalQty;
        });
    }

    function setScheduleWorkDone(projectId, sectionTitle, item, isDone) {
        var storageKey = 'project_schedule_checklist_' + projectId;
        var map = {};
        try { map = JSON.parse(window.localStorage.getItem(storageKey) || '{}') || {}; } catch (e) { map = {}; }
        scheduleWorkStorageKeys(sectionTitle, item).forEach(function (key) {
            map[key] = isDone ? 1 : { qty: 0, open: 1 };
        });
        window.localStorage.setItem(storageKey, JSON.stringify(map || {}));
        syncScheduleWorkDoneState(projectId, sectionTitle, item, isDone);
        forceScheduleWorkCheckboxDom(projectId, sectionTitle, item, isDone);
    }

    function scheduleWorkStorageKeys(sectionTitle, item) {
        var keys = [];
        if (item && item.id) keys.push('id|' + String(item.id));
        keys.push(scheduleWorkKey(sectionTitle, item));
        return keys.filter(function (key, index) {
            return key && keys.indexOf(key) === index;
        });
    }

    function syncScheduleWorkDoneState(projectId, sectionTitle, item, isDone) {
        var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[projectId];
        var sections = Array.isArray(summary && summary.sections) ? summary.sections : [];
        var targetKeys = scheduleWorkStorageKeys(sectionTitle, item);
        sections.forEach(function (section) {
            if (canonicalEstimateSectionTitle(section && section.title || '') !== canonicalEstimateSectionTitle(sectionTitle || '')) return;
            liveScheduleSectionItems(section).forEach(function (entry) {
                var entryKeys = scheduleWorkStorageKeys(sectionTitle, entry);
                var sameWork = entryKeys.some(function (key) { return targetKeys.indexOf(key) !== -1; });
                if (!sameWork) return;
                entry.is_done = !!isDone;
                entry.isDone = !!isDone;
                entry.isCompleted = !!isDone;
                entry.completed = !!isDone;
                entry.actualQty = isDone ? quantityPlanInfo(entry).totalQty : 0;
            });
        });
    }

    function forceScheduleWorkCheckboxDom(projectId, sectionTitle, item, isDone) {
        var targetKeys = scheduleWorkStorageKeys(sectionTitle, item);
        qsa('[data-section-work-check][data-project-id="' + String(projectId || '') + '"]').forEach(function (checkbox) {
            var checkboxItem = {
                id: checkbox.getAttribute('data-work-id') || '',
                title: checkbox.getAttribute('data-work-title') || '',
                unit: checkbox.getAttribute('data-work-unit') || '',
                planned_qty: checkbox.getAttribute('data-work-qty') || ''
            };
            var checkboxSectionTitle = checkbox.getAttribute('data-section-title') || '';
            var checkboxKeys = scheduleWorkStorageKeys(checkboxSectionTitle, checkboxItem);
            var sameWork = checkboxKeys.some(function (key) { return targetKeys.indexOf(key) !== -1; });
            if (!sameWork) return;
            checkbox.checked = !!isDone;
            checkbox.defaultChecked = !!isDone;
            checkbox.dataset.localChecked = isDone ? '1' : '0';
            var holder = checkbox.closest ? checkbox.closest('.section-work-check, .quantity-work-check, .work-list-check') : null;
            if (holder && holder.classList) holder.classList.toggle('is-done', !!isDone);
        });
    }

    function materialProgress(projectId, items) {
        var rows = (items || []).filter(function (item) {
            return String(item && (item.itemKind || item.item_kind || 'material')).toLowerCase() !== 'work';
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

    function scheduleWorkSections(projectId) {
        var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[projectId];
        return Array.isArray(summary && summary.sections) ? summary.sections : [];
    }

    function isProjectScheduleWorkDone(projectId, sectionTitle, item) {
        if (!projectId) return false;
        if (isScheduleWorkDone(projectId, sectionTitle, item)) return true;
        var canonicalSectionTitle = canonicalEstimateSectionTitle(sectionTitle);
        return scheduleWorkSections(projectId).some(function (section) {
            var scheduleTitle = canonicalEstimateSectionTitle(section && (section.title || section.sectionId));
            return section && scheduleTitle !== canonicalSectionTitle && isScheduleWorkDone(projectId, scheduleTitle, item);
        });
    }

    function workProgressForRows(projectId, sectionTitle, rows) {
        var workRows = rows || [];
        var done = 0;
        var progressUnits = 0;
        if (projectId) {
            workRows.forEach(function (item) {
                var actualProgress = workActualProgress(projectId, sectionTitle, item);
                var completed = actualProgress.total > 0
                    ? actualProgress.actual >= actualProgress.total
                    : isProjectScheduleWorkDone(projectId, sectionTitle, item);
                if (completed) done += 1;
                if (completed) progressUnits += 1;
                else if (actualProgress.total > 0) progressUnits += Math.min(actualProgress.actual / actualProgress.total, 1);
            });
        }
        return {
            total: workRows.length,
            done: done,
            left: Math.max(0, workRows.length - done),
            percent: workRows.length ? Math.round((progressUnits / workRows.length) * 100) : 0
        };
    }

    function workProgress(projectId, sectionTitle, rows) {
        return workProgressForRows(projectId, sectionTitle, rows);
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
        var workItems = liveScheduleSectionItems(section);
        var workValue = workProgressForRows(projectId, sectionTitle, workItems);
        return {
            total: workValue.total,
            done: workValue.done,
            percent: workValue.percent,
            works: workValue
        };
    }

    function formatWorkLine(item) {
        var plan = quantityPlanInfo(item || {});
        return plan.totalQty > 0 ? (quantityText(plan.totalQty) + ' ' + (plan.unit || 'ед.')) : '';
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
        var progressUnits = 0;
        sections.forEach(function (section) {
            var progress = scheduleSectionProgress(project.id, section);
            total += progress.total;
            done += progress.done;
            progressUnits += progress.total * Number(progress.percent || 0) / 100;
        });
        return {
            total: total,
            done: done,
            percent: total ? Math.round((progressUnits / total) * 100) : 0
        };
    }

    function rerenderProjectWorkProgress(projectId) {
        var project = state.projects.find(function (item) {
            return Number(item.id) === Number(projectId);
        }) || state.selectedProject;
        if (!project || !state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        var stages = state.stagesByProject[projectId] || [];
        safeReplaceChildren(qs('[data-panel="schedule"]'), renderSchedulePanel(stages, project));
        bindAutoScheduleForm(projectId);
        bindScheduleStatusActions(projectId);
        bindSectionScheduleRefresh(projectId);
        bindSectionScheduleInteractions(projectId);
        bindActualQuantityInputs(projectId);
        bindProjectMarketToggles(projectId);
        bindProjectChainActions();
        bindProjectScheduleViews(projectId);
    }

    function openWorkQuantityFromRow(row, fallbackProjectId) {
        if (!row) return Promise.resolve(false);
        if (!canManageSchedule || !canManageSchedule()) return Promise.resolve(false);
        var projectId = Number(row.getAttribute('data-project-id') || fallbackProjectId || 0);
        var workId = Number(row.getAttribute('data-work-id') || row.getAttribute('data-position-id') || row.getAttribute('data-item-id') || 0);
        if (!projectId || !workId) {
            showAppNotice('Не удалось открыть ввод выполненного объёма. Обновите страницу и попробуйте снова.', 'error');
            return Promise.resolve(false);
        }
        if (row.getAttribute('aria-busy') === 'true') return Promise.resolve(false);
        row.setAttribute('aria-busy', 'true');
        var item = {
            id: workId,
            title: row.getAttribute('data-work-title') || row.getAttribute('data-position-title') || '',
            unit: row.getAttribute('data-work-unit') || row.getAttribute('data-position-unit') || '',
            plannedQty: row.getAttribute('data-work-qty') || row.getAttribute('data-position-qty') || ''
        };
        return Promise.resolve(openWorkQuantityDialog(projectId, row.getAttribute('data-section-title') || row.getAttribute('data-position-section') || '', item, row)).then(function () {
            return true;
        }).catch(function (error) {
            showAppNotice(appErrorMessage(error, 'Не удалось открыть ввод выполненного объёма'), 'error');
            return false;
        }).finally(function () {
            row.removeAttribute('aria-busy');
        });
    }

    function bindWorkQuantityRows(root, fallbackProjectId) {
        root = root || document;
        if (!canManageSchedule || !canManageSchedule()) return;
        qsa('[data-work-quantity-open]', root).forEach(function (row) {
            if (row.dataset.workQuantityBound === '1') return;
            row.dataset.workQuantityBound = '1';
            row.addEventListener('click', function (event) {
                if (event.defaultPrevented || event.button !== 0) return;
                var interactive = event.target && event.target.closest
                    ? event.target.closest('button, a, input, select, textarea, label, [contenteditable="true"], [data-row-action], [data-position-editor-open], [data-delete], [data-remove]')
                    : null;
                if (interactive && interactive !== row) return;
                openWorkQuantityFromRow(row, fallbackProjectId);
            });
            row.addEventListener('keydown', function (event) {
                if (event.target !== row || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                openWorkQuantityFromRow(row, fallbackProjectId);
            });
        });
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

        installActualQuantityDelegates();
        bindWorkQuantityRows(qs('[data-panel="schedule"]') || document, projectId);
    }

    // schedule page project rendering
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

    function refreshScheduleProjectStats(projectId) {
        var project = scheduleProjectById(projectId) || state.selectedProject;
        if (!project) return;
        var body = scheduleProjectBody(projectId);
        var card = body && body.closest ? body.closest('.schedule-project') : null;
        var summaryNode = card && card.querySelector ? card.querySelector('.schedule-project-summary-compact') : null;
        if (summaryNode) {
            summaryNode.outerHTML = renderScheduleProjectObjectSummary(project, scheduleProjectDetails(projectId));
        }
        var panel = state.selectedProject && Number(state.selectedProject.id) === Number(projectId) ? qs('[data-panel="schedule"]') : null;
        if (panel) {
            safeReplaceChildren(panel, renderSchedulePanel(state.stagesByProject[projectId] || [], project));
            bindAutoScheduleForm(projectId);
            bindScheduleStatusActions(projectId);
            bindSectionScheduleRefresh(projectId);
            bindSectionScheduleInteractions(projectId);
            bindActualQuantityInputs(projectId);
            bindProjectMarketToggles(projectId);
            bindProjectChainActions();
            bindProjectScheduleViews(projectId);
        }
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
        var actions = canManageSchedule() ? '<div class="schedule-project-actions"><button class="primary schedule-autoplan-button" type="button" data-auto-schedule-open data-project-id="' + escapeHtml(project.id) + '"><i data-lucide="calendar-cog" aria-hidden="true"></i><span>Автоплан графика</span></button></div>' : '';
        var objectInfo = '<section class="schedule-object-info">' +
            dataItem('Заказчик', project.client_name || 'Не указан') +
            dataItem('Адрес', project.address || 'Не указан') +
            dataItem('Договор', project.contract_no || '-') +
            dataItem('Готовность объекта', percent(project.progress) + '%') +
            dataItem('Старт', project.started_at || '-') +
            dataItem('Дедлайн', project.deadline_at || '-') +
        '</section>';
        return actions +
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
        refreshLucideIcons(body);
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
        bindWorkQuantityRows(body, projectId);
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
        refreshLucideIcons(root);
        bindScheduleProjectAccordions();
    }

    // material schedule calendar
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
                materialUrl: '/app/projects?openProject=' + projectId + '&tab=warehouse-control&materialId=' + item.id
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
        var plan = quantityPlanInfo(item || {});
        return quantityText(plan.totalQty) + ' ' + (plan.unit || 'ед.') + ' ' + (item.title || '');
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
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            var goto = event.target && event.target.closest ? event.target.closest('[data-calendar-modal-goto-material]') : null;
            if (!goto) return;
            event.preventDefault();
            event.stopPropagation();
            var projectId = Number(goto.getAttribute('data-project-id') || modal.getAttribute('data-project-id') || 0);
            var materialId = goto.getAttribute('data-material-id') || '';
            closeDayMaterialsModal();
            window.setTimeout(function () {
                if (!state.selectedProject || Number(state.selectedProject.id) !== projectId) return;
                activateProjectTab('warehouse-control');
                if (PMBI.warehouseControl && typeof PMBI.warehouseControl.load === 'function') {
                    PMBI.warehouseControl.load(projectId, false).then(function () {
                        PMBI.warehouseControl.focusMaterial(materialId, projectId);
                    }).catch(function () {});
                }
            }, 220);
        });
        modal.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            var goto = event.target && event.target.closest ? event.target.closest('[data-calendar-modal-goto-material]') : null;
            if (!goto) return;
            event.preventDefault();
            goto.click();
        });
        if (!document.body.dataset.calendarModalEscBound) {
            document.body.dataset.calendarModalEscBound = '1';
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && document.body.classList.contains('cal-modal-open')) closeDayMaterialsModal();
            });
        }
        return modal;
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


    function renderDayMaterialModalRow(projectId, item) {
        var qty = materialModalQuantityMeta(item);
        var done = isMaterialDone(projectId, item);
        var status = done ? 'Готово' : (item.statusLabel || materialScheduleDayText(item) || 'В плане');
        var statusClass = done ? 'is-done' : materialScheduleStatusClass(item).replace('is-done', 'is-neutral');
        return '<article class="calendar-material-item calendar-modal-row ' + statusClass + (done ? ' is-done' : '') + '" role="button" tabindex="0" data-calendar-modal-goto-material data-project-id="' + escapeHtml(projectId || '') + '" data-item-id="' + escapeHtml(item.id || '') + '" data-material-id="' + escapeHtml(item.id || '') + '">' +
            '<div class="calendar-modal-row-main">' +
                '<strong><span>' + escapeHtml(qty.main) + '</span> ' + escapeHtml(item.title || 'Материал') + '</strong>' +
                '<small>' + escapeHtml([status, qty.formula].filter(Boolean).join(' • ')) + '</small>' +
            '</div>' +
        '</article>';
    }

    function calendarModalSectionTitle(item) {
        return String(item && (item.sectionTitle || item.section_title || item.stageTitle || item.section || '') || '').trim() || 'Без раздела';
    }

    function sectionTitleForMaterial(item) {
        return calendarModalSectionTitle(item);
    }

    function estimateTotalSectionCount(items, fallbackOrder) {
        var seen = {};
        var count = 0;
        (items || []).forEach(function (item) {
            var title = canonicalEstimateSectionTitle(item && (item.sectionTitle || item.section_title || item.stageTitle || item.sectionId));
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

    function groupDayMaterialItemsBySection(items) {
        var groups = [];
        var byTitle = {};
        (items || []).forEach(function (item) {
            var title = calendarModalSectionTitle(item);
            if (!byTitle[title]) {
                byTitle[title] = { title: title, items: [] };
                groups.push(byTitle[title]);
            }
            byTitle[title].items.push(item);
        });
        return groups;
    }

    function renderDayMaterialModalGroups(projectId, items) {
        return groupDayMaterialItemsBySection(items).map(function (group) {
            return '<section class="calendar-section-group calendar-modal-section">' +
                '<header class="calendar-modal-section-head"><h4>' + escapeHtml(group.title) + '</h4><span>' + escapeHtml(String(group.items.length) + ' поз.') + '</span></header>' +
                '<div class="calendar-modal-section-items">' + group.items.map(function (item) { return renderDayMaterialModalRow(projectId, item); }).join('') + '</div>' +
            '</section>';
        }).join('');
    }

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
            '<div class="calendar-modal-list calendar-modal-section-list">' + renderDayMaterialModalGroups(projectId, items) + '</div>';
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
        var plan = quantityPlanInfo(item || {});
        var qty = quantityText(plan.totalQty) + ' ' + (plan.unit || 'ед.');
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
                '<button class="primary compact" type="button" data-material-schedule-goto data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(materialId) + '">Открыть на складе</button>' +
                (item.relatedWork && item.relatedWork.title ? '<button class="ghost compact" type="button" data-material-schedule-work>К работам</button>' : '') +
            '</div>';
        document.body.appendChild(drawer);
    }

    function openMaterialScheduleDrawer(projectId, materialId) {
        var item = materialScheduleFindItem(projectId, materialId);
        if (!item) return;
        closeMaterialScheduleDrawer();
        var plan = quantityPlanInfo(item || {});
        var qty = quantityText(plan.totalQty) + ' ' + (plan.unit || 'ед.');
        var missingQty = quantityText(item.missingQty || 0) + ' ' + (plan.unit || 'ед.');
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
                '<button class="ghost compact" type="button" data-material-schedule-goto data-project-id="' + escapeHtml(projectId) + '" data-material-id="' + escapeHtml(materialId) + '">Открыть на складе</button>' +
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
        var panel = qs('[data-panel="calendar"]');
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
        var panel = qs('[data-panel="calendar"]');
        return !!(panel && panel.classList.contains('active'));
    }

    function loadSelectedProjectMaterialSchedule(force) {
        if (state.isMaterialScheduleRendering) return;
        if (!state.selectedProject || hasRole('customer') || !isSelectedProjectScheduleTabActive()) return;
        var projectId = state.selectedProject.id;
        bindAutoScheduleForm(projectId);
        replaceSelectedProjectMaterialCalendar(projectId);
        loadMaterialSchedule(projectId, function () {
            if (!state.selectedProject || Number(state.selectedProject.id) !== Number(projectId) || !isSelectedProjectScheduleTabActive()) return;
            replaceSelectedProjectMaterialCalendar(projectId);
        }, force);
    }

    function focusProjectMaterialRow(materialId, projectId) {
        if (!projectId) {
            var legacyInput = qs('[data-section-material-check][data-material-id="' + progressSelectorValue(materialId) + '"]');
            var legacyRow = legacyInput && legacyInput.closest ? legacyInput.closest('.material-row') : null;
            if (!legacyRow) return;
            legacyRow.classList.remove('material-row-focus');
            void legacyRow.offsetWidth;
            legacyRow.classList.add('material-row-focus');
            legacyRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(function () { legacyRow.classList.remove('material-row-focus'); }, 3000);
            return;
        }
        var schedulePanel = qs('[data-panel="schedule"]');
        var scope = schedulePanel || document;
        var input = qs('[data-section-material-check][data-material-id="' + progressSelectorValue(materialId) + '"]', scope);
        var row = input && input.closest ? input.closest('.section-material-check, .section-work-check, .material-row') : null;
        if (!row) return;
        var section = row.closest ? row.closest('.section-schedule-card') : null;
        var head = section && section.querySelector ? section.querySelector('[data-section-schedule-toggle]') : null;
        if (section && !section.classList.contains('is-open')) {
            var body = section.querySelector ? section.querySelector('.section-schedule-details-shell') : null;
            var chevron = head && head.querySelector ? head.querySelector('.section-schedule-chevron') : null;
            section.classList.add('is-open');
            if (head) {
                head.setAttribute('aria-expanded', 'true');
                var targetProjectId = Number(projectId || head.getAttribute('data-project-id') || (state.selectedProject && state.selectedProject.id) || 0);
                var key = head.getAttribute('data-section-key') || '';
                var summary = state.sectionScheduleByProject && state.sectionScheduleByProject[targetProjectId];
                var sections = Array.isArray(summary && summary.sections) ? summary.sections : [];
                var scheduleSection = sections.find(function (entry) { return scheduleSectionKey(entry) === key; });
                if (scheduleSection) setScheduleSectionOpen(targetProjectId, scheduleSection, true);
            }
            if (body) {
                body.classList.add('is-open');
                body.setAttribute('aria-hidden', 'false');
            }
            if (chevron) chevron.textContent = '-';
        }
        if (head) {
            head.classList.remove('section-schedule-focus');
            void head.offsetWidth;
            head.classList.add('section-schedule-focus');
        }
        row.classList.remove('material-row-focus');
        void row.offsetWidth;
        row.classList.add('material-row-focus');
        (head || section || row).scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () {
            if (head) head.classList.remove('section-schedule-focus');
            row.classList.remove('material-row-focus');
        }, 3000);
    }

    function focusProjectScheduleTarget(target, projectId) {
        target = target || {};
        projectId = Number(projectId || (state.selectedProject && state.selectedProject.id) || 0);
        if (!projectId || !state.selectedProject || Number(state.selectedProject.id) !== projectId) return false;
        var panel = qs('[data-panel="schedule"]');
        if (!panel) return false;
        var row = null;
        var workId = Number(target.workId || 0);
        var stageId = Number(target.stageId || 0);
        var allowSectionFallback = !workId && !stageId;
        if (workId) row = qs('[data-work-row][data-position-id="' + String(workId) + '"]', panel);
        if (!row && stageId) row = qs('[data-stage-id="' + String(stageId) + '"]', panel);
        if (!row && stageId) {
            allowSectionFallback = (state.stagesByProject[projectId] || []).some(function (stage) {
                return Number(stage && stage.id || 0) === stageId;
            });
        }
        if (!row && allowSectionFallback && target.sectionTitle) {
            var expectedSection = canonicalEstimateSectionTitle(target.sectionTitle);
            row = qsa('[data-section-title]', panel).find(function (candidate) {
                return canonicalEstimateSectionTitle(candidate.getAttribute('data-section-title') || '') === expectedSection;
            }) || null;
            if (row && row.classList.contains('section-work-register-section')) {
                row = qs('.section-work-section-row', row) || row;
            }
        }
        if (!row) return false;
        var focusTarget = qs('input, button, [tabindex]', row);
        if (focusTarget && typeof focusTarget.focus === 'function') {
            try { focusTarget.focus({ preventScroll: true }); } catch (focusError) { focusTarget.focus(); }
        }
        if (PMBI.app && typeof PMBI.app.highlightPositionRow === 'function') {
            PMBI.app.highlightPositionRow(row);
        } else if (typeof row.scrollIntoView === 'function') {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
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
                    closeMaterialScheduleDrawer();
                    storeMaterialsWithWarehouseMatches(saveProjectId, data && Array.isArray(data.items) ? data.items : (state.materialsByProject[saveProjectId] || []), function () {
                        rerenderProjectMaterialAndWorkViews(saveProjectId);
                        refreshMaterialScheduleProject(saveProjectId, true);
                    });
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
                    loadMaterials(purchaseProjectId, function (items) {
                        storeMaterialsWithWarehouseMatches(purchaseProjectId, items, function () {
                            rerenderProjectMaterialAndWorkViews(purchaseProjectId);
                            refreshMaterialScheduleProject(purchaseProjectId, true);
                        });
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
                    location.href = '/app/projects?openProject=' + gotoProjectId + '&tab=warehouse-control&materialId=' + encodeURIComponent(gotoMaterialId);
                    return;
                }
                activateProjectTab('warehouse-control');
                if (PMBI.warehouseControl && typeof PMBI.warehouseControl.load === 'function') {
                    PMBI.warehouseControl.load(gotoProjectId, false).then(function () {
                        PMBI.warehouseControl.focusMaterial(gotoMaterialId, gotoProjectId);
                    }).catch(function () {});
                }
                return;
            }
            var work = event.target && event.target.closest ? event.target.closest('[data-material-schedule-work]') : null;
            if (work) {
                closeMaterialScheduleDrawer();
                activateProjectTab('schedule');
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
        if (tabName !== 'calendar') return;
        loadSelectedProjectMaterialSchedule(false);
    };

    function productionScheduleVisibleDays(projectId, schedule) {
        state.productionScheduleVisibleDaysByProject = state.productionScheduleVisibleDaysByProject || {};
        var calculated = Math.max(1, Number(schedule && schedule.dayCount || 0), Number(schedule && schedule.autoDayCount || 0));
        var current = Number(state.productionScheduleVisibleDaysByProject[projectId] || 0);
        if (!current) current = calculated + 7;
        current = Math.max(current, calculated);
        state.productionScheduleVisibleDaysByProject[projectId] = current;
        return current;
    }

    function syncProductionScheduleScroll(scroller) {
        if (!scroller) return;
        var shell = scroller.closest ? scroller.closest('[data-production-table-shell]') : null;
        if (!shell) return;
        var current = Math.max(0, Number(scroller.scrollLeft || 0));
        shell.classList.toggle('is-horizontally-scrolled', current > 1);
    }

    function productionPointerOverFrozenColumns(scroller, event) {
        if (!scroller || !event) return false;
        var target = event.target;
        if (target && target.nodeType === 3) target = target.parentElement;
        var overFrozenColumns = target && target.closest
            ? target.closest('.production-number-cell, .production-work-title')
            : null;
        if (!overFrozenColumns && Number.isFinite(Number(event.clientX))) {
            var frozenTitle = qs('.production-work-title', scroller);
            var frozenRect = frozenTitle && frozenTitle.getBoundingClientRect
                ? frozenTitle.getBoundingClientRect()
                : null;
            var scrollerRect = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : null;
            var pointerX = Number(event.clientX);
            overFrozenColumns = frozenRect && scrollerRect
                && pointerX >= scrollerRect.left
                && pointerX < Math.min(frozenRect.right, scrollerRect.right);
        }
        return !!overFrozenColumns;
    }

    function scrollProductionScheduleVertically(scroller, event) {
        if (!scroller || !event) return false;
        var deltaX = Number(event.deltaX || 0);
        var deltaY = Number(event.deltaY || 0);
        if (!deltaY || Math.abs(deltaX) > Math.abs(deltaY)) return false;

        var delta = deltaY;
        if (event.deltaMode === 1) delta *= 24;
        if (event.deltaMode === 2) delta *= Math.max(1, window.innerHeight || scroller.clientHeight);
        if (!delta) return false;

        var card = scroller.closest ? scroller.closest('[data-production-schedule-card]') : null;
        if (!card || !card.getBoundingClientRect || typeof window.scrollBy !== 'function') return false;
        var stickyTop = parseFloat(window.getComputedStyle(card).top);
        if (!isFinite(stickyTop)) stickyTop = 8;
        var cardTop = Number(card.getBoundingClientRect().top || 0);
        var tolerance = 2;

        event.preventDefault();
        if (cardTop > stickyTop + tolerance) {
            if (delta < 0) {
                window.scrollBy(0, delta);
                return true;
            }
            var pageStep = Math.min(delta, cardTop - stickyTop);
            window.scrollBy(0, pageStep);
            delta -= pageStep;
        } else if (cardTop < stickyTop - tolerance) {
            window.scrollBy(0, delta);
            return true;
        }

        if (Math.abs(delta) < 0.5) return true;
        var current = Math.max(0, Number(scroller.scrollTop || 0));
        var maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        var next = Math.max(0, Math.min(maximum, current + delta));
        var consumed = next - current;
        scroller.scrollTop = next;
        var pageRemainder = delta - consumed;
        if (Math.abs(pageRemainder) >= 0.5) window.scrollBy(0, pageRemainder);
        return true;
    }

    function bindProductionScheduleScroll(scroller) {
        if (!scroller || scroller.dataset.productionScrollBound === '1') return scroller || null;
        scroller.dataset.productionScrollBound = '1';
        scroller.addEventListener('scroll', function () {
            syncProductionScheduleScroll(scroller);
        }, { passive: true });
        scroller.addEventListener('pointermove', function (event) {
            var overFrozenColumns = productionPointerOverFrozenColumns(scroller, event);
            scroller.classList.toggle('is-wheel-vertical-zone', overFrozenColumns);
            scroller.classList.toggle('is-wheel-horizontal-zone', !overFrozenColumns);
        }, { passive: true });
        scroller.addEventListener('pointerleave', function () {
            scroller.classList.remove('is-wheel-vertical-zone', 'is-wheel-horizontal-zone');
        }, { passive: true });
        scroller.addEventListener('wheel', function (event) {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
            if (productionPointerOverFrozenColumns(scroller, event)) {
                scrollProductionScheduleVertically(scroller, event);
                return;
            }

            var deltaX = Number(event.deltaX || 0);
            var deltaY = Number(event.deltaY || 0);
            var delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
            if (event.deltaMode === 1) delta *= 24;
            if (event.deltaMode === 2) delta *= Math.max(1, scroller.clientWidth);
            if (!delta) return;

            event.preventDefault();
            var current = Number(scroller.scrollLeft || 0);
            var maximum = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
            var next = Math.max(0, Math.min(maximum, current + delta));
            if (Math.abs(next - current) < 0.5) return;
            scroller.scrollLeft = next;
            syncProductionScheduleScroll(scroller);
        }, { passive: false });
        syncProductionScheduleScroll(scroller);
        return scroller;
    }

    function productionScheduleDaySet(days) {
        var set = Object.create(null);
        (Array.isArray(days) ? days : []).forEach(function (day) { set[String(day)] = true; });
        return set;
    }

    function productionOperationId(item) {
        return item && (item.operationId != null ? item.operationId : item.id);
    }

    function productionLinkedEstimateIds(item) {
        var values = item && (item.linkedEstimateItemIds || item.linked_estimate_item_ids);
        if (!Array.isArray(values) && Array.isArray(item && item.links)) {
            values = item.links.map(function (link) {
                return link && (link.estimateItemId != null ? link.estimateItemId : (link.estimate_item_id != null ? link.estimate_item_id : link.id));
            });
        }
        return (Array.isArray(values) ? values : []).map(function (value) { return String(value); });
    }

    function productionOperationColorKey(item, index) {
        var raw = String(item && (item.colorKey || item.color) || '').trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(raw)) {
            var red = parseInt(raw.slice(1, 3), 16) / 255;
            var green = parseInt(raw.slice(3, 5), 16) / 255;
            var blue = parseInt(raw.slice(5, 7), 16) / 255;
            var maximum = Math.max(red, green, blue);
            var minimum = Math.min(red, green, blue);
            var range = maximum - minimum;
            if (range < 0.12) return 'slate';
            var hue = 0;
            if (maximum === red) hue = 60 * (((green - blue) / range) % 6);
            else if (maximum === green) hue = 60 * (((blue - red) / range) + 2);
            else hue = 60 * (((red - green) / range) + 4);
            if (hue < 0) hue += 360;
            if (hue >= 75 && hue < 165) return 'green';
            if (hue >= 165 && hue < 205) return 'teal';
            if (hue >= 205 && hue < 260) return 'blue';
            if (hue >= 260 && hue < 320) return 'violet';
            if (hue >= 320 || hue < 35) return 'rose';
            return 'slate';
        }
        var aliases = {
            grey: 'slate', gray: 'slate', neutral: 'slate',
            cyan: 'teal', turquoise: 'teal', purple: 'violet',
            orange: 'rose', red: 'rose'
        };
        raw = aliases[raw] || raw;
        var allowed = ['slate', 'blue', 'teal', 'green', 'violet', 'rose'];
        if (allowed.indexOf(raw) >= 0) return raw;
        var stableKey = String(productionOperationId(item) == null ? index : productionOperationId(item));
        var hash = 0;
        for (var keyIndex = 0; keyIndex < stableKey.length; keyIndex += 1) hash = ((hash * 31) + stableKey.charCodeAt(keyIndex)) | 0;
        return allowed[Math.abs(hash) % allowed.length];
    }

    function productionOperationMeta(item) {
        var origin = String(item && (item.originType || item.origin) || '').trim().toLowerCase();
        var originLabel = 'Авточерновик';
        if (origin === 'manual') originLabel = 'Добавлено вручную';
        else if (origin === 'estimate') originLabel = 'Из работы сметы';
        else if (origin === 'material' || origin === 'estimate_material') originLabel = 'Из ресурса сметы';
        else if (origin === 'template' || origin === 'derived') originLabel = 'По шаблону';

        var linkedIds = productionLinkedEstimateIds(item);
        var status = String(item && (item.linkStatus || item.status) || '').trim().toLowerCase();
        var needsReview = status === 'review' || status === 'needs_review' || status === 'requires_review' || status === 'unverified' || status === 'stale' || status === 'ambiguous' || status === 'orphaned';
        var outsideEstimate = status === 'outside' || status === 'outside_estimate' || status === 'unlinked';
        var linkLabel = needsReview ? 'Требует проверки' : ((linkedIds.length && !outsideEstimate) ? 'Связано со сметой' : 'Вне сметы');
        var linkKind = needsReview ? 'review' : ((linkedIds.length && !outsideEstimate) ? 'linked' : 'outside');
        return { originLabel: originLabel, linkLabel: linkLabel, linkKind: linkKind };
    }

    function renderProductionOperationEditor(project, schedule) {
        var estimateOptions = Array.isArray(schedule && schedule.estimateOptions) ? schedule.estimateOptions : [];
        var optionRows = estimateOptions.map(function (option) {
            var optionId = option && (option.id != null ? option.id : option.estimateItemId);
            var qty = option && (option.plannedQty != null ? option.plannedQty : option.quantity);
            var unit = String(option && option.unit || '').trim();
            var type = String(option && (option.itemKind || option.item_kind || option.itemType || option.type) || '').toLowerCase();
            var kindLabel = type === 'material' ? 'материал' : 'работа';
            var meta = [];
            if (qty != null && qty !== '') meta.push(quantityText(qty) + (unit ? ' ' + unit : ''));
            meta.push(kindLabel);
            return '<label class="production-estimate-option" data-production-estimate-option data-search-text="' + escapeHtml(String(option && option.title || '').toLowerCase()) + '">' +
                '<input type="checkbox" name="linked_estimate_item_ids" value="' + escapeHtml(optionId) + '">' +
                '<span><b>' + escapeHtml(option && option.title || 'Позиция сметы') + '</b><small>' + escapeHtml(meta.join(' · ')) + '</small></span>' +
            '</label>';
        }).join('');
        if (!optionRows) optionRows = '<p class="production-estimate-empty">В смете пока нет доступных позиций.</p>';
        return '<div class="production-operation-overlay" data-production-editor-overlay aria-hidden="true"></div>' +
            '<aside class="production-operation-drawer" data-production-editor aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="production-operation-editor-title">' +
                '<button class="production-operation-close" type="button" data-production-editor-close aria-label="Закрыть">×</button>' +
                '<header class="production-operation-editor-head"><span class="eyebrow">Производственная операция</span><h3 id="production-operation-editor-title" data-production-editor-title>Новая работа</h3><p>Операция может быть связана с одной или несколькими строками сметы — работами или материалами.</p></header>' +
                '<form class="production-operation-form" data-production-operation-form data-project-id="' + escapeHtml(project.id) + '">' +
                    '<input type="hidden" name="operation_id" value="">' +
                    '<label class="production-form-wide"><span>Наименование работы</span><input name="title" required maxlength="500" autocomplete="off"></label>' +
                    '<div class="production-form-columns production-form-columns-volume">' +
                        '<label><span>Объём</span><input name="planned_qty" type="text" inputmode="decimal" autocomplete="off"></label>' +
                        '<label><span>Ед. изм.</span><input name="unit" maxlength="32" value="ед."></label>' +
                    '</div>' +
                    '<div class="production-form-columns production-form-columns-team">' +
                        '<label><span>Человек</span><input name="people_count" type="number" min="1" max="999" step="1" value="1"></label>' +
                        '<label><span>Смен</span><input name="shift_count" type="number" min="1" max="99" step="1" value="1"></label>' +
                        '<label><span>Бригад</span><input name="brigade_count" type="number" min="1" max="99" step="1" value="1"></label>' +
                    '</div>' +
                    '<label class="production-form-wide"><span>Продолжительность, дней</span><input name="duration_days" type="number" min="0.5" max="3650" step="0.5" value="0.5"></label>' +
                    '<fieldset class="production-estimate-links"><legend>Связи со сметой</legend><p>Выберите всё, на основании чего появилась операция. Эти связи используются только в графике и не меняют смету.</p>' +
                        '<input class="production-estimate-search" type="search" data-production-link-filter placeholder="Найти работу или материал…" aria-label="Поиск по смете">' +
                        '<div class="production-estimate-options" data-production-estimate-options>' + optionRows + '</div>' +
                    '</fieldset>' +
                    '<div class="production-operation-form-error" data-production-operation-error></div>' +
                    '<footer class="production-operation-form-actions"><button class="ghost" type="button" data-production-editor-close>Отмена</button><button class="primary" type="submit">Сохранить работу</button></footer>' +
                '</form>' +
            '</aside>';
    }

    function productionSchedulePrintDayCount(schedule) {
        var items = Array.isArray(schedule && schedule.items) ? schedule.items : [];
        var dayCount = Math.max(1, Number(schedule && schedule.dayCount || 0), Number(schedule && schedule.autoDayCount || 0));
        var maximumSlot = dayCount * 2;
        items.forEach(function (item) {
            ['filledSlots', 'autoFilledSlots', 'overriddenSlots'].forEach(function (field) {
                var rawSlots = item && item[field];
                var slots = Array.isArray(rawSlots)
                    ? rawSlots
                    : (rawSlots && typeof rawSlots === 'object' ? Object.keys(rawSlots).filter(function (key) { return rawSlots[key]; }) : []);
                slots.forEach(function (slot) {
                    var slotNumber = Number(slot);
                    if (Number.isFinite(slotNumber)) maximumSlot = Math.max(maximumSlot, slotNumber);
                });
            });
        });
        return Math.max(1, Math.ceil(maximumSlot / 2));
    }

    function productionSchedulePrintDocument(project, schedule) {
        var items = Array.isArray(schedule && schedule.items) ? schedule.items : [];
        var dayCount = productionSchedulePrintDayCount(schedule);
        var daysPerSheet = 12;
        var sheetCount = Math.max(1, Math.ceil(dayCount / daysPerSheet));
        var projectTitle = String(project && (project.name || project.title) || 'Объект');
        var projectAddress = String(project && (project.address || project.location) || '').trim();
        var printedAt = new Date().toLocaleString('ru-RU');
        var sheets = [];

        for (var sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
            var firstDay = sheetIndex * daysPerSheet + 1;
            var lastDay = Math.min(dayCount, firstDay + daysPerSheet - 1);
            var dayHeaders = '';
            var halfDayHeaders = '';
            var dayColumns = '';
            for (var day = firstDay; day <= lastDay; day += 1) {
                dayHeaders += '<th class="production-print-day" colspan="2">День ' + String(day) + '</th>';
                halfDayHeaders += '<th class="production-print-half">1/2</th><th class="production-print-half">2/2</th>';
                dayColumns += '<col class="production-print-slot-column"><col class="production-print-slot-column">';
            }

            var previousSection = null;
            var rows = [];
            items.forEach(function (item, itemIndex) {
                var sectionTitle = String(item.sectionTitle || '').trim();
                if (sectionTitle && sectionTitle !== previousSection) {
                    rows.push('<tr class="production-print-section"><th colspan="' + String(7 + (lastDay - firstDay + 1) * 2) + '">' + escapeHtml(sectionTitle) + '</th></tr>');
                    previousSection = sectionTitle;
                }
                var filled = productionScheduleDaySet(item.filledSlots);
                var overridden = productionScheduleDaySet(item.overriddenSlots);
                var colorKey = productionOperationColorKey(item, itemIndex);
                var cells = '';
                for (var cellDay = firstDay; cellDay <= lastDay; cellDay += 1) {
                    for (var half = 1; half <= 2; half += 1) {
                        var slotNumber = (cellDay - 1) * 2 + half;
                        var isFilled = !!filled[String(slotNumber)];
                        var isOverridden = !!overridden[String(slotNumber)];
                        cells += '<td class="production-print-slot' + (isFilled ? ' is-filled tone-' + colorKey : '') + (isOverridden ? ' is-overridden' : '') + '"></td>';
                    }
                }
                var volumePlan = quantityPlanInfo(item || {});
                var hasVolume = item.plannedQty != null || item.planned_qty != null;
                var volumeUnit = String(volumePlan.unit || '').trim();
                var volume = hasVolume ? (quantityText(volumePlan.totalQty) + (volumeUnit ? ' ' + volumeUnit : '')) : '—';
                var people = item.peopleCount != null ? item.peopleCount : (item.crewSize != null ? item.crewSize : 1);
                var shifts = item.shiftCount != null ? item.shiftCount : 1;
                var brigades = item.brigadeCount != null ? item.brigadeCount : 1;
                var duration = Math.max(0.5, Math.round(Number(item.durationDays || 0.5) * 2) / 2);
                rows.push('<tr class="production-print-work">' +
                    '<td class="production-print-number">' + String(itemIndex + 1) + '</td>' +
                    '<th class="production-print-title">' + escapeHtml(item.title || 'Работа') + '</th>' +
                    '<td>' + escapeHtml(volume) + '</td>' +
                    '<td>' + escapeHtml(String(people)) + '</td>' +
                    '<td>' + escapeHtml(String(shifts)) + '</td>' +
                    '<td>' + escapeHtml(String(brigades)) + '</td>' +
                    '<td>' + escapeHtml(quantityText(duration)) + '</td>' + cells + '</tr>');
            });
            if (!rows.length) {
                rows.push('<tr class="production-print-empty"><td colspan="' + String(7 + (lastDay - firstDay + 1) * 2) + '">График пока пуст</td></tr>');
            }

            sheets.push('<section class="production-print-sheet">' +
                '<header class="production-print-sheet-head"><div><span>График производства работ</span><h1>' + escapeHtml(projectTitle) + '</h1>' + (projectAddress ? '<p>' + escapeHtml(projectAddress) + '</p>' : '') + '</div>' +
                    '<div class="production-print-range"><b>Дни ' + String(firstDay) + (firstDay === lastDay ? '' : '–' + String(lastDay)) + '</b><span>Часть ' + String(sheetIndex + 1) + ' из ' + String(sheetCount) + '</span></div></header>' +
                '<table class="production-print-table"><colgroup><col class="production-print-number-column"><col class="production-print-title-column"><col class="production-print-volume-column"><col class="production-print-people-column"><col class="production-print-shifts-column"><col class="production-print-brigades-column"><col class="production-print-duration-column">' + dayColumns + '</colgroup>' +
                    '<thead><tr><th rowspan="2">№</th><th rowspan="2">Наименование работ</th><th rowspan="2">Объём</th><th rowspan="2">Чел.</th><th rowspan="2">Смен</th><th rowspan="2">Бригад</th><th rowspan="2">Дней</th>' + dayHeaders + '</tr><tr>' + halfDayHeaders + '</tr></thead>' +
                    '<tbody>' + rows.join('') + '</tbody></table>' +
                '<footer class="production-print-footer"><span>Каждая половина клетки — 0,5 дня</span><span>Актуально на ' + escapeHtml(printedAt) + '</span></footer>' +
            '</section>');
        }

        return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>График производства — ' + escapeHtml(projectTitle) + '</title><style>' +
            '@page{size:A4 landscape;margin:8mm}' +
            '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
            'html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;color:#18212a;background:#e9edf0}' +
            '.production-print-toolbar{align-items:center;background:#17212b;color:#fff;display:flex;gap:12px;justify-content:space-between;padding:12px 18px;position:sticky;top:0;z-index:5}' +
            '.production-print-toolbar div{display:grid;gap:2px}.production-print-toolbar b{font-size:14px}.production-print-toolbar span{color:#b9c4cf;font-size:11px}' +
            '.production-print-toolbar button{background:#fff;border:0;border-radius:9px;color:#17212b;cursor:pointer;font-size:13px;font-weight:800;padding:10px 14px}' +
            '.production-print-document{display:grid;gap:18px;padding:18px}' +
            '.production-print-sheet{background:#fff;box-shadow:0 12px 30px rgba(20,31,42,.14);margin:0 auto;min-height:210mm;padding:8mm;width:297mm}' +
            '.production-print-sheet-head{align-items:flex-end;border-bottom:2px solid #18212a;display:flex;gap:10mm;justify-content:space-between;margin-bottom:3mm;padding-bottom:2.5mm}' +
            '.production-print-sheet-head span{color:#67727d;font-size:7pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase}' +
            '.production-print-sheet-head h1{font-size:14pt;line-height:1.1;margin:1mm 0 0}.production-print-sheet-head p{color:#5d6872;font-size:7pt;margin:1mm 0 0}' +
            '.production-print-range{align-items:flex-end;display:grid;gap:.8mm;text-align:right;white-space:nowrap}.production-print-range b{font-size:9pt}.production-print-range span{font-size:6.5pt}' +
            '.production-print-table{border-collapse:collapse;table-layout:fixed;width:100%}' +
            '.production-print-table th,.production-print-table td{border:0.25mm solid #39424a;font-size:6.3pt;height:6mm;line-height:1.15;padding:.7mm;text-align:center;vertical-align:middle}' +
            '.production-print-table thead{display:table-header-group}.production-print-table thead th{background:#e9edf0;font-size:5.7pt;font-weight:800}' +
            '.production-print-table tr{break-inside:avoid;page-break-inside:avoid}.production-print-table .production-print-title{font-size:6.5pt;text-align:left;word-break:break-word}' +
            '.production-print-number-column{width:8mm}.production-print-title-column{width:64mm}.production-print-volume-column{width:20mm}.production-print-people-column{width:14mm}.production-print-shifts-column{width:14mm}.production-print-brigades-column{width:16mm}.production-print-duration-column{width:18mm}.production-print-slot-column{width:5mm}' +
            '.production-print-section th{background:#d9dee3;font-size:6.5pt;height:5mm;padding-left:1.5mm;text-align:left}' +
            '.production-print-slot{padding:0!important}.production-print-slot.is-filled.tone-slate{background:#7f8992}.production-print-slot.is-filled.tone-blue{background:#7892b0}.production-print-slot.is-filled.tone-teal{background:#719994}.production-print-slot.is-filled.tone-green{background:#7e9a7f}.production-print-slot.is-filled.tone-violet{background:#8b84a1}.production-print-slot.is-filled.tone-rose{background:#a0878e}' +
            '.production-print-slot.is-overridden{box-shadow:inset 0 0 0 .45mm rgba(24,33,42,.55)}.production-print-empty td{color:#68737d;font-style:italic;padding:5mm}' +
            '.production-print-footer{color:#68737d;display:flex;font-size:6.3pt;justify-content:space-between;padding-top:2mm}' +
            '@media print{html,body{background:#fff}.production-print-toolbar{display:none}.production-print-document{display:block;padding:0}.production-print-sheet{box-shadow:none;margin:0;min-height:0;padding:0;width:auto;break-after:page;page-break-after:always}.production-print-sheet:last-child{break-after:auto;page-break-after:auto}}' +
        '</style></head><body><div class="production-print-toolbar"><div><b>Предпросмотр графика</b><span>Выберите «Сохранить как PDF» или принтер в системном окне.</span></div><button type="button" data-production-print-now>Печать / сохранить PDF</button></div><main class="production-print-document">' + sheets.join('') + '</main></body></html>';
    }

    function productionSchedulePrintStatusDocument(project, message, isError) {
        var title = String(project && (project.name || project.title) || 'Объект');
        return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title><style>body{align-items:center;background:#f4f6f8;color:#1f2933;display:grid;font-family:Arial,sans-serif;margin:0;min-height:100vh;padding:24px;text-align:center}.status{background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(25,35,45,.12);max-width:520px;padding:34px}.status b{display:block;font-size:18px;margin-bottom:8px}.status p{color:' + (isError ? '#a13b3b' : '#65717c') + ';line-height:1.5;margin:0}</style></head><body><div class="status"><b>' + escapeHtml(title) + '</b><p>' + escapeHtml(message) + '</p></div></body></html>';
    }

    function loadProductionScheduleForPrint(projectId) {
        return api('/api/projects/' + projectId + '/production-schedule').then(function (schedule) {
            applyProductionScheduleResponse(projectId, schedule);
            return state.productionScheduleByProject && state.productionScheduleByProject[projectId];
        });
    }

    function createProductionSchedulePrintPreview(project) {
        var existing = qs('[data-production-print-preview]');
        if (existing) {
            if (typeof existing._productionPrintClose === 'function') existing._productionPrintClose();
            else existing.remove();
        }
        var returnFocus = document.activeElement;
        var projectTitle = String(project && (project.name || project.title) || 'Объект');
        var preview = document.createElement('div');
        preview.className = 'production-print-preview';
        preview.setAttribute('data-production-print-preview', '');
        preview.setAttribute('role', 'dialog');
        preview.setAttribute('aria-modal', 'true');
        preview.setAttribute('aria-labelledby', 'production-print-preview-title');
        preview.innerHTML = '<style>' +
            'html.production-print-preview-open,html.production-print-preview-open body{overflow:hidden!important}' +
            '.production-print-preview{align-items:stretch;background:rgba(19,27,35,.78);display:grid;inset:0;padding:14px;position:fixed;z-index:2147483000}' +
            '.production-print-preview-card{background:#f3f5f7;border:1px solid rgba(255,255,255,.34);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.34);display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;overflow:hidden}' +
            '.production-print-preview-head{align-items:center;background:#17212b;color:#fff;display:flex;gap:12px;justify-content:space-between;padding:12px 14px}' +
            '.production-print-preview-copy{display:grid;gap:2px;min-width:0}.production-print-preview-copy b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.production-print-preview-copy span{color:#bcc7d1;font-size:12px}' +
            '.production-print-preview-actions{align-items:center;display:flex;gap:8px}.production-print-preview-action,.production-print-preview-close{border:0;cursor:pointer;font:inherit;font-weight:800}' +
            '.production-print-preview-action{background:#fff;border-radius:9px;color:#17212b;padding:9px 13px}.production-print-preview-action:disabled{cursor:wait;opacity:.55}' +
            '.production-print-preview-close{background:rgba(255,255,255,.12);border-radius:9px;color:#fff;font-size:20px;height:38px;line-height:1;width:38px}' +
            '.production-print-preview-frame{background:#e9edf0;border:0;height:100%;min-height:0;width:100%}' +
            '.production-print-preview-status.is-error{color:#ffb4b4}' +
            '@media(max-width:720px){.production-print-preview{padding:0}.production-print-preview-card{border:0;border-radius:0}.production-print-preview-head{align-items:flex-start;flex-wrap:wrap}.production-print-preview-actions{width:100%}.production-print-preview-action{flex:1}}' +
        '</style><section class="production-print-preview-card">' +
            '<header class="production-print-preview-head"><div class="production-print-preview-copy"><b id="production-print-preview-title">' + escapeHtml(projectTitle) + '</b><span class="production-print-preview-status" data-production-print-status>Обновляем график перед печатью…</span></div>' +
            '<div class="production-print-preview-actions"><button class="production-print-preview-action" type="button" data-production-print-action disabled>Печать / сохранить PDF</button><button class="production-print-preview-close" type="button" data-production-print-close aria-label="Закрыть предпросмотр">×</button></div></header>' +
            '<iframe class="production-print-preview-frame" data-production-print-frame title="Предпросмотр графика для печати"></iframe>' +
        '</section>';
        document.body.appendChild(preview);
        document.documentElement.classList.add('production-print-preview-open');

        var onKeyDown = function (event) {
            if (event.key === 'Escape') closePreview();
        };
        var closePreview = function () {
            document.removeEventListener('keydown', onKeyDown);
            document.documentElement.classList.remove('production-print-preview-open');
            if (preview.parentNode) preview.parentNode.removeChild(preview);
            if (returnFocus && typeof returnFocus.focus === 'function' && document.contains(returnFocus)) returnFocus.focus();
        };
        preview._productionPrintClose = closePreview;
        qsa('[data-production-print-close]', preview).forEach(function (button) {
            button.addEventListener('click', closePreview);
        });
        preview.addEventListener('click', function (event) {
            if (event.target === preview) closePreview();
        });
        document.addEventListener('keydown', onKeyDown);
        var closeButton = qs('[data-production-print-close]', preview);
        if (closeButton) closeButton.focus();

        return {
            root: preview,
            frame: qs('[data-production-print-frame]', preview),
            printButton: qs('[data-production-print-action]', preview),
            status: qs('[data-production-print-status]', preview),
            close: closePreview
        };
    }

    function writeProductionSchedulePrintPreview(preview, html) {
        var frameWindow = preview && preview.frame && preview.frame.contentWindow;
        var frameDocument = preview && preview.frame && (preview.frame.contentDocument || (frameWindow && frameWindow.document));
        if (!frameWindow || !frameDocument) throw new Error('Предпросмотр печати недоступен в этом браузере.');
        frameDocument.open();
        frameDocument.write(html);
        frameDocument.close();
        var embeddedToolbar = frameDocument.querySelector('.production-print-toolbar');
        if (embeddedToolbar) embeddedToolbar.style.display = 'none';
        frameDocument.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && preview && typeof preview.close === 'function') preview.close();
        });
        return { window: frameWindow, document: frameDocument };
    }

    function openProductionSchedulePrint(projectId, trigger) {
        var project = state.selectedProject;
        if (!project || Number(project.id) !== Number(projectId)) return Promise.resolve(null);
        var preview = null;
        try {
            preview = createProductionSchedulePrintPreview(project);
            writeProductionSchedulePrintPreview(preview, productionSchedulePrintStatusDocument(project, 'Обновляем график с сервера перед печатью…', false));
        } catch (error) {
            if (preview && typeof preview.close === 'function') preview.close();
            showAppNotice(appErrorMessage(error, 'Не удалось открыть предпросмотр печати.'), 'error');
            return Promise.resolve(null);
        }
        if (trigger) {
            trigger.disabled = true;
            trigger.classList.add('is-loading');
        }
        var pendingSave = state.productionSchedulePendingSavesByProject && state.productionSchedulePendingSavesByProject[projectId];
        return Promise.resolve(pendingSave).catch(function () { return null; }).then(function () {
            return loadProductionScheduleForPrint(projectId);
        }).then(function (latest) {
            if (!latest || latest.error) throw new Error(latest && latest.error || 'График не загрузился.');
            if (!preview.root.isConnected) return latest;
            var printable = writeProductionSchedulePrintPreview(preview, productionSchedulePrintDocument(project, latest));
            var startPrint = function () {
                if (!preview.root.isConnected) return;
                try {
                    printable.window.focus();
                    printable.window.print();
                } catch (error) {
                    showAppNotice(appErrorMessage(error, 'Не удалось открыть системное окно печати.'), 'error');
                }
            };
            var printAgain = printable.document.querySelector('[data-production-print-now]');
            if (printAgain) printAgain.addEventListener('click', startPrint);
            preview.printButton.disabled = false;
            preview.printButton.addEventListener('click', startPrint);
            preview.status.textContent = 'Готово. Проверьте листы и нажмите кнопку печати.';
            return latest;
        }).catch(function (error) {
            if (preview.root.isConnected) {
                try {
                    writeProductionSchedulePrintPreview(preview, productionSchedulePrintStatusDocument(project, appErrorMessage(error, 'Не удалось подготовить график к печати.'), true));
                } catch (previewError) {}
                preview.status.textContent = 'Не удалось подготовить график.';
                preview.status.classList.add('is-error');
            }
            showAppNotice(appErrorMessage(error, 'Не удалось подготовить график к печати.'), 'error');
            return null;
        }).finally(function () {
            if (trigger) {
                trigger.disabled = false;
                trigger.classList.remove('is-loading');
            }
        });
    }

    function renderProductionSchedule(project, schedule) {
        if (!project) return '';
        if (!schedule) return skeletonMarkup('table', 1);
        if (schedule.error) return '<section class="card production-schedule-card"><div class="section-schedule-empty">' + escapeHtml(schedule.error) + '</div></section>';
        var items = Array.isArray(schedule.items) ? schedule.items : [];
        var visibleDays = productionScheduleVisibleDays(project.id, schedule);
        var canEditSchedule = canManageSchedule();
        var guestView = hasRole('guest');
        var canSaveTemplate = isMainAdminRole() || hasRole('admin') || hasRole('director');
        var dayHeaders = '';
        for (var day = 1; day <= visibleDays; day += 1) {
            dayHeaders += '<th class="production-day-head" colspan="2">' + day + '</th>';
        }
        var tableHeader = '<thead><tr>' +
            '<th class="production-number-cell">№<br>п/п</th><th class="production-work-title">Наименование работ</th><th class="production-volume-cell">Объём работ</th><th class="production-people-cell">Кол-во<br>чел.</th><th class="production-shifts-cell">Кол-во<br>смен</th><th class="production-brigades-cell">Кол-во<br>бригад</th><th class="production-duration-cell">Продолжи-<br>тельность,<br>дн</th>' + dayHeaders +
        '</tr></thead>';
        var rows = [];
        var previousSection = null;
        items.forEach(function (item, itemIndex) {
            var operationId = productionOperationId(item);
            var sectionTitle = String(item.sectionTitle || '').trim();
            if (sectionTitle && sectionTitle !== previousSection) {
                rows.push('<tr class="production-section-row"><th colspan="' + String(7 + visibleDays * 2) + '">' + escapeHtml(sectionTitle) + '</th></tr>');
                previousSection = sectionTitle;
            }
            var colorKey = productionOperationColorKey(item, itemIndex);
            var operationMeta = guestView
                ? { originLabel: 'График производства', linkLabel: 'Только просмотр', linkKind: 'linked' }
                : productionOperationMeta(item);
            var rawOperationStatus = String(item.status || item.linkStatus || '').trim().toLowerCase();
            var canConfirmOperation = canEditSchedule && ['review', 'needs_review', 'requires_review', 'unverified'].indexOf(rawOperationStatus) >= 0;
            var confirmOperation = canConfirmOperation
                ? '<button type="button" class="production-confirm-operation" data-production-confirm-operation data-operation-id="' + escapeHtml(operationId) + '">Подтвердить</button>'
                : '';
            var filled = productionScheduleDaySet(item.filledSlots);
            var automatic = productionScheduleDaySet(item.autoFilledSlots);
            var overridden = productionScheduleDaySet(item.overriddenSlots);
            var cells = '';
            for (var cellDay = 1; cellDay <= visibleDays; cellDay += 1) {
                for (var half = 1; half <= 2; half += 1) {
                    var slotNumber = (cellDay - 1) * 2 + half;
                    var isFilled = !!filled[String(slotNumber)];
                    var isAutomatic = !!automatic[String(slotNumber)];
                    var isOverridden = !!overridden[String(slotNumber)];
                    var halfLabel = half === 1 ? 'первая половина' : 'вторая половина';
                    cells += '<td class="production-day-half-cell' + (half === 1 ? ' is-first-half' : ' is-second-half') + '"><button type="button" class="production-cell-toggle' + (isFilled ? ' is-filled' : '') + (isAutomatic ? ' is-auto' : '') + (isOverridden ? ' is-overridden' : '') + '" data-production-cell data-project-id="' + escapeHtml(project.id) + '" data-operation-id="' + escapeHtml(operationId) + '" data-slot-number="' + slotNumber + '" aria-pressed="' + (isFilled ? 'true' : 'false') + '" aria-label="' + escapeHtml((item.title || 'Работа') + ', день ' + cellDay + ', ' + halfLabel) + '"' + (canEditSchedule ? '' : ' disabled') + '></button></td>';
                }
            }
            var effectiveLabel = Number(item.effectiveDays || 0) !== Number(item.durationDays || 0)
                ? '<small>закрашено: ' + escapeHtml(String(item.effectiveDays || 0)) + '</small>'
                : '';
            var volumePlan = quantityPlanInfo(item || {});
            var hasVolume = item.plannedQty != null || item.planned_qty != null;
            var volume = (hasVolume ? quantityText(volumePlan.totalQty) : '—') + ' ' + (volumePlan.unit || 'ед.');
            var durationDays = Math.max(0.5, Math.min(3650, Math.round(Number(item.durationDays || 0.5) * 2) / 2));
            var durationInputId = 'production-duration-' + String(project.id) + '-' + String(item.id);
            var durationEditDisabled = canEditSchedule ? '' : ' disabled';
            var durationMinusDisabled = (!canEditSchedule || durationDays <= 0.5) ? ' disabled' : '';
            var durationPlusDisabled = (!canEditSchedule || durationDays >= 3650) ? ' disabled' : '';
            var autoDurationDays = Math.max(0.5, Math.round(Number(item.autoDays || durationDays) * 2) / 2);
            var durationReset = item.isDurationOverridden && canEditSchedule
                ? '<button type="button" class="production-duration-reset" data-production-duration-reset data-operation-id="' + escapeHtml(operationId) + '" title="Вернуть автоматический расчёт длительности">Авто: ' + escapeHtml(quantityText(autoDurationDays)) + ' дн.</button>'
                : '';
            var placementIsManual = String(item.placementMode || item.placement_mode || '').toLowerCase() === 'manual';
            var splitAttributes = durationDays < 1
                ? ' disabled title="Для разделения нужна длительность не меньше 1 дня"'
                : (placementIsManual ? ' disabled title="Сначала верните автоматическую раскладку этой работы"' : ' title="Разделить на две работы"');
            var rowActions = canEditSchedule ? '<span class="production-row-actions">' +
                '<button type="button" data-production-edit-operation data-operation-id="' + escapeHtml(operationId) + '" title="Редактировать" aria-label="Редактировать работу">✎</button>' +
                '<button type="button" data-production-split-operation data-operation-id="' + escapeHtml(operationId) + '"' + splitAttributes + ' aria-label="Разделить работу">⑂</button>' +
                '<button type="button" class="is-danger" data-production-delete-operation data-operation-id="' + escapeHtml(operationId) + '" title="Удалить" aria-label="Удалить работу">×</button>' +
            '</span>' : '';
            var dragHandle = canEditSchedule
                ? '<span class="production-drag-handle" data-production-drag-handle title="Перетащить работу" aria-label="Перетащить работу" tabindex="0">⋮⋮</span>'
                : '';
            rows.push('<tr class="production-work-row production-phase-' + colorKey + '" data-production-operation-row data-operation-id="' + escapeHtml(operationId) + '">' +
                '<td class="production-number-cell">' + dragHandle + '<span data-production-row-number>' + String(itemIndex + 1) + '</span></td>' +
                '<th class="production-work-title"><span class="production-work-heading"><b>' + escapeHtml(item.title || 'Работа') + '</b>' + rowActions + '</span><span class="production-work-meta"><small class="production-origin-label">' + escapeHtml(operationMeta.originLabel) + '</small><small class="production-link-label is-' + operationMeta.linkKind + '">' + escapeHtml(operationMeta.linkLabel) + '</small>' + confirmOperation + '</span></th>' +
                '<td class="production-volume-cell">' + escapeHtml(volume) + '</td>' +
                '<td class="production-people-cell">' + escapeHtml(String(item.peopleCount || item.crewSize || 1)) + '</td>' +
                '<td class="production-shifts-cell">' + escapeHtml(String(item.shiftCount || 1)) + '</td>' +
                '<td class="production-brigades-cell">' + escapeHtml(String(item.brigadeCount || 1)) + '</td>' +
                '<td class="production-duration-cell"><div class="production-duration-stepper" role="group" aria-label="' + escapeHtml('Продолжительность: ' + (item.title || 'Работа')) + '">' +
                    '<button type="button" class="production-duration-step-button" data-production-duration-step="-0.5" aria-controls="' + escapeHtml(durationInputId) + '" aria-label="Уменьшить длительность на 0,5 дня"' + durationMinusDisabled + '><span aria-hidden="true">−</span></button>' +
                    '<input id="' + escapeHtml(durationInputId) + '" type="number" inputmode="decimal" min="0.5" max="3650" step="0.5" value="' + escapeHtml(String(durationDays)) + '" data-production-duration data-project-id="' + escapeHtml(project.id) + '" data-operation-id="' + escapeHtml(operationId) + '" aria-label="Длительность в днях"' + durationEditDisabled + '>' +
                    '<button type="button" class="production-duration-step-button" data-production-duration-step="0.5" aria-controls="' + escapeHtml(durationInputId) + '" aria-label="Увеличить длительность на 0,5 дня"' + durationPlusDisabled + '><span aria-hidden="true">+</span></button>' +
                '</div>' + durationReset + effectiveLabel + '</td>' +
                cells + '</tr>');
        });
        if (!rows.length) {
            rows.push('<tr class="production-empty-row"><td colspan="' + String(7 + visibleDays * 2) + '"><b>График пока пуст</b><span>' + (guestView ? 'Опубликованные работы пока не добавлены.' : 'Добавьте первую работу вручную или пересчитайте черновик по смете.') + '</span></td></tr>');
        }
        return '<section class="card production-schedule-card" data-production-schedule-card data-project-id="' + escapeHtml(project.id) + '">' +
            '<div class="production-schedule-head"><div><span class="eyebrow">Приложение к графику работ</span><h3>График производства работ</h3><p>' + (guestView ? 'Актуальная последовательность работ по объекту. Каждая половина клетки — 0,5 дня.' : 'Авточерновик строится последовательно. Работы можно добавлять, связывать со сметой и переставлять; каждая половина клетки — 0,5 дня.') + '</p></div>' +
                '<div class="production-schedule-actions">' +
                    (canEditSchedule ? '<button class="primary compact" type="button" data-production-add-operation data-project-id="' + escapeHtml(project.id) + '">+ Добавить работу</button>' : '') +
                    '<button class="ghost compact production-print-button" type="button" data-production-print data-project-id="' + escapeHtml(project.id) + '"><i data-lucide="printer" aria-hidden="true"></i><span>Распечатать в PDF</span></button>' +
                    '<button class="ghost compact" type="button" data-production-add-days data-project-id="' + escapeHtml(project.id) + '">+ 7 дней</button>' +
                    (canSaveTemplate ? '<button class="ghost compact" type="button" data-production-save-template data-project-id="' + escapeHtml(project.id) + '">Сохранить шаблон</button>' : '') +
                    (canEditSchedule ? '<button class="ghost compact" type="button" data-production-reset-cells data-project-id="' + escapeHtml(project.id) + '">Вернуть авто-раскладку</button>' : '') +
                    (canManageSchedule() ? '<button class="ghost compact" type="button" data-production-recalculate data-project-id="' + escapeHtml(project.id) + '">Пересчитать автоматически</button>' : '') +
                '</div></div>' +
            (guestView ? '' : '<div class="production-recalculate-note"><b>Безопасный пересчёт:</b> обновляет автоматический черновик, сохраняя ручные операции, связи и ручную раскладку.</div>') +
            '<div class="production-scroll-hint" aria-hidden="true">Колесо: над названием — вверх/вниз, над графиком — по дням</div>' +
            '<div class="production-table-shell" data-production-table-shell>' +
                '<div class="production-table-scroll" data-production-table-scroll role="region" aria-label="График производства по дням" tabindex="0"><table class="production-schedule-table">' + tableHeader + '<tbody>' + rows.join('') + '</tbody></table></div>' +
            '</div>' +
        '</section>' + (canEditSchedule ? renderProductionOperationEditor(project, schedule) : '');
    }

    function renderSelectedProjectProductionSchedule() {
        var project = state.selectedProject;
        var panel = qs('[data-panel="production-schedule"]');
        if (!project || !panel) return;
        var scroll = qs('[data-production-table-scroll]', panel);
        var scrollLeft = scroll ? scroll.scrollLeft : 0;
        var scrollTop = scroll ? scroll.scrollTop : 0;
        safeReplaceChildren(panel, renderProductionSchedule(project, state.productionScheduleByProject[project.id] || null));
        bindProductionScheduleInteractions(project.id);
        refreshLucideIcons(panel);
        var nextScroll = qs('[data-production-table-scroll]', panel);
        if (nextScroll) {
            nextScroll.scrollLeft = scrollLeft;
            nextScroll.scrollTop = scrollTop;
            syncProductionScheduleScroll(nextScroll);
        }
    }

    function applyProductionScheduleResponse(projectId, schedule) {
        if (schedule && schedule.schedule && Array.isArray(schedule.schedule.items)) schedule = schedule.schedule;
        state.productionScheduleByProject[projectId] = schedule || null;
        if (state.selectedProject && Number(state.selectedProject.id) === Number(projectId)) {
            renderSelectedProjectProductionSchedule();
        }
    }

    function loadSelectedProjectProductionSchedule(force) {
        var project = state.selectedProject;
        if (!project || !project.id) return Promise.resolve(null);
        var projectId = project.id;
        state.productionScheduleByProject = state.productionScheduleByProject || {};
        state.productionScheduleLoadingByProject = state.productionScheduleLoadingByProject || {};
        if (!force && state.productionScheduleByProject[projectId]) {
            renderSelectedProjectProductionSchedule();
            return Promise.resolve(state.productionScheduleByProject[projectId]);
        }
        if (state.productionScheduleLoadingByProject[projectId]) return state.productionScheduleLoadingByProject[projectId];
        renderSelectedProjectProductionSchedule();
        var promise = api('/api/projects/' + projectId + '/production-schedule').then(function (schedule) {
            applyProductionScheduleResponse(projectId, schedule);
            return schedule;
        }).catch(function (error) {
            var message = appErrorMessage(error, 'Не удалось загрузить график производства.');
            state.productionScheduleByProject[projectId] = { error: message, items: [] };
            renderSelectedProjectProductionSchedule();
            return null;
        }).finally(function () {
            delete state.productionScheduleLoadingByProject[projectId];
        });
        state.productionScheduleLoadingByProject[projectId] = promise;
        return promise;
    }

    function saveProductionScheduleAction(projectId, payload, control) {
        if (control) control.disabled = true;
        var request = api('/api/projects/' + projectId + '/production-schedule', {
            method: 'POST',
            body: JSON.stringify(payload || {})
        }).then(function (schedule) {
            applyProductionScheduleResponse(projectId, schedule);
            return schedule;
        }).catch(function (error) {
            if (control) control.disabled = false;
            showAppNotice(appErrorMessage(error, 'Не удалось сохранить график производства.'), 'error');
            throw error;
        });
        state.productionSchedulePendingSavesByProject = state.productionSchedulePendingSavesByProject || {};
        var previous = state.productionSchedulePendingSavesByProject[projectId] || Promise.resolve(null);
        var tracked = Promise.all([
            Promise.resolve(previous).catch(function () { return null; }),
            request.catch(function () { return null; })
        ]).then(function () { return null; });
        state.productionSchedulePendingSavesByProject[projectId] = tracked;
        tracked.then(function () {
            if (state.productionSchedulePendingSavesByProject[projectId] === tracked) delete state.productionSchedulePendingSavesByProject[projectId];
        });
        return request;
    }

    function saveProductionDurationValue(projectId, input, rawDays) {
        var days = Math.max(0.5, Math.min(3650, Math.round(Number(rawDays || 0) * 2) / 2));
        if (!Number.isFinite(days)) {
            input.value = input.dataset.initialValue || '0.5';
            return Promise.resolve(null);
        }
        var previousValue = input.dataset.initialValue || input.value || '0.5';
        var stepper = input.closest ? input.closest('.production-duration-stepper') : null;
        var stepButtons = stepper ? qsa('[data-production-duration-step]', stepper) : [];
        var previousDisabled = stepButtons.map(function (button) { return button.disabled; });
        var inputWasDisabled = input.disabled;
        input.value = String(days);
        input.disabled = true;
        stepButtons.forEach(function (button) { button.disabled = true; });
        return saveProductionScheduleAction(projectId, {
            action: 'set_duration',
            operation_id: Number(input.dataset.operationId),
            duration_days: days
        }, null).catch(function (error) {
            input.value = previousValue;
            input.disabled = inputWasDisabled;
            stepButtons.forEach(function (button, index) { button.disabled = previousDisabled[index]; });
            throw error;
        });
    }

    function productionScheduleItemById(projectId, operationId) {
        var schedule = state.productionScheduleByProject && state.productionScheduleByProject[projectId];
        var items = Array.isArray(schedule && schedule.items) ? schedule.items : [];
        var wanted = String(operationId == null ? '' : operationId);
        return items.find(function (item) { return String(productionOperationId(item)) === wanted; }) || null;
    }

    function productionPayloadId(rawId) {
        var numeric = Number(rawId);
        return Number.isFinite(numeric) && String(rawId).trim() !== '' ? numeric : rawId;
    }

    function productionFormNumber(rawValue, fallback, minimum, rounding) {
        var normalized = String(rawValue == null ? '' : rawValue).trim().replace(',', '.');
        var value = Number(normalized);
        if (!Number.isFinite(value)) value = fallback;
        if (rounding === 'half') value = Math.round(value * 2) / 2;
        else if (rounding === 'integer') value = Math.round(value);
        return Math.max(minimum, value);
    }

    function productionSortedLinkIds(values) {
        return (Array.isArray(values) ? values : []).map(function (value) { return String(value); }).sort();
    }

    function productionOperationFormValues(form) {
        var plannedQtyText = String(form.elements.planned_qty.value == null ? '' : form.elements.planned_qty.value).trim();
        return {
            title: String(form.elements.title.value || '').trim(),
            plannedQty: plannedQtyText === '' ? null : productionFormNumber(plannedQtyText, 0, 0, null),
            unit: String(form.elements.unit.value || 'ед.').trim() || 'ед.',
            peopleCount: productionFormNumber(form.elements.people_count.value, 1, 1, 'integer'),
            shiftCount: productionFormNumber(form.elements.shift_count.value, 1, 1, 'integer'),
            brigadeCount: productionFormNumber(form.elements.brigade_count.value, 1, 1, 'integer'),
            durationDays: productionFormNumber(form.elements.duration_days.value, 0.5, 0.5, 'half'),
            linkedIds: productionSortedLinkIds(qsa('input[name="linked_estimate_item_ids"]:checked', form).map(function (input) { return input.value; }))
        };
    }

    function productionOperationItemValues(item, selectedLinkIds) {
        var rawQty = item && (item.plannedQty != null ? item.plannedQty : item.planned_qty);
        return {
            title: String(item && item.title || '').trim(),
            plannedQty: rawQty == null ? null : productionFormNumber(rawQty, 0, 0, null),
            unit: String(item && item.unit || 'ед.').trim() || 'ед.',
            peopleCount: productionFormNumber(item && (item.peopleCount || item.crewSize), 1, 1, 'integer'),
            shiftCount: productionFormNumber(item && item.shiftCount, 1, 1, 'integer'),
            brigadeCount: productionFormNumber(item && item.brigadeCount, 1, 1, 'integer'),
            durationDays: productionFormNumber(item && item.durationDays, 0.5, 0.5, 'half'),
            linkedIds: productionSortedLinkIds(selectedLinkIds)
        };
    }

    function closeProductionOperationEditor() {
        document.body.classList.remove('production-operation-editor-open');
        var panel = qs('[data-panel="production-schedule"]');
        if (!panel) return;
        qsa('[data-production-editor], [data-production-editor-overlay]', panel).forEach(function (node) {
            node.setAttribute('aria-hidden', 'true');
        });
    }

    function openProductionOperationEditor(projectId, operationId) {
        var panel = qs('[data-panel="production-schedule"]');
        var drawer = panel ? qs('[data-production-editor]', panel) : null;
        var form = drawer ? qs('[data-production-operation-form]', drawer) : null;
        if (!drawer || !form) return;
        var item = operationId == null ? null : productionScheduleItemById(projectId, operationId);
        var setValue = function (name, value) {
            if (form.elements && form.elements[name]) form.elements[name].value = value == null ? '' : String(value);
        };
        setValue('operation_id', item ? productionOperationId(item) : '');
        setValue('title', item ? item.title : '');
        setValue('planned_qty', item ? (item.plannedQty != null ? item.plannedQty : item.planned_qty) : '');
        setValue('unit', item ? (item.unit || 'ед.') : 'ед.');
        setValue('people_count', item ? (item.peopleCount || item.crewSize || 1) : 1);
        setValue('shift_count', item ? (item.shiftCount || 1) : 1);
        setValue('brigade_count', item ? (item.brigadeCount || 1) : 1);
        setValue('duration_days', item ? (item.durationDays || 0.5) : 0.5);
        var selectedLinks = productionScheduleDaySet(item ? productionLinkedEstimateIds(item) : []);
        qsa('input[name="linked_estimate_item_ids"]', form).forEach(function (input) {
            input.checked = !!selectedLinks[String(input.value)];
        });
        var visibleSelectedLinkIds = qsa('input[name="linked_estimate_item_ids"]:checked', form).map(function (input) { return input.value; });
        form._productionInitialValues = item ? productionOperationItemValues(item, visibleSelectedLinkIds) : null;
        var filter = qs('[data-production-link-filter]', form);
        if (filter) filter.value = '';
        qsa('[data-production-estimate-option]', form).forEach(function (option) { option.hidden = false; });
        var heading = qs('[data-production-editor-title]', drawer);
        if (heading) heading.textContent = item ? 'Редактирование работы' : 'Новая работа';
        var error = qs('[data-production-operation-error]', form);
        if (error) error.textContent = '';
        drawer.setAttribute('aria-hidden', 'false');
        var overlay = qs('[data-production-editor-overlay]', panel);
        if (overlay) overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('production-operation-editor-open');
        var titleInput = form.elements && form.elements.title;
        if (titleInput && typeof titleInput.focus === 'function') setTimeout(function () { titleInput.focus(); }, 60);
    }

    function productionOperationFormPayload(form) {
        var operationId = form.elements.operation_id.value;
        var values = productionOperationFormValues(form);
        if (!operationId) {
            return {
                action: 'add_operation',
                title: values.title,
                planned_qty: values.plannedQty,
                unit: values.unit,
                people_count: values.peopleCount,
                shift_count: values.shiftCount,
                brigade_count: values.brigadeCount,
                duration_days: values.durationDays,
                linked_estimate_item_ids: values.linkedIds.map(productionPayloadId)
            };
        }
        var initial = form._productionInitialValues || {};
        var payload = { action: 'update_operation', operation_id: productionPayloadId(operationId) };
        if (values.title !== initial.title) payload.title = values.title;
        if (values.plannedQty !== initial.plannedQty) payload.planned_qty = values.plannedQty;
        if (values.unit !== initial.unit) payload.unit = values.unit;
        if (values.peopleCount !== initial.peopleCount) payload.people_count = values.peopleCount;
        if (values.shiftCount !== initial.shiftCount) payload.shift_count = values.shiftCount;
        if (values.brigadeCount !== initial.brigadeCount) payload.brigade_count = values.brigadeCount;
        if (values.durationDays !== initial.durationDays) payload.duration_days = values.durationDays;
        if (values.linkedIds.join('|') !== productionSortedLinkIds(initial.linkedIds).join('|')) {
            payload.linked_estimate_item_ids = values.linkedIds.map(productionPayloadId);
        }
        return payload;
    }

    function productionOperationOrder(panel) {
        return qsa('[data-production-operation-row]', panel).map(function (row) {
            return productionPayloadId(row.dataset.operationId);
        });
    }

    function saveProductionOperationOrder(projectId, panel) {
        var operationIds = productionOperationOrder(panel);
        qsa('[data-production-operation-row]', panel).forEach(function (row, index) {
            var number = qs('[data-production-row-number]', row);
            if (number) number.textContent = String(index + 1);
        });
        return saveProductionScheduleAction(projectId, {
            action: 'reorder_operations',
            operation_ids: operationIds
        }, null);
    }

    function bindProductionScheduleInteractions(projectId) {
        var panel = qs('[data-panel="production-schedule"]');
        if (!panel) return;
        bindProductionScheduleScroll(qs('[data-production-table-scroll]', panel));
        qsa('[data-production-print]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                openProductionSchedulePrint(projectId, button);
            });
        });
        qsa('[data-production-cell]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var nextFilled = button.getAttribute('aria-pressed') !== 'true';
                saveProductionScheduleAction(projectId, {
                    action: 'set_cell',
                    operation_id: productionPayloadId(button.dataset.operationId),
                    slot_number: Number(button.dataset.slotNumber),
                    is_filled: nextFilled
                }, button).catch(function () {});
            });
        });
        qsa('[data-production-duration]', panel).forEach(function (input) {
            if (input.dataset.bound === '1') return;
            input.dataset.bound = '1';
            input.dataset.initialValue = input.value;
            input.addEventListener('change', function () {
                saveProductionDurationValue(projectId, input, input.value).catch(function () {});
            });
        });
        qsa('[data-production-duration-step]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                var stepper = button.closest ? button.closest('.production-duration-stepper') : null;
                var input = stepper ? qs('[data-production-duration]', stepper) : null;
                if (!input) return;
                var delta = Number(button.dataset.productionDurationStep || 0);
                saveProductionDurationValue(projectId, input, Number(input.value || 0) + delta).catch(function () {});
            });
        });
        qsa('[data-production-duration-reset]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                saveProductionScheduleAction(projectId, {
                    action: 'set_duration',
                    operation_id: productionPayloadId(button.dataset.operationId),
                    reset: true
                }, button).catch(function () {});
            });
        });
        qsa('[data-production-add-days]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                state.productionScheduleVisibleDaysByProject[projectId] = productionScheduleVisibleDays(projectId, state.productionScheduleByProject[projectId]) + 7;
                renderSelectedProjectProductionSchedule();
            });
        });
        qsa('[data-production-recalculate]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                if (!window.confirm('Пересчитать автоматический черновик? Ручные операции, связи, длительности и клетки будут сохранены.')) return;
                saveProductionScheduleAction(projectId, { action: 'recalculate', preserve_manual: true }, button).catch(function () {});
            });
        });
        qsa('[data-production-reset-cells]', panel).forEach(function (button) {
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';
            button.addEventListener('click', function () {
                if (!window.confirm('Убрать все ручные закрашенные клетки и вернуть последовательную авто-раскладку? Длительности и сами работы сохранятся.')) return;
                saveProductionScheduleAction(projectId, { action: 'reset_cells' }, button).catch(function () {});
            });
        });

        qsa('[data-production-add-operation]', panel).forEach(function (button) {
            button.addEventListener('click', function () { openProductionOperationEditor(projectId, null); });
        });
        qsa('[data-production-edit-operation]', panel).forEach(function (button) {
            button.addEventListener('click', function () { openProductionOperationEditor(projectId, button.dataset.operationId); });
        });
        qsa('[data-production-editor-close], [data-production-editor-overlay]', panel).forEach(function (button) {
            button.addEventListener('click', function () { closeProductionOperationEditor(); });
        });

        var editor = qs('[data-production-editor]', panel);
        if (editor) {
            editor.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeProductionOperationEditor();
            });
        }
        var linkFilter = qs('[data-production-link-filter]', panel);
        if (linkFilter) {
            linkFilter.addEventListener('input', function () {
                var query = String(linkFilter.value || '').trim().toLowerCase();
                qsa('[data-production-estimate-option]', panel).forEach(function (option) {
                    option.hidden = !!query && String(option.dataset.searchText || '').indexOf(query) < 0;
                });
            });
        }
        var operationForm = qs('[data-production-operation-form]', panel);
        if (operationForm) {
            operationForm.addEventListener('submit', function (event) {
                event.preventDefault();
                var payload = productionOperationFormPayload(operationForm);
                var error = qs('[data-production-operation-error]', operationForm);
                if (!String(operationForm.elements.title.value || '').trim()) {
                    if (error) error.textContent = 'Укажите наименование работы.';
                    return;
                }
                if (payload.action === 'update_operation' && Object.keys(payload).length === 2) {
                    closeProductionOperationEditor();
                    return;
                }
                var submit = qs('button[type="submit"]', operationForm);
                if (error) error.textContent = '';
                saveProductionScheduleAction(projectId, payload, submit).then(function () {
                    closeProductionOperationEditor();
                }).catch(function (saveError) {
                    if (error) error.textContent = appErrorMessage(saveError, 'Не удалось сохранить работу.');
                });
            });
        }

        qsa('[data-production-delete-operation]', panel).forEach(function (button) {
            button.addEventListener('click', function () {
                var item = productionScheduleItemById(projectId, button.dataset.operationId);
                if (!window.confirm('Удалить работу «' + String(item && item.title || 'Без названия') + '» из графика? Смета не изменится.')) return;
                saveProductionScheduleAction(projectId, {
                    action: 'delete_operation',
                    operation_id: productionPayloadId(button.dataset.operationId)
                }, button).catch(function () {});
            });
        });
        qsa('[data-production-confirm-operation]', panel).forEach(function (button) {
            button.addEventListener('click', function () {
                saveProductionScheduleAction(projectId, {
                    action: 'update_operation',
                    operation_id: productionPayloadId(button.dataset.operationId),
                    status: 'confirmed'
                }, button).catch(function () {});
            });
        });
        qsa('[data-production-split-operation]', panel).forEach(function (button) {
            button.addEventListener('click', function () {
                if (!window.confirm('Разделить работу на две последовательные операции? Объём и длительность будут поделены поровну.')) return;
                saveProductionScheduleAction(projectId, {
                    action: 'split_operation',
                    operation_id: productionPayloadId(button.dataset.operationId)
                }, button).catch(function () {});
            });
        });
        qsa('[data-production-save-template]', panel).forEach(function (button) {
            button.addEventListener('click', function () {
                if (!window.confirm('Сохранить всю текущую структуру графика как правило для похожих будущих смет?')) return;
                saveProductionScheduleAction(projectId, {
                    action: 'save_template'
                }, button).then(function () {
                    showAppNotice('Шаблон графика сохранён.', 'success');
                }).catch(function () {});
            });
        });

        var armedDragRow = null;
        var dragRow = null;
        var orderBeforeDrag = '';
        qsa('[data-production-drag-handle]', panel).forEach(function (handle) {
            handle.addEventListener('pointerdown', function () {
                armedDragRow = handle.closest('[data-production-operation-row]');
                if (armedDragRow) armedDragRow.setAttribute('draggable', 'true');
            });
            handle.addEventListener('keydown', function (event) {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                var row = handle.closest('[data-production-operation-row]');
                var rows = qsa('[data-production-operation-row]', panel);
                var index = rows.indexOf(row);
                var targetIndex = event.key === 'ArrowUp' ? index - 1 : index + 1;
                if (!row || targetIndex < 0 || targetIndex >= rows.length) return;
                event.preventDefault();
                if (event.key === 'ArrowUp') row.parentNode.insertBefore(row, rows[targetIndex]);
                else row.parentNode.insertBefore(row, rows[targetIndex].nextSibling);
                saveProductionOperationOrder(projectId, panel).catch(function () { renderSelectedProjectProductionSchedule(); });
            });
        });
        qsa('[data-production-operation-row]', panel).forEach(function (row) {
            row.addEventListener('dragstart', function (event) {
                if (armedDragRow !== row) {
                    event.preventDefault();
                    return;
                }
                dragRow = row;
                orderBeforeDrag = productionOperationOrder(panel).join('|');
                row.classList.add('is-dragging');
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(row.dataset.operationId || ''));
                }
            });
            row.addEventListener('dragover', function (event) {
                if (!dragRow || dragRow === row) return;
                event.preventDefault();
                var rect = row.getBoundingClientRect();
                var after = event.clientY > rect.top + rect.height / 2;
                row.parentNode.insertBefore(dragRow, after ? row.nextSibling : row);
            });
            row.addEventListener('drop', function (event) { event.preventDefault(); });
            row.addEventListener('dragend', function () {
                row.classList.remove('is-dragging');
                row.removeAttribute('draggable');
                armedDragRow = null;
                dragRow = null;
                var nextOrder = productionOperationOrder(panel).join('|');
                if (nextOrder !== orderBeforeDrag) saveProductionOperationOrder(projectId, panel).catch(function () { renderSelectedProjectProductionSchedule(); });
            });
        });
    }

    PMBI.planning = PMBI.planning || {};
        if (typeof scheduleTypeLabel === 'function') PMBI.planning.scheduleTypeLabel = scheduleTypeLabel;
        if (typeof getScheduleState === 'function') PMBI.planning.getScheduleState = getScheduleState;
        if (typeof scheduleStateKind === 'function') PMBI.planning.scheduleStateKind = scheduleStateKind;
        if (typeof scheduleStateTitle === 'function') PMBI.planning.scheduleStateTitle = scheduleStateTitle;
        if (typeof scheduleStateMeta === 'function') PMBI.planning.scheduleStateMeta = scheduleStateMeta;
        if (typeof renderScheduleStateBoard === 'function') PMBI.planning.renderScheduleStateBoard = renderScheduleStateBoard;
        if (typeof bindScheduleStatusActions === 'function') PMBI.planning.bindScheduleStatusActions = bindScheduleStatusActions;
        if (typeof renderAutoScheduleDrawer === 'function') PMBI.planning.renderAutoScheduleDrawer = renderAutoScheduleDrawer;
        if (typeof renderSchedulePlanner === 'function') PMBI.planning.renderSchedulePlanner = renderSchedulePlanner;
        if (typeof renderScheduleRows === 'function') PMBI.planning.renderScheduleRows = renderScheduleRows;
        if (typeof renderSectionScheduleRow === 'function') PMBI.planning.renderSectionScheduleRow = renderSectionScheduleRow;
        if (typeof renderSectionScheduleForecast === 'function') PMBI.planning.renderSectionScheduleForecast = renderSectionScheduleForecast;
        if (typeof bindSectionScheduleRefresh === 'function') PMBI.planning.bindSectionScheduleRefresh = bindSectionScheduleRefresh;
        if (typeof renderSchedulePanel === 'function') PMBI.planning.renderSchedulePanel = renderSchedulePanel;
        if (typeof renderProjectSchedulePriceTables === 'function') PMBI.planning.renderProjectSchedulePriceTables = renderProjectSchedulePriceTables;
        if (typeof renderProjectCalendarPanel === 'function') PMBI.planning.renderProjectCalendarPanel = renderProjectCalendarPanel;
        if (typeof bindProjectScheduleViews === 'function') PMBI.planning.bindProjectScheduleViews = bindProjectScheduleViews;
        if (typeof buildScheduleStageSummary === 'function') PMBI.planning.buildScheduleStageSummary = buildScheduleStageSummary;
        if (typeof scheduleTimelineClass === 'function') PMBI.planning.scheduleTimelineClass = scheduleTimelineClass;
        if (typeof finalSectionSummaryNumber === 'function') PMBI.planning.finalSectionSummaryNumber = finalSectionSummaryNumber;
        if (typeof finalSectionSummaryTitle === 'function') PMBI.planning.finalSectionSummaryTitle = finalSectionSummaryTitle;
        if (typeof renderScheduleStageBadges === 'function') PMBI.planning.renderScheduleStageBadges = renderScheduleStageBadges;
        if (typeof closeAutoScheduleDrawer === 'function') PMBI.planning.closeAutoScheduleDrawer = closeAutoScheduleDrawer;
        if (typeof openAutoScheduleDrawer === 'function') PMBI.planning.openAutoScheduleDrawer = openAutoScheduleDrawer;
        if (typeof bindAutoScheduleForm === 'function') PMBI.planning.bindAutoScheduleForm = bindAutoScheduleForm;
        if (typeof renderSchedulePage === 'function') PMBI.planning.renderSchedulePage = renderSchedulePage;
        if (typeof renderScheduleProject === 'function') PMBI.planning.renderScheduleProject = renderScheduleProject;
        if (typeof renderScheduleProjectSummary === 'function') PMBI.planning.renderScheduleProjectSummary = renderScheduleProjectSummary;
        if (typeof collectNextStageDate === 'function') PMBI.planning.collectNextStageDate = collectNextStageDate;
        if (typeof renderScheduleActionCenter === 'function') PMBI.planning.renderScheduleActionCenter = renderScheduleActionCenter;
        if (typeof buildScheduleActions === 'function') PMBI.planning.buildScheduleActions = buildScheduleActions;
        if (typeof renderScheduleActionCard === 'function') PMBI.planning.renderScheduleActionCard = renderScheduleActionCard;
        if (typeof bindScheduleActionButtons === 'function') PMBI.planning.bindScheduleActionButtons = bindScheduleActionButtons;
        if (typeof renderScheduleCalendar === 'function') PMBI.planning.renderScheduleCalendar = renderScheduleCalendar;
        if (typeof buildScheduleCalendarRange === 'function') PMBI.planning.buildScheduleCalendarRange = buildScheduleCalendarRange;
        if (typeof renderScheduleScale === 'function') PMBI.planning.renderScheduleScale = renderScheduleScale;
        if (typeof scheduleDeadlineState === 'function') PMBI.planning.scheduleDeadlineState = scheduleDeadlineState;
        if (typeof scheduleDeadlineBadge === 'function') PMBI.planning.scheduleDeadlineBadge = scheduleDeadlineBadge;
        if (typeof renderScheduleCalendarRow === 'function') PMBI.planning.renderScheduleCalendarRow = renderScheduleCalendarRow;
        if (typeof renderScheduleProcurementBoard === 'function') PMBI.planning.renderScheduleProcurementBoard = renderScheduleProcurementBoard;
        if (typeof loadSectionScheduleForecast === 'function') PMBI.planning.loadSectionScheduleForecast = loadSectionScheduleForecast;
        if (typeof finalSectionScheduleCardClass === 'function') PMBI.planning.finalSectionScheduleCardClass = finalSectionScheduleCardClass;
        if (typeof sectionAccelerationHint === 'function') PMBI.planning.sectionAccelerationHint = sectionAccelerationHint;
        if (typeof sectionAccelerationShortHint === 'function') PMBI.planning.sectionAccelerationShortHint = sectionAccelerationShortHint;
        if (typeof renderSectionScheduleBrief === 'function') PMBI.planning.renderSectionScheduleBrief = renderSectionScheduleBrief;
        if (typeof materialProgress === 'function') PMBI.planning.materialProgress = materialProgress;
        if (typeof workProgress === 'function') PMBI.planning.workProgress = workProgress;
        if (typeof workProgressForRows === 'function') PMBI.planning.workProgressForRows = workProgressForRows;
        if (typeof liveScheduleSectionItems === 'function') PMBI.planning.liveScheduleSectionItems = liveScheduleSectionItems;
        if (typeof isScheduleWorkDone === 'function') PMBI.planning.isScheduleWorkDone = isScheduleWorkDone;
        if (typeof setScheduleWorkDone === 'function') PMBI.planning.setScheduleWorkDone = setScheduleWorkDone;
        if (typeof scheduleChecklistStorageKey === 'function') PMBI.planning.scheduleChecklistStorageKey = scheduleChecklistStorageKey;
        if (typeof normalizedWorkKeyPart === 'function') PMBI.planning.normalizedWorkKeyPart = normalizedWorkKeyPart;
        if (typeof normalizedWorkQty === 'function') PMBI.planning.normalizedWorkQty = normalizedWorkQty;
        if (typeof scheduleWorkKey === 'function') PMBI.planning.scheduleWorkKey = scheduleWorkKey;
        if (typeof scheduleSectionKey === 'function') PMBI.planning.scheduleSectionKey = scheduleSectionKey;
        if (typeof isScheduleSectionOpen === 'function') PMBI.planning.isScheduleSectionOpen = isScheduleSectionOpen;
        if (typeof setScheduleSectionOpen === 'function') PMBI.planning.setScheduleSectionOpen = setScheduleSectionOpen;
        if (typeof setScheduleBriefPinned === 'function') PMBI.planning.setScheduleBriefPinned = setScheduleBriefPinned;
        if (typeof isScheduleBriefPinned === 'function') PMBI.planning.isScheduleBriefPinned = isScheduleBriefPinned;
        if (typeof scheduleSectionDetails === 'function') PMBI.planning.scheduleSectionDetails = scheduleSectionDetails;
        if (typeof scheduleSectionToggleIcon === 'function') PMBI.planning.scheduleSectionToggleIcon = scheduleSectionToggleIcon;
        if (typeof isScheduleSectionFullyChecked === 'function') PMBI.planning.isScheduleSectionFullyChecked = isScheduleSectionFullyChecked;
        if (typeof renderScheduleStageCard === 'function') PMBI.planning.renderScheduleStageCard = renderScheduleStageCard;
        if (typeof renderScheduleMaterials === 'function') PMBI.planning.renderScheduleMaterials = renderScheduleMaterials;
        if (typeof renderScheduleWorks === 'function') PMBI.planning.renderScheduleWorks = renderScheduleWorks;
        if (typeof renderScheduleSectionDetailsShell === 'function') PMBI.planning.renderScheduleSectionDetailsShell = renderScheduleSectionDetailsShell;
        if (typeof toggleScheduleSectionDom === 'function') PMBI.planning.toggleScheduleSectionDom = toggleScheduleSectionDom;
        if (typeof scheduleSectionProgress === 'function') PMBI.planning.scheduleSectionProgress = scheduleSectionProgress;
        if (typeof projectScheduleProgress === 'function') PMBI.planning.projectScheduleProgress = projectScheduleProgress;
        if (typeof bindWorkQuantityRows === 'function') PMBI.planning.bindWorkQuantityRows = bindWorkQuantityRows;
        if (typeof bindSectionScheduleInteractions === 'function') PMBI.planning.bindSectionScheduleInteractions = bindSectionScheduleInteractions;
        if (typeof isScheduleProjectOpen === 'function') PMBI.planning.isScheduleProjectOpen = isScheduleProjectOpen;
        if (typeof setScheduleProjectOpen === 'function') PMBI.planning.setScheduleProjectOpen = setScheduleProjectOpen;
        if (typeof scheduleProjectDetails === 'function') PMBI.planning.scheduleProjectDetails = scheduleProjectDetails;
        if (typeof setScheduleProjectDetails === 'function') PMBI.planning.setScheduleProjectDetails = setScheduleProjectDetails;
        if (typeof scheduleProjectBody === 'function') PMBI.planning.scheduleProjectBody = scheduleProjectBody;
        if (typeof scheduleProjectById === 'function') PMBI.planning.scheduleProjectById = scheduleProjectById;
        if (typeof scheduleForecastPromise === 'function') PMBI.planning.scheduleForecastPromise = scheduleForecastPromise;
        if (typeof renderScheduleProjectObjectSummary === 'function') PMBI.planning.renderScheduleProjectObjectSummary = renderScheduleProjectObjectSummary;
        if (typeof renderScheduleProjectDetails === 'function') PMBI.planning.renderScheduleProjectDetails = renderScheduleProjectDetails;
        if (typeof loadScheduleProjectDetails === 'function') PMBI.planning.loadScheduleProjectDetails = loadScheduleProjectDetails;
        if (typeof refreshScheduleProjectBody === 'function') PMBI.planning.refreshScheduleProjectBody = refreshScheduleProjectBody;
        if (typeof bindSchedulePageActualQuantityInputs === 'function') PMBI.planning.bindSchedulePageActualQuantityInputs = bindSchedulePageActualQuantityInputs;
        if (typeof bindSchedulePageProjectDetails === 'function') PMBI.planning.bindSchedulePageProjectDetails = bindSchedulePageProjectDetails;
        if (typeof bindScheduleProjectAccordions === 'function') PMBI.planning.bindScheduleProjectAccordions = bindScheduleProjectAccordions;
        if (typeof materialScheduleForProject === 'function') PMBI.planning.materialScheduleForProject = materialScheduleForProject;
        if (typeof setMaterialScheduleForProject === 'function') PMBI.planning.setMaterialScheduleForProject = setMaterialScheduleForProject;
        if (typeof normalizeMaterialSchedule === 'function') PMBI.planning.normalizeMaterialSchedule = normalizeMaterialSchedule;
        if (typeof fallbackMaterialLeadDays === 'function') PMBI.planning.fallbackMaterialLeadDays = fallbackMaterialLeadDays;
        if (typeof buildClientMaterialSchedule === 'function') PMBI.planning.buildClientMaterialSchedule = buildClientMaterialSchedule;
        if (typeof loadMaterialSchedule === 'function') PMBI.planning.loadMaterialSchedule = loadMaterialSchedule;
        if (typeof materialScheduleStatusClass === 'function') PMBI.planning.materialScheduleStatusClass = materialScheduleStatusClass;
        if (typeof materialScheduleStatusBadge === 'function') PMBI.planning.materialScheduleStatusBadge = materialScheduleStatusBadge;
        if (typeof materialScheduleDayText === 'function') PMBI.planning.materialScheduleDayText = materialScheduleDayText;
        if (typeof materialScheduleRange === 'function') PMBI.planning.materialScheduleRange = materialScheduleRange;
        if (typeof materialSchedulePercent === 'function') PMBI.planning.materialSchedulePercent = materialSchedulePercent;
        if (typeof renderMaterialScheduleScale === 'function') PMBI.planning.renderMaterialScheduleScale = renderMaterialScheduleScale;
        if (typeof renderMaterialScheduleTimeline === 'function') PMBI.planning.renderMaterialScheduleTimeline = renderMaterialScheduleTimeline;
        if (typeof materialScheduleView === 'function') PMBI.planning.materialScheduleView = materialScheduleView;
        if (typeof setMaterialScheduleView === 'function') PMBI.planning.setMaterialScheduleView = setMaterialScheduleView;
        if (typeof isoMonthStart === 'function') PMBI.planning.isoMonthStart = isoMonthStart;
        if (typeof isoMonthAdd === 'function') PMBI.planning.isoMonthAdd = isoMonthAdd;
        if (typeof isoWeekStart === 'function') PMBI.planning.isoWeekStart = isoWeekStart;
        if (typeof isoMonthDays === 'function') PMBI.planning.isoMonthDays = isoMonthDays;
        if (typeof materialCalendarDays === 'function') PMBI.planning.materialCalendarDays = materialCalendarDays;
        if (typeof materialCalendarTitle === 'function') PMBI.planning.materialCalendarTitle = materialCalendarTitle;
        if (typeof materialCalendarMove === 'function') PMBI.planning.materialCalendarMove = materialCalendarMove;
        if (typeof materialScheduleQtyTitle === 'function') PMBI.planning.materialScheduleQtyTitle = materialScheduleQtyTitle;
        if (typeof materialCalendarItemsForDay === 'function') PMBI.planning.materialCalendarItemsForDay = materialCalendarItemsForDay;
        if (typeof materialCalendarHasWindow === 'function') PMBI.planning.materialCalendarHasWindow = materialCalendarHasWindow;
        if (typeof renderMaterialCalendarCard === 'function') PMBI.planning.renderMaterialCalendarCard = renderMaterialCalendarCard;
        if (typeof renderMaterialCalendarOverflow === 'function') PMBI.planning.renderMaterialCalendarOverflow = renderMaterialCalendarOverflow;
        if (typeof materialScheduleIsoDate === 'function') PMBI.planning.materialScheduleIsoDate = materialScheduleIsoDate;
        if (typeof materialScheduleSafeIsoAdd === 'function') PMBI.planning.materialScheduleSafeIsoAdd = materialScheduleSafeIsoAdd;
        if (typeof materialScheduleIsUnbought === 'function') PMBI.planning.materialScheduleIsUnbought = materialScheduleIsUnbought;
        if (typeof materialScheduleNeedsAttention === 'function') PMBI.planning.materialScheduleNeedsAttention = materialScheduleNeedsAttention;
        if (typeof materialScheduleNeedsCriticalPing === 'function') PMBI.planning.materialScheduleNeedsCriticalPing = materialScheduleNeedsCriticalPing;
        if (typeof materialScheduleAlertIsoDate === 'function') PMBI.planning.materialScheduleAlertIsoDate = materialScheduleAlertIsoDate;
        if (typeof materialSchedulePlanningIsoDate === 'function') PMBI.planning.materialSchedulePlanningIsoDate = materialSchedulePlanningIsoDate;
        if (typeof materialScheduleHasBadPlanningYear === 'function') PMBI.planning.materialScheduleHasBadPlanningYear = materialScheduleHasBadPlanningYear;
        if (typeof materialScheduleCalendarModel === 'function') PMBI.planning.materialScheduleCalendarModel = materialScheduleCalendarModel;
        if (typeof renderMaterialCalendarCell === 'function') PMBI.planning.renderMaterialCalendarCell = renderMaterialCalendarCell;
        if (typeof materialScheduleFindItem === 'function') PMBI.planning.materialScheduleFindItem = materialScheduleFindItem;
        if (typeof materialScheduleDayItems === 'function') PMBI.planning.materialScheduleDayItems = materialScheduleDayItems;
        if (typeof closeDayMaterialsModal === 'function') PMBI.planning.closeDayMaterialsModal = closeDayMaterialsModal;
        if (typeof ensureDayMaterialsModal === 'function') PMBI.planning.ensureDayMaterialsModal = ensureDayMaterialsModal;
        if (typeof materialModalQuantityMeta === 'function') PMBI.planning.materialModalQuantityMeta = materialModalQuantityMeta;
        if (typeof renderDayMaterialModalRow === 'function') PMBI.planning.renderDayMaterialModalRow = renderDayMaterialModalRow;
        if (typeof calendarModalSectionTitle === 'function') PMBI.planning.calendarModalSectionTitle = calendarModalSectionTitle;
        if (typeof sectionTitleForMaterial === 'function') PMBI.planning.sectionTitleForMaterial = sectionTitleForMaterial;
        if (typeof estimateTotalSectionCount === 'function') PMBI.planning.estimateTotalSectionCount = estimateTotalSectionCount;
        if (typeof groupDayMaterialItemsBySection === 'function') PMBI.planning.groupDayMaterialItemsBySection = groupDayMaterialItemsBySection;
        if (typeof renderDayMaterialModalGroups === 'function') PMBI.planning.renderDayMaterialModalGroups = renderDayMaterialModalGroups;
        if (typeof showDayMaterialsModal === 'function') PMBI.planning.showDayMaterialsModal = showDayMaterialsModal;
        if (typeof closeMaterialScheduleDrawer === 'function') PMBI.planning.closeMaterialScheduleDrawer = closeMaterialScheduleDrawer;
        if (typeof openMaterialScheduleDrawer === 'function') PMBI.planning.openMaterialScheduleDrawer = openMaterialScheduleDrawer;
        if (typeof refreshMaterialScheduleProject === 'function') PMBI.planning.refreshMaterialScheduleProject = refreshMaterialScheduleProject;
        if (typeof materialScheduleRenderKey === 'function') PMBI.planning.materialScheduleRenderKey = materialScheduleRenderKey;
        if (typeof renderMaterialScheduleContainer === 'function') PMBI.planning.renderMaterialScheduleContainer = renderMaterialScheduleContainer;
        if (typeof ensureMaterialScheduleContainer === 'function') PMBI.planning.ensureMaterialScheduleContainer = ensureMaterialScheduleContainer;
        if (typeof bindMaterialCalendarCells === 'function') PMBI.planning.bindMaterialCalendarCells = bindMaterialCalendarCells;
        if (typeof replaceSelectedProjectMaterialCalendar === 'function') PMBI.planning.replaceSelectedProjectMaterialCalendar = replaceSelectedProjectMaterialCalendar;
        if (typeof isSelectedProjectScheduleTabActive === 'function') PMBI.planning.isSelectedProjectScheduleTabActive = isSelectedProjectScheduleTabActive;
        if (typeof loadSelectedProjectMaterialSchedule === 'function') PMBI.planning.loadSelectedProjectMaterialSchedule = loadSelectedProjectMaterialSchedule;
        if (typeof renderProductionSchedule === 'function') PMBI.planning.renderProductionSchedule = renderProductionSchedule;
        if (typeof productionSchedulePrintDayCount === 'function') PMBI.planning.productionSchedulePrintDayCount = productionSchedulePrintDayCount;
        if (typeof productionSchedulePrintDocument === 'function') PMBI.planning.productionSchedulePrintDocument = productionSchedulePrintDocument;
        if (typeof loadProductionScheduleForPrint === 'function') PMBI.planning.loadProductionScheduleForPrint = loadProductionScheduleForPrint;
        if (typeof openProductionSchedulePrint === 'function') PMBI.planning.openProductionSchedulePrint = openProductionSchedulePrint;
        if (typeof bindProductionScheduleInteractions === 'function') PMBI.planning.bindProductionScheduleInteractions = bindProductionScheduleInteractions;
        if (typeof loadSelectedProjectProductionSchedule === 'function') PMBI.planning.loadSelectedProjectProductionSchedule = loadSelectedProjectProductionSchedule;
        if (typeof focusProjectMaterialRow === 'function') PMBI.planning.focusProjectMaterialRow = focusProjectMaterialRow;
        if (typeof focusProjectScheduleTarget === 'function') PMBI.planning.focusProjectScheduleTarget = focusProjectScheduleTarget;
        if (typeof bindMaterialScheduleTimeline === 'function') PMBI.planning.bindMaterialScheduleTimeline = bindMaterialScheduleTimeline;
    window.PMBI = PMBI;
})();
