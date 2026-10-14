import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('quiet_profiles',Path(__file__).resolve().parents[1]/'deploy/hermes_quiet_profiles.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class QuietProfileTests(unittest.TestCase):
 def test_only_telegram_presentation_changes(self):
  c={'model':'existing-model','telegram':{'allowed_chats':['-10']},'security':{'approval_mode':'ask'},'display':{'platforms':{'telegram':{'long_running_notifications':True},'discord':{'streaming':True}}}}
  m.quiet_config(c)
  self.assertEqual(c['telegram']['allowed_chats'],['-10']);self.assertEqual(c['security']['approval_mode'],'ask');self.assertEqual(c['display']['platforms']['discord'],{'streaming':True})
  self.assertEqual(c['display']['platforms']['telegram'],m.QUIET)
 def test_env_repeat_preserves_other_settings(self):
  original='EXISTING_SETTING=keep\nexport HERMES_GATEWAY_BUSY_ACK_ENABLED=true\n'
  changed=m.quiet_env(original);self.assertEqual(m.quiet_env(changed),changed);self.assertIn('EXISTING_SETTING=keep',changed)
  self.assertNotIn('ENABLED=true',changed)
  for key in m.ENV_KEYS:self.assertEqual(changed.count(key+'=false'),1)
if __name__=='__main__':unittest.main()
