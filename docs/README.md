# Tsonic documentation

Tsonic compiles TypeScript into target-native source projects. TypeScript is
the authored language; C# or Rust is the generated language; the native target
toolchain owns the final build.

```text
TypeScript source
  -> TSTS parse, bind, check, and finalized semantic evidence
  -> Tsonic project and target orchestration
  -> target analysis, classification, planning, and target AST
  -> target printer and project artifacts
  -> dotnet or Cargo
```

This directory is the canonical documentation source for the Tsonic host, the
C# target, the Rust target, shared source semantics, surfaces, capabilities,
provider authoring, and certification. Package repositories may summarize
their local build commands, but they must link here rather than maintain a
second product contract.

## Start here

- [Install and build a first project](manual/get-started.md)
- [Configure projects and output](manual/projects.md)
- [Choose an application or library](manual/applications-and-libraries.md)
- [Organize packages and workspaces](manual/packages-and-workspaces.md)
- [Build, test, and deploy](manual/build-test-deploy.md)
- [Understand the compiler model](manual/compiler-model.md)
- [Use neutral source semantics](manual/source-semantics.md)
- [Choose source profiles and capabilities](manual/surfaces-and-capabilities.md)
- [Choose a target](manual/targets/README.md)
- [Troubleshoot a build](manual/troubleshooting.md)

## Target manuals

- [C# target](manual/targets/csharp/README.md)
- [Rust target](manual/targets/rust/README.md)

The target manuals use the same structure where the targets have the same
responsibility: configuration, source profile, native APIs, interop and
safety, projects and output, providers, and support boundaries. Target-native
concepts remain target-native. C# documents assemblies, attributes, and
NativeAOT; Rust documents foundations, ownership, lifetimes, traits, and Cargo.

## Reference

- [CLI](reference/cli.md)
- [`tsonic.json`](reference/project-config.md)
- [Toolchains and platforms](reference/toolchains.md)
- [Shared limitations](reference/limitations.md)
- [Neutral types and markers](reference/source-core.md)
- [JavaScript source profile](reference/javascript-source-profile.md)
- [Node capability](reference/node-capability.md)
- [Diagnostics](reference/diagnostics.md)
- [Package catalog](reference/package-catalog.md)
- [C# reference](reference/targets/csharp/README.md)
- [Rust reference](reference/targets/rust/README.md)

## Architecture and validation

- [Architecture](architecture/README.md)
- [Compilation lifecycle](architecture/compilation-lifecycle.md)
- [Target-pack contract](architecture/target-pack-contract.md)
- [Provider and runtime ownership](architecture/provider-and-runtime-ownership.md)
- [Validation](validation/README.md)
- [Documentation drift policy](validation/documentation-drift.md)

## Documentation rules

1. User-facing behavior is demonstrated with TypeScript input and observable
   target behavior.
2. Exact option, marker, module, and support inventories live in reference
   pages, not in introductory prose.
3. C# and Rust use symmetric document locations only where their ownership is
   genuinely symmetric.
4. Unsupported behavior is documented as a precise semantic boundary, never
   as a vague roadmap statement.
5. Counts and support tables are mechanically checked; prose does not become a
   second source of truth.
