"""Owner-scoped, one-turn controls. No approval is remembered for another action."""
import queue
import threading


class Controls:
    def __init__(self, send):
        self.send = send
        self.queue = queue.Queue()
        self.lock = threading.Lock()
        self.pending = None
        self.active = False

    def accept(self, text, update_id=None):
        with self.lock:
            if text.strip().lower() in ('/stop', 'стоп'):
                if self.active:
                    self.queue.put({'kind': 'stop'})
                return True
            if self.pending:
                request, questions, answers = self.pending
                question = questions[len(answers)]
                answers[question['id']] = {'answers': [text]}
                if len(answers) == len(questions):
                    self.queue.put({'kind': 'response', 'id': request, 'result': {'answers': answers}})
                    self.pending = None
                else:
                    self.send(questions[len(answers)]['question'])
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
                self.pending = (event['id'], [{'id': 'approval', 'question': ''}], {})
            self.send('Нужно разрешение на конкретное действие: ' + str(params.get('reason') or 'выход за доступную рабочую папку')[:1000]
                      + '\nДействие: ' + str(params.get('command') or params.get('grantRoot') or params.get('cwd') or 'см. причину выше')[:1500]
                      + '\nОтветь /approve или /deny. Разрешение действует только на это действие.')
            return None
        return {'unsupported': True}

    def drain(self):
        while True:
            try:
                value = self.queue.get_nowait()
            except queue.Empty:
                return
            if value['kind'] == 'response' and 'approval' in value['result'].get('answers', {}):
                answer = value['result']['answers']['approval']['answers'][0].strip()
                value['result'] = {'decision': 'accept' if answer == '/approve' else 'decline'}
            yield value

    def finish(self):
        remaining = []
        with self.lock:
            self.active = False
            self.pending = None
            while not self.queue.empty():
                remaining.append(self.queue.get_nowait())
        return remaining
