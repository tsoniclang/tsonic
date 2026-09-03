# Toolchains and platforms

Tsonic generates native source. Target toolchains build that source.

## Host

| Tool | Contract |
| --- | --- |
| Node.js | 22.18 or newer |
| npm | Installs project-local targets and capabilities |

Install Node from the [official download page](https://nodejs.org/en/download)
and verify:

```sh
node --version
npm --version
```

The CLI does not download toolchains or install plugins. Install the CLI and
one target in each project; do not depend on a global Tsonic installation.

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

Install the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0),
using Microsoft's [platform instructions](https://learn.microsoft.com/en-us/dotnet/core/install/)
when needed. Confirm that a `10.0.x` SDK is listed:

```sh
dotnet --version
dotnet --list-sdks
```

Use a user-owned project for another SDK shape. Tsonic does not change an
ASP.NET, desktop, mobile, test, or custom SDK project into a generated
`Microsoft.NET.Sdk` project.

## Rust

The Rust target requires `cargo`, `rustc`, `rustdoc`, and `rustfmt` from one
coherent toolchain. Tsonic runs `rustfmt` over every generated Rust source file
before publishing the output. Missing or failed formatting rejects the target
compilation; Tsonic does not publish an unformatted fallback. Clippy is used by
the native validation gates.

Tsonic records the exact `rustc -vV` identity and consumes rustdoc JSON from
that toolchain. An unsupported rustdoc schema is rejected. The project does not
promise that every historical or future Rust release has the same rustdoc JSON
contract.

Install Rust with [rustup](https://www.rust-lang.org/tools/install). A normal
hosted installation can be prepared and checked with:

```sh
rustup toolchain install stable
rustup default stable
rustup component add rustfmt
rustup show active-toolchain
rustc --version
cargo --version
rustdoc --version
rustfmt --version
```

Clippy is optional unless you run `cargo clippy`. Install it from the same
toolchain with `rustup component add clippy`.

Install cross targets with `rustup target add <triple>`. Cargo owns target
triples and linkers.

## Platform support

Tsonic itself is platform-neutral Node software. A target is usable only where
its native toolchain, runtime packages, framework packs, and linker inputs are
available.

Generated code does not imply deployment support. For example, selecting
`linux-x64` in a C# property or a Rust target triple still requires the native
SDK components and platform libraries needed by that target.
