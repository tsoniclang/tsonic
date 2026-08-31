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

### Borrow examples

Returning a borrow requires one exact source lifetime. This is valid only when
the authored contract identifies it:

```ts
import type { Life, Ref } from "@tsonic/rust/types.js";

function first<L extends Life>(value: Ref<string, L>): Ref<string, L> {
  return value;
}
```

Two live mutable borrows of overlapping storage are rejected. Tsonic does not
clone or box the value merely to satisfy the borrow checker.

### Native macros

Rust macros are syntax expansion, not callable metadata. They are not exposed
as ordinary provider functions. Put a small native Rust function around a
macro when TypeScript must call it, then expose that function through rustdoc.

### `core` and `alloc` applications

Generated `core` and `alloc` outputs are libraries. A user-owned native
project must provide executable startup, panic behavior, an allocator when
required, linker policy, and the target specification. Tsonic will not infer
those platform contracts from source code.

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

## Application entry

Generated binary output requires the entry module to export `main` with a
unit result:

```ts
export function main(): void {}
```

An async entry may return `Promise<void>`. An unexported function, a function
in another module, or a non-unit result is not selected by name recovery.
