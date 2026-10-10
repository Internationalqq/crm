"""Stream public Codex messages; never forward reasoning or tool payloads."""
import json
import queue
import subprocess
import threading
import time
from outgoing import public_preview
from formatting import message_chunks


class LiveReply:
    def __init__(self, api, owner, clock=time.monotonic, stop_data=None):
        self.api, self.owner, self.clock = api, owner, clock
        self.message_id = None
        self.text = ''
        self.item_id = None
        self.updated_at = 0
        self.disabled = False
        self.send_unknown = False
        self.started_at = None
        self.stop_timer = threading.Event()
        self.timer = None
        self.publish_lock = threading.RLock()
        self.stop_data = stop_data

    def start(self):
        self.started_at = self.clock()
        self.tick()
        def ticker():
            while not self.stop_timer.wait(1):
                self.tick()
        self.timer = threading.Thread(target=ticker, daemon=True)
        self.timer.start()

    def preview(self):
        visible = public_preview(self.text)
        if self.started_at is None:
            return visible[-1700:] + ' ▍'
        elapsed = max(0, int(self.clock() - self.started_at))
        stamp = f'{elapsed // 60}:{elapsed % 60:02d}'
        return (visible[-1700:] + ' ▍\n\n⏱ ' + stamp) if visible.strip() else ('⏳ Работаю · ' + stamp)

    def tick(self):
        with self.publish_lock:
            if not self.stop_timer.is_set() and not self.disabled and (self.message_id is None or self.clock() - self.updated_at >= 1):
                self.publish(self.preview())

    def close(self):
        self.stop_timer.set()
        if self.timer:
            self.timer.join(timeout=45)

    def feed(self, event):
        method, params = event.get('method'), event.get('params', {})
        if method == 'item/started' and params.get('item', {}).get('type') == 'agentMessage':
            self.item_id = params['item']['id']
            self.text = ''
        elif method == 'item/agentMessage/delta' and params.get('itemId') == self.item_id:
            self.text += params.get('delta', '')
            visible = public_preview(self.text)
            with self.publish_lock:
                if visible.strip() and not self.disabled and (self.message_id is None or self.clock() - self.updated_at >= 1):
                    self.publish(self.preview())

    def publish(self, text, chunk=None):
        with self.publish_lock:
            self._publish(chunk if chunk is not None else next(message_chunks(text)))

    def _publish(self, chunk):
        try:
            chunk = dict(chunk)
            if self.stop_data:
                chunk['reply_markup'] = {'inline_keyboard': [] if self.stop_timer.is_set() else [
                    [{'text': '⏹ Стоп', 'callback_data': self.stop_data}]]}
            if self.message_id is None:
                self.send_unknown = True
                result = self.api('sendMessage', {'chat_id': self.owner, **chunk})
                self.message_id = result['message_id']
                self.send_unknown = False
            else:
                self.api('editMessageText', {'chat_id': self.owner, 'message_id': self.message_id, **chunk})
            self.updated_at = self.clock()
        except RuntimeError:
            self.disabled = True

    def finish(self, text):
        self.close()
        if self.send_unknown:
            raise RuntimeError('Preview delivery unknown; do not duplicate')
        # A final edit is attempted even if a preview edit failed; it cannot duplicate a message.
        self.disabled = False
        chunks = iter(message_chunks(text))
        self.publish('', next(chunks))
        if self.disabled:
            raise RuntimeError('Final delivery unknown')
        for chunk in chunks:
            self.api('sendMessage', {'chat_id': self.owner, **chunk})


def run_codex(codex, workspace, crm, thread_id, prompt, events_path, on_thread, on_event,
              timeout=1800, sandbox='workspace-write', extra_inputs=None, controls=None):
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
    turn_id = None
    rpc_id = 100
    stopping = False
    completed = False
    deadline = time.monotonic() + timeout
    try:
        with events_path.open('w', encoding='utf-8') as log:
            while not completed:
                if controls and turn_id:
                    for action in controls.drain():
                        rpc_id += 1
                        if action['kind'] == 'response':
                            send({'id': action['id'], 'result': action['result']})
                        elif action['kind'] == 'stop':
                            stopping = True
                            send({'id': rpc_id, 'method': 'turn/interrupt', 'params': {'threadId': thread_id, 'turnId': turn_id}})
                        elif action['kind'] == 'steer' and not stopping:
                            send({'id': rpc_id, 'method': 'turn/steer', 'params': {'threadId': thread_id, 'expectedTurnId': turn_id, 'input': [{'type': 'text', 'text': action['text']}]}})
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
                        params = {'cwd': workspace, 'sandbox': sandbox, 'approvalPolicy': 'on-request' if controls else 'never'}
                        if crm:
                            params['config'] = {'sandbox_workspace_write.writable_roots': [crm]}
                        if thread_id:
                            params['threadId'] = thread_id
                        send({'id': 1, 'method': 'thread/resume' if thread_id else 'thread/start', 'params': params})
                    elif event['id'] == 1:
                        thread_id = event['result']['thread']['id']
                        on_thread(thread_id)
                        send({'id': 2, 'method': 'turn/start', 'params': {
                            'threadId': thread_id, 'input': [{'type': 'text', 'text': prompt}] + (extra_inputs or [])}})
                elif 'id' in event and 'method' in event:
                    if controls:
                        result = controls.request(event)
                        if result is None:
                            continue
                        if 'unsupported' not in result:
                            send({'id': event['id'], 'result': result})
                            continue
                    # Unsupported requests fail closed.
                    send({'id': event['id'], 'error': {'code': -32601, 'message': 'Interactive action unavailable'}})
                    raise RuntimeError('Codex requires an interactive action')
                else:
                    on_event(event)
                    params = event.get('params', {})
                    if event.get('method') == 'turn/started':
                        turn_id = params['turn']['id']
                    if event.get('method') == 'item/completed':
                        item = params.get('item', {})
                        if item.get('type') == 'agentMessage':
                            final = item.get('text', '')
                    if event.get('method') == 'turn/completed':
                        if stopping and params.get('turn', {}).get('status') == 'interrupted':
                            return 'Остановлено. Уже выполненные действия сохранены.'
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
