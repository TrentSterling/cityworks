const assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../src/building-plan.js'),R=require('../src/public-realm.js'),P=require('../src/editor-state.js'),Connections=require('../src/court-connections.js');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const oldCases=[
 [{},'9eedd2a5204889d29c0ca8b79d5ab5e2f0d9192860909297348b5264d00ab48f'],
 [{seed:'COURT-OLD-1'},'9445d9a79409739ed47b858d6cf6d1d6d7f10126e054b50a744fb6611f8b2ad0'],
 [{seed:'COURT-OLD-2',streetSpacing:94},'1a7cc2b73e36e7939c8ca8e53ae376bce4b3c33143243044c5f629f536af3f8e']
];
for(const [input,expected] of oldCases){
 const old=C.generate(input,{}, {},C.PREVIOUS_VERSION),city=C.generate(input);
 assert.equal(hash(old),expected,'0.5.4 saved geometry must replay byte-exact');
 for(const key of ['streets','blocks','parcels','buildings','blockInteriors','roadCoverage','sidewalkCoverage'])assert.deepEqual(city[key],old[key],key+' must not change');
 for(const key of ['entrances','ramps','crossings'])assert.deepEqual(city.publicRealm[key],old.publicRealm[key],key+' must not change');
 assert.deepEqual(city.publicRealm.courtRoutes.filter(r=>r.kind!=='pedestrian-through'),old.publicRealm.courtRoutes);
 const routes=city.publicRealm.courtRoutes.filter(r=>r.kind==='pedestrian-through');
 assert.deepEqual(Connections.generate(city,C),routes,'Connections regenerate deterministically');
 assert.equal(new Set(routes.map(r=>r.courtId)).size,routes.length,'At most one extra route per court');
 assert.deepEqual(R.validate(city),[]);
 for(const route of routes){
  const court=city.blockInteriors.find(c=>c.id===route.courtId);
  assert.notEqual(court.program,'service-yard');assert.notEqual(route.streetId,court.accesses[0].streetId);
  assert.ok(route.boundaryReference-route.viaCourtDistance>=14.998&&route.viaCourtDistance<=route.boundaryReference*.8+.002);
  assert.equal(route.width,2.4);assert.deepEqual(route.to,court.accesses[0].to);
  // Reject a newly introduced low obstruction, rather than clipping the path thin.
  const blocked=structuredClone(city),building=blocked.buildings.find(b=>b.blockId===court.blockId);
  building.volumes.push({baseElevation:route.elevation,polygons:route.polygons});
  assert.ok(!Connections.generate(blocked,C).some(r=>r.id===route.id));
  assert.ok(R.validate(blocked).some(e=>e.includes('lacks clearance')));
 }
 if(!input.seed){
  assert.equal(routes.length,4,'Default city has four qualified new links');
  const broken=structuredClone(city);broken.publicRealm.courtRoutes.find(r=>r.kind==='pedestrian-through').polygons=[];
  assert.ok(R.validate(broken).some(e=>e.includes('Incomplete through-route')));
  const session=new P.Session(),before=JSON.stringify(session.city),courtId=routes[0].courtId,blockId=city.blockInteriors.find(c=>c.id===courtId).blockId;
  session.apply({type:'rerollBlock',blockId});
  assert.deepEqual(session.city.publicRealm.courtRoutes.filter(r=>r.courtId!==courtId),city.publicRealm.courtRoutes.filter(r=>r.courtId!==courtId));
  session.undo();assert.equal(JSON.stringify(session.city),before,'Undo restores every route and surface exactly');
 }
 console.log('PASS court connections',city.input.seed,routes.length,'routes; exact previous-version replay');
}
