# Array Examples

Working with arrays in Tsonic.

## Creating Arrays

```typescript
// Array literal
const numbers: number[] = [1, 2, 3, 4, 5];

// Generic syntax
const strings: Array<string> = ["a", "b", "c"];

// Empty array with type
const empty: number[] = [];
```

## Array Operations (JS Mode)

When using `runtime: "js"`, JavaScript array methods are available:

```typescript
const numbers = [1, 2, 3, 4, 5];

// map - transform each element (types inferred from context)
const doubled = numbers.map((n) => n * 2);
// [2, 4, 6, 8, 10]

// filter - keep matching elements (types inferred)
const evens = numbers.filter((n) => n % 2 === 0);
// [2, 4]

// reduce - accumulate to single value (types inferred)
const sum = numbers.reduce((acc, n) => acc + n, 0);
// 15

// forEach - iterate without return (types inferred)
numbers.forEach((n) => {
  console.log(n);
});
```

Lambda parameter types are contextually inferred from the array element type.

## Mutating Methods (JS Mode)

```typescript
const arr = [1, 2, 3];

// push - add to end
arr.push(4);
// [1, 2, 3, 4]

// pop - remove from end
const last = arr.pop();
// last = 4, arr = [1, 2, 3]

// shift - remove from beginning
const first = arr.shift();
// first = 1, arr = [2, 3]

// unshift - add to beginning
arr.unshift(0);
// [0, 2, 3]
```

## Array Operations (dotnet Mode)

When using `runtime: "dotnet"`, arrays use .NET methods:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const numbers = new List<number>();
numbers.Add(1);
numbers.Add(2);
numbers.Add(3);

// Count instead of length
console.log(numbers.Count);

// Contains check
const hasTwo = numbers.Contains(2);

// Remove item
numbers.Remove(2);

// Clear all
numbers.Clear();
```

## LINQ Operations (dotnet Mode)

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
const items = ["a", "b", "c"];

// For-of loop (preferred)
for (const item of items) {
  console.log(item);
}

// Index-based for loop
for (let i = 0; i < items.length; i++) {
  console.log(items[i]);
}

// forEach method (JS mode)
items.forEach((item: string): void => {
  console.log(item);
});
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
    console.log(cell);
  }
}
```

## Type-safe Arrays

```typescript
interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

// Find user by id (JS mode)
const found = users.find((u: User): boolean => u.id === 1);

// Map to names
const names = users.map((u: User): string => u.name);
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

// Insert element
const withNew = [...arr1.slice(0, 1), 99, ...arr1.slice(1)];
// [1, 99, 2, 3]
```

## Tuples

Tuples are fixed-length arrays with specific element types (different from regular arrays):

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

Tuples generate `ValueTuple<T1, T2, ...>` in C#, while arrays generate `Array<T>` or `List<T>`.
