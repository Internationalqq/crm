import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('research_policy', ROOT / 'deploy/hermes_research_artifacts.py')
policy = importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)


class ResearchArtifactsTests(unittest.TestCase):
    def test_known_outputs_only(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for relative in ['state.json','result.json','positions.csv','SUMMARY.md','batch-reporting.json',
                             'results/'+'0'*19+'/'+'a'*32+'/'+'b'*64+'/result.json',
                             'attempts/run-1062/batch-014-023.json','checkpoints/run1062-processed23.json']:
                self.assertTrue(policy.is_research_output(root/relative,root),relative)
            for relative in ['tools/script.py','config.json','package.json','TASK.md','AGENTS.md',
                             'script.sh','state.json.py','../state.json','results/unknown/result.json']:
                self.assertFalse(policy.is_research_output(root/relative,root),relative)

    def test_symlink_escape_is_not_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'workspace';root.mkdir();outside=Path(directory)/'code.py';outside.write_text('pass')
            try:(root/'state.json').symlink_to(outside)
            except OSError:self.skipTest('symlinks unavailable on this host')
            self.assertFalse(policy.is_research_output(root/'state.json',root))

    def test_code_alias_to_output_is_not_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'state.json').write_text('{}');(root/'tools').mkdir()
            try:(root/'tools/changed.py').symlink_to(root/'state.json')
            except OSError:self.skipTest('symlinks unavailable on this host')
            self.assertFalse(policy.is_research_output(root/'tools/changed.py',root))

    def test_scope_and_mixed_edits_keep_code_checks(self):
        data=str(policy.WORKSPACE/'state.json');code=str(policy.WORKSPACE/'tools/read.py')
        with patch.dict(os.environ,{'HERMES_HOME':str(policy.PROFILE),'HERMES_KANBAN_TASK':'t_fb6e836e'}):
            self.assertEqual(policy.coding_paths([data,code]),[code])
            self.assertEqual(policy.coding_paths([data]),[])
        for env in [{'HERMES_HOME':str(policy.PROFILE),'HERMES_KANBAN_TASK':'other'},
                    {'HERMES_HOME':'/other','HERMES_KANBAN_TASK':'t_fb6e836e'}]:
            with patch.dict(os.environ,env):self.assertEqual(policy.coding_paths([data,code]),[data,code])

    def test_patch_idempotent(self):
        source='    paths = sorted({str(p) for p in changed_paths if p})\n'
        result=policy.patch_source(source)
        self.assertEqual(policy.patch_source(result),result)
        self.assertIn('coding_paths',result)


if __name__=='__main__':unittest.main()
