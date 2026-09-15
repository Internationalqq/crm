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
  const cashKinds = {receipt:'Поступление заказчика', payment:'Оплата расходов', vat_payment:'НДС к уплате', vat_refund:'Возврат НДС'};
  const cashMissing = {opening_cash:'доступные деньги к началу графика', cash_confirmation:'полноту графика',
    economic_conditions:'основные условия и текущие источники', cash_vat_basis:'суммы НДС в условиях (или явный ноль)',
    cash_payment_details:'суммы и даты каждой строки', cash_security_details:'суммы и обе даты обеспечения',
    cash_receipts_mismatch:'поступления на полную сумму предложения с НДС',
    cash_payments_mismatch:'оплаты на полную сумму расходов и резерва с НДС'};
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

  const emptyCash = () => ({opening_cash:'', confirmed:false, payments:[], securities:[]});
  function cashFromStored(value) {
    if (!value) return null;
    return {opening_cash:inputMoney(value.opening_cash), confirmed:!!value.confirmed,
      payments:value.payments.map(row => ({...row, on:row.on || '', amount:inputMoney(row.amount)})),
      securities:value.securities.map(row => ({...row, paid_on:row.paid_on || '', returned_on:row.returned_on || '', amount:inputMoney(row.amount)}))};
  }

  function updateCashControl(control, conditions) {
    const key = control.dataset.cashField;
    if (!key) return false;
    const cash = conditions.cash_flow ||= emptyCash();
    const section = control.dataset.cashSection;
    const target = section ? cash[section][Number(control.dataset.cashIndex)] : cash;
    target[key] = control.type === 'checkbox' ? control.checked : control.value;
    if (key !== 'confirmed') cash.confirmed = false;
    return true;
  }

  function cashResultHtml(result, dirty) {
    if (dirty) return '<p>Есть изменения. Сохраните условия, чтобы обновить денежный график.</p>';
    if (!result || result.status === 'not_started') return '<p>График пока не задан. Расчёт прибыли работает отдельно.</p>';
    const ready = result.status === 'calculated';
    const day = value => value ? escape(value.split('-').reverse().join('.')) : '—';
    const matching = `<p>В графике: поступления заказчика ${money(result.scheduled_receipts_kopecks)} из ${money(result.expected_receipts_kopecks)}; оплаты расходов ${money(result.scheduled_payments_kopecks)} из ${money(result.expected_payments_kopecks)}.</p>`;
    if (!ready) return matching + '<p>Нужно уточнить: ' + escape(result.missing.map(key => cashMissing[key] || key).join(', ')) + '.</p>';
    return matching + `<dl class="cash-summary"><div><dt>Нехватка доступных средств</dt><dd class="${result.cash_gap_kopecks > 0 ? 'scenario-loss' : ''}">${money(result.cash_gap_kopecks)}</dd></div>
      <div><dt>Первый день разрыва</dt><dd>${day(result.first_gap_on)}</dd></div>
      <div><dt>Остаток в конце графика</dt><dd>${money(result.closing_balance_kopecks)}</dd></div></dl>
      <p>Остатки на конец дня; внутридневной порядок не учитывается.</p>
      <div class="cash-table-wrap" tabindex="0" role="region" aria-label="Денежный график по дням"><table aria-label="Остатки на конец дня"><thead><tr><th>Дата</th><th>Поступит</th><th>Уйдёт</th><th>Останется</th></tr></thead>
        <tbody>${result.days.map(row => `<tr><td>${day(row.on)}</td><td>${money(row.in_kopecks)}</td><td>${money(row.out_kopecks)}</td><td class="${row.balance_kopecks < 0 ? 'scenario-loss' : ''}">${money(row.balance_kopecks)}</td></tr>`).join('')}</tbody></table></div>
      <p>Обеспечение и расчёты по НДС включены в движение денег. Остаток денег отличается от прибыли; график не создаёт фактических оплат в CRM.</p>`;
  }

  function cashEditorHtml(draft, result, opened) {
    const cash = draft.conditions.cash_flow || emptyCash();
    const control = (label, key, value, section, index, type = 'text') => `<label>${label}<input type="${type}" data-cash-field="${key}" ${section ? `data-cash-section="${section}" data-cash-index="${index}"` : ''} ${key === 'amount' || key === 'opening_cash' ? 'inputmode="decimal" maxlength="16" placeholder="Пока неизвестно"' : type === 'text' ? 'maxlength="500"' : ''} value="${escape(value)}"></label>`;
    return `<details class="scenario-cashflow" ${opened ? 'open' : ''}><summary>Денежный график и обеспечение <small>${draft.dirty ? 'есть изменения' : result?.status === 'calculated' ? 'рассчитан' : result?.status === 'incomplete' ? 'нужны данные' : 'по желанию'}</small></summary>
      <p>Все платежи здесь — с НДС. Введите доступные к началу графика деньги, поступления и оплаты по датам. Проценты и сроки не подставляются.</p>
      <div class="cash-opening">${control('Доступно к началу графика, ₽', 'opening_cash', cash.opening_cash)}</div>
      <fieldset><legend>Поступления и оплаты</legend><div class="cash-payments">
        ${cash.payments.map((row,i) => `<div class="cash-row"><label>Тип<select data-cash-field="kind" data-cash-section="payments" data-cash-index="${i}">${Object.entries(cashKinds).map(([key,label]) => `<option value="${key}" ${key === row.kind ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          ${control('Дата', 'on', row.on, 'payments', i, 'date')}${control('Сумма с НДС, ₽', 'amount', row.amount, 'payments', i)}
          <div class="cash-row-note">${control('Назначение', 'note', row.note, 'payments', i)}</div><button class="cash-remove" type="button" data-cash-remove="payments" data-cash-index="${i}" aria-label="Удалить платёж ${i+1}">Удалить</button></div>`).join('')}
        </div><div class="cash-add-actions"><button class="btn ghost" type="button" data-cash-add="receipt" ${cash.payments.length >= 60 ? 'disabled' : ''}>+ Поступление</button><button class="btn ghost" type="button" data-cash-add="payment" ${cash.payments.length >= 60 ? 'disabled' : ''}>+ Оплата</button></div>
        <p>Поступления заказчика и оплаты расходов должны совпасть с итогами условий с НДС. Уплата и возврат НДС задаются отдельным типом строки по вашим налоговым условиям.</p></fieldset>
      <fieldset><legend>Возвратное обеспечение</legend><p>Тело обеспечения временно уменьшает доступные деньги. Комиссию укажите в расходах сценария. Для частичных возвратов задайте отдельные суммы и даты.</p>
        ${cash.securities.map((row,i) => `<div class="cash-row">${control('Внесение', 'paid_on', row.paid_on, 'securities', i, 'date')}${control('Возврат', 'returned_on', row.returned_on, 'securities', i, 'date')}${control('Сумма, ₽', 'amount', row.amount, 'securities', i)}
          <div class="cash-row-note">${control('Основание обеспечения', 'note', row.note, 'securities', i)}</div><button class="cash-remove" type="button" data-cash-remove="securities" data-cash-index="${i}" aria-label="Удалить обеспечение ${i+1}">Удалить</button></div>`).join('')}
        <button class="btn ghost" type="button" data-cash-add="security" ${cash.securities.length >= 20 ? 'disabled' : ''}>+ Обеспечение</button></fieldset>
      <label class="scenario-confirm"><input type="checkbox" data-cash-field="confirmed" ${cash.confirmed ? 'checked' : ''}><span>Все поступления, оплаты, расчёты по НДС и возврат обеспечения учтены; даты проверены.</span></label>
      <div class="cash-result" data-cash-result aria-live="polite">${cashResultHtml(result, draft.dirty)}</div>
      ${draft.conditions.cash_flow ? '<button class="cash-remove" type="button" data-cash-clear>Убрать график из этого сценария</button>' : ''}
      <p>График сохранится вместе с условиями по кнопке ниже.</p></details>`;
  }

  function draftFor(name) {
    if (drafts.has(name)) return drafts.get(name);
    const saved = model.scenarios[name], conditions = saved?.conditions || {};
    const draft = {conditions: {}, expected: saved?.version || 0,
      sourceVersion: saved?.source.version || model.source?.version || '', dirty: false, pending: null};
    for (const key of Object.keys(fields)) draft.conditions[key] = inputMoney(conditions[key]);
    for (const key of ['scope_confirmed', 'tax_basis_confirmed']) draft.conditions[key] = !!conditions[key];
    draft.conditions.basis_note = conditions.basis_note || '';
    draft.conditions.cash_flow = cashFromStored(conditions.cash_flow);
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
      ${!dirty && result ? `<p class="scenario-vat-summary">С НДС: предложение ${money(result.revenue_gross_kopecks)} · расходы и резерв ${money(result.cost_gross_kopecks)}. Сроки поступлений и оплат учитываются отдельно в денежном графике.</p>` : ''}
    </div>`;
  }

  function render(open = false) {
    const cashOpened = !!root.querySelector('.scenario-cashflow')?.open;
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
          ${cashEditorHtml(draft, saved?.result?.cash_flow, cashOpened)}
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
      draft.conditions.cash_flow = cashFromStored(base.conditions.cash_flow);
      draft.sourceVersion = base.source.version; draft.dirty = true; draft.pending = null;
      message = 'Скопированы сохранённые условия базового сценария. Измените нужные суммы и сохраните отдельно.'; render(true);
    });
    root.querySelector('[data-scenario-form]').addEventListener('input', event => {
      const control = event.target;
      const cashChanged = updateCashControl(control, draft.conditions);
      if (!cashChanged) {
        if (!(control.name in draft.conditions)) return;
        draft.conditions[control.name] = control.type === 'checkbox' ? control.checked : control.value;
        if (control.name in fields && draft.conditions.cash_flow) draft.conditions.cash_flow.confirmed = false;
      }
      root.querySelector('[data-cash-field="confirmed"]').checked = !!draft.conditions.cash_flow?.confirmed;
      draft.dirty = true;
      draft.pending = null;
      root.querySelector('[data-scenario-result]').innerHTML = resultHtml(null, true);
      root.querySelector('[data-cash-result]').innerHTML = cashResultHtml(null, true);
      root.querySelector('.scenario-cashflow > summary small').textContent = 'есть изменения';
      root.querySelector('[data-scenario-message]').textContent = 'Есть несохранённые изменения';
    });
    root.querySelector('[data-scenario-form]').addEventListener('submit', event => {event.preventDefault(); save();});
    const cashChanged = () => {draft.dirty = true; draft.pending = null; message = 'Есть несохранённые изменения'; render(true);};
    root.querySelectorAll('[data-cash-add]').forEach(button => button.addEventListener('click', () => {
      const cash = draft.conditions.cash_flow ||= emptyCash();
      if (button.dataset.cashAdd === 'security') {
        if (cash.securities.length >= 20) return;
        cash.securities.push({paid_on:'', returned_on:'', amount:'', note:''});
      } else {
        if (cash.payments.length >= 60) return;
        cash.payments.push({kind:button.dataset.cashAdd, on:'', amount:'', note:''});
      }
      cash.confirmed = false; cashChanged();
    }));
    root.querySelectorAll('[data-cash-remove]').forEach(button => button.addEventListener('click', () => {
      const cash = draft.conditions.cash_flow;
      cash[button.dataset.cashRemove].splice(Number(button.dataset.cashIndex), 1);
      cash.confirmed = false; cashChanged();
    }));
    root.querySelector('[data-cash-clear]')?.addEventListener('click', () => {draft.conditions.cash_flow = null; cashChanged();});
    root.querySelector('[data-scenario-rebase]')?.addEventListener('click', () => {
      draft.sourceVersion = source.version;
      draft.conditions.scope_confirmed = false;
      draft.conditions.tax_basis_confirmed = false;
      if (draft.conditions.cash_flow) draft.conditions.cash_flow.confirmed = false;
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
      draft.conditions.cash_flow = cashFromStored(row.conditions.cash_flow);
      draft.sourceVersion = row.source.version; draft.dirty = true; draft.pending = null;
      message = 'Версия ' + row.version + ' в форме. Сохранение создаст новую запись истории.'; render(true);
    }));
  }

  async function save() {
    if (busy) return;
    busy = true;
    const draft = draftFor(active);
    draft.pending ||= {scenario: active, expected_version: draft.expected, operation_id: crypto.randomUUID(),
      source_version: draft.sourceVersion, conditions: JSON.parse(JSON.stringify(draft.conditions))};
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
        source_unavailable:'AutoBot временно недоступен. Поля сохранены в форме; повторите сохранение позже.',
        bad_cash_date:'Проверьте даты в денежном графике.', security_return_before_payment:'Дата возврата обеспечения должна быть не раньше даты внесения.',
        bad_cash_note:'Назначение платежа — не более 500 символов.', cash_flow_limit:'Допустимо до 60 платежей и 20 сумм обеспечения.'};
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
