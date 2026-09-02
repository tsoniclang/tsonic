# Node capability

Node support is an installed capability, not a source surface.

| Target | Capability package | Runtime |
| --- | --- | --- |
| C# | `@tsonic/csharp-nodejs` | `Tsonic.CSharp.Node` |
| Rust | `@tsonic/rust-nodejs` | `tsonic_rust_node` |

Authored source uses standard module specifiers:

```ts
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = join(process.cwd(), ".generated");
mkdirSync(root, { recursive: true });
const text = readFileSync(join(root, "input.txt"), "utf8");
rmSync(root, { recursive: true, force: true });
```

Installing the capability:

- activates only modules whose exact imports are present;
- does not activate the JavaScript source profile;
- contributes target runtime/project references explicitly;
- maps declarations through provider/module/export/member/signature identity;
- rejects unavailable Node behavior without source-name fallback.

The capability families include the supported portions of `node:fs`,
`node:fs/promises`, `node:path`, `node:process`, `node:os`, `node:url`, Buffer,
HTTP, crypto, zlib, streams, timers, assertions, and utilities. Exact per-target
coverage is documented in:

- [C# Node support](targets/csharp/node-capability.md)
- [Rust Node support](targets/rust/node-capability.md)

An API absent from a target's inventory is not silently emulated.
