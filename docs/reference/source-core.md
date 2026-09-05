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
| `RawPointer` | Untyped address carrier; not an arbitrary object's identity |
| `FunctionPointer<TArgs, TReturn>` | Exact native function-pointer signature |
| `FixedArray<T, N>` | Fixed-length array; `N` must be one non-negative safe-integer literal type |
| `NativePointer<T>` | Target-native typed pointer used by explicit native-pointer operations |
| `DataLayout` | Provider-selected ABI identity and immutable descriptor |
| `MemoryLayout<T>` | Exact size, alignment, stride and selected field layout for `T` |
| `MemoryFieldLayout<T>` | One selected field's offset and alignment |

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

### Compile-time intent

| Export | Meaning |
| --- | --- |
| `comptime(expression)` | Require target compile-time evaluation of the exact expression |
| `comptime<T>()` | Project an exact selected compile-time parameter or literal type into value position |
| `comptimeIf(condition)` | Require compile-time selection of the directly enclosing `if` or conditional expression |
| `unroll(iterable)` | Require compile-time expansion of the directly enclosing `for...of` loop |

```ts
import { comptime, comptimeIf, unroll } from "@tsonic/core/lang.js";

const enabled = comptime(true);
if (comptimeIf(enabled)) {
  for (const value of unroll([1, 2, 3])) {
    consume(value);
  }
}
```

These calls record target-neutral intent and exact selected source evidence;
source-core does not evaluate the expression or choose target syntax. Targets
must prove that the selected operation is representable in their compile-time
domain. An ordinary runtime type is not automatically a valid `comptime<T>()`
parameter. Compile-time intent does not imply copying, ownership transfer,
runtime materialization, or target-independent support for arbitrary evaluation.

Import aliases, namespace imports, and parentheses preserve intrinsic identity.
Same-spelled local functions do not become intrinsics. Core intrinsics must be
imported directly from their owning virtual module, not re-exported through a
local barrel.

`const decision = comptimeIf(true)` and `const values = unroll([1, 2])` are
invalid placements. So are `if (comptimeIf(true) && flag)` and
`for (const key in unroll(object))`: the marker must select the exact owning
condition or for-of iterable, with parentheses permitted.

Targets read `tsonicCompileTimeFactKey` through the public
`@tsonic/source-core/facts` entrypoint. Its `value`, `type`, `condition`, and
`iteration` variants retain the exact operand/type and result-type identities;
targets must not rediscover the request from the callee's spelling.

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
| `equalRawPointer(left, right)` | Compare raw-pointer identities, including `undefined` |
| `hashRawPointer(pointer)` | Hash raw-pointer identity, including `undefined` |

Raw-pointer identity does not authorize dereference or pointer arithmetic.
An arbitrary object is not a memory address. Raw addresses require an exact
provider contract or a layout-backed typed-location conversion. The shared
memory contract describes those operations; each target must prove its storage,
layout, lifetime and safety requirements before emitting them.

### Layout and raw-memory source contracts

These declarations and their immutable source facts are implemented. C# and
Rust do **not yet implement their native lowering**. A checked source fact is
not proof that a target can emit the operation. Use the existing native-pointer
operations for supported target-native pointer APIs.

| Export | Source contract |
| --- | --- |
| `memoryLayout<T>(abi, size, alignment, stride, ...fields)` | Describe exact storage using a registered ABI token and constant dimensions |
| `memoryField<T, TField>(select, offset, alignment)` | Select a non-optional declared field without executing the selector |
| `sizeOf(layout)` | Observe the selected byte size |
| `alignOf(layout)` | Observe the selected byte alignment |
| `strideOf(layout)` | Observe the selected element stride |
| `fieldOffsetOf(layout, select)` | Observe the offset of one exact selected field |
| `toRawPointer(pointer, layout)` | Request the address of the same typed storage, retaining its required owner |
| `reinterpretRawPointer(raw, layout)` | Interpret an address as the canonical `Pointer<T>`, not `NativePointer<T>` |
| `offsetRawPointer(raw, byteOffset, abi)` | Offset in bytes using an exact integer domain |
| `rawPointerToAddressInteger(raw, abi)` | Convert an address to `nativeUint`, without retaining ownership |
| `addressIntegerToRawPointer(address, abi)` | Recover an address from `nativeUint`, without manufacturing ownership |
| `keepAlive(value)` | Require reachability through this call, not pinning |

For example, the source contract expresses a raw-backed location as follows.
This is not yet a working C# or Rust application:

```ts
import { reinterpretRawPointer, storePointer, unsafeContext } from "@tsonic/core/lang.js";
import type { MemoryLayout, RawPointer, uint32 } from "@tsonic/core/types.js";

function write(raw: RawPointer | undefined, layout: MemoryLayout<uint32>): void {
  unsafeContext();
  const pointer = reinterpretRawPointer(raw, layout);
  if (pointer !== undefined) storePointer(pointer, 7);
}
```

The target must preserve writes to the original storage. Copying its value
into a new location is not an implementation of this contract.

An ABI provider supplies the token declaration and a `dataLayouts`
contribution containing its exact provider identity, version, fingerprint,
byte order and address width. Source-core validates the registration and owns
the resulting facts. The build machine's architecture is not an ABI token.
Layout dimensions must be non-negative safe integers; alignment is a positive
power of two. Native field extents and storage compatibility still require
target proof.

Byte offsets accept exact signed and unsigned integer markers, including
bigint-backed widths. Unmarked in-range integer constants are also accepted.
An arbitrary `number` or `bigint` variable is not an integer-domain proof.
Optional pointer conversions preserve `undefined`; address conversion maps
it to zero, and integer zero maps back to `undefined`.

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
