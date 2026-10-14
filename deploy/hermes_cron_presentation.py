"""Do not publish scheduler diagnostics; keep normal results and file delivery."""
import re


def is_technical_report(text):
    value=str(text or '').casefold()
    diagnostic=bool(re.search(r'(?:\bexit code\b|код\s+выхода)\s*[:=]?\s*0\b|\bad[ -]hoc\b|\bunverified\b',value))
    test_report=bool(re.search(r'провер\w*|\btests?\b|тест\w*',value))
    success=bool(re.search(r'прош\w*|успеш\w*|\bpassed\b|\bsuccessful\b|(?:exit code|код\s+выхода)\s*[:=]?\s*0\b',value))
    failure=bool(re.search(r'\bfailed\b|\bfailure\b|\bcannot\b|не удалось|недоступ\w*|(?:exit code|код\s+выхода)\s*[:=]?\s*[1-9]\d*\b',value))
    return diagnostic and test_report and success and not failure


def clean_report(text):
    value=str(text or '')
    # Keep the actionable part of a failed task, without execution diagnostics.
    diagnostic=r'\bad[ -]hoc\b|\bunverified\b|\bexit code\b|код\s+выхода'
    if re.search(diagnostic,value,re.I) and re.search(r'провер\w*|тест\w*|\btests?\b',value,re.I):
        parts=re.split(r'(?<=[.!?])\s+|\n+',value)
        internal=diagnostic+r'|провер\w*|тест\w*|\btests?\b|временн\w*\s+(?:пап\w*|скрипт\w*)|файлы повторно не отправлялись'
        public=[p for p in parts if p.strip() and not re.search(internal,p,re.I)]
        return ' '.join(public) if public else ('' if is_technical_report(text) else 'Не удалось выполнить задание. Подробности сохранены в журнале.')
    return text
