# Diagnostics Architecture

Diagnostics are produced primarily in the frontend and carried through later stages where needed.

## Where Diagnostics Come From

- config loading
- surface/profile resolution
- module/source-package resolution
- validation
- IR building
- numeric proof
- backend emission/build orchestration

## Design Rule

Reject ambiguity at the compiler layer rather than hoping C# will fail in a useful way later.

This is why Tsonic emits compile-time diagnostics for:

- unproven numeric narrows
- unsupported object-literal runtime cases
- unresolved source-package manifest errors
- unsupported generic function value escapes

## Current Important Diagnostic Families

- module/config/source-package: `TSN1004`, `TSN8A01`–`TSN8A05`
- unsupported/runtime-shape: `TSN2001`, `TSN7414`, `TSN7432`
- numeric proof: `TSN5101`–`TSN5110`
- yield lowering: `TSN6101`

See `../diagnostics.md` for user-facing guidance.
