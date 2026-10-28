from pathlib import Path
import argparse,json,statistics
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts'/'v0.3'
OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('--browser-executable')
args=parser.parse_args()
report={'errors':[],'views':{},'ui':{}}
with sync_playwright() as p:
    browser=p.chromium.launch(**({'executable_path':args.browser_executable} if args.browser_executable else {'channel':'chrome'}),headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
    try:
        page=browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1,accept_downloads=True)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        page.route('http://**/*',lambda route:route.abort())
        page.route('https://**/*',lambda route:route.abort())
        page.goto((OUT/'Cityworks-0.3.0-dev.html').as_uri())
        page.wait_for_function('window.Cityworks && Cityworks.ready',timeout=60000)
        for view in ['aerial','overhead','bridge','street']:
            page.locator('[data-view="'+view+'"]').click();page.wait_for_timeout(900)
            info=page.evaluate('Cityworks.inspect()');frames=info.pop('frameSamples')
            info['frameMs']={'median':statistics.median(frames),'p95':sorted(frames)[min(len(frames)-1,int(len(frames)*.95))]}
            report['views'][view]=info
            assert not info['nonfinite'] and not info['badNormals'] and not info['validation'],info
            page.screenshot(path=str(OUT/('cityworks-v03-'+view+'.png')))
        page.locator('[data-view="overhead"]').click();page.locator('[data-layer="network"]').click();page.wait_for_timeout(500)
        page.screenshot(path=str(OUT/'cityworks-v03-network.png'));report['ui']['hierarchyLayer']=page.evaluate('Cityworks.inspect().layer')=='network'
        page.locator('[data-layer="ground"]').click()
        page.locator('[data-island="2"]').click();page.wait_for_timeout(600)
        page.screenshot(path=str(OUT/'cityworks-v03-headland.png'))
        page.locator('[data-view="overhead"]').click()
        for key,value in [('coastVariation','0.7'),('streetSpacing','116'),('bridgeWidth','24')]:
            page.locator('#'+key).fill(value);page.locator('#'+key).dispatch_event('change')
            assert page.evaluate('Cityworks.city.input.'+key)==float(value),key
            assert not page.evaluate('Cityworks.inspect().validation'),key
            report['ui'][key]=True
        with page.expect_download() as event:page.locator('#export').click()
        event.value.save_as(OUT/'cityworks-v03-export.json')
        assert json.loads((OUT/'cityworks-v03-export.json').read_text())['schemaVersion']==3
        report['ui']['jsonExport']=True
        page.locator('#reset').click();page.wait_for_timeout(400)
        memory=page.evaluate('Cityworks.inspect().memory')
        for _ in range(3):page.locator('#rebuild').click()
        assert memory==page.evaluate('Cityworks.inspect().memory')
        report['ui']['resourcesStableAfterRebuilds']=True
        report['status']='passed'
        assert not report['errors'],report['errors']
    finally:
        browser.close()
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
