# Phase 0: Compiler Overview

## Design Principles

1. **.NET-First** - Native .NET types, not JavaScript runtime ports
2. **ESM-Only** - Strict `.ts` extension requirement on local imports
3. **Functional** - Pure functions, immutable data, no mutations
4. **Explicit** - Clear error messages over magic behavior
5. **Layered** - Clean separation between phases

## Compilation Pipeline

```
TypeScript Source
    ↓ [Program] Phase 2
TypeScript AST + TypeChecker
    ↓ [Resolver] Phase 3
Module Graph
    ↓ [Validation] Phase 4
Validated Modules
    ↓ [IR Builder] Phase 5
Intermediate Representation
    ↓ [Analysis] Phase 6
Dependency Graph
    ↓ [Emitter] Phase 7
C# Source Code
    ↓ [Backend] Phase 8
NativeAOT Binary
```

## State Management

No global mutable state. All phases are pure functions:

```typescript
type Phase<Input, Output> = (input: Input, config: Config) => Result<Output, Diagnostic[]>;
```

Configuration and diagnostics passed explicitly between phases.

## Package Organization

- **frontend** - Phases 2-6 (TypeScript → IR)
- **emitter** - Phase 7 (IR → C#)
- **backend** - Phase 8 (.NET compilation)
- **cli** - Phase 10 (orchestration)

## Key Data Structures

- `IrModule` - Intermediate representation of a single file
- `IrExport` / `IrImport` - Module boundaries
- `ModuleGraph` - Dependency relationships
- `Diagnostic` - Errors and warnings

## See Also

- [01-pipeline-flow.md](01-pipeline-flow.md) - Detailed phase connections
- [CODING-STANDARDS.md](../../CODING-STANDARDS.md) - Functional programming rules
