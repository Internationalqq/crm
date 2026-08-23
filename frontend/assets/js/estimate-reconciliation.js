(function () {
    'use strict';

    var PMBI = window.PMBI || {};
    if (PMBI.estimateReconciliation && PMBI.estimateReconciliation.__loaded) return;
    var module = PMBI.estimateReconciliation = PMBI.estimateReconciliation || {};
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
    var money = PMBI.money;
    var cache = {};
    var loading = {};

    function errorText(error, fallback) {
        var code = error && error.payload && error.payload.error ? error.payload.error : '';
        var labels = {
            snapshot_items_required: 'В снимке нет позиций. Проверь JSON или текущую смету.',
            bad_snapshot_source_kind: 'Выбери: оригинальная смета или выгрузка ИИ.',
            reconciliation_comment_required: 'Для исправления или принятого отклонения нужен комментарий.',
            estimate_reconciliation_version_changed: 'Появилась новая версия сметы. Сверка обновлена — повтори решение на актуальной строке.',
            reconciliation_row_not_found: 'Строка уже не относится к актуальной паре версий.'
        };
        return labels[code] || code || fallback;
    }

    function snapshotDate(value) {
        if (!value) return 'дата не указана';
        try {
            return new Date(Number(value) * 1000).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        } catch (error) {
            return 'дата не указана';
        }
    }

    function snapshotCard(snapshot, title, emptyText) {
        if (!snapshot) {
            return '<article class="reconciliation-source-card is-empty"><span>' + escapeHtml(title) + '</span><strong>Не зафиксирована</strong><small>' + escapeHtml(emptyText) + '</small></article>';
        }
        return '<article class="reconciliation-source-card">' +
            '<span>' + escapeHtml(title) + '</span>' +
            '<strong>Версия ' + escapeHtml(snapshot.versionNo) + ' · ' + escapeHtml(snapshot.itemCount) + ' поз.</strong>' +
            '<small>' + escapeHtml(snapshot.sourceLabel || 'Без подписи') + ' · ' + escapeHtml(snapshotDate(snapshot.capturedAt)) + '</small>' +
        '</article>';
    }

    function summaryCard(label, value, tone) {
        return '<article class="reconciliation-stat' + (tone ? ' is-' + tone : '') + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></article>';
    }

    function setupPanel(payload) {
        if (!payload.canManageSnapshots) return '';
        var currentDisabled = Number(payload.liveItemCount || 0) < 1 ? ' disabled' : '';
        return '<details class="reconciliation-setup"' + (!payload.ready ? ' open' : '') + '>' +
            '<summary><span><b>Версии для сверки</b><small>Только Директор и Админ создают неизменяемые снимки.</small></span><i data-lucide="chevron-down"></i></summary>' +
            '<div class="reconciliation-current-actions">' +
                '<button class="ghost compact" type="button" data-reconciliation-use-current="original"' + currentDisabled + '>Текущая смета = оригинал</button>' +
                '<button class="ghost compact" type="button" data-reconciliation-use-current="ai"' + currentDisabled + '>Текущие позиции = ИИ-версия</button>' +
            '</div>' +
            '<form class="reconciliation-snapshot-form" data-reconciliation-snapshot-form>' +
                '<div class="reconciliation-form-grid">' +
                    '<label><span>Тип версии</span><select name="source_kind"><option value="original">Оригинальная смета</option><option value="ai">Выгрузка ИИ</option></select></label>' +
                    '<label><span>Подпись версии</span><input name="source_label" maxlength="200" placeholder="Например: Смета заказчика от 21.08"></label>' +
                '</div>' +
                '<label><span>JSON позиций</span><textarea name="json" rows="7" placeholder=\'{"items":[{"title":"Плитка","unit":"м2","plannedQty":100,"plannedPrice":900,"itemKind":"material"}]}\' required></textarea></label>' +
                '<div class="form-error" data-reconciliation-snapshot-error></div>' +
                '<button class="primary compact" type="submit">Создать снимок</button>' +
            '</form>' +
        '</details>';
    }

    function rowStatus(row) {
        var labels = {
            exact: ['Совпадает', 'success'],
            changed: ['Есть расхождения', 'warn'],
            missing_in_ai: ['Нет в ИИ', 'danger'],
            added_by_ai: ['Добавлено ИИ', 'warn'],
            duplicate: ['Дубликат', 'danger']
        };
        return labels[row.status] || ['Нужно проверить', 'warn'];
    }

    function differenceLabel(value) {
        return ({
            title: 'название',
            unit: 'единица',
            quantity: 'объём',
            kind: 'тип позиции',
            section: 'раздел',
            article: 'артикул'
        })[value] || value;
    }

    function estimateItemCell(item, emptyText) {
        if (!item) return '<div class="reconciliation-item is-missing"><b>' + escapeHtml(emptyText) + '</b></div>';
        var meta = [
            item.itemKind === 'work' ? 'Работа' : 'Материал',
            item.sectionTitle || '',
            item.article ? 'арт. ' + item.article : ''
        ].filter(Boolean).join(' · ');
        var price = Object.prototype.hasOwnProperty.call(item, 'plannedPrice')
            ? '<small class="reconciliation-price">Цена: ' + escapeHtml(money(item.plannedPrice || 0)) + '</small>'
            : '';
        return '<div class="reconciliation-item"><b>' + escapeHtml(item.title || 'Без названия') + '</b>' +
            '<span>' + escapeHtml(item.plannedQty) + ' ' + escapeHtml(item.unit || '') + '</span>' +
            (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + price + '</div>';
    }

    function reviewOptions(value) {
        var options = [
            ['confirmed', 'Проверено, совпадает'],
            ['needs_correction', 'Нужно исправить'],
            ['accepted_deviation', 'Отклонение принято']
        ];
        return options.map(function (option) {
            return '<option value="' + option[0] + '"' + (value === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
        }).join('');
    }

    function reviewCell(row, payload) {
        if (!payload.canReview) return '';
        var review = row.review || {};
        return '<form class="reconciliation-review-form" data-reconciliation-review-form data-row-key="' + escapeHtml(row.rowKey) + '">' +
            '<select name="status">' + reviewOptions(review.status || (row.status === 'exact' ? 'confirmed' : 'needs_correction')) + '</select>' +
            '<input name="comment" maxlength="1000" value="' + escapeHtml(review.comment || '') + '" placeholder="Комментарий к решению">' +
            '<button class="ghost compact" type="submit">Сохранить</button>' +
            (review.reviewedByName ? '<small>Последнее решение: ' + escapeHtml(review.reviewedByName) + ' · ' + escapeHtml(snapshotDate(review.reviewedAt)) + '</small>' : '') +
        '</form>';
    }

    function comparisonRow(row, payload) {
        var status = rowStatus(row);
        var differences = (row.differences || []).map(differenceLabel);
        if (row.duplicateOriginal) differences.push('дубликат в оригинале');
        if (row.duplicateAi) differences.push('дубликат в ИИ');
        var priceNote = row.priceChanged
            ? '<span class="reconciliation-difference is-price">цена' + (row.priceDelta == null ? '' : ': ' + (Number(row.priceDelta) > 0 ? '+' : '') + money(row.priceDelta)) + '</span>'
            : '';
        return '<tr class="reconciliation-row is-' + escapeHtml(row.status) + '">' +
            '<td><span class="badge ' + status[1] + '">' + status[0] + '</span></td>' +
            '<td>' + estimateItemCell(row.original, 'Нет в оригинале') + '</td>' +
            '<td>' + estimateItemCell(row.ai, 'Нет в ИИ-выгрузке') + '</td>' +
            '<td><div class="reconciliation-differences">' +
                (differences.length ? differences.map(function (item) { return '<span class="reconciliation-difference">' + escapeHtml(item) + '</span>'; }).join('') : '<span class="muted">По объёму и реквизитам совпадает</span>') +
                priceNote +
            '</div></td>' +
            '<td>' + reviewCell(row, payload) + '</td>' +
        '</tr>';
    }

    function emptyState(payload) {
        var missing = [];
        if (!payload.originalSnapshot) missing.push('оригинальную смету');
        if (!payload.aiSnapshot) missing.push('выгрузку ИИ');
        return '<div class="reconciliation-empty"><i data-lucide="scan-search"></i><b>Сверка ещё не готова</b><span>Нужно зафиксировать ' + escapeHtml(missing.join(' и ')) + '. Импорт AutoBot создаёт ИИ-версию автоматически.</span></div>';
    }

    function render(payload) {
        var summary = payload.summary || {};
        var priceSummary = Object.prototype.hasOwnProperty.call(summary, 'priceChanged')
            ? summaryCard('Ценовых расхождений', summary.priceChanged || 0, Number(summary.priceChanged || 0) ? 'warn' : 'success')
            : '';
        var table = payload.ready
            ? '<div class="table-scroll reconciliation-table-scroll"><table class="reconciliation-table"><thead><tr><th>Статус</th><th>Оригинал</th><th>ИИ-выгрузка</th><th>Расхождения</th><th>Решение</th></tr></thead><tbody>' +
                (payload.rows || []).map(function (row) { return comparisonRow(row, payload); }).join('') +
              '</tbody></table></div>'
            : emptyState(payload);
        return '<section class="reconciliation-workspace">' +
            '<div class="reconciliation-head"><div><span class="section-label">Контроль импорта</span><h3>Оригинальная смета ↔ выгрузка ИИ</h3><p>Прораб сверяет материалы, работы, единицы и объёмы. Цены доступны только Директору и Админу.</p></div><button class="ghost compact" type="button" data-reconciliation-refresh><i data-lucide="refresh-cw"></i> Обновить</button></div>' +
            '<div class="reconciliation-sources">' +
                snapshotCard(payload.originalSnapshot, 'Оригинальная смета', 'Её фиксирует Директор или Админ') +
                '<div class="reconciliation-arrow"><i data-lucide="arrow-left-right"></i></div>' +
                snapshotCard(payload.aiSnapshot, 'Выгрузка ИИ', 'Появится после импорта AutoBot') +
            '</div>' +
            setupPanel(payload) +
            (payload.ready ? '<div class="reconciliation-stats">' +
                summaryCard('Всего строк', summary.totalRows || 0) +
                summaryCard('Без расхождений', summary.exact || 0, 'success') +
                summaryCard('Изменено', summary.changed || 0, Number(summary.changed || 0) ? 'warn' : '') +
                summaryCard('Нет в ИИ', summary.missingInAi || 0, Number(summary.missingInAi || 0) ? 'danger' : '') +
                summaryCard('Добавлено ИИ', summary.addedByAi || 0, Number(summary.addedByAi || 0) ? 'warn' : '') +
                summaryCard('Дубликатов', summary.duplicates || 0, Number(summary.duplicates || 0) ? 'danger' : '') +
                summaryCard('Проверено', (summary.reviewed || 0) + ' / ' + (summary.totalRows || 0)) + priceSummary +
            '</div>' : '') + table +
        '</section>';
    }

    function payloadItems(parsed) {
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
        if (parsed && Array.isArray(parsed.materials)) return parsed.materials;
        return [];
    }

    function applyPayload(projectId, payload) {
        cache[projectId] = payload;
        var panel = qs('[data-panel="estimate-reconciliation"]');
        if (!panel || !state.selectedProject || Number(state.selectedProject.id) !== Number(projectId)) return;
        safeReplaceChildren(panel, render(payload));
        bindPanel(panel, projectId, payload);
        refreshLucideIcons(panel);
    }

    function postSnapshot(projectId, body) {
        return api('/api/projects/' + projectId + '/estimate-reconciliation/snapshots', {
            method: 'POST',
            body: JSON.stringify(body),
            loaderText: 'Фиксируем версию сметы...'
        }).then(function (payload) {
            applyPayload(projectId, payload);
            showAppNotice(payload.created === false ? 'Такая версия уже зафиксирована.' : 'Версия сметы сохранена.', 'success');
        });
    }

    function bindPanel(panel, projectId, payload) {
        var refresh = qs('[data-reconciliation-refresh]', panel);
        if (refresh) refresh.onclick = function () { load(projectId, true); };

        qsa('[data-reconciliation-use-current]', panel).forEach(function (button) {
            button.onclick = function () {
                var sourceKind = button.getAttribute('data-reconciliation-use-current');
                var label = sourceKind === 'original' ? 'Текущая утверждённая смета' : 'Текущая выгрузка ИИ';
                var warning = sourceKind === 'original'
                    ? 'Текущие позиции будут зафиксированы как оригинальная смета. Продолжить?'
                    : 'Текущие позиции будут зафиксированы как ИИ-версия. Продолжить?';
                if (!window.confirm(warning)) return;
                postSnapshot(projectId, { sourceKind: sourceKind, sourceLabel: label, useCurrent: true }).catch(function (error) {
                    showAppNotice(errorText(error, 'Не удалось создать снимок.'), 'error');
                });
            };
        });

        var snapshotForm = qs('[data-reconciliation-snapshot-form]', panel);
        if (snapshotForm) snapshotForm.onsubmit = function (event) {
            event.preventDefault();
            var errorNode = qs('[data-reconciliation-snapshot-error]', snapshotForm);
            if (errorNode) {
                errorNode.textContent = '';
                errorNode.classList.remove('active');
            }
            var parsed;
            try {
                parsed = JSON.parse(snapshotForm.elements.json.value);
            } catch (error) {
                if (errorNode) {
                    errorNode.textContent = 'JSON не читается. Проверь кавычки и запятые.';
                    errorNode.classList.add('active');
                }
                return;
            }
            var items = payloadItems(parsed);
            if (!items.length) {
                if (errorNode) {
                    errorNode.textContent = 'Не найден массив items или materials.';
                    errorNode.classList.add('active');
                }
                return;
            }
            postSnapshot(projectId, {
                sourceKind: snapshotForm.elements.source_kind.value,
                sourceLabel: snapshotForm.elements.source_label.value.trim(),
                items: items
            }).catch(function (error) {
                if (errorNode) {
                    errorNode.textContent = errorText(error, 'Не удалось создать снимок.');
                    errorNode.classList.add('active');
                }
            });
        };

        qsa('[data-reconciliation-review-form]', panel).forEach(function (form) {
            form.onsubmit = function (event) {
                event.preventDefault();
                var original = payload.originalSnapshot || {};
                var aiSnapshot = payload.aiSnapshot || {};
                api('/api/projects/' + projectId + '/estimate-reconciliation/review', {
                    method: 'POST',
                    body: JSON.stringify({
                        originalSnapshotId: original.id,
                        aiSnapshotId: aiSnapshot.id,
                        rowKey: form.getAttribute('data-row-key'),
                        status: form.elements.status.value,
                        comment: form.elements.comment.value.trim()
                    }),
                    loaderText: 'Сохраняем решение...'
                }).then(function (nextPayload) {
                    applyPayload(projectId, nextPayload);
                    showAppNotice('Решение по строке сохранено.', 'success');
                }).catch(function (error) {
                    showAppNotice(errorText(error, 'Не удалось сохранить решение.'), 'error');
                    if (error && error.status === 409) load(projectId, true);
                });
            };
        });
    }

    function load(projectId, force) {
        projectId = Number(projectId || 0);
        var panel = qs('[data-panel="estimate-reconciliation"]');
        if (!projectId || !panel) return Promise.resolve(null);
        if (!force && cache[projectId]) {
            applyPayload(projectId, cache[projectId]);
            return Promise.resolve(cache[projectId]);
        }
        if (loading[projectId]) return loading[projectId];
        showSkeleton(panel, 'table', 1);
        loading[projectId] = api('/api/projects/' + projectId + '/estimate-reconciliation', {
            silentLoader: true,
            requestGroup: 'estimate-reconciliation-' + projectId
        }).then(function (payload) {
            applyPayload(projectId, payload);
            return payload;
        }).catch(function (error) {
            safeReplaceChildren(panel, '<div class="reconciliation-empty is-error"><i data-lucide="triangle-alert"></i><b>Сверка недоступна</b><span>' + escapeHtml(errorText(error, 'Не удалось загрузить данные.')) + '</span></div>');
            refreshLucideIcons(panel);
            throw error;
        }).finally(function () {
            delete loading[projectId];
        });
        return loading[projectId];
    }

    function loadSelectedProject(force) {
        var project = state.selectedProject;
        return project ? load(project.id, force) : Promise.resolve(null);
    }

    module.load = load;
    module.loadSelectedProject = loadSelectedProject;
    module.render = render;
})(window);
