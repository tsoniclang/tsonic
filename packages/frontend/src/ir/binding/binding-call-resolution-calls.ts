/**
 * Binding Layer — Call Signature Resolution
 *
 * Contains the overload resolution logic for call expressions.
 * Split from binding-call-resolution.ts for file-size compliance.
 */

import ts from "typescript";
import type { SignatureId } from "../type-system/types.js";
import type { SignatureEntry } from "./binding-types.js";
import type { BindingContext } from "./binding-registry.js";
import {
  getOrCreateSignatureId,
  isSyntheticBindingMarkerName,
} from "./binding-registry.js";
import { getTypeNodeFromDeclaration } from "./binding-helpers.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import { resolveCallSignatureCandidates } from "./binding-call-resolution-candidates.js";

// ═══════════════════════════════════════════════════════════════════════════
// CALL SIGNATURE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export const resolveCallSignature = (
  ctx: BindingContext,
  node: ts.CallExpression
): SignatureId | undefined => {
  const signature = ctx.checker.getResolvedSignature(node);
  if (!signature) return undefined;

  // TypeScript can produce a resolved signature without a declaration for
  // implicit default constructors (e.g., `super()` when the base class has
  // no explicit constructor). We still want a SignatureId so TypeSystem can
  // treat this call deterministically as `void`.
  if (signature.declaration === undefined) {
    // Special case: `super()` implicit base constructor
    if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      return getOrCreateSignatureId(ctx, signature);
    }

    // Recovery: calls through variables/properties typed as functions can
    // yield signatures without declarations. Attempt to re-anchor to a
    // function-like declaration we can capture syntactically.
    const symbol = (() => {
      const expr = node.expression;
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

    const decls = resolvedSymbol?.getDeclarations() ?? [];
    for (const decl of decls) {
      // Direct function-like declarations (function/method/signature)
      if (ts.isFunctionLike(decl)) {
        const sig = ctx.checker.getSignatureFromDeclaration(decl);
        if (sig) return getOrCreateSignatureId(ctx, sig);
        continue;
      }

      // Variable initializers: const f = (x) => ...
      if (ts.isVariableDeclaration(decl)) {
        const init = decl.initializer;
        if (
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          const sig = ctx.checker.getSignatureFromDeclaration(init);
          if (sig) return getOrCreateSignatureId(ctx, sig);
        }
      }
    }

    return undefined;
  }

  const resolvedId = getOrCreateSignatureId(ctx, signature);

  // Airplane-grade overload selection for erased TS types:
  // In TypeScript, `char` is `string`, so overload sets that differ only by
  // `char` vs `string` can be resolved "wrong" due to declaration order
  // (e.g., string.split("/") picking the `char` overload).
  //
  // We apply a deterministic, syntax-driven tie-breaker:
  // - Prefer `string` parameters for non-charish arguments (string literals, etc.)
  // - Prefer `char` parameters only when the argument is explicitly marked char
  //   (e.g., `expr as char`, or identifier declared `: char`).
  const candidates = resolveCallSignatureCandidates(ctx, node);
  if (!candidates || candidates.length < 2) return resolvedId;

  const stripParens = (expr: ts.Expression): ts.Expression => {
    let current = expr;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  };

  const isCharTypeNode = (typeNode: ts.TypeNode): boolean => {
    if (ts.isTypeReferenceNode(typeNode)) {
      const tn = typeNode.typeName;
      if (ts.isIdentifier(tn)) return tn.text === "char";
      return tn.right.text === "char";
    }
    return false;
  };

  const isCharishArgument = (arg: ts.Expression): boolean => {
    const expr = stripParens(arg);

    // Explicit `as char` / `<char>` assertions.
    if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
      return isCharTypeNode(expr.type);
    }

    // Identifier declared with `: char`.
    if (ts.isIdentifier(expr)) {
      const sym = ctx.checker.getSymbolAtLocation(expr);
      if (!sym) return false;
      const resolvedSym =
        sym.flags & ts.SymbolFlags.Alias
          ? ctx.checker.getAliasedSymbol(sym)
          : sym;
      const decls = resolvedSym.getDeclarations() ?? [];
      for (const decl of decls) {
        const typeNode = getTypeNodeFromDeclaration(decl);
        if (typeNode && isCharTypeNode(typeNode)) return true;
      }
    }

    return false;
  };

  const stringType = ctx.checker.getStringType();

  const prefersStringOverChar = (arg: ts.Expression): boolean => {
    const expr = stripParens(arg);
    if (isCharishArgument(expr)) return false;

    // In TS, `char` is erased to `string`, so we must prefer `string` overloads
    // for *any* string-typed argument unless the user explicitly marks it as char.
    //
    // This keeps common code like `Console.WriteLine(condition ? "OK" : "BAD")`
    // from accidentally binding to `WriteLine(char)` (due to declaration order).
    const t = ctx.checker.getTypeAtLocation(expr);
    return ctx.checker.isTypeAssignableTo(t, stringType);
  };

  const getStaticPropertyNameLocal = (
    name: ts.PropertyName | ts.BindingName
  ): string | undefined =>
    ts.isIdentifier(name) ||
    ts.isObjectBindingPattern(name) ||
    ts.isArrayBindingPattern(name)
      ? ts.isIdentifier(name)
        ? name.text
        : undefined
      : tryResolveDeterministicPropertyName(name);

  const getObjectLiteralKeys = (
    arg: ts.Expression
  ): readonly string[] | undefined => {
    const expr = stripParens(arg);
    if (!ts.isObjectLiteralExpression(expr)) return undefined;

    const keys: string[] = [];
    for (const property of expr.properties) {
      if (ts.isSpreadAssignment(property)) return undefined;

      if (ts.isShorthandPropertyAssignment(property)) {
        keys.push(property.name.text);
        continue;
      }

      if (
        ts.isPropertyAssignment(property) ||
        ts.isMethodDeclaration(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)
      ) {
        const key = getStaticPropertyNameLocal(property.name);
        if (!key) return undefined;
        keys.push(key);
        continue;
      }

      return undefined;
    }

    return keys;
  };

  const isUnknownTypeNode = (typeNode: ts.TypeNode | undefined): boolean =>
    !!typeNode && typeNode.kind === ts.SyntaxKind.UnknownKeyword;

  const isObviouslyNonObjectTypeNode = (
    typeNode: ts.TypeNode | undefined
  ): boolean => {
    if (!typeNode) return false;
    const node = ts.isParenthesizedTypeNode(typeNode)
      ? typeNode.type
      : typeNode;

    return (
      node.kind === ts.SyntaxKind.StringKeyword ||
      node.kind === ts.SyntaxKind.NumberKeyword ||
      node.kind === ts.SyntaxKind.BooleanKeyword ||
      node.kind === ts.SyntaxKind.BigIntKeyword ||
      node.kind === ts.SyntaxKind.VoidKeyword ||
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.UndefinedKeyword ||
      node.kind === ts.SyntaxKind.UnknownKeyword ||
      node.kind === ts.SyntaxKind.AnyKeyword
    );
  };

  const mergePropertySets = (
    left: ReadonlySet<string>,
    right: ReadonlySet<string>
  ): ReadonlySet<string> => new Set([...left, ...right]);

  const collectDeclaredPropertyNames = (
    typeNode: ts.TypeNode | undefined,
    seenSymbols = new Set<ts.Symbol>(),
    seenNodes = new Set<ts.Node>()
  ): ReadonlySet<string> | undefined => {
    if (!typeNode) return undefined;
    if (seenNodes.has(typeNode)) return undefined;
    seenNodes.add(typeNode);

    const node = ts.isParenthesizedTypeNode(typeNode)
      ? typeNode.type
      : typeNode;

    if (ts.isTypeLiteralNode(node)) {
      const names = new Set<string>();
      for (const member of node.members) {
        if (
          ts.isPropertySignature(member) ||
          ts.isMethodSignature(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isSetAccessorDeclaration(member)
        ) {
          if (!member.name) continue;
          const name = getStaticPropertyNameLocal(member.name);
          if (!name || isSyntheticBindingMarkerName(name)) continue;
          names.add(name);
        }
      }
      return names;
    }

    if (ts.isIntersectionTypeNode(node)) {
      let merged: ReadonlySet<string> | undefined;
      for (const part of node.types) {
        const partNames = collectDeclaredPropertyNames(
          part,
          seenSymbols,
          seenNodes
        );
        if (!partNames) continue;
        merged = merged ? mergePropertySets(merged, partNames) : partNames;
      }
      return merged;
    }

    if (!ts.isTypeReferenceNode(node)) {
      return undefined;
    }

    const rawSymbol = ts.isIdentifier(node.typeName)
      ? ctx.checker.getSymbolAtLocation(node.typeName)
      : ctx.checker.getSymbolAtLocation(node.typeName.right);
    if (!rawSymbol) return undefined;

    const symbol =
      rawSymbol.flags & ts.SymbolFlags.Alias
        ? ctx.checker.getAliasedSymbol(rawSymbol)
        : rawSymbol;

    if (seenSymbols.has(symbol)) return undefined;
    seenSymbols.add(symbol);

    let merged: ReadonlySet<string> | undefined;
    for (const decl of symbol.getDeclarations() ?? []) {
      if (ts.isTypeAliasDeclaration(decl)) {
        const aliasNames = collectDeclaredPropertyNames(
          decl.type,
          seenSymbols,
          seenNodes
        );
        if (aliasNames) {
          merged = merged ? mergePropertySets(merged, aliasNames) : aliasNames;
        }
        continue;
      }

      if (!ts.isInterfaceDeclaration(decl) && !ts.isClassDeclaration(decl)) {
        continue;
      }

      let names = new Set<string>();
      for (const member of decl.members) {
        if (
          ts.isPropertySignature(member) ||
          ts.isMethodSignature(member) ||
          ts.isPropertyDeclaration(member) ||
          ts.isMethodDeclaration(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isSetAccessorDeclaration(member)
        ) {
          if (!member.name) continue;
          const name = getStaticPropertyNameLocal(member.name);
          if (!name || isSyntheticBindingMarkerName(name)) continue;
          names.add(name);
        }
      }

      for (const heritage of decl.heritageClauses ?? []) {
        for (const heritageType of heritage.types) {
          const heritageNames = collectDeclaredPropertyNames(
            heritageType,
            seenSymbols,
            seenNodes
          );
          if (heritageNames) {
            names = new Set([...names, ...heritageNames]);
          }
        }
      }

      merged = merged ? mergePropertySets(merged, names) : names;
    }

    return merged;
  };

  type ParamClass = "char" | "string" | "other";

  const classifyParamTypeNode = (typeNode: unknown): ParamClass => {
    if (!typeNode) return "other";
    const node = typeNode as ts.TypeNode;
    if (node.kind === ts.SyntaxKind.StringKeyword) return "string";
    if (isCharTypeNode(node)) return "char";
    if (ts.isArrayTypeNode(node)) {
      return isCharTypeNode(node.elementType) ? "char" : "other";
    }
    return "other";
  };

  const paramClassForArgIndex = (
    entry: SignatureEntry,
    argIndex: number
  ): ParamClass => {
    const params = entry.parameters;
    const direct = params[argIndex];
    if (direct) return classifyParamTypeNode(direct.typeNode);

    // Rest parameter: map extra args to last param if it is rest.
    const last = params[params.length - 1];
    if (last && last.isRest) return classifyParamTypeNode(last.typeNode);
    return "other";
  };

  const args = node.arguments;
  const wantsStringAt: number[] = [];
  const wantsCharAt: number[] = [];
  const objectLiteralArgs = new Map<number, readonly string[]>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) continue;

    if (isCharishArgument(arg)) {
      wantsCharAt.push(i);
    } else if (prefersStringOverChar(arg)) {
      wantsStringAt.push(i);
    }

    const objectKeys = getObjectLiteralKeys(arg);
    if (objectKeys && objectKeys.length > 0) {
      objectLiteralArgs.set(i, objectKeys);
    }
  }

  if (
    wantsStringAt.length === 0 &&
    wantsCharAt.length === 0 &&
    objectLiteralArgs.size === 0
  ) {
    return resolvedId;
  }

  const objectLiteralScoreForArg = (
    entry: SignatureEntry,
    argIndex: number,
    keys: readonly string[]
  ): number => {
    const direct = entry.parameters[argIndex];
    const last = entry.parameters[entry.parameters.length - 1];
    const param = direct ?? (last?.isRest ? last : undefined);

    if (!param?.typeNode) return -4;

    const typeNode = param.typeNode as ts.TypeNode;
    if (isUnknownTypeNode(typeNode)) return -10;
    if (isObviouslyNonObjectTypeNode(typeNode)) return -6;

    const propertyNames = collectDeclaredPropertyNames(typeNode);
    if (!propertyNames || propertyNames.size === 0) {
      return 0;
    }

    for (const key of keys) {
      if (!propertyNames.has(key)) {
        return -6;
      }
    }

    const extraPropertyCount = Math.max(0, propertyNames.size - keys.length);
    return 10 - Math.min(extraPropertyCount, 5);
  };

  const scoreSignature = (sigId: SignatureId): number => {
    const entry = ctx.signatureMap.get(sigId.id);
    if (!entry) return 0;

    let score = 0;
    for (const i of wantsStringAt) {
      const pc = paramClassForArgIndex(entry, i);
      if (pc === "string") score += 2;
      if (pc === "char") score -= 2;
    }
    for (const i of wantsCharAt) {
      const pc = paramClassForArgIndex(entry, i);
      if (pc === "char") score += 2;
      if (pc === "string") score -= 2;
    }
    for (const [argIndex, keys] of objectLiteralArgs) {
      score += objectLiteralScoreForArg(entry, argIndex, keys);
    }
    return score;
  };

  const resolvedScore = scoreSignature(resolvedId);
  let bestId = resolvedId;
  let bestScore = resolvedScore;

  for (const candidate of candidates) {
    const s = scoreSignature(candidate);
    if (s > bestScore) {
      bestScore = s;
      bestId = candidate;
    }
  }

  return bestId;
};
