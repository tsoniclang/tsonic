/**
 * Binding Layer — Call Signature Resolution
 *
 * Contains the overload resolution logic for call expressions.
 * Split from binding-call-resolution.ts for file-size compliance.
 */

import ts from "typescript";
import type { SignatureId } from "../type-system/types.js";
import type { NumericKind } from "../types.js";
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
import {
  TSONIC_TO_NUMERIC_KIND,
  getBinaryResultKind,
  inferNumericKindFromRaw,
} from "../types.js";

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

  const TS_NUMERIC_BINARY_OPERATORS = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.PlusToken,
    ts.SyntaxKind.MinusToken,
    ts.SyntaxKind.AsteriskToken,
    ts.SyntaxKind.SlashToken,
    ts.SyntaxKind.PercentToken,
    ts.SyntaxKind.AsteriskAsteriskToken,
    ts.SyntaxKind.LessThanLessThanToken,
    ts.SyntaxKind.GreaterThanGreaterThanToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
    ts.SyntaxKind.AmpersandToken,
    ts.SyntaxKind.BarToken,
    ts.SyntaxKind.CaretToken,
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

  const isCharTypeNode = (typeNode: ts.TypeNode): boolean => {
    return getExplicitClrPrimitiveAlias(typeNode) === "char";
  };

  const getNumericKindFromTypeNode = (
    typeNode: ts.TypeNode | undefined
  ): NumericKind | undefined => {
    if (!typeNode) return undefined;
    const node = ts.isParenthesizedTypeNode(typeNode) ? typeNode.type : typeNode;

    if (node.kind === ts.SyntaxKind.NumberKeyword) {
      return "Double";
    }

    if (!ts.isTypeReferenceNode(node)) {
      return undefined;
    }

    const alias = getEntityNameLeaf(node.typeName);
    return TSONIC_TO_NUMERIC_KIND.get(alias);
  };

  const getUniqueDeclaredNumericKind = (
    declarations: readonly ts.Declaration[] | undefined
  ): NumericKind | undefined => {
    const kinds = new Set<NumericKind>();
    for (const declaration of declarations ?? []) {
      const typeNode = getTypeNodeFromDeclaration(declaration);
      const kind = getNumericKindFromTypeNode(typeNode);
      if (kind) {
        kinds.add(kind);
      }
    }

    return kinds.size === 1 ? Array.from(kinds)[0] : undefined;
  };

  const isSupportedSignatureDeclaration = (
    declaration: ts.SignatureDeclaration | ts.JSDocSignature | undefined
  ): declaration is ts.SignatureDeclaration =>
    declaration !== undefined && !ts.isJSDocSignature(declaration);

  const getFallbackNumericKindFromChecker = (
    expression: ts.Expression
  ): NumericKind | undefined => {
    const type = ctx.checker.getTypeAtLocation(expression);
    const numberType = ctx.checker.getNumberType();
    return ctx.checker.isTypeAssignableTo(type, numberType)
      ? "Double"
      : undefined;
  };

  const inferArgumentNumericKind = (
    arg: ts.Expression,
    seen = new Set<ts.Node>()
  ): NumericKind | undefined => {
    const expr = stripParens(arg);
    if (seen.has(expr)) return undefined;
    seen.add(expr);

    if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
      const assertedKind = getNumericKindFromTypeNode(expr.type);
      return assertedKind ?? inferArgumentNumericKind(expr.expression, seen);
    }

    if (
      ts.isNumericLiteral(expr) ||
      (expr.kind === ts.SyntaxKind.BigIntLiteral &&
        ts.isLiteralExpression(expr))
    ) {
      return inferNumericKindFromRaw(expr.getText());
    }

    if (
      ts.isPrefixUnaryExpression(expr) &&
      (expr.operator === ts.SyntaxKind.MinusToken ||
        expr.operator === ts.SyntaxKind.PlusToken)
    ) {
      if (
        ts.isNumericLiteral(expr.operand) ||
        (expr.operand.kind === ts.SyntaxKind.BigIntLiteral &&
          ts.isLiteralExpression(expr.operand))
      ) {
        return inferNumericKindFromRaw(expr.getText());
      }

      return inferArgumentNumericKind(expr.operand, seen);
    }

    if (ts.isIdentifier(expr)) {
      const symbol = ctx.checker.getSymbolAtLocation(expr);
      if (symbol) {
        const resolvedSymbol =
          symbol.flags & ts.SymbolFlags.Alias
            ? ctx.checker.getAliasedSymbol(symbol)
            : symbol;
        const declaredKind = getUniqueDeclaredNumericKind(
          resolvedSymbol.getDeclarations()
        );
        if (declaredKind) return declaredKind;
      }

      return getFallbackNumericKindFromChecker(expr);
    }

    if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
      const lookupNode = ts.isPropertyAccessExpression(expr)
        ? expr.name
        : expr.argumentExpression ?? expr.expression;
      const symbol = ctx.checker.getSymbolAtLocation(lookupNode);
      if (symbol) {
        const resolvedSymbol =
          symbol.flags & ts.SymbolFlags.Alias
            ? ctx.checker.getAliasedSymbol(symbol)
            : symbol;
        const declaredKind = getUniqueDeclaredNumericKind(
          resolvedSymbol.getDeclarations()
        );
        if (declaredKind) return declaredKind;
      }

      return getFallbackNumericKindFromChecker(expr);
    }

    if (ts.isCallExpression(expr)) {
      const signature = ctx.checker.getResolvedSignature(expr);
      const signatureDeclaration =
        isSupportedSignatureDeclaration(signature?.declaration)
          ? signature.declaration
          : undefined;
      const declaredKind = getNumericKindFromTypeNode(
        getReturnTypeNode(signatureDeclaration)
      );
      if (declaredKind) return declaredKind;
      return getFallbackNumericKindFromChecker(expr);
    }

    if (ts.isBinaryExpression(expr) && TS_NUMERIC_BINARY_OPERATORS.has(expr.operatorToken.kind)) {
      const leftKind = inferArgumentNumericKind(expr.left, seen);
      const rightKind = inferArgumentNumericKind(expr.right, seen);
      if (leftKind && rightKind) {
        return getBinaryResultKind(leftKind, rightKind);
      }
      return getFallbackNumericKindFromChecker(expr);
    }

    if (ts.isConditionalExpression(expr)) {
      const whenTrueKind = inferArgumentNumericKind(expr.whenTrue, seen);
      const whenFalseKind = inferArgumentNumericKind(expr.whenFalse, seen);
      if (whenTrueKind && whenFalseKind) {
        return whenTrueKind === whenFalseKind
          ? whenTrueKind
          : getBinaryResultKind(whenTrueKind, whenFalseKind);
      }
      return getFallbackNumericKindFromChecker(expr);
    }

    return getFallbackNumericKindFromChecker(expr);
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

  const paramNumericKindForArgIndex = (
    entry: SignatureEntry,
    argIndex: number
  ): NumericKind | undefined => {
    const params = entry.parameters;
    const direct = params[argIndex];
    const param = direct ?? params[params.length - 1];
    if (!param) return undefined;
    if (!direct && !param.isRest) return undefined;
    return getNumericKindFromTypeNode(param.typeNode as ts.TypeNode | undefined);
  };

  const args = node.arguments;
  const wantsStringAt: number[] = [];
  const wantsCharAt: number[] = [];
  const wantsExactClrAliasAt = new Map<number, string>();
  const wantsNumericKindAt = new Map<number, NumericKind>();
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

    const exactClrAlias = getExplicitArgumentClrPrimitiveAlias(arg);
    if (
      exactClrAlias &&
      exactClrAlias !== "char" &&
      CLR_NUMERIC_ALIAS_NAMES.has(exactClrAlias)
    ) {
      wantsExactClrAliasAt.set(i, exactClrAlias);
    }

    const numericKind = inferArgumentNumericKind(arg);
    if (numericKind) {
      wantsNumericKindAt.set(i, numericKind);
    }

    const objectKeys = getObjectLiteralKeys(arg);
    if (objectKeys && objectKeys.length > 0) {
      objectLiteralArgs.set(i, objectKeys);
    }
  }

  if (
    wantsStringAt.length === 0 &&
    wantsCharAt.length === 0 &&
    wantsExactClrAliasAt.size === 0 &&
    wantsNumericKindAt.size === 0 &&
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
    for (const [argIndex, exactClrAlias] of wantsExactClrAliasAt) {
      const parameterAlias = paramClrAliasForArgIndex(entry, argIndex);
      if (!parameterAlias) continue;
      if (parameterAlias === exactClrAlias) {
        score += 4;
        continue;
      }
      if (CLR_NUMERIC_ALIAS_NAMES.has(parameterAlias)) {
        score -= 4;
      }
    }
    for (const [argIndex, numericKind] of wantsNumericKindAt) {
      const parameterKind = paramNumericKindForArgIndex(entry, argIndex);
      if (!parameterKind) continue;
      if (parameterKind === numericKind) {
        score += 6;
        continue;
      }
      score -= 6;
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
