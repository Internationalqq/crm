"""Stream public Codex messages; never forward reasoning or tool payloads."""
import json
import queue
import subprocess
import threading
import time


class LiveReply:
    def __init__(self, api, owner, clock=time.monotonic):
        self.api, self.owner, self.clock = api, owner, clock
        self.message_id = None
        self.text = ''
        self.item_id = None
        self.updated_at = 0
        self.disabled = False
        self.send_unknown = False

    def feed(self, event):
        method, params = event.get('method'), event.get('params', {})
        if method == 'item/started' and params.get('item', {}).get('type') == 'agentMessage':
            self.item_id = params['item']['id']
            self.text = ''
        elif method == 'item/agentMessage/delta' and params.get('itemId') == self.item_id:
            self.text += params.get('delta', '')
            if self.text.strip() and not self.disabled and (self.message_id is None or self.clock() - self.updated_at >= 2):
                self.publish(self.text[-1700:] + ' ▍')

    def publish(self, text):
        try:
            if self.message_id is None:
                self.send_unknown = True
                result = self.api('sendMessage', {'chat_id': self.owner, 'text': text})
                self.message_id = result['message_id']
                self.send_unknown = False
            else:
                self.api('editMessageText', {'chat_id': self.owner, 'message_id': self.message_id, 'text': text})
            self.updated_at = self.clock()
        except RuntimeError:
            self.disabled = True

    def finish(self, text):
        if self.send_unknown:
            raise RuntimeError('Preview delivery unknown; do not duplicate')
        # A final edit is attempted even if a preview edit failed; it cannot duplicate a message.
        self.disabled = False
        self.publish(text[:3500])
        if self.disabled:
            raise RuntimeError('Final delivery unknown')
        for offset in range(3500, len(text), 3500):
            self.api('sendMessage', {'chat_id': self.owner, 'text': text[offset:offset+3500]})


def run_codex(codex, workspace, crm, thread_id, prompt, events_path, on_thread, on_event,
              timeout=1800, sandbox='workspace-write'):
    command = [codex, 'app-server']
    process = subprocess.Popen(command, cwd=workspace, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True, encoding='utf-8',
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    messages = queue.Queue()
    def read():
        for line in process.stdout:
            messages.put(line)
        messages.put(None)
    threading.Thread(target=read, daemon=True).start()
    def send(message):
        process.stdin.write(json.dumps(message) + '\n')
        process.stdin.flush()
    send({'id': 0, 'method': 'initialize', 'params': {'clientInfo': {
        'name': 'pm_telegram_codex', 'version': '1.0.0'}}})
    final = ''
    completed = False
    deadline = time.monotonic() + timeout
    try:
        with events_path.open('w', encoding='utf-8') as log:
            while not completed:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('Codex turn timeout')
                try:
                    line = messages.get(timeout=min(remaining, 1))
                except queue.Empty:
                    continue
                if line is None:
                    raise RuntimeError('Codex connection ended before completion')
                event = json.loads(line)
                log.write(line)
                log.flush()
                if 'id' in event and 'method' not in event:
                    if event.get('error'):
                        raise RuntimeError('Codex RPC rejected')
                    if event['id'] == 0:
                        send({'method': 'initialized', 'params': {}})
                        params = {'cwd': workspace, 'sandbox': sandbox, 'approvalPolicy': 'never'}
                        if crm:
                            params['config'] = {'sandbox_workspace_write.writable_roots': [crm]}
                        if thread_id:
                            params['threadId'] = thread_id
                        send({'id': 1, 'method': 'thread/resume' if thread_id else 'thread/start', 'params': params})
                    elif event['id'] == 1:
                        thread_id = event['result']['thread']['id']
                        on_thread(thread_id)
                        send({'id': 2, 'method': 'turn/start', 'params': {
                            'threadId': thread_id, 'input': [{'type': 'text', 'text': prompt}]}})
                elif 'id' in event and 'method' in event:
                    # No interactive approval bypass: a required client action stops the job.
                    send({'id': event['id'], 'error': {'code': -32601, 'message': 'Interactive action unavailable'}})
                    raise RuntimeError('Codex requires an interactive action')
                else:
                    on_event(event)
                    params = event.get('params', {})
                    if event.get('method') == 'item/completed':
                        item = params.get('item', {})
                        if item.get('type') == 'agentMessage':
                            final = item.get('text', '')
                    if event.get('method') == 'turn/completed':
                        if params.get('turn', {}).get('status') != 'completed':
                            raise RuntimeError('Codex turn did not complete')
                        completed = True
        if not final.strip():
            raise RuntimeError('Codex returned no public answer')
        return final
    finally:
        if process.poll() is None:
            process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
