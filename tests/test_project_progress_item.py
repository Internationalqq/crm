from __future__ import annotations

import unittest
from http import HTTPStatus

import test_project_section_bulk_complete as fixtures


class ProjectProgressItemTests(unittest.TestCase):
    # Reuse the isolated database fixture, without inheriting its test cases.
    setUp = fixtures.ProjectSectionBulkCompleteTests.setUp
    tearDown = fixtures.ProjectSectionBulkCompleteTests.tearDown
    item_state = fixtures.ProjectSectionBulkCompleteTests.item_state

    def call(self, payload, user=None):
        handler = fixtures.FakeBulkCompleteHandler(user or self.admin, payload)
        fixtures.schedule_tasks.api_update_estimate_item_completion(
            handler, f'/api/projects/{self.project_id}/progress-item')
        return handler

    def test_physical_quantity_round_trip_and_repeat_do_not_create_operations(self):
        with fixtures.server.db() as con:
            con.execute("UPDATE estimate_items SET planned_qty = 2.56, unit = '100 м2' WHERE id = ?", (self.work_id,))
            stock_before = con.execute('SELECT COUNT(*) FROM stock_moves').fetchone()[0]
            logs_before = con.execute('SELECT COUNT(*) FROM daily_logs').fetchone()[0]
            con.commit()
        for _ in range(2):
            response = self.call({'itemId': self.work_id, 'actualQty': '128,5'})
            self.assertEqual(response.status, HTTPStatus.OK)
            self.assertEqual(self.item_state(self.work_id)[:2], (0, 128.5))
        with fixtures.server.db() as con:
            self.assertEqual(con.execute('SELECT COUNT(*) FROM stock_moves').fetchone()[0], stock_before)
            self.assertEqual(con.execute('SELECT COUNT(*) FROM daily_logs').fetchone()[0], logs_before)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'update_progress_item'").fetchone()[0], 1)
        self.call({'itemId': self.work_id, 'completed': True})
        self.assertEqual(self.item_state(self.work_id)[:2], (1, 256))
        self.call({'itemId': self.work_id, 'actualQty': 0, 'completed': True})
        self.assertEqual(self.item_state(self.work_id)[:2], (0, 0))

    def test_bad_numbers_leave_saved_quantity_unchanged(self):
        self.call({'itemId': self.work_id, 'actualQty': 3})
        for value in ['oops', 'NaN', 'Infinity', float('-inf'), -1, True, {}]:
            with self.subTest(value=value):
                result = self.call({'itemId': self.work_id, 'actualQty': value})
                self.assertEqual(result.status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(self.item_state(self.work_id)[:2], (0, 3))

    def test_explicit_missing_foreign_deleted_ids_do_not_fall_back_to_title(self):
        for item_id in [999999, self.foreign_work_id, self.completed_work_id]:
            if item_id == self.completed_work_id:
                with fixtures.server.db() as con:
                    con.execute('UPDATE estimate_items SET is_deleted = 1 WHERE id = ?', (item_id,))
                    con.commit()
            result = self.call({'itemId': item_id, 'title': 'Work A', 'actualQty': 10})
            self.assertEqual(result.status, HTTPStatus.NOT_FOUND)
            self.assertEqual(self.item_state(self.work_id)[:2], (0, 0))

    def test_legacy_title_lookup_and_material_quantity_remain_supported(self):
        result = self.call({'title': 'Work A', 'kind': 'work', 'unit': 'unit', 'actualQty': 4})
        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertEqual(self.item_state(self.work_id)[:2], (0, 4))
        result = self.call({'itemId': self.material_id, 'kind': 'material', 'actualQty': 2})
        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertEqual(self.item_state(self.material_id)[:2], (0, 2))

    def test_schedule_permission_is_enforced_on_server(self):
        for role in ['guest', 'customer', 'supplier']:
            user = {'id': self.admin_id, 'role': role, 'permissions': {'modules': [], 'projects': 'view'}}
            self.assertEqual(self.call({'itemId': self.work_id, 'actualQty': 5}, user).status, HTTPStatus.FORBIDDEN)
        self.assertEqual(self.item_state(self.work_id)[:2], (0, 0))

    def test_bulk_and_single_completion_store_the_same_physical_quantity(self):
        with fixtures.server.db() as con:
            con.execute("UPDATE estimate_items SET planned_qty = 2.56, unit = '100 м2' WHERE id IN (?, ?)", (self.work_id, self.material_id))
            con.commit()
        for kind, item_id in [('work', self.work_id), ('material', self.material_id)]:
            for _ in range(2):
                handler = fixtures.FakeBulkCompleteHandler(self.admin, {'itemKind': kind, 'itemIds': [item_id], 'completed': True})
                fixtures.schedule_tasks.api_project_section_bulk_complete(handler, f'/api/projects/{self.project_id}/sections/Section%20A/bulk-complete')
                self.assertEqual(handler.status, HTTPStatus.OK)
                self.assertEqual(self.item_state(item_id)[:2], (1, 256))
            self.call({'itemId': item_id, 'actualQty': 128})
            self.assertEqual(self.item_state(item_id)[:2], (0, 128))

    def test_purchaser_can_manage_materials_but_cannot_disguise_work_as_material(self):
        user = {'id': self.admin_id, 'role': 'purchaser', 'permissions': fixtures.server.default_permissions_for_role('purchaser')}
        self.assertEqual(self.call({'itemId': self.material_id, 'actualQty': 2}, user).status, HTTPStatus.OK)
        self.assertEqual(self.call({'itemId': self.work_id, 'kind': 'material', 'actualQty': 2}, user).status, HTTPStatus.FORBIDDEN)
        for kind, item_id, expected in [('material', self.material_id, HTTPStatus.OK), ('work', self.work_id, HTTPStatus.FORBIDDEN)]:
            handler = fixtures.FakeBulkCompleteHandler(user, {'itemKind': kind, 'itemIds': [item_id], 'completed': True})
            fixtures.schedule_tasks.api_project_section_bulk_complete(handler, f'/api/projects/{self.project_id}/sections/Section%20A/bulk-complete')
            self.assertEqual(handler.status, expected)


if __name__ == '__main__':
    unittest.main()
