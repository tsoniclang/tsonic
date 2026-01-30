# Language Intrinsics

Tsonic includes a small set of **language intrinsics** in `@tsonic/core/lang.js`. These are TypeScript declarations that compile to C# keywords and special forms.

```typescript
import {
  stackalloc,
  sizeof,
  nameof,
  defaultof,
  trycast,
  asinterface,
  istype,
} from "@tsonic/core/lang.js";
```

## stackalloc

Allocate stack memory and get a `Span<T>`:

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { stackalloc } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  const buffer = stackalloc<int>(256);
  buffer[0] = 42;

  Console.WriteLine(`First: ${buffer[0]}`);
  Console.WriteLine(`Length: ${buffer.Length}`);
}
```

This emits C# like:

```csharp
Span<int> buffer = stackalloc int[256];
buffer[0] = 42;
```

## sizeof

Get the size (bytes) of an unmanaged type:

```typescript
import { sizeof } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";

const bytes: int = sizeof<int>();
```

## defaultof

Get the default value for a type:

```typescript
import { defaultof } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";

const zero: int = defaultof<int>();
const nothing = defaultof<object>(); // null
```

## nameof

Get a symbol name as a string:

```typescript
import { nameof } from "@tsonic/core/lang.js";

export function main(): void {
  const myVariable = 123;
  const field = nameof(myVariable); // "myVariable"
  void field;
}
```

## trycast

Safe cast that returns `null` on failure (C# `as`):

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { trycast } from "@tsonic/core/lang.js";

class Animal {
  name!: string;
}

class Dog extends Animal {
  breed!: string;
}

export function main(animal: Animal): void {
  const dog = trycast<Dog>(animal);
  if (dog !== null) {
    Console.WriteLine(dog.breed);
  }
}
```

## asinterface

`asinterface<T>(x)` is a **compile-time-only** interface view.

It exists to treat a value as a CLR interface/nominal type in TypeScript without emitting
runtime casts in C#.

```typescript
import { asinterface } from "@tsonic/core/lang.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { IEnumerable } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type Seq<T> = Linq<IEnumerable<T>>;

const xs = new List<number>([1, 2, 3]);
const seq = asinterface<Seq<number>>(xs);

// Note: asinterface is particularly important for EF Core query precompilation,
// where runtime casts can break query analyzers.
seq.Count();
```

## istype (overload specialization)

`istype<T>(x)` is a **compile-time-only** marker used to specialize a single overload implementation
into one CLR method per signature.

Tsonic must erase `istype<T>(...)` before emitting C#. If it reaches emission, compilation fails with `TSN7441`.

```typescript
import { istype } from "@tsonic/core/lang.js";

Foo(x: string): string;
Foo(x: boolean): string;
Foo(p0: unknown): unknown {
  if (istype<string>(p0)) return `s:${p0}`;
  if (istype<boolean>(p0)) return p0 ? "t" : "f";
  throw new Error("unreachable");
}
```

## thisarg (extension method receiver)

`thisarg<T>` marks the **receiver parameter** of a C# extension method. It is only valid on the **first parameter** of a **top-level** function declaration.

```typescript
import type { thisarg } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";

export function inc(x: thisarg<int>): int {
  return x + 1;
}
```

This emits C# like:

```csharp
public static int Inc(this int x) => x + 1;
```

## ptr (unsafe pointers)

`ptr<T>` is a type marker for unsafe pointer types (`T*`). It is defined in `@tsonic/core/types.js`.

```typescript
import type { ptr } from "@tsonic/core/types.js";
import { int } from "@tsonic/core/types.js";

export function accept(p: ptr<int>): void {}
export function accept2(p: ptr<ptr<int>>): void {} // int**
```

Pointers are intended for interop and low-level scenarios; prefer safe APIs (`Span<T>`, `IntPtr`, etc.) when possible.
