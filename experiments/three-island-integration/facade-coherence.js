// Original fixture: identical metric geometry is rendered by each release's facade path.
import * as T from 'three/webgpu';
import {LightingSystem} from '../slop-data-adapter/upstream/nyc/lighting.js';
import {createPreWarBuildingMaterial} from './adapted-nyc/tsl-materials.js';
import {createBuildingFootprints} from './adapted-nyc/building-footprints.js';
import {FACADE_METRICS} from './facade-layout.js';
const renderer=new T.WebGPURenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);await renderer.init();
const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,300),lighting=new LightingSystem(scene,renderer);lighting.applyPreset('midday');
const group=new T.Group();scene.add(group);
const record=(id,coords,facadeIndex,height)=>({id,seed:18,facadeIndex,height,baseY:0,cx:coords[0][0],cz:-5,polygons:[{outer:coords.map(([x,z])=>({x,z})),holes:[]}],frontage:[],frontSetback:.1,streetLevel:true});
const records=[record('cream-split',[[-34,0],[-33,0],[-27,0],[-2,0],[-2,-12],[-34,-12]],0,20.4),record('red-band',[[2,0],[34,0],[34,-12],[2,-12]],1,23.8)];
// Both frontages follow the same actual straight street edge.
records[0].frontage=[{x:-34,z:0},{x:-2,z:0}];records[1].frontage=[{x:2,z:0},{x:34,z:0}];
for(const r of records){const material=createPreWarBuildingMaterial({stoneColor:r.facadeIndex?0xa45a45:0xc9b993,windowWidth:FACADE_METRICS[r.facadeIndex].bay,floorHeight:FACADE_METRICS[r.facadeIndex].floor,seed:27.8,footprintLocal:true});group.add(createBuildingFootprints(material,[r]));}
const floor=new T.Mesh(new T.BoxGeometry(160,.2,90),new T.MeshStandardNodeMaterial({color:0x8f9b91,roughness:1}));floor.position.set(0,-.2,0);scene.add(floor);
const views={front:[0,12,88,0,11,0],oblique:[43,13,40,2,12,0],rooms:[-18,9,12,-18,9,0],roomsLeft:[-22,9,12,-18,9,0],roomsRight:[-14,9,12,-18,9,0]};
function view(name){const v=views[name];camera.position.set(...v.slice(0,3));camera.lookAt(...v.slice(3));lighting.update(camera.position);}
function inspect(){const geometries=new Set(),materials=new Set(),panels=[];let nonfinite=0,bytes=0;group.traverse(o=>{if(o.geometry){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;for(const v of a.array)if(!Number.isFinite(v))nonfinite++;}}if(o.material)materials.add(o.material);panels.push(...(o.userData.facadePanels||[]));});return {render:JSON.parse(JSON.stringify(renderer.info.render)),geometries:geometries.size,materials:materials.size,bytes,nonfinite,panels,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray()}};}
view('front');window.Coherence={ready:false,view,inspect};await renderer.compileAsync(scene,camera);renderer.setAnimationLoop(()=>renderer.render(scene,camera));Coherence.ready=true;
