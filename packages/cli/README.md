# `@tsonic/cli`

Project-local command-line interface for Tsonic.

Install the CLI with one target pack:

```sh
# C#
npm install --save-dev @tsonic/cli@^0.1.0 @tsonic/target-csharp@^0.1.0

# Rust
npm install --save-dev @tsonic/cli@^0.1.0 @tsonic/target-rust@^0.1.0
```

Then verify target discovery and build the project:

```sh
npx --no-install tsonic targets --project tsonic.json
npx --no-install tsonic build --project tsonic.json
```

Tsonic requires Node.js 22.18 or newer. Generated C# requires the .NET 10
SDK. Generated Rust requires a rustup toolchain containing Cargo, rustc,
rustdoc, and rustfmt.

The complete installation and first-project guide is in the
[Tsonic manual](https://github.com/tsoniclang/tsonic/blob/main/docs/manual/get-started.md).
