/**
 * Object Literal Synthesis Eligibility
 *
 * Checks basic structural eligibility for object literal synthesis.
 * Validates structural constraints (no non-deterministic computed keys,
 * no dynamic receiver method shorthand, etc.) but does NOT validate
 * spread type annotations (that requires TypeSystem).
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import { TsonicProgram } from "../program.js";
import { getUnsupportedObjectLiteralMethodRuntimeReason } from "./object-literal-method-runtime.js";
import {
  getNodeInitializer,
  getNodeProperties,
  getVariableDeclarationListKind,
  isIdentifier,
  staticPropertyNameText,
  type SourceSymbol,
  unwrapDeterministicExpression,
} from "./tsts-helpers.js";

export type BasicEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

const isImportAliasDeclaration = (node: TstsNode): boolean =>
  node.Kind === TstsSyntax.KindImportSpecifier ||
  node.Kind === TstsSyntax.KindNamespaceImport ||
  node.Kind === TstsSyntax.KindImportClause;

const isConstVariableDeclarationWithInitializer = (
  node: TstsNode
): boolean =>
  node.Kind === TstsSyntax.KindVariableDeclaration &&
  getNodeInitializer(node) !== undefined &&
  getVariableDeclarationListKind(node)?.isConst === true;

export const checkBasicSynthesisEligibility = (
  node: TstsNode,
  program: TsonicProgram
): BasicEligibilityResult => {
  const tryResolveDeterministicComputedKeyExpression = (
    expression: TstsNode | undefined,
    seenSymbols: Set<SourceSymbol>
  ): string | undefined => {
    const expr = unwrapDeterministicExpression(expression);
    const literalText = staticPropertyNameText(expr);
    if (literalText !== undefined) {
      return literalText;
    }

    if (!expr || !isIdentifier(expr)) {
      return undefined;
    }

    const symbol = program.sourceSemantics.getSymbol(expr);
    if (!symbol || seenSymbols.has(symbol)) {
      return undefined;
    }

    seenSymbols.add(symbol);
    for (const declaration of program.sourceSemantics.getSymbolDeclarations(
      symbol
    )) {
      if (isImportAliasDeclaration(declaration)) {
        const aliasSymbol = program.sourceSemantics.resolveAlias(symbol);
        if (!aliasSymbol || seenSymbols.has(aliasSymbol)) continue;
        seenSymbols.add(aliasSymbol);
        for (const aliasedDecl of program.sourceSemantics.getSymbolDeclarations(
          aliasSymbol
        )) {
          if (isConstVariableDeclarationWithInitializer(aliasedDecl)) {
            const resolved = tryResolveDeterministicComputedKeyExpression(
              getNodeInitializer(aliasedDecl),
              seenSymbols
            );
            if (resolved !== undefined) return resolved;
          }
        }
        continue;
      }

      if (isConstVariableDeclarationWithInitializer(declaration)) {
        const resolved = tryResolveDeterministicComputedKeyExpression(
          getNodeInitializer(declaration),
          seenSymbols
        );
        if (resolved !== undefined) return resolved;
      }
    }

    return undefined;
  };

  const tryResolveDeterministicComputedKeyName = (
    name: TstsNode | undefined,
    seenSymbols = new Set<SourceSymbol>()
  ): string | undefined => {
    const literalText = staticPropertyNameText(name);
    if (literalText !== undefined) {
      return literalText;
    }

    if (name?.Kind !== TstsSyntax.KindComputedPropertyName) {
      return undefined;
    }

    return tryResolveDeterministicComputedKeyExpression(
      TstsSyntax.AsComputedPropertyName(name)?.Expression,
      seenSymbols
    );
  };

  const checkNamedProperty = (
    prop: TstsNode
  ): BasicEligibilityResult | undefined => {
    const name =
      TstsSyntax.Node_PropertyNameOrName(prop) ?? TstsSyntax.Node_Name(prop);
    if (tryResolveDeterministicComputedKeyName(name) === undefined) {
      return {
        eligible: false,
        reason:
          "Computed property key is not a deterministically known string/number literal",
      };
    }
    if (name?.Kind === TstsSyntax.KindPrivateIdentifier) {
      return {
        eligible: false,
        reason: "Private identifier (symbol) keys are not supported",
      };
    }
    return undefined;
  };

  for (const prop of getNodeProperties(node)) {
    if (prop.Kind === TstsSyntax.KindPropertyAssignment) {
      const result = checkNamedProperty(prop);
      if (result) return result;
    }

    if (prop.Kind === TstsSyntax.KindShorthandPropertyAssignment) {
      continue;
    }

    if (prop.Kind === TstsSyntax.KindSpreadAssignment) {
      continue;
    }

    if (prop.Kind === TstsSyntax.KindMethodDeclaration) {
      const result = checkNamedProperty(prop);
      if (result) return result;
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

    if (
      prop.Kind === TstsSyntax.KindGetAccessor ||
      prop.Kind === TstsSyntax.KindSetAccessor
    ) {
      const result = checkNamedProperty(prop);
      if (result) return result;
      continue;
    }
  }

  return { eligible: true };
};
