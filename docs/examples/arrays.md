# Array Examples

Working with arrays in Tsonic.

## Creating Arrays

```typescript
// Array literal - infers type from elements
const numbers = [1, 2, 3, 4, 5]; // int[]
const floats = [1.5, 2.5, 3.5]; // double[]

// Generic syntax (also emits as native array)
const strings: Array<string> = ["a", "b", "c"]; // string[]

// Empty array requires type annotation
const empty: number[] = [];

// Explicit element type
import { int } from "@tsonic/core/types.js";
const counts: int[] = [1, 2, 3];
```

## Native Array Operations

Arrays emit as C# native arrays (`T[]`):

```typescript
const items = ["a", "b", "c"];

// Length property
const len = items.length;

// Index access
const first = items[0];
const last = items[items.length - 1];
```

## Using List for Dynamic Collections

For dynamic collections with add/remove operations, use `List<T>`:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic";
import { Console } from "@tsonic/dotnet/System";

// Create list with collection initializer
const numbers = new List<number>([1, 2, 3]);

// Or create empty and add items
const names = new List<string>();
names.Add("Alice");
names.Add("Bob");

// List properties and methods
Console.WriteLine(names.Count); // 2
const hasAlice = names.Contains("Alice"); // true

// Remove items
names.Remove("Alice");

// Clear all
names.Clear();
```

### Collection Initializer Syntax

Use `new List<T>([...])` to initialize with values:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic";

// Initialize with array literal
const numbers = new List<number>([1, 2, 3, 4, 5]);

// Initialize with variables
const items = ["a", "b", "c"];
const list = new List<string>(items);

// Empty list (no initializer needed)
const empty = new List<string>();
```

## LINQ Operations

Use LINQ for functional-style array processing:

```typescript
import { Enumerable } from "@tsonic/dotnet/System.Linq";

const numbers = [1, 2, 3, 4, 5];

// Select = map
const doubled = Enumerable.Select(numbers, (n: number): number => n * 2);

// Where = filter
const evens = Enumerable.Where(numbers, (n: number): boolean => n % 2 === 0);

// Aggregate = reduce
const sum = Enumerable.Aggregate(
  numbers,
  0,
  (acc: number, n: number): number => acc + n
);

// First, Last
const first = Enumerable.First(numbers);
const last = Enumerable.Last(numbers);

// Any, All
const anyEven = Enumerable.Any(numbers, (n: number): boolean => n % 2 === 0);
const allPositive = Enumerable.All(numbers, (n: number): boolean => n > 0);
```

## Iterating Arrays

```typescript
import { Console } from "@tsonic/dotnet/System";

const items = ["a", "b", "c"];

// For-of loop (preferred)
for (const item of items) {
  Console.WriteLine(item);
}

// Index-based for loop
for (let i = 0; i < items.length; i++) {
  Console.WriteLine(items[i]);
}
```

## Array Destructuring

```typescript
const numbers = [1, 2, 3, 4, 5];

// Extract first elements
const [first, second] = numbers;
// first = 1, second = 2

// Skip elements
const [, , third] = numbers;
// third = 3

// Rest pattern
const [head, ...tail] = numbers;
// head = 1, tail = [2, 3, 4, 5]
```

## Multi-dimensional Arrays

```typescript
import { Console } from "@tsonic/dotnet/System";

const matrix: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

// Access element
const value = matrix[1][2]; // 6

// Iterate
for (const row of matrix) {
  for (const cell of row) {
    Console.WriteLine(cell.toString());
  }
}
```

## Type-safe Arrays

```typescript
import { Enumerable } from "@tsonic/dotnet/System.Linq";

interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

// Find user by id
const found = Enumerable.FirstOrDefault(
  users,
  (u: User): boolean => u.id === 1
);

// Map to names
const names = Enumerable.Select(users, (u: User): string => u.name);
```

## Spread Operator

```typescript
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];

// Concatenate
const combined = [...arr1, ...arr2];
// [1, 2, 3, 4, 5, 6]

// Copy
const copy = [...arr1];
```

## Integer Arrays

Use `int` from `@tsonic/core` for integer arrays:

```typescript
import { int } from "@tsonic/core/types.js";

// Integer array
const counts: int[] = [1, 2, 3];

// Array indexing with integers
const items = ["a", "b", "c"];
const index: int = 1;
const item = items[index]; // "b"

// LINQ operations require int for indexing
import { Enumerable } from "@tsonic/dotnet/System.Linq";

const numbers: int[] = [10, 20, 30];
const first = Enumerable.ElementAt(numbers, 0);
```

### Long Arrays

Large integers automatically infer to `long[]`:

```typescript
// Large numbers cause long[] inference
const bigNumbers = [1, 2, 2147483648];
// Emits: long[] bigNumbers = [1L, 2L, 2147483648L];

const timestamps = [1609459200000, 1609545600000];
// Emits: long[] (JS millisecond timestamps)
```

> **See also:** [Numeric Types Guide](../numeric-types.md) for complete integer type coverage.

## Tuples

Tuples are fixed-length arrays with specific element types:

```typescript
// Tuple - fixed length, specific types per position
const point: [number, number] = [10, 20];
const record: [string, number] = ["Alice", 30];

// Access by index
const x = point[0]; // number
const y = point[1]; // number

// Destructuring
const [name, age] = record;

// Unlike arrays, tuples have fixed length
// point[2] = 30; // Error - tuple only has 2 elements
```

Tuples generate `ValueTuple<T1, T2, ...>` in C#.
