# C# Node capability

Install `@tsonic/csharp-nodejs`. Authored source imports standard `node:*`
modules; the package contributes exact provider declarations, C# operations,
the `Tsonic.CSharp.Node` runtime assembly, and required runtime references.

```ts
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export function title(path: string): string {
  return `${basename(path)}:${readFileSync(path, "utf8").length}`;
}
```

Covered module families include file systems, path, process, OS, URL, Buffer,
HTTP, crypto, zlib, streams, timers, assertions, and utilities according to the
capability's provider inventory. Node is independent of the JS surface: a pure
C# profile may import `node:path` while using `System.Console`.

Unavailable APIs reject at provider selection. They are not forwarded to an
embedded Node process.

See the detailed [support inventory](support-inventory.md).
