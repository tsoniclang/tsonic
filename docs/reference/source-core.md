# Neutral source types and markers

`@tsonic/core` owns target-neutral source semantics. These are compiler-owned
virtual modules; users do not install an `@tsonic/core` npm package directly.

## `@tsonic/core/types.js`

### Primitive aliases

| Export | Source meaning | TypeScript carrier |
| --- | --- | --- |
| `bool` | Boolean | `boolean` |
| `char` | Unsigned 16-bit character/code unit | `string` |
| `int8`, `int16`, `int32` | Signed fixed-width integers | `number` |
| `uint8`, `uint16`, `uint32` | Unsigned fixed-width integers | `number` |
| `int64`, `int128` | Signed fixed-width integers | `bigint` |
| `uint64`, `uint128` | Unsigned fixed-width integers | `bigint` |
| `nativeInt`, `nativeUint` | Target-native signed/unsigned integers | `number` |
| `float16`, `float32`, `float64` | IEEE-style floating-point domains | `number` |
| `decimal` | Target decimal domain | `number` |

The TypeScript carrier controls checking syntax; the retained primitive fact
controls target meaning. Targets reject unsupported exact primitives rather
than silently widening them.

### Type markers

| Export | Meaning |
| --- | --- |
| `Pointer<T>` | Typed mutable storage location |
| `RawPointer` | Opaque raw-pointer identity without a pointee type |
| `FunctionPointer<TArgs, TReturn>` | Exact native function-pointer signature |
| `FixedArray<T, N>` | Fixed-length array; `N` must be one non-negative safe-integer literal type |
| `NativePointer<T>` | Target-native typed pointer used by explicit native-pointer operations |

`Pointer<T>` and `NativePointer<T>` are different contracts. The first is a
safe closed location abstraction. The second requests the target's native
pointer representation and safety rules.

## `@tsonic/core/lang.js`

### Argument and ownership markers

| Export | Meaning |
| --- | --- |
| `writeOnlyRef(value)` | Selected argument is writable but not read |
| `readWriteRef(value)` | Selected argument is read and written |
| `readOnlyRef(value)` | Selected argument is passed by readonly reference |
| `sharedBorrow(value)` | Shared-borrow flow intent |
| `mutableBorrow(value)` | Exclusive mutable-borrow flow intent |
| `move(value)` | Ownership-transfer flow intent |

These markers do not manufacture target semantics. The selected signature and
target policy must independently support the requested mode.

### Structure and metadata markers

| Export | Meaning |
| --- | --- |
| `struct(shape)` | Declares an exact value-type shape from proven `field<T>()` members |
| `field<T>()` | Declares a field with explicit source type evidence |
| `attribute<T>(...args)` | Starts an exact attribute-application builder |
| `defaultValue<T>()` | Requests the target default for exact `T` |

Example:

```ts
import { field, struct } from "@tsonic/core/lang.js";
import type { int32 } from "@tsonic/core/types.js";

export const Point = struct({
  x: field<int32>(),
  y: field<int32>(),
});
```

Attribute placement uses exact selectors:

```ts
attribute<Controller>()
  .method((controller) => controller.handle)
  .parameter("request")
  .target("param")
  .add(RouteAttribute, "/items");
```

The selected provider owns the target attribute identity and legal values.

### Typed-location operations

| Export | Meaning |
| --- | --- |
| `addressOf(storage)` | Address an existing proven storage location |
| `allocatePointer(initial)` | Allocate independent typed storage |
| `loadPointer(pointer)` | Read a typed location |
| `storePointer(pointer, value)` | Write a typed location |
| `equalPointer(left, right)` | Compare canonical typed-location identity |
| `hashPointer(pointer)` | Hash canonical typed-location identity |
| `bindPointer(identity, read, write)` | Bind a target/provider storage identity to explicit accessors |
| `projectPointer(pointer, fromSource, toSource)` | Project a typed location through reversible conversions |

`projectPointer` may preserve an optional pointer. Its conversions are part of
the exact projection contract; targets do not infer them from `F` and `T`.

### Raw-pointer identity operations

| Export | Meaning |
| --- | --- |
| `bindRawPointer(identity)` | Bind an opaque object identity as `RawPointer` |
| `equalRawPointer(left, right)` | Compare raw-pointer identities, including `undefined` |
| `hashRawPointer(pointer)` | Hash raw-pointer identity, including `undefined` |

Raw-pointer identity does not authorize dereference or pointer arithmetic.
Those require a typed native-pointer conversion supplied by a target/provider
contract.

### Native-pointer operations

| Export | Meaning |
| --- | --- |
| `loadNativePointer(pointer)` | Dereference a native typed pointer |
| `storeNativePointer(pointer, value)` | Store through a native typed pointer |
| `offsetNativePointer(pointer, elementOffset)` | Offset by pointee elements, not bytes |

Native pointer access requires an explicit safety context when the target
language requires one.

### Safety builders

| Form | Meaning |
| --- | --- |
| `unsafeContext()` | Marks the remainder of the containing lexical block as unsafe |
| `unsafeContext(expression)` | Marks exactly one expression as unsafe |
| `safety<T>().requiresUnsafe()` | Declaration-level unsafe-call requirement |
| `safety<T>().safe()` | Declaration-level safe contract |
| `.method(selector)` | Select a method declaration |
| `.property(selector)` | Select a property declaration |
| `.indexer(selector)` | Select an index declaration |
| `.constructor()` | Select a constructor |
| `.getter()` / `.setter()` | Select one accessor independently |

Example:

```ts
safety<NativeBuffer>()
  .method((buffer) => buffer.read)
  .requiresUnsafe();

export function read(pointer: NativePointer<int32>): int32 {
  return unsafeContext(loadNativePointer(pointer));
}
```

Lexical unsafe context, declaration-level requires-unsafe, and native project
permission are independent controls.
