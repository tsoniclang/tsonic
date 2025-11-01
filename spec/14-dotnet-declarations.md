# .NET Type Declarations

## Overview

Tsonic provides TypeScript type declarations for C# primitive types and core .NET types, organized per namespace (e.g., `System.d.ts`, `System.IO.d.ts`, `System.Collections.Generic.d.ts`). This allows TypeScript code to use specific C# numeric types for precision and interoperability.

## File Organization

Declaration files are organized by .NET namespace for maintainability and scalability:

```
packages/runtime/lib/
├── System.d.ts                      # Core types (String, Int32, Convert, etc.)
├── System.IO.d.ts                   # File I/O (File, Directory, Path, etc.)
├── System.Collections.Generic.d.ts  # List<T>, Dictionary<K,V>, HashSet<T>
├── System.Text.Json.d.ts           # JsonSerializer, JsonDocument
├── System.Net.Http.d.ts            # HttpClient, HttpRequestMessage
├── System.Threading.Tasks.d.ts     # Task, Task<T>, TaskCompletionSource
└── ... (additional namespaces as needed)
```

**Benefits:**
- Each file is focused and manageable
- Easy to find types by namespace
- Scales to any number of .NET namespaces
- Matches C# organization
- Can be auto-generated from .NET metadata

## Generation Tool

The `.d.ts` files in `packages/runtime/lib/` are generated using the **`generatedts`** tool, a C# application that uses reflection to analyze .NET assemblies and produce TypeScript declarations.

**Repository:** `../generatedts` (sibling directory)

**Usage:**
```bash
# Generate declarations for a .NET assembly
cd ../generatedts
dotnet run --project Src -- /path/to/System.Text.Json.dll --out-dir ../tsonic/packages/runtime/lib/

# Generate for multiple assemblies
dotnet run --project Src -- System.IO.dll --out-dir ../tsonic/packages/runtime/lib/
dotnet run --project Src -- System.Collections.Generic.dll --out-dir ../tsonic/packages/runtime/lib/
```

**Features:**
- Automatically generates branded types for C# numerics (`int`, `decimal`, etc.)
- Maps C# types to TypeScript equivalents (`Task<T>` → `Promise<T>`)
- Filters out private/internal members
- Supports namespace filtering and custom configuration
- Generates proper TypeScript namespace declarations

**See:** `../generatedts/README.md` for detailed usage and configuration options.

## Auto-Inclusion

These declaration files are **automatically included** by the Tsonic compiler. No user configuration needed.

**Implementation (packages/frontend/src/program.ts):**
```typescript
import fs from "node:fs";
import path from "node:path";

export const createTsonicProgram = (files: string[], options: CompilerOptions) => {
  // Auto-include all .NET declaration files
  const libDir = path.join(import.meta.dirname, "../runtime/lib");
  const dotnetDeclarations = fs.readdirSync(libDir)
    .filter(f => f.endsWith(".d.ts"))
    .map(f => path.join(libDir, f));

  return ts.createProgram({
    rootNames: [...files, ...dotnetDeclarations],
    options: {
      ...options,
      types: [], // Don't auto-include @types/*
    }
  });
};
```

**Requirements:**
- Node.js 22+ (uses `import.meta.dirname`)
- ESM-only project

## Purpose

TypeScript has limited numeric types (just `number`), but C# has many specialized numeric types with different ranges and precision. These declaration files expose C# types so TypeScript developers can:

1. **Use precise numeric types** for specific use cases
2. **Interop correctly** with .NET libraries expecting specific types
3. **Control memory usage** with smaller types (byte, short)
4. **Prevent overflow** with appropriate type selection

## C# Numeric Type Declarations

These branded type definitions are in `System.d.ts`:

```typescript
// System.d.ts

/**
 * 32-bit signed integer (-2,147,483,648 to 2,147,483,647)
 * Maps to C# int / System.Int32
 */
type int = number & { __brand: "int" };

/**
 * 32-bit unsigned integer (0 to 4,294,967,295)
 * Maps to C# uint / System.UInt32
 */
type uint = number & { __brand: "uint" };

/**
 * 8-bit unsigned integer (0 to 255)
 * Maps to C# byte / System.Byte
 */
type byte = number & { __brand: "byte" };

/**
 * 8-bit signed integer (-128 to 127)
 * Maps to C# sbyte / System.SByte
 */
type sbyte = number & { __brand: "sbyte" };

/**
 * 16-bit signed integer (-32,768 to 32,767)
 * Maps to C# short / System.Int16
 */
type short = number & { __brand: "short" };

/**
 * 16-bit unsigned integer (0 to 65,535)
 * Maps to C# ushort / System.UInt16
 */
type ushort = number & { __brand: "ushort" };

/**
 * 64-bit signed integer (-9,223,372,036,854,775,808 to 9,223,372,036,854,775,807)
 * Maps to C# long / System.Int64
 */
type long = number & { __brand: "long" };

/**
 * 64-bit unsigned integer (0 to 18,446,744,073,709,551,615)
 * Maps to C# ulong / System.UInt64
 */
type ulong = number & { __brand: "ulong" };

/**
 * Single-precision floating point (±1.5 x 10^-45 to ±3.4 x 10^38)
 * Maps to C# float / System.Single
 */
type float = number & { __brand: "float" };

/**
 * Double-precision floating point (±5.0 × 10^-324 to ±1.7 × 10^308)
 * Maps to C# double / System.Double
 * This is the default numeric type in TypeScript
 */
type double = number & { __brand: "double" };

/**
 * High-precision decimal (±1.0 x 10^-28 to ±7.9228 x 10^28)
 * Maps to C# decimal / System.Decimal
 * Ideal for financial calculations
 */
type decimal = number & { __brand: "decimal" };
```

## Type Branding

These types use **type branding** (phantom types) to prevent accidental mixing. Because of branding, you must use `as` type assertions:

```typescript
const a = 42 as int; // ✅ OK: explicit cast
const b = 255 as byte; // ✅ OK: explicit cast
const c = b as int; // ❌ Still error: byte not convertible to int (different brands)

function processInt(x: int): void {
  /* ... */
}
processInt(42 as int); // ✅ OK: explicit cast
processInt(b); // ❌ Error: byte not assignable to int
```

This is TypeScript-only safety. At runtime (in C#), implicit conversions follow C# rules. The branding prevents you from accidentally using the wrong numeric type in TypeScript.

## Usage in TypeScript

### Basic Usage

```typescript
const count = 42 as int;
const percentage = 0.15 as float;
const price = 19.99 as decimal;
const flags = 0xff as byte;
```

### With Functions

```typescript
function calculateTotal(price: decimal, quantity: int): decimal {
  return price * quantity;
}

function readByte(offset: int): byte {
  // Implementation
  return 0;
}
```

### With Classes

```typescript
export class Product {
  id: int;
  name: string;
  price: decimal;
  quantity: int;

  constructor(id: int, name: string, price: decimal, quantity: int) {
    this.id = id;
    this.name = name;
    this.price = price;
    this.quantity = quantity;
  }

  getTotal(): decimal {
    return this.price * this.quantity;
  }
}
```

### With .NET Interop

```typescript
import { File } from "System.IO";
import { Convert } from "System";

function readFileSize(path: string): long {
  const fileInfo = new FileInfo(path);
  return fileInfo.Length; // Length is long in .NET
}

function parseHexByte(hex: string): byte {
  return Convert.ToByte(hex, 16);
}
```

## Generated C# Code

TypeScript types map directly to C# types:

### TypeScript

```typescript
const count = 42 as int;
const percentage = 0.15 as float;
const price = 19.99 as decimal;
const flags = 0xff as byte;

function calculateTotal(price: decimal, quantity: int): decimal {
  return price * quantity;
}
```

### Generated C#

```csharp
using System;

int count = 42;
float percentage = 0.15f;
decimal price = 19.99m;
byte flags = 0xff;

public static decimal calculateTotal(decimal price, int quantity)
{
    return price * quantity;
}
```

## Type Inference and Literals

TypeScript number literals are inferred as `number` (maps to `double`) by default. To use specific C# numeric types, use type assertions with `as`:

```typescript
const x = 42; // Type: number → double (default)
const y = 42 as int; // Type: int (explicit cast)
const z = 19.99 as decimal; // Type: decimal (explicit cast)

// Type annotations alone DON'T work due to branded types:
const bad: int = 42; // ❌ TypeScript error: number not assignable to int
```

**Generated C#:**

```csharp
var x = 42.0;       // double (default)
int y = 42;         // int
decimal z = 19.99m; // decimal
```

**Why `as int` is required:**

The branded type definitions prevent accidental mixing:

```typescript
type int = number & { __brand: "int" };
```

This makes `int` and `number` incompatible in TypeScript's type system, so literals inferred as `number` cannot be assigned to `int` without explicit casting.

## Special Cases

### Financial Calculations

Always use `decimal` for money to avoid floating-point precision errors:

```typescript
function calculateTax(amount: decimal, rate: decimal): decimal {
  return amount * rate;
}

const subtotal = 100.0 as decimal;
const taxRate = 0.0875 as decimal;
const tax = calculateTax(subtotal, taxRate);
console.log(tax); // Exact: 8.75
```

### Bit Manipulation

Use unsigned types for bit flags:

```typescript
const READ = 0b0001 as byte;
const WRITE = 0b0010 as byte;
const EXECUTE = 0b0100 as byte;

function hasPermission(flags: byte, permission: byte): boolean {
  return (flags & permission) === permission;
}

const userFlags = (READ | WRITE) as byte; // 0b0011
console.log(hasPermission(userFlags, READ)); // true
console.log(hasPermission(userFlags, EXECUTE)); // false
```

### Loop Counters

Use `int` for loop counters when iterating known ranges:

```typescript
function processItems(items: string[]): void {
  for (let i = 0 as int; i < items.length; i++) {
    console.log(items[i]);
  }
}
```

**Generated C#:**

```csharp
public static void processItems(Tsonic.Runtime.Array<string> items)
{
    for (int i = 0; i < items.length; i++)
    {
        Tsonic.Runtime.console.log(items[i]);
    }
}
```

## Type Conversion

Explicit conversions may be needed when mixing types:

```typescript
const a = 42 as int;
const b = a as long; // ✅ Explicit cast needed in TypeScript

// Even though C# allows implicit conversion, TypeScript's branded types require explicit casting
```

**Generated C#:**

```csharp
int a = 42;
long b = a; // ✅ OK: implicit conversion in C#
```

TypeScript enforces stricter type safety than C#. The type assertions guide the compiler but don't affect runtime behavior.

## Limitations

### No Operator Overloading

TypeScript arithmetic operators work, but overflow behavior follows C# rules:

```typescript
const x = 255 as byte;
const y = (x + 1) as byte; // Overflows to 0 in C# (unchecked context)
```

### No Checked Arithmetic

TypeScript has no `checked` keyword. All arithmetic is unchecked in generated C#:

```csharp
// Generated C# (always unchecked)
int x = int.MaxValue;
int y = x + 1; // Overflows to int.MinValue
```

To use checked arithmetic, call .NET methods explicitly:

```typescript
import { Math } from "System";

const result = Math.Add(x, y); // Throws on overflow (if such method exists)
```

## Complete Example

### TypeScript

```typescript
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

interface Product {
  id: int;
  name: string;
  price: decimal;
  quantity: int;
  categoryId: byte;
}

export class ProductService {
  private products: Product[];

  constructor() {
    this.products = [];
  }

  addProduct(
    id: int,
    name: string,
    price: decimal,
    quantity: int,
    categoryId: byte
  ): void {
    const product: Product = { id, name, price, quantity, categoryId };
    this.products.push(product);
  }

  getTotalValue(): decimal {
    let total: decimal = 0;
    for (const product of this.products) {
      total += product.price * product.quantity;
    }
    return total;
  }

  saveToFile(path: string): void {
    const json = JsonSerializer.Serialize(this.products);
    File.WriteAllText(path, json);
  }
}
```

### Generated C#

```csharp
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using Tsonic.Runtime;

public class Product
{
    public int id { get; set; }
    public string name { get; set; }
    public decimal price { get; set; }
    public int quantity { get; set; }
    public byte categoryId { get; set; }
}

public class ProductService
{
    private Tsonic.Runtime.Array<Product> products { get; set; }

    public ProductService()
    {
        this.products = new Tsonic.Runtime.Array<Product>();
    }

    public void addProduct(
        int id,
        string name,
        decimal price,
        int quantity,
        byte categoryId)
    {
        Product product = new Product
        {
            id = id,
            name = name,
            price = price,
            quantity = quantity,
            categoryId = categoryId
        };
        this.products.push(product); // Instance method
    }

    public decimal getTotalValue()
    {
        decimal total = 0;
        foreach (var product in this.products)
        {
            total += product.price * product.quantity;
        }
        return total;
    }

    public void saveToFile(string path)
    {
        string json = JsonSerializer.Serialize(this.products);
        File.WriteAllText(path, json);
    }
}
```

## Best Practices

1. **Use `decimal` for money**: Always use decimal for financial calculations
2. **Use `int` for counters**: Default choice for loop counters and counts
3. **Use `byte`/`ushort` for flags**: Smaller types for bit flags and enums
4. **Use `long` for timestamps**: Unix timestamps and large counts
5. **Use `float` sparingly**: Only when interop requires it or memory is critical
6. **Default to `number`**: If unsure, use `number` (maps to `double`)
7. **Be explicit in APIs**: Always specify types in function signatures

## Related Specifications

- [Type Mappings](./04-type-mappings.md) - Complete type mapping rules
- [.NET Interop](./08-dotnet-interop.md) - Using .NET libraries
- [Code Generation](./06-code-generation.md) - How types are generated to C#
