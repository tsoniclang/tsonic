# Backend

The backend owns generated project layout and .NET toolchain execution.

## Responsibilities

- write `Program.cs`
- write `tsonic.csproj`
- place emitted `.cs` files
- lay out package-shaped generated source trees where needed
- invoke `dotnet build`, `publish`, `test`, and `pack`
- manage NativeAOT vs managed output differences

## Output modes

- executable
- managed library
- NativeAOT shared library
- NativeAOT static library

## Important inputs

- compiler-emitted C#
- workspace DLL and NuGet references
- framework references
- runtime overlays from source-package metadata
- local package ownership mode (`source` vs `dll`)

## Package-shaped generated source

When local or installed source packages are emitted into the closure, the
backend preserves package hierarchy rather than flattening everything into one
directory.

That is why generated output often includes paths like:

```text
generated/node_modules/@tsonic/nodejs/...
generated/node_modules/@acme/domain/...
```

That is intentional. It preserves module ownership and avoids collisions.

## Local DLL boundaries

When a local package reference uses `mode: "dll"`, the backend:

- builds the referenced project first
- references its assembly boundary
- avoids generating that package’s source again into the same closure
