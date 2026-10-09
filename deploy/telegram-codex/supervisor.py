"""Restart the gateway, never replay an interrupted user action."""
import argparse
from pathlib import Path
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', required=True)
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--codex', required=True)
    parser.add_argument('--crm')
    args = parser.parse_args()
    home = Path(args.home)
    import msvcrt
    lock = (home / 'supervisor.lock').open('a+b')
    lock.write(b'0'); lock.flush(); lock.seek(0)
    try:
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        return
    command = [sys.executable, str(home / 'bridge.py'), '--home', str(home),
               '--workspace', args.workspace, '--codex', args.codex]
    if args.crm:
        command += ['--crm', args.crm]
    starts = []
    while not (home / 'stop-gateway').exists():
        now = time.time()
        starts = [stamp for stamp in starts if now - stamp < 3600]
        if len(starts) >= 3:
            (home / 'recovery-limit.txt').write_text('Gateway stopped after three exits in one hour.', encoding='utf-8')
            return
        starts.append(now)
        with (home / 'worker.log').open('a', encoding='utf-8') as output, (home / 'worker-error.log').open('a', encoding='utf-8') as error:
            child = subprocess.Popen(command, stdout=output, stderr=error,
                                     creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            child.wait()
        if child.returncode == 10:  # authentication, competing consumer or webhook
            (home / 'stop-gateway').write_text('Manual connection repair required.', encoding='utf-8')
            return
        time.sleep(10)


if __name__ == '__main__':
    main()
