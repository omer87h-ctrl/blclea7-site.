# Typed images in CLEA7 browser applications

Browser Studio/Runtime 0.16 and this SDK share BIL5, application9 and the versioned
`firebase.development/4` contract. The latest published Windows/Android downloads
remain 0.15. They do not implement this new adapter. Native source/host changes
require separate native verification before a matching native release is offered.

From a blank Studio project, open the backend authoring controls. Add registration
and sign-in, `image.choose`, then an explicitly private or shared `image.upload`.
Bind an image component to the typed NativeMedia value. `image.load` accepts the
RemoteImage path; `image.remove` deletes the owner-controlled server object and
`image.discard` removes a local copy. The SDK example is `sdk/examples/bil/shared-images.bil`.

These are development services: use an isolated `demo-clea7-*` project with local
Auth/Firestore/Storage emulators on ports 9099/8080/9199. No production Brzo service,
paid API or account is used by the supplied verification. Configure only your own
separate test environment. A hosted production backend and remote push need their
own adapters, authorization policies and platform verification.

Images are JPEG/PNG inputs up to 5 MiB with bounded dimensions. The trusted browser
host creates a resized JPEG copy, excluding source metadata. Image bytes, credentials
and tokens do not become BIL values or diagnostic payloads. Application, project
and account scope constrain IndexedDB; SHA-256 validates bytes before reuse/upload.
Local saved state backups do not currently include image bytes. Keep an independent
copy of important originals. A client namespace is not server tenant authentication.

Storage rules require an authenticated user for shared reads and the owner for
private reads/deletion. Writes are immutable, MIME/size bounded and list access is
blocked. Firebase download tokens may bypass authenticated reads if disclosed;
production-sensitive media requires a reviewed token-free delivery policy. Do not
publish token-bearing URLs. No invulnerability or production readiness is claimed.

The browser test creates original CSS/canvas imagery. No stock photo, font, model
or third-party application source is bundled by this feature. Existing project
terms and third-party notices still apply. Use files you own or may legally use.
