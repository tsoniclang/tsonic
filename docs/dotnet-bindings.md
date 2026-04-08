---
title: CLR Bindings
---

# CLR Bindings and Interop

Tsonic does not hide CLR interop behind a JS-like illusion. It keeps it
explicit and package-based.

## Import CLR APIs explicitly

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";
```

```ts
export function main(): void {
  const xs = [1, 2, 3];
  const filtered = Enumerable.Where(xs, (x: number): boolean => x > 1);
  Console.WriteLine(filtered.Count().ToString());
}
```

## Where these packages come from

Generated CLR binding packages are produced by `tsbindgen`.

Examples:

- `@tsonic/dotnet`
- `@tsonic/aspnetcore`
- `@tsonic/microsoft-extensions`
- `@tsonic/efcore`

## Add external CLR dependencies

Tsonic supports three main CLR input paths.

### Framework references

```bash
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
```

Use this for shared frameworks such as ASP.NET Core.

### NuGet packages

```bash
tsonic add nuget Microsoft.EntityFrameworkCore 10.0.0
tsonic restore
```

Use this for package references that should live in `tsonic.workspace.json`.

The corresponding Tsonic binding package is then imported explicitly. Example:

```ts
import { DbContext } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
```

### Local DLLs

```bash
tsonic add package ./libs/MyCompany.MyLib.dll
```

If you do not provide a types package explicitly, Tsonic can generate one with
`tsbindgen`.

## Typical interop patterns

### BCL usage

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
```

### ASP.NET Core usage

```ts
import { WebApplication } from "@tsonic/aspnetcore/Microsoft.AspNetCore.Builder.js";
```

### EF Core usage

```ts
import { DbContext } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
```

## Why the docs separate this from first-party packages

The current architecture has two distinct kinds of packages:

- authored first-party source packages like `@tsonic/js`, `@tsonic/nodejs`, and
  `@tsonic/express`
- generated CLR binding packages produced by `tsbindgen`

The site now keeps those categories separate because they have different build,
ownership, and release flows.
