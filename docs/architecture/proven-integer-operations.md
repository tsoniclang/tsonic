# Proven integer operations

Ordinary TypeScript `number` remains a floating-point source contract. An
optimization must not change its public type, native overload selection or
observable arithmetic behavior.

The shared source analysis in `@tsonic/target-api/source` exports
`analyzeSourceIntegerRanges`. It uses exact declaration identities and checked
numeric carriers supplied by target analysis. It retains immutable per-occurrence
ranges; it does not rewrite the source or create integer marker annotations.

Both C# and Rust consume this evidence during analysis, before sealing their
target program. Planning only consumes the sealed selection and constructs
target AST. There is no checker query or source-text matching in the printer.

## Remainder

```ts
function residues(): number {
  let total = 0;
  for (let value = 0; value < 100; value++) total += value % 7;
  return total;
}
```

Within this loop, `value` is a non-negative integer below 100. The divisor is the
positive integer 7. The remainder can use native signed-32-bit arithmetic and
convert the exact result back to `number`. The surrounding declarations retain
their existing contracts. There is no speculative branch or runtime guard.

Selection requires both operands to be finite, non-negative integers fitting a
signed 32-bit carrier, with a strictly positive divisor. Only the already-selected
primitive floating remainder is replaced. Existing integer/BigInt/native provider
operations are not reclassified.

The analysis admits stable local values, exact bounded arithmetic, branch joins,
ascending bounded loops and non-negative square-bounded nested loops. Captured or
address-exposed bindings are not admitted. Loop-carried writes invalidate prior
ranges. Unmodelled control flow does not manufacture evidence. The per-callable
node/depth budgets discard that callable's entire proof if exhausted.

Negative operands, possible negative zero, NaN, infinities, fractions, zero
divisors, uncertain mutation and unproven bounds keep the original arithmetic.
Cross-function/object-field range propagation is not inferred from a caller's
validation. The absence of proof never makes otherwise-supported source invalid.

This optimization does not replace cheap floating additions with extra casts or
promise every numeric local becomes an integer. Native-oriented source can use
explicit `int32` annotations when its own contract establishes the bounds.
