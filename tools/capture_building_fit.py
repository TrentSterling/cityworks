from pathlib import Path
import functools,http.server,threading,json,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
label=sys.argv[1] if len(sys.argv)>1 else 'before'
out=ROOT/'artifacts/building-fit'/label;out.mkdir(parents=True,exist_ok=True)
baseline=json.loads((ROOT/'artifacts/building-fit/before/audit.json').read_text())
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'errors':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    try:
        page=browser.new_page(viewport={'width':1600,'height':1100})
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        query='?mapAreaKm2=2.673153068103' if label=='matched' else ''
        page.goto(f'http://127.0.0.1:{server.server_port}/experiments/three-island-integration/'+query)
        page.wait_for_function('window.Integration?.ready || document.querySelector("#error")?.textContent',timeout=100000)
        assert page.evaluate('!!window.Integration?.ready'),page.locator('#error').inner_text()
        for n,b in enumerate(baseline[:3]):
            x,z=b['center'];h=b['height'];camera=[x+30,h+20,z+35];target=[x,h*.45,z]
            page.evaluate('([p,t])=>Integration.setCamera(p,t)',[camera,target]);page.wait_for_timeout(900)
            page.screenshot(path=str(out/f'sliver-{n}.png'))
        for view in ['district','street','overhead']:
            page.evaluate('(v)=>Integration.setView(v)',view);page.wait_for_timeout(900);page.screenshot(path=str(out/(view+'.png')))
            report[view]=page.evaluate('Integration.inspect()');report[view].pop('frames',None)
        assert not report['errors'],report
        report['status']='passed'
    except Exception as e:
        report['exception']=str(e);page.screenshot(path=str(out/'failure.png'));raise
    finally:
        (out/'render.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown();server.server_close()
