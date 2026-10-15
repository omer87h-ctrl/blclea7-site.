"""Data-only application/3 contracts, mirrored by web/workbench/living.js."""
import re
from .schema import UserError

PROPERTIES={'opacity':(0,1),'translateX':(-2000,2000),'translateY':(-2000,2000),'scale':(0,10),'rotate':(-3600,3600)}

def validate_living(p,expression,definition):
    def fail(message):raise UserError(message)
    def key(x):return isinstance(x,str) and re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}',x) and x not in ('constructor','prototype','__proto__')
    def obj(x,allowed):
        if not isinstance(x,dict) or any(k not in allowed for k in x):fail('Neispravan Living ugovor.')
    components=p.get('components',{})
    if not isinstance(components,dict) or len(components)>40:fail('Neispravna biblioteka komponenti.')
    for name,c in components.items():
        if not key(name):fail('Neispravan identitet komponente.')
        obj(c,('name','root'))
        if not isinstance(c.get('name'),str) or not c['name'].strip() or len(c['name'])>80:fail('Neispravan naziv komponente.')
        definition(c.get('root'))
    machines=p.get('machines',{});animations=p.get('animations',{})
    if not isinstance(machines,dict) or not isinstance(animations,dict) or len(machines)>20 or len(animations)>40:fail('Neispravne machines ili animacije.')
    used=set();nodes=set()
    def walk(ns):
        for n in ns:nodes.add(n['id']);walk(n.get('children',[]))
    for s in p['screens']:walk(s['children'])
    for name,m in machines.items():
        if not key(name):fail('Neispravan identitet state machine.')
        obj(m,('stateKey','initial','states'));state_key=m.get('stateKey')
        if state_key not in p['state'] or not isinstance(p['state'][state_key],str) or state_key in used:fail('Machine treba vlastiti tekstualni podatak.')
        used.add(state_key);states=m.get('states');obj(states,states if isinstance(states,dict) else ())
        if not 1<=len(states)<=32 or m.get('initial') not in states or p['state'][state_key]!=m['initial']:fail('Neispravno početno stanje machine.')
        for state,definition in states.items():
            if not key(state):fail('Neispravno stanje machine.')
            obj(definition,('on',));events=definition.get('on');obj(events,events if isinstance(events,dict) else ())
            if len(events)>16:fail('Previše događaja.')
            for event,transitions in events.items():
                if not key(event) or not isinstance(transitions,list) or not 1<=len(transitions)<=8:fail('Neispravan prijelaz.')
                for i,t in enumerate(transitions):
                    obj(t,('to','guard'))
                    if t.get('to') not in states or i<len(transitions)-1 and 'guard' not in t:fail('Neispravno odredište ili nedostižan prijelaz.')
                    if 'guard' in t:expression(t['guard'])
    for name,a in animations.items():
        if not key(name):fail('Neispravan identitet animacije.')
        obj(a,('duration','iterations','easing','tracks'));duration=a.get('duration');iterations=a.get('iterations');tracks=a.get('tracks')
        if type(duration) is not int or not 16<=duration<=10000 or type(iterations) is not int or not 1<=iterations<=5 or a.get('easing') not in ('linear','ease-in','ease-out','ease-in-out') or not isinstance(tracks,list) or not 1<=len(tracks)<=32:fail('Neispravne granice animacije.')
        seen=set()
        for t in tracks:
            obj(t,('target','property','frames'));target=t.get('target');prop=t.get('property');frames=t.get('frames')
            if target not in nodes or prop not in PROPERTIES or (target,prop) in seen or not isinstance(frames,list) or not 2<=len(frames)<=32:fail('Neispravna animacijska traka.')
            seen.add((target,prop));previous=-1;low,high=PROPERTIES[prop]
            for f in frames:
                obj(f,('at','value'));at=f.get('at');value=f.get('value')
                if type(at) is not int or not previous<at<=duration or type(value) not in (int,float) or not low<=value<=high:fail('Neispravan keyframe.')
                previous=at
            if frames[0]['at']!=0 or frames[-1]['at']!=duration:fail('Traka treba početni i završni keyframe.')
    def steps(xs):
        for x in xs:
            if x['action']=='animate' and x.get('animation') not in animations:fail('Animacija ne postoji.')
            if x['action']=='machine.event':
                m=machines.get(x.get('machine'))
                if not m or not key(x.get('event')) or not any(x['event'] in s['on'] for s in m['states'].values()):fail('Događaj machine ne postoji.')
            for k in ('then','else','steps'):
                if k in x:steps(x[k])
    for xs in p['flows'].values():steps(xs)
