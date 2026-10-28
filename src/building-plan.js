/* Original Cityworks building intent. Consumes the unchanged three-island ground model. */
(function(root){
  'use strict';
  const A=typeof module!=='undefined'?require('./archipelago.js'):root.ArchipelagoModel;
  const len=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  const ringRegion=p=>A.shape(p.polygon,p.holes||[]);
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
    const shape=ringRegion(block),fronts=block.polygon.map((a,i)=>({a,b:block.polygon[(i+1)%block.polygon.length]})).filter(f=>len(f.a,f.b)>9).map(f=>({...f,street:roadFront(f.a,f.b,block,city.streets)})).filter(f=>f.street);
    if(!fronts.length)return[];
    if(courtyard){const f=[...fronts].sort((a,b)=>len(b.a,b.b)-len(a.a,a.b))[0];return[{id:'parcel:'+A.hash(block.id+'|courtyard'),blockId:block.id,islandId:block.islandId,streetId:f.street.id,streetClass:f.street.class,polygon:shape.outer,holes:shape.holes,frontage:[f.a,f.b],access:[[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2],A.projection([(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2],f.street.a,f.street.b).point],courtyard:true,frontSetback:2.4,sideSetback:.3}];}
    const parcels=[],allocated=[],harbour=block.islandId==='island:harbour',garden=block.islandId==='island:headland';
    for(const f of fronts){const length=len(f.a,f.b),u=[(f.b[0]-f.a[0])/length,(f.b[1]-f.a[1])/length],n=[-u[1],u[0]],typical=harbour?38:garden?28:19,depth=harbour?39:garden?28:27,count=Math.max(1,Math.round(length/typical));
      for(let i=0;i<count;i++){const a=[f.a[0]+u[0]*length*i/count,f.a[1]+u[1]*length*i/count],b=[f.a[0]+u[0]*length*(i+1)/count,f.a[1]+u[1]*length*(i+1)/count],strip=A.shape(A.canonical([a,b,[b[0]+n[0]*depth,b[1]+n[1]*depth],[a[0]+n[0]*depth,a[1]+n[1]*depth]]));
        const clipped=A.boolean([strip],[shape],'intersection'),parts=allocated.length?A.boolean(clipped,allocated,'difference'):clipped;
        for(const p of parts){const frontage=frontageOn(p,a,b);if(!frontage||A.totalArea([p])<120||A.totalArea(A.offset([p],-2.4))<70)continue;const id='parcel:'+A.hash(block.islandId+'|'+JSON.stringify(p)),mid=[(frontage[0][0]+frontage[1][0])/2,(frontage[0][1]+frontage[1][1])/2];
          parcels.push({id,blockId:block.id,islandId:block.islandId,streetId:f.street.id,streetClass:f.street.class,polygon:p.outer,holes:p.holes,frontage,access:[mid.map(A.snap),A.projection(mid,f.street.a,f.street.b).point.map(A.snap)],frontSetback:harbour?2.6:garden?3.6:2.2,sideSetback:harbour?1.2:garden?2:.22});allocated.push(p);
        }
      }
    }return parcels;
  }
  function allowedFootprints(parcel){
    const base=A.offset([ringRegion(parcel)],-parcel.sideSetback),[a,b]=parcel.frontage,l=len(a,b),u=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=[-u[1],u[0]],point=(along,depth)=>[a[0]+u[0]*along+n[0]*depth,a[1]+u[1]*along+n[1]*depth];
    const halfplane=A.shape(A.canonical([point(-500,parcel.frontSetback),point(l+500,parcel.frontSetback),point(l+500,1500),point(-500,1500)]));
    return A.boolean(base,[halfplane],'intersection').filter(p=>A.totalArea([p])>70);
  }
  function generate(input={},buildingEdits={}){
    const ground=A.generate(input),parcels=[],buildings=[],reserved=new Set();
    for(const islandId of ['island:civic','island:headland']){
      const candidates=ground.blocks.filter(b=>b.islandId===islandId&&b.use==='mixed'&&b.area>5000&&b.area<12000&&A.offset([ringRegion(b)],-14).some(p=>A.totalArea([p])>250));
      if(candidates.length)reserved.add(candidates.sort((a,b)=>a.id.localeCompare(b.id))[0].id);
    }
    for(const block of ground.blocks){if(block.use!=='mixed')continue;parcels.push(...makeParcels(block,ground,reserved.has(block.id)));}
    for(const parcel of parcels){
      let footprints=allowedFootprints(parcel);if(!footprints.length)continue;
      const id=parcel.id+':building',seed=parseInt(A.hash(ground.input.seed+'|'+id),16),r=tag=>A.rand(ground.input.seed,id,tag),center=A.center(footprints[0].outer),harbour=parcel.islandId==='island:harbour',garden=parcel.islandId==='island:headland';
      let profile=parcel.courtyard?'courtyard':harbour?'warehouse':garden?'garden-row':'street-row';
      if(parcel.courtyard){const outer=A.offset([ringRegion(parcel)],-2.4),inner=A.offset(outer,-11);footprints=A.boolean(outer,inner,'difference');if(!footprints.some(p=>p.holes.length))throw Error('Courtyard collapsed '+id);}
      else if(harbour&&A.totalArea(footprints)>700&&r('service-court')<.25){const p=footprints[0],c=A.center(p.outer),back=[c[0]+(c[0]-parcel.access[0][0])*.55,c[1]+(c[1]-parcel.access[0][1])*.55];const cut=A.shape(A.rect(back[0],back[1],back[0]+10,back[1]+8));const next=A.boolean(footprints,[cut],'difference');if(next.length===footprints.length&&A.totalArea(next)>A.totalArea(footprints)*.7){footprints=next;profile='service-court';}}
      const district=harbour?'harbour':garden?'headland':'civic',style=harbour?(r('style')<.7?1:0):garden?0:(r('style')<.22?1:0);
      const tower=!parcel.courtyard&&!harbour&&!garden&&parcel.streetClass==='arterial'&&A.totalArea(footprints)>350&&r('tower')<.30;
      let height=harbour?7+3.4*Math.floor(r('floors')*3):garden?10.2+3.4*Math.floor(r('floors')*3):13.6+3.4*Math.floor(r('floors')*4);
      if(parcel.courtyard)height=garden?17:23.8;
      if(tower)height=ground.input.skylineHeight*(.55+.35*r('tower-height'))*(.6+.4*ground.input.density);
      else height*=.8+.35*ground.input.density;
      if(buildingEdits[id]){const h=buildingEdits[id].height;if(!Number.isFinite(h)||h<6||h>180)throw Error('Edited height must be 6..180 m: '+id);height=h;}
      height=A.snap(buildingEdits[id]?height:Math.round(height/3.4)*3.4);const baseElevation=8.16,volumes=[];
      const towerFoot=tower&&height>=13.6?A.offset(footprints,-3.6).filter(p=>A.totalArea([p])>80):[];
      const podiumHeight=towerFoot.length?Math.min(17,Math.max(6.8,height-6.8)):height;
      volumes.push({id:id+':base',seed,polygons:footprints,baseElevation,topElevation:A.snap(baseElevation+podiumHeight),facadeIndex:style,role:towerFoot.length?'podium':profile,streetLevel:true});
      if(towerFoot.length){profile='podium-tower';volumes.push({id:id+':upper',seed:parseInt(A.hash(id+'|upper'),16),polygons:towerFoot,baseElevation:A.snap(baseElevation+podiumHeight),topElevation:A.snap(baseElevation+height),facadeIndex:r('glass')<.65?2:4,role:'tower',streetLevel:false});}
      buildings.push({id,parcelId:parcel.id,blockId:parcel.blockId,islandId:parcel.islandId,seed,district,profile,center: center.map(A.snap),height,baseElevation,frontage:parcel.frontage,access:parcel.access,constructionYear:null,attributeSource:{height:'generated massing intent',style:'explicit design palette',base:'urban grading pad'},volumes});
    }
    const known=new Set(buildings.map(b=>b.id));for(const id of Object.keys(buildingEdits))if(!known.has(id))throw Error('Unknown edited building '+id);
    const city={...ground,schemaVersion:4,generatorVersion:'0.4.0-integration',parcels,buildings,buildingEdits,dependencies:{...ground.dependencies,parcels:A.hash(JSON.stringify(parcels)),buildings:A.hash(JSON.stringify(buildings))}};
    city.stats={...ground.stats,parcels:parcels.length,buildings:buildings.length,volumes:buildings.reduce((s,b)=>s+b.volumes.length,0),maxHeight:Math.max(...buildings.map(b=>b.height)),courtyards:buildings.filter(b=>b.volumes.some(v=>v.polygons.some(p=>p.holes.length))).length,towers:buildings.filter(b=>b.profile==='podium-tower').length};
    const errors=validate(city);if(errors.length)throw Error(errors.slice(0,8).join('; '));return city;
  }
  function validate(city){const errors=A.validate(city),check=(ok,m)=>{if(!ok)errors.push(m);},byBlock=new Map(city.blocks.map(b=>[b.id,b])),byParcel=new Map(city.parcels.map(p=>[p.id,p]));
    const ids=[...city.parcels,...city.buildings,...city.buildings.flatMap(b=>b.volumes)].map(e=>e.id);check(new Set(ids).size===ids.length,'Duplicate fabric IDs');
    for(const p of city.parcels){check(A.containsRegion(ringRegion(byBlock.get(p.blockId)),ringRegion(p),.04),'Parcel leaves block '+p.id);check(len(...p.frontage)>8,'Missing frontage '+p.id);}
    for(const b of city.buildings){const p=byParcel.get(b.parcelId),allowed=allowedFootprints(p);for(const v of b.volumes){check(v.topElevation>v.baseElevation&&Number.isFinite(v.topElevation),'Invalid volume heights '+v.id);check(A.totalArea(A.boolean(v.polygons,allowed,'difference'))<.05,'Volume leaves setback '+v.id);check(A.totalArea(A.boolean(v.polygons,city.rightOfWay,'intersection'))<.02,'Volume overlaps sidewalk/road '+v.id);check(A.totalArea(A.boolean(v.polygons,city.landRegions,'difference'))<.02,'Volume crosses water '+v.id);}
    }
    for(const block of city.blocks){const bs=city.buildings.filter(b=>b.blockId===block.id);for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++)check(A.totalArea(A.boolean(bs[i].volumes[0].polygons,bs[j].volumes[0].polygons,'intersection'))<.03,'Buildings overlap '+bs[i].id);}
    return errors;
  }
  const api={...A,generate,validate,allowedFootprints};if(typeof module!=='undefined')module.exports=api;root.CityFabric=api;
})(typeof globalThis!=='undefined'?globalThis:this);
