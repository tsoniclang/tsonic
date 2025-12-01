# Tsonic User Guide

Tsonic compiles TypeScript to native executables via C# and .NET NativeAOT.

## Table of Contents

1. [Getting Started](getting-started.md)
2. [CLI Reference](cli.md)
3. [Configuration](configuration.md)
4. [Language Guide](language.md)
5. [Runtime Modes](runtime-modes.md)
6. [.NET Interop](dotnet-interop.md)
7. [Type System](type-system.md)
8. [Build Output](build-output.md)
9. [Troubleshooting](troubleshooting.md)

## Quick Links

- [Architecture Documentation](architecture/README.md) - For contributors and advanced users
- [GitHub Repository](https://github.com/tsoniclang/tsonic)
- [npm Package](https://www.npmjs.com/package/@tsonic/cli)

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

### Two Runtime Modes

1. **JS Mode** (`runtime: "js"`): JavaScript-compatible semantics
   - Arrays, objects, and primitives behave like JavaScript
   - Uses Tsonic.JSRuntime for JS semantics in C#

2. **Dotnet Mode** (`runtime: "dotnet"`): Direct .NET access
   - C# semantics for .NET types
   - Import from System.*, System.IO, etc.
   - Full BCL access

## Prerequisites

- **Node.js 18+**: For the CLI and type packages
- **.NET 10 SDK**: For compilation
- **npm**: For package management

Verify installation:

```bash
node --version   # v18.0.0 or higher
dotnet --version # 10.0.x
```

## Installation

```bash
npm install -g @tsonic/cli
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
