# BIL Core2 SDK contract — development 0.17

Core2 extends the existing BIL compiler and bounded Runtime. It does not replace
the language with JavaScript or require a Studio-generated application. The
original independent SDK can check, compile, execute and package Core2 sources.

## Local diagnostics

```sh
python -m clea7 doctor
python -m clea7 bil features sdk/examples/bil/verified-application.bil
python -m clea7 bil check sdk/examples/bil/verified-application.bil
python -m clea7 bil run sdk/examples/bil/verified-application.bil
python -m clea7 bil package sdk/examples/bil/verified-application.bil --output verified-application.clea7
```

`doctor` reports Python and Node versions, compiler contracts and supported Core2
features. It does not inspect environment-variable values, credentials, home
profiles, devices or network services. It installs and downloads nothing.
Python 3.12+ and Node.js 22+ remain development prerequisites. Existing packaged
Runtime consumers do not acquire a new requirement for a system Node install.

The example is original, fictional input. The actual BIL program selects the
confirmed `SQL` fact and retains unconfirmed `Excel` for review. It does not
predict employment, certify skills or claim that supplied facts are true.

## Feature and compatibility contract

`CLEA7BIL.featuresFor(sourceOrCompilation)` returns:

```json
{"format":"bil.core.features/1","version":2,"minimumRuntime":"0.17.0","used":["guard","text.trim"]}
```

The compiler obtains this from the checked source. Supplied compilation metadata
is not trusted as a substitute for recompiling source. Legacy compilation results
retain their original shape and published digest; their features are version 1
with an empty `used` list. New sources may additionally return feature metadata
from SDK `check`, `compile` and `run` commands.

Core2 retains existing application/IR envelopes. New operations are bounded typed
CALLs. A `guard` lowers to existing BRANCH/RAISE instructions, with a
`coreFeature: "guard"` marker in its generated source-map entry. That marker is
part of the canonical compiler output, not a permission or executable plugin.

Both package encoders mark sources using any Core2 operation or `guard` with
minimum Runtime **0.17.0**. Legacy applications retain their original floors.
The browser Runtime recompiles the application source, checks canonical IR and
independently computes the requirement before accepting the manifest. It rejects
understated floors, removed markers and source/IR mismatches. Signed packages
retain the same requirement and bind it into their signed manifest.

Python native envelope checks remain structural and do not require Node on an
installed host. They inspect bounded IR feature CALLs and source-map guard
markers; this is not a second full compiler. Full source/IR integrity is checked
by the trusted execution host before running instructions. Python envelope
validation alone is not proof that arbitrary supplied source/IR pairs agree.

Published native 0.15 and web 0.16 binaries/assets are not relabelled as 0.17.
An existing host must reject the newer requirement. A package targeting Android
does not prove a 0.17 Android build or physical-device verification exists.

## Seven responsibilities in this slice

- Core AI Manager: the existing instruction/time budgets remain enforced.
- Link Bridge Elite: SDK and consumers share the original compiler and checked IR.
- Expansion Q: versioned feature discovery exposes only registered operations.
- Adaptive Recovery: failed guards participate in existing transaction rollback.
- Holo Interaction: source locations and supported visual source retention remain.
- Fallback Executor: unsupported older hosts reject the package explicitly.
- Vision Q: actual BRANCH/RAISE/CALL traces retain source mapping.

No new model, telemetry, paid API or package dependency is introduced by this
SDK/compiler feature contract. Existing core and third-party licences remain in
force. Scope and evidence are development-stage, not a production certification.
