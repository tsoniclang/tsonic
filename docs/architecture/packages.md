# Packages

Tsonic uses several package families, and the architecture only makes sense if
you keep those families separate.

## Compiler packages

- `@tsonic/frontend`
- `@tsonic/emitter`
- `@tsonic/backend`
- `@tsonic/cli`
- `tsonic`

These implement the compiler and CLI itself.

## Core authoring packages

- `@tsonic/core`
- `@tsonic/globals`

These support language-facing types, intrinsics, and ambient declarations.

## First-party source packages

- `@tsonic/js`
- `@tsonic/nodejs`
- `@tsonic/express`

These packages are authored directly in TypeScript and consumed as source
through `tsonic.package.json`.

## Generated CLR binding packages

- `@tsonic/dotnet`
- `@tsonic/aspnetcore`
- `@tsonic/microsoft-extensions`
- `@tsonic/efcore*`

These are generated from CLR metadata by `tsbindgen`.

## Local workspace packages

These are user-authored sibling projects referenced through:

```json
{
  "references": {
    "packages": [
      {
        "id": "@acme/domain",
        "project": "../domain"
      }
    ]
  }
}
```

They can be owned as `source` or `dll`.

## Important separation

- surface package = ambient world
- normal package = importable module or binding package
- authored source package = compiled transitively
- generated CLR binding package = declaration + metadata package

That is why `@tsonic/js` can be a surface while `@tsonic/nodejs` is still a
normal package.
