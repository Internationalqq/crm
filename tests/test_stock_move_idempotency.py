from concurrent.futures import ThreadPoolExecutor
from http import HTTPStatus
import unittest

import test_stock_move_reversal as fixtures


class StockMoveIdempotencyTests(unittest.TestCase):
    setUp = fixtures.StockMoveReversalTests.setUp
    tearDown = fixtures.StockMoveReversalTests.tearDown
    material_state = fixtures.StockMoveReversalTests.material_state
    reverse = fixtures.StockMoveReversalTests.reverse

    def create(self, key='receipt-1', **changes):
        payload = {'estimate_item_id': self.material_id, 'move_type': 'receipt', 'qty': 10, 'price': 0, 'comment': 'Test receipt'}
        if key is not None:
            payload['idempotencyKey'] = key
        payload.update(changes)
        handler = fixtures.FakeStockMoveHandler(self.admin, payload)
        fixtures.server.PMBIHandler.api_create_stock_move(handler, f'/api/projects/{self.project_id}/stock-moves')
        return handler

    def test_receipt_use_reversal_and_replay_preserve_balance(self):
        receipt = self.create()
        self.assertEqual(receipt.status, HTTPStatus.CREATED)
        self.assertEqual(self.material_state()['stockBalanceQty'], 10)
        repeat = self.create()
        self.assertEqual(repeat.status, HTTPStatus.OK)
        self.assertEqual(repeat.response['id'], receipt.response['id'])
        use = self.create('use-1', move_type='use', qty=3)
        self.assertEqual(self.material_state()['stockBalanceQty'], 7)
        self.reverse(use.response['id'])
        self.assertEqual(self.material_state()['stockBalanceQty'], 10)
        # A retry of the original request after correction cannot reapply the use.
        self.assertEqual(self.create('use-1', move_type='use', qty=3).response['id'], use.response['id'])
        self.assertEqual(self.material_state()['stockBalanceQty'], 10)
        with fixtures.server.db() as con:
            self.assertEqual(con.execute('SELECT COUNT(*) FROM stock_moves WHERE project_id=?', (self.project_id,)).fetchone()[0], 5)

    def test_concurrent_retries_create_one_move(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.create('concurrent'), range(4)))
        self.assertEqual([r.status for r in results].count(HTTPStatus.CREATED), 1)
        self.assertEqual(len({r.response['id'] for r in results}), 1)
        self.assertEqual(self.material_state()['stockBalanceQty'], 10)

    def test_same_key_with_changed_content_is_a_conflict(self):
        self.create()
        for change in [{'qty':11}, {'move_type':'use'}, {'price':1}, {'comment':'Another delivery'}]:
            with self.subTest(change=change):
                self.assertEqual(self.create(**change).status, HTTPStatus.CONFLICT)
        self.assertEqual(self.material_state()['stockBalanceQty'], 10)

    def test_legacy_requests_without_key_still_create_distinct_deliveries(self):
        self.assertEqual(self.create(None).status, HTTPStatus.CREATED)
        self.assertEqual(self.create(None).status, HTTPStatus.CREATED)
        self.assertEqual(self.material_state()['stockBalanceQty'], 20)

    def test_nonfinite_values_and_deleted_items_do_not_change_stock(self):
        for change in [{'qty':float('nan')}, {'qty':float('inf')}, {'price':float('nan')}, {'price':float('inf')}]:
            self.assertEqual(self.create(**change).status, HTTPStatus.BAD_REQUEST)
        with fixtures.server.db() as con:
            con.execute('UPDATE estimate_items SET is_deleted=1 WHERE id=?', (self.material_id,))
            con.commit()
        self.assertEqual(self.create().status, HTTPStatus.BAD_REQUEST)


if __name__ == '__main__':
    unittest.main()
