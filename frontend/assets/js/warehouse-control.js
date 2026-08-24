(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    if (PMBI.warehouseControl && PMBI.warehouseControl.__loaded) return;
    var module = PMBI.warehouseControl = PMBI.warehouseControl || {};
    module.__loaded = true;

    var state = PMBI.state;
    var api = PMBI.api;
    var qs = PMBI.qs;
    var qsa = PMBI.qsa;
    var escapeHtml = PMBI.escapeHtml;
    var safeReplaceChildren = PMBI.safeReplaceChildren;
    var showSkeleton = PMBI.showSkeleton;
    var refreshLucideIcons = PMBI.refreshLucideIcons;
    var showAppNotice = PMBI.showAppNotice;
    var cache = {};
    var loading = {};

    function todayIso() {
        var now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }

    function requestKey(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + ':' + window.crypto.randomUUID();
        return prefix + ':' + Date.now() + ':' + Math.random().toString(16).slice(2);
    }

    function quantity(value) {
        var number = Number(value || 0);
        if (!Number.isFinite(number)) return '0';
        return String(Math.round(number * 1000) / 1000).replace('.', ',');
    }

    function progress(value, total) {
        var maximum = Number(total || 0);
        if (!(maximum > 0)) return Number(value || 0) > 0 ? 100 : 0;
        return Math.max(0, Math.min(100, Math.round(Number(value || 0) / maximum * 100)));
    }

    function dateTime(timestamp) {
        var value = Number(timestamp || 0);
        if (!(value > 0)) return 'Дата не указана';
        try {
            return new Intl.DateTimeFormat('ru-RU', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }).format(new Date(value * 1000));
        } catch (error) {
            return new Date(value * 1000).toLocaleString('ru-RU');
        }
    }

    function errorText(error, fallback) {
        var code = error && error.payload && error.payload.error ? error.payload.error : '';
        var labels = {
            work_material_norms_required: 'Для этой работы ещё не настроены нормы списания материалов.',
            bad_work_fact_quantity: 'Укажи положительный фактический объём.',
            bad_work_fact_date: 'Укажи корректную дату факта.',
            work_item_not_found: 'Работа не найдена в текущей смете.',
            material_item_not_found: 'Материал не найден в текущей смете.',
            bad_material_norm_quantity: 'Норма расхода должна быть больше нуля.',
            bad_material_norm_waste: 'Допустимый технологический запас — от 0 до 100%.',
            work_fact_reversal_reason_required: 'Для сторно обязательно укажи причину.',
            work_fact_not_found: 'Запись о работе не найдена.',
            bad_stock_move_values: 'Проверь количество материала.',
            bad_estimate_item_id: 'Выбери материал.',
            bad_qty: 'Количество должно быть больше нуля.',
            estimate_item_project_mismatch: 'Материал не найден в этом объекте.'
        };
        return labels[code] || code || fallback;
    }

    function metric(label, value, tone) {
        return '<article class="warehouse-control-metric' + (tone ? ' is-' + tone : '') + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></article>';
    }

    function optionRows(items, placeholder) {
        return '<option value="">' + escapeHtml(placeholder) + '</option>' + (items || []).map(function (item) {
            return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.title) + ' · ' + escapeHtml(item.unit || '') + '</option>';
        }).join('');
    }

    function stockMovementForm(payload) {
        if (!payload.canRecordFacts) return '';
        return '<section class="warehouse-control-card warehouse-control-move-card" data-warehouse-move-card>' +
            '<div class="warehouse-control-card-head"><div><span class="section-label">Новая операция</span><h3>Записать движение</h3><p>Найди материал или нажми на его карточку в списке.</p></div><i data-lucide="scan-line"></i></div>' +
            '<form class="warehouse-control-form" data-stock-move-form>' +
                '<div class="warehouse-control-move-switch" role="radiogroup" aria-label="Тип операции">' +
                    '<label><input type="radio" name="move_type" value="purchase"><span><i data-lucide="shopping-cart"></i><b>Купили</b><small>Закупка</small></span></label>' +
                    '<label><input type="radio" name="move_type" value="receipt" checked><span><i data-lucide="package-check"></i><b>Привезли</b><small>На объект</small></span></label>' +
                    '<label><input type="radio" name="move_type" value="use"><span><i data-lucide="package-minus"></i><b>Потратили</b><small>В работу</small></span></label>' +
                '</div>' +
                '<label class="warehouse-control-picker-label"><span>Материал</span>' +
                    '<div class="warehouse-control-picker" data-stock-material-picker>' +
                        '<i data-lucide="search" aria-hidden="true"></i>' +
                        '<input type="search" data-stock-material-search autocomplete="off" role="combobox" aria-expanded="false" aria-controls="warehouse-material-suggestions" placeholder="Начните вводить название...">' +
                        '<input name="estimate_item_id" type="hidden">' +
                        '<button type="button" data-stock-material-clear aria-label="Очистить выбор" hidden><i data-lucide="x"></i></button>' +
                        '<div class="warehouse-control-suggestions" id="warehouse-material-suggestions" data-stock-material-suggestions hidden></div>' +
                    '</div>' +
                '</label>' +
                '<div class="warehouse-control-selection" data-stock-selection-summary><i data-lucide="mouse-pointer-click"></i><span>Выберите материал — здесь сразу появятся план, приход, расход и остаток.</span></div>' +
                '<div class="warehouse-control-move-fields">' +
                    '<label><span>Количество</span><div class="warehouse-control-qty-field"><input name="qty" type="number" min="0.001" step="0.001" required placeholder="Например, 10"><span data-stock-qty-unit>ед.</span></div></label>' +
                    '<button class="ghost compact warehouse-control-fill" type="button" data-stock-fill-remaining hidden></button>' +
                '</div>' +
                '<label><span>Комментарий <small>необязательно</small></span><input name="comment" maxlength="500" placeholder="Накладная, поставщик или пояснение"></label>' +
                '<div class="warehouse-control-operation-preview" data-stock-move-preview>Введите количество — покажем результат до сохранения.</div>' +
                '<div class="form-error" data-stock-move-error></div>' +
                '<button class="primary warehouse-control-submit" type="submit" data-stock-move-submit><i data-lucide="check"></i><span>Добавить приход</span></button>' +
            '</form>' +
        '</section>';
    }

    function factForm(payload) {
        if (!payload.canRecordFacts) return '';
        return '<details class="warehouse-control-section warehouse-control-work-section">' +
            '<summary><i data-lucide="hard-hat"></i><span><b>Записать выполненные работы</b><small>Если настроено автосписание, склад обновится сам</small></span><i data-lucide="chevron-down"></i></summary>' +
            '<div class="warehouse-control-section-body">' +
                '<form class="warehouse-control-form" data-work-fact-form>' +
                    '<div class="warehouse-control-form-grid">' +
                        '<label><span>Что сделали</span><select name="work_item_id" required>' + optionRows(payload.works, 'Выбери работу') + '</select></label>' +
                        '<label><span>Сколько</span><input name="quantity" type="number" min="0.001" step="0.001" required placeholder="30"></label>' +
                        '<label><span>Дата</span><input name="report_date" type="date" value="' + todayIso() + '" required></label>' +
                    '</div>' +
                    '<label><span>Комментарий <small>необязательно</small></span><input name="comment" maxlength="1000" placeholder="Например: уложили плитку в секции А"></label>' +
                    '<div class="warehouse-control-preview" data-work-fact-preview><span>Выбери работу и объём — покажем, что спишется со склада.</span></div>' +
                    '<div class="form-error" data-work-fact-error></div>' +
                    '<button class="primary" type="submit">Записать выполненный объём</button>' +
                '</form>' +
            '</div>' +
        '</details>';
    }

    function normSetup(payload) {
        if (!payload.canManageNorms) return '';
        var rows = (payload.norms || []).map(function (norm) {
            return '<tr><td><b>' + escapeHtml(norm.workTitle) + '</b><small>' + escapeHtml(norm.workUnit) + '</small></td>' +
                '<td><b>' + escapeHtml(norm.materialTitle) + '</b><small>' + escapeHtml(norm.materialUnit) + '</small></td>' +
                '<td>' + escapeHtml(quantity(norm.qtyPerWorkUnit)) + '</td><td>' + escapeHtml(quantity(norm.wastePercent)) + '%</td>' +
                '<td><span class="badge ' + (norm.isActive ? 'success' : '') + '">' + (norm.isActive ? 'Активна' : 'Отключена') + '</span></td></tr>';
        }).join('');
        return '<details class="warehouse-control-section warehouse-control-norms">' +
            '<summary><i data-lucide="settings-2"></i><span><b>Настроить автосписание</b><small>Необязательно · только для Директора и Админа</small></span><i data-lucide="chevron-down"></i></summary>' +
            '<div class="warehouse-control-section-body">' +
                '<p class="warehouse-control-help">Укажи, сколько материала обычно уходит на одну единицу работы. После этого Прораб сможет внести выполненный объём, а материал спишется автоматически.</p>' +
                '<form class="warehouse-control-form" data-work-material-norm-form>' +
                    '<div class="warehouse-control-form-grid">' +
                        '<label><span>Для какой работы</span><select name="work_item_id" required>' + optionRows(payload.works, 'Выбери работу') + '</select></label>' +
                        '<label><span>Какой материал списывать</span><select name="material_item_id" required>' + optionRows(payload.materials, 'Выбери материал') + '</select></label>' +
                        '<label><span>Количество на 1 единицу работы</span><input name="qty_per_work_unit" type="number" min="0.000001" step="0.000001" value="1" required></label>' +
                        '<label><span>Запас на отходы, %</span><input name="waste_percent" type="number" min="0" max="100" step="0.01" value="0"></label>' +
                    '</div>' +
                    '<label class="check-inline"><input name="is_active" type="checkbox" checked> Использовать это правило</label>' +
                    '<div class="form-error" data-work-material-norm-error></div>' +
                    '<button class="primary compact" type="submit">Сохранить правило</button>' +
                '</form>' +
                (rows ? '<div class="table-scroll"><table class="warehouse-control-norm-table"><thead><tr><th>Работа</th><th>Материал</th><th>На 1 ед.</th><th>Отходы</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
            '</div>' +
        '</details>';
    }

    function materialState(item) {
        var balance = Number(item.stockBalanceQty || 0);
        var planned = Number(item.plannedQty || 0);
        var received = Number(item.receivedQty || 0);
        var spent = Number(item.factUsedQty || 0) + Number(item.manualUsedQty || 0);
        if (Number(item.unaccountedQty || 0) > 0) return ['Расход больше прихода', 'danger', 'risk'];
        if (planned > 0 && spent >= planned && balance <= 0) return ['Всё использовано', 'complete', 'complete'];
        if (!item.hasReceipt && Number(item.purchasedQty || 0) > 0) return ['Куплено · ждём', 'warn', 'shortage'];
        if (planned > received) return ['Нужно привезти', 'warn', 'shortage'];
        if (balance <= 0) return ['Нет на объекте', 'neutral', 'empty'];
        return ['Есть на объекте', 'success', 'available'];
    }

    function progressLine(label, value, planned, unit, tone) {
        var percent = progress(value, planned);
        return '<div class="warehouse-material-progress is-' + escapeHtml(tone) + '">' +
            '<div><span>' + escapeHtml(label) + '</span><b>' + escapeHtml(quantity(value)) + ' из ' + escapeHtml(quantity(planned)) + ' ' + escapeHtml(unit || '') + '</b></div>' +
            '<span class="warehouse-material-progress-track"><i style="--warehouse-progress:' + percent + '%"></i></span>' +
        '</div>';
    }

    function inventorySummary(payload) {
        var summary = payload.summary || {};
        return '<div class="warehouse-control-metrics" aria-label="Сводка по складу">' +
            metric('Материалов по смете', String(summary.materialsCount || (payload.materials || []).length), '') +
            metric('Привезено полностью', String(summary.fullyReceivedMaterials || 0), 'success') +
            metric('Нужно довезти', String(summary.needReceiptMaterials || 0), Number(summary.needReceiptMaterials || 0) ? 'warn' : '') +
            metric('Ошибки учёта', String(summary.riskMaterials || 0), Number(summary.riskMaterials || 0) ? 'danger' : '') +
        '</div>';
    }

    function materialsTable(payload) {
        if (!(payload.materials || []).length) return '<section class="warehouse-control-card"><div class="warehouse-control-empty"><i data-lucide="package-open"></i><b>Материалов пока нет</b><span>Они появятся здесь после добавления в смету объекта.</span></div></section>';
        return '<section class="warehouse-control-card warehouse-control-stock-card">' +
            '<div class="warehouse-control-card-head warehouse-control-inventory-head"><div><span class="section-label">Учёт по позициям</span><h3>Материалы на объекте</h3><p>В каждой карточке видно: сколько нужно, куплено, привезено, потрачено и осталось.</p></div><span class="warehouse-control-visible-count" data-warehouse-visible-count>' + escapeHtml(payload.materials.length) + ' позиций</span></div>' +
            '<div class="warehouse-control-tools">' +
                '<label class="warehouse-control-search"><i data-lucide="search"></i><input type="search" data-warehouse-material-filter placeholder="Найти материал по названию или разделу"></label>' +
                '<div class="warehouse-control-filter-chips" data-warehouse-filter-chips>' +
                    '<button class="is-active" type="button" data-warehouse-stock-filter="all">Все</button>' +
                    '<button type="button" data-warehouse-stock-filter="shortage">Нужно довезти</button>' +
                    '<button type="button" data-warehouse-stock-filter="available">В наличии</button>' +
                    '<button type="button" data-warehouse-stock-filter="complete">Использовано</button>' +
                    '<button type="button" data-warehouse-stock-filter="risk">Ошибки</button>' +
                '</div>' +
            '</div>' +
            '<div class="warehouse-material-grid" data-warehouse-material-grid>' + payload.materials.map(function (item, index) {
                var stateLabel = materialState(item);
                var planned = Number(item.plannedQty || 0);
                var spent = Number(item.factUsedQty || 0) + Number(item.manualUsedQty || 0);
                var searchText = (item.title + ' ' + (item.sectionTitle || '') + ' ' + (item.unit || '')).toLocaleLowerCase('ru-RU');
                return '<article class="warehouse-material-card is-' + stateLabel[2] + '" tabindex="0" role="button" data-select-material="' + escapeHtml(item.id) + '" data-stock-state="' + escapeHtml(stateLabel[2]) + '" data-search-text="' + escapeHtml(searchText) + '" style="--warehouse-card-delay:' + Math.min(index * 35, 280) + 'ms">' +
                    '<header><div><small>' + escapeHtml(item.sectionTitle || 'Материал') + '</small><h4>' + escapeHtml(item.title) + '</h4></div><span class="badge ' + stateLabel[1] + '">' + escapeHtml(stateLabel[0]) + '</span></header>' +
                    '<div class="warehouse-material-need"><span>Нужно по смете</span><strong>' + escapeHtml(quantity(planned)) + ' <small>' + escapeHtml(item.unit || '') + '</small></strong></div>' +
                    '<div class="warehouse-material-flow">' +
                        progressLine('Куплено', item.purchasedQty, planned, item.unit, 'purchase') +
                        progressLine('Привезено', item.receivedQty, planned, item.unit, 'receipt') +
                        progressLine('Потрачено', spent, planned, item.unit, 'use') +
                    '</div>' +
                    '<footer><div><span>Осталось на объекте</span><strong class="' + (Number(item.stockBalanceQty || 0) < 0 ? 'is-negative' : '') + '">' + escapeHtml(quantity(item.stockBalanceQty)) + ' ' + escapeHtml(item.unit || '') + '</strong></div>' +
                        '<div class="warehouse-material-actions">' +
                            '<button type="button" data-material-move="receipt" data-material-id="' + escapeHtml(item.id) + '"><i data-lucide="plus"></i> Приход</button>' +
                            '<button type="button" data-material-move="use" data-material-id="' + escapeHtml(item.id) + '"' + (Number(item.stockBalanceQty || 0) <= 0 ? ' disabled' : '') + '><i data-lucide="minus"></i> Расход</button>' +
                        '</div></footer>' +
                '</article>';
            }).join('') + '</div>' +
            '<div class="warehouse-control-no-results" data-warehouse-no-results hidden><i data-lucide="search-x"></i><b>Ничего не найдено</b><span>Попробуйте изменить запрос или фильтр.</span></div>' +
        '</section>';
    }

    function movementMeta(move) {
        if (move.sourceType === 'work_fact_reversal' || Number(move.qty || 0) < 0) return ['Возврат расхода', 'undo-2', 'success'];
        if (move.moveType === 'purchase') return ['Покупка', 'shopping-cart', 'purchase'];
        if (move.moveType === 'receipt') return ['Приход', 'package-check', 'success'];
        if (move.moveType === 'writeoff') return ['Списание', 'archive-x', 'warn'];
        return [move.sourceType === 'work_fact' ? 'Расход по работе' : 'Расход', 'package-minus', 'use'];
    }

    function movementHistory(payload) {
        var movements = payload.movements || [];
        return '<details class="warehouse-control-section warehouse-control-movement-history">' +
            '<summary><i data-lucide="list-tree"></i><span><b>Все операции по складу</b><small>' + escapeHtml(movements.length ? movements.length + ' последних записей' : 'Операций пока нет') + '</small></span><i data-lucide="chevron-down"></i></summary>' +
            '<div class="warehouse-control-section-body">' +
            (!movements.length ? '<div class="warehouse-control-empty"><span>Покупки, приходы и расходы появятся здесь.</span></div>' : '<div class="warehouse-movement-list">' + movements.map(function (move) {
                var meta = movementMeta(move);
                return '<article class="warehouse-movement-item is-' + meta[2] + '"><span class="warehouse-movement-icon"><i data-lucide="' + meta[1] + '"></i></span><div><header><span class="badge ' + meta[2] + '">' + meta[0] + '</span><b>' + escapeHtml(move.materialTitle) + '</b></header><p><strong>' + escapeHtml(quantity(Math.abs(Number(move.qty || 0)))) + ' ' + escapeHtml(move.materialUnit || '') + '</strong>' + (move.comment ? ' · ' + escapeHtml(move.comment) : '') + '</p><small>' + escapeHtml(dateTime(move.createdAt)) + (move.createdByName ? ' · ' + escapeHtml(move.createdByName) : '') + '</small></div></article>';
            }).join('') + '</div>') + '</div></details>';
    }

    function factsHistory(payload) {
        var facts = payload.facts || [];
        return '<details class="warehouse-control-section warehouse-control-history">' +
            '<summary><i data-lucide="history"></i><span><b>История выполненных работ</b><small>' + escapeHtml(facts.length ? facts.length + ' записей' : 'Записей пока нет') + '</small></span><i data-lucide="chevron-down"></i></summary>' +
            '<div class="warehouse-control-section-body">' +
            (!facts.length ? '<div class="warehouse-control-empty"><span>Здесь появятся внесённые работы и отмены.</span></div>' : '<div class="warehouse-control-facts">' + facts.map(function (fact) {
                var reversal = fact.entryKind === 'reversal';
                var materialText = (fact.materials || []).map(function (line) {
                    return line.materialTitle + ': ' + quantity(Math.abs(Number(line.expectedQty || 0))) + ' ' + line.materialUnit;
                }).join(' · ');
                var reverseButton = !reversal && !fact.isReversed && payload.canReverseFacts
                    ? '<button class="ghost compact" type="button" data-reverse-work-fact="' + escapeHtml(fact.id) + '">Отменить запись</button>'
                    : '';
                return '<article class="warehouse-control-fact' + (reversal ? ' is-reversal' : '') + (fact.isReversed ? ' is-reversed' : '') + '">' +
                    '<div><span class="badge ' + (reversal || fact.isReversed ? 'warn' : 'success') + '">' + (reversal ? 'Отмена' : (fact.isReversed ? 'Отменено' : 'Выполнено')) + '</span><b>' + escapeHtml(fact.workTitle) + '</b><span>' + escapeHtml(fact.reportDate) + ' · ' + escapeHtml(quantity(fact.quantity)) + ' ' + escapeHtml(fact.workUnit) + '</span></div>' +
                    '<small>' + escapeHtml(materialText || 'Без списания материалов') + '</small>' +
                    (fact.comment ? '<p>' + escapeHtml(fact.comment) + '</p>' : '') +
                    '<footer><span>' + escapeHtml(fact.createdByName || '') + '</span>' + reverseButton + '</footer>' +
                '</article>';
            }).join('') + '</div>') + '</div></details>';
    }

    function render(payload) {
        return '<section class="warehouse-control-workspace">' +
            '<div class="warehouse-control-head"><div><span class="section-label">Склад объекта</span><h3>Всё нужное, купленное и потраченное</h3><p>Понятный путь каждого материала: нужно → купили → привезли → использовали. Остатки пересчитываются автоматически.</p></div><button class="ghost compact" type="button" data-warehouse-control-refresh aria-label="Обновить склад"><i data-lucide="refresh-cw"></i> Обновить</button></div>' +
            inventorySummary(payload) +
            '<div class="warehouse-control-main">' + stockMovementForm(payload) + materialsTable(payload) + '</div>' +
            '<div class="warehouse-control-secondary"><div class="warehouse-control-secondary-title"><span>Дополнительно</span><small>Открывай только когда нужно</small></div>' +
                movementHistory(payload) + factForm(payload) + normSetup(payload) + factsHistory(payload) +
            '</div>' +
        '</section>';
    }

    function syncProjectMaterials(projectId, payload) {
        var current = state.materialsByProject && state.materialsByProject[projectId];
        if (!Array.isArray(current)) return;
        var controls = {};
        (payload.materials || []).forEach(function (item) { controls[Number(item.id)] = item; });
        state.materialsByProject[projectId] = current.map(function (item) {
            var control = controls[Number(item.id)];
            if (!control) return item;
            return Object.assign({}, item, {
                usedQty: Number(control.factUsedQty || 0) + Number(control.manualUsedQty || 0) - Number(control.writeoffQty || 0),
                writeoffQty: Number(control.writeoffQty || 0),
                stockQty: Number(control.stockQty || 0),
                stockBalanceQty: Number(control.stockBalanceQty || 0),
                unaccountedQty: Number(control.unaccountedQty || 0),
                receivedQty: Number(control.receivedQty || 0),
                purchasedQty: Number(control.purchasedQty || 0)
            });
        });
    }

    function activeNormsForWork(payload, workId) {
        return (payload.norms || []).filter(function (norm) {
            return norm.isActive && Number(norm.workItemId) === Number(workId);
        });
    }

    function refreshFactPreview(form, payload) {
        var root = qs('[data-work-fact-preview]', form);
        if (!root) return;
        var workId = Number(form.elements.work_item_id.value || 0);
        var qty = Number(form.elements.quantity.value || 0);
        var norms = activeNormsForWork(payload, workId);
        if (!workId || !(qty > 0)) {
            root.innerHTML = '<span>Выбери работу и объём — покажем, что спишется со склада.</span>';
            return;
        }
        if (!norms.length) {
            root.innerHTML = '<span class="is-risk">Для этой работы ещё не настроено автосписание. Попроси Директора или Админа добавить правило ниже.</span>';
            return;
        }
        root.innerHTML = '<b>Со склада спишется:</b>' + norms.map(function (norm) {
            var expected = qty * Number(norm.qtyPerWorkUnit || 0) * (1 + Number(norm.wastePercent || 0) / 100);
            return '<span>' + escapeHtml(norm.materialTitle) + ' — ' + escapeHtml(quantity(expected)) + ' ' + escapeHtml(norm.materialUnit) + (Number(norm.wastePercent || 0) ? ' (включая ' + escapeHtml(quantity(norm.wastePercent)) + '%)' : '') + '</span>';
        }).join('');
    }

    function applyPayload(projectId, payload) {
        cache[projectId] = payload;
        syncProjectMaterials(projectId, payload);
        var panel = qs('[data-panel="warehouse-control"]');
        if (!panel || !state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        safeReplaceChildren(panel, render(payload));
        bindPanel(panel, projectId, payload);
        refreshLucideIcons(panel);
    }

    function bindPanel(panel, projectId, payload) {
        var refresh = qs('[data-warehouse-control-refresh]', panel);
        if (refresh) refresh.onclick = function () { load(projectId, true); };

        var stockForm = qs('[data-stock-move-form]', panel);
        if (stockForm) {
            var stockSubmit = qs('[data-stock-move-submit]', stockForm);
            var stockSubmitLabel = stockSubmit ? qs('span', stockSubmit) : null;
            var pickerInput = qs('[data-stock-material-search]', stockForm);
            var pickerSuggestions = qs('[data-stock-material-suggestions]', stockForm);
            var pickerClear = qs('[data-stock-material-clear]', stockForm);
            var selectionSummary = qs('[data-stock-selection-summary]', stockForm);
            var fillRemaining = qs('[data-stock-fill-remaining]', stockForm);
            var quantityUnit = qs('[data-stock-qty-unit]', stockForm);
            var operationPreview = qs('[data-stock-move-preview]', stockForm);
            var materials = payload.materials || [];

            function selectedMaterial() {
                var selectedId = Number(stockForm.elements.estimate_item_id.value || 0);
                return materials.find(function (item) { return Number(item.id) === selectedId; }) || null;
            }

            function operationSuggestion(item, kind) {
                var planned = Number(item.plannedQty || 0);
                if (kind === 'purchase') return Math.max(planned - Number(item.purchasedQty || 0), 0);
                if (kind === 'receipt') return Math.max(Math.max(planned, Number(item.purchasedQty || 0)) - Number(item.receivedQty || 0), 0);
                return Math.max(Number(item.stockBalanceQty || 0), 0);
            }

            function refreshSelection() {
                var item = selectedMaterial();
                var kind = stockForm.elements.move_type.value;
                var qty = Number(stockForm.elements.qty.value || 0);
                if (!item) {
                    if (selectionSummary) selectionSummary.innerHTML = '<i data-lucide="mouse-pointer-click"></i><span>Выберите материал — здесь сразу появятся план, приход, расход и остаток.</span>';
                    if (quantityUnit) quantityUnit.textContent = 'ед.';
                    if (fillRemaining) fillRemaining.hidden = true;
                    if (operationPreview) operationPreview.textContent = 'Введите количество — покажем результат до сохранения.';
                    refreshLucideIcons(selectionSummary || stockForm);
                    return;
                }
                var spent = Number(item.factUsedQty || 0) + Number(item.manualUsedQty || 0);
                var balance = Number(item.stockBalanceQty || 0);
                if (selectionSummary) selectionSummary.innerHTML = '<div><span>Нужно</span><b>' + escapeHtml(quantity(item.plannedQty)) + ' ' + escapeHtml(item.unit || '') + '</b></div><div><span>Куплено</span><b>' + escapeHtml(quantity(item.purchasedQty)) + ' ' + escapeHtml(item.unit || '') + '</b></div><div><span>Привезено</span><b>' + escapeHtml(quantity(item.receivedQty)) + ' ' + escapeHtml(item.unit || '') + '</b></div><div><span>Потрачено</span><b>' + escapeHtml(quantity(spent)) + ' ' + escapeHtml(item.unit || '') + '</b></div><div class="is-balance"><span>Остаток</span><b>' + escapeHtml(quantity(balance)) + ' ' + escapeHtml(item.unit || '') + '</b></div>';
                if (quantityUnit) quantityUnit.textContent = item.unit || 'ед.';
                var suggestion = operationSuggestion(item, kind);
                if (fillRemaining) {
                    fillRemaining.hidden = !(suggestion > 0);
                    fillRemaining.textContent = kind === 'purchase' ? 'Купить недостающее: ' + quantity(suggestion) : (kind === 'receipt' ? 'Привезти остаток: ' + quantity(suggestion) : 'Списать весь остаток: ' + quantity(suggestion));
                    fillRemaining.setAttribute('data-fill-value', String(suggestion));
                }
                if (operationPreview) {
                    if (!(qty > 0)) {
                        operationPreview.textContent = 'Введите количество — покажем результат до сохранения.';
                    } else if (kind === 'purchase') {
                        operationPreview.innerHTML = 'После записи будет куплено: <b>' + escapeHtml(quantity(Number(item.purchasedQty || 0) + qty)) + ' ' + escapeHtml(item.unit || '') + '</b>. Физический остаток не изменится до прихода.';
                    } else if (kind === 'receipt') {
                        operationPreview.innerHTML = 'После прихода на объекте останется: <b>' + escapeHtml(quantity(balance + qty)) + ' ' + escapeHtml(item.unit || '') + '</b>.';
                    } else {
                        operationPreview.innerHTML = 'После расхода на объекте останется: <b class="' + (balance - qty < 0 ? 'is-risk' : '') + '">' + escapeHtml(quantity(balance - qty)) + ' ' + escapeHtml(item.unit || '') + '</b>.' + (balance - qty < 0 ? ' Проверьте количество: расход станет больше прихода.' : '');
                    }
                }
            }

            function renderPickerSuggestions(query) {
                if (!pickerSuggestions) return;
                var normalized = String(query || '').trim().toLocaleLowerCase('ru-RU');
                var matches = materials.filter(function (item) {
                    return !normalized || (item.title + ' ' + (item.sectionTitle || '')).toLocaleLowerCase('ru-RU').indexOf(normalized) !== -1;
                }).slice(0, 10);
                pickerSuggestions.innerHTML = matches.length ? matches.map(function (item) {
                    return '<button type="button" data-stock-suggestion="' + escapeHtml(item.id) + '"><span><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.sectionTitle || 'Материал') + '</small></span><em>' + escapeHtml(quantity(item.stockBalanceQty)) + ' ' + escapeHtml(item.unit || '') + ' на объекте</em></button>';
                }).join('') : '<div class="warehouse-control-suggestion-empty">Материал не найден</div>';
                pickerSuggestions.hidden = false;
                if (pickerInput) pickerInput.setAttribute('aria-expanded', 'true');
                qsa('[data-stock-suggestion]', pickerSuggestions).forEach(function (button) {
                    button.onclick = function () { chooseMaterial(button.getAttribute('data-stock-suggestion'), null, true); };
                });
            }

            function chooseMaterial(materialId, kind, focusQuantity) {
                var item = materials.find(function (candidate) { return Number(candidate.id) === Number(materialId); });
                if (!item) return;
                stockForm.elements.estimate_item_id.value = String(item.id);
                if (pickerInput) pickerInput.value = item.title;
                if (pickerClear) pickerClear.hidden = false;
                if (pickerSuggestions) pickerSuggestions.hidden = true;
                if (pickerInput) pickerInput.setAttribute('aria-expanded', 'false');
                if (kind) {
                    var radio = qs('input[name="move_type"][value="' + kind + '"]', stockForm);
                    if (radio) radio.checked = true;
                }
                syncStockMoveKind();
                if (focusQuantity) {
                    stockForm.elements.qty.focus({ preventScroll: true });
                    if (window.innerWidth < 980) qs('[data-warehouse-move-card]', panel).scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            function syncStockMoveKind() {
                var kind = stockForm.elements.move_type.value;
                stockForm.setAttribute('data-move-kind', kind);
                stockForm.classList.toggle('is-use', kind === 'use');
                if (stockSubmitLabel) stockSubmitLabel.textContent = kind === 'purchase' ? 'Записать покупку' : (kind === 'receipt' ? 'Добавить приход' : 'Списать материал');
                refreshSelection();
            }
            qsa('input[name="move_type"]', stockForm).forEach(function (input) {
                input.addEventListener('change', syncStockMoveKind);
            });
            if (pickerInput) {
                pickerInput.addEventListener('focus', function () { renderPickerSuggestions(pickerInput.value); });
                pickerInput.addEventListener('input', function () {
                    stockForm.elements.estimate_item_id.value = '';
                    if (pickerClear) pickerClear.hidden = !pickerInput.value;
                    renderPickerSuggestions(pickerInput.value);
                    refreshSelection();
                });
                pickerInput.addEventListener('keydown', function (event) {
                    if (event.key !== 'Enter' || !pickerSuggestions || pickerSuggestions.hidden) return;
                    var first = qs('[data-stock-suggestion]', pickerSuggestions);
                    if (!first) return;
                    event.preventDefault();
                    chooseMaterial(first.getAttribute('data-stock-suggestion'), null, true);
                });
                pickerInput.addEventListener('blur', function () {
                    window.setTimeout(function () {
                        if (pickerSuggestions) pickerSuggestions.hidden = true;
                        pickerInput.setAttribute('aria-expanded', 'false');
                    }, 140);
                });
            }
            if (pickerClear) pickerClear.onclick = function () {
                stockForm.elements.estimate_item_id.value = '';
                pickerInput.value = '';
                pickerClear.hidden = true;
                refreshSelection();
                pickerInput.focus();
            };
            stockForm.elements.qty.addEventListener('input', refreshSelection);
            if (fillRemaining) fillRemaining.onclick = function () {
                stockForm.elements.qty.value = fillRemaining.getAttribute('data-fill-value') || '';
                refreshSelection();
                stockForm.elements.qty.focus();
            };
            syncStockMoveKind();

            var inventorySearch = qs('[data-warehouse-material-filter]', panel);
            var activeInventoryFilter = 'all';
            function filterInventory() {
                var query = inventorySearch ? inventorySearch.value.trim().toLocaleLowerCase('ru-RU') : '';
                var visible = 0;
                qsa('[data-select-material]', panel).forEach(function (card) {
                    var matchesText = !query || String(card.getAttribute('data-search-text') || '').indexOf(query) !== -1;
                    var matchesState = activeInventoryFilter === 'all' || card.getAttribute('data-stock-state') === activeInventoryFilter;
                    card.hidden = !(matchesText && matchesState);
                    if (!card.hidden) visible += 1;
                });
                var visibleCount = qs('[data-warehouse-visible-count]', panel);
                if (visibleCount) visibleCount.textContent = visible + ' из ' + materials.length + ' позиций';
                var empty = qs('[data-warehouse-no-results]', panel);
                if (empty) empty.hidden = visible !== 0;
            }
            if (inventorySearch) inventorySearch.addEventListener('input', filterInventory);
            qsa('[data-warehouse-stock-filter]', panel).forEach(function (button) {
                button.onclick = function () {
                    activeInventoryFilter = button.getAttribute('data-warehouse-stock-filter') || 'all';
                    qsa('[data-warehouse-stock-filter]', panel).forEach(function (candidate) { candidate.classList.toggle('is-active', candidate === button); });
                    filterInventory();
                };
            });
            qsa('[data-select-material]', panel).forEach(function (card) {
                card.addEventListener('click', function (event) {
                    if (event.target.closest('[data-material-move]')) return;
                    chooseMaterial(card.getAttribute('data-select-material'), null, true);
                });
                card.addEventListener('keydown', function (event) {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    chooseMaterial(card.getAttribute('data-select-material'), null, true);
                });
            });
            qsa('[data-material-move]', panel).forEach(function (button) {
                button.onclick = function (event) {
                    event.stopPropagation();
                    chooseMaterial(button.getAttribute('data-material-id'), button.getAttribute('data-material-move'), true);
                };
            });

            stockForm.onsubmit = function (event) {
                event.preventDefault();
                var errorNode = qs('[data-stock-move-error]', stockForm);
                if (errorNode) errorNode.classList.remove('active');
                var moveType = stockForm.elements.move_type.value;
                if (!Number(stockForm.elements.estimate_item_id.value || 0)) {
                    if (errorNode) {
                        errorNode.textContent = 'Выберите материал из списка.';
                        errorNode.classList.add('active');
                    }
                    if (pickerInput) pickerInput.focus();
                    return;
                }
                api('/api/projects/' + projectId + '/stock-moves', {
                    method: 'POST',
                    body: JSON.stringify({
                        estimate_item_id: Number(stockForm.elements.estimate_item_id.value),
                        move_type: moveType,
                        qty: Number(stockForm.elements.qty.value),
                        price: 0,
                        comment: stockForm.elements.comment.value.trim()
                    }),
                    loaderText: moveType === 'purchase' ? 'Записываем покупку...' : (moveType === 'receipt' ? 'Добавляем материал на объект...' : 'Списываем материал...')
                }).then(function () {
                    showAppNotice(moveType === 'purchase' ? 'Покупка записана.' : (moveType === 'receipt' ? 'Приход добавлен. Остаток обновлён.' : 'Материал списан. Остаток обновлён.'), 'success');
                    return load(projectId, true);
                }).catch(function (error) {
                    if (errorNode) {
                        errorNode.textContent = errorText(error, 'Не удалось сохранить движение материала.');
                        errorNode.classList.add('active');
                    }
                });
            };
        }

        var normForm = qs('[data-work-material-norm-form]', panel);
        if (normForm) normForm.onsubmit = function (event) {
            event.preventDefault();
            var errorNode = qs('[data-work-material-norm-error]', normForm);
            if (errorNode) errorNode.classList.remove('active');
            api('/api/projects/' + projectId + '/warehouse-control/norms', {
                method: 'POST',
                body: JSON.stringify({
                    workItemId: Number(normForm.elements.work_item_id.value),
                    materialItemId: Number(normForm.elements.material_item_id.value),
                    qtyPerWorkUnit: Number(normForm.elements.qty_per_work_unit.value),
                    wastePercent: Number(normForm.elements.waste_percent.value || 0),
                    isActive: !!normForm.elements.is_active.checked
                }),
                    loaderText: 'Сохраняем правило автосписания...'
                }).then(function (next) {
                    applyPayload(projectId, next);
                    showAppNotice('Правило автосписания сохранено.', 'success');
                }).catch(function (error) {
                    if (errorNode) {
                        errorNode.textContent = errorText(error, 'Не удалось сохранить правило.');
                    errorNode.classList.add('active');
                }
            });
        };

        var factFormNode = qs('[data-work-fact-form]', panel);
        if (factFormNode) {
            factFormNode.elements.work_item_id.addEventListener('change', function () { refreshFactPreview(factFormNode, payload); });
            factFormNode.elements.quantity.addEventListener('input', function () { refreshFactPreview(factFormNode, payload); });
            factFormNode.onsubmit = function (event) {
                event.preventDefault();
                var errorNode = qs('[data-work-fact-error]', factFormNode);
                if (errorNode) errorNode.classList.remove('active');
                api('/api/projects/' + projectId + '/warehouse-control/facts', {
                    method: 'POST',
                    body: JSON.stringify({
                        workItemId: Number(factFormNode.elements.work_item_id.value),
                        reportDate: factFormNode.elements.report_date.value,
                        quantity: Number(factFormNode.elements.quantity.value),
                        comment: factFormNode.elements.comment.value.trim(),
                        idempotencyKey: requestKey('work-fact')
                    }),
                    loaderText: 'Записываем выполненный объём...'
                }).then(function (next) {
                    applyPayload(projectId, next);
                    showAppNotice('Работа записана, склад обновлён.', 'success');
                }).catch(function (error) {
                    if (errorNode) {
                        errorNode.textContent = errorText(error, 'Не удалось сохранить факт.');
                        errorNode.classList.add('active');
                    }
                });
            };
        }

        qsa('[data-reverse-work-fact]', panel).forEach(function (button) {
            button.onclick = function () {
                var reason = window.prompt('Почему нужно отменить эту запись?', 'Ошибка ввода');
                if (reason === null) return;
                reason = reason.trim();
                if (!reason) {
                    showAppNotice('Укажи причину отмены.', 'error');
                    return;
                }
                var factId = Number(button.getAttribute('data-reverse-work-fact') || 0);
                api('/api/projects/' + projectId + '/warehouse-control/facts/' + factId + '/reverse', {
                    method: 'POST',
                    body: JSON.stringify({ reason: reason, idempotencyKey: requestKey('work-fact-reversal') }),
                    loaderText: 'Отменяем запись...'
                }).then(function (next) {
                    applyPayload(projectId, next);
                    showAppNotice('Запись отменена, остатки восстановлены.', 'success');
                }).catch(function (error) {
                    showAppNotice(errorText(error, 'Не удалось отменить запись.'), 'error');
                });
            };
        });
    }

    function load(projectId, force) {
        projectId = Number(projectId || 0);
        var panel = qs('[data-panel="warehouse-control"]');
        if (!projectId || !panel) return Promise.resolve(null);
        if (!force && cache[projectId]) {
            applyPayload(projectId, cache[projectId]);
            return Promise.resolve(cache[projectId]);
        }
        if (loading[projectId]) return loading[projectId];
        showSkeleton(panel, 'table', 1);
        loading[projectId] = api('/api/projects/' + projectId + '/warehouse-control', {
            silentLoader: true,
            requestGroup: 'warehouse-control-' + projectId
        }).then(function (payload) {
            applyPayload(projectId, payload);
            return payload;
        }).catch(function (error) {
            safeReplaceChildren(panel, '<div class="warehouse-control-empty is-error"><i data-lucide="triangle-alert"></i><b>Склад недоступен</b><span>' + escapeHtml(errorText(error, 'Не удалось загрузить данные.')) + '</span></div>');
            refreshLucideIcons(panel);
            throw error;
        }).finally(function () {
            delete loading[projectId];
        });
        return loading[projectId];
    }

    function loadSelectedProject(force) {
        return state.selectedProject ? load(state.selectedProject.id, force) : Promise.resolve(null);
    }

    function focusMaterial(materialId, projectId) {
        projectId = Number(projectId || (state.selectedProject && state.selectedProject.id) || 0);
        if (!projectId || !state.selectedProject || Number(state.selectedProject.id) !== projectId) return false;
        var panel = qs('[data-panel="warehouse-control"]');
        var card = panel && qs('[data-select-material="' + String(Number(materialId || 0)) + '"]', panel);
        if (!card) return false;
        var search = qs('[data-warehouse-material-filter]', panel);
        if (search) search.value = '';
        qsa('[data-warehouse-stock-filter]', panel).forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-warehouse-stock-filter') === 'all');
        });
        qsa('[data-select-material]', panel).forEach(function (item) { item.hidden = false; });
        var empty = qs('[data-warehouse-no-results]', panel);
        if (empty) empty.hidden = true;
        var count = qs('[data-warehouse-visible-count]', panel);
        if (count) count.textContent = String(qsa('[data-select-material]', panel).length) + ' позиций';
        card.focus({ preventScroll: true });
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
    }

    module.load = load;
    module.loadSelectedProject = loadSelectedProject;
    module.focusMaterial = focusMaterial;
    module.render = render;
})(window);
