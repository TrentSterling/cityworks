// Original Cityworks adapter. Coordinates remain metres, X east / Z south.
export function recordsFromCity(city) {
  const point=([x,z])=>({x,z});
  return city.buildings.flatMap(b=>b.volumes.map(v=>{
    const points=v.polygons.flatMap(p=>p.outer),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
    const parcel=city.parcels.find(p=>p.id===b.parcelId);
    return {id:v.id,buildingId:b.id,parcelId:b.parcelId,district:b.district,profile:b.profile,role:v.role,seed:v.seed,facadeIndex:v.facadeIndex,
      baseY:v.baseElevation,height:v.topElevation-v.baseElevation,year:null,streetLevel:v.streetLevel,
      frontage:b.frontage.map(point),frontSetback:parcel.frontSetback,
      entrance:v.streetLevel?city.publicRealm?.entrances.find(e=>e.buildingId===b.id):null,
      parcel:{outer:parcel.polygon.map(point),holes:parcel.holes.map(r=>r.map(point))},
      cx:b.center[0],cz:b.center[1],minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),
      polygons:v.polygons.map(p=>({outer:p.outer.map(point),holes:p.holes.map(r=>r.map(point))}))};
  }));
}
