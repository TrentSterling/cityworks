import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {recordsFromCity} from '../experiments/three-island-integration/adapter.js';
import {storefrontPlan,STOREFRONT_METRICS as M} from '../experiments/three-island-integration/facade-layout.js';
const require=createRequire(import.meta.url),C=require('../src/building-plan.js');
const crypto=require('node:crypto'),saved=require('./fixtures/storefront-054.json');
const fixture={id:'test:base',buildingId:'test',streetLevel:true,baseY:8.16,height:20.4,facadeIndex:0,frontSetback:3,
 polygons:[{outer:[{x:-14.2,z:0},{x:14.2,z:0},{x:14.2,z:-12},{x:-14.2,z:-12}],holes:[]}],
 entrance:{id:'test:entry',kind:'lobby',to:[1.3,0],n:[0,1],doorHeight:2.5}};
const p=storefrontPlan(fixture);assert.ok(p);assert.equal(p.domain.bayCount,3);assert.ok(Math.abs(p.d-7.8)<1e-8);
assert.equal(p.sign.x,1.3);assert.ok(Math.abs(p.sign.z-.1)<1e-8);
assert.equal(storefrontPlan({...fixture,entrance:{...fixture.entrance,kind:'passage'}}),null);
assert.equal(storefrontPlan({...fixture,entrance:null}),null);
assert.equal(storefrontPlan({...fixture,streetLevel:false}),null);
assert.equal(storefrontPlan({...fixture,frontSetback:.7}),null);
assert.equal(storefrontPlan({...fixture,entrance:{...fixture.entrance,doorHeight:2.9}}),null,'A tall loading door cannot be squeezed beneath the canopy');
const split=structuredClone(fixture);split.polygons[0].outer.splice(1,0,{x:-6,z:0},{x:3,z:0});
const cyclic=structuredClone(split);cyclic.polygons[0].outer.push(cyclic.polygons[0].outer.shift());
const duplicate=structuredClone(fixture);duplicate.polygons[0].outer.unshift({...duplicate.polygons[0].outer[0]});
for(const r of [split,cyclic,duplicate]){const q=storefrontPlan(r);assert.ok(q);for(const key of ['x','z','w','d','y'])assert.ok(Math.abs(q[key]-p[key])<1e-8,'Coplanar point splits must not move shop '+key);assert.deepEqual(q.sign,p.sign);}
const theta=.73,rot=([x,z])=>[x*Math.cos(theta)-z*Math.sin(theta),x*Math.sin(theta)+z*Math.cos(theta)];
const r=structuredClone(split);r.polygons[0].outer=r.polygons[0].outer.map(({x,z})=>{const a=rot([x,z]);return{x:a[0],z:a[1]};});r.entrance.to=rot(r.entrance.to);r.entrance.n=rot(r.entrance.n);
const q=storefrontPlan(r),expected=rot([p.x,p.z]);assert.ok(q);assert.ok(Math.hypot(q.x-expected[0],q.z-expected[1])<1e-7);assert.ok(Math.abs(q.d-p.d)<1e-8);
let checked=0;
for(const input of [{},{seed:'STORE-1'},{seed:'FIT-NARROW',streetSpacing:94,coastVariation:.85},{seed:'STORE-WIDE',streetSpacing:128},{seed:'STORE-SMALL',mapAreaKm2:1.5}]){
 const city=C.generate(input),records=recordsFromCity(city),plans=records.map(storefrontPlan).filter(Boolean);
 if(!input.seed)assert.equal(crypto.createHash('sha256').update(JSON.stringify(city)).digest('hex'),saved.defaultCitySha256,'Preview detail changes must preserve the released authoritative city');
 for(const p of plans){
  const b=records.find(r=>r.id===p.volumeId),e=b.entrance,d=p.domain;
  assert.equal(p.entranceId,e.id);assert.ok(d.bayFirst>=0&&d.entryBay>=d.bayFirst&&d.entryBay<d.bayFirst+d.bayCount);
  assert.ok(Math.abs(p.d-d.bayCount*d.bayWidth)<1e-6);
  assert.ok(p.y-p.baseY-M.canopyValance>=e.doorHeight+M.doorClearance-1e-7);
  assert.ok(p.sign.y+p.sign.h/2<p.baseY+3.4-.05);
  assert.ok(p.sign.y-p.sign.h/2>p.y+.03);
  assert.ok(p.sign.y-p.sign.h/2>p.baseY+M.displayTop);
  const delta=[p.sign.x-e.to[0],p.sign.z-e.to[1]];
  assert.ok(Math.abs(delta[0]*e.n[1]-delta[1]*e.n[0])<1e-6,'Sign centered above real entry');
  assert.ok(M.displayTop<p.y-p.baseY-M.canopyThickness-.03,'Portal frame clears rear canopy underside');
  checked++;
 }
 for(const b of records.filter(r=>r.entrance?.kind==='passage'))assert.equal(storefrontPlan(b),null);
}
console.log('PASS storefront floor zones, door clearances, whole bays, split/cyclic/rotated domains and '+checked+' generated entry plans');
