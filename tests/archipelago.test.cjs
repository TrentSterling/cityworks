const assert = require('node:assert/strict');
const C = require('../src/archipelago.js');
const length = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
let groups = 0;
const test = (name, fn) => { fn(); groups++; console.log('PASS ' + name); };

function connected(city, omitBridge = null) {
  const adjacent = new Map(city.nodes.map(n=>[n.id,[]]));
  for(const s of city.streets)if(s.bridgeId!==omitBridge){adjacent.get(s.from).push(s.to);adjacent.get(s.to).push(s.from);}
  const seen=new Set(),stack=[city.nodes[0].id];
  while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);stack.push(...adjacent.get(n));}
  return seen.size===city.nodes.length;
}

function independentInvariants(city) {
  assert.deepEqual(C.validate(city),[]);
  assert.equal(city.islands.length,3);
  assert.equal(city.bridges.length,3);
  assert.ok(connected(city),'Road graph must connect every island');
  for(const island of city.islands){
    C.validateRing(island.boundary.map(p=>p.map(v=>v/2)),island.id);
    assert.ok(C.totalArea(island.regions)>150000);
    assert.ok(city.streets.some(s=>s.islandId===island.id));
  }
  for(let i=0;i<city.streets.length;i++)for(let j=i+1;j<city.streets.length;j++){
    const a=city.streets[i],b=city.streets[j],hit=C.intersection(a.a,a.b,b.a,b.b);
    if(hit)assert.ok([a.from,a.to].some(id=>id===b.from||id===b.to),'At-grade crossing must share graph node: '+a.id+' '+b.id);
  }
  assert.ok(C.totalArea(C.boolean(city.landRoadCoverage,city.landRegions,'difference'))<.04,'Ordinary asphalt must not cross water');
  const waterRoad=C.boolean(city.roadCoverage,city.landRegions,'difference');
  assert.ok(C.totalArea(waterRoad)>1000,'The bridges must cross actual water');
  assert.ok(C.totalArea(C.boolean(waterRoad,city.bridgeCoverage,'difference'))<.04,'Water road must be explicitly declared bridge');
  assert.ok(Math.abs(C.totalArea(C.boolean(city.roadCoverage))-C.totalArea(city.roadCoverage))<.04,'Road coverage must not overlap itself');
  assert.ok(C.totalArea(C.boolean(city.sidewalkCoverage,city.roadCoverage,'intersection'))<.04,'Sidewalk interiors must exclude asphalt');
  for(const b of city.bridges){
    const from=city.islands.find(i=>i.id===b.fromIsland),to=city.islands.find(i=>i.id===b.toIsland);
    assert.ok(C.inRegions(from.regions,b.a)&&C.inRegions(to.regions,b.b));
    assert.ok(b.clearance>6&&b.deckElevation===8);
    for(const p of [b.a,b.b]){
      const n=city.nodes.find(n=>length(n.position,p)<.002);assert.ok(n);
      assert.ok(city.streets.some(s=>s.bridgeId===b.id&&(s.from===n.id||s.to===n.id)));
      assert.ok(city.streets.some(s=>!s.bridge&&(s.from===n.id||s.to===n.id)));
    }
  }
  const blockShapes=city.blocks.map(b=>C.shape(b.polygon,b.holes));
  assert.ok(Math.abs(C.totalArea(C.boolean(blockShapes))-C.totalArea(blockShapes))<.1,'Blocks must not overlap');
  assert.ok(C.totalArea(C.boolean(blockShapes,city.rightOfWay,'intersection'))<.1,'Blocks must be derived outside road reserve');
  assert.ok(C.totalArea(C.boolean(blockShapes,city.landRegions,'difference'))<.1,'Blocks must remain on land');
  const nodeById=new Map(city.nodes.map(n=>[n.id,n]));
  for(const s of city.streets){
    assert.deepEqual(s.a,nodeById.get(s.from).position);
    assert.deepEqual(s.b,nodeById.get(s.to).position);
    assert.ok(s.sidewalkWidth>=2.4);
    assert.equal(s.elevation,8);
    if(!s.bridge)assert.equal(s.width,{arterial:22,collector:13,local:7}[s.class]);
    for(const t of [0,.5,1]){const p=s.a.map((v,i)=>v+(s.b[i]-v)*t);if(C.inRegions(city.landRegions,p))assert.ok(Math.abs(C.heightAt(city,...p)-8)<.002,'Road grade must remain flat');}
  }
}

const city=C.generate();
test('three distinct islands, explicit connected bridges, shared junctions and actual coverage',()=>independentInvariants(city));
test('the two east crossings form a usable alternate route loop',()=>{
  assert.ok(connected(city,'bridge:north-channel'));
  assert.ok(connected(city,'bridge:garden'));
  assert.ok(!connected(city,'bridge:harbour'));
});
test('determinism and density intent leave all land, road and block identities unaffected',()=>{
  assert.equal(JSON.stringify(city),JSON.stringify(C.generate()));
  const changed=C.generate({density:.9,skylineHeight:140});
  for(const key of ['islands','routes','bridges','nodes','streets','roadCoverage','rightOfWay','blocks'])assert.deepEqual(city[key],changed[key]);
  assert.notEqual(city.dependencies.intent,changed.dependencies.intent);
});
test('coastal terrain rises from water, roads stay at grade and eastern natural hills remain',()=>{
  assert.equal(C.heightAt(city,1500,1500),0);
  for(const island of city.islands)for(const p of island.boundary){
    const abutment=city.bridges.some(b=>C.projection(p,b.a,b.b).distance<b.width/2+b.sidewalkWidth+27);
    if(!abutment)assert.ok(C.heightAt(city,...p)<.05,'Natural coast must meet water away from raised bridge abutments');
  }
  assert.ok(C.heightAt(city,930,-260)>15,'Eastern headland retains relief');
  assert.equal(C.heightAt(city,-80,0),8);
});
test('invalid inputs reject instead of silently reinterpreting their geometry',()=>{
  for(const value of [null,[],false,0])assert.throws(()=>C.generate(value));
  for(const input of [{schemaVersion:2},{seed:''},{seed:0},{coastVariation:NaN},{streetSpacing:20},{bridgeWidth:100},{boundary:[]}])assert.throws(()=>C.generate(input));
});
let seeds=0;
test('12 seed and control regressions preserve topology and containment invariants',()=>{
  for(let i=0;i<12;i++){
    const c=C.generate({seed:'ARCHIPELAGO-'+i,coastVariation:i%3/2,streetSpacing:90+(i%5)*10,bridgeWidth:18+(i%6)*2});
    independentInvariants(c);seeds++;
  }
});
console.log(groups+' groups passed; '+seeds+' varied seeds; default '+city.stats.blocks+' blocks, '+city.stats.junctions+' junctions, '+city.stats.deadEnds+' dead ends');
