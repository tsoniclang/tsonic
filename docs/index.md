# Tsonic Documentation

Welcome to Tsonic - a TypeScript to C# compiler that produces blazing-fast NativeAOT executables.

## What is Tsonic?

Tsonic lets you write TypeScript and compile it to native executables via C# and NativeAOT. It's designed to be a **better language for .NET**, not a JavaScript runtime port. You get TypeScript's syntax with .NET's performance and ecosystem.

**Key Features:**

- **Native .NET Types**: Use `string`, `List<T>`, `Dictionary<K,V>` directly - no wrapper classes
- **Direct .NET Interop**: Import and use any .NET namespace or NuGet package
- **NativeAOT Compilation**: Fast startup, small binaries, no runtime dependencies
- **ES Modules**: Modern ESM-only module system with explicit `.ts` extensions
- **Predictable Mappings**: Directory structure becomes namespaces, file names become class names

## Why Tsonic?

**For TypeScript Developers:**

- Familiar syntax you already know
- Strong type system
- Modern language features
- Build high-performance CLI tools and services

**For .NET Developers:**

- Cleaner, more concise syntax than C#
- Modern module system
- Still get full access to .NET ecosystem
- Same performance as native C#

## What Tsonic Is NOT

- **NOT** a Node.js replacement
- **NOT** a JavaScript runtime
- **NOT** trying to bring npm ecosystem to .NET
- **IS** a better, type-safe language for writing .NET applications

## Quick Example

**TypeScript:**

```typescript
// hello.ts
import { File } from "System.IO";

export function main(): void {
  const message = "Hello from Tsonic!";
  console.log(message);
  File.WriteAllText("output.txt", message);
}
```

**Compile and Run:**

```bash
tsonic build hello.ts
./tsonic-app
```

That's it! You get a single native executable with no runtime dependencies.

## Getting Started

New to Tsonic? Start here:

1. **[Getting Started](./getting-started.md)** - Install Tsonic and compile your first program
2. **[CLI Reference](./cli.md)** - Learn the `tsonic` command and its options
3. **[Module System](./language/module-system.md)** - Understand ESM imports and .NET namespaces
4. **[Examples](./examples/index.md)** - See complete working examples

## Core Concepts

### Module System

Tsonic uses ES Modules with explicit `.ts` extensions for local imports:

```typescript
import { User } from "./models/User.ts"; // Local file
import { File } from "System.IO"; // .NET namespace
```

See [Module System](./language/module-system.md) for details.

### Namespaces

Your directory structure becomes C# namespaces exactly:

```
src/models/User.ts → My.App.models.User
src/api/endpoints.ts → My.App.api.endpoints
```

See [Namespaces](./language/namespaces.md) for details.

### Type Mappings

TypeScript types map to native .NET types:

```typescript
string      → string        // Native C# string
number      → double        // Native C# double
string[]    → List<string>  // Native C# List<T>
Promise<T>  → Task<T>       // Native C# Task<T>
```

See [Type Mappings](./language/type-mappings.md) for complete reference.

### .NET Interop

Import and use .NET directly:

```typescript
import { HttpClient } from "System.Net.Http";
import { JsonSerializer } from "System.Text.Json";

const client = new HttpClient();
const json = JsonSerializer.Serialize(data);
```

See [.NET Interop](./language/dotnet-interop.md) for details.

## Documentation

### User Guide

- [Getting Started](./getting-started.md) - Installation and first compile
- [CLI Reference](./cli.md) - Command-line interface
- [Build Output](./build-output.md) - What gets emitted
- [Diagnostics](./diagnostics.md) - Error codes and fixes
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

### Language Reference

- [Module System](./language/module-system.md) - ESM imports and rules
- [Namespaces](./language/namespaces.md) - Directory to namespace mapping
- [Type Mappings](./language/type-mappings.md) - TypeScript to C# types
- [Runtime](./language/runtime.md) - Tsonic.Runtime API
- [.NET Interop](./language/dotnet-interop.md) - Using .NET libraries
- [Generators](./language/generators.md) - Generator functions
- [Types & Interfaces](./language/types-and-interfaces.md) - Interfaces and type aliases
- [Entry Points](./language/entry-points.md) - Program entry points

### Examples

- [Basic Examples](./examples/basic.md) - Functions, classes, control flow
- [Array Examples](./examples/arrays.md) - Array operations
- [.NET Examples](./examples/dotnet.md) - Using .NET libraries
- [Import Examples](./examples/imports.md) - Module imports

## Philosophy

Tsonic follows these core principles:

1. **.NET-First**: This is a better language for .NET, not a JavaScript runtime
2. **No Magic**: Clear, predictable mappings - error clearly instead of guessing
3. **Native Types**: Use .NET types directly - no wrapper classes
4. **Explicit Over Implicit**: All dependencies visible and explicit

## Use Cases

Tsonic is great for:

- **CLI Tools**: Fast-starting command-line utilities
- **Microservices**: High-performance HTTP services
- **System Utilities**: File processing, automation scripts
- **Data Processing**: Batch jobs, ETL pipelines
- **Anything that benefits from NativeAOT**: Fast startup, small size, no runtime

## Platform Support

Tsonic compiles to NativeAOT, supporting:

- **Windows**: x64, ARM64
- **Linux**: x64, ARM64, musl (Alpine)
- **macOS**: x64 (Intel), ARM64 (Apple Silicon)

## Requirements

- **.NET SDK**: .NET 8.0 or later
- **Node.js**: 18.0 or later (for TypeScript compiler)
- **Operating System**: Windows, macOS, or Linux

## Community

- **Issues**: Report bugs on GitHub
- **Discussions**: Ask questions on GitHub Discussions
- **Contributing**: See CONTRIBUTING.md

## License

Tsonic is open source. See LICENSE file for details.

## Next Steps

Ready to start? Head to the [Getting Started](./getting-started.md) guide!
