const fs=require('node:fs'),C=require('../src/building-plan.js');
const city=C.generate(),out=process.argv[2]||'artifacts/building-fit/before';fs.mkdirSync(out,{recursive:true});
function radius(p){let lo=0,hi=80;for(let i=0;i<12;i++){let mid=(lo+hi)/2;if(C.totalArea(C.offset([p],-mid))>.02)lo=mid;else hi=mid;}return lo;}
const rows=city.buildings.map(b=>({id:b.id,center:b.center,height:b.height,area:C.totalArea(b.volumes[0].polygons),radius:Math.min(...b.volumes[0].polygons.map(radius)),shortEdge:Math.min(...b.volumes.flatMap(v=>v.polygons.flatMap(p=>[p.outer,...p.holes].flatMap(r=>r.map((a,i)=>Math.hypot(a[0]-r[(i+1)%r.length][0],a[1]-r[(i+1)%r.length][1]))))))})).sort((a,b)=>a.radius-b.radius);
fs.writeFileSync(out+'/city.json',JSON.stringify(city));fs.writeFileSync(out+'/audit.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.slice(0,10),null,2));
