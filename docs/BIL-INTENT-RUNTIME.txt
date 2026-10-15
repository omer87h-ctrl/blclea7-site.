# BIL Intent Runtime

Registry version `bil.capabilities/1` contains original, trusted presenters:
Number -> counter, Text -> text, Boolean -> status, List/Record -> text, and
Number plus known increasing bounds -> progress. Host profiles can remove
capabilities. Unknown operations cannot be dynamically loaded from app input.

## Deterministic resolution

For each intent: check its static input type; inspect host capabilities; preserve
declared candidate order; reject wrong type, unavailable presenter or missing/
invalid progress bounds; choose the first eligible plan, or the declared valid
fallback for an unavailable/rejected AI proposal. The same typed input, profile,
constraints and registry version produce the same deterministic decision. No
random selection, invented min/max or natural-language AI understanding is claimed.

```bil
let number = 10
visualize number using runtime within [progress, counter] range [0, 100] fallback counter
move number on change through runtime
on increase {
    number = number + 1
}
button "Povećaj" runs increase
```

The DOM contains an actual progress element with the declared range. A later
out-of-range value revalidates the binding and uses an eligible counter instead.
Without known bounds, progress is rejected rather than guessed. A typed nullable
value can be shown after a guard; an existing view is hidden while its value is null.
Bounds are captured when the intent executes. Reissue the intent to change bounds.

`move` requests a bounded 180 ms one-iteration Web Animations transition when the
number changes. Reduced-motion suppresses it. Missing motion capability selects a
reported static presentation; it never reports a played animation. Render reports
come from the actual DOM adapter on each host.

## Optional AI proposal contract

A trusted embedding host may construct the existing Engine with:
`{bilAI: trustedAdapter, bilConsent: true}`. There is no default model/adapter,
automatic download or automatic cloud request. This Runtime proposal contract is
separate from the existing Windows Studio's project-generation OpenAI helper.
The latter is not silently connected to BIL decisions.

The adapter receives `bil.ai-decision-request/1`: intent, input type, registry,
allowed renderers, fallback, expected result shape and a 350 ms deadline. No raw
application values, source, filesystem or runtime database are supplied. The only
accepted response is exactly:

```json
{"format":"bil.ai-plan/1","renderer":"counter"}
```

The selected renderer must be registered, permitted, type-compatible, available
and satisfy its range constraints. Extra fields such as scripts/instructions are
rejected. At most four proposals are attempted in one dispatch. Failure/timeout
uses the declared executable fallback, once, without retrying a paid request.
A trusted adapter gets an AbortSignal where supported; ignoring cancellation is
a host/provider integration limitation. An HTTP request may still be billable.

No consent, no provider, SHADOW and REPLAY cause zero provider calls. An actual
provider invocation marks that live event non-replayable. Tests inject explicit
structured test providers; they are not evidence of a real AI model invocation.
Other application engines can continue deterministic work during a proposal wait.
