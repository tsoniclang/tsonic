# Tsonic Configuration (tsonic.json)

## Overview

The `tsonic.json` file configures how Tsonic compiles your TypeScript code to C#. It must be present in your project root.

**Key principle**: The TypeScript program (via `tsconfig.json`) is the single source of truth for what library surfaces are available. `tsonic.json` contains only compiler semantics and build settings - it does not duplicate library configuration.

## Configuration Schema

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "mode": "dotnet" | "js",
  "rootNamespace": "string",
  "entry": "string",
  "sourceRoot": "string",
  "outputDirectory": "string",
  "outputName": "string",
  "rid": "string",
  "dotnetVersion": "string",
  "optimize": "size" | "speed",
  "output": { /* output configuration */ },
  "packages": [ /* NuGet packages */ ],
  "buildOptions": { /* build options */ }
}
```

## Core Fields

### mode

- **Type**: `"dotnet" | "js"`
- **Default**: `"dotnet"`
- **Description**: Controls how built-in type methods are lowered

The `mode` field is the key semantic switch in Tsonic. It determines whether built-in methods (Array, String, Math, console) use .NET BCL semantics or JavaScript semantics.

**Important**: Mode does NOT change the underlying CLR types. In both modes:

- `number[]` compiles to `List<int>` or `List<double>`
- `string` compiles to `string`
- All types remain .NET native for interop compatibility

Mode only affects **how method calls on built-in types are lowered**.

See [Mode Semantics](#mode-semantics) below for details.

### rootNamespace

- **Type**: `string`
- **Required**: Yes
- **Description**: Root C# namespace for generated code
- **Example**: `"MyApp"`

### entry

- **Type**: `string`
- **Required**: For executables
- **Description**: Path to main TypeScript file
- **Example**: `"src/index.ts"`

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

## NuGet Packages

### packages

- **Type**: `NuGetPackage[]`
- **Description**: Additional NuGet packages to include in the generated .csproj

```json
{
  "packages": [
    {
      "name": "Newtonsoft.Json",
      "version": "13.0.3"
    }
  ]
}
```

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

---

## Mode Semantics

### Overview

Tsonic is primarily a **TypeScript syntax frontend for .NET**. The default mode (`"dotnet"`) compiles TypeScript to C# using .NET BCL semantics. The optional `"js"` mode provides JavaScript-like behavior for built-in types via the `Tsonic.JSRuntime` library.

### Built-in Types Affected by Mode

Mode affects lowering for these built-in types only:

| Type        | Methods affected                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Array**   | `sort`, `reverse`, `map`, `filter`, `reduce`, `find`, `indexOf`, `includes`, `push`, `pop`, `shift`, `unshift`, `slice`, `splice`, `concat`, `join`, `forEach`, `every`, `some`, `flat`, `flatMap`, etc. |
| **String**  | `toUpperCase`, `toLowerCase`, `slice`, `substring`, `charAt`, `indexOf`, `includes`, `split`, `trim`, `padStart`, `padEnd`, `repeat`, `replace`, `startsWith`, `endsWith`, etc.                          |
| **Math**    | `floor`, `ceil`, `round`, `abs`, `min`, `max`, `random`, `sin`, `cos`, `tan`, `sqrt`, `pow`, `log`, etc.                                                                                                 |
| **console** | `log`, `warn`, `error`, `info`, `debug`, `trace`, `assert`, `time`, `timeEnd`, etc.                                                                                                                      |

Everything else uses normal binding-based lowering regardless of mode.

### mode: "dotnet" (Default)

Built-in methods compile to .NET BCL equivalents:

```typescript
const a = [13, 4, 5, 6];
a.sort();
```

Generated C#:

```csharp
List<int> a = new() { 13, 4, 5, 6 };
a.Sort();
```

```typescript
const s = "hello";
s.toUpperCase();
```

Generated C#:

```csharp
string s = "hello";
s.ToUpper();
```

### mode: "js" (Opt-in)

Built-in methods compile to JavaScript-semantics extension methods from `Tsonic.JSRuntime`:

```typescript
const a = [13, 4, 5, 6];
a.sort();
```

Generated C#:

```csharp
using Tsonic.JSRuntime;

List<int> a = new() { 13, 4, 5, 6 };
a.sort(); // Extension method with JS semantics
```

```typescript
const s = "hello";
s.toUpperCase();
```

Generated C#:

```csharp
using Tsonic.JSRuntime;

string s = "hello";
s.toUpperCase(); // Extension method with JS semantics
```

### Interop Guarantee

In both modes, the underlying types are always .NET native:

```typescript
import { SomeDotnetLib } from "SomeLibrary";

const a = [1, 2, 3];
SomeDotnetLib.consume(a);
```

The library receives a standard `List<int>` - no wrapper types, no JS runtime types. This ensures full interop compatibility.

### When to Use Each Mode

**Use `mode: "dotnet"` (default) when:**

- Building a .NET application/library
- Interoperating heavily with .NET libraries
- You want BCL method behavior
- Performance is critical (no runtime indirection)

**Use `mode: "js"` when:**

- Porting existing JavaScript/TypeScript code
- You need exact JavaScript semantics (e.g., `sort()` string coercion)
- Familiarity with JS behavior is more important than .NET conventions

---

## Example Configurations

### Default .NET Mode

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entry": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "myapp",
  "dotnetVersion": "net10.0",
  "optimize": "speed"
}
```

Note: `mode` is omitted, defaulting to `"dotnet"`.

### JavaScript Semantics Mode

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "mode": "js",
  "rootNamespace": "MyApp",
  "entry": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "myapp",
  "dotnetVersion": "net10.0"
}
```

### Library Configuration

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
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

---

## TypeScript Configuration (tsconfig.json)

Tsonic relies on `tsconfig.json` to define the TypeScript program. The compiler discovers available library surfaces from the TS program - it does not maintain a parallel list.

### Required Settings

`tsonic init` generates a `tsconfig.json` with these critical settings:

```json
{
  "compilerOptions": {
    "lib": [],
    "typeRoots": ["./node_modules/@types", "./node_modules/@types/dotnet"],
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```

**Critical settings explained:**

| Setting     | Value                    | Why                                                                                       |
| ----------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `lib`       | `[]`                     | Disables default TS libs (lib.es5.d.ts, etc.) that would conflict with .NET type surfaces |
| `typeRoots` | Points to dotnet typings | Ensures TS sees .NET type declarations                                                    |

### tsc Compatibility Guarantee

All Tsonic programs must successfully typecheck with vanilla `tsc`:

```bash
tsc --noEmit  # Must pass without errors
```

This works because:

1. `lib: []` removes conflicting JS prototypes
2. `typeRoots` points to proper .NET type declarations
3. The `.d.ts` files from `@types/dotnet` provide complete type coverage

---

## Binding Discovery

The compiler discovers bindings by scanning packages in the TypeScript program that contain `internal/bindings.json`.

See [Bindings Discovery](contracts/bindings-discovery.md) for the full specification.

---

## What NOT to Put in tsonic.json

The following should NOT be in `tsonic.json`:

- **`typeRoots`** - Goes in `tsconfig.json`
- **`lib`** - Goes in `tsconfig.json`
- **`stdlib`** - No such field; library surfaces come from TS program
- **Library lists** - Managed via npm packages + tsconfig.json

This separation ensures:

1. No config duplication
2. Users can freely edit `tsconfig.json`
3. Future "stdlibs" (nodejs-clr, python-clr, etc.) work automatically

---

## See Also

- [Bindings Discovery](contracts/bindings-discovery.md) - How the compiler finds binding metadata
- [CLI Reference](cli.md) - Command-line interface
- [.NET Integration](dotnet-reference.md) - Using .NET types
