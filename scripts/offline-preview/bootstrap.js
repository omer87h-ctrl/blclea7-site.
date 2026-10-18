'use strict';
(function(){
 function status(message){var node=document.getElementById('status');if(node)node.textContent=message;}
 var failure=false;
 function fail(message){failure=true;status('Editor se nije pokrenuo: '+message+' · Otvori datoteku u pregledniku koji izvršava JavaScript.');}
 addEventListener('error',function(event){fail(event.message||'JavaScript je blokiran ili nepodržan.');});
 addEventListener('unhandledrejection',function(event){fail(event.reason&&event.reason.message||String(event.reason));});
 status('Pokretanje lokalnog Studija…');
 var constructors=[window.Element,window.DocumentFragment,window.Document];
 constructors.forEach(function(type){
  if(!type||type.prototype.replaceChildren)return;
  Object.defineProperty(type.prototype,'replaceChildren',{configurable:true,writable:true,value:function(){
   while(this.firstChild)this.removeChild(this.firstChild);
   for(var i=0;i<arguments.length;i++){var item=arguments[i];this.appendChild(item&&typeof item==='object'&&item.nodeType?item:document.createTextNode(String(item)));}
  }});
 });
 setTimeout(function(){if(!window.CLEA7Workbench&&!failure)status('Editor nije završio pokretanje. Ovaj pregled datoteke možda blokira JavaScript. Otvori novu datoteku u Chromeu; projekti se ovdje čuvaju samo do zatvaranja.');},5000);
})();
