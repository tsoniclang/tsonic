# Tsonic Architecture

Technical documentation for contributors and advanced users.

## Design Goals

Tsonic is designed around these principles:

1. **Exact Semantics**: JavaScript behavior preserved exactly via runtime libraries
2. **Native Performance**: NativeAOT compilation for fast startup and execution
3. **Zero Magic**: Clear errors instead of guessing; explicit over implicit
4. **Functional Codebase**: Immutable data, pure functions, explicit dependencies

## Architecture Overview

Tsonic is a multi-phase compiler that transforms TypeScript to native executables:

```
                    ┌─────────────────────────────────────────┐
                    │           TypeScript Source             │
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND PACKAGE                                │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐       │
│  │   Parse    │ -> │  Resolve   │ -> │  Validate  │ -> │  Build IR  │       │
│  │ TypeScript │    │  Imports   │    │   Rules    │    │            │       │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘       │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────┐
                    │        IR (Intermediate Representation) │
                    │   Language-agnostic AST with semantics  │
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EMITTER PACKAGE                                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐       │
│  │   Types    │    │ Statements │    │Expressions │    │  Modules   │       │
│  │  Emitter   │    │  Emitter   │    │  Emitter   │    │  Emitter   │       │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘       │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────┐
                    │              C# Source Code             │
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND PACKAGE                                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐       │
│  │  Generate  │ -> │  Generate  │ -> │   dotnet   │ -> │   Copy     │       │
│  │   .csproj  │    │ Program.cs │    │  publish   │    │  Binary    │       │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘       │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────┐
                    │            Native Binary                │
                    │     (via .NET NativeAOT compiler)       │
                    └─────────────────────────────────────────┘
```

## Package Structure

```
packages/
├── frontend/     # TypeScript parsing, validation, IR building
├── emitter/      # C# code generation from IR
├── backend/      # .NET build orchestration
└── cli/          # Command-line interface
```

### Dependency Graph

```
cli
 ├── frontend
 ├── emitter
 └── backend

frontend (standalone)

emitter
 └── frontend (for IR types)

backend (standalone)
```

## Core Data Structures

### IR (Intermediate Representation)

The IR is the central data structure bridging TypeScript and C#:

- **IrModule**: Represents a compiled TypeScript file
- **IrStatement**: Function, class, variable declarations, control flow
- **IrExpression**: Literals, operators, calls, member access
- **IrType**: Primitives, references, arrays, functions, unions

See [IR Documentation](ir.md) for complete type definitions.

### Result Types

All operations return `Result<T, E>` instead of throwing exceptions:

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### Diagnostics

Errors are collected as `Diagnostic` objects with:
- Error code (TSN1xxx - TSN9xxx)
- Severity (error, warning)
- Message and hint
- Source location

See [Diagnostics](diagnostics.md) for error handling details.

## Key Design Decisions

### Why IR?

The IR provides:
1. **Separation of concerns**: Frontend knows nothing about C#
2. **Optimization opportunities**: Can transform IR before emission
3. **Testability**: Test IR building and emission independently
4. **Extensibility**: Could target other languages in future

### Why Functional Programming?

The compiler uses strict FP principles:
- **Immutable data**: No unexpected mutations during compilation
- **Pure functions**: Same inputs always produce same outputs
- **Explicit dependencies**: No hidden global state
- **Testability**: Pure functions are trivial to test

### Why NativeAOT?

NativeAOT provides:
- Fast startup (no JIT warmup)
- Small binaries (tree shaking)
- No runtime dependency
- Predictable performance

## Table of Contents

### Core Architecture
- [Overview](overview.md) - Design principles and goals
- [Pipeline](pipeline.md) - 7-stage compilation pipeline
- [IR](ir.md) - Intermediate Representation types
- [Diagnostics](diagnostics.md) - Error handling and reporting

### Packages
- [Packages](packages.md) - Monorepo structure
- [Frontend](frontend.md) - TypeScript parsing and IR building
- [Emitter](emitter.md) - C# code generation
- [Backend](backend.md) - .NET build orchestration

### Reference
- [Type Mappings](type-mappings.md) - TypeScript to C# conversion
- [Runtime](runtime.md) - Tsonic.Runtime and JSRuntime libraries

## Development

```bash
# Build all packages
./scripts/build/all.sh

# Run tests
npm test

# Run E2E tests
./test/scripts/run-all.sh

# Format code
./scripts/build/format.sh

# Lint code
./scripts/build/lint.sh
```

## Contributing

1. Read the [coding standards](../../CODING-STANDARDS.md)
2. Understand the [pipeline](pipeline.md) flow
3. Follow functional programming principles
4. Add tests for new functionality
5. Run format and lint before committing
