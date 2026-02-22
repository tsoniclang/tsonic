# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Tsonic compiler codebase.

## Critical Guidelines

### NEVER ACT WITHOUT EXPLICIT USER APPROVAL

**YOU MUST ALWAYS ASK FOR PERMISSION BEFORE:**

- Making architectural decisions or changes
- Implementing new features or functionality
- Modifying compiler behavior or type mappings
- Changing IR structure or code generation patterns
- Adding new dependencies or packages

**ONLY make changes AFTER the user explicitly approves.** When you identify issues or potential improvements, explain them clearly and wait for the user's decision. Do NOT assume what the user wants or make "helpful" changes without permission.

### TSONIC ALWAYS USES noLib: true

**🚨 CRITICAL ARCHITECTURAL FACT: Tsonic ALWAYS compiles with `noLib: true`. 🚨**

Tsonic targets .NET, NOT Node.js or browser JavaScript. TypeScript's standard library (`lib.d.ts`, `lib.es5.d.ts`, etc.) defines types for JavaScript runtimes - these are **completely irrelevant** for Tsonic.

**Implications:**

- **NEVER** rely on `checker.getResolvedSignature()` finding declarations from lib.d.ts
- **NEVER** assume TypeScript knows about Array, Promise, Map, etc. from its built-in libs
- **ALWAYS** use the TypeRegistry to look up type declarations
- **ALWAYS** define Tsonic's own type declarations for built-in types (Array, Promise, etc.)

**How type resolution works in Tsonic:**

1. TypeRegistry stores all type declarations from source files (classes, interfaces, type aliases)
2. NominalEnv computes type parameter substitutions through inheritance chains
3. When resolving method signatures (like `Array.map`), use TypeRegistry - NOT TypeScript's type checker
4. TypeScript's checker is only used for:
   - Parsing and AST generation
   - Basic symbol resolution within the same file
   - NOT for cross-file type inference or built-in type lookups

**Example:** For `nums.map((n) => n * 2)` where `nums: number[]`:

- TypeScript with `noLib: true` sees `number[]` but has NO built-in Array definition
- Tsonic's TypeRegistry has the Array interface with map method
- Use TypeRegistry.resolveNominal("Array") to get the map signature
- Apply NominalEnv substitution (T → number) to get parameter types

### NEVER SIMPLIFY OR MODIFY TESTS TO MAKE THEM PASS

**🚨 CRITICAL RULE: NEVER modify test code to work around compiler limitations. 🚨**

- **NEVER** simplify test cases to avoid compiler errors
- **NEVER** change test expectations to match incorrect behavior
- **NEVER** remove test cases that expose bugs
- **NEVER** weaken test assertions
- **ALWAYS** fix the compiler/validator when tests fail
- **ALWAYS** ask for permission before changing any test code

When a test fails due to a compiler limitation:

1. Report the limitation clearly
2. Ask whether to fix the compiler or defer
3. **DO NOT** modify the test without explicit permission

Tests exist to validate compiler correctness. Modifying tests to pass defeats their purpose.

### NEVER SWITCH BRANCHES WITHOUT PERMISSION

**🚨 CRITICAL RULE: NEVER switch git branches unless the user explicitly tells you to. 🚨**

- **NEVER** run `git checkout <branch>` to switch branches on your own
- **NEVER** run `git switch <branch>` without explicit user instruction
- **ALWAYS** stay on the current branch until told otherwise
- **ALWAYS** complete all work on the current branch before switching

If you need to switch branches for any reason, **ASK THE USER FIRST**.

### ANSWER QUESTIONS AND STOP

**CRITICAL RULE**: If the user asks you a question - whether as part of a larger text or just the question itself - you MUST:

1. **Answer ONLY that question**
2. **STOP your response completely**
3. **DO NOT continue with any other tasks or implementation**
4. **DO NOT proceed with previous tasks**
5. **Wait for the user's next instruction**

This applies to ANY question, even if it seems like part of a larger task or discussion.

### NO WORKAROUNDS - STOP AND FIX

**CRITICAL RULE**: When you encounter a bug or issue, do NOT implement workarounds or temporary fixes.

- **NEVER** say "for now, let's..." and implement a hack
- **NEVER** work around a problem with a different approach just to make progress
- **NEVER** use escape hatches like `as unknown as X` to bypass type errors
- **ALWAYS** stop and report the issue clearly
- **ALWAYS** wait for direction on whether to fix the root cause or defer

When you hit a blocker:

1. Explain exactly what the issue is
2. Explain why it's happening (root cause)
3. Stop and ask for direction

Workarounds hide problems and create technical debt. The correct response to a bug is to fix it or explicitly defer it - never to silently work around it.

### ALWAYS SAVE TEST OUTPUT TO LOG FILE

**🚨 CRITICAL RULE: ALWAYS pipe test output to a log file for later analysis. 🚨**

Tests in this project are slow (30+ seconds) and cannot be quickly re-run. If you lose the output, you lose valuable debugging information.

**ALWAYS do this:**

```bash
# Run tests and save output to log file
npm test 2>&1 | tee .tests/test.log

# Then analyze the log in a separate step
grep -E "(failing|Error|FAIL)" .tests/test.log
```

**NEVER do this:**

```bash
# DON'T run tests without saving output
npm test 2>&1 | tail -10  # Output is LOST if interrupted!
```

**Why this matters:**

- Tests take 30+ seconds to run
- If the command is interrupted, ALL output is lost
- You cannot re-run quickly to see what failed
- The `.tests/` directory is gitignored, safe for logs

### FUNCTIONAL PROGRAMMING ONLY

**MANDATORY**: This codebase follows strict functional programming principles:

- **NO MUTABLE VARIABLES** - Only use `const`, never `let` or `var`
- **NO MUTATIONS** - Never modify objects/arrays, always create new ones
- **PURE FUNCTIONS ONLY** - No side effects except necessary I/O
- **NO STATEFUL CLASSES** - Classes only for data structures, not logic
- **EXPLICIT DEPENDENCIES** - All dependencies passed as parameters

If you write mutable code, you MUST immediately rewrite it functionally.

### NEVER USE AUTOMATED SCRIPTS FOR FIXES

**🚨 CRITICAL RULE: NEVER EVER attempt automated fixes via scripts or mass updates. 🚨**

- **NEVER** create scripts to automate replacements (JS, Python, shell, etc.)
- **NEVER** use sed, awk, grep, or other text processing tools for bulk changes
- **NEVER** write code that modifies multiple files automatically
- **ALWAYS** make changes manually using the Edit tool
- **Even if there are hundreds of similar changes, do them ONE BY ONE**

Automated scripts break syntax in unpredictable ways and destroy codebases.

### NEVER USE NPX FOR TESTING COMPILER BEHAVIOR

**🚨 CRITICAL RULE: NEVER use `npx` to run the Tsonic CLI. 🚨**

- **NEVER** use `npx tsonic`
- **NEVER** use `npx` for any Tsonic-related commands
- **ALWAYS** use the local CLI build from this repo: `node ./packages/cli/dist/index.js` (run from the repo root)

**Why this matters:**

- `npx` fetches the published npm package, which may be weeks or months old
- Local changes to the compiler will NOT be reflected when using `npx`
- You cannot test compiler fixes or new features with `npx`
- Using `npx` gives you stale, outdated behavior

**Correct usage:**

```bash
# ALWAYS use the local CLI (from this repo)
node ./packages/cli/dist/index.js generate src/App.ts
node ./packages/cli/dist/index.js build src/App.ts

# Or from proof-is-in-the-pudding projects:
node ../../../../tsonic/packages/cli/dist/index.js build src/App.ts
```

**NEVER do this:**

```bash
# DON'T use npx - it fetches old published version!
npx tsonic build src/App.ts           # WRONG!
npx tsonic generate src/App.ts        # WRONG!
```

### USE DEDICATED TOOLS FOR FILE OPERATIONS

**IMPORTANT**: Always use the dedicated tools instead of bash commands for file operations:

- **Read files**: Use the `Read` tool, NOT `cat`, `head`, or `tail`
- **Edit files**: Use the `Edit` tool, NOT `sed` or `awk`
- **Create files**: Use the `Write` tool, NOT `cat` with heredoc or `echo` redirection
- **Search files**: Use the `Grep` tool, NOT `grep` or `rg` commands
- **Find files**: Use the `Glob` tool, NOT `find` or `ls`

Reserve bash exclusively for actual system commands (git, npm, dotnet, etc.) that require shell execution.

### GIT SAFETY RULES

#### NEVER DISCARD UNCOMMITTED WORK

**🚨 CRITICAL RULE: NEVER use commands that permanently delete uncommitted changes. 🚨**

These commands cause **PERMANENT DATA LOSS** that cannot be recovered:

- **NEVER** use `git reset --hard`
- **NEVER** use `git reset --soft`
- **NEVER** use `git reset --mixed`
- **NEVER** use `git reset HEAD`
- **NEVER** use `git checkout -- .`
- **NEVER** use `git checkout -- <file>`
- **NEVER** use `git restore` to discard changes
- **NEVER** use `git clean -fd`

**Why this matters for AI sessions:**

- Uncommitted work is invisible to future AI sessions
- Once discarded, changes cannot be recovered
- AI cannot help fix problems it cannot see

**What to do instead:**

| Situation               | ❌ WRONG                            | ✅ CORRECT                         |
| ----------------------- | ----------------------------------- | ---------------------------------- |
| Need to switch branches | `git checkout main` (loses changes) | Commit first, then switch          |
| Made mistakes           | `git reset --hard`                  | Commit to temp branch, start fresh |
| Want clean slate        | `git restore .`                     | Commit current state, then revert  |
| On wrong branch         | `git checkout --`                   | Commit here, then cherry-pick      |

**Safe workflow:**

```bash
# Always commit before switching context
git add -A
git commit -m "wip: current progress on feature X"
git checkout other-branch

# If commit was wrong, fix with new commit or revert
git revert HEAD  # Creates new commit that undoes last commit
# OR
git commit -m "fix: correct the previous commit"
```

#### NEVER USE GIT STASH

**🚨 CRITICAL RULE: NEVER use git stash - it hides work and causes data loss. 🚨**

- **NEVER** use `git stash`
- **NEVER** use `git stash push`
- **NEVER** use `git stash pop`
- **NEVER** use `git stash apply`
- **NEVER** use `git stash drop`

**Why stash is dangerous:**

- Stashed changes are invisible to AI sessions
- Easy to forget what's stashed
- Stash can be accidentally dropped
- Causes merge conflicts when applied
- No clear history of when/why stashed

**What to do instead - Use WIP branches:**

```bash
# Instead of stash, create a timestamped WIP branch
git checkout -b wip/feature-name-$(date +%Y%m%d-%H%M%S)
git add -A
git commit -m "wip: in-progress work on feature X"
git push -u origin wip/feature-name-$(date +%Y%m%d-%H%M%S)

# Now switch to other work safely
git checkout main
# ... do other work ...

# Return to your WIP later
git checkout wip/feature-name-20251108-084530
# Continue working...

# When done, squash WIP commits or rebase
git rebase -i main
```

**Benefits of WIP branches over stash:**

- ✅ Work is visible in git history
- ✅ Work is backed up on remote
- ✅ AI can see the work in future sessions
- ✅ Can have multiple WIP branches
- ✅ Clear timestamps show when work was done
- ✅ Can share WIP with others if needed

#### Safe Branch Switching

**ALWAYS commit before switching branches:**

```bash
# Check current status
git status

# If there are changes, commit them first
git add -A
git commit -m "wip: current state before switching"

# NOW safe to switch
git checkout other-branch
```

**If you accidentally started work on wrong branch:**

```bash
# DON'T use git reset or git checkout --
# Instead, commit the work here
git add -A
git commit -m "wip: work started on wrong branch"

# Create correct branch from current state
git checkout -b correct-branch-name

# Previous branch will still have the commit
# You can cherry-pick it or just continue on new branch
```

#### Recovery from Mistakes

If you realize you made a mistake AFTER committing:

```bash
# ✅ CORRECT: Create a fix commit
git commit -m "fix: correct the mistake from previous commit"

# ✅ CORRECT: Revert the bad commit
git revert HEAD

# ❌ WRONG: Try to undo with reset
git reset --hard HEAD~1  # NEVER DO THIS - loses history
```

**If you accidentally committed to main:**

```bash
# DON'T panic or use git reset
# Just create a feature branch from current position
git checkout -b feat/your-feature-name

# Push the branch
git push -u origin feat/your-feature-name

# When merged, it will fast-forward (no conflicts)
# Main will catch up to the same commit
```

### WORKING DIRECTORIES

**IMPORTANT**: Never create temporary files in the project root or package directories. Use dedicated gitignored directories for different purposes.

#### .tests/ Directory (Test Output Capture)

**Purpose:** Save test run output for analysis without re-running tests

**Usage:**

```bash
# Create directory (gitignored)
mkdir -p .tests

# Run tests with tee - shows output AND saves to file
npm test | tee .tests/run-$(date +%s).txt

# Analyze saved output later without re-running:
grep "failing" .tests/run-*.txt
tail -50 .tests/run-*.txt
grep -A10 "specific test name" .tests/run-*.txt
```

**Benefits:**

- See test output in real-time (unlike `>` redirection)
- Analyze failures without expensive re-runs
- Keep historical test results for comparison
- Search across multiple test runs

**Key Rule:** ALWAYS use `tee` for test output, NEVER plain redirection (`>` or `2>&1`)

#### .analysis/ Directory (Research & Documentation)

**Purpose:** Keep analysis artifacts separate from source code

**Usage:**

```bash
# Create directory (gitignored)
mkdir -p .analysis

# Use for:
# - Code complexity reports
# - API documentation generation
# - Dependency analysis
# - Performance profiling results
# - Architecture diagrams and documentation
# - Parser output investigations
# - Temporary debugging scripts
```

**Benefits:**

- Keeps analysis work separate from source code
- Allows iterative analysis without cluttering repository
- Safe place for temporary debugging scripts
- Gitignored - no risk of committing debug artifacts

#### .todos/ Directory (Persistent Task Tracking)

**Purpose:** Track multi-step tasks across conversation sessions

**Usage:**

```bash
# Create task file: YYYY-MM-DD-task-name.md
# Example: 2025-01-13-sql-generation.md

# Task file must include:
# - Task overview and objectives
# - Current status (completed work)
# - Detailed remaining work list
# - Important decisions made
# - Code locations affected
# - Testing requirements
# - Special considerations

# Mark complete: YYYY-MM-DD-task-name-COMPLETED.md
```

**Benefits:**

- Resume complex tasks across sessions with full context
- No loss of progress or decisions
- Gitignored for persistence

#### .temp/ Directory (Temporary Scripts & Debugging)

**Purpose:** Store temporary scripts and one-off debugging files

**Usage:**

```bash
# Create directory (gitignored)
mkdir -p .temp

# Use for:
# - Quick test scripts
# - Debug output files
# - One-off data transformations
# - Temporary TypeScript/JavaScript for testing

# NEVER use /tmp or system temp directories
# .temp keeps files visible and within the project
```

**Key Rule:** ALWAYS use `.temp/` instead of `/tmp/` or system temp directories. This keeps temporary work visible and accessible within the project.

**Note:** All four directories (`.tests/`, `.analysis/`, `.todos/`, `.temp/`) should be added to `.gitignore`

## Session Startup

### First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project conventions
2. **Read the user documentation** for context:
   - `/docs/index.md` - Project overview and user guide
   - `/docs/language/module-system.md` - ESM import rules
   - `/docs/language/type-mappings.md` - TypeScript → C# mappings
   - `/CODING-STANDARDS.md` - Mandatory coding patterns
3. **Read engineering specs** if modifying compiler internals:
   - `/spec/index.md` - Engineering specification index
   - `/spec/architecture/README.md` - How to read architecture docs
   - `/spec/architecture/00-overview.md` - Compiler principles
4. **Check implementation plan**: `/spec/appendices/implementation-plan.md`
5. **Review examples** in `/docs/examples/` for expected behavior

Only after reading these documents should you proceed with implementation tasks.

## Project Overview

Tsonic is a TypeScript to C# to NativeAOT compiler that:

1. **Parses TypeScript** using the TypeScript Compiler API
2. **Builds an IR** (Intermediate Representation)
3. **Emits C#** with exact JavaScript semantics via `Tsonic.Runtime`
4. **Compiles to NativeAOT** using dotnet CLI

### Core Rules

- **ESM-Only**: Every local import MUST have `.ts` extension
- **Directory = Namespace**: Exact case-preserved mapping
- **File name = Class name**: File stem becomes class name exactly
- **JS names preserved**: `Array` stays `Array` in `Tsonic.Runtime`, not `JSArray`
- **No magic**: Error clearly instead of guessing

## Functional Programming Patterns

### Immutable Updates

```typescript
// ✅ CORRECT - Create new object
const addExport = (module: IrModule, exp: IrExport): IrModule => ({
  ...module,
  exports: [...module.exports, exp],
});

// ❌ WRONG - Never mutate
function addExport(module: IrModule, exp: IrExport): void {
  module.exports.push(exp); // NEVER DO THIS
}
```

### Pure Functions

```typescript
// ✅ CORRECT - Pure function returns value
const resolveNamespace = (filePath: string, rootNs: string): string => {
  const parts = path.dirname(filePath).split(path.sep);
  return [rootNs, ...parts].join(".");
};

// ❌ WRONG - Side effect modifying registry
function resolveNamespace(filePath: string, registry: Registry): void {
  registry.set(filePath, namespace); // Side effect
}
```

### Result Types

```typescript
// ✅ CORRECT - Return Result type
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const parseModule = (source: string): Result<IrModule, Diagnostic[]> =>
  // Implementation

  // ❌ WRONG - Throwing exceptions
  function parseModule(source: string): IrModule {
    throw new Error("Parse failed"); // Don't throw
  };
```

## Code Generation Principles

### TypeScript → IR → C#

The compilation pipeline is strictly layered:

1. **Frontend**: TypeScript → IR (no C# knowledge)
2. **Emitter**: IR → C# (no TypeScript knowledge)
3. **Backend**: C# → NativeAOT (no compiler knowledge)

Never mix concerns between layers.

### Exact Semantics

JavaScript semantics must be preserved exactly:

```typescript
// TypeScript sparse array
const arr = [];
arr[10] = "ten";
console.log(arr.length); // 11

// Must compile to C# with same behavior
var arr = new Tsonic.Runtime.Array<string>();
arr[10] = "ten";
console.log(arr.length); // 11
```

## Module System

### ESM Rules

```typescript
// ✅ CORRECT - Local import with .ts extension
import { User } from "./models/User.ts";

// ✅ CORRECT - .NET import without extension
import { File } from "System.IO";

// ❌ WRONG - Missing extension for local
import { User } from "./models/User"; // ERROR TSN1001

// ❌ WRONG - Extension for .NET
import { File } from "System.IO.ts"; // Makes no sense
```

## Testing Approach

### Test-Driven Development

1. **Write test first** showing expected behavior
2. **Run test** to see it fail
3. **Implement** minimal code to pass
4. **Refactor** while keeping tests green

### Golden Tests

For code generation, use golden tests:

```typescript
// Input TypeScript
const input = `
export function greet(name: string): string {
  return \`Hello \${name}\`;
}
`;

// Expected C# output
const expected = `
public static string greet(string name)
{
  return $"Hello {name}";
}
`;

// Test exact match
assert.equal(emitCSharp(parseTS(input)), expected);
```

## Common Pitfalls to Avoid

### 1. Mutable State

**NEVER** use mutable variables or modify objects:

```typescript
// ❌ WRONG
let count = 0;
for (const item of items) {
  count++; // Mutation
}

// ✅ CORRECT
const count = items.reduce((acc) => acc + 1, 0);
```

### 2. Hidden Dependencies

**ALWAYS** pass dependencies explicitly:

```typescript
// ❌ WRONG - Hidden config dependency
import { config } from "./config.js";
const emit = (ir: IrModule) => {
  if (config.debug) {
    /* ... */
  }
};

// ✅ CORRECT - Explicit parameter
const emit = (ir: IrModule, config: Config) => {
  if (config.debug) {
    /* ... */
  }
};
```

### 3. Classes for Logic

**NEVER** use classes for logic, only data:

```typescript
// ❌ WRONG - Class with logic
class Emitter {
  emit(ir: IrModule): string {
    /* ... */
  }
}

// ✅ CORRECT - Pure function
const emit = (ir: IrModule): string => {
  /* ... */
};
```

## Build Commands

```bash
# Install dependencies
npm install

# Build all packages
./scripts/build/all.sh

# Run tests
npm test

# Run specific test
npm test -- --grep "pattern"

# Run E2E tests
./test/scripts/run-all.sh

# Run a subset of E2E fixtures (iteration only)
./test/scripts/run-all.sh --filter <pattern>

# Clean build artifacts
./scripts/build/clean.sh

# Clean everything including node_modules
./scripts/build/clean.sh --all

# Format code
./scripts/build/format.sh

# Lint code
./scripts/build/lint.sh
```

Test workflow (airplane-grade):

- During iteration (e.g. on an external testbed project), it’s OK to use `./test/scripts/run-all.sh --quick` or `./test/scripts/run-all.sh --filter ...` for fast feedback.
- Before merging/publishing, ALWAYS run the full suite: `./test/scripts/run-all.sh` (no `--quick` / `--filter`).
- If a change is substantial (emitter/type system/CLI/runtime behavior), run the full suite even during development.

## Git Workflow

### Branch Strategy

1. **NEVER commit to main directly**
2. **Create feature branches**: `feat/feature-name` or `fix/bug-name`
3. **Verify branch before commit**: `git branch --show-current`

### Commit Process

1. **Commit before switching contexts**: See Git Safety Rules above
2. **Format code**: Run `./scripts/format-all.sh` before committing
3. **Run tests**: Ensure all tests pass with `npm test`
4. **Clear commit message**: Describe what and why
5. **No force push**: Never use `git push --force`

### Pull Requests

**NEVER create pull requests using `gh pr create` or similar CLI commands.**

The user will create all pull requests manually through the GitHub web interface. Your job is to:

1. Create feature branches
2. Commit changes
3. Push branches to remote
4. **STOP** - Do not create PRs

### Workflow Summary

**Critical rules (see detailed Git Safety Rules section above):**

1. ✅ **ALWAYS commit before switching contexts** - Even if work is incomplete
2. ✅ **NEVER discard uncommitted work** - Use WIP branches instead
3. ✅ **NEVER use git stash** - Use timestamped WIP branches
4. ✅ **NEVER use git reset --hard** - Use git revert for fixes
5. ✅ **Verify branch**: `git branch --show-current` before committing
6. ✅ **Push WIP branches**: Backup work on remote
7. ✅ **Use git revert not git reset** - To undo commits

**Standard workflow:**

```bash
# 1. Verify you're on correct branch
git branch --show-current

# 2. Make changes and commit frequently
git add -A
git commit -m "feat: descriptive message"

# 3. Format and test before pushing
./scripts/format-all.sh
npm test

# 4. Push to remote
git push
```

## Implementation Order

Follow the phases in `/spec/implementation-plan.md`:

1. **Phase 0**: Project setup
2. **Phase 1**: TypeScript frontend
3. **Phase 2**: IR builder
4. **Phase 3**: C# emitter
5. **Phase 4**: Runtime implementation
6. **Phase 5**: Backend (dotnet CLI)
7. **Phase 6**: CLI
8. **Phase 7-10**: Advanced features

## When You Get Stuck

If you encounter issues:

1. **STOP immediately** - Don't implement workarounds
2. **Explain the issue clearly** - Show what's blocking you
3. **Propose solutions** - Suggest approaches
4. **Wait for user decision** - Don't proceed without approval

## Security

### Never Execute User Input

```typescript
// ❌ WRONG - Shell injection
exec(`dotnet ${userInput}`);

// ✅ CORRECT - Safe spawn
spawn("dotnet", [userInput]);
```

### Validate Paths

```typescript
// ✅ CORRECT - Validate paths
const safePath = (input: string): string | null => {
  const normalized = path.normalize(input);
  if (normalized.includes("..")) return null;
  return normalized;
};
```

## Key Files to Reference

- **Spec documents**: `/spec/*.md` - Complete specification
- **Examples**: `/spec/examples/*.md` - Input/output examples
- **Coding standards**: `/CODING-STANDARDS.md` - Mandatory patterns
- **Implementation plan**: `/spec/implementation-plan.md` - Development phases

## Remember

1. **Functional programming only** - No mutations ever
2. **Pure functions** - Return values, no side effects
3. **Explicit over implicit** - Pass all dependencies
4. **Error over guess** - Clear diagnostics instead of magic
5. **Test everything** - TDD approach
6. **Ask before changing** - Get user approval first
7. **Commit before switching** - Never discard uncommitted work
8. **Never use git stash** - Use WIP branches instead
