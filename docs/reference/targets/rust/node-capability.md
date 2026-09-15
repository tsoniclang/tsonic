# Rust Node capability

Install `@tsonic/rust-nodejs`. Authored source imports standard `node:*`
modules; the capability contributes exact provider declarations, Rust
operation rows, the `tsonic_rust_node` crate, and its minimum foundation.

```ts
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export function title(path: string): string {
  return `${basename(path)}:${readFileSync(path, "utf8").length}`;
}
```

Covered module families include filesystem, path, process, OS, URL, Buffer,
HTTP, crypto, zlib, utilities, timers, assertions, and the closed stream/sink
operations in the capability inventory. Installed but unused Node support adds
no Cargo dependency.

Node support is independent of the JS surface. A native Rust profile may
import `node:path` without activating JavaScript globals. Unavailable Node
operations reject at provider selection and are never forwarded to a Node
process.

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
