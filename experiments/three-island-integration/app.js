import * as T from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {city,REAL_BUILDINGS as records} from './data.js';
import {LightingSystem} from '../slop-data-adapter/upstream/nyc/lighting.js';
import {buildGround} from './ground.js';
import {buildCityBlocks} from './adapted-nyc/buildings.js';
const C=CityFabric,$=id=>document.getElementById(id),renderer=new T.WebGPURenderer({antialias:true,reversedDepthBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);await renderer.init();
const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.2,8000),controls=new OrbitControls(camera,renderer.domElement);
const lighting=new LightingSystem(scene,renderer);lighting.applyPreset('midday');
const start=performance.now(),ground=buildGround(scene,city),cityBuildings=buildCityBlocks(scene),buildMs=performance.now()-start;
if(ground.soffits)cityBuildings.group.add(ground.soffits);
const samples=[];let last=performance.now(),view,selected;
function setCamera(p,t){camera.position.fromArray(p);controls.target.fromArray(t);controls.update();lighting.update(camera.position);cityBuildings.update(p[0],p[2],true);}
function setView(name){view=name;
 if(name==='overhead')setCamera([0,2200,.01],[0,0,0]);
 else if(name==='street')setCamera([-78,9.94,110],[-78,18.94,-125]);
 else if(name==='district')setCamera([210,280,380],[-90,10,-60]);
 else if(name==='bridge')setCamera([-512,13,191],[-330,12,190]);
 else if(name==='courtyard'){const b=city.buildings.find(b=>b.profile==='courtyard'),[x,z]=b.center;setCamera([x+70,b.height+80,z+90],[x,15,z]);}
 else if(name==='passage'){const b=city.buildings.find(b=>b.passage),p=b.passage,l=Math.hypot(p.to[0]-p.from[0],p.to[1]-p.from[1]);setCamera([p.from[0]+(p.from[0]-p.to[0])/l*12,9.94,p.from[1]+(p.from[1]-p.to[1])/l*12],[p.to[0],9.94,p.to[1]]);}
 else if(name==='passage-ceiling'){const b=city.buildings.find(b=>b.passage),p=b.passage,upper=b.volumes.find(v=>v.role==='courtyard-upper'),center=C.center(C.boolean(upper.polygons,p.polygons,'intersection')[0].outer);setCamera([center[0],9.94,center[1]],[p.to[0],15,p.to[1]]);}
 else if(name==='comparison-overhead')setCamera([-90,858.16,-59.99],[-90,8.16,-60]);
 else setCamera([950,1050,1150],[-60,0,0]);
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('buildings').onclick=e=>{cityBuildings.group.visible=!cityBuildings.group.visible;e.target.textContent=cityBuildings.group.visible?'Hide buildings':'Show buildings';};
$('seed').value=city.input.seed;
const groundQuery=new URLSearchParams();for(const key of ['seed','coastVariation','streetSpacing','bridgeWidth'])groundQuery.set(key,city.input[key]);
$('ground-editor').href+='?'+groundQuery;
$('rebuild').onsubmit=e=>{e.preventDefault();const q=new URLSearchParams(location.search);q.set('seed',$('seed').value);q.delete('edits');location.search=q;};
$('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(city,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='cityworks-three-island-plan.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
function select(id){selected=city.buildings.find(b=>b.id===id);$('selection').hidden=!selected;if(selected){$('selected-label').textContent=selected.id;$('height').value=selected.height;}dispatchEvent(new CustomEvent('cityworks-selection',{detail:{buildingId:selected?.id||null}}));}
$('clear-selection').onclick=()=>select(null);
$('apply-height').onclick=()=>{const height=Number($('height').value);if(!Number.isFinite(height)||height<6||height>180){$('error').textContent='Height must be 6 to 180 metres.';return;}const q=new URLSearchParams(location.search);q.set('edits',JSON.stringify({...city.buildingEdits,[selected.id]:{height}}));location.search=q;};
const ray=new T.Raycaster();let pointerStart;
renderer.domElement.addEventListener('pointerdown',e=>pointerStart=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>4)return;ray.setFromCamera(new T.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);const hit=ray.intersectObject(cityBuildings.group,true)[0];if(hit){const b=city.buildings.find(b=>b.volumes.some(v=>hit.point.y>=v.baseElevation-.05&&hit.point.y<=v.topElevation+.05&&C.inRegions(v.polygons,[hit.point.x,hit.point.z])));select(b?.id);}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function inspect(){let nonfinite=0,badNormals=0,geometryBytes=0,activeTriangles=0;const geos=new Set(),mats=new Set();scene.traverse(o=>{if(!o.geometry)return;const g=o.geometry;geos.add(g);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);activeTriangles+=(g.index?.count||g.attributes.position?.count||0)/3*(o.isInstancedMesh?o.count:1);for(const a of Object.values(g.attributes))for(const n of a.array)if(!Number.isFinite(n))nonfinite++;const n=g.attributes.normal;if(n)for(let i=0;i<n.count;i++){const len=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(len<.99||len>1.01)badNormals++;}});for(const g of geos){for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=g.index?.array.byteLength||0;}return{view,buildMs,stats:city.stats,nonfinite,badNormals,geometries:geos.size,materials:mats.size,geometryBytes,activeTriangles,render:JSON.parse(JSON.stringify(renderer.info.render)),memory:{...renderer.info.memory},frames:samples.slice(-90),camera:camera.position.toArray(),target:controls.target.toArray(),details:cityBuildings.allBlocks.reduce((s,b)=>{for(const k of ['cornices','waterTowers','hvacUnits','fireEscapes','awnings','scaffoldSheds'])s[k]=(s[k]||0)+(b[k]?.length||0);return s;},{})};}
let highlight;
function highlightSelection(blockId,buildingId){
 if(highlight){scene.remove(highlight);highlight.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 highlight=new T.Group();highlight.name='editor-selection';
 const add=(ring,y,color)=>{const points=[...ring,ring[0]].map(([x,z])=>new T.Vector3(x,y,z));highlight.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,depthTest:false})));};
 const block=city.blocks.find(b=>b.id===blockId);if(block)add(block.polygon,8.3,0xfcbf49);
 const b=city.buildings.find(b=>b.id===buildingId);if(b)for(const v of b.volumes)for(const p of v.polygons)add(p.outer,v.topElevation+.08,0x00e6da);
 scene.add(highlight);
}
window.Integration={ready:false,inspect,setView,setCamera,select,highlightSelection,scene,camera,renderer,city,records,cityBuildings,ground,
 dispose:()=>{renderer.setAnimationLoop(null);controls.dispose();renderer.dispose();},
 passageHits:(b)=>{const p=b.passage,from=new T.Vector3(p.from[0],9.94,p.from[1]),to=new T.Vector3(p.to[0],9.94,p.to[1]),direction=to.clone().sub(from);scene.updateMatrixWorld(true);return new T.Raycaster(from,direction.clone().normalize(),0,direction.length()).intersectObject(cityBuildings.group,true).map(h=>({distance:h.distance,name:h.object.name}));},
 ceilingHits:(x,z)=>{scene.updateMatrixWorld(true);return new T.Raycaster(new T.Vector3(x,9.94,z),new T.Vector3(0,1,0),0,20).intersectObject(cityBuildings.group,true).map(h=>({y:h.point.y,name:h.object.name}));},
 roofHits:(x,z)=>{scene.updateMatrixWorld(true);return new T.Raycaster(new T.Vector3(x,1000,z),new T.Vector3(0,-1,0)).intersectObject(cityBuildings.group,true).map(h=>({y:h.point.y,name:h.object.name}));}};
setView(new URLSearchParams(location.search).get('view')||'aerial');await renderer.compileAsync(scene,camera);
renderer.setAnimationLoop(()=>{const now=performance.now();samples.push(now-last);last=now;if(samples.length>180)samples.shift();lighting.update(camera.position);cityBuildings.update(camera.position.x,camera.position.z);renderer.render(scene,camera);});
window.Integration.ready=true;$('status').textContent=`${city.islands.length} islands · ${city.bridges.length} bridges · ${city.parcels.length} parcels · ${city.buildings.length} buildings · metres`;
