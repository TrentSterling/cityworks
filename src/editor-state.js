/* Original Cityworks project transactions. No DOM, renderer or engine types. */
(function(root){
  'use strict';
  const C=typeof module!=='undefined'?require('./building-plan.js'):root.CityFabric;
  const VERSION='0.4.1-planned-fabric',clone=x=>JSON.parse(JSON.stringify(x));
  const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
  const axes={units:'metres',x:'east',y:'up',z:'south',polygonCoordinates:['x','z']};
  const candidates=new WeakSet();
  function changedBuildings(before,after){
    const old=new Map(before.buildings.map(b=>[b.id,JSON.stringify(b)])),current=new Set(after.buildings.map(b=>b.id));
    return [...after.buildings.filter(b=>old.get(b.id)!==JSON.stringify(b)).map(b=>b.id),...before.buildings.filter(b=>!current.has(b.id)).map(b=>b.id)];
  }
  function object(x,label){if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Expected '+label);return x;}
  function normalize(source){
    object(source,'project');
    if(source.schema!=='cityworks.project'||source.version!==1)throw Error('Unsupported project schema/version');
    if(source.generatorVersion!==VERSION)throw Error('Project needs an explicit generator migration');
    if(!source.coordinates||Object.keys(axes).some(k=>JSON.stringify(source.coordinates[k])!==JSON.stringify(axes[k])))throw Error('Unsupported coordinate convention');
    const allowed=['seed','coastVariation','streetSpacing','bridgeWidth','density','skylineHeight'];
    object(source.input,'input');for(const [key,value] of Object.entries(source.input)){if(!allowed.includes(key))throw Error('Unsupported input '+key);if(key==='seed'?typeof value!=='string':!Number.isFinite(value))throw Error('Invalid input '+key);}
    const p={schema:'cityworks.project',version:1,generatorVersion:VERSION,coordinates:clone(axes),input:clone(source.input),massingRevisions:{},heightOverrides:{},locks:{}};
    for(const key of ['massingRevisions','heightOverrides','locks']){
      const values=object(source[key],key);if(Object.keys(values).length>2000)throw Error('Too many '+key);
      for(const [id,v] of Object.entries(values)){
        if(!/^parcel:[a-f0-9]+:building$/.test(id))throw Error('Invalid building identity '+id);
        if(key==='massingRevisions'&&(!Number.isSafeInteger(v)||v<0||v>1000000))throw Error('Invalid massing revision');
        if(key==='heightOverrides'&&(!Number.isFinite(v)||v<6||v>180))throw Error('Height must be 6 to 180 metres');
        if(key==='locks'&&v!==true)throw Error('Lock values must be true');
        p[key][id]=v;
      }
    }
    return p;
  }
  function create(input={}){return normalize({schema:'cityworks.project',version:1,generatorVersion:VERSION,coordinates:axes,input,massingRevisions:{},heightOverrides:{},locks:{}});}
  function compile(source){
    const p=normalize(source),edits=Object.fromEntries(Object.entries(p.heightOverrides).map(([id,height])=>[id,{height}]));
    const city=C.generate(p.input,edits,p.massingRevisions),known=new Set(city.buildings.map(b=>b.id));
    for(const id of Object.keys(p.locks))if(!known.has(id))throw Error('Locked building no longer exists: '+id);
    return city;
  }
  function exportCity(source){
    const project=normalize(source),city=compile(project);
    return {...city,coordinates:clone(axes),authoring:project,exportContract:{schema:'cityworks.scene',version:1,generatorVersion:VERSION,geometry:'metre-space polygon rings and explicit volume elevations',materialPolicy:'symbolic IDs require an engine-specific material binding',colliderPolicy:'extruded polygon proxies; not cooked Unity colliders'},
      materials:[0,1,2,3].map(index=>({id:'facade:nyc:'+index,previewFacadeIndex:index,source:'slop-newyork MIT adapter'})),
      colliders:city.buildings.flatMap(b=>b.volumes.map(v=>({id:v.id+':collider',buildingId:b.id,volumeId:v.id,kind:'extrudedPolygonSet',polygons:clone(v.polygons),bottom:v.baseElevation,top:v.topElevation}))),
      volumeMaterials:city.buildings.flatMap(b=>b.volumes.map(v=>({volumeId:v.id,materialId:'facade:nyc:'+v.facadeIndex})))};
  }
  class Session{
    constructor(source=create()) {this.project=freeze(normalize(source));this.city=compile(this.project);this.past=[];this.future=[];this.lastChange=null;}
    prepare(command){
      const next=clone(this.project),city=this.city;object(command,'command');
      const b=command.buildingId?city.buildings.find(b=>b.id===command.buildingId):null;
      if(command.type==='rerollBlock'){
        const buildings=city.buildings.filter(b=>b.blockId===command.blockId);if(!buildings.length)throw Error('Select a block with buildings');
        for(const item of buildings)if(!next.locks[item.id])next.massingRevisions[item.id]=(next.massingRevisions[item.id]||0)+1;
      }else if(command.type==='setLock'){
        if(!b||typeof command.locked!=='boolean')throw Error('Invalid building lock');
        if(command.locked)next.locks[b.id]=true;else delete next.locks[b.id];
      }else if(command.type==='setHeight'||command.type==='clearHeight'){
        if(!b)throw Error('Select a building');if(next.locks[b.id])throw Error('Unlock this building before editing it');
        if(command.type==='clearHeight')delete next.heightOverrides[b.id];else next.heightOverrides[b.id]=command.height;
      }else throw Error('Unsupported command '+command.type);
      const candidate=this.candidate(next,command.type);
      if(candidate&&command.type==='rerollBlock'){
        if(candidate.changed.some(id=>next.locks[id]||city.buildings.find(b=>b.id===id)?.blockId!==command.blockId))throw Error('Reroll escaped selected scope');
        for(const key of ['islands','streets','bridges','blocks','parcels'])if(JSON.stringify(city[key])!==JSON.stringify(candidate.city[key]))throw Error('Massing edit changed '+key);
      }
      return candidate;
    }
    candidate(source,label){
      const project=normalize(source);if(JSON.stringify(project)===JSON.stringify(this.project))return null;
      const city=compile(project),changed=changedBuildings(this.city,city);
      const prepared=freeze({project,city,label,changed,base:JSON.stringify(this.project)});candidates.add(prepared);return prepared;
    }
    commit(candidate){
      if(!candidate)return false;if(!candidates.has(candidate))throw Error('Unvalidated edit transaction');if(candidate.base!==JSON.stringify(this.project))throw Error('Stale edit transaction');candidates.delete(candidate);
      this.past.push(clone(this.project));if(this.past.length>30)this.past.shift();this.future=[];
      this.project=candidate.project;this.city=candidate.city;this.lastChange={label:candidate.label,buildingIds:candidate.changed};return true;
    }
    apply(command){return this.commit(this.prepare(command));}
    import(source){return this.commit(this.candidate(source,'loadProject'));}
    undo(){return this.travel(this.past,this.future,'undo');}
    redo(){return this.travel(this.future,this.past,'redo');}
    travel(from,to,label){
      if(!from.length)return false;const next=from[from.length-1],city=compile(next),buildingIds=changedBuildings(this.city,city);
      to.push(clone(this.project));from.pop();this.project=freeze(clone(next));this.city=city;this.lastChange={label,buildingIds};return true;
    }
    fork(){const copy=new Session(this.project);copy.past=clone(this.past);copy.future=clone(this.future);copy.lastChange=clone(this.lastChange);return copy;}
    save(){return JSON.stringify(this.project,null,2);}
  }
  const api={VERSION,create,normalize,compile,exportCity,Session};
  if(typeof module!=='undefined')module.exports=api;root.CityProject=api;
})(typeof globalThis!=='undefined'?globalThis:this);
