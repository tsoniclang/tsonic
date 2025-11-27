# @tsonic/tsonic

TypeScript to C# to NativeAOT compiler.

## Installation

```bash
npm install -D @tsonic/tsonic
```

## Usage

```bash
# Initialize a new project
npx tsonic init --runtime dotnet

# Build TypeScript to native binary
npx tsonic build src/main.ts

# Emit C# only (no compilation)
npx tsonic emit src/main.ts
```

## Runtime Modes

- `dotnet` - Pure .NET BCL, minimal helpers
- `js` - JavaScript-compatible semantics via Tsonic.JSRuntime

## Requirements

- Node.js >= 22.0.0
- .NET SDK 10.0 or later

## Documentation

See https://github.com/tsoniclang/tsonic for full documentation.

## License

MIT
