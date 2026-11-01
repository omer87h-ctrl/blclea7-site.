# Sense: lokalni govorni izlaz, opcionalni govorni unos i granice platforme

Provjereno: **28. oktobar 2026.**

Status: projektna politika zasnovana na pročitanoj službenoj dokumentaciji,
Web Speech nacrtu i izvornim MDN podacima kompatibilnosti. Dokument nije potvrda
da je neki konkretni telefon, glas ili novi native adapter već ispitan.
Ne mijenja dozvole aplikacije niti automatski uključuje mikrofon.

## Razlikovati tri nezavisne funkcije

1. **Govorni izlaz:** Sense izgovara naziv trenutnog koraka, raspoložive radnje
   ili tekst koji korisnik izričito odabere. Ovo je text-to-speech, bez potrebe
   da Sense sluša mikrofon.
2. **Govorni unos:** korisnik govori, a prepoznavanje vraća tekst ili kandidata
   za naredbu. To zahtijeva zaseban izbor, mikrofon i odgovarajuću dozvolu.
   Ne uključivati ga samo zato što je korisnik izabrao govorni izlaz.
3. **Sistemska asistivna tehnologija:** TalkBack, NVDA, Brajev redak i drugi
   izabrani alati čitaju semantički interfejs. Sense ne treba preuzimati njihovu
   kontrolu niti se predstavljati kao njihov univerzalni zamjenski servis.

Korisnik može biti gluh, slijep, gluhoslijep, imati preostali sluh/vid ili
jednostavno željeti drugi način rada. Funkcije bira pojedinačno; aplikacija ne
zaključuje dijagnozu ili sposobnosti iz jednog odabira.

## Govorni izlaz u browseru

`SpeechSynthesisVoice.localService` razlikuje glas koji platforma prijavljuje
kao lokalnu uslugu od udaljene usluge. To omogućava politiku koja iz dostupne
liste prihvata samo `localService === true`. Ne dokazuje da svaki uređaj ima
takav glas, da postoji glas za bosanski ili da je konkretan izgovor kvalitetan.

Izvor: [MDN: SpeechSynthesisVoice.localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService).

Lista glasova pripada trenutnom uređaju/pregledniku. Može se naknadno promijeniti;
interfejs treba obraditi `voiceschanged`, ne pretpostaviti da je prazna početna
lista konačno stanje i ne čekati beskonačno. Glas treba ponovo pronaći prije
izgovora; sačuvana oznaka nije garancija da glas još postoji.

Izvori: [MDN: getVoices()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices),
[MDN: voiceschanged](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event).

### Pravilo za Sense implementaciju

- Govorni izlaz je isključen dok ga korisnik ne izabere. Ne pokretati govor pri
  automatskom učitavanju ili pretpostaviti da slijepi korisnik želi drugi govor
  preko svog postojećeg čitača ekrana.
- Prikaži stvarne lokalne glasove i njihove jezike. Korisnik može isprobati
  kratak, neprivatan primjer. Ne reklamirati nepostojeći „Sense bosanski glas“.
- Veži konkretan odabrani glas za `SpeechSynthesisUtterance.voice`; samo
  postavljanje `lang` nije isto što i politika isključivo lokalnog glasa.
- Prije svakog izgovora provjeri da je isti glas i dalje dostupan i lokalno
  označen. Ako nije, zaustavi govor i objasni ograničenje. **Nema tihog prelaska
  na podrazumijevani ili udaljeni glas.**
- Upute govore ono što korisnik stvarno može izabrati: „Otvoren je pregled
  zahtjeva. Potvrdi navod ili otvori izvor.“ Ne izmišljati položaj fizičkog
  predmeta, radnju ili uspješno izvršenje.
- Puni CV, izvorni navod ili oglas čitaj tek nakon odgovarajuće korisničke
  radnje. Samo promjena fokusa ne treba automatski izgovoriti cijeli privatni
  dokument.
- Ograniči red govora, podrži ponavljanje i jasno dostupno zaustavljanje.
  Otkaži aktivni izlaz pri isključivanju, brisanju sadržaja ili napuštanju
  aplikacije. Govorna radnja nije potvrda promjene CV-a.
- Isti smisao ostaje dostupan tekstom, semantičkim oznakama i izabranim
  vizuelnim/taktilnim signalom. Zvuk ne smije biti jedini izlaz.

### Granica tvrdnje o privatnosti

`localService` je informacija koju daje platforma. Sense može odbiti glasove koje
ona prijavi kao udaljene i ne pozivati vlastiti cloud servis. To nije nezavisna
revizija operativnog sistema, instaliranog TTS providera ili dodataka
preglednika. CSP i odsustvo JavaScript `fetch` poziva također ne dokazuju da
drugi proces uređaja nikada ne komunicira mrežom. Korektna formulacija je:

> „Sense bira samo glas koji preglednik označava kao lokalni; ako takav glas
> nije dostupan, govor se neće pokrenuti.“

Za tvrdnju o stvarnom offline radu konkretnog uređaja potreban je dodatni test
s isključenom mrežom i provjera ponašanja tog uređaja. Čujni govor se može čuti
u okolini; lokalna obrada ne znači fizičku tajnost zvuka.

## Govorni unos u browseru: lokalnost nije podrazumijevana

Eksperimentalni `SpeechRecognition.processLocally` kada je `true` zahtijeva
lokalnu obradu. Kada je `false`, što je podrazumijevano, platforma može koristiti
lokalni ili udaljeni servis. Obično dodavanje `webkitSpeechRecognition` nije
garancija offline rada ili privatnosti. Prije početka treba provjeriti stvarnu
podršku svojstva, a ne samo upisati novo JavaScript expando svojstvo na objekt.

Izvor: [MDN: SpeechRecognition.processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally).

`SpeechRecognition.available({langs: [...], processLocally: true})` provjerava
lokalnu dostupnost za tražene jezike. Statusi uključuju `available`,
`downloadable`, `downloading` i `unavailable`; ne tumačiti rezultat kao običan
boolean. Provjera bez `processLocally: true` ne potvrđuje lokalni put. Politika
hostinga ili browsera može blokirati ovu mogućnost.

Izvor: [MDN: SpeechRecognition.available()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static).

`SpeechRecognition.install()` služi jezičkim paketima lokalnog prepoznavanja i
može pokrenuti preuzimanje. To nije dozvola za automatsko preuzimanje modela pri
otvaranju Sensea. Ako korisnik odabere instalaciju, treba mu objasniti da se
preuzima platformski paket, da mreža i slobodan prostor mogu biti potrebni i da
instalacija može biti odbijena. Nakon greške ne prelaziti na cloud.

Izvor: [MDN: SpeechRecognition.install()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/install_static).

Važeći Web Speech dokument je **Draft Community Group Report od 27. oktobra
2026**, a ne dokaz da je sve iz nacrta široko implementirano. Nacrt zahtijeva
informisan korisnički pristanak za govorni unos i definiše kontrolu pristupa
`available()`/`install()` kroz `on-device-speech-recognition` Permissions Policy.
Ugrađeni pregled unutar druge aplikacije ili iframea može imati drukčije
ograničenje od samostalnog otvaranja stranice.

Izvor: [Web Speech API — sigurnost, privatnost i platformski
ugovori](https://webaudio.github.io/web-speech-api/).

### Posebno važna razlika: desktop Chrome i Android Chrome

Izvorni MDN browser-compat-data pregledan 28. oktobra 2026. navodi desktop
Chrome podršku od verzije 139 za `processLocally`, dok za `chrome_android` navodi
`version_added: false`. I lokalni `available`/`install` parametri imaju Android
ograničenja. To je dokumentacijski nalaz, ne test korisnikovog uređaja, i može
se kasnije promijeniti. **Ne nuditi „lokalni glasovni unos radi na svakom
Android telefonu“.** Sama osnovna podrška SpeechRecognition API-ja nije dokaz
podrške njegove lokalne varijante.

Izvor: [MDN browser-compat-data: SpeechRecognition, izvorni podaci](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json).

### Predložena politika ako korisnik potvrdi da želi govorni unos

1. Odvojena, imenovana radnja za mikrofon; nema stalnog slušanja.
2. Lokalni API i traženi jezik moraju biti stvarno podržani. U protivnom
   razumljivo objasni ograničenje i ostavi kucanje, sistemski unos i prekidač.
3. Prije `start()` postavi i provjeri lokalni zahtjev. Nikada automatski ne
   postavljaj `processLocally = false` da bi funkcija „proradila“.
4. Prikazuj stvarno stanje slušanja i dugme „Zaustavi“. Odbijena dozvola,
   nepodržan jezik, prekid i timeout su zasebni razumljivi ishodi.
5. Prepoznati tekst je prijedlog koji korisnik može ispraviti. Naredba ne smije
   preskočiti potvrdu brisanja, zamjene dokumenta ili druge osjetljive radnje.
6. Ne čuvaj audio i ne šalji transkript vanjskom AI servisu. I transkript je
   privatni sadržaj; tretirati ga jednako kao kucani CV.

Ovaj dokument ne donosi korisnički izbor umjesto korisnika. Dok nije jasno
potvrđen govorni unos, govorni izlaz se može poboljšavati bez zahtjeva za
mikrofonom.

## Native Android mogućnosti su zaseban adapter

Android `SpeechRecognizer.createOnDeviceSpeechRecognizer` i
`isOnDeviceRecognitionAvailable` postoje od API 31. Dostupnost servisa treba
provjeriti; pozitivan opći `isRecognitionAvailable` nije ista provjera.
Prepoznavanje zahtijeva audio dozvolu i obradu životnog ciklusa, a objekat treba
osloboditi kada više nije potreban. Postojanje native API-ja ne znači da ga web
stranica ili postojeći CLEA APK već izlaže.

Izvor: [Android SpeechRecognizer — službeni API](https://developer.android.com/reference/android/speech/SpeechRecognizer).
Direktno otvaranje API stranice jednom je isteklo; korišten je službeni
indeksirani sadržaj i odgovarajuća AOSP deklaracija, bez preuzimanja koda.

Za native TTS Android `Voice.isNetworkConnectionRequired()` označava zahtijeva
li glas mrežu. To omogućava provjeru drugačijeg ugovora od browser
`localService`, ali opet ne garantuje da postoji željeni jezik ili da je paket
spreman. Provjere takvog budućeg adaptera moraju biti izvršene zasebno.

Izvor: [Android Voice.isNetworkConnectionRequired()](https://developer.android.com/reference/android/speech/tts/Voice#isNetworkConnectionRequired()).

## Šta testovi mogu dokazati

Automatizovano se mogu provjeriti: odbijanje udaljenih/nestalih glasova,
odbijanje nepoznatih opcija, ograničen red, stop/otkazivanje, odvojeno
uključivanje mikrofona i odsustvo neodobrenog cloud fallbacka. Test adapter
mora biti označen kao kontrolisani test, ne stvarni glas ili mikrofon.

Stvarni browser test bez instaliranih glasova provjerava razumljivu nedostupnost;
ne dokazuje izgovor. Potrebni su testovi konkretnih uređaja s izabranim glasom,
isključenom mrežom, TalkBackom/čitačem ekrana, odbijenom dozvolom i stvarnim
korisnicima. Slušno razumijevanje, kvalitet bosanskog izgovora, gluhoslijepa
upotrebljivost i potpuna nezavisnost od vanjskog saobraćaja nisu posljedica
samog prolaska JavaScript testa.

Nisu kopirani primjeri implementacije, glasovni modeli, audio ili tuđe
aplikacije. Ovdje su vlastita pravila integracije i kratki sažeci izvora.
Nema licence za redistribuciju glasova ili modela samo zato što su dostupni
preko sistemskog API-ja; Sense ne treba pakovati njihove datoteke bez zasebno
provjerenih uslova.
