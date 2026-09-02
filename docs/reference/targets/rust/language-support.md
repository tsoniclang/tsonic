# Rust language support

The Rust target supports TypeScript when the checked source semantics can be
represented faithfully by the approved static Rust architecture.

| Area | Supported contracts |
| --- | --- |
| Modules | ESM imports/exports, side-effect imports, source packages, source-ordered module initialization, default exports |
| Declarations | Functions, classes, interfaces, enums, aliases, generics, overload implementations, inheritance, constructors, statics, static blocks |
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
