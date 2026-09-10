# Target manuals

Target packs consume one checked TypeScript program and emit one target-native
project. They share the same host contract but own different native semantics.

| Responsibility | C# | Rust | Mojo |
| --- | --- | --- | --- |
| Target id | `csharp` | `rust` | `mojo` |
| Native declaration provider | .NET metadata/reflection | compiler-backed rustdoc/Cargo | compiler-backed Mojo packages |
| Native virtual modules | `@tsonic/dotnet/*` | `@tsonic/rust/core/*`, `alloc/*`, `std/*`, `crates/*` | `@tsonic/mojo/std/*`, `packages/*` |
| Generated project | `.csproj` | `Cargo.toml` | `pixi.toml` |
| User project | existing `.csproj` | existing `Cargo.toml` | existing `pixi.toml` |
| Base runtime | `@tsonic/csharp-runtime` | `@tsonic/rust-runtime` | `@tsonic/mojo-runtime` |
| JS runtime | `@tsonic/csharp-js` | `@tsonic/rust-js` | `@tsonic/mojo-js` |
| Node capability | `@tsonic/csharp-nodejs` | `@tsonic/rust-nodejs` | `@tsonic/mojo-nodejs` |

The target manuals answer the same high-level questions:

1. How is the target selected and configured?
2. Which source profile is active?
3. How are native APIs imported?
4. How are source types and operations represented?
5. Which interop and safety contracts are explicit?
6. Who owns the native project and toolchain?
7. How are provider packages authored?
8. Which source capabilities are supported or precisely rejected?

Mojo follows the same host lifecycle with Mojo native semantics and Pixi
projects. Its source-workspace installation and current native boundaries are
documented separately; the C#/Rust release path does not imply Mojo publication.

Continue with [C#](csharp/README.md), [Rust](rust/README.md) or [Mojo](mojo/README.md).
