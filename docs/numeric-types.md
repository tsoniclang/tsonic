# Numeric Types

Tsonic provides precise control over numeric types through the `@tsonic/core` package. This guide covers when and how to use integer types in your Tsonic programs.

## Overview

When you *annotate* a value as TypeScript `number`, Tsonic emits a C# `double`.

Tsonic also applies C#-style **numeric literal inference**:

- Integer-looking literals default to `int` (or `long` if out of 32-bit range)
- Floating-point literals default to `double`

```typescript
import { int, long } from "@tsonic/core/types.js";

// Integer literal → int
const i = 42; // C#: int i = 42;

// Large integer literal → long
const big = 2147483648; // C#: long big = 2147483648L;

// Force double: annotate as number
const d: number = 42; // C#: double d = 42.0;

// Integer: int → System.Int32
const count: int = 42; // C#: int count = 42;
```

## Available Integer Types

Import from `@tsonic/core`:

| TypeScript | C# Type  | Range             | Use Case                  |
| ---------- | -------- | ----------------- | ------------------------- |
| `byte`     | `byte`   | 0 to 255          | Binary data, small counts |
| `sbyte`    | `sbyte`  | -128 to 127       | Signed byte values        |
| `short`    | `short`  | -32,768 to 32,767 | Small integers            |
| `ushort`   | `ushort` | 0 to 65,535       | Unsigned small integers   |
| `int`      | `int`    | -2B to 2B         | Most integer operations   |
| `uint`     | `uint`   | 0 to 4B           | Unsigned integers         |
| `long`     | `long`   | -9Q to 9Q         | Large integers            |
| `ulong`    | `ulong`  | 0 to 18Q          | Large unsigned integers   |
| `float`    | `float`  | ±3.4e38           | Single precision floats   |

## Type Annotations (Preferred)

Prefer type annotations for numeric types (especially for integers):

```typescript
import { int, byte, short, long, float } from "@tsonic/core/types.js";

const intValue: int = 1000; // C#: int intValue = 1000;
const byteValue: byte = 255; // C#: byte byteValue = 255;
const shortValue: short = 1000; // C#: short shortValue = 1000;
const longValue: long = 1000000; // C#: long longValue = 1000000L;

const floatValue: float = 1.5; // C#: float floatValue = 1.5f;
const doubleValue: number = 1.5; // C#: double doubleValue = 1.5;
```

Numeric type assertions (`as int`, `as byte`, etc.) exist, but they are **proof-checked** and are not meant for everyday typing. Prefer annotations and contextual typing; see [Explicit Narrowing](#explicit-narrowing-as-int).

## Basic Usage

### Declaring Integer Variables

Use a type annotation when you need an `int`:

```typescript
import { int } from "@tsonic/core/types.js";

const count: int = 10;
const index: int = 0;
const max: int = 100;
```

Or rely on expected types (no cast required):

```typescript
import { int } from "@tsonic/core/types.js";

function takesInt(x: int): void {
  // ...
}

takesInt(10);
```

### Integer Arithmetic

Integer operations produce integer results:

```typescript
import { int } from "@tsonic/core/types.js";

const x: int = 10;
const y: int = 20;

// All produce int results
const sum = x + y; // 30
const diff = y - x; // 10
const product = x * y; // 200
```

### Integer Division

Integer division truncates toward zero (unlike JavaScript):

```typescript
import { int } from "@tsonic/core/types.js";

const a: int = 10;
const b: int = 3;
const result = a / b; // 3 (not 3.333...)

const c: int = 100;
const d: int = 33;
const quotient = c / d; // 3
```

## When to Use Integer Types

### Required: .NET API Compatibility

Many .NET APIs require integer parameters:

```typescript
import { int } from "@tsonic/core/types.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const list = new List<string>();
list.add("one");
list.add("two");

// List.get() requires int index
const idx: int = 0;
const item = list.get(idx);
```

### Required: LINQ Operations

Some LINQ methods require integer return values:

```typescript
import { int } from "@tsonic/core/types.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic";
import { Enumerable } from "@tsonic/dotnet/System.Linq";

const numbers = new List<int>();
// ... populate list

// Sum() returns int when input is int
const total = Enumerable.sum(numbers);
```

### Recommended: Array Indexing

Use integers for array access to avoid floating-point issues:

```typescript
import { int } from "@tsonic/core/types.js";

const items: string[] = ["a", "b", "c", "d"];
const idx: int = 2;
const item = items[idx]; // "c"

// Arithmetic works naturally
const nextIdx = idx + 1;
const nextItem = items[nextIdx]; // "d"
```

### Recommended: Loop Counters

Use integers for loop counters:

```typescript
import { int } from "@tsonic/core/types.js";

const max: int = 10;
for (let i: int = 0; i < max; i = i + 1) {
  // i is int throughout
}
```

### Not Needed: General Math

For general calculations, `number` (double) is usually fine:

```typescript
// double is fine for general math
const price = 19.99;
const tax = price * 0.08;
const total = price + tax;
```

## Explicit Narrowing (`as int`)

You generally **don't** need `as int` when an `int` is already expected (variable type annotation, function parameter, indexer, etc.).

```typescript
import { int } from "@tsonic/core/types.js";

const a: int = 10;
const b: int = 3;

// No cast needed: int context drives typing
const result: int = (a + b) * 2;
```

`as int` is proof-checked and cannot be used as a general-purpose float→int truncation. In most code, prefer `: int` and let expected types drive typing.

## Function Signatures

### Integer Parameters

Declare function parameters with integer types:

```typescript
import { int } from "@tsonic/core/types.js";

function factorial(n: int): int {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

const result = factorial(5); // 120
```

### Integer Return Types

Functions can return integer types:

```typescript
import { int } from "@tsonic/core/types.js";

function sumRange(start: int, end: int): int {
  let total: int = 0;
  for (let i: int = start; i <= end; i = i + 1) {
    total = total + i;
  }
  return total;
}
```

## Common Patterns

### Counter Variables

```typescript
import { int } from "@tsonic/core/types.js";

let count: int = 0;
count = count + 1;
```

### Array Length Access

```typescript
import { int } from "@tsonic/core/types.js";

const items: string[] = ["a", "b", "c"];
const len: int = items.length;
const lastIdx: int = len - 1;
const lastItem = items[lastIdx];
```

### Modulo Operations

```typescript
import { int } from "@tsonic/core/types.js";

const value: int = 17;
const divisor: int = 5;
const remainder = value % divisor; // 2
```

### Bitwise Operations

Integer types support all bitwise operations:

```typescript
import { int } from "@tsonic/core/types.js";

const a: int = 0b1010; // 10
const b: int = 0b1100; // 12

const and = a & b; // 8 (0b1000)
const or = a | b; // 14 (0b1110)
const xor = a ^ b; // 6 (0b0110)
const not = ~a; // -11
const left = a << 2; // 40
const right = a >> 1; // 5
```

## Array Type Inference

Tsonic infers numeric array types based on the values in the array literal:

### Integer Arrays

```typescript
// Integer literals infer to int[]
const numbers = [1, 2, 3]; // Emits: int[] numbers = [1, 2, 3];

// Floating-point values infer to double[]
const floats = [1.5, 2.5, 3.5]; // Emits: double[] floats = [1.5, 2.5, 3.5];

// Mixed int and float → double[]
const mixed = [1, 2.5, 3]; // Emits: double[] mixed = [1, 2.5, 3];
```

### Long Arrays (Large Integers)

When an integer literal exceeds the 32-bit int range (-2,147,483,648 to 2,147,483,647), the entire array is inferred as `long[]`:

```typescript
// Large number causes long[] inference
const bigNumbers = [1, 2, 2147483648]; // Emits: long[] bigNumbers = [1L, 2L, 2147483648L];

const timestamps = [1609459200000, 1609545600000]; // Emits: long[] (JS millisecond timestamps)
```

### Inference Rules

| Array Contents                | Inferred Type |
| ----------------------------- | ------------- |
| All integers within int range | `int[]`       |
| Any integer > int max         | `long[]`      |
| Any floating-point value      | `double[]`    |
| Mixed int and float           | `double[]`    |

### Explicit Type Annotations

Override inference with explicit type annotations:

```typescript
import { long, float } from "@tsonic/core/types.js";

// Force long[] even with small values
const smallLongs: long[] = [1, 2, 3];

// Force float[] instead of double[]
const floatArray: float[] = [1.0, 2.0, 3.0];

// Force int[] (error if value exceeds range)
const ints: int[] = [1, 2, 3];
```

### Empty Arrays

Empty array literals require explicit type annotation:

```typescript
// Error: Cannot infer element type
const arr = [];

// Correct
const numbers: int[] = [];
const strings: string[] = [];
```

> **See also:** [TSN7417: Empty Array Literal Requires Type](diagnostics.md#tsn7417-empty-array-literal-requires-type)

## Comparison with JavaScript

| Aspect      | JavaScript | Tsonic (int)        |
| ----------- | ---------- | ------------------- |
| `10 / 3`    | 3.333...   | 3                   |
| `10 / 4`    | 2.5        | 2                   |
| `(-7) / 3`  | -2.333...  | -2                  |
| Array index | Any number | Exact int           |
| Overflow    | Infinity   | Wraps (C# behavior) |

## Generated C# Code

Tsonic generates clean C# without unnecessary casts:

```typescript
import { int } from "@tsonic/core/types.js";

const x: int = 10;
const y: int = 20;
const sum = x + y;
```

Generates:

```csharp
var x = 10;
var y = 20;
var sum = x + y;
```

Not:

```csharp
var x = (int)10.0;
var y = (int)20.0;
var sum = (int)(x + y); // Wrong - unnecessary casts
```

## Troubleshooting

### "Cannot assign number to int"

Use `int`-typed values (or an explicit narrowing) when you need an integer:

```typescript
import { int } from "@tsonic/core/types.js";

// OK: integer literal in int context
const a: int = 10;
const b: int = 5;
const x: int = a + b;

// Error: floating-point literal is not an integer value
const y: int = 10.5;
```

### Array Index Errors

Ensure array indices are integers:

```typescript
import { int } from "@tsonic/core/types.js";

const items: string[] = ["a", "b", "c"];
const idx: int = 1;
const item = items[idx]; // OK
```

### LINQ Type Mismatches

Use integer types for LINQ operations that expect them:

```typescript
import { int } from "@tsonic/core/types.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const nums = new List<int>();
nums.add(1);
nums.add(2);
// Now LINQ operations work correctly
```

## See Also

- [Type System](./type-system.md) - Complete type mapping reference
- [.NET Interop](./dotnet-interop.md) - Working with .NET APIs
- [LINQ Operations](./examples/arrays.md) - Array and LINQ examples
