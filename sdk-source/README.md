# BL CLEA7 public developer SDK 0.14 BIL

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

## Povezane aplikacije

BIL application/6 opisuje ekrane, obrasce i tabele. Primjer: sdk/examples/bil/orders.bil. Potreban je Runtime 0.7.0+. Ugovor i granice: docs/STUDIO-APPLICATIONS-0.7.md.

## SDK0.9 — development backend contracts

Compile/validate/package application7 with the original BIL compiler. `--targets browser` is the portable development default. Execute remote events only in a configured Runtime with explicit grants and local demo-clea7 Firebase emulators. This curated SDK excludes the private native host and Android build sources. Existing local applications remain supported. See docs/BIL-ASYNC-REQUESTS.md and docs/PRINCIPAL-STORAGE.md. No production backend, chat, uploads or push service is supplied.

## SDK 0.13

The SDK preserves existing projects and adds native Android capability contracts. Compile and package the original native-media example offline:

```sh
python -m clea7 bil check sdk/examples/bil/native-media.bil
python -m clea7 bil package sdk/examples/bil/native-media.bil --output Native.clea7
```

Install Native.clea7 in Android Runtime 0.13 or newer. These hardware capabilities run on Android, not in a browser. Native-only apps do not require a cloud account. Windows Studio can build an embedded APK using a configured Android toolchain. The curated SDK excludes private native host implementation, credentials and user data.


## SDK 0.14 — visual presentation

Typed colours, layout values, numeric visual bindings, original geometric shapes, bounded motion and declared gestures use the versioned bil.ui/2 representation. These packages require Runtime 0.14 or newer. Compile sdk/examples/bil/motion-scene.bil independently of Studio, then run or package it with the same SDK commands above. See docs/BIL-PRESENTATION.md. No arbitrary CSS, remote fonts, uploaded artwork or JavaScript eval is introduced.
