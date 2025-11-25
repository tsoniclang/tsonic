# Phase 1: Program Creation

## Purpose

This phase creates a TypeScript Program using the TypeScript Compiler API, loads type declarations, and initializes the metadata and binding registries needed for .NET interop.

---

## 1. Overview

**Responsibility:** Create TypeScript program with type checker and load .NET metadata

**Package:** `@tsonic/frontend`

**Location:** `packages/frontend/src/program/`

**Input:** Entry point file path, compiler options

**Output:** `TsonicProgram` with TypeScript AST, type checker, metadata registry, and binding registry

---

## 2. Key Files

```
packages/frontend/src/program/
├── creation.ts           # Main program creation logic
├── config.ts            # TypeScript compiler configuration
├── types.ts             # Type definitions
├── diagnostics.ts       # Diagnostic collection
├── metadata.ts          # .NET metadata loading
├── bindings.ts          # Binding manifest loading
└── queries.ts           # Program query functions
```

---

## 3. Data Structures

### 3.1 TsonicProgram

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

**Fields:**

- **program** - TypeScript Program instance from ts.createProgram()
- **checker** - TypeScript type checker for type inference
- **options** - Compiler options used (strict mode, target, etc.)
- **sourceFiles** - All source files in the program
- **metadata** - Registry of .NET type metadata (.metadata.json files)
- **bindings** - Registry of TypeScript → CLR name mappings (.bindings.json files)

### 3.2 CompilerOptions

```typescript
type CompilerOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly strict?: boolean;
  readonly typeRoots?: readonly string[];
  readonly target?: ts.ScriptTarget;
  readonly module?: ts.ModuleKind;
  readonly mode?: "dotnet" | "js";
};
```

**Default Values:**

- `strict`: true
- `typeRoots`: `["node_modules/@types"]`
- `target`: ES2022
- `module`: ESNext
- `mode`: "dotnet"

---

## 4. Algorithm

### 4.1 Program Creation

```typescript
const createTsonicProgram = (
  entryPoint: string,
  options: CompilerOptions
): Result<TsonicProgram, Diagnostic[]> => {
  // 1. Scan for declaration files
  const declarationFiles = scanDeclarationFiles(options.typeRoots);

  // 2. Collect source files
  const sourceFiles = [entryPoint, ...declarationFiles];

  // 3. Create TypeScript compiler options
  const compilerOptions: ts.CompilerOptions = {
    strict: options.strict ?? true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    esModuleInterop: true,
    skipLibCheck: false,
    noEmit: true,
    typeRoots: options.typeRoots,
  };

  // 4. Create TypeScript program
  const program = ts.createProgram({
    rootNames: sourceFiles,
    options: compilerOptions,
  });

  // 5. Get type checker
  const checker = program.getTypeChecker();

  // 6. Check for parse errors
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    return error(convertDiagnostics(diagnostics));
  }

  // 7. Load metadata registry
  const metadata = loadMetadataRegistry(options.typeRoots);

  // 8. Load binding registry
  const bindings = loadBindingRegistry(options.typeRoots);

  // 9. Return TsonicProgram
  return ok({
    program,
    checker,
    options,
    sourceFiles: program.getSourceFiles(),
    metadata,
    bindings,
  });
};
```

### 4.2 Declaration File Scanning

```typescript
const scanDeclarationFiles = (
  typeRoots: readonly string[]
): readonly string[] => {
  const files: string[] = [];

  for (const root of typeRoots) {
    // Recursively find all .d.ts files
    const dtsFiles = glob.sync("**/*.d.ts", {
      cwd: root,
      absolute: true,
      nodir: true,
    });

    files.push(...dtsFiles);
  }

  return files;
};
```

**Example:**

```
typeRoots: ["node_modules/@tsonic/dotnet-types/types"]

Scans:
  node_modules/@tsonic/dotnet-types/types/System/index.d.ts
  node_modules/@tsonic/dotnet-types/types/System.IO/index.d.ts
  node_modules/@tsonic/dotnet-types/types/System.Collections.Generic/index.d.ts
  ...
```

---

## 5. Metadata Loading

### 5.1 DotnetMetadataRegistry

```typescript
class DotnetMetadataRegistry {
  private readonly metadata: Map<string, DotnetTypeMetadata>;

  loadMetadataFile(filePath: string, content: DotnetMetadataFile): void;
  getTypeMetadata(qualifiedName: string): DotnetTypeMetadata | undefined;
  getMemberMetadata(
    qualifiedTypeName: string,
    memberSignature: string
  ): DotnetMemberMetadata | undefined;
  isVirtualMember(qualifiedTypeName: string, memberSignature: string): boolean;
  isSealedMember(qualifiedTypeName: string, memberSignature: string): boolean;
}
```

### 5.2 Metadata File Format

```json
{
  "version": "1.0",
  "assembly": "System.Private.CoreLib",
  "types": {
    "System.String": {
      "kind": "class",
      "isSealed": true,
      "members": {
        "ToUpper()": {
          "kind": "method",
          "isStatic": false,
          "virtual": false
        },
        "Concat(string,string)": {
          "kind": "method",
          "isStatic": true,
          "virtual": false
        }
      }
    }
  }
}
```

### 5.3 Loading Algorithm

```typescript
const loadMetadataRegistry = (
  typeRoots: readonly string[]
): DotnetMetadataRegistry => {
  const registry = new DotnetMetadataRegistry();

  for (const root of typeRoots) {
    // Find all .metadata.json files
    const metadataFiles = glob.sync("**/*.metadata.json", {
      cwd: root,
      absolute: true,
    });

    for (const file of metadataFiles) {
      const content = JSON.parse(fs.readFileSync(file, "utf-8"));
      registry.loadMetadataFile(file, content);
    }
  }

  return registry;
};
```

---

## 6. Binding Loading

### 6.1 BindingRegistry

```typescript
class BindingRegistry {
  private readonly simpleBindings: Map<string, SimpleBindingDescriptor>;
  private readonly namespaces: Map<string, NamespaceBinding>;
  private readonly types: Map<string, TypeBinding>;
  private readonly members: Map<string, MemberBinding>;

  addBindings(filePath: string, manifest: BindingFile): void;
  getBinding(name: string): SimpleBindingDescriptor | undefined;
  getNamespace(tsAlias: string): NamespaceBinding | undefined;
  getType(tsAlias: string): TypeBinding | undefined;
  getMember(typeAlias: string, memberAlias: string): MemberBinding | undefined;
}
```

### 6.2 Binding File Format

**Hierarchical Format:**

```json
{
  "version": "2.0",
  "assembly": "System.Private.CoreLib",
  "namespaces": [
    {
      "name": "System",
      "alias": "System",
      "types": [
        {
          "name": "String",
          "alias": "String",
          "kind": "class",
          "members": [
            {
              "kind": "method",
              "name": "ToUpper",
              "alias": "toUpperCase",
              "binding": {
                "assembly": "System.Private.CoreLib",
                "type": "System.String",
                "member": "ToUpper"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Legacy Simple Format:**

```json
{
  "bindings": {
    "console": {
      "kind": "module",
      "assembly": "Tsonic.Runtime",
      "type": "Tsonic.Runtime.console"
    }
  }
}
```

### 6.3 Loading Algorithm

```typescript
const loadBindingRegistry = (typeRoots: readonly string[]): BindingRegistry => {
  const registry = new BindingRegistry();

  for (const root of typeRoots) {
    // Find all .bindings.json files
    const bindingFiles = glob.sync("**/*.bindings.json", {
      cwd: root,
      absolute: true,
    });

    for (const file of bindingFiles) {
      const content = JSON.parse(fs.readFileSync(file, "utf-8"));
      registry.addBindings(file, content);
    }
  }

  return registry;
};
```

---

## 7. TypeScript Compiler Configuration

### 7.1 Compiler Options

```typescript
const createCompilerOptions = (
  options: CompilerOptions
): ts.CompilerOptions => ({
  // Module system
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,

  // Strict type checking
  strict: options.strict ?? true,
  noImplicitAny: true,
  strictNullChecks: true,
  strictFunctionTypes: true,
  strictPropertyInitialization: true,

  // Interop
  esModuleInterop: true,
  allowSyntheticDefaultImports: false,

  // Type roots
  typeRoots: options.typeRoots ?? ["node_modules/@tsonic/dotnet-types/types"],

  // Output
  noEmit: true,
  skipLibCheck: false,
});
```

### 7.2 Why These Settings?

**target: ES2022**

- Modern JavaScript features (async/await, class fields, etc.)
- Closer to C# semantics

**module: ESNext**

- Native ESM support
- Enforces `.ts` extension requirement

**strict: true**

- Catches type errors early
- Better C# generation

**noEmit: true**

- We only need type checking
- C# generation is separate

**skipLibCheck: false**

- Validate .NET type declarations
- Catch incompatibilities early

---

## 8. Diagnostic Collection

### 8.1 TypeScript Diagnostics

```typescript
const collectDiagnostics = (program: ts.Program): readonly ts.Diagnostic[] => {
  // Syntax errors
  const syntactic = program.getSyntacticDiagnostics();

  // Semantic errors (type errors)
  const semantic = program.getSemanticDiagnostics();

  // Declaration file errors
  const declaration = program.getDeclarationDiagnostics();

  return [...syntactic, ...semantic, ...declaration];
};
```

### 8.2 Diagnostic Conversion

```typescript
const convertDiagnostic = (tsDiag: ts.Diagnostic): Diagnostic => {
  const file = tsDiag.file;
  const pos = file?.getLineAndCharacterOfPosition(tsDiag.start ?? 0);

  return {
    code: `TS${tsDiag.code}`,
    severity:
      tsDiag.category === ts.DiagnosticCategory.Error ? "error" : "warning",
    message: ts.flattenDiagnosticMessageText(tsDiag.messageText, "\n"),
    file: file?.fileName,
    line: pos?.line,
    column: pos?.character,
  };
};
```

---

## 9. Program Queries

### 9.1 Source File Queries

```typescript
const getSourceFile = (
  program: TsonicProgram,
  fileName: string
): ts.SourceFile | undefined => {
  return program.program.getSourceFile(fileName);
};

const getAllSourceFiles = (
  program: TsonicProgram
): readonly ts.SourceFile[] => {
  return program.program.getSourceFiles().filter((sf) => !sf.isDeclarationFile);
};
```

### 9.2 Type Queries

```typescript
const getTypeAtLocation = (
  program: TsonicProgram,
  node: ts.Node
): ts.Type | undefined => {
  return program.checker.getTypeAtLocation(node);
};

const getSymbolAtLocation = (
  program: TsonicProgram,
  node: ts.Node
): ts.Symbol | undefined => {
  return program.checker.getSymbolAtLocation(node);
};
```

### 9.3 Metadata Queries

```typescript
const getTypeMetadata = (
  program: TsonicProgram,
  qualifiedName: string
): DotnetTypeMetadata | undefined => {
  return program.metadata.getTypeMetadata(qualifiedName);
};

const getMemberMetadata = (
  program: TsonicProgram,
  qualifiedTypeName: string,
  memberSignature: string
): DotnetMemberMetadata | undefined => {
  return program.metadata.getMemberMetadata(qualifiedTypeName, memberSignature);
};
```

### 9.4 Binding Queries

```typescript
const resolveBinding = (
  program: TsonicProgram,
  identifier: string
): BindingDescriptor | undefined => {
  return program.bindings.getBinding(identifier);
};

const resolveMemberBinding = (
  program: TsonicProgram,
  typeAlias: string,
  memberAlias: string
): MemberBinding | undefined => {
  return program.bindings.getMember(typeAlias, memberAlias);
};
```

---

## 10. Error Handling

### 10.1 Common Errors

**Parse Errors:**

```typescript
// TypeScript syntax error
const x = ;  // TS1109: Expression expected
```

**Type Errors:**

```typescript
// Type mismatch
const x: number = "hello"; // TS2322: Type 'string' is not assignable to type 'number'
```

**Module Resolution Errors:**

```typescript
// Cannot find module
import { Foo } from "./missing.ts"; // TS2307: Cannot find module
```

**Declaration File Errors:**

```typescript
// Invalid type declaration
declare function foo(): InvalidType; // TS2304: Cannot find name 'InvalidType'
```

### 10.2 Error Recovery

**No automatic recovery** - Program creation fails on first error.

**Rationale:**

- Better to fail fast than produce invalid IR
- User must fix TypeScript errors before compilation
- Prevents cascading errors in later phases

---

## 11. Performance Characteristics

### 11.1 Timing Breakdown

**Small Project (10 files):**

- Declaration scanning: ~10ms
- Program creation: ~50ms
- Type checking: ~100ms
- Metadata loading: ~5ms
- Binding loading: ~5ms
- **Total: ~170ms**

**Medium Project (100 files):**

- Declaration scanning: ~20ms
- Program creation: ~200ms
- Type checking: ~500ms
- Metadata loading: ~10ms
- Binding loading: ~10ms
- **Total: ~740ms**

**Large Project (1000 files):**

- Declaration scanning: ~50ms
- Program creation: ~1000ms
- Type checking: ~5000ms
- Metadata loading: ~20ms
- Binding loading: ~20ms
- **Total: ~6090ms**

### 11.2 Memory Usage

- TypeScript ASTs: ~100 KB per file
- Type checker: ~10 MB base overhead
- Metadata registry: ~1 MB per 100 types
- Binding registry: ~500 KB per 100 types

**Total for medium project:** ~50 MB

---

## 12. Caching Opportunities (Future)

### 12.1 Declaration File Caching

**Problem:** Scanning declaration files on every build is slow.

**Solution:** Cache declaration file list with filesystem watcher.

**Benefit:** 50% faster program creation for large projects.

### 12.2 Type Checker Caching

**Problem:** Type checking entire program on every build.

**Solution:** Incremental type checking (only changed files).

**Benefit:** 80% faster for incremental builds.

### 12.3 Metadata/Binding Caching

**Problem:** Parsing JSON files on every build.

**Solution:** Cache parsed registries in memory or disk.

**Benefit:** 20% faster program creation.

---

## 13. See Also

- [00-overview.md](00-overview.md) - System architecture
- [01-pipeline-flow.md](01-pipeline-flow.md) - Phase connections
- [03-phase-resolver.md](03-phase-resolver.md) - Module resolution (next phase)
- [metadata.md](../metadata.md) - Metadata schema contract
- [bindings.md](../bindings.md) - Binding schema contract

---

**Document Statistics:**

- Lines: ~650
- Sections: 13
- Code examples: 25+
- Coverage: Complete program creation phase with metadata/binding loading
