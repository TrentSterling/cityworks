/* Original Cityworks building intent. Consumes the unchanged three-island ground model. */
(function(root){
  'use strict';
  const A=typeof module!=='undefined'?require('./archipelago.js'):root.ArchipelagoModel;
  const P=typeof module!=='undefined'?require('./parcel-patterns.js'):root.CityParcelPatterns;
  const Realm=typeof module!=='undefined'?require('./public-realm.js'):root.CityPublicRealm;
  const VERSION='0.5.4-resolved-massing',LEGACY_VERSION='0.5.1-usable-fabric';
  const len=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  const ringRegion=p=>A.shape(p.polygon,p.holes||[]);
  const footprintRules=Object.freeze({minimumArea:120,minimumCoreRadius:4,minimumCoreArea:4,maximumAspect:6,minimumGap:6});
  function sweep(regions,vector){
    const move=(ring,sign)=>ring.map(p=>p.map((v,i)=>A.snap(v+vector[i]*sign))),parts=[];
    for(const p of regions){
      for(const sign of [-1,1])parts.push(A.shape(move(p.outer,sign),p.holes.map(r=>move(r,sign))));
      for(const ring of [p.outer,...p.holes])for(let i=0;i<ring.length;i++){
        const edge=[ring[i],ring[(i+1)%ring.length]],quad=A.canonical([...move(edge,-1),...move(edge,1).reverse()]);
        if(Math.abs(A.area(quad))>.001)parts.push(A.shape(quad));
      }
    }return A.boolean(parts);
  }
  function footprintAspect(p){
    let best=null;for(let i=0;i<p.outer.length;i++){
      const a=p.outer[i],b=p.outer[(i+1)%p.outer.length],l=len(a,b);if(l<.01)continue;
      const u=[(b[0]-a[0])/l,(b[1]-a[1])/l],x=p.outer.map(q=>q[0]*u[0]+q[1]*u[1]),z=p.outer.map(q=>-q[0]*u[1]+q[1]*u[0]),w=Math.max(...x)-Math.min(...x),d=Math.max(...z)-Math.min(...z);
      if(!best||w*d<best.area)best={area:w*d,ratio:Math.max(w,d)/Math.min(w,d)};
    }return best?.ratio||Infinity;
  }
  function usableFootprints(regions,frontage){
    const [a,b]=frontage,l=len(a,b),r=footprintRules.minimumCoreRadius,u=[(b[0]-a[0])/l*r,(b[1]-a[1])/l*r],n=[-u[1],u[0]];
    const core=A.offset(regions,-r).filter(p=>A.totalArea([p])>=footprintRules.minimumCoreArea);
    if(!core.length)return [];
    // A finite square sweep restores rectilinear corners without re-growing
    // the unbounded acute mitres or thin wings removed by the erosion.
    const opened=A.boolean(sweep(sweep(core,u),n),A.offset(regions,-.003),'intersection');
    return opened.filter(p=>A.totalArea([p])>=footprintRules.minimumArea&&footprintAspect(p)<=footprintRules.maximumAspect&&A.totalArea(A.offset([p],-r))>=footprintRules.minimumCoreArea);
  }
  function resolvedFootprints(regions){
    // Remove clipping-scale returns by cutting back into the existing mass.
    // Never fill a notch across a parcel boundary, hole or reserved access.
    // Broad L/U forms survive: only a short incident edge (<2 m) is eligible,
    // with at most 2 m local displacement and 12% total area loss per part.
    return regions.map(original=>{
      let current=original;const originalArea=A.totalArea([original]);
      for(let pass=0;pass<100;pass++){
        const candidates=[],rings=[current.outer,...current.holes];
        for(let ri=0;ri<rings.length;ri++){
          const ring=rings[ri];if(ring.length<=3)continue;
          const consider=(next,i)=>{
            const raw=ri?A.shape(current.outer,current.holes.map((r,j)=>j===ri-1?next:r)):A.shape(next,current.holes);
            const normalized=A.boolean([raw]);if(normalized.length!==1||normalized[0].holes.length!==original.holes.length)return;
            const candidate=normalized[0],area=A.totalArea([candidate]);
            if(candidate.outer.length+candidate.holes.reduce((s,r)=>s+r.length,0)>=rings.reduce((s,r)=>s+r.length,0))return;
            if(area<Math.max(footprintRules.minimumArea,originalArea*.88)||area>A.totalArea([current])+.0001)return;
            if(A.totalArea(A.boolean([candidate],[current],'difference'))>.0001)return;
            if(footprintAspect(candidate)>footprintRules.maximumAspect||A.totalArea(A.offset([candidate],-footprintRules.minimumCoreRadius))<footprintRules.minimumCoreArea)return;
            candidates.push({candidate,loss:A.totalArea([current])-area,ri,i});
          };
          for(let i=0;i<ring.length;i++){
            const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];
            if(Math.min(len(a,b),len(b,c))>=2||A.projection(b,a,c).distance>2)continue;
            consider(ring.filter((_,j)=>j!==i),i);
            // A tiny bevel inside a recess has two reflex endpoints. Removing
            // either one would add mass. Intersect its adjoining wall lines
            // instead, accepting the miter only when it also cuts inward.
            if(len(b,c)<2&&ring.length>4){
              const d=ring[(i+2)%ring.length],u=b.map((v,j)=>v-a[j]),v=d.map((w,j)=>w-c[j]),det=u[0]*v[1]-u[1]*v[0];
              if(Math.abs(det)>1e-8){
                const t=((c[0]-a[0])*v[1]-(c[1]-a[1])*v[0])/det,corner=a.map((w,j)=>A.snap(w+u[j]*t));
                // Millimetre integer clipping can round a mathematical miter
                // onto the wrong side. Search only its 2 mm neighbourhood;
                // the same full containment test decides every candidate.
                if(Math.max(len(corner,b),len(corner,c))<=1.997)for(const dx of [0,-.002,.002])for(const dz of [0,-.002,.002]){
                  const point=[A.snap(corner[0]+dx),A.snap(corner[1]+dz)];
                  consider(ring.flatMap((p,j)=>j===i?[point]:j===(i+1)%ring.length?[]:[p]),i);
                }
              }
            }
          }
        }
        if(!candidates.length)break;
        candidates.sort((a,b)=>a.loss-b.loss||a.ri-b.ri||a.i-b.i);current=candidates[0].candidate;
      }
      return current;
    });
  }
  function roadFront(a,b,block,streets){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=len(a,b),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];let best;
    for(const s of streets){if(s.bridge||s.islandId!==block.islandId)continue;const sl=len(s.a,s.b),alignment=Math.abs(dx*(s.b[0]-s.a[0])+dz*(s.b[1]-s.a[1]))/(length*sl);if(alignment<.999)continue;
      const p=A.projection(mid,s.a,s.b),error=Math.abs(p.distance-s.width/2-s.sidewalkWidth);
      if(error<.04&&(!best||error<best.error))best={street:s,error};
    }return best?.street;
  }
  function frontageOn(region,a,b){
    const l=len(a,b),u=[(b[0]-a[0])/l,(b[1]-a[1])/l],spans=[];
    for(let i=0;i<region.outer.length;i++){const p=region.outer[i],q=region.outer[(i+1)%region.outer.length];if(Math.abs(A.cross(a,b,p))/l>.025||Math.abs(A.cross(a,b,q))/l>.025)continue;
      const at=v=>(v[0]-a[0])*u[0]+(v[1]-a[1])*u[1],lo=Math.max(0,Math.min(at(p),at(q))),hi=Math.min(l,Math.max(at(p),at(q)));if(hi-lo>8)spans.push([lo,hi]);}
    spans.sort((x,y)=>(y[1]-y[0])-(x[1]-x[0]));return spans.length?spans[0].map(t=>[A.snap(a[0]+u[0]*t),A.snap(a[1]+u[1]*t)]):null;
  }
  function makeParcels(block,city,courtyard){
    const shape=ringRegion(block),plan=P.intent(block),priority={arterial:0,collector:1,local:2};
    const fronts=block.polygon.map((a,i)=>({a,b:block.polygon[(i+1)%block.polygon.length]})).filter(f=>len(f.a,f.b)>9).map(f=>({...f,street:roadFront(f.a,f.b,block,city.streets)})).filter(f=>f.street);
    fronts.sort((a,b)=>priority[a.street.class]-priority[b.street.class]||len(b.a,b.b)-len(a.a,a.b));
    if(!fronts.length)return{parcels:[],interior:null};
    if(courtyard){const f=[...fronts].sort((a,b)=>len(b.a,b.b)-len(a.a,a.b))[0];return{parcels:[{id:'parcel:'+A.hash(block.id+'|courtyard'),blockId:block.id,islandId:block.islandId,streetId:f.street.id,streetClass:f.street.class,polygon:shape.outer,holes:shape.holes,frontage:[f.a,f.b],access:[[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2],A.projection([(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2],f.street.a,f.street.b).point],courtyard:true,frontSetback:2.4,sideSetback:.3,planDistrict:plan.district}],interior:null};}
    const access=P.courtAccess(block,fronts,plan),parcels=[],allocated=access?A.boolean(access.core,access.polygons,'union'):[],harbour=block.islandId==='island:harbour',garden=block.islandId==='island:headland';
    for(const f of fronts){
      const length=len(f.a,f.b),u=[(f.b[0]-f.a[0])/length,(f.b[1]-f.a[1])/length],n=[-u[1],u[0]],phase=parseInt(A.hash(block.id+'|'+f.street.id),16)%plan.widths.length;
      for(const segment of P.subdivisions(length,plan,phase,f.street.class==='arterial')){
        const depth=segment.corner?Math.max(...plan.depths)+3:plan.depths[(segment.index+phase)%plan.depths.length];
        const a=[f.a[0]+u[0]*segment.from,f.a[1]+u[1]*segment.from],b=[f.a[0]+u[0]*segment.to,f.a[1]+u[1]*segment.to],strip=A.shape(A.canonical([a,b,[b[0]+n[0]*depth,b[1]+n[1]*depth],[a[0]+n[0]*depth,a[1]+n[1]*depth]]));
        const clipped=A.boolean([strip],[shape],'intersection'),parts=allocated.length?A.boolean(clipped,A.boolean(allocated),'difference'):clipped;
        for(const p of parts){const frontage=frontageOn(p,a,b);if(!frontage||A.totalArea([p])<120||A.totalArea(A.offset([p],-2.4))<70)continue;
          const id='parcel:'+A.hash(block.islandId+'|'+JSON.stringify(p)),mid=[(frontage[0][0]+frontage[1][0])/2,(frontage[0][1]+frontage[1][1])/2],corner=segment.corner&&frontage.some(q=>len(q,f.a)<.05||len(q,f.b)<.05);
          parcels.push({id,blockId:block.id,islandId:block.islandId,streetId:f.street.id,streetClass:f.street.class,polygon:p.outer,holes:p.holes,frontage,access:[mid.map(A.snap),A.projection(mid,f.street.a,f.street.b).point.map(A.snap)],frontSetback:harbour?4:garden?3.6:3,sideSetback:harbour?4:3,spacingPolicy:harbour?'8m service clearance':'6m detached clearance',depth,rearSetback:harbour||garden?5:3,corner,planDistrict:plan.district,floorBand:plan.floors[(segment.index+phase)%plan.floors.length]+(corner&&!harbour?1:0)});allocated.push(p);
        }
      }
    }return{parcels,interior:P.sharedInterior(block,parcels,access,plan)};
  }
  function allowedFootprints(parcel){
    const base=A.offset([ringRegion(parcel)],-parcel.sideSetback),[a,b]=parcel.frontage,l=len(a,b),u=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=[-u[1],u[0]],point=(along,depth)=>[a[0]+u[0]*along+n[0]*depth,a[1]+u[1]*along+n[1]*depth];
    const halfplane=A.shape(A.canonical([point(-500,parcel.frontSetback),point(l+500,parcel.frontSetback),point(l+500,parcel.depth?parcel.depth-parcel.rearSetback:1500),point(-500,parcel.depth?parcel.depth-parcel.rearSetback:1500)]));
    return A.boolean(base,[halfplane],'intersection').filter(p=>A.totalArea([p])>70);
  }
  function generate(input={},buildingEdits={},massingRevisions={},version=VERSION){
    if(![VERSION,LEGACY_VERSION].includes(version))throw Error('Unsupported fabric generator '+version);
    const fit=(regions,frontage)=>{const usable=usableFootprints(regions,frontage);return version===LEGACY_VERSION?usable:resolvedFootprints(usable);};
    for(const [id,revision] of Object.entries(massingRevisions))if(!Number.isSafeInteger(revision)||revision<0||revision>1000000)throw Error('Invalid massing revision '+id);
    const ground=A.generate(input),parcels=[],buildings=[],blockInteriors=[],reserved=new Set();
    for(const islandId of ['island:civic','island:headland']){
      const candidates=ground.blocks.filter(b=>b.islandId===islandId&&b.use==='mixed'&&b.area>5000&&b.area<12000&&A.offset([ringRegion(b)],-14).some(p=>A.totalArea([p])>250));
      if(candidates.length)reserved.add(candidates.sort((a,b)=>a.id.localeCompare(b.id))[0].id);
    }
    for(const block of ground.blocks){if(block.use!=='mixed')continue;const result=makeParcels(block,ground,reserved.has(block.id));parcels.push(...result.parcels);if(result.interior)blockInteriors.push(result.interior);}
    const towerSites=P.skylineSites(parcels.filter(p=>usableFootprints(A.offset(allowedFootprints(p),-3.6),p.frontage).length),ground.layout.scale);
    for(const parcel of parcels){
      let footprints=allowedFootprints(parcel);if(!footprints.length)continue;
      const id=parcel.id+':building',revision=massingRevisions[id]||0,scopedSeed=ground.input.seed+(revision?'|massing:'+revision:''),seed=parseInt(A.hash(scopedSeed+'|'+id),16),r=tag=>A.rand(scopedSeed,id,tag),partSeed=role=>parseInt(A.hash(id+'|'+role+(revision?'|massing:'+revision:'')),16),harbour=parcel.islandId==='island:harbour',garden=parcel.islandId==='island:headland';
      let profile=parcel.courtyard?'courtyard':harbour?'warehouse':garden?'garden-row':'street-row';
      if(parcel.courtyard){const outer=A.offset([ringRegion(parcel)],-2.4),inner=A.offset(outer,-11);footprints=A.boolean(outer,inner,'difference');if(!footprints.some(p=>p.holes.length))throw Error('Courtyard collapsed '+id);}
      else if(harbour&&parcel.depth>33&&A.totalArea(footprints)>850){
        const [a,b]=parcel.frontage,l=len(a,b),u=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=[-u[1],u[0]],at=(x,d)=>[a[0]+u[0]*x+n[0]*d,a[1]+u[1]*x+n[1]*d];
        const notch=A.shape(A.canonical([at(l*.38,parcel.depth-13),at(l*.62,parcel.depth-13),at(l*.62,parcel.depth+1),at(l*.38,parcel.depth+1)]));
        const next=A.boolean(footprints,[notch],'difference');if(next.length===footprints.length){footprints=next;profile='service-court';}
      }
      if(version===VERSION&&parcel.courtyard)footprints=A.boolean(footprints,allowedFootprints(parcel),'intersection');
      footprints=fit(footprints,parcel.frontage);if(!footprints.length)continue;const center=A.center(footprints[0].outer);
      const district=parcel.planDistrict,style=harbour?1:garden?0:district==='north-quarter'?(r('style')<.65?1:0):(r('style')<.25?1:0);
      const towerIntent=towerSites.get(parcel.id),tower=!!towerIntent;
      let height=(parcel.floorBand||5)*3.4*(.8+.35*ground.input.density);
      if(parcel.courtyard)height=garden?17:23.8;
      if(tower)height=ground.input.skylineHeight*towerIntent.ratio*(.85+.15*ground.input.density);
      if(revision)height=tower?height*(.95+r('height')*.1):Math.max(6.8,height+(Math.floor(r('floors')*3)-1)*3.4);
      if(buildingEdits[id]){const h=buildingEdits[id].height;if(!Number.isFinite(h)||h<6||h>180)throw Error('Edited height must be 6..180 m: '+id);height=h;}
      height=A.snap(buildingEdits[id]?height:Math.round(height/3.4)*3.4);const baseElevation=8.16,volumes=[];
      const towerFoot=tower&&height>=13.6?fit(A.offset(footprints,-3.6),parcel.frontage):[];
      const podiumHeight=towerFoot.length?Math.min(20.4,Math.max(6.8,height-10.2)):height;
      let passage=null,baseFootprints=footprints;
      if(parcel.courtyard){
        const hole=footprints.flatMap(p=>p.holes)[0],target=A.center(hole),from=parcel.access[0],width=5.5;
        const zone=A.boolean([A.corridor(from,target,width)],[ringRegion(parcel)],'intersection');
        baseFootprints=fit(A.boolean(footprints,zone,'difference'),parcel.frontage);if(!baseFootprints.length)continue;passage={id:id+':passage',from,to:target.map(A.snap),width,clearance:Math.min(6.8,height),polygons:zone};
        const courtyard=A.shape(A.canonical(hole)),open=A.boolean([courtyard],zone,'union'),paths=A.boolean(zone,open,'intersection'),greens=A.boolean(A.offset([courtyard],-2),A.offset(paths,1.1),'difference');
        blockInteriors.push({id:parcel.blockId+':interior',blockId:parcel.blockId,program:'enclosed-court',polygons:open,paths,greens,accesses:[{...passage,streetId:parcel.streetId}],elevation:baseElevation});
      }
      volumes.push({id:id+':base',seed,polygons:baseFootprints,baseElevation,topElevation:A.snap(baseElevation+(passage?Math.min(6.8,height):podiumHeight)),facadeIndex:style,role:passage?'courtyard-ground':towerFoot.length?'podium':profile,streetLevel:true});
      if(passage&&height>6.8)volumes.push({id:id+':court-upper',seed:partSeed('court-upper'),polygons:footprints,baseElevation:A.snap(baseElevation+6.8),topElevation:A.snap(baseElevation+height),facadeIndex:style,role:'courtyard-upper',streetLevel:false});
      if(towerFoot.length){
        profile='podium-tower';const topFoot=fit(A.offset(towerFoot,-2.1),parcel.frontage),hasCrown=height>47&&topFoot.length;
        const towerStyle=harbour?1:garden?0:towerIntent.hub==='exchange'?3:2;
        volumes.push({id:id+':upper',seed:partSeed('upper'),polygons:towerFoot,baseElevation:A.snap(baseElevation+podiumHeight),topElevation:A.snap(baseElevation+(hasCrown?height-6.8:height)),facadeIndex:towerStyle,role:'tower',streetLevel:false});
        if(hasCrown)volumes.push({id:id+':crown',seed:partSeed('crown'),polygons:topFoot,baseElevation:A.snap(baseElevation+height-6.8),topElevation:A.snap(baseElevation+height),facadeIndex:towerStyle,role:'tower-crown',streetLevel:false});
      }
      buildings.push({id,parcelId:parcel.id,blockId:parcel.blockId,islandId:parcel.islandId,seed,district,profile,center: center.map(A.snap),height,baseElevation,frontage:parcel.frontage,access:parcel.access,constructionYear:null,passage,towerIntent:towerIntent||null,attributeSource:{height:'generated massing intent',style:'explicit design palette',base:'urban grading pad'},volumes});
    }
    const known=new Set(buildings.map(b=>b.id));for(const id of Object.keys(buildingEdits))if(!known.has(id))throw Error('Unknown edited building '+id);
    for(const id of Object.keys(massingRevisions))if(!known.has(id))throw Error('Unknown massing building '+id);
    const occupied=new Set(buildings.map(b=>b.parcelId));
    const siteReservations=parcels.filter(p=>!occupied.has(p.id)).map(p=>({id:p.id+':reserve',parcelId:p.id,use:'service-or-landscape',reason:'No usable footprint meeting width, area and aspect rules',polygons:[ringRegion(p)]}));
    const city={...ground,schemaVersion:4,generatorVersion:version,parcels,buildings,blockInteriors,siteReservations,buildingEdits,dependencies:{...ground.dependencies,parcels:A.hash(JSON.stringify(parcels)),buildings:A.hash(JSON.stringify(buildings)),blockInteriors:A.hash(JSON.stringify(blockInteriors))}};
    city.stats={...ground.stats,parcels:parcels.length,buildings:buildings.length,volumes:buildings.reduce((s,b)=>s+b.volumes.length,0),maxHeight:Math.max(...buildings.map(b=>b.height)),sharedInteriors:blockInteriors.length,cornerLots:parcels.filter(p=>p.corner).length,courtyards:buildings.filter(b=>b.volumes.some(v=>v.polygons.some(p=>p.holes.length))).length,towers:buildings.filter(b=>b.profile==='podium-tower').length};
    city.publicRealm=Realm.generate(city);city.dependencies.publicRealm=A.hash(JSON.stringify(city.publicRealm));
    const errors=validate(city);if(errors.length)throw Error(errors.slice(0,8).join('; '));return city;
  }
  function validate(city){const errors=[...A.validate(city),...Realm.validate(city)],check=(ok,m)=>{if(!ok)errors.push(m);},byBlock=new Map(city.blocks.map(b=>[b.id,b])),byParcel=new Map(city.parcels.map(p=>[p.id,p]));
    const ids=[...city.parcels,...city.buildings,...city.buildings.flatMap(b=>b.volumes)].map(e=>e.id);check(new Set(ids).size===ids.length,'Duplicate fabric IDs');
    for(const p of city.parcels){check(A.containsRegion(ringRegion(byBlock.get(p.blockId)),ringRegion(p),.04),'Parcel leaves block '+p.id);check(len(...p.frontage)>8,'Missing frontage '+p.id);}
    for(const b of city.buildings){const p=byParcel.get(b.parcelId),allowed=allowedFootprints(p);for(const v of b.volumes){check(v.topElevation>v.baseElevation&&Number.isFinite(v.topElevation),'Invalid volume heights '+v.id);check(A.totalArea(A.boolean(v.polygons,allowed,'difference'))<.05,'Volume leaves setback '+v.id);check(A.totalArea(A.boolean(v.polygons,city.rightOfWay,'intersection'))<.02,'Volume overlaps sidewalk/road '+v.id);check(A.totalArea(A.boolean(v.polygons,city.landRegions,'difference'))<.02,'Volume crosses water '+v.id);for(const part of v.polygons){check(A.totalArea([part])>=footprintRules.minimumArea,'Small footprint '+v.id);check(footprintAspect(part)<=footprintRules.maximumAspect,'Sliver aspect '+v.id);check(A.totalArea(A.offset([part],-footprintRules.minimumCoreRadius))>=footprintRules.minimumCoreArea,'Unusable footprint core '+v.id);}}
    }
    for(const block of city.blocks){const bs=city.buildings.filter(b=>b.blockId===block.id);for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++)check(A.totalArea(A.boolean(bs[i].volumes[0].polygons,bs[j].volumes[0].polygons,'intersection'))<.03,'Buildings overlap '+bs[i].id);}
    for(const court of city.blockInteriors){
      const block=byBlock.get(court.blockId);
      check(A.totalArea(A.boolean(court.polygons,[ringRegion(block)],'difference'))<.03,'Shared court leaves its block '+court.id);
      check(A.totalArea(A.boolean(court.paths,court.polygons,'difference'))<.03,'Path leaves shared court '+court.id);
      check(A.totalArea(A.boolean(court.greens,court.polygons,'difference'))<.03,'Planting leaves shared court '+court.id);
      check(A.totalArea(A.boolean(court.greens,court.paths,'intersection'))<.03,'Planting obstructs court path '+court.id);
      for(const access of court.accesses){
        check(A.inRegions(court.polygons,access.to),'Court access does not reach interior '+court.id);
        const street=city.streets.find(s=>s.id===access.streetId);
        check(!!street&&A.projection(access.from,street.a,street.b).distance<=street.width/2+street.sidewalkWidth+.03,'Court access misses sidewalk '+court.id);
      }
      for(const b of city.buildings.filter(b=>b.blockId===court.blockId))for(const v of b.volumes){
        if(v.baseElevation<8.16+6.8-.001)check(A.totalArea(A.boolean(v.polygons,court.polygons,'intersection'))<.03,'Ground-level building obstructs court '+b.id);
      }
    }
    return errors;
  }
    const api={...A,VERSION,LEGACY_VERSION,generate,validate,allowedFootprints,usableFootprints,resolvedFootprints,footprintAspect,footprintRules};if(typeof module!=='undefined')module.exports=api;root.CityFabric=api;
})(typeof globalThis!=='undefined'?globalThis:this);
