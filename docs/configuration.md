# Configuration Reference

Complete reference for `tsonic.json` configuration.

## Overview

Tsonic uses `tsonic.json` for project configuration. This file is required and defines how your project is compiled.

## Minimal Configuration

```json
{
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts"
}
```

## Full Configuration

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "app",
  "rid": "linux-x64",
  "dotnetVersion": "net10.0",
  "optimize": "speed",
  "output": {
    "type": "executable",
    "nativeAot": true,
    "singleFile": true,
    "trimmed": true,
    "stripSymbols": true,
    "optimization": "speed",
    "invariantGlobalization": true,
    "selfContained": true
  },
  "buildOptions": {
    "stripSymbols": true,
    "invariantGlobalization": true
  },
  "dotnet": {
    "typeRoots": ["node_modules/@tsonic/globals"],
    "packageReferences": [{ "id": "Newtonsoft.Json", "version": "13.0.3" }],
    "frameworkReferences": ["Microsoft.AspNetCore.App"],
    "libraries": ["lib/MyLib.dll"]
  }
}
```

## Properties

### Core Properties

#### rootNamespace

**Required.** The root C# namespace for generated code.

```json
{
  "rootNamespace": "MyApp"
}
```

Generated file `src/utils/Math.ts` becomes:

```csharp
namespace MyApp.Utils { ... }
```

#### namingPolicy

Optional overrides for how Tsonic derives generated names.

Naming policies:

- `"clr"` (default): CLR/C# conventions (PascalCase)
- `"none"`: preserve original casing and separators, only removing hyphens (`-`)

Buckets:

- `namingPolicy.all`: apply to all buckets (overrides all other settings)
- `namingPolicy.namespaces`: directory-derived namespace segments
- `namingPolicy.classes`: file-derived module container class name
- `namingPolicy.methods`: method names
- `namingPolicy.properties`: property names
- `namingPolicy.fields`: field names
- `namingPolicy.enumMembers`: enum member names

##### namingPolicy.all

Disable all CLR renaming:

```json
{
  "namingPolicy": {
    "all": "none"
  }
}
```

##### namingPolicy.classes

Controls how Tsonic derives the generated C# class name from the source filename.

- Default: `"clr"` (`todo-list.ts` → `TodoList`, `todolist.ts` → `Todolist`)
- `"none"`: strip hyphens only (`todo-list.ts` → `todolist`)

```json
{
  "namingPolicy": {
    "classes": "none"
  }
}
```

##### namingPolicy.namespaces

Controls how Tsonic derives C# namespace segments from directory names.

- Default: `"clr"` (`src/models/auth/User.ts` → `MyApp.Models.Auth`)
- `"none"`: preserve directory casing and underscores, only removing hyphens (`src/models/auth/User.ts` → `MyApp.models.auth`)

```json
{
  "namingPolicy": {
    "namespaces": "none"
  }
}
```

#### entryPoint

The main TypeScript file that exports a `main()` function.

```json
{
  "entryPoint": "src/App.ts"
}
```

**Required for executables.** Today, `entryPoint` is also required for library builds.

For libraries, set `entryPoint` to a library root file (for example `src/index.ts`)
that imports/exports your public API.

#### sourceRoot

The root directory containing source files.

```json
{
  "sourceRoot": "src"
}
```

**Default:** Inferred from `entryPoint` or `"src"`.

#### outputDirectory

Directory for generated C# code.

```json
{
  "outputDirectory": "generated"
}
```

**Default:** `"generated"`

#### outputName

Name of the output executable or library.

```json
{
  "outputName": "my-app"
}
```

**Default:** `"app"`

### Runtime Configuration

#### rid

Runtime identifier for cross-compilation.

```json
{
  "rid": "linux-x64"
}
```

**Default:** Auto-detected for current platform.

**Common RIDs:**

| RID           | Platform            |
| ------------- | ------------------- |
| `linux-x64`   | Linux x64           |
| `linux-arm64` | Linux ARM64         |
| `osx-x64`     | macOS Intel         |
| `osx-arm64`   | macOS Apple Silicon |
| `win-x64`     | Windows x64         |
| `win-arm64`   | Windows ARM64       |

#### dotnetVersion

Target .NET version.

```json
{
  "dotnetVersion": "net10.0"
}
```

**Default:** `"net10.0"`

### Build Options

#### optimize

Optimization preference.

```json
{
  "optimize": "speed"
}
```

| Value   | Description                  |
| ------- | ---------------------------- |
| `speed` | Optimize for execution speed |
| `size`  | Optimize for smaller binary  |

**Default:** `"speed"`

#### buildOptions

Build-time options for compilation.

```json
{
  "buildOptions": {
    "stripSymbols": true,
    "invariantGlobalization": true
  }
}
```

### Output Configuration

#### output.type

Output type: `"executable"`, `"library"`, or `"console-app"`.

```json
{
  "output": {
    "type": "executable"
  }
}
```

**Default:** Auto-detected (`"executable"` if `entryPoint` provided).

#### Executable Options

```json
{
  "output": {
    "type": "executable",
    "nativeAot": true,
    "singleFile": true,
    "trimmed": true,
    "stripSymbols": true,
    "optimization": "speed",
    "invariantGlobalization": true,
    "selfContained": true
  }
}
```

| Property                 | Type    | Default   | Description                  |
| ------------------------ | ------- | --------- | ---------------------------- |
| `nativeAot`              | boolean | `true`    | Enable NativeAOT compilation |
| `singleFile`             | boolean | `true`    | Single-file output           |
| `trimmed`                | boolean | `true`    | Trim unused code             |
| `stripSymbols`           | boolean | `true`    | Remove debug symbols         |
| `optimization`           | string  | `"speed"` | `"speed"` or `"size"`        |
| `invariantGlobalization` | boolean | `true`    | Use invariant culture        |
| `selfContained`          | boolean | `true`    | Include runtime              |

#### Library Options

```json
{
  "output": {
    "type": "library",
    "targetFrameworks": ["net10.0", "net8.0"],
    "generateDocumentation": true,
    "includeSymbols": true,
    "packable": true,
    "package": {
      "id": "MyLibrary",
      "version": "1.0.0",
      "authors": ["Your Name"],
      "description": "My awesome library"
    }
  }
}
```

| Property                | Type     | Default       | Description            |
| ----------------------- | -------- | ------------- | ---------------------- |
| `targetFrameworks`      | string[] | `["net10.0"]` | Target frameworks      |
| `generateDocumentation` | boolean  | `true`        | Generate XML docs      |
| `includeSymbols`        | boolean  | `true`        | Include debug symbols  |
| `packable`              | boolean  | `false`       | Enable NuGet packing   |
| `package`               | object   | -             | NuGet package metadata |

#### Console App Options

Non-NativeAOT executable (regular `dotnet publish`).

```json
{
  "output": {
    "type": "console-app",
    "targetFramework": "net10.0",
    "singleFile": true,
    "selfContained": true
  }
}
```

| Property          | Type    | Default    | Description                    |
| ----------------- | ------- | ---------- | ------------------------------ |
| `targetFramework` | string  | `net10.0`  | Target framework               |
| `singleFile`      | boolean | `true`     | Single-file publish output     |
| `selfContained`   | boolean | `true`     | Include runtime in output      |

### .NET Configuration

#### dotnet.typeRoots

Paths to type declaration directories.

```json
{
  "dotnet": {
    "typeRoots": ["node_modules/@tsonic/globals"]
  }
}
```

**Default:** `["node_modules/@tsonic/globals"]`

#### dotnet.packageReferences

Additional NuGet package dependencies (emitted as `PackageReference` in the generated `.csproj`).

```json
{
  "dotnet": {
    "packageReferences": [
      { "id": "Newtonsoft.Json", "version": "13.0.3" },
      { "id": "Microsoft.EntityFrameworkCore", "version": "10.0.1", "types": "@tsonic/efcore" },
      { "id": "System.Text.Json", "version": "8.0.0" }
    ]
  }
}
```

If you provide `types`, Tsonic will use that npm package for bindings and will not
auto-generate bindings for that entry during `tsonic restore`.

#### dotnet.frameworkReferences

Additional shared frameworks (emitted as `FrameworkReference` in the generated `.csproj`).

```json
{
  "dotnet": {
    "frameworkReferences": [
      "Microsoft.AspNetCore.App"
    ]
  }
}
```

If you provide `types`, Tsonic will use that npm package for bindings and will not
auto-generate bindings for that entry during `tsonic restore`.

Example with a published bindings package:

```json
{
  "dotnet": {
    "frameworkReferences": [
      { "id": "Microsoft.AspNetCore.App", "types": "@tsonic/aspnetcore" }
    ]
  }
}
```

#### dotnet.libraries

Extra library inputs for the compiler.

- Entries ending with `.dll` are treated as **assembly references** (added to the generated `.csproj`).
- Other entries are treated as **additional TypeScript type roots** (passed to the TypeScript compiler).

```json
{
  "dotnet": {
    "libraries": ["lib/MyLib.dll", "./types", "../shared/common"]
  }
}
```

## Configuration Examples

### Minimal Executable

```json
{
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts"
}
```

### With .NET Libraries

```json
{
  "rootNamespace": "FileProcessor",
  "entryPoint": "src/App.ts",
  "dotnet": {
    "libraries": ["./libs/custom-lib"]
  }
}
```

### Optimized for Size

```json
{
  "rootNamespace": "SmallApp",
  "entryPoint": "src/App.ts",
  "optimize": "size",
  "output": {
    "type": "executable",
    "nativeAot": true,
    "trimmed": true,
    "optimization": "size"
  }
}
```

### Class Library

```json
{
  "rootNamespace": "MyLibrary",
  "entryPoint": "src/index.ts",
  "sourceRoot": "src",
  "output": {
    "type": "library",
    "targetFrameworks": ["net10.0", "net8.0"],
    "packable": true,
    "package": {
      "id": "MyLibrary",
      "version": "1.0.0",
      "authors": ["Your Name"],
      "description": "A useful library",
      "license": "MIT"
    }
  }
}
```

### With NuGet Dependencies

```json
{
  "rootNamespace": "WebClient",
  "entryPoint": "src/App.ts",
  "dotnet": {
    "packageReferences": [
      { "id": "System.Net.Http.Json", "version": "8.0.0" },
      { "id": "Newtonsoft.Json", "version": "13.0.3" }
    ]
  }
}
```

## CLI Override

Most configuration can be overridden via CLI:

```bash
tsonic build src/App.ts \
  --namespace MyApp \
  --out my-app \
  --rid linux-x64 \
  --optimize size
```

CLI options take precedence over `tsonic.json`.
