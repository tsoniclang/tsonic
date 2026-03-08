# Compilation Pipeline

## End-to-End

```text
TypeScript sources
  -> TS Program creation
  -> surface/core/global setup
  -> module + source-package resolution
  -> validation
  -> IR modules
  -> CSharpAst
  -> printed C#
  -> generated project
  -> dotnet build/publish/test
```

## Stage 1: Config Resolution

The CLI merges:

- `tsonic.workspace.json`
- `packages/<project>/tsonic.json`
- CLI flags

## Stage 2: Program Creation

Frontend creates a TypeScript program with:

- compiler-owned core globals
- active surface type roots
- workspace type roots
- installed source-package roots when needed

## Stage 3: Resolution

The resolver handles:

- local imports
- CLR bindings packages
- source-package imports
- deterministic closed-world dynamic imports

## Stage 4: Validation

Validation enforces:

- strict-AOT feature boundaries
- surface compatibility
- numeric proof constraints
- generic/runtime-shape determinism
- object-literal runtime constraints

## Stage 5: IR

Frontend produces IR modules with statements, expressions, imports, exports, and resolved type information.

## Stage 6: CSharpAst

Emitter turns IR into typed backend AST.

This is where:

- overload and expected-type decisions are reflected in concrete backend nodes
- classes, functions, variables, patterns, conditionals, loops, and types are materialized as AST nodes

## Stage 7: Printing

The backend printer turns `CSharpAst` into text once, at the top of the backend pipeline.

## Stage 8: Backend Build

Backend writes:

- emitted C#
- `Program.cs`
- `tsonic.csproj`

Then drives:

- `dotnet build`
- `dotnet publish`
- `dotnet test`
- `dotnet pack`
