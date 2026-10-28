"""Editor-only QA. Run under the task's GPU lease; writes ignored review artifacts."""
from pathlib import Path
import argparse
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'artifacts' / 'editor-ui'
HTML = ROOT / 'artifacts' / 'v0.3' / 'Cityworks-0.3.0-dev.html'


def health(page):
    info = page.evaluate('Cityworks.inspect()')
    assert not info['nonfinite'] and not info['badNormals'] and not info['validation'], info
    return {key: info[key] for key in ['stats', 'memory', 'drawCalls', 'triangles', 'geometryBytes']}


def layout(page):
    result = page.evaluate('''() => {
      const canvas=document.querySelector('canvas').getBoundingClientRect();
      const controls=[...document.querySelectorAll('.topbar button')].filter(el=>el.getClientRects().length).map(el=>{
        const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height};
      });
      return {width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,canvasWidth:canvas.width,controls};
    }''')
    assert result['bodyWidth'] <= result['width'], result
    assert all(c['x'] >= 0 and c['x'] + c['w'] <= result['width'] + 1 and c['y'] >= 0 for c in result['controls']), result
    if result['width'] <= 760:
        assert result['canvasWidth'] == result['width'], result
    return result


def show_panel(page, mobile):
    if mobile:
        page.locator('#open-controls').tap()
        assert page.locator('#open-controls').get_attribute('aria-expanded') == 'true'
        assert page.evaluate("document.activeElement.id==='close-controls' && document.getElementById('viewport').inert")


def close_panel(page, mobile):
    if mobile:
        page.locator('#close-controls').tap()
        assert page.locator('#open-controls').get_attribute('aria-expanded') == 'false'


def controls(page, name, mobile):
    result = {}
    initial = page.evaluate('JSON.stringify(Cityworks.city)')
    result['default'] = health(page)
    # These tests exercise the visible UI rather than invoking rebuild directly.
    for view in ['overhead', 'bridge', 'street', 'aerial', 'street', 'aerial']:
        button = page.locator('[data-view="' + view + '"]')
        button.click()
        assert page.evaluate('Cityworks.inspect().view') == view
        assert button.get_attribute('aria-pressed') == 'true'
    for layer in ['network', 'ground', 'network']:
        page.locator('[data-layer="' + layer + '"]').click()
        assert page.evaluate('Cityworks.inspect().layer') == layer
        assert page.locator('#network-legend').is_visible() == (layer == 'network')
    show_panel(page, mobile)
    if mobile:
        page.keyboard.press('Shift+Tab')
        assert page.evaluate("document.activeElement.id==='city-view'"), 'Focus must wrap inside controls'
        page.keyboard.press('Tab')
        assert page.evaluate("document.activeElement.id==='close-controls'")
        page.keyboard.press('Escape')
        assert page.evaluate("document.activeElement.id==='open-controls' && !document.getElementById('viewport').inert")
        show_panel(page, mobile)
    page.locator('#reset').click()
    assert page.evaluate("Cityworks.inspect().view==='aerial' && Cityworks.inspect().layer==='ground'")
    assert page.evaluate('JSON.stringify(Cityworks.city)') == initial
    for key, values in [('coastVariation', ['0.7', '0.35']), ('streetSpacing', ['116', '100']), ('bridgeWidth', ['24', '20'])]:
        for value in values:
            page.locator('#' + key).fill(value)
            page.locator('#' + key).dispatch_event('change')
            assert page.evaluate('Cityworks.city.input.' + key) == float(value)
            expected = f'{round(float(value)*100)}%' if key == 'coastVariation' else value + ' m'
            assert page.locator('#' + key + '-out').inner_text() == expected
        result[key] = True
    page.locator('#seed').fill('EDITOR-' + name.upper())
    page.locator('#seed').press('Enter')
    assert page.evaluate('Cityworks.city.input.seed') == 'EDITOR-' + name.upper()
    before_error = page.evaluate('JSON.stringify(Cityworks.city)')
    page.locator('#seed').fill('')
    page.locator('#rebuild').click()
    assert 'Seed must contain 1 to 80 characters' in page.locator('#status').inner_text()
    assert page.locator('#status').get_attribute('class') == 'error'
    assert page.evaluate('JSON.stringify(Cityworks.city)') == before_error
    page.locator('#status').scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / 'after' / (name + '-error.png')))
    page.locator('#seed').fill('EDITOR-' + name.upper())
    page.locator('#rebuild').click()
    assert not page.evaluate('Cityworks.inspect().lastError')
    assert page.locator('#status').get_attribute('class') == ''
    with page.expect_download() as event:
        page.locator('#export').click()
    exported = Path(event.value.path()).read_text()
    assert json.loads(exported) == page.evaluate('Cityworks.city')
    assert event.value.suggested_filename == 'cityworks-three-islands.json'
    result['exportAndErrorRecovery'] = True
    page.locator('#reset').click()
    assert page.evaluate('JSON.stringify(Cityworks.city)') == initial
    memory = page.evaluate('Cityworks.inspect().memory')
    for _ in range(3):
        page.locator('#rebuild').click()
    assert page.evaluate('Cityworks.inspect().memory') == memory
    result['repeatedRebuildResourcesStable'] = True
    close_panel(page, mobile)
    for i in range(3):
        show_panel(page, mobile)
        page.locator('[data-island="' + str(i) + '"]').click()
        assert page.locator('#view-title').inner_text() == page.evaluate('Cityworks.city.islands[' + str(i) + '].name')
        assert page.locator('[data-view="aerial"]').get_attribute('aria-pressed') == 'true'
        if mobile:
            assert page.locator('#open-controls').get_attribute('aria-expanded') == 'false'
    page.locator('[data-view="overhead"]').click()
    point = page.evaluate('''() => Cityworks.city.streets.map(s=>Cityworks.projectPoint([(s.a[0]+s.b[0])/2,8,(s.a[1]+s.b[1])/2])).find(p=>p.x>0&&p.y>170&&p.x<innerWidth&&p.y<innerHeight-190&&document.elementFromPoint(p.x,p.y)?.tagName==='CANVAS')''')
    assert point, 'A road must be reachable in the plan view'
    page.mouse.click(point['x'], point['y'])
    assert page.evaluate('Boolean(Cityworks.selected)')
    assert page.locator('#selection').is_visible()
    page.locator('#close-selection').click()
    assert page.locator('#selection').is_hidden()
    page.locator('[data-view="aerial"]').click()
    result['final'] = health(page)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser-executable')
    args = parser.parse_args()
    (OUT / 'after').mkdir(parents=True, exist_ok=True)
    report = {'errors': [], 'expectedErrors': [], 'layouts': {}, 'ui': {}}
    report['htmlSha256'] = hashlib.sha256(HTML.read_bytes()).hexdigest()
    (OUT / 'after' / HTML.name).write_bytes(HTML.read_bytes())
    with sync_playwright() as p:
        browser = p.chromium.launch(**({'executable_path': args.browser_executable} if args.browser_executable else {'channel': 'chrome'}), headless=True, args=['--mute-audio', '--use-angle=d3d11', '--no-first-run', '--disable-background-networking'])
        try:
            for name, width, height, touch in [('desktop',1600,1100,False),('mobile',390,844,True),('small-phone',320,568,True),('tablet',768,1024,True),('landscape',740,390,True)]:
                print('Checking editor:', name, flush=True)
                context = browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=1, has_touch=touch, accept_downloads=True)
                page = context.new_page()
                page.on('pageerror', lambda error: report['errors'].append(str(error)))
                page.on('console', lambda message: (report['expectedErrors'] if 'Seed must contain 1 to 80 characters' in message.text else report['errors']).append(message.text) if message.type == 'error' else None)
                page.route('http://**/*',lambda route:route.abort())
                page.route('https://**/*',lambda route:route.abort())
                page.goto(HTML.as_uri())
                page.wait_for_function('window.Cityworks && Cityworks.ready', timeout=60000)
                page.wait_for_timeout(350)
                report['layouts'][name] = layout(page)
                page.screenshot(path=str(OUT / 'after' / (name + '-aerial.png')))
                if width <= 760:
                    show_panel(page, True)
                    page.screenshot(path=str(OUT / 'after' / (name + '-controls.png')))
                    page.locator('#export').scroll_into_view_if_needed()
                    assert page.locator('#export').is_visible()
                    close_panel(page, True)
                if name in ['desktop', 'mobile']:
                    report['ui'][name] = controls(page, name, width <= 760)
                    page.locator('[data-view="street"]').click()
                    page.screenshot(path=str(OUT / 'after' / (name + '-street.png')))
                if name == 'mobile':
                    show_panel(page, True)
                    page.set_viewport_size({'width':1100,'height':800})
                    page.wait_for_function("!document.getElementById('viewport').inert && !document.getElementById('controls-panel').inert", timeout=3000)
                    page.set_viewport_size({'width':390,'height':844})
                    page.wait_for_function("document.getElementById('open-controls').getAttribute('aria-expanded')==='false'", timeout=3000)
                    report['ui'][name]['resizeRestoresControlAccess'] = True
                context.close()
            assert not report['errors'], report['errors']
            assert len(report['expectedErrors']) == 2, report['expectedErrors']
            report['status'] = 'passed'
        finally:
            browser.close()
            (OUT / 'editor-ui-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
