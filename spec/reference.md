# Reference Documentation

**Purpose**: Complete look-up documentation for Tsonic

**Audience**: Developers who know the basics and need specific details

**Style**: Comprehensive, organized by topic, scannable

---

## Overview

This reference documentation provides complete coverage of all Tsonic features. Unlike the [Guide](../guide/), which is tutorial-style, this section is organized for quick look-up and includes all edge cases and advanced features.

---

## Reference Sections

### [Language Reference](language/INDEX.md)

Complete TypeScript → C# mapping and language features:

- **[Modules](language/modules.md)** - ESM import/export, module resolution
- **[Types](language/types.md)** - Primitive types, arrays, objects, interfaces
- **[Expressions](language/expressions.md)** - All expression forms and operators
- **[Statements](language/statements.md)** - Control flow, declarations, loops
- **[Functions](language/functions.md)** - Function declarations, arrows, generics
- **[Classes](language/classes.md)** - Class declarations, inheritance, access modifiers
- **[Generics](language/generics.md)** - Type parameters, constraints, monomorphization
- **[Async](language/async.md)** - async/await, Promises, generators
- **[Limitations](language/limitations.md)** - Unsupported TypeScript features

### [.NET Integration](dotnet/INDEX.md)

Using .NET libraries from Tsonic:

- **[Importing](dotnet/importing.md)** - Import syntax for .NET types
- **[Type Mappings](dotnet/type-mappings.md)** - TypeScript ↔ .NET type conversions
- **[Ref/Out Parameters](dotnet/ref-out.md)** - TSByRef pattern
- **[Explicit Interfaces](dotnet/explicit-interfaces.md)** - As_IInterface pattern
- **[Extension Methods](dotnet/extension-methods.md)** - LINQ and extension methods
- **[Nested Types](dotnet/nested-types.md)** - Outer$Inner naming
- **[Support Types](dotnet/support-types.md)** - TSByRef, TSUnsafePointer, etc.
- **[Common Patterns](dotnet/patterns.md)** - Best practices for .NET interop

### [Tsonic.Runtime API](runtime/INDEX.md)

Runtime library for JavaScript semantics:

- **[Array](runtime/array.md)** - Tsonic.Runtime.Array<T> and methods
- **[Object](runtime/object.md)** - Dynamic objects and property access
- **[Console](runtime/console.md)** - Console logging methods
- **[Promise](runtime/promise.md)** - Async operations
- **[Utilities](runtime/utilities.md)** - Helper functions and conversions

### [CLI Reference](cli/INDEX.md)

Command-line interface documentation:

- **[Commands](cli/commands.md)** - build, run, emit, etc.
- **[Options](cli/options.md)** - All CLI flags and options
- **[Configuration](cli/configuration.md)** - tsonic.config.json format
- **[Exit Codes](cli/exit-codes.md)** - Error code meanings

### [Diagnostic Codes](diagnostics/INDEX.md)

Complete error and warning catalog:

- **[TSN1xxx](diagnostics/TSN1xxx-modules.md)** - Module resolution errors
- **[TSN2xxx](diagnostics/TSN2xxx-types.md)** - Type checking errors
- **[TSN3xxx](diagnostics/TSN3xxx-codegen.md)** - Code generation errors
- **[TSN4xxx](diagnostics/TSN4xxx-dotnet.md)** - .NET interop errors
- **[TSN5xxx](diagnostics/TSN5xxx-build.md)** - Build process errors
- **[TSN9xxx](diagnostics/TSN9xxx-metadata.md)** - Metadata/bindings errors

---

## How to Use This Reference

### Finding Information

1. **Know what you're looking for?**
   - Use the table of contents in each section's INDEX.md
   - Search within specific files (e.g., search "optional" in language/functions.md)

2. **Browsing a topic?**
   - Start with the section INDEX
   - Follow links to related topics

3. **Got an error code?**
   - Go to [Diagnostics](diagnostics/INDEX.md)
   - Find the TSNxxxx error code
   - See explanation, examples, and fixes

### Reading Format

Each reference page follows this structure:

1. **Overview** - What this feature is
2. **Syntax** - Formal syntax definition
3. **Semantics** - How it behaves
4. **Examples** - Code samples
5. **Edge Cases** - Corner cases and limitations
6. **Related** - Links to related topics

---

## Quick Reference Cards

### Type Mappings

| TypeScript   | C#                  | Tsonic.Runtime                   | Notes               |
| ------------ | ------------------- | -------------------------------- | ------------------- |
| `number`     | `double`            | `double`                         | Always 64-bit float |
| `string`     | `string`            | `string`                         | UTF-16              |
| `boolean`    | `bool`              | `bool`                           | true/false          |
| `null`       | `null`              | `object?`                        | Nullable reference  |
| `undefined`  | `TSUndefined.Value` | `TSUndefined`                    | Singleton           |
| `Array<T>`   | `Array<T>`          | `Tsonic.Runtime.Array<T>`        | JS semantics        |
| `Promise<T>` | `Task<T>`           | `System.Threading.Tasks.Task<T>` | async/await         |

### Import Syntax

```typescript
// Local module (MUST have .ts extension)
import { User } from "./models/User.ts";

// .NET namespace (NO extension)
import { File } from "System.IO";

// Default import
import User from "./models/User.ts";

// Namespace import
import * as Utils from "./utils.ts";
```

### Generic Naming

| TypeScript            | C# (Monomorphized)    |
| --------------------- | --------------------- |
| `Array<number>`       | `Array_number`        |
| `List<string>`        | `List_1_string`       |
| `Map<string, number>` | `Map_2_string_number` |

### Nested Types

| .NET Type     | TypeScript Import |
| ------------- | ----------------- |
| `Outer.Inner` | `Outer$Inner`     |
| `A.B.C`       | `A$B$C`           |

---

## Comparison with Guide

| Guide (Tutorial)     | Reference (Look-up)            |
| -------------------- | ------------------------------ |
| Learn by doing       | Find specific answers          |
| Progressive examples | Comprehensive coverage         |
| Common cases         | All cases including edge cases |
| Step-by-step         | Topic-based organization       |
| Start at beginning   | Jump to any section            |

**When to use Guide**: Learning Tsonic for the first time

**When to use Reference**: You know what you want, need exact details

---

## External References

### TypeScript

- **[TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)** - Official TypeScript documentation
- **[ESM Specification](https://tc39.es/ecma262/#sec-modules)** - ECMAScript module spec

### .NET

- **[.NET API Browser](https://learn.microsoft.com/en-us/dotnet/api/)** - Complete .NET API reference
- **[C# Language Reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/)** - C# documentation
- **[NativeAOT Documentation](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/)** - Native compilation

---

## Version

**Tsonic Version**: 1.0

**Last Updated**: 2025-11-23

Changes to this reference are documented in the [Changelog](../meta/changelog.md).

---

## Contributing

Found an error or omission in the reference docs?

See [Contributing Guide](../meta/contributing.md) for how to submit corrections or improvements.

---

## See Also

- **[Guide](../guide/)** - Tutorial-style learning path
- **[Examples](../examples/)** - Complete runnable examples
- **[Cookbook](../cookbook/)** - How-to recipes
- **[Contracts](../contracts/)** - Public API specifications
