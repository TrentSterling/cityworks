const assert=require('node:assert/strict'),crypto=require('node:crypto'),C=require('../src/building-plan.js'),P=require('../src/editor-state.js'),T=require('../vendor/three.r140.min.js'),saved=require('./fixtures/massing-053.json');
const area=(a,b,op)=>C.totalArea(C.boolean(a,b,op)),rings=p=>p.flatMap(s=>[s.outer,...s.holes]);
const edges=p=>rings(p).flatMap(r=>r.map((a,i)=>Math.hypot(...a.map((v,j)=>v-r[(i+1)%r.length][j]))));
for(const fixture of saved.fixtures){
 const next=C.resolvedFootprints(fixture.polygons);
 assert.ok(area(next,fixture.polygons,'difference')<.0002,fixture.id+' may only lose mass');
 assert.ok(C.totalArea(next)>=C.totalArea(fixture.polygons)*.88,fixture.id+' retains useful volume');
 assert.ok(next.every(p=>C.totalArea([p])>=120&&C.totalArea(C.offset([p],-4))>=4&&C.footprintAspect(p)<=6));
 assert.deepEqual(C.resolvedFootprints(next),next,'Simplification is stable after reaching its bounded solution');
 if(fixture.id.includes('21fd5298'))assert.deepEqual(next,fixture.polygons,'Healthy narrow rectangle must survive exactly');
 else assert.ok(edges(next).length<edges(fixture.polygons).length,'Reproduced defect must actually improve: '+fixture.id);
}
for(const ring of [C.rect(0,0,20,30),[[0,0],[35,0],[35,12],[12,12],[12,40],[0,40]],[[0,0],[42,0],[42,38],[30,38],[30,12],[12,12],[12,38],[0,38]]]){
 const p=[C.shape(C.canonical(ring))];assert.deepEqual(C.resolvedFootprints(p),p,'Broad rectangular, L and U designs are not flattened');
}
for(const item of saved.legacy){
 const p=P.normalize(item.project),c=P.compile(p),digest=crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex');
 assert.equal(digest,item.sha256,'Saved legacy project retains byte-exact city, locks, overrides and scoped seeds');
 assert.equal(P.exportCity(p).exportContract.generatorVersion,C.LEGACY_VERSION);
 const s=new P.Session(p),b=s.city.buildings.find(b=>p.locks[b.id]),before=JSON.stringify(s.city);s.apply({type:'rerollBlock',blockId:b.blockId});
 assert.deepEqual(s.city.buildings.find(x=>x.id===b.id),b);s.undo();assert.equal(JSON.stringify(s.city),before);s.redo();assert.equal(s.project.generatorVersion,C.LEGACY_VERSION);
}
console.log('PASS captured massing defects, useful irregular controls and byte-exact legacy projects');
const inputs=[{},{seed:'INTEGRATION-A'},{seed:'FIT-NARROW',streetSpacing:94,coastVariation:.85},{seed:'REVIEW-ACCESS-5',streetSpacing:94,coastVariation:1},{seed:'MASSING-SMALL',mapAreaKm2:1.5},{seed:'MASSING-LARGE',mapAreaKm2:3.2}];
for(const input of inputs){
 const c=C.generate(input);assert.deepEqual(C.validate(c),[]);
 assert.ok(Math.abs(c.layout.envelopeKm2-(input.mapAreaKm2||2))<.00001);assert.equal(c.stats.deadEnds,0);
 for(const island of c.islands)assert.ok(c.buildings.some(b=>b.islandId===island.id&&b.towerIntent));
 for(const surface of c.publicRealm.surfaces){
  // Independent clipped surfaces use a 1 mm integer grid. Join only within
  // 3 mm per side, not a pedestrian-sized dilation that could hide a bad gap.
  const block=c.blocks.find(b=>b.id===surface.blockId),near=C.boolean(c.sidewalkCoverage,C.offset([C.shape(block.polygon,block.holes)],.02),'intersection');
  const walk=C.boolean(C.offset([...near,...surface.paved],.003));
  // Default block:58c24830 previously passed polygon checks but Earcut bridged
  // a clipping needle with a triangle spilling 1.1635 m2 out of the pavement.
  for(const part of [...surface.paved,...surface.greens]){
   const points=[part.outer,...part.holes].flat(),triangles=T.ShapeUtils.triangulateShape(part.outer.map(p=>new T.Vector2(...p)),part.holes.map(r=>r.map(p=>new T.Vector2(...p))));
   for(const ids of triangles){const triangle=C.shape(C.canonical(ids.map(i=>points[i])));if(C.totalArea([triangle])<.000001)continue;
    const spill=area([triangle],[part],'difference');assert.ok(spill<.03,'Surface triangulation spill '+c.input.seed+' '+surface.blockId+' '+spill);}
  }
  // A surface island must connect to actual sidewalk pavement. Its area alone
  // must never cause a leftover to be called pedestrian access.
  for(const p of surface.paved){const component=walk.find(q=>area([p],[q],'intersection')>Math.min(.001,C.totalArea([p])*.5));assert.ok(component&&area([component],near,'intersection')>.001,'Disconnected paved remnant '+surface.id);}
  if(block.islandId==='island:harbour')continue;
  const entries=c.publicRealm.entrances.filter(e=>c.buildings.find(b=>b.id===e.buildingId).blockId===surface.blockId).flatMap(e=>e.polygons),court=c.blockInteriors.find(x=>x.blockId===surface.blockId);
  const courtRoutes=c.publicRealm.courtRoutes.filter(e=>e.courtId===surface.blockId+':interior').flatMap(e=>e.polygons);
  const front=c.parcels.filter(p=>p.blockId===surface.blockId).flatMap(p=>C.boolean([C.corridor(...p.frontage,p.frontSetback*2+.1)],[C.shape(p.polygon,p.holes)],'intersection'));
  const intended=C.offset(C.boolean([...entries,...courtRoutes,...(court?.paths||[]),...front]),.005);
  const excess=area(surface.paved,intended,'difference');assert.ok(excess<.04,'No accidental rear-wall paving ribbon '+surface.id+' '+excess);
 }
 if(!input.seed){
  assert.equal(edges(c.buildings.flatMap(b=>b.volumes.flatMap(v=>v.polygons))).filter(e=>e<.1).length,0,'No sub-10cm facade returns remain in the reproduced map');
  const old=C.generate(input,{},{},C.LEGACY_VERSION);
  for(const key of ['islands','streets','bridges','blocks','parcels'])assert.deepEqual(c[key],old[key],'Geometry cleanup preserves '+key);
  assert.deepEqual(c.buildings.map(b=>b.id),old.buildings.map(b=>b.id));
  assert.deepEqual(c.buildings.map(b=>b.towerIntent),old.buildings.map(b=>b.towerIntent));
 }
 console.log('PASS resolved massing, intended access and retained skyline',c.input.seed,c.stats.buildings);
}
