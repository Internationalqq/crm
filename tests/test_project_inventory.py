import json
import unittest

import test_field_intake as fixture
import finance
import field_intake as field
from warehouse_control import build_warehouse_control


class ProjectInventoryTests(unittest.TestCase):
    setUp=fixture.FieldTests.setUp
    tearDown=fixture.FieldTests.tearDown
    call=fixture.FieldTests.call
    source=fixture.FieldTests.source
    draft=fixture.FieldTests.draft
    apply=fixture.FieldTests.apply

    def purchase(self, qty='2'):
        quote='Купили перфораторы для объекта'
        item=self.draft(self.source(quote,mid='purchase'),'purchase',fact_quote=quote,
                        lines=[dict(title='Перфоратор',unit='шт',qty=qty,item_type='tool')])
        self.assertEqual(self.apply(item).status,200)
        return item

    def test_purchase_delivery_partial_repeat_and_reopen(self):
        purchase=self.purchase()
        with finance.db() as con:
            self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],0)
            inventory=build_warehouse_control(con,self.pid)['inventory']
            self.assertEqual((inventory[0]['status'],inventory[0]['quantity']),('purchased',2))
        quote='Привезли один перфоратор на объект'
        receipt=self.draft(self.source(quote,mid='delivery'),fact_quote=quote,purchase_event_id=purchase['id'],
                           lines=[dict(title='Перфоратор',unit='шт',qty='1',item_type='tool')])
        self.assertEqual(self.apply(receipt).status,200)
        self.assertEqual(self.apply(receipt).status,200)
        with finance.db() as con:
            field.ensure_schema(con)
            inventory=build_warehouse_control(con,self.pid)['inventory']
            self.assertEqual({i['status']:i['quantity'] for i in inventory},{'purchased':1,'on_site':1})
            self.assertEqual(field.balances(con,[self.pid])[0]['item_type'],'tool')
            self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],1)
            self.assertEqual(con.execute('SELECT count(*) FROM finance_entries').fetchone()[0],0)
        excess=self.draft(self.source(quote,mid='excess'),fact_quote=quote,purchase_event_id=purchase['id'],
                          lines=[dict(title='Перфоратор',unit='шт',qty='2',item_type='tool')])
        self.assertEqual(self.apply(excess).response['error'],'receipt_exceeds_purchase')

    def test_tool_and_material_same_name_do_not_merge(self):
        quote='Привезли крепёж на объект'
        item=self.draft(self.source(quote),fact_quote=quote,lines=[
            dict(title='Крепёж',unit='шт',qty='1',item_type='tool'),
            dict(title='Крепёж',unit='шт',qty='3',item_type='material')])
        self.assertEqual(self.apply(item).status,200)
        with finance.db() as con:
            self.assertEqual({r['item_type']:r['qty'] for r in field.balances(con,[self.pid])},{'tool':1,'material':3})

    def test_central_tools_keep_type_and_existing_project_tools_are_classified(self):
        quote='Привезли инструмент на склад компании'
        item=self.draft(self.source(quote),location='company',fact_quote=quote,
                        lines=[dict(title='Перфоратор',unit='шт',qty='1',item_type='tool')])
        self.assertEqual(self.apply(item).status,200)
        with finance.db() as con:
            central=con.execute('SELECT * FROM warehouse_items').fetchone()
            self.assertEqual((central['item_type'],central['condition_status']),('tool','Новый'))
            eid=con.execute("INSERT INTO estimate_items(project_id,title,unit,planned_qty,planned_price,item_kind,updated_at) VALUES(?,?,?,1,0,'tool',?)",(self.pid,'Уровень','шт',finance.now_ts())).lastrowid
            con.execute("INSERT INTO stock_moves(project_id,estimate_item_id,move_type,qty,price,created_by,created_at) VALUES(?,?,'receipt',1,0,?,?)",(self.pid,eid,self.user['id'],finance.now_ts()))
            payload=build_warehouse_control(con,self.pid)
            self.assertEqual(payload['materials'][0]['itemKind'],'tool')
            self.assertEqual(payload['summary']['materialsCount'],0)

    def test_finance_group_is_explicitly_allowed_and_foreign_group_denied(self):
        self.cfg['group_ids']=['-finance']
        data=dict(chat_id='-finance',message_id='fin-1',sent_at=1791318600,text='Купили инструмент',media=[])
        self.assertEqual(self.call('/api/field-intake/import',data).status,200)
        data['chat_id']='-foreign'
        self.assertEqual(self.call('/api/field-intake/import',data).status,403)

    def test_invalid_type_ambiguous_purchase_and_wrong_project_do_not_apply(self):
        for n,quote,kind in [(1,'Планируем купить инструмент','tool'),(2,'Купили инструмент','unknown'),(3,'Не закупили инструмент','tool'),(4,'Не приобрели инструмент','tool')]:
            item=self.draft(self.source(quote,mid=str(n)),'purchase',fact_quote=quote,
                            lines=[dict(title='Инструмент',unit='шт',qty='1',item_type=kind)])
            self.assertEqual(self.apply(item).status,409)
        item=self.purchase()
        response=self.call('/api/field-intake/'+str(item['id']),token=False,access=False)
        self.assertEqual(response.status,403)

    def test_unestimated_material_is_visible_without_changing_estimate(self):
        item=self.draft(self.source())
        self.assertEqual(self.apply(item).status,200)
        with finance.db() as con:
            inventory=build_warehouse_control(con,self.pid)['inventory']
            self.assertEqual((inventory[0]['title'],inventory[0]['itemKind']),('Профиль','material'))
            self.assertEqual(con.execute('SELECT count(*) FROM estimate_items').fetchone()[0],0)

    def test_negative_and_future_delivery_do_not_create_stock(self):
        for n,quote in enumerate(['Не привезли два перфоратора','Завтра привезём два перфоратора','Не привёз инструмент','Завезём инструмент завтра']):
            item=self.draft(self.source(quote,mid='future-'+str(n)),fact_quote=quote,
                            lines=[dict(title='Перфоратор',unit='шт',qty='2',item_type='tool')])
            self.assertEqual(self.apply(item).status,409)
        with finance.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],0)


if __name__=='__main__':unittest.main()
