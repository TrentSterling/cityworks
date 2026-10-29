const assert=require('node:assert/strict'),C=require('../src/building-plan.js'),R=require('../src/public-realm.js'),P=require('../src/editor-state.js');
const area=(a,b,op)=>C.totalArea(C.boolean(a,b,op));
const T=require('../vendor/three.r140.min.js'),F=require('../src/facade-rules.js');
const inputs=[{},{seed:'REALM-1'},{seed:'FIT-NARROW',streetSpacing:94,coastVariation:.85},{seed:'REALM-WIDE',streetSpacing:128},{seed:'REALM-SMALL',mapAreaKm2:1.5},{seed:'REALM-LARGE',mapAreaKm2:3.2}];
for(const input of inputs){
 const c=C.generate(input),r=c.publicRealm,walk=c.sidewalkCoverage,feet=c.buildings.flatMap(b=>b.volumes[0].polygons);
 assert.equal(r.entrances.length,c.buildings.length,'Every building needs a real entrance route: '+c.input.seed);
 assert.equal(new Set(r.entrances.map(e=>e.buildingId)).size,c.buildings.length);
 const crossingZones=r.crossings.map(x=>C.corridor(x.center.map((v,i)=>v-x.n[i]*(x.width/2+.1)),x.center.map((v,i)=>v+x.n[i]*(x.width/2+.1)),x.depth));
 const network=C.boolean([...walk,...crossingZones]);let component;
 for(const e of r.entrances){
  assert.ok(C.inRegions(walk,e.from),e.id+' starts on sidewalk');
  assert.ok(area(e.polygons,feet,'intersection')<.03,e.id+' blocked by building');
  assert.ok(area(e.polygons,c.roadCoverage,'intersection')<.03,e.id+' strays into traffic');
  assert.ok(area(e.polygons,c.landRegions,'difference')<.03,e.id+' crosses water');
  const connected=network.findIndex(p=>C.inShape(p,e.from));assert.notEqual(connected,-1);
  if(component===undefined)component=connected;else assert.equal(connected,component,'Entrances must share a connected sidewalk/crossing network');
  if(e.kind!=='passage'){
   const b=c.buildings.find(b=>b.id===e.buildingId),edgeDistance=Math.min(...b.volumes[0].polygons.flatMap(p=>p.outer.map((v,i)=>C.projection(e.to,v,p.outer[(i+1)%p.outer.length]).distance)));
   assert.ok(edgeDistance<.002,e.id+' door is on the actual facade');assert.ok(e.doorWidth<=e.portalWidth&&e.doorHeight<=e.portalHeight);
   const domains=b.volumes[0].polygons.flatMap(p=>F.domains((C.area(p.outer)>0?[...p.outer].reverse():p.outer).map(([x,y])=>({x,y}))).filter(d=>d.offset===0));
   const domain=domains.find(d=>C.projection(e.to,[d.a.x,d.a.y],[d.b.x,d.b.y]).distance<.002);
   assert.ok(domain,'Entry has a rendered facade domain');
   const fit=F.layout(domain.width,b.volumes[0].topElevation-b.baseElevation,b.volumes[0].facadeIndex),along=Math.hypot(e.to[0]-domain.a.x,e.to[1]-domain.a.y),s=domain.reverse?domain.width-along:along;
   if(fit.bays)assert.ok(Math.abs((s-fit.pier)/fit.bayWidth-.5-Math.round((s-fit.pier)/fit.bayWidth-.5))<.001,'Door is centred on a full facade bay');
  }
 }
 for(let i=0;i<r.ramps.length;i++){
  const a=r.ramps[i];assert.ok(area(a.polygons,walk,'difference')<.03,a.id+' leaves sidewalk');
  assert.ok(Math.abs(R.rampHeight(a,a.center)-8)<.001);assert.ok(Math.abs(R.rampHeight(a,a.center.map((v,j)=>v+a.n[j]*a.run))-8.16)<.001);
  assert.ok(a.rise/a.run<1/12);
  // Use the renderer's triangulator and test interpolation inside each flare.
  // Endpoint-only tests missed the original wrong-diagonal 8 cm hump.
  for(const panel of a.panels){const points=panel.outer,triangles=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(...p)),[]);
   for(const ids of triangles){const p=ids.map(j=>points[j]),center=[0,1].map(k=>p.reduce((s,q)=>s+q[k],0)/3),meshHeight=p.reduce((s,q)=>s+R.rampHeight(a,q),0)/3;
    assert.ok(Math.abs(meshHeight-R.rampHeight(a,center))<.001,'Ramp flare mesh must follow the declared slope');}}
  for(let j=i+1;j<r.ramps.length;j++){const b=r.ramps[j];if(Math.hypot(...a.center.map((v,k)=>v-b.center[k]))<a.halfWidth+b.halfWidth+6)assert.ok(area(a.polygons,b.polygons,'intersection')<.025,'Ramp surfaces overlap');}
 }
 for(const x of r.crossings){assert.equal(x.ramps.filter(id=>r.ramps.some(p=>p.id===id)).length,2);const a=x.center.map((v,i)=>v-x.n[i]*(x.width/2-.3)),b=x.center.map((v,i)=>v+x.n[i]*(x.width/2-.3));assert.ok(area([C.corridor(a,b,x.depth)],c.roadCoverage,'difference')<.015,'Relocated crossing must stay on asphalt');}
 for(const e of r.courtRoutes){assert.ok(area(e.polygons,feet,'intersection')<.04,e.id+' court route obstructed');if(e.kind==='service')assert.ok(r.ramps.some(p=>p.id===e.id+':apron'),'Service yard needs a curb transition');}
 for(const s of r.surfaces){
  assert.ok(area(s.paved,s.greens,'intersection')<.02,'Surface materials must partition, not overlap');
  const block=c.blocks.find(b=>b.id===s.blockId),expected=C.boolean([C.shape(block.polygon,block.holes)],feet,'difference'),actual=[...s.paved,...s.greens];
  assert.ok(area(expected,actual,'difference')<.06&&area(actual,expected,'difference')<.06,'Block surface has a gap or spill');
  const routes=[...r.entrances,...r.courtRoutes].flatMap(e=>e.polygons);assert.ok(area(s.greens,routes,'intersection')<.03,'Planting obstructs a route');
 }
 console.log('PASS public realm',c.input.seed,{entrances:r.entrances.length,crossings:r.crossings.length,ramps:r.ramps.length,omitted:r.diagnostics.length});
}
const session=new P.Session(),locked=session.city.buildings[0],blockId=locked.blockId;
session.apply({type:'setLock',buildingId:locked.id,locked:true});const before=session.city;
session.apply({type:'rerollBlock',blockId});const after=session.city;
for(const e of before.publicRealm.entrances){const b=before.buildings.find(b=>b.id===e.buildingId);if(b.id===locked.id||b.blockId!==blockId)assert.deepEqual(after.publicRealm.entrances.find(x=>x.id===e.id),e);}
assert.deepEqual(after.publicRealm.ramps,before.publicRealm.ramps);session.undo();assert.deepEqual(session.city,before);
console.log('PASS locks, unaffected frontage records and exact public-realm undo');
const broken=structuredClone(before);broken.publicRealm.crossings=[];
assert.ok(R.validate(broken).some(e=>e.startsWith('Disconnected entrance')),'Disconnected generated access must be rejected before display');
