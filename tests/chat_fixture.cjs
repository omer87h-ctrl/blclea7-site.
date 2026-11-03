'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(process.env.CLEA7_SOURCE_WEB||path.join(__dirname,'../web'),'workbench/chat');
module.exports=async function fixture(options={}){
 const s=require('./clea_ai_fixture.cjs')();for(const name of ['assets','neural','runtime'])vm.runInContext(fs.readFileSync(path.join(base,name+'.js'),'utf8'),s,{filename:'chat/'+name+'.js'});
 const read=name=>JSON.parse(fs.readFileSync(path.join(base,name+'.json'),'utf8')),manifest=read('manifest'),knowledge=read('knowledge'),model=s.CLEA7NeuralChat.create(read('model'));await model.verify();let controller=null,calls=0;
 const transport={initialize:async()=>model.describe(),generate:async(question,opts)=>{calls++;controller=new AbortController();try{return await model.generate(question,{...opts,signal:controller.signal});}finally{controller=null;}},cancel(){controller?.abort();},close(){controller?.abort();}};
 const runtime=s.CLEA7Chat.create({manifest,knowledge,transport,...options});return {s,runtime,model,manifest,knowledge,transport,get calls(){return calls;}};
};
