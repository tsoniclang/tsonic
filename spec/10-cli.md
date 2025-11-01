# CLI Specification

## Commands

### tsonic emit

Generate C# code without building.

```bash
tsonic emit <entry> [options]
```

**Use Cases:**

- Inspect generated C# code
- Debug type mappings
- Integrate with custom build pipelines

**Examples:**

```bash
# Basic emission
tsonic emit src/main.ts

# Specify output directory
tsonic emit src/main.ts --out generated/

# Override namespace
tsonic emit src/main.ts --namespace MyCompany.Product
```

### tsonic build

Compile TypeScript to native executable via NativeAOT.

```bash
tsonic build <entry> [options]
```

**Use Cases:**

- Production builds
- Creating distributable executables
- CI/CD pipelines

**Examples:**

```bash
# Build for current platform
tsonic build src/main.ts

# Cross-compile for Linux
tsonic build src/main.ts --rid linux-x64 --out myapp

# Keep build artifacts for debugging
tsonic build src/main.ts --keep-temp
```

### tsonic run

Build and immediately execute.

```bash
tsonic run <entry> [options]
```

**Use Cases:**

- Development workflow
- Quick testing
- Script execution

**Examples:**

```bash
# Run with default settings
tsonic run src/main.ts

# Pass arguments to the program
tsonic run src/main.ts -- --config prod.json
```

## Options

### Global Options

| Option                   | Short | Description                             | Default |
| ------------------------ | ----- | --------------------------------------- | ------- |
| `--help`                 | `-h`  | Show help                               | -       |
| `--version`              | `-v`  | Show version                            | -       |
| `--verbose`              | `-V`  | Verbose output                          | false   |
| `--quiet`                | `-q`  | Suppress output                         | false   |
| `--diagnostics <format>` | `-d`  | Diagnostic format: json, pretty, silent | pretty  |

### Command Options

#### emit & build & run

| Option             | Short | Description                             | Default               |
| ------------------ | ----- | --------------------------------------- | --------------------- |
| `--src <dir>`      | `-s`  | Source root directory                   | dirname(entry)        |
| `--out <path>`     | `-o`  | Output directory (emit) or file (build) | ./out or ./tsonic-app |
| `--namespace <ns>` | `-n`  | Root namespace override                 | from package.json     |
| `--config <file>`  | `-c`  | Config file path                        | package.json          |

#### build & run only

| Option               | Short | Description               | Default     |
| -------------------- | ----- | ------------------------- | ----------- |
| `--rid <rid>`        | `-r`  | Runtime identifier        | auto-detect |
| `--optimize <level>` | `-O`  | Optimization: size, speed | speed       |
| `--keep-temp`        | `-k`  | Keep build artifacts      | false       |
| `--no-strip`         |       | Keep debug symbols        | false       |
| `--packages <list>`  | `-p`  | Additional NuGet packages | auto-detect |

#### run only

| Option | Short | Description                    | Default |
| ------ | ----- | ------------------------------ | ------- |
| `--`   |       | Pass remaining args to program | -       |

## Configuration File

### package.json

```json
{
  "name": "my-app",
  "type": "module",
  "tsonic": {
    "rootNamespace": "MyApp",
    "outputName": "myapp",
    "rid": "linux-x64",
    "optimize": "size",
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
}
```

### tsonic.json

Alternative standalone config:

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "dist",
  "rid": "linux-x64",
  "packages": [],
  "buildOptions": {
    "optimize": "speed",
    "stripSymbols": false
  }
}
```

## Exit Codes

| Code | Meaning                     |
| ---- | --------------------------- |
| 0    | Success                     |
| 1    | General error               |
| 2    | Invalid arguments           |
| 3    | File not found              |
| 4    | TypeScript errors           |
| 5    | C# emission errors          |
| 6    | Build errors                |
| 7    | Runtime error (run command) |
| 8    | .NET SDK not found          |

## Environment Variables

| Variable         | Description                            |
| ---------------- | -------------------------------------- |
| `TSONIC_HOME`    | Override Tsonic installation directory |
| `TSONIC_CACHE`   | Build cache directory                  |
| `TSONIC_DOTNET`  | Path to dotnet executable              |
| `TSONIC_VERBOSE` | Enable verbose output (1 or true)      |
| `TSONIC_COLOR`   | Force color output (1 or true)         |
| `NO_COLOR`       | Disable color output (standard)        |

## Output Formats

### Pretty (default)

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

### Verbose

```
[DEBUG] Loading configuration from package.json
[DEBUG] Root namespace: MyApp
[INFO] Processing entry: src/main.ts
[DEBUG] Creating TypeScript program
[DEBUG] Found 3 source files
[DEBUG] Resolving imports...
[DEBUG]   ./models/User.ts → resolved
[DEBUG]   System.Text.Json → .NET namespace
[INFO] Building IR...
[DEBUG] Processing src/main.ts
[DEBUG]   Found 2 exports
[DEBUG]   Found 3 imports
...
```

## Usage Examples

### Basic Workflow

```bash
# Development iteration
tsonic emit src/main.ts        # Check generated C#
tsonic run src/main.ts          # Test execution

# Production build
tsonic build src/main.ts --rid linux-x64 --optimize size --out myapp
```

### Cross-Platform Builds

```bash
# Build for multiple platforms
tsonic build src/main.ts --rid win-x64 --out dist/myapp.exe
tsonic build src/main.ts --rid linux-x64 --out dist/myapp-linux
tsonic build src/main.ts --rid osx-arm64 --out dist/myapp-mac
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Build with Tsonic
  run: |
    npm install -g @tsonic/cli
    tsonic build src/main.ts \
      --rid linux-x64 \
      --optimize size \
      --diagnostics json \
      --out ${{ github.workspace }}/artifacts/app
```

### Debug Build

```bash
# Keep symbols and temp files for debugging
tsonic build src/main.ts \
  --keep-temp \
  --no-strip \
  --verbose
```

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

## Interactive Mode (Future)

```bash
tsonic repl            # Interactive REPL
tsonic watch src/      # Watch mode
tsonic init           # Initialize new project
tsonic add <package>  # Add NuGet package
```

## Shell Completion

```bash
# Bash
tsonic completion bash >> ~/.bashrc

# Zsh
tsonic completion zsh >> ~/.zshrc

# PowerShell
tsonic completion powershell >> $PROFILE
```

## Performance Flags

```bash
# Parallel compilation
tsonic build src/main.ts --parallel 4

# Use build cache
tsonic build src/main.ts --cache

# Incremental compilation
tsonic build src/main.ts --incremental
```

## Security Flags

```bash
# Sandbox builds
tsonic build src/main.ts --sandbox

# Verify packages
tsonic build src/main.ts --verify-packages

# Audit dependencies
tsonic audit src/
```
