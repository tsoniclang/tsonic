# Public TSTS API Contract Required by Tsonic

Tsonic must consume TSTS through public APIs only. No production frontend code may deep-import TSTS internals such as `internal/ast/*` or checker implementation files. If a currently needed symbol is only available internally, TSTS must promote it to a stable public API.

## Program API

Required shape:

```ts
export interface TstsProgram {
  readonly sourceFiles: readonly SourceFile[];
  readonly diagnostics: readonly Diagnostic[];
  readonly extensionDiagnostics: readonly ExtensionDiagnostic[];
  readonly moduleGraph: ModuleGraph;
  readonly extensionHost: ExtensionHost;
  withSemanticView<T>(sourceFile: SourceFile, run: (checker: ExtensionTypeChecker) => T): T;
  emit(options: EmitOptions): EmitResult;
}

export function createProgram(options: CreateProgramOptions): TstsProgram;
```

Required behavior:

```text
program construction includes source files, declaration files, lib files, and source-package host files
diagnostics include parser/binder/checker diagnostics
module graph is available without Tsonic re-walking imports
checker facade is the only source type/symbol query surface used by Tsonic
```

## Source File API

Required shape:

```ts
export interface SourceFileView {
  readonly fileName: string;
  readonly text: string;
  readonly statements: readonly Node[];
}
```

Tsonic may use this to preserve source order for lowering.

Tsonic must not use this to reconstruct import/export semantics that the module graph already owns.

## Module Graph API

The module graph is mandatory. It is not optional sugar over syntax traversal.

Required concepts:

```ts
export interface ModuleGraph {
  getSourceFileModule(sourceFile: SourceFile): SourceModule;
  getImports(sourceFile: SourceFile): readonly ImportEdge[];
  getExports(sourceFile: SourceFile): readonly ExportEdge[];
  getResolvedModule(sourceFile: SourceFile, specifier: string): ResolvedModule | undefined;
  getImportBinding(sourceFile: SourceFile, localName: string): ImportBinding | undefined;
  getExportBinding(sourceFile: SourceFile, exportedName: string): ExportBinding | undefined;
}

export interface ImportBinding {
  readonly localName: string;
  readonly importedName: string;
  readonly kind: "named" | "default" | "namespace";
  readonly isTypeOnly: boolean;
  readonly sourceSpecifier: string;
  readonly resolvedModule: ResolvedModule | undefined;
  readonly localSymbol: Symbol | undefined;
  readonly importedSymbol: Symbol | undefined;
}

export interface ExportBinding {
  readonly exportedName: string;
  readonly localName: string | undefined;
  readonly sourceSpecifier: string | undefined;
  readonly localSymbol: Symbol | undefined;
  readonly exportedSymbol: Symbol | undefined;
  readonly resolvedModule: ResolvedModule | undefined;
}
```

Required import forms:

```ts
import x from "pkg";
import { a } from "pkg";
import { a as b } from "pkg";
import * as ns from "pkg";
import type { T } from "pkg";
export { a };
export { a as b } from "pkg";
export * from "pkg";
export * as ns from "pkg";
```

Example:

```ts
import type { int as i32 } from "@tsonic/core/types.js";
```

Expected graph answer:

```text
localName: i32
importedName: int
isTypeOnly: true
sourceSpecifier: @tsonic/core/types.js
resolvedModule: canonical source-package module identity
```

Tsonic source extension then attaches:

```text
TypeReferenceNode("i32") -> NumericPrimitiveFact(kind: int32, sourceName: int)
```

## Checker Facade API

Required groups:

```text
node -> type
node -> narrowed/use-site type
node -> symbol
symbol -> declarations/value declaration/exports/aliased symbol
type -> alias symbol/symbol/name/type arguments/union members/index types/properties
call/new expression -> resolved signature
signature -> parameters/return type/type predicate/declaration
type rendering for diagnostics only
symbols in scope for source-extension validation
```

Minimum required shape:

```ts
export interface ExtensionTypeChecker {
  getTypeAtLocation(node: Node): Type | undefined;
  getNarrowedTypeAtLocation(node: Node): Type | undefined;
  getSymbolAtLocation(node: Node): Symbol | undefined;
  resolveAlias(symbol: Symbol): Symbol;
  getSymbolDeclarations(symbol: Symbol): readonly Node[];
  getSymbolValueDeclaration(symbol: Symbol): Node | undefined;
  getDeclaredTypeOfSymbol(symbol: Symbol): Type | undefined;
  getTypeFromTypeNode(node: Node): Type | undefined;
  getTypeOfSymbolAtLocation(symbol: Symbol, location: Node): Type | undefined;
  getContextualType(node: Node): Type | undefined;
  getResolvedSignature(node: Node): Signature | undefined;
  getReturnTypeOfSignature(signature: Signature): Type | undefined;
  getTypePredicateOfSignature(signature: Signature): TypePredicate | undefined;
  getExportsOfModule(symbol: Symbol): readonly Symbol[];
  getPropertyOfType(type: Type, key: string): Symbol | undefined;
  getProperties(type: Type): readonly Symbol[];
  getCallSignatures(type: Type): readonly Signature[];
  getConstructSignatures(type: Type): readonly Signature[];
}
```

If Tsonic needs more checker data, the facade expands here. Tsonic must not import checker internals.

## Extension Host API

Required shape:

```ts
export interface CompilerExtension {
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

Default Tsonic source semantics must use file/program hooks. Parser hooks are reserved only for future syntax that TypeScript cannot parse.

## Fact Store API

Required properties:

```text
typed fact keys
program-scoped lifetime
node/symbol/type/sourceFile/program facts
cross-extension reads through declared dependencies
diagnostics attached to source spans
no stringly-typed lookup in product code
```

Required shape:

```ts
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
}
```

## Syntax Facade API

TSTS may expose a public syntax facade for safe traversal:

```ts
export type { Node, SourceFile };
export { KindFunctionDeclaration, KindVariableDeclaration, AsFunctionDeclaration };
```

Allowed Tsonic uses:

```text
visit statements in source order for lowering
identify Tsonic marker syntax such as out(...), field<T>, attributes(...)
map nodes to source locations for diagnostics
```

Forbidden Tsonic uses:

```text
semantic import/export graph reconstruction
type inference from syntax
overload resolution from syntax
flow narrowing from syntax
module resolution from raw specifiers
```

## Diagnostics API

Required diagnostic flow:

```text
TSTS diagnostics -> Tsonic diagnostic adapter
Tsonic extension diagnostics -> Tsonic diagnostic adapter
Tsonic capability diagnostics -> same Diagnostic shape
backend diagnostics -> backend phase only
```

Extension diagnostic code ranges:

```text
9000000-9099999  generic extension infrastructure
9100000-9199999  reference numeric primitives
9200000-9299999  Tsonic source-semantics extension
```

Example:

```ts
import { int } from "@tsonic/core/types.js";
```

Correct diagnostic:

```text
9100001 Numeric primitive 'int' must be imported with 'import type'.
```

Incorrect diagnostic:

```text
Cannot emit int in C#.
```
