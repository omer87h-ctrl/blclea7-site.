# Dependency and originality record

Original project code: Studio interface, app schema, project handling, task
coordination, SDK, cache checks, fixed operations, local host, package generation
and tests were written for this project. No source from GIMP, Android Studio,
Rive, Windows, Linux or Android is included or rebranded as our implementation.

Runtime uses standard JavaScript/browser APIs and Python standard library modules,
including SQLite and SHA-256. These are established primitives, not inventions
claimed as our own. A standalone runtime does not mean a new CPU instruction set.

| Component | Use | License/source |
|---|---|---|
| CPython 3.12 | Native runtime host | PSF license; https://docs.python.org/3/license.html |
| SQLite | Native task/project persistence | Public domain; https://sqlite.org/copyright.html |
| pywebview 6.1 | Native Windows window | BSD-3-Clause; https://github.com/r0x0r/pywebview/blob/master/LICENSE |
| PyInstaller 6.16.0 | Windows packaging | GPL with bootloader exception; https://pyinstaller.org/en/stable/license.html |
| WebLLM 0.2.85 | Optional browser inference | Apache-2.0; https://github.com/mlc-ai/web-llm |
| Qwen2.5 0.5B Instruct | Optional downloaded model | Apache-2.0; https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct |
| MLC model conversion | Optional model files | https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC |
| Microsoft WebView2 Fixed Version 155.0.4283.45 x64 | Bundled, app-local Windows renderer | Microsoft redistribution terms; unmodified vendor binaries and notices; https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution |
| cryptography 50.0.0 | Optional SDK / bundled native ECDSA package signatures | Apache-2.0 OR BSD-3-Clause; https://cryptography.io/en/latest/faq/#what-license-is-cryptography-distributed-under |
| Playwright / axe-core | Build/test tooling only | Apache-2.0 / MPL-2.0; not in normal Studio runtime |

Native build collects installed dependency license texts and a version inventory.
The final artifact must be checked for missing notices before public distribution.
Transitive dependencies such as pythonnet/clr_loader and WebLLM's inference/tokenizer
components retain their own licenses. Collecting notices is not a legal certificate.

No uploaded photographs, copied templates, unlicensed custom fonts or stock-image
assets are included. CSS layout and seven-element SVG mark are original. CLEA7 is
still a working name pending adequate trademark review.

## application/2 Android toolchain

- Android SDK/platform APIs and Android Gradle Plugin 8.7.3: official Google tooling;
  SDK licence acceptance is required by the developer's build environment. No
  Android operating-system source is copied into this project.
- Gradle 8.10.2: Apache-2.0 build tool; downloaded by the CI setup action, not bundled
  into the runtime AAR. OpenJDK/Temurin 17 is a build prerequisite with its own
  distribution licences, not redistributed here.
- Android WebView is a device-provided platform component, not our invention.
- GitHub Actions setup/emulator actions are build-only third-party dependencies;
  they are not part of the generated application. Their version tags are recorded
  in the workflow; final supply-chain review remains required before public release.

Build-only JavaScript parser: Acorn 8.14.0 (MIT), used to check the ES2020 target.
It is not bundled in generated applications. Android Gradle tooling and platform
APIs remain their respective licensed dependencies; no OS source was imported.

Optional OpenAI API access uses Python standard-library HTTPS and the user's own account under the provider's terms. No OpenAI model weights or client
SDK are bundled, sold or relicensed. See docs/OPENAI-BYOK.md for official sources.

## Professional workspace / application/3

`web/workbench/{living,graph,code-editor,pro-studio,starters}.js` and
`clea7/living.py` are original project implementations. They introduce no new
third-party runtime dependency, image, copied template, font or AI model weights.
The visual editor uses system fonts and original CSS graphics; animation uses the
host's Web Animations API. Existing platform/build dependency notices still apply.

## Complete Windows distribution / signed packages

The fixed WebView2 CAB is fetched from Microsoft's official download URL and
verified against its pinned SHA-256 and valid Microsoft Authenticode signature.
All vendor files and notices are retained. CLEA7 does not claim ownership of the
renderer or remove its licence conditions. Fixed-version renderers do not update
automatically; subsequent CLEA7 releases must carry reviewed security updates.
The native build also collects cryptography and its installed transitive licence
texts (including applicable OpenSSL/Rust components). Package signatures use the
standard ECDSA P-256/SHA-256 algorithm, not proprietary cryptography.

## Original material library

`web/workbench/materials.js` implements original composition design data, palettes
and motion recipes using the existing declarative engine. No third-party asset
pack, external font, stock photograph or copied UI template is added. Materialized
design content is covered by MATERIALS-LICENSE.txt; notices accompany App DNA /4
packages and generated applications. No AI model or paid image API was used to
produce the included compositions. A future AI-generated asset requires its own
source/terms record and rights review; generation is not a legal clearance.

## BIL increment

BIL compiler, IR executor, intent resolver, visual source adapter and bundled
math/text/collection operations are original project implementation. No new
external parser, compiler, model weights, font or library dependency was added.
Existing host and development dependency notices remain applicable. This entry
does not change the core distribution terms or the separate materials MIT grant.
See docs/bil/ORIGIN-AND-IP.md.
