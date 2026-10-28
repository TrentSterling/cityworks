from pathlib import Path
import re,json,subprocess,zipfile,shutil
ROOT=Path(__file__).resolve().parent.parent
here=ROOT/'experiments/three-island-integration'
fixture=here/'facade-fixture.html';html=fixture.read_text()
match=re.search(r'<script type="importmap">(.*?)</script>',html,re.S);mapping=json.loads(match[1])
mapping['imports']['../slop-data-adapter/upstream/nyc/city-config.js']='./facade-fixture-config.js'
mapping['imports']['./config.js']='./facade-fixture-config.js'
fixture.write_text(html[:match.start(1)]+json.dumps(mapping)+html[match.end(1):])
target=ROOT/'artifacts/building-fit/baseline'
if not target.exists():
    archive=ROOT/'artifacts/building-fit/baseline.zip';archive.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['git','archive','--format=zip','--output='+str(archive),'b38327a29fb6290fef727a1025ccde08b3126702'],cwd=ROOT,check=True)
    target.mkdir();z=zipfile.ZipFile(archive);assert all((target/n).resolve().is_relative_to(target.resolve()) for n in z.namelist());z.extractall(target)
for name in ['facade-fixture.html','facade-fixture.js','facade-fixture-config.js']:shutil.copy2(here/name,target/'experiments/three-island-integration'/name)
