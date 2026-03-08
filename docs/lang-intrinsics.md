# Language Intrinsics

These come from `@tsonic/core/lang.js` unless noted otherwise.

## `stackalloc`

```ts
import { stackalloc } from "@tsonic/core/lang.js";
import type { Span, int } from "@tsonic/core/types.js";

const buffer: Span<int> = stackalloc<int>(16 as int);
buffer[0] = 42 as int;
```

Lowers to C# `stackalloc`.

## `sizeof`

```ts
import { sizeof } from "@tsonic/core/lang.js";
import type { int, long } from "@tsonic/core/types.js";

const a: int = sizeof<int>();
const b: int = sizeof<long>();
```

Current rule:

- `sizeof<T>()` requires a known value-compatible type
- primitives and known CLR structs are supported

## `defaultof`

```ts
import { defaultof } from "@tsonic/core/lang.js";
import type { int } from "@tsonic/core/types.js";

const zero: int = defaultof<int>();
```

## `nameof`

```ts
import { nameof } from "@tsonic/core/lang.js";

const field = nameof(user.name); // "name"
const local = nameof(user);      // "user"
```

Current supported forms:

- identifier
- `this`
- dotted member access

The intrinsic is recognized by provenance from `@tsonic/core/lang.js`, not just by identifier spelling.

## `trycast`

```ts
import { trycast } from "@tsonic/core/lang.js";

const person = trycast<Person>(value);
if (person !== null) {
  console.log(person.name);
}
```

## `asinterface`

Compile-time-only interface view. Use when you need CLR interface typing without forcing a runtime cast.

```ts
import { asinterface } from "@tsonic/core/lang.js";
import type { IQueryable } from "@tsonic/dotnet/System.Linq.js";

const q = asinterface<IQueryable<User>>(db.Users);
```

## `Interface<T>`

Use only in `implements` clauses when implementing CLR interface bindings from TypeScript.

```ts
import type { Interface } from "@tsonic/core/lang.js";
import type { IDisposable } from "@tsonic/dotnet/System.js";

export class Resource implements Interface<IDisposable> {
  Dispose(): void {}
}
```

## `field<T>`

Forces class member emission as a C# field instead of an auto-property.

```ts
import type { field } from "@tsonic/core/lang.js";

export class User {
  private _name: field<string> = "";
}
```

## `out`, `ref`, `inref`

Call-site parameter modifier intrinsics:

```ts
import { defaultof, out, ref, inref } from "@tsonic/core/lang.js";
import type { int } from "@tsonic/core/types.js";

let value = defaultof<int>();
dict.TryGetValue("key", out(value));
mutate(ref(value));
inspect(inref(value));
```

Use the function forms from `@tsonic/core/lang.js`. The type aliases in `@tsonic/core/types.js` remain available for declaration typing.

## `istype<T>`

Overload/nominal specialization predicate:

```ts
import { istype } from "@tsonic/core/lang.js";

if (istype<string>(value)) {
  console.log(value.toUpperCase());
}
```

## `thisarg<T>`

Type marker for extension-method receiver positions in declaration surfaces.

## Attributes DSL

Current attribute authoring lives in `@tsonic/core/lang.js` and supports explicit targets/builders rather than ad hoc decorator lowering.

Use it when you need CLR attributes in authored TypeScript. See `dotnet-interop.md`.
