# Limitations

Tsonic is intentionally incomplete where deterministic lowering is not yet
credible.

## Boundaries

- fully open-ended dynamic JavaScript behavior is out of scope
- unsupported reflection-heavy patterns are rejected
- unsupported generic/runtime shape combinations are rejected rather than
  guessed
- unsupported package graph shapes fail explicitly
- `unknown` is a broad boundary type that can be stored and narrowed only
  through deterministic closed-carrier guards
- source-level `JsValue` is rejected; use `unknown` at user-facing JS/JSON
  boundaries
- JSON parse/stringify requires a closed compile-time type

## Read this as a design boundary, not a temporary apology

The compiler rejects constructs instead of accepting them under a
model that cannot be defended end-to-end.

## Why this is a feature

The compiler chooses correctness and predictability over permissive fallback.

That is why the site documents the stack in strict terms instead of implying
best-effort compatibility.
