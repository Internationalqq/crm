"""Run on the installed Hermes checkout; no model or network calls."""
import os
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from agent import verification_stop as guard
from agent.research_artifact_policy import PROFILE, WORKSPACE
from agent.research_artifact_policy import is_research_output


class NativeResearchGuardTests(unittest.TestCase):
    def test_research_outputs_do_not_request_script_execution(self):
        data=[str(WORKSPACE/'state.json'),str(WORKSPACE/'SUMMARY.md'),
              str(WORKSPACE/'results'/('0'*19)/('a'*32)/('b'*64)/'result.json')]
        with patch.dict(os.environ,{'HERMES_HOME':str(PROFILE),'HERMES_KANBAN_TASK':'t_fb6e836e'}):
            with patch.object(guard,'_verification_snapshot',side_effect=AssertionError('data is not a coding edit')):
                self.assertIsNone(guard.build_verify_on_stop_nudge(session_id='test',changed_paths=data))

    def test_code_changes_still_request_verification(self):
        data=str(WORKSPACE/'state.json');code=str(WORKSPACE/'tools/changed.py')
        with patch.dict(os.environ,{'HERMES_HOME':str(PROFILE),'HERMES_KANBAN_TASK':'t_fb6e836e'}):
            with patch.object(guard,'_verification_snapshot',return_value=({'status':'unverified'},{'verifyCommands':['pytest']})) as snapshot:
                message=guard.build_verify_on_stop_nudge(session_id='test',changed_paths=[data,code])
                self.assertIn('pytest',message);self.assertIn(code,message);self.assertNotIn(data,message)
                self.assertEqual(snapshot.call_args.kwargs['changed_paths'],[code])

    def test_other_tasks_unchanged(self):
        with patch.dict(os.environ,{'HERMES_HOME':str(PROFILE),'HERMES_KANBAN_TASK':'other'}):
            with patch.object(guard,'_verification_snapshot',return_value=({'status':'unverified'},{'verifyCommands':['pytest']})):
                self.assertIn('pytest',guard.build_verify_on_stop_nudge(session_id='test',changed_paths=[str(WORKSPACE/'state.json')]))

    def test_symlink_alias_and_escape_keep_verification(self):
        with tempfile.TemporaryDirectory(dir=WORKSPACE) as directory:
            root=Path(directory);(root/'state.json').write_text('{}');(root/'tools').mkdir()
            (root/'tools/changed.py').symlink_to(root/'state.json')
            self.assertFalse(is_research_output(root/'tools/changed.py',root))
            outside=root/'outside';outside.mkdir();(outside/'code.py').write_text('pass')
            inside=root/'inside';inside.mkdir();(inside/'state.json').symlink_to(outside/'code.py')
            self.assertFalse(is_research_output(inside/'state.json',inside))


if __name__=='__main__':unittest.main()
