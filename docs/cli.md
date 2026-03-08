# CLI Reference

This page documents the current Tsonic CLI.

## Workspace Model

Tsonic always works inside a workspace:

- root config: `tsonic.workspace.json`
- projects: `packages/<name>/tsonic.json`
- one active ambient surface per workspace
- external CLR/npm dependencies live at workspace scope

## Commands

### `tsonic init`

Initializes a workspace and a default project.

Examples:

```bash
tsonic init
tsonic init --surface @tsonic/js
tsonic init --skip-types
```

Options:

- `--surface <name>` — `clr` or exact surface package name such as `@tsonic/js`
- `--skip-types` — skip initial npm surface/type installs
- `--types-version <ver>` — pin the installed package version

### `tsonic add npm <package>`

Installs an npm package and merges any Tsonic manifest it carries into the workspace.

Examples:

```bash
tsonic add npm @tsonic/nodejs
tsonic add npm @acme/math
```

Supported package manifest families:

- first-party Aikya/source-package manifests
- bindings manifests for CLR/runtime packages

### `tsonic add package <dll> [types]`

Adds a local DLL reference.

Examples:

```bash
tsonic add package ./libs/MyLib.dll
tsonic add package ./libs/MyLib.dll @company/mylib-types
```

If `types` is omitted, Tsonic generates local bindings through `restore`.

### `tsonic add nuget <id> <version> [types]`

Adds a NuGet package reference.

Examples:

```bash
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic add nuget Npgsql.EntityFrameworkCore.PostgreSQL 10.0.0 @tsonic/efcore-npgsql
```

### `tsonic add framework <frameworkReference> [types]`

Adds a `FrameworkReference` to the workspace.

Example:

```bash
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
```

### `tsonic remove nuget <id>`

Removes a workspace NuGet package reference.

### `tsonic update nuget <id> <version>`

Updates a workspace NuGet package version.

### `tsonic restore`

Restores workspace CLR dependencies and regenerates local bindings where needed.

Use `--strict` to fail instead of applying constructor-constraint relaxations during bindgen.

### `tsonic generate [entry]`

Generates C# only.

### `tsonic build [entry]`

Builds executable or library output.

Useful flags:

- `--rid <rid>`
- `--no-aot`
- `--no-generate`
- `--optimize size|speed`
- `--no-strip`
- `--lib <path>` (repeatable)

### `tsonic run [entry] -- [args...]`

Builds and runs the executable project.

### `tsonic test`

Generates a non-NativeAOT test assembly from `tests.entryPoint` and runs `dotnet test`.

### `tsonic pack`

Creates a NuGet package for a library project.

## Global Options

- `--project <name>`
- `--config <file>`
- `--verbose`
- `--quiet`
- `--strict`
- `--help`
- `--version`

## Important Current Rules

- Surfaces are ambient-only selection.
- `@tsonic/nodejs` is a package, not a surface.
- `clr` is still the default when `surface` is omitted.
- `build` / `run` / `test` operate on the selected project under `packages/<name>/`.
