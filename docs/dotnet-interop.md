# .NET Interop

Tsonic’s CLR interop model is explicit.

## Imports

Use CLR bindings packages such as `@tsonic/dotnet`:

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
```

The compiler does not guess CLR names from authored TypeScript spellings. It uses bindings.

## BCL Example

```ts
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello from CLR interop");
}
```

## LINQ / Extension Methods

You can call extension-style APIs through bindings:

```ts
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

const xs = [1, 2, 3];
const ys = Enumerable.Where(xs, (x: number): boolean => x > 1);
```

`asinterface` is available when the TypeScript type view needs a CLR interface shape without introducing runtime casts.

## CLR Interfaces

Use `Interface<T>` for implementation sites:

```ts
import type { Interface } from "@tsonic/core/lang.js";
import type { IDisposable } from "@tsonic/dotnet/System.js";

export class Resource implements Interface<IDisposable> {
  Dispose(): void {}
}
```

## Attributes

Tsonic supports CLR attribute authoring through `@tsonic/core/lang.js`.

Use the current attributes DSL rather than assuming TS decorators map directly to CLR attributes.

## Parameter Modifiers

Supported:

- `out`
- `ref`
- `inref`

Example:

```ts
import { defaultof, out } from "@tsonic/core/lang.js";
import type { int } from "@tsonic/core/types.js";
import { Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";

const dict = new Dictionary<string, int>();
let value = defaultof<int>();

if (dict.TryGetValue("a", out(value))) {
  console.log(value.toString());
}
```

## JS Surface and CLR Interop

JS surface does not remove explicit CLR interop. It changes the ambient world only.

This is valid:

```ts
// workspace surface: @tsonic/js
import { Guid } from "@tsonic/dotnet/System.js";

export function main(): void {
  console.log(Guid.NewGuid().ToString());
}
```

## External Dependencies

Add them at workspace scope:

```bash
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic add package ./libs/MyLib.dll
tsonic restore
```

## Naming and Visibility

- CLR names come from bindings
- Tsonic does not infer hidden CLR overloads/members from TypeScript syntax
- if a member is not in the bindings surface, it is not part of the authoring contract
