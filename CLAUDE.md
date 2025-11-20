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

### ANSWER QUESTIONS AND STOP

**CRITICAL RULE**: If the user asks you a question - whether as part of a larger text or just the question itself - you MUST:

1. **Answer ONLY that question**
2. **STOP your response completely**
3. **DO NOT continue with any other tasks or implementation**
4. **DO NOT proceed with previous tasks**
5. **Wait for the user's next instruction**

This applies to ANY question, even if it seems like part of a larger task or discussion.

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

**Note:** All three directories (`.tests/`, `.analysis/`, `.todos/`) should be added to `.gitignore`

## Session Startup

### First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project conventions
2. **Read the spec documents** in order:
   - `/spec/overview.md` - Project overview
   - `/spec/architecture.md` - System architecture
   - `/spec/module-resolution.md` - ESM import rules
   - `/CODING-STANDARDS.md` - Mandatory coding patterns
3. **Check implementation plan**: `/spec/implementation-plan.md`
4. **Review examples** in `/spec/examples/` for expected behavior

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
./scripts/build.sh

# Run tests
npm test

# Run specific test
npm test -- --grep "pattern"

# Clean build artifacts
./scripts/clean.sh

# Clean everything including node_modules
./scripts/clean.sh --all

# Format code
./scripts/format-all.sh

# Lint code
./scripts/lint-all.sh
```

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
