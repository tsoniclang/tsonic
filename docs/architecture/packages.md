# Packages

Tsonic uses several package families, and the architecture only makes sense if
you keep those families separate.

## Compiler packages

- `@tsonic/frontend`
- `@tsonic/csharp-emitter`
- `@tsonic/csharp-backend`
- `@tsonic/cli`
- `tsonic`

These implement the compiler and CLI itself.

Target-specific compiler implementations live under `packages/targets/<target>/`.
The C# target is split into:

- `packages/targets/csharp/emitter` for lowering-plan to C# source emission
- `packages/targets/csharp/backend` for project generation and .NET build orchestration

The `tsonic` package is the npm wrapper under `npm/tsonic`. It forwards the
binary to `@tsonic/cli`. It should stay on the same patch version line as the
compiler packages until a deliberate major release; `1.0.0` is not the package
release track.

## Core authoring packages

- `@tsonic/core`
- `@tsonic/globals`

These support language-facing types, intrinsics, and ambient declarations.

## First-party source packages

- `@tsonic/js`
- `@tsonic/nodejs`
- `@tsonic/express`

These packages are authored directly in TypeScript and consumed as source
through `tsonic.package.json`. Public source package names stay target-neutral:
users import `@tsonic/js`, `@tsonic/nodejs`, and `@tsonic/express` for the
default C# target. Target support is declared in package metadata with
`supportedTargets`; user import paths do not include a target suffix.

Example:

```json
{
  "schemaVersion": 1,
  "kind": "tsonic-source-package",
  "surfaces": ["@tsonic/js"],
  "supportedTargets": ["csharp"],
  "source": {
    "namespace": "nodejs",
    "exports": {
      ".": "./src/index.ts"
    }
  }
}
```

When the compiler resolves a source package for an active backend target, it
rejects packages whose `supportedTargets` does not include that target. The same
target check runs in `tsonic add npm` before a package is accepted into a
workspace.

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

## Version and workspace hygiene

The compiler repo must keep the root package graph coherent:

- root `package.json` and `package-lock.json` must agree so `npm ci` works
- the root workspace must include `packages/*`, `packages/targets/*/*`, and
  `npm/*`
- `node_modules/.bin/tsonic` must resolve to the repo-local wrapper, not a
  globally installed binary
- first-party package pins must refer to published versions unless a sibling
  source checkout is intentionally used by a test or wave script

Concrete failure shape:

```json
{
  "workspaces": ["packages/*"],
  "devDependencies": {
    "tsonic": "^0.0.75"
  }
}
```

If a generated sample under `packages/tsonic` declares `"name": "tsonic"` and
`"version": "1.0.0"`, npm treats it as the workspace package named `tsonic`.
That conflicts with the real wrapper and makes a fresh `npm ci` fail. The fix
is not a compatibility shim; the generated sample must not be checked in as a
compiler workspace package.
