# Rust projects and output

## Generated Cargo crate

Without `projectFile`, Tsonic emits a complete Cargo project:

```text
out/rust/
├── Cargo.toml
└── src/
    ├── lib.rs or main.rs
    └── <source-owned Rust modules>
```

```json
{
  "targets": [{
    "id": "rust",
    "options": {
      "crateName": "example_app",
      "edition": "2024",
      "foundation": "std",
      "outputType": "bin"
    }
  }]
}
```

Generated manifests contain only closed dependencies contributed by the
selected target, source surface, and activated capabilities. An installed but
unused capability contributes no crate.

`outputType: "bin"` requires an exported entry function:

```ts
export function main(): void {
  // application startup
}
```

This may also be `async function main(): Promise<void>`. A fallible entry is
emitted as a native `Result` path. `outputType: "lib"` instead exposes
supported TypeScript exports as Rust library declarations.

## Foundation

| Foundation | Generated crate | Available semantic layer |
| --- | --- | --- |
| `core` | `#![no_std]` library | `core` only |
| `alloc` | `#![no_std]`, `extern crate alloc` library | `core` + allocator-backed carriers |
| `std` | hosted library or binary | `core` + `alloc` + `std` |

Tsonic does not invent panic handlers, allocators, entrypoints, link scripts,
or target triples. Therefore `core` and `alloc` generated outputs are
libraries; a native project owns executable startup.

## User-owned Cargo project

```json
{
  "targets": [{
    "id": "rust",
    "options": {
      "projectFile": "native/Cargo.toml",
      "foundation": "std"
    }
  }]
}
```

The manifest must exist outside generated output. Tsonic emits source
artifacts only and never creates or mutates the manifest. The user project owns
dependencies, features, profiles, target triples, build scripts, linking,
startup, and inclusion of generated source.

A hosted library project has this basic shape:

```toml
[package]
name = "example_native"
version = "0.1.0"
edition = "2024"

[lib]
path = "../out/rust/src/lib.rs"

[dependencies]
tsonic_rust_runtime = {
  path = "../node_modules/@tsonic/rust-runtime/crates/tsonic_rust_runtime",
  default-features = false,
  features = ["std"],
}
```

Adjust both paths for the actual layout. Add every capability/runtime crate and
every `@tsonic/rust/crates/*` dependency directly. Tsonic validates the
configured Cargo graph but does not edit it.

Select the runtime feature that matches the target foundation:

| Foundation | Runtime dependency |
| --- | --- |
| `core` | `default-features = false` with no feature |
| `alloc` | `default-features = false, features = ["alloc"]` |
| `std` | `default-features = false, features = ["std"]` |

## What each setting controls

| Need | Put it here |
| --- | --- |
| generated crate name, edition, library/binary shape | Rust target options |
| maximum `core`/`alloc`/`std` semantic layer | `foundation` |
| target triple, profiles, features, linker, build script | Cargo |
| third-party native crate | direct Cargo dependency plus `@tsonic/rust/crates/*` import |
| allocator, panic handler, startup, image format | user-owned native project |

There is no generic “Cargo overrides” object. Cargo owns Cargo configuration;
Tsonic owns the source and target semantic contract.

## Native build

```sh
npx tsonic build -p tsonic.json
cargo build --manifest-path out/rust/Cargo.toml
```

Tsonic's toolchain stage reports the generated artifact set; Cargo performs
the native compile, test, run, and publish operations.

After the first build creates `Cargo.lock`, reproducible commands can add
`--locked`:

```sh
cargo test --manifest-path out/rust/Cargo.toml --locked
```
