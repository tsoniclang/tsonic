# Deletion and Enforcement Ledger

This ledger converts the architecture into concrete deletion gates. A domain is not migrated while both old and new product paths remain active.

## Directory Disposition

| Current Path | Current Role | Final Action |
| --- | --- | --- |
| `packages/frontend/src/source-frontend/typescript-semantic-view.ts` | TSC-backed semantic view | Delete from product code |
| `packages/frontend/src/source-frontend/frontend-source-semantic-view.ts` | TSC node/type aliases | Delete from product code |
| `packages/frontend/src/source-frontend/semantic-view.ts` | Generic semantic bridge | Collapse to TSTS-only or move generic pieces into TSTS extension facade |
| `packages/frontend/src/graph/extraction/*` | Import/export AST extraction | Delete; consume TSTS module graph |
| `packages/frontend/src/graph/builder.ts` | Parallel module graph builder | Replace with TSTS module graph adapter |
| `packages/frontend/src/symbol-table/*` | Parallel source symbol table | Delete or shrink to backend-neutral plan lookup keyed by TSTS symbols |
| `packages/frontend/src/symbols/symbol-ids.ts` | Source symbol IDs | Replace target-rendered/source-mixed IDs with TSTS symbol identity + plan IDs |
| `packages/frontend/src/ir/type-system/*` | Parallel checker/inference | Delete as source-analysis owner; keep only backend-neutral type-plan helpers if needed |
| `packages/frontend/src/ir/binding/*` | Binding/call resolution | Delete as TypeScript semantic owner; source-package binding facts move to extension |
| `packages/frontend/src/ir/converters/narrowing-*` | Eager flow narrowing | Delete; use TSTS checker use-site types |
| `packages/frontend/src/ir/converters/union-arm-selection.ts` | Runtime union arm source selection | Move to backend/runtime lowering if still needed |
| `packages/frontend/src/ir/builder/*` | Parallel IR builder | Replace with AST/fact-backed lowering plan builders |
| `packages/frontend/src/validation/*` | Mixed TS/source/backend validation | Split: TSTS diagnostics, Tsonic extension diagnostics, capability validation, backend validation |
| `packages/frontend/src/ir/validation/*soundness*` | Mixed hygiene/capability gate | Keep only backend-neutral emitter-contract validation |
| `packages/frontend/src/program/program-assembly.ts` | TSC host + Tsonic assembly | Remove TSC host; assemble TSTS program + Tsonic extension + metadata |
| `packages/frontend/src/program/queries.ts` | Mixed TSTS/ts.SourceFile queries | TSTS-only product queries |
| `packages/frontend/src/resolver/*` | Source-package and TS module resolver | Keep source-package metadata/host services; TSTS owns module graph |
| `packages/frontend/src/program/external-binding-payload.ts` | Manifest normalization | One schema only; no legacy/v1/v2 bridge |

## Search Gates

These searches are final release gates. They must be clean in product frontend code.

```sh
rg '"typescript"' packages/frontend/src packages/cli/src
rg '\bts\.' packages/frontend/src packages/cli/src
rg 'ts\.Program|ts\.TypeChecker|ts\.SourceFile|ts\.Node|ts\.Type|ts\.Symbol|ts\.Signature' packages/frontend/src packages/cli/src
rg 'TypeScriptSemanticView|FrontendSourceSemanticView|SourceSemanticEngine = "typescript"|engine: "typescript"' packages/frontend/src
rg 'ImportDeclaration|ExportDeclaration|KindImportDeclaration|KindExportDeclaration' packages/frontend/src/graph packages/frontend/src/symbol-table packages/frontend/src/ir packages/frontend/src/validation
rg 'resolvedClrType|emittedClrName|emittedCLRName|providerQualifiedName|targetQualifiedName' packages/frontend/src
rg -i 'clr|csharp|dotnet|System\.' packages/frontend/src
rg 'legacy|compat|v1|v2|as unknown as|undefined!' packages/frontend/src
```

Allowed matches must be outside product frontend code or be explicitly listed in the final handoff report. Test fixtures may contain strings that assert banned terms are rejected, but not active product paths.

## No Dual Path Rule

Forbidden:

```ts
if (options.sourceFrontend === "tsts") {
  return createTstsProgram(...);
}
return createTypeScriptProgram(...);
```

Required final product shape:

```ts
return createTstsProgram(...);
```

Temporary comparison code is allowed only in migration tests and must be deleted before final completion.

## No Local TSTS Internals Rule

Forbidden in Tsonic product code:

```ts
import { AsImportDeclaration } from "@tsonic/tsts/internal/ast/generated/casts.js";
```

Allowed:

```ts
import { createProgram, type ExtensionTypeChecker } from "@tsonic/tsts";
```

If a needed syntax helper exists only under TSTS internals, promote it to the TSTS public syntax facade first.

## No Rebuilt Module Graph Rule

Forbidden final implementation:

```ts
const imports = extractImports(sourceFile);
const exports = extractExports(sourceFile);
```

Required final implementation:

```ts
const module = sourceProgram.moduleGraph.getSourceFileModule(sourceFile);
const imports = sourceProgram.moduleGraph.getImports(sourceFile);
const exports = sourceProgram.moduleGraph.getExports(sourceFile);
```

## No Rebuilt Checker Rule

Forbidden final implementation:

```ts
const inferred = inferExpressionType(expression, localTypeEnvironment);
const selected = resolveCallCandidate(call, inferredArguments);
```

Required final implementation:

```ts
const receiverType = checker.getTypeAtLocation(expression);
const selected = checker.getResolvedSignature(call);
```

## No Eager Source Narrowing Rule

Forbidden final implementation:

```ts
const branchPlan = collectBranchNarrowings(ifStatement);
```

Required final implementation:

```ts
const useSiteType = checker.getNarrowedTypeAtLocation(identifierInBranch);
```

## No Backend Leakage Rule

Forbidden source fact:

```ts
facts.setNodeFact(typeNode, SomeFact, {
  clrTypeName: "System.Int32",
  csharpKeyword: "int",
});
```

Required source fact:

```ts
facts.setNodeFact(typeNode, NumericPrimitiveFact, {
  kind: "int32",
  sourceName: "int",
  runtimeBase: "number",
  signed: true,
  width: 32,
});
```

## Tests Required Per Migrated Domain

Every migrated domain needs all applicable tests:

```text
unit tests for the public TSTS API used
source fixture tests for Tsonic extension facts
lowering plan tests with real source snippets
negative diagnostics tests
emitted-output tests if backend behavior changes
search-gate tests for deleted old paths where practical
```

Example fixture for import identity:

```ts
import type { int as i32 } from "@tsonic/core/types.js";

export const value: i32 = 1;
```

Expected proof:

```text
TSTS module graph resolves @tsonic/core/types.js.
Tsonic extension recognizes local i32 as source primitive int.
No graph/extraction import walker participates.
```

Example fixture for narrowing:

```ts
export function size(value: string | number): int {
  if (typeof value === "string") {
    return value.length as int;
  }
  return 0;
}
```

Expected proof:

```text
checker facade reports string at the branch use site.
lowering plan uses that type.
no frontend narrowing collector runs.
```
