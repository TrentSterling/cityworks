"""Compose unretouched reviewed captures. Run after both browser harnesses."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/three-island-integration';BASE=ROOT/'artifacts/slop-adapter'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--no-first-run','--disable-background-networking'])
    try:
        page=browser.new_page(viewport={'width':2400,'height':1070},device_scale_factor=1)
        for view,integrated in [('street','street'),('overhead','comparison-overhead')]:
            panels=[('Three-island integration','598 generated buildings / 614 explicit volumes. Cityworks ground, adapted NY facade path.',OUT/(integrated+'.png')),('Surveyed NYC reference crop','342 surveyed records. Unchanged NY facade path in the earlier flat ground harness.',BASE/('nyc-nyc-'+view+'.png'))]
            body=''.join(f'<section><h2>{title}</h2><p>{caption}</p><img src="{path.as_uri()}"></section>' for title,caption,path in panels)
            html='''<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:28px;background:#eef0ec;color:#183a3c;font:21px system-ui}h1{font-size:32px;margin:0 0 12px}h2{font-size:26px;margin:8px 0}p{margin:0 0 15px;line-height:1.4}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}img{display:block;width:100%}footer{font-size:19px;margin-top:20px;line-height:1.5}</style><h1>Cityworks integration / '''+view+'''</h1><p>Same 55° lens, midday lighting and viewing direction. Street eye height: 1.78 m; plan height: approximately 850 m. Different maps and workloads.</p><div class="grid">'''+body+'''</div><footer>NY code: mrdoob/slop-newyork @ 13dd142, MIT. NYC footprints: NYC Open Data; reference street geography includes OpenStreetMap contributors (ODbL).<br>The generated city now uses the building system. Repeated plot widths and tower placement still fall short of the surveyed reference. Full-app post-processing is excluded.</footer>'''
            path=OUT/('comparison-'+view+'.html');path.write_text(html,encoding='utf-8');page.goto(path.as_uri());page.wait_for_function('Array.from(document.images).every(i=>i.complete)');page.screenshot(path=str(OUT/('Cityworks-Slop-'+view+'-comparison.png')),full_page=True)
    finally:browser.close()
print('Two comparisons saved.')
