"""Apply the user's quiet gateway/scheduler policy to the installed Hermes runtime."""
from pathlib import Path
import argparse

OLD_ACK='busy_ack_enabled = os.environ.get("HERMES_GATEWAY_BUSY_ACK_ENABLED", "true").lower() == "true"'
NEW_ACK='busy_ack_enabled = False  # User policy: internal busy acknowledgments stay in logs.'
OLD_CRON='    media_files, cleaned_delivery_content = BasePlatformAdapter.extract_media(delivery_content)\n    media_files = BasePlatformAdapter.filter_media_delivery_paths(media_files)'
PREVIOUS_CRON=OLD_CRON+'''
    from cron.presentation_policy import is_technical_report
    if is_technical_report(cleaned_delivery_content):
        cleaned_delivery_content = ""
        if not media_files:
            logger.info("Technical cron report retained locally; chat delivery suppressed")
            return None
'''
NEW_CRON=OLD_CRON+"""
    from cron.presentation_policy import clean_report
    cleaned_delivery_content = clean_report(cleaned_delivery_content)
    if not cleaned_delivery_content.strip() and not media_files:
        logger.info("Technical cron report retained locally; chat delivery suppressed")
        return None
"""



def replace_once(source,old,new):
    if new in source:return source
    if source.count(old)!=1:raise ValueError('Hermes runtime changed; review the affected block')
    result=source.replace(old,new);compile(result,'<hermes-patched>','exec');return result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,required=True);parser.add_argument('--backup',type=Path,required=True);args=parser.parse_args()
    root=args.root.resolve();backup=args.backup.resolve()
    updates={}
    for name,old,new in [('gateway/run.py',OLD_ACK,NEW_ACK),('cron/scheduler.py',OLD_CRON,NEW_CRON)]:
        path=root/name;original=path.read_text(encoding='utf-8')
        if name=='cron/scheduler.py' and PREVIOUS_CRON in original:old=PREVIOUS_CRON
        updates[name]=(original,replace_once(original,old,new))
    policy=Path(__file__).with_name('hermes_cron_presentation.py').read_text(encoding='utf-8-sig');compile(policy,'<cron-policy>','exec')
    backup.mkdir(parents=True,exist_ok=True)
    for name,(original,patched) in updates.items():
        saved=backup/name;saved.parent.mkdir(parents=True,exist_ok=True)
        if not saved.exists():saved.write_text(original,encoding='utf-8')
        staged=(root/name).with_suffix('.quiet-staged');staged.write_text(patched,encoding='utf-8');staged.replace(root/name)
    (root/'cron/presentation_policy.py').write_text(policy,encoding='utf-8')
    print('Gateway busy messages disabled; cron diagnostic text suppressed, files preserved')


if __name__=='__main__':main()
