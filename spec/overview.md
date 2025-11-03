# Tsonic Compiler Specification

## Overview

Tsonic is a TypeScript to C# compiler that produces NativeAOT executables. It parses modern ESM TypeScript, generates C# source code, and compiles to native binaries using the .NET CLI.

**Target Platform:**

- C# 14 (.NET 10+)
- All C# 14 features are available (nullable reference types, records, pattern matching, etc.)
- NativeAOT compilation for single-file executables

## Core Philosophy

1. **.NET-First**: Tsonic is a better language for .NET, not a JavaScript runtime port. Use native .NET types and expose .NET semantics directly.
2. **ESM-Only**: No CommonJS support. All local imports must include `.ts` extensions.
3. **Exact Namespace Mapping**: Directory paths map directly to C# namespaces (case-preserved).
4. **No Magic**: Clear, predictable mappings. When in doubt, error with clear diagnostics.
5. **Native Types**: Use `List<T>`, `string`, `double` directly. No wrapper classes.
6. **Static Helpers**: JavaScript semantics provided via `Tsonic.Runtime` static helper functions.

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

### 1. TypeScript Types with JavaScript Semantics

TypeScript types map to custom implementations with exact JavaScript semantics:

- `string[]` → `Tsonic.Runtime.Array<T>` (custom class supporting sparse arrays, etc.)
- `string` → `string` (native C# string)
- `number` → `double` (native C# numeric)

JavaScript semantics preserved:

- `arr.push(x)` → `arr.push(x)` (instance method on Tsonic.Runtime.Array)
- `arr.length` → `arr.length` (property on Tsonic.Runtime.Array)
- `str.toUpperCase()` → `Tsonic.Runtime.String.toUpperCase(str)` (static helper)

### 2. Direct .NET Interop

Import .NET namespaces and use them naturally:

```typescript
import { File } from "System.IO";
const lines = File.ReadAllLines("file.txt"); // Returns ReadonlyArray<string>
```

C# types exposed directly - no automatic conversions unless explicit.

### 3. Clean Type Boundaries

- **Tsonic types**: `Tsonic.Runtime.Array<T>` with JavaScript semantics - use `.push()`, `.slice()`, etc.
- **C# types**: Native .NET types (`T[]`, `List<T>`, `Dictionary<K,V>`) - use `.Add()`, `.ToArray()`, etc.
- **C# arrays from libraries**: Exposed as `ReadonlyArray<T>` in TypeScript
- **NO automatic conversions**: C# types stay C# types, Tsonic types stay Tsonic types
- **Use C# methods on C# types**: `List.Add()`, `list.ToArray()`

### 4. Predictable Mappings

- Directory structure = namespace hierarchy
- File name = class name
- Top-level exports = static class members

## Related Specifications

- Generators & coroutine translation ([Generators](generators.md))

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

- **Primary**: Developers who want TypeScript's syntax with .NET's performance and ecosystem
- **Secondary**: Teams building high-performance services using .NET libraries
- **Use Cases**: CLI tools, microservices, system utilities - anything that benefits from NativeAOT
- **Implementation**: AI coding agents and human contributors

## What Tsonic Is NOT

- **NOT** a Node.js replacement
- **NOT** a JavaScript runtime port
- **NOT** trying to bring npm ecosystem to .NET
- **IS** a better, type-safe language for writing .NET applications

## Success Metrics

1. Can compile and run basic TypeScript programs
2. Produces single-file NativeAOT executables
3. Clear error messages for unsupported features
4. Predictable, debuggable C# output
