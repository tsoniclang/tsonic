# Surfaces and Packages

The most important distinction in Tsonic is:

- **surface** = ambient world
- **package** = imported library or source package

Confusing those two is the fastest way to misunderstand the current stack.

## Surfaces

Tsonic separates the language prelude from the ambient runtime personality.

- compiler core: always-on noLib baseline
- `clr`: default CLR-first ambient surface
- `@tsonic/js`: JavaScript ambient surface

A workspace selects **one** active surface.

## Surface examples

### `clr`

Use CLR APIs explicitly:

```ts
import { Console } from "@tsonic/dotnet/System.js";

Console.WriteLine("hello");
```

### `@tsonic/js`

Use JS-style ambient APIs naturally:

```ts
console.log("  hello  ".trim());
const value = JSON.parse<{ ok: boolean }>('{"ok": true}');
```

## Packages

Packages are imported dependencies. They are not ambient worlds.

Examples:

- `@tsonic/nodejs`
- `@tsonic/express`
- `@tsonic/dotnet`
- `@tsonic/aspnetcore`
- local workspace packages

That is why:

- `@tsonic/js` can be a surface
- `@tsonic/nodejs` is still a package

## First-party source packages

These are authored in TypeScript and consumed as source packages:

- `@tsonic/js`
- `@tsonic/nodejs`
- `@tsonic/express`

Each uses `tsonic.package.json` metadata to declare:

- exported subpaths
- ambient files
- module aliases
- surface compatibility
- runtime metadata where needed

### Example: `@tsonic/nodejs`

The Node package is not a surface. Instead it is a package that:

- is compatible with `@tsonic/js`
- declares `node:*` aliases
- exports subpaths like `./fs.js`, `./http.js`, and `./path.js`
- can pull in framework/runtime requirements through package metadata

That is why the normal model is:

- workspace surface: `@tsonic/js`
- package dependency: `@tsonic/nodejs`

## Generated binding packages

These are generated from CLR metadata by `tsbindgen`:

- `@tsonic/dotnet`
- `@tsonic/aspnetcore`
- `@tsonic/microsoft-extensions`
- `@tsonic/efcore*`

They are:

- packages, not surfaces
- generated, not authored source packages
- owned by `tsbindgen`, not by the source-package repos

## Four package families you should keep separate

1. **surface packages**
   - ambient world selection
   - example: `@tsonic/js`
2. **authored source packages**
   - TypeScript source compiled transitively
   - examples: `@tsonic/nodejs`, `@tsonic/express`
3. **generated CLR binding packages**
   - declaration + metadata packages from `tsbindgen`
   - examples: `@tsonic/dotnet`, `@tsonic/aspnetcore`
4. **workspace-local package references**
   - sibling projects referenced as `source` or `dll`

## Practical decision table

| You want                                      | Use                                         |
| --------------------------------------------- | ------------------------------------------- |
| JS globals and JS-style methods               | `surface: "@tsonic/js"`                     |
| Node-style modules                            | `@tsonic/nodejs` package                    |
| Express-style routing                         | `@tsonic/express` package                   |
| CLR BCL APIs                                  | `@tsonic/dotnet`                            |
| ASP.NET Core APIs                             | `@tsonic/aspnetcore`                        |
| Local workspace package compiled transitively | `references.packages` with `mode: "source"` |
| Local workspace package as assembly boundary  | `references.packages` with `mode: "dll"`    |
