# Bindings

Tsonic has two different dependency stories:

- CLR/runtime bindings packages
- first-party Tsonic source packages

## 1. CLR / Runtime Bindings

These describe CLR assemblies, runtime helpers, or module surfaces.

Examples:

- `@tsonic/dotnet`
- `@tsonic/aspnetcore`
- `@tsonic/js`
- `@tsonic/nodejs`

Add/install them through:

```bash
tsonic add npm @tsonic/nodejs
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic add package ./libs/MyLib.dll
tsonic restore
```

Tsonic uses:

- declaration surfaces (`.d.ts`)
- bindings metadata
- runtime/NuGet/package references from manifests

## 2. First-Party Source Packages (Aikya)

Tsonic-authored libraries can be published as source packages and consumed directly from npm.

Manifest path:

```text
tsonic/package-manifest.json
```

Example:

```json
{
  "schemaVersion": 1,
  "kind": "tsonic-source-package",
  "surfaces": ["@tsonic/js"],
  "source": {
    "exports": {
      ".": "./src/index.ts"
    }
  }
}
```

When installed, Tsonic:

- resolves the package entrypoint
- validates surface compatibility
- adds the package TS files to the same TypeScript program
- walks the package’s local relative imports

This is different from opaque external npm module handling.

## Surface Compatibility

Workspaces still compile with one active ambient surface.

Source packages may declare one or more compatible surfaces. Compatibility is checked against the resolved surface chain, not just exact string equality.

## Generated/Normalized Manifest Data

The CLI normalizes bindings metadata and runtime package requirements so that:

- runtime code and declaration surfaces stay coherent
- value exports and type exports are co-produced from the same source graph
- first-party consumers get deterministic `.d.ts` surfaces from the compiler

## Local vs Published Packages

Airplane-grade rule:

- repo-local sibling trees are useful during development
- packed/published shape must still be verified

If a package works locally but fails when installed, inspect:

- nested `bindings.json`
- internal declaration trees
- `npm pack --dry-run`

## What Gets Committed

For normal projects:

- source
- configs
- source package manifest

For generated local bindings caches:

- follow your workspace policy
- many repos keep generated publishable packages in their own package repos, not in app repos
