# Projects and output

One `tsonic.json` identifies authored TypeScript inputs and one or more target
selections. Paths are resolved from the project file and `rootDir`; target
artifacts are published below `outDir/<target-id>`.

```json
{
  "entryPoint": "main.ts",
  "rootFiles": ["main.ts", "startup.ts"],
  "rootDir": "src",
  "outDir": "out",
  "targets": [
    { "id": "csharp" },
    { "id": "rust" }
  ]
}
```

`entryPoint` selects the project entry. `rootFiles` may include additional
authored roots that are not imported by the entry point. Imported source
dependencies are collected normally.

## Compiler-owned output

Without a target `projectFile`, the target generates a complete native project:

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

The exact names can depend on target options and source package structure. The
entire `outDir` is compiler-owned. A successful build publishes one complete
staged tree atomically. A failed or incomplete build does not replace the last
successful output.

## User-owned native projects

Set the target's `projectFile` when native project configuration must remain
under user control:

```json
{
  "targets": [{
    "id": "csharp",
    "options": { "projectFile": "native/Example.csproj" }
  }]
}
```

```json
{
  "targets": [{
    "id": "rust",
    "options": { "projectFile": "native/Cargo.toml" }
  }]
}
```

In this mode Tsonic emits generated source artifacts only. It does not rewrite
the `.csproj` or `Cargo.toml`. The user-owned project explicitly includes or
references the generated sources and owns framework, package, target triple,
linker, publication, and deployment settings.

See the exact [project configuration reference](../reference/project-config.md),
[C# project guide](targets/csharp/projects-and-output.md), and
[Rust project guide](targets/rust/projects-and-output.md).
