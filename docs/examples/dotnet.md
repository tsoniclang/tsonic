# .NET Integration Examples

Using .NET Base Class Library (BCL) in Tsonic.

## File Operations

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { File, Directory, Path } from "@tsonic/dotnet/System.IO.js";

export function main(): void {
  // Read file
  const content = File.ReadAllText("input.txt");
  Console.WriteLine(content);

  // Write file
  File.WriteAllText("output.txt", "Hello, World!");

  // Check existence
  if (File.Exists("config.json")) {
    const config = File.ReadAllText("config.json");
  }

  // List files
  const files = Directory.GetFiles(".");
  for (const file of files) {
    Console.WriteLine(file);
  }

  // Create directory
  Directory.CreateDirectory("data");

  // Path manipulation
  const fullPath = Path.Combine("data", "file.txt");
  const extension = Path.GetExtension("file.txt");
  const filename = Path.GetFileName("/path/to/file.txt");
}
```

## Collections

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import {
  List,
  Dictionary,
  HashSet,
} from "@tsonic/dotnet/System.Collections.Generic.js";

export function main(): void {
  // List<T>
  const numbers = new List<number>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);

  Console.WriteLine(numbers.Count);
  Console.WriteLine(numbers.Contains(2));

  numbers.Remove(2);
  numbers.Clear();

  // Dictionary<K,V>
  const ages = new Dictionary<string, number>();
  ages.Add("Alice", 30);
  ages.Add("Bob", 25);

  const aliceAge = ages["Alice"];
  const hasAlice = ages.ContainsKey("Alice");

  // HashSet<T>
  const unique = new HashSet<string>();
  unique.Add("a");
  unique.Add("b");
  unique.Add("a"); // Duplicate, ignored

  Console.WriteLine(unique.Count); // 2

  // Dictionary with number keys
  const byId = new Dictionary<number, string>();
  byId.Add(1, "Alice");
  byId.Add(2, "Bob");
  const name = byId[1]; // "Alice"
}
```

## Tuples

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  // Create tuple
  const point: [number, number] = [10, 20];

  // Destructure
  const [x, y] = point;
  Console.WriteLine(`Point: ${x}, ${y}`);

  // Return multiple values
  const result = getMinMax([5, 2, 8, 1, 9]);
  Console.WriteLine(`Min: ${result[0]}, Max: ${result[1]}`);
}

function getMinMax(numbers: number[]): [number, number] {
  let min = numbers[0];
  let max = numbers[0];
  for (const n of numbers) {
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return [min, max];
}
```

## LINQ Operations

```typescript
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

interface User {
  id: number;
  name: string;
  age: number;
}

export function main(): void {
  const users: User[] = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: 25 },
    { id: 3, name: "Charlie", age: 35 },
  ];

  // Types are contextually inferred from the array element type
  // Filter (Where)
  const adults = Enumerable.Where(users, (u) => u.age >= 30);

  // Transform (Select)
  const names = Enumerable.Select(users, (u) => u.name);

  // First matching
  const alice = Enumerable.FirstOrDefault(users, (u) => u.name === "Alice");

  // Sorting
  const byAge = Enumerable.OrderBy(users, (u) => u.age);

  // Aggregation
  const totalAge = Enumerable.Sum(users, (u) => u.age);
  const averageAge = Enumerable.Average(users, (u) => u.age);

  // Any/All
  const anyAdult = Enumerable.Any(users, (u) => u.age >= 18);
  const allAdults = Enumerable.All(users, (u) => u.age >= 18);
}
```

Lambda parameter types are contextually inferred from the collection element type.

## String Operations

```typescript
import { Console, String } from "@tsonic/dotnet/System.js";
import { StringBuilder } from "@tsonic/dotnet/System.Text.js";

export function main(): void {
  // Efficient string building
  const sb = new StringBuilder();
  sb.Append("Hello");
  sb.Append(", ");
  sb.Append("World");
  sb.AppendLine("!");

  const result = sb.ToString();
  Console.WriteLine(result);

  // String formatting
  const formatted = String.Format("Name: {0}, Age: {1}", "Alice", 30);
}
```

## Date and Time

```typescript
import { Console, DateTime, TimeSpan } from "@tsonic/dotnet/System.js";

export function main(): void {
  // Current time
  const now = DateTime.Now;
  const utcNow = DateTime.UtcNow;

  // Create specific date
  const date = new DateTime(2024, 12, 25);

  // Date arithmetic
  const tomorrow = now.AddDays(1);
  const nextWeek = now.AddDays(7);
  const nextMonth = now.AddMonths(1);

  // TimeSpan
  const duration = new TimeSpan(1, 30, 0); // 1 hour 30 minutes
  const later = now.Add(duration);

  // Formatting
  const formatted = now.ToString("yyyy-MM-dd HH:mm:ss");
  Console.WriteLine(formatted);

  // Parsing
  const parsed = DateTime.Parse("2024-12-25");
}
```

## Console I/O

```typescript
import { Console, ConsoleColor } from "@tsonic/dotnet/System.js";

export function main(): void {
  // Output
  Console.WriteLine("Hello, World!");
  Console.Write("No newline");

  // Formatted output
  Console.WriteLine("Name: {0}, Age: {1}", "Alice", 30);

  // Colors
  Console.ForegroundColor = ConsoleColor.Green;
  Console.WriteLine("Green text");
  Console.ResetColor();

  // Read input
  Console.Write("Enter name: ");
  const name = Console.ReadLine();
  Console.WriteLine(`Hello, ${name}!`);
}
```

## Math Operations

```typescript
import { Math, Random } from "@tsonic/dotnet/System.js";

export function main(): void {
  // Basic operations
  const abs = Math.Abs(-5); // 5
  const max = Math.Max(10, 20); // 20
  const min = Math.Min(10, 20); // 10

  // Rounding
  const floor = Math.Floor(4.7); // 4
  const ceil = Math.Ceiling(4.2); // 5
  const round = Math.Round(4.5); // 4 (banker's rounding)

  // Power and roots
  const pow = Math.Pow(2, 10); // 1024
  const sqrt = Math.Sqrt(16); // 4

  // Trigonometry
  const sin = Math.Sin(Math.PI / 2);
  const cos = Math.Cos(0);

  // Random
  const random = new Random();
  const value = random.Next(1, 100); // 1-99
  const doubleValue = random.NextDouble(); // 0.0-1.0
}
```

## Environment

```typescript
import { Console, Environment } from "@tsonic/dotnet/System.js";

export function main(): void {
  // Environment variables
  const path = Environment.GetEnvironmentVariable("PATH");
  Environment.SetEnvironmentVariable("MY_VAR", "value");

  // System info
  const machineName = Environment.MachineName;
  const userName = Environment.UserName;
  const osVersion = Environment.OSVersion;

  // Current directory
  const cwd = Environment.CurrentDirectory;

  // Command line args
  const args = Environment.GetCommandLineArgs();
  for (const arg of args) {
    Console.WriteLine(arg);
  }

  // Exit code
  Environment.Exit(0);
}
```

## HTTP Client

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { HttpClient } from "@tsonic/dotnet/System.Net.Http.js";

export async function main(): Promise<void> {
  const client = new HttpClient();

  // GET request
  const response = await client.GetStringAsync("https://api.example.com/data");
  Console.WriteLine(response);
}
```

## JSON Serialization

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";

interface User {
  id: number;
  name: string;
}

export function main(): void {
  // Serialize
  const user: User = { id: 1, name: "Alice" };
  const json = JsonSerializer.Serialize(user);
  Console.WriteLine(json); // {"id":1,"name":"Alice"}

  // Deserialize
  const parsed = JsonSerializer.Deserialize<User>('{"id":2,"name":"Bob"}');
  Console.WriteLine(parsed?.name); // Bob
}
```

### NativeAOT Compatibility

Tsonic automatically generates a `JsonSerializerContext` for NativeAOT compatibility.
You don't need to do anything special—just use `JsonSerializer` as shown above.

Behind the scenes, Tsonic:

1. Detects all `JsonSerializer.Serialize()` and `Deserialize<T>()` calls
2. Collects the types being serialized
3. Generates `__tsonic_json.g.cs` with `[JsonSerializable]` attributes
4. Rewrites calls to use the generated context

This ensures your code works in NativeAOT without reflection-based serialization.
