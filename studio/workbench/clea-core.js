'use strict';
/* BL CLEA Core contract — original, platform-independent facade.
 * Compilation and execution delegate to the authoritative BIL compiler/VM.
 * No DOM, filesystem, shell, networking or second evaluator lives here.
 */
(function(scope){
const VERSION='0.37.0',FORMAT='clea7.core/1';
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const clone=value=>JSON.parse(JSON.stringify(value));
const frozen=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;};
function fault(code,message){const error=new Error(message);error.code=code;throw error;}
function compiler(){if(!scope.CLEA7BIL?.compile)fault('CoreUnavailable','The authoritative BIL compiler is not loaded.');return scope.CLEA7BIL;}
function vm(){if(!scope.CLEA7BILRuntime?.execute)fault('CoreUnavailable','The authoritative BIL execution engine is not loaded.');return scope.CLEA7BILRuntime;}
function version(value){if(typeof value!=='string'||!/^\d+\.\d+\.\d+$/.test(value))fault('CoreVersion','Use a three-part numeric Runtime version.');return value.split('.').map(Number);}
function compare(a,b){const first=version(a),second=version(b);for(let i=0;i<3;i++)if(first[i]!==second[i])return first[i]<second[i]?-1:1;return 0;}
function maximum(values){return values.reduce((a,b)=>compare(a,b)>=0?a:b,'0.0.0');}
function application(value){const app=value?.application||value?.app||value;if(!app||typeof app!=='object'||Array.isArray(app)||typeof app.format!=='string')fault('CoreApplication','A checked application or compilation is required.');return app;}
function validateApplication(value){const app=application(value);if(scope.CLEA7Format?.validate)return scope.CLEA7Format.validate(app);if(!app.bil)fault('CoreApplication','This Core fallback validates BIL applications only.');compiler().validateApplication(app);return clone(app);}
function compile(source,metadata={}){return compiler().compile(source,metadata);}
function featuresFor(value){return compiler().featuresFor(value);}
function minimumRuntime(raw,targets=[]){
 if(!Array.isArray(targets)||targets.some(x=>!['browser','windows','android'].includes(x)))fault('CoreTarget','Use explicit supported host target identifiers.');
 const app=application(raw),floors=[({'clea7.application/2':'0.3.0','clea7.application/3':'0.4.0','clea7.application/4':'0.5.0','clea7.application/5':'0.6.0','clea7.application/6':'0.7.0','clea7.application/7':targets.includes('android')?'0.9.0':'0.8.0','clea7.application/8':'0.10.0','clea7.application/9':'0.11.0'})[app.format]];
 if(!floors[0])fault('CoreApplication','Unsupported application contract.');
 if(Object.values(app.remote?.backends||{}).some(b=>b.adapter==='sense.local/1'))floors.push('0.37.0');
 if(app.bil){compiler().validateApplication(app);floors.push(featuresFor(app.bil.source).minimumRuntime);if(app.bil.ir.ui?.format==='bil.ui/2')floors.push('0.14.0');}
 for(const backend of Object.values(app.remote?.backends||{})){
  if(backend.adapter==='firebase.development/3')floors.push('0.12.0');
  if(backend.adapter==='android.native/1')floors.push('0.13.0');
  if(backend.adapter==='firebase.development/4')floors.push('0.16.0');
 }
 return maximum(floors);
}
function describe(raw,targets=[]){
 const app=validateApplication(raw),features=app.bil?featuresFor(app.bil.source):{format:'bil.core.features/1',version:1,minimumRuntime:'0.3.0',used:[]},required=new Set();
 if(app.bil){required.add('bil.execute/1');if(app.bil.ir.ui)required.add('bil.ui-model/1');if(app.bil.ir.ui?.format==='bil.ui/2')required.add('bil.ui-model/2');for(const feature of features.used)required.add('bil.feature/'+feature);if(features.used.includes('derive'))required.add('bil.derive/1');}
 else required.add(app.format);
 for(const backend of Object.values(app.remote?.backends||{})){
  required.add('adapter:'+backend.adapter);for(const operation of backend.operations||[])required.add('operation:'+backend.adapter+':'+operation);
 }
 return frozen({format:'clea7.core.requirements/1',core:FORMAT,application:app.id,abi:app.format,minimumRuntime:minimumRuntime(app,targets),features:clone(features),capabilities:[...required].sort(),permissions:[...new Set(app.permissions||[])].sort(),hasInterface:!!app.bil?.ir.ui,scope:'execution-contract; rendering and native effects belong to the host'});
}
function profile(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))fault('CoreProfile','Host profile must be an object.');
 const runtime=options.runtime||VERSION;version(runtime);
 const defaults=['bil.execute/1','bil.ui-model/1','bil.ui-model/2'];for(const feature of scope.CLEA7BILRuntime?.SUPPORTED_CORE_FEATURES||[])defaults.push('bil.feature/'+feature);if(typeof scope.CLEA7BILRuntime?.reconcileDerived==='function')defaults.push('bil.derive/1');
 const capabilities=options.capabilities===undefined?defaults:options.capabilities,permissions=options.permissions||[];
 if(!Array.isArray(capabilities)||capabilities.length>256||capabilities.some(x=>typeof x!=='string'||!x.length||x.length>180||!/^[A-Za-z0-9._:/-]+$/.test(x)))fault('CoreProfile','Host capabilities must be bounded explicit identifiers.');
 if(!Array.isArray(permissions)||permissions.length>32||permissions.some(x=>typeof x!=='string'||!x.length||x.length>64))fault('CoreProfile','Host permissions must be explicit bounded names.');
 return frozen({format:'clea7.host/1',core:FORMAT,runtime,capabilities:[...new Set(capabilities)].sort(),permissions:[...new Set(permissions)].sort()});
}
function negotiate(raw,host=profile(),targets=[]){
 const required=describe(raw,targets),actual=profile(host),missing=required.capabilities.filter(x=>!actual.capabilities.includes(x)),permissions=required.permissions.filter(x=>!actual.permissions.includes(x)),reasons=[];
 if(compare(actual.runtime,required.minimumRuntime)<0)reasons.push({code:'RuntimeVersion',required:required.minimumRuntime,available:actual.runtime});
 for(const name of missing)reasons.push({code:'MissingCapability',capability:name});
 for(const name of permissions)reasons.push({code:'PermissionNotGranted',permission:name});
 return frozen({format:'clea7.core.compatibility/1',compatible:reasons.length===0,requirements:required,host:actual,missingCapabilities:missing,missingPermissions:permissions,reasons});
}
function check(source,metadata={}){const result=compile(source,metadata);return {valid:true,core:FORMAT,features:featuresFor(result),requirements:describe(result),ir:result.ir.format};}
async function execute(ir,block,state,options={}){return vm().execute(ir,block,state,options);}
async function reconcileDerived(ir,state,options={}){
 const runtime=vm();if(typeof runtime.reconcileDerived==='function')return runtime.reconcileDerived(ir,state,options);
 if((ir.main||[]).some(x=>x.coreFeature==='derive'))fault('CoreUnavailable','This host does not implement derived-state reconciliation.');
 return null;
}
function createCache(options){
 if(!options||typeof options.scope!=='string'||!options.scope.length||options.scope.length>256)fault('CoreScope','A bounded explicit application/principal scope is required.');
 if(typeof scope.CLEA7WorkingCache?.Cache!=='function')fault('CoreUnavailable','The dependency cache is not loaded.');
 return new scope.CLEA7WorkingCache.Cache(options);
}
function publicResult(result,mode='development'){
 if(!['development','production'].includes(mode))fault('CoreDiagnostics','Use development or production diagnostics.');
 if(!result||typeof result!=='object'||Array.isArray(result))fault('CoreResult','An execution report is required.');
 if(mode==='development')return clone(result);
 // This outward report must never be substituted for Engine's operational
 // result: state and queued effects intentionally stay inside the trusted host.
 const out={format:'clea7.core.public-result/1',mode:'production',diagnosticsAvailable:false};
 for(const key of ['passed','valid'])if(typeof result[key]==='boolean')out[key]=result[key];
 for(const key of ['instructions','ms'])if(typeof result[key]==='number'&&Number.isFinite(result[key]))out[key]=result[key];
 if(result.features)out.features={format:result.features.format,version:result.features.version,minimumRuntime:result.features.minimumRuntime,used:[...(result.features.used||[])]};
 return frozen(out);
}
scope.CLEA7Core=Object.freeze({FORMAT,VERSION,compile,check,featuresFor,validateApplication,minimumRuntime,describe,profile,negotiate,execute,reconcileDerived,createCache,publicResult});
})(globalThis);
