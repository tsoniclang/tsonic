# Rust target configuration

All fields belong under the selected target's `options` object. Unknown fields
are rejected.

| Option | Type | Default | Contract |
| --- | --- | --- | --- |
| `crateName` | nonempty string matching `[a-z][a-z0-9_]*` | `tsonic_generated` | Generated Cargo package and crate name |
| `edition` | `2021` or `2024` | `2021` | Rust edition used by the generated project |
| `foundation` | `core`, `alloc`, or `std` | `std` | Maximum Rust language/runtime foundation |
| `outputType` | `lib` or `bin` | `lib` | Generated Cargo target kind |
| `projectFile` | nonempty string | none | Existing user-owned `Cargo.toml` |

`outputType: "bin"` requires `foundation: "std"`. `core` and `alloc`
executables require startup, panic, allocator, linker, and platform policies
that belong to a user-owned native project.

## `projectFile`

The resolved file must:

- exist and be a regular file named `Cargo.toml`;
- remain outside the generated Rust output root;
- describe the direct dependencies used by `@tsonic/rust/crates/*` imports.

In user-owned mode Tsonic emits sources only. It never reads Cargo project
settings as hidden semantic evidence and never mutates the manifest.
