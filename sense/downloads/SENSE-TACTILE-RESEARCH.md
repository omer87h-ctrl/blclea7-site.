# Sense: taktilni tekst, smisleni signali i provjerljiva pristupačnost

Datum pregleda: **28. oktobar 2026.**

Status: ograničen pregled primarnih istraživačkih izvora i službene platformske
dokumentacije. Ovo je istraživačka bilješka i prijedlog razvoja, ne potvrda da je
Sense već testiran s gluhoslijepim osobama ili da je njegov metod svjetski nov.

## Zaključak koji mijenja početnu pretpostavku

**Vibracijom se može prenositi i tekst, a ne samo kratko upozorenje.** Slova i
riječi mogu biti kodirani dogovorenim ritmom ili prostornim taktilnim obrascem.
Postoje dokumentovana rješenja koja to rade. Zato tvrdnja da vibracija može
služiti samo kao signal uz čitač ekrana nije dovoljno precizna.

Drugo je pitanje koliko korisnik može brzo, udobno i pouzdano razumjeti tako
prenesenu informaciju. Pretvoriti datoteku u niz impulsa nije isto što i omogućiti
osobi da lako pročita cijeli CV, tačno razumije nalaz i samostalno potvrdi radnju.
Za to trebaju odgovarajući kod, obuka, korisnička kontrola i mjerenje stvarne
uspješnosti. Jedan vibracioni motor telefona također nema iste mogućnosti kao
više odvojenih aktuatora ili pravi Brajev redak.

## Šta već postoji: provjereni primarni izvori

### 1. Taktilni Morse za rad na računaru — 1984.

Zuckermanov rad opisuje korištenje međunarodnog Morseovog koda kroz vibrotaktilni
uređaj za povratnu informaciju pri pisanju i pregled sadržaja ekrana kod
gluhoslijepih osoba. To je direktan prethodnik široke ideje „digitalni tekst kroz
vibraciju“. Pročitan je javni bibliografski zapis i sažetak, ne puni rad niti
nezavisna reprodukcija uređaja.

Izvor: [Use of personal computing technology by deaf-blind individuals,
Journal of Medical Systems, oktobar 1984.](https://pubmed.ncbi.nlm.nih.gov/6239896/)

### 2. Tactons — strukturirane taktilne poruke, 2004.

Brewster i Brown opisuju taktilne poruke zasnovane na ritmu, trajanju, lokaciji i
drugim parametrima vibracije. Ovaj rad podržava razliku između taktilnog
„rječnika događaja“ i kodiranja cijelog teksta. Sama ideja da potvrda, upozorenje
i stanje imaju različite taktilne obrasce nije nova.

Izvor: [Tactons: structured tactile messages for non-visual information display,
University of Glasgow, januar 2004.](https://eprints.gla.ac.uk/3443/)

### 3. Mobile Lorm Glove — 2012.

DFKI opisuje prototip rukavice koja povezuje Lormovu taktilnu abecedu i tekst.
Ulaz koristi pritisne senzore, a primljene poruke predstavljaju mali motori na
rukavici. Projekt je razvijan participativno. To potvrđuje mogućnost dvosmjerne
taktilne komunikacije, ali ne dokazuje da isti doživljaj može proizvesti jedan
motor običnog telefona ili da svaki gluhoslijepi korisnik zna Lorm.

Izvor: [Gollner, Bieling i Joost: Mobile Lorm Glove,
DFKI / TEI 2012.](https://www.dfki.de/en/web/research/projects-and-publications/publication/11000)

### 4. Brajeve tačke na vibrotaktilnoj narukvici — 2017.

Izdavač opisuje narukvicu sa šest taktilnih izlaza i poređenje načina njihovog
aktiviranja. Prijavljena uspješnost prepoznavanja znakova do 97% odnosi se na
konkretne eksperimentalne uslove; nije dokaz brzine čitanja proizvoljnog teksta
ili pristupačnosti običnog telefona. Prostorni raspored šest izlaza ne treba
preimenovati u softversku mogućnost jednog motora.

Izvor: [Schätzle, Weber i Leichtmann: Hands-free reading Braille with a
vibrotactile wristband, IADIS 2017.](https://www.iadisportal.org/digital-library/hands-free-reading-braille-with-a-vibrotactile-wristband)

### 5. Učenje vibrotaktilnog Morsea — 2020.

Plaisier, Vermeer i Kappers ispitivali su učenje bez vizuelnog prikaza, uz dva
motora na odvojenim rukama. U sažetku navode 15–24 naučena slova tokom 30 minuta;
prepoznavanje riječi bilo je slabije kod dužih riječi. Nalaz pokazuje i potencijal
i potrebu za dodatnim učenjem. Broj motora i eksperimentalni zadatak moraju biti
sačuvani u tumačenju rezultata.

Izvor: [Learning the Vibrotactile Morse Code Alphabet, TU Eindhoven / ACM TAP,
avgust 2020.](https://research.tue.nl/en/publications/learning-the-vibrotactile-morse-code-alphabet/)
Direktni PDF vratio je 403 tokom pregleda; korišten je primarni univerzitetski
zapis sa sažetkom i bibliografijom, uz izdavačev indeksirani sažetak.

### 6. HELF — tekst preko vibracije običnog Android telefona, 2021.

Ovo je posebno važan prethodnik: autori predstavljaju Android aplikaciju i
vlastiti kratki/dugi taktilni kod za slova i brojeve, bez dodatnog uređaja.
Ispitivanje je obuhvatilo 13 osoba: pet slijepih i osam videćih. U preliminarnim
rezultatima navode približno 91% tačnosti čitanja i 25,7 znakova u minuti.
To nisu rezultati Sensea, nisu dokaz čitanja bilo kojeg sadržaja i nisu
ispitivanje grupe gluhoslijepih osoba. Kod i tabele iz rada nisu preuzeti.

Izvor: [Singh, Jatana i Goel: HELF, online objava 28. avgusta 2021;
izdanje časopisa 2023.](https://pmc.ncbi.nlm.nih.gov/articles/PMC8401351/)

## Stvarne platformske granice

### Browser

Aktuelni nacrt W3C Vibration API-ja namijenjen je jednostavnim impulsima i
pauzama. Ne pruža proizvoljnu kontrolu frekvencije ili jačine. Traži prethodnu
korisničku interakciju; skriven dokument može biti odbijen, a implementacija može
ograničiti trajanje ili broj zahtjeva. Podrška nije univerzalna: dokument navodi
Chromium implementacije, protivljenje WebKita i uklonjenu Firefox implementaciju.
Povratna vrijednost API-ja ne dokazuje da je čovjek osjetio ili razumio signal.

Izvor: [W3C Vibration API, tekući nacrt provjeren 28. oktobra
2026.](https://w3c.github.io/vibration/)

### Native Android

Android nudi bogatije haptike, ali mogućnosti treba provjeriti na stvarnom
uređaju: postoji li vibrator, kontrola amplitude i podrška potrebnim primitivima.
Nepodržani parametri ne smiju biti predstavljeni kao dodatna sposobnost
hardvera. Standardni view feedback i direktni VibrationEffect imaju različite
zahtjeve za manifest; direktni efekti zahtijevaju `VIBRATE`. Korisničke postavke
i pravila platforme ostaju važeći. Native podrška je zaseban implementacijski
posao, ne automatska posljedica dodavanja browser dugmeta.

Izvor: [Android haptics API reference, službena dokumentacija, ažurirana
26. oktobra 2026.](https://developer.android.com/develop/ui/views/haptics/haptics-apis)

### Brajev redak kroz operativni sistem

TalkBack može povezati podržani Brajev redak preko Bluetootha ili USB-a i
predstaviti sadržaj ekrana te omogućiti navigaciju. Sense zato treba pravilno
izložiti semantičke kontrole i tekst, umjesto tražiti pristup svakom pomagalu
unutar aplikacije. Kompatibilnost konkretnog retka, jezika i uređaja ostaje
zasebna provjera; ovo istraživanje je nije izvršilo.

Izvor: [Google Android Accessibility Help: Connect to a braille
display](https://support.google.com/accessibility/android/answer/3535226?hl=en)

## Tri opravdana pravca poboljšanja Sensea

Ovo su **vlastiti projektni prijedlozi i provjerljive hipoteze**, ne dokazi da
drugi proizvodi to nikada nisu radili ili da smo ih već nadmašili.

1. **Jedan semantički događaj, više ravnopravnih izlaza.** Provjereni BIL nalaz
   ima stabilan identifikator, status i izvor. Isti događaj može pokrenuti
   taktilni obrazac, vidljivi oblik/ritam i semantičku tekstualnu poruku. Korisnik
   bira izlaze bez potrebe da navodi invaliditet. Promjena prikaza ne smije
   promijeniti značenje nalaza ili zaobići potvrdu. Mjeriti razlikovanje događaja,
   pogrešne potvrde i uspješno izvršen zadatak, a ne broj animacija.
2. **Taktilni čitač izvora pod korisničkom kontrolom.** Kratki signal prvo
   kaže „ovaj zahtjev treba pregled“. Korisnik zatim izričito bira originalni
   tekst zahtjeva ili povezani navod za detaljno čitanje podržanim taktilnim
   kodom. Potrebni su trening, kalibracija tempa, ponavljanje znaka/riječi,
   pauza, povratak i nastavak bez gubitka mjesta. Nejasan ili nepodržan znak ne
   smije biti tiho izbačen. Tačnost enkodera je automatizovana provjera; brzina
   i razumljivost su provjera sa stvarnim korisnikom. Za potvrdu prijave koristiti
   izvorni tekst, ne samo AI sažetak.
3. **Adapter koji priznaje mogućnosti uređaja.** Browser nudi osnovni obrazac;
   zasebni native adapter može ponuditi provjerene bogatije efekte; korisnikov
   postojeći Brajev redak može dobiti semantički sadržaj kroz sistem. Priprema
   poruke ostaje lokalna. Ako izlaz zakaže, ne bilježiti uspješno ljudsko
   razumijevanje i ne izvršavati osjetljivu radnju. Mjeriti prekide, oporavak,
   trošenje resursa i uspješnost na stvarnom hardveru.

## Kriteriji prije tvrdnje da Sense ovo pouzdano podržava

- Tačno definisan, verzionisan ugovor poruke i adaptera; odbijanje nepoznatih
  događaja, ograničenje trajanja i otkazivanje pri odlasku iz aplikacije.
- Kodiranje i dekodiranje podržanih znakova bez gubitka; izričita obrada
  bosanskih dijakritika, interpunkcije, brojeva i nepodržanih simbola.
- Korisnički izbor i jednostavno isključivanje; bez automatskog pokretanja
  dugog taktilnog teksta. Vibracije mogu biti čujne ili opazive ljudima u blizini;
  „lokalno“ nije garancija potpune tajnosti fizičkog izlaza.
- Testovi stvarne diskriminacije obrazaca, razumijevanja teksta, zamora,
  ponavljanja i oporavka sa slijepim i gluhoslijepim osobama. Uključiti ljude
  različitih taktilnih sposobnosti; ne generalizovati male uzorke na sve.
- Razdvojiti prihvaćen API poziv, fizičko izvršavanje uređaja, korisnikovo
  prepoznavanje i ispravno shvatanje. Softverski test ne dokazuje sva četiri.
- Nema tvrdnje da Sense nadomješta sva čula, da je nepogrešiv ili da jedna
  univerzalna vibraciona abeceda odgovara svakome.

## Originalnost, pravo korištenja i granice ovog pregleda

Nisu preuzeti tuđi kod, algoritamska implementacija, taktilna abeceda,
ilustracije, PDF-ovi, modeli ili sadržaj korisnika. Ovdje su vlastiti kratki
sažeci i direktni izvori. Opći princip kodiranja poruke nije sam po sebi dokaz
novog izuma. Dostupnost naučnog rada nije dozvola za preuzimanje njegove
zaštićene izvedbe ili redistribuciju. Postojeće CLEA licence se ne mijenjaju.

Pretraga nije iscrpna patentna analiza, provjera svih tržišta, naziva ili
slobode poslovanja. Nema osnove za „nigdje ne postoji“. Postoji osnova za
ambiciozno, vlastito i mjerljivo poboljšanje integracije — ako korisnički
testovi dokažu da je čovjeku zadatak zaista lakši.
