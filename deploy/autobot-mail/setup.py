"""Prepare private server mail configuration; never print secrets or start mail.

Run as root on the CRM host. The existing queue token is copied within that
host; Mail.ru's app password is entered separately in password.sh.
"""
import json
import os
from pathlib import Path
import subprocess

ROOT=Path('/opt/crm-secrets/autobot-mail')
EXPECTED={
    'sender_mode':'smtp_imap','inbox_mode':'smtp_imap','draft_mode':'template',
    'collect_replies':True,'sender_email':'pm.build.team@mail.ru',
    'smtp_host':'smtp.mail.ru','smtp_port':465,'smtp_security':'ssl',
    'imap_host':'imap.mail.ru','imap_port':993,
    'mail_password_file':'/run/autobot-mail/mail_password',
    'queue_token_file':'/run/autobot-mail/queue_token',
    'queue_url':'https://xn----7sbbfmcadxfphwltfbrtxh6z.xn--p1ai/autobot/api/agent-market/v1/buyer',
    'worker_id':'server-mail','outbox_dir':'/var/lib/autobot-mail',
}


def private_file(path,content):
    temp=path.with_suffix('.new')
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as out:
            out.write(content);out.flush();os.fsync(out.fileno())
        os.replace(temp,path)
    finally:
        if temp.exists():temp.unlink()


def main():
    if os.geteuid()!=0:raise SystemExit('Run this setup as root.')
    os.umask(0o077)
    ROOT.mkdir(parents=True,exist_ok=True,mode=0o700)
    if ROOT.is_symlink():raise SystemExit('Secret directory must not be a symlink.')
    ROOT.chmod(0o700)
    config=ROOT/'config.json'
    if config.exists() and json.loads(config.read_text())!=EXPECTED:
        raise SystemExit('Existing configuration differs; review it without overwriting.')
    details=json.loads(subprocess.check_output(['docker','inspect','pmbi-autobot'],text=True))[0]
    env=dict(value.split('=',1) for value in details['Config']['Env'] if '=' in value)
    token=env.get('MARKET_AGENT_TOKEN','')
    if len(token)<32 or any(c in token for c in '\r\n'):raise SystemExit('Queue token is not configured.')
    private_file(config,json.dumps(EXPECTED,ensure_ascii=False,indent=2)+'\n')
    private_file(ROOT/'queue_token',token)
    Path('/opt/code/auto_bot/data/mail-transport').mkdir(parents=True,exist_ok=True,mode=0o700)
    print(json.dumps({'prepared':True,'password_present':(ROOT/'mail_password').is_file(),'worker_started':False}))


if __name__=='__main__':main()
