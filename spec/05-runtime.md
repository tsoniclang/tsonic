# Tsonic.Runtime Specification

**Target:** C# 14 (.NET 10+) - All C# 14 features are available.

## Design Principles

1. **JavaScript Semantics**: Custom types (like `Tsonic.Runtime.Array<T>`) implement exact JavaScript behavior
2. **Sparse Array Support**: Arrays must support holes/gaps (e.g., `arr[10] = 42` when `arr.length` was 0)
3. **Native Types Where Appropriate**: `string` and `double` use native C# types
4. **Static Helpers for Native Types**: String methods rewritten to static helpers
5. **Instance Methods for Custom Types**: Array methods are instance methods on `Tsonic.Runtime.Array<T>`
6. **Clean Separation**: Tsonic types and C# types don't mix - NO automatic conversions
7. **Explicit Conversions Only**: When interop requires it, use explicit helpers (`.ToArray()`, constructors) - never implicit

**Clarification on conversions:**

- ❌ **NO** automatic conversions: `Tsonic.Runtime.Array<T>` is not implicitly convertible to `List<T>` or `T[]`
- ✅ **Explicit helpers allowed**: Use `.ToArray()` when calling .NET APIs that expect `T[]`
- ✅ **Constructor conversion**: C# types can be passed to constructors: `new List<T>(csharpArray)`
- 🎯 **General rule**: If you use C# types (via imports), use C# methods on them. If you use Tsonic types, use JavaScript-style methods.

## Runtime Organization

```
Tsonic.Runtime/
├── parseInt(string, int?)          - Global functions at root level
├── parseFloat(string)
├── isNaN(double)
├── isFinite(double)
│
├── Array<T>                         - Class with instance methods (NOT static)
│   ├── push(T item)                 - Instance method
│   ├── pop()                        - Instance method
│   ├── shift()                      - Instance method
│   ├── length                       - Property
│   ├── slice()                      - Returns new Array<T>
│   └── ...
│
├── String                           - Static class for string operations
│   ├── toUpperCase(string)          - Static helper (string is native C#)
│   ├── toLowerCase(string)          - Static helper
│   ├── substring(string, int, int?) - Static helper
│   ├── split(string, string)        - Returns Tsonic.Runtime.Array<string>
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

## Array Class

`Tsonic.Runtime.Array<T>` is a **class** that implements JavaScript array semantics, including sparse arrays:

```csharp
namespace Tsonic.Runtime
{
    public class Array<T> : IEnumerable<T>
    {
        // Internal storage - supports sparse arrays
        private Dictionary<int, T> _items;
        private int _length;

        // Constructors
        public Array() { _items = new Dictionary<int, T>(); _length = 0; }
        public Array(params T[] items) { /* initialize from params */ }

        // Property
        public int length
        {
            get => _length;
            set { /* Setting length can truncate or expand */ }
        }

        // Indexer - supports sparse arrays
        // Note: For MVP, holes return default(T) instead of undefined
        // This means 0 for numbers, null for reference types
        // TODO: Use Nullable<T> or Option<T> for proper undefined semantics
        public T this[int index]
        {
            get => _items.ContainsKey(index) ? _items[index] : default(T);
            set
            {
                _items[index] = value;
                if (index >= _length) _length = index + 1;
            }
        }

        // Instance methods - NOT static!
        public void push(T item)
        {
            _items[_length] = item;
            _length++;
        }

        public T pop()
        {
            if (_length == 0) return default(T);
            _length--;
            T item = _items.ContainsKey(_length) ? _items[_length] : default(T);
            _items.Remove(_length);
            return item;
        }

        public T shift()
        {
            if (_length == 0) return default(T);
            T item = _items.ContainsKey(0) ? _items[0] : default(T);
            // Shift all items down
            for (int i = 0; i < _length - 1; i++)
            {
                if (_items.ContainsKey(i + 1))
                    _items[i] = _items[i + 1];
                else
                    _items.Remove(i);
            }
            _items.Remove(_length - 1);
            _length--;
            return item;
        }

        public void unshift(T item)
        {
            // Shift all items up
            for (int i = _length; i > 0; i--)
            {
                if (_items.ContainsKey(i - 1))
                    _items[i] = _items[i - 1];
            }
            _items[0] = item;
            _length++;
        }

        public Array<T> slice(int start = 0, int? end = null)
        {
            int actualStart = start < 0 ? Math.Max(0, _length + start) : start;
            int actualEnd = end.HasValue
                ? (end.Value < 0 ? Math.Max(0, _length + end.Value) : end.Value)
                : _length;

            var result = new Array<T>();
            for (int i = actualStart; i < actualEnd && i < _length; i++)
            {
                if (_items.ContainsKey(i))
                    result.push(_items[i]);
            }
            return result;
        }

        public int indexOf(T searchElement, int fromIndex = 0)
        {
            for (int i = fromIndex; i < _length; i++)
            {
                if (_items.ContainsKey(i) && EqualityComparer<T>.Default.Equals(_items[i], searchElement))
                    return i;
            }
            return -1;
        }

        public bool includes(T searchElement)
        {
            return indexOf(searchElement) >= 0;
        }

        public string join(string separator = ",")
        {
            var parts = new List<string>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                    parts.Add(_items[i]?.ToString() ?? "");
                else
                    parts.Add(""); // Sparse array hole
            }
            return string.Join(separator, parts);
        }

        public void reverse()
        {
            // Reverse the items in-place
            var temp = new Dictionary<int, T>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                    temp[_length - 1 - i] = _items[i];
            }
            _items = temp;
        }

        // IEnumerable<T> implementation for foreach, LINQ, JSON serialization
        public IEnumerator<T> GetEnumerator()
        {
            for (int i = 0; i < _length; i++)
            {
                yield return _items.ContainsKey(i) ? _items[i] : default(T);
            }
        }

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator()
        {
            return GetEnumerator();
        }

        // Helper for JSON serialization and .NET interop
        public T[] ToArray()
        {
            var result = new T[_length];
            for (int i = 0; i < _length; i++)
            {
                result[i] = _items.ContainsKey(i) ? _items[i] : default(T);
            }
            return result;
        }
    }
}
```

**Important Notes:**

- **Instance methods**: Array<T> is a class - methods are called on instances, not static helpers
- **Sparse array support**: Uses `Dictionary<int, T>` internally to support holes
- **Holes behavior (MVP)**: Accessing holes returns `default(T)` (0 for numbers, null for references) instead of true undefined. This is a known limitation.
- **Higher-order methods**: `map`, `filter`, `reduce` require lambda support - planned for Phase 4+
- **IEnumerable<T>**: Array<T> implements IEnumerable<T> for .NET interop (foreach loops, LINQ compatibility)
- **JSON serialization**: Use `.ToArray()` when needed: `JsonSerializer.Serialize(arr.ToArray())` or implement custom JsonConverter for direct serialization
- **C# array interop**: Use `.ToArray()` to convert to `T[]` when calling .NET APIs that expect native arrays

**Usage Examples:**

```typescript
const arr: number[] = [1, 2, 3];
arr.push(4);
const first = arr.shift();
```

```csharp
var arr = new Tsonic.Runtime.Array<double>(1, 2, 3);
arr.push(4);  // Instance method
double first = arr.shift();  // Instance method
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
        public static Tsonic.Runtime.Array<string> split(string str, string separator, int? limit = null)
        {
            string[] parts = str.Split(new[] { separator }, StringSplitOptions.None);
            if (limit.HasValue && parts.Length > limit.Value)
            {
                string[] limited = new string[limit.Value];
                System.Array.Copy(parts, limited, limit.Value);
                return new Tsonic.Runtime.Array<string>(limited);
            }
            return new Tsonic.Runtime.Array<string>(parts);
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
using Tsonic.Runtime;

public static double processItems(Tsonic.Runtime.Array<string> items)
{
    items.push("new item");  // Instance method
    string first = items.shift();  // Instance method
    Tsonic.Runtime.console.log("Removed:", first);
    return items.length;
}

var arr = new Tsonic.Runtime.Array<string>("a", "b", "c");
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

var items = new Tsonic.Runtime.Array<byte>(1, 2, 3, 4, 5);
int total = 0;

foreach (byte item in items)
{
    total = total + item;
}
```

## Summary

- **No wrapper classes**: All types are native .NET types
- **Static helpers only**: JavaScript semantics via `Tsonic.Runtime` functions
- **Clean boundaries**: Explicit conversions at .NET library boundaries
- **Type safety**: Strict typing with no `any` support
- **Performance**: Native .NET performance with NativeAOT compilation
