# C# target limitations

The target rejects source semantics that cannot be represented without
guessing or forbidden runtime machinery.

## General boundaries

- runtime `eval`, source generation, and arbitrary dynamic member lookup;
- reflection-based fallback over arbitrary target objects;
- unproved overload, conversion, storage, pointer, attribute, or provider
  identity;
- runtime module cycles that cannot preserve ESM initialization semantics;
- open value graphs whose required operations are not finite and closed;
- native metadata shapes the .NET provider cannot express legally in its
  TypeScript declaration model.

## Application and library boundaries

An exported function named `main` is not a C# entrypoint by convention:

```ts
export function main(): void {}
```

For executable output, call it from top-level code. The generated
`TsonicEntrypoint.Main` runs the entry module.

C# library module initialization must be synchronous. Top-level `await` in a
library entry graph is rejected because a CLR module initializer cannot await.

Runtime ESM cycles are accepted only when the closed module plan preserves
ordering and initialization state. A cycle that needs JavaScript temporal dead
zones or unresolved live bindings is rejected.

## Storage and pointer boundaries

Address formation requires exact stable storage identity. Provider/project
indexers require an explicit location-equivalence policy. Unsupported escaping
loop-binding storage and overlapping/unreconcilable location projections reject
instead of copying values silently.

Native pointer access requires the exact pointer carrier, lexical safety
context, declaration safety contract where applicable, and generated/user
project permission. One control never implies another.

## Generator boundaries

The target uses native C# iterator syntax when it preserves TypeScript
behavior. C# placements that forbid `yield`, or generator contracts that cannot
be represented by the approved native/runtime protocol, reject. Tsonic does not
reimplement the C# compiler's general state-machine transformation.

For example, C# does not permit `yield return` in `catch`, `finally`, or a
`try` that has a `catch`. Tsonic reports the unsupported placement rather than
emitting a hand-written state machine with different behavior.

## Generated project boundary

Generated projects use `Microsoft.NET.Sdk`. Web, desktop, test, MAUI, and
custom SDK projects must be user-owned. Tsonic emits source for them but does
not synthesize or rewrite their native project graph.

## Provider boundaries

Ambiguous provider relations, contradictory metadata, missing referenced
assemblies, unsupported defaults, unresolved type families, and invalid
heritage fail at provider closure. The target does not broaden imports or omit
declarations to make checking pass.

## Deliberate source-to-source boundaries

Tsonic does not provide a general runtime JavaScript engine inside a C#
program. A JavaScript operation is available only when the selected source
surface has one closed, tested C# implementation. Likewise, a legal
TypeScript construct may still reject when preserving its initialization,
aliasing, exception, or reflection behavior would require open runtime
machinery. The diagnostic identifies the missing target contract; it is not a
request to approximate the behavior.
