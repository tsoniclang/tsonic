# Build, test, and deploy

Tsonic has one job: produce a complete native source project. The native
toolchain owns compilation, tests, packaging, and deployment.

## Generate source

```sh
npx --no-install tsonic build --project tsonic.json
```

The command checks the TypeScript program, compiles every selected target, and
publishes `outDir` only when the whole build succeeds.

## C#

Build and run a generated application:

```sh
dotnet build out/csharp/Example.App.csproj
dotnet run --project out/csharp/Example.App.csproj
```

Publish a normal release:

```sh
dotnet publish out/csharp/Example.App.csproj -c Release
```

Generated projects accept supported MSBuild properties. Target-owned settings
use dedicated options; open deployment settings use `properties`:

```json
{
  "id": "csharp",
  "options": {
    "assemblyName": "Example.App",
    "outputType": "Exe",
    "publishAot": true,
    "properties": {
      "RuntimeIdentifier": "linux-x64",
      "SelfContained": true,
      "PublishSingleFile": true
    }
  }
}
```

Then publish:

```sh
dotnet publish out/csharp/Example.App.csproj -c Release
```

Use a user-owned `.csproj` for Web, desktop, test, MAUI, custom SDK, signing,
or other project structures that are not a plain `Microsoft.NET.Sdk` project.

## Rust

The first Cargo command after each Tsonic generation creates `Cargo.lock` when
needed:

```sh
cargo build --manifest-path out/rust/Cargo.toml
cargo run --manifest-path out/rust/Cargo.toml
```

After that lockfile exists, commands against the current generated tree may use
`--locked`:

```sh
cargo fmt --manifest-path out/rust/Cargo.toml --all --check
cargo clippy --manifest-path out/rust/Cargo.toml --all-targets --locked -- -D warnings
cargo test --manifest-path out/rust/Cargo.toml --locked
```

`outDir` is compiler-owned. Another successful `tsonic build` replaces the
whole generated tree, including a lockfile created there by Cargo. Run one
unlocked Cargo command again after regeneration. If a lockfile must survive
source generation and be committed, use a user-owned `Cargo.toml`; Tsonic
then emits source into that native project without owning its lockfile.

Cross-compile a hosted Rust application with the normal Cargo target option:

```sh
rustup target add aarch64-unknown-linux-gnu
cargo build --manifest-path out/rust/Cargo.toml \
  --target aarch64-unknown-linux-gnu \
  --release
```

Tsonic does not infer a target triple from source code.

## Bare metal and operating systems

Building an application *for* Linux or Windows is ordinary cross compilation.
Building an operating system, kernel, firmware image, or bare-metal program is
different: the native project must own startup and platform policy.

Use Rust `foundation: "core"` or `"alloc"`, `outputType: "lib"`, and a
user-owned Cargo project:

```json
{
  "targets": [{
    "id": "rust",
    "options": {
      "foundation": "core",
      "outputType": "lib",
      "projectFile": "native/Cargo.toml"
    }
  }]
}
```

The native project supplies the target triple, startup symbol, panic handler,
allocator when needed, linker script, build script, and final image format.
Tsonic supplies generated Rust library source only.

## Tests

Test TypeScript through a native test project:

- C#: use a user-owned xUnit, NUnit, or MSTest project that includes or
  references generated source.
- Rust: use a user-owned Cargo project with native test targets, or test a
  generated library from a separate crate.

Tsonic does not implement a second test runner. Native tests exercise the code
that will ship.

## Debug generated code

Generated source is ordinary target source:

- C#: inspect `out/csharp/src` and `out/csharp/generated`.
- Rust: inspect `out/rust/src`.

Keep fixes in TypeScript or in the owning target/provider contract. Editing
generated output is temporary because the next successful Tsonic build
replaces the complete output tree.
