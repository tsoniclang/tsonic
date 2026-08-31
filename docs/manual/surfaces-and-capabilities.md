# Source profiles, surfaces, and capabilities

These concepts are independent.

## Native source profile

With no selected surface, each target supplies its native source profile.

C# can use .NET virtual declarations:

```ts
import { Console } from "@tsonic/dotnet/System.js";
Console.WriteLine("native C# profile");
```

Rust can use compiler-backed Rust declarations:

```ts
import { HashMap } from "@tsonic/rust/std/collections.js";
const values = new HashMap<string, int32>();
```

## JavaScript surface

Select the JavaScript source profile explicitly:

```json
{
  "targets": [{
    "id": "rust",
    "surfaces": ["js"]
  }]
}
```

The same source contract can then be used for either target:

```ts
const parts = "/posts/42".split("/");
console.log(parts.length);
```

The source profile defines JavaScript-visible declarations and semantics. Each
target still owns its carrier, operation mapping, runtime implementation, and
precise rejection boundaries.

Native TypeScript `string` remains the default string domain. Exact JavaScript
UTF-16 code-unit behavior is requested explicitly with `JsString` and `jsstr`:

```ts
import { jsstr } from "@tsonic/js/lang.js";

const exact = jsstr("😀");
```

Targets do not infer `JsString` from a string literal or from selecting the JS
surface.

## Capability packages

A capability adds importable APIs without selecting an ambient source profile.
Node is the principal example:

```ts
import { statSync } from "node:fs";

export function isDirectory(path: string): boolean {
  return statSync(path).isDirectory();
}
```

Install `@tsonic/csharp-nodejs` or `@tsonic/rust-nodejs` for the selected target.
The source continues to use normal `node:*` module specifiers. Installing the
package does not make JavaScript globals available and does not add
`surfaces: ["js"]` implicitly.

See the [JavaScript profile reference](../reference/javascript-source-profile.md)
and [Node capability reference](../reference/node-capability.md).
