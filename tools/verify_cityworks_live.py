"""Wait for this checkout's public runtime assets, then verify the deployed city."""
from pathlib import Path
import hashlib,json,time,urllib.request
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/cityworks-live';OUT.mkdir(parents=True,exist_ok=True)
BASE='https://tront.xyz/cityworks/'
files=['index.html','src/geometry.js','package.json','src/building-plan.js','src/public-realm.js','src/court-connections.js','src/editor-state.js','experiments/three-island-integration/ground.js','experiments/scoped-editor/editor.js']
expected={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files}
report={'url':BASE,'expected':expected,'errors':[]};deadline=time.monotonic()+1200
while True:
    observed={}
    for path,sha in expected.items():
        try:
            with urllib.request.urlopen(BASE+path+'?verify='+sha,timeout=30) as response:observed[path]=hashlib.sha256(response.read()).hexdigest()
        except Exception as e:observed[path]=str(e)
    if observed==expected:break
    if time.monotonic()>deadline:raise RuntimeError('Deployment does not match checkout: '+json.dumps(observed))
    time.sleep(15)
report['assetMatch']='passed'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chromium',headless=False,args=['--mute-audio','--enable-unsafe-webgpu','--use-webgpu-adapter=swiftshader','--enable-dawn-features=allow_unsafe_apis','--disable-dawn-features=use_dxc','--enable-webgpu-developer-features','--use-gpu-in-tests','--enable-accelerated-2d-canvas'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
    try:
        page.goto(BASE+'?verify='+expected['src/building-plan.js'],wait_until='domcontentloaded')
        page.wait_for_function('window.Integration?.ready',timeout=180000)
        assert page.evaluate('Integration.city.generatorVersion')=='0.5.7-connected-courts'
        assert page.evaluate("Integration.city.publicRealm.courtRoutes.filter(r=>r.kind==='pedestrian-through').length")==4
        assert not page.evaluate('CityPublicRealm.validate(Integration.city)')
        for view in ['district','street']:
            page.evaluate('(v)=>Integration.setView(v)',view);page.wait_for_timeout(1500)
            assert not page.locator('#error').inner_text()
            page.screenshot(path=str(OUT/(view+'.png')))
        report['inspect']=page.evaluate('Integration.inspect()')
        assert not report['inspect']['nonfinite'] and not report['inspect']['badNormals']
        assert not report['errors'],report['errors']
        report['status']='passed'
    except Exception as e:
        report['status']='failed';report['exception']=str(e);page.screenshot(path=str(OUT/'failure.png'));raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');browser.close()

