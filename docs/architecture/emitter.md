# Emitter

The emitter converts IR into `CSharpAst`, then the printer turns that into C#.

## Current Architecture

```text
IR
  -> semantic helpers
  -> CSharpAst builders
  -> printer
  -> .cs text
```

## Important Current Fact

The emitter is AST-only now.

The old mixed pipeline of AST plus mid-pipeline C# text shims has been removed from the supported path.

## Major Areas

- type emission
- expression emission
- statement emission
- module assembly
- imports/namespaces
- specialization and helper synthesis
- mutable-storage/runtime helper generation

## Promise Lowering

Promise constructors and chains are normalized before final emission so the emitter works with the normalized result type rather than leaking wrapper unions into backend generics.

## Object Literals

Emitter handles deterministic object-literal lowering for:

- synthesized nominal helper types
- accessors
- shorthand methods
- supported runtime captures
- unknown/object-bag fallbacks where the contextual target demands it

## Output Boundary

The printer is the only stage that produces final C# text.
