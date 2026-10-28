"""Render matched, unaltered browser captures into before/after review sheets."""
from pathlib import Path
import argparse
import base64
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--before', type=Path, default=ROOT / 'artifacts/v0.3/baseline-6ef61fd')
parser.add_argument('--after', type=Path, default=ROOT / 'artifacts/v0.3')
parser.add_argument('--out', type=Path, default=ROOT / 'artifacts/v0.3')
parser.add_argument('--browser-executable')
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        **({'executable_path': args.browser_executable} if args.browser_executable else {'channel': 'chrome'}),
        headless=True, args=['--mute-audio', '--no-first-run', '--disable-background-networking'])
    try:
        page = browser.new_page(viewport={'width': 2400, 'height': 910}, device_scale_factor=1)
        for view in ['bridge', 'street']:
            images = [base64.b64encode((folder / f'cityworks-v03-{view}.png').read_bytes()).decode('ascii')
                      for folder in [args.before, args.after]]
            html = '''<!doctype html><meta charset="utf-8"><title>Cityworks ground review</title>
            <style>*{box-sizing:border-box}body{margin:0;background:#f3f1e8;color:#203c3a;font:18px system-ui}
            header{height:40px;padding:8px 20px;font-weight:700}main{display:grid;grid-template-columns:1fr 1fr}
            figure{margin:0}figcaption{height:45px;padding:10px 20px;border-top:1px solid #d2d5c9}
            img{display:block;width:1200px;height:825px}small{float:right;font-weight:400}</style>
            <header>Cityworks | ''' + view.title() + ''' comparison<small>Matched seed, camera and lighting. Buildings hidden.</small></header>
            <main><figure><figcaption>Before | 6ef61fd</figcaption><img src="data:image/png;base64,'''+images[0]+'''"></figure>
            <figure><figcaption>After | materials and shoreline connections</figcaption><img src="data:image/png;base64,'''+images[1]+'''"></figure></main>'''
            page.set_content(html)
            page.locator('img').evaluate_all('(images) => Promise.all(images.map(image => image.decode()))')
            path = args.out / f'cityworks-v03-{view}-comparison.png'
            page.screenshot(path=str(path))
            print(path.name)
    finally:
        browser.close()
