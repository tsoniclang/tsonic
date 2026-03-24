# Build Output

Tsonic emits C# under a generated project and then builds it with the .NET toolchain.

## Pipeline

```text
TypeScript
  -> frontend IR
  -> CSharpAst
  -> printed C#
  -> generated project
  -> dotnet build/publish
```

## Default Layout

```text
packages/<project>/
  generated/
    src/
    Program.cs
    tsonic.csproj
    bin/
    obj/
  out/
```

## Generated Files

### `generated/src/*.cs`

Per-module emitted C#.

### `generated/Program.cs`

Entry wrapper for executable builds.

### `generated/tsonic.csproj`

Resolved project file containing:

- target framework
- runtime identifier
- framework references
- package references
- local library references
- NativeAOT/runtime settings

### `generated/src/__tsonic_json.g.cs`

Generated only when JSON AOT support is needed.

## Output Types

### Executable

Default app build.

### Managed library

Use `output.type = "library"` with NativeAOT disabled.

#### Source-package library

If the project declares `tsonic/package-manifest.json` with
`kind: "tsonic-source-package"` (or sets
`output.libraryPackaging = "source-package"`), Tsonic emits:

```text
packages/<project>/
  dist/
    package.json
    src/**/*.ts
    src/**/*.d.ts
    tsonic/package-manifest.json
    net10.0/
      <Assembly>.dll
```

This is the native first-party path:

- source stays the package contract
- consuming projects compile the package source directly
- generated first-party bindings are not part of the published contract

#### Bindings-library

If `output.libraryPackaging = "bindings-library"` (or no source-package
manifest is present), Tsonic keeps the legacy bindings-first output:

```text
packages/<project>/
  dist/
    index.d.ts
    tsonic/
      bindings/
      package-manifest.json
    net10.0/
      <Assembly>.dll
```

### NativeAOT library

Use `output.type = "library"` with:

```json
{
  "output": {
    "type": "library",
    "nativeAot": true,
    "nativeLib": "shared"
  }
}
```

`nativeLib` can be:

- `shared`
- `static`

## Useful Build Flags

- `--no-generate` — reuse existing generated project
- `--no-aot` — build managed output
- `--rid <rid>`
- `--optimize size|speed`
- `--no-strip`
- `--keep-temp`

## When `--no-generate` Exists

This is for workflows where external tooling writes additional generated C# into the generated directory and you need to build/run without wiping it first.

Examples:

- EF Core compiled models
- interceptor-generated sources

## Cross-Compilation

Examples:

```bash
tsonic build --rid linux-x64
tsonic build --rid osx-arm64
tsonic build --rid win-x64
```

## Troubleshooting

- inspect `generated/src/*.cs`
- inspect `generated/tsonic.csproj`
- inspect `dist/tsonic/package-manifest.json` for source-package vs bindings-library mode
- rerun with `--verbose`
- if package references changed, run `tsonic restore`
