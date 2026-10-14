import asyncio
import importlib.util
import textwrap
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

spec = importlib.util.spec_from_file_location('quiet_patch', Path(__file__).resolve().parents[1]/'deploy/hermes_telegram_quiet.py')
quiet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quiet)

class QuietTelegramTests(unittest.TestCase):
    def run_decision(self, enabled=None, delete_error=False):
        query=SimpleNamespace(answer=AsyncMock(), delete_message=AsyncMock(), edit_message_text=AsyncMock(), edit_message_reply_markup=AsyncMock())
        if delete_error:query.delete_message.side_effect=RuntimeError('cannot delete')
        scope={'os':__import__('os'),'ParseMode':SimpleNamespace(MARKDOWN_V2='md')}
        exec('async def present(query,self,label,user_display):\n'+textwrap.indent(textwrap.dedent(quiet.NEW),'    '),scope)
        env={} if enabled is None else {'HERMES_TELEGRAM_APPROVAL_RESULT_ENABLED':enabled}
        with patch.dict('os.environ',env,clear=True):
            asyncio.run(scope['present'](query,SimpleNamespace(format_message=lambda x:x),'✅ Approved permanently','Иван'))
        return query
    def test_default_preserves_other_profiles(self):
        q=self.run_decision();q.edit_message_text.assert_awaited_once();q.delete_message.assert_not_awaited()
        self.assertEqual(q.answer.call_args.kwargs['text'],'✅ Approved permanently')
    def test_quiet_result_does_not_publish_decision(self):
        q=self.run_decision('false');q.delete_message.assert_awaited_once();q.edit_message_text.assert_not_awaited()
        self.assertEqual(q.answer.call_args.kwargs['text'],'Решение сохранено')
    def test_failed_cleanup_removes_buttons_without_losing_decision(self):
        q=self.run_decision('false',True);q.edit_message_reply_markup.assert_awaited_once_with(reply_markup=None);q.edit_message_text.assert_not_awaited()
    def test_patch_repeat_and_version_drift(self):
        source='async def callback(query,self,label,user_display):\n'+quiet.OLD+'\n                resolve_approval()\n'
        patched=quiet.patch_source(source);self.assertEqual(quiet.patch_source(patched),patched);self.assertIn('resolve_approval()',patched)
        with self.assertRaises(ValueError):quiet.patch_source('new incompatible adapter')

if __name__=='__main__':unittest.main()
