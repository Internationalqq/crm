# Трактор: записывать сразу — 14 октября 2026

ИсходныйHEADcf139df, tracked diff чистый. Явноеуказаниепользователя: все сообщения трактора сразу вCRMкакесть, дополнительныевопросы не задерживают запись. Показанныйпример:13.10 Сергей11:00–17:00, объектКарабашГусиха; бот ошибочно записал0ч вdraft128 и спрашивалпро неуказанныеперерывы.

Решение: actionrecord сохраняет доступныеполя сразу воперационныйjournal (statusconfirmed), normalize сdraft=True оставляет missing0/null, но сохраняет типы/лимиты/allowlist/даты/права. Существующийstrictconfirm сохранён; нетфинансовыхпроводок. Флагneeds_clarification невето. Одинуказанныйclockinterval приотсутствующихчасах даётполнуюelapsedдлительность:11–17=6,9–19=10, бездогадокпрообед. С исходнымтекстом сохраняютсявсе остальныеподробности. Точнаядата/объект не выдумываются. Повторыsourceидемпотентны; повтородногочека сохранёнкакcancelledduplicate сссылкойнаoriginalID, безповторногоначисления/ручнойпроверки.

Планизмененияданных: backupSQLite/runtimeimage/tractorprofile; толькоentry128 сверить draft/revision1/source59/project10/date2026-10-13/hours0, записать6ч и описаниеисходногоинтервала, actionrecord соstableoperationkey. Оригиналfieldmessageне менять. Копия/повтор/FK/integrity, соседниетаблицыидентичны. Macoutbox толькоcachedresult связаннойдоставки128 обновитьstatusconfirmed, payloadэкстракции/sourceне менять.12.10 не приписывать этомуобъектубездоказательства.

Workflow/SOUL/AGENTS: сначала сохранить, затем коротко«Добавлено:13.10,Сергей,6ч,Карабаш—Гусиха». Не писатьчерновик/на проверку человеком, не спрашиватьпро неуказанныйобед. Существенныйдопвопрос необязателен и только после записи. Статусыqueuedневыдаватьзавыполненнуюдоставку. UIглавнаякнопкаrecord, layoutбезизменения; assetверсииобновлены.

Проверки: backendтракторповтор/частичность/clockinterval/duplicate/роль/financeisolation; pluginтранспорт; JScontract. Независимое ревью. Productionслойнад прежнимruntimeбезсменызависимостей и профильtractorприidle. Рабочиегруппы не засорятьсинтетическимипостами; остальныеагенты не менять.

ИзолированнаякопиярабочейБД:128→6ч/object10/confirmed, повторидентичен, соседниеданные/FK/integrityunchanged. Backend19PASS (10тракторсценариев+9fixture), plugin2PASS, JStractorPASS/router5PASS. ПолныйCRM suite не запускался. Независимыйreview обнаружилдваP2: устаревшийtoolописаниеблокировки и рискelapsedfallbackпри прямо указанномbreak. Toolописаниеисправлено; explicitbreak guard охватываетисходныйtext/transcript+description, sanitizedописание не обходитего. Приunknownhours+явномbreak исходник записываетсясразу, но backendнеподставляетложные6ч; агентможет вычислить часы появномуbreak вrawhours. Regression покрываетtext иvoice, записьнеблокируется.

## Выпуск и результат

Опубликован08d1e5c, Linuxcandidate19backendPASS, runtimeзависимостиидентичныпредыдущим. Productionentry128 записан6часов/project10/date2026-10-13/statusconfirmed; повторнеизменен, исходноеfieldmessage59 ивсясоседняяБД неизменны, integrity/FKok. Резерв /opt/crm-backups/tractor-direct-20261014/before.sqlite3 иcrm-crm:rollback-tractor-direct-20261014. Остальные записи/финансы/материалы не мигрировались.

Профильtractor: backup/SOUL/AGENTS/плагин/WORKFLOWобновленыприidle; source/extractionpayloadoutboxнеизменны, толькоcachedresult128 теперьconfirmed. ProductionAPI/UI: №1286чobject10,sourceсохранён, фильтрГусиха+октябрь/повторноеоткрытиекарточкиPASS, JSerrors0, attentiongateнет. Liveсинтетическихсообщений неотправляли; новыйреальныйпостпосленовойполитикиещёнеиспытан. Прежниеquietнастройкивсехагентовсохранены.

Независимоеfocusedreviewship послеисправленийP2, remainingblockersнет.19backend/2plugin/JStractor/router5PASS, полныйCRM suite не запускался. Пакетзавершён: допвопрос больше не являетсяусловиемсохранения, обязательнойручнойпроверки нет.
