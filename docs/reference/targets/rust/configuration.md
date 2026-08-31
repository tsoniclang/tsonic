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

## Generated and user-owned projects

| Option | Generated project | User-owned project |
| --- | --- | --- |
| `crateName` | Cargo package/crate name | emitted Rust crate identity where applicable |
| `edition` | emitted in `Cargo.toml` and used by generated Rust | used by generated Rust; the manifest must agree |
| `foundation` | selects crate root and runtime features | selects legal source semantics; the manifest must supply matching features |
| `outputType` | creates `src/lib.rs` or `src/main.rs` | controls emitted library/binary contract; native startup still belongs to Cargo |
| `projectFile` | absent | selects the existing `Cargo.toml` |

Rust has no free-form target `properties` object. Target triples, profiles,
features, linkers, build scripts, workspace layout, and packaging are Cargo
configuration and belong in a user-owned project.

## `projectFile`

The resolved file must:

- exist and be a regular file named `Cargo.toml`;
- remain outside the generated Rust output root;
- describe the direct dependencies used by `@tsonic/rust/crates/*` imports.

In user-owned mode Tsonic emits sources only. It never reads Cargo project
settings as hidden semantic evidence and never mutates the manifest.

Direct Cargo dependency aliases are semantic input for imports such as:

```ts
import { Widget } from "@tsonic/rust/crates/widget_alias/index.js";
```

The configured manifest must declare `widget_alias` directly. Transitive
dependencies and package-name guessing are not searched.

## Complete generated example

```json
{
  "id": "rust",
  "surfaces": ["js"],
  "options": {
    "crateName": "acme_tool",
    "edition": "2024",
    "foundation": "std",
    "outputType": "bin"
  }
}
```
