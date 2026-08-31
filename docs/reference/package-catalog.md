# Package catalog

## Host packages

| Package | Responsibility |
| --- | --- |
| `@tsonic/cli` | `tsonic` command-line entry point |
| `@tsonic/host` | Project orchestration and plugin composition |
| `@tsonic/target-api` | Public target, provider, artifact, and source-navigation contracts |
| `@tsonic/source-core` | Neutral source semantics and facts |
| `@tsonic/js-source-profile` | Target-neutral JavaScript declaration profile |
| `@tsonic/tsts` | Pinned checked-source compiler package consumed by Tsonic |

## C# packages

| Package | Responsibility |
| --- | --- |
| `@tsonic/target-csharp` | C# analysis, planning, printing, project generation, .NET provider |
| `@tsonic/csharp-runtime` | Always-available C# runtime substrate |
| `@tsonic/csharp-js` | C# JavaScript-surface runtime |
| `@tsonic/csharp-nodejs` | C# Node capability and runtime |

## Rust packages

| Package | Responsibility |
| --- | --- |
| `@tsonic/target-rust` | Rust analysis, planning, printing, Cargo and compiler providers |
| `@tsonic/rust-runtime` | `core`/`alloc`/`std` Rust runtime substrate |
| `@tsonic/rust-js` | Rust JavaScript-surface runtime |
| `@tsonic/rust-nodejs` | Rust Node capability and runtime |

Compiler-owned virtual modules such as `@tsonic/core/types.js`,
`@tsonic/dotnet/System.js`, and `@tsonic/rust/std/collections.js` are source
declarations. They are not installed npm packages.
