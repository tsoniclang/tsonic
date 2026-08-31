# Tsonic architecture

Tsonic has four ownership layers.

```text
L1  TSTS checked TypeScript program
    TS-Go-shaped syntax + TypeScript semantic decisions
                         |
L2  Extension and target API
    finalized facts + target-neutral source navigation
                         |
L3  Shared Tsonic host capabilities
    project graph + plugins + artifacts + publication
                         |
L4  Target implementation
    analysis + classification + planning + target AST + printer
```

## Layer 1: checked source

TSTS owns parsing, binding, checking, flow, narrowing, contextual typing,
generic inference, source overload selection, and retained checker evidence.
Targets do not modify the TypeScript AST and do not redo these decisions.

## Layer 2: public compiler boundary

The extension and target APIs expose immutable checked syntax, opaque semantic
handles, finalized facts, source navigation, target analysis contracts,
provider declarations, and artifact contracts. This layer contains no C#,
Rust, .NET, or Cargo policy.

## Layer 3: shared host

The host owns project paths, source collection, plugin discovery, source
profile and capability composition, target sessions, target artifact
reconstruction, staged publication, and toolchain handoff. It does not decide
how TypeScript types map to C# or Rust.

## Layer 4: target

Each target owns its complete native semantic pipeline:

```text
analyze -> classify -> seal target program -> plan -> print -> toolchain
```

Analysis may reach a target-specific fixed point, but planning consumes a
sealed target program. The C# and Rust implementations share these boxes while
using different target facts and algorithms inside them.

## Documents

- [Compilation lifecycle](compilation-lifecycle.md)
- [Target-pack contract](target-pack-contract.md)
- [Provider and runtime ownership](provider-and-runtime-ownership.md)
- [Workspace agent policy](workspace-agent-policy.md)
