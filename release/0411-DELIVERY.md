# BL CLEA 7 — isporuka 0.41.1-test

15. novembar 2026. · by Brzo i Lokalno

## Otvori i koristi

- [Studio i Draw](https://clea7.brzoilokalno.com/studio/workbench/)
- [Windows instalater, SDK i podržani Android paketi](https://clea7.brzoilokalno.com/preuzimanja.html)
- [Sense — CV](https://clea7.brzoilokalno.com/sense/)
- [Auto dijagnostika](https://clea7.brzoilokalno.com/auto/)

U Studiju otvori zajednički razgovor i zadaj: „Napravi novu aplikaciju sa igračem
i vratima koja se otvaraju kad priđe“. Podržana lokalna naredba radi bez modela;
prijedlog se provjerava, pregleda i primjenjuje na isti projekt. Draw pokreće
stvarno BIL ponašanje. Izvoz `.clea7`, instalacija u nezavisni Runtime, čuvanje
stanja, ponovno otvaranje i tačan Undo provjereni su u pregledniku. Slobodan
generativni razgovor koristi odvojeni lokalni9B servis na vlasnikovom računaru.

## Šta je povezano

Studio, Draw, BIL kompajler, sedam izvršnih odgovornosti, provjera prijedloga i
SDK koriste isti model operacija. Podržane operacije stvaraju ekrane, povezane
komponente, tipizirane kolekcije i Draw objekte s ponašanjem. Postojeći projekti
i ranije verzije preuzimanja sačuvani su. Sense ostaje alat za životopis i
zapošljavanje s lokalnim TXT/DOCX/tekst-PDF uvozom i DOCX izvozom.

TECH način u zajedničkom razgovoru čita odobrene službene izvore i javnu arhivu,
provjerava ponavljanje i izvozi uredničke prijedloge. Ništa ne objavljuje sam.
Za izričito neprihvaćen zahtjev zbog zauzetosti AI klijent čeka slobodan termin;
prekid radi i tokom čekanja. Djelimično izvršeni zahtjevi ne ponavljaju se sami.

Ispravljena su dva stvarna problema: SDK/Windows sada prepoznaju stvarni profil
9B gateway servisa, a lokalna stranica učitava tačne odobrene veće PDF module uz
ispravan JavaScript MIME tip. Integritet i ograničenja pristupa ostaju obavezni.

## Izvršene provjere

| Provjera | Rezultat |
|---|---|
| Privatni Python paket | 388 izvršenih: 386 prolaznih, 2 Windows DPAPI preskočene na Linuxu |
| Javni Python paket | 67 prolaznih |
| Stvarna web stranica | 5 grupa: mobilni prikaz, preuzimanja, Studio, katalog i rad bez JavaScripta |
| Povezani Studio/Draw | 5 grupa u stvarnom pregledniku; izvoz, nezavisni Runtime, ponovno otvaranje i Undo |
| Windows 0.41.1 | 19 provjera u zamrznutoj WebView2 aplikaciji |
| Windows instalacija | Stvarni instalater i deinstalater; 981 datoteka i očuvanje korisničkih datoteka |
| Gateway/SDK/native veza | Stvarni HTTP servisi i kompajler; samo neuralni izlaz i spremnost su označene testne zamjene |

Windows izgradnja i instalacija:
[43718650265](https://github.com/omer87h-ctrl/BL-Clea7-by-brzoilokalno/actions/runs/43718650265).
Javna objava:
[43720197247](https://github.com/omer87h-ctrl/blclea7-site./actions/runs/43720197247).
Izvor binarnog paketa: `7f81e42b739c3e80555644cf86212d05baf7cdf9`.
Instalater: 249.865.806 bajtova; SHA256
`df52c0928a8235199df8c88b4df4e15db854f9b25ad285bb4c0fbde3665fe06e`.
Anonimno preuzimanje kontrolne sume i početka stvarnog EXE-a provjereno je.
Detalji su u `windows-0411.json`, `windows-native-0411.json` i
`windows-installed-connected-0411.json`.

SDK 0.41.1: 116 odabranih datoteka, 1.042.712 bajtova; SHA256
`ef8ddb6e6653af2994bbca12beb528633810112fac41505218771022487891e3e`.
Licence i porijeklo zavisnosti sačuvani su. Windows je testno izdanje bez
vlasničkog produkcijskog potpisa. Podržani objavljeni Android paketi ostaju
provjerene verzije 0.40; nisu predstavljeni kao novi native build 0.41.1.

## Granice rezultata

HP je prema posljednjoj vlasnikovoj informaciji isključen. Ova isporuka ne
dokazuje novu generaciju aplikacije stvarnim9B modelom na HP-u, pokretanje pri
prijavi na tom računaru niti stalno dostupan zaštićeni javni model server.
Testne zamjene ne dokazuju neuralni kvalitet i nije izmjerena jednakost s70B.

Cijeli Master nije označen završenim: stvarni OCR/slikovni backend, potpuno
inkrementalni kompajler, ispitivanja s korisnicima pomagala, puna fizička/3D
igra i samostalni iOS/macOS/Linux izvozi nisu potvrđeni ovom isporukom. Web/Core
podrška nije isto što i zaseban native paket. Javne stranice su dostupne za
indeksiranje, ali Googleov indeks i rangiranje nisu potvrđeni.

Produkcija Brzo i Lokalno, TECH objave/RSS, Firebase, DNS i privatni korisnički
podaci nisu mijenjani. Nema novog plaćenog servisa, masovnog preuzimanja modela,
obaveznog clouda niti gašenja sigurnosnih zaštita računara.
