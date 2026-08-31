# Validation and certification

Documentation describes a capability only when executable evidence proves the
same source contract.

## Validation layers

| Layer | Evidence |
| --- | --- |
| Shared host | Tsonic source, host, CLI, artifact, and architecture suites |
| C# target | Target unit/integration tests plus generated C# and `dotnet` builds |
| Rust target | Target unit/integration tests plus generated Rust, Cargo, rustfmt, and Clippy |
| C# downstream | `proof-is-in-the-pudding` and Tsumo |
| Rust downstream | `rust-pudding` and Tsumo Rust |

Focused tests are development tools. Merge certification uses each repository's
complete bounded gate and downstream proof required by the changed contract.

## Positive and negative proof

A capability needs both:

1. valid TypeScript that emits and executes the exact target behavior; and
2. missing, conflicting, or unsupported evidence that fails at the owning
   semantic boundary.

For example, native-pointer support needs a positive explicit-unsafe program
and a negative program proving dereference without `unsafeContext` is rejected.

## Generated-code quality

Generated target code must be deterministic, native-toolchain valid, and free
of semantic fallback. Humanization is accepted only when it preserves
correctness and has no material runtime-performance regression.
