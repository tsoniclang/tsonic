# C# JavaScript surface

Select with `surfaces: ["js"]`. The target composes the shared JavaScript source
profile and references `@tsonic/csharp-js`.

Implemented families include arrays, strings, maps, sets, dates, JSON with
replacer callbacks and selected `toJSON`, regular expressions, promises,
`Intl`, symbols, weak collections, timers, numeric typed arrays, number/math
operations, and console APIs covered by the selected operation tables and
runtime proofs.

```ts
const expression = /(?<name>[a-z]+)/giu;
const match = expression.exec("Tsonic");
console.log(match?.groups?.name);
```

Regular expressions use complete ECMAScript syntax and state rather than
`System.Text.RegularExpressions` approximation. Exact JavaScript UTF-16 values
use the explicit `JsString` lane; ordinary native strings remain the default.

Open reflection, `eval`, arbitrary dynamic member access, and unsupported
runtime object projection remain rejected.

See the detailed [support inventory](support-inventory.md).
