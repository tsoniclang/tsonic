---
title: CLR and .NET Examples
---

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

export class Payload {
  ok: boolean = false;
}

const payload = new Payload();
payload.ok = true;
const text = JsonSerializer.Serialize(payload);
```

## Explicit numeric types

```ts
import type { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

const value: int = 1 as int;
Console.WriteLine(value.ToString());
```

## ASP.NET Core

```ts
import { WebApplication } from "@tsonic/aspnetcore/Microsoft.AspNetCore.Builder.js";
import type { ExtensionMethods } from "@tsonic/aspnetcore/Microsoft.AspNetCore.Builder.js";

export function main(): void {
  const builder = WebApplication.CreateBuilder();
  const app = builder.Build() as ExtensionMethods<WebApplication>;
  app.MapGet("/", () => "Hello");
  app.Run("http://localhost:8080");
}
```

## Attributes and interop intrinsics

Use `@tsonic/core/lang.js` when you need CLR-specific semantics such as:

- `asinterface`
- `nameof`
- `sizeof`
- `defaultof`
- `out`
- attribute markers and overload-family markers

The package model keeps those CLR-facing tools explicit instead of
hiding them behind ambient JS-style behavior.
