# Toolchains and platforms

Tsonic generates native source. Target toolchains build that source.

## Host

| Tool | Contract |
| --- | --- |
| Node.js | 22.18 or newer |
| npm | Installs project-local targets and capabilities |

The CLI does not download toolchains or install plugins.

## C#

| Item | Contract |
| --- | --- |
| SDK | .NET 10 SDK |
| Default target framework | `net10.0` |
| Generated SDK | `Microsoft.NET.Sdk` |
| Stable language dialect | C# 14 |
| Optional preview dialect | C# 15 preview |

The selected SDK must contain the reference pack for `targetFramework`.
Framework and assembly provider inputs are snapshotted for one compilation.

Use a user-owned project for another SDK shape. Tsonic does not change an
ASP.NET, desktop, mobile, test, or custom SDK project into a generated
`Microsoft.NET.Sdk` project.

## Rust

The Rust target requires `cargo`, `rustc`, and `rustdoc` from one coherent
toolchain. Native validation commonly also uses `rustfmt` and Clippy.

Tsonic records the exact `rustc -vV` identity and consumes rustdoc JSON from
that toolchain. An unsupported rustdoc schema is rejected. The project does not
promise that every historical or future Rust release has the same rustdoc JSON
contract.

Install cross targets with `rustup` or the equivalent toolchain manager. Cargo
owns target triples and linkers.

## Platform support

Tsonic itself is platform-neutral Node software. A target is usable only where
its native toolchain, runtime packages, framework packs, and linker inputs are
available.

Generated code does not imply deployment support. For example, selecting
`linux-x64` in a C# property or a Rust target triple still requires the native
SDK components and platform libraries needed by that target.
