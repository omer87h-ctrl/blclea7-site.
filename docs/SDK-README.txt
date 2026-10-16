# BL CLEA7 public developer SDK 0.7 BIL

Python 3.12+; Node.js 22+ for execution. Offline validation, packaging and real tests:

```
python -m clea7 validate sdk/examples/units.application.json
python -m clea7 package sdk/examples/units.application.json units.clea7 --targets browser,windows,android
python -m clea7 test units.clea7 --flow convert --state '{"kilometres":2.5}'
python -m clea7 test-suite sdk/examples/units.application.json sdk/examples/units.tests.json --mode light
```

Run commands from this extracted SDK root. Install the resulting .clea7 package in the independent Runtime. No Studio is required. Tests execute actual whitelisted instructions in isolated memory. Native adapters are blocked in SHADOW tests. Wrong expected results return failure.

Signed package verification additionally needs cryptography==50.0.0; unsigned package creation and tests use the standard Python/Node libraries. Model weights, accounts, API keys, private publisher identities and the native Windows build host are not included. This is an application SDK, not the Studio source repository.

Original-code terms: LICENSE.txt. Original design material terms: MATERIALS-LICENSE.txt. No universal compatibility, battery or security-superiority claim.

## BLclea Intent Language

```
python -m clea7 bil check sdk/examples/bil/core.bil
python -m clea7 bil run sdk/examples/bil/core.bil
python -m clea7 bil package sdk/examples/bil/counter.bil --output moja-bil.clea7 --id moja_bil
```

BIL source has its own parser, static types and checked IR. Run from this SDK root. Install application/5 in Runtime 0.6 or newer. The package intentionally contains source and IR; never embed secrets. See docs/BIL-LANGUAGE-SPEC.md and docs/BIL-LIMITATIONS.md. The optional AI proposal contract has no default model connection. Existing JSON application workflows remain supported.

Povezane BIL aplikacije: sdk/examples/bil/orders.bil, inventory.bil, contacts.bil i expenses.bil. Ekrani i obrasci zahtijevaju Runtime 0.7+. Ugovor i sigurnosne granice: STUDIO-APPLICATIONS-0.7.txt.
