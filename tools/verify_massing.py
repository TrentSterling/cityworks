"""Matched massing views against the preserved 0.5.3 release."""
from pathlib import Path
import argparse,functools,http.server,json,subprocess,threading,zipfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--before-only',action='store_true');args=parser.parse_args()
OUT=ROOT/'artifacts/massing-054'/('live' if args.url else 'local');OUT.mkdir(parents=True,exist_ok=True)
baseline=ROOT/'artifacts/massing-054/baseline'
if not args.url and not baseline.exists():
 archive=baseline.with_suffix('.zip');subprocess.run(['git','archive','--format=zip','--output='+str(archive),'791c0f92a40208f6cee2a9ae3f57624e8e6e8a5f'],cwd=ROOT,check=True);baseline.mkdir()
 with zipfile.ZipFile(archive) as z:
  assert all((baseline/n).resolve().is_relative_to(baseline.resolve()) for n in z.namelist());z.extractall(baseline)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=None
if not args.url:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
base=args.url or f'http://127.0.0.1:{server.server_port}/'
views={
 'notched-roof':{'p':[-105,50,-439],'t':[-140.428,18,-468.321]},
 'small-returns':{'p':[537,37,49],'t':[508.715,13,27.76]},
 'podium':{'p':[-85,64,-29],'t':[-129.602,20,3.874]},
 'perimeter':{'p':[642.764,52,-255.913],'t':[607.764,8.16,-297.913]},
}
report={'baseline':'791c0f92a40208f6cee2a9ae3f57624e8e6e8a5f','cameras':views}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
 try:
  runs=[('after',base)] if args.url else ([('before',base+'artifacts/massing-054/baseline/')] if args.before_only else [('before',base+'artifacts/massing-054/baseline/'),('after',base)])
  for label,url in runs:
   errors=[];page=browser.new_page(viewport={'width':1600,'height':1100});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
   page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.Integration?.ready',timeout=90000);report[label]={'errors':errors,'views':{}}
   for view in [*views,'street','courtyard']:
    if view in views:page.evaluate('(v)=>Integration.setCamera(v.p,v.t)',views[view])
    else:page.evaluate('(v)=>Integration.setView(v)',view)
    page.wait_for_timeout(600);info=page.evaluate('Integration.inspect()');assert not info['nonfinite'] and not info['badNormals'],info
    report[label]['views'][view]={k:info[k] for k in ['render','materials','geometryBytes','buildMs','stats']};page.screenshot(path=str(OUT/(label+'-'+view+'.png')))
   if label=='after':
    report[label]['meshChecks']=page.evaluate("""async()=>{const T=await import('three/webgpu'),I=Integration;I.scene.updateMatrixWorld(true);const ray=new T.Raycaster(),height=p=>{ray.set(new T.Vector3(p[0],50,p[1]),new T.Vector3(0,-1,0));return ray.intersectObject(I.ground.group,true).find(h=>h.object.name!=='tree-crowns'&&h.object.name!=='tree-trunks')?.point.y;};let entrances=0;for(const e of I.city.publicRealm.entrances){if(e.kind==='passage')continue;const p=e.from.map((v,i)=>(v+e.to[i])/2);if(Math.abs(height(p)-8.16)>.005)throw Error('Broken rendered approach '+e.id);entrances++;}const groups=new Map();let panels=0;I.scene.traverse(o=>{for(const p of o.userData.facadePanels||[]){panels++;const key=p.volumeId+'|'+p.ring+'|'+p.domainId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}});const joined=[...groups.values()].filter(x=>x.length>1);for(const g of joined){g.sort((a,b)=>a.domainOffset-b.domainOffset);if(new Set(g.map(x=>JSON.stringify([x.domainSeed,x.domainReverse,x.domainTangent]))).size!==1)throw Error('Mixed facade domain');for(let i=1;i<g.length;i++)if(Math.abs(g[i].brickOffset-g[i-1].brickOffset-g[i-1].edgeWidth)>1e-6)throw Error('Broken brick phase');}if(!joined.length||!panels)throw Error('Missing facade inspection data');return {renderedEntranceApproaches:entrances,facadePanels:panels,joinedDomains:joined.length};}""")
   assert not errors,errors;page.close()
  report['status']='passed';print(json.dumps(report,indent=2))
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');browser.close()
  if server:server.shutdown();server.server_close()
