# Tsonic Compiler Specification

## Overview

Tsonic is a TypeScript to C# compiler that produces NativeAOT executables. It parses modern ESM TypeScript, generates C# source code, and compiles to native binaries using the .NET CLI.

## Core Philosophy

1. **ESM-Only**: No CommonJS support. All local imports must include `.ts` extensions.
2. **Exact Namespace Mapping**: Directory paths map directly to C# namespaces (case-preserved).
3. **Exact Name Preservation**: JS/TS built-in objects keep their exact names in `Tsonic.Runtime`.
4. **No Magic**: Clear, predictable mappings. When in doubt, error with clear diagnostics.
5. **Incremental Support**: Start with core features, grow the runtime as needed.

## What Tsonic Does

1. **Parse TypeScript** using the official TypeScript Compiler API
2. **Build an IR** (Intermediate Representation) with type information
3. **Generate C#** code with semantic equivalence
4. **Compile to NativeAOT** using dotnet CLI

## What Tsonic Doesn't Do (MVP)

- No CommonJS or dynamic imports
- No JavaScript runtime semantics (eval, with, etc.)
- No advanced TypeScript types (conditional types, mapped types)
- No Node.js compatibility layer (use .NET APIs directly)

## Key Innovations

### 1. Runtime Implementation
Instead of mapping JS arrays to C# Lists, we implement `Tsonic.Runtime.Array<T>` with exact JavaScript semantics (sparse arrays, mutable length, etc.).

### 2. Direct .NET Interop
Import .NET namespaces directly:
```typescript
import { JsonSerializer } from "System.Text.Json";
```

### 3. Predictable Mappings
- Directory structure = namespace hierarchy
- File name = class name
- Top-level exports = static class members

## Project Structure

```
tsonic/
├── packages/
│   ├── cli/          # CLI entry point
│   ├── frontend/     # TypeScript parsing & IR building
│   ├── emitter/      # C# code generation
│   ├── backend/      # dotnet CLI orchestration
│   └── runtime/      # JS/TS runtime in C#
├── spec/            # This specification
├── examples/        # Example projects
└── tests/          # Test suite
```

## Target Audience

- **Primary**: Developers wanting to compile TypeScript to native executables
- **Secondary**: Teams migrating Node.js services to .NET
- **Implementation**: AI coding agents and human contributors

## Success Metrics

1. Can compile and run basic TypeScript programs
2. Produces single-file NativeAOT executables
3. Clear error messages for unsupported features
4. Predictable, debuggable C# output