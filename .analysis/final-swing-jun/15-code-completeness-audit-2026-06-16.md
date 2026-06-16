# Code Completeness Audit — 2026-06-16

This audit records the code-completeness signoff before starting final expensive gates.

## Architecture Contract

| Requirement | Current code state | Evidence |
| --- | --- | --- |
| TSTS/TS-Go AST is the source IR | `TstsSourceProgram` exposes TSTS source files, TSTS module graph, read-only source facts, and diagnostics | `packages/frontend/src/source-frontend/tsts-source-program.ts` |
| Tsonic frontend does not expose raw checker access | `withTypeChecker(...)`, `sourceChecker`, raw compiler program, and raw extension host are not public product APIs | `rg` sweeps for `withTypeChecker`, `sourceChecker`, `readonly extensionHost`, and direct checker APIs are clean outside `tsonic-extension/source-semantics.ts` |
| Tsonic extension owns semantic facts | Tsonic semantic answers are attached as typed TSTS extension facts; lowering consumes facts only | `packages/frontend/src/source-frontend/source-facts.ts`, `packages/frontend/src/tsonic-extension/source-semantics.ts`, `packages/frontend/src/lowering/input.ts` |
| Lowering is AST/fact-backed, not a second analyzer | Lowering reads `SourceSemanticFacts` and `ExtensionModuleGraph`; it has no checker calls or raw TypeScript compiler APIs | `packages/frontend/src/lowering/types.ts`, source-boundary focused test |
| Import/module ownership comes from TSTS | Obsolete pre-TSTS import/source-package resolver files are deleted; module tests read TSTS `moduleGraph` | `packages/frontend/src/resolver/import-resolution.ts` deleted, `packages/frontend/src/program/creation-cases/module-bindings.test.ts` |
| No frontend target leakage | Frontend source has no C#/CLR/dotnet/`System.*` target facts or `targetSurface`/`targetName` parsing | target-leakage sweep over `packages/frontend/src` is clean |
| Source facts cannot be mutated through the frontend public boundary | Public facts are typed as `SourceSemanticFacts`, a read-only `get`/`has`/`snapshotFor` view | `packages/frontend/src/source-frontend/source-facts.ts` |

## Concrete Flow Examples

### Flow Narrowing

User source:

```ts
export function read(value: string | number) {
  const before = value;
  if (typeof value === "string") {
    const text = value;
    return text;
  }
  const number = value;
  return number;
}
```

Current flow:

| Step | Owner | Result |
| --- | --- | --- |
| Parse/bind/check | TSTS | AST nodes and flow-aware checker answers |
| Project facts | Tsonic TSTS extension | `sourceExpressionTypeProjectionFactKey` on `value` use-sites |
| Lower | Tsonic frontend lowering | Reads facts: `string | number`, `string`, `number` |
| Emit | C# backend | Emits from lowering plans; it does not recompute narrowing |

### Module Import Identity

User source:

```ts
import { readFileSync } from "node:fs";

export const text = readFileSync("file.txt", "utf8");
```

Current flow:

| Step | Owner | Result |
| --- | --- | --- |
| Resolve module | TSTS module graph | `getResolvedModule(sourceFile, "node:fs")` points to the source-package module |
| Resolve binding | TSTS module graph | `getImportBinding(sourceFile, "readFileSync")` identifies the named import |
| Lower | Tsonic frontend lowering | Uses module graph; no separate resolver path remains |

### Source Primitive Fact

User source:

```ts
import type { int } from "@tsonic/core/types.js";

export function add(left: int, right: int): int {
  return left + right;
}
```

Current flow:

| Step | Owner | Result |
| --- | --- | --- |
| Recognize primitive | Tsonic TSTS extension | `numericPrimitiveFactKey` marks canonical `int` references as `int32` source primitives |
| Lower type refs/use-sites | Tsonic frontend lowering | Converts source primitive facts to `LoweringTypeRefPlan { kind: "source-primitive" }` |
| Render target type | C# backend | Maps `int32` to target C# `int`; frontend carries no C#/CLR type name |

## Audit Commands Run Before Signoff

```sh
rg -n "typescript|from ['\"]ts|ts\\.Program|ts\\.TypeChecker|createProgram\\(|transpileModule|CompilerHost|LanguageService|tsserver|TypeScriptSource|TypeScriptSemantic|ts\\.Type|ts\\.Symbol" packages -g '*.ts' -g '!packages/tsts/**' -g '!**/*.test.ts' -g '!**/dist/**'
rg -n "CSharp|csharp|CLR|Clr|clr|dotnet|System\\.|sourceRuntimeName|runtimeNamed|targetQualifiedName|targetSurface|targetName|resolvedClr|resolvedCLR|emittedClr|emittedCLR|native-array|readonly storage\\?:" packages/frontend/src -g '*.ts'
rg -n "sourceProgram\\.facts\\.(set|delete)|readonly facts: ExtensionFacts|sourceProgram\\.extensionHost|readonly extensionHost|withTypeChecker|getTypeAtLocation|getNarrowedTypeAtLocation|getContextualType|getResolvedSignature|getSignatureFromDeclaration|getTypeFromTypeNode|getCallSignatures|getConstructSignatures|getProperties|getTypeOfSymbolAtLocation|isTypeAssignableTo|isTypeIdenticalTo" packages/frontend/src packages/cli/src packages/targets/csharp/emitter/src -g '*.ts' -g '!packages/frontend/src/tsonic-extension/source-semantics.ts' -g '!**/*.test.ts'
rg -n "\\bIr[A-Z]|NormalizedIrModule|SoundnessValidatedIrModule|EmittableIrModule|SourceIr|source-ir|identifier-storage|selectUnionArm|SemanticType|StorageCarrier|TypeCarrier|resolvedClr|targetQualifiedName|resolvedCLR" packages/frontend/src packages/cli/src packages/targets/csharp/emitter/src -g '*.ts'
rg -n "import-resolution|source-package-resolution|path-resolution|ResolvedModule|resolveImport|resolveSourcePackage|findInstalledPackageRoot|getLocalResolutionBoundary|resolveInstalledPackageImport" packages/frontend/src packages/cli/src packages/targets/csharp/emitter/src -g '*.ts'
```

## Focused Validation Before Signoff

| Command | Result |
| --- | --- |
| `npm test -- --grep "source semantic boundary\\|TSTS source program\\|authoritative type roots\\|Tsonic TSTS source semantics extension\\|TSTS-backed lowering plan builders"` from `packages/frontend` | `66 passing / 0 failing` |
| `npm test -- --grep "source semantic boundary\\|namespace"` from `packages/frontend` | `29 passing / 0 failing` |
| `git diff --check` | clean |

## Remaining Work

| Gate | Status |
| --- | --- |
| Full Tsonic run-all | Not started after code-completeness signoff |
| Downstreams | Not started after code-completeness signoff |
| Branch hygiene | Not started after code-completeness signoff |
| Final PR report | Not started after final gates |

This audit signs off the code sweep phase. The next phase is full verification, then downstream verification, then branch hygiene and final report.
