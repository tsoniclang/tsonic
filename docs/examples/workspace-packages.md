---
title: Workspace Package Graphs
---

# Workspace Package Graphs

The default model is source-package-first, even inside a single local
workspace.

## Example layout

```text
my-workspace/
  tsonic.workspace.json
  packages/
    domain/
      package.json
      tsonic.json
      tsonic.package.json
      src/index.ts
    api/
      package.json
      tsonic.json
      tsonic.package.json
      src/App.ts
```

`packages/domain/src/index.ts`:

```ts
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
```

`packages/api/src/App.ts`:

```ts
import { clamp } from "@acme/domain";

export function main(): void {
  console.log(clamp(10, 0, 5));
}
```

## Source-mode ownership

In `packages/api/tsonic.json`:

```json
{
  "rootNamespace": "Acme.Api",
  "entryPoint": "src/App.ts",
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

This is the default `source` mode.

Result:

- `@acme/domain` is emitted into the generated `node_modules` tree
- `api` and `domain` compile as one generated closure

## DLL-mode ownership

If you want a real assembly boundary instead:

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

- Tsonic builds `domain` first
- the consuming project references its DLL
- generated output does not duplicate source ownership for that package

## Practical rule

Use `source` unless you have a deliberate reason to keep a DLL boundary:

- NuGet packaging
- independent library versioning
- assembly-level separation for a large workspace

For most first-party local packages, the default and recommended mode is
still `source`.
