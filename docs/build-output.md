---
title: Build Output
---

# Build Output

Tsonic emits a deterministic generated C# project and then compiles it through
the .NET toolchain.

## Main output shapes

- generated C# project
- managed executable
- managed library
- NativeAOT executable
- NativeAOT library

## Generated project layout

For an executable project, the generated output typically looks like:

```text
packages/api/generated/
  Program.cs
  tsonic.csproj
  src/
    App.cs
  node_modules/
    @tsonic/js/...
    @tsonic/nodejs/...
    @acme/domain/...
```

The important detail is that the generated source tree preserves package
ownership. It is not a flat dump of unrelated `.cs` files.

## Source-mode local packages

When a local first-party package reference uses `mode: "source"` or omits
`mode`, that package is emitted into the generated source closure.

Example:

```json
{
  "references": {
    "packages": [
      {
        "id": "@acme/domain",
        "project": "../domain"
      }
    ]
  }
}
```

Result:

- `@acme/domain` source appears under generated `node_modules`
- the app and that package compile as one generated closure

## DLL-mode local packages

When a local package reference uses `mode: "dll"`, Tsonic builds that package
as a separate project and references its DLL boundary instead of emitting its
source again.

Example:

```json
{
  "references": {
    "packages": [
      {
        "id": "@acme/domain",
        "project": "../domain",
        "mode": "dll"
      }
    ]
  }
}
```

Result:

- the local package is built first
- the current project references its DLL
- the generated source closure does not duplicate ownership for that package

## Why generated output matters

The generated project reflects:

- the active surface
- the full package graph
- source-package manifests
- CLR framework and package references
- local package ownership mode

See [Build Modes](build-modes.md) for the command-level view.
