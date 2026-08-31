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

## Native build

```sh
npx tsonic build -p tsonic.json
cargo build --manifest-path out/rust/Cargo.toml --locked
```

Tsonic's toolchain stage reports the generated artifact set; Cargo performs
the native compile, test, run, and publish operations.
