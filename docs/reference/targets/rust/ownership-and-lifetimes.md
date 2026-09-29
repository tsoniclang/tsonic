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

## Captures and final uses

For a mutable binding used only by one synchronous closure, Tsonic stores the
binding in that closure's environment. A native `FnMut` or `FnOnce` parameter
uses an ordinary mutable captured value. The cloneable source-callable `Fn`
contract instead needs `Cell<T>` for a Copy value or `RefCell<T>` for a Clone
value that is not Copy. Neither needs a separate shared location allocation.
Reads release their borrow before later source effects.

Independent closures that update the same binding still share it. Taking its
address, creating owners repeatedly, or retaining it across suspension can
require shared storage. An imported native owner is not itself a reason to add
another owner; binding mutation and payload ownership are separate questions.

Final-use moves use the closed source-use graph. A last stored field of a
local, unaliased generated value can move without cloning. Borrowed receivers,
later uses, cleanup and overlapping argument borrows retain their required
storage. Imported destructors are not inferred from a type name.

Native imported carriers remain native through aliases, generic calls, fields,
optional values and captures. Explicit `move` remains available when a native
ownership transfer should be stated in the source. It does not bypass Rust's
borrow checker or manufacture a longer lifetime.

## Evidence required for ownership changes

Use checked source uses and Rust's compiler-understood type, trait and lifetime
guarantees. Names such as `Rc` and `Arc` are not a wrapper-detection mechanism;
a third-party native type receives the same treatment. A `Clone` implementation
does not prove that cloning is cheap or preserves shared identity.

Providers may transport compiler facts, not invent those guarantees. Missing
evidence prevents an optimization; it does not justify a hidden wrapper, unsafe
conversion or weakened aliasing rule. This requirement is not a claim that every
existing ownership path has already been proved optimal.

- [Compiler-understood ownership](../../../architecture/workspace-agent-policy.md#compiler-understood-ownership)
