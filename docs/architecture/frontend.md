# Frontend

The frontend owns TypeScript-facing semantics.

## Responsibilities

- TypeScript program creation
- core globals injection
- surface profile resolution
- source-package import resolution
- package graph traversal
- validation and diagnostics
- IR construction

## Program creation

Important current behavior:

- compiler core globals are injected virtually
- `surface` selects the ambient runtime personality
- workspace `dotnet.typeRoots` is additive
- source-package files under `node_modules` are included in the same TypeScript
  program when resolved

## Surface profiles

Current model:

- builtin `clr`
- package surfaces via `tsonic.surface.json`
- resolved surface chains for compatibility checks

This is why a package can declare compatibility with `@tsonic/js` and still be
accepted under a workspace surface that extends it.

## Source packages

The frontend recognizes installed packages with:

```text
package.json
tsonic.package.json
```

and:

```json
{ "kind": "tsonic-source-package" }
```

These are treated as source, not opaque `.d.ts` stubs.

That means the frontend has to understand:

- exports
- ambient files
- module aliases
- surface compatibility
- runtime metadata overlays

## Why this matters

This is the point where the current stack differs most from a normal TypeScript
toolchain:

- authored source packages are part of the same program
- generated CLR binding packages are not
- the active surface changes ambient semantics without changing package imports
