# Runtime

Runtime support is split across focused assemblies/packages.

## Core Runtime

- `Tsonic.Runtime`

Provides:

- iterator/generator runtime helpers
- shared compiler support types
- other core emitted-runtime dependencies

## JS Runtime

- `Tsonic.JSRuntime`

Provides implementation for the JS surface:

- `console`
- `JSON`
- `Date`
- timers
- `Array`/`String`/`Map`/`Set` helper operations

## Node Runtime

- `Tsonic.Nodejs` / `nodejs.dll`

Provides module/runtime support for `node:*` bindings.

## Surface Projection

Runtime implementation and surface projection must remain coherent:

- runtime code lives in runtime repos
- surface package manifests/projection configs describe the ambient/module shape
- published packages must include the nested bindings/internal declaration trees that member binding lookup needs
