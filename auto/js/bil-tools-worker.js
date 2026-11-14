'use strict';
/* Trusted original BIL implementation; user text goes only to the BIL parser. */
importScripts('./clea7/bil-compiler.js','./clea7/bil-runtime.js');
let used=false;
self.onmessage=async event=>{
 if(used)return;used=true;
 try{
  if(!event.data||event.data.protocol!=='blclea.bil-worker/1')throw Object.assign(new Error('Nepodržan zahtjev BIL radnika.'),{code:'BIL_TOOLS_PROTOCOL'});
  const {executeBILTool}=await import('./bil-tools-bridge.js');
  const result=await executeBILTool(event.data.payload);
  self.postMessage({protocol:'blclea.bil-worker/1',ok:true,result});
 }catch(error){
  self.postMessage({protocol:'blclea.bil-worker/1',ok:false,error:{code:String(error?.code||'BIL_TOOLS_RUNTIME').slice(0,100),message:String(error?.message||'BIL izvršavanje nije uspjelo.').slice(0,1200),location:error?.location??null,bilTrace:Array.isArray(error?.bilTrace)?error.bilTrace:[]}});
 }
};
