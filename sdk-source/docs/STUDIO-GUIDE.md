# Napravi vlastitu aplikaciju u BLclea7 Studiju

Web i Windows Studio koriste isti vizuelni BIL editor, kompajler i aplikacijski model. Windows izdanje dodaje lokalnu izgradnju instalabilnih aplikacija. Ne moraš početi od predloška niti koristiti AI.

## 1. Otvori prazan projekt

Pritisni **Kreiraj aplikaciju bez koda**. Dobiješ početni ekran i vođeni radni prostor **Od ideje do aplikacije**. Postojeći projekti i napredni JSON editor ostaju dostupni. U BIL projektu kartice Dizajn, Ponašanje i Podaci vode na zajednički vizuelni BIL radni prostor.

## 2. Definiši podatke

U **Podaci · dodaj vrijednost** izaberi naziv, tip i početnu vrijednost. Podržani su brojevi, tekst, Da/Ne, tipizirane liste i vlastiti zapisi. **Modeli podataka · vlastiti zapis** omogućava da odrediš polja i tipove vlastitog modela, a zatim kreiraš vrijednosti i liste tog tipa. Konstanta se može čitati, ali je događaji ne smiju mijenjati.

Primjer: `nickname` kao Text, `offset` kao Number i `notes` kao lista vlastitog modela Note. Ovi nazivi su identiteti podataka; korisniku svoje aplikacije možeš prikazati drugačije oznake.

## 3. Složi interfejs

U **Dodaj ekran ili komponentu** napravi ekrane i dodaj naslove, tekst, unose, izbore, tabele, dugmad, kartice, redove i originalne geometrijske oblike. Unos poveži s odgovarajućim podatkom; tabelu s listom zapisa i odvojenim brojem za odabir reda.

Komponente možeš pomjerati, duplicirati i premještati između rasporeda i ekrana. Dodirne ručke i strelice nude alternativu povlačenju. U **Izgled i animacija** uređuješ boje, tipografiju, dimenzije, raspored, gradijente i ograničene animacije. Obje boje gradijenta primjenjuju se zajedno. Numeričke osobine mogu pratiti stvarni Number podatak, npr. `@offset` za položaj x.

## 4. Napravi događaj i radnje

U **Događaji · šta se dešava?** kreiraj događaj, npr. `advance`. Dodaj jednu ili više radnji: postavi ili izračunaj podatak, povećaj broj, promijeni Da/Ne, otvori ekran, provjeri uslov, ograničeno ponavljaj ili prijavi grešku. Izraze sastavljaš izborom stvarnih podataka, vrijednosti i registrovanih operacija. Dostupno je sastavljanje vlastitog zapisa i operacije kolekcija.

Za uslov prvo dodaj Ako radnju, a zatim u **Grana za novu radnju** izaberi Ako je tačno ili U suprotnom. Radnje možeš premještati, uklanjati i uređivati. Neispravni tipovi, nepoznati ciljevi i upis u konstantu odbijaju se prije primjene. Pri grešci izvršavanja lokalne promjene događaja vraćaju se prethodnom stanju.

## 5. Poveži dugme ili gest

Na komponenti otvori **Na dodir · radnja dugmeta**. Izaberi Pokreni događaj ili Otvori ekran i pritisni **Poveži radnju dugmeta**. Možeš i kreirati novi događaj neposredno na dugmetu, a zatim ga urediti preko **Uredi ovaj događaj**. Prazan događaj je jasno označen: takvo dugme još nema radnje koje izvršava.

Na podržanoj kartici, obliku ili tekstu možeš povezati dodir, pritisak ili povlačenje s postojećim događajem. Runtime nudi i pristupačne alternative i poštuje reduced-motion postavku. Gestovi nisu proizvoljne native operacije.

## 6. Pokreni i provjeri

Pritisni **Provjeri i pokreni aplikaciju** ili gornje **Pokreni**. Izvor se provjerava i primjenjuje prije pokretanja. Dizajnerski pregled koristi odvojene probne podatke; glavni Runtime pregled čuva stvarne lokalne podatke aplikacije. Unesi vrijednost, pritisni svoja dugmad i provjeri rezultat i stvarne događaje u debuggeru. **Pokreni ponovo** treba sačuvati kompatibilno stanje. **Vrati početno stanje** namjerno briše stanje uz potvrdu.

Nakon prve probe možeš dodati novu tipiziranu vrijednost: Runtime inicijalizuje samo novi podatak i čuva postojeće kompatibilne vrijednosti. Promjena tipa ili uklanjanje postojećeg podatka zahtijeva zasebnu provjerenu migraciju; greška ne briše spremljene podatke.

**Sačuvaj** provjerava i uključuje trenutnu BIL skicu u lokalni projekt. Poništi kod / Vrati kod rade i preko primjene izvora. Brisanje podataka preglednika može ukloniti lokalne projekte i podatke; preuzmi odvojene kopije projekta i korisničkih podataka. Greška skladišta nije uspješno spremanje.

## 7. Izvezi odgovarajući rezultat

- **Preuzmi web aplikaciju** daje izvršiv samostalni HTML za podržane lokalne aplikacije. Otvori ga u pregledniku. Vanjski backend i Android funkcije nisu simulirani u tom izvozu.
- **Preuzmi paket za zasebni Runtime** daje provjereni instalabilni `.clea7` paket. U zasebnom Runtimeu izaberi datoteku, pregledaj instalaciju i pokreni aplikaciju iz biblioteke. Izvorni projekt i instalabilni paket imaju različite ugovore; koristi pravi izvoz za instalaciju.
- **Preuzmi .bil** čuva izvor jezika. **Preuzmi CLEA7 projekt** čuva razvojni projekt. To nisu APK datoteke.
- U Windows Studiju **Android i izvoz** vodi do upravljanog alatnog lanca i **Izgradi APK na ovom računaru**. JDK, Android SDK i Gradle preuzimaju se sa službenih izvora tek nakon tvoje saglasnosti i prihvatanja potrebnih uslova. APK uključuje Runtime. Debug APK služi testiranju; javna distribucija zahtijeva kontrolisan identitet i potpisivanje.

## Napredni razvoj

BIL izvor ostaje dostupan i autoritativan. Funkcije, asinhroni adapteri i ostali podržani napredni kod se ne brišu zato što ih jednostavniji vizuelni prikaz ne može urediti. Adapteri provjeravaju mogućnosti platforme i dozvole. Konfiguracija razvoja s udaljenim servisima odvojena je od lokalnih aplikacija; postojanje vizuelnog editora samo po sebi ne postavlja produkcijski server, privatna pristupna pravila ili udaljene push obavijesti.

Originalni `sdk/examples/bil/orbitavo.bil` nastao je kroz stvarne kontrole Studija u automatizovanoj provjeri. Pokazuje ekrane, vlastiti model, kolekciju, unos, tabelu, uslove, dugmad, gest i animirani oblik. Test provjerava njegovo izvršavanje, izvoz, zasebnu instalaciju i trajnost podataka; sam primjer ne predstavlja cijeli opseg general-purpose platforme.

### Čitanje zapisa i odgovora adaptera

Za podatak kao što je `notes[0].body` odaberi **Polje iz zapisa**, zatim za zapis **Stavka iz liste**, izaberi listu, indeks i polje. Compiler provjerava tipove; nepostojeće polje odbija se prije pokretanja, a izlazak iz granica liste prekida lokalnu transakciju bez djelimičnog upisa. Možeš koristiti i registrovanu operaciju `collections.at`.

Događaji označeni **odgovor adaptera** prikazuju svoje tipizirane parametre u izboru podataka. Njihove radnje uređuju se istim kontrolama. Parametri su samo za čitanje. Nullable odgovor najprije provjeri uslovom `rezultat != null`; dodaj čitanje njegovog polja u tačnu granu. Ovi događaji primaju samo provjeren odgovor zahtjeva ili pretplate; ne mogu biti obična radnja dugmeta ili gesta. Konfiguracija stvarnog adaptera ostaje potrebna.
