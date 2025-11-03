# Type Declarations & Metadata

## Overview

Tsonic consumes three companion artefacts for every .NET/Node surface area we expose to TypeScript:

1. **Type declarations** (`*.d.ts`) – the ambient TypeScript view of an assembly or module
2. **Metadata sidecars** (`*.metadata.json`) – C# semantics the TS type system cannot represent (virtual/override/struct, etc.)
3. **Binding manifests** (`*.bindings.json`) – a simple map from top-level identifiers (JS globals, Node modules) to the actual C# type that implements them

The compiler loads all three artefacts from configured `typeRoots` and uses them to produce valid C# calls against the correct assemblies.

## Repository Layout

| Surface             | Decl / Metadata Location                                   | Bindings Manifest                     |
|---------------------|-------------------------------------------------------------|---------------------------------------|
| JS runtime globals  | `../tsonic-runtime/src/Tsonic.Runtime/types/`               | `Tsonic.Runtime.bindings.json`        |
| .NET BCL assemblies | npm package `@tsonic/dotnet-types` (per version directory)  | *(none – BCL doesn’t expose globals)* |
| Node.js API surface | npm package `@tsonic/node-types`                            | `Tsonic.NodeApi.bindings.json`        |

Each versioned npm bundle mirrors the assemblies (e.g. `types/System.Text.Json.d.ts`, `types/System.Text.Json.metadata.json`). The runtime repo ships its own declarations and binding manifest alongside the C# project so the package can be consumed independently.

## Generation Tool

Most `.d.ts` and `.metadata.json` files are produced by the `generatedts` tool:

```bash
cd ../generatedts
# Generate declarations/metadata for a single assembly
dotnet run --project Src -- System.Text.Json.dll --out-dir ../dotnet-types/packages/dotnet-types-10.0.0/types
```

`generatedts` emits:

- `System.Text.Json.d.ts` (ambient namespace declarations)
- `System.Text.Json.metadata.json` (type/method metadata)

Binding manifests (`*.bindings.json`) are authored separately (or generated from a small configuration file) because they depend on the JavaScript-facing module/global names rather than the CLR type names.

See `../generatedts/README.md` for details on assembly discovery, namespace filtering, reserved-keyword escaping, and validation.

## File Formats

### Type Declarations (`*.d.ts`)

Ambient definitions that mirror the public API of the target assembly or module. Example (extract from the runtime bundle):

```ts
// console.d.ts
declare namespace Tsonic.Runtime {
  /** JavaScript console global */
  class console {
    static log(...data: unknown[]): void;
    static error(...data: unknown[]): void;
    static warn(...data: unknown[]): void;
    static info(...data: unknown[]): void;
  }
}
```

### Metadata Sidecars (`*.metadata.json`)

Describe the CLR semantics the emitter needs (virtual/override, struct vs class, etc.). Example:

```json
{
  "assemblyName": "Tsonic.Runtime",
  "types": {
    "Tsonic.Runtime.console": {
      "kind": "class",
      "isStatic": true,
      "members": {
        "log(params object[])": { "kind": "method", "isStatic": true },
        "error(params object[])": { "kind": "method", "isStatic": true }
      }
    }
  }
}
```

### Binding Manifests (`*.bindings.json`)

Map JavaScript entry points to the CLR type that implements them. A single manifest can cover both globals and modules:

```json
{
  "bindings": {
    "console": {
      "kind": "global",
      "assembly": "Tsonic.Runtime",
      "type": "Tsonic.Runtime.console"
    },
    "Math": {
      "kind": "global",
      "assembly": "Tsonic.Runtime",
      "type": "Tsonic.Runtime.Math"
    },
    "JSON": {
      "kind": "global",
      "assembly": "Tsonic.Runtime",
      "type": "Tsonic.Runtime.JSON"
    },
    "fs": {
      "kind": "module",
      "assembly": "Tsonic.NodeApi",
      "type": "Tsonic.NodeApi.fs"
    }
  }
}
```

The compiler uses `kind` to decide whether to bind the identifier as a global (no import) or as an importable module.

## Consumption from the Compiler

Tsonic loads declarations, metadata, and bindings from every configured `typeRoot`. A typical project configuration looks like:

```jsonc
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/index.ts",
  "dotnet": {
    "typeRoots": [
      "node_modules/@tsonic/dotnet-types/10.0.0/types",
      "../tsonic-runtime/src/Tsonic.Runtime/types",
      "node_modules/@tsonic/node-types/1.0.0/types"
    ],
    "packages": [
      { "name": "Tsonic.Runtime", "version": "1.0.0" },
      { "name": "Tsonic.NodeApi", "version": "1.0.0" }
    ]
  }
}
```

At compile time the pipeline:

1. Loads **all `.d.ts`** into the TypeScript program so type-checking works.
2. Loads **all `.metadata.json`** to drive C# emission (virtual overrides, structs, etc.).
3. Loads **all `.bindings.json`** so it can resolve globals/modules to the appropriate assemblies and insert `<PackageReference/>` entries automatically.

## Validation

The `generatedts` repo contains a validation script (`Scripts/validate.js`) that regenerates the reference assemblies, writes an aggregator `index.d.ts`, and runs the TypeScript compiler across the entire output to ensure there are no syntax errors. Semantic diagnostics are tracked and reduced over time as the generator improves its CLR → TS mapping.

Projects that hand-author declarations (e.g., the runtime or Node bundles) should run the same validation script against their `types/` directory before publishing.

## Summary

- `.d.ts` files describe the TypeScript view of an assembly/module.
- `.metadata.json` files encode C# semantics required for code generation.
- `.bindings.json` files bridge JS entry points (globals/modules) to CLR types.
- `typeRoots` + `packages` in project configuration tell Tsonic where to load declarations and which assemblies to reference.
- `generatedts` produces most artefacts; the runtime/Node bundles rehost them and provide binding manifests for their globals/modules.
