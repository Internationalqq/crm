---
version: 1
slug: "frontend-templates-presentation-html"
primary_target: "frontend/templates/presentation.html"
related_targets: ["frontend/assets/css/presentation.css","frontend/assets/js/presentation.js","frontend/assets/js/presentation-motion.js","frontend/assets/js/presentation-autobot.js"]
---

# Презентация PM.bi

Scope: только `/presentation` и её ресурсы. Mode: Persuade. Пользователь подтвердил аудиторию, задачу продажи, светлую основу, Turner как ориентир, видео и последовательность CRM; выбрал code-first. Концепция и реализация делегированы явным «начни с короткого объяснения … затем реализуй»; повторный выбор эстетики не требуется.

## Direction contract

THESIS: «Стройка перед глазами» с видео всегда открывает страницу. Ниже демонстрация начинается с фотоотчёта: сначала видимый результат работы, затем смета, задача и итог.

OWN-WORLD: белая плоскость, графитовый Golos Text, один насыщенный синий акцент; прямоугольные кадры и спокойные открытые строки. Никакого затемнённого сайдбара или мелких надписей.

STORY: строительный фильм знакомит с PM.bi, далее фотоотчёт/смета/задача/результат повторяются по кругу. Фотографии, роли, Автобот, варианты внедрения и прямые ссылки в CRM сохраняются. Условные данные и будущие возможности обозначены.

FIRST VIEWPORT: светлая навигация, крупный «Стройка перед глазами», назначение PM.bi и широкий строительный фильм с главной кнопкой к демонстрации. На телефоне заголовок, видео и действие идут последовательно. Следующий блок: «От сметы до результата», первая и самая левая вкладка «Фотоотчёт», затем «Смета», «Задача», «Результат». Паузы, play/replay-кнопки удалены по прямому указанию пользователя; видео и показ зациклены, выбор вкладки сбрасывает интервал и продолжает показ. Reduced motion оставляет сцены статичными, скрытая вкладка сохраняет ресурсы.

FORM: документальный монтаж, позиция 6 из семи культурных источников (архитектурное портфолио, штабной стенд, проектная мастерская, сметная ведомость, строительный журнал, документальный монтаж, диспетчерский календарь); seed `6078377e`. Пин пользователя Turner/light/code-first определяет исполнение.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Considered counterpoints

Все шесть catalog challengers declined по узнаванию аудитории и ясности строительной CRM: darkroom — усиливаем непрерывность демонстрации; HyperCard — явные переходы сцен; zoo map — ясное главное действие; Bauhaus — крупный масштаб и точное выравнивание; cloud quarry — пространственная иерархия белых плоскостей; chromatophore — состояние считывается до анимации. Их материалы, декоративные мотивы и палитры не переносятся. Подтверждённый brief имеет приоритет.

## Verification and boundaries

## Motion extension — 18 September

Refinement of the existing documentary world, not a replacement. References inspected: user's WhisperLocal (portfolio-two-landings-0918.round-earth-5349.chatgpt.site) and 1C Career AI (tish-architecture-0918.round-earth-5349.chatgpt.site), located in «Собрать портфолио разработчика». Their useful mechanism is visible input → action → result, automatic looping, a demonstrative cursor, and flying content. Their palettes and lettering are not imported.

Focal moment: AutoBot turns a flying estimate document into structured rows, opens the original line for human verification, then shows confirmed positions in an illustrative project. Four accessible stages, automatic progression after manual selection, no pause/replay controls. This is a labelled interactive illustration of the workflow, not a recording of a live account. An exportable short GIF may be supplied from the same demo. Keep source and human confirmation explicit; no invented prices, processing-time claims or real project data.

Continuity: rows enter together when the existing CRM panels change. Photo report remains first/leftmost inside the workflow, never over the hero film. Feedback: source disclosure, next-step buttons, role/plan changes and FAQ expansion. Budget: plain CSS/JS, no animation framework or remote runtime, transform/mask animations confined to the relevant region; offscreen/hidden demos stop consuming frames, reduced-motion/Save-Data keep manual stages readable. Default content remains available without JS. Test 320/390/768/1280, all four AutoBot states, manual/keyboard/automatic continuation, source disclosure and no-JS. Retain production release/rollback discipline.

## Role scenes and lower-page refinement — 18 September

Latest user feedback explicitly removes the floating partition photo-report from the hero. Preserve the first video, typography, light palette and previous functioning demos. Give every role a distinct licensed documentary photo: project discussion, tablet on site, on-site inspection. Couple image and CRM example into an automatic three-role sequence (8 seconds per scene), with manual selection/keyboard continuing the cycle and a stable panel height. Photo reveal and financial progress are continuity, not unrelated entrance effects. No pause control; reduced motion/Save-Data/hidden or offscreen regions conserve motion. Never move keyboard focus on automatic changes.

Below: retain the three formats and real CRM links; add a photographed onboarding sequence with native disclosures explaining object → access → first report. Replace the static future list with manually selected concept examples and revealable outcomes. Clearly mark all future scenarios as plans and all numbers as illustrative. Existing AutoBot and GIF remain intact. Observable acceptance: removed hero overlay; all three photographs visible in their role; a repeatable cycle after click/keyboard; useful lower disclosures and concept tabs; no missing media, overflow, API calls or motion under reduced preferences at 320/390/768/1280.

Finish evidence: fresh independent review opened all 18 supplied captures and accepted scoped UI fidelity and craft ceiling; its sole material fix was stale documentation. The documenter synchronized DESIGN.md and design.json after the last UI edit while preserving primitives. The original five-section review and exclusions are preserved in `tmp/presentation-roles-20260918/finish-review-initial.md`. Persistence-only confirmation closed the scored fix with **ship**, remaining clear, in `tmp/presentation-roles-20260918/finish-review.md`; the UI is unchanged from the accepted capture set. This is the scoped refinement review, not a new visual review of unchanged CRM/workflow/AutoBot states or production.

390/768/1280 и320, роли и варианты внедрения, клавиатура, reduced motion для сцен, no-JS, видео без остановки при scroll, отсутствие пауз/скрытая вкладка, ошибка/запрет видео, мобильный ресурс. Основная CRM и БД сохраняются. Источники: Turner, Snøhetta, Fieldwire, Buildots; ссылки и screenshots в tmp. Mixkit и Pexels только с проверенной коммерческой лицензией. Новые конверсии и контакты не выдумываются. Уточнение от 17 сентября имеет приоритет над прежним первым экраном и формой.
