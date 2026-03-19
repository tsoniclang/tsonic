/**
 * Binding Layer — Signature Candidate Resolution & Constructor Resolution
 *
 * Contains candidate collection for call overloads, plus constructor
 * signature resolution. Split from binding-call-resolution.ts for
 * file-size compliance.
 */

import ts from "typescript";
import type { SignatureId } from "../type-system/types.js";
import type { BindingContext } from "./binding-registry.js";
import { getOrCreateSignatureId } from "./binding-registry.js";
import {
  extractParameterNodes,
  convertTypeParameterDeclarations,
} from "./binding-helpers.js";

// ═══════════════════════════════════════════════════════════════════════════
// CALL SIGNATURE CANDIDATES
// ═══════════════════════════════════════════════════════════════════════════

export const resolveCallSignatureCandidates = (
  ctx: BindingContext,
  node: ts.CallExpression
): readonly SignatureId[] | undefined => {
  const collectSignatureCandidates = (
    signatures: readonly ts.Signature[]
  ): readonly SignatureId[] | undefined => {
    const argCount = node.arguments.length;
    const candidates: SignatureId[] = [];

    for (const sig of signatures) {
      const decl = sig.getDeclaration();
      if (decl && ts.isFunctionLike(decl)) {
        if (
          ts.isConstructSignatureDeclaration(decl) ||
          ts.isConstructorDeclaration(decl)
        ) {
          continue;
        }

        const params = extractParameterNodes(decl);
        const required = params.filter(
          (p) => !p.isOptional && !p.isRest
        ).length;
        const hasRest = params.some((p) => p.isRest);
        if (argCount < required) continue;
        if (!hasRest && argCount > params.length) continue;
      }

      candidates.push(getOrCreateSignatureId(ctx, sig));
    }

    return candidates.length > 0 ? candidates : undefined;
  };

  const expr = node.expression;
  const symbol = (() => {
    if (ts.isIdentifier(expr)) return ctx.checker.getSymbolAtLocation(expr);
    if (ts.isPropertyAccessExpression(expr)) {
      return ctx.checker.getSymbolAtLocation(expr.name);
    }
    return undefined;
  })();
  if (!symbol) return undefined;

  const resolvedSymbol =
    symbol.flags & ts.SymbolFlags.Alias
      ? ctx.checker.getAliasedSymbol(symbol)
      : symbol;

  const decls = resolvedSymbol.getDeclarations();
  if (decls && decls.length > 0) {
    const directSignatures = decls.flatMap((decl) => {
      if (!ts.isFunctionLike(decl)) return [];
      const sig = ctx.checker.getSignatureFromDeclaration(decl);
      return sig ? [sig] : [];
    });
    const directCandidates = collectSignatureCandidates(directSignatures);
    if (directCandidates) return directCandidates;
  }

  const expressionType = ctx.checker.getTypeAtLocation(expr);
  return collectSignatureCandidates(expressionType.getCallSignatures());
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR SIGNATURE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export const resolveConstructorSignature = (
  ctx: BindingContext,
  node: ts.NewExpression
): SignatureId | undefined => {
  const signature = ctx.checker.getResolvedSignature(node);
  if (!signature) return undefined;

  const sigId = getOrCreateSignatureId(ctx, signature);

  // For implicit default constructors, TypeScript may return a signature with no declaration.
  // We still need a SignatureEntry that identifies the constructed type so TypeSystem can
  // synthesize the constructor return type deterministically.
  const entry = ctx.signatureMap.get(sigId.id);
  if (entry && !entry.decl) {
    const expr = node.expression;

    const symbol = (() => {
      if (ts.isIdentifier(expr)) return ctx.checker.getSymbolAtLocation(expr);
      if (ts.isPropertyAccessExpression(expr)) {
        return ctx.checker.getSymbolAtLocation(expr.name);
      }
      return undefined;
    })();

    const resolvedSymbol =
      symbol && symbol.flags & ts.SymbolFlags.Alias
        ? ctx.checker.getAliasedSymbol(symbol)
        : symbol;

    const decl = resolvedSymbol?.getDeclarations()?.[0];

    const declaringTypeTsName = (() => {
      if (decl && ts.isClassDeclaration(decl) && decl.name)
        return decl.name.text;
      if (resolvedSymbol) return resolvedSymbol.getName();
      if (ts.isIdentifier(expr)) return expr.text;
      if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
      return undefined;
    })();

    if (declaringTypeTsName) {
      ctx.signatureMap.set(sigId.id, {
        ...entry,
        declaringTypeTsName,
        declaringMemberName: "constructor",
        typeParameters:
          decl && ts.isClassDeclaration(decl)
            ? convertTypeParameterDeclarations(decl.typeParameters)
            : undefined,
        declaringTypeParameterNames:
          decl && ts.isClassDeclaration(decl) && decl.typeParameters
            ? decl.typeParameters.map((tp) => tp.name.text)
            : undefined,
      });
    }
  }

  return sigId;
};

export const resolveConstructorSignatureCandidates = (
  ctx: BindingContext,
  node: ts.NewExpression
): readonly SignatureId[] | undefined => {
  const expr = node.expression;
  const symbol = (() => {
    if (ts.isIdentifier(expr)) return ctx.checker.getSymbolAtLocation(expr);
    if (ts.isPropertyAccessExpression(expr)) {
      return ctx.checker.getSymbolAtLocation(expr.name);
    }
    return undefined;
  })();
  if (!symbol) return undefined;

  const resolvedSymbol =
    symbol.flags & ts.SymbolFlags.Alias
      ? ctx.checker.getAliasedSymbol(symbol)
      : symbol;

  const decls = resolvedSymbol.getDeclarations();
  if (!decls || decls.length === 0) return undefined;

  const argCount = node.arguments?.length ?? 0;
  const candidates: SignatureId[] = [];

  for (const decl of decls) {
    if (!ts.isFunctionLike(decl)) continue;
    // Only include construct signatures / constructors for new expressions.
    if (
      !ts.isConstructSignatureDeclaration(decl) &&
      !ts.isConstructorDeclaration(decl)
    ) {
      continue;
    }

    const params = extractParameterNodes(decl);
    const required = params.filter((p) => !p.isOptional && !p.isRest).length;
    const hasRest = params.some((p) => p.isRest);
    if (argCount < required) continue;
    if (!hasRest && argCount > params.length) continue;

    const sig = ctx.checker.getSignatureFromDeclaration(decl);
    if (!sig) continue;
    candidates.push(getOrCreateSignatureId(ctx, sig));
  }

  return candidates.length > 0 ? candidates : undefined;
};
