# Array Examples

Working with arrays in Tsonic.

## Creating Arrays

```typescript
export function main() {
  const nums: number[] = [1, 2, 3, 4, 5];
  const names: string[] = ["Alice", "Bob", "Charlie"];
  const empty: number[] = [];

  console.log(nums);
  console.log(names);
}
```

## Array Methods

```typescript
export function main() {
  const nums = [1, 2, 3, 4, 5];

  // Add/remove
  nums.push(6);
  const last = nums.pop();
  nums.unshift(0);
  const first = nums.shift();

  // Transform
  const doubled = nums.map((x) => x * 2);
  const evens = nums.filter((x) => x % 2 === 0);
  const sum = nums.reduce((a, b) => a + b, 0);

  // Access
  const slice = nums.slice(1, 3);
  const index = nums.indexOf(3);
  const has = nums.includes(3);

  console.log("Doubled:", doubled);
  console.log("Evens:", evens);
  console.log("Sum:", sum);
}
```

## Sparse Arrays

```typescript
export function main() {
  const sparse: number[] = [];
  sparse[10] = 42;

  console.log(sparse.length); // 11
  console.log(sparse[5]); // 0 (default value)
  console.log(sparse[10]); // 42
}
```

## Iteration

```typescript
export function main() {
  const fruits = ["apple", "banana", "cherry"];

  // For...of
  for (const fruit of fruits) {
    console.log(fruit);
  }

  // forEach
  fruits.forEach((fruit) => console.log(fruit));

  // Traditional for
  for (let i = 0; i < fruits.length; i++) {
    console.log(fruits[i]);
  }
}
```

## Multi-dimensional

```typescript
export function main() {
  const matrix: number[][] = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  console.log(matrix[0][0]); // 1
  console.log(matrix[1][1]); // 5
  console.log(matrix[2][2]); // 9
}
```

## See Also

- [Type Mappings](../language/type-mappings.md#arrays-listt--static-helpers)
- [Runtime API](../language/runtime.md#array-helpers)
