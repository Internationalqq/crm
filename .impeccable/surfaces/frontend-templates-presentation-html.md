---
version: 1
slug: "frontend-templates-presentation-html"
primary_target: "frontend/templates/presentation.html"
related_targets: ["frontend/assets/css/presentation.css","frontend/assets/js/presentation.js","frontend/assets/js/presentation-motion.js","frontend/assets/js/presentation-tours.js","frontend/assets/js/presentation-guide.js"]
---

# Презентация PM.bi — светлая продуктовая среда

Scope: только `/presentation`; mode Persuade. Последняя обратная связь: честное содержание уже подходит, но разрозненный строительный лендинг выглядит слабым и шаблонным. Пользователь явно выбрал https://attio.com/ как ориентир целостной среды и разрешил взять направление дизайна. Ранее выбраны code-first, светлая основа, фильм первым и настоящие записи. Назначение, аудитория и способ реализации уже согласованы; дополнительного выбора концепции не требуется.

## Текущая правка — понять действие в записи

Последняя обратная связь 18 сентября: «интуитивно не очень понятно даже с видосами че там нажимается … надписи может акцентее … цвета». Она важнее предыдущих verdict. Требуется объяснить конкретное действие и его результат: крупная синхронная подпись, синий прямоугольник вокруг целевого элемента и пронумерованные кнопки перемотки. 24 оригинальные дорожки имеют собственные тайминги; клики по шагам перематывают запись и продолжают её. Скорость 0.85 без кнопки паузы. На desktop пояснения рядом с записью ради крупного UI при прежней высоте; на телефоне шаги в одну прокручиваемую строку. Номер находится вне целевого прямоугольника. При уменьшении движения, Save Data и ошибке возвращаются прежние статичные подписи/постеры без ложного активного действия. Подготовка поиска и импорта явно отличается от выполненного результата. Пакет и проверки: `tmp/presentation-cues-20260918`.

## Текущая правка по пяти пользовательским кадрам

После Attio-выпуска пользователь показал, что демонстрации слишком высоки, и попросил компактность, автоматическую смену Руководитель → Прораб → Заказчик, правильное название AutoBot со знакомой иллюстрацией, выравнивание планов и FAQ. Это refinement внутри принятой среды. Пользовательские кадры важнее прежнего ship-verdict. Сценарий и результат должны помещаться в доступную высоту окна: viewport-bounded плеер с компактным рейлом, горизонтальная лента на узких экранах, дополнительный текст в «О сценарии», увеличение сохраняет исходные записи. Роли меняются каждые 5 секунд одним существующим таймером с видимым прогрессом; ручной выбор продолжает цикл. Reduced motion и Save Data сохраняют ручное управление. Иллюстрация AutoBot переиспользована без изменения из frontend/assets/images/autobot-construction-ai.webp и не заменяет настоящие записи. Планы: одинаковые отступы, описание и действие слева; FAQ: заголовок над единым списком.

Матрица текущей проверки: 1280×720, 390×844, 768×1024, 1440×656 (короткое окно/масштаб), 1760×820. Артефакты: tmp/presentation-compact-20260918. Не требуем чтения мелких значений записи в компактном обзоре: для них доступен полный экран записи через «Увеличить». Не уменьшать HTML-подписи ниже 16px и не обрезать видео.

Текущий finish: независимая layout-оценка завершена, но fresh reviewer/documenter остановлены по лимиту сервиса. Основной агент завершил документирование и scoped degraded review по 30 сохранённым captures и тестам; disposition ship относится к этой самопроверке, независимым одобрением не является. DESIGN.md и design.json согласованы с текущим кодом. Отчёт: tmp/presentation-compact-20260918/finish-review.md.

## Direction contract

THESIS: стройка перед глазами благодаря единой системе. Первый экран сохраняет строительное видео и точный заголовок, но становится собранной центральной композицией внутри общей рамки страницы.

OWN-WORLD: светлая среда просмотра проекта. Attio задаёт уровень сборки: белый/холодный нейтральный фон, тонкие конструктивные разделители, плотный Golos Text, мягкие края рабочих кадров, синий только для действий/выбранного состояния. Никаких чужих логотипов, скопированных интерфейсов, шумовых текстур, значков ради декора или тёмных секций.

STORY: фильм → действия CRM → Автобот → роли → форматы и внедрение → явно будущие возможности → FAQ → открытие PM.bi. Контент и все 20 реальных записей сохраняются. На компьютере главы становятся боковой навигацией общей рабочей сцены, экран и подпись связаны; на меньших размерах навигация над записью. Фотоотчёт остаётся первым. Примеры, планы и ограничения честно подписаны.

FIRST VIEWPORT: навигация высотой около 76px, центрированный крупный заголовок, короткое описание и одна главная кнопка. Затем широкий строительный фильм с прямым горизонтом в светлом поле; на телефоне используется существующий portrait asset. Общие края и разделители связывают первый экран с продуктом ниже. Никакой прежней белой угловой накладки и синей второй строки, никаких декоративных KPI.

FORM: user-pinned Attio-like product environment, translated to a construction project review studio. New seed `687c7f0b` assigns grounded direction 3 (model/project review studio); the explicit Attio pin owns palette, typography, composition and control vocabulary. Previous documentary seed `6078377e` is historical, not current visual authority. Material families considered: software workspace, drawing legend, review studio, architectural catalogue, site journal, planning room, documentary walkthrough. The hero footage and authentic product material remain; their surrounding visual grammar is replaced.

SIGNATURE: selection in the chapter rail updates the actual recording and a fine progress track; the working frame settles through a short clipped reveal. Automatic continuation, keyboard and enlarged view remain. The page itself does not hijack scrolling. Reduced-motion/Save Data retain static/manual product views; the hero follows its separately approved continuous-film policy.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. Inspect one desktop/tablet/mobile batch, correct and confirm once. Run detector once, then fresh independent review with user criticism and Attio captures; update DESIGN.md and sidecar. Verify 390/768/1280/1440, scenarios, stable height, keyboard, modal, preferences, no-JS, contrast and loading. Commit/push/deploy with rollback; no working database or core CRM changes.

## Reference and quality bar

Read-only Attio captures: `tmp/presentation-attio-20260918/attio-hero.png`, `attio-2100.png`, `attio-3400.png`, `attio-mobile.png`. They are craft references, not an approved comp and never shipping assets. Benchmark: one consistent page grid; deliberate scale change between display and product; selected states apparent before animation; genuinely useful application footage; a complete lower page in the same system. Risk: a product frame can shrink recorded UI; retain enlargement, full portrait sources and readable external captions.

The six dealt challengers were considered as PM.bi carriers and declined against the explicit reference on both audience identification and product clarity: print annual credits would distract from operation; spy dossier implies covert work; silk chord controls invent a model; kiln states invent physical outcomes; teletext harms modern app legibility; fluid simulation has no truthful data mechanism. Kept discipline, not motifs: annual alignment; dossier action/state coupling; silk responsive continuity; kiln explicit intermediate states; teletext predictable controls; fluid localised motion cost. No stamps, reticles, material simulations or decorative grids are imported.

## Finish correction

The fresh independent review accepted the new visual system, and requested stronger opening product evidence plus current design documentation. The first CRM and AutoBot chapters now use four additional authentic recordings at focused desktop/phone viewports. Their fallback posters come from the actual opened photograph and parsed rows. All 20 original full-context recordings remain; enlargement uses the original sources. This is a proof-framing correction, not a new visual direction. The reviewer scores these named fixes after recapture; no second detector.

Finish review: the fresh full review accepted the visual direction; the follow-up scored both named fixes (current documentation and action-focused proof) resolved, remaining clear, disposition ship. The final verdict covers those fixes. DESIGN.md and design.json were synchronized and validated. Reports: `tmp/presentation-attio-20260918/finish-review-initial.md` and `finish-review.md`.
