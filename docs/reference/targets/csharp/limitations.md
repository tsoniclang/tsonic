# C# target limitations

The target rejects source semantics that cannot be represented without
guessing or forbidden runtime machinery.

## General boundaries

- runtime `eval`, source generation, and arbitrary dynamic member lookup;
- reflection-based fallback over arbitrary target objects;
- unproved overload, conversion, storage, pointer, attribute, or provider
  identity;
- runtime module cycles that cannot preserve ESM initialization semantics;
- open value graphs whose required operations are not finite and closed;
- native metadata shapes the .NET provider cannot express legally in its
  TypeScript declaration model.

## Application and library boundaries

An exported function named `main` is not a C# entrypoint by convention:

```ts
export function main(): void {}
```

For executable output, call it from top-level code. The generated
`TsonicEntrypoint.Main` runs the entry module.

C# library module initialization must be synchronous. Top-level `await` in a
library entry graph is rejected because a CLR module initializer cannot await.

Runtime ESM cycles are accepted only when the closed module plan preserves
ordering and initialization state. A cycle that needs JavaScript temporal dead
zones or unresolved live bindings is rejected.

## Storage and pointer boundaries

Address formation requires exact stable storage identity. Provider/project
indexers require an explicit location-equivalence policy. Unsupported escaping
loop-binding storage and overlapping/unreconcilable location projections reject
instead of copying values silently.

For example, local, parameter, field, supported property, array-element, and
ref-return locations can be represented. A `for` initializer binding that
escapes its loop, a destructured iteration binding, or an indexer without one
exact storage identity cannot:

```ts
for (let index = 0; index < values.length; index++) {
  consume(addressOf(index)); // target diagnostic
}

for (const [key, value] of entries) {
  consume(addressOf(value)); // target diagnostic
}
```

`hashPointer` hashes canonical location identity, including `undefined`.
`bindPointer` requires a closed reference identity and exact read/write
callbacks. `projectPointer` preserves that identity and applies the selected
conversions on reads and writes. Optional projections remain optional, and
constructing a projection does not execute its callbacks.

These accessor locations do not automatically have native addresses. A
projection that changes the represented value cannot be treated as a raw
view of the same bytes. Closed scalar layouts support native-backed allocation
and initialized block-local or by-value parameter storage. Raw round trips
preserve that storage, including pointers held in closed local arrays and
data-property objects. Closed local containers can replace entries through simple
assignments; analysis must prove every stored pointer's backing.

Physical record codecs require a source-defined `struct` or an explicit complete
native-provider value-field contract. Required mutable fields of compiler-owned
reference objects can receive retained native storage. Dense native array
elements can receive one strided allocation when all bindings, aliases and uses
close locally. Ordinary writes and raw pointer writes reach the same storage;
replacing the object or array does not retarget an existing pointer.

Escaped arrays, collection methods, optional/accessor fields and open caller
boundaries still require additional proofs. Promoted native locals, fields and
elements cannot also be passed as managed `ref`/`out` storage. No copy-in/copy-out
conversion is inserted. See [native storage boundaries](../../source-core.md)
for the exact supported source forms and provider lease obligations.

Ordinary source functions, methods and callbacks retain exact pointer results,
including optional results and selected generic parameter transport. This does
not infer arbitrary pointer-producing generic bodies or external storage.

Raw address equality, hashing, checked byte offsets, and exact 32/64-bit
address-integer conversion are supported. Address width is checked against the
executing process. These operations do not dereference memory or prove that an
integer denotes live storage. Layout observations use finalized compile-time
descriptors; those descriptors cannot escape into ordinary runtime values.

Native pointer access requires the exact pointer carrier, lexical safety
context, declaration safety contract where applicable, and generated/user
project permission. One control never implies another.

## Generator boundaries

The target uses native C# iterator syntax when it preserves TypeScript
behavior. C# placements that forbid `yield`, or generator contracts that cannot
be represented by the approved native/runtime protocol, reject. Tsonic does not
reimplement the C# compiler's general state-machine transformation.

For example, C# does not permit `yield return` in `catch`, `finally`, or a
`try` that has a `catch`. Tsonic reports the unsupported placement rather than
emitting a hand-written state machine with different behavior.

A resource that survives a suspension is also rejected:

```ts
function* lines() {
  using file = openFile();
  yield file.readLine();
}
```

The resource would have to become generator-owned state and be disposed on
completion, early return, throw, and consumer cancellation. Native lexical
`using` alone does not prove that protocol. Ordinary `using`, `await using`,
and generators without this capture are supported.

## Defaults, initialization, and receivers

A C# optional-parameter default must be representable by C# metadata. A source
default that executes code is not:

```ts
function next(value = createValue()): number {
  return value;
}

next(); // target diagnostic; pass createValue() explicitly instead
```

A static field without an initializer is also rejected when the TypeScript and
C# defaults differ:

```ts
class Counter {
  static value: number; // TypeScript starts undefined; C# double starts 0
}
```

Write an explicit initializer when that is the intended state. Static `this`
in an initializer and a function-valued object property using dynamic `this`
also reject unless one exact receiver contract exists. Instance methods and
lexical arrow `this` are supported.

Catch-binding destructuring is not supported:

```ts
try {
  run();
} catch ({ message }: any) {
  consume(message);
}
```

C# catches an exception object. Tsonic does not reflect over an arbitrary
thrown value to discover destructured fields.

## JavaScript surface boundaries

The C# JavaScript surface supports the families listed in the
[support inventory](support-inventory.md), including `Intl`, JSON replacers,
selected `toJSON`, symbols, weak collections, numeric typed arrays, Promise
combinators, Set algebra, and UTC Date operations.

These selected forms remain unavailable:

```ts
const raw = String.raw`c:\temp\file.txt`;
const boxed = new String("text");
Object.defineProperty(value, "name", { value: "next" });
Object.freeze(value);
value.toLocaleString("de-DE", { minimumFractionDigits: 2 });
```

Primitive `String(value)`, `Number(value)`, and `Boolean(value)` conversions
are distinct from wrapper-object construction and remain supported where the
selected conversion is closed. Object prototype, descriptor, and
extensibility APIs require an object model that the static C# layout does not
provide. No-argument number formatting remains separate from locale/options
formatting.

## Node capability boundaries

The capability is broad but not the whole Node API. Known rejected families
include:

| Family | Examples |
| --- | --- |
| Process scheduler and streams | `process.nextTick`, `process.stdin`, `process.stdout`, `process.stderr` |
| Callback filesystem API | `readFile(path, callback)`, `writeFile(path, data, callback)` |
| Stateful crypto | ciphers, password derivation, signing, and verification |
| Host inspection | detailed CPU, network-interface, user, priority, and constants APIs |
| Open formatting/reflection | broad `util.format`, `inspect`, and deep-equality forms |
| Assertion variants | loose/deep equality, exception, match, and `ifError` forms without exact rows |
| URL patterns | `URLPattern`, `urlToHttpOptions`, and open URL formatting |
| Dynamic and retired modules | `node:vm` and rejected `node:dgram` or `node:querystring` contracts |

Synchronous and promise filesystem calls, path, process state, Buffer, HTTP,
selected crypto/zlib, URL, OS, timers, assertions, and closed stream/sink
operations remain governed by their exact provider declarations.

## Generated project boundary

Generated projects use `Microsoft.NET.Sdk`. Web, desktop, test, MAUI, and
custom SDK projects must be user-owned. Tsonic emits source for them but does
not synthesize or rewrite their native project graph.

## Provider boundaries

Ambiguous provider relations, contradictory metadata, missing referenced
assemblies, unsupported defaults, unresolved type families, and invalid
heritage fail at provider closure. The target does not broaden imports or omit
declarations to make checking pass.

Self-recursive and mutually recursive reflected delegate signatures are not
currently representable as one finite declaration model. A project class also
cannot inherit a provider abstraction whose construction operation is a
factory rather than an actual CLR constructor. Ordinary delegates, .NET base
classes, pointers, function pointers, ranked arrays, ref returns, indexers,
events, and generic constraints remain supported when metadata is
representable.

## Source forms with supported alternatives

Some legal TypeScript forms have no direct C# source contract: abstract
declarations, string-valued enums, and an uncontextualized empty array literal
are examples. Use a concrete interface/base contract, a closed string-literal
union, or an explicit array element type when that preserves the program. The
target does not infer a missing carrier from later use.

## Deliberate source-to-source boundaries

Tsonic does not provide a general runtime JavaScript engine inside a C#
program. A JavaScript operation is available only when the selected source
surface has one closed, tested C# implementation. Likewise, a legal
TypeScript construct may still reject when preserving its initialization,
aliasing, exception, or reflection behavior would require open runtime
machinery. The diagnostic identifies the missing target contract; it is not a
request to approximate the behavior.
