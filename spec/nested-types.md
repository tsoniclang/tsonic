# Nested Types

## Overview

C# supports nested types (types defined inside other types). TypeScript doesn't have true nested type syntax, so tsbindgen flattens nested types using a special naming convention.

**C# Nested Types:**
```csharp
public class OuterClass
{
    public class NestedClass { }
    public struct NestedStruct { }
    public enum NestedEnum { }
}
```

**TypeScript Equivalent:**
```typescript
export class OuterClass {
    // Outer class members
}

// Nested type flattened with $ separator
export class OuterClass$NestedClass {
    // Nested class members
}

export class OuterClass$NestedStruct {
    // Nested struct members
}

export enum OuterClass$NestedEnum {
    // Nested enum members
}
```

---

## Naming Convention

### CLR → TypeScript Name Mapping

| CLR Name (Reflection) | TypeScript Name | Notes |
|-----------------------|-----------------|-------|
| `Outer+Nested` | `Outer$Nested` | Plus (`+`) becomes dollar (`$`) |
| `List`1+Enumerator` | `List_1$Enumerator` | Generics use underscore, nesting uses dollar |
| `A+B+C` | `A$B$C` | Multiple nesting levels |
| `Generic`2+Nested`1` | `Generic_2$Nested_1` | Both outer and nested generic |

**Rules:**
1. CLR uses `+` for nested types (reflection metadata)
2. TypeScript uses `$` (valid identifier character)
3. Generic arity: backtick (\`) → underscore (`_`)
4. Nesting separator: plus (`+`) → dollar (`$`)

### Why Dollar Sign?

- Valid TypeScript identifier character
- Rarely used in normal identifiers (low collision risk)
- Visually distinct from underscore (used for generics)
- Consistent with other compilers (Scala uses `$` for inner classes)

---

## Metadata Representation

### clrName

Full CLR name with plus sign:

```json
{
  "clrName": "System.Collections.Generic.List`1+Enumerator",
  "tsEmitName": "List_1$Enumerator"
}
```

### tsEmitName

TypeScript-safe name with dollar sign:

```json
{
  "clrName": "System.Collections.Generic.List`1+Enumerator",
  "tsEmitName": "List_1$Enumerator"
}
```

---

## TypeScript Declaration Patterns

### Simple Nested Class

**C#:**
```csharp
namespace System.IO
{
    public class FileStream
    {
        public class SafeFileHandle { }
    }
}
```

**TypeScript:**
```typescript
declare namespace System.IO {
    export class FileStream {
        // Outer class members
    }

    export class FileStream$SafeFileHandle {
        // Nested class members
    }

    // Optional: Type alias for convenience
    export namespace FileStream {
        export type SafeFileHandle = FileStream$SafeFileHandle;
    }
}
```

**Usage:**
```typescript
import { FileStream } from "System.IO";

// Direct access via $ name
const handle = new FileStream$SafeFileHandle();

// Or via namespace alias (if provided)
const handle2 = new FileStream.SafeFileHandle();
```

### Generic Nested Type

**C#:**
```csharp
public class List<T>
{
    public struct Enumerator { }
}
```

**TypeScript:**
```typescript
export class List_1<T> {
    // List<T> members
}

export class List_1$Enumerator {
    // Enumerator members (not generic itself)
}

// Type alias
export namespace List_1 {
    export type Enumerator = List_1$Enumerator;
}
```

### Nested Generic Type

**C#:**
```csharp
public class Dictionary<TKey, TValue>
{
    public class KeyCollection<T> { }
}
```

**TypeScript:**
```typescript
export class Dictionary_2<TKey, TValue> {
    // Dictionary members
}

export class Dictionary_2$KeyCollection_1<T> {
    // Nested generic type
}

// Type alias
export namespace Dictionary_2 {
    export type KeyCollection<T> = Dictionary_2$KeyCollection_1<T>;
}
```

---

## Common BCL Examples

### List<T>.Enumerator

**C# usage:**
```csharp
var list = new List<int> { 1, 2, 3 };
List<int>.Enumerator enumerator = list.GetEnumerator();
while (enumerator.MoveNext()) {
    Console.WriteLine(enumerator.Current);
}
```

**TypeScript:**
```typescript
import { List, List_1$Enumerator } from "System.Collections.Generic";

const list = new List<number>();
list.Add(1);
list.Add(2);
list.Add(3);

const enumerator: List_1$Enumerator = list.GetEnumerator();
while (enumerator.MoveNext()) {
    console.log(enumerator.Current);
}
```

### Dictionary<K, V>.KeyCollection

**C# usage:**
```csharp
var dict = new Dictionary<string, int>();
Dictionary<string, int>.KeyCollection keys = dict.Keys;
```

**TypeScript:**
```typescript
import { Dictionary, Dictionary_2$KeyCollection } from "System.Collections.Generic";

const dict = new Dictionary<string, number>();
const keys: Dictionary_2$KeyCollection = dict.Keys;
```

### Environment.SpecialFolder (Nested Enum)

**C# usage:**
```csharp
string path = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
```

**TypeScript:**
```typescript
import { Environment, Environment$SpecialFolder } from "System";

const path = Environment.GetFolderPath(Environment$SpecialFolder.Desktop);
```

---

## Multiple Nesting Levels

**C#:**
```csharp
public class A
{
    public class B
    {
        public class C { }
    }
}
```

**TypeScript:**
```typescript
export class A { }
export class A$B { }
export class A$B$C { }

// Type aliases for nested access
export namespace A {
    export type B = A$B;
    export namespace B {
        export type C = A$B$C;
    }
}

// Usage
const a = new A();
const b = new A$B();           // Direct
const b2 = new A.B();          // Via alias
const c = new A$B$C();         // Direct
const c2 = new A.B.C();        // Via alias
```

---

## Tsonic Compiler Handling

### 1. Type Name Resolution

When compiler sees `List_1$Enumerator`:

```typescript
// Parse nested type name
const parts = typeName.split("$");
// parts = ["List_1", "Enumerator"]

// Resolve outer type
const outerType = resolveType("List_1");

// Find nested type in metadata
const nestedType = metadata.types.find(t =>
    t.tsEmitName === "List_1$Enumerator"
);
```

### 2. C# Emission

**TypeScript:**
```typescript
const enumerator = new List_1$Enumerator();
```

**C# (generated):**
```csharp
var enumerator = new List<T>.Enumerator();
```

**Name Transformation:**
1. Split on `$`: `List_1$Enumerator` → `["List_1", "Enumerator"]`
2. Convert `List_1` → `List<T>` (apply generic arity)
3. Combine with `.`: `List<T>.Enumerator`

### 3. Generic Argument Inference

**TypeScript:**
```typescript
const list = new List<string>();
const enumerator = list.GetEnumerator();  // Returns List_1$Enumerator
```

**Type Analysis:**
1. `list` has type `List<string>` → `List_1<string>`
2. `GetEnumerator()` returns `List_1$Enumerator`
3. Must use outer type's generic arguments for emission

**C# (generated):**
```csharp
var list = new List<string>();
var enumerator = list.GetEnumerator();  // List<string>.Enumerator
```

---

## Metadata Example

```json
{
  "namespace": "System.Collections.Generic",
  "types": [
    {
      "clrName": "System.Collections.Generic.List`1",
      "tsEmitName": "List_1",
      "kind": "Class",
      "arity": 1
    },
    {
      "clrName": "System.Collections.Generic.List`1+Enumerator",
      "tsEmitName": "List_1$Enumerator",
      "kind": "Struct",
      "arity": 0,
      "outerType": "System.Collections.Generic.List`1"
    }
  ]
}
```

**Optional Fields:**
- `outerType`: CLR name of enclosing type
- `nestingLevel`: How many levels deep (0 = not nested, 1 = first level, etc.)

---

## Import and Usage Patterns

### Pattern 1: Direct Import

```typescript
import { List_1$Enumerator } from "System.Collections.Generic";

const enumerator: List_1$Enumerator = getEnumerator();
```

### Pattern 2: Via Outer Type (if aliases provided)

```typescript
import { List } from "System.Collections.Generic";

const enumerator: List.Enumerator = getEnumerator();
```

### Pattern 3: Wildcard Import

```typescript
import * as Collections from "System.Collections.Generic";

const list = new Collections.List<number>();
const enumerator: Collections.List_1$Enumerator = list.GetEnumerator();
```

---

## Common Issues

### Issue 1: Wrong Separator

**Wrong:**
```typescript
import { List.Enumerator } from "System.Collections.Generic";  // ❌
```

**Correct:**
```typescript
import { List_1$Enumerator } from "System.Collections.Generic";  // ✅
```

### Issue 2: Missing Generic Arity

**Wrong:**
```typescript
import { List$Enumerator } from "System.Collections.Generic";  // ❌ Missing _1
```

**Correct:**
```typescript
import { List_1$Enumerator } from "System.Collections.Generic";  // ✅
```

### Issue 3: Confusion with Namespace

```typescript
// This is a namespace
namespace System.Collections { }

// This is a nested type
class List_1$Enumerator { }
```

Nested types use `$`, namespaces use `.`.

---

## Best Practices

1. **Use dollar sign for nested types**: `Outer$Nested`
2. **Use underscore for generics**: `List_1`
3. **Combine correctly**: `List_1$Enumerator` (not `List$Enumerator`)
4. **Import directly when possible**: `import { Outer$Nested } from ...`
5. **Document nested types**: Comment that type is nested

**Good:**
```typescript
import { Dictionary_2, Dictionary_2$KeyCollection } from "System.Collections.Generic";

// Clear that KeyCollection is nested
const keys: Dictionary_2$KeyCollection = dict.Keys;
```

**Bad:**
```typescript
// Confusing name without context
import { KeyCollection } from "System.Collections.Generic";  // ❌ Which KeyCollection?
```

---

## Diagnostics

### TSN8001: Invalid Nested Type Name

```
Invalid nested type name 'List.Enumerator'.
Use 'List_1$Enumerator' instead.
```

### TSN8002: Nested Type Not Found

```
Nested type 'List_1$Enumerator' not found.
Did you mean 'List_1$Enumerator2'?
```

### TSN8003: Missing Outer Type Generics

```
Nested type 'Dictionary$KeyCollection' requires outer type generics.
Use 'Dictionary_2$KeyCollection'.
```

---

## See Also

- [metadata.md](metadata.md) - clrName and tsEmitName format
- [type-mappings.md](type-mappings.md) - Generic arity naming conventions
- [namespaces.md](namespaces.md) - Namespace vs nested type distinction
- [tsbindgen spec/architecture/09-renaming.md](../../tsbindgen/spec/architecture/09-renaming.md) - Name transformation rules
