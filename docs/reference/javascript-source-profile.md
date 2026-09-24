# JavaScript source profile

Select the JavaScript source profile with `surfaces: ["js"]` on a C# or Rust
target. The profile supplies JavaScript globals and built-ins; the target
supplies their carriers and runtime implementation.

These are native operations, not a JavaScript runtime. See
[native numbers](native-numerics.md) for integer widths, bitwise operations,
numeric predicates and allocation limits.

## Covered source families

- `Array` and readonly arrays with native dense storage;
- `String`, `Boolean`, `Number`, and `Math`;
- `Map`, `Set`, and their iterators;
- `Date`;
- `RegExp` and the standard string/regular-expression protocols;
- `JSON` over closed supported value graphs;
- `Promise`, async functions, and selected timer APIs;
- `console`;
- typed arrays and other declarations provided by the active profile.

Each target's support matrix records implemented operations and precise target
limits. See [native performance](native-performance.md) for the native string
units, dense-array contract, explicit UTF-16 values and retained ownership costs.

## Native strings and `JsString`

`string` remains the default source string:

```ts
const path: string = "content/index.md";
```

Exact JavaScript UTF-16 code-unit behavior is explicit:

```ts
import { jsstr } from "@tsonic/js/lang.js";
import type { JsString } from "@tsonic/js/types.js";

const value: JsString = jsstr("😀");
```

Targets must not infer `JsString` from literals, selected surface, member
spelling, or API use. Native APIs such as file-system paths continue to accept
ordinary `string` unless their declared contract says otherwise.

## Error stacks

```ts
const error = new Error("Cannot load the file");
Error.captureStackTrace(error);
const stack = error.stack;
if (stack !== undefined) console.log(stack);
```

C# and Rust do not capture stacks during Error construction or when `stack` is
read. Call `Error.captureStackTrace(error)` explicitly to capture and format the
native stack at that call. Aliases and rethrows retain the resulting string;
calling it again replaces the previous snapshot. Without capture or an explicit
stack assignment, `stack` is undefined, including for runtime-created errors.

Frame names, filenames, and available debug information belong to the native
toolchain. The text is not a V8 stack or a promised mapping to the authored
TypeScript. Do not parse it as a portable source-location protocol. Only the
explicit call pays capture and formatting costs. Rust requires its `std`
foundation for capture; `alloc`-only errors still work without stacks. C# retains
the CLR's normal throw-time exception behavior independently of this source
stack property. Rust currently supports explicit capture and stack reads, not
arbitrary stack-property assignment.

## Target references

- [C# JavaScript surface](targets/csharp/javascript-surface.md)
- [Rust JavaScript surface](targets/rust/javascript-surface.md)
