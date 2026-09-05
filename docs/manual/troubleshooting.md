# Troubleshooting

Start with the first diagnostic owner and code. Tsonic does not hide an error
by emitting partial target code.

## A required command is missing

`create-tsonic` checks the selected target before publishing the project. Its
diagnostic names the failed command and links to the official installer. If a
toolchain was changed after creation, run the same checks manually.

Check the host tools first:

```sh
node --version
npm --version
```

For C#, `dotnet --list-sdks` must include a `10.0.x` SDK. Installing only a
.NET runtime is insufficient. Use the
[official .NET installer](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)
or Microsoft's [platform instructions](https://learn.microsoft.com/en-us/dotnet/core/install/).

For Rust, the required commands must resolve from one rustup toolchain:

```sh
rustup show active-toolchain
rustc --version
cargo --version
rustdoc --version
rustfmt --version
```

Use the [official rustup installer](https://www.rust-lang.org/tools/install),
then run `rustup component add rustfmt`. Tsonic does not substitute a different
formatter, compiler, or metadata producer when one is missing. If an optional
`cargo clippy` command is unavailable, run `rustup component add clippy`.

## Target not found

```text
Target 'rust' is not installed
```

Install the target in the package containing `tsonic.json`:

```sh
npm install --save-dev @tsonic/target-rust@^0.1.0
```

Tsonic discovers plugins from installed direct `dependencies`,
`devDependencies`, and `optionalDependencies`. A target id in `tsonic.json`
does not install the package.

Check discovery:

```sh
npx --no-install tsonic targets --project tsonic.json
```

For a new project, prefer `npm create tsonic@latest <directory> -- --target
rust`; the creator installs and validates the target as one transaction.

## Cache directory is not writable

Targets never write inside installed packages. Their compiler-tool state goes
under `.tsonic/cache` beside `tsonic.json` by default. Select another writable
path when needed:

```json
{
  "cacheDir": "../cache/example-tsonic"
}
```

`cacheDir` cannot be equal to, inside, or contain `outDir`.

## A global or built-in is missing

If `console`, `Map`, or JavaScript string methods are missing, select the JS
surface:

```json
{ "id": "csharp", "surfaces": ["js"] }
```

If a `node:*` import is missing, install the target's Node capability package.
Installing Node does not select the JS surface.

## A C# executable does nothing

C# applications run top-level entry-module code. This only declares a
function:

```ts
export function main(): void {
  // Not called automatically by the C# target.
}
```

Call it, or put startup work at top level:

```ts
main();
```

## A Rust binary has no entrypoint

The entry module must contain:

```ts
export function main(): void {}
```

The function must be exported and return `void`.

## Cargo rejects `--locked`

Generate source, then run one command without `--locked`, or create the
lockfile explicitly:

```sh
cargo generate-lockfile --manifest-path out/rust/Cargo.toml
cargo build --manifest-path out/rust/Cargo.toml --locked
```

The lockfile is inside compiler-owned `outDir`; the next successful
`tsonic build` replaces it. Use a user-owned Cargo project when the lockfile
must be retained in version control.

## A .NET type imports but does not link

Provider inputs and build references are separate. `providerReferences` makes
an assembly available to metadata reflection. Add the corresponding project,
package, framework, or assembly under `references` so the generated project can
compile and link it.

## A Rust crate import is missing

Third-party Rust imports use a direct dependency alias from a user-owned
`Cargo.toml`:

```toml
[dependencies]
widget_alias = { package = "acme-widget", version = "1.2.3" }
```

```ts
import { Widget } from "@tsonic/rust/crates/widget_alias/index.js";
```

The alias must be a direct dependency. Tsonic does not search transitive crates
or infer a package from an import spelling.

## A `tsconfig` option is rejected

Move module aliases to real package exports. Tsonic intentionally rejects
`compilerOptions`, `paths`, `baseUrl`, `extends`, and TypeScript project
references.

## The previous output is still present

That is intentional after a failed build. Tsonic publishes output
transactionally. A failed build does not replace the last complete output.

## Native compilation fails

Read the native compiler output first. Tsonic owns generated source validity;
the native compiler remains authoritative for SDK installation, target packs,
linkers, system libraries, Cargo dependencies, borrow checking, and native
project configuration.

See [diagnostics](../reference/diagnostics.md) and the target's
[C# limitations](../reference/targets/csharp/limitations.md) or
[Rust limitations](../reference/targets/rust/limitations.md).
