# Validation and certification

Documentation describes a capability only when executable evidence proves the
same source contract.

## Validation layers

| Layer | Evidence |
| --- | --- |
| Shared host | Tsonic source, host, CLI, artifact, and architecture suites |
| C# target | Target unit/integration tests plus generated C# and `dotnet` builds |
| Rust target | Target unit/integration tests plus generated Rust, Cargo, rustfmt, and Clippy |
| C# downstream | `csharp-pudding` and Tsumo |
| Rust downstream | `rust-pudding` and Tsumo Rust |

Focused tests are development tools. Merge certification uses each repository's
complete bounded gate and downstream proof required by the changed contract.

## Temporary test projects

Native test fixtures use `test/scripts/test-workspaces.mjs` to allocate a fresh
directory under `.temp` or `.tests`. The same helper serves C# and Rust tests.
It removes only the directories it created, after the owning test process exits
successfully. Files stay available to later assertions, teardown hooks and
repeated native toolchain commands until then.

A failed process retains its workspaces and reports their paths when its exit
hook runs. Fatal errors and killed runs also leave their files for inspection.
Cleanup failures fail the run. Existing
scratch, shared provider caches, package downloads and release artifacts are
not swept or expired by this helper. Remove retained failure workspaces only
after investigating them; this helper does not prune earlier runs.

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

## Release certification

The [npm release procedure](releasing.md) owns package-impact decisions,
coordinated versioning, public-registry installation, interruption recovery,
and the maintainer completion checklist. A private package test is necessary
but does not replace the final source-free public npm proof.
