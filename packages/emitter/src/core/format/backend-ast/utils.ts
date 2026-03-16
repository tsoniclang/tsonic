/**
 * Backend AST utility functions
 *
 * Helpers for extracting information from C# AST nodes without
 * going through the printer.
 */

import type {
  CSharpExpressionAst,
  CSharpPredefinedTypeKeyword,
  CSharpQualifiedNameAst,
  CSharpTypeAst,
} from "./types.js";

const CSHARP_PREDEFINED_TYPE_KEYWORD_LIST: readonly CSharpPredefinedTypeKeyword[] =
  [
    "bool",
    "byte",
    "sbyte",
    "short",
    "ushort",
    "int",
    "uint",
    "long",
    "ulong",
    "nint",
    "nuint",
    "float",
    "double",
    "decimal",
    "char",
    "string",
    "object",
    "void",
  ] as const;

export const CSHARP_PREDEFINED_TYPE_KEYWORDS =
  new Set<CSharpPredefinedTypeKeyword>(CSHARP_PREDEFINED_TYPE_KEYWORD_LIST);

export const isCSharpPredefinedTypeKeyword = (
  name: string
): name is CSharpPredefinedTypeKeyword =>
  CSHARP_PREDEFINED_TYPE_KEYWORDS.has(name as CSharpPredefinedTypeKeyword);

/**
 * Extract a dotted name string from a C# expression AST.
 *
 * Handles identifierExpression, memberAccessExpression, and parenthesized
 * wrappers. Used for specialization name generation, int-cast analysis,
 * and diagnostic messages where a human-readable name is needed.
 *
 * Falls back to `<kind>` for unrecognized shapes (should not occur in
 * practice for callee/type-name positions).
 */
export const extractCalleeNameFromAst = (ast: CSharpExpressionAst): string => {
  switch (ast.kind) {
    case "identifierExpression":
      return ast.identifier;
    case "qualifiedIdentifierExpression":
      return qualifiedNameToString(ast.name);
    case "typeReferenceExpression": {
      switch (ast.type.kind) {
        case "predefinedType":
          return ast.type.keyword;
        case "identifierType":
          return ast.type.name;
        case "qualifiedIdentifierType":
          return qualifiedNameToString(ast.type.name);
        case "nullableType":
          return `${extractCalleeNameFromAst({
            kind: "typeReferenceExpression",
            type: ast.type.underlyingType,
          })}?`;
        default:
          return `<${ast.type.kind}>`;
      }
    }
    case "memberAccessExpression":
      return `${extractCalleeNameFromAst(ast.expression)}.${ast.memberName}`;
    case "parenthesizedExpression":
      return extractCalleeNameFromAst(ast.expression);
    case "castExpression":
    case "asExpression":
    case "suppressNullableWarningExpression":
    case "awaitExpression":
      return extractCalleeNameFromAst(ast.expression);
    default:
      return `<${ast.kind}>`;
  }
};

export const stripNullableTypeAst = (type: CSharpTypeAst): CSharpTypeAst =>
  type.kind === "nullableType"
    ? stripNullableTypeAst(type.underlyingType)
    : type;

export const globallyQualifyTypeAst = (type: CSharpTypeAst): CSharpTypeAst => {
  switch (type.kind) {
    case "predefinedType":
    case "varType":
      return type;
    case "identifierType":
      return {
        kind: "qualifiedIdentifierType",
        name: { aliasQualifier: "global", segments: [type.name] },
        typeArguments: type.typeArguments?.map(globallyQualifyTypeAst),
      };
    case "qualifiedIdentifierType":
      return type.name.aliasQualifier === "global"
        ? {
            ...type,
            typeArguments: type.typeArguments?.map(globallyQualifyTypeAst),
          }
        : {
            kind: "qualifiedIdentifierType",
            name: {
              aliasQualifier: "global",
              segments: [...type.name.segments],
            },
            typeArguments: type.typeArguments?.map(globallyQualifyTypeAst),
          };
    case "nullableType":
      return type.underlyingType.kind === "nullableType"
        ? globallyQualifyTypeAst(type.underlyingType)
        : {
            kind: "nullableType",
            underlyingType: globallyQualifyTypeAst(type.underlyingType),
          };
    case "arrayType":
      return {
        kind: "arrayType",
        elementType: globallyQualifyTypeAst(type.elementType),
        rank: type.rank,
      };
    case "pointerType":
      return {
        kind: "pointerType",
        elementType: globallyQualifyTypeAst(type.elementType),
      };
    case "tupleType":
      return {
        kind: "tupleType",
        elements: type.elements.map((element) => ({
          ...element,
          type: globallyQualifyTypeAst(element.type),
        })),
      };
    default: {
      const exhaustive: never = type;
      throw new Error(
        `ICE: Unhandled CSharpTypeAst kind '${(exhaustive as CSharpTypeAst).kind}' in globallyQualifyTypeAst`
      );
    }
  }
};

export const getIdentifierTypeName = (
  type: CSharpTypeAst
): string | undefined => {
  switch (type.kind) {
    case "identifierType":
      return type.name;
    case "qualifiedIdentifierType":
      return qualifiedNameToString(type.name);
    case "nullableType":
      return getIdentifierTypeName(type.underlyingType);
    default:
      return undefined;
  }
};

export const getIdentifierTypeLeafName = (
  type: CSharpTypeAst
): string | undefined => {
  switch (type.kind) {
    case "identifierType":
      return type.name;
    case "qualifiedIdentifierType":
      return qualifiedNameLeaf(type.name);
    case "nullableType":
      return getIdentifierTypeLeafName(type.underlyingType);
    default:
      return undefined;
  }
};

export const clrTypeNameToTypeAst = (clrName: string): CSharpTypeAst => {
  const hasGlobal = clrName.startsWith("global::");
  const body = hasGlobal ? clrName.slice("global::".length) : clrName;
  const sanitized = body.replace(/`\d+/g, "").replace(/\+/g, ".");

  if (isCSharpPredefinedTypeKeyword(sanitized)) {
    return { kind: "predefinedType", keyword: sanitized };
  }

  if (sanitized.includes(".")) {
    return {
      kind: "qualifiedIdentifierType",
      name: {
        ...(hasGlobal ? { aliasQualifier: "global" } : {}),
        segments: sanitized.split("."),
      },
    };
  }

  return hasGlobal
    ? {
        kind: "qualifiedIdentifierType",
        name: {
          aliasQualifier: "global",
          segments: [sanitized],
        },
      }
    : {
        kind: "identifierType",
        name: sanitized,
      };
};

export const stableTypeKeyFromAst = (type: CSharpTypeAst): string => {
  switch (type.kind) {
    case "predefinedType":
      return `predefined:${type.keyword}`;
    case "identifierType": {
      const args =
        type.typeArguments && type.typeArguments.length > 0
          ? `<${type.typeArguments.map(stableTypeKeyFromAst).join(",")}>`
          : "";
      return `identifier:${type.name}${args}`;
    }
    case "qualifiedIdentifierType": {
      const args =
        type.typeArguments && type.typeArguments.length > 0
          ? `<${type.typeArguments.map(stableTypeKeyFromAst).join(",")}>`
          : "";
      return `qualifiedIdentifier:${qualifiedNameToString(type.name)}${args}`;
    }
    case "nullableType":
      return `nullable:${stableTypeKeyFromAst(
        stripNullableTypeAst(type.underlyingType)
      )}`;
    case "arrayType":
      return `array:${type.rank}:${stableTypeKeyFromAst(type.elementType)}`;
    case "pointerType":
      return `pointer:${stableTypeKeyFromAst(type.elementType)}`;
    case "tupleType":
      return `tuple:${type.elements
        .map((e) =>
          e.name
            ? `${stableTypeKeyFromAst(e.type)}:${e.name}`
            : stableTypeKeyFromAst(e.type)
        )
        .join("|")}`;
    case "varType":
      return "var";
    default: {
      const exhaustive: never = type;
      throw new Error(
        `ICE: Unhandled CSharpTypeAst kind '${(exhaustive as CSharpTypeAst).kind}' in stableTypeKeyFromAst`
      );
    }
  }
};

export const stableIdentifierSuffixFromTypeAst = (
  type: CSharpTypeAst
): string => {
  switch (type.kind) {
    case "predefinedType":
      return type.keyword;
    case "identifierType": {
      const sanitizedName = type.name;
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return sanitizedName;
      }
      return `${sanitizedName}__${type.typeArguments
        .map(stableIdentifierSuffixFromTypeAst)
        .join("__")}`;
    }
    case "qualifiedIdentifierType": {
      const sanitizedName = type.name.aliasQualifier
        ? `${type.name.aliasQualifier}__${type.name.segments.join("_")}`
        : type.name.segments.join("_");
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return sanitizedName;
      }
      return `${sanitizedName}__${type.typeArguments
        .map(stableIdentifierSuffixFromTypeAst)
        .join("__")}`;
    }
    case "nullableType":
      return `${stableIdentifierSuffixFromTypeAst(type.underlyingType)}_nullable`;
    case "arrayType":
      return `${stableIdentifierSuffixFromTypeAst(type.elementType)}_array${type.rank}`;
    case "pointerType":
      return `${stableIdentifierSuffixFromTypeAst(type.elementType)}_ptr`;
    case "tupleType":
      return `tuple__${type.elements
        .map((element) => stableIdentifierSuffixFromTypeAst(element.type))
        .join("__")}`;
    case "varType":
      return "var";
    default: {
      const exhaustive: never = type;
      throw new Error(
        `ICE: Unhandled CSharpTypeAst kind '${(exhaustive as CSharpTypeAst).kind}' in stableIdentifierSuffixFromTypeAst`
      );
    }
  }
};

export const qualifiedNameToString = (name: CSharpQualifiedNameAst): string => {
  const body = name.segments.join(".");
  return name.aliasQualifier ? `${name.aliasQualifier}::${body}` : body;
};

export const qualifiedNameLeaf = (name: CSharpQualifiedNameAst): string => {
  const last = name.segments[name.segments.length - 1];
  if (!last) {
    throw new Error("ICE: qualified name AST has no segments.");
  }
  return last;
};
