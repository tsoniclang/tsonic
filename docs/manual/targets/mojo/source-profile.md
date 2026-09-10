# Mojo source profile

Native Mojo is the default profile. Selecting `surfaces: ["js"]` enables the
JavaScript globals and built-ins supplied by the target. Node imports are an
independent capability supplied by `@tsonic/mojo-nodejs`.

For example, ordinary native source can specify exact numeric types:

```ts
import type { i32 } from "@tsonic/mojo/types.js";

export function twice(value: i32): i32 {
  return value * 2;
}
```

For JavaScript source, select the surface in the project:

```json
{
  "surfaces": ["js"],
  "targets": [{ "id": "mojo" }]
}
```

That is a configuration fragment; retain the project's source and output paths.
The surface is not a request to replace every native value with a JavaScript
runtime object. Native strings and explicitly requested UTF-16 strings remain
separate. See [JavaScript surface](../../../reference/targets/mojo/javascript-surface.md).

Node code uses the same authored imports as the other targets:

```ts
import { existsSync, readFileSync } from "node:fs";

export function loadText(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "missing";
}
```

The installed Mojo Node capability supplies declarations and native runtime
bindings. This does not run Node.js inside the emitted program. Native Mojo
packages instead use the [native provider](../../../reference/targets/mojo/native-apis.md).
