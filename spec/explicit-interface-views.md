# Explicit Interface Views (As_IInterface Pattern)

## Overview

Explicit interface views solve the problem of **explicit interface implementations** (EII) in C# that cannot be represented in TypeScript's structural type system.

**Problem:** In C#, a class can implement interface members explicitly, making them only accessible when the instance is cast to that interface type:

```csharp
class List<T> : ICollection<T>
{
    // Implicit implementation - always visible
    public void Add(T item) { }

    // Explicit implementation - only via ICollection<T> cast
    void ICollection<T>.CopyTo(T[] array, int index) { }
}
```

**Solution:** tsbindgen generates **As_IInterface** properties that provide typed views:

```typescript
class List_1<T> {
    Add(item: T): void;  // Always available
    As_ICollection: ICollection_1<T>;  // Cast to access explicit members
}

// Usage:
const list = new List_1<string>();
list.Add("hello");  // Direct access
list.As_ICollection.CopyTo(array, 0);  // Via view
```

---

## When Views Are Generated

tsbindgen generates explicit views when:

1. **Explicit Interface Implementation (EII)**: C# class implements interface member explicitly
2. **Structural Mismatch**: Class surface doesn't satisfy interface signature structurally
3. **Name Conflicts**: Multiple interfaces require same method name with different signatures
4. **Generic Constraints**: Interface has generic constraints class doesn't satisfy structurally

**No view generated when:**
- Class implements interface implicitly (member is on class surface)
- TypeScript structural typing already satisfied (duck typing works)

---

## Metadata Representation

### In TypeMetadata

```typescript
type TypeMetadata = {
  // ...other fields
  readonly explicitViews?: ExplicitView[];
};

type ExplicitView = {
  readonly interfaceClrName: string;     // "System.Collections.Generic.ICollection`1"
  readonly interfaceTsEmitName: string;  // "ICollection_1"
  readonly propertyName: string;         // "As_ICollection"
  readonly members: string[];            // Member StableIds included in view
};
```

**Example:**
```json
{
  "explicitViews": [
    {
      "interfaceClrName": "System.Collections.Generic.ICollection`1",
      "interfaceTsEmitName": "ICollection_1",
      "propertyName": "As_ICollection",
      "members": [
        "System.Private.CoreLib:System.Collections.Generic.ICollection`1.CopyTo"
      ]
    }
  ]
}
```

### In MethodMetadata

Members that appear in views have special metadata:

```typescript
type MethodMetadata = {
  // ...other fields
  readonly provenance: Provenance;       // "ExplicitView" or "SynthesizedViewOnly"
  readonly emitScope: EmitScope;         // "ViewOnly" means only in As_IInterface
  readonly sourceInterface?: string;     // Which interface declares this member
};
```

**EmitScope Values:**
- `"ClassSurface"`: Emitted directly on class (implicit implementation)
- `"ViewOnly"`: Only emitted in As_IInterface view (explicit implementation)
- `"Omitted"`: Not emitted (intentionally excluded)

**Provenance Values:**
- `"Declared"`: Direct member on type
- `"InlineFromInterface"`: Inherited interface member (implicit)
- `"InlineFromBase"`: Inherited base class member
- `"SynthesizedViewOnly"`: Created by tsbindgen for explicit view
- `"ExplicitView"`: Explicit interface implementation

---

## TypeScript Declaration Pattern

### Generated Interface View

```typescript
// List<T> class
export class List_1<T> {
    // Class surface members (EmitScope: ClassSurface)
    Add(item: T): void;
    readonly Count: number;

    // View properties for explicit interface implementations
    readonly As_ICollection: ICollection_1<T>;
    readonly As_IEnumerable: IEnumerable_1<T>;
}

// Interface view type
export interface __List_1$views<T> {
    readonly As_ICollection: ICollection_1<T>;
    readonly As_IEnumerable: IEnumerable_1<T>;
}

// Combined type alias (what users import)
export type List<T> = List_1$instance<T> & __List_1$views<T>;
```

### Usage in TypeScript

```typescript
import { List, ICollection } from "System.Collections.Generic";

const list = new List<string>();

// Direct access to class surface members
list.Add("hello");
console.log(list.Count);

// Access explicit interface members via view
const array = new Array<string>(10);
list.As_ICollection.CopyTo(array, 0);

// Type-safe interface reference
const collection: ICollection<string> = list.As_ICollection;
collection.Clear();
```

---

## C# Code Generation

When Tsonic sees `.As_IInterface` access:

```typescript
// TypeScript
list.As_ICollection.CopyTo(array, 0);
```

Tsonic must emit a **cast** in C#:

```csharp
// C# (generated)
((ICollection<string>)list).CopyTo(array, 0);
```

**Why cast is required:**
- C# explicit interface implementations are only accessible via interface reference
- Direct call `list.CopyTo()` won't compile if CopyTo is explicit
- Cast `((ICollection<T>)list)` makes explicit members accessible

---

## Structural Conformance vs Explicit Views

tsbindgen analyzes whether a class structurally implements an interface:

### Case 1: Structural Conformance (No View Needed)

```csharp
// C#
interface IFoo {
    void Bar();
}

class MyClass : IFoo {
    public void Bar() { }  // Implicit implementation
}
```

```typescript
// TypeScript - No view needed, structural typing works
interface IFoo {
    Bar(): void;
}

class MyClass implements IFoo {
    Bar(): void { }
}

const obj: IFoo = new MyClass();  // Structural typing
obj.Bar();  // Works directly
```

### Case 2: Explicit Implementation (View Required)

```csharp
// C#
interface IFoo {
    void Bar();
}

class MyClass : IFoo {
    void IFoo.Bar() { }  // Explicit implementation
}
```

```typescript
// TypeScript - View required
interface IFoo {
    Bar(): void;
}

class MyClass {
    // Bar() not on class surface
    readonly As_IFoo: IFoo;
}

const obj = new MyClass();
obj.As_IFoo.Bar();  // Via view
```

---

## Diamond Inheritance Example

When multiple interfaces define the same member:

```csharp
// C#
interface IA { void Foo(); }
interface IB { void Foo(); }

class MyClass : IA, IB {
    void IA.Foo() { /* Implementation A */ }
    void IB.Foo() { /* Implementation B */ }
}
```

```typescript
// TypeScript
interface IA { Foo(): void; }
interface IB { Foo(): void; }

class MyClass {
    readonly As_IA: IA;
    readonly As_IB: IB;
}

const obj = new MyClass();
obj.As_IA.Foo();  // Calls IA implementation
obj.As_IB.Foo();  // Calls IB implementation
```

---

## Implementation Requirements for Tsonic

### 1. Load Explicit Views from Metadata

```typescript
// Tsonic compiler loading metadata
const metadata = loadMetadata("System.Collections.Generic");
const listType = metadata.types.find(t => t.tsEmitName === "List_1");

if (listType.explicitViews) {
    for (const view of listType.explicitViews) {
        console.log(`View: ${view.propertyName}`);
        console.log(`Interface: ${view.interfaceTsEmitName}`);
    }
}
```

### 2. Detect As_IInterface Access

```typescript
// TypeScript AST analysis
// Detect: list.As_ICollection.CopyTo(...)
if (isPropertyAccess(node) &&
    node.name.text.startsWith("As_")) {

    const interfaceName = node.name.text.substring(3); // Remove "As_"
    const view = findExplicitView(typeMetadata, interfaceName);

    if (view) {
        // Emit cast in C#
        emitInterfaceCast(node, view.interfaceClrName);
    }
}
```

### 3. Emit C# Cast

```typescript
// C# emission
function emitInterfaceCast(node: PropertyAccessExpression, interfaceClrName: string) {
    emit("((");
    emit(interfaceClrName);
    emit(")");
    emitExpression(node.expression);  // The object being cast
    emit(")");

    // Then emit the member access
    // .CopyTo(...) part handled by subsequent call expression
}
```

### 4. Handle ViewOnly Members

```typescript
// When emitting method call on interface view
if (memberMetadata.emitScope === "ViewOnly") {
    // Must access via explicit view, not directly on class
    if (!isViaExplicitView(accessPath)) {
        diagnostic(TSN4001, "Member only accessible via explicit interface view");
    }
}
```

---

## Common Patterns

### Pattern 1: IEnumerable<T> Iteration

```typescript
// TypeScript
for (const item of list.As_IEnumerable) {
    console.log(item);
}
```

```csharp
// C# (generated)
foreach (var item in (IEnumerable<T>)list) {
    Console.WriteLine(item);
}
```

### Pattern 2: LINQ on Collections

```typescript
// TypeScript
import { Enumerable } from "System.Linq";

const filtered = Enumerable.Where(
    list.As_IEnumerable,
    x => x.length > 3
);
```

```csharp
// C# (generated)
using System.Linq;

var filtered = Enumerable.Where(
    (IEnumerable<string>)list,
    x => x.Length > 3
);
```

### Pattern 3: IDisposable Pattern

```typescript
// TypeScript
const stream = File.OpenRead("file.txt");
try {
    // Use stream
} finally {
    stream.As_IDisposable.Dispose();
}
```

```csharp
// C# (generated)
var stream = File.OpenRead("file.txt");
try {
    // Use stream
} finally {
    ((IDisposable)stream).Dispose();
}
```

---

## Diagnostics

### TSN4001: Member Only Available Via View

```
Member 'CopyTo' is only available via explicit interface view 'As_ICollection'.
Use: list.As_ICollection.CopyTo(...)
```

### TSN4002: Unknown Interface View

```
Unknown interface view 'As_IFoo' on type 'List<T>'.
Available views: As_ICollection, As_IEnumerable
```

### TSN4003: View Member Not Found

```
Member 'InvalidMethod' not found on interface view 'ICollection<T>'.
```

---

## Performance Considerations

- **No runtime overhead**: Views are compile-time only, emit direct C# casts
- **Type safety**: TypeScript type checker ensures views are used correctly
- **Metadata size**: Views add ~10-20% to metadata.json size for complex types
- **Compilation**: View detection is O(1) property name lookup

---

## See Also

- [metadata.md](metadata.md) - Metadata schema including explicitViews
- [diamond-inheritance.md](diamond-inheritance.md) - Resolving interface conflicts
- [structural-conformance.md](structural-conformance.md) - When views are needed
- [spec/architecture/04-phase-shape.md](../tsbindgen/spec/architecture/04-phase-shape.md) - tsbindgen view planning
