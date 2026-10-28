from pathlib import Path
import functools,http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts/building-fit/facades';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();report={}
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    try:
        for label,prefix in [('before','artifacts/building-fit/baseline/'),('after','')]:
            page=browser.new_page(viewport={'width':1600,'height':900});errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);report[label+'-errors']=errors
            page.goto(f'http://127.0.0.1:{server.server_port}/{prefix}experiments/three-island-integration/facade-fixture.html')
            page.wait_for_function('window.FacadeFixture?.ready',timeout=60000)
            for style in ['brick','glass']:
                page.evaluate('(s)=>FacadeFixture.setStyle(s)',style);page.wait_for_timeout(1200)
                page.screenshot(path=str(OUT/f'{label}-{style}.png'));report[label+'-'+style]=page.evaluate('FacadeFixture.inspect()')
            assert not errors,errors
            if label=='after':
                panels=report['after-brick']['panels'];assert panels
                assert all(p['kind']==3 for p in panels if not p['windowEligible'])
                assert all(abs(p['pier']*2+p['bays']*p['bayWidth']-p['width'])<1e-7 for p in panels)
            page.close()
        report['status']='passed'
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown();server.server_close()
