# CLR / .NET Examples

## Console

```ts
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello");
}
```

## Collections

```ts
import { Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";

const map = new Dictionary<string, number>();
map.Add("a", 1);
```

## JSON

```ts
import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";

const text = JsonSerializer.Serialize({ ok: true });
```

## Explicit Numeric Types

```ts
import type { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

const value: int = 1 as int;
Console.WriteLine(value.ToString());
```

## Attributes / Interop-Oriented Intrinsics

Use `@tsonic/core/lang.js` when you need CLR-specific semantics such as `asinterface`, `nameof`, `sizeof`, or attributes DSL support.
