/* Original Cityworks planning rules. Renderer-neutral; Clipper is separately licensed. */
(function (root) {
  'use strict';
  const G = typeof module !== 'undefined' ? require('./geometry.js') : root.CityGeometry;
  const hash = value => { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
  const rand = (seed, id, tag) => parseInt(hash(seed + '|' + id + '|' + tag), 16) / 4294967296;
  const defaults = { schemaVersion: 2, seed: 'CITYWORKS-01', width: 1000, depth: 720, density: .72, skylineHeight: 118, arterialX: 12, arterialZ: 0, diagonalAngle: 34, diagonalOffset: 25, lagoon: true, boundary: null, holes: null };
  function checkedInput(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('City input must be an object');
    const p = { ...defaults, ...raw };
    if (p.boundary !== null && !Array.isArray(p.boundary)) throw Error('Boundary must be a ring or null');
    if (p.holes !== null && !Array.isArray(p.holes)) throw Error('Holes must be an array of rings or null');
    for (const [key, min, max] of [['width',600,1400],['depth',500,1100],['density',.1,1],['skylineHeight',24,180],['arterialX',-30,30],['arterialZ',-25,25],['diagonalAngle',15,70],['diagonalOffset',-160,160]]) if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max) throw Error(key + ' must be between ' + min + ' and ' + max);
    if (typeof p.seed !== 'string' || !p.seed.length || p.seed.length > 80) throw Error('Seed must contain 1 to 80 characters');
    if (p.schemaVersion !== 2) throw Error('Expected Cityworks input schema 2');
    if (typeof p.lagoon !== 'boolean') throw Error('Lagoon must be true or false');
    return p;
  }
  function generatedBoundary(p) {
    const outline = [[-.47,-.18],[-.43,-.36],[-.27,-.47],[-.03,-.44],[.15,-.47],[.35,-.37],[.46,-.22],[.44,-.06],[.29,-.03],[.24,.07],[.34,.17],[.46,.18],[.40,.34],[.23,.45],[.04,.43],[-.12,.48],[-.30,.37],[-.44,.23],[-.47,.05],[-.34,-.02],[-.31,-.14]];
    return outline.map((v, i) => [G.snap((v[0] + (rand(p.seed, 'coast', i) - .5) * .025) * p.width), G.snap((v[1] + (rand(p.seed, 'coast-z', i) - .5) * .025) * p.depth)]);
  }
  function generatedHoles(p) {
    if (!p.lagoon) return [];
    // A modest lake inside a baseline grid cell keeps seed regeneration usable.
    // Its position depends on seed, never on later arterial edits.
    const left=-110+(rand(p.seed,'grid-x',-1)-.5)*20,right=12;
    const top=-188+(rand(p.seed,'grid-z',-2)-.5)*20,bottom=-94+(rand(p.seed,'grid-z',-1)-.5)*20;
    const x=(left+right)/2,z=(top+bottom)/2,rx=(right-left)/2-34,rz=(bottom-top)/2-32;
    return [Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return [G.snap(x+Math.cos(a)*rx),G.snap(z+Math.sin(a)*rz)];})];
  }
  function graph(lines, safeLand) {
    const segments = lines.flatMap(line => G.clipSegment(line.a,line.b,safeLand).map(([a,b]) => ({...line,a,b,cuts:[0,1]})));
    for (let i=0;i<segments.length;i++) for(let j=i+1;j<segments.length;j++) {
      const hit=G.intersection(segments[i].a,segments[i].b,segments[j].a,segments[j].b);
      if(hit){segments[i].cuts.push(hit.t);segments[j].cuts.push(hit.q);}
    }
    const nodes=new Map(),edges=[];
    function node(p){const id='node:'+p.join(',');if(!nodes.has(id))nodes.set(id,{id,position:p});return id;}
    for(const s of segments){
      s.cuts.sort((a,b)=>a-b);const cuts=s.cuts.filter((v,i)=>!i||v-s.cuts[i-1]>1e-8);
      const at=t=>[G.snap(s.a[0]+(s.b[0]-s.a[0])*t),G.snap(s.a[1]+(s.b[1]-s.a[1])*t)];
      for(let i=0;i<cuts.length-1;i++){
        const a=at(cuts[i]),b=at(cuts[i+1]);if(Math.hypot(a[0]-b[0],a[1]-b[1])<.01)continue;
        edges.push({id:'street:'+s.id+':'+hash(a+'|'+b),sourceId:s.id,from:node(a),to:node(b),a,b,width:s.width,class:s.class,bridge:false});
      }
    }
    const adjacent=new Map([...nodes.keys()].map(id=>[id,[]]));
    for(const e of edges){adjacent.get(e.from).push(e.to);adjacent.get(e.to).push(e.from);}
    const unseen=new Set(nodes.keys()),components=[];
    while(unseen.size){const component=new Set(),stack=[unseen.values().next().value];while(stack.length){const id=stack.pop();if(!unseen.delete(id))continue;component.add(id);stack.push(...adjacent.get(id));}components.push(component);}
    components.sort((a,b)=>b.size-a.size);if(!components.length)throw Error('No streets fit inside land and water setbacks');
    const keep=components[0],streets=edges.filter(e=>keep.has(e.from));
    const omitted=edges.filter(e=>!keep.has(e.from)),omittedLength=omitted.reduce((n,e)=>n+Math.hypot(e.a[0]-e.b[0],e.a[1]-e.b[1]),0);
    for(const component of components.slice(1)){const part=edges.filter(e=>component.has(e.from)),length=part.reduce((n,e)=>n+Math.hypot(e.a[0]-e.b[0],e.a[1]-e.b[1]),0);if(part.length>=4||length>220)throw Error('Coast or water setbacks disconnect a substantial road component ('+part.length+' edges, '+Math.round(length)+' m). Adjust the outline or routes; bridges are not generated.');}
    return {nodes:[...nodes.values()].filter(n=>keep.has(n.id)),streets,omittedDisconnectedEdges:edges.length-streets.length,omittedLength:G.snap(omittedLength)};
  }
  function streetForEdge(a,b,streets){
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);let best=null;
    for(const street of streets){
      const sl=Math.hypot(street.b[0]-street.a[0],street.b[1]-street.a[1]);
      const alignment=Math.abs((dx*(street.b[0]-street.a[0])+dz*(street.b[1]-street.a[1]))/(len*sl));if(alignment<.999)continue;
      const p=G.projection(mid,street.a,street.b),error=Math.abs(p.distance-street.width/2-3.5);
      if(error<.025&&(!best||error<best.error))best={street,error};
    }return best?.street;
  }
  function frontageOn(polygon,a,b){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/length,(b[1]-a[1])/length],spans=[];
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length];
      if(Math.abs(G.cross(a,b,p))/length>.015||Math.abs(G.cross(a,b,q))/length>.015)continue;
      const project=v=>(v[0]-a[0])*u[0]+(v[1]-a[1])*u[1];
      const low=Math.max(0,Math.min(project(p),project(q))),high=Math.min(length,Math.max(project(p),project(q)));
      if(high-low>=8)spans.push([low,high]);
    }
    spans.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
    return spans.length?spans[0].map(t=>[G.snap(a[0]+u[0]*t),G.snap(a[1]+u[1]*t)]):null;
  }
  function makeParcels(block,streets){
    const parcels=[],allocated=[],region=G.shape(block.polygon,block.holes);
    for(let edge=0;edge<block.polygon.length;edge++){
      const a=block.polygon[edge],b=block.polygon[(edge+1)%block.polygon.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<8)continue;
      const street=streetForEdge(a,b,streets);if(!street)continue;
      const u=[(b[0]-a[0])/length,(b[1]-a[1])/length],inward=[-u[1],u[0]],count=Math.max(1,Math.round(length/25));
      for(let i=0;i<count;i++){
        const A=[a[0]+u[0]*length*i/count,a[1]+u[1]*length*i/count],B=[a[0]+u[0]*length*(i+1)/count,a[1]+u[1]*length*(i+1)/count];
        const strip=G.shape(G.canonical([A,B,[B[0]+inward[0]*33,B[1]+inward[1]*33],[A[0]+inward[0]*33,A[1]+inward[1]*33]]));
        const clipped=G.boolean([strip],[region],'intersection'),pieces=allocated.length?G.boolean(clipped,allocated,'difference'):clipped;
        for(const piece of pieces){
          const frontage=frontageOn(piece.outer,A,B);if(!frontage||G.totalArea([piece])<100||G.totalArea(G.offset([piece],-2))<45)continue;
          const id='lot:'+hash(JSON.stringify(piece)),mid=[(frontage[0][0]+frontage[1][0])/2,(frontage[0][1]+frontage[1][1])/2];
          parcels.push({id,blockId:block.id,streetId:street.id,polygon:piece.outer,holes:piece.holes,frontage,access:[mid.map(G.snap),G.projection(mid,street.a,street.b).point.map(G.snap)],area:G.snap(G.totalArea([piece])),setback:2});allocated.push(piece);
        }
      }
    }return parcels;
  }
  function generate(raw={}){
    const input=checkedInput(raw),{seed}=input;
    const land=G.validateLand(input.boundary||generatedBoundary(input),input.holes||(input.boundary?[]:generatedHoles(input)));
    input.holes=land.holes;
    const safeLand=G.offset([land],-24),urbanLand=G.offset([land],-18);
    if(!safeLand.length||G.totalArea(safeLand)<20000)throw Error('Land is too narrow after the 24 m street centre-line setback');
    const island={id:'island:main',boundary:land.outer,holes:land.holes,regions:[land],buildableRegions:urbanLand,elevation:3},lines=[];
    for(let i=-8;i<=8;i++){
      const x=i===0?input.arterialX:G.snap(i*110+(rand(seed,'grid-x',i)-.5)*20);
      lines.push({id:'north-south:'+i,a:[x,-1300],b:[x,1300],width:i===0?26:14,class:i===0?'arterial':'local'});
    }
    for(let i=-9;i<=9;i++){
      const z=i===0?input.arterialZ:G.snap(i*94+(rand(seed,'grid-z',i)-.5)*20);
      lines.push({id:'east-west:'+i,a:[-1300,z],b:[1300,z],width:i===0?24:12,class:i===0?'arterial':'local'});
    }
    const angle=input.diagonalAngle/180*Math.PI,direction=[Math.cos(angle),Math.sin(angle)],normal=[-direction[1],direction[0]];
    lines.push({id:'diagonal',a:[-1300*direction[0]+normal[0]*input.diagonalOffset,-1300*direction[1]+normal[1]*input.diagonalOffset],b:[1300*direction[0]+normal[0]*input.diagonalOffset,1300*direction[1]+normal[1]*input.diagonalOffset],width:28,class:'arterial'});
    const network=graph(lines,safeLand),{nodes,streets}=network;
    const roadCoverage=G.boolean(streets.map(s=>G.corridor(s.a,s.b,s.width))),rightOfWay=G.offset(roadCoverage,3.5),blockRegions=G.boolean(urbanLand,rightOfWay,'difference');
    const districts=[{id:'district:harbour',name:'Harbour',color:'#b59b7d'},{id:'district:midtown',name:'Midtown',color:'#c9c4b3'},{id:'district:garden',name:'Garden quarter',color:'#b4c8bc'}];
    const blocks=[],parcels=[],buildings=[];
    for(const region of blockRegions){
      if(G.totalArea([region])<160)continue;
      const c=G.center(region.outer),id='block:'+hash(JSON.stringify(region)),districtId=c[0]<-170?'district:harbour':c[0]>200?'district:garden':'district:midtown';
      const park=G.inShape(region,[95,45])||rand(seed,id,'park')<.07,block={id,polygon:region.outer,holes:region.holes,districtId,use:park?'park':'mixed'};
      blocks.push(block);if(park)continue;
      const lots=makeParcels(block,streets);parcels.push(...lots);if(!lots.length)block.use='open';
      for(const parcel of lots){
        const footprints=G.offset([G.shape(parcel.polygon,parcel.holes)],-parcel.setback).filter(p=>G.totalArea([p])>=40);if(!footprints.length)continue;
        const bid=parcel.id+':bld',pc=G.center(footprints[0].outer),f=Math.exp(-((pc[0]-45)**2/210**2+(pc[1]+25)**2/185**2)),variation=.65+rand(seed,bid,'height')*.55,h=3.4*Math.max(2,Math.round((8+input.skylineHeight*f*input.density*variation)/3.4)),parts=[];
        for(const footprint of footprints){
          const towers=h>32?G.offset([footprint],-3).filter(t=>G.totalArea([t])>35):[],podiumHeight=towers.length?Math.min(h,13.6+3.4*Math.floor(rand(seed,bid,'podium')*3)):h;
          parts.push({footprint:footprint.outer,holes:footprint.holes,height:G.snap(podiumHeight),base:3.35});
          for(const tower of towers)parts.push({footprint:tower.outer,holes:tower.holes,height:G.snap(h-podiumHeight),base:G.snap(3.35+podiumHeight)});
        }
        buildings.push({id:bid,parcelId:parcel.id,districtId,footprint:footprints[0].outer,holes:footprints[0].holes,footprints,center:pc.map(G.snap),height:G.snap(h),floors:Math.round(h/3.4),floorHeight:3.4,facadeBayWidth:3.15,style:districtId==='district:harbour'?'brick':h>45?'stone':rand(seed,bid,'style')>.55?'sage':'sand',parts});
      }
    }
    const dependencies={island:hash(JSON.stringify(land)),intent:hash(JSON.stringify([input.density,input.skylineHeight])),streets:hash(JSON.stringify([land,seed,input.arterialX,input.arterialZ,input.diagonalAngle,input.diagonalOffset]))};
    dependencies.blocks=hash(dependencies.streets);dependencies.parcels=hash(dependencies.blocks);dependencies.buildings=hash(dependencies.parcels+dependencies.intent);
    const diagnostics=network.omittedDisconnectedEdges?['Omitted '+network.omittedDisconnectedEdges+' isolated road fragments ('+Math.round(network.omittedLength)+' m); land and holes are unchanged.']:[];
    const city={schemaVersion:2,generatorVersion:'0.2.0',units:'metres',axis:'x-z plan, y-up',precision:.001,input,island,districts,nodes,streets,roadCoverage,rightOfWay,blocks,parcels,buildings,dependencies,diagnostics};
    city.stats={landArea:G.snap(G.totalArea([land])),streetLength:G.snap(streets.reduce((sum,s)=>sum+Math.hypot(s.a[0]-s.b[0],s.a[1]-s.b[1]),0)),roadArea:G.snap(G.totalArea(roadCoverage)),blocks:blocks.length,parcels:parcels.length,buildings:buildings.length,parks:blocks.filter(b=>b.use==='park').length,maxHeight:Math.max(0,...buildings.map(b=>b.height)),grossFloorArea:Math.round(buildings.reduce((sum,b)=>sum+b.parts.reduce((s,p)=>s+G.totalArea([G.shape(p.footprint,p.holes)])*p.height/b.floorHeight,0),0))};
    const errors=validate(city);if(errors.length)throw Error(errors.slice(0,5).join('; '));return city;
  }
  function validate(city){
    const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);},land=city.island.regions;
    const byBlock=new Map(city.blocks.map(b=>[b.id,G.shape(b.polygon,b.holes)])),byParcel=new Map(city.parcels.map(p=>[p.id,p]));
    const ids=[...city.nodes,...city.streets,...city.blocks,...city.parcels,...city.buildings].map(e=>e.id);check(new Set(ids).size===ids.length,'Duplicate entity ID');
    check(G.totalArea(G.boolean(city.roadCoverage,land,'difference'))<.05,'Road coverage crosses water');
    for(const b of city.blocks)check(G.totalArea(G.boolean([G.shape(b.polygon,b.holes)],land,'difference'))<.02,'Block crosses water '+b.id);
    for(const p of city.parcels){check(G.containsRegion(byBlock.get(p.blockId),G.shape(p.polygon,p.holes),.04),'Parcel outside block '+p.id);check(p.frontage&&Math.hypot(p.frontage[0][0]-p.frontage[1][0],p.frontage[0][1]-p.frontage[1][1])>=7.99,'No usable frontage '+p.id);}
    for(const b of city.buildings){const p=byParcel.get(b.parcelId);check(Number.isFinite(b.height)&&b.height>0,'Invalid building height');const allowed=G.offset([G.shape(p.polygon,p.holes)],-p.setback+.004);for(const part of b.parts)check(G.totalArea(G.boolean([G.shape(part.footprint,part.holes)],allowed,'difference'))<.04,'Footprint violates setback '+b.id);}
    const adjacency=new Map(city.nodes.map(n=>[n.id,[]]));for(const s of city.streets){check(adjacency.has(s.from)&&adjacency.has(s.to),'Missing junction');adjacency.get(s.from)?.push(s.to);adjacency.get(s.to)?.push(s.from);}
    const seen=new Set(),stack=city.nodes.length?[city.nodes[0].id]:[];while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);stack.push(...adjacency.get(n));}check(seen.size>0&&seen.size===city.nodes.length,'Disconnected street graph');check(city.buildings.length>0,'No usable parcels');return errors;
  }
  const api={defaults,generate,validate,hash,rand,...G,contains:G.inRing};
  if(typeof module!=='undefined')module.exports=api;root.CityModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
