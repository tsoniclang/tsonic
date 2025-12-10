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
  "runtime": "js",
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
    "packages": [{ "name": "Newtonsoft.Json", "version": "13.0.3" }],
    "libraries": ["./libs/MyLib"]
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
namespace MyApp.src.utils { ... }
```

#### entryPoint

The main TypeScript file that exports a `main()` function.

```json
{
  "entryPoint": "src/App.ts"
}
```

**Required for executables**, optional for libraries.

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

#### runtime

Runtime mode: `"js"` or `"dotnet"`.

```json
{
  "runtime": "js"
}
```

| Mode     | Description                               |
| -------- | ----------------------------------------- |
| `js`     | JavaScript semantics via Tsonic.JSRuntime |
| `dotnet` | Direct .NET BCL access with C# semantics  |

**Default:** `"js"`

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

Legacy build options (use `output` for new projects).

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

**Default:** Based on `runtime`:

- JS mode: `["node_modules/@tsonic/globals", "node_modules/@tsonic/js-globals"]`
- Dotnet mode: `["node_modules/@tsonic/globals"]`

#### dotnet.packages

NuGet package dependencies.

```json
{
  "dotnet": {
    "packages": [
      { "name": "Newtonsoft.Json", "version": "13.0.3" },
      { "name": "System.Text.Json", "version": "8.0.0" }
    ]
  }
}
```

#### dotnet.libraries

Paths to external .NET library bindings.

```json
{
  "dotnet": {
    "libraries": ["./libs/custom-lib", "../shared/common"]
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

### .NET BCL Application

```json
{
  "rootNamespace": "FileProcessor",
  "entryPoint": "src/App.ts",
  "runtime": "dotnet",
  "dotnet": {
    "typeRoots": ["node_modules/@tsonic/globals"]
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
  "runtime": "dotnet",
  "dotnet": {
    "packages": [
      { "name": "System.Net.Http.Json", "version": "8.0.0" },
      { "name": "Newtonsoft.Json", "version": "13.0.3" }
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
