> Current additive Core5 / Runtime0.44: [BIL sentence grammar](BIL-OBJECT-GRAMMAR.md). The older contract sections below retain their historical scope. Classic BIL remains supported.

# CLEA Core 0.18

Core je zajednički, platformski nezavisan ugovor `clea7.core/1`.
Implementacija je `web/workbench/clea-core.js`. Ona koristi autoritativni BIL
kompajler i provjereni interpreter; ne uvodi drugi evaluator.

```text
BIL izvor → lexer → parser → AST → tipovi/semantika → BIL IR
                                                         ↓
                                                    CLEA Core
                                                         ↓
                                        Engine / odobreni host adapteri
```

Core nema DOM, datotečni sistem, shell, mrežni pristup ili Android API.
Host prikazuje interfejs i posreduje dozvoljene vanjske efekte. To je ista
izvršna semantika na hostovima koji učitaju ovaj ugovor i potrebne adaptere.

## Javni API

| API | Stvarna odgovornost |
| --- | --- |
| `compile(source, metadata)` | Postojeći lexer/parser, provjera tipova i BIL IR |
| `check(source, metadata)` | Stvarna kompilacija i zahtjevi kompatibilnosti |
| `validateApplication(app)` | Provjera application ugovora, izvora i IR-a |
| `featuresFor(source)` | Korištene jezičke mogućnosti i njihov minimum |
| `minimumRuntime(app, targets)` | Najviši potrebni ABI, jezički i adapterski minimum |
| `describe(app, targets)` | Potrebne mogućnosti i deklarisane dozvole |
| `profile(options)` | Eksplicitan, ograničen profil hosta |
| `negotiate(app, host, targets)` | Razlozi neprihvatanja prije pokretanja |
| `execute(ir, block, state, options)` | Isti provjereni BIL VM |
| `reconcileDerived(ir, state, options)` | Usklađivanje izvedenih vrijednosti bez ponovnog main-a |
| `createCache(options)` | Izolovana instanca radnog cachea |
| `publicResult(result, mode)` | Odvojeni izlazni izvještaj za razvoj ili produkciju |

Produkcijski izlazni izvještaj nije operativni rezultat Enginea. Ne zamjenjuje
stanje ili red odobrenih efekata. Engine mora moći završiti stvarnu transakciju.
Produkcijski način smanjuje izlaznu dijagnostiku; nije zaštita od vlasnika hosta
koji može pregledati paket ili vlastiti preglednik.

## Profil i dozvole

Profil sadrži numeričku verziju Runtimea, eksplicitne capability identifikatore
i dodijeljene dozvole. Pregovaranje prijavljuje stariju verziju, nedostajuću
mogućnost ili nedodijeljenu dozvolu. Sam opis senzora ne dodjeljuje dozvolu.
Provjera pri pozivu adaptera ostaje obavezna.

JavaScript Core ne čini proizvoljan JavaScript sigurnim. Aplikacije ostaju
ograničeni, provjereni BIL IR; nema `eval`, shell naredbi ili automatskog
izvršavanja AI odgovora. Hostovi i njihove ugrađene biblioteke su pouzdani dio
sistema. Logičko razdvajanje aplikacija nije izolacija OS procesa.

## Sedam odgovornosti

| Stub | Veza sa stvarnim izvršavanjem |
| --- | --- |
| Core AI Manager | Red događaja, instrukcijski/vremenski limiti, odvojeni opcionalni AI pozivi |
| Link Bridge Elite | Kompajler/IR/Core/host ugovori i eksplicitna provjera mogućnosti |
| Expansion Q | Verzionisani zatvoreni registri operacija i prikaza |
| Adaptive Recovery | Lokalna transakcija, rollback, obnova izvedenih podataka, journal neizvjesnih efekata |
| Holo Interaction | Stvarni renderer, događaji, model prikaza i postojeći reduced-motion postupci |
| Fallback Executor | Provjerene deklarisane alternative; cache kvar vraća stvarno računanje |
| Vision Q | Stvarni događaji, source lokacije, derive odluke i sadržajno ograničeni brojači |

Nazivi ne znače sedam AI modela niti novo svojstvo hardvera.

## Platforme

Node SDK i browser host učitavaju isti kompajler, Core i VM. Android i Windows
izvozni recepti uključuju zajedničke datoteke, ali promjena recepta nije dokaz
izgrađenog ili testiranog novog APK/EXE paketa. iOS, macOS i Linux samostalni
izvozi nisu proglašeni dostupnim ovim ugovorom. `.clea7` zahtijeva kompatibilan
host; nije samostalan univerzalni OS izvršni fajl.

## Additive Runtime0.42 / Core4

The implemented scene module, clock/pad/camera grammar, typed physics and keyframe
semantics are specified in [BIL-SCENE.md](BIL-SCENE.md). The actual editor now uses
[project-scoped incremental compilation](BIL-INCREMENTAL-COMPILER.md); full lexing
and permission/event/UI checks remain. [Local OCR](SENSE-OCR.md) is a separately
licensed, consent-controlled Sense capability, not arbitrary image understanding.
Older source/IR/package contracts keep their true minimum runtime. See matching
release receipts for actual browser/native scope; no3D, physical-device or model
quality acceptance is implied by source compilation.
