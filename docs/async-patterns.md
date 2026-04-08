---
title: Async Patterns
---

# Async Patterns

Tsonic supports async workflows that can be lowered deterministically.

## Supported direction

- `Promise` construction
- `then`, `catch`, and `finally`
- supported `async` / `await` flows
- async callbacks when the delegate or handler shape is known

Typical examples:

- Promise-returning helper functions
- request/response flows in Node-style or ASP.NET Core code
- downstream application startup logic

Example:

```ts
export async function loadText(path: string): Promise<string> {
  const value = await Promise.resolve(path);
  return value.trim();
}
```

## Where async usually goes wrong

- callback return type falls to `unknown`
- generic promise value loses enough context that the emitter cannot pick a
  stable lowered shape
- code relies on open-ended dynamic thenables instead of ordinary Promise-based
  flows
- control flow depends on dynamic import or other non-closed-world edges

## Important rule

Async code still has to stay within the deterministic subset. The compiler does
not keep implicit dynamic promise behavior just because TypeScript accepts it.

## Practical advice

- annotate return types on exported async functions
- annotate callback returns when CLR overloads are involved
- prefer normal `Promise<T>` flows over clever promise-like abstractions
- debug async failures the same way you debug any other lowering issue: reduce
  to a small repro and inspect the generated output
