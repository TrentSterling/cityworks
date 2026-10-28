/* Original adapter spike. Cityworks generates topology; upstream Slop renders it. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../../src/city.js');
const Clipper=require('../../vendor/clipper-6.4.2.js');
const out=path.join(__dirname,'data');fs.mkdirSync(out,{recursive:true});
const positive=r=>C.canonical(r,true),negative=r=>C.canonical(r,false);
const city=C.generate({width:700,depth:600,boundary:[[-310,-230],[-150,-275],[210,-260],[320,-160],[310,100],[245,120],[275,220],[90,275],[-190,250],[-320,110]],holes:[],skylineHeight:74,density:.72,lagoon:false});
city.sidewalkCoverage=C.boolean(city.rightOfWay,city.roadCoverage,'difference');
// Preserve parcel topology, setback, frontage, IDs and generated height intent. The experiment
// changes only a few footprint shapes inside existing envelopes to exercise concavity and holes.
let courtyardId,concaveId,concaveProbe;
const lots=new Map(city.parcels.map(p=>[p.id,p]));
const buildings=city.buildings.map((b,i)=>{
  let polygons=b.footprints.map(p=>({outer:positive(p.outer),holes:p.holes.map(negative)}));
  const p=polygons[0],inner=C.offset([p],-6).filter(q=>C.totalArea([q])>30);
  if(!courtyardId&&inner.length===1&&p.outer.length===4){p.holes.push(negative(inner[0].outer));courtyardId=b.id;}
  else if(!concaveId&&p.outer.length===4&&C.totalArea([p])>450){
    const a=p.outer[0],u=p.outer[1],v=p.outer.at(-1),a1=[a[0]+(u[0]-a[0])*.4,a[1]+(u[1]-a[1])*.4],a2=[a[0]+(v[0]-a[0])*.4,a[1]+(v[1]-a[1])*.4];
    const notch=C.shape(positive([a,a1,[a1[0]+a2[0]-a[0],a1[1]+a2[1]-a[1]],a2]));
    const cut=C.boolean([p],[notch],'difference');if(cut.length===1&&cut[0].outer.length>=6){polygons=cut;concaveId=b.id;concaveProbe=C.center(notch.outer);}
  }
  // Years are explicit synthetic design metadata, not invented historical facts about real places.
  const year=b.districtId==='district:harbour'?1910:b.height>42?2000:1960;
  return {id:b.id,seed:parseInt(C.hash(b.id),16),parcelId:b.parcelId,polygons,height:b.height,year,
    type:b.height>42?'commercial':'apartments',frontage:lots.get(b.parcelId).frontage,
    attributeSource:{height:'generated intent',year:'synthetic style control',type:'generated intent'}};
});
assert(courtyardId&&concaveId,'Required topology fixtures not generated');
// One honest unknown-year input demonstrates the upstream glass fallback; keep semantic type for SG.
buildings.at(-1).year=0;buildings.at(-1).attributeSource.year='unknown';
function records(input){const ids=new Set();return input.map(b=>{
  if(typeof b.id!=='string'||!b.id||ids.has(b.id))throw Error('missing or duplicate ID');ids.add(b.id);
  if(b.seed!==undefined&&(!Number.isInteger(b.seed)||b.seed<0||b.seed>4294967295))throw Error('seed must be a uint32: '+b.id);
  if(b.type!==undefined&&(typeof b.type!=='string'||!b.type))throw Error('invalid use/type: '+b.id);
  if(!Number.isFinite(b.height)||b.height<=0)throw Error('height must be finite and positive: '+b.id);
  if(b.year!==undefined&&(!Number.isInteger(b.year)||b.year<0||b.year>2100))throw Error('invalid year: '+b.id);
  if(!b.polygons?.length)throw Error('missing polygons: '+b.id);
  for(const p of b.polygons){
    for(const ring of [p.outer,...(p.holes||[])]){
      if(ring.length<3||ring.some(v=>v.length!==2||v.some(n=>!Number.isFinite(n)))||Math.abs(C.area(ring))<.01)throw Error('invalid ring: '+b.id);
      for(let i=0;i<ring.length;i++){const a=ring[i],d=ring[(i+1)%ring.length];if(Math.hypot(a[0]-d[0],a[1]-d[1])<.0009)throw Error('duplicate vertex: '+b.id);
        for(let j=i+2;j<ring.length;j++){if(i===0&&j===ring.length-1)continue;if(C.intersection(a,d,ring[j],ring[(j+1)%ring.length]))throw Error('self intersection: '+b.id);}}
    }
    const on=(p,a,d)=>{const dx=d[0]-a[0],dz=d[1]-a[1],l=Math.hypot(dx,dz),dot=(p[0]-a[0])*dx+(p[1]-a[1])*dz;return Math.abs(C.cross(a,d,p))<=1e-6*l&&dot>=-1e-6*l&&dot<=l*l+1e-6*l;};
    const touches=(a,d)=>a.some((u,i)=>d.some((v,j)=>C.intersection(u,a[(i+1)%a.length],v,d[(j+1)%d.length])||on(u,v,d[(j+1)%d.length])||on(v,u,a[(i+1)%a.length])));
    const outer=C.shape(positive(p.outer)),holes=(p.holes||[]).map(h=>C.shape(positive(h)));
    for(const [i,h]of holes.entries()){
      if(touches(h.outer,outer.outer)||C.totalArea(C.boolean(C.offset([h],.01),[outer],'difference'))>.001)throw Error('hole outside or touching outer: '+b.id);
      for(const other of holes.slice(i+1))if(touches(h.outer,other.outer)||C.totalArea(C.boolean(C.offset([h],.01),[other],'intersection'))>.001)throw Error('overlapping or touching holes: '+b.id);
    }
  }
  for(let i=0;i<b.polygons.length;i++)for(let j=i+1;j<b.polygons.length;j++)if(C.totalArea(C.boolean([b.polygons[i]],[b.polygons[j]],'intersection'))>.001)throw Error('overlapping parts: '+b.id);
  const pts=b.polygons.flatMap(p=>p.outer),xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  return {...b,seed:b.seed??parseInt(C.hash(b.id),16),year:b.year??0,minX,maxX,minZ,maxZ,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2,
    polygons:b.polygons.map(p=>({outer:positive(p.outer).map(([x,z])=>({x,z})),holes:(p.holes||[]).map(h=>negative(h).map(([x,z])=>({x,z})))}))};
});}
function singaporeFootprints(input){return input.map(b=>{
  const clean=(ring,sign)=>C.canonical(Clipper.Clipper.CleanPolygon(ring.map(([x,z])=>({X:Math.round(x*10),Y:Math.round(z*10)})),2).map(p=>[p.X/10,p.Y/10]),sign);
  const polygons=C.offset(b.polygons,-.25).map(p=>({outer:clean(p.outer,true),holes:p.holes.map(h=>clean(h,false))}));
  if(!polygons.length||polygons.some(p=>p.outer.length<3||p.holes.some(h=>h.length<3)))throw Error('SG quantization collapses footprint: '+b.id);
  records([{...b,polygons}]);
  if(C.totalArea(C.boolean(polygons,b.polygons,'difference'))>.002)throw Error('SG quantization escapes source envelope: '+b.id);
  for(const p of polygons)for(const ring of [p.outer,...p.holes])for(let i=0;i<ring.length;i++)if(Math.hypot(ring[i][0]-ring[(i+1)%ring.length][0],ring[i][1]-ring[(i+1)%ring.length][1])<.4)throw Error('SG edge below renderer cutoff: '+b.id);
  if(polygons.reduce((s,p)=>s+p.holes.length,0)!==b.polygons.reduce((s,p)=>s+p.holes.length,0))throw Error('SG processing changes hole count: '+b.id);
  return {...b,polygons};
});}
function pack(input){records(input);for(const b of input)for(const p of b.polygons)for(const ring of [p.outer,...p.holes])for(let i=0;i<ring.length;i++){
  if(ring[i].some(v=>Math.abs(v*10-Math.round(v*10))>1e-7)||Math.hypot(ring[i][0]-ring[(i+1)%ring.length][0],ring[i][1]-ring[(i+1)%ring.length][1])<.4)throw Error('SG pack requires validated quantized rings: '+b.id);
}const types=[...new Set(input.map(b=>b.type??'yes'))].sort(),data=[];let fx=0,fz=0;
  for(const b of input)for(const p of b.polygons){const rings=[negative(p.outer),...p.holes.map(positive)];data.push(rings.length,Math.round((b.height+.22)*10),2,types.indexOf(b.type??'yes'));
    for(const ring of rings){data.push(ring.length);let px=fx,pz=fz;ring.forEach(([x,z],i)=>{x=Math.round(x*10);z=Math.round(z*10);data.push(x-px,z-pz);px=x;pz=z;if(!i){fx=x;fz=z;}});}}
  return {types,data};}
const nodeIndex=new Map(city.nodes.map((n,i)=>[n.id,i])),names=[...new Set(city.streets.map(s=>s.sourceId))],classes=['primary','residential'];
const sgBuildings=singaporeFootprints(buildings);
const GEO={version:2,city:'cityworks',name:'Cityworks generated district',short:'CW',frame:{origin:[0,0],bearingDeg:0,driveSide:'right',units:'metric'},
  detail:city.island.boundary.flat(),land:[[city.island.boundary.flat(),...city.island.holes.map(h=>h.flat())]],water:[],parks:city.blocks.filter(b=>b.use==='park').map(b=>({name:'Reserved park',kind:'park',rings:[b.polygon.flat()]})),
  roadGraph:{nodes:city.nodes.flatMap(n=>n.position),names,classes,links:city.streets.map(s=>[nodeIndex.get(s.from),nodeIndex.get(s.to),names.indexOf(s.sourceId),s.width,s.class==='arterial'?4:2,0,[],s.class==='arterial'?0:1,0,0])},
  blocks:city.blocks.map(b=>[b.polygon.flat(),[],b.use==='park'?1:0,'',0,0]),districts:[],places:[],labels:[],trees:null,enforcement:null,lawns:[],buildings:pack(sgBuildings)};
const report={cases:{courtyardId,concaveId,concaveProbe,unknownYearId:buildings.at(-1).id},counts:{nodes:city.nodes.length,streets:city.streets.length,blocks:city.blocks.length,parcels:city.parcels.length,buildings:buildings.length},checks:[]};
function check(name,fn){fn();report.checks.push(name);}
check('Existing topology and parcel invariants',()=>assert.deepEqual(C.validate(city),[]));
check('Every crossing shares a graph node',()=>{for(let i=0;i<city.streets.length;i++)for(let j=i+1;j<city.streets.length;j++){const a=city.streets[i],b=city.streets[j];if(C.intersection(a.a,a.b,b.a,b.b))assert([a.from,a.to].some(x=>x===b.from||x===b.to));}});
check('Full footprint containment, setbacks and road exclusion',()=>{for(const b of buildings){const p=lots.get(b.parcelId),allowed=C.offset([C.shape(p.polygon,p.holes)],-p.setback+.004);assert(C.totalArea(C.boolean(b.polygons,allowed,'difference'))<.04);assert(C.totalArea(C.boolean(b.polygons,city.rightOfWay,'intersection'))<.02);}});
check('Footprints and parcels do not overlap',()=>{for(let i=0;i<buildings.length;i++)for(let j=i+1;j<buildings.length;j++)assert(C.totalArea(C.boolean(buildings[i].polygons,buildings[j].polygons,'intersection'))<.02);});
check('Frontage references retained',()=>buildings.forEach(b=>assert(b.frontage.length===2&&lots.get(b.parcelId).streetId)));
check('Missing year defaults to unknown; missing height rejected',()=>{const b=buildings[0];assert.equal(records([{...b,year:undefined}])[0].year,0);for(const height of [undefined,0,-1,NaN,Infinity])assert.throws(()=>records([{...b,height}]));assert.throws(()=>records([{...b,year:-10}]));});
check('Original geometry-derived IDs and explicit seeds retained',()=>assert.deepEqual(records(buildings).map(b=>b.id),buildings.map(b=>b.id)));
check('No footprint topology silently repaired',()=>assert.throws(()=>records([{...buildings[0],polygons:[{outer:[[0,0],[10,10],[0,10],[10,0]],holes:[]}]}])));
check('Duplicate IDs, touching holes, overlapping holes and parts rejected',()=>{const b=buildings[0],outer=C.rect(0,0,20,20),h=C.rect(2,2,8,8);assert.throws(()=>records([b,b]));assert.throws(()=>records([{...b,id:undefined}]));for(const holes of [[C.rect(0,2,5,5)],[h,C.rect(4,4,10,10)],[h,C.rect(3,3,4,4)]])assert.throws(()=>records([{...b,polygons:[{outer,holes}]}]));assert.throws(()=>records([{...b,polygons:[{outer,holes:[]},{outer,holes:[]}]}]));});
check('SG quantized footprints stay inside original envelopes and preserve voids',()=>sgBuildings.forEach((b,i)=>{assert(C.totalArea(C.boolean(b.polygons,buildings[i].polygons,'difference'))<.002);assert(b.polygons.reduce((s,p)=>s+p.holes.length,0)===buildings[i].polygons.reduce((s,p)=>s+p.holes.length,0));}));
check('Nonfinite seed, point-contact holes and unprepared SG packing rejected',()=>{const b=buildings[0];assert.throws(()=>records([{...b,seed:NaN}]));assert.throws(()=>records([{...b,polygons:[{outer:C.rect(0,0,20,20),holes:[C.rect(2,2,8,8),C.rect(8,8,12,12)]}]}]));assert.throws(()=>pack(buildings));assert.throws(()=>pack([{...b,polygons:[{outer:[[0,0],[10,0],[10,10],[.04,10],[.04,5],[0,5]],holes:[]}]}]));});
report.sgEncoding={gridMetres:.1,conservativeInsetMetres:.25,cleanToleranceMetres:.2,minWallMetres:.4,areaBefore:C.totalArea(buildings.flatMap(b=>b.polygons)),areaAfter:C.totalArea(sgBuildings.flatMap(b=>b.polygons)),note:'Only SG receives conservatively inset and cleaned rings. Every output revalidated; no excluded buildings.'};
const dataset={schema:'CityworksSlopAdapter/1',origin:'original generated data',terrain:{mode:'flat compatibility plane',baseY:.22},city,buildings,sgBuildings,records:records(buildings),GEO,report};
fs.writeFileSync(path.join(out,'generated.json'),JSON.stringify(dataset));
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
module.exports={records,pack,singaporeFootprints};
