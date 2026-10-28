// Comparison-only NYC data, retained separately from the generated district. NYB1 decoding
// follows Slop New York's MIT building-geodata.js at the pinned commit below.
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../../src/city.js');
const pin='13dd142b480bcfa01a6b18e36127c87e41cb4d80',base='https://raw.githubusercontent.com/mrdoob/slop-newyork/'+pin+'/js/';
async function read(file){const r=await fetch(base+file);if(!r.ok)throw Error(r.status+' '+file);return Buffer.from(await r.arrayBuffer());}
const gzip=await read('building-geodata.bin.gz'),data=gunzipSync(gzip),geoBytes=await read('nyc-geodata.js');
const geoText=geoBytes.toString(),start=geoText.indexOf('const GEO = ')+12;
const GEO=JSON.parse(geoText.slice(start,geoText.lastIndexOf(';')).trim());
const xStart=12+data.readUInt32LE(4),zStart=xStart+data.readUInt32LE(8);if(data.readUInt32LE(0)!==0x3142594e)throw Error('Invalid NYB1');
function stream(start,end){let cursor=start;return {uint(){let v=0,shift=0,b;do{if(cursor>=end||shift>=28)throw Error('Invalid stream');b=data[cursor++];v|=(b&127)<<shift;shift+=7;}while(b&128);return v;},done:()=>cursor===end};}
const meta=stream(12,xStart),xs=stream(xStart,zStart),zs=stream(zStart,data.length),delta=s=>{const v=s.uint();return(v>>>1)^-(v&1);};let x=0,z=0;
// Align the 6th Avenue centreline to the generated arterial (x=12) for the matched camera.
const sourceOrigin=[-322.3,2000],records=[];
for(let n=meta.uint(),index=0;index<n;index++){const height=meta.uint(),decade=meta.uint(),polygons=[];let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let np=meta.uint();np>0;np--){const rings=[];for(let nr=meta.uint();nr>0;nr--){const ring=[];for(let nv=meta.uint();nv>0;nv--){x+=delta(xs);z+=delta(zs);const p={x:x*.5-sourceOrigin[0],z:z*.5-sourceOrigin[1]};minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);ring.push(p);}rings.push(ring);}polygons.push({outer:rings[0],holes:rings.slice(1)});}
 if(minX>=-310&&maxX<=310&&minZ>=-250&&maxZ<=250)records.push({id:'nyc-snapshot-index:'+index,height,year:decade?(decade+159)*10:0,polygons,minX,maxX,minZ,maxZ,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2});
}
if(!meta.done()||!xs.done()||!zs.done())throw Error('Trailing NYB1 bytes');
const region=C.shape(C.rect(-320,-275,320,275)),roads=[];
const point=i=>[GEO.roadGraph.nodes[i*2]-sourceOrigin[0],GEO.roadGraph.nodes[i*2+1]-sourceOrigin[1]];
function addRoad(id,name,width,a,b){a=[a[0]-sourceOrigin[0],a[1]-sourceOrigin[1]];b=[b[0]-sourceOrigin[0],b[1]-sourceOrigin[1]];for(const [u,v]of C.clipSegment(a,b,[region]))roads.push({id,name,width,a:u,b:v});}
// The original graph covers lower Manhattan and selected non-grid roads. Numbered streets
// and avenues are separate authoritative layers; omitting them would falsify this comparison.
for(const s of GEO.streets)for(const [i,g]of s.segs.entries())addRoad('street:'+s.n+':'+i,s.n+' Street',g[3],[g[0],s.z],[g[1],s.z]);
for(const a of GEO.avenues)for(const [i,s]of a.segs.entries())addRoad('avenue:'+a.id+':'+i,a.label,s.w,[a.x,s.z0],[a.x,s.z1]);
for(const [i,l] of GEO.roadGraph.links.entries()){const pts=[point(l[0]),...Array.from({length:l[6].length/2},(_,k)=>[l[6][k*2]-sourceOrigin[0],l[6][k*2+1]-sourceOrigin[1]]),point(l[1])];for(let j=1;j<pts.length;j++)for(const [a,b]of C.clipSegment(pts[j-1],pts[j],[region]))roads.push({id:'nyc-road:'+i+':'+j,a,b,width:l[3],name:GEO.roadGraph.names[l[2]]});}
const roadCoverage=C.boolean(roads.map(s=>C.corridor(s.a,s.b,s.width))),rightOfWay=C.offset(roadCoverage,3.5),sidewalkCoverage=C.boolean(rightOfWay,roadCoverage,'difference');
const blocks=C.boolean([region],rightOfWay,'difference').map(p=>({polygon:p.outer,holes:p.holes,use:'mixed'}));
const fixture={schema:'CityworksSlopAdapter/1',origin:'NYC surveyed crop; translated only',sourceOrigin,records,city:{island:{boundary:region.outer,regions:[region]},roadCoverage,rightOfWay,sidewalkCoverage,blocks,streets:roads},GEO:{plazas:[]},provenance:{repo:'mrdoob/slop-newyork',commit:pin,footprintSource:'https://data.cityofnewyork.us/resource/5zhs-2jue.json',geographySources:'NYC Open Data and OpenStreetMap contributors (ODbL), per upstream README',gzipSha256:createHash('sha256').update(gzip).digest('hex'),geographySha256:createHash('sha256').update(geoBytes).digest('hex')}};
fs.writeFileSync(new URL('./data/nyc.json',import.meta.url),JSON.stringify(fixture));console.log(JSON.stringify({buildings:records.length,roads:roads.length,sourceOrigin,provenance:fixture.provenance},null,2));
