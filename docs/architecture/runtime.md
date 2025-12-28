# Runtime Libraries

Tsonic uses a .NET runtime library to support TypeScript semantics.

## Overview

| Package          | Purpose                        | Required |
| ---------------- | ------------------------------ | -------- |
| `Tsonic.Runtime` | TypeScript language primitives | Always   |

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

| TypeScript               | C#                   |
| ------------------------ | -------------------- |
| `T \| null \| undefined` | `T?`                 |
| 2-8 type unions          | `Union<T1, T2, ...>` |
| 9+ type unions           | `object` (fallback)  |

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
interface Point {
  x: number;
  y: number;
}
interface Point3D {
  x: number;
  y: number;
  z: number;
}

function use2DPoint(p: Point): void {
  /* ... */
}
const p3d: Point3D = { x: 1, y: 2, z: 3 };
use2DPoint(p3d); // OK - structural typing
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

## Runtime Dependency

Projects include only Tsonic.Runtime:

```xml
<PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
```

Arrays compile to native C# arrays:

```typescript
// TypeScript
const arr = [1, 2, 3];
```

```csharp
// Generated C#
int[] arr = [1, 2, 3];
```

For dynamic collections, use List<T> explicitly:

```typescript
import { List } from "@tsonic/dotnet/System.Collections.Generic";
const list = new List<number>([1, 2, 3]);
list.Add(4);
```

## NativeAOT Compatibility

Tsonic.Runtime is fully NativeAOT compatible:

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
    IteratorResult.cs
    Tsonic.Runtime.csproj
  tests/Tsonic.Runtime.Tests/
```

Tsonic.Runtime is published as a NuGet package.
