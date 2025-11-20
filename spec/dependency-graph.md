# Dependency Graph Contract

## Purpose

Represents module dependencies for build ordering and circular dependency detection.

## Data Structure

```typescript
type DependencyGraph = {
  modules: Map<string, ModuleNode>;
  edges: Map<string, string[]>;  // module → dependencies
};

type ModuleNode = {
  path: string;
  namespace: string;
  exports: string[];  // Exported symbol names
  imports: ImportEdge[];
};

type ImportEdge = {
  from: string;      // This module
  to: string;        // Imported module
  symbols: string[]; // Imported symbols
  isDotNet: boolean; // Is this a .NET import?
};
```

## Build Order Algorithm

1. Topological sort of dependency graph
2. Detect cycles (error if found)
3. Return modules in safe build order

## Circular Dependencies

Detected and reported as TSN1006:

```
Circular dependency detected:
  A.ts → B.ts → C.ts → A.ts
```

## Example

```typescript
// A.ts
import { B } from "./B.ts";
export class A { b: B; }

// B.ts
import { File } from "System.IO";
export class B {}
```

Graph:
```
A.ts → B.ts
B.ts → (no local dependencies)
```

Build order: `[B.ts, A.ts]`

## Implementation

Location: `packages/frontend/src/graph/`

## See Also

- [architecture/06-phase-analysis.md](architecture/06-phase-analysis.md)
