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

## Flow facts versus runtime dynamic probing

Tsonic accepts TypeScript flow facts only when the compiler can also prove a
deterministic NativeAOT-safe carrier operation.

Accepted examples:

```ts
export function read(value: string | undefined): string {
  if (typeof value === "string") {
    return value;
  }

  return "";
}

export function hasName(value: { name?: string }): boolean {
  return "name" in value;
}
```

The first example narrows a closed primitive union. The second example uses a
string-literal key against a stable closed structural carrier, so the generated
code does not perform runtime member discovery. For declared closed members,
the check lowers to the proven boolean result. For dictionary carriers, it
lowers to the typed dictionary key operation.

Rejected examples:

```ts
const kind = typeof value;
"name" in (value as object);
delete value.name;
for (const key in value) {}
await import("./module.js");
import.meta.url;
globalThis;
```

Use concrete domain types, static imports, explicit discriminant fields,
compiler-recognized guards, `for...of` over typed collections, and typed JSON
APIs.

## Use the right docs

- [Surfaces and Packages](surfaces-and-packages.md) for ambient world vs package
  boundaries
- [Type System Rules](type-system.md) for strictness expectations
- [Limitations](limitations.md) for what is still out of scope
