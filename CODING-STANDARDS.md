# Coding Standards

This document defines the mandatory coding standards for the Tsonic compiler codebase.

## Core Principles

### Functional Programming Only

All code must follow functional programming principles:

- **NO MUTABLE VARIABLES** - Use `const` exclusively, never `let` or `var`
- **PURE FUNCTIONS** - Functions must not have side effects (except I/O operations)
- **IMMUTABLE DATA STRUCTURES** - Never modify objects/arrays, create new ones
- **NO CLASSES FOR LOGIC** - Use classes only for data structures, never for business logic
- **EXPLICIT OVER IMPLICIT** - All dependencies passed as parameters

```typescript
// ✅ Good - Pure function, immutable
export const addImport = (module: IrModule, importPath: string): IrModule => ({
  ...module,
  imports: [...module.imports, importPath],
});

// ❌ Bad - Mutation
export function addImport(module: IrModule, importPath: string): void {
  module.imports.push(importPath); // NEVER DO THIS
}
```

### Immutability Patterns

```typescript
// ✅ Good - Object spread for updates
const updated = { ...original, field: newValue };

// ✅ Good - Array spread for additions
const newArray = [...oldArray, newItem];

// ✅ Good - Filter for removals
const filtered = items.filter((item) => item.id !== targetId);

// ❌ Bad - Direct mutation
original.field = newValue; // NEVER
array.push(item); // NEVER
delete obj.property; // NEVER
```

## TypeScript Configuration

### Strict Mode Required

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### No Any Types

The `any` type is forbidden. Use proper types or `unknown`.

```typescript
// ✅ Good
export const processValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return JSON.stringify(value);
};

// ❌ Bad
export function processValue(value: any): string {
  return value.toString(); // No type safety
}
```

## Module System

### ESM Modules Only

All imports must include `.js` extension:

```typescript
// ✅ Good
import { IrModule } from "./types/ir.js";
import { parseTypeScript } from "./parser/parser.js";

// ❌ Bad
import { IrModule } from "./types/ir"; // Missing .js
const parser = require("./parser"); // CommonJS
```

### No Dynamic Imports

Static imports only. Never use `await import()`.

```typescript
// ✅ Good
import { emitCSharp } from "./emitter/emit.js";

// ❌ Bad
const emitter = await import("./emitter/emit.js");
```

## Function Design

### Pure Functions Required

Functions must return values, not modify parameters:

```typescript
// ✅ Good - Returns new state
export const resolveImport = (
  importPath: string,
  currentFile: string
): ResolvedImport => {
  const resolved = path.resolve(path.dirname(currentFile), importPath);
  return {
    path: resolved,
    isLocal: importPath.startsWith("."),
  };
};

// ❌ Bad - Side effect
export function resolveImport(
  importPath: string,
  registry: ImportRegistry // Modified in place
): void {
  registry.add(importPath); // Side effect
}
```

### Function Composition

Use function composition over sequential mutations:

```typescript
// ✅ Good - Composition
export const processModule = (source: string): string =>
  pipe(source, parseTypeScript, buildIR, emitCSharp);

// ❌ Bad - Mutations
export function processModule(source: string): string {
  let ast = parseTypeScript(source);
  ast = transform(ast); // Mutation
  const ir = buildIR(ast);
  ir.optimize(); // Method with side effects
  return emitCSharp(ir);
}
```

### Explicit Dependencies

All dependencies must be parameters:

```typescript
// ✅ Good - Explicit config parameter
export const emitModule = (module: IrModule, config: EmitConfig): string => {
  // Use config
};

// ❌ Bad - Hidden global dependency
import { globalConfig } from "./config.js";
export function emitModule(module: IrModule): string {
  // Uses globalConfig implicitly
}
```

## Data Structures

### Discriminated Unions

Use discriminated unions for AST/IR nodes:

```typescript
// ✅ Good
export type IrExpression =
  | { kind: "literal"; value: unknown }
  | { kind: "identifier"; name: string }
  | {
      kind: "binary";
      operator: string;
      left: IrExpression;
      right: IrExpression;
    }
  | { kind: "call"; callee: IrExpression; args: IrExpression[] };

// Type guards
export const isLiteral = (expr: IrExpression): expr is IrLiteral =>
  expr.kind === "literal";
```

### Prefer Type Over Interface

Use `type` for data, `interface` only when needed for extension:

```typescript
// ✅ Good - Type for data
export type IrModule = {
  readonly file: string;
  readonly namespace: string;
  readonly imports: readonly IrImport[];
  readonly exports: readonly IrExport[];
};

// ❌ Bad - Interface for simple data
export interface IrModule {
  file: string;
  namespace: string;
}
```

### Readonly Everything

Mark all properties as readonly:

```typescript
// ✅ Good
export type CompilerOptions = {
  readonly sourceRoot: string;
  readonly outputDir: string;
  readonly namespace: string;
  readonly rid: string;
};

// ❌ Bad - Mutable
export type CompilerOptions = {
  sourceRoot: string; // Can be mutated
  outputDir: string;
};
```

## Error Handling

### Result Types Over Exceptions

Use Result/Either types instead of throwing:

```typescript
// ✅ Good - Result type
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const parseModule = (source: string): Result<IrModule, ParseError> => {
  try {
    const ast = parseTypeScript(source);
    return { ok: true, value: buildIR(ast) };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
};

// ❌ Bad - Throwing
export function parseModule(source: string): IrModule {
  throw new Error("Parse failed"); // Don't throw in library code
}
```

### Diagnostic Collection

Collect all errors, don't fail fast:

```typescript
// ✅ Good - Collect all diagnostics
export type ValidationResult = {
  readonly diagnostics: readonly Diagnostic[];
  readonly hasErrors: boolean;
};

export const validateModule = (module: IrModule): ValidationResult => {
  const diagnostics = [
    ...validateImports(module.imports),
    ...validateExports(module.exports),
    ...validateNamespace(module.namespace),
  ];

  return {
    diagnostics,
    hasErrors: diagnostics.some((d) => d.severity === "error"),
  };
};
```

## File Organization

### Directory Structure

```
packages/
├── cli/
│   └── src/
│       ├── index.ts          # Entry point only
│       └── commands/          # Command handlers (pure functions)
├── frontend/
│   └── src/
│       ├── parser/            # TS → AST
│       ├── ir-builder/        # AST → IR
│       └── types/             # Type definitions
├── emitter/
│   └── src/
│       ├── emit/              # IR → C#
│       └── templates/         # C# code templates
└── runtime/
    ├── Tsonic.Runtime.csproj  # C# class library project
    ├── TsonicRuntime.cs       # C# runtime implementation
    ├── package.json           # npm package (for TypeScript declarations only)
    └── lib/                   # .NET type declarations (per-namespace)
        ├── System.d.ts
        ├── System.IO.d.ts
        ├── System.Collections.Generic.d.ts
        └── ...
```

### File Naming

- **Files**: kebab-case (`ir-builder.ts`)
- **Directories**: kebab-case (`ir-builder/`)
- **Test files**: `*.test.ts`

### Module Exports

One public export per file:

```typescript
// ✅ Good - ir-builder.ts
const helper1 = () => {
  /* ... */
};
const helper2 = () => {
  /* ... */
};

export const buildIR = (ast: TSNode): IrModule => {
  // Uses helpers internally
};

// ❌ Bad - Multiple exports
export const helper1 = () => {
  /* ... */
};
export const helper2 = () => {
  /* ... */
};
export const buildIR = () => {
  /* ... */
};
```

## Testing

### Pure Test Functions

Tests should be pure functions checking values:

```typescript
// ✅ Good - Pure assertion
describe("parseModule", () => {
  it("parses simple module", () => {
    const result = parseModule("export const x = 1;");
    assert.deepEqual(result, {
      ok: true,
      value: {
        exports: [{ kind: "const", name: "x", value: 1 }],
      },
    });
  });
});

// ❌ Bad - Stateful test
let parser: Parser;
beforeEach(() => {
  parser = new Parser(); // Stateful setup
});
```

## Naming Conventions

### Types and Values

- **Types**: PascalCase (`IrModule`, `CompileResult`)
- **Functions**: camelCase (`buildIR`, `emitCSharp`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_DEPTH`, `DEFAULT_RID`)
- **Parameters**: camelCase (`sourceFile`, `outputDir`)

### Abbreviations

Use full words except for common abbreviations:

- ✅ `Intermediate Representation` → `IR`
- ✅ `Abstract Syntax Tree` → `AST`
- ✅ `TypeScript` → `TS`
- ❌ `src` → Use `source`
- ❌ `dest` → Use `destination`
- ❌ `cfg` → Use `config`

## Code Style

### No Comments

Code should be self-documenting:

```typescript
// ✅ Good - Self-documenting
export const isLocalImport = (importPath: string): boolean =>
  importPath.startsWith(".");

// ❌ Bad - Unnecessary comment
export function isLocalImport(importPath: string): boolean {
  // Check if import is local by seeing if it starts with dot
  return importPath.startsWith(".");
}
```

### Early Returns

Use early returns for clarity:

```typescript
// ✅ Good - Early returns
export const resolveImport = (importPath: string): ResolvedImport | null => {
  if (!importPath) return null;
  if (!importPath.endsWith(".ts")) return null;

  return {
    path: resolvePath(importPath),
    isLocal: true,
  };
};

// ❌ Bad - Nested conditions
export function resolveImport(importPath: string): ResolvedImport | null {
  if (importPath) {
    if (importPath.endsWith(".ts")) {
      return {
        path: resolvePath(importPath),
        isLocal: true,
      };
    }
  }
  return null;
}
```

## Security

### No Shell Execution

Never construct shell commands from user input:

```typescript
// ✅ Good - Use spawn with array
import { spawn } from "child_process";

export const runDotnet = (args: readonly string[]): Promise<Result> => {
  const child = spawn("dotnet", args); // Safe
};

// ❌ Bad - Shell injection risk
import { exec } from "child_process";

export function runDotnet(args: string): void {
  exec(`dotnet ${args}`); // NEVER DO THIS
}
```

### Path Validation

Always validate and sanitize paths:

```typescript
// ✅ Good - Validate paths
export const validatePath = (userPath: string): string | null => {
  const normalized = path.normalize(userPath);
  if (normalized.includes("..")) return null;
  if (!normalized.startsWith(process.cwd())) return null;
  return normalized;
};
```

## Performance

### Lazy Evaluation

Build data structures without immediate processing:

```typescript
// ✅ Good - Build IR, process later
export const buildQuery = (operations: Operation[]): Query => ({
  operations,
  evaluate: () => evaluateOperations(operations),
});

// ❌ Bad - Immediate processing
export function buildQuery(operations: Operation[]): ProcessedQuery {
  return processOperations(operations); // Processes immediately
}
```

### Avoid Repeated Computations

Compute once, reuse results:

```typescript
// ✅ Good - Compute once
export const processModules = (modules: readonly IrModule[]): ProcessResult => {
  const namespaceMap = buildNamespaceMap(modules);

  return modules.map((module) => processModule(module, namespaceMap));
};

// ❌ Bad - Recompute each time
export function processModules(modules: IrModule[]): ProcessResult {
  return modules.map((module) => {
    const namespaceMap = buildNamespaceMap(modules); // Rebuilt each iteration
    return processModule(module, namespaceMap);
  });
}
```
