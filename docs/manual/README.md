# Tsonic manual

The manual explains how to author TypeScript that becomes native source code.
It is task-oriented and uses complete examples. Exact option and API catalogs
live in the [reference](../reference/README.md).

## Reading order

1. [Get started](get-started.md).
2. Read the [compiler model](compiler-model.md).
3. Learn [projects and output ownership](projects.md).
4. Learn [neutral source semantics](source-semantics.md).
5. Select [surfaces and capabilities](surfaces-and-capabilities.md).
6. Continue with the [C#](targets/csharp/README.md) or
   [Rust](targets/rust/README.md) target manual.

Most ordinary TypeScript needs no target marker:

```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```

Markers are used only when the source must express a semantic choice that
ordinary TypeScript does not encode, such as an exact integer width, a mutable
storage location, a native pointer operation, or a target safety boundary.
