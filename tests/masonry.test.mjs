import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {recordsFromCity} from '../experiments/three-island-integration/adapter.js';
import {facadeLayout,facadeDomains} from '../experiments/three-island-integration/facade-layout.js';
import {MASONRY,AC_UNIT,acPlan,acBays} from '../experiments/three-island-integration/masonry-rules.js';
const require=createRequire(import.meta.url),C=require('../src/building-plan.js');
assert.equal(MASONRY.brick.height,.075);assert.equal(MASONRY.brick.length,.225);
assert.equal(MASONRY.stone.height,.24);assert.equal(MASONRY.stone.length,.56);
for(const m of Object.values(MASONRY))assert.ok(m.joint>0&&m.joint<m.height/5&&m.relief<m.joint);
const fit=facadeLayout(28.4,20.4,0),domain={normal:{x:0,z:1}};
const base={id:'test:base',buildingId:'test',district:'garden-neighbourhood',profile:'garden-row',streetLevel:true,facadeIndex:0};
for(const r of [{...base,streetLevel:false},{...base,facadeIndex:2}])assert.deepEqual(acBays(acPlan(r,domain,fit,0),fit),[]);
assert.deepEqual(acBays(acPlan(base,domain,fit,3),fit),[]);
assert.deepEqual(acBays(acPlan(base,domain,facadeLayout(2,20,0),0),fit),[]);
let units=0,domains=0;const programs={};
for(const input of [{},{seed:'DETAIL-A'},{seed:'FIT-NARROW',streetSpacing:94,coastVariation:.85},{seed:'DETAIL-WIDE',streetSpacing:128}]){
 const city=C.generate(input),before=JSON.stringify(city),records=recordsFromCity(city);
 for(const r of records){
  for(const polygon of r.polygons){
   const ring=polygon.outer.map(p=>({x:p.x,y:p.z}));
   for(const d of facadeDomains(ring).filter(d=>d.offset===0)){
    const f=facadeLayout(d.width,r.height,r.facadeIndex);
    for(const kind of [0,2,3]){
     const plan=acPlan(r,d,f,kind),chosen=acBays(plan,f);
     assert.deepEqual(plan,acPlan(structuredClone(r),structuredClone(d),{...f},kind));
     assert.deepEqual(plan,acPlan({...r,seed:r.seed+1,cx:r.cx+100,cz:r.cz+100},d,f,kind),'Unrelated position/volume seed must not reshuffle building cooling intent');
     for(const {bay,floor} of chosen){
      assert.ok(r.streetLevel&&r.facadeIndex<2&&kind!==3&&f.windowEligible);
      assert.ok(bay>=0&&bay<f.bays&&floor>=1&&floor<f.storeys);
      assert.ok(AC_UNIT.width<f.bayWidth*.5&&AC_UNIT.height<f.floorHeight*.58);
      if(r.district==='working-harbour')assert.ok(kind===0&&floor===1,'Industrial AC only at upper front office windows');
     }
     programs[plan.program]=(programs[plan.program]||0)+chosen.length;units+=chosen.length;domains++;
    }
   }
  }
 }
 assert.equal(JSON.stringify(city),before,'Detail policy must not mutate authoritative map data');
}
assert.ok(programs.residential>0&&programs.mixed>0&&programs['front-office']>0);
// Collinear splits share the same policy and the same physical brick distance.
for(const ring of [[{x:0,y:0},{x:28.4,y:0},{x:28.4,y:12},{x:0,y:12}],
 [{x:0,y:0},{x:7,y:0},{x:21,y:0},{x:28.4,y:0},{x:28.4,y:12},{x:0,y:12}]]){
 const ds=facadeDomains(ring),front=ds.filter(d=>d.normal.z>.99);
 assert.ok(front.length);const p=acPlan(base,front[0],fit,0);
 for(const d of front)assert.deepEqual(acPlan(base,d,fit,0),p);
 for(let i=1;i<front.length;i++)assert.ok(Math.abs(front[i].brickOffset-front[i-1].brickOffset-(front[i].offset-front[i-1].offset))<1e-6);
}
console.log('PASS metre masonry modules, full upper-window fit, deterministic programme stacks, unchanged map data: '+JSON.stringify({domains,units,programs}));
