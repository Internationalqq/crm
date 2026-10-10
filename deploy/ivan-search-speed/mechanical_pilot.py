"""Finite native-Chrome price extraction pilot; never resumes the main queue."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import sys
import time

BASE = Path('/Users/egor/.hermes/profiles/commercial/workspace/volga-chrome-pilot-20261004')
ROOT = BASE / 'full-tender-20261004'
PILOT = BASE / 'mechanical-pilot-20261009'


def primary_url(value):
    from urllib.parse import urlsplit
    try:
        u=urlsplit(value)
        return bool(u.scheme=='https' and u.hostname and not u.username and not u.password
                    and u.hostname.removeprefix('www.') not in ('google.com','accounts.google.com')
                    and not any(x in u.hostname for x in ('web.telegram.','mail.')))
    except ValueError:return False


def active_page_blocked(address,title,elements):
    """Inspect the active document, excluding background tab and menu labels."""
    from urllib.parse import urlsplit
    u=urlsplit(address)
    if re.search(r'captcha|/login|/signin|/auth',u.path,re.I):return True
    if u.hostname in ('google.com','www.google.com') and u.path.startswith('/sorry'):return True
    text='\n'.join(e.get('label','') for e in elements
                   if e.get('role') in ('AXStaticText','AXHeading','AXCheckBox','AXWebArea'))
    return bool(re.search(r'подтвердите[\s\S]{0,80}(?:человек|робот)|я не робот|unusual traffic|ERR_[A-Z_]+|доступ ограничен|Access Denied|401 Unauthorized|403 Forbidden',text,re.I)
                or re.search(r'ошибка сети|сайт недоступен|не удается получить доступ|This site can.t be reached',title,re.I))


def extract(elements):
    """Return candidates with literal evidence, never infer a unit or a match."""
    lines = []
    for e in elements:
        line = e.get('label','')
        if e.get('role') not in ('AXStaticText','AXHeading') or not line:continue
        if lines and line == lines[-1]:continue
        if line.strip() in ('₽','руб.','руб') and lines and re.fullmatch(r'\d[\d\s\u00a0\u202f]*(?:[,.]\d{1,2})?',lines[-1]):
            lines[-1] += ' '+line
        else:lines.append(line)
    candidates = []
    for i, line in enumerate(lines):
        for m in re.finditer(r'(?<!\d)(\d[\d\s\u00a0\u202f]*(?:[,.]\d{1,2})?)\s*(?:₽|руб\.?|р\.(?!\w))', line):
            amount = float(re.sub(r'\s', '', m.group(1)).replace(',', '.'))
            if amount <= 0:
                continue
            nearby = '\n'.join(lines[max(0, i-3):i+5])
            before = '\n'.join(lines[max(0,i-3):i+1])
            flags=[]
            if re.search(r'доставк',before,re.I):flags.append('delivery_or_delivery_threshold')
            if re.search(r'последняя цена|снят с (?:поставок|производства)',before,re.I):flags.append('historical_price')
            if re.search(r'Яндекс Пэй|с картой|для бизнеса|первый заказ',line,re.I):flags.append('conditional_price')
            candidates.append({'price_rub': amount, 'evidence': line,
                               'context': nearby, 'unit': 'шт' if re.search(r'(?:за|/)\s*шт\.?', nearby, re.I) else None,
                               'flags':flags,'status': 'unreviewed_candidate'})
    return {'candidates': candidates, 'headings': [e['label'] for e in elements if e.get('role') == 'AXHeading'],
            'relevant_text': [line for line in lines if re.search(r'артикул|модель|ндс|налич|под заказ|цена|руб|₽|БОН|TRASSIR|DuoStation', line, re.I)][:90]}


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))


def captured_title(fallback,elements):
    windows=[e['label'] for e in elements if e['role']=='AXWindow']
    return windows[0] if len(windows)==1 else fallback


def translation_close(elements):
    windows=[e for e in elements if e['role']=='AXWindow']
    if len(windows)!=1 or windows[0]['label']!='Перевести эту страницу?':return None
    if not any(e['role']=='AXButton' and e['label']=='Параметры перевода' for e in elements):return None
    if len([e for e in elements if e['role']=='AXRadioButton'])!=2:return None
    buttons=[e for e in elements if e['role']=='AXButton' and e['label']=='Закрыть']
    if len(buttons)!=1:return None
    x,y,w,h=windows[0].get('bounds',[0,0,0,0]);bx,by,bw,bh=buttons[0].get('bounds',[0,0,0,0])
    if min(w,h,bw,bh)<=0 or not (x<=bx and y<=by and bx+bw<=x+w and by+bh<=y+h):return None
    return buttons[0]['index']


def notification_close(elements):
    windows=[e for e in elements if e['role']=='AXWindow']
    if len(windows)!=1 or not re.fullmatch(r'Сайт [\w.-]+ запрашивает следующее разрешение: Показ уведомлений',windows[0]['label']):return None
    if {e['label'] for e in elements if e['role']=='AXButton'}!={'Закрыть','Блокировать','Разрешить'}:return None
    buttons=[e for e in elements if e['role']=='AXButton' and e['label']=='Закрыть']
    if len(buttons)!=1:return None
    x,y,w,h=windows[0].get('bounds',[0,0,0,0]);bx,by,bw,bh=buttons[0].get('bounds',[0,0,0,0])
    if min(w,h,bw,bh)<=0 or not (x<=bx and y<=by and bx+bw<=x+w and by+bh<=y+h):return None
    return buttons[0]['index']


def wait_source_navigation(capture,query,timeout=10,clock=time.monotonic,sleep=time.sleep):
    deadline=clock()+timeout
    while True:
        c,elements=capture()
        if not c.window_title.startswith(query[:100]):return c,elements
        if clock()>=deadline:return None
        sleep(.5)


def cleanup_targets(base,collected=False):
    targets={}
    work=base/'mechanical-pipeline-20261009'
    done={i['position'] for f in (work/'packets').glob('batch-????.review.json') for i in json.loads(f.read_text())['items']}
    if collected:
        done.update(i['position'] for f in (work/'packets').glob('batch-????.json')
                    for i in json.loads(f.read_text())['items']
                    if (work/'raw'/str(i['position'])/'collected.json').exists())
    for root in [base/'mechanical-pilot-20261009',work/'raw']:
        for folder in root.iterdir():
            if not folder.is_dir() or not folder.name.isdigit():continue
            n=int(folder.name)
            if (root==work/'raw' and n not in done) or (root!=work/'raw' and n not in range(66,73)):continue
            for f in folder.glob('*source-*.json'):
                d=json.loads(f.read_text())
                if d.get('status','read')!='read' or not primary_url(d.get('url','')) or not d.get('title'):continue
                title=d['title'].removesuffix(' - Google Chrome')
                targets.setdefault(title,set()).add(d['url'])
            for name in ['discovery.json','organic-discovery.json']:
                f=folder/name
                if f.exists():
                    d=json.loads(f.read_text())
                    if d.get('title') and d.get('query'):targets.setdefault(d['title'].removesuffix(' - Google Chrome'),set()).add('query:'+d['query'])
    return targets


def with_native_field_values(elements,native):
    fields={(e.get('element_index'),e.get('role'),e.get('label')):e for e in native}
    result=[{**e,'value':fields.get((e.get('index'),e.get('role'),e.get('label')),{}).get('value')}
            if e.get('role') in ('AXTextField','AXTextArea') else e for e in elements]
    seen={(e.get('index'),e.get('role'),e.get('label')) for e in elements}
    result += [{**e,'index':e['element_index']} for e in native
               if e.get('role') in ('AXTextField','AXTextArea','AXDialog','AXSheet','AXHeading','AXStaticText')
               and (e.get('element_index'),e.get('role'),e.get('label')) not in seen]
    return result


def cleanup_scan_args(name,args):
    if name=='get_window_state' and 'max_depth' not in args:
        return {**args,'max_depth':12,'max_elements':3000}
    return args


def verified_closed_tabs(before,title,snapshot):
    # AX tab strip can lag content once; verify again without another close action.
    for _ in range(2):
        tabs=snapshot()
        if len(tabs)==before-1 and not any(e.get('label')==title for e in tabs):return tabs
    raise RuntimeError('Tab close not confirmed')


def native_browser_tabs(elements):
    windows={e.get('element_index') for e in elements if e.get('role')=='AXWindow' and e.get('label','').endswith(' - Google Chrome')}
    tabs=[e for e in elements if e.get('role')=='AXRadioButton' and e.get('parent_index') in windows
          and e.get('depth')==2 and not e.get('in_web_content')]
    if not tabs:raise RuntimeError('Native Chrome tab inventory unavailable; cleanup not confirmed')
    return tabs


def cleanup_candidates(tabs,targets,preserved):
    return [e for e in tabs if e.get('label') in targets
            and sum(t.get('label')==e.get('label') for t in tabs)==1 and not e.get('pinned')
            and not any(x in json.dumps(e.get('attributes',{}),ensure_ascii=False).lower() for x in ['pinned','закреп'])
            and e.get('label') not in preserved]


def close_is_safe(title,address,elements,targets):
    from urllib.parse import urlsplit,parse_qs
    u=urlsplit(address);wanted=targets.get(title,set())
    owned_search=u.hostname in ('www.google.com','google.com') and u.path=='/search' and any('query:'+q in wanted for q in parse_qs(u.query).get('q',[]))
    if any(e.get('role') in ('AXDialog','AXSheet') for e in elements):return False
    for e in elements:
        if e.get('role')=='AXTextArea':
            value=e.get('value')
            empty_next_question=e.get('label')=='Задайте вопрос' and value in ('','Задайте вопрос')
            saved_query=e.get('label') in ('Поиск','Найти') and 'query:'+str(value) in wanted
            if not owned_search or not (empty_next_question or saved_query):return False
    for e in elements:
        if e.get('role')=='AXTextField' and 'Адресная' not in e.get('label',''):
            value=e.get('value',e.get('attributes',{}).get('value'))
            # Chrome AX reports these observed empty catalogue search placeholders as values.
            search_placeholder=e.get('label') in ('Поиск','Поиск по сайту','Поиск товаров',
                'Введите название, категорию или артикул','600+ брендов, 70 000 позиций') and value==e.get('label')
            saved_query=owned_search and e.get('label') in ('Поиск','Найти') and 'query:'+str(value) in wanted
            if value is None or (str(value).strip() and not search_placeholder and not saved_query):return False
    if re.search(r'captcha|/login|/signin|/auth',address,re.I):return False
    text='\n'.join(e.get('label','') for e in elements if e.get('role') in ('AXHeading','AXStaticText'))
    if re.search(r'подтвердите[\s\S]{0,80}(?:человек|робот)|unusual traffic|Access Denied|401 Unauthorized|403 Forbidden|ERR_CERT_|ERR_SSL_|доступ ограничен',text,re.I):return False
    if primary_url(address) and address in wanted:return True
    return owned_search


def observed_link(elements, label):
    matches = [e for e in elements if e['role']=='AXLink' and e['label']==label]
    if len(matches)>1 and len({tuple(e.get('bounds',[])) for e in matches})==1:
        bounds=matches[0].get('bounds',[])
        if len(bounds)==4 and bounds[2]>0 and bounds[3]>0:
            return matches[0]
    if len(matches)!=1:raise RuntimeError('Observed link missing or ambiguous: '+label)
    return matches[0]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('mode', choices=['discover', 'organic', 'read','review','cleanup'])
    p.add_argument('--cleanup-preview',action='store_true')
    p.add_argument('--cleanup-collected',action='store_true')
    p.add_argument('position', type=int, choices=range(1,214))
    p.add_argument('--pipeline', action='store_true')
    p.add_argument('--labels', nargs='*', default=[])
    p.add_argument('--stage', choices=['ai','organic'], default='ai')
    p.add_argument('--source', type=int, choices=range(1,6), default=2)
    args = p.parse_args()
    assert (ROOT/'stop-request').exists(), 'Main queue must remain paused'
    if args.pipeline:
        consent=json.loads((BASE/'mechanical-pipeline-20261009'/'consent.json').read_text())
        assert consent['tender_id']=='0171200001926000664'
        assert args.position in consent['positions'] and time.time()<consent['deadline']
        global PILOT
        PILOT=BASE/'mechanical-pipeline-20261009'/'raw'
    else:
        assert args.position in range(66,73), 'Campaign positions require pipeline consent'
    def stop(signum, frame):
        raise InterruptedError('Mechanical collection stopped')
    signal.signal(signal.SIGTERM,stop)
    os.environ['PATH'] = '/Users/egor/.local/bin:/opt/homebrew/bin:' + os.environ.get('PATH', '')
    os.environ['HERMES_HOME'] = '/Users/egor/.hermes/profiles/commercial'
    sys.path[:0] = ['/Users/egor/.hermes/hermes-agent', '/Users/egor/.hermes/team-browser-access']
    import browser_lock
    from tools.computer_use.cua_backend import CuaDriverBackend
    sp = importlib.util.spec_from_file_location('existing_pilot', ROOT/'ivan_pilot_session.py')
    wrapper = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(wrapper)
    original = CuaDriverBackend._select_content_window
    CuaDriverBackend._select_content_window = lambda self, ws: wrapper.select_chrome_content(ws, lambda cs: original(self, cs))
    if args.pipeline:
        from browser_turn_queue import acquire_turn
        held=acquire_turn(browser_lock,Path(browser_lock.__file__).parent/'state','commercial')
    else:
        held = browser_lock.operation(Path(browser_lock.__file__).parent/'state', 'acquire', 'commercial')
    if held['status'] != 'acquired':
        print(json.dumps({'status': 'waiting_for_browser', 'owner': held.get('owner')}));return
    b = CuaDriverBackend(allowed_apps=['Google Chrome'], keyboard_delivery_mode='foreground')
    out = PILOT / str(args.position)
    out.mkdir(parents=True, exist_ok=True)
    discovery_file = out/('organic-discovery.json' if args.stage=='organic' or args.mode=='organic' else 'discovery.json')
    timings = []
    started = time.time()
    serial = 0
    run_tag = f'{args.mode}-{args.stage}-{int(started)}'

    def timed(name, fn):
        t = time.monotonic()
        result = fn()
        timings.append({'action': name, 'seconds': round(time.monotonic()-t, 3)})
        if getattr(result, 'ok', True) is False or (isinstance(result, dict) and result.get('isError')):
            raise RuntimeError(f'{name} rejected: {getattr(result, "message", str(result))[:500]}')
        return result

    def capture():
        nonlocal serial
        for attempt in range(2):
            c = timed('capture', lambda: b.capture(mode='ax', app='Google Chrome'))
            es = [vars(e) for e in c.elements]
            c.window_title=captured_title(c.window_title,es)
            serial += 1
            save(out/f'{run_tag}-{serial}-ax.json', {'title': c.window_title, 'elements': es, 'at': time.time()})
            (out/f'{run_tag}-{serial}.png').write_bytes(base64.b64decode(c.png_b64))
            close=translation_close(es)
            action='close_observed_translation_popup'
            if close is None:close=notification_close(es);action='dismiss_observed_notification_request'
            if close is None:return c,es
            if attempt:raise RuntimeError('Observed Chrome popup did not close')
            timed(action,lambda:b.click(element=close))

    def key(keys):
        timed(keys, lambda: b.key(keys))

    def field(es, label):
        matches = [e for e in es if e['role'] in ('AXTextField', 'AXTextArea') and label.lower() in e['label'].lower()]
        if len(matches) != 1:
            raise RuntimeError(f'Expected one field {label}: {len(matches)}')
        return matches[0]['index']

    def url():
        key('cmd+l');capture()
        for _ in range(5):
            raw = timed('address_value', lambda: b.call_tool('get_window_state', {'pid': b._active_pid, 'window_id': b._active_window_id,
                             'include_screenshot': False, 'query': 'Адресная строка'}))
            es = (raw.get('structuredContent') or {}).get('elements') or []
            values = [e.get('value') for e in es if e.get('role') == 'AXTextField' and e.get('value')]
            if len(values)==1 and values[0].startswith('https://'):break
            time.sleep(.5)
        key('escape')
        if len(values) != 1 or not values[0].startswith('https://'):
            raise RuntimeError('Exact HTTPS address unavailable')
        return values[0]

    def select_discovery():
        c, es = capture()
        query = json.loads(discovery_file.read_text())['query']
        raw=timed('tab_strip_snapshot',lambda:b.call_tool('get_window_state',{'pid':b._active_pid,'window_id':b._active_window_id,
                                                   'max_depth':25,'max_elements':10000,'include_screenshot':False}))
        native=(raw.get('structuredContent') or {}).get('elements') or []
        save(out/'tab-strip.json',{'query':query,'tabs':[e for e in native if e['role']=='AXRadioButton']})
        b._snapshot_tokens={e['element_index']:e['element_token'] for e in native if e.get('element_token')}
        tabs = [e for e in native if e['role']=='AXRadioButton' and e.get('label','').startswith(query)]
        if not tabs and args.stage=='organic':
            from urllib.parse import quote_plus
            key('cmd+t');capture();key('cmd+l');c,es=capture()
            address='https://www.google.com/search?q='+quote_plus(query)
            timed('restore_own_organic_list',lambda:b.set_value(address,element=field(es,'Адресная строка')))
            capture();key('return');time.sleep(1)
            return capture()
        if len(tabs)!=1:raise RuntimeError('Exact own AI tab unavailable')
        timed('select_own_ai_tab',lambda:b.click(element=tabs[0]['element_index']))
        c,es=capture()
        if not c.window_title.startswith(query[:100]):raise RuntimeError('Wrong discovery page')
        return c,es

    def tabs_snapshot():
        capture()
        raw=timed('cleanup_tab_snapshot',lambda:b.call_tool('get_window_state',{'pid':b._active_pid,'window_id':b._active_window_id,'max_depth':25,'max_elements':15000,'include_screenshot':False}))
        native=(raw.get('structuredContent') or {}).get('elements') or []
        b._snapshot_tokens={e['element_index']:e['element_token'] for e in native if e.get('element_token')}
        return native_browser_tabs(native)

    def cleanup_fields(es):
        raw=timed('cleanup_field_values',lambda:b.call_tool('get_window_state',{'pid':b._active_pid,'window_id':b._active_window_id,'max_depth':25,'max_elements':15000,'include_screenshot':False}))
        native=(raw.get('structuredContent') or {}).get('elements') or []
        if not native:raise RuntimeError('Native cleanup field inventory unavailable')
        return with_native_field_values(es,native)

    def close_saved_source(record):
        title=record['title'].removesuffix(' - Google Chrome')
        tabs=tabs_snapshot();same=[t for t in tabs if t.get('label')==title]
        if len(tabs)<=1 or len(same)!=1 or same[0].get('pinned') or any(x in json.dumps(same[0].get('attributes',{}),ensure_ascii=False).lower() for x in ['pinned','закреп']):return False
        c,es=capture();address=url();c,es=capture();es=cleanup_fields(es)
        if c.window_title.removesuffix(' - Google Chrome')!=title or not close_is_safe(title,address,es,{title:{record['url']}}):return False
        audit_path=out/'tab-cleanup.json';audit=json.loads(audit_path.read_text()) if audit_path.exists() else {'closed':[]}
        audit['closing']={'title':title,'url':address,'reason':'Own source read and saved; no unfinished form'};save(audit_path,audit)
        key('cmd+w');capture();after=verified_closed_tabs(len(tabs),title,tabs_snapshot)
        audit['closed'].append(audit.pop('closing'));audit['tabs_after']=len(after);save(audit_path,audit);return True

    try:
        b.start()
        if args.mode=='cleanup':
            session_call=b._session.call_tool
            b._session.call_tool=lambda name,params,**kw:session_call(name,cleanup_scan_args(name,params),**kw)
        capture()
        if args.mode == 'cleanup':
            assert not args.cleanup_collected or args.pipeline, 'Collected cleanup requires existing pipeline consent'
            targets=cleanup_targets(BASE,args.cleanup_collected);audit_path=out/'tab-cleanup.json'
            audit=json.loads(audit_path.read_text()) if audit_path.exists() else {'closed':[],'preserved':[],'started_at':time.time()}
            tabs=tabs_snapshot();audit.setdefault('tabs_before',len(tabs))
            if 'closing' in audit:
                if len(tabs)!=audit.get('tabs_after',audit['tabs_before'])-1 or any(e.get('label')==audit['closing']['title'] for e in tabs):raise RuntimeError('Pending close cannot be verified; no repeated close')
                audit['closed'].append(audit.pop('closing'));audit['tabs_after']=len(tabs);save(audit_path,audit)
            save(out/'cleanup-inventory.json',{'targets':{k:sorted(v) for k,v in targets.items()},'tabs':tabs})
            if args.cleanup_preview:
                print(json.dumps({'tabs':len(tabs),'matched':sum(e.get('label') in targets for e in tabs)},ensure_ascii=False));return
            audit.pop('finished_at',None);audit['resumed_at']=time.time();save(audit_path,audit)
            while len(tabs)>1:
                eligible=cleanup_candidates(tabs,targets,audit['preserved'])
                if not eligible:
                    tabs=tabs_snapshot();eligible=cleanup_candidates(tabs,targets,audit['preserved'])
                if not eligible:break
                tab=eligible[0];title=tab['label'];timed('select_completed_own_tab',lambda:b.click(element=tab['element_index']))
                try:
                    c,es=capture();address=url();c,es=capture();es=cleanup_fields(es)
                except RuntimeError as exc:
                    if 'AX tree walk' not in str(exc) or 'timed out' not in str(exc):raise
                    audit['preserved'].append(title);audit.setdefault('preserved_reasons',{})[title]=str(exc)
                    save(audit_path,audit);tabs=tabs_snapshot();continue
                wanted=targets[title]
                if c.window_title.removesuffix(' - Google Chrome')!=title or not close_is_safe(title,address,es,targets):audit['preserved'].append(title);save(audit_path,audit);tabs=tabs_snapshot();continue
                before=len(tabs);audit['closing']={'title':title,'url':address,'reason':'Own captured source/list; completed saved position; no unfinished input'};save(out/'tab-cleanup.json',audit)
                key('cmd+w');capture();tabs=verified_closed_tabs(before,title,tabs_snapshot)
                audit['closed'].append(audit.pop('closing'));audit['tabs_after']=len(tabs);save(out/'tab-cleanup.json',audit)
                print(json.dumps({'closed':len(audit['closed']),'remaining':len(tabs),'title':title},ensure_ascii=False),flush=True)
            audit.update(finished_at=time.time(),tabs_after=len(tabs));save(out/'tab-cleanup.json',audit)
        elif args.mode == 'review':
            f=out/f'ai-source-{args.source}.json'
            if not f.exists():f=out/f'source-{args.source}.json'
            previous=json.loads(f.read_text())
            wanted=previous['title'].removesuffix(' - Google Chrome')
            raw=timed('tab_strip_snapshot',lambda:b.call_tool('get_window_state',{'pid':b._active_pid,'window_id':b._active_window_id,'max_depth':3,'max_elements':1000}))
            native=(raw.get('structuredContent') or {}).get('elements') or []
            tabs=[e for e in native if e['role']=='AXRadioButton' and e.get('label')==wanted]
            if len(tabs)!=1:raise RuntimeError('Review source tab ambiguous; preserve it')
            b._snapshot_tokens={e['element_index']:e['element_token'] for e in native if e.get('element_token')}
            timed('select_review_tab',lambda:b.click(element=tabs[0]['element_index']))
            capture();address=url()
            if address!=previous['url']:raise RuntimeError('Review URL changed')
            c,es=capture();record=extract(es)
            record.update(url=address,title=c.window_title,source_label=previous['source_label'],at=time.time(),snapshot_file=f'{run_tag}-{serial}-ax.json')
            save(out/f'review-source-{args.source}.json',record)
            print(json.dumps(record,ensure_ascii=False))
        elif args.mode == 'organic':
            from urllib.parse import quote_plus
            row = json.loads((ROOT/'input.json').read_text())['source']['positions'][args.position-1]
            query = row['name']+' цена Рыбинск'
            address = 'https://www.google.com/search?q='+quote_plus(query)
            key('cmd+t');capture();key('cmd+l');c,es=capture()
            timed('organic_query_set_value',lambda:b.set_value(address,element=field(es,'Адресная строка')))
            capture();key('return')
            deadline=time.monotonic()+15
            while True:
                c,es=capture()
                headings=[e for e in es if e['role']=='AXHeading']
                if len(headings)>=3 or time.monotonic()>=deadline:break
                time.sleep(1)
            links=[]
            for e in headings:
                before=[x for x in es if x['role']=='AXLink' and 0<e['index']-x['index']<=3]
                if before:
                    link=before[-1]
                    if len(link['label'])>8 and link['label'] not in [x['label'] for x in links]:links.append(link)
            distinct=[];domains=set()
            for link in links:
                m=re.search(r'https://([^\s/›]+)',link['label'])
                if m and m.group(1).removeprefix('www.') not in domains:
                    domains.add(m.group(1).removeprefix('www.'));distinct.append(link)
            save(discovery_file,{'query':query,'title':c.window_title,'links':distinct[:3],'elements':es})
            print(json.dumps({'position':args.position,'organic_links':[(e['index'],e['label']) for e in links],
                              'headings':[(e['index'],e['label']) for e in headings]},ensure_ascii=False))
        elif args.mode == 'discover':
            row = json.loads((ROOT/'input.json').read_text())['source']['positions'][args.position-1]
            excluded = ' Исключи cmoshop.ru и tokarsenal.ru.' if args.position==66 else ''
            query = f"Дай 5 разных сайтов с прямыми карточками товара {row['name']}, {row['quantity']} {row['unit']}, доставка Рыбинск. Нужна точная модель, цена, единица, НДС и наличие.{excluded} Дай список из пяти ссылок с подписями Перейти 1, Перейти 2, Перейти 3, Перейти 4, Перейти 5."
            key('cmd+t');c, es = capture()
            buttons = [e for e in es if e['role'] == 'AXButton' and 'Режим ИИ' in e['label']]
            if len(buttons) != 1:raise RuntimeError('AI entry unavailable')
            timed('ai_entry_click', lambda: b.click(element=buttons[0]['index']))
            c, es = capture()
            inputs = [e for e in es if e['role'] in ('AXTextArea','AXTextField') and 'Адресная' not in e['label']]
            if len(inputs) != 1:raise RuntimeError('AI question field ambiguous')
            timed('question_set_value', lambda: b.set_value(query, element=inputs[0]['index']))
            capture();key('return')
            deadline = time.monotonic()+45
            while True:
                c, es = capture()
                links = [e for e in es if e['role']=='AXLink' and re.search(r'Перейти\s*[1-5]',e['label'],re.I)]
                save(discovery_file, {'query':query,'title':c.window_title,'links':links,'elements':es})
                if len(links)>=5 or time.monotonic()>=deadline:break
                time.sleep(2)
            print(json.dumps({'position':args.position,'links':[(e['index'],e['label']) for e in links],
                              'text':'\n'.join(e['label'] for e in es if e['role'] in ('AXStaticText','AXHeading','AXLink'))[-15000:]},ensure_ascii=False))
        else:
            labels = args.labels or list(dict.fromkeys(e['label'] for e in json.loads(discovery_file.read_text())['links']))[:5]
            for n,label in enumerate(labels,1):
                target=out/f'{args.stage}-source-{n}.json'
                if target.exists() and json.loads(target.read_text()).get('source_label')==label:continue
                if args.stage=='organic':
                    from urllib.parse import urlsplit
                    domain=re.search(r'https://([^\s/›]+)',label)
                    prior=list(out.glob('ai-source-*.json')) or list(out.glob('source-*.json'))
                    same=[f for f in prior if domain and (urlsplit(json.loads(f.read_text()).get('url','')).hostname or '').removeprefix('www.')==domain.group(1).removeprefix('www.')]
                    if same:
                        save(target,{'source_label':label,'status':'reused_ai_domain','reuse_from':same[0].name,
                                     'note':'Same provider checked once; organic card itself not read again.'});continue
                c, es = select_discovery()
                for _ in range(4):
                    matches=[e for e in es if e['role']=='AXLink' and e['label']==label]
                    if not matches or any(e.get('bounds',[0,0,0,0])[2]>0 for e in matches):break
                    timed('reveal_observed_link',lambda:b.scroll(direction='down',amount=4))
                    c,es=capture()
                try:
                    link = observed_link(es,label)
                except RuntimeError as exc:
                    save(target,{'source_label':label,'status':'navigation_unresolved','candidates':[],
                                 'reason':str(exc),'snapshot_file':f'{run_tag}-{serial}-ax.json'})
                    continue
                timed('source_click',lambda:b.click(element=link['index']))
                navigation=wait_source_navigation(capture,json.loads(discovery_file.read_text())['query'])
                if navigation is None:
                    save(target,{'source_label':label,'status':'navigation_unresolved','candidates':[],
                                 'reason':'Source navigation not confirmed within 10 seconds; no repeated click',
                                 'snapshot_file':f'{run_tag}-{serial}-ax.json'})
                    continue
                c,es=navigation
                try:
                    address=url()
                except RuntimeError as exc:
                    save(target,{'source_label':label,'status':'unverified_address','candidates':[],
                                 'reason':str(exc),'snapshot_file':f'{run_tag}-{serial}-ax.json'})
                    continue
                from urllib.parse import urlsplit
                if not primary_url(address):
                    save(target,{'source_label':label,'url':address,'status':'unverified_primary_url',
                                 'candidates':[],'note':'Google redirect/wrapper is not accepted as a primary URL.'})
                    continue
                deadline=time.monotonic()+10
                while True:
                    c,es=capture();record=extract(es)
                    text='\n'.join(e.get('label','') for e in es if e.get('role') in ('AXStaticText','AXHeading','AXCheckBox','AXWebArea'))
                    if active_page_blocked(address,c.window_title,es):
                        record={'candidates':[],'status':'blocked_source','evidence':text[:2000],'no_retry':True};break
                    if record['candidates'] or record['headings'] or time.monotonic()>=deadline:break
                    time.sleep(1)
                record.update(url=address,title=c.window_title,source_label=label,at=time.time(),snapshot_file=f'{run_tag}-{serial}-ax.json')
                save(out/f'{args.stage}-source-{n}.json',record)
                print(json.dumps({'source':n,**record},ensure_ascii=False),flush=True)
                # Reviewer reads saved evidence; completed source tabs can close.
                if not args.pipeline and record.get('status','read')=='read':close_saved_source(record)
                # The next iteration binds a fresh discovery capture once.
                # Preserve skipped sources and unfinished forms in place.
    except Exception as exc:
        save(out/'error.json',{'error':str(exc),'at':time.time()})
        print(json.dumps({'error':str(exc)},ensure_ascii=False));raise
    finally:
        measurement={'started_at':started,'finished_at':time.time(),'seconds':time.time()-started,'actions':timings}
        save(out/f'{run_tag}-timing.json',measurement)
        save(out/f'{args.mode}-{args.stage}-timing.json',measurement)
        try:b.stop()
        finally:browser_lock.operation(Path(browser_lock.__file__).parent/'state','release','commercial',held['ticket'])


if __name__ == '__main__':main()
