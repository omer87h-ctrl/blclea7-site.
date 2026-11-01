# BL CLEA Sense 7 — izvršni i podatkovni ugovor 0.17

Status: **testna razvojna verzija**. Datum: 28. oktobar 2026.

Sense je lokalni radni prostor za pregled veze između korisnikovog CV-a i jednog
oglasa. Koristi originalni BIL kompajler, Core/2 operacije i kontrolisani Runtime.
Ovaj dokument opisuje implementaciju, ne certifikaciju tačnosti, pristupačnosti,
sigurnosti ili svjetske novosti.

## Izvršni tok

1. Korisnik sam unosi tekst iskustva i oglasa. Ime, kontakt i dijagnoza nisu
   potrebni za analizu. Korisnički tekst nije programski izvor.
2. `sense-engine.js` provjerava oblik i veličinu ulaza, normalizuje krajeve redova
   i pravi izvorne raspone odlomaka. `sense-lexicon.js` sadrži ograničen, vlastito
   napisan rječnik i alias-e; nije preuzeta baza zanimanja ili AI model.
3. Parser traži podržane zahtjeve, navode i kontekst. Izvorni tekst ostaje uz svaki
   nalaz. Neprepoznati ili složeni uslovi ostaju za korisnički pregled.
4. U BIL ulaz ulaze tipizirani identifikatori i logička stanja: vrsta zahtjeva,
   obaveznost, pronalazak navoda, negacija, nejasnoća, neslaganje i korisnički izbor.
   Izvorni CV i oglas ne ulaze u BIL politiku kao tekst za izvršavanje.
5. Kompajlirani `sense-policy.bil` izvršava `assess`. BIL funkcija `classify`
   određuje status; isti tok računa stvarne brojeve nalaza. Interfejs ih ne
   zamjenjuje dekorativnim ili modelom izmišljenim rezultatom.
6. Interfejs prikazuje zahtjev, mogući navod, razlog i izbor korisnika. Za izmjenu
   prvo pokreće izoliranu SHADOW analizu, zatim traži izričito prihvatanje.
7. Nacrt bira izvorne dijelove povezane s podržanim, potvrđenim zahtjevima.
   Korisnik može naknadno uređivati tekst; takve izmjene više nisu automatski
   potvrđene izvornim navodima.

Politika je objavljena i kao `.bil` datoteka i kao tačan `POLICY_SOURCE` u modulu.
Njihova jednakost dio je izvršivih testova.

## Parser i granice stručnosti

Podržani obrasci obuhvataju određene vještine, obrazovanje, certifikate, jezike,
izričito trajanje iskustva, rokove i priloge. Rječnik obuhvata ograničene bs/hr/en
izraze. To nije opće razumijevanje svih zanimanja, jezika ili slobodnog govora.

Implementacija razlikuje negacije, početničke/nejasne navode, određene CEFR nivoe
i izričito zapisano trajanje. Jednostavna alternativa poput „SQL ili Python“
predstavlja jedan alternativni uslov. Složene alternative zahtijevaju ručni pregled.
Naslovi podržanih sekcija mogu prenijeti prioritet na naredne stavke. Ove heuristike
mogu pogriješiti kod složenih rečenica; korisnik mora imati pristup punom izvoru.

Nedostajući navod nije dokaz da osoba nema vještinu. Poklapanje naziva nije dokaz
stručnosti. Potvrda korisnika bilježi njegov izbor i odgovornost za navod; ne
potvrđuje identitet, diplomu, zaposlenje ili istinitost životnog iskustva.

Brojevi `supported / total` i `mandatoryOpen` opisuju nalaze ovog pravila nad
dostavljenim tekstom. **Nisu procenat odbijenice, stvarni ATS rezultat ili
vjerovatnoća zaposlenja.** Nema kalibriranog modela ishoda poslodavaca.

## Statusi i njihovo značenje

| Izvršni status | Korisničko značenje |
|---|---|
| `supported` | Postoji odgovarajući navod i korisnička potvrda, ili potvrđen korak pripreme. |
| `unconfirmed` | Pronađena je moguća veza koja čeka pregled korisnika. |
| `notfound` | U dostavljenom CV-u nije pronađen odgovarajući navod. |
| `contradicted` | Izričita negacija, prepoznato neslaganje nivoa/trajanja ili korisničko odbijanje veze. |
| `needsclarification` | Nejasan ili ograničen navod, nepoznat uslov ili korak koji treba provjeriti. |

Redoslijed i razlozi nalaze se u stvarnoj BIL funkciji, a tekst objašnjenja u
verzionisanom registru modula. AI nije pozivan ni korišten za klasifikaciju.

## Izvor, potvrde i izolirana promjena

Svaki raspon ima `start`, `end`, `line`, `column` i izvorni tekst. Pomaci odgovaraju
JavaScript UTF-16 indeksima nad ulazom s normalizovanim krajevima redova, ne broju
vizuelnih znakova. Povezani navod može se označiti u originalnom polju.

Engine vodi vlastite zamrznute izvještaje u privatnom registru. SHADOW i nacrt
prihvataju izvještaj iz odgovarajuće instance, ne proizvoljan JSON koji izgleda kao
izvještaj. SHADOW ponovo izvršava stvarnu BIL politiku nad kopijom ulaza; prethodni
izvještaj ostaje nepromijenjen. To je izolacija podataka i izvršnog konteksta, ne
novi proces ili OS sandbox.

Kada se povezani izvorni navod promijeni u alternativnom CV-u, ranija potvrda za
taj navod ne smije biti tiho prenesena. Izmjena zahtijeva novu provjeru. Interfejs
prije prihvatanja provjerava da je prikazana alternativa još vezana za isti
trenutni izvještaj. Odbačena ili zakašnjela analiza ne treba mijenjati LIVE prijavu.

Izvoz projekta ne predstavlja dokaz porijekla ili elektronski potpis osobe.
Uvezeni podaci se validiraju i ponovo analiziraju; spremljeni nalaz nije trajno
ovlaštenje za izvršavanje.

## Core/2 i SDK

Sense politika stvarno koristi `guard`, `text.trim` i `collections.contains`.
Kompajler provjerava tipove, a interpreter izvršava postojeće provjerene instrukcije.
`guard` spušta na BRANCH/RAISE; nije JavaScript `eval` niti skriveni AI poziv.

Core/2 dodaje sedam tekstualnih i četiri kolekcijske operacije. Postojeće
`text.length` ponašanje ostaje UTF-16; nove code-point operacije ne predstavljaju
potpunu grapheme analizu. Detalji su u [BIL-CORE-2.md](BIL-CORE-2.md).

Stari programi zadržavaju postojeće kompajlerske rezultate i ugovore. Novi Core/2
program zahtijeva **Runtime 0.17.0**, čak i kada koristi postojeći application/IR
format. SDK i JavaScript host određuju stvarni minimum; stari host mora odbiti
novi program. Python provjera omotača ostaje strukturna, dok izvršni JS host ponovo
kompajlira izvor i provjerava odgovarajući IR. Vidi [SDK-CORE-2.md](SDK-CORE-2.md).

Objavljeni Windows/Android 0.15 paketi i raniji browser 0.16 nisu ovim izmjenama
pretvoreni u 0.17. Nema novog potvrđenog native 0.17 builda ili fizičkog testa.

## Sedam odgovornosti u ovoj implementaciji

| Stub | Šta se stvarno koristi |
|---|---|
| Core AI Manager | Ograničenja veličine, broja zahtjeva, instrukcija, vremena i prekida. Sense ne instalira AI model. |
| Link Bridge Elite | Tipizirani ulaz između tekstualnog parsera, BIL politike, Runtimea, interfejsa i SDK-a. |
| Expansion Q | Verzionisani Core/2 registar, zatvoreni rječnik i poznate vrste/statusi nalaza. |
| Adaptive Recovery | Čuvanje prethodnog prihvaćenog izvještaja, odbijanje neispravnog ulaza i kontrolisane izmjene. |
| Holo Interaction | Izvorno povezani prikaz, korisničke potvrde, tastatura, vođeni pregled i podesiv prikaz. |
| Fallback Executor | Nejasan/nepodržan tekst ide na ručnu provjeru; nema izmišljenog dokaza ili uspjeha. |
| Vision Q | Stvarni izvorno mapirani BIL trag, razlozi, brojevi nalaza i mjerena trajanja. |

Sedam naziva predstavljaju arhitekturne odgovornosti. Ne predstavljaju sedam
modela, sedam novih naučnih izuma ili dokaz nadmoći nad drugim sistemima.

## Privatnost i sigurnosne granice

- Nema kamere, mikrofona, lokacije, kontakata, čitanja drugih aplikacija, remote AI
  servisa, automatske analitike ili preuzimanja korisničkih profila.
- Web hosting vidi zahtjeve za statičke datoteke prema svojim pravilima. To je
  odvojeno od lokalne obrade unesenog sadržaja; ne tvrdi se da cijeli uređaj nema
  mrežnu aktivnost ili da su svi browser dodaci pod Sense kontrolom.
- Sadržaj je u memoriji otvorenog prostora dok korisnik izričito ne sačuva projekt
  ili preuzme datoteku. Postavke prikaza čuvaju se odvojeno.
- Lokalno sačuvan projekt i preuzeti JSON/TXT sadrže korisnički tekst. **Nisu
  šifrovani trezor.** Drugi korisnik istog browser profila može im pristupiti.
- Izvršni trag zadržava identifikatore, instrukcije, lokacije i mjerene podatke,
  bez izvornog CV-a i oglasa. Izričito preuzeti puni izvještaj sadrži oba teksta.
- Import odbija nepoznat format, neodgovarajuće tipove, opasne ključeve i prevelik
  ulaz. Korisnički sadržaj prikazuje se kao tekst, ne izvršivi HTML.
- Prekid koristi signal i odbacivanje zakašnjelog rezultata. To nije obećanje
  trenutne OS preempcije proizvoljnog koda; ovdje se izvršava ograničena politika.

Engine granice: CV 48.000, oglas 24.000 UTF-16 jedinica, do 64 zahtjeva i 256
odlomaka/navoda; engine JSON projekt do 180.000 jedinica. Interfejs može postaviti
strože granice. Prekoračenje ili ograničeni pregled moraju biti jasno označeni.

## Pristupačnost i dokazivanje

Prikaz nudi tastaturu, postojeće sistemske čitače ekrana, povećanje teksta, visok
kontrast, smanjeno kretanje, vođeni pregled i skeniranje glavnih akcija. Korisnik
ne mora navoditi dijagnozu. Skeniranje očekuje tipku tastature; ne otkriva niti
upravlja proizvoljnim Bluetooth pomagalom.

Automatizovani test može provjeriti DOM, fokus, događaje, reflow, klasifikaciju,
izolaciju i stvarni izvoz. Takav test nije zamjena za TalkBack/NVDA, fizički
prekidač, Brajev redak ili provjeru sa slijepim i gluhim korisnicima. Podršku
konkretnom pomagalu i kvalitet izvoznog PDF-a treba zasebno provjeriti.

Aktuelne rezultate i precizan obim vodi
[acceptance/core2-sense-017.json](acceptance/core2-sense-017.json). Opis testa ili
postojanje dugmeta nije potvrda uspješnog testa.

## Originalnost i granice tvrdnji

Kod Sense parsera, politike, interfejsa i Core/2 proširenja razvijen je za CLEA.
Poznati nazivi vještina i opće tehnike nisu dokaz ekskluzivnog izuma. Nisu preuzeti
zatvoreni kompajleri, modeli konkurenata ili njihovi privatni podaci.

[SENSE-PRIOR-ART.md](SENSE-PRIOR-ART.md) bilježi 13 pregledanih javnih primarnih
izvora i direktne prethodnike za više dijelova principa. Nema osnove za tvrdnju
„ne postoji nigdje“, patentnu pravnu ocjenu ili globalnu superiornost. Moguća
prednost cijele CLEA integracije ostaje hipoteza koja se ispituje istim ulazima,
greškama, vremenom i stvarno završenim korisničkim zadacima.

## Izvorno pokriće i vođena dopuna

Izvještaj dodatno sadrži sourceReview, sourceReviewTotal i sourceReviewComplete: izvorne odlomke s klasifikacijom section/classified/excluded/unclassified i referencama na stvarne zahtjeve. Pregled je ograničen na 256 odlomaka uz izričit indikator skraćenja. Nepoznat odlomak se ne pretvara u izmišljeni zahtjev. Interfejs ga čuva za korisnikov pregled. Pojasni ovaj navod sastavlja samo doslovni dodatni opis korisnikovih riječi te poziva postojeću SHADOW provjeru, uz poseban izbor prihvatanja.
