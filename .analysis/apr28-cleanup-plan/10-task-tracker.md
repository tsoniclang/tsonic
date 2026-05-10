# Task Tracker

Status meanings:

- `TODO`: not started or not verified.
- `IN PROGRESS`: edits exist but not fully reviewed/validated.
- `DONE`: implemented and focused validation passed.
- `BLOCKED`: needs decision or external merge/publish.
- `DECIDED`: policy/design decision made; implementation still pending.

## Current Priority Override

The first implementation block remains P0 centralization from `13-centralization-audit.md`.

The interrupted task was the interim diff review. That review is complete enough to drive the next implementation phase and is captured under `.analysis/interim-review-apr28-A`.

Downstream and package/publish work remains out of scope for this checkpoint. The upstream Tsonic gate is the only validation target for this branch until the P0 centralization and drift blocks are complete.

The merged `may09-finish-cleanup-plan` PR has been reviewed in `.analysis/merged-pr-review-may10`. That review found no product-specific hacks in the merged checkpoint, but it carried forward centralization gaps around numeric type facts, `typeof` guard proof, test helper pipeline boundaries, closed `unknown` carriers, and object-literal/union-arm materialization.

## Current Upstream Checkpoint

This checkpoint completed the string-key `in` operator repair and NativeAOT preflight harness repair without weakening the language:

- Broad `object`/dynamic shape probing still fails before emission.
- String-indexed carriers lower to typed key operations.
- Declared object properties do not lower as JavaScript own-property existence checks.
- The frontend now records an explicit `in` materialization plan in IR; the emitter consumes that plan and no longer redoes member/carrier discovery for this operator.
- NativeAOT preflight discovers versioned linker libraries through the run-all harness instead of requiring manual system symlinks.

## Drift-First Block

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| DF0 | Preserve interim diff review | DONE | `.analysis/interim-review-apr28-A` contains summary, drift report, required actions, and a 486-path ledger |
| DF1 | Stop over-banning narrowing syntax | TODO | `typeof`, `Array.isArray`, and `"prop" in value` are accepted only when TypeScript proves flow facts and Tsonic proves carrier/member safety |
| DF2 | Split `unknown` storage and structured carrier semantics | TODO | Opaque `unknown` can store/pass; structural reads require a closed carrier or diagnostic |
| DF3 | Move semantic guard authority to frontend | TODO | Emitter materializes proven facts and does not rediscover arbitrary TypeScript guard semantics |
| DF4 | Keep JS builtin name sets diagnostic-only | TODO | JS APIs lower only through active surface metadata or declared receiver members |
| DF5 | Convert user-reachable ICEs to diagnostics | TODO | Untyped JSON and broad object-literal cases fail before emitter |
| DF6 | Prove Jotster P0 fixes in emitter/golden tests | DONE | `override` family and expression-tree anonymous object examples both have emitted C# proof |
| DF7 | Reconcile docs with drift rules | IN PROGRESS | Docs now cover string-key `in` and NativeAOT-safe dictionary lowering; broader unknown/flow docs remain pending |
| DF8 | Incorporate semantic authority super-review | DONE | `11-semantic-authority-super-review.md` records SA1-SA14 with examples and acceptance criteria |
| DF9 | Incorporate centralization audit | DONE | `13-centralization-audit.md` records CA1-CA18 with examples, current repeated authority, central owner, and acceptance criteria |
| DF10 | Incorporate merged PR review gaps | DONE | `.analysis/merged-pr-review-may10` clusters the merged checkpoint by issue type and feeds remaining gaps back into this tracker |

## Semantic Authority Block

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| SA1 | Frontend owns branch narrowing | TODO | `if`/`else` facts come from frontend IR; emitter does not parse arbitrary branch guards for source type decisions; merged PR review confirms `typeof` guard proof still has emitter-side authority to remove |
| SA2 | Ternary uses same flow facts as branches | TODO | `?:` consumes the same proof model as `if`; no ternary-only semantic matcher |
| SA3 | Branch merge uses stable IDs | DONE | branch carrier merge uses deterministic carrier expression keys and refuses unkeyable carrier expressions |
| SA4 | Remove broad `object[]` synthesis | DONE | `Array.isArray` over broad `unknown/object` now requires known array carriers or fails with `TSN5001`; emitter broad array fallback synthesis was removed |
| SA5 | Scope emitter type compatibility to materialization | TODO | source acceptance decisions move frontend; emitter helpers cannot choose overloads/union arms |
| SA6 | Move object-literal union selection frontend | TODO | selected arm is IR metadata; ambiguous object literal unions are diagnostics before emitter |
| SA7 | Surface member bindings are frontend-owned | IN PROGRESS | Removed the generic emitter string `.length` source-name bridge; remaining array/string surface behavior must be backed by frontend member bindings or explicit JS-surface interop metadata |
| SA8 | Truthiness is proven before emission | TODO | broad runtime truthiness helpers are removed or gated behind closed carriers |
| SA9 | Assignment flow facts are frontend-owned | TODO | emitter write adaptation does not mutate semantic narrowed types |
| SA10 | `unknown` has closed carrier semantics | TODO | opaque storage/pass-through works; structural use requires closed carrier or diagnostic |
| SA11 | `in` uses string-key carrier proof | DONE | String-indexed carrier cases are proven in frontend IR and emitted without reflection/object probing; declared object properties are rejected because they do not preserve JavaScript own-property semantics |
| SA12 | Runtime-union guards consume discriminant proof | TODO | `IsN`/`AsN` emitted only from explicit union arm proof; merged PR fixed aligned/nullish materialization but frontend proof ownership is still pending |
| SA13 | Expression-tree anonymous object proof | DONE | expression-tree object literal emits anonymous projection; dictionaries remain dictionary-only |
| SA14 | JSON broad cases become diagnostics | TODO | typed serializers remain; untyped/broad dynamic JSON fails before emitter |

## Centralization Block

These tasks come from `13-centralization-audit.md`. P0 centralization is the first implementation gate because it prevents every subsequent fix from adding another local semantic decision.

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| CA1 | Centralize flow/narrowing facts | IN PROGRESS | `in` operator materialization now starts in frontend IR; merged PR review adds `typeof` runtime-union proof as the next high-priority guard family to centralize |
| CA2 | Centralize type identity/equivalence/stable keys | IN PROGRESS | Heritage dedup/sort now uses stable IR type keys instead of JSON-serialized type arguments; broader semantic comparison audit remains |
| CA3 | Centralize surface API availability and lowering | IN PROGRESS | Generic member-access orchestration no longer contains a JS string `.length` bridge; remaining JS array/string interop branches must be reduced to resolved surface-binding materialization |
| CA4 | Centralize member/property/indexer lookup | IN PROGRESS | `in` operator materialization is frontend-owned; dictionary indexers no longer masquerade as declared dot-properties; broader member/indexer access still requires centralization |
| CA5 | Centralize call/overload/signature/argument resolution | IN PROGRESS | call-site argument passing no longer scores CLR overloads by parsed display signatures; remaining call/lambda context paths still require audit |
| CA6 | Centralize object literal target/materialization | TODO | IR carries nominal/anonymous/dictionary/structural materialization plan; emitter has no object-shape fallback |
| CA7 | Centralize `unknown`/`object`/`JsValue` broad-carrier policy | TODO | Opaque storage is distinct from structural use; property/method access requires frontend proof and closed NativeAOT-safe carrier |
| CA8 | Centralize numeric proof/conversion authority | IN PROGRESS | Numeric conversions/indexing require proof tokens or type-system relation; emitter integral casts no longer treat `number` as proof for `int`; numeric/boolean carrier facts are centralized for validation, post-emission adaptation, and `typeof` matching; expression classification now preserves exact CLR numeric kinds instead of collapsing all integral carriers to `int` |
| CA9 | Centralize JSON parse/stringify policy | TODO | JSON operations carry typed/unknown-with-validation/invalid plan; emitter does not independently decide closedness |
| CA10 | Centralize truthiness/nullish boolean policy | TODO | Branch condition facts are normalized once and consumed by branch, ternary, logical, and coalesce lowering |
| CA11 | Centralize intrinsics/provenance/reserved names | TODO | Intrinsic registry owns name, arity, provenance, target eligibility, and emitted IR kind |
| CA12 | Centralize async wrapper semantics | TODO | Promise/Task/ValueTask/Awaited identity and return normalization come from one async type service |
| CA13 | Centralize direct storage/carrier selection | TODO | Variable, return, conditional, and argument adaptation consume one storage/carrier plan |
| CA14 | Centralize diagnostics vs ICE policy | IN PROGRESS | Product and full-pipeline test entrypoints now share the same build + IR processing gates; broader user-reachable emitter ICE audit remains open |
| CA15 | Centralize stable serialization/dedup ordering | IN PROGRESS | branch carrier merge no longer uses emitted-AST JSON equality; CLR heritage dedup/sort now uses stable IR type keys; nullish-guard carrier comparison now uses explicit carrier keys |
| CA16 | Centralize config/manifest schema parsing | TODO | CLI/frontend/package loaders share schema validators and path-aware diagnostics |
| CA17 | Centralize package/source/path identity | TODO | Resolver/CLI/package manifest code share one canonical package identity model |
| CA18 | Centralize test fixture/generated artifact policy | IN PROGRESS | NativeAOT linker-library discovery is centralized in the run-all harness; broader fixture/generated-artifact policy remains pending |
| CA19 | Centralize test helper pipeline boundaries | DONE | `buildModuleDependencyGraph` and emitter source-to-C# helpers now use the same frontend build + IR processing path; direct emitter helpers are classified as lower-layer IR/materialization tests |

## Current Checkpoint Tasks

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| T1 | Audit current cross-repo diffs | DONE | Captured dirty repo inventory and interim drift review in `.analysis/interim-review-apr28-A` |
| T2 | Write cleanup plan docs | DONE | This directory is the detailed ledger |
| T3 | Resume nodejs selftest fixes | BLOCKED | Blocked behind drift-first Tsonic repair |
| T4 | Finish compiler surface hardcoding cleanup | IN PROGRESS | Need audit remaining `.length`/JS name branches |
| T5 | Finish runtime dynamic helper removal | IN PROGRESS | Need repo-wide reference audit |
| T6 | Finalize typed JSON diagnostics | IN PROGRESS | Emitter ICEs should become validation diagnostics where possible |
| T7 | Implement `unknown` safe carrier and flow proof | DECIDED | Policy decided: TS flow facts plus Tsonic carrier proof; implementation pending |
| T8 | Implement expression-tree anonymous object lowering | DONE | Generic expression-tree fix for Jotster EF lambdas has emitted C# proof |
| T9 | Verify overload-family override emission | DONE | Overload-family real bodies preserve public signature `override` with emitted C# proof |
| T10 | Clean downstream invalid JS-surface assumptions | BLOCKED | Deferred for this branch; upstream Tsonic run-all is the current PR scope |
| T11 | Centralize narrowing authority | TODO | Replace duplicate frontend/emitter semantic guard decisions |
| T12 | Remove uncertainty fallbacks | TODO | Ambiguous/unsupported must become diagnostics |

## Compiler Work Items

| ID | Work Item | Status | Acceptance |
| --- | --- | --- | --- |
| C1 | Default-surface `.length` rejects | DONE | Unit + fixture proving `xs.length` rejects without JS surface |
| C2 | Default-surface CLR array members come from carrier metadata | DONE | `xs.Length` succeeds because `arrayType(T)` has CLR carrier metadata |
| C3 | JS-surface `.length` succeeds | DONE | JS surface fixture |
| C4 | JS array methods gated to JS surface | DONE | `.slice` rejects default, succeeds JS |
| C5 | Dictionary dot-property fallback removed | DONE | `dict.foo` now remains unknown unless a declared member exists; focused frontend proof covers `Record<string, unknown>` writes and dictionary computed access remains separate |
| C6 | Dynamic import fully rejected | DONE | Dynamic `import()` has no converter/emitter/resolver/source-package path; TSN2001 validation proof covers value, awaited, side-effect, non-literal, and package-specifier forms |
| C7 | `import.meta` fully rejected | DONE | `import.meta` has no emitted-code path; TSN2001 validation proof covers property and bare-object forms |
| C8 | Object literal broad target rejected before emitter | DONE | Negative fixture and frontend/emitter focused proofs show broad object targets fail with `TSN7403`; expression-tree and closed contextual object literals remain supported |
| C9 | JSON.parse requires closed target or approved unknown carrier | IN PROGRESS | Typed parse and contextual target validation is proven; untyped, unknown, broad, and union parse diagnostics are proven; closed unknown carrier remains pending |
| C10 | JSON.stringify requires closed source | DONE | Validation rejects unknown/object/dictionary/generic sources before emitter; DTO, closed object literal, and NativeAOT JSON fixtures pass |
| C11 | Runtime union alias storage emission fixed | DONE | Exact alias carrier identity wins before scalar/surface expansion; focused emitter/frontend/CLI/typecheck validation passed |
| C12 | Runtime union narrowed member returns re-wrap | DONE | Narrowed source-owned union arms re-wrap through the carrier alias with `FromN` when returned or assigned to the full carrier |
| C13 | CLR type identity uses deterministic type id | DONE | Emitter CLR identity now delegates metadata/surface generic canonicalization to the frontend identity API; member-binding array checks use identity keys or backend-AST stable type surfaces instead of raw generic display strings |
| C14 | Overload family copies `override` | DONE | IR + emitted C# proof |
| C15 | Expression-tree object literal anonymous projection | DONE | `Expression<Func<T,...>>` fixture |
| C16 | TS-only runtime syntax rejected | DONE | `public`, `private`, `protected`, `readonly` class fields, `abstract`, and constructor parameter properties all fail with TSN2001; ECMAScript `#private` remains valid |
| C17 | Type-only readonly remains allowed | DONE | Interface/type-only `readonly` members are accepted and do not trigger runtime syntax diagnostics |
| C18 | TypeScript-flow facts feed narrowing | IN PROGRESS | `Array.isArray` no longer fabricates array facts for broad `unknown`/`object`; remaining guard families still require the centralized frontend proof model |
| C19 | Tsonic numeric proof remains authoritative | DONE | `typeof x === "number"` rejects as proof for `int`; emitter integration helpers now run numeric coercion validation before emission |
| C20 | Ambiguous overloads hard-error | IN PROGRESS | ref/out/in argument passing now comes only from resolved signatures or proven member bindings; remaining overload-selection paths need audit |
| C21 | Ambiguous union arm selection hard-errors | TODO | No broad/cast/runtime-throw fallback |
| C22 | Emitter guard parsing becomes materialization-only | IN PROGRESS | `in` is frontend-planned; branch carrier merge and nullish-guard stripping use explicit carrier keys instead of serialized AST equality |
| C23 | Storage cast fallback removed by default | TODO | Direct casts only for explicit/proven conversions |
| C24 | Emitter semantic analyzers audited and retired | TODO | every `narrowedBindings`/guard parser path is classified as frontend proof, materialization, or removal |
| C25 | Branch flow fact model normalized | TODO | branch, ternary, logical, assignment, and truthiness facts have one representation |
| C26 | Closed `unknown`/JSON carrier diagnostics | TODO | unsupported structural `unknown` cases fail deterministically without reflection/dynamic helpers |
| C27 | Central numeric type-fact service | DONE | `typeof` matching, validation, and emitter materialization consume one numeric/boolean carrier fact source instead of maintaining local name sets; exact numeric carriers such as `byte`, `ulong`, and `float` stay exact through coercion validation; validated by build, focused frontend numeric/typeof/source-package suites, targeted emitter materialization/union guard suites, and filtered node E2E |
| C28 | Full-pipeline test helper audit | DONE | The source-to-C# emitter integration helper now uses `buildIr` plus the shared IR processing pipeline, so build diagnostics, context diagnostics, rest synthesis, marker collection, soundness gates, numeric proof/coercion, char validation, yield lowering, and virtual marking match product graph builds |

## Upstream Package Items

| ID | Repo | Task | Status |
| --- | --- | --- | --- |
| U1 | `core` | Align runtime declarations and attributes API | IN PROGRESS |
| U2 | `globals` | Reduce default globals to true defaults | IN PROGRESS |
| U3 | `runtime` | Remove dynamic helper APIs | IN PROGRESS |
| U4 | `js` | NativeAOT-safe JS runtime package | DONE pending final re-run |
| U5 | `nodejs` | Source syntax and broad value cleanup | IN PROGRESS |

## Downstream Items

| ID | Repo | Task | Status |
| --- | --- | --- | --- |
| D1 | `express-examples` | Dependency/surface alignment and full verification | TODO |
| D2 | `proof-is-in-the-pudding` | Fix invalid JS/default surface assumptions | TODO |
| D3 | `tsumo` | Remove `JsValue`/dynamic JSON assumptions or migrate to safe `unknown` carrier after implementation | TODO |
| D4 | `clickmeter` | Update deps and run full validation | TODO |
| D5 | `jotster` | Validate reported issues after upstream fixes | TODO |

## Report/PR Items

| ID | Task | Status |
| --- | --- | --- |
| P1 | Produce current diff report before resuming code edits | DONE |
| P2 | Commit/PR tsonic cleanup | DONE |
| P3 | Commit/PR upstream package changes | TODO |
| P4 | Commit/PR downstream changes | TODO |
| P5 | Publish wave after merge and full validation | TODO |

## Current Focus Queue

1. Finish and preserve the interim diff review artifacts.
2. Execute `CA1` through `CA8` as the P0 centralization gate.
3. Execute `DF1` through `DF7` through the centralized owners.
4. Reconcile implementation files and docs against the repaired centralization and drift rules.
5. Finish tsonic compiler uncertainty cleanup.
6. Rerun focused tests and group failures by root cause.
7. Run the full upstream Tsonic gate with `./test/scripts/run-all.sh`.
8. Commit and push each completed step on `may10-complete-cleanup-plan`.
9. Open one PR after the full upstream gate is green.

## Validation Notes

- 2026-04-29 13:55 IST: completed the recursive alias carrier checkpoint. The failing source shape was `const mountedAt = isPathSpec(first) ? first : "/"` where `first` narrows to the source-owned `PathSpec` runtime-union alias and the conditional target is `string | PathSpec`. The fix preserves exact alias identity before scalar/surface expansion, so `PathSpec` materializes as the `PathSpec` arm instead of being expanded to its inner `string` arm. Focused validation passed: `npm run build`, targeted emitter tests, targeted frontend tests, targeted CLI source-package test, and `npm run typecheck`.
- 2026-04-30 23:59 IST: completed the initial `in` and NativeAOT preflight checkpoint on `apr30-complete-cleanup-plan`. Focused validation passed: `npm run build`; `npm run test:frontend -- --grep 'feature gating|TSN2001' --reporter spec` with 44 passing; `npm run test:emitter -- --grep 'in-operator checks only for closed carriers|preserves readable array surfaces after setter writes before length reads' --reporter spec` with 2 passing. Full upstream gate passed with run id `20260430-222604-302148de`: 3088 passed, 0 failed.
- 2026-05-01 00:12 IST: centralized `in` materialization by adding a frontend-authored IR plan. Focused validation passed: `npm run build`; `npm run test:frontend -- --grep 'feature gating|TSN2001' --reporter spec` with 44 passing; `npm run test:emitter -- --grep 'in-operator checks only for closed carriers' --reporter spec` with 1 passing.
- 2026-05-01 10:45 IST: verified the Jotster P0 proof slice. Focused validation passed: `npm run test:emitter -- --grep 'preserves override on methods generated from overload family bodies|emits expression-tree object literal bodies as anonymous objects' --reporter spec` with 2 passing. The overload-family case proves generated members preserve `override`; the expression-tree case proves object literals in expression-tree lambda bodies emit C# anonymous object projections and do not emit dictionary initializers.
- 2026-05-01 10:55 IST: removed serialized emitted-AST equality from branch carrier merging. The branch flow merge now compares only deterministic carrier expression keys (`identifier`, member chain, or transparent cast/parentheses) and refuses to merge unkeyable carrier expressions instead of treating printed emitted shapes as semantic identity.
- 2026-05-02 11:37 IST: full upstream gate passed on branch `apr30-complete-cleanup-plan` before the runtime-intersection cleanup slice. Run id `20260502-100446-3b3acd2f`: 3091 passed, 0 failed. Log: `.tests/run-all-20260502-100446-3b3acd2f.log`; trace: `.tests/run-all-20260502-100446-3b3acd2f.trace.jsonl`.
- 2026-05-02 12:08 IST: removed the remaining broad runtime-intersection fallback. Runtime `intersectionType` now receives a frontend soundness diagnostic instead of emitter lowering to `object`; type-parameter constraints still allow root intersections because they lower as C# generic constraints, not runtime storage. Focused validation passed: `npm run build`; `npm run test:frontend -- --grep 'anyType Detection|Type Parameter Handling' --reporter spec` with 6 passing; `npm run test:emitter -- --grep 'Intersection|intersection' --reporter spec` with 1 passing.
- 2026-05-08 01:50 IST: repaired the transparent compiler-owned union-view intersection regression introduced by rejecting runtime intersections. Source-backed runtime union surfaces can appear internally as `Union_2<Ok, Err> & __Union$views`; this is not a user/runtime intersection and now emits through its single real carrier member while preserving the hard error for non-transparent intersections. Focused validation passed: `npm run test:emitter -- --grep 'truthy/falsy property guards' --reporter spec` with 2 passing; `npm run test:emitter -- --grep 'uses source-backed call surfaces through asinterface structural views|truthy/falsy property guards|wraps recursive middleware rest arrays through nested alias-owned union arms' --reporter spec` with 4 passing; full emitter rerun `emitter-rerun-20260507-122327` with 1199 passed, 0 failed. Full upstream gate passed with run id `20260508-001819-181fdafe`: 3092 passed, 0 failed. Log: `.tests/run-all-20260508-001819-181fdafe.log`; trace: `.tests/run-all-20260508-001819-181fdafe.trace.jsonl`.
- 2026-05-08 01:59 IST: closed the default-vs-JS surface proof gap for member syntax by extending the default-surface negative fixture to cover TS arrays, strings, and `slice()` in addition to CLR `List<T>` JS-style calls. Focused validation passed: `bash test/scripts/run-all/e2e-worker.sh negative test/fixtures/dotnet-disallowed-js-builtins .tests/probe-negative`; `bash test/scripts/typecheck-fixtures.sh --filter array-spread --filter js-surface-runtime-builtins --filter js-string-array-returns` with 3 passed, 0 failed.
- 2026-05-08 13:28 IST: completed the CLR identity centralization slice. The emitter no longer owns a duplicate CLR generic-name parser; its identity helper delegates `getClrIdentityKey` to the frontend canonical identity API. Binding-backed array checks no longer compare raw `System.Array`/`global::System.Array` display strings or generic prefixes; they use canonical CLR identity keys or backend-AST stable type-surface keys. Focused validation passed: `npm run build`; `npm run test:frontend -- --grep 'Span_1|CLR metadata|canonical|type identity' --reporter spec` with 19 passing; `npm run test:emitter -- --grep 'backend-ast utils|type-equivalence|Reference Type Emission|access-length|call-array-wrapper|array length|computed' --reporter spec` with 82 passing; broader identity/surface emitter grep run completed with 114 passing.
- 2026-05-08 13:56 IST: removed broad `object[]`/`System.Array` synthesis from `Array.isArray` narrowing. The frontend no longer narrows `unknown`/`any` to `unknown[]`, emitter guard extraction no longer invents `object[]`, nullable typeof refinements no longer append broad array fallbacks, and validation rejects broad `Array.isArray` sources with `TSN5001` before emission. Concrete array unions and runtime-union array arms remain supported. Focused validation passed: `npm run build`; `npm run test:frontend -- --grep 'Array.isArray|unknown|feature gating|TSN5203|TSN7402' --reporter spec` with 42 passing; `npm run test:emitter -- --grep 'broad unknown Array.isArray|broad unknown typeof-object|Array.isArray-narrowed unknown|broad array assertions|Array.isArray|concrete union Array.isArray|boolean alias gates' --reporter spec` with 18 passing.
- 2026-05-09 14:25 IST: tightened JavaScript `in` after the PR review identified declared-member proof as policy-sensitive. The frontend now permits `in` only for string-indexed dictionary carriers; declared object properties are rejected because Tsonic does not preserve JavaScript own-property existence metadata for closed structural objects. The IR plan now has only the `dictionaryKey` form, and emitter support for `closedMember -> true` was removed. Focused validation passed: `npm run build`; `npm run test:frontend -- --grep 'feature gating|TSN2001' --reporter spec` with 44 passing; `npm run test:emitter -- --grep 'in-operator checks|declared object properties' --reporter spec` with 2 passing.
- 2026-05-09 15:10 IST: closed the numeric-proof authority gap. `typeof value === "number"` proves TypeScript `number` only; it no longer satisfies `int` returns/assignments through emitter cast fallback. The emitter integration pipeline now runs `runNumericCoercionPass` before call-resolution refresh, and integral cast adaptation only casts already-integral/proven sources or representable integral constants. Focused validation passed: `npm run build`; `npm run test:emitter -- --grep 'expected-type-adaptation|typeof-number narrowing|fixed parameters lowered from rest callbacks|boxed storage values through broad calls' --reporter spec` with 34 passing.
- 2026-05-10 10:35 IST: closed the full-pipeline source-to-C# helper boundary gap. `compileProjectToCSharp` no longer builds modules with a local `buildIrModule` loop that could silently drop failed modules or omit converter context diagnostics. It now calls frontend `buildIr`, then the shared `runIrProcessingPipeline` used by product dependency-graph builds. Focused validation passed: `npm run build`; direct emitter fixture mirror smoke with 1 passing; direct emitter regression smoke with 3 passing.
- 2026-05-10 11:05 IST: removed the generic emitter JS string `.length` bridge from `emitMemberAccess`. JS/default surface validation still rejects default-surface JS names; JS-surface string/array length must now flow through resolved binding-specific access or JS array-like interop instead of a generic source-name shortcut. Focused validation passed: `npm run build`; `access-length` unit with 1 passing; JS-array member binding frontend test with 3 passing; length/slice/default-surface emitter regression grep with 9 passing.
