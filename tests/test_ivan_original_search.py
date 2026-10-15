import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('restore_ivan',ROOT/'deploy/restore_ivan_search_20261015.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class IvanOriginalSearchTests(unittest.TestCase):
    def fixture(self,root):
        db=sqlite3.connect(root/'state.sqlite');db.executescript('CREATE TABLE jobs(id INTEGER PRIMARY KEY,prompt TEXT,status TEXT,result TEXT); CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); INSERT INTO settings VALUES("owner","123");');db.commit();db.close()
        batches=[]
        for i in range(2):
            p=root/f'prompt{i}.txt';p.write_text('prompt'+str(i));batches.append({'prompt_file':str(p)})
        return {'input_sha256':'source-sha','batches':batches}

    def test_submission_and_retry_do_not_duplicate_jobs(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manifest=self.fixture(root)
            with patch.object(m,'WORKSPACE',root),patch.object(m,'BRIDGE_HOME',root):
                first=m.enqueue(manifest);second=m.enqueue(manifest)
                self.assertEqual(first,second)
            db=sqlite3.connect(root/'state.sqlite');self.assertEqual(db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0],2);db.close()

    def test_existing_owner_work_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manifest=self.fixture(root);db=sqlite3.connect(root/'state.sqlite');db.execute('INSERT INTO jobs VALUES (1,"owner task","running",NULL)');db.commit()
            with patch.object(m,'WORKSPACE',root),patch.object(m,'BRIDGE_HOME',root):
                with self.assertRaisesRegex(AssertionError,'Existing owner task'):m.enqueue(manifest)
            self.assertEqual(db.execute('SELECT id,status FROM jobs').fetchall(),[(1,'running')]);db.close()

    def test_uncommitted_manifest_can_be_recovered_once(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manifest=self.fixture(root)
            for i,b in enumerate(manifest['batches']):b['job_id']=-100+i
            (root/'dispatch.json').write_text(json.dumps(manifest))
            with patch.object(m,'WORKSPACE',root),patch.object(m,'BRIDGE_HOME',root):m.enqueue(manifest);m.enqueue(manifest)
            db=sqlite3.connect(root/'state.sqlite');self.assertEqual(db.execute('SELECT id FROM jobs ORDER BY id').fetchall(),[(-100,),(-99,)]);db.close()


if __name__=='__main__':unittest.main()
