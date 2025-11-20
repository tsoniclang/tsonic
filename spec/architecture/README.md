# Architecture Documentation

**How to read and use these specifications.**

## Purpose

These documents describe the **internal design** of the Tsonic compiler. They're for contributors who need to understand how the compiler works, not for users who just want to compile TypeScript.

## Organization

Architecture docs are organized by **compilation phase**:

- **00-overview.md** - Overall compiler design and principles
- **01-pipeline-flow.md** - How phases connect and data flows
- **02-13** - Individual phase details in execution order

Each phase doc follows the same structure:
- **Responsibility** - What this phase does
- **Input/Output** - Data contracts
- **Location** - Package and file paths
- **Implementation** - Key algorithms and data structures
- **Dependencies** - What this phase depends on
- **Testing** - How to test this phase

## Reading Order

### For New Contributors

1. Start with **00-overview.md** - Understand the big picture
2. Read **01-pipeline-flow.md** - See how phases connect
3. Jump to the phase you're working on - e.g., **07-phase-emitter.md** for C# generation

### For Specific Tasks

- **Adding a new feature?** Find which phase handles it, read that phase doc
- **Fixing a bug?** Trace the bug through phases using call graphs (**12-call-graphs.md**)
- **Understanding error messages?** See **11-diagnostics-flow.md**

### For Architecture Changes

Read all phase docs in order to understand system-wide impacts.

## Documentation Style

These docs follow the **tsbindgen spec/architecture/** style:

- **Exhaustive technical detail** - Not tutorials
- **Actual code locations** - File paths and line numbers where helpful
- **Data structure diagrams** - Show types and relationships
- **Call graphs** - Show function call chains
- **Design decisions** - Explain why, not just what

## Phase Dependencies

```
Program (02)
    ↓
Resolver (03) → Validation (04)
    ↓              ↓
    IR Builder (05)
    ↓
    Analysis (06)
    ↓
    Emitter (07)
    ↓
    Backend (08) ← Runtime (09)
    ↓
    NativeAOT Binary
```

CLI (10) orchestrates all phases.
Diagnostics (11) flows through all phases.

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
