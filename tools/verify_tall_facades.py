"""Inspect actual upper-volume facade policy and matched default tower views."""
from pathlib import Path
import argparse,functools,http.server,json,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--label',default='before');args=parser.parse_args()
OUT=ROOT/'artifacts/tall-facades-054';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
report={'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
 try:
  page=browser.new_page(viewport={'width':1600,'height':1100});page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(args.url or f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('window.Integration?.ready',timeout=90000)
  report['volumes']=page.evaluate("""()=>{const I=Integration,panels=[];I.scene.traverse(o=>panels.push(...o.userData.facadePanels||[]));return I.city.buildings.flatMap(b=>b.volumes.filter(v=>v.role==='tower'||v.role==='tower-crown').map(v=>({id:v.id,buildingId:b.id,island:b.islandId,center:b.center,base:v.baseElevation,top:v.topElevation,style:v.facadeIndex,frontage:b.frontage,panels:panels.filter(p=>p.volumeId===v.id).map(p=>({kind:p.kind,width:p.width,bays:p.bays,storeys:p.storeys,eligible:p.windowEligible}))})));}""")
  for v in report['volumes']:
   if v['style']>=2 or not v['id'].endswith(':upper'):continue
   a,b=v['frontage'];dx,dz=b[0]-a[0],b[1]-a[1];length=(dx*dx+dz*dz)**.5;u=[dx/length,dz/length];n=[u[1],-u[0]];x,z=v['center']
   camera={'p':[x+n[0]*95+u[0]*35,25,z+n[1]*95+u[1]*35],'t':[x,(v['base']+v['top'])/2,z]}
   page.evaluate('(v)=>Integration.setCamera(v.p,v.t)',camera);page.wait_for_timeout(700);page.screenshot(path=str(OUT/(args.label+'-'+v['island'].split(':')[1]+'.png')));v['camera']=camera
  report['inspect']=page.evaluate('Integration.inspect()');report['inspect'].pop('frames',None)
  if args.label!='before':
   for v in report['volumes']:
    assert all(p['kind']!=3 for p in v['panels']),v
    assert any(p['eligible'] for p in v['panels']),v
   report['overlapFixtures']=page.evaluate("""async()=>{const {partyWallHeight}=await import(new URL('adapted-nyc/building-footprints.js',document.baseURI).href);const record={baseY:20,height:20,polygons:[]},a={x:0,y:0},b={x:0,y:10},shape={outer:[{x:-5,z:-1},{x:1,z:-1},{x:1,z:11},{x:-5,z:11}],holes:[]},n={x0:-5,x1:1,z0:-1,z1:11,polygons:[shape]};const check=(bottom,top,expected)=>{const actual=partyWallHeight(record,a,b,[{...n,baseY:bottom,height:top}]);if(actual!==expected)throw Error('Vertical overlap fixture '+JSON.stringify({bottom,top,expected,actual}));};check(0,20,0);check(40,60,0);check(0,50,50);check(10,30,30);return {podiumBelow:true,tierAbove:true,fullNeighbour:true,partialNeighbour:true};}""")
   report['overlapFixtures']['elevatedNeighbour']=page.evaluate("""async()=>{const {partyWallHeight}=await import(new URL('adapted-nyc/building-footprints.js',document.baseURI).href);const n={x0:-5,x1:1,z0:-1,z1:11,baseY:30,height:50,polygons:[{outer:[{x:-5,z:-1},{x:1,z:-1},{x:1,z:11},{x:-5,z:11}],holes:[]}]};if(partyWallHeight({baseY:20,height:20,polygons:[]},{x:0,y:0},{x:0,y:10},[n])!==0)throw Error('Elevated neighbour blanks exposed lower strip');return true;}""")
  assert not report['errors'];report['status']='passed';print(json.dumps({k:v for k,v in report.items() if k!='inspect'},indent=2))
 finally:
  (OUT/(args.label+'-report.json')).write_text(json.dumps(report,indent=2),encoding='utf-8');browser.close();server.shutdown();server.server_close()
