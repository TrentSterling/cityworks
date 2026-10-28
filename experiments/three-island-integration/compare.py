"""Compose unretouched captures. Run after browser verification under GPU lease."""
from pathlib import Path
import json
from html import escape
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/three-island-integration'
BASE = ROOT / 'artifacts/slop-adapter'
stats = json.loads((OUT / 'browser-report.json').read_text())['views']['district']['stats']
STYLE = '''body{margin:0;padding:28px;background:#eef0ec;color:#183a3c;font:21px system-ui}h1{font-size:32px;margin:0 0 12px}h2{font-size:26px;margin:8px 0}p{margin:0 0 15px;line-height:1.4}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}img{display:block;width:100%}footer{font-size:19px;margin-top:20px;line-height:1.5}'''

def compose(page, name, title, intro, panels, footer):
    body = ''.join(f'<section><h2>{escape(t)}</h2><p>{escape(c)}</p><img src="{p.as_uri()}"></section>' for t, c, p in panels)
    html = f'<!doctype html><meta charset="utf-8"><style>{STYLE}</style><h1>{escape(title)}</h1><p>{escape(intro)}</p><div class="grid">{body}</div><footer>{escape(footer)}</footer>'
    path = OUT / (name + '.html')
    path.write_text(html, encoding='utf-8')
    page.goto(path.as_uri())
    page.wait_for_function('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
    page.screenshot(path=str(OUT / (name + '.png')), full_page=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--mute-audio', '--no-first-run', '--disable-background-networking'])
    try:
        page = browser.new_page(viewport={'width':2400, 'height':1070}, device_scale_factor=1)
        for view, integrated in [('street', 'street'), ('overhead', 'comparison-overhead')]:
            compose(page, 'Cityworks-Slop-' + view + '-comparison', 'Cityworks integration / ' + view,
                'Same 55-degree lens, midday lighting and viewing direction. Street eye height: 1.78 m; plan height: approximately 850 m. Different maps and workloads.',
                [('Planned three-island district', f"{stats['buildings']} generated buildings / {stats['volumes']} explicit volumes. Cityworks ground, adapted NY facade path.", OUT / (integrated + '.png')),
                 ('Surveyed NYC reference crop', '342 surveyed records. Unchanged NY facade path in the earlier flat ground harness.', BASE / ('nyc-nyc-' + view + '.png'))],
                'NY code: mrdoob/slop-newyork @ 13dd142, MIT. NYC footprints: NYC Open Data; reference streets include OpenStreetMap contributors (ODbL). Planned parcel rhythm and skyline groups now read more clearly, but facade variety and ground-floor detail still fall short. Full-app post-processing is excluded.')
        compose(page, 'Cityworks-Parcel-Quality-Comparison', 'Cityworks / planned parcels and block interiors',
            'Same district camera, seed, ground model and lighting. Unretouched browser captures.',
            [('Delivered baseline / fa348dd', '598 buildings, 16 towers. District: 87 draws / 356,817 rendered triangles.', OUT / 'baseline-fa348dd/district.png'),
             ('Planned fabric / current', '473 buildings, 5 towers in 2 groups, 37 shared interiors. District: 86 draws / 351,951 triangles.', OUT / 'district.png')],
            'Larger corner lots, district-specific frontage and depth sequences, reserved shared gardens/yards and two planned skyline groups. Street view: 86 draws / 381,462 triangles versus 87 / 389,738 before. Facades and ground floors remain repetitive; this does not establish New York parity.')
    finally:
        browser.close()
print('Three comparisons saved.')
