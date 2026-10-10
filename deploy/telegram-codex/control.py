"""Owner-scoped, one-turn controls. No approval is remembered for another action."""
import queue
import threading
import secrets


class Controls:
    def __init__(self, send):
        self.send = send
        self.queue = queue.Queue()
        self.lock = threading.Lock()
        self.pending = None
        self.active = False
        self.approval_token = None
        self.stop_requested = False

    def callback(self, value):
        with self.lock:
            if not self.pending or not self.approval_token:
                return False
            if value not in ('approve:' + self.approval_token, 'deny:' + self.approval_token):
                return False
            return self._approval_answer('/approve' if value.startswith('approve:') else '/deny')

    def _approval_answer(self, text):
        request, questions, _ = self.pending
        if text not in ('/approve', '/deny'):
            self.send('Запрос ещё ожидает решения. Нажми «Разрешить» или «Отклонить», либо отправь /approve или /deny. Это касается только показанного действия.')
            return True
        decision = 'accept' if text == '/approve' else 'decline'
        allowed = questions[0].get('allowed')
        if allowed and decision not in allowed:
            decision = 'cancel'
        self.queue.put({'kind': 'response', 'id': request, 'result': {'decision': decision}})
        self.pending = None
        self.approval_token = None
        return True

    def accept(self, text, update_id=None):
        with self.lock:
            if text.strip().lower() in ('/stop', 'стоп'):
                if self.active and not self.stop_requested:
                    self.stop_requested = True
                    self.pending = None
                    self.approval_token = None
                    while not self.queue.empty():
                        self.queue.get_nowait()
                    self.queue.put({'kind': 'stop'})
                return True
            if self.stop_requested:
                return False
            if self.pending:
                if self.approval_token:
                    return self._approval_answer(text.strip())
                request, questions, answers = self.pending
                question = questions[len(answers)]
                answers[question['id']] = {'answers': [text]}
                if len(answers) == len(questions):
                    self.queue.put({'kind': 'response', 'id': request, 'result': {'answers': answers}})
                    self.pending = None
                else:
                    self.send(questions[len(answers)]['question'])
                return True
            if text.strip() in ('/approve', '/deny'):
                self.send('Сейчас нет ожидающего запроса разрешения. Эта команда не выдаёт доступ ко всем следующим действиям.')
                return True
            if self.active and text:
                action = {'kind': 'steer', 'text': text}
                if update_id is not None:
                    action['update_id'] = update_id
                self.queue.put(action)
                return True
        return False

    def request(self, event):
        method, params = event['method'], event.get('params', {})
        if method == 'item/tool/requestUserInput':
            questions = params.get('questions', [])
            if not questions or any(q.get('isSecret') for q in questions):
                return {'answers': {}}
            with self.lock:
                self.pending = (event['id'], questions, {})
            question = questions[0]
            options = '\n'.join(o['label'] + ': ' + o['description'] for o in question.get('options') or [])
            self.send(question['question'] + ('\n' + options if options else ''))
            return None
        # Only a plain, scoped decision is accepted; never amend global policies.
        if method in ('item/commandExecution/requestApproval', 'item/fileChange/requestApproval'):
            with self.lock:
                self.approval_token = secrets.token_hex(8)
                token = self.approval_token
                self.pending = (event['id'], [{'id': 'approval', 'question': '', 'allowed': params.get('availableDecisions')}], {})
            self.send('Нужно разрешение на конкретное действие: ' + str(params.get('reason') or 'выход за доступную рабочую папку')[:1000]
                      + '\nДействие: ' + str(params.get('command') or params.get('grantRoot') or params.get('cwd') or 'см. причину выше')[:1500]
                      + '\nРазрешение действует только на это действие. Можно также ответить /approve или /deny.',
                      reply_markup={'inline_keyboard': [[
                          {'text': '✅ Разрешить', 'callback_data': 'approve:' + token},
                          {'text': '❌ Отклонить', 'callback_data': 'deny:' + token}]]})
            return None
        return {'unsupported': True}

    def drain(self):
        while True:
            try:
                value = self.queue.get_nowait()
            except queue.Empty:
                return
            yield value

    def finish(self):
        remaining = []
        with self.lock:
            self.active = False
            self.pending = None
            self.approval_token = None
            while not self.queue.empty():
                remaining.append(self.queue.get_nowait())
            if self.stop_requested:
                remaining = []
            self.stop_requested = False
        return remaining
