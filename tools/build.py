from pathlib import Path
import hashlib, json
root=Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="src/style.css">','<style>'+(root/'src/style.css').read_text()+'</style>')
for src in ['vendor/three.r140.min.js','vendor/clipper-6.4.2.js','src/geometry.js','src/city.js','src/viewer.js']:
    html=html.replace('<script src="'+src+'"></script>','<script>\n'+(root/src).read_text(encoding='utf-8').replace('</script','<\\/script')+'\n</script>')
notices='\n\n'.join((root/name).read_text(encoding='utf-8') for name in ['THIRD_PARTY_NOTICES.txt','vendor/clipper-BOOST-LICENSE.txt','vendor/clipper-JSBN-LICENSE.txt'])
html=html.replace('</head>','<script type="text/plain" id="third-party-notices">'+notices.replace('</script','<\\/script')+'</script></head>')
out=root/'artifacts'/'v0.2';out.mkdir(parents=True,exist_ok=True)
target=out/'Cityworks-0.2.0.html';target.write_text(html,encoding='utf-8')
print(json.dumps({'path':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
