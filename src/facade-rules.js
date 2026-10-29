/* Shared original metric facade and coplanar-domain contract. */
(function(root){
// Original Cityworks wall eligibility contract. Dimensions are metres.
const metrics=Object.freeze([
  {bay:2.6,floor:3.4,corner:1.2},{bay:2.4,floor:3.4,corner:1.2},
  {bay:2.7,floor:3.4,corner:.45},{bay:2.5,floor:3.4,corner:.45},{bay:2.9,floor:3.4,corner:.45}
]);
function layout(width,height,style=0){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid facade dimensions');
  const m=metrics[style];if(!m)throw Error('Unknown facade style');
  // A complete opening ends at 90% of its metric storey, below the coping.
  const bays=Math.max(0,Math.floor((width-2*m.corner+1e-7)/m.bay)),storeys=Math.max(0,Math.floor((height-.32-.9*m.floor+1e-7)/m.floor)+1);
  return {width,height,bayWidth:m.bay,floorHeight:m.floor,bays,storeys,pier:(width-bays*m.bay)/2,windowEligible:bays>0&&storeys>0};
}

// Adjacent coplanar polygon edges share a window domain without altering the footprint.
function domains(points){
 const edges=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.y-a.y,width=Math.hypot(dx,dz);return {a,b,width,u:[dx/width,dz/width]};});
 const aligned=(a,b)=>a.width>0&&b.width>0&&a.u[0]*b.u[0]+a.u[1]*b.u[1]>.999999;
 let start=edges.findIndex((e,i)=>!aligned(edges[(i+edges.length-1)%edges.length],e));if(start<0)start=0;
 const runs=[];for(let k=0;k<edges.length;k++){const i=(start+k)%edges.length,e=edges[i],last=runs.at(-1),first=last?.edges[0].edge;
  const coplanar=first&&Math.abs((e.b.x-first.a.x)*first.u[1]-(e.b.y-first.a.y)*first.u[0])<.005;
  if(last&&coplanar&&aligned(last.edges.at(-1).edge,e))last.edges.push({i,edge:e});else runs.push({id:i,edges:[{i,edge:e}]});}
 const result=[];
 for(const run of runs){
  const width=run.edges.reduce((s,x)=>s+x.edge.width,0),a=run.edges[0].edge.a,b=run.edges.at(-1).edge.b,dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz);
  const normal=length?{x:-dz/length,z:dx/length}:{x:0,z:0},reverse=(Math.abs(dz)>=Math.abs(dx)?dz:dx)<0,tangent={x:normal.z*(reverse?-1:1),z:-normal.x*(reverse?-1:1)};
  let offset=0;for(const x of run.edges){result[x.i]={id:run.id,width,offset,a,b,normal,reverse,tangent};offset+=x.edge.width;}
 }
 // Place the unavoidable closed-ring brick seam at a physical corner, never inside a joined wall.
 const total=edges.reduce((s,e)=>s+e.width,0),pivot=result.findIndex(d=>d.offset===0),origin=edges.slice(0,pivot).reduce((s,e)=>s+e.width,0);let perimeter=0;
 for(let i=0;i<edges.length;i++){result[i].brickOffset=total?(perimeter-origin+total)%total:0;perimeter+=edges[i].width;}
 return result;
}

const api={metrics,layout,domains};if(typeof module!=="undefined")module.exports=api;root.CityFacadeRules=api;
})(globalThis);
