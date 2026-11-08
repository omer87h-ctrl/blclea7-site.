/* Original, deliberately bounded Sense vocabulary — by Brzo i Lokalno.
 * These are authored matching hints, not an imported occupational database,
 * a psychometric assessment, an ATS model or evidence that a person has a skill.
 * Ordinary skill names do not imply endorsement by their trademark owners. */
(function(scope){
'use strict';
const entries=[
 ['excel','skills','Excel',['excel','excela','excelu','excelom','microsoft excel']],
 ['word','skills','Word',['microsoft word','ms word']],
 ['office','skills','Uredski alati',['microsoft office','ms office','office paket']],
 ['powerpoint','skills','PowerPoint',['powerpoint']],
 ['sql','skills','SQL',['sql']],
 ['python','skills','Python',['python']],
 ['salesforce','skills','Salesforce',['salesforce','salesforceu','salesforceom']],
 ['javascript','skills','JavaScript',['javascript','java script']],
 ['typescript','skills','TypeScript',['typescript']],
 ['html','skills','HTML',['html','html5']],
 ['css','skills','CSS',['css','css3']],
 ['git','skills','Git',['git']],
 ['java','skills','Java',['java']],
 ['accounting','skills','Knjigovodstvo',['knjigovodstvo','knjigovodstva','knjigovodstvene','bookkeeping']],
 ['inventory','skills','Evidencija zaliha',['upravljanje zalihama','evidencija zaliha','evidenciju zaliha','inventory management','stock control','evidenciju dijelova i zaliha']],
 ['customer_service','skills','Podrška korisnicima',['podrska korisnicima','podrske korisnicima','korisnicka podrska','customer service','customer support','komunikacija s kupcima','komunikaciji s kupcima','upite kupaca','upiti kupaca']],
 ['administration','skills','Administrativni poslovi',['administrativni poslovi','administrativnim poslovima','administrativnog rada','office administration']],
 ['project_management','skills','Upravljanje projektima',['upravljanje projektima','vodjenje projekata','project management']],
 ['data_entry','skills','Unos podataka',['unos podataka','unosa podataka','data entry']],
 ['sales','skills','Prodaja',['prodaja','prodaje','prodaji','sales']],
 ['writing','skills','Pisano poslovno izražavanje',['poslovna korespondencija','business writing']],
 ['degree','education','Visoko obrazovanje',['visoka strucna sprema','vss','bachelor','bachelors degree','bachelor degree','university degree']],
 ['secondary','education','Srednje obrazovanje',['srednja strucna sprema','sss','high school diploma','srednja skola','srednju skolu','srednje skole']],
 ['master','education','Master kvalifikacija',['master degree','masters degree','magistarski studij']],
 ['driver_b','certificates','Vozačka dozvola B',['vozacka dozvola b','vozacku dozvolu b','vozacka b','b kategorija','b kategorije','driving licence b','driving license b']],
 ['pmp','certificates','PMP certifikat',['pmp','project management professional']],
 ['english','language','Engleski jezik',['engleski','engleskog','engleskom','english']],
 ['german','language','Njemački jezik',['njemacki','njemackog','njemackom','german','deutsch']],
 ['bosnian','language','Bosanski jezik',['bosanski','bosanskog','bosanskom','bosnian']],
 ['croatian','language','Hrvatski jezik',['hrvatski','hrvatskog','hrvatskom','croatian']],
 ['serbian','language','Srpski jezik',['srpski','srpskog','srpskom','serbian']]
].map(([id,kind,label,aliases])=>Object.freeze({id,kind,label,aliases:Object.freeze(aliases)}));
scope.CLEA7SenseLexicon=Object.freeze({format:'sense.lexicon/1',version:'2026-10-28.1',languages:Object.freeze(['bs','hr','en']),entries:Object.freeze(entries),origin:'Original matching vocabulary by Brzo i Lokalno; no copied database or model weights.'});
})(globalThis);
