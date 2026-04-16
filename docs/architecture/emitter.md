# Emitter

The emitter converts IR into `CSharpAst`, then the printer turns that into C#.

## Current architecture

```text
IR
  -> semantic helpers
  -> CSharpAst builders
  -> printer
  -> .cs text
```

## Important current fact

The emitter is AST-only now.

The old mixed pipeline of AST plus mid-pipeline C# text shims is no longer the
supported architecture.

## Major areas

- type emission
- expression emission
- statement emission
- module assembly
- imports and namespaces
- specialization and helper synthesis

## Where the hard problems usually live

Emitter bugs usually show up in clusters like:

- overload specialization
- generic substitution at call sites
- wrapper/unwrapper normalization for unions and promises
- conversion of source-package semantics into backend-safe shapes

That is why emitter tests, goldens, and E2E fixtures remain one of the heaviest
parts of the `run-all` suite.

## Promise lowering

Promise constructors and chains are normalized before final emission so the
emitter works with the normalized result type rather than stale wrapper shapes.
