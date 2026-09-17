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

## Synchronous child processes

`spawnSync` uses .NET's `System.Diagnostics.Process`, not Node or libuv.
It supports argument arrays, a working directory, an independent child
environment, binary input, and piped or inherited standard streams.

```ts
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";

const result = spawnSync("cat", [], {
  input: Buffer.from("hello"),
  maxBuffer: 4096,
});
const output = result.stdout;
if (result.status === 0 && output !== null) {
  const text = output.toString("utf8");
}
```

The JS profile also accepts `Uint8Array` input, including subarray views.
Input is read when the call starts; assigning an options field does not copy
the bytes or the `stdio` array. An omitted environment inherits the parent;
an explicit environment record supplies the child's complete environment.
Creating or changing that record does not change `process.env`.

Uncaptured output is `null`. A launch failure has no `pid` or `status`, leaves
both output fields `null`, and reports `error.code` and `error.message`.
An ordinary nonzero exit is not a launch error.

Public .NET process APIs cannot express every Node launch contract:

- Numeric `uid`/`gid`, remapped or extra descriptors, and `"ignore"` streams
  are rejected before launch. `"pipe"`, `"inherit"`, and matching inherited
  descriptors 0, 1 and 2 are supported.
- Nonzero `timeout` and explicit `killSignal` are rejected before launch.
  The runtime does not substitute forceful termination for `SIGTERM`.
- If captured output exceeds `maxBuffer`, the runtime stops the child and
  throws an unsupported-operation error. It does not fabricate Node's signal
  result. Memory remains bounded; overflow is not silently ignored.
- On Unix, .NET cannot distinguish certain exit codes from signal termination.
  Exit results of 128 or greater therefore throw rather than inventing
  `status` or `signal`. Ordinary exits below 128 retain their exact status.

These are C# platform limitations, not restrictions on Rust's native launcher.

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
