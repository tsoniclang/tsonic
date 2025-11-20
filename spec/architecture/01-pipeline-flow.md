# Phase 1: Pipeline Flow

## Overview

How data flows through the compiler phases.

## Phase Sequence

```
1. Program Creation (Phase 2)
   Input: Entry file path, tsconfig
   Output: ts.Program, ts.TypeChecker

2. Module Resolution (Phase 3)
   Input: ts.Program
   Output: ModuleGraph (all files, dependencies)

3. Validation (Phase 4)
   Input: ModuleGraph, ts.TypeChecker
   Output: Validated modules or diagnostics

4. IR Building (Phase 5)
   Input: Validated modules, ts.TypeChecker
   Output: IrModule[] (one per file)

5. Dependency Analysis (Phase 6)
   Input: IrModule[]
   Output: Build order, circular dependency detection

6. Code Emission (Phase 7)
   Input: IrModule[] in build order
   Output: C# source files

7. Backend Compilation (Phase 8)
   Input: C# files, tsonic.json config
   Output: .exe or .dll (NativeAOT)
```

## Data Contracts

### TypeScript Program (Phase 2 → 3)
```typescript
{
  program: ts.Program,
  checker: ts.TypeChecker,
  rootFile: string
}
```

### Module Graph (Phase 3 → 4)
```typescript
{
  modules: Map<string, ModuleInfo>,
  dependencies: Map<string, string[]>
}
```

### IR Modules (Phase 5 → 6 → 7)
```typescript
IrModule[] = {
  path: string,
  namespace: string,
  className: string,
  imports: IrImport[],
  exports: IrExport[],
  body: IrStatement[]
}
```

### C# Output (Phase 7 → 8)
```typescript
{
  files: Map<string, string>,  // path → C# content
  metadata: BuildMetadata
}
```

## Error Propagation

Each phase returns `Result<T, Diagnostic[]>`:

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

On error, pipeline halts and reports all diagnostics.

## See Also

- [02-phase-program.md](02-phase-program.md) - Program creation
- [11-diagnostics-flow.md](11-diagnostics-flow.md) - Error handling
