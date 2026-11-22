'use strict';
(() => {
  const button = document.getElementById('private-download');
  const status = document.getElementById('private-status');
  const save = document.getElementById('save-apk');
  let keyBytes = null;
  let objectURL = null;
  const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
  const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
  function acceptLink() {
    const secret = location.hash.slice(1);
    history.replaceState(null, '', location.pathname + location.search);
    if (keyBytes) keyBytes.fill(0);
    keyBytes = null;
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = null;
    save.hidden = true;
    button.disabled = true;
    if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || !globalThis.crypto?.subtle) {
      status.textContent = 'Otvori cijeli privatni link koji si dobio u razgovoru. Ovdje se ništa ne upisuje.';
      return;
    }
    try { keyBytes = decode(secret); } catch (_) { status.textContent = 'Privatni link nije potpun. Ponovo ga otvori iz razgovora.'; return; }
    status.textContent = 'Privatna aplikacija je pripremljena. Preuzmi, instaliraj i otvori.';
    button.disabled = false;
  }
  addEventListener('hashchange', acceptLink);
  acceptLink();
  button.addEventListener('click', async () => {
    if (objectURL) { save.click(); return; }
    button.disabled = true;
    status.textContent = 'Otključavam i provjeravam tvoj APK u pregledniku…';
    try {
      const manifestResponse = await fetch('release/clea7500-owner-0.1.3.json', {credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store'});
      if (!manifestResponse.ok) throw Error('manifest');
      const manifest = await manifestResponse.json();
      if (manifest.format !== 'clea7500.encrypted-owner-apk/1' || !/^downloads\/CLEA7500-owner-[0-9a-f]{16}\.bin$/.test(manifest.file) || manifest.encryptedBytes > 2097152) throw Error('format');
      if (Date.now() >= manifest.activationExpiresAt * 1000) { status.textContent = 'Pozivnica za prvo povezivanje je istekla. Potrebna je nova pripremljena kopija; postojeća veza na instaliranom telefonu ostaje sačuvana.'; return; }
      const response = await fetch(manifest.file, {credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store'});
      if (!response.ok) throw Error('download');
      const encrypted = await response.arrayBuffer();
      if (encrypted.byteLength !== manifest.encryptedBytes || await digest(encrypted) !== manifest.encryptedSHA256) throw Error('integrity');
      const key = await crypto.subtle.importKey('raw', keyBytes, {name: 'AES-GCM'}, false, ['decrypt']);
      const apk = await crypto.subtle.decrypt({name: 'AES-GCM', iv: decode(manifest.iv)}, key, encrypted);
      if (apk.byteLength !== manifest.apkBytes || await digest(apk) !== manifest.apkSHA256) throw Error('APK integrity');
      objectURL = URL.createObjectURL(new Blob([apk], {type: 'application/vnd.android.package-archive'}));
      save.href = objectURL;
      save.hidden = false;
      save.click();
      status.textContent = 'APK je provjeren. Instaliraj BL CLEA AI i otvori je; povezivanje s HP-om počinje automatski.';
      keyBytes.fill(0); keyBytes = null;
    } catch (_) {
      status.textContent = 'Preuzimanje nije uspjelo. Provjeri internet i pokušaj ponovo ovim privatnim linkom.';
    } finally { button.disabled = false; }
  });
  addEventListener('pagehide', () => { if (objectURL) URL.revokeObjectURL(objectURL); });
})();
