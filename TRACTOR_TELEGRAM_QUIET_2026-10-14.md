# Тихий Telegram трактора — 14 октября 2026

Исходный HEAD8a33eed, tracked diff чистый. Пользователь просит убрать Interrupting current task/iteration, Approved permanently by..., Working/terminal из беседы тракторного бота. Учёт/CRM не меняется.

Причины: busy ack — env HERMES_GATEWAY_BUSY_ACK_ENABLED (отключение не меняет обработку входящего); heartbeat — display.platforms.telegram.long_running_notifications; iteration — busy_ack_detail. У tractor глобально long_running_notifications/busy_ack_detail=true, платформенные overrides не заданы. Approved permanently — Telegram adapter напрямую редактирует временный запрос разрешения после решения, отдельного штатного display-переключателя нет.

Решение: profiletractor quiet overrides tool_progress=off, long_running_notifications=false, busy_ack_detail=false, interim_assistant_messages=false, show_reasoning=false, streaming=false. Private.env задаёт BUSY_ACK_ENABLED=false. Для результата разрешения опциональный env HERMES_TELEGRAM_APPROVAL_RESULT_ENABLED=false; маленький патч adapter (deploy/hermes_telegram_quiet.py) удаляет временный prompt после принятого решения вместо публикации английского служебного результата. Проверка пользователя/сам запрос разрешения/resolve_gateway_approval неизменны. При сбое удаления снимаются кнопки; решение не теряется. Другие профили по умолчанию сохраняют поведение. Патч повторяемый; несовпадение блока при новой Hermesверсии останавливает применение.

Backupconfig/env/adapter в profile/backups/tractor-quiet-20261014, секреты в отчёт/Git не попадают. Runtime изменение+restart толькоtractor при active_agents0; никаких тестовых сообщений в рабочую беседу. Проверки:4значимых сценария optin/default/failure/repeat/versiondrift, nativeTelegramapprovaltests, значения resolver/env и подпись работающегоgateway. Отправленные ранее сообщения не удаляются; будущие служебные пузырьки выключаются.

## Выполнено

Установлено14октября: displayoverrides и оба envfalse толькоtractor, gateway перезапущен приactive_agents0, новыйPID55021, Telegramconnected/errornull. Реальный Hermesenvloader читает оба false; штатный displayresolver подтверждает off/false для progress/heartbeat/iteration/interim/streaming/reasoning. Код проверки не выводит токены. Другиепрофили не перезапускались и их настройки не менялись.

Патч установлен в /Users/egor/.hermes/hermes-agent/plugins/platforms/telegram/adapter.py. Native20TelegramapprovaltestsPASS: авторизация, решение и обработкаcallbackсохранены.4изолированных presentationtestsPASS: defaultповедение другихпрофилей, quietудалениевместопубликации, fallback при невозможностиудаления, повторпатча/несовместимаяверсия. Независимое ревьюship, P1/P2нет. ПолныйHermes/CRMнабор не запускался; новое живое одобрение в группе не имитировалось и правáудаления отдельным liveзапросом не проверялись. Fallback сохраняет решение при сбоеTelegramудаления.

Отправленные ранее служебные сообщения не трогали. Данныеучётатрактора/CRM не менялись. Откат: config.yaml/.env и telegram-adapter-before.py из profile/backups/tractor-quiet-20261014, restarttractor приidle. При обновленииHermes проверить сохранность optionalpatch; deployscript откажется патчить несовместимыйблок.
