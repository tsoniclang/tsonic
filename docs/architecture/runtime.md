# Runtime Libraries

Tsonic uses two .NET runtime libraries to support TypeScript semantics.

## Overview

| Package | Purpose | Required |
|---------|---------|----------|
| `Tsonic.Runtime` | TypeScript language primitives | Always |
| `Tsonic.JSRuntime` | JavaScript built-in semantics | Only in `js` mode |

## Tsonic.Runtime

TypeScript language features that don't exist in C#.

### Union Types

TypeScript unions don't exist in C#:

```csharp
namespace Tsonic.Runtime
{
    public sealed class Union<T1, T2>
    {
        private readonly object? _value;
        private readonly int _index;

        private Union(object? value, int index)
        {
            _value = value;
            _index = index;
        }

        public static Union<T1, T2> From1(T1 value) => new(value, 0);
        public static Union<T1, T2> From2(T2 value) => new(value, 1);

        public bool Is1() => _index == 0;
        public bool Is2() => _index == 1;

        public T1 As1() => _index == 0 ? (T1)_value! : throw new InvalidOperationException();
        public T2 As2() => _index == 1 ? (T2)_value! : throw new InvalidOperationException();

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2) =>
            _index == 0 ? onT1((T1)_value!) : onT2((T2)_value!);

        // Implicit conversions
        public static implicit operator Union<T1, T2>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2>(T2 value) => From2(value);
    }

    // Similar for Union<T1, T2, T3> through Union<T1..T8>
}
```

Usage mapping:

| TypeScript | C# |
|------------|-----|
| `T \| null \| undefined` | `T?` |
| 2-8 type unions | `Union<T1, T2, ...>` |
| 9+ type unions | `object` (fallback) |

Example:

```typescript
// TypeScript
function getValue(): string | number {
  return Math.random() > 0.5 ? "hello" : 42;
}
```

```csharp
// Generated C#
public static Union<string, double> getValue()
{
    return Math.random() > 0.5 ? "hello" : 42.0;
}
```

### Structural Typing

TypeScript uses structural typing (duck typing). Two types are compatible if they have the same shape.

```csharp
namespace Tsonic.Runtime
{
    public static class Structural
    {
        public static T? Clone<T>(object? source) where T : new()
        {
            if (source == null) return default;

            var target = new T();
            var sourceType = source.GetType();
            var targetType = typeof(T);

            var targetProperties = targetType.GetProperties()
                .Where(p => p.CanWrite);

            foreach (var targetProp in targetProperties)
            {
                var sourceProp = sourceType.GetProperty(targetProp.Name);
                if (sourceProp != null && sourceProp.CanRead)
                {
                    var sourceValue = sourceProp.GetValue(source);
                    targetProp.SetValue(target, sourceValue);
                }
            }

            return target;
        }

        public static Dictionary<string, object?> ToDictionary(object? source)
        {
            var result = new Dictionary<string, object?>();
            if (source == null) return result;

            var properties = source.GetType().GetProperties();
            foreach (var prop in properties)
            {
                if (prop.CanRead)
                {
                    result[prop.Name] = prop.GetValue(source);
                }
            }
            return result;
        }
    }
}
```

Example:

```typescript
// TypeScript - structural compatibility
interface Point { x: number; y: number; }
interface Point3D { x: number; y: number; z: number; }

function use2DPoint(p: Point): void { /* ... */ }
const p3d: Point3D = { x: 1, y: 2, z: 3 };
use2DPoint(p3d);  // OK - structural typing
```

```csharp
// Generated C#
use2DPoint(Structural.Clone<Point>(p3d));
```

### Index Signatures

TypeScript index signatures `{ [key: string]: T }`:

```csharp
namespace Tsonic.Runtime
{
    public class DictionaryAdapter<T>
    {
        private readonly Dictionary<string, object?> _dictionary;

        public DictionaryAdapter(Dictionary<string, object?> dictionary)
        {
            _dictionary = dictionary ?? new Dictionary<string, object?>();
        }

        public T? this[string key]
        {
            get
            {
                if (_dictionary.TryGetValue(key, out var value) && value is T typedValue)
                {
                    return typedValue;
                }
                return default;
            }
            set => _dictionary[key] = value;
        }

        public IEnumerable<string> Keys => _dictionary.Keys;
        public bool ContainsKey(string key) => _dictionary.ContainsKey(key);
    }
}
```

### typeof Operator

JavaScript-style typeof returns different strings than .NET:

```csharp
namespace Tsonic.Runtime
{
    public static class Operators
    {
        public static string @typeof(object? value)
        {
            if (value == null) return "undefined";
            if (value is string) return "string";
            if (value is double || value is int || value is float || value is long)
                return "number";
            if (value is bool) return "boolean";
            if (value is Delegate) return "function";
            return "object";
        }
    }
}
```

### Dynamic Object

For dynamic property access:

```csharp
namespace Tsonic.Runtime
{
    public class DynamicObject
    {
        private readonly Dictionary<string, object?> _properties = new();

        public object? this[string key]
        {
            get => _properties.TryGetValue(key, out var value) ? value : null;
            set => _properties[key] = value;
        }

        public bool HasProperty(string key) => _properties.ContainsKey(key);
        public void DeleteProperty(string key) => _properties.Remove(key);
        public IEnumerable<string> GetKeys() => _properties.Keys;
    }
}
```

## Tsonic.JSRuntime

JavaScript semantics for built-in types. Only used in `js` mode.

### Design: Extension Methods

JSRuntime uses extension methods on native .NET types, not wrapper classes:

```csharp
// Extension method approach (used)
using Tsonic.JSRuntime;
List<string> names = new() { "Alice", "Bob" };
var upper = names.map(name => name.toUpperCase());

// NOT wrapper approach
// JSArray<string> names = new() { ... };
```

Benefits:
- Full .NET interop without conversions
- Better performance (no wrapper overhead)
- AOT-friendly (no dynamic dispatch)

### Array Extensions

Functional methods:

```csharp
namespace Tsonic.JSRuntime
{
    public static class Array
    {
        public static List<TResult> map<T, TResult>(
            this List<T> arr,
            Func<T, TResult> mapper
        )
        {
            var result = new List<TResult>(arr.Count);
            for (int i = 0; i < arr.Count; i++)
            {
                result.Add(mapper(arr[i]));
            }
            return result;
        }

        public static List<T> filter<T>(
            this List<T> arr,
            Func<T, bool> predicate
        )
        {
            var result = new List<T>();
            foreach (var item in arr)
            {
                if (predicate(item)) result.Add(item);
            }
            return result;
        }

        public static TResult reduce<T, TResult>(
            this List<T> arr,
            Func<TResult, T, TResult> reducer,
            TResult initial
        )
        {
            var accumulator = initial;
            foreach (var item in arr)
            {
                accumulator = reducer(accumulator, item);
            }
            return accumulator;
        }
    }
}
```

Mutating methods:

```csharp
public static void push<T>(this List<T> arr, params T[] items)
{
    arr.AddRange(items);
}

public static T? pop<T>(this List<T> arr)
{
    if (arr.Count == 0) return default;
    var index = arr.Count - 1;
    var value = arr[index];
    arr.RemoveAt(index);
    return value;
}

public static T? shift<T>(this List<T> arr)
{
    if (arr.Count == 0) return default;
    var value = arr[0];
    arr.RemoveAt(0);
    return value;
}

public static void unshift<T>(this List<T> arr, params T[] items)
{
    arr.InsertRange(0, items);
}
```

### String Extensions

```csharp
namespace Tsonic.JSRuntime
{
    public static class String
    {
        public static string slice(this string str, int start, int? end = null)
        {
            var length = str.Length;
            var actualStart = start < 0 ? Math.Max(0, length + start) : Math.Min(start, length);
            var actualEnd = end.HasValue
                ? (end.Value < 0 ? Math.Max(0, length + end.Value) : Math.Min(end.Value, length))
                : length;

            if (actualStart >= actualEnd) return "";
            return str.Substring(actualStart, actualEnd - actualStart);
        }

        public static string charAt(this string str, int index)
        {
            if (index < 0 || index >= str.Length) return "";
            return str[index].ToString();
        }

        public static string toUpperCase(this string str) => str.ToUpper();
        public static string toLowerCase(this string str) => str.ToLower();
        public static bool includes(this string str, string searchString) =>
            str.Contains(searchString);
    }
}
```

### Math Class

```csharp
namespace Tsonic.JSRuntime
{
    public static class Math
    {
        private static readonly Random _random = new();

        public static double floor(double value) => System.Math.Floor(value);
        public static double ceil(double value) => System.Math.Ceiling(value);
        public static double abs(double value) => System.Math.Abs(value);

        // JavaScript half-up rounding (0.5 -> 1)
        public static double round(double value) => System.Math.Floor(value + 0.5);

        public static double random() => _random.NextDouble();

        public static double max(params double[] values)
        {
            if (values.Length == 0) return double.NegativeInfinity;
            return values.Max();
        }

        public static double min(params double[] values)
        {
            if (values.Length == 0) return double.PositiveInfinity;
            return values.Min();
        }

        public static double sqrt(double value) => System.Math.Sqrt(value);
        public static double pow(double x, double y) => System.Math.Pow(x, y);
    }
}
```

### console Class

```csharp
namespace Tsonic.JSRuntime
{
    public static class console
    {
        public static void log(params object?[] args)
        {
            Console.WriteLine(string.Join(" ", args.Select(Stringify)));
        }

        public static void error(params object?[] args)
        {
            Console.Error.WriteLine(string.Join(" ", args.Select(Stringify)));
        }

        public static void warn(params object?[] args)
        {
            Console.WriteLine($"Warning: {string.Join(" ", args.Select(Stringify))}");
        }

        private static string Stringify(object? value)
        {
            if (value == null) return "null";
            if (value is string s) return s;
            if (value is double d) return d.ToString("G");
            if (value is bool b) return b ? "true" : "false";
            return value.ToString() ?? "";
        }
    }
}
```

### JSON Class

```csharp
namespace Tsonic.JSRuntime
{
    public static class JSON
    {
        public static string stringify(object? value)
        {
            return System.Text.Json.JsonSerializer.Serialize(value);
        }

        public static T? parse<T>(string json)
        {
            return System.Text.Json.JsonSerializer.Deserialize<T>(json);
        }
    }
}
```

### Global Functions

```csharp
namespace Tsonic.JSRuntime
{
    public static class Globals
    {
        public static double parseInt(string str, int radix = 10)
        {
            try
            {
                return Convert.ToInt32(str.Trim(), radix);
            }
            catch
            {
                return double.NaN;
            }
        }

        public static double parseFloat(string str)
        {
            if (double.TryParse(str.Trim(), out var result))
                return result;
            return double.NaN;
        }

        public static bool isNaN(double value) => double.IsNaN(value);
        public static bool isFinite(double value) => !double.IsInfinity(value) && !double.IsNaN(value);
    }
}
```

## Mode Behavior

### dotnet Mode (Default)

No JSRuntime dependency:

```xml
<PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
<!-- NO Tsonic.JSRuntime reference -->
```

Direct BCL calls:

```typescript
// TypeScript
const arr = [1, 2, 3];
arr.push(4);
```

```csharp
// Generated C# (mode: dotnet)
var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.Add(4.0);  // Direct BCL method
```

### js Mode

Both dependencies:

```xml
<PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
<PackageReference Include="Tsonic.JSRuntime" Version="1.0.0" />
```

JS semantics via extension methods:

```typescript
// TypeScript
const arr = [1, 2, 3];
arr.push(4);
```

```csharp
// Generated C# (mode: js)
using Tsonic.JSRuntime;

var arr = new List<double> { 1.0, 2.0, 3.0 };
arr.push(4.0);  // Extension method from JSRuntime
```

## NativeAOT Compatibility

Both runtime packages are fully NativeAOT compatible:

- Minimal reflection (only for structural cloning with proper annotations)
- No dynamic dispatch
- No runtime code generation
- Trim-safe - all types explicitly referenced

Reflection annotations for AOT:

```csharp
public static T? Clone<
    [DynamicallyAccessedMembers(
        DynamicallyAccessedMemberTypes.PublicConstructors |
        DynamicallyAccessedMemberTypes.PublicProperties
    )] T
>(object? source) where T : new()
```

## Package Structure

### Tsonic.Runtime

```
tsonic-runtime/
  src/Tsonic.Runtime/
    Union.cs
    Structural.cs
    DictionaryAdapter.cs
    Operators.cs
    DynamicObject.cs
    Tsonic.Runtime.csproj
  tests/Tsonic.Runtime.Tests/
```

### Tsonic.JSRuntime

```
js-runtime/
  src/Tsonic.JSRuntime/
    Array.cs
    String.cs
    Math.cs
    console.cs
    JSON.cs
    Globals.cs
    Tsonic.JSRuntime.csproj
  tests/Tsonic.JSRuntime.Tests/
```

Both are separate repositories published as NuGet packages.
