# C# language support

The C# target supports TypeScript when the checked source semantics can be
represented faithfully by the approved static C# architecture.

| Area | Supported contracts |
| --- | --- |
| Modules | ESM imports/exports, side-effect imports, source packages, module initialization, default exports |
| Declarations | Functions, classes, abstract declarations, readonly fields, interfaces, enums, aliases, generics, overload implementations, inheritance, constructors, statics |
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

## Structural views

A class instance can satisfy a checked structural contract without copying its
fields into a new object:

```ts
class Counter { count: number = 0; }
function view(value: Counter): { count: number } { return value; }

const counter = new Counter();
view(counter).count = 2;
```

Both references observe the same storage. Generated interfaces expose the
selected properties and methods, including inherited members and closed
generic contracts. A readonly view does not freeze the original object or
make a writable alias readonly.

## Callable and constructor values

Generic object methods become native generic methods, not erased delegates:

```ts
const operations = {
  identity<Value>(value: Value): Value { return value; },
};

const result = operations.identity("ready");
```

Captured variables retain their source activation and shared mutation. A method
value retains its selected environment; copying an object does not rerun or
rebind a copied method's captures. Detached methods still need an exact receiver
contract.

Lambda parameters can use checked binding patterns, including nested
destructuring and defaults. Calls through a compatible union retain each
selected method's defaults, rest arguments, result, and error contract. An
incompatible union is still rejected by source checking. Constructor values
retain the selected class and arguments rather than invoking runtime reflection.
