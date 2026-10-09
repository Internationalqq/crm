"""Resume a diagnosed reviewer failure without interrupting the collector.

Use after its prior reviewer exits and its failure is archived with a reason.
This entry never clears failure records or retries them itself.
"""
import fcntl
import json
import signal
import threading
import mechanical_pipeline as pipeline


def main():
    work=pipeline.WORK
    consent=json.loads((work/'consent.json').read_text())
    assert consent['tender_id']=='0171200001926000664'
    with (work/'reviewer.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        stop=threading.Event();finished=threading.Event()
        pipeline.STOP_EVENT=stop
        signal.signal(signal.SIGTERM,lambda *args:stop.set())
        signal.signal(signal.SIGINT,lambda *args:stop.set())
        def watch():
            while not stop.wait(2):
                if (work/'stop-request').exists():stop.set();return
                if json.loads((work/'producer-state.json').read_text())['status'] in ('finished','stopped','needs_attention'):
                    finished.set();return
        thread=threading.Thread(target=watch);thread.start()
        try:pipeline.review_queue(work,consent['deadline'],stop,finished)
        finally:stop.set();thread.join()


if __name__=='__main__':main()
