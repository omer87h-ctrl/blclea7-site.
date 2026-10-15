"""CLEA7 declarative app format: data, UI and permissions; never arbitrary code."""
import copy
import json
import re
import uuid

FORMAT = 'clea7.app/1'
FIELD_TYPES = ('text', 'textarea', 'number', 'date', 'checkbox', 'select')
COLORS = ('#ffac77', '#79c9ff', '#bda3ff', '#6ee7b7', '#fb91bd')

class UserError(ValueError):
    pass

def ident(value, label='identifier'):
    if not isinstance(value, str) or not re.fullmatch(r'[a-z][a-z0-9_]{0,31}', value):
        raise UserError(f'Neispravan {label}: koristi malo slovo, brojeve i donju crtu.')
    return value

def text(value, limit=120, label='tekst', required=True):
    if not isinstance(value, str) or len(value) > limit or '\x00' in value:
        raise UserError(f'Neispravan {label}; najvise {limit} znakova.')
    value = value.strip()
    if required and not value:
        raise UserError(f'{label} ne smije biti prazan.')
    return value

def validate_app(value):
    if not isinstance(value, dict) or value.get('format') != FORMAT:
        raise UserError('Projekt nije CLEA7 aplikacija verzije 1.')
    try:
        app_id = str(uuid.UUID(str(value.get('id', ''))))
    except ValueError:
        raise UserError('Projekt ima neispravan identitet.') from None
    app = {'format': FORMAT, 'id': app_id,
           'name': text(value.get('name'), label='naziv aplikacije'),
           'description': text(value.get('description', ''), 1000, required=False),
           'accent': value.get('accent', COLORS[0]), 'revision': value.get('revision', 1),
           'permissions': ['own-data'], 'screens': []}
    if app['accent'] not in COLORS:
        raise UserError('Odaberi jednu od podrzanih boja.')
    if type(app['revision']) is not int or not 1 <= app['revision'] <= 1000000:
        raise UserError('Neispravna revizija projekta.')
    screens = value.get('screens')
    if not isinstance(screens, list) or not 1 <= len(screens) <= 12:
        raise UserError('Aplikacija treba imati 1 do 12 ekrana.')
    screen_ids = set()
    for screen in screens:
        if not isinstance(screen, dict):
            raise UserError('Neispravan ekran.')
        sid = ident(screen.get('id'), 'identitet ekrana')
        if sid in screen_ids:
            raise UserError('Ekrani ne smiju imati isti identitet.')
        screen_ids.add(sid)
        parsed = {'id': sid, 'name': text(screen.get('name'), label='naziv ekrana'), 'fields': []}
        fields = screen.get('fields')
        if not isinstance(fields, list) or not 1 <= len(fields) <= 24:
            raise UserError('Ekran treba imati 1 do 24 polja.')
        field_ids = set()
        for field in fields:
            if not isinstance(field, dict):
                raise UserError('Neispravno polje.')
            fid = ident(field.get('id'), 'identitet polja')
            if fid in field_ids:
                raise UserError('Polja na istom ekranu moraju imati razlicite identitete.')
            field_ids.add(fid)
            kind = field.get('type')
            if kind not in FIELD_TYPES:
                raise UserError('Nepodrzana vrsta polja.')
            parsed_field = {'id': fid, 'label': text(field.get('label'), label='naziv polja'),
                            'type': kind, 'required': bool(field.get('required', False))}
            if kind == 'select':
                options = field.get('options')
                if not isinstance(options, list) or not 1 <= len(options) <= 20:
                    raise UserError('Izbor treba imati 1 do 20 opcija.')
                parsed_field['options'] = list(dict.fromkeys(text(x, 80, 'opcija') for x in options))
            parsed['fields'].append(parsed_field)
        app['screens'].append(parsed)
    return app

def validate_record(screen, value):
    if not isinstance(value, dict):
        raise UserError('Zapis mora biti objekat.')
    output = {}
    for f in screen['fields']:
        v = value.get(f['id'])
        if f['required'] and (v is None or v == ''):
            raise UserError(f"Polje {f['label']} je obavezno.")
        if f['type'] == 'checkbox':
            if v is not None and type(v) is not bool:
                raise UserError(f"Polje {f['label']} mora biti da ili ne.")
            output[f['id']] = bool(v)
        elif f['type'] == 'number':
            if v is None or v == '':
                output[f['id']] = None
            else:
                import math
                if isinstance(v, bool):
                    raise UserError('Broj ne moze biti logicka vrijednost.')
                try:
                    n = float(v)
                    if not math.isfinite(n) or abs(n) > 1e15:
                        raise ValueError()
                    output[f['id']] = n
                except (ValueError, TypeError):
                    raise UserError(f"Polje {f['label']} treba biti konacan broj.") from None
        else:
            v = text(v if v is not None else '', 10000, f['label'], required=f['required'])
            if f['type'] == 'date' and v:
                import datetime
                try:
                    if datetime.date.fromisoformat(v).isoformat() != v:
                        raise ValueError()
                except ValueError:
                    raise UserError(f"Polje {f['label']} treba ispravan datum.") from None
            if f['type'] == 'select' and v and v not in f['options']:
                raise UserError(f"Polje {f['label']} ima nepoznatu opciju.")
            output[f['id']] = v
    return output

def template(name='Moja aplikacija', kind='tasks'):
    fields = {
        'tasks': [('title', 'Zadatak', 'text', True), ('detail', 'Opis', 'textarea', False),
                  ('deadline', 'Rok', 'date', False), ('done', 'Zavrseno', 'checkbox', False)],
        'inventory': [('name', 'Naziv', 'text', True), ('quantity', 'Kolicina', 'number', True),
                      ('price', 'Cijena', 'number', False), ('note', 'Biljeska', 'textarea', False)],
        'contacts': [('name', 'Ime', 'text', True), ('email', 'E-mail', 'text', False),
                     ('phone', 'Telefon', 'text', False), ('note', 'Biljeska', 'textarea', False)],
        'orders': [('title', 'Radni nalog', 'text', True), ('client', 'Klijent', 'text', False),
                   ('amount', 'Iznos', 'number', False), ('done', 'Zavrseno', 'checkbox', False)]}
    if kind not in fields:
        raise UserError('Nepoznat predlozak.')
    return validate_app({'format': FORMAT, 'id': str(uuid.uuid4()), 'name': name,
                         'screens': [{'id': 'main', 'name': 'Pregled',
                                      'fields': [dict(id=i, label=l, type=t, required=r)
                                                 for i, l, t, r in fields[kind]]}]})

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
