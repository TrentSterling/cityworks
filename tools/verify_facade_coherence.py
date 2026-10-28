"""Matched production-path renders against the preserved 0.5.1 release."""
from pathlib import Path
import functools,http.server,threading,json,subprocess,zipfile,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts/facade-coherence';OUT.mkdir(parents=True,exist_ok=True)
source=ROOT/'experiments/three-island-integration'
baseline=OUT/'baseline'
if not baseline.exists():
    archive=OUT/'baseline.zip'
    subprocess.run(['git','archive','--format=zip','--output='+str(archive),'2704c37d9935ce23300738ea20c07a638b09a52f'],cwd=ROOT,check=True)
    baseline.mkdir()
    with zipfile.ZipFile(archive) as z:
        assert all((baseline/n).resolve().is_relative_to(baseline.resolve()) for n in z.namelist())
        z.extractall(baseline)
for name in ['facade-coherence.html','facade-coherence.js','facade-fixture.js','facade-fixture.html','facade-fixture-config.js']:
    shutil.copy2(source/name,baseline/'experiments/three-island-integration'/name)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();report={}
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    try:
        for label,prefix in [('before','artifacts/facade-coherence/baseline/'),('after','')]:
            page=browser.new_page(viewport={'width':1600,'height':900});errors=[];report[label]={'errors':errors,'views':{}}
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/{prefix}experiments/three-island-integration/facade-coherence.html')
            page.wait_for_function('window.Coherence?.ready',timeout=60000)
            for view in ['front','oblique','rooms','roomsLeft','roomsRight']:
                page.evaluate('(v)=>Coherence.view(v)',view);page.wait_for_timeout(700)
                page.screenshot(path=str(OUT/f'{label}-{view}.png'));info=page.evaluate('Coherence.inspect()');report[label]['views'][view]=info
                assert not info['nonfinite']
            if label=='after':
                panels=report[label]['views']['front']['panels']
                fronts=[x for x in panels if x['volumeId']=='cream-split' and x['kind']==0]
                assert len(fronts)==3 and len({x['domainId'] for x in fronts})==1,fronts
                assert all(x['width']==32 and x['storeys']==6 for x in fronts)
                assert sum(x['edgeWidth'] for x in fronts)==32
                page.evaluate('Coherence.view("rooms")');page.wait_for_timeout(500);first=page.screenshot();page.wait_for_timeout(500);assert first==page.screenshot(),'Static room view must be deterministic'
            page.goto(f'http://127.0.0.1:{server.server_port}/{prefix}experiments/three-island-integration/facade-fixture.html')
            page.wait_for_function('window.FacadeFixture?.ready',timeout=60000)
            for style in ['brick','glass']:
                page.evaluate('(s)=>FacadeFixture.setStyle(s)',style);page.wait_for_timeout(600)
                page.screenshot(path=str(OUT/f'{label}-fit-{style}.png'));report[label]['fit-'+style]=page.evaluate('FacadeFixture.inspect()')
            assert not errors,errors
            page.close()
        report['status']='passed'
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');browser.close();server.shutdown();server.server_close()
print(json.dumps({'status':report['status'],'output':str(OUT)}))
