# Support Types (\_support/types.d.ts)

## Overview

The `_support/types.d.ts` file provides TypeScript type definitions for CLR concepts that don't have JavaScript equivalents. These types enable .NET interop while maintaining type safety.

**File Location:**

```
node_modules/@types/dotnet/
  _support/
    types.d.ts          # Unsafe CLR markers and helpers
```

---

## TSByRef<T>

Wrapper for C# `ref`, `out`, and `in` parameters.

```typescript
/**
 * Wrapper for C# ref/out/in parameters.
 * Allows pass-by-reference semantics in JavaScript.
 *
 * @example
 * const result: TSByRef<number> = { value: 0 };
 * if (Int32.TryParse("42", result)) {
 *     console.log(result.value);  // 42
 * }
 */
export type TSByRef<T> = {
  value: T;
};
```

**Usage:** See [ref-out-parameters.md](ref-out-parameters.md) for complete documentation.

---

## TSUnsafePointer<T>

Marker type for C# pointer types (`T*`, `void*`, `IntPtr`).

```typescript
/**
 * Marker type for unsafe C# pointers.
 * TypeScript cannot safely represent pointer arithmetic.
 * Use with extreme caution.
 *
 * @example
 * // C#: unsafe void* ptr = ...
 * declare const ptr: TSUnsafePointer<void>;
 */
export type TSUnsafePointer<T> = {
  readonly __brand: "unsafe-pointer";
  readonly __type: T;
};
```

**Purpose:**

- Represent `IntPtr`, `UIntPtr`, `void*`, `T*` in TypeScript
- Prevent accidental use (opaque type)
- Type-safe at declaration, runtime validation needed

**Important:** Pointer operations are **not supported** in Tsonic. This type exists only for declaration completeness.

**Example:**

```typescript
// C# method with pointer parameter
declare function GetMemory(size: number): TSUnsafePointer<void>;
declare function ReleaseMemory(ptr: TSUnsafePointer<void>): void;

// TypeScript usage
const ptr = GetMemory(1024);
// Cannot dereference or do pointer arithmetic
ReleaseMemory(ptr); // Only pass to other methods
```

---

## TSDelegate<TArgs, TReturn>

Marker type for C# delegates (function pointers with invoke lists).

```typescript
/**
 * Marker type for C# delegates.
 * Delegates are more complex than simple functions.
 *
 * @example
 * // C#: public delegate void MyDelegate(int x, string y);
 * export type MyDelegate = TSDelegate<[number, string], void>;
 */
export type TSDelegate<TArgs extends any[], TReturn> = {
  readonly __brand: "delegate";
  (...args: TArgs): TReturn;
};
```

**Why separate from Function:**

- C# delegates support multicast (combine multiple delegates)
- Delegates have `Invoke`, `BeginInvoke`, `EndInvoke` methods
- Delegates can be combined with `+` operator

**Note:** In MVP, delegates are treated as simple functions. Post-MVP may add multicast support.

---

## TSNullable<T>

Explicitly nullable value types (C# `Nullable<T>` / `T?` for value types).

```typescript
/**
 * C# Nullable<T> for value types.
 * Reference types use `T | null` directly.
 *
 * @example
 * // C#: int? maybeInt = null;
 * const maybeInt: TSNullable<number> = null;
 */
export type TSNullable<T> = T | null;
```

**Difference from `T | null`:**

- In C#, value types (struct, enum, primitives) cannot be null normally
- `Nullable<T>` wraps value types to allow null
- Reference types are already nullable

**Usage:**

```typescript
import { Int32 } from "System";

// C#: int? x = 42;
const x: TSNullable<number> = 42;

// C#: int? y = null;
const y: TSNullable<number> = null;

// C#: int value = x.Value;
const value: number = x!; // Non-null assertion
```

---

## TSFixed<T, N>

Marker for C# fixed-size buffers (unsafe feature).

```typescript
/**
 * C# fixed-size buffer (unsafe).
 * Used in structs for inline arrays.
 *
 * @example
 * // C#: struct Data { public fixed byte buffer[128]; }
 * type Data = {
 *     buffer: TSFixed<number, 128>;
 * };
 */
export type TSFixed<T, N extends number> = {
  readonly __brand: "fixed-buffer";
  readonly __type: T;
  readonly __length: N;
  [index: number]: T;
};
```

**Purpose:** Represent C# `fixed` keyword for inline arrays in structs.

**Limitation:** JavaScript doesn't support fixed-size buffers. This is a declaration-only type.

---

## TSStackAlloc<T>

Marker for C# stackalloc expressions.

```typescript
/**
 * C# stackalloc expression marker.
 * Allocates array on stack (not heap).
 *
 * @example
 * // C#: Span<byte> buffer = stackalloc byte[256];
 * declare function GetBuffer(): TSStackAlloc<Uint8Array>;
 */
export type TSStackAlloc<T> = {
  readonly __brand: "stackalloc";
  readonly data: T;
};
```

**Note:** JavaScript doesn't have stack allocation. This is a marker type only.

---

## Usage in Declarations

### Example: System.IntPtr

```typescript
// C# struct
declare namespace System {
  export class IntPtr {
    static readonly Zero: IntPtr;
    static readonly Size: number;

    constructor(value: number);
    constructor(value: TSUnsafePointer<void>);

    ToInt64(): number;
    ToPointer(): TSUnsafePointer<void>;

    static Add(pointer: IntPtr, offset: number): IntPtr;
    static Subtract(pointer: IntPtr, offset: number): IntPtr;
  }
}
```

### Example: Nullable<T>

```typescript
// C# Nullable<T>
declare namespace System {
  export class Nullable_1<T> {
    constructor(value: T);

    readonly HasValue: boolean;
    readonly Value: T;

    GetValueOrDefault(): T;
    GetValueOrDefault(defaultValue: T): T;
  }

  // Alias for convenience
  export type Nullable<T> = TSNullable<T>;
}
```

### Example: Delegate

```typescript
// C# delegate
declare namespace System {
  export type Action = TSDelegate<[], void>;
  export type Action_1<T> = TSDelegate<[T], void>;
  export type Func_1<TResult> = TSDelegate<[], TResult>;
  export type Func_2<T, TResult> = TSDelegate<[T], TResult>;
}
```

---

## Tsonic Compiler Handling

### TSByRef<T>

**Detection:**

```typescript
if (type.symbol?.name === "TSByRef" && type.typeArguments?.length === 1) {
  const wrappedType = type.typeArguments[0];
  // Handle as ref/out parameter
}
```

**Code Generation:**

```typescript
// TypeScript: const x: TSByRef<number> = { value: 10 };
// C#: int x = 10;
```

### TSUnsafePointer<T>

**Detection:**

```typescript
if (type.symbol?.name === "TSUnsafePointer") {
  diagnostic(TSN7001, "Unsafe pointers not supported in Tsonic");
}
```

**Limitation:** Unsafe code not supported in MVP.

### TSNullable<T>

**Detection:**

```typescript
if (type.symbol?.name === "TSNullable" || isUnionWithNull(type)) {
  // Emit nullable type in C#
  emitType(getNonNullableType(type));
  emit("?");
}
```

**Code Generation:**

```typescript
// TypeScript: const x: TSNullable<number> = null;
// C#: int? x = null;
```

---

## Implementation Requirements

### 1. Type Declaration

All support types must be declared in `_support/types.d.ts`:

```typescript
// File: node_modules/@types/dotnet/_support/types.d.ts

export type TSByRef<T> = { value: T };
export type TSUnsafePointer<T> = {
  readonly __brand: "unsafe-pointer";
  readonly __type: T;
};
export type TSDelegate<TArgs extends any[], TReturn> = {
  readonly __brand: "delegate";
  (...args: TArgs): TReturn;
};
export type TSNullable<T> = T | null;
export type TSFixed<T, N extends number> = {
  readonly __brand: "fixed-buffer";
  readonly __type: T;
  readonly __length: N;
  [index: number]: T;
};
export type TSStackAlloc<T> = {
  readonly __brand: "stackalloc";
  readonly data: T;
};
```

### 2. Compiler Recognition

Tsonic must recognize these types by name:

```typescript
// Compiler type checking
function isSupportType(type: Type): SupportTypeKind | null {
  const name = type.symbol?.name;
  switch (name) {
    case "TSByRef":
      return "byref";
    case "TSUnsafePointer":
      return "pointer";
    case "TSDelegate":
      return "delegate";
    case "TSNullable":
      return "nullable";
    case "TSFixed":
      return "fixed";
    case "TSStackAlloc":
      return "stackalloc";
    default:
      return null;
  }
}
```

### 3. Error Messages

Provide helpful errors for unsupported types:

```typescript
// TSN7001: Unsafe pointer usage
if (kind === "pointer") {
  diagnostic(
    TSN7001,
    "Unsafe pointers are not supported. Use IntPtr for opaque handles."
  );
}

// TSN7002: Fixed buffer usage
if (kind === "fixed") {
  diagnostic(TSN7002, "Fixed-size buffers are not supported in safe code.");
}

// TSN7003: Stack allocation
if (kind === "stackalloc") {
  diagnostic(TSN7003, "stackalloc is not supported. Use heap allocation.");
}
```

---

## Diagnostics

### TSN7001: Unsafe Pointer Not Supported

```
Unsafe pointers are not supported in Tsonic.
Use IntPtr for opaque handles or redesign to avoid unsafe code.
```

### TSN7002: Fixed Buffer Not Supported

```
Fixed-size buffers (unsafe feature) are not supported.
Use arrays or Span<T> instead.
```

### TSN7003: Stack Allocation Not Supported

```
stackalloc is not supported in Tsonic.
Use heap-allocated arrays instead.
```

### TSN7004: Incorrect TSByRef Usage

```
TSByRef<T> can only be used for method parameters marked ref/out/in.
Do not use for return types or fields.
```

---

## Future Enhancements

### Post-MVP: Span<T> Support

```typescript
// Future support for Span<T> and Memory<T>
export type TSSpan<T> = {
  readonly Length: number;
  [index: number]: T;
};

export type TSMemory<T> = {
  readonly Length: number;
  Slice(start: number, length?: number): TSMemory<T>;
  Span: TSSpan<T>;
};
```

### Post-MVP: Ref Returns

```csharp
// C#: ref int GetRef(int[] array, int index)
declare function GetRef(array: number[], index: number): TSByRef<number>;
```

Currently not supported, but future enhancement.

---

## Best Practices

1. **Import from \_support**: `import type { TSByRef } from "@types/dotnet/_support/types";`
2. **Use sparingly**: These types indicate CLR-specific features
3. **Document usage**: Comment why support type is needed
4. **Avoid unsafe types**: Don't use TSUnsafePointer unless absolutely necessary
5. **Prefer safe alternatives**: Use IntPtr over TSUnsafePointer

**Good:**

```typescript
import type { TSByRef } from "@types/dotnet/_support/types";
import { Int32 } from "System";

// Clear ref parameter usage
const result: TSByRef<number> = { value: 0 };
Int32.TryParse(input, result);
```

**Bad:**

```typescript
import type { TSUnsafePointer } from "@types/dotnet/_support/types";

// Avoid unsafe pointers
const ptr: TSUnsafePointer<number> = getSomePointer(); // ❌ Unsafe
```

---

## See Also

- [ref-out-parameters.md](ref-out-parameters.md) - TSByRef<T> detailed documentation
- [metadata.md](metadata.md) - Parameter metadata (isRef, isOut, isIn)
- [type-mappings.md](type-mappings.md) - C# to TypeScript type conversions
- [tsbindgen spec/output-layout.md](../../tsbindgen/spec/output-layout.md) - \_support directory structure
