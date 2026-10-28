import assert from 'node:assert/strict';
import {facadeLayout,FACADE_METRICS} from '../experiments/three-island-integration/facade-layout.js';
for(let style=0;style<FACADE_METRICS.length;style++){
 const m=FACADE_METRICS[style];
 for(const width of [.02,.3,1,2,2.4,3.5,5,8,14.37,40])for(const height of [.5,2,3.4,6.8,17,60]){
  const p=facadeLayout(width,height,style);assert.equal(p.bayWidth,m.bay);assert.equal(p.floorHeight,m.floor);assert.ok(Number.isInteger(p.bays)&&Number.isInteger(p.storeys));
  assert.ok(Math.abs(p.pier*2+p.bays*p.bayWidth-width)<1e-8);if(p.bays)assert.ok(p.pier>=m.corner-1e-7);
  if(p.windowEligible)assert.ok(p.bays*m.bay+2*m.corner<=width+1e-7&&p.storeys*m.floor+.32<=height+1e-7);
 }
 assert.equal(facadeLayout(m.bay+2*m.corner-.001,20,style).bays,0);
 assert.equal(facadeLayout(m.bay+2*m.corner,20,style).bays,1);
 assert.equal(facadeLayout(20,m.floor+.319,style).storeys,0);
}
console.log('PASS 300 narrow, fractional, short and full-size facade panel cases with unscaled bays');
