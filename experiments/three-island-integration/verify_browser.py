"""Muted isolated Chrome, serialized under the shared GPU claim. No OS input."""
from pathlib import Path
import functools,http.server,json,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts'/'three-island-integration';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    page=browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1)
    errors=[];logs=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:logs.append({'type':m.type,'text':m.text[:1000]}))
    try:
        page.goto(f'http://127.0.0.1:{server.server_port}/experiments/three-island-integration/',wait_until='domcontentloaded',timeout=45000)
        page.wait_for_function('window.Integration?.ready',timeout=90000)
        print('Renderer ready',flush=True)
        results={}
        for view in ['aerial','overhead','district','street','bridge','courtyard','comparison-overhead','passage','passage-ceiling']:
            page.evaluate('(v)=>Integration.setView(v)',view);page.wait_for_timeout(1300)
            page.screenshot(path=str(OUT/f'{view}.png'))
            info=page.evaluate('Integration.inspect()');assert not info['nonfinite'] and not info['badNormals'],info
            results[view]=info;print(json.dumps({'view':view,'render':info['render'],'materials':info['materials'],'details':info['details']}),flush=True)
        probes=page.evaluate('''() => {const bs=Integration.city.buildings.filter(b=>b.profile==='courtyard');return bs.map(b=>{const h=b.volumes.flatMap(v=>v.polygons).flatMap(p=>p.holes)[0],p=CityFabric.center(h);return {id:b.id,point:p,hits:Integration.roofHits(...p)};});}''')
        assert all(not p['hits'] for p in probes),probes
        passages=page.evaluate("Integration.city.buildings.filter(b=>b.passage).map(b=>({id:b.id,hits:Integration.passageHits(b)}))")
        assert all(not p['hits'] for p in passages),passages
        ceilings=page.evaluate("Integration.city.buildings.filter(b=>b.passage).map(b=>{const upper=b.volumes.find(v=>v.role==='courtyard-upper'),p=CityFabric.center(CityFabric.boolean(upper.polygons,b.passage.polygons,'intersection')[0].outer);return {id:b.id,expectedY:upper.baseElevation,hits:Integration.ceilingHits(...p)};})")
        assert all(p['hits'] and abs(p['hits'][0]['y']-p['expectedY'])<.001 and p['hits'][0]['name']=='courtyard-passage-soffits' for p in ceilings),ceilings
        tree_clearance=page.evaluate("Integration.city.blockInteriors.flatMap(c=>c.accesses).every(a=>{const C=CityFabric,s=Integration.city.streets.find(s=>s.id===a.streetId),zone=C.corridor(C.projection(a.from,s.a,s.b).point,a.to,a.width+6);return Integration.ground.markingInfo.treeSites.every(t=>!C.inShape(zone,t.p));})")
        assert tree_clearance
        geometry=page.evaluate('''() => {
          let degenerate=0,reversed=0,triangles=0;
          Integration.cityBuildings.group.traverse(o=>{if(o.name!=='SurveyedBuildingChunk')return;const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,idx=g.index;
            for(let i=0;i<idx.count;i+=3){const vs=[0,1,2].map(k=>{const j=idx.getX(i+k);return [p.getX(j),p.getY(j),p.getZ(j)];}),a=vs[0],u=vs[1].map((x,j)=>x-a[j]),v=vs[2].map((x,j)=>x-a[j]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],j=idx.getX(i);triangles++;if(Math.hypot(...normal)<1e-7)degenerate++;if(normal[0]*n.getX(j)+normal[1]*n.getY(j)+normal[2]*n.getZ(j)<-1e-7)reversed++;}});return {triangles,degenerate,reversed};}''')
        assert not geometry['degenerate'] and not geometry['reversed'],geometry
        details=page.evaluate('''() => {
          let checked=0;const errors=[],C=CityFabric;
          for(const d of Integration.cityBuildings.allBlocks){const r=Integration.records.find(r=>r.id===d.id);if(!r)continue;const parcel=C.shape(r.parcel.outer.map(p=>[p.x,p.z]),r.parcel.holes.map(h=>h.map(p=>[p.x,p.z])));
            for(const kind of ['cornices','awnings','scaffoldSheds'])for(const item of d[kind]){const cs=Math.cos(item.ry||0),sn=Math.sin(item.ry||0),ring=[[-item.w/2,-item.d/2],[item.w/2,-item.d/2],[item.w/2,item.d/2],[-item.w/2,item.d/2]].map(([u,v])=>[item.x+u*cs+v*sn,item.z-u*sn+v*cs]);if(!C.containsRegion(parcel,C.shape(C.canonical(ring)),.01))errors.push(d.id+':'+kind);checked++;}}
          return {checked,errors};}''')
        assert not details['errors'],details
        for _ in range(6):page.locator('#buildings').click()
        assert page.evaluate('Integration.cityBuildings.group.visible')
        page.locator('#buildings').click();page.evaluate("Integration.setView('overhead')");page.wait_for_timeout(500);page.screenshot(path=str(OUT/'ground.png'));page.locator('#buildings').click()
        page.set_viewport_size({'width':390,'height':844});page.evaluate("Integration.setView('district')");page.wait_for_timeout(500);page.screenshot(path=str(OUT/'mobile.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        with page.expect_download() as pending:page.locator('#export').click()
        download=pending.value;download.save_as(OUT/'exported-plan.json')
        exported=json.loads((OUT/'exported-plan.json').read_text());assert exported['schemaVersion']==4 and len(exported['buildings'])==exported['stats']['buildings'] and exported['stats']['sharedInteriors']>0
        edit_id=page.evaluate("Integration.city.buildings.find(b=>b.profile==='podium-tower').id")
        page.evaluate('(id)=>Integration.select(id)',edit_id);page.locator('#height').fill('6');page.locator('#apply-height').click();page.wait_for_function('window.Integration?.ready',timeout=90000)
        edited=page.evaluate('(id)=>Integration.city.buildings.find(b=>b.id===id)',edit_id);assert edited['height']==6 and len(edited['volumes'])==1
        page.locator('#seed').fill('INTEGRATION-UI');page.locator('#rebuild button').click();page.wait_for_function('window.Integration?.ready',timeout=90000)
        assert page.evaluate("Integration.city.input.seed==='INTEGRATION-UI' && Object.keys(Integration.city.buildingEdits).length===0")
        assert not errors,errors
        report={'status':'passed','views':results,'courtyardVoidProbes':probes,'groundPassageProbes':passages,'passageCeilingProbes':ceilings,'treeAccessClearance':tree_clearance,'buildingGeometry':geometry,'detailParcelContainment':details,'interactions':['six repeated visibility toggles','mobile layout','JSON export','tower height edit to 6 m','seed rebuild clears incompatible edits'],'errors':errors,'logs':logs}
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2));print('PASS integration',flush=True)
    except Exception as e:
        page.screenshot(path=str(OUT/'failure.png'))
        report={'status':'failed','exception':str(e),'errors':errors,'logs':logs,'text':page.locator('body').inner_text()[:4000]}
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True);raise
    finally:browser.close();server.shutdown();server.server_close()
