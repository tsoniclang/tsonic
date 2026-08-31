# Target manuals

Target packs consume one checked TypeScript program and emit one target-native
project. They share the same host contract but own different native semantics.

| Responsibility | C# | Rust |
| --- | --- | --- |
| Target id | `csharp` | `rust` |
| Native declaration provider | .NET metadata/reflection | compiler-backed rustdoc/Cargo |
| Native virtual modules | `@tsonic/dotnet/*` | `@tsonic/rust/core/*`, `alloc/*`, `std/*`, `crates/*` |
| Generated project | `.csproj` | `Cargo.toml` |
| User project | existing `.csproj` | existing `Cargo.toml` |
| Base runtime | `@tsonic/csharp-runtime` | `@tsonic/rust-runtime` |
| JS runtime | `@tsonic/csharp-js` | `@tsonic/rust-js` |
| Node capability | `@tsonic/csharp-nodejs` | `@tsonic/rust-nodejs` |

Both targets document the same high-level questions:

1. How is the target selected and configured?
2. Which source profile is active?
3. How are native APIs imported?
4. How are source types and operations represented?
5. Which interop and safety contracts are explicit?
6. Who owns the native project and toolchain?
7. How are provider packages authored?
8. Which source capabilities are supported or precisely rejected?

Continue with [C#](csharp/README.md) or [Rust](rust/README.md).
