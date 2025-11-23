# .NET Integration Reference

Complete guide to using .NET libraries from Tsonic.

---

## Overview

Tsonic provides seamless interop with the entire .NET ecosystem. Import and use any .NET library as if it were a TypeScript module.

**Key Benefits**:

- No FFI or wrapper code
- Full type safety
- Access to mature .NET libraries
- High performance native code

---

## Core Topics

### [Importing .NET Types](importing.md)

How to import .NET types and namespaces:

- Import syntax for .NET namespaces
- Namespace to directory mapping
- Importing generic types
- Importing nested types
- Static vs instance members

**Quick Example**:

```typescript
import { File, Directory, Path } from "System.IO";
import { HttpClient } from "System.Net.Http";
import { List } from "System.Collections.Generic";
```

### [Type Mappings](type-mappings.md)

How TypeScript types map to .NET types:

- Primitive type conversions
- Collection types (Array ↔ List)
- Nullable types
- Generic type arguments
- Interface implementations

**Key Mappings**:
| TypeScript | .NET | Notes |
|------------|------|-------|
| `number` | `double` | Always 64-bit float |
| `string` | `string` | UTF-16 |
| `boolean` | `bool` | Direct mapping |
| `Array<T>` | Can use `List<T>` | For .NET interop |

### [Ref and Out Parameters](ref-out.md)

Handling .NET methods with ref/out parameters:

- `TSByRef<T>` wrapper type
- Using out parameters (e.g., TryParse)
- Using ref parameters
- Pattern and best practices

**Quick Example**:

```typescript
import { TSByRef } from "_support/types";
import { Int32 } from "System";

const result: TSByRef<number> = { value: 0 };
const success = Int32.TryParse("42", result);
console.log(result.value); // 42
```

### [Explicit Interface Implementation](explicit-interfaces.md)

Calling explicitly implemented interface methods:

- When explicit implementation is used
- `As_<Interface>` pattern
- Common scenarios (IDisposable, etc.)

**Quick Example**:

```typescript
resource.As_IDisposable.Dispose();
```

### [Extension Methods](extension-methods.md)

Using C# extension methods (especially LINQ):

- Extension method syntax
- LINQ methods (Where, Select, etc.)
- Custom extension methods
- Method chaining

**Quick Example**:

```typescript
import { Enumerable } from "System.Linq";

const evens = Enumerable.Where(numbers, (n) => n % 2 === 0).ToArray();
```

### [Nested Types](nested-types.md)

Importing and using nested .NET types:

- `Outer$Inner` naming convention
- Multiple nesting levels
- Generic nested types

**Quick Example**:

```typescript
// .NET: System.Environment.SpecialFolder
import { Environment$SpecialFolder } from "System";
```

### [Support Types](support-types.md)

Special Tsonic types for .NET interop:

- `TSByRef<T>` - For ref/out parameters
- `TSUnsafePointer<T>` - For unsafe pointers
- `TSNullable<T>` - For nullable value types (future)
- `TSDelegate<T>` - For delegate types (future)

**Location**: `_support/types.d.ts`

### [Common Patterns](patterns.md)

Best practices for .NET interop:

- Resource management (IDisposable)
- Async/await with Tasks
- Working with collections
- Error handling (.NET exceptions)
- Generics and type safety

---

## Quick Reference

### Import Syntax

```typescript
// Single type
import { File } from "System.IO";

// Multiple types from same namespace
import { File, Directory, Path } from "System.IO";

// Generic type
import { List } from "System.Collections.Generic";
const list = new List<number>();

// Nested type
import { Environment$SpecialFolder } from "System";

// Note: NO .ts extension for .NET imports!
```

### Common .NET Libraries

#### File I/O (System.IO)

```typescript
import { File, Directory, Path } from "System.IO";

// Read file
const content = File.ReadAllText("file.txt");

// Write file
File.WriteAllText("output.txt", "Hello");

// Check existence
if (File.Exists("file.txt")) {
  // ...
}

// Path operations
const fullPath = Path.Combine("dir", "file.txt");
```

#### HTTP (System.Net.Http)

```typescript
import { HttpClient } from "System.Net.Http";

const client = new HttpClient();
const response = await client.GetStringAsync("https://api.example.com");
```

#### JSON (System.Text.Json)

```typescript
import { JsonSerializer } from "System.Text.Json";

interface User {
  name: string;
  age: number;
}

// Deserialize
const user = JsonSerializer.Deserialize<User>(json);

// Serialize
const json = JsonSerializer.Serialize(user);
```

#### Collections (System.Collections.Generic)

```typescript
import { List, Dictionary } from "System.Collections.Generic";

// List
const numbers = new List<number>();
numbers.Add(1);
numbers.Add(2);

// Dictionary
const dict = new Dictionary<string, number>();
dict.Add("one", 1);
dict.Add("two", 2);
```

#### LINQ (System.Linq)

```typescript
import { Enumerable } from "System.Linq";

const evens = Enumerable.Where(numbers, (n) => n % 2 === 0)
  .Select((n) => n * 2)
  .ToArray();
```

---

## Type Mapping Quick Reference

### Primitives

| TypeScript | .NET Input | .NET Output |
| ---------- | ---------- | ----------- |
| `number`   | `double`   | `double`    |
| `string`   | `string`   | `string`    |
| `boolean`  | `bool`     | `bool`      |

### Collections

| TypeScript | .NET              | Notes                    |
| ---------- | ----------------- | ------------------------ |
| `Array<T>` | `List<T>`         | For passing to .NET APIs |
| `Map<K,V>` | `Dictionary<K,V>` | Key-value pairs          |
| `Set<T>`   | `HashSet<T>`      | Unique values            |

### Special Cases

| TypeScript  | .NET          | Pattern                |
| ----------- | ------------- | ---------------------- |
| out param   | `TSByRef<T>`  | `{ value: T }` wrapper |
| ref param   | `TSByRef<T>`  | `{ value: T }` wrapper |
| Nested type | `Outer$Inner` | Dollar-sign separator  |

---

## Common Scenarios

### Reading/Writing Files

```typescript
import { File } from "System.IO";

// Read
const content = File.ReadAllText("config.json");

// Write
File.WriteAllText("output.txt", content);

// Lines
const lines = File.ReadAllLines("data.txt");
File.WriteAllLines("output.txt", lines);
```

### Making HTTP Requests

```typescript
import { HttpClient, StringContent } from "System.Net.Http";
import { Encoding } from "System.Text";

const client = new HttpClient();

// GET
const data = await client.GetStringAsync("https://api.example.com/data");

// POST
const json = '{"name": "Alice"}';
const content = new StringContent(json, Encoding.UTF8, "application/json");
const response = await client.PostAsync(
  "https://api.example.com/users",
  content
);
```

### Working with JSON

```typescript
import { JsonSerializer } from "System.Text.Json";
import { File } from "System.IO";

interface Config {
  host: string;
  port: number;
}

// Load JSON file
const json = File.ReadAllText("config.json");
const config = JsonSerializer.Deserialize<Config>(json);

// Save JSON file
const newConfig: Config = { host: "localhost", port: 8080 };
const jsonStr = JsonSerializer.Serialize(newConfig);
File.WriteAllText("config.json", jsonStr);
```

### Using LINQ

```typescript
import { Enumerable } from "System.Linq";

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Filter
const evens = Enumerable.Where(numbers, (n) => n % 2 === 0).ToArray();

// Map
const doubled = Enumerable.Select(numbers, (n) => n * 2).ToArray();

// Chain
const result = Enumerable.Where(numbers, (n) => n > 5)
  .Select((n) => n * 2)
  .OrderByDescending((n) => n)
  .ToArray();

// Aggregate
const sum = Enumerable.Sum(numbers);
const max = Enumerable.Max(numbers);
```

---

## Error Handling

### .NET Exceptions

.NET methods may throw exceptions. Use try-catch:

```typescript
import { File } from "System.IO";

try {
  const content = File.ReadAllText("file.txt");
  console.log(content);
} catch (error) {
  console.log(`Error reading file: ${error}`);
}
```

### Checking Before Calling

```typescript
import { File } from "System.IO";

if (File.Exists("file.txt")) {
  const content = File.ReadAllText("file.txt");
} else {
  console.log("File not found");
}
```

---

## Performance Considerations

### 1. Avoid Boxing

```typescript
// ✅ GOOD - Generic preserves type
const list = new List<number>();
list.Add(42);

// ❌ BAD - Boxing to object
const list = new List<object>();
list.Add(42); // Boxes to object
```

### 2. Use Appropriate Collections

```typescript
// ✅ GOOD - List for sequential access
const list = new List<number>();

// ✅ GOOD - Dictionary for key lookup
const dict = new Dictionary<string, number>();

// ❌ BAD - Array for frequent additions
const arr: number[] = [];
for (let i = 0; i < 10000; i++) {
  arr.push(i); // Slow for large arrays
}
```

### 3. Reuse HttpClient

```typescript
// ✅ GOOD - Reuse client
const client = new HttpClient();
const data1 = await client.GetStringAsync(url1);
const data2 = await client.GetStringAsync(url2);

// ❌ BAD - Create new client each time
const data1 = await new HttpClient().GetStringAsync(url1);
const data2 = await new HttpClient().GetStringAsync(url2);
```

---

## See Also

- **[Guide: Using .NET Libraries](../../guide/03-using-dotnet.md)** - Tutorial introduction
- **[Language Reference](../language/INDEX.md)** - TypeScript language features
- **[Runtime API](../runtime/INDEX.md)** - Tsonic.Runtime reference
- **[Cookbook](../../cookbook/INDEX.md)** - Common .NET patterns
- **[.NET API Browser](https://learn.microsoft.com/en-us/dotnet/api/)** - Official .NET documentation
