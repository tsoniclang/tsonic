# Tsonic Specification Index

This index provides the recommended reading order for understanding the Tsonic compiler and language.

## Quick Start

**New to Tsonic?** Start here:
1. [Overview](overview.md) - What is Tsonic and why?
2. [Architecture](architecture.md) - How the compiler works
3. [Examples](examples/) - See working code examples

## Core Language Specifications

Read these to understand how TypeScript maps to C#:

### Module System & Structure
- [Module Resolution](module-resolution.md) - ESM import rules (.ts extensions, .NET imports)
- [Namespaces](namespaces.md) - Directory → C# namespace mapping
- [Entry Points](entry-points.md) - Main functions and program entry

### Type System
- [Type Mappings](type-mappings.md) - TypeScript → C# type mappings
- [Generics](generics.md) - Generic type handling and monomorphisation
- [Types & Interfaces](types-and-interfaces.md) - Interface and type alias translation
- [Runtime](runtime.md) - Tsonic.Runtime specification (Array, String helpers, etc.)

### Code Generation
- [Code Generation](code-generation.md) - IR → C# emission rules
- [Generators](generators.md) - Async/sync generator translation
- [Bindings](bindings.md) - Structure of `<Assembly>.bindings.json`

## .NET Integration

- [.NET Interop](dotnet-interop.md) - Using .NET libraries from TypeScript
- [.NET Declarations](dotnet-declarations.md) - Type declarations, metadata, and binding manifests
- [Build Process](build-process.md) - NativeAOT compilation

## Tools & Development

- [CLI](cli.md) - Command-line interface specification
- [Diagnostics](diagnostics.md) - Error codes catalog (TSN1xxx-TSN7xxx)

## Reference

- [Examples](examples/) - Complete working examples
  - [Basic Examples](examples/basic.md)
  - [Array Examples](examples/arrays.md)
  - [.NET Interop Examples](examples/dotnet.md)
  - [Import Examples](examples/imports.md)
- [Implementation Plan](implementation-plan.md) - Development roadmap and phases

## Reading Paths

### For Users (Writing Tsonic Code)
1. [Overview](overview.md)
2. [Module Resolution](module-resolution.md)
3. [Type Mappings](type-mappings.md)
4. [.NET Interop](dotnet-interop.md)
5. [Examples](examples/)

### For Contributors (Implementing the Compiler)
1. [Overview](overview.md)
2. [Architecture](architecture.md)
3. [Implementation Plan](implementation-plan.md)
4. [Code Generation](code-generation.md)
5. [Bindings](bindings.md)
6. [Runtime](runtime.md)

### For Language Designers
1. [Type Mappings](type-mappings.md)
2. [Generics](generics.md)
3. [Types & Interfaces](types-and-interfaces.md)
4. [Generators](generators.md)
5. [Diagnostics](diagnostics.md)

## Conventions

Throughout the specifications:
- ✅ Indicates supported features
- ❌ Indicates unsupported features
- `TSNxxxx` Error codes are defined in [Diagnostics](diagnostics.md)
- Code blocks show TypeScript input and C# output

## Contributing

When adding new specifications:
1. Create a descriptive filename (e.g., `async-await.md`)
2. Add the spec to this index under the appropriate category
3. Cross-reference related specs using relative links
4. Follow the existing spec format (Overview, Rules, Examples)
