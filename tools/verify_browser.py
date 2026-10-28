from pathlib import Path
import argparse, json, statistics
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts'/'v0.2'
OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser(description='Verify Cityworks in isolated muted headless Chrome')
parser.add_argument('--url',help='Deployed app URL; default verifies the standalone build')
parser.add_argument('--browser-executable',help='Optional Chrome executable path')
args=parser.parse_args()
target=args.url or (OUT/'Cityworks-0.2.0.html').as_uri()
launch_options={'executable_path':args.browser_executable} if args.browser_executable else {'channel':'chrome'}
report={'screenshots':{},'ui':{},'errors':[],'requests':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(**launch_options,headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    try:
        page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1,accept_downloads=True)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        def route_network(route):
            if args.url and urlparse(route.request.url).netloc==urlparse(args.url).netloc:route.continue_()
            else:route.abort()
        page.route('http://**/*',route_network)
        page.route('https://**/*',route_network)
        page.on('request',lambda r:report['requests'].append(r.url))
        page.goto(target);page.wait_for_function('window.Cityworks && Cityworks.ready')
        page.wait_for_timeout(1300)
        for view in ['aerial','overhead','street','boulevard']:
            page.locator('[data-view="'+view+'"]').click();page.wait_for_timeout(700)
            info=page.evaluate('Cityworks.inspect()');frames=info.pop('frameSamples');info['frameMs']={'median':statistics.median(frames),'p95':sorted(frames)[int(len(frames)*.95)],'samples':len(frames)}
            report['screenshots'][view]=info
            assert info['finiteGeometry'] and not info['validation']
            assert info['geometryChecks']=={'badNormals':0,'badWinding':0,'badFacadeMetric':0}
            assert info['drawCalls']<100 and info['triangles']<300000
            page.screenshot(path=str(OUT/('cityworks-'+view+'.png')))
        page.locator('[data-view="overhead"]').click()
        target=page.evaluate('''() => {const b=Cityworks.city.buildings.find(b=>Math.hypot(...b.center)<90);return {id:b.id,...Cityworks.projectPoint([b.center[0],b.height+3.35,b.center[1]])};}''')
        page.mouse.click(target['x'],target['y']);assert page.evaluate('Cityworks.selected')==target['id'];report['ui']['buildingInspection']=True
        page.locator('[data-view="street"]').click()
        old=page.evaluate('Cityworks.cameraPosition');page.keyboard.down('w');page.wait_for_timeout(250);page.keyboard.up('w');new=page.evaluate('Cityworks.cameraPosition');assert old!=new;report['ui']['keyboardMovement']=True
        topology=page.evaluate('JSON.stringify([Cityworks.city.streets,Cityworks.city.blocks,Cityworks.city.parcels])')
        ids=page.evaluate('Cityworks.city.buildings.map(b=>b.id)')
        heights=page.evaluate('Cityworks.city.buildings.map(b=>b.height)')
        page.locator('#density').fill('0.35');page.locator('#density').dispatch_event('input')
        assert page.evaluate('JSON.stringify([Cityworks.city.streets,Cityworks.city.blocks,Cityworks.city.parcels])')==topology
        assert page.evaluate('Cityworks.city.buildings.map(b=>b.id)')==ids
        assert page.evaluate('Cityworks.city.buildings.map(b=>b.height)')!=heights
        report['ui']['densityPreservesTopology']=True
        page.locator('#arterialX').fill('-20');page.locator('#arterialX').dispatch_event('input');assert page.evaluate('Cityworks.city.input.arterialX')==-20;report['ui']['arterialEdit']=True
        page.locator('#diagonalAngle').fill('42');page.locator('#diagonalAngle').dispatch_event('input');assert page.evaluate('Cityworks.city.input.diagonalAngle')==42;report['ui']['diagonalAngleEdit']=True
        page.locator('#lagoon').uncheck();assert page.evaluate('Cityworks.city.island.holes.length')==0;page.locator('#lagoon').check();assert page.evaluate('Cityworks.city.island.holes.length')==1;report['ui']['lagoonToggle']=True
        page.locator('[data-layer="plan"]').click();assert page.evaluate('Cityworks.inspect().layer')=='plan';page.locator('[data-layer="massing"]').click();assert page.evaluate('Cityworks.inspect().layer')=='massing';report['ui']['layerSwitches']=True
        # Exercise the actual SVG boundary handle using browser-simulated pointer events.
        handle=page.locator('#map [data-vertex="0"]');box=handle.bounding_box();oldBoundary=page.evaluate('JSON.stringify(Cityworks.city.island.boundary)');page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+2,box['y']+box['height']/2,steps=3);page.mouse.up();assert page.evaluate('JSON.stringify(Cityworks.city.island.boundary)')!=oldBoundary;report['ui']['boundaryDrag']=True
        page.locator('#lagoon').uncheck();assert page.evaluate('Cityworks.city.island.holes.length')==0;page.locator('#lagoon').check();assert page.evaluate('Cityworks.city.island.holes.length')==1;report['ui']['lagoonToggleAfterBoundaryEdit']=True
        old=page.evaluate('JSON.stringify(Cityworks.city)');assert not page.evaluate('Cityworks.rebuild({boundary:[[0,0],[300,300],[0,300],[300,0]]})');assert page.evaluate('JSON.stringify(Cityworks.city)')==old;assert page.locator('#status').get_attribute('class')=='error';report['ui']['invalidEditPreservesPreviousCity']=True
        with page.expect_download() as event:page.locator('#export').click()
        export=OUT/'cityworks-ui-export.json';event.value.save_as(export);data=json.loads(export.read_text());assert data['input']['arterialX']==-20 and data['schemaVersion']==2;report['ui']['jsonExport']=True
        # Repeated rebuilds must not leave geometry resources resident.
        page.locator('[data-layer="facades"]').click();before=page.evaluate('Cityworks.inspect().memory')
        for i in range(5):page.locator('#rebuild').click()
        after=page.evaluate('Cityworks.inspect().memory');assert before==after;report['ui']['resourcesStableAfterFiveRebuilds']={'before':before,'after':after}
        report['final']=page.evaluate('Cityworks.inspect()');report['final'].pop('frameSamples');assert not report['errors'],report['errors']
        report['status']='passed'
    finally:
        browser.close()
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
