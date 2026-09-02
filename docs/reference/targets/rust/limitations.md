# Rust target limitations

The target rejects source semantics that cannot be represented without
guessing, open runtime machinery, or a contract not present in checked source
or provider evidence.

## General boundaries

- runtime `eval`, source generation, and arbitrary dynamic member lookup;
- reflection-based fallback over arbitrary Rust or JavaScript values;
- unproved ownership, borrow, lifetime, overload, conversion, provider,
  fallibility, safety, or foundation identity;
- module cycles whose ESM initialization order cannot be preserved by the
  closed Rust module-initialization plan;
- open value graphs whose operations cannot be enumerated statically;
- rustdoc signatures whose source type, generic, lifetime, const, associated
  type, ABI, or receiver contract cannot be represented exactly.

## Rust-specific boundaries

- a borrowed result that escapes without one exact source lifetime;
- overlapping or otherwise unproved mutable borrows;
- generator, async, closure, or resource storage that captures incompatible
  authored lifetimes;
- open generic virtual dispatch whose concrete project instantiations cannot
  be closed finitely;
- a trait object or associated-type projection without one exact provider
  identity and resolved carrier;
- platform startup, allocator, panic, linker, and target policy inferred from
  a `core` or `alloc` output request.

## Generators and retained lifetimes

A generator can retain one authored lifetime or an ordered outlives chain. It
cannot collapse unrelated borrows into one storage lifetime:

```ts
import type { Life, Ref } from "@tsonic/rust/types.js";

function* alternate<Left extends Life, Right extends Life>(
  left: Ref<string, Left>,
  right: Ref<string, Right>,
) {
  yield left;
  yield right; // rejected when neither lifetime outlives the other
}
```

The same boundary applies when an async carrier must retain unrelated borrowed
results. Tsonic does not claim that either borrow lives as long as the other.

A generator that throws also needs one explicit fallible generator protocol:

```ts
function* rows() {
  yield readRow();
  throw new Error("invalid row");
}
```

Ordinary generators, async generators, `next(value)`, `return`, `throw`
commands, and `yield*` are supported when their selected protocol is closed.

## Places, conversions, and callable values

Locations over locals, parameters, fields, array elements, and proven disjoint
subfields work. An owned-root receiver location and the neutral
`hashPointer`, `bindPointer`, and `projectPointer` operations do not yet have a
Rust target contract.

A TypeScript assertion cannot manufacture a native conversion:

```ts
interface Animal { name: string }
interface Dog extends Animal { breed: string }
declare const animal: Animal;
const dog = animal as Dog; // no proved Rust representation or conversion
```

Constant tuple indexes and dynamic indexes with an exact Rust integer carrier
work. A source-only literal union such as `0 | 1` is not reinterpreted by
spelling as a native index.

Direct methods work. Detached structural, static, or open generic method values
reject until one exact callable identity, receiver, ABI, and lifetime exist:

```ts
const read = counter.read;
const make = Factory.make;
```

An arrow such as `() => counter.read()` is valid when creating a new closure
has the intended identity and allocation behavior. Tsonic does not make that
rewrite automatically because callback comparison and event removal can
observe the difference.

## Construction and member identity

A Rust value must be fully initialized before an instance method can receive
`this`:

```ts
class Example {
  first = 1;
  second = this.read(); // target diagnostic
  read(): number { return this.first; }
}
```

Complete getter/setter pairs have one storage contract. Setter-only and
optional accessor shapes reject when no exact storage representation exists.
Static fields require explicit initializers, and static access must retain the
exact class identity; constructor aliases and static `this` are not guessed.

`delete` is supported for selected JavaScript-array hole semantics. It cannot
remove a field from a static Rust record. `for...in` and `switch` similarly
require an exact own-key or equality policy for the selected carrier.

## Native traits, threads, and object graphs

Project inheritance and interface dispatch are supported. A project-authored
type cannot yet implement an imported native Rust trait:

```ts
import type { Display } from "@tsonic/rust/std/fmt.js";

class Label implements Display {
  // No native `impl Display for Label` contract exists yet.
}
```

This affects APIs requiring a project type to implement `Display`, `Iterator`,
`Drop`, `Send`, `Sync`, or a provider trait. External inheritance is limited to
the explicitly supported direct JavaScript `Error` model; transitive external
heritage is not general Rust inheritance.

Ordinary project objects and closures use single-threaded ownership. Tsonic
does not silently replace them with `Arc`, a lock, or a sendable closure to
satisfy a threaded API. Node workers use their separate structured-clone
contract and do not share arbitrary project objects.

Strong `Rc` graphs are memory-safe but do not reclaim an unreachable strong
cycle:

```ts
class Link { next?: Link }
const left = new Link();
const right = new Link();
left.next = right;
right.next = left;
```

No tracing collector is inserted behind ordinary Rust values.

### Borrow examples

Returning a borrow requires one exact source lifetime. This is valid only when
the authored contract identifies it:

```ts
import type { Life, Ref } from "@tsonic/rust/types.js";

function first<L extends Life>(value: Ref<string, L>): Ref<string, L> {
  return value;
}
```

Two live mutable borrows of overlapping storage are rejected. Tsonic does not
clone or box the value merely to satisfy the borrow checker.

### Native macros

Rust macros are syntax expansion, not callable metadata. They are not exposed
as ordinary provider functions. Put a small native Rust function around a
macro when TypeScript must call it, then expose that function through rustdoc.

Provider-authored macro operations with an exact declared row are a separate,
supported contract.

### ABI and provider shapes

C variadic calls are supported only after the caller supplies the exact
promoted tail carriers. Tsonic does not silently apply C default promotions,
such as `float32` to `float64`.

The rustdoc provider rejects published signatures that cannot be named by
value, including inferred `_` types, unstable pattern types, unsupported bound
modifiers, and unsized by-value results. Custom receivers, generic associated
type projections, associated constraints, opaque captures, raw pointers,
function pointers, ABIs, and supported variadics remain available when rustdoc
provides a complete contract.

### `core` and `alloc` applications

Generated `core` and `alloc` outputs are libraries. A user-owned native
project must provide executable startup, panic behavior, an allocator when
required, linker policy, and the target specification. Tsonic will not infer
those platform contracts from source code.

## JavaScript and Node boundaries

Locale- or timezone-dependent operations require an explicit deterministic
data contract; host-default locale/timezone behavior is not compiler
semantics. Open object inspection, dynamic field addition that changes a
closed Rust layout, arbitrary cyclic graph projection, and Node stream/event
schedulers outside the capability's closed contracts remain rejected.

The JavaScript surface does not currently expose `String.raw`, wrapper-object
construction, or the general object prototype/descriptor/extensibility
families. Native Rust strings remain the default; explicit `JsString` is used
only when exact UTF-16 behavior is selected. A neutral UTF-16 `char` cannot be
silently used as a Rust Unicode scalar when it may contain a lone surrogate.

The Rust Node inventory keeps each maintained row implemented, deferred, or
hard-rejected. The principal deferred families are worker resource limits,
extended and promise-based readline state, and Zstandard operations. Dynamic
runtime/debugging families such as `vm`, `repl`, `inspector`, and `v8`, plus
platform contracts without one portable native meaning, remain hard-rejected.

## Native compiler boundary

Tsonic generates the exact authored and selected Rust contract. `rustc` may
still reject source that violates native borrow checking, coherence, target,
linker, or dependency rules. Tsonic does not rewrite the contract to evade a
native diagnostic.

## Application entry

Generated binary output requires the entry module to export `main` with a
unit result:

```ts
export function main(): void {}
```

An async entry may return `Promise<void>`. An unexported function, a function
in another module, or a non-unit result is not selected by name recovery.
