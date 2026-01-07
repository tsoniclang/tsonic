# .NET Integration Examples

Using .NET Base Class Library (BCL) in Tsonic.

## File Operations

```typescript
	import { Console } from "@tsonic/dotnet/System.js";
	import { File, Directory, Path } from "@tsonic/dotnet/System.IO.js";

	export function main(): void {
	  // Read file
	  const content = File.readAllText("input.txt");
	  Console.writeLine(content);

	  // Write file
	  File.writeAllText("output.txt", "Hello, World!");

	  // Check existence
	  if (File.exists("config.json")) {
	    const config = File.readAllText("config.json");
	  }

	  // List files
	  const files = Directory.getFiles(".");
	  for (const file of files) {
	    Console.writeLine(file);
	  }

	  // Create directory
	  Directory.createDirectory("data");

	  // Path manipulation
	  const fullPath = Path.combine("data", "file.txt");
	  const extension = Path.getExtension("file.txt");
	  const filename = Path.getFileName("/path/to/file.txt");
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
	  numbers.add(1);
	  numbers.add(2);
	  numbers.add(3);

	  Console.writeLine(numbers.count);
	  Console.writeLine(numbers.contains(2));

	  numbers.remove(2);
	  numbers.clear();

	  // Dictionary<K,V>
	  const ages = new Dictionary<string, number>();
	  ages.add("Alice", 30);
	  ages.add("Bob", 25);

	  const aliceAge = ages["Alice"];
	  const hasAlice = ages.containsKey("Alice");

	  // HashSet<T>
	  const unique = new HashSet<string>();
	  unique.add("a");
	  unique.add("b");
	  unique.add("a"); // Duplicate, ignored

	  Console.writeLine(unique.count); // 2

	  // Dictionary with number keys
	  const byId = new Dictionary<number, string>();
	  byId.add(1, "Alice");
	  byId.add(2, "Bob");
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
	  Console.writeLine(`Point: ${x}, ${y}`);

	  // Return multiple values
	  const result = getMinMax([5, 2, 8, 1, 9]);
	  Console.writeLine(`Min: ${result[0]}, Max: ${result[1]}`);
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
	  const adults = Enumerable.where(users, (u) => u.age >= 30);

  // Transform (Select)
	  const names = Enumerable.select(users, (u) => u.name);

  // First matching
	  const alice = Enumerable.firstOrDefault(users, (u) => u.name === "Alice");

  // Sorting
	  const byAge = Enumerable.orderBy(users, (u) => u.age);

  // Aggregation
	  const totalAge = Enumerable.sum(users, (u) => u.age);
	  const averageAge = Enumerable.average(users, (u) => u.age);

  // Any/All
	  const anyAdult = Enumerable.any(users, (u) => u.age >= 18);
	  const allAdults = Enumerable.all(users, (u) => u.age >= 18);
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
	  sb.append("Hello");
	  sb.append(", ");
	  sb.append("World");
	  sb.appendLine("!");

	  const result = sb.toString();
	  Console.writeLine(result);

	  // String formatting
	  const formatted = String.format("Name: {0}, Age: {1}", "Alice", 30);
	}
```

## Date and Time

```typescript
	import { Console, DateTime, TimeSpan } from "@tsonic/dotnet/System.js";

	export function main(): void {
	  // Current time
	  const now = DateTime.now;
	  const utcNow = DateTime.utcNow;

  // Create specific date
  const date = new DateTime(2024, 12, 25);

	  // Date arithmetic
	  const tomorrow = now.addDays(1);
	  const nextWeek = now.addDays(7);
	  const nextMonth = now.addMonths(1);

  // TimeSpan
  const duration = new TimeSpan(1, 30, 0); // 1 hour 30 minutes
  const later = now.Add(duration);

	  // Formatting
	  const formatted = now.toString("yyyy-MM-dd HH:mm:ss");
	  Console.writeLine(formatted);

	  // Parsing
	  const parsed = DateTime.parse("2024-12-25");
	}
```

## Console I/O

```typescript
	import { Console, ConsoleColor } from "@tsonic/dotnet/System.js";

	export function main(): void {
	  // Output
	  Console.writeLine("Hello, World!");
	  Console.write("No newline");

	  // Formatted output
	  Console.writeLine("Name: {0}, Age: {1}", "Alice", 30);

	  // Colors
	  Console.foregroundColor = ConsoleColor.green;
	  Console.writeLine("Green text");
	  Console.resetColor();

	  // Read input
	  Console.write("Enter name: ");
	  const name = Console.readLine();
	  Console.writeLine(`Hello, ${name}!`);
	}
```

## Math Operations

```typescript
	import { Math, Random } from "@tsonic/dotnet/System.js";

	export function main(): void {
	  // Basic operations
	  const abs = Math.abs(-5); // 5
	  const max = Math.max(10, 20); // 20
	  const min = Math.min(10, 20); // 10

	  // Rounding
	  const floor = Math.floor(4.7); // 4
	  const ceil = Math.ceiling(4.2); // 5
	  const round = Math.round(4.5); // 4 (banker's rounding)

	  // Power and roots
	  const pow = Math.pow(2, 10); // 1024
	  const sqrt = Math.sqrt(16); // 4

	  // Trigonometry
	  const sin = Math.sin(Math.pi / 2);
	  const cos = Math.cos(0);

	  // Random
	  const random = new Random();
	  const value = random.next(1, 100); // 1-99
	  const doubleValue = random.nextDouble(); // 0.0-1.0
	}
```

## Environment

```typescript
	import { Console, Environment } from "@tsonic/dotnet/System.js";

	export function main(): void {
	  // Environment variables
	  const path = Environment.getEnvironmentVariable("PATH");
	  Environment.setEnvironmentVariable("MY_VAR", "value");

	  // System info
	  const machineName = Environment.machineName;
	  const userName = Environment.userName;
	  const osVersion = Environment.osVersion;

	  // Current directory
	  const cwd = Environment.currentDirectory;

	  // Command line args
	  const args = Environment.getCommandLineArgs();
	  for (const arg of args) {
	    Console.writeLine(arg);
	  }

	  // Exit code
	  Environment.exit(0);
	}
```

## HTTP Client

```typescript
	import { Console } from "@tsonic/dotnet/System.js";
	import { HttpClient } from "@tsonic/dotnet/System.Net.Http.js";

	export async function main(): Promise<void> {
	  const client = new HttpClient();

	  // GET request
	  const response = await client.getStringAsync("https://api.example.com/data");
	  Console.writeLine(response);
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
	  const json = JsonSerializer.serialize(user);
	  Console.writeLine(json); // {"id":1,"name":"Alice"}

	  // Deserialize
	  const parsed = JsonSerializer.deserialize<User>('{"id":2,"name":"Bob"}');
	  Console.writeLine(parsed?.name); // Bob
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
