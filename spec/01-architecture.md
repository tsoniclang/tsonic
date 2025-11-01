# System Architecture

## Compilation Pipeline

```
TypeScript Source (.ts files)
    ↓
[Frontend] TypeScript Parser (TS Compiler API)
    ↓
[Frontend] ESM Validator & Module Indexer
    ↓
[Frontend] IR Builder
    ↓
Intermediate Representation (IR)
    ↓
[Emitter] C# Code Generator
    ↓
C# Source Files (.cs)
    ↓
[Backend] dotnet CLI Orchestrator
    ↓
NativeAOT Executable
```

## Component Responsibilities

### 1. CLI (`packages/cli`)

**Purpose**: Command-line interface and orchestration

**Key Modules**:

- `index.ts`: Command router
- `commands/emit.ts`: TS → C# emission only
- `commands/build.ts`: Full compilation to NativeAOT
- `commands/run.ts`: Build and execute
- `services/config.ts`: Read package.json configuration
- `services/logging.ts`: Structured logging & diagnostics

### 2. Frontend (`packages/frontend`)

**Purpose**: Parse TypeScript and build IR

**Key Modules**:

- `program.ts`: Create TypeScript program, get type checker
- `irBuilder.ts`: Convert TypeScript AST to IR
- `symbolTable.ts`: Global symbol registry and binding
- `resolver.ts`: ESM module resolution with extension validation
- `diagnostics.ts`: Collect and format errors

**Data Flow**:

1. Create TS Program from entry file
2. Walk import graph, validate ESM rules
3. Build module index (file → namespace/class mapping)
4. Generate IR for each module
5. Link symbols across modules

### 3. Emitter (`packages/emitter`)

**Purpose**: Transform IR to C# source code

**Key Modules**:

- `emitCs.ts`: Main emission pipeline
- `csTemplates.ts`: C# code templates (classes, methods, using statements)
- `naming.ts`: Name sanitization and keyword handling
- `typeMap.ts`: TypeScript → C# type conversions

**Emission Rules**:

- One `.cs` file per `.ts` file
- Preserve directory structure
- Generate using statements for both .NET and local dependencies

### 4. Backend (`packages/backend`)

**Purpose**: Drive dotnet CLI to produce executables

**Key Modules**:

- `dotnet.ts`: Execute dotnet commands (new, publish)
- `files.ts`: Manage temporary build directories

**Workflow**:

1. Create temporary project directory
2. Generate minimal .csproj with NativeAOT settings and Tsonic.Runtime package reference
3. Copy generated C# files
4. Generate Program.cs if needed
5. Execute `dotnet publish` (restores Tsonic.Runtime from NuGet)
6. Copy output binary

### 5. Runtime (`packages/runtime`)

**Purpose**: JavaScript/TypeScript runtime implementation in C#

**Structure**: C# class library project published as NuGet package

**Key Files**:

- `Tsonic.Runtime.csproj`: C# class library project file
- `TsonicRuntime.cs`: Core runtime implementation (Array, String, console, Math, etc.)
- `lib/System.d.ts`, `lib/System.IO.d.ts`, etc.: TypeScript declarations for .NET types (per-namespace)

**Distribution**: Published as NuGet package `Tsonic.Runtime`, consumed via PackageReference in generated projects

## Intermediate Representation (IR)

### IR Design Principles

1. **Language-agnostic**: Could emit other languages in future
2. **Type-preserving**: Maintains TypeScript type information
3. **Symbol-linked**: Cross-references resolved during IR building
4. **Serializable**: Can be saved/loaded as JSON for debugging

### Core IR Types

```typescript
interface IrModule {
  file: string; // Source file path
  namespace: string; // C# namespace
  fileClass: string; // C# class name
  imports: IrImport[]; // Local imports
  dotnetUsings: string[]; // .NET namespace imports
  exports: IrDeclaration[]; // Exported declarations
  topLevel: IrStatement[]; // Top-level executable code
}

interface IrClass {
  kind: "Class";
  name: string;
  modifiers: string[]; // public, static, etc.
  extends?: IrTypeRef;
  implements: IrTypeRef[];
  constructors: IrConstructor[];
  properties: IrProperty[];
  methods: IrMethod[];
}

interface IrFunction {
  kind: "Function";
  name: string;
  async: boolean;
  params: IrParameter[];
  returnType: IrType;
  body: IrStatement[];
}

type IrExpression =
  | IrLiteral
  | IrIdentifier
  | IrMemberAccess
  | IrCall
  | IrNew
  | IrBinary
  | IrUnary
  | IrConditional
  | IrArray
  | IrObject;

type IrStatement =
  | IrReturn
  | IrIf
  | IrWhile
  | IrFor
  | IrExpression
  | IrVariableDecl
  | IrBlock;
```

## Error Handling Strategy

### Compilation Phases

1. **Parse Phase**: TypeScript syntax errors
2. **Validation Phase**: ESM rule violations, import errors
3. **IR Building Phase**: Type resolution, symbol binding
4. **Emission Phase**: C# generation issues
5. **Build Phase**: dotnet CLI errors

### Error Collection

- Each phase accumulates diagnostics
- Errors include: code, message, file, line, column
- Continue processing to find multiple errors
- Halt at phase boundary if errors exist

## Memory & Performance Considerations

### Scalability Targets

- Handle projects up to 10,000 TypeScript files
- Compile time < 1 second per 100 files (excluding dotnet publish)
- Memory usage < 1GB for large projects

### Optimization Points

1. **Parallel Processing**: Parse multiple files concurrently
2. **Incremental Compilation**: Cache IR for unchanged files (future)
3. **Lazy Symbol Resolution**: Defer type checking until needed
4. **Streaming Emission**: Write C# files as generated

## Extension Points

### Future Extensibility

1. **Additional Target Languages**: IR could emit Go, Rust, etc.
2. **Custom Type Mappings**: User-defined TS → C# conversions
3. **Decorator Support**: Map TS decorators to C# attributes
4. **Source Maps**: Map C# lines back to TypeScript

### Plugin Architecture (Future)

- Transform hooks at IR level
- Custom emission templates
- Additional runtime implementations
