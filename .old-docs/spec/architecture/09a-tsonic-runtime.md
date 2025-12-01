# Tsonic.Runtime Package - TypeScript Language Primitives

## Purpose

This document describes the **`Tsonic.Runtime`** .NET package that provides TypeScript language primitives. This package is **always required** regardless of compilation mode.

---

## 1. Overview

**Responsibility:** TypeScript language features that don't exist in C#

**Package:** `Tsonic.Runtime` (.NET NuGet package)

**Repository:** `tsoniclang/tsonic-runtime` (separate repo)

**Usage:** **Always required** - referenced in all Tsonic projects

**Input:** None (runtime library)

**Output:** NuGet package consumed by generated C# code

---

## 2. Package Contents

### 2.1 What Belongs Here

| Component               | Purpose                                        | Why Mode-Independent |
| ----------------------- | ---------------------------------------------- | -------------------- |
| `Union<T1..T8>`         | TypeScript union type representation           | TS language feature  |
| `Structural.Clone<T>()` | Structural typing support                      | TS type system       |
| `DictionaryAdapter<T>`  | Index signature support `{ [key: string]: T }` | TS type system       |
| `Operators.typeof()`    | `typeof` operator semantics                    | TS language operator |
| `DynamicObject`         | Dynamic property access                        | TS structural typing |

### 2.2 What Does NOT Belong Here

**JavaScript semantics** - These belong in `Tsonic.JSRuntime`:

- Array methods (map, filter, push, etc.)
- String methods (slice, charAt, etc.)
- Math object
- console API
- JSON API
- Global functions (parseInt, parseFloat, etc.)

---

## 3. Union Types

### 3.1 Purpose

TypeScript unions (`string | number`) don't exist in C#. We provide `Union<T1, T2, ...>` generic types.

### 3.2 Implementation Strategy

| Union Type               | C# Emission          | Notes                  |
| ------------------------ | -------------------- | ---------------------- |
| `T \| null \| undefined` | `T?`                 | Use C# nullable syntax |
| 2-8 type unions          | `Union<T1, T2, ...>` | Generic union types    |
| 9+ type unions           | `object`             | Fallback (rare)        |

### 3.3 Union Type Definitions

```csharp
namespace Tsonic.Runtime
{
    /// <summary>
    /// Union of two types (T1 | T2 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2>
    {
        private readonly object? _value;
        private readonly int _index; // 0 for T1, 1 for T2

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

        public bool TryAs1(out T1? value) { /* ... */ }
        public bool TryAs2(out T2? value) { /* ... */ }

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2) =>
            _index == 0 ? onT1((T1)_value!) : onT2((T2)_value!);

        // Implicit conversions
        public static implicit operator Union<T1, T2>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2>(T2 value) => From2(value);
    }

    // Similar implementations for Union<T1, T2, T3>, Union<T1, T2, T3, T4>, ...
    // up to Union<T1, T2, T3, T4, T5, T6, T7, T8>
}
```

### 3.4 Usage Example

**TypeScript:**

```typescript
function getValue(): string | number {
  return Math.random() > 0.5 ? "hello" : 42;
}

const value = getValue();
if (typeof value === "string") {
  console.log(value.toUpperCase());
} else {
  console.log(value * 2);
}
```

**Generated C#:**

```csharp
using Tsonic.Runtime;

public static Union<string, double> getValue()
{
    return Math.random() > 0.5 ? "hello" : 42.0;
}

var value = getValue();
value.Match(
    str => Console.WriteLine(str.ToUpper()),
    num => Console.WriteLine(num * 2)
);
```

---

## 4. Structural Typing

### 4.1 Purpose

TypeScript uses structural typing (duck typing). Two types are compatible if they have the same shape, even if they have different names.

### 4.2 Structural.Clone<T>()

```csharp
namespace Tsonic.Runtime
{
    /// <summary>
    /// Structural utilities for cloning and adapting objects.
    /// </summary>
    public static class Structural
    {
        /// <summary>
        /// Clone a source object into a target type T.
        /// Copies properties from source to a new instance of T.
        /// </summary>
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

        /// <summary>
        /// Convert an object to a dictionary.
        /// </summary>
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

### 4.3 Usage Example

**TypeScript:**

```typescript
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
  console.log(`Point: ${p.x}, ${p.y}`);
}

const p3d: Point3D = { x: 1, y: 2, z: 3 };
use2DPoint(p3d); // OK - structural typing
```

**Generated C#:**

```csharp
using Tsonic.Runtime;

public class Point
{
    public double x { get; set; }
    public double y { get; set; }
}

public class Point3D
{
    public double x { get; set; }
    public double y { get; set; }
    public double z { get; set; }
}

public static void use2DPoint(Point p)
{
    Console.WriteLine($"Point: {p.x}, {p.y}");
}

var p3d = new Point3D { x = 1, y = 2, z = 3 };
use2DPoint(Structural.Clone<Point>(p3d)); // Clone to satisfy nominal typing
```

---

## 5. Index Signatures

### 5.1 Purpose

TypeScript index signatures `{ [key: string]: T }` allow dynamic property access.

### 5.2 DictionaryAdapter<T>

```csharp
namespace Tsonic.Runtime
{
    /// <summary>
    /// Dictionary adapter that provides typed access to dictionary values.
    /// Supports TypeScript index signatures.
    /// </summary>
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

### 5.3 Usage Example

**TypeScript:**

```typescript
interface StringMap {
  [key: string]: string;
}

const map: StringMap = {};
map["hello"] = "world";
console.log(map["hello"]); // "world"
```

**Generated C#:**

```csharp
using Tsonic.Runtime;

var map = new DictionaryAdapter<string>(new Dictionary<string, object?>());
map["hello"] = "world";
Console.WriteLine(map["hello"]); // "world"
```

---

## 6. typeof Operator

### 6.1 Purpose

TypeScript's `typeof` operator returns JavaScript-style type strings, not .NET type names.

### 6.2 Operators.typeof()

```csharp
namespace Tsonic.Runtime
{
    /// <summary>
    /// JavaScript operators that need runtime support
    /// </summary>
    public static class Operators
    {
        /// <summary>
        /// typeof operator - returns JavaScript type string
        /// </summary>
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

### 6.3 Usage Example

**TypeScript:**

```typescript
const value = "hello";
console.log(typeof value); // "string"

const num = 42;
console.log(typeof num); // "number"

const fn = () => {};
console.log(typeof fn); // "function"
```

**Generated C#:**

```csharp
using Tsonic.Runtime;

var value = "hello";
Console.WriteLine(Operators.@typeof(value)); // "string"

var num = 42.0;
Console.WriteLine(Operators.@typeof(num)); // "number"

Func<object?> fn = () => null;
Console.WriteLine(Operators.@typeof(fn)); // "function"
```

---

## 7. Dynamic Object

### 7.1 Purpose

Support for dynamic property access on objects.

### 7.2 DynamicObject Class

```csharp
namespace Tsonic.Runtime
{
    /// <summary>
    /// Dynamic object for JavaScript-style property access
    /// </summary>
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

---

## 8. NativeAOT Compatibility

### 8.1 AOT-Friendly Patterns

All `Tsonic.Runtime` code is NativeAOT compatible:

✅ **Minimal reflection** - Only for structural cloning (with proper annotations)
✅ **No dynamic dispatch** - Generic types resolved at compile time
✅ **No runtime code generation**
✅ **Trim-safe** - All types explicitly referenced

### 8.2 Reflection Annotations

```csharp
public static T? Clone<
    [DynamicallyAccessedMembers(
        DynamicallyAccessedMemberTypes.PublicConstructors |
        DynamicallyAccessedMemberTypes.PublicProperties
    )] T
>(object? source) where T : new()
```

---

## 9. Package Structure

### 9.1 Repository Layout

```
tsonic-runtime/
├── src/
│   └── Tsonic.Runtime/
│       ├── Union.cs              # Union<T1..T8> types
│       ├── Structural.cs         # Structural.Clone<T>(), ToDictionary()
│       ├── DictionaryAdapter.cs  # Index signature support
│       ├── Operators.cs          # typeof operator
│       ├── DynamicObject.cs      # Dynamic property access
│       └── Tsonic.Runtime.csproj
├── tests/
│   └── Tsonic.Runtime.Tests/
│       ├── UnionTests.cs
│       ├── StructuralTests.cs
│       └── OperatorsTests.cs
├── LICENSE
└── README.md
```

### 9.2 Project File

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <PackageId>Tsonic.Runtime</PackageId>
    <Version>1.0.0</Version>
    <Authors>Tsonic Team</Authors>
    <Description>TypeScript language primitives for Tsonic compiler</Description>

    <!-- NativeAOT compatibility -->
    <IsAotCompatible>true</IsAotCompatible>
    <EnableTrimAnalyzer>true</EnableTrimAnalyzer>
  </PropertyGroup>
</Project>
```

---

## 10. Usage in Compilation

### 10.1 Always Referenced

`Tsonic.Runtime` is referenced in **all modes**:

```xml
<!-- Generated .csproj for ANY mode -->
<PackageReference Include="Tsonic.Runtime" Version="1.0.0" />
```

### 10.2 Emitter Behavior

The emitter adds `using Tsonic.Runtime;` when the IR contains:

- Union types
- typeof operator usage
- Structural cloning needs
- Index signatures
- Dynamic property access

---

## 11. See Also

- [00-overview.md](00-overview.md) - System architecture
- [09b-tsonic-jsruntime.md](09b-tsonic-jsruntime.md) - JavaScript semantics (mode: "js" only)
- [07-phase-emitter.md](07-phase-emitter.md) - C# code generation
- [08-phase-backend.md](08-phase-backend.md) - NativeAOT compilation

---

**Document Statistics:**

- Lines: ~400
- Sections: 11
- Components: 5 (Union, Structural, DictionaryAdapter, Operators, DynamicObject)
- Coverage: Complete TypeScript language primitives package
