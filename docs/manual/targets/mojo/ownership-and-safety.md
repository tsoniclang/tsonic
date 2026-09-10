# Mojo ownership and safety

Normal TypeScript does not require ownership annotations on every value.
Explicit operations are for contracts whose native meaning must be visible.

For example, request a copy rather than an implicit ownership change:

```ts
import { copy } from "@tsonic/mojo/lang.js";

export function duplicate(value: string): string {
  return copy(value);
}
```

The current proof emits `return value.copy()` in Mojo. Whether copying a larger
value is cheap depends on that value's native implementation.

Compile-time values are distinct from runtime locals:

```ts
import { comptime, comptimeIf, unroll } from "@tsonic/core/lang.js";
import { materialize } from "@tsonic/mojo/lang.js";

export function sum(): number {
  const enabled = comptime(true);
  const seed = comptime(0);
  let total = materialize(seed);
  if (comptimeIf(enabled)) {
    for (const value of unroll([1, 2, 3])) total += value;
  }
  return total;
}
```

The target emits compile-time declarations, a compile-time conditional and loop,
and a mutable runtime accumulator. It does not guess compile-time intent from
a variable name.

The target also declares `Ref<T, O>` and `MutRef<T, O>` with explicit origins.
An available type declaration is not proof that every native API using that
type is supported. Provider calls must retain the selected argument convention,
origin and result relationship. Missing evidence is rejected.

Native pointer loads, stores and element offsets require the explicit shared
`unsafeContext` marker. Do not infer that layout-backed raw memory is supported
from the presence of a pointer type; see the [current limitations](../../../reference/targets/mojo/limitations.md).
