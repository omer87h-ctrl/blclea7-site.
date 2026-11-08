# Sense kao nezavisan SDK primjer — testna verzija

`node sdk/verify_sense.cjs` pokreće stvarni kompajler, BIL politiku i Runtime.
Izmišljeni CV navodi SQL; oglas traži SQL. Prvi nalaz je `unconfirmed`.
Izolirana SHADOW potvrda daje `supported`, dok LIVE nalaz ostaje neizmijenjen.
Nacrt sadrži odabrani izvorni navod. Korisnička potvrda nije nezavisna provjera
životnog iskustva. Primjer ne predviđa ishod zapošljavanja.

Javni primjer je samostalan: nema Studija, privatnog hosta, DOM-a, uređajnih dozvola,
plaćenog API-ja ili mrežnog zahtjeva. BIL izvor je `web/sense/sense-policy.bil`;
isti izvor je ugrađen u `sense-engine.js` za browser rad. Podaci korisnika ne
postaju izvršivi izvorni kod. Sadržaj ostaje u memoriji procesa osim ako sam
developer izričito upiše podatke u datoteku.

API:

```js
const engine = new CLEA7Sense.SenseEngine();
const live = await engine.analyze({cvText, jobText});
const alternative = await engine.shadow(live, {confirmations});
const draft = engine.createDraft(alternative.report);
```

U browseru prvo učitaj originalni `bil-compiler.js`, `bil-runtime.js`,
`sense-lexicon.js`, pa `sense-engine.js`. U Node-u priloženi runner učitava te
iste fajlove u kontekst za ispitivanje; BIL izvor nije JavaScript i ne prolazi
kroz proizvoljan eval. `node:vm` je ovdje razvojni harness za vlastiti provjereni
kod, a ne OS sandbox za proizvoljan neprijateljski JavaScript.

Sense koristi ograničene bs/hr/en heuristike i izričite korisničke potvrde.
Neprepoznati, dvosmisleni i kontekstualni zahtjevi traže ručnu provjeru. Nema
tvrdnje da analiza obuhvata svaki propust, da je princip prvi na svijetu ili
da je pristupačnost potvrđena na svim stvarnim pomagalima.
