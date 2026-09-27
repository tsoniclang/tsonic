# Source semantics

Ordinary TypeScript remains ordinary TypeScript:

```ts
export interface User {
  readonly id: string;
  name: string;
}

export function rename(user: User, name: string): User {
  return { ...user, name };
}
```

## Inheritance and overrides

Write normal TypeScript inheritance:

```ts
class Message {
  text = "base";

  render(): string {
    return this.text;
  }
}

class EmphaticMessage extends Message {
  text = "important";

  render(): string {
    return `${super.render()}!`;
  }
}

export function show(message: Message): string {
  return message.render();
}
```

The checked source program records that the derived members override base
members and that `message.render()` is virtual dispatch. C# emits the required
`virtual` and `override` members. Rust emits its equivalent closed dispatch
model. Source code does not add a C#- or Rust-specific override marker.

Target-native inheritance is also evidence-driven. Extending a provider type
is accepted only when that provider exposes an exact legal base contract.

Tsonic source modules add types and operations only where JavaScript and
TypeScript do not express a required native distinction.

## Type transformations

Standard utility types are checked as TypeScript and then erase:

```ts
interface User {
  id: string;
  name: string;
  active?: boolean;
}

type Patch = Partial<User>;
type NameOnly = Pick<User, "name">;
```

The target receives the resolved shape, not a request to implement a native
type named `Partial` or `Pick`. The complete pinned inventory and the distinct
`any` and `unknown` target contracts are in
[TypeScript types and utilities](../reference/typescript-types.md).

## Exact primitives

```ts
import type { int32, uint8, float64 } from "@tsonic/core/types.js";

export function average(total: int32, count: uint8): float64 {
  return total / count;
}
```

These aliases may all erase to TypeScript `number` while checking, but TSTS
retains their exact source-semantic identities for the target.

## Reference arguments

```ts
import { readwriteref, writeonlyref } from "@tsonic/core/lang.js";

declare function divide(
  numerator: number,
  denominator: number,
  quotient: number,
  remainder: number,
): void;

let quotient = 0;
let remainder = 0;
divide(17, 5, writeonlyref(quotient), writeonlyref(remainder));
```

The selected provider signature determines whether a marker is legal. A marker
does not turn an arbitrary value into a writable native location.

## Typed locations

```ts
import {
  addressof,
  equalptr,
  loadptr,
  storeptr,
} from "@tsonic/core/lang.js";
import type { int32, Pointer } from "@tsonic/core/types.js";

function increment(pointer: Pointer<int32>): void {
  storeptr(pointer, loadptr(pointer) + 1);
}

let value: int32 = 1;
const pointer = addressof(value);
increment(pointer);
const sameLocation = equalptr(pointer, addressof(value));
```

`Pointer<T>` is a typed mutable storage location. It is not a raw address.
C# lowers it to its closed `Location<T>` carrier; Rust lowers it to its own
closed location representation. Identity follows storage, not wrapper-object
identity.

## Native pointers and safety

Native pointer operations require exact target support and an explicit safety
contract:

```ts
import {
  loadnativeptr,
  offsetnativeptr,
  unsafecontext,
} from "@tsonic/core/lang.js";
import type {
  NativePointer,
  int32,
  nativeInt,
} from "@tsonic/core/types.js";

export function read(
  pointer: NativePointer<int32>,
  offset: nativeInt,
): int32 {
  return unsafecontext(loadnativeptr(offsetnativeptr(pointer, offset)));
}
```

The safety region and any declaration-level requires-unsafe contract are
independent controls. Tsonic does not infer one from the other.

## Target-native spelling

Target modules may provide native aliases. For example, C# offers `int`,
`out`, and `ptr`; Rust offers explicit lifetime and reference types. Neutral
library code should prefer `@tsonic/core` unless it intentionally exposes a
target-native contract.

The exhaustive catalog is in [neutral types and markers](../reference/source-core.md).

## Alias evidence for target authors

An inferred type can retain an alias application even when there is no type
argument written at the use site:

```ts
type Stored<T> = T extends { storage: infer Value } ? Value : T;
function read<T>(value: { current: Stored<T> }): Stored<T> {
  return value.current;
}
```

The shared `source.semantics.forNode(node).types.aliasApplication(type)` query
returns the checker's retained alias declaration, parameter-to-argument bindings,
result and conditional selections. Its immutable result uses the same contract
as `types.instantiateAlias(declaration, arguments)`. Ordinary
`types.typeArguments(type)` describes class/interface type references; it does
not describe a conditional alias's arguments.

The query returns no application when the checker has erased that provenance.
Targets must not infer an alias from a result's name or shape. Types from a
different checked program are not accepted. Each target still owns its native
representation and its limits; this query adds no runtime object or marker.
