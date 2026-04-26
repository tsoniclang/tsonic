---
title: Build Modes
---

# Build Modes

The main compiler/build commands are:

```bash
tsonic generate
tsonic build
tsonic run
tsonic test
tsonic pack
```

## `generate`

Emits the generated C# project without compiling it.

Use this when you want to inspect generated output or integrate with custom
build steps.

Typical uses:

- inspect generated `.cs` files
- inspect `tsonic.csproj`
- hand the generated project to another tool
- debug package graph ownership

## `build`

Compiles the project into the configured output shape.

Supported output shapes include:

- NativeAOT executable
- managed executable
- managed library
- NativeAOT shared or static library

Current defaults from project resolution:

- executable projects default to `nativeAot: true`
- library projects default to `nativeAot: false`

## `run`

Builds and runs the project in one step.

Use this for local application execution, not for inspecting generated output.

## `test`

Runs the project’s tests through the Tsonic toolchain.

`tsonic test` generates a non-NativeAOT test assembly and runs `dotnet test`.

## `pack`

Packages library projects for distribution.

That requires:

- `output.type = "library"`
- `output.packable = true`

## Important build switches

- `--project <name>` — build a specific project
- `--rid <rid>` — choose runtime identifier for native outputs
- `--no-aot` — force managed output
- `--no-generate` — build from an existing generated directory
- `--keep-temp` — keep artifacts for inspection

## Local package ownership and build mode

The build model also supports local first-party package references with
two ownership modes:

- `source` — compile the referenced package into the generated source closure
- `dll` — build the referenced package separately and consume its DLL boundary

That choice matters most for larger workspaces with multiple sibling projects.

## Generated layout

The generated project is a deterministic view of the Tsonic package graph. That
is why source-package manifests, surface selection, and runtime package metadata
all matter at build time.
