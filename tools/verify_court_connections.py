"""Matched baseline/revised renders and actual path surfaces. Software renderer is QA, not a hardware FPS claim."""
from pathlib import Path
import functools, http.server, json, threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/court-connections';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
report={'errors':[],'teardownMessages':[],'scenes':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--mute-audio','--use-angle=swiftshader','--enable-unsafe-webgpu','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1)
    page=None;phase=None
    def open_page(path):
        global page,phase
        if page:
            # Stop submissions and drain the GPU before intentionally closing a scene.
            page.evaluate("async()=>{const I=window.Integration||window.MassingEditor?.api();if(I){I.renderer.setAnimationLoop(null);await I.renderer.backend.device?.queue.onSubmittedWorkDone();}}")
            page.wait_for_timeout(200)
            phase['closing']=True
            page.close()
        page=context.new_page();phase={'closing':False};state=phase
        def error(message):
            if state['closing'] and message=='Instance dropped in popErrorScope':report['teardownMessages'].append(message)
            else:report['errors'].append(message)
        page.on('pageerror',lambda e:error(str(e)))
        page.on('console',lambda m:error(m.text) if m.type=='error' else None)
        page.goto(base+path,wait_until='domcontentloaded')
    try:
        def load(path):
            open_page(path);page.wait_for_function('window.Integration?.ready',timeout=180000)
            info=page.evaluate('Integration.inspect()');assert not info['nonfinite'] and not info['badNormals'],info
            return info
        for seed in ['CITYWORKS-03','COURT-OLD-1','COURT-OLD-2']:
            query='?seed='+seed+('&streetSpacing=94' if seed=='COURT-OLD-2' else '')
            info=load(query)
            routes=page.evaluate("Integration.city.publicRealm.courtRoutes.filter(r=>r.kind==='pedestrian-through')")
            assert routes
            checks=page.evaluate("""async()=>{
                const T=await import('three/webgpu'),I=Integration,C=CityFabric,ray=new T.Raycaster();I.scene.updateMatrixWorld(true);
                let samples=0;for(const r of I.city.publicRealm.courtRoutes.filter(r=>r.kind==='pedestrian-through')){
                    const dx=r.to[0]-r.from[0],dz=r.to[1]-r.from[1],len=Math.hypot(dx,dz),n=[-dz/len,dx/len];
                    for(let d=1;d<len;d+=2)for(const side of [-.95,0,.95]){
                        const p=[r.from[0]+dx*d/len+n[0]*side,r.from[1]+dz*d/len+n[1]*side];
                        ray.set(new T.Vector3(p[0],9,p[1]),new T.Vector3(0,-1,0));
                        const hits=ray.intersectObject(I.ground.group,true).filter(h=>!h.object.name.startsWith('tree-'));
                        if(!hits.length||Math.abs(hits[0].point.y-8.16)>.005)throw Error('Missing level paving '+r.id+' '+JSON.stringify(p));
                        samples++;
                    }
                    if(I.ground.markingInfo.treeSites.some(s=>C.inRegions(C.offset(r.polygons,2.7*s.scale),s.p)))throw Error('Tree obstructs through route '+r.id);
                }return {pavingSamples:samples,routeCount:I.city.publicRealm.courtRoutes.filter(r=>r.kind==='pedestrian-through').length};
            }""")
            report['scenes'].append({'seed':seed,'checks':checks,'stats':info['stats'],'render':info['render'],'geometryBytes':info['geometryBytes']})
            for label,path in [('after',query),('before','baseline/'+query)]:
                if label=='before':load(path)
                for i,r in enumerate(routes if seed=='CITYWORKS-03' else routes[:1]):
                    x=(r['from'][0]+r['to'][0])/2;z=(r['from'][1]+r['to'][1])/2
                    page.evaluate('(p)=>Integration.setCamera([p[0]+35,105,p[1]+40],[p[0],8.16,p[1]])',[x,z]);page.wait_for_timeout(1000)
                    page.screenshot(path=str(OUT/f'{seed}-{label}-{i}.png'))
        # Recover a real 0.5.4 versioned autosave without migrating geometry.
        load('')
        page.evaluate("()=>{const p=CityProject.create();p.generatorVersion=CityFabric.PREVIOUS_VERSION;localStorage.clear();localStorage.setItem('cityworks:scoped-project:1:'+p.generatorVersion,JSON.stringify(p));}")
        open_page('experiments/scoped-editor/')
        page.wait_for_function('window.MassingEditor?.api()?.ready',timeout=180000)
        assert page.evaluate('MassingEditor.session.project.generatorVersion')=='0.5.4-resolved-massing'
        assert page.evaluate("MassingEditor.api().city.publicRealm.courtRoutes.filter(r=>r.kind==='pedestrian-through').length")==0
        report['previousAutosave']='passed'
        load('artifacts/three-island-integration/Cityworks-Three-Island-Integration.html')
        assert page.evaluate("Integration.city.publicRealm.courtRoutes.filter(r=>r.kind==='pedestrian-through').length")==4
        report['standalone']='passed'
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/'standalone-mobile.png'))
        assert not report['errors'],report['errors']
        report['status']='passed'
    except Exception as e:
        report['status']='failed';report['exception']=str(e);page.screenshot(path=str(OUT/'failure.png'));raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');browser.close();server.shutdown()
