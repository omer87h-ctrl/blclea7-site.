# Guided Studio architecture review

The product direction is coherent: Studio authors one checked application model; BIL supplies deterministic and intent operations; Runtime owns execution, capabilities, transactions, persistence and diagnostics; SDK and packages provide independent distribution. A visual component palette alone cannot satisfy this model. Authors must be able to describe behavior, inspect failures and export exactly the behavior they tested.

## Observed blockers and changes

| Priority | Observed gap | Implemented response |
| --- | --- | --- |
| High | Legacy application/2 had flow blocks while BIL application/6–9 could select existing handlers but could not compose their ordinary logic visually. | `bil-authoring.js` adds typed values, user-defined record models, handlers, expression trees, conditions, branch insertion, bounded repeats, collection operations and source-preserving edits. |
| High | Newly added BIL buttons could silently navigate to the first screen, appearing inert. | Require an explicit destination or handler; existing buttons expose action binding, empty-handler warnings and direct event editing. Legacy components can create and bind a flow in one operation. |
| High | Run/save/export could use the previously applied project while a newer BIL draft remained in the editor. | Check and apply pending BIL source before all user-facing run/save/export paths; reject conflicts or compiler errors instead of exporting stale source. |
| Medium | Source undo was discarded when Apply reloaded the project. | Preserve source undo/redo across successful Apply while updating the project baseline. |
| Medium | Copying decorated components inferred the key position from the end of the component, corrupting keys before style/motion clauses. | Locate top-level key tokens and replace their actual spans, including nested components. |
| Medium | Shapes and gestures existed in the execution contract but needed code; a valid new gradient could not be created one property at a time. | Add shape selection, event/gesture controls and atomic gradient editing. |

## Boundaries

This change introduces no new BIL opcode, application ABI, executable extension loader, native privilege or network service. Existing compiled source/IR verification remains authoritative. Edits compile before adoption. Unknown expressions and professional code are preserved; the visual editor does not silently regenerate the whole file. Closed operation lists are not unrestricted code execution.

The seven existing responsibilities continue to execute through the same Engine: task budgets and dispatch; typed capability bridges; registered operations; rollback and persisted state; checked UI/events; existing fallback contracts; real source-mapped traces. This editor does not invent seven new models or display synthetic runtime results.

No new external code, image, font, dependency, AI call, telemetry or license change was introduced. Original compiler and editor logic was written for this repository. Familiar control-flow and expression constructs are standard programming concepts; no global-first novelty or legal clearance is asserted.

## Evidence and scope

Model tests exercise typed authoring and actual Engine execution, including package isolation, persistence, rollback, replay, shadow and source retention. Browser tests author the reference scene exclusively through actual Studio controls, then execute, export, install and restart it. Windows proof must run the actual frozen WebView2 application and the same Studio-authored BIL source. Test IDs and final source hashes belong in the acceptance record after completion.

The general-platform acceptance matrix remains separate. A tested editor expansion does not establish full Android Studio feature parity, production remote media/push, arbitrary native extensions, OS process isolation, device battery superiority or an invulnerable runtime. Continue verifying those requirements through executable capabilities and the full two-device benchmark; never replace them with template screenshots.
