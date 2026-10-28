/* Cityworks ground and street preview. Renderer-neutral data lives in archipelago.js. */
(function(){
  'use strict';
  const C=ArchipelagoModel,T=THREE,$=id=>document.getElementById(id),host=$('viewport');
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.info.autoReset=false;host.prepend(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#dce5df').convertSRGBToLinear();scene.fog=new T.Fog(scene.background,2200,6500);
  const camera=new T.PerspectiveCamera(39,host.clientWidth/host.clientHeight,3,8000);
  scene.add(new T.HemisphereLight('#e3eff8','#817c64',.9));
  const sun=new T.DirectionalLight('#fff1d9',1.7);sun.position.set(-700,1100,-450);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-1250,right:1250,top:1000,bottom:-1000,near:100,far:2500});sun.shadow.bias=-.00005;sun.shadow.normalBias=.35;scene.add(sun);
  let world=new T.Group(),city,view='aerial',layer='ground',buildMs=0,lastError=null,markingInfo={},selected=null;scene.add(world);
  const orbit={theta:.15,phi:.64,radius:2900,target:new T.Vector3(0,0,-15)},walk={yaw:0,pitch:0},keys=new Set(),frames=[];let frameAt=performance.now();
  const color=hex=>new T.Color(hex).convertSRGBToLinear();
  function material(hex,texture='none'){
    const m=new T.MeshStandardMaterial({color:color(hex),roughness:.98});
    if(texture==='none')return m;
    m.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 vWorldMetric;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWorldMetric=(modelMatrix*vec4(position,1.0)).xyz;');
      s.fragmentShader='varying vec3 vWorldMetric;\n'+s.fragmentShader;
      const common='vec2 q=vWorldMetric.xz; float px=max(.0001,length(fwidth(q))); float grain=fract(sin(dot(floor(q*67.0),vec2(17.13,71.7)))*15632.41); float grainAa=1.0-smoothstep(.01,.08,px);';
      const details={
        paving:'vec2 slab=floor(q/1.5), edge=min(fract(q/1.5),1.0-fract(q/1.5))*1.5; float joint=(1.0-smoothstep(.006,.006+px,min(edge.x,edge.y)))*(1.0-smoothstep(.12,.4,px)); float tint=fract(sin(dot(slab,vec2(17.13,71.7)))*15632.41); diffuseColor.rgb*=.99+.02*tint-.1*joint+.012*(grain-.5)*grainAa;',
        concrete:'vec3 wn=abs(cross(dFdx(vWorldMetric),dFdy(vWorldMetric))); float along=wn.x>wn.z?vWorldMetric.z:vWorldMetric.x; vec2 cp=vec2(along,vWorldMetric.y)/vec2(3.0,1.2), ce=min(fract(cp),1.0-fract(cp))*vec2(3.0,1.2); float joint=1.0-smoothstep(.003,.003+max(px,.002),min(ce.x,ce.y)); diffuseColor.rgb*=.99-.045*joint+.015*(grain-.5)*grainAa;',
        curb:'diffuseColor.rgb*=.995+.012*(grain-.5)*grainAa;',
        water:'float ripple=sin(q.x*.035+sin(q.y*.019))*sin(q.y*.045); diffuseColor.rgb*=.98+.025*ripple;',
        earth:'float patches=sin(q.x*.021+sin(q.y*.013))*sin(q.y*.027);diffuseColor.rgb*=.97+.055*patches+.045*grain*grainAa;'
      },detail=details[texture]||'';
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+common+detail);
    };m.customProgramCacheKey=()=> 'cityworks-ground-v3-material2-'+texture;return m;
  }
  class Batch{
    constructor(mat,name){this.mat=mat;this.name=name;this.positions=[];}
    tri(a,b,c){
      const normal=new T.Vector3(...b).sub(new T.Vector3(...a)).cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
      const [fa,fb,fc]=[a,b,c].map(p=>new T.Vector3(...p.map(Math.fround))),packedNormal=fb.sub(fa).cross(fc.sub(fa));
      // Boolean slivers can be narrower than Float32 precision at city scale.
      // Do not emit a face that collapses or reverses when packed for the GPU.
      if(packedNormal.lengthSq()>1e-12&&packedNormal.dot(normal)>0)this.positions.push(...a,...b,...c);
    }
    surface(region,height,down=false){
      const points=[region.outer,...region.holes].flat(),triangles=T.ShapeUtils.triangulateShape(region.outer.map(p=>new T.Vector2(...p)),region.holes.map(r=>r.map(p=>new T.Vector2(...p))));
      const h=typeof height==='function'?height:()=>height;
      for(const ids of triangles){let [a,b,c]=ids.map(i=>points[i]);if(C.cross(a,b,c)>0)[b,c]=[c,b];if(down)[b,c]=[c,b];this.tri([a[0],h(...a),a[1]],[b[0],h(...b),b[1]],[c[0],h(...c),c[1]]);}
    }
    wallEdge(a,b,low,high){const la=typeof low==='function'?low(...a):low,lb=typeof low==='function'?low(...b):low,ha=typeof high==='function'?high(...a):high,hb=typeof high==='function'?high(...b):high;this.tri([a[0],la,a[1]],[a[0],ha,a[1]],[b[0],lb,b[1]]);this.tri([b[0],lb,b[1]],[a[0],ha,a[1]],[b[0],hb,b[1]]);}
    wall(ring,low,high){for(let i=0;i<ring.length;i++)this.wallEdge(ring[i],ring[(i+1)%ring.length],low,high);}
    prism(region,low,high){this.surface(region,high);for(const ring of [region.outer,...region.holes])this.wall(ring,low,high);}
    box(x,z,w,d,low,high){this.prism(C.shape(C.rect(x-w/2,z-d/2,x+w/2,z+d/2)),low,high);}
    finish(shadow=true,smooth=false){if(!this.positions.length){this.mat.dispose();return null;}const geometry=new T.BufferGeometry();if(smooth){const unique=[],indices=[],lookup=new Map();for(let i=0;i<this.positions.length;i+=3){const p=this.positions.slice(i,i+3),key=p.map(v=>Math.round(v*1000)).join(',');if(!lookup.has(key)){lookup.set(key,unique.length/3);unique.push(...p);}indices.push(lookup.get(key));}geometry.setAttribute('position',new T.Float32BufferAttribute(unique,3));geometry.setIndex(indices);}else geometry.setAttribute('position',new T.Float32BufferAttribute(this.positions,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,this.mat);mesh.name=this.name;mesh.castShadow=shadow;mesh.receiveShadow=true;world.add(mesh);return mesh;}
  }
  function dispose(){world.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});scene.remove(world);world=new T.Group();scene.add(world);selected=null;$('selection').hidden=true;}
  function terrain(abutments){
    const palette=['#b1b69a','#b7ae92','#819976'];
    city.islands.forEach((island,index)=>{
      const region=C.shape(island.boundary,island.holes),excluded=[...city.rightOfWay,...city.blocks.filter(b=>b.islandId===island.id&&b.use==='mixed').map(b=>C.shape(b.polygon,b.holes))],natural=C.boolean([region],excluded,'difference'),xs=island.boundary.map(p=>p[0]),zs=island.boundary.map(p=>p[1]),step=18,batch=new Batch(material(palette[index%3],'earth'),'terrain-'+island.id);
      for(let x=Math.floor(Math.min(...xs)/step)*step;x<Math.max(...xs);x+=step)for(let z=Math.floor(Math.min(...zs)/step)*step;z<Math.max(...zs);z+=step){
        const parts=C.boolean([C.shape(C.rect(x,z,x+step,z+step))],natural,'intersection');
        for(const part of parts)batch.surface(part,(px,pz)=>C.heightAt(city,px,pz));
      }
      // Match the coast wall to the actual sampled terrain boundary. Sparse
      // outline vertices alone miss raised bridge pads between those vertices.
      const vertices=[];for(let i=0;i<batch.positions.length;i+=3)vertices.push([batch.positions[i],batch.positions[i+2]]);
      const shore=new Batch(material(index===1?'#878774':'#989b83','earth'),'shore-'+island.id);
      const spans=city.bridges.filter(b=>b.fromIsland===island.id||b.toIsland===island.id).map(b=>({bridge:b,zone:C.corridor(b.a,b.b,b.width+2*b.sidewalkWidth)}));
      for(let i=0;i<island.boundary.length;i++){
        const a=island.boundary[i],b=island.boundary[(i+1)%island.boundary.length],stations=[{t:0,p:a},{t:1,p:b}];
        for(const p of vertices){const hit=C.projection(p,a,b);if(hit.distance<.002)stations.push({t:hit.t,p});}
        for(const span of spans)for(let j=0;j<span.zone.outer.length;j++){const hit=C.intersection(a,b,span.zone.outer[j],span.zone.outer[(j+1)%span.zone.outer.length]);if(hit)stations.push({t:hit.t,p:hit.point});}
        stations.sort((u,v)=>u.t-v.t);const cuts=stations.filter((v,j)=>!j||v.t-stations[j-1].t>1e-7);
        for(let j=0;j<cuts.length-1;j++){
          const p=cuts[j].p,q=cuts[j+1].p,mid=[(p[0]+q[0])/2,(p[1]+q[1])/2],span=spans.find(s=>C.inShape(s.zone,mid));
          if(span)abutments.wallEdge(p,q,-1,span.bridge.deckElevation-span.bridge.deckThickness);
          else shore.wallEdge(p,q,-1,(x,z)=>Math.max(.25,C.heightAt(city,x,z)));
        }
      }
      batch.finish(false,true);shore.finish();
    });
  }
  function bridgeStructures(concrete){
    const metal=new Batch(material('#697e7b'),'bridge-rails');
    for(const bridge of city.bridges){
      const a=bridge.a,b=bridge.b,length=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/length,(b[1]-a[1])/length],n=[-u[1],u[0]],at=(t,offset=0)=>[a[0]+u[0]*t+n[0]*offset,a[1]+u[1]*t+n[1]*offset],half=bridge.width/2+bridge.sidewalkWidth;
      // The graph includes approaches inland. Locate the visible span at the
      // coastline; bury a short deck overlap and rail return into each landing.
      const water=C.boolean([C.corridor(a,b,half*2)],city.landRegions,'difference'),coastStations=water.flatMap(region=>region.outer.map(p=>C.projection(p,a,b).t*length));
      const start=Math.min(...coastStations),end=Math.max(...coastStations);
      const deckStart=Math.max(0,start-6),deckEnd=Math.min(length,end+6),deck=C.corridor(at(deckStart),at(deckEnd),half*2),underside=bridge.deckElevation-bridge.deckThickness;
      concrete.wall(deck.outer,underside,bridge.deckElevation);concrete.surface(deck,underside,true);
      for(const side of [-1,1]){
        const A=at(deckStart,side*(half-.35)),B=at(deckEnd,side*(half-.35));
        // Two slim rails preserve views through to the bank and deck support.
        metal.prism(C.corridor(A,B,.12),8.65,8.77);metal.prism(C.corridor(A,B,.12),9.18,9.3);
        for(let t=deckStart;t<=deckEnd;t+=3){const p=at(t,side*(half-.35));metal.box(p[0],p[1],.13,.13,8.16,9.3);}
        const p=at(deckEnd,side*(half-.35));metal.box(p[0],p[1],.13,.13,8.16,9.3);
      }
      const spans=Math.max(2,Math.ceil((end-start)/65));
      for(let i=1;i<spans;i++){const t=start+(end-start)*i/spans;for(const side of [-1,1]){const q=at(t,side*bridge.width*.28);if(C.inRegions(city.landRegions,q))continue;concrete.prism(C.corridor(at(t-1.5,side*bridge.width*.28),at(t+1.5,side*bridge.width*.28),2.2),-2,underside);}}
    }
    concrete.finish();metal.finish();
  }
  function trees(){
    const sites=[],treeExclusion=C.offset(city.rightOfWay,4);
    for(const island of city.islands){
      const xs=island.boundary.map(p=>p[0]),zs=island.boundary.map(p=>p[1]);
      const step=island.id==='island:headland'?19:32;
      for(let x=Math.min(...xs)+20;x<Math.max(...xs);x+=step)for(let z=Math.min(...zs)+20;z<Math.max(...zs);z+=step){
        const id=island.id+':'+Math.round(x)+':'+Math.round(z),r=C.rand(city.input.seed,id,'tree');
        const p=[x+(r-.5)*17,z+(C.rand(city.input.seed,id,'z')-.5)*17];
        if(!C.inRegions(island.regions,p)||C.inRegions(treeExclusion,p))continue;
        const block=city.blocks.find(b=>b.islandId===island.id&&C.inShape(C.shape(b.polygon,b.holes),p));
        if(block&&block.use==='mixed')continue;
        const h=C.heightAt(city,...p),threshold=island.id==='island:harbour'?.18:island.id==='island:headland'?(h>12?.9:.42):.36;if(h<2.8||r>threshold)continue;sites.push({p,h,scale:.9+r*.7});
      }
    }
    // Trees at a regular walking scale reinforce the collector corridors. Keep
    // junction approaches clear and put trunks beyond the carriageway.
    for(const e of city.streets.filter(s=>s.class==='collector'&&!s.bridge)){
      const length=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),u=[(e.b[0]-e.a[0])/length,(e.b[1]-e.a[1])/length],n=[-u[1],u[0]];
      for(let d=25;d<length-25;d+=25)for(const side of [-1,1]){
        const p=[e.a[0]+u[0]*d+n[0]*side*(e.width/2+e.sidewalkWidth-.7),e.a[1]+u[1]*d+n[1]*side*(e.width/2+e.sidewalkWidth-.7)];
        if(!C.inRegions(city.landRegions,p)||city.streets.some(s=>s!==e&&C.projection(p,s.a,s.b).distance<s.width/2+4))continue;sites.push({p,h:8.16,scale:.8});
      }
    }
    const trunks=new T.InstancedMesh(new T.CylinderGeometry(.23,.3,3.6,5),material('#786c53'),sites.length),crowns=new T.InstancedMesh(new T.IcosahedronGeometry(2.7,1),material('#5e7856'),sites.length),m=new T.Matrix4(),q=new T.Quaternion();
    sites.forEach((s,i)=>{m.compose(new T.Vector3(s.p[0],s.h+1.8,s.p[1]),q,new T.Vector3(1,1,1));trunks.setMatrixAt(i,m);m.compose(new T.Vector3(s.p[0],s.h+4.8*s.scale,s.p[1]),q,new T.Vector3(s.scale,s.scale*1.25,s.scale));crowns.setMatrixAt(i,m);crowns.setColorAt(i,color(['#5e7856','#6c8558','#7e9163'][i%3]));});
    trunks.name='tree-trunks';crowns.name='tree-crowns';trunks.castShadow=crowns.castShadow=true;trunks.receiveShadow=crowns.receiveShadow=true;world.add(trunks,crowns);markingInfo.trees=sites.length;
  }
  function makeScene(){
    dispose();const water=new Batch(material('#386773','water'),'water');water.surface(C.shape(C.rect(-4500,-4500,4500,4500)),-.3);water.finish(false);
    const shallow=new Batch(material('#527c7c'),'shallows');for(const region of C.offset(city.landRegions,14))shallow.surface(region,-.17);shallow.finish(false);
    const bridgeConcrete=new Batch(material('#a8a99e','concrete'),'bridge-structure');terrain(bridgeConcrete);
    const sidewalks=new Batch(material('#b4b3aa','paving'),'sidewalks'),curbs=new Batch(material('#c8c9bd','curb'),'curbs');
    const walkCoverage=city.sidewalkCoverage||C.boolean(city.rightOfWay,city.roadCoverage,'difference'),curbTops=C.boolean(C.boolean(C.offset(city.roadCoverage,.18),city.roadCoverage,'difference'),walkCoverage,'intersection');
    for(const part of C.boolean(walkCoverage,curbTops,'difference'))sidewalks.surface(part,8.16);
    for(const part of curbTops)curbs.surface(part,8.16);
    for(const region of city.rightOfWay)for(const ring of [region.outer,...region.holes])sidewalks.wall(ring,8,8.16);
    for(const region of city.roadCoverage)for(const ring of [region.outer,...region.holes])curbs.wall([...ring].reverse(),8,8.16);
    sidewalks.finish(false);curbs.finish(false);
    const roads=new Batch(CityRoadMaterial(T),'road-surface');for(const region of city.roadCoverage)roads.surface(region,8);roads.finish(false);
    const blocks=new Batch(material('#b9b39f','earth'),'urban-blocks');
    for(const b of city.blocks)if(b.use==='mixed')blocks.surface(C.shape(b.polygon,b.holes),8);
    blocks.finish(false);bridgeStructures(bridgeConcrete);
    const paint=CityRoadMarkings(T,C,city);world.add(paint.mesh);markingInfo={crossings:paint.crossings,strips:paint.strips};trees();
    if(layer==='network'){
      const colors={arterial:'#d39247',collector:'#88b8b5',local:'#efdfb1'};
      for(const [kind,hex] of Object.entries(colors)){const lines=new Batch(material(hex),'network-'+kind);for(const e of city.streets.filter(e=>e.class===kind))lines.surface(C.corridor(e.a,e.b,kind==='arterial'?3:1.7),8.3);lines.finish(false);}
    }
  }
  const mobileLayout=matchMedia('(max-width:760px)'),touchInput=matchMedia('(pointer:coarse)');
  function activeButtons(selector,value,key){document.querySelectorAll(selector).forEach(b=>{const active=b.dataset[key]===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
  function cameraHelp(){const walking=view==='bridge'||view==='street';$('camera-hint').textContent=touchInput.matches?(walking?'Drag to look · Tap a road':'Drag to orbit · Tap a road'):(walking?'Drag to look · WASD move · Q/E height':'Drag to orbit · Scroll to zoom · Click a road');}
  function controlsPanel(open){
    open=mobileLayout.matches&&open;const wasOpen=document.body.classList.contains('controls-open'),panel=$('controls-panel');
    document.body.classList.toggle('controls-open',open);$('panel-backdrop').hidden=!open;$('open-controls').setAttribute('aria-expanded',String(open));host.inert=open;panel.inert=mobileLayout.matches&&!open;
    if(open){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');keys.clear();$('close-controls').focus();}
    else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');if(wasOpen&&mobileLayout.matches)$('open-controls').focus();}
  }
  $('open-controls').onclick=()=>controlsPanel(true);$('close-controls').onclick=()=>controlsPanel(false);$('panel-backdrop').onclick=()=>controlsPanel(false);
  mobileLayout.addEventListener('change',()=>controlsPanel(false));touchInput.addEventListener('change',cameraHelp);controlsPanel(false);
  addEventListener('keydown',e=>{
    if(document.body.classList.contains('controls-open')){
      if(e.key==='Escape'){e.preventDefault();controlsPanel(false);}
      if(e.key==='Tab'){const items=[...$('controls-panel').querySelectorAll('button,input,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    }else if(e.key==='Escape'){$('selection').hidden=true;selected=null;}
  });
  $('close-selection').onclick=()=>{$('selection').hidden=true;selected=null;};
  function outputs(){
    for(const key of ['coastVariation','streetSpacing','bridgeWidth']){$(key).value=city.input[key];$(key+'-out').textContent=key==='coastVariation'?Math.round(city.input[key]*100)+'%':city.input[key]+' m';}
    $('seed').value=city.input.seed;$('count-islands').textContent=city.islands.length;$('count-bridges').textContent=city.bridges.length;$('count-streets').textContent=(city.stats.streetLength/1000).toFixed(1);$('count-blocks').textContent=city.blocks.length;
    $('island-list').innerHTML=city.islands.map((island,i)=>'<button data-island="'+i+'" aria-label="Focus '+island.name+'">'+island.name+'</button>').join('');
    document.querySelectorAll('[data-island]').forEach(b=>b.onclick=()=>{focusIsland(Number(b.dataset.island));controlsPanel(false);});
    $('validation').textContent='Connected · '+city.nodes.length+' nodes · '+city.streets.length+' segments';
  }
  function rebuild(input={}){
    const start=performance.now();try{const next=C.generate({...city?.input,...input});city=next;makeScene();buildMs=performance.now()-start;outputs();lastError=null;$('status').className='';$('status').textContent='Rebuilt in '+Math.round(buildMs)+' ms';render();return true;}catch(e){lastError=e.message;$('status').className='error';$('status').textContent='Could not rebuild: '+e.message;console.error(e);return false;}
  }
  function orbitCamera(){camera.position.set(orbit.target.x+orbit.radius*Math.sin(orbit.phi)*Math.sin(orbit.theta),orbit.target.y+orbit.radius*Math.cos(orbit.phi),orbit.target.z+orbit.radius*Math.sin(orbit.phi)*Math.cos(orbit.theta));camera.lookAt(orbit.target);}
  function walkCamera(){camera.lookAt(camera.position.clone().add(new T.Vector3(Math.sin(walk.yaw)*Math.cos(walk.pitch),Math.sin(walk.pitch),Math.cos(walk.yaw)*Math.cos(walk.pitch))));}
  function setView(next){view=next;host.classList.toggle('street-view',next==='bridge'||next==='street');camera.near=(next==='bridge'||next==='street')?.5:30;camera.updateProjectionMatrix();activeButtons('[data-view]',view,'view');
    if(next==='bridge'||next==='street'){
      const bridge=city.bridges[0],a=bridge.a,b=bridge.b,len=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/len,(b[1]-a[1])/len];
      const n=[-u[1],u[0]],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];camera.position.set(mid[0]+n[0]*265,120,mid[1]+n[1]*265);walk.yaw=Math.atan2(-n[0],-n[1]);walk.pitch=Math.atan2(8-120,265);
      if(next==='street'){const e=city.streets.find(s=>s.class==='collector'&&!s.bridge&&Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1])>80);if(e){camera.position.set(e.a[0],10.2,e.a[1]);walk.yaw=Math.atan2(e.b[0]-e.a[0],e.b[1]-e.a[1]);walk.pitch=.025;}}
      walkCamera();$('view-title').textContent=next==='bridge'?'Harbour Bridge':'Street';
    }else{
      orbit.target.set(0,0,-15);orbit.radius=next==='overhead'?2850:3000;orbit.theta=next==='overhead'?0:.12;orbit.phi=next==='overhead'?.001:.62;orbitCamera();$('view-title').textContent=next==='overhead'?'Plan':'Three islands';
    }cameraHelp();render();
  }
  function focusIsland(index){const island=city.islands[index],center=C.center(island.boundary);view='aerial';host.classList.remove('street-view');activeButtons('[data-view]','aerial','view');camera.near=15;camera.updateProjectionMatrix();orbit.target.set(center[0],8,center[1]);orbit.radius=1350;orbit.phi=.92;orbitCamera();$('view-title').textContent=island.name;cameraHelp();}
  function render(){renderer.info.reset();renderer.render(scene,camera);$('count-calls').textContent=renderer.info.render.calls;}
  function inspect(){let nonfinite=0,badNormals=0,geometryBytes=0;world.traverse(o=>{if(!o.geometry)return;for(const a of Object.values(o.geometry.attributes)){geometryBytes+=a.array.byteLength;for(const n of a.array)if(!Number.isFinite(n))nonfinite++;}const normals=o.geometry.attributes.normal;for(let i=0;i<normals.count;i++){const len=Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i));if(!Number.isFinite(len)||len<.9||len>1.1)badNormals++;}});return {version:'0.3.0-dev',view,layer,buildMs,stats:city.stats,validation:C.validate(city),nonfinite,badNormals,geometryBytes,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory},programs:renderer.info.programs.length,details:markingInfo,frameSamples:frames.slice(-120),lastError};}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{layer=b.dataset.layer;activeButtons('[data-layer]',layer,'layer');$('network-legend').hidden=layer!=='network';makeScene();render();});
  for(const key of ['coastVariation','streetSpacing','bridgeWidth']){$(key).oninput=()=>{$(key+'-out').textContent=key==='coastVariation'?Math.round(Number($(key).value)*100)+'%':$(key).value+' m';};$(key).onchange=()=>rebuild({[key]:Number($(key).value)});}
  $('seed-form').onsubmit=e=>{e.preventDefault();rebuild({seed:$('seed').value});};$('reset').onclick=()=>{layer='ground';activeButtons('[data-layer]',layer,'layer');$('network-legend').hidden=true;if(rebuild(C.defaults))setView('aerial');};
  $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(city,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cityworks-three-islands.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  let drag=null;const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','City view');canvas.setAttribute('aria-describedby','camera-hint');canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,d:0};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.d+=Math.abs(dx)+Math.abs(dy);drag.x=e.clientX;drag.y=e.clientY;if(view==='bridge'||view==='street'){walk.yaw-=dx*.004;walk.pitch=Math.max(-1.2,Math.min(1.2,walk.pitch-dy*.004));walkCamera();}else{orbit.theta-=dx*.004;orbit.phi=Math.max(.001,Math.min(1.4,orbit.phi-dy*.004));orbitCamera();}};
  canvas.onpointerup=e=>{if(drag&&drag.d<5){const rect=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const point=new T.Vector3();if(ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-8),point)){const p=[point.x,point.z],near=city.streets.map(s=>({s,d:C.projection(p,s.a,s.b).distance})).sort((a,b)=>a.d-b.d)[0];if(near&&near.d<near.s.width/2+3){selected=near.s.id;$('selection').hidden=false;$('selection-content').innerHTML='<strong>'+near.s.class+(near.s.bridge?' bridge':' street')+'</strong>'+near.s.width+' m carriageway<br>'+(near.s.sidewalkWidth||3)+' m sidewalk each side<br><code>'+near.s.id+'</code>';}}}drag=null;};
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(view!=='bridge'&&view!=='street'){orbit.radius=Math.max(150,Math.min(4500,orbit.radius*Math.exp(e.deltaY*.001)));orbitCamera();}},{passive:false});
  addEventListener('keydown',e=>{if(!document.body.classList.contains('controls-open')&&!/INPUT|TEXTAREA/.test(e.target.tagName))keys.add(e.key.toLowerCase());});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());addEventListener('resize',()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();});
  const query=new URLSearchParams(location.search),initialInput={};
  for(const key of ['seed','coastVariation','streetSpacing','bridgeWidth','mapAreaKm2'])if(query.has(key))initialInput[key]=key==='seed'?query.get(key):Number(query.get(key));
  if(!rebuild(initialInput))return;setView('aerial');window.Cityworks={ready:true,get city(){return city;},rebuild,setView,inspect,setCamera(position,target){setView('bridge');camera.position.fromArray(position);const d=new T.Vector3(...target).sub(camera.position);walk.yaw=Math.atan2(d.x,d.z);walk.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));walkCamera();render();},geometrySnapshot(name){const g=world.getObjectByName(name)?.geometry;return g?{positions:Array.from(g.attributes.position.array),indices:g.index?Array.from(g.index.array):null}:null;},get selected(){return selected;},get cameraPosition(){return camera.position.toArray();},projectPoint(p){const v=new T.Vector3(...p).project(camera);return {x:host.offsetLeft+(v.x+1)*host.clientWidth/2,y:(1-v.y)*host.clientHeight/2};}};
  function loop(now){const dt=Math.min(50,now-frameAt);if(now-frameAt>0){frames.push(now-frameAt);if(frames.length>240)frames.shift();}frameAt=now;if(view==='bridge'||view==='street'){const speed=dt*.025*(keys.has('shift')?3:1),f=Number(keys.has('w'))-Number(keys.has('s')),r=Number(keys.has('d'))-Number(keys.has('a'));camera.position.x+=(Math.sin(walk.yaw)*f-Math.cos(walk.yaw)*r)*speed;camera.position.z+=(Math.cos(walk.yaw)*f+Math.sin(walk.yaw)*r)*speed;camera.position.y=Math.max(1.8,camera.position.y+(Number(keys.has('e'))-Number(keys.has('q')))*speed);walkCamera();}render();requestAnimationFrame(loop);}requestAnimationFrame(loop);
})();
