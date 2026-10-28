"""Bundle local modules into one HTML; keep external Three.js commit pins."""
from pathlib import Path
import re,json,base64,posixpath
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'artifacts/three-island-integration';OUT.mkdir(parents=True,exist_ok=True)
html=(HERE/'index.html').read_text(encoding='utf-8')
html=html.replace("groundLink.href='../../ground-editor.html'", "groundLink.href='https://tront.xyz/cityworks/ground-editor.html'")
html=html.replace("editLink.href='../scoped-editor/'", "editLink.href='https://tront.xyz/cityworks/experiments/scoped-editor/'")
mapping=json.loads(re.search(r'<script type="importmap">(.*?)</script>',html,re.S)[1])['imports']
base=HERE.relative_to(ROOT).as_posix()
absolute=lambda path,parent:posixpath.normpath(posixpath.join(posixpath.dirname(parent),path))
aliases={absolute(k,base+'/index.html'):absolute(v,base+'/index.html') for k,v in mapping.items() if k.startswith('.')}
external={k:v for k,v in mapping.items() if not k.startswith('.')}
modules={}
def collect(name):
    name=aliases.get(name,name)
    key='cityworks-module/'+name
    if key in modules:return key
    modules[key]=None
    s=(ROOT/name).read_text(encoding='utf-8')
    def replace(m):
        prefix,quote,path=m.groups()
        return prefix+quote+collect(absolute(path,name))+quote if path.startswith('.') else m[0]
    s=re.sub(r"(from\s*|import\s*)(['\"])([^'\"]+)\2",replace,s)
    modules[key]='data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
    return key
main=collect(base+'/app.js')
html=re.sub(r'<script type="importmap">.*?</script>','<script type="importmap">'+json.dumps({'imports':{**external,**modules}})+'</script>',html,flags=re.S)
def inline(m):
    src=m[1];text=(HERE/src).resolve().read_text(encoding='utf-8').replace('</script','<\\/script')
    return '<script>'+text+'</script>'
html=re.sub(r'<script src="([^\"]+)"></script>',inline,html)
html=html.replace('<script type="module" src="app.js"></script>','<script type="module">import "'+main+'";</script>')
target=OUT/'Cityworks-Three-Island-Integration.html';target.write_bytes(html.encode())
print(json.dumps({'file':target.name,'bytes':target.stat().st_size,'localModules':len(modules),'externalDependency':'Three.js commit-pinned CDN'}))
