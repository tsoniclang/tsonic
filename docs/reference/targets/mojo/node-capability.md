# Mojo Node capability

`@tsonic/mojo-nodejs` supplies `node:*` modules independently of the JavaScript
surface. It includes provider declarations, exact Mojo argument/result bindings
and runtime package requirements.

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function load(directory: string): string {
  const path = join(directory, "config.json");
  return existsSync(path) ? readFileSync(path, "utf8") : "{}";
}
```

The path stays a native string. The selected synchronous filesystem operation
propagates errors through the generated Mojo `raises` contract. No Node process
or embedded JavaScript engine implements this call.

An exported module name alone does not certify all of its members and overloads.
The capability's provider/runtime tests and the Node proof projects are the
authority for supported signatures. See [limitations](limitations.md) for the
native variadic compiler boundary.
