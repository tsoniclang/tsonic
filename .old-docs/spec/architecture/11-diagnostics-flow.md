# Phase 10: Diagnostics Flow

## Purpose

This phase defines the error reporting system that collects, routes, and presents diagnostics (errors and warnings) from all compiler phases to the user in a clear, actionable format.

---

## 1. Overview

**Responsibility:** Diagnostic creation, collection, routing, and user-facing presentation

**Package:** All packages (cross-cutting concern)

**Location:** `packages/*/src/diagnostics/`

**Input:** Errors from all phases

**Output:** User-facing diagnostic messages with code snippets, hints, and error codes

---

## 2. Diagnostic Data Structure

### 2.1 Core Type

```typescript
type Diagnostic = {
  readonly code: DiagnosticCode; // "TSN1001"
  readonly severity: "error" | "warning";
  readonly message: string; // Short description
  readonly hint?: string; // Suggested fix
  readonly file?: string; // File path
  readonly line?: number; // Line number (1-indexed)
  readonly column?: number; // Column number (0-indexed)
  readonly snippet?: string; // Code snippet context
  readonly relatedInfo?: readonly RelatedDiagnostic[]; // Related errors
};

type RelatedDiagnostic = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
};

type DiagnosticCode =
  | TSNImportCode // TSN1xxx
  | TSNTypeCode // TSN2xxx
  | TSNExportCode // TSN3xxx
  | TSNIRCode // TSN4xxx
  | TSNEmitCode // TSN5xxx
  | TSNBackendCode; // TSN6xxx
```

### 2.2 Factory Functions

```typescript
const createDiagnostic = (
  code: DiagnosticCode,
  severity: "error" | "warning",
  message: string,
  options?: {
    readonly hint?: string;
    readonly file?: string;
    readonly line?: number;
    readonly column?: number;
    readonly relatedInfo?: readonly RelatedDiagnostic[];
  }
): Diagnostic => ({
  code,
  severity,
  message,
  hint: options?.hint,
  file: options?.file,
  line: options?.line,
  column: options?.column,
  relatedInfo: options?.relatedInfo,
});
```

---

## 3. Error Code Ranges

### 3.1 Code Categories

| Range       | Category                 | Examples                                         |
| ----------- | ------------------------ | ------------------------------------------------ |
| **TSN1xxx** | Import/Module Resolution | Missing .ts extension, circular deps             |
| **TSN2xxx** | Type System              | Type errors, generic constraints, name collision |
| **TSN3xxx** | Export/Feature Support   | Default exports, union types, decorators         |
| **TSN4xxx** | IR Building              | AST conversion errors, binding resolution        |
| **TSN5xxx** | C# Emission              | Code generation errors, specialization issues    |
| **TSN6xxx** | Backend/NativeAOT        | .csproj errors, dotnet compilation failures      |

### 3.2 Import Errors (TSN1xxx)

```typescript
type TSNImportCode =
  | "TSN1001" // Missing .ts extension
  | "TSN1002" // Circular dependency
  | "TSN1003" // Case mismatch
  | "TSN1004" // Module not found
  | "TSN1005" // Node.js built-in not supported
  | "TSN1006"; // Invalid import specifier

// Example
const missingExtensionError = createDiagnostic(
  "TSN1001",
  "error",
  "Local import must have .ts extension",
  {
    hint: 'Change "./models/User" to "./models/User.ts"',
    file: "/src/main.ts",
    line: 5,
    column: 20,
  }
);
```

### 3.3 Type System Errors (TSN2xxx)

```typescript
type TSNTypeCode =
  | "TSN2001" // Literal types not supported (MVP)
  | "TSN2002" // Conditional types not supported
  | "TSN2003" // Name collision (file vs export)
  | "TSN2004" // Union/intersection constraints not supported
  | "TSN2005" // Duplicate export
  | "TSN2006"; // Invalid generic constraint

// Example
const nameCollisionError = createDiagnostic(
  "TSN2003",
  "error",
  'Export name "User" conflicts with file name "User"',
  {
    hint: "Rename the file or the export",
    file: "/src/models/User.ts",
    line: 10,
    column: 7,
  }
);
```

### 3.4 Export/Feature Errors (TSN3xxx)

```typescript
type TSNExportCode =
  | "TSN3001" // Export-all not supported
  | "TSN3002" // Default exports not supported
  | "TSN3003" // Dynamic imports not supported
  | "TSN3004" // Union types not supported (MVP)
  | "TSN3005" // Decorators not supported
  | "TSN3006"; // Namespace declarations not supported

// Example
const defaultExportError = createDiagnostic(
  "TSN3002",
  "error",
  "Default exports are not supported",
  {
    hint: "Use named export instead: export class User {}",
    file: "/src/models/User.ts",
    line: 15,
    column: 0,
  }
);
```

### 3.5 IR Building Errors (TSN4xxx)

```typescript
type TSNIRCode =
  | "TSN4001" // Cannot convert expression to IR
  | "TSN4002" // Cannot convert statement to IR
  | "TSN4003" // Cannot resolve type
  | "TSN4004" // Cannot resolve binding
  | "TSN4005"; // Invalid AST node

// Example
const bindingResolutionError = createDiagnostic(
  "TSN4004",
  "error",
  'Cannot resolve binding for "System.IO.File.ReadAllText"',
  {
    hint: "Ensure System.IO metadata is loaded",
    file: "/src/main.ts",
    line: 20,
    column: 10,
  }
);
```

### 3.6 Emission Errors (TSN5xxx)

```typescript
type TSNEmitCode =
  | "TSN5001" // Cannot emit expression
  | "TSN5002" // Cannot emit statement
  | "TSN5003" // Cannot emit type
  | "TSN5004" // Specialization failed
  | "TSN5005"; // Adapter generation failed

// Example
const specializationError = createDiagnostic(
  "TSN5004",
  "error",
  "Cannot specialize generic function map<T, U>",
  {
    hint: "Type parameters may not be properly constrained",
    file: "/src/utils.ts",
    line: 30,
    column: 15,
  }
);
```

### 3.7 Backend Errors (TSN6xxx)

```typescript
type TSNBackendCode =
  | "TSN6001" // .csproj generation failed
  | "TSN6002" // dotnet restore failed
  | "TSN6003" // NativeAOT compilation failed
  | "TSN6004"; // Runtime dependency missing

// Example
const nativeAotError = createDiagnostic(
  "TSN6003",
  "error",
  "NativeAOT compilation failed: ILCompiler exited with code 1",
  {
    hint: "If using mode: 'js', check that Tsonic.JSRuntime package is available",
    file: undefined, // Backend error, no specific file
  }
);
```

---

## 4. Diagnostic Collection

### 4.1 Collection Strategies

**Fail-Fast (Default):**

```typescript
const resolveModules = (
  program: TsonicProgram,
  options: ResolverOptions
): Result<ModuleGraph, Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  // Collect all diagnostics
  for (const file of program.program.getRootFileNames()) {
    const fileDiags = resolveFile(file, program, options);
    diagnostics.push(...fileDiags);
  }

  // If any errors, return immediately
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    return error(errors);
  }

  return ok(/* ... */);
};
```

**Collect-All (For IDE integration):**

```typescript
const resolveModulesWithWarnings = (
  program: TsonicProgram,
  options: ResolverOptions
): Result<ModuleGraph, { errors: Diagnostic[]; warnings: Diagnostic[] }> => {
  const diagnostics: Diagnostic[] = [];

  // Collect all diagnostics (errors + warnings)
  for (const file of program.program.getRootFileNames()) {
    const fileDiags = resolveFile(file, program, options);
    diagnostics.push(...fileDiags);
  }

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  if (errors.length > 0) {
    return error({ errors, warnings });
  }

  return ok(/* moduleGraph with warnings */);
};
```

### 4.2 Diagnostic Aggregation

```typescript
type DiagnosticCollector = {
  readonly diagnostics: Diagnostic[];
  add: (diagnostic: Diagnostic) => void;
  addAll: (diagnostics: readonly Diagnostic[]) => void;
  hasErrors: () => boolean;
  getErrors: () => readonly Diagnostic[];
  getWarnings: () => readonly Diagnostic[];
};

const createCollector = (): DiagnosticCollector => {
  const diagnostics: Diagnostic[] = [];

  return {
    diagnostics,
    add: (diag) => diagnostics.push(diag),
    addAll: (diags) => diagnostics.push(...diags),
    hasErrors: () => diagnostics.some((d) => d.severity === "error"),
    getErrors: () => diagnostics.filter((d) => d.severity === "error"),
    getWarnings: () => diagnostics.filter((d) => d.severity === "warning"),
  };
};
```

---

## 5. Diagnostic Routing

### 5.1 Phase-to-Diagnostic Mapping

```typescript
type PhaseResult<T> = Result<T, Diagnostic[]>;

// Phase 1: Program Creation
const createTsonicProgram = (
  options: ProgramOptions
): PhaseResult<TsonicProgram> => {
  // TSN1xxx, TSN6xxx errors possible
  // ...
};

// Phase 2: Module Resolution
const resolveModules = (
  program: TsonicProgram,
  options: ResolverOptions
): PhaseResult<ModuleGraph> => {
  // TSN1xxx errors possible
  // ...
};

// Phase 3: Validation
const validateModules = (
  moduleGraph: ModuleGraph,
  program: TsonicProgram
): PhaseResult<ValidationResult> => {
  // TSN1xxx, TSN2xxx, TSN3xxx errors possible
  // ...
};

// Phase 4: IR Building
const buildIR = (
  moduleGraph: ModuleGraph,
  program: TsonicProgram,
  options: IrBuildOptions
): PhaseResult<Map<string, IrModule>> => {
  // TSN2xxx, TSN4xxx errors possible
  // ...
};

// Phase 5: Analysis
const analyzeDependencies = (
  irModules: Map<string, IrModule>
): PhaseResult<AnalysisResult> => {
  // TSN1xxx (circular deps), TSN4xxx errors possible
  // ...
};

// Phase 6: Emission
const emitCSharp = (
  irModules: Map<string, IrModule>,
  options: EmitterOptions
): PhaseResult<Map<string, string>> => {
  // TSN5xxx errors possible
  // ...
};

// Phase 7: Backend
const compileNativeExecutable = (
  csharpFiles: Map<string, string>,
  options: BackendOptions
): PhaseResult<BuildOutput> => {
  // TSN6xxx errors possible
  // ...
};
```

### 5.2 Error Propagation

```typescript
const fullPipeline = async (
  entryPoint: string
): Promise<Result<BuildOutput, Diagnostic[]>> => {
  // Each phase returns Result<T, Diagnostic[]>
  // Errors propagate up and halt pipeline

  const programResult = await createTsonicProgram({ entryPoint });
  if (!programResult.ok) {
    return programResult; // TSN1xxx or TSN6xxx errors
  }

  const resolverResult = await resolveModules(
    programResult.value
    /* options */
  );
  if (!resolverResult.ok) {
    return resolverResult; // TSN1xxx errors
  }

  const validationResult = validateModules(
    resolverResult.value,
    programResult.value
  );
  if (!validationResult.ok) {
    return validationResult; // TSN1xxx, TSN2xxx, TSN3xxx errors
  }

  // ... continue pipeline
  // Each phase checks result.ok before proceeding
};
```

---

## 6. User-Facing Error Messages

### 6.1 Message Format

**Standard Format:**

```
file:line:col - severity TSN1234: message
  Hint: suggestion

> line | code snippet
        ^
```

**Example Output:**

```
src/models/User.ts:5:20 - error TSN1001: Local import must have .ts extension
  Hint: Change "./models/User" to "./models/User.ts"

>    5 | import { Post } from "./models/Post";
                              ^
```

### 6.2 Code Snippet Generation

```typescript
const addCodeSnippet = (diagnostic: Diagnostic): Diagnostic => {
  if (!diagnostic.file || !diagnostic.line) {
    return diagnostic;
  }

  try {
    const content = fs.readFileSync(diagnostic.file, "utf-8");
    const lines = content.split("\n");

    // Extract context: 2 lines before, error line, 2 lines after
    const start = Math.max(0, diagnostic.line - 3);
    const end = Math.min(lines.length, diagnostic.line + 2);

    const snippet: string[] = [];
    for (let i = start; i < end; i++) {
      const lineNum = (i + 1).toString().padStart(4);
      const marker = i === diagnostic.line - 1 ? ">" : " ";
      snippet.push(`${marker} ${lineNum} | ${lines[i]}`);

      // Add caret indicator
      if (i === diagnostic.line - 1 && diagnostic.column !== undefined) {
        const spaces = " ".repeat(diagnostic.column + 8);
        snippet.push(`  ${spaces}^`);
      }
    }

    return {
      ...diagnostic,
      snippet: snippet.join("\n"),
    };
  } catch {
    return diagnostic; // Cannot read file, return without snippet
  }
};
```

### 6.3 Hints and Suggestions

**Hint Generation Strategy:**

```typescript
const addHintToImportError = (
  code: "TSN1001",
  specifier: string
): Diagnostic => {
  return createDiagnostic("TSN1001", "error", "Missing .ts extension", {
    hint: `Change "${specifier}" to "${specifier}.ts"`,
  });
};

const addHintToNameCollision = (
  exportName: string,
  fileName: string
): Diagnostic => {
  return createDiagnostic(
    "TSN2003",
    "error",
    `Export "${exportName}" conflicts with file name "${fileName}"`,
    {
      hint: `Rename the file to something other than "${fileName}.ts" or rename the export`,
    }
  );
};

const addHintToCircularDep = (cycle: string[]): Diagnostic => {
  const cycleStr = cycle.map((f) => path.basename(f)).join(" → ");
  return createDiagnostic(
    "TSN1002",
    "error",
    `Circular dependency detected: ${cycleStr}`,
    {
      hint: "Break the cycle by extracting shared code to a separate module",
    }
  );
};
```

---

## 7. Related Diagnostics

### 7.1 Multi-Location Errors

Some errors span multiple files. Use `relatedInfo` to show all locations:

```typescript
const createCircularDependencyError = (cycle: string[]): Diagnostic => {
  const [first, ...rest] = cycle;

  // Main diagnostic at first file
  const mainDiag = createDiagnostic(
    "TSN1002",
    "error",
    `Circular dependency detected: ${cycle
      .map((f) => path.basename(f))
      .join(" → ")}`,
    {
      file: first,
      line: 1,
      column: 0,
      hint: "Break the cycle by extracting shared code to a separate module",
    }
  );

  // Related info for other files in cycle
  const related: RelatedDiagnostic[] = rest.map((file) => ({
    file,
    line: 1,
    column: 0,
    message: "Part of circular dependency",
  }));

  return {
    ...mainDiag,
    relatedInfo: related,
  };
};
```

**Output:**

```
src/models/User.ts:1:0 - error TSN1002: Circular dependency detected: User.ts → Post.ts → Comment.ts → User.ts
  Hint: Break the cycle by extracting shared code to a separate module

Related locations:
  src/models/Post.ts:1:0 - Part of circular dependency
  src/models/Comment.ts:1:0 - Part of circular dependency
```

---

## 8. Diagnostic Severity Levels

### 8.1 Error vs Warning

**Error (severity: "error"):**

- Compilation MUST stop
- Violates language rules
- Would produce incorrect code
- Examples: Missing .ts extension, circular deps, unsupported features

**Warning (severity: "warning"):**

- Compilation CAN continue
- Potentially problematic code
- Best practice violations
- Examples: Unused imports, deprecated APIs

### 8.2 Future Warning Examples

```typescript
// Warning for unused import (future feature)
const unusedImportWarning = createDiagnostic(
  "TSN7001",
  "warning",
  'Import "User" is declared but never used',
  {
    hint: "Remove unused import or prefix with underscore: _User",
    file: "/src/main.ts",
    line: 3,
    column: 9,
  }
);

// Warning for deprecated API (future feature)
const deprecatedApiWarning = createDiagnostic(
  "TSN7002",
  "warning",
  'Function "readFileSync" is deprecated',
  {
    hint: "Use async version readFile() instead",
    file: "/src/utils.ts",
    line: 10,
    column: 15,
  }
);
```

---

## 9. Performance Considerations

### 9.1 Lazy Code Snippet Generation

Don't generate code snippets until printing:

```typescript
// ❌ WRONG - Generate snippets eagerly
const diagnostic = addCodeSnippet(
  createDiagnostic("TSN1001", "error", "Missing .ts extension", {
    file: "/src/main.ts",
    line: 5,
    column: 20,
  })
);

// ✅ CORRECT - Generate snippets only when printing
const diagnostic = createDiagnostic(
  "TSN1001",
  "error",
  "Missing .ts extension",
  {
    file: "/src/main.ts",
    line: 5,
    column: 20,
  }
);

// Later, when printing:
const withSnippet = addCodeSnippet(diagnostic);
printDiagnostic(withSnippet);
```

### 9.2 Diagnostic Limits

For performance, limit diagnostics in large projects:

```typescript
const MAX_DIAGNOSTICS = 100;

const collectDiagnosticsWithLimit = (
  files: string[],
  program: TsonicProgram
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    if (diagnostics.length >= MAX_DIAGNOSTICS) {
      diagnostics.push(
        createDiagnostic(
          "TSN9999",
          "error",
          `Too many errors (${MAX_DIAGNOSTICS}+). Fix existing errors and try again.`,
          {}
        )
      );
      break;
    }

    const fileDiags = validateFile(file, program);
    diagnostics.push(...fileDiags);
  }

  return diagnostics;
};
```

---

## 10. Recovery Strategies

### 10.1 Partial Compilation

For IDE integration, continue compilation even with errors:

```typescript
type PartialResult<T> = {
  readonly value: T; // May be incomplete
  readonly diagnostics: readonly Diagnostic[];
  readonly isPartial: boolean;
};

const buildIRWithRecovery = (
  moduleGraph: ModuleGraph,
  program: TsonicProgram
): PartialResult<Map<string, IrModule>> => {
  const diagnostics: Diagnostic[] = [];
  const irModules = new Map<string, IrModule>();

  for (const [filePath, moduleInfo] of moduleGraph.modules) {
    const result = buildModuleIR(filePath, moduleInfo, program);

    if (result.ok) {
      irModules.set(filePath, result.value);
    } else {
      // Record error but continue
      diagnostics.push(...result.error);
    }
  }

  return {
    value: irModules,
    diagnostics,
    isPartial: diagnostics.some((d) => d.severity === "error"),
  };
};
```

---

## 11. See Also

- [00-overview.md](00-overview.md) - System architecture
- [01-pipeline-flow.md](01-pipeline-flow.md) - Phase connections and error propagation
- [10-cli-orchestration.md](10-cli-orchestration.md) - CLI diagnostic printing
- [docs/diagnostics.md](../../docs/diagnostics.md) - User-facing diagnostic guide

---

**Document Statistics:**

- Lines: ~600
- Sections: 11
- Error codes: 30+ (TSN1xxx-TSN7xxx)
- Code examples: 20+
- Coverage: Complete diagnostic system with error codes, routing, and user-facing messages
