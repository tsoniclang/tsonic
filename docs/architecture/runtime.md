# Runtime

Runtime support is split into two layers.

## Core Runtime

- `Tsonic.Runtime`

Provides:

- iterator/generator runtime helpers
- shared compiler support types
- other core emitted-runtime dependencies

This is the only runtime DLL that the CLI/test harness syncs locally under `packages/cli/runtime`.

## Surface Runtime Overlays

Ambient/module surfaces such as `@tsonic/js` and `@tsonic/nodejs` are source packages.

They contribute runtime requirements through package metadata:

- `tsonic.package.json`
- `runtime`
- `dotnet`

That metadata can add:

- NuGet package references
- framework references
- transitive runtime package requirements

Those requirements are resolved through normal package/restore flow. They are not copied into the CLI runtime directory as ad hoc surface DLLs.

## Surface Projection

Runtime implementation and surface projection must remain coherent:

- core emitted runtime support lives in `Tsonic.Runtime`
- source package manifests describe surface/runtime overlays
- bindings manifests remain only for CLR / tsbindgen interop packages
