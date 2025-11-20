# Bindings Contract (.bindings.json)

## Purpose

`.bindings.json` files provide runtime binding information for .NET interop:
- MetadataToken for runtime method/property resolution
- Name transformations (CLR name → TypeScript name)
- Target information (which assembly/type declares a member)
- Two-layer view: What CLR defines vs what TypeScript exposes
- Canonical vs normalized signatures

These files are produced by **tsbindgen** and consumed by **Tsonic.Runtime** for reflection-based method dispatch.

**Key Difference from .metadata.json:**
- `.metadata.json`: Compile-time semantics (virtual, override, abstract, accessibility)
- `.bindings.json`: Runtime binding (MetadataToken, reflection targets, name mappings)

---

## File Location

```
node_modules/@types/dotnet/
  System.Collections.Generic/
    internal/
      metadata.json          # Compile-time semantics
    bindings.json            # ← Runtime binding (only if naming transforms applied)
    index.d.ts               # Public facade
```

**Important:** `bindings.json` is **optional** and only emitted when naming transforms are applied (e.g., camelCase conversion). If no transforms, this file is omitted.

---

## Root Schema

```typescript
type BindingsFile = {
  readonly Namespace: string;              // "System.Collections.Generic"
  readonly Types: TypeBinding[];           // Array of type bindings
};
```

**Example:**
```json
{
  "Namespace": "System.Collections.Generic",
  "Types": [
    {
      "ClrName": "List`1",
      "TsEmitName": "List_1",
      "AssemblyName": "System.Private.CoreLib",
      "MetadataToken": 33554433,
      "Methods": [ /* ... */ ],
      "Properties": [ /* ... */ ]
    }
  ]
}
```

---

## TypeBinding Schema

```typescript
type TypeBinding = {
  // Identity
  readonly ClrName: string;              // "List`1" (backtick for generics)
  readonly TsEmitName: string;           // "List_1" (underscore for generics)
  readonly AssemblyName: string;         // "System.Private.CoreLib"
  readonly MetadataToken: number;        // For runtime type resolution

  // V1: Definitions (what CLR declares on this type)
  readonly Methods?: MethodBinding[];
  readonly Properties?: PropertyBinding[];
  readonly Fields?: FieldBinding[];
  readonly Events?: EventBinding[];
  readonly Constructors?: ConstructorBinding[];

  // V2: Exposures (what TypeScript shows, including inherited)
  readonly ExposedMethods?: ExposedMethodBinding[];
  readonly ExposedProperties?: ExposedPropertyBinding[];
  readonly ExposedFields?: ExposedFieldBinding[];
  readonly ExposedEvents?: ExposedEventBinding[];
};
```

---

## MethodBinding Schema (V1 Definitions)

```typescript
type MethodBinding = {
  // Identity
  readonly ClrName: string;              // "Add", "SelectMany"
  readonly TsEmitName: string;           // "Add", "selectMany" (if camelCase)
  readonly MetadataToken: number;        // For runtime method resolution

  // Signatures
  readonly CanonicalSignature: string;   // C#-style: "SelectMany[2](IEnumerable,Func)"
  readonly NormalizedSignature: string;  // Normalized: "SelectMany(IEnumerable_1,Func_2)"

  // Metadata
  readonly EmitScope: EmitScope;         // "ClassSurface" | "ViewOnly" | "Omitted"
  readonly Arity: number;                // Generic method parameter count
  readonly ParameterCount: number;       // Total parameter count

  // Target (where method is declared)
  readonly DeclaringClrType: string;     // "System.Linq.Enumerable"
  readonly DeclaringAssemblyName: string; // "System.Linq"
};

type EmitScope =
  | "ClassSurface"       // Emitted directly on class/interface
  | "ViewOnly"           // Emitted in As_IInterface view property
  | "Omitted";           // Intentionally not emitted
```

**CanonicalSignature Format:**
```
MethodName[Arity](Param1Type,Param2Type,...):ReturnType
```

Examples:
```
"Add(T):Void"
"SelectMany[2](IEnumerable,Func):IEnumerable"
"BinarySearch(Int32,Int32,T,IComparer):Int32"
```

**NormalizedSignature Format:**
```
MethodName(Param1Type_Arity,Param2Type_Arity,...)
```

Examples:
```
"Add(T)"
"SelectMany(IEnumerable_1,Func_2)"
"BinarySearch(System.Int32,System.Int32,T,IComparer_1)"
```

---

## PropertyBinding Schema (V1 Definitions)

```typescript
type PropertyBinding = {
  // Identity
  readonly ClrName: string;              // "Count", "Item"
  readonly TsEmitName: string;           // "count" (if camelCase)
  readonly MetadataToken: number;        // For runtime property resolution

  // Metadata
  readonly EmitScope: EmitScope;
  readonly IsIndexer: boolean;           // C# indexer (this[int index])

  // Target
  readonly DeclaringClrType: string;
  readonly DeclaringAssemblyName: string;
};
```

---

## FieldBinding Schema (V1 Definitions)

```typescript
type FieldBinding = {
  // Identity
  readonly ClrName: string;
  readonly TsEmitName: string;
  readonly MetadataToken: number;

  // Target
  readonly DeclaringClrType: string;
  readonly DeclaringAssemblyName: string;
};
```

---

## EventBinding Schema (V1 Definitions)

```typescript
type EventBinding = {
  // Identity
  readonly ClrName: string;
  readonly TsEmitName: string;
  readonly MetadataToken: number;

  // Target
  readonly DeclaringClrType: string;
  readonly DeclaringAssemblyName: string;
};
```

---

## ConstructorBinding Schema (V1 Definitions)

```typescript
type ConstructorBinding = {
  readonly MetadataToken: number;        // For runtime constructor resolution
  readonly CanonicalSignature: string;   // "ctor()" or "ctor(Int32,String)"
  readonly ParameterCount: number;
};
```

---

## ExposedMethodBinding Schema (V2 Exposures)

```typescript
type ExposedMethodBinding = {
  // TypeScript-facing identity
  readonly TsName: string;               // "selectMany" (after transforms)
  readonly IsStatic: boolean;            // Static vs instance

  // Signature in TypeScript terms
  readonly TsSignatureId: string;        // "SelectMany(IEnumerable_1,Func_2)"

  // Runtime target (where method actually lives)
  readonly Target: BindingTarget;
};

type BindingTarget = {
  readonly DeclaringClrType: string;     // "System.Linq.Enumerable"
  readonly DeclaringAssemblyName: string; // "System.Linq"
  readonly MetadataToken: number;        // For runtime resolution
};
```

**Why V2 Exposures Matter:**
- TypeScript shows inherited members inline
- CLR distinguishes inherited from declared
- V2 tracks: "TypeScript shows `list.Contains()`, but it's actually declared on `ICollection<T>`"
- Target points to the real CLR method for reflection

---

## ExposedPropertyBinding Schema (V2 Exposures)

```typescript
type ExposedPropertyBinding = {
  readonly TsName: string;
  readonly IsStatic: boolean;
  readonly Target: BindingTarget;
};
```

---

## ExposedFieldBinding Schema (V2 Exposures)

```typescript
type ExposedFieldBinding = {
  readonly TsName: string;
  readonly IsStatic: boolean;
  readonly Target: BindingTarget;
};
```

---

## ExposedEventBinding Schema (V2 Exposures)

```typescript
type ExposedEventBinding = {
  readonly TsName: string;
  readonly IsStatic: boolean;
  readonly Target: BindingTarget;
};
```

---

## Real-World Example: List<T>

From `System.Collections.Generic/bindings.json`:

```json
{
  "Namespace": "System.Collections.Generic",
  "Types": [
    {
      "ClrName": "List`1",
      "TsEmitName": "List_1",
      "AssemblyName": "System.Private.CoreLib",
      "MetadataToken": 33554433,

      "Methods": [
        {
          "ClrName": "Add",
          "TsEmitName": "Add",
          "MetadataToken": 100663297,
          "CanonicalSignature": "Add(T):Void",
          "NormalizedSignature": "Add(T)",
          "EmitScope": "ClassSurface",
          "Arity": 0,
          "ParameterCount": 1,
          "DeclaringClrType": "System.Collections.Generic.List`1",
          "DeclaringAssemblyName": "System.Private.CoreLib"
        },
        {
          "ClrName": "BinarySearch",
          "TsEmitName": "BinarySearch",
          "MetadataToken": 100663298,
          "CanonicalSignature": "BinarySearch(Int32,Int32,T,IComparer):Int32",
          "NormalizedSignature": "BinarySearch(System.Int32,System.Int32,T,IComparer_1)",
          "EmitScope": "ClassSurface",
          "Arity": 0,
          "ParameterCount": 4,
          "DeclaringClrType": "System.Collections.Generic.List`1",
          "DeclaringAssemblyName": "System.Private.CoreLib"
        },
        {
          "ClrName": "BinarySearch",
          "TsEmitName": "BinarySearch2",
          "MetadataToken": 100663299,
          "CanonicalSignature": "BinarySearch(T):Int32",
          "NormalizedSignature": "BinarySearch(T)",
          "EmitScope": "ClassSurface",
          "ParameterCount": 1,
          "DeclaringClrType": "System.Collections.Generic.List`1",
          "DeclaringAssemblyName": "System.Private.CoreLib"
        }
      ],

      "Properties": [
        {
          "ClrName": "Count",
          "TsEmitName": "Count",
          "MetadataToken": 100663300,
          "EmitScope": "ClassSurface",
          "IsIndexer": false,
          "DeclaringClrType": "System.Collections.Generic.List`1",
          "DeclaringAssemblyName": "System.Private.CoreLib"
        },
        {
          "ClrName": "Item",
          "TsEmitName": "Item",
          "MetadataToken": 100663301,
          "EmitScope": "ClassSurface",
          "IsIndexer": true,
          "DeclaringClrType": "System.Collections.Generic.List`1",
          "DeclaringAssemblyName": "System.Private.CoreLib"
        }
      ],

      "Constructors": [
        {
          "MetadataToken": 100663302,
          "CanonicalSignature": "ctor()",
          "ParameterCount": 0
        },
        {
          "MetadataToken": 100663303,
          "CanonicalSignature": "ctor(Int32)",
          "ParameterCount": 1
        },
        {
          "MetadataToken": 100663304,
          "CanonicalSignature": "ctor(IEnumerable)",
          "ParameterCount": 1
        }
      ],

      "ExposedMethods": [
        {
          "TsName": "Add",
          "IsStatic": false,
          "TsSignatureId": "Add(T)",
          "Target": {
            "DeclaringClrType": "System.Collections.Generic.List`1",
            "DeclaringAssemblyName": "System.Private.CoreLib",
            "MetadataToken": 100663297
          }
        },
        {
          "TsName": "Contains",
          "IsStatic": false,
          "TsSignatureId": "Contains(T)",
          "Target": {
            "DeclaringClrType": "System.Collections.Generic.ICollection`1",
            "DeclaringAssemblyName": "System.Private.CoreLib",
            "MetadataToken": 100663400
          }
        }
      ]
    }
  ]
}
```

---

## Real-World Example: System.Linq.Enumerable (Static Methods)

From `System.Linq/bindings.json`:

```json
{
  "Namespace": "System.Linq",
  "Types": [
    {
      "ClrName": "Enumerable",
      "TsEmitName": "Enumerable",
      "AssemblyName": "System.Linq",
      "MetadataToken": 33554433,

      "Methods": [
        {
          "ClrName": "SelectMany",
          "TsEmitName": "selectMany",
          "MetadataToken": 100663297,
          "CanonicalSignature": "SelectMany[2](IEnumerable,Func):IEnumerable",
          "NormalizedSignature": "SelectMany(IEnumerable_1,Func_2)",
          "EmitScope": "ClassSurface",
          "Arity": 2,
          "ParameterCount": 2,
          "DeclaringClrType": "System.Linq.Enumerable",
          "DeclaringAssemblyName": "System.Linq"
        },
        {
          "ClrName": "Where",
          "TsEmitName": "where",
          "MetadataToken": 100663298,
          "CanonicalSignature": "Where[1](IEnumerable,Func):IEnumerable",
          "NormalizedSignature": "Where(IEnumerable_1,Func_2)",
          "EmitScope": "ClassSurface",
          "Arity": 1,
          "ParameterCount": 2,
          "DeclaringClrType": "System.Linq.Enumerable",
          "DeclaringAssemblyName": "System.Linq"
        }
      ],

      "ExposedMethods": [
        {
          "TsName": "selectMany",
          "IsStatic": true,
          "TsSignatureId": "SelectMany(IEnumerable_1,Func_2)",
          "Target": {
            "DeclaringClrType": "System.Linq.Enumerable",
            "DeclaringAssemblyName": "System.Linq",
            "MetadataToken": 100663297
          }
        },
        {
          "TsName": "where",
          "IsStatic": true,
          "TsSignatureId": "Where(IEnumerable_1,Func_2)",
          "Target": {
            "DeclaringClrType": "System.Linq.Enumerable",
            "DeclaringAssemblyName": "System.Linq",
            "MetadataToken": 100663298
          }
        }
      ]
    }
  ]
}
```

---

## How Tsonic.Runtime Consumes Bindings

### 1. Type Resolution via MetadataToken

```csharp
// TypeScript: new List<string>()
// Tsonic.Runtime loads bindings:
var binding = bindings.Types.Find(t => t.TsEmitName == "List_1");

// Get runtime type via reflection
var type = assembly.GetType(binding.ClrName); // "List`1"
// OR use MetadataToken for faster lookup
var type = assembly.ManifestModule.ResolveType(binding.MetadataToken);
```

### 2. Method Dispatch via MetadataToken

```csharp
// TypeScript: list.Add("hello")
var methodBinding = binding.Methods.Find(m =>
    m.TsEmitName == "Add" &&
    m.ParameterCount == 1
);

// Get runtime method via reflection
var methodInfo = type.GetMethod(
    methodBinding.ClrName,
    BindingFlags.Public | BindingFlags.Instance,
    /* parameter types */
);

// OR use MetadataToken for faster lookup
var methodInfo = (MethodInfo)assembly.ManifestModule.ResolveMethod(
    methodBinding.MetadataToken
);

// Invoke
methodInfo.Invoke(list, new object[] { "hello" });
```

### 3. Static Method Dispatch

```csharp
// TypeScript: Enumerable.selectMany(source, selector)
var methodBinding = binding.Methods.Find(m =>
    m.TsEmitName == "selectMany" &&
    m.Arity == 2 &&
    m.ParameterCount == 2
);

// Resolve via MetadataToken
var assembly = Assembly.Load(methodBinding.DeclaringAssemblyName);
var methodInfo = (MethodInfo)assembly.ManifestModule.ResolveMethod(
    methodBinding.MetadataToken
);

// Make generic method
var genericMethod = methodInfo.MakeGenericMethod(TSource, TResult);

// Invoke static
genericMethod.Invoke(null, new object[] { source, selector });
```

### 4. Inherited Member Resolution (V2 Exposures)

```csharp
// TypeScript: list.Contains("hello")
// Contains is declared on ICollection<T>, not List<T>

var exposedMethod = binding.ExposedMethods.Find(m =>
    m.TsName == "Contains"
);

// Load target assembly
var targetAssembly = Assembly.Load(
    exposedMethod.Target.DeclaringAssemblyName
);

// Resolve actual method via MetadataToken
var methodInfo = (MethodInfo)targetAssembly.ManifestModule.ResolveMethod(
    exposedMethod.Target.MetadataToken
);

// Get declaring type
var declaringType = methodInfo.DeclaringType; // ICollection`1

// Invoke on list (which implements ICollection<T>)
methodInfo.Invoke(list, new object[] { "hello" });
```

### 5. Name Transform Lookup

```csharp
// TypeScript identifier → CLR identifier
var tsName = "selectMany";
var exposedMethod = binding.ExposedMethods.Find(m => m.TsName == tsName);
var methodBinding = binding.Methods.Find(m =>
    m.MetadataToken == exposedMethod.Target.MetadataToken
);
var clrName = methodBinding.ClrName; // "SelectMany"

// CLR identifier → TypeScript identifier
var clrName = "SelectMany";
var methodBinding = binding.Methods.Find(m => m.ClrName == clrName);
var tsName = methodBinding.TsEmitName; // "selectMany"
```

---

## Key Implementation Notes

### 1. MetadataToken for Performance

**MetadataToken** is a 32-bit integer that uniquely identifies a type, method, field, property, or event within an assembly's metadata:

- **Faster than reflection by name**: No string matching, direct table lookup
- **Stable across compilation**: Same token for same member (within assembly version)
- **Module-scoped**: Use `Assembly.ManifestModule.ResolveMethod(token)` or `ResolveType(token)`

**Performance Comparison:**
```csharp
// Slow: Reflection by name (string matching, parameter matching)
var method = type.GetMethod("SelectMany", BindingFlags.Public | BindingFlags.Static, ...);

// Fast: Reflection by MetadataToken (direct table lookup)
var method = assembly.ManifestModule.ResolveMethod(100663297);
```

### 2. Generic Type/Method Handling

**Generic Types:**
- CLR name: `List`1`, `Dictionary`2` (backtick)
- TypeScript name: `List_1`, `Dictionary_2` (underscore)
- MetadataToken refers to open generic definition
- Must call `MakeGenericType(...)` to construct closed generic

**Generic Methods:**
- `Arity` field indicates number of generic parameters
- MetadataToken refers to open generic definition
- Must call `MakeGenericMethod(...)` to construct closed generic
- Example: `SelectMany[2]` has `Arity: 2`

### 3. Method Overload Resolution

**Problem:** Multiple methods with same CLR name

**Solution:** Use `NormalizedSignature` + `ParameterCount`

```csharp
var candidates = binding.Methods.Where(m =>
    m.ClrName == "BinarySearch"
).ToList();

// Match by parameter count
var match = candidates.Find(m => m.ParameterCount == 4);

// Or match by normalized signature
var match = candidates.Find(m =>
    m.NormalizedSignature == "BinarySearch(System.Int32,System.Int32,T,IComparer_1)"
);
```

### 4. V1 Definitions vs V2 Exposures

**V1 Definitions (Methods, Properties, etc.):**
- What CLR declares **directly on this type**
- For List<T>: `Add`, `BinarySearch`, `Count`, `Item`
- Excludes inherited members from interfaces/base classes

**V2 Exposures (ExposedMethods, ExposedProperties, etc.):**
- What TypeScript **shows to developers**
- For List<T>: `Add`, `BinarySearch`, `Count`, `Item`, **`Contains`**, **`CopyTo`**, etc.
- Includes inherited members (inlined from interfaces/base classes)
- Target points to the **actual declaring type**

**When to use which:**
- **Tsonic compiler**: Use V1 Definitions to understand what's directly on the type
- **Tsonic.Runtime**: Use V2 Exposures to resolve TypeScript calls to CLR targets

### 5. Optional File Generation

**bindings.json is only emitted when:**
- Naming transforms are applied (e.g., camelCase conversion)
- Otherwise, omitted to save disk space

**Fallback when missing:**
- Assume `TsEmitName == ClrName` (no transform)
- Use metadata.json for method discovery
- Use reflection by name (slower than MetadataToken)

### 6. Canonical vs Normalized Signatures

**CanonicalSignature (C#-style):**
- Human-readable format
- Uses C# type names: `Int32`, `String`, `IEnumerable`, `Func`
- Includes return type: `SelectMany[2](IEnumerable,Func):IEnumerable`
- Used for documentation/debugging

**NormalizedSignature (Normalized):**
- Machine-readable format
- Uses full type names with arity: `System.Int32`, `IEnumerable_1`, `Func_2`
- Omits return type: `SelectMany(IEnumerable_1,Func_2)`
- Used for exact overload matching

**When to use which:**
- **Display/logging**: Use CanonicalSignature
- **Overload resolution**: Use NormalizedSignature

### 7. EmitScope Handling

- **ClassSurface**: Normal method/property, accessible via instance/type
- **ViewOnly**: Explicit interface implementation, only via `As_IInterface` cast
- **Omitted**: Not in TypeScript declarations (e.g., indexers shown as `Item` property)

---

## Performance Considerations

- **Bindings file size**: ~50% of metadata.json size
- **System.Collections.Generic**: ~8k lines bindings
- **Lazy loading**: Load per-namespace as needed
- **MetadataToken lookup**: O(1) vs O(n) string matching
- **Caching**: Cache resolved MethodInfo/PropertyInfo per compilation session
- **Index by TsEmitName**: Build lookup maps for O(1) access

---

## See Also

- [metadata.md](metadata.md) - Compile-time semantics (.metadata.json)
- [runtime-contract.md](runtime-contract.md) - Runtime loading and method resolution
- [spec/architecture/02-phase-program.md](architecture/02-phase-program.md) - Bindings registry loading
- [spec/architecture/05-phase-ir.md](architecture/05-phase-ir.md) - Binding resolution using metadata
- [spec/architecture/09-phase-runtime.md](architecture/09-phase-runtime.md) - Tsonic.Runtime reflection dispatch
