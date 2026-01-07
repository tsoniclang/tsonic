# Getting Started

This guide walks you through installing Tsonic and building your first program.

## Prerequisites

### Node.js 22+

Download from [nodejs.org](https://nodejs.org/) or use a version manager:

```bash
# Using nvm
nvm install 22
nvm use 22

# Verify
node --version
```

### .NET 10 SDK

Download from [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/10.0):

```bash
# Linux (Ubuntu/Debian)
sudo apt-get install dotnet-sdk-10.0

# macOS
brew install dotnet-sdk

# Verify
dotnet --version
```

## Installation

### Global Installation (Recommended)

```bash
npm install -g tsonic
```

Verify:

```bash
tsonic --version
```

### Local Installation

For project-specific usage:

```bash
npm install --save-dev tsonic
npx tsonic --version
```

## Creating a Project

### Using project init

The easiest way to start:

```bash
mkdir my-app
cd my-app
tsonic project init
```

This creates:

```
my-app/
├── src/
│   └── App.ts           # Entry point
├── tsonic.json          # Configuration
├── package.json         # NPM package with scripts
├── .gitignore           # Ignores generated/ and out/
└── README.md            # Project readme
```

### Project Init Options

```bash
# Skip installing type packages
tsonic project init --skip-types

# Specify type package version
tsonic project init --types-version <ver>
```

### Manual Setup

If you prefer manual setup:

1. Create `tsonic.json`:

```json
{
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts",
  "sourceRoot": "src"
}
```

2. Create `src/App.ts`:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.writeLine("Hello!");
}
```

3. Install type packages:

```bash
npm install --save-dev tsonic @tsonic/core @tsonic/globals
```

## Building and Running

### Build Command

Generate C# and compile to native:

```bash
tsonic build src/App.ts
```

Output goes to `out/app` (or `out/app.exe` on Windows).

### Run Command

Build and execute in one step:

```bash
tsonic run src/App.ts
```

### NPM Scripts

The generated `package.json` includes convenience scripts:

```bash
npm run build    # tsonic build src/App.ts
npm run dev      # tsonic run src/App.ts
```

## Understanding the Output

After building:

```
my-app/
├── generated/           # Generated C# code
│   ├── src/
│   │   └── App.cs       # Your code as C#
│   ├── Program.cs       # Entry point wrapper
│   └── tsonic.csproj    # .NET project file
└── out/
    └── app              # Native executable
```

### Generated C# (Example)

Your TypeScript:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.writeLine("Hello!");
}
```

Becomes:

```csharp
namespace MyApp.src
{
    public static class App
    {
        public static void main()
        {
            global::System.Console.WriteLine("Hello!");
        }
    }
}
```

## Next Steps

- [CLI Reference](cli.md) - All commands and options
- [Configuration](configuration.md) - tsonic.json in detail
- [Language Guide](language.md) - TypeScript features supported
- [.NET Interop](dotnet-interop.md) - Using .NET libraries

### Specialized Guides

- [Numeric Types](numeric-types.md) - Integer types and narrowing
- [Generators](generators.md) - Sync, async, and bidirectional generators
- [Callbacks](callbacks.md) - Action and Func patterns
- [Async Patterns](async-patterns.md) - Async/await and for-await
