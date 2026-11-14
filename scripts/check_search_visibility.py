"""Check crawl/index directives; this does not claim Google has indexed a URL."""
from html.parser import HTMLParser
from pathlib import Path
import urllib.robotparser,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1];BASE='https://clea7.brzoilokalno.com/'
class Head(HTMLParser):
 def __init__(self,s):super().__init__();self.robots=[];self.canonical=[];self.descriptions=[];self.feed(s.split('</head>',1)[0])
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='meta'and d.get('name','').lower()=='robots':self.robots.append(d.get('content','').lower())
  if t=='meta'and d.get('name')=='description':self.descriptions.append(d.get('content',''))
  if t=='link'and d.get('rel')=='canonical':self.canonical.append(d.get('href'))
bot=urllib.robotparser.RobotFileParser();bot.parse((ROOT/'robots.txt').read_text().splitlines());urls=[n.text for n in ET.parse(ROOT/'sitemap.xml').getroot().iter()if n.tag.endswith('loc')];assert len(urls)==len(set(urls))
for path,file in {'':'index.html','studio/':'studio/index.html','studio/workbench/':'studio/workbench/index.html','sense/':'sense/index.html','studio/launcher/':'studio/launcher/index.html','auto/':'auto/index.html','ai.html':'ai.html'}.items():
 url=BASE+path;head=Head((ROOT/file).read_text());assert bot.can_fetch('Googlebot',url),(url,'robots blocked');assert all('noindex'not in x and 'none'not in x for x in head.robots),(url,'noindex');assert head.canonical==[url],(url,'canonical');assert len(head.descriptions)==1 and len(head.descriptions[0])>40,(url,'description');assert url in urls,(url,'not in sitemap');print('CRAWL_READY',url)
assert not bot.can_fetch('Googlebot',BASE+'sdk-source/clea7/bil.py')
assert not bot.can_fetch('Googlebot',BASE+'studio/launcher/player.html')
print('Public products crawl-ready; raw SDK and execution-instance exclusions retained. Actual Google index status is separate.')
