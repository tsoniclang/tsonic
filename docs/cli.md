# CLI Reference

Complete reference for all Tsonic CLI commands and options.

## Synopsis

```
tsonic <command> [options]
```

## Commands

### project init

Initialize a new Tsonic project in the current directory.

```bash
tsonic project init [options]
```

**Options:**

| Option                  | Description                       | Default |
| ----------------------- | --------------------------------- | ------- |
| `--runtime <mode>`      | Runtime mode: `js` or `dotnet`    | `js`    |
| `--skip-types`          | Skip installing type declarations | `false` |
| `--types-version <ver>` | Version of type declarations      | Latest  |

**Examples:**

```bash
# Initialize with defaults (JS mode)
tsonic project init

# Initialize with dotnet mode
tsonic project init --runtime dotnet

# Skip type package installation
tsonic project init --skip-types
```

**Created Files:**

- `tsonic.json` - Project configuration
- `package.json` - NPM package with scripts
- `src/App.ts` - Entry point with sample code
- `.gitignore` - Ignores build artifacts
- `README.md` - Project readme

### emit

Generate C# code from TypeScript without compiling.

```bash
tsonic emit <entry> [options]
```

**Arguments:**

| Argument  | Description                           | Required |
| --------- | ------------------------------------- | -------- |
| `<entry>` | Entry point file (e.g., `src/App.ts`) | Yes      |

**Options:**

| Option             | Short | Description           | Default       |
| ------------------ | ----- | --------------------- | ------------- |
| `--config <file>`  | `-c`  | Config file path      | `tsonic.json` |
| `--src <dir>`      | `-s`  | Source root directory | From config   |
| `--out <path>`     | `-o`  | Output directory      | `generated`   |
| `--namespace <ns>` | `-n`  | Root namespace        | From config   |
| `--verbose`        | `-V`  | Verbose output        | `false`       |
| `--quiet`          | `-q`  | Suppress output       | `false`       |
| `--lib <path>`     | `-L`  | External library path | None          |

**Examples:**

```bash
# Basic emit
tsonic emit src/App.ts

# Custom output directory
tsonic emit src/App.ts --out build

# With external library
tsonic emit src/App.ts --lib ./libs/MyLib
```

**Output:**

```
generated/
├── src/
│   └── App.cs           # Your code as C#
├── Program.cs           # Entry point wrapper
└── tsonic.csproj        # .NET project file
```

### build

Build a native executable from TypeScript.

```bash
tsonic build <entry> [options]
```

**Arguments:**

| Argument  | Description      | Required |
| --------- | ---------------- | -------- |
| `<entry>` | Entry point file | Yes      |

**Options:**

| Option               | Short | Description                     | Default       |
| -------------------- | ----- | ------------------------------- | ------------- |
| `--config <file>`    | `-c`  | Config file path                | `tsonic.json` |
| `--src <dir>`        | `-s`  | Source root directory           | From config   |
| `--out <path>`       | `-o`  | Output file name                | From config   |
| `--namespace <ns>`   | `-n`  | Root namespace                  | From config   |
| `--rid <rid>`        | `-r`  | Runtime identifier              | Auto-detected |
| `--optimize <level>` | `-O`  | Optimization: `size` or `speed` | `speed`       |
| `--keep-temp`        | `-k`  | Keep build artifacts            | `false`       |
| `--no-strip`         |       | Keep debug symbols              | `false`       |
| `--verbose`          | `-V`  | Verbose output                  | `false`       |
| `--quiet`            | `-q`  | Suppress output                 | `false`       |
| `--lib <path>`       | `-L`  | External library path           | None          |

**Runtime Identifiers (RID):**

| Platform      | RID           |
| ------------- | ------------- |
| Linux x64     | `linux-x64`   |
| Linux ARM64   | `linux-arm64` |
| macOS x64     | `osx-x64`     |
| macOS ARM64   | `osx-arm64`   |
| Windows x64   | `win-x64`     |
| Windows ARM64 | `win-arm64`   |

**Examples:**

```bash
# Basic build
tsonic build src/App.ts

# Cross-compile for Linux
tsonic build src/App.ts --rid linux-x64

# Optimize for size
tsonic build src/App.ts --optimize size

# Keep build artifacts for debugging
tsonic build src/App.ts --keep-temp --no-strip
```

**Build Steps:**

1. **Step 1/3**: Generate C# code (same as `emit`)
2. **Step 2/3**: Run `dotnet publish` with NativeAOT
3. **Step 3/3**: Copy output to `out/`

### run

Build and run the executable in one step.

```bash
tsonic run <entry> [-- args...]
```

**Arguments:**

| Argument     | Description                    | Required |
| ------------ | ------------------------------ | -------- |
| `<entry>`    | Entry point file               | Yes      |
| `-- args...` | Arguments passed to executable | No       |

**Options:**

Same as `build` command.

**Examples:**

```bash
# Build and run
tsonic run src/App.ts

# Pass arguments to executable
tsonic run src/App.ts -- --input data.txt --verbose

# With build options
tsonic run src/App.ts --verbose -- --debug
```

## Global Options

These options work with all commands:

| Option             | Short | Description      |
| ------------------ | ----- | ---------------- |
| `--help`           | `-h`  | Show help        |
| `--version`        | `-v`  | Show version     |
| `--verbose`        | `-V`  | Verbose output   |
| `--quiet`          | `-q`  | Suppress output  |
| `--config <file>`  | `-c`  | Config file path |
| `--runtime <mode>` |       | Runtime mode     |

## Exit Codes

| Code | Meaning                 |
| ---- | ----------------------- |
| 0    | Success                 |
| 1    | Build/compilation error |
| 2    | Configuration error     |
| 3    | Runtime error           |

## Environment Variables

| Variable         | Description           |
| ---------------- | --------------------- |
| `TSONIC_VERBOSE` | Enable verbose output |
| `DOTNET_ROOT`    | .NET SDK location     |

## Configuration File Resolution

Tsonic looks for configuration in this order:

1. Path specified with `--config`
2. `tsonic.json` in current directory
3. `tsonic.json` in parent directories (walks up)

## Examples

### Complete Workflow

```bash
# Create project
mkdir my-cli && cd my-cli
tsonic project init --runtime dotnet

# Edit src/App.ts
# ...

# Build
tsonic build src/App.ts

# Run
./out/app

# Or build and run together
tsonic run src/App.ts
```

### Library Mode

```bash
# Build as library
tsonic build src/lib.ts --config tsonic.library.json

# Output in dist/
ls dist/
```

### Cross-Compilation

```bash
# Build for multiple platforms
tsonic build src/App.ts --rid linux-x64 --out app-linux
tsonic build src/App.ts --rid osx-arm64 --out app-macos
tsonic build src/App.ts --rid win-x64 --out app-windows
```
