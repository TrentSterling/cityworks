import * as T from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {dataset,mode} from './data.js';
import {LightingSystem} from './upstream/nyc/lighting.js';
import {createRoadSurfaceMaterial,createSidewalkMaterial,createCurbMaterial} from './upstream/nyc/tsl-materials.js';
const pipeline=new URLSearchParams(location.search).get('pipeline')==='sg'?'sg':'nyc';
const renderer=new T.WebGPURenderer({antialias:true,reversedDepthBuffer:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);await renderer.init();
const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.2,2500),controls=new OrbitControls(camera,renderer.domElement);
const lighting=new LightingSystem(scene,renderer);lighting.applyPreset('midday');
const ground=new T.Group();ground.name='AdapterGround';scene.add(ground);
function surface(regions,y,material,name){const group=new T.Group();group.name=name;for(const r of regions){const s=new T.Shape(r.outer.map(([x,z])=>new T.Vector2(x,-z)));s.holes=r.holes.map(h=>new T.Path(h.map(([x,z])=>new T.Vector2(x,-z))));const g=new T.ShapeGeometry(s);g.rotateX(-Math.PI/2);g.translate(0,y,0);const m=new T.Mesh(g,material);m.receiveShadow=true;group.add(m);}ground.add(group);return group;}
const mat=(color,roughness=1)=>new T.MeshStandardNodeMaterial({color,roughness});
const city=dataset.city;
surface([{outer:[[-1800,-1800],[1800,-1800],[1800,1800],[-1800,1800]],holes:[]}],-2.2,mat(0x5b8b97,.4),'Water');
surface(city.island.regions,0,mat(0x68745b),'FlatLand');
surface(city.sidewalkCoverage,.22,createSidewalkMaterial(),'Sidewalks');
surface(city.roadCoverage,.025,createRoadSurfaceMaterial(),'Roads');
{
 const p=[];for(const region of city.sidewalkCoverage)for(const ring of [region.outer,...region.holes])for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];p.push(a[0],.025,a[1],b[0],.025,b[1],b[0],.22,b[1],a[0],.025,a[1],b[0],.22,b[1],a[0],.22,a[1]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();const m=createCurbMaterial();m.side=T.DoubleSide;ground.add(new T.Mesh(g,m));
}
for(const b of city.blocks)surface([{outer:b.polygon,holes:b.holes||[]}],.221,mat(b.use==='park'?0x74886a:0xa39e8e),'Block');
// Coverage remains the generated Boolean union. Only surfacing is harness-owned.
const buildStart=performance.now();
const builder=pipeline==='nyc'?(await import('./upstream/nyc/buildings.js')).buildCityBlocks:(await import('./upstream/singapore/open-city-buildings.js')).buildOpenCityBuildings;
const cityBuildings=builder(scene);const buildMs=performance.now()-buildStart;
const records=dataset.records,focus=dataset.focus||[0,0];
const samples=[];let last=performance.now(),view;
function setView(name){view=name;const [x,z]=focus;
 if(name==='overhead'){camera.position.set(x,850,z+.01);controls.target.set(x,0,z);}
 else if(name==='street'){camera.position.set(x+12,2,z+155);controls.target.set(x+12,11,z-80);}
 else if(name==='courtyard'){const b=records.find(r=>r.id===dataset.report?.cases.courtyardId)||records.find(r=>r.polygons.some(p=>p.holes.length));const cx=b?.cx||x,cz=b?.cz||z;camera.position.set(cx+37,(b?.height||25)+45,cz+45);controls.target.set(cx,12,cz);}
 else{camera.position.set(x+380,380,z+470);controls.target.set(x,0,z);}
 controls.update();lighting.update(camera.position);cityBuildings.update(camera.position.x,camera.position.z,true);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelector('#buildings').onclick=e=>{cityBuildings.group.visible=!cityBuildings.group.visible;e.target.textContent=cityBuildings.group.visible?'Hide buildings':'Show buildings';};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function inspect(){let nonfinite=0,badNormals=0,geometryBytes=0,indexTriangles=0,activeTriangles=0;const geos=new Set(),mats=new Set();scene.traverse(o=>{if(!o.geometry)return;const g=o.geometry;geos.add(g);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);if(!g.userData.counted){/* count per object below; shared byte dedup is done after traversal */}const count=(g.index?.count||g.attributes.position?.count||0)/3;indexTriangles+=count;activeTriangles+=count*(o.isInstancedMesh?o.count:1);for(const a of Object.values(g.attributes))for(const n of a.array)if(!Number.isFinite(n))nonfinite++;const n=g.attributes.normal;if(n)for(let i=0;i<n.count;i++){const len=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(len<.99||len>1.01)badNormals++;}});for(const g of geos){for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=g.index?.array.byteLength||0;}return {pipeline,data:mode,view,buildMs,buildings:records.length,nonfinite,badNormals,geometries:geos.size,materials:mats.size,geometryBytes,indexTriangles,activeTriangles,render:JSON.parse(JSON.stringify(renderer.info.render)),memory:{...renderer.info.memory},frames:samples.slice(-90),camera:camera.position.toArray(),target:controls.target.toArray(),details:cityBuildings.allBlocks.reduce((s,b)=>{for(const k of ['cornices','waterTowers','hvacUnits','fireEscapes','awnings','scaffoldSheds'])s[k]=(s[k]||0)+(b[k]?.length||0);return s;},{})};}
window.Adapter={ready:false,inspect,setView,scene,camera,renderer,dataset,cityBuildings,setCamera:(p,t)=>{camera.position.fromArray(p);controls.target.fromArray(t);controls.update();cityBuildings.update(p[0],p[2],true);}};
window.Adapter.roofHits=(x,z)=>{scene.updateMatrixWorld(true);return new T.Raycaster(new T.Vector3(x,1000,z),new T.Vector3(0,-1,0)).intersectObject(cityBuildings.group,true).map(h=>({y:h.point.y,name:h.object.name}));};
setView('aerial');await renderer.compileAsync(scene,camera);
renderer.setAnimationLoop(()=>{const now=performance.now();samples.push(now-last);last=now;if(samples.length>180)samples.shift();lighting.update(camera.position);cityBuildings.update(camera.position.x,camera.position.z);renderer.render(scene,camera);});
window.Adapter.ready=true;document.querySelector('#status').textContent=`${mode==='nyc'?'NYC surveyed sample':'Generated district'} · ${pipeline==='nyc'?'Unchanged NY buildings + details':'Unchanged SG building decoder'} · ${records.length} buildings · metres`;
