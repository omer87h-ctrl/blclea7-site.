"""Shared typed BIL model-task data contract. No model, files, network or execution."""
import json
FORMAT='bil.author/1'
PLAN_FORMAT='clea7.authoring-plan/1'
MAX_SOURCE_BYTES=10000

def _object(properties,required=None):
 return {'type':'object','properties':properties,'required':required or list(properties),'additionalProperties':False}

_text={'type':'string','maxLength':800}
_name={'type':'string','pattern':'^[A-Za-z][A-Za-z0-9_]{0,47}$'}
_texts={'type':'array','items':_text,'maxItems':8}
# This is an inference data contract, not a second execution language. The
# shared JS emitter uses the real BIL parser, compiler and isolated Runtime.
PLAN_SCHEMA=_object({
 'format':{'const':PLAN_FORMAT},
 'state':{'type':'array','maxItems':32,'items':_object({'name':_name,'type':_text,'value':{'anyOf':[{'type':'string','maxLength':800},{'type':'number'},{'type':'boolean'},{'type':'null'},{'type':'array','maxItems':64,'items':{'anyOf':[{'type':'string','maxLength':800},{'type':'number'},{'type':'boolean'}]}}]}})},
 'backends':{'type':'array','maxItems':4,'items':_object({'name':_name,'adapter':_text})},
 'events':{'type':'array','maxItems':32,'items':_object({'name':_name,'steps':{'type':'array','maxItems':32,'items':{'anyOf':[
  _object({'op':{'const':'set'},'target':_text,'expression':_text}),
  _object({'op':{'const':'compose'},'target':_name,'parts':{'type':'array','minItems':1,'maxItems':32,'items':{'anyOf':[_object({'text':_text}),_object({'value':_text})]}}}),
  _object({'op':{'const':'open'},'screen':_name}),
  _object({'op':{'const':'request'},'backend':_name,'operation':_text,'args':_texts,'result':_name,'error':_name}),
  _object({'op':{'const':'bil'},'source':_text})
 ]}}})},
 'screens':{'type':'array','minItems':1,'maxItems':16,'items':_object({'id':_name,'title':_text,'items':{'type':'array','maxItems':64,'items':{'anyOf':[
  _object({'kind':{'enum':['input','toggle']},'name':_name,'label':_text}),
  _object({'kind':{'const':'button'},'label':_text,'runs':_name}),
  _object({'kind':{'const':'show'},'expression':_text}),
  _object({'kind':{'enum':['heading','text']},'label':_text}),
  _object({'kind':{'const':'bil'},'source':_text})
 ]}}})},
 'start':_name,
 'declarations':{'type':'array','maxItems':16,'items':_text}
},['format','state','backends','events','screens','start'])

def validate(value):
 if not isinstance(value,dict) or set(value)-{'format','mode','source','structure','sourceApproved','previous','diagnostic','representation'}:
  raise ValueError('Invalid BIL authoring contract.')
 if value.get('format')!=FORMAT or value.get('mode') not in ('create','change'):
  raise ValueError('Unsupported BIL authoring operation.')
 mode=value['mode'];source=value.get('source')
 if value.get('representation','bil') not in ('bil','plan','tools') or (mode=='change' and value.get('representation','bil') not in ('bil','tools')):
  raise ValueError('Use a structured plan for creation, or BIL source for an existing project change.')
 if mode=='change':
  if value.get('sourceApproved') is not True:
   raise ValueError('Changing a project requires explicit approval of its source.')
  if 'structure' in value:
   import re
   structure=value['structure']
   if 'source' in value or value.get('representation')!='tools' or not isinstance(structure,dict) or set(structure)!=({'format','fingerprint','screens','state','events','components','omitted'}|({'grammar','objectModel'} if 'grammar' in structure else set())) or structure.get('format')!='clea7.studio-context/1' or not isinstance(structure.get('fingerprint'),str) or not re.fullmatch('[a-f0-9]{64}',structure['fingerprint']):raise ValueError('Invalid source-free Studio context.')
   for key,maximum in [('screens',16),('state',128),('events',128),('components',256)]:
    if not isinstance(structure[key],list) or len(structure[key])>maximum:raise ValueError('Studio context exceeds its component budget.')
   def symbol(x):return isinstance(x,str) and re.fullmatch('[A-Za-z][A-Za-z0-9_]{0,95}',x) and x not in ('constructor','prototype','__proto__')
   for row in structure['screens']:
    if not isinstance(row,dict) or set(row)!={'id','title'} or not symbol(row['id']) or not isinstance(row['title'],str) or len(row['title'])>200:raise ValueError('Invalid Studio screen context.')
   for row in structure['state']:
    if not isinstance(row,dict) or set(row)!={'id','type','mutable'} or not symbol(row['id']) or row['type'] not in ('Number','Text','Boolean','Null','Structured') or type(row['mutable']) is not bool:raise ValueError('Invalid Studio state context.')
   if any(not symbol(event) for event in structure['events']):raise ValueError('Invalid Studio event context.')
   for row in structure['components']:
    if not isinstance(row,dict) or set(row)!={'id','key','kind','label','screen','parent','bind'} or any(not symbol(row[k]) for k in ('id','screen','parent')) or any(row[k] is not None and not symbol(row[k]) for k in ('key','bind')) or not isinstance(row['kind'],str) or len(row['kind'])>32 or not isinstance(row['label'],str) or len(row['label'])>80:raise ValueError('Invalid Studio component context.')
   if 'grammar' in structure:
    if structure['grammar']!='bil.objects/1' or not isinstance(structure['objectModel'],list) or len(structure['objectModel'])>24:raise ValueError('Invalid Studio object grammar context.')
    for row in structure['objectModel']:
     if not isinstance(row,dict) or set(row)!={'name','fields','actions'} or not symbol(row['name']) or not isinstance(row['fields'],list) or len(row['fields'])>32 or not isinstance(row['actions'],list) or len(row['actions'])>128 or any(not symbol(x) for x in row['actions']):raise ValueError('Invalid Studio object structure.')
     for item in row['fields']:
      if not isinstance(item,dict) or set(item)!={'name','symbol','derived','label'} or not symbol(item['name']) or not symbol(item['symbol']) or type(item['derived']) is not bool or not isinstance(item['label'],str) or len(item['label'])>200:raise ValueError('Invalid Studio object field structure.')
   if type(structure['omitted']) is not int or not 0<=structure['omitted']<=256 or len(json.dumps(structure,ensure_ascii=False).encode())>8000:raise ValueError('Studio context exceeds its byte budget.')
  elif not isinstance(source,str) or not source.strip():raise ValueError('Changing a project requires its source or a typed Studio structure.')
  elif len(source.encode())>MAX_SOURCE_BYTES:raise ValueError('Project exceeds the bounded local model source window; no code was truncated.')
 elif 'source' in value or 'structure' in value or 'sourceApproved' in value:
  raise ValueError('A new application must not upload the existing project.')
 previous=value.get('previous');diagnostic=value.get('diagnostic')
 if (previous is None)!=(diagnostic is None):raise ValueError('Repair needs both source and compiler diagnostic.')
 if previous is not None and (not isinstance(previous,str) or len(previous.encode())>MAX_SOURCE_BYTES
                             or not isinstance(diagnostic,str) or not 1<=len(diagnostic)<=600):
  raise ValueError('Repair context exceeds limits.')
 if len(json.dumps(value,ensure_ascii=False).encode())>14000:raise ValueError('Authoring context exceeds limits.')
 return dict(value)

