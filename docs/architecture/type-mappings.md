---
title: Type Mappings
---

# Type Mappings

## Core numeric mapping

- `number` -> `double`
- `int` -> `System.Int32`
- `long` -> `System.Int64`
- `float` -> `System.Single`
- `decimal` -> `System.Decimal`
- `bool` -> `bool`
- `char` -> `char`

Explicit branded numeric types from `@tsonic/core/types.js` exist so callers
can force CLR intent where `number` would be too vague.

## Nullability and option-like shapes

- `undefined` / `null` are preserved according to the active surface and target
  shape
- optional properties are not treated as permission for arbitrary dynamic
  object use
- nullish coalescing still has to lower to a stable target type

## Strings, arrays, tuples, and objects

- `string` -> CLR `string` with surface-dependent API exposure
- arrays -> native arrays or deterministic helper-backed shapes depending on
  context
- tuples -> `ValueTuple`-style lowered shapes
- object literals -> emitted only when the runtime shape can be represented
  deterministically

The important point is that lowering is contextual. Tsonic does not promise one
single universal CLR representation for every TS construct regardless of usage.

## Collections

- TypeScript arrays -> native C# arrays or surface/runtime helpers depending on
  context
- tuples -> `ValueTuple`
- dictionaries and sets -> explicit CLR or JS-backed shapes depending on the
  authoring surface and contextual target

## Imported CLR types stay explicit

Explicit CLR imports do not become “more JavaScript” just because the workspace
surface is `@tsonic/js`.

Example:

```ts
import { Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";

const map = new Dictionary<string, number>();
```

That is still a CLR binding package call surface.

## Surface effect

Surface changes the ambient API, not the meaning of explicit CLR imports.

Example:

```ts
const xs = [1, 2, 3];
xs.map((x) => x + 1);
```

still lowers through deterministic runtime machinery, not by pretending CLR APIs
were authored directly.
