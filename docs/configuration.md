# Configuration Reference

Tsonic uses **two** config files:

- `tsonic.workspace.json` (workspace root) — shared settings and **all external dependencies**
- `packages/<project>/tsonic.json` — per-project compilation settings

## Workspace Config: `tsonic.workspace.json`

Minimal example:

```json
{
  "$schema": "https://tsonic.org/schema/workspace/v1.json",
  "dotnetVersion": "net10.0",
  "dotnet": {
    "typeRoots": ["node_modules/@tsonic/globals"],
    "libraries": [],
    "frameworkReferences": [],
    "packageReferences": []
  }
}
```

### Fields

- `dotnetVersion` (required): target framework moniker for the workspace (e.g. `"net10.0"`).
- `rid` (optional): default RID for native builds (e.g. `"linux-x64"`).
- `optimize` (optional): `"speed"` or `"size"`.
- `buildOptions.stripSymbols` / `buildOptions.invariantGlobalization` (optional): defaults for builds.

### `dotnet.*` (workspace-scoped deps)

- `dotnet.typeRoots`: ambient TypeScript `typeRoots` used for compilation.
  - Default when omitted: `["node_modules/@tsonic/globals"]`
- `dotnet.libraries`: workspace DLL references (recommended location: `libs/*.dll`).
- `dotnet.frameworkReferences`: additional shared frameworks (e.g. `Microsoft.AspNetCore.App`).
- `dotnet.packageReferences`: NuGet packages (pinned exact versions).

Most users should manage these via the CLI:

```bash
tsonic add package ./some.dll
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic add framework Microsoft.AspNetCore.App
tsonic restore
```

## Project Config: `packages/<project>/tsonic.json`

Minimal executable project:

```json
{
  "$schema": "https://tsonic.org/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "my-app",
  "output": { "type": "executable" }
}
```

### Fields

- `rootNamespace` (required): root C# namespace for generated code.
- `entryPoint` (optional for libraries): TypeScript entry file.
- `sourceRoot` (optional): root directory containing source files.
- `outputDirectory` (optional): generated C# output directory (default: `"generated"`).
- `outputName` (optional): assembly/binary name (default: `"app"`).
- `optimize` (optional): `"speed"` or `"size"` (overrides workspace default).
- `buildOptions.*` (optional): per-project build defaults.

### `output` (per-project)

`output.type`:

- `"executable"` (default when `entryPoint` is provided)
  - Uses NativeAOT by default.
- `"library"` (default when `entryPoint` is omitted)
  - Copies artifacts to `dist/` and emits `dist/tsonic/bindings/`.
- `"console-app"` (non-NativeAOT executable)

### `references.libraries` (workspace-internal)

Use `references.libraries` to reference DLL outputs of other projects in the same workspace.
Paths are resolved relative to the project root.

Example (CLI project referencing a sibling library output):

```json
{
  "references": {
    "libraries": ["../engine/dist/net10.0/MyLib.dll"]
  }
}
```

## Naming Rules (No Naming Transforms)

Tsonic does not apply casing transforms. Names are preserved as written in TypeScript.

The only deterministic normalization is for **path-derived** names:

- Directory segments and file basenames have hyphens (`-`) removed when generating namespaces / module container class names.
  - `src/todo-list.ts` → class `todolist`
  - `src/my-feature/x.ts` → namespace segment `myfeature`

