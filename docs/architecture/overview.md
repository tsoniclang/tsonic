# Architecture Overview

High-level view of the Tsonic compiler architecture.

## Design Principles

### 1. Layered Architecture

The compiler is organized into distinct layers with clear boundaries:

```
CLI Layer
    |
    v
Frontend Layer (TypeScript -> IR)
    |
    v
Emitter Layer (IR -> C#)
    |
    v
Backend Layer (C# -> Binary)
```

Each layer:
- Has a single responsibility
- Knows nothing about layers above
- Communicates via well-defined interfaces

### 2. Functional Core

All business logic is pure functional:
- No mutable state
- Functions return values, not modify parameters
- Side effects isolated to boundaries (CLI, I/O)

### 3. Explicit Over Implicit

- All dependencies passed as parameters
- No global state or singletons
- Configuration explicit, not magic

### 4. Error as Values

Errors are returned, not thrown:

```typescript
const result = compile(source);
if (!result.ok) {
  console.log(result.error);
  return;
}
const { value } = result;
```

## Component Overview

### CLI (`packages/cli`)

Command-line interface and orchestration:
- Argument parsing
- Configuration loading
- Command dispatch (init, emit, build, run)
- Error reporting

Entry point for all user interactions.

### Frontend (`packages/frontend`)

TypeScript to IR transformation:
- TypeScript program creation (via TS Compiler API)
- Module resolution
- Import/export validation
- IR building
- Dependency graph construction

### Emitter (`packages/emitter`)

IR to C# code generation:
- Type emission
- Expression emission
- Statement emission
- Generic specialization
- Module/namespace structure

### Backend (`packages/backend`)

.NET compilation:
- .csproj generation
- Program.cs generation
- dotnet CLI wrapper
- Build orchestration

### Runtime (`runtime/`)

C# runtime libraries:
- `Tsonic.Runtime`: Core types and utilities
- `Tsonic.JSRuntime`: JavaScript-compatible collections

## Data Flow

### Compilation Pipeline

```
1. CLI receives: tsonic build src/App.ts

2. Config loaded:
   - tsonic.json parsed
   - CLI args merged
   - Resolved config created

3. Frontend processes:
   - TypeScript program created
   - Source files parsed
   - Imports resolved
   - IR modules built
   - Dependency graph constructed

4. Emitter generates:
   - C# files from IR modules
   - Program.cs entry point
   - tsonic.csproj project file

5. Backend compiles:
   - dotnet restore
   - dotnet publish (NativeAOT)
   - Binary copied to out/
```

### Key Data Structures

**IrModule**: Represents a compiled TypeScript file
```typescript
type IrModule = {
  filePath: string;
  namespace: string;
  className: string;
  imports: IrImport[];
  exports: IrExport[];
  body: IrStatement[];
};
```

**ResolvedConfig**: Merged configuration
```typescript
type ResolvedConfig = {
  rootNamespace: string;
  entryPoint: string;
  sourceRoot: string;
  outputDirectory: string;
  runtime: "js" | "dotnet";
  // ...
};
```

## Error Handling

### Diagnostics

All errors are collected as diagnostics:

```typescript
type Diagnostic = {
  code: string;        // e.g., "TSN1001"
  severity: "error" | "warning";
  message: string;
  location?: SourceLocation;
  suggestion?: string;
};
```

### Diagnostic Codes

| Range | Category |
|-------|----------|
| TSN1xxx | Module resolution |
| TSN2xxx | Syntax/feature support |
| TSN3xxx | Type system |
| TSN4xxx | Code generation |
| TSN5xxx | Build/runtime |

### Error Propagation

Errors bubble up through Result types:

```typescript
const parseResult = parse(source);
if (!parseResult.ok) return parseResult;

const validateResult = validate(parseResult.value);
if (!validateResult.ok) return validateResult;

// Continue with valid data
```

## Extension Points

### Custom Libraries

External .NET library bindings via `--lib`:
- TypeScript declarations describe .NET API
- Compiler resolves types
- Generated code references library

### Output Types

Multiple output configurations:
- Executable (NativeAOT)
- Library (DLL)
- Console app (non-AOT)

### NuGet Integration

Packages specified in config:
- Added to .csproj
- Restored by dotnet
- Available in generated code
