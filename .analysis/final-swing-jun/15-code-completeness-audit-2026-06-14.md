# Code Completeness Audit — 2026-06-14

This audit records the pre-expensive-gate state after the focused frontend repair milestone.

## Status

```text
branch: feature/tsts-final-completion
latest pushed commit at audit start: e7c6398a fix tsts source diagnostic ownership
focused repaired suite: 136 passing / 0 failing
full run-all: not started in this checkpoint
downstreams: not started in this checkpoint
```

## Architecture Sign-Off Before Full Gates

| Area | Result | Evidence | Remaining proof |
| --- | --- | --- | --- |
| Product TypeScript compiler API removal | Passed product search | `rg "from ['\"]typescript['\"]|require\\(['\"]typescript['\"]\\)|\\bts\\." packages/frontend/src packages/cli/src packages/targets/csharp` has only boundary-test banned-string assertions | Full run-all |
| Permanent dual frontend removal | Passed product search | `SourceFrontendEngine` is `"tsts"` only; no `createTypeScriptSemanticView` product path | Full boundary test |
| Old source IR directories | Passed file inventory | `packages/frontend/src/ir`, `graph`, `validation`, `symbol-table` contain no product files | Full package build/tests |
| Backend leakage into frontend | Passed product search | `resolvedClrType`, `emittedClrName`, `providerQualifiedName`, `targetQualifiedName`, `clr`, `csharp`, `dotnet`, `System.` have no non-test frontend product matches | Full search report in final handoff |
| Backend imports TSTS | Passed product search | `packages/targets/csharp` has no `@tsonic/tsts` import | Dependency-boundary gate |
| TSTS imports Tsonic frontend/backend | Passed product search | `packages/tsts/src` has no Tsonic frontend/backend/source-extension imports | Dependency-boundary gate |
| Direct node mutation | Passed product search | no `__tsonic` or `__extensions` product matches | Full search report |
| String-keyed fact lookup | Passed product search | only capability manifest map lookups and generated helper-file names matched; extension facts use typed keys | Full search report |
| Old overload/generic inference owner | Passed product search | no `scoreOverloads`, generic-inference engine, or overload-ranking product path remains | Full tests |
| Old eager narrowing owner | Passed product search | no old branch narrowing engine remains; lowering has `LoweringNarrowingPlan` based on TSTS use-site facts | Full tests |
| Source diagnostics ownership | Fixed | current-project diagnostic file set is passed to the Tsonic source extension; dependency source packages are semantic support, not revalidated as consumer source | Source-package/downstream gates |
| Contextual array/arrow typing in tests | Fixed | canonical test std now declares `Array<T>` and `ReadonlyArray<T>`, allowing TSTS checker contextual answers | Frontend full tests |

## Focused Repair Proof

Command:

```bash
npx mocha --require test/mocha/checkpoint.cjs --timeout 10000 \
  packages/frontend/dist/validator-cases/any-and-object-literals.test.js \
  packages/frontend/dist/validator-maximus-cases/feature-gating.test.js \
  packages/frontend/dist/validator-maximus-cases/generic-function-values.test.js \
  packages/frontend/dist/validator-maximus-cases/array-and-literal-inference.test.js \
  packages/frontend/dist/program/creation-cases/package-resolution.test.js \
  packages/frontend/dist/program/creation-cases/authoritative-type-roots.test.js \
  packages/frontend/dist/program/entrypoint-scope.test.js
```

Result:

```text
136 passing / 0 failing
```

## Source-Level Examples Verified

### Generic callable context

User source:

```ts
const id = <T>(x: T): T => x;
type Box = { run: (x: number) => number };
const box: Box = { run: id };
const handlers: Array<(x: number) => number> = [id];
```

Required compiler decision:

```text
TSTS checker provides monomorphic callable contextual types for `run: id` and `[id]`.
Tsonic source diagnostics allow the generic value because it flows into a proven monomorphic callable context.
```

Rejected unsafe source:

```ts
const id = <T>(x: T): T => x;
const obj = { id };
void obj;
```

Required compiler decision:

```text
No monomorphic callable target exists.
Tsonic emits TSN7432.
```

### Contextual arrow in array literal

User source:

```ts
type Op = (a: number, b: number) => number;
const ops: Op[] = [(a, b) => a + b];
```

Required compiler decision:

```text
The canonical test std declares `Array<T>`.
TSTS contextual typing proves the arrow parameter types.
Tsonic does not emit TSN7430 or TSN7405.
```

### Dependency source package diagnostics

User source:

```ts
import { join } from "@tsonic/nodejs/path.js";

export const value = join("a", "b");
```

Required compiler decision:

```text
The app source file is validated as current-project source.
The authoritative `@tsonic/nodejs` source package files are included for module graph, symbols, and types.
Their own source-native diagnostics are not reported during this consumer compile.
Those package files are validated when the source package is compiled as its own project.
```

## Search Commands Run

```bash
rg -n "from ['\"]typescript['\"]|require\\(['\"]typescript['\"]\\)|\\bts\\." packages/frontend/src packages/cli/src packages/targets/csharp --glob '!**/dist/**' --glob '!**/node_modules/**'
rg -n "TypeScriptSemanticView|FrontendSourceSemanticView|typescript-semantic-view|SourceSemanticEngine = \"typescript\"|engine: \"typescript\"|createTypeScriptSemanticView" packages/frontend/src packages/cli/src --glob '!**/dist/**'
rg -n "resolvedClrType|emittedClrName|emittedCLRName|providerQualifiedName|targetQualifiedName|clr|csharp|dotnet|System\\." packages/frontend/src --glob '!**/*.test.ts' --glob '!**/*-cases/**' --glob '!**/dist/**' --glob '!**/node_modules/**'
rg -n "legacy|compat|v1|v2|as unknown as|undefined!|fallback|dual path|dual-path" packages/frontend/src packages/cli/src --glob '!**/*.test.ts' --glob '!**/*-cases/**' --glob '!**/dist/**' --glob '!**/node_modules/**'
rg -n "@tsonic/tsts|packages/tsts|from ['\"].*tsts" packages/targets/csharp --glob '!**/dist/**' --glob '!**/node_modules/**'
rg -n "tsonic-extension|source-frontend|targets/csharp|@tsonic/frontend" packages/tsts/src --glob '!**/dist/**' --glob '!**/node_modules/**'
rg -n "__tsonic|__extensions|set\\(['\"][A-Za-z0-9_.:-]+['\"]|get\\(['\"][A-Za-z0-9_.:-]+['\"]" packages/frontend/src packages/tsts/src/extensions --glob '!**/*.test.ts' --glob '!**/dist/**' --glob '!**/node_modules/**'
rg -n "score.*overload|overload.*score|infer.*type.*argument|generic.*infer|branch.*narrow|typeof.*narrow|truthy.*narrow|runtime.*union|union.*arm|select.*union" packages/frontend/src --glob '!**/*.test.ts' --glob '!**/*-cases/**' --glob '!**/dist/**' --glob '!**/node_modules/**'
```

## Allowed Search Noise

| Search | Allowed matches |
| --- | --- |
| `ts.` | banned-string assertions in `source-semantic-boundary.test.ts` |
| `TypeScriptSemanticView` | banned-string assertions in `source-semantic-boundary.test.ts` |
| backend terms | tests and fixtures that model source-package imports, not product frontend data |
| `legacy/v1/v2/fallback` | CLI schema/test strings and unrelated package-resolution terminology, not product frontend compatibility bridges |
| string-keyed `get(...)` | capability manifest map lookups and helper-file name strings, not extension fact lookup |

## Remaining Gates

| Gate | Status |
| --- | --- |
| `npm test --workspace @tsonic/frontend` | pending |
| C# emitter/unit tests | pending |
| `./test/scripts/run-all.sh` | pending |
| downstream proof pudding | pending |
| downstream tsumo | pending |
| downstream clickmeter | pending |
| branch hygiene | pending |
| final handoff report | pending |
