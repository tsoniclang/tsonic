# Tsonic User Guide

Tsonic compiles TypeScript to native executables via C# and .NET NativeAOT.

## Table of Contents

### Getting Started

1. [Getting Started](getting-started.md) - Installation and first project
2. [CLI Reference](cli.md) - Commands and options
3. [Configuration](configuration.md) - tsonic.json reference

### Language

4. [Language Guide](language.md) - Supported features
5. [Type System](type-system.md) - Type mappings
6. [Numeric Types](numeric-types.md) - Integer types and narrowing
7. [Generators](generators.md) - Sync, async, and bidirectional generators
8. [Callbacks](callbacks.md) - Action and Func patterns
9. [Async Patterns](async-patterns.md) - Async/await and for-await
10. [.NET Interop](dotnet-interop.md) - Using .NET BCL
11. [Language Intrinsics](lang-intrinsics.md) - stackalloc, trycast, thisarg, etc.
12. [JavaScript Runtime](dotnet-interop.md#javascript-runtime-apis-tsonicjs) - Optional JS-style APIs via `@tsonic/js`

### Build

13. [Build Output](build-output.md) - Pipeline and output
14. [Diagnostics](diagnostics.md) - Error codes reference

### Reference

15. [Examples](examples/README.md) - Code examples
16. [Troubleshooting](troubleshooting.md) - Common issues
17. [Limitations](limitations.md) - What Tsonic can’t do (yet)

## Quick Links

- [Architecture Documentation](architecture/README.md) - For contributors and advanced users
- [GitHub Repository](https://github.com/tsoniclang/tsonic)
- [npm Package](https://www.npmjs.com/package/tsonic)

## Overview

### What is Tsonic?

Tsonic is a compiler that transforms TypeScript source code into native executables:

```
TypeScript → IR → C# → NativeAOT → Native Binary
```

### Why Tsonic?

- **Native Performance**: Compile to fast, single-file executables
- **TypeScript Familiarity**: Use the language you know
- **Full .NET Access**: Call any .NET library
- **No Runtime Required**: Self-contained binaries

### Direct .NET Access

- C# semantics for all types
- Import from System.\*, System.IO, System.Linq, etc.
- Full BCL access
- Native arrays (`T[]`) and .NET collections

## Prerequisites

- **Node.js 22+**: For the CLI and type packages
- **.NET 10 SDK**: For compilation
- **npm**: For package management

Verify installation:

```bash
node --version   # v22.0.0 or higher
dotnet --version # 10.0.x
```

## Installation

```bash
npm install -g tsonic
tsonic --version
```

## Your First Program

```bash
# Create project
mkdir hello && cd hello
tsonic project init

# Build
npm run build

# Run
./out/app
```

Output:

```
Hello from Tsonic!
Doubled: 2, 4, 6, 8, 10
```
