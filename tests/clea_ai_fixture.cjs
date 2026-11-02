'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
module.exports=function load(){
 const context={crypto:webcrypto,performance,TextEncoder,TextDecoder,URL,Blob,AbortController,Date,setTimeout,clearTimeout,console,btoa:x=>Buffer.from(x,'binary').toString('base64'),atob:x=>Buffer.from(x,'base64').toString('binary')};context.globalThis=context;vm.createContext(context);
 for(const name of ['runtime','workbench/living','workbench/bil-compiler','workbench/bil-runtime','workbench/working-cache','workbench/clea-core','workbench/format','workbench/plan','workbench/review','workbench/publisher','workbench/package','workbench/engine','workbench/caci','workbench/clea-intent-model','workbench/clea-ai-engine'])vm.runInContext(fs.readFileSync(path.join(process.env.CLEA7_SOURCE_WEB||path.join(__dirname,'../web'),name+'.js'),'utf8'),context,{filename:name+'.js'});
 return context;
};
