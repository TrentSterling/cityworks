"""Publish the integrated city at the root, retaining the separate ground editor."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
source = ROOT / 'experiments/three-island-integration/index.html'
html = source.read_text(encoding='utf-8')
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8"><base href="experiments/three-island-integration/">', 1)
html = html.replace('Cityworks | Three-island building integration', 'Cityworks | Three islands')
assert (ROOT / 'ground-editor.html').is_file(), 'Preserve the ground editor before building the release entry.'
(ROOT / 'index.html').write_text(html, encoding='utf-8')
print('Default entry: integrated city. Ground editor: ground-editor.html.')
