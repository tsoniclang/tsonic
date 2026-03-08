# IR

Tsonic’s IR is the frontend/backend boundary.

## What IR Captures

- module identity
- imports/exports
- statements
- expressions
- resolved types
- generic substitutions
- backend-relevant semantic decisions that must survive into emission

## What IR Does Not Try To Be

- it is not a backend syntax tree
- it is not raw TypeScript AST
- it is not Roslyn AST

The backend syntax tree is a later layer: `CSharpAst`.

## Why This Split Exists

IR keeps frontend reasoning separate from backend syntax concerns.

Examples:

- source-package resolution belongs in the frontend/IR side
- C# keyword escaping belongs in the backend AST/printer side
- numeric proof belongs before backend emission

## Current Pressure Points Captured in IR

- `nameof` / `sizeof`
- Promise chain normalization
- dynamic import normalization
- object-literal method/accessor lowering intent
- generic function value specialization state
