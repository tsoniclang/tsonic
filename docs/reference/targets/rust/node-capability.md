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

`getHeapStatistics()` also imports and type-checks, but always throws when
called. Its `HeapInfo` result contract lets optional diagnostic code compile;
the native runtime never returns invented V8 measurements.

```ts
import { getHeapStatistics } from "node:v8";

export function reportHeapLimit(): number {
  return getHeapStatistics().heap_size_limit;
}
```

Importing this function is safe; calling it throws. A program that needs heap
statistics on its normal execution path needs a native implementation of that
requirement. This boundary does not provide one, or a general V8 implementation.
