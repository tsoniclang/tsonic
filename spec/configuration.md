# Tsonic Configuration (tsonic.json)

## Overview

The `tsonic.json` file configures how Tsonic compiles your TypeScript code to C#. It must be present in your project root.

## Configuration Schema

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "runtime": "js" | "dotnet",
  "rootNamespace": "string",
  "entryPoint": "string",
  "sourceRoot": "string",
  "outputDirectory": "string",
  "outputName": "string",
  "rid": "string",
  "dotnetVersion": "string",
  "optimize": "size" | "speed",
  "output": { /* output configuration */ },
  "packages": [ /* NuGet packages */ ],
  "buildOptions": { /* build options */ },
  "dotnet": { /* .NET interop configuration */ }
}
```

## Core Fields

### runtime
- **Type**: `"js" | "dotnet"`
- **Default**: `"js"`
- **Description**: Determines runtime mode
  - `"js"`: JavaScript semantics with Tsonic.Runtime (default)
  - `"dotnet"`: Pure .NET mode without runtime dependency

### rootNamespace
- **Type**: `string`
- **Required**: Yes
- **Description**: Root C# namespace for generated code
- **Example**: `"MyApp"`

### entryPoint
- **Type**: `string`
- **Required**: For executables
- **Description**: Path to main TypeScript file
- **Example**: `"src/main.ts"`

### sourceRoot
- **Type**: `string`
- **Default**: `"src"`
- **Description**: Root directory for TypeScript source files

### outputDirectory
- **Type**: `string`
- **Default**: `"generated"`
- **Description**: Directory for generated C# code

### outputName
- **Type**: `string`
- **Default**: `"app"`
- **Description**: Name of output executable or library

### rid
- **Type**: `string`
- **Default**: Current platform
- **Description**: Runtime identifier for target platform
- **Examples**: `"linux-x64"`, `"win-x64"`, `"osx-arm64"`

### dotnetVersion
- **Type**: `string`
- **Default**: `"net10.0"`
- **Description**: Target .NET framework version

### optimize
- **Type**: `"size" | "speed"`
- **Default**: `"speed"`
- **Description**: Optimization preference for NativeAOT

## Output Configuration

### output
- **Type**: `object`
- **Description**: Output-specific configuration

```json
{
  "output": {
    "type": "executable" | "library",
    "nativeAot": true,
    "singleFile": true,
    "trimmed": true,
    "stripSymbols": false,
    "selfContained": true,
    "targetFrameworks": ["net10.0"],
    "generateDocumentation": false,
    "includeSymbols": false,
    "packable": false,
    "package": {
      "id": "MyPackage",
      "version": "1.0.0",
      "authors": ["Author Name"],
      "description": "Package description"
    }
  }
}
```

## .NET Interop Configuration

### dotnet
- **Type**: `object`
- **Description**: .NET integration settings

```json
{
  "dotnet": {
    "typeRoots": [
      "node_modules/@types/dotnet"
    ],
    "packages": [
      {
        "name": "Newtonsoft.Json",
        "version": "13.0.3"
      }
    ],
    "libraries": [
      "@types/dotnet"
    ]
  }
}
```

#### dotnet.typeRoots
- **Type**: `string[]`
- **Description**: Paths to .NET type declaration directories

#### dotnet.packages
- **Type**: `NuGetPackage[]`
- **Description**: NuGet packages to include (added to .csproj)

#### dotnet.libraries
- **Type**: `string[]`
- **Description**: External library paths for .NET type declarations

## Build Options

### buildOptions
- **Type**: `object`
- **Description**: Additional build configuration

```json
{
  "buildOptions": {
    "stripSymbols": false,
    "invariantGlobalization": false
  }
}
```

## Example Configurations

### JavaScript Runtime Mode (Default)

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "runtime": "js",
  "rootNamespace": "MyApp",
  "entryPoint": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "myapp",
  "dotnetVersion": "net10.0",
  "optimize": "speed"
}
```

### Pure .NET Mode

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "runtime": "dotnet",
  "rootNamespace": "MyApp",
  "entryPoint": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "myapp",
  "dotnetVersion": "net10.0",
  "optimize": "speed",
  "dotnet": {
    "typeRoots": [
      "node_modules/@types/dotnet-pure"
    ],
    "packages": [
      {
        "name": "System.Linq",
        "version": "4.8.0"
      }
    ]
  }
}
```

### Library Configuration

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "runtime": "js",
  "rootNamespace": "MyLibrary",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "MyLibrary",
  "output": {
    "type": "library",
    "targetFrameworks": ["net8.0", "net10.0"],
    "generateDocumentation": true,
    "includeSymbols": true,
    "packable": true,
    "package": {
      "id": "MyLibrary",
      "version": "1.0.0",
      "authors": ["Your Name"],
      "description": "A Tsonic-compiled library"
    }
  }
}
```

## Runtime Mode Behavior

### When `runtime: "js"` (default)

**Generated .csproj includes:**
```xml
<PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
```

**JavaScript methods available:**
- Array: `push()`, `pop()`, `map()`, `filter()`, etc.
- String: `slice()`, `charAt()`, `indexOf()`, etc.
- Console: `console.log()`, `console.error()`
- Math: `Math.PI`, `Math.sin()`, etc.

### When `runtime: "dotnet"`

**No Tsonic.Runtime reference**

**Must use .NET methods:**
- List: `Add()`, `Remove()`, `Select()`, `Where()`
- String: `Substring()`, `IndexOf()`, `Contains()`
- Console: `Console.WriteLine()`, `Console.Error.WriteLine()`
- Math: `Math.PI`, `Math.Sin()` (from System.Math)

**Compile errors for JS methods:**
```
TSN2001: JavaScript method 'push' is not available in dotnet runtime mode.
Use 'Add' or set runtime to "js".
```

## Migration Between Modes

To migrate from `"js"` to `"dotnet"`:

1. Change `runtime` to `"dotnet"`
2. Replace JavaScript method calls:
   - `arr.push(x)` → `arr.Add(x)`
   - `arr.pop()` → `arr.RemoveAt(arr.Count - 1)`
   - `console.log()` → `Console.WriteLine()`
3. Update type declarations if using camelCase
4. Remove Tsonic.Runtime from dependencies

## See Also

- [CLI Options](cli/options.md) - Override config via command line
- [Runtime API](runtime/INDEX.md) - Tsonic.Runtime documentation
- [.NET Integration](dotnet/INDEX.md) - Using .NET types