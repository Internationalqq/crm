(function () {
    'use strict';
    var P = window.PMBI = window.PMBI || {};
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    function amount(k) { return k == null ? 'Сумма не разобрана' : new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB'}).format(k / 100); }
    function cents(s) {
        var t = String(s).replace(/\s/g, '').replace(',', '.');
        if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new Error('Введите сумму с точностью до копейки.');
        var a = t.split('.'); var n = Number(a[0]) * 100 + Number((a[1] || '').padEnd(2, '0'));
        if (!Number.isSafeInteger(n)) throw new Error('Слишком большая сумма.');
        return n;
    }
    async function request(url, data) {
        var response = await fetch(url, {credentials:'same-origin', method:data ? 'POST' : 'GET',
            headers:data ? {'Content-Type':'application/json'} : {}, body:data ? JSON.stringify(data) : undefined});
        var result = await response.json();
        if (!response.ok) {
            var errors = {revision_conflict:'Документ уже изменился. Обновите список и повторите.',lines_total_mismatch:'Сумма строк не совпадает с итогом.',
                unresolved_questions:'Сначала уточните вопросы к документу.',project_date_amount_kind_required:'Укажите объект, дату, сумму и вид документа.',
                vat_required:'Укажите НДС из счёта.',payment_kind_required:'Укажите способ оплаты.',linked_amount_mismatch:'Сумма выбранной операции отличается.',original_receipt_required:'Выберите исходный проверенный чек для возврата.',refund_exceeds_original:'Возврат превышает остаток исходного чека.',
                forbidden:'Нет доступа к этим документам.',project_forbidden:'Нет доступа к выбранному объекту.',document_already_verified:'Документ уже проверен.',possible_duplicate_check_required:'Есть проверенный документ с тем же продавцом, датой и суммой. Сравните оригиналы: свяжите со счётом или подтвердите, что это отдельная покупка.'};
            throw new Error(errors[result.error] || (String(result.error).indexOf('fiscal_duplicate:') === 0 ? 'Этот фискальный чек уже есть в реестре. Повторно учитывать его нельзя.' : 'Не удалось сохранить документ. ' + (result.error || 'Повторите позже.')));
        }
        return result;
    }
    function lineHTML(line) {
        return '<div class="intake-line"><label>Материал / услуга<input name="line_title" required value="'+esc(line.title)+'"></label><label>Количество<input name="line_qty" value="'+esc(line.quantity || '')+'" inputmode="decimal"></label><label>Ед.<input name="line_unit" value="'+esc(line.unit || '')+'"></label><label>Сумма, ₽<input name="line_amount" inputmode="decimal" required value="'+esc(line.amount_kopecks == null ? '' : (line.amount_kopecks / 100).toFixed(2))+'"></label><button type="button" class="ghost compact" data-remove-line aria-label="Удалить строку">Удалить</button></div>';
    }
    function editHTML(item, projects, items) {
        var d = item.details || {};
        return '<form class="intake-form"><div class="intake-fields">' +
            '<label>Объект<select name="project_id"><option value="">Нужно уточнить</option>'+projects.map(function(p){return '<option value="'+p.id+'" '+(p.id === item.project_id?'selected':'')+'>'+esc(p.title)+'</option>';}).join('')+'</select></label>'+
            '<label>Документ<select name="kind">'+[['unknown','Не определён'],['receipt','Чек'],['invoice','Счёт'],['refund','Возврат'],['other','Другой документ']].map(function(o){return '<option value="'+o[0]+'" '+(o[0]===item.kind?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>'+
            '<label>Назначение<input name="title" value="'+esc(item.title)+'"></label><label>Продавец<input name="counterparty" value="'+esc(item.counterparty)+'"></label>'+
            '<label>Дата документа<input type="date" name="document_date" value="'+esc(item.document_date)+'"></label><label>Итого, ₽<input name="amount" inputmode="decimal" value="'+esc(item.amount_kopecks == null ? '' : (item.amount_kopecks/100).toFixed(2))+'"></label>'+
            '<label>ФН:ФД:ФП чека<input name="fiscal_key" value="'+esc(item.fiscal_key)+'" placeholder="Если читаются на чеке"></label>'+
            '<label>Срок оплаты счёта<input type="date" name="planned_date" value="'+esc(d.planned_date)+'"></label>'+
            '<label>Способ оплаты счёта<select name="payment_kind"><option value="">Не определён</option>'+[['cash','Наличные'],['bank_no_vat','Безналичный без НДС'],['bank_vat','Безналичный с НДС']].map(function(o){return '<option value="'+o[0]+'" '+(o[0]===d.payment_kind?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>'+
            '<label>НДС счёта, %<input name="vat_percent" inputmode="decimal" value="'+esc(d.vat_percent == null ? '' : d.vat_percent)+'" placeholder="По документу"></label></div>'+
            '<h4>Строки документа</h4><div data-intake-lines>'+(d.lines || []).map(lineHTML).join('')+'</div><button class="ghost compact" type="button" data-add-line>Добавить строку</button>'+
            '<label>Что нужно уточнить<textarea name="questions" rows="2">'+esc((d.questions || []).join('\n'))+'</textarea></label>'+
            '<label>Исходный чек для возврата<select name="original_receipt_id"><option value="">Не является возвратом</option>'+items.filter(function(i){return i.kind==='receipt' && i.status==='verified';}).map(function(i){return '<option value="'+i.id+'" '+(i.id===d.original_receipt_id?'selected':'')+'>'+esc(i.title || i.original_name)+' · '+esc(amount(i.amount_kopecks))+'</option>';}).join('')+'</select></label>'+
            '<label>Связать с существующим счётом / расходом<select name="linked"><option value="">Отдельный документ</option></select></label>'+
            '<p class="muted">После проверки счёт попадёт в план оплаты. Чек сохранится в документах объекта и затратнике; движение денег и списание со склада не создаются.</p>'+
            '<label><span><input type="checkbox" name="confirm_distinct"> Проверено: это отдельная покупка, даже если продавец, дата и сумма совпадают с другим документом</span></label>'+
            '<div class="intake-actions"><button class="primary" type="submit">Сохранить разбор</button><button class="ghost" type="button" data-confirm>Проверено — учесть документ</button></div><p role="status" data-intake-error></p></form>';
    }
    async function mount(root, projectId) {
        if (!root) return;
        root.innerHTML = '<p role="status">Загружаем чеки и счета…</p>';
        try {
            var data = await request('/api/finance-intake'+(projectId?'?project_id='+projectId:''));
            if (!root.isConnected) return;
            root.innerHTML = '<div class="intake-head"><div><h3>Чеки и счета</h3><p>Оригиналы из группы Финансиста. Непроверенные документы не меняют денежные итоги.</p></div><button class="ghost compact" data-intake-refresh>Обновить</button></div>'+
                '<div class="intake-filters"><label>Объект<select data-project-filter><option value="">Все доступные</option><option value="none">Без объекта</option>'+data.projects.map(function(p){return '<option value="'+p.id+'">'+esc(p.title)+'</option>';}).join('')+'</select></label><label>Статус<select data-status-filter><option value="">Все документы</option><option value="needs_review">На проверке</option><option value="verified">Проверены</option></select></label><span data-intake-count role="status"></span></div><div data-intake-list></div>';
            root.querySelector('[data-intake-refresh]').onclick = function(){ mount(root, projectId); };
            var projectFilter = root.querySelector('[data-project-filter]');
            if (projectId) { projectFilter.value = String(projectId); projectFilter.closest('label').hidden = true; }
            function render() {
                var status = root.querySelector('[data-status-filter]').value;
                var items = data.items.filter(function(i){return (!status || i.status===status) && (!projectFilter.value || (projectFilter.value === 'none' ? !i.project_id : String(i.project_id)===projectFilter.value));});
                var verified = items.filter(function(i){return i.status==='verified' && (i.kind==='receipt' || i.kind==='refund');}).reduce(function(s,i){return s+(i.kind==='refund'?-1:1)*(i.amount_kopecks || 0);},0);
                root.querySelector('[data-intake-count]').textContent = 'Документы: '+items.length+' · Чеки за вычетом возвратов: '+amount(verified)+' (не денежный итог)';
                var list = root.querySelector('[data-intake-list]');
                list.innerHTML = items.length ? items.map(function(item){
                    var project = data.projects.find(function(p){return p.id===item.project_id;});
                    return '<details class="intake-document" data-id="'+item.id+'"><summary><span><b>'+esc(item.title || item.original_name)+'</b><small>'+esc(project ? project.title : 'Объект нужно уточнить')+' · '+esc(item.counterparty || (item.sources[0] || {}).sender_name || 'Продавец не разобран')+'</small></span><strong>'+esc(amount(item.amount_kopecks))+'</strong><span class="intake-status">'+(item.status==='verified'?'Проверен':'На проверке')+'</span></summary><div class="intake-body"><a class="ghost compact" target="_blank" rel="noopener" href="'+item.view_url+'">Открыть оригинал</a><p>'+esc(item.sources.map(function(s){return s.sender_name + ': ' + s.caption;}).join(' · '))+'</p>'+
                    (project?'<p><a href="/app/projects?openProject='+project.id+'&tab=finance">Открыть финансы объекта</a></p>':'')+
                    (item.status==='needs_review' && data.can_manage ? editHTML(item,data.projects,data.items) : '<p>Документ сохранён в объекте. '+(item.finance_entry_id?'Связан с финансовой операцией.':'Денежная операция не создавалась.')+'</p><ul>'+(item.details.lines || []).map(function(l){return '<li>'+esc(l.title)+' — '+esc(amount(l.amount_kopecks))+'</li>';}).join('')+'</ul>')+'</div></details>';
                }).join('') : '<p class="intake-empty">Документов пока нет. Пришлите чек или счёт в группу Финансиста и укажите объект в подписи.</p>';
                list.querySelectorAll('.intake-document').forEach(function(panel){
                    var item=data.items.find(function(i){return i.id===Number(panel.dataset.id);}); var form=panel.querySelector('form'); if(!form)return;
                    function get(name){return form.elements.namedItem(name).value;}
                    function kindFields(){
                        ['planned_date','payment_kind','vat_percent'].forEach(function(name){form.elements.namedItem(name).closest('label').hidden=get('kind')!=='invoice';});
                        form.elements.namedItem('original_receipt_id').closest('label').hidden=get('kind')!=='refund';
                        form.elements.namedItem('confirm_distinct').closest('label').hidden=!(item.possible_duplicates || []).length;
                    }
                    form.elements.namedItem('kind').onchange=kindFields;kindFields();
                    async function links(){
                        var select=form.elements.namedItem('linked'); select.innerHTML='<option value="">Отдельный документ</option>';
                        if(!get('project_id'))return;
                        try { var result=await request('/api/projects/'+Number(get('project_id'))+'/finances');
                            (result.items || []).filter(function(i){return i.direction==='expense' && i.status!=='cancelled';}).forEach(function(i){var o=document.createElement('option');o.value=i.id;o.textContent=(i.category || i.counterparty_name || 'Расход')+' · '+amount(Math.round(i.amount*100));select.appendChild(o);});
                        }catch(e){form.querySelector('[data-intake-error]').textContent=e.message;}
                    }
                    form.elements.namedItem('project_id').onchange=links;
                    panel.addEventListener('toggle',function(){if(panel.open && !panel.dataset.links){panel.dataset.links='1';links();}});
                    form.querySelector('[data-add-line]').onclick=function(){form.querySelector('[data-intake-lines]').insertAdjacentHTML('beforeend',lineHTML({}));};
                    form.onclick=function(e){if(e.target.matches('[data-remove-line]'))e.target.closest('.intake-line').remove();};
                    async function save(confirm){
                        var error=form.querySelector('[data-intake-error]');error.textContent='';
                        var buttons=form.querySelectorAll('button');buttons.forEach(function(b){b.disabled=true;});
                        try {
                            var details=Object.assign({},item.details,{questions:get('questions').split('\n').filter(function(s){return s.trim();}),
                                planned_date:get('planned_date') || null,payment_kind:get('payment_kind') || null,original_receipt_id:Number(get('original_receipt_id')) || null,
                                vat_percent:get('vat_percent')===''?null:Number(get('vat_percent').replace(',','.')),
                                lines:Array.from(form.querySelectorAll('.intake-line')).map(function(l){return {title:l.querySelector('[name=line_title]').value,quantity:l.querySelector('[name=line_qty]').value || null,unit:l.querySelector('[name=line_unit]').value,amount_kopecks:cents(l.querySelector('[name=line_amount]').value)};})});
                            var saved=await request('/api/finance-intake/'+item.id+'/draft',{revision:item.revision,project_id:Number(get('project_id')) || null,kind:get('kind'),title:get('title'),counterparty:get('counterparty'),document_date:get('document_date') || null,amount_kopecks:get('amount')===''?null:cents(get('amount')),fiscal_key:get('fiscal_key'),details:details});
                            item.revision=saved.item.revision;
                            item.possible_duplicates=saved.item.possible_duplicates;kindFields();
                            if(confirm)await request('/api/finance-intake/'+item.id+'/confirm',{revision:item.revision,finance_entry_id:Number(get('linked')) || null,confirm_distinct:form.elements.namedItem('confirm_distinct').checked});
                            await mount(root,projectId);
                        }catch(e){error.textContent=e.message;}finally{buttons.forEach(function(b){b.disabled=false;});}
                    }
                    form.onsubmit=function(e){e.preventDefault();save(false);};
                    form.querySelector('[data-confirm]').onclick=function(){if(form.reportValidity())save(true);};
                });
            }
            projectFilter.onchange=render;root.querySelector('[data-status-filter]').onchange=render;render();
        } catch(e) { root.innerHTML='<p role="alert">'+esc(e.message)+'</p><button class="ghost" data-retry>Повторить загрузку</button>';root.querySelector('[data-retry]').onclick=function(){mount(root,projectId);}; }
    }
    P.financeIntake={mount:mount};
}());
