/**
 * DTS Type Node Conversion & Signature Keys
 *
 * Helpers for converting tsbindgen .d.ts TypeNode AST nodes to IrType
 * and computing signature keys for deterministic overload matching.
 */

import type { TstsNode } from "@tsonic/tsts";
import { getTstsIdentifierText, getTstsNodeText, TstsSyntax } from "@tsonic/tsts";
import type { IrType } from "../../../types/index.js";
import type { TypeId } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// TSBINDGEN .D.TS TYPE NODE CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

export const INSTANCE_SUFFIX = "$instance";
export const VIEWS_PREFIX = "__";
export const VIEWS_SUFFIX = "$views";

export const stripTsBindgenInstanceSuffix = (name: string): string => {
  return name.endsWith(INSTANCE_SUFFIX)
    ? name.slice(0, -INSTANCE_SUFFIX.length)
    : name;
};

export const stripTsBindgenViewsWrapper = (
  name: string
): string | undefined => {
  if (!name.startsWith(VIEWS_PREFIX)) return undefined;
  if (!name.endsWith(VIEWS_SUFFIX)) return undefined;
  return name.slice(VIEWS_PREFIX.length, -VIEWS_SUFFIX.length);
};

const listNodes = (
  list: { readonly Nodes?: readonly (TstsNode | undefined)[] } | undefined
): readonly TstsNode[] =>
  (list?.Nodes ?? []).filter((node): node is TstsNode => node !== undefined);

export const getRightmostQualifiedNameText = (
  name: TstsNode
): string | undefined => {
  const identifier = getTstsIdentifierText(name);
  if (identifier) return identifier;
  const qualified = TstsSyntax.AsQualifiedName(name);
  if (qualified?.Right) return getRightmostQualifiedNameText(qualified.Right);
  return undefined;
};

export const getRightmostPropertyAccessText = (
  expr: TstsNode
): string | undefined => {
  const identifier = getTstsIdentifierText(expr);
  if (identifier) return identifier;
  if (TstsSyntax.IsPropertyAccessExpression(expr)) {
    return getTstsIdentifierText(TstsSyntax.Node_Name(expr));
  }
  if (TstsSyntax.IsCallExpression(expr)) {
    const inner = TstsSyntax.Node_Expression(expr);
    return inner ? getRightmostPropertyAccessText(inner) : undefined;
  }
  if (TstsSyntax.IsParenthesizedExpression(expr)) {
    const inner = TstsSyntax.Node_Expression(expr);
    return inner ? getRightmostPropertyAccessText(inner) : undefined;
  }
  return undefined;
};

const isSymbolTypeNode = (node: TstsNode): boolean =>
  node.Kind === TstsSyntax.KindSymbolKeyword ||
  (TstsSyntax.IsTypeReferenceNode(node) &&
    getRightmostQualifiedNameText(
      TstsSyntax.AsTypeReferenceNode(node)?.TypeName as TstsNode
    ) === "symbol");

const classifyRecordKeyTypeNode = (
  keyTypeNode: TstsNode
): IrType | undefined => {
  const nodes = TstsSyntax.IsUnionTypeNode(keyTypeNode)
    ? listNodes(TstsSyntax.AsUnionTypeNode(keyTypeNode)?.Types)
    : [keyTypeNode];

  let sawString = false;
  let sawNumber = false;
  let sawSymbol = false;

  for (const node of nodes) {
    if (node.Kind === TstsSyntax.KindStringKeyword) {
      sawString = true;
      continue;
    }
    if (node.Kind === TstsSyntax.KindNumberKeyword) {
      sawNumber = true;
      continue;
    }
    if (isSymbolTypeNode(node)) {
      sawSymbol = true;
      continue;
    }
    if (TstsSyntax.IsLiteralTypeNode(node)) {
      const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
      if (literal && TstsSyntax.IsStringLiteral(literal)) {
        sawString = true;
        continue;
      }
      if (literal && TstsSyntax.IsNumericLiteral(literal)) {
        sawNumber = true;
        continue;
      }
    }
    return undefined;
  }

  const distinctKinds =
    (sawString ? 1 : 0) + (sawNumber ? 1 : 0) + (sawSymbol ? 1 : 0);
  if (distinctKinds === 0) return undefined;

  if (distinctKinds > 1 || sawSymbol) {
    return { kind: "referenceType", name: "object" };
  }

  if (sawNumber) {
    return { kind: "primitiveType", name: "number" };
  }

  return { kind: "primitiveType", name: "string" };
};

export const dtsTypeNodeToIrType = (
  node: TstsNode,
  inScopeTypeParams: ReadonlySet<string>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>
): IrType => {
  // Parenthesized type
  if (TstsSyntax.IsParenthesizedTypeNode(node)) {
    const inner = TstsSyntax.AsParenthesizedTypeNode(node)?.Type;
    return inner
      ? dtsTypeNodeToIrType(inner, inScopeTypeParams, tsNameToTypeId)
      : { kind: "unknownType" };
  }

  // Type references (including type parameters)
  if (TstsSyntax.IsTypeReferenceNode(node)) {
    const rawName =
      getRightmostQualifiedNameText(
        TstsSyntax.AsTypeReferenceNode(node)?.TypeName as TstsNode
      ) ?? "";
    const baseName = stripTsBindgenInstanceSuffix(rawName);
    const nodeTypeArguments = listNodes(
      TstsSyntax.AsTypeReferenceNode(node)?.TypeArguments
    );

    // Utility: Record<K, V> should lower to dictionaryType in external bindings paths too.
    // Without this, contextual object literals against imported native target interfaces can carry
    // unresolved `referenceType("Record")` and fail IR soundness.
    if (baseName === "Record" && nodeTypeArguments.length === 2) {
      const keyTypeNode = nodeTypeArguments[0];
      const valueTypeNode = nodeTypeArguments[1];
      if (keyTypeNode && valueTypeNode) {
        const keyType = classifyRecordKeyTypeNode(keyTypeNode);
        if (keyType) {
          return {
            kind: "dictionaryType",
            keyType,
            valueType: dtsTypeNodeToIrType(
              valueTypeNode,
              inScopeTypeParams,
              tsNameToTypeId
            ),
          };
        }
      }
    }

    // tsbindgen imports native target numeric aliases from @tsonic/core as type references.
    // For IR purposes, `int` is a distinct primitive type (not referenceType).
    if (baseName === "int" && nodeTypeArguments.length === 0) {
      return { kind: "primitiveType", name: "int" };
    }

    // Type parameter reference: `T` (no type args) where T is in scope
    if (inScopeTypeParams.has(baseName) && nodeTypeArguments.length === 0) {
      return { kind: "typeParameterType", name: baseName };
    }

    const typeArguments = nodeTypeArguments.map((a) =>
      dtsTypeNodeToIrType(a, inScopeTypeParams, tsNameToTypeId)
    );

    const resolvedName =
      typeArguments.length > 0
        ? (() => {
            const arityName = `${baseName}_${typeArguments.length}`;
            return tsNameToTypeId.has(arityName) ? arityName : baseName;
          })()
        : baseName;

    return {
      kind: "referenceType",
      name: resolvedName,
      typeArguments:
        typeArguments.length > 0 ? typeArguments : undefined,
    };
  }

  // Array types
  if (TstsSyntax.IsArrayTypeNode(node)) {
    const elementType = TstsSyntax.AsArrayTypeNode(node)?.ElementType;
    return {
      kind: "arrayType",
      elementType: elementType
        ? dtsTypeNodeToIrType(elementType, inScopeTypeParams, tsNameToTypeId)
        : { kind: "unknownType" },
    };
  }

  // Union / intersection
  if (TstsSyntax.IsUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: listNodes(TstsSyntax.AsUnionTypeNode(node)?.Types).map((t) =>
        dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }
  if (TstsSyntax.IsIntersectionTypeNode(node)) {
    return {
      kind: "intersectionType",
      types: listNodes(TstsSyntax.AsIntersectionTypeNode(node)?.Types).map(
        (t) => dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }

  // Literal types
  if (TstsSyntax.IsLiteralTypeNode(node)) {
    const lit = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
    if (lit && TstsSyntax.IsStringLiteral(lit))
      return { kind: "literalType", value: getTstsNodeText(lit) ?? "" };
    if (lit && TstsSyntax.IsNumericLiteral(lit))
      return { kind: "literalType", value: Number(getTstsNodeText(lit) ?? "0") };
    if (
      lit &&
      TstsSyntax.IsPrefixUnaryExpression(lit) &&
      TstsSyntax.AsPrefixUnaryExpression(lit)?.Operand &&
      TstsSyntax.IsNumericLiteral(
        TstsSyntax.AsPrefixUnaryExpression(lit)?.Operand
      ) &&
      (TstsSyntax.AsPrefixUnaryExpression(lit)?.Operator ===
        TstsSyntax.KindMinusToken ||
        TstsSyntax.AsPrefixUnaryExpression(lit)?.Operator ===
          TstsSyntax.KindPlusToken)
    ) {
      const prefix = TstsSyntax.AsPrefixUnaryExpression(lit);
      const operand = prefix?.Operand;
      const magnitude = Number(operand ? getTstsNodeText(operand) : "0");
      return {
        kind: "literalType",
        value:
          prefix?.Operator === TstsSyntax.KindMinusToken
            ? -magnitude
            : magnitude,
      };
    }
    if (lit?.Kind === TstsSyntax.KindTrueKeyword)
      return { kind: "literalType", value: true };
    if (lit?.Kind === TstsSyntax.KindFalseKeyword)
      return { kind: "literalType", value: false };
    if (lit?.Kind === TstsSyntax.KindNullKeyword)
      return { kind: "primitiveType", name: "null" };
  }

  // Keywords
  switch (node.Kind) {
    case TstsSyntax.KindStringKeyword:
      return { kind: "primitiveType", name: "string" };
    case TstsSyntax.KindNumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case TstsSyntax.KindBooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case TstsSyntax.KindSymbolKeyword:
      return { kind: "referenceType", name: "object" };
    case TstsSyntax.KindVoidKeyword:
      return { kind: "voidType" };
    case TstsSyntax.KindAnyKeyword:
      return { kind: "anyType" };
    case TstsSyntax.KindUnknownKeyword:
      return { kind: "unknownType", explicit: true };
    case TstsSyntax.KindNeverKeyword:
      return { kind: "neverType" };
    case TstsSyntax.KindNullKeyword:
      return { kind: "primitiveType", name: "null" };
    case TstsSyntax.KindUndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    default:
      return { kind: "unknownType" };
  }
};

export const irTypeToSignatureKey = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return `p:${type.name}`;
    case "literalType":
      return `lit:${JSON.stringify(type.value)}`;
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "unknownType":
      return "unknown";
    case "anyType":
      return "any";
    case "typeParameterType":
      // Canonicalize all type parameters to a stable placeholder so tsbindgen's
      // `TContext` matches metadata's `T0`/`T` deterministically.
      return "T";
    case "arrayType":
      return `${irTypeToSignatureKey(type.elementType)}[]`;
    case "tupleType":
      return `[${type.elementTypes
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .join(",")}]`;
    case "unionType": {
      const parts = type.types
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .sort();
      return `(${parts.join("|")})`;
    }
    case "intersectionType": {
      const parts = type.types
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .sort();
      return `(${parts.join("&")})`;
    }
    case "dictionaryType":
      return `{[${irTypeToSignatureKey(type.keyType)}]:${irTypeToSignatureKey(type.valueType)}}`;
    case "functionType": {
      const params = type.parameters
        .map((p) => (p.type ? irTypeToSignatureKey(p.type) : "unknown"))
        .join(",");
      return `fn(${params})->${irTypeToSignatureKey(type.returnType)}`;
    }
    case "objectType":
      return "object";
    case "referenceType": {
      const raw = type.providerQualifiedName ?? type.name;
      const withoutArgs = raw.includes("[[")
        ? (raw.split("[[")[0] ?? raw)
        : raw;
      const lastSep = Math.max(
        withoutArgs.lastIndexOf("."),
        withoutArgs.lastIndexOf("+")
      );
      let simple = lastSep >= 0 ? withoutArgs.slice(lastSep + 1) : withoutArgs;

      // Canonicalize external target backtick arity: `Name`1` -> `Name_1`.
      const backtickMatch = simple.match(/`(\d+)$/);
      if (backtickMatch && backtickMatch[1]) {
        simple = `${simple.slice(0, -backtickMatch[0].length)}_${backtickMatch[1]}`;
      }

      const underscoreMatch = simple.match(/_(\d+)$/);
      const arity =
        underscoreMatch && underscoreMatch[1]
          ? Number(underscoreMatch[1])
          : undefined;
      const argCount = type.typeArguments?.length ?? arity ?? 0;

      // Signature matching is used only to hydrate optional/rest flags from tsbindgen .d.ts
      // into native target metadata signatures. To keep matching robust across:
      // - native target names vs TS names
      // - generic instantiation encodings (Action_1[[...]] vs Action_1<T>)
      // we intentionally ignore concrete type argument *identities* and retain only arity.
      if (argCount <= 0) return simple;
      return `${simple}<${Array.from({ length: argCount }, () => "*").join(",")}>`;
    }
    default:
      return "unknown";
  }
};

export const makeMethodOverloadKey = (args: {
  readonly isStatic: boolean;
  readonly name: string;
  readonly typeParamCount: number;
  readonly parameters: readonly {
    readonly type: IrType;
    readonly isRest: boolean;
  }[];
}): string => {
  const params = args.parameters
    .map((p) => `${p.isRest ? "..." : ""}${irTypeToSignatureKey(p.type)}`)
    .join(",");
  return `${args.isStatic ? "static" : "instance"}|${args.name}|${
    args.typeParamCount
  }|(${params})`;
};
