# Diagnostics System

How errors and warnings are created, collected, and reported.

## Overview

The diagnostics system provides structured error reporting across all compiler phases. Instead of throwing exceptions, each phase returns `Result<T, Diagnostic[]>`.

## Diagnostic Structure

```typescript
type Diagnostic = {
  readonly code: DiagnosticCode;       // "TSN1001"
  readonly severity: DiagnosticSeverity;  // "error" | "warning" | "info"
  readonly message: string;            // Description
  readonly location?: SourceLocation;  // File, line, column
  readonly hint?: string;              // Suggested fix
  readonly relatedLocations?: readonly SourceLocation[];
};

type SourceLocation = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
};
```

## Error Code Ranges

| Range | Category |
|-------|----------|
| TSN1xxx | Module resolution and imports |
| TSN2xxx | Type system |
| TSN3xxx | C# keywords and identifiers |
| TSN4xxx | .NET interop |
| TSN5xxx | NativeAOT and runtime |
| TSN6xxx | Internal compiler errors |
| TSN7xxx | Language semantics and validation |
| TSN9xxx | Metadata and bindings loading |

## Creating Diagnostics

Use the factory function:

```typescript
import { createDiagnostic } from "./types/diagnostic.js";

const diagnostic = createDiagnostic(
  "TSN1001",
  "error",
  "Local import must have .ts extension",
  { file: "src/main.ts", line: 5, column: 20, length: 15 },
  'Add .ts extension: "./utils.ts"'
);
```

## Collecting Diagnostics

Use the `DiagnosticsCollector` to aggregate diagnostics:

```typescript
import {
  createDiagnosticsCollector,
  addDiagnostic,
  mergeDiagnostics
} from "./types/diagnostic.js";

// Create collector
const collector = createDiagnosticsCollector();

// Add diagnostic (returns new collector - immutable)
const updated = addDiagnostic(collector, diagnostic);

// Check for errors
if (updated.hasErrors) {
  return { ok: false, error: updated.diagnostics };
}

// Merge multiple collectors
const merged = mergeDiagnostics(collector1, collector2);
```

## Error Flow Through Pipeline

Each phase propagates errors up the chain:

```typescript
const compile = (entryPoint: string): Result<BuildOutput, Diagnostic[]> => {
  // Phase 1: Create program
  const programResult = createProgram(entryPoint);
  if (!programResult.ok) {
    return programResult;  // Propagate errors
  }

  // Phase 2: Resolve modules
  const resolverResult = resolveModules(programResult.value);
  if (!resolverResult.ok) {
    return resolverResult;  // Propagate errors
  }

  // Phase 3: Validate
  const validationResult = validateModules(resolverResult.value);
  if (!validationResult.ok) {
    return validationResult;  // Propagate errors
  }

  // ... continue pipeline
};
```

## Phase-Specific Errors

### Frontend Errors (TSN1xxx, TSN2xxx, TSN7xxx)

```typescript
// Import validation
const validateImport = (specifier: string): Result<void, Diagnostic> => {
  if (!specifier.endsWith(".ts")) {
    return {
      ok: false,
      error: createDiagnostic(
        "TSN1001",
        "error",
        "Local import must have .ts extension",
        location,
        `Change "${specifier}" to "${specifier}.ts"`
      )
    };
  }
  return { ok: true, value: undefined };
};
```

### Emitter Errors (TSN5xxx)

```typescript
// Emission error
const emitExpression = (expr: IrExpression): Result<string, Diagnostic> => {
  if (expr.kind === "unsupported") {
    return {
      ok: false,
      error: createDiagnostic(
        "TSN5001",
        "error",
        `Cannot emit expression: ${expr.reason}`,
        expr.location
      )
    };
  }
  // ...
};
```

### Backend Errors (TSN6xxx)

```typescript
// Build error
const runDotnetPublish = (cwd: string): Result<string, Diagnostic> => {
  const result = spawnSync("dotnet", ["publish"], { cwd });
  if (result.status !== 0) {
    return {
      ok: false,
      error: createDiagnostic(
        "TSN6001",
        "error",
        `dotnet publish failed: ${result.stderr}`,
        undefined,
        "Check that .NET SDK is installed"
      )
    };
  }
  return { ok: true, value: result.stdout };
};
```

## Formatting Diagnostics

The CLI formats diagnostics for console output:

```typescript
const formatDiagnostic = (diagnostic: Diagnostic): string => {
  const parts: string[] = [];

  if (diagnostic.location) {
    parts.push(
      `${diagnostic.location.file}:${diagnostic.location.line}:${diagnostic.location.column}`
    );
  }

  parts.push(`${diagnostic.severity} ${diagnostic.code}:`);
  parts.push(diagnostic.message);

  if (diagnostic.hint) {
    parts.push(`Hint: ${diagnostic.hint}`);
  }

  return parts.join(" ");
};
```

Example output:

```
src/main.ts:5:20 error TSN1001: Local import must have .ts extension
  Hint: Change "./utils" to "./utils.ts"
```

## Related Locations

Some errors span multiple files. Use `relatedLocations`:

```typescript
const createCircularDepError = (
  cycle: string[]
): Diagnostic => ({
  code: "TSN1002",
  severity: "error",
  message: `Circular dependency: ${cycle.join(" -> ")}`,
  location: { file: cycle[0], line: 1, column: 0, length: 0 },
  relatedLocations: cycle.slice(1).map(file => ({
    file,
    line: 1,
    column: 0,
    length: 0
  }))
});
```

## Error vs Warning

**Errors** stop compilation:
- Missing imports
- Type mismatches
- Unsupported features
- Build failures

**Warnings** allow compilation to continue:
- Unused imports
- Deprecated features
- Non-critical issues

```typescript
// Error - stops compilation
const error = createDiagnostic(
  "TSN1001",
  "error",
  "Missing .ts extension"
);

// Warning - compilation continues
const warning = createDiagnostic(
  "TSN7001",
  "warning",
  "Import 'User' is declared but never used"
);
```

## Best Practices

1. **Specific error codes**: Each error type has a unique code
2. **Clear messages**: Explain what's wrong
3. **Helpful hints**: Suggest how to fix
4. **Accurate locations**: Point to exact position
5. **Related info**: Include all relevant locations
6. **Fail early**: Return errors as soon as detected
7. **Collect all**: In IDE mode, collect all errors before returning
