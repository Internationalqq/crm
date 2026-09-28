/* Dictation fills a draft only. The existing report submit owns all writes. */
(function (root) {
    'use strict';
    var numbers = {ноль:0, один:1, одна:1, одну:1, одно:1, два:2, две:2, двое:2, три:3, трое:3, четыре:4, четверо:4, пять:5, пятеро:5, шесть:6, шестеро:6, семь:7, восемь:8, девять:9, десять:10, одиннадцать:11, двенадцать:12, тринадцать:13, четырнадцать:14, пятнадцать:15, шестнадцать:16, семнадцать:17, восемнадцать:18, девятнадцать:19, двадцать:20, тридцать:30, сорок:40, пятьдесят:50, полтора:1.5, полторы:1.5};
    var resources = [
        ['workforce','Электрики','электрик[а-я]*|электромонт[её]р[а-я]*'],
        ['workforce','Сантехники','сантехник[а-я]*'], ['workforce','Монтажники','монтажник[а-я]*'],
        ['workforce','Отделочники','отделочник[а-я]*'], ['workforce','Маляры','маляр(?:ы|а|ов|ом)?'],
        ['workforce','Плиточники','плиточник[а-я]*'], ['workforce','Сварщики','сварщик[а-я]*'],
        ['workforce','Бетонщики','бетонщик[а-я]*'], ['workforce','Каменщики','каменщик[а-я]*'],
        ['workforce','Плотники','плотник[а-я]*'], ['workforce','Разнорабочие','разнорабоч[а-я]*'],
        ['workforce','Рабочие','рабочи(?:й|е|х|ми)|человек(?:а)?|людей'],
        ['equipment','Экскаватор','экскаватор(?:ы|а|ов|ом)?'],
        ['equipment','Манипулятор','манипулятор(?:ы|а|ов|ом)?'],
        ['equipment','Автовышка','автовышк(?:а|и|е|у|ой)'],
        ['equipment','Погрузчик','погрузчик(?:и|а|ов|ом)?'],
        ['equipment','Компрессор','компрессор(?:ы|а|ов|ом)?'],
        ['equipment','Бетононасос','бетононасос(?:ы|а|ов|ом)?'],
        ['equipment','Автокран','автокран(?:ы|а|ов|ом)?'],
        ['equipment','Самосвал','самосвал(?:ы|а|ов|ом)?|камаз(?:ы|а|ов|ом)?']
    ];
    function normalized(value) { return String(value || '').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim(); }
    function numericText(value) {
        return normalized(value).replace(/[а-я]+/g, function (word) { return Object.prototype.hasOwnProperty.call(numbers, word) ? numbers[word] : word; })
            .replace(/\b([2-5]0)\s+([1-9])\b/g, function (_, a, b) { return Number(a) + Number(b); })
            .replace(/(\d+)\s+с половиной/g, '$1,5').replace(/полчаса/g,'0,5 часа')
            .replace(/(\d+)\s*час(?:а|ов)?\s+(\d+)\s*минут(?:ы|у)?/g, function (_, h, m) {
                return Number(m) < 60 ? (Number(h) + Number(m) / 60) + ' часа' : _;
            });
    }
    function parse(text) {
        var result = {workforce:[], equipment:[], warnings:[], covered:[]};
        var clauses = String(text || '').split(/(?<!\d)[,.;\n]|[,.;\n](?!\d)/).map(function (s) { return s.trim(); }).filter(Boolean);
        clauses.forEach(function (source) {
            var value = numericText(source), matches = [];
            // Totals in person-hours are not headcounts or hours per person.
            if (/(?:человеко|машино)[-\s]*час/.test(value)) {
                result.warnings.push('«' + source + '»: укажите количество и часы на одного человека или единицу техники.');
                return;
            }
            resources.forEach(function (resource) {
                var regex = new RegExp('(?<![а-я])(?:' + resource[2] + ')(?![а-я])', 'g'), match;
                while ((match = regex.exec(value))) matches.push({kind:resource[0], label:resource[1], word:match[0], start:match.index, end:regex.lastIndex});
            });
            var professions = matches.some(function (m) { return m.kind === 'workforce' && m.label !== 'Рабочие'; });
            matches = matches.filter(function (m) { return !(professions && m.label === 'Рабочие'); }).sort(function (a,b) { return a.start-b.start; });
            if (!matches.length) return;
            if (/(?:завтра|послезавтра|планиру|будет|будут|нужен|нужны|жд[её]м|ожидаем|не приехал|не работал|не было|отсутств|не выш)/.test(value) || matches.some(function (m) { return /(?:^|\s)без\s+(?:(?:\d+|одного|двух|трех|четырех|пяти|шести|семи|восьми|девяти|десяти)\s+)?$/.test(value.slice(0,m.start)); })) {
                result.warnings.push('Не внесено в смену: «' + source + '». Уточните, что было выполнено.'); return;
            }
            var sharedHours = value.match(/(?:^|\s)по\s+(\d+(?:[.,]\d+)?)\s*час/);
            matches.forEach(function (match, index) {
                var before = value.slice(index ? matches[index-1].end : 0, match.start);
                var after = value.slice(match.end, index+1 < matches.length ? matches[index+1].start : value.length);
                var count = before.match(/(\d+(?:[.,]\d+)?)\s*(?:единиц(?:а|ы)?\s*)?$/);
                if (!count) count = after.match(/^\s*(?::|—|-)?\s*(\d+(?:[.,]\d+)?)\s*(?:чел(?:овек(?:а)?)?|ед(?:иниц(?:а|ы)?)?)(?![а-я])/);
                var countValue = count ? Number(count[1].replace(',','.')) : null;
                if (countValue === null && match.kind === 'equipment' && /(?:тор|чик|сос|кран|свал|камаз|вышка)$/.test(match.word)) countValue = 1;
                var hours = after.match(/(\d+(?:[.,]\d+)?)\s*час(?:а|ов)?(?![а-я])/g) || [];
                var hourValue = hours.length === 1 ? Number(hours[0].match(/\d+(?:[.,]\d+)?/)[0].replace(',','.')) :
                    !hours.length && sharedHours ? Number(sharedHours[1].replace(',','.')) : null;
                if (hours.length > 1 || /(?:человеко|машино)[-\s]*час|(?:с\s+\d+\s+до\s+\d+)|\d+\s*минут/.test(after)) hourValue = null;
                var missing = [];
                if (!Number.isInteger(countValue) || countValue < 1 || countValue > 999) { countValue = ''; missing.push('количество'); }
                if (!(hourValue > 0) || hourValue > 24) { hourValue = ''; missing.push('часы'); }
                result[match.kind].push({label:match.label, count:String(countValue), hours:String(hourValue), names:[], autoText:source, missing:missing});
            });
            // A resource-only sentence need not also appear as an unmatched work.
            if (!/(?:пролож|смонт|установ|постав|привез|сдела|выполн|кабел|бетон|кирпич|закуп|демонт|покрас|штукатур|ремонт)/.test(value)) result.covered.push(source);
        });
        ['workforce','equipment'].forEach(function (kind) {
            var counts = {};
            result[kind].forEach(function (entry) { counts[entry.label] = (counts[entry.label] || 0) + 1; });
            Object.keys(counts).forEach(function (label) { if (counts[label] > 1) result.warnings.push(label + ' упомянуты несколько раз — уточните количество и часы вручную.'); });
            result[kind] = result[kind].filter(function (entry) { return counts[entry.label] === 1; }).slice(0,40);
        });
        return result;
    }
    function merge(existing, proposed) {
        var manual = existing.filter(function (entry) { return !entry.autoText; });
        var preserved = [], added = [];
        proposed.forEach(function (entry) {
            if (manual.some(function (row) { return normalized(row.label) === normalized(entry.label); })) preserved.push(entry.label);
            else if (manual.length + added.length < 40) added.push(entry);
        });
        return {rows:manual.concat(added), added:added, preserved:preserved};
    }
    function element(tag, text, className) {
        var node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function badge(text, warning, neutral) {
        var node = element('span', null, 'report-autofill-badge' + (warning ? ' is-warning' : neutral ? ' is-neutral' : ''));
        var icon = element('i'); icon.setAttribute('data-lucide', warning ? 'triangle-alert' : neutral ? 'minus' : 'circle-check'); icon.setAttribute('aria-hidden','true');
        node.append(icon, document.createTextNode(text)); return node;
    }
    function bind(form, adapter) {
        if (form._reportDictation) return;
        var raw = form.elements.namedItem('raw_input'), summary = form.querySelector('[data-report-autofill-result]');
        if (!raw || !summary) return;
        var running = false, overlay = null, oldInert = false;
        function showProcessing() {
            if (overlay || !form.isConnected) return;
            overlay = element('div', null, 'report-dictation-processing');
            overlay.setAttribute('role','status'); overlay.setAttribute('aria-live','polite');
            var content = element('div');
            content.append(element('strong','Заполняем отчёт'), element('p','Сопоставляем работы, материалы и состав смены…'), element('progress'));
            overlay.append(content); document.body.append(overlay);
            oldInert = form.inert; form.inert = true; form.setAttribute('aria-busy','true');
        }
        function hideProcessing() {
            if (!overlay) return;
            overlay.remove(); overlay = null; form.inert = oldInert; form.removeAttribute('aria-busy');
        }
        function decorate() {
            form.querySelectorAll('[data-report-resource-row]').forEach(function (row) {
                var old = row.querySelector('.report-autofill-row-note'); if (old) old.remove();
                if (!row.dataset.reportDictationSource) return;
                var missing = [];
                ['count','hours'].forEach(function (key) {
                    var field = row.querySelector('[data-report-resource-' + key + ']');
                    if (!field.value) { missing.push(key === 'count' ? 'количество' : 'часы'); field.setAttribute('aria-invalid','true'); }
                    else field.removeAttribute('aria-invalid');
                });
                var note = badge(missing.length ? 'Уточните ' + missing.join(' и ') : 'Подставлено из описания', !!missing.length);
                note.classList.add('report-autofill-row-note'); row.append(note);
            });
        }
        async function process() {
            if (running || !raw.value.trim()) return;
            running = true;
            showProcessing();
            try {
                await new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });
                if (!form.isConnected) return;
                var parsed = parse(raw.value), plans = {}, warnings = parsed.warnings.slice();
                ['workforce','equipment'].forEach(function (kind) {
                    var merged = merge(adapter.read(kind), parsed[kind]);
                    plans[kind] = merged;
                    merged.preserved.forEach(function (label) { warnings.push('«' + label + '» уже заполнено вручную — проверьте совпадение с описанием.'); });
                    merged.added.forEach(function (entry) {
                        if (entry.missing.length) warnings.push('«' + entry.label + '»: ' + (entry.count ? 'подставлено ' + entry.count + (kind === 'workforce' ? ' чел.; ' : ' ед.; ') : '') + 'укажите ' + entry.missing.join(' и ') + '.');
                    });
                });
                ['workforce','equipment'].forEach(function (kind) { adapter.write(kind, plans[kind].rows); });
                var controller = form._reportPreviewDraftController;
                if (controller) controller.refresh();
                var preview = controller && controller.summary ? controller.summary() : {work:0, material:0, unmatched:[]};
                if (preview.ambiguous) warnings.push('Несколько совпадений в смете: ' + preview.ambiguous + '. Выберите нужные позиции ниже.');
                (preview.incomplete || []).forEach(function (title) { warnings.push('«' + title + '»: проверьте объём и доступный остаток в блоке учёта.'); });
                (preview.unmatched || []).forEach(function (clause) {
                    if (!parsed.covered.some(function (covered) { return normalized(covered) === normalized(clause); }) && !warnings.some(function (warning) { return warning.indexOf('«' + clause + '»') !== -1; })) warnings.push('Осталось текстом: «' + clause + '»');
                });
                var liveAssist = form.querySelector('[data-report-live-assist]');
                if (liveAssist && !liveAssist.querySelector('[data-report-manual-row]') && (!liveAssist.querySelector('[data-report-suggestion]') || !warnings.length)) liveAssist.hidden = true;
                summary.replaceChildren(element('strong','Проверьте заполнение'));
                var badges = element('div', null, 'report-autofill-badges');
                badges.append(badge('Работы: ' + preview.work, false, !preview.work), badge('Материалы: ' + preview.material, false, !preview.material));
                ['workforce','equipment'].forEach(function (kind) {
                    var entries = plans[kind].rows, incomplete = entries.some(function (entry) { return !Number(entry.count) || !Number(entry.hours); });
                    var count = entries.reduce(function (sum, e) { return sum + Number(e.count || 0); },0);
                    badges.append(badge((kind === 'workforce' ? 'Люди: ' : 'Техника: ') + (entries.length ? (count || 'уточните') : 'не указаны'), incomplete, !entries.length));
                });
                summary.append(badges);
                if (warnings.length) {
                    var details = element('details'); details.open = true;
                    details.append(element('summary', 'Требует проверки · ' + warnings.length));
                    var list = element('ul'); warnings.slice(0,30).forEach(function (message) { list.append(element('li',message)); }); details.append(list); summary.append(details);
                }
                summary.hidden = false; decorate(); adapter.changed();
            } catch (error) {
                summary.hidden = false; summary.replaceChildren(badge('Разбор не завершён. Текст сохранён — проверьте поля и повторите.',true));
            } finally {
                hideProcessing(); running = false;
                if (root.lucide) root.lucide.createIcons();
                if (form.isConnected && !summary.hidden) {
                    summary.focus({preventScroll:true});
                    var scroller = form.closest('[data-report-modal-scroll]');
                    if (scroller) {
                        var bounds = summary.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
                        var footer = form.querySelector('.report-intake-actions');
                        var bottom = viewport.bottom - (footer ? footer.offsetHeight : 0);
                        if (bounds.bottom > bottom || bounds.top < viewport.top) scroller.scrollTop += bounds.top - viewport.top - 12;
                    }
                }
            }
        }
        form._reportDictation = {process:process, decorate:decorate, wait:showProcessing, cancel:hideProcessing};
        form.addEventListener('pmbi:report-dictation-complete', process);
        form.querySelector('[data-report-autofill]').addEventListener('click', process);
        form.addEventListener('input', function (event) {
            var row = event.target.closest('[data-report-resource-row]');
            if (row) { delete row.dataset.reportDictationSource; event.target.removeAttribute('aria-invalid'); decorate(); summary.hidden = true; }
            if (event.target === raw && !summary.hidden) { summary.hidden = true; }
        });
        form.addEventListener('reset', function () { summary.hidden = true; });
        form.addEventListener('click', function (event) {
            if (event.target.closest('[data-report-resource-add], [data-report-resource-remove], [data-report-repeat-last-shift]')) summary.hidden = true;
        });
    }
    var api = {parse:parse, merge:merge, bind:bind};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else { root.PMBI = root.PMBI || {}; root.PMBI.reportDictation = api; }
})(typeof window === 'undefined' ? globalThis : window);
