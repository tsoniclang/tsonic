# Pipeline

## End-to-end

```text
TypeScript sources
  -> config resolution
  -> TS program creation
  -> surface/core/global setup
  -> module + source-package resolution
  -> validation
  -> IR modules
  -> CSharpAst
  -> printed C#
  -> generated project
  -> dotnet build/publish/test/pack
```

## Stage 1: config resolution

The CLI merges:

- `tsonic.workspace.json`
- `packages/<project>/tsonic.json`
- CLI flags

It also resolves:

- surface capabilities
- type roots
- output mode defaults
- local package ownership mode (`source` vs `dll`)

## Stage 2: program creation

Frontend creates a TypeScript program with:

- compiler-owned core globals
- active surface type roots
- workspace type roots
- installed source-package roots when needed

## Stage 3: resolution

The resolver handles:

- local imports
- CLR binding packages
- source-package imports
- package-manifest overlays
- static ESM import graphs

## Stage 4: validation

Validation enforces:

- strict-AOT feature boundaries
- surface compatibility
- numeric proof constraints
- generic/runtime-shape determinism
- object-literal runtime constraints
- package-manifest correctness
- rejection of runtime dynamic constructs such as dynamic `import()`,
  `import.meta`, `globalThis`, `delete`, and `for...in`
- guarded use of `typeof`, `Array.isArray`, and JavaScript `in` only when the
  frontend has a TypeScript flow fact and Tsonic has closed-carrier proof

## Stage 5: IR

Frontend produces IR modules with:

- statements and expressions
- imports and exports
- resolved type information
- generic substitutions
- backend-relevant semantic decisions

## Stage 6: CSharpAst

Emitter turns IR into typed backend AST.

This is the layer where:

- expression lowering
- statement lowering
- type emission
- helper synthesis
- specialization fixes

are assembled without dropping back into ad-hoc text generation.

## Stage 7: printing

The printer turns `CSharpAst` into C# text.

## Stage 8: backend build

Backend writes:

- emitted `.cs` files
- `Program.cs`
- `tsonic.csproj`
- package-shaped generated source tree where needed

Then drives:

- `dotnet build`
- `dotnet publish`
- `dotnet test`
- `dotnet pack`
