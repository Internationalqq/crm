import importlib.util
import io
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('intake_ssh',Path(__file__).resolve().parents[1]/'deploy/finance_intake_ssh.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class TransportTests(unittest.TestCase):
    def test_only_draft_intake_and_specific_read_paths_allowed(self):
        for path,data in [('/1/confirm',{}),('/../auth/login',{}),('//example.com',None),('/1/file',None),('',None),('/projects?other=1',None),('/import',None)]:
            with self.subTest(path=path):
                self.assertEqual(m.proxy({'path':path,'data':data,'token':'x'*40})['status'],403)
    def test_requests_stay_on_loopback_and_token_not_in_url(self):
        calls=[]
        def open(req,timeout):
            calls.append(req);r=io.BytesIO(b'{"projects":[]}');r.status=200;return r
        result=m.proxy({'path':'/projects','data':None,'token':'x'*40},open)
        self.assertEqual(result,{'status':200,'payload':{'projects':[]}})
        self.assertEqual(calls[0].full_url,'http://127.0.0.1:8080/api/finance-intake/projects')
    def test_header_injection_and_network_error_fail_closed(self):
        self.assertEqual(m.proxy({'path':'/projects','token':'x'*40+'\nBad: yes'})['status'],401)
        def fail(*a,**k):raise RuntimeError('secret')
        self.assertEqual(m.proxy({'path':'/projects','token':'x'*40},fail),{'status':503,'payload':{'error':'crm_unavailable'}})

if __name__=='__main__':unittest.main()
