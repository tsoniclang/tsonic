# Current Frontend Inventory

This inventory records what exists today and what each area becomes after TSTS is the compiler substrate. It is based on direct inspection of `packages/frontend/src` and the current TSTS extension surface.

## Inspection Snapshot

Commands used:

```sh
find packages/frontend/src -name '*.ts' | wc -l
rg -l 'from "typescript"|import \* as ts from "typescript"|\bts\.' packages/frontend/src -g '*.ts' | wc -l
find packages/frontend/src/ir/type-system -name '*.ts' | wc -l
find packages/frontend/src/validation packages/frontend/src/ir/validation -name '*.ts' | wc -l
```

Observed counts:

```text
frontend TypeScript files: 610
files using TypeScript compiler API today: 186
ir/type-system files: 120
validation files: 130
graph/symbol files: 21
program/resolver files: 76
source-frontend files: 16
```

These numbers prove the migration is not a small adapter swap. It is a source-analysis ownership transfer.

## Current Product Seams

### Program Assembly

Current examples:

```text
packages/frontend/src/program/types.ts
packages/frontend/src/program/program-assembly.ts
packages/frontend/src/program/queries.ts
```

Current responsibilities:

```text
stores ts.CompilerOptions
creates a TypeScript compiler host
overrides module resolution
keeps declarationSourceFiles as ts.SourceFile[]
keeps Binding and BindingRegistry tied to old IR/type-system paths
mixes TSTS source files with ts.SourceFile declaration files
```

Final disposition:

```text
keep tsonic.json/workspace/source-package input discovery
keep surface package discovery as Tsonic product behavior
move TypeScript source program construction to TSTS createProgram
delete permanent ts.CompilerHost/ts.Program/ts.SourceFile state from TsonicProgram
model declarations as TSTS source files or TSTS external declaration views
```

Concrete example:

```ts
import { Handler } from "@app/contracts";
```

Final flow:

```text
Tsonic resolves package roots and source-package metadata.
TSTS resolves the module and exposes the resolved module graph.
Tsonic reads source-package binding facts from the extension/fact layer.
```

Tsonic must not create a separate `ts.CompilerHost` to recover this import.

### Graph Extraction

Current examples:

```text
packages/frontend/src/graph/extraction/imports.ts
packages/frontend/src/graph/extraction/exports.ts
packages/frontend/src/graph/builder.ts
```

Current responsibilities:

```text
walk import declarations
walk export declarations
decide executable top-level code
build a module graph separate from the compiler graph
```

Final disposition:

```text
delete product import/export walkers
consume TSTS module graph/export table
keep only a thin SourceModule adapter if the rest of Tsonic needs a package-local shape
```

Concrete example:

```ts
import { Foo as Bar } from "./foo.js";
export { Bar };
```

Final owner:

```text
TSTS module graph says:
  local Bar -> imported Foo from ./foo.js
  export Bar -> same symbol
```

Tsonic must not rebuild that relationship by scanning `ImportDeclaration` and `ExportDeclaration`.

### Symbol Table and Symbol IDs

Current examples:

```text
packages/frontend/src/symbol-table/builder.ts
packages/frontend/src/symbols/symbol-registry.ts
packages/frontend/src/symbols/symbol-ids.ts
```

Current responsibilities:

```text
walk source files
create Tsonic symbol IDs
attach module/declaration/export meaning
track target-surface artifacts
```

Final disposition:

```text
TSTS owns source symbol identity and declaration/export binding
Tsonic may keep target-neutral plan IDs only for emitted artifacts
target-rendered names stay in the backend target surface, never in source symbols
```

Concrete example:

```ts
export class User {}
```

Final source identity:

```text
TSTS symbol: User declared by ClassDeclaration("User")
Tsonic plan id: declaration plan for that TSTS symbol
C# emitted name: backend-only decision
```

The source frontend must not encode a C# name into the symbol ID.

### IR Builder and Parallel Tree

Current examples:

```text
packages/frontend/src/ir/builder/orchestrator.ts
packages/frontend/src/ir/types/module.ts
packages/frontend/src/ir/types/statements.ts
packages/frontend/src/ir/types/expressions.ts
```

Current responsibilities:

```text
copies TypeScript source into IrModule/IrStatement/IrExpression
stores type and control-flow facts on IR nodes
normalizes source syntax into an emitter-facing tree
```

Final disposition:

```text
delete permanent parallel source tree for TypeScript syntax
replace with lowering plans keyed by TSTS nodes, symbols, types, and extension facts
keep only backend-neutral plan structures needed by emitters
```

Concrete example:

```ts
const total: int = left + right;
```

Final shape:

```text
TSTS AST: VariableDeclaration(total)
Tsonic facts: TypeReferenceNode("int") -> NumericPrimitiveFact(int32)
Lowering plan: BinaryOperationPlan("+", leftType=int32, rightType=int32, result=int32)
```

No separate `IrVariableDeclarator` is needed just to mirror `VariableDeclaration`.

### Type System and Inference

Current examples:

```text
packages/frontend/src/ir/type-system/*
packages/frontend/src/ir/binding/*
packages/frontend/src/ir/converters/type-env.ts
```

Current responsibilities:

```text
type inference
call resolution
generic inference
member lookup
utility type handling
type alias expansion
overload candidate scoring
```

Final disposition:

```text
TSTS checker owns TypeScript type inference, overloads, symbols, signatures, generics, contextual typing, and type predicates
Tsonic owns only source-extension facts and backend-neutral lowering decisions
```

Concrete example:

```ts
function id<T>(value: T): T { return value; }
const name = id("a");
```

Final owner:

```text
TSTS checker: resolved signature id<string>, result type string
Tsonic lowering: emits the call plan from the TSTS signature/type answers
```

Tsonic must not run an independent generic inference pass for this call.

### Flow and Narrowing

Current examples:

```text
packages/frontend/src/ir/converters/flow-narrowing.ts
packages/frontend/src/ir/converters/narrowing-*.ts
packages/frontend/src/ir/types/if-branch-plan.ts
```

Current responsibilities:

```text
collect narrowing candidates
resolve typeof/equality/truthy guards
materialize branch narrowing plans eagerly
store runtime union arm selections
```

Final disposition:

```text
TSTS checker owns flow-sensitive source type at each use site
Tsonic lowering asks for the use-site type when building a plan
runtime union carrier/arm representation belongs to backend/runtime lowering, not source analysis
```

Concrete example:

```ts
function f(value: string | number): int {
  if (typeof value === "string") {
    return value.length as int;
  }
  return 0;
}
```

Final owner:

```text
TSTS checker: type of value in then branch is string
Tsonic lowering: member plan for string.length
C# backend: decides whether the runtime union carrier uses AsString(), a tag switch, or another representation
```

### Validation

Current examples:

```text
packages/frontend/src/validation/*
packages/frontend/src/ir/validation/*
```

Current responsibilities:

```text
unsupported syntax validation
static-safety validation
numeric validation/proofs
soundness gates
attribute collection
overload collection
yield lowering
anonymous type lowering
```

Final disposition:

```text
TSTS owns ordinary TypeScript syntax/type diagnostics
Tsonic extension owns source-language diagnostics over Tsonic markers
Tsonic lowering owns backend-neutral emitter-contract validation
backend owns target mechanism validation
```

Concrete example:

```ts
out(value + 1);
```

Final owner:

```text
Tsonic source extension diagnostic: out(...) argument must be assignable storage.
```

The diagnostic is source-language. It must not say "C# out parameter cannot be emitted."

### Resolver and Source Packages

Current examples:

```text
packages/frontend/src/resolver/*
packages/frontend/src/program/source-package-metadata.ts
packages/frontend/src/program/source-binding-imports.ts
packages/frontend/src/program/external-binding-payload.ts
```

Current responsibilities:

```text
resolve source-package roots
read source package metadata
resolve generated binding payloads
normalize legacy manifest shapes
help TypeScript module resolution see generated declarations
```

Final disposition:

```text
keep source-package metadata as Tsonic product behavior
move module-resolution graph and import/export identity to TSTS
feed TSTS one canonical source-package metadata shape
delete legacy/v1/v2 translation paths
attach source-package binding facts through the Tsonic extension
```

Concrete example:

```ts
import { DbContext } from "@tsonic/dotnet/ef.js";
```

Final owner:

```text
TSTS: resolved module and imported symbol
Tsonic extension: ExternalTypeBindingFact(package export DbContext)
C# backend: maps that source identity to target rendering
```

The frontend may know this is an external source-package type. It must not hardcode `System.*` or a CLR emitted name.

### Source Frontend Boundary

Current examples:

```text
packages/frontend/src/source-frontend/source-frontend.ts
packages/frontend/src/source-frontend/typescript-semantic-view.ts
packages/frontend/src/source-frontend/tsts-semantic-view.ts
```

Current state:

```text
SourceFrontendEngine is now "tsts" in the source frontend interface.
The generic semantic-view type still permits "typescript" in SourceSemanticEngine.
The TypeScript semantic view still exists.
```

Final disposition:

```text
delete TypeScript semantic view from product frontend
delete "typescript" from SourceSemanticEngine
expose only TSTS-backed semantic view
tests may keep historical fixtures only outside product code paths
```

Concrete example:

```ts
program.sourceSemantics.getExpressionType(node)
```

Final meaning:

```text
node is a TSTS node
answer comes from TSTS checker facade
no tsc TypeChecker can satisfy the product interface
```
