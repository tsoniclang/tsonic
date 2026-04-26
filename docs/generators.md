---
title: Generators
---

# Generators

Generator support exists where lowering is explicit and deterministic.

## Rule

If a generator shape can be lowered to the runtime model, it is
supported. If not, it is rejected rather than emulated loosely.

## What that means in practice

Generators are best treated as a supported subset feature:

- typed `yield` values are fine when the compiler can model the iterator shape
- ordinary `for...of` consumption is the expected usage pattern
- exotic coroutine tricks or open-ended dynamic generator manipulation are not
  the design target

Example:

```ts
export function* range(limit: number): Generator<number, void, void> {
  for (let i = 0; i < limit; i++) {
    yield i;
  }
}
```

## Why this matters

The same rule that applies to async and callbacks applies here: deterministic
lowering beats permissive but fragile behavior.

## Practical expectation

Treat generators as a supported subset feature, not as a promise of all
TypeScript generator patterns.
