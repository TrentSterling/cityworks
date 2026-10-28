"""Isolated muted Chrome; no OS input. Run under the task GPU lease."""
from pathlib import Path
import functools,http.server,json,threading,argparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'artifacts'/'slop-adapter';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
parser=argparse.ArgumentParser();parser.add_argument('--pipeline',default='nyc');parser.add_argument('--data',default='generated');args=parser.parse_args()
prefix=args.data+'-'+args.pipeline
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    page=browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1)
    errors=[];logs=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:logs.append({'type':m.type,'text':m.text[:1000]}))
    try:
        page.goto(f'http://127.0.0.1:{server.server_port}/?pipeline={args.pipeline}&data={args.data}',wait_until='domcontentloaded',timeout=45000)
        page.wait_for_function('window.Adapter?.ready',timeout=90000)
        print('Renderer ready',flush=True)
        results={}
        if args.data=='generated':
            probes=page.evaluate('''() => {const d=Adapter.dataset,b=d.records.find(b=>b.id===d.report.cases.courtyardId),h=b.polygons[0].holes[0],x=h.reduce((s,p)=>s+p.x,0)/h.length,z=h.reduce((s,p)=>s+p.z,0)/h.length;return {courtyard:Adapter.roofHits(x,z),concave:Adapter.roofHits(...d.report.cases.concaveProbe)};}''')
            assert not probes['courtyard'] and not probes['concave'],probes
        for view in ['aerial','overhead','street','courtyard']:
            page.evaluate('(v)=>Adapter.setView(v)',view)
            page.wait_for_timeout(1400)
            page.screenshot(path=str(OUT/f'{prefix}-{view}.png'))
            info=page.evaluate('Adapter.inspect()');assert not info['nonfinite'] and not info['badNormals'],info
            results[view]=info
            print(json.dumps({'view':view,'render':info['render'],'materials':info['materials'],'details':info['details']}),flush=True)
        page.locator('#buildings').click();page.evaluate("Adapter.setView('overhead')");page.wait_for_timeout(500);page.screenshot(path=str(OUT/f'{prefix}-ground.png'))
        presence=None
        if args.pipeline=='sg':
            presence=page.evaluate('''async () => {const {buildOpenCityBuildings}=await import('./upstream/singapore/open-city-buildings.js');const g=Adapter.dataset.GEO,old=g.buildings,scene=new Adapter.scene.constructor();try{g.buildings=null;const absent=buildOpenCityBuildings(scene);g.buildings={types:[],data:[]};const empty=buildOpenCityBuildings(scene);const result={nullReturnsNull:absent===null,emptyReturnsObject:!!empty,emptyColliders:empty.colliders.length,emptyFootprints:empty.allBlocks[0].footprints.length};empty.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return result;}finally{g.buildings=old;}}''')
            assert presence=={'nullReturnsNull':True,'emptyReturnsObject':True,'emptyColliders':0,'emptyFootprints':0},presence
        assert not errors,errors
        report={'status':'passed','views':results,'roofVoidProbes':probes if args.data=='generated' else None,'missingVsEmptyBuildings':presence,'errors':errors,'logs':logs}
        (OUT/f'{prefix}-report.json').write_text(json.dumps(report,indent=2))
        print('PASS '+prefix,flush=True)
    except Exception as e:
        page.screenshot(path=str(OUT/f'{prefix}-failure.png'))
        report={'status':'failed','exception':str(e),'errors':errors,'logs':logs,'text':page.locator('body').inner_text()[:3000]}
        (OUT/f'{prefix}-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True);raise
    finally:browser.close();server.shutdown();server.server_close()
