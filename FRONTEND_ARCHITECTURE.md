# PM.bi — новая frontend-архитектура

## Почему меняем структуру

Старая папка `deploy/copy` — это сохранённая HTML-копия сайта.

Проблема:

- 127 файлов;
- около 679 МБ;
- в каждой странице повторяется хедер, сайдбар, стили и служебный мусор;
- имена файлов неудобные;
- править и масштабировать такую структуру тяжело.

## Новая структура

Основной frontend теперь лежит в:

```text
frontend/
```

Структура:

```text
frontend/
  templates/
    base.html       общий layout: шапка, сайдбар, контейнер
    login.html      страница входа
  pages/
    projects.html   объекты
    warehouse.html  склад и материалы
    schedule.html   график производства работ
    chats.html      чаты
    users.html      пользователи и роли
    reports.html    отчётность
  assets/
    app.css         общие стили
    app.js          общая логика frontend
    logo.png        логотип
```

## Как теперь работает

Backend `backend/server.py` отдаёт страницы:

- `/login`;
- `/app/projects`;
- `/app/warehouse`;
- `/app/schedule`;
- `/app/chats`;
- `/app/users`;
- `/app/reports`.

Он берёт:

- общий layout из `frontend/templates/base.html`;
- контент страницы из `frontend/pages/*.html`;
- стили/JS из `frontend/assets`.

То есть хедер и сайдбар больше не копируются в каждую страницу.

## Что со старой папкой deploy/copy

Она удалена из рабочей версии.

Причина:

- около 679 МБ веса;
- повторяющийся layout в каждом файле;
- неудобные имена;
- большое количество неиспользуемых сохранённых страниц.

Если понадобится посмотреть старую версию, её нужно хранить как reference-материал:

```text
reference/legacy-crm/
```

Импортировать старую папку или zip можно так:

```powershell
powershell -ExecutionPolicy Bypass -File tools\import-legacy-crm.ps1 -Source "C:\path\to\old-copy-or-zip"
```

После этого мы используем её как донор экранов, но рабочий frontend остаётся в `frontend/`.

## Главный принцип дальше

Новые разделы добавлять так:

1. создать маленький файл в `frontend/pages`;
2. добавить маршрут в `APP_PAGES` внутри `backend/server.py`;
3. если нужны данные — добавить API в backend;
4. frontend забирает данные через `frontend/assets/js/app.js`.

Никаких 30k строк HTML на страницу.
