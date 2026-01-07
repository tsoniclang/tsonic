# Callbacks

Tsonic maps TypeScript function types to .NET delegate types. This guide covers how to use callbacks with `Action<T>` and `Func<T, TResult>`.

## Overview

TypeScript arrow function types map to .NET delegates:

| TypeScript          | C# Type         | Description                |
| ------------------- | --------------- | -------------------------- |
| `(x: T) => void`    | `Action<T>`     | Callback with no return    |
| `(x: T) => R`       | `Func<T, R>`    | Callback with return value |
| `(x: T) => boolean` | `Func<T, bool>` | Predicate callback         |

## Action Callbacks

Use `Action<T>` for callbacks that don't return a value.

### Single Parameter

```typescript
	import { Console } from "@tsonic/dotnet/System.js";
	import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import { int } from "@tsonic/core/types.js";

function forEach(items: List<int>, callback: (item: int) => void): void {
  const len = items.count;
  for (let i: int = 0; i < len; i++) {
    callback(items[i]);
  }
}

export function main(): void {
  const numbers = new List<int>();
  numbers.add(1);
  numbers.add(2);
  numbers.add(3);

  forEach(numbers, (n: int) => {
    Console.writeLine(`Item: ${n}`);
  });
}
```

Generated C#:

```csharp
public static void forEach(List<int> items, Action<int> callback)
{
    var len = items.Count;
    for (var i = 0; i < len; i++)
    {
        callback(items[i]);
    }
}
```

### Multiple Parameters

```typescript
import { int } from "@tsonic/core/types.js";

function forEachWithIndex(
  items: List<int>,
  callback: (item: int, index: int) => void
): void {
  const len = items.count;
  for (let i: int = 0; i < len; i++) {
    callback(items[i], i);
  }
}

// Usage
forEachWithIndex(numbers, (item: int, index: int) => {
  Console.writeLine(`[${index}] = ${item}`);
});
```

Generated C#:

```csharp
public static void forEachWithIndex(List<int> items, Action<int, int> callback)
```

## Func Callbacks

Use `Func<T, TResult>` for callbacks that return a value.

### Transform Functions

```typescript
import { int } from "@tsonic/core/types.js";

function map(items: List<int>, transform: (item: int) => int): List<int> {
  const result = new List<int>();
  const len = items.count;
  for (let i: int = 0; i < len; i++) {
    result.add(transform(items[i]));
  }
  return result;
}

// Usage
const doubled = map(numbers, (n: int) => n * 2);
```

Generated C#:

```csharp
public static List<int> map(List<int> items, Func<int, int> transform)
```

### Predicate Functions

```typescript
import { int } from "@tsonic/core/types.js";

function filter(
  items: List<int>,
  predicate: (item: int) => boolean
): List<int> {
  const result = new List<int>();
  const len = items.count;
  for (let i: int = 0; i < len; i++) {
    const item = items[i];
    if (predicate(item)) {
      result.add(item);
    }
  }
  return result;
}

// Usage
const evens = filter(numbers, (n: int) => n % 2 === 0);
```

Generated C#:

```csharp
public static List<int> filter(List<int> items, Func<int, bool> predicate)
```

### Reducer Functions

```typescript
import { int } from "@tsonic/core/types.js";

function reduce(
  items: List<int>,
  reducer: (acc: int, item: int) => int,
  initial: int
): int {
  let result = initial;
  const len = items.count;
  for (let i: int = 0; i < len; i++) {
    result = reducer(result, items[i]);
  }
  return result;
}

// Usage
const sum = reduce(numbers, (acc: int, n: int) => acc + n, 0);
```

Generated C#:

```csharp
public static int reduce(List<int> items, Func<int, int, int> reducer, int initial)
```

## Type Mappings

### Action Variants

| TypeScript                   | C#                |
| ---------------------------- | ----------------- |
| `() => void`                 | `Action`          |
| `(a: A) => void`             | `Action<A>`       |
| `(a: A, b: B) => void`       | `Action<A, B>`    |
| `(a: A, b: B, c: C) => void` | `Action<A, B, C>` |

### Func Variants

| TypeScript                | C#                 |
| ------------------------- | ------------------ |
| `() => R`                 | `Func<R>`          |
| `(a: A) => R`             | `Func<A, R>`       |
| `(a: A, b: B) => R`       | `Func<A, B, R>`    |
| `(a: A, b: B, c: C) => R` | `Func<A, B, C, R>` |

## Inline Lambdas

Pass arrow functions directly:

```typescript
	import { Console } from "@tsonic/dotnet/System.js";
	import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import { int } from "@tsonic/core/types.js";

const numbers = new List<int>();
numbers.add(1);
numbers.add(2);
numbers.add(3);

// Inline Action
numbers.forEach((n: int) => {
  Console.writeLine(`${n}`);
});

// Inline Func with return
const doubled = map(numbers, (n: int) => n * 2);
```

## Higher-Order Functions

### Returning Functions

```typescript
import { int } from "@tsonic/core/types.js";

function createMultiplier(factor: int): (n: int) => int {
  return (n: int) => n * factor;
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

Console.writeLine(`${double(5)}`); // 10
Console.writeLine(`${triple(5)}`); // 15
```

### Function Composition

```typescript
import { int } from "@tsonic/core/types.js";

function compose(f: (x: int) => int, g: (x: int) => int): (x: int) => int {
  return (x: int) => f(g(x));
}

const addOne = (x: int) => x + 1;
const double = (x: int) => x * 2;

const addThenDouble = compose(double, addOne);
Console.writeLine(`${addThenDouble(5)}`); // 12
```

## Async Callbacks

For async callbacks, use `Promise` return types:

```typescript
	import { Console } from "@tsonic/dotnet/System.js";

async function processAsync(callback: () => Promise<string>): Promise<void> {
  const result = await callback();
  Console.writeLine(result);
}

await processAsync(async () => {
  return "Async result";
});
```

Generated C#:

```csharp
public static async Task processAsync(Func<Task<string>> callback)
{
    var result = await callback();
    Console.WriteLine(result);
}
```

## Common Patterns

### Event Handlers

```typescript
type EventHandler = (sender: object, args: EventArgs) => void;

function addClickHandler(handler: EventHandler): void {
  // ...
}

addClickHandler((sender: object, args: EventArgs) => {
  Console.writeLine("Clicked!");
});
```

### Comparison Functions

```typescript
import { int } from "@tsonic/core/types.js";

function sort(items: List<int>, compare: (a: int, b: int) => int): void {
  // Use compare function for sorting
}

// Usage with comparison
sort(numbers, (a: int, b: int) => a - b);
```

### Factory Functions

```typescript
function createItem<T>(factory: () => T): T {
  return factory();
}

const user = createItem(() => ({
  name: "Alice",
  age: 30,
}));
```

## Using with LINQ

Callbacks work seamlessly with LINQ:

```typescript
import { int } from "@tsonic/core/types.js";
	import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
	import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

const numbers = new List<int>();
numbers.add(1);
numbers.add(2);
numbers.add(3);
numbers.add(4);
numbers.add(5);

// LINQ Where with predicate
const evens = Enumerable.where(numbers, (n: int) => n % 2 === 0);

// LINQ Select with transform
const doubled = Enumerable.select(numbers, (n: int) => n * 2);

// LINQ Aggregate with reducer
const sum = Enumerable.aggregate(
  numbers,
  0,
  (acc: int, n: int) => acc + n
);
```

## Tips

### Type Annotations in Lambdas

Always include type annotations in lambda parameters for clarity:

```typescript
// Good - explicit types
forEach(items, (item: int) => { ... });

// Avoid - implicit types may cause issues
forEach(items, item => { ... });
```

### Returning from Lambdas

For single-expression returns, use concise syntax:

```typescript
// Concise return
const doubled = map(numbers, (n: int) => n * 2);

// Block return
const processed = map(numbers, (n: int) => {
  const result = n * 2;
  return result;
});
```

## See Also

- [Type System](./type-system.md) - Function type mappings
- [.NET Interop](./dotnet-interop.md) - Working with .NET APIs
- [Async Patterns](./async-patterns.md) - Async callbacks
