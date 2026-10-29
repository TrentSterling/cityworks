"""Matched release-baseline views and actual rendered access-surface checks."""
from pathlib import Path
import argparse, functools, http.server, json, subprocess, threading, zipfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
OUT=ROOT/'artifacts/public-realm'/('live' if args.url else 'local');OUT.mkdir(parents=True,exist_ok=True)
baseline=OUT/'baseline'
if not args.url and not baseline.exists():
 archive=OUT/'baseline.zip';subprocess.run(['git','archive','--format=zip','--output='+str(archive),'7e46fff3704e4d2a841cdf861892b097426cba9f'],cwd=ROOT,check=True);baseline.mkdir()
 with zipfile.ZipFile(archive) as z:
  assert all((baseline/n).resolve().is_relative_to(baseline.resolve()) for n in z.namelist());z.extractall(baseline)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=None
if not args.url:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
base=args.url or f'http://127.0.0.1:{server.server_port}/'
report={}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
 try:
  cameras=None
  for label,url in ([('after',base)] if args.url else [('after',base),('before',base+'artifacts/public-realm/local/baseline/')]):
   errors=[];report[label]={'errors':errors,'views':{}};page=browser.new_page(viewport={'width':1600,'height':1100});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
   page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.Integration?.ready',timeout=90000)
   if cameras is None:
    cameras=page.evaluate("""()=>{const c=Integration.city,r=c.publicRealm,entry=r.entrances.find(e=>e.kind==='lobby'&&e.to[0]>-160&&e.to[0]<-60&&e.to[1]>-70&&e.to[1]<150),service=r.courtRoutes.find(e=>e.kind==='service'),b=c.buildings.find(b=>b.id==='parcel:21fd5298:building'),q=b.center;return {entry:{p:[entry.to[0]+entry.n[0]*9+entry.u[0]*5,10.1,entry.to[1]+entry.n[1]*9+entry.u[1]*5],t:[entry.to[0],9.7,entry.to[1]],id:entry.id},service:{p:[service.from[0],12,service.from[1]],t:[service.to[0],9,service.to[1]],id:service.id},apron:{p:[q[0]+35,52,q[1]+42],t:[q[0],8.16,q[1]],id:b.id}};}""")
    report['cameras']=cameras
   report[label]={'errors':errors,'views':{}}
   for view in ['street','passage','courtyard','entry','service','apron']:
    if view in cameras:page.evaluate('(v)=>Integration.setCamera(v.p,v.t)',cameras[view])
    else:page.evaluate('(v)=>Integration.setView(v)',view)
    page.wait_for_timeout(700);info=page.evaluate('Integration.inspect()');assert not info['nonfinite'] and not info['badNormals'],info
    report[label]['views'][view]={k:info[k] for k in ['render','materials','geometryBytes','buildMs','stats']}
    page.screenshot(path=str(OUT/(label+'-'+view+'.png')))
   if label=='after':
    # Raycast actual GPU geometry, not just the model polygons. The no-step
    # transition and block paving must physically reach the intended elevation.
    report[label]['surfaceChecks']=page.evaluate("""async()=>{const T=await import('three/webgpu'),I=Integration,r=I.city.publicRealm;I.scene.updateMatrixWorld(true);const ray=new T.Raycaster(),ground=(p)=>{ray.set(new T.Vector3(p[0],50,p[1]),new T.Vector3(0,-1,0));return ray.intersectObject(I.ground.group,true).filter(h=>h.object.name!=='tree-crowns'&&h.object.name!=='tree-trunks');};let ramps=0,entries=0,flareSamples=0;for(const e of r.entrances){const p=e.from.map((v,i)=>(v+e.to[i])/2);if(e.kind==='passage')continue;const hits=ground(p);if(!hits.length||Math.abs(hits[0].point.y-8.16)>.005)throw Error('Entrance paving height '+e.id);entries++;}for(const x of r.ramps){for(const along of [0,-x.halfWidth-.35,x.halfWidth+.35])for(const depth of [.05,x.run*.35,x.run*.65,x.run-.05]){const p=x.center.map((v,i)=>v+x.n[i]*depth+x.u[i]*along),hits=ground(p),expected=CityPublicRealm.rampHeight(x,p);if(!hits.length||Math.abs(hits[0].point.y-expected)>.004)throw Error('Ramp surface height '+JSON.stringify({id:x.id,p,along,depth,expected,hits:hits.slice(0,3).map(h=>({y:h.point.y,name:h.object.name}))}));if(along)flareSamples++;}ramps++;}return {entrances:entries,ramps,flareSamples};}""")
    page.locator('#buildings').click();assert not page.evaluate('Integration.ground.portals.visible && Integration.cityBuildings.group.visible');page.screenshot(path=str(OUT/'after-ground-only.png'));page.locator('#buildings').click()
   assert not errors,errors;page.close()
  report['status']='passed';print(json.dumps({'status':report['status'],'surfaceChecks':report['after']['surfaceChecks'],'street':report['after']['views']['street'],'errors':report['after']['errors']},indent=2))
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');browser.close()
  if server:server.shutdown();server.server_close()
