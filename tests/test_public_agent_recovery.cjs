'use strict';
const assert=require('node:assert/strict');
require('../studio/workbench/bil-compiler.js');
require('../studio/workbench/public-studio-agent.js');
const agent=globalThis.CLEA7PublicStudioAgent;
(async()=>{
 const signal={aborted:false},calls=[];
 await assert.rejects(agent.generate('Napravi aplikaciju podsjetnik',{signal,ask:async question=>{
  calls.push(question);
  if(question.includes('Plan only the app title'))return {reply:'TITLE|Podsjetnik\nPAGE|home|Podsjetnik|manage notes\nEND'};
  if(question.includes('Plan data and actions')){
   if(question.includes('Ignore the earlier'))return {reply:'{"v":[["noteText","Text"]],"e":[["saveNote","save note"]]}'};
   return {reply:'V|noteText|Text\nE|saveNote|save note'};
  }
  signal.aborted=true;throw Error('stop after recovered phase');
 }}),/zaustavljena/);
 assert.equal(calls.length,5);
 assert.match(calls[3],/complete JSON object shape/);
 assert.match(calls[4],/Write event saveNote/);
 assert.throws(()=>agent.phaseJSON('1b','{"v":[["noteText","Text"]],"e":['));
 assert.throws(()=>agent.phaseJSON('1b','{"v":[["bad|field","Text"]],"e":[["save","save"]]}'));
 console.log('PASS missing END recovery, complete alternate JSON, rejected truncated JSON, continued to event.');
})().catch(error=>{console.error(error);process.exitCode=1;});
