'use strict';
/* CLEA-side forum drafts only. Never posts, edits a forum, or creates accounts. */
(function(scope){
function create({client}={}){
 const connection=client||scope.CLEA7AI?.create();if(!connection?.ask||!connection?.reset)throw Error('Potreban je zaseban povezani CLEA klijent.');let busy=false;
 return Object.freeze({
  async draft(question,{confirmed=false,language='bs'}={}){
   if(confirmed!==true)throw Error('Prvo potvrdi tekst pitanja koji se šalje CLEA-i.');
   if(typeof question!=='string'||!question.trim()||question.length>1200||!['bs','en','auto'].includes(language))throw Error('Neispravan forum zahtjev.');
   if(busy)throw Error('Jedan forum zahtjev je već u toku.');busy=true;connection.reset();
   try{const answer=await connection.ask(question,{language});if(typeof answer.reply!=='string'||!answer.reply.trim())throw Error('CLEA nije vratila odgovor.');
    const sources=[...(answer.sources||[]),...(answer.webSources||[])].filter(row=>{try{const url=new URL(row.url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}).slice(0,5).map(row=>({title:String(row.title||row.path||'Izvor').slice(0,200),url:row.url}));
    return {format:'clea7.forum-ai-draft/1',aiGenerated:true,displayName:'BL CLEA AI',body:answer.reply,sources,requiresHumanReview:true,published:false};
   }finally{busy=false;connection.reset();}
  },cancel:()=>connection.cancel?.()
 });
}
scope.CLEA7ForumAI=Object.freeze({format:'clea7.forum-integration/1',create});
})(globalThis);
