# Compilation Pipeline

Detailed breakdown of each compilation stage.

## Stage Overview

```
Source Files (.ts)
       |
       v
  [1. Program Creation]
       |
       v
  [2. Module Resolution]
       |
       v
  [3. Validation]
       |
       v
  [4. IR Building]
       |
       v
  [5. Dependency Analysis]
       |
       v
  [6. C# Emission]
       |
       v
  [7. Backend Compilation]
       |
       v
  Native Binary
```

## Stage 1: Program Creation

**Package**: `@tsonic/frontend`
**Entry**: `createProgram()`

Creates a TypeScript program using the TS Compiler API:

```typescript
const program = createProgram(filePaths, {
  projectRoot,
  sourceRoot,
  rootNamespace,
  typeRoots,
});
```

Responsibilities:

- Initialize TypeScript compiler
- Configure compiler options
- Load source files
- Resolve type roots

## Stage 2: Module Resolution

**Package**: `@tsonic/frontend`
**Entry**: `resolveImport()`

Resolves import specifiers to actual files:

```typescript
// Local import
"./utils/math.ts" -> "/project/src/utils/math.ts"

// .NET import
"@tsonic/dotnet/System.IO" -> CLR type resolution
```

Rules:

- Local imports MUST have `.ts` extension
- .NET imports map to CLR namespaces
- Relative paths resolved from importing file
- Barrel re-exports followed

## Stage 3: Validation

**Package**: `@tsonic/frontend`
**Entry**: `validateProgram()`

Validates TypeScript code against Tsonic constraints:

### Import Validation

- `.ts` extension required for local imports
- No dynamic imports
- No `import type` syntax

### Feature Validation

- No `with` statements
- No `import.meta`
- No `eval()`
- No `Promise.then/catch/finally`

### Export Validation

- Entry point must export `main()`
- All exports must be valid declarations

### Generic Validation

- Type parameters must be constrained or inferred
- No unsupported generic patterns

## Stage 4: IR Building

**Package**: `@tsonic/frontend`
**Entry**: `buildIrModule()`

Transforms TypeScript AST to Intermediate Representation:

```typescript
const irModule = buildIrModule(sourceFile, checker, options);
```

### Statement Conversion

| TypeScript       | IR Node                  |
| ---------------- | ------------------------ |
| `function foo()` | `IrFunctionDeclaration`  |
| `class Foo`      | `IrClassDeclaration`     |
| `interface Foo`  | `IrInterfaceDeclaration` |
| `const x = 1`    | `IrVariableDeclaration`  |
| `if (cond)`      | `IrIfStatement`          |
| `for (...)`      | `IrForStatement`         |

### Expression Conversion

| TypeScript  | IR Node                  |
| ----------- | ------------------------ |
| `42`        | `IrLiteralExpression`    |
| `foo`       | `IrIdentifierExpression` |
| `a + b`     | `IrBinaryExpression`     |
| `foo()`     | `IrCallExpression`       |
| `new Foo()` | `IrNewExpression`        |
| `obj.prop`  | `IrMemberExpression`     |

### Type Conversion

| TypeScript | IR Type                     |
| ---------- | --------------------------- |
| `number`   | `IrPrimitiveType("number")` |
| `string[]` | `IrArrayType`               |
| `Foo<T>`   | `IrReferenceType`           |
| `A \| B`   | `IrUnionType`               |

## Stage 5: Dependency Analysis

**Package**: `@tsonic/frontend`
**Entry**: `buildModuleDependencyGraph()`

Analyzes module dependencies for compilation order:

```typescript
const { modules, entryModule } = buildModuleDependencyGraph(
  entryPoint,
  compilerOptions
);
```

Responsibilities:

- Traverse import graph
- Detect circular dependencies
- Build compilation order
- Collect all IR modules

## Stage 6: C# Emission

**Package**: `@tsonic/emitter`
**Entry**: `emitCSharpFiles()`

Generates C# code from IR:

```typescript
const { files } = emitCSharpFiles(modules, {
  rootNamespace,
  entryPointPath,
});
```

### Module Structure

```
IrModule (src/utils/Math.ts)
    |
    v
C# File:
  namespace MyApp.src.utils {
    public static class Math {
      // declarations
    }
  }
```

### Type Emission

| IR Type                      | C# Type                              |
| ---------------------------- | ------------------------------------ |
| `primitiveType("number")`    | `double`                             |
| `primitiveType("string")`    | `string`                             |
| `arrayType(T)`               | `T[]` (native array)                 |
| `referenceType("List", [T])` | `System.Collections.Generic.List<T>` |

### Expression Emission

```typescript
// IR: IrBinaryExpression { left, op: "+", right }
// C#: (left) + (right)

// IR: IrCallExpression { callee, args }
// C#: callee(args)
```

## Stage 7: Backend Compilation

**Package**: `@tsonic/backend`
**Entry**: `buildCommand()` (via CLI)

Compiles C# to native binary:

### Step 7a: Generate Project Files

```
generated/
├── src/*.cs          # Emitted C#
├── Program.cs        # Entry wrapper
└── tsonic.csproj     # Project config
```

### Step 7b: dotnet publish

```bash
dotnet publish tsonic.csproj \
  -c Release \
  -r linux-x64 \
  --nologo
```

NativeAOT settings in .csproj:

- `PublishAot=true`
- `PublishSingleFile=true`
- `PublishTrimmed=true`

### Step 7c: Copy Output

```
generated/bin/Release/net10.0/linux-x64/publish/app
    |
    v
out/app
```

## Error Handling

Each stage can produce diagnostics:

```typescript
if (!result.ok) {
  for (const diagnostic of result.error.diagnostics) {
    console.log(`${diagnostic.code}: ${diagnostic.message}`);
  }
}
```

Errors stop the pipeline; warnings continue.
