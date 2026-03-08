# Configuration Reference

Tsonic splits configuration into:

- workspace: `tsonic.workspace.json`
- project: `packages/<project>/tsonic.json`

## `tsonic.workspace.json`

Example:

```json
{
  "dotnetVersion": "net10.0",
  "surface": "@tsonic/js",
  "rid": "linux-x64",
  "optimize": "speed",
  "dotnet": {
    "typeRoots": ["node_modules/@tsonic/nodejs"],
    "libraries": [],
    "frameworkReferences": [],
    "packageReferences": []
  },
  "testDotnet": {
    "packageReferences": [
      {
        "id": "xunit",
        "version": "2.9.3"
      }
    ]
  }
}
```

### Fields

- `dotnetVersion` — required target framework, for example `net10.0`
- `surface` — active ambient surface
  - omitted => `clr`
  - `@tsonic/js` => JS ambient world
- `rid` — default native target
- `optimize` — `size` or `speed`
- `buildOptions.stripSymbols`
- `buildOptions.invariantGlobalization`

### `dotnet.typeRoots`

Additional ambient/module declaration roots for the workspace.

Important:

- compiler core globals are always injected
- surface roots are resolved from the active surface manifest
- `dotnet.typeRoots` is additive

Example for JS + Node modules:

```json
{
  "surface": "@tsonic/js",
  "dotnet": {
    "typeRoots": ["node_modules/@tsonic/nodejs"]
  }
}
```

### `dotnet.libraries`

Workspace DLL references.

Supported forms:

```json
{
  "dotnet": {
    "libraries": [
      "./libs/MyLib.dll",
      {
        "path": "./libs/Other.dll",
        "types": "@company/other-types"
      },
      {
        "path": "./libs/BuildOnly.dll",
        "types": false
      }
    ]
  }
}
```

### `dotnet.frameworkReferences`

```json
{
  "dotnet": {
    "frameworkReferences": [
      "Microsoft.AspNetCore.App",
      {
        "id": "Microsoft.AspNetCore.App",
        "types": "@tsonic/aspnetcore"
      }
    ]
  }
}
```

### `dotnet.packageReferences`

```json
{
  "dotnet": {
    "packageReferences": [
      {
        "id": "Microsoft.Extensions.Logging",
        "version": "10.0.0"
      }
    ]
  }
}
```

### `dotnet.msbuildProperties`

Escape hatch for explicit `.csproj`-level properties:

```json
{
  "dotnet": {
    "msbuildProperties": {
      "InterceptorsNamespaces": "$(InterceptorsNamespaces);Microsoft.EntityFrameworkCore.GeneratedInterceptors"
    }
  }
}
```

### `testDotnet`

Test-only frameworks/packages/properties added only to `tsonic test`.

## `packages/<project>/tsonic.json`

Example:

```json
{
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "app",
  "output": {
    "type": "exe",
    "nativeAot": true
  },
  "tests": {
    "entryPoint": "tests/index.ts",
    "outputDirectory": "generated-tests",
    "outputName": "tests"
  },
  "references": {
    "libraries": ["../shared/out/Shared.dll"]
  }
}
```

### Fields

- `rootNamespace` — required C# root namespace
- `entryPoint` — defaults to project sample entry
- `sourceRoot`
- `outputDirectory`
- `outputName`
- top-level `optimize`
- `buildOptions.*`
- `output.*`
- `tests.*`
- `references.libraries`

## Output Configuration

Common fields:

- `type`: `exe` or `library`
- `nativeAot`
- `nativeLib`: `shared` or `static`
- `singleFile`
- `trimmed`
- `stripSymbols`
- `optimization`
- `invariantGlobalization`
- `selfContained`
- `targetFramework`
- `targetFrameworks`
- `generateDocumentation`
- `includeSymbols`
- `packable`
- `package`

## Naming Rule

Tsonic does not guess CLR names from TypeScript names.

- authored TS names stay authored TS names in the frontend model
- CLR names come from bindings
- user-defined C# member emission applies deterministic naming rules only at the backend layer
