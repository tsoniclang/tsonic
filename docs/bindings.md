# CLR Bindings & Workspaces

This guide explains **where bindings live** and how to structure **multi-project repos (npm workspaces)** that use:

- **Vendored C# source** you build into a local DLL
- **Local DLLs** you copy into a project
- **NuGet packages** restored by the .NET SDK

Tsonic is “airplane-grade” about determinism:

- Bindings generation is **repeatable** (`tsonic restore`)
- Generated artifacts are **not committed**
- Import resolution is **standard Node/TypeScript module resolution**

## What Are “Bindings”?

Bindings are the TypeScript + metadata files produced by **tsbindgen** that let Tsonic map:

- `import { Console } from "@tsonic/dotnet/System.js"` → CLR type `System.Console`

Bindings packages contain (at minimum):

- `*.d.ts` / `*.js` namespace facades
- per-namespace `bindings.json` files
- `internal/metadata.json` (CLR metadata)

## Where Tsonic Puts Bindings (Two Modes)

### Mode A — Local Auto-Generated Bindings (Per Project)

When you do **not** provide a types package, Tsonic generates bindings into the project’s internal cache:

```
<projectRoot>/.tsonic/bindings/
  nuget/<pkg>-types/...
  dll/<asm>-types/...
  framework/<runtime>-types/...
```

Then Tsonic **mirrors** the generated package into:

```
<projectRoot>/node_modules/<pkg>-types/...
```

Mirroring is a directory copy, and Tsonic will only overwrite an existing `node_modules/<name>` if it was previously generated (it checks `package.json` for `tsonic.generated: true`).

Why mirror into `node_modules`?

- `tsc` and Node already resolve modules from `node_modules`
- no custom `paths` or special import rules are required
- `.tsonic/` remains the authoritative cache (gitignored, regen-able)

### Mode B — Shippable Bindings Packages (Workspace or Published)

If you want **stable imports** across multiple workspace packages (or you want to publish bindings), create a dedicated bindings package and put generated output under `dist/`:

```
packages/acme-markdig/
  vendor/net10.0/Markdig.dll
  dist/tsonic/bindings/
    Markdig.js
    Markdig.d.ts
    Markdig/
      bindings.json
      internal/metadata.json
```

Then export those files via `package.json` `exports` so consumers can import namespaces normally:

```ts
import { Markdown } from "@acme/markdig/Markdig.js";
```

Tsonic resolves imports using Node resolution (including `exports`) and then locates the nearest `bindings.json`.

## Commands and What They Produce

### `tsonic add nuget <PackageId> <Version> [typesPackage]`

- Always writes a pinned `dotnet.packageReferences` entry in `tsonic.json`.
- If `typesPackage` is provided:
  - installs it (devDependency)
  - does **not** auto-generate bindings
- If `typesPackage` is omitted:
  - `tsonic restore` generates bindings into:
    - `.tsonic/bindings/nuget/<pkg>-types/`
    - mirrors to `node_modules/<pkg>-types/`

NuGet restore scratch space lives at:

```
.tsonic/nuget/
  tsonic.nuget.restore.csproj
  obj/project.assets.json
```

The actual NuGet package DLLs are read from the standard .NET NuGet cache (not copied into your repo).

### `tsonic add package ./path/to/MyLib.dll [typesPackage]`

- Resolves the full DLL dependency closure (deterministic).
- Copies resolved DLLs into `lib/*.dll` and adds them to `dotnet.libraries`.
- If `typesPackage` is omitted:
  - generates bindings per assembly into:
    - `.tsonic/bindings/dll/<asm>-types/`
    - mirrors to `node_modules/<asm>-types/`
- If `typesPackage` is provided:
  - installs it and skips auto-generation for that DLL
  - records the mapping in `tsonic.json` so future `tsonic restore` runs won’t try to generate bindings for it:

```json
{
  "dotnet": {
    "libraries": [
      { "path": "lib/MyLib.dll", "types": "my-lib-types" }
    ]
  }
}
```

## Recommended Workspace Layout (Concrete Example)

Here’s an “everything” monorepo layout that cleanly supports all three dependency sources.

### Root

```
acme-monorepo/
  package.json
  packages/
    app/                 # Tsonic executable
    domain/              # Tsonic library
    vendor-markdig/      # vendored C# DLL + bindings package
```

Root `package.json` (npm only; build deps first):

```json
{
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run -w @acme/vendor-markdig bindings && npm run -w @acme/domain build && npm run -w @acme/domain bindings && npm run -w @acme/app build",
    "restore": "npm run -ws --if-present restore"
  }
}
```

### Vendored C# Source → DLL + Shared Bindings Package

`packages/vendor-markdig/` contains:

- a DLL you built locally (from vendored source)
- a bindings package exported from `dist/tsonic/bindings/`

`packages/vendor-markdig/package.json`:

```json
{
  "name": "@acme/vendor-markdig",
  "private": true,
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    "./*.js": {
      "types": "./dist/tsonic/bindings/*.d.ts",
      "default": "./dist/tsonic/bindings/*.js"
    }
  },
  "scripts": {
    "bindings": "node ./scripts/generate-bindings.mjs"
  },
  "devDependencies": {
    "@tsonic/tsbindgen": "^0.7.0"
  }
}
```

Consumer projects then “install the DLL” into their own `lib/` via:

```bash
cd packages/app
tsonic add package ../vendor-markdig/vendor/net10.0/Markdig.dll @acme/vendor-markdig
```

This produces:

- `packages/app/lib/Markdig.dll`
- `packages/app/tsonic.json` includes `dotnet.libraries: ["lib/Markdig.dll"]`
- imports work via the workspace package:
  - `import { Markdown } from "@acme/vendor-markdig/Markdig.js"`

### Local DLLs (Downloaded / Copied)

If a DLL is only used by one workspace package, keep it per-project:

```bash
cd packages/app
tsonic add package ./thirdparty/MyLib.dll
```

Tsonic copies DLLs into `packages/app/lib/` and auto-generates bindings into `packages/app/.tsonic/bindings/dll/...` (mirrored into `packages/app/node_modules/...`).

If multiple workspace packages need the same local DLL, prefer a shared bindings package like `vendor-markdig` to avoid duplication.

### NuGet Packages

Per-project:

```bash
cd packages/app
tsonic add nuget PhotoSauce.MagicScaler 0.14.2
tsonic restore
```

If you want a stable reusable types package across multiple workspaces, pass a `typesPackage`:

```bash
tsonic add nuget PhotoSauce.MagicScaler 0.14.2 @acme/magicscaler
```

…where `@acme/magicscaler` is a workspace (or published) bindings package exporting `dist/tsonic/bindings/`.

## What Should Be Committed?

Per workspace package:

- Commit: `src/`, `tsonic.json`, `package.json`, and typically `lib/` (runtime DLL + any local DLLs you rely on).
- Gitignore: `node_modules/`, `.tsonic/`, `generated/`, `out/`, and for bindings packages also `dist/`.

## Summary Rules (Copy/Paste)

- **Never commit** `.tsonic/` or `node_modules/`.
- Use `.tsonic/bindings/**` for **auto-generated per-project** bindings.
- Use `dist/tsonic/bindings/**` + `exports` for **shippable bindings packages** (workspaces/published).
- Treat “vendored C# source” the same as “local DLL” at the Tsonic boundary: build a DLL, then `tsonic add package <dll>`.
