# Exhaustive Ownership Contract

This contract is stricter than the high-level architecture. Every frontend capability must have exactly one final owner. If an API is missing from the owner, add the API there. Do not rebuild it in Tsonic as a local workaround.

## Owner Table

| Domain | Final Owner | Tsonic Allowed | Tsonic Forbidden |
| --- | --- | --- | --- |
| Source text loading | Tsonic CLI/workspace | Discover project roots and root files | Parse source syntax itself |
| TypeScript parsing | TSTS core | Pass source files/options to TSTS | Use `typescript` parser or `ts.SourceFile` in product frontend |
| AST shape | TSTS core | Read public TSTS syntax facade for lowering traversal | Attach ad-hoc fields to nodes |
| Module resolution | TSTS core with Tsonic host metadata | Provide package roots/source-package metadata to host | Rebuild resolved module graph with `ts.resolveModuleName` in product frontend |
| Imports | TSTS module/import identity API | Ask for import bindings and resolved package identities | Walk import declarations to infer semantic imports |
| Exports/reexports | TSTS module graph/checker | Ask for exported symbols and export edges | Maintain a parallel export graph |
| Symbol identity | TSTS checker | Store plan IDs keyed by TSTS symbols | Create source symbol IDs from target-rendered names |
| Binding | TSTS binder/checker | Ask for symbol at node, declarations, aliased symbol | Reimplement lexical/module binding |
| Type inference | TSTS checker | Ask for type at node/type node/symbol | Maintain a parallel source type inference engine |
| Contextual typing | TSTS checker | Ask for contextual type | Infer callback/object literal contextual types locally |
| Generic inference | TSTS checker | Ask resolved signature/type arguments | Score generic candidates locally |
| Overload resolution | TSTS checker | Ask resolved signature | Keep overload candidate ranking in frontend |
| Call signatures | TSTS checker | Read signature facade | Derive callable shape from syntax alone |
| Member lookup | TSTS checker | Ask property/signature/index types | Rebuild property lookup tables for source semantics |
| Flow narrowing | TSTS checker | Ask use-site type | Eager branch narrowing engine |
| Type predicates/assertions | TSTS checker | Read predicate from resolved signature | Special-case assertion functions in Tsonic |
| Numeric primitives | Tsonic source extension | Attach `NumericPrimitiveFact` to TSTS nodes/types | Store CLR names or C# keyword facts |
| `field<T>`/storage intent | Tsonic source extension | Attach source storage facts | Emit target storage directly from frontend |
| `out`/`ref`/`inref` | Tsonic source extension | Validate assignable storage and attach passing facts | Mention C# `out`/`ref` as source facts |
| Attributes | Tsonic source extension | Attach source attribute slots | Resolve CLR attribute constructors in frontend |
| Source package bindings | Tsonic source extension + metadata reader | Attach external binding facts from canonical manifest | Legacy manifest translation or target-name strings |
| Capability checks | Tsonic source frontend/lowering | Check source-feature support against manifest | Check target mechanisms like `IAsyncEnumerable` |
| Lowering plans | Tsonic frontend/lowering | Create backend-neutral plans over TSTS nodes/facts | Copy complete source AST into permanent IR |
| Backend rendering | Target backend | Render plans to C#/future targets | Import TSTS directly in backend |

## Critical Rule: Syntax Traversal Is Not Semantic Analysis

Tsonic may traverse TSTS syntax to find Tsonic markers or to emit statement order, but it may not infer TypeScript facts from that traversal.

Allowed:

```ts
// Find calls to the source marker `out(...)`.
if (node.kind === KindCallExpression && importIndex.isImported(node.expression, "@tsonic/core/lang.js", "out")) {
  facts.setNodeFact(node, PassingModeFact, { mode: "byref-writeonly-must-init" });
}
```

Forbidden:

```ts
// Rebuild normal TypeScript call resolution.
const candidate = scoreOverloadsByArgumentTypes(callExpression);
```

If Tsonic needs to know which overload was selected, it calls TSTS:

```ts
const signature = checker.getResolvedSignature(callExpression);
```

## Imports and Exports

Example:

```ts
import { Foo as Bar } from "./foo.js";
export { Bar };
```

Required final API use:

```ts
const importBinding = moduleGraph.getImportBinding(sourceFile, "Bar");
const exportBinding = moduleGraph.getExport(sourceFile, "Bar");
```

Expected semantic answer:

```text
Bar local binding -> resolved module ./foo.js -> exported symbol Foo
export Bar -> same local symbol
```

Tsonic product code must not do this:

```ts
for (const statement of sourceFile.statements) {
  if (ts.isImportDeclaration(statement)) { ... }
  if (ts.isExportDeclaration(statement)) { ... }
}
```

For TSTS nodes, Tsonic should also avoid rebuilding the same logic with `KindImportDeclaration` and `KindExportDeclaration`. That code belongs in TSTS public module graph/import APIs.

## Flow and Narrowing

Example:

```ts
function render(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  return value.toString();
}
```

Required final flow:

```text
checker.getTypeAtLocation(value at parameter) -> string | number
checker.getTypeAtLocation(value in then branch) -> string
checker.getTypeAtLocation(value after branch) -> number
```

Tsonic may create a member plan:

```text
MemberAccessPlan(node: value.toUpperCase, receiverType: string)
```

Tsonic may not create a source-analysis fact:

```text
RuntimeUnionArm(value, arm: AsString)
```

Runtime carrier/arm details are lowering/backend representation, not TypeScript source analysis.

## Generic and Overload Resolution

Example:

```ts
function first<T>(items: readonly T[]): T {
  return items[0]!;
}

const value = first(["a", "b"]);
```

Required final owner:

```text
TSTS checker resolves T = string.
TSTS checker gives value type string.
Tsonic lowering creates a call plan from the resolved signature.
```

Forbidden final code:

```ts
inferTypeArgumentFromArrayLiteral(callExpression);
scoreCandidate(candidate, argumentTypes);
```

If the TSTS checker facade cannot expose the resolved signature or inferred type arguments, that facade must be expanded in TSTS.

## Source Package Bindings

Example:

```ts
import { Router } from "@tsonic/express";

export function configure(router: Router): void {
  router.get("/health", () => "ok");
}
```

Required final owner split:

```text
TSTS module graph: import Router from @tsonic/express.
TSTS checker: Router symbol/type and selected signature for router.get.
Tsonic extension: Router carries ExternalTypeBindingFact from canonical source-package metadata.
C# backend: maps ExternalTypeBindingFact to target surface rendering.
```

Forbidden final source fact:

```ts
{
  providerQualifiedName: "global::Express.Router",
  clrTypeName: "Express.Router"
}
```

## Capability Validation

Capabilities are source-feature terms. They are allowed in the Tsonic source frontend because diagnostics belong at user source locations.

Allowed:

```text
feature: "async-iteration"
feature: "byref-writeonly-must-init"
feature: "numeric-int64"
```

Forbidden:

```text
feature: "IAsyncEnumerable"
feature: "System.Int64"
feature: "CSharpOutParameter"
```

Example:

```ts
for await (const item of stream) {
  consume(item);
}
```

Correct diagnostic:

```text
source feature "async-iteration" is not supported by target "csharp".
```

Incorrect diagnostic:

```text
cannot emit IAsyncEnumerable.
```

## What Remains in Tsonic Frontend

The final frontend is not empty. It owns Tsonic product semantics:

```text
tsonic.json/workspace/package discovery
surface package metadata and source-package roots
Tsonic extension registration
source-feature capability diagnostics
source package binding facts
numeric/storage/passing/attribute facts
backend-neutral lowering plans
emitter contract validation
diagnostic adaptation
```

It does not own TypeScript compiler semantics:

```text
parse
bind
check
module graph
import/export semantic graph
flow narrowing
overload resolution
generic inference
contextual typing
member lookup
```

## Rule for Missing APIs

When implementation needs information, ask this question:

```text
Is this TypeScript/compiler information, or Tsonic source-language information?
```

If TypeScript/compiler information:

```text
Add or expose a TSTS API.
Do not implement it in Tsonic.
```

If Tsonic source-language information:

```text
Add a typed extension fact or backend-neutral lowering plan.
Do not store target mechanism names.
```

Example:

```ts
value.length
```

Questions and owners:

```text
What is `value` here? -> TSTS checker.
Does `length` exist? -> TSTS checker.
Is this source member allowed by Tsonic policy? -> Tsonic source validation.
How does C# render it? -> C# backend.
```
