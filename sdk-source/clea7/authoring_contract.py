"""Shared typed BIL model-task data contract. No model, files, network or execution."""
import json
FORMAT='bil.author/1'
MAX_SOURCE_BYTES=10000

def validate(value):
 if not isinstance(value,dict) or set(value)-{'format','mode','source','sourceApproved','previous','diagnostic'}:
  raise ValueError('Invalid BIL authoring contract.')
 if value.get('format')!=FORMAT or value.get('mode') not in ('create','change'):
  raise ValueError('Unsupported BIL authoring operation.')
 mode=value['mode'];source=value.get('source')
 if mode=='change':
  if value.get('sourceApproved') is not True or not isinstance(source,str) or not source.strip():
   raise ValueError('Changing a project requires explicit approval of its source.')
  if len(source.encode())>MAX_SOURCE_BYTES:raise ValueError('Project exceeds the bounded local model source window; no code was truncated.')
 elif 'source' in value or 'sourceApproved' in value:
  raise ValueError('A new application must not upload the existing project.')
 previous=value.get('previous');diagnostic=value.get('diagnostic')
 if (previous is None)!=(diagnostic is None):raise ValueError('Repair needs both source and compiler diagnostic.')
 if previous is not None and (not isinstance(previous,str) or len(previous.encode())>MAX_SOURCE_BYTES
                             or not isinstance(diagnostic,str) or not 1<=len(diagnostic)<=600):
  raise ValueError('Repair context exceeds limits.')
 if len(json.dumps(value,ensure_ascii=False).encode())>14000:raise ValueError('Authoring context exceeds limits.')
 return dict(value)

