# TSTS → Tsonic Integration Architecture — Superseded

This document is historical context. The canonical final-swing spec is now `.analysis/final-swing-jun/`.

Do not use this file to justify weaker ownership boundaries, dual frontend paths, compatibility bridges, or local Tsonic reimplementations of TypeScript compiler semantics.

The authoritative documents are:

```text
.analysis/final-swing-jun/09-current-frontend-inventory.md
.analysis/final-swing-jun/10-exhaustive-ownership-contract.md
.analysis/final-swing-jun/11-public-tsts-api-contract.md
.analysis/final-swing-jun/12-deletion-and-enforcement-ledger.md
```

The original text remains below only for traceability.

## Executive Decision

TSTS must first become a production compiler library that faithfully ports the in-scope TS-Go compiler. Tsonic must then consume TSTS through a stable embedding API and a generic compiler-extension model.

The target stack is:

```text
TypeScript source
  -> TSTS
       scanner
       parser
       TS-Go-compatible AST
       binder
       checker
       flow analysis
       module graph
       diagnostics
       emit/printer
  -> Generic extension host
       typed sidecar facts
       extension diagnostics
       deterministic lifecycle hooks
  -> Tsonic source extension
       numeric primitive facts
       parameter passing facts
       attribute/source-package facts
       native-safe source diagnostics
  -> Tsonic lowering
       AST-backed plans
       backend capability validation
       synthetic declaration registry
  -> Tsonic backend
       C# emission
       project generation
       build/test/publish orchestration
```

There is no permanent dual frontend. The TypeScript compiler API path is a migration aid only. Final Tsonic product code must not import `typescript` or depend on `ts.Program`, `ts.TypeChecker`, `ts.SourceFile`, `ts.Node`, `ts.Symbol`, `ts.Type`, or `ts.Signature`.

## Non-Negotiable Boundaries

TSTS core owns TypeScript compiler semantics. It must remain useful as a standalone compiler library.

TSTS core must not contain:

```text
csharpTypeName
clrType
dotnetType
emittedClrName
C# emit decisions
CLR binding decisions
Tsonic-only AST node kinds
Tsonic-only package metadata paths as core behavior
```

TSTS core may contain:

```text
extension host APIs
typed extension fact keys
extension diagnostics
extension lifecycle scheduling
generic import/module identity services
generic checker facade APIs
```

Tsonic-specific semantics live in an extension package/profile over the generic host. Backend-specific rendering remains in the Tsonic backend.

## Phase 1 — Make TSTS Production-Ready

TSTS must be production-capable before Tsonic switches over to it.

Definition of done:

```text
TSTS compiles under tsc.
TSTS can compile ordinary TypeScript projects.
TSTS can emit JavaScript, declaration output, diagnostics, and baselines for in-scope cases.
TSTS has TS-Go-equivalent tests for compiler scope.
TSTS exposes a stable embedding API.
TSTS exposes a generic extension host.
TSTS has no language-service product surface unless language-service tests are also in scope.
```

### 1. Faithful TS-Go Porting

The active TSTS direction is an exact, tooling-driven TS-Go port. The port is not "similar TypeScript inspired by TS-Go"; it is a mechanical compiler port with explicit exceptions.

Rules:

```text
Every in-scope Go source unit has a corresponding TS unit or an explicit generated/host-facade mapping.
Every TS unit carries enough metadata to verify it against its TS-Go source.
Generated TS skeletons must compile where possible and throw explicit unimplemented errors only while the port is incomplete.
Large TS-Go files may be split, but only through a machine-readable split plan.
The porter must detect missing, duplicate, orphaned, stale, and drifted units.
The porter must never silently overwrite manually implemented code.
```

Large-file splitting must be semantic, not random. Example:

```text
internal/checker/checker.go
  -> internal/checker/checker/core.ts
  -> internal/checker/checker/types.ts
  -> internal/checker/checker/signatures.ts
  -> internal/checker/checker/relations.ts
  -> internal/checker/checker/diagnostics.ts
```

The split plan is authoritative. If a Go declaration is not covered by the plan, verification fails.

### 2. Go Compatibility Layer

The port may use a TypeScript Go-compatibility layer to preserve Go semantics without importing the Go standard library as runtime code.

Examples:

```ts
type GoPtr<T> = T | undefined;
type GoSlice<T> = readonly T[] | undefined;

interface TextWriter {
  write(text: string): void;
}

interface FsFileInfo {
  readonly name: string;
  readonly size: int;
  readonly isDirectory: boolean;
}
```

The porter should generate facades for Go standard-library and third-party dependency surfaces that TS-Go actually uses. Facades must be globally owned and reused. Do not scatter local shapes such as `GoExternal<"io.Writer">` through product code when a real facade such as `TextWriter` can be generated and shared.

### 3. Go Zero Values and Nil Values

Go struct zero values are not the same as missing JavaScript object fields.

Go:

```go
tspath.ComparePathsOptions{}
```

Faithful TypeScript:

```ts
const options: ComparePathsOptions = {
  UseCaseSensitiveFileNames: false,
  CurrentDirectory: "",
};
```

Also acceptable if generated:

```ts
const options = NewComparePathsOptions();
```

Not acceptable:

```ts
const options = {} as ComparePathsOptions;
```

Nilable Go values map to explicit nilable TypeScript shapes:

```go
var redirected *ResolvedProjectReference
```

Faithful TypeScript:

```ts
let redirected: GoPtr<ResolvedProjectReference> = undefined;
```

Function fields are nilable if TS-Go treats them as nilable:

```ts
interface NameGenerator {
  IsFileLevelUniqueNameInCurrentFile: GoPtr<(name: string) => boolean>;
}
```

Do not use `as unknown as` or `undefined!` to fake nil. Fix the model.

### 4. Test Parity

TSTS needs TS-Go-equivalent compiler testing, not only structural counts.

Required test categories:

```text
schema/generated AST checks
porter verification
unit tests for ported internal packages
compiler/conformance corpus tests
baseline comparison tests
parser/scanner tests
module-resolution tests
project/config tests
emit/printer/declaration tests
sourcemap tests
embedding API tests
extension host tests
```

Language service, LSP, and FourSlash are out of scope only if TSTS does not ship those product APIs. If TSTS ships language-service APIs, the corresponding TS-Go language-service/FourSlash test surface becomes mandatory.

Final test direction:

```text
TSTS tests compile with tsc.
TSTS tests run under Node.
TSTS baseline runners consume in-scope TS-Go/TypeScript compiler cases.
Unused, stale, or missing baselines fail.
Disabled imports are not a production state.
```

Example source corpus case:

```ts
// @target: es2022
// @strict: true

function size(value: string | number) {
  if (typeof value === "string") {
    return value.length;
  }
  return value + 1;
}
```

TSTS must parse metadata, build the virtual file set, run the compiler, collect diagnostics, emit requested outputs, and compare deterministic baselines.

## Phase 2 — Generic TSTS Extension Host

The extension host is a TSTS product feature. It must be generic, statically typed, deterministic, and zero-cost when unused.

### Extension Storage

Extension facts are stored in program-scoped sidecar tables. They are not written directly onto AST nodes.

Correct:

```ts
facts.setNodeFact(typeNode, NumericTypeFact, {
  sourceName: "int",
  kind: "int32",
  signed: true,
  width: 32,
  runtimeBase: "number",
});
```

Incorrect:

```ts
(typeNode as any).__extensions_tsonic = {
  kind: "int32",
};
```

Reason:

```text
TS-Go AST compatibility stays exact.
Serialized/snapshotted ASTs do not gain consumer-specific fields.
Facts can be cleared, recomputed, and scoped per Program.
Extensions do not corrupt parser/binder/checker object shapes.
```

### Fact API

The fact store must support nodes, symbols, types, source files, programs, diagnostics, and cross-extension reads.

```ts
export interface ExtensionFactKey<T> {
  readonly extensionId: string;
  readonly name: string;
  readonly description: string;
}

export interface ExtensionFacts {
  getNodeFact<T>(node: Node, key: ExtensionFactKey<T>): T | undefined;
  setNodeFact<T>(node: Node, key: ExtensionFactKey<T>, value: T): void;

  getSymbolFact<T>(symbol: Symbol, key: ExtensionFactKey<T>): T | undefined;
  setSymbolFact<T>(symbol: Symbol, key: ExtensionFactKey<T>, value: T): void;

  getTypeFact<T>(type: Type, key: ExtensionFactKey<T>): T | undefined;
  setTypeFact<T>(type: Type, key: ExtensionFactKey<T>, value: T): void;

  getSourceFileFact<T>(sourceFile: SourceFile, key: ExtensionFactKey<T>): T | undefined;
  setSourceFileFact<T>(sourceFile: SourceFile, key: ExtensionFactKey<T>, value: T): void;

  getProgramFact<T>(key: ExtensionFactKey<T>): T | undefined;
  setProgramFact<T>(key: ExtensionFactKey<T>, value: T): void;

  appendDiagnostic(diagnostic: Diagnostic): void;
  diagnostics(): readonly Diagnostic[];
}
```

Fact keys must be typed and namespaced. Consumers should pass `NumericTypeFact`, not string keys such as `"numericType"`.

### Hooks

Default hooks are file/program-level hooks, not per-node parser callbacks:

```ts
interface CompilerExtension {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly dependsOn?: readonly string[];
  readonly runsAfter?: readonly string[];

  configure?(context: ExtensionConfigureContext): void;
  afterParseSourceFile?(context: ExtensionParseContext, sourceFile: SourceFile): void;
  afterBindSourceFile?(context: ExtensionBindContext, sourceFile: SourceFile): void;
  afterCheckSourceFile?(context: ExtensionCheckContext, sourceFile: SourceFile): void;
  afterCheckProgram?(context: ExtensionProgramContext): void;
  validateProgram?(context: ExtensionProgramContext): readonly Diagnostic[];
}
```

Parser hooks are reserved for future grammar extensions. Tsonic does not need parser hooks for current source semantics because `int`, `field<T>`, `out(value)`, attributes, and `struct` markers are all valid TypeScript syntax.

Reasoning:

```text
Parser hooks run in the hottest compiler path.
Parser hooks interact with speculation, reparsing, JSX, and error recovery.
Parser hooks make zero-extension parity more fragile.
File/program hooks see the complete AST and can use binder/checker results.
```

Example:

```ts
import type { int } from "@tsonic/core/types.js";

let value: int = 1;
```

TSTS parser should only produce:

```text
TypeReferenceNode("int")
```

The numeric extension attaches the numeric fact after parse/bind/check. The parser does not need to know that `int` is a primitive alias.

### Checker Facade

Extensions should receive a stable checker facade, not private checker internals.

Minimum shape:

```ts
interface ExtensionTypeChecker {
  getTypeAtLocation(node: Node): Type | undefined;
  getSymbolAtLocation(node: Node): Symbol | undefined;
  getDeclaredTypeOfSymbol(symbol: Symbol): Type | undefined;
  getContextualType(node: Expression): Type | undefined;
  getResolvedSignature(node: CallExpression | NewExpression): Signature | undefined;
}
```

Flow-sensitive questions should use the checker answer at the use site:

```ts
function size(value: string | number): int {
  if (typeof value === "string") {
    return value.length as int;
  }
  return 0;
}
```

Expected queries:

```text
checker.getTypeAtLocation(value at parameter)    -> string | number
checker.getTypeAtLocation(value inside then arm) -> string
checker.getTypeAtLocation(value inside else arm) -> number
```

Tsonic should not rebuild a parallel eager narrowing engine when TSTS can answer narrowed type questions directly.

### Diagnostics

Extension diagnostics are normal TSTS diagnostics with numeric codes and source spans.

Reserved ranges:

```text
9000000-9099999  extension host infrastructure
9100000-9199999  reference numeric-primitives extension
9200000-9299999  Tsonic source-semantics extension
```

Good diagnostic target:

```ts
import { int } from "@tsonic/core/types.js";
         ^^^
```

Message:

```text
9100001 Numeric primitive 'int' must be imported with 'import type'.
```

Bad diagnostic:

```text
Cannot lower int in C# emitter.
```

The error belongs at the user source construct, before backend emission.

### Import Identity

Extensions need generic import identity services. They must handle named imports, aliases, namespace imports, and type-only imports.

Examples:

```ts
import type { int } from "@tsonic/core/types.js";
import type { int as int32 } from "@tsonic/core/types.js";
import * as Types from "@tsonic/core/types.js";
```

Facts should record source identity and local spelling:

```text
local name: int32
source identity: @tsonic/core/types.js::int
```

Where module resolution is available, resolved module identity is authoritative. Raw specifier text is only an early parse fact.

## Phase 3 — Tsonic Extension Over TSTS

Tsonic becomes a consumer of the generic extension host.

The Tsonic source extension owns source-language facts:

```text
numeric primitives
field/property storage intent
out/ref/inref argument intent
struct/interface/value-type intent
attribute marker recognition
source-package binding metadata
native-safe source diagnostics
```

It does not own backend rendering.

### Numeric Primitive Facts

Source:

```ts
import type { int, long, double } from "@tsonic/core/types.js";

export function distance(left: int, right: int): double {
  const delta: long = right - left;
  return Math.abs(delta);
}
```

TSTS AST:

```text
FunctionDeclaration distance
  ParameterDeclaration left
    TypeReferenceNode int
  ParameterDeclaration right
    TypeReferenceNode int
  Return type
    TypeReferenceNode double
  VariableDeclaration delta
    TypeReferenceNode long
```

Extension facts:

```ts
TypeReferenceNode("int") -> {
  sourceName: "int",
  kind: "int32",
  signed: true,
  width: 32,
  runtimeBase: "number",
}

TypeReferenceNode("long") -> {
  sourceName: "long",
  kind: "int64",
  signed: true,
  width: 64,
  runtimeBase: "number",
}

TypeReferenceNode("double") -> {
  sourceName: "double",
  kind: "float64",
  width: 64,
  runtimeBase: "number",
}
```

Banned fact shape:

```ts
{
  csharpKeyword: "long",
  clrType: "System.Int64",
}
```

Backend mapping from `int64` to C# `long` is a backend decision.

### Field Storage Facts

Source:

```ts
import type { field } from "@tsonic/core/lang.js";
import type { int } from "@tsonic/core/types.js";

class Counter {
  private count: field<int> = 0;
}
```

Facts:

```text
PropertyDeclaration("count") -> StorageFact { kind: "field" }
TypeReferenceNode("int")     -> NumericTypeFact { kind: "int32" }
```

This is source storage intent. The C# emitter later decides whether the target spelling is a field, a property, a backing member, or a generated carrier.

### Parameter Passing Facts

Source:

```ts
import { out, ref } from "@tsonic/core/lang.js";
import type { int } from "@tsonic/core/types.js";

let value: int = 0;
dict.tryGetValue("id", out(value));
increment(ref(value));
```

Facts:

```text
CallExpression(out(value)) -> ParameterPassingFact {
  mode: "out",
  target: Identifier("value")
}

CallExpression(ref(value)) -> ParameterPassingFact {
  mode: "ref",
  target: Identifier("value")
}
```

Validation belongs in the extension/checking layer:

```ts
out(value);        // valid if value is assignable storage
out(items[index]); // valid if checker proves assignable storage
out(value + 1);    // invalid
out(getValue());   // invalid
```

Diagnostic:

```text
9201204 out(...) argument must be assignable storage.
```

### Attribute Facts

Source:

```ts
import { attributes as A } from "@tsonic/core/lang.js";
import { FactAttribute } from "xunit-types/Xunit.js";

export class ScannerTests {
  scans_identifier(): void {}
}

A<ScannerTests>().method(test => test.scans_identifier).add(FactAttribute);
```

TSTS core sees ordinary calls and property accesses. The Tsonic extension attaches:

```text
MethodDeclaration("scans_identifier") -> AttributeFact {
  target: "method",
  attributeExpression: Identifier("FactAttribute")
}
```

TSTS does not know xUnit. Tsonic test compilation decides how to render the attribute.

### Union and Narrowing

Runtime union-arm facts should not be stored in TSTS. They are backend/runtime representation.

Source:

```ts
function valueSize(value: string | number): int {
  if (typeof value === "string") {
    return value.length as int;
  }
  return 0;
}
```

TSTS checker facts:

```text
value at declaration -> string | number
value in then block  -> string
value in else block  -> number
```

Tsonic lowering can compute the emission plan from the declared type, use-site narrowed type, and backend runtime representation.

Banned TSTS fact:

```ts
{
  runtimeUnionArm: "As1",
}
```

That belongs to backend lowering, not source analysis.

## Phase 4 — Tsonic Frontend Replacement

Current Tsonic flow:

```text
tsonic CLI
  -> read tsonic config
  -> build TypeScript compiler options
  -> TypeScript module resolution
  -> ts.createProgram
  -> TypeScript diagnostics
  -> build Tsonic IR
  -> run frontend passes
  -> emit C#
```

Target Tsonic flow:

```text
tsonic CLI
  -> read tsonic config
  -> build Tsonic source options
  -> TSTS createProgram
  -> TSTS diagnostics + checker + module graph
  -> Tsonic source extension facts
  -> Tsonic source policy validation
  -> AST-backed lowering facts
  -> backend capability validation
  -> emit C#
```

Tsonic remains responsible for:

```text
tsonic.json and workspace config
build/test/publish command behavior
source-package packaging
surface package metadata
backend capability manifests
C# project generation
C# emission
NativeAOT constraints
downstream validation
```

TSTS replaces the TypeScript compiler dependency. It does not replace the Tsonic product.

### Source Frontend Contract

Tsonic should introduce one source-frontend abstraction:

```ts
interface SourceFrontend {
  buildProgram(options: SourceProgramOptions): Result<SourceProgram, readonly Diagnostic[]>;
}

interface SourceProgram {
  readonly sourceFiles: readonly SourceFileView[];
  readonly diagnostics: readonly Diagnostic[];
  readonly moduleGraph: SourceModuleGraph;
  readonly checker: SourceSemanticChecker;
  readonly facts: SourceSemanticFacts;
}
```

During migration, the current TypeScript frontend can implement this contract only as a temporary comparison path. Final state deletes it.

### IR Replacement Direction

The current Tsonic IR is close to a semantic AST copy. The final design should not keep a permanent duplicate tree when TSTS already provides the TS-Go AST plus semantic services.

Current-style IR:

```ts
interface IrFunctionDeclaration {
  readonly kind: "functionDeclaration";
  readonly name: string;
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement;
}

interface IrIfStatement {
  readonly kind: "ifStatement";
  readonly condition: IrExpression;
  readonly thenStatement: IrStatement;
  readonly elseStatement?: IrStatement;
  readonly plan?: IrIfBranchPlan;
}
```

Target input contract:

```ts
interface TsonicCompilationInput {
  readonly program: Program;
  readonly checker: ExtensionTypeChecker;
  readonly facts: ExtensionFacts;
  readonly rootFiles: readonly SourceFile[];
  readonly loweringFacts: TsonicLoweringFacts;
}
```

Example lowering use:

```ts
function lowerVariable(input: TsonicCompilationInput, node: VariableDeclaration): LocalPlan {
  const declaredType =
    node.type === undefined
      ? undefined
      : input.facts.getNodeFact(node.type, TsonicNumericTypeFact);

  const checkerType = input.checker.getTypeAtLocation(node.name);

  return makeLocalPlan(node, declaredType, checkerType);
}
```

The emitter should consume typed plans and facts through stable APIs. It should not rediscover source facts from strings.

## Execution Roadmap

### Step 1 — Finish TSTS Compiler Core

Required gates:

```text
porter verification has zero missing/stale/orphan/duplicate units
tsc build passes
unit tests pass
compiler/conformance corpus runner exists
baseline runner exists
emit/printer behavior is tested
project/config/module tests pass
LS/FourSlash removed or fully tested
```

### Step 2 — Publish Stable TSTS Embedding API

Required APIs:

```text
createProgram
program diagnostics
source file enumeration
module graph access
checker queries
emit/printer entrypoints
extension registration
extension facts
extension diagnostics
```

### Step 3 — Implement Generic Extension Host

Required tests:

```text
zero extensions preserve behavior
duplicate extension IDs fail
missing dependencies fail
dependency cycles fail
runsAfter ordering is deterministic
hook exceptions become diagnostics
node/symbol/type/sourceFile/program facts are scoped per Program
cross-extension reads work through declared dependencies
extension diagnostics surface with source spans
```

### Step 4 — Implement Tsonic Source Extension

Required source examples:

```text
numeric primitives: int, uint, long, ulong, short, ushort, byte, sbyte, float, double, decimal, bool, char, nint, nuint
aliased primitive imports
namespace primitive imports
shadowed primitive names
field<T>
struct/interface intent
out/ref/inref calls
attribute builder calls
source-package binding metadata
flow-sensitive checker queries
```

### Step 5 — Replace Tsonic Frontend Internals

Migration order:

```text
module graph
diagnostics
source file model
declaration lowering
type lowering
expression lowering
call/signature lowering
member/index access
narrowing/control-flow plans
attributes
source-package bindings
synthetic declarations
```

Each domain must include source examples, old behavior, new TSTS/fact behavior, and tests.

### Step 6 — Delete Old TSC Path

Required search result:

```text
production frontend imports of `typescript`: zero
production use of ts.Program/ts.TypeChecker/ts.SourceFile/ts.Node/ts.Type/ts.Symbol/ts.Signature: zero
legacy TypeScriptSourceFrontend path: deleted
comparison-only migration tests: deleted or explicitly moved to historical fixtures
```

## Validation Matrix

TSTS changes require:

```text
porter verification
tsc typecheck
TSTS unit tests
TSTS compiler/conformance corpus tests
TSTS baseline tests
TSTS emit/project/module tests
TSTS extension-host tests when extension code changes
```

Tsonic changes require:

```text
Tsonic run-all
proof-pudding downstream
tsumo downstream
clickmeter downstream
any other first-party downstream explicitly in the current gate list
```

Tsonic integration changes require both sets.

## Banned End States

Do not finish with:

```text
TSTS core containing C#/CLR/DotNet facts
Tsonic-specific AST fields on TS-Go nodes
string-keyed extension facts
runtime union arm facts in TSTS
permanent TypeScript compiler fallback path
legacy compatibility readers
disabled tests counted as green
as unknown as bridges in product code
undefined! used as nil modeling
JSON.stringify semantic comparators
name-based rediscovery of primitives or package facts
```

## Final Definition of Done

TSTS:

```text
is a standalone tsc-built compiler library
faithfully ports the in-scope TS-Go compiler
compiles ordinary TypeScript projects
emits compiler outputs for in-scope cases
has TS-Go-equivalent compiler test coverage
has a stable embedding API
has a generic extension host
has no LS product surface unless LS tests are included
```

Tsonic:

```text
uses TSTS instead of the TypeScript compiler API
uses a Tsonic extension over generic TSTS hooks
uses AST-backed facts and lowering plans instead of a permanent duplicate frontend tree
keeps all backend knowledge in backend/lowering layers
passes run-all and required downstream suites
has no production TSC frontend path
```

Architecture:

```text
TS-Go AST compatibility is preserved.
Extension facts are typed, source-level, and sidecar.
Tsonic-specific semantics are extensions, not TSTS core behavior.
C# backend details stay out of TSTS and the source frontend.
No stale dual design remains.
```
