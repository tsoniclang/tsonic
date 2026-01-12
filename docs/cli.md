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

| Option                  | Description                                               | Default |
| ----------------------- | --------------------------------------------------------- | ------- |
| `--nodejs`              | Enable Node.js interop (installs @tsonic/nodejs)          | `false` |
| `--pure`                | Use PascalCase .NET bindings (installs @tsonic/globals-pure) | `false` |
| `--skip-types`          | Skip installing type declarations                         | `false` |
| `--types-version <ver>` | Version of type declarations                              | Latest  |

**Examples:**

```bash
# Initialize a new project
tsonic project init

# Enable Node.js interop (fs, path, etc.)
tsonic project init --nodejs

# Use PascalCase for BCL methods (WriteLine instead of writeLine)
tsonic project init --pure

# Skip type package installation
tsonic project init --skip-types

# Use specific type package version
tsonic project init --types-version <ver>
```

**Created Files:**

- `tsonic.json` - Project configuration
- `package.json` - NPM package with scripts
- `src/App.ts` - Entry point with sample code
- `.gitignore` - Ignores build artifacts
- `README.md` - Project readme

### generate

Generate C# code from TypeScript without compiling.

```bash
tsonic generate <entry> [options]
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
| `--out <name>`     | `-o`  | Output name (assembly/binary) | From config   |
| `--namespace <ns>` | `-n`  | Root namespace        | From config   |
| `--verbose`        | `-V`  | Verbose output        | `false`       |
| `--quiet`          | `-q`  | Suppress output       | `false`       |
| `--lib <path>`     | `-L`  | External library path | None          |

**Examples:**

```bash
# Basic generate
tsonic generate src/App.ts

# Override output name (assembly/binary)
tsonic generate src/App.ts --out my-app

# With external library
tsonic generate src/App.ts --lib ./libs/MyLib
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
| `--out <name>`       | `-o`  | Output name (binary/assembly)   | From config   |
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

1. **Step 1/3**: Generate C# code (same as `generate`)
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

### add package

Add a local DLL (and bindings) to the project.

```bash
tsonic add package <dll-path> [types-package]
```

**Arguments:**

| Argument          | Description                 | Required |
| ----------------- | --------------------------- | -------- |
| `<dll-path>`      | Path to the .NET DLL file   | Yes      |
| `[types-package]` | npm package with type decls | No (auto-generated if omitted) |

**Options:**

| Option      | Short | Description     | Default |
| ----------- | ----- | --------------- | ------- |
| `--verbose` | `-V`  | Verbose output  | `false` |
| `--quiet`   | `-q`  | Suppress output | `false` |
| `--deps <dir>` | - | Additional directory to probe for referenced assemblies (repeatable) | - |

**Examples:**

```bash
# Add a custom library
tsonic add package ./libs/MyLib.dll @myorg/mylib-types

# Auto-generate bindings (tsbindgen) when types are omitted
tsonic add package ./libs/MyLib.dll

# If the DLL references other DLLs in a custom folder
tsonic add package ./libs/MyLib.dll --deps ./libs/deps
```

**What it does:**

1. Resolves the DLL dependency closure and copies non-framework DLLs to `lib/` (no "copy-all" behavior)
2. Updates your config file (`--config` respected):
   - Adds copied DLLs to `dotnet.libraries`
   - Adds any required shared frameworks to `dotnet.frameworkReferences`
3. If `types-package` is provided: installs it via npm
4. If `types-package` is omitted:
   - Runs tsbindgen for **every non-framework DLL in the closure** (A, B, C, …)
   - Writes generated bindings under `.tsonic/bindings/dll/<name>-types/` (gitignored)
   - Installs them into `node_modules/<name>-types/` (without modifying `package.json`)

### add nuget

Add a NuGet package reference (and bindings) to the project.

```bash
tsonic add nuget <package-id> <version> [types-package]
```

**Arguments:**

| Argument | Description | Required |
| --- | --- | --- |
| `<package-id>` | NuGet package id | Yes |
| `<version>` | Exact NuGet version | Yes |
| `[types-package]` | npm package with type decls | No (auto-generated if omitted) |

**Examples:**

```bash
# Add and auto-generate bindings
tsonic add nuget Microsoft.Extensions.Logging 10.0.0

# Add but use published bindings instead
tsonic add nuget Microsoft.EntityFrameworkCore 10.0.1 @tsonic/efcore
```

**What it does (auto-generated bindings):**

- Restores the NuGet package graph for the project (`dotnet restore`)
- Generates bindings for the full **transitive closure** of packages (A, B, C, …)
- Emits **one bindings package per NuGet package** under `.tsonic/bindings/nuget/<id>-types/`
- Installs them into `node_modules/<id>-types/` (without modifying `package.json`)

**Using published bindings packages (no auto-generation):**

If you pass a `types-package`, Tsonic records it in your config so `tsonic restore` knows
bindings are supplied externally and will not attempt to generate them:

```json
{
  "dotnet": {
    "packageReferences": [
      {
        "id": "Microsoft.EntityFrameworkCore",
        "version": "10.0.1",
        "types": "@tsonic/efcore"
      }
    ]
  }
}
```

### update nuget

Update an existing NuGet package reference (and bindings) in the project.

```bash
tsonic update nuget <package-id> <version> [types-package]
```

**Examples:**

```bash
# Update pinned NuGet version (auto-generated bindings)
tsonic update nuget Microsoft.Extensions.Logging 10.0.1

# Switch to published bindings (no auto-generation)
tsonic update nuget Microsoft.EntityFrameworkCore 10.0.1 @tsonic/efcore
```

**What it does:**

- Updates the matching entry in `dotnet.packageReferences` in your config (`--config` respected)
- Runs `tsonic restore` to validate restore + keep local bindings consistent

### remove nuget

Remove a NuGet package reference (and refresh bindings) from the project.

```bash
tsonic remove nuget <package-id>
```

**Examples:**

```bash
tsonic remove nuget Microsoft.Extensions.Logging
```

**What it does:**

- Removes the matching entry from `dotnet.packageReferences` in your config (`--config` respected)
- Runs `tsonic restore` to validate restore + keep local bindings consistent

### add framework

Add a FrameworkReference (and bindings) to the project.

```bash
tsonic add framework <framework-reference> [types-package]
```

**Examples:**

```bash
# Add shared framework and use published bindings
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore

# Auto-generate bindings from installed shared framework assemblies
tsonic add framework Microsoft.AspNetCore.App
```

**What it does (auto-generated bindings):**

- Generates a local bindings package under `.tsonic/bindings/framework/<ref>-types/`
- Installs it into `node_modules/<ref>-types/` (without modifying `package.json`)

**Using published bindings packages (no auto-generation):**

If you pass a `types-package`, Tsonic records it in your config so `tsonic restore` knows
bindings are supplied externally and will not attempt to generate them:

```json
{
  "dotnet": {
    "frameworkReferences": [
      { "id": "Microsoft.AspNetCore.App", "types": "@tsonic/aspnetcore" }
    ]
  }
}
```

### restore

Restore .NET dependencies and (re)generate local bindings for a cloned repo.

```bash
tsonic restore
```

This command is also run automatically before `tsonic build` / `generate` / `run` / `pack` when the project has
any .NET deps declared in `tsonic.json`.

Restore only auto-generates bindings for dependency entries that do **not** specify a `types` package.

### pack

Create a NuGet package from a library project.

```bash
tsonic pack [options]
```

**Prerequisites:**

- `output.type` must be `"library"` in tsonic.json
- `output.packable` must be `true` in tsonic.json

**Options:**

| Option            | Short | Description      | Default       |
| ----------------- | ----- | ---------------- | ------------- |
| `--config <file>` | `-c`  | Config file path | `tsonic.json` |
| `--verbose`       | `-V`  | Verbose output   | `false`       |
| `--quiet`         | `-q`  | Suppress output  | `false`       |

**Examples:**

```bash
# Create NuGet package
tsonic pack

# With custom config
tsonic pack --config tsonic.library.json
```

**Output:**

```
generated/bin/Release/MyLib.1.0.0.nupkg
```

**Publishing to NuGet:**

```bash
dotnet nuget push generated/bin/Release/MyLib.1.0.0.nupkg \
  --api-key YOUR_API_KEY \
  --source https://api.nuget.org/v3/index.json
```

## Global Options

These options work with all commands:

| Option            | Short | Description      |
| ----------------- | ----- | ---------------- |
| `--help`          | `-h`  | Show help        |
| `--version`       | `-v`  | Show version     |
| `--verbose`       | `-V`  | Verbose output   |
| `--quiet`         | `-q`  | Suppress output  |
| `--config <file>` | `-c`  | Config file path |

## Exit Codes

| Code | Meaning              |
| ---- | -------------------- |
| 0    | Success              |
| 1    | Generic error        |
| 2    | Unknown command      |
| 3    | No tsonic.json found |
| 5    | Generate failed      |
| 6    | Build failed         |
| 7    | Run failed           |
| 8    | .NET SDK not found   |
| 9    | Pack failed          |

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
tsonic project init

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
