/* Original Cityworks pedestrian/frontage layer. Coordinates and dimensions are metres. */
(function(root){
  const C=typeof module!=='undefined'?require('./archipelago.js'):root.ArchipelagoModel;
  const F=typeof module!=='undefined'?require('./facade-rules.js'):root.CityFacadeRules;
  const R=typeof module!=='undefined'?require('./road-markings.js'):root.CityRoadMarkings;
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const at=(p,u,d)=>p.map((v,i)=>C.snap(v+u[i]*d));
  const region=p=>C.shape(p.polygon,p.holes||[]);
  function ramp(id,center,u,n,halfWidth,run,role){
    const point=(x,z)=>at(at(center,u,x),n,z),flared=halfWidth+.7;
    const part=(a,b)=>C.shape(C.canonical([point(a,0),point(b,0),point(b,run),point(a,run)]));
    const triangle=(a,b,c)=>C.shape(C.canonical([a,b,c]));
    // Triangulate each flare along its slope crease, where depth/run equals
    // lateral flare distance. An arbitrary quad diagonal creates an 8 cm hump.
    const lf=point(-flared,0),li=point(-halfWidth,0),lb=point(-halfWidth,run),lo=point(-flared,run);
    const ri=point(halfWidth,0),rf=point(flared,0),ro=point(flared,run),rb=point(halfWidth,run);
    return {id,role,center:center.map(C.snap),u,n,halfWidth,run,rise:.16,polygons:[part(-flared,flared)],panels:[triangle(lf,li,lo),triangle(li,lb,lo),part(-halfWidth,halfWidth),triangle(ri,rf,ro),triangle(ri,ro,rb)]};
  }
  function rampHeight(r,p){const dx=p[0]-r.center[0],dz=p[1]-r.center[1],along=Math.abs(dx*r.u[0]+dz*r.u[1]),depth=dx*r.n[0]+dz*r.n[1];return 8+.16*Math.max(0,Math.min(1,Math.max(depth/r.run,(along-r.halfWidth)/.7)));}
  function generate(city){
    const entrances=[],ramps=[],crossings=[],diagnostics=[],streets=new Map(city.streets.map(s=>[s.id,s])),parcels=new Map(city.parcels.map(p=>[p.id,p]));
    const walk=city.sidewalkCoverage||C.boolean(city.rightOfWay,city.roadCoverage,'difference');
    const fitsRamp=r=>C.totalArea(C.boolean(r.polygons,walk,'difference'))<.025&&C.totalArea(C.boolean(r.polygons,ramps.filter(x=>distance(x.center,r.center)<x.halfWidth+r.halfWidth+6).flatMap(x=>x.polygons),'intersection'))<.02;
    for(const leg of R.layout(C,city))for(const original of leg.crossings){
      let admitted=false;
      // Move away from a crowded/acute junction until both landings fit. Keep
      // each end on its own half of the clear road span and retain its stable ID.
      for(let shift=0;shift<=24;shift+=.5){
        const end=original.end+original.sign*shift,d=original.d+original.sign*shift;
        if(original.sign*(end-(leg.lo+leg.hi)/2)>-2)break;
        const cross={...original,end,d,center:at(leg.edge.a,leg.u,d),shift};
        const pair=[-1,1].map(side=>ramp(cross.id+':ramp:'+side,at(cross.center,cross.n,side*cross.width/2),cross.u,cross.n.map(v=>v*side),1.25,2.1,'crosswalk'));
        if(pair.every(fitsRamp)){ramps.push(...pair);crossings.push({...cross,ramps:pair.map(p=>p.id)});admitted=true;break;}
      }
      if(!admitted)diagnostics.push({id:original.id,reason:'Crossing omitted: no clear paired curb transitions'});
    }
    const blockBuildings=new Map(city.blocks.map(b=>[b.id,city.buildings.filter(x=>x.blockId===b.id)]));
    for(const b of city.buildings){
      const parcel=parcels.get(b.parcelId),street=streets.get(parcel.streetId),base=b.volumes[0];
      if(b.passage){
        const p=b.passage,foot=C.projection(p.from,street.a,street.b).point,d=distance(foot,p.from),n=p.from.map((v,i)=>(v-foot[i])/d),start=at(foot,n,street.width/2+street.sidewalkWidth*.5);
        entrances.push({id:b.id+':entry',buildingId:b.id,parcelId:parcel.id,streetId:street.id,kind:'passage',from:start,to:p.to,via:[p.from],width:p.width,elevation:8.16,polygons:C.boolean([C.corridor(start,p.from,p.width),C.corridor(p.from,p.to,p.width)])});continue;
      }
      const f=parcel.frontage,fl=distance(...f),fu=f[1].map((v,i)=>(v-f[0][i])/fl),candidates=[];
      for(const poly of base.polygons){
       const ring=(C.area(poly.outer)>0?[...poly.outer].reverse():poly.outer).map(([x,y])=>({x,y}));
       for(const domain of F.domains(ring).filter(d=>d.offset===0)){
        const a=[domain.a.x,domain.a.y],z=[domain.b.x,domain.b.y],w=domain.width,l=distance(a,z),u=z.map((v,j)=>(v-a[j])/l);
        if(Math.abs(u[0]*fu[0]+u[1]*fu[1])<.95)continue;
        const fit=F.layout(w,base.topElevation-base.baseElevation,base.facadeIndex),doorWidth=b.islandId==='island:harbour'?2:1.4;
        if(w<doorWidth+1.2)continue;
        const reverse=domain.reverse;
        for(let bay=0;bay<Math.max(1,fit.bays);bay++){
          const s=fit.bays?fit.pier+(bay+.5)*fit.bayWidth:w/2,to=at(a,u,reverse?w-s:s),foot=C.projection(to,street.a,street.b).point,d=distance(foot,to),n=to.map((v,j)=>(v-foot[j])/d),from=at(foot,n,street.width/2+street.sidewalkWidth*.5),width=b.islandId==='island:harbour'?2.4:1.8;
          if(d>street.width/2+street.sidewalkWidth+parcel.depth)continue;
          // The threshold ends along the actual wall, not a cap perpendicular
          // to the street. Otherwise an angled frontage makes the route nibble
          // into its own building and falsely fail the obstruction check.
          const startU=[-n[1],n[0]],signU=startU[0]*u[0]+startU[1]*u[1]>0?1:-1;
          const path=[C.shape(C.canonical([at(from,startU,-width/2),at(from,startU,width/2),at(to,u,signU*width/2),at(to,u,-signU*width/2)]))];
          const normal=[-u[1],u[0]],sign=normal[0]*n[0]+normal[1]*n[1]>0?-1:1;
          candidates.push({id:b.id+':entry',buildingId:b.id,parcelId:parcel.id,streetId:street.id,kind:b.islandId==='island:harbour'?'workplace':'lobby',from,to,width,doorWidth,doorHeight:b.islandId==='island:harbour'?2.8:2.5,u,n:normal.map(v=>v*sign),portalWidth:fit.bays?fit.bayWidth:Math.min(w-.4,doorWidth+1),portalHeight:Math.min(fit.floorHeight,base.topElevation-base.baseElevation-.32),elevation:8.16,polygons:path,score:Math.abs(bay-(fit.bays-1)/2)+d});
        }
       }
      }
      candidates.sort((a,b)=>a.score-b.score||a.to[0]-b.to[0]||a.to[1]-b.to[1]);
      const allowed=[region(parcel),...walk],obstacles=blockBuildings.get(b.blockId).flatMap(x=>x.volumes[0].polygons);
      const clear=e=>C.inRegions(walk,e.from)&&C.totalArea(C.boolean(e.polygons,allowed,'difference'))<=.025&&C.totalArea(C.boolean(e.polygons,obstacles,'intersection'))<=.025;
      let entry=candidates.find(clear);
      // A clipped corner lot can have an offset frontage neck. Keep the door
      // centred on its bay; search an oblique but fully contained approach from
      // the sidewalk instead of moving the building or shaving a path through it.
      if(!entry)for(const e of candidates){
        for(let offset=.5;offset<=6&&!entry;offset+=.5)for(const sign of [-1,1]){
          const from=at(e.from,fu,offset*sign),signU=fu[0]*e.u[0]+fu[1]*e.u[1]>0?1:-1;
          const polygons=[C.shape(C.canonical([at(from,fu,-e.width/2),at(from,fu,e.width/2),at(e.to,e.u,signU*e.width/2),at(e.to,e.u,-signU*e.width/2)]))];
          const candidate={...e,from,polygons};if(clear(candidate)){entry=candidate;break;}
        }
        if(entry)break;
      }
      if(entry){delete entry.score;entrances.push(entry);}else diagnostics.push({id:b.id,reason:'No unobstructed frontage entrance'});
    }
    const courtRoutes=[];
    for(const court of city.blockInteriors)for(const access of court.accesses){
      const street=streets.get(access.streetId),foot=C.projection(access.from,street.a,street.b).point,d=distance(foot,access.from),n=access.from.map((v,i)=>(v-foot[i])/d),service=court.program==='service-yard';
      const from=at(foot,n,street.width/2+(service?0:street.sidewalkWidth*.5));
      const route={id:access.id+':route',courtId:court.id,streetId:street.id,kind:service?'service':'pedestrian',from,to:access.to,via:[access.from],width:access.width,elevation:8.16,polygons:C.boolean([C.corridor(from,access.from,access.width),C.corridor(access.from,access.to,access.width)])};
      courtRoutes.push(route);
      if(service){const r=ramp(route.id+':apron',from,[-n[1],n[0]],n,access.width/2,2.1,'service');if(fitsRamp(r))ramps.push(r);else diagnostics.push({id:route.id,reason:'Service apron conflicts with existing crossing or sidewalk boundary'});}
    }
    const surfaces=[];
    for(const block of city.blocks.filter(b=>b.use==='mixed')){
      const legacy=city.generatorVersion==='0.5.1-usable-fabric';
      const buildings=blockBuildings.get(block.id),feet=buildings.flatMap(b=>b.volumes[0].polygons),free=C.boolean([region(block)],feet,'difference');
      const routes=[...entrances.filter(e=>buildings.some(b=>b.id===e.buildingId)),...courtRoutes.filter(r=>r.courtId===block.id+':interior')].flatMap(e=>e.polygons);
      const frontage=city.parcels.filter(p=>p.blockId===block.id&&(legacy||buildings.some(b=>b.parcelId===p.id))).flatMap(p=>C.boolean([C.corridor(...p.frontage,p.frontSetback*2+.1)],[region(p)],'intersection'));
      const court=city.blockInteriors.find(c=>c.blockId===block.id),walks=C.boolean([...routes,...(court?.paths||[]),...frontage]);
      // Paving follows authored access. Unused rear/side setbacks are planting,
      // not a one-metre pseudo-path wrapped around every wall and tiny notch.
      const service=block.islandId==='island:harbour';
      // Both materials derive from the SAME mask. A 5 mm outward join margin
      // removes exact coincident-edge needles at the 1 mm clipping grid.
      // Subtracting an already clipped pavement can instead misclassify whole
      // boundary-touching components, and opening it can break triangulation.
      const mask=legacy||service?walks:C.offset(walks,.005);
      const greens=service?[]:legacy?C.boolean(C.offset(free,-1),C.offset(walks,1),'difference').filter(p=>C.totalArea([p])>8):C.boolean(free,mask,'difference');
      const paved=legacy||service?C.boolean(free,greens,'difference'):C.boolean(free,mask,'intersection');
      surfaces.push({id:block.id+':surface',blockId:block.id,elevation:8.16,paved,greens,material:block.islandId==='island:harbour'?'service-paving':'pedestrian-paving'});
    }
    return {version:1,generatedBy:city.generatorVersion==='0.5.1-usable-fabric'?'0.5.3':'0.5.4',units:'metres',entrances,courtRoutes,crossings,ramps,surfaces,diagnostics};
  }
  function validate(city){
    const r=city.publicRealm,errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
    check(r.entrances.length===city.buildings.length,'Every building requires a frontage entrance');
    check(new Set(r.entrances.map(e=>e.buildingId)).size===city.buildings.length,'Duplicate or missing entrance identity');
    const crossings=r.crossings.map(x=>C.corridor(at(x.center,x.n,-x.width/2-.1),at(x.center,x.n,x.width/2+.1),x.depth));
    const network=C.boolean([...city.sidewalkCoverage,...crossings]);let component;
    for(const e of r.entrances){
      const found=network.findIndex(p=>C.inShape(p,e.from));
      check(found!==-1,'Entrance misses walking network '+e.id);
      if(component===undefined)component=found;else check(found===component,'Disconnected entrance '+e.id);
    }
    for(const route of r.courtRoutes)if(route.kind==='service')check(r.ramps.some(p=>p.id===route.id+':apron'),'Service access lacks curb transition '+route.id);
    return errors;
  }
  const api={generate,validate,rampHeight};if(typeof module!=='undefined')module.exports=api;root.CityPublicRealm=api;
})(globalThis);
