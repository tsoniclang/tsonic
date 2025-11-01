# Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for Tsonic, breaking down the work into milestones with clear deliverables and dependencies.

## Development Phases

### Phase 0: Project Setup

**Goal:** Establish monorepo structure and basic tooling

**Tasks:**

1. Initialize monorepo with npm workspaces
2. Create package directories: cli, frontend, emitter, backend, runtime
3. Setup TypeScript configuration with base config
4. Configure ESLint and Prettier
5. Create shell scripts for build orchestration
6. Create basic package.json for each package
7. Setup test framework (Mocha/Chai)

**Deliverables:**

- Working monorepo structure with npm workspaces
- Shell scripts: `build.sh`, `clean.sh`, `install-deps.sh`, `format-all.sh`, `lint-all.sh`
- `npm install` and `./scripts/build.sh` work
- Basic CI workflow (GitHub Actions)

### Phase 1: TypeScript Frontend

**Goal:** Parse TypeScript and validate ESM rules

**Package:** `packages/frontend`

**Tasks:**

1. Create TypeScript program factory
2. Implement ESM import validator (require .ts extensions)
3. Build module resolver with exact case matching
4. Create symbol table for cross-module references
5. Implement diagnostics collector
6. Build module dependency graph

**Key Files:**

- `program.ts` - TypeScript program creation
- `resolver.ts` - Module resolution with extensions
- `validator.ts` - ESM rule enforcement
- `diagnostics.ts` - Error collection

**Tests:**

- Module resolution with extensions
- Case sensitivity validation
- Circular dependency detection
- Error message formatting

**Deliverables:**

- Can parse TypeScript files
- Validates all imports have .ts extensions
- Detects and reports ESM violations

### Phase 2: IR Builder

**Goal:** Convert TypeScript AST to IR

**Package:** `packages/frontend`

**Tasks:**

1. Define IR types (IrModule, IrClass, IrFunction, etc.)
2. Implement AST traversal
3. Build namespace inference from directory structure
4. Handle file-name-to-class mapping
5. Process imports (local vs .NET detection)
6. Extract top-level code vs exports

**Key Files:**

- `ir/types.ts` - IR type definitions
- `irBuilder.ts` - AST to IR conversion
- `namespaceResolver.ts` - Directory to namespace mapping

**Tests:**

- Namespace generation from paths
- Class vs static container logic
- Import classification (local vs .NET)
- Top-level code extraction

**Deliverables:**

- Complete IR for simple TypeScript programs
- Proper namespace assignment
- Import resolution

### Phase 3: Basic C# Emitter

**Goal:** Generate C# from IR for basic constructs

**Package:** `packages/emitter`

**Tasks:**

1. Implement C# file structure generation
2. Generate using statements
3. Emit namespace blocks
4. Generate classes (regular and static container)
5. Emit methods and properties
6. Handle basic expressions and statements

**Key Files:**

- `emitCs.ts` - Main emission pipeline
- `csTemplates.ts` - C# code templates
- `typeMap.ts` - Type conversion rules

**Supported Features:**

- Classes and static classes
- Methods and properties
- Basic types (string, number, boolean)
- Basic statements (if, for, while, return)
- String templates to string interpolation

**Tests:**

- Golden tests (TS input → expected C# output)
- Namespace and class generation
- Method signature conversion

**Deliverables:**

- Can emit compilable C# for simple programs
- Proper namespace and using statements

### Phase 4: Tsonic Runtime Core

**Goal:** Implement JavaScript runtime in C#

**Package:** `packages/runtime`

**Tasks:**

1. Implement `Array<T>` with sparse array support
2. Implement `String` wrapper with JS methods
3. Implement `Number` wrapper with JS methods
4. Implement `console` object
5. Implement `Math` object
6. Implement `Date` class
7. Implement global functions (parseInt, parseFloat)
8. Implement `JSON` object

**Key File:**

- `TsonicRuntime.cs` - All runtime implementations

**Note:** Generator helpers (for ergonomic `Next(value)` API) will be added in Phase 7 when generator support is implemented.

**Tests:**

- Array sparse behavior
- String method compatibility
- Number method compatibility
- Math function accuracy
- Date conversions

**Deliverables:**

- Complete runtime for basic JavaScript operations
- NuGet package or embedded .cs file

### Phase 5: .NET Backend

**Goal:** Integrate with dotnet CLI for NativeAOT

**Package:** `packages/backend`

**Tasks:**

1. Generate .csproj file
2. Create temporary build directories
3. Copy generated C# files
4. Copy runtime file
5. Generate Program.cs when needed
6. Execute `dotnet publish` with NativeAOT
7. Copy output binary

**Key Files:**

- `dotnet.ts` - dotnet CLI wrapper
- `projectGenerator.ts` - .csproj generation
- `buildOrchestrator.ts` - Build pipeline

**Tests:**

- Project file generation
- Build directory management
- Error handling from dotnet

**Deliverables:**

- Can produce NativeAOT executables
- Proper error reporting from build failures

### Phase 6: CLI Implementation

**Goal:** Create usable CLI interface

**Package:** `packages/cli`

**Tasks:**

1. Setup command routing (emit, build, run)
2. Implement option parsing
3. Add configuration file support
4. Implement diagnostic formatting
5. Add progress indicators
6. Handle exit codes properly

**Key Files:**

- `index.ts` - CLI entry point
- `commands/emit.ts` - Emit command
- `commands/build.ts` - Build command
- `commands/run.ts` - Run command

**Tests:**

- Command parsing
- Configuration loading
- Error formatting

**Deliverables:**

- Working `tsonic` CLI
- All three commands functional

### Phase 7: Advanced Types and Language Features

**Goal:** Support more TypeScript features

**Tasks:**

1. Arrays with proper `Tsonic.Runtime.Array<T>`
2. Async/await to Task conversion
3. Interfaces to C# classes
4. Enums support
5. Generic functions and classes
6. Union types (basic two-type unions)
7. Type assertions and guards
8. **Generators (function\*)** using Exchange Object pattern:
   - Generate Exchange class per generator function
   - Transform `yield value` to `exchange.Output = value; yield return exchange;`
   - Transform `const x = yield y` to read `exchange.Input` after yield
   - Support `IEnumerable<Exchange>` for sync generators
   - Support `IAsyncEnumerable<Exchange>` for async generators
   - Add runtime helper for ergonomic `Next(value)` API

**Tests:**

- Array method mappings
- Async method generation
- Generic preservation
- Generator bidirectional communication
- Async generator coordination

**Deliverables:**

- Support for modern TypeScript patterns
- Async/await working end-to-end
- Generators with exchange object pattern working

### Phase 8: .NET Interop

**Goal:** Enable .NET library usage

**Tasks:**

1. Create basic lib.cs.d.ts declarations
2. Implement .NET namespace detection
3. Generate proper using statements
4. Handle Task to Promise mapping
5. Support common BCL types

**Key Files:**

- `runtime/lib.cs.d.ts` - .NET type declarations

**Tests:**

- .NET import resolution
- Using statement generation
- File I/O examples
- HTTP client examples

**Deliverables:**

- Can import and use .NET libraries
- System.IO working
- System.Text.Json working

### Phase 9: Testing & Examples

**Goal:** Comprehensive test coverage and examples

**Tasks:**

1. Create test fixtures for each feature
2. Build golden test suite
3. Create example projects:
   - Hello World
   - File processor
   - HTTP API client
   - JSON manipulation
4. End-to-end tests
5. Performance benchmarks

**Deliverables:**

- 80%+ code coverage
- All examples compile and run
- Documentation for each example

### Phase 10: Polish & Documentation

**Goal:** Production readiness

**Tasks:**

1. Improve error messages
2. Add helpful hints to diagnostics
3. Create README.md
4. Write contributing guide
5. Setup release process
6. Create website/documentation

**Deliverables:**

- Professional documentation
- NPM package ready for publishing
- GitHub releases configured

## Implementation Order

| Priority | Milestone            | Key Achievement                   |
| -------- | -------------------- | --------------------------------- |
| 1        | Setup + Frontend     | Can parse and validate TypeScript |
| 2        | IR + Basic Emitter   | Can generate simple C#            |
| 3        | Runtime + Backend    | Can build NativeAOT executables   |
| 4        | CLI + Advanced Types | Usable for real programs          |
| 5        | Interop + Testing    | .NET integration working          |
| 6        | Polish + Release     | Production ready                  |

## Critical Path

```
Setup → Frontend → IR → Emitter → Runtime
                               ↓
                    Backend ← CLI
                        ↓
                 Advanced Types
                        ↓
                 .NET Interop
                        ↓
                Testing & Polish
```

## Risk Mitigation

### Technical Risks

1. **NativeAOT Limitations**
   - Mitigation: Test early, document limitations
   - Fallback: Support regular publish first

2. **Complex Type Mappings**
   - Mitigation: Start with simple types
   - Fallback: Error clearly on unsupported types

3. **Runtime Semantics Differences**
   - Mitigation: Extensive testing
   - Fallback: Document differences

### Implementation Risks

1. **TypeScript Complexity**
   - Mitigation: Focus on ESM subset
   - Fallback: Support basic features first

2. **C# Generation Edge Cases**
   - Mitigation: Golden tests early
   - Fallback: Iterate on emitter

## Success Criteria

### MVP

- Can compile hello world
- Produces working executable
- Basic types supported

### Beta

- Real programs work
- .NET interop functional
- Good error messages

### 1.0 Release

- Stable API
- Comprehensive docs
- Example projects
- NPM package published

## Development Practices

### Code Quality

- TypeScript strict mode
- 100% type coverage
- ESLint + Prettier
- Code review for all PRs

### Testing

- Unit tests for all modules
- Golden tests for emitter
- E2E tests for CLI
- Performance benchmarks

### Documentation

- JSDoc for all public APIs
- Inline comments for complex logic
- Spec documents updated
- User guide and examples

## Team Structure

For team development:

| Role           | Focus Area                     | Packages         |
| -------------- | ------------------------------ | ---------------- |
| Lead/Architect | Design, IR, Integration        | All              |
| Frontend Dev   | TypeScript parsing, validation | frontend         |
| Backend Dev    | C# emission, .NET integration  | emitter, backend |
| Runtime Dev    | Tsonic.Runtime implementation  | runtime          |
| DevOps/Test    | CI/CD, testing, documentation  | cli, tests       |

For solo development:

- Follow phases sequentially
- Focus on MVP first
- Iterate on features

## Next Steps

1. **Phase 0**: Setup repository and monorepo
2. **Phase 1-2**: Complete TypeScript frontend and IR
3. **Phase 3-4**: Get C# output with runtime
4. **Phase 5-6**: Build executable with CLI
5. **Phase 7-10**: Advanced features, testing, polish
