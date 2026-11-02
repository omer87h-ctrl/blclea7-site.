"""Real Studio -> package -> separate Runtime and independent SDK acceptance.

Original fictional app, isolated loopback origin, actual compiler/Core/IndexedDB.
No engine mocks, network services, personal data, native or performance claims.
Requires separately installed Python Playwright and Chromium.
"""
from pathlib import Path
import argparse
import base64
import functools
import hashlib
import http.server
import json
import os
import subprocess
import sys
import threading
import time
import zipfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
SOURCE = '''# Original offline universal application acceptance fixture.
import text
fn amount(value: Number, price: Number) -> Number {
    let result = 0
    repeat 80 as index {
        result = result + value * value + index
    }
    return result * price
}
let quantity = 2
let price = 20
let note = ""
derive total = amount(quantity, price)

screen quote "Moja ponuda" {
    input quantity label "Količina"
    input price label "Cijena"
    show total
    button "Promijeni bilješku" runs annotate
    button "Vrati dvije" runs reset_quantity
    button "Pregled" runs preview
}
screen summary "Pregled ponude" {
    show total
    button "Nazad" runs back
}
on annotate { note = text.concat(note, "x") }
on reset_quantity { quantity = 2 }
on preview { open summary }
on back { open quote }
'''


def expected(quantity, price=20):
    return (80*quantity*quantity+3160)*price


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--web-root', type=Path, default=ROOT/'studio',
                        help='Actual source web directory or extracted owner-review bundle.')
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    checks, errors, requests = [], [], []
    report = {'format': 'clea7.universal.browser/1', 'status': 'running', 'checks': checks,
              'errors': errors, 'not_verified': ['physical devices or screen readers',
              'native Windows/Android/iOS builds or GUI', 'WASM or native speed advantage',
              'battery savings or total process-memory cap', 'production remote services']}
    web_root = args.web_root.resolve(strict=True)
    host_files = ['runtime.js', 'workbench/bil-compiler.js', 'workbench/bil-runtime.js',
                  'workbench/working-cache.js', 'workbench/clea-core.js',
                  'workbench/engine.js', 'workbench/package.js', 'launcher/player.js']
    report['hostSourceSha256'] = {name: hashlib.sha256((web_root/name).read_bytes()).hexdigest()
                                 for name in host_files}
    (out/'acceptance.bil').write_text(SOURCE)

    def checked(name):
        checks.append(name)
        print('PASS universal-browser '+name, flush=True)

    def wait(page, expression):
        try:
            page.wait_for_function(expression)
        except Exception:
            debug = page.evaluate('() => ({notice: document.getElementById("notice")?.textContent, state: window.CLEA7RuntimeApp?.engine.state, pending: window.CLEA7RuntimeApp?.engine.pending, events: window.CLEA7RuntimeApp?.engine.events, fields: [...document.querySelectorAll("#application input")].map(n=>({label:n.getAttribute("aria-label"),value:n.value}))})')
            (out/'failure-state.json').write_text(json.dumps(debug, ensure_ascii=False, indent=2))
            page.screenshot(path=str(out/'failure.png'), full_page=True)
            raise

    SDK_ROOT = out/'curated-sdk'
    SDK_ROOT.mkdir()
    sdk_bytes = (ROOT/'downloads/BL-CLEA7-SDK-0.18.0-test.zip').read_bytes()
    assert hashlib.sha256(sdk_bytes).hexdigest() == '76224a697db6fc79c710d2c2d33b7a624b1f342217f649ddbbbaccfc7e74d41b'
    with zipfile.ZipFile(ROOT/'downloads/BL-CLEA7-SDK-0.18.0-test.zip') as archive:
        assert all(not Path(name).is_absolute() and '..' not in Path(name).parts for name in archive.namelist())
        archive.extractall(SDK_ROOT)
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', PYTHONPATH=str(SDK_ROOT))

    def cli(*args):
        result = subprocess.run([sys.executable, '-m', 'clea7', *map(str, args)], cwd=SDK_ROOT,
                                env=env, capture_output=True, text=True, timeout=90)
        if result.returncode:
            raise AssertionError(result.stderr+'\n'+result.stdout)
        return json.loads(result.stdout)

    server = browser = None
    try:
        independent = out/'IndependentSDK'
        cli('project', 'new', independent)
        (independent/'app.bil').write_text(SOURCE)
        suite = {'format': 'clea7.project-tests/1', 'cases': [{'name': 'Actual event and restart', 'steps': [
            {'flow': 'annotate', 'expect': {'values': {'quantity': 2, 'total': expected(2), 'note': 'x'}}},
            {'flow': 'preview', 'expect': {'screen': 'summary'}},
            {'restart': True, 'expect': {'values': {'quantity': 2, 'total': expected(2), 'note': 'x'}, 'screen': 'summary'}}]}]}
        (independent/'tests.json').write_text(json.dumps(suite))
        assert cli('project', 'check', independent)['valid']
        assert cli('project', 'test', independent)['passed']
        enabled = cli('project', 'run', independent, '--flow', 'annotate', '--cache', 'enabled')
        disabled = cli('project', 'run', independent, '--flow', 'annotate', '--cache', 'off')
        assert enabled['state'] == disabled['state']
        assert enabled['state']['total'] == expected(2)
        built = cli('project', 'build', independent, '--output', 'dist/independent.clea7')
        sdk_package = Path(built['output'])
        assert cli('validate', sdk_package)['valid']
        assert built['runtime'] == '0.18.0'
        report['sdk'] = {'package': str(sdk_package), 'sha256': hashlib.sha256(sdk_package.read_bytes()).hexdigest(),
                         'cacheOnAndOffEqual': True}
        checked('independent SDK new/check/test/run/cache-off/build/validate execute actual BIL')

        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = 'http://127.0.0.1:'+str(server.server_port)

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME', '/usr/bin/chromium'), headless=True,
                                                  args=['--no-sandbox', '--disable-dev-shm-usage'])
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
            context.on('page', lambda p: p.on('pageerror', lambda e: errors.append(str(e))))
            context.on('request', lambda r: requests.append({'url': r.url, 'method': r.method}))
            studio = context.new_page()
            studio.on('dialog', lambda dialog: dialog.accept())
            studio.goto(origin+'/studio/workbench/', wait_until='networkidle')
            studio.wait_for_function('() => !!window.CLEA7Workbench')
            studio.locator('[data-panel="bil"]').click()
            studio.locator('#bil-file').set_input_files(str(out/'acceptance.bil'))
            studio.wait_for_function('() => CLEA7Workbench.project.bil?.source.includes("derive total")')
            studio.locator('#bil-check').click()
            expect(studio.locator('#bil-status')).not_to_contain_text('BIL_TYPE')
            studio.locator('#bil-run').click()
            studio.wait_for_function('() => CLEA7Workbench.engine?.state.bilValues?.total === 69600')
            expect(studio.locator('#player output[aria-label="total"]')).to_have_text(str(expected(2)))
            studio.locator('#player').get_by_label('Količina', exact=True).fill('3')
            studio.locator('#player').get_by_label('Količina', exact=True).press('Tab')
            studio.wait_for_function('() => CLEA7Workbench.engine.state.bilValues.total === 77600')
            checked('Studio imports, compiles and runs original BIL with reactive typed UI')
            studio.locator('[data-panel="build"]').click()
            with studio.expect_download() as download:
                studio.locator('#export-package').click()
            studio_package = out/'StudioOriginal.clea7'
            download.value.save_as(str(studio_package))
            package = json.loads(studio_package.read_text())
            app_id = package['manifest']['id']
            assert package['manifest']['runtime'] == '0.18.0'
            assert 'derive total' in json.loads(base64.b64decode(package['payload']))['bil']['source']
            report['studio'] = {'package': str(studio_package), 'id': app_id,
                                'sha256': hashlib.sha256(studio_package.read_bytes()).hexdigest()}
            checked('Studio exports a validated .clea7 containing executable source/IR and actual Runtime0.18 minimum')
            studio.screenshot(path=str(out/'studio.png'), full_page=True)
            studio.close()

            library = context.new_page()
            library.goto(origin+'/studio/launcher/', wait_until='networkidle')
            library.wait_for_function('() => !!window.CLEA7Library')

            def install(path, identifier):
                library.locator('#package-file').set_input_files(str(path))
                dialog = library.get_by_role('dialog')
                expect(dialog).to_be_visible()
                dialog.get_by_role('button', name='Instaliraj', exact=True).click()
                card = library.locator('article[data-app="'+identifier+'"]')
                expect(card).to_be_visible()
                return card

            card = install(studio_package, app_id)
            with context.expect_page() as popup:
                card.get_by_role('button', name='Pokreni', exact=True).click()
            player = popup.value
            wait(player, '() => !!window.CLEA7RuntimeApp')
            expect(player.locator('#runtime-diagnostics')).to_be_hidden()
            assert player.locator('#trace').inner_text() == ''
            production = player.evaluate('() => CLEA7RuntimeApp.engine.diagnostics()')
            assert production['mode'] == 'production'
            assert 'bilValues' not in json.dumps(production)
            expect(player.locator('#application output[aria-label="total"]')).to_have_text(str(expected(2)))
            checked('separate Runtime library installs and launches Studio package; production details are opt-in')

            player.locator('#development-mode').check()
            expect(player.locator('#runtime-diagnostics')).to_be_visible()
            player.locator('#application').get_by_role('button', name='Promijeni bilješku', exact=True).click()
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.note === "x"')
            cache_initial = player.evaluate('() => CLEA7RuntimeApp.engine.diagnostics().cache')
            assert cache_initial['hits'] > 0, cache_initial
            assert cache_initial['entries'] > 0, cache_initial
            assert cache_initial['retainedBytes'] <= cache_initial['budgetBytes'], cache_initial
            trace = player.evaluate('() => CLEA7RuntimeApp.engine.events')
            assert any(t.get('kind') == 'derive' and t.get('cache') == 'hit' for e in trace for t in e.get('bil', [])), trace
            assert player.locator('#cache-summary').inner_text()
            report['workingCache'] = cache_initial
            checked('real measured pure work is admitted and reused; actual event trace and bounded cache counters visible')

            player.locator('#application').get_by_label('Količina', exact=True).fill('3')
            player.locator('#application').get_by_label('Količina', exact=True).press('Tab')
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.total === 77600')
            assert player.evaluate('() => CLEA7RuntimeApp.engine.state.bilValues.note') == 'x'
            player.locator('#cache-enabled').uncheck()
            player.locator('#application').get_by_role('button', name='Vrati dvije', exact=True).click()
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.total === 69600')
            expect(player.locator('#application').get_by_label('Količina', exact=True)).to_have_value('2')
            off = player.evaluate('() => CLEA7RuntimeApp.engine.diagnostics().cache')
            assert not off['enabled'] and off['entries'] == 0
            player.locator('#cache-enabled').check()
            player.locator('#application').get_by_label('Količina', exact=True).fill('3')
            player.locator('#application').get_by_label('Količina', exact=True).press('Tab')
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.total === 77600')
            player.locator('#application').get_by_role('button', name='Vrati dvije', exact=True).click()
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.total === 69600')
            checked('cache off/on follows the same real input and event semantics without losing unrelated state')
            before_clear = player.evaluate('() => JSON.stringify(CLEA7RuntimeApp.engine.state)')
            player.locator('#cache-clear').click()
            assert player.evaluate('() => JSON.stringify(CLEA7RuntimeApp.engine.state)') == before_clear
            assert player.evaluate('() => CLEA7RuntimeApp.engine.diagnostics().cache.entries') == 0
            player.locator('#application').get_by_label('Količina', exact=True).fill('4')
            player.locator('#application').get_by_label('Količina', exact=True).press('Tab')
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.total === 88800')
            player.locator('#application').get_by_role('button', name='Pregled', exact=True).click()
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilScreen === "summary"')
            player.reload(wait_until='networkidle')
            wait(player, '() => !!window.CLEA7RuntimeApp')
            assert player.evaluate('() => CLEA7RuntimeApp.engine.state.bilValues.quantity') == 4
            assert player.evaluate('() => CLEA7RuntimeApp.engine.state.bilValues.total') == expected(4)
            assert player.evaluate('() => CLEA7RuntimeApp.engine.state.bilScreen') == 'summary'
            expect(player.locator('#runtime-diagnostics')).to_be_hidden()
            checked('clearing cache preserves application data; actual IndexedDB values/navigation survive Runtime restart')

            independent_id = json.loads(sdk_package.read_text())['manifest']['id']
            card = install(sdk_package, independent_id)
            with context.expect_page() as popup:
                card.get_by_role('button', name='Pokreni', exact=True).click()
            independent_player = popup.value
            wait(independent_player, '() => !!window.CLEA7RuntimeApp')
            assert independent_player.evaluate('() => CLEA7RuntimeApp.engine.state.bilValues.quantity') == 2
            assert independent_player.evaluate('() => CLEA7RuntimeApp.engine.state.bilValues.note') == ''
            independent_player.locator('#application').get_by_label('Količina', exact=True).fill('7')
            independent_player.locator('#application').get_by_label('Količina', exact=True).press('Tab')
            wait(independent_player, '() => CLEA7RuntimeApp.engine.state.bilValues.total === 141600')
            assert player.evaluate('() => CLEA7RuntimeApp.engine.state.bilValues.quantity') == 4
            checked('independently SDK-built package installs and runs in another app scope without changing Studio app state')

            invalid = json.loads(sdk_package.read_text())
            invalid['manifest']['runtime'] = '0.17.0'
            invalid_file = out/'UnderstatedRuntime.clea7'
            invalid_file.write_text(json.dumps(invalid))
            library.locator('#package-file').set_input_files(str(invalid_file))
            expect(library.locator('#status')).to_contain_text('Core3')
            expect(library.get_by_role('dialog')).to_have_count(0)
            checked('real Runtime package loader rejects an understated feature minimum before installation')

            player.locator('#application').get_by_role('button', name='Nazad', exact=True).click()
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilScreen === "quote"')
            player.locator('#development-mode').check()
            player.locator('#application').get_by_role('button', name='Promijeni bilješku', exact=True).click()
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.note === "xx"')
            player.locator('#flow').select_option('bil_reset_quantity')
            live = player.evaluate('() => JSON.stringify(CLEA7RuntimeApp.engine.state)')
            player.locator('#shadow').click()
            expect(player.locator('#reality-status')).to_contain_text('ostali isti', timeout=20000)
            shadow = json.loads(player.locator('#reality-result').inner_text())
            assert shadow['liveUnchanged'] and shadow['state']['bilValues']['quantity'] == 2
            assert player.evaluate('() => JSON.stringify(CLEA7RuntimeApp.engine.state)') == live
            checked('isolated SHADOW executes a genuine alternative without modifying persisted LIVE state')

            player.set_viewport_size({'width': 390, 'height': 844})
            assert player.evaluate('() => document.documentElement.scrollWidth <= innerWidth+2')
            player.screenshot(path=str(out/'runtime-mobile.png'), full_page=True)
            player.locator('#development-mode').uncheck()
            assert player.locator('#trace').inner_text() == ''
            assert player.locator('#alternative').input_value() == ''
            assert player.evaluate('() => CLEA7RuntimeApp.engine.events.length') == 0
            checked('390px Runtime controls fit; leaving development clears captured detailed diagnostics')
            context.set_offline(True)
            player.locator('#application').get_by_role('button', name='Vrati dvije', exact=True).click()
            wait(player, '() => CLEA7RuntimeApp.engine.state.bilValues.total === 69600')
            checked('already-loaded Core and app remain functional with browser network offline')
            context.set_offline(False)
            assert all(r['url'].startswith(origin) and r['method'] == 'GET' for r in requests), requests
            assert not errors, errors
            checked('only local same-origin GET requests; no AI/cloud/native access or uncaught JavaScript errors')
            report['requests'] = {'total': len(requests), 'external': 0}
            report['status'] = 'passed'
            browser.close()
            browser = None
    except Exception as error:
        report['status'] = 'failed'
        report['failure'] = str(error)
        raise
    finally:
        report['checkedAtUtc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        (out/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
        if browser:
            try:
                browser.close()
            except Exception:
                pass  # Preserve the original failure after Playwright context exit.
        if server:
            server.shutdown()
            server.server_close()
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
