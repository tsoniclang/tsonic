# Pipeline Flow

## Purpose

This document describes the detailed data flow through Tsonic's compilation pipeline, showing how each phase connects to the next, what data structures are passed between phases, and how errors are propagated.

---

## 1. Pipeline Overview

The Tsonic compiler implements a linear 8-phase pipeline where each phase:

1. Receives immutable input from the previous phase
2. Performs pure transformations
3. Returns either success (with transformed data) or failure (with diagnostics)
4. Does not modify any input data

**No backtracking, no iteration, single-pass processing.**

---

## 2. Phase Sequence

```
Phase 1: Program       TypeScript AST creation
  ↓
Phase 2: Resolver      Import resolution, module graph
  ↓
Phase 3: Validation    ESM rules, feature support
  ↓
Phase 4: IR Builder    TypeScript → IR transformation
  ↓
Phase 5: Analysis      Dependency analysis, symbol table
  ↓
Phase 6: Emitter       IR → C# code generation
  ↓
Phase 7: Backend       C# → NativeAOT executable
  ↓
Phase 8: Runtime       Runtime support (separate package)
```

---

## 3. Detailed Phase Connections

### 3.1 Entry Point → Phase 1 (Program)

**Input:**

```typescript
{
  entryPoint: string;              // "src/main.ts"
  sourceRoot: string;              // "src"
  rootNamespace: string;           // "MyApp"
  typeRoots: readonly string[];    // ["node_modules/@tsonic/dotnet-types/types"]
  strict: boolean;                 // true
  runtime: "js" | "dotnet";        // "js" (default) or "dotnet"
}
```

**Process:**

1. Scan typeRoots for `.d.ts` files recursively
2. Load all source files from sourceRoot
3. Create TypeScript Program with compiler options
4. Load `.metadata.json` files into DotnetMetadataRegistry
5. Load `.bindings.json` files into BindingRegistry

**Output (Success):**

```typescript
type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly metadata: DotnetMetadataRegistry;
  readonly bindings: BindingRegistry;
};
```

**Output (Failure):**

```typescript
type Diagnostic[] = [
  {
    code: "TSN1xxx",
    severity: "error",
    message: "Failed to parse TypeScript",
    file: "src/main.ts",
    line: 10,
    column: 5,
  }
];
```

**Error Halts Pipeline:** Yes - Cannot proceed without valid TypeScript program

---

### 3.2 Phase 1 → Phase 2 (Resolver)

**Input:**

```typescript
{
  program: TsonicProgram;
  entryPoint: string; // "src/main.ts"
  sourceRoot: string; // "src"
  rootNamespace: string; // "MyApp"
}
```

**Process:**

1. Start from entry point file
2. Extract all import statements
3. Resolve each import:
   - Local imports (`.ts` extension required)
   - .NET imports (namespace validation)
   - Module bindings (registry lookup)
4. Recursively process imported files
5. Build dependency graph
6. Compute namespace for each module
7. Compute class name from file name

**Output (Success):**

```typescript
type ResolverResult = {
  readonly moduleGraph: ModuleGraph;
  readonly resolvedModules: ReadonlyMap<string, ResolvedModule>;
};

type ModuleGraph = {
  readonly modules: ReadonlyMap<string, ModuleInfo>;
  readonly dependencies: ReadonlyMap<string, readonly string[]>;
  readonly dependents: ReadonlyMap<string, readonly string[]>;
  readonly entryPoints: readonly string[];
};

type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isDotNet: boolean;
  readonly originalSpecifier: string;
  readonly resolvedClrType?: string;
  readonly resolvedAssembly?: string;
};
```

**Output (Failure):**

```typescript
type Diagnostic[] = [
  {
    code: "TSN1001",
    severity: "error",
    message: "Local import must have .ts extension",
    file: "src/main.ts",
    line: 1,
    column: 24,
    hint: 'Change to: "./utils.ts"',
  }
];
```

**Error Halts Pipeline:** Yes - Cannot build IR without resolved modules

---

### 3.3 Phase 2 → Phase 3 (Validation)

**Input:**

```typescript
{
  program: TsonicProgram;
  moduleGraph: ModuleGraph;
  resolvedModules: ReadonlyMap<string, ResolvedModule>;
}
```

**Process:**

1. **Import Validation:**
   - Verify `.ts` extension on local imports
   - Validate .NET namespace format
   - Check module binding exists

2. **Export Validation:**
   - No default exports (TSN3002)
   - No export-all (TSN3001)
   - Check for name collisions

3. **Feature Validation:**
   - Check for unsupported TypeScript features
   - Validate generic constraints
   - Check for circular dependencies

4. **Generic Constraint Validation:**
   - Structural constraints must be object types
   - No recursive type parameters

**Output (Success):**

```typescript
type ValidationResult = {
  readonly validatedModules: readonly string[];
  readonly warnings: readonly Diagnostic[]; // Non-fatal warnings
};
```

**Output (Failure):**

```typescript
type Diagnostic[] = [
  {
    code: "TSN3002",
    severity: "error",
    message: "Default exports are not supported",
    file: "src/User.ts",
    line: 10,
    column: 1,
    hint: "Use named export instead: export class User {}",
  }
];
```

**Error Halts Pipeline:** Yes - Must be ESM-compliant before IR building

---

### 3.4 Phase 3 → Phase 4 (IR Builder)

**Input:**

```typescript
{
  program: TsonicProgram;
  moduleGraph: ModuleGraph;
  validatedModules: readonly string[];
  resolvedModules: ReadonlyMap<string, ResolvedModule>;
}
```

**Process:**

1. **For each validated module:**
   - Get TypeScript AST (SourceFile)
   - Convert imports → IrImport[]
   - Convert exports → IrExport[]
   - Convert statements → IrStatement[]
   - Infer types using TypeScript checker
   - Resolve CLR bindings from registry
   - Detect override/shadow via metadata
   - Determine if static container needed

2. **Type Conversion:**
   - Primitive types → IrPrimitiveType
   - Type references → IrReferenceType (with type arguments)
   - Arrays → IrArrayType
   - Functions → IrFunctionType
   - Objects → IrObjectType
   - Unions → IrUnionType
   - Intersections → IrIntersectionType

3. **Expression Conversion:**
   - Literals → IrLiteralExpression
   - Identifiers → IrIdentifierExpression (with CLR binding)
   - Member access → IrMemberExpression (with member binding)
   - Calls → IrCallExpression (with type arguments)
   - Binary ops → IrBinaryExpression
   - etc. (35 expression types total)

4. **Statement Conversion:**
   - Variables → IrVariableDeclaration
   - Functions → IrFunctionDeclaration
   - Classes → IrClassDeclaration
   - Interfaces → IrInterfaceDeclaration
   - Control flow → If/While/For/Switch/Try
   - etc. (18 statement types total)

**Output (Success):**

```typescript
type IRBuilderResult = {
  readonly modules: ReadonlyMap<string, IrModule>;
};

type IrModule = {
  readonly kind: "module";
  readonly filePath: string;
  readonly namespace: string;
  readonly className: string;
  readonly isStaticContainer: boolean;
  readonly imports: readonly IrImport[];
  readonly body: readonly IrStatement[];
  readonly exports: readonly IrExport[];
};
```

**Output (Failure):**

```typescript
type Diagnostic[] = [
  {
    code: "TSN4001",
    severity: "error",
    message: "Unsupported type: conditional types",
    file: "src/utils.ts",
    line: 5,
    column: 10,
  }
];
```

**Error Halts Pipeline:** Yes - Cannot emit C# without complete IR

---

### 3.5 Phase 4 → Phase 5 (Analysis)

**Input:**

```typescript
{
  modules: ReadonlyMap<string, IrModule>;
  moduleGraph: ModuleGraph;
}
```

**Process:**

1. **Build Symbol Table:**
   - Extract all exported symbols from each module
   - Map symbol name → module path
   - Track symbol kinds (class, interface, function, etc.)

2. **Dependency Analysis:**
   - Already computed in Phase 2 (ModuleGraph)
   - Detect circular dependencies (DFS algorithm)
   - Compute build order (topological sort)

3. **Type Parameter Collection:**
   - Collect all generic type parameters
   - Identify structural constraints
   - Prepare for adapter generation

**Output (Success):**

```typescript
type AnalysisResult = {
  readonly symbolTable: SymbolTable;
  readonly buildOrder: readonly string[]; // Module paths in dependency order
  readonly circularDeps: readonly string[][]; // Empty if no cycles
};

type SymbolTable = {
  readonly symbols: ReadonlyMap<string, readonly Symbol[]>;
  readonly moduleSymbols: ReadonlyMap<string, readonly Symbol[]>;
  readonly exportedSymbols: ReadonlyMap<string, readonly Symbol[]>;
};

type Symbol = {
  readonly name: string;
  readonly kind:
    | "class"
    | "interface"
    | "function"
    | "variable"
    | "type"
    | "enum";
  readonly isExported: boolean;
  readonly module: string;
  readonly tsSymbol?: ts.Symbol;
};
```

**Output (Failure):**

```typescript
type Diagnostic[] = [
  {
    code: "TSN1006",
    severity: "error",
    message: "Circular dependency detected: A.ts → B.ts → C.ts → A.ts",
    file: "src/A.ts",
  }
];
```

**Error Halts Pipeline:** Yes - Cannot emit with circular dependencies

---

### 3.6 Phase 5 → Phase 6 (Emitter)

**Input:**

```typescript
{
  modules: ReadonlyMap<string, IrModule>;
  symbolTable: SymbolTable;
  buildOrder: readonly string[];
  options: EmitterOptions;
}

type EmitterOptions = {
  readonly rootNamespace: string;
  readonly includeSourceMaps?: boolean;
  readonly indent?: number;
  readonly isEntryPoint?: boolean;
  readonly entryPointPath?: string;
  readonly runtime: "js" | "dotnet";  // Affects code generation
};
```

**Process:**

1. **For each module (in build order):**

   a. **Header Generation:**
   - Copyright notice
   - Auto-generated comment
   - Namespace declaration

   b. **Import Processing:**
   - Collect using statements from imports
   - Deduplicate namespaces
   - Sort alphabetically

   c. **Type Parameter Collection:**
   - Find all generic type parameters
   - Identify structural constraints
   - Generate adapter interfaces
   - Generate wrapper classes

   d. **Specialization Collection:**
   - Find all generic call/new expressions
   - Collect concrete type arguments
   - Generate specialized functions
   - Rewrite call sites

   e. **Generator Exchange Generation:**
   - Find async generators
   - Generate exchange classes for state management

   f. **Statement Separation:**
   - Namespace-level declarations (classes, interfaces)
   - Static container members (functions, constants)

   g. **Emission:**
   - Emit namespace declarations
   - Emit static container (if needed)
   - Emit entry point Main method (if entry point)

   h. **Assembly:**
   - Combine using statements
   - Combine body
   - Format with indentation

2. **Type Emission:**
   - `string` → `string`
   - `number` → `double`
   - `boolean` → `bool`
   - `T[]` → `List<T>`
   - `(a: A) => B` → `Func<A, B>`
   - etc.

3. **Expression Emission:**
   - Literals → C# literals
   - Identifiers → C# identifiers (with CLR binding)
   - Member access → `.` or `[]` with binding resolution
   - Calls → Method/function calls with type arguments
   - Binary operators → C# operators (=== → Equals)
   - Template literals → String interpolation
   - etc.

4. **Statement Emission:**
   - Variables → `readonly` (const) or `var` (let)
   - Functions → Static methods
   - Classes → C# classes with members
   - Interfaces → C# interfaces
   - Control flow → Direct C# mapping
   - etc.

**Output (Success):**

```typescript
type EmitterResult = {
  readonly emittedFiles: ReadonlyMap<string, EmittedFile>;
};

type EmittedFile = {
  readonly filePath: string; // Generated/MyApp/models/User.cs
  readonly content: string; // C# source code
  readonly sourceMap?: SourceMap; // Optional source map
};
```

**Output (Failure):**

```typescript
type Diagnostic[] = [
  {
    code: "TSN4002",
    severity: "error",
    message: "Cannot emit union type with non-primitive types",
    file: "src/types.ts",
    line: 10,
    column: 15,
  }
];
```

**Error Halts Pipeline:** Yes - Cannot build without valid C# code

---

### 3.7 Phase 6 → Phase 7 (Backend)

**Input:**

```typescript
{
  emittedFiles: ReadonlyMap<string, EmittedFile>;
  buildConfig: BuildConfig;
}

type BuildConfig = {
  readonly rootNamespace: string;
  readonly outputName: string;
  readonly dotnetVersion: string; // "net10.0"
  readonly runtimePath?: string;
  readonly packages: readonly NuGetPackage[];
  readonly outputConfig: ExecutableConfig | LibraryConfig;
};

type ExecutableConfig = {
  readonly type: "executable";
  readonly nativeAot: boolean;
  readonly singleFile: boolean;
  readonly trimmed: boolean;
  readonly stripSymbols: boolean;
  readonly optimization: "Size" | "Speed";
  readonly invariantGlobalization: boolean;
};

type NuGetPackage = {
  readonly name: string;
  readonly version: string;
};
```

**Process:**

1. **Preparation:**
   - Check dotnet is installed (`dotnet --version`)
   - Detect runtime identifier (linux-x64, win-x64, osx-arm64)
   - Create build directory: `.tsonic/build/<hash>/`

2. **File Generation:**
   - Copy all emitted C# files to build directory
   - Generate Program.cs (if entry point needs wrapper)
   - Generate .csproj with:
     - Target framework
     - NativeAOT properties
     - Optimization settings
     - NuGet package references

3. **.csproj Content:**

   ```xml
   <Project Sdk="Microsoft.NET.Sdk">
     <PropertyGroup>
       <OutputType>Exe</OutputType>
       <TargetFramework>net10.0</TargetFramework>
       <RootNamespace>MyApp</RootNamespace>
       <AssemblyName>myapp</AssemblyName>

       <PublishAot>true</PublishAot>
       <PublishSingleFile>true</PublishSingleFile>
       <PublishTrimmed>true</PublishTrimmed>
       <InvariantGlobalization>true</InvariantGlobalization>
       <StripSymbols>true</StripSymbols>

       <OptimizationPreference>Speed</OptimizationPreference>
       <IlcOptimizationPreference>Speed</IlcOptimizationPreference>
     </PropertyGroup>

     <ItemGroup>
       <!-- Only included when runtime: "js" -->
       <PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
     </ItemGroup>
   </Project>
   ```

4. **Compilation:**
   - Execute: `dotnet publish tsonic.csproj -c Release -r <rid> --nologo`
   - Capture stdout/stderr
   - Check exit code

5. **Post-Build:**
   - Copy binary from `bin/Release/net10.0/<rid>/publish/` to project root
   - Make executable (chmod +x on Unix)
   - Clean build directory (unless keepTemp)

**Output (Success):**

```typescript
type BuildResult = {
  readonly binaryPath: string; // "./myapp" or "./myapp.exe"
  readonly buildLog: string; // dotnet output
  readonly buildTime: number; // milliseconds
};
```

**Output (Failure):**

```typescript
type Diagnostic[] = [
  {
    code: "TSN5001",
    severity: "error",
    message: "NativeAOT compilation failed: CS0103: The name 'invalid' does not exist",
    file: "Generated/MyApp/main.cs",
    line: 15,
    column: 5,
  }
];
```

**Error Halts Pipeline:** Yes - Compilation failure

---

### 3.8 Phase 7 → Phase 8 (Runtime)

**Note:** Phase 8 (Runtime) is not part of the compilation pipeline but rather a separate package that provides runtime support.

**Runtime Package:** `Tsonic.Runtime` (C# library)

**Provided APIs:**

- **Array static methods:** `push`, `pop`, `shift`, `unshift`, `slice`, `splice`, `map`, `filter`, `reduce`, `find`, `some`, `every`, `join`, etc.
- **String static methods:** `toUpperCase`, `toLowerCase`, `substring`, `indexOf`, `split`, `trim`, etc.
- **Math static methods:** `abs`, `ceil`, `floor`, `round`, `sqrt`, `pow`, `min`, `max`, etc.
- **JSON static methods:** `parse`, `stringify`
- **console static methods:** `log`, `error`, `warn`, `info`

**Integration:**

- Runtime is referenced as NuGet package in .csproj
- Compiled into final binary
- No runtime dependencies after compilation

---

## 4. Error Propagation

### 4.1 Error Flow

**Any Phase Failure:**

```
Phase N (failed)
  ↓
Diagnostic[] returned
  ↓
Pipeline halts
  ↓
CLI formats diagnostics
  ↓
Display to user
  ↓
Exit with code 1
```

**No recovery, no fallback, fail fast.**

### 4.2 Diagnostic Enrichment

Each phase may add context to diagnostics:

```typescript
// Phase 1 creates diagnostic
{
  code: "TSN1001",
  message: "Missing .ts extension",
  file: "src/main.ts",
  line: 5,
  column: 8,
}

// Phase 3 adds hint
{
  code: "TSN1001",
  message: "Missing .ts extension",
  file: "src/main.ts",
  line: 5,
  column: 8,
  hint: 'Change to: "./utils.ts"',  // Added by validator
}
```

### 4.3 Warning vs Error

**Warnings:**

- Do NOT halt pipeline
- Displayed to user
- Can be suppressed via configuration

**Errors:**

- ALWAYS halt pipeline
- Must be fixed before proceeding
- Cannot be suppressed

---

## 5. Data Structure Summary

### 5.1 Phase Data Structures

| Phase          | Input Types                          | Output Types                                           |
| -------------- | ------------------------------------ | ------------------------------------------------------ |
| **Program**    | File paths, config                   | TsonicProgram, DotnetMetadataRegistry, BindingRegistry |
| **Resolver**   | TsonicProgram, entry point           | ModuleGraph, ResolvedModule[]                          |
| **Validation** | ModuleGraph, program                 | Validated module paths, warnings                       |
| **IR Builder** | TsonicProgram, ModuleGraph           | IrModule[]                                             |
| **Analysis**   | IrModule[], ModuleGraph              | SymbolTable, build order                               |
| **Emitter**    | IrModule[], SymbolTable, build order | EmittedFile[]                                          |
| **Backend**    | EmittedFile[], BuildConfig           | Binary path                                            |

### 5.2 Shared Data Structures

**Throughout Pipeline:**

- `TsonicProgram` - Passed from Phase 1 through Phase 4
- `ModuleGraph` - Created in Phase 2, used through Phase 5
- `IrModule[]` - Created in Phase 4, used in Phase 5-6

**Immutability:**

- All data structures are readonly
- No phase modifies data from previous phases
- New data created via spread/map/filter

---

## 6. Performance Characteristics

### 6.1 Phase Timing (Medium Project)

```
Phase 1 (Program):     ~200ms  (TypeScript parsing dominates)
Phase 2 (Resolver):    ~100ms  (File I/O, graph building)
Phase 3 (Validation):  ~50ms   (AST traversal)
Phase 4 (IR Builder):  ~300ms  (AST → IR conversion, type inference)
Phase 5 (Analysis):    ~50ms   (Graph algorithms)
Phase 6 (Emitter):     ~200ms  (String building, specialization)
Phase 7 (Backend):     ~30s    (dotnet compilation dominates)

Total (without backend): ~900ms
Total (with backend):    ~30s
```

### 6.2 Memory Usage

**Peak Memory by Phase:**

```
Phase 1 (Program):     ~50MB   (TypeScript ASTs)
Phase 4 (IR Builder):  ~100MB  (TypeScript ASTs + IR)
Phase 6 (Emitter):     ~80MB   (IR + generated strings)
Phase 7 (Backend):     ~500MB  (dotnet compiler process)
```

**Memory is released after each phase completes.**

---

## 7. Parallelization Opportunities (Future)

### 7.1 Current Limitations

- Single-threaded pipeline
- Sequential phase execution
- One module at a time

### 7.2 Future Parallelization

**Phase 4 (IR Builder):**

- Each module can be processed independently
- Potential for N-way parallelism where N = CPU cores
- Requires thread-safe TypeScript checker

**Phase 5 (Analysis):**

- Symbol table building can be parallelized per module
- Dependency analysis must remain sequential

**Phase 6 (Emitter):**

- Each module can be emitted independently
- Potential for N-way parallelism
- Specialization must be coordinated

---

## 8. Debugging and Observability

### 8.1 Logging Points

**Each phase should log:**

- Phase start timestamp
- Input data summary
- Key decisions made
- Output data summary
- Phase end timestamp
- Total phase time

**Example:**

```
[Program] Starting...
[Program] Loading 45 source files
[Program] Creating TypeScript program
[Program] Loading metadata from 12 assemblies
[Program] ✓ Complete in 234ms

[Resolver] Starting...
[Resolver] Entry point: src/main.ts
[Resolver] Resolving imports...
[Resolver] Built graph with 45 modules, 120 dependencies
[Resolver] ✓ Complete in 102ms
```

### 8.2 Intermediate Artifacts

**For debugging, optionally save:**

- Phase 1: TypeScript ASTs (JSON)
- Phase 2: Module graph (DOT format)
- Phase 4: IR modules (JSON)
- Phase 5: Symbol table (JSON)
- Phase 6: Generated C# files (already saved)
- Phase 7: Build logs (already saved)

---

## 9. See Also

- [00-overview.md](00-overview.md) - System architecture overview
- [02-phase-program.md](02-phase-program.md) - Program creation details
- [03-phase-resolver.md](03-phase-resolver.md) - Module resolution details
- [04-phase-validation.md](04-phase-validation.md) - Validation rules
- [05-phase-ir-builder.md](05-phase-ir-builder.md) - IR building details
- [06-phase-analysis.md](06-phase-analysis.md) - Dependency analysis
- [07-phase-emitter.md](07-phase-emitter.md) - C# emission details
- [08-phase-backend.md](08-phase-backend.md) - NativeAOT build details

---

**Document Statistics:**

- Lines: ~790
- Sections: 9 major sections
- Phase connections: 7 detailed
- Data flow diagrams: 8
- Coverage: Complete pipeline flow, error propagation, performance characteristics
