// A reproducible visual fixture for the production facade path.
import * as T from 'three/webgpu';
import {LightingSystem} from '../slop-data-adapter/upstream/nyc/lighting.js';
import {createPreWarBuildingMaterial,createCurtainWallMaterial} from './adapted-nyc/tsl-materials.js';
import {createBuildingFootprints} from './adapted-nyc/building-footprints.js';
const renderer=new T.WebGPURenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);await renderer.init();
const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,innerWidth/innerHeight,.1,300),lighting=new LightingSystem(scene,renderer);lighting.applyPreset('midday');camera.position.set(16,7.5,41);camera.lookAt(16,6,0);lighting.update(camera.position);
const widths=[.35,1.2,2.4,3.4,5,8,5],records=[];let x=0;
for(const [i,width] of widths.entries()){
 const outer=[{x,z:0},{x:x+width,z:0},{x:x+width,z:-1.5},{x,z:-1.5}],height=i===6?2.8:12.6;
 records.push({id:'fixture:'+i,seed:i,facadeIndex:1,height,baseY:0,cx:x+width/2,cz:-.75,polygons:[{outer,holes:[]}],frontage:[{x,z:0},{x:x+width,z:0}],frontSetback:.1,streetLevel:true});x+=width+1.5;
}
const brick=createPreWarBuildingMaterial({stoneColor:0xa45a45,windowWidth:2.4,floorHeight:3.5,seed:27.8,footprintLocal:true});
const glass=createCurtainWallMaterial({windowWidth:2.5,floorHeight:3.8,seed:81.9,footprintLocal:true});
const brickGroup=createBuildingFootprints(brick,records),glassGroup=createBuildingFootprints(glass,records.map(r=>({...r,facadeIndex:3})));scene.add(brickGroup,glassGroup);glassGroup.visible=false;
const floor=new T.Mesh(new T.BoxGeometry(90,.2,60),new T.MeshStandardNodeMaterial({color:0x8f9b91,roughness:1}));floor.position.set(15,-.2,0);scene.add(floor);
const inspect=()=>{const geometry=new Set(),materials=new Set(),panels=[];scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);panels.push(...(o.userData.facadePanels||[]));});return{render:JSON.parse(JSON.stringify(renderer.info.render)),geometries:geometry.size,materials:materials.size,panels};};
window.FacadeFixture={ready:false,setStyle:style=>{brickGroup.visible=style==='brick';glassGroup.visible=style==='glass';},inspect};
await renderer.compileAsync(scene,camera);renderer.setAnimationLoop(()=>renderer.render(scene,camera));FacadeFixture.ready=true;
