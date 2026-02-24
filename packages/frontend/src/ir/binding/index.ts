/**
 * Binding Layer — TS Symbol Resolution with Opaque Handles
 *
 * This module wraps TypeScript's symbol resolution APIs and returns opaque
 * handles (DeclId, SignatureId, MemberId) instead of ts.Symbol/ts.Signature.
 *
 * ALLOWED APIs (symbol resolution only):
 * - checker.getSymbolAtLocation(node) — Find symbol at AST node
 * - checker.getAliasedSymbol(symbol) — Resolve import alias
 * - checker.getExportSymbolOfSymbol(symbol) — Resolve export
 * - symbol.getDeclarations() — Get AST declaration nodes
 * - checker.getResolvedSignature(call) — Pick overload (type from declaration)
 *
 * BANNED APIs (these produce ts.Type, which violates INV-0):
 * - checker.getTypeAtLocation
 * - checker.getTypeOfSymbolAtLocation
 * - checker.getContextualType
 * - checker.typeToTypeNode
 *
 * Barrel re-export — all public types and factory function are re-exported
 * from their respective sub-modules.
 */

export type { Binding, BindingInternal, TypePredicateInfo } from "./binding-types.js";
export { createBinding } from "./binding-factory.js";
