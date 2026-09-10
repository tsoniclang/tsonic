# Mojo support inventory

The [Mojo pudding](https://github.com/tsoniclang/mojo-pudding) contains native
execution proofs, not just generated-code snapshots.

| Proof family | What it exercises |
| --- | --- |
| Native | Exact integer source types and native calls into generated code. |
| Language | Records, classes, generics, destructuring, arrays and iteration. |
| Project dispatch | Inheritance, interfaces, overloads and bound methods. |
| Resources | Synchronous/asynchronous disposal and reverse-order cleanup. |
| Compile-time ownership | Compile-time declarations, unrolling, copy and materialization. |
| Workspace | ESM source-package dependencies. |
| JavaScript values | Strings, JSON, structural values and callbacks. |
| RegExp/Unicode | Literal/dynamic regular expressions and normalization. |
| Node | Filesystem, paths and native error propagation. |
| Node capabilities | Binary values, compression, decoding and callbacks. |

The target's parity inventory classifies supported and unsupported lanes. A row
marked as a deliberate rejection is not an implemented capability. Do not infer
complete C#/Rust parity or full Node API coverage from a project count.

For a concrete boundary, native pointer operations and layout-backed raw-memory
reinterpretation are different capabilities; see [limitations](limitations.md).
