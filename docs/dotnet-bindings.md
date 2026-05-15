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

### Broad CLR object values

Generated CLR binding packages represent `System.Object` as TypeScript
`unknown`. A broad object value can be passed to another broad CLR slot, stored,
or narrowed through a proven API. It cannot be used for arbitrary member access.

Value-type constraints are represented as `NonNullable<unknown>`, which keeps
struct-like generic constraints distinct from unconstrained object slots.

### ASP.NET Core usage

Install the framework binding package explicitly:

```bash
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
tsonic restore
```

```ts
import { WebApplication } from "@tsonic/aspnetcore/Microsoft.AspNetCore.Builder.js";
import type { ExtensionMethods } from "@tsonic/aspnetcore/Microsoft.AspNetCore.Builder.js";

export function main(): void {
  const builder = WebApplication.CreateBuilder();
  const app = builder.Build() as ExtensionMethods<WebApplication>;
  app.MapGet("/", () => "Hello from ASP.NET Core");
  app.Run("http://localhost:8080");
}
```

### EF Core usage

Add the CLR package you need, then use the matching generated binding package:

```bash
tsonic add nuget Microsoft.EntityFrameworkCore.Sqlite 10.0.0
tsonic add npm @tsonic/efcore
tsonic add npm @tsonic/efcore-sqlite
tsonic restore
```

```ts
import {
  DbContext,
  DbSet,
} from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
import { SqliteDbContextOptionsBuilderExtensions } from "@tsonic/efcore-sqlite/Microsoft.EntityFrameworkCore.js";

export class TodoItem {
  id: number = 0;
  title: string = "";
}

export class AppDbContext extends DbContext {
  todos!: DbSet<TodoItem>;
}

export function createContext(): AppDbContext {
  const builder = AppDbContext.CreateOptionsBuilder();
  SqliteDbContextOptionsBuilderExtensions.UseSqlite(
    builder,
    "Data Source=app.db"
  );
  return new AppDbContext(builder.Options);
}
```

## What the generated package docs should cover

Generated binding packages like `@tsonic/aspnetcore` and `@tsonic/efcore*`
should be documented in terms of:

- how to add the framework or NuGet dependency
- which generated npm package to install
- how to import the resulting CLR namespaces
- minimal working examples

They are not first-party authored source packages, so the docs do not try to
restate every API member in those repos individually.

## Why the docs separate this from first-party packages

The architecture has two distinct kinds of packages:

- authored first-party source packages like `@tsonic/js`, `@tsonic/nodejs`, and
  `@tsonic/express`
- generated CLR binding packages produced by `tsbindgen`

The site keeps those categories separate because they have different build,
ownership, and release flows.
