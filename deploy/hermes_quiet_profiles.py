"""Apply quiet Telegram presentation to every existing Hermes profile."""
from pathlib import Path
import argparse
import os
import re
import shutil

QUIET = {'tool_progress':'off','long_running_notifications':False,'busy_ack_detail':False,
         'interim_assistant_messages':False,'show_reasoning':False,'streaming':False,
         'transcription_echo':False,'thinking_progress':False,'working_timer':False}
ENV_KEYS = ('HERMES_GATEWAY_BUSY_ACK_ENABLED','HERMES_TELEGRAM_APPROVAL_RESULT_ENABLED')


def quiet_config(config):
    display=config.setdefault('display',{})
    display.setdefault('platforms',{}).setdefault('telegram',{}).update(QUIET)
    return config


def quiet_env(content):
    for key in ENV_KEYS:
        content=re.sub(r'^\s*(?:export\s+)?'+key+r'\s*=.*\n?', '', content, flags=re.MULTILINE)
        content=content.rstrip()+'\n'+key+'=false\n'
    return content


def apply_profile(profile, backup_name):
    import yaml
    backup=profile/'backups'/backup_name
    backup.mkdir(parents=True,exist_ok=True)
    for name in ('config.yaml','.env'):
        source=profile/name; saved=backup/name
        if source.exists() and not saved.exists():
            shutil.copyfile(source,saved);os.chmod(saved,0o600)
    source=profile/'config.yaml'
    config=yaml.safe_load(source.read_text(encoding='utf-8'))
    source.write_text(yaml.safe_dump(quiet_config(config),allow_unicode=True,sort_keys=False),encoding='utf-8')
    env=profile/'.env';content=env.read_text(encoding='utf-8') if env.exists() else ''
    env.write_text(quiet_env(content),encoding='utf-8');os.chmod(env,0o600)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--backup-name',default='all-agents-quiet-20261014');args=parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+",args.backup_name):raise ValueError("Use a simple backup directory name")
    root=args.root.resolve()
    profiles=[root]+sorted(p for p in (root/'profiles').iterdir() if p.is_dir() and (p/'config.yaml').exists())
    for profile in profiles:
        if profile!=root and profile.resolve().parent!=root/'profiles':
            raise ValueError('Profile outside the selected Hermes root')
        apply_profile(profile,args.backup_name)
    print('Quiet Telegram configured for '+str(len(profiles))+' profiles')


if __name__=='__main__':main()
