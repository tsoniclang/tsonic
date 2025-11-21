# Extension Methods

## Overview

C# extension methods are static methods that appear to extend a type without modifying it. TypeScript doesn't have an equivalent feature, so tsbindgen and Tsonic handle them as **static methods with a clear naming convention**.

**C# Extension Method:**
```csharp
// C# - LINQ extension methods
public static class Enumerable
{
    public static IEnumerable<TResult> SelectMany<TSource, TResult>(
        this IEnumerable<TSource> source,
        Func<TSource, IEnumerable<TResult>> selector)
    {
        // Implementation
    }
}

// Usage in C#
var numbers = new List<int> { 1, 2, 3 };
var doubled = numbers.SelectMany(x => new[] { x, x });  // Extension method syntax
```

**TypeScript/Tsonic Equivalent:**
```typescript
// TypeScript - Static method
export class Enumerable {
    static SelectMany<TSource, TResult>(
        source: IEnumerable<TSource>,
        selector: (x: TSource) => IEnumerable<TResult>
    ): IEnumerable<TResult>;
}

// Usage in TypeScript
import { Enumerable, List } from "System.Collections.Generic";

const numbers = new List<number>();
numbers.Add(1);
numbers.Add(2);
numbers.Add(3);

const doubled = Enumerable.SelectMany(
    numbers.As_IEnumerable,
    x => [x, x]
);  // Static method call
```

---

## Key Differences from C#

| Aspect | C# | TypeScript/Tsonic |
|--------|----|--------------------|
| **Syntax** | `list.SelectMany(...)` | `Enumerable.SelectMany(list, ...)` |
| **First Parameter** | Implicit (`this`) | Explicit (first argument) |
| **Import** | `using System.Linq;` | `import { Enumerable } from "System.Linq";` |
| **Method Resolution** | Compiler resolves to static method | Already static method call |

**Key Insight:** In C#, extension method syntax `list.SelectMany(...)` is **syntactic sugar** that the compiler transforms into `Enumerable.SelectMany(list, ...)`. In TypeScript/Tsonic, we **skip the sugar** and use the static method directly.

---

## How tsbindgen Emits Extension Methods

### 1. Detection

tsbindgen detects extension methods via reflection:

```csharp
// C# reflection
if (method.IsStatic &&
    method.IsDefined(typeof(System.Runtime.CompilerServices.ExtensionAttribute)))
{
    // This is an extension method
    var extendedType = method.GetParameters()[0].ParameterType;
    // First parameter is the "this" parameter
}
```

### 2. TypeScript Emission

**Original C# signature:**
```csharp
public static IEnumerable<TResult> SelectMany<TSource, TResult>(
    this IEnumerable<TSource> source,  // ← Extension parameter
    Func<TSource, IEnumerable<TResult>> selector)
```

**Emitted TypeScript:**
```typescript
static SelectMany<TSource, TResult>(
    source: IEnumerable_1<TSource>,  // ← Regular parameter (no "this")
    selector: (arg0: TSource) => IEnumerable_1<TResult>
): IEnumerable_1<TResult>;
```

**Key Changes:**
- `this` keyword removed (TypeScript doesn't support it on static methods)
- Extension parameter becomes first regular parameter
- Method remains static

### 3. Metadata

Extension methods are marked in metadata.json:

```json
{
  "clrName": "SelectMany",
  "tsEmitName": "SelectMany",
  "isStatic": true,
  "isExtensionMethod": true,
  "extendedType": "System.Collections.Generic.IEnumerable`1",
  "arity": 2,
  "parameterCount": 2
}
```

**Note:** `isExtensionMethod` field may be present but is optional. Tsonic doesn't need it for code generation since extension methods are just static methods in TypeScript.

---

## Common Extension Method Patterns

### Pattern 1: LINQ on Arrays/Lists

```typescript
import { Enumerable } from "System.Linq";
import { List } from "System.Collections.Generic";

const numbers = new List<number>();
numbers.Add(1);
numbers.Add(2);
numbers.Add(3);

// Where
const evens = Enumerable.Where(
    numbers.As_IEnumerable,
    x => x % 2 === 0
);

// Select
const doubled = Enumerable.Select(
    numbers.As_IEnumerable,
    x => x * 2
);

// SelectMany
const flattened = Enumerable.SelectMany(
    numbers.As_IEnumerable,
    x => [x, x * 10]
);

// Method chaining
const result = Enumerable.Select(
    Enumerable.Where(
        numbers.As_IEnumerable,
        x => x % 2 === 0
    ),
    x => x * 2
);
```

**Generated C#:**
```csharp
using System.Linq;
using System.Collections.Generic;

var numbers = new List<int>();
numbers.Add(1);
numbers.Add(2);
numbers.Add(3);

// Where
var evens = Enumerable.Where(
    (IEnumerable<int>)numbers,
    x => x % 2 == 0
);

// Select
var doubled = Enumerable.Select(
    (IEnumerable<int>)numbers,
    x => x * 2
);

// SelectMany
var flattened = Enumerable.SelectMany(
    (IEnumerable<int>)numbers,
    x => new[] { x, x * 10 }
);

// Method chaining
var result = Enumerable.Select(
    Enumerable.Where(
        (IEnumerable<int>)numbers,
        x => x % 2 == 0
    ),
    x => x * 2
);
```

### Pattern 2: String Extensions

```typescript
// C# has extension methods on string, but TypeScript uses Tsonic.Runtime.String
import { String } from "Tsonic.Runtime";

const text = "hello world";

// Instance method syntax (Tsonic.Runtime helpers)
const upper = text.toUpperCase();

// If .NET has extension methods, use static syntax
// Example: StringExtensions.Reverse(text)
```

### Pattern 3: Custom Extension Methods

```csharp
// C# - User-defined extension methods
namespace MyApp.Extensions
{
    public static class ListExtensions
    {
        public static void AddRange<T>(this List<T> list, params T[] items)
        {
            foreach (var item in items)
                list.Add(item);
        }
    }
}
```

```typescript
// TypeScript - tsbindgen generated
declare namespace MyApp.Extensions {
    export class ListExtensions {
        static AddRange<T>(
            list: List_1<T>,
            ...items: T[]
        ): void;
    }
}

// Usage
import { ListExtensions } from "MyApp.Extensions";
import { List } from "System.Collections.Generic";

const list = new List<string>();
ListExtensions.AddRange(list, "a", "b", "c");
```

---

## Why No Extension Syntax in TypeScript?

TypeScript doesn't support extension methods because:

1. **Structural typing**: TypeScript uses duck typing, making extension methods less necessary
2. **Prototype pollution**: Adding methods to existing types globally is problematic
3. **Module system**: ES6 modules encourage explicit imports over global modifications
4. **Type safety**: Static method calls are more explicit and type-safe

**Design Decision:** Tsonic follows TypeScript conventions rather than trying to emulate C# syntax that doesn't fit the JavaScript ecosystem.

---

## Future: Extension Method Syntax Sugar (Post-MVP)

**Possible future enhancement** (NOT in MVP):

```typescript
// Future syntax (hypothetical)
import { Enumerable } from "System.Linq";

const numbers = [1, 2, 3];

// Compiler transforms extension syntax to static call
const doubled = numbers.SelectMany(x => [x, x]);
// ↓
// Enumerable.SelectMany(numbers, x => [x, x]);
```

**Requirements for this feature:**
1. Tsonic compiler must detect extension method usage from metadata
2. Transform AST to convert method call to static call
3. Import the static class automatically
4. Ensure no conflicts with actual instance methods

**Complexity:** High (requires sophisticated AST transformation)
**Priority:** Low (static syntax works fine)

---

## Implementation Requirements for Tsonic

### 1. No Special Handling Needed

Extension methods are **already static methods** in TypeScript declarations, so Tsonic emits them as normal static calls:

```typescript
// TypeScript
Enumerable.SelectMany(source, selector);
```

```csharp
// C# (generated)
Enumerable.SelectMany(source, selector);
```

### 2. Type Resolution

When resolving `Enumerable.SelectMany`:

```typescript
// Tsonic compiler
const type = resolveType("System.Linq.Enumerable");
const method = type.methods.find(m =>
    m.clrName === "SelectMany" &&
    m.isStatic &&
    m.parameterCount === 2
);

// Emit static call
emitStaticMethodCall(type, method, arguments);
```

### 3. Generic Type Inference

LINQ extension methods are generic. Tsonic must infer type arguments:

```typescript
// TypeScript (type arguments inferred)
const doubled = Enumerable.Select(numbers, x => x * 2);
//                                 ^^^^^^^  ^^^^^^^^
//                                 IEnumerable<number>
//                                          (number) => number
//                                 Infer: TSource=number, TResult=number
```

```csharp
// C# (explicit type arguments)
var doubled = Enumerable.Select<int, int>(numbers, x => x * 2);
```

**Type Inference Algorithm:**
1. Analyze first argument type: `IEnumerable<number>` → `TSource = number`
2. Analyze lambda return type: `(number) => number` → `TResult = number`
3. Emit with explicit type arguments in C#

---

## Common LINQ Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `Where` | `Where<T>(IEnumerable<T>, T => bool)` | Filter elements |
| `Select` | `Select<T, R>(IEnumerable<T>, T => R)` | Transform elements |
| `SelectMany` | `SelectMany<T, R>(IEnumerable<T>, T => IEnumerable<R>)` | Flatten nested sequences |
| `First` | `First<T>(IEnumerable<T>)` | Get first element |
| `FirstOrDefault` | `FirstOrDefault<T>(IEnumerable<T>)` | Get first or default |
| `Any` | `Any<T>(IEnumerable<T>, T => bool)` | Check if any match |
| `All` | `All<T>(IEnumerable<T>, T => bool)` | Check if all match |
| `Count` | `Count<T>(IEnumerable<T>)` | Count elements |
| `OrderBy` | `OrderBy<T, K>(IEnumerable<T>, T => K)` | Sort ascending |
| `GroupBy` | `GroupBy<T, K>(IEnumerable<T>, T => K)` | Group by key |

**Full documentation:** See `System.Linq` namespace declarations.

---

## Diagnostics

### TSN5001: Extension Method Called on Instance

If Tsonic detects attempt to use extension syntax (future):

```
Extension method 'SelectMany' cannot be called as instance method.
Use: Enumerable.SelectMany(list, ...)
```

### TSN5002: Missing IEnumerable Cast

```
LINQ methods require IEnumerable<T>.
Use: list.As_IEnumerable
```

---

## Best Practices

1. **Always use static syntax**: `Enumerable.Where(source, ...)` not `source.Where(...)`
2. **Cast to IEnumerable**: Most LINQ works on `IEnumerable<T>`, use `.As_IEnumerable`
3. **Chain explicitly**: Nest calls or use intermediate variables
4. **Import Enumerable**: Always import from `"System.Linq"`
5. **Type annotations**: Help TypeScript infer complex generic chains

**Good:**
```typescript
import { Enumerable } from "System.Linq";

const filtered = Enumerable.Where(
    list.As_IEnumerable,
    x => x > 10
);

const mapped = Enumerable.Select(
    filtered,
    x => x.toString()
);
```

**Bad:**
```typescript
// Don't try to use C# extension syntax
const filtered = list.Where(x => x > 10);  // ❌ Won't work
```

---

## See Also

- [metadata.md](metadata.md) - Extension method metadata
- [explicit-interface-views.md](explicit-interface-views.md) - Why `.As_IEnumerable` is needed
- [type-mappings.md](type-mappings.md) - IEnumerable<T> type mapping
- [generics.md](generics.md) - Generic type inference for LINQ
