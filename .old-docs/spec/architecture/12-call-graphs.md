# Phase 11: Call Graphs

## Purpose

This phase constructs and analyzes function call graphs to track function references, identify specializations needed for monomorphization, detect dead code, and enable advanced optimizations.

---

## 1. Overview

**Responsibility:** Call graph construction, specialization tracking, dead code detection

**Package:** `@tsonic/emitter` (used during emission)

**Location:** `packages/emitter/src/call-graph/`

**Input:** IR modules with function declarations and call sites

**Output:** Call graph with specialization requirements and reachability information

---

## 2. Call Graph Data Structure

### 2.1 Core Types

```typescript
type CallGraph = {
  readonly nodes: ReadonlyMap<FunctionId, CallGraphNode>;
  readonly edges: ReadonlyMap<FunctionId, readonly CallEdge[]>;
  readonly entryPoints: readonly FunctionId[];
};

type CallGraphNode = {
  readonly id: FunctionId;
  readonly declaration: IrFunctionDeclaration;
  readonly module: string; // File path
  readonly isGeneric: boolean;
  readonly typeParameters: readonly string[];
  readonly specializations: ReadonlyMap<string, Specialization>; // Type args → specialization
};

type CallEdge = {
  readonly caller: FunctionId;
  readonly callee: FunctionId;
  readonly callSite: IrCallExpression;
  readonly typeArguments: readonly IrType[]; // For generic calls
};

type FunctionId = string; // Qualified name: "MyApp.models.User.create"

type Specialization = {
  readonly typeArguments: readonly IrType[];
  readonly specializationName: string; // e.g., "map__number_string"
  readonly isUsed: boolean; // Reachable from entry points
};
```

### 2.2 Factory Functions

```typescript
const createCallGraph = (irModules: Map<string, IrModule>): CallGraph => {
  const nodes = new Map<FunctionId, CallGraphNode>();
  const edges = new Map<FunctionId, CallEdge[]>();
  const entryPoints: FunctionId[] = [];

  // 1. Build nodes from function declarations
  for (const [filePath, module] of irModules) {
    extractFunctionDeclarations(module, filePath, nodes, entryPoints);
  }

  // 2. Build edges from call sites
  for (const [filePath, module] of irModules) {
    extractCallSites(module, filePath, nodes, edges);
  }

  return { nodes, edges, entryPoints };
};
```

---

## 3. Node Construction

### 3.1 Function Declaration Extraction

```typescript
const extractFunctionDeclarations = (
  module: IrModule,
  filePath: string,
  nodes: Map<FunctionId, CallGraphNode>,
  entryPoints: FunctionId[]
): void => {
  for (const stmt of module.body) {
    if (stmt.kind === "function-declaration") {
      const id = getFunctionId(module.namespace, module.className, stmt.name);

      nodes.set(id, {
        id,
        declaration: stmt,
        module: filePath,
        isGeneric: stmt.typeParameters.length > 0,
        typeParameters: stmt.typeParameters.map((tp) => tp.name),
        specializations: new Map(),
      });

      // Check if this is an entry point
      if (
        stmt.name === "main" &&
        module.exports.some((e) => e.name === "main")
      ) {
        entryPoints.push(id);
      }
    }

    // Handle nested functions (arrow functions, closures)
    if (stmt.kind === "variable-declaration" && stmt.initializer) {
      extractFunctionFromExpression(stmt.initializer, module, filePath, nodes);
    }
  }
};

const getFunctionId = (
  namespace: string,
  className: string,
  functionName: string
): FunctionId => {
  return `${namespace}.${className}.${functionName}`;
};
```

### 3.2 Entry Point Identification

```typescript
const identifyEntryPoints = (
  modules: Map<string, IrModule>,
  nodes: Map<FunctionId, CallGraphNode>
): FunctionId[] => {
  const entryPoints: FunctionId[] = [];

  for (const [filePath, module] of modules) {
    // Entry point: exported function named "main"
    const mainExport = module.exports.find(
      (exp) => exp.name === "main" && exp.kind === "function"
    );

    if (mainExport) {
      const id = getFunctionId(module.namespace, module.className, "main");
      if (nodes.has(id)) {
        entryPoints.push(id);
      }
    }
  }

  return entryPoints;
};
```

---

## 4. Edge Construction

### 4.1 Call Site Extraction

```typescript
const extractCallSites = (
  module: IrModule,
  filePath: string,
  nodes: Map<FunctionId, CallGraphNode>,
  edges: Map<FunctionId, CallEdge[]>
): void => {
  for (const stmt of module.body) {
    if (stmt.kind === "function-declaration") {
      const callerId = getFunctionId(
        module.namespace,
        module.className,
        stmt.name
      );

      // Find all call expressions in function body
      const callSites = findCallExpressions(stmt.body);

      for (const callSite of callSites) {
        const calleeId = resolveCalleeId(callSite, module);
        if (calleeId) {
          const edge: CallEdge = {
            caller: callerId,
            callee: calleeId,
            callSite,
            typeArguments: callSite.typeArguments ?? [],
          };

          const existingEdges = edges.get(callerId) ?? [];
          edges.set(callerId, [...existingEdges, edge]);
        }
      }
    }
  }
};

const findCallExpressions = (
  statements: readonly IrStatement[]
): IrCallExpression[] => {
  const calls: IrCallExpression[] = [];

  const visitExpression = (expr: IrExpression): void => {
    if (expr.kind === "call") {
      calls.push(expr);
    }

    // Recursively visit sub-expressions
    if (expr.kind === "binary") {
      visitExpression(expr.left);
      visitExpression(expr.right);
    } else if (expr.kind === "array-literal") {
      expr.elements.forEach(visitExpression);
    } else if (expr.kind === "object-literal") {
      expr.properties.forEach((prop) => {
        if (prop.kind === "property") {
          visitExpression(prop.value);
        }
      });
    }
    // ... handle other expression types
  };

  const visitStatement = (stmt: IrStatement): void => {
    if (stmt.kind === "expression-statement") {
      visitExpression(stmt.expression);
    } else if (stmt.kind === "return-statement" && stmt.expression) {
      visitExpression(stmt.expression);
    } else if (stmt.kind === "if-statement") {
      visitExpression(stmt.condition);
      stmt.thenBranch.forEach(visitStatement);
      stmt.elseBranch?.forEach(visitStatement);
    } else if (stmt.kind === "for-statement") {
      if (stmt.initializer) visitExpression(stmt.initializer);
      if (stmt.condition) visitExpression(stmt.condition);
      if (stmt.incrementor) visitExpression(stmt.incrementor);
      stmt.body.forEach(visitStatement);
    }
    // ... handle other statement types
  };

  statements.forEach(visitStatement);
  return calls;
};
```

### 4.2 Callee Resolution

```typescript
const resolveCalleeId = (
  callSite: IrCallExpression,
  containingModule: IrModule
): FunctionId | null => {
  if (callSite.callee.kind === "identifier") {
    // Simple function call: foo()
    const functionName = callSite.callee.name;

    // Check local functions in current module
    const localId = getFunctionId(
      containingModule.namespace,
      containingModule.className,
      functionName
    );
    return localId;
  }

  if (callSite.callee.kind === "member-access") {
    // Member call: obj.method()
    const member = callSite.callee;

    if (member.object.kind === "identifier") {
      // Static call: User.create()
      const className = member.object.name;
      const methodName = member.property;

      // Resolve from imports
      const importedModule = findImportedModule(className, containingModule);
      if (importedModule) {
        return getFunctionId(
          importedModule.namespace,
          importedModule.className,
          methodName
        );
      }
    }
  }

  return null; // Cannot resolve (e.g., dynamic call, .NET binding)
};

const findImportedModule = (
  className: string,
  module: IrModule
): { namespace: string; className: string } | null => {
  for (const imp of module.imports) {
    if (imp.names.includes(className)) {
      return {
        namespace: imp.resolvedNamespace,
        className: imp.resolvedClassName ?? className,
      };
    }
  }
  return null;
};
```

---

## 5. Specialization Tracking

### 5.1 Generic Function Calls

When a generic function is called with concrete type arguments, track the specialization:

```typescript
const trackSpecializations = (callGraph: CallGraph): CallGraph => {
  const updatedNodes = new Map(callGraph.nodes);

  for (const [callerId, edges] of callGraph.edges) {
    for (const edge of edges) {
      const calleeNode = updatedNodes.get(edge.callee);

      if (calleeNode && calleeNode.isGeneric && edge.typeArguments.length > 0) {
        // Record specialization
        const specializationKey = getSpecializationKey(edge.typeArguments);
        const specializationName = generateSpecializationName(
          calleeNode.declaration.name,
          edge.typeArguments
        );

        const specialization: Specialization = {
          typeArguments: edge.typeArguments,
          specializationName,
          isUsed: false, // Will be set during reachability analysis
        };

        const updatedSpecializations = new Map(calleeNode.specializations);
        updatedSpecializations.set(specializationKey, specialization);

        updatedNodes.set(edge.callee, {
          ...calleeNode,
          specializations: updatedSpecializations,
        });
      }
    }
  }

  return {
    ...callGraph,
    nodes: updatedNodes,
  };
};

const getSpecializationKey = (typeArgs: readonly IrType[]): string => {
  return typeArgs.map((t) => irTypeToString(t)).join(",");
};

const generateSpecializationName = (
  baseName: string,
  typeArgs: readonly IrType[]
): string => {
  const typeSuffix = typeArgs
    .map((t) => irTypeToString(t).replace(/\./g, "_"))
    .join("_");
  return `${baseName}__${typeSuffix}`;
};

const irTypeToString = (type: IrType): string => {
  if (type.kind === "primitive") {
    return type.primitive; // "number", "string", etc.
  }
  if (type.kind === "type-reference") {
    return type.name; // "User", "Post", etc.
  }
  if (type.kind === "array") {
    return `${irTypeToString(type.elementType)}[]`;
  }
  return "unknown";
};
```

### 5.2 Specialization Example

**TypeScript:**

```typescript
export function map<T, U>(arr: T[], fn: (x: T) => U): U[] {
  const result: U[] = [];
  for (const item of arr) {
    result.push(fn(item));
  }
  return result;
}

export function main(): void {
  const numbers = [1, 2, 3];
  const strings = map(numbers, (x) => x.toString()); // map<number, string>
  const doubled = map(numbers, (x) => x * 2); // map<number, number>
}
```

**Call Graph:**

```typescript
{
  nodes: {
    "MyApp.main.map": {
      id: "MyApp.main.map",
      declaration: /* map<T, U> */,
      isGeneric: true,
      typeParameters: ["T", "U"],
      specializations: {
        "number,string": {
          typeArguments: [{ kind: "primitive", primitive: "number" }, { kind: "primitive", primitive: "string" }],
          specializationName: "map__number_string",
          isUsed: true,
        },
        "number,number": {
          typeArguments: [{ kind: "primitive", primitive: "number" }, { kind: "primitive", primitive: "number" }],
          specializationName: "map__number_number",
          isUsed: true,
        },
      },
    },
    "MyApp.main.main": {
      id: "MyApp.main.main",
      declaration: /* main() */,
      isGeneric: false,
      specializations: {},
    },
  },
  edges: {
    "MyApp.main.main": [
      {
        caller: "MyApp.main.main",
        callee: "MyApp.main.map",
        callSite: /* map(numbers, ...) */,
        typeArguments: [{ kind: "primitive", primitive: "number" }, { kind: "primitive", primitive: "string" }],
      },
      {
        caller: "MyApp.main.main",
        callee: "MyApp.main.map",
        callSite: /* map(numbers, ...) */,
        typeArguments: [{ kind: "primitive", primitive: "number" }, { kind: "primitive", primitive: "number" }],
      },
    ],
  },
  entryPoints: ["MyApp.main.main"],
}
```

---

## 6. Reachability Analysis

### 6.1 Dead Code Detection

Mark functions reachable from entry points:

```typescript
const markReachableFunctions = (callGraph: CallGraph): CallGraph => {
  const reachable = new Set<FunctionId>();
  const visited = new Set<FunctionId>();

  const dfs = (functionId: FunctionId): void => {
    if (visited.has(functionId)) return;
    visited.add(functionId);
    reachable.add(functionId);

    const edges = callGraph.edges.get(functionId) ?? [];
    for (const edge of edges) {
      dfs(edge.callee);
    }
  };

  // Start from entry points
  for (const entryPoint of callGraph.entryPoints) {
    dfs(entryPoint);
  }

  // Mark specializations as used if function is reachable
  const updatedNodes = new Map<FunctionId, CallGraphNode>();
  for (const [id, node] of callGraph.nodes) {
    if (reachable.has(id)) {
      // Mark all specializations as used
      const updatedSpecializations = new Map<string, Specialization>();
      for (const [key, spec] of node.specializations) {
        updatedSpecializations.set(key, { ...spec, isUsed: true });
      }

      updatedNodes.set(id, {
        ...node,
        specializations: updatedSpecializations,
      });
    } else {
      // Unreachable - mark as dead code
      updatedNodes.set(id, node);
    }
  }

  return {
    ...callGraph,
    nodes: updatedNodes,
  };
};

const getDeadFunctions = (callGraph: CallGraph): readonly FunctionId[] => {
  const reachable = new Set<FunctionId>();
  const visited = new Set<FunctionId>();

  const dfs = (functionId: FunctionId): void => {
    if (visited.has(functionId)) return;
    visited.add(functionId);
    reachable.add(functionId);

    const edges = callGraph.edges.get(functionId) ?? [];
    for (const edge of edges) {
      dfs(edge.callee);
    }
  };

  for (const entryPoint of callGraph.entryPoints) {
    dfs(entryPoint);
  }

  // Functions not in reachable set are dead
  const deadFunctions: FunctionId[] = [];
  for (const [id] of callGraph.nodes) {
    if (!reachable.has(id)) {
      deadFunctions.push(id);
    }
  }

  return deadFunctions;
};
```

---

## 7. Recursive Function Detection

### 7.1 Cycle Detection

Detect recursive and mutually recursive functions:

```typescript
const detectRecursiveFunctions = (
  callGraph: CallGraph
): ReadonlySet<FunctionId> => {
  const recursive = new Set<FunctionId>();
  const visited = new Set<FunctionId>();
  const stack = new Set<FunctionId>();

  const dfs = (functionId: FunctionId): void => {
    if (stack.has(functionId)) {
      // Found cycle - mark all functions in stack as recursive
      recursive.add(functionId);
      return;
    }

    if (visited.has(functionId)) return;
    visited.add(functionId);
    stack.add(functionId);

    const edges = callGraph.edges.get(functionId) ?? [];
    for (const edge of edges) {
      dfs(edge.callee);
    }

    stack.delete(functionId);
  };

  for (const [id] of callGraph.nodes) {
    if (!visited.has(id)) {
      dfs(id);
    }
  }

  return recursive;
};
```

### 7.2 Mutual Recursion Example

**TypeScript:**

```typescript
export function isEven(n: number): boolean {
  if (n === 0) return true;
  return isOdd(n - 1);
}

export function isOdd(n: number): boolean {
  if (n === 0) return false;
  return isEven(n - 1);
}
```

**Call Graph (Cycle Detected):**

```
isEven → isOdd → isEven
```

Both `isEven` and `isOdd` are marked as recursive.

---

## 8. Call Chain Visualization

### 8.1 Call Chain Extraction

Extract call chains from entry point to target function:

```typescript
const findCallChains = (
  callGraph: CallGraph,
  targetFunction: FunctionId
): readonly FunctionId[][] => {
  const chains: FunctionId[][] = [];

  const dfs = (currentFunction: FunctionId, path: FunctionId[]): void => {
    if (path.includes(currentFunction)) {
      return; // Avoid infinite recursion
    }

    const newPath = [...path, currentFunction];

    if (currentFunction === targetFunction) {
      chains.push(newPath);
      return;
    }

    const edges = callGraph.edges.get(currentFunction) ?? [];
    for (const edge of edges) {
      dfs(edge.callee, newPath);
    }
  };

  for (const entryPoint of callGraph.entryPoints) {
    dfs(entryPoint, []);
  }

  return chains;
};
```

### 8.2 Example Output

**Call Chains to `map` function:**

```
main → processUsers → map
main → processOrders → formatOrder → map
```

---

## 9. Cross-Module Analysis

### 9.1 Module-Level Call Graph

Group functions by module for cross-module analysis:

```typescript
type ModuleCallGraph = {
  readonly modules: ReadonlyMap<string, ModuleNode>;
  readonly edges: ReadonlyMap<string, readonly ModuleEdge[]>;
};

type ModuleNode = {
  readonly filePath: string;
  readonly functions: readonly FunctionId[];
};

type ModuleEdge = {
  readonly from: string; // Source module
  readonly to: string; // Target module
  readonly callCount: number; // Number of cross-module calls
};

const buildModuleCallGraph = (callGraph: CallGraph): ModuleCallGraph => {
  const modules = new Map<string, ModuleNode>();
  const edges = new Map<string, ModuleEdge[]>();

  // Group functions by module
  for (const [id, node] of callGraph.nodes) {
    const existing = modules.get(node.module);
    if (existing) {
      modules.set(node.module, {
        ...existing,
        functions: [...existing.functions, id],
      });
    } else {
      modules.set(node.module, {
        filePath: node.module,
        functions: [id],
      });
    }
  }

  // Build cross-module edges
  for (const [callerId, callEdges] of callGraph.edges) {
    const callerNode = callGraph.nodes.get(callerId);
    if (!callerNode) continue;

    for (const edge of callEdges) {
      const calleeNode = callGraph.nodes.get(edge.callee);
      if (!calleeNode) continue;

      // Skip intra-module calls
      if (callerNode.module === calleeNode.module) continue;

      const edgeKey = `${callerNode.module} → ${calleeNode.module}`;
      const existingEdges = edges.get(callerNode.module) ?? [];
      const existingEdge = existingEdges.find(
        (e) => e.from === callerNode.module && e.to === calleeNode.module
      );

      if (existingEdge) {
        const updated = existingEdges.map((e) =>
          e === existingEdge ? { ...e, callCount: e.callCount + 1 } : e
        );
        edges.set(callerNode.module, updated);
      } else {
        edges.set(callerNode.module, [
          ...existingEdges,
          { from: callerNode.module, to: calleeNode.module, callCount: 1 },
        ]);
      }
    }
  }

  return { modules, edges };
};
```

---

## 10. Performance Characteristics

### 10.1 Complexity

**Node Construction:**

- Time: O(F) where F = total functions
- Space: O(F)

**Edge Construction:**

- Time: O(F × S) where S = avg statements per function
- Space: O(E) where E = total call edges

**Reachability Analysis:**

- Time: O(F + E) (DFS traversal)
- Space: O(F)

**Total Complexity:** O(F × S + E)

### 10.2 Timing

**Small Project (50 functions, 200 call sites):**

- Node construction: ~5ms
- Edge construction: ~10ms
- Specialization tracking: ~5ms
- Reachability analysis: ~5ms
- **Total: ~25ms**

**Medium Project (500 functions, 2000 call sites):**

- Node construction: ~20ms
- Edge construction: ~50ms
- Specialization tracking: ~20ms
- Reachability analysis: ~20ms
- **Total: ~110ms**

---

## 11. See Also

- [00-overview.md](00-overview.md) - System architecture
- [06-phase-analysis.md](06-phase-analysis.md) - Dependency analysis
- [07-phase-emitter.md](07-phase-emitter.md) - Specialization and monomorphization
- [05-phase-ir.md](05-phase-ir.md) - IR data structures

---

**Document Statistics:**

- Lines: ~700
- Sections: 11
- Code examples: 15+
- Coverage: Complete call graph construction with specialization tracking and reachability analysis
