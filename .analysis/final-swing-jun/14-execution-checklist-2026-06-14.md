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
latest pushed commit before this checkpoint: 7cbe6ca1 Require explicit CSharp type plans
current local state: C# type rendering no longer accepts `undefined` as `object?`; required declaration, parameter, member, alias, lambda, dictionary, and JSON parse types report unsupported diagnostics when the lowering plan lacks a proven type; `Object.entries(...)` no longer invents `object` when the record value type is not proven; parameter and enum member lowering carries source diagnostics and the renderer reports missing names instead of inventing `arg`, `Member`, or `_`
focused validation: @tsonic/frontend build green after declaration-owner exact-one cleanup; @tsonic/frontend lowering plan builders subset 10 passing / 0 failing after declaration-owner exact-one cleanup; @tsonic/cli build green after declaration-owner exact-one cleanup; @tsonic/csharp-emitter build green after declaration-owner exact-one cleanup; @tsonic/frontend build green after exact-one fallback cleanup; @tsonic/frontend lowering plan builders subset 10 passing / 0 failing after exact-one declaration/signature cleanup; @tsonic/cli build green after exact-one fallback cleanup; @tsonic/csharp-emitter build green after exact-one fallback cleanup; @tsonic/frontend build green after TSTS module-graph runtime closure switch; @tsonic/frontend graph/source/program-creation subset 29 passing / 0 failing after TSTS module-graph runtime closure switch; @tsonic/cli build green after TSTS module-graph runtime closure switch; @tsonic/csharp-emitter build green after TSTS module-graph runtime closure switch; @tsonic/frontend build green after public graph-entrypoint removal and lowering graph fallback removal; @tsonic/cli build green after public graph-entrypoint removal and lowering graph fallback removal; @tsonic/csharp-emitter build green after public graph-entrypoint removal and lowering graph fallback removal; @tsonic/frontend focused graph/source/lowering subset 48 passing / 0 failing after `TsonicProgram.workspaceGraph` addition and fixture schema cleanup; @tsonic/frontend multi-character string overload regression 1 passing / 0 failing; @tsonic/cli NativeAOT library regression 1 passing / 0 failing after char-context fix; @tsonic/cli build green after deterministic package-folder resolution; @tsonic/cli restore/NuGet subset 14 passing / 0 failing after deterministic package-folder resolution; @tsonic/frontend lowering plan builders subset 9 passing / 0 failing after fallback removal; @tsonic/frontend dictionary subset 2 passing / 0 failing after removing dictionary fallback; @tsonic/cli build green after source-function selector deletion; @tsonic/frontend dictionary/runtime-visibility subset 4 passing / 0 failing; @tsonic/csharp-emitter record renderer subset 1 passing / 0 failing; previous @tsonic/frontend surface profile subset 14 passing / 0 failing; previous @tsonic/cli surface profile subset 15 passing / 0 failing; previous @tsonic/frontend lowering plan builders/source-semantics attribute subset 2 passing / 0 failing; previous @tsonic/csharp-emitter attribute renderer subset 1 passing / 0 failing; previous @tsonic/frontend validator/maximus suites 260 passing / 0 failing; previous targeted native-library/source-package CLI subset 8 passing / 0 failing
package validation: @tsonic/frontend full package test 418 passing / 0 failing; @tsonic/csharp-emitter full package test 3 passing / 0 failing
build validation: @tsonic/frontend and @tsonic/csharp-emitter build after current local changes; prior @tsonic/tsts and @tsonic/cli build green after latest committed broad sweep
audit validation: product TSC import search clean outside vendored TSTS; frontend CLR/C#/System target leakage search clean; old IR/source-text emission decision search clean except diagnostics/token labels; message-substring capability gating removed; product duplicate `Record` named-type checks removed outside source fact production; unused source-function signature fallback selector symbols removed from CLI; lowering fallback `unknown` search now reports only real source `unknown` and declaration-kind label; product search for `pickPackageFolder`, first package-folder indexing, source-signature first-choice fallback, and exact-nullish fallback is clean; product search for `buildModuleDependencyGraph`, `ModuleDependencyGraphResult`, and public `dependency-graph` paths is clean; product search for fallback `intrinsicTypePlan("object"|"unknown"|"any")` in frontend lowering/tsonic-extension is clean; product search for renderer/lowering invented `arg`/`Member` names is clean
full run-all: not restarted after current lowering sweep; final gates wait for code-completeness signoff
not done: final stale frontend sweep, final run-all, downstreams, branch hygiene, final PR report
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
| 1.4 | Checker facade | Types, symbols, signatures, narrowed/use-site types exposed | Expanded | Lowering tests prove use-site source primitives, contextual callables, and cross-module signature returns |
| 1.5 | Diagnostics | TSTS and extension diagnostics adapt through one path | Expanded | Capability suppression now uses typed extension diagnostic metadata, not message text; validator suites 260 passing |
| 1.6 | Import/module identity | Module graph/import identity usable from public TSTS API | In progress | Package/type-root tests green |
| 2.1 | SourceFrontend | Single frontend boundary exists | Done | Boundary test remains green |
| 2.2 | SourceProgram/SourceModule | TSTS-backed source program is the product model | Done | Final product audit |
| 2.3 | SourceDiagnostic | Diagnostics are frontend-neutral | Expanded | Whole-program and source-file validators use the same structured capability filter; validator suites 260 passing |
| 2.4 | CLI routing | CLI/build/test use frontend boundary | In progress | CLI tests and product import audit |
| 2.5 | No fallback frontend | No product TypeScript frontend remains | Clean in current product search | Final banned-search audit |
| 3.1 | Fact keys | Tsonic facts use typed keys | Done | Search for string-keyed fact lookup |
| 3.2 | Core imports | `@tsonic/core` imports resolve through extension identity | Done | Alias/shadow tests green |
| 3.3 | Numeric primitives | Numeric primitive facts attach in source terms | Done | Emitted-output fixture proof |
| 3.4 | Source package bindings | External bindings attach through canonical metadata | Expanded | Surface-profile target member semantics removed from manifests/resolvers; source package fixture/downstream proof still pending |
| 3.5 | Passing mode | `out`/`ref`/`inref` source facts are backend-neutral | In progress | Passing-mode validation and emit proof |
| 3.6 | Attributes | Attribute slots are source facts, not CLR facts | Expanded | TSTS source fact, lowering plan, and C# renderer focused tests green; full attribute fixture proof pending |
| 3.7 | Native diagnostics | Tsonic source restrictions run through extension diagnostics | Expanded | Capability-dependent diagnostics carry `capabilityFeatureKey` metadata |
| 3.8 | Fact tests | Every fact family has positive/negative tests | Expanded | Expression/computed-name facts green; marker projection and C# struct/field/extension receiver tests green |
| 4.1 | TSTS builder | Program builder invokes TSTS | Done | Final product audit |
| 4.2 | Extension registration | Tsonic source extension is registered by default | Done | Creation tests green |
| 4.3 | Diagnostic adaptation | TSTS and extension diagnostics are converted once | Expanded | Message-based suppression deleted; validator suites 260 passing |
| 4.4 | Source files/modules | Runtime closure and semantic support files are separated | Expanded | Runtime source selection now traverses TSTS module graph from runtime seeds; focused Program Creation/source graph subset 29 passing / 0 failing |
| 4.5 | Checker/facts exposure | Lowering can query TSTS checker and fact store | Done | Lowering tests green |
| 4.6 | Fixture comparisons | Key fixtures prove equivalent or intended behavior | Partial | Focused fixtures green |
| 5.1 | LoweringInput | Lowering reads TSTS program/facts/checker | Done | Compile/test proof |
| 5.2 | Module/declaration plans | Declarations lower as AST/fact-backed plans | Expanded | TSTS marker and attribute facts now project into declaration/parameter plans; top-level structural helper collection covered by C# module renderer test |
| 5.3 | Type plans | Types render from source plans/facts | Expanded | Source primitive use-sites, alias targets, recursive alias guard, `Record<K, V>` dictionary plans, and no-fallback checker type lowering covered; full emitted fixtures still required |
| 5.4 | Expression/statement plans | Expressions/statements lower through plan builders | Expanded | New lowering and renderer tests green |
| 5.5 | Call plans | Calls use TSTS signatures, not local overload scoring | Expanded | Base-constructor lowering now accepts exactly one construct signature instead of choosing the first; generic alias emission fact-backed; remaining overload fixtures pending |
| 5.6 | Member/index plans | Member/index access use checker answers and source facts | Expanded | Length-property and dictionary value typing are fact/plan-backed; remaining member/index fixtures pending |
| 5.7 | Narrowing plans | Use-site type comes from TSTS checker facade | Expanded | Product lowering uses TSTS use-site/contextual queries; runtime visibility is fact-backed; final search after run-all still required |
| 5.8 | Synthetic declarations | Synthetic declarations are backend-neutral plan artifacts | Partial | Audit and fixture proof |
| 5.9 | Capability validation | Capability checks use source-feature terms | Expanded | Capability filtering is keyed by feature metadata; validator suites 260 passing |
| 6.1 | Module graph/diagnostics | TSTS owns semantic module graph | Expanded | Public old dependency-graph constructor deleted; lowering graph is built from the already-created TSTS program; runtime source selection and workspace edges now use TSTS module graph |
| 6.2 | Declarations/exports | Exports/declarations use TSTS graph/checker | Expanded | `struct`, `field<T>`, `Interface<T>`, and `thisarg<T>` are plan facts, not renderer source-name checks |
| 6.3 | Type refs/numerics | Type references use facts/checker | Expanded | Lowering tests prove `int`/`char`, recursive aliases, and ambient `Record<K, V>` dictionary facts; emitted fixture proof still required |
| 6.4 | Expressions/literals | Expression plans cover required source forms | Expanded | Char literals, array spread, and structural alias helper renderer tests green |
| 6.5 | Calls/overloads | Overload/generic resolution delegated to TSTS | Partial | Generic-function-value failures fixed |
| 6.6 | Member/index access | Member/index lookup delegated to TSTS | Expanded | Record value typing no longer uses named `Record` checks; broad fixtures pending |
| 6.7 | Control-flow/narrowing | No eager branch narrowing engine remains | Partial | Search audit and fixtures |
| 6.8 | Attributes | Attribute handling moved to source facts/lowering | Expanded | Descriptor/application facts, lowering plans, and C# renderer support implemented; full fixture proof pending |
| 6.9 | External source bindings | External binding facts use one manifest shape | Expanded | `memberSemantics` surface-manifest parser/merger removed from frontend and CLI; source package fixture/downstream proof still pending |
| 6.10 | Synthetic declarations | Synthetic declarations no longer depend on old IR | Partial | Compile/audit proof |
| 7.1 | Delete `typescript` product imports | Product frontend does not import TSC | Clean in current product search | Final search gate |
| 7.2 | Delete old graph extraction | No product import/export semantic walkers as public entrypoints | Expanded | `buildModuleDependencyGraph`, `ModuleDependencyGraphResult`, and public `dependency-graph` path removed; TSTS module graph now decides post-build runtime source closure and workspace edges; remaining import-closure seeding is internal bootstrap for path mapping |
| 7.3 | Delete old symbol IDs | No target-rendered source IDs | Pending audit | Search and dependency audit |
| 7.4 | Delete old IR builder | No parallel source IR tree as product source of truth | In progress | `Record<K, V>` added as a lowering plan kind backed by source facts; remaining old-plan audit pending |
| 7.5 | Delete old inference/binding | No local checker/generic/call inference owner | Expanded | Standalone generic-function helper deleted; unused source-function signature fallback selector deleted; arbitrary first declaration/signature selection removed from lowering |
| 7.6 | Delete eager narrowing | No old narrowing engine in product path | Expanded | Lowering uses TSTS `getNarrowedTypeAtLocation`; old-path search clean |
| 7.7 | Delete legacy manifests | One metadata schema only | Expanded | `AliasMetadataV1` removed; no V1/V2 bridge names remain in frontend/emitter product code |
| 7.8 | Delete backend leakage | No frontend CLR/C#/System facts | Expanded | Lowering no longer derives opacity from runtime/source names; source extension attaches `sourceRuntimeVisibilityFactKey`; final audit before run-all |
| 8.1 | Frontend focused tests | Focused repaired suites green | Green for current lowering hardening | Latest focused runs: source semantics `11 passing / 0 failing`; source frontend `3 passing / 0 failing`; program creation cases `22 passing / 0 failing` |
| 8.2 | Frontend full tests | Frontend package tests green | Green after metadata change | `418 passing / 0 failing` |
| 8.3 | TSTS package build | Vendored TSTS compiles | Green after metadata change | `npm run build --workspace @tsonic/tsts` |
| 8.4 | C# emitter tests | Plan renderer tests green | Green after record renderer hardening | `1 passing / 0 failing` for `record` dictionary rendering; previous structural/attribute subsets green |
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
| Generic function aliases | C# module rendering used a module-wide alias map from source names | Source extension writes `genericFunctionAliasFactKey`; identifier plans carry `resolvedAliasName`; alias declarations carry `compileTimeOnly` | Focused generic-function tests green |
| Enum initializers | C# enum rendering used `initializer.literalText ?? "0"` | C# enum rendering calls `renderExpression(member.initializer, context)` | C# emitter build green |
| Marker declaration semantics | C# renderer filtered `extends struct` by checking `heritageType.name === "struct"` and had no plan fields for `field<T>` / `thisarg<T>` | TSTS source extension writes marker facts; lowering removes compile-time heritage markers and carries `sourceTypeKind`, `storageSemantics`, and `extensionReceiver` | Lowering marker projection test green; C# renderer struct/field/extension receiver tests green |
| Surface member semantics | Surface manifests carried target/runtime member behavior such as `storageAccess: "arrayLength"`, `emittedMemberName: "Length"`, and borrowed mutation write-back | Surface manifests now carry only package surface data: extension chain, type roots, and package requirements; runtime/member behavior must come from TSTS facts/lowering plans | Product search for `memberSemantics`, `emittedMemberName`, `storageAccess`, `borrowedMutationWriteBack`, `returnsArray`, `returnsReceiver`, and `mutatesReceiver` is clean |
| Runtime visibility | Lowering marked named types opaque by checking runtime/source names such as `_` and U+FFFD | TSTS source extension attaches `sourceRuntimeVisibilityFactKey`; lowering reads only that fact from use nodes, declarations, or resolved symbols | Focused frontend test subset `3 passing / 0 failing`; product search for `runtimeVisibilityForNamedType` and source-runtime name policy in lowering is clean |
| Dictionary type semantics | Lowering and the C# emitter treated `Record<K, V>` by checking named-type text such as `type.name === "Record"` | TSTS source extension attaches `sourceDictionaryTypeFactKey`; lowering emits a dedicated `record` type plan; C# rendering consumes the plan as dictionary storage; missing type arguments do not become `unknown` fallbacks | Focused frontend subset `2 passing / 0 failing` after no-fallback hardening; focused emitter subset `1 passing / 0 failing`; product search for named `Record` checks is clean |
| Source function signature selection | CLI package-manifest code had an unused selector that returned `exact ?? firstSignature` | Dead selector module deleted instead of retaining a fallback binding heuristic | Product search for `selectPreferredSourceFunctionSignature`, `SourceFunctionSignatureSurface`, and `source-function-surfaces` is clean; @tsonic/cli build green |
| Checker-derived unknown fallbacks | Lowering converted missing checker answers into broad `unknown` plans in recursive cycles, array elements, object literal members, and binding access | Lowering now preserves absence as absence; only real source `unknown` remains `intrinsic("unknown")` | @tsonic/frontend lowering plan builders subset `9 passing / 0 failing`; search for `intrinsicTypePlan("unknown")` now reports only source `unknown` |
| NuGet package-folder resolution | Restore planning selected the first `project.assets.json` package folder and projected compile DLL paths from that single folder | Restore planning now enumerates package folders deterministically, carries only compile DLL paths proven to exist, and preserves absence as absence for later diagnostics | @tsonic/cli build green; @tsonic/cli restore/NuGet subset `14 passing / 0 failing`; product search for `pickPackageFolder`, `folders[0]`, and `packageFolders[0]` is clean |
| Public graph entrypoints | Product callers could invoke `buildModuleDependencyGraph()` and old `dependency-graph` paths directly, creating a second program/lowering construction path | `compile()` now creates the TSTS program once and then builds the lowering graph from that program; public dependency-graph facades and lowering pipeline constructor exports are removed; lowering graph creation no longer accepts alternate options or re-resolves capabilities | @tsonic/frontend, @tsonic/cli, and @tsonic/csharp-emitter builds green; product search for `buildModuleDependencyGraph`, `ModuleDependencyGraphResult`, and `dependency-graph` is clean |
| Post-build module ownership | Frontend discovery pre-walked imports and then used that pre-walk as the runtime source list and workspace dependency edge list even after TSTS had built the source program | `program-assembly` now traverses `sourceProgram.moduleGraph` from runtime seeds to select runtime source files, and workspace dependency edges are emitted from resolved TSTS imports | @tsonic/frontend graph/source/program-creation subset `29 passing / 0 failing`; @tsonic/frontend, @tsonic/cli, and @tsonic/csharp-emitter builds green |
| Arbitrary first semantic selection | Lowering used `[0]`/`.find(...)` as fallback selectors for entry modules, runtime source-file checker anchors, base constructor signatures, symbol declarations, runtime type declarations, class/interface owners, and runtime visibility | Entry module mismatch is fatal; runtime checker anchor requires a runtime source file; construct signatures require exactly one candidate; declarations use value declaration or exact-one declaration; runtime visibility must be unique | @tsonic/frontend lowering plan builders subset `10 passing / 0 failing`; @tsonic/frontend, @tsonic/cli, and @tsonic/csharp-emitter builds green; product search for direct first declaration/signature/module fallbacks is clean |
| Char-compatible overload contextual typing | A call such as `Console.WriteLine("WRITE")` could inherit `char` expected type from an overload where `char` is source-modeled over string, causing C# char emission to reject a multi-character string | Lowering now strips char expected type from multi-character string-literal arguments while preserving it for one-character literals such as `Char.IsLetter("A")` | @tsonic/frontend multi-character string regression `1 passing / 0 failing`; @tsonic/cli NativeAOT library regression `1 passing / 0 failing` |
| Public checker anchor | `program.sourceChecker.getTypeAtLocation(node)` used one checker anchored to the first runtime source file | `TsonicProgram` no longer exposes `sourceChecker`; callers use `program.sourceProgram.withTypeChecker(sourceFile, ...)`, so every query is scoped to its owning TSTS source file | @tsonic/frontend build green; program creation focused cases `22 passing / 0 failing`; product search for `sourceChecker` is clean |
| Resolver context | `resolveImport()` accepted absent package/source context and could return an empty core declaration path sentinel | `resolveImport()` now requires project root, authoritative source-package roots, and declaration aliases; missing `@tsonic/core` declaration is a deterministic diagnostic | @tsonic/frontend build green; product search for `opts?`, optional authoritative maps, and empty resolved-path sentinel is clean |
| Local import missing-file diagnostics | `resolveLocalImport()` selected `existingCandidate ?? candidatePaths[0]` to report a missing local import | Missing local imports now report every deterministic candidate path and do not select an arbitrary non-existent candidate | @tsonic/frontend, @tsonic/cli, and @tsonic/csharp-emitter builds green |
| Source diagnostic scope | Source semantics extension treated missing `sourceDiagnosticFileNames` as a behavior switch | Source diagnostic scope is mandatory at TSTS program construction; test harness passes all runtime test source files; support declarations are not classified by omitted options | Source semantics `11 passing / 0 failing`; source frontend `3 passing / 0 failing` |
| Constructor runtime facts | `new Error(value)` attached `Error.constructor` to both the `NewExpression` and its child identifier | Constructor runtime operation is attached to the `NewExpression`; the identifier callee is not double-factored | Source semantics `11 passing / 0 failing` |
| Binding access over unions | Destructured binding type lookup selected the first non-nullish union arm and could erase `int` inside alias-backed union properties to `number` | Binding access now unwraps source alias targets, evaluates all non-nullish union arms, preserves exact shared source-primitive results, and preserves differing arm types as a union; it never picks the first arm | Lowering focused subset `5 passing / 0 failing`; concrete proof: `{ value: int } | { value: string }` lowers to `int32 | string`, not first-arm `int32` or erased `number | string` |
| Runtime heritage selection | Base-constructor parameter lowering read `runtimeHeritageTypeNodes(...)[0]` | Runtime heritage is now accepted only when exactly one runtime heritage remains after compile-time marker erasure; no positional first heritage selection remains | Lowering focused subset `5 passing / 0 failing` |
| Source-front-end transpile path | `createTstsSourceFrontend()` exposed a TS-style `transpileModule()` API alongside Tsonic program analysis | Source frontend now only creates TSTS-backed source programs; product JS transpilation is not a Tsonic frontend path | Product search for `SourceTranspiler`, `SourceTranspile`, and frontend `transpileModule` is clean |
| Source-program switches | `createTstsSourceProgram()` accepted optional extensions, optional semantic checks, optional extension checks, and optional module-resolution paths | Tsonic source-program construction always registers the Tsonic extensions, always runs TSTS semantic and extension checks, and requires explicit module-resolution paths | Product search for optional extension/check toggles is clean except the intentional hardcoded enabled flags |
| Frontend scratch roots | Frontend test utilities wrote Tsonic-specific scratch trees under OS temp directories | Frontend test scratch roots are under repository `.temp/`, matching repo hygiene policy | Product/test search for frontend `os.tmpdir()` is clean; path-only `/tmp` containment test remains a pure string case |
| Renderer missing-data defaults | C# expression rendering defaulted missing identifiers to `value`, missing members to `member`, missing number literals to `0`, missing callbacks to synthetic lambdas, missing arguments to `null`/empty strings, and missing array elements to `default!` | Renderer now reports unsupported source data for missing required AST/fact-backed plan fields; valid source-level defaults such as `join()` comma and `slice()` start `0` remain as JS semantics | C# emitter build green; expression renderer regression `4 passing / 0 failing`; product search for those renderer defaults is clean except JS default-argument semantics and C# definite-assignment split |
| Binding-pattern variable labels | Variable declarations without identifier names fell back to synthetic `value` | Binding-pattern variable plans now carry the actual AST pattern text for diagnostics; no generated variable name is invented for patterns | @tsonic/frontend build green; product search for `nodeName(...) ?? "value"` is clean |
| Undefined type rendering | `renderCSharpType(undefined)` and `renderNullableCSharpType(undefined)` silently emitted `object?` | Type rendering now requires a concrete `LoweringTypeRefPlan`; optional call sites use `renderRequiredCSharpType`/`renderRequiredNullableCSharpType` and report unsupported diagnostics before continuing traversal | @tsonic/csharp-emitter build green; @tsonic/csharp-emitter test package `12 passing / 0 failing`; product search for optional-to-object render calls is clean |
| Generic special type arguments | Special named types such as `Array<T>`, `ReadonlyArray<T>`, `Iterable<T>`, and `Promise<T>` could flow through with missing type arguments | Special named type rendering requires type arguments and reports malformed plans; non-generic `Task`/void-return semantics remain explicit `void` handling | @tsonic/csharp-emitter test package `12 passing / 0 failing` |
| `Object.entries` value typing | `Object.entries(value)` with an unproven record value type became `Array<[string, object]>` | The lowering plan preserves absence as absence; the C# renderer reports the missing `Object.entries` value type instead of receiving a fabricated `object` element type | @tsonic/frontend build green; product search for `valueType ?? intrinsicTypePlan("object")` is clean |
| Parameter and enum member names | Missing parameter names lowered as `arg`, missing enum member names lowered as `Member`, and renderer sanitization could silently turn missing names into `_` | Parameter and enum member plans carry source kind/text; renderers report missing names before emitting a placeholder solely to continue traversal | @tsonic/frontend and @tsonic/csharp-emitter builds green; product search for invented `arg`/`Member` names is clean |
| Audit result | Legacy string/parser patterns existed in lowering/emitter | Targeted audit reports only diagnostic source snippets, diagnostic `sourceFile.Text()`, and AST token reads for names/literals | Audit command: `rg 'Node_Text\\(|\\.Text\\(|sourceText\\.(includes|startsWith|endsWith|match|split|slice|substring|replace)|literalText\\.(includes|startsWith|endsWith|match|split|slice|substring|replace)|nameSourceText\\.(includes|startsWith|endsWith|match|split|slice|substring|replace)|expressionRootName|buildGenericFunctionAliasMap|expressionAliases|LoweringExpressionAliasPlan|typeText|returnTypeText|declaredTypeText|contextualTypeText|operatorText' packages/frontend/src packages/targets/csharp/emitter/src -g '*.ts'` |

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

## Prior Lowering/Renderer Failure Themes

These were the blockers from the first full `run-all` attempt after frontend validation passed. The current sweep fixed the source-primitive/contextual-rendering subset and still requires full emitted fixture proof.

| Theme | User-code example | Previous bad C# shape | Current status |
| --- | --- | --- | --- |
| Explicit primitive aliases erased inside generic type nodes | `function createIntBox(value: int): Box<int> { return { value }; }` | `Box<number>` and `number` appears as a C# type | Lowering now preserves source primitive facts on declarations, identifiers, call returns, contextual literals, and alias targets; full fixture proof pending |
| Interface type members dropped | `interface Box<T> { value: T }` | `public interface Box<T> { }`, then `box.value` fails | Interface member lowering exists; full fixture proof pending |
| Intrinsics emitted as ordinary calls | `const x = defaultof<int>();` | `defaultof<int>()` remains in generated C# | Intrinsic fact rendering exists; full fixture proof pending |
| Destructuring names not declared | `const [first, second] = values;` | later generated code references `first`/`second` without declarations | Binding-pattern lowering exists; full fixture proof pending |
| Contextual callback params degrade to `object` | `values.map(x => x + 1)` under a typed delegate context | lambda parameter emits as `object x`, causing delegate conversion errors | TSTS contextual callable alias expansion covered by focused lowering tests; full fixture proof pending |
| Unsupported source expression nodes leak to renderer | `void f();`, `function* g(){ yield 1; }` | `KindVoidExpression` / `KindYieldExpression` unsupported in expression context | `void` and `yield` paths exist; final run-all must prove required fixture coverage |
| External source-package names lose qualified target identity | `new DefaultHttpContext()` from an external source package | bare `DefaultHttpContext` missing namespace/import in generated C# | Pending full source-package/downstream proof |

Concrete examples now covered by focused tests:

```ts
import type { char, int } from "@tsonic/core/types.js";

type Op = (value: int) => int;

export const ops: Op[] = [(value) => value];

export function read(letter: char): char[] {
  const same = letter === "A";
  return ["x", letter];
}
```

The lowering tree now carries `int32` into the contextual arrow parameter/return and carries `char` into both `"A"` and `"x"` string literals before the C# renderer runs.

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
