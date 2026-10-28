/* Original Cityworks editor controller. The validated project owns all edits. */
(function(){
  'use strict';
  const P=CityProject,$=id=>document.getElementById(id),frame=$('preview');
  const savedKey='cityworks:scoped-project:1',previewKey='cityworks:editor-preview:'+crypto.randomUUID();
  let session=new P.Session(),blockId,buildingId,busy=false,previewNumber=0,startupError='';
  try{const saved=localStorage.getItem(savedKey);if(saved)session=new P.Session(JSON.parse(saved));}catch(e){startupError='Saved project could not be loaded: '+e.message;}
  function api(){return frame.contentWindow?.Integration;}
  function message(text,error=false){$('status').textContent=text;$('status').className=error?'error':'';}
  function setBusy(value){busy=value;$('busy').hidden=!value;document.querySelectorAll('button,select,input').forEach(e=>e.disabled=value);if(!value)sync();}
  function entries(){return session.city.buildings.filter(b=>b.blockId===blockId);}
  function chooseDefaults(){
    if(!session.city.buildings.some(b=>b.blockId===blockId)){
      const options=session.city.blocks.filter(b=>session.city.buildings.filter(x=>x.blockId===b.id).length>=6);
      options.sort((a,b)=>Math.hypot(...CityFabric.center(a.polygon))-Math.hypot(...CityFabric.center(b.polygon)));
      blockId=(options[0]||session.city.blocks.find(b=>session.city.buildings.some(x=>x.blockId===b.id))).id;
    }
    if(!entries().some(b=>b.id===buildingId))buildingId=entries()[0]?.id;
  }
  function option(id,text){const o=document.createElement('option');o.value=id;o.textContent=text;return o;}
  function highlight(){api()?.highlightSelection(blockId,buildingId);}
  function sync(){
    chooseDefaults();const city=session.city,buildings=entries();
    $('block').replaceChildren(...city.blocks.filter(b=>city.buildings.some(x=>x.blockId===b.id)).map(b=>option(b.id,b.islandId.replace('island:','')+' / '+b.id.split(':').at(-1))));$('block').value=blockId;
    $('building').replaceChildren(...buildings.map(b=>option(b.id,(session.project.locks[b.id]?'Locked · ':'')+b.id.split(':')[1]+' · '+b.height+' m')));$('building').value=buildingId;
    const building=city.buildings.find(b=>b.id===buildingId),locked=!!session.project.locks[buildingId],count=buildings.filter(b=>session.project.locks[b.id]).length;
    $('block-info').textContent=buildings.length+' buildings · '+count+' locked · '+(building?.district||'');
    $('height').value=building?.height||'';$('height').disabled=busy||locked;$('apply-height').disabled=busy||locked;$('clear-height').disabled=busy||locked||!Object.hasOwn(session.project.heightOverrides,buildingId);
    $('lock').textContent=locked?'Unlock building':'Lock building';$('reroll').disabled=busy||count===buildings.length;
    $('undo').disabled=busy||!session.past.length;$('redo').disabled=busy||!session.future.length;
    highlight();
  }
  function focus(){
    const block=session.city.blocks.find(b=>b.id===blockId),[x,z]=CityFabric.center(block.polygon),radius=Math.max(90,...block.polygon.map(p=>Math.hypot(p[0]-x,p[1]-z)*1.6));
    api()?.setCamera([x+radius*.65,70+radius*.6,z+radius*.8],[x,10,z]);
  }
  async function preview(project,pose){
    api()?.dispose();sessionStorage.setItem(previewKey,JSON.stringify(project));
    const token=++previewNumber;frame.src='../three-island-integration/?embed=1&project='+encodeURIComponent(previewKey)+'&view=district&preview='+token;
    const began=performance.now();
    await new Promise((resolve,reject)=>{const timer=setInterval(()=>{
      const child=frame.contentWindow,current=new URLSearchParams(child?.location.search).get('preview')===String(token),problem=current&&child?.document?.getElementById('error')?.textContent;
      if(problem){clearInterval(timer);reject(Error(problem));}
      else if(current&&child?.Integration?.ready){clearInterval(timer);resolve();}
      else if(performance.now()-began>90000){clearInterval(timer);reject(Error('Preview timed out. The project was not changed.'));}
    },50);});
    if(pose){api().setView(pose.view);api().setCamera(pose.camera,pose.target);api().cityBuildings.group.visible=pose.buildingsVisible;$('toggle').textContent=pose.buildingsVisible?'Hide buildings':'Show buildings';}
    frame.contentWindow.addEventListener('cityworks-selection',event=>{
      if(busy||!event.detail.buildingId)return;const b=session.city.buildings.find(b=>b.id===event.detail.buildingId);if(!b)return;
      blockId=b.blockId;buildingId=b.id;sync();message('Selected '+b.id.split(':')[1]+'.');
    });
  }
  async function change(action,label){
    if(busy)return false;const pose=api()?.inspect();if(pose)pose.buildingsVisible=api().cityBuildings.group.visible;setBusy(true);message(label+'...');
    await new Promise(requestAnimationFrame);
    let rendered=false;
    try{
      const next=session.fork();if(!action(next)){message('No change.');return false;}
      const start=performance.now();if(next.city.dependencies.buildings!==session.city.dependencies.buildings){await preview(next.project,pose);rendered=true;}
      if(api().city.dependencies.buildings!==next.city.dependencies.buildings)throw Error('Preview and project data disagree');
      session=next;chooseDefaults();
      try{localStorage.setItem(savedKey,session.save());message(label+' · '+(session.lastChange?.buildingIds.length||0)+' buildings changed · '+Math.round(performance.now()-start)+' ms preview');}
      catch(e){message(label+' applied. Browser save failed; use Save project.',true);}
      return true;
    }catch(e){
      message(e.message,true);
      if(rendered||!api()?.ready){try{await preview(session.project,pose);}catch(restore){message('Preview unavailable; project retained. '+restore.message,true);}}
      return false;
    }finally{setBusy(false);}
  }
  function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('block').onchange=()=>{blockId=$('block').value;buildingId=null;sync();focus();};
  $('building').onchange=()=>{buildingId=$('building').value;sync();};
  $('focus').onclick=focus;
  $('reroll').onclick=()=>change(s=>s.apply({type:'rerollBlock',blockId}),'Rerolled selected block');
  $('lock').onclick=()=>change(s=>s.apply({type:'setLock',buildingId,locked:!s.project.locks[buildingId]}),session.project.locks[buildingId]?'Unlocked building':'Locked building');
  $('apply-height').onclick=()=>change(s=>s.apply({type:'setHeight',buildingId,height:Number($('height').value)}),'Applied height');
  $('clear-height').onclick=()=>change(s=>s.apply({type:'clearHeight',buildingId}),'Restored generated height');
  $('undo').onclick=()=>change(s=>s.undo(),'Undone');$('redo').onclick=()=>change(s=>s.redo(),'Redone');
  $('save').onclick=()=>download(session.project,'cityworks-project.json');
  $('export').onclick=()=>download(P.exportCity(session.project),'cityworks-scene.json');
  $('new').onclick=()=>change(s=>s.import(P.create()),'Opened default project');
  $('load').onclick=()=>$('load-file').click();
  $('load-file').onchange=async()=>{const file=$('load-file').files[0];if(!file)return;try{if(file.size>250000)throw Error('Load an editable project smaller than 250 KB, not the full scene export');const source=JSON.parse(await file.text());await change(s=>s.import(source),'Loaded project');}catch(e){message(e.message,true);}finally{$('load-file').value='';}};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>api()?.setView(b.dataset.view));
  $('toggle').onclick=()=>{const group=api()?.cityBuildings.group;if(group){group.visible=!group.visible;$('toggle').textContent=group.visible?'Hide buildings':'Show buildings';}};
  addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();}});
  addEventListener('pagehide',()=>{api()?.dispose();sessionStorage.removeItem(previewKey);});
  window.MassingEditor={get session(){return session;},get blockId(){return blockId;},get buildingId(){return buildingId;},get busy(){return busy;},api,change};
  chooseDefaults();setBusy(true);
  preview(session.project).then(()=>{setBusy(false);focus();message(startupError||'Select a building in the preview or choose a block.',!!startupError);}).catch(e=>{setBusy(false);message(e.message,true);});
})();
