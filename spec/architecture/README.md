# Architecture Documentation

**How to read and use these specifications.**

## Purpose

These documents describe the **internal design** of the Tsonic compiler. They're for contributors who need to understand how the compiler works, not for users who just want to compile TypeScript.

## Organization

Architecture docs are organized by **compilation phase**:

### Foundation Documents

| File                    | Lines  | Description                                                       |
| ----------------------- | ------ | ----------------------------------------------------------------- |
| **00-overview.md**      | ~1,150 | Complete system architecture, design principles, 8-phase pipeline |
| **01-pipeline-flow.md** | ~790   | Phase connections, data flow, error propagation                   |

### Compilation Phases (02-08)

| File                       | Lines  | Description                                                             |
| -------------------------- | ------ | ----------------------------------------------------------------------- |
| **02-phase-program.md**    | ~642   | TypeScript program creation, metadata/binding registry loading          |
| **03-phase-resolver.md**   | ~775   | Module resolution (local/.NET/binding), namespace generation            |
| **04-phase-validation.md** | ~630   | ESM rules, unsupported feature detection, error codes (TSN1xxx-TSN3xxx) |
| **05-phase-ir.md**         | ~1,275 | TypeScript AST → IR transformation, type inference, binding resolution  |
| **06-phase-analysis.md**   | ~980   | Dependency analysis, circular detection, symbol tables                  |
| **07-phase-emitter.md**    | ~1,039 | IR → C# code generation, specialization (monomorphization)              |
| **08-phase-backend.md**    | ~250   | .csproj generation, dotnet publish, NativeAOT compilation               |

### Runtime Packages (09a-09b)

| File                         | Lines | Description                                                   |
| ---------------------------- | ----- | ------------------------------------------------------------- |
| **09a-tsonic-runtime.md**    | ~400  | Tsonic.Runtime package: Union types, structural typing (always required) |
| **09b-tsonic-jsruntime.md**  | ~400  | Tsonic.JSRuntime package: JS semantics via extension methods (mode: "js" only) |

### Supporting Systems (10-13)

| File                        | Lines | Description                                                                    |
| --------------------------- | ----- | ------------------------------------------------------------------------------ |
| **10-cli-orchestration.md** | ~806  | CLI commands, configuration management, watch mode                             |
| **11-diagnostics-flow.md**  | ~757  | Error reporting, diagnostic codes (TSN1xxx-TSN6xxx), user-facing messages      |
| **12-call-graphs.md**       | ~801  | Function call graph construction, specialization tracking, dead code detection |
| **13-renaming.md**          | ~652  | TypeScript → C# identifier transformation, reserved keyword handling           |

**Total Documentation:** ~11,000 lines across 15 comprehensive architecture documents

Each phase doc follows the same structure:

- **Purpose** - High-level overview
- **Responsibility** - What this phase does
- **Input/Output** - Data contracts with full type definitions
- **Location** - Package and file paths
- **Implementation** - Key algorithms and data structures with code examples
- **Performance** - Complexity analysis and timing benchmarks
- **See Also** - Cross-references to related documents

## Reading Order

### For New Contributors

**Essential Reading (2-3 hours):**

1. **00-overview.md** - Understand the big picture (30 min)
2. **01-pipeline-flow.md** - See how phases connect (20 min)
3. **11-diagnostics-flow.md** - Error handling system (20 min)
4. **13-renaming.md** - Name transformations (15 min)
5. Your target phase - e.g., **07-phase-emitter.md** for C# generation (30-60 min)

**Optional Deep Dives:**

- **05-phase-ir.md** - IR data structures (critical for understanding the compiler)
- **09a-tsonic-runtime.md** - TypeScript language primitives
- **09b-tsonic-jsruntime.md** - JavaScript semantics preservation
- **12-call-graphs.md** - Advanced analysis techniques

### For Specific Tasks

| Task                            | Start Here              | Then Read                                               |
| ------------------------------- | ----------------------- | ------------------------------------------------------- |
| **Adding TypeScript feature**   | 02-phase-program.md     | 05-phase-ir.md, 07-phase-emitter.md                     |
| **Fixing module resolution**    | 03-phase-resolver.md    | 04-phase-validation.md                                  |
| **Adding .NET binding**         | 02-phase-program.md     | 05-phase-ir.md (binding resolution)                     |
| **Improving error messages**    | 11-diagnostics-flow.md  | 10-cli-orchestration.md (printing)                      |
| **Optimizing code generation**  | 07-phase-emitter.md     | 12-call-graphs.md (dead code)                           |
| **Adding CLI command**          | 10-cli-orchestration.md | 01-pipeline-flow.md                                     |
| **Understanding generic types** | 05-phase-ir.md          | 07-phase-emitter.md (specialization), 12-call-graphs.md |
| **Understanding union types**   | 09a-tsonic-runtime.md   | 05-phase-ir.md, 07-phase-emitter.md                     |
| **Debugging JS runtime behavior** | 09b-tsonic-jsruntime.md | 07-phase-emitter.md (how it's used)                   |

### For Architecture Changes

**System-Wide Impact Assessment:**

1. Read all phase docs in order (02→13)
2. Review **01-pipeline-flow.md** to understand data contracts
3. Check **12-call-graphs.md** for function dependencies
4. Review **11-diagnostics-flow.md** for error handling changes

**Estimated Time:** 8-10 hours for complete understanding

## Documentation Style

These docs follow the **tsbindgen spec/architecture/** style:

- **Exhaustive technical detail** - Not tutorials
- **Actual code locations** - File paths and line numbers where helpful
- **Data structure diagrams** - Show types and relationships
- **Call graphs** - Show function call chains
- **Design decisions** - Explain why, not just what

## Phase Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│ CLI Orchestration (10)                                      │
│ - Commands: build, emit, init, watch, clean                │
│ - Configuration management (tsonic.json)                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Program Creation (02)                             │
│ - TypeScript Compiler API (ts.Program)                     │
│ - Metadata registry loading (.metadata.json)               │
│ - Binding registry loading (.bindings.json)                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Module Resolution (03)                            │
│ - Import resolution (local/.NET/binding)                   │
│ - Module graph building                                    │
│ - Namespace generation from directory structure            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Validation (04)                                   │
│ - ESM rules (TSN1xxx: missing .ts extension, etc.)        │
│ - Type system validation (TSN2xxx: name collision, etc.)  │
│ - Feature detection (TSN3xxx: unsupported features)       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: IR Building (05)                                  │
│ - TypeScript AST → IR transformation                       │
│ - Type inference and conversion                            │
│ - Binding resolution (global + hierarchical)               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Dependency Analysis (06)                          │
│ - Dependency graph construction                            │
│ - Circular dependency detection                            │
│ - Symbol table building                                    │
│ - Topological sort for compilation order                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 6: C# Emission (07)                 ┌────────────────┐│
│ - IR → C# code generation                 │ Call Graphs    ││
│ - Specialization (monomorphization)       │ (12)           ││
│ - Adapter generation for structural types │ - Tracking     ││
│ - Static helper method calls              │ - Dead code    ││
└────────────────────────────────────────────┴────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 7: Backend Compilation (08)         ┌────────────────┐│
│ - .csproj file generation                 │ Runtime Pkgs   ││
│ - dotnet restore (NuGet packages)         │ (09a, 09b)     ││
│ - dotnet publish with NativeAOT           │ ┌──────────────┤│
│                                            │ │Tsonic.Runtime││
│ Mode: "dotnet" (default)                  │ │- Union<>     ││
│   → Tsonic.Runtime only                   │ │- Structural  ││
│                                            │ │- typeof      ││
│ Mode: "js"                                 │ └──────────────┤│
│   → Tsonic.Runtime + Tsonic.JSRuntime     │ │JSRuntime (js)││
│                                            │ │- Array ext   ││
│                                            │ │- String ext  ││
│                                            │ │- Math/console││
└────────────────────────────────────────────┴────────────────┘
                           │
                           ↓
                  NativeAOT Binary
                   (3-40 MB, <10ms startup)

┌─────────────────────────────────────────────────────────────┐
│ Cross-Cutting Concerns                                      │
├─────────────────────────────────────────────────────────────┤
│ Diagnostics (11) - Error reporting through all phases      │
│ - TSN1xxx: Import/module errors                            │
│ - TSN2xxx: Type system errors                              │
│ - TSN3xxx: Feature/export errors                           │
│ - TSN4xxx: IR building errors                              │
│ - TSN5xxx: Emission errors                                 │
│ - TSN6xxx: Backend/NativeAOT errors                        │
├─────────────────────────────────────────────────────────────┤
│ Renaming (13) - TypeScript → C# identifier transformation  │
│ - camelCase → PascalCase for functions                     │
│ - File name → Class name transformation                    │
│ - Reserved keyword handling (@class, @object, etc.)        │
│ - Specialization name generation (map__double_string)      │
└─────────────────────────────────────────────────────────────┘
```

## Contract Files

Before reading phase docs, understand the contracts:

- **spec/bindings.md** - Name transformation tracking
- **spec/metadata.md** - CLR metadata schema
- **spec/dependency-graph.md** - Module dependency format
- **spec/validation.md** - Validation rules

## Code Cross-References

Architecture docs reference actual implementation:

- `packages/frontend/src/program/creation.ts:42` - Specific line
- `packages/emitter/src/core/module-emitter/` - Directory
- `IrModule` - Type/interface name

Use your editor's "go to definition" to jump from docs to code.

## Updating These Docs

When changing the compiler:

1. Update the relevant phase doc
2. Update call graphs if function signatures change
3. Update pipeline-flow if data contracts change
4. Keep docs and code in sync

## See Also

- [User Documentation](../../docs/index.md) - For Tsonic users
- [Implementation Plan](../appendices/implementation-plan.md) - Development roadmap
- [CLAUDE.md](../../CLAUDE.md) - Coding guidelines
