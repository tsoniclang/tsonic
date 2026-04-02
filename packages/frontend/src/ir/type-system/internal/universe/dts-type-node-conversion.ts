/**
 * DTS Type Node Conversion & Signature Keys
 *
 * Helpers for converting tsbindgen .d.ts TypeNode AST nodes to IrType
 * and computing signature keys for deterministic overload matching.
 */

import * as ts from "typescript";
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

export const getRightmostQualifiedNameText = (name: ts.EntityName): string => {
  if (ts.isIdentifier(name)) return name.text;
  return getRightmostQualifiedNameText(name.right);
};

export const getRightmostPropertyAccessText = (
  expr: ts.Expression
): string | undefined => {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isCallExpression(expr))
    return getRightmostPropertyAccessText(expr.expression);
  if (ts.isParenthesizedExpression(expr))
    return getRightmostPropertyAccessText(expr.expression);
  return undefined;
};

const isSymbolTypeNode = (node: ts.TypeNode): boolean =>
  node.kind === ts.SyntaxKind.SymbolKeyword ||
  (ts.isTypeReferenceNode(node) &&
    ts.isIdentifier(node.typeName) &&
    node.typeName.text === "symbol");

const classifyRecordKeyTypeNode = (
  keyTypeNode: ts.TypeNode
): IrType | undefined => {
  const nodes = ts.isUnionTypeNode(keyTypeNode)
    ? keyTypeNode.types
    : [keyTypeNode];

  let sawString = false;
  let sawNumber = false;
  let sawSymbol = false;

  for (const node of nodes) {
    if (node.kind === ts.SyntaxKind.StringKeyword) {
      sawString = true;
      continue;
    }
    if (node.kind === ts.SyntaxKind.NumberKeyword) {
      sawNumber = true;
      continue;
    }
    if (isSymbolTypeNode(node)) {
      sawSymbol = true;
      continue;
    }
    if (ts.isLiteralTypeNode(node)) {
      if (ts.isStringLiteral(node.literal)) {
        sawString = true;
        continue;
      }
      if (ts.isNumericLiteral(node.literal)) {
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
  node: ts.TypeNode,
  inScopeTypeParams: ReadonlySet<string>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>
): IrType => {
  // Parenthesized type
  if (ts.isParenthesizedTypeNode(node)) {
    return dtsTypeNodeToIrType(node.type, inScopeTypeParams, tsNameToTypeId);
  }

  // Type references (including type parameters)
  if (ts.isTypeReferenceNode(node)) {
    const rawName = getRightmostQualifiedNameText(node.typeName);
    const baseName = stripTsBindgenInstanceSuffix(rawName);

    // Utility: Record<K, V> should lower to dictionaryType in CLR bindings paths too.
    // Without this, contextual object literals against imported CLR interfaces can carry
    // unresolved `referenceType("Record")` and fail IR soundness.
    if (baseName === "Record" && node.typeArguments?.length === 2) {
      const keyTypeNode = node.typeArguments[0];
      const valueTypeNode = node.typeArguments[1];
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

    // tsbindgen imports CLR numeric aliases from @tsonic/core as type references.
    // For IR purposes, `int` is a distinct primitive type (not referenceType).
    if (baseName === "int" && !node.typeArguments?.length) {
      return { kind: "primitiveType", name: "int" };
    }

    // Type parameter reference: `T` (no type args) where T is in scope
    if (inScopeTypeParams.has(baseName) && !node.typeArguments?.length) {
      return { kind: "typeParameterType", name: baseName };
    }

    const typeArguments = node.typeArguments?.map((a) =>
      dtsTypeNodeToIrType(a, inScopeTypeParams, tsNameToTypeId)
    );

    const resolvedName =
      typeArguments && typeArguments.length > 0
        ? (() => {
            const arityName = `${baseName}_${typeArguments.length}`;
            return tsNameToTypeId.has(arityName) ? arityName : baseName;
          })()
        : baseName;

    return {
      kind: "referenceType",
      name: resolvedName,
      typeArguments:
        typeArguments && typeArguments.length > 0 ? typeArguments : undefined,
    };
  }

  // Array types
  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "arrayType",
      elementType: dtsTypeNodeToIrType(
        node.elementType,
        inScopeTypeParams,
        tsNameToTypeId
      ),
    };
  }

  // Union / intersection
  if (ts.isUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: node.types.map((t) =>
        dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }
  if (ts.isIntersectionTypeNode(node)) {
    return {
      kind: "intersectionType",
      types: node.types.map((t) =>
        dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }

  // Literal types
  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal;
    if (ts.isStringLiteral(lit))
      return { kind: "literalType", value: lit.text };
    if (ts.isNumericLiteral(lit))
      return { kind: "literalType", value: Number(lit.text) };
    if (lit.kind === ts.SyntaxKind.TrueKeyword)
      return { kind: "literalType", value: true };
    if (lit.kind === ts.SyntaxKind.FalseKeyword)
      return { kind: "literalType", value: false };
    if (lit.kind === ts.SyntaxKind.NullKeyword)
      return { kind: "primitiveType", name: "null" };
  }

  // Keywords
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitiveType", name: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case ts.SyntaxKind.SymbolKeyword:
      return { kind: "referenceType", name: "object" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "anyType" };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType", explicit: true };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
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
      const raw = type.resolvedClrType ?? type.name;
      const withoutArgs = raw.includes("[[")
        ? (raw.split("[[")[0] ?? raw)
        : raw;
      const lastSep = Math.max(
        withoutArgs.lastIndexOf("."),
        withoutArgs.lastIndexOf("+")
      );
      let simple = lastSep >= 0 ? withoutArgs.slice(lastSep + 1) : withoutArgs;

      // Canonicalize CLR backtick arity: `Action`1` -> `Action_1`.
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
      // into CLR metadata signatures. To keep matching robust across:
      // - CLR names vs TS names
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
