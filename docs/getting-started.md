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

### macOS: Xcode Command Line Tools

Required for NativeAOT builds on macOS:

```bash
xcode-select --install

# Verify
xcrun --show-sdk-path
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

### Using `tsonic init`

The easiest way to start:

```bash
mkdir my-app
cd my-app
tsonic init
```

This creates:

```
my-app/
├── tsonic.workspace.json     # Workspace config (dependencies live here)
├── libs/                     # Workspace-scoped DLLs
├── packages/
│   └── my-app/
│       ├── tsonic.json       # Project config
│       ├── package.json      # Project package.json (minimal)
│       └── src/App.ts        # Entry point
├── package.json              # Workspace package.json (npm workspaces + scripts)
└── .gitignore                # Ignores generated/, out/, node_modules/, .tsonic/
```

### Init Options

```bash
# Enable JavaScript runtime APIs (@tsonic/js)
tsonic init --js

# Enable Node.js compatibility APIs (@tsonic/nodejs)
tsonic init --nodejs

# Skip installing type packages
tsonic init --skip-types

# Specify type package version
tsonic init --types-version <ver>
```

### Adding JS/NodeJS to an existing workspace

If you already have a Tsonic workspace and want JSRuntime or Node.js APIs later:

```bash
tsonic add js
tsonic add nodejs
```

## Building and Running

### Build Command

Generate C# and compile to native:

```bash
tsonic build
```

Output goes to `packages/<project>/out/<app>` (or `.exe` on Windows).

If your workspace has multiple projects, select one explicitly:

```bash
tsonic build --project my-app
```

### Run Command

Build and execute in one step:

```bash
tsonic run
```

### NPM Scripts

The generated `package.json` includes convenience scripts:

```bash
npm run build    # tsonic build
npm run dev      # tsonic run
```

## Understanding the Output

After building:

```
my-app/
└── packages/
    └── my-app/
        ├── generated/           # Generated C# code
        │   ├── src/
        │   │   └── App.cs       # Your code as C#
        │   ├── Program.cs       # Entry point wrapper
        │   └── tsonic.csproj    # .NET project file
        └── out/
            └── my-app           # Native executable
```

### Generated C# (Example)

Your TypeScript:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello!");
}
```

Becomes:

```csharp
namespace MyApp
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
- [Configuration](configuration.md) - Workspace + project config
- [Language Guide](language.md) - TypeScript features supported
- [.NET Interop](dotnet-interop.md) - Using .NET libraries

### Specialized Guides

- [Numeric Types](numeric-types.md) - Integer types and narrowing
- [Generators](generators.md) - Sync, async, and bidirectional generators
- [Callbacks](callbacks.md) - Action and Func patterns
- [Async Patterns](async-patterns.md) - Async/await and for-await
