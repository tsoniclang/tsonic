# CLI Reference

This page documents the **current** Tsonic CLI surface.

```txt
tsonic <command> [options]
```

## Workspace Model (Required)

Tsonic always operates in a workspace:

- Workspace root contains `tsonic.workspace.json`
- Projects live under `packages/<name>/tsonic.json`
- External deps are workspace-scoped (`libs/` + `dotnet.*` in `tsonic.workspace.json`)

## Commands

### `tsonic init`

Initialize a new Tsonic workspace (and default project).

```bash
mkdir my-app
cd my-app
tsonic init
```

Options:

- `--skip-types` — skip installing type packages
- `--types-version <ver>` — pin the installed type package versions

Creates:

- `tsonic.workspace.json`, `libs/`, `packages/<name>/tsonic.json`, workspace `package.json`, `.gitignore`

### `tsonic add npm <packageSpec>`

Install an npm bindings package and apply its `.NET` dependency manifest to the workspace.

Airplane-grade rule: the npm package must include a `tsonic.bindings.json` at its root. That file is the
only way Tsonic discovers the `.NET` dependencies for an npm bindings package.

Examples:

```bash
tsonic add npm @tsonic/js
tsonic add npm @tsonic/nodejs
tsonic add npm @tsonic/express
```

Behavior:

- `npm install --save-dev <packageSpec>`
- Reads `<pkg>/tsonic.bindings.json`
- Merges `dotnet.frameworkReferences`, `dotnet.packageReferences`, `dotnet.msbuildProperties` (and `testDotnet.*`)
  into `tsonic.workspace.json`
- Installs any additional `types` packages referenced by the manifest

After adding a bindings package, run `tsonic restore` to materialize NuGet dependencies and generate any missing
bindings packages.

### `tsonic add package <dll> [types]`

Add a local DLL (and optional bindings) to the workspace.

```bash
tsonic add package ./path/to/MyLib.dll
tsonic add package ./path/to/MyLib.dll @acme/mylib-types
```

If `types` is omitted, Tsonic:

- Resolves the deterministic DLL dependency closure
- Copies all non-framework DLLs into `libs/`
- Generates bindings into `.tsonic/bindings/dll/<asm>-types/`
- Mirrors generated bindings into `node_modules/<asm>-types/`

If `types` is provided, Tsonic installs it and skips auto-generation.

Tsonic also records the mapping in `tsonic.workspace.json` so `tsonic restore` knows to treat
the DLL as “externally bound”:

```json
{
  "dotnet": {
    "libraries": [
      { "path": "libs/MyLib.dll", "types": "@acme/mylib-types" }
    ]
  }
}
```

Options:

- `--deps <dir>` (repeatable) — extra probe directories for assembly resolution
- `--strict` — strict bindings generation (constructor constraint loss becomes a hard error)

### `tsonic add nuget <id> <version> [types]`

Add a NuGet package reference (and optional bindings) to the workspace.

```bash
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic add nuget Microsoft.EntityFrameworkCore 10.0.1 @tsonic/efcore
```

If `types` is omitted, Tsonic generates bindings for the **full transitive closure**
of NuGet packages (one bindings package per NuGet package) under:

- `.tsonic/bindings/nuget/<id>-types/` → mirrored to `node_modules/<id>-types/`

If `types` is provided, Tsonic records it in `tsonic.workspace.json` and does not auto-generate.

### `tsonic add framework <frameworkReference> [types]`

Add a .NET FrameworkReference (and optional bindings) to the workspace.

```bash
tsonic add framework Microsoft.AspNetCore.App
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
```

If `types` is omitted, Tsonic generates bindings from the installed shared framework.

### `tsonic remove nuget <id>`

Remove a NuGet package reference from `tsonic.workspace.json` and refresh bindings.

### `tsonic update nuget <id> <version> [types]`

Update a NuGet package reference (and optional bindings) in `tsonic.workspace.json`.

### `tsonic restore`

Restore NuGet deps and (re)generate local bindings (workspace-scoped).

This is the “clone a repo and get to green” command.

By default, bindings generation allows constructor-constraint loss (C# still enforces it at build time).
Use `--strict` to treat constructor-constraint loss as fatal.

### `tsonic generate [entry]`

Generate C# only (no `dotnet build/publish`).

### `tsonic build [entry]`

Build an executable or library.

- For executables: runs `dotnet publish` (NativeAOT by default)
- For libraries: runs `dotnet build`, copies artifacts to `dist/`, and emits `dist/tsonic/bindings/`

### `tsonic run [entry] -- [args...]`

Build and run an executable.

### `tsonic test`

Generate a **non-NativeAOT** test assembly and run `dotnet test`.

This gives you a normal .NET unit test workflow (xUnit/NUnit/MSTest) while keeping
your production build in NativeAOT.

Requirements:

- `packages/<project>/tsonic.json` must define `tests.entryPoint`
- `tsonic.workspace.json` should declare test frameworks under `testDotnet.*`
  - For csproj-only test tooling packages (e.g. `Microsoft.NET.Test.Sdk`, `xunit.runner.visualstudio`), set `"types": false` since you typically won’t import them from TypeScript.

Example:

```bash
tsonic test --project my-app
```

### `tsonic pack`

Create a NuGet package from a library project.

## Global Options

Common options:

- `-c, --config <file>` — workspace config path (default: auto-detect `tsonic.workspace.json`)
- `--project <name>` — select project under `packages/<name>/`
- `-V, --verbose` / `-q, --quiet`
- `--deps <dir>` (repeatable) — extra probe dirs for assembly resolution (deps/bindings generation)
- `--strict` — strict bindings generation

Build/generate/run options:

- `-s, --src <dir>` — override source root directory
- `-o, --out <name>` — override output name
- `-n, --namespace <ns>` — override root namespace
- `-r, --rid <rid>` — runtime identifier (e.g. `linux-x64`)
- `-O, --optimize <size|speed>`
- `-k, --keep-temp` — keep `generated/` output
- `--no-strip` — keep debug symbols
- `-L, --lib <path>` (repeatable) — extra assembly probe paths

## Config Discovery and Project Selection

When `--config` is not supplied, Tsonic walks up from the current directory looking for `tsonic.workspace.json`.

When `--project` is not supplied, Tsonic selects:

1. The nearest `packages/<name>/tsonic.json` when run from inside that project directory tree, otherwise
2. If the workspace has exactly one project, it is selected automatically
