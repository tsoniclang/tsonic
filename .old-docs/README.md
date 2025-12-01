# Tsonic

**Compile TypeScript to NativeAOT executables.**

Tsonic is a compiler that takes TypeScript code and produces fast, self-contained native binaries using .NET's NativeAOT technology.

## Quick Start

```typescript
// hello.ts
export function main() {
  console.log("Hello, Tsonic!");
}
```

```bash
$ npm install -g @tsonic/cli
$ tsonic build hello.ts
$ ./hello
Hello, Tsonic!
```

## Documentation

- **[User Guide](docs/index.md)** - Getting started, language guide, examples
- **[Engineering Specs](spec/index.md)** - Internal architecture (for contributors)

## Features

- ✅ TypeScript → C# → NativeAOT compilation
- ✅ Single-file executables, no runtime dependencies
- ✅ Full .NET library access
- ✅ Native performance
- ✅ ESM modules with `.ts` extensions
- ✅ Direct namespace mapping (directory → C# namespace)

## Installation

```bash
npm install -g @tsonic/cli
```

**Requirements:**

- Node.js 22+
- .NET SDK 8.0+

## Commands

```bash
tsonic build <file>     # Compile to executable
tsonic emit <file>      # Generate C# only
tsonic run <file>       # Build and run
tsonic init             # Initialize project
```

See [CLI Reference](docs/cli.md) for all options.

## Example

```typescript
// File I/O with .NET
import { File } from "System.IO";

export function main() {
  File.WriteAllText("hello.txt", "Hello from Tsonic!");
  const content = File.ReadAllText("hello.txt");
  console.log(content);
}
```

## Project Status

**Current Phase:** MVP (Phases 0-6 complete, Phase 7-8 in progress)

- ✅ TypeScript parsing
- ✅ IR building
- ✅ C# emission (basic features)
- ✅ NativeAOT compilation
- 🔄 Advanced generics
- 🔄 Generators
- 🔄 Full .NET interop

See [Implementation Plan](spec/appendices/implementation-plan.md) for roadmap.

## Contributing

1. Read [CLAUDE.md](CLAUDE.md) for development guidelines
2. Read [CODING-STANDARDS.md](CODING-STANDARDS.md) for functional programming rules
3. Review [Engineering Specs](spec/index.md) for architecture
4. Follow the functional programming patterns (no mutations!)

## License

MIT

## Links

- [GitHub](https://github.com/tsoniclang/tsonic)
- [Documentation](docs/index.md)
- [Examples](docs/examples/index.md)
