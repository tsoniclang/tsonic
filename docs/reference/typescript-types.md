---
title: TypeScript types and utilities
---

# TypeScript types and utilities

TypeScript checks the authored type program before a target chooses native
representations. Type-only constructs erase, but their checked result still
controls the shape and operations that a target must preserve.

```ts
interface User {
  readonly id: string;
  name: string;
  active?: boolean;
}

type UserPatch = Partial<User>;
type UserName = Pick<User, "name">;
```

No native type named `Partial` or `Pick` is emitted. The checker resolves each
alias to a concrete TypeScript shape. C# or Rust then accepts that shape only
when it has one closed target representation.

## Pinned utility types

Tsonic supplies one pinned no-library TypeScript profile. Its utility types
are:

| Family | Utilities |
| --- | --- |
| Object transformations | `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record` |
| Union filtering | `Exclude`, `Extract`, `NonNullable` |
| Function projection | `Parameters`, `ReturnType`, `ThisParameterType`, `OmitThisParameter` |
| Constructor projection | `ConstructorParameters`, `InstanceType` |
| Promise projection | `Awaited` |
| Inference and contextual typing | `NoInfer`, `ThisType` |
| String-literal transformation | `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize` |

These are TypeScript semantics, not target helpers. TSTS recognizes the exact
profile declarations rather than matching an alias spelling. A local type
with the same name keeps its local meaning.

```ts
interface Formatter {
  (value: number): string;
}

type FormatterArgs = Parameters<Formatter>; // [value: number]
type FormatterResult = ReturnType<Formatter>; // string
type Loaded = Awaited<Promise<Promise<string>>>; // string
type Loud = Uppercase<"ready">; // "READY"
```

For overloaded functions and constructors, projection follows the pinned
TypeScript declaration contract. Target code does not independently choose a
different overload while interpreting a utility type.

## `unknown`

`unknown` is a broad source type, not permission to inspect an arbitrary
native object. TypeScript requires narrowing before member access:

```ts
export function text(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return "not text";
}
```

The targets differ when an un-narrowed value must cross a native boundary:

| Target | Runtime contract |
| --- | --- |
| C# | A passive value can use the closed `TsValue` carrier. Only its finite, explicitly implemented operations are available. |
| Rust | The annotation alone does not create a carrier. An exact producer such as supported `JSON.parse` may supply `JsValue`; an arbitrary native `unknown` parameter or result is rejected. |

## `any`

`any` relaxes TypeScript checking. It does not authorize reflection or
best-effort native dispatch.

```ts
declare const value: any;
value.name;
value();
```

C# accepts only the operations implemented by its closed `TsValue` contract.
Rust accepts broad values only when selected producer and consumer operations
agree on one exact carrier. Otherwise the target reports an unsupported
operation before publishing output.

## Target closure

A utility or broad source type is usable when both conditions hold:

1. TypeScript checking resolves the source type and operation.
2. The selected target proves one native carrier and every required operation.

Source-only uses therefore work more broadly than values crossing a native
ABI. See the target-specific [C# type mapping](targets/csharp/type-mapping.md),
[Rust type mapping](targets/rust/type-mapping.md), and their limitations.
