"""Matched storefront views and actual transformed-mesh checks against 0.5.4."""
from pathlib import Path
import argparse,functools,http.server,json,math,subprocess,threading,zipfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
OUT=ROOT/'artifacts/storefronts-055'/('live' if args.url else 'local');OUT.mkdir(parents=True,exist_ok=True)
baseline=ROOT/'artifacts/storefronts-055/baseline';commit='a8d8a1d9c25792750d8e310b6976012f6a7e8dd3'
if not args.url and not baseline.exists():
 archive=baseline.with_suffix('.zip');subprocess.run(['git','archive','--format=zip','--output='+str(archive),commit],cwd=ROOT,check=True);baseline.mkdir()
 with zipfile.ZipFile(archive) as z:
  assert all((baseline/n).resolve().is_relative_to(baseline.resolve()) for n in z.namelist());z.extractall(baseline)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=None
if not args.url:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
base=args.url or f'http://127.0.0.1:{server.server_port}/'
views={'books':{'p':[-687,9.86,160],'t':[-687,11,182.848]},'cafe':{'p':[-592,9.86,160],'t':[-592,11,182.848]},
 'oblique':{'p':[-682,9.86,172],'t':[-693.179,10.9,182.848]},'industrial':{'p':[-780,9.86,162],'t':[-785.847,10.9,182.848]},
 'angled':{'p':[-99,9.86,218],'t':[-118.034,10.9,209.077]}}
report={'baseline':commit,'cameras':views}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
 try:
  for label,url in ([('after',base)] if args.url else [('before',base+'artifacts/storefronts-055/baseline/'),('after',base)]):
   errors=[];page=browser.new_page(viewport={'width':1600,'height':1100});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
   page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.Integration?.ready',timeout=90000)
   report[label]={'views':{},'errors':errors}
   for name in [*views,'street']:
    if name=='street':page.evaluate("Integration.setView('street')")
    else:page.evaluate('(v)=>Integration.setCamera(v.p,v.t)',views[name])
    page.wait_for_timeout(600);info=page.evaluate('Integration.inspect()');assert not info['nonfinite'] and not info['badNormals'],info
    report[label]['views'][name]={k:info[k] for k in ['render','materials','geometryBytes','details']};page.screenshot(path=str(OUT/(label+'-'+name+'.png')))
   report[label]['storefronts']=page.evaluate("Integration.cityBuildings.allBlocks.flatMap(b=>b.awnings.map(a=>({volumeId:b.id,...a})))")
   if label=='after':
    report[label]['meshChecks']=page.evaluate("""async()=>{const T=await import('three/webgpu'),{STOREFRONT_METRICS:M}=await import(new URL('facade-layout.js',document.baseURI).href),I=Integration,seen=new Set();I.scene.updateMatrixWorld(true);const matrix=new T.Matrix4(),v=new T.Vector3();let checked=0,signs=0;
      for(const block of I.cityBuildings.allBlocks){for(const a of block.awnings){const e=I.city.publicRealm.entrances.find(e=>e.id===a.entranceId);if(!e||e.kind==='passage')throw Error('Missing shop access');if(a.sign.y+a.sign.h/2>=a.baseY+3.4)throw Error('Sign enters upper storey');if(a.y-M.canopyValance<e.elevation+e.doorHeight+.029)throw Error('Canopy reduces door clearance');}}
      const mesh=I.scene.getObjectByName('storefront-canopies');if(!mesh||!mesh.count)throw Error('Missing canopy meshes');
      for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14],a=I.cityBuildings.allBlocks.flatMap(b=>b.awnings).find(a=>Math.hypot(a.x-x,a.z-z)<.001);if(!a)throw Error('Unknown rendered canopy');const e=I.city.publicRealm.entrances.find(e=>e.id===a.entranceId);let low=Infinity,high=-Infinity;for(let j=0;j<mesh.geometry.attributes.position.count;j++){v.fromBufferAttribute(mesh.geometry.attributes.position,j).applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);low=Math.min(low,v.y);high=Math.max(high,v.y);const depth=(v.x-a.wallX)*a.nx+(v.z-a.wallZ)*a.nz;if(depth<M.wallGap-.001||depth>M.wallGap+a.w+.001)throw Error('Canopy intersects wall');}if(low<e.elevation+e.doorHeight+.029||high>a.sign.y-a.sign.h/2-.029)throw Error('Transformed canopy clearance');checked++;seen.add(a.id);}
      for(const mesh of I.cityBuildings.group.children.filter(o=>o.name.startsWith('storefront-sign-')))for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14],a=I.cityBuildings.allBlocks.flatMap(b=>b.awnings).find(a=>Math.hypot(a.sign.x-x,a.sign.z-z)<.001);if(!a)throw Error('Unknown sign');for(let j=0;j<mesh.geometry.attributes.position.count;j++){v.fromBufferAttribute(mesh.geometry.attributes.position,j).applyMatrix4(matrix);if(v.y<a.baseY+M.fasciaBottom-.001||v.y>a.baseY+3.4-.05)throw Error('Sign outside ground fascia');}signs++;}
      const frames=I.scene.getObjectByName('entry-frames'),pos=frames.geometry.attributes.position;let portals=0;for(const e of I.city.publicRealm.entrances.filter(e=>e.kind!=='passage')){let top=-Infinity;for(let j=0;j<pos.count;j++){v.fromBufferAttribute(pos,j).applyMatrix4(frames.matrixWorld);const dx=v.x-e.to[0],dz=v.z-e.to[1],normal=dx*e.n[0]+dz*e.n[1],along=dx*e.u[0]+dz*e.u[1];if(Math.abs(normal-.09)<.002&&Math.abs(along)<Math.max(e.doorWidth+.18,e.portalWidth*.83)/2+.1)top=Math.max(top,v.y);}if(!Number.isFinite(top)||top>e.elevation+M.displayTop+.001)throw Error('Portal rises into fascia '+e.id);portals++;}
      return{renderedCanopies:checked,renderedSigns:signs,portalFrames:portals};}""")
   assert not errors,errors;page.close()
  report['status']='passed';print(json.dumps({'status':'passed','runs':{k:{'storefronts':len(v['storefronts']),'meshChecks':v.get('meshChecks'),'street':v['views']['street']} for k,v in report.items() if k in ['before','after']}},indent=2))
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');browser.close()
  if server:server.shutdown();server.server_close()
