const assert=require('node:assert/strict'),C=require('../src/building-plan.js');
const shape=ring=>C.shape(C.canonical(ring)),fit=p=>C.usableFootprints(p,[[0,0],[100,0]]),rect=(w,d,x=0,z=0)=>shape(C.rect(x,z,x+w,z+d));
function gap(a,b){const rings=p=>p.flatMap(s=>[s.outer,...s.holes]),distance=(left,right)=>Math.min(...left.flatMap(r=>r.flatMap(p=>right.flatMap(s=>s.map((q,i)=>C.projection(p,q,s[(i+1)%s.length]).distance)))));return Math.min(distance(rings(a),rings(b)),distance(rings(b),rings(a)));}
assert.equal(fit([rect(4,70)]).length,0,'An adequate area cannot rescue a 4m-wide strip');
assert.equal(fit([rect(10,100)]).length,0,'Inradius alone cannot rescue an excessive aspect ratio');
assert.equal(fit([shape([[0,0],[50,0],[50,5],[5,5],[5,50],[0,50]])]).length,0,'Wide bbox with only narrow L wings is not buildable');
const wing=fit([shape([[0,0],[20,0],[20,8],[50,8],[50,10],[20,10],[20,20],[0,20]])]);
assert.ok(wing.length);assert.ok(!C.inRegions(wing,[40,9]),'Thin concave appendage must be removed');
const acute=fit([shape([[0,0],[60,0],[0,14]])]);assert.ok(acute.length);assert.ok(!C.inRegions(acute,[53,1]),'Acute residual tip must not reappear after opening');
assert.equal(fit([rect(20,20),rect(2,90,40,0)]).length,1,'Each clipped remnant is tested separately');
const rotate=([x,z])=>[x*Math.cos(.67)-z*Math.sin(.67),x*Math.sin(.67)+z*Math.cos(.67)];
const turned=C.usableFootprints([shape(C.rect(0,0,30,16).map(rotate))],[[0,0],rotate([30,0])]);assert.equal(turned.length,1,'Fit is independent of world rotation');
for(const input of [{},{seed:'FIT-ACUTE'},{seed:'INTEGRATION-A'},{seed:'FIT-WIDE',streetSpacing:128},{seed:'FIT-NARROW',streetSpacing:94,coastVariation:.85},{seed:'FIT-LARGE',mapAreaKm2:2.673153068103}]){
 const c=C.generate(input);assert.deepEqual(C.validate(c),[]);assert.ok(Math.abs(c.layout.envelopeKm2-(input.mapAreaKm2||2))<.00001);
 assert.equal(c.stats.deadEnds,0);for(const island of c.islands)assert.ok(c.buildings.some(b=>b.islandId===island.id&&b.towerIntent),'Each island has a planned taller outlier');
 for(const block of c.blocks){const bs=c.buildings.filter(b=>b.blockId===block.id);for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++)assert.ok(gap(bs[i].volumes[0].polygons,bs[j].volumes[0].polygons)>=5.99,'Buildings require deliberate 6m Euclidean clearance: '+bs[i].id+' / '+bs[j].id);}
 for(const s of c.streets)if(!s.bridge)assert.equal(s.width,{arterial:22,collector:13,local:7}[s.class],'Map resize must not resize road widths');
 assert.ok(c.siteReservations.every(r=>!c.buildings.some(b=>b.parcelId===r.parcelId)));
}
console.log('PASS usable cores, acute/concave remnants, rotation, clearances, metric resizing and island skylines across six layouts');
