# Troubleshooting

Start with the first diagnostic owner and code. Tsonic does not hide an error
by emitting partial target code.

## Target not found

```text
Target 'rust' is not installed
```

Install the target in the package containing `tsonic.json`:

```sh
npm install --save-dev @tsonic/target-rust
```

Tsonic discovers plugins from installed direct `dependencies`,
`devDependencies`, and `optionalDependencies`. A target id in `tsonic.json`
does not install the package.

Check discovery:

```sh
npx tsonic targets --project tsonic.json
```

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

Run one command without `--locked`, or create the lockfile explicitly:

```sh
cargo generate-lockfile --manifest-path out/rust/Cargo.toml
cargo build --manifest-path out/rust/Cargo.toml --locked
```

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
