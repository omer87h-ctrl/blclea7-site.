# CLEA Working Cache 0.18

Ovaj cache čuva provjerene rezultate čistog rada i njihove tačne zavisnosti.
Ne pravi sliku cijelog stanja aplikacije, ne izmišlja fizičku memoriju i ne vraća
stari snapshot umjesto trenutnih korisničkih podataka.

Implementacija `web/workbench/working-cache.js` je lokalna RAM biblioteka bez
mreže, DOM-a, diska ili telemetrije. Ne koristi se za HTTP, autentikaciju,
native radnje, neizvjesne vanjske efekte ili proizvoljan korisnički kod.

## Šta se stvarno zadržava

Ključ sadrži ID provjerene instrukcije, kanonski tip i tačan kanonski opis
zavisnosti. Zapisi sortiraju ključeve; redoslijed lista ostaje značajan.
Ne koristi se gubitnički hash koji bi promijenjen ulaz mogao proglasiti istim.
Rezultati se kopiraju i zadržavaju kao nepromjenjive podatkovne strukture.
Vraćena vrijednost nije isti objekat kao interno zadržani rezultat.

Neispravni brojevi, getteri, izvršni objekti, prototipne zamke, ciklusi, prevelike
vrijednosti i nepodržani oblici se odbijaju. Neslaganje rezultata ili logičkog
troška za isti ključ izaziva karantin tog čvora umjesto proizvoljnog izbora.

## Transakcija

```js
const cache = CLEA7Core.createCache({
  scope: 'original_app:local_principal',
  program: 'checked_program_generation',
  budgetBytes: 262144,
  maxEntries: 128,
  minComputeMs: 0.1
});
const transaction = cache.begin();
// Core.execute(..., { cache: transaction }) izvršava stvarni program.
// Tek poslije uspješne aplikacijske pohrane:
transaction.commit();
// Na neuspjeh: transaction.rollback().
```

Engine otvara transakciju za događaj, provjerava rezultat i prikaz, atomski
čuva stanje pa potvrđuje novo zadržavanje. VM sam ne potvrđuje transakciju.
Pri grešci se staged izlazi odbacuju. Zatvaranje ili promjena generacije poništava
i već otvorene transakcije. Povratak ranijem ulazu može ponovo koristiti njegov
rezultat bez vraćanja drugih aplikacijskih polja na staro stanje.

Svaki Engine ima zasebnu instancu. Promjena korisničkog prostora, kompatibilna
promjena koda ili zatvaranje odbacuje prethodni cache. SHADOW i REPLAY koriste
odvojeno stanje i cache. Cache nije trajno sačuvan među restartima.

## Granice i izbor

Podrazumijevano: obračunski budžet 256 KiB, 128 zapisa, najviše 32 aktivne
transakcije i prag prethodno izmjerenog računanja 0,1 ms. Jedan host može
eksplicitno izabrati drugi dozvoljeni budžet. Staged i objavljeni podaci dijele
isti obračun; privremeni rad nije neograničeno izuzet iz njega.

Izbacivanje uzima u obzir starost, broj korištenja, obračunsku veličinu i
prethodno izmjereni trošak. Jeftin rad može biti ponovo izračunat. Ovo je konkretna
politika, bez tvrdnje da je optimalna na svakom uređaju.

`retainedBytes` je ograničen obračun ključeva, rezultata i rezervi. Ne mjeri cijeli
JavaScript heap, privremene kopije VM-a ili ukupnu memoriju OS procesa.
Cache ne obećava nultu potrošnju baterije niti ubrzanje svakog programa.

## Logički budžet i mjerenje

Izvedeni rezultat može zadržati provjeren broj logičkih instrukcija koje njegov
izraz predstavlja. Cache pogodak naplaćuje taj isti logički trošak, dok zaseban
brojač stvarnih instrukcija prikazuje izbjegnuto izvršavanje. Tako cache ne služi
za zaobilaženje jezičkog instrukcijskog limita. Kada se izvedena vrijednost čita
unutar aktivnog poziva funkcije, VM konzervativno računa izraz ponovo umjesto
korištenja cachea, čime čuva provjeru raspoložive dubine poziva.

Vremenski rok ostaje granica stvarnog izvršavanja, pa zavisi od hosta, rasporeda
i opterećenja. Jednak rezultat za podržane čiste programe ne znači identično
trajanje ili identičan ishod na fizički iscrpljenom uređaju.

`snapshot()` prikazuje brojače, razloge, broj zapisa i obračunske bajtove, bez
ulaznih vrijednosti ili privatnih rezultata. `referenceComputeMs` je zbir ranijih
izmjerenih troškova vezanih za pogodak; **nije izmjereno ušteđeno vrijeme**.
Za tvrdnju o brzini treba uporediti ista stvarna izvršavanja s uključenim i
isključenim cacheom, uključujući trošak provjera, kopiranja i zadržavanja.

`clearWorkingCache()` i `setCacheEnabled(false)` ne brišu spremljene podatke.
Razvojna dijagnostika je eksplicitna u samostalnom browser Runtimeu; produkcijski
način ne izlaže replay snapshotove ni detaljne BIL tragove u svom izvještaju.
