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

The project creator installs the CLI and one target locally. Neither the
creator nor the CLI downloads native toolchains. Do not depend on a global
Tsonic installation.

## C#

| Item | Contract |
| --- | --- |
| SDK | An installed .NET 10-or-later SDK supporting the selected framework |
| Default target framework | `net10.0` |
| Generated SDK | `Microsoft.NET.Sdk` |
| Stable language dialect | C# 14 |
| Optional preview dialect | C# 15 preview |

The selected SDK must support `targetFramework`; its matching .NET runtime and
required reference packs must also be installed. Tsonic follows native SDK
selection, including the application's `global.json`.
Framework and assembly provider inputs are snapshotted for one compilation.

Install the [.NET SDK](https://dotnet.microsoft.com/en-us/download/dotnet),
using Microsoft's [platform instructions](https://learn.microsoft.com/en-us/dotnet/core/install/)
when needed. Confirm the SDK and runtime for your chosen framework are listed:

```sh
dotnet --version
dotnet --list-sdks
dotnet --list-runtimes
```

The default is `net10.0`. To target .NET 11, set
`target.options.targetFramework` to `net11.0` in `tsonic.json` and select a suitable
SDK. Later frameworks use the same setting; an unavailable framework is an error,
not a reason to substitute .NET 10. C# language dialect remains a separate option.

The C# npm runtimes ship source projects. MSBuild builds them for the selected
framework and caches outputs outside `node_modules`. Installing another framework
does not require a differently precompiled Tsonic runtime package.

Release verification can exercise several installed SDKs against the same npm
installation. For example, maintainers can set `TSONIC_CSHARP_FRAMEWORK_MATRIX`
to a JSON array of `{ "framework": "net11.0", "sdk": "11.0.100-rc.1.26425.128" }`
records when running `node scripts/release/verify-packed-install.mjs`. Use exact
SDK versions present on that machine. Each selection runs the native, JS and
Node source-runtime closure, repeats the build, and checks that installed
packages remain unchanged. This is a verification input, not application config.

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

## Mojo

The current Mojo target pins SDK `1.1.0.dev2026083005` and `linux-64`, using a
Pixi environment. Generation needs the compiler for native queries and
`mojo format`; native building uses the generated Pixi tasks.

```sh
mojo --version
pixi run --manifest-path out/mojo/pixi.toml build
```

Use the [Mojo setup](../manual/targets/mojo/README.md) and
[compiler configuration](targets/mojo/configuration.md) for the current
source-workspace route. The published C#/Rust project creator does not install
this target or its SDK.

## Platform support

Tsonic itself is platform-neutral Node software. A target is usable only where
its native toolchain, runtime packages, framework packs, and linker inputs are
available.

Generated code does not imply deployment support. For example, selecting
`linux-x64` in a C# property or a Rust target triple still requires the native
SDK components and platform libraries needed by that target.
