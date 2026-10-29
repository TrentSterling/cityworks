"""Exercise real scoped editor UI in isolated muted headless Chrome."""
from pathlib import Path
import argparse,functools,http.server,json,threading,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
OUT=ROOT/'artifacts/scoped-editor';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'errors':[],'checks':[],'renders':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    try:
        page=browser.new_page(viewport={'width':1600,'height':1100},accept_downloads=True)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        page.goto(args.url or f'http://127.0.0.1:{server.server_port}/experiments/scoped-editor/')
        def ready():
            page.wait_for_function('window.MassingEditor && !MassingEditor.busy && MassingEditor.api()?.ready',timeout=100000)
            assert not page.locator('#status').get_attribute('class')=='error',page.locator('#status').inner_text()
        def click(selector):
            page.locator(selector).click();ready()
        def city():return page.evaluate('MassingEditor.session.city')
        def capture(name):
            page.wait_for_timeout(500);page.screenshot(path=str(OUT/(name+'.png')))
            info=page.evaluate('MassingEditor.api().inspect()');info.pop('frames',None);report['renders'].append(info)
            assert not info['nonfinite'] and not info['badNormals']
        ready();block=page.evaluate('MassingEditor.blockId');locked=page.evaluate('MassingEditor.buildingId')
        click('#lock');assert page.evaluate('(id)=>MassingEditor.session.project.locks[id]',locked)
        assert page.locator('#height').is_disabled()
        before=city();before_doc=page.evaluate('MassingEditor.session.save()');capture('before')
        click('#reroll');after=city();after_doc=page.evaluate('MassingEditor.session.save()');capture('after')
        old={b['id']:b for b in before['buildings']};changed=[]
        for b in after['buildings']:
            if b!=old[b['id']]:changed.append(b['id']);assert b['blockId']==block and b['id']!=locked
            if b['id']==locked or b['blockId']!=block:assert b==old[b['id']]
        assert changed
        for key in ['islands','streets','bridges','blocks','parcels']:assert before[key]==after[key],key
        report['checks'].append('selected block changes; locked building and all neighboring map data unchanged')
        click('#undo');assert city()==before and page.evaluate('MassingEditor.session.save()')==before_doc
        click('#redo');assert city()==after and page.evaluate('MassingEditor.session.save()')==after_doc
        report['checks'].append('exact undo/redo through actual controls')
        # Pick visible geometry with a real click inside the iframe.
        points=page.evaluate('''() => {const I=MassingEditor.api(),size=document.querySelector('iframe').getBoundingClientRect();return I.city.buildings.map(b=>{const v=I.camera.position.clone().set(b.center[0],b.baseElevation+b.height*.5,b.center[1]).project(I.camera);return {id:b.id,x:(v.x+1)*size.width/2,y:(1-v.y)*size.height/2,z:v.z};}).filter(p=>p.id!==MassingEditor.buildingId&&p.x>20&&p.x<size.width-20&&p.y>100&&p.y<size.height-50&&p.z>-1&&p.z<1).sort((a,b)=>a.z-b.z).slice(0,20);}''')
        picked=False;box=page.locator('iframe').bounding_box()
        for point in points:
            page.mouse.click(box['x']+point['x'],box['y']+point['y']);page.wait_for_timeout(100)
            if page.evaluate('MassingEditor.buildingId')!=locked:picked=True;break
        assert picked,'A real viewport pick must update selection';report['checks'].append('viewport picking selects a building and its block')
        selected=page.evaluate('MassingEditor.buildingId');page.locator('#height').fill('35');click('#apply-height')
        assert next(b for b in city()['buildings'] if b['id']==selected)['height']==35
        saved_doc=page.evaluate('MassingEditor.session.save()')
        with page.expect_download() as pending:page.locator('#save').click()
        pending.value.save_as(OUT/'project.json');assert json.loads((OUT/'project.json').read_text())==json.loads(saved_doc)
        with page.expect_download() as pending:page.locator('#export').click()
        pending.value.save_as(OUT/'scene.json');scene=json.loads((OUT/'scene.json').read_text());assert scene['exportContract']['version']==1 and len(scene['colliders'])==scene['stats']['volumes']
        click('#new');assert not page.evaluate('Object.keys(MassingEditor.session.project.locks).length')
        page.locator('#load-file').set_input_files(str(OUT/'project.json'))
        page.wait_for_function('(saved)=>MassingEditor.session.save()===saved',arg=saved_doc,timeout=100000);ready()
        page.reload();ready();assert page.evaluate('MassingEditor.session.save()')==saved_doc
        report['checks'].append('manual height, project save/load/reload and engine-neutral scene export')
        bad=OUT/'invalid-project.json';bad.write_text('{"schema":"cityworks.project","version":999}')
        page.locator('#load-file').set_input_files(str(bad));page.wait_for_function("document.querySelector('#status').className==='error'")
        assert page.evaluate('MassingEditor.session.save()')==saved_doc
        report['checks'].append('invalid import preserves the complete project')
        # Clear the error through an ordinary selection; then repeat scene replacement.
        page.locator('#block').select_option(block);page.locator('#building').select_option(locked)
        for i in range(3):
            click('#reroll');click('#undo');assert page.locator('iframe').count()==1
        capture('final');assert max(x['materials'] for x in report['renders'])<=42
        # 40 scene materials plus two selection overlays in 0.5.3. Repeated
        # replacement must not accumulate materials or retained geometries.
        assert report['renders'][-1]['materials']==report['renders'][0]['materials']
        assert report['renders'][-1]['geometries']<=report['renders'][0]['geometries']
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('[data-view="overhead"]').click();page.screenshot(path=str(OUT/'mobile.png'))
        assert page.evaluate("MassingEditor.api().inspect().view==='overhead'")
        report['checks'].append('three reroll/undo cycles, bounded scene resources and mobile camera control')
        # Prior releases stored a versioned autosave. Preserve its original
        # compilation rules and authoring intent when the new editor starts.
        legacy=json.loads((ROOT/'tests/fixtures/massing-053.json').read_text())['legacy'][0]
        page.evaluate('(p)=>{localStorage.clear();localStorage.setItem("cityworks:scoped-project:1:"+p.generatorVersion,JSON.stringify(p));}',legacy['project'])
        page.reload();ready()
        assert page.evaluate('MassingEditor.session.project')==legacy['project']
        assert page.evaluate('MassingEditor.api().city.dependencies')==page.evaluate('MassingEditor.session.city.dependencies')
        assert page.evaluate('MassingEditor.api().city.generatorVersion')=='0.5.1-usable-fabric'
        assert 'original geometry rules' in page.locator('#status').inner_text()
        legacy_city=city();click('#reroll');click('#undo');assert city()==legacy_city
        page.reload();ready();assert city()==legacy_city
        with page.expect_download() as pending:page.locator('#export').click()
        pending.value.save_as(OUT/'legacy-scene.json')
        assert json.loads((OUT/'legacy-scene.json').read_text())['exportContract']['generatorVersion']=='0.5.1-usable-fabric'
        click('#new');assert page.evaluate('MassingEditor.api().city.generatorVersion')=='0.5.4-resolved-massing'
        click('#undo');assert city()==legacy_city
        report['checks'].append('legacy autosave restores original geometry, locks and overrides; reroll/undo/reload/export retain version; new project is current and undo restores legacy')
        assert not report['errors'],report['errors']
        report.update(status='passed',blockId=block,lockedBuilding=locked,changedBuildings=len(changed))
        print(json.dumps({k:v for k,v in report.items() if k!='renders'},indent=2))
    except Exception as e:
        report.update(status='failed',exception=str(e));page.screenshot(path=str(OUT/'failure.png'));raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');browser.close();server.shutdown();server.server_close()
