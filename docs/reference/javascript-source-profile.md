# JavaScript source profile

Select the JavaScript source profile with `surfaces: ["js"]` on a C# or Rust
target. The profile supplies JavaScript globals and built-ins; the target
supplies their carriers and runtime implementation.

## Covered source families

- `Array`, readonly arrays, sparse arrays where the target provides an exact
  identity-preserving carrier;
- `String`, `Boolean`, `Number`, and `Math`;
- `Map`, `Set`, and their iterators;
- `Date`;
- `RegExp` and the standard string/regular-expression protocols;
- `JSON` over closed supported value graphs;
- `Promise`, async functions, and selected timer APIs;
- `console`;
- typed arrays and other declarations provided by the active profile.

Support for a declaration is not permission to approximate it. Each target's
support matrix records implemented operations and precise target limits.

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

## Target references

- [C# JavaScript surface](targets/csharp/javascript-surface.md)
- [Rust JavaScript surface](targets/rust/javascript-surface.md)
