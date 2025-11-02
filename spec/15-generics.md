# Generics Translation Specification

**Purpose**

Define how Tsonic preserves and transforms TypeScript generics when emitting C#. This document targets implementers (IR authors, emitter developers, runtime engineers) and assumes TypeScript performs all compile-time type checking. Our job is to produce efficient, mostly-static C# without relying on `dynamic`, while still matching TypeScript semantics. When TypeScript expresses something C# cannot represent directly, we fall back to monomorphized specialisations or clear diagnostics.

---

## 1. Goals & Non-Goals

- **Keep generated C# as generic as possible.** Use real `<T>` whenever C# supports it (classes, methods, `List<T>`, `Task<T>`, etc.).
- **Avoid `dynamic` by default.** Only use it when explicitly listed (e.g., diagnostics offering a dynamic opt-in). Performance matters.
- **Exploit TypeScript’s type proofs.** We trust the TypeScript checker. If all call sites are under our control (they are), we can specialise per instantiation.
- **Handle structural constraints via adapters.** If the constraint references properties instead of nominal types, we synthesise interfaces and wrappers.
- **Monomorphise “impossible” features.** Conditional types, variadic generics, and `this` typing are handled by emitting method specialisations for each observed instantiation.
- **Surface diagnostics when we cannot generate static C#.** No silent failures; give a TSN diagnostic with the offending pattern.

Non-goals: supporting every TypeScript utility type or advanced generic pattern from third-party code; keeping signatures generic when C# cannot represent them.

---

## 2. Pipeline Responsibilities

### 2.1 IR Enhancements

- Record generic parameters for every function, method, class, interface, type alias.
  - `name`, `constraint`, `defaultType`, `variance` (variance is rarely used; store for completeness).
- Record call-site instantiations. For each generic invocation, ask the TypeScript checker for concrete type arguments.
- Annotate structural constraints with the required property signatures.
- Mark “unsupported” features for diagnostics (conditional types, variadic generics, `infer`, `this` typing).

### 2.2 Emitter Responsibilities

- Prefer emitting the exact generic signature where possible (e.g., `public class Box<T>`).
- When C# cannot express the constraint, pass through to specialisation logic or adapter generation.
- Rewrite call sites to supply explicit type arguments/default values.
- When the IR flags a specialisation, emit concrete methods (`process_string`, `process_double`) and route calls accordingly.
- Emit diagnostics when IR flags `unsupported` with no fallback.

### 2.3 Runtime Responsibilities

- Provide helper APIs for dictionary-like access (`DynamicObject`), but keep helper methods typed (`GetProperty<T>`).
- Provide cloning/adapter utilities as needed (e.g., copy a structural object into a synthesised wrapper class).
- No runtime `dynamic`. Use `IDictionary`, `Dictionary`, or strongly-typed wrappers.

---

## 3. Mapping Rules (Happy Path)

| TypeScript Construct           | Emitted C#                        | Notes                                         |
| ------------------------------ | --------------------------------- | --------------------------------------------- |
| `class Foo<T>`                 | `public class Foo<T>`             | Preserve generic parameter name & order.      |
| `function bar<T>(value: T): T` | `public static T bar<T>(T value)` | Methods inherit type params.                  |
| `T extends SomeClass`          | `where T : SomeClass`             | Works when `SomeClass` is generated/declared. |
| `T extends IFoo`               | `where T : IFoo`                  | Multiple interface constraints allowed.       |
| `Foo<T extends IFoo & IBar>`   | `where T : IFoo, IBar`            | Keep order; C# handles multiple interfaces.   |
| `Promise<T>`                   | `Task<T>`                         | already defined in type mappings.             |
| `Array<T>`                     | `Tsonic.Runtime.Array<T>`         | Already mapped, generics preserved.           |
| `.d.ts` .NET types (`List<T>`) | same generics as .NET             | Works out of the box.                         |

---

## 4. Structural Constraints & Adapters

TypeScript allows `T` to extend an object literal or index signature. We cannot express this statically in C#. Strategy:

1. **Synthesize interface & wrapper class** per constraint.
   - Example: `T extends { id: number }` -> `interface __Constraint_HasId { double id { get; } }` and wrapper `class __Constraint_HasId_Wrapper : __Constraint_HasId`.
2. **Inline literal call sites** instantiate the wrapper class:
   ```csharp
   getId(new __Constraint_HasId_Wrapper { id = 42, name = "alice" });
   ```
3. **Values from other functions**: generate a helper `__Constraint_HasId_Wrap(value)` that copies fields into the wrapper.
4. **Ensure wrapper implements optional members by default** (e.g., set missing properties to `default`).

If the structural constraint includes index signatures (`{ [key: string]: number }`), create a wrapper over `Dictionary<string,double>`.

Diagnostics trigger only if we cannot synthesise the wrapper (e.g., symbol keys, nested mapped types).

---

## 5. Rewriting Call Sites

| Case                             | TS Example                                                         | C# Rewrite                                           |
| -------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Default type arg                 | `new Box()` when `class Box<T = string>`                           | `new Box<string>(default!)`                          |
| Generic method with omitted args | `identity(value)`                                                  | `identity<string>(value)` (use type from TS checker) |
| Rest-type generics               | `call(1, 2)` when `function call<T extends unknown[]>(...args: T)` | emit `call__2<int, int>(1, 2)` specialisation        |
| Conditional return               | `process("text")`                                                  | `process__string("text")` (specialised method)       |

The emitter must rewrite all generically-typed call sites to either (a) supply missing type parameters or (b) invoke a generated specialisation.

---

## 6. Specialisation (Monomorphisation)

When the IR flags a feature that C# cannot represent generically (conditional types, `infer`, variadic generics, `this` typing), follow this workflow:

1. Collect the set of **concrete type argument tuples** observed in the programme (via the checker).
2. For each tuple, emit a **concrete helper** (method or class) with a deterministic name:
   ```csharp
   // TS: function process<T>(value: T): T extends string ? string : number
   public static string process__string(string value) => value.ToUpperInvariant();
   public static double process__double(double value) => 0;
   ```
3. Rewrite call sites to invoke the specialisation based on the TS-inferred type arguments.
4. Keep the generic definition only if we need it for future instantiations; otherwise, the specialised methods are the real implementation. The generic stub can throw `NotSupportedException` if called.
5. Cache the mapping so repeated instantiations reuse the same specialisation.

Monomorphisation keeps the generated C# static and fast; we rely on the TS checker to guarantee the set of instantiations is finite in the compilation unit.

### 6.1 Special-case Strategies

To keep C# static and high-performance we specialise certain TypeScript-only patterns whenever all call sites are known. For each instantiation reported by the TypeScript checker, the emitter generates a concrete helper and rewrites the caller to use it.

- **Recursive mapped types (finite)** – When a mapped type such as `DeepReadonly<Settings>` is instantiated with a concrete interface, expand it into an exact nominal C# class (nested classes for nested objects). Truly unbounded recursive shapes continue to raise the structural alias diagnostic.
- **Conditional types with `infer`** – When every branch is seen at call sites, emit one helper per branch (for example `process__string`, `process__number`). Unseen branches are omitted. If new instantiations appear later, the codegen step will emit additional helpers.
- **`this` typing** – Rewrite base classes into the CRTP pattern (`Base<TSelf>`) for each concrete inheritance chain observed, so fluent APIs return the precise derived type. External inheritance beyond the compiled set still emits a diagnostic.
- **Constructor constraints with rest parameters** – For each tuple length observed in `new (...args: TArgs) => TResult`, generate a dedicated overload with that signature.
- **Variadic generic interfaces / tuple generics** – For each tuple length used, synthesise a nominal interface/implementation (`Tuple2<T1,T2>`, `Tuple3<...>`, etc.).

If the checker reports an unbounded set of instantiations (for example an exported generic used by third-party code), fall back to `TSN7105`.

---

## 7. Indexed Access Helpers (`keyof`, `T[K]`)

- Treat `keyof` as `string` (TypeScript already ensures callers use valid keys).
- Implement helper methods on a runtime base class (e.g., `Tsonic.Runtime.DynamicObject`) that exposes `GetProperty<T>(string key)`:
  ```csharp
  public static TResult getProp<T, TResult>(T obj, string key)
      where T : Tsonic.Runtime.DynamicObject
  {
      return obj.GetProperty<TResult>(key);
  }
  ```
- The emitter requests `TResult` from the checker for each call site; no `dynamic` needed.

---

## 8. Unsupported Patterns & Diagnostics

After specialisation, only a few patterns remain genuinely unsupported. Emit diagnostics for these situations:

| Pattern                                                                 | Example                                    | Diagnostic Action                                            |
| ----------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Unbounded or unknown instantiations (generic exported for external use) | `export function identity<T>(value: T): T` | `TSN7105`: “Cannot determine required type specialisations.” |

(See `spec/16-types-and-interfaces.md` for structural alias diagnostics `TSN7201`–`TSN7203`.)

---

## 9. Implementation Checklist (for Devs)

1. **IR Work**
   - Add generic parameter metadata to relevant nodes.
   - Capture call-site instantiations (`checker.getResolvedSignature`, `checker.typeToString`).
   - Flag structural constraints with the property info.
   - Annotate unsupported features.

2. **Emitter Work**
   - Update signature emitter to include `<T>` and `where` clauses.
   - Integrate call-site rewriter.
   - Generate adapter classes/interfaces for structural constraints.
   - Generate specialisations when IR requests them.
   - Emit diagnostics via `DiagnosticsCollector` for unsupported cases.

3. **Runtime Helpers**
   - Implement adapter utilities for cloning structural objects.
   - Provide `DynamicObject` with `GetProperty<T>` / `SetProperty` typed helpers.
   - Provide dictionary wrappers for index signatures.

4. **Testing**
   - Unit tests for: plain generics, structural constraint adapters, call-site rewriting, specialisation output.
   - Integration tests compiling sample TS code with conditional types, ensuring diagnostics appear.
   - Performance regression: ensure no `dynamic` or reflection in hot code paths.

---

## 10. Examples End-to-End

### 10.1 Structural constraint + adapter

**TypeScript**

```ts
function getId<T extends { id: number }>(item: T): number {
  return item.id;
}

const id = getId({ id: 42, name: "alice" });
```

**Emitted C# (partial)**

```csharp
public interface __getId_HasId
{
    double id { get; }
}

public sealed class __getId_arg0 : __getId_HasId
{
    public double id { get; set; }
    public string name { get; set; }
}

public static double getId<T>(T item) where T : __getId_HasId
{
    return item.id;
}

// Call site
var id = getId(new __getId_arg0 { id = 42, name = "alice" });
```

### 10.2 Conditional type specialisation

**TypeScript**

```ts
type Result<T> = T extends string ? string : number;

export function process<T>(value: T): Result<T> {
  if (typeof value === "string") {
    return value.toUpperCase() as Result<T>;
  }
  return 0 as Result<T>;
}

const a = process("hi"); // string
const b = process(42); // number
```

**Emitted C# (partial)**

```csharp
public static string process__string(string value)
{
    return value.ToUpperInvariant();
}

public static double process__double(double value)
{
    return 0;
}

// Call sites rewritten
a = process__string("hi");
b = process__double(42);
```

### 10.3 `keyof` helper

**TypeScript**

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: "alice" };
const name = getProp(user, "name");
```

**C#**

```csharp
public static TResult getProp<T, TResult>(T obj, string key)
    where T : Tsonic.Runtime.DynamicObject
{
    return obj.GetProperty<TResult>(key);
}

// Call site: rewrite to wrap literal into DynamicObject
var user = Tsonic.Runtime.DynamicObject.FromAnonymous(new { id = 1, name = "alice" });
var name = getProp<Tsonic.Runtime.DynamicObject, string>(user, "name");
```

---

## 11. Performance Notes

- Keeping C# generics intact lets the CLR JIT specialise at runtime, giving optimal performance.
- Adapter classes and wrappers add some allocation, but only where strictly necessary (structural constraints).
- Specialisations trade code size for zero dynamic dispatch. The number of generated methods equals the number of distinct instantiations seen by the checker.
- No `dynamic` or reflection in the hot path; fallback diagnostics invite the user to refactor instead.

---

## 12. Future Work

- Investigate caching specialisations across builds to avoid regeneration noise.
- Explore user-configurable fallbacks (e.g., allow `dynamic` with `@tsonic-allow-dynamic` comment).
- Monitor code-size growth with monomorphisation and introduce heuristics if required.
