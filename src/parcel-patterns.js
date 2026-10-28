/* Original Cityworks block intent, frontage subdivision and shared-court planning. */
(function(root){
  'use strict';
  const A=typeof module!=='undefined'?require('./archipelago.js'):root.ArchipelagoModel;
  const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  function intent(block){
    const c=A.center(block.polygon);
    if(block.islandId==='island:harbour')return {district:'working-harbour',widths:[42,62,36,48],cornerWidth:56,depths:[34,40,30],floors:[2,3,2],court:'service-yard'};
    if(block.islandId==='island:headland')return {district:'garden-neighbourhood',widths:[24,32,24,38],cornerWidth:34,depths:[20,24,18],floors:[3,4,3],court:'shared-garden'};
    if(c[1]<-300)return {district:'north-quarter',widths:[10,10,15,12,18],cornerWidth:23,depths:[22,26,20],floors:[4,4,5,3,5],court:'shared-garden'};
    if(c[1]>200)return {district:'south-gateway',widths:[18,26,14,22],cornerWidth:30,depths:[25,30,22],floors:[5,7,5,6],court:'shared-garden'};
    if(c[1]>-100)return {district:'central-exchange',widths:[22,14,30,18],cornerWidth:36,depths:[28,34,24],floors:[7,5,8,6],court:'pocket-square'};
    return {district:'civic-midrise',widths:[13,18,13,24],cornerWidth:28,depths:[24,29,21],floors:[5,6,4,7],court:'shared-garden'};
  }
  function subdivisions(span,plan,phase,arterial){
    const pattern=arterial&&plan.district==='central-exchange'?[30,20,38,24]:plan.widths;
    if(span<plan.cornerWidth*2+12)return[{from:0,to:span,corner:span>plan.cornerWidth,index:0}];
    const corner=Math.min(plan.cornerWidth,span*.23),middle=span-2*corner,widths=[];
    let sum=0,index=phase;
    while(sum+pattern[index%pattern.length]<middle-8){const w=pattern[index++%pattern.length];widths.push(w);sum+=w;}
    if(!widths.length)widths.push(middle);
    else if(middle-sum>=8)widths.push(middle-sum);
    else widths[widths.length-1]+=middle-sum;
    const values=[corner,...widths,corner];let station=0;
    return values.map((w,i)=>{const from=station;station+=w;return {from,to:station,corner:i===0||i===values.length-1,index:i};});
  }
  function courtAccess(block,fronts,plan){
    const reserveDepth=plan.court==='service-yard'?24:Math.max(...plan.depths)-3;
    const region=A.shape(block.polygon,block.holes||[]),inner=A.offset([region],-reserveDepth).filter(p=>A.totalArea(A.offset([p],-3))>40).sort((a,b)=>A.totalArea([b])-A.totalArea([a]));
    if(!inner.length||A.totalArea([inner[0]])<150)return null;
    const center=A.center(inner[0].outer);if(!A.inShape(inner[0],center))return null;
    const candidates=fronts.map(f=>({f,mid:[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2]})).filter(x=>length(x.f.a,x.f.b)>38);
    candidates.sort((a,b)=>((a.f.street.class==='local'?0:100)+length(a.mid,center))-((b.f.street.class==='local'?0:100)+length(b.mid,center)));
    for(const {f,mid} of candidates){
      const width=plan.court==='service-yard'?8:5.5,zone=A.boolean([A.corridor(mid,center,width)],[region],'intersection');
      if(A.totalArea(zone)<width*length(mid,center)*.97)continue;
      return {id:block.id+':court-access',streetId:f.street.id,from:mid.map(A.snap),to:center.map(A.snap),width,polygons:zone,core:[inner[0]]};
    }return null;
  }
  function sharedInterior(block,parcels,access,plan){
    if(!access)return null;
    // The shared core and access are reserved before parcels are subdivided.
    // Do not infer public space from millimetre seams between occupied lots.
    const polygons=A.boolean(access.core,access.polygons,'union');
    if(A.totalArea(polygons)<100)return null;
    const paths=A.boolean([A.corridor(access.from,access.to,access.width)],polygons,'intersection');
    const greens=plan.court==='service-yard'?[]:A.boolean(A.offset(polygons,-1.8),A.offset(paths,1.1),'difference').filter(p=>A.totalArea([p])>35);
    return {id:block.id+':interior',blockId:block.id,program:plan.court,polygons,paths,greens,accesses:[access],elevation:8.16};
  }
  function skylineSites(parcels){
    const hubs=[{id:'exchange',center:[-80,-40],radius:200,count:3,separation:105,ratio:1},{id:'harbour-gateway',center:[-250,190],radius:140,count:2,separation:85,ratio:.68}];
    const selected=new Map(),centers=[];
    for(const hub of hubs){
      const candidates=parcels.filter(p=>p.islandId==='island:civic'&&!p.courtyard&&p.corner&&p.streetClass!=='local'&&A.totalArea([A.shape(p.polygon,p.holes)])>550).map(p=>({p,c:A.center(p.polygon)})).filter(x=>length(x.c,hub.center)<hub.radius).sort((a,b)=>length(a.c,hub.center)-length(b.c,hub.center)||a.p.id.localeCompare(b.p.id));
      let count=0;
      for(const {p,c} of candidates){if(selected.has(p.id)||centers.some(other=>length(other,c)<hub.separation))continue;selected.set(p.id,{hub:hub.id,rank:count,ratio:hub.ratio*(1-count*.13)});centers.push(c);if(++count===hub.count)break;}
    }return selected;
  }
  const api={intent,subdivisions,courtAccess,sharedInterior,skylineSites};
  if(typeof module!=='undefined')module.exports=api;root.CityParcelPatterns=api;
})(typeof globalThis!=='undefined'?globalThis:this);
