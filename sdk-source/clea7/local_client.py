"""SDK/Studio bridge to the already-running owner-local CLEA orchestrator.

Never starts a second model, follows redirects, accepts a remote URL, or sends
an application/CV implicitly. Loopback is a trusted same-user boundary.
"""
import http.client
import json
import re
from .schema import UserError

PORTS = (18769, 18766)
PROFILE = 'qwen3.5-9b-q4_k_m'
MAX_REPLY = 262144


def exchange(port, path, payload=None):
    if type(port) is not int or port not in PORTS or path not in ('/health', '/chat'):
        raise UserError('Dozvoljen je samo vlasnikov lokalni CLEA servis.')
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=2 if payload is None else 300)
    try:
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode('utf-8')
        if body is not None and len(body) > 16384:
            raise UserError('CLEA zahtjev prelazi 16 KiB.')
        connection.request('GET' if body is None else 'POST', path, body=body,
                           headers={'Origin': 'http://127.0.0.1:'+str(port), 'Content-Type': 'application/json'})
        response = connection.getresponse()
        raw = response.read(MAX_REPLY+1)
        if len(raw) > MAX_REPLY:
            raise UserError('CLEA odgovor prelazi dozvoljenu veličinu.')
        if response.status != 200:
            raise UserError('CLEA servis nije završio zahtjev (HTTP '+str(response.status)+').')
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise UserError('Neispravan odgovor lokalnog CLEA servisa.')
        return value
    except (OSError, http.client.HTTPException, ValueError) as error:
        raise UserError('Lokalni CLEA servis nije dostupan ili je odgovor neispravan.') from error
    finally:
        connection.close()


def status():
    for port in PORTS:
        try:
            value = exchange(port, '/health')
        except UserError:
            continue
        if (value.get('brand') == 'BL CLEA AI' and value.get('mode') == 'local'
                and value.get('ready') is True and value.get('modelProfile') == PROFILE
                and value.get('apiVersion') == 'clea7.public-ai/1'):
            return {'available': True, 'port': port, 'modelProfile': PROFILE, 'provider': 'clea',
                    'capabilities': value.get('capabilities',{}), 'message': 'BL CLEA AI 9B je spreman na ovom računaru.'}
    return {'available': False, 'provider': 'clea',
            'message': 'Pokreni prečicu CLEA AI 9B na ovom računaru. Model se ne pokreće iz SDK-a.'}


def ask(question, *, language='auto', web_query=None,authoring=None):
    if not isinstance(question, str) or not 1 <= len(question.strip()) <= 1200:
        raise UserError('Pitanje mora imati 1–1200 znakova.')
    if language not in ('auto', 'bs', 'en'):
        raise UserError('Nepodržan jezik.')
    payload = {'question': question.strip(), 'language': language}
    if web_query is not None:
        if not isinstance(web_query, str) or not 1 <= len(web_query.strip()) <= 250:
            raise UserError('Internetski pojam mora imati 1–250 znakova.')
        payload['webQuery'] = web_query.strip()
    if authoring is not None:
        from .authoring_contract import validate
        try:payload['authoring']=validate(authoring)
        except ValueError as error:raise UserError(str(error)) from None
        if web_query is not None:raise UserError('BIL kreiranje ne prima internetski upit.')
    selected = status()
    if not selected['available']:
        raise UserError(selected['message'])
    # No retry/fallback of an uncertain generation and no direct /v1 endpoint.
    result = exchange(selected['port'], '/chat', payload)
    if not isinstance(result.get('reply'), str) or not result['reply'].strip():
        raise UserError('CLEA nije vratio završen tekstualni odgovor.')
    return result


def verify_bil_reply(reply, *, metadata=None, checks=()):
    """Model text stays untrusted until the shared compiler/SHADOW protocol passes."""
    if not isinstance(reply,str) or len(reply)>12000:
        raise UserError('Model nije vratio ograničen BIL prijedlog.')
    if not isinstance(checks,(tuple,list)) or len(checks)>20:
        raise UserError('Provjera prihvata najviše 20 eksplicitnih slučajeva.')
    from .bil import request
    return request({'action':'verify-reply','reply':reply,'metadata':metadata or {},'checks':list(checks)})


def propose_bil(intent, *, metadata=None, checks=()):
    """One explicit owner-local generation; never reads or replaces a project."""
    if not isinstance(intent,str) or not 1<=len(intent.strip())<=900:
        raise UserError('Opis aplikacije treba 1–900 znakova.')
    prompt=('Napiši potpun BIL program za sljedeći zahtjev. Vrati jedan zatvoren ```bil blok. '
            'Koristi dokumentovanu BIL sintaksu, stvarne događaje i promjenjivo stanje. '
            'Ne dodaj JavaScript, izmišljene servise ili nenavedene lične podatke.\n'+intent.strip())
    answer=ask(intent.strip(),language='bs',authoring={'format':'bil.author/1','mode':'create','representation':'plan'})
    verified=verify_bil_reply(answer['reply'],metadata=metadata,checks=checks)
    return {'format':'clea7.ai-bil-proposal/1','source':verified['application']['bil']['source'],
            'verification':verified,'requiresReview':True,'modelProfile':PROFILE,
            'executionScope':'isolated initialization and explicitly supplied checks only',
            'trainingPerformed':False}
