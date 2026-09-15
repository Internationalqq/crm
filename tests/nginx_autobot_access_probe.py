"""Exercise real Nginx against synthetic upstreams; no production data/users."""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('installer', ROOT / 'deploy/nginx/install_autobot_access.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
auth_calls, bot_calls = [], []


class Upstream(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        self.do_GET()

    def do_GET(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        status = 200
        if self.path.startswith('/api/agent-market/v1/'):
            if self.path == '/api/agent-market/v1/status':
                status = 200 if self.headers.get('Authorization') == 'Bearer isolated-worker' else 401
            else:
                status = 404
            payload = json.dumps({'status': status}).encode()
        elif self.server.kind == 'auth':
            if self.path == '/api/autobot/access-check':
                auth_calls.append({'method': self.command, 'body': body})
                role = self.headers.get('Cookie', '').removeprefix('role=')
                expected_origin = self.headers.get('X-Forwarded-Proto', 'missing') + '://' + self.headers.get('Host', '')
                if self.headers.get('Sec-Fetch-Site') == 'cross-site' or self.headers.get('Origin', '') not in ('', expected_origin):
                    status = 403
                elif role == 'upstream-error':
                    status = 503
                elif not role:
                    status = 401
                elif role not in {'admin', 'main_admin', 'director', 'foreman'}:
                    status = 403
            else:
                status = 404
            payload = json.dumps({'status': status}).encode()
        else:
            bot_calls.append({'method': self.command, 'path': self.path, 'body': body})
            payload = b'isolated-autobot-result'
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def run():
    auth = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
    bot = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
    auth.kind, bot.kind = 'auth', 'bot'
    for service in (auth, bot):
        threading.Thread(target=service.serve_forever, daemon=True).start()
    process = None
    try:
        with tempfile.TemporaryDirectory(prefix='pmbi-nginx-auth-') as name:
            temporary = Path(name)
            includes = temporary / 'includes'
            includes.mkdir()
            for filename in ('autobot-access.conf', 'autobot-protected.conf'):
                content = (ROOT / 'deploy/nginx' / filename).read_text()
                content = content.replace('127.0.0.1:8080', f'127.0.0.1:{auth.server_port}')
                content = content.replace('127.0.0.1:8765', f'127.0.0.1:{bot.server_port}')
                (includes / filename).write_text(content)
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            locations = []
            for location in ('/autobot/', '/estimates', '/tenders', '/merge-report', '/research', '~ ^/api/(estimates|tender|generate)', '= /static/embed_bridge.js'):
                suffix = '/' if location == '/autobot/' else ''
                locations.append('location ' + location + ' {\nproxy_pass http://127.0.0.1:8765' + suffix + ';\nproxy_set_header Host $host;\n}')
            config = ('worker_processes 1;\npid ' + str(temporary / 'nginx.pid') + ';\nerror_log ' + str(temporary / 'error.log') + ';\n'
                      'events { worker_connections 128; }\nhttp { access_log off; client_body_temp_path ' + str(temporary / 'client') + ';\n'
                      'proxy_temp_path ' + str(temporary / 'proxy') + ';\nserver { listen 127.0.0.1:' + str(port) + ';\nserver_name crm.example;\n'
                      + '\n'.join(locations) + '\nlocation / { return 404; }\n}\n}\n')
            config, protected = installer.protected_config(config, str(includes))
            config = config.replace('127.0.0.1:8765', f'127.0.0.1:{bot.server_port}')
            path = temporary / 'nginx.conf'
            path.write_text(config)
            subprocess.run(['nginx', '-t', '-p', str(temporary), '-c', str(path)], check=True, capture_output=True)
            process = subprocess.Popen(['nginx', '-p', str(temporary), '-c', str(path), '-g', 'daemon off;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            def request(uri, method='GET', role='', headers=None, body=None):
                connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
                extra = {'Host': 'crm.example', **(headers or {})}
                if role:
                    extra['Cookie'] = 'role=' + role
                connection.request(method, uri, body=body, headers=extra)
                response = connection.getresponse()
                result = response.status, response.read()
                connection.close()
                return result

            ready = time.monotonic() + 5
            while True:
                try:
                    request('/ready')
                    break
                except ConnectionRefusedError:
                    if time.monotonic() > ready:
                        raise
                    time.sleep(0.05)
            try:
                for uri in ('/estimates', '/tenders/123', '/merge-report/123', '/research', '/autobot/estimates', '/autobot/data/private.xlsx', '/api/tenders/123', '/autobot/api/tenders/123'):
                    assert request(uri)[0] == 401, uri
                assert not bot_calls
                for role in ('guest', 'customer', 'worker'):
                    assert request('/estimates', role=role)[0] == 403
                assert not bot_calls
                for role in ('main_admin', 'admin', 'director', 'foreman'):
                    assert request('/estimates', role=role) == (200, b'isolated-autobot-result')
                assert request('/autobot/tenders/123', role='foreman')[0] == 200
                assert bot_calls[-1]['path'] == '/tenders/123'
                body = b'{"tender_id":"123","limit":5}'
                assert request('/api/generate-merge-site-one', 'POST', 'foreman', headers={'Origin': 'http://crm.example', 'Sec-Fetch-Site': 'same-origin'}, body=body)[0] == 200
                assert bot_calls[-1]['body'] == body and bot_calls[-1]['method'] == 'POST'
                assert all(item == {'method': 'GET', 'body': b''} for item in auth_calls)
                previous = len(bot_calls)
                assert request('/api/generate-merge-site-one', 'POST', 'admin', headers={'Origin': 'https://evil.example'}, body=body)[0] == 403
                assert request('/estimates', role='admin', headers={'Sec-Fetch-Site': 'cross-site'})[0] == 403
                assert request('/estimates', role='upstream-error')[0] == 500
                assert len(bot_calls) == previous
                assert request('/_pmbi_autobot_access', role='admin')[0] == 404
                before = len(auth_calls)
                assert request('/autobot/api/agent-market/v1/status')[0] == 401
                assert request('/autobot/api/agent-market/v1/status', headers={'Authorization': 'Bearer isolated-worker'})[0] == 200
                assert request('/autobot/api/agent-market/v1/estimates', headers={'Authorization': 'Bearer isolated-worker'})[0] == 404
                assert len(auth_calls) == before
                assert request('/static/embed_bridge.js')[0] == 200
                print(json.dumps({'nginx': 'passed', 'protected_locations': len(protected), 'checks': ['anonymous', 'forbidden roles', 'allowed roles', 'prefix rewrite', 'POST body', 'body-free auth subrequest', 'cross-site', 'upstream error closed', 'internal route', 'worker bearer', 'worker route boundary', 'static']}))
            except BaseException:
                print((temporary / 'error.log').read_text()[-3500:])
                raise
            finally:
                process.terminate()
                process.wait(timeout=10)
                process = None
    finally:
        if process is not None:
            process.terminate()
            process.wait(timeout=10)
        for service in (auth, bot):
            service.shutdown()
            service.server_close()


if __name__ == '__main__':
    run()
