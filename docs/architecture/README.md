# Tsonic Architecture

Technical documentation for contributors and advanced users.

## Table of Contents

- [Overview](overview.md) - High-level architecture
- [Pipeline](pipeline.md) - Compilation pipeline stages
- [IR](ir.md) - Intermediate Representation
- [Packages](packages.md) - Monorepo structure
- [Frontend](frontend.md) - TypeScript parsing and IR building
- [Emitter](emitter.md) - C# code generation
- [Backend](backend.md) - .NET build orchestration
- [Type Mappings](type-mappings.md) - TypeScript to C# type conversion
- [Runtime](runtime.md) - Tsonic.Runtime and JSRuntime

## Quick Overview

Tsonic is a multi-stage compiler:

```
TypeScript Source
       |
       v
  [Frontend] - Parse, validate, build IR
       |
       v
       IR (Intermediate Representation)
       |
       v
  [Emitter] - Generate C# code
       |
       v
   C# Source
       |
       v
  [Backend] - dotnet publish with NativeAOT
       |
       v
  Native Binary
```

## Monorepo Structure

```
tsonic/
├── packages/
│   ├── frontend/     # TypeScript -> IR
│   ├── emitter/      # IR -> C#
│   ├── backend/      # C# -> Binary
│   └── cli/          # Command-line interface
├── runtime/          # Tsonic.Runtime (C#)
├── npm/              # Published npm package
├── scripts/          # Build scripts
└── test/             # E2E tests
```

## Key Concepts

### Functional Programming

All TypeScript code follows strict FP principles:
- Immutable data structures
- Pure functions
- No side effects except I/O
- Explicit dependencies

### Result Types

Functions return `Result<T, E>` instead of throwing:

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### IR (Intermediate Representation)

The IR is a language-agnostic AST that bridges TypeScript and C#:
- Preserves semantic information
- Platform-independent
- Enables optimization passes

### Module Resolution

ESM with mandatory `.ts` extensions:
- Local imports: `./path/to/file.ts`
- .NET imports: `@tsonic/dotnet/Namespace`
- Directory = Namespace
- File = Class

## Development

```bash
# Install dependencies
npm install

# Build all packages
./scripts/build/all.sh

# Run tests
npm test

# Run E2E tests
./test/scripts/run-all.sh
```
