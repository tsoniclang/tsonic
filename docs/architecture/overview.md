# Architecture Overview

## Layer Map

```text
CLI
  -> config resolution
  -> workspace/package manifest orchestration

Frontend
  -> TypeScript program creation
  -> surface/core globals injection
  -> import resolution
  -> validation
  -> IR construction
  -> dependency graph

Emitter
  -> semantic preparation
  -> CSharpAst construction
  -> printer

Backend
  -> generated project files
  -> dotnet build/publish/test/pack
```

## Current Design Rules

### Compiler Core vs Surface

- core globals are compiler-owned
- surface globals come from the active surface package
- packages such as `@tsonic/nodejs` add importable modules, not ambient worlds

### First-Party Source Packages

Installed Tsonic source packages are not opaque imports. They are pulled into:

- the same TS Program
- the same dependency graph
- the same deterministic type/lowering pipeline

### AST-Only Emitter

The emitter no longer assembles C# through mixed string shims in the pipeline.

Current path:

```text
IR -> CSharpAst -> printer -> C# text
```

### Strict-AOT Policy

The compiler rejects ambiguity before emission instead of weakening semantics and relying on later C# failures.
