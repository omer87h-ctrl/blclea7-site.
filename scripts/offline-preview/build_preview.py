from pathlib import Path
from html.parser import HTMLParser
import json,re,secrets,subprocess,argparse
root=Path(__file__).resolve().parent
args=argparse.ArgumentParser();args.add_argument('--source-root',default='/workspace/sites/bl-clea7-studio-mobile/dist');args.add_argument('--output',default='/workspace/BL-CLEA7-Studio-pregled-v2.html');options=args.parse_args();base=Path(options.source_root)
nonce=secrets.token_hex(16)
html=(base/'workbench/index.html').read_text()
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
html=re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html=re.sub(r'<script src="[^"]+"></script>', '', html)
html=html.replace('href="../legacy.html"','href="#design"').replace('href="../index.html"','href="#design"')
html=html.replace('Učitavanje Studija…','Za interaktivni Studio otvori ovu HTML datoteku u pregledniku koji podržava JavaScript, npr. Chromeu.')
css=(base/'workbench/studio.css').read_text()+'\n'+(base/'workbench/toolchain.css').read_text()+'\n'+(base/'mobile-preview.css').read_text()
assets={p:(base/'workbench'/p).read_text() for p in ['living.js','bil-compiler.js','bil-runtime.js','format.js','plan.js','review.js','consumer.js','engine.js','studio.css']}
assets['../runtime.js']=(base/'runtime.js').read_text()
shim="const CLEA7_OFFLINE_ASSETS="+json.dumps(assets,ensure_ascii=True)+";globalThis.fetch=async function(resource){const name=String(resource);if(Object.prototype.hasOwnProperty.call(CLEA7_OFFLINE_ASSETS,name))return new Response(CLEA7_OFFLINE_ASSETS[name],{status:200});throw Error('Lokalni pregled ne šalje mrežne zahtjeve.');};"
files=['workbench/living.js','workbench/bil-compiler.js','workbench/bil-runtime.js','workbench/format.js','workbench/device.js','workbench/plan.js','workbench/review.js','workbench/consumer.js','workbench/firebase-development.js','workbench/android-backend.js','workbench/remote.js','workbench/remote-studio.js','workbench/engine.js','workbench/publisher.js','workbench/package.js','workbench/diagnostics.js','workbench/ai-controls.js','workbench/graph.js','workbench/code-editor.js','workbench/pro-studio.js','workbench/starters.js','workbench/business.js','workbench/materials.js','workbench/bil-designer.js','workbench/bil-studio.js','workbench/studio.js','workbench/toolchain-ui.js']
sources=[(root/'bootstrap.js').read_text(),(base/'runtime.js').read_text(),(root/'offline-storage.js').read_text(),shim]+[(base/p).read_text() for p in files]
mobile=(base/'mobile-preview.js').read_text().replace("const runtime=document.createElement('a');runtime.href='../launcher/';runtime.target='_blank';runtime.rel='noopener';runtime.textContent='Otvori zasebni Runtime ↗';note.append(text,runtime);","note.append(text);").replace('Webpregled razvoja · kreiraj i isprobaj aplikaciju. Projekti ostaju u ovom pregledniku.','Lokalni Studio v2 · rad je samo u memoriji. Preuzmi projekt prije zatvaranja datoteke.')
sources.append(mobile)
policy="default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; worker-src blob:; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'"
html=html.replace('</head>','<meta http-equiv="Content-Security-Policy" content="'+policy+'"><style>'+css+'</style></head>')
scripts=''.join('<script nonce="'+nonce+'">'+re.sub(r'</script',r'<\\/script',s,flags=re.I)+'</script>' for s in sources)
html=html.replace('</body>',scripts+'</body>').replace('BL CLEA7 Studio — aplikacije i logika','BL CLEA7 Studio — lokalni pregled v2')
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.inside=False;self.items=[]
 def handle_starttag(self,t,a):
  if t=='script':self.inside=True;self.items.append('')
 def handle_endtag(self,t):
  if t=='script':self.inside=False
 def handle_data(self,data):
  if self.inside:self.items[-1]+=data
parsed=Scripts();parsed.feed(html)
assert len(parsed.items)==len(sources)
for i,source in enumerate(parsed.items):
 check=root/('parsed-'+str(i)+'.js');check.write_text(source)
 subprocess.run(['node','--check',str(check)],capture_output=True,check=True)
 check.unlink()
output=Path(options.output);output.write_text(html)
print(json.dumps({'output':str(output),'scripts_parsed_from_final_html':len(parsed.items),'bytes':output.stat().st_size,'browser_ui_test':'unavailable locally; no physical-device result claimed'}))
