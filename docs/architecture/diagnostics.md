# Diagnostics Architecture

Diagnostics are produced primarily in the frontend and carried through later
stages where needed.

## Where diagnostics come from

- config loading
- surface/profile resolution
- module/source-package resolution
- validation
- IR building
- numeric proof
- backend emission/build orchestration

## Design rule

Reject ambiguity at the compiler layer rather than hoping C# will fail in a
useful way later.

This is why Tsonic emits compile-time diagnostics for:

- unproven numeric narrows
- unsupported object-literal runtime cases
- unresolved source-package manifest errors
- unsupported generic function value escapes
- bad local package ownership or missing DLL boundaries

## Why downstream verification still matters

Even with strong compiler diagnostics, some failures only appear at:

- real generated project compile time
- runtime startup
- application package-graph boundaries

That is why diagnostics architecture and downstream verification are both part
of the quality story.
