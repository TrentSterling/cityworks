import {Euler,Vector3} from 'three/webgpu';

// Preview navigation only. No document shortcuts, pointer lock or operating-system input.
export class ViewportNavigation {
  constructor(camera,canvas,orbit){
    this.camera=camera;this.canvas=canvas;this.orbit=orbit;this.mode='fly';this.keys=new Set();this.looking=false;this.speed=16;this.velocity=new Vector3();this.euler=new Euler(0,0,0,'YXZ');this.listeners=[];
    canvas.tabIndex=0;canvas.setAttribute('aria-label','City viewport. WASD move, hold right mouse button to look, Q and E down and up, Shift faster.');orbit.enabled=false;
    const on=(target,type,fn,options)=>{target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options));};
    const typing=target=>target?.isContentEditable||target?.closest?.('input,textarea,select');
    on(window,'keydown',e=>{
      if(e.code==='Escape'){this.reset();return;}
      if(this.mode!=='fly'||typing(e.target)||e.ctrlKey||e.metaKey||e.altKey||(e.repeat&&!this.keys.has(e.code)))return;
      if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){this.keys.add(e.code);e.preventDefault();}
    });
    on(window,'keyup',e=>this.keys.delete(e.code));
    on(window,'blur',()=>this.reset());on(window,'focusin',e=>{if(typing(e.target))this.reset();});
    on(document,'visibilitychange',()=>{if(document.hidden)this.reset();});
    on(canvas,'contextmenu',e=>e.preventDefault());
    on(canvas,'pointerdown',e=>{
      if(e.button!==2||this.mode!=='fly')return;e.preventDefault();canvas.focus({preventScroll:true});
      this.looking=true;this.pointer=e.pointerId;this.last=[e.clientX,e.clientY];this.euler.setFromQuaternion(camera.quaternion,'YXZ');canvas.setPointerCapture(e.pointerId);
    });
    on(canvas,'pointermove',e=>{
      if(!this.looking||e.pointerId!==this.pointer)return;
      const dx=e.clientX-this.last[0],dy=e.clientY-this.last[1];this.last=[e.clientX,e.clientY];
      this.euler.y-=dx*.0025;this.euler.x=Math.max(-1.52,Math.min(1.52,this.euler.x-dy*.0025));this.euler.z=0;
      camera.quaternion.setFromEuler(this.euler);this.followTarget();
    });
    on(window,'pointerup',e=>{if(e.button===2)this.releaseLook();});
    on(canvas,'pointercancel',()=>this.reset());on(canvas,'lostpointercapture',()=>{this.looking=false;this.pointer=null;});
    on(canvas,'wheel',e=>{if(this.mode!=='fly')return;e.preventDefault();const dir=camera.getWorldDirection(new Vector3());camera.position.addScaledVector(dir,-Math.max(-200,Math.min(200,e.deltaY))*.035);this.followTarget();},{passive:false});
  }
  followTarget(){this.orbit.target.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(new Vector3()),20);}
  releaseLook(){const id=this.pointer;this.looking=false;this.pointer=null;if(id!=null&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}
  reset(){this.keys.clear();this.velocity.set(0,0,0);this.releaseLook();}
  setMode(mode){if(!['fly','orbit'].includes(mode))throw Error('Unknown navigation mode');this.reset();this.mode=mode;this.orbit.enabled=mode==='orbit';if(mode==='orbit')this.orbit.update();return mode;}
  update(dt){
    this.velocity.set(0,0,0);if(this.mode!=='fly')return;
    const k=this.keys,forward=this.camera.getWorldDirection(new Vector3()),right=new Vector3(1,0,0).applyQuaternion(this.camera.quaternion);
    this.velocity.addScaledVector(forward,Number(k.has('KeyW'))-Number(k.has('KeyS'))).addScaledVector(right,Number(k.has('KeyD'))-Number(k.has('KeyA')));this.velocity.y+=Number(k.has('KeyE'))-Number(k.has('KeyQ'));
    if(this.velocity.lengthSq()){this.velocity.normalize().multiplyScalar(this.speed*(k.has('ShiftLeft')||k.has('ShiftRight')?3:1));this.camera.position.addScaledVector(this.velocity,Math.min(.05,Math.max(0,dt)));this.followTarget();}
  }
  inspect(){return {mode:this.mode,looking:this.looking,keys:[...this.keys],speed:this.velocity.length()};}
  dispose(){this.reset();this.listeners.forEach(off=>off());}
}
