# Language Intrinsics

Tsonic includes a small set of **language intrinsics** in `@tsonic/core/lang.js`. These are TypeScript declarations that compile to C# keywords and special forms.

```typescript
import {
  stackalloc,
  sizeof,
  nameof,
  defaultof,
  trycast,
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
  Console.WriteLine(`Length: ${buffer.length}`);
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
