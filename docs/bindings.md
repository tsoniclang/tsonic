# CLR Bindings & Workspaces

This guide explains **where CLR bindings live** and how to structure **multi-project repos (npm workspaces)** that use:

- **Local DLLs** (including vendored C# projects you build into a DLL)
- **NuGet packages** restored by the .NET SDK

Tsonic is “airplane-grade” about determinism:

- Dependency + bindings generation is **repeatable** (`tsonic restore`)
- Generated caches are **not committed**
- Import resolution is **standard Node/TypeScript module resolution**

## What Are “Bindings”?

Bindings are the TypeScript stubs + CLR manifest files produced by **tsbindgen** that let Tsonic map:

- `import { Console } from "@tsonic/dotnet/System.js"` → CLR type `System.Console`

Bindings packages contain (at minimum):

- `*.d.ts` / `*.js` namespace facades
- per-namespace `bindings.json` files (the CLR manifest used by the compiler)

> tsbindgen uses a **unified** `bindings.json` format (no `.metadata.json` sidecars).

### Flattened Named Exports (Optional)

CLR namespaces can only contain **types**, not free functions/values. However, Tsonic emits
module “static containers” (C# static types) for files that only export functions/constants,
and it’s often nicer to import those exports directly:

```ts
import { buildSite } from "@acme/engine/Tsumo.Engine.js";
buildSite(req);
```

To make this airplane-grade, **tsbindgen** can emit an `exports` map inside each namespace
`bindings.json`, describing how a named value export maps to its declaring CLR type + member.

Example (`Tsumo.Engine/bindings.json` excerpt):

```json
{
  "namespace": "Tsumo.Engine",
  "types": [],
  "exports": {
    "buildSite": {
      "kind": "method",
      "clrName": "buildSite",
      "declaringClrType": "Tsumo.Engine.BuildSite",
      "declaringAssemblyName": "Tsumo.Engine"
    }
  }
}
```

With this, Tsonic can compile `buildSite(req)` to:

```csharp
global::Tsumo.Engine.BuildSite.buildSite(req)
```

Notes:

- This is **additive**: the container type remains importable:

  ```ts
  import { BuildSite } from "@acme/engine/Tsumo.Engine.js";
  BuildSite.buildSite(req);
  ```

- For **Tsonic-built** libraries, tsbindgen detects module containers automatically.
- For **external** assemblies, you can opt in explicitly with tsbindgen (e.g. `--flatten-class <ClrType>`).

## Workspace Model (Required)

Tsonic always operates in a workspace:

- Workspace root contains `tsonic.workspace.json`
- Workspace-level external deps live under `libs/` and `dotnet.*` in `tsonic.workspace.json`
- Projects live under `packages/<name>/` and contain `tsonic.json`

Example layout:

```txt
my-workspace/
  tsonic.workspace.json
  package.json
  libs/
  packages/
    app/
      tsonic.json
      src/...
    domain/
      tsonic.json
      src/...
```

## Where Bindings Live (Two Modes)

### Mode A — Local Auto-Generated Bindings (Workspace Cache)

When you do **not** provide a types package, Tsonic generates bindings into the workspace cache:

```txt
<workspaceRoot>/.tsonic/bindings/
  nuget/<pkg>-types/...
  dll/<asm>-types/...
  framework/<runtime>-types/...
```

Then Tsonic **mirrors** each generated package into:

```txt
<workspaceRoot>/node_modules/<pkg>-types/...
```

Mirroring is a directory copy, and Tsonic will only overwrite an existing
`node_modules/<name>` if it was previously generated (it checks `package.json`
for `tsonic.generated: true`).

Why mirror into `node_modules`?

- `tsc` and Node already resolve modules from `node_modules`
- no custom `paths` or special import rules are required
- `.tsonic/` remains the authoritative cache (gitignored, regen-able)

### Mode B — Shippable Bindings Packages (Workspace or Published)

If you want **stable imports** across multiple workspaces (or you want to publish bindings),
write generated output under `dist/` and export it via npm `exports`:

```txt
packages/acme-markdig/
  dist/tsonic/bindings/
    Markdig.js
    Markdig.d.ts
    Markdig/
      bindings.json
      internal/index.d.ts
```

`package.json`:

```json
{
  "name": "@acme/markdig",
  "private": true,
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    "./*.js": {
      "types": "./dist/tsonic/bindings/*.d.ts",
      "default": "./dist/tsonic/bindings/*.js"
    }
  }
}
```

Then consumers import namespaces normally:

```ts
import { Markdown } from "@acme/markdig/Markdig.js";
```

Tsonic resolves imports using Node resolution (including `exports`) and then locates the
nearest `bindings.json` for CLR metadata discovery.

## Commands and What They Produce

### `tsonic add nuget <PackageId> <Version> [typesPackage]`

- Adds/updates `dotnet.packageReferences` in `tsonic.workspace.json`.
- If `typesPackage` is provided:
  - installs it (devDependency)
  - does **not** auto-generate bindings
- If `typesPackage` is omitted:
  - Tsonic generates per-package bindings under:
    - `.tsonic/bindings/nuget/<pkg>-types/`
  - mirrors to:
    - `node_modules/<pkg>-types/`

NuGet restore scratch space lives at:

```txt
.tsonic/nuget/
  tsonic.nuget.restore.csproj
  obj/project.assets.json
```

The actual NuGet package DLLs are read from the standard .NET NuGet cache (not copied into your repo).

### `tsonic add package ./path/to/MyLib.dll [typesPackage]`

- Resolves the full DLL dependency closure (deterministic).
- Copies resolved DLLs into `libs/*.dll` and adds them to `dotnet.libraries`.
- If `typesPackage` is omitted:
  - generates bindings per assembly into:
    - `.tsonic/bindings/dll/<asm>-types/`
  - mirrors to:
    - `node_modules/<asm>-types/`
- If `typesPackage` is provided:
  - installs it and skips auto-generation
  - records the mapping in `dotnet.libraries` so restore/build know bindings are supplied externally:

    ```json
    {
      "dotnet": {
        "libraries": [
          { "path": "libs/MyLib.dll", "types": "@acme/mylib-types" }
        ]
      }
    }
    ```

### `tsonic restore`

Restore is the “clone a repo and get to green” command:

- Restores NuGet deps defined in `tsonic.workspace.json`
- (Re)generates local bindings for:
  - NuGet packages without `types`
  - local DLLs under `libs/` without a `types` mapping
  - FrameworkReferences without `types`

`tsonic build` / `tsonic generate` / `tsonic run` automatically run `tsonic restore`
when the workspace declares any `dotnet.*` deps.

## Tsonic Library Projects

For `output.type = "library"` projects, `tsonic build` copies .NET artifacts under `dist/`
and also emits shippable CLR bindings under `dist/tsonic/bindings/` (no extra scripts needed):

```txt
packages/domain/
  dist/
    net10.0/
      Domain.dll
    tsonic/
      bindings/
        Domain.js
        Domain.d.ts
        Domain/
          bindings.json
          internal/index.d.ts
```

## What Should Be Committed?

- Commit: `tsonic.workspace.json`, workspace `package.json`, all `packages/*/src`, and `packages/*/tsonic.json`.
- Commit: `libs/` **if you depend on local DLLs** (so other devs get identical inputs).
- Gitignore: `node_modules/`, `.tsonic/`, `packages/*/generated/`, `packages/*/out/`, `packages/*/dist/` (unless you are publishing a bindings package).
- For published bindings packages: include `dist/tsonic/bindings/` in the published artifact (either committed or generated in your publish pipeline).
