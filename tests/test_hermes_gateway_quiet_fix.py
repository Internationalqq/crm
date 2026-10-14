import importlib.util,unittest
from pathlib import Path

def load(name,file):
 spec=importlib.util.spec_from_file_location(name,Path(__file__).resolve().parents[1]/'deploy'/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
policy=load('cron_policy','hermes_cron_presentation.py');patcher=load('quiet_fix','hermes_gateway_quiet_fix.py')
class GatewayQuietFixTests(unittest.TestCase):
 def test_users_exact_report_is_silent(self):
  text='Повторная точечная проверка (ad-hoc) прошла, код выхода 0. Суммы и XLSX проверены. Причина повторного статуса unverified не установлена.'
  self.assertEqual(policy.clean_report(text),'')
 def test_business_results_and_real_problem_remain(self):
  for text in ['Финплан обновлён: 5 счетов, 532240 ₽.','Не удалось получить счёт: файл недоступен.','13.10 Сергей, 6 часов, Гусиха.']:
   self.assertEqual(policy.clean_report(text),text)
  blocker=policy.clean_report('Tests failed, exit code 1. Cannot publish the finance plan until the missing XLSX is restored.')
  self.assertIn('Cannot publish',blocker);self.assertNotIn('exit code',blocker);self.assertNotIn('Tests',blocker)
 def test_mixed_success_keeps_financial_result(self):
  self.assertEqual(policy.clean_report('Ad-hoc tests passed, exit code 0. Финплан обновлён: 5 счетов, 532240 ₽.'),'Финплан обновлён: 5 счетов, 532240 ₽.')
 def test_patch_repeats_and_preserves_processing(self):
  source='def handle():\n    queue_input()\n    '+patcher.OLD_ACK+'\n    if not busy_ack_enabled: return True\n    send_ack()\n'
  changed=patcher.replace_once(source,patcher.OLD_ACK,patcher.NEW_ACK)
  self.assertEqual(patcher.replace_once(changed,patcher.OLD_ACK,patcher.NEW_ACK),changed);self.assertIn('queue_input()',changed)
  with self.assertRaises(ValueError):patcher.replace_once('different version',patcher.OLD_ACK,patcher.NEW_ACK)
 def test_cron_patch_does_not_remove_files(self):
  source='def deliver():\n'+patcher.OLD_CRON+'\n    send_files(media_files)\n'
  changed=patcher.replace_once(source,patcher.OLD_CRON,patcher.NEW_CRON)
  self.assertIn('and not media_files:',changed);self.assertIn('send_files(media_files)',changed)
if __name__=='__main__':unittest.main()
