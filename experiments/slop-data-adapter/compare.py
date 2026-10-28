"""Compose unretouched browser captures for review; no renderer changes."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'artifacts'/'slop-adapter'
titles=[('generated-nyc','Generated district · NY pipeline','181 buildings. Original footprint rings; NY facade and streamed detail modules.'),('nyc-nyc','Surveyed NYC crop · NY pipeline','342 buildings. NYC Open Data; street geography includes OpenStreetMap contributors (ODbL).'),('generated-sg','Generated district · SG pipeline','181 buildings. 0.25 m conservative inset, 0.1 m grid; 4.7% less footprint area. No NY detail pools.')]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--no-first-run','--disable-background-networking'])
    try:
        page=browser.new_page(viewport={'width':2400,'height':900},device_scale_factor=1)
        for view in ['street','overhead']:
            panels=''.join(f'<section><h2>{title}</h2><p>{caption}</p><img src="{(OUT/(prefix+"-"+view+".png")).as_uri()}"></section>' for prefix,title,caption in titles)
            html='<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#edf0ec;font:20px system-ui;color:#163b3d;padding:32px}h1{font-size:32px;margin:0 0 10px}h2{font-size:23px;margin:12px 0}p{line-height:1.4;margin:0 0 16px;height:58px;font-size:18px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}img{width:100%;display:block}footer{font-size:19px;margin-top:24px;line-height:1.5}</style><h1>Cityworks data adapter: '+view+'</h1><p>Same lens, camera pose and original Slop midday lighting. Common flat ground harness. Full-app features and post-processing are excluded.</p><div class="grid">'+panels+'</div><footer>NY modules: mrdoob/slop-newyork @ 13dd142 · SG modules: zz85/slop-singapore @ 69c6329 · MIT code, attribution retained.<br>This proves a working data boundary. It does not establish parity with the complete Slop New York experience or equal-workload performance.</footer>'
            html=html.replace('repeat(3,1fr)','repeat(3,minmax(0,1fr))').replace('img{width:100%','section{min-width:0}img{width:100%')
            source=OUT/('comparison-'+view+'.html');source.write_text(html,encoding='utf-8')
            page.goto(source.as_uri());page.wait_for_function('Array.from(document.images).every(i=>i.complete)');page.screenshot(path=str(OUT/('Cityworks-Slop-'+view+'-comparison.png')),full_page=True)
    finally:browser.close()
print('Comparison captures saved')
