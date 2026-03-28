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
import {
  getReturnTypeNode,
  getTypeNodeFromDeclaration,
} from "./binding-helpers.js";
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
    return undefined;
  }

  const resolvedId = getOrCreateSignatureId(ctx, signature);

  // Narrow overload selection only from explicit source evidence.
  // We never rescore a correctly resolved TS signature using inferred
  // numeric/string "intent". Only exact authored primitive aliases and exact
  // object-literal structural compatibility may narrow candidates further.
  const candidates = resolveCallSignatureCandidates(ctx, node);
  if (!candidates || candidates.length < 2) return resolvedId;

  const stripParens = (expr: ts.Expression): ts.Expression => {
    let current = expr;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  };

  const CLR_NUMERIC_ALIAS_NAMES = new Set([
    "sbyte",
    "short",
    "int",
    "long",
    "nint",
    "int128",
    "byte",
    "ushort",
    "uint",
    "ulong",
    "nuint",
    "uint128",
    "half",
    "float",
    "double",
    "decimal",
  ]);

  const getEntityNameLeaf = (name: ts.EntityName): string =>
    ts.isIdentifier(name) ? name.text : name.right.text;

  const getExplicitClrPrimitiveAlias = (
    typeNode: ts.TypeNode | undefined
  ): string | undefined => {
    if (!typeNode) return undefined;
    const node = ts.isParenthesizedTypeNode(typeNode) ? typeNode.type : typeNode;
    if (!ts.isTypeReferenceNode(node)) return undefined;

    const alias = getEntityNameLeaf(node.typeName);
    if (alias === "char" || CLR_NUMERIC_ALIAS_NAMES.has(alias)) {
      return alias;
    }

    return undefined;
  };

  const isStringTypeNode = (typeNode: ts.TypeNode | undefined): boolean => {
    if (!typeNode) return false;
    const node = ts.isParenthesizedTypeNode(typeNode) ? typeNode.type : typeNode;
    return node.kind === ts.SyntaxKind.StringKeyword;
  };

  const getExplicitStringEvidence = (
    arg: ts.Expression,
    seen = new Set<ts.Node>()
  ): "string" | undefined => {
    const expr = stripParens(arg);
    if (seen.has(expr)) return undefined;
    seen.add(expr);

    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return expr.text.length === 1 ? undefined : "string";
    }

    if (ts.isTemplateExpression(expr)) {
      return "string";
    }

    const checkerStringEvidence =
      ctx.checker.typeToString(ctx.checker.getTypeAtLocation(expr)) === "string"
        ? "string"
        : undefined;

    if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
      if (isStringTypeNode(expr.type)) {
        return "string";
      }
      return getExplicitStringEvidence(expr.expression, seen);
    }

    if (ts.isIdentifier(expr)) {
      const symbol = ctx.checker.getSymbolAtLocation(expr);
      if (!symbol) return undefined;
      const resolvedSymbol =
        symbol.flags & ts.SymbolFlags.Alias
          ? ctx.checker.getAliasedSymbol(symbol)
          : symbol;
      const kinds = new Set<"string">();
      for (const decl of resolvedSymbol.getDeclarations() ?? []) {
        if (isStringTypeNode(getTypeNodeFromDeclaration(decl))) {
          kinds.add("string");
        }
      }
      return kinds.size === 1 ? "string" : checkerStringEvidence;
    }

    if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
      const lookupNode = ts.isPropertyAccessExpression(expr)
        ? expr.name
        : expr.argumentExpression ?? expr.expression;
      const symbol = ctx.checker.getSymbolAtLocation(lookupNode);
      if (!symbol) return undefined;
      const resolvedSymbol =
        symbol.flags & ts.SymbolFlags.Alias
          ? ctx.checker.getAliasedSymbol(symbol)
          : symbol;
      const kinds = new Set<"string">();
      for (const decl of resolvedSymbol.getDeclarations() ?? []) {
        if (isStringTypeNode(getTypeNodeFromDeclaration(decl))) {
          kinds.add("string");
        }
      }
      return kinds.size === 1 ? "string" : checkerStringEvidence;
    }

    if (ts.isCallExpression(expr)) {
      const signature = ctx.checker.getResolvedSignature(expr);
      const returnTypeNode = getReturnTypeNode(
        signature?.getDeclaration() as ts.SignatureDeclaration | undefined
      );
      return isStringTypeNode(returnTypeNode) ? "string" : checkerStringEvidence;
    }

    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      if (
        getExplicitStringEvidence(expr.left, seen) === "string" ||
        getExplicitStringEvidence(expr.right, seen) === "string"
      ) {
        return "string";
      }
      return checkerStringEvidence;
    }

    return checkerStringEvidence;
  };

  const getExplicitArgumentClrPrimitiveAlias = (
    arg: ts.Expression
  ): string | undefined => {
    const expr = stripParens(arg);

    if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
      return getExplicitClrPrimitiveAlias(expr.type);
    }

    if (ts.isIdentifier(expr)) {
      const sym = ctx.checker.getSymbolAtLocation(expr);
      if (!sym) return undefined;
      const resolvedSym =
        sym.flags & ts.SymbolFlags.Alias
          ? ctx.checker.getAliasedSymbol(sym)
          : sym;
      const aliases = new Set<string>();
      for (const decl of resolvedSym.getDeclarations() ?? []) {
        const typeNode = getTypeNodeFromDeclaration(decl);
        const alias = getExplicitClrPrimitiveAlias(typeNode);
        if (alias) {
          aliases.add(alias);
        }
      }

      return aliases.size === 1 ? Array.from(aliases)[0] : undefined;
    }

    return undefined;
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

  const paramClrAliasForArgIndex = (
    entry: SignatureEntry,
    argIndex: number
  ): string | undefined => {
    const params = entry.parameters;
    const direct = params[argIndex];
    const param = direct ?? params[params.length - 1];
    if (!param) return undefined;
    if (!direct && !param.isRest) return undefined;
    return getExplicitClrPrimitiveAlias(param.typeNode as ts.TypeNode | undefined);
  };

  const paramClassForArgIndex = (
    entry: SignatureEntry,
    argIndex: number
  ): "char" | "string" | "other" => {
    const params = entry.parameters;
    const direct = params[argIndex];
    const param = direct ?? params[params.length - 1];
    if (!param) return "other";
    if (!direct && !param.isRest) return "other";

    const typeNode = param.typeNode as ts.TypeNode | undefined;
    if (isStringTypeNode(typeNode)) {
      return "string";
    }
    if (getExplicitClrPrimitiveAlias(typeNode) === "char") {
      return "char";
    }
    if (typeNode && ts.isArrayTypeNode(typeNode)) {
      return getExplicitClrPrimitiveAlias(typeNode.elementType) === "char"
        ? "char"
        : "other";
    }
    return "other";
  };

  const getTypeNodeDisplayText = (
    typeNode: ts.TypeNode | undefined
  ): string | undefined => {
    if (!typeNode) return undefined;
    const node = ts.isParenthesizedTypeNode(typeNode) ? typeNode.type : typeNode;

    switch (node.kind) {
      case ts.SyntaxKind.StringKeyword:
        return "string";
      case ts.SyntaxKind.NumberKeyword:
        return "number";
      case ts.SyntaxKind.BooleanKeyword:
        return "boolean";
      case ts.SyntaxKind.UnknownKeyword:
        return "unknown";
      case ts.SyntaxKind.AnyKeyword:
        return "any";
      case ts.SyntaxKind.VoidKeyword:
        return "void";
      case ts.SyntaxKind.NullKeyword:
        return "null";
      case ts.SyntaxKind.UndefinedKeyword:
        return "undefined";
      case ts.SyntaxKind.BigIntKeyword:
        return "bigint";
    }

    if (ts.isArrayTypeNode(node)) {
      const element = getTypeNodeDisplayText(node.elementType);
      return element ? `${element}[]` : undefined;
    }

    if (ts.isTypeReferenceNode(node)) {
      return getEntityNameLeaf(node.typeName);
    }

    return undefined;
  };

  const getResolvedSignatureParameterDisplayTexts = (): readonly string[] => {
    return signature.getParameters().map((parameter) =>
      ctx.checker.typeToString(
        ctx.checker.getTypeOfSymbolAtLocation(parameter, node.expression)
      )
    );
  };

  const isInformativeResolvedSignatureDisplayText = (text: string): boolean =>
    text !== "unknown" &&
    text !== "any" &&
    text !== "number" &&
    text !== "object";

  const args = node.arguments;
  const wantsStringAt: number[] = [];
  const wantsExactClrAliasAt = new Map<number, string>();
  const objectLiteralArgs = new Map<number, readonly string[]>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) continue;

    if (getExplicitStringEvidence(arg) === "string") {
      wantsStringAt.push(i);
    }

    const exactClrAlias = getExplicitArgumentClrPrimitiveAlias(arg);
    if (exactClrAlias) {
      wantsExactClrAliasAt.set(i, exactClrAlias);
    }

    const objectKeys = getObjectLiteralKeys(arg);
    if (objectKeys && objectKeys.length > 0) {
      objectLiteralArgs.set(i, objectKeys);
    }
  }

  if (
    wantsStringAt.length === 0 &&
    wantsExactClrAliasAt.size === 0 &&
    objectLiteralArgs.size === 0
  ) {
    return resolvedId;
  }

  const matchesObjectLiteralArg = (
    entry: SignatureEntry,
    argIndex: number,
    keys: readonly string[]
  ): boolean => {
    const direct = entry.parameters[argIndex];
    const last = entry.parameters[entry.parameters.length - 1];
    const param = direct ?? (last?.isRest ? last : undefined);

    if (!param?.typeNode) return false;

    const typeNode = param.typeNode as ts.TypeNode;
    if (isUnknownTypeNode(typeNode)) return false;
    if (isObviouslyNonObjectTypeNode(typeNode)) return false;

    const propertyNames = collectDeclaredPropertyNames(typeNode);
    if (!propertyNames || propertyNames.size === 0) {
      return false;
    }

    for (const key of keys) {
      if (!propertyNames.has(key)) {
        return false;
      }
    }

    return true;
  };

  const isExactArityNonRestCandidate = (
    entry: SignatureEntry,
    argumentCount: number
  ): boolean =>
    entry.parameters.length === argumentCount &&
    entry.parameters.every((parameter) => !parameter.isRest);

  const candidateMap = new Map<number, SignatureId>();
  candidateMap.set(resolvedId.id, resolvedId);
  for (const candidate of candidates) {
    candidateMap.set(candidate.id, candidate);
  }

  let remaining = Array.from(candidateMap.values());
  const resolvedSignatureParameterDisplayTexts =
    getResolvedSignatureParameterDisplayTexts();

  if (
    resolvedSignatureParameterDisplayTexts.length > 0 &&
    resolvedSignatureParameterDisplayTexts.every(
      isInformativeResolvedSignatureDisplayText
    )
  ) {
    const matchingResolvedShape = remaining.filter((candidate) => {
      const entry = ctx.signatureMap.get(candidate.id);
      if (!entry) return false;
      if (entry.parameters.length !== resolvedSignatureParameterDisplayTexts.length) {
        return false;
      }
      return entry.parameters.every((parameter, index) => {
        const expected = resolvedSignatureParameterDisplayTexts[index];
        return (
          expected !== undefined &&
          getTypeNodeDisplayText(parameter.typeNode as ts.TypeNode | undefined) ===
            expected
        );
      });
    });
    if (
      matchingResolvedShape.length > 0 &&
      matchingResolvedShape.length < remaining.length
    ) {
      remaining = matchingResolvedShape;
    }
    if (remaining.length === 1) {
      return remaining[0]!;
    }
  }

  for (const argIndex of wantsStringAt) {
    const matching = remaining.filter((candidate) => {
      const entry = ctx.signatureMap.get(candidate.id);
      return entry !== undefined && paramClassForArgIndex(entry, argIndex) === "string";
    });
    if (matching.length > 0) {
      remaining = matching;
    }
    if (remaining.length === 1) {
      return remaining[0]!;
    }
  }

  const exactArityNonRest = remaining.filter((candidate) => {
    const entry = ctx.signatureMap.get(candidate.id);
    return entry !== undefined && isExactArityNonRestCandidate(entry, args.length);
  });
  if (
    exactArityNonRest.length > 0 &&
    exactArityNonRest.length < remaining.length
  ) {
    remaining = exactArityNonRest;
  }
  if (remaining.length === 1) {
    return remaining[0]!;
  }

  for (const [argIndex, exactClrAlias] of wantsExactClrAliasAt) {
    const matching = remaining.filter((candidate) => {
      const entry = ctx.signatureMap.get(candidate.id);
      return (
        entry !== undefined &&
        paramClrAliasForArgIndex(entry, argIndex) === exactClrAlias
      );
    });
    if (matching.length > 0) {
      remaining = matching;
    }
    if (remaining.length === 1) {
      return remaining[0]!;
    }
  }

  for (const [argIndex, keys] of objectLiteralArgs) {
    const matching = remaining.filter((candidate) => {
      const entry = ctx.signatureMap.get(candidate.id);
      return entry !== undefined && matchesObjectLiteralArg(entry, argIndex, keys);
    });
    if (matching.length > 0 && matching.length < remaining.length) {
      remaining = matching;
    }
    if (remaining.length === 1) {
      return remaining[0]!;
    }
  }

  return resolvedId;
};
