# Rust JavaScript surface

Select with `surfaces: ["js"]`. The target composes the shared JavaScript
source profile and activates `@tsonic/rust-js` only when selected operations
require it.

Implemented closed families include arrays, strings, maps, sets, dates, JSON
with replacer callbacks and selected `toJSON`, regular expressions, promises,
`Intl`, symbols, weak collections, timers, numeric/math operations, console
APIs, object-shape operations, and numeric typed arrays covered by the
operation inventory and runtime proofs.

```ts
const expression = /(?<name>[a-z]+)/giu;
const match = expression.exec("Tsonic");
console.log(match?.groups?.name);
```

Regular expressions use an ECMAScript engine rather than translating patterns
to Rust regex syntax. Exact UTF-16 behavior uses the explicit `JsString` lane
only where selected; native Rust strings remain the default carrier.

The JS surface does not add an embedded JavaScript engine or open reflection.
Each accepted operation has one static Rust lowering or one closed runtime
contract. Unsupported dynamic behavior rejects.

See the detailed [support inventory](support-inventory.md).
