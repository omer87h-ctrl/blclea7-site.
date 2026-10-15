'use strict';
/* CLEA7 application/3: bounded presentation and explicit state transitions.
   Original implementation. No project text is evaluated as host code. */
(function(scope){
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const id=k=>typeof k==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(k)&&!['constructor','prototype','__proto__'].includes(k);
function object(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))throw Error('Neispravan Living ugovor.');}
const properties={opacity:[0,1],translateX:[-2000,2000],translateY:[-2000,2000],scale:[0,10],rotate:[-3600,3600]};
function validate(p,expression,definition){
 const components=p.components||{};object(components,Object.keys(components));if(Object.keys(components).length>40)throw Error('Biblioteka prelazi 40 komponenti.');for(const [key,c]of Object.entries(components)){if(!id(key))throw Error('Neispravan identitet komponente.');object(c,['name','root']);if(typeof c.name!=='string'||!c.name.trim()||c.name.length>80)throw Error('Neispravan naziv komponente.');definition(c.root);}
 const machines=p.machines||{},animations=p.animations||{};
 object(machines,Object.keys(machines));object(animations,Object.keys(animations));
 if(Object.keys(machines).length>20||Object.keys(animations).length>40)throw Error('Previše state machines ili animacija.');
 const used=new Set(),nodes=new Set();function walk(ns){for(const n of ns){nodes.add(n.id);walk(n.children||[]);}}p.screens.forEach(s=>walk(s.children));
 for(const [name,m]of Object.entries(machines)){
  if(!id(name))throw Error('Neispravan identitet state machine.');object(m,['stateKey','initial','states']);
  if(!own(p.state,m.stateKey)||typeof p.state[m.stateKey]!=='string'||used.has(m.stateKey))throw Error('State machine treba vlastiti tekstualni podatak.');used.add(m.stateKey);
  object(m.states,Object.keys(m.states||{}));if(!Object.keys(m.states).length||Object.keys(m.states).length>32||!own(m.states,m.initial)||p.state[m.stateKey]!==m.initial)throw Error('Neispravno početno stanje machine.');
  for(const [state,def]of Object.entries(m.states)){if(!id(state))throw Error('Neispravno stanje machine.');object(def,['on']);object(def.on,Object.keys(def.on||{}));if(Object.keys(def.on).length>16)throw Error('Previše događaja.');
   for(const [event,transitions]of Object.entries(def.on)){if(!id(event)||!Array.isArray(transitions)||!transitions.length||transitions.length>8)throw Error('Neispravan prijelaz.');transitions.forEach((t,i)=>{object(t,['to','guard']);if(!own(m.states,t.to)||i<transitions.length-1&&!own(t,'guard'))throw Error('Neispravno odredište ili nedostižan prijelaz.');if(own(t,'guard'))expression(t.guard);});}
  }
 }
 for(const [name,a]of Object.entries(animations)){
  if(!id(name))throw Error('Neispravan identitet animacije.');object(a,['duration','iterations','easing','tracks']);
  if(!Number.isInteger(a.duration)||a.duration<16||a.duration>10000||!Number.isInteger(a.iterations)||a.iterations<1||a.iterations>5||!['linear','ease-in','ease-out','ease-in-out'].includes(a.easing)||!Array.isArray(a.tracks)||!a.tracks.length||a.tracks.length>32)throw Error('Animacija treba ograničeno trajanje, ponavljanja i trake.');
  const seen=new Set();for(const t of a.tracks){object(t,['target','property','frames']);const key=t.target+':'+t.property;if(!nodes.has(t.target)||!own(properties,t.property)||seen.has(key)||!Array.isArray(t.frames)||t.frames.length<2||t.frames.length>32)throw Error('Neispravna animacijska traka.');seen.add(key);let previous=-1;for(const f of t.frames){object(f,['at','value']);const range=properties[t.property];if(!Number.isInteger(f.at)||f.at<=previous||f.at>a.duration||!Number.isFinite(f.value)||f.value<range[0]||f.value>range[1])throw Error('Neispravan keyframe.');previous=f.at;}if(t.frames[0].at!==0||t.frames[t.frames.length-1].at!==a.duration)throw Error('Traka treba početni i završni keyframe.');}
 }
 function steps(xs){for(const x of xs){if(x.action==='animate'&&!own(animations,x.animation))throw Error('Animacija ne postoji.');if(x.action==='machine.event'){const m=machines[x.machine];if(!m||!id(x.event)||!Object.values(m.states).some(s=>own(s.on,x.event)))throw Error('Događaj state machine ne postoji.');}for(const k of ['then','else','steps'])if(x[k])steps(x[k]);}}Object.values(p.flows).forEach(steps);
 return p;
}
function upgrade(p){if(p.format!=='clea7.application/4')p.format='clea7.application/3';p.machines=p.machines||{};p.animations=p.animations||{};p.components=p.components||{};return p;}
function checkState(p,state){for(const m of Object.values(p.machines||{}))if(!own(m.states,state[m.stateKey]))throw Error('Sačuvano stanje machine nije kompatibilno. Potrebna je migracija.');}
function transition(p,x,ctx,evaluate){const m=p.machines[x.machine],from=ctx.state[m.stateKey],tested=[];if(!own(m.states,from))throw Error('State machine je u nepoznatom stanju.');let to=from;for(const t of m.states[from].on[x.event]||[]){const pass=!own(t,'guard')||Boolean(evaluate(t.guard,ctx));tested.push({to:t.to,guard:own(t,'guard'),passed:pass});if(pass){to=t.to;break;}}ctx.state[m.stateKey]=to;return {machine:x.machine,event:x.event,key:m.stateKey,from,to,tested};}
function valueAt(track,time){const fs=track.frames;if(time<=fs[0].at)return fs[0].value;if(time>=fs[fs.length-1].at)return fs[fs.length-1].value;const i=fs.findIndex(f=>f.at>=time),a=fs[i-1],b=fs[i];return a.value+(b.value-a.value)*(time-a.at)/(b.at-a.at);}
function pose(animation,time){const targets=new Map();for(const t of animation.tracks){if(!targets.has(t.target))targets.set(t.target,{});targets.get(t.target)[t.property]=valueAt(t,time);}return targets;}
function css(values){const out={};if(own(values,'opacity'))out.opacity=values.opacity;const transform=[];for(const k of ['translateX','translateY','scale','rotate'])if(own(values,k))transform.push(k+'('+values[k]+(k==='rotate'?'deg':k==='scale'?'':'px')+')');if(transform.length)out.transform=transform.join(' ');return out;}
function scrub(root,animation,time){for(const [id,values]of pose(animation,time))for(const node of root.querySelectorAll('[data-node-id]'))if(node.dataset.nodeId===id)Object.assign(node.style,css(values));}
function play(root,animation,reduced=false,already=0){const running=[],results=[];const times=[...new Set(animation.tracks.flatMap(t=>t.frames.map(f=>f.at)))].sort((a,b)=>a-b);for(const target of new Set(animation.tracks.map(t=>t.target))){const nodes=[...root.querySelectorAll('[data-node-id]')].filter(n=>n.dataset.nodeId===target);if(!nodes.length){results.push({target,status:'not-visible'});continue;}if(nodes.length+running.length+already>128){for(const node of nodes)Object.assign(node.style,css(pose(animation,animation.duration).get(target)));results.push({target,status:'static-budget',instances:nodes.length});continue;}for(const node of nodes){if(reduced||typeof node.animate!=='function'){Object.assign(node.style,css(pose(animation,animation.duration).get(target)));results.push({target,status:reduced?'reduced-motion':'static-fallback'});continue;}const frames=times.map(at=>({...css(pose(animation,at).get(target)),offset:at/animation.duration}));const instance=node.animate(frames,{duration:animation.duration,iterations:animation.iterations,easing:animation.easing,fill:'forwards'});running.push(instance);results.push({target,status:'playing'});}}return {running,results};}
scope.CLEA7Living={validate,upgrade,checkState,transition,valueAt,pose,css,scrub,play,properties};
})(globalThis);
