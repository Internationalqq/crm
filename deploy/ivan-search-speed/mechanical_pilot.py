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
    p.add_argument('mode', choices=['discover', 'organic', 'read','review'])
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
        c = timed('capture', lambda: b.capture(mode='ax', app='Google Chrome'))
        es = [vars(e) for e in c.elements]
        c.window_title=captured_title(c.window_title,es)
        serial += 1
        save(out/f'{run_tag}-{serial}-ax.json', {'title': c.window_title, 'elements': es, 'at': time.time()})
        (out/f'{run_tag}-{serial}.png').write_bytes(base64.b64decode(c.png_b64))
        return c, es

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

    try:
        b.start()
        capture()
        if args.mode == 'review':
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
                deadline=time.monotonic()+10
                while True:
                    c,es=capture()
                    if not c.window_title.startswith(json.loads(discovery_file.read_text())['query'][:100]):break
                    if time.monotonic()>=deadline:raise RuntimeError('Source navigation not confirmed')
                    time.sleep(.5)
                try:
                    address=url()
                except RuntimeError as exc:
                    save(target,{'source_label':label,'status':'unverified_address','candidates':[],
                                 'reason':str(exc),'snapshot_file':f'{run_tag}-{serial}-ax.json'})
                    select_discovery()
                    continue
                from urllib.parse import urlsplit
                if not primary_url(address):
                    save(target,{'source_label':label,'url':address,'status':'unverified_primary_url',
                                 'candidates':[],'note':'Google redirect/wrapper is not accepted as a primary URL.'})
                    select_discovery()
                    continue
                deadline=time.monotonic()+10
                while True:
                    c,es=capture();record=extract(es)
                    text='\n'.join(e['label'] for e in es)
                    if 'captcha' in urlsplit(address).path.lower() or re.search(r'подтвердите[\s\S]{0,80}(?:человек|робот)|unusual traffic|ERR_CERT_|ERR_CONNECTION_|доступ ограничен|Access Denied|403 Forbidden',text,re.I):
                        record={'candidates':[],'status':'blocked_source','evidence':text[:2000],'no_retry':True};break
                    if record['candidates'] or record['headings'] or time.monotonic()>=deadline:break
                    time.sleep(1)
                record.update(url=address,title=c.window_title,source_label=label,at=time.time(),snapshot_file=f'{run_tag}-{serial}-ax.json')
                save(out/f'{args.stage}-source-{n}.json',record)
                print(json.dumps({'source':n,**record},ensure_ascii=False),flush=True)
                # Preserve this own page for review; return to the AI list.
                if args.stage=='organic' and record.get('status')!='blocked_source':key('cmd+[');capture()
                elif args.stage=='organic':select_discovery()
                else:select_discovery()
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
