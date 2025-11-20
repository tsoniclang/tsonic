# Tsonic.Runtime Specification

**Target:** C# 14 (.NET 10+) - All C# 14 features are available.

## Design Principles

1. **Native Types First**: Arrays use native `List<T>`, strings use native `string`, numbers use native `double`
2. **JavaScript Semantics via Static Helpers**: Static helper classes (like `Tsonic.Runtime.Array`) provide exact JavaScript behavior
3. **Sparse Array Support**: Arrays support holes/gaps (e.g., `arr[10] = 42` when `arr.length` was 0) via static helper logic
4. **Static Helpers Pattern**: All JavaScript methods are static helpers operating on native types
5. **Seamless .NET Interop**: Native types enable direct use with .NET APIs without conversion
6. **No Wrapper Classes**: TypeScript arrays are `List<T>`, not custom wrapper classes
7. **Explicit API Surface**: Clear separation between JavaScript semantics (static helpers) and native operations

**Key Design:**

- ✅ **Native storage**: `List<T>` for arrays, `string` for strings, `double` for numbers
- ✅ **JavaScript semantics**: `Tsonic.Runtime.Array.push(arr, item)` provides JS behavior
- ✅ **Direct interop**: Pass `List<T>` directly to .NET APIs that accept `IList<T>`, `IEnumerable<T>`, etc.
- ✅ **Conversion helpers**: Use `.ToArray()` when .NET APIs require `T[]` specifically
- 🎯 **General rule**: TypeScript uses static helpers for JS semantics, imported .NET types use their native methods

## Runtime Organization

```
Tsonic.Runtime/
├── parseInt(string, int?)          - Global functions at root level
├── parseFloat(string)
├── isNaN(double)
├── isFinite(double)
│
├── Array                            - Static class for array operations on List<T>
│   ├── push<T>(List<T>, T)          - Static helper (List<T> is native C#)
│   ├── pop<T>(List<T>)              - Static helper
│   ├── shift<T>(List<T>)            - Static helper
│   ├── length<T>(List<T>)           - Static helper (returns Count)
│   ├── slice<T>(List<T>, int, int?) - Returns new List<T>
│   ├── map<T,R>(List<T>, Func...)   - Returns new List<R>
│   └── ... (45+ array methods)
│
├── String                           - Static class for string operations
│   ├── toUpperCase(string)          - Static helper (string is native C#)
│   ├── toLowerCase(string)          - Static helper
│   ├── substring(string, int, int?) - Static helper
│   ├── split(string, string)        - Returns List<string>
│   └── ...
│
├── Operators                        - Static class for operators
│   ├── typeof(object?)              - typeof operator implementation
│   └── instanceof(object?, Type)
│
├── Math                             - Static class (namespace object)
│   ├── floor(double)
│   ├── random()
│   └── ...
│
├── JSON                             - Static class (namespace object)
│   ├── parse<T>(string)
│   └── stringify(object)
│
└── console                          - Static class (namespace object)
    ├── log(params object[])
    └── ...
```

## Global Functions

Functions available at `Tsonic.Runtime` root level (NOT in a Globals class):

```csharp
namespace Tsonic.Runtime
{
    // Parsing functions
    public static double parseInt(string str, int? radix = null);
    public static double parseFloat(string str);

    // Type checking functions
    public static bool isNaN(double value);
    public static bool isFinite(double value);

    // Encoding/decoding
    public static string encodeURI(string uri);
    public static string decodeURI(string uri);
    public static string encodeURIComponent(string component);
    public static string decodeURIComponent(string component);
}
```

**Usage:**

```typescript
const num = parseInt("42", 10);
```

```csharp
double num = Tsonic.Runtime.parseInt("42", 10);
```

## Array Static Helpers

`Tsonic.Runtime.Array` is a **static class** that provides JavaScript array semantics for native `List<T>`:

```csharp
namespace Tsonic.Runtime
{
    public static class Array
    {
        // Index access helpers
        public static T get<T>(List<T> arr, int index)
        {
            if (index < 0 || index >= arr.Count)
                return default(T)!;
            return arr[index];
        }

        public static void set<T>(List<T> arr, int index, T value)
        {
            // Fill gaps with default(T) for sparse array support
            while (arr.Count <= index)
                arr.Add(default(T)!);
            arr[index] = value;
        }

        // Length helpers
        public static int length<T>(List<T> arr) => arr.Count;

        public static void setLength<T>(List<T> arr, int newLength)
        {
            if (newLength < arr.Count)
                arr.RemoveRange(newLength, arr.Count - newLength);
            else
                while (arr.Count < newLength)
                    arr.Add(default(T)!);
        }

        // Mutation methods
        public static void push<T>(List<T> arr, T item) => arr.Add(item);

        public static T pop<T>(List<T> arr)
        {
            if (arr.Count == 0) return default(T)!;
            T item = arr[arr.Count - 1];
            arr.RemoveAt(arr.Count - 1);
            return item;
        }

        public static T shift<T>(List<T> arr)
        {
            if (arr.Count == 0) return default(T)!;
            T item = arr[0];
            arr.RemoveAt(0);
            return item;
        }

        public static void unshift<T>(List<T> arr, T item) => arr.Insert(0, item);

        // Non-mutating methods
        public static List<T> slice<T>(List<T> arr, int start = 0, int? end = null)
        {
            int actualStart = start < 0 ? Math.Max(0, arr.Count + start) : start;
            int actualEnd = end ?? arr.Count;
            if (actualStart >= actualEnd) return new List<T>();
            return arr.GetRange(actualStart, Math.Min(actualEnd - actualStart, arr.Count - actualStart));
        }

        // Higher-order functions
        public static List<TResult> map<T, TResult>(List<T> arr, Func<T, int, List<T>, TResult> callback)
        {
            var result = new List<TResult>(arr.Count);
            for (int i = 0; i < arr.Count; i++)
                result.Add(callback(arr[i], i, arr));
            return result;
        }

        public static List<T> filter<T>(List<T> arr, Func<T, int, List<T>, bool> callback)
        {
            var result = new List<T>();
            for (int i = 0; i < arr.Count; i++)
                if (callback(arr[i], i, arr))
                    result.Add(arr[i]);
            return result;
        }

        // Search methods
        public static int indexOf<T>(List<T> arr, T searchElement, int fromIndex = 0)
        {
            for (int i = fromIndex; i < arr.Count; i++)
                if (EqualityComparer<T>.Default.Equals(arr[i], searchElement))
                    return i;
            return -1;
        }

        public static bool includes<T>(List<T> arr, T searchElement) => indexOf(arr, searchElement) >= 0;

        // Conversion methods
        public static string join<T>(List<T> arr, string separator = ",")
        {
            return string.Join(separator, arr.Select(x => x?.ToString() ?? ""));
        }

        // Mutation methods (continued)
        public static void reverse<T>(List<T> arr) => arr.Reverse();

        // ... 35+ more methods (see tsonic-runtime Array.cs for complete implementation)
    }
}
```

**Important Notes:**

- **Static helpers**: All array methods are static functions operating on native `List<T>`
- **Sparse array support**: Gaps are filled with `default(T)` (0 for numbers, null for references)
- **Holes behavior**: Accessing beyond length returns `default(T)` - JavaScript-compatible semantics
- **Higher-order methods**: `map`, `filter`, `reduce`, `forEach` fully supported with lambda functions
- **Native interop**: `List<T>` works directly with .NET APIs - no conversion needed
- **LINQ compatibility**: `List<T>` implements `IEnumerable<T>` natively
- **Performance**: Uses native `List<T>` operations for optimal performance

**Usage Examples:**

```typescript
const arr: number[] = [1, 2, 3];
arr.push(4);
const first = arr.shift();
const doubled = arr.map((x) => x * 2);
```

```csharp
var arr = new List<double> { 1, 2, 3 };
Tsonic.Runtime.Array.push(arr, 4);  // Static helper
double first = Tsonic.Runtime.Array.shift(arr);  // Static helper
var doubled = Tsonic.Runtime.Array.map(arr, (x, i, a) => x * 2);
```

**Sparse Array Example:**

```typescript
const sparse: number[] = [];
sparse[10] = 42;
console.log(sparse.length); // 11
console.log(sparse[5]); // undefined (0 in C#)
```

```csharp
var sparse = new List<double>();
Tsonic.Runtime.Array.set(sparse, 10, 42); // Fills 0-9 with 0.0
Tsonic.Runtime.console.log(sparse.Count); // 11
Tsonic.Runtime.console.log(sparse[5]); // 0.0 (default for double)
```

## String Operations

Static helper class that operates on native C# `string`:

```csharp
namespace Tsonic.Runtime
{
    public static class String
    {
        // Case conversion
        public static string toUpperCase(string str)
        {
            return str.ToUpper();
        }

        public static string toLowerCase(string str)
        {
            return str.ToLower();
        }

        // Trimming
        public static string trim(string str)
        {
            return str.Trim();
        }

        public static string trimStart(string str)
        {
            return str.TrimStart();
        }

        public static string trimEnd(string str)
        {
            return str.TrimEnd();
        }

        // Substring operations
        public static string substring(string str, int start, int? end = null)
        {
            int actualEnd = end ?? str.Length;
            int length = Math.Max(0, actualEnd - start);
            return str.Substring(start, Math.Min(length, str.Length - start));
        }

        public static string slice(string str, int start, int? end = null)
        {
            int len = str.Length;
            int actualStart = start < 0 ? Math.Max(0, len + start) : Math.Min(start, len);
            int actualEnd = end.HasValue
                ? (end.Value < 0 ? Math.Max(0, len + end.Value) : Math.Min(end.Value, len))
                : len;

            return str.Substring(actualStart, Math.Max(0, actualEnd - actualStart));
        }

        // Searching
        public static int indexOf(string str, string searchString, int position = 0)
        {
            return str.IndexOf(searchString, position);
        }

        public static int lastIndexOf(string str, string searchString, int? position = null)
        {
            return position.HasValue
                ? str.LastIndexOf(searchString, position.Value)
                : str.LastIndexOf(searchString);
        }

        public static bool startsWith(string str, string searchString)
        {
            return str.StartsWith(searchString);
        }

        public static bool endsWith(string str, string searchString)
        {
            return str.EndsWith(searchString);
        }

        public static bool includes(string str, string searchString)
        {
            return str.Contains(searchString);
        }

        // Manipulation
        public static string replace(string str, string search, string replacement)
        {
            return str.Replace(search, replacement);
        }

        public static string repeat(string str, int count)
        {
            return string.Concat(Enumerable.Repeat(str, count));
        }

        public static string padStart(string str, int targetLength, string padString = " ")
        {
            return str.PadLeft(targetLength, padString[0]);
        }

        public static string padEnd(string str, int targetLength, string padString = " ")
        {
            return str.PadRight(targetLength, padString[0]);
        }

        // Character access
        public static string charAt(string str, int index)
        {
            return index >= 0 && index < str.Length ? str[index].ToString() : "";
        }

        public static double charCodeAt(string str, int index)
        {
            return index >= 0 && index < str.Length ? (double)str[index] : double.NaN;
        }

        // Splitting
        public static List<string> split(string str, string separator, int? limit = null)
        {
            string[] parts = str.Split(new[] { separator }, StringSplitOptions.None);
            if (limit.HasValue && parts.Length > limit.Value)
            {
                string[] limited = new string[limit.Value];
                System.Array.Copy(parts, limited, limit.Value);
                return new List<string>(limited);
            }
            return new List<string>(parts);
        }

        // Properties
        public static int length(string str)
        {
            return str.Length;
        }
    }
}
```

**Important Notes:**

- **NOT a class to instantiate**: `Tsonic.Runtime.String` is purely static helpers
- **Operates on native string**: All methods take `string` as first parameter
- **Returns native string**: All methods return C# `string`, not wrapper

**Usage Examples:**

```typescript
const name = "john doe";
const upper = name.toUpperCase();
const parts = name.split(" ");
```

```csharp
string name = "john doe";
string upper = Tsonic.Runtime.String.toUpperCase(name);
List<string> parts = Tsonic.Runtime.String.split(name, " ");
```

## Operators

JavaScript operators that need runtime support:

```csharp
namespace Tsonic.Runtime
{
    public static class Operators
    {
        // typeof operator
        public static string typeof(object? value)
        {
            if (value == null) return "undefined";
            if (value is string) return "string";
            if (value is double || value is int || value is float || value is long) return "number";
            if (value is bool) return "boolean";
            if (value is Delegate) return "function";
            return "object";
        }

        // instanceof operator
        public static bool instanceof(object? obj, Type type)
        {
            if (obj == null) return false;
            return type.IsAssignableFrom(obj.GetType());
        }
    }
}
```

**Usage:**

```typescript
if (typeof x === "string") {
  console.log("It's a string");
}
```

```csharp
if (Tsonic.Runtime.Operators.typeof(x) == "string")
{
    Tsonic.Runtime.console.log("It's a string");
}
```

## console

Console logging functions (lowercase class name to match JavaScript):

```csharp
namespace Tsonic.Runtime
{
    public static class console
    {
        public static void log(params object[] data)
        {
            Console.WriteLine(string.Join(" ", data));
        }

        public static void error(params object[] data)
        {
            Console.Error.WriteLine(string.Join(" ", data));
        }

        public static void warn(params object[] data)
        {
            Console.WriteLine("WARN: " + string.Join(" ", data));
        }

        public static void info(params object[] data)
        {
            Console.WriteLine(string.Join(" ", data));
        }
    }
}
```

**Usage:**

```typescript
console.log("Hello", "World");
console.error("Something went wrong");
```

```csharp
Tsonic.Runtime.console.log("Hello", "World");
Tsonic.Runtime.console.error("Something went wrong");
```

## Math

JavaScript Math namespace functions:

```csharp
namespace Tsonic.Runtime
{
    public static class Math
    {
        // Constants
        public const double E = 2.718281828459045;
        public const double PI = 3.141592653589793;
        public const double LN2 = 0.6931471805599453;
        public const double LN10 = 2.302585092994046;
        public const double LOG2E = 1.4426950408889634;
        public const double LOG10E = 0.4342944819032518;
        public const double SQRT1_2 = 0.7071067811865476;
        public const double SQRT2 = 1.4142135623730951;

        // Common methods
        public static double abs(double x) => System.Math.Abs(x);
        public static double ceil(double x) => System.Math.Ceiling(x);
        public static double floor(double x) => System.Math.Floor(x);
        public static double round(double x) => System.Math.Round(x);
        public static double sqrt(double x) => System.Math.Sqrt(x);
        public static double pow(double x, double y) => System.Math.Pow(x, y);

        public static double max(params double[] values) => values.Max();
        public static double min(params double[] values) => values.Min();

        // Trigonometric
        public static double sin(double x) => System.Math.Sin(x);
        public static double cos(double x) => System.Math.Cos(x);
        public static double tan(double x) => System.Math.Tan(x);
        public static double asin(double x) => System.Math.Asin(x);
        public static double acos(double x) => System.Math.Acos(x);
        public static double atan(double x) => System.Math.Atan(x);
        public static double atan2(double y, double x) => System.Math.Atan2(y, x);

        // Random
        private static Random _random = new Random();
        public static double random() => _random.NextDouble();
    }
}
```

**Usage:**

```typescript
const pi = Math.PI;
const max = Math.max(10, 20, 30);
const rand = Math.random();
```

```csharp
double pi = Tsonic.Runtime.Math.PI;
double max = Tsonic.Runtime.Math.max(10, 20, 30);
double rand = Tsonic.Runtime.Math.random();
```

## JSON

JSON parsing and stringification:

```csharp
using System.Text.Json;

namespace Tsonic.Runtime
{
    public static class JSON
    {
        public static T parse<T>(string text)
        {
            return JsonSerializer.Deserialize<T>(text);
        }

        public static string stringify(object value)
        {
            return JsonSerializer.Serialize(value);
        }
    }
}
```

**Usage:**

```typescript
type User = { id: int; name: string };

const json = JSON.stringify({ id: 1, name: "John" });
const user: User = JSON.parse(json);
```

```csharp
var json = Tsonic.Runtime.JSON.stringify(new { id = 1, name = "John" });
User user = Tsonic.Runtime.JSON.parse<User>(json);
```

## Not Supported in MVP

These features are not available in MVP and will error:

### Array Methods

Higher-order array methods require lambda/callback support (planned for Phase 4+):

- ⏳ `arr.map(callback)` - Planned, requires lambda support - Use for loop with result array for now
- ⏳ `arr.filter(callback)` - Planned, requires lambda support - Use for loop with condition for now
- ⏳ `arr.reduce(callback, initial)` - Planned, requires lambda support - Use for loop with accumulator for now
- ⏳ `arr.forEach(callback)` - Planned, requires lambda support - Use for...of loop for now

Note: Basic array methods without callbacks (push, pop, shift, unshift, slice, indexOf, includes, join) are fully supported.

### Built-In Types

Use .NET equivalents:

- ❌ `Date` - Use `System.DateTime`
- ❌ `Map<K,V>` - Use `Dictionary<K,V>`
- ❌ `Set<T>` - Use `HashSet<T>`
- ❌ `RegExp` - Use `System.Text.RegularExpressions.Regex`
- ❌ `Symbol` - Not supported
- ❌ `BigInt` - Not supported

### Object Methods

Not needed with static typing:

- ❌ `Object.keys()` - Know the type structure at compile time
- ❌ `Object.values()` - Know the type structure at compile time
- ❌ `Object.entries()` - Know the type structure at compile time

## Complete Usage Examples

### Example 1: String Operations

**TypeScript:**

```typescript
function formatName(first: string, last: string): string {
  const full = `${first} ${last}`;
  return full.toUpperCase().trim();
}

const name = formatName("  john  ", "doe");
const parts = name.split(" ");
console.log("Parts:", parts.length);
```

**Generated C#:**

```csharp
using System.Collections.Generic;
using Tsonic.Runtime;

public static string formatName(string first, string last)
{
    string full = $"{first} {last}";
    return Tsonic.Runtime.String.trim(Tsonic.Runtime.String.toUpperCase(full));
}

string name = formatName("  john  ", "doe");
var parts = Tsonic.Runtime.String.split(name, " ");
Tsonic.Runtime.console.log("Parts:", parts.length);
```

### Example 2: Array Operations

**TypeScript:**

```typescript
function processItems(items: string[]): number {
  items.push("new item");
  const first = items.shift();
  console.log("Removed:", first);
  return items.length;
}

const arr: string[] = ["a", "b", "c"];
const count = processItems(arr);
```

**Generated C#:**

```csharp
using System.Collections.Generic;
using Tsonic.Runtime;

public static double processItems(List<string> items)
{
    Tsonic.Runtime.Array.push(items, "new item");  // Static helper
    string first = Tsonic.Runtime.Array.shift(items);  // Static helper
    Tsonic.Runtime.console.log("Removed:", first);
    return Tsonic.Runtime.Array.length(items);
}

var arr = new List<string> { "a", "b", "c" };
double count = processItems(arr);
```

### Example 3: .NET Interop with Boundaries

**TypeScript:**

```typescript
import { File } from "System.IO";
import { List } from "System.Collections.Generic";

function processFile(path: string): void {
  // C# returns string[], becomes ReadonlyArray<string>
  const lines = File.ReadAllLines(path);

  // C# List with C# methods
  const mutable = new List<string>(lines);
  mutable.Add("// End of file"); // C# method

  // C# method expects T[], so convert
  File.WriteAllLines(path, mutable.ToArray());
}
```

**Generated C#:**

```csharp
using System.IO;
using System.Collections.Generic;

public static void processFile(string path)
{
    // C# returns string[]
    string[] lines = File.ReadAllLines(path);

    // C# List
    List<string> mutable = new List<string>(lines);
    mutable.Add("// End of file"); // C# method

    // C# to C# conversion
    File.WriteAllLines(path, mutable.ToArray());
}
```

### Example 4: Type Guards with unknown

**TypeScript:**

```typescript
function process(value: unknown): string {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  if (typeof value === "number") {
    return `Number: ${value}`;
  }
  return "Unknown";
}
```

**Generated C#:**

```csharp
using Tsonic.Runtime;

public static string process(object? value)
{
    if (Tsonic.Runtime.Operators.typeof(value) == "string")
    {
        return Tsonic.Runtime.String.toUpperCase((string)value);
    }
    if (Tsonic.Runtime.Operators.typeof(value) == "number")
    {
        return $"Number: {(double)value}";
    }
    return "Unknown";
}
```

### Example 5: JSON with Explicit Types

**TypeScript:**

```typescript
type Config = {
  host: string;
  port: int;
  enabled: boolean;
};

function loadConfig(json: string): Config {
  const config: Config = JSON.parse(json);
  return config;
}

function saveConfig(config: Config): string {
  return JSON.stringify(config);
}
```

**Generated C#:**

```csharp
using Tsonic.Runtime;

public class Config
{
    public string host { get; set; }
    public int port { get; set; }
    public bool enabled { get; set; }
}

public static Config loadConfig(string json)
{
    Config config = Tsonic.Runtime.JSON.parse<Config>(json);
    return config;
}

public static string saveConfig(Config config)
{
    return Tsonic.Runtime.JSON.stringify(config);
}
```

### Example 6: Using C# Numeric Types

**TypeScript:**

```typescript
function calculateTotal(price: decimal, quantity: int): decimal {
  return price * quantity;
}

const items: byte[] = [1, 2, 3, 4, 5];
let total: int = 0;

for (const item of items) {
  total = total + item;
}
```

**Generated C#:**

```csharp
using Tsonic.Runtime;

public static decimal calculateTotal(decimal price, int quantity)
{
    return price * quantity;
}

var items = new List<byte> { 1, 2, 3, 4, 5 };
int total = 0;

foreach (byte item in items)
{
    total = total + item;
}
```

## Async/Await Support

Tsonic provides full support for async/await with TypeScript `Promise<T>` mapping to .NET `Task<T>`.

### Supported Async Features

#### Basic Async/Await

```typescript
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return await response.json();
}
```

Emits:

```csharp
public static async Task<User> fetchUser(double id)
{
    var response = await fetch($"/api/users/{id}");
    return await response.json();
}
```

#### Promise<void> → Task

```typescript
async function saveData(): Promise<void> {
  await writeFile("data.json", data);
}
```

Emits:

```csharp
public static async Task saveData()
{
    await writeFile("data.json", data);
}
```

#### Multiple Await Expressions

```typescript
async function processAll() {
  const users = await fetchUsers();
  const posts = await fetchPosts();
  return { users, posts };
}
```

Emits:

```csharp
public static async Task<dynamic> processAll()
{
    var users = await fetchUsers();
    var posts = await fetchPosts();
    return new { users, posts };
}
```

#### Async Try/Catch/Finally

```typescript
async function safeFetch(): Promise<string> {
  try {
    return await fetchData();
  } catch (error) {
    console.log("Error:", error);
    return "default";
  } finally {
    cleanup();
  }
}
```

Emits:

```csharp
public static async Task<string> safeFetch()
{
    try
    {
        return await fetchData();
    }
    catch (var error)
    {
        Console.WriteLine("Error:", error);
        return "default";
    }
    finally
    {
        cleanup();
    }
}
```

#### Async Generators

```typescript
async function* generateNumbers(): AsyncIterableIterator<number> {
  for (let i = 0; i < 10; i++) {
    await delay(100);
    yield i;
  }
}
```

Emits:

```csharp
public static async IAsyncEnumerable<generateNumbers_exchange> generateNumbers()
{
    var exchange = new generateNumbers_exchange();
    for (var i = 0.0; i < 10.0; i++)
    {
        await delay(100.0);
        exchange.Output = i;
        yield return exchange;
    }
}
```

### Unsupported Promise Features

The following Promise methods are **not supported** and will emit diagnostic TSN3011:

- `Promise.then(callback)` - Use async/await
- `Promise.catch(callback)` - Use try/catch with async/await
- `Promise.finally(callback)` - Use finally block with async/await

**Rationale:** Tsonic maps `Promise<T>` to .NET `Task<T>`, which uses async/await pattern rather than chaining.

### Promise Combinators

Promise combinator methods (`Promise.all`, `Promise.race`, `Promise.any`, `Promise.allSettled`) are **not currently implemented**. Use .NET Task equivalents:

| TypeScript                         | .NET Equivalent                  |
| ---------------------------------- | -------------------------------- |
| `await Promise.all([p1, p2, p3])`  | `await Task.WhenAll(p1, p2, p3)` |
| `await Promise.race([p1, p2, p3])` | `await Task.WhenAny(p1, p2, p3)` |
| `Promise.any()`                    | Custom implementation needed     |
| `Promise.allSettled()`             | Custom implementation needed     |

**Example:**

```typescript
import { Task } from "System.Threading.Tasks";

async function fetchAll() {
  const tasks = [fetchUser(1), fetchUser(2), fetchUser(3)];
  const results = await Task.WhenAll(tasks);
  return results;
}
```

### Type Mappings

| TypeScript             | C#             |
| ---------------------- | -------------- |
| `Promise<string>`      | `Task<string>` |
| `Promise<number>`      | `Task<double>` |
| `Promise<void>`        | `Task`         |
| `Promise<T>`           | `Task<T>`      |
| No return type + async | `Task`         |

### System Namespaces

Async functions automatically include:

```csharp
using System.Threading.Tasks;
```

Async generators additionally include:

```csharp
using System.Collections.Generic;
```

## Summary

- **No wrapper classes**: All types are native .NET types
- **Static helpers only**: JavaScript semantics via `Tsonic.Runtime` functions
- **Clean boundaries**: Explicit conversions at .NET library boundaries
- **Type safety**: Strict typing with no `any` support
- **Performance**: Native .NET performance with NativeAOT compilation
- **Async/Await**: Full support with Promise<T> → Task<T> mapping
