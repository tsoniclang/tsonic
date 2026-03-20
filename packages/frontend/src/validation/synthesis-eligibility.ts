/**
 * Object Literal Synthesis Eligibility
 *
 * Checks basic structural eligibility for object literal synthesis.
 * Validates structural constraints (no non-deterministic computed keys,
 * no dynamic receiver method shorthand, etc.) but does NOT validate
 * spread type annotations (that requires TypeSystem).
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import { getUnsupportedObjectLiteralMethodRuntimeReason } from "../object-literal-method-runtime.js";

/**
 * Result of basic eligibility check for object literal synthesis.
 */
export type BasicEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Check basic structural eligibility for object literal synthesis.
 *
 * This is a simplified check that doesn't require TypeSystem access.
 * It validates structural constraints (no non-deterministic computed keys,
 * no dynamic receiver method shorthand, etc.)
 * but does NOT validate spread type annotations (that requires TypeSystem).
 *
 * Full eligibility check happens during IR conversion.
 */
export const checkBasicSynthesisEligibility = (
  node: ts.ObjectLiteralExpression,
  program: TsonicProgram
): BasicEligibilityResult => {
  const unwrapDeterministicKeyExpression = (
    expr: ts.Expression
  ): ts.Expression => {
    let current = expr;
    for (;;) {
      if (ts.isParenthesizedExpression(current)) {
        current = current.expression;
        continue;
      }
      if (
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isSatisfiesExpression(current)
      ) {
        current = current.expression;
        continue;
      }
      return current;
    }
  };

  const tryResolveDeterministicComputedKeyName = (
    name: ts.PropertyName,
    seenSymbols = new Set<ts.Symbol>()
  ): string | undefined => {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNoSubstitutionTemplateLiteral(name) ||
      ts.isNumericLiteral(name)
    ) {
      return String(name.text);
    }

    if (!ts.isComputedPropertyName(name)) {
      return undefined;
    }

    const expr = unwrapDeterministicKeyExpression(name.expression);
    if (
      ts.isStringLiteral(expr) ||
      ts.isNoSubstitutionTemplateLiteral(expr) ||
      ts.isNumericLiteral(expr)
    ) {
      return String(expr.text);
    }

    if (!ts.isIdentifier(expr)) {
      return undefined;
    }

    const symbol = program.checker.getSymbolAtLocation(expr);
    if (!symbol || seenSymbols.has(symbol)) {
      return undefined;
    }

    seenSymbols.add(symbol);
    const declarations = symbol.getDeclarations() ?? [];
    for (const decl of declarations) {
      if (
        ts.isImportSpecifier(decl) ||
        ts.isNamespaceImport(decl) ||
        ts.isImportClause(decl)
      ) {
        const aliasSymbol = program.checker.getAliasedSymbol(symbol);
        if (!aliasSymbol || seenSymbols.has(aliasSymbol)) continue;
        seenSymbols.add(aliasSymbol);
        for (const aliasedDecl of aliasSymbol.getDeclarations() ?? []) {
          if (
            ts.isVariableDeclaration(aliasedDecl) &&
            aliasedDecl.initializer &&
            ts.isVariableDeclarationList(aliasedDecl.parent)
          ) {
            const flags = aliasedDecl.parent.flags;
            if ((flags & ts.NodeFlags.Const) !== 0) {
              const resolved = tryResolveDeterministicComputedKeyName(
                ts.factory.createComputedPropertyName(aliasedDecl.initializer),
                seenSymbols
              );
              if (resolved !== undefined) return resolved;
            }
          }
        }
        continue;
      }

      if (
        ts.isVariableDeclaration(decl) &&
        decl.initializer &&
        ts.isVariableDeclarationList(decl.parent)
      ) {
        const flags = decl.parent.flags;
        if ((flags & ts.NodeFlags.Const) === 0) continue;
        const resolved = tryResolveDeterministicComputedKeyName(
          ts.factory.createComputedPropertyName(decl.initializer),
          seenSymbols
        );
        if (resolved !== undefined) return resolved;
      }
    }

    return undefined;
  };

  for (const prop of node.properties) {
    // Property assignment: check key type
    if (ts.isPropertyAssignment(prop)) {
      if (tryResolveDeterministicComputedKeyName(prop.name) === undefined) {
        return {
          eligible: false,
          reason:
            "Computed property key is not a deterministically known string/number literal",
        };
      }
      // Check for symbol keys
      if (ts.isPrivateIdentifier(prop.name)) {
        return {
          eligible: false,
          reason: `Private identifier (symbol) keys are not supported`,
        };
      }
    }

    // Shorthand property: always ok (identifier key)
    if (ts.isShorthandPropertyAssignment(prop)) {
      continue;
    }

    // Spread: allow for now, full check happens during IR conversion
    if (ts.isSpreadAssignment(prop)) {
      continue;
    }

    // Method declarations are valid as long as they avoid unsupported runtime
    // features. `this` is supported via object-literal method binding.
    if (ts.isMethodDeclaration(prop)) {
      if (tryResolveDeterministicComputedKeyName(prop.name) === undefined) {
        return {
          eligible: false,
          reason:
            "Computed property key is not a deterministically known string/number literal",
        };
      }
      if (ts.isPrivateIdentifier(prop.name)) {
        return {
          eligible: false,
          reason: `Private identifier (symbol) keys are not supported`,
        };
      }
      const unsupportedRuntimeReason =
        getUnsupportedObjectLiteralMethodRuntimeReason(prop);
      if (unsupportedRuntimeReason) {
        return {
          eligible: false,
          reason: unsupportedRuntimeReason,
        };
      }
      continue;
    }

    // Getter/setter: allowed for synthesized object types
    if (
      ts.isGetAccessorDeclaration(prop) ||
      ts.isSetAccessorDeclaration(prop)
    ) {
      if (tryResolveDeterministicComputedKeyName(prop.name) === undefined) {
        return {
          eligible: false,
          reason:
            "Computed property key is not a deterministically known string/number literal",
        };
      }
      continue;
    }
  }

  return { eligible: true };
};
