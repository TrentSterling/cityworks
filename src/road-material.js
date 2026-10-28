/* Dry-road material adapted from the MIT-licensed hash2D/noise2D,
 * utility-cut patch and two-scale aggregate portions of tsl-materials.js in
 * mrdoob/slop-newyork @ 13dd142b480bcfa01a6b18e36127c87e41cb4d80.
 * Copyright (c) 2026 Mr.doob. Full terms: vendor/slop-newyork-MIT.txt.
 * Ported from TSL to GLSL for Three.js r140. No geographic data, wet-road,
 * reflection, pothole or audio systems are included.
 */
(function(root){
  root.CityRoadMaterial=function(T){
    const material=new T.MeshStandardMaterial({roughness:.94,metalness:0});
    material.onBeforeCompile=s=>{
      s.uniforms.cwAsphaltDark={value:new T.Color(0x44474a).convertSRGBToLinear()};
      s.uniforms.cwAsphaltLight={value:new T.Color(0x575b5e).convertSRGBToLinear()};
      s.vertexShader='varying vec3 cwRoadWorld;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncwRoadWorld=(modelMatrix*vec4(position,1.0)).xyz;');
      s.fragmentShader=`
        varying vec3 cwRoadWorld;
        uniform vec3 cwAsphaltDark;
        uniform vec3 cwAsphaltLight;
        float cwHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float cwNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(cwHash(i),cwHash(i+vec2(1,0)),u.x),mix(cwHash(i+vec2(0,1)),cwHash(i+vec2(1,1)),u.x),u.y);}
      `+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 q=cwRoadWorld.xz;
        float px=max(.0001,length(fwidth(q)));
        float detail=1.0-smoothstep(22.0,240.0,length(cameraPosition-cwRoadWorld));
        float micro=mix(.5,cwNoise(q*16.0),1.0-smoothstep(.02,.06,px));
        float fine=mix(.5,cwNoise(q*3.2),1.0-smoothstep(.12,.4,px));
        float patchNoise=cwNoise(q*.18);
        float stain=smoothstep(.52,.84,cwNoise(q*.42))*detail;
        vec3 asphalt=mix(cwAsphaltDark,cwAsphaltLight,.22+fine*.23+micro*.28+patchNoise*.05)*(1.0-stain*.055);
        vec2 cell=floor(q/24.0);
        float hasPatch=step(.82,cwHash(cell+vec2(3.7,8.1)));
        vec2 center=(cell+.5+(vec2(cwHash(cell+vec2(1.3,5.9)),cwHash(cell+vec2(9.2,2.4)))-.5)*.4)*24.0;
        vec2 halfSize=vec2(cwHash(cell+vec2(4.4,.6))*1.8+.6,cwHash(cell+vec2(7.8,3.1))*1.4+.5);
        vec2 edge=abs(q-center)-halfSize;
        float distance=max(edge.x,edge.y),cover=(1.0-smoothstep(-px,px,distance))*hasPatch*detail;
        float sealWidth=max(.022,px*.75),seal=(1.0-smoothstep(sealWidth,sealWidth+px,abs(distance)))*(.022/sealWidth)*hasPatch*detail;
        float fresh=step(.55,cwHash(cell+vec2(12.9,6.6)));
        diffuseColor.rgb=mix(asphalt,asphalt*mix(1.035,.92,fresh),cover)*(1.0-seal*.2);
      `);
    };
    material.customProgramCacheKey=()=> 'cityworks-slop-dry-asphalt-v2';
    return material;
  };
})(globalThis);
