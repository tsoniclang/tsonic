---
title: Callbacks
---

# Callbacks

Callback-heavy code is supported where receiver type, overload selection, and
delegate shape can be resolved deterministically.

## Common supported situations

- JS-surface array callbacks
- Node-style request and event handlers
- CLR delegate calls through generated binding packages
- Express middleware and route handlers

## Practical advice

- annotate callback return types when a call surface is sensitive
- prefer explicit numeric/value intent in CLR-heavy callback flows
- treat diagnostics as real surface mismatches, not optional warnings

Example:

```ts
const ys = Enumerable.Where(xs, (x: number): boolean => x > 1);
```

That explicit `boolean` return often makes the intended overload family obvious
to the compiler.

## Common sources of trouble

- overloaded CLR methods with weakly inferred callback returns
- callbacks crossing package or generic boundaries without enough type context
- JS-surface callbacks passed into CLR-heavy APIs without explicit intent
- callbacks that rely on dynamic `any` / `unknown` escape hatches

## Rule of thumb

- JS-to-JS callback flows are usually straightforward
- CLR-bound callback flows are where explicit annotations matter most
- if the callback crosses package, generic, or overload boundaries, be more
  explicit than you would in ordinary TypeScript
