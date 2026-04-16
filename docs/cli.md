---
title: CLI
---

# CLI Workflow

The `tsonic` CLI owns the whole user workflow:

```bash
tsonic init
tsonic add
tsonic restore
tsonic generate
tsonic build
tsonic run
tsonic test
tsonic pack
```

The CLI is intentionally opinionated:

- workspaces are mandatory
- projects live under `packages/<name>/`
- external CLR dependencies are workspace-scoped
- source-package manifests and binding manifests drive restore behavior

## The normal loop

For a JS + Node project:

```bash
tsonic init --surface @tsonic/js
tsonic add npm @tsonic/nodejs
tsonic restore
tsonic run
```

For a CLR-first project:

```bash
tsonic init
tsonic run
```

## What each command does

### `tsonic init`

Initializes a workspace plus a default project under `packages/<workspaceName>/`
and creates:

- `tsonic.workspace.json`
- `packages/<name>/tsonic.json`
- `packages/<name>/tsonic.package.json`
- `packages/<name>/src/App.ts`
- root `package.json` configured as an npm workspace

Useful forms:

```bash
tsonic init
tsonic init --surface @tsonic/js
```

Key behavior:

- creates a workspace-scoped `package.json` with npm workspaces
- creates a default project under `packages/<workspace-name>/`
- creates `tsonic.package.json` so the default project is already a publishable
  source package
- bootstraps required surface packages when `--surface` is not `clr`

### `tsonic add npm <packageSpec>`

Installs an npm package and applies its manifest contract.

That package can be:

- a first-party source package with `tsonic.package.json`
- a generated CLR binding package with `tsonic.bindings.json`

Examples:

```bash
tsonic add npm @tsonic/nodejs
tsonic add npm @tsonic/express
tsonic add npm file:../my-local-package
```

Important distinction:

- `tsonic.package.json` -> authored source package consumed as source
- `tsonic.bindings.json` -> generated CLR binding package

`add npm` understands both and updates the workspace accordingly.

### `tsonic add package <dll> [types]`

Adds a local DLL dependency to the workspace.

If `types` is omitted, `tsonic` can generate a bindings package through
`tsbindgen`.

Examples:

```bash
tsonic add package ./libs/MyLib.dll
tsonic add package ./libs/MyLib.dll @company/mylib-types
```

When `types` is omitted, Tsonic resolves the DLL closure and generates a local
bindings package through `tsbindgen`.

### `tsonic add nuget <PackageId> <Version> [types]`

Adds a NuGet package reference at workspace scope.

Examples:

```bash
tsonic add nuget Microsoft.EntityFrameworkCore 10.0.0
tsonic add nuget Microsoft.Extensions.Logging 10.0.0 @tsonic/microsoft-extensions
```

If `types` is omitted, restore generates bindings for the package and its
transitive closure. Versions are pinned; Tsonic does not silently upgrade or
downgrade them for you.

### `tsonic add framework <FrameworkReference> [types]`

Adds a `FrameworkReference` at workspace scope.

Example:

```bash
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
```

If `types` is omitted, Tsonic generates a local bindings package for that
framework from installed shared-framework assemblies.

### `tsonic remove nuget <PackageId>`

Removes a NuGet package reference from `tsonic.workspace.json`.

Use this when the workspace no longer needs a CLR package or when you want to
replace it with a different package family.

### `tsonic update nuget <PackageId> <Version>`

Updates a pinned NuGet package version in `tsonic.workspace.json`.

This command is intentionally explicit because version drift is part of the
release discipline.

### `tsonic restore`

Synchronizes the workspace dependency graph and applies package-manifest
runtime/binding requirements.

Use this after changing:

- npm packages
- framework references
- NuGet packages
- local package graphs

Restore is where Tsonic materializes workspace-scoped dependency intent:

- generated bindings for CLR inputs
- surface-required npm packages
- package-manifest runtime requirements
- normalized manifest data under `.tsonic/`

### `tsonic generate`

Emits the generated C# project without compiling it.

Use this when you want to:

- inspect generated source
- debug a package graph issue
- run custom downstream build steps on the generated project
- preserve generated output for external tools such as EF compiled-model steps

The command also accepts an optional positional entry override:

```bash
tsonic generate src/App.ts --project api
```

### `tsonic build`

Compiles the selected project into the configured output shape.

Useful forms:

```bash
tsonic build
tsonic build --project api
tsonic build src/App.ts --project api
tsonic build --rid linux-x64
tsonic build --no-aot
```

`build` respects project output mode:

- executable
- library
- NativeAOT shared/static library

It also respects local package ownership mode (`source` vs `dll`) when the
project references sibling first-party packages.

### `tsonic run`

Builds and runs the selected executable project.

```bash
tsonic run
tsonic run --project api
tsonic run src/App.ts --project api
tsonic run --project api -- --port 8080
```

### `tsonic test`

Generates a non-NativeAOT test assembly and runs `dotnet test`.

This uses the project’s `tests.entryPoint` configuration.

It generates a managed test assembly and delegates execution to `dotnet test`.
That means test-only framework references and NuGet packages live in
`testDotnet` / `tests` configuration rather than in ad hoc shell scripts.

### `tsonic pack`

Packages a library project into a NuGet package.

This only works when:

- `output.type` is `"library"`
- `output.packable` is `true`

The current pack flow is:

1. generate the library project
2. run `dotnet pack` on the generated `tsonic.csproj`
3. emit a `.nupkg` under the generated `bin/Release` tree

## Important flags

- `--project <name>` — select `packages/<name>/`
- `--surface <name>` — choose the workspace ambient surface during `init`
- `--strict` — strict bindings generation for restore/add flows
- `--deps <dir>` — extra assembly probe directories for generated bindings
- `--rid <rid>` — runtime identifier for native builds
- `--no-aot` — build managed output instead of NativeAOT
- `--no-generate` — build or run from an existing generated directory
- `--keep-temp` — keep build artifacts

Other useful current flags:

- positional `<entry>` for `generate`, `build`, and `run`
- `-c, --config <file>` to select a workspace file explicitly
- `-V, --verbose` and `-q, --quiet` for CLI noise control
- `--types-version <ver>` and `--skip-types` for init bootstrapping
- `-L, --lib <path>` for explicit DLL references during build flows

## Important current rules

- surfaces are ambient-world selection, not normal packages
- `@tsonic/nodejs` is a package, not a surface
- `clr` remains the default when `surface` is omitted
- `build`, `run`, `test`, and `pack` operate on the selected project under
  `packages/<name>/`
- workspace-level dependencies live in `tsonic.workspace.json`, not per-project
- the CLI does not silently blur authored source packages and generated CLR
  binding packages

## Practical guidance

- use `init` once per workspace root
- use `add npm` for authored source packages and prebuilt binding packages
- use `add nuget`, `add framework`, and `add package` for CLR inputs
- use `restore` after dependency-graph changes
- use `generate` when debugging or when a downstream tool needs the generated
  project
- use `build`, `run`, `test`, and `pack` for normal day-to-day workflows
