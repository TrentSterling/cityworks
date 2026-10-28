'use strict';
const assert=require('node:assert/strict'),P=require('../src/editor-state.js');
const text=x=>JSON.stringify(x),checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
const session=new P.Session(),base=text(session.city);
const block=session.city.blocks.find(b=>session.city.buildings.filter(x=>x.blockId===b.id).length>=6);
const members=session.city.buildings.filter(b=>b.blockId===block.id),locked=members[0],manual=members[1];
check('locks and manual height overrides survive scoped rerolls',()=>{
  session.apply({type:'setHeight',buildingId:manual.id,height:31});
  session.apply({type:'setLock',buildingId:locked.id,locked:true});
  const before=new Map(session.city.buildings.map(b=>[b.id,text(b)])),streets=text(session.city.streets),parcels=text(session.city.parcels);
  session.apply({type:'rerollBlock',blockId:block.id});
  assert.equal(session.city.buildings.find(b=>b.id===manual.id).height,31);
  assert.equal(text(session.city.streets),streets);assert.equal(text(session.city.parcels),parcels);
  for(const b of session.city.buildings){if(b.id===locked.id||b.blockId!==block.id)assert.equal(text(b),before.get(b.id));}
  assert.equal(session.lastChange.buildingIds.length,members.length-1);
});
check('undo and redo restore exact data and seed counters',()=>{
  const after=text(session.city),document=session.save();session.undo();assert.equal(session.project.massingRevisions[members[2].id],undefined);
  assert.equal(session.lastChange.buildingIds.length,members.length-1);
  session.redo();assert.equal(text(session.city),after);assert.equal(session.save(),document);
});
check('saved project reconstructs exact geometry, overrides and locks',()=>{
  const restored=new P.Session(JSON.parse(session.save()));assert.equal(text(restored.city),text(session.city));assert.deepEqual(restored.project,session.project);
});
check('invalid commands/imports are atomic and retain undo history',()=>{
  const before=session.save(),history=session.past.length;
  for(const cmd of [{type:'setHeight',buildingId:locked.id,height:40},{type:'setHeight',buildingId:manual.id,height:NaN},{type:'rerollBlock',blockId:'absent'},{type:'moveStreet'}])assert.throws(()=>session.apply(cmd));
  const invalid=JSON.parse(before);invalid.generatorVersion='future';assert.throws(()=>session.import(invalid));
  const wrong=JSON.parse(before);wrong.locks['parcel:00000000:building']=true;assert.throws(()=>session.import(wrong));
  assert.equal(session.save(),before);assert.equal(session.past.length,history);
});
check('stale prepared transactions reject and new edits clear redo',()=>{
  const candidate=session.prepare({type:'setHeight',buildingId:manual.id,height:34});
  session.apply({type:'setHeight',buildingId:manual.id,height:37});assert.throws(()=>session.commit(candidate),/Stale/);
  session.undo();assert.ok(session.future.length);session.apply({type:'clearHeight',buildingId:manual.id});assert.equal(session.future.length,0);
});
check('locked-only reroll is a no-op and cannot consume history',()=>{
  const s=new P.Session();for(const b of s.city.buildings.filter(b=>b.blockId===block.id))s.apply({type:'setLock',buildingId:b.id,locked:true});
  const count=s.past.length,doc=s.save();assert.equal(s.apply({type:'rerollBlock',blockId:block.id}),false);assert.equal(s.save(),doc);assert.equal(s.past.length,count);
});
check('engine-neutral export retains holes, material identities and collider volumes',()=>{
  const out=P.exportCity(session.project);assert.equal(out.coordinates.units,'metres');assert.equal(out.coordinates.y,'up');assert.equal(out.colliders.length,out.stats.volumes);
  assert.ok(out.colliders.some(c=>c.polygons.some(p=>p.holes.length)));
  assert.ok(out.volumeMaterials.every(v=>out.materials.some(m=>m.id===v.materialId)));
  assert.equal(text(new P.Session(out.authoring).city),text(session.city));
});
check('independent block order produces the same authored result',()=>{
  const other=session.city.buildings.find(b=>b.blockId!==block.id).blockId,a=new P.Session(),b=new P.Session();
  for(const id of [block.id,other])a.apply({type:'rerollBlock',blockId:id});
  for(const id of [other,block.id])b.apply({type:'rerollBlock',blockId:id});
  assert.equal(text(a.city),text(b.city));assert.equal(base,text(new P.Session().city));
});
check('scoped rerolls cover courtyards, harbour lots and alternate seeds',()=>{
  for(const seed of ['CITYWORKS-03','EDITOR-2','EDITOR-3']){
    const s=new P.Session(P.create({seed}));
    for(const profile of ['courtyard','service-court','garden-row']){
      const b=s.city.buildings.find(b=>b.profile===profile);if(!b)continue;
      const ids=s.city.buildings.map(b=>b.id);s.apply({type:'rerollBlock',blockId:b.blockId});assert.deepEqual(s.city.buildings.map(b=>b.id),ids);
    }
  }
});
console.log(JSON.stringify({status:'passed',groups:checks.length,selectedBuildings:members.length}));
