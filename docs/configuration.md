# Configuration

The current configuration model has three layers:

- workspace config: `tsonic.workspace.json`
- project config: `packages/<project>/tsonic.json`
- package manifest: `packages/<project>/tsonic.package.json`

See [Workspace and Project Files](workspace-and-projects.md) for the concrete
shape. This page focuses on decision-making.

## 1. Choose the ambient surface

CLR-first:

```json
{
  "surface": "clr"
}
```

JavaScript ambient world:

```json
{
  "surface": "@tsonic/js"
}
```

Key rule:

- a workspace has exactly one active ambient surface at a time

## 2. Declare workspace-scoped CLR context

Use `tsonic.workspace.json` for shared CLR dependencies and type roots.

Typical examples:

```json
{
  "dotnetVersion": "net10.0",
  "surface": "@tsonic/js",
  "dotnet": {
    "typeRoots": [
      "node_modules/@tsonic/js",
      "node_modules/@tsonic/nodejs"
    ],
    "frameworkReferences": [
      {
        "id": "Microsoft.AspNetCore.App",
        "types": "@tsonic/aspnetcore"
      }
    ],
    "packageReferences": [
      {
        "id": "Microsoft.EntityFrameworkCore.Sqlite",
        "version": "10.0.1",
        "types": "@tsonic/efcore-sqlite"
      }
    ]
  }
}
```

Use workspace config for:

- `surface`
- `dotnetVersion`
- `typeRoots`
- shared framework references
- shared NuGet packages
- shared local DLLs
- optional MSBuild property escape hatches

## 3. Configure each project

Project-level config lives under `packages/<project>/tsonic.json`.

Typical fields include:

- `rootNamespace`
- `entryPoint`
- `sourceRoot`
- `outputDirectory`
- `outputName`
- `output.type`
- `output.nativeAot`
- `tests.entryPoint`
- `references.libraries`
- `references.packages`

## 4. Decide local package ownership mode

The current model supports local first-party package references with explicit
ownership:

```json
{
  "references": {
    "packages": [
      {
        "id": "@acme/domain",
        "project": "../domain"
      },
      {
        "id": "@acme/search",
        "project": "../search",
        "mode": "dll"
      }
    ]
  }
}
```

Meaning:

- `source` (default) — compile that package into the generated source closure
- `dll` — build that package separately and reference its DLL boundary

Use `source` unless you have a deliberate assembly-boundary reason to prefer
`dll`.

## 5. Define package metadata

Use `tsonic.package.json` for authored source packages.

That manifest is where a package declares:

- surface compatibility
- exported subpaths
- ambient files
- module aliases
- runtime metadata when needed

Generated CLR binding packages are different; they are owned by `tsbindgen` and
do not use the same authored-source manifest model.
