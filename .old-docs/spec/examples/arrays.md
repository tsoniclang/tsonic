# Array Examples

## Basic Array Operations

### TypeScript Input

```typescript
// src/arrays.ts
export function arrayOperations(): void {
  // Create arrays
  const numbers: number[] = [1, 2, 3, 4, 5];
  const names = ["Alice", "Bob", "Charlie"];
  const mixed = [1, "two", true];

  // Access elements
  console.log(numbers[0]); // 1
  console.log(names[names.length - 1]); // Charlie

  // Modify arrays
  numbers.push(6, 7);
  const last = numbers.pop();

  const first = names.shift();
  names.unshift("Adam");

  // Array properties
  console.log(`Length: ${numbers.length}`);
  numbers.length = 3; // Truncate

  // Sparse arrays (JavaScript feature)
  const sparse: number[] = [];
  sparse[10] = 100;
  console.log(`Sparse length: ${sparse.length}`); // 11
  console.log(`Sparse[5]: ${sparse[5]}`); // undefined in JS, 0 in C# (MVP limitation)
}
```

### C# Output

```csharp
using System.Collections.Generic;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class arrays
    {
        public static void arrayOperations()
        {
            // Create arrays - TypeScript arrays become List<T>
            var numbers = new List<double> { 1.0, 2.0, 3.0, 4.0, 5.0 };
            var names = new List<string> { "Alice", "Bob", "Charlie" };
            var mixed = new List<object> { 1, "two", true };

            // Access elements - direct indexing works
            console.log(numbers[0]);  // 1
            console.log(names[names.Count - 1]);  // Charlie

            // Modify arrays - use static helpers in Tsonic.Runtime.Array
            Tsonic.Runtime.Array.push(numbers, 6);
            Tsonic.Runtime.Array.push(numbers, 7);
            var last = Tsonic.Runtime.Array.pop(numbers);

            var first = Tsonic.Runtime.Array.shift(names);
            Tsonic.Runtime.Array.unshift(names, "Adam");

            // Array properties - use helper for length setter
            console.log($"Length: {numbers.Count}");
            Tsonic.Runtime.Array.setLength(numbers, 3);  // Truncate

            // Sparse arrays - List doesn't support holes, so use helper
            var sparse = Tsonic.Runtime.Array.createSparse<double>();
            Tsonic.Runtime.Array.setSparse(sparse, 10, 100);
            console.log($"Sparse length: {Tsonic.Runtime.Array.getSparseLength(sparse)}");  // 11
            console.log($"Sparse[5]: {Tsonic.Runtime.Array.getSparse(sparse, 5)}");  // 0 in MVP
        }
    }
}
```

**Note**: In the MVP, sparse arrays use a helper class that wraps `List<T>` and tracks holes. Full sparse array support will be added in a future version.

---

## Array Methods

### TypeScript Input

```typescript
// src/arrayMethods.ts
export function supportedMethods(): void {
  const arr = [1, 2, 3, 4, 5];

  // Supported methods
  const joined = arr.join(", ");
  console.log(`Joined: ${joined}`);

  const sliced = arr.slice(1, 3);
  console.log(`Sliced: ${sliced.join(",")}`);

  const index = arr.indexOf(3);
  console.log(`Index of 3: ${index}`);

  const includes = arr.includes(4);
  console.log(`Includes 4: ${includes}`);

  // These would throw runtime errors (not implemented in MVP)
  // const mapped = arr.map(x => x * 2);  // ERROR
  // const filtered = arr.filter(x => x > 2);  // ERROR
  // const sum = arr.reduce((a, b) => a + b, 0);  // ERROR
}

export function manualIterations(): void {
  const arr = [1, 2, 3, 4, 5];

  // Manual map
  const doubled: number[] = [];
  for (const n of arr) {
    doubled.push(n * 2);
  }

  // Manual filter
  const evens: number[] = [];
  for (const n of arr) {
    if (n % 2 === 0) {
      evens.push(n);
    }
  }

  // Manual reduce
  let sum = 0;
  for (const n of arr) {
    sum += n;
  }

  console.log(`Doubled: ${doubled.join(",")}`);
  console.log(`Evens: ${evens.join(",")}`);
  console.log(`Sum: ${sum}`);
}
```

### C# Output

```csharp
using System.Collections.Generic;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class arrayMethods
    {
        public static void supportedMethods()
        {
            var arr = new List<double> { 1.0, 2.0, 3.0, 4.0, 5.0 };

            // Supported methods - use static helpers
            var joined = Tsonic.Runtime.Array.join(arr, ", ");
            console.log($"Joined: {joined}");

            var sliced = Tsonic.Runtime.Array.slice(arr, 1, 3);
            console.log($"Sliced: {Tsonic.Runtime.Array.join(sliced, ",")}");

            var index = Tsonic.Runtime.Array.indexOf(arr, 3);
            console.log($"Index of 3: {index}");

            var includes = Tsonic.Runtime.Array.includes(arr, 4);
            console.log($"Includes 4: {includes}");

            // These would throw runtime errors (not implemented in MVP)
            // var mapped = Tsonic.Runtime.Array.map(arr, x => x * 2);  // ERROR
            // var filtered = Tsonic.Runtime.Array.filter(arr, x => x > 2);  // ERROR
            // var sum = Tsonic.Runtime.Array.reduce(arr, (a, b) => a + b, 0);  // ERROR
        }

        public static void manualIterations()
        {
            var arr = new List<double> { 1.0, 2.0, 3.0, 4.0, 5.0 };

            // Manual map
            var doubled = new List<double>();
            foreach (var n in arr)
            {
                Tsonic.Runtime.Array.push(doubled, n * 2);
            }

            // Manual filter
            var evens = new List<double>();
            foreach (var n in arr)
            {
                if (n % 2 == 0)
                {
                    Tsonic.Runtime.Array.push(evens, n);
                }
            }

            // Manual reduce
            double sum = 0;
            foreach (var n in arr)
            {
                sum += n;
            }

            console.log($"Doubled: {Tsonic.Runtime.Array.join(doubled, ",")}");
            console.log($"Evens: {Tsonic.Runtime.Array.join(evens, ",")}");
            console.log($"Sum: {sum}");
        }
    }
}
```

---

## Multidimensional Arrays

### TypeScript Input

```typescript
// src/matrix.ts
export class Matrix {
  private data: number[][];

  constructor(rows: number, cols: number) {
    this.data = [];
    for (let i = 0; i < rows; i++) {
      this.data[i] = [];
      for (let j = 0; j < cols; j++) {
        this.data[i][j] = 0;
      }
    }
  }

  set(row: number, col: number, value: number): void {
    this.data[row][col] = value;
  }

  get(row: number, col: number): number {
    return this.data[row][col];
  }

  print(): void {
    for (const row of this.data) {
      console.log(row.join(" "));
    }
  }
}
```

### C# Output

```csharp
using System.Collections.Generic;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public class Matrix
    {
        private List<List<double>> data;

        public Matrix(double rows, double cols)
        {
            this.data = new List<List<double>>();
            for (var i = 0; i < rows; i++)
            {
                // Create new inner list
                var row = new List<double>();
                Tsonic.Runtime.Array.push(this.data, row);

                for (var j = 0; j < cols; j++)
                {
                    Tsonic.Runtime.Array.push(this.data[(int)i], 0);
                }
            }
        }

        public void set(double row, double col, double value)
        {
            this.data[(int)row][(int)col] = value;
        }

        public double get(double row, double col)
        {
            return this.data[(int)row][(int)col];
        }

        public void print()
        {
            foreach (var row in this.data)
            {
                console.log(Tsonic.Runtime.Array.join(row, " "));
            }
        }
    }
}
```

---

## Array Type Conversions

### TypeScript Input

```typescript
// src/arrayTypes.ts
import { List } from "System.Collections.Generic";

export function mixedArrayTypes(): void {
  // TypeScript array (becomes List<T>)
  const tsArray: number[] = [1, 2, 3];
  tsArray.push(4); // Compiles to static helper

  // Explicit .NET List (when explicitly imported and newed)
  const dotnetList = new List<number>();
  dotnetList.Add(1); // C# method
  dotnetList.Add(2);
  dotnetList.Add(3);

  console.log(`TS Array length: ${tsArray.length}`);
  console.log(`NET List count: ${dotnetList.Count}`);
}
```

### C# Output

```csharp
using System.Collections.Generic;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class arrayTypes
    {
        public static void mixedArrayTypes()
        {
            // TypeScript array (becomes List<T>)
            var tsArray = new List<double> { 1.0, 2.0, 3.0 };
            Tsonic.Runtime.Array.push(tsArray, 4);  // Static helper

            // Explicit .NET List
            var dotnetList = new List<double>();
            dotnetList.Add(1);  // C# method
            dotnetList.Add(2);
            dotnetList.Add(3);

            console.log($"TS Array length: {tsArray.Count}");
            console.log($"NET List count: {dotnetList.Count}");
        }
    }
}
```

**Note**: Both TypeScript arrays and explicit `new List<T>()` compile to the same C# `List<T>`. The difference is in how you call methods:

- TypeScript array methods → Static helpers
- .NET List methods → Instance methods

---

## Array Semantics Reference

### TypeScript → C# Mapping

| TypeScript              | C#                                                                   |
| ----------------------- | -------------------------------------------------------------------- |
| `number[]`              | `List<double>`                                                       |
| `string[]`              | `List<string>`                                                       |
| `T[]`                   | `List<T>`                                                            |
| `arr[i]`                | `arr[i]` (direct indexing)                                           |
| `arr.length`            | `arr.Count` (read), `Tsonic.Runtime.Array.setLength(arr, n)` (write) |
| `arr.push(x)`           | `Tsonic.Runtime.Array.push(arr, x)`                                  |
| `arr.pop()`             | `Tsonic.Runtime.Array.pop(arr)`                                      |
| `arr.shift()`           | `Tsonic.Runtime.Array.shift(arr)`                                    |
| `arr.unshift(x)`        | `Tsonic.Runtime.Array.unshift(arr, x)`                               |
| `arr.join(sep)`         | `Tsonic.Runtime.Array.join(arr, sep)`                                |
| `arr.slice(start, end)` | `Tsonic.Runtime.Array.slice(arr, start, end)`                        |
| `arr.indexOf(x)`        | `Tsonic.Runtime.Array.indexOf(arr, x)`                               |
| `arr.includes(x)`       | `Tsonic.Runtime.Array.includes(arr, x)`                              |

### Why Static Helpers?

TypeScript arrays have JavaScript semantics (sparse arrays, length setter, etc.) that don't map directly to C# `List<T>`. Static helpers in `Tsonic.Runtime.Array` preserve exact JavaScript behavior while using `List<T>` as the underlying storage.

**Benefits**:

- Uses standard .NET collections (no custom classes)
- Exact JavaScript semantics
- Interoperates with .NET code
- Clear distinction between Tsonic arrays and .NET collections

---

## See Also

- [Type Mappings](../reference/language/types.md) - Complete type mapping reference
- [Runtime Specification](../reference/runtime/array.md) - Full Array helper API
- [Basic Examples](./basic.md) - More introductory examples
