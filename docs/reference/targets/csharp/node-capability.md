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

## Engine-specific controls

The native program does not contain V8. The named
`node:v8.setFlagsFromString(flags)` import is available so an optional engine
control need not prevent compilation. Calling it always throws an explicit
unsupported-operation error, including for an empty flag string. Importing it
does not change process state. It does not adjust native thread stacks.

```ts
import { setFlagsFromString } from "node:v8";

export function requestEngineFlags(flags: string): void {
  setFlagsFromString(flags);
}
```

`getHeapStatistics` is not supplied: native memory measurements are not V8 heap
statistics. This boundary does not provide a general V8 implementation.
