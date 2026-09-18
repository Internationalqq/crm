/* Cues measured against the actual, separately recorded desktop/phone clips.
 * Rectangles are percentages of the recording, not the player's letterboxed area.
 * No simulated CRM actions: step buttons only seek within the recording. */
(() => {
    'use strict';
    const actions = {
        photo: ['Фото в отчёте', 'Нажимаем на фото в отчёте', 'Снимок прикреплён к выполненной работе.'],
        photoOpen: ['Фото крупно', 'Снимок открыт крупно', 'Можно рассмотреть результат работы на объекте.'],
        photoReturned: ['В отчёте', 'Фотография остаётся в отчёте', 'После просмотра возвращаемся к записи за день.'],
        journal: ['Журнал', 'Открываем журнал объекта', 'Выбираем день, за который нужен отчёт.'],
        report: ['Отчёт за день', 'Выбираем сегодняшний отчёт', 'В одном отчёте — работа, участники смены и фото.'],
        work: ['Работа', 'Открываем объём по работе', 'В разделе «Работы» выбираем строку сметы.'],
        quantity: ['Объём', 'Вводим сделанный объём', 'В примере — 42 м². Затем нажимаем «Сохранить объём».'],
        quantitySaved: ['Результат', 'Объём сохранён в смете', 'План — 120 м². Сделано — 42 м². Остаток — 78 м².'],
        task: ['Новая задача', 'Нажимаем «Новая задача»', 'Задача создаётся внутри выбранного объекта.'],
        taskFill: ['Условия', 'Задаём работу, срок и исполнителя', 'В примере — принять поставку и приложить фото.'],
        taskSaved: ['Результат', 'Задача появилась в очереди', 'Команда видит поручение на доске задач объекта.'],
        bill: ['Счёт', 'Нажимаем «Добавить счёт»', 'В разделе «Деньги» планируем расход по объекту.'],
        billFill: ['Сумма и срок', 'Заполняем счёт поставщика', 'Указываем назначение, сумму и срок оплаты.'],
        billSaved: ['К оплате', 'Счёт появился в списке «К оплате»', '40 320 ₽ ожидают оплаты. Это ещё не оплаченный расход.'],
        file: ['Файл', 'Прикрепляем смету из Excel', 'Даём смете название, чтобы найти её среди других.'],
        parse: ['Разбор', 'Нажимаем «Разобрать смету»', 'Файл уже прикреплён. AutoBot получит из него позиции.'],
        processing: ['Обработка', 'AutoBot разбирает документ', 'На записи виден ход обработки загруженного файла.'],
        rows: ['Позиции', 'Позиции сметы готовы', 'Работы и материалы собраны в таблицу для проверки.'],
        review: ['Позиция', 'Открываем «Проверить строку»', 'У каждой позиции можно проверить исходные данные.'],
        correction: ['Исправление', 'Уточняем название позиции', 'Добавляем причину исправления перед сохранением.'],
        correctionSaved: ['Сохранено', 'Исправление сохранено', 'Редакция обновлена. Исходный файл остался прежним.'],
        city: ['Город', 'Вводим город для поиска цен', 'В примере — Казань. Цены пока не запрашиваем.'],
        marketReady: ['Настройки', 'Проверяем параметры поиска', 'Город указан; поиск ещё не запускался.'],
        export: ['В объект', 'Нажимаем «Добавить в объект»', 'Открывается выбор объекта CRM для этой сметы.'],
        project: ['Объект', 'Выбираем объект из списка', 'В примере — деловой центр «Горизонт».'],
        importReady: ['Подтверждение', 'Смета готова к добавлению', 'В записи останавливаемся перед подтверждением импорта.'],
        tenders: ['Поиск', 'Нажимаем «Найти тендеры»', 'Открывается форма с условиями поиска.'],
        tenderCriteria: ['Условия', 'Проверяем регионы, темы и сумму', 'Показана настройка поиска, а не найденные закупки.'],
        item: ['Материал', 'Вводим материал и единицу', 'В примере — гипсокартон, единица измерения «лист».'],
        itemCity: ['Город', 'Указываем город поставки', 'Этот запрос относится к одному материалу.'],
        searchReady: ['Запрос', 'Запрос готов к поиску цен', 'Кнопка «Найти цены» готова. Поиск в записи не запускаем.']
    };
    // [time, action, optional focus: [from, until, x%, y%, width%, height%]]
    const tracks = {
        'crm-report-focus': [[0,'photo',[.5,2.55,5,37,23,25]],[2.65,'photoOpen']],
        'crm-report-focus-mobile': [[0,'photo',[.4,2.5,10,42,39,16]],[2.6,'photoOpen']],
        'crm-report': [[0,'journal',[.6,2.4,51,17,8,7]],[3,'report',[3.3,4.15,85,67,12,6]],[5,'photo',[5.2,7.7,21,68,9,10]],[8,'photoOpen'],[11,'photoReturned']],
        'crm-report-mobile': [[0,'journal',[.7,2.3,5,22,86,7]],[3,'report',[3.6,4.2,6,46,87,7]],[5.1,'photo'],[8.5,'photoOpen'],[11.6,'photoReturned']],
        'crm-estimate': [[0,'work',[.6,2.5,28,17,8,7]],[5.1,'quantity',[5.8,9,29,54,42,9]],[10.2,'quantitySaved',[10.5,12.9,52,77,28,7]]],
        'crm-estimate-mobile': [[0,'work',[.7,2,5,11,87,8]],[5,'quantity',[5.2,8.8,5,67,91,8]],[9.8,'quantitySaved',[10.1,12.3,12,48,71,20]]],
        'crm-task': [[0,'task',[4.1,5.65,83,33,13,7]],[6,'taskFill',[7.7,10.3,30,34,45,8]],[16.7,'taskSaved']],
        'crm-task-mobile': [[0,'task',[3.2,4.4,9,49,80,7]],[5.2,'taskFill',[6,9.4,8,24,80,7]],[17,'taskSaved',[18.6,20.2,7,46,86,34]]],
        'crm-result': [[0,'bill',[3.1,4.15,80,35,17,7]],[5.2,'billFill',[6.2,9,15,34,70,9]],[19.9,'billSaved',[20.5,21.8,20,84,40,9]]],
        'crm-result-mobile': [[0,'bill',[3.7,4.9,8,47,81,7]],[5.8,'billFill',[7.2,10.1,9,20,79,7]],[22.8,'billSaved',[23.8,24.6,10,24,80,10]]],
        'bot-estimate-focus': [[0,'parse',[.2,1.95,4,59,92,9]],[2.05,'processing'],[8.1,'rows',[9.5,13.9,3,33,93,57]]],
        'bot-estimate-focus-mobile': [[0,'parse',[.2,1.8,6,51,88,9]],[1.9,'processing'],[6.7,'rows',[8.5,12.2,6,45,89,46]]],
        'bot-estimate': [[0,'file',[.6,3.4,3,30,22,7]],[6.4,'parse',[6.4,7.9,84,30,14,7]],[8.1,'processing'],[16.8,'rows',[17.5,21,2,72,96,26]]],
        'bot-estimate-mobile': [[0,'file',[.6,3.3,6,34,87,8]],[5.9,'parse',[6,6.9,6,51,88,9]],[7,'processing'],[13.4,'rows',[14.5,17.3,4,86,92,13]]],
        'bot-review': [[0,'review'],[3.1,'correction',[4,9.1,3,40,25,8]],[14.8,'correctionSaved',[15,18.3,2,82,45,6]]],
        'bot-review-mobile': [[0,'review'],[3.1,'correction',[4.4,7.8,6,56,87,9]],[14,'correctionSaved',[14.4,17.3,6,64,89,8]]],
        'bot-market': [[0,'city',[.4,4.8,70,43,19,6]],[5,'marketReady',[5.5,9.5,2,57,42,5]]],
        'bot-market-mobile': [[0,'city',[.4,3.1,5,78,65,7]],[4.5,'marketReady',[5.2,9.2,5,41,88,6]]],
        'bot-export': [[0,'export',[.6,2.5,80,29,12,6]],[2.8,'project',[2.9,4.6,50,41,46,6]],[5,'importReady',[5.3,9.8,84,54,12,6]]],
        'bot-export-mobile': [[0,'export',[.5,2.4,38,43,41,7]],[2.7,'project',[2.9,4.1,6,62,81,7]],[4.4,'importReady',[4.5,6.7,51,78,38,8]]],
        'bot-tenders': [[0,'tenders',[.2,1.5,85,8,13,7]],[1.7,'tenderCriteria',[2,6.2,26,40,48,26]]],
        'bot-tenders-mobile': [[0,'tenders',[.2,1.4,57,11,40,8]],[1.6,'tenderCriteria',[1.9,5.9,7,48,86,34]]],
        'bot-research': [[0,'item',[.5,4.7,7,28,54,23]],[4.8,'itemCity',[5.2,7.1,60,28,33,7]],[7.6,'searchReady',[8,11.8,59,44,13,7]]],
        'bot-research-mobile': [[0,'item',[.5,4.6,4,39,90,26]],[4.8,'itemCity',[5.1,5.8,5,67,89,7]],[8.7,'searchReady',[9,11.7,5,89,89,7]]]
    };

    function create({video, screen, title, description, host}) {
        const originalTitle = title.textContent, originalDescription = description.textContent;
        const steps = document.createElement('div');
        steps.className = 'tour-steps';
        steps.setAttribute('role', 'group');
        steps.setAttribute('aria-label', 'Перейти к шагу записи');
        steps.hidden = true;
        host.append(steps);
        const target = document.createElement('div');
        target.className = 'tour-target';
        target.setAttribute('aria-hidden', 'true');
        target.hidden = true;
        const marker = document.createElement('span');
        target.append(marker);
        screen.append(target);
        let source = '', track = [], buttons = [], active = -1, shown = false;

        const position = () => {
            const cue = track[active], focus = cue?.[2], time = video.currentTime;
            target.hidden = !shown || video.seeking || !focus || time < focus[0] || time >= focus[1];
            if (target.hidden) return;
            const width = screen.clientWidth, height = screen.clientHeight;
            const ratio = video.videoWidth / video.videoHeight;
            if (!width || !height || !Number.isFinite(ratio)) { target.hidden = true; return; }
            const w = Math.min(width, height * ratio), h = w / ratio;
            const [, , x, y, rw, rh] = focus;
            const left = (width-w)/2+w*x/100, top = (height-h)/2+h*y/100;
            const tw = w*rw/100, th = h*rh/100;
            target.style.left = `${left}px`;
            target.style.top = `${top}px`;
            target.style.width = `${tw}px`;
            target.style.height = `${th}px`;
            // Keep the number outside the highlighted control and inside the player.
            // A target near the recording edge may have no room to its left.
            const centered = Math.max(0, Math.min(tw/2-12, width-left-27));
            let labelLeft = -32, labelTop = Math.max(0,th/2-12);
            marker.hidden = false;
            if (left < 32) {
                labelLeft = centered;
                if (top >= 32) labelTop = -32;
                else if (top+th+35 <= height) labelTop = th+5;
                else if (left+tw+35 <= width) { labelLeft = tw+5; labelTop = Math.max(0,th/2-12); }
                else marker.hidden = true;
            }
            marker.style.left = `${labelLeft}px`;
            marker.style.top = `${labelTop}px`;
            marker.textContent = String(active + 1);
        };
        const update = () => {
            if (!shown) return;
            // Decoders may resolve a seek a fraction of a frame before its timestamp.
            const next = Math.max(0, track.findLastIndex(cue => cue[0] <= video.currentTime + 0.025));
            if (next !== active) {
                active = next;
                const [, action] = track[active], [, heading, note] = actions[action];
                title.textContent = heading;
                description.textContent = note;
                buttons.forEach((button, index) => button.setAttribute('aria-current', index === active ? 'step' : 'false'));
                const button = buttons[active];
                if (steps.scrollWidth > steps.clientWidth) {
                    if (button.offsetLeft < steps.scrollLeft) steps.scrollLeft = button.offsetLeft;
                    else if (button.offsetLeft + button.offsetWidth > steps.scrollLeft + steps.clientWidth) {
                        steps.scrollLeft = button.offsetLeft + button.offsetWidth - steps.clientWidth;
                    }
                }
            }
            position();
        };
        const show = () => {
            const nextSource = video.getAttribute('src') || '';
            if (source !== nextSource) {
                source = nextSource;
                const name = source.split('/').pop().split('?')[0].replace(/\.mp4$/, '');
                track = tracks[name] || [];
                buttons = track.map(([at, action], index) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = `${index + 1}. ${actions[action][0]}`;
                    button.setAttribute('aria-label', `Показать шаг ${index + 1}: ${actions[action][0]}`);
                    button.addEventListener('click', () => { video.currentTime = at; update(); });
                    return button;
                });
                steps.replaceChildren(...buttons);
            }
            shown = track.length > 0;
            if (!shown) { hide(); return; }
            steps.hidden = !shown;
            host.classList.toggle('is-guided', shown);
            active = -1;
            update();
        };
        const hide = () => {
            shown = false; active = -1;
            title.textContent = originalTitle;
            description.textContent = originalDescription;
            steps.hidden = true; target.hidden = true;
            host.classList.remove('is-guided');
        };
        ['timeupdate', 'seeked', 'seeking', 'loadedmetadata'].forEach(event => video.addEventListener(event, update));
        video.addEventListener('loadstart', hide);
        video.addEventListener('error', hide);
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(position) : null;
        observer?.observe(screen);
        return {show, hide, title: originalTitle, destroy() { observer?.disconnect(); steps.remove(); target.remove(); }};
    }
    window.PMBITourGuide = {create};
})();
