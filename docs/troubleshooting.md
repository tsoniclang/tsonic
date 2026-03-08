# Troubleshooting

## Surface Confusion

### JS code shows CLR-style ambient members

Check `tsonic.workspace.json`:

```json
{
  "surface": "@tsonic/js"
}
```

Also remember:

- `@tsonic/nodejs` is not a surface
- add it as a package instead

```bash
tsonic add npm @tsonic/nodejs
```

### `node:*` imports do not resolve

You likely forgot the Node package/type roots.

```bash
tsonic add npm @tsonic/nodejs
```

## Numeric Narrowing Errors

### `parseInt(...) as int` fails

That is expected unless the narrowing is proven.

Bad:

```ts
import type { int } from "@tsonic/core/types.js";

const value = parseInt(text, 10) as int;
```

Why:

- JS `parseInt` returns `number`
- `number` means `double`
- Tsonic will not guess `int`

Fix:

- keep the value as `number`, or
- add an explicit checked conversion path in your own code/library

### `Number.isFinite(x)` did not prove `int`

Also expected. `Number.isFinite` proves finite double, not 32-bit integer.

## Source Package Errors

### Installed npm package was not treated as Tsonic source

Check for:

```text
node_modules/<pkg>/tsonic/package-manifest.json
```

Expected shape:

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

### Surface mismatch for source package

Source packages declare compatible surfaces. The active workspace surface must resolve to a chain that includes one of them.

## `import.meta` Errors

Supported:

- `import.meta`
- `import.meta.url`
- `import.meta.filename`
- `import.meta.dirname`

Unsupported:

- `import.meta.env`
- bundler/tool-specific extension points

## Dynamic Import Errors

Supported:

```ts
await import("./side-effect.js");
const mod = await import("./module.js");
```

Unsupported:

```ts
await import(specifier);
await import("some-package");
```

## Missing CLR / Binding Errors

### Binding exists in source repo but not in installed package

This is usually a packaging issue:

- generated nested bindings or internal declaration files were not included in the published tarball/package
- local sibling-repo setups can hide this if they resolve direct repo trees instead of packed contents

Fix:

- regenerate the package
- inspect `npm pack --dry-run`
- ensure bindings and internal declaration trees are shipped

## Test Failures Only On Cold Runs

If `run-all.sh` fails only from a cold checkout, inspect workspace test ordering and build prerequisites rather than assuming the compiler changed. Tsonic now runs workspace suites in explicit dependency order to avoid hidden warm-build dependencies.
