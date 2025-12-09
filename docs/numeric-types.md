# Numeric Types

Tsonic provides precise control over numeric types through the `@tsonic/types` package. This guide covers when and how to use integer types in your Tsonic programs.

## Overview

By default, TypeScript's `number` type maps to C#'s `double` (64-bit floating point). However, many .NET APIs require integer types. Tsonic provides branded types to emit proper C# integers.

```typescript
// Default: number → double
const x = 42; // C#: double x = 42.0;

// Integer: int → System.Int32
import { int } from "@tsonic/types";
const y = 42 as int; // C#: int y = 42;
```

## Available Integer Types

Import from `@tsonic/types`:

| TypeScript | C# Type | Range | Use Case |
|------------|---------|-------|----------|
| `byte` | `byte` | 0 to 255 | Binary data, small counts |
| `sbyte` | `sbyte` | -128 to 127 | Signed byte values |
| `short` | `short` | -32,768 to 32,767 | Small integers |
| `ushort` | `ushort` | 0 to 65,535 | Unsigned small integers |
| `int` | `int` | -2B to 2B | Most integer operations |
| `uint` | `uint` | 0 to 4B | Unsigned integers |
| `long` | `long` | -9Q to 9Q | Large integers |
| `ulong` | `ulong` | 0 to 18Q | Large unsigned integers |
| `float` | `float` | ±3.4e38 | Single precision floats |

## Basic Usage

### Declaring Integer Variables

Use `as int` to narrow a number to an integer:

```typescript
import { int } from "@tsonic/types";

const count = 10 as int;
const index = 0 as int;
const max = 100 as int;
```

Or use type annotations:

```typescript
import { int } from "@tsonic/types";

const count: int = 10 as int;
```

### Integer Arithmetic

Integer operations produce integer results:

```typescript
import { int } from "@tsonic/types";

const x = 10 as int;
const y = 20 as int;

// All produce int results
const sum = x + y; // 30
const diff = y - x; // 10
const product = x * y; // 200
```

### Integer Division

Integer division truncates toward zero (unlike JavaScript):

```typescript
import { int } from "@tsonic/types";

const a = 10 as int;
const b = 3 as int;
const result = a / b; // 3 (not 3.333...)

const c = 100 as int;
const d = 33 as int;
const quotient = c / d; // 3
```

## When to Use Integer Types

### Required: .NET API Compatibility

Many .NET APIs require integer parameters:

```typescript
import { int } from "@tsonic/types";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const list = new List<string>();
list.add("one");
list.add("two");

// List.get() requires int index
const idx = 0 as int;
const item = list.get(idx);
```

### Required: LINQ Operations

Some LINQ methods require integer return values:

```typescript
import { int } from "@tsonic/types";
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
import { int } from "@tsonic/types";

const items: string[] = ["a", "b", "c", "d"];
const idx = 2 as int;
const item = items[idx]; // "c"

// Arithmetic works naturally
const nextIdx = idx + 1;
const nextItem = items[nextIdx]; // "d"
```

### Recommended: Loop Counters

Use integers for loop counters:

```typescript
import { int } from "@tsonic/types";

const max = 10 as int;
for (let i = 0 as int; (i as int) < max; i = (i + 1) as int) {
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

## Integer Narrowing

### The `as int` Pattern

Use `as int` to convert a number expression to integer:

```typescript
import { int } from "@tsonic/types";

const x = 10 as int;
const y = 3 as int;

// Result needs explicit narrowing for assignment
const result: int = ((x + y) * 2) as int;
```

### Redundant Narrowing is Safe

Multiple `as int` on the same expression produces clean code:

```typescript
import { int } from "@tsonic/types";

const x = 10 as int;
const y = 20 as int;

// Redundant but harmless - no extra casts in output
const sum = (x as int) + (y as int);
const redundant: int = (((x + y) as int) + 5) as int;
```

The compiler optimizes away redundant casts.

### Mixed Arithmetic

When mixing int and number, the result promotes to number:

```typescript
import { int } from "@tsonic/types";

const intVal = 10 as int;
const numVal = 3.5;

const result = intVal + numVal; // double result: 13.5
```

To get an integer result, narrow explicitly:

```typescript
import { int } from "@tsonic/types";

const intVal = 10 as int;
const numVal = 3.5;

const intResult = (intVal + numVal) as int; // int result: 13
```

## Function Signatures

### Integer Parameters

Declare function parameters with integer types:

```typescript
import { int } from "@tsonic/types";

function factorial(n: int): int {
  if (n <= 1) return 1 as int;
  return (n * factorial((n - 1) as int)) as int;
}

const result = factorial(5 as int); // 120
```

### Integer Return Types

Functions can return integer types:

```typescript
import { int } from "@tsonic/types";

function sumRange(start: int, end: int): int {
  let total = 0 as int;
  for (let i = start; (i as int) <= end; i = (i + 1) as int) {
    total = (total + i) as int;
  }
  return total;
}
```

## Common Patterns

### Counter Variables

```typescript
import { int } from "@tsonic/types";

let count = 0 as int;
count = (count + 1) as int;
```

### Array Length Access

```typescript
import { int } from "@tsonic/types";

const items: string[] = ["a", "b", "c"];
const len = items.length as int;
const lastIdx = (len - 1) as int;
const lastItem = items[lastIdx];
```

### Modulo Operations

```typescript
import { int } from "@tsonic/types";

const value = 17 as int;
const divisor = 5 as int;
const remainder = value % divisor; // 2
```

### Bitwise Operations

Integer types support all bitwise operations:

```typescript
import { int } from "@tsonic/types";

const a = 0b1010 as int; // 10
const b = 0b1100 as int; // 12

const and = a & b; // 8 (0b1000)
const or = a | b; // 14 (0b1110)
const xor = a ^ b; // 6 (0b0110)
const not = ~a; // -11
const left = a << 2; // 40
const right = a >> 1; // 5
```

## Comparison with JavaScript

| Aspect | JavaScript | Tsonic (int) |
|--------|------------|--------------|
| `10 / 3` | 3.333... | 3 |
| `10 / 4` | 2.5 | 2 |
| `(-7) / 3` | -2.333... | -2 |
| Array index | Any number | Exact int |
| Overflow | Infinity | Wraps (C# behavior) |

## Generated C# Code

Tsonic generates clean C# without unnecessary casts:

```typescript
import { int } from "@tsonic/types";

const x = 10 as int;
const y = 20 as int;
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

You need to narrow the expression:

```typescript
// Error
const x: int = 10 + 5;

// Fix
import { int } from "@tsonic/types";
const x: int = (10 + 5) as int;
```

### Array Index Errors

Ensure array indices are integers:

```typescript
import { int } from "@tsonic/types";

const items: string[] = ["a", "b", "c"];
const idx = 1 as int;
const item = items[idx]; // OK
```

### LINQ Type Mismatches

Use integer types for LINQ operations that expect them:

```typescript
import { int } from "@tsonic/types";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const nums = new List<int>();
nums.add(1 as int);
nums.add(2 as int);
// Now LINQ operations work correctly
```

## See Also

- [Type System](./type-system.md) - Complete type mapping reference
- [.NET Interop](./dotnet-interop.md) - Working with .NET APIs
- [LINQ Operations](./examples/arrays.md) - Array and LINQ examples
