"""Windows loopback relay for Anya's durable CRM outbox; no Telegram polling.

An existing authorized SSH host alias carries the reverse loopback listener.
The only upstream is the configured CRM HTTPS origin, with normal certificate checks.
No credentials are stored on Windows; each encrypted request carries its scoped token.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
import threading
import time

# Some local Python runtimes enable safe_path; import only this installed sibling.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from finance_intake_ssh import proxy, MAX_BYTES

BASE_URL='https://xn----7sbbfmcadxfphwltfbrtxh6z.xn--p1ai'
STATUS=Path.home()/'.codex/finance-crm-relay-status.json'


def record(**data):
    data['at']=time.time()
    STATUS.parent.mkdir(parents=True,exist_ok=True)
    temp=STATUS.with_suffix('.tmp');temp.write_text(json.dumps(data));temp.replace(STATUS)


class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass  # Do not log tokens, bodies or source documents.
    def do_POST(self):
        try:
            length=int(self.headers.get('Content-Length','0'))
            if self.path!='/' or not 0 < length <= MAX_BYTES:raise ValueError('invalid envelope')
            self.connection.settimeout(30)
            envelope=json.loads(self.rfile.read(length))
            if not isinstance(envelope,dict):raise ValueError('invalid envelope')
            result=proxy(envelope,base_url=BASE_URL)
        except (ValueError,TimeoutError,OSError):
            result={'status':400,'payload':{'error':'invalid_envelope'}}
        body=json.dumps(result).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers()
        try:self.wfile.write(body)
        except OSError:pass


def main():
    # Binding first makes a second relay fail before starting another SSH process.
    server=ThreadingHTTPServer(('127.0.0.1',18878),Handler)
    def tunnel():
        while True:
            process=subprocess.Popen(['ssh.exe','-N','-T','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes',
                '-o','ConnectTimeout=10','-o','ServerAliveInterval=20','-o','ServerAliveCountMax=3',
                '-R','127.0.0.1:18878:127.0.0.1:18878','mac-mini-hermes'],
                stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            record(status='tunnel_process_started',pid=process.pid)
            code=process.wait();record(status='waiting_for_connection',exit_code=code)
            time.sleep(30)
    threading.Thread(target=tunnel,daemon=True).start()
    server.serve_forever()


if __name__=='__main__':main()
