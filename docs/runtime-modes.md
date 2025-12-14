# Runtime Modes

Tsonic supports two runtime modes that determine how your TypeScript code behaves at runtime.

## Overview

| Mode     | Semantics           | Use Case                     |
| -------- | ------------------- | ---------------------------- |
| `js`     | JavaScript behavior | General TypeScript apps      |
| `dotnet` | C# / .NET behavior  | .NET integration, BCL access |

## JS Mode (Default)

JS mode preserves JavaScript semantics using `Tsonic.JSRuntime`.

### Initialization

```bash
tsonic project init
# or
tsonic project init --runtime js
```

```json
{
  "runtime": "js"
}
```

### Type Packages

```bash
npm install --save-dev @tsonic/globals @tsonic/js-globals @tsonic/core
```

- `@tsonic/globals` - Base types (Array, String, iterators, Promise, etc.)
- `@tsonic/js-globals` - JS-specific methods (.map, .length, console, etc.)
- `@tsonic/core` - Core types (int, float, etc.)

### Behavior

#### Arrays

Arrays behave like JavaScript arrays:

```typescript
const arr: number[] = [];
arr[10] = 42;
console.log(arr.length); // 11 (sparse array)
console.log(arr[5]); // undefined

// Array methods
const doubled = arr.map((n) => (n ?? 0) * 2);
const filtered = arr.filter((n) => n !== undefined);
```

#### Number Handling

All numbers are `double` by default:

```typescript
const x = 42; // double
const y = 3.14; // double
console.log(x / 4); // 10.5 (floating point)
```

Use explicit integer types when needed:

```typescript
import { int } from "@tsonic/core/types.js";

const count: int = 42;
```

#### Console

Standard `console` API:

```typescript
console.log("Hello");
console.error("Error!");
console.warn("Warning");
```

### Generated Code

TypeScript:

```typescript
const numbers = [1, 2, 3];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(sum);
```

Generated C#:

```csharp
var numbers = new Tsonic.Runtime.Array<double>(1, 2, 3);
var sum = numbers.Reduce((a, b) => a + b, 0);
global::System.Console.WriteLine(sum);
```

## Dotnet Mode

Dotnet mode provides direct access to .NET BCL with C# semantics.

### Initialization

```bash
tsonic project init --runtime dotnet
```

```json
{
  "runtime": "dotnet"
}
```

### Type Packages

```bash
npm install --save-dev @tsonic/globals @tsonic/dotnet
```

- `@tsonic/globals` - Base types (Array, String, iterators, Promise, etc.)
- `@tsonic/dotnet` - BCL type declarations

### Behavior

#### Collections

Use .NET collections directly:

```typescript
import { Console } from "@tsonic/dotnet/System";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const list = new List<number>();
list.Add(1);
list.Add(2);
list.Add(3);
Console.WriteLine(list.Count); // 3

// LINQ-style operations
const doubled = list.Select((n) => n * 2);
const filtered = list.Where((n) => n > 1);
```

#### Console

Use .NET Console:

```typescript
import { Console } from "@tsonic/dotnet/System";

Console.WriteLine("Hello!");
Console.Write("No newline");
Console.ReadLine();
```

#### File I/O

```typescript
import { File, Path } from "@tsonic/dotnet/System.IO";

const content = File.ReadAllText("./data.txt");
const lines = File.ReadAllLines("./data.txt");
File.WriteAllText("./output.txt", content);

const fullPath = Path.Combine(".", "data", "file.txt");
```

### Generated Code

TypeScript:

```typescript
import { Console } from "@tsonic/dotnet/System";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

const list = new List<number>();
list.Add(42);
Console.WriteLine(list.Count);
```

Generated C#:

```csharp
var list = new global::System.Collections.Generic.List<int>();
list.Add(42);
global::System.Console.WriteLine(list.Count);
```

## Comparison

### Arrays vs Lists

| Feature        | JS Mode (Array) | Dotnet Mode (List) |
| -------------- | --------------- | ------------------ |
| Sparse support | Yes             | No                 |
| Negative index | Yes             | No                 |
| `.length`      | Yes             | Use `.Count`       |
| `.push()`      | Yes             | Use `.Add()`       |
| `.map()`       | Yes             | Use `.Select()`    |
| `.filter()`    | Yes             | Use `.Where()`     |

### Console Output

| Feature      | JS Mode           | Dotnet Mode           |
| ------------ | ----------------- | --------------------- |
| Basic output | `console.log()`   | `Console.WriteLine()` |
| No newline   | Not available     | `Console.Write()`     |
| Formatting   | Template literals | Template literals     |

### Type Behavior

| Type      | JS Mode                   | Dotnet Mode                |
| --------- | ------------------------- | -------------------------- |
| `number`  | `double`                  | `double`                   |
| `string`  | `string`                  | `string`                   |
| `boolean` | `bool`                    | `bool`                     |
| Arrays    | `Tsonic.Runtime.Array<T>` | Native arrays              |
| Objects   | `Tsonic.Runtime.Object`   | Anonymous types or classes |

## Choosing a Mode

### Use JS Mode When:

- Building general-purpose applications
- Need JavaScript-like array/object behavior
- Porting existing TypeScript code
- Don't need specific .NET libraries

### Use Dotnet Mode When:

- Need .NET BCL access (File I/O, networking, etc.)
- Integrating with existing .NET libraries
- Want native .NET performance
- Building .NET-ecosystem tools

## Mixing Modes

You cannot mix runtime modes in a single project. Choose one mode for your entire project.

If you need both behaviors, consider:

1. Separate projects with shared interfaces
2. Using dotnet mode with helper functions for JS-like behavior

## Migration

### JS to Dotnet

1. Update `tsonic.json`:

   ```json
   { "runtime": "dotnet" }
   ```

2. Replace type packages:

   ```bash
   npm uninstall @tsonic/js-globals
   npm install --save-dev @tsonic/dotnet
   ```

   Note: Keep `@tsonic/globals` as it's used by both modes.

3. Update imports:

   ```typescript
   // Before
   console.log("Hello");

   // After
   import { Console } from "@tsonic/dotnet/System";
   Console.WriteLine("Hello");
   ```

4. Replace array operations with .NET collections if needed.

### Dotnet to JS

1. Update `tsonic.json`:

   ```json
   { "runtime": "js" }
   ```

2. Replace type packages:

   ```bash
   npm uninstall @tsonic/dotnet
   npm install --save-dev @tsonic/js-globals @tsonic/core
   ```

   Note: Keep `@tsonic/globals` as it's used by both modes.

3. Update imports to use standard TypeScript patterns.
