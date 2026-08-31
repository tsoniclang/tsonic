# Rust ownership and lifetimes

## Two source lanes

1. **Ordinary TypeScript** is annotation-free. Rust analysis selects a closed
   ownership, borrowing, copying, cloning, and storage plan from all uses.
2. **Native Rust API contracts** may author `Ref`, `Mut`, and lifetime types so
   distinctions required by the API remain visible to TypeScript checking.

```ts
function ordinary(value: string): string {
  return value.trim();
}
```

No lifetime syntax is added to this source. By contrast:

```ts
function read<L extends Life>(value: Ref<int32, L>): int32 {
  return load(value);
}
```

preserves one exact authored Rust lifetime.

## Elision

Omitting the second type argument in `Ref<T>` or `Mut<T>` requests legal Rust
elision. Provider calls may receive exact call-scoped elided identities. Those
identities are local to the selected call and generic parameter; they never
become guessed global lifetimes.

## Higher-ranked and retained values

Generic callable lifetime binders lower to higher-ranked Rust callable bounds.
Async functions, closures, and generators retain authored borrows only when
one exact storage lifetime can be proven. An ambiguous capture graph rejects
before planning.

## Native compiler remains authoritative

Tsonic preserves the authored lifetime contract and proves its own carrier and
operation consistency. `rustc` remains the final authority for Rust borrow
validity. Tsonic does not weaken an authored lifetime or extend a borrow to
make native compilation succeed.
