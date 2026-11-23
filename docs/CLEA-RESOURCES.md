# Project media — Core7 / Runtime0.46+

Resources are bounded data in the existing versioned BIL application envelope.
They do not grant filesystem access, execute code, import a URL, enable a
microphone or upload media to an AI service. Old applications without resources
retain the old1MiB application /2MiB package limit and original language behavior.

```bil
BIL "My sound".
resurs chime vrsta zvuk.
pogled home "My sound" {
 sound chime label "Confirmation" caption "Three rising tones: action confirmed" key sound
}.
```

In Studio → Draw → Resources, choose an ID/type, select your own file and state
its provenance/license. Images are decoded/re-encoded locally as PNG, preserving
transparency and removing the original metadata block. Supported packaged image
types are PNG/JPEG/WebP; audio is PCM16 WAV/MP3/Ogg. Headers, dimensions, sizes and
SHA256 are checked; decoding still depends on the browser. Browser decode failures
are shown clearly. MP3/Ogg playback checks actual metadata/duration; PCM waveform,
RMS and peak analysis are available for PCM16 WAV, not invented for other codecs.

A generated three-note PCM effect can be created without an external recording.
`pcmEffect` supports bounded custom frequencies/durations/gains,1–64 notes and
up to12seconds. It is a conventional local synthesizer, not new neural weights.

`resurs picture vrsta slika.` declares an image. A sprite component uses
`sprite picture label "Actor" frames [4,2] frame actor.frame key actorImage`.
The current frame is a bounded integer numeric state. A sprite can be placed
inside a2D space and uses the same presentation properties and gesture contracts
as Draw vectors. Missing resources are visible while editing but block complete
package/HTML export. Declared IDs/types are the only resource metadata offered
to the source-free AI context; base64, provenance, private filenames and media
content are omitted.

`resources:{format:"clea7.resources/1",items:[...]}` contains records with
`id,kind,mime,bytes,sha256,data,credit,license` and optional audio `cues`.
Data is strict bounded base64. Limits:16 items,4MiB per item,12MiB decoded total,
20MiB serialized application and28MiB package. Images are at most4096² pixels;
PCM16 WAV is mono/stereo8–96kHz and at most180seconds. Credits/license fields are
required data supplied by the author, not a legal rights verifier.

Cues are `{start,end,text}` in seconds, ordered without overlap, at most160;
meaningful speech AND non-speech sounds need descriptions. The runtime displays
the synchronized cue and a browsable text list. Waveforms measure amplitudes;
they do not infer meaning, recognize speech or replace complete captions.

Media is verified before Engine opening and package/HTML export. Object URLs
are scoped to the Engine, revoked at close, and inactive audio is paused. Audio
starts only from an explicit user action in LIVE; isolated SHADOW/REPLAY views
show the text/analysis and never play. No playback resumes after browser restart.
This release targets the browser host; new native-media builds are not claimed.
