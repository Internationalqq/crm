"""Forced-command SSH transport for the finance intake API, never a shell.

Install with authorized_keys restrict,command="python3 /opt/crm/deploy/finance_intake_ssh.py".
Authentication remains the same scoped API token inside the encrypted envelope.
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

MAX_BYTES = 29 * 1024 * 1024


def proxy(envelope, opener=urllib.request.urlopen, base_url='http://127.0.0.1:8080'):
    path = envelope.get('path')
    data = envelope.get('data')
    if not isinstance(path, str) or not (
        (data is None and re.fullmatch(r'/(projects|\d+)', path)) or
        (isinstance(data, dict) and re.fullmatch(r'/(import|\d+/draft)', path))
    ):
        return {'status':403,'payload':{'error':'transport_scope_forbidden'}}
    token = envelope.get('token')
    if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{32,128}',token):
        return {'status':401,'payload':{'error':'invalid_integration_token'}}
    req = urllib.request.Request(base_url + '/api/finance-intake' + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
    try:
        with opener(req,timeout=20) as result:
            return {'status':result.status,'payload':json.load(result)}
    except urllib.error.HTTPError as exc:
        return {'status':exc.code,'payload':{'error':'crm_request_rejected'}}
    except Exception:
        return {'status':503,'payload':{'error':'crm_unavailable'}}


def main():
    if os.environ.get('SSH_ORIGINAL_COMMAND'):
        result={'status':403,'payload':{'error':'command_forbidden'}}
    else:
        raw=sys.stdin.buffer.read(MAX_BYTES+1)
        try:
            if len(raw)>MAX_BYTES:raise ValueError('too large')
            value=json.loads(raw)
            if not isinstance(value,dict):raise ValueError('object required')
            result=proxy(value)
        except (ValueError,TypeError):
            result={'status':400,'payload':{'error':'invalid_request'}}
    print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':main()
