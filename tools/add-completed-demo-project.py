from __future__ import annotations

import sqlite3
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "pmbi.sqlite3"
TITLE = "Коттедж GreenLine — завершённый проект"


def now_ts() -> int:
    return int(time.time())


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"База не найдена: {DB_PATH}. Сначала запусти python backend\\server.py")

    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        director = con.execute("SELECT id FROM users WHERE role = 'director' ORDER BY id LIMIT 1").fetchone()
        director_id = director["id"] if director else None

        existing = con.execute("SELECT id FROM projects WHERE title = ?", (TITLE,)).fetchone()
        if existing:
            project_id = int(existing["id"])
            con.execute(
                """
                UPDATE projects
                SET address = ?, client_name = ?, contract_no = ?, director_id = ?, status = 'Сдан заказчику',
                    progress = 100, budget = ?, paid = ?, spent = ?, started_at = ?, deadline_at = ?
                WHERE id = ?
                """,
                (
                    "Екатеринбург, КП GreenLine, участок 42",
                    "ИП Орлов Андрей Сергеевич",
                    "PM-2026-100",
                    director_id,
                    12_800_000,
                    12_800_000,
                    10_940_000,
                    "2026-03-01",
                    "2026-07-15",
                    project_id,
                ),
            )
        else:
            cur = con.execute(
                """
                INSERT INTO projects (title, address, client_name, contract_no, director_id, status, progress, budget, paid, spent, started_at, deadline_at, created_at)
                VALUES (?, ?, ?, ?, ?, 'Сдан заказчику', 100, ?, ?, ?, ?, ?, ?)
                """,
                (
                    TITLE,
                    "Екатеринбург, КП GreenLine, участок 42",
                    "ИП Орлов Андрей Сергеевич",
                    "PM-2026-100",
                    director_id,
                    12_800_000,
                    12_800_000,
                    10_940_000,
                    "2026-03-01",
                    "2026-07-15",
                    now_ts(),
                ),
            )
            project_id = int(cur.lastrowid)

        for table in (
            "stock_moves",
            "estimate_items",
            "work_stages",
            "tasks",
            "documents",
            "daily_logs",
            "chat_messages",
            "chats",
            "user_project_access",
        ):
            if table == "chat_messages":
                con.execute(
                    "DELETE FROM chat_messages WHERE chat_id IN (SELECT id FROM chats WHERE project_id = ?)",
                    (project_id,),
                )
            elif table == "user_project_access":
                con.execute("DELETE FROM user_project_access WHERE project_id = ?", (project_id,))
            elif table not in {"chat_messages"}:
                con.execute(f"DELETE FROM {table} WHERE project_id = ?", (project_id,))

        stages = [
            ("Подготовка участка", 1, "2026-03-01", "2026-03-08", "2026-03-01", "2026-03-07", 100, "Прораб", 0),
            ("Фундамент и ввод коммуникаций", 2, "2026-03-09", "2026-03-28", "2026-03-09", "2026-03-27", 100, "Прораб", 1),
            ("Коробка и кровля", 3, "2026-03-29", "2026-05-05", "2026-03-29", "2026-05-03", 100, "Прораб", 1),
            ("Инженерные сети", 4, "2026-05-06", "2026-06-02", "2026-05-06", "2026-06-01", 100, "Прораб", 1),
            ("Отделка и благоустройство", 5, "2026-06-03", "2026-07-08", "2026-06-03", "2026-07-06", 100, "Прораб", 1),
            ("Сдача, акты, передача ключей", 6, "2026-07-09", "2026-07-15", "2026-07-09", "2026-07-14", 100, "Директор", 0),
        ]
        con.executemany(
            """
            INSERT INTO work_stages (project_id, title, position, planned_start, planned_end, fact_start, fact_end, progress, responsible, depends_on_materials, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *stage, now_ts()) for stage in stages],
        )

        materials = [
            ("Бетон М300", "м³", 68, 6400, 68, 68, 68),
            ("Арматура А500С", "т", 7.4, 72500, 7.4, 7.4, 7.4),
            ("Газоблок D500", "м³", 142, 5300, 142, 142, 141),
            ("Кровельная металлочерепица", "м²", 236, 1180, 236, 236, 236),
            ("Кабель ВВГнг 3x2.5", "м", 980, 96, 980, 980, 940),
            ("Труба PEX 20", "м", 720, 145, 720, 720, 690),
            ("Радиаторы секционные", "шт", 18, 6400, 18, 18, 18),
            ("Керамогранит", "м²", 164, 1750, 164, 164, 160),
            ("Двери межкомнатные", "шт", 12, 14600, 12, 12, 12),
            ("Светильники", "шт", 46, 2800, 46, 46, 44),
        ]
        for title, unit, planned_qty, price, purchased_qty, received_qty, used_qty in materials:
            cur = con.execute(
                """
                INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price)
                VALUES (?, ?, ?, ?, ?)
                """,
                (project_id, title, unit, planned_qty, price),
            )
            item_id = int(cur.lastrowid)
            moves = [
                ("purchase", purchased_qty, price, "Закуплено по смете"),
                ("receipt", received_qty, price, "Поступило на объект"),
                ("use", used_qty, price, "Списано в производство"),
            ]
            con.executemany(
                """
                INSERT INTO stock_moves (project_id, estimate_item_id, move_type, qty, price, comment, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [(project_id, item_id, move_type, qty, price, comment, director_id, now_ts()) for move_type, qty, price, comment in moves],
            )

        tasks = [
            ("Передать финальный фотоотчёт заказчику", "Фотоотчёт готов и доступен заказчику в документах.", "done", "normal", "2026-07-14"),
            ("Подписать акт выполненных работ", "Акт подписан заказчиком и директором.", "done", "high", "2026-07-15"),
            ("Закрыть остатки склада", "Остатки сверены, неиспользованные материалы отмечены.", "done", "normal", "2026-07-15"),
            ("Передать ключи и комплект документации", "Ключи переданы, исполнительная документация загружена.", "done", "normal", "2026-07-15"),
        ]
        con.executemany(
            """
            INSERT INTO tasks (project_id, title, description, status, priority, due_at, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *task, director_id, now_ts()) for task in tasks],
        )

        docs = [
            ("Договор подряда PM-2026-100", "contract", "signed", 1),
            ("Акт выполненных работ — итоговый", "act", "signed", 1),
            ("Исполнительная документация", "file", "ready", 1),
            ("Финальная финансовая сводка", "finance", "internal", 0),
            ("Фотоотчёт: объект до / после", "photo_report", "ready", 1),
            ("Гарантийные обязательства", "file", "ready", 1),
        ]
        con.executemany(
            """
            INSERT INTO documents (project_id, title, doc_type, status, is_client_visible, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *doc, now_ts()) for doc in docs],
        )

        logs = [
            ("2026-03-07", "Подготовка участка завершена", "Участок очищен, выполнена разбивка осей, организованы временные подъезды и зона хранения материалов.", 4, "Нивелир, лазерный уровень", "", "Начать фундаментные работы.", 1),
            ("2026-03-27", "Фундамент готов к следующему этапу", "Заливка завершена, вводы коммуникаций подготовлены, геометрия проверена.", 8, "Бетононасос, вибратор", "", "Переход к коробке и кровле.", 1),
            ("2026-05-03", "Коробка и кровля закрыты", "Коробка собрана, кровля смонтирована, объект защищён от осадков.", 11, "Кран-манипулятор, леса", "", "Начать инженерные сети.", 1),
            ("2026-06-01", "Инженерные сети завершены", "Смонтированы электрика, отопление, водоснабжение и слаботочные линии. Проверка прошла без критичных замечаний.", 7, "Пресс-инструмент, тестер, тепловизор", "", "Переход к отделке.", 1),
            ("2026-07-06", "Отделка и благоустройство завершены", "Закончена чистовая отделка, установлены двери и светильники, выполнена уборка и подготовка к сдаче.", 9, "Плиткорез, шлифмашины, измерительный инструмент", "", "Подготовить акт и финальный фотоотчёт.", 1),
            ("2026-07-14", "Объект сдан заказчику", "Проведён финальный обход, замечания закрыты, акт подписан, ключи и документы переданы.", 3, "Планшет, комплект документации", "", "Проект переведён в архив выполненных работ.", 1),
        ]
        con.executemany(
            """
            INSERT INTO daily_logs (project_id, report_date, title, work_done, workers_count, equipment, blockers, next_steps, is_client_visible, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *log, director_id, now_ts()) for log in logs],
        )

        team_chat = con.execute(
            "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'team', 'Внутренний чат команды', ?)",
            (project_id, now_ts()),
        ).lastrowid
        client_chat = con.execute(
            "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'client', 'Чат с заказчиком', ?)",
            (project_id, now_ts()),
        ).lastrowid
        messages = [
            (team_chat, director_id, "Финальная маржа по объекту положительная, все документы закрыты. Можно использовать проект как образец заполнения CRM."),
            (team_chat, director_id, "Остатки склада сверены, критичных расхождений нет."),
            (client_chat, director_id, "Объект завершён и готов к передаче. Итоговый акт и фотоотчёт доступны в документах."),
            (client_chat, director_id, "Спасибо за работу. Все этапы закрыты раньше планового срока на один день."),
        ]
        con.executemany(
            "INSERT INTO chat_messages (chat_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
            [(chat_id, user_id, body, now_ts()) for chat_id, user_id, body in messages],
        )

        con.commit()
        print(f"Готовый проект добавлен/обновлён: {TITLE} (id={project_id})")
    finally:
        con.close()


if __name__ == "__main__":
    main()
