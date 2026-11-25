'use strict';
(function(s){
const K='clea.public.history.v2',q=JSON.stringify,fit=(v,n)=>String(v||'').slice(0,n);
function memory(session,local){
 function read(store){try{const raw=store?.getItem(K);if(raw==null)return null;const a=JSON.parse(raw);if(!Array.isArray(a)||a.length%2||a.some((x,i)=>x?.role!==(i%2?'assistant':'user')||typeof x.content!=='string'))return null;return a.slice(-80).map(x=>({role:x.role,content:fit(x.content,x.role==='user'?1200:1600)}));}catch{return null;}}
 const persisted=read(local),current=read(session);let rows=current??persisted??[];
 function write(store,value){try{if(value===null)store?.removeItem(K);else store?.setItem(K,q(value));}catch{}}
 function save(persist){write(session,rows);write(local,persist?rows:null);}
 const normalize=x=>String(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const words=x=>[...new Set(normalize(x).match(/[\p{L}\p{N}_]{4,}/gu)||[])].filter(w=>!['kako','mozes','moze','koji','koja','koliko','treba','napravi','aplikaciju','this','that','what','with','please'].includes(w));
 return {saved:persisted!==null,all:()=>rows.map(x=>({...x})),save,add(user,reply,persist){rows.push({role:'user',content:fit(user,1200)},{role:'assistant',content:fit(reply,1600)});rows=rows.slice(-80);save(persist);},clear(){rows=[];write(session,null);write(local,null);},wire:()=>rows.slice(-6).map(x=>({...x,content:fit(x.content,800)})),recall(question){const terms=words(question);if(!terms.length)return '';const older=rows.slice(0,Math.max(0,rows.length-6));const pairs=[];for(let i=0;i<older.length;i+=2){const pair=older.slice(i,i+2);const tokens=new Set(words(pair.map(x=>x.content).join(' ')));const score=terms.filter(w=>tokens.has(w)).length;if(score)pairs.push({pair,score,i});}return pairs.sort((a,b)=>b.score-a.score||b.i-a.i).slice(0,2).map(({pair})=>pair.map(x=>x.role+': '+fit(x.content,200)).join('\n')).join('\n').slice(0,420);}};
}
const catalog=()=>s.CLEA7StudioTools?.manifest?.().tools||[];
function chatQuestion(question,mem){
 const prefix='BL CLEA 7 context: you are the conversation model inside CLEA Studio. The browser orchestrator can invoke verified BIL, Draw, Runtime and Sense tools after planning; you do not directly execute them. BIL is the typed original language. Draw creates screens, controls, vectors, 2D/3D scenes. Runtime compiles, runs and tests. Sense provides accessible speech, OCR and documents with permission. Studio exports CLEA7/BIL/web and Android projects; APK needs a local toolchain. Ask for an application or modification in this conversation; verified proposals are shown for review. Never claim a tool succeeded without evidence. Registered tools: '+catalog().map(t=>t.id).join(', ')+'.';
 const recall=mem?.recall(question)||'';return prefix+(recall?'\nOlder conversation context: '+recall:'')+'\nAnswer in user language. User: '+question;
}
const schema='project.create(screen,title[,grammar]); screen.add(screen,title); object.remember(object,field,type,value); object.derive(object,field,expression[,whenTrue,whenFalse]); object.action(object,field,action,expression[,label]); object.label(object,field,label); ui.add(spec); ui.collection(spec); ui.compose(screen,nodes[,parent]); ui.style(target,style); ui.label(target,label); ui.move(target,parent); ui.duplicate(target); ui.remove(target); draw.add(spec); draw.position(object,x,y); draw.proximity(object,actor,radius); scene.add(screen,id); depth.transform(target[,origin,extent,rotation,surface,tint]); depth.from-drawing(drawing,world,id,origin,extent[,rotation,surface,tint]); resource.declare(id,kind); sense.cv(); sense.ocr(screen,id[,language,label]); bil.declaration(source); bil.event(source); bil.item(screen,source).';
function toolPrompt(intent,c){
 const st=c.structure||{},ctx={screens:[...(st.screens||[])],state:[...(st.state||[])],events:[...(st.events||[])],components:(st.components||[]).map(({id,key,kind,label,screen})=>({id,key,kind,label,screen})),grammar:st.grammar,objectModel:st.objectModel};
 const registered=new Set(catalog().map(t=>t.id));if(!registered.size)throw Error('Studio registar alata nije učitan.');
 const activeSchema=schema.split('; ').filter(t=>registered.has(t.split('(')[0])).join('; ');
 const intro='Plan actual CLEA tools. Return only complete JSON {"format":"clea7.studio-tools/1","operations":[{"tool":"...","...":"..."}]}. '+(c.mode==='change'?'Edit existing project; do not create or replace it. Use existing keys.':'First project.create or sense.cv; implement functional controls.')+' ASCII names. Every operation must compile. '+activeSchema+' ui.add spec={screen,id,label,kind}; draw.add spec={screen,id,label,role,x,y,width,height}; ui.compose nodes={kind,id,label,children}. BIL declaration: let n = 0; event: on inc { n = n + 1 }. No external effects.';
 const tail=(c.diagnostic?'\nRepair: '+fit(c.diagnostic,180):'')+'\nTask: '+intent;
 while(q(ctx).length>Math.max(150,2950-intro.length-tail.length)){if(ctx.components.length)ctx.components.pop();else if(ctx.state.length>2)ctx.state.pop();else if(ctx.events.length>2)ctx.events.pop();else if(ctx.screens.length>1)ctx.screens.pop();else if(ctx.objectModel)delete ctx.objectModel;else break;}
 const p=intro+(c.mode==='change'?'\nProject: '+q(ctx):'')+tail;if(p.length>3000)throw Error('Opis je predug za model.');return p;
}
async function generateTools(intent,{authoring,signal,ask=s.CLEA7PublicPlan?.requestText}={}){
 if(typeof ask!=='function')throw Error('CLEA transport za Studio alate nije učitan.');
 const r=await ask(toolPrompt(intent,authoring),{signal});
 return r;
}
function classify(question,hasProject,lastIntent){
 const w=question.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/^(kako|sta je|objasni|zasto|what|why)\b/.test(w))return null;
 if(hasProject&&/\b(dodaj|promijeni|izmijeni|uredi|pomjeri|ukloni|oboj|povecaj|smanji|popravi|change|add|edit|move|remove|fix)\b/.test(w))return 'change';
 if(/\b(napravi|kreiraj|izradi|hocu|zelim|create|build|make|generate)\b/.test(w)&&/\b(aplikacij\w*|app|application|igr\w*|game|program\w*|rokovnik|planer|kalendar|dnevnik|ekran\w*|scen\w*|cv|ocr|3d)\b/.test(w))return 'create';
 if(lastIntent&&/^(?:\d+|jedan|dva|tri|cetiri|pet|sest|sedam|osam|devet|deset)\s+ekran/.test(w))return 'create';
 return null;
}
const specialized=x=>/\b(3d|ocr|sense|cv|igr[auie]|game|fizik\w*|physics|vektor\w*|vector|objekt\w*|mesh|scen\w*)\b/i.test(x);
s.CLEA7PublicBrain=Object.freeze({memory,chatQuestion,toolPrompt,generateTools,classify,specialized,catalog});
})(globalThis);
