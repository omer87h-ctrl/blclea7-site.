'use strict';
/* A portable design brief is data, never executable code or a generated promise. */
(function(scope){
 const BRAND='Brzo i Lokalno × COWONDER',KEY='clea7.personal-brief.v1';
 function clean(value,max,label){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error(label+' nije ispravno upisan.');return value.trim();}
 function validate(value){
  if(!value||value.format!=='clea7.personal-brief/1')throw Error('Ovo nije CLEA zahtjev za ličnu aplikaciju.');
  const person=clean(value.person,50,'Ime korisnika'),needs=clean(value.needs,3000,'Opis aplikacije');
  if(!['copper','forest'].includes(value.palette)||!['row','column'].includes(value.layout))throw Error('Izaberi podržane boje i raspored.');
  return {format:'clea7.personal-brief/1',brand:BRAND,person,needs,palette:value.palette,layout:value.layout};
 }
 function describe(value){const b=validate(value);return BRAND+'\nLična aplikacija za: '+b.person+'\n\n'+b.needs+'\n\nBoje: '+(b.palette==='copper'?'CLEA · tamna podloga i bakar':'Svijetla podloga i šumska zelena')+'\nRaspored pregleda: '+(b.layout==='row'?'u jednom redu':'jedan ispod drugog')+'\n\nZahtjev za dizajn i razvoj u BL CLEA Studiju. Dodatne funkcije dogovaraju se prije izrade.';}
 function build(source,value,metadata){
  const b=validate(value),D=scope.CLEA7BILDesigner;let next=source;
  if(b.palette==='copper')for(const [from,to]of Object.entries({'#24342e':'#f5f3f0','#63726b':'#b9bdc6','#235c48':'#ff9b5d','#ffffff':'#151d28','#e3e8e1':'#303944','#f7ede3':'#292019','#eedfce':'#69442c','#9a5327':'#ffc59e','#e8efe5':'#1c2924','#dce5d8':'#344c3e','#f5f4ee':'#0c1119','#d7ded5':'#303944','#fff6f1':'#30201e','#963a2a':'#ffb6a0','#ead7cf':'#6e4438'}))if(D.palette(next).includes(from))next=D.recolor(next,from,to);
  if(b.layout==='column')next=D.editAppearance(next,'bilui_metrics','style','direction','column');
  next='# CLEA DESIGN BRIEF /1 '+JSON.stringify(b).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+'\n'+next;
  return scope.CLEA7BIL.compile(next,{...metadata,name:BRAND+' · '+b.person}).application;
 }
 scope.CLEA7Personalisation=Object.freeze({BRAND,KEY,validate,describe,build});
})(globalThis);
