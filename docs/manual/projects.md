# Projects and configuration

A Tsonic project is an npm package containing `package.json`, `tsonic.json`,
and TypeScript source files.

```text
my-app/
├── package.json
├── tsonic.json
└── src/
    ├── App.ts
    └── model.ts
```

`package.json` has two jobs:

1. it declares ordinary npm dependencies and workspaces;
2. it makes installed Tsonic targets and capabilities discoverable.

Use ESM:

```json
{
  "name": "my-app",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsonic build --project tsonic.json"
  },
  "devDependencies": {
    "@tsonic/cli": "0.0.1",
    "@tsonic/target-csharp": "0.0.1"
  }
}
```

Local TypeScript imports use ESM output spelling:

```ts
import { User } from "./model.js";
```

The authored file remains `model.ts`. TSTS resolves the `.js` specifier using
Node ESM rules.

## Source roots

```json
{
  "entryPoint": "App.ts",
  "rootFiles": ["App.ts", "worker.ts"],
  "rootDir": "src",
  "outDir": "out",
  "targets": [{ "id": "csharp" }]
}
```

- `rootDir` is resolved from the directory containing `tsonic.json`.
- `entryPoint` and every `rootFiles` entry are resolved below `rootDir`.
- `rootFiles` defaults to the entrypoint and must include it when supplied.
- Imported dependencies are followed through the checked ESM graph.
- `outDir` is resolved from the project directory, not from `rootDir`.

Tsonic does not read a `tsconfig.json`. Fields such as `compilerOptions`,
`paths`, `baseUrl`, `extends`, and TypeScript project references are rejected
instead of being silently ignored.

## Four kinds of control

Keep each choice with its owner:

| Control | Example | Owner |
| --- | --- | --- |
| Source semantics | exact `int32`, JS surface, Node import | Tsonic source and selected target |
| Target semantics | C# nullable mode, Rust foundation | target options in `tsonic.json` |
| Generated native project | C# `RuntimeIdentifier` | supported target project options |
| Open native configuration | Web SDK, Cargo target, linker script | user-owned native project or native CLI |

There is no generic override bag. The host accepts only compiler-owned project
fields. Each target validates its own `options` object.

For example, C# owns `targetFramework`, `outputType`, and `publishAot`. Other
scalar MSBuild properties may be supplied through C# `properties`. Rust does
not expose arbitrary Cargo TOML through `tsonic.json`; use a user-owned
`Cargo.toml` when the generated manifest is not enough.

## Generated native projects

Without `projectFile`, the target emits a complete native project:

```text
out/
├── csharp/
│   ├── TsonicGenerated.csproj
│   ├── src/
│   └── generated/
└── rust/
    ├── Cargo.toml
    └── src/
```

The complete `outDir` is compiler-owned. Do not place authored files there.
Tsonic builds into staging and replaces the published tree only after every
selected target succeeds. A failed build leaves the previous successful output
intact.

## User-owned native projects

Set a target `projectFile` when the native project must control its SDK,
dependencies, platform, linker, profiles, or deployment:

```json
{
  "targets": [{
    "id": "csharp",
    "options": {
      "projectFile": "native/Example.csproj",
      "outputType": "Exe"
    }
  }]
}
```

```json
{
  "targets": [{
    "id": "rust",
    "options": {
      "projectFile": "native/Cargo.toml",
      "foundation": "std",
      "outputType": "bin"
    }
  }]
}
```

Tsonic still uses target options to decide source semantics and generated
source shape. It emits no native project file and never edits the project you
named. The native project must include the generated sources and declare every
runtime or third-party dependency they use.

See the complete [C# project guide](targets/csharp/projects-and-output.md) and
[Rust project guide](targets/rust/projects-and-output.md).

## Multiple targets

One project may select more than one target:

```json
{
  "entryPoint": "index.ts",
  "rootDir": "src",
  "targets": [
    { "id": "csharp", "surfaces": ["js"] },
    { "id": "rust", "surfaces": ["js"] }
  ]
}
```

This works when the source contract and entry behavior are valid for every
selected target. C# and Rust applications have different entrypoint rules, so
portable applications normally share library packages and use a small
target-specific entry module. See [applications and libraries](applications-and-libraries.md).
