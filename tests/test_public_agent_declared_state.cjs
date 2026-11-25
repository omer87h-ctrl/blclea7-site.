'use strict';
const assert=require('node:assert/strict');
for(const p of ['bil-compiler.js','bil-runtime.js','studio-operator.js','ai-authoring.js','public-studio-agent.js'])require('../studio/workbench/'+p);
(async()=>{
 const A=globalThis.CLEA7PublicStudioAgent,structure=A.outline({title:'Podsjetnik',v:[['noteText','Text']],e:[['show_home','open home'],['saveNote','save note']],s:[['home','Home','reminders'],['edit','Edit','edit reminder']]});
 assert.throws(()=>A.handler(A.eventRows('SET|prior|1\nEND'),structure.events[0],structure),/Dozvoljeni podaci: noteText/);
 const nav=A.handler(A.eventRows('OPEN|home\nEND'),structure.events[0],structure);
 const save=A.handler(A.eventRows('SET|noteText|"Sastanak"\nEXPECT|noteText|"Sastanak"\nEND'),structure.events[1],structure);
 assert.deepEqual(nav.test,{inputs:Object.create(null),expect:Object.create(null)});
 const plan={format:'clea7.authoring-plan/1',state:structure.state,backends:[],events:[nav,save].map(({name,steps})=>({name,steps})),screens:[{id:'home',title:'Home',items:[{kind:'button',label:'Save',runs:'saveNote'}]},{id:'edit',title:'Edit',items:[{kind:'button',label:'Home',runs:'show_home'}]}],start:'home'};
 const source=CLEA7AppAuthoring.emitPlan(plan).source,ir=CLEA7BIL.compile(source).ir;
 const first=await CLEA7BILRuntime.execute(ir,'show_home',{bilScreen:'edit',bilValues:{noteText:''},bilViews:[],bilMotion:[]});
 const second=await CLEA7BILRuntime.execute(ir,'saveNote',first.state);
 assert.equal(first.state.bilScreen,'home');assert.equal(second.state.bilValues.noteText,'Sastanak');
 console.log('PASS declared-state rejection, navigation without invented data and actual BIL Runtime execution.');
})().catch(e=>{console.error(e);process.exitCode=1});
