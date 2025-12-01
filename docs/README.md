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
6. [Runtime Modes](runtime-modes.md) - JS vs dotnet mode
7. [.NET Interop](dotnet-interop.md) - Using .NET BCL

### Build

8. [Build Output](build-output.md) - Pipeline and output
9. [Diagnostics](diagnostics.md) - Error codes reference

### Reference

10. [Examples](examples/README.md) - Code examples
11. [Troubleshooting](troubleshooting.md) - Common issues

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
   - Import from System.\*, System.IO, etc.
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
