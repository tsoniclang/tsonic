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
import {
  getOrCreateDeclId,
  getOrCreateSignatureId,
  resolveTransparentAliases,
} from "./binding-registry.js";
import {
  extractParameterNodes,
  convertTypeParameterDeclarations,
  normalizeCapturedDeclaringTypeName,
} from "./binding-helpers.js";
import { isOverloadSurfaceDeclaration } from "../syntax/overload-stubs.js";

const hasStaticModifier = (node: ts.Node): boolean => {
  const modifiers = (
    node as ts.Node & {
      readonly modifiers?: readonly ts.ModifierLike[];
    }
  ).modifiers;
  return !!modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword
  );
};

const getClassMemberStaticIntent = (
  decl: ts.Declaration
): boolean | undefined => {
  if (
    !(
      ts.isMethodDeclaration(decl) ||
      ts.isPropertyDeclaration(decl) ||
      ts.isGetAccessorDeclaration(decl) ||
      ts.isSetAccessorDeclaration(decl)
    )
  ) {
    return undefined;
  }

  return ts.isClassLike(decl.parent) ? hasStaticModifier(decl) : undefined;
};

const isClassValueReceiver = (
  ctx: BindingContext,
  expr: ts.Expression
): boolean =>
  ctx.sourceSemantics.getExpressionType(expr).getConstructSignatures().length >
  0;

const filterPropertyAccessDeclarationsByReceiver = (
  ctx: BindingContext,
  node: ts.CallExpression,
  decls: readonly ts.Declaration[]
): readonly ts.Declaration[] => {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return decls;
  }

  const staticAwareDecls = decls.filter(
    (decl) => getClassMemberStaticIntent(decl) !== undefined
  );
  if (staticAwareDecls.length === 0) {
    return decls;
  }

  const wantsStatic = isClassValueReceiver(ctx, node.expression.expression);
  const filtered = decls.filter((decl) => {
    const staticIntent = getClassMemberStaticIntent(decl);
    return staticIntent === undefined || staticIntent === wantsStatic;
  });

  return filtered.length > 0 ? filtered : decls;
};

// ═══════════════════════════════════════════════════════════════════════════
// CALL SIGNATURE CANDIDATES
// ═══════════════════════════════════════════════════════════════════════════

export const resolveCallTargetDeclarations = (
  ctx: BindingContext,
  node: ts.CallExpression
): readonly ts.Declaration[] | undefined => {
  const expr = node.expression;
  const symbol = (() => {
    if (ts.isIdentifier(expr)) return ctx.sourceSemantics.getSymbol(expr);
    if (ts.isPropertyAccessExpression(expr)) {
      return ctx.sourceSemantics.getSymbol(expr.name);
    }
    return undefined;
  })();
  if (!symbol) return undefined;

  const resolvedSymbol =
    symbol.flags & ts.SymbolFlags.Alias
      ? ctx.sourceSemantics.getAliasedSymbol(symbol)
      : symbol;

  return resolvedSymbol.getDeclarations();
};

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
  const decls = resolveCallTargetDeclarations(ctx, node);
  if (decls && decls.length > 0) {
    const overloadSurfaceDecls = decls.filter(isOverloadSurfaceDeclaration);
    const unfilteredDirectDecls =
      overloadSurfaceDecls.length > 0 ? overloadSurfaceDecls : decls;
    const directDecls = filterPropertyAccessDeclarationsByReceiver(
      ctx,
      node,
      unfilteredDirectDecls
    );

    const directSignatures = directDecls.flatMap((decl) => {
      if (!ts.isFunctionLike(decl)) return [];
      const sig = ctx.sourceSemantics.getSignatureFromDeclaration(decl);
      return sig ? [sig] : [];
    });
    const directCandidates = collectSignatureCandidates(directSignatures);
    if (directCandidates) return directCandidates;
  }

  const expressionType = ctx.sourceSemantics.getExpressionType(expr);
  return collectSignatureCandidates(expressionType.getCallSignatures());
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR SIGNATURE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export const resolveConstructorSignature = (
  ctx: BindingContext,
  node: ts.NewExpression
): SignatureId | undefined => {
  const signature = ctx.sourceSemantics.getResolvedSignature(node);
  if (!signature) return undefined;

  const sigId = getOrCreateSignatureId(ctx, signature);
  const declaredConstructorMetadata = (() => {
    const decl = signature.getDeclaration();
    if (!decl) {
      return undefined;
    }

    if (ts.isConstructorDeclaration(decl)) {
      const parent = decl.parent;
      if (!ts.isClassDeclaration(parent) || !parent.name) {
        return undefined;
      }

      const parentSymbol = ctx.sourceSemantics.getSymbol(parent.name);
      const declId = parentSymbol
        ? getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, parentSymbol))
        : undefined;
      const declaringTypeTsName =
        (declId ? ctx.declMap.get(declId.id)?.fqName : undefined) ??
        normalizeCapturedDeclaringTypeName(parent.name.text);

      return {
        declaringTypeTsName,
        typeParameters: convertTypeParameterDeclarations(parent.typeParameters),
        declaringTypeParameterNames: parent.typeParameters?.map(
          (tp) => tp.name.text
        ),
      };
    }

    if (ts.isConstructSignatureDeclaration(decl)) {
      const parent = decl.parent;
      if (!ts.isInterfaceDeclaration(parent) || !parent.name) {
        return undefined;
      }

      return {
        declaringTypeTsName: normalizeCapturedDeclaringTypeName(
          parent.name.text
        ),
        typeParameters: convertTypeParameterDeclarations(decl.typeParameters),
        declaringTypeParameterNames: decl.typeParameters?.map(
          (tp) => tp.name.text
        ),
      };
    }

    return undefined;
  })();

  // For implicit default constructors, TypeScript may return a signature with no declaration.
  // We still need a SignatureEntry that identifies the constructed type so TypeSystem can
  // synthesize the constructor return type deterministically.
  const entry = ctx.signatureMap.get(sigId.id);
  if (entry && declaredConstructorMetadata) {
    ctx.signatureMap.set(sigId.id, {
      ...entry,
      declaringTypeTsName: declaredConstructorMetadata.declaringTypeTsName,
      declaringMemberName: "constructor",
      typeParameters:
        declaredConstructorMetadata.typeParameters ?? entry.typeParameters,
      declaringTypeParameterNames:
        declaredConstructorMetadata.declaringTypeParameterNames ??
        entry.declaringTypeParameterNames,
    });
  }

  if (entry && !entry.decl) {
    const expr = node.expression;

    const symbol = (() => {
      if (ts.isIdentifier(expr)) return ctx.sourceSemantics.getSymbol(expr);
      if (ts.isPropertyAccessExpression(expr)) {
        return ctx.sourceSemantics.getSymbol(expr.name);
      }
      return undefined;
    })();

    const resolvedSymbol =
      symbol && symbol.flags & ts.SymbolFlags.Alias
        ? ctx.sourceSemantics.getAliasedSymbol(symbol)
        : symbol;

    const decl = resolvedSymbol?.getDeclarations()?.[0];

    const declaringTypeTsName =
      (() => {
        if (decl && ts.isClassDeclaration(decl) && decl.name) {
          const parentSymbol = ctx.sourceSemantics.getSymbol(decl.name);
          if (parentSymbol) {
            const declId = getOrCreateDeclId(
              ctx,
              resolveTransparentAliases(ctx, parentSymbol)
            );
            return ctx.declMap.get(declId.id)?.fqName ?? decl.name.text;
          }
        }

        return undefined;
      })() ??
      (() => {
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
    if (ts.isIdentifier(expr)) return ctx.sourceSemantics.getSymbol(expr);
    if (ts.isPropertyAccessExpression(expr)) {
      return ctx.sourceSemantics.getSymbol(expr.name);
    }
    return undefined;
  })();
  if (!symbol) return undefined;

  const resolvedSymbol =
    symbol.flags & ts.SymbolFlags.Alias
      ? ctx.sourceSemantics.getAliasedSymbol(symbol)
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

    const sig = ctx.sourceSemantics.getSignatureFromDeclaration(decl);
    if (!sig) continue;
    candidates.push(getOrCreateSignatureId(ctx, sig));
  }

  return candidates.length > 0 ? candidates : undefined;
};
