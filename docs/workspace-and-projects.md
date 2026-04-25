---
title: Workspace and Projects
---

# Workspace and Project Files

## `tsonic.workspace.json`

The workspace file defines the ambient surface and shared CLR/runtime context
for the whole workspace.

Example:

```json
{
  "$schema": "https://tsonic.org/schema/workspace/v1.json",
  "dotnetVersion": "net10.0",
  "surface": "@tsonic/js",
  "dotnet": {
    "typeRoots": ["node_modules/@tsonic/nodejs"],
    "frameworkReferences": [
      {
        "id": "Microsoft.AspNetCore.App",
        "types": "@tsonic/aspnetcore"
      }
    ],
    "packageReferences": []
  }
}
```

This is where shared dependency intent lives:

- surface selection
- target framework version
- shared type roots
- shared framework references
- shared NuGet packages
- shared local DLL references
- optional MSBuild properties

The key design rule is that external CLR dependencies are workspace-scoped, not
hidden in arbitrary project folders.

The workspace file can also carry:

- `testDotnet` dependencies for `tsonic test`
- `msbuildProperties` escape hatches for advanced CLR tooling
- shared DLL references under `dotnet.libraries`

## `packages/<project>/tsonic.json`

Each project then defines its own build entry and output behavior.

Example:

```json
{
  "$schema": "https://tsonic.org/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "myapp",
  "output": {
    "type": "executable",
    "nativeAot": true
  },
  "tests": {
    "entryPoint": "src/tests/index.ts"
  }
}
```

Project config is where you decide:

- entry point
- root namespace
- output directory/name
- executable vs library
- NativeAOT vs managed output
- test entry point
- local package ownership mode
- library packaging metadata and NuGet pack behavior

It is also where build-shape defaults become explicit:

- executable vs library
- `nativeAot` on or off
- output directory/name
- test assembly generation

## Root and project `package.json`

The npm package files still matter.

At workspace root, `package.json` owns:

- npm workspaces
- devDependency on `tsonic`
- top-level scripts such as `build`, `format`, and `test`

In this compiler repo, the public `tsonic` npm wrapper lives under
`npm/tsonic`. It is a workspace package that forwards to `@tsonic/cli`.
Generated sample projects must not be checked in as another workspace package
named `tsonic`, because that shadows the real wrapper and breaks `npm ci`.

At project root (`packages/<project>/package.json`), the package name is the
npm identity that other source packages import.

## `tsonic.package.json`

This file defines a first-party source package.

Example:

```json
{
  "schemaVersion": 1,
  "kind": "tsonic-source-package",
  "surfaces": ["@tsonic/js"],
  "source": {
    "namespace": "mycompany",
    "exports": {
      ".": "./src/index.ts",
      "./index.js": "./src/index.ts"
    }
  }
}
```

Use this when a package is authored directly in TypeScript for Tsonic.

This is the manifest that turns an npm package from “just files in
`node_modules`” into a Tsonic-authored source package.

Current authored manifests can also declare:

- ambient files
- required type roots
- module alias maps
- runtime metadata such as framework references and runtime packages

The compiler preserves source-backed metadata through constructor metadata,
call metadata, and narrowed aliases. That means an imported source-package type
is still compared by its canonical identity after it flows through helpers,
generic returns, or branch narrowing.

Example:

```ts
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { RequestHandler } from "@tsonic/express/index.js";

const handlers = new List<RequestHandler>();
```

The `RequestHandler` identity comes from the Express source package. The `List`
constructor metadata must carry that lowered identity to emission; if raw
anonymous or unresolved alias metadata leaks through, the emitter must fail
rather than guess a CLR type.

## Local first-party package references

Projects can reference sibling local packages explicitly:

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

Interpretation:

- `source` (default) — emit that package into the generated source closure
- `dll` — build that package separately and reference its DLL

That distinction is important for larger multi-project workspaces.

The rule is strict:

- a package can be owned as `source`
- or as `dll`
- but not both in the same generated project

That keeps generated source ownership and assembly-boundary ownership coherent.

## Real first-party examples

### `@tsonic/js`

The JS surface package manifest declares:

- `kind: "tsonic-source-package"`
- `surfaces: ["@tsonic/js"]`
- `requiredTypeRoots: ["."]`
- ambient globals
- exported subpaths such as `./JSON.js`, `./Date.js`, and `./timers.js`

### `@tsonic/nodejs`

The Node package manifest declares:

- `kind: "tsonic-source-package"`
- `surfaces: ["@tsonic/js"]`
- `requiredTypeRoots: ["."]`
- runtime framework references
- `node:*` and bare module aliases
- exported subpaths such as `./fs.js`, `./path.js`, and `./http.js`

It also demonstrates that source-package manifests can carry runtime metadata,
not just exports.

### `@tsonic/express`

The Express package manifest declares:

- `kind: "tsonic-source-package"`
- `surfaces: ["@tsonic/js"]`
- canonical package exports from `./src/index.ts`

## Package roots vs generated bindings

Keep the distinction clear:

- source packages are authored by hand and compiled transitively
- generated binding packages are produced by `tsbindgen` from CLR metadata

Generated binding packages use `tsonic.bindings.json`, not
`tsonic.package.json`.

That difference is one of the most important distinctions in the current stack:

- authored packages -> source manifest, package graph, transitive compilation
- generated bindings -> declarations plus CLR metadata consumed by the compiler

## Source package capabilities

Current source package metadata can define:

- exported entry points
- ambient declaration files
- module alias maps
- surface applicability
- runtime package requirements where needed
- framework references where needed

## Generated binding packages are different

Binding repos like `@tsonic/dotnet`, `@tsonic/aspnetcore`, and `@tsonic/efcore`
ship generated declaration and metadata trees. They are not authored source
packages with `tsonic.package.json`.

## Init-generated layout

`tsonic init` now creates a workspace shaped like this:

```text
my-workspace/
  package.json
  tsonic.workspace.json
  libs/
  packages/
    my-workspace/
      package.json
      README.md
      tsonic.json
      tsonic.package.json
      src/
        App.ts
```

That means the default story is already source-package-first, even for a brand
new workspace.
