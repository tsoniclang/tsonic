/**
 * Binding Layer — TS Symbol Resolution with Opaque Handles
 *
 * This module wraps TypeScript's symbol resolution APIs and returns opaque
 * handles (DeclId, SignatureId, MemberId) instead of ts.Symbol/ts.Signature.
 *
 * ALLOWED APIs (symbol resolution only):
 * - sourceSemantics.getSymbol(node) — Find symbol at source node
 * - sourceSemantics.getResolvedSignature(call) — Pick overload through source semantic boundary
 * - checker.getAliasedSymbol(symbol) — Resolve import alias
 * - checker.getExportSymbolOfSymbol(symbol) — Resolve export
 * - symbol.getDeclarations() — Get AST declaration nodes
 *
 * BANNED APIs (outside source-frontend boundary):
 * - direct checker type queries
 * - direct checker contextual queries
 * - direct checker signature queries
 * - checker.typeToTypeNode
 *
 * Barrel re-export — all public types and factory function are re-exported
 * from their respective sub-modules.
 */

export type {
  Binding,
  BindingInternal,
  TypePredicateInfo,
} from "./binding-types.js";
export { createBinding } from "./binding-factory.js";
