// Original Cityworks wall eligibility contract. Dimensions are metres.
export const FACADE_METRICS=Object.freeze([
  {bay:2.6,floor:3.7,corner:1.2},{bay:2.4,floor:3.5,corner:1.2},
  {bay:2.7,floor:3.9,corner:.45},{bay:2.5,floor:3.8,corner:.45},{bay:2.9,floor:4.1,corner:.45}
]);
export function facadeLayout(width,height,style=0){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid facade dimensions');
  const m=FACADE_METRICS[style];if(!m)throw Error('Unknown facade style');
  const bays=Math.max(0,Math.floor((width-2*m.corner+1e-7)/m.bay)),storeys=Math.max(0,Math.floor((height-.32+1e-7)/m.floor));
  return {width,height,bayWidth:m.bay,floorHeight:m.floor,bays,storeys,pier:(width-bays*m.bay)/2,windowEligible:bays>0&&storeys>0};
}
