# Runtime

Runtime support is split into two layers.

## Core Runtime

- `Tsonic.Runtime`

Provides:

- iterator/generator runtime helpers
- shared compiler support types
- other core emitted-runtime dependencies

This is the only runtime DLL that the CLI/test harness syncs locally under `packages/cli/runtime`.

For compiler development, this repo intentionally depends on a sibling runtime
checkout:

```text
~/repos/tsoniclang/
  runtime/
  tsonic/
```

The sync path is:

```text
../runtime/artifacts/bin/Tsonic.Runtime/Release/net10.0/Tsonic.Runtime.dll
```

That dependency is explicit and source-controlled in scripts. It is acceptable
because the runtime is a separate first-party repo in the same development
wave. It should not be replaced by an implicit global lookup or a best-effort
fallback.

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

Runtime-union support also belongs to this boundary. The emitter may preserve a
runtime union carrier or project it only when the expected target proves that a
projection is required. Lowering a source value to `object` just to make an
assignment compile is not a valid runtime strategy.

## NativeAOT boundary

Generated code and product runtime support must remain valid under NativeAOT.
Language semantics must not depend on runtime reflection, arbitrary member
discovery, dynamic invocation, dynamic JSON object traversal, or runtime shape
inspection.

Dynamic operations that TypeScript can typecheck are not automatically valid
Tsonic operations. The compiler must either prove the shape statically and emit
closed code, or reject the construct with a diagnostic.
