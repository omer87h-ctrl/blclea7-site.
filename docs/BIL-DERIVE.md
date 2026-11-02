# BIL: izvedene vrijednosti, Core 3

BL CLEA7 by Brzo i Lokalno. Uvedeno u razvojnoj verziji 0.18.0.

`derive` opisuje vrijednost koja se računa iz ranije deklarisanih podataka.
Kompajler provjerava njen tip, izdvaja zavisnosti i zabranjuje direktno pisanje
u rezultat. Isti izvor izvršavaju Studio, SDK i Runtime kroz postojeći BIL VM.

```bil
let quantity = 2
let price = 20
derive total = quantity * price

screen quote "Moja ponuda" {
    input quantity label "Količina"
    input price label "Cijena"
    button "Dodaj jedan" runs add
    show total
}

on add {
    quantity = quantity + 1
}
```

Početni rezultat je 40; nakon `add` je 60. Ovo nije promjena ranijeg značenja
`let total = quantity * price`: obična deklaracija i dalje izvršava inicijalizator
jednom. Reaktivno ponašanje je eksplicitno.

## Gramatika i tipovi

```ebnf
derive-declaration = "derive", identifier, [ ":", type ], "=", expression ;
```

Pravila završavanja naredbi, izraza i prioriteta ostaju postojeća BIL pravila.
Deklaracija je dozvoljena samo na vrhu programa. `derive` je kontekstualna riječ:
ranije dozvoljen identifikator tog naziva ne postaje automatski rezervisan.
Tip se zaključuje iz izraza ili provjerava prema eksplicitnoj anotaciji.

Izraz može koristiti čiste tipizirane funkcije. Analiza uključuje njihove
tranzitivne pristupe globalnim vrijednostima i poštuje lokalna imena/parametre.
Zavisnosti su statički, konzervativno izdvojene: grana može dovesti do ponovnog
računanja i kada se tokom konkretnog poziva ne izvrši. To čuva ispravnost.

Samozavisnosti, ciklusi i čitanje unaprijed deklarisanih zavisnosti se odbijaju.
Pisanje u izvedenu vrijednost, njeno polje ili stavku liste nije dozvoljeno.
Mrežni i native zahtjevi ostaju događaji s kontrolisanim efektima; ne pripadaju
čistom izvedenom izrazu.

## Izvršavanje

Prvo izvršavanje računa rezultat. Promjena zavisnosti izaziva ponovno računanje
prije njegovog čitanja odnosno završetka događaja. Nezavisna izvedena vrijednost
može ponovo koristiti provjeren rezultat. Sačuvani izvedeni izlazi se pri otvaranju
ponovo usklađuju s ulazima i kodom; nisu autoritativan cache.

VM objavljuje nova cache zadržavanja tek u uspješnom rezultatu. Engine ih potvrđuje
tek poslije uspjelo sačuvanog stanja. Neuspjela logika, oporavak spekulativne grane,
neuspjela pohrana i zatvaranje konteksta ne smiju objaviti nedovršen rezultat.

Cache se može isključiti ili očistiti bez promjene aplikacijskih podataka.
Isključeno zadržavanje znači stvarno ponovno računanje, ne lažni prikaz pogodaka.
Logički instrukcijski budžet ostaje primjenjiv i na ponovo korišten rad;
stvarno vrijeme izvršavanja ostaje zaseban rok vezan za uređaj i opterećenje.

## Prenosivi ugovor

Ne mijenja se proizvoljno postojeći application ABI. Izvedena deklaracija koristi
`STORE_NEW` s `coreFeature: "derive"`, sortiranom listom zavisnosti, nepromjenjivim
globalnim tipom i odgovarajućom source-map oznakom. Core feature ugovor je verzija
3 i zahtijeva Runtime najmanje 0.18.0. Host ponovno provjerava izvor i IR.
Preimenovanje datoteke ili snižavanje manifesta ne dodaje podršku starom hostu.

Raniji programi bez novih konstrukcija zadržavaju raniji feature ugovor i minimalnu
verziju. Testovi starih programa provjeravaju i nepromijenjene kompajlerske sažetke.

Trag `kind: "derive"` sadrži ID izvora, imena zavisnosti, rezultat odluke o cacheu,
razlog i izmjereno trajanje računanja. Ne sadrži same privatne vrijednosti.
Za detalje: [cache](WORKING-CACHE.md), [Core](CLEA-CORE.md).

## Dodatne Core 3 konstrukcije

Ograničena uslovna petlja koristi eksplicitan cijeli literal od 1 do 100:

```bil
let current = 0
while current < 4 limit 4 {
    current = current + 1
}
```

```ebnf
while-statement = "while", expression, "limit", integer-literal, block ;
```

Uslov mora biti Boolean. Nakon zadnje dozvoljene iteracije ponovo se provjerava;
ako je i dalje istinit, izvršavanje vraća fatalni `Budget`, ne tihi djelimični
uspjeh. `return` iz funkcije ostaje podržan. `while` i `limit` su kontekstualni,
pa ranije valjani istoimeni identifikatori ostaju valjani.

Zatvoreni modul `json` ne otvara mrežu ili proizvoljne objekte:

```bil
import json
record Item { label: Text, count: Number }
let example = new Item { label: "", count: 0 }
let parsed = json.decode("{\"label\":\"Alat\",\"count\":3}", example)
let encoded = json.encode(parsed)
```

`json.encode(value)` vraća Text za podržane, ograničene podatke. Kod
`json.decode(text, exemplar)` **statički tip** drugog argumenta određuje izlazni
tip; nije proizvoljna procjena prema sadržaju. Polja zapisa moraju biti tačna,
tipovi odgovarati i nullable vrijednosti moraju biti deklarisane. Neanotirani
`null` i prazna lista nisu dovoljna shema. `let samples: List<Number> = []`
može biti shema za numeričku listu.

Sintaksna greška daje `JSON`, a nepodudarna struktura `JSONShape`; poruke ne
prepisuju privatni ulaz. Postojeća ograničenja dubine, broja elemenata, teksta i
brojeva ostaju obavezna. Greške se mogu obraditi postojećim `try`/`catch` pravilima;
fatalni budžetski prekid se ne može pretvoriti u nastavak neograničenog rada.
`while`, `json.encode` i `json.decode` također zahtijevaju Runtime 0.18.0.
