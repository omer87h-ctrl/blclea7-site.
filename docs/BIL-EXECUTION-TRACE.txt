# BIL execution trace / Vision Q

The runtime records actual execution, not model-written explanations.
`explain last decision` records the latest available real decision. The Studio
BIL panel and existing Runtime diagnostics expose the same facts.

An instruction entry includes its stable source id, IR instruction, source
start/end and line/column, **actually evaluated** symbol reads, writes, measured
milliseconds and `cache: not-used`. Parent control statements aggregate actual
child reads; references in an unexecuted branch are not reported as evaluated.
Source maps separately describe compiler locations and static plan structure.

An intent decision includes the registry version, declared intent and input type,
registered host presenters, eligible and rejected candidates with reasons, selected
renderer, AI invocation/use status, fallback status and the generated view result.
Raw private values are omitted. The separate real presentation report describes
DOM presenters and whether motion played, was reduced, was unavailable or static.

Condition results, typed faults and try rollback are recorded. Whole-handler
failure leaves persisted state unchanged. `Runner` retains at most 256 entries /
64 KiB, and the existing Engine further bounds the event history. Instrumentation
cost and timing vary by host; timing is not part of deterministic resolver semantics.
There is no universal CPU/RAM/battery benchmark in these entries.

Existing Engine replay capture can include application state and source within
its local budget. This is kept locally, not sent as telemetry. Exporting existing
application data/diagnostics is an explicit user action and can disclose its contents.
Developers must not log secrets in their own raised error text. The trace contract
minimizes automatic value logging; it is not encrypted storage or data-loss prevention.

Pure BIL events can be replayed against their captured starting state. SHADOW
uses a fresh memory vault and cannot call a proposal provider/native adapter.
AI-invoking events are marked non-replayable rather than pretending to reproduce
an external model. Trace history is not restored across process restart; persisted
application values are restored. No historic decision is fabricated after restart.
