(() => {
  'use strict';
  const root = document.querySelector('[data-tender-economics]');
  if (!root) return;
  const endpoint = '/api/autobot/tenders/' + encodeURIComponent(root.dataset.tenderId) + '/economics';
  const names = {base: 'Базовый', careful: 'Осторожный', optimistic: 'Оптимистичный'};
  const fields = {
    revenue: 'Цена предложения без НДС', materials: 'Материалы', labour: 'Работы и персонал',
    equipment: 'Техника и оборудование', delivery: 'Доставка', overhead: 'Накладные расходы',
    fees: 'Комиссии и стоимость гарантий', financing: 'Стоимость финансирования', reserve: 'Резерв',
    taxes: 'Налоги, кроме НДС', output_vat: 'НДС в цене предложения', input_vat: 'НДС в расходах'
  };
  const missingNames = {...fields, positive_revenue: 'положительную цену предложения',
    scope_confirmed: 'полноту состава затрат', tax_basis_confirmed: 'налоговую базу сумм',
    basis_note: 'основание расчёта', source_changed: 'изменившиеся источники'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  // Amounts arrive as integer kopecks; formatting never calculates profitability.
  const inputMoney = value => value == null ? '' : (BigInt(value) / 100n).toString() + ',' + (BigInt(value) % 100n).toString().padStart(2, '0');
  const money = value => {
    if (value == null) return 'Не определено';
    const amount = BigInt(value), absolute = amount < 0n ? -amount : amount;
    return (amount < 0n ? '−' : '') + (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + (absolute % 100n).toString().padStart(2, '0') + ' ₽';
  };
  let model, active = 'base', busy = false, message = '', conflict = false;
  const drafts = new Map();

  function draftFor(name) {
    if (drafts.has(name)) return drafts.get(name);
    const saved = model.scenarios[name], conditions = saved?.conditions || {};
    const draft = {conditions: {}, expected: saved?.version || 0,
      sourceVersion: saved?.source.version || model.source?.version || '', dirty: false, pending: null};
    for (const key of Object.keys(fields)) draft.conditions[key] = inputMoney(conditions[key]);
    for (const key of ['scope_confirmed', 'tax_basis_confirmed']) draft.conditions[key] = !!conditions[key];
    draft.conditions.basis_note = conditions.basis_note || '';
    drafts.set(name, draft);
    return draft;
  }

  async function request(path, payload) {
    const response = await fetch(path, {method: payload ? 'POST' : 'GET', credentials: 'same-origin',
      cache: 'no-store', headers: {'Accept':'application/json', ...(payload ? {'Content-Type':'application/json'} : {})},
      ...(payload ? {body: JSON.stringify(payload)} : {})});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'request_failed'), {status: response.status});
    return data;
  }

  function amountField(key, draft) {
    return `<label>${escape(fields[key])}<span class="scenario-money-input"><input name="${key}" inputmode="decimal" autocomplete="off" maxlength="16" placeholder="Пока неизвестно" value="${escape(draft.conditions[key])}"><span>₽</span></span></label>`;
  }

  function resultHtml(result, dirty) {
    const missing = result?.missing || [];
    const ready = !dirty && result?.status === 'calculated';
    return `<div class="scenario-result" aria-live="polite">
      <dl><div><dt>Известные расходы и резерв, без НДС</dt><dd>${dirty ? 'Расчёт не обновлён' : money(result?.known_cost_kopecks)}</dd></div>
      <div><dt>Остаток после расходов и резерва</dt><dd class="${ready && result.profit_kopecks < 0 ? 'scenario-loss' : ''}">${ready ? money(result.profit_kopecks) : 'Пока не определён'}</dd></div>
      <div><dt>Доля остатка в выручке</dt><dd>${ready ? escape(result.margin_percent).replace('.', ',') + '%' : '—'}</dd></div></dl>
      <p>${dirty ? 'Есть изменения. Сохраните условия, чтобы обновить расчёт.' : ready ? 'Расчёт по введённым условиям сценария. Состав затрат и источники подтверждены пользователем.' : !result ? 'Заполните известные суммы и сохраните условия. Незавершённый сценарий можно сохранить как черновик.' : 'Нужно уточнить: ' + escape(missing.map(key => missingNames[key] || key).join(', ')) + '.'}</p>
      ${!dirty && result ? `<p class="scenario-vat-summary">С НДС: предложение ${money(result.revenue_gross_kopecks)} · расходы и резерв ${money(result.cost_gross_kopecks)}. Сроки поступлений и платежей здесь не учитываются.</p>` : ''}
    </div>`;
  }

  function render(open = false) {
    const draft = draftFor(active), saved = model.scenarios[active], source = model.source;
    const stale = source && draft.sourceVersion !== source.version;
    const history = model.history.filter(row => row.scenario === active);
    root.hidden = false;
    root.innerHTML = `<details class="tender-scenarios" ${open ? 'open' : ''}>
      <summary><span><strong>Условия участия</strong><small>Три сценария с вашими суммами</small></span><span>${draft.dirty ? 'Есть изменения' : saved ? 'Версия ' + saved.version : 'Заполнить условия'} <b aria-hidden="true">⌄</b></span></summary>
      <div class="scenario-body">
        <p class="scenario-intro">Задайте затраты для этого тендера. Все основные суммы — без НДС. Ноль означает, что расхода нет; пустое поле — что сумма ещё неизвестна.</p>
        <div class="scenario-reference"><strong>Основание из AutoBot</strong><p>${source ? `НМЦК как в источнике: ${money(source.initial_price_kopecks)}. Цены найдены для ${source.rows_priced} из ${source.rows_total} позиций. Известная часть по этим ценам: ${money(source.known_market_kopecks)}.` : 'Источники временно недоступны. Сохранённые условия доступны для просмотра.'}</p>
          <p>Налоговый режим найденных цен и состав затрат проверяются отдельно. Сумма рынка автоматически в расходы не переносится.</p>
          ${source?.source_warning ? `<p>${escape(source.source_warning)}</p>` : ''}</div>
        <label class="scenario-select-label">Сценарий<select data-scenario-select>${Object.entries(names).map(([key,label]) => `<option value="${key}" ${key === active ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        ${active !== 'base' && model.scenarios.base ? '<button class="btn ghost" type="button" data-scenario-copy-base>Взять базовый за основу</button>' : ''}
        ${stale ? '<div class="scenario-notice">Источники изменились после сохранения этих условий. <button type="button" class="btn ghost" data-scenario-rebase>Сверить с текущими источниками</button></div>' : ''}
        <form data-scenario-form>
          <div class="scenario-income">${amountField('revenue', draft)}</div>
          <fieldset><legend>Затраты и резерв</legend><div class="scenario-fields">${Object.keys(fields).filter(key => !['revenue','output_vat','input_vat'].includes(key)).map(key => amountField(key, draft)).join('')}</div></fieldset>
          <details class="scenario-vat"><summary>Суммы НДС отдельно</summary><div class="scenario-fields">${amountField('output_vat', draft)}${amountField('input_vat', draft)}</div><p>Введите суммы из условий этого сценария; ставка не подставляется.</p></details>
          <label class="scenario-note-label">Основание и состав расчёта<textarea name="basis_note" maxlength="4000" rows="3" placeholder="Какие работы и ресурсы учтены, на какие документы и цены опираетесь">${escape(draft.conditions.basis_note)}</textarea></label>
          <label class="scenario-confirm"><input type="checkbox" name="scope_confirmed" ${draft.conditions.scope_confirmed ? 'checked' : ''}><span>Все работы и ресурсы учтены. Материалы и техника не включены повторно в стоимость работ.</span></label>
          <label class="scenario-confirm"><input type="checkbox" name="tax_basis_confirmed" ${draft.conditions.tax_basis_confirmed ? 'checked' : ''}><span>Основные суммы приведены к одной базе без НДС; налоги указаны отдельно.</span></label>
          <div data-scenario-result>${resultHtml(saved?.result, draft.dirty)}</div>
          <div class="scenario-save"><button class="btn primary" type="submit" ${!source || stale ? 'disabled' : ''}>Сохранить условия</button><span data-scenario-message role="status">${escape(message)}</span></div>
          ${conflict ? '<button class="btn ghost" type="button" data-scenario-refresh>Заменить форму сохранённой версией</button>' : ''}
        </form>
        <details class="scenario-history"><summary>История условий · ${history.length ? 'последние ' + history.length : 'пока пусто'}</summary>
          ${history.length ? `<ul>${history.map(row => `<li><span><b>Версия ${row.version}</b> · ${escape(row.business_date)} · пользователь ${row.actor_id}</span><button class="btn ghost" type="button" data-scenario-restore="${row.version}">Взять за основу</button></li>`).join('')}</ul>` : '<p>Здесь появятся сохранённые версии. Калькулятор уже надел каску — ждёт исходные данные.</p>'}</details>
      </div></details>`;
    root.querySelector('[data-scenario-select]').addEventListener('change', event => {
      active = event.target.value; message = ''; conflict = false; render(true);
      root.querySelector('[data-scenario-select]').focus({preventScroll: true});
    });
    root.querySelector('[data-scenario-copy-base]')?.addEventListener('click', () => {
      const base = model.scenarios.base;
      for (const key of Object.keys(fields)) draft.conditions[key] = inputMoney(base.conditions[key]);
      for (const key of ['basis_note','scope_confirmed','tax_basis_confirmed']) draft.conditions[key] = base.conditions[key];
      draft.sourceVersion = base.source.version; draft.dirty = true; draft.pending = null;
      message = 'Скопированы сохранённые условия базового сценария. Измените нужные суммы и сохраните отдельно.'; render(true);
    });
    root.querySelector('[data-scenario-form]').addEventListener('input', event => {
      const control = event.target;
      if (!(control.name in draft.conditions)) return;
      draft.conditions[control.name] = control.type === 'checkbox' ? control.checked : control.value;
      draft.dirty = true;
      draft.pending = null;
      root.querySelector('[data-scenario-result]').innerHTML = resultHtml(null, true);
      root.querySelector('[data-scenario-message]').textContent = 'Есть несохранённые изменения';
    });
    root.querySelector('[data-scenario-form]').addEventListener('submit', event => {event.preventDefault(); save();});
    root.querySelector('[data-scenario-rebase]')?.addEventListener('click', () => {
      draft.sourceVersion = source.version;
      draft.conditions.scope_confirmed = false;
      draft.conditions.tax_basis_confirmed = false;
      draft.dirty = true; draft.pending = null;
      message = 'Проверьте состав и налоговую базу по обновлённым источникам'; render(true);
    });
    root.querySelector('[data-scenario-refresh]')?.addEventListener('click', async () => {
      try {model = await request(endpoint); drafts.delete(active); conflict = false; message = ''; render(true);}
      catch {root.querySelector('[data-scenario-message]').textContent = 'Не удалось загрузить последнюю версию. Введённые поля сохранены в форме.';}
    });
    root.querySelectorAll('[data-scenario-restore]').forEach(button => button.addEventListener('click', () => {
      const row = history.find(item => item.version === Number(button.dataset.scenarioRestore));
      for (const key of Object.keys(fields)) draft.conditions[key] = inputMoney(row.conditions[key]);
      for (const key of ['basis_note','scope_confirmed','tax_basis_confirmed']) draft.conditions[key] = row.conditions[key];
      draft.sourceVersion = row.source.version; draft.dirty = true; draft.pending = null;
      message = 'Версия ' + row.version + ' в форме. Сохранение создаст новую запись истории.'; render(true);
    }));
  }

  async function save() {
    if (busy) return;
    busy = true;
    const draft = draftFor(active);
    draft.pending ||= {scenario: active, expected_version: draft.expected, operation_id: crypto.randomUUID(),
      source_version: draft.sourceVersion, conditions: {...draft.conditions}};
    root.querySelectorAll('input,textarea,select,button').forEach(control => {control.disabled = true;});
    root.querySelector('[data-scenario-message]').textContent = 'Сохраняем…';
    try {
      model = await request(endpoint, draft.pending);
      drafts.delete(active); conflict = false;
      message = model.duplicate ? 'Сохранение подтверждено; повторной записи нет' : 'Сохранено · версия ' + model.saved_version;
    } catch (error) {
      if ([401,403].includes(error.status)) {root.replaceChildren(); root.hidden = true; return;}
      const errors = {bad_money:'Введите суммы в рублях, не более двух знаков после запятой.', money_limit:'Сумма превышает допустимый размер.',
        source_changed:'Источники изменились. Введённые поля остаются в форме; обновите данные и сверьте условия.',
        version_conflict:'Другой пользователь уже сохранил условия. Ваша форма сохранена; загрузите последнюю версию перед заменой.',
        operation_conflict:'Этот повтор не соответствует сохранённой операции. Загрузите последнюю версию.',
        source_unavailable:'AutoBot временно недоступен. Поля сохранены в форме; повторите сохранение позже.'};
      message = errors[error.message] || 'Сохранение не подтверждено. Поля остались в форме; повтор безопасен.';
      conflict = ['version_conflict','operation_conflict'].includes(error.message);
      if (error.message === 'source_changed') {
        try {model = await request(endpoint);} catch { /* Preserve the current draft on a failed refresh. */ }
      }
    } finally {
      busy = false;
      if (!root.hidden) {
        render(true);
        const status = root.querySelector('[data-scenario-message]');
        status.tabIndex = -1;
        status.focus({preventScroll: true});
      }
    }
  }

  async function load() {
    try {model = await request(endpoint); render();}
    catch (error) {
      if ([401,403,404].includes(error.status)) {root.replaceChildren(); root.hidden = true; return;}
      root.hidden = false;
      root.innerHTML = '<div class="scenario-notice">Не удалось загрузить условия участия. <button class="btn ghost" type="button">Повторить</button></div>';
      root.querySelector('button').addEventListener('click', load);
    }
  }
  load();
})();
