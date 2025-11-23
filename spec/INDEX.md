# Tsonic Engineering Specifications

**Version**: 1.0
**Last Updated**: 2025-11-23
**Audience**: Users, Contributors, Integrators

---

## Quick Navigation

### 👤 I'm a new user

**Start here**: [Quickstart Guide](guide/01-quickstart.md) - Get your first program running in 5 minutes

### 🏗️ I'm building an application

**See**:

- [Language Reference](language-reference.md) - Complete TypeScript → C# mapping
- [.NET Integration](dotnet-reference.md) - Using .NET libraries
- [Cookbook](cookbook/INDEX.md) - Common patterns and recipes

### 💻 I want to contribute to the compiler

**Start here**: [Architecture Overview](architecture/INDEX.md) - Compiler internals

### 🔌 I'm integrating with Tsonic

**See**: [Contracts & File Formats](contracts.md) - Public interfaces and specifications

---

## Documentation Structure

```
spec/
├── guide/          📖 Tutorial-style learning path
├── reference/      📚 Complete look-up documentation
├── architecture/   🏗️ Compiler internals (for contributors)
├── contracts/      📋 Public interfaces and file formats
├── examples/       💡 Complete runnable code examples
├── cookbook/       🍳 How-to recipes for common tasks
└── meta/           📝 Roadmap, design decisions, glossary
```

---

## Learning Paths

### Path 1: New User → Productive Developer

**Goal**: Write and ship your first Tsonic application
**Time**: ~90 minutes

1. **[Quickstart](guide/01-quickstart.md)** (5 min)
   - Install Tsonic
   - Write Hello World
   - Build native executable

2. **[Language Basics](guide/02-language-basics.md)** (20 min)
   - TypeScript → C# fundamentals
   - Module system (ESM with `.ts` extensions)
   - Type mappings

3. **[Using .NET Libraries](guide/03-using-dotnet.md)** (25 min)
   - Importing .NET namespaces
   - Calling .NET methods
   - Common patterns (File I/O, HTTP, JSON)

4. **[Building Real Applications](guide/04-building-apps.md)** (30 min)
   - Project structure
   - Working with NuGet packages
   - Error handling

5. **[Deployment](guide/05-deployment.md)** (10 min)
   - Building executables
   - Distribution strategies

**Next steps**: Dive into [Reference Docs](reference/) as needed

---

### Path 2: Application Developer → Expert

**Goal**: Master advanced features and patterns
**Time**: Ongoing reference

**Core References**:

- [Language Reference](language-reference.md) - Complete language spec
- [.NET Integration](dotnet-reference.md) - Advanced .NET patterns
- [Tsonic.Runtime API](reference/runtime/INDEX.md) - Runtime helper functions
- [CLI Reference](reference/cli/INDEX.md) - Command-line tools
- [Error Codes](reference/diagnostics/INDEX.md) - Diagnostic catalog

**Recipes**:

- [Cookbook](cookbook/INDEX.md) - Solutions to common problems

**Examples**:

- [Complete Examples](examples/INDEX.md) - Real-world applications

---

### Path 3: New Contributor → Active Developer

**Goal**: Understand compiler internals and contribute features
**Time**: ~3-4 hours initial learning

1. **[Architecture Overview](architecture/overview/principles.md)** (30 min)
   - Design philosophy
   - Functional programming principles
   - Code organization

2. **[Pipeline Flow](architecture/overview/pipeline.md)** (30 min)
   - Compilation phases
   - Data flow between phases
   - Error propagation

3. **[Package Structure](architecture/overview/packages.md)** (20 min)
   - Monorepo organization
   - Package dependencies
   - Build system

4. **[Phase Deep Dive](architecture/)** (60-90 min)
   - Choose relevant phase (frontend/emitter/backend)
   - Read implementation docs
   - Understand data structures

5. **[Testing Strategy](architecture/testing/strategy.md)** (30 min)
   - Unit tests
   - Golden tests
   - Integration tests

6. **[Contributing Guide](meta/contributing.md)** (15 min)
   - Code style
   - PR process
   - Running tests

**Next steps**: Pick an issue, read relevant phase docs, start coding!

---

### Path 4: Integrator → Tool Builder

**Goal**: Build tools that consume Tsonic output
**Time**: ~1-2 hours

1. **[Contracts Overview](contracts.md)** (15 min)
   - What are contracts?
   - Versioning strategy
   - Stability guarantees

2. **[File Formats](contracts/file-formats/)** (45 min)
   - [metadata.json](contracts/file-formats/metadata.md) - CLR type metadata
   - [bindings.json](contracts/file-formats/bindings.md) - Runtime bindings
   - [Generated C# Code](contracts/file-formats/generated-code.md) - Output structure

3. **[CLI Interface](contracts/apis/cli.md)** (20 min)
   - Command interface
   - Exit codes
   - Output formats

4. **[Runtime API](contracts/apis/runtime.md)** (15 min)
   - Tsonic.Runtime public surface
   - Semantic guarantees

**Next steps**: Build your integration, reference contracts as needed

---

## Document Types

### 📖 Guides (Tutorial Style)

**Purpose**: Learn by doing
**Audience**: New users
**Style**: Progressive, example-driven, step-by-step

- Start at the beginning
- Build concepts progressively
- Include complete examples
- Focus on common cases

**Location**: [`guide/`](guide/)

---

### 📚 Reference (Look-up Style)

**Purpose**: Find specific answers quickly
**Audience**: Experienced users
**Style**: Complete, organized by topic, scannable

- Comprehensive coverage
- Organized by feature/topic
- Quick to search/scan
- Includes edge cases

**Location**: [`reference/`](reference/)

---

### 🏗️ Architecture (Implementation Details)

**Purpose**: Understand compiler internals
**Audience**: Contributors
**Style**: Technical, detailed, implementation-focused

- Internal design decisions
- Algorithms and data structures
- Package organization
- Call graphs and flows

**Location**: [`architecture/`](architecture/)

---

### 📋 Contracts (Public Specifications)

**Purpose**: Stable interfaces for integrators
**Audience**: Tool builders, integrators
**Style**: Precise, versioned, guaranteed stable

- File format specifications
- API contracts
- Versioning rules
- Breaking change policy

**Location**: [`contracts/`](contracts/)

---

### 💡 Examples (Runnable Code)

**Purpose**: See complete working applications
**Audience**: All users
**Style**: Real-world, fully functional, well-commented

- Complete projects
- Real-world patterns
- Copy-paste ready
- Covers common use cases

**Location**: [`examples/`](examples/)

---

### 🍳 Cookbook (Task Recipes)

**Purpose**: Solve specific problems
**Audience**: Application developers
**Style**: Task-oriented, solution-focused, concise

- "How do I...?" format
- Specific solutions
- Common patterns
- Quick wins

**Location**: [`cookbook/`](cookbook/)

---

### 📝 Meta (About the Project)

**Purpose**: Project governance and decisions
**Audience**: Contributors, stakeholders
**Style**: Explanatory, historical context

- Design decisions and rationale
- Implementation roadmap
- Glossary of terms
- Contribution guidelines

**Location**: [`meta/`](meta/)

---

## Search Tips

### Finding Language Features

```
reference/language/
├── modules.md          # imports, exports, ESM
├── types.md            # type mappings (TS → C#)
├── expressions.md      # all expression forms
├── statements.md       # all statement forms
├── generics.md         # generic types and constraints
├── async.md            # async/await, Promises, generators
└── limitations.md      # unsupported features
```

### Finding .NET Integration Info

```
reference/dotnet/
├── importing.md            # import syntax
├── type-mappings.md        # TS ↔ .NET type mappings
├── ref-out.md              # ref/out parameters (TSByRef)
├── explicit-interfaces.md  # As_IInterface pattern
├── extension-methods.md    # LINQ and extension methods
├── nested-types.md         # Outer$Inner naming
├── support-types.md        # TSByRef, TSUnsafePointer, etc.
└── patterns.md             # common .NET patterns
```

### Finding Error Code Explanations

```
reference/diagnostics/
├── TSN1xxx-modules.md      # ESM import errors
├── TSN2xxx-types.md        # Type checking errors
├── TSN3xxx-codegen.md      # Code generation errors
├── TSN4xxx-dotnet.md       # .NET interop errors
├── TSN5xxx-build.md        # Build process errors
└── TSN9xxx-metadata.md     # Metadata/bindings errors
```

### Finding Compiler Internals

```
architecture/
├── overview/           # High-level design
├── frontend/           # TypeScript → IR
├── emitter/            # IR → C#
├── backend/            # C# → NativeAOT
├── runtime/            # Tsonic.Runtime
└── testing/            # Testing strategies
```

---

## Quick Reference Cards

### Language Compatibility

| TypeScript Feature  | C# Output                   | Status         | Details                                             |
| ------------------- | --------------------------- | -------------- | --------------------------------------------------- |
| `import` with `.ts` | `using`                     | ✅ Required    | [modules.md](reference/language/modules.md)         |
| `number`            | `double`                    | ✅ Supported   | [types.md](reference/language/types.md)             |
| `string`            | `string`                    | ✅ Supported   | [types.md](reference/language/types.md)             |
| `boolean`           | `bool`                      | ✅ Supported   | [types.md](reference/language/types.md)             |
| `Array<T>`          | `List<T>` + helpers         | ✅ Supported   | [types.md](reference/language/types.md)             |
| `async/await`       | `async/await`               | ✅ Supported   | [async.md](reference/language/async.md)             |
| Generics            | Generics + monomorphization | ✅ Supported   | [generics.md](reference/language/generics.md)       |
| Decorators          | N/A                         | ❌ Unsupported | [limitations.md](reference/language/limitations.md) |

### .NET Integration

| Task               | Pattern                            | Details                                                           |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------- |
| Import .NET type   | `import { File } from "System.IO"` | [importing.md](reference/dotnet/importing.md)                     |
| Call static method | `File.ReadAllText("file.txt")`     | [importing.md](reference/dotnet/importing.md)                     |
| Handle ref/out     | `param: TSByRef<number>`           | [ref-out.md](reference/dotnet/ref-out.md)                         |
| Explicit interface | `obj.As_IInterface.Method()`       | [explicit-interfaces.md](reference/dotnet/explicit-interfaces.md) |
| Extension method   | `list.Where(x => x > 0)`           | [extension-methods.md](reference/dotnet/extension-methods.md)     |

---

## Contributing to These Docs

See [Contributing Guide](meta/contributing.md) for:

- How to improve documentation
- Style guidelines
- Review process
- Building docs locally

---

## Glossary

See [Glossary](meta/glossary.md) for definitions of:

- **IR** (Intermediate Representation)
- **Monomorphization** (Generic specialization)
- **NativeAOT** (Ahead-of-time compilation)
- **ESM** (ECMAScript Modules)
- And more...

---

## Version History

- **v1.0** (2025-11-23): Initial restructured documentation
  - Reorganized from flat structure to topic-based hierarchy
  - Separated user, contributor, and integrator documentation
  - Added learning paths and quick navigation

---

## License

These specifications are part of the Tsonic project.
See [LICENSE](../LICENSE) for details.
