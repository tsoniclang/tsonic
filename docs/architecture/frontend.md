# Frontend

The frontend owns TypeScript-facing semantics.

## Responsibilities

- TS Program creation
- core globals injection
- surface profile resolution
- source-package import resolution
- package graph traversal
- validation and diagnostics
- IR construction

## Program Creation

Important current behavior:

- compiler core globals are injected virtually
- `surface` selects the ambient runtime personality
- workspace `dotnet.typeRoots` is additive
- source-package files under `node_modules` are included in the same TS Program when resolved

## Surface Profiles

Current model:

- builtin `clr`
- custom/package surfaces via `tsonic.surface.json`
- resolved surface chains (`resolvedModes`) for compatibility checks

Example:

- active surface: `@acme/surface-node`
- resolved modes may include `@tsonic/js`
- source packages declaring `["@tsonic/js"]` can still be accepted

## Source Packages

The frontend recognizes installed packages with:

```text
package.json
tsonic.package.json
```

and kind:

```json
{ "kind": "tsonic-source-package" }
```

These are treated as TS source, not opaque module stubs.

## Validation Areas

- unsupported/open-world features
- numeric proof
- generic function value determinism
- object literal runtime representability
- `import.meta`
- dynamic `import()`
- source-package surface mismatch

## Output

Frontend output is IR plus diagnostics, not C#.
