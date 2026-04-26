# Overview

## Layer map

```text
CLI
  -> config resolution
  -> workspace/project/package orchestration

Frontend
  -> TypeScript program creation
  -> core + surface global setup
  -> package/source-package resolution
  -> validation
  -> IR construction

Emitter
  -> semantic preparation
  -> CSharpAst construction
  -> printer

Backend
  -> generated project layout
  -> dotnet build/publish/test/pack
```

## Core architectural rules

### 1. Compiler core vs surface

- compiler core globals are compiler-owned
- surface globals come from the active surface package
- packages such as `@tsonic/nodejs` add importable modules, not ambient worlds

### 2. Source packages are compiled as source

Installed Tsonic source packages are not opaque imports. They are pulled into:

- the same TypeScript program
- the same dependency graph
- the same deterministic type/lowering pipeline

### 3. Generated CLR binding packages are different

Generated binding packages are declaration + metadata packages. They are not
compiled as authored source packages, and they are not explained by the same
manifest model.

### 4. The emitter is AST-only

The emitter assembles C# through AST nodes instead of mixed string shims.

Emitter path:

```text
IR -> CSharpAst -> printer -> C# text
```

### 5. The compiler rejects ambiguity early

Tsonic favors deterministic rejection over permissive fallback. That means:

- ambiguous lowering is rejected before emission
- package graph problems surface as compiler diagnostics
- unsupported runtime-shape escapes are rejected rather than hidden
