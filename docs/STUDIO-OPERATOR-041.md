# One Studio operator —0.41 development delivery

Draw is the primary BIL visual workspace. Its design surface, bound components,
typed collections, screen controls and the existing live `player` use one project,
one BIL source and the same CLEA Core/Runtime. Classic JSON projects and the BIL
source editor remain supported. Runtime ABI for these apps stays0.40.

`web/workbench/studio-operator.js` exports `CLEA7StudioTools`, a bounded data
contract `clea7.studio-tools/1`. Registered operations are project.create,
screen.add, ui.add, ui.collection, draw.add, draw.position, draw.proximity,
bil.declaration, bil.event, bil.item and sense.cv. Source fields are parsed as one
appropriate BIL construct, never evaluated as JavaScript. Operations compile in
order. Unknown tools/keys, incompatible types, source replacement and geometry
outside limits reject. The emitter returns the BIL and explicit behavioral checks.

The existing AI coordinator and SDK decode the same tools. The separately licensed
local9B can propose these operations using a constrained JSON response. Editing
source requires explicit source approval. The actual compiler and seven original
Runtime responsibilities execute isolated checks. Before application, the owner
reviews the result and a source-bound certificate is rechecked; stale or modified
proposals fail. Apply/Undo preserve project identity and unrelated code/state.
Local deterministic commands are labelled **without a neural model**; these are
finite authoring operations, not simulated generative AI. Example:

`Napravi novu aplikaciju sa igračem i vratima koja se otvaraju kad priđe`

After reviewing/applying, the actor's controls update real BIL state and a real
proximity derivation opens the door. Add a progress control, collection or screen
in the same Draw workspace. Export `.clea7` and install it in independent Runtime.
`Napravi novu aplikaciju za CV` uses the byte-exact original `sense-cv.bil` with
empty personal fields and real `sense.local/1` operations; it does not invent a CV.

The tools take at most32 operations,12KiB plan,20 checks and128KiB BIL source.
Documented local commands do not cover arbitrary natural language. Neural output
still requires the actual installed9B. No70B equivalence, new weight training,
universal app authoring or current owner-HP acceptance is claimed.

## Transport and TECH

The shared protected AI client waits after an explicit HTTP429 `busy`/`rate_limit`
rejection before admission, obeying a bounded Retry-After and the existing total
request timeout. Stop cancels the wait. Partial streams, network uncertainty,
accepted-stream errors and authentication failures never replay automatically.
One model slot, authentication and input/resource protections remain intact.
There is no new daily message counter or claim of unlimited machine capacity.

The same TECH mode exposes a read-only official-release/archive monitor. It checks
six fixed official projects with at most13 public GETs, no credentials/private
content, a seven-day window and12-hour detached cache. Archive canonical URL and
release version detect duplicates even if titles differ. Dates are source
publication dates; unconfirmed event dates remain explicitly unknown. Licence
metadata/source/download links accompany candidates. Missing archives and failed
sources stay visible. It exports an editorial report and links the actual TECH
editor. It cannot publish or email anyone, and is not a production CMS backend.

## Executable verification

`node tests/test_studio_operator.cjs`
`node tests/test_ai_capacity_queue.cjs`
`node tests/test_tech_monitor.cjs`
`python -m unittest tests.test_studio_tools`
`python tests/browser_studio_operator.py --output /tmp/clea-operator-proof`

Fixtures identify inference/source transports. The browser operator flow uses no
model reply fixture. Native installers and physical accessibility/device studies
are separate from browser/Core verification.
