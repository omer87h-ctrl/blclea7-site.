import json,pathlib,zipfile,hashlib
p=pathlib.Path('downloads/BL-CLEA-AI-0.1.9-test.apk')
assert p.stat().st_size==252558
digest='baa503d9c812b28853f74f0d282b34afdc352a49618f05f7f19485657422c925'
assert hashlib.sha256(p.read_bytes()).hexdigest()==digest
with zipfile.ZipFile(p) as z:
    assert not any('owner-bootstrap' in n or n.endswith('.p12') or n.endswith('.password') for n in z.namelist())
meta={'version':'0.1.9-test','versionCode':10,'package':'com.brzoilokalno.clea7500','bytes':252558,'artifact':str(p),'sha256':digest,'signerCertificateSHA256':'d6506ea699cdd96c157472ee2d494cf1a36842a616f03708d6e4f84f24b2f27d','sourceBuildRun':45647272726,'ownerBootstrapIncluded':False,'physicalDeviceVerified':'Owner reported successful use; not independently instrumented'}
pathlib.Path('release/clea-ai-android-019.json').write_text(json.dumps(meta,indent=2)+'\n')
h=pathlib.Path('clea-ai-android.html');s=h.read_text()
s=s.replace('downloads/BL-CLEA-AI-7500-uredjaj.apk',str(p)).replace('Preuzmi prethodnu Android testnu verziju 0.1.8 ↓','Preuzmi BL CLEA AI 0.1.9 za Android ↓').replace('prethodni APK 0.1.8-test · 977831 B','APK 0.1.9-test · 252558 B').replace('Nova Android verzija 0.1.9 je u provjeri. Prethodni APK može imati problema s učitavanjem. Ne briši postojeću instalaciju prije čuvanja projekata.','Nova verzija 0.1.9-test je isti potpisani APK koji je vlasnik isprobao na telefonu.').replace('295462d7dda186da31d322f801601b0ae81fe52dc2559ab501094dd1942b222a',digest).replace('release/clea7500-android-uredjaj.json','release/clea-ai-android-019.json').replace('Postojeći testni APK ima zaseban potpis. Nemoj uklanjati staru instalaciju bez prethodnog čuvanja podataka; kompatibilnost nadogradnje mora biti potvrđena.','APK 0.1.9 ima drugačiji testni potpis od 0.1.8. Prije eventualne deinstalacije sačuvaj projekte.').replace('izvršavanje na fizičkom telefonu nije potvrđeno ovim zapisom','vlasnik je potvrdio da aplikacija radi na njegovom telefonu; potpuna funkcionalna provjera nije nezavisno izvršena')
assert str(p) in s and digest in s
h.write_text(s)
print('EXACT_TESTED_APK_READY_FOR_PUBLIC_DOWNLOAD')
