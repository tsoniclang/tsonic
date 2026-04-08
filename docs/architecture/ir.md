---
title: IR
---

# IR

Tsonic IR is the frontend/backend boundary.

## What IR captures

- module identity
- imports and exports
- statements and expressions
- resolved types
- generic substitutions
- backend-relevant semantic decisions that must survive into emission

## What IR is not

- not a backend syntax tree
- not raw TypeScript AST
- not Roslyn AST

The backend syntax tree is a later layer: `CSharpAst`.

## Why the split exists

IR keeps frontend reasoning separate from backend syntax concerns.

Examples:

- source-package resolution belongs in the frontend and IR side
- C# keyword escaping belongs in backend AST/printer
- numeric proof belongs before backend emission

## Why IR matters in practice

Most tricky bugs in the stack are frontend-to-backend contract bugs:

- a source-package call surface was not fully specialized
- a promise or callback result shape was normalized incorrectly
- a local package boundary carried the wrong ownership mode

IR is where those decisions become explicit and testable before the backend has
to print C# syntax.
