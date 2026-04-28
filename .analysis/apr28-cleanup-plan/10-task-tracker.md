# Task Tracker

Status meanings:

- `TODO`: not started or not verified.
- `IN PROGRESS`: edits exist but not fully reviewed/validated.
- `DONE`: implemented and focused validation passed.
- `BLOCKED`: needs decision or external merge/publish.
- `DECIDED`: policy/design decision made; implementation still pending.

## Current Priority Override

The first execution block is now drift repair from `00-drift-first-recovery-plan.md`.

The interrupted task was the interim diff review. That review is complete enough to drive the next implementation phase and is captured under `.analysis/interim-review-apr28-A`.

Nothing downstream, package-related, publish-related, or broad full-gate-related should proceed until the drift block below is complete.

## Drift-First Block

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| DF0 | Preserve interim diff review | DONE | `.analysis/interim-review-apr28-A` contains summary, drift report, required actions, and a 486-path ledger |
| DF1 | Stop over-banning narrowing syntax | TODO | `typeof`, `Array.isArray`, and `"prop" in value` are accepted only when TypeScript proves flow facts and Tsonic proves carrier/member safety |
| DF2 | Split `unknown` storage and structured carrier semantics | TODO | Opaque `unknown` can store/pass; structural reads require a closed carrier or diagnostic |
| DF3 | Move semantic guard authority to frontend | TODO | Emitter materializes proven facts and does not rediscover arbitrary TypeScript guard semantics |
| DF4 | Keep JS builtin name sets diagnostic-only | TODO | JS APIs lower only through active surface metadata or declared receiver members |
| DF5 | Convert user-reachable ICEs to diagnostics | TODO | Untyped JSON and broad object-literal cases fail before emitter |
| DF6 | Prove Jotster P0 fixes in emitter/golden tests | TODO | `override` family and expression-tree anonymous object examples both have emitted C# proof |
| DF7 | Reconcile docs with drift rules | TODO | Docs distinguish flow facts from runtime dynamic probing |
| DF8 | Incorporate semantic authority super-review | DONE | `11-semantic-authority-super-review.md` records SA1-SA14 with examples and acceptance criteria |

## Semantic Authority Block

| ID | Task | Status | Acceptance |
| --- | --- | --- | --- |
| SA1 | Frontend owns branch narrowing | TODO | `if`/`else` facts come from frontend IR; emitter does not parse arbitrary branch guards for source type decisions |
| SA2 | Ternary uses same flow facts as branches | TODO | `?:` consumes the same proof model as `if`; no ternary-only semantic matcher |
| SA3 | Branch merge uses stable IDs | TODO | no `JSON.stringify` emitted-AST equality for carrier/flow identity |
| SA4 | Remove broad `object[]` synthesis | TODO | `Array.isArray` over broad `unknown/object` requires closed carrier proof or diagnostic |
| SA5 | Scope emitter type compatibility to materialization | TODO | source acceptance decisions move frontend; emitter helpers cannot choose overloads/union arms |
| SA6 | Move object-literal union selection frontend | TODO | selected arm is IR metadata; ambiguous object literal unions are diagnostics before emitter |
| SA7 | Surface member bindings are frontend-owned | TODO | emitter lowers resolved member bindings; no source-name bridge semantics for `length`, `slice`, `push`, `map` |
| SA8 | Truthiness is proven before emission | TODO | broad runtime truthiness helpers are removed or gated behind closed carriers |
| SA9 | Assignment flow facts are frontend-owned | TODO | emitter write adaptation does not mutate semantic narrowed types |
| SA10 | `unknown` has closed carrier semantics | TODO | opaque storage/pass-through works; structural use requires closed carrier or diagnostic |
| SA11 | `in` uses flow fact plus carrier proof | TODO | no CLR reflection/object probing for property existence |
| SA12 | Runtime-union guards consume discriminant proof | TODO | `IsN`/`AsN` emitted only from explicit union arm proof |
| SA13 | Expression-tree anonymous object proof | TODO | expression-tree object literal emits anonymous projection; dictionaries remain dictionary-only |
| SA14 | JSON broad cases become diagnostics | TODO | typed serializers remain; untyped/broad dynamic JSON fails before emitter |

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
| T8 | Implement expression-tree anonymous object lowering | TODO | Generic expression-tree fix for Jotster EF lambdas |
| T9 | Verify overload-family override emission | IN PROGRESS | Frontend test exists; emitter proof pending |
| T10 | Clean downstream invalid JS-surface assumptions | BLOCKED | Deferred for this branch; upstream Tsonic run-all is the current PR scope |
| T11 | Centralize narrowing authority | TODO | Replace duplicate frontend/emitter semantic guard decisions |
| T12 | Remove uncertainty fallbacks | TODO | Ambiguous/unsupported must become diagnostics |

## Compiler Work Items

| ID | Work Item | Status | Acceptance |
| --- | --- | --- | --- |
| C1 | Default-surface `.length` rejects | IN PROGRESS | Unit + fixture proving `xs.length` rejects without JS surface |
| C2 | Default-surface CLR array members come from carrier metadata | IN PROGRESS | `xs.Length` succeeds because `arrayType(T)` has CLR carrier metadata |
| C3 | JS-surface `.length` succeeds | IN PROGRESS | JS surface fixture |
| C4 | JS array methods gated to JS surface | IN PROGRESS | `.slice` rejects default, succeeds JS |
| C5 | Dictionary dot-property fallback removed | IN PROGRESS | `dict.foo` rejects unless declared member |
| C6 | Dynamic import fully rejected | IN PROGRESS | No converter/emitter/resolver path remains |
| C7 | `import.meta` fully rejected | IN PROGRESS | Validation and fixture updates |
| C8 | Object literal broad target rejected before emitter | IN PROGRESS | `TSN7403` not ICE in normal invalid source |
| C9 | JSON.parse requires closed target or approved unknown carrier | IN PROGRESS | Typed parse fixtures pass; untyped parse diagnostics |
| C10 | JSON.stringify requires closed source | IN PROGRESS | DTO/object literal contextual type passes |
| C11 | Runtime union alias storage emission fixed | IN PROGRESS | Missing alias carrier no longer emitted |
| C12 | Runtime union narrowed member returns re-wrap | IN PROGRESS | FromN emitted for narrowed temp return |
| C13 | CLR type identity uses deterministic type id | IN PROGRESS | No raw generic display string compare for semantic decisions |
| C14 | Overload family copies `override` | IN PROGRESS | IR + emitted C# proof |
| C15 | Expression-tree object literal anonymous projection | TODO | `Expression<Func<T,...>>` fixture |
| C16 | TS-only runtime syntax rejected | IN PROGRESS | `public`, class `readonly`, parameter property tests |
| C17 | Type-only readonly remains allowed | IN PROGRESS | Interface/type tests |
| C18 | TypeScript-flow facts feed narrowing | TODO | `unknown` narrows only where TS proves source type |
| C19 | Tsonic numeric proof remains authoritative | TODO | `typeof x === "number"` never proves `int` |
| C20 | Ambiguous overloads hard-error | TODO | No first-candidate overload selection |
| C21 | Ambiguous union arm selection hard-errors | TODO | No broad/cast/runtime-throw fallback |
| C22 | Emitter guard parsing becomes materialization-only | TODO | Emitter consumes frontend facts, does not invent semantic narrowing |
| C23 | Storage cast fallback removed by default | TODO | Direct casts only for explicit/proven conversions |
| C24 | Emitter semantic analyzers audited and retired | TODO | every `narrowedBindings`/guard parser path is classified as frontend proof, materialization, or removal |
| C25 | Branch flow fact model normalized | TODO | branch, ternary, logical, assignment, and truthiness facts have one representation |
| C26 | Closed `unknown`/JSON carrier diagnostics | TODO | unsupported structural `unknown` cases fail deterministically without reflection/dynamic helpers |

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
| P2 | Commit/PR tsonic cleanup | TODO |
| P3 | Commit/PR upstream package changes | TODO |
| P4 | Commit/PR downstream changes | TODO |
| P5 | Publish wave after merge and full validation | TODO |

## Current Focus Queue

1. Finish and preserve the interim diff review artifacts.
2. Execute `DF1` through `DF7` from the drift-first block.
3. Reconcile implementation files and docs against the repaired drift rules.
4. Finish tsonic compiler uncertainty cleanup.
5. Rerun focused tests and group failures by root cause.
6. Run the full upstream Tsonic gate with `./test/scripts/run-all.sh`.
7. Commit and push each completed step on `apr28-refactor`.
8. Open one PR after the full upstream gate is green.
