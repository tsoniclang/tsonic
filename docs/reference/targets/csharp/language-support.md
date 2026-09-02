# C# language support

The C# target supports TypeScript when the checked source semantics can be
represented faithfully by the approved static C# architecture.

| Area | Supported contracts |
| --- | --- |
| Modules | ESM imports/exports, side-effect imports, source packages, module initialization, default exports |
| Declarations | Functions, classes, interfaces, enums, aliases, generics, overload implementations, inheritance, constructors, statics |
| Values | Primitives, arrays, tuples, structural object shapes, discriminated unions, nullable values, and finite broad values through the closed `TsValue` carrier |
| Calls | Source and provider overloads, generics, optional/rest parameters, callbacks, constructors, parameter modes, conversions |
| Expressions | Arithmetic, comparisons, boolean logic, optional chains, nullish coalescing, properties, elements, assignments, spreads, assertions |
| Control flow | Blocks, branches, switch, loops, labels, exceptions, `finally`, async/await |
| Iteration | Arrays, strings, provider iterables, `for...of`, `for await...of` |
| Generators | Sync, async, bidirectional `next(value)`, completion, throw/return, delegation where representable |
| Resources | `using`, `await using`, lexical cleanup and exceptional cleanup |
| TypeScript types | The complete pinned utility family: object and union transformations, callable and constructor projections, `Awaited`, inference/context utilities, and string-literal transformations |
| Native interop | .NET virtual declarations, attributes, byrefs, delegates, tasks, pointers, function pointers, explicit safety |
| JS surface | Closed implemented JavaScript operation families |
| Node | Installed C# Node capability inventory |

Support is evidence-driven. A syntax form is not accepted merely because C#
has similar syntax; the target must prove its types, operations, evaluation
order, exceptions, ownership/storage behavior, and emitted contract.
