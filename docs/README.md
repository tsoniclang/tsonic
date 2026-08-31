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

## Table of Contents

### Manual

- [Manual overview](manual/README.md)
- [Get started](manual/get-started.md)
- [Compiler model](manual/compiler-model.md)
- [Projects](manual/projects.md)
- [Applications and libraries](manual/applications-and-libraries.md)
- [Packages and workspaces](manual/packages-and-workspaces.md)
- [Build, test, and deploy](manual/build-test-deploy.md)
- [Source semantics](manual/source-semantics.md)
- [Surfaces and capabilities](manual/surfaces-and-capabilities.md)
- [Targets](manual/targets/README.md)
- [C# manual](manual/targets/csharp/README.md)
- [C# source profile](manual/targets/csharp/source-profile.md)
- [C# interop and safety](manual/targets/csharp/interop-and-safety.md)
- [C# projects and output](manual/targets/csharp/projects-and-output.md)
- [Rust manual](manual/targets/rust/README.md)
- [Rust source profile](manual/targets/rust/source-profile.md)
- [Rust ownership and safety](manual/targets/rust/ownership-and-safety.md)
- [Rust projects and output](manual/targets/rust/projects-and-output.md)
- [Troubleshooting](manual/troubleshooting.md)

### Reference

- [Reference overview](reference/README.md)
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
- [C# configuration](reference/targets/csharp/configuration.md)
- [C# source modules](reference/targets/csharp/source-modules.md)
- [C# type mapping](reference/targets/csharp/type-mapping.md)
- [C# native APIs](reference/targets/csharp/native-apis.md)
- [C# JavaScript surface](reference/targets/csharp/javascript-surface.md)
- [C# Node capability](reference/targets/csharp/node-capability.md)
- [C# provider API](reference/targets/csharp/provider-api.md)
- [C# language support](reference/targets/csharp/language-support.md)
- [C# support inventory](reference/targets/csharp/support-inventory.md)
- [C# limitations](reference/targets/csharp/limitations.md)
- [Rust reference](reference/targets/rust/README.md)
- [Rust configuration](reference/targets/rust/configuration.md)
- [Rust source modules](reference/targets/rust/source-modules.md)
- [Rust type mapping](reference/targets/rust/type-mapping.md)
- [Rust ownership and lifetimes](reference/targets/rust/ownership-and-lifetimes.md)
- [Rust native APIs](reference/targets/rust/native-apis.md)
- [Rust JavaScript surface](reference/targets/rust/javascript-surface.md)
- [Rust Node capability](reference/targets/rust/node-capability.md)
- [Rust provider API](reference/targets/rust/provider-api.md)
- [Rust language support](reference/targets/rust/language-support.md)
- [Rust support inventory](reference/targets/rust/support-inventory.md)
- [Rust limitations](reference/targets/rust/limitations.md)

### Architecture

- [Architecture overview](architecture/README.md)
- [Compilation lifecycle](architecture/compilation-lifecycle.md)
- [Target-pack contract](architecture/target-pack-contract.md)
- [Provider and runtime ownership](architecture/provider-and-runtime-ownership.md)
- [Workspace policy](architecture/workspace-agent-policy.md)

### Validation

- [Validation overview](validation/README.md)
- [Documentation drift policy](validation/documentation-drift.md)

The target manuals use the same structure where the targets have the same
responsibility. Target-native concepts remain target-native. C# documents
assemblies, attributes, and NativeAOT. Rust documents foundations, ownership,
lifetimes, traits, and Cargo.

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
