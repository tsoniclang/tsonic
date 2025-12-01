# .NET Interop

How to use .NET libraries and APIs in Tsonic.

## Overview

Tsonic provides full access to .NET Base Class Library (BCL) and third-party NuGet packages through TypeScript type declarations.

## Import Syntax

### BCL Imports

Import .NET types using the `@tsonic/dotnet` package:

```typescript
import { Console } from "@tsonic/dotnet/System";
import { File, Path } from "@tsonic/dotnet/System.IO";
import { List, Dictionary } from "@tsonic/dotnet/System.Collections.Generic";
import { Enumerable } from "@tsonic/dotnet/System.Linq";
```

### Import Pattern

```
@tsonic/dotnet/<Namespace>
```

Maps directly to .NET namespaces:

| Import                                      | .NET Namespace               |
| ------------------------------------------- | ---------------------------- |
| `@tsonic/dotnet/System`                     | `System`                     |
| `@tsonic/dotnet/System.IO`                  | `System.IO`                  |
| `@tsonic/dotnet/System.Collections.Generic` | `System.Collections.Generic` |

## Common APIs

### Console

```typescript
import { Console } from "@tsonic/dotnet/System";

Console.WriteLine("Hello!");
Console.Write("No newline");
const input = Console.ReadLine();
Console.Error.WriteLine("Error message");
```

### File I/O

```typescript
import { File, Path, Directory } from "@tsonic/dotnet/System.IO";

// Read files
const text = File.ReadAllText("./data.txt");
const lines = File.ReadAllLines("./data.txt");
const bytes = File.ReadAllBytes("./image.png");

// Write files
File.WriteAllText("./output.txt", "content");
File.WriteAllLines("./output.txt", ["line1", "line2"]);
File.WriteAllBytes("./output.bin", bytes);

// Check existence
if (File.Exists("./data.txt")) {
  // ...
}

// Paths
const full = Path.Combine(".", "data", "file.txt");
const dir = Path.GetDirectoryName(full);
const ext = Path.GetExtension(full);

// Directories
Directory.CreateDirectory("./output");
const files = Directory.GetFiles("./data");
```

### Collections

```typescript
import {
  List,
  Dictionary,
  HashSet,
} from "@tsonic/dotnet/System.Collections.Generic";

// List<T>
const list = new List<number>();
list.Add(1);
list.Add(2);
list.AddRange([3, 4, 5]);
console.log(list.Count);
const first = list[0];

// Dictionary<K,V>
const dict = new Dictionary<string, number>();
dict.Add("one", 1);
dict["two"] = 2;
if (dict.ContainsKey("one")) {
  console.log(dict["one"]);
}

// HashSet<T>
const set = new HashSet<string>();
set.Add("a");
set.Add("b");
console.log(set.Contains("a"));
```

### LINQ

```typescript
import { Enumerable } from "@tsonic/dotnet/System.Linq";

const numbers = [1, 2, 3, 4, 5];

// Query operations
const doubled = Enumerable.Select(numbers, (n) => n * 2);
const filtered = Enumerable.Where(numbers, (n) => n > 2);
const sum = Enumerable.Sum(numbers);
const first = Enumerable.First(numbers);
const any = Enumerable.Any(numbers, (n) => n > 10);
```

### DateTime

```typescript
import { DateTime, TimeSpan } from "@tsonic/dotnet/System";

const now = DateTime.Now;
const utc = DateTime.UtcNow;
const date = new DateTime(2024, 1, 15);

console.log(now.Year);
console.log(now.ToString("yyyy-MM-dd"));

const duration = TimeSpan.FromHours(2);
const later = now.Add(duration);
```

### JSON Serialization

```typescript
import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

interface User {
  id: number;
  name: string;
}

// Serialize object to JSON
const user: User = { id: 1, name: "Alice" };
const json = JsonSerializer.Serialize(user);

// Deserialize JSON to object
const parsed = JsonSerializer.Deserialize<User>(json);

// Works with collections too
const users = new List<User>();
users.Add({ id: 1, name: "Alice" });
users.Add({ id: 2, name: "Bob" });
const usersJson = JsonSerializer.Serialize(users);
```

**NativeAOT Support**: Tsonic automatically generates the required `JsonSerializerContext`
for NativeAOT compatibility. No additional configuration needed.

### String Operations

```typescript
import { String } from "@tsonic/dotnet/System";

const result = String.IsNullOrEmpty(input);
const joined = String.Join(", ", ["a", "b", "c"]);
const formatted = String.Format("Hello, {0}!", name);
```

## NuGet Packages

### Adding Dependencies

In `tsonic.json`:

```json
{
  "dotnet": {
    "packages": [
      { "name": "Newtonsoft.Json", "version": "13.0.3" },
      { "name": "System.Net.Http.Json", "version": "8.0.0" }
    ]
  }
}
```

### Using NuGet Types

After adding to config, import and use:

```typescript
// Assuming you have type declarations
import { JsonConvert } from "Newtonsoft.Json";

const json = JsonConvert.SerializeObject({ name: "Alice" });
const obj = JsonConvert.DeserializeObject(json);
```

## External Libraries

### Library Bindings

For custom .NET libraries, use the `libraries` config:

```json
{
  "dotnet": {
    "libraries": ["./libs/my-library"]
  }
}
```

Or via CLI:

```bash
tsonic build src/App.ts --lib ./libs/my-library
```

### Creating Bindings

Library bindings are TypeScript declaration files that describe .NET types:

```typescript
// libs/my-library/index.d.ts
export declare class MyService {
  constructor();
  doSomething(value: string): number;
}
```

## Type Mapping

### Primitive Types

| TypeScript | C#       |
| ---------- | -------- |
| `number`   | `double` |
| `string`   | `string` |
| `boolean`  | `bool`   |
| `int`      | `int`    |
| `float`    | `float`  |
| `long`     | `long`   |

### Collection Types

| TypeScript        | C#                                           |
| ----------------- | -------------------------------------------- |
| `List<T>`         | `System.Collections.Generic.List<T>`         |
| `Dictionary<K,V>` | `System.Collections.Generic.Dictionary<K,V>` |
| `HashSet<T>`      | `System.Collections.Generic.HashSet<T>`      |
| `T[]`             | Native array or List depending on context    |

### Special Types

| TypeScript   | C#        |
| ------------ | --------- |
| `void`       | `void`    |
| `null`       | `null`    |
| `undefined`  | `null`    |
| `Promise<T>` | `Task<T>` |

## Async/Await

.NET async methods map to TypeScript async:

```typescript
import { File } from "@tsonic/dotnet/System.IO";

export async function main(): Promise<void> {
  const content = await File.ReadAllTextAsync("./data.txt");
  await File.WriteAllTextAsync("./output.txt", content);
}
```

## Error Handling

.NET exceptions work with TypeScript try/catch:

```typescript
import { File } from "@tsonic/dotnet/System.IO";

try {
  const content = File.ReadAllText("./missing.txt");
} catch (error) {
  console.log("File not found");
}
```

## Best Practices

1. **Use type packages**: Install `@tsonic/dotnet` for type safety
2. **Explicit imports**: Import only what you need
3. **Check null**: .NET methods may return null
4. **Handle exceptions**: Wrap .NET calls in try/catch
5. **Prefer async**: Use async versions of I/O operations
