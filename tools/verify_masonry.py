"""Matched material views and rendering/resource evidence against released 0.5.5."""
from pathlib import Path
import argparse,functools,http.server,json,subprocess,threading,zipfile,statistics
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
OUT=ROOT/'artifacts/masonry-056'/('live' if args.url else 'local');OUT.mkdir(parents=True,exist_ok=True)
baseline=ROOT/'artifacts/masonry-056/baseline';commit='46e75c6b1954aceba2c23a6897082fdbffa61364'
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
views={
 'brick-close':{'p':[-785,13.8,177],'t':[-785,13.8,182.848]},
 'brick-oblique':{'p':[-780,13.8,176],'t':[-787,14.3,182.848]},
 'residential':{'p':[579,13,30],'t':[608,16,29]},
 'residential-close':{'p':[600,14,29],'t':[608,14,29]},
 'industrial':{'p':[-780,9.86,162],'t':[-785.847,10.9,182.848]},
 'distant':{'p':[-635,86,-52],'t':[-670,32,210]}}
report={'baseline':commit,'cameras':views,'timingNote':'Warm browser frame intervals on this desktop; not GPU timings or a device performance claim.'}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
 try:
  for label,url in ([('after',base)] if args.url else [('before',base+'artifacts/masonry-056/baseline/'),('after',base)]):
   errors=[];page=browser.new_page(viewport={'width':1600,'height':1100});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
   page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.Integration?.ready',timeout=90000)
   report[label]={'views':{},'errors':errors}
   for name in [*views,'street']:
    if name=='street':page.evaluate("Integration.setView('street')")
    else:page.evaluate('(v)=>Integration.setCamera(v.p,v.t)',views[name])
    page.wait_for_timeout(1100);info=page.evaluate('Integration.inspect()');assert not info['nonfinite'] and not info['badNormals'],info
    report[label]['views'][name]={k:info[k] for k in ['render','materials','geometryBytes','details']}
    frames=info['frames'];report[label]['views'][name]['frameIntervalMedianMs']=statistics.median(frames) if frames else None
    page.screenshot(path=str(OUT/(label+'-'+name+'.png')))
    if name=='brick-oblique':
     shifted={'p':[views[name]['p'][0]+.08,*views[name]['p'][1:]],'t':[views[name]['t'][0]+.08,*views[name]['t'][1:]]}
     page.evaluate('(v)=>Integration.setCamera(v.p,v.t)',shifted);page.wait_for_timeout(500);page.screenshot(path=str(OUT/(label+'-brick-motion.png')))
   if label=='after':
    report[label]['details']=page.evaluate("""async()=>{const {acBays,MASONRY}=await import(new URL('masonry-rules.js',document.baseURI).href),I=Integration,panels=[],materials=[];I.scene.traverse(o=>{if(o.userData.facadePanels)panels.push(...o.userData.facadePanels);if(o.material?.userData.masonry)materials.push(o.material.userData.masonry);});let total=0;const programs={},seen=new Set();for(const p of panels){const key=p.volumeId+':'+p.ring+':'+p.domainId;if(seen.has(key))continue;seen.add(key);const units=acBays(p.ac,p);if(p.kind===3||!p.windowEligible)if(units.length)throw Error('AC on blank wall');for(const u of units)if(u.floor<1||u.floor>=p.storeys||u.bay>=p.bays)throw Error('AC outside complete upper window');total+=units.length;programs[p.ac.program]=(programs[p.ac.program]||0)+units.length;}return {total,programs,domains:seen.size,materials,modules:MASONRY};}""")
   assert not errors,errors;page.close()
  report['status']='passed';print(json.dumps({k:v for k,v in report.items() if k not in ['before','after']},indent=2));print(json.dumps({k:{'street':v['views']['street'],'detailSummary':{a:b for a,b in v.get('details',{}).items() if a!='materials'}} for k,v in report.items() if k in ['before','after']},indent=2))
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');browser.close()
  if server:server.shutdown();server.server_close()
