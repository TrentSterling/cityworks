const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../src/city.js');
let checks = 0, acceptedSeeds = 0, diagnosedSeeds = 0;
const test = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
const shape = e => C.shape(e.polygon || e.footprint, e.holes || []);
const length = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const key = p => JSON.stringify({polygon:p.polygon,holes:p.holes});

function independentInvariants(city) {
  assert.deepEqual(C.validate(city), []);
  for (let i=0;i<city.streets.length;i++) for(let j=i+1;j<city.streets.length;j++) {
    const a=city.streets[i], b=city.streets[j], hit=C.intersection(a.a,a.b,b.a,b.b);
    if(hit) assert.ok([a.from,a.to].some(id=>id===b.from||id===b.to),'At-grade crossing lacks shared junction');
  }
  const roadUnion=C.boolean(city.roadCoverage);
  assert.ok(Math.abs(C.totalArea(roadUnion)-C.totalArea(city.roadCoverage))<.02,'Road coverage overlaps');
  const corridors=city.streets.map(s=>C.corridor(s.a,s.b,s.width));
  assert.ok(Math.abs(C.totalArea(C.boolean(corridors))-C.totalArea(roadUnion))<.02);
  assert.ok(C.totalArea(C.boolean(roadUnion,city.island.regions,'difference'))<.02);
  const streetMap=new Map(city.streets.map(s=>[s.id,s]));
  for(const block of city.blocks) {
    const lots=city.parcels.filter(p=>p.blockId===block.id);
    for(let i=0;i<lots.length;i++)for(let j=i+1;j<lots.length;j++)assert.ok(C.totalArea(C.boolean([shape(lots[i])],[shape(lots[j])],'intersection'))<.025,'Parcel interiors overlap');
    for(const p of lots){
      const road=streetMap.get(p.streetId);assert.ok(road);
      assert.ok(C.projection(p.access[1],road.a,road.b).distance<.002);
      const onLand=C.clipSegment(p.access[0],p.access[1],city.island.regions).reduce((sum,[a,b])=>sum+length(a,b),0);
      assert.ok(Math.abs(onLand-length(...p.access))<.005,'Frontage access crosses water');
      assert.ok(C.containsRegion(shape(block),shape(p),.025));
    }
  }
  const parcels=new Map(city.parcels.map(p=>[p.id,p]));
  for(const b of city.buildings){
    assert.equal(b.floorHeight,3.4);assert.equal(b.facadeBayWidth,3.15);
    const p=parcels.get(b.parcelId),rings=[p.polygon,...p.holes];
    for(const part of b.parts){
      assert.ok(C.containsRegion(shape(p),shape(part),.025));
      for(const v of part.footprint){
        const distance=Math.min(...rings.flatMap(r=>r.map((a,i)=>C.projection(v,a,r[(i+1)%r.length]).distance)));
        assert.ok(distance>=p.setback-.005,'Metric setback violated');
      }
    }
  }
}

test('same input serializes identically; density/height preserve topology and identities',()=>{
  const a=C.generate(), b=C.generate({...a.input,density:.3,skylineHeight:160});
  assert.equal(JSON.stringify(a),JSON.stringify(C.generate()));
  for(const k of ['island','nodes','streets','roadCoverage','blocks','parcels'])assert.deepEqual(a[k],b[k]);
  assert.deepEqual(a.buildings.map(b=>b.id),b.buildings.map(b=>b.id));
});
test('surviving parcel geometry keeps IDs after coastline and arterial edits',()=>{
  const a=C.generate(), boundary=a.island.boundary.map(p=>p.slice());boundary[0][0]-=5;
  for(const change of [{boundary},{diagonalAngle:35}]){
    const b=C.generate({...a.input,...change}), old=new Map(a.parcels.map(p=>[key(p),p.id]));let matches=0;
    for(const p of b.parcels)if(old.has(key(p))){assert.equal(p.id,old.get(key(p)));matches++;}
    assert.ok(matches>200);assert.equal(b.island.holes.length,1);
  }
});
test('concavity and holes survive clipping; vertex-only containment is insufficient',()=>{
  const u=[[-300,-300],[300,-300],[300,300],[100,300],[100,-100],[-100,-100],[-100,300],[-300,300]];
  const land=C.validateLand(u,[]), segments=C.clipSegment([-500,200],[500,200],[land]);assert.equal(segments.length,2);
  const bridge=C.shape([[-250,200],[250,200],[250,250],[-250,250]]);
  assert.ok(bridge.outer.every(p=>C.inRing(u,p)));assert.equal(C.containsRegion(land,bridge),false);
  const city=C.generate({holes:[C.rect(-45,-45,45,45)],lagoon:false});
  assert.ok(C.totalArea(C.boolean(city.roadCoverage,[C.shape(C.rect(-45,-45,45,45))],'intersection'))<.001);
  independentInvariants(city);
});
test('setback returns all split components and explicit collapse',()=>{
  const neck=[[-60,-30],[-10,-30],[-10,-2],[10,-2],[10,-30],[60,-30],[60,30],[10,30],[10,2],[-10,2],[-10,30],[-60,30]];
  assert.equal(C.offset([C.shape(neck)],-3).length,2);
  assert.equal(C.offset([C.shape(C.rect(0,0,2,10))],-2).length,0);
  assert.equal(C.inset,undefined,'No lossy first-component helper');
});
test('invalid boundaries, holes and substantial disconnected networks give diagnostics',()=>{
  for(const input of [null,[],{boundary:false},{boundary:0},{holes:false},{holes:0},{density:NaN},{schemaVersion:1},{boundary:[[0,0],[300,300],[0,300],[300,0]]},{holes:[C.rect(800,800,850,850)]},{holes:[C.rect(-50,-50,50,50),C.rect(0,0,70,70)]}])assert.throws(()=>C.generate(input));
  const boundary=[[-400,-300],[-50,-300],[-50,-15],[50,-15],[50,-300],[400,-300],[400,300],[50,300],[50,15],[-50,15],[-50,300],[-400,300]];
  assert.throws(()=>C.generate({boundary,holes:[],lagoon:false}),/substantial road component/);
  assert.throws(()=>C.generate({boundary:[[-300,-300],[300,-300],[0,-300],[300,300],[-300,300]],holes:[]}),/overlap|self-/);
});
test('36 seed/control regressions: intersections, coverage, frontage, overlap and setback',()=>{
  for(let i=0;i<36;i++){
    let city;
    try{city=C.generate({seed:'V02-SWEEP-'+i,width:600+(i%5)*200,depth:500+(i%4)*180,density:.1+(i%10)/10,arterialX:-30+(i%7)*10,arterialZ:-25+(i%6)*10,diagonalAngle:15+(i%12)*5,diagonalOffset:-120+(i%9)*30,lagoon:i%3!==0});}
    catch(e){assert.match(e.message,/substantial road component/);diagnosedSeeds++;continue;}
    independentInvariants(city);acceptedSeeds++;
  }
  assert.ok(acceptedSeeds>=28,'Too many inputs rejected');
});
test('default includes diagonal edges and genuinely irregular footprints',()=>{
  const c=C.generate();assert.ok(c.streets.filter(s=>s.sourceId==='diagonal').length>5);
  assert.ok(c.buildings.some(b=>b.footprint.some((p,i)=>{const q=b.footprint[(i+1)%b.footprint.length];return Math.abs(p[0]-q[0])>1&&Math.abs(p[1]-q[1])>1;})));
  independentInvariants(c);
});
fs.mkdirSync('artifacts/v0.2',{recursive:true});
fs.writeFileSync('artifacts/v0.2/model-test-report.json',JSON.stringify({checks,seedSweep:36,acceptedSeeds,diagnosedSeeds,status:'passed'},null,2));
fs.writeFileSync('artifacts/v0.2/cityworks-default.json',JSON.stringify(C.generate(),null,2));
console.log(`${checks} groups passed; ${acceptedSeeds} generated seeds, ${diagnosedSeeds} explicitly diagnosed disconnected layouts`);
