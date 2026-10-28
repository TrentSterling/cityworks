import assert from 'node:assert/strict';
import {facadeLayout,FACADE_METRICS,facadeDomains} from '../experiments/three-island-integration/facade-layout.js';
for(let style=0;style<FACADE_METRICS.length;style++){
 const m=FACADE_METRICS[style];
 for(const width of [.02,.3,1,2,2.4,3.5,5,8,14.37,40])for(const height of [.5,2,3.4,6.8,17,60]){
  const p=facadeLayout(width,height,style);assert.equal(p.bayWidth,m.bay);assert.equal(p.floorHeight,m.floor);assert.ok(Number.isInteger(p.bays)&&Number.isInteger(p.storeys));
  assert.ok(Math.abs(p.pier*2+p.bays*p.bayWidth-width)<1e-8);if(p.bays)assert.ok(p.pier>=m.corner-1e-7);
  if(p.windowEligible)assert.ok(p.bays*m.bay+2*m.corner<=width+1e-7&&(p.storeys-1+.9)*m.floor+.32<=height+1e-7);
 }
 assert.equal(facadeLayout(m.bay+2*m.corner-.001,20,style).bays,0);
 assert.equal(facadeLayout(m.bay+2*m.corner,20,style).bays,1);
 assert.equal(facadeLayout(20,m.floor*.9+.319,style).storeys,0);
 assert.equal(facadeLayout(20,6*3.4,style).storeys,6,'Six generated storeys retain six complete opening rows');
}
const p=xy=>xy.map(([x,y])=>({x,y}));
const joined=facadeDomains(p([[-16,0],[-12,0],[-4,0],[16,0],[16,-12],[-16,-12]]));
for(const i of [0,1,2]){assert.equal(joined[i].id,joined[0].id);assert.equal(joined[i].width,32);}assert.equal(joined[1].offset,4);assert.notEqual(joined[3].id,joined[0].id);
const wrap=facadeDomains(p([[0,0],[10,0],[10,-10],[-10,-10],[-10,0]]));assert.equal(wrap[0].id,wrap[4].id);assert.equal(wrap[0].width,20);
const bent=facadeDomains(p([[-16,0],[-12,0],[-4,.05],[16,.05],[16,-12],[-16,-12]]));assert.notEqual(bent[0].id,bent[1].id,'A physical bend stays a separate wall');
console.log('PASS 300 metric opening fits, generated floor alignment, contiguous domains, cyclic joins and physical corners');
