(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    if (PMBI.economicsManagement && PMBI.economicsManagement.__loaded) return;

    var api = PMBI.api;
    var qs = PMBI.qs || function (selector, root) { return (root || document).querySelector(selector); };
    var qsa = PMBI.qsa || function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
    var escapeHtml = PMBI.escapeHtml || function (value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
    var money = PMBI.money || function (value) { return String(Number(value || 0).toFixed(2)) + ' ₽'; };
    var showAppNotice = PMBI.showAppNotice || function () {};
    var appErrorMessage = PMBI.appErrorMessage || function (error, fallback) {
        return error && error.payload && (error.payload.message || error.payload.error)
            ? (error.payload.message || error.payload.error)
            : fallback;
    };
    var withSubmitLock = PMBI.withSubmitLock || function (_target, factory) { return Promise.resolve().then(factory); };
    var refreshLucideIcons = PMBI.refreshLucideIcons || function () {};
    var canViewProjectEconomics = PMBI.canViewProjectEconomics || function () { return false; };
    var skeletonMarkup = PMBI.skeletonMarkup || function () { return ''; };

    var cacheByProject = Object.create(null);
    var promiseByProject = Object.create(null);
    var cacheGenerationByProject = Object.create(null);
    var uiByProject = Object.create(null);
    var CACHE_TTL_MS = 30000;
    var BUNDLE_SECTIONS = [
        ['baselines', 'финансовые базы'],
        ['commitments', 'обязательства'],
        ['actualCosts', 'фактические затраты'],
        ['cashFlow', 'денежный поток'],
        ['forecasts', 'прогнозы'],
        ['documents', 'документы'],
        ['supplierOffers', 'предложения поставщиков'],
        ['forecastPriceSources', 'снимки AutoBot'],
        ['economics', 'сводка экономики'],
        ['legacyMigration', 'legacy-классификация']
    ];
    var DIRTY_FORM_SELECTOR = [
        '[data-econ-baseline-update]',
        '[data-econ-commitment-update]',
        '[data-econ-actual-update]',
        '[data-econ-allocation-update]',
        '[data-econ-legacy-update]'
    ].join(', ');

    var MODES = [
        { key: 'baseline', step: '01', label: 'Плановая база', description: 'Выручка и лимиты', icon: 'landmark' },
        { key: 'commitments', step: '02', label: 'Обязательства и заказы', description: 'Договоры и закупки', icon: 'file-check-2' },
        { key: 'actual', step: '03', label: 'Выполнение', description: 'Принятые затраты', icon: 'clipboard-check' },
        { key: 'cash', step: '04', label: 'Связь с оплатой', description: 'Разнесение денег', icon: 'split' },
        { key: 'forecast', step: '05', label: 'Итоговый прогноз', description: 'ETC, EAC и маржа', icon: 'chart-no-axes-combined' },
        { key: 'legacy', step: '••', label: 'Перенос данных', description: 'Разбор Legacy', icon: 'archive-restore' }
    ];

    var STATUS_LABELS = {
        draft: 'Черновик',
        pending_approval: 'На утверждении',
        approved: 'Утверждено',
        superseded: 'Заменено',
        cancelled: 'Отменено',
        unreviewed: 'Не разобрано',
        ready_for_review: 'Готово к подтверждению',
        blocked_anomaly: 'Есть блокирующие аномалии',
        confirmed: 'Классификация подтверждена',
        ignored: 'Исключено из миграции'
    };

    var EVENT_LABELS = {
        create_financial_baseline: 'Создана версия базы',
        update_financial_baseline: 'Изменены данные базы',
        submit_financial_baseline: 'База отправлена на утверждение',
        return_financial_baseline: 'База возвращена на доработку',
        approve_financial_baseline: 'База утверждена',
        supersede_financial_baseline: 'Версия базы заменена',
        created: 'Создано',
        updated: 'Изменено',
        submitted: 'Отправлено на утверждение',
        returned: 'Возвращено на доработку',
        approved: 'Утверждено',
        cancelled: 'Отменено',
        reversed: 'Сторнировано',
        reversal_created: 'Создано сторно',
        calculated: 'Прогноз рассчитан'
    };

    var ERROR_LABELS = {
        reason_required: 'Укажите основание операции.',
        return_reason_required: 'Укажите причину возврата на доработку.',
        financial_baseline_not_draft: 'Редактировать можно только черновик финансовой базы.',
        financial_baseline_not_pending: 'Версия базы уже вышла из статуса согласования.',
        baseline_effective_from_required: 'Укажите дату начала действия финансовой базы.',
        positive_baseline_revenue_required: 'Договорная выручка должна быть больше нуля.',
        positive_baseline_target_cost_required: 'Целевая себестоимость должна быть больше нуля.',
        baseline_sources_changed_return_to_draft: 'После отправки источники изменились. Верните версию в черновик и отправьте повторно.',
        baseline_replacement_requires_operational_mapping: 'Нельзя заменить действующую базу без переноса связанных обязательств, факта и оплат.',
        approved_source_baseline_required: 'Для сопоставления нужна действующая утверждённая финансовая база.',
        newer_approved_baseline_exists: 'Появилась более новая утверждённая база. Обновите данные и создайте новую версию.',
        bad_successor_mappings: 'Проверьте строки сопоставления версий.',
        bad_budget_successor_mapping: 'Некорректно заполнено сопоставление строки себестоимости.',
        bad_revenue_successor_mapping: 'Некорректно заполнено сопоставление строки выручки.',
        bad_successor_mapping_kind: 'Выбран неизвестный способ переноса строки.',
        successor_mapping_reason_required: 'Для каждой переносимой строки укажите причину сопоставления.',
        bad_successor_quantity_factor: 'Коэффициент пересчёта количества должен быть больше нуля.',
        successor_quantity_factor_required_for_unit_change: 'При смене единицы измерения явно укажите коэффициент пересчёта количества.',
        duplicate_source_budget_successor: 'Одна строка себестоимости сопоставлена несколько раз.',
        duplicate_source_revenue_successor: 'Одна строка выручки сопоставлена несколько раз.',
        invalid_budget_successor_lines: 'Выбрана недопустимая пара строк себестоимости.',
        invalid_revenue_successor_lines: 'Выбрана недопустимая пара строк выручки.',
        approved_financial_baseline_required: 'Сначала утвердите финансовую базу объекта.',
        commitment_budget_mapping_required: 'Выберите строку целевой себестоимости для каждой строки обязательства.',
        commitment_number_required: 'Для утверждения обязательства нужен номер заказа или договора.',
        commitment_not_editable: 'Редактировать можно только черновик обязательства.',
        actual_cost_budget_mapping_required: 'Выберите строку бюджета, к которой относится фактическая затрата.',
        source_document_required: 'Для этого вида факта нужен подтверждающий документ.',
        accepted_non_invoice_document_required: 'Документ должен быть принят или утверждён; счёт сам по себе фактом затрат не является.',
        paid_dated_finance_entry_required: 'Разнести можно только фактически проведённый платёж с датой.',
        payment_allocation_exceeds_payment: 'Сумма разнесения превышает нераспределённый остаток платежа.',
        forecast_price_normalization_required: 'Для источника прогноза укажите режим и ставку НДС.',
        forecast_price_source_required: 'Для незакрытого остатка нужна ручная прогнозная цена и основание.',
        forecast_sources_changed_recalculate: 'Исходные данные изменились. Рассчитайте новую версию прогноза.',
        approved_project_commitment_required: 'Связанное обязательство должно быть утверждено.',
        legacy_migration_open_review_exists: 'У проекта уже есть незавершённый разбор. Завершите или исключите его перед новым сканированием.',
        legacy_review_revision_conflict: 'Разбор уже изменён в другой сессии. Обновите данные перед повторным сохранением.',
        legacy_source_hash_conflict: 'Исходные legacy-данные изменились. Выполните повторное сканирование.',
        legacy_source_changed_rescan_required: 'После разбора исходные legacy-данные изменились. Нужен новый снимок.',
        legacy_evidence_changed: 'Файл подтверждающего документа изменился после сохранения разбора.',
        legacy_migration_review_is_terminal: 'Подтверждённый или исключённый разбор больше нельзя редактировать.',
        legacy_budget_classification_required: 'Классифицируйте поле legacy-бюджета.',
        legacy_estimate_classification_required: 'Классифицируйте цены строк legacy-сметы.',
        legacy_sources_comparable_decision_required: 'Укажите, сопоставимы ли legacy-бюджет и итог сметы.',
        legacy_effective_from_required: 'Укажите дату начала действия создаваемой базы.',
        legacy_discrepancy_comment_required: 'Объясните расхождение legacy-бюджета и итога сметы.',
        legacy_budget_decision_required: 'Укажите назначение для legacy-бюджета.',
        legacy_all_estimate_items_must_be_classified: 'Укажите назначение для каждой строки legacy-сметы.',
        legacy_budget_target_mismatch: 'Назначение legacy-бюджета не соответствует выбранной классификации.',
        legacy_estimate_target_mismatch: 'Назначение строки сметы не соответствует выбранной классификации.',
        legacy_decision_comment_required: 'Для включаемой строки укажите комментарий к решению.',
        legacy_vat_mode_required: 'Для включаемой строки определите режим НДС.',
        legacy_evidence_required: 'Для включаемой строки выберите подтверждающий источник.',
        legacy_evidence_reference_required: 'У подтверждающего документа должна быть ссылка или реквизиты источника.',
        legacy_evidence_file_required: 'Подтверждающий документ должен иметь сохранённый файл.',
        legacy_anomaly_resolution_required: 'Разберите все затрагивающие выбранные источники аномалии.',
        legacy_warning_must_be_acknowledged: 'Предупреждение нужно явно принять.',
        legacy_blocking_anomaly_unresolved: 'Блокирующая аномалия не позволяет подтвердить миграцию.',
        legacy_ignore_reason_required: 'Укажите причину исключения снимка из миграции.',
        legacy_evidence_document_not_found: 'Подтверждающий документ не найден в этом объекте.',
        project_financial_baseline_already_exists: 'У объекта уже есть финансовая база; автоматическое создание из legacy заблокировано.',
        legacy_management_reserve_requires_manual_source: 'Управленческий резерв можно создать только отдельной ручной строкой с документальным подтверждением.',
        operational_unit_mismatch: 'Единица количества должна совпадать с единицей строки утверждённого бюджета. Для пересчёта сначала создайте новую версию базы с явным коэффициентом.'
    };

    function projectUi(projectId) {
        var key = String(projectId);
        if (!uiByProject[key]) {
            uiByProject[key] = {
                mode: 'baseline',
                selectedBaselineId: null,
                selectedCommitmentId: null,
                selectedActualId: null,
                selectedAllocationId: null,
                selectedForecastId: null
            };
        }
        return uiByProject[key];
    }

    function kopecksMoney(value) {
        var number = Number(value);
        return Number.isFinite(number) ? money(number / 100) : '—';
    }

    function rubleInput(value) {
        var number = Number(value || 0) / 100;
        return Number.isFinite(number) ? number.toFixed(2) : '0.00';
    }

    function toKopecks(value) {
        var number = Number(String(value == null ? '' : value).replace(',', '.'));
        if (!Number.isFinite(number) || number < 0) throw new Error('Некорректная денежная сумма');
        return Math.round(number * 100);
    }

    function toBasisPoints(value) {
        var number = Number(String(value == null ? '' : value).replace(',', '.'));
        if (!Number.isFinite(number) || number < 0 || number > 100) throw new Error('Некорректная ставка НДС');
        return Math.round(number * 100);
    }

    function displayDate(value, withTime) {
        if (!value) return '—';
        var dateValue = value;
        if (/^\d+$/.test(String(value))) dateValue = Number(value) * 1000;
        try {
            return new Intl.DateTimeFormat('ru-RU', withTime
                ? { dateStyle: 'short', timeStyle: 'short' }
                : { dateStyle: 'short' }).format(new Date(dateValue));
        } catch (error) {
            return String(value);
        }
    }

    function todayIso() {
        var date = new Date();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return date.getFullYear() + '-' + month + '-' + day;
    }

    function uniqueKey(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + ':' + window.crypto.randomUUID();
        return prefix + ':' + Date.now() + ':' + Math.random().toString(36).slice(2);
    }

    function statusBadge(status) {
        var tone = status === 'approved' || status === 'confirmed' || status === 'ready_for_review' ? 'is-success'
            : (status === 'pending_approval' || status === 'blocked_anomaly' || status === 'unreviewed' ? 'is-warning'
                : (status === 'cancelled' || status === 'superseded' || status === 'ignored' ? 'is-muted' : ''));
        return '<span class="economics-status ' + tone + '">' + escapeHtml(STATUS_LABELS[status] || status || '—') + '</span>';
    }

    function errorText(error, fallback) {
        var code = error && error.payload && error.payload.error;
        var message = code && ERROR_LABELS[code];
        if (!message) message = appErrorMessage(error, fallback || 'Операция не выполнена.');
        var details = [];
        if (error && error.payload) {
            if (error.payload.sourceType && error.payload.sourceId) {
                details.push('Источник: ' + error.payload.sourceType + ' #' + error.payload.sourceId + '.');
            }
            if (error.payload.budgetLineId) details.push('Строка бюджета #' + error.payload.budgetLineId + '.');
            if (error.payload.remainingQuantity != null) details.push('Остаток: ' + error.payload.remainingQuantity + '.');
            if (error.payload.remainingGrossKopecks != null) {
                details.push('Доступно: ' + kopecksMoney(error.payload.remainingGrossKopecks) + '.');
            }
            if (Array.isArray(error.payload.missingBudgetLineIds) && error.payload.missingBudgetLineIds.length) {
                details.push('Нет переноса строк бюджета: #' + error.payload.missingBudgetLineIds.join(', #') + '.');
            }
            if (Array.isArray(error.payload.missingRevenueLineIds) && error.payload.missingRevenueLineIds.length) {
                details.push('Нет переноса строк выручки: #' + error.payload.missingRevenueLineIds.join(', #') + '.');
            }
            if (Array.isArray(error.payload.pendingCommitmentIds) && error.payload.pendingCommitmentIds.length) {
                details.push('Незавершённые обязательства: #' + error.payload.pendingCommitmentIds.join(', #') + '.');
            }
            if (Array.isArray(error.payload.pendingActualCostIds) && error.payload.pendingActualCostIds.length) {
                details.push('Незавершённый факт: #' + error.payload.pendingActualCostIds.join(', #') + '.');
            }
            if (Array.isArray(error.payload.pendingPaymentAllocationIds) && error.payload.pendingPaymentAllocationIds.length) {
                details.push('Незавершённые разнесения: #' + error.payload.pendingPaymentAllocationIds.join(', #') + '.');
            }
        }
        return [message].concat(details).join(' ');
    }

    function request(path, options) {
        if (typeof api !== 'function') return Promise.reject(new Error('api_unavailable'));
        return api(path, options || { silentLoader: true });
    }

    function settledRequest(path) {
        return request(path, { silentLoader: true }).then(function (data) {
            return { data: data || {}, error: null };
        }).catch(function (error) {
            return { data: {}, error: error || true };
        });
    }

    function bundleIsFresh(bundle) {
        return !!(bundle && bundle.loadedAt && Date.now() - Number(bundle.loadedAt) < CACHE_TTL_MS);
    }

    function invalidateProjectCache(projectId) {
        var key = String(projectId);
        cacheGenerationByProject[key] = Number(cacheGenerationByProject[key] || 0) + 1;
        delete cacheByProject[key];
        delete promiseByProject[key];
    }

    function bundleFailures(bundle) {
        if (!bundle || !bundle.loadedAt) return [];
        return BUNDLE_SECTIONS.filter(function (section) {
            var result = bundle[section[0]];
            return !result || !!result.error;
        });
    }

    function renderBundleGate(bundle) {
        if (!bundleIsFresh(bundle)) {
            return '<div class="econ-loading econ-loading--skeleton"><b class="visually-hidden">Загружаем полный контур управленческой экономики…</b>' + skeletonMarkup('table', 1) + '</div>';
        }
        var failures = bundleFailures(bundle);
        if (!failures.length) return '';
        var details = failures.map(function (section) {
            var result = bundle[section[0]];
            return section[1] + ': ' + errorText(result && result.error, 'не загружено');
        }).join(' ');
        return '<div class="economics-notice is-danger econ-management-error"><i data-lucide="shield-alert"></i><div><b>Контур заблокирован до полной загрузки</b><span>' +
            escapeHtml(details) + ' Обновите данные: финансовые операции недопустимы при неполном состоянии.</span></div></div>';
    }

    function load(projectId, force) {
        projectId = Number(projectId || 0);
        if (!projectId || !canViewProjectEconomics()) return Promise.resolve(null);
        var key = String(projectId);
        if (!force && bundleIsFresh(cacheByProject[key])) return Promise.resolve(cacheByProject[key]);
        if (promiseByProject[key]) return promiseByProject[key];
        var base = '/api/projects/' + projectId;
        var generation = Number(cacheGenerationByProject[key] || 0);
        var promise = Promise.all([
            settledRequest(base + '/financial-baselines'),
            settledRequest(base + '/commitments'),
            settledRequest(base + '/actual-costs'),
            settledRequest(base + '/cash-flow'),
            settledRequest(base + '/forecasts'),
            settledRequest(base + '/documents'),
            settledRequest(base + '/supplier-offers'),
            settledRequest(base + '/forecast-price-sources'),
            settledRequest(base + '/economics'),
            settledRequest(base + '/legacy-economics-migration')
        ]).then(function (parts) {
            var bundle = {
                projectId: projectId,
                baselines: parts[0],
                commitments: parts[1],
                actualCosts: parts[2],
                cashFlow: parts[3],
                forecasts: parts[4],
                documents: parts[5],
                supplierOffers: parts[6],
                forecastPriceSources: parts[7],
                economics: parts[8],
                legacyMigration: parts[9],
                loadedAt: Date.now()
            };
            if (Number(cacheGenerationByProject[key] || 0) !== generation) {
                return cacheByProject[key] || null;
            }
            cacheByProject[key] = bundle;
            return bundle;
        }).finally(function () {
            if (promiseByProject[key] === promise) delete promiseByProject[key];
        });
        promiseByProject[key] = promise;
        return promise;
    }

    function resultItems(result, names) {
        var data = result && result.data || {};
        for (var index = 0; index < names.length; index += 1) {
            if (Array.isArray(data[names[index]])) return data[names[index]];
        }
        return [];
    }

    function baselines(bundle) { return resultItems(bundle && bundle.baselines, ['baselines', 'items']); }
    function commitments(bundle) { return resultItems(bundle && bundle.commitments, ['items', 'commitments']); }
    function actualCosts(bundle) { return resultItems(bundle && bundle.actualCosts, ['items', 'actualCosts']); }
    function allocations(bundle) { return resultItems(bundle && bundle.cashFlow, ['allocations']); }
    function payments(bundle) { return resultItems(bundle && bundle.cashFlow, ['payments']); }
    function forecasts(bundle) { return resultItems(bundle && bundle.forecasts, ['forecasts', 'items']); }
    function documents(bundle) { return resultItems(bundle && bundle.documents, ['documents', 'items']); }
    function supplierOffers(bundle) { return resultItems(bundle && bundle.supplierOffers, ['offers', 'items']); }
    function marketSnapshots(bundle) { return resultItems(bundle && bundle.forecastPriceSources, ['marketSnapshots', 'items']); }

    function approvedBaseline(bundle) {
        return baselines(bundle).find(function (item) { return item.status === 'approved'; }) || null;
    }

    function sectionError(result, fallback) {
        if (!result || !result.error) return '';
        return '<div class="economics-notice is-danger econ-management-error"><i data-lucide="circle-alert"></i><div><b>Раздел не загрузился</b><span>' +
            escapeHtml(errorText(result.error, fallback)) + '</span></div></div>';
    }

    function summaryMetric(label, value, hint, tone) {
        return '<article class="econ-management-metric ' + (tone ? 'is-' + tone : '') + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(hint || '') + '</small></article>';
    }

    function renderEvents(events) {
        events = Array.isArray(events) ? events : [];
        if (!events.length) return '<p class="muted">История действий пока пуста.</p>';
        return '<ol class="econ-event-list">' + events.slice().reverse().map(function (event) {
            var details = event.details || {};
            var reason = details.reason || details.cancellationReason || '';
            var action = details.workflowAction || event.action;
            return '<li><span></span><div><b>' + escapeHtml(EVENT_LABELS[action] || action || 'Событие') + '</b>' +
                '<small>' + escapeHtml([event.actorName || 'Система', displayDate(event.createdAt, true)].join(' · ')) + '</small>' +
                (reason ? '<p>' + escapeHtml(reason) + '</p>' : '') + '</div></li>';
        }).join('') + '</ol>';
    }

    function documentOptions(bundle, selected, includeEmpty) {
        var html = includeEmpty === false ? '' : '<option value="">Без документа</option>';
        return html + documents(bundle).map(function (doc) {
            var id = Number(doc.id || 0);
            var label = doc.title || doc.name || ('Документ #' + id);
            return '<option value="' + id + '"' + (Number(selected || 0) === id ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
        }).join('');
    }

    function vatModeOptions(selected) {
        return [
            ['no_vat', 'Без НДС'],
            ['net', 'Сумма без НДС'],
            ['gross', 'Сумма с НДС']
        ].map(function (item) {
            return '<option value="' + item[0] + '"' + (selected === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('');
    }

    function sourceTypeOptions(kind, selected) {
        var rows = kind === 'revenue'
            ? [['contract', 'Договор'], ['estimate', 'Смета'], ['manual', 'Ручной источник']]
            : [['policy', 'Лимит / политика'], ['estimate', 'Смета'], ['manual', 'Ручной источник']];
        return rows.map(function (item) {
            return '<option value="' + item[0] + '"' + (selected === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('');
    }

    function renderBaselineLine(line, kind, index, bundle) {
        line = line || {};
        var amount = line.sourceAmountKopecks != null ? line.sourceAmountKopecks
            : (line.vatMode === 'gross' ? line.grossAmountKopecks : line.netAmountKopecks);
        return '<fieldset class="econ-line-editor" data-econ-baseline-line data-line-kind="' + kind + '">' +
            '<legend>' + (kind === 'revenue' ? 'Выручка' : 'Себестоимость') + ' · строка ' + (index + 1) + '</legend>' +
            '<div class="econ-form-grid">' +
                '<label class="wide"><span>Название</span><input name="title" value="' + escapeHtml(line.title || '') + '" required></label>' +
                '<label><span>Раздел</span><input name="sectionTitle" value="' + escapeHtml(line.sectionTitle || '') + '"></label>' +
                '<label><span>Ед.</span><input name="unit" value="' + escapeHtml(line.unit || '') + '"></label>' +
                '<label><span>Количество</span><input name="quantity" type="number" min="0" step="0.001" value="' + escapeHtml(line.quantity == null ? '' : line.quantity) + '"></label>' +
                '<label><span>Сумма источника, ₽</span><input name="sourceAmount" type="number" min="0" step="0.01" value="' + escapeHtml(rubleInput(amount || 0)) + '" required></label>' +
                '<label><span>Режим цены</span><select name="vatMode">' + vatModeOptions(line.vatMode || 'no_vat') + '</select></label>' +
                '<label><span>НДС, %</span><input name="vatRate" type="number" min="0" max="100" step="0.01" value="' + escapeHtml(Number(line.vatRateBasisPoints || 0) / 100) + '"></label>' +
                '<label><span>Тип источника</span><select name="sourceType">' + sourceTypeOptions(kind, line.sourceType || (kind === 'revenue' ? 'contract' : 'policy')) + '</select></label>' +
                '<label class="wide"><span>Ссылка / реквизиты источника</span><input name="sourceReference" value="' + escapeHtml(line.sourceReference || '') + '" required placeholder="Договор №…, лимит от…, ручное основание"></label>' +
                '<label><span>ID позиции сметы (необязательно)</span><input name="estimateItemId" type="number" min="1" step="1" value="' + escapeHtml(line.estimateItemId || '') + '"></label>' +
                '<label><span>Документ строки</span><select name="sourceDocumentId">' + documentOptions(bundle, line.sourceDocumentId) + '</select></label>' +
                (kind === 'budget'
                    ? '<label><span>Тип строки</span><select name="lineType"><option value="direct_cost"' + (line.lineType !== 'management_reserve' ? ' selected' : '') + '>Прямые затраты</option><option value="management_reserve"' + (line.lineType === 'management_reserve' ? ' selected' : '') + '>Управленческий резерв</option></select></label>' +
                      '<label><span>Код затрат</span><input name="costCode" value="' + escapeHtml(line.costCode || '') + '"></label>'
                    : '') +
            '</div>' +
            '<button class="ghost compact econ-remove-line" type="button" data-econ-remove-line>Удалить строку</button>' +
        '</fieldset>';
    }

    function renderBaselineEditor(baseline, bundle) {
        var revenue = Array.isArray(baseline.revenueLines) ? baseline.revenueLines : [];
        var budget = Array.isArray(baseline.budgetLines) ? baseline.budgetLines : [];
        return '<form class="econ-editor-form" data-econ-baseline-update data-baseline-id="' + baseline.id + '">' +
            '<div class="econ-form-grid econ-form-meta">' +
                '<label><span>Действует с</span><input name="effectiveFrom" type="date" value="' + escapeHtml(baseline.effectiveFrom || '') + '" required></label>' +
                '<label><span>Документ-основание</span><select name="sourceDocumentId">' + documentOptions(bundle, baseline.sourceDocumentId) + '</select></label>' +
                '<label class="wide"><span>Причина версии</span><textarea name="reason" rows="2" required>' + escapeHtml(baseline.reason || '') + '</textarea></label>' +
            '</div>' +
            '<section class="econ-lines-group"><div class="econ-subhead"><div><h5>Договорная выручка</h5><span>Без НДС; НДС хранится отдельно.</span></div><button class="ghost compact" type="button" data-econ-add-baseline-line="revenue">Добавить строку</button></div>' +
                '<div data-econ-baseline-lines="revenue">' + revenue.map(function (line, index) { return renderBaselineLine(line, 'revenue', index, bundle); }).join('') + '</div></section>' +
            '<section class="econ-lines-group"><div class="econ-subhead"><div><h5>Целевая себестоимость</h5><span>Прямые затраты и управленческий резерв.</span></div><button class="ghost compact" type="button" data-econ-add-baseline-line="budget">Добавить строку</button></div>' +
                '<div data-econ-baseline-lines="budget">' + budget.map(function (line, index) { return renderBaselineLine(line, 'budget', index, bundle); }).join('') + '</div></section>' +
            '<div class="econ-form-error" data-econ-form-error></div>' +
            '<div class="econ-form-actions"><button class="primary" type="submit">Сохранить черновик</button><button class="ghost" type="button" data-econ-action="baseline-submit" data-entity-id="' + baseline.id + '">Отправить на утверждение</button></div>' +
        '</form>';
    }

    function successorKindOptions(selected) {
        return [
            ['carry_forward', 'Перенос без изменения смысла'],
            ['merge', 'Объединение в новую строку'],
            ['reclassified', 'Переклассификация']
        ].map(function (item) {
            return '<option value="' + item[0] + '"' + (selected === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('');
    }

    function successorTargetOptions(lines, selected) {
        return '<option value="">Не переносить / связь не нужна</option>' + (lines || []).map(function (line) {
            return '<option value="' + line.id + '"' + (Number(selected || 0) === Number(line.id) ? ' selected' : '') + '>#' + line.id + ' · ' + escapeHtml(line.title || '') + ' · ' + escapeHtml(line.unit || 'без ед.') + '</option>';
        }).join('');
    }

    function renderSuccessorRow(sourceLine, targetLines, mapping, kind) {
        mapping = mapping || {};
        var targetId = kind === 'budget' ? mapping.targetBudgetLineId : mapping.targetRevenueLineId;
        var amount = sourceLine.netAmountKopecks == null ? '' : kopecksMoney(sourceLine.netAmountKopecks);
        return '<fieldset class="econ-mapping-row" data-econ-successor-row data-mapping-kind="' + kind + '" data-source-line-id="' + sourceLine.id + '">' +
            '<legend>' + (kind === 'budget' ? 'Себестоимость' : 'Выручка') + ' #' + sourceLine.id + '</legend>' +
            '<div class="econ-mapping-source"><b>' + escapeHtml(sourceLine.title || '') + '</b><small>' + escapeHtml([sourceLine.sectionTitle, sourceLine.quantity == null ? '' : sourceLine.quantity + ' ' + (sourceLine.unit || ''), amount].filter(Boolean).join(' · ')) + '</small></div>' +
            '<span class="econ-mapping-arrow" aria-hidden="true">→</span>' +
            '<label><span>Строка новой версии</span><select name="targetLineId">' + successorTargetOptions(targetLines, targetId) + '</select></label>' +
            '<label><span>Способ переноса</span><select name="mappingKind">' + successorKindOptions(mapping.mappingKind || 'carry_forward') + '</select></label>' +
            (kind === 'budget' ? '<label><span>Коэффициент количества</span><input name="quantityFactor" type="number" min="0.000001" step="0.000001" value="' + escapeHtml(mapping.quantityFactor == null ? '1' : mapping.quantityFactor) + '"></label>' : '') +
            '<label class="econ-mapping-reason"><span>Причина сопоставления</span><input name="reason" value="' + escapeHtml(mapping.reason || '') + '" placeholder="Почему старая строка соответствует новой"></label>' +
        '</fieldset>';
    }

    function renderSuccessorMappingEditor(baseline, bundle) {
        var source = approvedBaseline(bundle);
        if (!source || Number(source.id) === Number(baseline.id) || Number(source.versionNo || 0) >= Number(baseline.versionNo || 0)) return '';
        var existing = baseline.successorMappings || {};
        var budgetMappings = Array.isArray(existing.budget) ? existing.budget : [];
        var revenueMappings = Array.isArray(existing.revenue) ? existing.revenue : [];
        var sourceBudget = (source.budgetLines || []).filter(function (line) { return line.lineType === 'direct_cost'; });
        var targetBudget = (baseline.budgetLines || []).filter(function (line) { return line.lineType === 'direct_cost'; });
        var sourceRevenue = source.revenueLines || [];
        var targetRevenue = baseline.revenueLines || [];
        function findMapping(rows, sourceId, key) {
            return rows.find(function (item) { return Number(item[key]) === Number(sourceId); }) || null;
        }
        var mappedCount = budgetMappings.length + revenueMappings.length;
        var sourceCount = sourceBudget.length + sourceRevenue.length;
        return '<details class="econ-create-box econ-successor-editor" open><summary>Сопоставление с действующей базой v' + escapeHtml(source.versionNo) + ' · ' + mappedCount + ' из ' + sourceCount + '</summary>' +
            '<form data-econ-successor-update data-baseline-id="' + baseline.id + '">' +
                '<div class="economics-notice is-warning"><i data-lucide="triangle-alert"></i><div><b>Проверьте перенос после изменения строк</b><span>Клонирование создаёт сопоставление автоматически, но редактирование состава строк может его сбросить. Сохраните актуальные связи до отправки версии на утверждение. Пустая цель означает, что строка сознательно не переносится.</span></div></div>' +
                '<section class="econ-lines-group"><div class="econ-subhead"><div><h5>Целевая себестоимость</h5><p>Переносятся только прямые затраты. Коэффициент обязателен при изменении единицы измерения.</p></div></div>' +
                    (sourceBudget.length ? sourceBudget.map(function (line) { return renderSuccessorRow(line, targetBudget, findMapping(budgetMappings, line.id, 'sourceBudgetLineId'), 'budget'); }).join('') : '<p class="muted">В действующей версии нет прямых затрат.</p>') + '</section>' +
                '<section class="econ-lines-group"><div class="econ-subhead"><div><h5>Договорная выручка</h5><p>Связи нужны, чтобы поступления остались привязаны к правильным строкам после замены базы.</p></div></div>' +
                    (sourceRevenue.length ? sourceRevenue.map(function (line) { return renderSuccessorRow(line, targetRevenue, findMapping(revenueMappings, line.id, 'sourceRevenueLineId'), 'revenue'); }).join('') : '<p class="muted">В действующей версии нет строк выручки.</p>') + '</section>' +
                '<div class="econ-form-error" data-econ-form-error></div><div class="econ-form-actions"><button class="primary" type="submit">Сохранить сопоставление</button></div>' +
            '</form></details>';
    }

    function renderSuccessorMappingsReadonly(baseline) {
        var mappings = baseline && baseline.successorMappings || {};
        var budget = Array.isArray(mappings.budget) ? mappings.budget : [];
        var revenue = Array.isArray(mappings.revenue) ? mappings.revenue : [];
        if (!budget.length && !revenue.length) return '';
        function table(title, rows, budgetKind) {
            if (!rows.length) return '<section class="econ-readonly-lines"><h5>' + escapeHtml(title) + '</h5><p class="muted">Сохранённых связей нет.</p></section>';
            return '<section class="econ-readonly-lines"><h5>' + escapeHtml(title) + '</h5><div class="econ-table-wrap"><table class="econ-table"><thead><tr><th>Источник</th><th>Преемник</th><th>Правило</th><th>Основание</th></tr></thead><tbody>' + rows.map(function (item) {
                var sourceId = budgetKind ? item.sourceBudgetLineId : item.sourceRevenueLineId;
                var targetId = budgetKind ? item.targetBudgetLineId : item.targetRevenueLineId;
                var rule = item.mappingKind || '—';
                if (budgetKind && item.quantityFactor != null) rule += ' · коэф. ' + item.quantityFactor;
                return '<tr><td><b>#' + escapeHtml(sourceId) + ' · ' + escapeHtml(item.sourceTitle || '') + '</b><small>база #' + escapeHtml(item.fromBaselineId || '—') + '</small></td>' +
                    '<td><b>#' + escapeHtml(targetId) + ' · ' + escapeHtml(item.targetTitle || '') + '</b><small>база #' + escapeHtml(item.toBaselineId || baseline.id) + '</small></td>' +
                    '<td>' + escapeHtml(rule) + '</td><td>' + escapeHtml(item.reason || '—') + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
        }
        return '<details class="econ-history econ-successor-history"><summary>Сопоставление old→new (' + (budget.length + revenue.length) + ')</summary>' +
            '<div class="economics-notice"><i data-lucide="git-compare-arrows"></i><div><b>Неизменяемая карта преемственности</b><span>По этим связям исторические обязательства, факт и платежи атрибутируются к текущей версии.</span></div></div>' +
            table('Целевая себестоимость', budget, true) + table('Договорная выручка', revenue, false) + '</details>';
    }

    function baselineTotals(item) {
        var totals = item.totals || {};
        return '<div class="econ-inline-totals">' +
            summaryMetric('Выручка без НДС', kopecksMoney(totals.revenueNetKopecks), 'НДС ' + kopecksMoney(totals.revenueVatKopecks)) +
            summaryMetric('Выручка с НДС', kopecksMoney(totals.revenueGrossKopecks), 'Денежное представление') +
            summaryMetric('Себестоимость без НДС', kopecksMoney(totals.targetCostNetKopecks), 'НДС ' + kopecksMoney(totals.targetCostVatKopecks)) +
            summaryMetric('Себестоимость с НДС', kopecksMoney(totals.targetCostGrossKopecks), 'Денежное представление') +
        '</div>';
    }

    function renderBaselineReadonlyLines(item) {
        function table(title, rows, budgetKind) {
            if (!rows.length) return '<section class="econ-readonly-lines"><h5>' + title + '</h5><p class="muted">Строк нет.</p></section>';
            return '<section class="econ-readonly-lines"><h5>' + title + '</h5><div class="econ-table-wrap"><table class="econ-table"><thead><tr><th>Строка</th><th>Связь</th><th>Без НДС</th><th>НДС</th><th>С НДС</th></tr></thead><tbody>' +
                rows.map(function (line) {
                    var link = budgetKind ? ('Бюджет #' + line.id) : (line.estimateItemId ? 'Смета #' + line.estimateItemId : 'Без позиции сметы');
                    return '<tr><td><b>' + escapeHtml(line.title || '') + '</b><small>' + escapeHtml([line.sectionTitle, line.quantity == null ? '' : line.quantity + ' ' + (line.unit || '')].filter(Boolean).join(' · ')) + '</small></td>' +
                        '<td>' + escapeHtml(link) + '</td><td>' + escapeHtml(kopecksMoney(line.netAmountKopecks)) + '</td><td>' + escapeHtml(kopecksMoney(line.vatAmountKopecks)) + '</td><td>' + escapeHtml(kopecksMoney(line.grossAmountKopecks)) + '</td></tr>';
                }).join('') + '</tbody></table></div></section>';
        }
        return table('Договорная выручка', item.revenueLines || [], false) + table('Целевая себестоимость', item.budgetLines || [], true);
    }

    function renderBaselineMode(projectId, bundle) {
        var items = baselines(bundle);
        var ui = projectUi(projectId);
        if (!ui.selectedBaselineId && items.length) ui.selectedBaselineId = items[0].id;
        var selected = items.find(function (item) { return Number(item.id) === Number(ui.selectedBaselineId); }) || items[0] || null;
        var cloneOptions = '<option value="">Пустая версия</option>' + items.filter(function (item) {
            return item.status === 'approved' || item.status === 'superseded';
        }).map(function (item) {
            return '<option value="' + item.id + '">Копия версии ' + escapeHtml(item.versionNo) + ' · ' + escapeHtml(STATUS_LABELS[item.status]) + '</option>';
        }).join('');
        var create = '<details class="econ-create-box"' + (!items.length ? ' open' : '') + '><summary>Создать версию финансовой базы</summary>' +
            '<form class="econ-form-grid" data-econ-baseline-create>' +
                '<label><span>Основа</span><select name="cloneFromBaselineId">' + cloneOptions + '</select></label>' +
                '<label><span>Действует с</span><input name="effectiveFrom" type="date" value="' + todayIso() + '"></label>' +
                '<label><span>Документ-основание</span><select name="sourceDocumentId">' + documentOptions(bundle, null) + '</select></label>' +
                '<label class="wide"><span>Причина создания версии</span><textarea name="reason" required rows="2" placeholder="Первичная база, изменение договора, пересмотр лимитов…"></textarea></label>' +
                '<div class="econ-form-error" data-econ-form-error></div><button class="primary" type="submit">Создать черновик</button>' +
            '</form></details>';
        if (!items.length) {
            return sectionError(bundle.baselines, 'Не удалось получить версии финансовой базы.') + create +
                '<div class="econ-empty"><i data-lucide="landmark"></i><b>Финансовая база ещё не создана</b><span>Legacy-бюджет и живая смета не переносятся автоматически. Создайте и вручную подтвердите выручку, целевую себестоимость и НДС.</span></div>';
        }
        var versionList = '<aside class="econ-version-list">' + items.map(function (item) {
            return '<button type="button" class="econ-version-button' + (selected && Number(selected.id) === Number(item.id) ? ' active' : '') + '" data-econ-select="baseline" data-entity-id="' + item.id + '"><span>Версия ' + escapeHtml(item.versionNo) + '</span>' + statusBadge(item.status) + '<small>' + escapeHtml(displayDate(item.updatedAt, true)) + '</small></button>';
        }).join('') + '</aside>';
        var content = '';
        if (selected) {
            content = '<article class="econ-entity-detail"><div class="econ-entity-head"><div><span class="section-label">Финансовая база v' + escapeHtml(selected.versionNo) + '</span><h4>' + escapeHtml(selected.reason || 'Без описания') + '</h4><p>Действует с ' + escapeHtml(selected.effectiveFrom || 'не указано') + ' · RUB · контрольный снимок ' + escapeHtml((selected.sourceSnapshotHash || '').slice(0, 20)) + '</p></div>' + statusBadge(selected.status) + '</div>' +
                baselineTotals(selected) +
                (selected.status === 'draft' ? renderBaselineEditor(selected, bundle) + renderSuccessorMappingEditor(selected, bundle) : renderBaselineReadonlyLines(selected) + renderSuccessorMappingsReadonly(selected)) +
                (selected.status === 'pending_approval'
                    ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="baseline-approve" data-entity-id="' + selected.id + '">Утвердить</button>' + renderReturnForm('baseline', selected.id) + '</div>'
                    : '') +
                '<details class="econ-history"><summary>История изменений (' + escapeHtml((selected.events || []).length) + ')</summary>' + renderEvents(selected.events) + '</details></article>';
        }
        return sectionError(bundle.baselines, 'Не удалось получить версии финансовой базы.') + create + '<div class="econ-master-detail">' + versionList + '<div>' + content + '</div></div>';
    }

    function approvedBudgetOptions(bundle, selected, includeEmpty) {
        var baseline = approvedBaseline(bundle);
        var html = includeEmpty === false ? '' : '<option value="">Выберите строку бюджета</option>';
        if (!baseline) return html;
        return html + (baseline.budgetLines || []).filter(function (line) {
            return line.lineType === 'direct_cost';
        }).map(function (line) {
            return '<option value="' + line.id + '"' + (Number(selected || 0) === Number(line.id) ? ' selected' : '') + '>#' + line.id + ' · ' + escapeHtml(line.title) + ' · ' + escapeHtml(kopecksMoney(line.netAmountKopecks)) + '</option>';
        }).join('');
    }

    function renderReturnForm(kind, id) {
        return '<form class="econ-return-form" data-econ-return-form data-entity-kind="' + kind + '" data-entity-id="' + id + '"><input name="reason" required placeholder="Причина возврата"><button class="ghost" type="submit">Вернуть</button><div class="econ-form-error" data-econ-form-error></div></form>';
    }

    function renderCommitmentLineEditor(bundle, line, index) {
        line = line || {};
        return '<fieldset class="econ-line-editor" data-econ-commitment-line><legend>Строка ' + (index + 1) + '</legend><div class="econ-form-grid">' +
            '<label class="wide"><span>Строка бюджета</span><select name="budgetLineId" required>' + approvedBudgetOptions(bundle, line.budgetLineId) + '</select></label>' +
            '<label class="wide"><span>Название</span><input name="title" required value="' + escapeHtml(line.title || '') + '"></label>' +
            '<label><span>Ед.</span><input name="unit" value="' + escapeHtml(line.unit || '') + '"></label>' +
            '<label><span>Количество</span><input name="quantity" type="number" min="0.001" step="0.001" required value="' + escapeHtml(line.quantity || '') + '"></label>' +
            '<label><span>Цена единицы, ₽</span><input name="unitPrice" type="number" min="0.01" step="0.01" required value="' + escapeHtml(rubleInput(line.sourceUnitPriceKopecks || 0)) + '"></label>' +
            '<label><span>Режим цены</span><select name="vatMode">' + vatModeOptions(line.sourceVatMode || 'no_vat') + '</select></label>' +
            '<label><span>НДС, %</span><input name="vatRate" type="number" min="0" max="100" step="0.01" value="' + escapeHtml(Number(line.vatRateBasisPoints || 0) / 100) + '"></label>' +
            '<label class="wide"><span>Источник</span><input name="sourceReference" required value="' + escapeHtml(line.sourceReference || '') + '" placeholder="Заказ, договор, КП…"></label>' +
            '</div><button class="ghost compact" type="button" data-econ-remove-line>Удалить строку</button></fieldset>';
    }

    function commitmentTypeLabel(value) {
        return { purchase_order: 'Заказ поставщику', subcontract: 'Договор субподряда', other: 'Другое обязательство' }[value] || value || 'Обязательство';
    }

    function renderCommitmentCreate(projectId, bundle) {
        var baseline = approvedBaseline(bundle);
        if (!baseline) return '<div class="economics-notice is-warning"><i data-lucide="triangle-alert"></i><div><b>Создание обязательств заблокировано</b><span>Сначала утвердите финансовую базу.</span></div></div>';
        var selectedOffers = supplierOffers(bundle).filter(function (offer) { return offer.status === 'selected'; });
        var used = {};
        commitments(bundle).forEach(function (item) {
            if (item.status !== 'cancelled' && item.sourceSupplierOfferId) used[Number(item.sourceSupplierOfferId)] = true;
        });
        var offerOptions = '<option value="">Выберите активное предложение</option>' + selectedOffers.filter(function (offer) {
            return !used[Number(offer.id)];
        }).map(function (offer) {
            return '<option value="' + offer.id + '">' + escapeHtml((offer.material_title || offer.candidate_name || 'Предложение') + ' · ' + money(Number(offer.price || 0))) + '</option>';
        }).join('');
        return '<div class="econ-create-columns">' +
            '<details class="econ-create-box"><summary>Создать обязательство вручную</summary><form data-econ-commitment-create>' +
                '<div class="econ-form-grid econ-form-meta"><label><span>Тип</span><select name="commitmentType"><option value="purchase_order">Заказ поставщику</option><option value="subcontract">Договор субподряда</option><option value="other">Другое</option></select></label>' +
                '<label><span>Номер</span><input name="commitmentNo" placeholder="Можно заполнить до отправки"></label><label><span>Контрагент</span><input name="counterpartyName" required></label>' +
                '<label><span>Ожидаемая дата</span><input name="expectedDate" type="date"></label><label><span>Документ</span><select name="documentId">' + documentOptions(bundle, null) + '</select></label>' +
                '<label class="wide"><span>Основание</span><textarea name="reason" required rows="2"></textarea></label></div>' +
                '<div class="econ-subhead"><div><h5>Строки обязательства</h5><span>Каждая строка связана с лимитом целевой себестоимости.</span></div><button class="ghost compact" type="button" data-econ-add-commitment-line>Добавить строку</button></div>' +
                '<div data-econ-commitment-lines>' + renderCommitmentLineEditor(bundle, {}, 0) + '</div><div class="econ-form-error" data-econ-form-error></div><button class="primary" type="submit">Создать черновик</button>' +
            '</form></details>' +
            '<details class="econ-create-box"><summary>Создать из активного предложения</summary><form class="econ-form-grid" data-econ-commitment-offer-create>' +
                '<label class="wide"><span>Предложение</span><select name="supplierOfferId" required>' + offerOptions + '</select></label>' +
                '<label><span>Строка бюджета при неоднозначности</span><select name="budgetLineId">' + approvedBudgetOptions(bundle, null) + '</select></label>' +
                '<label><span>Номер заказа / договора</span><input name="commitmentNo"></label><label><span>Дата поставки / работ</span><input name="expectedDate" type="date"></label>' +
                '<label><span>Режим цены</span><select name="vatMode">' + vatModeOptions('no_vat') + '</select></label><label><span>НДС, %</span><input name="vatRate" type="number" min="0" max="100" step="0.01" value="0"></label>' +
                '<label class="wide"><span>Основание</span><textarea name="reason" required rows="2"></textarea></label><div class="econ-form-error" data-econ-form-error></div><button class="primary" type="submit">Создать из предложения</button>' +
            '</form></details>' +
        '</div>';
    }

    function renderCommitmentDraftEditor(item, bundle) {
        var lines = Array.isArray(item.lines) ? item.lines : [];
        return '<form data-econ-commitment-update data-entity-id="' + item.id + '">' +
            '<div class="econ-form-grid econ-form-meta"><label><span>Номер</span><input name="commitmentNo" value="' + escapeHtml(item.commitmentNo || '') + '"></label>' +
            '<label><span>Ожидаемая дата</span><input name="expectedDate" type="date" value="' + escapeHtml(item.expectedDate || '') + '"></label>' +
            '<label class="wide"><span>Основание</span><input name="reason" required value="' + escapeHtml(item.reason || '') + '"></label></div>' +
            '<div class="econ-subhead"><div><h5>Строки обязательства</h5><p>Можно менять состав, количество, цену, НДС и связь с бюджетом, пока запись остаётся черновиком.</p></div><button class="ghost compact" type="button" data-econ-add-commitment-line>Добавить строку</button></div>' +
            '<div class="econ-lines-group" data-econ-commitment-lines>' + lines.map(function (line, index) { return renderCommitmentLineEditor(bundle, line, index); }).join('') + '</div>' +
            '<div class="econ-form-error" data-econ-form-error></div><div class="econ-form-actions"><button class="ghost" type="submit">Сохранить черновик</button><button class="primary" type="button" data-econ-action="commitment-submit" data-entity-id="' + item.id + '">Отправить</button></div></form>';
    }

    function renderCommitmentCard(item, bundle) {
        var lines = Array.isArray(item.lines) ? item.lines : [];
        return '<article class="econ-entity-card"><div class="econ-entity-head"><div><span class="section-label">' + escapeHtml(commitmentTypeLabel(item.commitmentType)) + '</span><h4>' + escapeHtml(item.commitmentNo || item.counterpartyName || ('Обязательство #' + item.id)) + '</h4><p>' + escapeHtml([item.counterpartyName, item.expectedDate ? 'ожидается ' + displayDate(item.expectedDate) : '', 'база #' + (item.baselineId || '—')].filter(Boolean).join(' · ')) + '</p></div>' + statusBadge(item.status) + '</div>' +
            '<div class="econ-inline-totals">' + summaryMetric('Без НДС', kopecksMoney(item.netAmountKopecks), 'Принято в факт ' + kopecksMoney(lines.reduce(function (sum, line) { return sum + Number(line.recognizedNetKopecks || 0); }, 0))) +
                summaryMetric('НДС', kopecksMoney(item.vatAmountKopecks), 'Показывается отдельно') + summaryMetric('С НДС', kopecksMoney(item.grossAmountKopecks), 'Оплачено ' + kopecksMoney(item.allocatedPaymentGrossKopecks)) +
                summaryMetric('Не оплачено', kopecksMoney(item.unpaidGrossKopecks), 'Кассовый остаток по обязательству', Number(item.overpaidGrossKopecks || 0) > 0 ? 'danger' : '') + '</div>' +
            (item.status === 'draft' ? renderCommitmentDraftEditor(item, bundle) : '') +
            '<details class="econ-readonly-lines"><summary>Строки (' + lines.length + ')</summary><div class="econ-table-wrap"><table class="econ-table"><thead><tr><th>Позиция</th><th>Бюджет</th><th>Без НДС</th><th>Факт</th><th>Остаток</th></tr></thead><tbody>' + lines.map(function (line) {
                return '<tr><td><b>' + escapeHtml(line.title) + '</b><small>' + escapeHtml(line.quantity + ' ' + (line.unit || '')) + '</small></td><td>#' + escapeHtml(line.budgetLineId || '—') + '</td><td>' + escapeHtml(kopecksMoney(line.netAmountKopecks)) + '</td><td>' + escapeHtml(kopecksMoney(line.recognizedNetKopecks)) + '</td><td>' + escapeHtml(kopecksMoney(line.remainingNetKopecks)) + (Number(line.overrunNetKopecks || 0) > 0 ? '<small class="is-danger">Перерасход ' + escapeHtml(kopecksMoney(line.overrunNetKopecks)) + '</small>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div></details>' +
            (item.status === 'pending_approval' ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="commitment-approve" data-entity-id="' + item.id + '">Утвердить</button>' + renderReturnForm('commitment', item.id) + '</div>' : '') +
            (item.status === 'approved' ? '<form class="econ-return-form" data-econ-cancel-form data-entity-kind="commitment" data-entity-id="' + item.id + '"><input name="reason" required placeholder="Причина отмены непринятого остатка"><button class="ghost danger" type="submit">Отменить обязательство</button><div class="econ-form-error" data-econ-form-error></div></form>' : '') +
            '<details class="econ-history"><summary>История (' + (item.events || []).length + ')</summary>' + renderEvents(item.events) + '</details></article>';
    }

    function renderCommitmentsMode(projectId, bundle) {
        var items = commitments(bundle);
        var summary = bundle.commitments && bundle.commitments.data && bundle.commitments.data.summary || {};
        return sectionError(bundle.commitments, 'Не удалось загрузить обязательства.') +
            '<div class="econ-inline-totals">' + summaryMetric('Утверждено', kopecksMoney(summary.approvedNetKopecks), String(summary.approvedCount || 0) + ' документов') +
                summaryMetric('Принято в факт', kopecksMoney(summary.recognizedNetKopecks), 'Без НДС') + summaryMetric('Осталось принять', kopecksMoney(summary.remainingNetKopecks), 'Без НДС') +
                summaryMetric('Не оплачено', kopecksMoney(summary.unpaidGrossKopecks), 'С НДС') + '</div>' +
            renderCommitmentCreate(projectId, bundle) +
            '<div class="econ-entity-list">' + (items.length ? items.map(function (item) { return renderCommitmentCard(item, bundle); }).join('') : '<div class="econ-empty"><i data-lucide="file-check-2"></i><b>Обязательств пока нет</b><span>Выбранное предложение не является обязательством, пока заказ или договор не создан и не утверждён.</span></div>') + '</div>';
    }

    function actualCategoryOptions(selected) {
        var options = [['material', 'Материалы'], ['subcontract', 'Субподряд'], ['labor', 'Собственный труд'], ['equipment', 'Техника'], ['service', 'Услуги / аренда'], ['logistics', 'Логистика'], ['overhead', 'Накладные'], ['other', 'Другое']];
        return options.map(function (item) { return '<option value="' + item[0] + '"' + (selected === item[0] ? ' selected' : '') + '>' + item[1] + '</option>'; }).join('');
    }

    function actualSourceOptions(selected) {
        var options = [['subcontract_act', 'Акт субподрядчика'], ['service_act', 'Акт услуги / аренды'], ['labor_timesheet', 'Табель собственного труда'], ['equipment_log', 'Журнал техники'], ['manual_expense', 'Малый ручной расход']];
        return options.map(function (item) { return '<option value="' + item[0] + '"' + (selected === item[0] ? ' selected' : '') + '>' + item[1] + '</option>'; }).join('');
    }

    function commitmentLineOptions(bundle, selected) {
        var html = '<option value="">Без обязательства</option>';
        commitments(bundle).filter(function (item) { return item.status === 'approved'; }).forEach(function (item) {
            (item.lines || []).forEach(function (line) {
                html += '<option value="' + line.id + '"' + (Number(selected || 0) === Number(line.id) ? ' selected' : '') + '>#' + line.id + ' · ' + escapeHtml(item.commitmentNo || item.counterpartyName) + ' · ' + escapeHtml(line.title) + '</option>';
            });
        });
        return html;
    }

    function renderActualForm(bundle, item) {
        item = item || {};
        var isUpdate = !!item.id;
        var inheritsCommitmentMapping = !!item.commitmentLineId;
        return '<form class="econ-form-grid" ' + (isUpdate ? 'data-econ-actual-update data-entity-id="' + item.id + '"' : 'data-econ-actual-create') + '>' +
            '<label><span>Источник признания</span><select name="sourceType"' + (isUpdate ? ' disabled' : '') + '>' + actualSourceOptions(item.sourceType || 'subcontract_act') + '</select></label>' +
            '<label><span>Категория</span><select name="costCategory">' + actualCategoryOptions(item.costCategory || 'subcontract') + '</select></label>' +
            '<label class="wide"><span>Строка бюджета</span><select name="budgetLineId"' + (inheritsCommitmentMapping ? ' disabled' : ' required') + '>' + approvedBudgetOptions(bundle, item.budgetLineId) + '</select><small data-econ-actual-mapping-hint>' + (inheritsCommitmentMapping ? 'Наследуется из утверждённой строки обязательства.' : 'Обязательна для затрат без обязательства.') + '</small></label>' +
            '<label class="wide"><span>Строка обязательства (необязательно)</span><select name="commitmentLineId">' + commitmentLineOptions(bundle, item.commitmentLineId) + '</select></label>' +
            '<label><span>Дата признания</span><input name="recognitionDate" type="date" required value="' + escapeHtml(item.recognitionDate || todayIso()) + '"></label>' +
            '<label><span>Документ</span><select name="documentId">' + documentOptions(bundle, item.documentId) + '</select></label>' +
            '<label class="wide"><span>Описание факта</span><input name="title" required value="' + escapeHtml(item.title || '') + '"></label>' +
            '<label><span>Количество / часы</span><input name="quantity" type="number" min="0.001" step="0.001" required value="' + escapeHtml(item.quantity || '') + '"></label>' +
            '<label><span>Ед.</span><input name="unit" value="' + escapeHtml(item.unit || '') + '"></label>' +
            '<label><span>Цена единицы, ₽</span><input name="unitPrice" type="number" min="0.01" step="0.01" required value="' + escapeHtml(rubleInput(item.sourceUnitPriceKopecks || 0)) + '"></label>' +
            '<label><span>Режим цены</span><select name="vatMode">' + vatModeOptions(item.sourceVatMode || 'no_vat') + '</select></label>' +
            '<label><span>НДС, %</span><input name="vatRate" type="number" min="0" max="100" step="0.01" value="' + escapeHtml(Number(item.vatRateBasisPoints || 0) / 100) + '"></label>' +
            (!isUpdate ? '<label class="wide"><span>Ключ хозяйственного события</span><input name="sourceEventKey" required value="' + escapeHtml(uniqueKey('manual')) + '"><small>Защищает от повторного создания того же факта.</small></label>' : '') +
            '<label class="wide"><span>Основание признания</span><textarea name="reason" required rows="2">' + escapeHtml(item.reason || '') + '</textarea></label>' +
            '<div class="econ-form-error" data-econ-form-error></div><div class="econ-form-actions"><button class="' + (isUpdate ? 'ghost' : 'primary') + '" type="submit">' + (isUpdate ? 'Сохранить' : 'Создать черновик') + '</button>' +
            (isUpdate ? '<button class="primary" type="button" data-econ-action="actual-submit" data-entity-id="' + item.id + '">Отправить</button>' : '') + '</div></form>';
    }

    function renderActualCard(item, bundle) {
        var signTone = Number(item.signedNetAmountKopecks || 0) < 0 ? 'success' : '';
        return '<article class="econ-entity-card"><div class="econ-entity-head"><div><span class="section-label">' + escapeHtml(item.costCategory || 'Затрата') + ' · ' + escapeHtml(item.sourceType || '') + '</span><h4>' + escapeHtml(item.title || ('Факт #' + item.id)) + '</h4><p>' + escapeHtml([displayDate(item.recognitionDate), 'бюджет #' + item.budgetLineId, item.commitmentLineId ? 'обязательство #' + item.commitmentLineId : 'без обязательства'].join(' · ')) + '</p></div>' + statusBadge(item.status) + '</div>' +
            '<div class="econ-inline-totals">' + summaryMetric('Без НДС', kopecksMoney(item.signedNetAmountKopecks), item.entryKind === 'reversal' ? 'Сторно' : 'Начисленный факт', signTone) + summaryMetric('НДС', kopecksMoney(item.signedVatAmountKopecks), 'Отдельно') + summaryMetric('С НДС', kopecksMoney(item.signedGrossAmountKopecks), 'Оплачено ' + kopecksMoney(item.allocatedPaymentGrossKopecks)) + '</div>' +
            (item.status === 'draft' && item.entryKind === 'cost' ? '<details class="econ-create-box"><summary>Редактировать черновик</summary>' + renderActualForm(bundle, item) + '</details>' : '') +
            (item.status === 'draft' && item.entryKind === 'reversal' ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="actual-submit" data-entity-id="' + item.id + '">Отправить сторно на утверждение</button></div>' : '') +
            (item.status === 'pending_approval' ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="actual-approve" data-entity-id="' + item.id + '">Утвердить</button>' + renderReturnForm('actual', item.id) + '</div>' : '') +
            (item.status === 'approved' && item.entryKind === 'cost' ? '<form class="econ-return-form" data-econ-reverse-form data-entity-kind="actual" data-entity-id="' + item.id + '"><input name="recognitionDate" type="date" required value="' + todayIso() + '"><input name="reason" required placeholder="Причина сторно"><button class="ghost danger" type="submit">Создать сторно</button><div class="econ-form-error" data-econ-form-error></div></form>' : '') +
            '<details class="econ-history"><summary>История (' + (item.events || []).length + ')</summary>' + renderEvents(item.events) + '</details></article>';
    }

    function renderActualMode(projectId, bundle) {
        var items = actualCosts(bundle);
        var summary = bundle.actualCosts && bundle.actualCosts.data && bundle.actualCosts.data.summary || {};
        var byCategory = summary.approvedNetByCategoryKopecks || {};
        var categoryHint = Object.keys(byCategory).map(function (key) { return key + ': ' + kopecksMoney(byCategory[key]); }).join(' · ');
        return sectionError(bundle.actualCosts, 'Не удалось загрузить фактические затраты.') +
            '<div class="econ-inline-totals">' + summaryMetric('Факт без НДС', kopecksMoney(summary.approvedNetKopecks), String(summary.approvedCount || 0) + ' утвержденных записей') + summaryMetric('НДС факта', kopecksMoney(summary.approvedVatKopecks), 'Не входит в маржу') + summaryMetric('Факт с НДС', kopecksMoney(summary.approvedGrossKopecks), 'Денежное представление') + summaryMetric('Категории', String(Object.keys(byCategory).length), categoryHint || 'Нет данных') + '</div>' +
            (approvedBaseline(bundle) ? '<details class="econ-create-box"><summary>Создать запись фактических затрат</summary>' + renderActualForm(bundle, null) + '</details>' : '<div class="economics-notice is-warning"><i data-lucide="triangle-alert"></i><div><b>Нужна утверждённая база</b><span>Факт всегда связывается со строкой целевой себестоимости.</span></div></div>') +
            '<div class="econ-entity-list">' + (items.length ? items.map(function (item) { return renderActualCard(item, bundle); }).join('') : '<div class="econ-empty"><i data-lucide="clipboard-check"></i><b>Начисленного факта пока нет</b><span>Оплата счёта не создаёт затрату. Факт появляется после приёмки ресурса, акта, табеля или журнала техники.</span></div>') + '</div>';
    }

    function targetOptions(bundle) {
        var baseline = approvedBaseline(bundle);
        var html = '';
        if (baseline) {
            (baseline.revenueLines || []).forEach(function (line) {
                html += '<option value="revenue_line:' + line.id + '" data-direction="income">Поступление → ' + escapeHtml(line.title) + ' · ' + escapeHtml(kopecksMoney(line.grossAmountKopecks)) + '</option>';
            });
        }
        commitments(bundle).filter(function (item) { return item.status === 'approved' && Number(item.unpaidGrossKopecks || 0) > 0; }).forEach(function (item) {
            html += '<option value="commitment:' + item.id + '" data-direction="expense">Оплата → ' + escapeHtml(item.commitmentNo || item.counterpartyName) + ' · осталось ' + escapeHtml(kopecksMoney(item.unpaidGrossKopecks)) + '</option>';
        });
        actualCosts(bundle).filter(function (item) { return item.status === 'approved' && item.entryKind === 'cost' && Number(item.unpaidGrossKopecks || 0) > 0; }).forEach(function (item) {
            html += '<option value="actual_cost:' + item.id + '" data-direction="expense">Оплата факта → ' + escapeHtml(item.title) + ' · осталось ' + escapeHtml(kopecksMoney(item.unpaidGrossKopecks)) + '</option>';
        });
        return html;
    }

    function renderAllocationCard(item) {
        return '<article class="econ-entity-card econ-allocation-card"><div class="econ-entity-head"><div><span class="section-label">' + escapeHtml(item.direction === 'income' ? 'Поступление' : 'Оплата') + ' · платёж #' + escapeHtml(item.financeEntryId) + '</span><h4>' + escapeHtml(item.targetTitle || (item.targetType + ' #' + item.targetId)) + '</h4><p>' + escapeHtml(item.reason || '') + '</p></div>' + statusBadge(item.status) + '</div>' +
            '<div class="econ-inline-totals">' + summaryMetric('Разнесено без НДС', kopecksMoney(item.signedNetAmountKopecks), 'Цель: ' + item.targetType) + summaryMetric('НДС', kopecksMoney(item.signedVatAmountKopecks), 'Отдельно') + summaryMetric('С НДС', kopecksMoney(item.signedGrossAmountKopecks), item.entryKind === 'reversal' ? 'Сторно разнесения' : 'Денежная сумма') + '</div>' +
            (item.status === 'draft' && item.entryKind === 'allocation' ? '<form class="econ-form-grid econ-compact-editor" data-econ-allocation-update data-entity-id="' + item.id + '"><label><span>Сумма с НДС, ₽</span><input name="amount" type="number" min="0.01" step="0.01" required value="' + escapeHtml(rubleInput(item.grossAmountKopecks)) + '"></label><label class="wide"><span>Основание</span><input name="reason" required value="' + escapeHtml(item.reason || '') + '"></label><div class="econ-form-error" data-econ-form-error></div><div class="econ-form-actions"><button class="ghost" type="submit">Сохранить</button><button class="primary" type="button" data-econ-action="allocation-submit" data-entity-id="' + item.id + '">Отправить</button></div></form>' : '') +
            (item.status === 'draft' && item.entryKind === 'reversal' ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="allocation-submit" data-entity-id="' + item.id + '">Отправить сторно</button></div>' : '') +
            (item.status === 'pending_approval' ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="allocation-approve" data-entity-id="' + item.id + '">Утвердить</button>' + renderReturnForm('allocation', item.id) + '</div>' : '') +
            (item.status === 'approved' && item.entryKind === 'allocation' ? '<form class="econ-return-form" data-econ-reverse-form data-entity-kind="allocation" data-entity-id="' + item.id + '"><input name="reason" required placeholder="Причина сторно разнесения"><button class="ghost danger" type="submit">Сторнировать разнесение</button><div class="econ-form-error" data-econ-form-error></div></form>' : '') +
            '<details class="econ-history"><summary>История (' + (item.events || []).length + ')</summary>' + renderEvents(item.events) + '</details></article>';
    }

    function renderCashMode(projectId, bundle) {
        var cash = bundle.cashFlow && bundle.cashFlow.data || {};
        var summary = cash.summary || {};
        var eligiblePayments = payments(bundle).filter(function (item) {
            return item.recognizedInCashFlow && !item.normalizationError && Number(item.unallocatedGrossKopecks || 0) > 0;
        });
        var paymentOptions = '<option value="">Выберите проведённый платёж</option>' + eligiblePayments.map(function (item) {
            return '<option value="' + item.id + '" data-direction="' + escapeHtml(item.direction) + '">' + escapeHtml((item.direction === 'income' ? 'Поступление' : 'Оплата') + ' #' + item.id + ' · ' + (item.counterpartyName || item.category || '') + ' · доступно ' + kopecksMoney(item.unallocatedGrossKopecks)) + '</option>';
        }).join('');
        return sectionError(bundle.cashFlow, 'Не удалось загрузить денежный поток и разнесение.') +
            '<div class="econ-inline-totals">' + summaryMetric('Получено', kopecksMoney(summary.cashReceivedGrossKopecks), 'С НДС') + summaryMetric('Оплачено', kopecksMoney(summary.cashPaidGrossKopecks), 'С НДС') + summaryMetric('Не разнесено поступлений', kopecksMoney(summary.unallocatedReceivedGrossKopecks), 'С НДС') + summaryMetric('Не разнесено оплат', kopecksMoney(summary.unallocatedPaidGrossKopecks), 'С НДС', Number(summary.unallocatedPaidGrossKopecks || 0) > 0 ? 'warning' : '') + '</div>' +
            '<details class="econ-create-box"><summary>Разнести проведённый платёж</summary><form class="econ-form-grid" data-econ-allocation-create>' +
                '<label class="wide"><span>Платёж</span><select name="financeEntryId" required data-econ-allocation-payment>' + paymentOptions + '</select></label>' +
                '<label class="wide"><span>Назначение</span><select name="target" required data-econ-allocation-target><option value="">Выберите назначение</option>' + targetOptions(bundle) + '</select></label>' +
                '<label><span>Сумма с НДС, ₽</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="По умолчанию весь остаток"></label>' +
                '<label><span>Ключ разнесения</span><input name="allocationKey" required value="' + escapeHtml(uniqueKey('allocation')) + '"></label>' +
                '<label class="wide"><span>Основание</span><textarea name="reason" required rows="2"></textarea></label><div class="econ-form-error" data-econ-form-error></div><button class="primary" type="submit">Создать черновик разнесения</button>' +
            '</form></details>' +
            '<details class="econ-readonly-lines"><summary>Проведённые платежи (' + payments(bundle).length + ')</summary><div class="econ-table-wrap"><table class="econ-table"><thead><tr><th>Платёж</th><th>Дата</th><th>Без НДС</th><th>НДС</th><th>С НДС</th><th>Не разнесено</th></tr></thead><tbody>' + payments(bundle).map(function (item) {
                return '<tr><td><b>' + escapeHtml((item.direction === 'income' ? 'Поступление' : 'Оплата') + ' #' + item.id) + '</b><small>' + escapeHtml(item.counterpartyName || item.category || '') + '</small></td><td>' + escapeHtml(displayDate(item.paidDate || item.plannedDate)) + '</td><td>' + escapeHtml(kopecksMoney(item.netAmountKopecks)) + '</td><td>' + escapeHtml(kopecksMoney(item.vatAmountKopecks)) + '</td><td>' + escapeHtml(kopecksMoney(item.grossAmountKopecks)) + '</td><td>' + escapeHtml(item.recognizedInCashFlow ? kopecksMoney(item.unallocatedGrossKopecks) : 'Не проведён') + (item.normalizationError ? '<small class="is-danger">' + escapeHtml(item.normalizationError) + '</small>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div></details>' +
            '<div class="econ-entity-list">' + (allocations(bundle).length ? allocations(bundle).map(renderAllocationCard).join('') : '<div class="econ-empty"><i data-lucide="split"></i><b>Разнесений пока нет</b><span>Разнесение связывает деньги с выручкой, обязательством или фактом, но не создаёт прибыль и затраты повторно.</span></div>') + '</div>';
    }

    function renderForecastComponentTable(item) {
        var components = Array.isArray(item.components) ? item.components : [];
        if (!components.length) return '';
        return '<details class="econ-readonly-lines"><summary>Компоненты ETC (' + components.length + ')</summary><div class="econ-table-wrap"><table class="econ-table"><thead><tr><th>Компонент</th><th>Источник</th><th>Бюджет</th><th>Количество</th><th>Без НДС</th></tr></thead><tbody>' + components.map(function (component) {
            return '<tr><td><b>' + escapeHtml(component.title || component.componentType) + '</b><small>' + escapeHtml(component.componentType || '') + '</small></td><td>' + escapeHtml(component.sourceType || '') + '<small>' + escapeHtml([displayDate(component.sourceSnapshotAt), component.sourceVersion].filter(Boolean).join(' · ')) + '</small></td><td>' + escapeHtml(component.budgetLineId ? '#' + component.budgetLineId : 'Общий') + '</td><td>' + escapeHtml(component.quantity == null ? '—' : component.quantity + ' ' + (component.unit || '')) + '</td><td>' + escapeHtml(kopecksMoney(component.signedNetAmountKopecks)) + '</td></tr>';
        }).join('') + '</tbody></table></div></details>';
    }

    function renderForecastCard(item) {
        var margin = Number(item.forecastMarginNetKopecks || 0);
        return '<article class="econ-entity-card"><div class="econ-entity-head"><div><span class="section-label">Прогноз v' + escapeHtml(item.versionNo || '—') + '</span><h4>Расчёт на ' + escapeHtml(displayDate(item.calculationDate)) + '</h4><p>' + escapeHtml(item.reason || '') + '</p></div><div>' + statusBadge(item.status) + (item.isStale ? '<span class="economics-status is-warning">Устарел</span>' : '') + '</div></div>' +
            '<div class="econ-inline-totals">' + summaryMetric('Факт', kopecksMoney(item.actualCostNetKopecks), 'Без НДС') + summaryMetric('ETC', kopecksMoney(item.etcNetKopecks), 'Осталось потратить') + summaryMetric('EAC', kopecksMoney(item.eacNetKopecks), 'Итоговая себестоимость') + summaryMetric('Маржа', kopecksMoney(margin), item.forecastMarginPercent == null ? 'Процент не рассчитан' : Number(item.forecastMarginPercent).toFixed(2) + '%', margin < 0 ? 'danger' : (margin > 0 ? 'success' : '')) + '</div>' +
            renderForecastComponentTable(item) +
            (item.status === 'draft' ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="forecast-submit" data-entity-id="' + item.id + '">Отправить на утверждение</button></div>' : '') +
            (item.status === 'pending_approval' ? '<div class="econ-workflow-actions"><button class="primary" type="button" data-econ-action="forecast-approve" data-entity-id="' + item.id + '">Утвердить</button>' + renderReturnForm('forecast', item.id) + '</div>' : '') +
            '<details class="econ-history"><summary>История (' + (item.events || []).length + ')</summary>' + renderEvents(item.events) + '</details></article>';
    }

    function renderForecastInputs(bundle) {
        var baseline = approvedBaseline(bundle);
        if (!baseline) return '<div class="economics-notice is-warning"><i data-lucide="triangle-alert"></i><div><b>Прогноз заблокирован</b><span>Сначала утвердите финансовую базу.</span></div></div>';
        var activeOffers = supplierOffers(bundle).filter(function (offer) { return offer.status === 'selected'; });
        var snapshots = marketSnapshots(bundle);
        var normalizationRows = activeOffers.map(function (offer) {
            return '<div class="econ-normalization-row" data-econ-price-normalization><input type="hidden" name="sourceType" value="supplier_offer"><input type="hidden" name="sourceId" value="' + offer.id + '"><div><b>' + escapeHtml(offer.material_title || offer.candidate_name || ('Предложение #' + offer.id)) + '</b><small>supplier_offer #' + offer.id + ' · ' + escapeHtml(money(Number(offer.price || 0))) + '</small></div><select name="vatMode">' + vatModeOptions('no_vat') + '</select><input name="vatRate" type="number" min="0" max="100" step="0.01" value="0" aria-label="НДС, %"></div>';
        }).concat(snapshots.map(function (snapshot) {
            return '<div class="econ-normalization-row" data-econ-price-normalization><input type="hidden" name="sourceType" value="market_snapshot"><input type="hidden" name="sourceId" value="' + snapshot.id + '"><div><b>' + escapeHtml(snapshot.title || ('Снимок AutoBot #' + snapshot.id)) + '</b><small>market_snapshot #' + snapshot.id + ' · ' + escapeHtml(money(Number(snapshot.price || 0))) + ' · ' + escapeHtml(displayDate(snapshot.analyzedAt, true)) + '</small></div><select name="vatMode">' + vatModeOptions('no_vat') + '</select><input name="vatRate" type="number" min="0" max="100" step="0.01" value="0" aria-label="НДС, %"></div>';
        })).join('');
        var manualRows = (baseline.budgetLines || []).map(function (line) {
            return '<div class="econ-manual-price-row" data-econ-manual-price data-budget-line-id="' + line.id + '"><div><b>' + escapeHtml(line.title) + '</b><small>Бюджет #' + line.id + '</small></div><input name="unitPriceNet" type="number" min="0" step="0.01" placeholder="Цена без НДС"><input name="reason" placeholder="Основание ручной цены"></div>';
        }).join('');
        return '<details class="econ-create-box"><summary>Рассчитать новую версию прогноза</summary><form data-econ-forecast-calculate>' +
            '<div class="econ-form-grid econ-form-meta"><label><span>Дата расчёта</span><input name="calculationDate" type="date" required value="' + todayIso() + '"></label><label class="wide"><span>Основание расчёта</span><textarea name="reason" rows="2" required></textarea></label></div>' +
            sectionError(bundle.forecastPriceSources, 'Не удалось получить сохранённые снимки AutoBot.') +
            '<details class="econ-input-subdetails"' + (normalizationRows ? ' open' : '') + '><summary>Нормализация цен источников (' + (activeOffers.length + snapshots.length) + ')</summary><p class="muted">Активные предложения и сохранённые снимки AutoBot перечислены с их стабильными ID. Для каждого источника фиксируется, включает ли цена НДС.</p><div data-econ-normalizations>' + normalizationRows + '</div><button class="ghost compact" type="button" data-econ-add-normalization>Добавить источник вручную</button></details>' +
            '<details class="econ-input-subdetails"><summary>Ручные цены незаконтрактованного остатка</summary><p class="muted">Заполняются только если нет более приоритетного источника и в строке базы нет целевой цены единицы.</p><div>' + manualRows + '</div></details>' +
            '<details class="econ-input-subdetails"><summary>Корректировки и риски</summary><div data-econ-adjustments></div><button class="ghost compact" type="button" data-econ-add-adjustment>Добавить корректировку</button></details>' +
            '<div class="econ-form-error" data-econ-form-error></div><button class="primary" type="submit">Рассчитать черновик</button></form></details>';
    }

    function renderForecastMode(projectId, bundle) {
        var items = forecasts(bundle);
        var official = bundle.economics && bundle.economics.data && bundle.economics.data.forecast;
        if (!items.length && official) items = [official];
        return sectionError(bundle.forecasts, 'История прогнозов недоступна. Утверждённый прогноз в сводке продолжает работать.') + renderForecastInputs(bundle) +
            '<div class="econ-entity-list">' + (items.length ? items.map(renderForecastCard).join('') : '<div class="econ-empty"><i data-lucide="chart-no-axes-combined"></i><b>Прогноз ещё не рассчитывался</b><span>ETC собирается из остатка обязательств, цен незаконтрактованного объёма, корректировок и рисков. EAC равен факту плюс ETC.</span></div>') + '</div>';
    }

    function legacyOptions(rows, selected) {
        return rows.map(function (item) {
            return '<option value="' + item[0] + '"' + (String(selected == null ? '' : selected) === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('');
    }

    function legacyVatOptions(selected) {
        return legacyOptions([['unknown', 'Не определён'], ['no_vat', 'Без НДС'], ['net', 'Сумма без НДС'], ['gross', 'Сумма с НДС']], selected || 'unknown');
    }

    function legacyEvidenceRow(bundle, item, index) {
        item = item || {};
        return '<fieldset class="econ-line-editor econ-legacy-evidence-row" data-econ-legacy-evidence><legend>Источник ' + (index + 1) + '</legend><div class="econ-form-grid">' +
            '<label><span>Ключ</span><input name="evidenceKey" required pattern="[A-Za-z0-9_.:-]{1,64}" value="' + escapeHtml(item.key || (index === 0 ? 'source' : 'source_' + (index + 1))) + '"></label>' +
            '<label><span>Документ объекта</span><select name="documentId" required>' + documentOptions(bundle, item.documentId) + '</select></label>' +
            '<label class="wide"><span>Реквизиты / ссылка на источник</span><input name="sourceReference" required value="' + escapeHtml(item.sourceReference || '') + '" placeholder="Договор №…, утверждён от…"></label></div>' +
            '<button class="ghost compact" type="button" data-econ-remove-line>Удалить источник</button></fieldset>';
    }

    function legacyTargetOptions(selected) {
        return legacyOptions([['revenue', 'Договорная выручка'], ['target_cost', 'Целевая себестоимость'], ['reference_only', 'Только справочно'], ['ignore', 'Не переносить']], selected);
    }

    function legacyDecisionRow(source, decision, position, review) {
        decision = decision || {};
        var isBudget = source.sourceKind === 'project_budget';
        var defaultTarget = isBudget ? 'revenue' : 'target_cost';
        var amount = isBudget ? review.snapshot.legacyBudgetKopecks : source.lineAmountKopecks;
        var sourceTitle = isBudget ? 'projects.budget' : ('Позиция снимка #' + source.id + ' · ' + source.title);
        return '<fieldset class="econ-legacy-decision" data-econ-legacy-decision data-source-kind="' + source.sourceKind + '"' + (source.id ? ' data-snapshot-item-id="' + source.id + '"' : '') + '>' +
            '<legend>' + escapeHtml(sourceTitle) + '</legend><div class="econ-legacy-source-readonly"><b>' + escapeHtml(isBudget ? 'Legacy-бюджет проекта' : source.title) + '</b><small>' + escapeHtml((isBudget ? 'Исходное поле только для чтения' : [source.plannedQty, source.unit, source.plannedPrice].filter(function (value) { return value !== null && value !== ''; }).join(' · ')) + ' · ' + kopecksMoney(amount)) + '</small></div>' +
            '<div class="econ-form-grid"><label><span>Назначение</span><select name="targetKind">' + legacyTargetOptions(decision.targetKind || defaultTarget) + '</select></label>' +
            '<label><span>Позиция</span><input name="position" type="number" min="1" step="1" required value="' + escapeHtml(decision.position || position) + '"></label>' +
            '<label class="wide"><span>Название строки новой базы</span><input name="title" required value="' + escapeHtml(decision.title || (isBudget ? 'Договорная выручка' : source.title)) + '"></label>' +
            '<label><span>Режим НДС</span><select name="vatMode">' + legacyVatOptions(decision.vatMode || review.defaultVatMode || 'unknown') + '</select></label>' +
            '<label><span>НДС, %</span><input name="vatRate" type="number" min="0" max="100" step="0.01" value="' + escapeHtml(Number(decision.vatRateBasisPoints == null ? (review.defaultVatRateBasisPoints || 0) : decision.vatRateBasisPoints) / 100) + '"></label>' +
            '<label><span>Ключ подтверждения</span><input name="evidenceKey" value="' + escapeHtml(decision.evidenceKey || 'source') + '" placeholder="source"></label>' +
            (!isBudget ? '<label><span>Тип строки</span><select name="lineType">' + legacyOptions([['direct_cost', 'Прямые затраты']], 'direct_cost') + '</select></label><label><span>Код затрат</span><input name="costCode" value="' + escapeHtml(decision.costCode || '') + '"></label>' : '') +
            '<label class="wide"><span>Комментарий к решению</span><input name="comment" value="' + escapeHtml(decision.comment || '') + '" placeholder="Почему источник получает это экономическое назначение"></label></div></fieldset>';
    }

    function legacyManualDecisionRow(decision, position, review) {
        decision = decision || {};
        var sourceKey = String(decision.sourceKey || 'manual:manual_' + position);
        var clientKey = sourceKey.indexOf('manual:') === 0 ? sourceKey.slice(7) : sourceKey;
        var amount = Number(decision.sourceAmountKopecks || 0) / 100;
        return '<fieldset class="econ-legacy-decision" data-econ-legacy-decision data-source-kind="manual">' +
            '<legend>Ручная подтверждённая строка</legend><div class="economics-notice"><i data-lucide="shield-check"></i><div><b>Не переносится из legacy-полей</b><span>Сумма вводится вручную и обязательно подтверждается документом объекта. Это позволяет собрать корректную базу, не меняя projects.budget и смету.</span></div></div>' +
            '<div class="econ-form-grid"><label><span>Уникальный ключ</span><input name="clientKey" required pattern="[A-Za-z0-9_.:-]{1,64}" value="' + escapeHtml(clientKey) + '"></label>' +
            '<label><span>Назначение</span><select name="targetKind">' + legacyTargetOptions(decision.targetKind || 'target_cost') + '</select></label>' +
            '<label><span>Позиция</span><input name="position" type="number" min="1" step="1" required value="' + escapeHtml(decision.position || position) + '"></label>' +
            '<label><span>Сумма источника, ₽</span><input name="sourceAmount" type="number" min="0" step="0.01" required value="' + escapeHtml(amount || '') + '"></label>' +
            '<label class="wide"><span>Название строки новой базы</span><input name="title" required value="' + escapeHtml(decision.title || '') + '"></label>' +
            '<label><span>Раздел</span><input name="sectionTitle" value="' + escapeHtml(decision.sectionTitle || '') + '"></label>' +
            '<label><span>Единица</span><input name="unit" value="' + escapeHtml(decision.unit || '') + '"></label>' +
            '<label><span>Количество</span><input name="quantity" type="number" min="0" step="0.0001" value="' + escapeHtml(decision.quantity == null ? '' : decision.quantity) + '"></label>' +
            '<label><span>Тип строки затрат</span><select name="lineType">' + legacyOptions([['direct_cost', 'Прямые затраты'], ['management_reserve', 'Управленческий резерв']], decision.lineType || 'direct_cost') + '</select></label>' +
            '<label><span>Код затрат</span><input name="costCode" value="' + escapeHtml(decision.costCode || '') + '"></label>' +
            '<label><span>Режим НДС</span><select name="vatMode">' + legacyVatOptions(decision.vatMode || review.defaultVatMode || 'unknown') + '</select></label>' +
            '<label><span>НДС, %</span><input name="vatRate" type="number" min="0" max="100" step="0.01" value="' + escapeHtml(Number(decision.vatRateBasisPoints == null ? (review.defaultVatRateBasisPoints || 0) : decision.vatRateBasisPoints) / 100) + '"></label>' +
            '<label><span>Ключ подтверждения</span><input name="evidenceKey" value="' + escapeHtml(decision.evidenceKey || 'source') + '" placeholder="source"></label>' +
            '<label class="wide"><span>Комментарий к решению</span><input name="comment" required value="' + escapeHtml(decision.comment || '') + '" placeholder="Почему ручная сумма корректна и откуда она взята"></label></div>' +
            '<button class="ghost compact danger" type="button" data-econ-remove-line>Удалить ручную строку</button></fieldset>';
    }

    function renderLegacyAnomalies(review, editable) {
        var items = review.anomalies || [];
        if (!items.length) return '<div class="economics-notice is-success"><i data-lucide="badge-check"></i><div><b>Автоматических аномалий не найдено</b><span>Решения по экономическому смыслу и НДС всё равно подтверждаются вручную.</span></div></div>';
        return '<section class="econ-legacy-anomalies"><div class="econ-subhead"><div><h5>Аномалии снимка</h5><p>Блокирующую аномалию нельзя молча принять; источник нужно исключить либо обосновать допустимое исключение.</p></div></div>' + items.map(function (item) {
            var resolution = item.resolution || '';
            return '<article class="econ-legacy-anomaly is-' + escapeHtml(item.severity || 'warning') + '" data-econ-legacy-resolution data-anomaly-id="' + item.id + '"><div><b>' + escapeHtml(item.code) + '</b><small>' + escapeHtml(item.severity === 'blocking' ? 'Блокирует подтверждение' : 'Требует подтверждения') + '</small><p>' + escapeHtml(JSON.stringify(item.details || {})) + '</p></div>' +
                (editable ? '<div class="econ-form-grid"><label><span>Решение</span><select name="resolution"><option value="">Не разобрано</option>' + legacyOptions([['acknowledged_warning', 'Предупреждение принято'], ['excluded_source', 'Источник исключён'], ['not_applicable', 'Не применимо']], resolution) + '</select></label><label class="wide"><span>Комментарий</span><input name="comment" value="' + escapeHtml(item.resolutionComment || '') + '"></label></div>' : '<p><b>' + escapeHtml(resolution || 'Не разобрано') + '</b> ' + escapeHtml(item.resolutionComment || '') + '</p>') + '</article>';
        }).join('') + '</section>';
    }

    function renderLegacySnapshot(review) {
        var snapshot = review.snapshot || {};
        var items = snapshot.items || [];
        return '<section class="econ-legacy-snapshot"><div class="econ-inline-totals">' +
            summaryMetric('projects.budget', kopecksMoney(snapshot.legacyBudgetKopecks), 'Только чтение') +
            summaryMetric('projects.paid', kopecksMoney(snapshot.legacyPaidKopecks), 'Только чтение; денежный поток') +
            summaryMetric('projects.spent', kopecksMoney(snapshot.legacySpentKopecks), 'Только чтение; прежняя семантика') +
            summaryMetric('Итог legacy-сметы', kopecksMoney(snapshot.estimateTotalKopecks), String(snapshot.estimateItemCount || items.length) + ' позиций') + '</div>' +
            '<details class="econ-readonly-lines" open><summary>Неизменяемый снимок позиций (' + items.length + ')</summary><div class="econ-table-wrap"><table class="econ-table"><thead><tr><th>Позиция</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>' + items.map(function (item) {
                return '<tr><td><b>' + escapeHtml(item.title) + '</b><small>#' + item.sourceEstimateItemId + ' · ' + escapeHtml(item.itemKind || '') + '</small></td><td>' + escapeHtml((item.plannedQty == null ? '—' : item.plannedQty) + ' ' + (item.unit || '')) + '</td><td>' + escapeHtml(item.plannedPrice == null ? '—' : money(item.plannedPrice)) + '</td><td>' + escapeHtml(kopecksMoney(item.lineAmountKopecks)) + '</td></tr>';
            }).join('') + '</tbody></table></div></details></section>';
    }

    function renderLegacyHistory(history) {
        history = Array.isArray(history) ? history : [];
        if (!history.length) return '';
        return '<details class="econ-history"><summary>История попыток (' + history.length + ')</summary><ol class="econ-event-list">' + history.map(function (item) {
            var attempt = item.attemptNo || item.attempt_no || '—';
            var status = item.status || '';
            var created = item.createdAt || item.created_at;
            return '<li><time>' + escapeHtml(displayDate(created, true)) + '</time><div><b>Попытка ' + escapeHtml(attempt) + ' · ' + escapeHtml(STATUS_LABELS[status] || status) + '</b><small>Снимок #' + escapeHtml(item.snapshotId || item.snapshot_id || '—') + (item.generatedBaselineId || item.generated_baseline_id ? ' · база #' + escapeHtml(item.generatedBaselineId || item.generated_baseline_id) : '') + '</small></div></li>';
        }).join('') + '</ol></details>';
    }

    function renderLegacyReadonlyDecisions(review) {
        var decisions = review.decisions || [];
        if (!decisions.length) return '<p class="muted">Решения не сохранялись.</p>';
        return '<div class="econ-table-wrap"><table class="econ-table"><thead><tr><th>Источник</th><th>Назначение</th><th>Без НДС</th><th>НДС</th><th>Подтверждение</th></tr></thead><tbody>' + decisions.map(function (item) {
            return '<tr><td><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.sourceKey) + '</small></td><td>' + escapeHtml(item.targetKind) + '</td><td>' + escapeHtml(kopecksMoney(item.netAmountKopecks)) + '</td><td>' + escapeHtml(kopecksMoney(item.vatAmountKopecks)) + '</td><td>' + escapeHtml(item.evidenceKey || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function renderLegacyMode(projectId, bundle) {
        var result = bundle.legacyMigration || {};
        var data = result.data || {};
        var review = data.review;
        var error = sectionError(result, 'Не удалось загрузить мастер классификации legacy-данных.');
        if (!review) {
            return error + '<div class="econ-empty econ-legacy-placeholder"><i data-lucide="scan-search"></i><b>Legacy-данные ещё не сканировались</b><span>Сканирование создаёт неизменяемый снимок projects.budget / paid / spent и estimate_items.planned_price. Исходные значения не редактируются и не мигрируют автоматически.</span><form data-econ-legacy-scan><div class="econ-form-error" data-econ-form-error></div><button class="primary" type="submit">Создать снимок для разбора</button></form></div>';
        }
        var terminal = review.status === 'confirmed' || review.status === 'ignored';
        var snapshot = review.snapshot || { items: [] };
        var decisions = review.decisions || [];
        function decisionFor(kind, itemId) {
            return decisions.find(function (item) { return item.sourceKind === kind && (kind === 'project_budget' || Number(item.snapshotItemId) === Number(itemId)); }) || null;
        }
        var evidences = (review.evidence || []).slice();
        if (!evidences.length) evidences.push({ key: 'source' });
        var header = error + '<div class="econ-entity-head econ-legacy-head"><div><span class="section-label">Неизменяемый снимок #' + review.snapshotId + ' · ревизия ' + review.revisionNo + '</span><h4>Классификация legacy-экономики</h4><p>Хэш источника ' + escapeHtml((snapshot.sourceContentHash || '').slice(0, 28)) + ' · захвачен ' + escapeHtml(displayDate(snapshot.capturedAt, true)) + '</p></div>' + statusBadge(review.status) + '</div>' +
            (review.sourceChanged ? '<div class="economics-notice is-danger"><i data-lucide="refresh-cw"></i><div><b>Исходные поля изменились после снимка</b><span>Не подтверждайте эту попытку. Исключите её и выполните новое сканирование.</span></div></div>' : '') + renderLegacySnapshot(review);
        if (terminal) {
            return header + '<section class="econ-entity-card"><div class="econ-subhead"><div><h4>' + escapeHtml(STATUS_LABELS[review.status]) + '</h4><p>' + escapeHtml(review.status === 'confirmed' ? 'Создана финансовая база #' + (review.generatedBaselineId || '—') + '. Legacy-поля остались без изменений.' : review.ignoreReason || 'Попытка исключена.') + '</p></div></div>' + renderLegacyReadonlyDecisions(review) + renderLegacyAnomalies(review, false) + '</section>' +
                '<form class="econ-form-actions" data-econ-legacy-scan><div class="econ-form-error" data-econ-form-error></div><button class="ghost" type="submit">Сканировать актуальные источники</button></form>' + renderLegacyHistory(data.history);
        }
        var budgetSource = { sourceKind: 'project_budget' };
        var decisionRows = legacyDecisionRow(budgetSource, decisionFor('project_budget'), 1, review) + (snapshot.items || []).map(function (item, index) {
            item.sourceKind = 'estimate_item';
            return legacyDecisionRow(item, decisionFor('estimate_item', item.id), index + 1, review);
        }).join('');
        var manualDecisions = decisions.filter(function (item) { return item.sourceKind === 'manual'; });
        var manualRows = manualDecisions.map(function (item, index) {
            return legacyManualDecisionRow(item, (snapshot.items || []).length + index + 2, review);
        }).join('');
        return header + '<form class="econ-legacy-review-form" data-econ-legacy-update data-review-id="' + review.id + '" data-revision="' + review.revisionNo + '" data-source-hash="' + escapeHtml(snapshot.sourceContentHash || '') + '">' +
            '<section class="econ-create-box" open><div class="econ-form-grid econ-legacy-classification">' +
                '<label><span>Смысл projects.budget</span><select name="budgetClassification" required><option value="">Выберите</option>' + legacyOptions([['contract_revenue_candidate', 'Кандидат в договорную выручку'], ['target_cost_candidate', 'Кандидат в целевую себестоимость'], ['reference_only', 'Только справочно'], ['ignore', 'Не использовать']], review.budgetClassification) + '</select></label>' +
                '<label><span>Смысл цен сметы</span><select name="estimateClassification" required><option value="">Выберите</option>' + legacyOptions([['customer_commercial', 'Коммерческая смета заказчика'], ['internal_cost', 'Внутренняя себестоимость'], ['mixed', 'Смешанная смета'], ['unknown', 'Смысл не установлен']], review.estimateClassification) + '</select></label>' +
                '<label><span>Источники сопоставимы</span><select name="sourcesComparable" required><option value="">Выберите</option>' + legacyOptions([['true', 'Да'], ['false', 'Нет, разные экономические смыслы']], review.sourcesComparable == null ? '' : String(review.sourcesComparable)) + '</select></label>' +
                '<label><span>НДС по умолчанию</span><select name="defaultVatMode">' + legacyVatOptions(review.defaultVatMode || 'unknown') + '</select></label>' +
                '<label><span>Ставка НДС, %</span><input name="defaultVatRate" type="number" min="0" max="100" step="0.01" value="' + escapeHtml(Number(review.defaultVatRateBasisPoints || 0) / 100) + '"></label>' +
                '<label><span>Действует с</span><input name="effectiveFrom" type="date" required value="' + escapeHtml(review.effectiveFrom || todayIso()) + '"></label>' +
                '<label class="wide"><span>Комментарий к расхождению / смыслам</span><textarea name="discrepancyComment" rows="2">' + escapeHtml(review.discrepancyComment || '') + '</textarea></label></div></section>' +
            '<section class="econ-lines-group"><div class="econ-subhead"><div><h5>Подтверждающие документы</h5><p>Файл и его хэш фиксируются в момент сохранения разбора.</p></div><button class="ghost compact" type="button" data-econ-add-legacy-evidence>Добавить источник</button></div><div data-econ-legacy-evidences>' + evidences.map(function (item, index) { return legacyEvidenceRow(bundle, item, index); }).join('') + '</div></section>' +
            '<section class="econ-lines-group"><div class="econ-subhead"><div><h5>Решения по источникам</h5><p>Каждый исходный агрегат и каждая позиция должны получить явное назначение.</p></div></div>' + decisionRows + '</section>' +
            '<section class="econ-lines-group"><div class="econ-subhead"><div><h5>Ручные подтверждённые строки</h5><p>Используйте, когда legacy-бюджет и смета не дают достоверной выручки или себестоимости. Такие строки не изменяют старые поля.</p></div><button class="ghost compact" type="button" data-econ-add-legacy-manual>Добавить ручную строку</button></div><div data-econ-legacy-manual-decisions>' + manualRows + '</div></section>' +
            renderLegacyAnomalies(review, true) + '<div class="econ-form-error" data-econ-form-error></div><div class="econ-form-actions"><button class="primary" type="submit">Сохранить разбор</button></div></form>' +
            '<div class="econ-legacy-terminal-actions"><form data-econ-legacy-confirm data-review-id="' + review.id + '" data-revision="' + review.revisionNo + '" data-source-hash="' + escapeHtml(snapshot.sourceContentHash || '') + '"><div class="econ-form-error" data-econ-form-error></div><button class="primary" type="submit">Подтвердить и создать базу на согласовании</button></form>' +
            '<form data-econ-legacy-ignore data-review-id="' + review.id + '" data-revision="' + review.revisionNo + '"><input name="reason" required placeholder="Причина исключения попытки"><div class="econ-form-error" data-econ-form-error></div><button class="ghost danger" type="submit">Исключить попытку</button></form></div>' + renderLegacyHistory(data.history);
    }

    function renderMode(projectId, bundle, mode) {
        var gate = renderBundleGate(bundle);
        if (gate) return gate;
        if (mode === 'commitments') return renderCommitmentsMode(projectId, bundle);
        if (mode === 'actual') return renderActualMode(projectId, bundle);
        if (mode === 'cash') return renderCashMode(projectId, bundle);
        if (mode === 'forecast') return renderForecastMode(projectId, bundle);
        if (mode === 'legacy') return renderLegacyMode(projectId, bundle);
        return renderBaselineMode(projectId, bundle);
    }

    function render(projectId, initialEconomics) {
        projectId = Number(projectId || 0);
        if (!projectId || !canViewProjectEconomics()) return '';
        var key = String(projectId);
        if (initialEconomics) {
            cacheByProject[key] = cacheByProject[key] || { projectId: projectId };
            cacheByProject[key].economics = { data: initialEconomics, error: null };
        }
        var mode = projectUi(projectId).mode;
        return '<section class="economics-management ui-card" data-economics-management data-project-id="' + projectId + '">' +
            '<div class="econ-management-head"><div><span class="section-label">Путь данных от плана до прогноза</span><h3>Управленческая экономика объекта</h3><p>Работайте слева направо: утвердите план, зафиксируйте заказы и выполнение, затем свяжите оплаты и пересчитайте итог.</p></div><button class="ghost compact" type="button" data-econ-refresh><i data-lucide="refresh-cw"></i><span>Обновить данные</span></button></div>' +
            '<nav class="econ-management-tabs" aria-label="Разделы экономики">' + MODES.map(function (item) {
                return '<button type="button" class="' + (item.key === mode ? 'active' : '') + '" data-econ-mode="' + item.key + '"><b>' + item.step + '</b><i data-lucide="' + item.icon + '"></i><span>' + item.label + '<small>' + item.description + '</small></span></button>';
            }).join('') + '</nav>' +
            '<div class="econ-management-body" data-econ-management-body>' + renderMode(projectId, cacheByProject[key], mode) + '</div>' +
        '</section>';
    }

    function workspaceFrom(root, projectId) {
        if (root && root.matches && root.matches('[data-economics-management]')) return root;
        return qs('[data-economics-management][data-project-id="' + projectId + '"]', root || document);
    }

    function paint(workspace, projectId) {
        if (!workspace || !workspace.isConnected) return;
        var mode = projectUi(projectId).mode;
        qsa('[data-econ-mode]', workspace).forEach(function (button) {
            button.classList.toggle('active', button.dataset.econMode === mode);
        });
        var body = qs('[data-econ-management-body]', workspace);
        if (body) body.innerHTML = renderMode(projectId, cacheByProject[String(projectId)], mode);
        syncSuccessorRows(workspace);
        syncAllocationTargets(workspace);
        syncActualMappings(workspace);
        refreshLucideIcons(workspace);
    }

    function formError(form, message) {
        var node = qs('[data-econ-form-error]', form);
        if (!node) return;
        node.textContent = message || '';
        node.classList.toggle('active', !!message);
    }

    function editableDraftForm(node) {
        if (!node) return null;
        if (node.matches && node.matches(DIRTY_FORM_SELECTOR)) return node;
        return node.closest ? node.closest(DIRTY_FORM_SELECTOR) : null;
    }

    function markDraftDirty(node) {
        var form = editableDraftForm(node);
        if (form) form.dataset.econDirty = '1';
        return form;
    }

    function hasUnsavedDraft(form) {
        return !!(form && form.dataset.econDirty === '1');
    }

    function guardUnsavedDraft(form) {
        if (!hasUnsavedDraft(form)) return false;
        formError(form, 'Есть несохранённые изменения. Сначала сохраните черновик; переход, обновление и отправка по workflow заблокированы.');
        return true;
    }

    function firstUnsavedDraft(workspace) {
        return qsa(DIRTY_FORM_SELECTOR, workspace).find(hasUnsavedDraft) || null;
    }

    function mutation(workspace, projectId, lockTarget, requestFactory, successMessage, refreshCallback) {
        formError(lockTarget.closest ? (lockTarget.closest('form') || lockTarget) : lockTarget, '');
        return withSubmitLock(lockTarget, requestFactory).then(function (response) {
            invalidateProjectCache(projectId);
            showAppNotice(successMessage, 'success');
            return load(projectId, true).then(function () {
                paint(workspace, projectId);
                if (typeof refreshCallback === 'function') return refreshCallback(response);
                return response;
            });
        }).catch(function (error) {
            var message = errorText(error);
            var form = lockTarget.closest ? lockTarget.closest('form') : null;
            if (form) formError(form, message);
            else showAppNotice(message, 'error');
            throw error;
        });
    }

    function baselineLinePayload(row) {
        var payload = {
            title: row.elements.title.value.trim(),
            sectionTitle: row.elements.sectionTitle.value.trim(),
            unit: row.elements.unit.value.trim(),
            quantity: row.elements.quantity.value === '' ? null : Number(row.elements.quantity.value),
            sourceAmountKopecks: toKopecks(row.elements.sourceAmount.value),
            vatMode: row.elements.vatMode.value,
            vatRateBasisPoints: toBasisPoints(row.elements.vatRate.value || 0),
            sourceType: row.elements.sourceType.value,
            sourceReference: row.elements.sourceReference.value.trim(),
            estimateItemId: row.elements.estimateItemId.value || null,
            sourceDocumentId: row.elements.sourceDocumentId.value || null
        };
        if (row.dataset.lineKind === 'budget') {
            payload.lineType = row.elements.lineType.value;
            payload.costCode = row.elements.costCode.value.trim();
            if (payload.lineType === 'management_reserve') payload.estimateItemId = null;
        }
        return payload;
    }

    function successorMappingsPayload(form) {
        var payload = { budgetMappings: [], revenueMappings: [] };
        qsa('[data-econ-successor-row]', form).forEach(function (row) {
            var targetId = row.querySelector('[name="targetLineId"]').value;
            if (!targetId) return;
            var kind = row.dataset.mappingKind;
            var item = {
                mappingKind: row.querySelector('[name="mappingKind"]').value,
                reason: row.querySelector('[name="reason"]').value.trim()
            };
            if (kind === 'budget') {
                item.sourceBudgetLineId = Number(row.dataset.sourceLineId);
                item.targetBudgetLineId = Number(targetId);
                item.quantityFactor = Number(row.querySelector('[name="quantityFactor"]').value);
                payload.budgetMappings.push(item);
            } else {
                item.sourceRevenueLineId = Number(row.dataset.sourceLineId);
                item.targetRevenueLineId = Number(targetId);
                payload.revenueMappings.push(item);
            }
        });
        return payload;
    }

    function savedSuccessorMappingsPayload(baseline) {
        var source = baseline && baseline.successorMappings || {};
        return {
            budgetMappings: (source.budget || []).map(function (item) {
                return {
                    sourceBudgetLineId: Number(item.sourceBudgetLineId),
                    targetBudgetLineId: Number(item.targetBudgetLineId),
                    mappingKind: item.mappingKind,
                    quantityFactor: Number(item.quantityFactor),
                    reason: item.reason || ''
                };
            }),
            revenueMappings: (source.revenue || []).map(function (item) {
                return {
                    sourceRevenueLineId: Number(item.sourceRevenueLineId),
                    targetRevenueLineId: Number(item.targetRevenueLineId),
                    mappingKind: item.mappingKind,
                    reason: item.reason || ''
                };
            })
        };
    }

    function normalizedMappingJson(payload) {
        function sorter(sourceKey) {
            return function (left, right) { return Number(left[sourceKey]) - Number(right[sourceKey]); };
        }
        return JSON.stringify({
            budgetMappings: (payload.budgetMappings || []).slice().sort(sorter('sourceBudgetLineId')),
            revenueMappings: (payload.revenueMappings || []).slice().sort(sorter('sourceRevenueLineId'))
        });
    }

    function actualPayload(form, isUpdate) {
        var commitmentLineId = form.elements.commitmentLineId.value || null;
        var payload = {
            costCategory: form.elements.costCategory.value,
            commitmentLineId: commitmentLineId,
            recognitionDate: form.elements.recognitionDate.value,
            documentId: form.elements.documentId.value || null,
            title: form.elements.title.value.trim(),
            quantity: Number(form.elements.quantity.value),
            unit: form.elements.unit.value.trim(),
            unitPrice: Number(form.elements.unitPrice.value),
            vatMode: form.elements.vatMode.value,
            vatRateBasisPoints: toBasisPoints(form.elements.vatRate.value || 0),
            reason: form.elements.reason.value.trim()
        };
        if (!commitmentLineId) {
            var baseline = approvedBaseline(cacheByProject[String(form.closest('[data-economics-management]').dataset.projectId)]);
            payload.baselineId = baseline && baseline.id;
            payload.budgetLineId = form.elements.budgetLineId.value;
        }
        if (!isUpdate) {
            payload.sourceType = form.elements.sourceType.value;
            payload.sourceEventKey = form.elements.sourceEventKey.value.trim();
        }
        return payload;
    }

    function commitmentLinesPayload(form) {
        return qsa('[data-econ-commitment-line]', form).map(function (row) {
            return {
                budgetLineId: row.querySelector('[name="budgetLineId"]').value,
                title: row.querySelector('[name="title"]').value.trim(),
                unit: row.querySelector('[name="unit"]').value.trim(),
                quantity: Number(row.querySelector('[name="quantity"]').value),
                unitPrice: Number(row.querySelector('[name="unitPrice"]').value),
                vatMode: row.querySelector('[name="vatMode"]').value,
                vatRateBasisPoints: toBasisPoints(row.querySelector('[name="vatRate"]').value || 0),
                sourceReference: row.querySelector('[name="sourceReference"]').value.trim()
            };
        });
    }

    function forecastPayload(form) {
        var normalizations = qsa('[data-econ-price-normalization]', form).map(function (row) {
            return {
                sourceType: row.querySelector('[name="sourceType"]').value,
                sourceId: Number(row.querySelector('[name="sourceId"]').value),
                vatMode: row.querySelector('[name="vatMode"]').value,
                vatRateBasisPoints: toBasisPoints(row.querySelector('[name="vatRate"]').value || 0)
            };
        }).filter(function (item) { return item.sourceId > 0; });
        var manualPrices = qsa('[data-econ-manual-price]', form).map(function (row) {
            var price = row.querySelector('[name="unitPriceNet"]').value;
            if (!price) return null;
            return { budgetLineId: Number(row.dataset.budgetLineId), unitPriceNet: Number(price), reason: row.querySelector('[name="reason"]').value.trim() };
        }).filter(Boolean);
        var adjustments = qsa('[data-econ-adjustment]', form).map(function (row) {
            return {
                type: row.querySelector('[name="type"]').value,
                title: row.querySelector('[name="title"]').value.trim(),
                amountNet: Number(row.querySelector('[name="amountNet"]').value),
                budgetLineId: row.querySelector('[name="budgetLineId"]').value || null,
                sourceReference: row.querySelector('[name="sourceReference"]').value.trim(),
                reason: row.querySelector('[name="reason"]').value.trim()
            };
        });
        return { calculationDate: form.elements.calculationDate.value, reason: form.elements.reason.value.trim(), priceNormalizations: normalizations, manualPrices: manualPrices, adjustments: adjustments };
    }

    function legacyReviewPayload(form) {
        var evidence = qsa('[data-econ-legacy-evidence]', form).map(function (row) {
            return {
                key: row.querySelector('[name="evidenceKey"]').value.trim(),
                documentId: Number(row.querySelector('[name="documentId"]').value),
                sourceReference: row.querySelector('[name="sourceReference"]').value.trim()
            };
        });
        var decisions = qsa('[data-econ-legacy-decision]', form).map(function (row) {
            var item = {
                sourceKind: row.dataset.sourceKind,
                targetKind: row.querySelector('[name="targetKind"]').value,
                position: Number(row.querySelector('[name="position"]').value),
                title: row.querySelector('[name="title"]').value.trim(),
                vatMode: row.querySelector('[name="vatMode"]').value,
                vatRateBasisPoints: toBasisPoints(row.querySelector('[name="vatRate"]').value || 0),
                evidenceKey: row.querySelector('[name="evidenceKey"]').value.trim() || null,
                comment: row.querySelector('[name="comment"]').value.trim()
            };
            if (row.dataset.sourceKind === 'estimate_item') {
                item.snapshotItemId = Number(row.dataset.snapshotItemId);
                item.lineType = row.querySelector('[name="lineType"]').value;
                item.costCode = row.querySelector('[name="costCode"]').value.trim() || null;
            } else if (row.dataset.sourceKind === 'manual') {
                item.clientKey = row.querySelector('[name="clientKey"]').value.trim();
                item.sourceAmountKopecks = Math.round(Number(row.querySelector('[name="sourceAmount"]').value || 0) * 100);
                item.sectionTitle = row.querySelector('[name="sectionTitle"]').value.trim() || null;
                item.unit = row.querySelector('[name="unit"]').value.trim() || null;
                item.quantity = row.querySelector('[name="quantity"]').value || null;
                item.lineType = row.querySelector('[name="lineType"]').value;
                item.costCode = row.querySelector('[name="costCode"]').value.trim() || null;
            }
            return item;
        });
        var resolutions = qsa('[data-econ-legacy-resolution]', form).map(function (row) {
            var resolution = row.querySelector('[name="resolution"]').value;
            if (!resolution) return null;
            return { anomalyId: Number(row.dataset.anomalyId), resolution: resolution, comment: row.querySelector('[name="comment"]').value.trim() };
        }).filter(Boolean);
        var comparable = form.elements.sourcesComparable.value;
        return {
            expectedRevision: Number(form.dataset.revision),
            expectedSourceContentHash: form.dataset.sourceHash,
            budgetClassification: form.elements.budgetClassification.value,
            estimateClassification: form.elements.estimateClassification.value,
            defaultVatMode: form.elements.defaultVatMode.value,
            defaultVatRateBasisPoints: toBasisPoints(form.elements.defaultVatRate.value || 0),
            sourcesComparable: comparable === 'true' ? true : (comparable === 'false' ? false : null),
            effectiveFrom: form.elements.effectiveFrom.value,
            discrepancyComment: form.elements.discrepancyComment.value.trim(),
            evidence: evidence,
            decisions: decisions,
            resolutions: resolutions
        };
    }

    function workflowPath(action, id) {
        var parts = action.split('-');
        var entity = parts[0];
        var operation = parts[1];
        var prefixes = { baseline: 'financial-baselines', commitment: 'commitments', actual: 'actual-costs', allocation: 'payment-allocations', forecast: 'forecasts' };
        return '/api/' + prefixes[entity] + '/' + id + '/' + operation;
    }

    function syncSuccessorRows(workspace) {
        qsa('[data-econ-successor-row]', workspace).forEach(function (row) {
            var target = row.querySelector('[name="targetLineId"]');
            var enabled = !!(target && target.value);
            var reason = row.querySelector('[name="reason"]');
            var mappingKind = row.querySelector('[name="mappingKind"]');
            var factor = row.querySelector('[name="quantityFactor"]');
            if (reason) {
                reason.disabled = !enabled;
                reason.required = enabled;
            }
            if (mappingKind) mappingKind.disabled = !enabled;
            if (factor) {
                factor.disabled = !enabled;
                factor.required = enabled;
            }
            row.classList.toggle('is-unmapped', !enabled);
        });
    }

    function syncAllocationTargets(workspace) {
        qsa('[data-econ-allocation-create]', workspace).forEach(function (form) {
            var payment = form.elements.financeEntryId;
            var target = form.elements.target;
            if (!payment || !target) return;
            var option = payment.options[payment.selectedIndex];
            var direction = option && option.dataset.direction || '';
            Array.prototype.forEach.call(target.options, function (targetOption) {
                var allowed = !targetOption.value || !direction || targetOption.dataset.direction === direction;
                targetOption.hidden = !allowed;
                targetOption.disabled = !allowed;
            });
            if (target.selectedOptions.length && target.selectedOptions[0].disabled) target.value = '';
        });
    }

    function syncActualMappings(workspace) {
        qsa('[data-econ-actual-create], [data-econ-actual-update]', workspace).forEach(function (form) {
            var commitment = form.elements.commitmentLineId;
            var budget = form.elements.budgetLineId;
            if (!commitment || !budget) return;
            var inherits = !!commitment.value;
            budget.disabled = inherits;
            budget.required = !inherits;
            var hint = qs('[data-econ-actual-mapping-hint]', form);
            if (hint) hint.textContent = inherits
                ? 'Наследуется из утверждённой строки обязательства, включая историческую версию базы.'
                : 'Обязательна для затрат без обязательства.';
        });
    }

    function bindSubmit(workspace, projectId, refreshCallback, event) {
        var form = event.target;
        if (!form || form.tagName !== 'FORM') return false;
        var path;
        var payload;
        var success;
        var runRequest;
        try {
            if (form.matches('[data-econ-baseline-create]')) {
                path = '/api/projects/' + projectId + '/financial-baselines';
                payload = { reason: form.elements.reason.value.trim(), effectiveFrom: form.elements.effectiveFrom.value, sourceDocumentId: form.elements.sourceDocumentId.value || null, cloneFromBaselineId: form.elements.cloneFromBaselineId.value || null };
                success = 'Черновик финансовой базы создан.';
            } else if (form.matches('[data-econ-baseline-update]')) {
                path = '/api/financial-baselines/' + form.dataset.baselineId + '/update';
                payload = { reason: form.elements.reason.value.trim(), effectiveFrom: form.elements.effectiveFrom.value, sourceDocumentId: form.elements.sourceDocumentId.value || null, revenueLines: qsa('[data-econ-baseline-line][data-line-kind="revenue"]', form).map(baselineLinePayload), budgetLines: qsa('[data-econ-baseline-line][data-line-kind="budget"]', form).map(baselineLinePayload) };
                success = 'Черновик финансовой базы сохранён.';
            } else if (form.matches('[data-econ-successor-update]')) {
                path = '/api/financial-baselines/' + form.dataset.baselineId + '/successors';
                payload = successorMappingsPayload(form);
                success = 'Сопоставление версий финансовой базы сохранено.';
            } else if (form.matches('[data-econ-commitment-create]')) {
                path = '/api/projects/' + projectId + '/commitments';
                payload = { baselineId: approvedBaseline(cacheByProject[String(projectId)]).id, commitmentType: form.elements.commitmentType.value, commitmentNo: form.elements.commitmentNo.value.trim(), counterpartyName: form.elements.counterpartyName.value.trim(), expectedDate: form.elements.expectedDate.value, documentId: form.elements.documentId.value || null, reason: form.elements.reason.value.trim(), lines: commitmentLinesPayload(form) };
                success = 'Черновик обязательства создан.';
            } else if (form.matches('[data-econ-commitment-offer-create]')) {
                path = '/api/projects/' + projectId + '/commitments/from-offer';
                payload = { supplierOfferId: Number(form.elements.supplierOfferId.value), budgetLineId: form.elements.budgetLineId.value || null, commitmentNo: form.elements.commitmentNo.value.trim(), expectedDate: form.elements.expectedDate.value, vatMode: form.elements.vatMode.value, vatRateBasisPoints: toBasisPoints(form.elements.vatRate.value || 0), reason: form.elements.reason.value.trim() };
                success = 'Черновик обязательства из предложения создан.';
            } else if (form.matches('[data-econ-commitment-update]')) {
                path = '/api/commitments/' + form.dataset.entityId + '/replace-lines';
                payload = {
                    commitmentNo: form.elements.commitmentNo.value.trim(),
                    expectedDate: form.elements.expectedDate.value,
                    reason: form.elements.reason.value.trim(),
                    lines: commitmentLinesPayload(form)
                };
                success = 'Черновик обязательства сохранён.';
            } else if (form.matches('[data-econ-actual-create]')) {
                path = '/api/projects/' + projectId + '/actual-costs';
                payload = actualPayload(form, false);
                success = 'Черновик фактической затраты создан.';
            } else if (form.matches('[data-econ-actual-update]')) {
                path = '/api/actual-costs/' + form.dataset.entityId + '/update';
                payload = actualPayload(form, true);
                success = 'Черновик фактической затраты сохранён.';
            } else if (form.matches('[data-econ-allocation-create]')) {
                var target = form.elements.target.value.split(':');
                path = '/api/projects/' + projectId + '/payment-allocations';
                payload = { financeEntryId: Number(form.elements.financeEntryId.value), targetType: target[0], targetId: Number(target[1]), amount: form.elements.amount.value ? Number(form.elements.amount.value) : null, allocationKey: form.elements.allocationKey.value.trim(), reason: form.elements.reason.value.trim() };
                success = 'Черновик разнесения создан.';
            } else if (form.matches('[data-econ-allocation-update]')) {
                path = '/api/payment-allocations/' + form.dataset.entityId + '/update';
                payload = { amount: Number(form.elements.amount.value), reason: form.elements.reason.value.trim() };
                success = 'Черновик разнесения сохранён.';
            } else if (form.matches('[data-econ-forecast-calculate]')) {
                path = '/api/projects/' + projectId + '/forecasts/calculate';
                payload = forecastPayload(form);
                success = 'Черновик прогноза рассчитан.';
            } else if (form.matches('[data-econ-legacy-scan]')) {
                path = '/api/projects/' + projectId + '/legacy-economics-migration/scan';
                payload = {};
                success = 'Неизменяемый снимок legacy-данных подготовлен.';
            } else if (form.matches('[data-econ-legacy-update]')) {
                path = '/api/legacy-economics-migrations/' + form.dataset.reviewId + '/update';
                payload = legacyReviewPayload(form);
                success = 'Классификация legacy-данных сохранена.';
            } else if (form.matches('[data-econ-legacy-confirm]')) {
                var legacyEditor = qs('[data-econ-legacy-update][data-review-id="' + form.dataset.reviewId + '"]', workspace);
                if (guardUnsavedDraft(legacyEditor)) {
                    event.preventDefault();
                    formError(form, 'Сначала сохраните текущий разбор; подтверждение предыдущей ревизии заблокировано.');
                    return true;
                }
                path = '/api/legacy-economics-migrations/' + form.dataset.reviewId + '/confirm';
                payload = { expectedRevision: Number(form.dataset.revision), expectedSourceContentHash: form.dataset.sourceHash };
                success = 'Классификация подтверждена; создана финансовая база на согласовании.';
            } else if (form.matches('[data-econ-legacy-ignore]')) {
                path = '/api/legacy-economics-migrations/' + form.dataset.reviewId + '/ignore';
                payload = { expectedRevision: Number(form.dataset.revision), reason: form.elements.reason.value.trim() };
                success = 'Попытка legacy-миграции исключена.';
            } else if (form.matches('[data-econ-return-form]')) {
                path = workflowPath(form.dataset.entityKind + '-return', form.dataset.entityId);
                payload = { reason: form.elements.reason.value.trim() };
                success = 'Запись возвращена на доработку.';
            } else if (form.matches('[data-econ-cancel-form]')) {
                path = '/api/commitments/' + form.dataset.entityId + '/cancel';
                payload = { cancellationReason: form.elements.reason.value.trim() };
                success = 'Обязательство отменено.';
            } else if (form.matches('[data-econ-reverse-form]')) {
                path = workflowPath(form.dataset.entityKind + '-reverse', form.dataset.entityId);
                payload = { reason: form.elements.reason.value.trim() };
                if (form.elements.recognitionDate) payload.recognitionDate = form.elements.recognitionDate.value;
                success = 'Черновик сторно создан.';
            } else {
                return false;
            }
        } catch (error) {
            formError(form, error.message || 'Проверьте заполнение формы.');
            return true;
        }
        event.preventDefault();
        mutation(workspace, projectId, form, function () {
            return runRequest ? runRequest() : request(path, { method: 'POST', body: JSON.stringify(payload) });
        }, success, refreshCallback).catch(function () {});
        return true;
    }

    function bindClick(workspace, projectId, refreshCallback, event) {
        var button = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!button || !workspace.contains(button)) return;
        if (button.matches('[data-econ-mode]')) {
            if (guardUnsavedDraft(firstUnsavedDraft(workspace))) return;
            projectUi(projectId).mode = button.dataset.econMode;
            paint(workspace, projectId);
            if (!bundleIsFresh(cacheByProject[String(projectId)])) {
                load(projectId, true).then(function () { paint(workspace, projectId); }).catch(function (error) {
                    showAppNotice(errorText(error), 'error');
                });
            }
            return;
        }
        if (button.matches('[data-econ-refresh]')) {
            if (guardUnsavedDraft(firstUnsavedDraft(workspace))) return;
            withSubmitLock(button, function () { return load(projectId, true); }).then(function () { paint(workspace, projectId); }).catch(function (error) { showAppNotice(errorText(error), 'error'); });
            return;
        }
        if (button.matches('[data-econ-select="baseline"]')) {
            if (guardUnsavedDraft(firstUnsavedDraft(workspace))) return;
            projectUi(projectId).selectedBaselineId = Number(button.dataset.entityId);
            paint(workspace, projectId);
            return;
        }
        if (button.matches('[data-econ-add-baseline-line]')) {
            var kind = button.dataset.econAddBaselineLine;
            var target = qs('[data-econ-baseline-lines="' + kind + '"]', button.closest('form'));
            if (target) {
                target.insertAdjacentHTML('beforeend', renderBaselineLine({}, kind, target.children.length, cacheByProject[String(projectId)]));
                markDraftDirty(button);
            }
            return;
        }
        if (button.matches('[data-econ-add-commitment-line]')) {
            var lineRoot = qs('[data-econ-commitment-lines]', button.closest('form'));
            if (lineRoot) {
                lineRoot.insertAdjacentHTML('beforeend', renderCommitmentLineEditor(cacheByProject[String(projectId)], {}, lineRoot.children.length));
                markDraftDirty(button);
            }
            return;
        }
        if (button.matches('[data-econ-add-legacy-evidence]')) {
            var evidenceRoot = qs('[data-econ-legacy-evidences]', button.closest('form'));
            if (evidenceRoot) {
                evidenceRoot.insertAdjacentHTML('beforeend', legacyEvidenceRow(cacheByProject[String(projectId)], {}, evidenceRoot.children.length));
                markDraftDirty(button);
            }
            return;
        }
        if (button.matches('[data-econ-add-legacy-manual]')) {
            var manualRoot = qs('[data-econ-legacy-manual-decisions]', button.closest('form'));
            var review = (((cacheByProject[String(projectId)] || {}).legacyMigration || {}).data || {}).review || {};
            if (manualRoot) {
                var position = qsa('[data-econ-legacy-decision]', button.closest('form')).length + 1;
                manualRoot.insertAdjacentHTML('beforeend', legacyManualDecisionRow({ sourceKey: 'manual:manual_' + Date.now() }, position, review));
                markDraftDirty(button);
                refreshLucideIcons(manualRoot);
            }
            return;
        }
        if (button.matches('[data-econ-remove-line]')) {
            var fieldset = button.closest('fieldset');
            if (fieldset) {
                markDraftDirty(button);
                fieldset.remove();
            }
            return;
        }
        if (button.matches('[data-econ-add-normalization]')) {
            var normalizations = qs('[data-econ-normalizations]', button.closest('form'));
            if (normalizations) normalizations.insertAdjacentHTML('beforeend', '<div class="econ-normalization-row" data-econ-price-normalization><select name="sourceType"><option value="supplier_offer">Предложение</option><option value="market_snapshot">Снимок AutoBot</option></select><input name="sourceId" type="number" min="1" required placeholder="ID источника"><select name="vatMode">' + vatModeOptions('no_vat') + '</select><input name="vatRate" type="number" min="0" max="100" step="0.01" value="0" aria-label="НДС, %"><button class="ghost compact" type="button" data-econ-remove-line>Удалить</button></div>');
            return;
        }
        if (button.matches('[data-econ-add-adjustment]')) {
            var adjustments = qs('[data-econ-adjustments]', button.closest('form'));
            if (adjustments) adjustments.insertAdjacentHTML('beforeend', '<fieldset class="econ-line-editor" data-econ-adjustment><div class="econ-form-grid"><label><span>Тип</span><select name="type"><option value="adjustment">Корректировка</option><option value="risk">Риск</option></select></label><label><span>Название</span><input name="title" required></label><label><span>Сумма без НДС, ₽</span><input name="amountNet" type="number" step="0.01" required></label><label><span>Строка бюджета</span><select name="budgetLineId">' + approvedBudgetOptions(cacheByProject[String(projectId)], null) + '</select></label><label class="wide"><span>Источник</span><input name="sourceReference" required value="manual"></label><label class="wide"><span>Основание</span><input name="reason" required></label></div><button class="ghost compact" type="button" data-econ-remove-line>Удалить</button></fieldset>');
            return;
        }
        if (button.matches('[data-econ-action]')) {
            var action = button.dataset.econAction;
            var entityId = Number(button.dataset.entityId || 0);
            if (/-submit$/.test(action) && guardUnsavedDraft(editableDraftForm(button))) return;
            if (action === 'baseline-submit') {
                var mappingForm = qs('[data-econ-successor-update][data-baseline-id="' + entityId + '"]', workspace);
                var baseline = baselines(cacheByProject[String(projectId)]).find(function (item) { return Number(item.id) === entityId; });
                if (mappingForm && baseline && normalizedMappingJson(successorMappingsPayload(mappingForm)) !== normalizedMappingJson(savedSuccessorMappingsPayload(baseline))) {
                    var mappingDetails = mappingForm.closest('details');
                    if (mappingDetails) mappingDetails.open = true;
                    formError(mappingForm, 'Сопоставление old→new изменено. Сначала сохраните его, затем отправляйте версию на утверждение.');
                    return;
                }
            }
            var path = workflowPath(action, entityId);
            var operation = action.split('-')[1];
            var messages = { submit: 'Отправлено на утверждение.', approve: 'Запись утверждена.' };
            mutation(workspace, projectId, button, function () {
                return request(path, { method: 'POST', body: '{}' });
            }, messages[operation] || 'Статус обновлён.', refreshCallback).catch(function () {});
        }
    }

    function bind(root, projectId, refreshCallback) {
        projectId = Number(projectId || 0);
        if (!projectId || !canViewProjectEconomics()) return Promise.resolve(null);
        var workspace = workspaceFrom(root, projectId);
        if (!workspace) return Promise.resolve(null);
        workspace.__economicsRefreshCallback = refreshCallback;
        if (workspace.dataset.economicsManagementBound !== '1') {
            workspace.dataset.economicsManagementBound = '1';
            workspace.addEventListener('click', function (event) {
                bindClick(workspace, projectId, workspace.__economicsRefreshCallback, event);
            });
            workspace.addEventListener('submit', function (event) {
                bindSubmit(workspace, projectId, workspace.__economicsRefreshCallback, event);
            });
            workspace.addEventListener('input', function (event) {
                markDraftDirty(event.target);
            });
            workspace.addEventListener('change', function (event) {
                markDraftDirty(event.target);
                if (event.target && event.target.matches('[data-econ-allocation-payment]')) syncAllocationTargets(workspace);
                if (event.target && event.target.matches('[data-econ-successor-row] [name="targetLineId"]')) syncSuccessorRows(workspace);
                if (event.target && event.target.matches('[name="commitmentLineId"]')) syncActualMappings(workspace);
                if (event.target && event.target.name === 'vatMode') {
                    var container = event.target.closest('form, fieldset, [data-econ-price-normalization]');
                    var rate = container && qs('[name="vatRate"]', container);
                    if (rate && event.target.value === 'no_vat') rate.value = '0';
                }
            });
        }
        return load(projectId).then(function () {
            paint(workspace, projectId);
            return cacheByProject[String(projectId)];
        }).catch(function (error) {
            var body = qs('[data-econ-management-body]', workspace);
            if (body) body.innerHTML = '<div class="economics-notice is-danger"><i data-lucide="circle-alert"></i><div><b>Контур управления не загрузился</b><span>' + escapeHtml(errorText(error)) + '</span></div></div>';
            refreshLucideIcons(workspace);
            return null;
        });
    }

    PMBI.economicsManagement = {
        __loaded: true,
        render: render,
        bind: bind,
        load: load,
        invalidate: function (projectId) {
            invalidateProjectCache(projectId);
        },
        openCommitmentFromOffer: function (projectId, offerId) {
            var ui = projectUi(projectId);
            ui.mode = 'commitments';
            var workspace = workspaceFrom(document, projectId);
            if (workspace) {
                paint(workspace, projectId);
                var select = qs('[data-econ-commitment-offer-create] [name="supplierOfferId"]', workspace);
                if (select) {
                    select.value = String(offerId || '');
                    var details = select.closest('details');
                    if (details) details.open = true;
                    select.focus();
                }
            }
        }
    };
    window.PMBI = PMBI;
})();
