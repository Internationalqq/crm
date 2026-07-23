# PM.bi — запуск и деплой

## Локальный запуск

Теперь рабочий запуск идёт через backend:

```powershell
python backend\server.py
```

Или двойным кликом:

```text
start-site.cmd
```

После запуска открой:

```text
http://127.0.0.1:8080/login
```

## Первый администратор

При первом запуске backend создаст:

```text
login: admin
```

Пароль будет в файле:

```text
data/INITIAL_ADMIN.txt
```

После входа и создания реальных пользователей этот файл лучше удалить.

## Важно про workers.dev

Просто загрузить папку `deploy` на workers.dev теперь недостаточно для настоящего продукта.

Папка `deploy` — это frontend.  
Backend `backend/server.py` должен где-то запускаться.

Основной новый интерфейс теперь открывается по адресам:

```text
/app/projects
/app/warehouse
/app/schedule
/app/chats
/app/users
/app/reports
```

Основная архитектура frontend теперь лежит в `frontend/`.

Варианты:

- локальный сервер для разработки;
- VPS;
- Docker;
- Render/Railway/Fly;
- позже Cloudflare Workers + D1, если хотим остаться в экосистеме Cloudflare.

## Что выгружать

Для полноценного backend-варианта нужно выгружать весь проект:

- `backend/`;
- `frontend/`;
- `deploy/robots.txt` и `deploy/_headers`, если они нужны для конкретного хостинга;
- `start-site.cmd` / команда запуска;
- документы проекта.

Папку `data/` не выгружать публично: там база и первичный пароль.
