from pathlib import Path
import hashlib, json, re
root=Path(__file__).resolve().parent.parent
html=(root/'ground-editor.html').read_text(encoding='utf-8')
html=html.replace('href="index.html"','href="https://tront.xyz/cityworks/"').replace("this.href='index.html?'", "this.href='https://tront.xyz/cityworks/?'")
html=html.replace('<link rel="stylesheet" href="src/style.css">','<style>'+(root/'src/style.css').read_text(encoding='utf-8')+'</style>')
for src in re.findall(r'<script src="([^"]+)"></script>',html):
    html=html.replace('<script src="'+src+'"></script>','<script>\n'+(root/src).read_text(encoding='utf-8').replace('</script','<\\/script')+'\n</script>')
notices='\n\n'.join((root/name).read_text(encoding='utf-8') for name in ['THIRD_PARTY_NOTICES.txt','vendor/clipper-BOOST-LICENSE.txt','vendor/clipper-JSBN-LICENSE.txt','vendor/slop-newyork-MIT.txt'])
html=html.replace('</head>','<script type="text/plain" id="third-party-notices">'+notices.replace('</script','<\\/script')+'</script></head>')
version='0.3.0-dev' # The retained ground-only artifact has its own version.
out=root/'artifacts'/('v'+'.'.join(version.split('.')[:2]));out.mkdir(parents=True,exist_ok=True)
target=out/('Cityworks-'+version+'.html');target.write_text(html,encoding='utf-8')
print(json.dumps({'path':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
