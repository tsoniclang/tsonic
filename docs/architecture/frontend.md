# Frontend Package

The frontend transforms TypeScript into IR.

## Entry Points

### buildModuleDependencyGraph

Main entry for compiling a project:

```typescript
const result = buildModuleDependencyGraph(entryPoint, {
  projectRoot: "/path/to/project",
  sourceRoot: "src",
  rootNamespace: "MyApp",
  typeRoots: ["node_modules/@tsonic/js-globals"],
});

if (result.ok) {
  const { modules, entryModule } = result.value;
}
```

### createProgram

Lower-level TypeScript program creation:

```typescript
const result = createProgram(filePaths, options);
if (result.ok) {
  const program = result.value;
}
```

## Module Resolution

### Local Imports

Local imports must have `.ts` extension:

```typescript
// Resolved from importing file's directory
"./utils.ts" -> resolved to absolute path
"../models/User.ts" -> resolved relative
```

Resolution in `resolver/path-resolution.ts`:

```typescript
const resolveLocalImport = (
  specifier: string,
  importingFile: string,
  sourceRoot: string
): Result<string, Diagnostic> => {
  // Must have .ts extension
  if (!specifier.endsWith(".ts")) {
    return error(createDiagnostic("TSN1001", ...));
  }
  // Resolve to absolute path
  const resolved = path.resolve(path.dirname(importingFile), specifier);
  return ok(resolved);
};
```

### .NET Imports

.NET imports map to CLR namespaces:

```typescript
"@tsonic/dotnet/System" -> clrNamespace: "System"
"@tsonic/dotnet/System.IO" -> clrNamespace: "System.IO"
```

Resolution via `clrResolver`:

```typescript
const resolveClrImport = (
  specifier: string
): Result<ClrResolution, Diagnostic> => {
  // Extract namespace from specifier
  const namespace = specifier
    .replace("@tsonic/dotnet/", "")
    .replace(/\//g, ".");
  return ok({ clrNamespace: namespace, isLocal: false });
};
```

## Validation

### Import Validation

`validation/imports.ts`:

- Verify `.ts` extension on local imports
- No dynamic imports
- Resolve all import specifiers
- Check module existence

### Feature Validation

`validation/features.ts`:

```typescript
const unsupportedFeatures = [
  "with statement",
  "import.meta",
  "dynamic import()",
  "Promise.then/catch/finally",
];
```

`validation/unsupported-utility-types.ts`:

Validates that unsupported utility types are not used:

- TSN7406: Mapped types (Partial, Required, Readonly, Pick, Omit)
- TSN7407: Conditional types (Extract, Exclude, NonNullable, ReturnType)
- TSN7410: Intersection types (A & B)

### Export Validation

`validation/exports.ts`:

- Entry point must export `main()`
- Exported names must resolve
- Re-exports must be valid

## IR Building

### Statement Conversion

`ir/converters/statements/`:

```typescript
// TypeScript AST -> IR
const convertStatement = (
  node: ts.Statement,
  checker: ts.TypeChecker
): IrStatement => {
  if (ts.isFunctionDeclaration(node)) {
    return convertFunctionDeclaration(node, checker);
  }
  if (ts.isClassDeclaration(node)) {
    return convertClassDeclaration(node, checker);
  }
  // ... other statements
};
```

### Expression Conversion

`ir/converters/expressions/`:

```typescript
const convertExpression = (
  node: ts.Expression,
  checker: ts.TypeChecker
): IrExpression => {
  if (ts.isNumericLiteral(node)) {
    return { kind: "literal", value: Number(node.text), raw: node.text };
  }
  if (ts.isBinaryExpression(node)) {
    return convertBinaryExpression(node, checker);
  }
  // ... other expressions
};
```

### Anonymous Object Synthesis

`ir/converters/anonymous-synthesis.ts`:

Object literals without explicit type annotations auto-synthesize nominal types:

```typescript
// Input: const point = { x: 10, y: 20 };
// Synthesizes: class __Anon_File_Line_Col with x, y properties
```

Eligible patterns: property assignments, shorthand properties, arrow functions.
Ineligible patterns: method shorthand, getters/setters.

### Type Conversion

`ir/type-converter/`:

```typescript
const convertType = (node: ts.TypeNode, checker: ts.TypeChecker): IrType => {
  if (ts.isTypeReferenceNode(node)) {
    return convertReferenceType(node, checker);
  }
  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "arrayType",
      elementType: convertType(node.elementType, checker),
    };
  }
  // ... other types
};
```

`ir/type-converter/inference.ts`:

Lambda parameter types are contextually inferred from surrounding context:

```typescript
// numbers.map(n => n * 2)
// 'n' type is inferred from array element type
```

Uses `checker.getContextualType()` to extract types from call expressions.

## Dependency Graph

### Graph Building

`program/dependency-graph.ts`:

```typescript
const buildDependencyGraph = (
  entryPoint: string,
  options: CompilerOptions
): Result<DependencyGraph, Diagnostic[]> => {
  const visited = new Set<string>();
  const modules: IrModule[] = [];

  const visit = (filePath: string) => {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const module = buildIrModule(filePath, ...);
    modules.push(module);

    // Visit imports
    for (const imp of module.imports) {
      if (imp.resolved?.isLocal) {
        visit(imp.resolved.absolutePath);
      }
    }
  };

  visit(entryPoint);
  return ok({ modules, entryModule: modules[0] });
};
```

### Circular Dependency Detection

```typescript
const detectCircular = (modules: IrModule[]): string[][] => {
  // Tarjan's algorithm for SCC detection
  // Returns groups of circular dependencies
};
```

## Symbol Table

### Symbol Tracking

`symbol-table/`:

```typescript
type SymbolEntry = {
  name: string;
  kind: "variable" | "function" | "class" | "interface" | "type";
  type?: IrType;
  exported: boolean;
};

type SymbolTable = {
  entries: Map<string, SymbolEntry>;
  parent?: SymbolTable;
};
```

### Symbol Resolution

```typescript
const resolveSymbol = (
  name: string,
  table: SymbolTable
): SymbolEntry | undefined => {
  const entry = table.entries.get(name);
  if (entry) return entry;
  if (table.parent) return resolveSymbol(name, table.parent);
  return undefined;
};
```

## Diagnostics

### Creating Diagnostics

```typescript
import { createDiagnostic, addDiagnostic } from "./types/diagnostic.js";

const diagnostic = createDiagnostic(
  "TSN1001",
  "error",
  "Local imports must use .ts extension",
  { file: sourceFile.fileName, line: 10, column: 5, length: 20 },
  "Add .ts extension to import path"
);

collector = addDiagnostic(collector, diagnostic);
```

### Diagnostic Codes

| Code    | Category | Description           |
| ------- | -------- | --------------------- |
| TSN1001 | Module   | Missing .ts extension |
| TSN1002 | Module   | Cannot resolve module |
| TSN2001 | Feature  | Unsupported feature   |
| TSN3001 | Type     | Type error            |
