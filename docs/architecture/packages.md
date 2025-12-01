# Package Structure

The Tsonic monorepo is organized into distinct packages.

## Overview

```
packages/
├── frontend/     # TypeScript -> IR
├── emitter/      # IR -> C#
├── backend/      # C# -> Binary
└── cli/          # Command-line interface
```

## Package Dependencies

```
cli
 ├── frontend
 ├── emitter
 └── backend

frontend (standalone)

emitter
 └── frontend (for IR types)

backend (standalone)
```

## @tsonic/frontend

TypeScript parsing and IR building.

### Responsibilities

- Create TypeScript programs
- Resolve module imports
- Validate source code
- Build IR from AST
- Analyze dependencies

### Key Exports

```typescript
export { createProgram, buildModuleDependencyGraph } from "./program.js";
export { validateProgram } from "./validator.js";
export { buildIr, buildIrModule } from "./ir/builder.js";
export type {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
} from "./ir/types.js";
export type { Diagnostic, DiagnosticsCollector } from "./types/diagnostic.js";
```

### Directory Structure

```
frontend/src/
├── program/          # TS program creation
├── resolver/         # Import resolution
├── validation/       # Code validation
├── ir/               # IR types and building
│   ├── types/        # IR type definitions
│   ├── builder/      # IR construction
│   ├── converters/   # TS AST -> IR
│   └── type-converter/  # TS types -> IR types
├── symbol-table/     # Symbol tracking
└── metadata/         # External type metadata
```

## @tsonic/emitter

C# code generation from IR.

### Responsibilities

- Emit C# types from IR types
- Emit C# expressions from IR expressions
- Emit C# statements from IR statements
- Generate module/namespace structure
- Handle generic specialization

### Key Exports

```typescript
export { emitCSharpFile, emitCSharpFiles } from "./emitter.js";
export { emitModule } from "./core/module-emitter.js";
export { emitType } from "./type-emitter.js";
export { emitExpression } from "./expression-emitter.js";
export { emitStatement } from "./statement-emitter.js";
```

### Directory Structure

```
emitter/src/
├── core/             # Module emission
│   └── module-emitter/
├── types/            # Type emission
├── expressions/      # Expression emission
├── statements/       # Statement emission
│   ├── control/      # Control flow
│   ├── declarations/ # Classes, interfaces
│   └── classes/      # Class members
├── specialization/   # Generic handling
├── emitter-types/    # Emitter context
└── golden-tests/     # Test framework
```

## @tsonic/backend

.NET build orchestration.

### Responsibilities

- Generate .csproj files
- Generate Program.cs entry point
- Run dotnet commands
- Handle NativeAOT configuration

### Key Exports

```typescript
export { buildNativeAot } from "./build-orchestrator.js";
export { generateCsproj } from "./project-generator.js";
export { generateProgramCs } from "./program-generator.js";
export { checkDotnetInstalled, detectRid } from "./dotnet.js";
export type { BuildConfig, BuildResult, EntryInfo } from "./types.js";
```

### Directory Structure

```
backend/src/
├── build-orchestrator.ts  # Main build logic
├── project-generator.ts   # .csproj generation
├── program-generator.ts   # Program.cs generation
├── dotnet.ts              # dotnet CLI wrapper
└── types.ts               # Type definitions
```

## @tsonic/cli

Command-line interface.

### Responsibilities

- Parse CLI arguments
- Load configuration
- Dispatch to commands
- Report errors and progress

### Key Exports

```typescript
export { runCli, parseArgs, showHelp } from "./cli.js";
export { loadConfig, resolveConfig } from "./config.js";
export type { TsonicConfig, CliOptions, ResolvedConfig } from "./types.js";
```

### Directory Structure

```
cli/src/
├── index.ts          # Entry point
├── cli/              # Argument parsing
│   ├── parser.ts     # CLI parser
│   ├── dispatcher.ts # Command routing
│   └── help.ts       # Help text
├── commands/         # Command implementations
│   ├── init.ts       # project init
│   ├── emit.ts       # emit command
│   ├── build.ts      # build command
│   ├── run.ts        # run command
│   └── pack.ts       # pack command
├── config.ts         # Config loading
└── types.ts          # Type definitions
```

## Inter-Package Communication

### CLI to Frontend

```typescript
import {
  buildModuleDependencyGraph,
  type CompilerOptions,
} from "@tsonic/frontend";

const result = buildModuleDependencyGraph(entryPoint, {
  projectRoot,
  sourceRoot,
  rootNamespace,
  typeRoots,
});
```

### CLI to Emitter

```typescript
import { emitCSharpFiles } from "@tsonic/emitter";

const result = emitCSharpFiles(modules, {
  rootNamespace,
  entryPointPath,
  runtime,
});
```

### CLI to Backend

```typescript
import { generateCsproj, generateProgramCs } from "@tsonic/backend";

const csproj = generateCsproj(buildConfig);
const programCs = generateProgramCs(entryInfo);
```

## Build System

### Building Packages

```bash
# Build all
./scripts/build/all.sh

# Build individual
cd packages/frontend && npm run build
cd packages/emitter && npm run build
cd packages/backend && npm run build
cd packages/cli && npm run build
```

### Package Build Order

Due to dependencies, build in this order:

1. frontend (no dependencies)
2. backend (no dependencies)
3. emitter (depends on frontend)
4. cli (depends on all)

### TypeScript Project References

Each package uses TypeScript project references:

```json
// packages/emitter/tsconfig.json
{
  "references": [{ "path": "../frontend" }]
}
```

## Testing

Each package has its own tests:

```bash
# All tests
npm test

# Specific package
cd packages/frontend && npm test
cd packages/emitter && npm test
```

### Test Patterns

- Unit tests: `*.test.ts` alongside source
- Golden tests: `testcases/` directories
- E2E tests: `test/fixtures/` (project root)
