# tsonic

TypeScript to C# to NativeAOT compiler.

## Installation

```bash
npm install -g tsonic
```

Or in a project:

```bash
npm install -D tsonic
```

## Usage

```bash
# Initialize a new project (creates tsonic.json, src/App.ts, etc.)
tsonic project init

# Build TypeScript to native binary
tsonic build src/App.ts

# Generate C# only (no compilation)
tsonic generate src/App.ts
```

If installed as a dev dependency, use `npx`:

```bash
npx tsonic build src/App.ts
```

## Requirements

- Node.js >= 22.0.0
- .NET SDK 10.0 or later

## Documentation

See https://github.com/tsoniclang/tsonic for full documentation.

## License

MIT
