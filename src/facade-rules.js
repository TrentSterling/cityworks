/* Shared original metric facade and coplanar-domain contract. */
(function(root){
// Original Cityworks wall eligibility contract. Dimensions are metres.
const metrics=Object.freeze([
  {bay:2.6,floor:3.4,corner:1.2},{bay:2.4,floor:3.4,corner:1.2},
  {bay:2.7,floor:3.4,corner:.45},{bay:2.5,floor:3.4,corner:.45},{bay:2.9,floor:3.4,corner:.45}
]);
// Shared ground-floor zones, relative to the authored volume base, in metres.
const storefront=Object.freeze({displayTop:2.86,fasciaBottom:2.9,signBottom:3.02,signHeight:.30,
  canopyRearTop:2.98,canopyFall:.05,canopyValance:.14,canopyThickness:.055,
  wallGap:.04,maxProjection:1.35,signDepth:.12,signOffset:.10,doorClearance:.03,
  portalFrame:.04,coping:.18});
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

// A primary shop uses the actual accessible entry and whole bays on its shared
// facade domain. This is preview detail, not a change to saved city geometry.
function storefrontPlan(record){
 const e=record.entrance,m=metrics[record.facadeIndex];
 if(!record.streetLevel||!e||e.kind==='passage'||!m||record.height<m.floor||
    storefront.canopyRearTop-storefront.canopyValance<e.doorHeight+storefront.doorClearance)return null;
 for(const polygon of record.polygons){
  let ring=polygon.outer.map(p=>({x:p.x,y:p.z}));
  const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a.x*b.y-b.x*a.y;},0);
  if(area>0)ring=ring.reverse();
  for(const domain of domains(ring).filter(d=>d.offset===0)){
   const {a,b,width}=domain,dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);
   if(!(width>0&&len>0))continue;
   const u=[dx/len,dz/len],n=[-u[1],u[0]];
   const along=(e.to[0]-a.x)*u[0]+(e.to[1]-a.y)*u[1],off=(e.to[0]-a.x)*n[0]+(e.to[1]-a.y)*n[1];
   if(along<0||along>width||Math.abs(off)>.005||n[0]*e.n[0]+n[1]*e.n[1]<.999)continue;
   const fit=layout(width,record.height,record.facadeIndex);if(!fit.windowEligible)continue;
   const s=domain.reverse?width-along:along,bay=Math.round((s-fit.pier)/fit.bayWidth-.5);
   if(bay<0||bay>=fit.bays||Math.abs(s-fit.pier-(bay+.5)*fit.bayWidth)>.02)continue;
   const count=Math.min(3,fit.bays),first=Math.max(0,Math.min(fit.bays-count,bay-Math.floor(count/2)));
   const lo=fit.pier+first*fit.bayWidth,hi=lo+count*fit.bayWidth,center=domain.reverse?width-(lo+hi)/2:(lo+hi)/2;
   const w=Math.min(storefront.maxProjection,record.frontSetback-storefront.wallGap-.16);if(w<.6)return null;
   const wallX=a.x+u[0]*center,wallZ=a.y+u[1]*center,projection=storefront.wallGap+w/2;
   return {id:record.buildingId+':storefront',entranceId:e.id,volumeId:record.id,baseY:record.baseY,
    x:wallX+n[0]*projection,z:wallZ+n[1]*projection,y:record.baseY+storefront.canopyRearTop,
    w,d:hi-lo,ry:Math.atan2(-n[1],n[0]),nx:n[0],nz:n[1],wallX,wallZ,
    domain:{a:[a.x,a.y],b:[b.x,b.y],width,reverse:domain.reverse,pier:fit.pier,bayWidth:fit.bayWidth,bayFirst:first,bayCount:count,entryBay:bay},
    sign:{x:e.to[0]+n[0]*storefront.signOffset,z:e.to[1]+n[1]*storefront.signOffset,
     y:record.baseY+storefront.signBottom+storefront.signHeight/2,w:storefront.signDepth,h:storefront.signHeight,d:Math.min(2.4,fit.bayWidth*.88)}};
  }
 }
 return null;
}

const api={metrics,layout,domains,storefront,storefrontPlan};if(typeof module!=="undefined")module.exports=api;root.CityFacadeRules=api;
})(globalThis);
