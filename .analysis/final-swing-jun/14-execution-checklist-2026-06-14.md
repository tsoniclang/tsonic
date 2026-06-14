# Final Swing Execution Checklist — 2026-06-14

This checklist is the active low-level execution tracker for the final TSTS-backed Tsonic architecture branch.

Rules for this work:

```text
Do not stop at partial completion.
Do not treat a category as done until product code, tests, deletion gates, and downstream gates prove it.
Do not keep dual paths, legacy compatibility, or fallback TypeScript compiler API product paths.
Do not start final expensive gates until the code-completeness audit is signed off.
Report this checklist every 15 minutes while long-running work is active.
```

## Current Checkpoint

```text
branch: feature/tsts-final-completion
latest pushed commit before this checkpoint: b3a28533 eliminate string-driven emission decisions
current local state: AST-emission cleanup implemented; pending commit/push
focused validation: 107 passing / 0 failing after AST-emission cleanup
build validation: @tsonic/frontend and @tsonic/csharp-emitter both build
full run-all: not restarted after AST-emission cleanup; final gates wait for code-completeness signoff
not done: remaining plan sweep, legacy audit refresh, run-all, downstreams
```

## Low-Level Work Items

| ID | Area | Required final state | Current status | Remaining proof |
| --- | --- | --- | --- | --- |
| 0.1 | Baseline | Branch starts from current `main` | Done earlier | Reconfirm before PR |
| 0.2 | Hygiene | Branch hygiene clear | Pending | Run branch hygiene after final commit |
| 0.3 | Branch | One active branch for the final swing | Done | Continue on `feature/tsts-final-completion` |
| 0.4 | Spec | Canonical plan recorded | Done | Keep this checklist current |
| 0.5 | Baseline tests | Initial focused baseline known | Done earlier | Final gates still required |
| 1.1 | TSTS package contract | Tsonic consumes current TSTS public APIs | In progress | Audit private imports and vendored deltas |
| 1.2 | Extension host | Generic lifecycle is available | Done | TSTS extension host tests in final gate |
| 1.3 | Fact store | Typed sidecar facts are available | Done | Fact tests and no direct node mutation search |
| 1.4 | Checker facade | Types, symbols, signatures, narrowed/use-site types exposed | In progress | Focused tests for flow/contextual/generic cases |
| 1.5 | Diagnostics | TSTS and extension diagnostics adapt through one path | In progress | Focused validator failures resolved |
| 1.6 | Import/module identity | Module graph/import identity usable from public TSTS API | In progress | Package/type-root tests green |
| 2.1 | SourceFrontend | Single frontend boundary exists | Done | Boundary test remains green |
| 2.2 | SourceProgram/SourceModule | TSTS-backed source program is the product model | Done | Final product audit |
| 2.3 | SourceDiagnostic | Diagnostics are frontend-neutral | In progress | Validator tests green |
| 2.4 | CLI routing | CLI/build/test use frontend boundary | In progress | CLI tests and product import audit |
| 2.5 | No fallback frontend | No product TypeScript frontend remains | Pending final audit | Final banned-search audit |
| 3.1 | Fact keys | Tsonic facts use typed keys | Done | Search for string-keyed fact lookup |
| 3.2 | Core imports | `@tsonic/core` imports resolve through extension identity | Done | Alias/shadow tests green |
| 3.3 | Numeric primitives | Numeric primitive facts attach in source terms | Done | Emitted-output fixture proof |
| 3.4 | Source package bindings | External bindings attach through canonical metadata | In progress | Source package fixture/downstream proof |
| 3.5 | Passing mode | `out`/`ref`/`inref` source facts are backend-neutral | In progress | Passing-mode validation and emit proof |
| 3.6 | Attributes | Attribute slots are source facts, not CLR facts | In progress | Attribute fixture and backend render proof |
| 3.7 | Native diagnostics | Tsonic source restrictions run through extension diagnostics | In progress | Current validator repairs complete |
| 3.8 | Fact tests | Every fact family has positive/negative tests | Expanded | Expression/computed-name fact tests green; continue remaining groups |
| 4.1 | TSTS builder | Program builder invokes TSTS | Done | Final product audit |
| 4.2 | Extension registration | Tsonic source extension is registered by default | Done | Creation tests green |
| 4.3 | Diagnostic adaptation | TSTS and extension diagnostics are converted once | In progress | Focused validator tests green |
| 4.4 | Source files/modules | Runtime closure and semantic support files are separated | In progress | Entry/package/type-root tests green |
| 4.5 | Checker/facts exposure | Lowering can query TSTS checker and fact store | Done | Lowering tests green |
| 4.6 | Fixture comparisons | Key fixtures prove equivalent or intended behavior | Partial | Focused fixtures green |
| 5.1 | LoweringInput | Lowering reads TSTS program/facts/checker | Done | Compile/test proof |
| 5.2 | Module/declaration plans | Declarations lower as AST/fact-backed plans | In progress | C# declaration render tests |
| 5.3 | Type plans | Types render from source plans/facts | In progress | Numeric/external/interface tests |
| 5.4 | Expression/statement plans | Expressions/statements lower through plan builders | In progress | New renderers committed and tested |
| 5.5 | Call plans | Calls use TSTS signatures, not local overload scoring | In progress | Generic alias emission now fact-backed; remaining overload fixtures pending |
| 5.6 | Member/index plans | Member/index access use checker answers and source facts | In progress | Length-property emission now fact-backed; remaining member/index fixtures pending |
| 5.7 | Narrowing plans | Use-site type comes from TSTS checker facade | In progress | No eager source narrowing owner remains |
| 5.8 | Synthetic declarations | Synthetic declarations are backend-neutral plan artifacts | Partial | Audit and fixture proof |
| 5.9 | Capability validation | Capability checks use source-feature terms | Partial | Capability tests green |
| 6.1 | Module graph/diagnostics | TSTS owns semantic module graph | Partial | Type-root/package tests green |
| 6.2 | Declarations/exports | Exports/declarations use TSTS graph/checker | In progress | Declaration/export fixtures green |
| 6.3 | Type refs/numerics | Type references use facts/checker | Pending emitted proof | Emitted proof |
| 6.4 | Expressions/literals | Expression plans cover required source forms | In progress | Plan/render tests green |
| 6.5 | Calls/overloads | Overload/generic resolution delegated to TSTS | Partial | Generic-function-value failures fixed |
| 6.6 | Member/index access | Member/index lookup delegated to TSTS | Partial | Fixtures green |
| 6.7 | Control-flow/narrowing | No eager branch narrowing engine remains | Partial | Search audit and fixtures |
| 6.8 | Attributes | Attribute handling moved to source facts/lowering | Partial | Search and emit proof |
| 6.9 | External source bindings | External binding facts use one manifest shape | Partial | No legacy/v1/v2 bridge audit |
| 6.10 | Synthetic declarations | Synthetic declarations no longer depend on old IR | Partial | Compile/audit proof |
| 7.1 | Delete `typescript` product imports | Product frontend does not import TSC | Pending final search | Final search gate |
| 7.2 | Delete old graph extraction | No product import/export semantic walkers | Pending final search | Final search gate |
| 7.3 | Delete old symbol IDs | No target-rendered source IDs | Pending audit | Search and dependency audit |
| 7.4 | Delete old IR builder | No parallel source IR tree as product source of truth | In progress | Build breaks repaired via lowering plans |
| 7.5 | Delete old inference/binding | No local checker/generic/call inference owner | Improved | Module-wide generic alias inference deleted; search and focused tests still required |
| 7.6 | Delete eager narrowing | No old narrowing engine in product path | In progress | Search and focused tests |
| 7.7 | Delete legacy manifests | One metadata schema only | Pending audit | Search `legacy`, `v1`, `v2`, normalizers |
| 7.8 | Delete backend leakage | No frontend CLR/C#/System facts | Pending audit | Search gate clean or documented test-only matches |
| 8.1 | Frontend focused tests | Focused repaired suites green | Green for AST-emission cleanup | 107 passing / 0 failing focused bundle |
| 8.2 | Frontend full tests | Frontend package tests green | Done at checkpoint | `426 passing / 0 failing`; re-run after lowering repairs |
| 8.3 | TSTS package build | Vendored TSTS compiles | Done for last checkpoint | Re-run after TSTS edits |
| 8.4 | C# emitter tests | Plan renderer tests green | Pending | Emitter/unit suite |
| 8.5 | Full run-all | Complete Tsonic gate green | Pending | `./test/scripts/run-all.sh` |
| 8.6 | Downstreams | Proof pudding, tsumo, clickmeter, first-party consumers green | Pending | Run after run-all |
| 8.7 | Branch hygiene | No uncommitted/unmerged local work | Pending | Hygiene script and clean status |
| 8.8 | Final report | Commit range, changed files, deleted paths, tests, downstreams | Pending | Produce after gates |

## Active Failure Themes

| Theme | User-code example | Required fix |
| --- | --- | --- |
| Generic function value contextual use | `const id = <T>(x: T): T => x; const box: { run: (x: number) => number } = { run: id };` | Use TSTS contextual/checker answers; do not reject valid monomorphic contextual use |
| Generic function value escape | `const id = <T>(x: T): T => x; const obj = { id };` | Reject source-unsafe generic escape when no safe contextual callable target exists |
| Arrow contextual typing | `type Op = (a: number, b: number) => number; const ops: Op[] = [(a, b) => a + b];` | Recognize contextual type from the array/object container through TSTS facade |
| Type-root/source-package graph | `import type { PathLike } from "node:path";` | Use TSTS module/type-root graph; do not reconstruct a parallel resolver |
| Runtime closure filtering | `tests.entryPoint` imports only tests while semantic support files exist | Emit only runtime closure; keep semantic support for checking only |

## AST-Emission Cleanup Checkpoint

| Item | Before | Current state | Proof |
| --- | --- | --- | --- |
| Runtime expression semantics | Lowering recognized `console`, `Error`, `undefined`, and `.length` from local identifier text | TSTS source extension writes `expressionSemanticsFactKey`; lowering only consumes the fact | `source-semantics.test.js`: ambient/global positives and local-shadow negatives |
| Well-known computed names | Lowering recognized `[Symbol.iterator]` and `[Symbol.asyncIterator]` by `Node_Text` on receiver/member | TSTS source extension writes `wellKnownComputedNameFactKey`; declaration lowering consumes the fact | `source-semantics.test.js`: ambient/global positives and local-shadow negatives |
| Generic function aliases | C# module rendering used a module-wide alias map from source names | Source extension writes `genericFunctionAliasFactKey`; identifier plans carry `aliasTargetName`; alias declarations carry `compileTimeOnly` | Focused generic-function tests green |
| Enum initializers | C# enum rendering used `initializer.literalText ?? "0"` | C# enum rendering calls `renderExpression(member.initializer, context)` | C# emitter build green |
| Audit result | Legacy string/parser patterns existed in lowering/emitter | Targeted audit reports only diagnostic `sourceFile.Text()` and numeric literal token fallback | Audit command: `rg 'splitTopLevel|stripTypeSyntax|typeText|returnTypeText|declaredTypeText|contextualTypeText|sourceText\\.includes|nameSourceText\\.includes|expressionAliases|LoweringExpressionAliasPlan' packages/frontend/src packages/targets/csharp/emitter/src -g '*.ts'` |

Concrete source example now covered:

```ts
class Error {
  message: string;
  constructor(message: string) { this.message = message; }
}

export function local(value: string): void {
  const err = new Error(value);
  const size = value.length;
  void err;
  void size;
}
```

The local `Error` receives no `error-constructor` fact. The string `.length` receives a `length-property` fact because the TSTS checker proves the receiver type is `string`.

## Active Lowering/Renderer Failure Themes

These are the current blockers from the first full `run-all` attempt after frontend validation passed.

| Theme | User-code example | Current bad C# shape | Required fix |
| --- | --- | --- | --- |
| Explicit primitive aliases erased inside generic type nodes | `function createIntBox(value: int): Box<int> { return { value }; }` | `Box<number>` and `number` appears as a C# type | Preserve explicit source type-node text/facts for `int`, `long`, etc.; render arbitrary generics recursively |
| Interface type members dropped | `interface Box<T> { value: T }` | `public interface Box<T> { }`, then `box.value` fails | Lower `PropertySignature`/`MethodSignature` as declaration plans, not only class declarations |
| Intrinsics emitted as ordinary calls | `const x = defaultof<int>();` | `defaultof<int>()` remains in generated C# | Carry `intrinsicSemanticsFact` into lowering plans and render `default(T)`, `is`, `as`, `nameof`, etc. |
| Destructuring names not declared | `const [first, second] = values;` | later generated code references `first`/`second` without declarations | Lower binding patterns into deterministic temp plus element/member declarations |
| Contextual callback params degrade to `object` | `values.map(x => x + 1)` under a typed delegate context | lambda parameter emits as `object x`, causing delegate conversion errors | Query TSTS contextual/checker answers for unannotated lambda/function parameters |
| Unsupported source expression nodes leak to renderer | `void f();`, `function* g(){ yield 1; }` | `KindVoidExpression` / `KindYieldExpression` unsupported in expression context | Add explicit lowering/rendering plans for required expression nodes or deterministic diagnostics |
| External source-package names lose qualified target identity | `new DefaultHttpContext()` from an external source package | bare `DefaultHttpContext` missing namespace/import in generated C# | Use canonical external binding/source-package facts in lowering/rendering; no name guessing |

## Reporting Cadence

Every 15-minute report during active long-running work must include:

```text
branch
latest commit
dirty/clean state
current checklist status deltas
focused pass/fail counts when tests are running
run-all/downstream status when started
CPU utilization row for long test runs
next concrete action
```
