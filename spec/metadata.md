# Metadata Contract (.metadata.json)

## Purpose

`.metadata.json` files provide CLR-specific semantics that TypeScript cannot express:
- Virtual/override/abstract modifiers
- Accessibility (public/protected/internal/private)
- Static vs instance distinction
- Provenance (where members originated)
- Emit scopes (class surface vs explicit interface views)
- Indexers (omitted from .d.ts)
- Generic static members (TypeScript limitation)

These files are produced by **tsbindgen** and consumed by **Tsonic** for C# code generation.

---

## File Location

```
node_modules/@types/dotnet/
  System.Collections.Generic/
    internal/
      metadata.json          # ← Complete namespace metadata
      index.d.ts             # TypeScript declarations
    index.d.ts               # Public facade
    bindings.json            # Optional: only if naming transforms applied
```

---

## Root Schema

```typescript
type MetadataFile = {
  readonly Namespace: string;                    // "System.Collections.Generic"
  readonly ContributingAssemblies: string[];     // ["System.Private.CoreLib", ...]
  readonly Types: Record<string, TypeMetadata>;  // Key = TsEmitName
};
```

**Example:**
```json
{
  "Namespace": "System.Collections.Generic",
  "ContributingAssemblies": [
    "System.Private.CoreLib",
    "System.Runtime"
  ],
  "Types": {
    "List_1": { /* TypeMetadata for List<T> */ },
    "Dictionary_2": { /* TypeMetadata for Dictionary<K,V> */ }
  }
}
```

---

## TypeMetadata Schema

```typescript
type TypeMetadata = {
  // Identity
  readonly ClrName: string;              // "List`1" (backtick for generics)
  readonly TsEmitName: string;           // "List_1" (underscore for generics)
  readonly Kind: TypeKind;               // "Class" | "Interface" | "Struct" | ...
  readonly Accessibility: Accessibility; // "Public" | "Internal" | ...

  // Modifiers
  readonly IsAbstract: boolean;
  readonly IsSealed: boolean;
  readonly IsStatic: boolean;
  readonly Arity: number;                // Generic parameter count (0 for non-generic)

  // Members
  readonly Methods: MethodMetadata[];
  readonly Properties: PropertyMetadata[];
  readonly Fields: FieldMetadata[];
  readonly Events: EventMetadata[];
  readonly Constructors: ConstructorMetadata[];
};

type TypeKind =
  | "Class"
  | "Interface"
  | "Struct"
  | "Enum"
  | "Delegate"
  | "StaticNamespace";  // For C# static classes

type Accessibility =
  | "Public"
  | "Internal"
  | "Protected"
  | "Private"
  | "ProtectedInternal"
  | "PrivateProtected";
```

---

## MethodMetadata Schema

```typescript
type MethodMetadata = {
  // Identity
  readonly ClrName: string;              // "Add", "SelectMany"
  readonly TsEmitName: string;           // "Add", "selectMany" (if camelCase)
  readonly NormalizedSignature: string;  // "Add|(T):System.Void|static=false"

  // Provenance
  readonly Provenance: Provenance;       // Where method came from
  readonly EmitScope: EmitScope;         // Where emitted in TypeScript
  readonly SourceInterface?: string;     // For ViewOnly: "System.Collections.IList"

  // Modifiers
  readonly IsStatic: boolean;
  readonly IsAbstract: boolean;
  readonly IsVirtual: boolean;
  readonly IsOverride: boolean;
  readonly IsSealed: boolean;            // sealed override

  // Signature
  readonly Arity: number;                // Generic method parameter count
  readonly ParameterCount: number;       // Total parameters
};

type Provenance =
  | "Declared"           // Direct member on type
  | "InlineFromInterface"  // Inherited from interface
  | "InlineFromBase"     // Inherited from base class
  | "SynthesizedViewOnly"  // Synthesized for explicit interface impl
  | "ExplicitView";      // Explicit interface implementation

type EmitScope =
  | "ClassSurface"       // Emitted directly on class/interface
  | "ViewOnly"          // Emitted in As_IInterface view property
  | "Omitted";          // Intentionally not emitted
```

**NormalizedSignature Format:**
```
MethodName|(Param1Type,Param2Type,...):ReturnType|static=true/false
```

Examples:
```
"Add|(T):System.Void|static=false"
"SelectMany[2]|(IEnumerable_1,Func_2):IEnumerable_1|static=true"
"BinarySearch|(System.Int32,System.Int32,T,IComparer_1):System.Int32|static=false"
```

---

## PropertyMetadata Schema

```typescript
type PropertyMetadata = {
  // Identity
  readonly ClrName: string;              // "Count", "Item"
  readonly TsEmitName: string;           // "count" (if camelCase)
  readonly NormalizedSignature: string;  // "Count|:System.Int32|static=false|accessor=get"

  // Provenance
  readonly Provenance: Provenance;
  readonly EmitScope: EmitScope;
  readonly SourceInterface?: string;

  // Modifiers
  readonly IsStatic: boolean;
  readonly IsAbstract: boolean;
  readonly IsVirtual: boolean;
  readonly IsOverride: boolean;
  readonly IsSealed: boolean;

  // Property-specific
  readonly IsIndexer: boolean;           // C# indexer (this[int index])
  readonly HasGetter: boolean;
  readonly HasSetter: boolean;
};
```

**NormalizedSignature Format:**
```
PropertyName|:Type|static=true/false|accessor=get/set/getset
```

Examples:
```
"Count|:System.Int32|static=false|accessor=get"
"Item|:T|static=false|accessor=getset"       // Indexer: list[0]
"Keys|:KeyCollection|static=false|accessor=get"
```

---

## FieldMetadata Schema

```typescript
type FieldMetadata = {
  // Identity
  readonly ClrName: string;
  readonly TsEmitName: string;
  readonly NormalizedSignature: string;

  // Modifiers
  readonly IsStatic: boolean;
  readonly IsReadOnly: boolean;
  readonly IsLiteral: boolean;           // const field
};
```

---

## EventMetadata Schema

```typescript
type EventMetadata = {
  // Identity
  readonly ClrName: string;
  readonly TsEmitName: string;
  readonly NormalizedSignature: string;

  // Modifiers
  readonly IsStatic: boolean;
  readonly IsAbstract: boolean;
  readonly IsVirtual: boolean;
  readonly IsOverride: boolean;
};
```

---

## ConstructorMetadata Schema

```typescript
type ConstructorMetadata = {
  readonly NormalizedSignature: string;  // "ctor()" or "ctor(System.Int32)"
  readonly IsStatic: boolean;            // Static constructor (type initializer)
  readonly ParameterCount: number;
};
```

---

## Real-World Example: List<T>

From `System.Collections.Generic/internal/metadata.json`:

```json
{
  "Namespace": "System.Collections.Generic",
  "ContributingAssemblies": ["System.Private.CoreLib"],
  "Types": {
    "List_1": {
      "ClrName": "System.Collections.Generic.List`1",
      "TsEmitName": "List_1",
      "Kind": "Class",
      "Accessibility": "Public",
      "IsAbstract": false,
      "IsSealed": false,
      "IsStatic": false,
      "Arity": 1,

      "Methods": [
        {
          "ClrName": "Add",
          "TsEmitName": "Add",
          "NormalizedSignature": "Add|(T):System.Void|static=false",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "IsStatic": false,
          "IsAbstract": false,
          "IsVirtual": true,
          "IsOverride": false,
          "IsSealed": true,
          "Arity": 0,
          "ParameterCount": 1
        },
        {
          "ClrName": "BinarySearch",
          "TsEmitName": "BinarySearch",
          "NormalizedSignature": "BinarySearch|(System.Int32,System.Int32,T,IComparer_1):System.Int32|static=false",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "IsStatic": false,
          "ParameterCount": 4
        },
        {
          "ClrName": "BinarySearch",
          "TsEmitName": "BinarySearch2",
          "NormalizedSignature": "BinarySearch|(T):System.Int32|static=false",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "ParameterCount": 1
        },
        {
          "ClrName": "Contains",
          "TsEmitName": "Contains",
          "NormalizedSignature": "Contains|(T):System.Boolean|static=false",
          "Provenance": "InlineFromInterface",
          "EmitScope": "ClassSurface",
          "SourceInterface": "System.Collections.Generic.ICollection`1",
          "IsVirtual": true,
          "IsSealed": true,
          "ParameterCount": 1
        }
      ],

      "Properties": [
        {
          "ClrName": "Count",
          "TsEmitName": "Count",
          "NormalizedSignature": "Count|:System.Int32|static=false|accessor=get",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "IsStatic": false,
          "IsVirtual": true,
          "IsSealed": true,
          "IsIndexer": false,
          "HasGetter": true,
          "HasSetter": false
        },
        {
          "ClrName": "Item",
          "TsEmitName": "Item",
          "NormalizedSignature": "Item|:T|static=false|accessor=getset",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "IsIndexer": true,
          "HasGetter": true,
          "HasSetter": true
        },
        {
          "ClrName": "Capacity",
          "TsEmitName": "Capacity",
          "NormalizedSignature": "Capacity|:System.Int32|static=false|accessor=getset",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "HasGetter": true,
          "HasSetter": true
        }
      ],

      "Fields": [],
      "Events": [],

      "Constructors": [
        {
          "NormalizedSignature": "ctor()",
          "IsStatic": false,
          "ParameterCount": 0
        },
        {
          "NormalizedSignature": "ctor(System.Int32)",
          "IsStatic": false,
          "ParameterCount": 1
        },
        {
          "NormalizedSignature": "ctor(IEnumerable_1)",
          "IsStatic": false,
          "ParameterCount": 1
        }
      ]
    }
  }
}
```

---

## Real-World Example: Dictionary<K,V> with Explicit Interface Members

From `System.Collections.Generic/internal/metadata.json`:

```json
{
  "Types": {
    "Dictionary_2": {
      "ClrName": "System.Collections.Generic.Dictionary`2",
      "TsEmitName": "Dictionary_2",
      "Arity": 2,

      "Methods": [
        {
          "ClrName": "Add",
          "TsEmitName": "Add",
          "NormalizedSignature": "Add|(TKey,TValue):System.Void|static=false",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "IsVirtual": true,
          "IsSealed": true,
          "ParameterCount": 2
        },
        {
          "ClrName": "Add",
          "TsEmitName": "Add$view",
          "NormalizedSignature": "Add|(KeyValuePair_2):System.Void|static=false",
          "Provenance": "ExplicitView",
          "EmitScope": "ViewOnly",
          "SourceInterface": "System.Collections.Generic.ICollection`1",
          "IsVirtual": true,
          "ParameterCount": 1
        },
        {
          "ClrName": "TryGetValue",
          "TsEmitName": "TryGetValue",
          "NormalizedSignature": "TryGetValue|(TKey,TValue&):System.Boolean|static=false",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "IsVirtual": true,
          "IsSealed": true,
          "ParameterCount": 2
        }
      ],

      "Properties": [
        {
          "ClrName": "Count",
          "TsEmitName": "Count",
          "NormalizedSignature": "Count|:System.Int32|static=false|accessor=get",
          "Provenance": "InlineFromInterface",
          "EmitScope": "ClassSurface",
          "SourceInterface": "System.Collections.Generic.ICollection`1",
          "IsVirtual": true,
          "HasGetter": true,
          "HasSetter": false
        },
        {
          "ClrName": "Item",
          "TsEmitName": "Item",
          "NormalizedSignature": "Item|:TValue|static=false|accessor=getset",
          "Provenance": "Declared",
          "EmitScope": "ClassSurface",
          "IsIndexer": true,
          "HasGetter": true,
          "HasSetter": true
        }
      ]
    }
  }
}
```

---

## How Tsonic Consumes Metadata

### 1. Type Lookup
```typescript
// TypeScript: new List_1<string>()
// Tsonic loads metadata:
const metadata = loadMetadata("System.Collections.Generic");
const listMeta = metadata.Types["List_1"];

// Get CLR name
const clrName = listMeta.ClrName;  // "System.Collections.Generic.List`1"

// Emit C#:
new List<string>()
```

### 2. Method Call with Virtual Detection
```typescript
// TypeScript: list.Add("hello")
const addMethod = listMeta.Methods.find(m =>
  m.TsEmitName === "Add" &&
  m.ParameterCount === 1 &&
  m.EmitScope === "ClassSurface"
);

// Check if virtual
if (addMethod.IsVirtual && !addMethod.IsSealed) {
  // Emit virtual call in C#
} else {
  // Emit direct call
}

// Emit C#: list.Add("hello")
```

### 3. Explicit Interface Member Access
```typescript
// TypeScript: dict.As_ICollection_1.Add(kvp)
const addView = dictMeta.Methods.find(m =>
  m.TsEmitName === "Add$view" &&
  m.EmitScope === "ViewOnly" &&
  m.SourceInterface === "System.Collections.Generic.ICollection`1"
);

// Emit C#: ((ICollection<KeyValuePair<TKey, TValue>>)dict).Add(kvp)
```

### 4. Property vs Indexer Distinction
```typescript
// TypeScript: list.Count
const countProp = listMeta.Properties.find(p =>
  p.TsEmitName === "Count" &&
  !p.IsIndexer
);
// Emit C#: list.Count

// TypeScript: list.Item (indexer accessed as property in TS)
const itemProp = listMeta.Properties.find(p =>
  p.TsEmitName === "Item" &&
  p.IsIndexer
);
// In TS declaration: Item: T
// But actual access is: list[0] (not emitted, use array syntax)
```

### 5. Static Class Handling
```typescript
// TypeScript: Math.Abs(value)
const mathMeta = metadata.Types["Math"];
if (mathMeta.Kind === "StaticNamespace") {
  // All members must be static
  // Emit C#: Math.Abs(value)
}
```

---

## Key Implementation Notes

1. **Generic Type Names**:
   - Metadata uses CLR backtick: `List`1`, `Dictionary`2`
   - TypeScript uses underscore: `List_1`, `Dictionary_2`
   - Arity in metadata must match TS type parameter count

2. **Method Overloads**:
   - Same `ClrName`, different `TsEmitName` (e.g., `BinarySearch`, `BinarySearch2`)
   - Use `NormalizedSignature` for exact overload matching
   - `ParameterCount` helps narrow down candidates

3. **Provenance Tracking**:
   - `Declared`: Direct member, emit normally
   - `InlineFromInterface`: Inherited, may need interface cast
   - `ExplicitView`: Requires explicit interface cast in C#
   - `SynthesizedViewOnly`: Generated by tsbindgen for explicit impl

4. **EmitScope Handling**:
   - `ClassSurface`: Accessible directly on instance
   - `ViewOnly`: Only via `As_IInterface` view property
   - `Omitted`: Not in .d.ts, but tracked in metadata (indexers)

5. **Virtual Method Dispatch**:
   - `IsVirtual && !IsSealed`: True virtual call
   - `IsVirtual && IsSealed`: Sealed override, can be direct call
   - `IsOverride`: Overrides base method
   - `IsAbstract`: Must be implemented by derived class

6. **Accessibility**:
   - `Public`: Always accessible
   - `Protected`: Only in derived classes
   - `Internal`: Only within assembly (not exposed to TypeScript)
   - `Private`: Never exposed (shouldn't appear in metadata)

---

## Performance Considerations

- **Metadata size**: ~1.5M+ lines total for BCL
- **System.Collections.Generic**: ~17k lines
- **Lazy loading**: Load metadata per-namespace as needed
- **Caching**: Cache parsed metadata per compilation session
- **Index by TsEmitName**: Build lookup maps for O(1) access

---

## See Also

- [bindings.md](bindings.md) - Name transformation tracking (TS ↔ CLR mapping)
- [runtime-contract.md](runtime-contract.md) - Runtime loading and method resolution
- [spec/architecture/02-phase-program.md](architecture/02-phase-program.md) - Metadata registry loading
- [spec/architecture/05-phase-ir.md](architecture/05-phase-ir.md) - Binding resolution using metadata
