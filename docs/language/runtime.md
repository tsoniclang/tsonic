# Tsonic.Runtime API

The `Tsonic.Runtime` namespace provides JavaScript semantics for TypeScript code running on .NET.

## Overview

Tsonic.Runtime contains:

- **Global functions** - `parseInt`, `parseFloat`, `isNaN`, etc.
- **Array helpers** - Static methods for JavaScript array behavior on `List<T>`
- **String helpers** - Static methods for JavaScript string behavior
- **Namespace objects** - `Math`, `JSON`, `console`
- **Operators** - `typeof`, `instanceof`

All helpers are **static methods** - no instances or classes to construct.

---

## Global Functions

Available directly from `Tsonic.Runtime`:

```typescript
const num = parseInt("42", 10);
const pi = parseFloat("3.14");
const isInvalid = isNaN(num);
const isOk = isFinite(num);
```

**Functions:**

- `parseInt(str, radix?)` → `double`
- `parseFloat(str)` → `double`
- `isNaN(value)` → `bool`
- `isFinite(value)` → `bool`
- `encodeURI(uri)` → `string`
- `decodeURI(uri)` → `string`
- `encodeURIComponent(component)` → `string`
- `decodeURIComponent(component)` → `string`

---

## Array Helpers

All JavaScript array methods work on native `List<T>` via static helpers:

### Mutation Methods

```typescript
const arr: number[] = [1, 2, 3];

arr.push(4); // Add to end
const last = arr.pop(); // Remove from end
arr.unshift(0); // Add to start
const first = arr.shift(); // Remove from start
arr.reverse(); // Reverse in place
arr.sort((a, b) => a - b); // Sort in place
```

### Access Methods

```typescript
const nums = [1, 2, 3, 4, 5];

const slice = nums.slice(1, 3); // [2, 3]
const index = nums.indexOf(3); // 2
const has = nums.includes(3); // true
const joined = nums.join(", "); // "1, 2, 3, 4, 5"
```

### Higher-Order Methods

```typescript
const nums = [1, 2, 3, 4, 5];

const doubled = nums.map((x) => x * 2); // [2, 4, 6, 8, 10]
const evens = nums.filter((x) => x % 2 === 0); // [2, 4]
const sum = nums.reduce((a, b) => a + b, 0); // 15
nums.forEach((x) => console.log(x)); // Print each
```

### Sparse Array Support

```typescript
const sparse: number[] = [];
sparse[10] = 42; // Fills 0-9 with undefined (0 in C#)
console.log(sparse.length); // 11
console.log(sparse[5]); // 0 (default value)
```

**Complete list:** `push`, `pop`, `shift`, `unshift`, `slice`, `splice`, `concat`, `indexOf`, `lastIndexOf`, `includes`, `join`, `reverse`, `sort`, `map`, `filter`, `reduce`, `reduceRight`, `forEach`, `every`, `some`, `find`, `findIndex`, `fill`, `copyWithin`, `flat`, `flatMap`, and more.

---

## String Helpers

JavaScript string methods on native C# `string`:

### Case Conversion

```typescript
const text = "Hello World";
text.toUpperCase(); // "HELLO WORLD"
text.toLowerCase(); // "hello world"
```

### Trimming

```typescript
const text = "  hello  ";
text.trim(); // "hello"
text.trimStart(); // "hello  "
text.trimEnd(); // "  hello"
```

### Substring Operations

```typescript
const text = "Hello World";
text.substring(0, 5); // "Hello"
text.slice(6); // "World"
text.slice(-5); // "World"
```

### Searching

```typescript
const text = "Hello World";
text.indexOf("World"); // 6
text.lastIndexOf("o"); // 7
text.startsWith("Hello"); // true
text.endsWith("World"); // true
text.includes("lo"); // true
```

### Manipulation

```typescript
const text = "Hello";
text.repeat(3); // "HelloHelloHello"
text.replace("l", "L"); // "HeLlo"
text.padStart(10, "*"); // "*****Hello"
text.padEnd(10, "*"); // "Hello*****"
```

### Character Access

```typescript
const text = "Hello";
text.charAt(1); // "e"
text.charCodeAt(1); // 101
```

### Splitting

```typescript
const text = "a,b,c";
text.split(","); // ["a", "b", "c"] (List<string>)
text.split(",", 2); // ["a", "b"]
```

**Note:** `split()` returns `List<string>`, not a C# string array.

---

## Math

Static class with JavaScript Math functions:

```typescript
Math.PI; // 3.141592653589793
Math.E; // 2.718281828459045

Math.abs(-5); // 5
Math.floor(4.7); // 4
Math.ceil(4.3); // 5
Math.round(4.5); // 5
Math.sqrt(16); // 4
Math.pow(2, 3); // 8

Math.max(1, 5, 3); // 5
Math.min(1, 5, 3); // 1

Math.sin(0); // 0
Math.cos(0); // 1
Math.random(); // Random 0-1
```

---

## JSON

Parse and stringify JSON:

```typescript
// Stringify
const obj = { name: "John", age: 30 };
const json = JSON.stringify(obj);
// '{"name":"John","age":30}'

// Parse
type User = { name: string; age: number };
const user: User = JSON.parse(json);
```

**Methods:**

- `JSON.parse<T>(text)` → `T`
- `JSON.stringify(value)` → `string`

---

## console

Logging functions:

```typescript
console.log("Hello", "World"); // Print to stdout
console.error("Error occurred"); // Print to stderr
console.warn("Warning message"); // Print warning
console.info("Information"); // Print info
```

**Methods:**

- `console.log(...args)`
- `console.error(...args)`
- `console.warn(...args)`
- `console.info(...args)`

---

## Operators

### typeof

```typescript
typeof "hello"; // "string"
typeof 42; // "number"
typeof true; // "boolean"
typeof {}; // "object"
typeof undefined; // "undefined"
typeof null; // "object" (JavaScript quirk)
typeof (() => {}); // "function"
```

Used with type guards:

```typescript
function process(value: unknown) {
  if (typeof value === "string") {
    console.log(value.toUpperCase());
  }
}
```

### instanceof

```typescript
class User {}
const user = new User();

user instanceof User; // true
user instanceof Object; // true
```

---

## Usage Example

Complete program using Tsonic.Runtime:

```typescript
// math-utils.ts
export function processNumbers(input: string): string {
  // Parse input
  const num = parseInt(input, 10);

  // Check validity
  if (isNaN(num)) {
    return "Invalid number";
  }

  // Array operations
  const numbers: number[] = [1, 2, 3, 4, 5];
  numbers.push(num);

  const doubled = numbers.map((x) => x * 2);
  const sum = doubled.reduce((a, b) => a + b, 0);

  // String operations
  const result = `Sum: ${sum}`;
  return result.toUpperCase();
}

export function main() {
  const result = processNumbers("10");
  console.log(result); // "SUM: 42"
}
```

---

## See Also

- [Type Mappings](type-mappings.md) - TypeScript → C# type conversions
- [.NET Interop](dotnet-interop.md) - Using .NET libraries
- [Module System](module-system.md) - Imports and exports
