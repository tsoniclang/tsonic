# Type & Interface Translation Specification

**Purpose**

Document how TypeScript `type` aliases and `interface` declarations—including their generic variants—are mapped to C#. This extends the generics plan (`spec/15-generics.md`) to cover structural types, alias resolution, optional members, and index signatures.

---

## 1. Goals

- **Preserve semantics** for interfaces and aliases wherever C# can represent them.
- **Support generic interfaces and aliases**, using the same generic rules as classes/functions.
- **Handle structural features** (optional members, readonly modifiers, index signatures) via C# classes, records, or helper wrappers.
- **Resolve aliases** to concrete types used in emitted code, collapsing chains and specialisations.
- **Provide adapters** for structural inheritance and intersection types using the same monomorphisation strategy as generics.

---

## Structural vs Nominal Typing

- TypeScript is structurally typed; C# is nominal. We always generate nominal definitions (classes/interfaces) for structural shapes and wrap or clone incoming values so the C# compiler sees concrete types.
- This keeps runtime dispatch static and avoids `dynamic`.

## Mapped Types & Finite Expansions

When structural aliases or mapped types are instantiated with a concrete nominal type
**Example – simple recursive alias**

```typescript
type Node = { name: string; next?: Node };
```

Expands to the nominal C# class:

```csharp
public sealed class Node__Alias
{
    public string name { get; set; } = string.Empty;
    public Node__Alias? next { get; set; }
}
```

Self-referential fields are safe because C# supports nullable references pointing back to the same class. No diagnostic is emitted.

(e.g., `DeepReadonly<Settings>`), the emitter expands them into generated nominal classes. The expansion is structural but finite, so the resulting C# types are ordinary classes/records with nested types for nested objects. If the expansion is infinite or recursive without a base case, we emit `TSN7201`.

## 2. Interfaces (`interface Foo { ... }`)

### 2.1 Basic mapping

- Emit C# classes with auto-properties:

  ```typescript
  interface User {
    id: number;
    name: string;
    active?: boolean;
  }
  ```

  →

  ```csharp
  public class User
  {
      public double id { get; set; }
      public string name { get; set; }
      public bool? active { get; set; }
  }
  ```

- Optional members (`?`) become nullable reference/value types (`bool?`, `string?`).
- Readonly members map to `private set` auto-properties or fields.

### 2.2 Value Type Structs

TypeScript interfaces and classes can be emitted as C# **structs** instead of classes by extending/implementing the special `struct` marker type from `@tsonic/runtime`:

```typescript
import { struct } from "@tsonic/runtime";

export interface Point extends struct {
  x: number;
  y: number;
}
```

Emits as:

```csharp
public struct Point
{
    public double x { get; set; }
    public double y { get; set; }
}
```

**Rules:**

- The `struct` marker is a phantom type with a `__brand` property that is automatically filtered out during IR conversion.
- Works with both `interface` (using `extends`) and `class` (using `implements`).
- The marker is removed from the heritage clause in generated C#, so it never appears in the output.
- Structs cannot inherit from classes (C# limitation) - extending anything other than `struct` will cause C# compilation errors.
- Use structs for small, immutable value types to gain performance benefits from stack allocation.

**Example with class:**

```typescript
import { struct } from "@tsonic/runtime";

export class Vector3D implements struct {
  x: number;
  y: number;
  z: number;
}
```

Emits as:

```csharp
public struct Vector3D
{
    public double x { get; set; }
    public double y { get; set; }
    public double z { get; set; }
}
```

### 2.3 Generics

- Preserve generic parameters: `interface Box<T> { value: T; }` → `public class Box<T> { public T value { get; set; } }`.
- Constraints on generic interfaces follow `spec/15-generics.md` (structural constraint adapters, etc.).

### 2.4 Inheritance

- `interface Foo extends Bar, Baz { }` → C# class inheriting the generated base class (`Bar`) and implementing interfaces (`IBaz`). If all bases are interfaces, emit `public class Foo : Bar, IBaz`.
- Structural bases (`extends { id: number }`) trigger adapter generation (synthesise base interface/class).

### 2.5 Index signatures

- `interface Dict { [key: string]: number; }` → `public class Dict : Dictionary<string, double>` or a wrapper exposing typed indexer. Implement constructors to clone from TS objects as needed.
- Generic index signatures (`[key: string]: T`) use `Dictionary<string, T>`.

### 2.6 Intersection types (`extends Foo & Bar`)

- If both bases map to generated classes/interfaces, use C# multiple inheritance (one base class + interfaces). If structural, synthesise combined adapter.

### 2.7 Anonymous structural types

- Inline structural literals (e.g., `{ id: number; name: string }`) generate synthetic classes when an interface is not declared. Reuse adapter machinery from `spec/15-generics.md`.

---

## 3. Type Aliases (`type Foo = ...`)

### 3.1 Alias resolution

- Resolve alias chains using TypeScript checker. Aliases that resolve to class/interface definitions simply refer to the underlying C# type.
- Inline structural alias (e.g., `type User = { id: number; name: string };`) results in a generated class similar to interface mapping. Generated name derives from alias (`User_alias` if conflict).

### 3.2 Generics

- Generic aliases (`type Result<T> = Promise<T>;`) map to the underlying type with generic parameter preserved (`Task<T>`).
- Aliases referencing conditional/mapped types trigger the monomorphisation plan: specialise per instantiation or emit diagnostic if unbounded.

### 3.3 Alias usage in call sites

- When alias resolves to generated class, emitter uses that class directly. For structural alias, clone/adapt as needed (same as interface).

### 3.4 Namespacing & collisions

- Place generated classes in the same namespace as source file. Use deterministic suffixes to avoid collisions (e.g., `User__Alias`). Maintain map to avoid duplicate definitions.

---

## 4. Generics & Specialisation Recap

- Generic interfaces/aliases use the same rules as `spec/15-generics.md`.
- For structural constraints inside generics, synthesise interfaces/adapters per instantiation.
- Conditional/utility aliases that cannot be expressed statically are monomorphised: generate specialisations (`Foo__string`, `Foo__number`) and rewrite call sites.

---

## 5. Optional Members & Default Values

- Optional properties default to `default(T)` in generated constructors.
- Provide helper constructors to fill in missing values when wrapping TS objects.
- Readonly properties use `get; private set;` or init-only setters (C# 9). Ensure runtime wrappers respect immutability.

---

## 6. Runtime Helpers

- Add methods to clone JS objects into generated classes (`Tsonic.Runtime.Structural.Clone<T>(object source)`).
- For index signatures, provide bridging methods to/from `Dictionary` or runtime dynamic object.

---

## 7. Diagnostics

Emit diagnostics when interfaces or aliases use patterns we cannot support:

| Pattern                                          | Example                                                     | Diagnostic                                                   |
| ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Recursive aliases without base case              | `type Foo<T> = { child: Foo<T> };`                          | `TSN7201`: “Recursive structural alias not supported.”       |
| Conditional aliases with infinite instantiations | `type Result<T> = T extends string ? Foo<T> : Result<T[]>;` | `TSN7202`: “Conditional alias cannot be resolved; refactor.” |
| Interfaces with symbol index signatures          | `[key: symbol]: number;`                                    | `TSN7203`: “Symbol keys not supported in C#.”                |
| Generic interfaces with variadic constraints     | `interface Z<T extends unknown[]> { ... }`                  | `TSN7204`: “Variadic generic interface not supported.”       |

---

## 8. Implementation Tasks

1. **IR Enhancements**
   - Record interface/type alias declarations, including members, generics, constraints.
   - Resolve alias expansions via TypeScript checker.
   - For structural types, capture property metadata for adapter generation.

2. **Emitter**
   - Generate C# classes/interfaces for TypeScript interfaces/aliases.
   - Implement adapter generation utilities.
   - Ensure generics flow through definitions and call sites.
   - Integrate with monomorphisation for conditional aliases.

3. **Runtime**
   - Implement cloning/adaptation helpers (`Structural.Clone`, `DictionaryAdapter`).
   - Provide typed dynamic object base for property access.

4. **Tests**
   - Interface inheritance (nominal + structural).
   - Optional/readonly member mapping.
   - Index signature handling.
   - Generic interface + alias mapping.
   - Alias chains + monomorphised conditional aliases.

---
