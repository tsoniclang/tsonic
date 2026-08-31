# Tsonic limitations

These limits apply before target-specific limits.

## Static source closure

Tsonic compiles operations that can be selected and represented statically.
It does not add a JavaScript engine or a general dynamic-object runtime.

Unsupported examples include:

```ts
eval(sourceText);
value[unknownRuntimeName]();
```

Use explicit functions, finite tagged unions, typed records, or provider APIs
whose members are known during compilation.

## No hidden compiler configuration

Tsonic does not consume `tsconfig.json`, path mappings, ambient bootstrap
modules, or declaration files as a fallback for missing target semantics.
Use ESM package exports, source packages, selected surfaces, and installed
capability packages.

## Exact target support

Valid TypeScript is not automatically valid for every native target. The
source checker may accept an operation that a target cannot represent without
changing its meaning. The target then rejects it with a diagnostic.

For example, changing the runtime fields of an open object is legal in
JavaScript but cannot mutate the static layout of an existing Rust struct.

## Module initialization

Imports, re-exports, and side effects preserve ESM ordering only when the
target has a closed initialization plan. Runtime module cycles that require
JavaScript live-binding or temporal-dead-zone behavior may be rejected.

Break a runtime cycle by moving shared types or constants into a leaf module,
or by passing dependencies explicitly.

## Native metadata boundaries

.NET and Rust providers expose only metadata they can represent as legal
TypeScript declarations and exact target operations. Unsupported metadata is a
provider diagnostic, not permission to omit a parameter, widen a type, or use
runtime reflection.

## Native compiler authority

Tsonic checks its source and target contracts. `dotnet` and `rustc` remain the
final authority for native project configuration, platform availability,
linking, C# language rules, Rust borrow checking, and third-party native code.

Continue with [C# limitations](targets/csharp/limitations.md) or
[Rust limitations](targets/rust/limitations.md).
