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
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class arrays
    {
        public static void arrayOperations()
        {
            // Create arrays
            var numbers = new Array<double>(1, 2, 3, 4, 5);
            var names = new Array<string>("Alice", "Bob", "Charlie");
            var mixed = new Array<object>(1, "two", true);

            // Access elements
            console.log(numbers[0]);  // 1
            console.log(names[names.length - 1]);  // Charlie

            // Modify arrays
            numbers.push(6, 7);
            var last = numbers.pop();

            var first = names.shift();
            names.unshift("Adam");

            // Array properties
            console.log($"Length: {numbers.length}");
            numbers.length = 3;  // Truncate

            // Sparse arrays (JavaScript feature)
            var sparse = new Array<double>();
            sparse[10] = 100;
            console.log($"Sparse length: {sparse.length}");  // 11
            console.log($"Sparse[5]: {sparse[5]}");  // 0 (MVP: holes return default(T), not undefined)
        }
    }
}
```

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

  // These would throw runtime errors (not implemented)
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
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class arrayMethods
    {
        public static void supportedMethods()
        {
            var arr = new Array<double>(1, 2, 3, 4, 5);

            // Supported methods
            var joined = arr.join(", ");
            console.log($"Joined: {joined}");

            var sliced = arr.slice(1, 3);
            console.log($"Sliced: {sliced.join(",")}");

            var index = arr.indexOf(3);
            console.log($"Index of 3: {index}");

            var includes = arr.includes(4);
            console.log($"Includes 4: {includes}");

            // These would throw runtime errors (not implemented)
            // var mapped = arr.map(x => x * 2);  // ERROR
            // var filtered = arr.filter(x => x > 2);  // ERROR
            // var sum = arr.reduce((a, b) => a + b, 0);  // ERROR
        }

        public static void manualIterations()
        {
            var arr = new Array<double>(1, 2, 3, 4, 5);

            // Manual map
            var doubled = new Array<double>();
            foreach (var n in arr)
            {
                doubled.push(n * 2);
            }

            // Manual filter
            var evens = new Array<double>();
            foreach (var n in arr)
            {
                if (n % 2 == 0)
                {
                    evens.push(n);
                }
            }

            // Manual reduce
            double sum = 0;
            foreach (var n in arr)
            {
                sum += n;
            }

            console.log($"Doubled: {doubled.join(",")}");
            console.log($"Evens: {evens.join(",")}");
            console.log($"Sum: {sum}");
        }
    }
}
```

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
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public class Matrix
    {
        private Array<Array<double>> data;

        public Matrix(double rows, double cols)
        {
            this.data = new Array<Array<double>>();
            for (var i = 0; i < rows; i++)
            {
                this.data[i] = new Array<double>();
                for (var j = 0; j < cols; j++)
                {
                    this.data[i][j] = 0;
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
                console.log(row.join(" "));
            }
        }
    }
}
```

## Array Type Conversions

### TypeScript Input

```typescript
// src/arrayTypes.ts
import { List } from "System.Collections.Generic";

export function mixedArrayTypes(): void {
  // Tsonic.Runtime.Array (JS semantics)
  const jsArray: number[] = [1, 2, 3];
  jsArray[10] = 100; // Sparse array supported

  // .NET List (when explicitly imported)
  const dotnetList = new List<number>();
  dotnetList.Add(1);
  dotnetList.Add(2);
  dotnetList.Add(3);

  console.log(`JS Array length: ${jsArray.length}`);
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
            // Tsonic.Runtime.Array (JS semantics)
            var jsArray = new Array<double>(1, 2, 3);
            jsArray[10] = 100;  // Sparse array supported

            // .NET List (when explicitly imported)
            var dotnetList = new List<double>();
            dotnetList.Add(1);
            dotnetList.Add(2);
            dotnetList.Add(3);

            console.log($"JS Array length: {jsArray.length}");
            console.log($"NET List count: {dotnetList.Count}");
        }
    }
}
```
