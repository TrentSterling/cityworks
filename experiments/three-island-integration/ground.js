// Original Cityworks v0.3 ground geometry; WebGPU material adapter.
import * as T from 'three/webgpu';
import {createRoadSurfaceMaterial,createSidewalkMaterial,createCurbMaterial} from '../slop-data-adapter/upstream/nyc/tsl-materials.js';
import {createDryRoadMaterial,createMetricPaintMaterial} from './ground-materials.js';
export function buildGround(scene,city){
 const C=CityFabric,world=new T.Group();world.name='CityworksGround';scene.add(world);let markingInfo={},soffits=null,portals=null;
 const realm=city.publicRealm,rampZones=realm.ramps.flatMap(r=>r.polygons);
 const color=hex=>new T.Color(hex);
 function material(hex,texture='none'){
  if(texture==='paving')return createSidewalkMaterial();
  if(texture==='curb')return createCurbMaterial();
  const c=new T.Color(hex);if(texture==='earth')c.multiplyScalar(.23);else if(texture==='water')c.multiplyScalar(.45);else if(texture==='concrete')c.multiplyScalar(.4);return new T.MeshStandardNodeMaterial({color:c,roughness:texture==='water'?.5:1});
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
    // Court trees occupy inset green areas only; paths and building envelopes remain clear.
    for(const court of city.blockInteriors||[])for(const green of court.greens){
      const inset=C.offset([green],-3.5);if(!inset.length)continue;
      const center=C.center(inset[0].outer);if(C.inRegions(inset,center))sites.push({p:center,h:8.18,scale:.8});
    }
    const accessExclusion=(city.blockInteriors||[]).flatMap(c=>c.accesses.map(a=>{const street=city.streets.find(s=>s.id===a.streetId);return C.corridor(C.projection(a.from,street.a,street.b).point,a.to,a.width+6);}));
    accessExclusion.push(...C.offset([...realm.entrances.flatMap(e=>e.polygons),...rampZones],1));
    for(let i=sites.length-1;i>=0;i--)if(C.inRegions(accessExclusion,sites[i].p))sites.splice(i,1);
    const trunks=new T.InstancedMesh(new T.CylinderGeometry(.23,.3,3.6,5),material('#786c53'),sites.length),crowns=new T.InstancedMesh(new T.IcosahedronGeometry(2.7,1),material('#5e7856'),sites.length),m=new T.Matrix4(),q=new T.Quaternion();
    sites.forEach((s,i)=>{m.compose(new T.Vector3(s.p[0],s.h+1.8,s.p[1]),q,new T.Vector3(1,1,1));trunks.setMatrixAt(i,m);m.compose(new T.Vector3(s.p[0],s.h+4.8*s.scale,s.p[1]),q,new T.Vector3(s.scale,s.scale*1.25,s.scale));crowns.setMatrixAt(i,m);crowns.setColorAt(i,color(['#5e7856','#6c8558','#7e9163'][i%3]));});
    trunks.name='tree-trunks';crowns.name='tree-crowns';trunks.castShadow=crowns.castShadow=true;trunks.receiveShadow=crowns.receiveShadow=true;world.add(trunks,crowns);markingInfo.trees=sites.length;markingInfo.treeSites=sites.map(s=>({p:s.p,scale:s.scale}));
  }
  function curbWall(batch,ring){
    const cuts=realm.ramps.flatMap(r=>r.panels.flatMap(p=>p.outer));
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],stations=[{t:0,p:a},{t:1,p:b}];
      for(const p of cuts){const hit=C.projection(p,a,b);if(hit.distance<.004)stations.push({t:hit.t,p:hit.point});}
      stations.sort((a,b)=>a.t-b.t);const points=stations.filter((v,j)=>!j||v.t-stations[j-1].t>1e-7);
      const height=(x,z)=>{const p=[x,z],r=realm.ramps.find(r=>C.inRegions(r.polygons,p));return r?CityPublicRealm.rampHeight(r,p):8.16;};
      for(let j=0;j<points.length-1;j++)batch.wallEdge(points[j].p,points[j+1].p,8,height);
    }
  }
  function entrancePortals(){
    const frames=new Batch(material('#414c4c'),'entry-frames'),panes=new Batch(new T.MeshStandardNodeMaterial({color:0x233e45,roughness:.32,metalness:.2}),'entry-panes');
    for(const e of realm.entrances.filter(e=>e.kind!=='passage')){
      const point=(x,d)=>[e.to[0]+e.u[0]*x+e.n[0]*d,e.to[1]+e.u[1]*x+e.n[1]*d];
      const slab=(batch,w,low,high,depth,offset=.06,x=0)=>{
        const a=point(x-w/2,offset),b=point(x+w/2,offset),verts=[[a[0],e.elevation+low,a[1]],[b[0],e.elevation+low,b[1]],[a[0],e.elevation+high,a[1]],[b[0],e.elevation+high,b[1]]];
        if(-e.u[1]*e.n[0]+e.u[0]*e.n[1]>0){batch.tri(verts[0],verts[1],verts[2]);batch.tri(verts[2],verts[1],verts[3]);}
        else{batch.tri(verts[0],verts[2],verts[1]);batch.tri(verts[2],verts[3],verts[1]);}
      };
      // One complete glazed entry module covers the original ground-floor
      // opening, with sidelights/transom instead of a blank full-bay patch.
      const width=Math.max(e.doorWidth+.18,e.portalWidth*.83),height=e.portalHeight*.9+.025;
      slab(panes,width,0,height,0,.055);
      for(const x of [-width/2,width/2])slab(frames,.075,0,height+.04,0,.09,x);
      for(const x of [-e.doorWidth/2,0,e.doorWidth/2])slab(frames,.055,.02,e.doorHeight,0,.09,x);
      slab(frames,width+.075,height-.035,height+.04,0,.09);
      slab(frames,width,e.doorHeight-.035,e.doorHeight+.035,0,.09);
      slab(frames,width,0,.075,0,.09);
      slab(frames,e.doorWidth,.02,.2,0,.09);
      for(const x of [-.13,.13])slab(frames,.025,1.04,1.39,0,.14,x);
    }
    portals=new T.Group();portals.name='entrance-portals';
    for(const batch of [frames,panes]){const mesh=batch.finish(false);if(mesh){mesh.raycast=()=>{};portals.add(mesh);}}
    world.add(portals);
  }
  function makeScene(){
    const water=new Batch(material('#386773','water'),'water');water.surface(C.shape(C.rect(-45000,-45000,45000,45000)),-.3);water.finish(false);
    const shallow=new Batch(material('#527c7c'),'shallows');for(const region of C.offset(city.landRegions,14))shallow.surface(region,-.17);shallow.finish(false);
    const bridgeConcrete=new Batch(material('#a8a99e','concrete'),'bridge-structure');terrain(bridgeConcrete);
    const sidewalks=new Batch(material('#b4b3aa','paving'),'sidewalks'),curbs=new Batch(material('#c8c9bd','curb'),'curbs');
    const walkCoverage=city.sidewalkCoverage||C.boolean(city.rightOfWay,city.roadCoverage,'difference'),curbTops=C.boolean(C.boolean(C.offset(city.roadCoverage,.18),city.roadCoverage,'difference'),walkCoverage,'intersection');
    for(const part of C.boolean(C.boolean(walkCoverage,curbTops,'difference'),rampZones,'difference'))sidewalks.surface(part,8.16);
    for(const r of realm.ramps)for(const part of r.panels)sidewalks.surface(part,(x,z)=>CityPublicRealm.rampHeight(r,[x,z]));
    const trimmedCurbs=C.boolean(curbTops,rampZones,'difference');
    // Millimetre Boolean quantisation can leave almost-collinear needles at a
    // ramp cut. Remove sub-centimetre spurs before Earcut, which can bridge a
    // needle with a triangle across the lowered ramp. Never expand the curb.
    const cleanCurbs=C.boolean(C.offset(C.offset(trimmedCurbs,-.005),.005),trimmedCurbs,'intersection');
    for(const part of cleanCurbs)curbs.surface(part,8.16);
    for(const region of city.rightOfWay)for(const ring of [region.outer,...region.holes])sidewalks.wall(ring,8,8.16);
    for(const region of city.roadCoverage)for(const ring of [region.outer,...region.holes])curbWall(curbs,[...ring].reverse());
    sidewalks.finish(false);curbs.finish(false);
    const roads=new Batch(createDryRoadMaterial(),'road-surface');for(const region of city.roadCoverage)roads.surface(region,8);roads.finish(false);
    const blocks=new Batch(material('#b9b39f','earth'),'urban-blocks');
    for(const b of city.blocks)if(b.use==='mixed'){
      blocks.surface(C.shape(b.polygon,b.holes),8);
      // Close the grading pad against lower terrain without duplicating the
      // sidewalk's coincident inner wall at street-facing block boundaries.
      for(const ring of [b.polygon,...(b.holes||[])])for(let i=0;i<ring.length;i++){
        const a=ring[i],z=ring[(i+1)%ring.length],l=Math.hypot(z[0]-a[0],z[1]-a[1]),mid=[(a[0]+z[0])/2+(z[1]-a[1])/l*.01,(a[1]+z[1])/2-(z[0]-a[0])/l*.01];
        if(!C.inRegions(walkCoverage,mid))blocks.wallEdge(a,z,8,8.16);
      }
    }
    blocks.finish(false);
    // Partition the whole block surface; no coplanar pad/path overlays.
    const paving=new Batch(material('#aaaa99','paving'),'frontage-paving'),service=new Batch(createDryRoadMaterial(),'service-paving'),greens=new Batch(material('#577342','earth'),'block-gardens');
    for(const surface of realm.surfaces){
      for(const p of surface.paved)(surface.material==='service-paving'?service:paving).surface(p,8.16);
      for(const p of surface.greens)greens.surface(p,8.16);
    }
    for(const route of [...realm.entrances,...realm.courtRoutes]){
      const connector=C.boolean(C.boolean(route.polygons,city.rightOfWay,'intersection'),[...walkCoverage,...city.roadCoverage],'difference');
      for(const p of connector)paving.surface(p,8.16);
    }
    paving.finish(false);service.finish(false);greens.finish(false);entrancePortals();
    const underpasses=new Batch(bridgeConcrete.mat,'courtyard-passage-soffits');
    for(const b of city.buildings.filter(b=>b.passage))for(const v of b.volumes.filter(v=>v.role==='courtyard-upper'))for(const p of C.boolean(v.polygons,b.passage.polygons,'intersection'))underpasses.surface(p,v.baseElevation,true);
    if(underpasses.positions.length)soffits=underpasses.finish(false);
    bridgeStructures(bridgeConcrete);
    const paint=CityRoadMarkings(T,C,city);paint.mesh.material.dispose();paint.mesh.material=createMetricPaintMaterial();world.add(paint.mesh);markingInfo={crossings:paint.crossings,strips:paint.strips};trees();
  }
 makeScene();return {group:world,markingInfo,soffits,portals};
}
