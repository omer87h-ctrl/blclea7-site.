# BL CLEA Sense — pregled prethodnih rješenja i granice tvrdnje o novosti

Datum istraživanja: **27. oktobar 2026.**

Status: ograničena pretraga javnih izvora, ne iscrpna provjera patenata, prava ili tržišta. Pregledani su opisi proizvoda, službena dokumentacija, dva akademska rada i jedna javna patentna publikacija. Nisu otvarani korisnički računi, slani CV-ovi niti ispitivani zatvoreni sistemi konkurenata.

## Nalaz

**Nije pronađen dokaz koji opravdava tvrdnju da osnovni Sense princip „nigdje ne postoji“.** Pronađeni su direktni prethodnici za poređenje CV-a s oglasom, izbor relevantnog sadržaja, lokalnu obradu, transparentna pravila, porijeklo nalaza, tipizirane politike, ponavljanje događaja i „šta ako“ objašnjenja u zapošljavanju.

Originalno napisan CLEA kod i prepoznatljiva integracija mogu imati vrijednost bez tvrdnje o svjetskom prvenstvu. Ova pretraga ne utvrđuje da je BIL kopija niti daje odobrenje za kopiranje drugih proizvoda.

Predmet sadašnje CLEA izvedbe je uži: tipizirana BIL politika, izvorno povezani zahtjevi i navodi, izričita ljudska potvrda, izolirana SHADOW provjera izmjene prije prihvatanja i nacrt iz odabranog potvrđenog sadržaja, u pristupačnom lokalnom radnom prostoru. To je **opis vlastite implementacije**, a ne zaključak o patentnoj novosti ili nadmoći.

## Pregledani izvori i preklapanje

Sažeci su originalni i namjerno kratki. Opisi komercijalnih proizvoda predstavljaju tvrdnje njihovih autora; njihove interne algoritme, privatnost, tačnost i pristupačnost nismo nezavisno testirali.

| Izvor | Šta je dokumentovano | Značenje za Sense |
|---|---|---|
| [Jobscan Resume Scanner](https://www.jobscan.co/resume-scanner) (stari `/resume-matcher` preusmjerava ovdje) | Poređenje CV-a i oglasa, propušteni pojmovi, izvještaj i ponovno skeniranje nakon izmjena. Objašnjava da njihov Match Rate nije stvarni poslodavčev ATS rezultat. | Poređenje, lista propusta i rast rezultata nakon uređivanja nisu zasebna novost. |
| [Teal: Job Matcher](https://help.tealhq.com/en/articles/12060992-using-the-job-matcher), objava 27. juli 2026. | Prikaz prisutnih i nedostajućih ključnih riječi; navigacija do odgovarajućeg dijela CV-a; prijedlozi sadržaja. | Povezivanje oglasa i mjesta u CV-u već je dokumentovano. |
| [Teal: Auto-Select](https://help.tealhq.com/en/articles/12062117-using-auto-select), objava 27. juli 2026. | Odabir relevantnih stavki iskustva za određeni oglas, uz korisnički pregled i ponovno pokretanje. | Izbor relevantnog postojećeg sadržaja i ljudski pregled nisu sami po sebi novi. |
| [CVAurum](https://cvaurum.com/) | Autor opisuje potpuno lokalni CV editor, determinističke provjere, OCR, offline rad i više formata izvoza; navodi i pristupačan PDF. | Kombinacija lokalnog rada, privatnosti, izvoza i određenih funkcija pristupačnosti već se javno nudi. To nisu nezavisno potvrđene tehničke garancije. |
| [RolePatch ATS Check](https://rolepatch.com/tools/ats-check) | Sedam javno opisanih lokalnih heuristika i transparentne kazne; izričito razlikuje nalaz od predviđanja poslodavčevog ishoda. | Transparentno lokalno bodovanje i oprezna tvrdnja o ishodu nisu novi principi. |
| [ResumGO Keyword Scanner](https://www.resumgo.com/resume-keyword-scanner/) | Lokalno poređenje zahtjeva, iskustva i obrazovanja, težine kriterija i pregled izdvojenog teksta; engleski je izričito naveden kao podržani jezik. | Lokalno višekriterijsko poređenje i parser pregled imaju prethodnike. Tvrdnju o lokalnoj obradi ne treba proširivati na cijeli njihov hosting, koji zasebno prikazuje cookie/analytics obavijesti. |
| [Common Expression Language — službeni pregled](https://cel.dev/overview/cel-overview) | Parsiranje, provjera tipova i višestruka evaluacija provjerenih izraza; kontrolisano ugrađivanje u druge proizvode. | Tipizirana politika i ograničeno izvršavanje poznati su principi. BIL implementacija se ne smije predstavljati kao prvi takav jezik. |
| [XState persistence](https://stately.ai/docs/persistence) | Čuvanje i vraćanje stanja te događaji kao osnova ponovnog izvršavanja; upozorenja o kompatibilnosti. | Snapshot, oporavak i replay nisu novi kao opće tehnike. |
| [XState inspection](https://stately.ai/docs/inspection) | Evidencija događaja, promjena stanja, komunikacije i međukoraka. | Objašnjenje izvršavanja iz stvarnih tragova već postoji u drugim ekosistemima. |
| [Soufflé provenance](https://souffle-lang.github.io/provenance) | Dokazna stabla za izvedene rezultate i interaktivno objašnjenje nepostojanja rezultata. | Izvorno utemeljena objašnjenja i pravila s tragom zaključivanja nisu svjetski novi. |
| [Green, Karvounarakis, Tannen: Provenance Semirings](https://web.cs.ucdavis.edu/~green/papers/pods07.pdf), PODS 2007. | Formalno praćenje porijekla rezultata pri transformaciji podataka. | Šira ideja mape porijekla/dokaza ima dugogodišnju istraživačku osnovu. Rad nije preuzet u proizvod niti je njegov algoritam kopiran. |
| [Mazzine i dr.: Counterfactual Explanations for Employment Services](https://feast-ecmlpkdd.github.io/archive/2021/papers/FEAST2021_paper_7.pdf), FEAST 2021. | Minimalne promjene ulaza koje mijenjaju rezultat modela; primjeri karijernih i CV preporuka za tražioce posla. | „Šta ako“ i najmanja promjena u kontekstu zapošljavanja već su istraživani. Sense ne smije predstavljati promjenu vlastite politike kao promjenu stvarne šanse zapošljavanja. |
| [US8930398B1: System and method for improving a resume according to a job description](https://patents.google.com/patent/US8930398B1/en), prioritet 11. oktobar 2011, publikacija 6. januar 2015. | Publikacija opisuje poređenje dijelova profila i oglasa, odabir sadržaja, preporuke i ponovno vrednovanje nakon izmjena. | Široka tvrdnja „prvi sistem koji povezuje CV i oglas pa predlaže izmjene“ nije održiva. Ovo je trag prethodnog rada, ne zaključak o pravnoj zaštiti ili njenom obimu. |

Google Patents izričito navodi da prikaz pravnog statusa nije pravni zaključak. Ovdje se ne tvrdi da je bilo koji konkretan zahtjev patenta primjenjiv, neprimjenjiv, važeći ili slobodan za korištenje. Nije napravljena stručna analiza patentnih zahtjeva, porodica, jurisdikcija ili slobode poslovanja.

## Šta možemo tvrditi

Prihvatljiva formulacija, nakon provjere implementacije:

> „BL CLEA Sense je vlastita CLEA implementacija lokalnog radnog prostora za provjeru prijave: BIL pravila, povezani izvori, korisničke potvrde, izolirana provjera promjene i pregled izvršavanja.“

Ako testovi prođu, mogu se navesti njihov tačan obim, datum, verzija i rezultati. Ako se dokaže prednost na definisanom uporedivom skupu, može se tvrditi ta konkretna prednost — ne opća nadmoć nad svim AI sistemima.

Neopravdane formulacije:

- „Ovaj princip ne postoji nigdje drugdje“ ili „prvi na svijetu“.
- „Predviđa odbijenicu sa sigurnošću“ ili neprovjeren procenat zapošljavanja.
- „Samo Sense radi lokalno / daje dokaze / prikazuje šta ako“.
- „Sedam stubova je sedam novih naučnih izuma“.
- „Javna dostupnost izvora daje pravo da njegov tekst ili kod preuzmemo u proizvod“.

## Hipoteza posebnosti koju treba provjeriti

Vrijedi mjeriti može li **zajednički provjereni CLEA model** smanjiti greške u cijelom toku: od zahtjeva oglasa i korisničke potvrde, preko izolirane promjene, do nacrta čije svako uključeno mjesto vodi do odabranog izvora. Pristupačnost treba mjeriti uspješno završenim zadatkom uz tastaturu i stvarne čitače ekrana, a privatnost mrežnim i storage provjerama.

To je hipoteza o kvalitetu integracije. U pregledanim dokumentima nije ustanovljeno potpuno poklapanje svake navedene CLEA komponente, ali ograničen javni pregled ne dokazuje da takvo poklapanje ne postoji u drugim proizvodima, istraživanjima ili privatnim implementacijama.

Potrebna provjera prednosti uključuje iste ulaze, jednako dostupne izvore i vremenski budžet; označene važne propuste i lažne nalaze; očuvanje činjenica; razumljivost korisniku; stvarni mobilni i asistivni tok. Korisnička potvrda dokazuje korisnikov izbor, ne istinitost životnog iskustva ili vlasništvo nad dostavljenim dokazom.

## Metoda, upiti i ograničenja

Korištena je javna web pretraga i otvaranje navedenih primarnih stranica. Primjeri upita:

- `site.jobscan.co resume scanner match report job description`
- `site.help.tealhq.com job matcher resume curation`
- `resume keyword scanner browser local deterministic no upload`
- `site.cel.dev overview type check side effect free`
- `data provenance semiring why provenance database queries Green Karvounarakis Tannen 2007`
- `site.souffle-lang.github.io provenance`
- `"counterfactual" "resume" "job" recommendation`
- `site.patents.google.com "resume" "recommendations" "job description"`

Stariji Teal Auto-Select URL vratio je 404; gore je korišten noviji službeni članak koji je otvoren. OneTwoResume je bio vidljiv u indeksiranom rezultatu, ali direktno otvaranje nije uspjelo; zato nije korišten kao glavni provjereni izvor u tabeli. Dodatni akademski rezultati nisu tretirani kao pregledani puni radovi kada je puni tekst bio nedostupan.

Pretraga nije iscrpna po jezicima, regijama, svim patentnim klasama ili datumima. Marketinške tvrdnje nisu dokaz stvarnog ponašanja proizvoda. Nisu pregledani ili preuzimani zatvoreni kompajleri, korisnički podaci, privatne prijave ili modeli konkurenata. Nema kopiranog koda, šablona, ilustracija ili sadržaja iz ovih izvora u ovoj bilješci ili proizvodu kao posljedice ovog istraživanja; bilješka sadrži vlastite kratke sažetke i linkove.

Ovaj dokument ne mijenja postojeće licence CLEA jezgra, SDK-a ili drugih komponenti. Autorsko porijeklo izvedbe, tržišna novost, patentna novost, pravo distribucije i zaštita naziva ostaju odvojena pitanja.
