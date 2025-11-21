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
  readonly namespace: string; // "System.Collections.Generic"
  readonly contributingAssemblies: string[]; // ["System.Private.CoreLib", ...]
  readonly types: TypeMetadata[]; // Array of all types in namespace
};
```

**Example:**

```json
{
  "namespace": "System.Collections.Generic",
  "contributingAssemblies": ["System.Private.CoreLib", "System.Runtime"],
  "types": [
    {
      /* TypeMetadata for IList<T> */
    },
    {
      /* TypeMetadata for List<T> */
    },
    {
      /* TypeMetadata for Dictionary<K,V> */
    }
  ]
}
```

**Important:** `types` is an **array**, not a keyed object. Use `clrName` or `tsEmitName` to identify types.

---

## TypeMetadata Schema

```typescript
type TypeMetadata = {
  // Identity
  readonly clrName: string; // Full CLR name: "System.Collections.Generic.List`1"
  readonly tsEmitName: string; // TypeScript name: "List_1" (underscore for generics)
  readonly kind: TypeKind; // "Class" | "Interface" | "Struct" | ...
  readonly accessibility: Accessibility; // "Public" | "Internal" | ...

  // Modifiers
  readonly isAbstract: boolean; // Abstract type (cannot instantiate)
  readonly isSealed: boolean; // Sealed type (cannot inherit)
  readonly isStatic: boolean; // Static class (all members static)
  readonly arity: number; // Generic parameter count (0 for non-generic)

  // Inheritance
  readonly baseType?: string | null; // Base class CLR name, null for Object/interfaces
  readonly interfaces?: string[]; // Implemented interface CLR names
  readonly isValueType?: boolean; // true for struct/enum, false for class/interface

  // Members
  readonly methods: MethodMetadata[];
  readonly properties: PropertyMetadata[];
  readonly fields: FieldMetadata[];
  readonly events: EventMetadata[];
  readonly constructors: ConstructorMetadata[];

  // Intentional Omissions (members not emitted to .d.ts due to TypeScript limitations)
  readonly intentionalOmissions?: IntentionalOmissions;

  // Explicit Views (As_IInterface properties for explicit interface implementations)
  readonly explicitViews?: ExplicitView[];
};

type TypeKind =
  | "Class"
  | "Interface"
  | "Struct"
  | "Enum"
  | "Delegate"
  | "StaticNamespace"; // For C# static classes

type Accessibility =
  | "Public"
  | "Internal"
  | "Protected"
  | "Private"
  | "ProtectedInternal"
  | "PrivateProtected";

type IntentionalOmissions = {
  readonly indexers?: OmittedMember[]; // Indexers omitted (TypeScript overload conflicts)
  readonly genericStaticMembers?: OmittedMember[]; // Generic statics omitted (TS limitation)
  readonly other?: OmittedMember[]; // Other omissions with reasons
};

type OmittedMember = {
  readonly signature: string; // C#-style signature
  readonly reason: string; // Human-readable explanation
};

type ExplicitView = {
  readonly interfaceClrName: string; // Interface CLR name
  readonly interfaceTsEmitName: string; // Interface TypeScript name
  readonly propertyName: string; // As_IInterface property name
  readonly members: string[]; // Member StableIds in this view
};
```

---

## MethodMetadata Schema

```typescript
type MethodMetadata = {
  // Identity
  readonly clrName: string; // "Add", "SelectMany"
  readonly tsEmitName: string; // "Add", "selectMany" (if camelCase)
  readonly normalizedSignature: string; // "Add|(T):System.Void|static=false"

  // Provenance
  readonly provenance: Provenance; // Where method came from
  readonly emitScope: EmitScope; // Where emitted in TypeScript
  readonly sourceInterface?: string; // For ViewOnly: "System.Collections.IList"

  // Modifiers
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isSealed: boolean; // sealed override

  // Signature
  readonly arity: number; // Generic method parameter count
  readonly parameterCount: number; // Total parameters
  readonly parameters?: ParameterMetadata[]; // Method parameters (may not be in all files)
  readonly returnType?: string; // Return type CLR name
  readonly genericParameters?: string[]; // Generic parameter names ["TSource", "TResult"]
};

type Provenance =
  | "Declared" // Direct member on type
  | "InlineFromInterface" // Inherited from interface
  | "InlineFromBase" // Inherited from base class
  | "SynthesizedViewOnly" // Synthesized for explicit interface impl
  | "ExplicitView"; // Explicit interface implementation

type EmitScope =
  | "ClassSurface" // Emitted directly on class/interface
  | "ViewOnly" // Emitted in As_IInterface view property
  | "Omitted"; // Intentionally not emitted
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
  readonly clrName: string; // "Count", "Item"
  readonly tsEmitName: string; // "count" (if camelCase)
  readonly normalizedSignature: string; // "Count|:System.Int32|static=false|accessor=get"

  // Provenance
  readonly provenance: Provenance;
  readonly emitScope: EmitScope;
  readonly sourceInterface?: string;

  // Modifiers
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isSealed: boolean;

  // Property-specific
  readonly isIndexer: boolean; // C# indexer (this[int index])
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
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
  readonly clrName: string;
  readonly tsEmitName: string;
  readonly normalizedSignature: string;

  // Modifiers
  readonly isStatic: boolean;
  readonly isReadOnly: boolean;
  readonly isLiteral: boolean; // const field
};
```

---

## EventMetadata Schema

```typescript
type EventMetadata = {
  // Identity
  readonly clrName: string;
  readonly tsEmitName: string;
  readonly normalizedSignature: string;

  // Modifiers
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
};
```

---

## ConstructorMetadata Schema

```typescript
type ConstructorMetadata = {
  readonly normalizedSignature: string; // "ctor()" or "ctor(System.Int32)"
  readonly isStatic: boolean; // Static constructor (type initializer)
  readonly parameterCount: number;
  readonly parameters?: ParameterMetadata[]; // Constructor parameters
};
```

---

## ParameterMetadata Schema

**Note:** Parameter metadata is included in method/constructor metadata in tsbindgen spec but may not be present in all actual output files.

```typescript
type ParameterMetadata = {
  readonly name: string; // Parameter name
  readonly type: string; // CLR type name (with generic args)
  readonly isRef: boolean; // ref parameter
  readonly isOut: boolean; // out parameter
  readonly isIn?: boolean; // in parameter (C# 7.2+)
  readonly isParams: boolean; // params array parameter
  readonly defaultValue?: any | null; // Default value for optional parameters
};
```

**Ref/Out/In Parameters:**

- `ref`: Parameter passed by reference (can read and write)
- `out`: Output parameter (must be assigned before method returns)
- `in`: Read-only reference parameter (C# 7.2+, performance optimization)
- In TypeScript, these are wrapped in `TSByRef<T>` type

**Example:**

```typescript
// C#: void Method(ref int x, out string y, in double z, params int[] rest)
{
  "name": "x",
  "type": "System.Int32",
  "isRef": true,
  "isOut": false,
  "isParams": false
}
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
      "clrName": "System.Collections.Generic.List`1",
      "tsEmitName": "List_1",
      "Kind": "Class",
      "Accessibility": "Public",
      "isAbstract": false,
      "isSealed": false,
      "isStatic": false,
      "arity": 1,

      "Methods": [
        {
          "clrName": "Add",
          "tsEmitName": "Add",
          "normalizedSignature": "Add|(T):System.Void|static=false",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "isStatic": false,
          "isAbstract": false,
          "isVirtual": true,
          "isOverride": false,
          "isSealed": true,
          "arity": 0,
          "parameterCount": 1
        },
        {
          "clrName": "BinarySearch",
          "tsEmitName": "BinarySearch",
          "normalizedSignature": "BinarySearch|(System.Int32,System.Int32,T,IComparer_1):System.Int32|static=false",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "isStatic": false,
          "parameterCount": 4
        },
        {
          "clrName": "BinarySearch",
          "tsEmitName": "BinarySearch2",
          "normalizedSignature": "BinarySearch|(T):System.Int32|static=false",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "parameterCount": 1
        },
        {
          "clrName": "Contains",
          "tsEmitName": "Contains",
          "normalizedSignature": "Contains|(T):System.Boolean|static=false",
          "provenance": "InlineFromInterface",
          "emitScope": "ClassSurface",
          "sourceInterface": "System.Collections.Generic.ICollection`1",
          "isVirtual": true,
          "isSealed": true,
          "parameterCount": 1
        }
      ],

      "Properties": [
        {
          "clrName": "Count",
          "tsEmitName": "Count",
          "normalizedSignature": "Count|:System.Int32|static=false|accessor=get",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "isStatic": false,
          "isVirtual": true,
          "isSealed": true,
          "isIndexer": false,
          "hasGetter": true,
          "hasSetter": false
        },
        {
          "clrName": "Item",
          "tsEmitName": "Item",
          "normalizedSignature": "Item|:T|static=false|accessor=getset",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "isIndexer": true,
          "hasGetter": true,
          "hasSetter": true
        },
        {
          "clrName": "Capacity",
          "tsEmitName": "Capacity",
          "normalizedSignature": "Capacity|:System.Int32|static=false|accessor=getset",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "hasGetter": true,
          "hasSetter": true
        }
      ],

      "Fields": [],
      "Events": [],

      "Constructors": [
        {
          "normalizedSignature": "ctor()",
          "isStatic": false,
          "parameterCount": 0
        },
        {
          "normalizedSignature": "ctor(System.Int32)",
          "isStatic": false,
          "parameterCount": 1
        },
        {
          "normalizedSignature": "ctor(IEnumerable_1)",
          "isStatic": false,
          "parameterCount": 1
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
      "clrName": "System.Collections.Generic.Dictionary`2",
      "tsEmitName": "Dictionary_2",
      "arity": 2,

      "Methods": [
        {
          "clrName": "Add",
          "tsEmitName": "Add",
          "normalizedSignature": "Add|(TKey,TValue):System.Void|static=false",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "isVirtual": true,
          "isSealed": true,
          "parameterCount": 2
        },
        {
          "clrName": "Add",
          "tsEmitName": "Add$view",
          "normalizedSignature": "Add|(KeyValuePair_2):System.Void|static=false",
          "provenance": "ExplicitView",
          "emitScope": "ViewOnly",
          "sourceInterface": "System.Collections.Generic.ICollection`1",
          "isVirtual": true,
          "parameterCount": 1
        },
        {
          "clrName": "TryGetValue",
          "tsEmitName": "TryGetValue",
          "normalizedSignature": "TryGetValue|(TKey,TValue&):System.Boolean|static=false",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "isVirtual": true,
          "isSealed": true,
          "parameterCount": 2
        }
      ],

      "Properties": [
        {
          "clrName": "Count",
          "tsEmitName": "Count",
          "normalizedSignature": "Count|:System.Int32|static=false|accessor=get",
          "provenance": "InlineFromInterface",
          "emitScope": "ClassSurface",
          "sourceInterface": "System.Collections.Generic.ICollection`1",
          "isVirtual": true,
          "hasGetter": true,
          "hasSetter": false
        },
        {
          "clrName": "Item",
          "tsEmitName": "Item",
          "normalizedSignature": "Item|:TValue|static=false|accessor=getset",
          "provenance": "Declared",
          "emitScope": "ClassSurface",
          "isIndexer": true,
          "hasGetter": true,
          "hasSetter": true
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
const clrName = listMeta.ClrName; // "System.Collections.Generic.List`1"

// Emit C#:
new List<string>();
```

### 2. Method Call with Virtual Detection

```typescript
// TypeScript: list.Add("hello")
const addMethod = listMeta.Methods.find(
  (m) =>
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
const addView = dictMeta.Methods.find(
  (m) =>
    m.TsEmitName === "Add$view" &&
    m.EmitScope === "ViewOnly" &&
    m.SourceInterface === "System.Collections.Generic.ICollection`1"
);

// Emit C#: ((ICollection<KeyValuePair<TKey, TValue>>)dict).Add(kvp)
```

### 4. Property vs Indexer Distinction

```typescript
// TypeScript: list.Count
const countProp = listMeta.Properties.find(
  (p) => p.TsEmitName === "Count" && !p.IsIndexer
);
// Emit C#: list.Count

// TypeScript: list.Item (indexer accessed as property in TS)
const itemProp = listMeta.Properties.find(
  (p) => p.TsEmitName === "Item" && p.IsIndexer
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
