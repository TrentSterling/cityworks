// Original Cityworks surfacing with the MIT Slop hash/noise functions.
// Copyright (c) 2026 Mr.doob. Terms: ../../vendor/slop-newyork-MIT.txt.
import * as T from 'three/webgpu';
import {Fn,positionWorld,cameraPosition,color,vec2,float,fract,sin,dot,floor,mix,smoothstep,fwidth,length,attribute,max,min} from 'three/tsl';
const hash=Fn(([p])=>fract(sin(dot(p,vec2(127.1,311.7))).mul(43758.5453)));
const noise=Fn(([p])=>{const i=floor(p),f=fract(p),u=f.mul(f).mul(float(3).sub(f.mul(2)));return mix(mix(hash(i),hash(i.add(vec2(1,0))),u.x),mix(hash(i.add(vec2(0,1))),hash(i.add(vec2(1,1))),u.x),u.y);});
export function createDryRoadMaterial(){
 const m=new T.MeshStandardNodeMaterial({roughness:.94});
 m.colorNode=Fn(()=>{const q=positionWorld.xz,px=length(fwidth(q)),micro=mix(.5,noise(q.mul(16)),float(1).sub(smoothstep(.02,.06,px))),fine=mix(.5,noise(q.mul(3.2)),float(1).sub(smoothstep(.12,.4,px))),detail=float(1).sub(smoothstep(22,240,length(cameraPosition.sub(positionWorld)))),stain=smoothstep(.52,.84,noise(q.mul(.42))).mul(detail);return mix(color(0x34383b),color(0x454a4c),float(.22).add(fine.mul(.23)).add(micro.mul(.28)).add(noise(q.mul(.18)).mul(.05))).mul(float(1).sub(stain.mul(.055)));})();return m;
}
// WebGPU does not execute the legacy WebGL onBeforeCompile paint hook.
// Integrate each metric dash over its pixel footprint instead of rendering a solid stripe.
export function createMetricPaintMaterial(){
 const m=new T.MeshStandardNodeMaterial({vertexColors:true,roughness:.94,transparent:true,depthWrite:false});
 const p=attribute('paintMetric','vec3'),t=p.x.div(p.y),fw=max(fwidth(t),.0001),integral=x=>floor(x).mul(p.z).add(min(fract(x),p.z));
 m.opacityNode=min(1,max(0,integral(t.add(fw.mul(.5))).sub(integral(t.sub(fw.mul(.5)))).div(fw)));
 return m;
}
