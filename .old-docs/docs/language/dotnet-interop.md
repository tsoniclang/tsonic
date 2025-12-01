# .NET Interop

How to use .NET libraries in your Tsonic TypeScript code.

## Importing .NET Namespaces

Import .NET types just like TypeScript modules, but without the `.ts` extension:

```typescript
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";
import { List, Dictionary } from "System.Collections.Generic";
import { HttpClient } from "System.Net.Http";
```

These become C# `using` statements:

```csharp
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using System.Net.Http;
```

---

## Using .NET Types

### File I/O

```typescript
import { File } from "System.IO";

export function readConfig(): string {
  return File.ReadAllText("config.json");
}

export function writeLog(message: string): void {
  File.AppendAllText("log.txt", message + "\n");
}
```

### JSON

```typescript
import { JsonSerializer } from "System.Text.Json";

type User = { id: number; name: string };

export function saveUser(user: User): string {
  return JsonSerializer.Serialize(user);
}

export function loadUser(json: string): User {
  return JsonSerializer.Deserialize<User>(json);
}
```

### Collections

```typescript
import { List, Dictionary } from "System.Collections.Generic";

export function buildDictionary(): Dictionary<string, number> {
  const dict = new Dictionary<string, number>();
  dict.Add("one", 1);
  dict.Add("two", 2);
  return dict;
}

export function buildList(): List<string> {
  const list = new List<string>();
  list.Add("apple");
  list.Add("banana");
  return list;
}
```

---

## C# Types vs TypeScript Types

**Important distinction:**

- **TypeScript arrays** (`T[]`) → `List<T>` with `Tsonic.Runtime.Array` helpers
- **C# types** from .NET → Use their native C# methods

### Example: Mixed Usage

```typescript
import { File } from "System.IO";
import { List } from "System.Collections.Generic";

export function processFile(path: string): void {
  // C# method returns C# T[] (exposed as ReadonlyArray in TS)
  const lines: ReadonlyArray<string> = File.ReadAllLines(path);

  // Can't use .push() - it's a C# array, not a Tsonic array
  // lines.push("test");  // ❌ Error

  // To make mutable, use C# List
  const mutable = new List<string>(lines);
  mutable.Add("New line"); // ✅ C# method

  // Pass back to C# API (needs T[])
  File.WriteAllLines(path, mutable.ToArray());
}
```

**Key Points:**

- C# arrays from libraries → `ReadonlyArray<T>` in TypeScript
- To modify, convert to C# `List<T>`
- Use C# methods (`.Add()`, `.ToArray()`) on C# types
- Use TypeScript methods (`.push()`, `.map()`) on TypeScript arrays

---

## Method Calls

Call .NET methods with normal TypeScript syntax:

```typescript
import { Math } from "System";
import { Path } from "System.IO";

export function demo(): void {
  // Static methods
  const max = Math.Max(10, 20);

  // Instance methods
  const combined = Path.Combine("folder", "file.txt");
  const ext = Path.GetExtension(combined);
}
```

---

## Properties

Access .NET properties:

```typescript
import { DateTime } from "System";

export function getToday(): DateTime {
  const now = DateTime.Now; // Property access
  const year = now.Year; // Property on instance
  return now;
}
```

---

## Async/.NET

.NET `Task<T>` maps to TypeScript `Promise<T>`:

```typescript
import { File } from "System.IO";

export async function readAsync(path: string): Promise<string> {
  return await File.ReadAllTextAsync(path);
}

export async function writeAsync(path: string, content: string): Promise<void> {
  await File.WriteAllTextAsync(path, content);
}
```

---

## Generics

.NET generics work naturally:

```typescript
import { List } from "System.Collections.Generic";

export function makeList<T>(items: T[]): List<T> {
  const list = new List<T>();
  for (const item of items) {
    list.Add(item);
  }
  return list;
}
```

---

## Nullable Types

.NET nullable types map to TypeScript optional types:

```typescript
import { DateTime } from "System";

// C# DateTime? becomes DateTime | undefined
export function tryParse(text: string): DateTime | undefined {
  const result = DateTime.TryParse(text, out const date);
  return result ? date : undefined;
}
```

---

## Enums

.NET enums work directly:

```typescript
import { DayOfWeek } from "System";

export function isWeekend(day: DayOfWeek): boolean {
  return day === DayOfWeek.Saturday || day === DayOfWeek.Sunday;
}
```

---

## Extension Methods

C# extension methods appear as instance methods:

```typescript
import { Enumerable } from "System.Linq";

export function useLinq(numbers: number[]): number {
  // LINQ extension methods work on List<T>
  const list = new List<number>(numbers);
  return Enumerable.Sum(list);
}
```

---

## NuGet Packages

Add NuGet packages in `tsonic.json`:

```json
{
  "dotnet": {
    "packages": {
      "Newtonsoft.Json": "13.0.3",
      "Dapper": "2.1.35"
    }
  }
}
```

Then import and use:

```typescript
import { JsonConvert } from "Newtonsoft.Json";

export function serialize(obj: any): string {
  return JsonConvert.SerializeObject(obj);
}
```

---

## Complete Example: HTTP Client

```typescript
import { HttpClient } from "System.Net.Http";
import { Task } from "System.Threading.Tasks";

export class ApiClient {
  private client: HttpClient;

  constructor(baseUrl: string) {
    this.client = new HttpClient();
    this.client.BaseAddress = new Uri(baseUrl);
  }

  async get(path: string): Promise<string> {
    const response = await this.client.GetAsync(path);
    response.EnsureSuccessStatusCode();
    return await response.Content.ReadAsStringAsync();
  }

  async post(path: string, data: string): Promise<string> {
    const content = new StringContent(data);
    const response = await this.client.PostAsync(path, content);
    return await response.Content.ReadAsStringAsync();
  }
}

export async function main(): Promise<void> {
  const client = new ApiClient("https://api.example.com");
  const result = await client.get("/users");
  console.log(result);
}
```

---

## Type Declarations

Tsonic generates TypeScript type declarations (`.d.ts`) for .NET assemblies automatically. This gives you IntelliSense and type checking for all .NET APIs.

**Auto-generated for:**

- .NET BCL (Base Class Library)
- All NuGet packages you reference

**Example:**

```typescript
import { File } from "System.IO";
//       ^^^^
// IntelliSense shows: class File with all methods
```

---

## Common Patterns

### Reading JSON from File

```typescript
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

type Config = { host: string; port: number };

export function loadConfig(): Config {
  const json = File.ReadAllText("config.json");
  return JsonSerializer.Deserialize<Config>(json);
}
```

### Database with Dapper

```typescript
import { SqlConnection } from "System.Data.SqlClient";
import { Dapper } from "Dapper";

type User = { id: number; name: string };

export async function getUsers(connStr: string): Promise<User[]> {
  using (const conn = new SqlConnection(connStr)) {
    await conn.OpenAsync();
    return await conn.QueryAsync<User>("SELECT * FROM Users");
  }
}
```

### Logging

```typescript
import { ILogger } from "Microsoft.Extensions.Logging";

export class UserService {
  constructor(private logger: ILogger) {}

  processUser(id: number): void {
    this.logger.LogInformation(`Processing user ${id}`);
    // ... process ...
    this.logger.LogInformation("Done");
  }
}
```

---

## See Also

- [Type Mappings](type-mappings.md) - TypeScript ↔ C# type conversions
- [Runtime API](runtime.md) - Tsonic.Runtime helpers
- [Examples](../examples/dotnet.md) - Complete .NET integration examples
