# CLI Reference

Complete reference for the `tsonic` command-line interface.

## Commands

### tsonic emit

Generate C# code without building.

```bash
tsonic emit <entry> [options]
```

**Purpose**: Inspect the C# code that Tsonic generates from your TypeScript, useful for debugging type mappings or understanding output.

**Examples**:

```bash
# Basic emission
tsonic emit src/main.ts

# Specify output directory
tsonic emit src/main.ts --out generated/

# Override namespace
tsonic emit src/main.ts --namespace MyCompany.Product
```

**Use When**:
- Debugging code generation
- Learning how TypeScript maps to C#
- Integrating with custom build pipelines

---

### tsonic build

Compile TypeScript to native executable via NativeAOT.

```bash
tsonic build <entry> [options]
```

**Purpose**: Create a standalone native executable for production use.

**Examples**:

```bash
# Build for current platform
tsonic build src/main.ts

# Cross-compile for Linux
tsonic build src/main.ts --rid linux-x64 --out myapp-linux

# Optimize for size
tsonic build src/main.ts --optimize size --out myapp-small

# Keep build artifacts for debugging
tsonic build src/main.ts --keep-temp --verbose
```

**Build Output**:
- Single-file native executable
- No .NET runtime required
- Typical size: 10-50 MB
- Fast startup (no JIT)

---

### tsonic run

Build and immediately execute.

```bash
tsonic run <entry> [options] [-- program-args]
```

**Purpose**: Quick development workflow - compile and run in one step.

**Examples**:

```bash
# Run with default settings
tsonic run src/main.ts

# Pass arguments to the program
tsonic run src/main.ts -- --config prod.json --verbose

# Run with custom namespace
tsonic run src/main.ts --namespace TestApp
```

**Note**: The `--` separator is important when passing arguments to your program.

---

## Global Options

Available for all commands:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--help` | `-h` | Show help | - |
| `--version` | `-v` | Show version | - |
| `--verbose` | `-V` | Verbose output | false |
| `--quiet` | `-q` | Suppress output | false |
| `--diagnostics <format>` | `-d` | Diagnostic format: `json`, `pretty`, `silent` | pretty |

**Examples**:

```bash
# Get help for a command
tsonic build --help

# Check Tsonic version
tsonic --version

# Verbose build
tsonic build src/main.ts --verbose

# JSON diagnostics for CI
tsonic build src/main.ts --diagnostics json
```

---

## Command Options

### emit & build & run

These options work for all three commands:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--src <dir>` | `-s` | Source root directory | dirname(entry) |
| `--out <path>` | `-o` | Output directory (emit) or file (build) | ./out or ./tsonic-app |
| `--namespace <ns>` | `-n` | Root namespace override | from tsonic.json |
| `--config <file>` | `-c` | Config file path | tsonic.json |

**Examples**:

```bash
# Custom source root
tsonic build main.ts --src project/src

# Custom output
tsonic emit main.ts --out generated/csharp

# Override namespace
tsonic run main.ts --namespace MyCompany.MyApp

# Custom config
tsonic build main.ts --config tsonic.production.json
```

### build & run only

Additional options for building executables:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--rid <rid>` | `-r` | Runtime identifier | auto-detect |
| `--optimize <level>` | `-O` | Optimization: `size`, `speed` | speed |
| `--keep-temp` | `-k` | Keep build artifacts | false |
| `--no-strip` | | Keep debug symbols | false |
| `--packages <list>` | `-p` | Additional NuGet packages | auto-detect |

**Examples**:

```bash
# Cross-compile for Linux
tsonic build main.ts --rid linux-x64

# Optimize for size
tsonic build main.ts --optimize size

# Keep temp files for debugging
tsonic build main.ts --keep-temp --no-strip

# Add NuGet packages
tsonic build main.ts --packages Newtonsoft.Json:13.0.3,Dapper:2.1.0
```

### run only

Additional option for the run command:

| Option | Description |
|--------|-------------|
| `--` | Pass remaining args to program |

**Example**:

```bash
# Pass arguments to your program
tsonic run main.ts -- --config prod.json --port 8080
```

---

## Configuration File

### tsonic.json

Create `tsonic.json` in your project root for persistent configuration:

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "dist",
  "outputName": "myapp",
  "rid": "linux-x64",
  "optimize": "speed",
  "packages": [
    {
      "name": "Newtonsoft.Json",
      "version": "13.0.3"
    }
  ],
  "buildOptions": {
    "stripSymbols": true,
    "invariantGlobalization": true
  }
}
```

With this file, you can just run:

```bash
tsonic build  # Uses settings from tsonic.json
```

**Note**: Tsonic configuration is NOT supported in `package.json`. Use `tsonic.json` only.

---

## Runtime Identifiers (RID)

Common RIDs for NativeAOT:

| Platform | RID | Notes |
|----------|-----|-------|
| Windows x64 | `win-x64` | Windows 10+ |
| Windows ARM64 | `win-arm64` | Windows 11 ARM |
| Linux x64 | `linux-x64` | Most Linux distros |
| Linux ARM64 | `linux-arm64` | ARM Linux |
| Linux musl x64 | `linux-musl-x64` | Alpine Linux |
| macOS x64 | `osx-x64` | Intel Macs |
| macOS ARM64 | `osx-arm64` | M1/M2/M3 Macs |

**Auto-detection**: If you don't specify `--rid`, Tsonic detects your platform automatically.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | File not found |
| 4 | TypeScript errors |
| 5 | C# emission errors |
| 6 | Build errors |
| 7 | Runtime error (run command) |
| 8 | .NET SDK not found |

**Use in CI/CD**:

```bash
if tsonic build src/main.ts; then
  echo "Build succeeded"
else
  echo "Build failed with code $?"
  exit 1
fi
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TSONIC_HOME` | Override Tsonic installation directory |
| `TSONIC_CACHE` | Build cache directory |
| `TSONIC_DOTNET` | Path to dotnet executable |
| `TSONIC_VERBOSE` | Enable verbose output (1 or true) |
| `TSONIC_COLOR` | Force color output (1 or true) |
| `NO_COLOR` | Disable color output (standard) |

**Examples**:

```bash
# Use custom .NET SDK
export TSONIC_DOTNET=/opt/dotnet/dotnet
tsonic build main.ts

# Enable verbose by default
export TSONIC_VERBOSE=1
tsonic build main.ts
```

---

## Output Formats

### Pretty (default)

Human-readable output with colors:

```
✓ Parsing TypeScript files... (125ms)
✓ Building IR... (89ms)
✓ Emitting C# code... (156ms)
✓ Running dotnet publish... (8.5s)
✓ Build complete: ./myapp (15.2 MB)

  3 files processed
  0 warnings
  0 errors
```

### JSON

Machine-readable output for CI:

```json
{
  "success": true,
  "steps": [
    {
      "name": "parse",
      "duration": 125,
      "filesProcessed": 3
    },
    {
      "name": "build",
      "duration": 8500
    }
  ],
  "output": "./myapp",
  "size": 15921664,
  "diagnostics": []
}
```

**Usage**:

```bash
tsonic build main.ts --diagnostics json > build-result.json
```

### Verbose

Detailed debug output:

```
[DEBUG] Loading configuration from tsonic.json
[DEBUG] Root namespace: MyApp
[INFO] Processing entry: src/main.ts
[DEBUG] Creating TypeScript program
[DEBUG] Found 3 source files
[DEBUG] Resolving imports...
[DEBUG]   ./models/User.ts → resolved
[DEBUG]   System.Text.Json → .NET namespace
[INFO] Building IR...
[DEBUG] Processing src/main.ts
...
```

**Usage**:

```bash
tsonic build main.ts --verbose
```

---

## Common Workflows

### Development

```bash
# Quick iteration
tsonic run src/main.ts

# Check generated C#
tsonic emit src/main.ts --out .tsonic/emit
less .tsonic/emit/main.cs
```

### CI/CD

```bash
# Production build with JSON output
tsonic build src/main.ts \
  --rid linux-x64 \
  --optimize size \
  --diagnostics json \
  --out artifacts/app
```

### Cross-Platform Builds

```bash
# Build for multiple platforms
tsonic build src/main.ts --rid win-x64 --out dist/myapp.exe
tsonic build src/main.ts --rid linux-x64 --out dist/myapp-linux
tsonic build src/main.ts --rid osx-arm64 --out dist/myapp-mac
```

### Debug Build

```bash
# Keep all artifacts and symbols
tsonic build src/main.ts \
  --keep-temp \
  --no-strip \
  --verbose \
  --out myapp-debug
```

---

## Diagnostics Integration

### Error Display

```
src/models/User.ts:15:3
  15 | import { helper } from "./helper";
     |                        ^^^^^^^^^^
ERROR TSN1001: Local import missing .ts extension

src/services/data.ts:8:12
   8 | const x: symbol = Symbol();
     |          ^^^^^^
ERROR TSN2005: Type 'symbol' is not supported

2 errors found. Build failed.
```

### Warning Display

```
src/utils/math.ts:10:5
  10 | const result = arr.map(x => x * 2);
     |                    ^^^
WARNING TSN3002: Array.map() not yet supported. Use a for loop.
```

See [Diagnostics](./diagnostics.md) for all error codes and fixes.

---

## Next Steps

- **[Build Output](./build-output.md)** - Understand what gets emitted
- **[Diagnostics](./diagnostics.md)** - Error code reference
- **[Examples](./examples/index.md)** - See the CLI in action
