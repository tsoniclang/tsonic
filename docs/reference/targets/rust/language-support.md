# Rust language support

The Rust target supports TypeScript when the checked source semantics can be
represented faithfully by the approved static Rust architecture.

| Area | Supported contracts |
| --- | --- |
| Modules | ESM imports/exports, side-effect imports, source packages, source-ordered module initialization, default exports |
| Declarations | Functions, classes, abstract declarations, readonly fields, interfaces, enums, aliases, generics, overload implementations, inheritance, constructors, statics, static blocks |
| Values | Primitives, arrays, fixed arrays, tuples, structural records, string-literal enums, discriminated unions, nullable values, and producer-owned finite broad values |
| Calls | Source/provider overloads, generics, optional/rest parameters, callbacks, constructors, parameter modes, conversions |
| Expressions | Arithmetic, comparisons, boolean logic, optional chains, nullish coalescing, properties, elements, assignments, spreads, assertions |
| Control flow | Blocks, branches, switch/fallthrough, loops, labels where representable, exceptions, `finally`, async/await |
| Iteration | Arrays, strings, provider iterables, `for...of`, `for await...of` |
| Generators | Sync, async, bidirectional `next(value)`, completion, throw/return, `yield*`, retained-borrow protocols |
| Resources | `using`, `await using`, lexical and exceptional cleanup |
| TypeScript types | The complete pinned utility family when its resolved result has a closed Rust representation |
| Rust ownership | Inferred ordinary ownership plus explicit references, lifetimes, bounds, higher-ranked callables, trait objects, and opaque captures |
| Native interop | rustdoc virtual declarations, direct Cargo dependencies, references, raw pointers, ABIs, safety, fallibility, associated types |
| JS surface | Closed implemented JavaScript operation families |
| Node | Installed Rust Node capability inventory |
| Foundations | Independently verified `core`, `alloc`, and `std` requirement closure |

Support is fact-driven. Similar-looking Rust syntax is insufficient: the
target must prove source evaluation order, carrier identity, ownership,
borrows, cleanup, errors, module initialization, and native API identity before
planning.

## Structural views

A class instance can satisfy a checked structural contract without copying its
fields into a new object:

```ts
class Counter { count: number = 0; }
function view(value: Counter): { count: number } { return value; }

const counter = new Counter();
view(counter).count = 2;
```

Both references observe the same storage. The same rule covers parameters,
returns, inherited members, accessors, and closed generic contracts. A readonly
view does not freeze the original object or make a writable alias readonly.

## Callable and constructor values

Generic function values retain their type parameters and captured environment.
Calls through a compatible union retain each selected method's defaults, rest
arguments, result, and error contract. An incompatible union is still rejected
by source checking.

Local classes and class expressions can capture values and return constructors.
Each evaluation retains its own static state and observable constructor
identity. This produces statically known native types and environments, not
runtime-generated Rust types or reflection.

Async arrows and generator expressions use the same suspension and cleanup
contracts as declared functions. An escaping suspended call retains its
receiver; a locally awaited call does not require an extra shared owner merely
because it is async. Authored borrows still have to satisfy their lifetimes.
