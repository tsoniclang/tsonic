# Using .NET Libraries

**Goal**: Learn how to integrate .NET libraries into your Tsonic applications

**Time**: ~25 minutes

**Prerequisites**: Completed [Language Basics](02-language-basics.md)

---

## Overview

One of Tsonic's key features is seamless .NET interop. You can import and use any .NET library just like a TypeScript module.

**Key Benefits**:

- Access to entire .NET ecosystem
- File I/O, HTTP, JSON, XML, databases, and more
- High-performance native libraries
- No FFI or wrapper code needed

---

## Importing .NET Types

### Basic Import Syntax

```typescript
// Import from .NET namespaces (NO .ts extension!)
import { File } from "System.IO";
import { HttpClient } from "System.Net.Http";
import { JsonSerializer } from "System.Text.Json";
```

**Rule**: .NET imports do NOT have `.ts` extension (they're not TypeScript files)

### Multiple Imports

```typescript
import { File, Directory, Path } from "System.IO";
import { Console } from "System";
```

### Nested Namespaces

.NET uses flat namespace directories:

```typescript
// System.Collections.Generic becomes:
import { List } from "System.Collections.Generic";

// NOT System/Collections/Generic (no nesting!)
```

---

## File I/O

### Reading Files

```typescript
import { File } from "System.IO";

export function main(): void {
  // Read entire file as string
  const content = File.ReadAllText("config.json");
  console.log(content);

  // Read as lines
  const lines = File.ReadAllLines("data.txt");
  for (const line of lines) {
    console.log(line);
  }

  // Read as bytes
  const bytes = File.ReadAllBytes("image.png");
  console.log(`File size: ${bytes.length} bytes`);
}
```

### Writing Files

```typescript
import { File, Path } from "System.IO";

export function main(): void {
  // Write string to file
  File.WriteAllText("output.txt", "Hello, World!");

  // Write lines
  const lines = ["Line 1", "Line 2", "Line 3"];
  File.WriteAllLines("output.txt", lines);

  // Append to file
  File.AppendAllText("log.txt", "New log entry\n");
}
```

### Working with Paths

```typescript
import { Path, Directory } from "System.IO";

export function main(): void {
  // Combine paths (cross-platform)
  const filePath = Path.Combine("data", "users", "alice.json");
  // Windows: data\users\alice.json
  // Unix: data/users/alice.json

  // Get file name
  const fileName = Path.GetFileName(filePath); // "alice.json"

  // Get extension
  const ext = Path.GetExtension(filePath); // ".json"

  // Get directory
  const dir = Path.GetDirectoryName(filePath); // "data/users"

  // Check if file exists
  if (File.Exists(filePath)) {
    console.log("File exists!");
  }

  // Create directory if needed
  if (!Directory.Exists(dir)) {
    Directory.CreateDirectory(dir);
  }
}
```

---

## HTTP Requests

### GET Requests

```typescript
import { HttpClient } from "System.Net.Http";

export async function main(): Promise<void> {
  const client = new HttpClient();

  // GET request
  const response = await client.GetStringAsync(
    "https://api.github.com/users/github"
  );
  console.log(response);

  // With headers
  client.DefaultRequestHeaders.Add("User-Agent", "Tsonic-App");
  const data = await client.GetStringAsync("https://api.example.com/data");
}
```

### POST Requests

```typescript
import { HttpClient, StringContent } from "System.Net.Http";
import { Encoding } from "System.Text";

export async function main(): Promise<void> {
  const client = new HttpClient();

  // JSON POST
  const json = '{"name": "Alice", "age": 30}';
  const content = new StringContent(json, Encoding.UTF8, "application/json");

  const response = await client.PostAsync(
    "https://api.example.com/users",
    content
  );
  const result = await response.Content.ReadAsStringAsync();
  console.log(result);
}
```

---

## JSON Serialization

### Parsing JSON

```typescript
import { JsonSerializer } from "System.Text.Json";

interface User {
  name: string;
  age: number;
  email: string;
}

export function main(): void {
  const json = '{"name": "Alice", "age": 30, "email": "alice@example.com"}';

  // Deserialize
  const user = JsonSerializer.Deserialize<User>(json);
  console.log(user.name); // "Alice"
}
```

### Creating JSON

```typescript
import { JsonSerializer } from "System.Text.Json";

interface User {
  name: string;
  age: number;
  email: string;
}

export function main(): void {
  const user: User = {
    name: "Alice",
    age: 30,
    email: "alice@example.com",
  };

  // Serialize
  const json = JsonSerializer.Serialize(user);
  console.log(json);
  // {"name":"Alice","age":30,"email":"alice@example.com"}

  // Pretty print
  const options = new JsonSerializerOptions();
  options.WriteIndented = true;
  const prettyJson = JsonSerializer.Serialize(user, options);
}
```

---

## Working with Lists

### Using .NET List<T>

```typescript
import { List } from "System.Collections.Generic";

export function main(): void {
  // Create list
  const numbers = new List<number>();

  // Add items
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);

  // Access by index
  console.log(numbers[0]); // 1

  // Iterate
  for (const num of numbers) {
    console.log(num);
  }

  // Count
  console.log(numbers.Count); // 3

  // Contains
  if (numbers.Contains(2)) {
    console.log("Found 2!");
  }
}
```

### TypeScript Arrays and .NET

TypeScript arrays compile to `List<T>`. The `mode` setting controls how array methods are lowered:

```typescript
// TypeScript array (compiles to List<T>)
const arr: number[] = [1, 2, 3];
arr.push(4);
arr.map((n) => n * 2);
```

**In `mode: "dotnet"` (default)**:
- `push(4)` → `Add(4)`
- `map(fn)` → `Select(fn).ToList()`

**In `mode: "js"` (opt-in)**:
- `push(4)` → `arr.push(4)` (Tsonic.JSRuntime extension)
- `map(fn)` → `arr.map(fn)` (Tsonic.JSRuntime extension with JS semantics)

---

## LINQ Queries

LINQ (Language Integrated Query) provides powerful data manipulation:

```typescript
import { Enumerable } from "System.Linq";

export function main(): void {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Filter
  const evens = Enumerable.Where(numbers, (n) => n % 2 === 0).ToArray();
  // [2, 4, 6, 8, 10]

  // Map (Select)
  const doubled = Enumerable.Select(numbers, (n) => n * 2).ToArray();
  // [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]

  // Filter and map
  const result = Enumerable.Where(numbers, (n) => n > 5)
    .Select((n) => n * 2)
    .ToArray();
  // [12, 14, 16, 18, 20]

  // Aggregate (reduce)
  const sum = Enumerable.Sum(numbers); // 55

  // First/Last
  const first = Enumerable.First(numbers); // 1
  const last = Enumerable.Last(numbers); // 10
  const firstEven = Enumerable.First(evens); // 2
}
```

---

## Handling Ref and Out Parameters

.NET methods sometimes use `ref` and `out` parameters. Tsonic provides `TSByRef<T>`:

### Out Parameters

```typescript
import { TSByRef } from "_support/types";
import { Int32 } from "System";

export function main(): void {
  const input = "42";
  const result: TSByRef<number> = { value: 0 };

  // TryParse uses out parameter
  const success = Int32.TryParse(input, result);

  if (success) {
    console.log(`Parsed: ${result.value}`); // 42
  }
}
```

### Ref Parameters

```typescript
import { TSByRef } from "_support/types";

// Hypothetical .NET method with ref parameter
export function main(): void {
  const counter: TSByRef<number> = { value: 0 };

  // Method modifies counter.value
  SomeClass.IncrementRef(counter);

  console.log(counter.value); // 1
}
```

**Pattern**: `TSByRef<T>` is an object with a `value` property that can be modified.

---

## Explicit Interface Implementation

.NET supports explicit interface implementation. Tsonic uses the `As_<Interface>` pattern:

```typescript
import { IDisposable } from "System";

export function main(): void {
  const resource = getResource();

  // Explicit interface method
  resource.As_IDisposable.Dispose();
}
```

**When needed**: Rare - only when class has multiple interfaces with same method name.

---

## Working with Dates

```typescript
import { DateTime, TimeSpan } from "System";

export function main(): void {
  // Current date/time
  const now = DateTime.Now;
  console.log(now.ToString());

  // Specific date
  const birthday = new DateTime(1990, 5, 15);

  // Date arithmetic
  const nextWeek = now.Add(TimeSpan.FromDays(7));

  // Formatting
  const formatted = now.ToString("yyyy-MM-dd");
  console.log(formatted); // "2025-11-23"

  // Comparison
  if (now > birthday) {
    console.log("Birthday has passed");
  }
}
```

---

## Environment and Process

```typescript
import { Environment } from "System";

export function main(): void {
  // Environment variables
  const path = Environment.GetEnvironmentVariable("PATH");
  console.log(path);

  // Platform info
  const os = Environment.OSVersion.Platform;
  console.log(os); // Unix, Win32NT, etc.

  // Current directory
  const cwd = Environment.CurrentDirectory;
  console.log(cwd);

  // Exit code
  Environment.Exit(0);
}
```

---

## Command Line Arguments

```typescript
import { Environment } from "System";

export function main(): void {
  // Get command line args
  const args = Environment.GetCommandLineArgs();

  // First arg is executable path, skip it
  for (let i = 1; i < args.Length; i++) {
    console.log(`Arg ${i}: ${args[i]}`);
  }
}
```

Run with:

```bash
./bin/main arg1 arg2 arg3
```

Output:

```
Arg 1: arg1
Arg 2: arg2
Arg 3: arg3
```

---

## Complete Example: HTTP JSON API Client

```typescript
import { HttpClient } from "System.Net.Http";
import { JsonSerializer } from "System.Text.Json";
import { File } from "System.IO";

interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUsers(): Promise<User[]> {
  const client = new HttpClient();
  client.DefaultRequestHeaders.Add("User-Agent", "Tsonic-App");

  const json = await client.GetStringAsync(
    "https://jsonplaceholder.typicode.com/users"
  );
  const users = JsonSerializer.Deserialize<User[]>(json);

  return users;
}

export async function main(): Promise<void> {
  const users = await fetchUsers();

  console.log(`Fetched ${users.length} users:`);

  for (const user of users) {
    console.log(`- ${user.name} (${user.email})`);
  }

  // Save to file
  const json = JsonSerializer.Serialize(users);
  File.WriteAllText("users.json", json);
  console.log("Saved to users.json");
}
```

---

## Using NuGet Packages

To use additional .NET libraries, add them to your project:

### 1. Create .csproj file

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>
```

### 2. Restore packages

```bash
dotnet restore
```

### 3. Use in TypeScript

```typescript
import { JsonConvert } from "Newtonsoft.Json";

export function main(): void {
  const obj = { name: "Alice", age: 30 };
  const json = JsonConvert.SerializeObject(obj);
  console.log(json);
}
```

---

## Common Patterns

### Safe File Operations

```typescript
import { File, Path } from "System.IO";

export function main(): void {
  const filePath = "config.json";

  try {
    if (File.Exists(filePath)) {
      const content = File.ReadAllText(filePath);
      console.log(content);
    } else {
      console.log("File not found");
    }
  } catch (error) {
    console.log(`Error reading file: ${error}`);
  }
}
```

### Resource Cleanup (IDisposable)

```typescript
import { StreamReader, File } from "System.IO";

export function main(): void {
  // Using statement pattern (manual)
  const reader = new StreamReader("file.txt");
  try {
    const line = reader.ReadLine();
    console.log(line);
  } finally {
    reader.Dispose();
  }
}
```

---

## Type Mappings Reference

| .NET Type         | TypeScript Type | Notes                                |
| ----------------- | --------------- | ------------------------------------ |
| `string`          | `string`        | UTF-16 string                        |
| `int`, `long`     | `number`        | Mapped to `double`                   |
| `double`, `float` | `number`        | Direct mapping                       |
| `bool`            | `boolean`       | Direct mapping                       |
| `DateTime`        | `DateTime`      | .NET type used directly              |
| `List<T>`         | `List<T>`       | .NET type used directly              |
| `T[]`             | `number[]`      | JavaScript array with Tsonic runtime |

See [.NET Type Mappings](../reference/dotnet/type-mappings.md) for complete reference.

---

## Key Takeaways

1. **.NET imports have NO .ts extension** - They're not TypeScript files
2. **Use System.IO for file operations** - Cross-platform and safe
3. **HttpClient for HTTP** - Modern async API
4. **JsonSerializer for JSON** - Built into .NET
5. **LINQ for data queries** - Powerful functional operations
6. **TSByRef<T> for ref/out params** - Wrap with `{ value: T }`

---

## Next Steps

- **[Building Applications →](04-building-apps.md)** - Real-world project patterns
- **[.NET Integration Reference](../reference/dotnet/INDEX.md)** - Complete .NET interop docs
- **[Cookbook](../cookbook/INDEX.md)** - Common .NET patterns and recipes

---

**Previous**: [← Language Basics](02-language-basics.md) | **Next**: [Building Applications →](04-building-apps.md)
