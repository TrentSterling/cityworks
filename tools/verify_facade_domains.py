"""Check the real map's joined domains and capture the review's exact seam target."""
from pathlib import Path
import functools,http.server,threading,json,subprocess,zipfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts/facade-domain-review';OUT.mkdir(parents=True,exist_ok=True)
baseline=OUT/'baseline'
if not baseline.exists():
 archive=OUT/'baseline.zip';subprocess.run(['git','archive','--format=zip','--output='+str(archive),'3fad19eb421899e5691c6fcf5618c033460f6eda'],cwd=ROOT,check=True);baseline.mkdir()
 with zipfile.ZipFile(archive) as z:
  assert all((baseline/n).resolve().is_relative_to(baseline.resolve()) for n in z.namelist());z.extractall(baseline)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();report={}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
 try:
  for label,prefix in [('before','artifacts/facade-domain-review/baseline/'),('after','')]:
   errors=[];page=browser.new_page(viewport={'width':1600,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/{prefix}');page.wait_for_function('window.Integration?.ready',timeout=90000)
   page.evaluate("Integration.setView('street')");page.wait_for_timeout(500);info=page.evaluate('Integration.inspect()');report[label]={'errors':errors,'counters':{k:info[k] for k in ['geometryBytes','render','materials','nonfinite','badNormals']}}
   page.evaluate("()=>{const b=Integration.city.buildings.find(b=>b.id==='parcel:a7e98cac:building');Integration.setCamera([29.8,b.baseElevation+2.0,-32.86],[10.801,b.baseElevation+2.0,-32.465]);}")
   page.wait_for_timeout(500);page.screenshot(path=str(OUT/(label+'-seam.png')))
   if label=='after':
    checks=page.evaluate("""()=>{const panels=[],groups=new Map();let attributes=0;Integration.scene.traverse(o=>{if(o.userData.facadePanels){panels.push(...o.userData.facadePanels);const seed=o.geometry.attributes.facadeFrame;if(!seed||seed.count!==o.geometry.attributes.position.count)throw Error('Missing facade frame attribute');attributes++;}});for(const p of panels){const key=p.volumeId+'|'+p.ring+'|'+p.domainId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}const joined=[...groups.values()].filter(x=>x.length>1);for(const g of joined){g.sort((a,b)=>a.domainOffset-b.domainOffset);if(new Set(g.map(x=>JSON.stringify([x.domainSeed,x.domainReverse,x.domainTangent]))).size!==1)throw Error('Mixed domain seed');for(let i=1;i<g.length;i++)if(Math.abs(g[i].brickOffset-g[i-1].brickOffset-g[i-1].edgeWidth)>1e-6)throw Error('Discontinuous brick distance');}return {panels:panels.length,joined:joined.length,attributes,target:panels.filter(x=>x.volumeId==='parcel:a7e98cac:building:base'&&x.width>23.99&&x.width<24.01)};}""")
    report[label]['checks']=checks;assert checks['joined']==36 and checks['target'];assert not info['nonfinite'] and not info['badNormals']
   assert not errors,errors;page.close()
  report['status']='passed';print(json.dumps(report,indent=2))
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');browser.close();server.shutdown();server.server_close()
