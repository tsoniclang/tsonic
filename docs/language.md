# Language Model

Tsonic is not “all TypeScript plus best effort.” It is a strict subset designed
for deterministic lowering to C#.

## The model

- one compiler-owned noLib baseline
- one ambient surface per workspace
- explicit package imports for CLR and Node/Express usage
- no hidden permissive runtime bridges

## Consequences of that model

This affects how you should read and write Tsonic code:

- ambient behavior comes from the selected surface, not from whichever package
  happens to be installed
- authored source packages are compiled as part of the same program
- unsupported dynamic behavior is rejected instead of being preserved
- generated output is treated as a closed world
- runtime reflection and runtime shape discovery are not language semantics

## What that means in practice

- unsupported dynamic constructs are rejected
- explicit numeric intent matters
- package graphs are compiled deterministically
- emitted output is treated as a closed world
- JSON APIs require concrete compile-time types so generated serializers can be
  rooted for NativeAOT

## Unsupported runtime-dynamic constructs

These constructs are rejected in emitted Tsonic code:

```ts
typeof value;
Array.isArray(value);
"name" in value;
delete value.name;
for (const key in value) {}
await import("./module.js");
import.meta.url;
globalThis;
```

Use concrete domain types, static imports, explicit discriminant fields, nominal
guards, `for...of` over typed collections, and typed JSON APIs.

## Use the right docs

- [Surfaces and Packages](surfaces-and-packages.md) for ambient world vs package
  boundaries
- [Type System Rules](type-system.md) for strictness expectations
- [Limitations](limitations.md) for what is still out of scope
