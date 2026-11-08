# BIL Sense host contract 0.37

Original BL CLEA integration by Brzo i Lokalno. The existing BIL parser, typed
IR and event Runtime execute these operations; this is not generated Java/Kotlin
application logic or arbitrary JavaScript execution.

```bil
backend assist using "sense.local/1"
let cv = "Moje stvarno iskustvo"
let downloaded = false
let failure: RemoteFailure? = null
on export_cv {
    request assist.document.docx(cv) into downloaded catch failure
}
screen home "Moj CV" {
    input cv label "Tekst životopisa" multiline key cv
    button "Pripremi DOCX" runs export_cv key export
}
start home
```

The full executable application is `sdk/examples/bil/sense-cv.bil`. It stages
dictation for review instead of silently treating recognized speech as factual
work experience. The standard BIL completion events and recovery mechanism are
used for asynchronous results. Error values remain `RemoteFailure` with code,
message and uncertainty; failed external effects are not automatically repeated.

| Operation | Arguments | Result | OS requirement |
|---|---|---|---|
| `speech.speak` | Text | Boolean | User-selected local device voice |
| `speech.listen` | Text language | Text | Explicit microphone permission; available recognition service |
| `speech.stop` | none | Boolean | Cancels only this application's audio request |
| `document.docx` | Text | Boolean | Explicit per-action document approval |
| `haptic.cue` | Text kind | Boolean | Vibrator, `haptics` permission on Android |

Languages accepted by the Android recognition adapter: bs-BA, hr-HR, sr-RS,
en-US and en-GB. Device/engine language support is checked by the service; this
list is not a promise that a Bosnian offline model exists on every device.
Haptic kinds are `confirm`, `error` and `complete`. They are short signals, not
Braille, language transmission or a replacement for assistive hardware.

No Firebase project, API key, account or model is required. Exact source-owned
operation grants are approved separately from each device action. Native hosts
also check application identity, backend alias and the embedded contract. ASR
uses on-device recognition when available; system processing needs a separate
explicit opt-in. Local voices are the only automatic TTS choice. No model or
voice is automatically downloaded. Audio is not retained by CLEA. System engine
processing remains governed by its provider and platform settings.

Browser: successful DOCX return means a real download was requested; it does
not certify that a browser saved the file. Android: the native host returns
success only after writing the actual OOXML ZIP to the user-selected content
URI and closing its stream. A partial/failed write reports uncertainty. No
arbitrary path or network endpoint can be supplied by BIL.

Text limits: DOCX 30,000 characters, other device arguments 3,000; one active
native task, 120-second action deadline. Stop uses separate completion state
so it can cancel an ongoing speech request. Page/adapter close cancels owned
requests; backgrounding cancels owned audio. Development traces follow the
existing private-value protections; production does not publish source/state.

Portable packages containing this adapter require Runtime0.37.0. Old formats
and their original minimum Runtime versions remain valid. Browser, Windows
scoped web player and Android native host use the same source and IR. Available
speech/haptics vary per host and must return real availability/errors.

Verification: actual keyboard browser authoring and DOCX download are recorded
in `acceptance/sense-bil-037-browser.json`; Node contracts and native SDK tests
are executable in `tests/test_sense_bil.cjs` and `test_sense_bil_sdk.py`.
Android instrumentation is in `tests/android-sense/SenseInstrumentation.java`;
its result must be taken from an executed CI run, not inferred from this file.
Physical TTS/ASR, TalkBack, Braille and user evaluation are not certified by a
headless browser or Android emulator. The first successful counter APK/AAB
build is separately scoped in `acceptance/android-037-first-build.json`.
