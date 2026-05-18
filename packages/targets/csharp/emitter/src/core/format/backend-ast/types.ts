/**
 * Backend C# AST type definitions
 *
 * Structured AST nodes for deterministic C# code generation.
 * These types follow Roslyn syntax node semantics with camelCase TypeScript naming.
 *
 * Pipeline: IR -> typed CSharpAst -> deterministic printer -> C# text
 *
 * INVARIANT: No `rawType` or `rawExpression` nodes exist. Every construct
 * must be represented by an explicit, strongly-typed AST node.
 */

export * from "./types/type-ast.js";
export * from "./types/signature-ast.js";
export * from "./types/expression-ast.js";
export * from "./types/pattern-ast.js";
export * from "./types/statement-ast.js";
export * from "./types/declaration-ast.js";
export * from "./types/compilation-unit-ast.js";
