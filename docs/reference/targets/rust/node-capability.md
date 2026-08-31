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
