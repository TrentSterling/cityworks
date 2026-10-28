"""Verify the default release route locally or live using isolated muted Chrome."""
from pathlib import Path
import argparse, functools, http.server, json, threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--url')
args = parser.parse_args()
OUT = ROOT / 'artifacts/release' / ('live' if args.url else 'local')
OUT.mkdir(parents=True, exist_ok=True)
server = None
if not args.url:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
url = args.url or f'http://127.0.0.1:{server.server_port}/'
report = {'url':url, 'errors':[], 'failedRequests':[], 'checks':[]}

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    try:
        page = browser.new_page(viewport={'width':1600,'height':1100}, device_scale_factor=1, accept_downloads=True)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        page.on('console', lambda m: report['errors'].append(m.text) if m.type=='error' else None)
        page.on('response', lambda r: report['failedRequests'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('window.Integration?.ready', timeout=90000)
        assert page.evaluate('Integration.city.generatorVersion') == '0.5.1-usable-fabric'
        assert page.evaluate('Integration.city.stats.buildings') == 267
        for view in ['district','street','bridge','passage']:
            page.locator(f'[data-view="{view}"]').click()
            page.wait_for_timeout(800)
            info = page.evaluate('Integration.inspect()')
            assert info['view']==view and not info['nonfinite'] and not info['badNormals']
            report[view] = {k:info[k] for k in ['stats','render','materials','nonfinite','badNormals']}
            page.screenshot(path=str(OUT/(view+'.png')))
        for _ in range(6): page.locator('#buildings').click()
        assert page.evaluate('Integration.cityBuildings.group.visible')
        report['checks'].extend(['root loads planned-fabric city','four camera views','six building toggles'])
        with page.expect_download() as pending: page.locator('#export').click()
        pending.value.save_as(OUT/'export.json')
        data = json.loads((OUT/'export.json').read_text())
        assert data['schemaVersion']==4 and data['stats']['buildings']==267 and data['stats']['sharedInteriors']==25
        report['checks'].append('schema 4 export')
        page.evaluate("Integration.select(Integration.city.buildings.find(b=>b.profile==='podium-tower').id)")
        selected = page.locator('#selected-label').inner_text()
        page.locator('#height').fill('60')
        with page.expect_navigation(wait_until='domcontentloaded'): page.locator('#apply-height').click()
        page.wait_for_function('window.Integration?.ready', timeout=90000)
        assert page.evaluate('(id)=>Integration.city.buildings.find(b=>b.id===id).height', selected)==60
        page.locator('#seed').fill('CITYWORKS-RELEASE')
        with page.expect_navigation(wait_until='domcontentloaded'): page.locator('#rebuild button').click()
        page.wait_for_function('window.Integration?.ready', timeout=90000)
        assert page.evaluate("Integration.city.input.seed==='CITYWORKS-RELEASE' && Object.keys(Integration.city.buildingEdits).length===0")
        report['checks'].extend(['height edit','seed rebuild clears edits'])
        with page.expect_navigation(wait_until='domcontentloaded'): page.locator('#ground-editor').click()
        page.wait_for_function('window.Cityworks?.ready', timeout=60000)
        assert page.evaluate("Cityworks.city.input.seed==='CITYWORKS-RELEASE'")
        for key,value in [('coastVariation','0.6'),('streetSpacing','116'),('bridgeWidth','24')]:
            page.locator('#'+key).fill(value)
            page.locator('#'+key).dispatch_event('change')
            assert page.evaluate('(key)=>Cityworks.city.input[key]',key)==float(value)
        page.locator('[data-layer="network"]').click()
        assert page.evaluate("Cityworks.inspect().layer==='network'")
        assert not page.evaluate('Cityworks.inspect().validation')
        page.screenshot(path=str(OUT/'ground-editor.png'))
        with page.expect_download() as pending: page.locator('#export').click()
        pending.value.save_as(OUT/'ground-export.json')
        assert json.loads((OUT/'ground-export.json').read_text())['schemaVersion']==3
        with page.expect_navigation(wait_until='domcontentloaded'): page.locator('#city-view').click()
        page.wait_for_function('window.Integration?.ready', timeout=90000)
        assert page.evaluate("Integration.city.input.seed==='CITYWORKS-RELEASE' && Integration.city.input.coastVariation===.6 && Integration.city.input.streetSpacing===116 && Integration.city.input.bridgeWidth===24")
        assert not page.evaluate('Integration.inspect().nonfinite')
        report['checks'].extend(['ground editor settings and hierarchy','schema 3 ground export','edited ground returns to city'])
        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(300)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('[data-view="street"]').click()
        page.screenshot(path=str(OUT/'mobile.png'))
        assert page.evaluate("Integration.inspect().view==='street'")
        report['checks'].append('mobile layout and camera control')
        assert not report['errors'] and not report['failedRequests'],report
        report['status']='passed'
        print(json.dumps({'status':'passed','url':url,'checks':report['checks']},indent=2))
    except Exception as e:
        report['status']='failed';report['exception']=str(e)
        page.screenshot(path=str(OUT/'failure.png'))
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        browser.close()
        if server: server.shutdown();server.server_close()
