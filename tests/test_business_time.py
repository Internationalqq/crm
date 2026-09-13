from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

import business_time
from auth import public_viewer
from projects import project_status_label, serialize_project


class BusinessTimeTests(unittest.TestCase):
    def test_business_date_rolls_over_without_reimporting_module(self):
        instant = datetime(2026, 9, 12, 18, 59, tzinfo=timezone.utc)
        with mock.patch.dict('os.environ', {'PMBI_TZ_OFFSET_HOURS': '5'}):
            with mock.patch.object(business_time, 'datetime') as clock:
                clock.now.side_effect = lambda zone: instant.astimezone(zone)
                self.assertEqual(business_time.today_iso(), '2026-09-12')
                instant = datetime(2026, 9, 12, 19, 0, tzinfo=timezone.utc)
                self.assertEqual(business_time.today_iso(), '2026-09-13')

    def test_configured_timezone_does_not_follow_the_server_utc_date(self):
        instant = datetime(2026, 9, 12, 23, 0, tzinfo=timezone.utc)
        with mock.patch.dict('os.environ', {'PMBI_TZ_OFFSET_HOURS': '-3'}):
            with mock.patch.object(business_time, 'datetime') as clock:
                clock.now.side_effect = lambda zone: instant.astimezone(zone)
                self.assertEqual(business_time.today_iso(), '2026-09-12')


class ProjectStatusTests(unittest.TestCase):
    def test_imported_statuses_have_consistent_russian_labels(self):
        for value, expected in [
            ('active', 'В работе'), (' IN_PROGRESS ', 'В работе'),
            ('В работе', 'В работе'), ('paused', 'На паузе'),
            ('draft', 'Подготовка'), ('done', 'Завершен'),
            ('Завершён', 'Завершен'), ('Особый этап', 'Особый этап'),
        ]:
            with self.subTest(value=value):
                self.assertEqual(project_status_label(value), expected)

    def test_public_and_employee_responses_share_labels_without_changing_storage(self):
        row = {'id': 1, 'title': 'Объект', 'status': 'active', 'progress': 20, 'started_at': None}
        for user in [public_viewer(), {'id': 1, 'role': 'admin', 'roles': []}]:
            with self.subTest(role=user['role']):
                self.assertEqual(serialize_project(row, user, {})['status'], 'В работе')
                self.assertEqual(row['status'], 'active')


if __name__ == '__main__':
    unittest.main()
