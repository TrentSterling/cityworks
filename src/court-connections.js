/* Original Cityworks pedestrian connections. Metre-space, deterministic and renderer-free. */
(function(root){
 'use strict';
 const width=2.4,clearance=2.5,margin=.25;
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 function generate(city,C){
  const routes=[];
  for(const court of city.blockInteriors){
   if(court.program==='service-yard'||court.accesses.length!==1)continue;
   const original=court.accesses[0],block=city.blocks.find(b=>b.id===court.blockId),ring=block.polygon;
   const lengths=ring.map((p,i)=>distance(p,ring[(i+1)%ring.length])),perimeter=lengths.reduce((a,b)=>a+b,0);
   const station=p=>{let total=0,best;for(let i=0;i<ring.length;i++){const hit=C.projection(p,ring[i],ring[(i+1)%ring.length]);if(!best||hit.distance<best.distance)best={distance:hit.distance,at:total+hit.t*lengths[i]};total+=lengths[i];}return best.at;};
   const entryStation=station(original.from),obstacles=C.offset(city.buildings.filter(b=>b.blockId===block.id).flatMap(b=>b.volumes.filter(v=>v.baseElevation<8.16+clearance).flatMap(v=>v.polygons)),margin);
   const allowed=[C.shape(ring,block.holes||[]),...city.sidewalkCoverage],candidates=[],seen=new Set();
   for(const parcel of city.parcels.filter(p=>p.blockId===block.id)){
    const street=city.streets.find(s=>s.id===parcel.streetId);if(street.id===original.streetId||street.bridge)continue;
    for(const mouth of parcel.frontage){
     const key=mouth.join(',');if(seen.has(key))continue;seen.add(key);
     if(distance(mouth,original.from)<25)continue;
     const oldVector=original.from.map((v,i)=>v-original.to[i]),vector=mouth.map((v,i)=>v-original.to[i]);
     if((oldVector[0]*vector[0]+oldVector[1]*vector[1])/(distance(original.from,original.to)*distance(mouth,original.to))>.5)continue;
     const projection=C.projection(mouth,street.a,street.b),n=mouth.map((v,i)=>(v-projection.point[i])/projection.distance);
     if(!Number.isFinite(n[0])||Math.abs(projection.distance-street.width/2-street.sidewalkWidth)>.05)continue;
     const from=projection.point.map((v,i)=>C.snap(v+n[i]*(street.width/2+street.sidewalkWidth*.5))),to=original.to;
     const delta=Math.abs(station(mouth)-entryStation),around=Math.min(delta,perimeter-delta),through=distance(original.from,to)+distance(to,mouth);
     // This is a local boundary-distance reference, not a city-wide shortest path.
     if(around-through<15||through>around*.8)continue;
     const polygons=[C.corridor(from,to,width)];
     if(!C.inRegions(city.sidewalkCoverage,from)||!C.inRegions(court.polygons,to))continue;
     if(C.totalArea(C.boolean(polygons,allowed,'difference'))>.01||C.totalArea(C.boolean(polygons,city.roadCoverage,'intersection'))>.01||C.totalArea(C.boolean(polygons,city.landRegions,'difference'))>.01||C.totalArea(C.boolean(polygons,obstacles,'intersection'))>.001)continue;
     candidates.push({id:court.id+':connection:'+C.hash(street.id+'|'+key),courtId:court.id,streetId:street.id,kind:'pedestrian-through',from,to:[...to],width,elevation:8.16,polygons,boundaryReference:C.snap(around),viaCourtDistance:C.snap(through)});
    }
   }
   candidates.sort((a,b)=>(b.boundaryReference-b.viaCourtDistance)-(a.boundaryReference-a.viaCourtDistance)||a.id.localeCompare(b.id));
   if(candidates.length)routes.push(candidates[0]);
  }
  return routes;
 }
 const api={generate,width,clearance,margin};if(typeof module!=='undefined')module.exports=api;root.CityCourtConnections=api;
})(globalThis);
