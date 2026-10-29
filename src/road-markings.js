/* Cityworks road markings.
 * The metric strip primitive is adapted from mrdoob/slop-newyork road-paint.js
 * at 13dd142b480bcfa01a6b18e36127c87e41cb4d80, MIT, Copyright (c) 2026 Mr.doob.
 * Full license: vendor/slop-newyork-MIT.txt. Network placement is Cityworks code.
 */
(function(root){
  function roadLayout(C,city){
    const incidence=new Map(city.nodes.map(n=>[n.id,[]]));
    for(const e of city.streets){incidence.get(e.from).push(e);incidence.get(e.to).push(e);}
    function clearance(edge,id){
      const es=incidence.get(id);if(es.length<3)return 1;
      const start=edge.from===id?edge.a:edge.b,end=edge.from===id?edge.b:edge.a,len=Math.hypot(end[0]-start[0],end[1]-start[1]),u=[(end[0]-start[0])/len,(end[1]-start[1])/len];
      // Stop outside the actual overlap of the incident arms. A single circular
      // radius cannot reserve enough room for acute approaches without wasting
      // the same amount on every other arm.
      const others=es.filter(e=>e!==edge).map(e=>C.corridor(e.a,e.b,e.width));
      const overlap=C.boolean([C.corridor(edge.a,edge.b,edge.width)],others,'intersection');
      let stop=0;for(const part of overlap)for(const p of part.outer)stop=Math.max(stop,(p[0]-start[0])*u[0]+(p[1]-start[1])*u[1]);
      return stop+7;
    }
    return city.streets.map(e=>{
      const length=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),u=[(e.b[0]-e.a[0])/length,(e.b[1]-e.a[1])/length],n=[-u[1],u[0]],lo=clearance(e,e.from),hi=length-clearance(e,e.to);
      const crossings=hi-lo<3||e.bridge?[]:[[e.from,lo,1],[e.to,hi,-1]].filter(([id])=>incidence.get(id).length>=3).map(([id,end,sign])=>({id:e.id+':crossing:'+id,nodeId:id,streetId:e.id,end,sign,d:end-sign*2.1,center:[e.a[0]+u[0]*(end-sign*2.1),e.a[1]+u[1]*(end-sign*2.1)],u,n,width:e.width,depth:2.5}));
      return {edge:e,length,u,n,lo,hi,crossings};
    });
  }

  'use strict';
  root.CityRoadMarkings=function(T,C,city){
    const position=[],metric=[],colors=[],indices=[],white=new T.Color('#e4dfcc').convertSRGBToLinear(),yellow=new T.Color('#d9b76c').convertSRGBToLinear();
    // Metric strip primitive adapted from the pinned MIT source. All strips share one mesh.
    function strip(a,b,width,color,period=1,duty=1){
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.05)return;
      const sx=(a[1]-b[1])/len*width*.5,sz=(b[0]-a[0])/len*width*.5,start=position.length/3;
      for(const [x,z,side,d] of [[a[0],a[1],-1,0],[a[0],a[1],1,0],[b[0],b[1],1,len],[b[0],b[1],-1,len]]){
        position.push(x+sx*side,8.025,z+sz*side);metric.push(d,period,duty);colors.push(color.r,color.g,color.b);
      }
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    const layouts=roadLayout(C,city);
    let crossings=0;
    for(const leg of layouts){
      const {edge:e,length,u,n}=leg,ends=city.publicRealm?city.publicRealm.crossings.filter(c=>c.streetId===e.id):leg.crossings;
      const lo=ends.find(c=>c.sign===1)?.end??leg.lo,hi=ends.find(c=>c.sign===-1)?.end??leg.hi;
      if(hi-lo<3)continue;
      const at=(d,side=0)=>[e.a[0]+u[0]*d+n[0]*side,e.a[1]+u[1]*d+n[1]*side];
      if(e.class!=='local'){
        strip(at(lo,-.16),at(hi,-.16),.12,yellow);strip(at(lo,.16),at(hi,.16),.12,yellow);
        if(e.width>=18)for(const side of [-1,1])strip(at(lo,side*3.25),at(hi,side*3.25),.12,white,10,.32);
        for(const side of [-1,1])strip(at(lo,side*(e.width*.5-1.9)),at(hi,side*(e.width*.5-1.9)),.12,white);
      }
      for(const {id,end,sign,d} of ends){
        for(let side=-e.width/2+.7;side<e.width/2-.3;side+=1.3)strip(at(d-1.25,side),at(d+1.25,side),.6,white);
        strip(at(end+sign*.8,sign*.25),at(end+sign*.8,sign*(e.width*.5-.5)),.38,white);crossings++;
      }
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('paintMetric',new T.Float32BufferAttribute(metric,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.94,side:T.DoubleSide});
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute vec3 paintMetric; varying vec3 vPaintMetric;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaintMetric=paintMetric;');
      shader.fragmentShader='varying vec3 vPaintMetric;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(vPaintMetric.z<.99 && fract(vPaintMetric.x/vPaintMetric.y)>vPaintMetric.z)discard;');
    };
    material.customProgramCacheKey=()=> 'cityworks-road-markings-v3';
    const mesh=new T.Mesh(geometry,material);mesh.name='road-markings';mesh.receiveShadow=true;
    return {mesh,crossings,strips:position.length/12};
  };
  root.CityRoadMarkings.layout=roadLayout;
  if(typeof module!=='undefined')module.exports=root.CityRoadMarkings;
})(globalThis);
