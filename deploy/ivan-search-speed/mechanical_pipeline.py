"""Finite existing retry queue: one collector and one independent batch reviewer."""
from decimal import Decimal
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time

BASE=Path('/Users/egor/.hermes/profiles/commercial/workspace/volga-chrome-pilot-20261004')
ROOT=BASE/'full-tender-20261004'
WORK=BASE/'mechanical-pipeline-20261009'
PYTHON='/Users/egor/.hermes/hermes-agent/venv/bin/python'
STOP_EVENT=None


def save(path,value):
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2));tmp.replace(path)


def minor(value):
    return int((Decimal(str(value))*100).quantize(Decimal('1')))


def packet_item(raw,n,row):
    sources=[]
    files=sorted(raw.glob('ai-source-*.json')) or sorted(raw.glob('source-*.json'))
    files+=sorted(raw.glob('organic-source-*.json'))
    for f in files:
        data=json.loads(f.read_text());candidates=[]
        for i,c in enumerate(data.get('candidates',[])[:24]):
            candidates.append({'candidate_index':i,'price_minor':minor(c['price_rub']),
                'evidence':c['evidence'][:250],'context':c['context'][:350],
                'unit':c.get('unit'),'flags':c.get('flags',[])})
        sources.append({'source_id':f.name,'url':data.get('url'),
            'status':data.get('status','read'),'headings':data.get('headings',[])[:8],
            'relevant_text':data.get('relevant_text',[])[:35],'candidates':candidates,
            'note':data.get('note') or data.get('reason') or '',
            'snapshot_file':data.get('snapshot_file')})
    plan={'ai_requested':5,'organic_requested':3,'source_status_counts':{}}
    for s in sources:plan['source_status_counts'][s['status']]=plan['source_status_counts'].get(s['status'],0)+1
    return {'position':n,'position_key':row['position_key'],'name':row['name'],
        'quantity':row['quantity'],'unit':row['unit'],'specification':row.get('specification'),
        'region':'Рыбинск','sources':sources,'source_plan':plan,
        'candidates_truncated':any(len(json.loads(f.read_text()).get('candidates',[]))>24 for f in files)}


def validate_review(packet,response):
    expected={x['position']:x for x in packet['items']}
    items=response.get('items')
    if not isinstance(items,list) or len(items)!=len(expected):raise ValueError('Incomplete review')
    seen=set()
    for item in items:
        n=item.get('position');source=expected.get(n)
        if source is None or n in seen or item.get('position_key')!=source['position_key']:raise ValueError('Wrong review position')
        seen.add(n)
        if item.get('status') not in ('public_candidates','needs_recheck','spec_conflict','no_price'):raise ValueError('Wrong review status')
        sources={s['source_id']:s for s in source['sources']}
        if not isinstance(item.get('selected'),list) or not isinstance(item.get('problems'),list) or not isinstance(item.get('needs_recheck'),list):raise ValueError('Malformed review')
        for offer in item['selected']:
            s=sources.get(offer.get('source_id'));i=offer.get('candidate_index')
            if not s or s['status']!='read' or type(i) is not int or not 0<=i<len(s['candidates']):raise ValueError('Unverified source selected')
            price=offer.get('price_minor')
            if type(price) is not int or price<=0 or price!=s['candidates'][i]['price_minor']:raise ValueError('Invented/changed price')
        if any(s not in sources for s in item['needs_recheck']):raise ValueError('Invented recheck source')
    return response


def run_child(command,log,timeout):
    with log.open('a') as output:
        child=subprocess.Popen(command,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
        end=time.monotonic()+timeout
        try:
            while child.poll() is None:
                if STOP_EVENT is not None and STOP_EVENT.is_set():raise InterruptedError('Requested pipeline stop')
                if time.monotonic()>=end:raise TimeoutError('Child exceeded finite session limit')
                try:child.wait(timeout=min(2,max(.01,end-time.monotonic())))
                except subprocess.TimeoutExpired:pass
            return child.returncode
        except (TimeoutError,InterruptedError):
            os.killpg(child.pid,signal.SIGTERM)
            try:child.wait(timeout=15)
            except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            raise


def review_queue(work,deadline,stop,finished,execute=run_child):
    statepath=work/'reviewer-state.json';state={'status':'waiting',
        'reviewed_positions':sum(len(json.loads(f.read_text())['items']) for f in (work/'packets').glob('batch-????.review.json')),
        'failed_batches':len(list((work/'packets').glob('batch-????.failed.json')))}
    if state['failed_batches']:
        state.update(status='needs_attention',error='Saved failed review requires diagnosis');save(statepath,state);return
    while not stop.is_set() and time.time()<deadline:
        pending=[f for f in sorted((work/'packets').glob('batch-????.json'))
                 if not f.with_suffix('.review.json').exists() and not f.with_suffix('.failed.json').exists()]
        if not pending:
            if finished.is_set():break
            stop.wait(2);continue
        f=pending[0];state.update(status='reviewing',batch=f.name,started_at=time.time());save(statepath,state)
        try:
            code=execute([PYTHON,str(BASE/'review_packet.py'),str(f)],f.with_suffix('.log'),min(900,max(1,deadline-time.time())))
            if code:raise RuntimeError('Ivan review exited '+str(code))
            response=validate_review(json.loads(f.read_text()),json.loads(f.with_suffix('.response.json').read_text()))
            save(f.with_suffix('.review.json'),{'reviewed_at':time.time(),'model':'gpt-6-astra','effort':'xhigh','items':response['items'],'crm_written':False})
            state['reviewed_positions']+=len(response['items'])
            state.update(status='waiting',finished_at=time.time());save(statepath,state)
        except Exception as exc:
            if stop.is_set():break
            save(f.with_suffix('.failed.json'),{'at':time.time(),'reason':str(exc)[:500]})
            state['failed_batches']+=1;state.update(status='needs_attention',error=str(exc)[:500]);save(statepath,state)
            # No blind retries of authentication, access or malformed evidence.
            return
    pending=any(not f.with_suffix('.review.json').exists() for f in (work/'packets').glob('batch-????.json'))
    state.update(status='finished' if finished.is_set() and not stop.is_set() and not pending else 'stopped',finished_at=time.time());save(statepath,state)


def produce(work,positions,rows,deadline,stop):
    packets=work/'packets';statepath=work/'producer-state.json'
    ready={i['position'] for f in packets.glob('batch-????.json') for i in json.loads(f.read_text())['items']}
    number=max([int(f.stem.split('-')[1]) for f in packets.glob('batch-????.json')]+[0]);batch=[]
    state={'status':'running','collected_positions':len(ready),'total':len(positions),'pid':os.getpid()}
    def flush():
        nonlocal number,batch
        if batch:
            number+=1;save(packets/f'batch-{number:04}.json',{'created_at':time.time(),'items':batch});batch=[]
    try:
        for n in positions:
            if n in ready:continue
            if (work/'stop-request').exists():stop.set()
            if stop.is_set() or time.time()>deadline-60:break
            raw=work/'raw'/str(n);raw.mkdir(parents=True,exist_ok=True)
            state.update(status='collecting',current=n,started_at=time.time());save(statepath,state)
            if not (raw/'collected.json').exists():
                position_started=time.time()
                for mode,extra in [('discover',[]),('read',[]),('organic',[]),('read',['--stage','organic'])]:
                    marker=raw/f'{mode}-{extra[-1] if extra else "ai"}-done.json'
                    if marker.exists():continue
                    if stop.is_set() or (work/'stop-request').exists():break
                    while time.time()<deadline-60:
                        remaining=min(300,900-(time.time()-position_started),deadline-time.time())
                        if remaining<=0:raise TimeoutError('Position exceeded 900 seconds')
                        log=raw/f'{mode}-{extra[-1] if extra else "ai"}.log'
                        offset=log.stat().st_size if log.exists() else 0
                        code=run_child([PYTHON,str(BASE/'mechanical_pilot.py'),mode,str(n),'--pipeline',*extra],log,remaining)
                        with log.open('rb') as stream:stream.seek(offset);latest=stream.read().decode('utf-8',errors='replace')
                        if 'waiting_for_browser' in latest:
                            state.update(status='waiting_for_browser');save(statepath,state);stop.wait(10);continue
                        if code:raise RuntimeError(f'Collector position {n}, phase {mode}, exit {code}; inspect {log.name}')
                        if mode in ('discover','organic'):
                            d=json.loads((raw/('discovery.json' if mode=='discover' else 'organic-discovery.json')).read_text())
                            text='\n'.join(e.get('label','') for e in d.get('elements',[]) if e.get('role') in ('AXStaticText','AXHeading'))
                            if re.search(r'unusual traffic|подтвердите[\s\S]{0,80}(?:человек|робот)|я не робот|403 Forbidden|ERR_CERT_',text,re.I):
                                raise RuntimeError('Google access challenge: no retries or bypass')
                        break
                    if time.time()>deadline-60:raise TimeoutError('Deadline reached before complete collection')
                    save(marker,{'finished_at':time.time()})
                if stop.is_set() or (work/'stop-request').exists():break
                save(raw/'collected.json',{'finished_at':time.time(),'position':n})
            batch.append(packet_item(raw,n,rows[n-1]));state['collected_positions']+=1
            state.update(status='running',finished_at=time.time());save(statepath,state)
            if len(batch)==5:flush()
            stop.wait(2)
        flush()
        state.update(status='finished' if state['collected_positions']==len(positions) else 'stopped',finished_at=time.time());save(statepath,state)
    except Exception as exc:
        flush();state.update(status='stopped' if stop.is_set() else 'needs_attention',error=str(exc)[:500],finished_at=time.time());save(statepath,state)


def main():
    import fcntl
    global STOP_EVENT
    WORK.mkdir(exist_ok=True)
    with (WORK/'pipeline.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        consent=json.loads((WORK/'consent.json').read_text());deadline=consent['deadline']
        assert consent['tender_id']=='0171200001926000664' and time.time()<deadline
        assert len(set(consent['positions']))==len(consent['positions']) and all(type(n) is int and 1<=n<=213 for n in consent['positions'])
        source=json.loads((ROOT/'input.json').read_text())['source'];assert source['tender_id']==consent['tender_id']
        stop=threading.Event();finished=threading.Event()
        STOP_EVENT=stop
        def halt(signum,frame):stop.set()
        signal.signal(signal.SIGTERM,halt);signal.signal(signal.SIGINT,halt)
        reviewer=threading.Thread(target=review_queue,args=(WORK,deadline,stop,finished),name='ivan-review')
        reviewer.start()
        try:produce(WORK,consent['positions'],source['positions'],deadline,stop)
        finally:finished.set();reviewer.join()


if __name__=='__main__':main()
