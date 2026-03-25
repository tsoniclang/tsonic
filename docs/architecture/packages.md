# Package Architecture

Tsonic uses several package families.

## Compiler Packages

- `@tsonic/frontend`
- `@tsonic/emitter`
- `@tsonic/backend`
- `@tsonic/cli`
- `tsonic`

## Core Authoring Packages

- `@tsonic/core`
- `@tsonic/dotnet`

## Surface / Runtime Packages

- `@tsonic/globals` — CLR ambient surface
- `@tsonic/js` — JS ambient surface
- `@tsonic/nodejs` — Node module package

## Source Packages

Tsonic-authored npm packages with `tsonic.package.json`.

These are consumed as source, not just declarations.

## Important Separation

- surface package = ambient world
- normal package = importable modules / bindings

That is why `@tsonic/js` is a surface, but `@tsonic/nodejs` is a normal package.
