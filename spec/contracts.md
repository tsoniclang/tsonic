# Contracts & File Formats

**Purpose**: Stable public interfaces and file format specifications

**Audience**: Tool builders, integrators, IDE developers

**Stability**: These specifications are **versioned and stable** - breaking changes require major version bump

---

## Overview

This section documents Tsonic's public contracts - file formats, CLI interfaces, and runtime APIs that external tools can depend on.

**Stability Guarantee**: All formats and APIs documented here follow semantic versioning. We will not break these contracts without a major version bump.

---

## File Format Specifications

### [metadata.json Format](file-formats/metadata.md)

**Purpose**: CLR type metadata for .NET interop

**Location**: `<Namespace>/internal/metadata.json`

**Schema Version**: 1.0

**Contains**:

- Namespace information
- Contributing assemblies
- Type definitions (classes, interfaces, structs, enums)
- Member signatures (methods, properties, fields, events)
- Generic type parameters
- Inheritance hierarchies
- Accessibility levels

**Consumers**:

- Tsonic compiler frontend (type checking)
- IDE intellisense providers
- Documentation generators
- Static analysis tools

**Example**:

```json
{
  "namespace": "System.Collections.Generic",
  "contributingAssemblies": [
    "System.Collections",
    "System.Private.CoreLib"
  ],
  "types": [
    {
      "clrName": "System.Collections.Generic.List`1",
      "tsEmitName": "List_1",
      "kind": "Class",
      "accessibility": "Public",
      "arity": 1,
      "methods": [...]
    }
  ]
}
```

### [bindings.json Format](file-formats/bindings.md)

**Purpose**: Runtime method resolution for reflection-free calls

**Location**: `<Namespace>/bindings.json`

**Schema Version**: 2.0 (supports both V1 and V2 formats)

**Contains**:

- Namespace information
- CLR type to TypeScript name mappings
- Method metadata tokens for direct invocation
- Canonical signatures for overload resolution
- Exposed methods (V2 format)

**Consumers**:

- Tsonic emitter (C# code generation)
- Runtime binding resolver
- Profiling and debugging tools

**Example**:

```json
{
  "namespace": "System.Collections.Generic",
  "types": [
    {
      "clrName": "System.Collections.Generic.List`1",
      "tsEmitName": "List_1",
      "assemblyName": "System.Collections",
      "metadataToken": 33554433,
      "exposedMethods": [
        {
          "tsName": "Add",
          "isStatic": false,
          "tsSignatureId": "Add|(T):System.Void|static=false",
          "target": {
            "declaringClrType": "System.Collections.Generic.List`1",
            "declaringAssemblyName": "System.Collections",
            "metadataToken": 100663297
          }
        }
      ]
    }
  ]
}
```

### [tsonic.json Configuration](file-formats/tsonic-config.md)

**Purpose**: Project configuration for Tsonic compiler

**Location**: Project root

**Schema Version**: 1.0

**Contains**:

- Entry point specification
- Source and output directories
- Runtime mode selection (js/dotnet)
- Target framework and optimization settings
- NuGet package dependencies

**Example**:

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "runtime": "js",
  "rootNamespace": "MyApp",
  "entryPoint": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "myapp",
  "dotnetVersion": "net10.0",
  "optimize": "speed"
}
```

**Key Fields**:

- `runtime`: `"js"` (default) or `"dotnet"` - Controls whether to use Tsonic.Runtime
- `rootNamespace`: Root C# namespace for generated code
- `entryPoint`: Path to main TypeScript file (for executables)
- `outputDirectory`: Where to generate C# code
- `dotnetVersion`: Target .NET version

### [Generated C# Code](file-formats/generated-code.md)

**Purpose**: Understand compiler output structure

**Location**: `.tsonic/generated/`

**Contains**:

- Namespace organization
- Class structure
- Method signatures
- Runtime helper usage patterns
- Generic monomorphization

**Consumers**:

- Developers debugging generated code
- Performance analysis tools
- Code review tools

---

## API Specifications

### [CLI Interface](apis/cli.md)

**Purpose**: Command-line tool interface

**Stability**: Stable - follows semantic versioning

**Commands**:

- `tsonic build` - Compile TypeScript to executable
- `tsonic emit` - Generate C# code only
- `tsonic run` - Build and run immediately
- `tsonic check` - Type check without building

**Exit Codes**:
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Compilation error |
| 2 | Type error |
| 3 | Module resolution error |
| 4 | .NET interop error |
| 5 | Build system error |

**Output Format**:

- JSON diagnostics (`--format=json`)
- Human-readable (`--format=pretty`)
- Compiler messages (`--format=tsc`)

### [Runtime API](apis/runtime.md)

**Purpose**: Tsonic.Runtime public surface (optional - only with `runtime: "js"`)

**Stability**: Stable - semantic versioning

**Availability**: Only when `runtime: "js"` in tsonic.json

**Namespaces**:

- `Tsonic.Runtime.Array` - JavaScript array semantics
- `Tsonic.Runtime.Object` - Dynamic objects
- `Tsonic.Runtime.Console` - Console I/O
- `Tsonic.Runtime.Promise` - Async operations

**Semantic Guarantees**:

- Exact JavaScript array behavior
- Proper undefined handling
- IEEE 754 number semantics
- UTF-16 string operations

**Note**: When `runtime: "dotnet"`, these APIs are not available and standard .NET APIs should be used instead.

---

## Directory Structure Contract

**Guaranteed Structure**:

```
<tsbindgen-output>/
  _support/
    types.d.ts                        # Support types (TSByRef, etc.)

  <Namespace>/                        # Flat namespace directories
    internal/
      index.d.ts                      # Full type declarations
      metadata.json                   # ← CLR metadata (v1.0)

    index.d.ts                        # Public facade
    index.js                          # Compiled facade
    bindings.json                     # ← Runtime bindings (v2.0)
```

**Rules**:

1. Flat namespace structure (NO nesting: `System.IO` is one directory)
2. `metadata.json` in `<Namespace>/internal/` subdirectory
3. `bindings.json` at `<Namespace>/` root
4. Support types in `_support/types.d.ts`

**Example**:

```
node_modules/@dotnet/types/
  _support/
    types.d.ts
  System.Collections.Generic/
    internal/
      metadata.json
    bindings.json
  System.IO/
    internal/
      metadata.json
    bindings.json
  System.Linq/
    internal/
      metadata.json
    bindings.json
```

---

## Versioning Strategy

### Semantic Versioning

All contracts follow [semver](https://semver.org/):

- **MAJOR**: Breaking changes to file formats or APIs
- **MINOR**: Backward-compatible additions
- **PATCH**: Bug fixes, clarifications

**Current Versions**:

- metadata.json: v1.0
- bindings.json: v2.0 (supports v1 compatibility)
- CLI: v1.0
- Runtime API: v1.0

### Breaking Change Policy

**What constitutes a breaking change**:

- Removing or renaming fields in metadata.json or bindings.json
- Changing CLI command names or argument behavior
- Removing or changing Tsonic.Runtime public APIs
- Changing directory structure conventions

**What is NOT a breaking change**:

- Adding new optional fields to JSON formats
- Adding new CLI options (as long as defaults don't change)
- Adding new Tsonic.Runtime APIs
- Performance improvements
- Bug fixes that correct incorrect behavior

### Deprecation Process

1. **Announce** - Document in changelog and release notes
2. **Warn** - Add warnings for deprecated features (1 major version)
3. **Remove** - Remove in next major version

**Example**:

- v1.5.0: Add new `exposedMethods` format (V2)
- v1.6.0: Deprecate old `methods` format (V1) with warnings
- v2.0.0: Remove V1 format support

---

## Schema Validation

### JSON Schema Files

**Available** (future):

- `schemas/metadata-v1.schema.json` - metadata.json validator
- `schemas/bindings-v2.schema.json` - bindings.json validator

### Validation Tools

```bash
# Validate metadata.json
tsonic validate-metadata <path-to-metadata.json>

# Validate bindings.json
tsonic validate-bindings <path-to-bindings.json>
```

---

## Integration Examples

### Example: IDE Intellisense Provider

```typescript
// Load .NET type metadata
import { loadLibrary } from "@tsonic/metadata-loader";

const library = loadLibrary("node_modules/@dotnet/types");

// Look up type
const listType = library.types.find((t) => t.tsEmitName === "List_1");

// Show methods in autocomplete
for (const method of listType.methods) {
  if (method.accessibility === "Public") {
    showCompletion(method.tsEmitName, method.normalizedSignature);
  }
}
```

### Example: Documentation Generator

```typescript
// Generate docs from metadata
import { loadMetadata } from "@tsonic/metadata-loader";

const metadata = loadMetadata(
  "System.Collections.Generic/internal/metadata.json"
);

console.log(`# ${metadata.namespace}\n`);

for (const type of metadata.types) {
  console.log(`## ${type.tsEmitName}\n`);
  console.log(`**Kind**: ${type.kind}\n`);

  for (const method of type.methods) {
    console.log(`- \`${method.tsEmitName}${method.normalizedSignature}\``);
  }
}
```

### Example: Static Analysis Tool

```typescript
// Analyze bindings for runtime behavior
import { loadBindings } from "@tsonic/bindings-loader";

const bindings = loadBindings("System.IO/bindings.json");

for (const type of bindings.types) {
  for (const method of type.exposedMethods) {
    if (method.isStatic) {
      console.log(`Static call: ${type.tsEmitName}.${method.tsName}`);
    } else {
      console.log(`Instance call: obj.${method.tsName}()`);
    }
  }
}
```

---

## Stability Guarantees

### What We Guarantee

✅ **File Locations**: metadata.json and bindings.json paths will not change within major versions

✅ **Required Fields**: All documented required fields will exist

✅ **Field Types**: Field types (string, number, array, etc.) will not change

✅ **CLI Exit Codes**: Error codes will maintain same meanings

✅ **Semantic Behavior**: Tsonic.Runtime will preserve JavaScript semantics

### What We Don't Guarantee

❌ **Field Order**: JSON field order may change

❌ **Pretty Printing**: JSON formatting may change

❌ **Internal Details**: Non-documented implementation details

❌ **Performance**: Speed may improve (or regress) within same version

❌ **File Size**: Generated file sizes may change

---

## Reporting Issues

Found a contract violation or unclear specification?

**Report it**:

1. Check if behavior is documented as guaranteed
2. Create issue at https://github.com/tsoniclang/tsonic/issues
3. Tag with `contract-violation` label
4. Include version numbers

**We take contract violations seriously** - they will be fixed as high-priority bugs or documented as intentional breaking changes in next major version.

---

## See Also

- **[Architecture](../architecture/INDEX.md)** - Internal compiler design (not stable)
- **[Reference](../reference/INDEX.md)** - Language and API reference
- **[Metadata Spec Details](file-formats/metadata.md)** - Complete metadata.json specification
- **[Bindings Spec Details](file-formats/bindings.md)** - Complete bindings.json specification
