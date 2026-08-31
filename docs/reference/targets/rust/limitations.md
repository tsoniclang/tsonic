# Rust target limitations

The target rejects source semantics that cannot be represented without
guessing, open runtime machinery, or a contract not present in checked source
or provider evidence.

## General boundaries

- runtime `eval`, source generation, and arbitrary dynamic member lookup;
- reflection-based fallback over arbitrary Rust or JavaScript values;
- unproved ownership, borrow, lifetime, overload, conversion, provider,
  fallibility, safety, or foundation identity;
- module cycles whose ESM initialization order cannot be preserved by the
  closed Rust module-initialization plan;
- open value graphs whose operations cannot be enumerated statically;
- rustdoc signatures whose source type, generic, lifetime, const, associated
  type, ABI, or receiver contract cannot be represented exactly.

## Rust-specific boundaries

- a borrowed result that escapes without one exact source lifetime;
- overlapping or otherwise unproved mutable borrows;
- generator, async, closure, or resource storage that captures incompatible
  authored lifetimes;
- open generic virtual dispatch whose concrete project instantiations cannot
  be closed finitely;
- a trait object or associated-type projection without one exact provider
  identity and resolved carrier;
- platform startup, allocator, panic, linker, and target policy inferred from
  a `core` or `alloc` output request.

## JavaScript and Node boundaries

Locale- or timezone-dependent operations require an explicit deterministic
data contract; host-default locale/timezone behavior is not compiler
semantics. Open object inspection, dynamic field addition that changes a
closed Rust layout, arbitrary cyclic graph projection, and Node stream/event
schedulers outside the capability's closed contracts remain rejected.

## Native compiler boundary

Tsonic generates the exact authored and selected Rust contract. `rustc` may
still reject source that violates native borrow checking, coherence, target,
linker, or dependency rules. Tsonic does not rewrite the contract to evade a
native diagnostic.
