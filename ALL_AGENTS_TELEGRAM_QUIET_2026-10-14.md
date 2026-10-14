# Тихий Telegram всех агентов — 14 октября 2026

Исходный HEAD1abbbdb, tracked diff чистый. По явному поручению пользователя политика тракторного бота распространена на ПТО и всех агентов: скрыть служебные Interrupting/Working/iteration/terminal и результаты решений в чате. Уточнение «лишние команды в целом» относится к техническим сообщениям бесед; обработка пользовательских команд и ответы по делу сохраняются.

ИнвентаризацияMac:18настроенныхпрофилей (default+17),15зарегистрированныхgatewayсервисов, активныхзаданий0. Telegramуbot1 ужеretrying, у двухapi_serverпрофилейdisconnected доизменения; не трактуем как регрессию тихогорежима.

Решение: существующий profileоптинpatchtelegramadapter сохраняется, env BUSY_ACK_ENABLED=false и APPROVAL_RESULT_ENABLED=false во всех18профилях. Толькоdisplay.platforms.telegram: tool_progressoff, long_runningnotifications/busy_ackdetail/interim/showreasoning/streaming/transcriptionecho/thinkingprogress/workingtimerfalse. Самиразрешения/права/CRM/модели/интеграции не меняются. Обработка входящегоbusytext сохраняется штатной, толькоуведомлениевыключено. Менюкоманд не удаляется по предположению.

Резерв каждогоconfig.yaml/.env в profile/backups/all-agents-quiet-20261014 (600). deploy/hermes_quiet_profiles.py повторяемый, остальныеполя/envсохраняет;18профилей проверяются resolver+envloader. Restartтолькоужеработающихзарегистрированныхgateway приactive_agents0; занятые не прерывать, неработающие профили не запускать. Затем проверить PID/platformerrors противbaseline.

ДвазначимыхpuretestsPASS: Telegram-onlyconfigпредставление/неизменностьправа-модель-chatallowlist-другойplatform, повторenv/сохранениедругихпеременных. ПервичныйWinзапуск обнаружил отсутствиеPyYAML в изолированномтестовомruntime; импорт перенесён в apply_profile (MacPyYAML ужеесть), повторPASS; новойзависимости неустанавливалось. ПолныйCRM/Hermessuite не запускается для profileнастроек;20nativeapproval+4presentationtests уже проверяли неизменностьрешений в исходномпакете.

## Выполнено

Применено18профилямMac. На записи всеработающиеgatewayбылиidle, безпрерываниязаданий.15зарегистрированныхсервисов включают2api-only со stalegateway_state/мертвымиPID; реальноработали13 и все13перезапущены, exit0.5неработающихпрофилей не запускали.

Verification18/18: штатныйdisplayresolver и Hermesenvloader возвращают off/false для нужныхуведомлений. ПТОPID58680, финансист58623, трактор58710 иdefault58744connected.12Telegramconnected, bot1retrying какдоизменения. Никакойновойсетевойошибки в этомпакете не установлено. Сравнение YAMLдопосле заисключениемdisplay.platforms.telegram полностьюидентично у18профилей. Файлы backups/all-agents-quiet-20261014/config.yaml/.env защищены600; manifestverification/restarts в defaultbackupsтакже сохранены, секретынеопубликованы.

Независимоеfocusedreviewship, P1/P2нет. ДваизолированныхтестаPASS. Новыйживойcallback/длинныйзапуск во всех18профилях не имитировался;20nativeapproval+4presentationпроверки предыдущегопакета сохраняют покрытие соответствующегопатча. ПолныйHermes/CRM suite не запускался, данныеCRM не менялись. Отправленныестарыесообщения не удалялись. Откатнастроек — config.yaml/.env из backupданногопрофиля иrestartidlegateway.
