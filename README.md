# Tsonic

Tsonic is being rebuilt as a source-to-source compiler from TypeScript to target-native source projects.

The active architecture is:

- TSTS owns TypeScript parsing, binding, checking, flow, narrowing, contextual typing, generic inference, overload resolution, and extension facts.
- Tsonic owns project orchestration, target selection, source generation, artifact layout, and target toolchain handoff.
- Target packs own provider semantics, target AST planning, target source printing, runtime references, and target-native project/toolchain integration.

NativeAOT is a supported C# target outcome through normal .NET project configuration. It is not the generic compiler architecture.
